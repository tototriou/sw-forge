// LES ÉQUIPES ENREGISTRÉES de « Mes équipes » : modèle, validation à la
// relecture, comparaison au compte, opérations pures.
//
// Spec : docs/02-app/compte/feat-equipes.md. Une équipe garde une COPIE de son
// équipement : les identifiants servent à la comparaison au compte, jamais à
// relire l'équipement.

import type { ArtifactDetail, GearSet, Monster, RelicDetail, RuneDetail } from '../types';
import type { BoxItem } from './applyAccount';
import type { ContenuListeOptimizer } from './optimizerMemberStorage';
import type { ExclusionSelector } from './optimizerExclusion';
import type { PlanSpeedTune } from './planSpeedTune';
import type { RepliSpeedTune } from './speedTuneEquipe';
import { planSpeedTuneValide } from './speedTuneEquipe';
import { idCanoniqueCollab } from './monsterForms';

export const ONGLETS_EQUIPES = [
  'rta', 'arene-attaque', 'arene-defense', 'siege-attaque', 'siege-defense', 'guerre-guilde', 'pve',
] as const;
export type OngletEquipes = (typeof ONGLETS_EQUIPES)[number];

// Le contenu de la liste créée par l'export vers l'Optimizer.
export const CONTENU_OPTIMIZER_ONGLET: Record<OngletEquipes, ContenuListeOptimizer> = {
  rta: 'arene',
  'arene-attaque': 'arene',
  'arene-defense': 'arene',
  'siege-attaque': 'guilde',
  'siege-defense': 'guilde',
  'guerre-guilde': 'guilde',
  pve: 'donjon',
};

export const PROVENANCES_EQUIPEMENT = [
  'porte', 'siege-defense', 'siege-attaque', 'arene-defense', 'arene-attaque', 'optimizer', 'aucun',
] as const;
export type ProvenanceEquipement = (typeof PROVENANCES_EQUIPEMENT)[number];

export const MONSTRES_MAX_EQUIPE = 6;
// Une équipe enregistrée en a au moins deux : « Nouvelle équipe » reste un
// brouillon, non enregistré, tant qu'elle n'en a pas deux.
export const MONSTRES_MIN_EQUIPE = 2;

export interface MonstreEnregistre {
  // Stable dans l'équipe : le leader et les lignes du speed tune le désignent.
  uid: string;
  com2usId: number;
  // L'unité du jeu, seulement quand la source la connaît (Box, membre Box).
  unitId: number | null;
  provenance: ProvenanceEquipement;
  equipement: GearSet | null;
}

export interface LienLigneEnregistre {
  uid: string; // la ligne alliée du plan
  monstre: string; // l'uid du monstre de l'équipe
  attache: boolean;
  repli: RepliSpeedTune;
}

export interface SpeedTuneEnregistre {
  plan: PlanSpeedTune | null;
  liens: LienLigneEnregistre[];
}

export interface CorrespondanceOptimizer {
  uid: string;
  selecteur: ExclusionSelector;
}

export interface LienOptimizerEquipe {
  listId: string;
  equipeId: string;
  correspondance: CorrespondanceOptimizer[];
}

export interface EquipeEnregistree {
  id: string;
  onglet: OngletEquipes;
  nom: string;
  note: string;
  monstres: MonstreEnregistre[];
  leader: string | null;
  speedTune?: SpeedTuneEnregistre;
  lienOptimizer?: LienOptimizerEquipe;
  creeLe: string;
  modifieLe: string;
}

/* --------------------------------------------------------------------------
 * Validation à la relecture (stockage, fichier)
 * ----------------------------------------------------------------------- */

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === 'string';
const texteNonVide = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const entier = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

function ligneEffet(v: unknown): boolean {
  return objet(v) && entier(v.code) && nombre(v.value)
    && (v.grind === undefined || nombre(v.grind)) && (v.enchant === undefined || typeof v.enchant === 'boolean');
}

function rune(v: unknown): v is RuneDetail {
  return objet(v) && entier(v.id) && entier(v.slot) && v.slot >= 1 && v.slot <= 6 && texte(v.set)
    && entier(v.rank) && entier(v.rarity) && entier(v.level) && ligneEffet(v.main)
    && (v.innate === undefined || ligneEffet(v.innate)) && Array.isArray(v.subs) && v.subs.every(ligneEffet);
}

