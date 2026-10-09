import type { ElementKey, LeaderSkill } from '../types';
import type { LeadEffectifOptimizer } from './criteresOptimizer';
import { LEADER_SKILL_STATS, type LeaderSkillStat } from './damage';
import { exclusionSelectorKey, type ExclusionSelector } from './optimizerExclusion';
import { validerEquipesOptimizer, type ContenuListeOptimizer, type EquipeOptimizer, type StockageOptimizer } from './optimizerMemberStorage';

type PorteeLead = 'General' | 'Element' | 'Arena' | 'Guild' | 'Dungeon';
type ActiviteLead = 'actif' | 'element' | 'inactif';

// Chaque case suit la table de contenu de combat de la spec :
// docs/02-app/optimizer/feat-listes-equipes-et-sauvegarde.md § Lead effectif d’un membre.
export const ACTIVITE_LEADS_OPTIMIZER = {
  guilde: {
    General: 'actif',
    Element: 'element',
    Arena: 'inactif',
    Guild: 'actif',
    Dungeon: 'inactif',
  },
  arene: {
    General: 'actif',
    Element: 'element',
    Arena: 'actif',
    Guild: 'inactif',
    Dungeon: 'inactif',
  },
  donjon: {
    General: 'actif',
    Element: 'element',
    Arena: 'inactif',
    Guild: 'inactif',
    Dungeon: 'actif',
  },
} as const satisfies Record<ContenuListeOptimizer, Record<PorteeLead, ActiviteLead>>;

// Compatible avec appliquerCriteres ; tout « aucun » porte sa raison.
export type LeadMembreOptimizer = Exclude<LeadEffectifOptimizer, { type: 'aucun' }> | { type: 'aucun'; motif: string };
const aucun = (motif: string): LeadMembreOptimizer => ({ type: 'aucun', motif });
const memeMembre = (a: ExclusionSelector, b: ExclusionSelector): boolean => exclusionSelectorKey(a) === exclusionSelectorKey(b);

export function leadEffectifMembreOptimizer(
  stockage: Pick<StockageOptimizer, 'teams' | 'listContents'>, listId: string, selector: ExclusionSelector, element: ElementKey
): LeadMembreOptimizer {
  const equipe = stockage.teams.find(e => e.listId === listId && e.members.some(s => memeMembre(s, selector)));
  if (!equipe) return { type: 'personnel' };
  const contenu = stockage.listContents.get(listId);
  if (!contenu) return aucun('Le contenu de combat de la liste n’est pas défini : aucun lead d’équipe appliqué.');
  const lead = equipe.lead;
  if (!lead) return aucun('L’équipe ne porte aucun lead.');
  const ligne = ACTIVITE_LEADS_OPTIMIZER[contenu] as Record<string, ActiviteLead> | undefined;
  const activite = ligne && Object.prototype.hasOwnProperty.call(ligne, lead.area) ? ligne[lead.area] : undefined;
  if (!activite) return aucun('L’activité de cette portée de lead n’est pas établie pour ce contenu.');
  if (activite === 'inactif') return aucun('Cette portée de lead est inactive pour ce contenu.');
  if (activite === 'element' && (!lead.element || lead.element !== element)) return aucun('Le lead ne concerne pas l’élément de ce membre.');
  // damage.ts : RES et Précision n’entrent pas dans les stats de lead calculées.
  if (!LEADER_SKILL_STATS.includes(lead.stat as LeaderSkillStat)) return aucun('La statistique de ce lead est conservée, sans effet calculé.');
  if (!Number.isFinite(lead.amount) || lead.amount < 0) return aucun('Le montant de ce lead est invalide.');
  return { type: 'equipe', lead: { stat: lead.stat as LeaderSkillStat, pct: lead.amount } };
}

export type ContexteEquipesOptimizer = Pick<StockageOptimizer, 'lists' | 'members' | 'teams'>;
export interface CreationEquipeOptimizer {
  id: string;
  listId: string;
  members: ExclusionSelector[];
  leader?: ExclusionSelector;
  lead?: LeaderSkill | null;
}
export interface ResultatEquipesOptimizer {
  teams: EquipeOptimizer[];
  rapport: string[];
}

function accepterEquipes(contexte: ContexteEquipesOptimizer, teams: EquipeOptimizer[]): ResultatEquipesOptimizer {
  const validation = validerEquipesOptimizer(teams);
  if (validation.rejets.length) return { teams: contexte.teams, rapport: validation.rapport };
  for (const equipe of teams) {
    if (!contexte.lists.some(l => l.id === equipe.listId)
      || equipe.members.some(s => !contexte.members.some(m => m.listId === equipe.listId && memeMembre(m.selector, s)))) {
      return { teams: contexte.teams, rapport: ['Équipe refusée : la liste ou un de ses membres est introuvable.'] };
    }
  }
  // Les données acceptées sont détachées : un éditeur ne peut muter le stockage reçu.
  return { teams: structuredClone(validation.teams), rapport: [] };
}

