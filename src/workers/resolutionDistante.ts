// La résolution d'équipement HORS du fil de l'écran — la logique du côté de
// l'ÉCRAN : quoi envoyer au Worker de
// résolution, quoi annuler, quelles réponses écrire dans le cache, quand
// renoncer au Worker. Le corps (`resolutionBody.ts`) est l'autre moitié : il
// résout ce qu'on lui demande, dans l'ordre reçu.
//
// ⚠️ **Ce module doit rester NEUTRE**, comme le corps : ni `self`, ni
// `Worker`, ni DOM, ni React. Le hook (`useArtifactOptimQueue`) ne fait que le
// BRANCHER — il crée le Worker, lui passe les messages et lui fournit ses
// « ports » (`PortsResolutionDistante`) ; les tests et le script de preuve
// branchent les mêmes méthodes sur `CorpsResolution`, sans navigateur.
//
// Ce qui ne change pas : QUI est traité et dans quel ORDRE. La priorité reste
// décidée sur le fil de l'écran, par `prochainsATraiter` (page affichée
// d'abord, puis l'avance de fond vers K confirmées) ; ce module ne trie rien, il prend les
// restants dans l'ordre reçu.

import { RuneDetail } from '../types';
import { BuildCandidate } from '../lib/runeBuildOptim';
import { RelicVide } from '../lib/relicOptim';
import { ResultatArtefacts, VoieDeLaFile, cleBuild, voieDeLaFile } from '../lib/artifactQueue';
import { EntreesResolutionSerialisables, MessageVersResolution, ReponseResolution } from './resolutionBody';

/**
 * Au plus DEUX demandes sans réponse, toutes confondues (annulées et d'un
 * contexte périmé comprises, tant que leur réponse n'est pas revenue).
 *
 * Deux plutôt qu'une : pendant que le Worker résout la première, la seconde
 * attend déjà dans sa file — il enchaîne sans attendre l'aller-retour vers
 * l'écran, souvent occupé pendant une recherche (rendu, tri). Pas davantage :
 * une demande partie est une demande que la page, si elle change, ne peut plus
 * doubler qu'en l'annulant.
 */
export const DEMANDES_EN_VOL_MAX = 2;

/**
 * Ce qui identifie le contexte de la file, côté écran : les entrées
 * sérialisables ET la signature des réglages, par IDENTITÉ.
 *
 * ⚠️ Comparé à chaque réponse, pas seulement au moment de l'envoi : un
 * réglage peut changer entre le rendu et l'effet qui renverrait le contexte.
 * Une réponse arrivée dans cet intervalle porte encore l'`idContexte` courant
 * — c'est l'identité des entrées et de la signature qui la démasque.
 */
export interface ContexteCourant {
  entrees: EntreesResolutionSerialisables;
  signature: string;
}

/** Ce que le hook fournit au module : le Worker, le cache, la file, l'écran. */
export interface PortsResolutionDistante {
  /** Le contexte courant ; `null` quand la résolution n'a pas lieu d'être. */
  courant(): ContexteCourant | null;
  /** Les runes d'un build — elles voyagent avec sa demande. */
  runesDe(c: BuildCandidate): RuneDetail[];
  /** Les builds à traiter, dans l'ordre de priorité : `prochainsATraiter` sur le cache courant. */
  restants(): readonly BuildCandidate[];
  /** Le classement doit terminer son actualisation avant de connaître la file. */
  actualisationEnCours?(): boolean;
  /** La page RÉELLEMENT affichée. */
  page(): readonly BuildCandidate[];
  /** Le cache de la file (`cleBuild` → résultat), le même que celui du chemin direct. */
  cache(): Map<string, ResultatArtefacts>;
  /** `postMessage` vers le Worker ; peut lever (clonage impossible). */
  envoyer(m: MessageVersResolution): void;
  /**
   * Publie le cache à l'écran — `forcer` passe outre la cadence. Rend VRAI si
   * l'écran a reçu le cache, FAUX si la cadence, une tâche ou l'adoption de
   * la source le retient. Un forçage retenu reste dû chez le propriétaire.
   */
  publier(forcer: boolean): boolean;
  /** Combien restent à traiter, pour l'affichage. */
  enAttente(n: number): void;
  /** Renoncer au Worker : journaliser, le terminer, rendre la main au chemin direct. */
  repli(raison: string, detail: unknown): void;
}

