// La résolution d'équipement HORS du fil de l'écran — la logique du côté de
// l'ÉCRAN : quoi envoyer au Worker de
// résolution, quoi annuler, quelles réponses écrire dans le cache, quand
// renoncer au Worker. Le corps (`resolutionBody.ts`) est l'autre moitié : il
// résout ce qu'on lui demande, dans l'ordre reçu.
//
// ⚠️ **Ce module doit rester NEUTRE**, comme le corps : ni `self`, ni
// `Worker`, ni DOM, ni React. Le classeur (`CorpsClassement`) ne fait que le
// BRANCHER — il lui passe les messages du résolveur et lui fournit ses
// « ports » (`PortsResolutionDistante`) ; les tests et le script de preuve
// branchent les mêmes méthodes sur `CorpsResolution`, sans navigateur.
//
// Ce qui ne change pas : QUI est traité et dans quel ORDRE. La priorité reste
// décidée sur le fil de l'écran, par `prochainsATraiter` (page affichée
// d'abord, puis l'avance de fond vers K confirmées) ; ce module ne trie rien, il prend les
// restants dans l'ordre reçu.
//
// Plusieurs résolveurs : chacun est une VOIE (un Worker, un canal). Le pilote
// donne à chaque voie vivante ses propres crédits, adresse chaque message à
// une voie et retire une voie en panne sans perdre ses builds : ils
// redeviennent à faire. Une voie, c'est le comportement d'un seul résolveur.
// L'ordre d'arrivée des réponses n'est jamais supposé : chacune retrouve sa
// demande par `idDemande`.

import { RuneDetail } from '../types';
import { BuildCandidate } from '../lib/runeBuildOptim';
import { RelicVide } from '../lib/relicOptim';
import { ResultatArtefacts, VoieDeLaFile, cleBuild, voieDeLaFile } from '../lib/artifactQueue';
import { EntreesResolutionSerialisables, MessageVersResolution, ReponseResolution } from './resolutionBody';

/**
 * Au plus DEUX demandes sans réponse PAR VOIE, toutes confondues (annulées et
 * d'un contexte périmé comprises, tant que leur réponse n'est pas revenue).
 *
 * Deux plutôt qu'une : pendant que le Worker résout la première, la seconde
 * attend déjà dans sa file — il enchaîne sans attendre l'aller-retour vers
 * le classeur, occupé par ses tranches (notation, index). Pas davantage :
 * une demande partie est une demande que la page, si elle change, ne peut plus
 * doubler qu'en l'annulant.
 */
export const DEMANDES_EN_VOL_MAX = 2;