export function creerEquipeOptimizer(contexte: ContexteEquipesOptimizer, creation: CreationEquipeOptimizer): ResultatEquipesOptimizer {
  const equipe: EquipeOptimizer = { ...creation, lead: creation.lead ?? null };
  // Une création ne revérifie pas les références des équipes conservées :
  // une liste ou un membre ancien disparu ne doit pas bloquer la nouvelle équipe.
  const resultat = accepterEquipes(contexte, [equipe]);
  if (resultat.rapport.length) return resultat;
  if (contexte.teams.some(e => e.id === equipe.id
    || (e.listId === equipe.listId && e.members.some(s => equipe.members.some(m => memeMembre(s, m)))))) {
    return { teams: contexte.teams, rapport: ['Équipe refusée : identifiant ou membre déjà affecté.'] };
  }
  return { teams: [...contexte.teams, ...resultat.teams], rapport: [] };
}

export function ajouterMembreEquipeOptimizer(
  contexte: ContexteEquipesOptimizer, equipeId: string, selector: ExclusionSelector
): ResultatEquipesOptimizer {
  const equipe = contexte.teams.find(e => e.id === equipeId);
  if (!equipe) return { teams: contexte.teams, rapport: ['Équipe introuvable : aucun membre ajouté.'] };
  return modifierEquipeOptimizer(contexte, { ...equipe, members: [...equipe.members, selector] });
}

/** Valider seulement la cible, tout en contrôlant les collisions avec les équipes conservées. */
export function modifierEquipeOptimizer(contexte: ContexteEquipesOptimizer, equipe: EquipeOptimizer): ResultatEquipesOptimizer {
  if (!contexte.teams.some(e => e.id === equipe.id && e.listId === equipe.listId)) {
    return { teams: contexte.teams, rapport: ['Équipe introuvable : aucun changement.'] };
  }
  const resultat = creerEquipeOptimizer({ ...contexte, teams: contexte.teams.filter(e => e.id !== equipe.id) }, equipe);
  if (resultat.rapport.length) return { teams: contexte.teams, rapport: resultat.rapport };
  const valide = resultat.teams.find(e => e.id === equipe.id)!;
  return { teams: contexte.teams.map(e => e.id === equipe.id ? valide : e), rapport: [] };
}

export function retirerMembreEquipeOptimizer(
  teams: EquipeOptimizer[], equipeId: string, selector: ExclusionSelector
): ResultatEquipesOptimizer {
  const equipe = teams.find(e => e.id === equipeId);
  if (!equipe || !equipe.members.some(s => memeMembre(s, selector))) return { teams, rapport: ['Équipe ou membre introuvable : aucun changement.'] };
  const members = equipe.members.filter(s => !memeMembre(s, selector));
  if (members.length < 2) return { teams: teams.filter(e => e.id !== equipeId), rapport: ['Équipe dissoute : moins de deux membres.'] };
  const { leader, ...reste } = equipe;
  const nouvelle = { ...reste, members, ...(leader && !memeMembre(leader, selector) ? { leader } : {}) };
  return { teams: structuredClone(teams.map(e => e.id === equipeId ? nouvelle : e)), rapport: [] };
}

export function delierMembreOptimizer(teams: EquipeOptimizer[], listId: string, selector: ExclusionSelector): ResultatEquipesOptimizer {
  const equipe = teams.find(e => e.listId === listId && e.members.some(s => memeMembre(s, selector)));
  return equipe ? retirerMembreEquipeOptimizer(teams, equipe.id, selector) : { teams, rapport: ['Ce membre n’est lié à aucune équipe.'] };
}

export function dissoudreEquipeOptimizer(teams: EquipeOptimizer[], equipeId: string): ResultatEquipesOptimizer {
  return teams.some(e => e.id === equipeId)
    ? { teams: teams.filter(e => e.id !== equipeId), rapport: ['Équipe dissoute ; ses membres restent dans la liste.'] }
    : { teams, rapport: ['Équipe introuvable : aucune dissolution.'] };
}

export function equipeApresFiltrageOptimizer(
  contexte: ContexteEquipesOptimizer, creation: CreationEquipeOptimizer
): { equipe: EquipeOptimizer | null; rapport: string[] } {
  const nombre = creation.members.length;
  if (nombre < 2 || nombre > 5) {
    const raison = nombre === 0 ? 'Aucun membre après filtrage.' : nombre === 1 ? 'Un seul membre après filtrage.' : 'Plus de cinq membres après filtrage.';
    return { equipe: null, rapport: [`${raison} Aucune équipe créée ; le lead de la source n’est appliqué à personne.`] };
  }
  const resultat = creerEquipeOptimizer(contexte, creation);
  if (resultat.rapport.length) return { equipe: null, rapport: [...resultat.rapport, 'Aucune équipe créée ; le lead de la source n’est appliqué à personne.'] };
  return { equipe: resultat.teams.find(e => e.id === creation.id)!, rapport: [] };
}
