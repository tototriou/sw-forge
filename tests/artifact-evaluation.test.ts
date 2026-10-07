// Le score de la paire d'artéfacts REPRÉSENTATIVE pour l'objectif « PV
// effectifs » (`ehp`) n'est PAS une somme des deux principales — voir
// spec/outils/optimizer/moteur/artefacts.md.
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

import { ArtifactDetail, ElementKey, GearSet, RelicDetail } from '../src/types';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { computeStats, statsParPaire } from '../src/lib/stats';
import { AUCUNE_AURA_PROPRE, DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { apportExclusive } from '../src/lib/relicExclusive';
import { scoreDeReference } from '../src/lib/runeBuildOptim';
import { resolveArtifacts } from '../scripts/lib/recipeToSearchParams';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';

// Camilla (water/hp) — le monstre du cas mesuré, spec/outils/optimizer/
// moteur/artefacts.md. Réel : nécessaire pour que `loadMonstersList().find`
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

// Base gonflée pour amplifier l'écart et le rendre vérifiable à la main
// ; indépendante des vraies stats de Camilla,
// seuls son élément et son archétype servent à l'éligibilité.
const BASE_GONFLEE = { hp: 30000, atk: 1000, def: 1500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export default function testArtifactEvaluation() {
  titre('evaluerPourRegime — PV effectifs n’est pas une somme des principales');

  const gear: GearSet = { base: BASE_GONFLEE, runes: [], artifacts: [] };
  const statsAvec = statsParPaire(gear);
  // `runes: []` : aucune aura propre, déclarée explicitement.
  const evaluer = evaluerPourRegime('ehp', statsAvec, AUCUNE_AURA_PROPRE);

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
    allRelics: [],
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

/*
 * La paire représentative du CLI en « Dégâts
 * réels » compte l'effet unique de la relique de la fiche, comme l'écran
 * (`evaluateursArtefactsFiche`). Avant : seule la représentative
 * EHP le comptait. Attente indépendante du
 * chemin CLI : la note de production de la fiche équipée de chaque pièce
 * (`scoreDeReference`).
 */
const LUSHEN_COM2USID = 13413;
const BASE_LUSHEN_TEST = { hp: 10000, atk: 1000, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export function testArtifactPaireReelleDegatsEffetUnique() {
  titre('resolveArtifacts (CLI) — « Dégâts réels » : effet unique de la relique de la fiche (6bis-b5c)');

  const artVent = (id: number, code: number, subs: [number, number][]): ArtifactDetail => ({
    id, kind: 'element', element: 'wind', level: 15, rarity: 5,
    main: { code, value: 100 }, subs: subs.map(([c, value]) => ({ code: c, value })),
  });
  // A : ATQ +100, aucune ligne. B : DEF +100, ligne 219 à 10 (dégâts
  // supplémentaires proportionnels, bucket Additionnel). Sans effet unique,
  // B donne plus de dégâts ; Conquête (type 1, Y = ATQ de début de combat,
  // tranche 1 500, 10 %) ne se déclenche qu'avec A.
  const A = artVent(1, 101, []);
  const B = artVent(2, 102, [[219, 10]]);
  const conquete: RelicDetail = { id: 9, upgrade: 9, main: { code: 102, value: 0 }, unique: { type: 1, tranche: 1500, percent: 10 } };
  const sansEffet: RelicDetail = { ...conquete, unique: undefined };

  const recipe = buildOptimizerRecipe({
    monsterCom2usId: LUSHEN_COM2USID,
    monsterName: 'Lushen (test)',
    requirement: { sets: [], minStats: {} },
    objective: 'degats_reels',
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
  const ctx = buildRealDamageContext(recipe, LUSHEN_COM2USID, []);
  if (!ctx) throw new Error('précondition : le sort par défaut de Lushen doit être calculable');
  const { artefacts: _profil, ...degats } = ctx;
  const ref = { degats, damageSetup: DEFAULT_DAMAGE_SETUP, exclusive: { setup: DEFAULT_DAMAGE_SETUP, element: 'wind' as const } };
  const fiche = (relic: RelicDetail, arts: ArtifactDetail[]): GearSet => ({ base: BASE_LUSHEN_TEST, runes: [], artifacts: arts, relic });
  const charge = (relic: RelicDetail): LoadedMonster => ({
    unitId: 1, com2usId: LUSHEN_COM2USID, monsterName: 'Lushen (test)',
    gear: fiche(relic, []), allRunes: [], allArtifacts: [A, B], allRelics: [relic],
  });

  const tranches = (arts: ArtifactDetail[]) =>
    apportExclusive(conquete, computeStats(fiche(conquete, arts)), DEFAULT_DAMAGE_SETUP, AUCUNE_AURA_PROPRE, 'wind').dmgPct;
  egal([tranches([A]), tranches([B])], [10, 0], 'précondition : Conquête +10 % avec A seulement (une tranche de 1 500 ATQ)');

  // Témoin sans effet unique : B l'emporte, pour le CLI comme pour la note.
  const tA = scoreDeReference('degats_reels', fiche(sansEffet, [A]), ref)!;
  const tB = scoreDeReference('degats_reels', fiche(sansEffet, [B]), ref)!;
  ok(tB > tA, `témoin sans effet unique : B note plus que A (${tB.toFixed(1)} > ${tA.toFixed(1)})`);
  egal(resolveArtifacts(recipe, charge(sansEffet)).map((a) => a.id), [2], 'témoin : le CLI choisit B');

  // Avec Conquête : A l'emporte à la note de production — la représentative
  // du CLI doit le suivre, comme celle de l'écran.
  const cA = scoreDeReference('degats_reels', fiche(conquete, [A]), ref)!;
  const cB = scoreDeReference('degats_reels', fiche(conquete, [B]), ref)!;
  ok(cA > cB, `Conquête : A note plus que B à la note de production (${cA.toFixed(1)} > ${cB.toFixed(1)})`);
  egal(resolveArtifacts(recipe, charge(conquete)).map((a) => a.id), [1], 'Conquête : la représentative du CLI compte l’effet unique et choisit A');
}
