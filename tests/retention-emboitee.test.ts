// Préréglages emboîtés (src/lib/retentionEmboitee.ts, `construireMoitie`,
// `PreparedSearch.cransEmboites`) : la rétention d'un préréglage est l'union de
// la sienne et de celle de chaque préréglage plus étroit, chacune construite
// avec SES paramètres. Ce qui se vérifie, étage par étage :
// 1. les pools : celui d'un préréglage plus étroit est inclus dans celui de la
//    recherche, emplacement par emplacement, et `cransEmboites` porte EXACTEMENT
//    les paramètres d'une recherche lancée à ce préréglage (pool dans son ordre,
//    `bucketCap`, joker, bornes de sets) ;
// 2. les demi-builds : chaque préréglage contient ceux de chaque préréglage plus
//    étroit, et ceux qu'il retenait seul, à leur place (compartiments, bornes,
//    potentiel et ordre relatif inchangés) ;
// 3. la progression (un compte unique) et le traceur, relu après l'union ;
// 4. les builds valides, sur un profil du harnais, recherche complète :
//    Bas ⊆ Moyen ⊆ Haut ⊆ Extrême, et l'ancienne rétention de Moyen (un seul
//    préréglage) incluse dans la nouvelle ;
// 5. la construction en parallèle (un fil par moitié et par préréglage,
//    `construireMoitiesEmboitees`, le chemin de l'écran et de la coquille Node)
//    rend EXACTEMENT la construction séparée, préréglage après préréglage
//    (`construireMoitie` d'un bloc, la référence), compartiment par
//    compartiment et ordre compris : ajouts en Haut et en Extrême, venus de
//    plusieurs préréglages à la fois, pools différents, ordres `objective` et
//    `potential`, fils qui finissent dans le désordre ;
// 6. l'union refuse des préréglages non emboîtés ;
// 7. témoin du choix des fils séparés : parcouru dans l'ordre du pool large
//    (une seule passe), un préréglage plus étroit ne retient pas les mêmes
//    demi-builds que sa construction propre.
// Voir docs/03-developpeur/optimizer/moteur/elagages.md § Préréglages emboîtés.

