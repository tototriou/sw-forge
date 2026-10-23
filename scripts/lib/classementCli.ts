// Le classement du CLI (`optimizer-search.ts`) une fois l'équipement de
// chaque build résolu — comme l'écran classe le cache de sa file.
// Aucune étape n'est réimplémentée ici : la
// résolution est `resoudreEquipementCli` (recipeToSearchParams.ts, par
// `entreeResolutionDuBuild` + `resoudreEquipementDuBuild`), les options
// `optionsDeClassement`, le classement `classementResolu` — les producteurs
// mêmes de l'écran.
//
// ⚠️ **Par défaut, le CLI résout COMME LA FILE DE L'ÉCRAN** : l'ordre
// de base jusqu'à K combinaisons CONFIRMÉES (résolues et conformes) ou
// jusqu'au dernier build trouvé — `kDeLaFile` du contexte relique de la
// recherche, comme l'écran : 300 en mode « recherche », 100 sinon,
// des confirmées — et sa « page affichée » — les
// `LIGNES_IMPRIMEES` lignes qu'il imprime —, choisis par `prochainsATraiter`,
// la fonction pure de la file, jusqu'au point fixe.
// Résoudre TOUS les candidats collectés coûtait jusqu'à 20 fois la recherche
// avec des artéfacts « Libre » (le défaut de l'écran) : 6,7 min pour 5 100
// builds × 4 reliques. Cette résolution exhaustive reste disponible,
// explicitement (`--resoudre-tout`).
//
// ⚠️ La file de l'écran traite UN build par tranche, avec une page publiée au
// plus toutes les 400 ms ; le CLI traite par LOTS, page recalculée entre deux
// lots. La condition d'arrêt est la même — plus rien à résoudre parmi la page
// et la fenêtre de fond (K confirmées) —, mais l'écran peut avoir résolu en
// chemin des builds passés un instant sur sa page, que le CLI ne résout pas.

