// Point d'entrée des vérifications — `npm test`.
//
// ⚠️ L'ORDRE compte un peu : `persistance` installe un faux `localStorage`
// global et le laisse en place. On le passe en dernier pour qu'il ne perturbe
// rien d'autre.

import { bilan, debutVerification } from './outils';
import testImport from './import.test';
import { verificationsImportEquipes } from './import-equipes.test';
import { testRenduOptimizerLeadEquipePersonnel, testRenduTelephoneOptimizerLeadEquipePersonnel,
  testRenduOptimizerDialogueEquipe, testRenduTelephoneOptimizerDialogueEquipe,
  testRenduOptimizerCreationContenu, testRenduTelephoneOptimizerCreationContenu,
  testRenduOptimizerRefusIdentitePerime, testRenduTelephoneOptimizerRefusIdentitePerime } from './rendu/optimizer-equipes.test';
import { verificationsImportSpeedTune } from './import-speed-tune.test';
import { verificationsImportReco } from './import-reco.test';
import { verificationsImportRecoCopies } from './import-reco-copies.test';
import testNavigation from './navigation.test';
import { testNavigationAdresses, testNavigationAdressesDefauts, testNavigationVuesCompte } from './navigation-adresses.test';
import testPersistance from './persistance.test';
import {
  testMemoireOptimizerJson, testMemoireOptimizerCopie, testMemoireOptimizerLecteurListes,
  testMemoireOptimizerListesIllisibles, testMemoireOptimizerMalformed, testEquipeOptimizerValidation,
  testMemoireOptimizerConservationSession, testSessionOptimizerVersionDeux, testMemoireOptimizerEffacement,
  testMemoireOptimizerReimport, testMemoireOptimizerEspeceSelecteur, testMemoireOptimizerBranchement,
  testEquipeOptimizerMembreRetire, testMemoireOptimizerSuppressionExplicite,
  testMemoireOptimizerReimportBrutPreserve,
  testEquipeOptimizerTextesStricts,
} from './optimizer-member-storage.test';
import { testMemoireOptimizerRejetsConserves, testMemoireOptimizerTextesCriteresStricts } from './optimizer-member-rejections.test';
import { testOptimizerRattachementReferenceConservee } from './optimizer-rattachement-attribution.test';
import { testOptimizerRattachementIdentites, verificationsOptimizerRattachementOrdres, testOptimizerRattachementDepartageEtPrises,
  testOptimizerRattachementCopiesSansExemplaire, testOptimizerRattachementPermutationEtProprietaire,
  testOptimizerRattachementRuneVendue, testOptimizerRattachementDefensesComplet, testOptimizerRattachementBranchement } from './optimizer-rattachement.test';
