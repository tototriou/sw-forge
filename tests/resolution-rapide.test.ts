// Différentiel du PROTOTYPE de résolution de l'équipement
// (src/lib/resolutionRapide.ts, chantier perf-moteur, lot 2 quater) contre
// `resoudreEquipementDuBuild` de production, build par build : résultat
// ENTIER identique (paire, artéfacts, stats, `meilleurSansVerrous`,
// conformité, relique, `sansEffetSurLeTri`), mêmes erreurs.
//
// Référence de contrôle (`algo-verify`) : la production elle-même, qui note
// toutes les paires de toutes les reliques éligibles — exhaustive par
// construction. Les pools sont générés à graine fixe : runes tirées au hasard
// (`randomRune`), inventaire d'artéfacts à principales de valeurs variées et
// quelques Intangibles, reliques de principales et d'effets uniques variés
// (doublons de principale compris), minimums et maximums posés autour des
// stats des builds pour que des reliques soient faisables et d'autres non.
//
// Matrice : relique `recherche`, `equipped`, `off` et sans contexte ;
// artéfacts « Libre », emplacement figé sur l'artéfact porté, filtre de
// principale, lignes verrouillées (avec et sans coût des verrous) ;
// maximums ; régimes Dégâts réels, aucun, PV, ATQ, PV effectifs ; deux ordres
// de traitement (caches partagés de la file) ; des scores NaN injectés.
// Le test exige aussi que chaque chemin du prototype ait servi (reliques
// écartées sans note, reliques notées, diagnostic d'un build rejeté).

import { isDeepStrictEqual } from 'node:util';
import { ArtifactArchetype, ArtifactDetail, ArtifactKind, BaseStats, ElementKey, RelicDetail, RuneDetail } from '../src/types';
import { ARTIFACT_SUB_MAX } from '../src/lib/artifacts';
import { artifactSubKinds } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { BuildRequirement } from '../src/lib/runeBuildOptim';
import { RelicContext, resoudreContexteRelique } from '../src/lib/relicOptim';
import { RegimeArtefacts } from '../src/lib/artifactEvaluation';
import { ArtifactSearchParams, LigneVerrouillee } from '../src/lib/artifactOptim';
import { CachesResolution, EntreeResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { CachesResolutionRapide, CompteursResolutionRapide, compteursVides, resoudreEquipementDuBuildRapide } from '../src/lib/resolutionRapide';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { ResultatArtefacts } from '../src/lib/artifactQueue';
import { mulberry32, randomRune, SETS_VARIES } from '../scripts/lib/randomPool';
import { DEGATS_FICHE } from './artifact-fiche.test';
import { egal, ok, titre } from './outils';

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };
const BASE: BaseStats = { hp: 9000, atk: 650, def: 550, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 };
const DEGATS = { ...DEGATS_FICHE, setup: { ...DEGATS_FICHE.setup, critMode: 'crit' as const } };
const EXCLUSIVE = { setup: DEFAULT_DAMAGE_SETUP, element: null };

// Inventaire éligible (fire / attack) : principales PV, ATQ ou DEF à des
// valeurs VARIÉES (plusieurs formes de paire par code), quatre
// sous-propriétés sous leur plafond, environ un Intangible sur six.
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
        ...(rng() < 0.17 ? { intangible: true } : {}),
      });
    }
  }
  return pieces;
}

// Reliques : principales et effets variés, deux à principale identique, une
// sans `percent` (neutre), identifiants dans le désordre.
function reliques(rng: () => number, n: number): RelicDetail[] {
  const out: RelicDetail[] = [];
  const types = [1, 2, 3, 5, 7, 8, 9, 11, 13, 16];
  for (let i = 0; i < n; i++) {
    const code = ([100, 101, 102] as const)[Math.floor(rng() * 3)]!;
    const type = types[Math.floor(rng() * types.length)]!;
    out.push({
      id: 100 + Math.floor(rng() * 900) * 10 + i,
      upgrade: 6 + Math.floor(rng() * 6),
      main: { code, value: 8 + Math.floor(rng() * 7) },
      unique: { type, tranche: [150, 200, 1000, 18000][Math.floor(rng() * 4)]!, ...(i === 1 ? {} : { percent: 1 + Math.floor(rng() * 3) }) },
    });
  }
  out.push({ ...out[0]!, id: out[0]!.id + 1, unique: { type: 16, tranche: 18000, percent: 2 } });
  return out;
}

function build(rng: () => number, id0: number): RuneDetail[] {
  return [1, 2, 3, 4, 5, 6].map((slot) => randomRune(id0 + slot, slot, rng, SETS_VARIES));
}

const total = (runes: RuneDetail[], k: string) => computeStats({ base: BASE, runes, artifacts: [] }).find((s) => s.key === k)!.total;

interface Scenario {
  nom: string;
  regime: RegimeArtefacts;
  intention: 'recherche' | 'equipped' | 'off' | null;
  artefacts: 'libre' | 'fige' | 'principale' | 'verrous' | 'cout-verrous';
  maximums: boolean;
}

