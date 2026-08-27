// L'objectif passé en ARGUMENT à un script, résolu contre le type courant.
//
// ⚠️⚠️ **`'degats'` A ÉTÉ RETIRÉ d'`Objective`** (2026-08-27, voir
// runeBuildOptim.ts) — mais il restait le DÉFAUT de neuf scripts CLI/diag, en
// cast `as Objective`. Or `objectiveKeysOf` retombe sur `[]` pour une valeur
// absente de la table : ces scripts mesuraient donc **sans aucun biais de
// pré-filtrage**, alors qu'ils sont précisément là pour mesurer ce biais. Le
// validateur différentiel comparait deux moteurs dans des conditions qui
// n'étaient plus celles de l'app, et rien ne le disait.
//
// ⚠️ **Le repli reproduit l'ANCIEN comportement, il ne l'efface pas** :
// `'degats'` privilégiait ATQ + Dgts Crit. On rend donc `'efficience'` avec
// `objectiveStats: ['atk', 'cd']` — exactement l'équivalence déjà retenue dans
// `perfShared.ts` pour sa batterie. Mesurer « sans biais » aurait changé la
// question posée, silencieusement.
import { Objective } from '../../src/lib/runeBuildOptim';
import { StatKey } from '../../src/lib/effects';

export interface ObjectifCli {
  objective: Objective | undefined;
  objectiveStats: StatKey[] | undefined;
}

export function resolveObjectifCli(arg: string | undefined): ObjectifCli {
  if (!arg || arg === 'none') return { objective: undefined, objectiveStats: undefined };
  if (arg === 'degats' || arg === 'speed_nuker') {
    return { objective: 'efficience', objectiveStats: ['atk', 'cd'] };
  }
  return { objective: arg as Objective, objectiveStats: undefined };
}
