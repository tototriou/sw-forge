// Une seule règle de clé d'identifiant de compétence pour toute la recette.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE : un champ indexé par identifiant qui
// accepte « 010616 » — `Number` le ramène à 10616, mais le calcul lit la clé
// « 10616 » et ne verrait jamais l'autre ; la clé morte repartirait à l'export
// suivant. Quatorze champs, une règle (`estIdentifiantDeCompetence`) : la
// liste ci-dessous est écrite UNE fois, et la garde de source fait échouer un
// site d'appel ou un champ ajouté plus tard sans être listé ici.

import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';
import {
  DEFAULT_DAMAGE_SETUP,
  IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID,
  cransDeLaRegleIgnoreDef,
} from '../src/lib/damage';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';

const LAPIS = 19811;
const BLADE_SURGE_LAPIS = 10616;
const BLADE_DANCER = 14808;

// Les quatorze champs : [nom, valeur d'une entrée valide pour la clé].
const RANG_VALIDE = cransDeLaRegleIgnoreDef(IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID[BLADE_DANCER]).map((c) => c.rang).find((r) => r !== null) ?? null;
const CHAMPS: [string, unknown, number][] = [
  // Sept champs entiers de `validerRecordNumerique`.
  ['coupsPersonnalises', 1, BLADE_SURGE_LAPIS],
  ['effetsCibleCount', 1, BLADE_SURGE_LAPIS],
  ['buffsCibleCount', 1, BLADE_SURGE_LAPIS],
  ['buffsPropresCount', 1, BLADE_SURGE_LAPIS],
  ['buffsAlliesCount', 1, BLADE_SURGE_LAPIS],
  ['compteurPersonnalise', 1, BLADE_SURGE_LAPIS],
  ['effetsPropresCount', 1, BLADE_SURGE_LAPIS],
  // Deux champs décimaux de `validerRecordNumerique`.
  ['stackPersonnalise', 1.5, BLADE_SURGE_LAPIS],
  ['pvActuelsAvantSacrificePct', 50.5, BLADE_SURGE_LAPIS],
  // Deux champs de `validerRecordBooleen`.
  ['passifsOffensifs', true, BLADE_SURGE_LAPIS],
  ['statsCombatActives', true, BLADE_SURGE_LAPIS],
  // Les trois champs à validation propre.
  ['scenariosEffetsEntreCoups', { actif: true }, BLADE_SURGE_LAPIS],
  ['cibleDegatsParSort', 'secondaire', BLADE_SURGE_LAPIS],
  ['premierCoupIgnoreDefParSort', RANG_VALIDE, BLADE_DANCER],
];

const SOURCE = readFileSync(new URL('../src/lib/optimizerRecipe.ts', import.meta.url), 'utf8');

export function testRecetteClesIdentifiant() {
  titre('Recette — une seule règle de clé d’identifiant de compétence, quatorze champs');

  const base = JSON.parse(
    JSON.stringify(
      buildOptimizerRecipe({
        monsterCom2usId: LAPIS, monsterName: 'Lapis',
        requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
        damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas',
        adaptiveTrancheWeighting: false, exhaustiveSearch: false,
        excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
        ignoreArtifacts: true, artifactMainByKind: {},
      })
    )
  );
  const avec = (champ: string, cle: string, valeur: unknown) =>
    parseOptimizerRecipe(JSON.stringify({ ...base, damageSetup: { ...base.damageSetup, [champ]: { [cle]: valeur } } }));

  ok(RANG_VALIDE !== null, 'le rang valide de premierCoupIgnoreDefParSort existe (variante à rang non nul)');
  for (const [champ, valeur, id] of CHAMPS) {
    const mauvaise = `0${id}`;
    const refus = avec(champ, mauvaise, valeur);
    const chemin = `damageSetup.${champ}.${mauvaise}`;
    ok(refus.recipe === null && !!refus.error?.includes(`${chemin} utilise un identifiant de compétence invalide`),
      `${champ} : « ${mauvaise} » refusé avec son chemin exact — « ${refus.error ?? 'accepté'} »`);
    const bonne = avec(champ, String(id), valeur);
    ok(bonne.recipe !== null, `${champ} : « ${id} » accepté${bonne.error ? ` — ${bonne.error}` : ''}`);
    const nulle = avec(champ, '0', valeur);
    ok(nulle.recipe === null, `${champ} : « 0 » refusé`);
  }

  // Garde de source : cinq sites d'appel (les neuf champs des deux tableaux
  // passent par `validerRecordNumerique`), et les deux tableaux de champs du
  // parseur contenus dans la liste de ce test.
  const appels = (SOURCE.match(/estIdentifiantDeCompetence\(/g) ?? []).length
    - (SOURCE.match(/function estIdentifiantDeCompetence\(/g) ?? []).length;
  egal(appels, 5, 'cinq sites d’appel de estIdentifiantDeCompetence( dans optimizerRecipe.ts');

  const tableaux = [...SOURCE.matchAll(/for \(const champ of \[([^\]]*)\]\) \{\s*const e = validerRecordNumerique/g)];
  egal(tableaux.length, 2, 'deux tableaux de champs passent par validerRecordNumerique');
  const listes = new Set(CHAMPS.map(([nom]) => nom));
  const dansParseur = tableaux.flatMap((m) => [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  egal(dansParseur.length, 9, 'neuf champs dans les deux tableaux du parseur');
  egal(dansParseur.filter((nom) => !listes.has(nom)), [], 'chaque champ des tableaux du parseur est dans la liste du test');
  egal(CHAMPS.length, 14, 'quatorze champs dans la liste du test');

  // Le seul test de clé du fichier : plus aucune règle écrite à la main.
  egal((SOURCE.match(/\/\^\\d\+\$\/|\/\^\[1-9\]/g) ?? []).length, 1, 'une seule expression de clé dans optimizerRecipe.ts');
}
