// Corps de la RÉSOLUTION D'ÉQUIPEMENT d'un build (paire d'artéfacts ET
// relique) hors du fil de l'écran — la LOGIQUE seule, sans aucune API de
// messagerie (degats-et-aura 6bis-b13bis-a). Même patron que
// `pairSliceBody.ts` : la coquille `resolution.worker.ts` ne fait que brancher
// `self.onmessage`/`postMessage` dessus ; un fil Node ou un test l'appellent
// tel quel.
//
// ⚠️ **Ce module doit rester NEUTRE** : jamais d'import de `worker_threads`,
// de `self`/`postMessage`, du DOM ni de React (spec/outils/optimizer/moteur/parallelisation.md
// § Code commun aux deux plateformes) — Vite tenterait sinon de résoudre du
// code Node dans le bundle navigateur, et Node ne pourrait plus l'exécuter.
//
// ⚠️ **Jamais une réimplémentation de la résolution.** Le corps reconstruit
// l'entrée de production par `entreeResolutionDuBuild` et résout par
// `resoudreEquipementDuBuild` (relicQueue.ts) — le producteur et la partie
// pure que l'écran (`resoudreEquipement`) et le CLI (`resoudreEquipementCli`)
// appellent. Ce qu'il change, c'est seulement OÙ elle tourne.
//
// ⚠️ **Pourquoi un type d'entrées à part.** Les entrées de la résolution
// directe ne traversent pas `postMessage` : `ArtifactSearchParams` porte
// `evaluer`, une FONCTION (le clonage structuré n'en clone jamais), et
// `EntreeResolution` porte deux fonctions (`faireParams`,
// `respecteConditions`) et des caches, instances de classe dont le clonage
// perdrait les méthodes. On transporte donc les DONNÉES dont
// `entreeResolutionDuBuild` reconstruit tout cela de l'autre côté.
//
// ⚠️ La priorité (la page affichée d'abord) reste décidée par la file, sur le
// fil de l'écran (`prochainsATraiter`, `voieDeLaFile`) : ce corps traite les
// demandes dans l'ordre reçu, une à la fois, et ne trie rien.