/** Ce qu'il advient d'une réponse du Worker. */
export type IssueReponse =
  | { issue: 'ecrite'; cle: string }
  | {
      issue: 'ignoree';
      motif: 'contexte-perime' | 'demande-annulee' | 'annulee-par-le-corps' | 'demande-inconnue' | 'cle-differente' | 'repli';
    }
  | { issue: 'erreur'; nom: string; message: string; vide?: RelicVide };

/**
 * Ce qui est journalisé quand la résolution a levé dans le Worker (réponse
 * `erreur`) : la raison du repli, et un détail qui porte le nom, le message
 * et, pour une `RechercheRefusee`, son motif `vide` — jamais perdu en route
 * Une seule écriture pour le module (`surReponse`) et le
 * hook (réponse arrivée hors d'un effet actif).
 */
export function repliSurErreur(issue: Extract<IssueReponse, { issue: 'erreur' }>): {
  raison: string;
  detail: { nom: string; message: string; vide?: RelicVide };
} {
  return {
    raison: `la résolution a levé dans le Worker (${issue.nom})`,
    detail: { nom: issue.nom, message: issue.message, ...(issue.vide ? { vide: issue.vide } : {}) },
  };
}

interface DemandeEnVol {
  idDemande: number;
  idContexte: number;
  cle: string;
  // Annulée par l'écran (ou rendue caduque par un nouveau contexte) : sa
  // réponse, quelle qu'elle soit, ne sera pas écrite.
  annulee: boolean;
}

/**
 * La publication est-elle FORCÉE après ce build ? Même règle que la tranche du
 * chemin direct : quand il était le dernier non résolu de la page affichée
 * (les cartes se mettent à jour sans attendre la cadence), ou le dernier de la
 * file (sinon il resterait dans le cache sans jamais atteindre l'écran).
 */
export function publicationForcee(avant: VoieDeLaFile, apres: VoieDeLaFile): boolean {
  return apres === 'aucune' || (avant === 'page' && apres !== 'page');
}

export class ResolutionDistante {
  private idContexte = 0;
  // Le dernier contexte ENVOYÉ, par identité ; `null` avant le premier envoi.
  private contexte: ContexteCourant | null = null;
  private prochainIdDemande = 1;
  // Les demandes sans réponse, dans l'ordre d'envoi — c'est aussi l'ordre
  // dans lequel le corps les traite.
  private enVol: DemandeEnVol[] = [];
  private renonce = false;
  // Une écriture dans le cache que l'écran n'a pas reçue : la cadence l'a
  // retenue (`publier` a rendu faux). Remis à faux par toute publication
  // effective, et par `renoncer`, qui la rend à l'appelant.
  private nonPubliee = false;
  private voieAvantActualisation: VoieDeLaFile | null = null;

  constructor(readonly maxEnVol: number = DEMANDES_EN_VOL_MAX) {}

  get demandesEnVol(): number {
    return this.enVol.length;
  }

  get enRepli(): boolean {
    return this.renonce;
  }

  /** Une écriture attend-elle encore sa publication (retenue par la cadence) ? */
  get ecritureNonPubliee(): boolean {
    return this.nonPubliee;
  }

  /** Change de propriétaire sans réutiliser les identifiants des demandes en vol. */
  invalider(): MessageVersResolution[] {
    this.contexte = null;
    this.voieAvantActualisation = null;
    this.nonPubliee = false;
    return this.enVol.filter((d) => !d.annulee).map((d) => {
      d.annulee = true;
      return { type: 'annuler' as const, idDemande: d.idDemande };
    });
  }

  private publier(p: PortsResolutionDistante, forcer: boolean): void {
    if (p.publier(forcer)) this.nonPubliee = false;
  }

  private estCourant(courant: ContexteCourant | null): boolean {
    return (
      courant !== null &&
      this.contexte !== null &&
      this.contexte.entrees === courant.entrees &&
      this.contexte.signature === courant.signature
    );
  }

