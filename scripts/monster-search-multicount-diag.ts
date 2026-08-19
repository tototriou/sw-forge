// Diagnostic du cas remonté par l'utilisateur : une recherche Sonia (Swift
// 4p, artéfacts hypothétiques ATQ+100/ATQ+100, ATQ/VIT/TC/DCC demandés à la
// fois) trouve MOINS de builds à mesure que `slotFilterCap` augmente
// (Moyen: 3, Extrême: 1) — l'inverse de ce qu'un pré-filtrage plus large
// devrait faire. Diffère de la batterie de mesure existante
// (perf-battery.ts) : là-bas, un seul build cible connu à retrouver ;
// ici, PLUSIEURS builds valides existent, et c'est leur NOMBRE qu'il faut
// suivre à chaque préréglage — pas juste « trouvé/pas trouvé ».
//
// Usage : monster-search-multicount-diag.ts <export.json> <nomMonstre> [objective=degats]

import {
  BuildRequirement,
  SearchParams,
  Objective,
  NodeBudget,
  maybeEscalateNodeBudget,
  prepareSearch,
  buildBuckets,
  pairBuckets,
} from '../src/lib/runeBuildOptim';
import { ArtifactDetail } from '../src/types';
import { drain } from './lib/drain';
import { loadBoxMonster } from './lib/loadMonster';

const [exportPath, monsterName, objectiveArg] = process.argv.slice(2);
if (!exportPath || !monsterName) {
  console.error('Usage: monster-search-multicount-diag.ts <export.json> <nomMonstre> [objective=degats]');
  process.exit(1);
}
const objective = (objectiveArg ?? 'degats') as Objective;

const sonia = loadBoxMonster(exportPath, monsterName);
// ⚠️ « Exclure les runes déjà utilisées » (excludeUsedRunes) est DÉCOCHÉ
// par défaut à l'écran (useOptimizerState.ts) — pas d'exclusion des runes
// portées par d'autres monstres, sauf si l'utilisateur coche explicitement.
// Nom actuel du réglage depuis son renommage/inversion (ex-`exploreAll`,
// coché par défaut, sens inverse) — voir optimizerExclusion.ts.
const pool = sonia.allRunes;

console.log(`\n=== ${monsterName} (com2usId ${sonia.com2usId}) — pool (aucune exclusion, défaut) : ${pool.length} runes ===`);

const artifacts: ArtifactDetail[] = [
  { kind: 'element', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs: [] },
  { kind: 'archetype', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs: [] },
];

// ⚠️ « Stats de base exclues » (coché par défaut à l'écran) : les valeurs
// données par l'utilisateur pour ATQ/VIT sont des BONUS (au-dessus de la
// base nue du monstre), PAS le total que `BuildRequirement.minStats`
// attend toujours — voir OptimizerSection.tsx, conversion
// `minDisplayed = minTotal - base` (donc `minTotal = displayed + base`).
// Taux Crit/Dmg Crit restent TOUJOURS en total, ce réglage ne les touche
// jamais (base d'éveil déjà comprise dedans par nature).
const baseAtk = sonia.gear.base.atk;
const baseSpd = sonia.gear.base.spd;
const requirement: BuildRequirement = {
  sets: ['swift'],
  minStats: { atk: 2000 + baseAtk, spd: 194 + baseSpd, cr: 100, cd: 122 },
  mainStats: { 2: [8], 4: [9], 6: [4] },
};
console.log(`Base nue Sonia — ATQ ${baseAtk}, VIT ${baseSpd} — minStats réels : ATQ≥${requirement.minStats.atk} VIT≥${requirement.minStats.spd}`);

const PRESETS: { key: string; cap: number }[] = [
  { key: 'bas', cap: 40 },
  { key: 'moyen', cap: 80 },
  { key: 'haut', cap: 150 },
  { key: 'extreme', cap: 300 },
];

const HARD_TIMEOUT_MS = 10 * 60 * 1000;

