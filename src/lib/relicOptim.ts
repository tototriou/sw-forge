// Choix de la MEILLEURE RELIQUE pour un build donné, et ce qui la précède :
// bornes optimistes par statistique, pertinence et dominance structurelle.
//
// ⚠️ **Frontière volontaire** (implementation-relique, B.3) : ce module ne
// connaît ni `computeStats` ni `pvEffectifs` ni rien de `damage.ts`/`stats.ts`
// — l'appelant (B.5a/B.5b) fournit un `evaluate` qui sait calculer les stats
// du build AVEC une relique candidate. Même séparation que
// `artifactOptim.ts` vis-à-vis du moteur de runes.
//
// ⚠️ **La principale d'une relique est un POURCENTAGE**, pas un plat comme un
// artéfact : `stat = B + ceil(B × (R + L) / 100) + plats`
// (spec/outils/optimizer/chantiers/implementation-relique.md § A.1). Elle
// change donc la FAISABILITÉ des minimums, pas seulement le classement — d'où
// les bornes par statistique ci-dessous, qui jouent le même rôle que
// `artFlatMax`/`artFlatMin` pour les artéfacts (../invariants.md § Artéfacts).
//
// ⚠️ **Dominance STRUCTURELLE seulement** (D6) : sans formule chiffrée pour
// les exclusives (D9, jusqu'au lot 7), on ne peut comparer deux reliques que
// sur des cas où l'ordre est évident — jamais par un score inventé.

import { RelicDetail, RelicUnique } from '../types';
import { RELIC_UNIQUE, StatKey } from './effects';
// ⚠️ `import type` UNIQUEMENT : `useOptimizerState.ts` importe `damage.ts`
// (DamageSetup) — un import de valeur ferait entrer cette dépendance dans le
// bundle de ce module. Effacé à la compilation, celui-ci ne tire donc RIEN
// de `useOptimizerState.ts` au runtime (frontière du module, B.3).
import type { RelicMainChoice, RelicUniqueChoice, RelicIntent } from '../hooks/useOptimizerState';
import type { Objective } from './runeBuildOptim';

// Les trois statistiques qu'une relique peut porter en principale — jamais la
// VIT, jamais une stat dérivée (`RELIC_MAIN`, effects.ts : codes 100/101/102).
export type RelicStat = 'hp' | 'atk' | 'def';

const RELIC_MAIN_STAT: Record<number, RelicStat> = { 100: 'hp', 101: 'atk', 102: 'def' };

function statDuCode(code: number): RelicStat | undefined {
  return RELIC_MAIN_STAT[code];
}

function statDePrincipale(choix: RelicMainChoice): RelicStat | undefined {
  return typeof choix === 'number' ? RELIC_MAIN_STAT[choix] : undefined;
}

/* --------------------------------------------------------------------------
 * Le SENS de chaque exclusive — DÉRIVÉ de RELIC_UNIQUE, jamais recopié
 * ----------------------------------------------------------------------- */

// ⚠️ **Pourquoi une dérivation et pas une table écrite à la main** :
// `RELIC_UNIQUE` (effects.ts) donne pour chaque type son groupe curé et sa
// stat de RÉFÉRENCE (`stat.court`, le « X » — « tous les X pts de VIT »).
// Le groupe porte le sens mécanique ; il est relu sur le gabarit que la ligne
// utilise déjà, jamais déduit du texte (`game-data-curation`).
export type RelicNature =
  | { sorte: 'degatsInfliges' } // Conquête (1,2,3)
  | { sorte: 'degatsReduits' } // Ténacité (4,5,6)
  | { sorte: 'soins' } // Régénération (16) — jamais pertinente, reliques.md § 5.1
  | { sorte: 'buffStat'; stat: RelicStat }; // Bravoure→atk (7,8,9) · Éternité→def (10,11,12) · Origine→hp (13,14,15)

const CACHE_NATURE = new Map<number, RelicNature | undefined>();

