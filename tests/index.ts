// Point d'entrée des vérifications — `npm test`.
//
// ⚠️ L'ORDRE compte un peu : `persistance` installe un faux `localStorage`
// global et le laisse en place. On le passe en dernier pour qu'il ne perturbe
// rien d'autre.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bilan, debutVerification } from './outils';
import { Execution, RefusManifeste } from './execution';
import { testRenduOptimizerAlerteDefilement, testRenduOptimizerAlerteCycleDeVie,
  testRenduTelephoneOptimizerAlerteCycleDeVie, testRenduTelephoneOptimizerAlerteFermetures } from './rendu/optimizer-alerte.test';
import { testRenduOptimizerBandesEquipesClair, testRenduOptimizerBandesEquipesSombre,
  testRenduTelephoneOptimizerBandesEquipesClair, testRenduTelephoneOptimizerBandesEquipesSombre,
  testOptimizerEquipesJetons } from './rendu/optimizer-bandes.test';
import testImport from './import.test';
import { verificationsImportEquipes } from './import-equipes.test';
import { testOptimizerImportNavigation } from './optimizer-import-navigation.test';
import { testRenduRtaExportOptimizer, testRenduTelephoneRtaExportOptimizer, testRenduRecoExportOptimizer,
  testRenduTelephoneRecoExportOptimizer, testRenduOptimizerImportRecommandation, testRenduTelephoneOptimizerImportRecommandation,
  testOptimizerImportRtaRecoBranchement } from './rendu/rta-reco-export.test';
import { testRenduSiegeExportOptimizer, testRenduTelephoneSiegeExportOptimizer, testOptimizerImportSiegeBranchement } from './rendu/siege-export.test';
import { testRenduSpeedTuneExportOptimizer, testRenduTelephoneSpeedTuneExportOptimizer, testOptimizerImportSpeedTuneBranchement, testRenduSpeedTuneExportAppOptimizer, testRenduTelephoneSpeedTuneExportAppOptimizer } from './rendu/speed-tune-export.test';
import { testOptimizerImportActionDemontee, testOptimizerImportEcrituresGroupees, testOptimizerImportReverificationEnAttente, testOptimizerImportCollision, testRenduOptimizerImportDefenses, testRenduTelephoneOptimizerImportDefenses,
  testRenduOptimizerImportOffense, testRenduTelephoneOptimizerImportOffense, testRenduOptimizerImportRta,
  testRenduTelephoneOptimizerImportRta, testRenduOptimizerImportIndisponible, testRenduTelephoneOptimizerImportIndisponible, testRenduOptimizerImportRapportPartage, testRenduOptimizerImportDisponibiliteMemoisee } from './rendu/optimizer-import.test';
import { testRenduOptimizerLeadEquipePersonnel, testRenduTelephoneOptimizerLeadEquipePersonnel,
  testRenduOptimizerDialogueEquipe, testRenduTelephoneOptimizerDialogueEquipe,
  testRenduOptimizerCreationContenu, testRenduTelephoneOptimizerCreationContenu,
  testRenduOptimizerRefusIdentitePerime, testRenduTelephoneOptimizerRefusIdentitePerime,
  testRenduOptimizerRecetteLeadEquipe, testRenduTelephoneOptimizerRecetteLeadEquipe,
  testRenduOptimizerLeadAncienHorsEquipe, testRenduTelephoneOptimizerLeadAncienHorsEquipe,
  testRenduOptimizerContenuSansDeplacement, testRenduTelephoneOptimizerContenuSansDeplacement,
  testRenduOptimizerLigneListe, testRenduTelephoneOptimizerLigneListe,
  testRenduOptimizerCombatEffectifAffiche, testRenduTelephoneOptimizerCombatEffectifAffiche } from './rendu/optimizer-equipes.test';
import { verificationsImportSpeedTune } from './import-speed-tune.test';
import { testRenduOptimizerPointGestes, testRenduTelephoneOptimizerPointGestes, testRenduOptimizerPointReimport,
  testRenduTelephoneOptimizerPointReimport, testRenduOptimizerPointCompteVide, testRenduTelephoneOptimizerPointCompteVide,
  testRenduOptimizerPointSansMemoireChangementListe, testRenduTelephoneOptimizerPointSansMemoireChangementListe,
  testRenduOptimizerPointSansMemoireListeSupprimee, testRenduTelephoneOptimizerPointSansMemoireListeSupprimee } from './rendu/optimizer-backup.test';
import { verificationsImportReco } from './import-reco.test';
import { verificationsImportRecoCopies } from './import-reco-copies.test';
import testNavigation from './navigation.test';
import testBancSelection from './banc-selection.test';
import { testNavigationAdresses, testNavigationAdressesDefauts, testNavigationVuesCompte } from './navigation-adresses.test';
import { testVoletsFeuilleTailwind, testVoletsLargeurs, testVoletsNavigation, testVoletsOuverture, testVoletsResponsive,
  testVoletsVerrou } from './volets.test';
