// Builds les plus rapides du compte, par combinaison de sets — le bloc du
// Résumé des runes. Voir docs/02-app/compte/feat-runes/resume.md.
//
// Pour une combinaison (ex. Swift + Will), le build de 6 runes à la VIT la plus
// haute, puis le #2 SANS aucune rune du #1, le #3 sans celles du #1 et du #2,
// etc. ⚠️ L'exclusion vaut DANS une combinaison seulement : chaque combinaison
// repart de tout l'inventaire (une même rune Swift peut servir Swift + Will et
// Swift + Shield). C'est le choix validé, celui de SWGT.

import { RuneDetail, RUNE_SETS } from '../types';
import { FOUR_PIECE_SETS, INTANGIBLE_SET, activeSets, runeEfficiency } from './effects';
import { runeContribution } from './runeBuildOptim';
import { swiftFlat } from './speed';

// Un monstre FICTIF de base 100, sans totem ni lead : la convention de SWGT.
// La VIT affichée compare des RUNES, pas des monstres.
export const VIT_BASE_REFERENCE = 100;

// « Broken » : les deux runes restantes sont de n'importe quel set. Le terme
// de la communauté (et de SWGT), retenu tel quel.
export const BROKEN = 'broken';

export interface ComboVitesse {
  quatre: string; // set 4 pièces
  deux: string; // set 2 pièces, ou `BROKEN`
}

export const BUILDS_PAR_COMBO_DEFAUT = 5;
export const BUILDS_PAR_COMBO_MIN = 1;
export const BUILDS_PAR_COMBO_MAX = 10;

// L'ordre de SWGT : il est aussi l'ordre d'affichage.
export const COMBOS_PAR_DEFAUT: ComboVitesse[] = [
  { quatre: 'swift', deux: 'will' },
  { quatre: 'violent', deux: 'will' },
  { quatre: 'despair', deux: 'will' },
  { quatre: 'swift', deux: 'shield' },
  { quatre: 'swift', deux: BROKEN },
  { quatre: 'violent', deux: 'destroy' },
  { quatre: 'violent', deux: 'nemesis' },
  { quatre: 'violent', deux: BROKEN },
  { quatre: 'despair', deux: BROKEN },
];

// Les sets qu'on peut choisir de chaque côté. ⚠️ Intangible n'en est pas : c'est
// un joker, il complète un set mais ne se vise pas (même règle que
// SetComboPicker.tsx).
export const SETS_QUATRE = RUNE_SETS.filter((s) => FOUR_PIECE_SETS.has(s.key)).map((s) => s.key);
export const SETS_DEUX = RUNE_SETS.filter((s) => !FOUR_PIECE_SETS.has(s.key) && s.key !== INTANGIBLE_SET).map(
  (s) => s.key
);

export const cleCombo = (c: ComboVitesse) => `${c.quatre}+${c.deux}`;

// Combinaison valide : un set 4 pièces, puis un set 2 pièces ou Broken. Sert à
// relire le réglage, qui vient du stockage (donc de n'importe où).
export function comboValide(c: { quatre?: unknown; deux?: unknown } | null | undefined): c is ComboVitesse {
  if (!c || typeof c.quatre !== 'string' || typeof c.deux !== 'string') return false;
  return SETS_QUATRE.includes(c.quatre) && (c.deux === BROKEN || SETS_DEUX.includes(c.deux));
}

export interface BuildRapide {
  runes: RuneDetail[]; // les 6 runes, slot 1 → 6
  vitRunes: number; // VIT apportée par les runes (principale, innée, secondaires, meules et gemmes)
  bonus: number; // bonus de set (Swift : 25 % de la base)
  total: number; // VIT_BASE_REFERENCE + vitRunes + bonus
  effMoyenne: number; // efficience moyenne des 6 runes
}

export interface BuildsDuCombo {
  combo: ComboVitesse;
  builds: BuildRapide[];
}

// VIT d'une rune : la même source que l'Optimizer (`runeContribution`). La
// valeur d'une ligne contient déjà sa meule (voir feat-calcul-runes.md).
export const vitesseRune = (r: RuneDetail) => runeContribution(r, 'spd').flat;

interface Mesures {
  vit: number;
  eff: number;
}

