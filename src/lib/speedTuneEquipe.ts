// LE SPEED TUNE D'UNE ÉQUIPE de l'Optimizer : le plan photographié à l'export
// et la correspondance entre ses lignes alliées et les membres de l'équipe.
//
// Spec : docs/02-app/optimizer/feat-contrainte-speed-tune.md, « Membres et
// lignes » et « Persistance ». Le champ est FACULTATIF : une équipe sans lui se
// lit comme avant ; un speed tune malformé est écarté et signalé, jamais
// l'équipe avec lui.

import type { Camp, ModParTick } from './speedTune';
import type { ChoixSorts } from './speedTuneAuto';
import type { LeadInfo } from './speed';
import { refusDeLOrdre, type EntreesLigne, type LignePlan, type PlanSpeedTune } from './planSpeedTune';
import { exclusionSelectorKey, type ExclusionSelector } from './optimizerExclusion';

export interface MembreLigne {
  // La ligne alliée du plan.
  uid: string;
  // Le membre de l'équipe : le même sélecteur que `EquipeOptimizer.members`,
  // migré avec eux par la revérification du compte.
  selector: ExclusionSelector;
  // Le rattachement : attaché, la contrainte remplace la VIT minimum et le
  // verrou 206 du membre ; détaché, ces deux champs reprennent les valeurs de
  // repli, posées à l'export et suivies par « Recalculer » et « Restaurer ».
  attache: boolean;
  repli: RepliSpeedTune;
}

export interface RepliSpeedTune {
  // VIT minimum de fiche de la ligne ; `null` : aucune (vitesse non saisie).
  vitesseMin: number | null;
  // Le 206 de la ligne ; 0 : aucun verrou à poser.
  effet206: number;
}

export interface SpeedTuneEquipe {
  // `null` : le plan était malformé à la lecture — « plan de speed tune
  // perdu ». Les liens restent, pour qu'un membre attaché ne devienne pas une
  // recherche libre en silence.
  plan: PlanSpeedTune | null;
  membres: MembreLigne[];
}

// Le membre d'une ligne, s'il est encore dans l'équipe ; une ligne sans
// membre reste dans le plateau à ses valeurs du plan.
export function membreDeLaLigne(st: SpeedTuneEquipe, members: readonly ExclusionSelector[], uid: string): ExclusionSelector | null {
  const lien = st.membres.find((m) => m.uid === uid);
  if (!lien) return null;
  const cle = exclusionSelectorKey(lien.selector);
  return members.find((s) => exclusionSelectorKey(s) === cle) ?? null;
}

// La ligne d'un membre ; `null` : membre non contraint.
export function ligneDuMembre(st: SpeedTuneEquipe, members: readonly ExclusionSelector[], selector: ExclusionSelector): string | null {
  const cle = exclusionSelectorKey(selector);
  if (!members.some((s) => exclusionSelectorKey(s) === cle)) return null;
  return st.membres.find((m) => exclusionSelectorKey(m.selector) === cle)?.uid ?? null;
}

// ─── Lecture validée ────────────────────────────────────────────────────────

const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const camps: readonly Camp[] = ['allie', 'ennemi'];

function grille(v: unknown): v is ModParTick {
  return objet(v) && Object.entries(v).every(([k, x]) => /^\d+$/.test(k) && nombre(x));
}

function dictionnaire<T>(v: unknown, valide: (x: unknown) => x is T): v is Record<string, T> {
  return objet(v) && Object.values(v).every(valide);
}

function lead(v: unknown): v is LeadInfo | null {
  return v === null || (objet(v) && nombre(v.amount) && typeof v.area === 'string'
    && (v.element === null || typeof v.element === 'string'));
}

function entrees(v: unknown): v is EntreesLigne {
  return objet(v) && nombre(v.runeSpeed) && typeof v.swift === 'boolean' && nombre(v.artefactBuff)
    && (v.sets === undefined || (Array.isArray(v.sets) && v.sets.every((s) => typeof s === 'string')));
}

