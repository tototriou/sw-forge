// Diagnostic AD HOC (temporaire) — étude d'un cas signalé : avec des seuils
// de stats contraignants, l'Optimizer trouve un build optimal en dégâts avec
// un set "cassé" (Rage seul + runes qui ne complètent aucun autre set) ; avec
// les mêmes réglages mais des seuils plus laxes, il ne retrouve presque plus
// que des builds à sets complets, et perd l'optimum "cassé".
//
// Réutilise EXACTEMENT le chemin de prod (recipeToSearchParams +
// runSearchToCompletion, comme scripts/optimizer-search.ts) — seul ajout :
// un override optionnel de maxMs (le budget de temps réel, HARD_TIMEOUT_MS
// normalement) pour pouvoir tronquer une recherche longue sur une recette
// laxe, ET le tri + calcul des sets actifs après coup pour reproduire
// fidèlement ce que fait OptimizerSection.tsx (objectiveScore, activeSets),
// jamais une reformulation approximative de ces fonctions.
//
// Usage : optimizer-search-analyze.ts <export.json> <recipe.json> [maxMsOverride]

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadBoxMonster, printMonsterSummary } from './lib/loadMonster';
import { recipeToSearchParams } from './lib/recipeToSearchParams';
import { runSearchToCompletion } from './lib/runSearch';
import { objectiveScore, RealDamageContext } from '../src/lib/runeBuildOptim';
import { activeSets } from '../src/lib/effects';
import { RuneDetail } from '../src/types';
import { loadMonsterSkills } from './lib/skillsData';
import { loadMonstersList } from './lib/monstersData';
import {
  DEFAULT_DAMAGE_SETUP,
  monsterBonusDegatsSelonVit,
  monsterBonusDegatsStackable,
  monsterCritSiPlusRapide,
  monsterDamageSkills,
  monsterOffensivePassives,
  resolveDamageSkill,
  speedBuffAmpliPct,
} from '../src/lib/damage';

const [exportPath, recipePath, maxMsArg] = process.argv.slice(2);
if (!exportPath || !recipePath) {
  console.error('Usage: optimizer-search-analyze.ts <export.json> <recipe.json> [maxMsOverride]');
  process.exit(1);
}

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}

console.log(
  `Recette : ${recipe.monsterName} — sets ${recipe.requirement.sets.join('+')} — objectif ${recipe.objective} — ` +
    `métrique ${recipe.metric} — préfiltrage ${recipe.slotFilterPreset}`
);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);

const loaded = loadBoxMonster(exportPath, recipe.monsterName);
printMonsterSummary('box', loaded);

const params = recipeToSearchParams(recipe, loaded);

// ⚠️ `objectiveScore('degats_reels')` EXIGE ce contexte et lève sans lui
// (même garde-fou que l'écran, voir src/lib/runeBuildOptim.ts) — construit
// EXACTEMENT comme OptimizerSection.tsx (`realDamage`) et comme le résumé
// console de scripts/optimizer-search.ts, jamais une reconstruction
// approximative. `null` pour tout autre objectif : `objectiveScore` l'ignore
// alors de toute façon. `params.artifacts` — PAS `loaded.gear.artifacts` —
// APRÈS `recipeToSearchParams` : ce sont ceux réellement envoyés au moteur
// (réels, hypothétiques ou aucun selon la recette), même artéfacts que
// `candidate.stats`, dont `ampliVitPct` doit rester solidaire.
let realDamage: RealDamageContext | null = null;
if (recipe.objective === 'degats_reels') {
  const detail = loadMonsterSkills(loaded.com2usId);
  const profile = resolveDamageSkill(monsterDamageSkills(detail), recipe.damageSetup?.skillCom2usId ?? null);
  if (profile) {
    const element = loadMonstersList().find((m) => m.com2usId === loaded.com2usId)?.element ?? null;
    realDamage = {
      profile,
      passifs: monsterOffensivePassives(detail),
      setup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,
      element,
      ampliVitPct: speedBuffAmpliPct(params.artifacts),
      critSiPlusRapide: monsterCritSiPlusRapide(detail),
      bonusDegatsSelonVit: monsterBonusDegatsSelonVit(detail),
      bonusDegatsStack: monsterBonusDegatsStackable(detail),
    };
  } else {
    console.warn(`⚠️ Objectif « Dégâts réels » mais aucun sort calculable pour ${loaded.monsterName} — objectiveScore lèvera.`);
  }
}
if (maxMsArg) {
  const override = Number(maxMsArg);
  console.log(`⚠️ maxMs FORCÉ à ${override}ms (au lieu de ${params.maxMs}ms) — tendance seulement, pas une preuve de complétude.`);
  params.maxMs = override;
}

console.log('\nRecherche en cours…');
const result = runSearchToCompletion(params);
console.log(
  `${result.candidates.length} build(s) trouvé(s) — tronqué : ${result.truncated} — ` +
    `${result.explored.toLocaleString('fr-FR')} paires explorées (escalade x${result.escalations}) — ` +
    `total ${(result.totalMs / 1000).toFixed(1)}s`
);

const runeById = new Map<number, RuneDetail>(loaded.allRunes.map((r) => [r.id, r]));

// Tri identique à l'écran (OptimizerSection.tsx, fullSortedCandidates) :
// objectiveScore décroissant, `realDamage` transmis pour « Dégâts réels ».
const sorted = [...result.candidates].sort(
  (a, b) => objectiveScore(b, recipe.objective, realDamage ?? undefined) - objectiveScore(a, recipe.objective, realDamage ?? undefined)
);

console.log(`\nTop 15 (triés comme l'écran, objectif=${recipe.objective}) :`);
let completeCount = 0;
let brokenInTop = 0;
const TOP_N = 15;
for (let i = 0; i < Math.min(TOP_N, sorted.length); i++) {
  const c = sorted[i];
  const sets = c.runeIds.map((id) => runeById.get(id)?.set ?? '?');
  const active = activeSets(sets.filter((s) => s !== '?'));
  const requestedActive = active.filter((s) => recipe.requirement.sets.includes(s));
  const extraActive = active.filter((s) => !recipe.requirement.sets.includes(s));
  const isBroken = extraActive.length === 0 && requestedActive.length === recipe.requirement.sets.length;
  if (isBroken) brokenInTop++;
  console.log(
    `  #${i + 1} score=${objectiveScore(c, recipe.objective, realDamage ?? undefined).toFixed(1)} sets actifs=[${active.join('+') || 'aucun'}] ` +
      `runes/set=[${sets.join(',')}] ${isBroken ? '⚠️ SET CASSÉ (rien de plus que le requis)' : ''}`
  );
}

// Sur TOUT l'ensemble trouvé (pas seulement le top 15) : proportion de builds
// à set "cassé" vs set complet en plus du requis.
for (const c of result.candidates) {
  const sets = c.runeIds.map((id) => runeById.get(id)?.set ?? '?').filter((s) => s !== '?');
  const active = activeSets(sets);
  const extraActive = active.filter((s) => !recipe.requirement.sets.includes(s));
  if (extraActive.length === 0) completeCount++;
}
console.log(
  `\nSur les ${result.candidates.length} candidats trouvés : ${completeCount} n'ont AUCUN set complet en plus du requis (${((completeCount / result.candidates.length) * 100).toFixed(1)}%), ${result.candidates.length - completeCount} en ont au moins un.`
);
