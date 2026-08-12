// Optimiseur de build : cherche, dans un pool de runes possédées, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre donné, sous contrainte
// d'un combo de sets, de statistiques principales imposées (slots 2/4/6) et
// de minimums/maximums de stats.
//
// Anticipé dans spec/compte/calcul-runes.md §6 (Perf) : « jamais de
// brute-force → Web Worker, tableaux typés, branch-and-bound + pré-filtrage
// par slot ». Calcul pur (aucune dépendance React) : réutilisable tel quel
// dans le Worker (src/workers/runeBuildOptim.worker.ts) et dans les tests.
//
// ⚠️ **Meet-in-the-middle**, pas un simple branch-and-bound linéaire sur les
// 6 slots. Un branch-and-bound naïf ne détecte un combo de sets impossible
// qu'au bout des 6 choix (le test `missingSets` n'a de sens que sur les 6
// runes réunies) : il gaspille énormément de branches à explorer des débuts
// de combinaison qui ne pourront jamais aboutir. Ici, les 6 slots sont
// scindés en deux MOITIÉS de 3, chacune énumérée depuis le pool déjà
// pré-filtré par slot ; les moitiés sont regroupées par le compte EXACT de
// pièces de chaque set demandé qu'elles apportent (+ jokers Intangible) —
// deux moitiés dont les comptes s'additionnent pour satisfaire le combo
// peuvent être appariées SANS jamais énumérer le produit complet des runes
// individuelles.
//
// ⚠️ **Compartiments EN FLUX, bornés en mémoire.** Une première version
// construisait un tableau complet de `cap³` combinaisons par moitié avant de
// les regrouper : sur un vrai compte (des centaines de runes par slot), ça
// pouvait épuiser plusieurs Go de mémoire et planter — voir
// spec/outils/optimizer.md, « Validation grandeur nature ». Chaque
// combinaison est maintenant évaluée puis, selon son mérite, retenue ou
// **immédiatement jetée** : la mémoire dépend du nombre de compartiments ×
// leur taille max (`BUCKET_CAP`), plus jamais du cube du pré-filtrage par
// slot. Voir spec/outils/optimizer.md pour le résumé fonctionnel, et
// .claude/skills/algo-verify/SKILL.md pour la discipline de vérification
// (référence brute-force + test différentiel dans
// tests/rune-optim-differential.test.ts).
//
// ⚠️ **Élagage de FAISABILITÉ uniquement.** Le but n'est pas de maximiser un
// seul critère pendant la recherche, mais de COLLECTER un ensemble large mais
// borné de combinaisons valides, pour que le tri (PV/VIT/efficience/…) se
// fasse ensuite côté client, instantanément, sur des candidats déjà
// entièrement calculés — sans relancer la recherche à chaque changement de
// tri. D'où des bornes d'élagage volontairement SÛRES (jamais un sous-estimé
// du potentiel restant, qui écarterait à tort une combinaison réellement
// valable) plutôt que maximalement serrées.

import { ArtifactDetail, BaseStats, GearSet, RelicDetail, RuneDetail } from '../types';
import { RUNE_EFFECT, SET_STAT_BONUS, StatKey, activeSets, runeEfficiency, runeScore } from './effects';
import { computeStats, StatRow } from './stats';
import { missingSets } from './recoMatch';
import { OptimMetric } from './runeOptim';

// Statistiques principales possibles, par emplacement — RÈGLES DU JEU. Les
// slots 1/3/5 ont une principale FIXE (ATQ plat / DEF plat / PV plat) : pas
// de choix, donc pas d'entrée ici. Codes : voir RUNE_EFFECT (2=PV%, 4=ATQ%,
// 6=DEF%, 8=VIT, 9=Taux Crit, 10=Dmg Crit, 11=RES, 12=Précision).
export const SLOT_MAIN_OPTIONS: Record<2 | 4 | 6, number[]> = {
  2: [2, 4, 6, 8],
  4: [2, 4, 6, 9, 10],
  6: [2, 4, 6, 11, 12],
};