function ligne(v: unknown): v is LignePlan {
  return entrees(v) && objet(v) && texte(v.uid) && camps.includes(v.camp as Camp)
    && (texte(v.monsterId) || nombre(v.monsterId))
    && nombre(v.cumulsPassif) && (v.passifActif === undefined || typeof v.passifActif === 'boolean')
    && nombre(v.lead) && grille(v.atb) && grille(v.speed);
}

function choix(v: unknown): v is ChoixSorts {
  if (!objet(v)) return false;
  const chaines = (x: unknown) => x === undefined || dictionnaire(x, (y): y is string => typeof y === 'string');
  return chaines(v.sort) && chaines(v.sort2) && chaines(v.cible)
    && (v.atbChoisi === undefined || dictionnaire(v.atbChoisi, nombre));
}

// Exportée pour les équipes de « Mes équipes », qui gardent le même plan sous
// une autre désignation des membres (equipesEnregistrees.ts).
export function planSpeedTuneValide(v: unknown): v is PlanSpeedTune {
  if (!objet(v) || v.version !== 1 || !Array.isArray(v.lignes) || !v.lignes.every(ligne) || !choix(v.choix)) return false;
  if (!Array.isArray(v.ordre) || !v.ordre.every(texte) || !objet(v.leads) || !lead(v.leads.allie) || !lead(v.leads.ennemi)) return false;
  const uids = new Set((v.lignes as LignePlan[]).map((l) => l.uid));
  if (uids.size !== v.lignes.length) return false;
  const allies = (v.lignes as LignePlan[]).filter((l) => l.camp === 'allie').map((l) => l.uid);
  if (refusDeLOrdre(allies, v.ordre as string[])) return false;
  const origineValide = (x: unknown): x is EntreesLigne & { cumulsPassif: number } => entrees(x) && objet(x) && nombre(x.cumulsPassif);
  if (!dictionnaire(v.origine, origineValide) || !Object.keys(v.origine).every((u) => uids.has(u))) return false;
  return dictionnaire(v.referenceGains, nombre) && Object.keys(v.referenceGains).every((u) => uids.has(u));
}

// `selecteurValide` : la garde des sélecteurs du stockage, reçue pour n'avoir
// qu'une définition. `null` : les liens sont malformés, le speed tune entier
// est écarté et signalé ; un plan seul malformé rend `plan: null`.
export function lireSpeedTuneEquipe(
  v: unknown,
  selecteurValide: (s: unknown) => s is ExclusionSelector
): SpeedTuneEquipe | null {
  if (!objet(v) || !Array.isArray(v.membres)) return null;
  const p = planSpeedTuneValide(v.plan) ? v.plan : null;
  const allies = p ? new Set(p.lignes.filter((l) => l.camp === 'allie').map((l) => l.uid)) : null;
  const vusUid = new Set<string>();
  const vusMembre = new Set<string>();
  const membres: MembreLigne[] = [];
  for (const m of v.membres) {
    if (!objet(m) || !texte(m.uid) || (allies && !allies.has(m.uid)) || !selecteurValide(m.selector)) return null;
    if (typeof m.attache !== 'boolean' || !objet(m.repli)) return null;
    const { vitesseMin, effet206 } = m.repli;
    if (!(vitesseMin === null || (nombre(vitesseMin) && vitesseMin >= 0)) || !nombre(effet206) || effet206 < 0) return null;
    const cle = exclusionSelectorKey(m.selector);
    if (vusUid.has(m.uid) || vusMembre.has(cle)) return null;
    vusUid.add(m.uid);
    vusMembre.add(cle);
    // Un membre retiré ensuite garde son lien : sa ligne est simplement sans
    // membre (`membreDeLaLigne`), rien n'est vérifié contre l'équipe ici.
    membres.push({ uid: m.uid, selector: m.selector, attache: m.attache, repli: { vitesseMin, effet206 } });
  }
  return { plan: p, membres };
}
