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
  // ⚠️ Somme des 6 valeurs individuelles, dans la mesure ACTIVE AU MOMENT DE
  // LA RECHERCHE (`SearchParams.metric`), figée dans le candidat. Le réglage
  // global Efficience/Score (menu ⚙) peut changer APRÈS coup sans relancer
  // de recherche — ce champ ne le sait pas et devient alors incohérent avec
  // le popover d'une rune individuelle (qui, lui, se recalcule en direct).
  // ⚠️ Ne JAMAIS afficher ce champ tel quel dans l'UI : utiliser
  // `candidateMetricTotal(candidate, runeById, metric)` (recalculé à partir
  // des VRAIES runes, dans la mesure COURANTE) pour tout affichage ou tri
  // qui doit rester juste si l'utilisateur change de mesure sans relancer.
  effTotal: number;
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
  // Choix fait AVANT de lancer la recherche (voir OptimizerSection.tsx) :
  // oriente le PRÉ-FILTRAGE par slot vers les stats utiles à cet objectif,
  // en plus de servir de tri par défaut des résultats. Absent = aucun biais
  // (le pré-filtrage ne suit que minStats/maxStats/l'efficience générale).
  objective?: Objective;
}

export interface SearchResult {
  candidates: BuildCandidate[];
  explored: number;
  truncated: boolean;
}

// Objectifs : choisis AVANT de lancer la recherche (OptimizerSection.tsx),
// un grand bouton à choix unique — pour orienter le type de rune étudié dès
// le pré-filtrage, pas seulement trier les résultats après coup.
export type Objective = 'efficience' | 'degats' | 'ehp' | 'vitesse';

export const OBJECTIVE_LABELS: { key: Objective; label: string }[] = [
  { key: 'efficience', label: 'Efficience' },
  { key: 'degats', label: 'Dégâts' },
  { key: 'ehp', label: 'PV effectifs' },
  { key: 'vitesse', label: 'Vitesse' },
];

// Stats individuellement pertinentes pour chaque objectif — sert à élargir
// leur budget de rétention dans `filterSlot`, pour que le pré-filtrage ne
// laisse pas passer à côté des runes utiles à l'objectif choisi avant même
// que la recherche complète ne démarre. « Efficience » n'en a pas : c'est
// déjà la lentille par défaut du pré-filtrage (voir `relevance`), aucun
// biais de plus à lui donner.
const OBJECTIVE_RELEVANT_STATS: Record<Objective, StatKey[]> = {
  efficience: [],
  degats: ['atk', 'cr', 'cd'],
  ehp: ['hp', 'def'],
  vitesse: ['spd'],
};

export function statTotal(stats: StatRow[], key: StatKey): number {
  return stats.find((s) => s.key === key)?.total ?? 0;
}

// Score d'un candidat DÉJÀ CALCULÉ, selon l'objectif choisi. Prend le
// candidat entier (pas seulement ses stats) : « Efficience » lit `effTotal`
// (la mesure choisie globalement — voir compte/runes.md), pas une stat.
// ⚠️ La branche « efficience » hérite donc de la mesure FIGÉE au moment de la
// recherche (voir `BuildCandidate.effTotal`) — pour un tri ou un affichage
// qui doit rester juste si l'utilisateur change de mesure après coup SANS
// relancer, utiliser `candidateMetricTotal` à la place (voir plus bas),
// jamais cette fonction pour « efficience » spécifiquement.
//  - dégâts : espérance sur le taux de critique réellement atteint — ni
//    « toujours critique » ni « jamais », ce que le joueur observe en
//    moyenne sur beaucoup de coups.
//  - PV effectifs : réutilise le facteur de défense déjà documenté dans
//    spec/mecaniques.md (1000 / (1140 + 3,5 × DEF)), pas une formule maison.
export function objectiveScore(candidate: BuildCandidate, objective: Objective): number {
  if (objective === 'efficience') return candidate.effTotal;
  const { stats } = candidate;
  if (objective === 'vitesse') return statTotal(stats, 'spd');
  if (objective === 'degats') {
    const atk = statTotal(stats, 'atk');
    // ⚠️ Le Taux Crit est PLAFONNÉ à 100 % dans le jeu — passer 100 % ne
    // rapporte plus rien (la formule utiliserait sinon une chance de critique
    // > 100 %, gonflant les dégâts espérés d'un build dont le total brut
    // dépasse 100 % au-delà de ce qu'il apporte réellement en jeu). `computeStats`
    // n'écrête jamais rien lui-même (voir Conditions) : c'est ICI, au moment
    // de transformer une stat en dégâts, que le plafond compte.
    const cr = Math.min(statTotal(stats, 'cr'), 100);
    return atk * (1 + (cr / 100) * (statTotal(stats, 'cd') / 100));
  }
  const hp = statTotal(stats, 'hp');
  const def = statTotal(stats, 'def');
  return (hp * (1140 + 3.5 * def)) / 1000;
}

