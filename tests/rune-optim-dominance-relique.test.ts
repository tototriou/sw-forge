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
//
// Depuis 6bis-b3d-2 (constat C8 de la revue technique), un cas peut porter
// une PAIRE FIXE (`SearchParams.artifacts`) et un mode critique : la note
// lit alors sa principale et le profil de ses lignes 218–221, et
// `verifier()` confronte la note de l'oracle à celle de la production,
// candidat par candidat (`scoreDuCandidat` en relique fixe, score du couple
// retenu par la résolution en mode `recherche`). Le différentiel aléatoire
// tire cette paire ; le différentiel CIBLÉ construit des scénarios où la
// protection de l'effet unique, ou celle des lignes 218–221, porte l'optimum.

import { egal, ok, titre } from './outils';
import { DOMINANCE, HEURISTIQUES, premiereCoupe, setsSatisfaits } from './rune-optim-auras-coupes.test';
import { art } from './rune-optim-dominance-lignes.test';
import { RELIC_UNIQUE, activeSets, runeEfficiency, setPieces, setsCost } from '../src/lib/effects';
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
import type { CritMode, DamageSetup, SkillDamageProfile } from '../src/lib/damage';
import { Competence } from '../src/lib/monsterSkills';
import { apportExclusive } from '../src/lib/relicExclusive';
import { exclusiveChiffrable, relicUniqueNature, resoudreContexteRelique } from '../src/lib/relicOptim';
import {
  aurasPropresParRunes,
  avecAurasConditions,
  buildBuckets,
  objectiveScore,
  optionsDeClassement,
  prepareSearch,
  respecteConditionsAvecRelique,
  scoreDuCandidat,
  searchBuilds,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import type { BuildCandidate, BuildRequirement, Objective, RealDamageContext, SearchParams, SearchResult } from '../src/lib/runeBuildOptim';
import { prepareOrRefuse } from '../src/workers/prepareForSearch';
import { drain } from '../scripts/lib/drain';
import { mulberry32, randomPool, randomRune } from '../scripts/lib/randomPool';
import { resoudreCandidat } from '../scripts/lib/relicDifferentiel';
import type { ArtifactArchetype, ArtifactDetail, BaseStats, ElementKey, RelicDetail, RuneDetail } from '../src/types';

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
  // La paire FIXE (« Garder l'artéfact équipé » ×2) : `SearchParams.artifacts`,
  // lue par la note (principales, lignes 218–221). Absente : aucun artéfact.
  paire?: ArtifactDetail[];
  // Le mode critique de « Dégâts réels » ; absent : le défaut de l'écran.
  critMode?: CritMode;
}

const setupDe = (cas: Cas): DamageSetup => (cas.critMode ? { ...SETUP, critMode: cas.critMode } : SETUP);

function contexteDegats(cas: Cas): RealDamageContext | undefined {
  if (!cas.sort) return undefined;
  return {
    profile: SORTS[cas.sort], passifs: [], setup: setupDe(cas), element: null, artefacts: artifactDamageProfile(cas.paire ?? []),
    critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {},
    bonusDegatsConditionnel: null, bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null,
  };
}

function parametres(cas: Cas, extra: Partial<SearchParams> = {}): SearchParams {
  const setup = setupDe(cas);
  const requirement = avecAurasConditions({ sets: cas.sets, minStats: cas.minStats ?? {}, maxStats: cas.maxStats }, setup, cas.compter ?? true);
  const relicContext = cas.eligibles
    ? resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, cas.eligibles)
    : undefined;
  // Les stats privilégiées de « Dégâts réels » : celles du sort, comme l'écran.
  const objectiveStats = cas.sort ? damageRelevantStats(SORTS[cas.sort], [], setup) : undefined;
  // Heuristiques NON contraignantes : pré-filtrage et rétention plus larges
  // que le pool, collecte et temps illimités en pratique. La paire est FIGÉE :
  // `statsLignesArtefactsEquipables` reste absent, le moteur lit ses lignes.
  return {
    base: BASE, artifacts: cas.paire ?? [], relic: cas.relique, relicContext, pool: cas.pool, requirement, metric: 'eff',
    objective: cas.objective, objectiveStats, maxMs: 120000, maxCollected: 1_000_000, slotFilterCap: 200, bucketCap: 100000, ...extra,
  };
}