interface RunOutcome {
  count: number;
  truncated: boolean;
  explored: number;
  prepMs: number;
  buildWallMs: number;
  pairingMs: number;
  totalMs: number;
  runeIdSets: number[][]; // un tableau de 6 ids par candidat trouvé
}

function runOnce(slotFilterCap: number, adaptiveTrancheWeighting: boolean, metric: 'eff' | 'score' = 'eff'): RunOutcome {
  const params: SearchParams = {
    base: sonia.gear.base,
    artifacts,
    relic: sonia.gear.relic,
    pool,
    requirement,
    metric,
    objective,
    maxMs: HARD_TIMEOUT_MS,
    slotFilterCap,
    adaptiveTrancheWeighting,
  };
  const t0 = performance.now();
  const prepared = prepareSearch(params);
  const tPrepared = performance.now();
  if (!prepared) return { count: 0, truncated: false, explored: 0, prepMs: tPrepared - t0, buildWallMs: 0, pairingMs: 0, totalMs: tPrepared - t0, runeIdSets: [] };
  if (slotFilterCap === 80 && !adaptiveTrancheWeighting) {
    console.log(`    [pool par emplacement, metric=${metric}] ${prepared.filtered.map((s) => s.length).join(' x ')}`);
  }

  const bucketsA = drain(
    buildBuckets(
      'A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys,
      prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces,
      undefined, adaptiveTrancheWeighting
    )
  );
  const bucketsB = drain(
    buildBuckets(
      'B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys,
      prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces,
      undefined, adaptiveTrancheWeighting
    )
  );
  const tBuild = performance.now();
  // ⚠️ REPRODUIT L'ESCALADE RÉELLE via `maybeEscalateNodeBudget` (partagée
  // avec runeBuildOptim.worker.ts et perf-battery.ts — voir son commentaire
  // dans runeBuildOptim.ts) : `pairBuckets` avec le budget par défaut (figé
  // à prepared.maxNodes) s'arrête à truncated=true sans jamais élargir, ce
  // n'est PAS ce que fait l'app. Un script qui l'oublie explore <0,0001 %
  // de l'espace réellement couvert — cause du faux "0 build trouvé" qui a
  // fait perdre du temps avant que cette factorisation existe.
  const nodeBudget: NodeBudget = { max: prepared.maxNodes };
  const gen = pairBuckets(prepared, bucketsA, bucketsB, nodeBudget);
  let step = gen.next();
  let escalations = 0;
  while (!step.done) {
    const progress = step.value;
    const now = Date.now();
    const before = nodeBudget.max;
    maybeEscalateNodeBudget(nodeBudget, prepared, progress, now);
    if (nodeBudget.max !== before) escalations++;
    step = gen.next();
  }
  const result = step.value;
  const tEnd = performance.now();
  if (escalations > 0) console.log(`    [escalade x${escalations}, budget final ${nodeBudget.max.toLocaleString('fr-FR')}]`);

  return {
    count: result.candidates.length,
    truncated: result.truncated,
    explored: result.explored,
    prepMs: tPrepared - t0,
    buildWallMs: tBuild - tPrepared,
    pairingMs: tEnd - tBuild,
    totalMs: tEnd - t0,
    runeIdSets: result.candidates.map((c) => c.runeIds),
  };
}

console.log(`\nObjectif : ${objective} — sets : swift(4p) — ATQ≥2000 VIT≥194 TC≥100 DCC≥122\n`);

