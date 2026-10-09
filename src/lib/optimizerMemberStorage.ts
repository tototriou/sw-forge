import type { LeaderSkill } from '../types';
import { baseCompleteCriteres, photoCriteres, type CriteresOptimizer } from './criteresOptimizer';
import { OPTIMIZER_RECIPE_VERSION, parseOptimizerRecipe } from './optimizerRecipe';
import {
  comptePeutJuger, exclusionSelectorKey, resolveExclusionEntry, revalidateBuilds, revalidateMembers,
  type ExclusionSelector, type ExclusionSourceData, type OptimizerList, type OptimizerListMember, type ValidatedBuild,
} from './optimizerExclusion';

// Le lecteur des listes historiques ignore cette clé et ne peut pas la réécrire.
export const OPTIMIZER_MEMBERS_STORAGE_KEY = 'swblacksmith-optimizer-members-v1';
export type ContenuEquipeOptimizer = 'siege' | 'rta' | 'arene' | 'donjon';
export interface EquipeOptimizer {
  id: string;
  listId: string;
  members: ExclusionSelector[];
  leader?: ExclusionSelector;
  lead: LeaderSkill | null;
  contenu: ContenuEquipeOptimizer;
}
export interface MemoireMembreOptimizer {
  listId: string;
  selector: ExclusionSelector;
  com2usId: number;
  criteres: CriteresOptimizer;
}
export interface DonneesMembresOptimizer {
  memories: Map<string, MemoireMembreOptimizer>;
  teams: EquipeOptimizer[];
}
export interface StockageOptimizer extends DonneesMembresOptimizer {
  lists: OptimizerList[];
  members: OptimizerListMember[];
  validated: ValidatedBuild[];
  /** Rejets du chargement encore conservés dans le brut, distincts des gestes refusés. */
  rapportChargement: string[];
}
export const cleMemoireMembre = (listId: string, selector: ExclusionSelector): string =>
  `${listId}|${exclusionSelectorKey(selector)}`;
const objet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const texte = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const entierPositif = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;

function selecteurValide(v: unknown): v is ExclusionSelector {
  if (!objet(v)) return false;
  if (v.source === 'box') return texte(v.unitKey);
  if (v.source === 'rta' || v.source === 'unowned') return texte(v.monsterId);
  return (v.source === 'siege-defense' || v.source === 'siege-offense') && texte(v.teamId)
    && typeof v.slotIndex === 'number' && Number.isInteger(v.slotIndex) && v.slotIndex >= 0 && v.slotIndex <= 2;
}

