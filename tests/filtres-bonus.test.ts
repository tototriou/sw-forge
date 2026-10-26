import { COLONNES_RESULTATS } from '../src/lib/colonnesResultats';
import { decimalesColonne, depuisAffichage, versAffichage } from '../src/lib/filtresAffichage';
import { lireFrappe } from '../src/ui/NumberField';
import { egal, ok, titre } from './outils';

// « Total / Bonus » du tableau des résultats : les bornes restent en total dans
// le classeur ; le tableau les écrit et les saisit dans le mode affiché. La
// conversion est exacte dans les deux sens : basculer ne masque ni ne révèle
// aucun build.

const LUSHEN = { hp: 9885, atk: 900, def: 461, spd: 103, cr: 15, cd: 50, res: 15, acc: 0 };

export function testFiltresResultatsBonus() {
  titre('Tableau des résultats — bornes en Total ou en Bonus, conversion sans dérive');
  egal(versAffichage('atk', 3500, LUSHEN, true), 2600, 'Lushen, ATQ de base 900 : un minimum de 3500 en total s’écrit 2600 en Bonus');
  egal(depuisAffichage('atk', 2600, LUSHEN, true), 3500, '… et 2600 saisi en Bonus redevient 3500 dans le classeur');
  egal([versAffichage('atk', 3500, LUSHEN, false), depuisAffichage('atk', 3500, LUSHEN, false)], [3500, 3500], 'en Total : rien ne change');
  ok((['cr', 'cd', 'res', 'acc', 'efficience', 'ehp', 'degats_reels'] as const).every((c) => versAffichage(c, 85, LUSHEN, true) === 85 && depuisAffichage(c, 85, LUSHEN, true) === 85),
    'en Bonus, Taux Crit, Dmg Crit, RES, Précision, Efficience, PV effectifs et Dégâts réels restent en total');
  egal((['hp', 'def', 'spd'] as const).map((c) => versAffichage(c, 20000, LUSHEN, true)), [20000 - 9885, 20000 - 461, 20000 - 103], 'en Bonus, PV, DEF et VIT : total − base');

  // Aller-retour sur chaque colonne, dans les deux modes : la borne du classeur
  // est rendue à l'identique. Les colonnes converties (PV, ATQ, DEF, VIT) ne se
  // saisissent qu'en entiers ; les décimales (Efficience) ne se convertissent pas.
  let derives = 0, essais = 0;
  for (const c of COLONNES_RESULTATS) for (const enBonus of [false, true]) for (let v = 0; v <= 250000; v += 997) {
    for (const total of c === 'efficience' ? [v, v + 0.1, v + 78.8] : [v, v + 1]) {
      essais++;
      if (!Object.is(depuisAffichage(c, versAffichage(c, total, LUSHEN, enBonus), LUSHEN, enBonus), total)) derives++;
    }
  }
  ok(derives === 0, `aller-retour total → affichage → total sans dérive (${essais} essais, ${derives} écart)`);
  // Basculer le mode n'écrit rien : la borne gardée est la même avant et après.
  const borne = depuisAffichage('atk', 2600, LUSHEN, true);
  egal([versAffichage('atk', borne, LUSHEN, false), versAffichage('atk', borne, LUSHEN, true)], [3500, 2600], 'basculer Bonus ↔ Total relit la même borne (3500), écrite 3500 ou 2600');
}

export function testFiltresResultatsDecimales() {
  titre('Bornes des résultats — une décimale pour l’Efficience, des entiers ailleurs');
  egal([decimalesColonne('efficience', 'eff'), decimalesColonne('efficience', 'score'), decimalesColonne('spd', 'eff'), decimalesColonne('ehp', 'eff')], [1, 0, 0, 0],
    'Efficience : une décimale (comme la carte) ; Score SW et les autres colonnes : des entiers');
  egal(lireFrappe('78.8', 1), { valeur: 78.8 }, '« 78.8 » avec une décimale : 78.8');
  egal(lireFrappe('78.', 1), { brouillon: '78.', valeur: 78 }, '« 78. » : gardé à l’écran le temps d’écrire la décimale');
  egal(lireFrappe('78,8', 1), { brouillon: '78,8', valeur: 78.8 }, '« 78,8 » : la virgule est admise');
  egal([lireFrappe('78.88', 1), lireFrappe('78.8', 0), lireFrappe('7a', 1)], [null, null, null], 'trop de décimales, une décimale sur un entier, une lettre : frappe ignorée');
  egal([lireFrappe('', 1, true), lireFrappe('-', 1), lireFrappe('150000', 0)], [{ valeur: null }, { brouillon: '-' }, { valeur: 150000 }], 'vide, signe seul et entier : comme avant');
}
