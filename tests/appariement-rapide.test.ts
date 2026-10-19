// Oracle EXHAUSTIF du prototype de noyau d'appariement
// (src/lib/appariementRapide.ts, chantier perf-moteur, lot 2).
//
// Trois vérifications, dans l'ordre où une erreur se produirait :
//
// 1. **Frontières** : pour chaque forme de condition (minimum ou maximum, sur
//    une stat en pourcentage ou plate, aura RES/PRE externe comprise, seuil
//    entier ou non), le seuil du noyau (`W ≤ L`, `W > H`) rend EXACTEMENT le
//    verdict de l'expression de `quickOk`, aux totaux `t − 1`, `t`, `t + 1`
//    et sur tous les restes de l'arrondi `ceil`.
// 2. **Paire par paire** : sur de petits espaces (pools générés, profils
//    synthétiques du harnais), une énumération de référence de TOUTES les
//    paires (prédicats de production, `quickOk` recopié sur les Records)
//    — chaque paire qui passe `quickOk` doit avoir été VISITÉE par le
//    prototype (aucune paire sautée à tort), sur ses trois chemins ; et
//    `visitees + sautees = traitees = totalPairCount`.
// 3. **Différentiel** contre `pairBuckets` sur les MÊMES compartiments :
//    candidats (ids, stats, effTotal) dans l'ordre, `explored`, quasi-succès,
//    troncature — non tronqué, sous petit `maxCollected`, et arrêté au point
//    de passage `traitees = N` ; puis la répartition en morceaux (fusion dans
//    l'ordre), simulée dans le processus avec des morceaux rendus dans le
//    désordre : le résultat n'y dépend pas du temps, seulement de l'ordre de
//    fusion, que la simulation exerce.

