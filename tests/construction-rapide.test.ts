// Différentiel du PROTOTYPE de construction des moitiés (src/lib/constructionRapide.ts,
// chantier perf-moteur, lot 2 bis) contre `buildBuckets` de production, sur des
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
// Matrice demandée par le lot : préréglages Bas à Extrême (`slotFilterCap`,
// `bucketCap` dérivé, le chemin de production), avec et sans
// `adaptiveTrancheWeighting`, chaque `combosOrderMode`. En plus, des plafonds de
// rétention minuscules (override de mesure, `SearchParams.bucketCap`) : ce sont
// eux qui forcent les évictions et les ex æquo à la racine des tas, là où une
// fusion approximative divergerait. Un témoin à plafond immense donne le nombre
// de combinaisons générées par compartiment, pour prouver que l'éviction a bien
// eu lieu (sinon le test ne vérifierait rien du tas).

import { BaseStats } from '../src/types';
import { Bucket, BuildRequirement, Objective, SearchParams, SLOT_FILTER_PRESETS, buildBuckets, prepareSearch } from '../src/lib/runeBuildOptim';
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
import { ok, titre } from './outils';
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

export default function testConstructionRapide() {
  titre('Optimizer · prototype de construction des moitiés (constructionRapide) contre buildBuckets');
  temoinsNegatifs();

  for (const s of SCENARIOS) {
    const pool = randomPool(mulberry32(s.seed), s.parEmplacement, SETS_JOKER);

    // 1. La matrice du lot, au chemin de production (`bucketCap` dérivé du préréglage).
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
