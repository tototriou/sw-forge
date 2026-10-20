// La relique en « OU » dans le test conjoint de la recherche (mode relique
// `recherche`) : après la borne par stat (la meilleure PV %, ATQ % et DEF %
// à la fois), le build doit tenir ses conditions avec UNE relique
// représentative à la fois (`reliquesRepresentatives`, relicOptim.ts ;
// `reliqueRepresentativeConvient`, runeBuildOptim.ts).
//
// Trois parties :
// 1. les représentatives, sur des inventaires écrits (minimum, maximum, les
//    deux, aucun ; ex æquo ; principale inconnue) ;
// 2. deux cas écrits où une règle plus étroite perdrait un build conforme :
//    minimum ET maximum sur la stat de la relique (une valeur du milieu), et
//    maximum de PV sous artéfacts (`artPossibles` ne garde que le meilleur
//    artéfact d'une principale) ;
// 3. le différentiel, sur des pools générés (seed fixe) : sur les MÊMES
//    compartiments, l'appariement de référence avec la relique en « OU »
//    (`pairBuckets`) contre le même SANS elle (la borne seule, `relicRelache`
//    éteint sur une copie du `PreparedSearch` — `relTermMax`/`relTermMin`
//    gardent leur mode) ; référence de conformité = la résolution de l'app
//    (`resoudreEquipementDuBuild`, par `resoudreCandidat`). Attendu : les
//    candidats d'avant dont la résolution est conforme, dans le même ordre,
//    même quasi-succès, mêmes paires traitées ; le chemin de production
//    (`searchBuilds` : noyau, validation typée) rend le même résultat.

import { ArtifactDetail, BaseStats, RelicDetail, RuneDetail } from '../src/types';
import { reliquesRepresentatives, resoudreContexteRelique, RelicContext } from '../src/lib/relicOptim';
import type { RelicIntent } from '../src/hooks/useOptimizerState';
import { BuildCandidate, BuildRequirement, PreparedSearch, SearchParams, SearchResult, buildBuckets, pairBuckets, prepareSearch } from '../src/lib/runeBuildOptim';
import { searchBuilds } from '../src/lib/rechercheRunes';
import { computeStats } from '../src/lib/stats';
import { bornesArtefacts } from '../src/lib/artifactOptim';
import { AUCUN_ARTEFACT_RESERVE, parametresArtefactsFiche } from '../src/lib/artifactFiche';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { StatKey } from '../src/lib/effects';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { ReglagesDifferentiel, resoudreCandidat } from '../scripts/lib/relicDifferentiel';
import { strictementEgal } from '../scripts/lib/controleValidationRapide';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const LIBRE: RelicIntent = { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 };
const PORTEUR = { element: 'fire' as const, archetype: 'attack' as const };
const REGLAGES_BASE = { critere: 'efficience' as const, porteur: PORTEUR, exclusive: { setup: DEFAULT_DAMAGE_SETUP, element: null } };

function relique(id: number, code: number, value: number): RelicDetail {
  return { id, upgrade: 9, main: { code, value }, unique: { type: 1, tranche: 100, percent: 1 } };
}

function rune(id: number, slot: number, main: [number, number], subs: [number, number][] = []): RuneDetail {
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })) };
}

function art(id: number, kind: 'element' | 'archetype', code: number, value: number): ArtifactDetail {
  return kind === 'element'
    ? { id, kind, element: 'fire', level: 15, rarity: 5, main: { code, value }, subs: [] }
    : { id, kind, archetype: 'attack', level: 15, rarity: 5, main: { code, value }, subs: [] };
}

const ids = (rs: RelicDetail[]) => rs.map((r) => r.id);
const cle = (c: { runeIds: number[] }) => c.runeIds.join(',');

function params(pool: RuneDetail[], requirement: BuildRequirement, extra: Partial<SearchParams> = {}): SearchParams {
  return { base: BASE, artifacts: [], pool, requirement, metric: 'eff', objective: 'efficience', maxMs: Number.POSITIVE_INFINITY, slotFilterCap: 80, ...extra };
}