/** Un message pour le résolveur, et la voie (l'indice du Worker) qui le reçoit. */
export interface EnvoiResolution {
  voie: number;
  message: MessageVersResolution;
}

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
  /** `postMessage` vers le Worker de la voie ; peut lever (clonage impossible). */
  envoyer(m: MessageVersResolution, voie: number): void;
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
  // La voie qui l'a reçue : son annulation va là, et la panne de cette voie
  // la rend à faire.
  voie: number;
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

  // Les voies, par indice : vivante ou retirée après une panne.
  private voies: boolean[];
  // Combien de voies vivantes reçoivent de nouvelles demandes (les premières
  // par indice) ; les autres finissent seulement ce qu'elles ont.
  private actives = Infinity;

  /**
   * `parVoie` : les crédits de chaque voie ; `voies` : le nombre de
   * résolveurs. Une voie (le défaut) : un seul résolveur, ou la résolution
   * directe du classeur.
   */
  constructor(readonly parVoie: number = DEMANDES_EN_VOL_MAX, voies = 1) {
    if (!Number.isSafeInteger(voies) || voies < 1) throw new Error('Nombre de voies de résolution invalide');
    this.voies = new Array<boolean>(voies).fill(true);
  }

  /** Les demandes sans réponse permises, toutes voies vivantes confondues. */
  get maxEnVol(): number {
    return this.parVoie * Math.min(this.actives, this.voiesVivantes);
  }

  /**
   * Seules les `n` premières voies vivantes reçoivent de nouvelles demandes
   * (`Infinity` : toutes). Le classeur n'en active qu'une tant que la
   * recherche apparie encore : le pool ne prend pas de cœurs aux Workers
   * d'appariement. Une demande déjà partie sur une autre voie y reste.
   */
  activerVoies(n: number): void {
    if (!(n >= 1)) throw new Error('Nombre de voies actives invalide');
    this.actives = n;
  }

  /** Les voies qui reçoivent de nouvelles demandes. */
  get voiesActives(): number {
    return Math.min(this.actives, this.voiesVivantes);
  }

  get voiesVivantes(): number {
    return this.voies.filter(Boolean).length;
  }

  get demandesEnVol(): number {
    return this.enVol.length;
  }

  /** Les demandes sans réponse de chaque voie (une voie retirée n'en a aucune). */
  get demandesParVoie(): number[] {
    const n = this.voies.map(() => 0);
    for (const d of this.enVol) n[d.voie]++;
    return n;
  }

  /**
   * De nouveaux résolveurs, `voies` vivantes : les demandes en vol sont
   * oubliées (leurs canaux sont fermés, aucune réponse n'en viendra) et le
   * contexte repartira à la prochaine demande. Les compteurs continuent :
   * aucun identifiant n'est réutilisé.
   */
  brancherVoies(voies: number): void {
    if (!Number.isSafeInteger(voies) || voies < 1) throw new Error('Nombre de voies de résolution invalide');
    this.voies = new Array<boolean>(voies).fill(true);
    this.enVol = [];
    this.contexte = null;
  }

  /**
   * La voie est en panne : retirée, ses demandes en vol sont oubliées — leurs
   * crédits rendus, leurs builds de nouveau à faire sur les autres voies au
   * prochain tour. Une réponse tardive de cette voie ne correspond plus à
   * aucune demande. Rend le nombre de voies vivantes qui restent.
   */
  retirerVoie(voie: number): number {
    if (this.voies[voie]) {
      this.voies[voie] = false;
      this.enVol = this.enVol.filter((d) => d.voie !== voie);
    }
    return this.voiesVivantes;
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
    return this.invaliderVoies().map((e) => e.message);
  }

  /** `invalider`, chaque annulation adressée à la voie de sa demande. */
  invaliderVoies(): EnvoiResolution[] {
    this.contexte = null;
    this.voieAvantActualisation = null;
    this.nonPubliee = false;
    return this.enVol.filter((d) => !d.annulee).map((d) => {
      d.annulee = true;
      return { voie: d.voie, message: { type: 'annuler' as const, idDemande: d.idDemande } };
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
   *    Il part vers CHAQUE voie vivante ;
   * 2. les ANNULATIONS : une demande du contexte courant qui ne fait plus
   *    partie des `maxEnVol` premiers restants (la page a changé, de
   *    meilleurs builds sont arrivés) est retirée, sauf la plus ancienne en
   *    vol de sa voie — son Worker l'a sans doute commencée, et sa réponse
   *    reste bonne à prendre. L'annulation part vers la voie de la demande ;
   * 3. les DEMANDES, dans l'ordre des restants, chacune vers la voie vivante
   *    qui en a le moins sans réponse (à égalité, la plus petite), jusqu'à
   *    `parVoie` par voie.
   *
   * Une voie : exactement le pilote d'un seul résolveur.
   *
   * Idempotent : appelé deux fois de suite sans réponse entre les deux, le
   * second appel ne rend rien.
   */
  planifier(
    courant: ContexteCourant | null,
    restants: readonly BuildCandidate[],
    runesDe: (c: BuildCandidate) => RuneDetail[]
  ): MessageVersResolution[] {
    return this.planifierVoies(courant, restants, runesDe).map((e) => e.message);
  }

  /** `planifier`, chaque message adressé à sa voie. */
  planifierVoies(
    courant: ContexteCourant | null,
    restants: readonly BuildCandidate[],
    runesDe: (c: BuildCandidate) => RuneDetail[]
  ): EnvoiResolution[] {
    if (this.renonce) return [];
    const sorties: EnvoiResolution[] = [];
    if (courant !== null && restants.length > 0 && !this.estCourant(courant)) {
      if (!Number.isSafeInteger(this.idContexte + 1)) throw new Error('Compteur de contexte de résolution épuisé');
      this.idContexte++;
      this.contexte = courant;
      for (const d of this.enVol) d.annulee = true;
      this.voies.forEach((vivante, voie) => {
        if (vivante) sorties.push({ voie, message: { type: 'contexte', idContexte: this.idContexte, entrees: courant.entrees } });
      });
    }
    const actif = this.estCourant(courant);
    const voulues = new Set(restants.slice(0, this.maxEnVol).map(cleBuild));
    const premiere = new Set<number>();
    for (const d of this.enVol) {
      // La plus ancienne de chaque voie, annulée ou non, garde sa place.
      if (!premiere.has(d.voie)) { premiere.add(d.voie); continue; }
      if (d.annulee) continue;
      if (actif && d.idContexte === this.idContexte && voulues.has(d.cle)) continue;
      d.annulee = true;
      sorties.push({ voie: d.voie, message: { type: 'annuler', idDemande: d.idDemande } });
    }
    if (!actif) return sorties;
    const enCours = new Set(this.enVol.filter((d) => !d.annulee && d.idContexte === this.idContexte).map((d) => d.cle));
    const charge = this.demandesParVoie;
    for (const c of restants) {
      const cle = cleBuild(c);
      if (enCours.has(cle)) continue;
      // La voie active la moins chargée : chaque voie a ses `parVoie` places.
      let voie = -1;
      for (let v = 0, rang = 0; v < this.voies.length && rang < this.actives; v++) {
        if (!this.voies[v]) continue;
        rang++;
        if (charge[v] < this.parVoie && (voie < 0 || charge[v] < charge[voie])) voie = v;
      }
      if (voie < 0) break;
      if (!Number.isSafeInteger(this.prochainIdDemande + 1)) throw new Error('Compteur de demande de résolution épuisé');
      const idDemande = this.prochainIdDemande++;
      this.enVol.push({ idDemande, idContexte: this.idContexte, cle, voie, annulee: false });
      charge[voie]++;
      enCours.add(cle);
      sorties.push({ voie, message: { type: 'resoudre', idContexte: this.idContexte, idDemande, cle, runes: runesDe(c) } });
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
    for (const { voie, message } of this.planifierVoies(p.courant(), restants, (c) => p.runesDe(c))) {
      try {
        p.envoyer(message, voie);
      } catch (err) {
        this.basculer(p, `envoi au Worker impossible (${message.type})`, err);
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
