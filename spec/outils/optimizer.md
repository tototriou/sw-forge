# Outils · Optimizer (`#/outils/optimizer`)

**Statut :** ÉTAT ACTUEL — page d'entrée de l'Optimizer : son objet, ses fichiers de code, et un renvoi par sujet vers le fichier qui le décrit
**Lire si :** on cherche quel fichier de code ou quelle spec ouvrir pour l'écran, ses réglages ou l'algorithme de recherche de runes
**Ne pas lire si :** on cherche le modèle de calcul des dégâts (degats-reels.md) seul
**Voir aussi :** degats-reels.md, README.md

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**, orientée par un **objectif de recherche**
choisi d'avance. Anticipé dans
[compte/calcul-runes.md § 6. Perf (contrainte forte, à respecter)](../compte/calcul-runes.md)
(« Futur optimiseur de builds »).

Fichiers : [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) ·
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) (moteur pur) ·
[runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts) (Worker) ·
[useBuildOptimSearch.ts](src/hooks/useBuildOptimSearch.ts) (cycle de vie du
Worker) · [useOptimizerState.ts](src/hooks/useOptimizerState.ts) (toute la
saisie de l'écran, remontée dans App.tsx, JAMAIS écrite sur disque) ·
[useOptimizerLists.ts](src/hooks/useOptimizerLists.ts) (listes de travail,
membres, builds validés — PERSISTÉ,
voir optimizer/listes-et-reservation.md § Listes de travail et réservation de runes) ·
[OptimizerListPicker.tsx](src/components/outils/OptimizerListPicker.tsx) ·
[MonsterSourcePicker.tsx](src/components/outils/MonsterSourcePicker.tsx)
(mode `bestiary` pour « Monstre à optimiser », mode `account` ailleurs) ·
[ExclusionCandidateRow.tsx](src/components/outils/ExclusionCandidateRow.tsx)
(partagé avec [RuneExclusionPicker.tsx](src/components/outils/RuneExclusionPicker.tsx)) ·
[SetComboPicker.tsx](src/components/outils/SetComboPicker.tsx) ·
[BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx) ·
[DamageSetupCard.tsx](src/components/outils/DamageSetupCard.tsx) +
[damage.ts](src/lib/damage.ts) (objectif « Dégâts réels », voir
[degats-reels.md](degats-reels.md)) ·
[StatPanel.tsx](src/components/StatPanel.tsx) ·
[ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) ·
[RuneWheel.tsx](src/components/RuneWheel.tsx) — ces trois derniers
partagés avec `MonsterGear.tsx` (RTA/Siège/« Équipement actuel »), voir
[README.md](../README.md).

## Où vit le reste de la spec

Chaque sujet vit dans son fichier, dans le dossier optimizer à côté de cette page :

- **Écran** — [ecran/README.md](optimizer/ecran/README.md) (contrôles, grille, panneaux dépliants, adaptation à la largeur, survie à un changement d'onglet), puis une page par carte :
  - [Recherche du monstre à optimiser](optimizer/ecran/recherche-du-monstre.md)
  - [Meilleurs artéfacts offensifs pour ce build](optimizer/ecran/meilleurs-artefacts-offensifs.md)
  - [Équipement actuel](optimizer/ecran/equipement-actuel.md)
  - [Objectif de recherche](optimizer/ecran/objectif-de-recherche.md)
  - [Set de runes recherché et statistique principale imposée](optimizer/ecran/set-et-principale.md)
  - [Artéfacts](optimizer/ecran/artefacts.md)
  - [Relique](optimizer/ecran/relique.md)
  - [État de mon monstre](optimizer/ecran/etat-de-mon-monstre.md)
  - [Sous-propriétés verrouillées](optimizer/ecran/sous-proprietes-verrouillees.md)
  - [Conditions, inventaire et réglages avancés](optimizer/ecran/conditions-et-reglages.md)
  - [Lancer la recherche](optimizer/ecran/lancer-la-recherche.md)
  - [Résultats](optimizer/ecran/resultats.md)
- [Listes de travail et réservation de runes](optimizer/listes-et-reservation.md)
- [Exclusion des runes déjà portées ailleurs](optimizer/exclusion.md)
- [Interruption — filet de temps, pré-filtrage et arrêt manuel](optimizer/interruption.md)
- **Algorithme** — [Algorithme (résumé fonctionnel)](optimizer/moteur/elagages.md) · [Le choix des artéfacts](optimizer/moteur/artefacts.md) · [Vérification](optimizer/verification.md)
- [Limites connues](optimizer/limites-connues.md)
