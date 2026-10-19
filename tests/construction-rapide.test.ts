// Différentiel de la construction des moitiés sur tableaux typés
// (src/lib/constructionRapide.ts, le chemin de production par `construireMoitie`)
// contre `buildBuckets`, la référence, sur des
// pools synthétiques : égalité PROFONDE des compartiments (`premiereDivergence`),
// pour la version séquentielle et pour le découpage en tranches + fusion.
//
// ⚠️ Le découpage en tranches est exécuté ici dans le même fil, tranche après
// tranche : c'est une allocation figée d'avance (chaque tranche reçoit ses
// indices au départ, aucun message ne change son comportement en cours de
// route), donc un verdict de justesse valide (skill optimizer-perf-testing,
// « Simulation séquentielle d'une coordination en direct »). Les vrais
// `worker_threads` sont exercés par le banc (scripts/banc-construction-moities.ts).
//
// La matrice : préréglages Bas à Extrême (`slotFilterCap`,
// `bucketCap` dérivé, le chemin de production), avec et sans
// `adaptiveTrancheWeighting`, chaque `combosOrderMode`. En plus, des plafonds de
// rétention minuscules (override de mesure, `SearchParams.bucketCap`) : ce sont
// eux qui forcent les évictions et les ex æquo à la racine des tas, là où une
// fusion approximative divergerait. Un témoin à plafond immense donne le nombre
// de combinaisons générées par compartiment, pour prouver que l'éviction a bien
// eu lieu (sinon le test ne vérifierait rien du tas).

import { BaseStats } from '../src/types';
import { Bucket, BuildRequirement, BuildingProgress, Objective, SearchParams, SLOT_FILTER_PRESETS, buildBuckets, prepareSearch } from '../src/lib/runeBuildOptim';
import { construireMoitie, motifRepliConstruction } from '../src/lib/rechercheRunes';
import { StatKey } from '../src/lib/effects';
import {
  OrdreCombos,
  construireMoitieRapide,
  construireTranche,
  contexteDe,
  fusionnerTranches,
  premiereDivergence,
  repartirIdx0,
} from '../src/lib/constructionRapide';
import { egal, ok, titre } from './outils';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const ORDRES: OrdreCombos[] = ['potential', 'relevance', 'combined', 'objective'];

interface Scenario {
  nom: string;
  seed: number;
  parEmplacement: number;
  requirement: BuildRequirement;
  objective: Objective;
  objectiveStats?: StatKey[];
}

const SCENARIOS: Scenario[] = [
  {
    // Set 4 pièces + Intangible : sauvetage du 3ᵉ emplacement, demi-build mort, jokers.
    nom: 'Violent, 3 minimums, objectif ATQ+DCC',
    seed: 2101,
    parEmplacement: 45,
    requirement: { sets: ['violent'], minStats: { spd: 120, cr: 40, cd: 70 } },
    objective: 'efficience',
    objectiveStats: ['atk', 'cd'],
  },
  {
    // Deux sets, PV/ATQ/DEF en pourcentage (arrondi de `weightedContribution`), objectif vide.
    nom: 'Swift + Will, 4 minimums, Efficience',
    seed: 2102,
    parEmplacement: 45,
    requirement: { sets: ['swift', 'will'], minStats: { hp: 11000, atk: 700, spd: 130, acc: 20 } },
    objective: 'efficience',
  },
];

function parametres(s: Scenario, pool: SearchParams['pool'], slotFilterCap: number, bucketCap: number | undefined, adaptatif: boolean, ordre: OrdreCombos): SearchParams {
  return {
    base: BASE, artifacts: [], pool, requirement: s.requirement, metric: 'eff',
    objective: s.objective, objectiveStats: s.objectiveStats, slotFilterCap,
    ...(bucketCap != null ? { bucketCap } : {}),
    adaptiveTrancheWeighting: adaptatif, combosOrderMode: ordre,
  };
}

const MOITIES = [
  { half: 'A' as const, slots: [0, 1, 2] as const },
  { half: 'B' as const, slots: [3, 4, 5] as const },
];

/** Production, séquentiel et tranches (3 entrelacées, puis 2 contiguës inégales) : rend la première divergence, ou null. */
function comparer(params: SearchParams, half: 'A' | 'B', slots: readonly [number, number, number]): { divergence: string | null; ref: Bucket[] } {
  const prepared = prepareSearch(params);
  if (!prepared) return { divergence: 'préparation vide (scénario à revoir)', ref: [] };
  const autre = half === 'A' ? prepared.maxSetsForA : prepared.maxSetsForB;
  const adaptatif = params.adaptiveTrancheWeighting ?? false;
  const ordre = params.combosOrderMode ?? 'objective';
  const ref = drain(buildBuckets(half, slots, prepared, autre, undefined, adaptatif, ordre));
  const seq = drain(construireMoitieRapide(half, slots, prepared, autre, adaptatif, ordre));
  const dSeq = premiereDivergence(ref, seq);
  if (dSeq) return { divergence: `séquentiel : ${dSeq}`, ref };
  const ctx = contexteDe(prepared);
  const n0 = prepared.filtered[slots[0]].length;
  const coupe = Math.max(1, Math.floor(n0 / 5));
  const partitions = [repartirIdx0(n0, 3), [Array.from({ length: coupe }, (_, i) => i), Array.from({ length: n0 - coupe }, (_, i) => coupe + i)]];
  for (const [p, partition] of partitions.entries()) {
    const tranches = partition.map((idx0s) => construireTranche({ ctx, slotIdxs: slots, otherHalfMaxSets: autre, adaptiveTrancheWeighting: adaptatif, idx0s }));
    const par = fusionnerTranches(ctx, slots, autre, adaptatif, ordre, tranches);
    const d = premiereDivergence(ref, par);
    if (d) return { divergence: `tranches (partition ${p}) : ${d}`, ref };
  }
  return { divergence: null, ref };
}

