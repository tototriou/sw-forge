// La dominance des runes face à l'effet unique de la relique (degats-et-aura,
// lot 6bis-b3c). Discipline `algo-verify` : un ORACLE exhaustif, sur le pool
// AVANT préparation, contre le vrai moteur (`searchBuilds`, bout en bout).
//
// ⚠️ **La note de l'oracle est celle de la PRODUCTION** pour l'équipement
// complet (cadrage A.6 bis, leçon de 6bis-b3b) : `objectiveScore` avec les
// auras propres du build (`aurasPropresDesRunes`) et l'effet unique de sa
// relique (`apportExclusive`). Un oracle noté sans l'effet unique reste
// d'accord avec le moteur précisément là où les deux ont tort.
//
// ⚠️ Indépendance : l'oracle n'appelle ni `prepareSearch` ni aucune coupe. Il
// énumère le produit des six emplacements, juge le combo demandé
// (`activeSets`) et, en relique fixe, les conditions lui-même. En mode
// `recherche`, un build est noté par la meilleure relique éligible dont le
// couple passe `respecteConditionsAvecRelique` — le filtre final de la
// production —, et n'est pas valide sans elle (`conforme: false`).
//
// Côté moteur, le mode `recherche` est jugé APRÈS la vraie résolution
// (`resoudreEquipementDuBuild`, par `resoudreCandidat`), jamais sur les
// candidats bruts, collectés sur des bornes relâchées.

import { egal, ok, titre } from './outils';
import { DOMINANCE, HEURISTIQUES, premiereCoupe, setsSatisfaits } from './rune-optim-auras-coupes.test';
import { RELIC_UNIQUE, activeSets, runeEfficiency, setPieces } from '../src/lib/effects';
import type { StatKey } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import {
  DEFAULT_DAMAGE_SETUP,
  artifactDamageProfile,
  aurasPropresDesRunes,
  damageRelevantStats,
  estPrisEnCharge,
  skillDamageProfile,
  statsDebutCombat,
} from '../src/lib/damage';
import type { DamageSetup, SkillDamageProfile } from '../src/lib/damage';
import { Competence } from '../src/lib/monsterSkills';
import { apportExclusive } from '../src/lib/relicExclusive';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import {
  avecAurasConditions,
  buildBuckets,
  objectiveScore,
  prepareSearch,
  respecteConditionsAvecRelique,
  searchBuilds,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import type { BuildCandidate, BuildRequirement, Objective, RealDamageContext, SearchParams, SearchResult } from '../src/lib/runeBuildOptim';
import { prepareOrRefuse } from '../src/workers/prepareForSearch';
import { drain } from '../scripts/lib/drain';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { resoudreCandidat } from '../scripts/lib/relicDifferentiel';
import type { ArtifactArchetype, BaseStats, ElementKey, RelicDetail, RuneDetail } from '../src/types';

const SETUP: DamageSetup = { ...DEFAULT_DAMAGE_SETUP };
const BASE: BaseStats = { hp: 10000, atk: 660, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
// Les principales du cas minimal (sonde du pilote) : ATQ, PV %, DEF, PV %,
// PV, PV % — identiques pour tous les sets, aucune sous-propriété.
const PRINCIPALES: Record<number, [number, number]> = { 1: [3, 160], 2: [2, 63], 3: [5, 160], 4: [2, 63], 5: [1, 2448], 6: [2, 63] };
const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };

function rune(id: number, slot: number, set: string): RuneDetail {
  const [code, value] = PRINCIPALES[slot];
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code, value }, subs: [] };
}

function relique(id: number, type: number, tranche: number, percent = 1, code: 100 | 101 | 102 = 100, value = 9): RelicDetail {
  return { id, upgrade: 6, main: { code, value }, unique: { type, tranche, percent } };
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

const SORTS = { atk: sortSynthetique('3.0*{ATK}'), def: sortSynthetique('3.0*{DEF}'), hp: sortSynthetique('0.3*{MAX HP}') };
type SortCle = keyof typeof SORTS;

interface Cas {
  nom: string;
  pool: RuneDetail[];
  sets: string[];
  objective: Objective;
  sort?: SortCle;
  // Relique FIXE (`SearchParams.relic` : `off`, `equipped`, contexte absent).
  relique?: RelicDetail;
  // Mode `recherche` : le pool éligible (aucune relique portée).
  eligibles?: RelicDetail[];
  minStats?: Partial<Record<StatKey, number>>;
  maxStats?: Partial<Record<StatKey, number>>;
  compter?: boolean;
}

function contexteDegats(cas: Cas): RealDamageContext | undefined {
  if (!cas.sort) return undefined;
  return {
    profile: SORTS[cas.sort], passifs: [], setup: SETUP, element: null, artefacts: artifactDamageProfile([]),
    critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {},
    bonusDegatsConditionnel: null, bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null,
  };
}

function parametres(cas: Cas, extra: Partial<SearchParams> = {}): SearchParams {
  const requirement = avecAurasConditions({ sets: cas.sets, minStats: cas.minStats ?? {}, maxStats: cas.maxStats }, SETUP, cas.compter ?? true);
  const relicContext = cas.eligibles
    ? resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, cas.eligibles)
    : undefined;
  // Les stats privilégiées de « Dégâts réels » : celles du sort, comme l'écran.
  const objectiveStats = cas.sort ? damageRelevantStats(SORTS[cas.sort], [], SETUP) : undefined;
  // Heuristiques NON contraignantes : pré-filtrage et rétention plus larges
  // que le pool, collecte et temps illimités en pratique.
  return {
    base: BASE, artifacts: [], relic: cas.relique, relicContext, pool: cas.pool, requirement, metric: 'eff',
    objective: cas.objective, objectiveStats, maxMs: 120000, maxCollected: 1_000_000, slotFilterCap: 200, bucketCap: 100000, ...extra,
  };
}

