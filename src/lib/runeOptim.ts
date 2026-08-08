// Potentiel maximal d'une rune : meilleure gemme (parmi les stats grindables,
// sans doublon) PUIS grind au max sur tous les substats. Deux scénarios :
// héroïque et légendaire. Runes classiques et antiques ont leurs propres tables.
//
// Calcul pur (≤ 4 slots × 7 stats × O(4) par rune) — réutilisable dans un Web
// Worker pour les traitements lourds à venir.

import { EffectLine, RuneDetail } from '../types';
import { MAINSTAT_MAX, SUBSTAT_MAX, SCORE_MAX, runeEfficiency, runeScore } from './effects';

// Le potentiel se calcule dans la MESURE choisie (efficience ou score SW).
// Ce n'est pas qu'un changement d'unité : les stats plates n'ont pas le même
// poids dans les deux tables, donc la **meilleure gemme peut différer** — par
// exemple entre un ATQ plat et un ATQ%.
export type OptimMetric = 'eff' | 'score';

type Tbl = Record<number, number>;

// Grind max (valeur ajoutée) par code de substat. RES/Préci/TC/DCC non grindables.
const GRIND_HERO: Tbl = { 1: 450, 2: 7, 3: 22, 4: 7, 5: 22, 6: 7, 8: 4 };
const GRIND_LEGEND: Tbl = { 1: 550, 2: 10, 3: 30, 4: 10, 5: 30, 6: 10, 8: 5 };
const GRIND_HERO_ANC: Tbl = { 1: 510, 2: 9, 3: 26, 4: 9, 5: 26, 6: 9, 8: 5 };
const GRIND_LEGEND_ANC: Tbl = { 1: 610, 2: 12, 3: 34, 4: 12, 5: 34, 6: 12, 8: 6 };

// Valeur de base max d'une gemme (avant grind), par code de stat.
const GEM_HERO: Tbl = { 2: 11, 4: 11, 6: 11, 8: 8, 1: 420, 3: 30, 5: 30 };
const GEM_LEGEND: Tbl = { 2: 13, 4: 13, 6: 13, 8: 10, 1: 580, 3: 40, 5: 40 };
const GEM_HERO_ANC: Tbl = { 2: 13, 4: 13, 6: 13, 8: 9, 1: 480, 3: 34, 5: 34 };
const GEM_LEGEND_ANC: Tbl = { 2: 15, 4: 15, 6: 15, 8: 11, 1: 640, 3: 44, 5: 44 };

// Stats gemmables candidates (% d'abord, flats ensuite ; on maximise l'efficience).
const GEM_STATS = [2, 4, 6, 8, 1, 3, 5];

export interface RunePotential {
  eff: number; // valeur actuelle, dans la mesure demandée
  heroEff: number; // valeur max (gemme+grind) en héroïque
  legendEff: number; // valeur max (gemme+grind) en légendaire
  heroGain: number;
  legendGain: number;
  heroGem: number | null; // code de la stat à gemmer (null = pas de gemme conseillée)
  legendGem: number | null;
}

// Valeur d'une rune (substats modifiés, main + innée inchangés), dans la mesure
// demandée. Le score ne compte QUE les stats secondaires et ne divise pas par
// 2,8 ; l'efficience ajoute la principale plafonnée à 1. Voir effects.ts.
function valueOf(
  main: EffectLine,
  innate: EffectLine | undefined,
  subs: { code: number; total: number }[],
  metric: OptimMetric
): number {
  const table = metric === 'eff' ? SUBSTAT_MAX : SCORE_MAX;
  let ratio = 0;
  for (const s of subs) {
    const m = table[s.code];
    if (m) ratio += s.total / m;
  }
  if (innate) {
    const m = table[innate.code];
    if (m) ratio += innate.value / m;
  }
  if (metric === 'score') return ratio * 100;
  const mm = MAINSTAT_MAX[main.code];
  return (((mm ? Math.min(main.value / mm, 1) : 0) + ratio) / 2.8) * 100;
}

