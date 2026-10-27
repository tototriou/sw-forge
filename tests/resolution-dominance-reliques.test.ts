// Dominance des reliques dans la résolution rapide (src/lib/resolutionRapide.ts,
// `reliquesDominees`, `DominanceParPaire`) : en « Dégâts réels », une relique
// dominée sur ses quatre canaux (PV, ATQ, DEF, dégâts infligés) n'est pas
// notée ; puis, sur les autres, une paire dominée sur ses seuls canaux ACTIFS
// (stats lues par la note, `statsDuLanceurLuesParLaNote`, lignes 218-220 de la
// paire, dégâts infligés) n'est pas notée.
//
// ⚠️ La dominance REPOSE sur la règle de jeu R — les dégâts ne baissent jamais
// quand PV, ATQ, DEF, une ligne d'artéfact ou l'effet unique d'une relique
// augmentent — et, par classe de paires, sur la table des lecteurs ; règles
// confirmées par l'utilisateur, jamais relevées en jeu. Ce test le dit dans
// son titre : il vérifie que le CODE les suit sur ses fixtures (oracle paire
// par paire), il ne les prouve pas.
//
// Références de contrôle (`algo-verify`) :
// - la résolution SANS dominance (`dominanceReliques: null`) et celle du
//   niveau build seul (`lues: null`), même entrée : résultat entier identique
//   (relique, paire, note au bit, stats, verdict) ;
// - paire par paire : pour chaque relique écartée, une relique notée qui gagne
//   l'égalité a, sur CHAQUE paire autorisée où l'écartée est faisable, une
//   note au moins égale (le vrai `evaluer` de `faireParams`) ; pour chaque
//   paire évitée par classe, une relique notée qui gagne l'égalité, faisable
//   sur elle, y note au moins autant. Sort témoin `1.0*{ATK}` : PV et DEF
//   inertes hors des lignes 218 et 220.
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
import { EXCEPTIONS_REGLE_R, compteursVides, resoudreEquipementDuBuildRapide } from '../src/lib/resolutionRapide';
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

