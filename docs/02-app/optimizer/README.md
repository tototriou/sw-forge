# Outils · Optimizer (`#/outils/optimizer`)

Voir aussi : ../degats-reels/, routage-par-tache.md.

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**, orientée par un **objectif de recherche**
choisi d'avance. Anticipé dans
[compte/feat-calcul-runes.md § 6. Perf (contrainte forte, à respecter)](../compte/feat-calcul-runes.md#6-perf-contrainte-forte-à-respecter)
(« Futur optimiseur de builds »).

Fichiers : [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) ·
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) (moteur pur) ·
[runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts) (Worker) ·
[useBuildOptimSearch.ts](src/hooks/useBuildOptimSearch.ts) (cycle de vie du
Worker) · [useOptimizerState.ts](src/hooks/useOptimizerState.ts) (toute la
saisie de l'écran, remontée dans App.tsx, JAMAIS écrite sur disque) ·
[useOptimizerLists.ts](src/hooks/useOptimizerLists.ts) (listes de travail,
membres, builds validés — PERSISTÉ,
voir feat-listes-et-reservation.md § Listes de travail et réservation de runes) ·
[OptimizerListPicker.tsx](src/components/outils/OptimizerListPicker.tsx) ·
[OptimizerBackupBar.tsx](src/components/outils/OptimizerBackupBar.tsx)
(point de sauvegarde de toutes les listes) ·
[MonsterSourcePicker.tsx](src/components/outils/MonsterSourcePicker.tsx)
(mode `bestiary` pour « Monstre à optimiser », mode `account` ailleurs) ·
[ExclusionCandidateRow.tsx](src/components/outils/ExclusionCandidateRow.tsx)
(partagé avec [RuneExclusionPicker.tsx](src/components/outils/RuneExclusionPicker.tsx)) ·
[SetComboPicker.tsx](src/components/outils/SetComboPicker.tsx) ·
[BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx) ·
[DamageSetupCard.tsx](src/components/outils/DamageSetupCard.tsx) +
[damage.ts](src/lib/damage.ts) (objectif « Dégâts réels », voir
[degats-reels/](../degats-reels/)) ·
[StatPanel.tsx](src/components/StatPanel.tsx) ·
[ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) ·
[RuneWheel.tsx](src/components/RuneWheel.tsx) — ces trois derniers
partagés avec `MonsterGear.tsx` (RTA/Siège/« Équipement actuel »), voir
[03-developpeur/](../../03-developpeur/).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| la mise en page de `src/components/outils/OptimizerSection.tsx` : format, page de bureau en colonnes (`src/components/outils/optimizer/bureau/`, `src/lib/optimizerColonnes.ts`), grille du téléphone, changement d'onglet | [ecran/README.md](ecran/README.md) |
| la recherche du monstre et la liste de travail du bureau, `src/components/outils/MonsterSourcePicker.tsx` | [ecran/recherche-du-monstre.md](ecran/recherche-du-monstre.md) |
| « Meilleurs artéfacts offensifs pour ce build », `src/components/ArtifactSubLigne.tsx` | [ecran/meilleurs-artefacts-offensifs.md](ecran/meilleurs-artefacts-offensifs.md) |
| « Équipement actuel » | [ecran/equipement-actuel.md](ecran/equipement-actuel.md) |
| l'objectif de recherche, `src/components/outils/DamageSetupCard.tsx`, `src/components/outils/DamageSetupModale.tsx` | [ecran/objectif-de-recherche.md](ecran/objectif-de-recherche.md) |
| le set recherché et les principales imposées, `src/components/outils/SetComboPicker.tsx` | [ecran/set-et-principale.md](ecran/set-et-principale.md) |
| la carte « Artéfacts et relique » | [ecran/artefacts.md](ecran/artefacts.md) |
| le bloc « Relique », `src/components/RelicSlot.tsx` | [ecran/relique.md](ecran/relique.md) |
| « État de mon monstre », `src/components/outils/EtatMonstre.tsx`, `src/lib/aurasExternes.ts`, `src/lib/buffsDePassif.ts` | [ecran/etat-de-mon-monstre.md](ecran/etat-de-mon-monstre.md) |
| les sous-propriétés verrouillées | [ecran/sous-proprietes-verrouillees.md](ecran/sous-proprietes-verrouillees.md) |
| les conditions, l'inventaire et les réglages avancés | [ecran/conditions-et-reglages.md](ecran/conditions-et-reglages.md) |
| « Lancer la recherche » | [ecran/lancer-la-recherche.md](ecran/lancer-la-recherche.md) |
| les résultats, `src/components/outils/BuildCandidateCard.tsx` | [ecran/resultats.md](ecran/resultats.md) |
| `src/hooks/useOptimizerLists.ts`, `src/components/outils/OptimizerListPicker.tsx`, la réservation de runes | [feat-listes-et-reservation.md](feat-listes-et-reservation.md) |
| `src/lib/optimizerMemberStorage.ts`, `src/lib/equipesOptimizer.ts`, `src/lib/optimizerBackup.ts`, `src/components/outils/OptimizerBackupBar.tsx`, `src/components/outils/OptimizerEquipeDialog.tsx`, `src/components/outils/OptimizerCreateListDialog.tsx` | [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md) |
| `src/lib/importEquipes.ts`, `src/lib/actionImportOptimizer.ts`, `src/lib/importRecoOptimizer.ts`, `src/lib/importSpeedTuneOptimizer.ts`, `src/components/outils/OptimizerImportButton.tsx`, `src/components/outils/OptimizerImportRapport.tsx` | [feat-import-equipes.md](feat-import-equipes.md) |
| `src/lib/optimizerExclusion.ts`, `src/components/outils/RuneExclusionPicker.tsx`, `src/components/outils/ExclusionCandidateRow.tsx` | [feat-exclusion.md](feat-exclusion.md) |
| `src/hooks/useBuildOptimSearch.ts`, le filet de temps, la barre de progression, l'arrêt | [feat-interruption.md](feat-interruption.md) |
| `src/lib/runeBuildOptim.ts`, `src/lib/artifactOptim.ts`, les `relic…` de `src/lib/`, `src/workers/` | [03-developpeur/optimizer/](../../03-developpeur/optimizer/README.md) |
| on ne sait pas encore quoi lire | [routage-par-tache.md](routage-par-tache.md) |

## Où vit le reste de la spec

Chaque sujet de l'application vit dans son fichier, dans ce dossier ; le
moteur et sa vérification vivent côté développeur :

- **Par où commencer** — [routage-par-tache.md](routage-par-tache.md) : quelles sections lire d'abord selon ce qu'on touche
- **Écran** — [ecran/README.md](ecran/README.md) (contrôles, colonnes du bureau et groupe d'onglets, grille du téléphone, adaptation à la largeur, survie à un changement d'onglet), puis une page par boîte :
  - [Recherche du monstre à optimiser](ecran/recherche-du-monstre.md)
  - [Meilleurs artéfacts offensifs pour ce build](ecran/meilleurs-artefacts-offensifs.md)
  - [Équipement actuel](ecran/equipement-actuel.md)
  - [Objectif de recherche](ecran/objectif-de-recherche.md)
  - [Set de runes recherché et statistique principale imposée](ecran/set-et-principale.md)
  - [Artéfacts](ecran/artefacts.md)
  - [Relique](ecran/relique.md)
  - [État de mon monstre](ecran/etat-de-mon-monstre.md)
  - [Sous-propriétés verrouillées](ecran/sous-proprietes-verrouillees.md)
  - [Conditions, inventaire et réglages avancés](ecran/conditions-et-reglages.md)
  - [Lancer la recherche](ecran/lancer-la-recherche.md)
  - [Résultats](ecran/resultats.md)
- [Listes de travail et réservation de runes](feat-listes-et-reservation.md)
- [Stockage des membres, des équipes et du point de sauvegarde](feat-listes-equipes-et-sauvegarde.md)
- [Import d’équipes : modèle et conversions](feat-import-equipes.md)
- [Exclusion des runes déjà portées ailleurs](feat-exclusion.md)
- [Interruption — filet de temps, pré-filtrage et arrêt manuel](feat-interruption.md)
- **Algorithme** (le chemin d'une recherche, les élagages, le choix des artéfacts, la vérification) — [03-developpeur/optimizer/](../../03-developpeur/optimizer/)
- [Limites connues](limites-connues.md)
