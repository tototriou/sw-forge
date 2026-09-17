// Point 4 — cas de stress SYNTHÉTIQUE : une condition TENDUE (Précision, rare
// dans le pool, qu'aucune principale ne couvre) noyée parmi des conditions
// MOLLES — VIT couverte par principale garantie, PV/ATQ/DEF abondants en
// sous-stats. But : vérifier, avant de se fier à la pondération adaptative,
// que (a) la tranche Précision peut perdre la cible là où les tranches molles
// la gardent, et (b) les tranches molles restent loin sous leur plafond,
// donc qu'il y a du budget à redistribuer sans leur nuire.
//
// Calibré en mesurant D'ABORD le rang RÉEL de la cible sans aucun plafond,
// puis en choisissant les paramètres — jamais en ajustant à l'aveugle.
//
// ⚠️ **Il a eu un PRÉDÉCESSEUR, `stress-tranche-weighting-diag.ts`, SUPPRIMÉ
// le 2026-09-09** (§5.5 bis des extensions) — et ce qui l'a fait supprimer
// vaut d'être gardé ici, parce que c'est ce que ce fichier-ci corrige :
//   · **son pool ne pouvait pas exister en jeu** : il tirait au hasard les
//     principales des emplacements 1/3/5, alors que le jeu impose ATQ+ en 1,
//     DEF+ en 3 et PV+ en 5. D'où les principales FIXES ci-dessous ;
//   · **il ne contraignait que l'emplacement 2**, laissant 4/5/6 libres — sa
//     moitié B avait un pool ~74× plus grand que sa moitié A (mesuré), ce qui
//     rendait sa cible structurellement hors de portée quel que soit le
//     nombre de spécialistes injectés. D'où les principales imposées sur les
//     DEUX moitiés (2/4/6 = VIT/TC/RES), qui bornent les deux pools à une
//     taille comparable. ⚠️ Aucune de ces trois ne recoupe les 5 stats
//     suivies : la mollesse et la tension voulues sont intactes ;
//   · il portait les MÊMES grandeurs que ce script — rang par `acc` seul, CV
//     par `retentionKey` — donc rien n'a été perdu à le supprimer, seulement
//     un pool illégal et une calibration qui n'a jamais fonctionné.
//
// ⚠️ **CE QUI LE FAIT SURVIVRE, ET CE QUI NE LE FERAIT PAS** (vérifié le
// 2026-09-09, §5.5 bis des extensions). Une seule chose : son **POOL n'est
// pas exprimable par le harnais** — une source synthétique tire par
// `randomPool`, qui ne force aucune principale par emplacement et n'injecte
// ni vague de spécialistes ni runes cibles fabriquées.
//
// ⚠️⚠️ **Mais ce n'est PAS un motif suffisant en soi, et c'est la leçon du
// §5.5 bis.** Les deux autres grandeurs qu'on lui attribuait sont désormais
// couvertes, et mieux :
//   · le **CV par `retentionKey`** vient du harnais depuis le §5.7
//     (`dispersionTranches`), LU sur `trancheReallocation` que `buildBuckets`
//     appelle lui-même. Celui calculé ici est un AUTRE nombre — principale
//     COMPRISE, sur les demi-builds retenus tous compartiments aplatis, là où
//     le moteur mesure HORS PRINCIPALE sur le pool filtré ;
//   · les **principales imposées** sont un réglage UTILISATEUR (`mainStats`
//     des emplacements pairs) : reproductibles sur un compte RÉEL, donc sans
//     pool fabriqué ;
//   · la **contribution d'une stat seule** s'obtient en ne posant qu'UNE
//     condition, ce qui réduit `retentionKeys` à cette stat.
// ⚠️ Conserver un script parce que le harnais ne sait pas fabriquer son pool
// ARTIFICIEL, c'est préserver un écart à la production sous couvert de
// rigueur. Ce fichier ne survit donc que pour l'injection de runes précises —
// et calibrer un paramètre de production dessus resterait une mauvaise idée.
//
// ⚠️⚠️ **SA CALIBRATION NE REPRODUIT PLUS — relevé le 2026-09-09.** Son
// en-tête ci-dessus promet un cas « plus ATTEIGNABLE », calibré en mesurant
// d'abord le rang réel sans plafond. Relancé tel quel aujourd'hui, il rend la
// cible **ABSENTE des DEUX moitiés** (36 989 et 38 308 demi-builds retenus) —
// donc MOINS atteignable que le prédécesseur supprimé, dont la moitié A était
// au moins RETENUE (#6701 sur 13 098 retenus). Le moteur a bougé depuis
// (rétention par tranches, `filterSlot` top-K par tas, élagage
// `hasFreeSlots`). ⚠️ Recalibrer est un chantier à part : une calibration
// périmée est un résultat écrit, pas un travail enchaîné (§5.4). D'ici là,
// ses CV restent lisibles — ils portent sur la population retenue, pas sur la
// cible — mais ses quatre lignes de RANG ne démontrent plus rien.
//
// Usage : stress-tranche-weighting-attainable-diag.ts [poolPerSlot=150] [bucketCapOverride=3000] [accSpecialistPerSlot=5]

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
// jamais demandés en condition ; PRÉCISION rare (3 %, rareté réelle en jeu).
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