// Les paires notées, par relique (les sondes de pertinence, pièces d'`id` ≤ 0, exclues).
function pairesNotees(e: EntreeResolution, parRelique: Map<number, ArtifactDetail[][]>): EntreeResolution {
  return { ...e, faireParams: (r) => {
    const p = e.faireParams(r);
    const liste = parRelique.get(r?.id ?? -1) ?? [];
    parRelique.set(r?.id ?? -1, liste);
    return { ...p, evaluer: (arts) => {
      if (!arts.some((x) => x.id <= 0)) liste.push([...arts]);
      return p.evaluer(arts);
    } };
  } };
}
const clePaire = (p: ArtifactDetail[]) => p.map((x) => x.id).join('+');

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
  titre('Dominance des reliques (résolution rapide, « Dégâts réels »), au niveau build et par classe de paires — repose sur la règle de jeu R et sur la table des lecteurs, règles de jeu confirmées par l’utilisateur (non relevées en jeu) : même résultat que sans dominance et qu’au niveau build seul, oracle paire par paire');

  const ecarts: string[] = [];
  let builds = 0, ecartees = 0, pairesComparees = 0, conformes = 0, pairesEvitees = 0, pairesVerifiees = 0, renotees = 0;
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
      if (!isDeepStrictEqual(e.dominanceReliques?.lues, ['atk'])) ecarts.push(`table des lecteurs du sort témoin (\`1.0*{ATK}\`) : ${e.dominanceReliques?.lues}`);
      const notees = new Set<number>();
      const c = compteursVides();
      const avecPaires = new Map<number, ArtifactDetail[][]>();
      const sansPaires = new Map<number, ArtifactDetail[][]>();
      const avec = resoudreEquipementDuBuildRapide(pairesNotees(suivie(e, notees), avecPaires), c);
      const sans = resoudreEquipementDuBuildRapide(pairesNotees({ ...e, dominanceReliques: null }, sansPaires));
      const niveauBuildPaires = new Map<number, ArtifactDetail[][]>();
      const niveauBuild = resoudreEquipementDuBuildRapide(pairesNotees({ ...e, dominanceReliques: { ...e.dominanceReliques!, lues: null } }, niveauBuildPaires));
      if (!isDeepStrictEqual(avec, sans) || !isDeepStrictEqual(avec, niveauBuild)) {
        ecarts.push(`graine ${graine}, build ${builds} : avec dominance relique ${avec.relique?.id} note ${avec.paire?.score}, niveau build seul ${niveauBuild.relique?.id} note ${niveauBuild.paire?.score}, sans ${sans.relique?.id} note ${sans.paire?.score}`);
      }
      if (avec.conforme) conformes++;
      ecartees += c.reliquesDominees;
      pairesEvitees += c.pairesDominees;
      renotees += c.reliquesRenotees;
      // Oracle paire par paire du second niveau : chaque paire d'une relique
      // notée (une paire au moins, avec les classes de paires ou au niveau
      // build seul), notée sans dominance mais pas avec, a une dominante
      // notée, qui gagne l'égalité, est faisable sur elle et y note au moins
      // autant. (`faireParams` de la première éligible sert aussi aux formes :
      // l'avoir appelé ne dit pas qu'elle est notée.)
      for (const [idB, pairesB] of sansPaires) {
        if (!(avecPaires.get(idB)?.length || niveauBuildPaires.get(idB)?.length)) continue;
        const gardees = new Set((avecPaires.get(idB) ?? []).map(clePaire));
        const b = pool.find((r) => r.id === idB)!;
        const noteB = e.faireParams(b).evaluer;
        for (const p of pairesB) {
          if (gardees.has(clePaire(p))) continue;
          pairesVerifiees++;
          const vB = noteB(p);
          const dominante = pool.find((a) => a !== b && notees.has(a.id) && prefereeALEgalite(a, b, { equipee: ctx.equipee })
            && respecteConditionsAvecRelique({ ...e.gear, artifacts: p }, a, requirement).respecte && e.faireParams(a).evaluer(p) >= vB);
          if (!dominante) ecarts.push(`graine ${graine}, build ${builds} : paire ${clePaire(p)} de la relique ${idB} (note ${vB}) évitée sans dominante notée`);
        }
      }
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
  ok(pairesEvitees > 0 && pairesVerifiees === pairesEvitees,
    `classes de paires (PV et DEF inertes hors lignes 218 et 220) : ${pairesEvitees} paires évitées, ${pairesVerifiees} vérifiées contre une dominante notée (${renotees} relique(s) notée(s) à nouveau)`);

  // ── Repli : une paire évitée dont la seule dominante n'a aucun couple ──
  // La dominante (ATQ % en principale, `id` plus petit) est faisable sur les
  // formes à principale de PV, mais ses candidats de paires sont vidés : seul
  // l'emplacement vide lui reste, infaisable (minimum de PV). Les paires de
  // l'autre relique (PV % en principale) qu'elle domine sur l'ATQ et les
  // dégâts infligés (PV et DEF inertes : ni ligne 218 ni 220) sont d'abord
  // évitées, puis la relique est notée en entier.
  {
    const rngR = mulberry32(91);
    const runesR = runesAuHasard(rngR, 0);
    // Sans lignes 218 ni 220 : les PV et la DEF restent inertes sur toute paire.
    const invR = inventaire(rngR, 6).map((a) => ({ ...a, subs: a.subs.filter((s) => s.code !== 218 && s.code !== 220) }));
    const dominante: RelicDetail = { id: 10, upgrade: 9, main: { code: 101, value: 15 }, unique: { type: 5, tranche: 1000, percent: 1 } };
    const dominee: RelicDetail = { id: 20, upgrade: 9, main: { code: 100, value: 8 }, unique: { type: 5, tranche: 1000, percent: 1 } };
    // Minimum de PV hors d'atteinte sans principale de PV, pour les deux
    // reliques : toutes les paires faisables de la dominée sont évitées, sans
    // le repli elle n'aurait aucun couple et le build serait rejeté à tort.
    const pvSansArtefact = Math.max(...[dominante, dominee].map((r) =>
      computeStats({ base: BASE, runes: runesR, artifacts: [], relic: r }).find((s) => s.key === 'hp')!.total));
    const ctxR = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, [dominee, dominante]);
    const artifactParams: Omit<ArtifactSearchParams, 'evaluer'> = { porteur: PORTEUR, inventaire: invR, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [] };
    const e0 = entreeResolutionDuBuild({
      fiche: { base: BASE, runes: [], artifacts: [], relic: undefined }, runes: runesR, artifactParams, regime: 'degats_reels', degats: DEGATS,
      exclusive: EXCLUSIVE, requirement: { sets: [], minStats: { hp: pvSansArtefact + 1 }, maxStats: {}, auraResPre: { res: 0, acc: 0, compter: true } },
      relicContext: ctxR, caches: null,
    });
    const eR: EntreeResolution = { ...e0, faireParams: (r) => (r?.id === dominante.id ? { ...e0.faireParams(r), inventaire: [] } : e0.faireParams(r)) };
    egal(ctxR.eligibles[0]?.id, dominee.id, 'repli : la première éligible (formes de la file) garde l’inventaire entier');
    const cR = compteursVides();
    const rR = resoudreEquipementDuBuildRapide(eR, cR);
    egal(cR.reliquesRenotees, 1, 'repli : la relique dont une paire évitée n’a aucune dominante avec un couple est notée à nouveau');
    egal(cR.pairesDominees, 0, 'repli : ses paires évitées au premier tour ne restent pas comptées');
    ok(isDeepStrictEqual(rR, resoudreEquipementDuBuildRapide({ ...eR, dominanceReliques: null })) && rR.relique?.id === dominee.id,
      `repli : même résultat que sans dominance (relique ${rR.relique?.id}, note ${rR.paire?.score})`);
  }

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
  // Un sort en exception à la règle R (Ceres, Last Shot) : le producteur ne pose
  // aucune dominance, ni au niveau build ni par paire ; les deux reliques sont
  // notées, et le résultat est celui de la même entrée sans dominance.
  const idExceptionR = [...EXCEPTIONS_REGLE_R.keys()][0]!;
  const eException = entreeResolutionDuBuild({
    fiche: { base: BASE, runes: [], artifacts: [], relic: grande }, runes,
    artifactParams: { porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: [] },
    regime: 'degats_reels', degats: { ...DEGATS, profile: { ...DEGATS.profile, skillCom2usId: idExceptionR } }, exclusive: EXCLUSIVE,
    requirement: { sets: [], minStats: {}, maxStats: {}, auraResPre: { res: 0, acc: 0, compter: true } }, relicContext: ctxEgalite, caches: null,
  });
  egal(eException.dominanceReliques, null, `sort en exception à la règle R (${idExceptionR}) : aucune dominance posée par le producteur`);
  const cException = compteursVides();
  const rException = resoudreEquipementDuBuildRapide(eException, cException);
  egal(cException.reliquesDominees + cException.pairesDominees, 0, 'sort en exception : aucune relique ni paire écartée sans note');
  ok(isDeepStrictEqual(rException, parId), 'sort en exception : même résultat que le sort témoin, dont la relique d’`id` plus grand est écartée sans note');
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