import testMeules, { testGemmeMemeStat, testRegemmeDifferent, testReserveParGrade, testPalier, testRegistre, testSansDowngrade } from './meules.test';
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
import { testProseStatsCombat, testProseStatsCombatCarte, testProseStatsCombatPassifMasque } from './prose-stats-combat.test';
import { testBuffsDePassifTable, testBuffsDePassifRappel, testBuffsDePassifEcran } from './buffs-de-passif.test';
import { testCalculPartielTable, testCalculPartielAffichage, testCalculPartielEcran } from './calcul-partiel.test';
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
import { testInstallerHooks, testInstallationAutomatique } from './installer-hooks.test';
import { testPreCommit } from './pre-commit.test';
import { testCommitMsg } from './commit-msg.test';
import { testVerifierCommits } from './verifier-commits.test';
import { testRenvois, testRenvoisFormes } from './renvois.test';
import testCouleursCourbes from './courbe-couleurs.test';
import testRechargement from './rechargement.test';
import testCollabPaires from './collab-paires.test';
import testDegats, { testFormesEquivalentes } from './degats.test';
import testAuditDegatsConditionnels from './audit-degats-conditionnels.test';
import { testCritiqueMoyenneImport, testCritiqueMoyenneEcranEtCli, testCritiqueMoyenneMessageImport } from './critique-moyenne-supprime.test';
import {
  testDegatsTempestFormule,
  testDegatsTempestDeclenchement,
  testDegatsTempestCommeSort,
  testDegatsTempestRecette,
  testDegatsTempestEcran,
} from './degats-tempest.test';
import testDegatsBladeSurge from './degats-blade-surge.test';
import { testDegatsSequencesApi, testDegatsFormulesApi, testDegatsPorteesParLaProse } from './degats-valeurs-api.test';
import testDegatsSortsSansAttaque from './degats-sorts-sans-attaque.test';
import { testDegatsCoupsSaisis } from './degats-coups-saisis.test';
import {
  testBornesStrictesDef,
  testResumeConditionDef,
  testGarantieByungchul,
  testGarantieYujiRick,
  testResumeConditionDebuff,
} from './degats-garanties-bornes.test';
import { testVitCiriBirgitta, testTheoniaAtqCible } from './degats-vit-atq-cible.test';
import { testCouvertureGarantiesCritique, testCouvertureBonusCritique, testCouvertureIgnoreDefIdentifiants, testCouvertureVariablesFormule, testCouvertureConditionsSort, testCouvertureStatsCombat } from './degats-couverture-livraisons.test';
import {
  testBladeSurgeRecette,
  testBladeSurgeEcran,
  testBladeSurgePariteEcranCli,
  testBladeSurgeResumeObjectif,
  testBladeSurgeLigneArtifactSearch,
} from './blade-surge-propagation.test';
import { testRecetteClesIdentifiant } from './recette-cles-identifiant.test';
import testBladeDancersIgnoreDef,{ testBladeDancersRecette, testBladeDancersEcranEtCli } from './blade-dancers.test';
import {
  testMecanismesSequenceDeCoups,
  testMecanismesAttaqueDeclenchee,
  testMecanismesIgnoreDefDepuisUnCoup,
  testMecanismesPassifMasqueEtStatsDeCombat,
} from './degats-mecanismes-generiques.test';
import {
  testAttaqueAppeleeApprovisionnement,
  testAttaqueAppeleeCouverture,
  testAttaqueAppeleeEspaceDeCles,
} from './degats-attaque-appelee.test';
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
import { testListeExemplaires } from './liste-exemplaires.test';
import { testOptimizerExemplaireMontage } from './optimizer-exemplaire-montage.test';
import testOptimizerRecipeImportSelection from './optimizer-recipe-import-selection.test';
import testOptimizerDamageTransitions from './optimizer-damage-transitions.test';
import testOptimizerCriteresCaracterisation from './optimizer-criteres-caracterisation.test';
import { testLeaderSkillPaliersCorpus } from './leader-skill-paliers.test';
import { testOptimizerContenuListeCreationEtModification, testOptimizerEquipesHookModificationAvecOrpheline, testOptimizerContenuListeJsonEtAncienStockage, testOptimizerContenuListeSansContenu, verificationsOptimizerContenuListeElements, testOptimizerContenuListeRejetsConserves, testOptimizerContenuListeSuppressionEtSession, testOptimizerContenuListeImportPreserveEtCollisions } from './optimizer-list-content.test';
import { testOptimizerEquipesAjoutEquipeOrphelineNeBloquePasEquipeSaine, verificationsOptimizerEquipesActivite, verificationsOptimizerEquipesCardinalites, testOptimizerEquipesElementsEtLeadPersonnel, testOptimizerEquipesLeadsNonCalculablesEtHorsListe, testOptimizerEquipesOperationsEtExclusivite, testOptimizerEquipesRetraitEquipeDeDeux, testOptimizerEquipesCreationAvecOrphelines } from './optimizer-equipes.test';
import { testOptimizerCriteresPhotos, testOptimizerCriteresBase, testOptimizerCriteresGarde, testOptimizerCritereArtefactsNavigation } from './optimizer-criteres.test';
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
import testMigrationStockage from './migration-stockage.test';
import testBureauProtocole from './bureau-protocole.test';
import testBureauFenetre from './bureau-fenetre.test';
import testBureauMiseAJour from './bureau-mise-a-jour.test';
import testBureauSwex from './bureau-swex.test';
import testBureauSession from './bureau-session.test';
import testSession from './session.test';
import testVitesse from './vitesse.test';
import testSiegeStatut from './siege-statut.test';
import testSiegePastille from './siege-pastille.test';
import testSiegeSlotSuivant from './siege-slot-suivant.test';
import testRecoDefenses from './reco-defenses.test';
import testSiegePartage from './siege-partage.test';
import testMarque from './marque.test';
import testSpeedTune, { testSpeedTuneDeck, testSpeedTuneChaine, testSpeedTuneKit, testSpeedTuneSequence, testSpeedTuneReference, testSpeedTunePassif, testSpeedTuneAuto, testSpeedTuneModele } from './speed-tune.test';
import testSpecMarkdown from './spec-markdown.test';
import testSpecToc from './spec-toc.test';
import testSpecLint, { testSpecLintEnTetes, testSpecLintEnTetesReel, testSpecLintReel } from './spec-lint.test';
import { testRenduSiegeDefense, testRenduSiegeOffense, testRenduSiegeEnTete, testRenduSiegeEdition } from './rendu/siege.test';
import { testRenduUiBouton, testRenduUiEtats, testRenduUiMenu, testRenduUiNotification, testRenduPalette } from './rendu/ui.test';
import { testPalette } from './palette.test';
import { testRenduAppRoutes, testRenduAppNavigation, testRenduAppMobile, testRenduAppFil, testRenduAppLiensMorts } from './rendu/app.test';
import { testRenduAccueil, testRenduAccueilBureau, testRenduAccueilEspace } from './rendu/accueil.test';
import { testRenduTelecharger } from './rendu/telecharger.test';
import { testRenduBureauTextes } from './rendu/bureau-textes.test';
import { testRenduBarreSession } from './rendu/barre-session.test';
import { testRenduIcones } from './rendu/icones.test';
import { testRenduRecosPage, testRenduRecosEnTete, testRenduRecosDeploiement, testRenduRecosEdition, testRenduRecosVueDefense, testRenduRecosTicks, testRenduRecosAnnulerEdition } from './rendu/recos.test';
import testAnnulerEdition from './annuler-edition.test';
import { testRenduRunesResume, testRenduRunesListe, testRenduRunesCourbes, testRenduRunesComparaison, testRenduRunesOptimisation, testRenduRunesAVenir, testRenduRunesFiltresLigne, testRenduRunesTriOnglets, testRenduRunesResumeSouris, testRenduRunesListeSouris, testRenduRunesVuesSouris } from './rendu/runes.test';
import { testRenduCompteMonstres, testRenduCompteArtefactsResume, testRenduCompteArtefactsListe, testRenduCompteSouris, testRenduCompteEffacerFiltres } from './rendu/compte.test';
import { testRenduSpeedTuneVide, testRenduSpeedTuneCamps, testRenduSpeedTuneAnalyse } from './rendu/speed-tune.test';
import { testRenduOptimizerVide, testRenduOptimizerMonstre, testRenduOptimizerReglages, testRenduTelephoneOptimizer } from './rendu/optimizer.test';
import { testRenduMemoireOptimizerSelection, testRenduMemoireOptimizerIdentiteEnregistree, testRenduMemoireOptimizerSansMemoire, testRenduMemoireOptimizerListes,
  testRenduMemoireOptimizerRetrait, testRenduMemoireOptimizerInclusion, testRenduMemoireOptimizerHorsListe,
  testRenduMemoireOptimizerIdentite, testRenduMemoireOptimizerRecette, testRenduMemoireOptimizerNavigation, testRenduTelephoneMemoireOptimizer,
  testRenduMemoireOptimizerSaisies, testRenduMemoireOptimizerAutomatismes, testRenduMemoireOptimizerRappelAurasDestination,
  testRenduTelephoneMemoireOptimizerRappelAurasDestination, testRenduMemoireOptimizerZoneC, testRenduTelephoneMemoireOptimizerZoneC,
  testRenduMemoireOptimizerListeInactive, testRenduMemoireOptimizerRecetteSansSelection, testRenduMemoireOptimizerGlobauxAvantRestauration,
  testRenduMemoireOptimizerSourceRta, testRenduMemoireOptimizerSourceSiege, testRenduMemoireOptimizerClicAjouter,
  testRenduMemoireOptimizerClicValiderFiche, testRenduMemoireOptimizerClicValiderInclut,
  testRenduTelephoneMemoireOptimizerClicAjouter, testRenduTelephoneMemoireOptimizerClicValiderFiche,
  testRenduRattachementOptimizer, testRenduTelephoneRattachementOptimizer, testRenduRattachementOptimizerDemonte } from './rendu/optimizer-memoire.test';
