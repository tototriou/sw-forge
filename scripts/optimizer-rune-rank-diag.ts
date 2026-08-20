// Diagnostic AD HOC (temporaire) — pour un build cible (6 runes réelles),
// calcule le rang individuel de CHAQUE rune au sein de son slot, selon la
// même fonction `relevance()` que `filterSlot` (le pré-filtrage RÉEL) — pas
// une réimplémentation, l'export direct de runeBuildOptim.ts. Répond à
// « laquelle des 6 runes traîne le demi-build vers le bas ? », complément
// aux diagnostics de compartiment déjà faits cette session.
//
// Usage : optimizer-rune-rank-diag.ts <export.json> <recipe.json> <deckId> <runeId1,...,runeId6>

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { relevance } from '../src/lib/runeBuildOptim';
import { runeEfficiency } from '../src/lib/effects';

const [exportPath, recipePath, deckIdArg, targetIdsArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !deckIdArg || !targetIdsArg) {
  console.error('Usage: optimizer-rune-rank-diag.ts <export.json> <recipe.json> <deckId> <runeId1,...,runeId6>');
  process.exit(1);
}
const targetIds = targetIdsArg.split(',').map(Number);

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
console.log(`Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — préfiltrage ${recipe.slotFilterPreset}`);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);

const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] });
printMonsterSummary('siège offense', loaded);

const params = recipeToSearchParams(recipe, loaded);

for (const slot of [1, 2, 3, 4, 5, 6]) {
  const targetId = targetIds[slot - 1];
  const target = params.pool.find((r) => r.id === targetId);
  if (!target) {
    console.log(`slot${slot} : rune id=${targetId} introuvable dans le pool.`);
    continue;
  }
  const slotPool = params.pool.filter((r) => r.slot === slot);
  const scored = slotPool.map((r) => ({ r, s: relevance(r, params.requirement) })).sort((a, b) => b.s - a.s);
  const rank = scored.findIndex((e) => e.r.id === targetId) + 1;
  const top = scored[0];
  console.log(
    `slot${slot} set=${target.set} id=${targetId} : rang relevance() #${rank}/${scored.length} ` +
      `(score=${scored[rank - 1].s.toFixed(3)}, top=${top.r.set}#${top.r.id} score=${top.s.toFixed(3)}, efficience=${runeEfficiency(target).toFixed(1)})`
  );
}
