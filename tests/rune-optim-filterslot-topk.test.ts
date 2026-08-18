// Test différentiel pour la boucle « meilleur d'un slot sur chaque stat »
// dans `filterSlot` (src/lib/runeBuildOptim.ts) — remplacée par un top-K via
// le tas borné (`heapPush`, déjà en production pour la rétention par
// compartiment) au lieu d'un tri complet de `candidates` suivi d'un
// `.slice()`. Voir spec/outils/optimizer/pistes.md, piste « point 2 —
// filterSlot : top-K via le tas ».
//
// ⚠️ **Version corrigée après une revue de code externe** (voir
// spec/outils/optimizer/historique-dimensionnement.md, « revue de code
// externe : le défaut 'relevance' invalidé », point 3) : la version
// précédente définissait SA PROPRE réimplémentation locale de `heapPush`
// (array + tri complet à chaque insertion) au lieu d'appeler le vrai
// `heapPush` de `runeBuildOptim.ts` — un bug dans le VRAI code n'aurait pas
// fait échouer ce test. `heapPush`/`ScoredEntry` sont maintenant exportés
// (uniquement pour cet usage) et appelés directement ici.
//
// ⚠️ **L'ensemble EXACT des runes gardées peut différer sur une ÉGALITÉ de
// score** (mesuré via `scripts/filterslot-topk-diag.ts` — voir ce script
// pour la mise en garde sur les plafonds utilisés) — le tri est stable
// (garde les premiers du tableau d'origine sur une égalité à la frontière),
// le tas garde le premier ENTRÉ tant qu'aucune valeur strictement
// supérieure ne le déloge, ce qui n'est PAS garanti identique. Ce n'est PAS
// un bug : les deux méthodes gardent par construction les `keepN` PLUS
// GRANDES VALEURS, seule l'IDENTITÉ précise des runes à égalité parfaite
// peut varier — des runes interchangeables pour CE critère précis (ex.
// plusieurs runes à contribution nulle sur une stat qu'aucune ne porte).
// L'invariant qui compte réellement, et que ce test vérifie : le MULTISET
// DES VALEURS retenues (triées) est identique entre les deux méthodes — la
// sélection top-K reste correcte en valeur, peu importe laquelle des runes
// à égalité est choisie.

import { EffectLine, RuneDetail, StatKey } from '../src/types';
import { ScoredEntry, heapPush, runeContribution } from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

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

const SET_KEYS = ['violent', 'swift', 'will', 'shield', 'fight'];
const STAT_CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];

function randomRune(id: number, rng: () => number, sparse: boolean): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
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
    id, slot: 1, set, rank: 6, rarity: 5, level: 15,
    main: { code: mainCode, value: 10 + Math.floor(rng() * 100) },
    subs,
  };
}

// Référence NAÏVE, volontairement non optimisée : tri complet + slice —
// exactement ce que faisait `filterSlot` avant ce changement, isolé à cette
// seule boucle (pas la fonction entière, pour ne comparer QUE le mécanisme
// qui a changé).
function topKByFullSort(candidates: RuneDetail[], key: StatKey, keepN: number): number[] {
  return candidates
    .map((r) => runeContribution(r, key).pct + runeContribution(r, key).flat)
    .sort((a, b) => b - a)
    .slice(0, keepN);
}

// Le VRAI mécanisme : le `heapPush` exporté de `runeBuildOptim.ts`, celui
// que `filterSlot` appelle réellement — plus une réimplémentation locale.
function topKByHeap(candidates: RuneDetail[], key: StatKey, keepN: number): number[] {
  const heap: ScoredEntry<RuneDetail>[] = [];
  for (const r of candidates) {
    const c = runeContribution(r, key);
    heapPush(heap, { item: r, score: c.pct + c.flat }, keepN);
  }
  return heap.map((e) => e.score).sort((a, b) => b - a);
}

export default function testFilterSlotTopK() {
  titre('Optimizer · filterSlot — top-K par le VRAI tas vs tri complet (multiset de valeurs)');

  // Cas manuel : égalité EXACTE à la frontière du top-K. 5 runes à VIT 10,
  // keepN=3 → n'importe quelle sélection de 3 parmi les 5 doit donner le
  // même multiset de valeurs {10,10,10}, peu importe LESQUELLES.
  {
    const candidates: RuneDetail[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1, slot: 1, set: 'violent', rank: 6, rarity: 5, level: 15,
      main: { code: 8, value: 10 }, subs: [],
    }));
    const byFullSort = topKByFullSort(candidates, 'spd', 3);
    const byHeap = topKByHeap(candidates, 'spd', 3);
    egal(byFullSort, [10, 10, 10], 'référence : 3 des 5 valeurs à égalité (10)');
    egal(byHeap, byFullSort, 'vrai heapPush : même multiset de valeurs malgré l’égalité totale');
  }

  // Test différentiel : jeux aléatoires, seed fixe, plusieurs tailles —
  // l'invariant qui compte (multiset de VALEURS retenues) doit tenir sur
  // TOUS les scénarios, y compris ceux à beaucoup d'égalités (`sparse`),
  // contre le VRAI `heapPush` de production.
  {
    const SIZES = [5, 10, 25, 80, 300, 1200, 3000];
    const KEEP_NS = [6, 24]; // PER_STAT_KEEP / PER_STAT_KEEP_OBJECTIVE réels
    let scenarios = 0;
    let allIdentical = true;
    for (let s = 0; s < 150; s++) {
      const rng = mulberry32(12000 + s * 131);
      const n = SIZES[Math.floor(rng() * SIZES.length)];
      const sparse = rng() < 0.6;
      const candidates: RuneDetail[] = [];
      for (let i = 1; i <= n; i++) candidates.push(randomRune(i, rng, sparse));
      const key = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
      const keepN = KEEP_NS[Math.floor(rng() * KEEP_NS.length)];

      const ref = topKByFullSort(candidates, key, keepN);
      const got = topKByHeap(candidates, key, keepN);
      scenarios++;
      if (JSON.stringify(ref) !== JSON.stringify(got)) allIdentical = false;
    }
    ok(allIdentical, `top-K par le VRAI heapPush : multiset de valeurs identique à la référence par tri complet sur ${scenarios} scénarios aléatoires (tailles 5 à 3000, seed fixe)`);
  }
}