export interface BuildRequirement {
  // Multiset de clés RUNE_SETS, **au format `activeSets`** (une entrée par
  // activation : ['violent','will'] = Violent 4p + Will 2p ; ['fight','fight']
  // = 2× Fight). Coût en runes ≤ 6, garanti par l'UI (setsCost/canAddSet).
  sets: string[];
  // Minimums exigés sur le TOTAL final (comme RecoSlot.stats). Absent = non exigé.
  minStats: Partial<Record<StatKey, number>>;
  // Maximums exigés sur le TOTAL final. Absent = non plafonné.
  maxStats?: Partial<Record<StatKey, number>>;
  // Statistiques principales AUTORISÉES sur les slots 2/4/6 (codes RUNE_EFFECT,
  // voir SLOT_MAIN_OPTIONS). Absent/vide pour un slot = pas de contrainte.
  mainStats?: Partial<Record<2 | 4 | 6, number[]>>;
}

export interface BuildCandidate {
  runeIds: number[]; // 6 ids, alignés slot 1..6
  stats: StatRow[]; // computeStats(base + ces 6 runes + artefacts/relique fixes)
  effTotal: number; // somme des 6 valeurs individuelles, dans la mesure demandée
}

export interface SearchParams {
  base: BaseStats;
  artifacts: ArtifactDetail[]; // fixes : ceux actuellement équipés
  relic?: RelicDetail; // fixe
  pool: RuneDetail[]; // runes candidates (déjà filtrées par exclusion en amont)
  requirement: BuildRequirement;
  metric: OptimMetric;
  maxNodes?: number; // budget de PAIRES (moitié+moitié) évaluées, pas de nœuds d'arbre
  maxCollected?: number; // plafond de candidats retenus avant arrêt (défaut MAX_COLLECTED)
  maxMs?: number; // budget de TEMPS écoulé, en ms (défaut DEFAULT_MAX_MS)
  slotFilterCap?: number; // candidats retenus par slot et par paquet (défaut MAX_PER_SLOT_MATCH/FILL)
}

export interface SearchResult {
  candidates: BuildCandidate[];
  explored: number;
  truncated: boolean;
}

const DEFAULT_MAX_NODES = 400_000;
// ⚠️ Calibré par mesure, pas au jugé (scripts/benchmark-optim.ts, voir
// spec/outils/optimizer.md) : sur des pools synthétiques de 500 à 5000
// runes, la troncature au plafond de collecte est SYSTÉMATIQUE (le budget de
// paires n'est jamais le facteur limitant), et le passer à 5000 restait sous
// ~4 s dans le pire scénario testé. 2000 est un compromis mesuré entre
// « le message de troncature devient rare » et « la recherche reste rapide ».
// Surchargeable via SearchParams.maxCollected.
const MAX_COLLECTED = 2000;
// Filet de sécurité indépendant de maxNodes/maxCollected : sur les scénarios
// mesurés (500 à 5000 runes, scripts/benchmark-optim.ts), le pire cas était
// sous ~4 s — 15 s laisse une marge large avant de considérer qu'une
// recherche est anormalement lente, sans jamais bloquer l'interface
// puisqu'elle tourne dans un Worker. Surchargeable via SearchParams.maxMs.
const DEFAULT_MAX_MS = 15_000;
// Deux paquets par slot : les runes du (ou des) set(s) demandé(s) — pour
// garantir qu'une combinaison satisfaisant le combo reste atteignable même
// après filtrage — et les meilleures runes toutes provenances, pour la
// diversité des slots « libres ». L'union des deux, dédupliquée.
const MAX_PER_SLOT_MATCH = 40;
const MAX_PER_SLOT_FILL = 40;
// ⚠️ En plus des deux paquets ci-dessus : le meilleur d'un slot sur CHAQUE
// stat individuellement, même sans minimum demandé dessus. Sans ça, le
// pré-filtrage ne retient que ce qui sert les minimums SAISIS — si
// l'utilisateur ne demande aucun minimum de VIT puis trie les résultats
// « par VIT », le pool a déjà pu écarter les meilleures runes VIT au profit
// de runes globalement plus « pertinentes » pour d'autres critères. Le tri
// après coup (voir OptimizerSection.tsx) ne peut être honnête que si le pool
// pré-filtré garde une chance à chacun des 9 critères de tri proposés.
const PER_STAT_KEEP = 6;
// Combinaisons retenues par COMPARTIMENT (pas par slot) — voir l'en-tête du
// fichier. Borne la mémoire indépendamment de `slotFilterCap` : même à un
// pré-filtrage large, un compartiment ne grossit jamais au-delà de ça.
// ⚠️ Calibré sur un vrai compte (voir spec/outils/optimizer.md, « Validation
// grandeur nature ») : à 300, un compartiment très peuplé (le combo de sets
// « évident » d'un build réel) pouvait perdre la bonne combinaison — les 6
// runes survivaient au pré-filtrage par slot, mais leur PAIRE de moitiés,
// noyée parmi des dizaines de milliers de rivales du même compartiment, ne
// l'était pas. Mesuré : 300 → jamais trouvé ; 3000 → trouvé en ~50 s (bien
// plus qu'il n'en faut) ; 600 → trouvé en ~16 s. Retenu comme compromis.
const BUCKET_CAP = 600;