// ⚠️ Principale FIXE, jamais aléatoire — règles du jeu confirmées (voir la
// mémoire sw-rune-mainstat-rules) : slot 1 = ATQ+ toujours, slot 3 = DEF+
// toujours, slot 5 = PV+ toujours (une erreur du premier script, qui les
// tirait au hasard parmi les 3, corrigée ici). Slots 2/4/6 CONTRAINTS ICI
// (contrairement au premier cas de stress) sur les 3 options exclusives du
// jeu (VIT/TC/RES) — aucune ne recoupe les 5 stats suivies, donc ça ne
// change rien à la mollesse/tension voulue, mais ça borne le pool des DEUX
// moitiés à une taille comparable.
const FORCED_MAIN: Record<number, number> = { 1: 3, 2: 8, 3: 5, 4: 9, 5: 1, 6: 11 };

function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const mainCode = FORCED_MAIN[slot];
  const used = new Set([mainCode]);
  const subs = [randomSub(used, rng), randomSub(used, rng), randomSub(used, rng), randomSub(used, rng)];
  const mainValue = mainCode === 8 ? 30 + Math.floor(rng() * 60) : mainCode === 9 || mainCode === 11 ? 15 + Math.floor(rng() * 30) : 20 + Math.floor(rng() * 80);
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: mainValue }, subs };
}

const POOL_PER_SLOT = Number(process.argv[2] ?? 150);
const bucketCapOverride = process.argv[3] ? Number(process.argv[3]) : undefined;
const ACC_SPECIALIST_PER_SLOT = Number(process.argv[4] ?? 5);
const rng = mulberry32(20260815);

const pool: RuneDetail[] = [];
let id = 1;
for (let slot = 1; slot <= 6; slot++) {
  for (let i = 0; i < POOL_PER_SLOT; i++) pool.push(randomRune(id++, slot, rng));
}

// ── Vague LÉGÈRE de « spécialistes Précision » — juste assez pour pousser
// la cible hors de portée de bucketCap=3000, pas au-delà de ce qu'une
// réallocation raisonnable peut couvrir (calibré par mesure, voir en-tête). ─
for (let slot = 1; slot <= 6; slot++) {
  for (let i = 0; i < ACC_SPECIALIST_PER_SLOT; i++) {
    const mainCode = FORCED_MAIN[slot];
    const used = new Set([mainCode, 12]);
    const subs: EffectLine[] = [{ code: 12, value: 25 + Math.floor(rng() * 15) }];
    for (let k = 0; k < 3; k++) subs.push(randomSub(used, rng));
    const mainValue = mainCode === 8 ? 30 + Math.floor(rng() * 60) : mainCode === 9 || mainCode === 11 ? 15 + Math.floor(rng() * 30) : 20 + Math.floor(rng() * 80);
    pool.push({ id: id++, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: mainValue }, subs });
  }
}