import { testSuiviLecture, testSuiviTableau } from './suivi.test';
import testPersistance from './persistance.test';
import { testRenduOptimizerDialogueLeaderSkill, testRenduTelephoneOptimizerDialogueLeaderSkill,
  testRenduOptimizerDialogueLeaderEspece, testRenduTelephoneOptimizerDialogueLeaderEspece,
  testRenduOptimizerDialogueMembresDisponibles, testRenduTelephoneOptimizerDialogueMembresDisponibles,
  testRenduOptimizerDialogueDefilement, testRenduTelephoneOptimizerDialogueDefilement,
  testRenduOptimizerDialogueHauteur400, testRenduOptimizerDialogueHauteur600,
  testRenduOptimizerDialogueReferencesLeader, testRenduTelephoneOptimizerDialogueReferencesLeader,
  testRenduOptimizerDialogueChangementFormat } from './rendu/optimizer-dialogue.test';
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
import { testRappelDependances } from './rappel-dependances.test';
import { testVerifierCommits } from './verifier-commits.test';
import { testRenvois, testRenvoisFormes } from './renvois.test';
import { testLectureSource } from './lecture-source.test';
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
import { testDegatsSequencesApi, testDegatsSequencesAuxiliaire, testDegatsFormulesApi, testDegatsPorteesParLaProse } from './degats-valeurs-api.test';
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
import { testChargerMonstreParIdentifiant } from './charger-monstre-identifiant.test';
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
  testAttaqueAppeleeParSortCooperatif,
} from './degats-attaque-appelee.test';
import {
  testAttaquesConjointesRegle,
  testAttaquesConjointesPorte,
  testAttaquesConjointesCalcul,
  testAttaquesConjointesSortLanceParLeMonstre,
  testAttaquesConjointesTotalALaMain,
  testAttaquesConjointesChoixArtefacts,
} from './degats-attaques-conjointes.test';
import {
  testAttaquesConjointesRecetteChamp,
  testAttaquesConjointesRecetteTransitions,
  testAttaquesConjointesRecetteCli,
} from './attaques-conjointes-recette.test';
import testRuneOptim from './rune-optim.test';
import testRuneOptimDifferential from './rune-optim-differential.test';
import testBuildsRapides from './builds-rapides.test';
import { testRenduBuildsRapides } from './rendu/builds-rapides.test';
import testRuneOptimOnStage from './rune-optim-onstage.test';
import testRandomPool from './random-pool.test';
import testDiagnosticHarness, { testDiagnosticHarnessClassementDegatsReels } from './diagnostic-harness.test';
import testDiagnosticProfils from './diagnostic-profils.test';
import testDiagnosticDifferentiel from './diagnostic-differentiel.test';
import testDiagnosticDecouverte from './diagnostic-decouverte.test';
import testRuneOptimScaleMonotonicity from './rune-optim-scale-monotonicity.test';
import {
  testAppariementParallele, testAppariementParalleleWorkers, testAppariementParalleleCoupeWorkers, testAppariementParalleleBranchement, testAppariementParalleleCession,
} from './appariement-parallele.test';
import testAppariementRapide, { testAppariementHorloge } from './appariement-rapide.test';
import testValidationRapide from './validation-rapide.test';
import testRuneOptimNearMiss from './rune-optim-near-miss.test';
import testRuneOptimDeadHalfPruning from './rune-optim-dead-half-pruning.test';
import testFilterSlotTopK from './rune-optim-filterslot-topk.test';
import testConstructionRapide from './construction-rapide.test';
import testRetentionEmboitee from './retention-emboitee.test';
import testPrioriteStatsRetiree from './priorite-stats-retiree.test';
import testOptimizerExclusion from './optimizer-exclusion.test';
import { testListeExemplaires } from './liste-exemplaires.test';
import { testOptimizerCreationNomParDefaut } from './optimizer-list-names.test';
import { testOptimizerCompetencesContenu } from './optimizer-summoner-content.test';
import { testRenduOptimizerRechercheCreation, testRenduTelephoneOptimizerRechercheCreation } from './rendu/optimizer-equipes.test';
import { testRenduOptimizerCreationObligatoire, testRenduTelephoneOptimizerCreationObligatoire,
  testRenduOptimizerContenuInvocateur, testRenduTelephoneOptimizerContenuInvocateur,
  testRenduOptimizerEtatAurasEnLigne, testRenduTelephoneOptimizerEtatAurasEnLigne,
  testRenduOptimizerEnteteEquipeCompact, testRenduTelephoneOptimizerEnteteEquipeCompact,
  testRenduOptimizerDialogueElementVide, testRenduTelephoneOptimizerDialogueElementVide,
  testRenduOptimizerActionsZoneC, testRenduTelephoneOptimizerActionsZoneC } from './rendu/optimizer-retouches.test';
import { testOptimizerContenuInvocateurCompatibilite } from './optimizer-invocateur-compatibilite.test';
import { testRenduOptimizerEquipeImpossibleZeroLibre, testRenduTelephoneOptimizerEquipeImpossibleZeroLibre,
  testRenduOptimizerEquipeImpossibleUnLibre, testRenduTelephoneOptimizerEquipeImpossibleUnLibre,
  testRenduOptimizerEquipeImpossibleDeuxDontUnLie, testRenduTelephoneOptimizerEquipeImpossibleDeuxDontUnLie } from './rendu/optimizer-equipe-impossible.test';
import { testRenduOptimizerRechercheBoxResolu, testRenduTelephoneOptimizerRechercheBoxResolu,
  testRenduOptimizerRechercheDejaMembre, testRenduTelephoneOptimizerRechercheDejaMembre,
  testRenduOptimizerRechercheExemplaireSuivant, testRenduTelephoneOptimizerRechercheExemplaireSuivant } from './rendu/optimizer-recherche.test';
import { testRenduOptimizerRechercheSourceRta, testRenduTelephoneOptimizerRechercheSourceRta,
  testRenduOptimizerRechercheSourceSiege, testRenduTelephoneOptimizerRechercheSourceSiege,
  testRenduOptimizerRechercheDesambiguise, testRenduTelephoneOptimizerRechercheDesambiguise,
  testRenduOptimizerRechercheCreationSansSource, testRenduTelephoneOptimizerRechercheCreationSansSource,
  testRenduOptimizerRechercheNonPossede, testRenduTelephoneOptimizerRechercheNonPossede,
  testRenduOptimizerRechercheSansListeBox, testRenduTelephoneOptimizerRechercheSansListeBox } from './rendu/optimizer-recherche.test';
