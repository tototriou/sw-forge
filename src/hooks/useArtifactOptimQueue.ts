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
import { ArtifactSearchParams, chercherPaires } from '../lib/artifactOptim';
import { ResultatArtefacts, cleBuild, prochainsATraiter } from '../lib/artifactQueue';

// Combien de builds on optimise au maximum. Mesuré : le vainqueur final venait
// du rang initial #1, et il faut les 7 premiers pour un top 5 exact — 100 laisse
// une marge confortable, soit 5 pages de résultats entièrement justes.
export const K_BUILDS_OPTIMISES = 100;

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
  // Construit les paramètres de recherche d'artéfacts pour UN build.
  // `null` quand l'optimisation n'a pas lieu d'être (artéfacts ignorés, pas
  // d'objectif de dégâts, inventaire absent).
  faireParams: ((c: BuildCandidate) => ArtifactSearchParams) | null;
  // Change dès qu'un réglage modifie le score d'une paire — vide le cache.
  signature: string;
  K?: number;
}): UseArtifactOptimQueue {
  const { triees, faireParams, signature, K = K_BUILDS_OPTIMISES } = opts;
  const [parBuild, setParBuild] = useState<ReadonlyMap<string, ResultatArtefacts>>(new Map());
  const [enAttente, setEnAttente] = useState(0);

  // ⚠️ Les valeurs volatiles passent par des refs : la boucle d'inactivité est
  // relancée à chaque tranche et doit voir l'état FRAIS sans que sa
  // reprogrammation dépende de l'identité des props (un tableau `triees`
  // recréé à chaque rendu relancerait l'effet en boucle).
  const trieesRef = useRef(triees);
  const paramsRef = useRef(faireParams);
  trieesRef.current = triees;
  paramsRef.current = faireParams;

  // Le cache vit dans une ref ET dans l'état : la ref pour que la boucle le
  // lise sans re-rendu, l'état pour que l'écran se rafraîchisse.
  const cacheRef = useRef(new Map<string, ResultatArtefacts>());

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

    const tranche = () => {
      if (!vivant) return;
      const faire = paramsRef.current;
      if (!faire) return;
      const restants = prochainsATraiter(trieesRef.current, new Set(cacheRef.current.keys()), K);
      setEnAttente(restants.length);
      const suivant = restants[0];
      if (!suivant) return; // rien à faire : on ne se reprogramme pas
      // ⚠️ UN SEUL build par tranche. Une boucle « tant qu'il reste du temps »
      // garderait le fil au-delà de ce que le navigateur a accordé, et le jank
      // reviendrait exactement là où `requestIdleCallback` devait l'éviter.
      const r = chercherPaires(faire(suivant));
      const meilleure = r.paires[0] ?? null;
      cacheRef.current.set(cleBuild(suivant), {
        paire: meilleure,
        artefacts: meilleure
          ? [meilleure.element, meilleure.archetype].filter((a): a is NonNullable<typeof a> => a != null)
          : [],
        meilleurSansVerrous: r.meilleurSansVerrous,
      });
      setParBuild(new Map(cacheRef.current));
      planifie = planifierInactif(tranche);
    };

    planifie = planifierInactif(tranche);
    return () => {
      vivant = false;
      planifie?.annuler();
    };
    // `triees` volontairement ABSENT des dépendances : il change à chaque
    // message de progression (~150 ms) et relancerait l'effet en permanence.
    // La boucle lit `trieesRef`, donc elle voit toujours le dernier état.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faireParams, signature, K, triees.length]);

  return { parBuild, enAttente };
}
