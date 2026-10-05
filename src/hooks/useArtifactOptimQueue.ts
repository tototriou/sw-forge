// Optimise les artéfacts des meilleurs builds PENDANT que la recherche de
// runes tourne. Deux chemins, un seul cache :
//
// 1. **Le Worker de résolution** (degats-et-aura 6bis-b13bis-b), quand il est
//    disponible : le fil de l'écran ne résout plus RIEN. Il choisit quoi
//    résoudre (`prochainsATraiter`, page affichée d'abord), envoie au plus
//    deux demandes à la fois à `resolution.worker.ts` et range les réponses
//    dans le cache. Toute cette logique — quoi envoyer, annuler, ignorer, quand
//    renoncer — vit dans un module pur testé en Node (`ResolutionDistante`,
//    resolutionDistante.ts) ; ce hook ne fait que la brancher.
// 2. **Le chemin direct, en REPLI** : Worker impossible à créer, qui lève, ou
//    réponse d'erreur → l'erreur est journalisée, le Worker terminé, et la
//    file reprend sur le fil principal, avec le cache tel qu'il est (rien de
//    déjà résolu n'est perdu), par les DEUX VOIES de 6bis-b11 :
//     - la PAGE AFFICHÉE, par une tâche immédiate (`planifierImmediat`) : tant
//       qu'elle contient un build non résolu, la tranche suivante part sans
//       attendre l'inactivité ;
//     - l'avance de FOND (vers K confirmées, hors page), sur le temps d'inactivité
//       (`planifierInactif`).
//    La voie se décide par une fonction pure, testée sans navigateur
//    (`voieDeLaFile`, artifactQueue.ts). Elle ne change ni QUI est traité ni
//    dans quel ordre (`prochainsATraiter`), seulement QUAND.
//
// Pourquoi le Worker : mesuré au navigateur (6bis-b12, puis 6bis-b13), la
// résolution saturait le fil de l'écran pendant une recherche — chaque build
// une tâche de 35 à 100 ms, la barre de progression et le compte saccadaient.
// Les deux voies du chemin direct rendaient la main entre deux builds, mais ne
// rendaient pas un build moins long ; décision de l'utilisateur du 2026-10-02 :
// le Worker. Ce qu'il coûte — un fil de plus pendant la recherche, qui tourne
// déjà dans des Workers (coordinateur, deux constructions, jusqu'à quatre fils
// d'appariement), et l'envoi du contexte (tout l'inventaire d'artéfacts) à
// chaque nouvelle identité des entrées, soit une fois par recherche, ou de la
// signature — est MESURÉ dans les preuves de 6bis-b13bis-b (recherche +4 à
// +7 %, résultat complet −27 %) ; que ce soit le fil de plus qui ralentit la
// recherche reste une hypothèse. Aucune API JavaScript ne permet de choisir
// un cœur.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RuneDetail } from '../types';
import { BuildCandidate } from '../lib/runeBuildOptim';
import { ResultatArtefacts, cleBuild, prochainsATraiter, voieDeLaFile } from '../lib/artifactQueue';
import { EntreesResolutionSerialisables, ReponseResolution } from '../workers/resolutionBody';
import { PortsResolutionDistante, ResolutionDistante, repliSurErreur } from '../workers/resolutionDistante';

/**
 * Intervalle minimal entre deux PUBLICATIONS du cache à l’écran.
 *
 * ⚠️ **Publier à chaque build coûtait un RETRI de toute la liste.** Chaque
 * `setParBuild` change l’identité de la map, donc le classement d’affichage se
 * recalcule : 119 ms mesurés sur 100 000 candidats, × K builds = 11,9 s de fil
 * principal bloqué. Le calcul d’artéfacts lui-même n’en coûte que 8,6 s : le
 * retri pesait donc PLUS que le travail qu’il accompagnait.
 *
 * 400 ms : au-dessus du throttle de progression de la recherche (150 ms), et
 * assez large pour qu’un retri de ~120 ms laisse le fil libre l’essentiel du
 * temps. Les résultats apparaissent par paquets plutôt qu’un par un — ce qui
 * est de toute façon préférable : cent réordonnancements successifs se lisent
 * comme du bruit.
 */