import { testRenduOptimizerEditionListe, testRenduTelephoneOptimizerEditionListe } from './rendu/optimizer-equipes.test';
import { testRenduOptimizerCompetencesListe, testRenduTelephoneOptimizerCompetencesListe } from './rendu/optimizer-equipes.test';
import { testOptimizerExemplaireMontage } from './optimizer-exemplaire-montage.test';
import testOptimizerRecipeImportSelection from './optimizer-recipe-import-selection.test';
import testOptimizerDamageTransitions from './optimizer-damage-transitions.test';
import testOptimizerCriteresCaracterisation from './optimizer-criteres-caracterisation.test';
import { testLeaderSkillPaliersCorpus } from './leader-skill-paliers.test';
import { testOptimizerContenuListeCreationEtModification, testOptimizerEquipesHookModificationAvecOrpheline, testOptimizerContenuListeJsonEtAncienStockage, testOptimizerContenuListeSansContenu, verificationsOptimizerContenuListeElements, testOptimizerContenuListeRejetsConserves, testOptimizerContenuListeSuppressionEtSession, testOptimizerContenuListeImportPreserveEtCollisions } from './optimizer-list-content.test';
import { testOptimizerEquipesAjoutEquipeOrphelineNeBloquePasEquipeSaine, verificationsOptimizerEquipesActivite, verificationsOptimizerEquipesCardinalites, testOptimizerEquipesElementsEtLeadPersonnel, testOptimizerEquipesSynchronisationLeadPersonnel, testOptimizerEquipesLeadsNonCalculablesEtHorsListe, testOptimizerEquipesOperationsEtExclusivite, testOptimizerEquipesRetraitEquipeDeDeux, testOptimizerEquipesCreationAvecOrphelines } from './optimizer-equipes.test';
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
import testReliqueOu from './relique-ou.test';
import testTestConjointExact from './test-conjoint-exact.test';
import testRelicQueue from './relic-queue.test';
import testResolutionRapide, { testResolutionRapideNaN } from './resolution-rapide.test';
import testMemoCombat from './memo-combat.test';
import testPerfRelicOptions from './perf-relic-options.test';
import testRelicDifferentiel from './relic-differentiel.test';
import testRelicUniqueLabel from './relic-unique-label.test';
import testRelicExclusive, { testDepartageReliquePortee, testRelicClassementParMode, testRelicReferenceComparer, testTriParStatSurLaFiche } from './relic-exclusive.test';
import testSetsIntangible from './sets-intangible.test';
import testRuneTri from './rune-tri.test';
import testMonstreTri from './monstre-tri.test';
import testMonstreFormes from './monstre-formes.test';
import testCurationFormesJouables from './curation-formes-jouables.test';
import testInventaireCompetences from './inventaire-competences.test';
import testDonneesAuxiliaires from './donnees-auxiliaires.test';
import testDegatsAutreForme from './degats-autre-forme.test';
import testDegatsAttaquesAuxiliaires from './degats-attaques-auxiliaires.test';
import testStockage from './stockage.test';
import testMigrationStockage from './migration-stockage.test';
import testBureauProtocole from './bureau-protocole.test';
import testBureauFenetre from './bureau-fenetre.test';
import testBureauMiseAJour from './bureau-mise-a-jour.test';
import testBureauSwex from './bureau-swex.test';
import testBureauSession from './bureau-session.test';
import testBureauCoeurs from './bureau-coeurs.test';
import testSession from './session.test';
import { testOptimizerPointAllerRetourComplet, testOptimizerPointMemoireMemeGeste, testOptimizerPointLectureDefensive, testOptimizerPointSessionRelue,
  testOptimizerPointRepriseRattachement, testOptimizerPointRepriseCompteVide, testOptimizerPointSuppressionConservation,
  testOptimizerPointSessionIllisibleConserve } from './optimizer-backup.test';
import testVitesse from './vitesse.test';
import testSiegeStatut from './siege-statut.test';
import testSiegePastille from './siege-pastille.test';
import testSiegeSlotSuivant from './siege-slot-suivant.test';
import testRecoDefenses from './reco-defenses.test';
import testSiegePartage from './siege-partage.test';
import testMarque from './marque.test';
import testSpeedTune, { testSpeedTuneDeck, testSpeedTuneChaine, testSpeedTuneKit, testSpeedTuneSequence, testSpeedTuneReference, testSpeedTunePassif, testSpeedTuneAuto, testSpeedTuneModele } from './speed-tune.test';
import { testRenduSiegeDefense, testRenduSiegeOffense, testRenduSiegeEnTete, testRenduSiegeEdition } from './rendu/siege.test';
import { testRenduUiBouton, testRenduUiEtats, testRenduUiMenu, testRenduUiNotification, testRenduPalette } from './rendu/ui.test';
import { testPalette } from './palette.test';
import { testRenduAppRoutes, testRenduAppNavigation, testRenduAppMobile, testRenduAppFil, testRenduAppLiensMorts } from './rendu/app.test';
import { testEcranPartageMediaQueryVolet, testEcranPartageMemePage, testRenduEcranPartageApp,
  testRenduEcranPartageBarre, testRenduEcranPartageBouton, testRenduEcranPartageSelecteur,
  testRenduEcranPartageSeparateur, testRenduEcranPartageVolet } from './rendu/ecran-partage.test';
import { testRenduAccueil, testRenduAccueilBureau, testRenduAccueilEspace } from './rendu/accueil.test';
import { testRenduTelecharger } from './rendu/telecharger.test';
import { testRenduBureauTextes } from './rendu/bureau-textes.test';
import { testRenduBureauCoeursRecherche } from './rendu/recherche-coeurs.test';
import { testRenduBarreSession } from './rendu/barre-session.test';
import { testRenduIcones } from './rendu/icones.test';
import { testRenduAttaqueConjointeEcran } from './rendu/attaque-conjointe-ecran.test';
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
import { testAlignementVersion } from './alignement-version.test';
import { testRenduTelephoneAccueil, testRenduTelephoneRta, testRenduTelephoneRtaAmi, testRenduTelephoneRtaFiltre } from './rendu/telephone-accueil-rta.test';
import { testRenduTelephoneSiege, testRenduTelephoneRecos } from './rendu/telephone-siege.test';
import { testRenduTelephoneMonstres, testRenduTelephoneArtefacts, testRenduTelephoneRunes } from './rendu/telephone-compte.test';
import { testRenduTelephoneOutilsRessources } from './rendu/telephone-outils-ressources.test';
import { testRenduRtaPrepa, testRenduRtaMenu, testRenduRtaVide, testRenduRtaSauvegarde, testRenduRtaAmi, testRenduRtaIndicateur } from './rendu/rta.test';
import { testIndicateurSauvegarde } from './indicateur-sauvegarde.test';
import { testRestauration } from './restauration.test';
import testSkillAdapters from './skill-adapters.test';
import { testSelectionFichiersInventaire, testSelectionFichiersChargeur, testSelectionFichiersCasReels, testSelectionFichiersTailwind, testSelectionFichiersGit } from './selection.test';
import { testExecutionProuveeCas, testExecutionProuveeEmplacement, testExecutionProuveePointEntree } from './execution.test';