function artefact(v: unknown): v is ArtifactDetail {
  return objet(v) && entier(v.id) && (v.kind === 'element' || v.kind === 'archetype')
    && entier(v.level) && entier(v.rarity) && ligneEffet(v.main) && Array.isArray(v.subs) && v.subs.every(ligneEffet);
}

function relique(v: unknown): v is RelicDetail {
  return objet(v) && entier(v.id) && entier(v.upgrade) && ligneEffet(v.main)
    && (v.unique === undefined || (objet(v.unique) && nombre(v.unique.type) && nombre(v.unique.tranche)));
}

function equipementValide(v: unknown): v is GearSet {
  if (!objet(v) || !objet(v.base)) return false;
  const b = v.base;
  if (!['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'].every((k) => nombre(b[k]))) return false;
  return Array.isArray(v.runes) && v.runes.every(rune) && Array.isArray(v.artifacts) && v.artifacts.every(artefact)
    && (v.relic === undefined || relique(v.relic));
}

export function selecteurExclusionValide(v: unknown): v is ExclusionSelector {
  if (!objet(v)) return false;
  switch (v.source) {
    case 'box': return texteNonVide(v.unitKey);
    case 'rta': return texteNonVide(v.monsterId);
    case 'siege-defense':
    case 'siege-offense': return texteNonVide(v.teamId) && entier(v.slotIndex) && v.slotIndex >= 0;
    case 'unowned': return texteNonVide(v.monsterId) && (v.copie === undefined || (entier(v.copie) && v.copie >= 0));
    default: return false;
  }
}

function monstre(v: unknown): v is MonstreEnregistre {
  return objet(v) && texteNonVide(v.uid) && entier(v.com2usId) && v.com2usId > 0
    && (v.unitId === null || (entier(v.unitId) && v.unitId > 0))
    && PROVENANCES_EQUIPEMENT.includes(v.provenance as ProvenanceEquipement)
    && (v.equipement === null || equipementValide(v.equipement));
}

export type SignalementEquipe = 'speedTuneIncomplet' | 'leaderRetire' | 'lienOptimizerRetire';

export interface LectureEquipe {
  equipe: EquipeEnregistree;
  signalements: SignalementEquipe[];
}

// `null` : l'équipe est illisible (elle va aux rejets, brute). Un speed tune,
// un leader ou un lien mal formés dégradent l'équipe, ils ne la rejettent pas.
export function lireEquipeEnregistree(v: unknown): LectureEquipe | null {
  if (!objet(v) || !texteNonVide(v.id) || !ONGLETS_EQUIPES.includes(v.onglet as OngletEquipes)
    || !texteNonVide(v.nom) || !texte(v.note) || !date(v.creeLe) || !date(v.modifieLe)
    || !Array.isArray(v.monstres) || v.monstres.length < MONSTRES_MIN_EQUIPE || v.monstres.length > MONSTRES_MAX_EQUIPE || !v.monstres.every(monstre)) return null;
  const monstres = v.monstres as MonstreEnregistre[];
  const uids = new Set(monstres.map((m) => m.uid));
  if (uids.size !== monstres.length) return null;
  const signalements: SignalementEquipe[] = [];
  let leader: string | null = null;
  if (v.leader !== null && v.leader !== undefined) {
    if (texteNonVide(v.leader) && uids.has(v.leader)) leader = v.leader;
    else signalements.push('leaderRetire');
  }
  const equipe: EquipeEnregistree = {
    id: v.id, onglet: v.onglet as OngletEquipes, nom: v.nom, note: v.note,
    monstres: monstres.map(copierMonstre), leader, creeLe: v.creeLe, modifieLe: v.modifieLe,
  };
  if (v.speedTune !== undefined) {
    const st = lireSpeedTune(v.speedTune, uids);
    if (st.incomplet) signalements.push('speedTuneIncomplet');
    if (st.valeur) equipe.speedTune = st.valeur;
  }
  if (v.lienOptimizer !== undefined) {
    const lien = lireLien(v.lienOptimizer);
    if (lien) equipe.lienOptimizer = lien;
    else signalements.push('lienOptimizerRetire');
  }
  return { equipe, signalements };
}