import { ElementKey, GearSet, RuneDetail } from '../types';
import { ArtifactSearchParams } from '../lib/artifactOptim';
import { DegatsContext, RegimeArtefacts } from '../lib/artifactEvaluation';
import { ResultatArtefacts } from '../lib/artifactQueue';
import { DamageSetup } from '../lib/damage';
import { BuildRequirement, RechercheRefusee } from '../lib/runeBuildOptim';
import { RelicContext, RelicVide } from '../lib/relicOptim';
import { CachesResolution, entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../lib/relicQueue';

/* --------------------------------------------------------------------------
 * Les entrées sérialisables
 * ----------------------------------------------------------------------- */

/**
 * Le contexte de choix des paires SANS `evaluer` : le corps le reconstruit
 * par build et par relique (`entreeResolutionDuBuild` le remplace de toute
 * façon — celui de l'écran note la paire représentative).
 */
export type ParametresPairesSerialisables = Omit<ArtifactSearchParams, 'evaluer'>;

/**
 * Tout ce qu'il faut pour résoudre l'équipement de N'IMPORTE QUEL build d'une
 * même recherche, en données seulement — les arguments de
 * `entreeResolutionDuBuild` moins les runes du build (une demande) et les
 * caches (propres au corps).
 *
 * - `fiche` : l'équipement de la fiche (base, artéfacts et relique PORTÉS) ;
 * - `artifactParams` : inventaire, portés, choix par sorte, verrous,
 *   amplifications, maximums actifs — sans `evaluer` ;
 * - `regime` : le régime EFFECTIF de l'équipement (D7) ;
 * - `degats` : le contexte de dégâts (`null` hors « Dégâts réels ») ;
 * - `exclusive` : l'assiette des effets uniques de relique ;
 * - `requirement` : les conditions AVEC auras (`avecAurasConditions`) ;
 * - `relicContext` : celui de la recherche LANCÉE (garantie G).
 */
export interface EntreesResolutionSerialisables {
  fiche: GearSet;
  artifactParams: ParametresPairesSerialisables;
  regime: RegimeArtefacts;
  degats: DegatsContext | null;
  exclusive: { setup: DamageSetup; element: ElementKey | null };
  requirement: BuildRequirement;
  relicContext: RelicContext | undefined;
}

/**
 * Les entrées sérialisables, depuis ce que l'écran et le CLI passent à
 * `entreeResolutionDuBuild` — `artifactParams` peut porter son `evaluer`
 * (celui de l'écran le porte) : il est RETIRÉ ici, et seulement lui.
 *
 * ⚠️ Les paramètres de paires sont recopiés par décomposition (tout sauf
 * `evaluer`), pas champ par champ : un champ ajouté demain à
 * `ArtifactSearchParams` voyage sans qu'on y pense. S'il était une fonction,
 * `tsc` le refuserait (`ProtocoleClonable`, plus bas) avant que
 * `postMessage` ne lève à l'exécution.
 */
export function entreesSerialisables(e: {
  fiche: GearSet;
  artifactParams: ParametresPairesSerialisables & { evaluer?: ArtifactSearchParams['evaluer'] };
  regime: RegimeArtefacts;
  degats: DegatsContext | null;
  exclusive: { setup: DamageSetup; element: ElementKey | null };
  requirement: BuildRequirement;
  relicContext: RelicContext | undefined;
}): EntreesResolutionSerialisables {
  const { evaluer: _evaluer, ...artifactParams } = e.artifactParams;
  return {
    fiche: e.fiche,
    artifactParams,
    regime: e.regime,
    degats: e.degats,
    exclusive: { setup: e.exclusive.setup, element: e.exclusive.element },
    requirement: e.requirement,
    relicContext: e.relicContext,
  };
}

/* --------------------------------------------------------------------------
 * Le protocole
 * ----------------------------------------------------------------------- */

/**
 * Le contexte (inventaire, réglages, contexte relique) — envoyé par la file à
 * chaque nouvelle IDENTITÉ de ses entrées (l'objet mémoïsé par l'écran : une
 * fois par recherche au moins, le contexte relique de la recherche lancée en
 * faisant partie) ou de la signature des réglages (précisé en 6bis-b13bis-c).
 * Il remplace le précédent : les demandes encore en attente sont annulées
 * (motif `contexte`) et les caches repartent à neuf.
 */
export interface MessageContexteResolution {
  type: 'contexte';
  // Choisi par l'appelant, différent à chaque envoi : toute réponse le porte,
  // pour qu'un résultat d'un contexte périmé se reconnaisse et s'ignore.
  idContexte: number;
  entrees: EntreesResolutionSerialisables;
}

/** La résolution d'UN build, dans le contexte nommé. */
export interface MessageDemandeResolution {
  type: 'resoudre';
  idContexte: number;
  // Unique par demande, choisi par l'appelant ; recopié dans la réponse.
  idDemande: number;
  // La clé du build (`cleBuild`), recopiée telle quelle : c'est sous elle que
  // la file range le résultat.
  cle: string;
  // Les runes DE CE BUILD (elles remplacent celles de la fiche).
  runes: RuneDetail[];
}

/**
 * Retire une demande encore en attente (`idDemande`), ou toutes (absent).
 * Une demande déjà résolue ne se rappelle pas : sa réponse est partie, et
 * c'est à l'appelant de l'ignorer.
 */
export interface MessageAnnulationResolution {
  type: 'annuler';
  idDemande?: number;
}

export type MessageVersResolution = MessageContexteResolution | MessageDemandeResolution | MessageAnnulationResolution;

/**
 * La réponse à une demande — EXACTEMENT une par demande reçue, pour que la
 * file n'attende jamais un build qui ne viendra pas :
 *
 * - `resultat` : l'équipement résolu, tel que `resoudreEquipementDuBuild` le
 *   rend ;
 * - `annule` : jamais résolue — annulée par l'appelant (`demande`), ou son
 *   contexte n'est pas (ou plus) celui du corps (`contexte`) ;
 * - `erreur` : la résolution a levé ; `vide` porte le motif d'une
 *   `RechercheRefusee` (pool de reliques vide en mode `recherche`), que
 *   l'appelant journalise avec le nom et le message au repli
 *   (`repliSurErreur`, resolutionDistante.ts — 6bis-b13bis-c) : le motif
 *   structuré n'est jamais perdu en route. Il ne reconstruit pas l'erreur.
 *
 * ⚠️ Toutes portent `idContexte` et `idDemande` : un résultat d'une demande
 * annulée ou d'un contexte périmé reste RECONNAISSABLE, et l'appelant
 * l'ignore — il n'écrase jamais le résultat d'une demande plus récente.
 */
export type ReponseResolution =
  | { type: 'resultat'; idContexte: number; idDemande: number; cle: string; resultat: ResultatArtefacts }
  | { type: 'annule'; idContexte: number; idDemande: number; cle: string; motif: 'demande' | 'contexte' }
  | { type: 'erreur'; idContexte: number; idDemande: number; cle: string; nom: string; message: string; vide?: RelicVide };

/* --------------------------------------------------------------------------
 * Garde de typage : rien de ce qui traverse `postMessage` n'est une fonction
 * ----------------------------------------------------------------------- */

// Ce que le clonage structuré transporte sans perte : ni fonction (il lève),
// ni instance de classe (il rendrait un objet nu, méthodes perdues — une
// `Map`/un `Set` serait clonable, mais aucune entrée n'en porte, et la garde
// les refuse pour qu'on y regarde à deux fois).
type Clonable<T> = T extends (...args: never[]) => unknown ? never : T extends object ? { [K in keyof T]: Clonable<T[K]> } : T;
type Verifie<T extends true> = T;
/**
 * ⚠️ Échoue à la COMPILATION si un message ou une réponse du protocole porte
 * une fonction, à n'importe quelle profondeur (un champ ajouté à
 * `ArtifactSearchParams`, `DegatsContext`, `RelicContext`…). Le test de
 * sérialisabilité le prouve aussi à l'exécution, par `structuredClone`, sur
 * les entrées réelles.
 */
export type ProtocoleClonable = Verifie<
  [MessageVersResolution, ReponseResolution] extends Clonable<[MessageVersResolution, ReponseResolution]> ? true : false
>;

/* --------------------------------------------------------------------------
 * Le corps
 * ----------------------------------------------------------------------- */

function annulee(d: MessageDemandeResolution, motif: 'demande' | 'contexte'): ReponseResolution {
  return { type: 'annule', idContexte: d.idContexte, idDemande: d.idDemande, cle: d.cle, motif };
}

/**
 * L'état du corps : le contexte courant, ses caches, les demandes en attente.
 *
 * `recevoir` traite un message sans rien résoudre (il rend les réponses
 * immédiates : annulations) ; `etape` résout la plus ancienne demande en
 * attente, et une seule. La coquille appelle `etape` dans une tâche à part,
 * pour qu'une annulation ou un nouveau contexte arrivés entre-temps passent
 * avant la demande suivante.
 */
export class CorpsResolution {
  private contexte: { id: number; entrees: EntreesResolutionSerialisables; caches: CachesResolution } | null = null;
  private file: MessageDemandeResolution[] = [];

  get demandesEnAttente(): number {
    return this.file.length;
  }

  recevoir(m: MessageVersResolution): ReponseResolution[] {
    if (m.type === 'contexte') {
      // Les demandes en attente appartenaient à l'ancien contexte.
      const sorties = this.file.map((d) => annulee(d, 'contexte'));
      this.file = [];
      // ⚠️ Caches NEUFS à chaque contexte, jamais réutilisés : le profil de
      // dégâts est rangé par identifiants de pièces, qu'un nouvel inventaire
      // peut réattribuer à d'autres pièces (voir `CachesResolution`).
      this.contexte = { id: m.idContexte, entrees: m.entrees, caches: nouveauxCachesResolution() };
      return sorties;
    }
    if (m.type === 'resoudre') {
      if (!this.contexte || m.idContexte !== this.contexte.id) return [annulee(m, 'contexte')];
      this.file.push(m);
      return [];
    }
    const sorties: ReponseResolution[] = [];
    const reste: MessageDemandeResolution[] = [];
    for (const d of this.file) {
      if (m.idDemande === undefined || d.idDemande === m.idDemande) sorties.push(annulee(d, 'demande'));
      else reste.push(d);
    }
    this.file = reste;
    return sorties;
  }

  /** Résout la plus ancienne demande en attente ; `null` s'il n'y en a pas. */
  etape(): ReponseResolution | null {
    const d = this.file.shift();
    if (!d) return null;
    // Une demande en file appartient toujours au contexte courant : un
    // nouveau contexte vide la file (`recevoir`).
    const ctx = this.contexte!;
    const { idContexte, idDemande, cle } = d;
    try {
      const resultat = resoudreEquipementDuBuild(
        entreeResolutionDuBuild({
          fiche: ctx.entrees.fiche,
          runes: d.runes,
          artifactParams: ctx.entrees.artifactParams,
          regime: ctx.entrees.regime,
          degats: ctx.entrees.degats,
          exclusive: ctx.entrees.exclusive,
          requirement: ctx.entrees.requirement,
          relicContext: ctx.entrees.relicContext,
          caches: ctx.caches,
        })
      );
      return { type: 'resultat', idContexte, idDemande, cle, resultat };
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      return {
        type: 'erreur',
        idContexte,
        idDemande,
        cle,
        nom: e.name,
        message: e.message,
        ...(err instanceof RechercheRefusee ? { vide: err.vide } : {}),
      };
    }
  }
}