export function relicUniqueNature(type: number): RelicNature | undefined {
  if (CACHE_NATURE.has(type)) return CACHE_NATURE.get(type);
  const def = RELIC_UNIQUE[type];
  let nature: RelicNature | undefined;
  if (def) {
    switch (def.groupe) {
      case 'conquete': nature = { sorte: 'degatsInfliges' }; break;
      case 'tenacite': nature = { sorte: 'degatsReduits' }; break;
      case 'regeneration': nature = { sorte: 'soins' }; break;
      case 'bravoure': nature = { sorte: 'buffStat', stat: 'atk' }; break;
      case 'eternite': nature = { sorte: 'buffStat', stat: 'def' }; break;
      case 'origine': nature = { sorte: 'buffStat', stat: 'hp' }; break;
    }
  }
  CACHE_NATURE.set(type, nature);
  return nature;
}

/* --------------------------------------------------------------------------
 * Bornes optimistes par statistique — D5, garantie C
 * ----------------------------------------------------------------------- */

export function relicMainPercent(r: RelicDetail): number {
  return r.main.value;
}

// La meilleure principale de chaque statistique parmi les éligibles —
// INDÉPENDANTES (elle accorde les trois meilleures à la fois : la borne est
// permissive, jamais un faux négatif au test de faisabilité). `[]` → zéro
// partout (garantie C).
export function relicPctMaxByStat(eligibles: RelicDetail[]): Record<RelicStat, number> {
  const max: Record<RelicStat, number> = { hp: 0, atk: 0, def: 0 };
  for (const r of eligibles) {
    const stat = statDuCode(r.main.code);
    if (stat && r.main.value > max[stat]) max[stat] = r.main.value;
  }
  return max;
}

// Le `Lmin` de D5 (rév. 7, CORR-2) : la PLUS PETITE principale éligible sur
// la statistique FORCÉE, 0 sur les deux autres et si aucune principale n'est
// forcée sur une statistique précise (`'libre'`/`'equipped'`) — c'est
// l'appelant (lot 5a) qui en fait des points par `floor`, jamais ce module.
export function relicPctMinByStat(eligibles: RelicDetail[], principaleForcee: RelicMainChoice): Record<RelicStat, number> {
  const min: Record<RelicStat, number> = { hp: 0, atk: 0, def: 0 };
  const stat = statDePrincipale(principaleForcee);
  if (!stat) return min;
  const valeurs = eligibles.filter((r) => r.main.code === principaleForcee).map((r) => r.main.value);
  if (valeurs.length > 0) min[stat] = Math.min(...valeurs);
  return min;
}

/* --------------------------------------------------------------------------
 * Le pool éligible — D1 : principale ∈ champ 1 ET type ∈ champ 2, puis seuil
 * ----------------------------------------------------------------------- */

// Premier filtre qui a tout retiré (inventaire → principale → type → seuil),
// ou `'equipee'` en mode `equipped` sans relique portée (B.3, « le contrat »).
export type RelicVide = 'inventaire' | 'principale' | 'type' | 'seuil' | 'equipee';

// Mode recherche SEULEMENT — ne connaît pas la relique équipée (D1).
export function eligibleRelics(
  inventaire: RelicDetail[],
  principale: RelicMainChoice,
  type: RelicUniqueChoice,
  seuil: number
): { relics: RelicDetail[]; vide?: RelicVide } {
  if (inventaire.length === 0) return { relics: [], vide: 'inventaire' };

  let pool = inventaire;
  if (typeof principale === 'number') {
    pool = pool.filter((r) => r.main.code === principale);
    if (pool.length === 0) return { relics: [], vide: 'principale' };
  }
  if (typeof type === 'number') {
    pool = pool.filter((r) => r.unique?.type === type);
    if (pool.length === 0) return { relics: [], vide: 'type' };
  }
  pool = pool.filter((r) => r.upgrade >= seuil);
  if (pool.length === 0) return { relics: [], vide: 'seuil' };

  return { relics: pool };
}

/* --------------------------------------------------------------------------
 * Le contexte canonique — garantie G
 * ----------------------------------------------------------------------- */

export interface RelicBounds {
  max: Record<RelicStat, number>;
  min: Record<RelicStat, number>;
}

const BORNES_NULLES: RelicBounds = { max: { hp: 0, atk: 0, def: 0 }, min: { hp: 0, atk: 0, def: 0 } };

export interface RelicContext {
  mode: RelicIntent['mode'];
  principale: RelicMainChoice;
  type: RelicUniqueChoice;
  seuil: number;
  equipee?: RelicDetail;
  // Avant dominance (rév. 5, C3) : la dominance dépend du RÉGIME (objectif,
  // sort, minimums, maximums) que ce contexte ne connaît pas — chaque
  // consommateur l'applique avec le sien.
  eligibles: RelicDetail[];
  vide?: RelicVide;
  bornes: RelicBounds;
  empreinte: string;
}