/* --------------------------------------------------------------------------
 * La note de production, et l'oracle
 * ----------------------------------------------------------------------- */

// La note d'UN équipement : six runes, aucun artéfact, cette relique.
function note(cas: Cas, runes: RuneDetail[], rel: RelicDetail | undefined): number {
  const stats = computeStats({ base: BASE, runes, artifacts: [], relic: rel });
  const propres = aurasPropresDesRunes(runes);
  const candidat: BuildCandidate = { runeIds: runes.map((r) => r.id), stats, effTotal: runes.reduce((s, r) => s + runeEfficiency(r), 0) };
  return objectiveScore(candidat, cas.objective, propres, contexteDegats(cas), apportExclusive(rel, stats, SETUP, propres, null), SETUP);
}

// Conditions jugées par l'oracle lui-même (relique fixe) : fiche
// `computeStats`, plus 8 points RES/PRE par activation propre, toggle actif.
function respecteOracle(cas: Cas, runes: RuneDetail[], rel: RelicDetail | undefined): boolean {
  const stats = computeStats({ base: BASE, runes, artifacts: [], relic: rel });
  const actifs = activeSets(runes.map((r) => r.set));
  const cond = (k: StatKey) => {
    const t = stats.find((s) => s.key === k)?.total ?? 0;
    if ((cas.compter ?? true) && k === 'res') return t + 8 * actifs.filter((s) => s === 'tolerance').length;
    if ((cas.compter ?? true) && k === 'acc') return t + 8 * actifs.filter((s) => s === 'accuracy').length;
    return t;
  };
  for (const [k, v] of Object.entries(cas.minStats ?? {})) if (v != null && v > 0 && cond(k as StatKey) < v) return false;
  for (const [k, v] of Object.entries(cas.maxStats ?? {})) if (v != null && v > 0 && cond(k as StatKey) > v) return false;
  return true;
}

interface BuildOracle {
  cle: string;
  note: number;
  relique: RelicDetail | undefined;
}

interface Oracle {
  valides: Map<string, BuildOracle>;
  combinaisons: number;
  // Mode `recherche` : couples (build, relique) où le filtre de production
  // et le jugement propre de l'oracle divergent — attendu 0.
  desaccordsFiltre: number;
}

function oracle(cas: Cas, requirement: BuildRequirement): Oracle {
  const parSlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const x of cas.pool) parSlot[x.slot - 1].push(x);
  const valides = new Map<string, BuildOracle>();
  let combinaisons = 0;
  let desaccordsFiltre = 0;
  const choix: RuneDetail[] = [];
  const evaluer = () => {
    combinaisons++;
    if (choix.filter((x) => x.set === 'intangible').length > 1) return;
    if (!setsSatisfaits(cas.sets, activeSets(choix.map((x) => x.set)))) return;
    const runes = [...choix];
    const cle = runes.map((x) => x.id).join(',');
    if (cas.eligibles) {
      let meilleur: BuildOracle | null = null;
      for (const rel of cas.eligibles) {
        const { respecte } = respecteConditionsAvecRelique({ base: BASE, runes, artifacts: [] }, rel, requirement);
        if (respecte !== respecteOracle(cas, runes, rel)) desaccordsFiltre++;
        if (!respecte) continue;
        const n = note(cas, runes, rel);
        if (!meilleur || n > meilleur.note) meilleur = { cle, note: n, relique: rel };
      }
      if (meilleur) valides.set(cle, meilleur);
      return;
    }
    if (respecteOracle(cas, runes, cas.relique)) valides.set(cle, { cle, note: note(cas, runes, cas.relique), relique: cas.relique });
  };
  const recurse = (i: number) => {
    if (i === 6) return evaluer();
    for (const x of parSlot[i]) {
      choix.push(x);
      recurse(i + 1);
      choix.pop();
    }
  };
  recurse(0);
  return { valides, combinaisons, desaccordsFiltre };
}

/* --------------------------------------------------------------------------
 * Le moteur, sa résolution, et la comparaison
 * ----------------------------------------------------------------------- */

interface Verdict {
  p: SearchParams;
  o: Oracle;
  resultat: SearchResult;
  espace: number;
  // Candidats bruts du moteur (clé des six ids).
  bruts: Set<string>;
  // Candidats retenus après le filtre final (mode `recherche` : conformes à
  // la résolution), avec leur note de production et leur relique.
  retenus: Map<string, BuildOracle>;
  motifs: Map<string, number>;
  fauxRejets: string[];
}

