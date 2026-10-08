# Outils · Optimizer (`#/outils/optimizer`)

**Statut :** ÉTAT ACTUEL — page d'entrée de l'Optimizer : son objet, ses fichiers de code, et un renvoi par sujet vers le fichier qui le décrit
**Lire si :** on cherche quel fichier de code ou quelle spec ouvrir pour l'écran, ses réglages ou l'algorithme de recherche de runes
**Ne pas lire si :** on cherche le modèle de calcul des dégâts (../degats-reels/) seul
**Voir aussi :** ../degats-reels/, routage-par-tache.md

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**, orientée par un **objectif de recherche**
choisi d'avance. Anticipé dans
[compte/ (calcul des runes) § 6. Perf (contrainte forte, à respecter)](../compte/)
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

## Où vit le reste de la spec

Chaque sujet de l'application vit dans son fichier, dans ce dossier ; le
moteur et sa vérification vivent côté développeur :

- **Écran** — [feat-ecran.md](feat-ecran.md) (contrôles, grille, panneaux dépliants, adaptation à la largeur, survie à un changement d'onglet), puis une page par carte :
  - [Recherche du monstre à optimiser](feat-ecran-recherche-du-monstre.md)
  - [Meilleurs artéfacts offensifs pour ce build](feat-ecran-meilleurs-artefacts-offensifs.md)
  - [Équipement actuel](feat-ecran-equipement-actuel.md)
  - [Objectif de recherche](feat-ecran-objectif-de-recherche.md)
  - [Set de runes recherché et statistique principale imposée](feat-ecran-set-et-principale.md)
  - [Artéfacts](feat-ecran-artefacts.md)
  - [Relique](feat-ecran-relique.md)
  - [État de mon monstre](feat-ecran-etat-de-mon-monstre.md)
  - [Sous-propriétés verrouillées](feat-ecran-sous-proprietes-verrouillees.md)
  - [Conditions, inventaire et réglages avancés](feat-ecran-conditions-et-reglages.md)
  - [Lancer la recherche](feat-ecran-lancer-la-recherche.md)
  - [Résultats](feat-ecran-resultats.md)
- [Listes de travail et réservation de runes](feat-listes-et-reservation.md)
- [Exclusion des runes déjà portées ailleurs](feat-exclusion.md)
- [Interruption — filet de temps, pré-filtrage et arrêt manuel](feat-interruption.md)
- **Algorithme** (le chemin d'une recherche, les élagages, le choix des artéfacts, la vérification) — [03-developpeur/optimizer/](../../03-developpeur/optimizer/)
- [Limites connues](limites-connues.md)