// Hachage stable et SÉMANTIQUE (rév. 6, MAJ-4) : deux imports qui ne diffèrent
// que par l'ordre produisent la même empreinte ; un `rid` réimporté avec une
// autre valeur (upgrade, unique) la change — donc invalide tout cache basé
// dessus (B.5b).
function empreinteDe(eligibles: RelicDetail[], intention: RelicIntent): string {
  const trie = [...eligibles].sort((a, b) => a.id - b.id);
  const parts = trie.map((r) => {
    const u = r.unique;
    const uniqueTxt = u ? `${u.type}/${u.tranche}/${u.percent ?? ''}` : '';
    return `${r.id}:${r.main.code}:${r.main.value}:${r.upgrade}:${uniqueTxt}`;
  });
  return [intention.mode, ...parts, intention.principale, intention.type, intention.seuil].join('|');
}

function bornesDe(eligibles: RelicDetail[], principale: RelicMainChoice): RelicBounds {
  return { max: relicPctMaxByStat(eligibles), min: relicPctMinByStat(eligibles, principale) };
}

// LA fonction de la garantie G : résout l'intention (interrupteur, principale,
// type, seuil — livrée par B.2) contre le monstre et l'inventaire courants,
// UNE SEULE FOIS, en un contexte que moteur, oracle, file, CLI et écran
// consomment tous — jamais leur propre lecture des trois champs.
export function resoudreContexteRelique(
  intention: RelicIntent,
  reliqueEquipee: RelicDetail | undefined,
  inventaire: RelicDetail[]
): RelicContext {
  const commun = {
    mode: intention.mode,
    principale: intention.principale,
    type: intention.type,
    seuil: intention.seuil,
    equipee: reliqueEquipee,
  };

  if (intention.mode === 'off') {
    // L'équipée est appliquée UNE FOIS par le moteur (déjà `SearchParams.relic`,
    // garantie G) : ce contexte ne fait que le documenter, il n'y touche pas.
    return { ...commun, eligibles: [], bornes: BORNES_NULLES, empreinte: empreinteDe([], intention) };
  }

  if (intention.mode === 'equipped') {
    if (!reliqueEquipee) {
      return { ...commun, eligibles: [], vide: 'equipee', bornes: BORNES_NULLES, empreinte: empreinteDe([], intention) };
    }
    const eligibles = [reliqueEquipee];
    return {
      ...commun,
      eligibles,
      bornes: bornesDe(eligibles, intention.principale),
      empreinte: empreinteDe(eligibles, intention),
    };
  }

  // mode: 'recherche'
  const { relics, vide } = eligibleRelics(inventaire, intention.principale, intention.type, intention.seuil);
  if (vide) {
    return { ...commun, eligibles: [], vide, bornes: BORNES_NULLES, empreinte: empreinteDe([], intention) };
  }
  return {
    ...commun,
    eligibles: relics,
    bornes: bornesDe(relics, intention.principale),
    empreinte: empreinteDe(relics, intention),
  };
}

/* --------------------------------------------------------------------------
 * Pertinence et dimensions — D6, garantie A
 * ----------------------------------------------------------------------- */

const STATS: RelicStat[] = ['hp', 'atk', 'def'];

export interface RelicDimensions {
  // Statistiques dont la principale est retenue (objectif ∪ minimums actifs).
  principaleStats: Set<RelicStat>;
  // Statistiques sous un MAXIMUM actif : aucune dominance par la principale
  // dessus, dans aucun sens (rév. 5, B1 — un maximum casse la monotonie).
  maxActifs: Set<RelicStat>;
  // Types d'exclusive (1..16) dont le gain entre dans le régime courant.
  exclusiveTypesPertinents: Set<number>;
  // Vrai ssi au moins un type pertinent n'a pas de formule numérique — dans
  // ce lot, AUCUNE exclusive n'a de formule (D9), donc vrai ssi l'ensemble
  // ci-dessus est non vide.
  scorePartiel: boolean;
}

