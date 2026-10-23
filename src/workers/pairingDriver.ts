// Pilote un générateur d'appariement (`apparier`, ou `pairBuckets` en repli)
// jusqu'à sa fin : progression throttlée avec delta de candidats, rendu de
// main throttlé à la boucle d'événements, interruption coopérative. La FORME
// du message de progression posté est laissée à `onProgress`, jamais
// imposée ici.
//
// ⚠️ Paliers PARTAGÉS avec l'appariement parallèle (runeBuildOptim.worker.ts,
// qui espace lui-même la progression du coordinateur) — `PROGRESS_THROTTLE_MS`
// y reste utilisé directement, importé d'ici plutôt que redéfini.

import { cederLaMain } from '../lib/cession';
import { PairingProgress, SearchResult, BuildCandidate } from '../lib/runeBuildOptim';
import { BlocCandidats, ColonnesCandidats, SortieCandidats, extraireBlocs, tamponsCandidats } from '../lib/candidatsCompacts';
import { creerColonnesCandidats } from '../lib/candidatsCompacts';
import { apparierRapide } from '../lib/appariementRapide';
import { OptionsParallele, ResultatParallele, apparierRapideEnParallele, enResultatDeRecherche } from '../lib/appariementRapideParallele';

/** Le lanceur commun à l'écran et aux outils : mêmes publications et mêmes crédits. */
export async function lancerAppariement(
  options: OptionsParallele<ColonnesCandidats> & {
    regime: 'sequentiel' | 'parallele';
    flux: EmetteurCandidats;
    estArrete?: () => boolean;
    observer?: (explored: number, candidats: ColonnesCandidats) => void;
  }
): Promise<{ resultat: SearchResult<ColonnesCandidats>; parallele?: ResultatParallele<ColonnesCandidats> }> {
  const collecte = options.collecte ?? creerColonnesCandidats();
  const publier = async (explored: number, candidats: ColonnesCandidats) => {
    options.observer?.(explored, candidats);
    await options.flux.transmettre(candidats);
    await options.surProgression?.(explored, candidats);
  };
  if (options.regime === 'parallele') {
    const parallele = await apparierRapideEnParallele({ ...options, collecte, surProgression: publier });
    return { resultat: enResultatDeRecherche(parallele), parallele };
  }
  const source = apparierRapide(options.prepared, options.bucketsA, options.bucketsB, { collecte });
  const observer = function* () {
    let step = source.next();
    while (!step.done) {
      options.observer?.(step.value.explored, step.value.candidates);
      yield step.value;
      step = source.next();
    }
    return step.value;
  };
  const resultat = await drivePairing(options.observer ? observer() : source, options.estArrete ?? (() => false), async (explored, candidats) => {
    await options.flux.transmettre(candidats);
    await options.surProgression?.(explored, candidats);
  });
  return { resultat };
}

/** Fenêtre de transport : 16 × 4096 × 120 octets au plus, sans file illimitée. */
export const BLOCS_EN_VOL_VERS_PAGE = 16;

/** Crédits de la page, distincts de ceux des Workers producteurs. */
export class EmetteurCandidats {
  private rendreCredit: (() => void) | null = null;
  private enVol = 0;
  private nombre = 0;
  private scelle = false;
  constructor(private readonly poster: (bloc: BlocCandidats, transfert: ArrayBuffer[]) => void) {}
  acquitter(): void {
    if (this.enVol === 0) return;
    this.enVol--;
    const rendre = this.rendreCredit; this.rendreCredit = null; rendre?.();
  }
  private attendreCredit(): Promise<void> {
    return new Promise<void>((resolve) => { this.rendreCredit = resolve; });
  }
  async transmettre(sortie: ColonnesCandidats): Promise<void> {
    if (this.scelle) throw new Error('Flux de candidats déjà scellé');
    for (const bloc of extraireBlocs(sortie)) {
      while (this.enVol >= BLOCS_EN_VOL_VERS_PAGE) await this.attendreCredit();
      if (bloc.debut !== this.nombre) throw new Error('Ordre du flux de candidats incohérent');
      // Installer le crédit avant l'envoi : une réception de test peut être synchrone.
      this.enVol++;
      this.nombre += bloc.longueur;
      this.poster(bloc, tamponsCandidats([bloc]));
    }
  }
  async sceller(sortie: ColonnesCandidats): Promise<number> {
    await this.transmettre(sortie);
    while (this.enVol > 0) await this.attendreCredit();
    if (sortie.length !== this.nombre) throw new Error('Candidats manquants au scellement');
    this.scelle = true;
    return this.nombre;
  }
}

