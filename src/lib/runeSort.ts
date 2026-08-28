// Tri de l'inventaire de runes — calcul pur, testable sans rendu.
//
// ⚠️ Les entrées sont celles du JEU, dans SON ordre et avec SES libellés (voir
// la liste déroulante de l'inventaire de runes). Un joueur qui trie ses runes
// cherche l'entrée qu'il connaît, pas une reformulation : c'est la règle de
// vocabulaire du projet (voir spec/README.md).
//
// Deux entrées ferment la liste et n'existent que chez nous : « Efficience »
// (notre mesure) et « Slot », qui sert au repérage.

import { RuneDetail } from '../types';
import { SensTri, signeTri } from './tri';

export type RuneSortMode =
  | 'grade'
  | 'sub_desc'
  | 'sub_brut_desc'
  | 'level_desc'
  | 'obtenu'
  | 'subs_total'
  | 'score'
  | 'eff'
  | 'slot_asc';

export const RUNE_SORTS: { key: RuneSortMode; label: string; hint: string }[] = [
  { key: 'grade', label: 'Grade', hint: 'Rareté, puis étoiles' },
  {
    key: 'sub_desc',
    label: 'Propriété secondaire',
    hint: 'La valeur de la 1ʳᵉ propriété cherchée, meule comprise',
  },
  {
    key: 'sub_brut_desc',
    label: 'Sous-propriété avant meule',
    hint: 'La même, meule DÉDUITE : ce que la rune vaut d’origine',
  },
  { key: 'level_desc', label: 'Nv. d’amélioration', hint: 'Le +X' },
  { key: 'obtenu', label: 'Obtenu', hint: 'Les plus récemment obtenues d’abord' },
  {
    key: 'subs_total',
    label: 'Total des sous-prop.',
    hint: 'Somme des quatre propriétés secondaires, meules comprises',
  },
  { key: 'score', label: 'Score', hint: 'Le score du jeu' },
  { key: 'eff', label: 'Efficience', hint: 'Notre mesure (%)' },
  { key: 'slot_asc', label: 'Slot', hint: 'Du 1 au 6' },
];

export const estTriConnu = (k: string): k is RuneSortMode =>
  RUNE_SORTS.some((s) => s.key === k);

// Valeur d'une propriété sur une rune, `null` si elle ne la porte pas.
//
// `brut` = meule DÉDUITE (`grind`) : ce que la ligne valait à l'origine. C'est
// la distinction que fait le jeu entre « Propriété secondaire » et
// « Sous-propriété avant meule » — deux runes à 20 % ne se valent pas si l'une
// y est arrivée seule et l'autre à coups de meules.
export function valeurSub(rune: RuneDetail, code: number, brut = false): number | null {
  const l = rune.subs.find((s) => s.code === code);
  if (!l) return null;
  return brut ? l.value - (l.grind ?? 0) : l.value;
}

// Somme des propriétés secondaires.
//
// ⚠️ Additionner des unités différentes (PV plats et %) n'a mathématiquement
// aucun sens — mais c'est ce que fait le jeu, et c'est ce total-là que le joueur
// reconnaît dans sa liste. On le reproduit tel quel plutôt que d'inventer une
// mesure « correcte » qu'il ne retrouverait nulle part.
export const totalSubs = (rune: RuneDetail) => rune.subs.reduce((n, s) => n + s.value, 0);

// Ce dont le tri a besoin d'une rune : elle-même et ses deux mesures, calculées
// une fois par l'appelant (elles le sont déjà pour l'affichage).
export interface RuneSortable {
  rune: RuneDetail;
  eff: number;
  score: number;
}

// Comparateur pour un mode donné.
//
// `metric` : la mesure courante, qui sert de départage partout.
// `premierCode` : la 1ʳᵉ propriété cherchée. Les deux tris « propriété
// secondaire » portent sur ELLE — sans critère posé ils n'ont rien à classer et
// retombent sur la mesure.
// `sens` : `asc` retourne le classement. ⚠️ **Il est passé ICI plutôt
// qu'appliqué de l'extérieur** (`-cmp(a, b)`) : une rune qui ne PORTE PAS la
// propriété triée doit rester en dernier **dans les deux sens** — « absent »
// n'est pas une petite valeur. Une négation globale l'aurait remontée en tête
// justement là où l'on cherche les plus faibles.
export function comparateurRunes(
  mode: RuneSortMode,
  metric: 'eff' | 'score',
  premierCode = 0,
  sens: SensTri = 'desc'
): (a: RuneSortable, b: RuneSortable) => number {
  const signe = signeTri(sens);
  const v = (r: RuneSortable) => (metric === 'eff' ? r.eff : r.score);

  // ⚠️ Une rune qui NE PORTE PAS la propriété passe derrière toutes celles qui
  // la portent, quelle que soit sa valeur — et non « à 0 », ce qui la mêlerait
  // aux plus faibles. Absent et nul ne sont pas la même chose.
  const parSub = (brut: boolean) => (a: RuneSortable, b: RuneSortable) => {
    if (!premierCode) return signe * (v(b) - v(a));
    const va = valeurSub(a.rune, premierCode, brut);
    const vb = valeurSub(b.rune, premierCode, brut);
    if (va == null && vb == null) return signe * (v(b) - v(a));
    // ⚠️ NON multiplié par `signe` : l'absence reste en queue dans les deux sens.
    if (va == null) return 1;
    if (vb == null) return -1;
    return signe * (vb - va || v(b) - v(a));
  };

  const table: Record<RuneSortMode, (a: RuneSortable, b: RuneSortable) => number> = {
    // Rareté d'abord, puis les étoiles : c'est l'ordre du « Grade » du jeu.
    grade: (a, b) => signe * (b.rune.rarity - a.rune.rarity || b.rune.rank - a.rune.rank || v(b) - v(a)),
    sub_desc: parSub(false),
    sub_brut_desc: parSub(true),
    level_desc: (a, b) => signe * (b.rune.level - a.rune.level || v(b) - v(a)),
    // ⚠️ « Obtenu » se lit sur le `rune_id` com2us, croissant avec le temps :
    // l'export ne porte AUCUNE date d'obtention. Les plus récentes d'abord,
    // comme dans le jeu — et les plus anciennes en `asc`.
    obtenu: (a, b) => signe * (b.rune.id - a.rune.id),
    subs_total: (a, b) => signe * (totalSubs(b.rune) - totalSubs(a.rune) || v(b) - v(a)),
    score: (a, b) => signe * (b.score - a.score),
    eff: (a, b) => signe * (b.eff - a.eff),
    // ⚠️ Le seul tri déjà CROISSANT du jeu : « asc » le renverse donc du 6 au 1.
    slot_asc: (a, b) => signe * (a.rune.slot - b.rune.slot || v(b) - v(a)),
  };
  return table[mode];
}