// ── La cible injectée : forte sur les 4 stats molles, modeste sur
// Précision. Principales conformes aux règles réelles du jeu. ────────────
function targetRune(idOverride: number, slot: number, subs: EffectLine[]): RuneDetail {
  const mainCode = FORCED_MAIN[slot];
  const mainValue = mainCode === 8 ? 80 : mainCode === 9 || mainCode === 11 ? 35 : 100;
  return { id: idOverride, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: mainCode, value: mainValue }, subs };
}
const T = 900000;
// ⚠️ Slot 1 (principale ATQ+) exclut DEF (plate/%) en sous-stat ; slot 3
// (principale DEF+) exclut ATQ (plate/%) — règles confirmées, voir la
// mémoire sw-rune-mainstat-rules. Runes ci-dessous conformes.
const targetRunes: RuneDetail[] = [
  targetRune(T + 1, 1, [{ code: 1, value: 45 }, { code: 12, value: 16 }, { code: 2, value: 40 }, { code: 4, value: 45 }]),
  targetRune(T + 2, 2, [{ code: 3, value: 45 }, { code: 12, value: 14 }, { code: 1, value: 45 }, { code: 5, value: 45 }]),
  targetRune(T + 3, 3, [{ code: 1, value: 45 }, { code: 6, value: 45 }, { code: 2, value: 40 }]),
  targetRune(T + 4, 4, [{ code: 12, value: 28 }, { code: 6, value: 45 }, { code: 1, value: 45 }]),
  targetRune(T + 5, 5, [{ code: 12, value: 26 }, { code: 4, value: 45 }, { code: 5, value: 40 }, { code: 2, value: 40 }]),
  targetRune(T + 6, 6, [{ code: 3, value: 45 }, { code: 1, value: 45 }, { code: 4, value: 40 }]),
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
const minStats: BuildRequirement['minStats'] = {
  spd: base.spd + sumContribution(targetRunes, 8) - 5,
  hp: base.hp + sumContribution(targetRunes, 1) - 10,
  atk: base.atk + sumContribution(targetRunes, 3) - 10,
  def: base.def + sumContribution(targetRunes, 5) - 10,
  acc: sumContribution(targetRunes, 12) - 3,
};
console.log('Seuils dérivés de la cible :', minStats);

const requirement: BuildRequirement = { sets: [], minStats, mainStats: { 2: [8], 4: [9], 6: [11] } };
const params: SearchParams = { base, artifacts: [], relic: undefined, pool, requirement, metric: 'eff', slotFilterCap: 80, bucketCap: bucketCapOverride };

const prepared = prepareSearch(params);
if (!prepared) {
  console.log('prepareSearch = null — seuils trop stricts, ajuster.');
  process.exit(1);
}
console.log(`bucketCap=${prepared.bucketCap}  retentionKeys=[${prepared.retentionKeys.join(', ')}]`);

const bucketsA = drain(
  buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)
);
const bucketsB = drain(
  buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)
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
console.log(`Demi-build A cible (par relevanceScore) : ${rankA.rank ? `rang #${rankA.rank}/${rankA.total} (retenu)` : `❌ ABSENT (${rankA.total} au total)`}`);
console.log(`Demi-build B cible (par relevanceScore) : ${rankB.rank ? `rang #${rankB.rank}/${rankB.total} (retenu)` : `❌ ABSENT (${rankB.total} au total)`}`);
console.log(`Demi-build A cible (par acc SEUL) : ${rankAccA.rank ? `rang #${rankAccA.rank}/${rankAccA.total}` : `❌ ABSENT`}`);
console.log(`Demi-build B cible (par acc SEUL) : ${rankAccB.rank ? `rang #${rankAccB.rank}/${rankAccB.total}` : `❌ ABSENT`}`);

function dispersion(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdev: Math.sqrt(variance), cv: mean !== 0 ? Math.sqrt(variance) / mean : 0 };
}
// Pondéré par `base` (module-scope, ligne ~123), comme `weightedContribution`/
// `retentionScore` réels depuis le correctif pct/flat.
function retentionScoreLocal(pct: Record<string, number>, flat: Record<string, number>, key: string) {
  const b = (base as unknown as Record<string, number>)[key] ?? 0;
  const p = pct[key] ?? 0;
  const f = flat[key] ?? 0;
  return key === 'hp' || key === 'atk' || key === 'def' ? Math.ceil((b * p) / 100) + f : f;
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
