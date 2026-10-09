import type { LeaderSkill } from '../types';
import { baseCompleteCriteres, photoCriteres, type CriteresOptimizer } from './criteresOptimizer';
import { OPTIMIZER_RECIPE_VERSION, parseOptimizerRecipe } from './optimizerRecipe';
import { rattacherStockageOptimizer } from './optimizerRattachement';
export type { RapportReverificationOptimizer } from './optimizerRattachement';
import {
  exclusionSelectorKey, resolveExclusionEntry,
  type ExclusionSelector, type ExclusionSourceData, type OptimizerList, type OptimizerListMember, type ValidatedBuild,
} from './optimizerExclusion';

// Le lecteur des listes historiques ignore cette clé et ne peut pas la réécrire.
export const OPTIMIZER_MEMBERS_STORAGE_KEY = 'swblacksmith-optimizer-members-v1';
export type ContenuListeOptimizer = 'guilde' | 'donjon' | 'arene';
export interface EquipeOptimizer {
  id: string;
  listId: string;
  members: ExclusionSelector[];
  leader?: ExclusionSelector;
  lead: LeaderSkill | null;
}
export interface MemoireMembreOptimizer {
  listId: string;
  selector: ExclusionSelector;
  com2usId: number;
  criteres: CriteresOptimizer;
}
export type IdentiteMembreOptimizer = Omit<MemoireMembreOptimizer, 'criteres'>;
export interface DonneesMembresOptimizer {
  identities: Map<string, IdentiteMembreOptimizer>;
  memories: Map<string, MemoireMembreOptimizer>;
  teams: EquipeOptimizer[];
  listContents: Map<string, ContenuListeOptimizer>;
  /** Valeurs JSON rejetées : conservées à part, jamais promues en entrées utilisables. */
  rejets: { memories: unknown[]; teams: unknown[]; listContents: unknown[]; identities?: unknown[] };
}
export interface StockageOptimizer extends DonneesMembresOptimizer {
  lists: OptimizerList[];
  members: OptimizerListMember[];
  validated: ValidatedBuild[];
}
export const cleMemoireMembre = (listId: string, selector: ExclusionSelector): string =>
  `${listId}|${exclusionSelectorKey(selector)}`;
const objet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const entierPositif = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

export function selecteurValide(v: unknown): v is ExclusionSelector {
  if (!objet(v) || typeof v.source !== 'string') return false;
  if (v.source === 'box') return texte(v.unitKey);
  if (v.source === 'rta') return texte(v.monsterId);
  if (v.source === 'unowned') return texte(v.monsterId) && (v.copie === undefined
    || typeof v.copie === 'number' && Number.isSafeInteger(v.copie) && v.copie >= 2);
  return (v.source === 'siege-defense' || v.source === 'siege-offense') && texte(v.teamId)
    && typeof v.slotIndex === 'number' && Number.isInteger(v.slotIndex) && v.slotIndex >= 0 && v.slotIndex <= 2;
}

