import { useCallback, useEffect, useRef, useState } from 'react';
import { SearchParams, SearchResult } from '../lib/runeBuildOptim';

export type BuildOptimStatus = 'idle' | 'running' | 'done' | 'error';

// Cycle de vie du Worker de recherche de builds.
//
// ⚠️ « Annulable » veut dire ici qu'on TERMINE le worker en cours plutôt que
// de tenter une annulation coopérative : le volume de calcul (quelques
// centaines de milliers de nœuds) ne justifie pas un protocole de message
// d'arrêt. `run()` termine tout worker déjà en vol avant d'en lancer un
// nouveau — une recherche qui change de paramètres ne doit pas laisser une
// ancienne réponse écraser la nouvelle.
export function useBuildOptimSearch() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<BuildOptimStatus>('idle');
  const [result, setResult] = useState<SearchResult | null>(null);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => terminate, [terminate]);

  const run = useCallback(
    (params: SearchParams) => {
      terminate();
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
    [terminate]
  );

  return { status, result, run, cancel: terminate };
}