const cleDe = (c: { runeIds: number[] }) => c.runeIds.join(',');

function runesDuCandidat(p: SearchParams, c: { runeIds: number[] }): RuneDetail[] {
  const byId = new Map(p.pool.map((r) => [r.id, r]));
  return c.runeIds.map((id) => byId.get(id)!);
}

// L'espace EXACT de l'appariement : `explored` d'une recherche complète
// l'atteint (algo-verify, autodiagnostic de complétude).
function espaceExact(p: SearchParams): number {
  const prepared = prepareSearch(p);
  if (!prepared) return 0;
  const a = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, p.adaptiveTrancheWeighting, p.combosOrderMode));
  const b = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, p.adaptiveTrancheWeighting, p.combosOrderMode));
  return totalPairCount(prepared, a, b);
}

function lancer(cas: Cas, extra: Partial<SearchParams> = {}, traceMax = 40): Verdict {
  const p = parametres(cas, extra);
  const o = oracle(cas, p.requirement);
  const resultat = searchBuilds(p);
  const bruts = new Set(resultat.candidates.map(cleDe));
  const retenus = new Map<string, BuildOracle>();
  for (const c of resultat.candidates) {
    let rel = cas.relique;
    if (p.relicContext?.mode === 'recherche') {
      const degats = contexteDegats(cas);
      const r = resoudreCandidat(p, c, p.relicContext, {
        critere: cas.objective,
        degats: degats ? (({ artefacts: _a, ...reste }) => reste)(degats) : null,
        porteur: PORTEUR,
        exclusive: { setup: SETUP, element: null },
      });
      if (!r.conforme) continue;
      rel = r.relique;
    }
    retenus.set(cleDe(c), { cle: cleDe(c), note: note(cas, runesDuCandidat(p, c), rel), relique: rel });
  }
  const motifs = new Map<string, number>();
  const fauxRejets: string[] = [];
  let traces = 0;
  for (const cle of o.valides.keys()) {
    if (bruts.has(cle) || traces >= traceMax) continue;
    traces++;
    const tr = searchBuilds({ ...p, traceur: { runeIds: cle.split(',').map(Number) } });
    const coupe = premiereCoupe(tr.traceur, tr.truncated);
    motifs.set(coupe, (motifs.get(coupe) ?? 0) + 1);
    if (!HEURISTIQUES.has(coupe) && coupe !== DOMINANCE) fauxRejets.push(`${cle} → ${coupe}`);
  }
  return { p, o, resultat, espace: espaceExact(p), bruts, retenus, motifs, fauxRejets };
}

const fmtMotifs = (m: Map<string, number>) => (m.size === 0 ? 'aucun absent' : Array.from(m, ([k, n]) => `${k}×${n}`).join(', '));
const presque = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// Les invariants d'un run COMPLET face à l'oracle — même structure que
// `verifier()` de 6bis-b3b, avec la note de production comme critère. La
// dominance a le droit de retirer un build valide, jamais l'optimum.
function verifier(cas: Cas, v: Verdict): boolean {
  const { resultat, o, retenus } = v;
  let tout = true;
  const t = (cond: boolean, libelle: string) => { ok(cond, libelle); tout &&= cond; };
  t(!resultat.truncated && resultat.explored === v.espace,
    `${cas.nom} : recherche complète (tronquée ${resultat.truncated}, explorées ${resultat.explored} / totalPairCount ${v.espace} ; oracle ${o.combinaisons} combinaisons, ${o.valides.size} valide(s))`);
  if (cas.eligibles) t(o.desaccordsFiltre === 0, `${cas.nom} : filtre de production et jugement de l'oracle d'accord sur chaque couple (${o.desaccordsFiltre} désaccord)`);
  const fauxPositifs = [...retenus.keys()].filter((c) => !o.valides.has(c));
  t(fauxPositifs.length === 0, `${cas.nom} : aucun faux positif${cas.eligibles ? ' après le filtre final de la résolution' : ''} (${fauxPositifs.join(' ; ') || '—'})`);
  const rejetesAuFiltre = [...v.bruts].filter((c) => o.valides.has(c) && !retenus.has(c));
  t(rejetesAuFiltre.length === 0, `${cas.nom} : aucun build valide rejeté par le filtre final (${rejetesAuFiltre.join(' ; ') || '—'})`);
  t((retenus.size > 0) === (o.valides.size > 0), `${cas.nom} : même verdict de faisabilité (moteur ${retenus.size}, oracle ${o.valides.size})`);
  t(v.fauxRejets.length === 0, `${cas.nom} : zéro faux rejet par une coupe sûre autre que la dominance (absents : ${fmtMotifs(v.motifs)})`);
  if (o.valides.size > 0 && retenus.size > 0) {
    const meilleurOracle = Math.max(...[...o.valides.values()].map((b) => b.note));
    const meilleurMoteur = Math.max(...[...retenus.values()].map((b) => b.note));
    const optimaux = new Set([...o.valides.values()].filter((b) => presque(b.note, meilleurOracle)).map((b) => b.cle));
    const rang = resultat.candidates.findIndex((c) => optimaux.has(cleDe(c)) && retenus.has(cleDe(c)));
    t(presque(meilleurMoteur, meilleurOracle) && rang >= 0,
      `${cas.nom} : optimum de la note de production conservé (moteur ${meilleurMoteur.toFixed(4)}, oracle ${meilleurOracle.toFixed(4)} ; build optimal au rang de collecte ${rang}, ${optimaux.size} build(s) optimal(aux))`);
  }
  return tout;
}

