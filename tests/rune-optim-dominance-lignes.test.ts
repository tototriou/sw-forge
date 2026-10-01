// La dominance des runes face aux lignes d'artéfact 218–221 (degats-et-aura,
// lot 6bis-b3d-1, constat B1 de la revue technique 6bis-b). En « Dégâts
// réels », ces lignes ajoutent un pourcentage des PV, de l'ATQ, de la DEF ou
// de la VIT de combat (`ajoutArtefactBrut`, damage.ts). `damageRelevantStats`
// les exclut volontairement de l'objectif (décision de rétention), et la
// dominance reprenait ce choix : Energy, Guard, Enhance ou Determination
// tombaient face à un Will aux mêmes stats, optimum perdu.
//
// Discipline `algo-verify` : un ORACLE exhaustif, sur le pool AVANT
// préparation, contre le vrai moteur (`searchBuilds`, bout en bout), classé
// comme la production (`optionsDeClassement` + `sortCandidates`).
//
// ⚠️ **La note de l'oracle est celle de la PRODUCTION** pour l'équipement
// complet (cadrage A.6 bis) : `computeStats` avec la paire, `objectiveScore`
// avec les auras propres du build (`aurasPropresDesRunes`), le profil des
// lignes de CETTE paire (`artifactDamageProfile`) et l'effet unique de la
// relique (`apportExclusive`, neutre sans relique). En « Libre », la paire
// est résolue par build : l'oracle énumère lui-même toutes les paires
// équipables et prend la meilleure note de l'équipement complet.
//
// ⚠️ Indépendance : l'oracle n'appelle ni `prepareSearch` ni aucune coupe.

import { egal, ok, titre } from './outils';
import { DOMINANCE, HEURISTIQUES, premiereCoupe, setsSatisfaits } from './rune-optim-auras-coupes.test';
import { activeSets, runeEfficiency } from '../src/lib/effects';
import type { StatKey } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import {
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  artifactDamageProfile,
  aurasPropresDesRunes,
  damageRelevantStats,
  estPrisEnCharge,
  skillDamageProfile,
  statsDesLignesBrutes,
} from '../src/lib/damage';
import type { DamageSetup, SkillDamageProfile } from '../src/lib/damage';
import { Competence } from '../src/lib/monsterSkills';
import { apportExclusive } from '../src/lib/relicExclusive';
import {
  aurasPropresParRunes,
  avecAurasConditions,
  buildBuckets,
  objectiveScore,
  optionsDeClassement,
  prepareSearch,
  scoreDuCandidat,
  searchBuilds,
  sortCandidates,
  statsLuesParLesLignes,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import type { BuildCandidate, RealDamageContext, SearchParams, SearchResult } from '../src/lib/runeBuildOptim';
import { candidatsParSorte, paireRepresentative, type ArtifactSearchParams, type ChoixPrincipale } from '../src/lib/artifactOptim';
import { artifactPairAllowed } from '../src/lib/artifacts';
import {
  AUCUN_ARTEFACT_RESERVE, evaluateursArtefactsFiche, parametresArtefactsFiche, statsLignesArtefactsEquipables,
} from '../src/lib/artifactFiche';
import { entreeResolutionDuBuild, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { buildOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { prepareOrRefuse } from '../src/workers/prepareForSearch';
import { drain } from '../scripts/lib/drain';
import { artefactsDuCli, recipeToSearchParams, resolveStatsLignesArtefacts } from '../scripts/lib/recipeToSearchParams';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import { readFileSync } from 'node:fs';
import type { ArtifactDetail, ArtifactKind, BaseStats, GearSet, RuneDetail } from '../src/types';

const BASE: BaseStats = { hp: 10000, atk: 660, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
// Les principales du cas minimal de b3c (sonde de la revue) : ATQ, PV %, DEF,
// PV %, PV, PV % — identiques pour tous les sets, aucune sous-propriété.
const PRINCIPALES: Record<number, [number, number]> = { 1: [3, 160], 2: [2, 63], 3: [5, 160], 4: [2, 63], 5: [1, 2448], 6: [2, 63] };

function rune(id: number, slot: number, set: string): RuneDetail {
  const [code, value] = PRINCIPALES[slot];
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code, value }, subs: [] };
}

export function art(id: number, kind: 'element' | 'archetype', main: [number, number], subs: [number, number][]): ArtifactDetail {
  return {
    id, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }), level: 15, rarity: 5,
    main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })),
  };
}

function sortSynthetique(formule: string): SkillDamageProfile {
  const competence: Competence = {
    id: 1, com2usId: 1, nom: 'Test', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: 1, niveauMax: 5, formule, scale: [], ameliorations: [], icone: null, effets: [],
  };
  const p = skillDamageProfile(competence);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sortSynthetique : la formule "${formule}" n'est pas lue par le modèle.`);
  return p;
}

