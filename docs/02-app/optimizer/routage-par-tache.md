# Optimizer — routage par tâche

Voir aussi : ../../03-developpeur/optimizer/ (invariants, se lisent en entier), README.md.

[README.md](README.md) présente l'Optimizer et ses fichiers de code ; le
comportement de l'écran est décrit dans les fichiers de ce dossier, celui du
moteur dans [03-developpeur/optimizer/](../../03-developpeur/optimizer/),
listés ci-dessous ; les contraintes critiques dans les invariants
([03-developpeur/optimizer/](../../03-developpeur/optimizer/)), le seul
fichier qui se lit en entier. Tout le reste se lit **par section**.

## Fichiers de l'Optimizer

Dans ce dossier (l'application) :

- [routage-par-tache.md](routage-par-tache.md) — ce routage.
- [ecran/README.md](ecran/README.md) — l'écran, de haut en bas, et le
  routage vers un fichier par bloc de l'écran.
- [feat-listes-et-reservation.md](feat-listes-et-reservation.md) — listes de
  travail, builds validés, réservation de runes et d'artéfacts.
- [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md) —
  mémoires des membres, équipes stockées, point de sauvegarde, conservation et revérification.
- [feat-import-equipes.md](feat-import-equipes.md) — modèle pur d’import,
  conversions du siège et de la prépa RTA, consommation dans une nouvelle liste.
- [feat-exclusion.md](feat-exclusion.md) — exclusion automatique et manuelle,
  runes imposées.
- [feat-interruption.md](feat-interruption.md) — filet de temps, arrêt
  manuel, barre de progression.
- [limites-connues.md](limites-connues.md) — ce que le moteur ne garantit
  pas.

Dans [03-developpeur/optimizer/](../../03-developpeur/optimizer/README.md) (le moteur) :

- [invariants.md](../../03-developpeur/optimizer/invariants.md) — les contraintes critiques,
  chacune avec sa source.
- [moteur/pipeline.md](../../03-developpeur/optimizer/moteur/pipeline.md) — de la recherche
  lancée au résultat affiché : préparation, moitiés, appariement, résolution, file.
- [moteur/elagages.md](../../03-developpeur/optimizer/moteur/elagages.md) —
  meet-in-the-middle, élagages sûrs, pré-filtrage, rétention.
- [moteur/parallelisation.md](../../03-developpeur/optimizer/moteur/parallelisation.md) —
  l'appariement parallèle, navigateur et Node, et le Worker de résolution.
- [moteur/diagnostics.md](../../03-developpeur/optimizer/moteur/diagnostics.md) —
  faisabilité, conditions bloquantes, quasi-succès (« near-miss »).
- [moteur/artefacts.md](../../03-developpeur/optimizer/moteur/artefacts.md) — le choix des
  artéfacts et la paire non figée.
- [moteur/optimiseur-artefacts.md](../../03-developpeur/optimizer/moteur/optimiseur-artefacts.md) —
  l'optimiseur d'artéfacts : éligibilité, effet de chaque ligne, focus élémentaire, moteur,
  script CLI.
- [moteur/reliques.md](../../03-developpeur/optimizer/moteur/reliques.md) — la dimension
  relique : contexte, bornes, résolution exacte, effet unique, oracle.
- [verification.md](../../03-developpeur/optimizer/verification.md) — tests différentiels,
  oracles, benchmarks.
- [harnais/mode-d-emploi.md](../../03-developpeur/optimizer/harnais/mode-d-emploi.md) — mode
  d'emploi du harnais de diagnostic et ce qu'il garantit.
- [harnais/extensions.md](../../03-developpeur/optimizer/harnais/extensions.md) — le harnais
  au-delà de son mode d'emploi : construction observée, build cible, différentiel.
- [harnais/scripts.md](../../03-developpeur/optimizer/harnais/scripts.md) — le harnais sur les
  cas connus, et les scripts de diagnostic qui restent à côté de lui.

Dans [05-feuille-de-route/](../../05-feuille-de-route/) : les pistes futures de l'Optimizer
(constat, idée, ce qui les bloque), et celles qui accéléreraient la recherche
sans changer ce qu'elle cherche, avec celles des tests, du harnais et des
scripts de mesure.

## Je touche…

« dev/ » désigne ci-dessous [03-developpeur/optimizer/](../../03-developpeur/optimizer/).

| Je touche… | Lire d'abord | Puis |
| --- | --- | --- |
| la mise en page de l'écran (colonnes du bureau et colonnes repliables, panneau « Options » au doigt) | [ecran/README.md § Écran (de haut en bas)](ecran/README.md) ; [dev/invariants.md § UI](../../03-developpeur/optimizer/invariants.md#ui) ; [03-developpeur/interface/ (design)](../../03-developpeur/interface/) | [ecran/README.md](ecran/README.md) ; [03-developpeur/interface/deux-formats.md](../../03-developpeur/interface/deux-formats.md) |
| la recherche du monstre, l'exemplaire, la fiche « Équipement actuel » | [ecran/recherche-du-monstre.md § Recherche du monstre à optimiser](ecran/recherche-du-monstre.md) ; [ecran/equipement-actuel.md § Équipement actuel](ecran/equipement-actuel.md) ; [dev/invariants.md § UI](../../03-developpeur/optimizer/invariants.md#ui) | [ecran/README.md](ecran/README.md) |
| les listes de travail, les builds validés, la réservation de runes | [feat-listes-et-reservation.md § Listes de travail et réservation de runes](feat-listes-et-reservation.md) ; [dev/invariants.md § UI](../../03-developpeur/optimizer/invariants.md#ui) | [feat-listes-et-reservation.md](feat-listes-et-reservation.md) |
| les conversions d’équipes et leur import dans une liste | [feat-import-equipes.md](feat-import-equipes.md) ; [dev/invariants.md § UI](../../03-developpeur/optimizer/invariants.md#ui) | [feat-listes-equipes-et-sauvegarde.md](feat-listes-equipes-et-sauvegarde.md) |
| l'objectif de recherche, « Dégâts réels », un passif ou une mécanique de sort | [ecran/objectif-de-recherche.md § Objectif de recherche](ecran/objectif-de-recherche.md) ; [degats-reels/](../degats-reels/) (par section) ; [dev/invariants.md § Dégâts réels](../../03-developpeur/optimizer/invariants.md#dégâts-réels) | skill `game-data-curation` |
| les conditions min/max, « Exclure les runes déjà utilisées », les réglages avancés | [ecran/conditions-et-reglages.md § Conditions, inventaire et réglages avancés](ecran/conditions-et-reglages.md) ; [dev/invariants.md § Stats et slots](../../03-developpeur/optimizer/invariants.md#stats-et-slots) | — |
| les artéfacts (optimisation, carte Artéfacts, « État de mon monstre ») | [ecran/artefacts.md § Artéfacts](ecran/artefacts.md) ; [ecran/etat-de-mon-monstre.md § État de mon monstre](ecran/etat-de-mon-monstre.md) ; [dev/moteur/artefacts.md § Le choix des artéfacts — un second problème, séparé](../../03-developpeur/optimizer/moteur/artefacts.md#le-choix-des-artéfacts--un-second-problème-séparé) ; [dev/invariants.md § Artéfacts](../../03-developpeur/optimizer/invariants.md#artéfacts) | [dev/moteur/artefacts.md](../../03-developpeur/optimizer/moteur/artefacts.md) ; [dev/moteur/optimiseur-artefacts.md](../../03-developpeur/optimizer/moteur/optimiseur-artefacts.md) |
| les reliques | [ecran/relique.md § Relique](ecran/relique.md) ; [dev/invariants.md § Reliques](../../03-developpeur/optimizer/invariants.md#reliques) | [dev/moteur/reliques.md](../../03-developpeur/optimizer/moteur/reliques.md) ; assiette « au début du combat » : [degats-reels/feat-effets-equipe-et-leaders.md § Sets d'aura d'équipe — modèle](../degats-reels/feat-effets-equipe-et-leaders.md#sets-daura-déquipe--modèle) |
| l'exclusion de runes (automatique, manuelle), les runes imposées | [feat-exclusion.md § Exclusion des runes déjà portées ailleurs](feat-exclusion.md) ; [feat-exclusion.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source](feat-exclusion.md) ; [feat-exclusion.md § Runes imposées — verrouiller un emplacement sur une rune précise](feat-exclusion.md) | [feat-exclusion.md](feat-exclusion.md) ; [limites-connues.md](limites-connues.md) (CLI siège, `wizard_id`) |
| le moteur `runeBuildOptim.ts` (élagages, meet-in-the-middle, budgets, presets) | [dev/moteur/elagages.md § Recherche des runes — meet-in-the-middle et élagages](../../03-developpeur/optimizer/moteur/elagages.md#recherche-des-runes--meet-in-the-middle-et-élagages) ; [dev/invariants.md § Algorithme](../../03-developpeur/optimizer/invariants.md#algorithme) ; [limites-connues.md § Limites connues](limites-connues.md) | [dev/moteur/pipeline.md](../../03-developpeur/optimizer/moteur/pipeline.md) ; [dev/moteur/elagages.md](../../03-developpeur/optimizer/moteur/elagages.md) ; [limites-connues.md](limites-connues.md) ; skill `algo-verify` ; [05-feuille-de-route/ (pistes de l'Optimizer)](../../05-feuille-de-route/) avant toute « nouvelle » idée |
| la vérification du moteur (tests différentiels, oracles, benchmarks) | [dev/verification.md § Vérification](../../03-developpeur/optimizer/verification.md#vérification) | skill `optimizer-perf-testing` (pièges de mesure) |
| l'interruption, la barre de progression, le cycle de vie du Worker | [feat-interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](feat-interruption.md) ; [feat-interruption.md § Barre de progression](feat-interruption.md) ; [dev/invariants.md § Workers](../../03-developpeur/optimizer/invariants.md#workers) | [feat-interruption.md](feat-interruption.md) ; [dev/moteur/pipeline.md](../../03-developpeur/optimizer/moteur/pipeline.md) ; [dev/moteur/parallelisation.md](../../03-developpeur/optimizer/moteur/parallelisation.md) si l'appariement parallèle est concerné |
| la parallélisation de l'appariement (navigateur/Node), le Worker de résolution | [dev/invariants.md § Algorithme](../../03-developpeur/optimizer/invariants.md#algorithme) | [dev/moteur/parallelisation.md](../../03-developpeur/optimizer/moteur/parallelisation.md) |
| le diagnostic « 0 résultat », le quasi-succès (« near-miss ») | [ecran/resultats.md § Résultats](ecran/resultats.md) ; [dev/invariants.md § Algorithme](../../03-developpeur/optimizer/invariants.md#algorithme) | [dev/moteur/diagnostics.md](../../03-developpeur/optimizer/moteur/diagnostics.md) ; [dev/harnais/](../../03-developpeur/optimizer/harnais/README.md) si l'instrumentation est concernée |
| le harnais de diagnostic | [dev/invariants.md § Harnais](../../03-developpeur/optimizer/invariants.md#harnais) | [dev/harnais/](../../03-developpeur/optimizer/harnais/README.md) (mode d'emploi, extensions, scripts) ; skill `optimizer-perf-testing` |
| la recette (export/import, un champ d'`OptimizerState`/`OptimizerRecipe`) | [ecran/lancer-la-recherche.md § Lancer la recherche](ecran/lancer-la-recherche.md) ; skill `optimizer-field-propagation` (plusieurs constructeurs) | [feat-exclusion.md § Exclusion des runes déjà portées ailleurs](feat-exclusion.md) (repli de compatibilité `exploreAll`) |
| les cartes de résultat (tri, moyenne par rune, popover de rune) | [ecran/resultats.md § Résultats](ecran/resultats.md) ; [dev/invariants.md § UI](../../03-developpeur/optimizer/invariants.md#ui) | [rta/ (sections runes)](../rta/) pour `StatPanel`/`RuneWheel`/`ArtifactSlots` partagés |
| une piste de perf ou une idée « nouvelle » | [05-feuille-de-route/ (pistes de l'Optimizer, vitesse et vérification)](../../05-feuille-de-route/) | la spec du mécanisme concerné, qui dit une piste écartée avec sa raison |
| la vitesse (speed tune, ordre des tours) | [speed-tuning/](../speed-tuning/) (le modèle réel) | — |
| une spec de ce dossier (écriture, découpage, liens) | [03-developpeur/documentation.md](../../03-developpeur/documentation.md) | [03-developpeur/renvois.md](../../03-developpeur/renvois.md) |

Pas dans ce tableau : les fichiers de code de l'écran et du moteur, listés en
tête de [README.md](README.md) (« Fichiers : … »).
