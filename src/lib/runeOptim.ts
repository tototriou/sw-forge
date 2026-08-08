// Potentiel maximal d'une rune : meilleure gemme (parmi les stats grindables,
// sans doublon) PUIS grind au max sur tous les substats. Deux scénarios :
// héroïque et légendaire. Runes classiques et antiques ont leurs propres tables.
//
// Calcul pur (≤ 4 slots × 7 stats × O(4) par rune) — réutilisable dans un Web
// Worker pour les traitements lourds à venir.

import { EffectLine, RuneDetail } from '../types';
import { MAINSTAT_MAX, SUBSTAT_MAX, runeEfficiency } from './effects';

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
  eff: number; // efficience actuelle
  heroEff: number; // efficience max (gemme+grind) en héroïque
  legendEff: number; // efficience max (gemme+grind) en légendaire
  heroGain: number;
  legendGain: number;
  heroGem: number | null; // code de la stat à gemmer (null = pas de gemme conseillée)
  legendGem: number | null;
}

// Efficience à partir des substats modifiés (main + innée inchangés).
function effOf(main: EffectLine, innate: EffectLine | undefined, subs: { code: number; total: number }[]): number {
  let ratio = 0;
  const mm = MAINSTAT_MAX[main.code];
  if (mm) ratio += Math.min(main.value / mm, 1);
  for (const s of subs) {
    const m = SUBSTAT_MAX[s.code];
    if (m) ratio += s.total / m;
  }
  if (innate) {
    const m = SUBSTAT_MAX[innate.code];
    if (m) ratio += innate.value / m;
  }
  return (ratio / 2.8) * 100;
}

interface Best {
  eff: number;
  gemSlot: number; // index du substat remplacé par la gemme (-1 = pas de gemme)
  gemCode: number | null; // nouvelle stat gemmée
}

// Meilleure efficience atteignable pour un scénario (table grind G, table gemme M).
// `withGem` = false → grind seul (on garde les stats actuelles, pas de gemme).
// Renvoie aussi le choix gagnant (slot + stat) pour reconstruire le plan.
function best(rune: RuneDetail, G: Tbl, M: Tbl, withGem: boolean): Best {
  const subs = rune.subs.map((s) => ({
    code: s.code,
    base: s.value - (s.grind ?? 0), // base « sans grind »
    enchant: !!s.enchant,
  }));
  const gtotal = (code: number, base: number) => base + (G[code] ?? 0);

  // Scénario de référence : grind seul, aucune gemme.
  let bestEff = effOf(
    rune.main,
    rune.innate,
    subs.map((s) => ({ code: s.code, total: gtotal(s.code, s.base) }))
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
      const e = effOf(rune.main, rune.innate, newSubs);
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
      const e = effOf(rune.main, rune.innate, newSubs);
      if (e > bestEff) {
        bestEff = e;
        bestSlot = slot;
        bestCode = Y;
      }
    }
  }
  return { eff: bestEff, gemSlot: bestSlot, gemCode: bestCode };
}

export function runePotential(rune: RuneDetail, withGem = true): RunePotential {
  const anc = rune.rank > 10;
  const eff = runeEfficiency(rune);
  const h = best(rune, anc ? GRIND_HERO_ANC : GRIND_HERO, anc ? GEM_HERO_ANC : GEM_HERO, withGem);
  const l = best(rune, anc ? GRIND_LEGEND_ANC : GRIND_LEGEND, anc ? GEM_LEGEND_ANC : GEM_LEGEND, withGem);
  return {
    eff,
    heroEff: h.eff,
    legendEff: l.eff,
    heroGain: h.eff - eff,
    legendGain: l.eff - eff,
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
  eff: number; // efficience actuelle
  targetEff: number; // efficience après plan
  gemCode: number | null; // stat à gemmer (null = pas de gemme)
  subs: PlanSub[]; // aligné sur rune.subs (par index)
}

// Reconstruit le plan concret (gemme + grinds) pour un scénario donné.
export function runePlan(rune: RuneDetail, scenario: 'hero' | 'legend', withGem = true): RunePlan {
  const anc = rune.rank > 10;
  const G =
    scenario === 'hero' ? (anc ? GRIND_HERO_ANC : GRIND_HERO) : anc ? GRIND_LEGEND_ANC : GRIND_LEGEND;
  const M = scenario === 'hero' ? (anc ? GEM_HERO_ANC : GEM_HERO) : anc ? GEM_LEGEND_ANC : GEM_LEGEND;

  const b = best(rune, G, M, withGem);
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
    eff: runeEfficiency(rune),
    targetEff: b.eff,
    gemCode: b.gemCode,
    subs,
  };
}
