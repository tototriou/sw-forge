// Point d'entrée des vérifications — `npm test`.
//
// ⚠️ L'ORDRE compte un peu : `persistance` installe un faux `localStorage`
// global et le laisse en place. On le passe en dernier pour qu'il ne perturbe
// rien d'autre.

import { bilan } from './outils';
import testImport from './import.test';
import testPersistance from './persistance.test';
import testMeules, { testPalier, testRegistre, testSansDowngrade } from './meules.test';
import testArtefacts from './artefacts.test';
import testArtefactOptim, {
  testRecettePartagee,
  testAmplificationSurvitDominance,
  testConversionVitesseFinale,
  testAmpliMaxAtteignable,
} from './artefact-optim.test';
import testArtefactFile from './artefact-file.test';
import testArtifactEvaluation, { testArtifactPaireReelleEhp, testArtifactPaireReelleDegatsEffetUnique } from './artifact-evaluation.test';
import { testResolutionProducteurPartage, testClassementResolu } from './resolution-partagee.test';
import { testResolutionCaches } from './resolution-caches.test';
import { testResolutionWorker } from './resolution-worker.test';
import { testResolutionDistante } from './resolution-distante.test';
import { testCliClassementParMode } from './cli-classement.test';
import { testKDeLaFile } from './file-k.test';
import { testCompteAffichable } from './compte-affichable.test';
import { testVoieDeLaFile } from './file-voie.test';
import { testCompositionDePage } from './composition-page.test';
import { testFileConfirmees } from './file-confirmees.test';
import { testCompteConfirme } from './compte-confirme.test';
import { testVerifierToutes } from './verifier-toutes.test';
import { testProsesSortAuClic, testEffetsActifsInfobulle } from './proses-sort.test';
import { testProseStatsCombat, testProseStatsCombatCarte } from './prose-stats-combat.test';
import testArtifactConditionFloor from './artifact-condition-floor.test';
import { testArtefactsFichePoints, testArtefactsFicheConqueteTenacite, testArtefactsFicheCache } from './artifact-fiche.test';
import { testArtefactsFicheDifferentiel } from './artifact-fiche-recherche.test';
import { testArtefactsFicheParamsEcran, testArtefactsFicheParamsCliVerrous, testArtefactsFicheParamsDifferentiel } from './artifact-params-fiche.test';
import testArtifactRelicConditionFloor from './artifact-relic-condition-floor.test';
import testReco, {
  testTrimPartage,
  testDefensesVisees,
  testRechercheMonstre,
  testRechercheMultiple,
  testDecksMontables,
  testFormesJouables,
} from './reco.test';
import testRtaPartage from './rta-partage.test';
import testChantier, {
  testChantierDeuxChantiers,
  testHooksCodex,
  testChantierLintNotes,
  testChantierRafraichir,
  testChantierIncidentNotesEnRetard,
  testChantierOuvrirCas,
  testChantierLivrerGarde,
  testChantierReprises,
  testChantierMigration,
} from './chantier.test';
import testCouleursCourbes from './courbe-couleurs.test';
import testRechargement from './rechargement.test';
import testCollabPaires from './collab-paires.test';
import testDegats, { testFormesEquivalentes } from './degats.test';
import testAuditDegatsConditionnels from './audit-degats-conditionnels.test';
import { testDegatsTempestFormule, testDegatsTempestDeclenchement } from './degats-tempest.test';
import testDegatsBladeSurge from './degats-blade-surge.test';
import testBladeDancersIgnoreDef, { testBladeDancersRecette } from './blade-dancers.test';
import testRuneOptim from './rune-optim.test';
import testRuneOptimDifferential from './rune-optim-differential.test';
import testRuneOptimOnStage from './rune-optim-onstage.test';
import testRandomPool from './random-pool.test';
import testDiagnosticHarness, { testDiagnosticHarnessClassementDegatsReels } from './diagnostic-harness.test';
import testDiagnosticProfils from './diagnostic-profils.test';
import testDiagnosticDifferentiel from './diagnostic-differentiel.test';
import testDiagnosticDecouverte from './diagnostic-decouverte.test';
import testRuneOptimScaleMonotonicity from './rune-optim-scale-monotonicity.test';
import testRuneOptimParallelPairing from './rune-optim-parallel-pairing.test';
import testRuneOptimParallelTruncated from './rune-optim-parallel-truncated.test';
import testRuneOptimNearMiss from './rune-optim-near-miss.test';
import testRuneOptimDeadHalfPruning from './rune-optim-dead-half-pruning.test';
import testFilterSlotTopK from './rune-optim-filterslot-topk.test';
import testOptimizerExclusion from './optimizer-exclusion.test';
import testOptimizerRecipeImportSelection from './optimizer-recipe-import-selection.test';
import testOptimizerDamageTransitions from './optimizer-damage-transitions.test';
import { testAurasRecette, testAurasCombatEtExclusive, testAurasArrondiCommunLeadInvocateur, testAurasChoixEffectifReliqueEhp, testAurasPassifEtAdditionnel, testAurasEhpEtConditions, testAurasReliqueFinaleEtDiagnostics, testAurasPariteEcranCliEtCache, testAurasRechercheDifferentielle, testAurasPropresResolution, testAurasPropresCombatEtScore, testAurasPvEffectifsCeilUnique, testAurasPropresNoteDesCouples, testAurasConditionsPropresFonctions, testAurasConditionsPropresResolution, testAurasConditionsPropresPairBuckets, testAurasCarteEgaleTri, testAurasPariteRegimes } from './auras-modele.test';
import { testAurasEcranBornes, testAurasEcranEcriture, testAurasEcranValidationPartagee, testAurasEcranEcho, testAurasEcranInterrupteur, testAurasEcranRappel, testAurasEcranGuidage } from './auras-ecran.test';
import {
  testRuneOptimAurasCoupesMinimum,
  testRuneOptimAurasCoupesDiagnostics,
  testRuneOptimAurasCoupesRetention,
  testRuneOptimAurasCoupesBladeIntangible,
  testRuneOptimAurasCoupesDifferentiel,
  testRuneOptimAurasCoupesDominance,
} from './rune-optim-auras-coupes.test';
import {
  testDominanceReliqueCasMinimal,
  testDominanceReliqueCouverture,
  testDominanceReliqueRecherche,
  testDominanceReliqueTemoins,
  testDominanceReliqueWorkers,
  testDominanceReliqueDifferentiel,
  testDominanceReliqueDifferentielCible,
} from './rune-optim-dominance-relique.test';
import {
  testDominanceLignesQuatrePorteurs,
  testDominanceLignesJoker,
  testDominanceLignesLibre,
  testDominanceLignesProducteurs,
  testDominanceLignesWorkers,
} from './rune-optim-dominance-lignes.test';
import testRelicOptim from './relic-optim.test';
import testRelicOracle, { testRelicOracleGroupesEffetUnique, testRelicOracleOptimumParScore } from './relic-oracle.test';
import testRelicSearch from './relic-search.test';
import testRelicQueue from './relic-queue.test';
import testPerfRelicOptions from './perf-relic-options.test';
import testRelicDifferentiel from './relic-differentiel.test';
import testRelicUniqueLabel from './relic-unique-label.test';
import testRelicExclusive, { testDepartageReliquePortee, testRelicClassementParMode, testRelicReferenceComparer, testTriParStatSurLaFiche } from './relic-exclusive.test';
import testSetsIntangible from './sets-intangible.test';
import testRuneTri from './rune-tri.test';
import testMonstreTri from './monstre-tri.test';
import testMonstreFormes from './monstre-formes.test';
import testStockage from './stockage.test';
import testVitesse from './vitesse.test';
import testSiegeStatut from './siege-statut.test';
import testSpeedTune, { testSpeedTuneDeck, testSpeedTuneChaine, testSpeedTuneKit, testSpeedTuneSequence, testSpeedTuneReference, testSpeedTunePassif, testSpeedTuneAuto, testSpeedTuneModele } from './speed-tune.test';
import testSpecMarkdown from './spec-markdown.test';
import testSpecToc from './spec-toc.test';
import testSpecLint, { testSpecLintEnTetes, testSpecLintEnTetesReel, testSpecLintReel } from './spec-lint.test';
import testSkillAdapters from './skill-adapters.test';

