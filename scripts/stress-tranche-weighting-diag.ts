// Point 4 — cas de stress SYNTHÉTIQUE : une condition TENDUE (Précision,
// rare dans le pool, aucune principale ne la couvre) noyée parmi des
// conditions MOLLES — VIT couverte par principale garantie (slot 2), PV/ATQ/
// DEF abondants en sous-stats (comme dans un compte réel), AUCUNE via
// Taux Crit/Dégâts Crit/RES (retirés : TC/DCC sont plafonnés à 100 % en jeu,
// un seuil dérivé automatiquement pouvait le dépasser — repéré en relisant
// une première version de ce script ; RES partage le même mécanisme
// d'exclusivité de slot que Précision, redondant avec le cas TC/DCC déjà
// exploré ailleurs dans la session, pas un deuxième angle utile ici).
//
// But : vérifier, AVANT d'implémenter la pondération adaptative, que (a) la
// tranche Précision peut perdre la cible à bucketCap=3000 alors qu'elle
// survit confortablement sur les tranches molles (preuve qu'il y a un gain
// de CORRECTION possible) et (b) les tranches molles sont très en dessous
// de leur plafond (preuve qu'il y a du budget à redistribuer sans leur
// nuire).
//
// Usage : stress-tranche-weighting-diag.ts [poolPerSlot=150] [bucketCapOverride=3000] [accSpecialistPerSlot=40]

import { EffectLine, RuneDetail, BaseStats } from '../src/types';
import { BuildRequirement, SearchParams, prepareSearch, buildBuckets, totalPairCount, HalfCombo } from '../src/lib/runeBuildOptim';
import { drain } from './lib/drain';

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// PV/ATQ/DEF abondants (molles, hors principale) ; TC/DCC/RES présents mais
// jamais demandés en condition (voir en-tête) ; PRÉCISION rare (3 %) —
// reflète la rareté réelle de cette sous-stat en jeu, pas un chiffre choisi
// pour faire échouer le test à tout prix.
const SUB_WEIGHTS: [number, number][] = [
  [1, 0.16], [2, 0.16], [3, 0.16], [4, 0.16], [5, 0.1], [6, 0.1], [9, 0.06], [10, 0.06], [11, 0.06], [12, 0.03],
];
const SUB_TOTAL_WEIGHT = SUB_WEIGHTS.reduce((s, [, w]) => s + w, 0);

function weightedCode(rng: () => number): number {
  let r = rng() * SUB_TOTAL_WEIGHT;
  for (const [code, w] of SUB_WEIGHTS) {
    if (r < w) return code;
    r -= w;
  }
  return SUB_WEIGHTS[SUB_WEIGHTS.length - 1][0];
}

function randomSub(used: Set<number>, rng: () => number): EffectLine {
  let code = weightedCode(rng);
  let tries = 0;
  while (used.has(code) && tries < 10) {
    code = weightedCode(rng);
    tries++;
  }
  used.add(code);
  return { code, value: 5 + Math.floor(rng() * 40) };
}

// ⚠️ SEUL le slot 2 a une principale imposée (VIT, la seule option de ce
// slot — voir la mémoire sw-rune-mainstat-rules). Les slots 4 et 6 restent
// LIBRES ici (pas de TC/DCC/RES demandés) : leur principale n'a pas besoin
// d'être contrainte, elle varie comme n'importe quel autre slot.
const FORCED_MAIN: Record<number, number> = { 2: 8 };

function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const mainCode = FORCED_MAIN[slot] ?? [1, 3, 5][Math.floor(rng() * 3)]; // slots libres : PV/ATQ/DEF plats, jamais TC/DCC/RES/PRE en principale (réaliste : ces 4 exigent leur slot dédié)
  const used = new Set([mainCode]);
  const subs = [randomSub(used, rng), randomSub(used, rng), randomSub(used, rng), randomSub(used, rng)];
  const mainValue = mainCode === 8 ? 30 + Math.floor(rng() * 60) : 20 + Math.floor(rng() * 80); // VIT plausible (30-90) vs PV/ATQ/DEF plats
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: mainValue }, subs };
}

