// L'appariement PARALLÈLE de production : répartition À LA DEMANDE du noyau
// `appariementRapide.ts` entre plusieurs Workers (navigateur :
// `src/workers/appariementRapide.worker.ts` ; Node :
// `scripts/lib/appariement-rapide-worker.ts`), à partir du seuil et avec le
// nombre de Workers de `src/workers/parallelPairing.ts`. Neutre : le
// lancement d'un Worker est INJECTÉ (`LancerTravailleur`), ce module
// n'importe ni `worker_threads` ni `self`.
// Voir docs/03-developpeur/optimizer/moteur/parallelisation.md.
//
// Le coordinateur énumère les LIGNES (un comboA ouvert face à un compartiment
// B ouvert) dans l'ordre exact de `pairBuckets`, avec les prédicats de
// production, et les groupe en MORCEAUX contigus plus fins que les
// compartiments. Chaque Worker reçoit les tableaux typés une seule fois
// (transférés), puis des morceaux à la demande.
//
// ⚠️ **La fusion se fait dans l'ORDRE DES MORCEAUX**, donc dans l'ordre
// séquentiel : le résultat est celui de `pairBuckets` séquentiel, quel que
// soit le nombre de Workers — plafond de candidats GLOBAL compris (aucune
// part du plafond par Worker). Coupé par le temps ou par l'arrêt manuel, il
// en est une SOUS-SUITE, préfixe exact jusqu'au premier morceau coupé : les
// morceaux suivants déjà partis se fusionnent encore. Le quasi-succès
// se rejoue à partir des améliorations de chaque morceau, avec la règle de
// production (remplacé seulement si strictement meilleur) : une tentative qui
// n'améliore pas son propre morceau ne peut pas améliorer l'état global, donc
// le rejeu redonne l'état séquentiel exact.

import { BuildCandidate, NearMiss, PreparedSearch, SearchParams, SearchResult } from './runeBuildOptim';
import { SortieCandidats, fusionnerCandidats } from './candidatsCompacts';
import { Compartiment, lireCombo, nouvelleVueCombo } from './demiBuildsTypes';
import {
  CompteursNoyau,
  EntreeQuasiSucces,
  InitTravailleur,
  Morceau,
  ResultatAppariementRapide,
  ResultatMorceau,
  comboAOuvert,
  compteursVides,
  copierCompartiments,
  encoderCompartiments,
  ordreDesCompartiments,
  paireDeCompartimentsOuverte,
  tamponsDe,
  verifierContrat,
} from './appariementRapide';

/** Un Worker lancé, vu par le coordinateur. */
export interface PoigneeTravailleur<C = BuildCandidate[]> {
  envoyer(message: Morceau, transfert: ArrayBuffer[]): void;
  surMessage(rappel: (message: ResultatMorceau<C>) => void): void;
  acquitter?(): void;
  surErreur(rappel: (erreur: unknown) => void): void;
  /** L'arrêt manuel : le morceau en cours rend ce qu'il a trouvé, les suivants rien (`servirAppariement`). */
  arreter(): void;
  terminer(): void;
}

export type LancerTravailleur<C = BuildCandidate[]> = (init: InitTravailleur, transfert: ArrayBuffer[]) => PoigneeTravailleur<C>;

/** Morceaux visés par Worker (équilibrage à la demande) et plancher de taille, en paires. */
export const MORCEAUX_PAR_TRAVAILLEUR = 64;
export const TAILLE_MIN_MORCEAU = 2_000_000;
/** Morceaux en vol par Worker (le suivant attend déjà quand l'un se termine). */
export const EN_VOL_PAR_TRAVAILLEUR = 2;

export interface ResultatParallele<C = BuildCandidate[]> extends ResultatAppariementRapide<C> {
  /**
   * `arret` : l'arrêt déterministe des tests et du banc ; `manuel` :
   * « Arrêter » ; `erreur` : un Worker a échoué (le résultat ne voyage alors
   * que dans `ErreurAppariementParallele`).
   */
  motif: 'aucun' | 'maxCollected' | 'maxMs' | 'arret' | 'manuel' | 'erreur';
  morceaux: number;
  morceauxTraites: number;
  /** Morceaux traités par Worker : l'équilibrage tel qu'il s'est fait. */
  parTravailleur: number[];
  /** Paires du plus gros morceau (granularité de la répartition). */
  plusGrosMorceau: number;
  msPlanification: number;
}