import { BaseStats, RuneDetail } from '../src/types';
import {
  Bucket,
  BuildRequirement,
  HalfCombo,
  Objective,
  PreparedSearch,
  SLOT_FILTER_PRESETS,
  SearchParams,
  bucketCapFor,
  bucketKeyOf,
  ordonnerCombos,
  prepareSearch,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import { apparier, construireMoitie, totalConstruction } from '../src/lib/rechercheRunes';
import { LancerConstruction, construireMoitiesEmboitees, requetesDeLaMoitie } from '../src/lib/constructionEmboitee';
import { construireMoitieRapide } from '../src/lib/constructionRapide';
import { UnionDesRetentions } from '../src/lib/retentionEmboitee';
import { StatKey } from '../src/lib/effects';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { resoudreConfig } from '../scripts/lib/diagnosticConfig';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from '../scripts/lib/buildHalvesNode';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const MOITIES = [
  { half: 'A' as const, slots: [0, 1, 2] as const },
  { half: 'B' as const, slots: [3, 4, 5] as const },
];
const PRESETS = [...SLOT_FILTER_PRESETS].sort((a, b) => a.cap - b.cap);

const cleCombo = (c: HalfCombo): string => c.runes.map((r) => r.id).join(',');
const cles = (buckets: Bucket[]): Set<string> => new Set(buckets.flatMap((b) => b.combos.map(cleCombo)));
const manquants = (petit: Set<string>, grand: Set<string>): number => [...petit].filter((k) => !grand.has(k)).length;

/** Les compartiments par valeur (clé, potentiel, bornes, combinaisons par identifiants) : comparable d'un fil à l'autre. */
function empreinte(buckets: Bucket[]): string {
  return JSON.stringify(buckets.map((b) => [bucketKeyOf(b.counts, b.jokers), b.potential, b.maxPct, b.maxFlat, b.combos.map(cleCombo)]));
}

function parametres(pool: RuneDetail[], requirement: BuildRequirement, slotFilterCap: number, objective?: Objective, objectiveStats?: StatKey[]): SearchParams {
  return { base: BASE, artifacts: [], pool, requirement, metric: 'eff', objective, objectiveStats, slotFilterCap, maxMs: Infinity, maxCollected: Infinity };
}

const seul = (p: PreparedSearch): PreparedSearch => ({ ...p, cransEmboites: [] });
type Ordre = 'potential' | 'relevance' | 'combined' | 'objective';
const moitie = (p: PreparedSearch, half: 'A' | 'B', slots: readonly [number, number, number], ordre: Ordre = 'objective'): Bucket[] =>
  drain(construireMoitie(half, slots, p, half === 'A' ? p.maxSetsForA : p.maxSetsForB, ordre));

/**
 * Un lanceur DANS ce fil, qui fait finir les fils dans le désordre (le
 * préréglage le plus étroit d'abord) et relaie la progression de chacun.
 */
function lanceurDesordonne(): LancerConstruction {
  let rang = 0;
  return (requete, progression) => {
    const delai = 40 - 10 * (rang++ % 4);
    const gen = construireMoitie(requete.half, requete.slotIdxs, requete, requete.otherHalfMaxSets, requete.combosOrderMode);
    let step = gen.next();
    while (!step.done) {
      progression(step.value.scanned, step.value.total);
      step = gen.next();
    }
    const buckets = step.value;
    return new Promise((resolve) => setTimeout(() => resolve(buckets), delai));
  };
}

/* 1. Les pools ---------------------------------------------------------- */

function testPools() {
  const scenarios: { nom: string; sets: string[]; requirement: BuildRequirement; objective?: Objective; objectiveStats?: StatKey[] }[] = [
    { nom: 'Violent, emplacements libres, 3 minimums', sets: SETS_JOKER, requirement: { sets: ['violent'], minStats: { spd: 140, cr: 50, cd: 120 } } },
    { nom: 'Rage + Blade (coût complet)', sets: ['rage', 'blade', 'violent', 'swift', 'intangible'], requirement: { sets: ['rage', 'blade'], minStats: { atk: 1500, cr: 70 } } },
    { nom: 'Swift, 6 minimums (élargissement), Dégâts réels', sets: SETS_JOKER, requirement: { sets: ['swift'], minStats: { hp: 12000, atk: 900, def: 600, spd: 150, cr: 40, acc: 30 } }, objective: 'degats_reels', objectiveStats: ['atk', 'cd'] },
  ];
  for (const [i, s] of scenarios.entries()) {
    const pool = randomPool(mulberry32(4100 + i), 300, s.sets);
    for (const large of PRESETS) {
      const p = prepareSearch(parametres(pool, s.requirement, large.cap, s.objective, s.objectiveStats));
      if (!p) {
        ok(false, `${s.nom} · ${large.label} : préparation vide (scénario à revoir)`);
        continue;
      }
      const attendus = PRESETS.filter((e) => e.cap < large.cap).map((e) => e.cap).reverse();
      egal(p.cransEmboites.map((c) => c.slotFilterCap), attendus, `${s.nom} · ${large.label} : préréglages plus étroits, du plus large au plus étroit`);
      for (const cran of p.cransEmboites) {
        const etroit = prepareSearch(parametres(pool, s.requirement, cran.slotFilterCap, s.objective, s.objectiveStats))!;
        const ids = cran.indices.map((idx, slot) => idx.map((k) => p.filtered[slot][k].id));
        egal(ids, etroit.filtered.map((l) => l.map((r) => r.id)),
          `${s.nom} · ${large.label} ⊇ ${cran.slotFilterCap} : pool inclus emplacement par emplacement, dans l'ordre de son préréglage (${etroit.filtered.map((l) => l.length).join('/')} sur ${p.filtered.map((l) => l.length).join('/')})`);
        egal([cran.bucketCap, cran.jokerCredit, cran.maxSetsForA, cran.maxSetsForB], [bucketCapFor(cran.slotFilterCap), etroit.jokerCredit, etroit.maxSetsForA, etroit.maxSetsForB],
          `${s.nom} · ${large.label} ⊇ ${cran.slotFilterCap} : bucketCap, joker et bornes de sets de son propre pool`);
      }
    }
  }
  // Hors préréglage : un `slotFilterCap` libre emboîte les préréglages plus étroits que lui.
  const pool = randomPool(mulberry32(4200), 120, SETS_JOKER);
  const p = prepareSearch(parametres(pool, { sets: ['violent'], minStats: { spd: 140 } }, 100))!;
  egal(p.cransEmboites.map((c) => c.slotFilterCap), [80, 40], 'slotFilterCap 100 (hors préréglage) : emboîte Moyen et Bas');
  const omis = prepareSearch({ ...parametres(pool, { sets: ['violent'], minStats: { spd: 140 } }, 40), slotFilterCap: undefined })!;
  egal(omis.cransEmboites.length, 0, 'slotFilterCap omis (40, Bas) : aucun préréglage plus étroit');
}

/* 2. Les demi-builds ---------------------------------------------------- */

interface Etage {
  p: PreparedSearch;
  union: Record<'A' | 'B', Bucket[]>;
  seul: Record<'A' | 'B', Bucket[]>;
}

function construireEtages(pool: RuneDetail[], requirement: BuildRequirement): Map<number, Etage> {
  const out = new Map<number, Etage>();
  for (const preset of PRESETS) {
    const p = prepareSearch(parametres(pool, requirement, preset.cap))!;
    const e: Etage = { p, union: { A: [], B: [] }, seul: { A: [], B: [] } };
    for (const { half, slots } of MOITIES) {
      e.union[half] = moitie(p, half, slots);
      e.seul[half] = moitie(seul(p), half, slots);
    }
    out.set(preset.cap, e);
  }
  return out;
}

function testDemiBuilds(etages: Map<number, Etage>, nom: string) {
  for (const { half } of MOITIES) {
    for (const large of PRESETS) {
      const E = etages.get(large.cap)!;
      const union = E.union[half];
      const propre = E.seul[half];
      const cu = cles(union);
      // Le préréglage seul : rien ne bouge de ce qu'il retenait.
      egal(union.map((b) => bucketKeyOf(b.counts, b.jokers)), propre.map((b) => bucketKeyOf(b.counts, b.jokers)), `${nom} · ${large.label} · moitié ${half} : mêmes compartiments, dans le même ordre`);
      egal(union.map((b) => [b.potential, b.maxPct, b.maxFlat]), propre.map((b) => [b.potential, b.maxPct, b.maxFlat]), `${nom} · ${large.label} · moitié ${half} : même potentiel, mêmes bornes`);
      let ordre = true;
      for (let i = 0; i < propre.length; i++) {
        const dans = new Set(propre[i].combos.map(cleCombo));
        const sousSuite = union[i].combos.map(cleCombo).filter((k) => dans.has(k));
        if (sousSuite.join(';') !== propre[i].combos.map(cleCombo).join(';')) ordre = false;
      }
      ok(ordre, `${nom} · ${large.label} · moitié ${half} : chaque demi-build du préréglage seul est gardé, dans le même ordre relatif`);
      // Les ajouts sont rangés à leur place, pas en queue : la liste est déjà
      // dans l'ordre de `combosOrderMode` (le tri stable la laisse identique).
      ok(union.every((b) => ordonnerCombos(b.combos, E.p, 'objective', []).every((c, i) => c === b.combos[i])),
        `${nom} · ${large.label} · moitié ${half} : chaque compartiment de l'union est rangé selon combosOrderMode`);
      for (const etroit of PRESETS.filter((x) => x.cap < large.cap)) {
        const e = etages.get(etroit.cap)!;
        egal(manquants(cles(e.seul[half]), cu), 0, `${nom} · ${large.label} · moitié ${half} : contient les ${cles(e.seul[half]).size} demi-builds de ${etroit.label} seul`);
        egal(manquants(cles(e.union[half]), cu), 0, `${nom} · ${large.label} · moitié ${half} : contient les ${cles(e.union[half]).size} demi-builds de ${etroit.label} emboîté`);
      }
      if (large.cap > PRESETS[0].cap) {
        ok(cu.size === cles(propre).size + manquants(new Set([...PRESETS.filter((x) => x.cap < large.cap)].flatMap((x) => [...cles(etages.get(x.cap)!.seul[half])])), cles(propre)),
          `${nom} · ${large.label} · moitié ${half} : l'union est exactement le préréglage seul plus les demi-builds des plus étroits qui lui manquaient (${cles(propre).size} → ${cu.size})`);
      }
    }
  }
}

/* 3. Progression et traceur --------------------------------------------- */

function testProgressionEtTraceur(pool: RuneDetail[], requirement: BuildRequirement, etages: Map<number, Etage>) {
  const moyen = etages.get(80)!;
  for (const { half, slots } of MOITIES) {
    const vus: { scanned: number; total: number }[] = [];
    const gen = construireMoitie(half, slots, moyen.p, half === 'A' ? moyen.p.maxSetsForA : moyen.p.maxSetsForB, 'objective');
    let step = gen.next();
    while (!step.done) {
      vus.push({ scanned: step.value.scanned, total: step.value.total });
      step = gen.next();
    }
    const total = totalConstruction(moyen.p, slots);
    egal(total, moyen.p.filtered[slots[0]].length + moyen.p.cransEmboites[0].indices[slots[0]].length, `progression · moitié ${half} : total = runes du premier emplacement, Moyen puis Bas`);
    ok(vus.every((v) => v.total === total), `progression · moitié ${half} : un seul total (${total}) pour toute la construction`);
    egal(vus.map((v) => v.scanned), Array.from({ length: total }, (_, i) => i + 1), `progression · moitié ${half} : un point de passage par rune et par préréglage, sans retour en arrière`);
  }
  // Traceur : un demi-build qu'apporte Bas seul est relu présent après l'union.
  const propreA = cles(moyen.seul.A);
  const ajout = moyen.union.A.flatMap((b) => b.combos).find((c) => !propreA.has(cleCombo(c)));
  if (!ajout) {
    ok(false, 'traceur : aucun demi-build ajouté par Bas (scénario à revoir)');
    return;
  }
  const runeIds = [...ajout.runes.map((r) => r.id), ...[3, 4, 5].map((s) => moyen.p.filtered[s][0].id)];
  const p = prepareSearch({ ...parametres(pool, requirement, 80), traceur: { runeIds } })!;
  const avecTrace = drain(construireMoitie('A', [0, 1, 2], p, p.maxSetsForA, 'objective'));
  ok(empreinte(avecTrace) === empreinte(moyen.union.A), 'traceur : mêmes compartiments que sans traceur (repli de la recherche, préréglage plus étroit par le noyau)');
  const t = p.traceur!.moities.A!;
  const b = avecTrace.find((x) => bucketKeyOf(x.counts, x.jokers) === t.compartiment)!;
  ok(t.tranches?.every((x) => !x.retenue) === true, 'traceur : évincé de toutes les tranches de Moyen');
  egal([t.retenue, t.rang, t.population], [true, b.combos.findIndex((c) => cleCombo(c) === cleCombo(ajout)) + 1, b.combos.length], 'traceur : présence, rang et population relus sur le compartiment de l\'union');
}

/* 4. Les builds valides, sur un profil du harnais ----------------------- */

function rechercher(params: SearchParams, sansUnion = false): { cles: Set<string>; complet: boolean } {
  const p0 = prepareSearch(params)!;
  const p = sansUnion ? seul(p0) : p0;
  const A = moitie(p, 'A', [0, 1, 2]);
  const B = moitie(p, 'B', [3, 4, 5]);
  const r = drain(apparier(p, A, B));
  return { cles: new Set(r.candidates.map((c) => c.runeIds.join(','))), complet: !r.truncated && r.explored === totalPairCount(p, A, B) };
}

function testBuildsValides() {
  const base = resoudreConfig(configDuProfil(trouverProfil('complet-sensible'))).params;
  const params = (slotFilterCap: number, bucketCap?: number): SearchParams => {
    const p: SearchParams = { ...base, slotFilterCap, maxMs: Infinity, maxCollected: Infinity };
    delete p.bucketCap;
    if (bucketCap != null) p.bucketCap = bucketCap;
    return p;
  };
  const res = new Map<number, Set<string>>();
  for (const preset of PRESETS) {
    const r = rechercher(params(preset.cap));
    ok(r.complet, `profil complet-sensible · ${preset.label} : recherche complète (${r.cles.size} builds valides)`);
    res.set(preset.cap, r.cles);
  }
  for (const large of PRESETS) {
    for (const etroit of PRESETS.filter((x) => x.cap < large.cap)) {
      egal(manquants(res.get(etroit.cap)!, res.get(large.cap)!), 0, `profil complet-sensible : ${large.label} contient les ${res.get(etroit.cap)!.size} builds valides de ${etroit.label}`);
    }
  }
  const ancien = rechercher(params(80), true);
  egal(manquants(ancien.cles, res.get(80)!), 0, `profil complet-sensible : l'ancien Moyen (un seul préréglage, ${ancien.cles.size} builds) est inclus dans le nouveau (${res.get(80)!.size})`);
  // Un levier de mesure qui fait mordre l'union : Moyen à `bucketCap` 500
  // (override), Bas à son `bucketCap` dérivé, 3000. L'union doit gagner des
  // builds, sans en perdre aucun ni de Bas ni du Moyen réduit.
  const reduitSeul = rechercher(params(80, 500), true);
  const reduit = rechercher(params(80, 500));
  ok(reduit.complet, `profil complet-sensible · Moyen à bucketCap 500 ∪ Bas : recherche complète (${reduit.cles.size} builds valides)`);
  egal(manquants(reduitSeul.cles, reduit.cles), 0, `Moyen à bucketCap 500 : ses ${reduitSeul.cles.size} builds sont gardés par l'union`);
  egal(manquants(res.get(40)!, reduit.cles), 0, `Moyen à bucketCap 500 ∪ Bas : contient les ${res.get(40)!.size} builds valides de Bas`);
  ok(reduit.cles.size > reduitSeul.cles.size, `Moyen à bucketCap 500 : l'union gagne des builds (${reduitSeul.cles.size} → ${reduit.cles.size})`);
  // Pools DIFFÉRENTS d'un préréglage à l'autre, à leurs `bucketCap` dérivés
  // (aucun override) : 150 runes par emplacement, aucun set ; Moyen seul y
  // perd des builds valides de Bas, que l'union rend.
  const pool = randomPool(mulberry32(4300), 150, SETS_JOKER);
  const requirement: BuildRequirement = { sets: [], minStats: { spd: 400, cr: 185, cd: 355 } };
  const synth = new Map<number, Set<string>>();
  for (const cap of [40, 80, 150]) {
    const r = rechercher(parametres(pool, requirement, cap));
    ok(r.complet, `150 runes · ${cap} : recherche complète (${r.cles.size} builds valides)`);
    synth.set(cap, r.cles);
  }
  egal([manquants(synth.get(40)!, synth.get(80)!), manquants(synth.get(40)!, synth.get(150)!), manquants(synth.get(80)!, synth.get(150)!)], [0, 0, 0],
    '150 runes, pools différents : Bas ⊆ Moyen ⊆ Haut en builds valides');
  const ancienMoyen = rechercher(parametres(pool, requirement, 80), true);
  egal(manquants(ancienMoyen.cles, synth.get(80)!), 0, `150 runes : l'ancien Moyen (${ancienMoyen.cles.size} builds) est inclus dans le nouveau (${synth.get(80)!.size})`);
  ok(manquants(synth.get(40)!, ancienMoyen.cles) > 0 && synth.get(80)!.size > ancienMoyen.cles.size,
    `150 runes : l'ancien Moyen perdait ${manquants(synth.get(40)!, ancienMoyen.cles)} builds valides de Bas, le nouveau en gagne ${synth.get(80)!.size - ancienMoyen.cles.size}`);
}

/* 5. La coquille Node des Workers de moitié ----------------------------- */

async function testCoquilleNode(pool: RuneDetail[], requirement: BuildRequirement, etages: Map<number, Etage>) {
  const moyen = etages.get(80)!;
  const params = parametres(pool, requirement, 80);
  const r = await construireMoitiesEnParallele(moyen.p, params, await ensureBuildHalfBundle());
  ok(empreinte(r.bucketsA) === empreinte(moyen.union.A) && empreinte(r.bucketsB) === empreinte(moyen.union.B),
    'coquille Node (worker_threads de moitié) : la même union que le chemin séquentiel, compartiment par compartiment');
}

/* 5 bis. Parallèle contre séquentiel, ajouts de plusieurs préréglages ---- */

/** La construction en parallèle (lanceur dans ce fil, fils dans le désordre) contre `construireMoitie` d'un bloc, et sa progression. */
async function comparerParallele(p: PreparedSearch, nom: string, ordre: Ordre, reference?: Record<'A' | 'B', Bucket[]>) {
  const vus: Record<'A' | 'B', { scanned: number; total: number }[]> = { A: [], B: [] };
  const par = await construireMoitiesEmboitees(p, ordre, lanceurDesordonne(), (half, scanned, total) => vus[half].push({ scanned, total }));
  for (const { half, slots } of MOITIES) {
    const ref = reference?.[half] ?? moitie(p, half, slots, ordre);
    ok(empreinte(half === 'A' ? par.bucketsA : par.bucketsB) === empreinte(ref),
      `${nom} · moitié ${half} : en parallèle (${p.cransEmboites.length + 1} fils, finis dans le désordre) = construction séparée, compartiment par compartiment, ordre compris`);
    const total = totalConstruction(p, slots);
    const v = vus[half];
    ok(v.length > 0 && v.every((x, i) => x.total === total && (i === 0 || x.scanned >= v[i - 1].scanned)) && v[v.length - 1].scanned === total,
      `${nom} · moitié ${half} : progression en un compte (total ${total}), qui ne recule pas et finit au total`);
  }
}

async function testPlusieursPrereglages(etages: Map<number, Etage>, pool150: RuneDetail[], requirement150: BuildRequirement) {
  // 400 runes par emplacement, aucun set : quatre pools différents, et
  // chaque préréglage seul perd des demi-builds de PLUSIEURS préréglages plus
  // étroits — Haut de Bas et de Moyen, Extrême de Bas et de Moyen.
  const pool = randomPool(mulberry32(4400), 400, SETS_JOKER);
  const requirement: BuildRequirement = { sets: [], minStats: { spd: 150, cr: 45, cd: 110 } };
  const p = new Map(PRESETS.map((x) => [x.cap, prepareSearch(parametres(pool, requirement, x.cap))!]));
  const seulA = new Map(PRESETS.map((x) => [x.cap, cles(moitie(seul(p.get(x.cap)!), 'A', [0, 1, 2]))]));
  egal(new Set(PRESETS.map((x) => p.get(x.cap)!.filtered[0].length)).size, 4, '400 runes : quatre pools de tailles différentes');
  const unionExtremeA = moitie(p.get(300)!, 'A', [0, 1, 2]);
  for (const large of [150, 300]) {
    const union = large === 300 ? unionExtremeA : moitie(p.get(large)!, 'A', [0, 1, 2]);
    const cu = cles(union);
    const etroits = PRESETS.filter((x) => x.cap < large);
    const perdusSeul = etroits.map((x) => manquants(seulA.get(x.cap)!, seulA.get(large)!));
    ok(perdusSeul.filter((n) => n > 0).length >= 2,
      `400 runes · cap ${large} · moitié A : seul, il perd des demi-builds de plusieurs préréglages plus étroits (${etroits.map((x, i) => `${x.label} ${perdusSeul[i]}`).join(', ')})`);
    egal(etroits.map((x) => manquants(seulA.get(x.cap)!, cu)), etroits.map(() => 0), `400 runes · cap ${large} · moitié A : l'union les contient tous`);
    const attendu = new Set([...seulA.get(large)!, ...etroits.flatMap((x) => [...seulA.get(x.cap)!])]);
    egal(cu.size, attendu.size, `400 runes · cap ${large} · moitié A : l'union est exactement le préréglage seul plus les manquants (${seulA.get(large)!.size} → ${cu.size})`);
    ok(union.every((b) => ordonnerCombos(b.combos, p.get(large)!, 'objective', []).every((c, i) => c === b.combos[i])),
      `400 runes · cap ${large} · moitié A : ajouts rangés selon combosOrderMode`);
  }
  // Le chemin de la coquille Node : vrais worker_threads, Extrême (4 fils par moitié).
  const extreme = p.get(300)!;
  const reference = { A: unionExtremeA, B: moitie(extreme, 'B', [3, 4, 5]) };
  const r = await construireMoitiesEnParallele(extreme, parametres(pool, requirement, 300), await ensureBuildHalfBundle());
  ok(empreinte(r.bucketsA) === empreinte(reference.A) && empreinte(r.bucketsB) === empreinte(reference.B),
    '400 runes · Extrême : coquille Node (8 worker_threads) = construction séparée, compartiment par compartiment, ordre compris');
  // Dans ce fil, fils dans le désordre : ordres `objective` et `potential`, Moyen et Haut.
  await comparerParallele(etages.get(80)!.p, 'sans set · Moyen · objective', 'objective', etages.get(80)!.union);
  // `potential` : Moyen sur 150 runes (ajouts de Bas), Haut sur 400 runes (ajouts de Moyen et de Bas).
  for (const [cap, poolP, nomP] of [[80, pool150, 'sans set'], [150, pool, '400 runes']] as const) {
    const q = prepareSearch(parametres(poolP, requirement150, cap))!;
    const ref = { A: moitie(q, 'A', [0, 1, 2], 'potential'), B: moitie(q, 'B', [3, 4, 5], 'potential') };
    const seulPot = moitie(seul(q), 'A', [0, 1, 2], 'potential');
    ok(cles(ref.A).size > cles(seulPot).size, `${nomP} · cap ${cap} · potential : l'union ajoute des demi-builds (${cles(seulPot).size} → ${cles(ref.A).size})`);
    let ordreRelatif = true;
    ref.A.forEach((b, i) => {
      const dans = new Set(seulPot[i].combos.map(cleCombo));
      if (b.combos.map(cleCombo).filter((k) => dans.has(k)).join(';') !== seulPot[i].combos.map(cleCombo).join(';')) ordreRelatif = false;
    });
    ok(ordreRelatif, `${nomP} · cap ${cap} · potential : l'ordre relatif du préréglage seul est gardé`);
    await comparerParallele(q, `${nomP} · cap ${cap} · potential`, 'potential', ref);
  }
}

/* 7. Témoin : une seule passe dans l'ordre du pool large --------------- */

function testUneSeulePasse(etages: Map<number, Etage>) {
  const p = etages.get(80)!.p;
  const cran = p.cransEmboites[0];
  const inversions = cran.indices.map((idx) => idx.filter((x, i) => i > 0 && x < idx[i - 1]).length);
  ok(inversions.some((n) => n > 0), `témoin : l'ordre du pool de Bas n'est pas une sous-suite de celui de Moyen (inversions par emplacement : ${inversions.join('/')})`);
  const rq = requetesDeLaMoitie(p, 'A', 'objective')[1];
  const dansLOrdreLarge = cran.indices.map((idx, s) => [...idx].sort((a, b) => a - b).map((i) => p.filtered[s][i]));
  const propre = cles(drain(construireMoitieRapide('A', [0, 1, 2], rq, rq.otherHalfMaxSets, 'objective')));
  const large = cles(drain(construireMoitieRapide('A', [0, 1, 2], { ...rq, filtered: dansLOrdreLarge }, rq.otherHalfMaxSets, 'objective')));
  ok(manquants(propre, large) > 0,
    `témoin : Bas parcouru dans l'ordre du pool de Moyen perd ${manquants(propre, large)} de ses ${propre.size} demi-builds (scores de tranche égaux départagés par l'ordre d'arrivée) — d'où un fil par préréglage`);
}

/* 6. Refus -------------------------------------------------------------- */

function testRefus(etages: Map<number, Etage>) {
  const moyen = etages.get(80)!;
  const pools = [0, 1, 2].map((s) => moyen.p.filtered[s]) as [RuneDetail[], RuneDetail[], RuneDetail[]];
  const propre = moyen.seul.A;
  const u = new UnionDesRetentions(propre, pools);
  u.ajouter(propre);
  ok(u.ajoutes === 0 && u.resultat(moyen.p, 'objective') === propre, 'union sans ajout : les compartiments de la recherche, rendus tels quels');
  const etranger: Bucket = { ...propre[0], jokers: 7, combos: propre[0].combos.slice(0, 1) };
  let leve = false;
  try {
    new UnionDesRetentions(propre, pools).ajouter([etranger]);
  } catch {
    leve = true;
  }
  ok(leve, 'union : un compartiment absent de la recherche lève (préréglages non emboîtés)');
  const runeInconnue = { ...propre[0].combos[0].runes[0], id: -1 };
  const horsPool: Bucket = { ...propre[0], combos: [{ ...propre[0].combos[0], runes: [runeInconnue, propre[0].combos[0].runes[1], propre[0].combos[0].runes[2]] }] };
  leve = false;
  try {
    new UnionDesRetentions(propre, pools).ajouter([horsPool]);
  } catch {
    leve = true;
  }
  ok(leve, 'union : une rune absente du pool de la recherche lève');
}

export default async function testRetentionEmboitee() {
  titre('Optimizer · préréglages emboîtés (union des rétentions)');
  testPools();
  // 150 runes par emplacement, aucun set, trois minimums : les pools de Bas
  // (~85) et de Moyen (~115) diffèrent, et Moyen seul évince des demi-builds
  // que Bas retient (le témoin le vérifie) ; à 60 runes, aucun.
  const pool = randomPool(mulberry32(4300), 150, SETS_JOKER);
  const requirement: BuildRequirement = { sets: [], minStats: { spd: 150, cr: 45, cd: 110 } };
  const etages = construireEtages(pool, requirement);
  testDemiBuilds(etages, 'sans set');
  // Témoin : sans l'union, un préréglage plus large ne contient pas le plus
  // étroit sur ce scénario (moitié A) — l'union y a quelque chose à ajouter.
  const perdus = MOITIES.map(({ half }) => manquants(cles(etages.get(40)!.seul[half]), cles(etages.get(80)!.seul[half])));
  ok(perdus.some((n) => n > 0), `témoin : Moyen seul perd ${perdus.join(' / ')} demi-builds de Bas (moitiés A / B)`);
  // Un set à 4 pièces que la moitié B ne porte pas (joker obligatoire) : les
  // bornes de sets diffèrent d'une moitié à l'autre (`CranEmboite.maxSetsForA`
  // = [0], `maxSetsForB` = [3]) — une borne prise sur la mauvaise moitié
  // ferait construire à un préréglage plus étroit des compartiments que la
  // recherche n'a pas.
  const sansVioletEnB = [
    ...randomPool(mulberry32(4301), 100, SETS_JOKER).filter((r) => r.slot <= 3),
    ...randomPool(mulberry32(4302), 100, SETS_JOKER.filter((k) => k !== 'violent')).filter((r) => r.slot >= 4),
  ];
  const violent = construireEtages(sansVioletEnB, { sets: ['violent'], minStats: { spd: 150, cr: 45, cd: 110 } });
  egal([violent.get(80)!.p.cransEmboites[0].maxSetsForA, violent.get(80)!.p.cransEmboites[0].maxSetsForB], [[0], [3]], 'Violent absent de la moitié B : bornes de sets différentes par moitié');
  testDemiBuilds(violent, 'Violent absent de B');
  testProgressionEtTraceur(pool, requirement, etages);
  testBuildsValides();
  await testCoquilleNode(pool, requirement, etages);
  await testPlusieursPrereglages(etages, pool, requirement);
  testRefus(etages);
  testUneSeulePasse(etages);
}
