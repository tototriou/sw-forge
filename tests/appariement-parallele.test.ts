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
// troncature par le temps ou par l'arrêt manuel : une sous-suite du
// séquentiel non tronqué, préfixe exact jusqu'au premier morceau coupé.

import { availableParallelism } from 'node:os';
import { BaseStats } from '../src/types';
import { executerHarnais } from '../scripts/lib/diagnosticHarness';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import {
  Bucket, BuildCandidate, BuildRequirement, CHECKPOINT_EVERY, PreparedSearch, SearchParams, SearchResult, pairBuckets, prepareSearch, totalPairCount,
} from '../src/lib/runeBuildOptim';
import { apparier, construireMoitie } from '../src/lib/rechercheRunes';
import {
  ContexteTravailleur, InitTravailleur, Morceau, ResultatMorceau, apparierRapide, comboAOuvert, encoderCompartiments, initialiserTravailleur,
  ordreDesCompartiments, paireDeCompartimentsOuverte, parcourirMorceau, traiterMorceau,
} from '../src/lib/appariementRapide';
import { MessageVersTravailleur, resultatVide, servirAppariement } from '../src/lib/travailleurAppariement';
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
const compteursDe = (r: { traitees: number; visitees: number; sautees: number }) => ({ traitees: r.traitees, visitees: r.visitees, sautees: r.sautees });

/** Ce que chaque morceau a rendu, relevé au passage sans rien changer : son issue et son nombre de candidats. */
type RecusParMorceau = Map<number, { issue: ResultatMorceau['issue']; candidats: number }>;
function espionner(lancer: LancerTravailleur, recus: RecusParMorceau): LancerTravailleur {
  return (init, transfert) => {
    const p = lancer(init, transfert);
    return {
      ...p,
      surMessage: (rappel) => p.surMessage((r) => {
        recus.set(r.id, { issue: r.issue, candidats: r.candidats.length });
        rappel(r);
      }),
    };
  };
}

/**
 * Le résultat d'une recherche coupée (temps, arrêt manuel), contre le
 * séquentiel NON tronqué : une sous-suite de ses candidats, qui en est le
 * préfixe exact jusqu'au premier morceau coupé, celui-ci compris
 * (`prefixe` : sa longueur, lue sur les morceaux reçus, dans l'ordre).
 */
function sousSuiteCoupee(candidats: readonly BuildCandidate[], recus: RecusParMorceau, reference: readonly BuildCandidate[]) {
  let prefixe = 0;
  for (let id = 0; recus.has(id); id++) {
    const r = recus.get(id)!;
    prefixe += r.candidats;
    if (r.issue !== 'complet') break;
  }
  prefixe = Math.min(prefixe, candidats.length);
  let j = 0;
  for (const c of candidats) {
    while (j < reference.length && cle(reference[j]) !== cle(c)) j++;
    if (j === reference.length) return { sousSuite: false, prefixe, prefixeExact: false };
    j++;
  }
  return { sousSuite: true, prefixe, prefixeExact: estPrefixe(candidats.slice(0, prefixe), reference) };
}

/** Les paires visitées par le noyau séquentiel avant le point de passage `N` (multiple de `CHECKPOINT_EVERY`). */
function visitesAuPoint(e: Espace, N: number): number {
  let n = 0;
  const gen = apparierRapide(e.prepared, e.bucketsA, e.bucketsB, { observateur: { visite: () => { n++; } } });
  for (let step = gen.next(); !step.done; step = gen.next()) if (step.value.explored >= N) return n;
  return n;
}

/**
 * Workers simulés dans le processus, par le serveur de production
 * (`servirAppariement`) : messages livrés dans l'ordre, chacun après un délai
 * tiré, résultats rendus dans le désordre ; chaque poignée note sa fin.
 */