function lireSpeedTune(v: unknown, uids: ReadonlySet<string>): { valeur: SpeedTuneEnregistre | null; incomplet: boolean } {
  if (!objet(v) || !Array.isArray(v.liens)) return { valeur: null, incomplet: true };
  let incomplet = false;
  const plan = planSpeedTuneValide(v.plan) ? v.plan : null;
  if (v.plan !== null && plan === null) incomplet = true;
  const allies = plan ? new Set(plan.lignes.filter((l) => l.camp === 'allie').map((l) => l.uid)) : null;
  const vusLigne = new Set<string>();
  const vusMonstre = new Set<string>();
  const liens: LienLigneEnregistre[] = [];
  for (const l of v.liens) {
    const valide = objet(l) && texteNonVide(l.uid) && texteNonVide(l.monstre) && uids.has(l.monstre)
      && (!allies || allies.has(l.uid)) && typeof l.attache === 'boolean' && objet(l.repli)
      && (l.repli.vitesseMin === null || (nombre(l.repli.vitesseMin) && l.repli.vitesseMin >= 0))
      && nombre(l.repli.effet206) && l.repli.effet206 >= 0
      && !vusLigne.has(l.uid) && !vusMonstre.has(l.monstre);
    if (!valide) { incomplet = true; continue; }
    const lien = l as { uid: string; monstre: string; attache: boolean; repli: RepliSpeedTune };
    vusLigne.add(lien.uid);
    vusMonstre.add(lien.monstre);
    liens.push({ uid: lien.uid, monstre: lien.monstre, attache: lien.attache,
      repli: { vitesseMin: lien.repli.vitesseMin, effet206: lien.repli.effet206 } });
  }
  return { valeur: { plan, liens }, incomplet };
}

function lireLien(v: unknown): LienOptimizerEquipe | null {
  if (!objet(v) || !texteNonVide(v.listId) || !texteNonVide(v.equipeId)
    || !Array.isArray(v.correspondance)) return null;
  const correspondance: CorrespondanceOptimizer[] = [];
  for (const c of v.correspondance) {
    if (!objet(c) || !texteNonVide(c.uid) || !selecteurExclusionValide(c.selecteur)) return null;
    correspondance.push({ uid: c.uid, selecteur: { ...c.selecteur } });
  }
  return { listId: v.listId, equipeId: v.equipeId, correspondance };
}

function copierMonstre(m: MonstreEnregistre): MonstreEnregistre {
  return { uid: m.uid, com2usId: m.com2usId, unitId: m.unitId, provenance: m.provenance,
    equipement: m.equipement === null ? null : structuredClone(m.equipement) };
}

/* --------------------------------------------------------------------------
 * Comparaison au compte
 * ----------------------------------------------------------------------- */

export type EtatPiece = 'identique' | 'modifiee' | 'disparue' | 'hors-compte';
export type TypePiece = 'rune' | 'artefact' | 'relique';

// Égalité champ à champ ; la seule exclusion est le marqueur de rune posé en
// jeu (`marker`), qui n'est pas une stat. Un champ ajouté aux types de pièce
// est comparé sans qu'on y pense.
export function comparerPiece(a: unknown, b: unknown): boolean {
  return egalProfond(sansMarqueur(a), sansMarqueur(b));
}

function sansMarqueur(v: unknown): unknown {
  if (!objet(v) || !('marker' in v)) return v;
  const { marker: _marker, ...reste } = v;
  return reste;
}

function egalProfond(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => egalProfond(x, b[i]));
  if (!objet(a) || !objet(b)) return false;
  // Une clé absente et une clé à `undefined` disent la même chose.
  const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of cles) if (!egalProfond(a[k], b[k])) return false;
  return true;
}

export interface InventaireCompte {
  runes: ReadonlyMap<number, RuneDetail>;
  artefacts: ReadonlyMap<number, ArtifactDetail>;
  reliques: ReadonlyMap<number, RelicDetail>;
}