/** Les bornes d'artéfacts par le producteur de l'écran et du CLI, sur les mêmes paramètres que la résolution (`entreeResolution`). */
function bornes(p: SearchParams, inventaire: ArtifactDetail[]) {
  const ap = parametresArtefactsFiche({
    porteur: PORTEUR, inventaire, reserves: AUCUN_ARTEFACT_RESERVE, equipes: [], optimiserArtefacts: true,
    principaleParSorte: {}, lignesVerrouillees: [], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: p.requirement.maxStats ?? {},
  });
  const poses = (o: Partial<Record<StatKey, number>> | undefined) => (Object.keys(o ?? {}) as StatKey[]).filter((k) => (o?.[k] ?? 0) > 0);
  return bornesArtefacts({ ...ap, evaluer: () => 0 }, poses(p.requirement.minStats), poses(p.requirement.maxStats));
}

/** Le même appariement de référence, avec et sans la relique en « OU », sur les mêmes compartiments. */
function avantApres(p: SearchParams): { avant: SearchResult; apres: SearchResult; prepared: PreparedSearch } | null {
  const prepared = prepareSearch(p);
  if (!prepared) return null;
  const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, p.combosOrderMode));
  const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, p.combosOrderMode));
  // La borne seule : `relicRelache` éteint sur une COPIE (le seul lecteur
  // de `pairBuckets` qui en dépend, avec `gear.relic` — `relic` absent ici).
  const avant = drain(pairBuckets({ ...prepareSearch(p)!, relicRelache: false, relic: undefined }, bucketsA, bucketsB));
  const apres = drain(pairBuckets(prepareSearch(p)!, bucketsA, bucketsB));
  return { avant, apres, prepared };
}

/**
 * Les candidats de la BORNE SEULE (sans la relique en « OU »), dans l'ordre
 * de `pairBuckets` : un sur-ensemble de ceux de la recherche, faux positifs de
 * la borne compris. Pour les tests de la résolution, du CLI et du Worker de
 * résolution qui doivent encore exercer l'issue « rejeté » (aucun couple
 * faisable), que la recherche ne leur fournit plus d'elle-même.
 */
export function candidatsDeLaBorneSeule(p: SearchParams): BuildCandidate[] {
  return avantApres({ ...p, maxMs: Number.POSITIVE_INFINITY })?.avant.candidates ?? [];
}

function estSousSuite(petite: BuildCandidate[], grande: BuildCandidate[]): boolean {
  let j = 0;
  for (const c of petite) {
    while (j < grande.length && !strictementEgal(grande[j], c)) j++;
    if (j === grande.length) return false;
    j++;
  }
  return true;
}

