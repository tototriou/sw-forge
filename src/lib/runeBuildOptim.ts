// Optimiseur de build : cherche, dans un pool de runes possédées, la (les)
// meilleure(s) combinaison(s) de 6 pour un monstre donné, sous contrainte
// d'un combo de sets et de minimums de stats.
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
// scindés en deux MOITIÉS de 3, chacune entièrement énumérée depuis le pool
// déjà pré-filtré par slot ; les moitiés sont regroupées par le compte EXACT
// de pièces de chaque set demandé qu'elles apportent (+ jokers Intangible) —
// deux moitiés dont les comptes s'additionnent pour satisfaire le combo
// peuvent être appariées SANS jamais énumérer le produit complet des runes
// individuelles. Voir spec/outils/optimizer.md pour le résumé fonctionnel, et
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

export interface BuildRequirement {
  // Multiset de clés RUNE_SETS, **au format `activeSets`** (une entrée par
  // activation : ['violent','will'] = Violent 4p + Will 2p ; ['fight','fight']
  // = 2× Fight). Coût en runes ≤ 6, garanti par l'UI (setsCost/canAddSet).
  sets: string[];
  // Minimums exigés sur le TOTAL final (comme RecoSlot.stats). Absent = non exigé.
  minStats: Partial<Record<StatKey, number>>;
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

function filterSlot(candidates: RuneDetail[], requirement: BuildRequirement): RuneDetail[] {
  const requiredKeys = new Set(requirement.sets);
  const scored = candidates
    .map((r) => ({ r, s: relevance(r, requirement) }))
    .sort((a, b) => b.s - a.s);

  const kept = new Map<number, RuneDetail>();

  const matches = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
  for (const { r } of matches.slice(0, MAX_PER_SLOT_MATCH)) kept.set(r.id, r);
  for (const { r } of scored.slice(0, MAX_PER_SLOT_FILL)) kept.set(r.id, r);

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
 * Meet-in-the-middle : moitiés de 3 slots
 * ----------------------------------------------------------------------- */

interface HalfCombo {
  runes: [RuneDetail, RuneDetail, RuneDetail];
  counts: number[]; // aligné sur `distinctKeys` : nb de pièces de chaque set demandé
  jokers: number; // nb de runes Intangible dans cette moitié
  pct: Record<string, number>; // contribution cumulée, par stat DEMANDÉE (minEntries) seulement
  flat: Record<string, number>;
  relevanceScore: number;
}

function enumerateHalf(
  slotIdxs: readonly [number, number, number],
  filtered: RuneDetail[][],
  distinctKeys: string[],
  minEntries: { k: StatKey; min: number }[]
): HalfCombo[] {
  const [i0, i1, i2] = slotIdxs;
  const out: HalfCombo[] = [];
  for (const r0 of filtered[i0]) {
    for (const r1 of filtered[i1]) {
      for (const r2 of filtered[i2]) {
        const runes: [RuneDetail, RuneDetail, RuneDetail] = [r0, r1, r2];
        const counts = distinctKeys.map((key) => runes.filter((r) => r.set === key).length);
        const jokers = runes.filter((r) => r.set === 'intangible').length;
        const pct: Record<string, number> = {};
        const flat: Record<string, number> = {};
        let score = (runeEfficiency(r0) + runeEfficiency(r1) + runeEfficiency(r2)) / 1000;
        for (const { k, min } of minEntries) {
          let p = 0;
          let f = 0;
          for (const r of runes) {
            const c = runeContribution(r, k);
            p += c.pct;
            f += c.flat;
          }
          pct[k] = p;
          flat[k] = f;
          score += (p + f) / min;
        }
        out.push({ runes, counts, jokers, pct, flat, relevanceScore: score });
      }
    }
  }
  return out;
}

interface Bucket {
  counts: number[];
  jokers: number;
  combos: HalfCombo[];
  maxPct: Record<string, number>; // borne SÛRE (jamais sous-estimée) par stat demandée
  maxFlat: Record<string, number>;
}

function bucketize(combos: HalfCombo[], minEntries: { k: StatKey; min: number }[]): Bucket[] {
  const key = (counts: number[], jokers: number) => `${counts.join(',')}|${jokers}`;
  const map = new Map<string, Bucket>();
  for (const c of combos) {
    const k = key(c.counts, c.jokers);
    let b = map.get(k);
    if (!b) {
      b = { counts: c.counts, jokers: c.jokers, combos: [], maxPct: {}, maxFlat: {} };
      map.set(k, b);
    }
    b.combos.push(c);
  }
  for (const b of map.values()) {
    // Trié par pertinence décroissante : les combinaisons finales prometteuses
    // sont évaluées en premier, utile si le budget de paires est atteint.
    b.combos.sort((x, y) => y.relevanceScore - x.relevanceScore);
    for (const { k } of minEntries) {
      let mp = 0;
      let mf = 0;
      for (const c of b.combos) {
        if (c.pct[k] > mp) mp = c.pct[k];
        if (c.flat[k] > mf) mf = c.flat[k];
      }
      b.maxPct[k] = mp;
      b.maxFlat[k] = mf;
    }
  }
  return Array.from(map.values());
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
export function searchBuilds(params: SearchParams): SearchResult {
  const { base, artifacts, relic, pool, requirement, metric } = params;
  const maxNodes = params.maxNodes ?? DEFAULT_MAX_NODES;
  const maxCollected = params.maxCollected ?? MAX_COLLECTED;

  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of pool) {
    if (r.slot >= 1 && r.slot <= 6) bySlot[r.slot - 1].push(r);
  }
  const filtered = bySlot.map((list) => filterSlot(list, requirement));
  if (filtered.some((list) => list.length === 0)) {
    return { candidates: [], explored: 0, truncated: false };
  }

  const minEntries = ALL_STAT_KEYS
    .map((k) => ({ k, min: requirement.minStats[k] }))
    .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);

  const distinctKeys = Array.from(new Set(requirement.sets));

  const guaranteed = guaranteedSetBonus(requirement, base);
  const artFlat = artifactFlatBonus(artifacts);
  const relPct = relicPctBonus(relic);
  const baseRec = base as unknown as Record<string, number>;

  const halfA = enumerateHalf([0, 1, 2], filtered, distinctKeys, minEntries);
  const halfB = enumerateHalf([3, 4, 5], filtered, distinctKeys, minEntries);
  const bucketsA = bucketize(halfA, minEntries);
  const bucketsB = bucketize(halfB, minEntries);

  // Borne optimiste (sûre) pour les minimums, à partir des bornes de deux
  // compartiments — même principe que dans l'ancien moteur slot-par-slot,
  // appliqué ici au niveau d'une paire de compartiments de 3 runes.
  function pairFeasible(bA: { maxPct: Record<string, number>; maxFlat: Record<string, number> }, bB: typeof bA): boolean {
    for (const { k, min } of minEntries) {
      const optPct = (bA.maxPct[k] ?? 0) + (bB.maxPct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
      const optFlat = (bA.maxFlat[k] ?? 0) + (bB.maxFlat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
      const b = baseRec[k] ?? 0;
      const total = k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * optPct) / 100) + optFlat : b + optFlat;
      if (total < min) return false;
    }
    return true;
  }

  const candidates: BuildCandidate[] = [];
  let explored = 0;
  let truncated = false;

  outer: for (const bA of bucketsA) {
    for (const bB of bucketsB) {
      if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) continue;
      if (!pairFeasible(bA, bB)) continue;

      for (const comboA of bA.combos) {
        // Repli rapide : même avec le meilleur de B, ce comboA peut-il
        // encore atteindre chaque minimum ? Évite d'ouvrir la boucle B en
        // entier pour un comboA déjà hors de portée.
        let comboAOk = true;
        for (const { k, min } of minEntries) {
          const p = (comboA.pct[k] ?? 0) + (bB.maxPct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
          const f = (comboA.flat[k] ?? 0) + (bB.maxFlat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
          const b = baseRec[k] ?? 0;
          const total = k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * p) / 100) + f : b + f;
          if (total < min) {
            comboAOk = false;
            break;
          }
        }
        if (!comboAOk) continue;

        for (const comboB of bB.combos) {
          explored++;
          if (explored > maxNodes) {
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
