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

import { BaseStats, RuneDetail } from '../src/types';
import { BuildRequirement, SearchParams, SLOT_FILTER_PRESETS, prepareSearch, buildBuckets } from '../src/lib/runeBuildOptim';
import { ok, titre } from './outils';
// Pool synthétique PARTAGÉ — voir scripts/lib/randomPool.ts.
import { SETS_SANS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';

// ⚠️ 300 runes/slot, pas 3 (voir `rune-optim-differential.test.ts`) — au
// niveau du plus large préréglage réel (Extrême, slotFilterCap=300) : le
// pool brut doit dépasser chaque cap testé, sinon tous les préréglages
// verraient le même pool complet et la dilution ne pourrait jamais se
// manifester, quel que soit le bug.
const PER_SLOT = 300;
// Taux de survie minimum accepté — voir le commentaire de tête pour la
// mesure qui a fixé ce seuil (41,4 % ancien comportement, 91,1 % corrigé).
const MIN_SURVIVAL_RATE = 0.7;

const poolDeCeTest = (rng: () => number): RuneDetail[] => randomPool(rng, PER_SLOT, SETS_SANS_JOKER);

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
    const pool = poolDeCeTest(rng);

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
