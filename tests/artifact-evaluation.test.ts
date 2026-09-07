// Le score de la paire d'artéfacts REPRÉSENTATIVE pour l'objectif « PV
// effectifs » (`ehp`) n'est PAS une somme des deux principales — voir
// spec/outils/optimizer/cadrage-score-artefacts-ehp.md et
// spec/outils/optimizer/artefacts.md §12.0/§12.7.
//
// ⚠️ Deux niveaux, volontairement séparés :
// - `testArtifactEvaluation` isole le helper partagé (`evaluerPourRegime`) —
//   vérifie la FORMULE, avec un `statsAvec` construit à la main.
// - `testArtifactPaireReelleEhp` exerce le VRAI chemin CLI
//   (`resolveArtifacts`/`paireReelle`, scripts/lib/recipeToSearchParams.ts)
//   via un `LoadedMonster` réel — sans ce second niveau, une régression dans
//   la construction de `statsAvec` côté CLI (mauvais monstre, `loaded.gear`
//   mal câblé…) ne serait jamais détectée par le premier, qui ne passe
//   jamais par `loadMonstersList()`/`statsParPaire(loaded.gear)`.

import { ArtifactDetail, ElementKey, GearSet } from '../src/types';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { statsParPaire } from '../src/lib/stats';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { resolveArtifacts } from '../scripts/lib/recipeToSearchParams';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';

// Camilla (water/hp) — le monstre du cas mesuré, spec/outils/optimizer/
// artefacts.md §12.0. Réel : nécessaire pour que `loadMonstersList().find`
// (dans `paireReelle`) le retrouve, et pour que l'éligibilité élément/
// archétype filtre pour de vrai.
const CAMILLA_COM2USID = 13811;

const artefactElement = (id: number, element: ElementKey, code: number, value: number): ArtifactDetail => ({
  id,
  kind: 'element',
  element,
  level: 15,
  rarity: 5,
  main: { code, value },
  subs: [],
});
const artefactArchetype = (id: number, code: number, value: number): ArtifactDetail => ({
  id,
  kind: 'archetype',
  archetype: 'hp',
  level: 15,
  rarity: 5,
  main: { code, value },
  subs: [],
});

// Base gonflée pour amplifier l'écart et le rendre vérifiable à la main (voir
// le calcul dans le cadrage) — indépendante des vraies stats de Camilla,
// seuls son élément et son archétype servent à l'éligibilité.
const BASE_GONFLEE = { hp: 30000, atk: 1000, def: 1500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export default function testArtifactEvaluation() {
  titre('evaluerPourRegime — PV effectifs n’est pas une somme des principales');

  const gear: GearSet = { base: BASE_GONFLEE, runes: [], artifacts: [] };
  const statsAvec = statsParPaire(gear);
  const evaluer = evaluerPourRegime('ehp', statsAvec);

  const deuxPv = [artefactElement(1, 'water', 100, 1500), artefactArchetype(2, 100, 1500)];
  const defEtPv = [artefactElement(3, 'water', 102, 100), artefactArchetype(4, 100, 1500)];

  const sommeDeuxPv = deuxPv.reduce((n, a) => n + a.main.value, 0);
  const sommeDefEtPv = defEtPv.reduce((n, a) => n + a.main.value, 0);
  ok(sommeDeuxPv > sommeDefEtPv, `témoin : la somme des principales préfère 2×PV+1500 (${sommeDeuxPv} > ${sommeDefEtPv})`);

  const ehpDeuxPv = evaluer(deuxPv);
  const ehpDefEtPv = evaluer(defEtPv);
  ok(
    ehpDefEtPv > ehpDeuxPv,
    `mais DEF+100/PV+1500 donne PLUS de PV effectifs que PV+1500×2 (${ehpDefEtPv.toFixed(1)} > ${ehpDeuxPv.toFixed(1)}) — la somme classerait la meilleure paire comme la pire`
  );
}

export function testArtifactPaireReelleEhp() {
  titre('resolveArtifacts (CLI) — objectif « PV effectifs », vrai chemin de construction');

  const loaded: LoadedMonster = {
    unitId: 1,
    com2usId: CAMILLA_COM2USID,
    monsterName: 'Camilla (test)',
    gear: { base: BASE_GONFLEE, runes: [], artifacts: [] },
    allRunes: [],
    allArtifacts: [
      artefactElement(1, 'water', 100, 1500), // PV +1500, éligible (élément)
      artefactElement(2, 'water', 102, 100), // DEF +100, éligible (élément)
      artefactArchetype(3, 100, 1500), // PV +1500, éligible (archétype hp)
    ],
  };

  const recipe = buildOptimizerRecipe({
    monsterCom2usId: CAMILLA_COM2USID,
    monsterName: 'Camilla (test)',
    requirement: { sets: [], minStats: {} },
    objective: 'ehp',
    damageSetup: DEFAULT_DAMAGE_SETUP,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'rta',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' },
  });

  const paire = resolveArtifacts(recipe, loaded);
  const mains = paire.map((a) => `${a.main.code}:${a.main.value}`).sort();
  egal(
    mains,
    ['100:1500', '102:100'].sort(),
    `la paire réelle choisit DEF+100/PV+1500 (meilleurs PV effectifs), pas PV+1500×2 — reçu ${JSON.stringify(mains)}`
  );
}
