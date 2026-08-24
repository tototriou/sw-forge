// Test différentiel pour la piste « point 2 — filterSlot : top-K via le tas
// borné (heapPush) au lieu de 8 tris complets par stat ». Voir
// spec/outils/optimizer/pistes.md, section « En attente ».
//
// La boucle par stat de `filterSlot` (src/lib/runeBuildOptim.ts) triait
// `candidates` en ENTIER puis prenait `.slice(0, keepN)` — remplacé par une
// insertion bornée dans un tas MIN (`heapPush`, déjà en production pour la
// rétention par compartiment). Les deux méthodes gardent les `keepN` plus
// grandes valeurs par CONSTRUCTION, mais peuvent départager une ÉGALITÉ de
// score différemment (le tri est stable — garde les premiers dans l'ordre
// d'origine sur une égalité à la frontière ; le tas garde le premier ENTRÉ
// tant qu'aucune valeur strictement supérieure ne le déloge, ce qui n'est
// PAS garanti identique). Ce script vérifie EMPIRIQUEMENT si cette
// différence se manifeste en pratique, et sur quelle taille d'écart.
//
// Usage : filterslot-topk-diag.ts [scenarios=200] [seed=9000]

import { BaseStats, EffectLine, RuneDetail, StatKey } from '../src/types';
import {
  BuildRequirement,
  MAX_PER_SLOT_FILL,
  MAX_PER_SLOT_MATCH,
  Objective,
  OBJECTIVE_RELEVANT_STATS,
  filterSlot,
  relevance,
  runeContribution,
} from '../src/lib/runeBuildOptim';

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

const SET_KEYS = ['violent', 'swift', 'will', 'shield', 'fight', 'blade', 'rage', 'energy'];
const STAT_CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
const OBJECTIVES: (Objective | undefined)[] = [undefined, 'efficience', 'degats', 'ehp', 'vitesse'];

function randomRune(id: number, slot: number, rng: () => number, sparse: boolean): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
  // ⚠️ `sparse` génère DÉLIBÉRÉMENT beaucoup de runes à contribution NULLE
  // sur la plupart des stats (peu de subs tirées) — c'est justement le
  // régime où des égalités à 0 abondent dans la boucle par stat de
  // `filterSlot`, celui qui a le plus de chances de révéler une divergence
  // de tie-break entre tri stable et tas.
  const subCount = sparse ? Math.floor(rng() * 2) : 4;
  for (let i = 0; i < subCount; i++) {
    let code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
    let tries = 0;
    while (used.has(code) && tries < 10) {
      code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
      tries++;
    }
    used.add(code);
    subs.push({ code, value: 5 + Math.floor(rng() * 40) });
  }
  return {
    id, slot, set, rank: 6, rarity: 5, level: 15,
    main: { code: mainCode, value: 10 + Math.floor(rng() * 100) },
    subs,
  };
}

// ── Référence : l'ANCIENNE boucle par stat (tri complet + slice), copiée
// telle qu'elle était avant ce changement — reconstruit `filterSlot`
// EN ENTIER pour comparer sur le même `kept` final (pas seulement la boucle
// par stat isolée), afin de capturer un éventuel effet de bord via l'union
// avec `matches`/`scored`/`offSet` (inchangés, mais réutilisés ici tels
// quels pour rester fidèle à la vraie fonction).
const PER_STAT_KEEP = 6;
const PER_STAT_KEEP_OBJECTIVE = 24;
const ALL_STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
const FILTER_SLOT_WIDENING_THRESHOLD = 4;
const FILTER_SLOT_WIDENING_PER_CONDITION = 20;
// ⚠️ MAX_PER_SLOT_MATCH/MAX_PER_SLOT_FILL importés de runeBuildOptim.ts
// (pas dupliqués localement) — un ancien copié-collé à 80/40 (asymétrique,
// jamais vrai en production, où les deux valent 40) avait faussé la mesure
// de divergence de ce script sans qu'aucune erreur tsc ne le détecte (voir
// historique-dimensionnement.md, « revue de code externe »).