export function indexerInventaire(runes: readonly RuneDetail[], artefacts: readonly ArtifactDetail[], reliques: readonly RelicDetail[]): InventaireCompte {
  return {
    runes: new Map(runes.map((r) => [r.id, r])),
    artefacts: new Map(artefacts.map((a) => [a.id, a])),
    reliques: new Map(reliques.map((r) => [r.id, r])),
  };
}

export function etatPiece(type: TypePiece, piece: RuneDetail | ArtifactDetail | RelicDetail, inv: InventaireCompte): EtatPiece {
  if (!(piece.id > 0)) return 'hors-compte';
  const actuelle = type === 'rune' ? inv.runes.get(piece.id) : type === 'artefact' ? inv.artefacts.get(piece.id) : inv.reliques.get(piece.id);
  if (!actuelle) return 'disparue';
  return comparerPiece(piece, actuelle) ? 'identique' : 'modifiee';
}

export interface EtatsEquipement {
  runes: EtatPiece[];
  artefacts: EtatPiece[];
  relique: EtatPiece | null;
}

export function etatsEquipement(eq: GearSet, inv: InventaireCompte): EtatsEquipement {
  return {
    runes: eq.runes.map((r) => etatPiece('rune', r, inv)),
    artefacts: eq.artifacts.map((a) => etatPiece('artefact', a, inv)),
    relique: eq.relic ? etatPiece('relique', eq.relic, inv) : null,
  };
}

export type EtatExemplaire = 'equipe-ainsi' | 'equipe-autrement' | 'absent' | null;

// `null` : aucune ligne (exemplaire inconnu, ou monstre sans équipement).
export function etatExemplaire(m: MonstreEnregistre, box: readonly BoxItem[]): EtatExemplaire {
  if (m.unitId === null || m.equipement === null) return null;
  const item = box.find((b) => b.key === String(m.unitId));
  if (!item) return 'absent';
  return memeEquipement(m.equipement, item.gear) ? 'equipe-ainsi' : 'equipe-autrement';
}

function memePieces<T extends { id: number }>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const parId = new Map(b.map((p) => [p.id, p]));
  return a.every((p) => { const q = parId.get(p.id); return q !== undefined && comparerPiece(p, q); });
}

export function memeEquipement(a: GearSet, b: GearSet | undefined): boolean {
  if (!b) return a.runes.length === 0 && a.artifacts.length === 0 && !a.relic;
  if (!memePieces(a.runes, b.runes) || !memePieces(a.artifacts, b.artifacts)) return false;
  if (!a.relic || !b.relic) return !a.relic && !b.relic;
  return a.relic.id === b.relic.id && comparerPiece(a.relic, b.relic);
}

export interface ResumeEcarts {
  modifiees: number;
  disparues: number;
}

export function resumeEcarts(e: EquipeEnregistree, inv: InventaireCompte): ResumeEcarts {
  let modifiees = 0;
  let disparues = 0;
  for (const m of e.monstres) {
    if (!m.equipement) continue;
    const etats = etatsEquipement(m.equipement, inv);
    for (const x of [...etats.runes, ...etats.artefacts, ...(etats.relique ? [etats.relique] : [])]) {
      if (x === 'modifiee') modifiees++;
      else if (x === 'disparue') disparues++;
    }
  }
  return { modifiees, disparues };
}

/* --------------------------------------------------------------------------
 * Recherche et ordre
 * ----------------------------------------------------------------------- */

// Une équipe est retenue si elle contient TOUS les monstres recherchés ; une
// collaboration et sa version SW comptent pour la même espèce.
export function equipesFiltrees(
  equipes: readonly EquipeEnregistree[], onglet: OngletEquipes, recherche: readonly Monster[],
  monstreParCom2us: ReadonlyMap<number, Monster>
): EquipeEnregistree[] {
  const canon = (com2usId: number) => idCanoniqueCollab(com2usId, monstreParCom2us.get(com2usId)?.jumeauCollab);
  const voulus = recherche.filter((m) => m.com2usId != null).map((m) => idCanoniqueCollab(m.com2usId as number, m.jumeauCollab));
  return equipes
    .filter((e) => e.onglet === onglet)
    .filter((e) => { const ids = new Set(e.monstres.map((m) => canon(m.com2usId))); return voulus.every((v) => ids.has(v)); })
    .sort((a, b) => Date.parse(b.modifieLe) - Date.parse(a.modifieLe) || a.id.localeCompare(b.id));
}