// Mise à l'échelle finale d'une valeur, selon la formule de la mesure :
//  - **score** → `round(… × 100)`, c'est un ENTIER (voir effects.ts) ;
//  - **efficience** → pourcentage, on garde la précision (affichée au dixième).
//
// L'arrondi n'intervient qu'ICI, en sortie : les comparaisons internes de
// `best()` travaillent en pleine précision, sinon deux gemmes séparées par un
// centième donneraient une égalité et le choix deviendrait arbitraire.
function out(value: number, metric: OptimMetric): number {
  return metric === 'score' ? Math.round(value) : value;
}

interface Best {
  eff: number;
  gemSlot: number; // index du substat remplacé par la gemme (-1 = pas de gemme)
  gemCode: number | null; // nouvelle stat gemmée
}

// Meilleure valeur atteignable pour un scénario (table grind G, table gemme M).
// `withGem` = false → grind seul (on garde les stats actuelles, pas de gemme).
// Renvoie aussi le choix gagnant (slot + stat) pour reconstruire le plan.
function best(rune: RuneDetail, G: Tbl, M: Tbl, withGem: boolean, metric: OptimMetric): Best {
  const subs = rune.subs.map((s) => ({
    code: s.code,
    base: s.value - (s.grind ?? 0), // base « sans grind »
    enchant: !!s.enchant,
  }));
  const gtotal = (code: number, base: number) => base + (G[code] ?? 0);

  // Scénario de référence : grind seul, aucune gemme.
  let bestEff = valueOf(
    rune.main,
    rune.innate,
    subs.map((s) => ({ code: s.code, total: gtotal(s.code, s.base) })),
    metric
  );
  let bestSlot = -1;
  let bestCode: number | null = null;

  if (!withGem) return { eff: bestEff, gemSlot: -1, gemCode: null }; // grind seul

  const gemmedIdx = subs.findIndex((s) => s.enchant);

  // Rune DÉJÀ gemmée : la stat gemmée est FIXE (on ne peut pas en gemmer une autre).
  // Seul gain possible : « procker au max » — porter sa base au max de gemme si elle
  // n'y est pas déjà — puis grind. (Rien à faire si le proc est déjà au max.)
  if (gemmedIdx >= 0) {
    const code = subs[gemmedIdx].code;
    const gmax = M[code];
    if (gmax != null) {
      const newBase = Math.max(subs[gemmedIdx].base, gmax); // jamais de downgrade
      const newSubs = subs.map((s, j) =>
        j === gemmedIdx
          ? { code, total: newBase + (G[code] ?? 0) }
          : { code: s.code, total: gtotal(s.code, s.base) }
      );
      const e = valueOf(rune.main, rune.innate, newSubs, metric);
      if (e > bestEff) {
        bestEff = e;
        bestSlot = gemmedIdx;
        bestCode = code;
      }
    }
    return { eff: bestEff, gemSlot: bestSlot, gemCode: bestCode };
  }

  // Rune NON gemmée : on peut gemmer n'importe quel substat vers une AUTRE stat.
  // Stats interdites selon l'emplacement : slot 1 → pas de DEF (5/6), slot 3 → pas d'ATQ (3/4).
  const forbidden = new Set<number>();
  if (rune.slot === 1) {
    forbidden.add(5);
    forbidden.add(6);
  } else if (rune.slot === 3) {
    forbidden.add(3);
    forbidden.add(4);
  }

  for (let slot = 0; slot < subs.length; slot++) {
    for (const Y of GEM_STATS) {
      if (M[Y] == null) continue;
      if (forbidden.has(Y)) continue; // interdit sur cet emplacement
      if (Y === subs[slot].code) continue; // gemme = remplacer par une AUTRE stat
      if (Y === rune.main.code) continue;
      if (rune.innate && Y === rune.innate.code) continue;
      let dup = false;
      for (let j = 0; j < subs.length; j++) {
        if (j !== slot && subs[j].code === Y) {
          dup = true;
          break;
        }
      }
      if (dup) continue;

      const newSubs = subs.map((s, j) =>
        j === slot
          ? { code: Y, total: M[Y] + (G[Y] ?? 0) } // gemme (base max) + grind max
          : { code: s.code, total: gtotal(s.code, s.base) }
      );
      const e = valueOf(rune.main, rune.innate, newSubs, metric);
      if (e > bestEff) {
        bestEff = e;
        bestSlot = slot;
        bestCode = Y;
      }
    }
  }
  return { eff: bestEff, gemSlot: bestSlot, gemCode: bestCode };
}

