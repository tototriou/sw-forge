// degats-et-aura 6bis-b13bis-b — la résolution d'équipement HORS du fil de
// l'écran, côté écran : le module pur `ResolutionDistante`
// (`src/workers/resolutionDistante.ts`) et son branchement dans la file
// (`useArtifactOptimQueue`).
//
// Ce qui est prouvé ici :
// 1. le module est NEUTRE (aucune plateforme importée) ;
// 2. l'envoi : le contexte d'abord, seulement quand il y a du travail ; au
//    plus deux demandes sans réponse ; l'ordre des restants (page d'abord),
//    jamais retrié ;
// 3. l'annulation : un changement de page annule les demandes pas encore
//    commencées, jamais la plus ancienne en vol ;
// 4. les réponses PÉRIMÉES — d'un contexte remplacé (avant ET après que la
//    file l'a renvoyé) ou d'une demande annulée — ne sont JAMAIS écrites ;
// 5. le repli : un envoi qui lève ou une réponse d'erreur fait renoncer au
//    Worker, l'erreur passant par `repli`, jamais tue ;
//    5 bis. rien d'écrit ne reste non publié (6bis-b13bis-c) : une écriture
//    retenue par la cadence est publiée de force quand la file se vide
//    (réponse ignorée comprise) et au repli ;
// 6. différentiel : une file SIMULÉE — le module, le corps derrière
//    `structuredClone` (ce que fait `postMessage`), entrelacements aléatoires
//    à graine fixe, changements de page, de candidats et de contexte — remplit
//    un cache IDENTIQUE à la résolution directe de production
//    (`entreeResolutionDuBuild` + `resoudreEquipementDuBuild`), chaque
//    écriture contrôlée au moment où elle a lieu ; elle suit `publier` avec
//    la cadence du hook : sur toute file vide et à la fin, publié = cache ;
//    elle couvre aussi (6bis-b13bis-c) un repli en cours de route — réponse
//    d'erreur, envoi qui lève, repli du hook : cache intact, plus rien
//    d'envoyé ni d'écrit ensuite — et des entrées changées à signature
//    égale : nouveau contexte, cache gardé, comme le chemin direct ;
// 7. le hook et l'écran, contrôlés sur la source (le dépôt n'a pas
//    d'infrastructure de test React) ;
//    7 bis. le branchement gardé (6bis-b13bis-c) : chaque ligne visée par
//    les mutations de la revue du Worker a son contrôle de source précis ;
// 8. un seul producteur des runes d'un build (`runesDuBuild`), testé, et
//    passé par les deux résolutions de l'écran (6bis-b13bis-c).
//
// Les trois recettes gelées sur le compte réel : script de preuve du lot
// (`controle-6bis-b13bis-b.md`), qui réutilise `simulerFile` d'ici.

import { readFileSync } from 'node:fs';
import { RuneDetail } from '../src/types';
import { DegatsContext, RegimeArtefacts } from '../src/lib/artifactEvaluation';
import { ResultatArtefacts, cleBuild, prochainsATraiter } from '../src/lib/artifactQueue';
import { RelicContext } from '../src/lib/relicOptim';
import { BuildCandidate, SearchParams, searchBuilds } from '../src/lib/runeBuildOptim';
import { entreeResolutionDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild, runesDuBuild } from '../src/lib/relicQueue';
import { CorpsResolution, EntreesResolutionSerialisables, MessageVersResolution, ReponseResolution, entreesSerialisables } from '../src/workers/resolutionBody';
import { ContexteCourant, DEMANDES_EN_VOL_MAX, PortsResolutionDistante, ResolutionDistante, publicationForcee, repliSurErreur } from '../src/workers/resolutionDistante';
import { maxStatsActifsDe, runesDe } from '../scripts/lib/relicDifferentiel';
import { CORPUS_5A } from './relic-search.test';
import { DEGATS_FICHE } from './artifact-fiche.test';
import { inventaire } from './resolution-caches.test';
import { identiques } from './resolution-worker.test';
import { egal, ok, titre } from './outils';

