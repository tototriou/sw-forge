// Sélection d'exemplaire à l'import d'une recette Optimizer — voir
// spec/outils/optimizer/pistes.md, entrée « BUG — l'import d'une recette ne
// sélectionne aucun exemplaire dès qu'on en possède PLUSIEURS ».
//
// ⚠️ Le dépôt ne teste pas les composants React (voir le commentaire de
// `testOptimizerExclusion` sur `useSiegeState.ts`) : `sourceSelector` est un
// état LOCAL d'`OptimizerSection`, sa résolution n'est pas une fonction pure
// exportée. Même patron ici — contrôle de SOURCE, seule façon de voir la
// régression revenir si un site retombe sur l'ancienne règle divergente.
//
// Le bug : le picker (`pickSpecies`) prend TOUJOURS `boxCandidates[0]`, avec
// repli sur `unownedSelectorIfNoneOwned` seulement si la box n'a AUCUN
// candidat. L'import de recette, lui, ne prenait `boxCandidates[0]` QUE si un
// SEUL exemplaire existait — dès 2, repli sur « non possédé », donc des
// stats de base 6★ sans runes silencieusement fausses. Un troisième site
// (l'initialisation paresseuse de `sourceSelector` au montage) portait la
// même faute. Décision (2026-09-04) : aligner tous les sites sur la règle du
// picker, aucun cas spécial sur la longueur du tableau.

import { readFileSync } from 'fs';
import { egal, ok, titre } from './outils';

const REGLE_PICKER = 'boxCandidates[0]?.selector ?? unownedSelectorIfNoneOwned';
const REGLE_FAUTIVE = /boxCandidates\.length === 1 \? boxCandidates\[0\]\.selector : unowned/;

export default function testOptimizerRecipeImportSelection() {
  titre('Optimizer · sélection d’exemplaire — import de recette alignée sur le picker');

  const source = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');

  ok(!REGLE_FAUTIVE.test(source), "aucun site ne retombe sur « non possédé » à cause d'un test de longueur (== 1)");

  const occurrences = source.split(REGLE_PICKER).length - 1;
  // Les 3 sites concernés : le picker (`pickSpecies`), l'initialisation
  // paresseuse de `sourceSelector` au montage, et l'import de recette.
  egal(occurrences, 3, 'les 3 sites de résolution (picker, init paresseuse, import de recette) partagent la MÊME règle');

  const debutImportRecipe = source.indexOf('function importRecipe');
  ok(debutImportRecipe !== -1, "la fonction importRecipe existe toujours (sinon ce test contrôle la mauvaise fonction)");
  const zoneImport = source.slice(debutImportRecipe);
  ok(zoneImport.includes(REGLE_PICKER), "le site d'import de recette applique bien la règle du picker (pas de cas spécial sur 1 exemplaire)");
}