import { testRenduBestiaire, testRenduMecaniques, testRenduNouveautes, testRenduParametres, testRenduBientot } from './rendu/ressources.test';
import { testRenduTelephoneAccueil, testRenduTelephoneRta, testRenduTelephoneRtaAmi, testRenduTelephoneRtaFiltre } from './rendu/telephone-accueil-rta.test';
import { testRenduTelephoneSiege, testRenduTelephoneRecos } from './rendu/telephone-siege.test';
import { testRenduTelephoneMonstres, testRenduTelephoneArtefacts, testRenduTelephoneRunes } from './rendu/telephone-compte.test';
import { testRenduTelephoneOutilsRessources } from './rendu/telephone-outils-ressources.test';
import { testRenduRtaPrepa, testRenduRtaMenu, testRenduRtaVide, testRenduRtaSauvegarde, testRenduRtaAmi, testRenduRtaIndicateur } from './rendu/rta.test';
import { testIndicateurSauvegarde } from './indicateur-sauvegarde.test';
import { testRestauration } from './restauration.test';
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
  ['testRenduMemoireOptimizerSelection', testRenduMemoireOptimizerSelection],
  ['testRenduMemoireOptimizerIdentiteEnregistree', testRenduMemoireOptimizerIdentiteEnregistree],
  ['testRenduRattachementOptimizer', testRenduRattachementOptimizer],
  ['testRenduTelephoneRattachementOptimizer', testRenduTelephoneRattachementOptimizer],
  ['testRenduRattachementOptimizerDemonte', testRenduRattachementOptimizerDemonte],
  ['testRenduMemoireOptimizerSansMemoire', testRenduMemoireOptimizerSansMemoire],
  ['testRenduMemoireOptimizerListes', testRenduMemoireOptimizerListes],
  ['testRenduMemoireOptimizerRetrait', testRenduMemoireOptimizerRetrait],
  ['testRenduMemoireOptimizerInclusion', testRenduMemoireOptimizerInclusion],
  ['testRenduMemoireOptimizerHorsListe', testRenduMemoireOptimizerHorsListe],
  ['testRenduMemoireOptimizerIdentite', testRenduMemoireOptimizerIdentite],
  ['testRenduMemoireOptimizerRecette', testRenduMemoireOptimizerRecette],
  ['testRenduMemoireOptimizerNavigation', testRenduMemoireOptimizerNavigation],
  ['testRenduTelephoneMemoireOptimizer', testRenduTelephoneMemoireOptimizer],
  ['testRenduMemoireOptimizerSaisies', testRenduMemoireOptimizerSaisies],
  ['testRenduMemoireOptimizerAutomatismes', testRenduMemoireOptimizerAutomatismes],
  ['testRenduMemoireOptimizerRappelAurasDestination', testRenduMemoireOptimizerRappelAurasDestination],
  ['testRenduTelephoneMemoireOptimizerRappelAurasDestination', testRenduTelephoneMemoireOptimizerRappelAurasDestination],
  ['testRenduMemoireOptimizerZoneC', testRenduMemoireOptimizerZoneC],
  ['testRenduTelephoneMemoireOptimizerZoneC', testRenduTelephoneMemoireOptimizerZoneC],
  ['testRenduMemoireOptimizerListeInactive', testRenduMemoireOptimizerListeInactive],
  ['testRenduMemoireOptimizerRecetteSansSelection', testRenduMemoireOptimizerRecetteSansSelection],
  ['testRenduMemoireOptimizerGlobauxAvantRestauration', testRenduMemoireOptimizerGlobauxAvantRestauration],
  ['testRenduMemoireOptimizerSourceRta', testRenduMemoireOptimizerSourceRta],
  ['testRenduMemoireOptimizerSourceSiege', testRenduMemoireOptimizerSourceSiege],
  ['testRenduMemoireOptimizerClicAjouter', testRenduMemoireOptimizerClicAjouter],
  ['testRenduMemoireOptimizerClicValiderFiche', testRenduMemoireOptimizerClicValiderFiche],
  ['testRenduMemoireOptimizerClicValiderInclut', testRenduMemoireOptimizerClicValiderInclut],
  ['testRenduTelephoneMemoireOptimizerClicAjouter', testRenduTelephoneMemoireOptimizerClicAjouter],
  ['testRenduTelephoneMemoireOptimizerClicValiderFiche', testRenduTelephoneMemoireOptimizerClicValiderFiche],
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
  ['testSiegePastille', testSiegePastille],
  ['testSiegeSlotSuivant', testSiegeSlotSuivant],
  ['testRecoDefenses', testRecoDefenses],
  ['testSiegePartage', testSiegePartage],
  ['testMarque', testMarque],
  ['testSpecMarkdown', testSpecMarkdown],
  ['testSpecToc', testSpecToc],
  ['testSpecLintEnTetes', testSpecLintEnTetes],
  ['testSpecLintEnTetesReel', testSpecLintEnTetesReel],
  ['testSpecLint', testSpecLint],
  ['testSpecLintReel', testSpecLintReel],
  ['testRenduSiegeDefense', testRenduSiegeDefense],
  ['testRenduSiegeOffense', testRenduSiegeOffense],
  ['testRenduSiegeEnTete', testRenduSiegeEnTete],
  ['testRenduSiegeEdition', testRenduSiegeEdition],
  ['testRenduRecosPage', testRenduRecosPage],
  ['testRenduRecosEnTete', testRenduRecosEnTete],
  ['testRenduRecosDeploiement', testRenduRecosDeploiement],
  ['testRenduRecosEdition', testRenduRecosEdition],
  ['testRenduRecosVueDefense', testRenduRecosVueDefense],
  ['testRenduRecosTicks', testRenduRecosTicks],
  ['testRenduRecosAnnulerEdition', testRenduRecosAnnulerEdition],
  ['testAnnulerEdition', testAnnulerEdition],
  ['testRenduRunesResume', testRenduRunesResume],
  ['testRenduRunesListe', testRenduRunesListe],
  ['testRenduRunesCourbes', testRenduRunesCourbes],
  ['testRenduRunesComparaison', testRenduRunesComparaison],
  ['testRenduRunesOptimisation', testRenduRunesOptimisation],
  ['testRenduRunesAVenir', testRenduRunesAVenir],
  ['testRenduRunesFiltresLigne', testRenduRunesFiltresLigne],
  ['testRenduRunesTriOnglets', testRenduRunesTriOnglets],
  ['testRenduRunesResumeSouris', testRenduRunesResumeSouris],
  ['testRenduRunesListeSouris', testRenduRunesListeSouris],
  ['testRenduRunesVuesSouris', testRenduRunesVuesSouris],
  ['testRenduCompteMonstres', testRenduCompteMonstres],
  ['testRenduCompteArtefactsResume', testRenduCompteArtefactsResume],
  ['testRenduCompteArtefactsListe', testRenduCompteArtefactsListe],
  ['testRenduCompteSouris', testRenduCompteSouris],
  ['testRenduCompteEffacerFiltres', testRenduCompteEffacerFiltres],
  ['testRenduSpeedTuneVide', testRenduSpeedTuneVide],
  ['testRenduSpeedTuneCamps', testRenduSpeedTuneCamps],
  ['testRenduSpeedTuneAnalyse', testRenduSpeedTuneAnalyse],
  ['testRenduOptimizerVide', testRenduOptimizerVide],
  ['testRenduOptimizerMonstre', testRenduOptimizerMonstre],
  ['testRenduOptimizerReglages', testRenduOptimizerReglages],
  ['testRenduTelephoneOptimizer', testRenduTelephoneOptimizer],
  ['testRenduBestiaire', testRenduBestiaire],
  ['testRenduMecaniques', testRenduMecaniques],
  ['testRenduNouveautes', testRenduNouveautes],
  ['testRenduParametres', testRenduParametres],
  ['testRenduBientot', testRenduBientot],
  ['testRenduTelephoneAccueil', testRenduTelephoneAccueil],
  ['testRenduTelephoneRta', testRenduTelephoneRta],
  ['testRenduTelephoneRtaAmi', testRenduTelephoneRtaAmi],
  ['testRenduTelephoneRtaFiltre', testRenduTelephoneRtaFiltre],
  ['testRenduTelephoneSiege', testRenduTelephoneSiege],
  ['testRenduTelephoneRecos', testRenduTelephoneRecos],
  ['testRenduTelephoneMonstres', testRenduTelephoneMonstres],
  ['testRenduTelephoneArtefacts', testRenduTelephoneArtefacts],
  ['testRenduTelephoneRunes', testRenduTelephoneRunes],
  ['testRenduTelephoneOutilsRessources', testRenduTelephoneOutilsRessources],
  ['testRenduUiBouton', testRenduUiBouton],
  ['testRenduUiEtats', testRenduUiEtats],
  ['testRenduUiMenu', testRenduUiMenu],
  ['testRenduUiNotification', testRenduUiNotification],
  ['testRenduPalette', testRenduPalette],
  ['testPalette', testPalette],
  ['testRenduAppRoutes', testRenduAppRoutes],
  ['testRenduAppNavigation', testRenduAppNavigation],
  ['testRenduAppMobile', testRenduAppMobile],
  ['testRenduAppFil', testRenduAppFil],
  ['testRenduAppLiensMorts', testRenduAppLiensMorts],
  ['testRenduAccueil', testRenduAccueil],
  ['testRenduAccueilEspace', testRenduAccueilEspace],
  ['testRenduAccueilBureau', testRenduAccueilBureau],
  ['testRenduTelecharger', testRenduTelecharger],
  ['testRenduBureauTextes', testRenduBureauTextes],
  ['testRenduBarreSession', testRenduBarreSession],
  ['testRenduIcones', testRenduIcones],
  ['testRenduRtaPrepa', testRenduRtaPrepa],
  ['testRenduRtaMenu', testRenduRtaMenu],
  ['testRenduRtaVide', testRenduRtaVide],
  ['testRenduRtaSauvegarde', testRenduRtaSauvegarde],
  ['testRenduRtaIndicateur', testRenduRtaIndicateur],
  ['testIndicateurSauvegarde', testIndicateurSauvegarde],
  ['testRestauration', testRestauration],
  ['testRenduRtaAmi', testRenduRtaAmi],
  ['testSkillAdapters', testSkillAdapters],
  ['testImport', testImport],
  ['testNavigation', testNavigation],
  ['testNavigationAdresses', testNavigationAdresses],
  ['testNavigationAdressesDefauts', testNavigationAdressesDefauts],
  ['testNavigationVuesCompte', testNavigationVuesCompte],
  ['testReco', testReco],
  ['testDefensesVisees', testDefensesVisees],
  ['testTrimPartage', testTrimPartage],
  ['testRechercheMonstre', testRechercheMonstre],
  ['testRechercheMultiple', testRechercheMultiple],
  ['testDecksMontables', testDecksMontables],
  ['testFormesJouables', testFormesJouables],
  ['testRtaPartage', testRtaPartage],
  ['testInstallerHooks', testInstallerHooks],
  ['testInstallationAutomatique', testInstallationAutomatique],
  ['testPreCommit', testPreCommit],
  ['testCommitMsg', testCommitMsg],
  ['testVerifierCommits', testVerifierCommits],
  ['testRenvoisFormes', testRenvoisFormes],
  ['testRenvois', testRenvois],
  ['testSetsIntangible', testSetsIntangible],
  ['testRuneTri', testRuneTri],
  ['testMonstreTri', testMonstreTri],
  ['testMonstreFormes', testMonstreFormes],
  ['testCouleursCourbes', testCouleursCourbes],
  ['testRechargement', testRechargement],
  ['testCollabPaires', testCollabPaires],
  ['testDegats', testDegats],
  ['testAuditDegatsConditionnels', testAuditDegatsConditionnels],
  ['testCritiqueMoyenneImport', testCritiqueMoyenneImport],
  ['testCritiqueMoyenneEcranEtCli', testCritiqueMoyenneEcranEtCli],
  ['testCritiqueMoyenneMessageImport', testCritiqueMoyenneMessageImport],
  ['testDegatsBladeSurge', testDegatsBladeSurge],
  ['testDegatsSequencesApi', testDegatsSequencesApi],
  ['testDegatsFormulesApi', testDegatsFormulesApi],
  ['testDegatsPorteesParLaProse', testDegatsPorteesParLaProse],
  ['testDegatsSortsSansAttaque', testDegatsSortsSansAttaque],
  ['testDegatsCoupsSaisis', testDegatsCoupsSaisis],
  ['testBornesStrictesDef', testBornesStrictesDef],
  ['testResumeConditionDef', testResumeConditionDef],
  ['testGarantieByungchul', testGarantieByungchul],
  ['testGarantieYujiRick', testGarantieYujiRick],
  ['testResumeConditionDebuff', testResumeConditionDebuff],
  ['testVitCiriBirgitta', testVitCiriBirgitta],
  ['testTheoniaAtqCible', testTheoniaAtqCible],
  ['testCouvertureGarantiesCritique', testCouvertureGarantiesCritique],
  ['testCouvertureBonusCritique', testCouvertureBonusCritique],
  ['testCouvertureIgnoreDefIdentifiants', testCouvertureIgnoreDefIdentifiants],
  ['testCouvertureVariablesFormule', testCouvertureVariablesFormule],
  ['testCouvertureConditionsSort', testCouvertureConditionsSort],
  ['testCouvertureStatsCombat', testCouvertureStatsCombat],
  ['testBladeSurgeRecette', testBladeSurgeRecette],
  ['testBladeSurgeEcran', testBladeSurgeEcran],
  ['testBladeSurgePariteEcranCli', testBladeSurgePariteEcranCli],
  ['testBladeSurgeResumeObjectif', testBladeSurgeResumeObjectif],
  ['testBladeSurgeLigneArtifactSearch', testBladeSurgeLigneArtifactSearch],
  ['testBladeDancersIgnoreDef', testBladeDancersIgnoreDef],
  ['testBladeDancersRecette', testBladeDancersRecette],
  ['testBladeDancersEcranEtCli', testBladeDancersEcranEtCli],
  ['testMecanismesSequenceDeCoups', testMecanismesSequenceDeCoups],
  ['testMecanismesAttaqueDeclenchee', testMecanismesAttaqueDeclenchee],
  ['testMecanismesIgnoreDefDepuisUnCoup', testMecanismesIgnoreDefDepuisUnCoup],
  ['testMecanismesPassifMasqueEtStatsDeCombat', testMecanismesPassifMasqueEtStatsDeCombat],
  ['testAttaqueAppeleeApprovisionnement', testAttaqueAppeleeApprovisionnement],
  ['testAttaqueAppeleeCouverture', testAttaqueAppeleeCouverture],
  ['testAttaqueAppeleeEspaceDeCles', testAttaqueAppeleeEspaceDeCles],
  ['testRecetteClesIdentifiant', testRecetteClesIdentifiant],
  ['testFormesEquivalentes', testFormesEquivalentes],
  ['testDegatsTempestFormule', testDegatsTempestFormule],
  ['testDegatsTempestDeclenchement', testDegatsTempestDeclenchement],
  ['testDegatsTempestCommeSort', testDegatsTempestCommeSort],
  ['testDegatsTempestRecette', testDegatsTempestRecette],
  ['testDegatsTempestEcran', testDegatsTempestEcran],
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
  ['testListeExemplaires', testListeExemplaires],
  ['testOptimizerExemplaireMontage', testOptimizerExemplaireMontage],
  ['testOptimizerRecipeImportSelection', testOptimizerRecipeImportSelection],
  ['testOptimizerDamageTransitions', testOptimizerDamageTransitions],
  ['testOptimizerCriteresCaracterisation', testOptimizerCriteresCaracterisation],
  ['testLeaderSkillPaliersCorpus', testLeaderSkillPaliersCorpus],
  ['testOptimizerContenuListeSansContenu', testOptimizerContenuListeSansContenu],
  ...verificationsOptimizerContenuListeElements,
  ['testOptimizerContenuListeImportPreserveEtCollisions', testOptimizerContenuListeImportPreserveEtCollisions],
  ...verificationsOptimizerEquipesActivite,
  ...verificationsImportEquipes,
  ...verificationsImportSpeedTune,
  ...verificationsImportReco,
  ...verificationsImportRecoCopies,
  ...verificationsOptimizerEquipesCardinalites,
  ['testOptimizerEquipesElementsEtLeadPersonnel', testOptimizerEquipesElementsEtLeadPersonnel],
  ['testOptimizerEquipesLeadsNonCalculablesEtHorsListe', testOptimizerEquipesLeadsNonCalculablesEtHorsListe],
  ['testOptimizerEquipesOperationsEtExclusivite', testOptimizerEquipesOperationsEtExclusivite],
  ['testOptimizerEquipesRetraitEquipeDeDeux', testOptimizerEquipesRetraitEquipeDeDeux],
  ['testOptimizerEquipesCreationAvecOrphelines', testOptimizerEquipesCreationAvecOrphelines],
  ['testOptimizerCriteresPhotos', testOptimizerCriteresPhotos],
  ['testOptimizerCriteresBase', testOptimizerCriteresBase],
  ['testOptimizerCriteresGarde', testOptimizerCriteresGarde],
  ['testOptimizerCritereArtefactsNavigation', testOptimizerCritereArtefactsNavigation],
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
  ['testProseStatsCombatPassifMasque', testProseStatsCombatPassifMasque],
  ['testBuffsDePassifTable', testBuffsDePassifTable],
  ['testBuffsDePassifRappel', testBuffsDePassifRappel],
  ['testBuffsDePassifEcran', testBuffsDePassifEcran],
  ['testCalculPartielTable', testCalculPartielTable],
  ['testCalculPartielAffichage', testCalculPartielAffichage],
  ['testCalculPartielEcran', testCalculPartielEcran],
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
  ['testGemmeMemeStat', testGemmeMemeStat],
  ['testRegemmeDifferent', testRegemmeDifferent],
  ['testReserveParGrade', testReserveParGrade],
  ['testPalier', testPalier],
  ['testMigrationStockage', testMigrationStockage],
  ['testBureauProtocole', testBureauProtocole],
  ['testBureauFenetre', testBureauFenetre],
  ['testBureauMiseAJour', testBureauMiseAJour],
  ['testBureauSwex', testBureauSwex],
  ['testBureauSession', async () => { await testBureauSession(); }],
  ['testSession', testSession],
  ['testStockage', async () => { await testStockage(); }],
  ['testPersistance', async () => { await testPersistance(); }],
  // ⚠️ APRÈS `testPersistance` : ces tests changent l'état du module
  // `usePersistence` (choix de conservation), partagé par tout le bundle, et
  // `testPersistance` exige un navigateur vierge.
  ['testMemoireOptimizerJson', testMemoireOptimizerJson],
  ['testOptimizerRattachementIdentites', testOptimizerRattachementIdentites],
  ['testOptimizerRattachementReferenceConservee', testOptimizerRattachementReferenceConservee],
  ...verificationsOptimizerRattachementOrdres,
  ['testOptimizerRattachementDepartageEtPrises', testOptimizerRattachementDepartageEtPrises],
  ['testOptimizerRattachementCopiesSansExemplaire', testOptimizerRattachementCopiesSansExemplaire],
  ['testOptimizerRattachementPermutationEtProprietaire', testOptimizerRattachementPermutationEtProprietaire],
  ['testOptimizerRattachementRuneVendue', testOptimizerRattachementRuneVendue],
  ['testOptimizerRattachementDefensesComplet', testOptimizerRattachementDefensesComplet],
  ['testOptimizerRattachementBranchement', testOptimizerRattachementBranchement],
  ['testMemoireOptimizerCopie', testMemoireOptimizerCopie],
  ['testMemoireOptimizerLecteurListes', testMemoireOptimizerLecteurListes],
  ['testMemoireOptimizerListesIllisibles', testMemoireOptimizerListesIllisibles],
  ['testMemoireOptimizerMalformed', testMemoireOptimizerMalformed],
  ['testEquipeOptimizerValidation', testEquipeOptimizerValidation],
  ['testMemoireOptimizerConservationSession', testMemoireOptimizerConservationSession],
  ['testSessionOptimizerVersionDeux', testSessionOptimizerVersionDeux],
  ['testMemoireOptimizerEffacement', testMemoireOptimizerEffacement],
  ['testMemoireOptimizerReimport', testMemoireOptimizerReimport],
  ['testMemoireOptimizerEspeceSelecteur', testMemoireOptimizerEspeceSelecteur],
  ['testMemoireOptimizerBranchement', testMemoireOptimizerBranchement],
  ['testEquipeOptimizerMembreRetire', testEquipeOptimizerMembreRetire],
  ['testMemoireOptimizerSuppressionExplicite', testMemoireOptimizerSuppressionExplicite],
  ['testMemoireOptimizerReimportBrutPreserve', testMemoireOptimizerReimportBrutPreserve],
  ['testEquipeOptimizerTextesStricts', testEquipeOptimizerTextesStricts],
  ['testMemoireOptimizerRejetsConserves', testMemoireOptimizerRejetsConserves],
  ['testMemoireOptimizerTextesCriteresStricts', testMemoireOptimizerTextesCriteresStricts],
  ['testOptimizerContenuListeJsonEtAncienStockage', testOptimizerContenuListeJsonEtAncienStockage],
  ['testOptimizerContenuListeRejetsConserves', testOptimizerContenuListeRejetsConserves],
  ['testOptimizerContenuListeSuppressionEtSession', testOptimizerContenuListeSuppressionEtSession],
  ['testOptimizerContenuListeCreationEtModification', testOptimizerContenuListeCreationEtModification],
  ['testRenduOptimizerLeadEquipePersonnel', testRenduOptimizerLeadEquipePersonnel],
  ['testRenduTelephoneOptimizerLeadEquipePersonnel', testRenduTelephoneOptimizerLeadEquipePersonnel],
  ['testRenduOptimizerDialogueEquipe', testRenduOptimizerDialogueEquipe],
  ['testRenduTelephoneOptimizerDialogueEquipe', testRenduTelephoneOptimizerDialogueEquipe],
  ['testRenduOptimizerCreationContenu', testRenduOptimizerCreationContenu],
  ['testRenduTelephoneOptimizerCreationContenu', testRenduTelephoneOptimizerCreationContenu],
  ['testRenduOptimizerRefusIdentitePerime', testRenduOptimizerRefusIdentitePerime],
  ['testRenduTelephoneOptimizerRefusIdentitePerime', testRenduTelephoneOptimizerRefusIdentitePerime],
  ['testOptimizerEquipesHookModificationAvecOrpheline', testOptimizerEquipesHookModificationAvecOrpheline],
  ['testOptimizerEquipesAjoutEquipeOrphelineNeBloquePasEquipeSaine', testOptimizerEquipesAjoutEquipeOrphelineNeBloquePasEquipeSaine],
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
  for (const [nom, fn] of liste) {
    debutVerification(nom);
    await fn();
  }

  const { total, echecs, ignores, echecsDetail } = bilan();
  if (echecsDetail.length > 0) {
    console.log('\n\x1b[31mÉchecs :\x1b[0m');
    for (const ligne of echecsDetail) console.log('  \x1b[31mKO\x1b[0m   ' + ligne);
  }
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
