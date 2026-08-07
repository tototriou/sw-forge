// Calcul des stats effectives d'un monstre à partir de son équipement.
// Formule Summoners War : stat = base × (1 + Σ%/100) + Σplat pour PV/ATQ/DEF ;
// les autres stats (VIT, crit, RES, précision) sont additives.
//
// Contributions prises en compte :
//  - runes : stat principale + innée + substats (valeur meule incluse) ;
//  - artéfacts : stat principale plate (PV/ATQ/DEF) — les substats sont
//    conditionnels et n'entrent pas dans les stats de base ;
//  - relique : stat principale en % (PV%/ATQ%/DEF%).

import { GearSet } from '../types';
import { RUNE_EFFECT, ARTIFACT_MAIN, RELIC_MAIN, StatKey } from './effects';

export interface StatRow {
  key: StatKey;
  label: string;
  base: number;
  bonus: number;
  total: number;
  suffix: string; // '%' pour crit/res/précision, '' sinon
}

const ROWS: { key: StatKey; label: string; suffix: string }[] = [
  { key: 'hp', label: 'PV', suffix: '' },
  { key: 'atk', label: 'ATQ', suffix: '' },
  { key: 'def', label: 'DEF', suffix: '' },
  { key: 'spd', label: 'VIT', suffix: '' },
  { key: 'cr', label: 'Taux Crit', suffix: '%' },
  { key: 'cd', label: 'Dmg Crit', suffix: '%' },
  { key: 'res', label: 'RES', suffix: '%' },
  { key: 'acc', label: 'Précision', suffix: '%' },
];

export function computeStats(gear: GearSet): StatRow[] {
  const base = gear.base;
  // Accumulateurs de bonus plats et de pourcentages (PV/ATQ/DEF uniquement).
  const flat: Record<StatKey, number> = { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 };
  const pct: Record<'hp' | 'atk' | 'def', number> = { hp: 0, atk: 0, def: 0 };

  const applyRune = (code: number, value: number) => {
    const def = RUNE_EFFECT[code];
    if (!def) return;
    if (def.pct) pct[def.stat as 'hp' | 'atk' | 'def'] += value;
    else flat[def.stat] += value;
  };

  for (const r of gear.runes) {
    applyRune(r.main.code, r.main.value);
    if (r.innate) applyRune(r.innate.code, r.innate.value);
    for (const s of r.subs) applyRune(s.code, s.value);
  }

  // Stat principale d'artéfact : plate (PV/ATQ/DEF).
  for (const a of gear.artifacts) {
    const def = ARTIFACT_MAIN[a.main.code];
    if (def) flat[def.stat] += a.main.value;
  }

  // Stat principale de relique : en % (PV%/ATQ%/DEF%).
  if (gear.relic) {
    const def = RELIC_MAIN[gear.relic.main.code];
    if (def) pct[def.stat as 'hp' | 'atk' | 'def'] += gear.relic.main.value;
  }

  const baseVal: Record<StatKey, number> = {
    hp: base.hp, atk: base.atk, def: base.def, spd: base.spd,
    cr: base.cr, cd: base.cd, res: base.res, acc: base.acc,
  };

  return ROWS.map(({ key, label, suffix }) => {
    let total: number;
    if (key === 'hp' || key === 'atk' || key === 'def') {
      total = Math.floor(baseVal[key] * (1 + pct[key] / 100) + flat[key]);
    } else {
      total = baseVal[key] + flat[key];
    }
    return { key, label, base: baseVal[key], bonus: total - baseVal[key], total, suffix };
  });
}