import { BaseStats } from '../src/types';
import { StatKey } from '../src/lib/effects';
import {
  Bucket,
  BuildRequirement,
  PairingProgress,
  PreparedSearch,
  SearchParams,
  SearchResult,
  bucketPairFeasibleMin,
  buildBuckets,
  comboAFeasible,
  pairBuckets,
  prepareSearch,
  satisfiesSets,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import {
  InitTravailleur,
  Morceau,
  MoitieTypee,
  ResultatMorceau,
  apparierRapide,
  constantesNoyau,
  initialiserTravailleur,
  seuilsLigne,
  traiterMorceau,
  verifierContrat,
} from '../src/lib/appariementRapide';
import { LancerTravailleur, apparierRapideEnParallele } from '../src/lib/appariementRapideParallele';
import { egal, ok, titre } from './outils';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import { resoudreConfig } from '../scripts/lib/diagnosticConfig';

// ⚠️ Bases premières avec 100 : `b × p` parcourt alors TOUS les restes modulo
// 100, donc tous les arrondis de `ceil(b × p / 100)`. Une base ronde (500,
// 8000) n'en produit qu'un, et laisse passer une borne fausse d'une unité.
const BASE: BaseStats = { hp: 8073, atk: 517, def: 401, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

/* --------------------------------------------------------------------------
 * 1. Frontières
 * ----------------------------------------------------------------------- */

function preparerFrontieres(): PreparedSearch {
  const pool = randomPool(mulberry32(42), 30);
  const requirement: BuildRequirement = {
    sets: ['swift'],
    minStats: { atk: 501, def: 401, spd: 101, res: 16, cd: 51 },
    maxStats: { hp: 1_000_000, def: 1_000_000, acc: 1_000_000 },
    auraResPre: { res: 15, acc: 8, compter: true },
  };
  const params: SearchParams = {
    base: BASE, artifacts: [], pool, requirement, metric: 'eff', maxMs: Infinity,
    artifactBounds: { max: { hp: 1500, atk: 100, def: 100 }, min: { hp: 0, atk: 0, def: 0 }, possibles: [{ hp: 1500 }, { atk: 100 }, { def: 100 }] },
  };
  const prepared = prepareSearch(params);
  if (!prepared) throw new Error('préparation des frontières vide');
  return prepared;
}

function testFrontieres(): void {
  titre('Appariement rapide · seuils du noyau aux frontières (t − 1, t, t + 1)');
  const base = preparerFrontieres();
  const rng = mulberry32(7);
  // Seuils entiers et non entiers ; le maximum en double d'un minimum sur DEF.
  const variantes: { min: { k: StatKey; min: number }[]; max: { k: StatKey; max: number }[] }[] = [
    { min: [{ k: 'atk', min: 1203 }, { k: 'def', min: 640 }, { k: 'spd', min: 180 }, { k: 'res', min: 61 }, { k: 'cd', min: 140 }], max: [{ k: 'hp', max: 15_011 }, { k: 'def', max: 930 }, { k: 'acc', max: 45 }] },
    { min: [{ k: 'atk', min: 1203.5 }, { k: 'def', min: 640.25 }, { k: 'spd', min: 180.5 }, { k: 'res', min: 61.75 }, { k: 'cd', min: 140.1 }], max: [{ k: 'hp', max: 15_011.5 }, { k: 'def', max: 930.9 }, { k: 'acc', max: 45.5 }] },
  ];
  for (const [vi, v] of variantes.entries()) {
    const prepared: PreparedSearch = { ...base, minEntries: v.min, maxEntries: v.max };
    const c = constantesNoyau(prepared);
    let comparaisons = 0;
    let ecarts = 0;
    const totauxVus = new Map<string, Set<number>>();
    const restes = new Set<number>();
    for (let essai = 0; essai < 40; essai++) {
      const A: MoitieTypee = { debut: Int32Array.of(0, 1), ids: new Int32Array(3), pct: new Int32Array(c.m), flat: new Int32Array(c.m) };
      for (let kk = 0; kk < c.m; kk++) {
        A.pct[kk] = Math.floor(rng() * 60);
        A.flat[kk] = Math.floor(rng() * 300);
      }
      const L = new Float64Array(c.m);
      const H = new Float64Array(c.m);
      seuilsLigne(c, A, 0, L, H);
      const verifier = (kk: number, kind: 'min' | 'max', seuil: number, gP: number, rp: number, gF: number, af: number) => {
        const k = c.cles[kk];
        const pA = A.pct[kk];
        const fA = A.flat[kk];
        for (let pB = 0; pB <= 40; pB++) {
          if (c.pct[kk]) restes.add((c.b[kk] * (pA + pB + gP + rp)) % 100);
          const T0 = c.totalOf(k, pA + pB + gP + rp, fA + 0 + gF + af);
          const centre = Math.round(seuil - T0);
          for (let fB = centre - 4; fB <= centre + 4; fB++) {
            const T = c.totalOf(k, pA + pB + gP + rp, fA + fB + gF + af);
            const reference = kind === 'min' ? T < seuil : T > seuil;
            const W = c.pct[kk] ? c.b[kk] * pB + 100 * fB : fB;
            const noyau = kind === 'min' ? W <= L[kk] : W > H[kk];
            comparaisons++;
            if (reference !== noyau) ecarts++;
            const cle = `${k}-${kind}`;
            if (!totauxVus.has(cle)) totauxVus.set(cle, new Set());
            totauxVus.get(cle)!.add(T - (kind === 'min' ? Math.ceil(seuil) : Math.floor(seuil)));
          }
        }
      };
      for (const e of c.minEntrees) verifier(e.kk, 'min', e.min, e.gmP, e.rp, e.gmF, e.af);
      for (const e of c.maxEntrees) verifier(e.kk, 'max', e.max, e.gP, e.rp, e.gF, e.af);
    }
    egal(ecarts, 0, `variante ${vi} (${vi === 0 ? 'seuils entiers' : 'seuils non entiers'}) : verdict du seuil = verdict de quickOk sur ${comparaisons} totaux`);
    egal(restes.size, 100, `variante ${vi} : les 100 restes de b × p modulo 100 sont parcourus (tous les arrondis de ceil)`);
    for (const [cle, vus] of totauxVus) {
      ok(vus.has(-1) && vus.has(0) && vus.has(1), `variante ${vi}, ${cle} : totaux t − 1, t et t + 1 atteints`);
    }
  }
  // L'aura externe RES/PRE n'est comptée qu'une fois : `A0` vaut la part externe.
  const c = constantesNoyau(base);
  egal(c.A0[c.cles.indexOf('res')], 15, 'aura RES externe lue une fois dans totalOf (A0 = 15)');
}

/* --------------------------------------------------------------------------
 * 2. Paire par paire
 * ----------------------------------------------------------------------- */

// `quickOk` de `pairBuckets`, recopié sur les Records (référence de l'oracle).
function quickOkRecords(prepared: PreparedSearch, comboA: Bucket['combos'][number], comboB: Bucket['combos'][number]): boolean {
  const { minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, relPctMin, artFlatMax, artFlatMin, totalOf } = prepared;
  for (const { k, min } of minEntries) {
    const p = (comboA.pct[k] ?? 0) + (comboB.pct[k] ?? 0) + (guaranteedMin.pct[k] ?? 0) + (relPctMax[k] ?? 0);
    const f = (comboA.flat[k] ?? 0) + (comboB.flat[k] ?? 0) + (guaranteedMin.flat[k] ?? 0) + (artFlatMax[k] ?? 0);
    if (totalOf(k, p, f) < min) return false;
  }
  for (const { k, max } of maxEntries) {
    const p = (comboA.pct[k] ?? 0) + (comboB.pct[k] ?? 0) + (guaranteed.pct[k] ?? 0) + (relPctMin[k] ?? 0);
    const f = (comboA.flat[k] ?? 0) + (comboB.flat[k] ?? 0) + (guaranteed.flat[k] ?? 0) + (artFlatMin[k] ?? 0);
    if (totalOf(k, p, f) > max) return false;
  }
  return true;
}

// Toutes les paires de l'espace — boucles imbriquées simples, indépendantes
// de l'ordre du prototype ; prédicats de production.
function enumerer(prepared: PreparedSearch, bucketsA: Bucket[], bucketsB: Bucket[]): { total: number; passantes: Set<string> } {
  const { distinctKeys, requirement, minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, relPctMin, artFlatMax, artFlatMin, totalOf } = prepared;
  let total = 0;
  const passantes = new Set<string>();
  bucketsA.forEach((bA, iA) => {
    bucketsB.forEach((bB, iB) => {
      if (bA.jokers + bB.jokers > 1) return;
      if (!satisfiesSets(bA.counts, bA.jokers, bB.counts, bB.jokers, distinctKeys, requirement)) return;
      if (!bucketPairFeasibleMin(bA, bB, minEntries, guaranteedMin, relPctMax, artFlatMax, totalOf)) return;
      bA.combos.forEach((comboA, a) => {
        if (!comboAFeasible(comboA, bB, minEntries, maxEntries, guaranteed, guaranteedMin, relPctMax, artFlatMax, totalOf, artFlatMin, relPctMin)) return;
        bB.combos.forEach((comboB, j) => {
          total++;
          if (quickOkRecords(prepared, comboA, comboB)) passantes.add(`${iA}:${a}:${iB}:${j}`);
        });
      });
    });
  });
  return { total, passantes };
}

interface Espace {
  nom: string;
  params: SearchParams;
  prepared: PreparedSearch;
  bucketsA: Bucket[];
  bucketsB: Bucket[];
}

function construire(nom: string, params: SearchParams): Espace | null {
  const prepared = prepareSearch(params);
  if (!prepared) return null;
  const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode));
  const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode));
  return { nom, params, prepared, bucketsA, bucketsB };
}

