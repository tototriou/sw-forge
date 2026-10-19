// L'appariement PARALLÈLE de production (src/lib/appariementRapideParallele.ts) :
// la règle du nombre de Workers et du régime (src/workers/parallelPairing.ts),
// puis le coordinateur — résultat identique au séquentiel, plafond global,
// progression, arrêt manuel coopératif, filet de temps, erreur d'un Worker —,
// d'abord avec des Workers simulés dans le processus (décisions de
// coordination, sans horloge), puis sur de VRAIS `worker_threads` (le lanceur
// Node du harnais, `scripts/lib/appariementRapideNode.ts`), enfin le
// branchement côté Node : le harnais, qui orchestre la production, apparie
// en parallèle au-delà du seuil et rend ce que rend le séquentiel.
//
// ⚠️ Rien ici ne dépend du temps réel sauf le filet de temps, testé sur un
// délai déjà écoulé (déterministe) : un test de parallélisation ne simule
// jamais séquentiellement un mécanisme qui dépend de l'horloge (invariants
// § Workers). La différence au séquentiel n'est attendue que sous une
// troncature par le temps.

import { availableParallelism } from 'node:os';
import { BaseStats } from '../src/types';
import { executerHarnais } from '../scripts/lib/diagnosticHarness';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import { Bucket, BuildCandidate, BuildRequirement, PreparedSearch, SearchParams, SearchResult, pairBuckets, prepareSearch, totalPairCount } from '../src/lib/runeBuildOptim';
import { apparier, construireMoitie } from '../src/lib/rechercheRunes';
import { InitTravailleur, Morceau, ResultatMorceau, encoderCompartiments, initialiserTravailleur, traiterMorceau } from '../src/lib/appariementRapide';
import { LancerTravailleur, OptionsParallele, apparierRapideEnParallele, enResultatDeRecherche, planifierMorceaux } from '../src/lib/appariementRapideParallele';
import {
  PARALLEL_PAIRING_THRESHOLD, TRAVAILLEURS_MAX, TRAVAILLEURS_PAR_DEFAUT, nombreDeTravailleurs, regimeAppariement,
} from '../src/workers/parallelPairing';
import { assurerBundleAppariementRapide, lancerTravailleurNode } from '../scripts/lib/appariementRapideNode';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 9000, atk: 700, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

interface Espace {
  nom: string;
  params: SearchParams;
  prepared: PreparedSearch;
  bucketsA: Bucket[];
  bucketsB: Bucket[];
  total: number;
  reference: SearchResult;
}