export const SORTS = { atk: sortSynthetique('3.0*{ATK}'), hp: sortSynthetique('0.3*{MAX HP}') };
type SortCle = keyof typeof SORTS;

interface Cas {
  nom: string;
  pool: RuneDetail[];
  sets: string[];
  sort: SortCle;
  // La paire FIXE (« Garder l'artéfact équipé » ×2) : `SearchParams.artifacts`.
  paire: ArtifactDetail[];
  critMode?: DamageSetup['critMode'];
}

const setupDe = (cas: Cas): DamageSetup => ({ ...DEFAULT_DAMAGE_SETUP, critMode: cas.critMode ?? DEFAULT_DAMAGE_SETUP.critMode });

function contexteDegats(cas: Cas, paire: ArtifactDetail[]): RealDamageContext {
  return {
    profile: SORTS[cas.sort], passifs: [], setup: setupDe(cas), element: null, artefacts: artifactDamageProfile(paire),
    critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {},
    bonusDegatsConditionnel: null, bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null,
  };
}

function parametres(cas: Cas, extra: Partial<SearchParams> = {}): SearchParams {
  const setup = setupDe(cas);
  // Heuristiques NON contraignantes : pré-filtrage et rétention plus larges
  // que le pool, collecte et temps illimités en pratique.
  return {
    base: BASE, artifacts: cas.paire, relic: undefined, relicContext: undefined, pool: cas.pool,
    requirement: avecAurasConditions({ sets: cas.sets, minStats: {} }, setup, true), metric: 'eff',
    objective: 'degats_reels', objectiveStats: damageRelevantStats(SORTS[cas.sort], [], setup),
    maxMs: 120000, maxCollected: 1_000_000, slotFilterCap: 200, bucketCap: 100000, ...extra,
  };
}

/* --------------------------------------------------------------------------
 * La note de production, et l'oracle
 * ----------------------------------------------------------------------- */

// La note d'UN équipement complet : six runes, cette paire, aucune relique.
export function noteEquipement(cas: Cas, runes: RuneDetail[], paire: ArtifactDetail[]): number {
  const setup = setupDe(cas);
  const stats = computeStats({ base: BASE, runes, artifacts: paire, relic: undefined });
  const propres = aurasPropresDesRunes(runes);
  const candidat: BuildCandidate = { runeIds: runes.map((r) => r.id), stats, effTotal: runes.reduce((s, r) => s + runeEfficiency(r), 0) };
  return objectiveScore(candidat, 'degats_reels', propres, contexteDegats(cas, paire), apportExclusive(undefined, stats, setup, propres, null), setup);
}

// Les builds valides (combo demandé, au plus une Intangible) et leur note.
function oracle(cas: Cas, noter: (runes: RuneDetail[]) => number): Map<string, number> {
  const parSlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const x of cas.pool) parSlot[x.slot - 1].push(x);
  const valides = new Map<string, number>();
  const choix: RuneDetail[] = [];
  const recurse = (i: number) => {
    if (i === 6) {
      if (choix.filter((x) => x.set === 'intangible').length > 1) return;
      if (!setsSatisfaits(cas.sets, activeSets(choix.map((x) => x.set)))) return;
      valides.set(choix.map((x) => x.id).join(','), noter([...choix]));
      return;
    }
    for (const x of parSlot[i]) {
      choix.push(x);
      recurse(i + 1);
      choix.pop();
    }
  };
  recurse(0);
  return valides;
}

/* --------------------------------------------------------------------------
 * Le moteur, son classement, et la comparaison
 * ----------------------------------------------------------------------- */

const cleDe = (c: { runeIds: number[] }) => c.runeIds.join(',');
const presque = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// L'espace EXACT de l'appariement : `explored` d'une recherche complète
// l'atteint (algo-verify, autodiagnostic de complétude).
function espaceExact(p: SearchParams): number {
  const prepared = prepareSearch(p);
  if (!prepared) return 0;
  const a = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, p.adaptiveTrancheWeighting, p.combosOrderMode));
  const b = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, p.adaptiveTrancheWeighting, p.combosOrderMode));
  return totalPairCount(prepared, a, b);
}

// Les runes présentes après l'étage de DOMINANCE (observateur `onStage`).
export function apresDominance(p: SearchParams): number[] {
  let ids: number[] = [];
  prepareSearch(p, (etage, listes) => { if (etage === 'dominance') ids = listes.flat().map((r) => r.id).sort((a, b) => a - b); });
  return ids;
}

interface Bilan {
  resultat: SearchResult;
  valides: Map<string, number>;
  survivantes: number[];
}

