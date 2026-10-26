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

import { BaseStats, RuneDetail } from '../src/types';
import { BuildBucketsContext, BuildRequirement, Objective, PreparedSearch, SLOT_FILTER_PRESETS, SearchParams, prepareSearch } from '../src/lib/runeBuildOptim';
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

/**
 * Balayage sur de petits pools, plafonds de 1, 2 et 4, contre la référence
 * non élaguée ; rend le nombre de cas et la première divergence.
 * - `pvRare` : PV% retiré de 95 % des runes et un minimum sur les PV. Une
 *   classe de la troisième rune pose alors souvent la PREMIÈRE borne non
 *   nulle de `maxPct` dans un compartiment déjà plein : sans la garde qui la
 *   traite triplet par triplet, l'ordre des clés de `maxPct` diverge.
 * - `platFractionnaire` : PV, ATQ et DEF plats des sous-stats décalés de
 *   0,25. Avec des apports plats entiers, la note `ceil(y) + f` dépasse une
 *   racine entière exactement quand `y + f` la dépasse, et le `+ 1` des
 *   bornes en pourcentage et combinée ne se voit pas ; une racine
 *   fractionnaire le rend nécessaire.
 */
function balayage(variante: 'pvRare' | 'platFractionnaire'): { cas: number; divergence: string | null } {
  let cas = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const rng = mulberry32(seed);
    const pool = randomPool(rng, 18, SETS_JOKER);
    for (const r of pool) {
      if (variante === 'pvRare') {
        if (rng() < 0.05) continue;
        if (r.main.code === 2) r.main = { code: 8, value: r.main.value };
        r.subs = r.subs.map((l) => (l.code === 2 ? { code: 8, value: l.value } : l));
      } else {
        r.subs = r.subs.map((l) => (l.code === 1 || l.code === 3 || l.code === 5 ? { code: l.code, value: l.value + 0.25 } : l));
      }
    }
    const minStats = variante === 'pvRare' ? { hp: 1 } : { hp: 12000, atk: 900, def: 600 };
    for (const bucketCap of [1, 2, 4]) {
      const p = prepareSearch({
        base: IMPAIRE, artifacts: [], pool, metric: 'eff', requirement: { sets: [], minStats },
        objective: 'efficience', slotFilterCap: 80, bucketCap, combosOrderMode: 'objective',
      });
      if (!p) continue;
      for (const { half, slots } of MOITIES) {
        cas++;
        const { divergence } = comparer(p, half, slots, 'objective');
        if (divergence) return { cas, divergence: `graine ${seed}, bucketCap ${bucketCap}, moitié ${half} : ${divergence}` };
      }
    }
  }
  return { cas, divergence: null };
}

/**
 * Le `+ 1` des bornes, éprouvé directement sur le noyau, un plafond de 1 et
 * une seule tranche par stat en pourcentage (`tranche: 'pv'`, PV en tranche
 * de rétention) ou la seule tranche combinée (`tranche: 'combinee'`, un
 * minimum de PV sans tranche par stat : contexte posé à la main, que
 * `prepareSearch` ne produit pas, pour qu'aucune autre tranche ne garde le
 * triplet). Base PV 10, donc `y = PV% / 10` :
 * - ligne 1 (rune s1a, 10,75 PV plats) : (r0, s1a, B) note ceil(0,5) + 10,75
 *   = 11,75, la racine ;
 * - ligne 2 (rune s1b, PV% 110) : (r0, s1b, B) note ceil(11,5) = 12 > 11,75,
 *   alors que `y + f` = 11,5 ≤ 11,75 : sans le `+ 1`, il serait sauté à tort.
 * La rune E, très efficiente et sans PV, tient la racine de la tranche
 * d'efficience au-dessus de (r0, s1b, B).
 */
function bordDuPlafond(tranche: 'pv' | 'combinee'): { divergence: string | null; retenu: boolean } {
  const rune = (id: number, slot: number, subs: { code: number; value: number }[]): RuneDetail => ({
    id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: 9, value: 1 }, subs,
  });
  const r0 = rune(1, 1, []);
  const s1a = rune(2, 2, [{ code: 1, value: 10.75 }]);
  const s1b = rune(3, 2, [{ code: 2, value: 110 }]);
  const b = rune(4, 3, [{ code: 2, value: 5 }]);
  const e = rune(5, 3, [{ code: 8, value: 500 }, { code: 10, value: 500 }]);
  const ctx: BuildBucketsContext = {
    filtered: [[r0], [s1a, s1b], [b, e], [r0], [s1a], [b]],
    distinctKeys: [], requiredPieces: [], jokerCredit: 0, bucketCap: 1,
    constrainedKeys: tranche === 'pv' ? [] : ['hp'],
    retentionKeys: tranche === 'pv' ? ['hp'] : [],
    minEntries: tranche === 'pv' ? [] : [{ k: 'hp', min: 1 }],
    base: { hp: 10, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 },
    objectiveKeys: tranche === 'pv' ? ['hp'] : [],
  };
  const ref = drain(construireMoitieRapideTypee('A', [0, 1, 2], ctx, [], 'objective', { elaguer: false }));
  const prod = drain(construireMoitieRapideTypee('A', [0, 1, 2], ctx, [], 'objective'));
  const objets = objetsDesCompartiments(ref, ctx.filtered);
  return {
    divergence: premiereDivergence(objets, objetsDesCompartiments(prod, ctx.filtered)),
    retenu: objets.some((c) => c.combos.some((x) => x.runes[1] === s1b && x.runes[2] === b)),
  };
}

export default function testConstructionElagage() {
  titre('Optimizer · construction des moitiés : l’élagage des triplets refusés par tous les tas ne change rien');

  for (const tranche of ['pv', 'combinee'] as const) {
    const { divergence, retenu } = bordDuPlafond(tranche);
    ok(divergence === null && retenu,
      `borne de la tranche ${tranche} au bord du plafond : ${divergence ?? (retenu ? 'identique, (r0, s1b, B) retenu' : '(r0, s1b, B) absent : le cas ne teste rien')}`);
  }

  for (const variante of ['pvRare', 'platFractionnaire'] as const) {
    const { cas, divergence } = balayage(variante);
    ok(divergence === null && cas >= 150, `balayage ${variante} : ${divergence ?? `${cas} cas identiques`}`);
  }

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
