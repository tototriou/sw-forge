// Coquille Node (`worker_threads`) d'UNE tranche du prototype de construction
// des moitiés (src/lib/constructionRapide.ts, chantier perf-moteur, lot 2 bis),
// à l'usage du seul banc scripts/banc-construction-moities.ts. Aucune logique
// propre : `construireTranche` sur `workerData`, puis le résultat en retour,
// tableaux typés TRANSFÉRÉS (aucune mémoire partagée).
//
// ⚠️ Point d'entrée de fil, jamais un module à importer : il s'exécute au
// chargement. Bundlé en .cjs par le banc avant `new Worker(...)`.

import { parentPort, workerData } from 'worker_threads';
import { EntreeTranche, construireTranche } from '../../src/lib/constructionRapide';

export interface MessageTranche {
  resultat: ReturnType<typeof construireTranche>;
  /** Coût interne du fil (diagnostic, indicatif). */
  ms: number;
}

const t0 = performance.now();
const resultat = construireTranche(workerData as EntreeTranche);
const message: MessageTranche = { resultat, ms: performance.now() - t0 };
const transferts: ArrayBuffer[] = [resultat.codes.buffer as ArrayBuffer];
for (const c of resultat.compartiments) {
  transferts.push(c.maxPct.buffer as ArrayBuffer, c.maxFlat.buffer as ArrayBuffer, c.premierPct.buffer as ArrayBuffer, c.premierFlat.buffer as ArrayBuffer);
}
parentPort!.postMessage(message, transferts);
