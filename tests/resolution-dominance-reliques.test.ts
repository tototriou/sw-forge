// Dominance des reliques dans la résolution rapide (src/lib/resolutionRapide.ts,
// `reliquesDominees`) : en « Dégâts réels », une relique dominée sur ses quatre
// canaux (PV, ATQ, DEF, dégâts infligés) n'est pas notée.
//
// ⚠️ La dominance REPOSE sur la règle de jeu R — les dégâts ne baissent jamais
// quand PV, ATQ, DEF, une ligne d'artéfact ou l'effet unique d'une relique
// augmentent —, confirmée par l'utilisateur, jamais relevée en jeu. Ce test
// le dit dans son titre : il vérifie que le CODE suit R sur ses fixtures
// (oracle paire par paire), il ne prouve pas R.
//
// Références de contrôle (`algo-verify`) :
// - la résolution SANS dominance (`dominanceReliques: null`), même entrée :
//   résultat entier identique (relique, paire, note au bit, stats, verdict) ;
// - paire par paire : pour chaque relique écartée, une relique notée qui gagne
//   l'égalité a, sur CHAQUE paire autorisée où l'écartée est faisable, une
//   note au moins égale (le vrai `evaluer` de `faireParams`).
// Pools à graine fixe : runes tirées au hasard, inventaire d'artéfacts à
// principales et lignes variées, reliques de principales et d'effets variés
// dont des équivalentes sur les quatre canaux (Ténacité, Régénération).

import { isDeepStrictEqual } from 'node:util';
import { ArtifactArchetype, ArtifactDetail, ArtifactKind, BaseStats, ElementKey, RelicDetail, RuneDetail } from '../src/types';
import { ARTIFACT_SUB_MAX, artifactPairAllowed } from '../src/lib/artifacts';
import { artifactSubKinds } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { BuildRequirement, respecteConditionsAvecRelique } from '../src/lib/runeBuildOptim';
import { prefereeALEgalite, resoudreContexteRelique } from '../src/lib/relicOptim';
import { ArtifactSearchParams, candidatsParSorte } from '../src/lib/artifactOptim';
import { EntreeResolution, entreeResolutionDuBuild, nouveauxCachesResolution } from '../src/lib/relicQueue';
import { compteursVides, resoudreEquipementDuBuildRapide } from '../src/lib/resolutionRapide';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { mulberry32, randomRune, SETS_VARIES } from '../scripts/lib/randomPool';
import { DEGATS_FICHE } from './artifact-fiche.test';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };
const BASE: BaseStats = { hp: 9000, atk: 650, def: 550, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 };
const DEGATS = { ...DEGATS_FICHE, setup: { ...DEGATS_FICHE.setup, critMode: 'crit' as const } };
const EXCLUSIVE = { setup: DEFAULT_DAMAGE_SETUP, element: null };

function inventaire(rng: () => number, parSorte: number): ArtifactDetail[] {
  const codesDe = (kind: ArtifactKind) => Object.keys(ARTIFACT_SUB_MAX).map(Number).filter((c) => artifactSubKinds(c).includes(kind));
  const pieces: ArtifactDetail[] = [];
  let id = 5000;
  for (const kind of ['element', 'archetype'] as ArtifactKind[]) {
    const codes = codesDe(kind);
    for (let i = 0; i < parSorte; i++) {
      const choisis = new Set<number>();
      while (choisis.size < 4) choisis.add(codes[Math.floor(rng() * codes.length)]!);
      const mainCode = [100, 101, 102][Math.floor(rng() * 3)]!;
      const valeurs = mainCode === 100 ? [900, 1200, 1500] : [60, 80, 100];
      pieces.push({
        id: id++, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
        level: 15, rarity: 5, main: { code: mainCode, value: valeurs[Math.floor(rng() * 3)]! },
        subs: [...choisis].map((code) => ({ code, value: Math.max(1, Math.round(rng() * ARTIFACT_SUB_MAX[code]! * 10) / 10) })),
      });
    }
  }
  return pieces;
}