export function compteParOnglet(equipes: readonly EquipeEnregistree[]): Record<OngletEquipes, number> {
  const c = Object.fromEntries(ONGLETS_EQUIPES.map((o) => [o, 0])) as Record<OngletEquipes, number>;
  for (const e of equipes) c[e.onglet]++;
  return c;
}

/* --------------------------------------------------------------------------
 * Opérations
 * ----------------------------------------------------------------------- */

export type TirerId = () => string;

export function nomEquipeLibre(equipes: readonly EquipeEnregistree[], modele: (n: number) => string): string {
  const noms = new Set(equipes.map((e) => e.nom));
  for (let n = 1; ; n++) if (!noms.has(modele(n))) return modele(n);
}

export function creerEquipe(id: string, onglet: OngletEquipes, nom: string, maintenant: Date): EquipeEnregistree {
  const d = maintenant.toISOString();
  return { id, onglet, nom, note: '', monstres: [], leader: null, creeLe: d, modifieLe: d };
}

// Un geste sur le brouillon de « Nouvelle équipe » : il reste brouillon sous
// deux monstres, et devient l'équipe à enregistrer dès le deuxième.
export function gesteSurBrouillon(
  b: EquipeEnregistree, f: (e: EquipeEnregistree, maintenant: Date) => EquipeEnregistree, maintenant: Date
): { brouillon: EquipeEnregistree | null; aEnregistrer: EquipeEnregistree | null } {
  const suite = f(b, maintenant);
  return suite.monstres.length < MONSTRES_MIN_EQUIPE ? { brouillon: suite, aEnregistrer: null } : { brouillon: null, aEnregistrer: suite };
}

const touchee = (e: EquipeEnregistree, maintenant: Date): EquipeEnregistree => ({ ...e, modifieLe: maintenant.toISOString() });

export function ajouterMonstre(e: EquipeEnregistree, m: MonstreEnregistre, maintenant: Date): EquipeEnregistree | null {
  if (e.monstres.length >= MONSTRES_MAX_EQUIPE || e.monstres.some((x) => x.uid === m.uid)) return null;
  return touchee({ ...e, monstres: [...e.monstres, m] }, maintenant);
}

// Retirer un monstre remet le leader à `null` s'il le désignait et retire ses
// liens de lignes : la ligne reste dans le plan, sans monstre.
export function retirerMonstre(e: EquipeEnregistree, uid: string, maintenant: Date): EquipeEnregistree {
  const suite: EquipeEnregistree = { ...e, monstres: e.monstres.filter((m) => m.uid !== uid), leader: e.leader === uid ? null : e.leader };
  if (e.speedTune) suite.speedTune = { ...e.speedTune, liens: e.speedTune.liens.filter((l) => l.monstre !== uid) };
  return touchee(suite, maintenant);
}

export function deplacerMonstre(e: EquipeEnregistree, uid: string, position: number, maintenant: Date): EquipeEnregistree {
  const i = e.monstres.findIndex((m) => m.uid === uid);
  if (i < 0) return e;
  const cible = Math.max(0, Math.min(e.monstres.length - 1, position));
  if (cible === i) return e;
  const monstres = [...e.monstres];
  const [m] = monstres.splice(i, 1);
  monstres.splice(cible, 0, m);
  return touchee({ ...e, monstres }, maintenant);
}

export function designerLeader(e: EquipeEnregistree, uid: string | null, maintenant: Date): EquipeEnregistree {
  if (uid !== null && !e.monstres.some((m) => m.uid === uid)) return e;
  return touchee({ ...e, leader: uid }, maintenant);
}

export function remplacerEquipement(
  e: EquipeEnregistree, uid: string, equipement: GearSet | null, provenance: ProvenanceEquipement, maintenant: Date
): EquipeEnregistree {
  return touchee({ ...e, monstres: e.monstres.map((m) => m.uid === uid
    ? { ...m, provenance, equipement: equipement === null ? null : structuredClone(equipement) } : m) }, maintenant);
}

