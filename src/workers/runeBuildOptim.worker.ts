/// <reference lib="webworker" />
// Premier Worker de l'app. Le calcul lui-même (pur, sans React) vit dans
// lib/runeBuildOptim.ts et reste réutilisable dans les tests sans passer par
// un Worker. Voir docs/02-app/compte/ §6 (Perf).
//
// ⚠️ Orchestre prepareSearch → lancerConstruction (pool commun de tranches,
// buildHalf.worker.ts) → l'appariement sur colonnes. Le nombre de Workers
// suit la règle des cœurs pour toutes les moitiés et tous les crans, sans
// se multiplier par le nombre de préréglages. Voir docs/03-developpeur/optimizer/moteur/pipeline.md
// § Construction des moitiés. L'appariement séquentiel (`apparier`) est piloté
// PAS À PAS dans CE Worker : c'est ce qui permet de rendre la main à la
// boucle d'évènements entre deux points de passage, condition nécessaire pour
// qu'un message d'arrêt envoyé pendant que la recherche tourne soit reçu et
// traité. Au-delà du seuil, l'appariement parallèle
// (`apparierRapideEnParallele`) attend des Workers enfants, et la main revient
// d'elle-même entre deux messages.

import { PreparedSearch, SearchParams, SearchResult } from '../lib/runeBuildOptim';
import { BlocCandidats, ColonnesCandidats, creerColonnesCandidats } from '../lib/candidatsCompacts';
import { CompartimentType } from '../lib/demiBuildsTypes';
import { RelicVide } from '../lib/relicOptim';
import { compterPaires, verifierContrat } from '../lib/appariementRapide';
import {
  ErreurAppariementParallele, PoigneeTravailleur, erreurDeWorkerEnfant, resultatApresErreur, type LancerTravailleur,
} from '../lib/appariementRapideParallele';
import { BuildHalfRequest, BuildHalfResponse } from './buildHalf.worker';
import { lancerConstruction, TravailleurConstruction } from '../lib/constructionEmboitee';
import { MessageVersAppariement } from './appariementRapide.worker';
import { nombreDeTravailleurs, regimeAppariement } from './parallelPairing';
import { EmetteurCandidats, lancerAppariement, PROGRESS_THROTTLE_MS } from './pairingDriver';
import { prepareOrRefuse } from './prepareForSearch';

// La demande d'une recherche : ses paramètres, et ce que la page sait de la
// machine et que ce Worker ne peut pas lire lui-même — les cœurs physiques,
// que seule l'application de bureau connaît (`coeursPhysiques`,
// src/lib/bureau.ts), `null` ailleurs ; le nombre de Workers d'appariement en
// dérive (`nombreDeTravailleurs`). ⚠️ Obligatoire : un constructeur qui
// l'oublierait ne compile pas.
export interface DemandeDeRecherche {
  type: 'recherche';
  params: SearchParams;
  coeursPhysiques: number | null;
}
export type WorkerRequest = DemandeDeRecherche | { stop: true } | { credit: true };

