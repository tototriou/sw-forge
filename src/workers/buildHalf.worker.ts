/// <reference lib="webworker" />
// Worker DÉDIÉ à la construction d'UN préréglage d'UNE moitié
// (`construireMoitie` : le noyau sur tableaux typés, `buildBuckets` en
// repli), spawné PAR `runeBuildOptim.worker.ts` (pas par l'app directement),
// un par moitié et par préréglage construit (préréglages emboîtés,
// `construireMoitiesEmboitees`) — voir
// docs/03-developpeur/optimizer/moteur/pipeline.md § Construction des moitiés.
// Reste minimal, comme runeBuildOptim.worker.ts : aucune
// logique propre, pilote juste la construction pas à pas pour pouvoir relayer
// une progression pendant que ça tourne.
//
// ⚠️ Pas de protocole d'arrêt ICI (contrairement à runeBuildOptim.worker.ts) :
// un arrêt manuel PENDANT la construction se traite en tuant le Worker depuis
// le parent (`Worker.terminate()`), instantané et fiable — bien plus simple
// qu'un arrêt coopératif à répercuter sur tous les Workers de moitié à la
// fois (2 à 8, un par moitié et par préréglage construit). Ce
// Worker n'a donc besoin de gérer qu'UN seul message (la demande initiale),
// jamais un second message « stop ».

import { Bucket } from '../lib/runeBuildOptim';
import { construireMoitie, totalConstruction } from '../lib/rechercheRunes';
import { RequeteMoitie } from '../lib/constructionEmboitee';

// La requête d'UN préréglage d'une moitié (préréglages emboîtés : un Worker
// par moitié ET par préréglage, `construireMoitiesEmboitees`), produite par
// `requetesDeLaMoitie` — jamais assemblée à la main.
export type BuildHalfRequest = RequeteMoitie;
export interface BuildHalfProgressMessage {
  type: 'progress';
  half: 'A' | 'B';
  scanned: number;
  total: number;
}
export interface BuildHalfResultMessage {
  type: 'result';
  half: 'A' | 'B';
  buckets: Bucket[];
}
export type BuildHalfResponse = BuildHalfProgressMessage | BuildHalfResultMessage;

// Même palier que runeBuildOptim.worker.ts (PROGRESS_THROTTLE_MS) — pas de
// raison de relayer plus souvent ici, la contrainte (ne pas flooder le fil
// principal) est identique.
const PROGRESS_THROTTLE_MS = 150;

self.onmessage = (e: MessageEvent<BuildHalfRequest>) => {
  const { half, slotIdxs, otherHalfMaxSets, combosOrderMode } = e.data;
  // Connu D'AVANCE (indépendant du générateur) : le total réel que
  // la construction annoncera — runes du premier emplacement de la moitié,
  // sommées sur les préréglages emboîtés (`totalConstruction`) — sert
  // au message de fin garanti ci-dessous, voir son commentaire.
  const total = totalConstruction(e.data, slotIdxs);
  // ⚠️ `e.data` (BuildHalfRequest) satisfait déjà STRUCTURELLEMENT
  // `ContexteMoitie` (les champs de `BuildBucketsContext`, voir son
  // commentaire dans runeBuildOptim.ts, plus `cransEmboites`) — pas besoin
  // de reconstruire un objet, les champs en
  // trop (half/slotIdxs/otherHalfMaxSets/…) sont ignorés sans risque
  // puisque ce n'est pas un littéral d'objet (aucune vérification de
  // propriété excédentaire de TypeScript ici).
  const gen = construireMoitie(half, slotIdxs, e.data, otherHalfMaxSets, combosOrderMode);
  let lastPost = 0;
  let step = gen.next();
  while (!step.done) {
    const now = Date.now();
    if (now - lastPost > PROGRESS_THROTTLE_MS) {
      lastPost = now;
      const p = step.value;
      const message: BuildHalfProgressMessage = { type: 'progress', half: p.half, scanned: p.scanned, total: p.total };
      (self as unknown as Worker).postMessage(message);
    }
    step = gen.next();
  }
  // ⚠️ Point de passage final GARANTI, jamais throttlé — sans lui, les tout
  // derniers points (proches de `total`) tombent souvent dans la même
  // fenêtre de throttle que le précédent et sont absorbés : la barre
  // affichée restait bloquée juste avant 100 % (ex. 57/61) alors que le
  // calcul, LUI, allait bien jusqu'au bout (cette boucle ne saute JAMAIS une
  // étape de `gen.next()`, seulement des `postMessage` — voir
  // docs/02-app/optimizer/ § Barre de progression). Un cas réel
  // confirmé en usage : la barre ne
  // semblait jamais finir, laissant croire à tort que des demi-builds
  // manquaient au résultat.
  const finalProgress: BuildHalfProgressMessage = { type: 'progress', half, scanned: total, total };
  (self as unknown as Worker).postMessage(finalProgress);
  const message: BuildHalfResultMessage = { type: 'result', half, buckets: step.value };
  (self as unknown as Worker).postMessage(message);
};
