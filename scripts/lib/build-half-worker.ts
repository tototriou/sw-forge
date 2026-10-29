// Équivalent Node (`worker_threads`) de `src/workers/buildHalf.worker.ts`,
// lancé par scripts/perf-battery.ts et par la coquille Node
// (scripts/lib/buildHalvesNode.ts) — pour que la mesure de construction
// reflète le vrai comportement de l'app (un fil par moitié ET par préréglage
// construit, EN PARALLÈLE, voir
// docs/03-developpeur/optimizer/,
// « Construction des moitiés »), pas une simulation séquentielle dans le même processus qui
// gonflerait artificiellement le temps de construction mesuré.
//
// Repris via esbuild en .cjs par perf-battery.ts avant d'être passé à
// `new Worker(...)` — un fil `worker_threads` a besoin de JS pur, pas de
// TypeScript transpilé à la volée.

import { parentPort, workerData } from 'worker_threads';
import { CompartimentType, tamponsDesDemiBuilds } from '../../src/lib/demiBuildsTypes';
// Les mêmes colonnes que `src/workers/buildHalf.worker.ts`, sans HalfCombo.
import { construireMoitieTypee } from '../../src/lib/rechercheRunes';
import type { RequeteMoitie } from '../../src/lib/constructionEmboitee';
import { drain } from './drain';

/**
 * La requête d'UN préréglage d'une moitié, la même que celle des Web Workers
 * de moitié (`RequeteMoitie`, produite par `requetesDeLaMoitie` : préréglages
 * emboîtés, un fil par moitié et par préréglage), plus l'horodatage opt-in.
 */
export interface BuildHalfWorkerData extends RequeteMoitie {
  /**
   * A₂ — horodater les `BuildingProgress` que
   * `buildBuckets` émet DÉJÀ, pour cartographier son ÉLAGAGE.
   *
   * ⚠️ **OPT-IN, et ce n'est pas une commodité.** `perf-battery.ts` PARTAGE
   * ce worker et c'est l'outil de mesure de référence : omis (son cas, et
   * celui de tout appelant qui ne le demande pas), le générateur est drainé
   * exactement comme avant — aucun `performance.now()` de plus, aucun
   * tableau alloué, aucun champ de plus dans le message de retour.
   *
   * ⚠️ **Aucun `yield` n'est ajouté au moteur**, et aucun message n'est
   * envoyé par `yield` : `buildBuckets` est un générateur SYNCHRONE dont
   * `drain()` consomme déjà chacune de ses émissions. Seul change ce que le
   * CONSOMMATEUR en fait, et le relevé part UNE SEULE FOIS avec le résultat
   * — sinon l'instrumentation entrerait dans le temps qu'elle mesure.
   */
  horodaterProgression?: boolean;
}
/**
 * Relevé mémoire de FIN de moitié — docs/03-developpeur/optimizer/
 * (harnais, extensions), « La construction observée », palier **LÉGER**.
 *
 * ⚠️ **Pourquoi la mesure est propre ici et nulle part ailleurs** : chaque
 * moitié tourne dans son PROPRE `worker_threads`, donc dans son propre tas.
 * Le tas et les ArrayBuffer sont propres au fil ; rss reste global au processus.
 *
 * ⚠️ **Palier LÉGER, et c'est un arbitrage** : trois lignes après la
 * construction, donc aucune perturbation de la phase mesurée. Le palier
 * complet — un `PerformanceObserver` sur les événements `gc`, pour compter
 * les pauses et leur durée — est ÉCARTÉ tant que le relevé léger ne montre
 * pas d'écart A/B : l'observateur a son propre coût et s'insère dans la
 * phase qu'on mesure.
 */
export interface MemoireMoitie {
  heapUsed: number;
  heapTotal: number;
  /** Stockage hors tas des ArrayBuffer, colonnes comprises, avant transfert. */
  arrayBuffers: number;
  /** Mémoire résidente du processus entier, commune aux fils. */
  rss: number;
}

/**
 * Le relevé BRUT d'A₂ — les intervalles entre les `BuildingProgress` que
 * `buildBuckets` émet, un par rune de l'emplacement EXTÉRIEUR (`slotIdxs[0]`).
 *
 * ⚠️ **PÉRIMÈTRE DE L'HORLOGE — à lire avant d'interpréter un seul de ces
 * nombres.** Un intervalle est mesuré entre deux `gen.next()` du
 * CONSOMMATEUR : il couvre le corps de la boucle extérieure, mais AUSSI la
 * suspension et la reprise du générateur, et tout ce que la coquille fait
 * entre-temps. Ce n'est donc pas « le temps passé dans `buildBuckets` », et
 * ce n'est surtout pas un « temps par triplet énumérable » : ce compteur ne
 * mesure AUCUNE itération interne.
 *
 * ⚠️ **Trois champs SÉPARÉS, parce qu'ils ne couvrent pas la même chose** —
 * les verser dans une même série fabriquerait deux valeurs aberrantes dans
 * une distribution qu'on lit justement pour sa FORME :
 *
 * | `next()` | ce qu'il exécute |
 * |---|---|
 * | le 1ᵉʳ | le PROLOGUE (précalculs, tranches) jusqu'au premier `yield` — aucun corps de rune |
 * | les suivants | le corps d'UNE rune extérieure, puis le `yield` de la suivante |
 * | le dernier | le corps de la DERNIÈRE rune extérieure **plus l'ÉPILOGUE** (tri des combos de chaque compartiment, puis tri des compartiments) |
 */
