// Le harnais de diagnostic — la partie DÉTERMINISTE et rapide, celle qui a
// sa place dans `npm test` : résolution de configuration, paliers, points
// d'arrêt, suivi d'une rune, déduction du motif de troncature.
//
// ⚠️ **Ce qui est volontairement DEHORS** : tout ce qui exige un compte réel
// (gitignoré, absent des autres machines) ou une recherche complète de
// plusieurs minutes. Décision d'intégration hybride du cadrage (§12) — la
// suite entière doit rester sous la barre des quelques dizaines de secondes.
//
// ⚠️ Le harnais est de l'OUTILLAGE : `algo-verify` ne s'y applique pas. Ce
// qui est vérifié ici, ce n'est pas la justesse d'un algorithme (le moteur a
// ses propres tests différentiels) mais le fait que le harnais rapporte
// FIDÈLEMENT ce que le moteur a fait — l'inverse serait un outil qui ment
// avec l'autorité d'un diagnostic.

import { egal, ok, titre } from './outils';
import { executerHarnais, evaluerCompletude, serie, suivrePiece } from '../scripts/lib/diagnosticHarness';
import { resoudreConfig } from '../scripts/lib/diagnosticConfig';
import { ConfigHarnais, EtagePopulation } from '../scripts/lib/diagnosticTypes';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { MAX_COLLECTED, SearchParams, SearchResult, bucketCapFor, combineParallelPairingResults } from '../src/lib/runeBuildOptim';

function configSynthetique(surcharges: Partial<ConfigHarnais> = {}): ConfigHarnais {
  return {
    source: {
      type: 'synthetique',
      seed: 4242,
      runesParEmplacement: 8,
      requirement: { sets: ['violent'], minStats: { spd: 120 } },
      slotFilterCap: 40,
    },
    ...surcharges,
  };
}

