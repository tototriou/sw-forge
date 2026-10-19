// ⚠️ PROTOTYPE (chantier perf-moteur, lot 2) — répartition À LA DEMANDE du
// noyau `appariementRapide.ts` entre plusieurs Workers. Neutre comme
// `parallelPairing.ts` : le lancement d'un Worker est INJECTÉ
// (`LancerTravailleur`), ce module n'importe ni `worker_threads` ni `self`.
//
// Le coordinateur énumère les LIGNES (un comboA ouvert face à un compartiment
// B ouvert) dans l'ordre exact de `pairBuckets`, avec les prédicats de
// production, et les groupe en MORCEAUX contigus plus fins que les
// compartiments. Chaque Worker reçoit les tableaux typés une seule fois
// (transférés), puis des morceaux à la demande.
//
// ⚠️ **La fusion se fait dans l'ORDRE DES MORCEAUX**, donc dans l'ordre
// séquentiel : le résultat est celui de `pairBuckets` séquentiel, quel que
// soit le nombre de Workers — plafond de candidats GLOBAL compris (aucun
// quota par tranche, contrairement à `driveParallelPairing`). Le quasi-succès
// se rejoue à partir des améliorations de chaque morceau, avec la règle de
// production (remplacé seulement si strictement meilleur) : une tentative qui
// n'améliore pas son propre morceau ne peut pas améliorer l'état global, donc
// le rejeu redonne l'état séquentiel exact.

import { Bucket, BuildCandidate, NearMiss, PreparedSearch, SearchParams, pairBuckets } from './runeBuildOptim';
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
export interface PoigneeTravailleur {
  envoyer(message: Morceau, transfert: ArrayBuffer[]): void;
  surMessage(rappel: (message: ResultatMorceau) => void): void;
  surErreur(rappel: (erreur: unknown) => void): void;
  terminer(): void;
}

export type LancerTravailleur = (init: InitTravailleur, transfert: ArrayBuffer[]) => PoigneeTravailleur;

/** Morceaux visés par Worker (équilibrage à la demande) et plancher de taille, en paires. */
export const MORCEAUX_PAR_TRAVAILLEUR = 64;
export const TAILLE_MIN_MORCEAU = 2_000_000;
/** Morceaux en vol par Worker (le suivant attend déjà quand l'un se termine). */
export const EN_VOL_PAR_TRAVAILLEUR = 2;

export interface ResultatParallele extends ResultatAppariementRapide {
  motif: 'aucun' | 'maxCollected' | 'maxMs' | 'arret';
  morceaux: number;
  morceauxTraites: number;
  /** Morceaux traités par Worker : l'équilibrage tel qu'il s'est fait. */
  parTravailleur: number[];
  /** Paires du plus gros morceau (granularité de la répartition). */
  plusGrosMorceau: number;
  msPlanification: number;
}

/**
 * Le plan : les morceaux dans l'ordre de `pairBuckets`. ⚠️ Même énumération
 * que `totalPairCount` (prédicats de production, `comboAFeasible` par comboA) :
 * la somme des tailles vaut `totalPairCount`, le banc le vérifie.
 */