// Chaque vérification sous son NOM, dans l'ordre d'exécution.
//
// ⚠️ L'ORDRE compte un peu (voir plus haut) : `persistance` reste en dernier.
//
// Ce registre permet de ne lancer QUE ce qu'on touche :
//     node tests/run.mjs speed-tune       (tout ce dont le nom contient « speedtune »)
//     node tests/run.mjs rune-optim vitesse
// Sans argument, tout tourne — c'est ce que fait `npm test`, et ce qu'il FAUT
// faire avant une fusion sur `main` (voir CLAUDE.md).
const VERIFICATIONS: [string, () => void | Promise<void>][] = [
  ['testVitesse', testVitesse],
  ['testSpeedTune', testSpeedTune],
  ['testSpeedTuneDeck', testSpeedTuneDeck],
  ['testSpeedTuneChaine', testSpeedTuneChaine],
  ['testSpeedTuneKit', testSpeedTuneKit],
  ['testSpeedTuneSequence', testSpeedTuneSequence],
  ['testSpeedTuneReference', testSpeedTuneReference],
  ['testSpeedTunePassif', testSpeedTunePassif],
  ['testSpeedTuneAuto', testSpeedTuneAuto],
  ['testSpeedTuneModele', testSpeedTuneModele],
  ['testSiegeStatut', testSiegeStatut],
  ['testSpecMarkdown', testSpecMarkdown],
  ['testSpecToc', testSpecToc],
  ['testSpecLintEnTetes', testSpecLintEnTetes],
  ['testSpecLintEnTetesReel', testSpecLintEnTetesReel],
  ['testSpecLint', testSpecLint],
  ['testSpecLintReel', testSpecLintReel],
  ['testSkillAdapters', testSkillAdapters],
  ['testImport', testImport],
  ['testReco', testReco],
  ['testDefensesVisees', testDefensesVisees],
  ['testTrimPartage', testTrimPartage],
  ['testRechercheMonstre', testRechercheMonstre],
  ['testRechercheMultiple', testRechercheMultiple],
  ['testDecksMontables', testDecksMontables],
  ['testFormesJouables', testFormesJouables],
  ['testRtaPartage', testRtaPartage],
  ['testChantier', testChantier],
  ['testChantierDeuxChantiers', testChantierDeuxChantiers],
  ['testHooksCodex', testHooksCodex],
  ['testChantierLintNotes', testChantierLintNotes],
  ['testChantierRafraichir', testChantierRafraichir],
  ['testChantierIncidentNotesEnRetard', testChantierIncidentNotesEnRetard],
  ['testChantierOuvrirCas', testChantierOuvrirCas],
  ['testChantierLivrerGarde', testChantierLivrerGarde],
  ['testChantierReprises', testChantierReprises],
  ['testChantierMigration', testChantierMigration],
  ['testSetsIntangible', testSetsIntangible],
  ['testRuneTri', testRuneTri],
  ['testMonstreTri', testMonstreTri],
  ['testMonstreFormes', testMonstreFormes],
  ['testCouleursCourbes', testCouleursCourbes],
  ['testRechargement', testRechargement],
  ['testCollabPaires', testCollabPaires],
  ['testDegats', testDegats],
  ['testAuditDegatsConditionnels', testAuditDegatsConditionnels],
  ['testDegatsBladeSurge', testDegatsBladeSurge],
  ['testBladeDancersIgnoreDef', testBladeDancersIgnoreDef],
  ['testBladeDancersRecette', testBladeDancersRecette],
  ['testFormesEquivalentes', testFormesEquivalentes],
  ['testDegatsTempestFormule', testDegatsTempestFormule],
  ['testDegatsTempestDeclenchement', testDegatsTempestDeclenchement],
  ['testRuneOptim', testRuneOptim],
  ['testRuneOptimDifferential', testRuneOptimDifferential],
  ['testRuneOptimOnStage', testRuneOptimOnStage],
  ['testRandomPool', testRandomPool],
  ['testDiagnosticHarness', async () => { await testDiagnosticHarness(); }],
  ['testDiagnosticHarnessClassementDegatsReels', testDiagnosticHarnessClassementDegatsReels],
  ['testDiagnosticProfils', async () => { await testDiagnosticProfils(); }],
  ['testDiagnosticDifferentiel', async () => { await testDiagnosticDifferentiel(); }],
  ['testDiagnosticDecouverte', async () => { await testDiagnosticDecouverte(); }],
  ['testRuneOptimScaleMonotonicity', testRuneOptimScaleMonotonicity],
  ['testRuneOptimParallelPairing', async () => { await testRuneOptimParallelPairing(); }],
  ['testRuneOptimParallelTruncated', testRuneOptimParallelTruncated],
  ['testRuneOptimNearMiss', async () => { await testRuneOptimNearMiss(); }],
  ['testRuneOptimDeadHalfPruning', testRuneOptimDeadHalfPruning],
  ['testFilterSlotTopK', testFilterSlotTopK],
  ['testOptimizerExclusion', testOptimizerExclusion],
  ['testOptimizerRecipeImportSelection', testOptimizerRecipeImportSelection],
  ['testOptimizerDamageTransitions', testOptimizerDamageTransitions],
  ['testAurasRecette', testAurasRecette],
  ['testAurasCombatEtExclusive', testAurasCombatEtExclusive],
  ['testAurasArrondiCommunLeadInvocateur', testAurasArrondiCommunLeadInvocateur],
  ['testAurasChoixEffectifReliqueEhp', testAurasChoixEffectifReliqueEhp],
  ['testAurasPassifEtAdditionnel', testAurasPassifEtAdditionnel],
  ['testAurasEhpEtConditions', testAurasEhpEtConditions],
  ['testAurasReliqueFinaleEtDiagnostics', testAurasReliqueFinaleEtDiagnostics],
  ['testAurasPariteEcranCliEtCache', testAurasPariteEcranCliEtCache],
  ['testAurasRechercheDifferentielle', testAurasRechercheDifferentielle],
  ['testAurasPropresResolution', testAurasPropresResolution],
  ['testAurasPropresCombatEtScore', testAurasPropresCombatEtScore],
  ['testAurasPvEffectifsCeilUnique', testAurasPvEffectifsCeilUnique],
  ['testAurasPropresNoteDesCouples', testAurasPropresNoteDesCouples],
  ['testAurasConditionsPropresFonctions', testAurasConditionsPropresFonctions],
  ['testAurasConditionsPropresResolution', testAurasConditionsPropresResolution],
  ['testAurasConditionsPropresPairBuckets', testAurasConditionsPropresPairBuckets],
  ['testAurasCarteEgaleTri', testAurasCarteEgaleTri],
  ['testAurasPariteRegimes', async () => { await testAurasPariteRegimes(); }],
  ['testAurasEcranBornes', testAurasEcranBornes],
  ['testAurasEcranEcriture', testAurasEcranEcriture],
  ['testAurasEcranValidationPartagee', testAurasEcranValidationPartagee],
  ['testAurasEcranEcho', testAurasEcranEcho],
  ['testAurasEcranInterrupteur', testAurasEcranInterrupteur],
  ['testAurasEcranRappel', testAurasEcranRappel],
  ['testAurasEcranGuidage', testAurasEcranGuidage],
  ['testRuneOptimAurasCoupesMinimum', testRuneOptimAurasCoupesMinimum],
  ['testRuneOptimAurasCoupesDiagnostics', testRuneOptimAurasCoupesDiagnostics],
  ['testRuneOptimAurasCoupesRetention', testRuneOptimAurasCoupesRetention],
  ['testRuneOptimAurasCoupesBladeIntangible', testRuneOptimAurasCoupesBladeIntangible],
  ['testRuneOptimAurasCoupesDifferentiel', testRuneOptimAurasCoupesDifferentiel],
  ['testRuneOptimAurasCoupesDominance', testRuneOptimAurasCoupesDominance],
  ['testDominanceReliqueCasMinimal', testDominanceReliqueCasMinimal],
  ['testDominanceReliqueCouverture', testDominanceReliqueCouverture],
  ['testDominanceReliqueRecherche', testDominanceReliqueRecherche],
  ['testDominanceReliqueTemoins', testDominanceReliqueTemoins],
  ['testDominanceReliqueWorkers', testDominanceReliqueWorkers],
  ['testDominanceReliqueDifferentiel', testDominanceReliqueDifferentiel],
  ['testDominanceReliqueDifferentielCible', testDominanceReliqueDifferentielCible],
  ['testDominanceLignesQuatrePorteurs', testDominanceLignesQuatrePorteurs],
  ['testDominanceLignesJoker', testDominanceLignesJoker],
  ['testDominanceLignesLibre', testDominanceLignesLibre],
  ['testDominanceLignesProducteurs', testDominanceLignesProducteurs],
  ['testDominanceLignesWorkers', testDominanceLignesWorkers],
  ['testRelicOptim', testRelicOptim],
  ['testRelicOracle', testRelicOracle],
  ['testRelicOracleGroupesEffetUnique', testRelicOracleGroupesEffetUnique],
  ['testRelicOracleOptimumParScore', testRelicOracleOptimumParScore],
  ['testRelicSearch', testRelicSearch],
  ['testRelicQueue', testRelicQueue],
  ['testPerfRelicOptions', testPerfRelicOptions],
  ['testRelicDifferentiel', testRelicDifferentiel],
  ['testRelicUniqueLabel', testRelicUniqueLabel],
  ['testRelicExclusive', testRelicExclusive],
  ['testRelicClassementParMode', testRelicClassementParMode],
  ['testRelicReferenceComparer', testRelicReferenceComparer],
  ['testTriParStatSurLaFiche', testTriParStatSurLaFiche],
  ['testDepartageReliquePortee', testDepartageReliquePortee],
  ['testArtefactsFichePoints', testArtefactsFichePoints],
  ['testArtefactsFicheConqueteTenacite', testArtefactsFicheConqueteTenacite],
  ['testArtefactsFicheCache', testArtefactsFicheCache],
  ['testArtefactsFicheDifferentiel', testArtefactsFicheDifferentiel],
  ['testArtefactsFicheParamsEcran', testArtefactsFicheParamsEcran],
  ['testArtefactsFicheParamsCliVerrous', testArtefactsFicheParamsCliVerrous],
  ['testArtefactsFicheParamsDifferentiel', testArtefactsFicheParamsDifferentiel],
  ['testResolutionProducteurPartage', testResolutionProducteurPartage],
  ['testClassementResolu', testClassementResolu],
  ['testResolutionCaches', testResolutionCaches],
  ['testResolutionWorker', testResolutionWorker],
  ['testResolutionDistante', testResolutionDistante],
  ['testCliClassementParMode', testCliClassementParMode],
  ['testKDeLaFile', testKDeLaFile],
  ['testCompteAffichable', testCompteAffichable],
  ['testVoieDeLaFile', testVoieDeLaFile],
  ['testCompositionDePage', testCompositionDePage],
  ['testFileConfirmees', testFileConfirmees],
  ['testCompteConfirme', testCompteConfirme],
  ['testVerifierToutes', testVerifierToutes],
  ['testProsesSortAuClic', testProsesSortAuClic],
  ['testEffetsActifsInfobulle', testEffetsActifsInfobulle],
  ['testProseStatsCombat', testProseStatsCombat],
  ['testProseStatsCombatCarte', testProseStatsCombatCarte],
  ['testMeules', testMeules],
  ['testArtefacts', testArtefacts],
  ['testArtefactOptim', testArtefactOptim],
  ['testRecettePartagee', testRecettePartagee],
  ['testAmplificationSurvitDominance', testAmplificationSurvitDominance],
  ['testConversionVitesseFinale', testConversionVitesseFinale],
  ['testAmpliMaxAtteignable', testAmpliMaxAtteignable],
  ['testArtefactFile', testArtefactFile],
  ['testArtifactEvaluation', testArtifactEvaluation],
  ['testArtifactPaireReelleEhp', testArtifactPaireReelleEhp],
  ['testArtifactPaireReelleDegatsEffetUnique', testArtifactPaireReelleDegatsEffetUnique],
  ['testArtifactConditionFloor', testArtifactConditionFloor],
  ['testArtifactRelicConditionFloor', testArtifactRelicConditionFloor],
  ['testRegistre', testRegistre],
  ['testSansDowngrade', testSansDowngrade],
  ['testPalier', testPalier],
  ['testStockage', async () => { await testStockage(); }],
  ['testPersistance', async () => { await testPersistance(); }],
];

