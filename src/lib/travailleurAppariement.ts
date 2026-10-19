// Ce que fait un Worker de l'appariement parallèle, sans aucune API de
// messagerie : les deux coquilles (src/workers/appariementRapide.worker.ts au
// navigateur, scripts/lib/appariement-rapide-worker.ts sous Node) ne font que
// lui passer les messages reçus et poster ce qu'il rend. Neutre : ni `self`,
// ni `worker_threads`.
//
// Pourquoi un serveur plutôt qu'un appel de `traiterMorceau` par message : un
// Worker ne lit aucun message pendant qu'il calcule. Pour que l'arrêt manuel
// lui parvienne en cours de morceau, il travaille par TRANCHES de
// `TRANCHE_MS` et rend la main à sa boucle d'événements entre deux ; un
// `arret` reçu entre-temps termine le morceau en cours (rendu avec ce qu'il a
// trouvé) et répond aussitôt, sans rien calculer, aux morceaux en attente.
// Voir docs/03-developpeur/optimizer/moteur/parallelisation.md.

import {
  ContexteTravailleur,
  InitTravailleur,
  Morceau,
  ResultatMorceau,
  compteursVides,
  initialiserTravailleur,
  parcourirMorceau,
} from './appariementRapide';

/** Travail continu d'un Worker entre deux lectures de ses messages, en millisecondes. */
export const TRANCHE_MS = 100;

export type MessageVersTravailleur = { type: 'init'; init: InitTravailleur } | Morceau | { type: 'arret' };

/** Le résultat d'un morceau jamais commencé, rendu après un arrêt. */
export function resultatVide(morceau: Morceau): ResultatMorceau {
  return {
    type: 'resultat', id: morceau.id, traitees: 0, visitees: 0, candidats: [], positions: [], visitesAuCandidat: [],
    ameliorations: [], issue: 'arret', compteurs: compteursVides(),
  };
}

// Rendre la main à la boucle d'événements : un minuteur nul, que les deux
// plateformes ont et qui laisse passer un message déjà arrivé.
const cederParDefaut = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Le serveur d'un Worker : `recevoir(message)` pour chaque message entrant ;
 * `envoyer` reçoit chaque résultat, un par morceau, dans l'ordre de réception.
 * Une exception (initialisation, morceau) remonte par la promesse rejetée de
 * `recevoir` : la coquille la laisse échapper, son `onerror` la porte au
 * coordinateur.
 */
export function servirAppariement(
  envoyer: (resultat: ResultatMorceau) => void,
  options: { trancheMs?: number; ceder?: () => Promise<void>; maintenant?: () => number } = {}
): { recevoir: (message: MessageVersTravailleur) => Promise<void> } {
  const trancheMs = options.trancheMs ?? TRANCHE_MS;
  const ceder = options.ceder ?? cederParDefaut;
  const maintenant = options.maintenant ?? Date.now;
  let contexte: ContexteTravailleur | null = null;
  let arrete = false;
  const enAttente: Morceau[] = [];
  let enCours = false;

  const traiter = async (): Promise<void> => {
    if (enCours) return;
    enCours = true;
    try {
      while (enAttente.length > 0) {
        const morceau = enAttente.shift()!;
        if (arrete) {
          envoyer(resultatVide(morceau));
          continue;
        }
        if (!contexte) throw new Error('Worker d’appariement : morceau reçu avant l’initialisation');
        const gen = parcourirMorceau(contexte, morceau);
        let debut = maintenant();
        let step = gen.next(false);
        while (!step.done) {
          if (maintenant() - debut > trancheMs) {
            await ceder();
            debut = maintenant();
          }
          step = gen.next(arrete);
        }
        envoyer(step.value);
      }
    } finally {
      enCours = false;
    }
  };

  return {
    recevoir: async (message) => {
      if (message.type === 'init') {
        contexte = initialiserTravailleur(message.init);
        return;
      }
      if (message.type === 'arret') {
        arrete = true;
        return;
      }
      enAttente.push(message);
      await traiter();
    },
  };
}
