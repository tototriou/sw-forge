// Diagnostic AD HOC (temporaire) — pour une recette donnée, localise où (quel
// compartiment, quel rang à l'intérieur) se trouvent les demi-builds de la
// moitié (A = slots 1,2,3 ou B = slots 4,5,6, choisie automatiquement selon
// le slot de la rune ciblée) qui utilisent une rune PRÉCISE (par id), sans
// passer par `pairBuckets` — `buildBuckets` seul suffit à répondre à « ce
// demi-build survit-il à la rétention, et à quel rang ? » (voir le skill
// algo-verify, méthode point 6 : bon étage du pipeline, pas de recherche
// complète pour une question qui ne concerne que la construction des
// compartiments).
//
// Réutilise EXACTEMENT le chemin de prod (recipeToSearchParams → prepareSearch
// → buildBuckets), comme scripts/optimizer-search-analyze.ts.
//
// Usage : optimizer-bucket-rank-diag.ts <export.json> <recipe.json> <runeId>

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadBoxMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { prepareSearch, buildBuckets } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

const [exportPath, recipePath, runeIdArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !runeIdArg) {
  console.error('Usage: optimizer-bucket-rank-diag.ts <export.json> <recipe.json> <runeId>');
  process.exit(1);
}
const targetRuneId = Number(runeIdArg);

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}

console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset}`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);

const loaded = loadBoxMonster(exportPath, recipe.monsterName);
printMonsterSummary('box', loaded);

const targetRune = loaded.allRunes.find((r) => r.id === targetRuneId);
if (!targetRune) {
  console.error(`Rune id=${targetRuneId} introuvable dans le pool.`);
  process.exit(1);
}
console.log(`Rune ciblée : id=${targetRune.id} slot=${targetRune.slot} set=${targetRune.set} main=code${targetRune.main.code}=${targetRune.main.value}`);
const isHalfA = targetRune.slot <= 3;
const halfLabel = isHalfA ? 'A' : 'B';
const slotIdxs: [number, number, number] = isHalfA ? [0, 1, 2] : [3, 4, 5];

const params = recipeToSearchParams(recipe, loaded);
const prepared = prepareSearch(params);
if (!prepared) {
  console.log('prepareSearch = null (au moins un emplacement vide après pré-filtrage).');
  process.exit(0);
}
console.log(`bucketCap utilisé : ${prepared.bucketCap}`);
const survives = prepared.filtered[targetRune.slot - 1].some((r) => r.id === targetRune.id);
console.log(`filtered[slot${targetRune.slot}] : ${prepared.filtered[targetRune.slot - 1].length} rune(s) retenue(s) — cible ${survives ? 'SURVIT à filterSlot' : '❌ ÉLIMINÉE avant buildBuckets'}`);
if (!survives) process.exit(0);

console.log(`\nConstruction de la moitié ${halfLabel} (slots ${slotIdxs.map((i) => i + 1).join(',')})…`);
const t0 = performance.now();
const maxSets = isHalfA ? prepared.maxSetsForA : prepared.maxSetsForB;
const buckets = drain(buildBuckets(halfLabel, slotIdxs, prepared, maxSets));
const ms = performance.now() - t0;
console.log(`${(ms / 1000).toFixed(1)}s — buckets${halfLabel} : ${buckets.length} compartiment(s), tailles = [${buckets.map((b) => b.combos.length).join(', ')}]`);

let totalScanned = 0;
let found = false;
for (let bi = 0; bi < buckets.length; bi++) {
  const combos = buckets[bi].combos;
  for (let ci = 0; ci < combos.length; ci++) {
    totalScanned++;
    if (combos[ci].runes.some((r) => r.id === targetRuneId)) {
      console.log(
        `\n✅ Premier demi-build contenant la rune cible : compartiment #${bi + 1}/${buckets.length}, rang #${ci + 1}/${combos.length} ` +
          `(${totalScanned}ᵉ demi-build retenu au total, sur ${buckets.reduce((s, b) => s + b.combos.length, 0)})`
      );
      console.log(`   runes du demi-build : [${combos[ci].runes.map((r) => `slot${r.slot}:${r.set}`).join(', ')}]`);
      found = true;
      break;
    }
  }
  if (found) break;
}
if (!found) {
  const total = buckets.reduce((s, b) => s + b.combos.length, 0);
  console.log(`\n❌ Aucun demi-build retenu (sur ${total}) n'utilise cette rune — éliminée par la rétention (bucketCap), pas par filterSlot.`);
}