function lanceurSimule(rng: () => number, journal: { lances: number; termines: number }, panne?: { apres: number }): LancerTravailleur {
  let envois = 0;
  return (init: InitTravailleur) => {
    journal.lances++;
    let rappel: (r: ResultatMorceau) => void = () => {};
    let surErreur: (e: unknown) => void = () => {};
    const delai = () => new Promise<void>((resolve) => setTimeout(resolve, Math.floor(rng() * 4)));
    const serveur = servirAppariement((r) => {
      const copie = structuredClone(r);
      void delai().then(() => rappel(copie));
    });
    let file = Promise.resolve();
    const livrer = (message: MessageVersTravailleur) => {
      const copie = structuredClone(message);
      file = file.then(delai).then(() => {
        serveur.recevoir(copie).catch((e) => surErreur(e));
      });
    };
    livrer({ type: 'init', init });
    return {
      envoyer: (m: Morceau) => {
        if (panne != null && ++envois > panne.apres) {
          setTimeout(() => surErreur(new Error('Worker en panne')), 1);
          return;
        }
        livrer(m);
      },
      surMessage: (r) => {
        rappel = r;
      },
      surErreur: (r) => {
        surErreur = r;
      },
      arreter: () => livrer({ type: 'arret' }),
      terminer: () => {
        journal.termines++;
      },
    };
  };
}

/**
 * Un Worker (un seul, deux morceaux en vol : tout le plan d'un espace coupé
 * en deux) qui rend le résultat de chaque morceau par `traiter` (le vrai
 * corps, retouché ou coupé), les deux ensemble et dans l'ordre demandé.
 */