export default async function testDiagnosticHarness() {
  titre('Harnais de diagnostic — configuration, paliers et points d’arrêt');

  /* ── §4.4 règle 4 : aucun repli silencieux ─────────────────────────── */
  let leve = false;
  try {
    resoudreConfig({
      source: {
        type: 'synthetique',
        seed: 1,
        runesParEmplacement: 3,
        requirement: { sets: [], minStats: {} },
        // @ts-expect-error — on teste précisément l'absence de ce champ.
        slotFilterCap: undefined,
      },
    });
  } catch {
    leve = true;
  }
  ok(leve, 'mode synthétique sans slotFilterCap explicite : REFUSÉ, jamais un repli sur le défaut moteur');

  /* ── §4.3 piège A : la cascade est visible ─────────────────────────── */
  const sansOverride = resoudreConfig(configSynthetique());
  const bucketCap = sansOverride.parametres.find((p) => p.nom === 'bucketCap')!;
  egal(bucketCap.valeur, bucketCapFor(40), 'bucketCap suit slotFilterCap');
  egal(bucketCap.origine, 'dérivé', 'et son origine le DIT — « dérivé », pas une valeur venue de nulle part');
  egal(bucketCap.derivéDe, 'slotFilterCap', 'de quel paramètre il dérive est nommé');

  const capSurcharge = resoudreConfig(
    configSynthetique({ overrides: { slotFilterCap: 120 } })
  );
  egal(
    capSurcharge.parametres.find((p) => p.nom === 'bucketCap')!.valeur,
    bucketCapFor(120),
    'surcharger slotFilterCap déplace AUSSI bucketCap — deux paramètres bougent, un seul a été touché'
  );

  /* ── §6 : la table liste les paramètres EFFECTIFS, pas surchargeables ─
   *
   * ⚠️ Le §4.4 règle 2 dit « chaque paramètre EFFECTIF affiche son
   * origine » ; `resoudreConfig` implémentait « chaque paramètre
   * SURCHARGEABLE ». Un run lancé avec `adaptiveTrancheWeighting` sans le
   * savoir mesure une autre rétention, et l'aperçu n'en montrait rien. */
  const nomsParametres = sansOverride.parametres.map((p) => p.nom);
  for (const attendu of ['objective', 'adaptiveTrancheWeighting', 'metric', 'recherche exhaustive', 'pool (runes)']) {
    ok(nomsParametres.includes(attendu), `le paramètre EFFECTIF « ${attendu} » figure dans l’aperçu`);
  }
  ok(
    nomsParametres.some((n) => n.startsWith('stats d’objectif')),
    'les stats d’objectif aussi — le levier de rétention ×4 de filterSlot (24 gardées au lieu de 6)'
  );
  // ⚠️ `combosOrderMode` est toujours EFFECTIF (défaut « relevance »), il
  // n'était listé que lorsqu'il était surchargé.
  ok(nomsParametres.includes('combosOrderMode'), 'combosOrderMode est listé même sans override — il est toujours effectif');

  // ⚠️ **Ce n'est PAS une infidélité, c'est un angle mort de l'aperçu** :
  // la valeur appliquée EST celle de la production. Élargir la table ne doit
  // donc faire basculer aucun verdict de fidélité.
  ok(
    !sansOverride.fidelite.divergeDeLaProd,
    'élargir la table ne fait basculer AUCUN verdict : ces paramètres sont effectifs, pas surchargés'
  );

  /* ── §4.4 règle 3 : un run surchargé est MARQUÉ ────────────────────── */
  ok(!sansOverride.fidelite.divergeDeLaProd, 'sans override : la fidélité annonce « conforme à la production »');
  const surcharge = resoudreConfig(configSynthetique({ overrides: { bucketCap: 500 } }));
  ok(surcharge.fidelite.divergeDeLaProd, 'avec un override : la fidélité annonce « DIVERGE DE LA PROD »');
  ok(
    surcharge.fidelite.ecarts.some((e) => e.nom === 'bucketCap' && e.valeur === 500),
    'et l’écart nomme le paramètre, sa valeur ET celle de la prod'
  );
  // ⚠️ §3.4 — le mot « PLANCHER » a été RETIRÉ : c'était une affirmation de
  // DIRECTION, et la direction n'est pas établie (la taxe setTimeout(0) va
  // dans un seul sens, mais JIT, démarrage des workers et sérialisation ne
  // sont pas comptés). Le test le VERROUILLE plutôt que de le laisser
  // revenir à la prochaine réécriture de la note.
  ok(
    !surcharge.fidelite.noteNavigateur.includes('PLANCHER'),
    'la note de plateforme n’affirme plus une DIRECTION (« plancher pour le navigateur »)'
  );
  ok(
    surcharge.fidelite.noteNavigateur.includes('NON MESURÉ') &&
      surcharge.fidelite.noteNavigateur.includes('pas directement transposables'),
    'elle dit ce qu’elle est : un ordre de grandeur arithmétique, non mesuré, non transposable'
  );

  // ⚠️ §3.4 — la fidélité porte sur les paramètres SUIVIS, pas sur « la
  // production ». Ce que la comparaison ne prouve pas voyage avec elle.
  ok(
    sansOverride.fidelite.horsPerimetre.some((h) => h.includes('COMPOSITION du pool')) &&
      sansOverride.fidelite.horsPerimetre.some((h) => h.includes('ABSENT de la table')),
    'le périmètre de la preuve est rendu : ce que la comparaison des paramètres ne couvre pas'
  );

  /* ── §3 : les points d'arrêt ───────────────────────────────────────── */
  const arretDominance = await executerHarnais(configSynthetique({ arretApres: 'dominance' }));
  egal(
    arretDominance.preparation.map((t) => t.etage),
    ['mainstat', 'dominance', 'feasibility', 'filterslot'],
    'les 4 étages sont OBSERVÉS (ils s’exécutent d’un bloc, pour ~2 s au total)'
  );
  ok(arretDominance.demiBuilds == null, 'arrêt à un étage de préparation : AUCUN demi-build construit');
  ok(arretDominance.completude == null, 'arrêt à un étage de préparation : aucun verdict de complétude');

  const arretDemiBuilds = await executerHarnais(configSynthetique({ arretApres: 'demi-builds' }));
  ok(arretDemiBuilds.demiBuilds != null, 'arrêt après les demi-builds : les deux moitiés sont là');

  /* ── §4.1 : le taux de rétention de la CONSTRUCTION (A₁) ───────────── */
  {
    const ret = arretDemiBuilds.demiBuilds!.retention;
    const tailles = arretDemiBuilds.preparation.find((t) => t.etage === 'filterslot')!.parEmplacement;
    // ⚠️ Le produit brut doit venir du pool RÉELLEMENT passé à buildBuckets
    // — `onStage('filterslot')` reçoit le tableau qui devient
    // `prepared.filtered`, et les fils reçoivent les slots [0,1,2]/[3,4,5].
    egal(ret.A.produitBrut, tailles[0] * tailles[1] * tailles[2], 'produit brut A = |f₀|×|f₁|×|f₂| du pool qui entre dans buildBuckets');
    egal(ret.B.produitBrut, tailles[3] * tailles[4] * tailles[5], 'produit brut B = |f₃|×|f₄|×|f₅|, l’autre moitié');
    egal(ret.A.retenus, arretDemiBuilds.demiBuilds!.combosA, 'les retenus sont les demi-builds déjà rendus, jamais recomptés');
    ok(ret.A.taux > 0 && ret.A.taux <= 1, 'le taux est un ratio des deux nombres déjà rendus');
    ok(
      ret.A.retenus <= ret.A.produitBrut,
      'le produit brut est bien un MAJORANT : on ne retient jamais plus de triplets qu’il n’en existe'
    );

    // ⚠️ **La règle d'interprétation du §4.4 doit être IMPRIMÉE avec le
    // résultat**, pas seulement écrite dans la spec — sinon un taux voyage
    // seul et autorise la causalité fausse qu'il ne démontre pas.
    ok(
      ret.regleInterpretation.includes('NE PROUVE PAS QUE LA RÉTENTION EXPLIQUE LE TEMPS') &&
        ret.regleInterpretation.includes('MAJORANT'),
      'la règle d’interprétation voyage AVEC le taux : corrélation ≠ causalité, et le produit brut est un majorant'
    );
    // ⚠️ Vocabulaire IMPOSÉ : ces deux mots suggèrent un jugement que le
    // nombre ne porte pas. Le test les interdit plutôt que de compter sur
    // la relecture.
    ok(
      !/rendement|efficacité/i.test(ret.regleInterpretation.replace(/« rendement »|« efficacité »/g, '')),
      'ni « rendement » ni « efficacité » ne servent à NOMMER ce taux (seulement à les écarter explicitement)'
    );
  }

  /* ── §4.1 bis : le pic de tas par moitié (A₁ bis, palier LÉGER) ─────
   *
   * ⚠️ La TROISIÈME hypothèse de l'asymétrie A/B — A alloue peut-être
   * davantage et paie plus de ramassage de miettes. Elle manquait aux deux
   * premières rédactions du cadrage : « deux hypothèses » n'était pas une
   * énumération close, mais celles auxquelles on avait pensé. */
  {
    const mem = arretDemiBuilds.demiBuilds!.memoire;
    ok(mem.A.heapUsed > 0 && mem.B.heapUsed > 0, 'chaque moitié rend son relevé mémoire de fin de fil');
    ok(
      mem.A.heapTotal >= mem.A.heapUsed && mem.B.heapTotal >= mem.B.heapUsed,
      'heapTotal englobe heapUsed — le relevé vient bien de process.memoryUsage()'
    );
    // ⚠️ Le caveat est de la même classe que la note de plateforme sur les
    // temps : un chiffre de mémoire détaché de cette phrase se relit comme
    // une prédiction de ce que vit l'utilisateur, ce qu'il n'est pas.
    ok(
      mem.caveat.includes('N’EST PAS celui du navigateur') && mem.caveat.includes('DANS LE MÊME PROCESSUS'),
      'le caveat voyage AVEC la mesure : valable pour comparer A à B ici, jamais comme prédiction navigateur'
    );
    ok(
      mem.caveat.includes('PerformanceObserver'),
      'et il dit pourquoi le palier COMPLET reste écarté — son coût s’insère dans la phase qu’il mesurerait'
    );
  }
  /* ── §4.2 : la cartographie de l'ÉLAGAGE (A₂, A-INSTRUMENTÉ) ────────
   *
   * ⚠️ A₂ est le SEUL instrument du harnais qui se paie : il associe un
   * horodatage à des événements que la production émet déjà. D'où le
   * caractère OPT-IN, vérifié en premier — le worker de construction est
   * PARTAGÉ avec `perf-battery.ts`, l'outil de mesure de référence. */
  {
    ok(
      arretDemiBuilds.demiBuilds!.progression == null,
      'A₂ est OPT-IN : sans le demander, AUCUN horodatage — perf-battery.ts partage ce worker'
    );

    const avecA2 = await executerHarnais(configSynthetique({ arretApres: 'demi-builds', horodaterProgression: true }));
    const prog = avecA2.demiBuilds!.progression!;
    ok(prog != null, 'demandé, A₂ rend la progression des deux moitiés');

    for (const [moitie, m] of [['A', prog.A], ['B', prog.B]] as const) {
      const d = m.distribution;
      // ⚠️ La série homogène compte UN intervalle de moins qu'il n'y a de
      // runes extérieures : le prologue et le dernier `next()` (dernière
      // rune + épilogue) sont sortis de la série, jamais versés dedans.
      egal(
        d.n,
        Math.max(0, m.runesExterieures - 1),
        `moitié ${moitie} : la série homogène exclut le prologue ET l’intervalle « dernière rune + épilogue »`
      );
      ok(
        d.minMs <= d.medianeMs && d.medianeMs <= d.p90Ms && d.p90Ms <= d.maxMs,
        `moitié ${moitie} : la DISTRIBUTION est rendue entière et ordonnée (min ≤ médiane ≤ p90 ≤ max)`
      );
      // ⚠️ L'histogramme n'est pas décoratif : une série BIMODALE ne se voit
      // dans aucun jeu de quantiles, et c'est elle qui dit *où* l'élagage
      // coupe. Il doit donc contenir TOUTE la série, sans perte.
      egal(
        d.histogramme.reduce((s, c) => s + c.effectif, 0),
        d.n,
        `moitié ${moitie} : l’histogramme porte toute la série — c’est la FORME qui porte l’information`
      );
    }

    // ⚠️ Le diviseur vient du MÊME tableau `filtered` que le taux de
    // rétention, donc du pool réellement entré dans `buildBuckets` :
    // `buildBuckets` boucle sur `slotIdxs[0]` et parcourt [1] et [2].
    const tailles = avecA2.preparation.find((t) => t.etage === 'filterslot')!.parEmplacement;
    egal(prog.A.divisionParPairesInterieures.diviseur, tailles[1] * tailles[2], 'le diviseur de A est |f₁|×|f₂|, les emplacements INTÉRIEURS');
    egal(prog.B.divisionParPairesInterieures.diviseur, tailles[4] * tailles[5], 'le diviseur de B est |f₄|×|f₅|, l’autre moitié');

    /* ⚠️ **Le cœur d'A₂ : ce qu'il N'EST PAS doit finir DANS LA SORTIE.**
     * L'instrument a été conservé (option b) alors qu'il ne répond pas à la
     * question qui l'avait fait proposer. Sans cette phrase, un temps élevé
     * côté A se lit « A est plus lent » — conclusion que ces chiffres
     * n'autorisent pas. */
    ok(
      prog.avertissementPortee.includes('NE DÉPARTAGE PAS L’ASYMÉTRIE A/B') &&
        prog.avertissementPortee.includes('MÉLANGE'),
      'A₂ dit lui-même qu’il ne départage PAS l’asymétrie A/B, et pourquoi : le temps par rune MÉLANGE vitesse et élagage'
    );
    ok(
      prog.avertissementPortee.includes('OÙ `buildBuckets` coupe'),
      'et il dit pour quoi il est là : cartographier l’ÉLAGAGE — une information sur la topologie du pool'
    );
    // ⚠️ Le PÉRIMÈTRE DE L'HORLOGE voyage avec la mesure, sans quoi ces
    // intervalles se relisent comme « le temps passé dans buildBuckets ».
    ok(
      prog.perimetreHorloge.includes('suspension et la reprise du générateur') &&
        prog.perimetreHorloge.includes('n’est donc pas « le temps passé dans buildBuckets »'),
      'le périmètre de l’horloge est imprimé AVEC la mesure : elle inclut la suspension/reprise du générateur'
    );
    ok(
      prog.perimetreHorloge.includes('PROLOGUE') && prog.perimetreHorloge.includes('épilogue'),
      'et il nomme les trois périmètres séparés, pour qu’aucun ne soit relu comme les autres'
    );
    /* ⚠️ **A₂ est AUTO-VÉRIFIANT** : son coût ne s'argumente pas, il se
     * mesure — et le chiffre voyage AVEC la fonctionnalité. Le test verrouille
     * les deux moitiés du résultat : le différentiel (qui ne conclut rien,
     * sept écarts sur quatorze étant NÉGATIFS, donc sous le plancher de
     * bruit) ET la borne arithmétique (qui, elle, tranche). */
    ok(
      prog.coutInstrumentation.includes('MESURÉ') && prog.coutInstrumentation.includes('plancher de bruit'),
      'le COÛT de l’instrumentation voyage avec elle, mesuré — A₂ est le seul instrument du harnais qui se paie'
    );
    ok(
      prog.coutInstrumentation.includes('ARITHMÉTIQUE') && prog.coutInstrumentation.includes('47 ns'),
      'et « invisible sous le bruit » ne passe pas pour « nul » : la borne arithmétique est donnée avec son coût unitaire'
    );

    // ⚠️ Vocabulaire IMPOSÉ, verrouillé comme celui du taux de rétention :
    // « temps par triplet énumérable » ne doit servir qu'à être ÉCARTÉ.
    // Le compteur d'A₂ ne mesure AUCUNE itération interne.
    const libelle = prog.A.divisionParPairesInterieures.libelle;
    ok(
      libelle.includes('DIVISION ARITHMÉTIQUE') && libelle.includes('PAS un temps par triplet énumérable'),
      'la normalisation par |f₁|×|f₂| est présentée comme une DIVISION, jamais comme un temps par triplet énumérable'
    );
    ok(
      !/temps par triplet énumérable/.test(libelle.replace(/PAS un temps par triplet énumérable/g, '')),
      'et cette expression ne sert JAMAIS à nommer la valeur — seulement à l’écarter'
    );
  }

  ok(arretDemiBuilds.regime != null, 'et le régime est déjà connu — il dépend de totalPairs, donc de la phase B');
  ok(arretDemiBuilds.completude == null, 'mais aucun appariement n’a eu lieu');

  const complet = await executerHarnais(configSynthetique());
  ok(complet.completude != null, 'run complet : la complétude est rendue');
  ok(complet.meilleurs != null, 'run complet : les candidats sont CLASSÉS (jamais candidates[0] brut)');

  /* ── §7.0 : le régime miroite la production ────────────────────────── */
  egal(
    complet.regime!.applique,
    complet.regime!.totalPairs >= complet.regime!.seuil ? 'parallele' : 'sequentiel',
    'le régime appliqué est celui que la production choisirait pour ce totalPairs'
  );
  ok(!complet.regime!.force, 'et il n’est pas « forcé » : le harnais ne choisit pas, il reproduit');
  ok(
    complet.regime!.explication.includes('comme la production'),
    'l’explication dit explicitement que c’est le comportement de production'
  );

  /* ── §6.2 : jamais un « 0 candidat » nu ────────────────────────────── */
  const c = complet.completude!;
  ok(c.complet ? c.motif == null : c.motif === 'maxMs' || c.motif === 'maxCollected', 'la complétude porte un motif, et seulement DEUX sont possibles');
  ok(
    !c.complet || c.explored === c.totalPairs || c.incoherence != null,
    'un run annoncé complet dont explored < totalPairs est SIGNALÉ, jamais laissé à déduire'
  );

  // Le motif se déduit sans toucher au moteur — règle prouvée dans
  // `combineParallelPairingResults` : le temps est testé AVANT le push, le
  // quota APRÈS.
  const paramsFictifs = { maxCollected: 100 } as SearchParams;
  const parQuota: SearchResult = { candidates: new Array(100).fill({ runeIds: [], stats: [], effTotal: 0 }), explored: 500, truncated: true, nearMissByCondition: [], globalNearMiss: null };
  const parTemps: SearchResult = { candidates: new Array(37).fill({ runeIds: [], stats: [], effTotal: 0 }), explored: 500, truncated: true, nearMissByCondition: [], globalNearMiss: null };
  egal(evaluerCompletude(parQuota, 1000, paramsFictifs).motif, 'maxCollected', 'plafond de candidats ATTEINT ⇒ motif maxCollected');
  egal(evaluerCompletude(parTemps, 1000, paramsFictifs).motif, 'maxMs', 'plafond NON atteint alors que tronqué ⇒ motif maxMs (le temps)');
  // ⚠️ **Régression §3.3** — le harnais rendait `complet: true` EN MÊME
  // TEMPS qu'une `incoherence` : « la recherche est complète » et « elle n'a
  // pas exploré tout l'espace » dans le même objet. Un lecteur JSON qui
  // teste `complet` était trompé. Le verdict PUBLIC doit basculer, pas
  // seulement porter une note.
  const completSansTout: SearchResult = { candidates: [], explored: 900, truncated: false, nearMissByCondition: [], globalNearMiss: null };
  const incoherent = evaluerCompletude(completSansTout, 1000, paramsFictifs);
  ok(incoherent.incoherence != null, 'annoncé complet mais 900 < 1000 paires : l’incohérence est dite');
  ok(!incoherent.complet, 'et le VERDICT PUBLIC bascule : jamais `complet: true` en même temps qu’une incohérence');
  egal(
    incoherent.motif,
    undefined,
    'sans motif FABRIQUÉ : `truncated` est faux, donc la déduction quota/temps ne s’applique pas — on ne sait pas pourquoi'
  );

  /* ── §3.5 : le quota LOCAL d'un worker n'est pas une troncature ─────
   *
   * ⚠️ **Ce cas verrouille une réfutation que DEUX revues externes
   * consécutives ont attaquée, par deux raisonnements différents** (§9.2 et
   * §9.3 de harnais-diagnostic-extensions.md) : « le motif de troncature
   * serait faux en régime parallèle ». Il est correct, parce que
   * `combineParallelPairingResults` exclut du budget épuisé tout worker dont
   * `candidates.length === perWorkerMaxCollected`.
   *
   * ⚠️ Ce qui est épinglé ici, c'est la **COMPOSITION** — le maillon que les
   * deux revues visaient. `rune-optim-parallel-truncated.test.ts` (cas 1)
   * couvre déjà `combineParallelPairingResults` seule ; ce qu'aucun test ne
   * couvrait, c'est que le résultat fusionné, passé à `evaluerCompletude`,
   * ne fabrique AUCUN motif `maxMs`. C'est là que la revue plaçait le bug. */
  {
    const PAR_WORKER = 25_000;
    const GLOBAL = 100_000;
    const candidats = (n: number) => new Array(n).fill({ runeIds: [], stats: [], effTotal: 0 });
    const parWorker: SearchResult[] = [
      // Le worker « riche » : quota LOCAL rempli PILE — `pairBuckets` sort
      // toujours `truncated: true` dans ce cas, ce n'est pas un signe de
      // recherche globalement incomplète.
      { candidates: candidats(PAR_WORKER), explored: 500_000, truncated: true, nearMissByCondition: [], globalNearMiss: null },
      { candidates: candidats(5_000), explored: 400_000, truncated: false, nearMissByCondition: [], globalNearMiss: null },
      { candidates: candidats(5_000), explored: 400_000, truncated: false, nearMissByCondition: [], globalNearMiss: null },
      { candidates: candidats(5_000), explored: 400_000, truncated: false, nearMissByCondition: [], globalNearMiss: null },
    ];
    const fusionne = combineParallelPairingResults(parWorker, PAR_WORKER, GLOBAL);
    egal(fusionne.candidates.length, 40_000, 'le total (40 000) reste très en-deçà du plafond GLOBAL (100 000)');
    egal(fusionne.truncated, false, 'un worker qui remplit son quota LOCAL ne rend pas la recherche globale tronquée');

    // `explored` égale l'espace : la recherche a tout parcouru.
    const verdict = evaluerCompletude(fusionne, fusionne.explored, { maxCollected: GLOBAL } as SearchParams);
    ok(verdict.complet, 'et le harnais la déclare COMPLÈTE — c’est le scénario que deux revues ont cru faux');
    egal(verdict.motif, undefined, 'AUCUN motif n’est fabriqué : ni maxMs (l’erreur annoncée par la revue), ni maxCollected');
    ok(verdict.incoherence == null, 'et aucune incohérence : explored couvre tout l’espace');
  }

  /* ── §6.1 : suivi d'une rune, et ce qu'une disparition SIGNIFIE ────── */
  const pool = randomPool(mulberry32(7), 5, SETS_JOKER);
  const etages: EtagePopulation[] = [
    { nom: 'mainstat', nature: 'contrainte', presents: new Set([1, 2, 3]) },
    { nom: 'dominance', nature: 'sûr', presents: new Set([1, 2]) },
    { nom: 'feasibility', nature: 'sûr', presents: new Set([1]) },
    { nom: 'filterslot', nature: 'mixte', presents: new Set([1]) },
  ];
  const survivante = suivrePiece(1, pool, etages);
  ok(survivante.premiereDisparition == null, 'une rune qui survit à tout n’a pas de « première disparition »');

  const eliminee = suivrePiece(3, pool, etages);
  egal(eliminee.premiereDisparition?.etage, 'dominance', 'la PREMIÈRE disparition est retenue, pas la dernière');
  egal(eliminee.premiereDisparition?.nature, 'sûr', 'avec la NATURE de l’étage');
  ok(
    eliminee.premiereDisparition!.signification.includes('PROUVÉ'),
    'un élagage sûr le dit — « prouvé », jamais un vague « éliminée »'
  );

  // ⚠️ `filterSlot` est MIXTE : le dire est le cœur du §6.1. Une rune qui y
  // disparaît ne peut PAS être déclarée inutile.
  const etagesFiltrees: EtagePopulation[] = [
    { nom: 'mainstat', nature: 'contrainte', presents: new Set([1]) },
    { nom: 'dominance', nature: 'sûr', presents: new Set([1]) },
    { nom: 'feasibility', nature: 'sûr', presents: new Set([1]) },
    { nom: 'filterslot', nature: 'mixte', presents: new Set<number>() },
  ];
  const parFiltrage = suivrePiece(1, pool, etagesFiltrees);
  ok(
    parFiltrage.premiereDisparition!.signification.includes('AMBIGU'),
    'une disparition au pré-filtrage est annoncée AMBIGUË, jamais comme un verdict'
  );

  // Un id absent du pool n'est pas « écarté au premier étage ».
  const inconnue = suivrePiece(999999, pool, etages);
  ok(!inconnue.presenteAuDepart, 'une rune absente du pool est signalée comme telle');
  ok(inconnue.premiereDisparition == null, 'et n’est PAS présentée comme éliminée par un étage');

  /* ── §6.4 bis : aucun temps livré nu ───────────────────────────────── */
  const uneSeule = serie([12]);
  ok(uneSeule.avertissement != null, 'une seule répétition : la mesure est MARQUÉE comme non comparative');
  const plusieurs = serie([10, 12, 11, 40]);
  egal(plusieurs.min, 10, 'le MINIMUM est l’estimateur retenu (le bruit ne peut qu’ajouter du temps)');
  egal(plusieurs.mediane, 11.5, 'la médiane est rendue à côté');
  egal(Math.round(plusieurs.dispersionPct), 300, 'et la DISPERSION, qui dit si un écart veut dire quelque chose');
  ok(plusieurs.avertissement == null, 'au-delà d’une répétition, plus d’avertissement');

  // ⚠️ §6.4 bis niveau 2 : le harnais ne sait pas entrelacer deux conditions.
  // Il doit donc DIRE que comparer deux runs séparés est le protocole en
  // blocs — un biais qui se reproduit, donc qui passe pour un signal.
  ok(
    complet.temps!.avertissementComparaison.includes('BLOCS') &&
      complet.temps!.avertissementComparaison.includes('perf-battery-compare'),
    'toute mesure de temps porte le garde-fou contre la comparaison entre deux runs séparés'
  );

  ok(complet.temps != null, 'un run rend ses temps PAR PHASE (le budget maxMs court depuis la préparation)');
  egal(complet.temps!.preparation.repetitions, 1, 'une répétition par défaut');
  const repete = await executerHarnais(configSynthetique({ repetitions: 3 }));
  egal(repete.temps!.total.repetitions, 3, 'et le nombre de répétitions est réglable');
  ok(repete.temps!.total.avertissement == null, '3 répétitions : la dispersion devient exploitable');

  /* ── Les bornes de faisabilité sont RENDUES ──────────────────────── */
  // ⚠️ Sans elles, « aucune rune éliminée » est indistinguable de « la
  // correction guaranteedMin/artifactBounds n'est pas active » — deux
  // situations qui produisent exactement le même nombre.
  egal(
    complet.bornesFaisabilite.map((b) => b.stat),
    ['spd'],
    'les bornes sont rendues pour chaque stat CONTRAINTE (ici le seul minimum posé)'
  );
  const borne = complet.bornesFaisabilite[0];
  ok(
    borne.guaranteedMin.pct >= borne.guaranteed.pct,
    'guaranteedMin est au moins aussi généreux que guaranteed (il inclut la marge d’activation)'
  );
  ok(borne.artFlatMax >= borne.artFlatMin, 'la borne HAUTE d’artéfact est au moins la borne basse');

  /* ── §6.3 : preuve et indice, jamais confondus ─────────────────────── */
  // Une preuve est rendue pour chaque condition posée, même quand tout va
  // bien — c'est ce qui permet de lire un « 0 candidat » sans deviner.
  egal(
    complet.faisabilite.preuves.map((p) => [p.stat, p.borne]),
    [['spd', 'min']],
    'une PREUVE de faisabilité est rendue pour chaque condition posée'
  );
  ok(complet.faisabilite.preuves[0].satisfiable, 'ici rien ne prouve l’impossibilité');
  // ⚠️ Économie assumée : les blocages coûtent un pré-filtrage PAR condition.
  ok(complet.faisabilite.blocages == null, 'les blocages ne sont PAS calculés quand la recherche a abouti');

  // Condition mathématiquement hors de portée : la preuve doit le DIRE, et
  // les blocages doivent alors être calculés d’office.
  const impossible = await executerHarnais(
    configSynthetique({
      source: {
        type: 'synthetique',
        seed: 4242,
        runesParEmplacement: 8,
        requirement: { sets: [], minStats: { spd: 9999 } },
        slotFilterCap: 40,
      },
    })
  );
  const preuve = impossible.faisabilite.preuves.find((p) => p.stat === 'spd')!;
  ok(!preuve.satisfiable, 'une condition hors de portée est PROUVÉE impossible');
  ok(preuve.atteignable < preuve.demande, 'et la borne atteignable est rendue, pas seulement le verdict');
  ok(impossible.faisabilite.blocages != null, 'une configuration sans issue déclenche le classement des blocages');
  ok(
    impossible.faisabilite.blocages!.coutMs >= 0,
    'dont le COÛT est rendu — un diagnostic dont on ignore le prix finit lancé au mauvais moment'
  );

  /* ── §6.2 : une configuration invalide NOMME sa cause ──────────────── */
  const verrouAbsent = await executerHarnais(
    configSynthetique({
      source: {
        type: 'synthetique',
        seed: 4242,
        runesParEmplacement: 8,
        requirement: { sets: [], minStats: {}, lockedRunes: { 2: 999999 } },
        slotFilterCap: 40,
      },
    })
  );
  ok(
    (verrouAbsent.completude!.configurationInvalide ?? "").includes('IMPOSÉE #999999 est absente du pool'),
    'une rune imposée introuvable est nommée comme la cause — jamais « emplacement vide » tout court'
  );

  // ⚠️ Le piège voisin : la rune existe, mais à un AUTRE emplacement. Un
  // verrou ne déplace pas une rune, il vide l’emplacement.
  const verrouMauvaisSlot = await executerHarnais(
    configSynthetique({
      source: {
        type: 'synthetique',
        seed: 4242,
        runesParEmplacement: 8,
        requirement: { sets: [], minStats: {}, lockedRunes: { 2: 1 } },
        slotFilterCap: 40,
      },
    })
  );
  ok(
    (verrouMauvaisSlot.completude!.configurationInvalide ?? "").includes('en réalité à l’emplacement 1') ||
      (verrouMauvaisSlot.completude!.configurationInvalide ?? "").includes("en réalité à l'emplacement 1"),
    'une rune imposée au mauvais emplacement est distinguée d’une rune absente'
  );

  /* ── §4.2 : la provenance du pool figure TOUJOURS dans le résultat ── */
  egal(complet.source, 'synthetique', 'la source du pool est rendue');
  ok(complet.descriptionSource.includes('seed'), 'et sa description permet de rejouer le run à l’identique');
}
