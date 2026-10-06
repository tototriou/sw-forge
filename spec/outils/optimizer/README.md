# Optimizer — routage par tâche

**Statut :** ÉTAT ACTUEL — routage par tâche vers les specs de l'Optimizer ; ne décrit rien lui-même
**Lire si :** on démarre un chantier Optimizer et on cherche QUELLES sections lire d'abord
**Ne pas lire si :** on sait déjà quel fichier ouvrir — y aller directement, `node scripts/spec-toc.mjs <fichier>` d'abord
**Voir aussi :** invariants.md (se lit en entier), ../optimizer.md

[../optimizer.md](../optimizer.md) présente l'Optimizer et ses fichiers de
code ; le comportement de l'écran et du moteur est décrit dans les fichiers
de ce dossier, listés ci-dessous ; les contraintes critiques dans
[invariants.md](invariants.md), le seul fichier de ce dossier qui se lit en
entier. Tout le reste se lit **par section**, après
`node scripts/spec-toc.mjs <fichier>`.

## Fichiers de ce dossier

Publiés :

- [invariants.md](invariants.md) — les contraintes critiques, chacune avec sa
  source.
- [README.md](README.md) — ce routage.
- [moteur/pipeline.md](moteur/pipeline.md) — de la recherche lancée à la fin
  de l'appariement : préparation, moitiés, appariement.
- [ecran/README.md](ecran/README.md) — l'écran, de haut en bas, et le
  routage vers un fichier par bloc de l'écran.
- [listes-et-reservation.md](listes-et-reservation.md) — listes de travail,
  builds validés, réservation de runes et d'artéfacts.
- [exclusion.md](exclusion.md) — exclusion automatique et manuelle, runes
  imposées.
- [interruption.md](interruption.md) — filet de temps, arrêt manuel, barre de
  progression.
- [moteur/elagages.md](moteur/elagages.md) — meet-in-the-middle, élagages
  sûrs, pré-filtrage, rétention.
- [moteur/artefacts.md](moteur/artefacts.md) — le choix des artéfacts et la
  paire non figée.
- [verification.md](verification.md) — tests différentiels, oracles,
  benchmarks.
- [limites-connues.md](limites-connues.md) — ce que le moteur ne garantit
  pas.

Annoncés : un lien vers l'un d'eux désigne sa place avant qu'il paraisse ;
d'ici là, la section du fichier publié citée dans la même ligne du tableau
décrit le sujet.

- [moteur/reliques.md](moteur/reliques.md) — la dimension relique : contexte,
  bornes, résolution exacte, oracle.
- [moteur/parallelisation.md](moteur/parallelisation.md) — l'appariement
  parallèle, navigateur et Node, et le Worker de résolution.
- [moteur/diagnostics.md](moteur/diagnostics.md) — faisabilité, conditions
  bloquantes, quasi-succès (« near-miss »).
- [harnais.md](harnais.md) — mode d'emploi du harnais de diagnostic et ce
  qu'il garantit.
- [pistes.md](pistes.md) — les pistes futures.

## Je touche…