// Les runes présentes après l'étage de DOMINANCE (observateur `onStage`).
function apresDominance(p: SearchParams): number[] {
  let ids: number[] = [];
  prepareSearch(p, (etage, listes) => { if (etage === 'dominance') ids = listes.flat().map((r) => r.id).sort((a, b) => a - b); });
  return ids;
}

// La stat de RÉFÉRENCE d'un type, en clé de fiche — table de FIXTURE, pour
// placer la tranche ; la production la lit dans `relicExclusive.ts`.
const CLE_REF: Record<string, StatKey> = { PV: 'hp', ATQ: 'atk', DEF: 'def', VIT: 'spd' };

function assiette(type: number, runes: RuneDetail[], rel: RelicDetail | undefined): number {
  const stats = computeStats({ base: BASE, runes, artifacts: [], relic: rel });
  return statsDebutCombat(stats, SETUP, aurasPropresDesRunes(runes), null)[CLE_REF[RELIC_UNIQUE[type].stat.court] as 'hp' | 'atk' | 'def' | 'spd'];
}

/* --------------------------------------------------------------------------
 * Le cas minimal — relique fixe Ténacité·ATQ en « PV effectifs »
 * ----------------------------------------------------------------------- */

const CAS_MINIMAL: Cas = {
  nom: 'Cas minimal Ténacité·ATQ (PV effectifs, relique fixe)',
  pool: [rune(1, 1, 'violent'), rune(2, 2, 'violent'), rune(3, 3, 'violent'), rune(4, 4, 'violent'), rune(5, 5, 'will'), rune(6, 6, 'will'), rune(105, 5, 'fight'), rune(106, 6, 'fight')],
  sets: ['violent'],
  objective: 'ehp',
  relique: relique(900, 4, 1000, 1, 100, 9),
};

export function testDominanceReliqueCasMinimal() {
  titre('Dominance · effet unique de la relique — cas minimal (6bis-b3c)');
  // Exactement la sonde du pilote : `slotFilterCap` 80, `maxMs` infini.
  const extra = { slotFilterCap: 80, maxMs: Infinity, bucketCap: undefined, maxCollected: undefined };
  const p = parametres(CAS_MINIMAL, extra);
  const byId = new Map(CAS_MINIMAL.pool.map((r) => [r.id, r]));
  const build = (ids: number[]) => ids.map((i) => byId.get(i)!);
  const fight = note(CAS_MINIMAL, build([1, 2, 3, 4, 105, 106]), CAS_MINIMAL.relique);
  const will = note(CAS_MINIMAL, build([1, 2, 3, 4, 5, 6]), CAS_MINIMAL.relique);
  egal([fight.toFixed(2), will.toFixed(2)], ['125627.78', '124371.51'], 'notes de production : Violent + Fight 125 627,78, Violent + Will 124 371,51');
  egal(assiette(4, build([1, 2, 3, 4, 105, 106]), CAS_MINIMAL.relique), 1005, 'ATQ de début de combat du build Fight : 1 005 (une tranche de 1 000)');
  const dom = apresDominance(p);
  ok(dom.includes(105) && dom.includes(106), `les runes Fight 105 et 106 passent la dominance (survivantes : ${dom.join(',')})`);
  const res = searchBuilds(p);
  const rang = res.candidates.findIndex((c) => cleDe(c) === '1,2,3,4,105,106');
  ok(!res.truncated && rang >= 0, `Violent + Fight collecté (rang de collecte ${rang}, tronquée ${res.truncated}, ${res.candidates.length} candidat(s))`);
  verifier(CAS_MINIMAL, lancer(CAS_MINIMAL, extra));
}

/* --------------------------------------------------------------------------
 * Couverture des 15 types chiffrables — aucun cas vide
 * ----------------------------------------------------------------------- */

interface Couverture {
  type: number;
  porteur: string;
  objective: Objective;
  sort?: SortCle;
  // Ténacité 5 et 6 : leur stat de référence est déjà dans l'objectif du
  // seul régime qui les lit (« PV effectifs ») — protégée AVANT la correction.
  dejaProtege?: boolean;
}

