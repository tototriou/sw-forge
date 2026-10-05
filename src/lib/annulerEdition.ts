// « Annuler les modifications » d'une recommandation ou d'un deck en édition
// (Thomas, 2026-10-05) — spec/siege/recommandations.md § Trois niveaux
// d'édition.
//
// Une édition enregistre chaque modification TOUT DE SUITE : annuler, c'est
// donc remettre ce qu'on avait mémorisé à l'ouverture de l'édition. Ce module
// dit QUOI mémoriser et COMMENT le remettre ; l'écran dit QUAND.

import type { Reco, RecoDeck } from '../types';

// Ce qu'une édition de DECK modifie : ses consignes et ses monstres (avec
// leurs sets, artéfacts et stats). ⚠️ **Pas les défenses visées** (« Fort
// contre ») : elles ont leur propre édition, volontairement détachée de celle
// du deck — annuler l'une ne doit pas défaire l'autre.
export type ContenuDeck = Pick<RecoDeck, 'name' | 'note' | 'slots'>;

// Ce qu'une édition de RECOMMANDATION modifie : nom, auteur, consignes
// générales. Les decks ajoutés pendant l'édition restent (on les retire avec
// « Supprimer ce deck »).
export type MetaReco = Pick<Reco, 'name' | 'author' | 'note'>;

export const contenuDeck = (d: RecoDeck): ContenuDeck => ({ name: d.name, note: d.note, slots: d.slots });

export const metaReco = (r: Reco): MetaReco => ({ name: r.name, author: r.author, note: r.note });

// Comparaison par valeur. ⚠️ Pas par référence : remettre une valeur puis la
// réécrire à l'identique (vider un champ et retaper le même chiffre) n'est pas
// une modification — « Annuler » resterait sinon actif pour rien.
export const memeContenu = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// La recommandation, avec le contenu du deck `deck` remis. Les défenses
// visées de ce deck sont gardées telles qu'elles sont MAINTENANT.
export function avecContenuDeck(reco: Reco, deck: number, contenu: ContenuDeck): Reco {
  return { ...reco, decks: reco.decks.map((d, i) => (i === deck ? { ...d, ...contenu } : d)) };
}

// Le deck en édition après un changement du NOMBRE de decks. ⚠️ Un deck
// retiré ou remis en place décale les index : le numéro mémorisé désignerait
// un autre deck, et « Annuler » y recopierait le contenu d'un autre. Seul cas
// sûr : on vient d'AJOUTER un deck en fin de liste et c'est lui qu'on édite
// (« Ajouter un deck vide », « Importer un deck d'offense »). Sinon l'édition
// se termine, modifications gardées — comme avec ✓.
export function deckEditeApresChangement(edite: number | null, avant: number, apres: number): number | null {
  if (edite == null || avant === apres) return edite;
  return apres > avant && edite === apres - 1 ? edite : null;
}