/** Des espaces de quelques milliers à quelques centaines de milliers de paires, avec des candidats, par la construction de production. */
function espaces(): Espace[] {
  const out: Espace[] = [];
  for (let s = 0; out.length < 5 && s < 200; s++) {
    const rng = mulberry32(8100 + s);
    const pool = randomPool(rng, 7 + Math.floor(rng() * 4), SETS_JOKER);
    const minStats: BuildRequirement['minStats'] = { spd: 120 + Math.floor(rng() * 40) };
    if (rng() < 0.5) minStats.cr = 30 + Math.floor(rng() * 30);
    const maxStats: NonNullable<BuildRequirement['maxStats']> = rng() < 0.4 ? { def: 900 + Math.floor(rng() * 400) } : {};
    const requirement: BuildRequirement = { sets: rng() < 0.5 ? [SETS_JOKER[Math.floor(rng() * (SETS_JOKER.length - 1))]] : [], minStats, maxStats };
    const params: SearchParams = { base: BASE, artifacts: [], pool, requirement, metric: 'eff', maxMs: Infinity, maxCollected: Infinity, slotFilterCap: 80 };
    const prepared = prepareSearch(params);
    if (!prepared) continue;
    const bucketsA = drain(construireMoitie('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const bucketsB = drain(construireMoitie('B', [3, 4, 5], prepared, prepared.maxSetsForB));
    const total = totalPairCount(prepared, bucketsA, bucketsB);
    const reference = drain(apparier(prepared, bucketsA, bucketsB));
    if (total < 2000 || reference.candidates.length < 8) continue;
    out.push({ nom: `espace ${s} (${total} paires, ${reference.candidates.length} candidats)`, params, prepared, bucketsA, bucketsB, total, reference });
  }
  return out;
}

const etat = (r: Pick<SearchResult, 'candidates' | 'explored' | 'truncated' | 'nearMissByCondition' | 'globalNearMiss'>) =>
  JSON.stringify([r.candidates, r.explored, r.truncated, r.nearMissByCondition, r.globalNearMiss]);
const cle = (c: BuildCandidate) => c.runeIds.join(',');
const estPrefixe = (court: readonly BuildCandidate[], long: readonly BuildCandidate[]) =>
  court.length <= long.length && court.every((c, i) => cle(c) === cle(long[i]));

/** Workers simulés dans le processus, qui rendent leurs morceaux dans le désordre ; chaque poignée note sa fin. */
function lanceurSimule(rng: () => number, journal: { lances: number; termines: number }, panne?: { apres: number }): LancerTravailleur {
  let envois = 0;
  return (init: InitTravailleur) => {
    journal.lances++;
    const ctx = initialiserTravailleur(structuredClone(init));
    let rappel: (r: ResultatMorceau) => void = () => {};
    let surErreur: (e: unknown) => void = () => {};
    return {
      envoyer: (m: Morceau) => {
        const copie = structuredClone(m);
        const enPanne = panne != null && ++envois > panne.apres;
        setTimeout(() => (enPanne ? surErreur(new Error('Worker en panne')) : rappel(structuredClone(traiterMorceau(ctx, copie)))), Math.floor(rng() * 4));
      },
      surMessage: (r) => {
        rappel = r;
      },
      surErreur: (r) => {
        surErreur = r;
      },
      terminer: () => {
        journal.termines++;
      },
    };
  };
}

function options(e: Espace, lancer: LancerTravailleur, extra: Partial<OptionsParallele> = {}): OptionsParallele {
  return {
    params: e.params, prepared: e.prepared, bucketsA: e.bucketsA, bucketsB: e.bucketsB, totalPaires: e.total, travailleurs: 3,
    lancer, startedAt: Date.now(), cibleMorceau: Math.max(1, Math.ceil(e.total / 29)), ...extra,
  };
}

function testRegles(): void {
  titre('Appariement parallèle · nombre de Workers dérivé de la machine, régime');
  egal(nombreDeTravailleurs(undefined), TRAVAILLEURS_PAR_DEFAUT, `concurrence inconnue → ${TRAVAILLEURS_PAR_DEFAUT} Workers`);
  egal(nombreDeTravailleurs(Number.NaN), TRAVAILLEURS_PAR_DEFAUT, 'concurrence illisible (NaN) → défaut');
  egal(nombreDeTravailleurs(0), TRAVAILLEURS_PAR_DEFAUT, 'concurrence nulle → défaut');
  egal([1, 2, 3, 4, 6, 8, 12, 16, 24, 32].map(nombreDeTravailleurs), [1, 1, 1, 2, 3, 4, 6, 8, 8, 8],
    `moitié des fils logiques, au moins 1, au plus ${TRAVAILLEURS_MAX} (16 fils → 8, le meilleur mesuré)`);
  egal(regimeAppariement(PARALLEL_PAIRING_THRESHOLD - 1, null), 'sequentiel', 'sous le seuil : séquentiel');
  egal(regimeAppariement(PARALLEL_PAIRING_THRESHOLD, null), 'parallele', 'au seuil, contrat tenu : parallèle');
  egal(regimeAppariement(10 * PARALLEL_PAIRING_THRESHOLD, 'traceur de diagnostic demandé'), 'sequentiel',
    'au-delà du seuil, hors contrat numérique : séquentiel (repli pairBuckets qui rend la main)');
}

async function testCoordination(liste: Espace[]): Promise<void> {
  titre('Appariement parallèle · coordinateur, Workers simulés dans le désordre');
  ok(liste.length >= 4, `${liste.length} espaces construits par la construction de production`);
  const rng = mulberry32(31);
  for (const e of liste) {
    egal(etat(e.reference), etat(drain(pairBuckets(e.prepared, e.bucketsA, e.bucketsB))), `${e.nom} : la référence séquentielle (apparier) = pairBuckets`);
    egal(planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, Math.ceil(e.total / 29)).reduce((s, m) => s + m.taille, 0), e.total, `${e.nom} : le plan couvre totalPairCount`);

    // Résultat, progression.
    const journal = { lances: 0, termines: 0 };
    const progression: { traitees: number; n: number; prefixe: boolean }[] = [];
    let precedente: readonly BuildCandidate[] = [];
    const r = await apparierRapideEnParallele(options(e, lanceurSimule(rng, journal), {
      surProgression: (traitees, candidats) => {
        progression.push({ traitees, n: candidats.length, prefixe: estPrefixe(precedente, candidats) });
        precedente = [...candidats];
      },
    }));
    egal(etat(enResultatDeRecherche(r)), etat(e.reference), `${e.nom} : non tronqué, résultat identique au séquentiel (ordre compris)`);
    ok(progression.length === r.morceauxTraites && progression.length > 1, `${e.nom} : une progression par morceau reçu (${progression.length})`);
    ok(progression.every((p, i) => i === 0 || (p.traitees >= progression[i - 1].traitees && p.n >= progression[i - 1].n)) && progression[progression.length - 1].traitees === e.total,
      `${e.nom} : paires traitées et candidats ne reculent jamais, et finissent à totalPairCount`);
    ok(progression.every((p) => p.prefixe) && estPrefixe(precedente, r.candidates), `${e.nom} : l'aperçu est toujours un préfixe du résultat`);
    egal(journal.termines, journal.lances, `${e.nom} : chaque Worker lancé est terminé (${journal.lances})`);

    // Plafond GLOBAL, dans l'ordre séquentiel.
    const petit = 3;
    const refPetit = drain(apparier({ ...e.prepared, maxCollected: petit }, e.bucketsA, e.bucketsB));
    const rPetit = await apparierRapideEnParallele(options(e, lanceurSimule(rng, { lances: 0, termines: 0 }), {
      params: { ...e.params, maxCollected: petit }, prepared: { ...e.prepared, maxCollected: petit },
    }));
    egal(etat(enResultatDeRecherche(rPetit)), etat(refPetit), `${e.nom} : maxCollected = ${petit}, les ${petit} premiers de l'ordre séquentiel (aucune part par Worker)`);
    egal(rPetit.motif, 'maxCollected', `${e.nom} : motif maxCollected`);

    // Arrêt manuel coopératif, après le premier morceau reçu.
    const jArret = { lances: 0, termines: 0 };
    let arreter: (() => void) | null = null;
    const rArret = await apparierRapideEnParallele(options(e, lanceurSimule(rng, jArret), {
      surControle: (c) => {
        arreter = c.arreter;
      },
      surProgression: () => arreter?.(),
    }));
    ok(rArret.truncated && rArret.motif === 'manuel' && rArret.explored < e.total, `${e.nom} : arrêt manuel → tronqué, motif manuel, ${rArret.explored} / ${e.total} paires`);
    ok(estPrefixe(rArret.candidates, e.reference.candidates), `${e.nom} : arrêt manuel → ce qui a été trouvé, un préfixe du séquentiel (${rArret.candidates.length} candidats)`);
    egal(jArret.termines, jArret.lances, `${e.nom} : arrêt manuel → chaque Worker terminé`);
  }

  const e = liste[0];
  // Arrêt avant tout travail : aucun Worker lancé, résultat vide, tronqué.
  const jAvant = { lances: 0, termines: 0 };
  const rAvant = await apparierRapideEnParallele(options(e, lanceurSimule(rng, jAvant), { surControle: (c) => c.arreter() }));
  ok(rAvant.truncated && rAvant.candidates.length === 0 && rAvant.motif === 'manuel' && jAvant.lances === 0, 'arrêt avant la distribution : aucun Worker lancé, résultat vide, tronqué');
  // Filet de temps déjà dépassé : rien ne part, l'attente se termine quand même.
  const rTemps = await apparierRapideEnParallele(options(e, lanceurSimule(rng, { lances: 0, termines: 0 }), {
    prepared: { ...e.prepared, maxMs: 10 }, startedAt: Date.now() - 1000,
  }));
  ok(rTemps.truncated && rTemps.motif === 'maxMs' && rTemps.candidates.length === 0, 'filet de temps déjà dépassé : tronqué (maxMs), sans blocage');
  // Panne d'un Worker : la promesse est rejetée, et TOUS les Workers sont terminés.
  const jPanne = { lances: 0, termines: 0 };
  let erreur: unknown = null;
  try {
    await apparierRapideEnParallele(options(e, lanceurSimule(rng, jPanne, { apres: 2 })));
  } catch (x) {
    erreur = x;
  }
  ok(erreur instanceof Error && /panne/.test(erreur.message), 'panne d’un Worker : la promesse est rejetée avec son erreur');
  ok(jPanne.lances > 1 && jPanne.termines === jPanne.lances, `panne d’un Worker : les ${jPanne.lances} Workers sont terminés`);
  // Hors contrat numérique (traceur) : jamais de repli silencieux ici.
  let refus: unknown = null;
  try {
    await apparierRapideEnParallele(options(e, lanceurSimule(rng, { lances: 0, termines: 0 }), {
      prepared: { ...e.prepared, traceur: prepareSearch({ ...e.params, traceur: { runeIds: [1, 2, 3, 4, 5, 6] } })!.traceur },
    }));
  } catch (x) {
    refus = x;
  }
  ok(refus instanceof Error && /hors contrat/.test(refus.message), 'hors contrat numérique : refus nommé, l’appelant apparie en séquentiel');

  // Le corps d'un Worker court sur l'instant GLOBAL reçu, jamais sur sa propre préparation.
  const ctx = initialiserTravailleur({ params: { ...e.params, maxMs: 10 }, startedAt: Date.now() - 1000, compartiments: encoderCompartiments(e.prepared, e.bucketsA, e.bucketsB) });
  const plan = planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, e.total);
  ok(traiterMorceau(ctx, plan[0]).tronqueTemps, 'corps d’un Worker : le filet de temps court depuis l’instant global (startedAt reçu), construction comprise');
}

