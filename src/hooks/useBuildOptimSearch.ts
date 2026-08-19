import { useCallback, useEffect, useRef, useState } from 'react';
import { BuildCandidate, SearchParams, SearchResult } from '../lib/runeBuildOptim';
import { WorkerResponse } from '../workers/runeBuildOptim.worker';

// Plafond de sécurité sur la liste APERÇU accumulée pendant une recherche en
// cours — pas `maxCollected` (100 000 par défaut, voir MAX_COLLECTED dans
// runeBuildOptim.ts) : l'aperçu n'affiche jamais plus de 20 cartes triées
// (voir OptimizerSection.tsx), aucune raison de trier un tableau bien plus
// gros que ça à chaque point de passage pendant une recherche lâche. Le
// résultat FINAL (`result.candidates`, une fois la recherche terminée),
// lui, n'est jamais tronqué par cette limite — seul l'aperçu EN DIRECT l'est.
const PREVIEW_CANDIDATES_CAP = 3000;

export type BuildOptimStatus = 'idle' | 'running' | 'done' | 'error';

export interface HalfBuildProgress {
  scanned: number;
  total: number;
  pct: number;
}

// Point de passage le plus récent reçu pendant une recherche EN COURS — sert
// à la barre de progression (voir OptimizerSection.tsx). `null` en dehors
// d'une recherche active : ni avant, ni une fois `result` posé (le résultat
// final remplace la progression, pas l'inverse).
// ⚠️ Deux phases distinctes, pas juste `explored`/`found` : la construction
// des compartiments (`building`) précède la boucle d'appariement (`pairing`,
// l'ancien comportement) et peut à elle seule durer jusqu'à environ une
// minute sur un compte réel avec beaucoup de conditions — sans cette
// distinction, l'UI n'avait AUCUNE information pendant cette phase (voir
// spec/outils/optimizer/, « Suite — la phase de préparation restait
// muette »).
// ⚠️ `building` garde les DEUX moitiés (`halves.A`/`halves.B`), pas une seule
// — depuis leur construction en parallèle (deux Workers, voir
// runeBuildOptim.worker.ts), les messages de progression des deux moitiés
// s'entrelacent ; ne garder que le dernier reçu (l'ancien comportement)
// ferait « disparaître » l'autre moitié de l'écran alors qu'elle avance en
// même temps. `null` = cette moitié n'a pas encore reçu son premier point de
// passage (l'autre Worker a pu démarrer un peu avant, ou son pool est plus
// gros).
export type BuildOptimProgress =
  | { phase: 'building'; halves: { A: HalfBuildProgress | null; B: HalfBuildProgress | null } }
  // `totalPairs` : la taille RÉELLE de l'espace à épuiser (voir
  // `totalPairCount`), constante pour toute la phase — c'est CE
  // dénominateur que l'écran affiche (`X / totalPairs`), pas
  // `nodeBudgetMax` (le plafond de nœuds ACTUEL, qui grandit avec
  // l'escalade — voir « Suite — escalade automatique du budget de
  // nœuds ») : les deux racontent des choses différentes, et seul
  // `totalPairs` correspond à la ligne « Espace de recherche à épuiser »
  // affichée juste en dessous. `nodeBudgetMax` reste transmis (utile pour
  // du débogage/une évolution future), simplement plus affiché tel quel
  // dans cette ligne.
  | {
      phase: 'pairing';
      explored: number;
      found: number;
      pct: number;
      nodeBudgetMax: number;
      totalPairs: number;
      // Aperçu EN DIRECT, accumulé message après message à partir des
      // deltas envoyés par le Worker (voir `WorkerPairingMessage.
      // newCandidates`) — plafonné à `PREVIEW_CANDIDATES_CAP`, PAS égal à
      // `found` au-delà de ce plafond (voir son commentaire). Permet
      // d'afficher des cartes de résultat PENDANT la recherche, sans
      // attendre `result` (voir OptimizerSection.tsx).
      candidates: BuildCandidate[];
    };