// Efficience/Score total d'un candidat, recalculé À LA DEMANDE à partir des
// VRAIES runes, dans la mesure COURANTE — contrairement à `BuildCandidate.
// effTotal`, figé dans la mesure active au moment de la recherche. À utiliser
// pour tout affichage ou tri qui doit rester cohérent avec le popover d'une
// rune individuelle (lui-même toujours recalculé en direct) même si
// l'utilisateur bascule Efficience ↔ Score (menu ⚙) après avoir lancé la
// recherche, sans la relancer.
export function candidateMetricTotal(
  candidate: BuildCandidate,
  runeById: Map<number, RuneDetail>,
  metric: OptimMetric
): number {
  let sum = 0;
  for (const id of candidate.runeIds) {
    const r = runeById.get(id);
    if (!r) continue;
    sum += metric === 'eff' ? runeEfficiency(r) : runeScore(r);
  }
  return sum;
}

// Exportés (au lieu de rester locaux) : le Worker en a besoin pour estimer
// une progression (`explored`/`maxNodes`, etc.) sans dupliquer ces valeurs.
export const DEFAULT_MAX_NODES = 400_000;
// ⚠️ Calibré par mesure, pas au jugé (scripts/benchmark-optim.ts, voir
// spec/outils/optimizer.md) : sur des pools synthétiques de 500 à 5000
// runes, la troncature au plafond de collecte est SYSTÉMATIQUE (le budget de
// paires n'est jamais le facteur limitant). Relevé de 2000 à 5000 après
// mesure — plainte directe : le message de troncature revenait trop souvent
// en usage réel — le pire cas mesuré (pool 5000, scénario le plus serré,
// AVEC ce plafond à 5000) reste sous ~2,9 s, largement dans le filet de 10
// min du Worker. Surchargeable via SearchParams.maxCollected.
export const MAX_COLLECTED = 5000;
// Filet de sécurité indépendant de maxNodes/maxCollected : sur les scénarios
// mesurés (500 à 5000 runes, scripts/benchmark-optim.ts), le pire cas était
// sous ~4 s — 15 s laisse une marge large avant de considérer qu'une
// recherche est anormalement lente, sans jamais bloquer l'interface
// puisqu'elle tourne dans un Worker. Surchargeable via SearchParams.maxMs.
export const DEFAULT_MAX_MS = 15_000;
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
// Budget élargi pour les stats de l'OBJECTIF choisi (voir OBJECTIVE_RELEVANT_
// STATS) : l'utilisateur a explicitement dit « je cherche des dégâts » (ou
// « des PV effectifs ») avant même de lancer la recherche — le pré-filtrage
// doit lui laisser une vraie chance d'en trouver, pas juste une place parmi
// six comme les autres stats.
const PER_STAT_KEEP_OBJECTIVE = 24;
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
  fillCap = MAX_PER_SLOT_FILL,
  objective?: Objective
): RuneDetail[] {
  const requiredKeys = new Set(requirement.sets);
  const scored = candidates
    .map((r) => ({ r, s: relevance(r, requirement) }))
    .sort((a, b) => b.s - a.s);

  const kept = new Map<number, RuneDetail>();

  const matches = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
  for (const { r } of matches.slice(0, matchCap)) kept.set(r.id, r);
  for (const { r } of scored.slice(0, fillCap)) kept.set(r.id, r);

  // ⚠️ Réserve GARANTIE de runes HORS du set demandé, symétrique de `matches`.
  // Sans elle : quand les meilleures runes toutes provenances du joueur sont
  // justement du set demandé (courant — c'est souvent LE set qu'il a
  // optimisé), `matches` ET `scored.slice(fillCap)` se recouvrent presque
  // entièrement, et aucune alternative d'un AUTRE set n'a jamais sa propre
  // place garantie — la recherche ne peut alors proposer que des builds
  // tout-un-set, même quand le combo demandé n'en réclame qu'une partie des
  // pièces (ex. un set 4 pièces sur 6 emplacements). Signalé sur un compte
  // réel (voir spec/outils/optimizer.md, « Limites connues »).
  const offSet = scored.filter(({ r }) => !requiredKeys.has(r.set) && r.set !== 'intangible');
  for (const { r } of offSet.slice(0, fillCap)) kept.set(r.id, r);

  // Le meilleur d'un slot sur chaque stat individuellement — voir
  // PER_STAT_KEEP. Budget élargi (PER_STAT_KEEP_OBJECTIVE) pour les stats de
  // l'objectif choisi, s'il y en a un.
  const objectiveKeys = objective ? OBJECTIVE_RELEVANT_STATS[objective] : [];
  for (const k of ALL_STAT_KEYS) {
    const keepN = objectiveKeys.includes(k) ? PER_STAT_KEEP_OBJECTIVE : PER_STAT_KEEP;
    const top = candidates
      .map((r) => {
        const c = runeContribution(r, k);
        return { r, v: c.pct + c.flat };
      })
      .sort((a, b) => b.v - a.v)
      .slice(0, keepN);
    for (const { r } of top) kept.set(r.id, r);
  }

  return Array.from(kept.values());
}

