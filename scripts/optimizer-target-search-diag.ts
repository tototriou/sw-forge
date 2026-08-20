// Diagnostic AD HOC (temporaire) — lance une recherche COMPLÈTE (recette
// réelle, chemin de prod recipeToSearchParams + runSearchToCompletion, comme
// scripts/optimizer-search.ts) et vérifie si un build CIBLE précis (6 ids de
// runes) apparaît PARMI TOUS les candidats trouvés (pas seulement les 20
// premiers affichés) — répond à « pairBuckets retrouve-t-il ce build sous
// les VRAIES contraintes de la recette (minStats plus laxes que le build
// cible), dans le budget réel ? », complémentaire à set-relax-diag.ts (qui
// dérive des minStats artificiellement serrés à partir du build cible
// lui-même, donc ne teste pas ce cas précis).
//
// Usage : optimizer-target-search-diag.ts <export.json> <recipe.json> <deckId> <targetRuneIds séparés par virgules>

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { runSearchToCompletion } from './lib/runSearch';

const [exportPath, recipePath, deckIdArg, targetIdsArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !deckIdArg || !targetIdsArg) {
  console.error('Usage: optimizer-target-search-diag.ts <export.json> <recipe.json> <deckId> <targetRuneIds séparés par virgules>');
  process.exit(1);
}
const targetIds = new Set(targetIdsArg.split(',').map(Number));

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset}`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);
console.log(`Cible : [${[...targetIds].join(',')}]`);

const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] });
printMonsterSummary('siège offense', loaded);

const params = recipeToSearchParams(recipe, loaded);
console.log('\nRecherche en cours (budget réel, jusqu\'à 10 min)…');
const result = runSearchToCompletion(params);
console.log(
  `${result.candidates.length} build(s) trouvé(s) — tronqué : ${result.truncated} — ` +
    `${result.explored.toLocaleString('fr-FR')} paires explorées (escalade x${result.escalations}) — total ${(result.totalMs / 1000).toFixed(1)}s`
);

const exact = result.candidates.filter((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetIds.has(id)));
console.log(`\nBuild EXACT (les 6 ids cible) parmi les candidats : ${exact.length > 0 ? 'TROUVÉ ✅' : 'ABSENT ❌'} (${exact.length} occurrence(s))`);

// Aussi : combien de candidats contiennent AU MOINS N des ids cible (montre
// si on s'approche du build cible sans jamais l'atteindre exactement).
const overlapCounts = new Map<number, number>();
let maxOverlap = 0;
for (const c of result.candidates) {
  const overlap = c.runeIds.filter((id) => targetIds.has(id)).length;
  overlapCounts.set(overlap, (overlapCounts.get(overlap) ?? 0) + 1);
  if (overlap > maxOverlap) maxOverlap = overlap;
}
console.log(`Chevauchement max avec la cible parmi tous les candidats : ${maxOverlap}/6 rune(s) commune(s)`);
for (let n = 6; n >= 0; n--) {
  if (overlapCounts.has(n)) console.log(`  ${n}/6 runes communes : ${overlapCounts.get(n)} candidat(s)`);
}
if (maxOverlap > 0 && maxOverlap < 6) {
  const example = result.candidates.find((c) => c.runeIds.filter((id) => targetIds.has(id)).length === maxOverlap);
  console.log(`  exemple (${maxOverlap}/6) : [${example!.runeIds.join(',')}]`);
}