// Chaque vérification sous son NOM, dans l'ordre d'exécution.
//
// ⚠️ L'ORDRE compte un peu (voir plus haut) : `persistance` reste en dernier.
//
// Ce registre permet de ne lancer QUE ce qu'on touche :
//     node tests/run.mjs speed-tune       (tout ce dont le nom contient « speedtune »)
//     node tests/run.mjs rune-optim vitesse
//     node tests/run.mjs --depuis main     (ce que touchent les fichiers modifiés : tests/selection.ts)
// Sans argument, tout tourne — c'est ce que fait `npm test`, et ce qu'il FAUT
// faire avant une fusion sur `main` (voir CLAUDE.md).
const VERIFICATIONS: [string, () => void | Promise<void>][] = [
  ['testRenduOptimizerCreationObligatoire', testRenduOptimizerCreationObligatoire],
  ['testRenduOptimizerEquipeImpossibleZeroLibre', testRenduOptimizerEquipeImpossibleZeroLibre],
  ['testRenduTelephoneOptimizerEquipeImpossibleZeroLibre', testRenduTelephoneOptimizerEquipeImpossibleZeroLibre],
  ['testRenduOptimizerEquipeImpossibleUnLibre', testRenduOptimizerEquipeImpossibleUnLibre],
  ['testRenduTelephoneOptimizerEquipeImpossibleUnLibre', testRenduTelephoneOptimizerEquipeImpossibleUnLibre],
  ['testRenduOptimizerEquipeImpossibleDeuxDontUnLie', testRenduOptimizerEquipeImpossibleDeuxDontUnLie],
  ['testRenduTelephoneOptimizerEquipeImpossibleDeuxDontUnLie', testRenduTelephoneOptimizerEquipeImpossibleDeuxDontUnLie],
  ['testRenduOptimizerActionsZoneC', testRenduOptimizerActionsZoneC],
  ['testRenduTelephoneOptimizerActionsZoneC', testRenduTelephoneOptimizerActionsZoneC],
  ['testRenduOptimizerDialogueElementVide', testRenduOptimizerDialogueElementVide],
  ['testRenduTelephoneOptimizerDialogueElementVide', testRenduTelephoneOptimizerDialogueElementVide],
  ['testRenduOptimizerEnteteEquipeCompact', testRenduOptimizerEnteteEquipeCompact],
  ['testRenduTelephoneOptimizerEnteteEquipeCompact', testRenduTelephoneOptimizerEnteteEquipeCompact],
  ['testRenduOptimizerEtatAurasEnLigne', testRenduOptimizerEtatAurasEnLigne],
  ['testRenduTelephoneOptimizerEtatAurasEnLigne', testRenduTelephoneOptimizerEtatAurasEnLigne],
  ['testOptimizerContenuInvocateurCompatibilite', testOptimizerContenuInvocateurCompatibilite],
  ['testRenduOptimizerContenuInvocateur', testRenduOptimizerContenuInvocateur],
  ['testRenduTelephoneOptimizerContenuInvocateur', testRenduTelephoneOptimizerContenuInvocateur],
  ['testRenduTelephoneOptimizerCreationObligatoire', testRenduTelephoneOptimizerCreationObligatoire],
  ['testRenduOptimizerRechercheSourceRta', testRenduOptimizerRechercheSourceRta],
  ['testRenduTelephoneOptimizerRechercheSourceRta', testRenduTelephoneOptimizerRechercheSourceRta],
  ['testRenduOptimizerRechercheSourceSiege', testRenduOptimizerRechercheSourceSiege],
  ['testRenduTelephoneOptimizerRechercheSourceSiege', testRenduTelephoneOptimizerRechercheSourceSiege],
  ['testRenduOptimizerRechercheDesambiguise', testRenduOptimizerRechercheDesambiguise],
  ['testRenduTelephoneOptimizerRechercheDesambiguise', testRenduTelephoneOptimizerRechercheDesambiguise],
  ['testRenduOptimizerRechercheCreationSansSource', testRenduOptimizerRechercheCreationSansSource],
  ['testRenduTelephoneOptimizerRechercheCreationSansSource', testRenduTelephoneOptimizerRechercheCreationSansSource],
  ['testRenduOptimizerRechercheNonPossede', testRenduOptimizerRechercheNonPossede],
  ['testRenduTelephoneOptimizerRechercheNonPossede', testRenduTelephoneOptimizerRechercheNonPossede],
  ['testRenduOptimizerRechercheSansListeBox', testRenduOptimizerRechercheSansListeBox],
  ['testRenduTelephoneOptimizerRechercheSansListeBox', testRenduTelephoneOptimizerRechercheSansListeBox],
  ['testRenduOptimizerRechercheBoxResolu', testRenduOptimizerRechercheBoxResolu],
  ['testRenduTelephoneOptimizerRechercheBoxResolu', testRenduTelephoneOptimizerRechercheBoxResolu],
  ['testRenduOptimizerRechercheDejaMembre', testRenduOptimizerRechercheDejaMembre],
  ['testRenduTelephoneOptimizerRechercheDejaMembre', testRenduTelephoneOptimizerRechercheDejaMembre],
  ['testRenduOptimizerRechercheExemplaireSuivant', testRenduOptimizerRechercheExemplaireSuivant],
  ['testRenduTelephoneOptimizerRechercheExemplaireSuivant', testRenduTelephoneOptimizerRechercheExemplaireSuivant],
  ['testOptimizerCompetencesContenu', testOptimizerCompetencesContenu],
  ['testRenduOptimizerRechercheCreation', testRenduOptimizerRechercheCreation],
  ['testRenduTelephoneOptimizerRechercheCreation', testRenduTelephoneOptimizerRechercheCreation],
  ['testRenduOptimizerEditionListe', testRenduOptimizerEditionListe],
  ['testRenduTelephoneOptimizerEditionListe', testRenduTelephoneOptimizerEditionListe],
  ['testRenduOptimizerCompetencesListe', testRenduOptimizerCompetencesListe],
  ['testRenduTelephoneOptimizerCompetencesListe', testRenduTelephoneOptimizerCompetencesListe],
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
  ['testAlignementVersion', testAlignementVersion],
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
  ['testRenduEcranPartageVolet', testRenduEcranPartageVolet],
  ['testRenduEcranPartageBarre', testRenduEcranPartageBarre],
  ['testRenduEcranPartageSeparateur', testRenduEcranPartageSeparateur],
  ['testRenduEcranPartageBouton', testRenduEcranPartageBouton],
  ['testRenduEcranPartageSelecteur', testRenduEcranPartageSelecteur],
  ['testRenduEcranPartageApp', testRenduEcranPartageApp],
  ['testEcranPartageMemePage', testEcranPartageMemePage],
  ['testEcranPartageMediaQueryVolet', testEcranPartageMediaQueryVolet],
  ['testRenduAppLiensMorts', testRenduAppLiensMorts],
  ['testRenduAccueil', testRenduAccueil],
  ['testRenduAccueilEspace', testRenduAccueilEspace],
  ['testRenduAccueilBureau', testRenduAccueilBureau],
  ['testRenduTelecharger', testRenduTelecharger],
  ['testRenduBureauTextes', testRenduBureauTextes],
  ['testRenduBureauCoeursRecherche', testRenduBureauCoeursRecherche],
  ['testRenduBarreSession', testRenduBarreSession],
  ['testRenduIcones', testRenduIcones],
  ['testRenduAttaqueConjointeEcran', testRenduAttaqueConjointeEcran],
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
  ['testBancSelection', testBancSelection],
  ['testNavigation', testNavigation],
  ['testNavigationAdresses', testNavigationAdresses],
  ['testNavigationAdressesDefauts', testNavigationAdressesDefauts],
  ['testNavigationVuesCompte', testNavigationVuesCompte],
  ['testVoletsOuverture', testVoletsOuverture],
  ['testVoletsNavigation', testVoletsNavigation],
  ['testVoletsVerrou', testVoletsVerrou],
  ['testVoletsLargeurs', testVoletsLargeurs],
  ['testVoletsResponsive', testVoletsResponsive],
  ['testVoletsFeuilleTailwind', testVoletsFeuilleTailwind],
  ['testSuiviLecture', testSuiviLecture],
  ['testSuiviTableau', testSuiviTableau],
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
  ['testRappelDependances', testRappelDependances],
  ['testVerifierCommits', testVerifierCommits],
  ['testRenvoisFormes', testRenvoisFormes],
  ['testRenvois', testRenvois],
  ['testLectureSource', testLectureSource],
  ['testSetsIntangible', testSetsIntangible],
  ['testRuneTri', testRuneTri],
  ['testMonstreTri', testMonstreTri],
  ['testMonstreFormes', testMonstreFormes],
  ['testCurationFormesJouables', testCurationFormesJouables],
  ['testInventaireCompetences', testInventaireCompetences],
  ['testDonneesAuxiliaires', testDonneesAuxiliaires],
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
  ['testDegatsSequencesAuxiliaire', testDegatsSequencesAuxiliaire],
  ['testDegatsAutreForme', testDegatsAutreForme],
  ['testDegatsAttaquesAuxiliaires', testDegatsAttaquesAuxiliaires],
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
  ['testAttaqueAppeleeParSortCooperatif', testAttaqueAppeleeParSortCooperatif],
  ['testAttaquesConjointesRegle', testAttaquesConjointesRegle],
  ['testAttaquesConjointesPorte', testAttaquesConjointesPorte],
  ['testAttaquesConjointesCalcul', testAttaquesConjointesCalcul],
  ['testAttaquesConjointesSortLanceParLeMonstre', testAttaquesConjointesSortLanceParLeMonstre],
  ['testAttaquesConjointesTotalALaMain', testAttaquesConjointesTotalALaMain],
  ['testAttaquesConjointesChoixArtefacts', testAttaquesConjointesChoixArtefacts],
  ['testAttaquesConjointesRecetteChamp', testAttaquesConjointesRecetteChamp],
  ['testAttaquesConjointesRecetteTransitions', testAttaquesConjointesRecetteTransitions],
  ['testAttaquesConjointesRecetteCli', testAttaquesConjointesRecetteCli],
  ['testRecetteClesIdentifiant', testRecetteClesIdentifiant],
  ['testChargerMonstreParIdentifiant', testChargerMonstreParIdentifiant],
  ['testFormesEquivalentes', testFormesEquivalentes],
  ['testDegatsTempestFormule', testDegatsTempestFormule],
  ['testDegatsTempestDeclenchement', testDegatsTempestDeclenchement],
  ['testDegatsTempestCommeSort', testDegatsTempestCommeSort],
  ['testDegatsTempestRecette', testDegatsTempestRecette],
  ['testDegatsTempestEcran', testDegatsTempestEcran],
  ['testRuneOptim', testRuneOptim],
  ['testRuneOptimDifferential', testRuneOptimDifferential],
  ['testBuildsRapides', testBuildsRapides],
  ['testRenduBuildsRapides', testRenduBuildsRapides],
  ['testRuneOptimOnStage', testRuneOptimOnStage],
  ['testRandomPool', testRandomPool],
  ['testDiagnosticHarness', async () => { await testDiagnosticHarness(); }],
  ['testDiagnosticHarnessClassementDegatsReels', testDiagnosticHarnessClassementDegatsReels],
  ['testDiagnosticProfils', async () => { await testDiagnosticProfils(); }],
  ['testDiagnosticDifferentiel', async () => { await testDiagnosticDifferentiel(); }],
  ['testDiagnosticDecouverte', async () => { await testDiagnosticDecouverte(); }],
  ['testRuneOptimScaleMonotonicity', testRuneOptimScaleMonotonicity],
  ['testAppariementParallele', async () => { await testAppariementParallele(); }],
  ['testAppariementParalleleWorkers', async () => { await testAppariementParalleleWorkers(); }],
  ['testAppariementParalleleCoupeWorkers', async () => { await testAppariementParalleleCoupeWorkers(); }],
  ['testAppariementParalleleBranchement', async () => { await testAppariementParalleleBranchement(); }],
  ['testAppariementParalleleCession', async () => { await testAppariementParalleleCession(); }],
  ['testAppariementRapide', async () => { await testAppariementRapide(); }],
  ['testAppariementHorloge', testAppariementHorloge],
  ['testValidationRapide', async () => { await testValidationRapide(); }],
  ['testRuneOptimNearMiss', async () => { await testRuneOptimNearMiss(); }],
  ['testRuneOptimDeadHalfPruning', testRuneOptimDeadHalfPruning],
  ['testFilterSlotTopK', testFilterSlotTopK],
  ['testConstructionRapide', testConstructionRapide],
  ['testRetentionEmboitee', async () => { await testRetentionEmboitee(); }],
  ['testPrioriteStatsRetiree', testPrioriteStatsRetiree],
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
  ['testOptimizerEquipesSynchronisationLeadPersonnel', testOptimizerEquipesSynchronisationLeadPersonnel],
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
  ['testReliqueOu', testReliqueOu],
  ['testTestConjointExact', testTestConjointExact],
  ['testRelicQueue', testRelicQueue],
  ['testResolutionRapide', testResolutionRapide],
  ['testResolutionRapideNaN', testResolutionRapideNaN],
  ['testMemoCombat', testMemoCombat],
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
  ['testBureauCoeurs', async () => { await testBureauCoeurs(); }],
  ['testSession', testSession],
  ['testStockage', async () => { await testStockage(); }],
  ['testPersistance', async () => { await testPersistance(); }],
  ['testOptimizerImportActionDemontee', testOptimizerImportActionDemontee],
  ['testOptimizerImportNavigation', testOptimizerImportNavigation],
  ['testOptimizerImportRtaRecoBranchement', testOptimizerImportRtaRecoBranchement],
  ['testRenduRtaExportOptimizer', testRenduRtaExportOptimizer],
  ['testRenduTelephoneRtaExportOptimizer', testRenduTelephoneRtaExportOptimizer],
  ['testRenduRecoExportOptimizer', testRenduRecoExportOptimizer],
  ['testRenduTelephoneRecoExportOptimizer', testRenduTelephoneRecoExportOptimizer],
  ['testRenduOptimizerImportRecommandation', testRenduOptimizerImportRecommandation],
  ['testRenduTelephoneOptimizerImportRecommandation', testRenduTelephoneOptimizerImportRecommandation],
  ['testOptimizerImportSiegeBranchement', testOptimizerImportSiegeBranchement],
  ['testRenduSiegeExportOptimizer', testRenduSiegeExportOptimizer],
  ['testRenduTelephoneSiegeExportOptimizer', testRenduTelephoneSiegeExportOptimizer],
  ['testOptimizerImportSpeedTuneBranchement', testOptimizerImportSpeedTuneBranchement],
  ['testRenduSpeedTuneExportOptimizer', testRenduSpeedTuneExportOptimizer],
  ['testRenduTelephoneSpeedTuneExportOptimizer', testRenduTelephoneSpeedTuneExportOptimizer],
  ['testRenduSpeedTuneExportAppOptimizer', testRenduSpeedTuneExportAppOptimizer],
  ['testRenduTelephoneSpeedTuneExportAppOptimizer', testRenduTelephoneSpeedTuneExportAppOptimizer],
  ['testOptimizerImportEcrituresGroupees', testOptimizerImportEcrituresGroupees],
  ['testOptimizerImportReverificationEnAttente', testOptimizerImportReverificationEnAttente],
  ['testOptimizerImportCollision', testOptimizerImportCollision],
  ['testRenduOptimizerImportDefenses', testRenduOptimizerImportDefenses],
  ['testRenduTelephoneOptimizerImportDefenses', testRenduTelephoneOptimizerImportDefenses],
  ['testRenduOptimizerImportOffense', testRenduOptimizerImportOffense],
  ['testRenduTelephoneOptimizerImportOffense', testRenduTelephoneOptimizerImportOffense],
  ['testRenduOptimizerImportRta', testRenduOptimizerImportRta],
  ['testRenduTelephoneOptimizerImportRta', testRenduTelephoneOptimizerImportRta],
  ['testRenduOptimizerImportIndisponible', testRenduOptimizerImportIndisponible],
  ['testRenduTelephoneOptimizerImportIndisponible', testRenduTelephoneOptimizerImportIndisponible],
  ['testRenduOptimizerImportRapportPartage', testRenduOptimizerImportRapportPartage],
  ['testRenduOptimizerImportDisponibiliteMemoisee', testRenduOptimizerImportDisponibiliteMemoisee],
  // ⚠️ APRÈS `testPersistance` : ces tests changent l'état du module
  // `usePersistence` (choix de conservation), partagé par tout le bundle, et
  // `testPersistance` exige un navigateur vierge.
  ['testOptimizerCreationNomParDefaut', testOptimizerCreationNomParDefaut],
  ['testOptimizerPointAllerRetourComplet', testOptimizerPointAllerRetourComplet],
  ['testOptimizerPointMemoireMemeGeste', testOptimizerPointMemoireMemeGeste],
  ['testOptimizerPointLectureDefensive', testOptimizerPointLectureDefensive],
  ['testOptimizerPointSessionRelue', testOptimizerPointSessionRelue],
  ['testOptimizerPointSessionIllisibleConserve', testOptimizerPointSessionIllisibleConserve],
  ['testOptimizerPointRepriseRattachement', testOptimizerPointRepriseRattachement],
  ['testOptimizerPointRepriseCompteVide', testOptimizerPointRepriseCompteVide],
  ['testOptimizerPointSuppressionConservation', testOptimizerPointSuppressionConservation],
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
  ['testRenduOptimizerDialogueLeaderSkill', testRenduOptimizerDialogueLeaderSkill],
  ['testRenduTelephoneOptimizerDialogueLeaderSkill', testRenduTelephoneOptimizerDialogueLeaderSkill],
  ['testRenduOptimizerDialogueLeaderEspece', testRenduOptimizerDialogueLeaderEspece],
  ['testRenduTelephoneOptimizerDialogueLeaderEspece', testRenduTelephoneOptimizerDialogueLeaderEspece],
  ['testRenduOptimizerDialogueMembresDisponibles', testRenduOptimizerDialogueMembresDisponibles],
  ['testRenduTelephoneOptimizerDialogueMembresDisponibles', testRenduTelephoneOptimizerDialogueMembresDisponibles],
  ['testRenduOptimizerDialogueDefilement', testRenduOptimizerDialogueDefilement],
  ['testRenduTelephoneOptimizerDialogueDefilement', testRenduTelephoneOptimizerDialogueDefilement],
  ['testRenduOptimizerDialogueHauteur400', testRenduOptimizerDialogueHauteur400],
  ['testRenduOptimizerDialogueHauteur600', testRenduOptimizerDialogueHauteur600],
  ['testRenduOptimizerDialogueReferencesLeader', testRenduOptimizerDialogueReferencesLeader],
  ['testRenduTelephoneOptimizerDialogueReferencesLeader', testRenduTelephoneOptimizerDialogueReferencesLeader],
  ['testRenduOptimizerDialogueChangementFormat', testRenduOptimizerDialogueChangementFormat],
  ['testRenduOptimizerCreationContenu', testRenduOptimizerCreationContenu],
  ['testRenduTelephoneOptimizerCreationContenu', testRenduTelephoneOptimizerCreationContenu],
  ['testRenduOptimizerRefusIdentitePerime', testRenduOptimizerRefusIdentitePerime],
  ['testRenduTelephoneOptimizerRefusIdentitePerime', testRenduTelephoneOptimizerRefusIdentitePerime],
  ['testRenduOptimizerRecetteLeadEquipe', testRenduOptimizerRecetteLeadEquipe],
  ['testRenduTelephoneOptimizerRecetteLeadEquipe', testRenduTelephoneOptimizerRecetteLeadEquipe],
  ['testRenduOptimizerLeadAncienHorsEquipe', testRenduOptimizerLeadAncienHorsEquipe],
  ['testRenduTelephoneOptimizerLeadAncienHorsEquipe', testRenduTelephoneOptimizerLeadAncienHorsEquipe],
  ['testRenduOptimizerContenuSansDeplacement', testRenduOptimizerContenuSansDeplacement],
  ['testRenduTelephoneOptimizerContenuSansDeplacement', testRenduTelephoneOptimizerContenuSansDeplacement],
  ['testRenduOptimizerLigneListe', testRenduOptimizerLigneListe],
  ['testRenduTelephoneOptimizerLigneListe', testRenduTelephoneOptimizerLigneListe],
  ['testRenduOptimizerCombatEffectifAffiche', testRenduOptimizerCombatEffectifAffiche],
  ['testRenduTelephoneOptimizerCombatEffectifAffiche', testRenduTelephoneOptimizerCombatEffectifAffiche],
  ['testOptimizerEquipesJetons', testOptimizerEquipesJetons],
  ['testRenduOptimizerBandesEquipesClair', testRenduOptimizerBandesEquipesClair],
  ['testRenduOptimizerBandesEquipesSombre', testRenduOptimizerBandesEquipesSombre],
  ['testRenduTelephoneOptimizerBandesEquipesClair', testRenduTelephoneOptimizerBandesEquipesClair],
  ['testRenduTelephoneOptimizerBandesEquipesSombre', testRenduTelephoneOptimizerBandesEquipesSombre],
  ['testRenduOptimizerAlerteDefilement', testRenduOptimizerAlerteDefilement],
  ['testRenduOptimizerAlerteCycleDeVie', testRenduOptimizerAlerteCycleDeVie],
  ['testRenduTelephoneOptimizerAlerteCycleDeVie', testRenduTelephoneOptimizerAlerteCycleDeVie],
  ['testRenduTelephoneOptimizerAlerteFermetures', testRenduTelephoneOptimizerAlerteFermetures],
  ['testRenduOptimizerPointGestes', testRenduOptimizerPointGestes],
  ['testRenduTelephoneOptimizerPointGestes', testRenduTelephoneOptimizerPointGestes],
  ['testRenduOptimizerPointReimport', testRenduOptimizerPointReimport],
  ['testRenduTelephoneOptimizerPointReimport', testRenduTelephoneOptimizerPointReimport],
  ['testRenduOptimizerPointCompteVide', testRenduOptimizerPointCompteVide],
  ['testRenduTelephoneOptimizerPointCompteVide', testRenduTelephoneOptimizerPointCompteVide],
  ['testRenduOptimizerPointSansMemoireChangementListe', testRenduOptimizerPointSansMemoireChangementListe],
  ['testRenduTelephoneOptimizerPointSansMemoireChangementListe', testRenduTelephoneOptimizerPointSansMemoireChangementListe],
  ['testRenduOptimizerPointSansMemoireListeSupprimee', testRenduOptimizerPointSansMemoireListeSupprimee],
  ['testRenduTelephoneOptimizerPointSansMemoireListeSupprimee', testRenduTelephoneOptimizerPointSansMemoireListeSupprimee],
  ['testOptimizerEquipesHookModificationAvecOrpheline', testOptimizerEquipesHookModificationAvecOrpheline],
  ['testOptimizerEquipesAjoutEquipeOrphelineNeBloquePasEquipeSaine', testOptimizerEquipesAjoutEquipeOrphelineNeBloquePasEquipeSaine],
  ['testSelectionFichiersInventaire', testSelectionFichiersInventaire],
  ['testSelectionFichiersChargeur', testSelectionFichiersChargeur],
  ['testSelectionFichiersCasReels', testSelectionFichiersCasReels],
  ['testSelectionFichiersTailwind', testSelectionFichiersTailwind],
  ['testSelectionFichiersGit', testSelectionFichiersGit],
  ['testExecutionProuveeCas', testExecutionProuveeCas],
  ['testExecutionProuveeEmplacement', testExecutionProuveeEmplacement],
  ['testExecutionProuveePointEntree', testExecutionProuveePointEntree],
];