const ALL_STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];

/* --------------------------------------------------------------------------
 * Contribution d'une rune à une stat donnée (pct/flat), réutilisant la même
 * table que computeStats — mais rune par rune, pour l'accumulation
 * incrémentale du pré-filtrage et des bornes d'élagage.
 * ----------------------------------------------------------------------- */
function runeContribution(rune: RuneDetail, key: StatKey): { pct: number; flat: number } {
  let pct = 0;
  let flat = 0;
  const add = (code: number, value: number) => {
    const def = RUNE_EFFECT[code];
    if (!def || def.stat !== key) return;
    if (def.pct) pct += value;
    else flat += value;
  };
  add(rune.main.code, rune.main.value);
  if (rune.innate) add(rune.innate.code, rune.innate.value);
  for (const s of rune.subs) add(s.code, s.value);
  return { pct, flat };
}

function valueOf(rune: RuneDetail, metric: OptimMetric): number {
  return metric === 'eff' ? runeEfficiency(rune) : runeScore(rune);
}

/* --------------------------------------------------------------------------
 * Pré-filtrage par slot
 * ----------------------------------------------------------------------- */
function relevance(rune: RuneDetail, requirement: BuildRequirement): number {
  let score = 0;
  for (const [key, min] of Object.entries(requirement.minStats)) {
    if (min == null || min <= 0) continue;
    const c = runeContribution(rune, key as StatKey);
    score += (c.pct + c.flat) / min;
  }
  // Tie-break générique : une rune globalement meilleure reste préférable
  // quand rien ne la distingue sur les stats demandées.
  score += runeEfficiency(rune) / 1000;
  return score;
}

export function filterSlot(
  candidates: RuneDetail[],
  requirement: BuildRequirement,
  matchCap = MAX_PER_SLOT_MATCH,
  fillCap = MAX_PER_SLOT_FILL
): RuneDetail[] {
  const requiredKeys = new Set(requirement.sets);
  const scored = candidates
    .map((r) => ({ r, s: relevance(r, requirement) }))
    .sort((a, b) => b.s - a.s);

  const kept = new Map<number, RuneDetail>();

  const matches = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
  for (const { r } of matches.slice(0, matchCap)) kept.set(r.id, r);
  for (const { r } of scored.slice(0, fillCap)) kept.set(r.id, r);

  // Le meilleur d'un slot sur chaque stat individuellement — voir PER_STAT_KEEP.
  for (const k of ALL_STAT_KEYS) {
    const top = candidates
      .map((r) => {
        const c = runeContribution(r, k);
        return { r, v: c.pct + c.flat };
      })
      .sort((a, b) => b.v - a.v)
      .slice(0, PER_STAT_KEEP);
    for (const { r } of top) kept.set(r.id, r);
  }

  return Array.from(kept.values());
}

/* --------------------------------------------------------------------------
 * Bonus de set GARANTI par le combo demandé (il sera actif dans tout build
 * valide, puisqu'un build valide satisfait `requirement.sets` par
 * construction) — ajouté une fois comme base des accumulateurs.
 * ----------------------------------------------------------------------- */
