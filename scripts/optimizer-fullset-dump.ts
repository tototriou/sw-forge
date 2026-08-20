// Diagnostic AD HOC (temporaire) — recherche COMPLÈTE via le chemin de prod
// (recipeToSearchParams + runSearchToCompletion), imprime l'ENSEMBLE trié des
// candidats (6 ids triés par candidat, candidats triés entre eux) pour
// permettre un diff textuel EXACT entre deux versions du moteur — sert à
// vérifier qu'un changement de buildBuckets (élagage jokers≥2) ne modifie
// jamais l'ensemble final de candidats, seulement l'ordre d'exploration.
//
// Usage : optimizer-fullset-dump.ts <export.json> <recipe.json> [deckId]

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadBoxMonster, loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { runSearchToCompletion } from './lib/runSearch';

const [exportPath, recipePath, deckIdArg] = process.argv.slice(2);
if (!exportPath || !recipePath) {
  console.error('Usage: optimizer-fullset-dump.ts <export.json> <recipe.json> [deckId]');
  process.exit(1);
}
const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
const loaded = deckIdArg
  ? loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] })
  : loadBoxMonster(exportPath, recipe.monsterName);
printMonsterSummary(deckIdArg ? 'siège offense' : 'box', loaded);

const params = recipeToSearchParams(recipe, loaded);
const result = runSearchToCompletion(params);
console.error(
  `${result.candidates.length} candidat(s) — tronqué : ${result.truncated} — ${result.explored.toLocaleString('fr-FR')} paires — ${(result.totalMs / 1000).toFixed(1)}s`
);

const lines = result.candidates.map((c) => c.runeIds.slice().sort((a, b) => a - b).join(',')).sort();
for (const l of lines) console.log(l);