// Un filtre passé en argument : on compare sur le nom mis à plat (sans tirets ni
// casse), pour que « speed-tune », « speedtune » et « SpeedTune » marchent tous.
function retenues(filtres: string[]): [string, () => void | Promise<void>][] {
  if (filtres.length === 0) return VERIFICATIONS;
  const plat = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cibles = filtres.map(plat);
  return VERIFICATIONS.filter(([nom]) => cibles.some((c) => plat(nom).includes(c)));
}

// Options à valeur : leur valeur n'est pas un filtre.
const OPTIONS_A_VALEUR = new Set(['--selection', '--manifeste']);

function lireArguments(args: string[]): { filtres: string[]; selection: string | null; manifeste: string | null } {
  const filtres: string[] = [];
  const valeurs = new Map<string, string | null>();
  for (let i = 0; i < args.length; i++) {
    if (OPTIONS_A_VALEUR.has(args[i])) { valeurs.set(args[i], args[i + 1] ?? null); i++; continue; }
    if (!args[i].startsWith('-')) filtres.push(args[i]);
  }
  return { filtres, selection: valeurs.get('--selection') ?? null, manifeste: valeurs.get('--manifeste') ?? null };
}

// Sélection par fichiers modifiés, écrite par `tests/run.mjs --depuis/--plage`
// (tests/selection.ts). Les noms d'un étalement ne se connaissent qu'ici : un
// groupe d'étalements se retrouve entre les entrées nommées qui le bornent.
function nomsSelectionnes(fichier: string): { noms: Set<string> | 'tout'; brut: unknown } {
  const brut = JSON.parse(readFileSync(fichier, 'utf8'));
  return { noms: nomsDeLaSelection(brut), brut };
}