function guaranteedSetBonus(requirement: BuildRequirement, base: BaseStats): { pct: Record<string, number>; flat: Record<string, number> } {
  const pct: Record<string, number> = {};
  const flat: Record<string, number> = {};
  for (const key of requirement.sets) {
    const bonus = SET_STAT_BONUS[key];
    if (!bonus) continue;
    if (bonus.pct != null) {
      if (bonus.stat === 'hp' || bonus.stat === 'atk' || bonus.stat === 'def') {
        pct[bonus.stat] = (pct[bonus.stat] ?? 0) + bonus.pct;
      } else {
        const baseVal = (base as unknown as Record<string, number>)[bonus.stat] ?? 0;
        flat[bonus.stat] = (flat[bonus.stat] ?? 0) + Math.ceil((baseVal * bonus.pct) / 100);
      }
    } else if (bonus.flat != null) {
      flat[bonus.stat] = (flat[bonus.stat] ?? 0) + bonus.flat;
    }
  }
  return { pct, flat };
}

function artifactFlatBonus(artifacts: ArtifactDetail[]): Record<string, number> {
  const flat: Record<string, number> = {};
  // Les artéfacts utilisent des codes distincts (100/101/102) : PV/ATQ/DEF plats.
  for (const a of artifacts) {
    if (a.main.code === 100) flat.hp = (flat.hp ?? 0) + a.main.value;
    else if (a.main.code === 101) flat.atk = (flat.atk ?? 0) + a.main.value;
    else if (a.main.code === 102) flat.def = (flat.def ?? 0) + a.main.value;
  }
  return flat;
}

function relicPctBonus(relic?: RelicDetail): Record<string, number> {
  const pct: Record<string, number> = {};
  if (!relic) return pct;
  // 100 PV% / 101 ATQ% / 102 DEF%
  if (relic.main.code === 100) pct.hp = (pct.hp ?? 0) + relic.main.value;
  else if (relic.main.code === 101) pct.atk = (pct.atk ?? 0) + relic.main.value;
  else if (relic.main.code === 102) pct.def = (pct.def ?? 0) + relic.main.value;
  return pct;
}

/* --------------------------------------------------------------------------
 * Meet-in-the-middle : moitiés de 3 slots, compartiments EN FLUX
 * ----------------------------------------------------------------------- */

interface HalfCombo {
  runes: [RuneDetail, RuneDetail, RuneDetail];
  counts: number[]; // aligné sur `distinctKeys` : nb de pièces de chaque set demandé
  jokers: number; // nb de runes Intangible dans cette moitié
  pct: Record<string, number>; // contribution cumulée, par stat CONTRAINTE (min OU max) seulement
  flat: Record<string, number>;
  relevanceScore: number;
}

interface Bucket {
  counts: number[];
  jokers: number;
  combos: HalfCombo[]; // borné à BUCKET_CAP, trié décroissant par relevanceScore
  maxPct: Record<string, number>; // borne SÛRE (jamais sous-estimée) par stat contrainte
  maxFlat: Record<string, number>;
}

function bucketKeyOf(counts: number[], jokers: number): string {
  return `${counts.join(',')}|${jokers}`;
}

// Insertion triée bornée : ce qui ne rentre plus est jeté IMMÉDIATEMENT,
// jamais accumulé puis élagué après coup — c'est ce qui borne la mémoire,
// pas seulement le temps. Repli rapide (O(1)) pour l'écrasante majorité des
// combinaisons générées une fois un compartiment plein : elles ne battent pas
// la pire déjà gardée, donc un seul test suffit à les écarter.
function insertBounded(list: HalfCombo[], combo: HalfCombo): void {
  if (list.length >= BUCKET_CAP && combo.relevanceScore <= list[list.length - 1].relevanceScore) {
    return;
  }
  let i = 0;
  while (i < list.length && list[i].relevanceScore >= combo.relevanceScore) i++;
  list.splice(i, 0, combo);
  if (list.length > BUCKET_CAP) list.pop();
}