/* --------------------------------------------------------------------------
 * Élagage SÛR n°1 — DOMINANCE. Une rune strictement moins bonne qu'une autre
 * du même slot ne sert jamais à rien : si B égale ou dépasse A sur pct ET
 * flat de CHAQUE stat, avec un avantage strict quelque part (ou une valeur
 * identique en tout point, départagée par l'id pour ne garder qu'un seul
 * exemplaire), alors tout build valide utilisant A resterait valide — et au
 * moins aussi bon — en remplaçant A par B. C'est vrai pour n'importe quel
 * critère de tri après coup, puisqu'aucune stat ne recule.
 * ----------------------------------------------------------------------- */

// ⚠️ Comparer deux runes de sets DIFFÉRENTS n'est sûr que si leur set est
// ÉQUIVALENT du point de vue de la satisfaction du combo demandé — sinon une
// rune moins bonne en stats brutes mais seule à apporter une pièce de set
// manquante serait écartée à tort. Deux cas sûrs : même set (interchangeables
// pièce pour pièce, y compris deux jokers) ; ou aucun des deux sets ne compte
// pour le combo demandé (ni l'un ni l'autre n'apporte de pièce, donc le set
// n'entre pas en ligne de compte).
function isSetIrrelevant(setKey: string, requiredKeys: Set<string>): boolean {
  return setKey !== 'intangible' && !requiredKeys.has(setKey);
}
function isSetComparable(a: RuneDetail, b: RuneDetail, requiredKeys: Set<string>): boolean {
  if (a.set === b.set) return true;
  return isSetIrrelevant(a.set, requiredKeys) && isSetIrrelevant(b.set, requiredKeys);
}