// ⚠️ Deux formes, comme `SearchProgress` côté moteur (voir son commentaire) :
// la construction des compartiments (`phase: 'building'`) peut à elle seule
// prendre jusqu'à environ une minute sur un compte réel avec beaucoup de
// conditions à la fois, ENTIÈREMENT AVANT que `phase: 'pairing'` (l'ancien
// comportement, inchangé) ne commence — sans cette distinction, l'UI n'avait
// aucune information pendant cette phase (voir docs/03-developpeur/optimizer/
// § Construction des moitiés).
export interface WorkerBuildingMessage {
  type: 'progress';
  phase: 'building';
  half: 'A' | 'B';
  scanned: number;
  total: number;
  pct: number; // 0..1, approximatif — voir `estimatePct`
}
export interface WorkerPairingMessage {
  type: 'progress';
  phase: 'pairing';
  explored: number;
  found: number;
  pct: number; // 0..1, approximatif — voir `estimatePct`
  // Taille RÉELLE de l'espace de recherche à épuiser (voir
  // `totalPairCount`) — CONSTANTE pour toute la phase d'appariement (les
  // deux moitiés sont déjà construites), et EXACTE : c'est le nombre de
  // paires que l'appariement parcourra s'il va au bout. Depuis la
  // suppression du budget de nœuds, c'est le seul dénominateur
  // que le Worker ait à transmettre.
  totalPairs: number;
}
export type WorkerProgressMessage = WorkerBuildingMessage | WorkerPairingMessage;
export type WorkerResultMessage = { type: 'result'; nombre: number } & Omit<SearchResult, 'candidates'>;
export type WorkerCandidatsMessage = { type: 'candidats'; bloc: BlocCandidats };
// Refus NOMMÉ (pool de reliques vide en mode `recherche`) — jamais un
// `result` vide qui se présenterait comme « 0 build ». `useBuildOptimSearch.ts` le distingue de
// `error` par un statut propre (`'refused'`).
export interface WorkerRefusMessage {
  type: 'refus';
  motif: 'relique-pool-vide';
  vide: RelicVide;
}
export interface WorkerErrorMessage {
  type: 'error';
  message: string;
}
export type WorkerResponse = WorkerProgressMessage | WorkerResultMessage | WorkerCandidatsMessage | WorkerRefusMessage | WorkerErrorMessage;

// Barre de progression, pas une roue qui tourne : approxime « à quel point on
// approche d'un arrêt » en prenant le plus avancé des trois budgets qui
// peuvent chacun déclencher la fin de la recherche (le premier atteint
// l'arrête, donc c'est LUI qui compte). ⚠️ Approximatif par nature — le
// meet-in-the-middle ne consomme pas ces budgets à un rythme constant d'une
// recherche à l'autre, donc la barre peut accélérer ou ralentir en cours de
// route plutôt que progresser régulièrement.
// ⚠️ Contre `totalPairs` (l'espace RÉEL à épuiser, voir `totalPairCount`) —
// c'était DÉJÀ le cas quand un plafond de nœuds existait encore à côté (il
// grandissait avec l'escalade et n'avait plus grand-chose à voir avec la
// taille réelle du travail restant, voir docs/02-app/optimizer/
// § Barre de progression) ; ce choix de l'interface est l'un des arguments qui
// ont mené à sa suppression. Affiché à
// l'écran comme `X / totalPairs`, cohérent avec la ligne « Espace de
// recherche à épuiser » juste en dessous : les DEUX doivent montrer le
// MÊME dénominateur, sous peine de désaccord visible entre deux lignes
// voisines du même écran.
function estimatePct(prepared: PreparedSearch, totalPairs: number, explored: number, found: number, elapsedMs: number): number {
  const ratios = [
    totalPairs > 0 ? explored / totalPairs : 0,
    found / prepared.maxCollected,
    Number.isFinite(prepared.maxMs) ? elapsedMs / prepared.maxMs : 0,
  ];
  return Math.min(1, Math.max(0, ...ratios));
}

let stopped = false;
// Workers enfants EN COURS (phase de construction des moitiés uniquement) —
// vidé dès qu'on en sort, dans un sens ou dans l'autre. Un arrêt manuel
// PENDANT cette phase les tue directement (`terminate()`, instantané) plutôt
// que d'attendre une coopération qu'ils n'ont pas (voir buildHalf.worker.ts).
let activeHalfWorkers: Worker[] = [];
// Termine tous les Workers de moitié encore en vol : à l'arrêt manuel, et à la
// sortie de la construction quelle qu'en soit l'issue — sur l'erreur de l'un,
// ses frères (jusqu'à 7, préréglages emboîtés) ne doivent pas continuer à
// tourner pour une recherche déjà rendue.
function terminerMoitiesEnCours() {
  for (const w of activeHalfWorkers) w.terminate();
  activeHalfWorkers = [];
}
// Rejette la promesse qui attend les deux moitiés, pour qu'un arrêt pendant
// cette phase fasse sortir `await` immédiatement plutôt que de rester
// bloqué indéfiniment (les Workers tués ne posteront plus jamais de message).
let stopBuildReject: (() => void) | null = null;
// L'arrêt COOPÉRATIF de l'appariement parallèle en cours, reçu du
// coordinateur (`surControle`) — contrairement à `activeHalfWorkers`, un arrêt
// manuel ici ne termine rien : le coordinateur cesse de distribuer des
// morceaux, demande à chaque Worker d'arrêter le sien à sa ligne suivante,
// attend leurs réponses et rend tout ce qui a été trouvé, comme un
// arrêt en phase séquentielle (« garde le meilleur trouvé jusque-là »).
let arreterAppariement: (() => void) | null = null;
let emetteur: EmetteurCandidats | null = null;