// Un run COMPLET face à l'oracle, paire fixe : complétude, aucun faux positif,
// zéro faux rejet par une coupe sûre autre que la dominance, et l'optimum de
// la note de production conservé — parmi les candidats (`findIndex`, jamais
// `candidates[0]`) et en tête du classement de production.
function verifierPaireFixe(cas: Cas): Bilan & { tout: boolean } {
  const p = parametres(cas);
  const valides = oracle(cas, (runes) => noteEquipement(cas, runes, cas.paire));
  const resultat = searchBuilds(p);
  let tout = true;
  const t = (cond: boolean, libelle: string) => { ok(cond, libelle); tout &&= cond; };
  const espace = espaceExact(p);
  t(!resultat.truncated && resultat.explored === espace,
    `${cas.nom} : recherche complète (tronquée ${resultat.truncated}, explorées ${resultat.explored} / totalPairCount ${espace} ; ${valides.size} build(s) valide(s) à l'oracle)`);
  const fauxPositifs = resultat.candidates.map(cleDe).filter((c) => !valides.has(c));
  t(fauxPositifs.length === 0, `${cas.nom} : aucun faux positif (${fauxPositifs.join(' ; ') || '—'})`);
  const fauxRejets: string[] = [];
  const trouves = new Set(resultat.candidates.map(cleDe));
  for (const cle of valides.keys()) {
    if (trouves.has(cle)) continue;
    const tr = searchBuilds({ ...p, traceur: { runeIds: cle.split(',').map(Number) } });
    const coupe = premiereCoupe(tr.traceur, tr.truncated);
    if (!HEURISTIQUES.has(coupe) && coupe !== DOMINANCE) fauxRejets.push(`${cle} → ${coupe}`);
  }
  t(fauxRejets.length === 0, `${cas.nom} : zéro faux rejet par une coupe sûre autre que la dominance (${fauxRejets.join(' ; ') || '—'})`);
  const meilleur = Math.max(...valides.values());
  const optimaux = new Set([...valides].filter(([, n]) => presque(n, meilleur)).map(([c]) => c));
  const rang = resultat.candidates.findIndex((c) => optimaux.has(cleDe(c)));
  // Le classement de production : options de l'écran et du CLI.
  const setup = setupDe(cas);
  const runeById = new Map(cas.pool.map((r) => [r.id, r]));
  const opts = optionsDeClassement({
    realDamage: contexteDegats(cas, cas.paire), damageSetup: setup, runeById, metric: 'eff', aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: () => null, etatReliqueDe: () => ({ etat: 'fixe', relique: undefined }), contexteExclusive: { setup, element: null },
  });
  // A.6 bis : la note de l'oracle EST celle de la production — pour chaque
  // candidat, le chiffre de la carte et du tri (`scoreDuCandidat`).
  const ecartsNote = resultat.candidates.filter((c) => !presque(scoreDuCandidat(c, 'degats_reels', opts) ?? Number.NaN, valides.get(cleDe(c)) ?? Number.NaN));
  t(ecartsNote.length === 0,
    `${cas.nom} : note de l’oracle = scoreDuCandidat de la production pour chacun des ${resultat.candidates.length} candidat(s) (${ecartsNote.map(cleDe).join(' ; ') || '—'})`);
  const premier = sortCandidates(resultat.candidates, 'degats_reels', opts)[0];
  const notePremier = premier ? valides.get(cleDe(premier)) ?? Number.NaN : Number.NaN;
  t(rang >= 0 && presque(notePremier, meilleur),
    `${cas.nom} : optimum de la note de production conservé (oracle ${meilleur.toFixed(4)} sur ${[...optimaux].join(' / ')} ; au rang de collecte ${rang} ; 1er du classement de production ${premier ? cleDe(premier) : '—'} noté ${notePremier.toFixed(4)})`);
  return { resultat, valides, survivantes: apresDominance(p), tout };
}

/* --------------------------------------------------------------------------
 * Quatre porteurs, témoin sans ligne, variante avec Intangible
 * ----------------------------------------------------------------------- */

interface Porteur { nom: string; set: string; ligne: number; valeur: number }
// La sonde de la revue (§ 2.1), devenue test : deux bonus de fiche, deux auras.
const PORTEURS: Porteur[] = [
  { nom: 'Energy (PV +15 %) + ligne 218 (PV)', set: 'energy', ligne: 218, valeur: 1.5 },
  { nom: 'Guard (DEF +15 %) + ligne 220 (DEF)', set: 'guard', ligne: 220, valeur: 4 },
  { nom: 'Enhance (aura PV +8 % de base) + ligne 218 (PV)', set: 'enhance', ligne: 218, valeur: 1.5 },
  { nom: 'Determination (aura DEF +8 % de base) + ligne 220 (DEF)', set: 'determination', ligne: 220, valeur: 4 },
];