import {
  BuildCandidate,
  OptionsDeClassement,
  RealDamageContext,
  SearchParams,
  aurasPropresParRunes,
  optionsDeClassement,
} from '../../src/lib/runeBuildOptim';
import { CacheResolutionJournalise, ResultatArtefacts, cibleDeLaFile, classementResolu, cleBuild, prochainsATraiter } from '../../src/lib/artifactQueue';
import { contexteResultat, optionsDuContexte } from '../../src/lib/contexteResultat';
import { ordreCollecte } from '../../src/lib/classementCompact';
import { regimeArtefacts, regimeEquipementDe } from '../../src/lib/artifactEvaluation';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';
import { OptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { LoadedMonster } from './loadMonster';
import { loadMonstersList } from './monstersData';
import { artefactsDuCli, resoudreEquipementCli, toutVerifierDeLaRecette } from './recipeToSearchParams';

export function contexteDeResultatCli(recipe: OptimizerRecipe, loaded: LoadedMonster, params: SearchParams, realDamage: RealDamageContext | null) {
  const a = recipe.ignoreArtifacts ? null : artefactsDuCli(recipe, loaded);
  const setup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const exclusive = { setup, element: a?.element ?? loadMonstersList().find((m) => m.com2usId === loaded.com2usId)?.element ?? null };
  return contexteResultat({ params, fiche: loaded.gear, realDamage, damageSetup: setup, exclusive, idInventaire: 0, idEspece: loaded.com2usId,
    signature: JSON.stringify([params.requirement, recipe.damageSetup, recipe.artifactMainByKind, recipe.lignesVerrouillees]),
    resolution: a ? { fiche: loaded.gear, artifactParams: a.params,
      regime: regimeEquipementDe(regimeArtefacts(recipe.objective), a.degats !== null), degats: a.degats, exclusive,
      requirement: params.requirement, relicContext: params.relicContext } : null });
}

// Ce que les deux jeux d'options (ordre de base, classement résolu) ont en
// commun — tout sauf les deux accesseurs qui lisent le cache de résolution.
export type EntreesDuTri = Omit<Parameters<typeof optionsDeClassement>[0], 'artefactsDuBuild' | 'etatReliqueDe'>;

// Les lignes que le CLI imprime : sa « page affichée », celle que la file
// sert en priorité, comme la page de l'écran.
export const LIGNES_IMPRIMEES = 20;

export interface ClassementResoluCli {
  // `file` (défaut) : comme la file de l'écran ; `tout` : `--resoudre-tout`.
  mode: 'file' | 'tout';
  // La cible de la file en mode `file`, en combinaisons CONFIRMÉES
  // (`cibleDeLaFile` : `kDeLaFile` du contexte relique de la recherche, ou
  // `Infinity` avec « Vérifier toutes les combinaisons trouvées » dans la
  // recette) — celle que la console cite.
  K: number;
  // Le cache de résolution, par `cleBuild` — le pendant de `parBuild` de la
  // file. En mode `file`, seuls les builds résolus y figurent ; les autres
  // gardent leurs stats de base (relique neutre en mode `recherche`).
  parBuild: Map<string, ResultatArtefacts>;
  // Le classement affiché : non conformes écartés, stats de l'équipement
  // retenu, départage canonique, tri par l'objectif.
  classes: BuildCandidate[];
  // Les options de CE classement : le score imprimé est `scoreDuCandidat`
  // avec elles, la valeur même qui classe.
  options: OptionsDeClassement;
  // Builds sans couple faisable (`conforme: false`), écartés du classement.
  rejetes: number;
  // Lots traités jusqu'au point fixe (1 en mode `tout`).
  lots: number;
  // Durée de la passe de résolution, en millisecondes (une mesure, pas une
  // statistique : voir `optimizer-perf-testing` pour comparer).
  ms: number;
}

/**
 * Résout l'équipement des candidats de `base` (l'ordre de base, déjà trié
 * par les options sans cache), puis les classe comme l'écran.
 *
 * - `toutResoudre` faux (défaut du script) : comme la file de l'écran. À
 *   chaque lot, `prochainsATraiter` — les `LIGNES_IMPRIMEES` premières du
 *   classement courant, puis l'ordre de base jusqu'à K confirmées
 *   (`kDeLaFile(params.relicContext)`, la fonction de l'écran : 300 en mode
 *   relique « recherche », 100 sinon ; tous avec « Vérifier toutes les
 *   combinaisons trouvées » dans la recette, `cibleDeLaFile`), déjà résolus
 *   exclus — ; on s'arrête quand le lot est vide : toutes les lignes
 *   imprimées sont résolues, et K confirmées atteintes ou tout l'ordre de
 *   base résolu.
 * - `toutResoudre` vrai : tous les candidats, en une passe.
 *
 * `null` là où l'écran n'a pas de file (`resoudreEquipementCli`) : le
 * classement affiché reste alors l'ordre de base.
 */
export function classerApresResolution(e: {
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  params: SearchParams;
  base: BuildCandidate[];
  entreesTri: EntreesDuTri;
  toutResoudre: boolean;
}): ClassementResoluCli | null {
  const resoudre = resoudreEquipementCli(e.recipe, e.loaded, e.params);
  if (!resoudre) return null;
  const parBuild = new CacheResolutionJournalise();
  const contexte = contexteDeResultatCli(e.recipe, e.loaded, e.params, e.entreesTri.realDamage);
  const options = optionsDuContexte(contexte, parBuild, e.recipe.metric);
  // Le contexte de la recherche LANCÉE, comme `relicContextRecherche` à
  // l'écran : jamais relu dans la recette. L'interrupteur « Vérifier toutes les
  // combinaisons trouvées », lui, vient de la recette, comme l'écran le lit
  // dans ses réglages : tous les candidats, dans l'ordre de base.
  const K = cibleDeLaFile({ relicContext: e.params.relicContext, toutVerifier: toutVerifierDeLaRecette(e.recipe) });
  const t0 = performance.now();
  let lots = 0;
  if (e.toutResoudre) {
    for (const c of e.base) parBuild.set(cleBuild(c), resoudre(c));
    lots = 1;
  } else {
    // Chaque lot résout au moins un build nouveau : la boucle s'arrête au
    // plus tard quand tout est résolu.
    for (;;) {
      const page = classementResolu(e.base, parBuild.publier(), e.recipe.objective, options).slice(0, LIGNES_IMPRIMEES);
      const lot = prochainsATraiter(e.base, parBuild, K, page);
      if (lot.length === 0) break;
      for (const c of lot) parBuild.set(cleBuild(c), resoudre(c));
      lots++;
    }
  }
  const ms = performance.now() - t0;
  const classes = classementResolu(e.base, parBuild.publier(), e.recipe.objective, options);
  let rejetes = 0;
  for (const r of parBuild.values()) if (!r.conforme) rejetes++;
  return { mode: e.toutResoudre ? 'tout' : 'file', K, parBuild, classes, options, rejetes, lots, ms };
}

export interface ClassementCli {
  // L'ordre de BASE (`fullSortedCandidates` à l'écran) et ses options.
  base: BuildCandidate[];
  optionsBase: OptionsDeClassement;
  // La résolution, `null` là où l'écran n'a pas de file.
  resolu: ClassementResoluCli | null;
  // Le classement affiché et ses options : celles de la résolution quand
  // elle a lieu, l'ordre de base sinon.
  classes: BuildCandidate[];
  options: OptionsDeClassement;
}

/**
 * Le classement complet du CLI, depuis les candidats collectés : l'ordre de
 * base, puis la résolution de l'équipement — comme la file de l'écran, ou de
 * tous les candidats avec `toutResoudre` — et le classement de l'écran
 * (`classerApresResolution`). `optimizer-search.ts` n'en fait qu'imprimer le
 * résultat.
 */
export function classerCommeLEcran(e: {
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  params: SearchParams;
  candidates: BuildCandidate[];
  realDamage: RealDamageContext | null;
  toutResoudre: boolean;
}): ClassementCli {
  const { recipe, loaded, params } = e;
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  const setup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const entreesTri: EntreesDuTri = {
    realDamage: e.realDamage,
    damageSetup: setup,
    runeById,
    metric: recipe.metric,
    // Auras propres des six runes de chaque candidat, comme l'écran.
    aurasPropresDe: aurasPropresParRunes(runeById),
    contexteExclusive: { setup, element: loadMonstersList().find((m) => m.com2usId === loaded.com2usId)?.element ?? null },
  };
  const photo = contexteDeResultatCli(recipe, loaded, params, e.realDamage);
  const optionsBase = optionsDuContexte(photo, null, recipe.metric);
  const base = Array.from(ordreCollecte(e.candidates, recipe.objective, optionsBase), (i) => e.candidates[i]);
  const resolu = classerApresResolution({ recipe, loaded, params, base, entreesTri, toutResoudre: e.toutResoudre });
  return { base, optionsBase, resolu, classes: resolu?.classes ?? base, options: resolu?.options ?? optionsBase };
}
