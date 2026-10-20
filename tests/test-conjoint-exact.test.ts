// Le test conjoint de la validation ne perd aucun build conforme, maximums de
// PV/ATQ/DEF compris : les apports d'artéfacts atteignables
// (`apportsAtteignables`, artifactOptim.ts) gardent, sur une stat sous
// maximum, l'apport le plus FAIBLE de chaque principale, et toutes les
// valeurs sous minimum ET maximum.
//
// Deux parties :
// 1. le contre-exemple (PV de base 1000, reliques PV +10 et ATQ +10,
//    artéfacts PV +50 et +300, 1100 ≤ PV ≤ 1200) : ne garder que le +300
//    écartait un build que relique PV + aucun artéfact (1100) ou + 50 (1150)
//    rend conforme — en relique `recherche` libre, principale PV forcée et
//    relique fixe ;
// 2. un différentiel sur des pools générés (seed fixe), minimum ET maximum
//    sur une même stat souvent : sur les mêmes compartiments, chaque paire
//    de demi-builds que l'énumération BRUTE déclare conforme (relique
//    possible × vraie paire d'artéfacts de l'inventaire, emplacement vide
//    compris, `respecteConditionsAvecRelique` : minimums ET maximums) est
//    collectée, par la référence (`pairBuckets`) comme par la production
//    (`searchBuilds`).

import { ArtifactDetail, BaseStats, RelicDetail, RuneDetail } from '../src/types';
import { RelicContext, resoudreContexteRelique } from '../src/lib/relicOptim';
import type { RelicIntent } from '../src/hooks/useOptimizerState';
import { ARTIFACT_MAIN_VALUE, BuildRequirement, SearchParams, buildBuckets, pairBuckets, prepareSearch, respecteConditionsAvecRelique } from '../src/lib/runeBuildOptim';
import { searchBuilds } from '../src/lib/rechercheRunes';
import { computeStats } from '../src/lib/stats';
import { bornesArtefacts } from '../src/lib/artifactOptim';
import { artifactPairAllowed } from '../src/lib/artifacts';
import { AUCUN_ARTEFACT_RESERVE, parametresArtefactsFiche } from '../src/lib/artifactFiche';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { StatKey } from '../src/lib/effects';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const LIBRE: RelicIntent = { mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 };
const PORTEUR = { element: 'fire' as const, archetype: 'attack' as const };

const relique = (id: number, code: number, value: number): RelicDetail => ({ id, upgrade: 9, main: { code, value }, unique: { type: 1, tranche: 100, percent: 1 } });
const rune = (id: number, slot: number, main: [number, number]): RuneDetail => ({ id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: main[0], value: main[1] }, subs: [] });
const art = (id: number, kind: 'element' | 'archetype', code: number, value: number): ArtifactDetail => (kind === 'element'
  ? { id, kind, element: 'fire', level: 15, rarity: 5, main: { code, value }, subs: [] }
  : { id, kind, archetype: 'attack', level: 15, rarity: 5, main: { code, value }, subs: [] });

function params(pool: RuneDetail[], requirement: BuildRequirement, extra: Partial<SearchParams> = {}): SearchParams {
  return { base: BASE, artifacts: [], pool, requirement, metric: 'eff', objective: 'efficience', maxMs: Number.POSITIVE_INFINITY, slotFilterCap: 80, ...extra };
}

/** Les bornes d'artéfacts par le producteur de l'écran et du CLI. */
export function bornesDe(p: SearchParams, inventaire: ArtifactDetail[]) {
  const ap = parametresArtefactsFiche({
    porteur: PORTEUR, inventaire, reserves: AUCUN_ARTEFACT_RESERVE, equipes: [], optimiserArtefacts: true,
    principaleParSorte: {}, lignesVerrouillees: [], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: p.requirement.maxStats ?? {},
  });
  const poses = (o: Partial<Record<StatKey, number>> | undefined) => (Object.keys(o ?? {}) as StatKey[]).filter((k) => (o?.[k] ?? 0) > 0);
  return bornesArtefacts({ ...ap, evaluer: () => 0 }, poses(p.requirement.minStats), poses(p.requirement.maxStats));
}

/** L'énumération brute : une relique possible × une vraie paire, emplacement vide compris, minimums ET maximums. */
export function conformeBrut(base: BaseStats, runes: RuneDetail[], reliques: (RelicDetail | undefined)[], inventaire: ArtifactDetail[], requirement: BuildRequirement): boolean {
  const elements: (ArtifactDetail | null)[] = [null, ...inventaire.filter((a) => a.kind === 'element')];
  const archetypes: (ArtifactDetail | null)[] = [null, ...inventaire.filter((a) => a.kind === 'archetype')];
  return reliques.some((rel) => elements.some((e) => archetypes.some((a) => artifactPairAllowed(e, a)
    && respecteConditionsAvecRelique({ base, runes, artifacts: [e, a].filter((x): x is ArtifactDetail => x != null) }, rel, requirement).respecte)));
}