// Construit les compartiments d'une moitié EN FLUX : chaque combinaison
// (r0,r1,r2) est évaluée une fois, jamais matérialisée dans un tableau
// intermédiaire de `cap³` éléments. Voir l'en-tête du fichier.
function buildBuckets(
  slotIdxs: readonly [number, number, number],
  filtered: RuneDetail[][],
  distinctKeys: string[],
  constrainedKeys: StatKey[]
): Bucket[] {
  const [i0, i1, i2] = slotIdxs;
  const buckets = new Map<string, Bucket>();

  for (const r0 of filtered[i0]) {
    for (const r1 of filtered[i1]) {
      for (const r2 of filtered[i2]) {
        const runes: [RuneDetail, RuneDetail, RuneDetail] = [r0, r1, r2];
        const counts = distinctKeys.map((key) => runes.filter((r) => r.set === key).length);
        const jokers = runes.filter((r) => r.set === 'intangible').length;
        const pct: Record<string, number> = {};
        const flat: Record<string, number> = {};
        let score = (runeEfficiency(r0) + runeEfficiency(r1) + runeEfficiency(r2)) / 1000;
        for (const k of constrainedKeys) {
          let p = 0;
          let f = 0;
          for (const r of runes) {
            const c = runeContribution(r, k);
            p += c.pct;
            f += c.flat;
          }
          pct[k] = p;
          flat[k] = f;
        }

        const key = bucketKeyOf(counts, jokers);
        let b = buckets.get(key);
        if (!b) {
          b = { counts, jokers, combos: [], maxPct: {}, maxFlat: {} };
          buckets.set(key, b);
        }
        // ⚠️ Les bornes s'étendent avec CHAQUE combinaison vue, y compris
        // celles qu'on ne retient pas au final : une combinaison écartée
        // (pas assez pertinente sur l'ensemble) peut quand même repousser le
        // maximum atteignable sur une stat en particulier. Rester large ici
        // ne coûte rien et ne peut jamais écarter une paire à tort — voir
        // `pairFeasible`.
        for (const k of constrainedKeys) {
          if (pct[k] > (b.maxPct[k] ?? 0)) b.maxPct[k] = pct[k];
          if (flat[k] > (b.maxFlat[k] ?? 0)) b.maxFlat[k] = flat[k];
        }
        insertBounded(b.combos, { runes, counts, jokers, pct, flat, relevanceScore: score });
      }
    }
  }
  return Array.from(buckets.values());
}

// ⚠️ Vérifie si deux moitiés PEUVENT ensemble satisfaire le combo de sets, à
// partir des seuls COMPTES agrégés (pas des runes réelles). C'est un
// PRÉ-FILTRE, volontairement plus optimiste que la réalité : le calcul réel
// (`activeSets` sur les 6 vraies runes) peut faire concourir des jokers avec
// des runes de sets HORS combo demandé (un « Shield » isolé, par exemple), ce
// que cette version simplifiée ignore. C'est SÛR dans le sens qui compte :
// si la vraie combinaison (avec cette concurrence en plus) parvient à
// satisfaire le combo, alors cette version simplifiée (sans concurrence)
// réussit forcément aussi — donc `false` ici garantit `false` en réalité, et
// permet d'écarter une paire de compartiments sans jamais en écarter une à
// tort. La décision d'ACCEPTER, elle, repasse toujours par le calcul réel sur
// les runes effectivement choisies (voir `searchBuilds`).
function satisfiesSets(
  countsA: number[],
  jokersA: number,
  countsB: number[],
  jokersB: number,
  distinctKeys: string[],
  requirement: BuildRequirement
): boolean {
  if (requirement.sets.length === 0) return true;
  const synthetic: string[] = [];
  for (let i = 0; i < distinctKeys.length; i++) {
    const n = countsA[i] + countsB[i];
    for (let j = 0; j < n; j++) synthetic.push(distinctKeys[i]);
  }
  for (let j = 0; j < jokersA + jokersB; j++) synthetic.push('intangible');
  return missingSets(requirement.sets, activeSets(synthetic)).length === 0;
}

/* --------------------------------------------------------------------------
 * Recherche
 * ----------------------------------------------------------------------- */

// Étape intermédiaire : ce qu'on a trouvé JUSQU'ICI, pas encore le résultat
// final (`truncated` n'a pas de sens tant que la recherche n'est pas arrêtée
// — voir SearchResult). Sert à l'arrêt manuel (bouton « Arrêter ») : on
// ressort ce dernier point de passage, converti en résultat définitif.
export interface SearchProgress {
  candidates: BuildCandidate[];
  explored: number;
}

// Fréquence des points de passage (`yield`) : assez souvent pour qu'un temps
// limite ou un arrêt manuel réagissent vite (quelques centaines de ms au
// pire, voir scripts/benchmark-optim.ts), assez rare pour ne pas payer le
// coût d'un `yield` de générateur à chaque paire évaluée.
const CHECKPOINT_EVERY = 500;