function lanceurScenarise(ordre: 'direct' | 'inverse', traiter: (ctx: ContexteTravailleur, m: Morceau) => ResultatMorceau): LancerTravailleur {
  return (init: InitTravailleur) => {
    const ctx = initialiserTravailleur(structuredClone(init));
    let rappel: (r: ResultatMorceau) => void = () => {};
    const recus: Morceau[] = [];
    return {
      envoyer: (m: Morceau) => {
        recus.push(structuredClone(m));
        if (recus.length < 2) return;
        const lot = ordre === 'direct' ? recus.splice(0) : recus.splice(0).reverse();
        setTimeout(() => {
          for (const morceau of lot) rappel(traiter(ctx, morceau));
        }, 1);
      },
      surMessage: (r) => {
        rappel = r;
      },
      surErreur: () => {},
      arreter: () => {},
      terminer: () => {},
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
    const seq = drain(apparierRapide(e.prepared, e.bucketsA, e.bucketsB));
    egal(compteursDe(r), compteursDe(seq), `${e.nom} : traitées, visitées, sautées = celles du noyau séquentiel`);

    // Plafond GLOBAL, dans l'ordre séquentiel.
    const petit = 3;
    const refPetit = drain(apparier({ ...e.prepared, maxCollected: petit }, e.bucketsA, e.bucketsB));
    const rPetit = await apparierRapideEnParallele(options(e, lanceurSimule(rng, { lances: 0, termines: 0 }), {
      params: { ...e.params, maxCollected: petit }, prepared: { ...e.prepared, maxCollected: petit },
    }));
    egal(etat(enResultatDeRecherche(rPetit)), etat(refPetit), `${e.nom} : maxCollected = ${petit}, les ${petit} premiers de l'ordre séquentiel (aucune part par Worker)`);
    egal(rPetit.motif, 'maxCollected', `${e.nom} : motif maxCollected`);
    egal(compteursDe(rPetit), compteursDe(drain(apparierRapide({ ...e.prepared, maxCollected: petit }, e.bucketsA, e.bucketsB))),
      `${e.nom} : maxCollected = ${petit}, visitées et sautées coupées au même candidat que les traitées (= noyau séquentiel)`);

    // Arrêt déterministe : le préfixe des paires avant le point de passage N.
    const N = CHECKPOINT_EVERY * Math.floor(e.total / 2 / CHECKPOINT_EVERY);
    if (N > 0) {
      const rN = await apparierRapideEnParallele(options(e, lanceurSimule(rng, { lances: 0, termines: 0 }), { arretTraitees: N }));
      egal(compteursDe(rN), { traitees: N, visitees: visitesAuPoint(e, N), sautees: N - visitesAuPoint(e, N) },
        `${e.nom} : arrêt déterministe à ${N}, visitées = celles du séquentiel avant ce point, sautées ≥ 0`);
    }

    // Arrêt manuel coopératif, après le premier morceau reçu.
    const jArret = { lances: 0, termines: 0 };
    let arreter: (() => void) | null = null;
    let derniere = -1;
    const recusArret: RecusParMorceau = new Map();
    const rArret = await apparierRapideEnParallele(options(e, espionner(lanceurSimule(rng, jArret), recusArret), {
      surControle: (c) => {
        arreter = c.arreter;
      },
      surProgression: (traitees) => {
        derniere = traitees;
        arreter?.();
      },
    }));
    ok(rArret.truncated && rArret.motif === 'manuel' && rArret.explored < e.total, `${e.nom} : arrêt manuel → tronqué, motif manuel, ${rArret.explored} / ${e.total} paires`);
    const vArret = sousSuiteCoupee(rArret.candidates, recusArret, e.reference.candidates);
    ok(vArret.sousSuite && vArret.prefixeExact,
      `${e.nom} : arrêt manuel → ce qui a été trouvé (${rArret.candidates.length} candidats), une sous-suite du séquentiel, préfixe exact jusqu'au premier morceau coupé (${vArret.prefixe})`);
    ok(derniere === rArret.explored && rArret.sautees >= 0, `${e.nom} : arrêt manuel → la dernière progression compte ce que compte le résultat (${derniere}), sautées ≥ 0`);
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
  egal(traiterMorceau(ctx, plan[0]).issue, 'temps', 'corps d’un Worker : le filet de temps court depuis l’instant global (startedAt reçu), construction comprise');
}

/**
 * Le filet de temps expire pendant un morceau : les morceaux qui le suivent,
 * déjà partis, se fusionnent encore (l'arrêt garde tout ce qui a été trouvé),
 * dans quelque ordre qu'ils reviennent, et la progression compte ce que compte
 * le résultat. De même sous l'arrêt manuel.
 */
async function testTroncatureFusion(liste: Espace[]): Promise<void> {
  titre('Appariement parallèle · un morceau tronqué n’empêche pas la fusion des suivants');
  let trouve = false;
  for (const e of liste) {
    const cible = Math.ceil(e.total / 2);
    const plan = planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, cible);
    if (plan.length !== 2) continue;
    const ctx = initialiserTravailleur({ params: e.params, startedAt: Date.now(), compartiments: encoderCompartiments(e.prepared, e.bucketsA, e.bucketsB) });
    const vrais = plan.map((m) => traiterMorceau(ctx, m));
    if (vrais.some((v) => v.candidats.length === 0)) continue;
    trouve = true;
    const attendus = [...vrais[0].candidats, ...vrais[1].candidats].map(cle);
    for (const ordre of ['direct', 'inverse'] as const) {
      for (const sorte of ['temps', 'manuel'] as const) {
        let arreter: (() => void) | null = null;
        let derniere: { traitees: number; n: number } | null = null;
        const r = await apparierRapideEnParallele(options(e, lanceurScenarise(ordre, (c, m) => {
          const v = traiterMorceau(c, m);
          if (v.id !== 0) return v;
          if (sorte === 'manuel') arreter?.();
          return { ...v, issue: sorte === 'temps' ? 'temps' : 'arret' };
        }), {
          travailleurs: 1, cibleMorceau: cible,
          surControle: (c) => {
            arreter = c.arreter;
          },
          surProgression: (traitees, candidats) => {
            derniere = { traitees, n: candidats.length };
          },
        }));
        egal(r.candidates.map(cle), attendus,
          `${e.nom}, ${sorte === 'temps' ? 'filet de temps' : 'arrêt manuel'} au premier morceau, rendus en ordre ${ordre} : les candidats des deux morceaux (${vrais[0].candidats.length} + ${vrais[1].candidats.length})`);
        ok(r.truncated && r.motif === (sorte === 'temps' ? 'maxMs' : 'manuel') && r.explored === vrais[0].traitees + vrais[1].traitees,
          `${e.nom}, ${sorte}, ${ordre} : tronqué (motif ${r.motif}), ${r.explored} paires = celles des deux morceaux`);
        egal(derniere, { traitees: r.explored, n: r.candidates.length }, `${e.nom}, ${sorte}, ${ordre} : la dernière progression compte ce que compte le résultat`);
      }
    }
    break;
  }
  ok(trouve, 'un espace dont le plan en deux morceaux porte des candidats dans chacun');
}

/** Le corps d'un morceau, arrêté manuellement après sa première ligne (`next(true)` au premier rendu de main). */
function coupeApresPremiereLigne(ctx: ContexteTravailleur, m: Morceau): ResultatMorceau {
  const gen = parcourirMorceau(ctx, m);
  let step = gen.next(false);
  if (!step.done) step = gen.next(true);
  if (!step.done) throw new Error('le corps devait rendre son résultat sur l’arrêt');
  return step.value;
}

/**
 * Un morceau RÉELLEMENT coupé avant un morceau suivant achevé (arrêt reçu par
 * le premier après sa première ligne, quand le second avait déjà fini) : le
 * parallèle garde les candidats des deux, si bien que son résultat n'est PAS
 * un préfixe du séquentiel — une sous-suite, préfixe exact jusqu'au morceau
 * coupé, et rien de ce qui a été parcouru n'est perdu.
 */
async function testCoupeReelle(liste: Espace[]): Promise<void> {
  titre('Appariement parallèle · arrêt manuel : un morceau coupé avant un morceau suivant achevé');
  let trouve = false;
  for (const e of liste) {
    const cible = Math.ceil(e.total / 2);
    const plan = planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, cible);
    if (plan.length !== 2) continue;
    const ctx = initialiserTravailleur({ params: e.params, startedAt: Date.now(), compartiments: encoderCompartiments(e.prepared, e.bucketsA, e.bucketsB) });
    const coupe0 = coupeApresPremiereLigne(ctx, plan[0]);
    const complet0 = traiterMorceau(ctx, plan[0]);
    const complet1 = traiterMorceau(ctx, plan[1]);
    // Un écart n'est visible que si le morceau 0 perd des candidats après sa première ligne, et que le 1 en porte.
    if (coupe0.issue !== 'arret' || coupe0.candidats.length >= complet0.candidats.length || complet1.candidats.length === 0) continue;
    trouve = true;
    for (const ordre of ['direct', 'inverse'] as const) {
      let arreter: (() => void) | null = null;
      const recus: RecusParMorceau = new Map();
      const r = await apparierRapideEnParallele(options(e, espionner(lanceurScenarise(ordre, (c, m) => {
        if (m.id !== 0) return traiterMorceau(c, m);
        arreter?.();
        return coupeApresPremiereLigne(c, m);
      }), recus), {
        travailleurs: 1, cibleMorceau: cible,
        surControle: (c) => {
          arreter = c.arreter;
        },
      }));
      const n0 = coupe0.candidats.length;
      egal(r.candidates.map(cle), [...coupe0.candidats, ...complet1.candidats].map(cle),
        `${e.nom}, ordre ${ordre} : morceau 0 coupé après sa première ligne (${n0} / ${complet0.candidats.length} candidats), morceau 1 achevé (${complet1.candidats.length}) : les deux sont gardés`);
      ok(r.truncated && r.motif === 'manuel' && r.explored === coupe0.traitees + complet1.traitees && r.explored < e.total,
        `${e.nom}, ordre ${ordre} : tronqué (motif ${r.motif}), ${r.explored} paires = celles parcourues dans les deux morceaux`);
      const v = sousSuiteCoupee(r.candidates, recus, e.reference.candidates);
      ok(v.sousSuite && v.prefixeExact && v.prefixe === n0,
        `${e.nom}, ordre ${ordre} : une sous-suite du séquentiel, préfixe exact jusqu'au morceau coupé (${v.prefixe} candidats)`);
      ok(!estPrefixe(r.candidates, e.reference.candidates) && cle(r.candidates[n0]) !== cle(e.reference.candidates[n0]),
        `${e.nom}, ordre ${ordre} : PAS un préfixe du séquentiel — écart dès le rang ${n0 + 1}`);
    }
    break;
  }
  ok(trouve, 'un espace dont le morceau 0 perd des candidats après sa première ligne et dont le morceau 1 en porte');
}