// Deux familles : des espaces LÂCHES (beaucoup de paires passent quickOk) et
// des espaces SÉLECTIFS (minimums serrés sur des pools plus gros : la
// plupart des paires échouent, les trois sauts du noyau s'exercent).
function espacesGeneres(): Espace[] {
  const espaces: Espace[] = [];
  let selectifs = 0;
  for (let s = 0; espaces.length < 18 && s < 400; s++) {
    const rng = mulberry32(5000 + s);
    const selectif = s % 2 === 1;
    if (!selectif && espaces.length - selectifs >= 9) continue;
    if (selectif && selectifs >= 9) continue;
    const pool = randomPool(rng, selectif ? 8 + Math.floor(rng() * 4) : 4 + Math.floor(rng() * 4));
    const sets = rng() < 0.6 ? [SETS_JOKER[Math.floor(rng() * (SETS_JOKER.length - 1))]] : [];
    const minStats: BuildRequirement['minStats'] = {};
    const maxStats: NonNullable<BuildRequirement['maxStats']> = {};
    const serre = selectif ? 1 : 0;
    if (rng() < 0.7) minStats.spd = 100 + serre * 60 + Math.floor(rng() * 90);
    if (rng() < 0.5) minStats.hp = 8000 + serre * 5000 + Math.floor(rng() * 5000);
    if (rng() < 0.5) minStats.atk = 500 + serre * 500 + Math.floor(rng() * 500);
    if (rng() < 0.4) minStats.cr = 15 + serre * 40 + Math.floor(rng() * 60);
    if (rng() < 0.3) minStats.res = 15 + serre * 40 + Math.floor(rng() * 70);
    if (rng() < 0.4) maxStats.def = 400 + 150 + Math.floor(rng() * 700);
    if (rng() < 0.3) maxStats.acc = 20 + Math.floor(rng() * 60);
    if (rng() < 0.2) maxStats.hp = 9000 + serre * 6000 + Math.floor(rng() * 6000);
    const requirement: BuildRequirement = {
      sets, minStats, maxStats,
      ...(rng() < 0.5 ? { auraResPre: { res: 15, acc: 8, compter: true } } : {}),
    };
    const avecArtefacts = rng() < 0.5;
    const params: SearchParams = {
      base: BASE, artifacts: [], pool, requirement, metric: 'eff', maxMs: Infinity, maxCollected: Infinity, slotFilterCap: 80,
      ...(avecArtefacts ? { artifactBounds: { max: { hp: 1500, atk: 100 }, min: { hp: 0, atk: 0 }, possibles: [{ hp: 1500 }, { atk: 100 }] } } : {}),
    };
    const e = construire(`${selectif ? 'sélectif' : 'lâche'} ${s}`, params);
    if (!e) continue;
    const total = totalPairCount(e.prepared, e.bucketsA, e.bucketsB);
    if (total === 0) continue;
    if (selectif) {
      // Sélectif = moins d'une paire sur dix passe quickOk, et au moins une passe.
      const { passantes } = enumerer(e.prepared, e.bucketsA, e.bucketsB);
      if (passantes.size === 0 || passantes.size * 10 > total || total > 3_000_000) continue;
      selectifs++;
    }
    espaces.push(e);
  }
  return espaces;
}