const PUBLICATION_MS = 400;

type Planifie = { annuler: () => void };

// Voie de FOND. ⚠️ `requestIdleCallback` n'existe pas partout (Safari l'a
// ajouté tard). Le repli `setTimeout` ne rend PAS le même service — il ne sait
// pas si le fil est occupé — mais il cède au moins la main entre deux builds,
// ce qui suffit à ne pas geler l'interface.
function planifierInactif(faire: () => void): Planifie {
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(faire, { timeout: 1000 });
    return { annuler: () => w.cancelIdleCallback?.(id) };
  }
  const id = window.setTimeout(faire, 0);
  return { annuler: () => window.clearTimeout(id) };
}

/**
 * Voie de la PAGE : une tâche immédiate, qui part dès que le navigateur a
 * traité ce qui la précède (messages des Workers, rendu), sans attendre qu'il
 * soit inactif. ⚠️ Jamais `requestIdleCallback` : c'est précisément l'attente
 * qu'elle supprime.
 *
 * `MessageChannel` plutôt que `setTimeout(0)` : des rappels `setTimeout`
 * enchaînés sont ramenés à 4 ms minimum au-delà de cinq imbrications
 * (spécification HTML), un message de canal non. Repli `setTimeout` quand
 * `MessageChannel` manque.
 */
function planifierImmediat(faire: () => void): Planifie {
  if (typeof MessageChannel === 'function') {
    const canal = new MessageChannel();
    let annule = false;
    canal.port1.onmessage = () => {
      canal.port1.close();
      if (!annule) faire();
    };
    canal.port2.postMessage(null);
    return {
      annuler: () => {
        annule = true;
        canal.port1.close();
      },
    };
  }
  const id = window.setTimeout(faire, 0);
  return { annuler: () => window.clearTimeout(id) };
}

export interface UseArtifactOptimQueue {
  // Résultat par `cleBuild`. Absent = pas encore optimisé.
  parBuild: ReadonlyMap<string, ResultatArtefacts>;
  // Combien restent à traiter (page, puis avance de fond vers K confirmées) —
  // pour l'affichage.
  enAttente: number;
}

/**
 * La résolution HORS du fil de l'écran : les entrées du contexte, en données
 * (`entreesSerialisables`, resolutionBody.ts — les mêmes arguments que
 * `resoudre`, `evaluer` retiré), et les runes d'un build.
 *
 * ⚠️ `entrees` est comparé par IDENTITÉ : un nouvel objet = un nouveau
 * contexte envoyé au Worker (tout l'inventaire d'artéfacts). L'appelant le
 * mémoïse sur les mêmes dépendances que `resoudre`.
 */
export interface ResolutionHorsFil {
  entrees: EntreesResolutionSerialisables;
  runesDe: (c: BuildCandidate) => RuneDetail[];
}

// Le Worker de résolution et la logique côté écran qui va avec — un seul pour
// la vie du hook. `surReponse` est rebranché par l'effet actif ; hors effet,
// une réponse libère seulement sa place en vol.
type Distant = {
  worker: Worker;
  pilote: ResolutionDistante;
  surReponse: (r: ReponseResolution) => void;
};

