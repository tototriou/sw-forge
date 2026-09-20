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
import { buildOptimizerRecipe, parseOptimizerRecipe, relicMainPourCeCompte } from '../src/lib/optimizerRecipe';
import { defaultRelicMainChoice } from '../src/hooks/useOptimizerState';
import { recipeToRelicIntent } from '../scripts/lib/recipeToSearchParams';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';

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

  testRecetteRelique();
}

// Lot 2 (implementation-relique, B.2) : trois champs (`relicMainChoice`,
// `relicUniqueChoice`, `relicMinUpgrade`) dans `OptimizerRecipe`, sans écran
// — voir spec/outils/optimizer/chantiers/implementation-relique.md § B.2.
function recetteDeBase(extra: Partial<Parameters<typeof buildOptimizerRecipe>[0]> = {}) {
  return buildOptimizerRecipe({
    monsterCom2usId: 14104,
    monsterName: 'Camilla (test)',
    requirement: { sets: [], minStats: {} },
    objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'rta',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: {},
    ...extra,
  });
}

function monstreCharge(relic?: LoadedMonster['gear']['relic']): LoadedMonster {
  return {
    unitId: 1,
    com2usId: 14104,
    monsterName: 'Camilla (test)',
    gear: { base: { hp: 10000, atk: 1000, def: 800, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [], relic },
    allRunes: [],
    allArtifacts: [],
    allRelics: relic ? [relic] : [],
  };
}

function testRecetteRelique() {
  titre('Optimizer · recette de relique (lot 2) — trois champs, défauts, bascule');

  // Recette ANCIENNE (avant le lot 2) : aucun des trois champs. `tsc` ne
  // détecte jamais un champ optionnel oublié — c'est ce round-trip qui
  // protège la compatibilité arrière (règle des constructeurs multiples,
  // CLAUDE.md).
  {
    const ancienne = recetteDeBase();
    const relue = parseOptimizerRecipe(JSON.stringify(ancienne)).recipe;
    ok(relue !== null, 'une recette sans les trois champs reste un fichier VALIDE');
    egal(relue?.relicMainChoice, undefined, "… relicMainChoice reste absent — le défaut se calcule au LECTEUR, jamais ici");
    egal(relue?.relicUniqueChoice, undefined, '… relicUniqueChoice aussi');
    egal(relue?.relicMinUpgrade, undefined, '… relicMinUpgrade aussi');
  }

  // Valeur inconnue → rejet (comme le reste du parseur).
  {
    const invalideMain = { ...recetteDeBase(), relicMainChoice: 'jamais-vu' };
    ok(parseOptimizerRecipe(JSON.stringify(invalideMain)).recipe === null, 'relicMainChoice inconnu : recette rejetée');

    const invalideType = { ...recetteDeBase(), relicUniqueChoice: 999 };
    ok(parseOptimizerRecipe(JSON.stringify(invalideType)).recipe === null, 'relicUniqueChoice hors des 16 types connus : recette rejetée');
  }

  // Le seuil est un FILTRE D'ENTRÉE (D2), jamais un critère : hors bornes, il
  // est NORMALISÉ plutôt que rejeté — seul champ de ce parseur à l'être.
  {
    const tropBas = { ...recetteDeBase(), relicMinUpgrade: -1 };
    egal(parseOptimizerRecipe(JSON.stringify(tropBas)).recipe?.relicMinUpgrade, 0, 'seuil -1 → normalisé à 0');

    const tropHaut = { ...recetteDeBase(), relicMinUpgrade: 99 };
    egal(parseOptimizerRecipe(JSON.stringify(tropHaut)).recipe?.relicMinUpgrade, 15, 'seuil 99 → normalisé à 15');
  }

  // « Garder la relique équipée » ne se partage pas — même règle que
  // l'artéfact (`mainsPourCeCompte`, D1 : « mêmes trois règles »).
  {
    const r = { relicMainChoice: 'equipped' as const, wizardName: 'Alice' };
    const autreCompte = relicMainPourCeCompte(r, 'Bob');
    egal(autreCompte.main, 'libre', "compte différent : « Garder la relique équipée » passe sur « Libre »");
    egal(autreCompte.bascule, true, '… et la bascule est signalée, pour le message d’import');

    const memeCompte = relicMainPourCeCompte(r, 'Alice');
    egal(memeCompte.main, 'equipped', 'même compte : rien ne bouge');
    egal(memeCompte.bascule, false, '… et rien à signaler');

    const sansNom = relicMainPourCeCompte({ relicMainChoice: 'equipped', wizardName: undefined }, 'Bob');
    egal(sansNom.main, 'equipped', 'provenance inconnue (pas de wizardName) : on ne touche à rien');
    egal(sansNom.bascule, false, '… et rien n’est annoncé');

    const nonEquipe = relicMainPourCeCompte({ relicMainChoice: 101, wizardName: 'Alice' }, 'Bob');
    egal(nonEquipe.bascule, false, 'une principale explicite (101) : rien à basculer, même venue d’ailleurs');

    // Le CLI (`recipeToSearchParams.ts`) ne bascule JAMAIS — même règle que
    // l'artéfact (D1) : reproduire fidèlement l'export signalé, pas
    // « corriger » une intention exportée avec un compte explicite.
    const rechargeParLeCli = recipeToRelicIntent({ ...recetteDeBase(), relicMainChoice: 'equipped' }, monstreCharge());
    egal(rechargeParLeCli.principale, 'equipped', 'le CLI reproduit « equipped » tel quel, sans bascule de compte');
  }

  // Le défaut de `relicMainChoice` se CALCULE contre le monstre — jamais une
  // constante (D1, incident artéfacts « le défaut affiché était FAUX »).
  {
    egal(defaultRelicMainChoice(undefined), 'libre', 'monstre sans relique → défaut « libre »');
    egal(
      defaultRelicMainChoice({ id: 7, upgrade: 6, main: { code: 100, value: 11 } }),
      'equipped',
      'monstre AVEC relique → défaut « equipped »'
    );
  }

  // `recipeToRelicIntent` (CLI) applique les mêmes défauts qu'un écran qui
  // câblerait `defaultRelicMainChoice` (lot 5c) — même recette, mêmes
  // réglages résolus, qu'il y ait ou non une relique portée.
  {
    const recetteAncienne = recetteDeBase();
    const sansRelique = recipeToRelicIntent(recetteAncienne, monstreCharge(undefined));
    egal(sansRelique, { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 }, 'sans relique portée : intention « libre » par défaut, seuil D2 (+6)');

    const avecRelique = recipeToRelicIntent(recetteAncienne, monstreCharge({ id: 7, upgrade: 6, main: { code: 100, value: 11 } }));
    egal(avecRelique, { mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, 'avec relique portée : intention « equipped » par défaut');

    // Interrupteur coupé (`ignoreArtifacts`) : mode « off », quelle que soit
    // la relique portée — pas d'interrupteur propre à la relique (T2).
    const interrupteurCoupe = recipeToRelicIntent({ ...recetteAncienne, ignoreArtifacts: true }, monstreCharge({ id: 7, upgrade: 6, main: { code: 100, value: 11 } }));
    egal(interrupteurCoupe.mode, 'off', "« Activer l'optimisation d'artéfacts » coupé : mode « off » pour la relique aussi (D1)");
  }
}