  /**
   * Les messages à envoyer pour l'état courant, dans l'ordre :
   *
   * 1. le CONTEXTE, s'il a changé (entrées ou signature) — seulement quand il
   *    y a du travail : changer dix fois un réglage sans recherche n'envoie
   *    rien. Un nouvel `idContexte` rend caduques toutes les demandes encore
   *    en vol (le corps annule celles qu'il n'a pas commencées) ;
   * 2. les ANNULATIONS : une demande du contexte courant qui ne fait plus
   *    partie des premiers restants (la page a changé, de meilleurs builds
   *    sont arrivés) est retirée, sauf la plus ancienne en vol — le corps l'a
   *    sans doute commencée, et sa réponse reste bonne à prendre ;
   * 3. les DEMANDES, dans l'ordre des restants, jusqu'à `maxEnVol` demandes
   *    sans réponse.
   *
   * Idempotent : appelé deux fois de suite sans réponse entre les deux, le
   * second appel ne rend rien.
   */
  planifier(
    courant: ContexteCourant | null,
    restants: readonly BuildCandidate[],
    runesDe: (c: BuildCandidate) => RuneDetail[]
  ): MessageVersResolution[] {
    if (this.renonce) return [];
    const sorties: MessageVersResolution[] = [];
    if (courant !== null && restants.length > 0 && !this.estCourant(courant)) {
      if (!Number.isSafeInteger(this.idContexte + 1)) throw new Error('Compteur de contexte de résolution épuisé');
      this.idContexte++;
      this.contexte = courant;
      for (const d of this.enVol) d.annulee = true;
      sorties.push({ type: 'contexte', idContexte: this.idContexte, entrees: courant.entrees });
    }
    const actif = this.estCourant(courant);
    const voulues = new Set(restants.slice(0, this.maxEnVol).map(cleBuild));
    this.enVol.forEach((d, i) => {
      if (i === 0 || d.annulee) return;
      if (actif && d.idContexte === this.idContexte && voulues.has(d.cle)) return;
      d.annulee = true;
      sorties.push({ type: 'annuler', idDemande: d.idDemande });
    });
    if (!actif) return sorties;
    const enCours = new Set(this.enVol.filter((d) => !d.annulee && d.idContexte === this.idContexte).map((d) => d.cle));
    for (const c of restants) {
      if (this.enVol.length >= this.maxEnVol) break;
      const cle = cleBuild(c);
      if (enCours.has(cle)) continue;
      if (!Number.isSafeInteger(this.prochainIdDemande + 1)) throw new Error('Compteur de demande de résolution épuisé');
      const idDemande = this.prochainIdDemande++;
      this.enVol.push({ idDemande, idContexte: this.idContexte, cle, annulee: false });
      enCours.add(cle);
      sorties.push({ type: 'resoudre', idContexte: this.idContexte, idDemande, cle, runes: runesDe(c) });
    }
    return sorties;
  }

  /**
   * Une réponse du Worker. Elle libère TOUJOURS sa place en vol ; elle n'est
   * écrite dans `cache` que si elle est un résultat d'une demande non annulée
   * du contexte courant — `idContexte` du corps ET identité des entrées et de
   * la signature (`courant`). Une réponse périmée n'est JAMAIS écrite : elle
   * écraserait, ou devancerait, le résultat d'un réglage plus récent.
   *
   * `cache` et `courant` à `null` (aucune file active) : rien n'est écrit, la
   * place se libère quand même.
   */
  recevoir(r: ReponseResolution, cache: Map<string, ResultatArtefacts> | null, courant: ContexteCourant | null): IssueReponse {
    const i = this.enVol.findIndex((d) => d.idDemande === r.idDemande);
    if (i < 0) return { issue: 'ignoree', motif: 'demande-inconnue' };
    const d = this.enVol.splice(i, 1)[0]!;
    if (this.renonce) return { issue: 'ignoree', motif: 'repli' };
    // ⚠️ Une erreur n'est jamais tue, même d'une demande caduque : c'est la
    // résolution de production qui a levé.
    if (r.type === 'erreur') return { issue: 'erreur', nom: r.nom, message: r.message, ...(r.vide ? { vide: r.vide } : {}) };
    if (r.type === 'annule') return { issue: 'ignoree', motif: 'annulee-par-le-corps' };
    if (d.annulee) return { issue: 'ignoree', motif: 'demande-annulee' };
    if (cache === null || r.idContexte !== this.idContexte || d.idContexte !== this.idContexte || !this.estCourant(courant)) {
      return { issue: 'ignoree', motif: 'contexte-perime' };
    }
    if (r.cle !== d.cle) return { issue: 'ignoree', motif: 'cle-differente' };
    cache.set(d.cle, r.resultat);
    return { issue: 'ecrite', cle: d.cle };
  }