/**
 * Le message d'une erreur de Worker : `Error`, `ErrorEvent` du navigateur
 * (qui a un `message`), `Event` sans message (`messageerror` : son `type`,
 * jamais « [object Event] »), ou autre chose.
 */
export function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) return erreur.message;
  if (typeof erreur === 'object' && erreur !== null) {
    if ('message' in erreur && typeof erreur.message === 'string' && erreur.message !== '') return erreur.message;
    if ('type' in erreur && typeof erreur.type === 'string') return `événement ${erreur.type}`;
  }
  return String(erreur);
}

/**
 * L'erreur d'un Worker, qui porte ce qui a été fusionné jusque-là
 * (`resultat` : les morceaux contigus reçus avant l'erreur, tronqué, motif
 * `erreur`) : tous les Workers sont terminés, et l'appelant rend ce qui a été
 * trouvé plutôt qu'un résultat vide. Un rejet, pas un résultat : un appelant
 * qui l'ignore échoue au lieu de prendre une recherche en panne pour une
 * recherche coupée.
 */
export class ErreurAppariementParallele<C extends SortieCandidats = BuildCandidate[]> extends Error {
  constructor(
    /** Ce que le Worker a signalé (`ErrorEvent`, `Error`, sortie de code non nul). */
    readonly erreur: unknown,
    readonly resultat: ResultatParallele<C>
  ) {
    super(`un Worker d’appariement a échoué (${messageDe(erreur)}) : ${resultat.candidates.length} candidat(s) fusionné(s) avant l’erreur`);
    this.name = 'ErreurAppariementParallele';
  }
}

/**
 * Le résultat que le Worker principal poste quand l'appariement parallèle
 * lève : ce qui a été fusionné avant l'erreur d'un Worker
 * (`ErreurAppariementParallele`), sinon (refus hors contrat, plan incohérent,
 * levés avant tout Worker) un résultat vide ; tronqué dans les deux cas.
 */
export function resultatApresErreur<C extends SortieCandidats = BuildCandidate[]>(erreur: unknown, vide: C = [] as unknown as C): SearchResult<C> {
  if (erreur instanceof ErreurAppariementParallele) return enResultatDeRecherche((erreur as ErreurAppariementParallele<C>).resultat);
  return { candidates: vide, explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null };
}

/**
 * Le gestionnaire `onerror` d'un Worker enfant au navigateur : il ANNULE
 * l'événement (`preventDefault`) puis le remet au coordinateur. Non annulé,
 * le standard HTML signale l'erreur à nouveau dans la portée qui a créé le
 * Worker — le Worker de recherche —, d'où elle remonterait au `onerror` du
 * hook (statut `error`), en concurrence avec le résultat posté.
 */
export function erreurDeWorkerEnfant(rappel: (erreur: unknown) => void): (evenement: { preventDefault(): void }) => void {
  return (evenement) => {
    evenement.preventDefault();
    rappel(evenement);
  };
}

/**
 * Le plan : les morceaux dans l'ordre de `pairBuckets`. ⚠️ Même énumération
 * que `totalPairCount` (prédicats de production, `comboAFeasible` par comboA) :
 * la somme des tailles vaut `totalPairCount`, le banc le vérifie.
 */
export function planifierMorceaux(prepared: PreparedSearch, bucketsA: Compartiment[], bucketsB: Compartiment[], cible: number): Morceau[] {
  const morceaux: Morceau[] = [];
  let segments: number[] = [];
  let drapeaux: number[] = [];
  let offset = 0;
  let taille = 0;
  const vue = nouvelleVueCombo();
  const fermer = () => {
    if (segments.length === 0) return;
    morceaux.push({
      type: 'morceau', id: morceaux.length, offset, taille,
      segments: Int32Array.from(segments), drapeaux: Uint8Array.from(drapeaux),
    });
    offset += taille;
    taille = 0;
    segments = [];
    drapeaux = [];
  };
  for (const [iA, iB] of ordreDesCompartiments(bucketsA, bucketsB)) {
    const bA = bucketsA[iA];
    const bB = bucketsB[iB];
    if (!paireDeCompartimentsOuverte(prepared, bA, bB)) continue;
    const nB = bB.combos.length;
    let aDebut = 0;
    for (let a = 0; a < bA.combos.length; a++) {
      const ouvert = comboAOuvert(prepared, lireCombo(bA, a, vue), bB);
      drapeaux.push(ouvert ? 1 : 0);
      if (ouvert) taille += nB;
      if (taille >= cible) {
        segments.push(iA, iB, aDebut, a + 1);
        aDebut = a + 1;
        fermer();
      }
    }
    if (aDebut < bA.combos.length) segments.push(iA, iB, aDebut, bA.combos.length);
  }
  fermer();
  // Un dernier morceau peut ne porter que des lignes fermées (taille 0) : sans effet.
  return morceaux;
}

