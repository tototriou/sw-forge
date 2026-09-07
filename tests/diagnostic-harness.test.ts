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
import { MAX_COLLECTED, SearchParams, SearchResult, bucketCapFor } from '../src/lib/runeBuildOptim';

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

  /* ── §4.4 règle 3 : un run surchargé est MARQUÉ ────────────────────── */
  ok(!sansOverride.fidelite.divergeDeLaProd, 'sans override : la fidélité annonce « conforme à la production »');
  const surcharge = resoudreConfig(configSynthetique({ overrides: { bucketCap: 500 } }));
  ok(surcharge.fidelite.divergeDeLaProd, 'avec un override : la fidélité annonce « DIVERGE DE LA PROD »');
  ok(
    surcharge.fidelite.ecarts.some((e) => e.nom === 'bucketCap' && e.valeur === 500),
    'et l’écart nomme le paramètre, sa valeur ET celle de la prod'
  );
  ok(
    surcharge.fidelite.noteNavigateur.includes('PLANCHER'),
    'la note « temps Node = plancher pour le navigateur » voyage avec le résultat'
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
  const completSansTout: SearchResult = { candidates: [], explored: 900, truncated: false, nearMissByCondition: [], globalNearMiss: null };
  ok(
    evaluerCompletude(completSansTout, 1000, paramsFictifs).incoherence != null,
    'annoncé complet mais 900 < 1000 paires : l’incohérence est dite'
  );

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