export function useArtifactOptimQueue(opts: {
  // Candidats DÉJÀ TRIÉS par l'objectif (via `sortCandidates`).
  triees: readonly BuildCandidate[];
  /**
   * La page RÉELLEMENT affichée — traitée EN PRIORITÉ sur l'avance de fond.
   *
   * ⚠️ **Sans elle, aucune page au-delà des K confirmées n'aurait jamais sa
   * paire**, quelle que soit la valeur de K. L'avance de fond sert les
   * premières pages ; ce qu'on regarde doit passer devant.
   *
   * ⚠️ Un ACCESSEUR, pas une valeur : la page affichée se calcule APRÈS la
   * file (elle dépend de son résultat), donc elle n'existe pas encore au
   * moment où ce hook est appelé. Lu au moment de traiter, il voit toujours
   * l'état courant.
   */
  pageAffichee: () => readonly BuildCandidate[];
  /**
   * Résout l'équipement d'UN build — sa paire d'artéfacts ET sa relique,
   * ensemble : `resoudreEquipementDuBuild` (relicQueue.ts, lot 5b), le
   * « comment », pur et testé sans navigateur. Ce hook ne fait plus que le
   * « quand ».
   *
   * `null` quand l'optimisation n'a pas lieu d'être (artéfacts et relique
   * ignorés, inventaire absent).
   *
   * ⚠️ Le résultat entre TOUJOURS dans le cache, conforme ou non : c'est le
   * classement (`affichees`) qui écarte un build qu'aucun couple réel ne
   * rend équipable (`ResultatArtefacts.conforme`, §12.5 d'artefacts.md).
   */
  resoudre: ((c: BuildCandidate) => ResultatArtefacts) | null;
  // Change dès qu'un réglage modifie le score d'une paire ou le pool de
  // reliques — vide le cache.
  signature: string;
  // Combien de combinaisons CONFIRMÉES (résolues et conformes) l'avance de fond
  // vise hors page affichée : `kDeLaFile` (artifactQueue.ts) du contexte relique
  // de la recherche LANCÉE — 300 en mode « recherche », 100 sinon ; la file
  // continue au-delà des écartés, dans l'ordre de base, jusqu'à K confirmées
  // ou jusqu'au dernier build trouvé (6bis-b18) ; `Infinity` avec « Vérifier
  // toutes les combinaisons trouvées » — l'écran passe `cibleDeLaFile`.
  // Obligatoire, sans défaut : un appel qui l'oublierait garderait 100 en mode
  // « recherche » sans que `tsc` le voie (6bis-b8).
  K: number;
  /**
   * La résolution hors du fil de l'écran (6bis-b13bis-b) — `null` quand
   * `resoudre` l'est. Obligatoire, sans défaut : un appel qui l'oublierait
   * résoudrait tout sur le fil de l'écran sans que `tsc` le voie.
   */
  horsFil: ResolutionHorsFil | null;
}): UseArtifactOptimQueue {
  const { triees, pageAffichee, signature, K, horsFil } = opts;
  const [parBuild, setParBuild] = useState<ReadonlyMap<string, ResultatArtefacts>>(new Map());
  const [enAttente, setEnAttente] = useState(0);

  // ⚠️ **Le repli est DÉFINITIF pour la vie du hook** : un Worker qui a manqué
  // une fois (création, erreur, réponse d'erreur) n'est pas relancé.
  const [enRepli, setEnRepli] = useState(false);
  const modeHorsFil = horsFil !== null && opts.resoudre !== null && !enRepli;
  // ⚠️ En mode Worker, le chemin direct DORT : son `resoudre` est nul, son
  // effet ne programme rien. Le repli le réveille en lui rendant `resoudre`.
  const resoudre = modeHorsFil ? null : opts.resoudre;

  // ⚠️ Les valeurs volatiles passent par des refs : la boucle est
  // relancée à chaque tranche et doit voir l'état FRAIS sans que sa
  // reprogrammation dépende de l'identité des props (un tableau `triees`
  // recréé à chaque rendu relancerait l'effet en boucle).
  const trieesRef = useRef(triees);
  const pageRef = useRef(pageAffichee);
  const resoudreRef = useRef(resoudre);
  trieesRef.current = triees;
  pageRef.current = pageAffichee;
  resoudreRef.current = resoudre;

  // Le cache vit dans une ref ET dans l'état : la ref pour que la boucle le
  // lise sans re-rendu, l'état pour que l'écran se rafraîchisse.
  const cacheRef = useRef(new Map<string, ResultatArtefacts>());
  // Une écriture du cache retenue par la cadence et pas encore publiée. Dans
  // une ref, pas dans l'effet : une relance de l'effet (K qui change) perdrait
  // sinon la trace d'une écriture faite par la boucle précédente — le
  // pendant de `nonPubliee` du chemin Worker.
  const nonPublieeRef = useRef(false);

  // Relance la boucle endormie. Posée par l’effet principal, lue par l’effet
  // de réveil — qui tourne à chaque rendu et ne connaît donc pas sa portée.
  const reveillerRef = useRef<(() => void) | null>(null);

  // ⚠️ Un changement de réglage VIDE le cache. Garder les résultats d'avant
  // afficherait des paires optimales pour un réglage quitté.
  useEffect(() => {
    cacheRef.current = new Map();
    setParBuild(new Map());
  }, [signature]);

  useEffect(() => {
    if (!resoudre) return;
    let vivant = true;
    // UNE seule tâche en attente, toutes voies confondues, avec sa voie.
    let planifie: (Planifie & { voie: 'page' | 'fond' }) | null = null;

    // ⚠️ Le cache LUI-MÊME, jamais une copie de ses clés : la file lit la
    // conformité de chaque résultat pour viser K confirmées (6bis-b18).
    const aTraiter = () => prochainsATraiter(trieesRef.current, cacheRef.current, K, pageRef.current());

    /**
     * Programme une tranche, par la voie que demande l'état courant.
     *
     * ⚠️ **IDEMPOTENT, et c'est indispensable** : `reveiller` est appelé à
     * chaque rendu. Sans la garde `planifie`, chaque rendu empilerait un rappel
     * de plus — et pendant une recherche, les rendus s'enchaînent toutes les
     * ~150 ms. Une tâche déjà programmée suffit si elle a la voie demandée, ou
     * si c'est une tâche de la page : elle part tout de suite, et la tranche
     * qu'elle lance sert de toute façon le premier restant.
     *
     * ⚠️ **Le piège : une tranche de fond attend un créneau d'inactivité**
     * (jusqu'à une seconde) quand la page acquiert des builds non résolus —
     * changement de page, nouveaux candidats. La garder ferait attendre la
     * page derrière elle : on l'ANNULE et on replanifie en voie prioritaire.
     *
     * Rien à traiter : rien n'est programmé. C'est la tranche qui a résolu le
     * dernier build qui publie, et le prochain rendu qui apporte du travail
     * qui réveille.
     */
    const reveiller = () => {
      if (!vivant) return;
      const voie = voieDeLaFile(aTraiter(), pageRef.current(), cacheRef.current);
      if (voie === 'aucune') {
        // File vide sur une écriture retenue (relance de l'effet, par exemple
        // K qui passe de l'infini à 100) : publication FORCÉE, sinon ces
        // résultats n'atteindraient jamais l'écran. Une seule fois : la
        // publication remet le drapeau à faux.
        if (nonPublieeRef.current) publier(true);
        return setEnAttente(0);
      }
      if (planifie && (planifie.voie === voie || planifie.voie === 'page')) return;
      planifie?.annuler();
      const planifier = voie === 'page' ? planifierImmediat : planifierInactif;
      planifie = {
        voie,
        ...planifier(() => {
          planifie = null;
          tranche();
        }),
      };
    };

    let dernierePublication = 0;
    const publier = (forcer: boolean) => {
      const now = Date.now();
      if (!forcer && now - dernierePublication < PUBLICATION_MS) {
        nonPublieeRef.current = true;
        return;
      }
      dernierePublication = now;
      nonPublieeRef.current = false;
      setParBuild(new Map(cacheRef.current));
    };

    const tranche = () => {
      if (!vivant) return;
      const faire = resoudreRef.current;
      if (!faire) return;
      const restants = aTraiter();
      setEnAttente(restants.length);
      const suivant = restants[0];
      // Plus rien à traiter (une nouvelle recherche a vidé la liste depuis la
      // programmation) : on S'ENDORT sans se reprogrammer. C'est `reveiller`
      // qui relancera quand de nouveaux candidats arriveront ou que la page
      // changera.
      // ⚠️ Publication FORCÉE avant de dormir : sans elle, les derniers builds
      // resteraient dans le cache sans jamais atteindre l'écran.
      if (!suivant) return publier(true);
      const page = pageRef.current();
      const voie = voieDeLaFile(restants, page, cacheRef.current);
      // ⚠️ UN SEUL build par tranche, quelle que soit la voie. Une boucle « tant
      // qu'il reste du temps » garderait le fil au-delà de ce que le navigateur
      // a accordé, et le jank reviendrait — la voie de la page, qui n'attend
      // pas l'inactivité, en dépend plus encore.
      // ⚠️ Le résultat entre TOUJOURS dans le cache ; c'est sa PUBLICATION à
      // l'écran qui est regroupée (voir `publier` plus haut).
      cacheRef.current.set(cleBuild(suivant), faire(suivant));
      // ⚠️ Publication FORCÉE quand ce build était le dernier non résolu de la
      // page — les cartes affichées se mettent à jour sans attendre la cadence —
      // ou le dernier de la file, qui s'endort : sans elle, les derniers builds
      // resteraient dans le cache sans jamais atteindre l'écran. La file après
      // ce build est `restants.slice(1)` : le cache n'a grandi que de lui.
      // ⚠️ Depuis 6bis-b18, s'il a été ÉCARTÉ, la fenêtre de fond s'allonge
      // d'un build : `restants.slice(1)` n'en est que le début. La seule
      // différence possible est une publication forcée un peu tôt (file crue
      // vide) — sans perte : `reveiller()` ci-dessous recalcule la vraie file.
      const voieApres = voieDeLaFile(restants.slice(1), page, cacheRef.current);
      publier(voieApres === 'aucune' || (voie === 'page' && voieApres !== 'page'));
      reveiller();
    };

    reveiller();
    reveillerRef.current = reveiller;
    return () => {
      vivant = false;
      // La tâche en attente, QUELLE QUE SOIT sa voie — il n'y en a jamais
      // qu'une.
      planifie?.annuler();
      planifie = null;
      reveillerRef.current = null;
    };
    // ⚠️ **`triees.length` a été RETIRÉ des dépendances, et c'est un
    // correctif, pas une optimisation.** Il change à chaque message de
    // progression (~150 ms), donc l'effet se démontait et se remontait à ce
    // rythme — et son nettoyage ANNULAIT le rappel d'inactivité en attente.
    // `requestIdleCallback` ne se déclenchant que quand le fil est libre (au
    // plus tard après son `timeout` d'une seconde), il était annulé avant
    // d'avoir jamais tourné : la file n'avançait pas de toute la recherche.
    // Signalé à l'usage — une page restée non optimisée plusieurs minutes.
    //
    // La boucle lit `trieesRef` et `pageRef`, donc elle voit toujours l'état
    // frais ; c'est `reveiller` (effet ci-dessous) qui la relance quand elle
    // s'est endormie faute de travail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resoudre, signature, K]);

  /* ── Le chemin Worker (6bis-b13bis-b) ─────────────────────────────────── */

  // ⚠️ Le branchement ci-dessous — refs relues au rendu, gestionnaire relu à
  // CHAQUE message, rebranché par chaque effet, réveil, port `repli` — n'est
  // exercé par aucun test d'exécution (le dépôt n'a pas de test React) : chaque
  // ligne est gardée par un contrôle de source nommé
  // (tests/resolution-distante.test.ts, § 7 bis — 6bis-b13bis-c). Modifier
  // l'une d'elles, c'est revoir son contrôle.
  const horsFilRef = useRef(horsFil);
  const signatureRef = useRef(signature);
  horsFilRef.current = horsFil;
  signatureRef.current = signature;
  const distantRef = useRef<Distant | null>(null);

  // ⚠️ Toute défaillance du Worker est JOURNALISÉE, jamais tue ; il est
  // terminé, et le chemin direct reprend avec le cache tel qu'il est. Ne lit
  // que des refs et des setters stables : la version capturée par les
  // gestionnaires du Worker à sa création reste juste.
  // ⚠️ Une écriture que la cadence avait retenue est publiée DE FORCE
  // (6bis-b13bis-c) : le chemin direct qui reprend n'a peut-être plus rien à
  // traiter, donc plus rien à publier. C'est le module qui le sait
  // (`renoncer` rend vrai) ; quand le repli vient de lui (`basculer`), il a
  // déjà publié et `renoncer` rend faux ici.
  const basculerEnRepli = useCallback((raison: string, detail: unknown) => {
    console.error(`File de résolution : ${raison} — repli sur le fil de l’écran (degats-et-aura 6bis-b13bis-b).`, detail);
    const d = distantRef.current;
    distantRef.current = null;
    if (d) {
      if (d.pilote.renoncer()) setParBuild(new Map(cacheRef.current));
      d.worker.terminate();
    }
    setEnRepli(true);
  }, []);

  // ⚠️ **Un seul Worker pour la vie du hook**, terminé au démontage — jamais un
  // par recherche ni par rendu. Créé au premier besoin (effet ci-dessous).
  useEffect(
    () => () => {
      distantRef.current?.worker.terminate();
      distantRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!modeHorsFil) return;
    // Hors d'un effet actif, une réponse libère sa place en vol, rien n'est
    // écrit ; une réponse d'erreur fait quand même renoncer.
    const reponseAuRepos = (pilote: ResolutionDistante, r: ReponseResolution) => {
      const issue = pilote.recevoir(r, null, null);
      if (issue.issue === 'erreur') {
        const { raison, detail } = repliSurErreur(issue);
        basculerEnRepli(raison, detail);
      }
    };
    let d = distantRef.current;
    if (!d) {
      try {
        const worker = new Worker(new URL('../workers/resolution.worker.ts', import.meta.url), { type: 'module' });
        const pilote = new ResolutionDistante();
        const cree: Distant = { worker, pilote, surReponse: (r) => reponseAuRepos(pilote, r) };
        worker.onmessage = (e: MessageEvent<ReponseResolution>) => cree.surReponse(e.data);
        worker.onerror = (e: ErrorEvent) => basculerEnRepli('erreur dans le Worker', e.message || e);
        worker.onmessageerror = (e: MessageEvent) => basculerEnRepli('réponse du Worker illisible', e);
        distantRef.current = d = cree;
      } catch (err) {
        basculerEnRepli('Worker impossible à créer', err);
        return;
      }
    }
    const distant = d;
    let vivant = true;
    let dernierePublication = 0;
    const ports: PortsResolutionDistante = {
      courant: () => {
        const h = horsFilRef.current;
        return h ? { entrees: h.entrees, signature: signatureRef.current } : null;
      },
      runesDe: (c) => horsFilRef.current?.runesDe(c) ?? [],
      restants: () => prochainsATraiter(trieesRef.current, cacheRef.current, K, pageRef.current()),
      page: () => pageRef.current(),
      cache: () => cacheRef.current,
      envoyer: (m) => distant.worker.postMessage(m),
      // Même cadence que le chemin direct (voir `PUBLICATION_MS`). Rend faux
      // quand la cadence retient la publication : le module sait ainsi
      // qu'une écriture attend, et la publie de force quand la file se vide.
      publier: (forcer) => {
        const now = Date.now();
        if (!forcer && now - dernierePublication < PUBLICATION_MS) return false;
        dernierePublication = now;
        setParBuild(new Map(cacheRef.current));
        return true;
      },
      enAttente: (n) => setEnAttente(n),
      repli: basculerEnRepli,
    };
    distant.surReponse = (r) => {
      if (vivant) distant.pilote.surReponse(r, ports);
      else reponseAuRepos(distant.pilote, r);
    };
    const pomper = () => {
      if (vivant) distant.pilote.pomper(ports);
    };
    pomper();
    reveillerRef.current = pomper;
    return () => {
      vivant = false;
      distant.surReponse = (r) => reponseAuRepos(distant.pilote, r);
      if (reveillerRef.current === pomper) reveillerRef.current = null;
    };
  }, [modeHorsFil, signature, K, basculerEnRepli]);

  // ⚠️ **Le réveil, à chaque rendu.** La boucle s'endort dès qu'elle n'a plus
  // rien à traiter ; il faut donc la relancer quand de nouveaux candidats
  // arrivent, quand l'utilisateur change de page, ou quand il change de tri.
  // Plutôt que d'énumérer ces déclencheurs — et d'en oublier un —, on réveille
  // systématiquement : `reveiller` est idempotent. Il recalcule la voie à
  // chaque rendu (`prochainsATraiter` sur la page et l'avance de fond, clés
  // mémoïsées) : c'est ce qui fait passer une tranche de fond en attente sur
  // la voie de la page dès que celle-ci change.
  useEffect(() => {
    reveillerRef.current?.();
  });

  return { parBuild, enAttente };
}
