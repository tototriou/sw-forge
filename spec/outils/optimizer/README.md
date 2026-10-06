# Optimizer — routage par tâche

**Statut :** ÉTAT ACTUEL — routage par tâche vers les specs de l'Optimizer ; ne décrit rien lui-même
**Lire si :** on démarre un chantier Optimizer et on cherche QUELLES sections lire d'abord
**Ne pas lire si :** on sait déjà quel fichier ouvrir — y aller directement, `node scripts/spec-toc.mjs <fichier>` d'abord
**Voir aussi :** invariants.md (se lit en entier), ../optimizer.md

Le comportement de l'écran et du moteur, tel que l'utilisateur le voit, est
décrit dans [../optimizer.md](../optimizer.md) ; les contraintes critiques
dans [invariants.md](invariants.md), le seul fichier de ce dossier qui se lit
en entier. Tout le reste se lit **par section**, après
`node scripts/spec-toc.mjs <fichier>`.

## Fichiers de ce dossier

Publiés :

- [invariants.md](invariants.md) — les contraintes critiques, chacune avec sa
  source.
- [README.md](README.md) — ce routage.

Annoncés : un lien vers l'un d'eux désigne sa place avant qu'il paraisse ;
d'ici là, la section de [../optimizer.md](../optimizer.md) citée dans la
même ligne du tableau décrit le sujet.

- [ecran/README.md](ecran/README.md) — l'écran, de haut en bas, et le
  routage vers un fichier par bloc de l'écran.
- [listes-et-reservation.md](listes-et-reservation.md) — listes de travail,
  builds validés, réservation de runes et d'artéfacts.
- [exclusion.md](exclusion.md) — exclusion automatique et manuelle, runes
  imposées.
- [interruption.md](interruption.md) — filet de temps, arrêt manuel, barre de
  progression.
- [moteur/pipeline.md](moteur/pipeline.md) — de la recherche lancée au
  résultat affiché : préparation, moitiés, appariement, résolution, file.
- [moteur/elagages.md](moteur/elagages.md) — meet-in-the-middle, élagages
  sûrs, pré-filtrage, rétention.
- [moteur/artefacts.md](moteur/artefacts.md) — le choix des artéfacts et la
  paire non figée.
- [moteur/reliques.md](moteur/reliques.md) — la dimension relique : contexte,
  bornes, résolution exacte, oracle.
- [moteur/parallelisation.md](moteur/parallelisation.md) — l'appariement
  parallèle, navigateur et Node, et le Worker de résolution.
- [moteur/diagnostics.md](moteur/diagnostics.md) — faisabilité, conditions
  bloquantes, quasi-succès (« near-miss »).
- [verification.md](verification.md) — tests différentiels, oracles,
  benchmarks.
- [limites-connues.md](limites-connues.md) — ce que le moteur ne garantit
  pas.
- [harnais.md](harnais.md) — mode d'emploi du harnais de diagnostic et ce
  qu'il garantit.
- [pistes.md](pistes.md) — les pistes futures.

## Je touche…

