// « Prioriser les stats les plus difficiles » est retiré du moteur
// (docs/04-decisions/adr/retention-a-parts-egales.md) :
// - le moteur rend le même résultat, champ `SearchParams.adaptiveTrancheWeighting`
//   vrai ou faux, aux préréglages Haut et Extrême et sous un plafond de
//   rétention minuscule (override de mesure), là où l'ancienne répartition
//   changeait la capacité de chaque tranche par stat ;
// - une recette qui porte le champ s'importe sans erreur, et le CLI ne le
//   relaie plus au moteur ;
// - en recette, Haut et Extrême ne changent que le pré-filtrage
//   (`slotFilterCap`), rien d'autre des `SearchParams`.
//
// L'écran garde son interrupteur, sans effet, jusqu'à son retrait : il n'est
// pas vérifié ici.

import { BaseStats } from '../src/types';
import { BuildRequirement, SearchParams, SearchResult, SLOT_FILTER_PRESETS } from '../src/lib/runeBuildOptim';
import { searchBuilds } from '../src/lib/rechercheRunes';
import { OptimizerRecipe, buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { SlotFilterPresetKey } from '../src/hooks/useOptimizerState';
import { recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
// Trois minimums et deux stats d'objectif : cinq tranches par stat, que
// l'ancienne répartition redistribuait.
const EXIGENCE: BuildRequirement = { sets: ['violent'], minStats: { spd: 200, cr: 80, cd: 150 } };
const POOL = randomPool(mulberry32(2101), 45, SETS_JOKER);

/** Ce qu'un résultat a d'observable : candidats dans l'ordre, compte, troncature, quasi-succès. */
function empreinte(r: SearchResult): string {
  return JSON.stringify({
    candidats: r.candidates.map((c) => ({ ids: c.runeIds, stats: c.stats, effTotal: c.effTotal })),
    explored: r.explored,
    truncated: r.truncated,
    parCondition: r.nearMissByCondition,
    global: r.globalNearMiss,
  });
}

function parametres(slotFilterCap: number, bucketCap: number | undefined, champ: boolean | undefined): SearchParams {
  return {
    base: BASE, artifacts: [], pool: POOL, requirement: EXIGENCE, metric: 'eff',
    objective: 'efficience', objectiveStats: ['atk', 'cd'], slotFilterCap, maxMs: Number.POSITIVE_INFINITY,
    ...(bucketCap != null ? { bucketCap } : {}),
    ...(champ != null ? { adaptiveTrancheWeighting: champ } : {}),
  };
}

function moteurInsensibleAuChamp() {
  for (const cle of ['haut', 'extreme'] as const) {
    const preset = SLOT_FILTER_PRESETS.find((p) => p.key === cle)!;
    // `undefined` : le bucketCap que le préréglage dérive (chemin de
    // production) ; 7 et 50 : évictions forcées, où l'ancienne répartition
    // gardait d'autres demi-builds.
    for (const bucketCap of [undefined, 7, 50]) {
      const sans = searchBuilds(parametres(preset.cap, bucketCap, undefined));
      const faux = searchBuilds(parametres(preset.cap, bucketCap, false));
      const vrai = searchBuilds(parametres(preset.cap, bucketCap, true));
      const libelle = `${preset.label}, bucketCap ${bucketCap ?? 'dérivé'}`;
      ok(sans.candidates.length > 0, `${libelle} : la recherche trouve des builds (${sans.candidates.length})`);
      ok(empreinte(faux) === empreinte(sans), `${libelle} : champ à faux = champ absent`);
      ok(empreinte(vrai) === empreinte(sans), `${libelle} : champ à vrai = champ absent (candidats, compte, quasi-succès)`);
    }
  }
}

const LOADED: LoadedMonster = {
  unitId: 1, com2usId: 13413, monsterName: 'Monstre (test)',
  gear: { base: BASE, runes: [], artifacts: [], relic: undefined },
  allRunes: POOL, allArtifacts: [], allRelics: [],
};

function recette(preset: SlotFilterPresetKey, champ: boolean): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: 13413, monsterName: 'Monstre (test)', requirement: EXIGENCE, objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: preset, adaptiveTrancheWeighting: champ,
    exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: true, artifactMainByKind: { element: 'libre', archetype: 'libre' },
  });
}

function recetteAncienne() {
  // Une recette exportée avec l'interrupteur coché, telle qu'un fichier la porte.
  const texte = JSON.stringify(recette('haut', true));
  const lue = parseOptimizerRecipe(texte);
  ok(lue.recipe !== null && lue.error === undefined, `recette qui porte adaptiveTrancheWeighting: true : importée sans erreur${lue.error ? ` (${lue.error})` : ''}`);
  ok(lue.avertissements === undefined, 'recette ancienne : aucune conversion annoncée');
  const params = recipeToSearchParams(lue.recipe!, LOADED);
  ok(!('adaptiveTrancheWeighting' in params), 'CLI : le champ de la recette ne part pas au moteur');
}

function prefiltrageSeul() {
  // Haut et Extrême, interrupteur coché comme l'écran le cochait, contre
  // Moyen décoché : seuls le pré-filtrage et le filet de temps de la recette
  // (identique ici) peuvent différer.
  const reference = recipeToSearchParams(recette('moyen', false), LOADED);
  for (const cle of ['haut', 'extreme'] as const) {
    const preset = SLOT_FILTER_PRESETS.find((p) => p.key === cle)!;
    const params = recipeToSearchParams(recette(cle, true), LOADED);
    egal(params.slotFilterCap, preset.cap, `${preset.label} : slotFilterCap = ${preset.cap}`);
    const { slotFilterCap: _a, ...reste } = params;
    const { slotFilterCap: _b, ...resteReference } = reference;
    ok(JSON.stringify(reste) === JSON.stringify(resteReference),
      `${preset.label} (interrupteur coché) : mêmes SearchParams que Moyen décoché, hors pré-filtrage`);
  }
}

export default function testPrioriteStatsRetiree() {
  titre('Optimizer · « Prioriser les stats les plus difficiles » retiré du moteur');
  moteurInsensibleAuChamp();
  recetteAncienne();
  prefiltrageSeul();
}