// Repères du contrat, un cas par set porteur formable : auras Fight,
// Determination, Enhance ; bonus de fiche Fatal, Guard, Energy, Swift.
export const COUVERTURE: Couverture[] = [
  { type: 1, porteur: 'fight', objective: 'degats_reels', sort: 'def' },
  { type: 1, porteur: 'fatal', objective: 'degats_reels', sort: 'def' },
  { type: 2, porteur: 'determination', objective: 'degats_reels', sort: 'atk' },
  { type: 2, porteur: 'guard', objective: 'degats_reels', sort: 'atk' },
  { type: 3, porteur: 'enhance', objective: 'degats_reels', sort: 'atk' },
  { type: 3, porteur: 'energy', objective: 'degats_reels', sort: 'atk' },
  { type: 4, porteur: 'fight', objective: 'ehp' },
  { type: 4, porteur: 'fatal', objective: 'ehp' },
  { type: 5, porteur: 'determination', objective: 'ehp', dejaProtege: true },
  { type: 5, porteur: 'guard', objective: 'ehp', dejaProtege: true },
  { type: 6, porteur: 'enhance', objective: 'ehp', dejaProtege: true },
  { type: 6, porteur: 'energy', objective: 'ehp', dejaProtege: true },
  { type: 7, porteur: 'swift', objective: 'degats_reels', sort: 'atk' },
  { type: 8, porteur: 'determination', objective: 'degats_reels', sort: 'atk' },
  { type: 8, porteur: 'guard', objective: 'degats_reels', sort: 'atk' },
  { type: 9, porteur: 'enhance', objective: 'degats_reels', sort: 'atk' },
  { type: 9, porteur: 'energy', objective: 'degats_reels', sort: 'atk' },
  { type: 10, porteur: 'fight', objective: 'ehp' },
  { type: 10, porteur: 'fatal', objective: 'ehp' },
  { type: 11, porteur: 'swift', objective: 'ehp' },
  { type: 12, porteur: 'enhance', objective: 'degats_reels', sort: 'def' },
  { type: 12, porteur: 'energy', objective: 'degats_reels', sort: 'def' },
  { type: 13, porteur: 'fight', objective: 'ehp' },
  { type: 13, porteur: 'fatal', objective: 'ehp' },
  { type: 14, porteur: 'swift', objective: 'ehp' },
  { type: 15, porteur: 'determination', objective: 'degats_reels', sort: 'hp' },
  { type: 15, porteur: 'guard', objective: 'degats_reels', sort: 'hp' },
];

// Le cas d'une configuration : un set porteur et un set NEUTRE (sans effet)
// aux runes de stats identiques, le porteur aux identifiants PLUS GRANDS —
// sans protection, le départage par identifiant le fait tomber. La tranche
// est placée sur l'assiette du build porteur : lui seul la franchit.
//  - porteur à 2 pièces : Violent demandé (1-4), Will ou le porteur en 5-6 ;
//  - porteur à 4 pièces (Fatal, Swift) : Will demandé (1-2), Violent ou le
//    porteur en 3-6 — quatre emplacements libres, quatre runes du porteur.
function casDeCouverture(c: Couverture): { cas: Cas; porteurIds: number[]; neutreIds: number[] } {
  const quatre = setPieces(c.porteur) === 4;
  const fixes = quatre ? [rune(1, 1, 'will'), rune(2, 2, 'will')] : [1, 2, 3, 4].map((s) => rune(s, s, 'violent'));
  const libres = quatre ? [3, 4, 5, 6] : [5, 6];
  const neutre = quatre ? 'violent' : 'will';
  const neutres = libres.map((s) => rune(s, s, neutre));
  const porteurs = libres.map((s) => rune(100 + s, s, c.porteur));
  const construire = (tranche: number): Cas => ({
    nom: `Type ${c.type} (${RELIC_UNIQUE[c.type].groupe}·${RELIC_UNIQUE[c.type].stat.court}) porté par ${c.porteur}, ${c.objective}${c.sort ? ` sort ${c.sort}` : ''}`,
    pool: [...fixes, ...neutres, ...porteurs],
    sets: quatre ? ['will'] : ['violent'],
    objective: c.objective,
    sort: c.sort,
    relique: relique(900, c.type, tranche),
  });
  const tranche = assiette(c.type, [...fixes, ...porteurs], construire(1).relique);
  return { cas: construire(tranche), porteurIds: porteurs.map((r) => r.id), neutreIds: neutres.map((r) => r.id) };
}

