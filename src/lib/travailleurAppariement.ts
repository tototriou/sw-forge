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
import { BuildCandidate } from './runeBuildOptim';
import { SortieCandidats, creerColonnesCandidats, tamponsCandidats } from './candidatsCompacts';
import {
  AvancementMorceau,
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

export type MessageVersTravailleur = { type: 'init'; init: InitTravailleur } | Morceau | { type: 'arret' } | { type: 'credit' };

export function tamponsResultatMorceau(r: ResultatMorceau<SortieCandidats>): ArrayBuffer[] {
  if (Array.isArray(r.candidats)) return [];
  return [...tamponsCandidats(r.candidats.blocs), (r.positions as Float64Array).buffer as ArrayBuffer, (r.visitesAuCandidat as Float64Array).buffer as ArrayBuffer];
}

/** Le résultat d'un morceau jamais commencé, rendu après un arrêt (`validationTypee` : celle du Worker). */
export function resultatVide<C extends SortieCandidats = BuildCandidate[]>(morceau: Morceau, validationTypee: boolean, candidats: C = [] as unknown as C): ResultatMorceau<C> {
  return {
    type: 'resultat', id: morceau.id, traitees: 0, visitees: 0, candidats, positions: Array.isArray(candidats) ? [] : new Float64Array(0), visitesAuCandidat: Array.isArray(candidats) ? [] : new Float64Array(0),
    ameliorations: [], issue: 'arret', validationTypee, compteurs: compteursVides(),
  };
}

// Rendre la main à la boucle d'événements : un message de canal, non bridé à
// 4 ms contrairement à des `setTimeout(0)` enchaînés (voir cession.ts).
const cederParDefaut = () => cederLaMain();

/**
 * Le serveur d'un Worker : `recevoir(message)` pour chaque message entrant ;
 * `envoyer` reçoit les blocs puis le bilan de chaque morceau, dans l'ordre de réception.
 * `avancer`, s'il est fourni, reçoit l'avancement du morceau en cours à
 * chaque fin de tranche où il a changé, avant de rendre la main : il ne
 * demande aucun crédit et précède le bilan de son morceau.
 * Une exception (initialisation, morceau) remonte par la promesse rejetée de
 * `recevoir` : la coquille la laisse échapper, son `onerror` la porte au
 * coordinateur.
 */
export function servirAppariement<C extends SortieCandidats = BuildCandidate[]>(
  envoyer: (resultat: ResultatMorceau<C>) => void,
  options: { trancheMs?: number; ceder?: () => Promise<void>; maintenant?: () => number; avancer?: (avancement: AvancementMorceau) => void } = {}
): { recevoir: (message: MessageVersTravailleur) => Promise<void> } {
  const trancheMs = options.trancheMs ?? TRANCHE_MS;
  const avancer = options.avancer;
  const ceder = options.ceder ?? cederParDefaut;
  const maintenant = options.maintenant ?? Date.now;
  let contexte: ContexteTravailleur | null = null;
  let arrete = false;
  const enAttente: Morceau[] = [];
  let enCours = false;
  let compact = false;
  let rendreCredit: (() => void) | null = null;
  const transmettre = async (r: ResultatMorceau<C>) => {
    if (!compact) { envoyer(r); return; }
    // Installer l'attente avant l'envoi : un lanceur de test peut acquitter immédiatement.
    const credit = new Promise<void>((resolve) => { rendreCredit = resolve; });
    envoyer(r);
    await credit;
  };

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
          await transmettre(resultatVide(morceau, contexte?.validation != null, (compact ? creerColonnesCandidats() : []) as C));
          continue;
        }
        if (!contexte) throw new Error('Worker d’appariement : morceau reçu avant l’initialisation');
        const suivi = { traitees: 0 };
        let signale = 0;
        const gen = parcourirMorceau(contexte, morceau, (compact ? creerColonnesCandidats() : []) as C, avancer ? suivi : undefined);
        let step = gen.next(false);
        while (!step.done) {
          if (step.value) await transmettre(step.value);
          if (expiree()) {
            if (avancer && suivi.traitees > signale) {
              signale = suivi.traitees;
              avancer({ type: 'avancement', id: morceau.id, traitees: signale });
            }
            await ceder();
            debut = maintenant();
          }
          step = gen.next(arrete);
        }
        await transmettre(step.value);
      }
    } finally {
      enCours = false;
    }
  };

  return {
    recevoir: async (message) => {
      if (message.type === 'init') {
        compact = message.init.collecteCompacte === true;
        contexte = initialiserTravailleur(message.init);
        return;
      }
      if (message.type === 'arret') {
        arrete = true;
        return;
      }
      if (message.type === 'credit') {
        const rendre = rendreCredit;
        rendreCredit = null;
        rendre?.();
        return;
      }
      enAttente.push(message);
      await traiter();
    },
  };
}
