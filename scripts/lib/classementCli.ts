// Le CLI consomme le propriétaire de production sans Worker : mêmes notes,
// mêmes notes et choix de file, pour sa page de lignes imprimées.
import type { BuildCandidate, OptionsDeClassement, RealDamageContext, SearchParams } from '../../src/lib/runeBuildOptim';
import { cibleDeLaFile, type ResultatArtefacts } from '../../src/lib/artifactQueue';
import { contexteResultat, optionsDuContexte } from '../../src/lib/contexteResultat';
import { classerEnLocal } from '../../src/lib/classementCompact';
import { triDesResultats } from '../../src/lib/colonnesResultats';
import { regimeArtefacts, regimeEquipementDe } from '../../src/lib/artifactEvaluation';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import type { OptimizerRecipe } from '../../src/lib/optimizerRecipe';
import type { LoadedMonster } from './loadMonster';
import { loadMonstersList } from './monstersData';
import { artefactsDuCli, toutVerifierDeLaRecette } from './recipeToSearchParams';

export function contexteDeResultatCli(recipe: OptimizerRecipe, loaded: LoadedMonster, params: SearchParams, realDamage: RealDamageContext | null, toutVerifier = toutVerifierDeLaRecette(recipe)) {
  const a = recipe.ignoreArtifacts ? null : artefactsDuCli(recipe, loaded);
  const setup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const exclusive = { setup, element: a?.element ?? loadMonstersList().find((m) => m.com2usId === loaded.com2usId)?.element ?? null };
  return contexteResultat({ params, fiche: loaded.gear, realDamage, damageSetup: setup, exclusive, idInventaire: 0, idEspece: loaded.com2usId, toutVerifier,
    signature: JSON.stringify([params.requirement, recipe.damageSetup, recipe.artifactMainByKind, recipe.lignesVerrouillees]),
    resolution: a ? { fiche: loaded.gear, artifactParams: a.params,
      regime: regimeEquipementDe(regimeArtefacts(recipe.objective), a.degats !== null), degats: a.degats, exclusive,
      requirement: params.requirement, relicContext: params.relicContext } : null });
}

export const LIGNES_IMPRIMEES = 20;

export interface ClassementResoluCli {
  mode: 'file' | 'tout';
  K: number;
  parBuild: Map<string, ResultatArtefacts>;
  classes: BuildCandidate[];
  options: OptionsDeClassement;
  // Rejetés : notés, ou jugés par la confirmation en fond (le même résultat).
  rejetes: number;
  // Builds confirmés conformes en fond, sans note : hors de `parBuild`.
  confirmeesSansNote: number;
  // Lots d'une résolution, comme les tâches de la file du propriétaire.
  lots: number;
  ms: number;
}

export interface ClassementCli {
  base: BuildCandidate[];
  optionsBase: OptionsDeClassement;
  resolu: ClassementResoluCli | null;
  classes: BuildCandidate[];
  options: OptionsDeClassement;
}

/** La page imprimée est la première vue du même corps que le Worker. */
export function classerCommeLEcran(e: {
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  params: SearchParams;
  candidates: BuildCandidate[];
  realDamage: RealDamageContext | null;
  toutResoudre: boolean;
}): ClassementCli {
  const { recipe, loaded, params } = e;
  const photo = contexteDeResultatCli(recipe, loaded, params, e.realDamage, e.toutResoudre || toutVerifierDeLaRecette(recipe));
  const debut = performance.now();
  const publication = classerEnLocal(photo, e.candidates, {
    tri: triDesResultats(recipe.objective), metric: recipe.metric, page: 1, pageImprimee: true,
  });
  const ms = performance.now() - debut;
  const optionsBase = optionsDuContexte(photo, null, recipe.metric);
  const options = optionsDuContexte(photo, publication.parBuild, recipe.metric);
  let resolu: ClassementResoluCli | null = null;
  if (photo.resolution) {
    const K = cibleDeLaFile({ relicContext: params.relicContext, toutVerifier: toutVerifierDeLaRecette(recipe) });
    let rejetes = 0;
    for (const r of publication.parBuild.values()) if (!r.conforme) rejetes++;
    resolu = { mode: e.toutResoudre ? 'tout' : 'file', K, parBuild: publication.parBuild,
      classes: publication.affichees, options, rejetes, confirmeesSansNote: publication.confirmeesSansNote.length, lots: publication.parBuild.size, ms };
  }
  return { base: publication.base, optionsBase, resolu, classes: publication.affichees, options: resolu ? options : optionsBase };
}
