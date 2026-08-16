// Rejoue une recherche Optimizer EXACTEMENT telle qu'exportée depuis l'écran
// (bouton « Exporter les paramètres », voir OptimizerSection.tsx et
// src/lib/optimizerRecipe.ts), sur un export de compte réel — sans jamais
// retranscrire les réglages à la main. Ferme la boucle ouverte par
// l'investigation du cas Sonia : la recette vient de l'écran, pas d'une
// reconstruction manuelle sujette aux mêmes erreurs de fidélité que celles
// rencontrées cette session-là (voir le skill algo-verify).
//
// Usage : optimizer-search.ts <export.json> <recipe.json> [--rta] [--siege=<deckId>[:defense]]
//   --rta   : charge le monstre depuis son preset RTA (favoris/runé RTA) au
//             lieu de son build « Mon compte » (défaut).
//   --siege : charge le monstre depuis un deck de siège précis — offense par
//             défaut, `--siege=15:defense` pour un deck de défense.
// Un seul mode à la fois : sans `--rta` ni `--siege`, box (« Mon compte »).

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadBoxMonster, loadRtaMonster, loadSiegeMonster, loadBoxForExclusion, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { runSearchToCompletion } from './lib/runSearch';

const [exportPath, recipePath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const rtaMode = process.argv.includes('--rta');
const siegeArg = process.argv.find((a) => a.startsWith('--siege='))?.slice('--siege='.length);
if (!exportPath || !recipePath) {
  console.error('Usage: optimizer-search.ts <export.json> <recipe.json> [--rta] [--siege=<deckId>[:defense]]');
  process.exit(1);
}
if (rtaMode && siegeArg != null) {
  console.error('--rta et --siege sont exclusifs — un seul mode de chargement à la fois.');
  process.exit(1);
}

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}

console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — objectif ${recipe.objective} — ` +
    `métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset} — ` +
    `piste B ${recipe.adaptiveTrancheWeighting ? 'ON' : 'off'} — tout l'inventaire ${recipe.exploreAll ? 'ON' : 'off'}`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);
if (recipe.requirement.maxStats && Object.keys(recipe.requirement.maxStats).length > 0) {
  console.log(`maxStats : ${JSON.stringify(recipe.requirement.maxStats)}`);
}

const loaded = rtaMode
  ? loadRtaMonster(exportPath, recipe.monsterName)
  : siegeArg != null
    ? (() => {
        const [deckIdRaw, variant] = siegeArg.split(':');
        const deckId = Number(deckIdRaw);
        if (!Number.isFinite(deckId)) {
          console.error(`--siege=<deckId>[:defense] : deckId invalide (${deckIdRaw}).`);
          process.exit(1);
        }
        return loadSiegeMonster({ exportPath, deckId, monsterName: recipe.monsterName, defense: variant === 'defense', rest: [] });
      })()
    : loadBoxMonster(exportPath, recipe.monsterName);
const modeLabel = rtaMode ? 'RTA' : siegeArg != null ? 'siège' : 'box';
printMonsterSummary(modeLabel, loaded);

if (loaded.com2usId !== recipe.monsterCom2usId) {
  console.warn(
    `⚠️ com2usId chargé (${loaded.com2usId}) ≠ com2usId de la recette (${recipe.monsterCom2usId}) — ` +
      `même nom, mais peut-être pas le même monstre (homonyme de données ?). Vérifie avant de faire confiance au résultat.`
  );
}

const boxForExclusion = recipe.exploreAll ? undefined : loadBoxForExclusion(exportPath);
const params = recipeToSearchParams(recipe, loaded, boxForExclusion);

console.log('\nRecherche en cours (avec escalade du budget, comme l\'app réelle — peut prendre plusieurs minutes)…');
const result = runSearchToCompletion(params);

console.log(
  `\n${result.candidates.length} build(s) trouvé(s) — tronqué : ${result.truncated} — ` +
    `${result.explored.toLocaleString('fr-FR')} paires explorées (escalade x${result.escalations}) — ` +
    `prep ${result.prepMs.toFixed(0)}ms · construction ${result.buildWallMs.toFixed(0)}ms · ` +
    `appariement ${result.pairingMs.toFixed(0)}ms · total ${(result.totalMs / 1000).toFixed(1)}s`
);
for (const c of result.candidates.slice(0, 20)) {
  console.log(`  runes [${c.runeIds.join(',')}]`);
}
if (result.candidates.length > 20) console.log(`  … et ${result.candidates.length - 20} de plus.`);