const SCENARIOS: Scenario[] = [];
for (const regime of ['degats_reels', 'aucun', 'hp', 'atk', 'ehp'] as RegimeArtefacts[]) {
  for (const intention of ['recherche', 'equipped', 'off', null] as const) {
    for (const artefacts of ['libre', 'fige', 'principale', 'verrous', 'cout-verrous'] as const) {
      // Toute la matrice en `recherche` (le chemin réécrit) ; les chemins à
      // relique fixe, sur « Libre » et les verrous.
      if (intention !== 'recherche' && artefacts !== 'libre' && artefacts !== 'verrous') continue;
      for (const maximums of [false, true]) {
        if (!maximums && regime !== 'degats_reels' && intention !== 'recherche') continue;
        SCENARIOS.push({ nom: `${regime} · relique ${intention ?? 'sans contexte'} · ${artefacts}${maximums ? ' · maximums' : ''}`, regime, intention, artefacts, maximums });
      }
    }
  }
}

// Le résultat, ou l'erreur levée (nom et message) : les deux se comparent.
type Issue = { r: ResultatArtefacts } | { erreur: string };

function resoudre(f: () => ResultatArtefacts): Issue {
  try {
    return { r: f() };
  } catch (e) {
    return { erreur: `${(e as Error).name} ${(e as Error).message}` };
  }
}

// Égalité PROFONDE stricte (NaN = NaN, -0 ≠ 0, clé absente ≠ `undefined`) :
// plus exigeante qu'une comparaison de JSON.
const memes = (a: Issue, b: Issue) => isDeepStrictEqual(a, b);
const conformeDe = (i: Issue) => ('r' in i ? i.r.conforme : null);
const apercu = (i: Issue) => JSON.stringify(i).slice(0, 160);