// Lanceur de plateforme passé à `apparierRapideEnParallele` — la SEULE partie
// du chemin parallèle qui reste liée à Vite/navigateur (`new Worker(new
// URL(...))`). Son pendant Node : `lancerTravailleurNode`
// (scripts/lib/appariementRapideNode.ts). L'initialisation part en premier,
// ses tableaux typés transférés ; l'ordre des messages garantit qu'elle
// précède tout morceau.
const lancerTravailleurNavigateur: LancerTravailleur<ColonnesCandidats> = (init, transfert): PoigneeTravailleur<ColonnesCandidats> => {
  const worker = new Worker(new URL('./appariementRapide.worker.ts', import.meta.url), { type: 'module' });
  const message: MessageVersAppariement = { type: 'init', init };
  worker.postMessage(message, transfert);
  return {
    envoyer: (morceau, t) => worker.postMessage(morceau, t),
    acquitter: () => worker.postMessage({ type: 'credit' }),
    surMessage: (rappel) => {
      worker.onmessage = (e) => rappel(e.data);
    },
    surErreur: (rappel) => {
      // ⚠️ L'événement est annulé (voir `erreurDeWorkerEnfant`) : il ne doit
      // pas remonter au hook, le coordinateur rend ce qui a été trouvé.
      worker.onerror = erreurDeWorkerEnfant(rappel);
      worker.onmessageerror = (e) => rappel(e);
    },
    arreter: () => {
      const arret: MessageVersAppariement = { type: 'arret' };
      worker.postMessage(arret);
    },
    terminer: () => worker.terminate(),
  };
};

function creerTravailleurConstruction(): TravailleurConstruction {
  const worker = new Worker(new URL('./buildHalf.worker.ts', import.meta.url), { type: 'module' });
  activeHalfWorkers.push(worker);
  return {
    construire: (request: BuildHalfRequest, onProgress) => new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<BuildHalfResponse>) => {
        if (e.data.type === 'progress') onProgress(e.data.scanned);
        else resolve(e.data.resultat);
      };
      worker.onerror = (err) => { err.preventDefault(); reject(err); };
      worker.onmessageerror = () => reject(new Error('Réponse de construction illisible.'));
      worker.postMessage(request);
    }),
    terminer: () => {
      worker.terminate();
      activeHalfWorkers = activeHalfWorkers.filter((w) => w !== worker);
    },
  };
}