/** Le comparateur lui-même voit ce qu'il doit voir : ordre des combos, ordre des clés de bornes, identité des runes. */
function temoinsNegatifs() {
  const s = SCENARIOS[0];
  const pool = randomPool(mulberry32(s.seed), 20, SETS_JOKER);
  const prepared = prepareSearch(parametres(s, pool, 40, 5, false, 'objective'))!;
  const ref = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, false, 'objective'));
  const copie = (): Bucket[] => ref.map((b) => ({ ...b, combos: b.combos.map((c) => ({ ...c, pct: { ...c.pct }, flat: { ...c.flat } })), maxPct: { ...b.maxPct }, maxFlat: { ...b.maxFlat } }));
  ok(premiereDivergence(ref, copie()) === null, 'témoin : une copie profonde est identique');
  const b = ref.findIndex((x) => x.combos.length >= 2);
  const inverse = copie();
  inverse[b].combos = [...inverse[b].combos].reverse();
  ok(premiereDivergence(ref, inverse) !== null, 'témoin : deux combos permutés sont une divergence');
  const cles = copie();
  const k = Object.keys(cles[0].maxPct);
  if (k.length >= 2) cles[0].maxPct = Object.fromEntries([...k].reverse().map((x) => [x, cles[0].maxPct[x]]));
  ok(k.length < 2 || premiereDivergence(ref, cles) !== null, 'témoin : un ordre de clés de maxPct différent est une divergence');
  const rune = copie();
  rune[b].combos[0] = { ...rune[b].combos[0], runes: [{ ...rune[b].combos[0].runes[0] }, rune[b].combos[0].runes[1], rune[b].combos[0].runes[2]] };
  ok(premiereDivergence(ref, rune) !== null, 'témoin : une rune égale en valeur mais autre objet est une divergence');
}

/**
 * Le chemin de production (`construireMoitie`) : le noyau, mêmes compartiments
 * et mêmes points de passage que `buildBuckets` ; `buildBuckets` lui-même dès
 * qu'un traceur est demandé (la trace de la moitié est remplie) ; le motif de
 * repli au-delà de 2³¹ triplets.
 */
