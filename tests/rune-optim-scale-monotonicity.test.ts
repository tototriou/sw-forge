// Test de RÉGRESSION à ÉCHELLE RÉELLE pour la classe de bug BUCKET_CAP (voir
// spec/outils/optimizer/, section « BUCKET_CAP mis à l'échelle avec
// slotFilterCap ») : un demi-build valide, retenu à un préréglage de
// pré-filtrage ÉTROIT, peut disparaître de la rétention à un préréglage plus
// LARGE — l'inverse de ce qu'élargir le pré-filtrage devrait faire.
//
// ⚠️ `rune-optim-differential.test.ts` (comparaison à une référence
// brute-force) ne peut PAS détecter cette classe de bug : ses pools font 3
// runes/slot (729 combinaisons brute-force, volontairement minuscule) — bien
// en dessous de l'échelle où `bucketCap`/`slotFilterCap` interviennent
// réellement (des centaines de runes par slot). Ce test-ci vérifie autre
// chose : pas « le moteur trouve-t-il la bonne réponse », mais « le moteur
// perd-il une bonne réponse qu'il avait déjà quand on élargit le
// pré-filtrage » — la MONOTONICITÉ, à une échelle où elle a une chance de se
// briser.
//
// ⚠️ Trois essais avant celui-ci, gardés en note pour ne pas les rejouer :
// (1) injecter à la main un demi-build « médiocre mais valide » n'a pas
// suffi à faire échouer ce test avec l'ancien `bucketCap` fixe — un seul
// minimum posé ne crée pas assez de compétition. (2) exiger que TOUS les
// demi-builds retenus à Bas (plusieurs milliers) survivent EXACTEMENT à
// Extrême était trop strict : du renouvellement en queue de classement est
// NORMAL, même avec le correctif en place (mesuré : 91,1 % de survie avec
// le correctif — jamais 100 %). (3) ne suivre que les 5 meilleurs par
// EFFICIENCE ne discriminait pas non plus : les demi-builds les plus
// efficaces dans l'absolu restent en tête de n'importe quelle tranche, quel
// que soit `bucketCap` — ce n'est pas l'axe sur lequel la dilution frappe.
// Ce qui discrimine réellement, mesuré directement : le TAUX DE SURVIE sur
// l'ENSEMBLE des demi-builds retenus à Bas — 41,4 % avec l'ancien
// `bucketCap` fixe, 91,1 % avec le correctif, sur ce même scénario. Seuil
// retenu (70 %) confortablement entre les deux, avec de la marge des deux
// côtés pour la variance d'un scénario à l'autre.
//
// Rapide malgré l'échelle : `buildBuckets` SEUL (jamais `pairBuckets`),
// l'étage exact où la perte se produit.

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import { BuildRequirement, SearchParams, SLOT_FILTER_PRESETS, prepareSearch, buildBuckets } from '../src/lib/runeBuildOptim';
import { ok, titre } from './outils';

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

function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
  for (let i = 0; i < 4; i++) {
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

// ⚠️ 300 runes/slot, pas 3 (voir `rune-optim-differential.test.ts`) — au
// niveau du plus large préréglage réel (Extrême, slotFilterCap=300) : le
// pool brut doit dépasser chaque cap testé, sinon tous les préréglages
// verraient le même pool complet et la dilution ne pourrait jamais se
// manifester, quel que soit le bug.
const PER_SLOT = 300;
// Taux de survie minimum accepté — voir le commentaire de tête pour la
// mesure qui a fixé ce seuil (41,4 % ancien comportement, 91,1 % corrigé).
const MIN_SURVIVAL_RATE = 0.7;

function randomPool(rng: () => number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < PER_SLOT; i++) out.push(randomRune(id++, slot, rng));
  }
  return out;
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

function retainedHalves(prepared: NonNullable<ReturnType<typeof prepareSearch>>): Set<string> {
  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)
  );
  const ids = new Set<string>();
  for (const b of bucketsA) for (const combo of b.combos) ids.add(combo.runes.map((r) => r.id).sort((a, b2) => a - b2).join(','));
  return ids;
}

export default function testRuneOptimScaleMonotonicity() {
  titre('Optimizer · monotonicité à échelle réelle (bucketCap vs slotFilterCap)');

  const SCENARIOS = 2;
  const bas = SLOT_FILTER_PRESETS.find((p) => p.key === 'bas')!;
  const extreme = SLOT_FILTER_PRESETS.find((p) => p.key === 'extreme')!;

  for (let s = 0; s < SCENARIOS; s++) {
    const rng = mulberry32(3000 + s);
    const pool = randomPool(rng);

    // ⚠️ PLUSIEURS minimums À LA FOIS (comme le cas réel Sonia, 4 conditions
    // simultanées) — un seul minimum ne crée pas assez de compétition entre
    // demi-builds pour exercer la dilution (voir le commentaire de tête).
    const requirement: BuildRequirement = {
      sets: [],
      minStats: { spd: 130 + Math.floor(rng() * 20), cr: 30 + Math.floor(rng() * 15), cd: 60 + Math.floor(rng() * 20) },
    };

    const paramsAt = (cap: number): SearchParams => ({
      base: BASE, artifacts: [], pool, requirement, metric: 'eff', slotFilterCap: cap,
      // ⚠️ Pas de `bucketCap` : on vérifie la résolution PAR DÉFAUT
      // (`bucketCapFor`), le vrai chemin de production.
    });

    const preparedBas = prepareSearch(paramsAt(bas.cap));
    const preparedExtreme = prepareSearch(paramsAt(extreme.cap));
    if (!preparedBas || !preparedExtreme) {
      ok(false, `scénario ${s} : préparation impossible (pool ou exigence dégénérée) — scénario à revoir`);
      continue;
    }

    const halvesAtBas = retainedHalves(preparedBas);
    if (halvesAtBas.size === 0) {
      ok(false, `scénario ${s} : aucun demi-build retenu à Bas — scénario trop restrictif, à revoir`);
      continue;
    }
    const halvesAtExtreme = retainedHalves(preparedExtreme);

    let survived = 0;
    for (const half of halvesAtBas) if (halvesAtExtreme.has(half)) survived++;
    const rate = survived / halvesAtBas.size;

    ok(
      rate >= MIN_SURVIVAL_RATE,
      `scénario ${s} (${PER_SLOT} runes/slot, minStats=${JSON.stringify(requirement.minStats)}) : ` +
        `taux de survie des ${halvesAtBas.size} demi-build(s) retenu(s) à Bas, une fois à Extrême = ${(rate * 100).toFixed(1)}% (seuil ${(MIN_SURVIVAL_RATE * 100).toFixed(0)}%)`
    );
  }
}