// Ordre de deux runes du MÊME slot : VIT, puis efficience, puis le plus petit id.
function comparerRunes(a: RuneDetail, b: RuneDetail, m: Map<number, Mesures>): number {
  const ma = m.get(a.id)!;
  const mb = m.get(b.id)!;
  return mb.vit - ma.vit || mb.eff - ma.eff || a.id - b.id;
}

// Ordre de deux builds (runes rangées slot 1 → 6) : VIT des runes, puis
// efficience totale, puis les ids lus slot par slot.
//
// ⚠️ C'est LA définition de « meilleur ». Le calcul la respecte slot par slot :
// à rôles fixés, les slots sont indépendants (une rune n'a qu'un slot). Le max
// de la somme est donc la somme des max, et à VIT égale on prend la meilleure
// efficience, puis le plus petit id. La référence des tests utilise aussi
// cette fonction.
// ⚠️ Les sommes se font toujours dans l'ordre des slots, pour qu'une égalité
// d'efficience reste une égalité exacte en virgule flottante.
export function comparerBuilds(a: RuneDetail[], b: RuneDetail[], m: Map<number, Mesures>): number {
  let va = 0, vb = 0, ea = 0, eb = 0;
  for (let i = 0; i < 6; i++) {
    va += m.get(a[i].id)!.vit;
    vb += m.get(b[i].id)!.vit;
    ea += m.get(a[i].id)!.eff;
    eb += m.get(b[i].id)!.eff;
  }
  if (va !== vb) return vb - va;
  if (ea !== eb) return eb - ea;
  for (let i = 0; i < 6; i++) if (a[i].id !== b[i].id) return a[i].id - b[i].id;
  return 0;
}

export function mesurerRunes(runes: RuneDetail[]): Map<number, Mesures> {
  return new Map(runes.map((r) => [r.id, { vit: vitesseRune(r), eff: runeEfficiency(r) }]));
}

// Un rôle de slot : un set précis, ou LIBRE (n'importe quel set sauf Intangible).
const LIBRE = '*';

// Toutes les façons DISTINCTES de poser ce multiensemble de rôles sur 6 slots.
function permutations(roles: string[]): string[][] {
  const out: string[][] = [];
  const reste = [...roles].sort();
  const courant: string[] = [];
  const pris = reste.map(() => false);
  const rec = () => {
    if (courant.length === reste.length) {
      out.push([...courant]);
      return;
    }
    for (let i = 0; i < reste.length; i++) {
      if (pris[i] || (i > 0 && reste[i] === reste[i - 1] && !pris[i - 1])) continue;
      pris[i] = true;
      courant.push(reste[i]);
      rec();
      courant.pop();
      pris[i] = false;
    }
  };
  rec();
  return out;
}

// Les répartitions de rôles qui ACTIVENT la combinaison, et elles seules.
//
// ⚠️ Inventaire exact, Intangible compris (`activeSets`, effects.ts : un seul
// joker, et il ne complète rien si deux sets sont incomplets). Pour A (4 pièces)
// et J (Intangible) :
//   - A + B (2 pièces) : 4A+2B · 3A+J+2B · 4A+J+B. Aucune autre façon de poser
//     6 runes n'active les deux sets.
//   - A + Broken : 4A + 2 libres · 4A + 1 libre + J · 3A + J + 2S, S un set 2
//     pièces. Avec 3A+J, les deux runes restantes ne doivent laisser aucun
//     autre set incomplet. Deux runes S le complètent ; deux runes A ou une
//     rune A reviennent à 4A, déjà couvert. Tout le reste fait échouer le joker.
// Une seule rune Intangible au plus : la règle du jeu, que LIBRE respecte en
// excluant Intangible.
// Le test différentiel (tests/builds-rapides.test.ts) compare cet inventaire à
// une énumération de tous les 6-uplets de runes.
function repartitions(combo: ComboVitesse): string[][] {
  const A = combo.quatre;
  const J = INTANGIBLE_SET;
  if (combo.deux !== BROKEN) {
    const B = combo.deux;
    return [[A, A, A, A, B, B], [A, A, A, J, B, B], [A, A, A, A, J, B]].flatMap(permutations);
  }
  return [
    [A, A, A, A, LIBRE, LIBRE],
    [A, A, A, A, LIBRE, J],
    ...SETS_DEUX.map((S) => [A, A, A, J, S, S]),
  ].flatMap(permutations);
}