// Un filtre passé en argument : on compare sur le nom mis à plat (sans tirets ni
// casse), pour que « speed-tune », « speedtune » et « SpeedTune » marchent tous.
function retenues(filtres: string[]): [string, () => void | Promise<void>][] {
  if (filtres.length === 0) return VERIFICATIONS;
  const plat = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cibles = filtres.map(plat);
  return VERIFICATIONS.filter(([nom]) => cibles.some((c) => plat(nom).includes(c)));
}

async function main() {
  const filtres = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const liste = retenues(filtres);
  if (liste.length === 0) {
    console.error(
      `
[31mAucune vérification ne correspond à[0m ${filtres.join(' ')}
` +
        `Disponibles : ${VERIFICATIONS.map(([n]) => n).join(', ')}`
    );
    process.exit(1);
  }
  if (filtres.length > 0) {
    console.log(
      `[33mVérifications ciblées[0m (${liste.length}/${VERIFICATIONS.length}) : ` +
        liste.map(([n]) => n).join(', ') +
        `
[33m⚠️  La suite complète reste obligatoire avant une fusion sur main.[0m
`
    );
  }
  for (const [, fn] of liste) await fn();

  const { total, echecs, ignores } = bilan();
  const resume =
    echecs === 0
      ? `\n\x1b[32m${total} vérifications passées\x1b[0m` + (ignores ? `, ${ignores} ignorée(s)` : '')
      : `\n\x1b[31m${echecs} échec(s)\x1b[0m sur ${total} vérifications`;
  console.log(resume);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n\x1b[31mLes vérifications se sont interrompues :\x1b[0m', err);
  process.exit(1);
});