export default function testResolutionRapide() {
  titre('Prototype de résolution de l’équipement — même résultat que la production, build par build');
  const compteurs = compteursVides();
  let compares = 0;
  let conformes = 0;
  let rejetes = 0;
  const ecarts: string[] = [];

  SCENARIOS.forEach((sc, iScenario) => {
    const rng = mulberry32(7100 + iScenario);
    const inv = inventaire(rng, 7);
    const reliquesInv = reliques(rng, 6);
    const portee = reliquesInv[Math.floor(rng() * reliquesInv.length)]!;
    const builds = Array.from({ length: 14 }, (_, i) => build(rng, 100 * i));
    // Seuils autour des stats des builds : la relique et la paire décident.
    const mediane = (k: string) => builds.map((b) => total(b, k)).sort((a, b) => a - b)[Math.floor(builds.length / 2)]!;
    const requirement: BuildRequirement = {
      sets: [],
      minStats: {
        hp: Math.round(mediane('hp') * (1 + 0.1 * rng())),
        atk: Math.round(mediane('atk') * (1 + 0.1 * rng())),
        def: Math.round(mediane('def') * (0.95 + 0.1 * rng())),
      },
      maxStats: sc.maximums ? { atk: Math.round(mediane('atk') * 1.3), hp: Math.round(mediane('hp') * 1.45) } : {},
      auraResPre: { res: 0, acc: 0, compter: true },
    };
    const element = inv.find((a) => a.kind === 'element')!;
    const lignes: LigneVerrouillee[] = sc.artefacts === 'verrous' || sc.artefacts === 'cout-verrous'
      ? [{ code: inv.find((a) => a.kind === 'archetype')!.subs[0]!.code, min: 1 }]
      : [];
    const artifactParams: Omit<ArtifactSearchParams, 'evaluer'> = {
      porteur: PORTEUR,
      inventaire: inv,
      equipes: [element],
      principaleParSorte: sc.artefacts === 'fige' ? { element: 'equipped' } : sc.artefacts === 'principale' ? { archetype: 101 } : {},
      lignesVerrouillees: lignes,
      maxStatsActifs: sc.maximums ? ['atk', 'hp'] : [],
      ...(sc.artefacts === 'cout-verrous' ? { avecCoutDesVerrous: true } : {}),
    };
    const ctx: RelicContext | undefined = sc.intention
      ? resoudreContexteRelique({ mode: sc.intention, principale: 'libre', type: 'libre', seuil: 0 }, portee, reliquesInv)
      : undefined;
    const fiche = { base: BASE, runes: [], artifacts: [element], relic: portee };
    const entree = (runes: RuneDetail[], caches: CachesResolution | null): EntreeResolution => entreeResolutionDuBuild({
      fiche, runes, artifactParams, regime: sc.regime, degats: sc.regime === 'degats_reels' ? DEGATS : null,
      exclusive: EXCLUSIVE, requirement, relicContext: ctx, caches,
    });

    // Référence : la production, sans cache (tout recalculé).
    const reference = builds.map((b) => resoudre(() => resoudreEquipementDuBuild(entree(b, null))));
    for (const r of reference) {
      if (conformeDe(r) === true) conformes++;
      else if (conformeDe(r) === false) rejetes++;
    }
    // Prototype : caches d'une file partagés, dans l'ordre puis à rebours.
    for (const [nomOrdre, ordre] of [['ordre', builds.map((_, i) => i)], ['à rebours', builds.map((_, i) => builds.length - 1 - i)]] as const) {
      const caches = nouveauxCachesResolution();
      const rapide = new CachesResolutionRapide();
      for (const i of ordre) {
        const proto = resoudre(() => resoudreEquipementDuBuildRapide(entree(builds[i]!, caches), rapide, compteurs));
        compares++;
        if (!memes(proto, reference[i]!)) ecarts.push(`${sc.nom} · ${nomOrdre} · build ${i} : ${apercu(proto)} ≠ ${apercu(reference[i]!)}`);
      }
    }
  });
  egal(ecarts.slice(0, 5), [], `${compares} résolutions sur ${SCENARIOS.length} scénarios, deux ordres : résultat du prototype = production`);
  ok(conformes > 50 && rejetes > 50, `des builds conformes (${conformes}) et rejetés (${rejetes}) dans la référence`);
  cheminsServis(compteurs);

  // ── Scores NaN : l'ordre des paires est celui du tri de la production. ──
  {
    const rng = mulberry32(9917);
    const inv = inventaire(rng, 7);
    const reliquesInv = reliques(rng, 6);
    const builds = Array.from({ length: 30 }, (_, i) => build(rng, 100 * i));
    const requirement: BuildRequirement = { sets: [], minStats: { hp: Math.round(total(builds[0]!, 'hp') * 1.05) }, auraResPre: { res: 0, acc: 0, compter: true } };
    const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, reliquesInv);
    const artifactParams: Omit<ArtifactSearchParams, 'evaluer'> = { porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [] };
    // Une paire sur trois (par identifiant de l'attribut) note NaN.
    const avecNaN = (e: EntreeResolution): EntreeResolution => ({
      ...e,
      faireParams: (r) => {
        const p = e.faireParams(r);
        return { ...p, evaluer: (arts) => (arts[0] && arts[0].kind === 'element' && arts[0].id % 3 === 0 ? Number.NaN : p.evaluer(arts)) };
      },
    });
    const entree = (runes: RuneDetail[]) => avecNaN(entreeResolutionDuBuild({
      fiche: { base: BASE, runes: [], artifacts: [] }, runes, artifactParams, regime: 'degats_reels', degats: DEGATS,
      exclusive: EXCLUSIVE, requirement, relicContext: ctx, caches: null,
    }));
    const ecartsNaN: number[] = [];
    let conformesNaN = 0;
    builds.forEach((b, i) => {
      const ref = resoudre(() => resoudreEquipementDuBuild(entree(b)));
      if (conformeDe(ref) === true) conformesNaN++;
      if (!memes(resoudre(() => resoudreEquipementDuBuildRapide(entree(b))), ref)) ecartsNaN.push(i);
    });
    egal(ecartsNaN, [], `scores NaN injectés : ${builds.length} builds, résultat du prototype = production (tri de la production)`);
    ok(conformesNaN > 0 && conformesNaN < builds.length, `… builds conformes et rejetés parmi eux (${conformesNaN} conformes)`);
  }

  // ── Pool de reliques vide en mode `recherche` : la même erreur. ──
  {
    const ctxVide = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 99 }, undefined, reliques(mulberry32(5), 3));
    const e = entreeResolutionDuBuild({
      fiche: { base: BASE, runes: [], artifacts: [] }, runes: build(mulberry32(6), 0),
      artifactParams: { porteur: PORTEUR, inventaire: [], equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [] },
      regime: 'aucun', degats: null, exclusive: EXCLUSIVE, requirement: { sets: [], minStats: {} }, relicContext: ctxVide, caches: null,
    });
    const ref = resoudre(() => resoudreEquipementDuBuild(e));
    ok('erreur' in ref && ref.erreur.startsWith('RechercheRefusee'), `pool vide : la production lève RechercheRefusee (${apercu(ref)})`);
    egal(resoudre(() => resoudreEquipementDuBuildRapide(e)), ref, '… le prototype lève la même');
  }
}

function cheminsServis(c: CompteursResolutionRapide) {
  ok(c.reliquesSansFormeFaisable > 0, `reliques écartées sans aucune note : ${c.reliquesSansFormeFaisable} sur ${c.reliques}`);
  ok(c.reliquesNotees > 0, `reliques notées par pairesParScore : ${c.reliquesNotees}`);
  ok(c.reliquesNoteesSansCouple > 0, `reliques à forme faisable mais sans couple faisable (verrous, Intangibles) : ${c.reliquesNoteesSansCouple}`);
  ok(c.diagnostics > 0, `diagnostics reconstruits pour un build rejeté : ${c.diagnostics}`);
}
