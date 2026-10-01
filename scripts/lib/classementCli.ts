// Le classement du CLI (`optimizer-search.ts`) une fois l'équipement de
// chaque build résolu — comme l'écran classe le cache de sa file
// (degats-et-aura 6bis-b5c). Aucune étape n'est réimplémentée ici : la
// résolution est `resoudreEquipementCli` (recipeToSearchParams.ts, par
// `entreeResolutionDuBuild` + `resoudreEquipementDuBuild`), les options
// `optionsDeClassement`, le classement `classementResolu` — les producteurs
// mêmes de l'écran.
//
// ⚠️ **Différence assumée avec l'écran : le CLI résout TOUS les candidats
// collectés.** La file de l'écran ne résout que les 100 premiers de l'ordre de
// base et la page affichée (`K_BUILDS_OPTIMISES`, useArtifactOptimQueue.ts),
// en temps masqué. Le CLI n'a pas de page : il résout tout, en une passe, et
// rend donc le classement que l'écran atteint quand sa file a traité ce qu'il
// montre. Le coût de cette passe est rendu (`ms`) et imprimé.

import {
  BuildCandidate,
  OptionsDeClassement,
  RealDamageContext,
  SearchParams,
  aurasPropresParRunes,
  optionsDeClassement,
  sortCandidates,
} from '../../src/lib/runeBuildOptim';
import { ResultatArtefacts, classementResolu, cleBuild } from '../../src/lib/artifactQueue';
import { etatReliqueDuBuild } from '../../src/lib/relicQueue';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile } from '../../src/lib/damage';
import { OptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { LoadedMonster } from './loadMonster';
import { loadMonstersList } from './monstersData';
import { resoudreEquipementCli } from './recipeToSearchParams';

// Ce que les deux jeux d'options (ordre de base, classement résolu) ont en
// commun — tout sauf les deux accesseurs qui lisent le cache de résolution.
export type EntreesDuTri = Omit<Parameters<typeof optionsDeClassement>[0], 'artefactsDuBuild' | 'etatReliqueDe'>;

export interface ClassementResoluCli {
  // Le cache de résolution, par `cleBuild` — le pendant de `parBuild` de la file.
  parBuild: Map<string, ResultatArtefacts>;
  // Le classement affiché : non conformes écartés, stats de l'équipement
  // retenu, départage canonique, tri par l'objectif.
  classes: BuildCandidate[];
  // Les options de CE classement : le score imprimé est `scoreDuCandidat`
  // avec elles, la valeur même qui classe.
  options: OptionsDeClassement;
  // Builds sans couple faisable (`conforme: false`), écartés du classement.
  rejetes: number;
  // Durée de la passe de résolution, en millisecondes (une mesure, pas une
  // statistique : voir `optimizer-perf-testing` pour comparer).
  ms: number;
}

/**
 * Résout l'équipement de chaque candidat de `base` (l'ordre de base, déjà
 * trié par les options sans cache), puis le classe comme l'écran.
 * `null` là où l'écran n'a pas de file (`resoudreEquipementCli`) : le
 * classement affiché reste alors l'ordre de base.
 */
export function classerApresResolution(e: {
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  params: SearchParams;
  base: BuildCandidate[];
  entreesTri: EntreesDuTri;
}): ClassementResoluCli | null {
  const resoudre = resoudreEquipementCli(e.recipe, e.loaded, e.params);
  if (!resoudre) return null;
  const t0 = performance.now();
  const parBuild = new Map<string, ResultatArtefacts>();
  for (const c of e.base) parBuild.set(cleBuild(c), resoudre(c));
  const ms = performance.now() - t0;
  // Le profil d'artéfacts de CHAQUE build, comme `profilsParBuild` à l'écran :
  // ses stats viennent d'être recalculées avec sa vraie paire, ses lignes
  // d'effet doivent suivre.
  const profils = new Map([...parBuild].map(([cle, r]) => [cle, artifactDamageProfile(r.artefacts)]));
  const options = optionsDeClassement({
    ...e.entreesTri,
    artefactsDuBuild: (c) => profils.get(cleBuild(c)) ?? null,
    // L'expression même de l'écran (`etatReliqueDe`) : cache, contexte de la
    // recherche lancée, relique de la fiche (`SearchParams.relic`).
    etatReliqueDe: (c) => etatReliqueDuBuild(parBuild.get(cleBuild(c)), e.params.relicContext, e.params.relic),
  });
  const classes = classementResolu(e.base, parBuild, e.recipe.objective, options);
  let rejetes = 0;
  for (const r of parBuild.values()) if (!r.conforme) rejetes++;
  return { parBuild, classes, options, rejetes, ms };
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
 * base, puis la résolution de l'équipement de chaque build et le classement
 * de l'écran (`classerApresResolution`). `optimizer-search.ts` n'en fait
 * qu'imprimer le résultat.
 */
export function classerCommeLEcran(e: {
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  params: SearchParams;
  candidates: BuildCandidate[];
  realDamage: RealDamageContext | null;
}): ClassementCli {
  const { recipe, loaded, params } = e;
  const runeById = new Map(params.pool.map((r) => [r.id, r]));
  const setup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const entreesTri: EntreesDuTri = {
    realDamage: e.realDamage,
    damageSetup: setup,
    runeById,
    metric: recipe.metric,
    // Auras propres des six runes de chaque candidat (6bis-b2), comme l'écran.
    aurasPropresDe: aurasPropresParRunes(runeById),
    contexteExclusive: { setup, element: loadMonstersList().find((m) => m.com2usId === loaded.com2usId)?.element ?? null },
  };
  // ⚠️ Le MÊME producteur que l'écran (`optionsDeClassement`, 6bis-b5a) : un
  // champ ajouté d'un côté ne peut plus manquer de l'autre en silence. Ce sont
  // les options de l'ordre de BASE (`fullSortedCandidates` à l'écran), sans
  // cache de résolution : la paire de `params.artifacts`, déjà portée par
  // `realDamage`, pour tous ; `etatReliqueDuBuild` sans cache rend `fixe` en
  // `off`/`equipped` — la relique de la fiche, `params.relic`
  // (= `loaded.gear.relic`), celle dont le moteur a posé la principale dans
  // `c.stats` — et `en attente` en `recherche` : neutre, sans repli, comme
  // l'écran avant résolution.
  const optionsDuTri = optionsDeClassement({
    ...entreesTri,
    artefactsDuBuild: () => null,
    etatReliqueDe: () => etatReliqueDuBuild(undefined, params.relicContext, params.relic),
  });
  const base = sortCandidates(e.candidates, recipe.objective, optionsDuTri);
  const resolu = classerApresResolution({ recipe, loaded, params, base, entreesTri });
  return { base, optionsBase: optionsDuTri, resolu, classes: resolu?.classes ?? base, options: resolu?.options ?? optionsDuTri };
}
