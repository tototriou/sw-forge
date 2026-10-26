// Différentiel de l'élagage de la construction (`candidatsDeLaLigne`,
// src/lib/constructionRapide.ts) : la construction de production, qui ne note
// pas les triplets qu'aucun tas n'accepterait, contre la MÊME construction qui
// note chaque triplet (`elaguer: false`), sur des pools synthétiques variés.
// Égalité profonde (`premiereDivergence` : compartiments dans l'ordre, comptes,
// jokers, potentiel, `maxPct`/`maxFlat` et l'ordre de leurs clés, demi-builds
// dans l'ordre avec leurs runes et leurs nombres par `Object.is`), pour :
// - chaque préréglage, par `construireMoitieTypee`, préréglages emboîtés et
//   union compris (Bas ⊆ Moyen ⊆ Haut ⊆ Extrême : chaque cran se construit
//   avec l'élagage) ;
// - chaque `combosOrderMode` ;
// - des plafonds de rétention de mesure minuscules, nul ou fractionnaire
//   (évictions et ex æquo à la racine, tas qui refuse tout) ;
// - des scénarios aux bords de la borne : PV/ATQ/DEF en pourcentage sur une
//   base multiple de 100 (notes entières, `ceil` sur sa frontière), base
//   impaire (notes fractionnaires), aucun minimum (pas de tranche combinée),
//   plus de quatre minimums, set à 4 pièces avec Intangible (sauvetage du
//   troisième emplacement, demi-build mort), deux sets.
// Chaque scénario prouve aussi que l'élagage a écarté des triplets (sinon le
// test ne vérifierait rien) et que la référence n'en écarte aucun.
// Voir docs/03-developpeur/optimizer/moteur/elagages.md § Pré-filtrage
// heuristique et compartiments.