// Violent demandé (emplacements 1–4) ; Will 5/6 (ids 5, 6) et le set porteur
// 5/6 (ids 105, 106), aux stats IDENTIQUES ; sort `3.0*{ATK}` ; paire FIXE
// dont l'artéfact d'attribut porte la ligne.
function casPorteur(nom: string, set: string, ligne: number, valeur: number, joker = false): Cas {
  const pool = [rune(1, 1, 'violent'), rune(2, 2, 'violent'), rune(3, 3, 'violent'), rune(4, 4, 'violent'),
    rune(5, 5, 'will'), rune(6, 6, 'will'), rune(105, 5, set), rune(106, 6, set)];
  if (joker) pool.push(rune(201, 1, 'intangible'));
  return {
    nom, pool, sets: ['violent'], sort: 'atk',
    paire: [art(501, 'element', [101, 100], ligne ? [[ligne, valeur]] : []), art(502, 'archetype', [101, 100], [])],
  };
}

export function testDominanceLignesQuatrePorteurs() {
  titre('Dominance · lignes d’artéfact 218–221 — quatre porteurs, témoin, variante avec Intangible (6bis-b3d-1)');
  for (const p of PORTEURS) {
    const cas = casPorteur(p.nom, p.set, p.ligne, p.valeur);
    egal(parametres(cas).objectiveStats, ['atk', 'cd'], `${cas.nom} : précondition — la stat de la ligne est hors de l’objectif`);
    const { valides, survivantes } = verifierPaireFixe(cas);
    ok(Math.max(...valides.values()) > (valides.get('1,2,3,4,5,6') ?? Infinity),
      `${cas.nom} : précondition — le porteur bat Violent + Will à l’oracle (${Math.max(...valides.values()).toFixed(4)} contre ${valides.get('1,2,3,4,5,6')?.toFixed(4)})`);
    ok(survivantes.includes(105) && survivantes.includes(106), `${cas.nom} : les runes 105 et 106 passent la dominance (${survivantes.join(',')})`);
  }
  // Témoin : sans ligne, le porteur ne sert à rien — la dominance peut le
  // retirer, l'optimum est Violent + Will.
  const temoin = casPorteur('Témoin : Energy SANS ligne 218', 'energy', 0, 0);
  const t = verifierPaireFixe(temoin);
  egal(t.survivantes, [1, 2, 3, 4, 5, 6], `${temoin.nom} : sans ligne, Energy reste interchangeable et tombe (comportement inchangé)`);
  // Variante avec Intangible : la règle du joker protégeait déjà Energy
  // (complet avec ses deux vraies runes) — avant comme après.
  const joker = casPorteur('Variante : Energy + ligne 218, une Intangible dans le pool', 'energy', 218, 1.5, true);
  const j = verifierPaireFixe(joker);
  egal(j.survivantes, [1, 2, 3, 4, 5, 6, 105, 106, 201], `${joker.nom} : rien n’est retiré à la dominance, avant comme après`);
}

/* --------------------------------------------------------------------------
 * Un set formable SEULEMENT grâce au joker
 * ----------------------------------------------------------------------- */

// Blade demandé (emplacements 1–2, quatre libres) ; Fatal sur TROIS
// emplacements (3–5) + une Intangible (6) : Fatal se forme par le joker
// seulement. Violent 3–5 aux stats IDENTIQUES (ids plus petits) ; sort sur
// les PV, ligne 219 (ATQ) : le +35 % d'ATQ de Fatal ne compte que par elle.
function casJoker(fatal: number[], nom: string): Cas {
  const pool = [rune(1, 1, 'blade'), rune(2, 2, 'blade')];
  for (const s of fatal) pool.push(rune(s, s, 'violent'), rune(100 + s, s, 'fatal'));
  pool.push(rune(206, 6, 'intangible'));
  return { nom, pool, sets: ['blade'], sort: 'hp', paire: [art(501, 'element', [101, 100], [[219, 4]]), art(502, 'archetype', [101, 100], [])] };
}