| Je touche… | Lire d'abord | Puis |
| --- | --- | --- |
| la mise en page de l'écran (grille bureau, panneau « Options » au doigt, dépliants) | [ecran/README.md § Écran (de haut en bas)](ecran/README.md) ; [invariants.md § UI](invariants.md) ; [../../shared/design.md](../../shared/design.md) | [ecran/README.md](ecran/README.md) ; [../../shared/deux-applications.md](../../shared/deux-applications.md) |
| la recherche du monstre, l'exemplaire, la fiche « Équipement actuel » | [ecran/recherche-du-monstre.md § Recherche du monstre à optimiser](ecran/recherche-du-monstre.md) ; [ecran/equipement-actuel.md § Équipement actuel](ecran/equipement-actuel.md) ; [invariants.md § UI](invariants.md) | [ecran/README.md](ecran/README.md) |
| les listes de travail, les builds validés, la réservation de runes | [listes-et-reservation.md § Listes de travail et réservation de runes](listes-et-reservation.md) ; [invariants.md § UI](invariants.md) | [listes-et-reservation.md](listes-et-reservation.md) |
| l'objectif de recherche, « Dégâts réels », un passif ou une mécanique de sort | [ecran/objectif-de-recherche.md § Objectif de recherche](ecran/objectif-de-recherche.md) ; [../degats-reels.md](../degats-reels.md) (par section) ; [invariants.md § Dégâts réels](invariants.md) | skill `game-data-curation` |
| les conditions min/max, « Utiliser tout l'inventaire », les réglages avancés | [ecran/conditions-et-reglages.md § Conditions, inventaire et réglages avancés](ecran/conditions-et-reglages.md) ; [invariants.md § Stats et slots](invariants.md) | — |
| les artéfacts (optimisation, carte Artéfacts, « État de mon monstre ») | [ecran/artefacts.md § Artéfacts](ecran/artefacts.md) ; [ecran/etat-de-mon-monstre.md § État de mon monstre](ecran/etat-de-mon-monstre.md) ; [moteur/artefacts.md § Le choix des artéfacts — un second problème, séparé](moteur/artefacts.md) ; [invariants.md § Artéfacts](invariants.md) | [moteur/artefacts.md](moteur/artefacts.md) |
| les reliques | [ecran/relique.md § Relique](ecran/relique.md) ; [invariants.md § Reliques](invariants.md) | [moteur/reliques.md](moteur/reliques.md) ; assiette « au début du combat » : [../degats-reels/effets-equipe-et-leaders.md § Sets d'aura d'équipe — modèle](../degats-reels/effets-equipe-et-leaders.md) |
| l'exclusion de runes (automatique, manuelle), les runes imposées | [exclusion.md § Exclusion des runes déjà portées ailleurs](exclusion.md) ; [exclusion.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source](exclusion.md) ; [exclusion.md § Runes imposées — verrouiller un emplacement sur une rune précise](exclusion.md) | [exclusion.md](exclusion.md) ; [limites-connues.md](limites-connues.md) (CLI siège, `wizard_id`) |
| le moteur `runeBuildOptim.ts` (élagages, meet-in-the-middle, budgets, presets) | [moteur/elagages.md § Recherche des runes — meet-in-the-middle et élagages](moteur/elagages.md) ; [invariants.md § Algorithme](invariants.md) ; [limites-connues.md § Limites connues](limites-connues.md) | [moteur/pipeline.md](moteur/pipeline.md) ; [moteur/elagages.md](moteur/elagages.md) ; [limites-connues.md](limites-connues.md) ; skill `algo-verify` ; [pistes.md](pistes.md) avant toute « nouvelle » idée |
| la vérification du moteur (tests différentiels, benchmarks, mesures) | [verification.md § Vérification](verification.md) | [verification.md](verification.md) ; skill `optimizer-perf-testing` (pièges de mesure) |
| l'interruption, la barre de progression, le cycle de vie du Worker | [interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](interruption.md) ; [interruption.md § Barre de progression](interruption.md) ; [invariants.md § Workers](invariants.md) | [interruption.md](interruption.md) ; [moteur/pipeline.md](moteur/pipeline.md) ; [moteur/parallelisation.md](moteur/parallelisation.md) si l'appariement parallèle est concerné |
| la parallélisation de l'appariement (navigateur/Node), le Worker de résolution | [invariants.md § Workers](invariants.md) ; [invariants.md § Algorithme](invariants.md) | [moteur/parallelisation.md](moteur/parallelisation.md) |
| le diagnostic « 0 résultat », le quasi-succès (« near-miss ») | [ecran/resultats.md § Résultats](ecran/resultats.md) ; [invariants.md § Algorithme](invariants.md) | [moteur/diagnostics.md](moteur/diagnostics.md) ; [harnais.md](harnais.md) si l'instrumentation est concernée |
| le harnais de diagnostic | [invariants.md § Harnais](invariants.md) | [harnais.md](harnais.md) ; skill `optimizer-perf-testing` |
| la recette (export/import, un champ d'`OptimizerState`/`OptimizerRecipe`) | [ecran/lancer-la-recherche.md § Lancer la recherche](ecran/lancer-la-recherche.md) ; skill `optimizer-field-propagation` (plusieurs constructeurs) | [exclusion.md § Exclusion des runes déjà portées ailleurs](exclusion.md) (repli de compatibilité `exploreAll`) |
| les cartes de résultat (tri, moyenne par rune, popover de rune) | [ecran/resultats.md § Résultats](ecran/resultats.md) ; [invariants.md § UI](invariants.md) | [../../rta/sections-runes.md](../../rta/sections-runes.md) pour `StatPanel`/`RuneWheel`/`ArtifactSlots` partagés |
| une piste de perf ou une idée « nouvelle » | [pistes.md](pistes.md) | la spec du mécanisme concerné, qui dit une piste écartée avec sa raison |
| la vitesse (speed tune, ordre des tours) | [../speed-tuning.md](../speed-tuning.md) (le modèle réel) | — |
| une spec de ce dossier (en-têtes, lint, publication) | [../../outillage/spec.md](../../outillage/spec.md) ; `node scripts/spec-lint.mjs` | [../../outillage/renvois.md](../../outillage/renvois.md) ; un fichier publié ici a sa ligne dans `.githooks/optimizer-publics.txt`, dans le même commit |

Pas dans ce tableau : les fichiers de code de l'écran et du moteur, listés en
tête de [../optimizer.md](../optimizer.md) (« Fichiers : … »).