// Reçoit les minimums ET maximums ACTIFS (pas seulement l'objectif) : une
// statistique de principale sert aussi si un minimum de la recherche porte
// dessus, même hors de l'objectif choisi (D6 — contre-exemple : dégâts sur
// l'ATQ, minimum DEF actif, la DEF % peut rendre faisable un runage que
// l'ATQ % seule ne permet pas).
//
// `sort` : les statistiques de scaling du sort choisi (résolues par
// l'appelant — ce module n'ouvre jamais `damage.ts`), utilisées seulement en
// « Dégâts réels ».
//
// « Vitesse » et « Efficience » ne reçoivent AUCUN traitement spécial (T3,
// T7) : la règle générale produit d'elle-même « aucune dimension d'objectif,
// principales par les minimums actifs, aucune exclusive » pour les deux —
// elles tombent simplement dans le cas par défaut ci-dessous.
export function dimensionsRetenues(
  objectif: Objective,
  sort: RelicStat[],
  minimums: Partial<Record<StatKey, number>>,
  maximums?: Partial<Record<StatKey, number>>
): RelicDimensions {
  const statsMin = new Set<RelicStat>(STATS.filter((s) => (minimums[s] ?? 0) > 0));
  const maxActifs = new Set<RelicStat>(STATS.filter((s) => maximums?.[s] != null));

  let objectifStats: RelicStat[] = [];
  // Un type est retenu si son GAIN correspond à ce que l'objectif recherche —
  // jamais une table de codes figée : dérivé de `relicUniqueNature` (dessus),
  // elle-même dérivée d'`effects.ts`.
  let typePertinent: (type: number) => boolean = () => false;

  if (objectif === 'degats_reels') {
    // Le scaling du sort (dimension directe) + Conquête, TOUJOURS pertinente
    // (elle augmente les dégâts infligés quel que soit le scaling) + le
    // groupe dont le buff correspond au scaling (Bravoure→atk, Éternité→def,
    // Origine→hp) — reliques.md § 5.1.
    objectifStats = sort;
    typePertinent = (type) => {
      const nature = relicUniqueNature(type);
      if (!nature) return false;
      if (nature.sorte === 'degatsInfliges') return true;
      if (nature.sorte === 'buffStat') return new Set(sort).has(nature.stat);
      return false;
    };
  } else if (objectif === 'ehp') {
    // PV et DEF entrent toujours (elles nourrissent les PV effectifs) ; les
    // exclusives qui les augmentent, plus Ténacité (dégâts reçus réduits) —
    // reliques.md § 5.1.
    objectifStats = ['hp', 'def'];
    typePertinent = (type) => {
      const nature = relicUniqueNature(type);
      if (!nature) return false;
      if (nature.sorte === 'degatsReduits') return true;
      if (nature.sorte === 'buffStat') return nature.stat === 'hp' || nature.stat === 'def';
      return false;
    };
  }
  // 'efficience' et 'vitesse' : `objectifStats` reste `[]`, `typePertinent`
  // reste « toujours faux » — régime `aucun` (T3, T7).

  const principaleStats = new Set<RelicStat>([...objectifStats, ...statsMin]);
  const exclusiveTypesPertinents = new Set<number>();
  for (let type = 1; type <= 16; type++) if (typePertinent(type)) exclusiveTypesPertinents.add(type);

  return {
    principaleStats,
    maxActifs,
    exclusiveTypesPertinents,
    scorePartiel: exclusiveTypesPertinents.size > 0,
  };
}

/* --------------------------------------------------------------------------
 * Dominance structurelle — D6, garantie B
 * ----------------------------------------------------------------------- */

function typeConnu(u: RelicUnique | undefined): u is RelicUnique {
  return u != null && relicUniqueNature(u.type) != null;
}

// Compatibilité de l'axe exclusive entre `a` (candidate à dominer) et `b`
// (candidate dominée) : soit MÊME type avec `a` au moins aussi bonne
// (tranche ≤, pourcentage ≥ — les deux lus dans la pièce, jamais déduits de
// l'upgrade), soit les deux de type connu et `b` NON pertinente pour ce
// régime (auquel cas `a` peut être n'importe quoi de connu).
function exclusiveCompatible(a: RelicDetail, b: RelicDetail, dims: RelicDimensions): 'meme-type' | 'b-non-pertinente' | false {
  if (!typeConnu(a.unique) || !typeConnu(b.unique)) return false;
  const ua = a.unique;
  const ub = b.unique;
  if (ua.type === ub.type) {
    // Percent absent d'un côté ou de l'autre → pas de « même type » (rév. 6).
    if (ua.percent == null || ub.percent == null) return false;
    return ua.tranche <= ub.tranche && ua.percent >= ub.percent ? 'meme-type' : false;
  }
  return dims.exclusiveTypesPertinents.has(ub.type) ? false : 'b-non-pertinente';
}