export function testDominanceLignesJoker() {
  titre('Dominance · lignes d’artéfact 218–221 — un set formable seulement grâce au joker (6bis-b3d-1)');
  const cas = casJoker([3, 4, 5], 'Fatal ×3 + Intangible, Blade demandé, sort PV, ligne 219');
  egal(parametres(cas).objectiveStats?.includes('atk'), false, `${cas.nom} : précondition — l’ATQ est hors de l’objectif`);
  const { valides, survivantes } = verifierPaireFixe(cas);
  const meilleur = Math.max(...valides.values());
  egal([...valides].filter(([, n]) => presque(n, meilleur)).map(([c]) => c), ['1,2,103,104,105,206'],
    `${cas.nom} : précondition — l’optimum est Blade + Fatal complété par le joker (${meilleur.toFixed(4)} contre Blade + Violent ${valides.get('1,2,3,4,5,206')?.toFixed(4)})`);
  ok([103, 104, 105].every((id) => survivantes.includes(id)), `${cas.nom} : les trois Fatal passent la dominance (${survivantes.join(',')})`);
  // Témoin : Fatal COMPLET avec ses quatre vraies runes, une Intangible dans
  // le pool — la règle du joker le protégeait déjà, avant comme après.
  const complet = casJoker([3, 4, 5, 6], 'Témoin : Fatal ×4 (complet avec ses vraies runes) + Intangible');
  const c = verifierPaireFixe(complet);
  ok([103, 104, 105, 106].every((id) => c.survivantes.includes(id)), `${complet.nom} : les quatre Fatal passent la dominance (${c.survivantes.join(',')})`);
}

/* --------------------------------------------------------------------------
 * Branche « Libre » : la ligne n'est pas sur la représentative
 * ----------------------------------------------------------------------- */

// La fiche : la base seule (aucune rune, aucun artéfact, aucune relique) —
// ses PV sont bas, la ligne 218 y vaut peu : la représentative est A.
const FICHE: GearSet = { base: BASE, runes: [], artifacts: [], relic: undefined };
// A : la principale ATQ la plus forte, sans ligne. B : ATQ plus faible, ligne
// 218 (PV). C : la seule pièce de type. Sur un build à PV élevés, B l'emporte.
const PIECE_A = art(511, 'element', [101, 400], []);
const PIECE_B = art(512, 'element', [101, 100], [[218, 1.5]]);
const PIECE_C = art(611, 'archetype', [101, 100], []);
const INVENTAIRE_LIBRE = [PIECE_A, PIECE_B, PIECE_C];
const LIBRE: Partial<Record<ArtifactKind, ChoixPrincipale>> = { element: 'libre', archetype: 'libre' };

// Le contexte de paires de l'écran (`artifactParams`) : le producteur de b6
// et l'évaluateur de la fiche (6bis-b5b), pour cette fiche et cet inventaire.
function contexteDePaires(cas: Cas, inventaire: ArtifactDetail[]): ArtifactSearchParams {
  const setup = setupDe(cas);
  const { artefacts: _a, ...degats } = contexteDegats(cas, []);
  const { representatif } = evaluateursArtefactsFiche(FICHE, 'degats_reels', AUCUNE_AURA_PROPRE, degats, { setup, element: null }, undefined);
  return {
    ...parametresArtefactsFiche({
      porteur: { element: 'fire', archetype: 'attack' }, inventaire, reserves: AUCUN_ARTEFACT_RESERVE, equipes: [],
      optimiserArtefacts: true, principaleParSorte: LIBRE, lignesVerrouillees: [], damageSetup: setup, maxStats: {},
    }),
    evaluer: representatif,
  };
}

// La meilleure note de l'équipement complet d'un build sur TOUTES les paires
// équipables (vue complète des deux sortes, emplacement vide compris) — la
// note de production quand la paire est résolue par build.
function meilleureNoteLibre(cas: Cas, a: ArtifactSearchParams, runes: RuneDetail[]): { note: number; paire: number[] } {
  let meilleure = { note: Number.NEGATIVE_INFINITY, paire: [] as number[] };
  for (const el of candidatsParSorte(a, 'element')) for (const ar of candidatsParSorte(a, 'archetype')) {
    if (!artifactPairAllowed(el, ar)) continue;
    const paire = [el, ar].filter((x): x is ArtifactDetail => x != null);
    const n = noteEquipement(cas, runes, paire);
    if (n > meilleure.note) meilleure = { note: n, paire: paire.map((x) => x.id) };
  }
  return meilleure;
}

