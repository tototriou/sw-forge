/// <reference lib="webworker" />
// Premier Worker de l'app. Wrapper minimal : le calcul lui-même (pur, sans
// React) vit dans lib/runeBuildOptim.ts et reste réutilisable dans les tests
// sans passer par un Worker. Voir spec/compte/calcul-runes.md §6 (Perf).

import { searchBuilds, SearchParams, SearchResult } from '../lib/runeBuildOptim';

self.onmessage = (e: MessageEvent<SearchParams>) => {
  const result: SearchResult = searchBuilds(e.data);
  (self as unknown as Worker).postMessage(result);
};
