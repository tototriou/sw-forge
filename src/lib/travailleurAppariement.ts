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

import { cederLaMain } from './cession';
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

/** Le résultat d'un morceau jamais commencé, rendu après un arrêt (`validationTypee` : celle du Worker). */
export function resultatVide(morceau: Morceau, validationTypee: boolean): ResultatMorceau {
  return {
    type: 'resultat', id: morceau.id, traitees: 0, visitees: 0, candidats: [], positions: [], visitesAuCandidat: [],
    ameliorations: [], issue: 'arret', validationTypee, compteurs: compteursVides(),
  };
}

// Rendre la main à la boucle d'événements : un message de canal, non bridé à
// 4 ms contrairement à des `setTimeout(0)` enchaînés (voir cession.ts).
const cederParDefaut = () => cederLaMain();

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
      // ⚠️ La tranche court d'un morceau au SUIVANT : son chrono ne repart
      // qu'après avoir rendu la main, jamais à l'entrée d'un morceau, et le
      // temps se teste avant chaque ligne, première ligne d'un morceau
      // comprise. Un message (l'arrêt) est donc lu au plus `trancheMs` plus
      // une ligne après son arrivée, même quand des morceaux s'enchaînent.
      // Le test est synchrone : on n'attend (`await`) que pour céder, jamais
      // une fois par ligne.
      let debut = maintenant();
      const expiree = () => maintenant() - debut > trancheMs;
      while (enAttente.length > 0) {
        const morceau = enAttente.shift()!;
        if (expiree()) {
          await ceder();
          debut = maintenant();
        }
        if (arrete) {
          envoyer(resultatVide(morceau, contexte?.validation != null));
          continue;
        }
        if (!contexte) throw new Error('Worker d’appariement : morceau reçu avant l’initialisation');
        const gen = parcourirMorceau(contexte, morceau);
        let step = gen.next(false);
        while (!step.done) {
          if (expiree()) {
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
