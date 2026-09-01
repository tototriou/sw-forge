// Optimise les artéfacts des meilleurs builds PENDANT que la recherche de
// runes tourne, sur le temps d'inactivité du fil principal.
//
// ⚠️ **Pourquoi le fil principal et pas un Worker.** L'appariement occupe déjà
// 5 fils au pic (le coordinateur + `PARALLEL_PAIRING_WORKERS = 4`) ; un 6ᵉ
// aggraverait la concurrence, et il faudrait sérialiser tout l'inventaire
// d'artéfacts (~2 500 pièces) à chaque recherche. `requestIdleCallback` donne
// à la place le temps dont le fil principal n'a pas besoin, et le REPREND dès
// qu'il se passe autre chose — ce qui règle aussi le vrai risque immédiat, qui
// n'est pas les cœurs mais le JANK : une tranche de 74 ms sur ce fil fige la
// barre de progression et l'aperçu en direct.
//
// ⚠️ Aucune API JavaScript ne permet de choisir un cœur. La seule vérification
// honnête est de MESURER si la recherche ralentit, dos à dos — pas de supposer
// que le temps est masqué.

import { useEffect, useRef, useState } from 'react';
import { BuildCandidate } from '../lib/runeBuildOptim';
import { StatRow } from '../lib/stats';
import { ArtifactSearchParams, chercherPaires } from '../lib/artifactOptim';
import { ArtifactDetail } from '../types';
import { ResultatArtefacts, cleBuild, prochainsATraiter } from '../lib/artifactQueue';

// Combien de builds on optimise au maximum. Mesuré : le vainqueur final venait
// du rang initial #1, et il faut les 7 premiers pour un top 5 exact — 100 laisse
// une marge confortable, soit 5 pages de résultats entièrement justes.
export const K_BUILDS_OPTIMISES = 100;

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

// ⚠️ `requestIdleCallback` n'existe pas partout (Safari l'a ajouté tard). Le
// repli `setTimeout` ne rend PAS le même service — il ne sait pas si le fil est
// occupé — mais il cède au moins la main entre deux builds, ce qui suffit à ne
// pas geler l'interface.
type Inactif = { annuler: () => void };
function planifierInactif(faire: () => void): Inactif {
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
  // Construit les paramètres de recherche d'artéfacts pour UN build.
  // `null` quand l'optimisation n'a pas lieu d'être (artéfacts ignorés, pas
  // d'objectif de dégâts, inventaire absent).
  faireParams: ((c: BuildCandidate) => ArtifactSearchParams) | null;
  // Recalcule les stats du build avec la paire retenue. ⚠️ Indispensable : les
  // stats du candidat ont été calculées avec la paire SUPPOSÉE, et la stat
  // principale d'un artéfact entre dedans. Sans ce recalcul, la carte
  // afficherait des stats qui ne correspondent pas aux artéfacts montrés juste
  // à côté, et un tri par ATQ porterait sur une valeur périmée.
  calculerStats: (c: BuildCandidate, artefacts: ArtifactDetail[]) => StatRow[];
  // Change dès qu'un réglage modifie le score d'une paire — vide le cache.
  signature: string;
  K?: number;
}): UseArtifactOptimQueue {
  const { triees, pageAffichee, faireParams, calculerStats, signature, K = K_BUILDS_OPTIMISES } = opts;
  const [parBuild, setParBuild] = useState<ReadonlyMap<string, ResultatArtefacts>>(new Map());
  const [enAttente, setEnAttente] = useState(0);

  // ⚠️ Les valeurs volatiles passent par des refs : la boucle d'inactivité est
  // relancée à chaque tranche et doit voir l'état FRAIS sans que sa
  // reprogrammation dépende de l'identité des props (un tableau `triees`
  // recréé à chaque rendu relancerait l'effet en boucle).
  const trieesRef = useRef(triees);
  const pageRef = useRef(pageAffichee);
  const paramsRef = useRef(faireParams);
  const statsRef = useRef(calculerStats);
  trieesRef.current = triees;
  pageRef.current = pageAffichee;
  paramsRef.current = faireParams;
  statsRef.current = calculerStats;

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
    if (!faireParams) return;
    let vivant = true;
    let planifie: Inactif | null = null;

    /**
     * Programme une tranche, si aucune ne l'est déjà.
     *
     * ⚠️ **IDEMPOTENT, et c'est indispensable** : `reveiller` est appelé à
     * chaque rendu. Sans la garde `planifie`, chaque rendu empilerait un rappel
     * de plus — et pendant une recherche, les rendus s'enchaînent toutes les
     * ~150 ms.
     */
    const reveiller = () => {
      if (!vivant || planifie) return;
      planifie = planifierInactif(() => {
        planifie = null;
        tranche();
      });
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
      const faire = paramsRef.current;
      if (!faire) return;
      const restants = prochainsATraiter(trieesRef.current, new Set(cacheRef.current.keys()), K, pageRef.current());
      setEnAttente(restants.length);
      const suivant = restants[0];
      // Plus rien à traiter : on S'ENDORT sans se reprogrammer. C'est
      // `reveiller` qui relancera quand de nouveaux candidats arriveront ou que
      // la page changera.
      // ⚠️ Publication FORCÉE avant de dormir : sans elle, les derniers builds
      // resteraient dans le cache sans jamais atteindre l'écran.
      if (!suivant) return publier(true);
      // ⚠️ UN SEUL build par tranche. Une boucle « tant qu'il reste du temps »
      // garderait le fil au-delà de ce que le navigateur a accordé, et le jank
      // reviendrait exactement là où `requestIdleCallback` devait l'éviter.
      const r = chercherPaires(faire(suivant));
      const meilleure = r.paires[0] ?? null;
      const artefactsRetenus = meilleure
        ? [meilleure.element, meilleure.archetype].filter((a): a is NonNullable<typeof a> => a != null)
        : [];
      // ⚠️ Le résultat entre TOUJOURS dans le cache ; c'est sa PUBLICATION à
      // l'écran qui est regroupée (voir `publier` plus bas).
      cacheRef.current.set(cleBuild(suivant), {
        paire: meilleure,
        artefacts: artefactsRetenus,
        // ⚠️ Recalculées avec la paire RETENUE : la stat principale d'un
        // artéfact entre dans les stats du monstre. Sans ça, la carte
        // afficherait des stats issues de la paire supposée à côté des
        // artéfacts réellement choisis.
        stats: statsRef.current(suivant, artefactsRetenus),
        meilleurSansVerrous: r.meilleurSansVerrous,
      });
      publier(false);
      reveiller();
    };

    reveiller();
    reveillerRef.current = reveiller;
    return () => {
      vivant = false;
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
  }, [faireParams, signature, K]);

  // ⚠️ **Le réveil, à chaque rendu.** La boucle s'endort dès qu'elle n'a plus
  // rien à traiter ; il faut donc la relancer quand de nouveaux candidats
  // arrivent, quand l'utilisateur change de page, ou quand il change de tri.
  // Plutôt que d'énumérer ces déclencheurs — et d'en oublier un —, on réveille
  // systématiquement : `reveiller` est idempotent et ne coûte qu'une garde
  // quand une tranche est déjà programmée.
  useEffect(() => {
    reveillerRef.current?.();
  });

  return { parBuild, enAttente };
}