// Reliques variées, plus, pour chacune des deux premières, une équivalente sur
// les quatre canaux (Ténacité et Régénération n'y apportent rien) d'`id` plus
// grand : elle doit être écartée.
function reliques(rng: () => number, n: number): RelicDetail[] {
  const out: RelicDetail[] = [];
  const types = [1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 16];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 100 + Math.floor(rng() * 900) * 10 + i,
      upgrade: 9,
      main: { code: ([100, 101, 102] as const)[Math.floor(rng() * 3)]!, value: 8 + Math.floor(rng() * 7) },
      unique: { type: types[Math.floor(rng() * types.length)]!, tranche: [150, 1000, 2000, 18000][Math.floor(rng() * 4)]!, percent: 1 + Math.floor(rng() * 2) },
    });
  }
  out.push({ id: 20001, upgrade: 9, main: { ...out[0]!.main }, unique: { type: 5, tranche: 1000, percent: 1 } });
  out.push({ id: 20002, upgrade: 9, main: { ...out[0]!.main }, unique: { type: 16, tranche: 1000, percent: 2 } });
  return out;
}

const runesAuHasard = (rng: () => number, id0: number): RuneDetail[] =>
  [1, 2, 3, 4, 5, 6].map((slot) => randomRune(id0 + slot, slot, rng, SETS_VARIES));
const total = (runes: RuneDetail[], k: string) => computeStats({ base: BASE, runes, artifacts: [] }).find((s) => s.key === k)!.total;

// Les reliques dont `faireParams` a été appelé (notées, sondes comprises).
function suivie(e: EntreeResolution, notees: Set<number>): EntreeResolution {
  return { ...e, faireParams: (r) => {
    if (r) notees.add(r.id);
    return e.faireParams(r);
  } };
}

// Les paires autorisées de l'inventaire (emplacement vide compris).
function pairesAutorisees(p: Omit<ArtifactSearchParams, 'evaluer'>): ArtifactDetail[][] {
  const el = [null, ...candidatsParSorte(p, 'element').filter((x) => x)];
  const ar = [null, ...candidatsParSorte(p, 'archetype').filter((x) => x)];
  const out: ArtifactDetail[][] = [];
  for (const a of el) for (const b of ar) {
    if (artifactPairAllowed(a, b)) out.push([a, b].filter((x): x is ArtifactDetail => x != null));
  }
  return out;
}

