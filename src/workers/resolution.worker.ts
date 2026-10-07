/// <reference lib="webworker" />
// Worker de RÉSOLUTION D'ÉQUIPEMENT (paire d'artéfacts et relique, un build à
// la fois).
//
// ⚠️ **COQUILLE SEULE — aucune logique ici.** Tout vit dans
// `resolutionBody.ts` (`CorpsResolution`), importable en Node et exercé tel
// quel par `tests/resolution-worker.test.ts` : ce fichier ne fait que brancher
// `self.onmessage`/`postMessage` dessus. Les types du protocole vivent avec
// le corps.
//
// Branchée par la file (`useArtifactOptimQueue`, spec/outils/optimizer/moteur/parallelisation.md
// § Worker de résolution) : un Worker pour la vie du hook, piloté par `ResolutionDistante`
// (resolutionDistante.ts) — au plus deux demandes à la fois, réponses périmées
// ignorées, chemin direct en repli. Comme pour les autres coquilles, son
// comportement réel (messages, arrêt, absence de fuite) ne se vérifie qu'au
// navigateur.

import { CorpsResolution, MessageVersResolution, ReponseResolution } from './resolutionBody';

const corps = new CorpsResolution();
let programmee = false;

function poster(r: ReponseResolution) {
  (self as unknown as Worker).postMessage(r);
}

// UNE demande par tâche : un message arrivé entre deux résolutions (nouveau
// contexte, annulation) est traité avant la demande suivante. L'ordre entre
// la tâche de minuterie et un message déjà en attente n'est pas garanti par
// la plateforme : l'annulation reste une économie, la garantie est côté
// appelant, qui ignore toute réponse d'une demande annulée ou d'un contexte
// périmé (`idContexte`, `idDemande`).
function suivante() {
  programmee = false;
  const r = corps.etape();
  if (r) poster(r);
  if (corps.demandesEnAttente > 0) programmer();
}

function programmer() {
  if (programmee) return;
  programmee = true;
  setTimeout(suivante, 0);
}

self.onmessage = (e: MessageEvent<MessageVersResolution>) => {
  for (const r of corps.recevoir(e.data)) poster(r);
  if (corps.demandesEnAttente > 0) programmer();
};
