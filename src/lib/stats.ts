// Calcul des stats effectives d'un monstre à partir de son équipement.
//
// ⚠️ RÈGLE D'ARRONDI (toute l'app) : **dès qu'un calcul produit une décimale, on
// arrondit immédiatement à l'entier SUPÉRIEUR** (`Math.ceil`) — jamais un
// `floor`/`round` en fin de chaîne. C'est la règle déjà appliquée à la vitesse
// (`pctSpeedBonus`, voir speed.ts) ; elle vaut ici pour tous les bonus en %.
//
//   stat = base + ceil(base × Σ% / 100) + Σplat
//
// Les pourcentages sont d'abord SOMMÉS (runes + relique + sets), puis un seul
// `ceil` est appliqué — comme pour `ceil(base × (totem + lead) / 100)`.
// Les stats sans % (crit, RES, précision) restent purement additives.
//
// Contributions prises en compte :
//  - runes : stat principale + innée + substats (valeur meule incluse) ;
//  - **bonus de set** : Swift +25 % VIT, Energy +15 % PV, Rage +40 pts de dégâts
//    crit… (voir `SET_STAT_BONUS`). Un set 2 pièces peut être actif plusieurs
//    fois (6 runes Energy = 3× le bonus) — `activeSets` renvoie les répétitions ;
//  - artéfacts : stat principale plate (PV/ATQ/DEF) — les substats sont
//    conditionnels et n'entrent pas dans les stats de base ;
//  - relique : stat principale en % (PV%/ATQ%/DEF%).

import { GearSet } from '../types';
import { RUNE_EFFECT, ARTIFACT_MAIN, RELIC_MAIN, StatKey, SET_STAT_BONUS, activeSets } from './effects';

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

  // Bonus de set : appliqués APRÈS le calcul des bases (les % portent dessus).
  for (const key of activeSets(gear.runes.map((r) => r.set))) {
    const bonus = SET_STAT_BONUS[key];
    if (!bonus) continue;
    if (bonus.flat != null) {
      flat[bonus.stat] += bonus.flat; // points directs (crit, RES, précision)
    } else if (bonus.pct != null) {
      if (bonus.stat === 'hp' || bonus.stat === 'atk' || bonus.stat === 'def') {
        pct[bonus.stat] += bonus.pct; // entre dans le × (1 + Σ%)
      } else {
        // VIT : % de la base, ajouté à plat — arrondi au supérieur, comme le
        // bonus de vitesse du totem/lead et comme l'import Swift.
        flat[bonus.stat] += Math.ceil((baseVal[bonus.stat] * bonus.pct) / 100);
      }
    }
  }

  return ROWS.map(({ key, label, suffix }) => {
    let total: number;
    if (key === 'hp' || key === 'atk' || key === 'def') {
      // Le bonus en % est arrondi AU SUPÉRIEUR avant d'être ajouté.
      total = baseVal[key] + Math.ceil((baseVal[key] * pct[key]) / 100) + flat[key];
    } else {
      total = baseVal[key] + flat[key];
    }
    return { key, label, base: baseVal[key], bonus: total - baseVal[key], total, suffix };
  });
}