export function testDominanceLignesLibre() {
  titre('Dominance · lignes d’artéfact 218–221 — « Libre » : la ligne est sur une autre pièce que la représentative (6bis-b3d-1)');
  const cas = casPorteur('« Libre » : Energy, ligne 218 hors de la représentative', 'energy', 0, 0);
  const a = contexteDePaires(cas, INVENTAIRE_LIBRE);
  const representative = paireRepresentative(a);
  egal(representative.map((x) => x.id), [511, 611], `${cas.nom} : précondition — la représentative est A + C, sans la ligne 218`);
  const champ = statsLignesArtefactsEquipables(a);
  egal(champ, ['hp'], `${cas.nom} : le producteur rend la stat de la ligne 218 de B (statsLignesArtefactsEquipables)`);
  const p = parametres({ ...cas, paire: representative }, { statsLignesArtefactsEquipables: champ });

  // L'oracle : chaque build valide, noté sur sa meilleure paire.
  const runeById = new Map(cas.pool.map((r) => [r.id, r]));
  const runesDe = (cle: string) => cle.split(',').map((id) => runeById.get(Number(id))!);
  const valides = oracle(cas, () => 0);
  const notes = new Map([...valides.keys()].map((cle) => [cle, meilleureNoteLibre(cas, a, runesDe(cle))]));
  const meilleur = Math.max(...[...notes.values()].map((n) => n.note));
  const optimaux = [...notes].filter(([, n]) => presque(n.note, meilleur)).map(([c]) => c);
  egal(optimaux, ['1,2,3,4,105,106'], `${cas.nom} : précondition — l’optimum de l’oracle est Violent + Energy (${meilleur.toFixed(4)}, paire ${notes.get('1,2,3,4,105,106')?.paire} ; Violent + Will ${notes.get('1,2,3,4,5,6')?.note.toFixed(4)})`);

  // Le moteur, puis la VRAIE résolution de chaque candidat — l'entrée de
  // l'écran et du CLI (`entreeResolutionDuBuild`) et sa partie pure.
  const resultat = searchBuilds(p);
  const espace = espaceExact(p);
  ok(!resultat.truncated && resultat.explored === espace, `${cas.nom} : recherche complète (explorées ${resultat.explored} / totalPairCount ${espace})`);
  const { artefacts: _a, ...degats } = contexteDegats(cas, []);
  const resolus = resultat.candidates.map((c) => {
    const r = resoudreEquipementDuBuild(entreeResolutionDuBuild({
      fiche: FICHE, runes: c.runeIds.map((id) => runeById.get(id)!), artifactParams: a, regime: 'degats_reels', degats,
      exclusive: { setup: setupDe(cas), element: null }, requirement: p.requirement, relicContext: undefined,
    }));
    return { cle: cleDe(c), score: r.paire?.score ?? Number.NEGATIVE_INFINITY, paire: r.artefacts.map((x) => x.id), conforme: r.conforme };
  });
  const ecartsNote = resolus.filter((r) => !presque(r.score, notes.get(r.cle)?.note ?? Number.NaN));
  egal(ecartsNote.map((r) => `${r.cle} : ${r.score} ≠ ${notes.get(r.cle)?.note}`), [],
    `${cas.nom} : la note de la résolution est celle de l’oracle pour chaque candidat (${resolus.length}) — note de production de l’équipement complet`);
  const meilleurResolu = resolus.reduce((m, r) => (r.score > m.score ? r : m), { cle: '—', score: Number.NEGATIVE_INFINITY, paire: [] as number[], conforme: false });
  ok(presque(meilleurResolu.score, meilleur) && meilleurResolu.conforme,
    `${cas.nom} : optimum conservé après la vraie résolution (${meilleurResolu.cle} noté ${meilleurResolu.score.toFixed(4)}, paire ${meilleurResolu.paire} ; oracle ${meilleur.toFixed(4)})`);
  egal(meilleurResolu.paire, [512, 611], `${cas.nom} : la résolution retient B, la pièce qui porte la ligne`);
  const survivantes = apresDominance(p);
  ok(survivantes.includes(105) && survivantes.includes(106), `${cas.nom} : les runes Energy passent la dominance (${survivantes.join(',')})`);
}

/* --------------------------------------------------------------------------
 * Producteurs : l'union, le moteur, l'écran et le CLI
 * ----------------------------------------------------------------------- */

const LUSHEN = 13413;
const BASE_LUSHEN: BaseStats = { hp: 10000, atk: 1000, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
function artLushen(id: number, kind: 'element' | 'archetype', main: [number, number], subs: [number, number][], sorte?: 'fire' | 'defense'): ArtifactDetail {
  return {
    id, kind, ...(kind === 'element' ? { element: sorte === 'fire' ? 'fire' as const : 'wind' as const } : { archetype: sorte === 'defense' ? 'defense' as const : 'attack' as const }),
    level: 15, rarity: 5, main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })),
  };
}

function recette(r: Partial<OptimizerRecipe>): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: LUSHEN, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' }, relicMainChoice: 'equipped',
    ...r,
  });
}

