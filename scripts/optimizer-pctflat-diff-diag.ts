// Diagnostic AD HOC (temporaire) — mesure l'écart entre `relevance()` actuel
// (pct+flat additionnés directement) et une version CORRIGÉE (pct pondéré
// par `base`, comme `totalOf`), sur le pool réel d'un slot. Ne modifie AUCUN
// code de production — reproduit la formule de `relevance()` ligne à ligne,
// juste avec un poids différent pour pct, pour rester fidèle au chemin réel
// (voir algo-verify, section « fidélité des scripts diagnostics »).
//
// Usage : optimizer-pctflat-diff-diag.ts <export.json> <recipe.json> <deckId> <slot>

import { readFileSync } from 'fs';
import { parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { runeContribution } from '../src/lib/runeBuildOptim';
import { runeEfficiency } from '../src/lib/effects';
import { RuneDetail, BaseStats } from '../src/types';

const [exportPath, recipePath, deckIdArg, slotArg] = process.argv.slice(2);
if (!exportPath || !recipePath || !deckIdArg || !slotArg) {
  console.error('Usage: optimizer-pctflat-diff-diag.ts <export.json> <recipe.json> <deckId> <slot>');
  process.exit(1);
}
const slot = Number(slotArg);

const { recipe, error } = parseOptimizerRecipe(readFileSync(recipePath, 'utf8'));
if (!recipe) {
  console.error(`Recette invalide : ${error}`);
  process.exit(1);
}
const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName: recipe.monsterName, defense: false, rest: [] });
printMonsterSummary('siège offense', loaded);
console.log(`minStats : ${JSON.stringify(recipe.requirement.minStats)}`);

const base: BaseStats = loaded.gear.base;
const pool = loaded.allRunes.filter((r) => r.slot === slot);
console.log(`slot${slot} : ${pool.length} rune(s) dans le pool`);

// Actuel : réplique EXACTE de relevance() dans runeBuildOptim.ts.
function relevanceActuel(rune: RuneDetail): number {
  let score = 0;
  for (const [key, min] of Object.entries(recipe!.requirement.minStats)) {
    if (min == null || min <= 0) continue;
    const c = runeContribution(rune, key as any);
    score += (c.pct + c.flat) / min;
  }
  score += runeEfficiency(rune) / 1000;
  return score;
}

// Corrigé : pct pondéré par base, comme totalOf (base + ceil(base*pct/100) + flat)
// — ici seule la CONTRIBUTION (sans le terme base additif, inutile pour un
// classement entre runes qui partagent toutes le même monstre).
function relevanceCorrige(rune: RuneDetail): number {
  let score = 0;
  for (const [key, min] of Object.entries(recipe!.requirement.minStats)) {
    if (min == null || min <= 0) continue;
    const c = runeContribution(rune, key as any);
    const b = (base as unknown as Record<string, number>)[key] ?? 0;
    const weighted = key === 'hp' || key === 'atk' || key === 'def' ? Math.ceil((b * c.pct) / 100) + c.flat : c.flat;
    score += weighted / min;
  }
  score += runeEfficiency(rune) / 1000;
  return score;
}

const withScores = pool.map((r) => ({
  r,
  actuel: relevanceActuel(r),
  corrige: relevanceCorrige(r),
}));
const rankedActuel = [...withScores].sort((a, b) => b.actuel - a.actuel);
const rankedCorrige = [...withScores].sort((a, b) => b.corrige - a.corrige);
const rankActuelById = new Map(rankedActuel.map((e, i) => [e.r.id, i + 1]));
const rankCorrigeById = new Map(rankedCorrige.map((e, i) => [e.r.id, i + 1]));

// Corrélation de rang (Spearman, via les écarts au carré) — 1 = ordres
// identiques, 0 = aucune corrélation, négatif = inversés.
const n = pool.length;
let sumD2 = 0;
for (const r of pool) {
  const d = (rankActuelById.get(r.id)! - rankCorrigeById.get(r.id)!);
  sumD2 += d * d;
}
const spearman = 1 - (6 * sumD2) / (n * (n * n - 1));
console.log(`\nCorrélation de rang (Spearman) actuel vs corrigé : ${spearman.toFixed(4)} (1 = identique)`);

// Combien de runes changent de statut top-K (matchCap réaliste ~300 à Extrême)
for (const K of [40, 80, 150, 300]) {
  if (K > n) continue;
  const topActuel = new Set(rankedActuel.slice(0, K).map((e) => e.r.id));
  const topCorrige = new Set(rankedCorrige.slice(0, K).map((e) => e.r.id));
  const seulementActuel = [...topActuel].filter((id) => !topCorrige.has(id));
  console.log(`  top-${K} : ${seulementActuel.length} rune(s) présente(s) dans "actuel" mais PAS dans "corrigé"`);
}

// Les 5 plus grosses inversions de rang (preuve concrète, pas juste un chiffre agrégé).
const withDelta = pool.map((r) => ({
  r,
  rActuel: rankActuelById.get(r.id)!,
  rCorrige: rankCorrigeById.get(r.id)!,
  delta: rankActuelById.get(r.id)! - rankCorrigeById.get(r.id)!,
}));
withDelta.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
console.log('\nTop 5 des plus grosses inversions de rang :');
for (const e of withDelta.slice(0, 5)) {
  const c = runeContribution(e.r, Object.keys(recipe!.requirement.minStats)[0] as any);
  console.log(
    `  id=${e.r.id} set=${e.r.set} — rang actuel #${e.rActuel} → rang corrigé #${e.rCorrige} (Δ=${e.delta}) — ` +
      `contribution 1ère stat : pct=${c.pct} flat=${c.flat}`
  );
}