// ⚠️ Un message de progression par point de passage flooderait le fil
// principal (des centaines de `postMessage` par seconde quand l'élagage est
// efficace) — throttlé au temps écoulé plutôt qu'au nombre de points de
// passage, pour rester fluide quel que soit le rythme réel de la recherche.
export const PROGRESS_THROTTLE_MS = 150;
// ⚠️ Rendre la main À CHAQUE point de passage (tous les 500 nœuds, voir
// CHECKPOINT_EVERY dans runeBuildOptim.ts) coûte bien plus cher qu'il n'y
// paraît : les navigateurs plafonnent `setTimeout(fn, 0)` appelé en boucle à
// ~4 ms (throttling standard, y compris dans un Worker) — sur une recherche
// de 20 000 000 de paires, ça fait 40 000 rendus de main, soit jusqu'à ~160 s
// de pur overhead de planification. Throttlé au temps écoulé, comme la
// progression ci-dessus, mais plus fréquemment (le bouton « Arrêter » doit
// rester réactif) — un ordre de grandeur sous le seuil de perceptibilité
// humaine, largement suffisant. La cession elle-même passe par un message de
// canal (`cederLaMain`), non bridé : le plafond à ~4 ms ne vaut que pour
// `setTimeout`, repli quand `MessageChannel` manque.
export const YIELD_THROTTLE_MS = 50;

// Retourne un `SearchResult` UNIFORME quelle que soit l'issue — un arrêt
// coopératif (`isStopped()`) construit un résultat `truncated: true` à
// partir de la dernière progression connue, exactement comme le ferait
// `pairBuckets` s'il avait lui-même épuisé son budget-temps à cet instant —
// jamais besoin, côté appelant, de distinguer les deux cas.
// `foundTotal` (3ᵉ argument d'`onProgress`) = `candidates.length` CUMULÉ à
// ce point de passage — pas seulement `newCandidates.length` (le delta) —
// nécessaire à `WorkerPairingMessage.found` (runeBuildOptim.worker.ts).
export async function drivePairing<C extends SortieCandidats = BuildCandidate[]>(
  gen: Generator<PairingProgress<C>, SearchResult<C>, void>,
  isStopped: () => boolean,
  onProgress: (explored: number, newCandidates: C, foundTotal: number) => void | Promise<void>
): Promise<SearchResult<C>> {
  let candidatesSent = 0;
  let lastProgressPost = 0;
  let lastYield = Date.now();
  let step = gen.next();
  while (!step.done) {
    if (isStopped()) {
      const progress = step.value;
      // ⚠️ Le near-miss accumulé jusqu'à cet instant DOIT survivre à l'arrêt
      // — sans ces deux champs, un arrêt manuel perdrait silencieusement ce
      // que `pairBuckets` avait déjà trouvé (voir docs/03-developpeur/optimizer/
      // § Types et transport du quasi-succès : ce site est un de ceux qui
      // reconstruisent `SearchResult` à la main).
      return {
        candidates: progress.candidates,
        explored: progress.explored,
        truncated: true,
        nearMissByCondition: progress.nearMissByCondition,
        globalNearMiss: progress.globalNearMiss,
      };
    }
    const now = Date.now();
    const progress = step.value;
    if (now - lastProgressPost > PROGRESS_THROTTLE_MS || (!Array.isArray(progress.candidates) && progress.candidates.blocs.length > 1)) {
      lastProgressPost = now;
      const newCandidates = (Array.isArray(progress.candidates) ? progress.candidates.slice(candidatesSent) : progress.candidates) as C;
      candidatesSent = progress.candidates.length;
      await onProgress(progress.explored, newCandidates, candidatesSent);
    }
    if (now - lastYield > YIELD_THROTTLE_MS) {
      lastYield = now;
      await cederLaMain();
    }
    step = gen.next();
  }
  return step.value;
}