const POOL_PER_SLOT = Number(process.argv[2] ?? 150);
const bucketCapOverride = process.argv[3] ? Number(process.argv[3]) : undefined;
const ACC_SPECIALIST_PER_SLOT = Number(process.argv[4] ?? 40);
const rng = mulberry32(20260814);

const pool: RuneDetail[] = [];
let id = 1;
for (let slot = 1; slot <= 6; slot++) {
  for (let i = 0; i < POOL_PER_SLOT; i++) pool.push(randomRune(id++, slot, rng));
}

// ── Vague de « spécialistes Précision » : ACC élevée, reste médiocre — de
// vrais concurrents légitimes sur LA tranche tendue spécifiquement, sans
// gonfler la compétition sur les tranches molles (c'est le contraste qu'on
// cherche à isoler). ────────────────────────────────────────────────────
for (let slot = 1; slot <= 6; slot++) {
  for (let i = 0; i < ACC_SPECIALIST_PER_SLOT; i++) {
    const mainCode = FORCED_MAIN[slot] ?? [1, 3, 5][Math.floor(rng() * 3)];
    const used = new Set([mainCode, 12]);
    const subs: EffectLine[] = [{ code: 12, value: 25 + Math.floor(rng() * 15) }];
    for (let k = 0; k < 3; k++) subs.push(randomSub(used, rng));
    pool.push({ id: id++, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: 15 + Math.floor(rng() * 50) }, subs });
  }
}

// ── La cible injectée : forte sur les 4 stats molles, modeste (mais réelle)
// sur Précision — un demi-build plausible, pas gonflé pour « tricher ». ───
function targetRune(idOverride: number, slot: number, mainCode: number, mainValue: number, subs: EffectLine[]): RuneDetail {
  return { id: idOverride, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: mainValue }, subs };
}
const T = 900000;
const targetRunes: RuneDetail[] = [
  targetRune(T + 1, 1, 1, 100, [{ code: 3, value: 45 }, { code: 12, value: 16 }, { code: 5, value: 45 }, { code: 4, value: 45 }]),
  targetRune(T + 2, 2, 8, 100, [{ code: 3, value: 45 }, { code: 12, value: 14 }, { code: 1, value: 45 }, { code: 5, value: 45 }]),
  targetRune(T + 3, 3, 5, 100, [{ code: 3, value: 45 }, { code: 1, value: 45 }, { code: 4, value: 45 }, { code: 2, value: 40 }]),
  targetRune(T + 4, 4, 3, 100, [{ code: 12, value: 28 }, { code: 6, value: 45 }, { code: 1, value: 45 }, { code: 5, value: 40 }]),
  targetRune(T + 5, 5, 1, 100, [{ code: 12, value: 26 }, { code: 4, value: 45 }, { code: 5, value: 40 }, { code: 2, value: 40 }]),
  targetRune(T + 6, 6, 5, 100, [{ code: 3, value: 45 }, { code: 1, value: 45 }, { code: 4, value: 40 }, { code: 6, value: 40 }]),
];
for (const r of targetRunes) pool.push(r);