// Cycle de vie du Worker de recherche de builds.
//
// Deux façons d'interrompre, pas interchangeables :
//  - `stop()` — arrêt COOPÉRATIF : poste un message que le Worker traite à
//    son prochain point de passage (voir runeBuildOptim.worker.ts) et
//    ressort ce qu'il a trouvé jusque-là (`truncated: true`). C'est celui du
//    bouton « Arrêter » de l'UI : on veut le résultat partiel, pas le perdre.
//  - `cancel()` — arrêt SEC (`terminate()`) : rien n'est récupéré. Utilisé au
//    démontage et par `run()` lui-même avant de lancer une nouvelle
//    recherche.
//
// ⚠️ `runId` (pas seulement `cancel()`+`terminate()`) protège contre un
// message TARDIF de l'ancien Worker : `terminate()` empêche le Worker de
// lancer de NOUVELLES étapes, mais un message qu'il avait DÉJÀ posté juste
// avant (en file d'attente côté fil principal) peut encore être délivré
// APRÈS que `run()` ait démarré le Worker suivant — son gestionnaire
// `onmessage`, resté attaché à l'ANCIEN objet Worker, reste un `setState`
// parfaitement valide (React ne l'invalide pas) et écraserait alors l'état
// de la recherche EN COURS avec une valeur PÉRIMÉE. Confirmé en usage réel :
// lancer/arrêter plusieurs recherches rapprochées pouvait figer une des deux
// barres de la phase `building` (voir spec/outils/optimizer/) — plus
// probable depuis la parallélisation des deux moitiés (deux Workers de plus
// à chaque recherche, donc deux fois plus de messages en vol au moment d'un
// arrêt/relance). Chaque `run()` incrémente `runId` ; tout message reçu par
// un gestionnaire qui ne porte plus le `runId` COURANT est silencieusement
// ignoré — indépendant de la rapidité réelle de `terminate()`, qui n'a donc
// plus besoin d'être instantané pour rester correct.
export function useBuildOptimSearch() {
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);
  const [status, setStatus] = useState<BuildOptimStatus>('idle');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [progress, setProgress] = useState<BuildOptimProgress | null>(null);

  const cancel = useCallback(() => {
    runIdRef.current++;
    if (workerRef.current) {
      workerRef.current.onmessage = null;
      workerRef.current.onerror = null;
      workerRef.current.terminate();
    }
    workerRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (params: SearchParams) => {
      cancel();
      const myRunId = runIdRef.current;
      setStatus('running');
      setResult(null);
      setProgress(null);
      const worker = new Worker(new URL('../workers/runeBuildOptim.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if (runIdRef.current !== myRunId) return; // message périmé d'une recherche déjà remplacée — voir commentaire ci-dessus
        const data = e.data;
        if (data.type === 'progress') {
          if (data.phase === 'building') {
            setProgress((prev) => {
              const halves = prev && prev.phase === 'building' ? prev.halves : { A: null, B: null };
              return { phase: 'building', halves: { ...halves, [data.half]: { scanned: data.scanned, total: data.total, pct: data.pct } } };
            });
          } else {
            setProgress((prev) => {
              const prevCandidates = prev && prev.phase === 'pairing' ? prev.candidates : [];
              const candidates =
                prevCandidates.length >= PREVIEW_CANDIDATES_CAP
                  ? prevCandidates
                  : prevCandidates.concat(data.newCandidates).slice(0, PREVIEW_CANDIDATES_CAP);
              return {
                phase: 'pairing',
                explored: data.explored,
                found: data.found,
                pct: data.pct,
                nodeBudgetMax: data.nodeBudgetMax,
                totalPairs: data.totalPairs,
                candidates,
              };
            });
          }
          return;
        }
        const { type: _type, ...res } = data;
        setResult(res);
        setProgress(null);
        setStatus('done');
      };
      worker.onerror = () => {
        if (runIdRef.current !== myRunId) return;
        setStatus('error');
      };
      worker.postMessage(params);
    },
    [cancel]
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ stop: true });
  }, []);

  // Efface l'état affiché SANS relancer de recherche — `cancel()` seul
  // termine le Worker mais laisse `status`/`result`/`progress` tels quels
  // (utilisé par `run()` avant de lancer la SUIVANTE, jamais pour revenir à
  // vide). Sert quand le monstre change ou qu'un nouveau compte est importé
  // (voir useOptimizerState.ts, `resetSearch`) : les résultats affichés
  // deviennent obsolètes (mauvais monstre/pool de runes), il faut les faire
  // disparaître IMMÉDIATEMENT, pas attendre le prochain clic sur
  // « Rechercher ».
  const reset = useCallback(() => {
    cancel();
    setStatus('idle');
    setResult(null);
    setProgress(null);
  }, [cancel]);

  return { status, result, progress, run, stop, cancel, reset };
}