// Retire la seule relique enregistrée : le retour de l'Optimizer la garde
// faute de savoir si elle a été retirée, le retrait se refait ici.
export function retirerRelique(e: EquipeEnregistree, uid: string, maintenant: Date): EquipeEnregistree {
  const m = e.monstres.find((x) => x.uid === uid);
  if (!m?.equipement?.relic) return e;
  const { relic: _relique, ...sans } = m.equipement;
  return touchee({ ...e, monstres: e.monstres.map((x) => (x.uid === uid ? { ...x, equipement: sans } : x)) }, maintenant);
}

export function modifierTextes(e: EquipeEnregistree, champs: { nom?: string; note?: string }, maintenant: Date): EquipeEnregistree {
  const nom = champs.nom !== undefined && champs.nom.trim() !== '' ? champs.nom.trim() : e.nom;
  const note = champs.note !== undefined ? champs.note.trim() : e.note;
  if (nom === e.nom && note === e.note) return e;
  return touchee({ ...e, nom, note }, maintenant);
}

export function deplacerVersOnglet(e: EquipeEnregistree, onglet: OngletEquipes, maintenant: Date): EquipeEnregistree {
  return e.onglet === onglet ? e : touchee({ ...e, onglet }, maintenant);
}

// Nouveaux `id` et `uid` ; le leader et les liens suivent la correspondance
// ancien → nouveau `uid`. Jamais de lien vers l'Optimizer : deux équipes ne
// mettent pas à jour la même liste.
export function dupliquerEquipe(e: EquipeEnregistree, id: string, nom: string, tirerUid: TirerId, maintenant: Date): EquipeEnregistree {
  const nouveaux = new Map(e.monstres.map((m) => [m.uid, tirerUid()]));
  const d = maintenant.toISOString();
  const copie: EquipeEnregistree = {
    id, onglet: e.onglet, nom, note: e.note,
    monstres: e.monstres.map((m) => ({ ...copierMonstre(m), uid: nouveaux.get(m.uid)! })),
    leader: e.leader === null ? null : nouveaux.get(e.leader) ?? null,
    creeLe: d, modifieLe: d,
  };
  if (e.speedTune) {
    copie.speedTune = {
      plan: e.speedTune.plan === null ? null : structuredClone(e.speedTune.plan),
      liens: e.speedTune.liens.filter((l) => nouveaux.has(l.monstre))
        .map((l) => ({ ...l, monstre: nouveaux.get(l.monstre)!, repli: { ...l.repli } })),
    };
  }
  return copie;
}

export function tireurIdentifiants(prefixe: string): TirerId {
  return () => `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* --------------------------------------------------------------------------
 * Relecture et écritures
 * ----------------------------------------------------------------------- */

// La relecture au démarrage s'applique SOUS les gestes déjà faits : pour un
// même `id`, l'état en mémoire gagne ; une équipe supprimée pendant la
// relecture ne revient pas.
export function fusionnerRelecture(
  memoire: readonly EquipeEnregistree[], relues: readonly EquipeEnregistree[], supprimees: ReadonlySet<string>
): EquipeEnregistree[] {
  const enMemoire = new Set(memoire.map((e) => e.id));
  return [...memoire, ...relues.filter((e) => !enMemoire.has(e.id) && !supprimees.has(e.id))];
}

// Ce qu'un changement d'état demande d'écrire : les équipes nouvelles ou
// changées (par référence : les opérations rendent un nouvel objet), et les
// identifiants disparus.
export function ecrituresEntre(
  avant: readonly EquipeEnregistree[], apres: readonly EquipeEnregistree[]
): { aEcrire: EquipeEnregistree[]; aSupprimer: string[] } {
  const anciens = new Map(avant.map((e) => [e.id, e]));
  const presents = new Set(apres.map((e) => e.id));
  return {
    aEcrire: apres.filter((e) => anciens.get(e.id) !== e),
    aSupprimer: avant.filter((e) => !presents.has(e.id)).map((e) => e.id),
  };
}
