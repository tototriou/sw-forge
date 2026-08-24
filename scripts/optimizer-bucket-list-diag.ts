// Diagnostic AD HOC (temporaire) — liste TOUS les compartiments d'une moitié
// (clé = pièces de set demandé + jokers, taille, meilleur score par tranche)
// dans l'ordre où `buildBuckets` les classe, pour comprendre PRÉCISÉMENT
// pourquoi un compartiment donné (ex. 2 pièces Rage + Energy) se classe où
// il se classe — pas seulement "il se classe #4/9", mais CE qui le devance.
//
// Usage : optimizer-bucket-list-diag.ts <export.json> <recipe.json> <deckId> <A|B>

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { prepareSearch, buildBuckets, OBJECTIVE_RELEVANT_STATS } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

const [exportPath, recipePath, deckIdArg, halfArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !deckIdArg || !halfArg) {
  console.error('Usage: optimizer-bucket-list-diag.ts <export.json> <recipe.json> <deckId> <A|B>');
  process.exit(1);
}
const half = halfArg.toUpperCase() as 'A' | 'B';

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
console.log(`Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — préfiltrage ${recipe.slotFilterPreset} — objectif ${recipe.objective}`);

const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] });
printMonsterSummary('siège offense', loaded);

const params = recipeToSearchParams(recipe, loaded);
const prepared = prepareSearch(params);
if (!prepared) {
  console.log('prepareSearch = null.');
  process.exit(0);
}
console.log(`distinctKeys (sets demandés) : [${prepared.distinctKeys.join(',')}]`);
console.log(`retentionKeys (objectif ${recipe.objective}) : [${OBJECTIVE_RELEVANT_STATS[recipe.objective].join(',')}]`);

const slotIdxs: [number, number, number] = half === 'A' ? [0, 1, 2] : [3, 4, 5];
const maxSets = half === 'A' ? prepared.maxSetsForA : prepared.maxSetsForB;
const TRIALS = 15;
let bestMs = Infinity;
let buckets = drain(buildBuckets(half, slotIdxs, prepared, maxSets));
for (let t = 0; t < TRIALS; t++) {
  const t0 = performance.now();
  buckets = drain(buildBuckets(half, slotIdxs, prepared, maxSets));
  const ms = performance.now() - t0;
  if (ms < bestMs) bestMs = ms;
}
console.log(`construction buildBuckets(${half}) : meilleur temps sur ${TRIALS} essais = ${bestMs.toFixed(2)}ms`);

console.log(`\nCompartiments moitié ${half}, dans l'ordre de classement (meilleur d'abord) :`);
for (let i = 0; i < buckets.length; i++) {
  const b = buckets[i];
  const best = b.combos[0];
  console.log(
    `  #${i + 1}/${buckets.length} — counts(sets demandés)=[${b.counts.join(',')}] jokers=${b.jokers} — ${b.combos.length} combo(s) — ` +
      `meilleur combo : relevanceScore=${best.relevanceScore.toFixed(3)} runes=[${best.runes.map((r) => `${r.set}#${r.id}`).join(',')}]`
  );
}