export function testDominanceLignesProducteurs() {
  titre('Dominance · lignes d’artéfact 218–221 — producteurs : union, cas mixte, écran et CLI (6bis-b3d-1)');

  // Le moteur : la paire TOUJOURS, unie au champ ; « Dégâts réels » seulement.
  const paire219 = [art(1, 'element', [101, 100], [[219, 4]])];
  egal([...statsLuesParLesLignes('degats_reels', paire219, undefined)], ['atk'], 'moteur : champ absent → les lignes de la paire seules (paire figée)');
  egal([...statsLuesParLesLignes('degats_reels', paire219, ['hp', 'spd'])].sort(), ['atk', 'hp', 'spd'], 'moteur : champ présent → union avec les lignes de la paire');
  egal([...statsLuesParLesLignes('degats_reels', [], ['def'])], ['def'], 'moteur : aucune paire → le champ');
  for (const o of ['ehp', 'efficience', 'vitesse', undefined] as const) {
    egal([...statsLuesParLesLignes(o, paire219, ['hp'])], [], `moteur : objectif ${o ?? 'absent'} → aucune stat (seul « Dégâts réels » lit ces lignes)`);
  }
  egal(statsDesLignesBrutes(artifactDamageProfile([art(2, 'element', [101, 1], [[218, 1], [219, 1], [220, 1], [221, 1], [224, 5], [204, 20]])])),
    ['hp', 'atk', 'def', 'spd'], 'damage.ts : 218→PV, 219→ATQ, 220→DEF, 221→VIT, et rien d’autre (224, 204)');

  // Le CLI, sur une recette de Lushen (vent / attaque) : pièces portées W1
  // (219) et W2 ; inventaire X (218), Y (221), X102 (principale DEF), et
  // deux pièces INÉLIGIBLES (feu, défense) qui portent 220.
  const W1 = artLushen(801, 'element', [101, 100], [[219, 4]]);
  const W2 = artLushen(802, 'archetype', [101, 100], []);
  const X = artLushen(803, 'element', [101, 100], [[218, 1.5]]);
  const Y = artLushen(804, 'archetype', [101, 100], [[221, 2]]);
  const Z1 = artLushen(805, 'element', [101, 100], [[220, 4]], 'fire');
  const Z2 = artLushen(806, 'archetype', [101, 100], [[220, 4]], 'defense');
  const X102 = artLushen(807, 'element', [102, 100], []);
  const runes: RuneDetail[] = [1, 2, 3, 4, 5, 6].map((s) => ({ id: 100 + s, slot: s, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: s % 2 ? 3 : 4, value: s % 2 ? 100 : 20 }, subs: [] }));
  const loaded: LoadedMonster = {
    unitId: 1, com2usId: LUSHEN, monsterName: 'Lushen (test)',
    gear: { base: BASE_LUSHEN, runes, artifacts: [W1, W2], relic: undefined },
    allRunes: runes, allArtifacts: [W1, W2, X, Y, Z1, Z2, X102], allRelics: [],
  };
  const cas: [string, Partial<OptimizerRecipe>, StatKey[]][] = [
    ['« Libre » des deux côtés', {}, ['hp', 'atk', 'spd']],
    ['principale imposée ATQ (101) côté attribut, « Libre » de l’autre', { artifactMainByKind: { element: 101, archetype: 'libre' } }, ['hp', 'atk', 'spd']],
    ['principale imposée DEF (102) côté attribut : X et W1 écartés', { artifactMainByKind: { element: 102, archetype: 'libre' } }, ['spd']],
    ['cas mixte : attribut figé (W1), type « Libre »', { artifactMainByKind: { element: 'equipped', archetype: 'libre' } }, ['atk', 'spd']],
    ['cas mixte : attribut « Libre », type figé (W2)', { artifactMainByKind: { element: 'libre', archetype: 'equipped' } }, ['hp', 'atk']],
    ['deux emplacements figés', { artifactMainByKind: { element: 'equipped', archetype: 'equipped' } }, ['atk']],
  ];
  for (const [nom, r, attendu] of cas) {
    const recipe = recette(r);
    const params = recipeToSearchParams(recipe, loaded);
    egal(params.statsLignesArtefactsEquipables, attendu, `CLI, ${nom} : SearchParams.statsLignesArtefactsEquipables`);
    egal(params.statsLignesArtefactsEquipables, statsLignesArtefactsEquipables(artefactsDuCli(recipe, loaded)!.params),
      `CLI, ${nom} : … = le producteur sur le contexte de paires du CLI (artefactsDuCli)`);
  }
  // `ignoreArtifacts` : paire FIGÉE sur les pièces portées, déjà dans
  // `artifacts` ; le moteur n'a besoin d'aucun champ.
  const sans = recipeToSearchParams(recette({ ignoreArtifacts: true }), loaded);
  egal([sans.statsLignesArtefactsEquipables, sans.artifacts.map((x) => x.id)], [undefined, [801, 802]], 'CLI, ignoreArtifacts : champ absent, paire portée');
  egal([...statsLuesParLesLignes(sans.objective, sans.artifacts, sans.statsLignesArtefactsEquipables)], ['atk'], 'CLI, ignoreArtifacts : le moteur protège les lignes de la paire portée');
  // L'écran sans optimisation : le producteur de b6 impose « Garder
  // l'artéfact équipé » des deux côtés — l'union se réduit aux pièces portées.
  const evaluer = artefactsDuCli(recette({}), loaded)!.params.evaluer;
  const ecran = (optimiserArtefacts: boolean, reserves: ReadonlySet<number>) => statsLignesArtefactsEquipables({
    ...parametresArtefactsFiche({
      porteur: { element: 'wind', archetype: 'attack' }, inventaire: loaded.allArtifacts, reserves, equipes: loaded.gear.artifacts,
      optimiserArtefacts, principaleParSorte: { element: 'libre', archetype: 'libre' }, lignesVerrouillees: [], damageSetup: DEFAULT_DAMAGE_SETUP, maxStats: {},
    }),
    evaluer,
  });
  egal(ecran(false, AUCUN_ARTEFACT_RESERVE), ['atk'], 'écran, optimisation désactivée : les lignes des pièces portées seules');
  // Écart documenté : l'écran retire les artéfacts réservés par la liste
  // active, le CLI n'a pas de liste — son union est plus large, jamais plus
  // étroite.
  egal(ecran(true, new Set([803])), ['atk', 'spd'], 'écran, X réservé par un autre build de la liste : la ligne 218 sort de l’union');
  egal(resolveStatsLignesArtefacts(recette({}), loaded), ['hp', 'atk', 'spd'], 'CLI, même recette : X compte (aucune liste) — union plus large, documentée');

  // Contrôles de source : l'écran et le CLI remplissent le champ par le
  // producteur, l'un dans `handleSearch`, l'autre dans `recipeToSearchParams`.
  const source = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/function handleSearch\(\) \{[\s\S]*?run\(\{[\s\S]*?statsLignesArtefactsEquipables: artifactParams \? statsLignesArtefactsEquipables\(artifactParams\) : undefined,[\s\S]*?\}\);\s*\}/.test(source),
    'écran : handleSearch passe statsLignesArtefactsEquipables(artifactParams) au moteur');
  egal((source.match(/statsLignesArtefactsEquipables\(/g) ?? []).length, 1, 'écran : un seul appel au producteur — dans handleSearch');
  const cli = readFileSync('scripts/lib/recipeToSearchParams.ts', 'utf8');
  ok(/export function recipeToSearchParams\([\s\S]*?statsLignesArtefactsEquipables: resolveStatsLignesArtefacts\(recipe, loaded\),/.test(cli),
    'CLI : recipeToSearchParams passe resolveStatsLignesArtefacts au moteur');
  ok(/export function resolveStatsLignesArtefacts\([\s\S]{0,300}?const a = artefactsDuCli\(recipe, loaded\);\s*return a \? statsLignesArtefactsEquipables\(a\.params\) : undefined;/.test(cli),
    'CLI : resolveStatsLignesArtefacts appelle le producteur sur artefactsDuCli');
}

/* --------------------------------------------------------------------------
 * Workers : le champ voyage avec SearchParams
 * ----------------------------------------------------------------------- */

export function testDominanceLignesWorkers() {
  titre('Dominance · lignes d’artéfact 218–221 — Workers et tranches reçoivent le champ (6bis-b3d-1)');
  const cas = casPorteur('« Libre » : Energy, ligne 218 hors de la représentative', 'energy', 0, 0);
  const a = contexteDePaires(cas, INVENTAIRE_LIBRE);
  const p = parametres({ ...cas, paire: paireRepresentative(a) }, { statsLignesArtefactsEquipables: statsLignesArtefactsEquipables(a) });
  const attendu = apresDominance(p);
  egal(attendu, [1, 2, 3, 4, 5, 6, 105, 106], 'référence : Energy passe la dominance');
  // Worker séquentiel : `prepareOrRefuse` sur le message CLONÉ.
  const message = structuredClone(p);
  egal(message.statsLignesArtefactsEquipables, ['hp'], 'le message cloné transporte le champ');
  const issue = prepareOrRefuse(message);
  const filtres = issue.kind === 'prepared' ? issue.prepared.filtered.flat().map((r) => r.id).sort((x, y) => x - y) : [];
  egal(filtres, attendu, 'Worker séquentiel (prepareOrRefuse sur le clone) : même pool que la dominance de référence');
  // Tranche parallèle : `{ ...params, maxCollected }`, clonée, relance
  // `prepareSearch` sur SES paramètres.
  egal(apresDominance(structuredClone({ ...p, maxCollected: 7 })), attendu, 'tranche parallèle : même étage de dominance');
}