function espacesDeProfils(): Espace[] {
  const out: Espace[] = [];
  for (const nom of ['fumee', 'complet-sensible']) {
    const resolue = resoudreConfig(configDuProfil(trouverProfil(nom)));
    const e = construire(`profil ${nom}`, { ...resolue.params, maxMs: Infinity, maxCollected: Infinity });
    if (e) out.push(e);
  }
  return out;
}

function testPaireParPaire(espaces: Espace[]): void {
  titre('Appariement rapide · oracle paire par paire (aucune paire sautée ne passe quickOk)');
  const exerce = { sautees: 0, lignesSautees: 0, lignesDichotomie: 0, lignesLineaires: 0, blocsSautes: 0 };
  for (const e of espaces) {
    egal(verifierContrat(e.prepared, e.bucketsA, e.bucketsB), null, `${e.nom} : contrat numérique tenu (chemin du noyau)`);
    const { total, passantes } = enumerer(e.prepared, e.bucketsA, e.bucketsB);
    egal(total, totalPairCount(e.prepared, e.bucketsA, e.bucketsB), `${e.nom} : l'énumération de référence compte totalPairCount`);
    for (const forcer of ['dichotomie', 'lineaire', undefined] as const) {
      const visitees = new Set<string>();
      const r = drain(apparierRapide(e.prepared, e.bucketsA, e.bucketsB, {
        forcerChemin: forcer,
        observateur: { visite: (iA, a, iB, b) => visitees.add(`${iA}:${a}:${iB}:${b}`) },
      }));
      let manquees = 0;
      for (const p of passantes) if (!visitees.has(p)) manquees++;
      const chemin = forcer ?? 'automatique';
      egal(manquees, 0, `${e.nom}, chemin ${chemin} : ${passantes.size} paire(s) passant quickOk sur ${total}, toutes visitées (${r.sautees} sautées)`);
      egal([r.traitees, r.visitees + r.sautees], [total, total], `${e.nom}, chemin ${chemin} : traitees = visitees + sautees = ${total}`);
      egal(r.compteurs.gardeRejets, 0, `${e.nom}, chemin ${chemin} : aucune paire visitée rejetée par la garde (seuils exacts)`);
      if (forcer == null) {
        exerce.sautees += r.sautees;
        exerce.lignesSautees += r.compteurs.lignesSautees;
        exerce.lignesDichotomie += r.compteurs.lignesDichotomie;
        exerce.lignesLineaires += r.compteurs.lignesLineaires;
        exerce.blocsSautes += r.compteurs.blocsSautes;
      }
    }
  }
  // Un oracle qui n'exerce pas un saut ne prouve rien sur lui.
  ok(Object.values(exerce).every((v) => v > 0), `les trois sauts sont exercés (chemin automatique) : ${JSON.stringify(exerce)}`);
}

/* --------------------------------------------------------------------------
 * 3. Différentiel contre `pairBuckets`
 * ----------------------------------------------------------------------- */

interface Etat {
  candidates: string;
  explored: number;
  truncated: boolean;
  nearMissByCondition: string;
  globalNearMiss: string;
}