// ⚠️ **Un maximum INVERSE le sens de « mieux ».** Sur une stat SANS plafond,
// plus est toujours sans risque : B qui égale ou dépasse A partout domine A.
// Mais sur une stat PLAFONNÉE (`maxKeys`), plus peut faire DÉPASSER le
// maximum — une rune qui en apporte davantage n'est pas « au moins aussi
// bonne », elle est plus dangereuse. Sur ces stats-là, seule l'ÉGALITÉ
// stricte (ni plus, ni moins) reste sûre à comparer : on ne sait pas, sans
// connaître le reste du build, si « plus » ou « moins » serait le bon choix.
function isDominated(a: RuneDetail, b: RuneDetail, requiredKeys: Set<string>, maxKeys: Set<StatKey>): boolean {
  if (a.id === b.id || !isSetComparable(a, b, requiredKeys)) return false;
  let strictlyBetter = false;
  for (const k of ALL_STAT_KEYS) {
    const ca = runeContribution(a, k);
    const cb = runeContribution(b, k);
    if (maxKeys.has(k)) {
      // Stat plafonnée : seule l'égalité est sûre dans les deux sens.
      if (cb.pct !== ca.pct || cb.flat !== ca.flat) return false;
    } else {
      // pct et flat comparés SÉPARÉMENT : additionner les deux avant de
      // comparer mélangerait deux échelles différentes (un pct s'applique à
      // la base, un flat s'ajoute tel quel) — voir `totalOf`.
      if (cb.pct < ca.pct || cb.flat < ca.flat) return false;
      if (cb.pct > ca.pct || cb.flat > ca.flat) strictlyBetter = true;
    }
  }
  const effA = runeEfficiency(a);
  const effB = runeEfficiency(b);
  if (effB < effA) return false;
  if (effB > effA) strictlyBetter = true;
  // Égalité totale (clone exact niveau stats) : un seul exemplaire retenu,
  // celui du plus petit id — repère arbitraire mais déterministe, sinon A et
  // B se domineraient mutuellement et disparaîtraient tous les deux.
  return strictlyBetter || b.id < a.id;
}

// Garde-fou de performance : la comparaison est O(n²) — négligeable sur les
// tailles réelles d'un slot (quelques centaines à ~1000 runes, voir
// spec/outils/optimizer.md), mais sans borne un pool démesuré (« Explorer
// tout l'inventaire » sur un très gros compte) pourrait coûter cher pour un
// gain marginal. Au-delà, on renonce à cet élagage plutôt que de ralentir.
const DOMINANCE_MAX_POOL = 2000;

function pruneDominated(list: RuneDetail[], requiredKeys: Set<string>, maxKeys: Set<StatKey>): RuneDetail[] {
  if (list.length > DOMINANCE_MAX_POOL) return list;
  return list.filter((a) => !list.some((b) => isDominated(a, b, requiredKeys, maxKeys)));
}

/* --------------------------------------------------------------------------
 * Élagage SÛR n°2 — FAISABILITÉ. Une rune ne peut jamais entrer dans un
 * build valide si, même dans le MEILLEUR des cas pour les 5 autres
 * emplacements (le meilleur trouvé dans le pool RÉELLEMENT possédé de chaque
 * autre emplacement, pas une borne théorique du jeu), un minimum demandé
 * reste hors de portée — ou si elle dépasse déjà, À ELLE SEULE, un maximum
 * demandé (les autres emplacements ne peuvent qu'AJOUTER, jamais retirer).
 * Symétrique de l'élagage déjà appliqué au niveau des PAIRES de compartiments
 * (`pairFeasibleMin` / le repli MAXIMUM dans `searchBuildsSteps`), mais bien
 * plus tôt : par rune, avant même le pré-filtrage heuristique — l'exemple
 * qui a motivé cet ajout : une rune dont le VIT ne peut mathématiquement pas,
 * même complétée par les 5 meilleures runes VIT du reste du compte, atteindre
 * le minimum de vitesse demandé.
 * ----------------------------------------------------------------------- */
function computeSlotMaxBounds(
  bySlot: RuneDetail[][],
  keys: StatKey[]
): Record<string, { pct: number; flat: number }>[] {
  return bySlot.map((list) => {
    const out: Record<string, { pct: number; flat: number }> = {};
    for (const k of keys) {
      let pct = 0;
      let flat = 0;
      for (const r of list) {
        const c = runeContribution(r, k);
        if (c.pct > pct) pct = c.pct;
        if (c.flat > flat) flat = c.flat;
      }
      out[k] = { pct, flat };
    }
    return out;
  });
}