// Rend le nombre de cas qui échouent — la mutation (protection retirée) doit
// les faire TOUS échouer, sauf les deux types déjà protégés.
export function couvertureDesTypes(): { echecs: string[]; tableau: string[] } {
  const echecs: string[] = [];
  const tableau: string[] = [];
  for (const c of COUVERTURE) {
    const { cas, porteurIds, neutreIds } = casDeCouverture(c);
    const byId = new Map(cas.pool.map((r) => [r.id, r]));
    const fixes = cas.pool.filter((r) => r.id <= 4 && !neutreIds.includes(r.id));
    const buildP = [...fixes, ...porteurIds.map((i) => byId.get(i)!)];
    const buildN = [...fixes, ...neutreIds.map((i) => byId.get(i)!)];
    const sansUnique = cas.relique ? { ...cas.relique, unique: undefined } : undefined;
    const p = parametres(cas);
    // Les quatre conditions du contrat, vérifiées sur le cas lui-même.
    const cles = new Set([...Object.keys(p.requirement.minStats), ...Object.keys(p.requirement.maxStats ?? {})]);
    const objectif = new Set(p.objectiveStats ?? (c.objective === 'ehp' ? ['hp', 'def'] : []));
    const ref = CLE_REF[RELIC_UNIQUE[c.type].stat.court];
    ok(!cles.has(ref), `${cas.nom} : la stat de référence (${ref}) est hors conditions`);
    ok(c.dejaProtege ? objectif.has(ref) : !objectif.has(ref),
      `${cas.nom} : la stat de référence est ${c.dejaProtege ? 'DANS' : 'hors de'} l'objectif (${[...objectif].join(',')})`);
    const gainUnique = note(cas, buildP, cas.relique) - note(cas, buildP, sansUnique);
    ok(gainUnique > 0 && presque(note(cas, buildN, cas.relique), note(cas, buildN, sansUnique)),
      `${cas.nom} : le score lit l'effet unique (build porteur +${gainUnique.toFixed(3)}, build neutre sans tranche)`);
    if (!c.dejaProtege) {
      ok(presque(note(cas, buildP, sansUnique), note(cas, buildN, sansUnique)),
        `${cas.nom} : sans l'effet unique, porteur et neutre font jeu égal — seul l'effet unique départage`);
    }
    ok(activeSets(buildP.map((r) => r.set)).includes(c.porteur), `${cas.nom} : le set porteur est formé (${porteurIds.length} emplacements distincts)`);
    const dom = apresDominance(p);
    const garde = porteurIds.every((i) => dom.includes(i));
    const v = lancer(cas);
    const tient = verifier(cas, v) && garde;
    ok(garde, `${cas.nom} : les runes porteuses passent la dominance`);
    tableau.push(`${String(c.type).padStart(2)} ${c.porteur.padEnd(13)} ${c.objective.padEnd(12)} ${(c.sort ?? '—').padEnd(3)} tranche ${cas.relique!.unique!.tranche} → ${tient ? 'tient' : 'ÉCHOUE'}${c.dejaProtege ? ' (déjà protégé par l\'objectif)' : ''}`);
    if (!tient) echecs.push(cas.nom);
  }
  return { echecs, tableau };
}

export function testDominanceReliqueCouverture() {
  titre('Dominance · effet unique de la relique — couverture des 15 types chiffrables (6bis-b3c)');
  const { echecs, tableau } = couvertureDesTypes();
  const types = new Set(COUVERTURE.map((c) => c.type));
  egal(types.size, 15, 'les 15 types chiffrables ont chacun au moins un cas');
  egal(new Set(COUVERTURE.map((c) => c.porteur)).size, 7, 'les sept sets porteurs sont chacun exercés');
  console.log(tableau.map((l) => `     ${l}`).join('\n'));
  egal(echecs, [], 'aucun cas de couverture ne perd l\'optimum');
}

/* --------------------------------------------------------------------------
 * Mode `recherche` — l'union des reliques éligibles
 * ----------------------------------------------------------------------- */

// Deux reliques éligibles aux stats de référence différentes, « Dégâts
// réels » d'un sort sur la DEF (ni ATQ ni PV dans l'objectif) :
//  - A, Conquête·ATQ, principale PV % 9, +2 % par tranche : Fight la franchit ;
//  - B, Conquête·PV, principale ATQ % 9, +1 % : Energy la franchit.
// Minimum PV 32 000 : sans PV % de relique, seule Energy (+15 % PV de fiche)
// le tient — B est écartée au filtre final pour le build Fight, pas pour le
// build Energy. Optimum : Fight + A (+2 %), devant Energy + B (+1 %).
function casRecherche(): Cas {
  const pool = [1, 2, 3, 4].map((s) => rune(s, s, 'violent'))
    .concat([rune(5, 5, 'will'), rune(6, 6, 'will'), rune(105, 5, 'fight'), rune(106, 6, 'fight'), rune(305, 5, 'energy'), rune(306, 6, 'energy')]);
  const byId = new Map(pool.map((r) => [r.id, r]));
  const b = (ids: number[]) => ids.map((i) => byId.get(i)!);
  const provisoireA = relique(901, 1, 1, 2, 100, 9);
  const provisoireB = relique(902, 3, 1, 1, 101, 9);
  const trancheA = assiette(1, b([1, 2, 3, 4, 105, 106]), provisoireA);
  const trancheB = assiette(3, b([1, 2, 3, 4, 305, 306]), provisoireB);
  return {
    nom: 'Mode recherche : Conquête·ATQ et Conquête·PV éligibles, minimum PV',
    pool,
    sets: ['violent'],
    objective: 'degats_reels',
    sort: 'def',
    eligibles: [relique(901, 1, trancheA, 2, 100, 9), relique(902, 3, trancheB, 1, 101, 9)],
    minStats: { hp: 32000 },
  };
}