// Générateur à graine fixe (mulberry32).
function aleatoire(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const memeObjet = (a: unknown, b: unknown) => a === b;

function sansCommentaires(source: string): string {
  return source.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

// Un bloc de code, de sa déclaration à sa fermeture.
function bloc(src: string, debut: string, fin: string): string {
  const i = src.indexOf(debut);
  if (i < 0) return '';
  const j = src.indexOf(fin, i + debut.length);
  return j < 0 ? '' : src.slice(i, j + fin.length);
}

/* --------------------------------------------------------------------------
 * La file simulée — exportée pour le script de preuve sur les recettes
 * ----------------------------------------------------------------------- */

export interface ContexteSimule {
  entrees: EntreesResolutionSerialisables;
  // La résolution directe de PRODUCTION de ce contexte (la référence).
  reference: (c: BuildCandidate) => ResultatArtefacts;
}

export interface ScenarioFile {
  graine: number;
  // L'ordre de base complet ; avec `progressif`, il arrive par paquets.
  triees: BuildCandidate[];
  runesDe: (c: BuildCandidate) => RuneDetail[];
  // Au moins un ; la simulation passe de l'un à l'autre (changement de
  // signature : le hook remplace alors son cache par une `Map` vide).
  contextes: ContexteSimule[];
  K: number;
  taillePage: number;
  // Événements aléatoires avant la vidange finale.
  pas: number;
  changementsDeContexte: number;
  progressif: boolean;
  /**
   * 6bis-b13bis-c — changements des ENTRÉES à signature égale (nouvelle
   * recherche aux mêmes réglages, par exemple) : le rendu passe au contexte
   * suivant SANS changer la signature, l'effet du Worker ne repart pas et le
   * cache est GARDÉ, comme sur le chemin direct ; le module doit renvoyer un
   * contexte. Absent = aucun.
   */
  changementsDEntrees?: number;
  /**
   * 6bis-b13bis-c — un repli EN COURS DE ROUTE, et son origine : réponse
   * d'erreur du corps (`erreur`), envoi qui lève (`envoi`) — tous deux passent
   * par le module —, ou repli du hook (`hook` : erreur du Worker, branchée
   * comme `basculerEnRepli` — `renoncer`, publication forcée s'il rend vrai).
   * Le cache doit rester intact, et plus rien n'est envoyé ni écrit ensuite,
   * même si des réponses arrivent encore. Absent = aucun repli attendu.
   */
  repli?: 'erreur' | 'envoi' | 'hook';
}

export interface BilanFile {
  ecritures: number;
  // Réponses arrivées alors que leur contexte était déjà remplacé, et
  // réponses à une demande annulée par l'écran : toutes doivent être ignorées.
  reponsesPerimeesRecues: number;
  reponsesAnnuleesRecues: number;
  contextesEnvoyes: number;
  annulationsEnvoyees: number;
  changementsDePage: number;
  maxEnVol: number;
  maxFileDuCorps: number;
  cacheFinal: number;
  // 6bis-b13bis-c : publications effectives (forcées comprises), retenues par
  // la cadence, et contrôles « publié = cache » faits sur une file vide.
  publications: number;
  publicationsForcees: number;
  publicationsRetenues: number;
  controlesPublication: number;
  // 6bis-b13bis-c : contextes renvoyés après un changement des entrées à
  // signature égale, entrées du cache gardées à ce changement, entrées d'un
  // ancien contexte encore en cache à la fin (gardées, comme le chemin direct).
  contextesSurEntrees: number;
  entreesGardees: number;
  entreesAnciennesFinales: number;
  // 6bis-b13bis-c : le repli est-il survenu, et combien de réponses sont
  // encore arrivées après lui (toutes ignorées).
  repliSurvenu: boolean;
  reponsesApresRepli: number;
  // Vide = conforme.
  ecarts: string[];
}

/**
 * La cadence de publication du hook (`PUBLICATION_MS`, 400 ms, non exportée :
 * le hook importe React), sur une horloge simulée qui avance à chaque
 * événement de 0 à 119 ms — la cadence retient donc souvent une publication.
 */
const CADENCE_SIMULEE_MS = 400;

/**
 * La file branchée comme dans le hook (`pomper` au rendu et après chaque
 * réponse, `surReponse` à chaque message), le corps de l'autre côté de
 * `structuredClone`. L'ordre des événements est tiré au hasard (graine fixe) :
 * livraison d'un message au corps, étape du corps (l'ordre entre sa minuterie
 * et un message en attente n'est pas garanti par la plateforme), livraison
 * d'une réponse à l'écran, rendu, changement de page, nouveaux candidats,
 * changement de contexte — en DEUX temps, comme dans React : le rendu met à
 * jour les refs (le contexte courant change), puis l'effet remplace le cache et
 * relance la file ; entre les deux, des réponses peuvent arriver.
 *
 * Contrôles :
 * - à chaque écriture, la réponse est celle d'une demande non annulée du
 *   contexte COURANT (contrôle indépendant des valeurs, par les identifiants
 *   observés à l'envoi) et elle est identique à la référence de production ;
 * - au plus `DEMANDES_EN_VOL_MAX` demandes sans réponse, à tout instant ;
 * - la PUBLICATION (6bis-b13bis-c) : `publier` est suivi avec la cadence du
 *   hook sur une horloge simulée ; après chaque appel du module (rendu,
 *   effet, réponse), si la file est vide, ce que l'écran a reçu égale le
 *   cache — sinon une écriture resterait non publiée, plus rien ne
 *   publiant ;
 * - toute demande part sous le contexte COURANT (index et signature) : après
 *   un changement des entrées à signature égale, le module renvoie un
 *   contexte avant de redemander (6bis-b13bis-c) ;
 * - repli en cours de route (6bis-b13bis-c) : à cet instant l'écran a reçu
 *   le cache ; ensuite plus aucun envoi, plus aucune écriture, et le cache
 *   reste le même objet, entrées inchangées, jusqu'à la fin ;
 * - après vidange : chaque demande a reçu exactement une réponse, chaque
 *   entrée du cache est identique à la référence du contexte sous lequel
 *   elle a été écrite (le contexte final, sauf entrées gardées d'un
 *   changement à signature égale), ce qui est publié égale le cache ; sans
 *   repli attendu, la file est vide (`prochainsATraiter` ne rend plus rien)
 *   et le module n'a pas renoncé.
 */
export function simulerFile(s: ScenarioFile): BilanFile {
  const r = aleatoire(s.graine);
  // L'horloge a sa propre graine : la suite des événements ne change pas.
  const rHorloge = aleatoire(s.graine ^ 0x2545f491);
  const pilote = new ResolutionDistante();
  const corps = new CorpsResolution();
  const versCorps: MessageVersResolution[] = [];
  const versEcran: ReponseResolution[] = [];
  const ecarts: string[] = [];
  const bilan: BilanFile = {
    ecritures: 0, reponsesPerimeesRecues: 0, reponsesAnnuleesRecues: 0, contextesEnvoyes: 0, annulationsEnvoyees: 0,
    changementsDePage: 0, maxEnVol: 0, maxFileDuCorps: 0, cacheFinal: 0,
    publications: 0, publicationsForcees: 0, publicationsRetenues: 0, controlesPublication: 0,
    contextesSurEntrees: 0, entreesGardees: 0, entreesAnciennesFinales: 0, repliSurvenu: false, reponsesApresRepli: 0, ecarts,
  };
  let cache = new Map<string, ResultatArtefacts>();
  // Sous quel contexte (index) chaque entrée du cache a été écrite.
  // et sous quelle génération d'entrées (une de plus à chaque changement à
  // signature égale : avec deux contextes, l'index seul revient au départ).
  let ecriteSous = new Map<string, { ctx: number; generation: number }>();
  let generationEntrees = 0;
  let entreesRestantes = s.changementsDEntrees ?? 0;
  // Les entrées ont changé à signature égale ; le prochain contexte envoyé est
  // celui qu'elles appellent.
  let entreesChangees = false;
  // Le repli en cours de route : armé à `pasDuRepli` (hors fenêtre rendu →
  // effet), survenu quand `repli` est appelé ; le cache et son contenu à cet
  // instant.
  const pasDuRepli = s.repli ? Math.floor(s.pas / 4) + (s.graine % Math.floor(s.pas / 2)) : Infinity;
  let repliArme = false;
  let erreurInjectee = false;
  let envoiLeve = false;
  let cacheAuRepli: Map<string, ResultatArtefacts> | null = null;
  let contenuAuRepli = new Map<string, ResultatArtefacts>();
  // Ce que l'écran a reçu (`setParBuild`), et la cadence du hook.
  let publie = new Map<string, ResultatArtefacts>();
  let horloge = 0;
  let dernierePublication = -Infinity;
  let ctx = 0;
  let numSignature = 0;
  let signature = 'signature-0';
  // Le rendu a changé de contexte, l'effet n'a pas encore tourné.
  let effetEnAttente = false;
  let changementsRestants = s.changementsDeContexte;
  let visibles = s.progressif ? Math.max(1, Math.ceil(s.triees.length / 4)) : s.triees.length;
  let page: BuildCandidate[] = s.triees.slice(0, s.taillePage);
  const parCle = new Map(s.triees.map((c) => [cleBuild(c), c]));
  const references = s.contextes.map(() => new Map<string, ResultatArtefacts>());
  const reference = (i: number, cle: string) => {
    let v = references[i]!.get(cle);
    if (v === undefined) {
      v = s.contextes[i]!.reference(parCle.get(cle)!);
      references[i]!.set(cle, v);
    }
    return v;
  };
  // Observé à l'envoi : à quel contexte (index, signature) appartient chaque
  // idContexte, à quel idContexte chaque demande, quelles demandes l'écran a
  // annulées. Indépendant du module.
  const contexteDeId = new Map<number, { ctx: number; signature: string }>();
  const dernierIdContexte = { v: 0 };
  const demandes = new Map<number, { idContexte: number; reponses: number }>();
  const annulees = new Set<number>();
  const ports: PortsResolutionDistante = {
    courant: (): ContexteCourant => ({ entrees: s.contextes[ctx]!.entrees, signature }),
    runesDe: s.runesDe,
    restants: () => prochainsATraiter(s.triees.slice(0, visibles), new Set(cache.keys()), s.K, page),
    page: () => page,
    cache: () => cache,
    envoyer: (m) => {
      if (bilan.repliSurvenu) ecarts.push(`envoi APRÈS le repli : ${m.type}`);
      // `postMessage` qui lève (clonage impossible), une fois, avant tout effet.
      if (repliArme && s.repli === 'envoi' && !envoiLeve) {
        envoiLeve = true;
        throw new DOMException('clonage impossible (simulé)', 'DataCloneError');
      }
      if (m.type === 'contexte') {
        bilan.contextesEnvoyes++;
        if (entreesChangees) bilan.contextesSurEntrees++;
        entreesChangees = false;
        contexteDeId.set(m.idContexte, { ctx, signature });
        dernierIdContexte.v = m.idContexte;
      } else if (m.type === 'resoudre') {
        if (demandes.has(m.idDemande)) ecarts.push(`demande #${m.idDemande} envoyée deux fois`);
        const sous = contexteDeId.get(m.idContexte);
        if (!sous || sous.ctx !== ctx || sous.signature !== signature) ecarts.push(`demande #${m.idDemande} envoyée sous un contexte qui n’est pas le courant (${m.idContexte})`);
        demandes.set(m.idDemande, { idContexte: m.idContexte, reponses: 0 });
      } else {
        bilan.annulationsEnvoyees++;
        if (m.idDemande !== undefined) annulees.add(m.idDemande);
      }
      versCorps.push(structuredClone(m));
    },
    // La publication du hook : même cadence, l'écran reçoit une copie du cache.
    publier: (forcer) => {
      if (!forcer && horloge - dernierePublication < CADENCE_SIMULEE_MS) {
        bilan.publicationsRetenues++;
        return false;
      }
      dernierePublication = horloge;
      publie = new Map(cache);
      bilan.publications++;
      if (forcer) bilan.publicationsForcees++;
      return true;
    },
    enAttente: () => {},
    repli: (raison, detail) => {
      if (!s.repli || bilan.repliSurvenu) ecarts.push(`repli inattendu : ${raison} — ${String(detail)}`);
      constaterRepli(`repli (${raison})`);
    },
  };
  const publieEgalCache = () => publie.size === cache.size && [...cache].every(([k, v]) => publie.get(k) === v);
  // Le repli vient d'avoir lieu : l'écran doit avoir reçu le cache, qui ne
  // doit plus bouger.
  function constaterRepli(moment: string) {
    bilan.repliSurvenu = true;
    cacheAuRepli = cache;
    contenuAuRepli = new Map(cache);
    if (!publieEgalCache()) ecarts.push(`${moment} : l’écran n’a pas reçu le cache (${publie.size} publiés, ${cache.size} en cache)`);
  }
  // Le repli du HOOK (erreur du Worker, réponse illisible), branché comme
  // `basculerEnRepli` : `renoncer`, puis publication forcée s'il rend vrai.
  const repliDuHook = () => {
    if (pilote.renoncer()) {
      publie = new Map(cache);
      bilan.publications++;
      bilan.publicationsForcees++;
    }
    constaterRepli('repli du hook');
  };
  // Après un appel du module : une file vide — ou repliée — ne publiera plus
  // rien d'elle-même.
  const controlerPublication = (moment: string) => {
    if (ports.restants().length > 0 && !bilan.repliSurvenu) return;
    bilan.controlesPublication++;
    if (!publieEgalCache()) ecarts.push(`${moment} : file vide, mais l’écran n’a pas reçu le cache (${publie.size} publiés, ${cache.size} en cache)`);
  };
  const surveiller = () => {
    let sansReponse = 0;
    for (const d of demandes.values()) if (d.reponses === 0) sansReponse++;
    bilan.maxEnVol = Math.max(bilan.maxEnVol, sansReponse, pilote.demandesEnVol);
    bilan.maxFileDuCorps = Math.max(bilan.maxFileDuCorps, corps.demandesEnAttente);
    if (sansReponse > DEMANDES_EN_VOL_MAX) ecarts.push(`${sansReponse} demandes sans réponse (> ${DEMANDES_EN_VOL_MAX})`);
  };

  const livrerAuCorps = () => {
    const m = versCorps.shift()!;
    for (const rep of corps.recevoir(m)) versEcran.push(structuredClone(rep));
  };
  const etapeDuCorps = () => {
    let rep = corps.etape();
    // La résolution lève dans le Worker : la réponse devient une erreur, une fois.
    if (rep && rep.type === 'resultat' && repliArme && s.repli === 'erreur' && !erreurInjectee) {
      erreurInjectee = true;
      rep = { type: 'erreur', idContexte: rep.idContexte, idDemande: rep.idDemande, cle: rep.cle, nom: 'Error', message: 'erreur simulée dans la résolution' };
    }
    if (rep) versEcran.push(structuredClone(rep));
  };
  const livrerALEcran = () => {
    const rep = versEcran.shift()!;
    const d = demandes.get(rep.idDemande);
    if (!d) ecarts.push(`réponse à une demande jamais envoyée #${rep.idDemande}`);
    else d.reponses++;
    const repliAvantReponse = bilan.repliSurvenu;
    if (repliAvantReponse) bilan.reponsesApresRepli++;
    const origine = contexteDeId.get(rep.idContexte);
    const perimee = !origine || origine.ctx !== ctx || origine.signature !== signature || rep.idContexte !== dernierIdContexte.v;
    if (rep.type === 'resultat' && perimee) bilan.reponsesPerimeesRecues++;
    if (rep.type === 'resultat' && annulees.has(rep.idDemande)) bilan.reponsesAnnuleesRecues++;
    const cacheAvant = cache;
    pilote.surReponse(rep, ports);
    if (rep.type === 'resultat' && cacheAvant.get(rep.cle) === rep.resultat) {
      bilan.ecritures++;
      if (cacheAvant === cache) ecriteSous.set(rep.cle, { ctx, generation: generationEntrees });
      // (Un envoi qui lève APRÈS cette écriture, dans le même tour, déclenche
      // le repli : seul compte un repli antérieur à la réponse.)
      if (repliAvantReponse) ecarts.push(`écriture APRÈS le repli : #${rep.idDemande} ${rep.cle}`);
      if (perimee) ecarts.push(`réponse PÉRIMÉE écrite : #${rep.idDemande} (contexte ${rep.idContexte}, courant ${dernierIdContexte.v}) ${rep.cle}`);
      if (annulees.has(rep.idDemande)) ecarts.push(`réponse d’une demande ANNULÉE écrite : #${rep.idDemande} ${rep.cle}`);
      if (cacheAvant === cache && !identiques(rep.resultat, reference(ctx, rep.cle))) ecarts.push(`écriture différente de la résolution directe : ${rep.cle}`);
    }
    controlerPublication(`réponse #${rep.idDemande} (${rep.type})`);
  };
  const rendu = () => {
    pilote.pomper(ports);
    controlerPublication('rendu');
  };
  const changerDePage = () => {
    bilan.changementsDePage++;
    const n = s.triees.slice(0, visibles).length;
    const pages = Math.max(1, Math.ceil(n / s.taillePage));
    const p = Math.floor(r() * pages);
    page = s.triees.slice(0, visibles).slice(p * s.taillePage, (p + 1) * s.taillePage);
  };
  const changerDeContexte = () => {
    changementsRestants--;
    ctx = (ctx + 1) % s.contextes.length;
    signature = `signature-${++numSignature}`;
    effetEnAttente = true;
  };
  // Les entrées changent, PAS la signature : le rendu met à jour les refs,
  // l'effet du Worker ne repart pas (ses dépendances n'ont pas changé), le
  // cache est gardé ; c'est le prochain `pomper` qui renvoie le contexte.
  const changerDEntrees = () => {
    entreesRestantes--;
    ctx = (ctx + 1) % s.contextes.length;
    generationEntrees++;
    entreesChangees = true;
    bilan.entreesGardees += cache.size;
  };
  const effetDuContexte = () => {
    effetEnAttente = false;
    cache = new Map();
    ecriteSous = new Map();
    // L'effet de la signature publie le cache vide (`setParBuild(new Map())`) ;
    // l'effet du Worker repart, cadence remise à zéro.
    publie = new Map();
    dernierePublication = -Infinity;
    pilote.pomper(ports);
    controlerPublication('effet du nouveau contexte');
  };

  for (let pas = 0; pas < s.pas; pas++) {
    horloge += Math.floor(rHorloge() * 120);
    // Le repli s'arme hors de la fenêtre rendu → effet : un effet de signature
    // en attente remplacerait le cache, ce qui n'est pas l'affaire du repli.
    if (!repliArme && pas >= pasDuRepli && !effetEnAttente) {
      repliArme = true;
      if (s.repli === 'hook') repliDuHook();
    }
    const choix: [number, () => void][] = [];
    if (versCorps.length) choix.push([3, livrerAuCorps]);
    if (corps.demandesEnAttente > 0) choix.push([3, etapeDuCorps]);
    if (versEcran.length) choix.push([3, livrerALEcran]);
    if (effetEnAttente) choix.push([2, effetDuContexte]);
    else choix.push([2, rendu]);
    choix.push([0.4, changerDePage]);
    if (visibles < s.triees.length) choix.push([0.4, () => { visibles = Math.min(s.triees.length, visibles + Math.max(1, Math.ceil(s.triees.length / 6))); }]);
    // Après le repli, plus de changement de contexte : le cache doit rester
    // celui du repli (un changement de signature le remplacerait, hors sujet).
    if (changementsRestants > 0 && !effetEnAttente && s.contextes.length > 1 && !repliArme) choix.push([0.15, changerDeContexte]);
    if (entreesRestantes > 0 && !effetEnAttente && s.contextes.length > 1 && !repliArme) choix.push([0.15, changerDEntrees]);
    const total = choix.reduce((n, [p]) => n + p, 0);
    let x = r() * total;
    const action = choix.find(([p]) => (x -= p) < 0)?.[1] ?? choix[choix.length - 1]![1];
    action();
    surveiller();
  }
  // Vidange : tous les candidats arrivés, plus aucun changement.
  visibles = s.triees.length;
  for (let garde = 0; garde < 1_000_000; garde++) {
    horloge += Math.floor(rHorloge() * 120);
    if (!repliArme && s.repli && !effetEnAttente) {
      repliArme = true;
      if (s.repli === 'hook') repliDuHook();
    }
    if (effetEnAttente) effetDuContexte();
    else if (versCorps.length) livrerAuCorps();
    else if (corps.demandesEnAttente > 0) etapeDuCorps();
    else if (versEcran.length) livrerALEcran();
    else {
      const avant = versCorps.length;
      rendu();
      if (versCorps.length === avant) break;
    }
    surveiller();
  }
  for (const [id, d] of demandes) if (d.reponses !== 1) ecarts.push(`demande #${id} : ${d.reponses} réponse(s)`);
  // Chaque entrée = la référence du contexte sous lequel elle a été écrite :
  // le contexte final, ou un ancien gardé par un changement à signature égale.
  for (const [cle, v] of cache) {
    const o = ecriteSous.get(cle);
    if (o === undefined) ecarts.push(`entrée du cache sans écriture observée : ${cle}`);
    else if (!identiques(v, reference(o.ctx, cle))) ecarts.push(`cache final ≠ résolution directe de son contexte : ${cle}`);
    else if (o.generation !== generationEntrees) bilan.entreesAnciennesFinales++;
  }
  if (!publieEgalCache()) ecarts.push(`à la fin : ce qui est publié (${publie.size}) ≠ le cache (${cache.size})`);
  if (s.repli) {
    // Le chemin direct reprendrait ici ; le module, lui, n'a plus rien touché.
    if (!bilan.repliSurvenu || !pilote.enRepli) ecarts.push(`repli attendu (${s.repli}), jamais survenu`);
    // (`cacheAuRepli` est posé dans une fermeture : `tsc` le croit toujours nul.)
    else if (!memeObjet(cache, cacheAuRepli) || cache.size !== contenuAuRepli.size || [...contenuAuRepli].some(([k, v]) => cache.get(k) !== v)) {
      ecarts.push('le cache a changé après le repli');
    }
  } else {
    const restants = ports.restants();
    if (restants.length) ecarts.push(`file non vidée : ${restants.length} build(s) restant(s)`);
    if (pilote.enRepli) ecarts.push('le module a renoncé au Worker');
  }
  bilan.cacheFinal = cache.size;
  return bilan;
}

/* --------------------------------------------------------------------------
 * Les tests
 * ----------------------------------------------------------------------- */

const b = (...ids: number[]) => ({ runeIds: ids }) as unknown as BuildCandidate;
const E1 = { nom: 'E1' } as unknown as EntreesResolutionSerialisables;
const E2 = { nom: 'E2' } as unknown as EntreesResolutionSerialisables;
const sansRunes = () => [] as RuneDetail[];
const res = (n: number) => ({ n }) as unknown as ResultatArtefacts;
const resume = (ms: MessageVersResolution[]) =>
  ms.map((m) => (m.type === 'resoudre' ? `resoudre ${m.cle}#${m.idDemande}@${m.idContexte}` : m.type === 'contexte' ? `contexte@${m.idContexte}` : `annuler #${m.idDemande ?? '*'}`));
const resultat = (idContexte: number, idDemande: number, cle: string, n = idDemande): ReponseResolution => ({ type: 'resultat', idContexte, idDemande, cle, resultat: res(n) });

export function testResolutionDistante() {
  titre('Résolution hors du fil de l’écran — le module côté écran (6bis-b13bis-b)');

  /* ── 1. Neutralité ───────────────────────────────────────────────────── */
  const source = sansCommentaires(readFileSync('src/workers/resolutionDistante.ts', 'utf8'));
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
  ok(imports.length > 0 && imports.every((i) => i.startsWith('../lib/') || i === '../types' || i === './resolutionBody'),
    `module : n’importe que la bibliothèque pure et le protocole (${imports.join(', ')})`);
  ok(!/\b(self|postMessage|importScripts|window|document|parentPort|workerData|useEffect|useRef)\b|\bnew Worker\b|\bWorker\(/.test(source),
    'module : aucune référence à self, postMessage, new Worker, window, document, React ni aux fils Node (hors commentaires)');
  egal(DEMANDES_EN_VOL_MAX, 2, 'au plus deux demandes sans réponse');

  /* ── 2. Envoi ────────────────────────────────────────────────────────── */
  titre('Résolution hors du fil — envoi, annulation, réponses périmées');
  const c1: ContexteCourant = { entrees: E1, signature: 's' };
  const p = new ResolutionDistante();
  egal(resume(p.planifier(c1, [], sansRunes)), [], 'rien à traiter : aucun contexte envoyé (l’inventaire ne part pas pour rien)');
  egal(resume(p.planifier(null, [b(1)], sansRunes)), [], 'pas de contexte courant : rien');
  egal(resume(p.planifier(c1, [b(1), b(2), b(3)], sansRunes)), ['contexte@1', 'resoudre 1#1@1', 'resoudre 2#2@1'],
    'le contexte d’abord, puis deux demandes dans l’ordre des restants');
  egal(resume(p.planifier(c1, [b(1), b(2), b(3)], sansRunes)), [], 'idempotent : un second tour sans réponse n’envoie rien');
  egal(resume(p.planifier({ entrees: E1, signature: 's' }, [b(1), b(2), b(3)], sansRunes)), [],
    'un contexte égal par identité des entrées et valeur de la signature (objet englobant neuf) ne se renvoie pas');
  const cache = new Map<string, ResultatArtefacts>();
  egal(p.recevoir(resultat(1, 1, '1'), cache, c1), { issue: 'ecrite', cle: '1' }, 'une réponse du contexte courant est écrite…');
  ok((cache.get('1') as unknown as { n: number } | undefined)?.n === 1, '… sous la clé du build');
  egal(resume(p.planifier(c1, [b(2), b(3)], sansRunes)), ['resoudre 3#3@1'], 'une place libérée : la demande suivante part');
  let leve = '';
  try {
    p.planifier(c1, [b(2), b(3), b(4)], () => {
      throw new Error('ne doit pas être appelé');
    });
  } catch (e) {
    leve = (e as Error).message;
  }
  egal(leve, '', 'deux demandes sans réponse : aucune de plus (runesDe jamais appelé)');

  /* ── 3. Annulation ───────────────────────────────────────────────────── */
  egal(resume(p.planifier(c1, [b(7), b(8), b(2), b(3)], sansRunes)), ['annuler #3'],
    'changement de page : la demande pas encore commencée est annulée, la plus ancienne en vol (#2) est gardée');
  egal(resume(p.planifier(c1, [b(7), b(8), b(2), b(3)], sansRunes)), [], 'l’annulée compte encore tant que sa réponse n’est pas revenue');
  egal(p.recevoir({ type: 'annule', idContexte: 1, idDemande: 3, cle: '3', motif: 'demande' }, cache, c1), { issue: 'ignoree', motif: 'annulee-par-le-corps' },
    'la réponse « annulée » libère la place');
  egal(resume(p.planifier(c1, [b(7), b(8), b(2), b(3)], sansRunes)), ['resoudre 7#4@1'], 'la page passe devant');
  egal(p.recevoir(resultat(1, 2, '2'), cache, c1), { issue: 'ecrite', cle: '2' }, 'la plus ancienne, gardée, est écrite : son résultat reste juste pour ce contexte');
  {
    const q = new ResolutionDistante();
    q.planifier(c1, [b(1), b(2)], sansRunes);
    q.planifier(c1, [b(5), b(6)], sansRunes);
    egal(q.recevoir(resultat(1, 2, '2'), new Map(), c1), { issue: 'ignoree', motif: 'demande-annulee' },
      'le résultat d’une demande annulée par l’écran (arrivé quand même) n’est jamais écrit');
  }

  /* ── 4. Réponses périmées ────────────────────────────────────────────── */
  const c2: ContexteCourant = { entrees: E2, signature: 's' };
  egal(p.recevoir(resultat(1, 4, '7'), cache, c2), { issue: 'ignoree', motif: 'contexte-perime' },
    'contexte changé au rendu, pas encore renvoyé (même idContexte) : la réponse de l’ancien n’est PAS écrite');
  ok(!cache.has('7'), '… le cache ne la contient pas');
  egal(resume(p.planifier(c2, [b(7), b(8)], sansRunes)), ['contexte@2', 'resoudre 7#5@2', 'resoudre 8#6@2'], 'le nouveau contexte part, avec ses demandes');
  const c3: ContexteCourant = { entrees: E2, signature: 's2' };
  egal(resume(p.planifier(c3, [b(7), b(8)], sansRunes)), ['contexte@3'],
    'signature changée (mêmes entrées) : nouveau contexte ; les demandes en vol de l’ancien restent comptées, sans annulation (le corps s’en charge)');
  egal(p.recevoir(resultat(2, 5, '7'), cache, c3), { issue: 'ignoree', motif: 'demande-annulee' },
    'contexte renvoyé : la réponse d’une demande de l’ancien n’est PAS écrite');
  egal(p.recevoir({ type: 'annule', idContexte: 2, idDemande: 6, cle: '8', motif: 'contexte' }, cache, c3), { issue: 'ignoree', motif: 'annulee-par-le-corps' },
    'la demande de l’ancien contexte que le corps n’avait pas commencée revient « annulée, motif contexte »');
  ok(!cache.has('7') && !cache.has('8'), '… rien de l’ancien contexte dans le cache');
  egal(resume(p.planifier(c3, [b(7), b(8)], sansRunes)), ['resoudre 7#7@3', 'resoudre 8#8@3'], 'puis les demandes du nouveau');
  egal(p.recevoir(resultat(2, 7, '7'), cache, c3), { issue: 'ignoree', motif: 'contexte-perime' }, 'un idContexte faux sur une demande courante : ignoré');
  egal(p.recevoir(resultat(3, 99, '7'), cache, c3), { issue: 'ignoree', motif: 'demande-inconnue' }, 'une demande inconnue : ignorée');
  egal(p.recevoir(resultat(3, 8, '9'), cache, c3), { issue: 'ignoree', motif: 'cle-differente' }, 'une clé qui ne correspond pas à la demande : ignorée');
  {
    const q = new ResolutionDistante();
    q.planifier(c1, [b(1), b(2)], sansRunes);
    egal(resume(q.planifier(c2, [], sansRunes)), ['annuler #2'], 'contexte changé sans rien à traiter : pas de contexte envoyé, la demande non commencée est annulée');
    egal(q.recevoir(resultat(1, 1, '1'), new Map(), null), { issue: 'ignoree', motif: 'contexte-perime' }, 'sans contexte courant (courant nul) : rien n’est écrit, la place se libère');
    egal(q.demandesEnVol, 1, '… et une seule demande reste en vol (l’annulée, jusqu’à sa réponse)');
    const r = new ResolutionDistante();
    r.planifier(c1, [b(1)], sansRunes);
    egal(r.recevoir(resultat(1, 1, '1'), null, c1), { issue: 'ignoree', motif: 'contexte-perime' }, 'hors effet actif (cache nul), même du contexte courant : rien n’est écrit, la place se libère');
    egal(r.demandesEnVol, 0, '… plus rien en vol');
  }

  /* ── 5. Erreurs et repli ─────────────────────────────────────────────── */
  titre('Résolution hors du fil — erreurs, repli, publication');
  {
    const q = new ResolutionDistante();
    q.planifier(c1, [b(1), b(2)], sansRunes);
    q.planifier(c2, [b(1), b(2)], sansRunes);
    egal(q.recevoir({ type: 'erreur', idContexte: 1, idDemande: 1, cle: '1', nom: 'Error', message: 'boum' }, new Map(), c2),
      { issue: 'erreur', nom: 'Error', message: 'boum' }, 'une erreur n’est jamais tue, même d’une demande caduque');
    q.renoncer();
    ok(q.enRepli && q.demandesEnVol === 0, 'renoncer : plus de demande en vol');
    egal(resume(q.planifier(c1, [b(1)], sansRunes)), [], 'après repli : plus rien n’est envoyé');
    const m = new Map<string, ResultatArtefacts>();
    q.recevoir(resultat(2, 3, '1'), m, c2);
    ok(m.size === 0, 'après repli : plus rien n’est écrit');
  }
  type Trace = { envoyes: MessageVersResolution[]; publications: boolean[]; replis: string[]; details: unknown[]; enAttente: number[] };
  const portsDe = (o: { triees: BuildCandidate[]; page: BuildCandidate[]; K: number; cache: Map<string, ResultatArtefacts>; envoyer?: (m: MessageVersResolution) => void }) => {
    const t: Trace = { envoyes: [], publications: [], replis: [], details: [], enAttente: [] };
    const ports: PortsResolutionDistante = {
      courant: () => c1,
      runesDe: sansRunes,
      restants: () => prochainsATraiter(o.triees, new Set(o.cache.keys()), o.K, o.page),
      page: () => o.page,
      cache: () => o.cache,
      envoyer: o.envoyer ?? ((m) => t.envoyes.push(m)),
      // La cadence retient toute publication non forcée.
      publier: (f) => {
        t.publications.push(f);
        return f;
      },
      enAttente: (n) => t.enAttente.push(n),
      repli: (raison, detail) => {
        t.replis.push(`${raison} : ${String(detail)}`);
        t.details.push(detail);
      },
    };
    return { ports, t };
  };
  {
    const q = new ResolutionDistante();
    const { ports, t } = portsDe({ triees: [b(1), b(2)], page: [], K: 2, cache: new Map(), envoyer: () => { throw new DOMException('clonage impossible', 'DataCloneError'); } });
    q.pomper(ports);
    ok(q.enRepli && t.replis.length === 1 && /envoi au Worker impossible \(contexte\)/.test(t.replis[0]!) && /clonage impossible/.test(t.replis[0]!),
      `envoi qui lève (DataCloneError) : repli, erreur transmise (${t.replis[0]})`);
    q.pomper(ports);
    egal(t.replis.length, 1, 'après repli, pomper ne fait plus rien');
  }
  {
    const q = new ResolutionDistante();
    const cacheP = new Map<string, ResultatArtefacts>();
    const { ports, t } = portsDe({ triees: [b(1), b(2)], page: [], K: 2, cache: cacheP });
    q.pomper(ports);
    q.surReponse({ type: 'erreur', idContexte: 1, idDemande: 1, cle: '1', nom: 'RechercheRefusee', message: 'pool vide', vide: 'seuil' }, ports);
    ok(q.enRepli && t.replis.length === 1 && /RechercheRefusee/.test(t.replis[0]!) && cacheP.size === 0,
      `réponse d’erreur : repli, rien d’écrit (${t.replis[0]})`);
    egal(t.details, [{ nom: 'RechercheRefusee', message: 'pool vide', vide: 'seuil' }],
      'réponse d’erreur : le repli journalise le nom, le message ET le motif `vide` de la RechercheRefusee (6bis-b13bis-c)');
  }
  egal(repliSurErreur({ issue: 'erreur', nom: 'Error', message: 'boum' }),
    { raison: 'la résolution a levé dans le Worker (Error)', detail: { nom: 'Error', message: 'boum' } },
    'repliSurErreur : sans motif `vide`, le détail n’en invente pas');
  {
    // Publication : page [1, 2], file [1, 2, 3].
    const q = new ResolutionDistante();
    const cacheP = new Map<string, ResultatArtefacts>();
    const { ports, t } = portsDe({ triees: [b(1), b(2), b(3)], page: [b(1), b(2)], K: 3, cache: cacheP });
    q.pomper(ports);
    egal(resume(t.envoyes), ['contexte@1', 'resoudre 1#1@1', 'resoudre 2#2@1'], 'la page d’abord');
    q.surReponse(resultat(1, 1, '1'), ports);
    q.surReponse(resultat(1, 2, '2'), ports);
    q.surReponse(resultat(1, 3, '3'), ports);
    egal(t.publications, [false, true, true], 'publication : à la cadence, puis forcée au dernier build de la page et au dernier de la file');
    egal(t.enAttente, [3, 2, 1, 0], 'le compte en attente suit le cache');
    egal(resume(t.envoyes).slice(3), ['resoudre 3#3@1'], 'chaque réponse relance la file');
  }
  egal([publicationForcee('page', 'page'), publicationForcee('page', 'fond'), publicationForcee('page', 'aucune'), publicationForcee('fond', 'fond'), publicationForcee('fond', 'aucune')],
    [false, true, true, false, true], 'publicationForcee : la règle de la tranche directe');

  /* ── 5 bis. Rien d'écrit ne reste non publié (6bis-b13bis-c) ─────────── */
  titre('Résolution hors du fil — rien d’écrit ne reste non publié (6bis-b13bis-c)');
  {
    // File [1, 2], K = 3, pas de page ; `retient` : la cadence retient toute
    // publication non forcée. Le journal mêle publications et replis, dans
    // l'ordre ; `publie` est ce que l'écran a reçu.
    const monter = (retient: boolean) => {
      const e = { triees: [b(1), b(2)], courant: c1, cache: new Map<string, ResultatArtefacts>(), leverALEnvoi: false };
      const t = { journal: [] as string[], publie: new Map<string, ResultatArtefacts>() };
      const ports: PortsResolutionDistante = {
        courant: () => e.courant,
        runesDe: sansRunes,
        restants: () => prochainsATraiter(e.triees, new Set(e.cache.keys()), 3, []),
        page: () => [],
        cache: () => e.cache,
        envoyer: () => {
          if (e.leverALEnvoi) throw new DOMException('clonage impossible', 'DataCloneError');
        },
        publier: (f) => {
          t.journal.push(`publier(${f})`);
          if (!f && retient) return false;
          t.publie = new Map(e.cache);
          return true;
        },
        enAttente: () => {},
        repli: (raison) => t.journal.push(`repli : ${raison}`),
      };
      const publieEgalCache = () => t.publie.size === e.cache.size && [...e.cache].every(([k, v]) => t.publie.get(k) === v);
      return { e, t, ports, publieEgalCache };
    };
    {
      const q = new ResolutionDistante();
      const { e, t, ports, publieEgalCache } = monter(true);
      q.pomper(ports);
      q.surReponse(resultat(1, 1, '1'), ports);
      ok(q.ecritureNonPubliee && t.publie.size === 0 && e.cache.size === 1, 'une écriture retenue par la cadence : le module sait qu’elle attend');
      // Nouvelle recherche aux mêmes réglages : plus de candidats, nouvelles entrées.
      e.triees = [];
      e.courant = { entrees: E2, signature: 's' };
      q.pomper(ports);
      egal(t.journal, ['publier(false)', 'publier(true)'], 'la file se vide au rendu (nouvelle recherche) : publication FORCÉE de l’écriture retenue');
      ok(publieEgalCache() && !q.ecritureNonPubliee, '… l’écran a reçu le cache entier');
      q.surReponse(resultat(1, 2, '2'), ports);
      egal(t.journal, ['publier(false)', 'publier(true)'], 'la réponse de l’ancien contexte, ignorée, ne republie rien : une publication de plus, au plus');
    }
    {
      const q = new ResolutionDistante();
      const { e, t, ports, publieEgalCache } = monter(true);
      q.pomper(ports);
      q.surReponse(resultat(1, 1, '1'), ports);
      // Le rendu a changé les refs, l'effet de réveil n'est pas encore passé.
      e.triees = [];
      e.courant = { entrees: E2, signature: 's' };
      q.surReponse(resultat(1, 2, '2'), ports);
      egal(t.journal, ['publier(false)', 'publier(true)'], 'une réponse IGNORÉE vide la file : publication FORCÉE de l’écriture retenue');
      ok(publieEgalCache(), '… l’écran a reçu le cache entier');
    }
    {
      const q = new ResolutionDistante();
      const { t, ports, publieEgalCache } = monter(true);
      q.pomper(ports);
      q.surReponse(resultat(1, 1, '1'), ports);
      q.surReponse({ type: 'erreur', idContexte: 1, idDemande: 2, cle: '2', nom: 'Error', message: 'boum' }, ports);
      egal(t.journal, ['publier(false)', 'publier(true)', 'repli : la résolution a levé dans le Worker (Error)'],
        'repli sur une réponse d’erreur : l’écriture retenue est publiée de force, AVANT de rendre la main au chemin direct');
      ok(q.enRepli && publieEgalCache(), '… l’écran a reçu le cache entier');
    }
    {
      const q = new ResolutionDistante();
      const { e, t, ports, publieEgalCache } = monter(true);
      e.triees = [b(1), b(2), b(3)];
      q.pomper(ports);
      e.leverALEnvoi = true;
      q.surReponse(resultat(1, 1, '1'), ports);
      egal(t.journal, ['publier(false)', 'publier(true)', 'repli : envoi au Worker impossible (resoudre)'],
        'repli sur un envoi qui lève, juste après une écriture retenue : publication forcée avant le repli');
      ok(q.enRepli && publieEgalCache(), '… l’écran a reçu le cache entier');
    }
    {
      const q = new ResolutionDistante();
      const { ports } = monter(true);
      q.pomper(ports);
      q.surReponse(resultat(1, 1, '1'), ports);
      const premier = q.renoncer();
      const second = q.renoncer();
      ok(premier && !second && !q.ecritureNonPubliee,
        'renoncer rend VRAI s’il restait une écriture retenue — le hook publie alors de force (repli venu du Worker) — et une seule fois');
      ok(!new ResolutionDistante().renoncer(), 'renoncer sans écriture retenue rend faux : rien à publier');
    }
    {
      const q = new ResolutionDistante();
      const { e, t, ports, publieEgalCache } = monter(false);
      q.pomper(ports);
      q.surReponse(resultat(1, 1, '1'), ports);
      e.triees = [];
      e.courant = { entrees: E2, signature: 's' };
      q.pomper(ports);
      egal(t.journal, ['publier(false)'], 'une écriture que la cadence a laissée passer : la file vide ne republie rien');
      ok(publieEgalCache() && !q.ecritureNonPubliee, '… et l’écran a bien le cache entier');
    }
  }

  /* ── 6. Différentiel : file simulée = résolution directe ─────────────── */
  titre('Résolution hors du fil — file simulée contre la résolution directe de production');
  const PORTEUR = { element: 'fire' as const, archetype: 'attack' as const };
  const inv = inventaire(31, 12);
  const setupCrit = { ...DEGATS_FICHE.setup, critMode: 'crit' as const };
  const degatsCrit: DegatsContext = { ...DEGATS_FICHE, setup: setupCrit };
  const argsDe = (pp: SearchParams, regime: RegimeArtefacts, ctx: RelicContext | undefined) => ({
    fiche: { base: pp.base, runes: [], artifacts: [], relic: pp.relic },
    artifactParams: { porteur: PORTEUR, inventaire: inv, equipes: [], principaleParSorte: {}, lignesVerrouillees: [], maxStatsActifs: maxStatsActifsDe(pp),
      evaluer: (arts: { main: { value: number } }[]) => arts.reduce((n, a) => n + a.main.value, 0) },
    regime,
    degats: regime === 'degats_reels' ? degatsCrit : null,
    exclusive: { setup: setupCrit, element: 'fire' as const },
    requirement: pp.requirement,
    relicContext: ctx,
  });
  const contexteSimule = (pp: SearchParams, regime: RegimeArtefacts, ctx: RelicContext | undefined): ContexteSimule => {
    const args = argsDe(pp, regime, ctx);
    const caches = nouveauxCachesResolution();
    return {
      entrees: entreesSerialisables(args),
      reference: (c) => resoudreEquipementDuBuild(entreeResolutionDuBuild({ ...args, runes: runesDe(pp, c), caches })),
    };
  };
  let scenarios = 0;
  let ecritures = 0;
  let perimees = 0;
  let annuleesRecues = 0;
  let annulations = 0;
  let changementsPage = 0;
  let contextes = 0;
  let maxEnVol = 0;
  let publicationsRetenues = 0;
  let publicationsForcees = 0;
  let controlesPublication = 0;
  let contextesSurEntrees = 0;
  let entreesGardees = 0;
  let entreesAnciennesFinales = 0;
  let replis = 0;
  let reponsesApresRepli = 0;
  const tousEcarts: string[] = [];
  // Graines 1 à 6 : les files de 6bis-b13bis-b, inchangées. Graines 7 à 12
  // (6bis-b13bis-c) : entrées changées à signature égale (sans changement de
  // signature, qui viderait le cache : les entrées gardées vont jusqu'à la
  // fin), repli en cours de route par ses trois origines, puis les deux
  // ensemble.
  const VARIANTES: Partial<Pick<ScenarioFile, 'changementsDEntrees' | 'repli' | 'changementsDeContexte'>>[] = [
    { changementsDEntrees: 3, changementsDeContexte: 0 },
    { changementsDEntrees: 3, changementsDeContexte: 0 },
    { repli: 'erreur' },
    { repli: 'envoi' },
    { repli: 'hook', changementsDEntrees: 2 },
    { repli: 'erreur', changementsDEntrees: 2 },
  ];
  let scenariosARepli = 0;
  for (const fx of Object.values(CORPUS_5A)) {
    const pp: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const triees = searchBuilds(pp).candidates;
    if (triees.length < 3) continue;
    const ctxA = contexteSimule(pp, 'degats_reels', fx.ctx);
    const ctxB = contexteSimule(pp, 'ehp', undefined);
    for (let graine = 1; graine <= 6 + VARIANTES.length; graine++) {
      const bl = simulerFile({
        graine: graine * 7919 + triees.length, triees, runesDe: (c) => runesDe(pp, c), contextes: [ctxA, ctxB],
        K: Math.min(triees.length, 4 + (graine % 3) * 4), taillePage: 3 + (graine % 3), pas: 300, changementsDeContexte: 3, progressif: graine % 2 === 0,
        ...(graine > 6 ? VARIANTES[graine - 7] : {}),
      });
      scenarios++;
      if (graine > 6 && VARIANTES[graine - 7]!.repli) scenariosARepli++;
      contextesSurEntrees += bl.contextesSurEntrees;
      entreesGardees += bl.entreesGardees;
      entreesAnciennesFinales += bl.entreesAnciennesFinales;
      if (bl.repliSurvenu) replis++;
      reponsesApresRepli += bl.reponsesApresRepli;
      ecritures += bl.ecritures;
      perimees += bl.reponsesPerimeesRecues;
      annuleesRecues += bl.reponsesAnnuleesRecues;
      annulations += bl.annulationsEnvoyees;
      changementsPage += bl.changementsDePage;
      contextes += bl.contextesEnvoyes;
      maxEnVol = Math.max(maxEnVol, bl.maxEnVol);
      publicationsRetenues += bl.publicationsRetenues;
      publicationsForcees += bl.publicationsForcees;
      controlesPublication += bl.controlesPublication;
      tousEcarts.push(...bl.ecarts.map((e) => `${fx.nom} graine ${graine} : ${e}`));
    }
  }
  egal(tousEcarts.slice(0, 5), [], `${scenarios} files simulées : chaque écriture = résolution directe du contexte courant, toute demande sous le contexte courant, cache final identique à la résolution directe de son contexte, une réponse par demande, publié = cache sur toute file vide, au repli et à la fin ; sans repli attendu, file vidée et aucun repli ; avec repli, cache intact et plus rien d’envoyé ni d’écrit ensuite`);
  ok(contextesSurEntrees > 0 && entreesGardees > 0 && entreesAnciennesFinales > 0,
    `couverture des entrées changées à signature égale : ${contextesSurEntrees} contextes renvoyés, ${entreesGardees} entrées gardées au changement, ${entreesAnciennesFinales} entrées d’un ancien contexte encore en cache à la fin (gardées, comme le chemin direct)`);
  ok(replis === scenariosARepli && reponsesApresRepli > 0,
    `couverture du repli en cours de route : ${replis} replis survenus sur ${scenariosARepli} files qui l’attendaient (réponse d’erreur, envoi qui lève, repli du hook), ${reponsesApresRepli} réponses arrivées après lui, toutes ignorées`);
  ok(ecritures > 200 && perimees > 0 && annuleesRecues > 0 && annulations > 0 && changementsPage > 0 && contextes > scenarios,
    `couverture : ${ecritures} écritures, ${perimees} réponses périmées reçues (ignorées), ${annuleesRecues} réponses de demandes annulées reçues (ignorées), ${annulations} annulations, ${changementsPage} changements de page, ${contextes} contextes envoyés`);
  ok(publicationsRetenues > 0 && publicationsForcees > 0 && controlesPublication > scenarios,
    `couverture de la publication : ${publicationsRetenues} retenues par la cadence, ${publicationsForcees} forcées, ${controlesPublication} contrôles « publié = cache » sur une file vide`);
  ok(maxEnVol <= DEMANDES_EN_VOL_MAX && maxEnVol > 1, `au plus ${DEMANDES_EN_VOL_MAX} demandes sans réponse à tout instant (maximum observé ${maxEnVol})`);
  {
    // Précondition de sensibilité : les deux contextes donnent des résultats
    // différents — sinon une réponse périmée écrite passerait inaperçue des
    // contrôles de valeur (le contrôle par identifiants, lui, la verrait).
    const fx = CORPUS_5A.G;
    const pp: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const triees = searchBuilds(pp).candidates;
    const ctxA = contexteSimule(pp, 'degats_reels', fx.ctx);
    const ctxB = contexteSimule(pp, 'ehp', undefined);
    const differents = triees.filter((c) => !identiques(ctxA.reference(c), ctxB.reference(c))).length;
    ok(differents > triees.length / 2, `précondition : les deux contextes diffèrent sur ${differents} build(s) sur ${triees.length} (G)`);
  }
  {
    // Scénario déterministe : un résultat de l'ancien contexte arrive APRÈS
    // le changement, dans la fenêtre rendu → effet puis après le renvoi.
    const fx = CORPUS_5A.G;
    const pp: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const triees = searchBuilds(pp).candidates;
    const ctxA = contexteSimule(pp, 'degats_reels', fx.ctx);
    const ctxB = contexteSimule(pp, 'ehp', undefined);
    const ecrit: string[] = [];
    for (const fenetre of ['avant-renvoi', 'apres-renvoi'] as const) {
      const q = new ResolutionDistante();
      const corps = new CorpsResolution();
      let courant: ContexteCourant = { entrees: ctxA.entrees, signature: 'a' };
      let cacheD = new Map<string, ResultatArtefacts>();
      const versEcran: ReponseResolution[] = [];
      const portsD: PortsResolutionDistante = {
        courant: () => courant, runesDe: (c) => runesDe(pp, c),
        restants: () => prochainsATraiter(triees, new Set(cacheD.keys()), 4, triees.slice(0, 2)),
        page: () => triees.slice(0, 2), cache: () => cacheD,
        envoyer: (m) => { for (const rr of corps.recevoir(structuredClone(m))) versEcran.push(structuredClone(rr)); },
        publier: () => true, enAttente: () => {}, repli: (raison) => ecrit.push(`repli ${raison}`),
      };
      q.pomper(portsD);
      const r1 = corps.etape()!;
      courant = { entrees: ctxB.entrees, signature: 'b' };
      if (fenetre === 'apres-renvoi') {
        cacheD = new Map();
        q.pomper(portsD);
      }
      const avant = cacheD.size;
      q.surReponse(structuredClone(r1), portsD);
      if (cacheD.size !== avant || cacheD.has(r1.cle)) ecrit.push(`${fenetre} : ${r1.cle} écrit`);
      for (let rr = corps.etape(); rr; rr = corps.etape()) versEcran.push(structuredClone(rr));
      while (versEcran.length) q.surReponse(versEcran.shift()!, portsD);
      for (let i = 0; i < 20; i++) {
        q.pomper(portsD);
        for (let rr = corps.etape(); rr; rr = corps.etape()) versEcran.push(structuredClone(rr));
        while (versEcran.length) q.surReponse(versEcran.shift()!, portsD);
      }
      for (const [cle, v] of cacheD) if (!identiques(v, ctxB.reference(triees.find((c) => cleBuild(c) === cle)!))) ecrit.push(`${fenetre} : ${cle} ≠ référence du nouveau contexte`);
    }
    egal(ecrit, [], 'un résultat de l’ancien contexte arrivé après le changement (avant puis après le renvoi du contexte) n’est jamais écrit ; le cache final suit le nouveau contexte');
  }

  /* ── 7. Le hook et l'écran, contrôlés sur la source ──────────────────── */
  titre('Résolution hors du fil — le hook et l’écran, contrôlés sur la source');
  const hook = sansCommentaires(readFileSync('src/hooks/useArtifactOptimQueue.ts', 'utf8'));
  egal((hook.match(/new Worker\(/g) ?? []).length, 1, 'hook : un seul `new Worker(`');
  const effetWorker = bloc(hook, 'if (!modeHorsFil) return;', '}, [modeHorsFil, signature, K, basculerEnRepli]);');
  ok(effetWorker.length > 0 && /new Worker\(new URL\('\.\.\/workers\/resolution\.worker\.ts', import\.meta\.url\), \{ type: 'module' \}\)/.test(effetWorker),
    'hook : le Worker de résolution est créé DANS l’effet (jamais au rendu), patron de useBuildOptimSearch');
  ok(/let d = distantRef\.current;\s*if \(!d\) \{\s*try \{/.test(effetWorker), 'hook : créé une seule fois (ref), au premier besoin ; une création qui lève est rattrapée');
  ok(/useEffect\(\s*\(\) => \(\) => \{\s*distantRef\.current\?\.worker\.terminate\(\);\s*distantRef\.current = null;\s*\},\s*\[\]\s*\);/.test(hook),
    'hook : le Worker est terminé au démontage (effet sans dépendance) — jamais un Worker par recherche');
  ok(/const modeHorsFil = horsFil !== null && opts\.resoudre !== null && !enRepli;/.test(hook) && /const resoudre = modeHorsFil \? null : opts\.resoudre;/.test(hook),
    'hook : en mode Worker, le chemin direct dort (`resoudre` nul) ; le repli le réveille');
  egal((hook.match(/cacheRef\.current\.set\(/g) ?? []).length, 1, 'hook : une seule écriture directe dans le cache — celle du chemin direct ; le mode Worker n’écrit que par le module');
  ok(/distant\.pilote\.surReponse\(r, ports\)/.test(effetWorker) && /distant\.pilote\.pomper\(ports\)/.test(effetWorker), 'hook : les réponses et les tours de file passent par le module');
  ok(/worker\.onerror = \(e: ErrorEvent\) => basculerEnRepli\(/.test(effetWorker) && /worker\.onmessageerror = \(e: MessageEvent\) => basculerEnRepli\(/.test(effetWorker)
    && /basculerEnRepli\('Worker impossible à créer', err\)/.test(effetWorker), 'hook : erreur du Worker, réponse illisible et création impossible → repli');
  ok(/const issue = pilote\.recevoir\(r, null, null\);\s*if \(issue\.issue === 'erreur'\) \{\s*const \{ raison, detail \} = repliSurErreur\(issue\);\s*basculerEnRepli\(raison, detail\);\s*\}/.test(effetWorker),
    'hook : une réponse d’erreur hors effet actif journalise le même détail que le module (repliSurErreur, `vide` compris)');
  const repli = bloc(hook, 'const basculerEnRepli = useCallback(', '}, []);');
  ok(/console\.error\(/.test(repli) && /d\.worker\.terminate\(\);/.test(repli) && /setEnRepli\(true\);/.test(repli),
    'hook : le repli journalise (console.error), termine le Worker et rend la main au chemin direct');
  ok(/if \(d\) \{\s*if \(d\.pilote\.renoncer\(\)\) setParBuild\(new Map\(cacheRef\.current\)\);\s*d\.worker\.terminate\(\);/.test(repli),
    'hook : au repli, une écriture retenue par la cadence (renoncer rend vrai) est publiée de force (6bis-b13bis-c)');
  ok(/courant: \(\) => \{\s*const h = horsFilRef\.current;\s*return h \? \{ entrees: h\.entrees, signature: signatureRef\.current \} : null;/.test(effetWorker),
    'hook : le contexte courant est lu dans les refs du rendu (entrées et signature), à chaque réponse');
  ok(/restants: \(\) => prochainsATraiter\(trieesRef\.current, new Set\(cacheRef\.current\.keys\(\)\), K, pageRef\.current\(\)\)/.test(effetWorker),
    'hook : la priorité reste `prochainsATraiter` sur le fil de l’écran, page affichée comprise');
  ok(/publier: \(forcer\) => \{\s*const now = Date\.now\(\);\s*if \(!forcer && now - dernierePublication < PUBLICATION_MS\) return false;\s*dernierePublication = now;\s*setParBuild\(new Map\(cacheRef\.current\)\);\s*return true;\s*\},/.test(effetWorker),
    'hook : même cadence de publication que le chemin direct ; rend faux quand la cadence retient, vrai quand l’écran reçoit le cache (6bis-b13bis-c)');
  ok(/return \(\) => \{\s*vivant = false;\s*distant\.surReponse = \(r\) => reponseAuRepos\(distant\.pilote, r\);/.test(effetWorker),
    'hook : hors effet actif, une réponse libère sa place sans rien écrire');

  /* ── 7 bis. Le branchement gardé (6bis-b13bis-c) ─────────────────────── */
  // La revue du Worker a appliqué cinq mutations du branchement à l'écran :
  // toutes laissaient les tests verts. Aucune de ces lignes ne s'extrait en
  // fonction pure sans y laisser son équivalent (une ref React relue au
  // rendu, un gestionnaire de Worker, un effet) : chacune est gardée par un
  // contrôle de source PRÉCIS, sur la ligne entière. La mutation 1 (runes du
  // Worker) l'est au § 8, par le producteur unique.
  titre('Résolution hors du fil — le branchement à l’écran gardé (6bis-b13bis-c)');
  ok(/const horsFilRef = useRef\(horsFil\);\s*const signatureRef = useRef\(signature\);\s*horsFilRef\.current = horsFil;\s*signatureRef\.current = signature;/.test(hook)
    && /trieesRef\.current = triees;\s*pageRef\.current = pageAffichee;/.test(hook),
    'branchement (mutation 5 de la revue) : les refs que lisent les ports — entrées, signature, candidats, page — sont remises à jour à CHAQUE rendu');
  egal((hook.match(/signatureRef\.current = /g) ?? []).length, 1, 'branchement : la signature lue par le module n’est écrite qu’au rendu, nulle part ailleurs');
  ok(/worker\.onmessage = \(e: MessageEvent<ReponseResolution>\) => cree\.surReponse\(e\.data\);/.test(effetWorker)
    && (hook.match(/worker\.onmessage = /g) ?? []).length === 1,
    'branchement (mutation 3) : le gestionnaire des messages relit `cree.surReponse` à CHAQUE message (jamais figé sur celui de la création), un seul `onmessage`');
  ok(/distant\.surReponse = \(r\) => \{\s*if \(vivant\) distant\.pilote\.surReponse\(r, ports\);\s*else reponseAuRepos\(distant\.pilote, r\);\s*\};/.test(effetWorker),
    'branchement (mutation 3) : chaque effet actif rebranche `surReponse` sur SES ports');
  ok(/const pomper = \(\) => \{\s*if \(vivant\) distant\.pilote\.pomper\(ports\);\s*\};\s*pomper\(\);\s*reveillerRef\.current = pomper;/.test(effetWorker)
    && /useEffect\(\(\) => \{\s*reveillerRef\.current\?\.\(\);\s*\}\);/.test(hook),
    'branchement (mutation 4) : l’effet du Worker pose `reveillerRef.current = pomper`, que l’effet de réveil appelle à chaque rendu');
  ok(/enAttente: \(n\) => setEnAttente\(n\),\s*repli: basculerEnRepli,\s*\};/.test(effetWorker),
    'branchement (mutation 2) : le port `repli` est `basculerEnRepli` (journalise, termine le Worker, rend la main au chemin direct)');

  const ecran = sansCommentaires(readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8'));
  const argsDirects = bloc(ecran, 'entreeResolutionDuBuild({', '})');
  const argsHorsFil = bloc(ecran, 'return entreesSerialisables({', '});');
  const champs = (t: string) => t.split('\n').map((l) => l.trim()).filter((l) => /^[a-zA-Z]+(: [^,]+)?,$/.test(l));
  const directsSansRunes = champs(argsDirects).filter((l) => !l.startsWith('runes:') && !l.startsWith('caches:'));
  ok(directsSansRunes.length === 7 && identiques(champs(argsHorsFil), directsSansRunes),
    `écran : les entrées du Worker portent EXACTEMENT les arguments de la résolution directe, runes et caches exceptés (${champs(argsHorsFil).join(' ')})`);
  ok(/horsFil: resolutionHorsFil,/.test(ecran) && /resoudre: resoudreEquipement,/.test(ecran), 'écran : la file reçoit le Worker ET le chemin direct (repli)');
  const memoEntrees = bloc(ecran, 'const entreesResolution = useMemo(', ');\n');
  ok(/\[artifactParams, selected, optimiserArtefacts, regimeEquipement, contexteDegatsArtefacts, contexteExclusive, requirementAvecAuras, relicContextRecherche\]\);/.test(ecran)
    && memoEntrees.length > 0, 'écran : les entrées sont mémoïsées sur les dépendances de la résolution directe, sans runeById ni caches');

  /* ── 8. Un seul producteur des runes d'un build (6bis-b13bis-c) ──────── */
  titre('Résolution hors du fil — un seul producteur des runes d’un build (6bis-b13bis-c)');
  {
    const r1 = { id: 11 } as unknown as RuneDetail;
    const r2 = { id: 12 } as unknown as RuneDetail;
    const r3 = { id: 13 } as unknown as RuneDetail;
    const index = new Map([[11, r1], [12, r2], [13, r3]]);
    const sortie = runesDuBuild({ runeIds: [13, 11, 99, 12] }, index);
    ok(sortie.length === 3 && sortie[0] === r3 && sortie[1] === r1 && sortie[2] === r2,
      'runesDuBuild : les runes de l’index (objets d’origine), dans l’ordre de runeIds, un identifiant absent omis');
    egal(runesDuBuild({ runeIds: [] }, index), [], 'runesDuBuild : aucun identifiant, aucune rune');
    const fx = CORPUS_5A.G;
    const pp: SearchParams = { ...fx.p0, relicContext: fx.ctx };
    const parId = new Map(pp.pool.map((r) => [r.id, r]));
    const candidats = searchBuilds(pp).candidates;
    const ecartsRunes = candidats.filter((c) => {
      const attendu = runesDe(pp, c);
      const recu = runesDuBuild(c, parId);
      return recu.length !== 6 || recu.length !== attendu.length || recu.some((rr, i) => rr !== attendu[i]);
    }).length;
    ok(candidats.length > 0 && ecartsRunes === 0,
      `runesDuBuild : sur ${candidats.length} candidats (G), les six runes de chacun, identiques à l’expression d’avant (relicDifferentiel.runesDe)`);
  }
  const memoDirect = bloc(ecran, 'const resoudreEquipement = useMemo(() => {', '}, [artifactParams, selected, optimiserArtefacts, runeById,');
  const memoHorsFil = bloc(ecran, 'const resolutionHorsFil = useMemo<ResolutionHorsFil | null>(', '[entreesResolution, runeById]');
  ok(/resoudreEquipementDuBuild\(\s*entreeResolutionDuBuild\(\{\s*fiche: selected\.gear,\s*runes: runesDuBuild\(c, runeById\),/.test(memoDirect),
    'écran : la résolution directe prend les runes du build par runesDuBuild(c, runeById)');
  ok(/\? \{ entrees: entreesResolution, runesDe: \(c: BuildCandidate\) => runesDuBuild\(c, runeById\) \}\s*: null,/.test(memoHorsFil),
    'écran : la résolution hors du fil prend les runes du build par le MÊME producteur, runesDuBuild(c, runeById)');
  egal((ecran.match(/runesDuBuild\(/g) ?? []).length, 2, 'écran : exactement deux appels à runesDuBuild, un par résolution');
  ok(!/runeIds\.map\(/.test(ecran), 'écran : aucune autre expression des runes d’un build (plus de runeIds.map recopié)');
}
