import { useCallback, useEffect, useRef, useState } from 'react';
import { SearchParams, SearchResult } from '../lib/runeBuildOptim';

export type BuildOptimStatus = 'idle' | 'running' | 'done' | 'error';

// Cycle de vie du Worker de recherche de builds.
//
// Deux façons d'interrompre, pas interchangeables :
//  - `stop()` — arrêt COOPÉRATIF : poste un message que le Worker traite à
//    son prochain point de passage (voir runeBuildOptim.worker.ts) et
//    ressort ce qu'il a trouvé jusque-là (`truncated: true`). C'est celui du
//    bouton « Arrêter » de l'UI : on veut le résultat partiel, pas le perdre.
//  - `cancel()` — arrêt SEC (`terminate()`) : rien n'est récupéré. Utilisé au
//    démontage et par `run()` lui-même avant de lancer une nouvelle
//    recherche, pour qu'une réponse tardive de l'ancien Worker n'écrase
//    jamais les paramètres qu'on vient de changer.
export function useBuildOptimSearch() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<BuildOptimStatus>('idle');
  const [result, setResult] = useState<SearchResult | null>(null);

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (params: SearchParams) => {
      cancel();
      setStatus('running');
      setResult(null);
      const worker = new Worker(new URL('../workers/runeBuildOptim.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      worker.onmessage = (e: MessageEvent<SearchResult>) => {
        setResult(e.data);
        setStatus('done');
      };
      worker.onerror = () => setStatus('error');
      worker.postMessage(params);
    },
    [cancel]
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage({ stop: true });
  }, []);

  return { status, result, run, stop, cancel };
}