/**
 * Cœur du moteur, sous forme de GÉNÉRATEUR : produit un {@link SearchProgress}
 * à intervalles réguliers plutôt que de tourner jusqu'au bout d'un seul bloc.
 * ⚠️ Ce n'est pas une seconde implémentation à maintenir en double :
 * `searchBuilds` (l'API historique, utilisée par les tests/le benchmark) ne
 * fait que DRAINER ce générateur jusqu'à son `return`. Le Worker, lui,
 * pilote le générateur pas à pas, ce qui permet de rendre la main entre deux
 * points de passage — condition nécessaire pour recevoir un message
 * d'arrêt pendant que la recherche tourne (voir
 * src/workers/runeBuildOptim.worker.ts).
 */
export function* searchBuildsSteps(params: SearchParams): Generator<SearchProgress, SearchResult, void> {
  const { base, artifacts, relic, pool, requirement, metric } = params;
  const maxNodes = params.maxNodes ?? DEFAULT_MAX_NODES;
  const maxCollected = params.maxCollected ?? MAX_COLLECTED;
  const maxMs = params.maxMs ?? DEFAULT_MAX_MS;
  const slotCap = params.slotFilterCap ?? MAX_PER_SLOT_MATCH;
  const startedAt = Date.now();

  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of pool) {
    if (r.slot < 1 || r.slot > 6) continue;
    // ⚠️ Contrainte de statistique principale (slots 2/4/6 seulement — les
    // autres n'ont pas d'entrée dans `mainStats`, donc `allowed` reste
    // `undefined` et rien n'est filtré). Appliquée AVANT le pré-filtrage par
    // pertinence : elle réduit le pool réel dès le départ, ce qui atténue
    // aussi le coût mémoire/temps de tout ce qui suit.
    const allowed = requirement.mainStats?.[r.slot as 2 | 4 | 6];
    if (allowed && allowed.length > 0 && !allowed.includes(r.main.code)) continue;
    bySlot[r.slot - 1].push(r);
  }
  const filtered = bySlot.map((list) => filterSlot(list, requirement, slotCap, slotCap));
  if (filtered.some((list) => list.length === 0)) {
    return { candidates: [], explored: 0, truncated: false };
  }
  const overBudget = () => Date.now() - startedAt > maxMs;

  const minEntries = ALL_STAT_KEYS
    .map((k) => ({ k, min: requirement.minStats[k] }))
    .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);
  const maxEntries = ALL_STAT_KEYS
    .map((k) => ({ k, max: requirement.maxStats?.[k] }))
    .filter((e): e is { k: StatKey; max: number } => e.max != null && e.max > 0);
  const constrainedKeys = Array.from(new Set([...minEntries.map((e) => e.k), ...maxEntries.map((e) => e.k)]));

  const distinctKeys = Array.from(new Set(requirement.sets));

  const guaranteed = guaranteedSetBonus(requirement, base);
  const artFlat = artifactFlatBonus(artifacts);
  const relPct = relicPctBonus(relic);
  const baseRec = base as unknown as Record<string, number>;

  const bucketsA = buildBuckets([0, 1, 2], filtered, distinctKeys, constrainedKeys);
  const bucketsB = buildBuckets([3, 4, 5], filtered, distinctKeys, constrainedKeys);

  function totalOf(k: StatKey, pct: number, flat: number): number {
    const b = baseRec[k] ?? 0;
    return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
  }

  // Borne optimiste (sûre) pour les MINIMUMS, à partir des bornes de deux
  // compartiments — même principe que dans l'ancien moteur slot-par-slot,
  // appliqué ici au niveau d'une paire de compartiments de 3 runes.
  function pairFeasibleMin(bA: { maxPct: Record<string, number>; maxFlat: Record<string, number> }, bB: typeof bA): boolean {
    for (const { k, min } of minEntries) {
      const optPct = (bA.maxPct[k] ?? 0) + (bB.maxPct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
      const optFlat = (bA.maxFlat[k] ?? 0) + (bB.maxFlat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
      if (totalOf(k, optPct, optFlat) < min) return false;
    }
    return true;
  }

  const candidates: BuildCandidate[] = [];
  let explored = 0;
  let truncated = false;

  outer: for (const bA of bucketsA) {
    for (const bB of bucketsB) {
      if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) continue;
      if (!pairFeasibleMin(bA, bB)) continue;

      for (const comboA of bA.combos) {
        // Repli rapide côté MINIMUM : même avec le meilleur de B, ce comboA
        // peut-il encore atteindre chaque minimum ? Évite d'ouvrir la boucle
        // B en entier pour un comboA déjà hors de portée.
        let comboAOk = true;
        for (const { k, min } of minEntries) {
          const p = (comboA.pct[k] ?? 0) + (bB.maxPct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
          const f = (comboA.flat[k] ?? 0) + (bB.maxFlat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
          if (totalOf(k, p, f) < min) {
            comboAOk = false;
            break;
          }
        }
        if (!comboAOk) continue;

        // Repli rapide côté MAXIMUM : un comboB ne peut qu'AJOUTER (jamais
        // retirer) — si comboA seul (avec le contexte fixe) dépasse déjà un
        // maximum, aucun comboB ne repassera sous la barre. Pas besoin d'une
        // borne de compartiment ici : c'est comboA lui-même qui suffit.
        for (const { k, max } of maxEntries) {
          const p = (comboA.pct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
          const f = (comboA.flat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
          if (totalOf(k, p, f) > max) {
            comboAOk = false;
            break;
          }
        }
        if (!comboAOk) continue;

        for (const comboB of bB.combos) {
          explored++;
          if (explored % CHECKPOINT_EVERY === 0) {
            yield { candidates, explored };
          }
          if (explored > maxNodes || overBudget()) {
            truncated = true;
            break outer;
          }

          const runes: RuneDetail[] = [...comboA.runes, ...comboB.runes];
          // ⚠️ Vérification AUTHENTIQUE sur les runes réelles — le groupage
          // par compte est un pré-filtre sûr mais optimiste (voir
          // `satisfiesSets`), jamais la décision finale.
          const active = activeSets(runes.map((r) => r.set));
          if (missingSets(requirement.sets, active).length > 0) continue;

          const gear: GearSet = { base, runes, artifacts, relic };
          const stats = computeStats(gear);
          let ok = true;
          for (const { k, min } of minEntries) {
            const row = stats.find((r) => r.key === k);
            if (!row || row.total < min) {
              ok = false;
              break;
            }
          }
          if (ok) {
            for (const { k, max } of maxEntries) {
              const row = stats.find((r) => r.key === k);
              if (row && row.total > max) {
                ok = false;
                break;
              }
            }
          }
          if (!ok) continue;

          const effTotal = runes.reduce((sum, r) => sum + valueOf(r, metric), 0);
          candidates.push({ runeIds: runes.map((r) => r.id), stats, effTotal });
          if (candidates.length >= maxCollected) {
            truncated = true;
            break outer;
          }
        }
      }
    }
  }

  return { candidates, explored, truncated };
}

// API historique : drainer le générateur jusqu'au bout en un seul appel
// synchrone. C'est ce que testent tests/rune-optim.test.ts,
// tests/rune-optim-differential.test.ts et scripts/benchmark-optim.ts — le
// comportement est identique à avant la restructuration en générateur, seuls
// les points de passage internes ont changé.
export function searchBuilds(params: SearchParams): SearchResult {
  const gen = searchBuildsSteps(params);
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

/* --------------------------------------------------------------------------
 * Exclusion des runes déjà portées par un AUTRE monstre — générique : ne
 * connaît que des ids de runes et une notion d'« à soi », pas la box en
 * particulier. Cette fonction précise (côté box) construit l'ensemble à
 * exclure ; le moteur ci-dessus ne prend que le `pool` déjà filtré.
 * ----------------------------------------------------------------------- */
export function excludedRuneIds(
  allGear: { unitKey: string; com2usId: number | null; gear?: GearSet }[],
  ownCom2usId: number | null
): Set<number> {
  const out = new Set<number>();
  for (const item of allGear) {
    if (ownCom2usId != null && item.com2usId === ownCom2usId) continue; // « à soi »
    for (const r of item.gear?.runes ?? []) out.add(r.id);
  }
  return out;
}