export interface ProgressionMoitie {
  /** 1ᵉʳ `next()` : le prologue SEUL. Aucune rune extérieure n'y est traitée. */
  prologueMs: number;
  /**
   * Un intervalle par rune extérieure SAUF LA DERNIÈRE — chacun couvre le
   * corps d'UNE rune, et c'est la seule série HOMOGÈNE du relevé. C'est sur
   * elle, et sur elle seule, qu'une distribution a un sens.
   */
  intervallesMs: number[];
  /**
   * Dernier `next()` : corps de la dernière rune extérieure **+ épilogue**.
   * Jamais versé dans `intervallesMs` — l'épilogue trie tous les combos de
   * tous les compartiments, il pèse ce qu'il pèse et n'a rien à faire dans
   * une distribution PAR RUNE.
   */
  derniereEtEpilogueMs: number;
  /**
   * Le nombre de runes extérieures, lu sur le `total` du dernier
   * `BuildingProgress` — donc annoncé par le MOTEUR, jamais recompté ici.
   * ⚠️ 0 si le générateur n'a émis aucune progression.
   */
  runesExterieures: number;
}

export interface BuildHalfWorkerResult {
  buckets: CompartimentType[];
  ms: number;
  memoire: MemoireMoitie;
  /** A₂ — présent SEULEMENT si `horodaterProgression` a été demandé. */
  progression?: ProgressionMoitie;
}

const data = workerData as BuildHalfWorkerData;

/**
 * ⚠️ **Deux consommateurs, un seul générateur — et le chemin par défaut ne
 * doit RIEN payer.** Sans le drapeau, c'est le `drain()` partagé, mot pour
 * mot ce que ce worker faisait avant A₂ ; avec, la même boucle écrite à la
 * main (`next()` jusqu'à `done`, valeur de retour = `step.value`), plus un
 * `performance.now()` par émission. ⚠️ `drain.ts` n'est PAS touché : il est
 * importé par 28 fichiers, et A₂ ne concerne que ce worker-ci.
 */
function construire(): { buckets: CompartimentType[]; ms: number; progression?: ProgressionMoitie } {
  const gen = construireMoitieTypee(
    data.half,
    data.slotIdxs,
    data,
    data.otherHalfMaxSets,
    data.combosOrderMode
  );
  if (!data.horodaterProgression) {
    const t0 = performance.now();
    const buckets = drain(gen);
    return { buckets, ms: performance.now() - t0 };
  }
  const intervallesMs: number[] = [];
  let runesExterieures = 0;
  let derniereEtEpilogueMs = 0;
  const t0 = performance.now();
  let step = gen.next();
  // ⚠️ Le premier `next()` a exécuté le prologue ENTIER (précalculs,
  // tranches) avant d'atteindre le premier `yield` : son intervalle ne
  // décrit AUCUNE rune extérieure, et le confondre avec les autres
  // fabriquerait un maximum qui n'en est pas un.
  // ⚠️ Cas dégénéré : si le générateur rend `done` dès ce premier appel
  // (emplacement extérieur vide, donc zéro `yield`), `prologueMs` couvre
  // tout le travail — et `runesExterieures: 0` le dit.
  let t = performance.now();
  const prologueMs = t - t0;
  let precedent = t;
  while (!step.done) {
    runesExterieures = step.value.total;
    step = gen.next();
    t = performance.now();
    // ⚠️ Le `next()` qui rend `done` a exécuté la dernière rune ET
    // l'épilogue : il sort de la série homogène, il ne la contamine pas.
    if (step.done) derniereEtEpilogueMs = t - precedent;
    else intervallesMs.push(t - precedent);
    precedent = t;
  }
  return {
    buckets: step.value,
    ms: t - t0,
    progression: { prologueMs, intervallesMs, derniereEtEpilogueMs, runesExterieures },
  };
}

const { buckets, ms, progression } = construire();
// ⚠️ APRÈS le chronomètre : le relevé ne doit entrer dans aucun temps
// mesuré, et il est pris avant que quoi que ce soit ne soit sérialisé vers
// le fil parent — donc sur l'état laissé par la construction elle-même.
const usage = process.memoryUsage();
const result: BuildHalfWorkerResult = {
  buckets,
  ms,
  memoire: { heapUsed: usage.heapUsed, heapTotal: usage.heapTotal, arrayBuffers: usage.arrayBuffers, rss: usage.rss },
  // ⚠️ Le champ n'existe même pas quand l'horodatage n'a pas été demandé —
  // aucun tableau d'intervalles ne voyage dans le cas ordinaire.
  ...(progression != null ? { progression } : {}),
};
parentPort!.postMessage(result, tamponsDesDemiBuilds(buckets));