const base: BaseStats = { hp: 9000, atk: 900, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function sumContribution(runes: RuneDetail[], code: number): number {
  let total = 0;
  for (const r of runes) {
    if (r.main.code === code) total += r.main.value;
    for (const s of r.subs) if (s.code === code) total += s.value;
  }
  return total;
}
// 5 conditions à la fois : VIT (mainstat garantie, MOLLE) + PV/ATQ/DEF
// (abondants, MOLLES) + Précision (rare, TENDUE). Seuils dérivés de la
// cible elle-même (garantit la satisfiabilité), avec une marge de sécurité.
const minStats: BuildRequirement['minStats'] = {
  spd: base.spd + sumContribution(targetRunes, 8) - 5,
  hp: base.hp + sumContribution(targetRunes, 1) - 10,
  atk: base.atk + sumContribution(targetRunes, 3) - 10,
  def: base.def + sumContribution(targetRunes, 5) - 10,
  acc: sumContribution(targetRunes, 12) - 3,
};
console.log('Seuils dérivés de la cible :', minStats);

const requirement: BuildRequirement = { sets: [], minStats, mainStats: { 2: [8] } };
const params: SearchParams = { base, artifacts: [], relic: undefined, pool, requirement, metric: 'eff', slotFilterCap: 80, bucketCap: bucketCapOverride };

const prepared = prepareSearch(params);
if (!prepared) {
  console.log('prepareSearch = null — seuils trop stricts, ajuster.');
  process.exit(1);
}
console.log(`bucketCap=${prepared.bucketCap}  retentionKeys=[${prepared.retentionKeys.join(', ')}]`);

const bucketsA = drain(
  buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces)
);
const bucketsB = drain(
  buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces)
);

const targetIdsA = new Set(targetRunes.slice(0, 3).map((r) => r.id));
const targetIdsB = new Set(targetRunes.slice(3, 6).map((r) => r.id));

function findRank(combos: HalfCombo[], targetIds: Set<number>, scoreOf: (c: HalfCombo) => number) {
  const sorted = [...combos].sort((a, b) => scoreOf(b) - scoreOf(a));
  const idx = sorted.findIndex((c) => c.runes.length === 3 && c.runes.every((r) => targetIds.has(r.id)));
  return { rank: idx >= 0 ? idx + 1 : null, total: sorted.length };
}
const accScore = (c: HalfCombo) => (c.pct.acc ?? 0) + (c.flat.acc ?? 0);

const combosA = bucketsA.flatMap((b) => b.combos);
const combosB = bucketsB.flatMap((b) => b.combos);
const rankA = findRank(combosA, targetIdsA, (c) => c.relevanceScore);
const rankB = findRank(combosB, targetIdsB, (c) => c.relevanceScore);
const rankAccA = findRank(combosA, targetIdsA, accScore);
const rankAccB = findRank(combosB, targetIdsB, accScore);
console.log(`Demi-build A cible (par relevanceScore) : ${rankA.rank ? `rang #${rankA.rank}/${rankA.total}` : `❌ ABSENT (${rankA.total} au total)`}`);
console.log(`Demi-build B cible (par relevanceScore) : ${rankB.rank ? `rang #${rankB.rank}/${rankB.total}` : `❌ ABSENT (${rankB.total} au total)`}`);
console.log(`Demi-build A cible (par acc SEUL) : ${rankAccA.rank ? `rang #${rankAccA.rank}/${rankAccA.total}` : `❌ ABSENT`}`);
console.log(`Demi-build B cible (par acc SEUL) : ${rankAccB.rank ? `rang #${rankAccB.rank}/${rankAccB.total}` : `❌ ABSENT`}`);

function dispersion(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdev: Math.sqrt(variance), cv: mean !== 0 ? Math.sqrt(variance) / mean : 0 };
}
function retentionScoreLocal(pct: Record<string, number>, flat: Record<string, number>, key: string) {
  return (pct[key] ?? 0) + (flat[key] ?? 0);
}
for (const [label, combos] of [['A', combosA], ['B', combosB]] as const) {
  const sorted = [...combos].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const genPop = sorted.slice(0, Math.min(prepared.bucketCap, sorted.length));
  console.log(`\n  Moitié ${label} — population générique : ${genPop.length}/${combos.length}`);
  for (const key of prepared.retentionKeys) {
    const d = dispersion(genPop.map((c) => retentionScoreLocal(c.pct, c.flat, key)));
    console.log(`    ${key.padEnd(4)} CV=${d.cv.toFixed(3)}  moyenne=${d.mean.toFixed(2)}`);
  }
}

const total = totalPairCount(prepared, bucketsA, bucketsB);
console.log(`\ntotalPairCount=${total.toLocaleString('fr-FR')}`);
