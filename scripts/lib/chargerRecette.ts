// De « une recette exportée par l'écran + un export de compte » à un
// `SearchParams` prêt à lancer — la séquence exacte que suivait
// `optimizer-search.ts`, extraite ici pour qu'un second outil (le harnais de
// diagnostic) n'ait pas à la recopier.
//
// ⚠️ **Ce n'est pas une commodité, c'est une exigence de fidélité.** Cette
// séquence porte cinq décisions qu'un appelant qui la refait à la main rate
// silencieusement : le repli d'un objectif RETIRÉ (une recette ancienne peut
// encore le porter), le choix du bon chargeur (box / RTA / siège), le
// contrôle de `com2usId` (même nom ≠ même monstre), le chargement CONDITIONNEL
// des données d'exclusion, et `recipeToSearchParams` lui-même — qui résout
// `artifactBounds` et `objectiveStats` comme l'écran. C'est exactement la
// classe d'erreur que le harnais existe pour supprimer (voir
// spec/outils/optimizer/harnais-diagnostic.md).
//
// ⚠️ **Chargement seulement, jamais d'affichage.** Les messages détaillés de
// `optimizer-search.ts` (sort de dégâts réels retenu, comptes de runes
// exclues…) restent chez lui : ce module rend des `avertissements` que
// l'appelant imprime comme il l'entend — un outil qui produit du JSON ne doit
// pas se retrouver avec du texte sur la sortie standard.

import { readFileSync } from 'fs';
import { OptimizerRecipe, parseOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { SearchParams } from '../../src/lib/runeBuildOptim';
import { ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import {
  LoadedMonster,
  loadBoxItemsForExclusion,
  loadBoxMonster,
  loadRtaEntriesForExclusion,
  loadRtaMonster,
  loadSiegeMonster,
  loadSiegeTeamsForExclusion,
} from './loadMonster';
import { recipeToSearchParams } from './recipeToSearchParams';

/**
 * D'où vient le build du monstre — les trois sources que l'écran propose.
 * ⚠️ Un seul mode à la fois : ils ne se combinent pas.
 */
export type ModeChargement =
  | { type: 'box' }
  | { type: 'rta' }
  | { type: 'siege'; deckId: number; defense: boolean };

export interface RecetteChargee {
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  /** Absent quand la recette n'exclut rien — les 4 lectures de fichier que
   *  ça coûte n'ont alors aucune raison d'être payées. */
  exclusionData?: ExclusionSourceData;
  params: SearchParams;
  /** À imprimer par l'appelant. Jamais vide sans raison : chaque entrée
   *  signale quelque chose qui rend le run moins fidèle à l'écran. */
  avertissements: string[];
  /** Le libellé du mode, pour les résumés (`box`, `RTA`, `siège`). */
  modeLabel: string;
}

/**
 * ⚠️ Lève une `Error` sur recette illisible ou monstre introuvable, plutôt
 * que d'appeler `process.exit` : un module de bibliothèque ne décide pas de
 * la fin du processus de son appelant.
 */
export function chargerRecette(
  cheminCompte: string,
  cheminRecette: string,
  mode: ModeChargement = { type: 'box' }
): RecetteChargee {
  const avertissements: string[] = [];

  const { recipe, error } = parseOptimizerRecipe(readFileSync(cheminRecette, 'utf8'));
  if (!recipe) throw new Error(`Recette invalide : ${error}`);

  // ⚠️ Un objectif RETIRÉ (`speed_nuker`, `degats`) peut encore apparaître
  // dans une recette exportée avant son retrait — `parseOptimizerRecipe` ne
  // valide pas `objective` contre le type. Même repli que l'écran
  // (`importRecipe`, OptimizerSection.tsx) : sans lui, un outil divergerait du
  // chemin de prod sur toute recette ancienne.
  const objectifLegacy = recipe.objective as unknown as string;
  if (objectifLegacy === 'speed_nuker' || objectifLegacy === 'degats') {
    avertissements.push(`Objectif retiré « ${objectifLegacy} » dans la recette — repli sur « efficience » (comme l'écran).`);
    recipe.objective = 'efficience';
  }

  const loaded =
    mode.type === 'rta'
      ? loadRtaMonster(cheminCompte, recipe.monsterName)
      : mode.type === 'siege'
        ? loadSiegeMonster({ exportPath: cheminCompte, deckId: mode.deckId, monsterName: recipe.monsterName, defense: mode.defense, rest: [] })
        : loadBoxMonster(cheminCompte, recipe.monsterName);
  const modeLabel = mode.type === 'rta' ? 'RTA' : mode.type === 'siege' ? 'siège' : 'box';

  // Même nom, pas forcément le même monstre (homonymes de données,
  // traductions) — le `com2usId` est la clé stable.
  if (loaded.com2usId !== recipe.monsterCom2usId) {
    avertissements.push(
      `com2usId chargé (${loaded.com2usId}) ≠ com2usId de la recette (${recipe.monsterCom2usId}) — ` +
        `même nom, mais peut-être pas le même monstre. Vérifier avant de faire confiance au résultat.`
    );
  }

  // Chargée SEULEMENT si la recette en a besoin : 4 lectures/parsages de
  // l'export qu'une recette sans aucune exclusion n'a pas à payer.
  let exclusionData: ExclusionSourceData | undefined;
  if (recipe.excludeUsedRunes || (recipe.excludedSelectors && recipe.excludedSelectors.length > 0)) {
    const box = loadBoxItemsForExclusion(cheminCompte);
    exclusionData = {
      box,
      rtaEntries: loadRtaEntriesForExclusion(cheminCompte),
      siegeDefenseTeams: loadSiegeTeamsForExclusion(cheminCompte, true),
      siegeOffenseTeams: loadSiegeTeamsForExclusion(cheminCompte, false),
      monsterById: new Map(box.map((b) => [String(b.monster.id), b.monster])),
    };
    // ⚠️ `SiegeTeam.id` est RÉGÉNÉRÉ aléatoirement à chaque chargement (voir
    // loadMonster.ts) : un sélecteur d'exclusion siège exporté depuis l'écran
    // porte un `teamId` qui ne correspondra JAMAIS à celui reconstruit ici.
    // Il sera ignoré en silence par `resolveExcludedRuneIds` — donc pool plus
    // LARGE qu'à l'écran, ce qui doit se dire.
    const selecteursSiege = (recipe.excludedSelectors ?? []).filter(
      (s) => s.source === 'siege-defense' || s.source === 'siege-offense'
    );
    if (selecteursSiege.length > 0) {
      avertissements.push(
        `${selecteursSiege.length} exclusion(s) manuelle(s) venant du Siège ne peuvent PAS être résolues hors de l'écran ` +
          `(identifiants d'équipe régénérés à chaque chargement) — elles seront ignorées, donc pool plus large qu'à l'écran.`
      );
    }
  }

  return {
    recipe,
    loaded,
    exclusionData,
    params: recipeToSearchParams(recipe, loaded, exclusionData),
    avertissements,
    modeLabel,
  };
}