export default function testResolutionDominanceReliques() {
  titre('Dominance des reliques (résolution rapide, « Dégâts réels ») — repose sur la règle de jeu R confirmée par l’utilisateur (non relevée en jeu) : même résultat que sans dominance, oracle paire par paire');

  const ecarts: string[] = [];
  let builds = 0, ecartees = 0, pairesComparees = 0, conformes = 0;
  for (let graine = 0; graine < 6; graine++) {
    const rng = mulberry32(4200 + graine);
    const inv = inventaire(rng, 6);
    const pool = reliques(rng, 7);
    const lot = Array.from({ length: 10 }, (_, i) => runesAuHasard(rng, 100 * i));
    const mediane = (k: string) => lot.map((b) => total(b, k)).sort((a, b) => a - b)[Math.floor(lot.length / 2)]!;
    // Minimums autour des stats des builds, maximum d'ATQ une graine sur deux :
    // des reliques faisables, d'autres non.
    const requirement: BuildRequirement = {
      sets: [],
      minStats: { hp: Math.round(mediane('hp') * 1.05), atk: Math.round(mediane('atk') * 1.02) },
      maxStats: graine % 2 ? { atk: Math.round(mediane('atk') * 1.3) } : {},
      auraResPre: { res: 0, acc: 0, compter: true },
    };
    const artifactParams: Omit<ArtifactSearchParams, 'evaluer'> = {
      porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: {}, lignesVerrouillees: [],
      maxStatsActifs: graine % 2 ? ['atk'] : [],
    };
    const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, pool[pool.length - 1], pool);
    const caches = nouveauxCachesResolution();
    const paires = pairesAutorisees(artifactParams);
    for (const runes of lot) {
      builds++;
      const e = entreeResolutionDuBuild({
        fiche: { base: BASE, runes: [], artifacts: [], relic: undefined }, runes, artifactParams, regime: 'degats_reels', degats: DEGATS,
        exclusive: EXCLUSIVE, requirement, relicContext: ctx, caches,
      });
      if (!e.dominanceReliques) ecarts.push('le producteur ne pose pas la dominance en « Dégâts réels »');
      const notees = new Set<number>();
      const c = compteursVides();
      const avec = resoudreEquipementDuBuildRapide(suivie(e, notees), c);
      const sans = resoudreEquipementDuBuildRapide({ ...e, dominanceReliques: null });
      if (!isDeepStrictEqual(avec, sans)) {
        ecarts.push(`graine ${graine}, build ${builds} : avec dominance relique ${avec.relique?.id} note ${avec.paire?.score}, sans ${sans.relique?.id} note ${sans.paire?.score}`);
      }
      if (avec.conforme) conformes++;
      ecartees += c.reliquesDominees;
      // Oracle paire par paire, sur chaque relique non notée qui a une paire faisable.
      for (const b of pool) {
        if (notees.has(b.id)) continue;
        const faisables = paires.filter((p) => respecteConditionsAvecRelique({ ...e.gear, artifacts: p }, b, requirement).respecte);
        if (faisables.length === 0) continue;
        const noteB = e.faireParams(b).evaluer;
        const dominante = pool.find((a) => a !== b && notees.has(a.id) && prefereeALEgalite(a, b, { equipee: ctx.equipee })
          && faisables.every((p) => respecteConditionsAvecRelique({ ...e.gear, artifacts: p }, a, requirement).respecte
            && e.faireParams(a).evaluer(p) >= noteB(p)));
        pairesComparees += faisables.length;
        if (!dominante) ecarts.push(`graine ${graine}, build ${builds} : relique ${b.id} écartée sans relique notée qui la domine paire par paire`);
      }
    }
  }
  egal(ecarts.length, 0, `${builds} builds (${conformes} conformes), ${ecartees} reliques écartées, ${pairesComparees} paires comparées : ${ecarts.slice(0, 3).join(' ; ')}`);
  ok(ecartees > 0 && pairesComparees > 0, `au moins une relique écartée et vérifiée paire par paire (${ecartees}, ${pairesComparees})`);

  // ── Égalité : départage par `id`, puis par la relique portée ──
  // Deux reliques égales sur les quatre canaux (même principale ; Ténacité et
  // Régénération ne comptent pas en « Dégâts réels ») : notes égales.
  const petite: RelicDetail = { id: 300, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 5, tranche: 1000, percent: 1 } };
  const grande: RelicDetail = { id: 400, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 16, tranche: 1000, percent: 2 } };
  const rng = mulberry32(77);
  const runes = runesAuHasard(rng, 0);
  const inv = inventaire(rng, 4);
  const ctxEgalite = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, grande, [grande, petite]);
  const e = entreeResolutionDuBuild({
    fiche: { base: BASE, runes: [], artifacts: [], relic: grande }, runes,
    artifactParams: { porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [] },
    regime: 'degats_reels', degats: DEGATS, exclusive: EXCLUSIVE,
    requirement: { sets: [], minStats: {}, maxStats: {}, auraResPre: { res: 0, acc: 0, compter: true } }, relicContext: ctxEgalite, caches: null,
  });
  const c1 = compteursVides();
  const parId = resoudreEquipementDuBuildRapide(e, c1);
  egal(parId.relique?.id, 300, 'égalité en « Dégâts réels » : la plus petite `id` gagne, même portée par l’autre');
  egal(c1.reliquesDominees, 1, 'égalité : la relique d’`id` plus grand est écartée sans note');
  ok(isDeepStrictEqual(parId, resoudreEquipementDuBuildRapide({ ...e, dominanceReliques: null })), 'égalité par `id` : même résultat que sans dominance');
  // Départage par la portée (celui des régimes de stat, `departagePortee`) : la
  // dominance suit le même départage que `bestRelicForBuild`.
  const parPortee: EntreeResolution = { ...e, regimeDeStat: true };
  const c2 = compteursVides();
  const r2 = resoudreEquipementDuBuildRapide(parPortee, c2);
  egal(r2.relique?.id, 400, 'égalité, départage par la portée : la relique portée gagne');
  egal(c2.reliquesDominees, 1, 'départage par la portée : c’est la relique NON portée qui est écartée');
  ok(isDeepStrictEqual(r2, resoudreEquipementDuBuildRapide({ ...parPortee, dominanceReliques: null })), 'départage par la portée : même résultat que sans dominance');
  // Le départage lui-même.
  egal(prefereeALEgalite(petite, grande), true, '`prefereeALEgalite` : `id` plus petit');
  egal(prefereeALEgalite(grande, petite, { equipee: grande }), false, '`prefereeALEgalite` : la portée ne compte pas hors `departagePortee`');
  egal(prefereeALEgalite(grande, petite, { equipee: grande, departagePortee: true }), true, '`prefereeALEgalite` : la portée d’abord sous `departagePortee`');
  egal(prefereeALEgalite(petite, grande, { equipee: grande, departagePortee: true }), false, '`prefereeALEgalite` : l’autre perd devant la portée');
}
