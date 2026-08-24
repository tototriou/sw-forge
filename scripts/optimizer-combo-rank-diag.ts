// Diagnostic AD HOC (temporaire) — rang EXACT d'un demi-build précis (3 ids
// de runes, dans l'ordre des slots) au sein de son compartiment, sous les
// VRAIS paramètres d'une recette (pas des minStats auto-dérivés comme
// set-relax-diag.ts). Corrige/précise optimizer-bucket-rank-diag.ts, qui ne
// cherchait que "n'importe quel combo contenant CETTE rune", pas le combo
// EXACT à 3 runes.
//
// Usage : optimizer-combo-rank-diag.ts <export.json> <recipe.json> <deckId> <runeIdSlotX,runeIdSlotY,runeIdSlotZ>

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { prepareSearch, buildBuckets } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

const [exportPath, recipePath, deckIdArg, idsArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !deckIdArg || !idsArg) {
  console.error('Usage: optimizer-combo-rank-diag.ts <export.json> <recipe.json> <deckId> <id1,id2,id3>');
  process.exit(1);
}
const targetIds = new Set(idsArg.split(',').map(Number));

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] });
printMonsterSummary('siège offense', loaded);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)} — préfiltrage ${recipe.slotFilterPreset}`);

const params = recipeToSearchParams(recipe, loaded);
const prepared = prepareSearch(params);
if (!prepared) {
  console.log('prepareSearch = null.');
  process.exit(0);
}

const anyTargetRune = loaded.allRunes.find((r) => targetIds.has(r.id));
const half: 'A' | 'B' = anyTargetRune && anyTargetRune.slot <= 3 ? 'A' : 'B';
const slotIdxs: [number, number, number] = half === 'A' ? [0, 1, 2] : [3, 4, 5];
const maxSets = half === 'A' ? prepared.maxSetsForA : prepared.maxSetsForB;
const buckets = drain(buildBuckets(half, slotIdxs, prepared, maxSets));

console.log(`\nMoitié ${half} — ${buckets.length} compartiment(s)`);
let totalScanned = 0;
let found = false;
for (let bi = 0; bi < buckets.length; bi++) {
  const combos = buckets[bi].combos;
  for (let ci = 0; ci < combos.length; ci++) {
    totalScanned++;
    const ids = combos[ci].runes.map((r) => r.id);
    if (ids.length === 3 && ids.every((id) => targetIds.has(id))) {
      console.log(
        `✅ Combo EXACT trouvé : compartiment #${bi + 1}/${buckets.length} (counts=[${buckets[bi].counts.join(',')}] jokers=${buckets[bi].jokers}, ${combos.length} combo(s)), ` +
          `rang #${ci + 1}/${combos.length} — relevanceScore=${combos[ci].relevanceScore.toFixed(3)} (${totalScanned}ᵉ demi-build scanné au total)`
      );
      found = true;
      break;
    }
  }
  if (found) break;
}
if (!found) {
  const total = buckets.reduce((s, b) => s + b.combos.length, 0);
  console.log(`❌ Combo EXACT absent des ${total} demi-builds retenus.`);
}