const outcomes = new Map<string, RunOutcome>();
for (const metric of ['eff', 'score'] as const) {
  console.log(`\n=== metric = ${metric} ===`);
  console.log('preset | cap | trouvés | tronqué | exploré | prep | construction | appariement | total');
  for (const { key, cap } of PRESETS) {
    const out = runOnce(cap, false, metric);
    if (metric === 'eff') outcomes.set(key, out);
    console.log(
      `${key.padEnd(7)} | ${String(cap).padEnd(3)} | ${String(out.count).padEnd(7)} | ${String(out.truncated).padEnd(7)} | ${out.explored.toLocaleString('fr-FR').padEnd(10)} | ${out.prepMs.toFixed(0)}ms | ${out.buildWallMs.toFixed(0)}ms | ${out.pairingMs.toFixed(0)}ms | ${out.totalMs.toFixed(0)}ms`
    );
  }
  console.log(`--- avec "prioriser les stats les plus difficiles" (metric=${metric}) ---`);
  for (const { key, cap } of PRESETS) {
    const out = runOnce(cap, true, metric);
    console.log(
      `${key.padEnd(7)} | ${String(cap).padEnd(3)} | ${String(out.count).padEnd(7)} | ${String(out.truncated).padEnd(7)} | ${out.explored.toLocaleString('fr-FR').padEnd(10)} | ${out.prepMs.toFixed(0)}ms | ${out.buildWallMs.toFixed(0)}ms | ${out.pairingMs.toFixed(0)}ms | ${out.totalMs.toFixed(0)}ms`
    );
  }
}

// ── Preuve directe de l'hypothèse de dilution ────────────────────────────
// Les builds trouvés au préréglage le plus BAS qui en trouve (référence,
// pré-filtrage le plus étroit donc rétention la moins disputée) doivent
// TOUS rester atteignables aux préréglages plus larges — sinon c'est la
// preuve que la rétention (bucketCap), pas le pré-filtrage, les a perdus.
const reference = outcomes.get('moyen')!;
if (reference.count > 0) {
  console.log(`\n=== Les ${reference.count} builds trouvés à "moyen" restent-ils atteignables à "extrême" ? ===`);
  const prepared300 = prepareSearch({
    base: sonia.gear.base, artifacts, relic: sonia.gear.relic, pool, requirement, metric: 'eff', objective,
    maxMs: HARD_TIMEOUT_MS, slotFilterCap: 300,
  })!;
  const bucketsA300 = drain(
    buildBuckets('A', [0, 1, 2], prepared300.filtered, prepared300.distinctKeys, prepared300.constrainedKeys, prepared300.retentionKeys, prepared300.minEntries, prepared300.bucketCap, prepared300.maxSetsForA, prepared300.jokerCredit, prepared300.requiredPieces)
  );
  const bucketsB300 = drain(
    buildBuckets('B', [3, 4, 5], prepared300.filtered, prepared300.distinctKeys, prepared300.constrainedKeys, prepared300.retentionKeys, prepared300.minEntries, prepared300.bucketCap, prepared300.maxSetsForB, prepared300.jokerCredit, prepared300.requiredPieces)
  );
  const allComboIdsA = new Set<string>();
  for (const b of bucketsA300) for (const c of b.combos) allComboIdsA.add(c.runes.map((r) => r.id).sort((a, b2) => a - b2).join(','));
  const allComboIdsB = new Set<string>();
  for (const b of bucketsB300) for (const c of b.combos) allComboIdsB.add(c.runes.map((r) => r.id).sort((a, b2) => a - b2).join(','));

  // Vérifie aussi la SURVIE au pré-filtrage par emplacement (300) — pour
  // distinguer "les runes ont disparu du pool filtré" (ne devrait jamais
  // arriver, filterSlot est croissant) de "les runes sont dans le pool mais
  // leur DEMI-BUILD n'a pas survécu à bucketCap".
  const filteredIds300 = new Set(prepared300.filtered.flat().map((r) => r.id));

  for (const ids of reference.runeIdSets) {
    const half1 = ids.slice(0, 3).sort((a, b) => a - b).join(',');
    const half2 = ids.slice(3, 6).sort((a, b) => a - b).join(',');
    const allInFilteredPool = ids.every((id) => filteredIds300.has(id));
    const half1Present = allComboIdsA.has(half1);
    const half2Present = allComboIdsB.has(half2);
    console.log(
      `  runes [${ids.join(',')}] — dans le pool filtré (300) : ${allInFilteredPool} — moitié A (1-3) retenue : ${half1Present} — moitié B (4-6) retenue : ${half2Present}`
    );
  }
}