// Les runes de chaque slot, rangées par set puis du meilleur au moins bon.
function indexer(runes: RuneDetail[], m: Map<number, Mesures>): Map<string, RuneDetail[]>[] {
  const parSlot = Array.from({ length: 6 }, () => new Map<string, RuneDetail[]>());
  for (const r of runes) {
    if (r.slot < 1 || r.slot > 6) continue;
    const parSet = parSlot[r.slot - 1];
    if (!parSet.has(r.set)) parSet.set(r.set, []);
    parSet.get(r.set)!.push(r);
  }
  for (const parSet of parSlot) for (const liste of parSet.values()) liste.sort((a, b) => comparerRunes(a, b, m));
  return parSlot;
}

function versBuild(runes: RuneDetail[], m: Map<number, Mesures>): BuildRapide {
  let vitRunes = 0;
  let eff = 0;
  for (const r of runes) {
    vitRunes += m.get(r.id)!.vit;
    eff += m.get(r.id)!.eff;
  }
  // Le bonus vient des sets RÉELLEMENT actifs, pas du nom de la combinaison.
  const bonus = activeSets(runes.map((r) => r.set)).includes('swift') ? swiftFlat(VIT_BASE_REFERENCE) : 0;
  return { runes, vitRunes, bonus, total: VIT_BASE_REFERENCE + vitRunes + bonus, effMoyenne: eff / 6 };
}

// Les `nombre` builds les plus rapides d'une combinaison, chacun sans les runes
// des précédents.
//
// ⚠️ Le #k est le MEILLEUR build sans les runes des k−1 premiers. C'est la
// définition, et le calcul la suit exactement. Ce n'est pas la répartition qui
// maximiserait la somme des k builds : un #1 plus lent pourrait laisser un
// meilleur #2. Le #1 reste le meilleur build du compte, c'est ce qu'on veut voir.
function buildsDuCombo(
  index: Map<string, RuneDetail[]>[],
  combo: ComboVitesse,
  nombre: number,
  m: Map<number, Mesures>
): BuildRapide[] {
  const reps = repartitions(combo);
  const utilisees = new Set<number>();
  // Position de la première rune encore libre de chaque liste (slot, set) : les
  // listes sont triées et `utilisees` ne fait que grandir, donc elle ne recule
  // jamais.
  const curseurs = index.map(() => new Map<string, number>());
  const tete = (slot: number, set: string): RuneDetail | undefined => {
    const liste = index[slot].get(set);
    if (!liste) return undefined;
    let i = curseurs[slot].get(set) ?? 0;
    while (i < liste.length && utilisees.has(liste[i].id)) i++;
    curseurs[slot].set(set, i);
    return liste[i];
  };

  const builds: BuildRapide[] = [];
  while (builds.length < nombre) {
    // La meilleure rune libre de chaque slot pour chaque rôle.
    const meilleure = index.map((parSet, slot) => {
      const parRole = new Map<string, RuneDetail | undefined>();
      let libre: RuneDetail | undefined;
      for (const set of parSet.keys()) {
        const r = tete(slot, set);
        parRole.set(set, r);
        if (r && set !== INTANGIBLE_SET && (!libre || comparerRunes(r, libre, m) < 0)) libre = r;
      }
      parRole.set(LIBRE, libre);
      return parRole;
    });

    let meilleurBuild: RuneDetail[] | null = null;
    for (const rep of reps) {
      const choix: RuneDetail[] = [];
      for (let slot = 0; slot < 6; slot++) {
        const r = meilleure[slot].get(rep[slot]);
        if (!r) break;
        choix.push(r);
      }
      if (choix.length < 6) continue;
      if (!meilleurBuild || comparerBuilds(choix, meilleurBuild, m) < 0) meilleurBuild = choix;
    }
    if (!meilleurBuild) break;
    for (const r of meilleurBuild) utilisees.add(r.id);
    builds.push(versBuild(meilleurBuild, m));
  }
  return builds;
}

// Le point d'entrée : pour chaque combinaison, ses `nombre` builds les plus
// rapides. Une combinaison sans aucun build possible reste dans la liste, vide.
export function buildsLesPlusRapides(
  runes: RuneDetail[],
  combos: ComboVitesse[],
  nombre: number
): BuildsDuCombo[] {
  const m = mesurerRunes(runes);
  const index = indexer(runes, m);
  return combos.map((combo) => ({ combo, builds: buildsDuCombo(index, combo, nombre, m) }));
}