/** Les mêmes décisions sur de VRAIS `worker_threads`, par le lanceur Node du harnais. */
export async function testAppariementParalleleWorkers(): Promise<void> {
  titre('Appariement parallèle · vrais worker_threads (lanceur Node), contre le séquentiel');
  const liste = espaces().slice(0, 3);
  const lancer = lancerTravailleurNode(await assurerBundleAppariementRapide());
  for (const e of liste) {
    const r = await apparierRapideEnParallele(options(e, lancer));
    egal(etat(enResultatDeRecherche(r)), etat(e.reference), `${e.nom} : 3 worker_threads, ${r.morceaux} morceaux, résultat identique au séquentiel`);
    const refPetit = drain(apparier({ ...e.prepared, maxCollected: 5 }, e.bucketsA, e.bucketsB));
    const rPetit = await apparierRapideEnParallele(options(e, lancer, { params: { ...e.params, maxCollected: 5 }, prepared: { ...e.prepared, maxCollected: 5 } }));
    egal(etat(enResultatDeRecherche(rPetit)), etat(refPetit), `${e.nom} : maxCollected = 5, identique au séquentiel`);
    let arreter: (() => void) | null = null;
    const rArret = await apparierRapideEnParallele(options(e, lancer, {
      surControle: (c) => {
        arreter = c.arreter;
      },
      surProgression: () => arreter?.(),
    }));
    ok(rArret.truncated && estPrefixe(rArret.candidates, e.reference.candidates), `${e.nom} : arrêt manuel → ${rArret.candidates.length} candidats gardés, préfixe du séquentiel`);
  }
}

