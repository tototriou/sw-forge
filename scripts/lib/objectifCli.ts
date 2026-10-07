// L'objectif passé en ARGUMENT à un script, résolu contre le type courant.
//
// ⚠️⚠️ **`'degats'` n'est plus un `Objective`** (voir runeBuildOptim.ts) :
// un script qui le passerait en cast `as Objective` ferait retomber
// `objectiveKeysOf` sur `[]` (valeur absente de la table), et mesurerait donc
// **sans aucun biais de pré-filtrage**, alors que ces scripts sont
// précisément là pour mesurer ce biais. Un validateur différentiel
// comparerait deux moteurs dans des conditions qui ne sont pas celles de
// l'app, et rien ne le dirait.
//
// ⚠️ **Le repli reproduit l'ANCIEN comportement de `'degats'`** : il
// privilégiait ATQ + Dgts Crit. On rend donc `'efficience'` avec
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