function eliminateInfeasible(
  bySlot: RuneDetail[][],
  minEntries: { k: StatKey; min: number }[],
  maxEntries: { k: StatKey; max: number }[],
  constrainedKeys: StatKey[],
  guaranteed: { pct: Record<string, number>; flat: Record<string, number> },
  artFlat: Record<string, number>,
  relPct: Record<string, number>,
  totalOf: (k: StatKey, pct: number, flat: number) => number
): RuneDetail[][] {
  if (minEntries.length === 0 && maxEntries.length === 0) return bySlot;

  // Borne SÛRE par slot : le meilleur trouvé dans le pool réellement possédé
  // de CE slot, jamais une borne théorique du jeu — plus étroite, donc plus
  // efficace, et tout aussi sûre : aucun rune de ce slot ne dépasse jamais ce
  // maximum, par construction (c'est le max OBSERVÉ, pas estimé).
  const slotMax = computeSlotMaxBounds(bySlot, constrainedKeys);
  const totalMaxPct: Record<string, number> = {};
  const totalMaxFlat: Record<string, number> = {};
  for (const k of constrainedKeys) {
    totalMaxPct[k] = slotMax.reduce((s, b) => s + (b[k]?.pct ?? 0), 0);
    totalMaxFlat[k] = slotMax.reduce((s, b) => s + (b[k]?.flat ?? 0), 0);
  }

  return bySlot.map((list, i) =>
    list.filter((r) => {
      for (const { k, min } of minEntries) {
        const c = runeContribution(r, k);
        // Les 5 AUTRES emplacements à leur propre maximum observé — celui de
        // CE slot est exclu du total (r le remplace).
        const otherPct = totalMaxPct[k] - (slotMax[i][k]?.pct ?? 0);
        const otherFlat = totalMaxFlat[k] - (slotMax[i][k]?.flat ?? 0);
        const bestPct = c.pct + otherPct + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
        const bestFlat = c.flat + otherFlat + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
        if (totalOf(k, bestPct, bestFlat) < min) return false;
      }
      for (const { k, max } of maxEntries) {
        const c = runeContribution(r, k);
        // Pire cas pour un MAXIMUM : les autres emplacements à zéro (toujours
        // atteignable — rien n'oblige un slot à contribuer à cette stat).
        const worstPct = c.pct + (guaranteed.pct[k] ?? 0) + (relPct[k] ?? 0);
        const worstFlat = c.flat + (guaranteed.flat[k] ?? 0) + (artFlat[k] ?? 0);
        if (totalOf(k, worstPct, worstFlat) > max) return false;
      }
      return true;
    })
  );
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

// Pool par slot, après la SEULE contrainte de statistique principale — pas
// encore le pré-filtrage heuristique. Factorisé pour être réutilisé tel quel
// par `searchBuildsSteps` (qui y ajoute ensuite dominance + faisabilité,
// voir plus bas) et par `estimateSearchSpace`.
function mainStatFilteredBySlot(pool: RuneDetail[], requirement: BuildRequirement): RuneDetail[][] {
  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of pool) {
    if (r.slot < 1 || r.slot > 6) continue;
    const allowed = requirement.mainStats?.[r.slot as 2 | 4 | 6];
    if (allowed && allowed.length > 0 && !allowed.includes(r.main.code)) continue;
    bySlot[r.slot - 1].push(r);
  }
  return bySlot;
}

// Pool par slot, après la contrainte de statistique principale PUIS le
// pré-filtrage par pertinence — factorisé pour être réutilisé tel quel par
// `estimateSearchSpace` (l'indication du nombre de builds affichée AVANT de
// lancer la recherche, voir OptimizerSection.tsx). ⚠️ `searchBuildsSteps`
// n'appelle PLUS cette fonction : elle intercale dominance + faisabilité
// entre les deux étapes (voir plus bas) — l'estimation, elle, reste au niveau
// heuristique seul, un ordre de grandeur légèrement PLUS LARGE que ce que la
// recherche explore réellement, jamais trompeur dans le sens dangereux.
function buildFilteredBySlot(
  pool: RuneDetail[],
  requirement: BuildRequirement,
  slotCap: number,
  objective?: Objective
): RuneDetail[][] {
  const bySlot = mainStatFilteredBySlot(pool, requirement);
  return bySlot.map((list) => filterSlot(list, requirement, slotCap, slotCap, objective));
}