export interface OptionsParallele<C extends SortieCandidats = BuildCandidate[]> {
  collecte?: C;
  params: SearchParams;
  prepared: PreparedSearch;
  bucketsA: Compartiment[];
  bucketsB: Compartiment[];
  /** `totalPairCount` déjà calculé par l'appelant, celui qui a choisi le régime. */
  totalPaires: number;
  travailleurs: number;
  lancer: LancerTravailleur<C>;
  startedAt: number;
  /** Arrêt déterministe : l'état au point de passage `traitees = arretTraitees`. */
  arretTraitees?: number;
  /** Tests seulement : la validation de référence dans chaque Worker. */
  forcerValidation?: 'reference';
  /** Taille visée d'un morceau, en paires (défaut : `totalPaires / (travailleurs × 64)`, au moins 2 M). */
  cibleMorceau?: number;
  /**
   * Rappelé UNE fois, avant tout travail, avec l'arrêt manuel coopératif :
   * plus aucun morceau n'est distribué, chaque Worker arrête le sien à sa
   * prochaine ligne (dans les `TRANCHE_MS` de `servirAppariement`) et répond
   * sans calculer à ceux qui attendent ; tout ce qui revient se fusionne, et
   * le résultat est tronqué (motif `manuel`). Le module ne connaît pas le
   * registre d'arrêt de l'appelant : il le lui donne.
   */
  surControle?: (controle: { arreter: () => void }) => void;
  /**
   * À chaque morceau reçu : les paires traitées et la liste des candidats des
   * morceaux FUSIONNÉS, dans l'ordre séquentiel — les mêmes comptes que le
   * résultat, dont la dernière progression est l'état final. La liste ne fait
   * que grandir : un aperçu en est toujours un préfixe du résultat. À
   * l'appelant d'espacer ses messages et de ne transmettre que les nouveaux.
   */
  surProgression?: (traitees: number, candidats: C) => void | Promise<void>;
}

/**
 * ⚠️ Suppose le contrat numérique tenu (`verifierContrat` nul) : hors
 * contrat, l'appelant apparie en séquentiel (`apparier`, qui retombe sur
 * `pairBuckets` en rendant la main), jamais ici, où un repli synchrone
 * bloquerait l'arrêt et la progression.
 */