export function testDominanceReliqueRecherche() {
  titre('Dominance · effet unique de la relique — mode recherche (6bis-b3c)');
  const cas = casRecherche();
  const [A, B] = cas.eligibles!;
  const p = parametres(cas);
  egal(p.relic, undefined, 'aucune relique portée : seule l\'union des éligibles peut protéger');
  egal(p.relicContext?.eligibles.map((r) => r.id), [901, 902], 'deux reliques éligibles');
  const byId = new Map(cas.pool.map((r) => [r.id, r]));
  const gear = (ids: number[]) => ({ base: BASE, runes: ids.map((i) => byId.get(i)!), artifacts: [] });
  const fight = [1, 2, 3, 4, 105, 106];
  const energy = [1, 2, 3, 4, 305, 306];
  egal([respecteConditionsAvecRelique(gear(fight), A, p.requirement).respecte, respecteConditionsAvecRelique(gear(fight), B, p.requirement).respecte], [true, false],
    'build Fight : B écartée au filtre final (minimum PV), A retenue');
  egal([respecteConditionsAvecRelique(gear(energy), A, p.requirement).respecte, respecteConditionsAvecRelique(gear(energy), B, p.requirement).respecte], [true, true],
    'build Energy : les deux reliques passent le filtre final');
  const dom = apresDominance(p);
  ok([105, 106, 305, 306].every((i) => dom.includes(i)), `Fight et Energy passent la dominance (survivantes : ${dom.join(',')})`);
  const v = lancer(cas);
  verifier(cas, v);
  const optimum = [...v.o.valides.values()].sort((x, y) => y.note - x.note)[0];
  egal([optimum.cle, optimum.relique?.id], [fight.join(','), 901], 'optimum de l\'oracle : Violent + Fight avec A');
  egal(v.retenus.get(fight.join(','))?.relique?.id, 901, 'la résolution de production retient A pour le build Fight');
  // La relique retenue par la résolution est, pour CHAQUE build conforme,
  // la meilleure de l'oracle : sa note de paire est bien la note de production.
  const divergences = [...v.retenus.values()].filter((r) => !presque(r.note, v.o.valides.get(r.cle)?.note ?? NaN));
  egal(divergences.map((d) => d.cle), [], 'résolution et oracle notent chaque build conforme à l\'identique (même relique retenue)');
}

/* --------------------------------------------------------------------------
 * Témoins sans changement
 * ----------------------------------------------------------------------- */

export function testDominanceReliqueTemoins() {
  titre('Dominance · effet unique de la relique — témoins sans changement (6bis-b3c)');
  const sans: Cas = { ...CAS_MINIMAL, nom: 'Témoin sans relique', relique: undefined };
  const reference = apresDominance(parametres(sans));
  egal(reference, [1, 2, 3, 4, 5, 6], 'sans relique : Fight interchangeable avec Will, ses runes tombent à la dominance (comme avant)');
  verifier(sans, lancer(sans));
  const temoins: Cas[] = [
    { ...CAS_MINIMAL, nom: 'Témoin Régénération (type 16)', relique: relique(900, 16, 1000) },
    { ...CAS_MINIMAL, nom: 'Témoin type inconnu (99)', relique: relique(900, 99, 1000) },
  ];
  for (const t of temoins) {
    egal(apresDominance(parametres(t)), reference, `${t.nom} : même étage de dominance que sans relique`);
    verifier(t, lancer(t));
  }
  // « Efficience » : toutes les stats sont déjà utiles, la relique n'ajoute
  // rien — même étage avec et sans elle.
  const eff: Cas = { ...CAS_MINIMAL, nom: 'Témoin Efficience (Ténacité·ATQ fixe)', objective: 'efficience' };
  const effSans: Cas = { ...eff, relique: undefined };
  egal(apresDominance(parametres(eff)), apresDominance(parametres(effSans)), 'Efficience : même étage de dominance avec et sans relique chiffrable');
  verifier(eff, lancer(eff));
}

/* --------------------------------------------------------------------------
 * Workers : `SearchParams` entier, relique et contexte compris
 * ----------------------------------------------------------------------- */

export function testDominanceReliqueWorkers() {
  titre('Dominance · effet unique de la relique — Workers et tranches reçoivent la relique (6bis-b3c)');
  for (const cas of [CAS_MINIMAL, casRecherche()]) {
    const p = parametres(cas);
    const attendu = apresDominance(p);
    // Worker séquentiel : `prepareOrRefuse` sur le message CLONÉ.
    const message = structuredClone(p);
    egal([message.relic?.id, message.relicContext?.eligibles.map((r) => r.id)], [p.relic?.id, p.relicContext?.eligibles.map((r) => r.id)],
      `${cas.nom} : le message cloné transporte relique et éligibles`);
    const issue = prepareOrRefuse(message);
    const filtres = issue.kind === 'prepared' ? issue.prepared.filtered.flat().map((r) => r.id).sort((a, b) => a - b) : [];
    egal(filtres, attendu, `${cas.nom} : Worker séquentiel (prepareOrRefuse sur le clone) — même pool que la dominance de référence`);
    // Tranche parallèle : `{ ...params, maxCollected }` (parallelPairing.ts),
    // clonée, relance `prepareSearch` sur SES paramètres.
    egal(apresDominance(structuredClone({ ...p, maxCollected: 7 })), attendu, `${cas.nom} : tranche parallèle — même étage de dominance`);
  }
}

/* --------------------------------------------------------------------------
 * Différentiel aléatoire (seeds fixes)
 * ----------------------------------------------------------------------- */

