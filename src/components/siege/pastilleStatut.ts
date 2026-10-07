import type { StatutEquipe } from '../../lib/siegeStatut';

// La PASTILLE de statut d'une équipe de siège, écrite à côté de son titre, à
// la place d'un point de couleur ou d'un fond coloré : le statut y est ÉCRIT.
//
// ⚠️ **Des libellés tirés des phrases de l'app**, jamais inventés : choisis
// parmi les phrases que le pied de la carte affiche déjà
// (« Tous au tick », « Speed tune validé », « Ton équipe n'est pas au tick »…).
// La phrase détaillée reste dans le pied : la pastille dit l'état d'un coup
// d'œil, le pied dit quoi faire.
//
// Affichage seulement — le statut lui-même se décide dans `lib/siegeStatut`,
// où chaque cas est testé. Ce module ne fait que le NOMMER.

export type TonPastille = 'good' | 'warn' | 'bad';

export interface EntreePastille {
  statut: StatutEquipe;
  // L'utilisateur a validé l'écart à la main (« Valider le tick / speed tune »).
  validee: boolean;
  // Au moins un set Rapidité : l'équipe se juge au speed tune.
  swift: boolean;
  // Un monstre de l'équipe n'a pas tout son équipement (plus urgent que tout).
  manqueRunes: boolean;
  manqueArtes: boolean;
}

export function pastilleStatut(e: EntreePastille): { libelle: string; ton: TonPastille } | null {
  // L'équipement d'abord, comme dans le pied : c'est le défaut le plus urgent.
  // ⚠️ « Artéfacts incomplets » quand il ne manque QUE des artéfacts : « Runes
  // incomplètes » y serait faux.
  if (e.manqueRunes) return { libelle: 'Runes incomplètes', ton: 'bad' };
  if (e.manqueArtes) return { libelle: 'Artéfacts incomplets', ton: 'bad' };
  switch (e.statut) {
    case 'rouge':
      return { libelle: 'Pas au tick', ton: 'bad' };
    case 'orange':
      return { libelle: 'À vérifier', ton: 'warn' };
    case 'vert':
      if (e.validee) return { libelle: e.swift ? 'Speed tune validé' : 'Tick validé', ton: 'good' };
      return { libelle: e.swift ? 'Speed tune' : 'Tous au tick', ton: 'good' };
    default:
      return null;
  }
}