  /**
   * Plus rien n'est envoyé ni écrit ; les demandes en vol sont oubliées.
   *
   * Rend VRAI s'il restait une écriture non publiée : l'appelant publie alors
   * le cache DE FORCE — le chemin direct qui reprend n'a
   * peut-être plus rien à traiter, donc plus rien à publier. `basculer` le
   * fait lui-même ; le hook le fait pour les replis qui ne passent pas par le
   * module (erreur du Worker, réponse illisible). Un second appel rend faux.
   */
  renoncer(): boolean {
    this.renonce = true;
    this.enVol = [];
    const nonPubliee = this.nonPubliee;
    this.nonPubliee = false;
    this.voieAvantActualisation = null;
    return nonPubliee;
  }

  /**
   * Un tour de file : met à jour le compte en attente, publie de force si la
   * file s'est vidée sur une écriture non publiée, puis envoie ce que
   * `planifier` demande. Un envoi qui lève (clonage impossible) fait
   * renoncer au Worker — l'erreur passe par `repli`, jamais tue.
   */
  pomper(p: PortsResolutionDistante): void {
    if (this.renonce) return;
    const restants = p.restants();
    if (p.actualisationEnCours?.()) return;
    p.enAttente(restants.length);
    this.acheverActualisation(p, restants);
    // ⚠️ **La file s'est vidée sans nouvelle écriture** — réponse ignorée,
    // changement de page, nouvelle recherche — alors que la cadence a retenu
    // la dernière : publication FORCÉE. Sans elle, ce résultat
    // resterait dans le cache sans jamais atteindre l'écran, puisque plus
    // rien ne publierait. Le chemin direct fait de même quand il s'endort.
    if (restants.length === 0 && this.nonPubliee) this.publier(p, true);
    for (const m of this.planifier(p.courant(), restants, (c) => p.runesDe(c))) {
      try {
        p.envoyer(m);
      } catch (err) {
        this.basculer(p, `envoi au Worker impossible (${m.type})`, err);
        return;
      }
    }
  }

  /**
   * Une réponse du Worker, branchée sur la file : écrite si elle est bonne,
   * publication forcée selon `publicationForcee`, puis un tour de file (qui
   * publie de force si la file s'est vidée sur une écriture retenue — réponse
   * ignorée comprise). Une réponse `erreur` fait renoncer au Worker.
   */
  surReponse(r: ReponseResolution, p: PortsResolutionDistante): void {
    if (this.renonce) return;
    const cache = p.cache();
    const page = p.page();
    const restants = p.restants();
    this.acheverActualisation(p, restants);
    const avant = voieDeLaFile(restants, page, cache);
    const issue = this.recevoir(r, cache, p.courant());
    if (issue.issue === 'erreur') {
      const { raison, detail } = repliSurErreur(issue);
      this.basculer(p, raison, detail);
      return;
    }
    if (issue.issue === 'ecrite') {
      this.nonPubliee = true;
      const apres = p.restants();
      if (p.actualisationEnCours?.()) {
        // Le tableau vide provisoire ne dit rien de la page ni du fond.
        this.voieAvantActualisation = avant;
        this.publier(p, false);
      } else this.publier(p, publicationForcee(avant, voieDeLaFile(apres, page, cache)));
    }
    this.pomper(p);
  }

  private acheverActualisation(p: PortsResolutionDistante, restants: readonly BuildCandidate[]): void {
    if (this.voieAvantActualisation === null || p.actualisationEnCours?.()) return;
    const avant = this.voieAvantActualisation;
    this.voieAvantActualisation = null;
    if (this.nonPubliee && publicationForcee(avant, voieDeLaFile(restants, p.page(), p.cache()))) this.publier(p, true);
  }

  /**
   * Renoncer, publier de force une écriture que la cadence avait retenue,
   * puis rendre la main au chemin direct par `repli`.
   */
  basculer(p: PortsResolutionDistante, raison: string, detail: unknown): void {
    if (this.renoncer()) p.publier(true);
    p.repli(raison, detail);
  }
}