// Synthétique mais réaliste (mêmes ordres de grandeur qu'un vrai monstre) —
// ce script ne teste PAS la pondération pct/flat par base (sujet d'un autre
// script), juste l'équivalence tas/tri à égalité de score ; toute base fixe
// non nulle convient tant qu'elle est la MÊME des deux côtés de la comparaison.
const SYNTHETIC_BASE: BaseStats = { hp: 9000, atk: 900, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function filterSlotOld(
  candidates: RuneDetail[],
  requirement: BuildRequirement,
  matchCap = MAX_PER_SLOT_MATCH,
  fillCap = MAX_PER_SLOT_FILL,
  objective?: Objective
): RuneDetail[] {
  const requiredKeys = new Set(requirement.sets);
  const scored = candidates.map((r) => ({ r, s: relevance(r, requirement, SYNTHETIC_BASE) })).sort((a, b) => b.s - a.s);

  const conditionCount = Object.values(requirement.minStats).filter((v) => v != null && v > 0).length;
  const extraCap = Math.max(0, conditionCount - FILTER_SLOT_WIDENING_THRESHOLD) * FILTER_SLOT_WIDENING_PER_CONDITION;
  const effectiveMatchCap = matchCap + extraCap;
  const effectiveFillCap = fillCap + extraCap;

  const kept = new Map<number, RuneDetail>();
  const matches = scored.filter(({ r }) => requiredKeys.has(r.set) || r.set === 'intangible');
  for (const { r } of matches.slice(0, effectiveMatchCap)) kept.set(r.id, r);
  for (const { r } of scored.slice(0, effectiveFillCap)) kept.set(r.id, r);
  const offSet = scored.filter(({ r }) => !requiredKeys.has(r.set) && r.set !== 'intangible');
  for (const { r } of offSet.slice(0, effectiveFillCap)) kept.set(r.id, r);

  const objectiveKeys = objective ? OBJECTIVE_RELEVANT_STATS[objective] : [];
  for (const k of ALL_STAT_KEYS) {
    const keepN = objectiveKeys.includes(k) ? PER_STAT_KEEP_OBJECTIVE : PER_STAT_KEEP;
    const top = candidates
      .map((r) => {
        const c = runeContribution(r, k);
        const b = (SYNTHETIC_BASE as unknown as Record<string, number>)[k] ?? 0;
        const v = k === 'hp' || k === 'atk' || k === 'def' ? Math.ceil((b * c.pct) / 100) + c.flat : c.flat;
        return { r, v };
      })
      .sort((a, b) => b.v - a.v)
      .slice(0, keepN);
    for (const { r } of top) kept.set(r.id, r);
  }

  return Array.from(kept.values());
}

function idSet(runes: RuneDetail[]): Set<number> {
  return new Set(runes.map((r) => r.id));
}

function symDiffSize(a: Set<number>, b: Set<number>): number {
  let n = 0;
  for (const x of a) if (!b.has(x)) n++;
  for (const x of b) if (!a.has(x)) n++;
  return n;
}

const argv = process.argv.slice(2);
const SCENARIOS = argv[0] ? Number(argv[0]) : 200;
const SEED_BASE = argv[1] ? Number(argv[1]) : 9000;

const SIZES = [10, 25, 80, 300, 1200, 3000];

let identical = 0;
let diverged = 0;
let maxSymDiff = 0;
let totalSymDiff = 0;
const divergentExamples: string[] = [];

for (let s = 0; s < SCENARIOS; s++) {
  const rng = mulberry32(SEED_BASE + s * 97);
  const n = SIZES[Math.floor(rng() * SIZES.length)];
  const sparse = rng() < 0.6; // majorité de scénarios dans le régime "beaucoup d'égalités à 0"
  const candidates: RuneDetail[] = [];
  for (let i = 1; i <= n; i++) candidates.push(randomRune(i, 1, rng, sparse));

  const nMin = Math.floor(rng() * 4); // 0 à 3 minimums (au-delà de 4 élargit les caps, pas le sujet ici)
  const minStats: Partial<Record<StatKey, number>> = {};
  const shuffledKeys = [...STAT_KEYS].sort(() => rng() - 0.5);
  for (let i = 0; i < nMin; i++) minStats[shuffledKeys[i]] = 10 + Math.floor(rng() * 200);
  const nSets = Math.floor(rng() * 3);
  const sets: string[] = [];
  for (let i = 0; i < nSets; i++) sets.push(SET_KEYS[Math.floor(rng() * SET_KEYS.length)]);
  const requirement: BuildRequirement = { sets, minStats };
  const objective = OBJECTIVES[Math.floor(rng() * OBJECTIVES.length)];

  const newKept = filterSlot(candidates, requirement, SYNTHETIC_BASE, MAX_PER_SLOT_MATCH, MAX_PER_SLOT_FILL, objective);
  const oldKept = filterSlotOld(candidates, requirement, MAX_PER_SLOT_MATCH, MAX_PER_SLOT_FILL, objective);

  const a = idSet(newKept);
  const b = idSet(oldKept);
  const diff = symDiffSize(a, b);
  if (diff === 0) {
    identical++;
  } else {
    diverged++;
    totalSymDiff += diff;
    if (diff > maxSymDiff) maxSymDiff = diff;
    if (divergentExamples.length < 5) {
      divergentExamples.push(`  scénario ${s} : n=${n} sparse=${sparse} objective=${objective ?? '—'} nMin=${nMin} nSets=${nSets} → symDiff=${diff} (nouveau=${a.size} ancien=${b.size})`);
    }
  }
}

console.log(`filterSlot — tas vs tri complet, ${SCENARIOS} scénarios (tailles ${SIZES.join('/')}), seed base ${SEED_BASE}.\n`);
console.log(`Ensembles IDENTIQUES : ${identical}/${SCENARIOS}`);
console.log(`Ensembles DIVERGENTS : ${diverged}/${SCENARIOS}`);
if (diverged > 0) {
  console.log(`  écart moyen (parmi les divergents) : ${(totalSymDiff / diverged).toFixed(2)} ids`);
  console.log(`  écart MAX observé : ${maxSymDiff} ids`);
  console.log(`\nExemples de divergence :`);
  for (const ex of divergentExamples) console.log(ex);
}