| Je touche… | Lire d'abord | Puis |
| --- | --- | --- |
| la mise en page de l'écran (grille bureau, panneau « Options » au doigt, dépliants) | [../optimizer.md § Écran (de haut en bas)](../optimizer.md) ; [invariants.md § UI](invariants.md) ; [../../shared/design.md](../../shared/design.md) | [ecran/README.md](ecran/README.md) ; [../../shared/deux-applications.md](../../shared/deux-applications.md) |
| la recherche du monstre, l'exemplaire, la fiche « Équipement actuel » | [../optimizer.md § Recherche du monstre à optimiser](../optimizer.md) ; [../optimizer.md § Équipement actuel](../optimizer.md) ; [invariants.md § UI](invariants.md) | [ecran/README.md](ecran/README.md) |
| les listes de travail, les builds validés, la réservation de runes | [../optimizer.md § Listes de travail et réservation de runes](../optimizer.md) ; [invariants.md § UI](invariants.md) | [listes-et-reservation.md](listes-et-reservation.md) |
| l'objectif de recherche, « Dégâts réels », un passif ou une mécanique de sort | [../optimizer.md § Objectif de recherche](../optimizer.md) ; [../degats-reels.md](../degats-reels.md) (par section) ; [invariants.md § Dégâts réels](invariants.md) | skill `game-data-curation` |
| les conditions min/max, « Utiliser tout l'inventaire », les réglages avancés | [../optimizer.md § Conditions, inventaire et réglages avancés](../optimizer.md) ; [invariants.md § Stats et slots](invariants.md) | — |
| les artéfacts (optimisation, carte Artéfacts, « État de mon monstre ») | [../optimizer.md § Artéfacts](../optimizer.md) ; [../optimizer.md § État de mon monstre](../optimizer.md) ; [../optimizer.md § Le choix des artéfacts — un second problème, séparé](../optimizer.md) ; [invariants.md § Artéfacts](invariants.md) | [moteur/artefacts.md](moteur/artefacts.md) |
| les reliques | [../optimizer.md § Relique](../optimizer.md) ; [invariants.md § Reliques](invariants.md) | [moteur/reliques.md](moteur/reliques.md) ; assiette « au début du combat » : [../degats-reels/effets-equipe-et-leaders.md § Sets d'aura d'équipe — modèle](../degats-reels/effets-equipe-et-leaders.md) |
| l'exclusion de runes (automatique, manuelle), les runes imposées | [../optimizer.md § Exclusion des runes déjà portées ailleurs](../optimizer.md) ; [../optimizer.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source](../optimizer.md) ; [../optimizer.md § Runes imposées — verrouiller un emplacement sur une rune précise](../optimizer.md) | [exclusion.md](exclusion.md) ; [limites-connues.md](limites-connues.md) (CLI siège, `wizard_id`) |
| le moteur `runeBuildOptim.ts` (élagages, meet-in-the-middle, budgets, presets) | [../optimizer.md § Recherche des runes — meet-in-the-middle et élagages](../optimizer.md) ; [invariants.md § Algorithme](invariants.md) ; [../optimizer.md § Limites connues](../optimizer.md) | [moteur/pipeline.md](moteur/pipeline.md) ; [moteur/elagages.md](moteur/elagages.md) ; [limites-connues.md](limites-connues.md) ; skill `algo-verify` ; [pistes.md](pistes.md) avant toute « nouvelle » idée |
| la vérification du moteur (tests différentiels, benchmarks, mesures) | [../optimizer.md § Vérification](../optimizer.md) | [verification.md](verification.md) ; skill `optimizer-perf-testing` (pièges de mesure) |
| l'interruption, la barre de progression, le cycle de vie du Worker | [../optimizer.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](../optimizer.md) ; [../optimizer.md § Barre de progression](../optimizer.md) ; [invariants.md § Workers](invariants.md) | [interruption.md](interruption.md) ; [moteur/pipeline.md](moteur/pipeline.md) ; [moteur/parallelisation.md](moteur/parallelisation.md) si l'appariement parallèle est concerné |
| la parallélisation de l'appariement (navigateur/Node), le Worker de résolution | [invariants.md § Workers](invariants.md) ; [invariants.md § Algorithme](invariants.md) | [moteur/parallelisation.md](moteur/parallelisation.md) |
| le diagnostic « 0 résultat », le quasi-succès (« near-miss ») | [../optimizer.md § Résultats](../optimizer.md) ; [invariants.md § Algorithme](invariants.md) | [moteur/diagnostics.md](moteur/diagnostics.md) ; [harnais.md](harnais.md) si l'instrumentation est concernée |
| le harnais de diagnostic | [invariants.md § Harnais](invariants.md) | [harnais.md](harnais.md) ; skill `optimizer-perf-testing` |
| la recette (export/import, un champ d'`OptimizerState`/`OptimizerRecipe`) | [../optimizer.md § Lancer la recherche](../optimizer.md) ; skill `optimizer-field-propagation` (plusieurs constructeurs) | [../optimizer.md § Exclusion des runes déjà portées ailleurs](../optimizer.md) (repli de compatibilité `exploreAll`) |
| les cartes de résultat (tri, moyenne par rune, popover de rune) | [../optimizer.md § Résultats](../optimizer.md) ; [invariants.md § UI](invariants.md) | [../../rta/sections-runes.md](../../rta/sections-runes.md) pour `StatPanel`/`RuneWheel`/`ArtifactSlots` partagés |
| une piste de perf ou une idée « nouvelle » | [pistes.md](pistes.md) | la spec du mécanisme concerné, qui dit une piste écartée avec sa raison |
| la vitesse (speed tune, ordre des tours) | [../speed-tuning.md](../speed-tuning.md) (le modèle réel) | — |
| une spec de ce dossier (en-têtes, lint, publication) | [../../outillage/spec.md](../../outillage/spec.md) ; `node scripts/spec-lint.mjs` | [../../outillage/renvois.md](../../outillage/renvois.md) ; un fichier publié ici a sa ligne dans `.githooks/optimizer-publics.txt`, dans le même commit |

Pas dans ce tableau : les fichiers de code de l'écran et du moteur, listés en
tête de [../optimizer.md](../optimizer.md) (« Fichiers : … »).