/**
 * Le branchement, côté Node : le harnais, qui orchestre les fonctions de
 * production comme le Worker de l'écran, choisit le parallèle au-delà du
 * seuil, sur le nombre de Workers de la règle pour cette machine, et rend
 * alors EXACTEMENT ce que rend le séquentiel forcé (profil `quota-parallele`,
 * tronqué par le plafond : l'exception déclarée du plafond global). Le Worker
 * de l'écran et sa coquille ne s'exécutent qu'au navigateur.
 */
export async function testAppariementParalleleBranchement(): Promise<void> {
  titre('Appariement parallèle · branchement : le harnais apparie en parallèle comme la production');
  const profil = trouverProfil('quota-parallele');
  const prod = await executerHarnais(configDuProfil(profil));
  const seq = await executerHarnais(configDuProfil(profil, { overrides: { regime: 'sequentiel' } }));
  const n = nombreDeTravailleurs(availableParallelism());
  ok(prod.regime?.applique === 'parallele' && !prod.regime.force && prod.regime.explication.includes(`${n} Workers`),
    `régime de production : parallèle, ${n} Workers (nombreDeTravailleurs de cette machine), non forcé`);
  egal(seq.regime?.applique, 'sequentiel', 'bras témoin : séquentiel forcé');
  ok(prod.completude?.motif === 'maxCollected' && seq.completude?.motif === 'maxCollected', 'les deux bras s’arrêtent au plafond GLOBAL de candidats');
  egal(prod.brut?.explored, seq.brut?.explored, `mêmes paires traitées (${prod.brut?.explored})`);
  egal(JSON.stringify(prod.brut?.candidates), JSON.stringify(seq.brut?.candidates),
    `mêmes ${prod.brut?.candidates.length} candidats, dans le même ordre : le parallèle rend l’ordre séquentiel`);
}

export async function testAppariementParallele(): Promise<void> {
  testRegles();
  await testCoordination(espaces());
}
