// `onStage` — l'observateur des quatre étages de préparation
// (`prepareSearch`, runeBuildOptim.ts). Ce qu'il faut prouver n'est PAS
// « l'observateur voit quelque chose » : c'est qu'il ne CHANGE rien, et que
// ce qu'il voit est bien l'état réel de chaque étage.
//
// ⚠️ Pourquoi ce fichier existe (discipline `algo-verify`) : `onStage` est
// une modification du code de PRODUCTION, faite pour un outil de diagnostic
// (spec/outils/optimizer/harnais-diagnostic.md, §2). La seule garantie qui
// compte pour la production est la NON-RÉGRESSION — d'où la première
// vérification ci-dessous, qui compare le `PreparedSearch` produit avec et
// sans observateur sur les MÊMES paramètres.
//
// ⚠️ Le pool est le même patron déterministe que
// `rune-optim-differential.test.ts` (mulberry32, seed fixe) : reproductible
// d'une exécution à l'autre, et assez petit pour rester instantané.

import { egal, ok, titre } from './outils';
import {
  BuildRequirement,
  PrepareStage,
  PreparedSearch,
  SearchParams,
  prepareSearch,
} from '../src/lib/runeBuildOptim';
import { StatKey } from '../src/lib/effects';
import { BaseStats, EffectLine, RuneDetail } from '../src/types';

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

const SET_KEYS = ['violent', 'swift', 'will', 'shield', 'fight', 'intangible'];
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

function randomPool(rng: () => number, perSlot: number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  }
  return out;
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

// ⚠️ Un cap de pré-filtrage VOLONTAIREMENT bas (5) avec 200 runes par
// emplacement : sans ça, `filterSlot` garderait tout et l'étage n'aurait rien
// à montrer — la vérification « le dernier étage réduit vraiment » ne
// prouverait plus rien. ⚠️ Et 30 runes/emplacement ne suffiraient PAS : le
// cap n'est pas une borne dure (voir `filterSlot`), qui garde en plus le
// meilleur de chaque stat (`PER_STAT_KEEP` × 8 clés) et une réserve hors
// combo — sur un petit pool, tout survit malgré un cap de 5.
function params(): SearchParams {
  const requirement: BuildRequirement = { sets: ['violent'], minStats: { spd: 130 } };
  return {
    base: BASE,
    artifacts: [],
    pool: randomPool(mulberry32(4242), 200),
    requirement,
    metric: 'eff',
    slotFilterCap: 5,
  };
}

// Empreinte comparable d'un `PreparedSearch` : `totalOf` est une FONCTION
// (jamais sérialisable), et le pool porte des objets entiers — on compare
// donc les ids retenus par emplacement plus les champs scalaires qui
// gouvernent la suite de la recherche.
function empreinte(p: PreparedSearch | null) {
  if (!p) return null;
  return {
    filtered: p.filtered.map((list) => list.map((r) => r.id)),
    minEntries: p.minEntries,
    maxEntries: p.maxEntries,
    constrainedKeys: p.constrainedKeys,
    retentionKeys: p.retentionKeys,
    objectiveKeys: p.objectiveKeys,
    distinctKeys: p.distinctKeys,
    requiredPieces: p.requiredPieces,
    jokerCredit: p.jokerCredit,
    maxSetsForA: p.maxSetsForA,
    maxSetsForB: p.maxSetsForB,
    bucketCap: p.bucketCap,
    maxCollected: p.maxCollected,
  };
}

export default function testRuneOptimOnStage() {
  titre('Optimizer — onStage (observation des étages de préparation)');

  // 1. NON-RÉGRESSION — la seule garantie qui engage la production.
  const sans = prepareSearch(params());
  const vus: PrepareStage[] = [];
  const avec = prepareSearch(params(), (stage) => void vus.push(stage));
  egal(empreinte(avec), empreinte(sans), 'un observateur ne change RIEN au PreparedSearch produit');

  // 2. Les quatre étages, dans l'ordre du pipeline.
  egal(vus, ['mainstat', 'dominance', 'feasibility', 'filterslot'], 'les 4 étages sont signalés, dans l’ordre');

  // 3. Ce que l'observateur reçoit est bien l'état de CET étage : chaque
  //    étage ne fait que RETIRER des runes (aucun n'en crée, aucun n'en
  //    déplace d'un emplacement à l'autre), et le dernier état vu est
  //    exactement le `filtered` retourné.
  const etats = new Map<PrepareStage, number[][]>();
  const resultat = prepareSearch(params(), (stage, bySlot) => {
    etats.set(stage, bySlot.map((list) => list.map((r) => r.id)));
  });
  const ordre: PrepareStage[] = ['mainstat', 'dominance', 'feasibility', 'filterslot'];

  let inclusionPartout = true;
  let jamaisDeplacee = true;
  for (let i = 1; i < ordre.length; i++) {
    const avantEtage = etats.get(ordre[i - 1])!;
    const apresEtage = etats.get(ordre[i])!;
    for (let slot = 0; slot < 6; slot++) {
      const source = new Set(avantEtage[slot]);
      if (!apresEtage[slot].every((id) => source.has(id))) inclusionPartout = false;
    }
  }
  // Aucun étage ne déplace une rune d'un emplacement vers un autre : l'id
  // d'une rune de l'emplacement N reste dans l'emplacement N.
  const pool = params().pool;
  const slotDe = new Map(pool.map((r) => [r.id, r.slot]));
  for (const [, bySlot] of etats) {
    for (let slot = 0; slot < 6; slot++) {
      if (!bySlot[slot].every((id) => slotDe.get(id) === slot + 1)) jamaisDeplacee = false;
    }
  }
  ok(inclusionPartout, 'chaque étage ne fait que RETIRER : sa sortie est incluse dans son entrée');
  ok(jamaisDeplacee, 'aucun étage ne déplace une rune d’un emplacement à un autre');
  egal(
    etats.get('filterslot'),
    resultat!.filtered.map((list) => list.map((r) => r.id)),
    'le dernier état observé EST le `filtered` retourné'
  );

  // 4. L'état observé à `filterslot` est bien celui d'APRÈS le pré-filtrage,
  //    pas une copie de l'état précédent : avec un cap de 5 sur 200 runes par
  //    emplacement, il réduit forcément.
  const apresFaisabilite = etats.get('feasibility')!;
  const apresFiltrage = etats.get('filterslot')!;
  ok(
    apresFiltrage.some((list, slot) => list.length < apresFaisabilite[slot].length),
    'l’état `filterslot` est bien POSTÉRIEUR au pré-filtrage (il réduit)'
  );

  // 5. ⚠️ Cas où `prepareSearch` renvoie `null` : l'observateur doit AVOIR
  //    vu les quatre étages malgré tout — c'est précisément la situation
  //    qu'un diagnostic cherche à localiser (quel étage a vidé
  //    l'emplacement ?), et un signal posté après le retour anticipé
  //    n'existerait pas.
  const impossible: SearchParams = {
    ...params(),
    // Un minimum de vitesse inatteignable : la faisabilité vide les
    // emplacements bien avant le pré-filtrage.
    requirement: { sets: [], minStats: { spd: 9999 } as Record<StatKey, number> },
  };
  const vusNull: PrepareStage[] = [];
  const rienTrouve = prepareSearch(impossible, (stage) => void vusNull.push(stage));
  egal(rienTrouve, null, 'une exigence inatteignable donne bien `null`');
  egal(vusNull, ['mainstat', 'dominance', 'feasibility', 'filterslot'], 'les 4 étages sont observés MÊME quand la préparation échoue');
}