// `a` domine `b` ssi : (1) même statistique de principale, `a ≥ b`, sans
// maximum actif dessus ; (2) exclusives compatibles (ci-dessus) ; (3)
// strictement meilleure sur au moins un des deux axes retenus (valeur de
// principale PERTINENTE, ou `a` pertinente contre `b` non pertinente sur
// l'exclusive). Un type inconnu d'un côté, ou deux exclusives pertinentes de
// types différents → toujours `false`.
export function relicDominates(a: RelicDetail, b: RelicDetail, dimensions: RelicDimensions): boolean {
  const statA = statDuCode(a.main.code);
  const statB = statDuCode(b.main.code);
  if (!statA || !statB || statA !== statB) return false;
  if (dimensions.maxActifs.has(statA)) return false;
  if (a.main.value < b.main.value) return false;

  const exclusif = exclusiveCompatible(a, b, dimensions);
  if (!exclusif) return false;

  const principalePertinente = dimensions.principaleStats.has(statA);
  const strictPrincipale = principalePertinente && a.main.value > b.main.value;
  const exclusivePertinente = dimensions.exclusiveTypesPertinents.has(a.unique!.type);
  const strictExclusive = exclusivePertinente && (
    exclusif === 'b-non-pertinente'
      || (exclusif === 'meme-type' && (a.unique!.tranche < b.unique!.tranche || a.unique!.percent! > b.unique!.percent!))
  );

  return strictPrincipale || strictExclusive;
}

/* --------------------------------------------------------------------------
 * Résolution — admissibilité exacte AVANT le score (rév. 6, BLOC-1)
 * ----------------------------------------------------------------------- */

export type RelicEvaluation = number | 'infaisable';

export interface MeilleureRelique {
  relique: RelicDetail;
  // Régime `aucun` (Efficience, Vitesse) : toute candidate faisable a le
  // même score, la relique choisie n'a pas d'effet sur le tri.
  sansEffetSurLeTri?: true;
}

// Énumère `candidates` et appelle `evaluate` pour chacune : la référence de
// contrôle EST cette énumération (algo-verify — pas de second algorithme à
// écrire, la preuve est la couverture des tests unitaires, exhaustive par
// construction sur un petit nombre de candidates).
//
// `regimeAucun` : Efficience et Vitesse (rév. 5, C6) — `evaluate` y rend un
// score constant pour toute candidate faisable ; le choix privilégie la
// relique déjà équipée si elle est candidate et faisable pour CE build,
// sinon la première faisable par `id` croissant.
export function bestRelicForBuild(
  candidates: RelicDetail[],
  evaluate: (relique: RelicDetail) => RelicEvaluation,
  options?: { regimeAucun?: boolean; equipee?: RelicDetail }
): MeilleureRelique | undefined {
  const faisables: [RelicDetail, number][] = [];
  for (const r of candidates) {
    const score = evaluate(r);
    if (score !== 'infaisable') faisables.push([r, score]);
  }
  if (faisables.length === 0) return undefined;

  if (options?.regimeAucun) {
    const equipeeId = options.equipee?.id;
    const equipeeFaisable = equipeeId != null ? faisables.find(([r]) => r.id === equipeeId) : undefined;
    const chosen = equipeeFaisable ? equipeeFaisable[0] : [...faisables].sort((x, y) => x[0].id - y[0].id)[0]![0];
    return { relique: chosen, sansEffetSurLeTri: true };
  }

  const maxScore = Math.max(...faisables.map(([, s]) => s));
  // Ex æquo → première par `id` croissant, ÉCRIT (trié), jamais l'ordre
  // d'itération de `candidates`.
  const meilleure = faisables
    .filter(([, s]) => s === maxScore)
    .sort((x, y) => x[0].id - y[0].id)[0]![0];
  return { relique: meilleure };
}
