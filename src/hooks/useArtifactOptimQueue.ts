// Optimise les artéfacts des meilleurs builds PENDANT que la recherche de
// runes tourne, sur le fil principal, par DEUX VOIES (degats-et-aura 6bis-b11) :
//
//  - la PAGE AFFICHÉE, par une tâche immédiate (`planifierImmediat`) : tant
//    qu'elle contient un build non résolu, la tranche suivante part sans
//    attendre l'inactivité ;
//  - l'avance de FOND (les K premiers hors page), sur le temps d'inactivité
//    (`planifierInactif`), comme avant.
//
// La voie se décide par une fonction pure, testée sans navigateur
// (`voieDeLaFile`, artifactQueue.ts). Elle ne change ni QUI est traité ni dans
// quel ordre (`prochainsATraiter`), seulement QUAND : le travail total est le
// même, et la voie prioritaire est bornée à la page (20 builds).
//
// Pourquoi deux voies : pendant une recherche, l'écran reçoit la progression
// toutes les 150 ms et retrie l'aperçu. Il est rarement inactif, et chaque
// build de la page attendait jusqu'à une seconde (`timeout` de
// `requestIdleCallback`), alors qu'il coûte peu (8 ms pour la recette Kinki au
// CLI, ~77 ms en « Dégâts réels », artéfacts « Libre », 4 reliques). Constat
// de l'utilisateur au navigateur, le 2026-10-02.
//
// ⚠️ **Pourquoi le fil principal et pas un Worker.** La recherche, elle, tourne
// déjà dans des Workers : le coordinateur (`runeBuildOptim.worker.ts`), qui
// lance les deux constructions de demi-builds puis, au-delà du seuil,
// `PARALLEL_PAIRING_WORKERS = 4` fils d'appariement — 5 fils au pic. Un de plus
// aggraverait la concurrence, et il faudrait sérialiser tout l'inventaire
// d'artéfacts (~2 500 pièces) à chaque recherche. La file reste donc sur le
// fil principal, où le vrai risque immédiat n'est pas les cœurs mais le JANK :
// une tranche de 74 ms y fige la barre de progression et l'aperçu en direct.
// Les deux voies rendent la main au navigateur entre deux builds ; la voie de
// la page accepte ce coût pour une page au plus, l'inactivité ne protège plus
// que l'avance de fond. Décision de l'utilisateur du 2026-10-02 : cette
// solution d'abord ; un Worker dédié à la résolution si, pendant une
// recherche, la page affichée met encore plus de quelques secondes à se
// résoudre ou si la barre de progression gèle visiblement.
//
// ⚠️ **Non mesuré** : ni le délai de résolution de la page au navigateur, ni
// le gel éventuel de l'interface, ni ce que la voie prioritaire coûte à la
// recherche — seul le navigateur le montre. Aucune API JavaScript ne permet de
// choisir un cœur : la seule vérification honnête est de MESURER si la
// recherche ralentit, dos à dos — pas de supposer que le temps est masqué.

import { useEffect, useRef, useState } from 'react';
import { BuildCandidate } from '../lib/runeBuildOptim';
import { ResultatArtefacts, cleBuild, prochainsATraiter, voieDeLaFile } from '../lib/artifactQueue';

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
  // Combien restent à traiter dans les K premiers — pour l'affichage.
  enAttente: number;
}

export function useArtifactOptimQueue(opts: {
  // Candidats DÉJÀ TRIÉS par l'objectif (via `sortCandidates`).
  triees: readonly BuildCandidate[];
  /**
   * La page RÉELLEMENT affichée — traitée EN PRIORITÉ sur le top-K.
   *
   * ⚠️ **Sans elle, aucune page au-delà de la K-ième n'aurait jamais sa
   * paire**, quelle que soit la valeur de K. Le top-K est une avance de fond
   * pour les premières pages ; ce qu'on regarde doit passer devant.
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
  // Combien de builds résoudre hors page affichée : `kDeLaFile` (artifactQueue.ts)
  // du contexte relique de la recherche LANCÉE — 300 en mode « recherche »,
  // 100 sinon. Obligatoire, sans défaut : un appel qui l'oublierait garderait
  // 100 en mode « recherche » sans que `tsc` le voie (6bis-b8).
  K: number;
}): UseArtifactOptimQueue {
  const { triees, pageAffichee, resoudre, signature, K } = opts;
  const [parBuild, setParBuild] = useState<ReadonlyMap<string, ResultatArtefacts>>(new Map());
  const [enAttente, setEnAttente] = useState(0);

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

    const aTraiter = () => prochainsATraiter(trieesRef.current, new Set(cacheRef.current.keys()), K, pageRef.current());

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
      if (voie === 'aucune') return setEnAttente(0);
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
      if (!forcer && now - dernierePublication < PUBLICATION_MS) return;
      dernierePublication = now;
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

  // ⚠️ **Le réveil, à chaque rendu.** La boucle s'endort dès qu'elle n'a plus
  // rien à traiter ; il faut donc la relancer quand de nouveaux candidats
  // arrivent, quand l'utilisateur change de page, ou quand il change de tri.
  // Plutôt que d'énumérer ces déclencheurs — et d'en oublier un —, on réveille
  // systématiquement : `reveiller` est idempotent. Il recalcule la voie à
  // chaque rendu (`prochainsATraiter` sur la page et les K premiers, clés
  // mémoïsées) : c'est ce qui fait passer une tranche de fond en attente sur
  // la voie de la page dès que celle-ci change.
  useEffect(() => {
    reveillerRef.current?.();
  });

  return { parBuild, enAttente };
}