/**
 * Le temps se teste aux points de passage franchis par une ligne ENTIÈREMENT
 * sautée : horloge simulée qui expire pendant le saut. Puis l'arrêt manuel
 * reçu par le serveur d'un Worker entre deux tranches : le morceau en cours
 * rend ce qu'il a trouvé, celui qui attend rend aussitôt un résultat vide.
 */
async function testCadenceTemps(liste: Espace[]): Promise<void> {
  titre('Appariement parallèle · cadence du temps et de l’arrêt dans un Worker');
  let ligne: { e: Espace; iA: number; a: number; iB: number; nB: number } | null = null;
  for (const e of liste) {
    const visitees = new Set<string>();
    drain(apparierRapide(e.prepared, e.bucketsA, e.bucketsB, { observateur: { visite: (iA, a, iB) => visitees.add(`${iA},${a},${iB}`) } }));
    for (const [iA, iB] of ordreDesCompartiments(e.bucketsA, e.bucketsB)) {
      const bB = e.bucketsB[iB];
      if (ligne || bB.combos.length < 2 || !paireDeCompartimentsOuverte(e.prepared, e.bucketsA[iA], bB)) continue;
      const a = e.bucketsA[iA].combos.findIndex((comboA, k) => comboAOuvert(e.prepared, comboA, bB) && !visitees.has(`${iA},${k},${iB}`));
      if (a >= 0) ligne = { e, iA, a, iB, nB: bB.combos.length };
    }
    if (ligne) break;
  }
  ok(ligne != null, 'une ligne ouverte entièrement sautée (aucune paire visitée)');
  if (!ligne) return;
  const { e, iA, a, iB, nB } = ligne;
  // La ligne seule, placée juste avant un point de passage : le saut le franchit.
  const morceau = (): Morceau => ({
    type: 'morceau', id: 0, offset: CHECKPOINT_EVERY - 1, taille: nB, segments: Int32Array.of(iA, iB, a, a + 1), drapeaux: Uint8Array.of(1),
  });
  const T = Date.now();
  const ctx = initialiserTravailleur({ params: { ...e.params, maxMs: 1000 }, startedAt: T, compartiments: encoderCompartiments(e.prepared, e.bucketsA, e.bucketsB) });
  const vraiNow = Date.now;
  let appels = 0;
  // Horloge simulée : seul le test d'entrée de ligne voit le temps dans le budget.
  let expire = 1;
  let r: ResultatMorceau;
  try {
    Date.now = () => (appels++ < expire ? T : T + 5000);
    r = traiterMorceau(ctx, morceau());
    egal({ issue: r.issue, traitees: r.traitees, visitees: r.visitees }, { issue: 'temps', traitees: 1, visitees: 0 },
      `ligne de ${nB} paires sautées, le filet expire pendant le saut : tronqué au point de passage ${CHECKPOINT_EVERY} (1 paire traitée, pas ${nB})`);
    appels = 0;
    expire = Infinity;
    r = traiterMorceau(ctx, morceau());
    ok(r.issue === 'complet' && r.traitees === nB && appels >= 2,
      `sans expiration : ligne achevée, et le point de passage franchi pendant le saut a testé le temps (${appels} lectures de l’horloge)`);
  } finally {
    Date.now = vraiNow;
  }

  // Le serveur d'un Worker : chaque ligne dépasse la tranche, il rend la main après chacune.
  let t = 0;
  const rendus: ResultatMorceau[] = [];
  const serveur = servirAppariement((v) => rendus.push(v), { maintenant: () => (t += 1000), ceder: () => Promise.resolve() });
  await serveur.recevoir({ type: 'init', init: { params: e.params, startedAt: Date.now(), compartiments: encoderCompartiments(e.prepared, e.bucketsA, e.bucketsB) } });
  const [m0] = planifierMorceaux(e.prepared, e.bucketsA, e.bucketsB, e.total);
  const m1: Morceau = { ...m0, id: 1 };
  const p0 = serveur.recevoir(m0);
  const p1 = serveur.recevoir(m1);
  await serveur.recevoir({ type: 'arret' });
  await Promise.all([p0, p1]);
  ok(rendus.length === 2 && rendus[0].id === 0 && rendus[0].issue === 'arret' && rendus[0].traitees > 0 && rendus[0].traitees < m0.taille,
    `arrêt reçu entre deux tranches : le morceau en cours s’arrête à la ligne suivante (${rendus[0]?.traitees} / ${m0.taille} paires)`);
  ok(estPrefixe(rendus[0].candidats, e.reference.candidates), 'ce qu’il a trouvé est un préfixe du séquentiel');
  egal(rendus[1], resultatVide(m1, rendus[0].validationTypee), 'le morceau qui attendait est rendu vide, sans calcul');
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
    const recus: RecusParMorceau = new Map();
    const rArret = await apparierRapideEnParallele(options(e, espionner(lancer, recus), {
      surControle: (c) => {
        arreter = c.arreter;
      },
      surProgression: () => arreter?.(),
    }));
    const v = sousSuiteCoupee(rArret.candidates, recus, e.reference.candidates);
    ok(rArret.truncated && v.sousSuite && v.prefixeExact,
      `${e.nom} : arrêt manuel → ${rArret.candidates.length} candidats gardés, sous-suite du séquentiel, préfixe exact jusqu'au premier morceau coupé (${v.prefixe})`);
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
  const liste = espaces();
  await testCoordination(liste);
  await testTroncatureFusion(liste);
  await testCoupeReelle(liste);
  await testCadenceTemps(liste);
}