export function planifierMorceaux(prepared: PreparedSearch, bucketsA: Bucket[], bucketsB: Bucket[], cible: number): Morceau[] {
  const morceaux: Morceau[] = [];
  let segments: number[] = [];
  let drapeaux: number[] = [];
  let offset = 0;
  let taille = 0;
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
      const ouvert = comboAOuvert(prepared, bA.combos[a], bB);
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

export interface OptionsParallele {
  params: SearchParams;
  prepared: PreparedSearch;
  bucketsA: Bucket[];
  bucketsB: Bucket[];
  /** `totalPairCount` déjà calculé par l'appelant (comme `driveParallelPairing`). */
  totalPaires: number;
  travailleurs: number;
  lancer: LancerTravailleur;
  startedAt: number;
  /** Arrêt déterministe : l'état au point de passage `traitees = arretTraitees`. */
  arretTraitees?: number;
  /** Tests seulement : la validation de référence dans chaque Worker. */
  forcerValidation?: 'reference';
  /** Taille visée d'un morceau, en paires (défaut : `totalPaires / (travailleurs × 64)`, au moins 2 M). */
  cibleMorceau?: number;
}

export async function apparierRapideEnParallele(o: OptionsParallele): Promise<ResultatParallele> {
  const { prepared, bucketsA, bucketsB } = o;
  const motifContrat = verifierContrat(prepared, bucketsA, bucketsB);
  if (motifContrat) {
    // Chemin actuel, séquentiel : le prototype ne parallélise que son noyau.
    const gen = pairBuckets(prepared, bucketsA, bucketsB);
    let step = gen.next();
    while (!step.done) step = gen.next();
    const r = step.value;
    return {
      ...r, traitees: r.explored, visitees: r.explored, sautees: 0, chemin: 'actuel', motifChemin: motifContrat,
      cheminValidation: 'reference', motifValidation: 'chemin actuel (pairBuckets)', compteurs: compteursVides(),
      motif: r.truncated ? (r.candidates.length >= prepared.maxCollected ? 'maxCollected' : 'maxMs') : 'aucun',
      morceaux: 0, morceauxTraites: 0, parTravailleur: [], plusGrosMorceau: 0, msPlanification: 0,
    };
  }
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
  // Seuls les morceaux qui contiennent une paire de position < arret servent.
  const aDistribuer = arret == null ? plan : plan.filter((m) => m.offset + 1 < arret);

  const resultats: (ResultatMorceau | undefined)[] = new Array(aDistribuer.length);
  const parTravailleur: number[] = new Array(o.travailleurs).fill(0);
  let validationsTypees = 0;
  let validationsReference = 0;

  // État fusionné, dans l'ordre des morceaux.
  const candidates: BuildCandidate[] = [];
  const nearMissByCondition = new Map<string, EntreeQuasiSucces>();
  let globalNearMiss: NearMiss | null = null;
  let globalDistance = Infinity;
  const compteurs: CompteursNoyau = compteursVides();
  let traitees = 0;
  // Somme des paires traitées des morceaux fusionnés : la position atteinte
  // tant que la fusion suit le préfixe contigu, un compte (≤ totalPairs) après un trou.
  let sommeTraitees = 0;
  let visitees = 0;
  let motif: ResultatParallele['motif'] = 'aucun';
  let prochainAFusionner = 0;
  let fini = false;

  const fusionner = (r: ResultatMorceau, m: Morceau): void => {
    // Coupe : position limite incluse (plafond) ou exclue (arrêt).
    let limite = Infinity;
    for (let cpt = 0; cpt < r.candidats.length; cpt++) {
      if (arret != null && r.positions[cpt] >= arret) break;
      candidates.push(r.candidats[cpt]);
      if (candidates.length >= maxCollected) {
        limite = r.positions[cpt];
        break;
      }
    }
    const borne = (pos: number) => (limite !== Infinity ? pos <= limite : arret != null ? pos < arret : true);
    for (const e of r.ameliorations) {
      if (!borne(e.pos)) break;
      if (e.type === 'condition') {
        const existing = nearMissByCondition.get(e.cle);
        if (!existing || e.entree.miss.shortfalls[0].shortfall < existing.miss.shortfalls[0].shortfall) nearMissByCondition.set(e.cle, e.entree);
      } else if (e.distance < globalDistance) {
        globalDistance = e.distance;
        globalNearMiss = e.miss;
      }
    }
    for (const k of Object.keys(compteurs) as (keyof CompteursNoyau)[]) compteurs[k] += r.compteurs[k];
    visitees += r.visitees;
    if (limite !== Infinity) {
      traitees = limite;
      motif = 'maxCollected';
      fini = true;
    } else if (arret != null && !r.tronqueTemps && m.offset + r.traitees >= arret - 1) {
      // Au point de passage `arret`, les paires < arret sont jugées, pas `arret` lui-même.
      traitees = arret;
      motif = 'arret';
      fini = true;
    } else {
      sommeTraitees += r.traitees;
      traitees = sommeTraitees;
      if (r.tronqueTemps) {
        motif = 'maxMs';
        fini = true;
      }
    }
  };

  const tampons = () => {
    const copie = copierCompartiments(ct);
    return { copie, transfert: tamponsDe(copie) };
  };
  const nbTravailleurs = Math.max(1, Math.min(o.travailleurs, aDistribuer.length));
  const poignees: PoigneeTravailleur[] = [];
  let prochainADistribuer = 0;

  await new Promise<void>((resolve, reject) => {
    let enVol = 0;
    let termine = false;
    const finir = () => {
      if (termine) return;
      termine = true;
      resolve();
    };
    const distribuer = (w: number) => {
      if (fini || overBudget()) return;
      if (prochainADistribuer >= aDistribuer.length) return;
      const m = aDistribuer[prochainADistribuer++];
      enVol++;
      poignees[w].envoyer(m, [m.segments.buffer as ArrayBuffer, m.drapeaux.buffer as ArrayBuffer]);
    };
    if (aDistribuer.length === 0) {
      finir();
      return;
    }
    for (let w = 0; w < nbTravailleurs; w++) {
      const { copie, transfert } = tampons();
      const p = o.lancer(
        { params: o.params, startedAt: o.startedAt, compartiments: copie, ...(o.forcerValidation ? { forcerValidation: o.forcerValidation } : {}) },
        transfert
      );
      poignees.push(p);
      p.surErreur((e) => reject(e));
      p.surMessage((r) => {
        enVol--;
        parTravailleur[w]++;
        if (r.validationTypee) validationsTypees++;
        else validationsReference++;
        resultats[r.id] = r;
        // Les tailles sont connues du plan : la fusion avance sur le préfixe contigu.
        while (!fini && prochainAFusionner < aDistribuer.length && resultats[prochainAFusionner]) {
          const rr = resultats[prochainAFusionner]!;
          fusionner(rr, aDistribuer[prochainAFusionner]);
          resultats[prochainAFusionner] = undefined;
          prochainAFusionner++;
        }
        if (!fini && !r.tronqueTemps) distribuer(w);
        else if (r.tronqueTemps) fini = true;
        if ((fini || prochainADistribuer >= aDistribuer.length || overBudget()) && enVol === 0) finir();
      });
    }
    for (let k = 0; k < EN_VOL_PAR_TRAVAILLEUR; k++) for (let w = 0; w < nbTravailleurs; w++) distribuer(w);
  }).finally(() => {
    for (const p of poignees) p.terminer();
  });

  // Arrêt par le temps : les morceaux rendus après un trou se fusionnent
  // quand même, dans l'ordre (une troncature par le temps ne fait pas partie
  // du différentiel ; elle peut rendre davantage).
  if (motif === 'aucun' && prochainAFusionner < aDistribuer.length) {
    for (let i = prochainAFusionner; i < aDistribuer.length; i++) {
      const r = resultats[i];
      if (!r) continue;
      fusionner(r, aDistribuer[i]);
    }
    motif = 'maxMs';
  }

  const truncated = motif !== 'aucun';
  return {
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
}