export function runePotential(
  rune: RuneDetail,
  withGem = true,
  metric: OptimMetric = 'eff'
): RunePotential {
  const anc = rune.rank > 10;
  const eff = metric === 'eff' ? runeEfficiency(rune) : runeScore(rune);
  const h = best(rune, anc ? GRIND_HERO_ANC : GRIND_HERO, anc ? GEM_HERO_ANC : GEM_HERO, withGem, metric);
  const l = best(
    rune,
    anc ? GRIND_LEGEND_ANC : GRIND_LEGEND,
    anc ? GEM_LEGEND_ANC : GEM_LEGEND,
    withGem,
    metric
  );
  // Arrondi en sortie, puis gains calculés SUR LES VALEURS ARRONDIES : le gain
  // affiché est ainsi toujours exactement « potentiel − actuel » à l'écran.
  const heroEff = out(h.eff, metric);
  const legendEff = out(l.eff, metric);
  return {
    eff,
    heroEff,
    legendEff,
    heroGain: heroEff - eff,
    legendGain: legendEff - eff,
    heroGem: h.gemCode,
    legendGem: l.gemCode,
  };
}

/* --------------------------------------------------------------------------
 * Plan d'optimisation détaillé (pour « ce qu'il faut up » au clic sur une rune)
 * ----------------------------------------------------------------------- */

export interface PlanSub {
  code: number; // stat finale (après gemme éventuelle)
  fromCode: number; // stat actuelle du slot (= code sauf si gemmé)
  isGem: boolean; // ce slot est (re)gemmé dans le plan
  base: number; // valeur de base cible (hors grind)
  grind: number; // grind cible
  total: number; // base + grind
  curTotal: number; // valeur actuelle du slot
  curGrind: number; // grind actuel
  grindable: boolean;
}

export interface RunePlan {
  scenario: 'hero' | 'legend';
  eff: number; // valeur actuelle (dans la mesure demandée)
  targetEff: number; // valeur après plan
  gemCode: number | null; // stat à gemmer (null = pas de gemme)
  subs: PlanSub[]; // aligné sur rune.subs (par index)
}

// Reconstruit le plan concret (gemme + grinds) pour un scénario donné.
export function runePlan(
  rune: RuneDetail,
  scenario: 'hero' | 'legend',
  withGem = true,
  metric: OptimMetric = 'eff'
): RunePlan {
  const anc = rune.rank > 10;
  const G =
    scenario === 'hero' ? (anc ? GRIND_HERO_ANC : GRIND_HERO) : anc ? GRIND_LEGEND_ANC : GRIND_LEGEND;
  const M = scenario === 'hero' ? (anc ? GEM_HERO_ANC : GEM_HERO) : anc ? GEM_LEGEND_ANC : GEM_LEGEND;

  const b = best(rune, G, M, withGem, metric);
  const subs: PlanSub[] = rune.subs.map((s, j) => {
    const curGrind = s.grind ?? 0;
    const curBase = s.value - curGrind;
    if (j === b.gemSlot && b.gemCode != null) {
      const gmax = M[b.gemCode] ?? 0;
      // Re-proc de la MÊME stat (rune déjà gemmée) → base = max(base actuelle, gemMax) ;
      // nouvelle gemme (stat différente) → base = gemMax.
      const base = b.gemCode === s.code ? Math.max(curBase, gmax) : gmax;
      const grind = G[b.gemCode] ?? 0;
      return {
        code: b.gemCode,
        fromCode: s.code,
        isGem: true,
        base,
        grind,
        total: base + grind,
        curTotal: s.value,
        curGrind,
        grindable: true,
      };
    }
    const grindable = G[s.code] != null;
    const grind = grindable ? G[s.code] : curGrind;
    return {
      code: s.code,
      fromCode: s.code,
      isGem: false,
      base: curBase,
      grind,
      total: curBase + grind,
      curTotal: s.value,
      curGrind,
      grindable,
    };
  });

  return {
    scenario,
    eff: metric === 'eff' ? runeEfficiency(rune) : runeScore(rune),
    targetEff: out(b.eff, metric),
    gemCode: b.gemCode,
    subs,
  };
}