const cle = (ids: number[]) => ids.join(',');

export default function testTestConjointExact() {
  titre('Optimizer · test conjoint exact sous maximum de PV/ATQ/DEF (apports atteignables)');

  /* ── 1. Le contre-exemple, aux valeurs du jeu (principale d'artéfact PV
   * +1500, ATQ +100, DEF +100 : `ARTIFACT_MAIN_VALUE`). PV 20 000 sans
   * artéfact (base 10 000, PV % +100 des runes) ; une paire apporte 0, 1 500
   * ou 3 000 PV. Sous 21 000 ≤ PV ≤ 22 000, seule une paire à UN artéfact PV
   * convient (21 500) ; ne garder que +3 000 (23 000) écartait le build. Les
   * reliques portent ATQ % ou DEF % : elles ne touchent pas les PV. */
  {
    const pool = [1, 2, 3, 4, 5, 6].map((slot) => rune(300 + slot, slot, [2, slot === 6 ? 15 : 17]));
    const ids = cle(pool.map((r) => r.id));
    egal(computeStats({ base: BASE, runes: pool, artifacts: [] }).find((s) => s.key === 'hp')!.total, 20000, 'précondition : 20 000 PV sans artéfact ni relique');
    const requirement: BuildRequirement = { sets: [], minStats: { hp: 21000 }, maxStats: { hp: 22000 } };
    const inv = [relique(21, 101, 10), relique(22, 102, 10)];
    const arts = [art(31, 'element', 100, 1500), art(32, 'archetype', 100, 1500), art(33, 'archetype', 101, 100)];
    const p0 = params(pool, requirement);
    const bornes = bornesDe(p0, arts);
    egal(bornes.possibles.map((a) => a.hp ?? 0).sort((x, y) => x - y), [0, 1500, 3000], 'minimum ET maximum de PV : toutes les valeurs d’apport en PV (0, 1 500, 3 000)');
    egal(bornesDe({ ...p0, requirement: { sets: [], minStats: {}, maxStats: { hp: 22000 } } }, arts).possibles.map((a) => a.hp ?? 0), [0], 'maximum de PV seul : le plus faible apport en PV (aucun artéfact PV)');
    egal(bornesDe({ ...p0, requirement: { sets: [], minStats: { hp: 21000 } } }, arts).possibles, [{ hp: 3000 }], 'minimum de PV seul : le plus fort apport, comme avant');
    ok(conformeBrut(BASE, pool, [inv[0]], arts, requirement), 'énumération brute : un seul artéfact PV (21 500) tient 21 000 ≤ PV ≤ 22 000');
    const modes: [string, SearchParams][] = [
      ['relique recherche libre', { ...p0, relicContext: resoudreContexteRelique(LIBRE, undefined, inv) }],
      ['principale ATQ forcée', { ...p0, relicContext: resoudreContexteRelique({ ...LIBRE, principale: 101 }, undefined, inv) }],
      ['relique fixe', { ...p0, relic: inv[0] }],
      ['sans relique', p0],
    ];
    for (const [nom, p] of modes) {
      egal(searchBuilds({ ...p, artifactBounds: bornes }).candidates.map((c) => cle(c.runeIds)), [ids], `${nom} : le build est collecté (aucun conforme perdu sous maximum)`);
    }
    // Maximum seul : jugé avec l'apport le plus faible, jamais la paire la plus forte.
    const pMax = params(pool, { sets: [], minStats: {}, maxStats: { hp: 22000 } });
    egal(searchBuilds({ ...pMax, artifactBounds: bornesDe(pMax, arts) }).candidates.map((c) => cle(c.runeIds)), [ids], 'maximum de PV seul (22 000) : le build est collecté (aucun artéfact PV : 20 000)');
  }

  /* ── 2. Le différentiel contre l'énumération brute. */
  const bilan = { cas: 0, paires: 0, conformes: 0, collectes: 0, minEtMax: 0, parMode: {} as Record<string, number> };
  for (let seed = 1; seed <= 40; seed++) {
    const rng = mulberry32(104729 * seed);
    const tirer = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
    const pool = randomPool(rng, 2 + (seed % 2));
    const inv = Array.from({ length: 2 + Math.floor(rng() * 3) }, (_, i) => relique(8000 + i, tirer([100, 101, 102]), 6 + Math.floor(rng() * 12)));
    const arts = Array.from({ length: 2 + Math.floor(rng() * 5) }, (_, i) => {
      const code = tirer([100, 101, 102] as const);
      return art(600 + i, i % 2 === 0 ? 'element' : 'archetype', code, ARTIFACT_MAIN_VALUE[code]);
    });
    const mode = tirer(['recherche', 'recherche', 'forcee', 'fixe', 'sans'] as const);
    const ctx: RelicContext | undefined = mode === 'recherche' ? resoudreContexteRelique(LIBRE, undefined, inv)
      : mode === 'forcee' ? resoudreContexteRelique({ ...LIBRE, principale: inv[0]!.main.code as RelicIntent['principale'] }, undefined, inv) : undefined;
    const relicFixe = mode === 'fixe' ? inv[0] : undefined;
    const reliquesPossibles: (RelicDetail | undefined)[] = ctx ? ctx.eligibles : [relicFixe];
    // Conditions autour d'un build tiré, avec une relique et une paire tirées.
    const ref = [1, 2, 3, 4, 5, 6].map((slot) => tirer(pool.filter((r) => r.slot === slot)));
    const refStats = computeStats({ base: BASE, runes: ref, artifacts: [tirer(arts)], relic: tirer(reliquesPossibles) });
    const valeur = (k: StatKey) => refStats.find((s) => s.key === k)!.total;
    const minStats: Partial<Record<StatKey, number>> = {};
    const maxStats: Partial<Record<StatKey, number>> = {};
    for (let n = 1 + Math.floor(rng() * 3); n > 0; n--) {
      const k = tirer(['hp', 'atk', 'def', 'hp', 'atk', 'def', 'spd'] as StatKey[]);
      const v = valeur(k);
      const marge = Math.max(1, Math.round(v * (k === 'spd' ? 0.05 : 0.04)));
      const sorte = rng();
      if (sorte < 0.25) minStats[k] = v - Math.floor(rng() * marge);
      else if (sorte < 0.5) maxStats[k] = v + Math.floor(rng() * marge);
      else {
        minStats[k] = v - Math.floor(rng() * marge);
        maxStats[k] = v + Math.floor(rng() * marge);
      }
    }
    const requirement: BuildRequirement = { sets: [], minStats, maxStats };
    if ((['hp', 'atk', 'def'] as StatKey[]).some((k) => (minStats[k] ?? 0) > 0 && (maxStats[k] ?? 0) > 0)) bilan.minEtMax++;
    const p0 = params(pool, requirement, { relicContext: ctx, relic: relicFixe });
    const p: SearchParams = { ...p0, artifactBounds: bornesDe(p0, arts) };
    const nom = `seed ${seed} (${mode}, ${pool.length / 6} rune(s)/slot, ${inv.length} reliques, ${arts.length} artéfacts, min ${JSON.stringify(minStats)} max ${JSON.stringify(maxStats)})`;
    const prepared = prepareSearch(p);
    if (!prepared) continue;
    bilan.cas++;
    bilan.parMode[mode] = (bilan.parMode[mode] ?? 0) + 1;
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, p.combosOrderMode));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, p.combosOrderMode));
    const reference = drain(pairBuckets(prepareSearch(p)!, bucketsA, bucketsB));
    const production = searchBuilds(p);
    const refCles = new Set(reference.candidates.map((c) => cle(c.runeIds)));
    const prodCles = new Set(production.candidates.map((c) => cle(c.runeIds)));
    const perdus: string[] = [];
    for (const bA of bucketsA) for (const bB of bucketsB) for (const a of bA.combos) for (const b of bB.combos) {
      if (a.jokers + b.jokers > 1) continue;
      const runes = [...a.runes, ...b.runes];
      bilan.paires++;
      if (!conformeBrut(BASE, runes, reliquesPossibles, arts, requirement)) continue;
      bilan.conformes++;
      const k = cle(runes.map((r) => r.id));
      if (!refCles.has(k) || !prodCles.has(k)) perdus.push(k);
    }
    bilan.collectes += reference.candidates.length;
    egal(perdus, [], `${nom} : aucun conforme de l’énumération brute perdu (référence et production)`);
  }
  console.log(`  · différentiel : ${JSON.stringify(bilan)}`);
  ok(bilan.cas >= 30 && bilan.conformes > 0 && bilan.minEtMax > 5 && Object.keys(bilan.parMode).length === 4,
    `différentiel exercé : ${bilan.cas} cas, ${bilan.paires} paires, ${bilan.conformes} conformes, ${bilan.minEtMax} à minimum et maximum sur une même stat, modes ${JSON.stringify(bilan.parMode)}`);
}
