// Protocole de préparation d'une recherche — la LOGIQUE seule, sans aucune
// API de messagerie (même patron que `pairSliceBody.ts` pour la phase
// d'appariement) : `prepareSearch` peut lever `RechercheRefusee` (pool de
// reliques vide en mode `recherche`, D1) ou toute autre erreur, et cette
// fonction les convertit en un résultat NOMMÉ plutôt que de laisser l'appel
// direct dans `self.onmessage` transformer un rejet en promesse non gérée
// (revue adversariale du diff du lot 5a, BLOQUANT 1 : aucune réponse
// n'était postée, `Worker.onerror` ne se déclenchait pas, l'UI restait dans
// `'running'`). Neutre — testable en Node sans `self`.
//
// ⚠️ `prepareSearch` qui rend `null` (pré-filtrage ayant vidé un slot) reste
// un cas DISTINCT du refus : comportement inchangé, résultat vide normal.

import { PreparedSearch, RechercheRefusee, SearchParams, prepareSearch } from '../lib/runeBuildOptim';
import { RelicVide } from '../lib/relicOptim';

export type PrepareOutcome =
  | { kind: 'prepared'; prepared: PreparedSearch }
  | { kind: 'empty' }
  | { kind: 'refus'; motif: 'relique-pool-vide'; vide: RelicVide }
  | { kind: 'error'; message: string };

export function prepareOrRefuse(params: SearchParams): PrepareOutcome {
  try {
    const prepared = prepareSearch(params);
    return prepared ? { kind: 'prepared', prepared } : { kind: 'empty' };
  } catch (e) {
    if (e instanceof RechercheRefusee) return { kind: 'refus', motif: e.motif, vide: e.vide };
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
