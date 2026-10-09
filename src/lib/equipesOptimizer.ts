import type { ElementKey, LeaderSkill } from '../types';
import type { LeadEffectifOptimizer } from './criteresOptimizer';
import { LEADER_SKILL_STATS, type LeaderSkillStat } from './damage';
import { exclusionSelectorKey, type ExclusionSelector } from './optimizerExclusion';
import { validerEquipesOptimizer, type ContenuEquipeOptimizer, type EquipeOptimizer, type StockageOptimizer } from './optimizerMemberStorage';

type PorteeLead = 'General' | 'Element' | 'Arena' | 'Guild' | 'Dungeon';
type ActiviteLead = 'actif' | 'element' | 'inactif' | 'sans-source';

// Sources du modèle existant, pas un relevé en combat pour toutes les stats.
export const ACTIVITE_LEADS_OPTIMIZER = {
  siege: {
    General: 'actif', // speed.ts:191 : General en siège.
    Element: 'element', // speed.ts:192 : même élément seulement.
    Arena: 'inactif', // speed.ts:193 : autre portée en siège.
    Guild: 'actif', // speed.ts:191 : Guild en siège.
    Dungeon: 'inactif', // speed.ts:193 : autre portée en siège.
  },
  rta: {
    General: 'actif', // docs/02-app/rta/feat-categories.md:24–25.
    Element: 'element', // docs/02-app/rta/feat-categories.md:30.
    Arena: 'actif', // docs/02-app/rta/feat-categories.md:24–25.
    Guild: 'inactif', // docs/02-app/rta/feat-categories.md:29.
    Dungeon: 'inactif', // docs/02-app/rta/feat-categories.md:29.
  },
  arene: {
    General: 'actif', // useRtaCategories.ts:69 : « partout ».
    Element: 'sans-source', // Activité non établie en Arène.
    Arena: 'actif', // docs/02-app/transverse/feat-calcul-vitesse.md:107–108.
    Guild: 'sans-source', // Activité non établie en Arène.
    Dungeon: 'sans-source', // Activité non établie en Arène.
  },
  donjon: {
    General: 'actif', // useRtaCategories.ts:69 : « partout ».
    Element: 'sans-source', // Activité non établie en Donjon.
    Arena: 'sans-source', // Activité non établie en Donjon.
    Guild: 'sans-source', // Activité non établie en Donjon.
    Dungeon: 'sans-source', // Activité non établie en Donjon.
  },
} as const satisfies Record<ContenuEquipeOptimizer, Record<PorteeLead, ActiviteLead>>;

// Compatible avec appliquerCriteres ; tout « aucun » porte sa raison.
export type LeadMembreOptimizer = Exclude<LeadEffectifOptimizer, { type: 'aucun' }> | { type: 'aucun'; motif: string };
const aucun = (motif: string): LeadMembreOptimizer => ({ type: 'aucun', motif });
const memeMembre = (a: ExclusionSelector, b: ExclusionSelector): boolean => exclusionSelectorKey(a) === exclusionSelectorKey(b);

export function leadEffectifMembreOptimizer(
  teams: readonly EquipeOptimizer[], listId: string, selector: ExclusionSelector, element: ElementKey
): LeadMembreOptimizer {
  const equipe = teams.find(e => e.listId === listId && e.members.some(s => memeMembre(s, selector)));
  if (!equipe) return { type: 'personnel' };
  const lead = equipe.lead;
  if (!lead) return aucun('L’équipe ne porte aucun lead.');
  const ligne = ACTIVITE_LEADS_OPTIMIZER[equipe.contenu] as Record<string, ActiviteLead> | undefined;
  const activite = ligne && Object.prototype.hasOwnProperty.call(ligne, lead.area) ? ligne[lead.area] : undefined;
  if (!activite || activite === 'sans-source') return aucun('L’activité de cette portée de lead n’est pas établie pour ce contenu.');
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
  contenu?: ContenuEquipeOptimizer;
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
  const equipe: EquipeOptimizer = { ...creation, lead: creation.lead ?? null, contenu: creation.contenu ?? 'siege' };
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
  if (!contexte.teams.some(e => e.id === equipeId)) return { teams: contexte.teams, rapport: ['Équipe introuvable : aucun membre ajouté.'] };
  return accepterEquipes(contexte, contexte.teams.map(e => e.id === equipeId ? { ...e, members: [...e.members, selector] } : e));
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