function criteresValides(v: unknown): v is CriteresOptimizer {
  if (!objet(v)) return false;
  // Tous les champs personnels restent obligatoires, y compris ceux ignorés par une recette.
  const base = baseCompleteCriteres(undefined);
  if (Object.keys(base).some((k) => !(k in v))) return false;
  if (['excludeBase', 'optimiserArtefacts', 'adapterArtefactsAuTri', 'compterAurasResPre'].some((k) => typeof v[k] !== 'boolean')) return false;
  if (typeof v.critereArtefacts !== 'string' || !['brut', 'reel'].includes(v.critereArtefacts)) return false;
  if (typeof v.sortBy !== 'string' || !['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'efficience', 'ehp', 'vitesse', 'degats_reels'].includes(v.sortBy)) return false;
  if (!objet(v.damageSetup) || !objet(v.maxStats) || !objet(v.mainStatsBySlot) || !objet(v.lockedRunes) || !Array.isArray(v.lignesVerrouillees)) return false;
  // La validation des critères partagés réutilise le lecteur de recette, jamais une deuxième règle.
  const lu = parseOptimizerRecipe(JSON.stringify({
    version: OPTIMIZER_RECIPE_VERSION, monsterCom2usId: 1, metric: 'eff', slotFilterPreset: 'moyen',
    objective: v.objective, damageSetup: v.damageSetup, compterAurasResPre: v.compterAurasResPre,
    artifactMainByKind: v.artifactMainByKind, relicMainChoice: v.relicMainChoice, relicUniqueChoice: v.relicUniqueChoice,
    lignesVerrouillees: v.lignesVerrouillees,
    requirement: { sets: v.comboSets, minStats: v.minStats, maxStats: v.maxStats, mainStats: v.mainStatsBySlot, lockedRunes: v.lockedRunes },
  }));
  return lu.recipe !== null && !lu.avertissements?.length;
}

function leadValide(v: unknown): v is LeaderSkill | null {
  if (v === null) return true;
  return objet(v) && (v.stat === null || texte(v.stat)) && typeof v.amount === 'number' && Number.isFinite(v.amount) && v.amount >= 0
    && typeof v.area === 'string' && ['General', 'Element', 'Arena', 'Guild', 'Dungeon'].includes(v.area)
    && (v.element === null || (typeof v.element === 'string' && ['fire', 'water', 'wind', 'light', 'dark'].includes(v.element)))
    && (v.area !== 'Element' || v.element !== null);
}

/** Valide seulement la forme : aucune équipe ne disparaît parce que les listes sont illisibles. */
export function validerEquipesOptimizer(valeur: unknown): { teams: EquipeOptimizer[]; rejets: unknown[]; rapport: string[] } {
  const teams: EquipeOptimizer[] = [], rejets: unknown[] = [], rapport: string[] = [];
  if (!Array.isArray(valeur)) return { teams, rejets: valeur === undefined ? [] : [valeur], rapport: ['Les équipes de l’Optimizer sont illisibles.'] };
  const ids = new Set<string>(), affectes = new Set<string>();
  for (const [index, v] of valeur.entries()) {
    if (!objet(v) || !texte(v.id) || !texte(v.listId) || !Array.isArray(v.members) || v.members.length < 2 || v.members.length > 5
      || !v.members.every(selecteurValide) || !leadValide(v.lead)
      || (v.leader !== undefined && (!selecteurValide(v.leader) || !v.members.some((s) => exclusionSelectorKey(s) === exclusionSelectorKey(v.leader as ExclusionSelector))))) {
      rejets.push(v); rapport.push(`Équipe ${index + 1} malformée : ignorée.`); continue;
    }
    const cles = v.members.map((s) => cleMemoireMembre(v.listId as string, s));
    if (ids.has(v.id) || new Set(cles).size !== cles.length || cles.some((k) => affectes.has(k))) {
      rejets.push(v); rapport.push(`Équipe ${index + 1} : identifiant ou membre déjà affecté, ignorée.`); continue;
    }
    ids.add(v.id); cles.forEach((k) => affectes.add(k));
    teams.push({ id: v.id, listId: v.listId, members: v.members, lead: v.lead,
      ...(v.leader === undefined ? {} : { leader: v.leader as ExclusionSelector }) });
  }
  return { teams, rejets, rapport };
}

/** Seule paire de conversion JSON de ce stockage ; la Map ne voyage jamais comme un objet vide. */
export function ecrireMembresOptimizer(donnees: DonneesMembresOptimizer): string {
  return JSON.stringify({ memories: [...donnees.memories], teams: donnees.teams,
    ...(donnees.identities.size ? { identities: [...donnees.identities] } : {}),
    listContents: [...donnees.listContents].map(([listId, contenu]) => ({ listId, contenu })),
    ...(donnees.rejets.memories.length || donnees.rejets.teams.length || donnees.rejets.listContents.length || donnees.rejets.identities?.length ? { rejets: donnees.rejets } : {}) });
}
export function lireMembresOptimizer(brut: string | null): DonneesMembresOptimizer & { rapport: string[] } {
  const memories = new Map<string, MemoireMembreOptimizer>(), rapport: string[] = [];
  const identities = new Map<string, IdentiteMembreOptimizer>();
  const listContents = new Map<string, ContenuListeOptimizer>();
  const rejets: DonneesMembresOptimizer['rejets'] = { memories: [], teams: [], listContents: [] };
  if (brut === null) return { identities, memories, listContents, teams: [], rejets, rapport };
  let v: unknown;
  try { v = JSON.parse(brut); } catch { return { identities, memories, listContents, teams: [], rejets, rapport: ['Le stockage des membres de l’Optimizer est illisible.'] }; }
  if (!objet(v)) return { identities, memories, listContents, teams: [], rejets: { memories: [v], teams: [], listContents: [] }, rapport: ['Le stockage des membres de l’Optimizer est malformé.'] };
  // Ne jamais revalider la section des rejets : un doublon devenu seul ne doit
  // pas se réactiver parce qu'une autre entrée a été supprimée entre-temps.
  if (objet(v.rejets)) {
    for (const genre of ['memories', 'teams', 'listContents'] as const) {
      const valeurs = v.rejets[genre];
      rejets[genre] = Array.isArray(valeurs) ? valeurs : valeurs === undefined ? [] : [valeurs];
      for (const [index] of rejets[genre].entries()) rapport.push(`${genre === 'memories' ? 'Mémoire' : genre === 'teams' ? 'Équipe' : 'Contenu de liste'} rejeté(e) ${index + 1} conservé(e) sans application.`);
    }
  } else if (v.rejets !== undefined) {
    rejets.memories.push(v.rejets); rapport.push('La section des rejets est malformée : conservée sans application.');
  }
  if (objet(v.rejets) && v.rejets.identities !== undefined) {
    rejets.identities = Array.isArray(v.rejets.identities) ? v.rejets.identities : [v.rejets.identities];
    rapport.push('Identités rejetées conservées sans application.');
  }
  if (v.identities !== undefined) {
    const valeurs = Array.isArray(v.identities) ? v.identities : [v.identities];
    for (const paire of valeurs) {
      const m = Array.isArray(paire) ? paire[1] : undefined;
      if (!Array.isArray(v.identities) || !Array.isArray(paire) || paire.length !== 2 || !objet(m)
        || !texte(m.listId) || !selecteurValide(m.selector) || !entierPositif(m.com2usId)
        || paire[0] !== cleMemoireMembre(m.listId, m.selector) || identities.has(paire[0])) {
        (rejets.identities ??= []).push(paire); rapport.push('Identité malformée ou dupliquée : conservée sans application.');
      } else identities.set(paire[0], { listId: m.listId, selector: m.selector, com2usId: m.com2usId });
    }
  }
  if (!Array.isArray(v.memories)) {
    if (v.memories !== undefined) rejets.memories.push(v.memories);
    rapport.push('L’index des mémoires est illisible.');
  }
  else for (const [index, paire] of v.memories.entries()) {
    const m = Array.isArray(paire) ? paire[1] : undefined;
    if (!Array.isArray(paire) || paire.length !== 2 || !texte(paire[0]) || !objet(m) || !texte(m.listId)
      || !selecteurValide(m.selector) || !entierPositif(m.com2usId) || !criteresValides(m.criteres)
      || paire[0] !== cleMemoireMembre(m.listId, m.selector) || memories.has(paire[0])) {
      rejets.memories.push(paire); rapport.push(`Mémoire ${index + 1} malformée ou dupliquée : ignorée.`); continue;
    }
    memories.set(paire[0], { listId: m.listId, selector: m.selector, com2usId: m.com2usId, criteres: m.criteres });
  }
  const equipes = validerEquipesOptimizer(v.teams);
  rejets.teams.push(...equipes.rejets);
  // Aucun défaut ni validation contre les listes : un stockage historique ou
  // des listes illisibles ne permettent pas de déduire le contenu de combat.
  if (v.listContents !== undefined && !Array.isArray(v.listContents)) {
    rejets.listContents.push(v.listContents);
    rapport.push('L’index des contenus de liste est illisible : conservé sans application.');
  } else if (Array.isArray(v.listContents)) for (const [index, entree] of v.listContents.entries()) {
    if (!objet(entree) || !texte(entree.listId) || !contenuListeValide(entree.contenu) || listContents.has(entree.listId)) {
      rejets.listContents.push(entree);
      rapport.push(`Contenu de liste ${index + 1} malformé ou dupliqué : conservé sans application.`);
    } else listContents.set(entree.listId, entree.contenu);
  }
  return { identities, memories, listContents, teams: equipes.teams, rejets, rapport: [...rapport, ...equipes.rapport] };
}

export function contenuListeValide(v: unknown): v is ContenuListeOptimizer {
  return typeof v === 'string' && ['guilde', 'donjon', 'arene'].includes(v);
}

/** Retirer seulement les valeurs dont la cible est lisible, sans interpréter une clé abîmée. */
export function retirerRejetsOptimizer(rejets: DonneesMembresOptimizer['rejets'], listId: string, selector?: ExclusionSelector): DonneesMembresOptimizer['rejets'] {
  const vise = (valeur: unknown, memoire: boolean) => {
    const contenu = memoire && Array.isArray(valeur) ? valeur[1] : valeur;
    return objet(contenu) && typeof contenu.listId === 'string' && contenu.listId === listId && (selector === undefined
      || (memoire && selecteurValide(contenu.selector) && exclusionSelectorKey(contenu.selector) === exclusionSelectorKey(selector)));
  };
  return { memories: rejets.memories.filter(v => !vise(v, true)), teams: rejets.teams.filter(v => !vise(v, false)),
    ...(rejets.identities ? { identities: rejets.identities.filter(v => !vise(v, true)) } : {}),
    listContents: selector === undefined ? rejets.listContents.filter(v => !vise(v, false)) : rejets.listContents };
}

export function lireMemoireMembre(memories: DonneesMembresOptimizer['memories'], listId: string, selector: ExclusionSelector, data: ExclusionSourceData): CriteresOptimizer | null {
  const m = memories.get(cleMemoireMembre(listId, selector));
  const resolu = resolveExclusionEntry(selector, data);
  return m && resolu?.monster.com2usId === m.com2usId ? photoCriteres(m.criteres, { type: 'personnel' }) : null;
}

export function enregistrerMemoireMembre(memories: DonneesMembresOptimizer['memories'], membre: Omit<MemoireMembreOptimizer, 'criteres'>,
  criteres: CriteresOptimizer, data: ExclusionSourceData): { memories: DonneesMembresOptimizer['memories']; rapport: string[] } {
  const cle = cleMemoireMembre(membre.listId, membre.selector), ancienne = memories.get(cle);
  if (!entierPositif(membre.com2usId) || resolveExclusionEntry(membre.selector, data)?.monster.com2usId !== membre.com2usId
    || (ancienne && ancienne.com2usId !== membre.com2usId)) {
    return { memories, rapport: ['Mémoire conservée sans modification : l’espèce du membre ne correspond pas.'] };
  }
  if (!criteresValides(criteres)) return { memories, rapport: ['Mémoire non écrite : critères malformés.'] };
  const copie = new Map(memories);
  copie.set(cle, { ...membre, selector: { ...membre.selector }, criteres: photoCriteres(criteres, { type: 'personnel' }) });
  return { memories: copie, rapport: [] };
}

/** Même revérification pure pour un réimport et la reprise d'un état sauvegardé. */
export function reverifierStockageOptimizer(stockage: StockageOptimizer, data: ExclusionSourceData, runeIds: Set<number>, artifactIds?: Set<number>):
  ReturnType<typeof rattacherStockageOptimizer> {
  return rattacherStockageOptimizer(stockage, data, runeIds, artifactIds);
}