import { BaseStats } from '../src/types';
import { BuildRequirement, Objective, PreparedSearch, SLOT_FILTER_PRESETS, SearchParams, prepareSearch } from '../src/lib/runeBuildOptim';
import { construireMoitieTypee } from '../src/lib/rechercheRunes';
import { CompteConstruction, OrdreCombos, construireMoitieRapideTypee, premiereDivergence } from '../src/lib/constructionRapide';
import { objetsDesCompartiments } from '../src/lib/demiBuildsTypes';
import { StatKey } from '../src/lib/effects';
import { SETS_JOKER, SETS_SANS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { ok, titre } from './outils';

const ORDRES: OrdreCombos[] = ['potential', 'relevance', 'combined', 'objective'];
const MOITIES = [
  { half: 'A' as const, slots: [0, 1, 2] as const },
  { half: 'B' as const, slots: [3, 4, 5] as const },
];

interface Scenario {
  nom: string;
  seed: number;
  parEmplacement: number;
  sets: string[];
  base: BaseStats;
  requirement: BuildRequirement;
  objective: Objective;
  objectiveStats?: StatKey[];
}

const RONDE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const IMPAIRE: BaseStats = { hp: 10037, atk: 693, def: 517, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 };

const SCENARIOS: Scenario[] = [
  {
    nom: 'Violent + Intangible, PV/ATQ/DEF en %, base ronde',
    seed: 3001, parEmplacement: 40, sets: SETS_JOKER, base: RONDE,
    requirement: { sets: ['violent'], minStats: { hp: 12000, atk: 900, def: 600, spd: 130 } },
    objective: 'efficience', objectiveStats: ['atk', 'cd'],
  },
  {
    nom: 'Swift + Will, base impaire, cinq minimums',
    seed: 3002, parEmplacement: 40, sets: SETS_JOKER, base: IMPAIRE,
    requirement: { sets: ['swift', 'will'], minStats: { hp: 14000, atk: 1100, def: 700, spd: 150, acc: 25 } },
    objective: 'efficience',
  },
  {
    nom: 'Aucun minimum (pas de tranche combinée), sans joker',
    seed: 3003, parEmplacement: 40, sets: SETS_SANS_JOKER, base: IMPAIRE,
    requirement: { sets: ['violent'], minStats: {} },
    objective: 'efficience', objectiveStats: ['hp', 'def'],
  },
  {
    nom: 'Sept minimums, aucun set demandé',
    seed: 3004, parEmplacement: 35, sets: SETS_JOKER, base: RONDE,
    requirement: { sets: [], minStats: { hp: 11000, atk: 800, def: 500, spd: 120, cr: 50, cd: 90, acc: 20 } },
    objective: 'efficience',
  },
];

function parametres(s: Scenario, pool: SearchParams['pool'], slotFilterCap: number, ordre: OrdreCombos, bucketCap?: number): SearchParams {
  return {
    base: s.base, artifacts: [], pool, requirement: s.requirement, metric: 'eff',
    objective: s.objective, objectiveStats: s.objectiveStats, slotFilterCap,
    ...(bucketCap != null ? { bucketCap } : {}),
    combosOrderMode: ordre,
  };
}

/** Production contre référence non élaguée, préréglages emboîtés compris : la première divergence, ou null. */
function comparer(p: PreparedSearch, half: 'A' | 'B', slots: readonly [number, number, number], ordre: OrdreCombos): { divergence: string | null; demiBuilds: number } {
  const autre = half === 'A' ? p.maxSetsForA : p.maxSetsForB;
  const ref = drain(construireMoitieTypee(half, slots, p, autre, ordre, { elaguer: false }));
  const prod = drain(construireMoitieTypee(half, slots, p, autre, ordre));
  return {
    divergence: premiereDivergence(objetsDesCompartiments(ref, p.filtered), objetsDesCompartiments(prod, p.filtered)),
    demiBuilds: ref.reduce((n, b) => n + b.combos.length, 0),
  };
}

/** Comptes de travail du préréglage de la recherche, avec et sans élagage. */
function comptes(p: PreparedSearch, half: 'A' | 'B', slots: readonly [number, number, number], ordre: OrdreCombos): { avec: CompteConstruction; sans: CompteConstruction } {
  const autre = half === 'A' ? p.maxSetsForA : p.maxSetsForB;
  const avec = { notes: 0, evites: 0 };
  const sans = { notes: 0, evites: 0 };
  drain(construireMoitieRapideTypee(half, slots, p, autre, ordre, { compte: avec }));
  drain(construireMoitieRapideTypee(half, slots, p, autre, ordre, { elaguer: false, compte: sans }));
  return { avec, sans };
}

export default function testConstructionElagage() {
  titre('Optimizer · construction des moitiés : l’élagage des triplets refusés par tous les tas ne change rien');

  for (const s of SCENARIOS) {
    const pool = randomPool(mulberry32(s.seed), s.parEmplacement, s.sets);

    // 1. Chaque préréglage (union des crans emboîtés), chaque ordre, chaque moitié.
    for (const preset of SLOT_FILTER_PRESETS) {
      for (const ordre of ORDRES) {
        const p = prepareSearch(parametres(s, pool, preset.cap, ordre));
        if (!p) {
          ok(false, `${s.nom} · ${preset.label} : préparation vide (scénario à revoir)`);
          continue;
        }
        for (const { half, slots } of MOITIES) {
          const { divergence, demiBuilds } = comparer(p, half, slots, ordre);
          ok(divergence === null && demiBuilds > 0,
            `${s.nom} · ${preset.label} (${1 + p.cransEmboites.length} préréglage(s)) · ${ordre} · moitié ${half} : ` +
              (divergence ?? `identique (${demiBuilds} demi-builds)`));
        }
      }
    }

    // 2. Plafonds de mesure : évictions fréquentes, plafond nul (tas qui refuse tout), fractionnaire.
    for (const bucketCap of [0, 1, 3, 2.5, 40]) {
      const p = prepareSearch(parametres(s, pool, 80, 'objective', bucketCap))!;
      for (const { half, slots } of MOITIES) {
        const { divergence, demiBuilds } = comparer(p, half, slots, 'objective');
        ok(divergence === null && (bucketCap === 0 || demiBuilds > 0),
          `${s.nom} · bucketCap=${bucketCap} (mesure) · moitié ${half} : ${divergence ?? `identique (${demiBuilds} demi-builds)`}`);
      }
    }

    // 3. L'élagage travaille vraiment, et la référence ne saute rien.
    const p = prepareSearch(parametres(s, pool, 80, 'objective', 40))!;
    for (const { half, slots } of MOITIES) {
      const { avec, sans } = comptes(p, half, slots, 'objective');
      ok(sans.evites === 0 && avec.evites > 0 && avec.notes + avec.evites === sans.notes && avec.notes < sans.notes,
        `${s.nom} · moitié ${half} : ${sans.notes} triplets notés sans élagage, ${avec.notes} avec (${avec.evites} reconnus refusés sans être notés)`);
    }
  }
}