const SETS_DIFF = ['violent', 'will', 'shield', 'fight', 'determination', 'enhance', 'fatal', 'guard', 'energy', 'swift', 'intangible'];
const COMBOS: string[][] = [[], ['violent'], ['will'], ['fight', 'will'], ['energy'], ['guard', 'will'], ['swift']];
const TYPES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 99];
const REGIMES: [Objective, SortCle | undefined][] = [['ehp', undefined], ['degats_reels', 'atk'], ['degats_reels', 'def'], ['degats_reels', 'hp']];

function quantile(vals: number[], q: number): number {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

export function testDominanceReliqueDifferentiel() {
  titre('Dominance · effet unique de la relique — différentiel aléatoire (seeds 6400..6479)');
  let scenarios = 0;
  let valides = 0;
  let protectionActive = 0;
  let recherche = 0;
  let echecs = 0;
  const motifs = new Map<string, number>();
  for (let s = 0; s < 80; s++) {
    const seed = 6400 + s;
    const rng = mulberry32(seed);
    const pool = randomPool(rng, 3, SETS_DIFF);
    // Un CLONE par emplacement, mêmes stats, autre set, identifiant plus
    // grand : sans lui, des sous-propriétés tirées au hasard ne se dominent
    // presque jamais d'un set à l'autre et la dominance n'est pas exercée.
    for (let slot = 1; slot <= 6; slot++) {
      const source = pool.filter((r) => r.slot === slot)[Math.floor(rng() * 3)];
      const autres = SETS_DIFF.filter((x) => x !== source.set && x !== 'intangible');
      pool.push({ ...source, id: 1000 + slot, set: autres[Math.floor(rng() * autres.length)] });
    }
    const sets = COMBOS[Math.floor(rng() * COMBOS.length)];
    const [objective, sort] = REGIMES[Math.floor(rng() * REGIMES.length)];
    const enRecherche = rng() < 0.3;
    const nbReliques = enRecherche ? 2 + Math.floor(rng() * 2) : 1;
    // Tranche placée dans la distribution de l'assiette des builds au combo
    // demandé, pour que des tranches se franchissent.
    const brouillon: Cas = { nom: '', pool, sets, objective, sort };
    const parSlot: RuneDetail[][] = [[], [], [], [], [], []];
    for (const x of pool) parSlot[x.slot - 1].push(x);
    const echantillon: RuneDetail[][] = [];
    for (let k = 0; k < 40; k++) echantillon.push(parSlot.map((l) => l[Math.floor(rng() * l.length)]));
    const reliques: RelicDetail[] = [];
    for (let i = 0; i < nbReliques; i++) {
      const type = TYPES[Math.floor(rng() * TYPES.length)];
      const code = ([100, 101, 102] as const)[Math.floor(rng() * 3)];
      const percent = 1 + Math.floor(rng() * 2);
      const ys = RELIC_UNIQUE[type] ? echantillon.map((b) => assiette(type, b, undefined)) : [1000];
      reliques.push(relique(900 + i, type, Math.max(1, quantile(ys, 0.5 + 0.45 * rng())), percent, code, 5 + Math.floor(rng() * 8)));
    }
    const cas: Cas = {
      ...brouillon,
      nom: `seed ${seed} sets=${JSON.stringify(sets)} ${objective}${sort ? `/${sort}` : ''} ${enRecherche ? 'recherche' : 'fixe'} reliques=${reliques.map((r) => `${r.unique!.type}@${r.unique!.tranche}`).join('+')}`,
      ...(enRecherche ? { eligibles: reliques } : { relique: reliques[0] }),
    };
    const o = oracle(cas, parametres(cas).requirement);
    if (o.valides.size === 0) continue;
    // Un minimum tiré sur les builds valides, sur une stat de fiche.
    if (rng() < 0.35) {
      const k = (['hp', 'atk', 'def', 'spd'] as const)[Math.floor(rng() * 4)];
      const vals = [...o.valides.keys()].map((cle) => {
        const byId = new Map(pool.map((r) => [r.id, r]));
        const runes = cle.split(',').map((i) => byId.get(Number(i))!);
        return computeStats({ base: BASE, runes, artifacts: [], relic: cas.relique ?? reliques[0] }).find((x) => x.key === k)?.total ?? 0;
      });
      cas.minStats = { [k]: quantile(vals, 0.3 + 0.4 * rng()) };
      cas.nom += ` min=${JSON.stringify(cas.minStats)}`;
    }
    const p = parametres(cas);
    const sansRelique = apresDominance({ ...p, relic: undefined, relicContext: undefined });
    if (sansRelique.join(',') !== apresDominance(p).join(',')) protectionActive++;
    const v = lancer(cas, {}, 25);
    if (!verifier(cas, v)) echecs++;
    scenarios++;
    if (enRecherche) recherche++;
    valides += v.o.valides.size;
    for (const [k, n] of v.motifs) motifs.set(k, (motifs.get(k) ?? 0) + n);
  }
  ok(scenarios >= 35, `différentiel : ${scenarios} scénarios sur 80 seeds (${recherche} en mode recherche), ${valides} builds valides à l'oracle`);
  ok(protectionActive > 0, `différentiel : la relique change l'étage de dominance dans ${protectionActive} scénario(s)`);
  egal(echecs, 0, `différentiel : aucun scénario en échec — absents par motif : ${fmtMotifs(motifs)}`);
}