export function apparierRapideEnParallele<C extends SortieCandidats>(o: OptionsParallele<C>): Promise<ResultatParallele<C>>;
export function apparierRapideEnParallele(o: OptionsParallele): Promise<ResultatParallele>;
export async function apparierRapideEnParallele<C extends SortieCandidats = BuildCandidate[]>(o: OptionsParallele<C>): Promise<ResultatParallele<C>> {
  const { prepared, bucketsA, bucketsB } = o;
  let arrete = false;
  let surArret: (() => void) | null = null;
  o.surControle?.({
    arreter: () => {
      arrete = true;
      surArret?.();
    },
  });
  const motifContrat = verifierContrat(prepared, bucketsA, bucketsB);
  if (motifContrat) throw new Error(`appariement parallèle hors contrat numérique (${motifContrat}) : l'appelant apparie en séquentiel`);
  const { maxCollected, maxMs } = prepared;
  const overBudget = () => Date.now() - o.startedAt > maxMs;
  const t0 = Date.now();
  const ct = encoderCompartiments(prepared, bucketsA, bucketsB);
  const cible = o.cibleMorceau ?? Math.max(TAILLE_MIN_MORCEAU, Math.ceil(o.totalPaires / (o.travailleurs * MORCEAUX_PAR_TRAVAILLEUR)));
  const plan = planifierMorceaux(prepared, bucketsA, bucketsB, cible);
  const msPlanification = Date.now() - t0;
  const totalPlan = plan.reduce((s, m) => s + m.taille, 0);
  if (totalPlan !== o.totalPaires) throw new Error(`plan de ${totalPlan} paires ≠ totalPairCount ${o.totalPaires}`);
  const arret = o.arretTraitees != null && o.arretTraitees < totalPlan ? o.arretTraitees : undefined;
  // Seuls les morceaux qui contiennent une paire de position < arret servent,
  // et chacun s'arrête de lui-même au point de passage `arret`.
  const aDistribuer = arret == null ? plan : plan.filter((m) => m.offset + 1 < arret).map((m) => ({ ...m, limite: arret }));

  const resultats: ({ r: ResultatMorceau<C>; w: number } | undefined)[] = new Array(aDistribuer.length);
  const parTravailleur: number[] = new Array(o.travailleurs).fill(0);
  let validationsTypees = 0;
  let validationsReference = 0;

  // État fusionné, dans l'ordre des morceaux. `traitees` et `visitees`
  // décrivent le MÊME périmètre : les paires des morceaux fusionnés, coupées
  // au candidat qui atteint le plafond (`sautees` = leur différence, jamais
  // négative). Un compte, pas une position : un morceau tronqué par le temps
  // ou par l'arrêt manuel n'a pas traité toutes ses paires, et les suivants
  // se fusionnent quand même.
  const candidates = o.collecte ?? [] as unknown as C;
  const compact = !Array.isArray(candidates);
  const nearMissByCondition = new Map<string, EntreeQuasiSucces>();
  let globalNearMiss: NearMiss | null = null;
  let globalDistance = Infinity;
  const compteurs: CompteursNoyau = compteursVides();
  let traitees = 0;
  let visitees = 0;
  let prochainAFusionner = 0;
  // Ce qui termine la FUSION (plafond global, arrêt déterministe), et ce qui
  // termine seulement la DISTRIBUTION (filet de temps, arrêt manuel) : sous
  // ces deux-là, tout morceau déjà parti se reçoit et se fusionne encore,
  // jusqu'au plafond — l'arrêt garde tout ce qui a été trouvé.
  let plafond = false;
  let limiteAtteinte = false;
  let tempsEcoule = false;
  let morceauxComplets = 0;
  const fusionTerminee = () => plafond || limiteAtteinte;

  let traiteesMorceau = 0, visitesMorceau = 0;
  let compteursMorceau = compteursVides();
  const fusionner = (r: ResultatMorceau<C>, m: Morceau): void => {
    if (fusionTerminee()) return;
    // Coupe au plafond : le candidat qui l'atteint, sa position incluse.
    const nombre = Math.min(r.candidats.length, Math.max(1, maxCollected - candidates.length));
    fusionnerCandidats(candidates, r.candidats, nombre);
    const coupe = nombre > 0 && candidates.length >= maxCollected ? nombre - 1 : -1;
    const limitePos = coupe >= 0 ? r.positions[coupe] : Infinity;
    for (const e of r.ameliorations) {
      if (e.pos > limitePos) break;
      if (e.type === 'condition') {
        const existing = nearMissByCondition.get(e.cle);
        if (!existing || e.entree.miss.shortfalls[0].shortfall < existing.miss.shortfalls[0].shortfall) nearMissByCondition.set(e.cle, e.entree);
      } else if (e.distance < globalDistance) {
        globalDistance = e.distance;
        globalNearMiss = e.miss;
      }
    }
    for (const k of Object.keys(compteurs) as (keyof CompteursNoyau)[]) compteurs[k] += r.compteurs[k] - compteursMorceau[k];
    compteursMorceau = r.compteurs;
    if (coupe >= 0) {
      traitees += limitePos - m.offset - traiteesMorceau;
      visitees += r.visitesAuCandidat[coupe] - visitesMorceau;
      plafond = true;
      return;
    }
    traitees += r.traitees - traiteesMorceau;
    visitees += r.visitees - visitesMorceau;
    traiteesMorceau = r.traitees;
    visitesMorceau = r.visitees;
    if (r.issue === 'complet') morceauxComplets++;
    if (r.issue === 'limite') {
      limiteAtteinte = true;
    } else if (arret != null && r.issue === 'complet' && m.offset + r.traitees === arret - 1) {
      // Le point de passage `arret` tombe sur la première paire du morceau
      // suivant, jamais distribué : elle compte comme dans `pairBuckets`
      // (`explored` avance avant le jugement), sans être jugée.
      traitees += 1;
      limiteAtteinte = true;
    }
  };

  const tampons = (dernier: boolean) => {
    // Le coordinateur ne lit plus ces colonnes après le plan : le dernier
    // Worker en prend possession, les autres ont une copie indépendante.
    const copie = dernier ? ct : copierCompartiments(ct);
    return { copie, transfert: tamponsDe(copie) };
  };
  const nbTravailleurs = Math.max(1, Math.min(o.travailleurs, aDistribuer.length));
  const poignees: PoigneeTravailleur<C>[] = [];
  const enVolParTravailleur = new Array(nbTravailleurs).fill(0) as number[];
  let prochainADistribuer = 0;
  // L'erreur d'un Worker termine l'attente comme une fin : l'état fusionné
  // jusque-là est rendu, porté par `ErreurAppariementParallele`.
  let enErreur: { erreur: unknown } | null = null;

  let receptions = Promise.resolve();
  const attendreMorceaux = () => new Promise<void>((resolve) => {
    let enVol = 0;
    let termine = false;
    const finir = () => {
      if (termine) return;
      termine = true;
      resolve();
    };
    // Arrêt manuel : plus rien ne part, et chaque Worker arrête son morceau
    // en cours à sa prochaine ligne (il rend ce qu'il a trouvé) et répond sans
    // calculer aux morceaux en attente (`servirAppariement`).
    surArret = () => {
      for (const p of poignees) p.arreter();
      if (enVol === 0) finir();
    };
    const distributionTerminee = () => fusionTerminee() || tempsEcoule || arrete || overBudget();
    const distribuer = (w: number) => {
      if (distributionTerminee()) return;
      // Un résultat arrivé en avance ne crée pas un nouveau crédit de morceau.
      if (prochainADistribuer - prochainAFusionner >= nbTravailleurs * EN_VOL_PAR_TRAVAILLEUR) return;
      if (enVolParTravailleur[w] >= EN_VOL_PAR_TRAVAILLEUR) return;
      if (prochainADistribuer >= aDistribuer.length) return;
      const m = aDistribuer[prochainADistribuer++];
      enVol++;
      enVolParTravailleur[w]++;
      poignees[w].envoyer(m, [m.segments.buffer as ArrayBuffer, m.drapeaux.buffer as ArrayBuffer]);
    };
    if (aDistribuer.length === 0 || arrete) {
      finir();
      return;
    }
    for (let w = 0; w < nbTravailleurs; w++) {
      const { copie, transfert } = tampons(w === nbTravailleurs - 1);
      const p = o.lancer(
        { params: o.params, startedAt: o.startedAt, compartiments: copie, ...(compact ? { collecteCompacte: true } : {}), ...(o.forcerValidation ? { forcerValidation: o.forcerValidation } : {}) },
        transfert
      );
      poignees.push(p);
      if (compact && !p.acquitter) throw new Error('Lanceur compact sans acquittement');
      p.surErreur((e) => {
        if (termine) return;
        // Fusion déjà terminée (plafond, arrêt déterministe) : le résultat est
        // complet pour sa coupe, et le morceau en vol qui a échoué aurait été
        // jeté. L'attente se termine sans erreur, le motif reste le sien.
        if (!fusionTerminee()) enErreur = { erreur: e };
        finir();
      });
      p.surMessage((r) => {
        receptions = receptions.then(async () => {
          // Après une erreur, aucun message suivant n'étend le préfixe rendu.
          if (termine) return;
          const terminal = r.issue !== 'suite';
          if (terminal) {
            enVol--;
            enVolParTravailleur[w]--;
            parTravailleur[w]++;
            if (r.validationTypee) validationsTypees++;
            else validationsReference++;
          }
          if (resultats[r.id]) throw new Error('Bloc de morceau reçu sans crédit');
          resultats[r.id] = { r, w };
          const aAcquitter: number[] = [];
          if (r.issue === 'temps') tempsEcoule = true;
          // La fusion avance sur le préfixe contigu des morceaux reçus. Les
          // morceaux partent dans l'ordre et l'attente ne se termine qu'une fois
          // tous ceux partis reçus : à la fin, tout ce qui est parti est fusionné.
          while (!fusionTerminee() && prochainAFusionner < aDistribuer.length && resultats[prochainAFusionner]) {
            const entree = resultats[prochainAFusionner]!;
            resultats[prochainAFusionner] = undefined;
            fusionner(entree.r, aDistribuer[prochainAFusionner]);
            aAcquitter.push(entree.w);
            if (entree.r.issue === 'suite') break;
            prochainAFusionner++;
            traiteesMorceau = 0; visitesMorceau = 0; compteursMorceau = compteursVides();
          }
          if (fusionTerminee()) {
            for (let i = prochainAFusionner; i < resultats.length; i++) {
              const entree = resultats[i];
              if (entree) { resultats[i] = undefined; aAcquitter.push(entree.w); }
            }
          }
          // La page possède ses propres crédits ; le producteur peut reprendre
          // dès l'adoption de ses colonnes, avant toute publication asynchrone.
          for (const t of aAcquitter) poignees[t].acquitter?.();
          await o.surProgression?.(traitees, candidates);
          if (termine) return;
          for (let k = 0; k < EN_VOL_PAR_TRAVAILLEUR; k++) for (let t = 0; t < nbTravailleurs; t++) distribuer(t);
          if ((distributionTerminee() || prochainADistribuer >= aDistribuer.length) && enVol === 0) finir();
        }).catch((erreur: unknown) => { enErreur = { erreur }; finir(); });
      });
    }
    for (let k = 0; k < EN_VOL_PAR_TRAVAILLEUR; k++) for (let w = 0; w < nbTravailleurs; w++) distribuer(w);
    // Rien de parti (filet de temps déjà dépassé) : aucun message ne viendra
    // terminer l'attente.
    if (enVol === 0) finir();
  });
  try {
    await attendreMorceaux();
    // Une erreur peut arriver pendant le transfert vers le propriétaire : finir
    // cette publication avant le bilan, sans fusionner les messages suivants.
    await receptions;
  } finally {
    surArret = null;
    for (const p of poignees) p.terminer();
  }

  const motif: ResultatParallele<C>['motif'] = enErreur
    ? 'erreur'
    : plafond
      ? 'maxCollected'
      : limiteAtteinte
        ? 'arret'
        : morceauxComplets === aDistribuer.length
          ? 'aucun'
          : tempsEcoule || !arrete
            ? 'maxMs'
            : 'manuel';

  const truncated = motif !== 'aucun';
  const resultat: ResultatParallele<C> = {
    candidates, explored: traitees, truncated,
    nearMissByCondition: Array.from(nearMissByCondition.values()), globalNearMiss,
    traitees, visitees, sautees: traitees - visitees, chemin: 'noyau',
    // Chaque Worker décide sur le même pool et le même contrat : un mélange serait une anomalie, dite.
    cheminValidation: validationsReference === 0 ? 'typee' : 'reference',
    ...(validationsReference > 0 ? { motifValidation: `${validationsReference} morceau(x) validé(s) par la référence, ${validationsTypees} typé(s)` } : {}),
    compteurs,
    motif, morceaux: plan.length, morceauxTraites: parTravailleur.reduce((s, v) => s + v, 0), parTravailleur,
    plusGrosMorceau: plan.reduce((s, m) => Math.max(s, m.taille), 0), msPlanification,
  };
  if (enErreur) throw new ErreurAppariementParallele((enErreur as { erreur: unknown }).erreur, resultat);
  return resultat;
}

/**
 * Le `SearchResult` que rend la recherche : `explored` = paires traitées, et
 * rien des compteurs propres au noyau. Le motif ne voyage pas : l'ordre étant
 * séquentiel et le plafond global, il se déduit du plafond comme en
 * séquentiel (`evaluerCompletude`, harnais).
 */
export function enResultatDeRecherche<C>(r: ResultatParallele<C>): SearchResult<C> {
  return { candidates: r.candidates, explored: r.explored, truncated: r.truncated, nearMissByCondition: r.nearMissByCondition, globalNearMiss: r.globalNearMiss };
}