function testCheminDeProduction() {
  const s = SCENARIOS[0];
  const pool = randomPool(mulberry32(s.seed), 30, SETS_JOKER);
  const prepared = prepareSearch(parametres(s, pool, 80, undefined, false, 'objective'))!;
  for (const { half, slots } of MOITIES) {
    const autre = half === 'A' ? prepared.maxSetsForA : prepared.maxSetsForB;
    ok(motifRepliConstruction(prepared, slots) === null, `moitié ${half} : le noyau prend la construction (aucun motif de repli)`);
    const pas = (gen: Generator<BuildingProgress, Bucket[], void>) => {
      const vus: number[] = [];
      let step = gen.next();
      while (!step.done) {
        vus.push(step.value.scanned);
        step = gen.next();
      }
      return { vus, buckets: step.value };
    };
    const ref = pas(buildBuckets(half, slots, prepared, autre, undefined, false, 'objective'));
    const prod = pas(construireMoitie(half, slots, prepared, autre, false, 'objective'));
    ok(premiereDivergence(ref.buckets, prod.buckets) === null, `moitié ${half} : construireMoitie = buildBuckets (égalité profonde)`);
    egal(prod.vus, ref.vus, `moitié ${half} : mêmes points de passage (une rune du premier emplacement chacun)`);
  }
  // Traceur : le repli, qui remplit la trace de la moitié.
  const ids = [0, 1, 2, 3, 4, 5].map((i) => prepared.filtered[i][0].id);
  const traceAvec = prepareSearch({ ...parametres(s, pool, 80, undefined, false, 'objective'), traceur: { runeIds: ids } })!;
  ok(motifRepliConstruction(traceAvec, [0, 1, 2]) !== null, 'traceur demandé : motif de repli nommé');
  const avecTrace = drain(construireMoitie('A', [0, 1, 2], traceAvec, traceAvec.maxSetsForA, false, 'objective'));
  ok(traceAvec.traceur?.moities.A != null, 'traceur demandé : buildBuckets a rempli la trace de la moitié A');
  ok(premiereDivergence(drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, false, 'objective')), avecTrace) === null,
    'traceur demandé : mêmes compartiments que sans traceur');
  // Au-delà de 2³¹ triplets : seul le nombre de runes par emplacement compte.
  const enorme = { ...prepared, filtered: [new Array(1300), new Array(1300), new Array(1300), [], [], []] } as unknown as typeof prepared;
  ok(/32 bits/.test(motifRepliConstruction(enorme, [0, 1, 2]) ?? ''), '1 300³ triplets : repli sur buildBuckets, motif nommé');
  ok(motifRepliConstruction({ ...enorme, filtered: [new Array(1290), new Array(1290), new Array(1290)] } as unknown as typeof prepared, [0, 1, 2]) === null,
    '1 290³ triplets (< 2³¹) : le noyau garde la construction');
  // Capacités des tas hors des entiers 32 bits (override de mesure) : un
  // `Int32Array` les rendrait négatives (2³¹) ou nulles (`Infinity`), et le
  // noyau rendrait zéro combinaison. Repli sur buildBuckets, motif nommé.
  for (const bucketCap of [2 ** 31, Infinity]) {
    for (const adaptatif of [false, true]) {
      const p = prepareSearch(parametres(s, pool, 80, bucketCap, adaptatif, 'objective'))!;
      ok(/bucketCap|capacité/.test(motifRepliConstruction(p, [0, 1, 2], adaptatif) ?? ''), `bucketCap = ${bucketCap}, adaptatif=${adaptatif} : repli sur buildBuckets, motif nommé`);
      const ref = drain(buildBuckets('A', [0, 1, 2], p, p.maxSetsForA, undefined, adaptatif, 'objective'));
      const prod = drain(construireMoitie('A', [0, 1, 2], p, p.maxSetsForA, adaptatif, 'objective'));
      ok(ref.some((b) => b.combos.length > 0) && premiereDivergence(ref, prod) === null,
        `bucketCap = ${bucketCap}, adaptatif=${adaptatif} : construireMoitie = buildBuckets, combinaisons comprises (${ref.reduce((n, b) => n + b.combos.length, 0)})`);
    }
  }
  const tranches = 2 + prepared.retentionKeys.length;
  ok(motifRepliConstruction({ ...prepared, bucketCap: Math.floor(0x7fffffff / tranches) }, [0, 1, 2]) === null,
    `bucketCap × ${tranches} tranches ≤ 2³¹ − 1 : le noyau garde la construction`);
  ok(motifRepliConstruction({ ...prepared, bucketCap: 2.5 }, [0, 1, 2]) !== null, 'bucketCap non entier : repli, motif nommé');
}

export default function testConstructionRapide() {
  titre('Optimizer · construction des moitiés sur tableaux typés (constructionRapide) contre buildBuckets');
  temoinsNegatifs();
  testCheminDeProduction();

  for (const s of SCENARIOS) {
    const pool = randomPool(mulberry32(s.seed), s.parEmplacement, SETS_JOKER);

    // 1. La matrice, au chemin de production (`bucketCap` dérivé du préréglage).
    for (const preset of SLOT_FILTER_PRESETS) {
      for (const adaptatif of [false, true]) {
        for (const ordre of ORDRES) {
          for (const { half, slots } of MOITIES) {
            const { divergence, ref } = comparer(parametres(s, pool, preset.cap, undefined, adaptatif, ordre), half, slots);
            ok(
              divergence === null && ref.length > 0,
              `${s.nom} · ${preset.label} · adaptatif=${adaptatif} · ${ordre} · moitié ${half} : ` +
                (divergence ?? `identique (${ref.length} compartiments, ${ref.reduce((n, b) => n + b.combos.length, 0)} combos)`)
            );
          }
        }
      }
    }

    // 2. Rétention sous pression : plafonds minuscules, évictions et ex æquo à la racine.
    for (const { half, slots } of MOITIES) {
      const temoin = comparer(parametres(s, pool, 80, 1_000_000, false, 'objective'), half, slots);
      const generees = new Map(temoin.ref.map((b) => [`${b.counts.join(',')}|${b.jokers}`, b.combos.length]));
      for (const bucketCap of [1, 7, 50]) {
        for (const adaptatif of [false, true]) {
          for (const ordre of ORDRES) {
            const { divergence, ref } = comparer(parametres(s, pool, 80, bucketCap, adaptatif, ordre), half, slots);
            const evince = ref.some((b) => b.combos.length < (generees.get(`${b.counts.join(',')}|${b.jokers}`) ?? 0));
            ok(
              divergence === null && evince,
              `${s.nom} · bucketCap=${bucketCap} (override de mesure) · adaptatif=${adaptatif} · ${ordre} · moitié ${half} : ` +
                (divergence ?? (evince ? 'identique, avec évictions' : 'AUCUNE éviction : le scénario ne teste pas le tas'))
            );
          }
        }
      }
    }
  }
}