function nomsDeLaSelection(brut: unknown): Set<string> | 'tout' {
  const { execution } = brut as
    { execution: { complet: boolean; noms: string[]; groupes: { avant: string | null; apres: string | null }[] } };
  if (execution.complet) return 'tout';
  const position = new Map(VERIFICATIONS.map(([n], i) => [n, i]));
  if (position.size !== VERIFICATIONS.length) throw new Error('sélection : noms en double dans le registre');
  const noms = new Set<string>();
  for (const n of execution.noms) {
    if (!position.has(n)) throw new Error(`sélection incohérente avec le registre : ${n} inconnu`);
    noms.add(n);
  }
  for (const g of execution.groupes) {
    const debut = g.avant === null ? -1 : position.get(g.avant);
    const fin = g.apres === null ? VERIFICATIONS.length : position.get(g.apres);
    if (debut === undefined || fin === undefined) throw new Error(`sélection incohérente avec le registre : bornes ${g.avant} / ${g.apres}`);
    for (let i = debut + 1; i < fin; i++) noms.add(VERIFICATIONS[i][0]);
  }
  return noms;
}

// Racine du dépôt : `import.meta.url` est défini à la construction (tests/selection.ts).
const RACINE = fileURLToPath(new URL('..', import.meta.url));

async function main() {
  const { filtres, selection, manifeste } = lireArguments(process.argv.slice(2));
  if (process.argv.includes('--manifeste') && (manifeste === null || manifeste.startsWith('-'))) {
    console.error('\x1b[31mRefus :\x1b[0m --manifeste attend un chemin de fichier');
    process.exit(2);
  }
  // Avant tout : un emplacement de manifeste interdit est refusé, et toute sortie
  // qui suit sans validation finale laisse le manifeste incomplet (tests/execution.ts).
  let execution: Execution;
  try {
    execution = new Execution({ racine: RACINE, manifeste, registre: VERIFICATIONS.map(([n]) => n), bilan, debutVerification });
  } catch (e) {
    if (e instanceof RefusManifeste) { console.error(`\x1b[31mRefus :\x1b[0m ${e.message}`); process.exit(2); }
    throw e;
  }
  const parNom = filtres.length > 0 ? retenues(filtres) : [];
  if (filtres.length > 0 && parNom.length === 0) {
    console.error(
      `
[31mAucune vérification ne correspond à[0m ${filtres.join(' ')}
` +
        `Disponibles : ${VERIFICATIONS.map(([n]) => n).join(', ')}`
    );
    process.exit(1);
  }
  // Avec une sélection, l'union de la sélection et des filtres, dans l'ordre du
  // registre (les prérequis d'ordre en dépendent).
  // L'attendu se fixe sur ce qui est annoncé (registre, filtres, sélection) ;
  // la liste lancée s'en déduit. Les deux sont comparés après l'exécution.
  let liste = filtres.length > 0 ? parNom : VERIFICATIONS;
  let attendues = liste.map(([n]) => n);
  let detail: unknown = null;
  if (selection !== null) {
    const { noms: choisis, brut } = nomsSelectionnes(selection);
    detail = brut;
    if (choisis !== 'tout') {
      for (const [n] of parNom) choisis.add(n);
      attendues = [...choisis];
      liste = VERIFICATIONS.filter(([n]) => choisis.has(n));
    } else {
      liste = VERIFICATIONS;
      attendues = liste.map(([n]) => n);
    }
  }
  execution.fixer(attendues, {
    mode: selection !== null ? 'fichiers modifiés' : filtres.length > 0 ? 'filtres' : 'suite complète',
    filtres,
    detail,
  });
  if (liste.length === 0) console.log('Sélection vide : aucune vérification à lancer.');
  if (filtres.length > 0 || liste.length < VERIFICATIONS.length) {
    console.log(
      `[33mVérifications ciblées[0m (${liste.length}/${VERIFICATIONS.length}) : ` +
        liste.map(([n]) => n).join(', ') +
        `
[33m⚠️  La suite complète reste obligatoire avant une fusion sur main.[0m
`
    );
  }
  process.exit(await execution.lancer(liste));
}

main().catch((err) => {
  console.error('\n\x1b[31mLes vérifications se sont interrompues :\x1b[0m', err);
  process.exit(1);
});