/* --------------------------------------------------------------------------
 * La note de production, et l'oracle
 * ----------------------------------------------------------------------- */

// La note d'UN équipement complet : six runes, la paire du cas, cette relique.
function note(cas: Cas, runes: RuneDetail[], rel: RelicDetail | undefined): number {
  const setup = setupDe(cas);
  const stats = computeStats({ base: BASE, runes, artifacts: cas.paire ?? [], relic: rel });
  const propres = aurasPropresDesRunes(runes);
  const candidat: BuildCandidate = { runeIds: runes.map((r) => r.id), stats, effTotal: runes.reduce((s, r) => s + runeEfficiency(r), 0) };
  return objectiveScore(candidat, cas.objective, propres, contexteDegats(cas), apportExclusive(rel, stats, setup, propres, null), setup);
}

// Conditions jugées par l'oracle lui-même (relique fixe) : fiche
// `computeStats`, plus 8 points RES/PRE par activation propre, toggle actif.
function respecteOracle(cas: Cas, runes: RuneDetail[], rel: RelicDetail | undefined): boolean {
  const stats = computeStats({ base: BASE, runes, artifacts: cas.paire ?? [], relic: rel });
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
  // Côté moteur : la note de PRODUCTION de ce candidat (A.6 bis), à confronter
  // à `note` — `scoreDuCandidat` en relique fixe, score du couple retenu par
  // la résolution en mode `recherche`.
  noteProduction?: number;
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
        const { respecte } = respecteConditionsAvecRelique({ base: BASE, runes, artifacts: cas.paire ?? [] }, rel, requirement);
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
  const setup = setupDe(cas);
  const degats = contexteDegats(cas);
  // Relique fixe : le classement de l'écran et du CLI (`optionsDeClassement`),
  // relique de la fiche dès l'ordre de base, paire figée lue dans `realDamage`.
  const runeById = new Map(cas.pool.map((r) => [r.id, r]));
  const opts = optionsDeClassement({
    realDamage: degats ?? null, damageSetup: setup, runeById, metric: 'eff', aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: () => null, etatReliqueDe: () => ({ etat: 'fixe', relique: cas.relique }), contexteExclusive: { setup, element: null },
  });
  for (const c of resultat.candidates) {
    let rel = cas.relique;
    let noteProduction: number;
    if (p.relicContext?.mode === 'recherche') {
      // La paire figée côté résolution (`paireFixe` → « Garder l'artéfact
      // équipé » ×2) : sans elle, la résolution noterait sur une paire vide.
      const r = resoudreCandidat(p, c, p.relicContext, {
        critere: cas.objective,
        degats: degats ? (({ artefacts: _a, ...reste }) => reste)(degats) : null,
        porteur: PORTEUR,
        exclusive: { setup, element: null },
        ...(cas.paire?.length ? { paireFixe: cas.paire } : {}),
      });
      if (!r.conforme) continue;
      rel = r.relique;
      noteProduction = r.paire?.score ?? Number.NaN;
    } else {
      noteProduction = scoreDuCandidat(c, cas.objective, opts) ?? Number.NaN;
    }
    retenus.set(cleDe(c), { cle: cleDe(c), note: note(cas, runesDuCandidat(p, c), rel), relique: rel, noteProduction });
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
  // A.6 bis : la note de l'oracle EST celle de la production, paire comprise.
  const ecartsNote = [...retenus.values()].filter((b) => !presque(b.note, b.noteProduction ?? Number.NaN));
  t(ecartsNote.length === 0,
    `${cas.nom} : note de l'oracle = note de production (${cas.eligibles ? 'score du couple retenu par la résolution' : 'scoreDuCandidat'}) pour chacun des ${retenus.size} candidat(s) retenu(s) (${ecartsNote.map((b) => `${b.cle} : ${b.note} ≠ ${b.noteProduction}`).join(' ; ') || '—'})`);
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

function assiette(type: number, runes: RuneDetail[], rel: RelicDetail | undefined, paire: ArtifactDetail[] = []): number {
  const stats = computeStats({ base: BASE, runes, artifacts: paire, relic: rel });
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

// Les lignes 218–221 et la stat qu'elles lisent — table de FIXTURE pour
// placer les tirages ; la production la lit dans `statsDesLignesBrutes`.
const LIGNE_STAT: Record<number, StatKey> = { 218: 'hp', 219: 'atk', 220: 'def', 221: 'spd' };
// Échelles tirées (% de la stat, par artéfact) : 218 vaut au plus 1,5 % des
// PV quand 221 se compte en dizaines de % de la VIT (damage.ts, CODE_BRUT_*).
const LIGNE_MAX: Record<number, number> = { 218: 1.5, 219: 4, 220: 4, 221: 40 };
// Mode critique tiré. ⚠️ Blade n'entre jamais dans un pool tiré en
// « Moyenne » : la dominance n'y protège pas le Taux Crit, décision de
// l'utilisateur du 2026-09-29 — une limite acceptée, pas un défaut à trouver.
const CRIT_MODES: CritMode[] = ['crit', 'normal', 'moyenne'];

const melange = <T>(rng: () => number, xs: T[]): T[] => {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// Une paire FIXE tirée, éligible pour le porteur (feu / attaque) : une pièce
// d'attribut et une de type, principales PV, ATQ ou DEF, et les lignes
// `codes` réparties au hasard sur les deux pièces.
function paireTiree(rng: () => number, codes: number[]): ArtifactDetail[] {
  const subs: [number, number][][] = [[], []];
  for (const code of codes) subs[Math.floor(rng() * 2)].push([code, Math.round(10 * LIGNE_MAX[code] * (0.3 + 0.7 * rng())) / 10]);
  const principale = (): [number, number] => {
    const code = ([100, 101, 102] as const)[Math.floor(rng() * 3)];
    return [code, code === 100 ? 1200 + Math.floor(rng() * 600) : 70 + Math.floor(rng() * 60)];
  };
  return [art(501, 'element', principale(), subs[0]), art(502, 'archetype', principale(), subs[1])];
}

const decrirePaire = (paire: ArtifactDetail[]) => `[${paire.flatMap((a) => a.subs.map((s) => `${s.code}:${s.value}`)).join(',')}]`;

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
    // Tirés APRÈS tout le reste (6bis-b3d-2) : la suite des tirages
    // précédents est inchangée. Une paire fixe portant zéro, une ou deux
    // lignes 218–221, et le mode critique (aucune Blade dans ces pools).
    cas.paire = paireTiree(rng, melange(rng, [218, 219, 220, 221]).slice(0, Math.floor(rng() * 3)));
    cas.critMode = CRIT_MODES[Math.floor(rng() * CRIT_MODES.length)];
    cas.nom += ` paire=${decrirePaire(cas.paire)} crit=${cas.critMode}`;
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

/* --------------------------------------------------------------------------
 * Différentiel CIBLÉ (seeds fixes) — 6bis-b3d-2, constat C8
 * ----------------------------------------------------------------------- */

// Le différentiel ci-dessus ne détecte pas la mutation de sa propre
// protection (revue technique 6bis-b § 5.5) : un clone par emplacement, au
// set tiré parmi dix, rarement porteur, et une tranche sans rapport avec lui.
// Ici, chaque scénario est CONSTRUIT pour que la protection porte l'optimum,
// puis noyé dans du bruit :
//  1. un pool de bruit : le set demandé sur ses emplacements, des sets
//     NEUTRES (ni bonus de fiche, ni aura) sur les emplacements libres ;
//  2. B* = l'optimum de l'oracle sur ce bruit (effet unique visé inerte) ;
//  3. le build protégé P = B* dont les runes de `setPieces(porteur)`
//     emplacements libres sont CLONÉES au set porteur, identifiant plus
//     grand : sans protection, le départage par identifiant les fait tomber ;
//  4. effet unique : la tranche est placée entre l'assiette de B* et celle
//     de P ; lignes 218–221 : la paire porte la ligne de la stat du porteur.
// Les pièges du contrat, traités explicitement :
//  - l'effet unique protège souvent déjà PV/ATQ/DEF : un scénario « ligne »
//    tourne sans relique, ou avec des reliques dont l'effet ne protège pas
//    la stat de la ligne ; un scénario « effet unique » porte une paire dont
//    aucune ligne ne lit la stat du porteur ;
//  - Blade n'entre pas dans le bruit d'un scénario en « Moyenne » ;
//  - deux seeds sur trois tournent SANS Intangible. Avec elle, la règle du
//    joker protège tout set complet avec ses vraies runes : P porte alors
//    `setPieces − 1` clones et une Intangible (formable par le joker
//    seulement), et chaque emplacement libre a son set neutre PROPRE, que
//    ses vraies runes ne complètent jamais.
// Critère (contrat b3d-2) : chaque mutation — `statsDeLEffetUnique` vidé,
// `statsLuesParLesLignes` vidé — fait échouer au moins un scénario d'ici.
const NEUTRES = ['will', 'shield', 'revenge', 'nemesis', 'destroy', 'despair', 'vampire'];
const STAT_PORTEUR: Record<string, StatKey> = { fight: 'atk', fatal: 'atk', determination: 'def', guard: 'def', enhance: 'hp', energy: 'hp', swift: 'spd' };
// Porteur, ligne qui lit sa stat, et sorts dont l'objectif ne la lit pas.
const CIBLES_LIGNE: { porteur: string; ligne: number; sorts: SortCle[] }[] = [
  { porteur: 'energy', ligne: 218, sorts: ['atk', 'def'] },
  { porteur: 'enhance', ligne: 218, sorts: ['atk', 'def'] },
  { porteur: 'fatal', ligne: 219, sorts: ['def', 'hp'] },
  { porteur: 'fight', ligne: 219, sorts: ['def', 'hp'] },
  { porteur: 'guard', ligne: 220, sorts: ['atk', 'hp'] },
  { porteur: 'determination', ligne: 220, sorts: ['atk', 'hp'] },
  { porteur: 'swift', ligne: 221, sorts: ['atk', 'def', 'hp'] },
];
// Les (type, porteur, objectif) de la couverture : ses quatre conditions y
// sont vérifiées. Ténacité 5 et 6, déjà protégées par l'objectif, exclues.
const CIBLES_RELIQUE = COUVERTURE.filter((c) => !c.dejaProtege);
const TRANCHE_INERTE = 1e9;

// Les stats dont l'effet unique d'un type fait dépendre la dominance — table
// de FIXTURE qui écarte les tirages masqués. La production la lit dans
// `statsDeLEffetUnique` (relicExclusive.ts), que la mutation 1 vide : le
// générateur n'en dépend pas, pour tirer les MÊMES scénarios sous mutation.
function statsDuType(type: number): StatKey[] {
  if (!RELIC_UNIQUE[type] || !exclusiveChiffrable(type)) return [];
  const out: StatKey[] = [];
  const ref = CLE_REF[RELIC_UNIQUE[type].stat.court];
  if (ref) out.push(ref);
  const nature = relicUniqueNature(type);
  if (nature?.sorte === 'buffStat') out.push(nature.stat);
  return out;
}

interface ScenarioCible {
  cas: Cas;
  cible: 'effet unique' | 'ligne';
  stat: StatKey;
  // Les clones porteurs, et le build protégé P (clé des six ids).
  porteurIds: number[];
  cleProtegee: string;
  joker: boolean;
}

// Le scénario d'une seed, ou le motif pour lequel il n'en a pas.
function scenarioCible(seed: number): ScenarioCible | string {
  const rng = mulberry32(seed);
  const joker = seed % 3 === 2;
  const cible: ScenarioCible['cible'] = rng() < 0.5 ? 'effet unique' : 'ligne';
  const cr = CIBLES_RELIQUE[Math.floor(rng() * CIBLES_RELIQUE.length)];
  const cl = CIBLES_LIGNE[Math.floor(rng() * CIBLES_LIGNE.length)];
  const porteur = cible === 'effet unique' ? cr.porteur : cl.porteur;
  const objective: Objective = cible === 'effet unique' ? cr.objective : 'degats_reels';
  const sort = cible === 'effet unique' ? cr.sort : cl.sorts[Math.floor(rng() * cl.sorts.length)];
  const stat = STAT_PORTEUR[porteur];
  const critMode = objective === 'degats_reels' ? CRIT_MODES[Math.floor(rng() * CRIT_MODES.length)] : undefined;
  const k = setPieces(porteur);
  // Avec l'Intangible, EXACTEMENT k emplacements libres : le joker ne
  // complète le porteur que s'il est le seul set incomplet (`activeSets`).
  const combos: string[][] = k === 2
    ? (joker ? [['violent']] : [['violent'], ['will'], []])
    : (joker ? [['will'], ['shield']] : [['will'], ['shield'], []]);
  const sets = combos[Math.floor(rng() * combos.length)];
  const demandes = setsCost(sets);
  const libres = [1, 2, 3, 4, 5, 6].filter((s) => s > demandes);
  const neutres = NEUTRES.filter((x) => !sets.includes(x));
  const propres = melange(rng, neutres);
  const bruitLibre = critMode === 'moyenne' ? neutres : [...neutres, 'blade'];
  const bruit: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    const setsDuSlot = slot <= demandes ? sets : joker ? [propres[libres.indexOf(slot)]] : bruitLibre;
    for (let i = 0; i < 3; i++) bruit.push(randomRune(id++, slot, rng, setsDuSlot));
  }
  // La paire : la ligne visée (« ligne »), plus, une fois sur deux, une
  // ligne qui ne lit PAS la stat du porteur.
  const autres = [218, 219, 220, 221].filter((c) => LIGNE_STAT[c] !== stat);
  const extra = rng() < 0.5 ? [autres[Math.floor(rng() * autres.length)]] : [];
  const paire = paireTiree(rng, cible === 'ligne' ? [cl.ligne, ...extra] : extra);
  // Les reliques. Tranche des reliques « de bruit » placée dans la
  // distribution de l'assiette de builds tirés, comme le différentiel aléatoire.
  const parSlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const x of bruit) parSlot[x.slot - 1].push(x);
  const echantillon: RuneDetail[][] = [];
  for (let n = 0; n < 40; n++) echantillon.push(parSlot.map((l) => l[Math.floor(rng() * l.length)]));
  const trancheTiree = (type: number) =>
    (RELIC_UNIQUE[type] ? Math.max(1, quantile(echantillon.map((b) => assiette(type, b, undefined, paire)), 0.5 + 0.45 * rng())) : 1000);
  const reliqueTiree = (rid: number, type: number, tranche: number) =>
    relique(rid, type, tranche, 1 + Math.floor(rng() * 2), ([100, 101, 102] as const)[Math.floor(rng() * 3)], 5 + Math.floor(rng() * 8));
  const enRecherche = rng() < 0.3;
  const reliques: RelicDetail[] = [];
  if (cible === 'effet unique') {
    reliques.push(reliqueTiree(900, cr.type, TRANCHE_INERTE));
    if (enRecherche) {
      const n = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const type = TYPES[Math.floor(rng() * TYPES.length)];
        reliques.push(reliqueTiree(901 + i, type, trancheTiree(type)));
      }
    }
  } else if (rng() >= 0.4) {
    // Aucune relique dont l'effet unique protégerait la stat de la ligne.
    const types = TYPES.filter((t) => !statsDuType(t).includes(stat));
    const n = enRecherche ? 2 + Math.floor(rng() * 2) : 1;
    for (let i = 0; i < n; i++) {
      const type = types[Math.floor(rng() * types.length)];
      reliques.push(reliqueTiree(900 + i, type, trancheTiree(type)));
    }
  }
  const recherche = enRecherche && reliques.length > 0;
  const casDe = (pool: RuneDetail[], rels: RelicDetail[], minStats?: Partial<Record<StatKey, number>>): Cas => ({
    nom: '', pool, sets, objective, sort, paire, critMode, minStats,
    ...(recherche ? { eligibles: rels } : rels.length > 0 ? { relique: rels[0] } : {}),
  });
  // B* : l'optimum de l'oracle sur le bruit seul.
  const brouillon = casDe(bruit, reliques);
  const o = oracle(brouillon, parametres(brouillon).requirement);
  if (o.valides.size === 0) return 'aucun build valide sur le bruit';
  const bStar = [...o.valides.values()].reduce((m, b) => (b.note > m.note ? b : m));
  const byId = new Map(bruit.map((r) => [r.id, r]));
  const runesB = bStar.cle.split(',').map((i) => byId.get(Number(i))!);
  // P : B* dont les runes d'emplacements libres tirés sont clonées.
  const ordre = melange(rng, libres);
  const nbPorteurs = joker ? k - 1 : k;
  const clones: RuneDetail[] = [];
  const runesP = [...runesB];
  ordre.slice(0, nbPorteurs + (joker ? 1 : 0)).forEach((s, i) => {
    const clone = i < nbPorteurs ? { ...runesB[s - 1], id: 100 + s, set: porteur } : { ...runesB[s - 1], id: 200 + s, set: 'intangible' };
    clones.push(clone);
    runesP[s - 1] = clone;
  });
  if (cible === 'effet unique') {
    const provisoire = reliques[0];
    const yP = assiette(cr.type, runesP, provisoire, paire);
    const yB = assiette(cr.type, runesB, provisoire, paire);
    if (yP <= yB) return `assiette du build protégé (${yP}) non supérieure à celle de B* (${yB})`;
    const tranche = yP - Math.floor(rng() * Math.max(1, Math.floor((yP - yB) / 2)));
    reliques[0] = { ...provisoire, unique: { ...provisoire.unique!, tranche } };
  }
  // Une fois sur quatre, un minimum sur une AUTRE stat de fiche, que P tient.
  let minStats: Partial<Record<StatKey, number>> | undefined;
  if (rng() < 0.25) {
    const cle = (['hp', 'atk', 'def', 'spd'] as const).filter((x) => x !== stat)[Math.floor(rng() * 3)];
    const fiche = (runes: RuneDetail[]) => computeStats({ base: BASE, runes, artifacts: paire, relic: reliques[0] }).find((x) => x.key === cle)?.total ?? 0;
    const vals = [...o.valides.keys()].map((c) => fiche(c.split(',').map((i) => byId.get(Number(i))!)));
    minStats = { [cle]: Math.min(quantile(vals, 0.1 + 0.3 * rng()), fiche(runesP)) };
  }
  const cas = casDe([...bruit, ...clones], reliques, minStats);
  cas.nom = `seed ${seed} ${cible} porteur=${porteur}×${nbPorteurs}${joker ? '+Intangible' : ''} sets=${JSON.stringify(sets)} ${objective}${sort ? `/${sort}` : ''}`
    + `${critMode ? ` crit=${critMode}` : ''} ${recherche ? 'recherche' : reliques.length > 0 ? 'fixe' : 'sans relique'}`
    + ` reliques=${reliques.map((r) => `${r.unique!.type}@${r.unique!.tranche}`).join('+') || '—'} paire=${decrirePaire(paire)}`
    + `${minStats ? ` min=${JSON.stringify(minStats)}` : ''}`;
  return {
    cas, cible, stat, joker,
    porteurIds: clones.filter((c) => c.set === porteur).map((c) => c.id),
    cleProtegee: runesP.map((r) => r.id).join(','),
  };
}

export function testDominanceReliqueDifferentielCible() {
  titre('Dominance · effet unique et lignes 218–221 — différentiel ciblé (seeds 6500..6559, 6bis-b3d-2)');
  const ignores: string[] = [];
  const violations: string[] = [];
  const echecs: string[] = [];
  // `optimal` : P est parmi les optimaux. `exige` : TOUS les optimaux portent
  // les clones — sinon un build sans eux (une autre relique éligible rend le
  // porteur inutile) fait jeu égal, et aucune mutation ne peut perdre
  // l'optimum. `detecteurs` : la protection agit ET l'optimum l'exige — les
  // scénarios qu'une mutation doit faire échouer.
  const parCible = new Map<string, { scenarios: number; agit: number; optimal: number; exige: number; detecteurs: string[] }>();
  let scenarios = 0;
  let sansIntangible = 0;
  let sansRelique = 0;
  let recherche = 0;
  let moyenne = 0;
  let valides = 0;
  const motifs = new Map<string, number>();
  for (let s = 0; s < 60; s++) {
    const seed = 6500 + s;
    const sc = scenarioCible(seed);
    if (typeof sc === 'string') {
      ignores.push(`seed ${seed} : ${sc}`);
      continue;
    }
    const { cas } = sc;
    const p = parametres(cas);
    // Préconditions : rien d'autre que la protection visée ne garde la stat
    // du porteur (conditions, objectif, l'AUTRE canal de protection).
    const objectif = new Set<string>(p.objectiveStats ?? (cas.objective === 'ehp' ? ['hp', 'def'] : []));
    const conditions = Object.entries(p.requirement.minStats).filter(([, v]) => v != null && v > 0).map(([k]) => k);
    const lignes = (cas.paire ?? []).flatMap((a) => a.subs.map((x) => LIGNE_STAT[x.code]));
    const reliques = cas.eligibles ?? (cas.relique ? [cas.relique] : []);
    const parReliques = reliques.flatMap((r) => statsDuType(r.unique!.type));
    const viole = (cond: boolean, motif: string) => { if (cond) violations.push(`${cas.nom} : ${motif}`); };
    viole(objectif.has(sc.stat), `${sc.stat} dans l'objectif`);
    viole(conditions.includes(sc.stat), `${sc.stat} sous condition`);
    viole(sc.cible === 'effet unique' ? lignes.includes(sc.stat) : parReliques.includes(sc.stat), `${sc.stat} protégée par l'autre canal`);
    viole(sc.cible === 'effet unique' ? !parReliques.includes(sc.stat) : !lignes.includes(sc.stat), `${sc.stat} non protégée par la cible`);
    viole(sc.joker !== cas.pool.some((r) => r.set === 'intangible'), 'Intangible contraire au tirage');
    viole(cas.critMode === 'moyenne' && cas.pool.some((r) => r.set === 'blade'), 'Blade dans un pool en « Moyenne »');
    // La protection agit : les clones passent la dominance avec elle, pas sans.
    const dom = apresDominance(p);
    const sans = apresDominance(sc.cible === 'effet unique' ? { ...p, relic: undefined, relicContext: undefined } : { ...p, artifacts: [] });
    const agit = sc.porteurIds.every((i) => dom.includes(i)) && !sc.porteurIds.every((i) => sans.includes(i));
    const v = lancer(cas, {}, 25);
    const tient = verifier(cas, v);
    const meilleur = Math.max(...[...v.o.valides.values()].map((b) => b.note));
    const optimal = presque(v.o.valides.get(sc.cleProtegee)?.note ?? Number.NaN, meilleur);
    const optimaux = [...v.o.valides.values()].filter((b) => presque(b.note, meilleur)).map((b) => b.cle.split(',').map(Number));
    const exige = optimal && optimaux.every((ids) => sc.porteurIds.every((i) => ids.includes(i)));
    const c = parCible.get(sc.cible) ?? { scenarios: 0, agit: 0, optimal: 0, exige: 0, detecteurs: [] };
    c.scenarios++;
    if (agit) c.agit++;
    if (optimal) c.optimal++;
    if (exige) c.exige++;
    if (agit && exige) c.detecteurs.push(String(seed));
    parCible.set(sc.cible, c);
    scenarios++;
    if (!sc.joker) sansIntangible++;
    if (reliques.length === 0) sansRelique++;
    if (cas.eligibles) recherche++;
    if (cas.critMode === 'moyenne') moyenne++;
    valides += v.o.valides.size;
    for (const [k, n] of v.motifs) motifs.set(k, (motifs.get(k) ?? 0) + n);
    if (!tient) echecs.push(`${sc.cible} — ${cas.nom}`);
  }
  ok(scenarios >= 50, `différentiel ciblé : ${scenarios} scénarios sur 60 seeds (${recherche} en mode recherche, ${moyenne} en « Moyenne », sans Blade), ${valides} builds valides à l'oracle${ignores.length ? ` ; ignorées : ${ignores.join(' ; ')}` : ''}`);
  ok(2 * sansIntangible >= scenarios, `différentiel ciblé : ${sansIntangible} scénario(s) sur ${scenarios} sans Intangible (au moins la moitié)`);
  ok(sansRelique > 0, `différentiel ciblé : ${sansRelique} scénario(s) « ligne » sans aucune relique`);
  egal(violations, [], 'différentiel ciblé : préconditions — la stat du porteur n\'est gardée que par la protection visée');
  egal([...parCible.keys()].sort(), ['effet unique', 'ligne'], 'différentiel ciblé : les deux protections sont tirées');
  for (const [cible, c] of [...parCible].sort()) {
    ok(c.detecteurs.length > 0,
      `différentiel ciblé, ${cible} : ${c.scenarios} scénario(s) ; la protection garde les clones porteurs dans ${c.agit} ; le build protégé est parmi les optimaux dans ${c.optimal}, l'optimum exige ses clones dans ${c.exige} ; détecteurs (protection active ET optimum qui l'exige) : ${c.detecteurs.length}, seeds ${c.detecteurs.join(', ')}`);
  }
  egal(echecs, [], `différentiel ciblé : aucun scénario en échec — absents par motif : ${fmtMotifs(motifs)}`);
}