function criteresValides(v: unknown): v is CriteresOptimizer {
  if (!objet(v)) return false;
  // Tous les champs personnels restent obligatoires, y compris ceux ignorés par une recette.
  const base = baseCompleteCriteres(undefined);
  if (Object.keys(base).some((k) => !(k in v))) return false;
  if (['excludeBase', 'optimiserArtefacts', 'adapterArtefactsAuTri', 'compterAurasResPre'].some((k) => typeof v[k] !== 'boolean')) return false;
  if (!['brut', 'reel'].includes(String(v.critereArtefacts))) return false;
  if (!['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'efficience', 'ehp', 'vitesse', 'degats_reels'].includes(String(v.sortBy))) return false;
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
    && ['General', 'Element', 'Arena', 'Guild', 'Dungeon'].includes(String(v.area))
    && (v.element === null || ['fire', 'water', 'wind', 'light', 'dark'].includes(String(v.element)))
    && (v.area !== 'Element' || v.element !== null);
}

/** Valide seulement la forme : aucune équipe ne disparaît parce que les listes sont illisibles. */
export function validerEquipesOptimizer(valeur: unknown): { teams: EquipeOptimizer[]; rapport: string[] } {
  const teams: EquipeOptimizer[] = [], rapport: string[] = [];
  if (!Array.isArray(valeur)) return { teams, rapport: ['Les équipes de l’Optimizer sont illisibles.'] };
  const ids = new Set<string>(), affectes = new Set<string>();
  for (const [index, v] of valeur.entries()) {
    const contenu = objet(v) ? v.contenu === undefined ? 'siege' : v.contenu : undefined;
    if (!objet(v) || !texte(v.id) || !texte(v.listId) || !Array.isArray(v.members) || v.members.length < 2 || v.members.length > 5
      || !v.members.every(selecteurValide) || !leadValide(v.lead)
      || !['siege', 'rta', 'arene', 'donjon'].includes(String(contenu))
      || (v.leader !== undefined && (!selecteurValide(v.leader) || !v.members.some((s) => exclusionSelectorKey(s) === exclusionSelectorKey(v.leader as ExclusionSelector))))) {
      rapport.push(`Équipe ${index + 1} malformée : ignorée.`); continue;
    }
    const cles = v.members.map((s) => cleMemoireMembre(v.listId as string, s));
    if (ids.has(v.id) || new Set(cles).size !== cles.length || cles.some((k) => affectes.has(k))) {
      rapport.push(`Équipe ${index + 1} : identifiant ou membre déjà affecté, ignorée.`); continue;
    }
    ids.add(v.id); cles.forEach((k) => affectes.add(k));
    teams.push({ id: v.id, listId: v.listId, members: v.members, lead: v.lead, contenu: contenu as ContenuEquipeOptimizer,
      ...(v.leader === undefined ? {} : { leader: v.leader as ExclusionSelector }) });
  }
  return { teams, rapport };
}

/** Seule paire de conversion JSON de ce stockage ; la Map ne voyage jamais comme un objet vide. */
export function ecrireMembresOptimizer(donnees: DonneesMembresOptimizer): string {
  return JSON.stringify({ memories: [...donnees.memories], teams: donnees.teams });
}
export function lireMembresOptimizer(brut: string | null): DonneesMembresOptimizer & { rapport: string[] } {
  const memories = new Map<string, MemoireMembreOptimizer>(), rapport: string[] = [];
  if (brut === null) return { memories, teams: [], rapport };
  let v: unknown;
  try { v = JSON.parse(brut); } catch { return { memories, teams: [], rapport: ['Le stockage des membres de l’Optimizer est illisible.'] }; }
  if (!objet(v)) return { memories, teams: [], rapport: ['Le stockage des membres de l’Optimizer est malformé.'] };
  if (!Array.isArray(v.memories)) rapport.push('L’index des mémoires est illisible.');
  else for (const [index, paire] of v.memories.entries()) {
    const m = Array.isArray(paire) ? paire[1] : undefined;
    if (!Array.isArray(paire) || paire.length !== 2 || !texte(paire[0]) || !objet(m) || !texte(m.listId)
      || !selecteurValide(m.selector) || !entierPositif(m.com2usId) || !criteresValides(m.criteres)
      || paire[0] !== cleMemoireMembre(m.listId, m.selector) || memories.has(paire[0])) {
      rapport.push(`Mémoire ${index + 1} malformée ou dupliquée : ignorée.`); continue;
    }
    memories.set(paire[0], { listId: m.listId, selector: m.selector, com2usId: m.com2usId, criteres: m.criteres });
  }
  const equipes = validerEquipesOptimizer(v.teams);
  return { memories, teams: equipes.teams, rapport: [...rapport, ...equipes.rapport] };
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

export interface RapportReverificationOptimizer {
  compteVide: boolean;
  membresRetires: number;
  buildsRetires: number;
  memoiresInactives: string[];
  memoiresSuivantSelecteur: string[];
  equipesModifiees: string[];
  equipesDissoutes: string[];
  messages: string[];
}

/** Même revérification pure pour un réimport et la reprise d'un état sauvegardé. */
export function reverifierStockageOptimizer(stockage: StockageOptimizer, data: ExclusionSourceData, runeIds: Set<number>):
  { stockage: StockageOptimizer; rapport: RapportReverificationOptimizer } {
  const rapport: RapportReverificationOptimizer = { compteVide: false, membresRetires: 0, buildsRetires: 0,
    memoiresInactives: [], memoiresSuivantSelecteur: [], equipesModifiees: [], equipesDissoutes: [], messages: [] };
  if (!comptePeutJuger(data, runeIds)) { rapport.compteVide = true; return { stockage, rapport }; }
  const membres = revalidateMembers(stockage.members, data), builds = revalidateBuilds(stockage.validated, data, runeIds);
  rapport.membresRetires = membres.droppedCount; rapport.buildsRetires = builds.droppedCount;
  const clesMembres = new Set(membres.kept.map((m) => cleMemoireMembre(m.listId, m.selector)));
  const lists = new Set(stockage.lists.map((l) => l.id));
  const nomsListes = new Map(stockage.lists.map((l) => [l.id, l.name]));
  for (const [cle, m] of stockage.memories) {
    const resolu = resolveExclusionEntry(m.selector, data);
    if (!lists.has(m.listId) || !clesMembres.has(cle) || resolu?.monster.com2usId !== m.com2usId) {
      rapport.memoiresInactives.push(cle);
      rapport.messages.push(`Mémoire d’un membre de « ${nomsListes.get(m.listId) ?? 'Liste introuvable'} » conservée sans application : membre absent ou espèce différente.`);
    } else if (m.selector.source === 'rta' || m.selector.source.startsWith('siege-')) {
      // RTA et siège ne portent pas l'identifiant de l'exemplaire : une autre
      // copie de la même espèce reprend la mémoire. Un message par mémoire à
      // chaque réimport ne dirait rien de plus que la spec ; on la liste
      // seulement dans le rapport.
      rapport.memoiresSuivantSelecteur.push(cle);
    }
  }
  const teams: EquipeOptimizer[] = [];
  for (const [index, equipe] of stockage.teams.entries()) {
    const nom = `Équipe ${index + 1} de « ${nomsListes.get(equipe.listId) ?? 'Liste introuvable'} »`;
    const members = equipe.members.filter((s) => lists.has(equipe.listId) && clesMembres.has(cleMemoireMembre(equipe.listId, s)));
    if (members.length < 2) {
      rapport.equipesDissoutes.push(equipe.id); rapport.messages.push(`${nom} dissoute : moins de deux membres.`); continue;
    }
    if (members.length !== equipe.members.length) {
      rapport.equipesModifiees.push(equipe.id); rapport.messages.push(`${nom} : membre introuvable retiré.`);
    }
    const { leader, ...reste } = equipe;
    teams.push({ ...reste, members, ...(leader && members.some((s) => exclusionSelectorKey(s) === exclusionSelectorKey(leader)) ? { leader } : {}) });
  }
  if (rapport.membresRetires || rapport.buildsRetires) rapport.messages.unshift(`${rapport.membresRetires} membre(s) et ${rapport.buildsRetires} build(s) retiré(s) : exemplaire introuvable ou runes absentes du compte.`);
  const modifie = rapport.membresRetires || rapport.buildsRetires || rapport.equipesModifiees.length || rapport.equipesDissoutes.length;
  if (!modifie) return { stockage, rapport };
  for (const rejet of stockage.rapportChargement) {
    rapport.messages.push(`Réécriture du stockage : cette entrée écartée au chargement ne sera plus conservée dans le brut. ${rejet}`);
  }
  return { stockage: { ...stockage, members: membres.kept, validated: builds.kept, memories: new Map(stockage.memories), teams, rapportChargement: [] }, rapport };
}