export default function testReliqueOu() {
  titre('Optimizer · relique en « OU » dans le test conjoint de la recherche');

  /* ── 1. Les représentatives. */
  {
    const inv = [relique(1, 100, 8), relique(2, 100, 12), relique(3, 101, 10), relique(4, 101, 15), relique(5, 101, 5), relique(6, 102, 9), relique(7, 101, 15)];
    egal(ids(reliquesRepresentatives(inv, { minStats: {} })), [2, 4, 6], 'sans condition : la plus forte de chaque principale (ex æquo 15 : la plus petite id)');
    egal(ids(reliquesRepresentatives(inv, { minStats: { atk: 900 } })), [2, 4, 6], 'minimum ATQ : la plus forte ATQ % (et une par autre principale)');
    egal(ids(reliquesRepresentatives(inv, { minStats: {}, maxStats: { atk: 900 } })), [2, 5, 6], 'maximum ATQ seul : la plus faible ATQ %');
    egal(ids(reliquesRepresentatives(inv, { minStats: { atk: 800 }, maxStats: { atk: 900 } })), [2, 4, 3, 5, 6], 'minimum ET maximum ATQ : toutes les valeurs distinctes d’ATQ %, décroissantes');
    egal(ids(reliquesRepresentatives(inv, { minStats: { atk: 0 }, maxStats: { atk: 0 } })), [2, 4, 6], 'une condition à 0 n’est pas posée (comme `minEntries`)');
    egal(ids(reliquesRepresentatives([relique(9, 999, 7), relique(8, 999, 3), relique(1, 100, 8)], { minStats: {} })), [1, 8], 'principale hors PV/ATQ/DEF : une seule, neutre (la plus petite id)');
    egal(reliquesRepresentatives([], { minStats: { hp: 1 } }), [], 'aucune éligible : aucune représentative');
    ok(reliquesRepresentatives(inv, { minStats: {} }).length <= 3, 'sans maximum : au plus trois');
  }

  /* ── 2a. Minimum ET maximum sur la stat de la relique : seule la valeur du
   * milieu passe. ATQ = 700 + ceil(700 × L / 100) : 735, 770, 805 pour
   * L = 5, 10, 15 ; condition 760 ≤ ATQ ≤ 780. La plus forte et la plus
   * faible échouent toutes deux : la règle « deux extrêmes » perdrait ce
   * build, que la résolution rend conforme avec la +10. */
  {
    const pool = [1, 2, 3, 4, 5, 6].map((slot) => rune(100 + slot, slot, [8, 5]));
    const requirement: BuildRequirement = { sets: [], minStats: { atk: 760 }, maxStats: { atk: 780 } };
    const inv = [relique(11, 101, 5), relique(12, 101, 10), relique(13, 101, 15)];
    const ctx = resoudreContexteRelique(LIBRE, undefined, inv);
    const p = params(pool, requirement, { relicContext: ctx });
    const r = searchBuilds(p);
    egal(r.candidates.map(cle), ['101,102,103,104,105,106'], 'intervalle : le build est collecté (relique +10, la seule dans l’intervalle)');
    const build: BuildCandidate = { runeIds: pool.map((x) => x.id), stats: [], effTotal: 0 };
    const resolu = resoudreCandidat(p, build, ctx, REGLAGES_BASE);
    ok(resolu.conforme, 'intervalle : la résolution le rend conforme');
    egal(resolu.relique?.id, 12, 'intervalle : avec la relique 12 (+10)');
    const sansMilieu = resoudreContexteRelique(LIBRE, undefined, [inv[0]!, inv[2]!]);
    egal(searchBuilds({ ...p, relicContext: sansMilieu }).candidates.length, 0, 'intervalle sans la +10 : aucune relique ne tient, le build n’est plus collecté');
    const ab = avantApres({ ...p, relicContext: sansMilieu })!;
    egal(ab.avant.candidates.length, 1, 'intervalle sans la +10 : la borne seule le gardait (faux positif)');
  }

  /* ── 2b. Maximum de PV sous artéfacts. PV = 1000 (base, aucune rune PV),
   * relique PV +10 % → 1100 ; artéfacts PV +50 et +100 ; 1120 ≤ PV ≤ 1160.
   * `artPossibles` ne garde que le +100 : relique PV + 100 = 1200 > 1160,
   * relique ATQ + 100 = 1100 < 1120. La résolution trouve relique PV + 50 =
   * 1150 : conforme. Le maximum se juge donc avec `artFlatMin` (0 : un
   * emplacement vide est toujours candidat), jamais avec l'apport des
   * minimums. */
  {
    const base: BaseStats = { ...BASE, hp: 1000 };
    const pool = [1, 2, 3, 4, 5, 6].map((slot) => rune(200 + slot, slot, [8, 5]));
    const requirement: BuildRequirement = { sets: [], minStats: { hp: 1120 }, maxStats: { hp: 1160 } };
    const inv = [relique(21, 100, 10), relique(22, 101, 10)];
    const arts = [art(31, 'element', 100, 50), art(32, 'element', 100, 100)];
    const ctx = resoudreContexteRelique(LIBRE, undefined, inv);
    const p0 = params(pool, requirement, { base, relicContext: ctx });
    const p = { ...p0, artifactBounds: bornes(p0, arts) };
    egal(p.artifactBounds.possibles, [{ hp: 100 }], 'artéfacts : `artPossibles` ne garde que le meilleur PV (+100) — exact pour les minimums seulement');
    const r = searchBuilds(p);
    egal(r.candidates.map(cle), ['201,202,203,204,205,206'], 'maximum PV sous artéfacts : le build est collecté');
    const res = resoudreCandidat(p, { runeIds: pool.map((x) => x.id), stats: [], effTotal: 0 }, ctx, { ...REGLAGES_BASE, inventaireArtefacts: arts });
    ok(res.conforme && res.relique?.id === 21 && res.artefacts.map((a) => a.id).join(',') === '31',
      `maximum PV sous artéfacts : conforme avec la relique PV et l’artéfact +50 (${res.relique?.id}, ${res.artefacts.map((a) => a.id)})`);
  }

  /* ── 3. Le différentiel, pools générés. */
  const bilan = { cas: 0, sansPreparation: 0, avecArtefacts: 0, intervalles: 0, relaches: 0, avant: 0, rejetes: 0, conformes: 0, fauxPositifsGardes: 0 };
  for (let seed = 1; seed <= 48; seed++) {
    const rng = mulberry32(7919 * seed);
    const tirer = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
    const pool = randomPool(rng, seed % 3 === 0 ? 2 : 3);
    // Reliques : 2 à 5, principales et valeurs tirées.
    const inv = Array.from({ length: 2 + Math.floor(rng() * 4) }, (_, i) => relique(9000 + i, tirer([100, 101, 102]), 6 + Math.floor(rng() * 12)));
    const forcee = rng() < 0.2 ? inv[0]!.main.code : 'libre';
    const ctx: RelicContext = resoudreContexteRelique({ ...LIBRE, principale: forcee as RelicIntent['principale'] }, undefined, inv);
    // Artéfacts, une fois sur deux.
    const avecArts = rng() < 0.5;
    const arts = avecArts
      ? Array.from({ length: 2 + Math.floor(rng() * 5) }, (_, i) => {
          const code = tirer([100, 101, 102]);
          return art(500 + i, i % 2 === 0 ? 'element' : 'archetype', code, code === 100 ? 300 + Math.floor(rng() * 1200) : 30 + Math.floor(rng() * 70));
        })
      : [];
    // Conditions autour d'un build tiré (avec une relique tirée) : des
    // seuils que des builds atteignent de justesse.
    const ref = [1, 2, 3, 4, 5, 6].map((slot) => tirer(pool.filter((r) => r.slot === slot)));
    const refStats = computeStats({ base: BASE, runes: ref, artifacts: [], relic: tirer(inv) });
    const valeur = (k: StatKey) => refStats.find((s) => s.key === k)!.total;
    const minStats: Partial<Record<StatKey, number>> = {};
    const maxStats: Partial<Record<StatKey, number>> = {};
    // PV/ATQ/DEF plus souvent : ce sont les stats d'une relique, et deux
    // minimums sur deux d'entre elles font les faux positifs de la borne.
    const stats: StatKey[] = ['hp', 'atk', 'def', 'hp', 'atk', 'def', 'spd', 'res'];
    for (let n = 1 + Math.floor(rng() * 4); n > 0; n--) {
      const k = tirer(stats);
      const v = valeur(k);
      const marge = Math.max(1, Math.round(v * (k === 'spd' || k === 'res' ? 0.05 : 0.01)));
      const sorte = rng();
      if (sorte < 0.5) minStats[k] = v - Math.floor(rng() * marge);
      else if (sorte < 0.75) maxStats[k] = v + Math.floor(rng() * marge);
      else {
        minStats[k] = v - Math.floor(rng() * marge);
        maxStats[k] = v + Math.floor(rng() * marge);
      }
    }
    const requirement: BuildRequirement = {
      sets: [], minStats, maxStats,
      ...(rng() < 0.3 ? { auraResPre: { compter: true, res: 8, acc: 0 } } : {}),
    };
    const p0 = params(pool, requirement, { relicContext: ctx, artifacts: avecArts && rng() < 0.5 ? [arts[0]!] : [] });
    const p: SearchParams = avecArts ? { ...p0, artifactBounds: bornes(p0, arts) } : p0;
    const nom = `seed ${seed} (${pool.length / 6} rune(s)/slot, ${inv.length} reliques${forcee === 'libre' ? '' : ' forcées'}, ${avecArts ? `${arts.length} artéfacts` : 'sans artéfact'}, min ${JSON.stringify(minStats)} max ${JSON.stringify(maxStats)})`;

    const ab = avantApres(p);
    if (!ab) {
      bilan.sansPreparation++;
      continue;
    }
    bilan.cas++;
    if (avecArts) bilan.avecArtefacts++;
    const maxPorte = (['hp', 'atk', 'def'] as StatKey[]).some((k) => (maxStats[k] ?? 0) > 0);
    const relache = avecArts && maxPorte;
    if (relache) bilan.relaches++;
    if ((['hp', 'atk', 'def'] as StatKey[]).some((k) => (minStats[k] ?? 0) > 0 && (maxStats[k] ?? 0) > 0)) bilan.intervalles++;
    const { avant, apres } = ab;
    ok(!avant.truncated && !apres.truncated, `${nom} : non tronqué`);
    const reglages: ReglagesDifferentiel = { ...REGLAGES_BASE, inventaireArtefacts: arts };
    const conformes = new Set(avant.candidates.filter((c) => resoudreCandidat(p, c, ctx, reglages).conforme).map(cle));
    const attendus = avant.candidates.filter((c) => conformes.has(cle(c)));
    bilan.avant += avant.candidates.length;
    bilan.rejetes += avant.candidates.length - apres.candidates.length;
    bilan.conformes += attendus.length;
    ok(estSousSuite(apres.candidates, avant.candidates), `${nom} : candidats = sous-suite de ceux d’avant (${apres.candidates.length} ⊆ ${avant.candidates.length})`);
    ok(attendus.every((c) => apres.candidates.some((x) => cle(x) === cle(c))), `${nom} : aucun conforme perdu (${attendus.length} conformes)`);
    if (relache) {
      bilan.fauxPositifsGardes += apres.candidates.filter((c) => !conformes.has(cle(c))).length;
    } else {
      ok(strictementEgal(apres.candidates, attendus), `${nom} : candidats = ceux d’avant dont la résolution est conforme, même ordre`);
    }
    egal([apres.explored, apres.nearMissByCondition, apres.globalNearMiss], [avant.explored, avant.nearMissByCondition, avant.globalNearMiss], `${nom} : mêmes paires traitées, même quasi-succès`);
    // Le chemin de production (noyau, validation typée) : même résultat.
    const prod = searchBuilds(p);
    ok(strictementEgal(prod.candidates, apres.candidates), `${nom} : la production (searchBuilds) rend les candidats de la référence`);
  }
  console.log(`  · différentiel : ${JSON.stringify(bilan)}`);
  ok(bilan.cas >= 30 && bilan.rejetes > 0 && bilan.conformes > 0 && bilan.avecArtefacts > 0 && bilan.intervalles > 0,
    `différentiel exercé : ${bilan.cas} cas, ${bilan.avant} candidats d’avant, ${bilan.rejetes} écartés par la relique en « OU », ${bilan.conformes} conformes gardés, ${bilan.avecArtefacts} cas à artéfacts, ${bilan.intervalles} à minimum et maximum sur une même stat`);
}
