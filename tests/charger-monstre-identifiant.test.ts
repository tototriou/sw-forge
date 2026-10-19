// Le harnais et le CLI chargent le monstre de la recette par son `com2usId`.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE : deux homonymes (Eivor Eau 27711 et
// Eivor Feu 27712) se confondaient par le nom, et une mesure portait sur
// l'autre monstre avec, pour seule trace, un avertissement. Deux étages : la
// sélection pure (`exemplairesDuMonstre`), puis le branchement de
// `chargerRecette`, contrôlé sur la source (le charger pour de vrai exige un
// export de compte, absent des autres machines).

import { readFileSync } from 'node:fs';
import { egal, titre } from './outils';
import { exemplairesDuMonstre } from '../scripts/lib/loadMonster';

const EIVOR_EAU = 27711;
const EIVOR_FEU = 27712;
const NOMS = new Map<number, string>([[EIVOR_EAU, 'Eivor'], [EIVOR_FEU, 'Eivor'], [19811, 'Lapis']]);
const BOX = [
  { com2usId: EIVOR_EAU, unitId: 1 },
  { com2usId: EIVOR_FEU, unitId: 2 },
  { com2usId: 19811, unitId: 3 },
];

export function testChargerMonstreParIdentifiant() {
  titre('Chargement du monstre d’une recette par son com2usId');
  egal(exemplairesDuMonstre(BOX, 'Eivor', NOMS, EIVOR_FEU).map((u) => u.unitId), [2], 'com2usId donné : le seul homonyme visé');
  egal(exemplairesDuMonstre(BOX, 'Eivor', NOMS, EIVOR_EAU).map((u) => u.unitId), [1], 'com2usId donné : l’autre homonyme');
  egal(exemplairesDuMonstre(BOX, 'Nom traduit', NOMS, EIVOR_FEU).map((u) => u.unitId), [2], 'com2usId donné : le nom ne décide plus');
  egal(exemplairesDuMonstre(BOX, 'Eivor', NOMS).map((u) => u.unitId), [1, 2], 'sans com2usId : le nom, comme avant');

  const source = readFileSync(new URL('../scripts/lib/chargerRecette.ts', import.meta.url), 'utf8');
  egal(
    (source.match(/load(?:Box|Rta)Monster\(cheminCompte, recipe\.monsterName, recipe\.monsterCom2usId\)/g) ?? []).length,
    2,
    'chargerRecette passe le com2usId de la recette aux chargeurs box et RTA'
  );
}