const etatDe = (r: Pick<SearchResult, 'candidates' | 'explored' | 'truncated' | 'nearMissByCondition' | 'globalNearMiss'>): Etat => ({
  candidates: JSON.stringify(r.candidates),
  explored: r.explored,
  truncated: r.truncated,
  nearMissByCondition: JSON.stringify(r.nearMissByCondition),
  globalNearMiss: JSON.stringify(r.globalNearMiss),
});

// Pilote un générateur jusqu'au point de passage `explored = N` (l'état y est
// celui des paires < N) ou jusqu'au bout.
function jusquA(gen: Generator<PairingProgress, SearchResult, void>, N: number): Etat {
  let step = gen.next();
  while (!step.done) {
    if (step.value.explored >= N) return etatDe({ ...step.value, truncated: true });
    step = gen.next();
  }
  return etatDe(step.value);
}

function avecPlafond(e: Espace, maxCollected: number): PreparedSearch {
  return { ...e.prepared, maxCollected };
}

// Des Workers simulés DANS le processus, qui rendent leurs morceaux dans le
// désordre (délais tirés) : la fusion doit redonner l'ordre séquentiel.
function lancerSimule(rng: () => number): LancerTravailleur {
  return (init: InitTravailleur) => {
    const ctx = initialiserTravailleur(structuredClone(init));
    let rappel: (r: ResultatMorceau) => void = () => {};
    return {
      envoyer: (m: Morceau) => {
        const copie = structuredClone(m);
        setTimeout(() => rappel(structuredClone(traiterMorceau(ctx, copie))), Math.floor(rng() * 4));
      },
      surMessage: (r) => {
        rappel = r;
      },
      surErreur: () => {},
      terminer: () => {},
    };
  };
}

async function testDifferentiel(espaces: Espace[]): Promise<void> {
  titre('Appariement rapide · différentiel contre pairBuckets (mêmes compartiments)');
  for (const e of espaces) {
    const total = totalPairCount(e.prepared, e.bucketsA, e.bucketsB);
    const reference = etatDe(drain(pairBuckets(e.prepared, e.bucketsA, e.bucketsB)));
    egal(etatDe(drain(apparierRapide(e.prepared, e.bucketsA, e.bucketsB))), reference, `${e.nom} : non tronqué, résultat identique (${total} paires)`);
    const petit = 3;
    const refPetit = etatDe(drain(pairBuckets(avecPlafond(e, petit), e.bucketsA, e.bucketsB)));
    egal(etatDe(drain(apparierRapide(avecPlafond(e, petit), e.bucketsA, e.bucketsB))), refPetit, `${e.nom} : maxCollected = ${petit}, résultat identique`);
    const N = Math.max(500, 500 * Math.floor(total / 2 / 500));
    if (N < total) {
      egal(jusquA(apparierRapide(e.prepared, e.bucketsA, e.bucketsB), N), jusquA(pairBuckets(e.prepared, e.bucketsA, e.bucketsB), N), `${e.nom} : arrêt au point de passage ${N}, état identique`);
    }
    // Répartition en morceaux, fusion dans l'ordre.
    const rng = mulberry32(99);
    const cible = Math.max(1, Math.ceil(total / 37));
    for (const [libelle, prepared, arret, attendu] of [
      ['non tronqué', e.prepared, undefined, reference],
      [`maxCollected = ${petit}`, avecPlafond(e, petit), undefined, refPetit],
      ...(N < total ? [[`arrêt à ${N}`, e.prepared, N, jusquA(pairBuckets(e.prepared, e.bucketsA, e.bucketsB), N)] as const] : []),
    ] as const) {
      const params = { ...e.params, maxCollected: prepared.maxCollected };
      const r = await apparierRapideEnParallele({
        params, prepared, bucketsA: e.bucketsA, bucketsB: e.bucketsB, totalPaires: total, travailleurs: 3,
        lancer: lancerSimule(rng), startedAt: Date.now(), arretTraitees: arret, cibleMorceau: cible,
      });
      egal(etatDe({ ...r, truncated: arret != null ? true : r.truncated }), attendu, `${e.nom} : morceaux (${r.morceaux}, 3 Workers simulés, désordre), ${libelle}, résultat identique`);
    }
  }
}

export default async function testAppariementRapide(): Promise<void> {
  testFrontieres();
  const espaces = [...espacesGeneres(), ...espacesDeProfils()];
  ok(espaces.length >= 12, `${espaces.length} espaces d'oracle construits`);
  testPaireParPaire(espaces);
  await testDifferentiel(espaces);
}
