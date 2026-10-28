// Le réglage de rétention retiré se lit sans perte dans les recettes et sessions historiques.
import { BaseStats } from '../src/types';
import { BuildRequirement, SLOT_FILTER_PRESETS } from '../src/lib/runeBuildOptim';
import { composerSession, ecrireSession, lireSession } from '../src/lib/session';
import { OptimizerRecipe, buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { SlotFilterPresetKey } from '../src/hooks/useOptimizerState';
import { recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const EXIGENCE: BuildRequirement = { sets: ['violent'], minStats: { spd: 200, cr: 80, cd: 150 } };
const POOL = randomPool(mulberry32(2101), 45, SETS_JOKER);

const LOADED: LoadedMonster = {
  unitId: 1, com2usId: 13413, monsterName: 'Monstre (test)',
  gear: { base: BASE, runes: [], artifacts: [], relic: undefined },
  allRunes: POOL, allArtifacts: [], allRelics: [],
};

function recette(preset: SlotFilterPresetKey): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: 13413, monsterName: 'Monstre (test)', requirement: EXIGENCE, objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: preset,
    exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: true, artifactMainByKind: { element: 'libre', archetype: 'libre' },
  });
}

function recetteAncienne() {
  const actuelle = recette('haut');
  const reference = parseOptimizerRecipe(JSON.stringify(actuelle));
  ok(reference.recipe !== null, 'recette de référence lisible');
  ok(!('adaptiveTrancheWeighting' in actuelle), 'nouvelle recette : champ retiré absent');
  for (const champ of [true, false]) {
    const lue = parseOptimizerRecipe(JSON.stringify({ ...actuelle, adaptiveTrancheWeighting: champ }));
    ok(lue.recipe !== null && lue.error === undefined, `recette ancienne (${champ}) : importée sans erreur`);
    ok(lue.avertissements === undefined, `recette ancienne (${champ}) : aucun avertissement`);
    egal(lue.recipe, reference.recipe, `recette ancienne (${champ}) : mêmes valeurs utiles, champ retiré absent`);
    egal(recipeToSearchParams(lue.recipe!, LOADED), recipeToSearchParams(reference.recipe!, LOADED),
      `recette ancienne (${champ}) : mêmes SearchParams au CLI`);
    const { version: _version, ...entree } = lue.recipe!;
    ok(!('adaptiveTrancheWeighting' in JSON.parse(JSON.stringify(buildOptimizerRecipe(entree)))),
      `recette ancienne (${champ}) : réexport sans champ retiré`);
  }
}

function sessionAncienne() {
  const actuelle = composerSession({
    maintenant: new Date('2026-10-01T00:00:00Z'), versionApp: 'test', stockage: {}, compte: null, memoire: {},
    optimizer: { selectedId: '13413', comboSets: ['violent'], minStats: EXIGENCE.minStats,
      damageSetup: DEFAULT_DAMAGE_SETUP, exhaustiveSearch: true, slotFilterPreset: 'haut', sortBy: 'efficience' },
  });
  const reference = lireSession(ecrireSession(actuelle));
  ok(reference.ok, 'session de référence lisible');
  for (const champ of [true, false]) {
    // Ajout APRÈS composition : fichier historique avant le filtre de lecture.
    const texte = JSON.stringify({ ...actuelle,
      outils: { ...actuelle.outils, optimizer: { ...actuelle.outils.optimizer, adaptiveTrancheWeighting: champ } } });
    const lue = lireSession(texte);
    ok(lue.ok, `session ancienne (${champ}) : lue sans erreur`);
    if (!lue.ok || !reference.ok) continue;
    egal(lue.avertissements, [], `session ancienne (${champ}) : aucun avertissement`);
    egal(lue.session, reference.session, `session ancienne (${champ}) : même état restauré, champ retiré absent`);
    ok(!('adaptiveTrancheWeighting' in JSON.parse(ecrireSession(lue.session)).outils.optimizer),
      `session ancienne (${champ}) : réexport sans champ retiré`);
  }
}

function prefiltrageSeul() {
  const reference = recipeToSearchParams(recette('moyen'), LOADED);
  for (const cle of ['haut', 'extreme'] as const) {
    const preset = SLOT_FILTER_PRESETS.find((p) => p.key === cle)!;
    const params = recipeToSearchParams(recette(cle), LOADED);
    egal(params.slotFilterCap, preset.cap, `${preset.label} : slotFilterCap = ${preset.cap}`);
    const { slotFilterCap: _a, ...reste } = params;
    const { slotFilterCap: _b, ...resteReference } = reference;
    ok(JSON.stringify(reste) === JSON.stringify(resteReference),
      `${preset.label} : mêmes SearchParams que Moyen, hors pré-filtrage`);
  }
}

export default function testPrioriteStatsRetiree() {
  titre('Optimizer · « Prioriser les stats les plus difficiles » retiré du moteur');
  sessionAncienne();
  recetteAncienne();
  prefiltrageSeul();
}