async function traiterMessage(e: MessageEvent<WorkerRequest>) {
  if ('credit' in e.data) { emetteur?.acquitter(); return; }
  if ('stop' in e.data) {
    stopped = true;
    terminerMoitiesEnCours();
    if (stopBuildReject) stopBuildReject();
    arreterAppariement?.();
    return;
  }
  stopped = false;
  const { params, coeursPhysiques } = e.data;
  const startedAt = Date.now();
  const flux = new EmetteurCandidats((bloc, transfert) => {
    const message: WorkerCandidatsMessage = { type: 'candidats', bloc };
    (self as unknown as Worker).postMessage(message, transfert);
  });
  emetteur = flux;
  const posterResultat = async (r: SearchResult<ColonnesCandidats>) => {
    const nombre = await flux.sceller(r.candidates);
    const message: WorkerResultMessage = { type: 'result', nombre, explored: r.explored, truncated: r.truncated,
      nearMissByCondition: r.nearMissByCondition, globalNearMiss: r.globalNearMiss };
    (self as unknown as Worker).postMessage(message);
  };

  // ⚠️ `prepareSearch` peut lever `RechercheRefusee` (pool de reliques vide
  // en mode `recherche`) — jamais un simple appel direct ICI : un rejet
  // dans un handler `async self.onmessage` non intercepté ne déclenche NI
  // réponse du Worker NI `Worker.onerror` côté parent (piège JS/navigateur
  // réel) — l'UI restait
  // bloquée en `'running'` indéfiniment. `prepareOrRefuse` (module neutre,
  // testable en Node sans `self`) convertit refus et erreur en résultats
  // NOMMÉS plutôt que de laisser échapper l'exception.
  const outcome = prepareOrRefuse(params);
  if (outcome.kind === 'refus') {
    const refus: WorkerRefusMessage = { type: 'refus', motif: outcome.motif, vide: outcome.vide };
    (self as unknown as Worker).postMessage(refus);
    return;
  }
  if (outcome.kind === 'error') {
    const error: WorkerErrorMessage = { type: 'error', message: outcome.message };
    (self as unknown as Worker).postMessage(error);
    return;
  }
  if (outcome.kind === 'empty') {
    await posterResultat({ candidates: creerColonnesCandidats(), explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null });
    return;
  }
  const prepared = outcome.prepared;

  // Moitiés indépendantes : seules les bornes de la préparation sont lues.
  // Le pool commun construit leurs tranches avant toute paire examinée.
  let bucketsA: CompartimentType[];
  let bucketsB: CompartimentType[];
  try {
    // ⚠️ Pas de throttle ICI (contrairement à la phase d'appariement plus
    // bas) : chacun des Workers enfants (buildHalf.worker.ts) throttle
    // déjà SES PROPRES messages indépendamment — un throttle commun aux DEUX
    // moitiés ferait courir le message de l'une contre celui de l'autre (un
    // message de A qui arrive juste après un de B ferait sauter celui de B,
    // et vice-versa), aggravant le risque qu'aucun des deux ne semble jamais
    // atteindre 100 % — voir le point de passage final garanti dans
    // buildHalf.worker.ts. Relayer sans throttle supplémentaire reste sûr :
    // le débit combiné du pool (2 à 8 Workers, chacun ≤ ~1 message/150ms
    // hors changements de tâche) reste borné. Le compte somme les tranches.
    const postBuildProgress = (half: 'A' | 'B', scanned: number, total: number) => {
      const message: WorkerBuildingMessage = { type: 'progress', phase: 'building', half, scanned, total, pct: total > 0 ? scanned / total : 0 };
      (self as unknown as Worker).postMessage(message);
    };
    const abortPromise = new Promise<never>((_, reject) => {
      stopBuildReject = () => reject(new Error('stopped'));
    });
    // Même lanceur que les outils : tranches, fusion typée, union ordonnée.
    ({ bucketsA, bucketsB } = await lancerConstruction(prepared, params.combosOrderMode, {
      concurrence: navigator.hardwareConcurrency, coeursPhysiques,
      creer: creerTravailleurConstruction, progression: postBuildProgress, annulation: abortPromise,
    }));
  } catch {
    // Arrêt manuel pendant la construction, ou erreur d'un Worker de moitié :
    // rien n'existe encore à ressortir (aucune paire n'a pu être évaluée) — un
    // résultat vide, tronqué, est le seul choix honnête, même comportement que
    // l'ancien code pour `phase: 'building'`.
    await posterResultat({ candidates: creerColonnesCandidats(), explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null });
    return;
  } finally {
    stopBuildReject = null;
    // L'arrêt externe peut avoir terminé les enfants avant le finally du lanceur.
    terminerMoitiesEnCours();
  }
  if (stopped) {
    await posterResultat({ candidates: creerColonnesCandidats(), explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null });
    return;
  }

  // Taille RÉELLE de l'espace à épuiser (voir `totalPairCount`) — calculée
  // UNE SEULE FOIS, maintenant que les deux moitiés sont construites (avant
  // ça, seule l'estimation brute pré-recherche, `estimateSearchSpace`,
  // existe). Les prédicats de ligne lisent chaque demi-build A pour chaque
  // paire de compartiments ouverte, jamais le produit des demi-builds A × B.
  const totalPairs = compterPaires(prepared, bucketsA, bucketsB);

  // Le régime (parallelPairing.ts) : parallèle à partir du seuil, séquentiel
  // en dessous ET hors contrat numérique du noyau, où `apparier` parcourt
  // les colonnes sans saut — le coordinateur parallèle, lui, n'a
  // pas de repli.
  {
    const regime = regimeAppariement(totalPairs, verifierContrat(prepared, bucketsA, bucketsB));
    let dernierMessage = 0;
    const postProgress = async (explored: number, candidats: ColonnesCandidats) => {
      const now = Date.now();
      // drivePairing espace déjà le séquentiel, vidages de blocs compris.
      if (regime === 'parallele' && now - dernierMessage <= PROGRESS_THROTTLE_MS) return;
      dernierMessage = now;
      const message: WorkerPairingMessage = {
        type: 'progress',
        phase: 'pairing',
        explored,
        found: candidats.length,
        pct: estimatePct(prepared, totalPairs, explored, candidats.length, now - startedAt),
        totalPairs,
      };
      (self as unknown as Worker).postMessage(message);
    };
    // ⚠️ `try/catch` à ne pas retirer, comme pour la phase de construction
    // juste au-dessus : sur l'erreur d'un Worker enfant, le coordinateur
    // termine tous les Workers puis rejette, et une rejection NON interceptée
    // dans un handler `async self.onmessage` ne remonte PAS via
    // `Worker.onerror` au parent — sans ce `catch`, aucun message `result`/
    // `error` ne serait posté, l'UI resterait bloquée en `'running'`. Le rejet
    // porte ce qui a été fusionné avant l'erreur (`resultatApresErreur`) :
    // l'écran garde les candidats déjà montrés, et l'erreur est journalisée.
    let resultatFinal: SearchResult<ColonnesCandidats>;
    try {
      const { resultat } = await lancerAppariement({
        collecte: creerColonnesCandidats(),
        regime, flux,
        estArrete: () => stopped,
        params, prepared, bucketsA, bucketsB, totalPaires: totalPairs,
        travailleurs: nombreDeTravailleurs(self.navigator?.hardwareConcurrency, coeursPhysiques),
        lancer: lancerTravailleurNavigateur, startedAt,
        surControle: (controle) => {
          arreterAppariement = controle.arreter;
        },
        surProgression: postProgress,
      });
      resultatFinal = resultat;
    } catch (erreur) {
      if (!(erreur instanceof ErreurAppariementParallele)) throw erreur;
      console.error('Appariement parallèle interrompu par une erreur ; résultat rendu tronqué, avec ce qui a été fusionné :', erreur);
      resultatFinal = resultatApresErreur(erreur, creerColonnesCandidats());
    } finally {
      arreterAppariement = null;
    }
    await posterResultat(resultatFinal);
    return;
  }

}

// Une promesse rejetée par onmessage ne déclenche pas onerror chez le parent.
// Cette garde couvre aussi posterResultat, y compris depuis un rattrapage de panne.
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  void traiterMessage(e).catch((erreur: unknown) => {
    stopped = true;
    terminerMoitiesEnCours();
    stopBuildReject?.();
    arreterAppariement?.();
    console.error('Recherche de runes interrompue :', erreur);
    const message: WorkerErrorMessage = { type: 'error', message: erreur instanceof Error ? erreur.message : String(erreur) };
    (self as unknown as Worker).postMessage(message);
  });
};