// Estimation, AVANT de lancer la recherche, du nombre de combinaisons brutes
// que le pré-filtrage laisse en jeu — un ordre de grandeur, pas le nombre
// réellement exploré (le meet-in-the-middle n'énumère jamais ce produit en
// entier, voir l'en-tête du fichier), mais un repère utile pour savoir si les
// critères actuels sont trop larges ou trop stricts avant d'attendre un
// résultat.
export function estimateSearchSpace(
  pool: RuneDetail[],
  requirement: BuildRequirement,
  slotCap: number,
  objective?: Objective
): { perSlot: number[]; product: number } {
  const filtered = buildFilteredBySlot(pool, requirement, slotCap, objective);
  const perSlot = filtered.map((l) => l.length);
  const product = perSlot.reduce((a, b) => a * b, 1);
  return { perSlot, product };
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

  const minEntries = ALL_STAT_KEYS
    .map((k) => ({ k, min: requirement.minStats[k] }))
    .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);
  const maxEntries = ALL_STAT_KEYS
    .map((k) => ({ k, max: requirement.maxStats?.[k] }))
    .filter((e): e is { k: StatKey; max: number } => e.max != null && e.max > 0);
  const constrainedKeys = Array.from(new Set([...minEntries.map((e) => e.k), ...maxEntries.map((e) => e.k)]));

  const distinctKeys = Array.from(new Set(requirement.sets));
  const requiredKeys = new Set(requirement.sets);

  const guaranteed = guaranteedSetBonus(requirement, base);
  const artFlat = artifactFlatBonus(artifacts);
  const relPct = relicPctBonus(relic);
  const baseRec = base as unknown as Record<string, number>;

  function totalOf(k: StatKey, pct: number, flat: number): number {
    const b = baseRec[k] ?? 0;
    return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
  }

  // ⚠️ Contrainte de statistique principale (slots 2/4/6 seulement), PUIS
  // deux élagages SÛRS (jamais un faux rejet — voir leurs en-têtes plus haut
  // dans le fichier) avant même le pré-filtrage heuristique : dominance
  // (une rune strictement moins bonne qu'une autre du même slot ne sert
  // jamais à rien) puis faisabilité (une rune dont même le meilleur des 5
  // autres emplacements, pris dans le pool réellement possédé, ne suffirait
  // pas à atteindre un minimum demandé — ou qui dépasse déjà seule un
  // maximum — ne peut jamais entrer dans un build valide). Enfin le
  // pré-filtrage heuristique par pertinence, orienté par l'objectif choisi
  // le cas échéant. Cet ordre réduit le pool réel dès le départ, ce qui
  // atténue aussi le coût mémoire/temps de tout ce qui suit — voir
  // spec/outils/optimizer.md.
  const maxKeys = new Set(maxEntries.map((e) => e.k));
  let bySlot = mainStatFilteredBySlot(pool, requirement);
  bySlot = bySlot.map((list) => pruneDominated(list, requiredKeys, maxKeys));
  bySlot = eliminateInfeasible(bySlot, minEntries, maxEntries, constrainedKeys, guaranteed, artFlat, relPct, totalOf);
  const filtered = bySlot.map((list) => filterSlot(list, requirement, slotCap, slotCap, params.objective));
  if (filtered.some((list) => list.length === 0)) {
    return { candidates: [], explored: 0, truncated: false };
  }
  const overBudget = () => Date.now() - startedAt > maxMs;

  const bucketsA = buildBuckets([0, 1, 2], filtered, distinctKeys, constrainedKeys);
  const bucketsB = buildBuckets([3, 4, 5], filtered, distinctKeys, constrainedKeys);

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
