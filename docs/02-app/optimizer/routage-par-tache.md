# Optimizer — routage par tâche

**Statut :** ÉTAT ACTUEL — routage par tâche vers les specs de l'Optimizer ; ne décrit rien lui-même
**Lire si :** on démarre un chantier Optimizer et on cherche QUELLES sections lire d'abord
**Ne pas lire si :** on sait déjà quel fichier ouvrir — y aller directement, `node scripts/spec-toc.mjs <fichier>` d'abord
**Voir aussi :** ../../03-developpeur/optimizer/ (invariants, se lisent en entier), README.md

[README.md](README.md) présente l'Optimizer et ses fichiers de code ; le
comportement de l'écran est décrit dans les fichiers de ce dossier, celui du
moteur dans [03-developpeur/optimizer/](../../03-developpeur/optimizer/),
listés ci-dessous ; les contraintes critiques dans les invariants
([03-developpeur/optimizer/](../../03-developpeur/optimizer/)), le seul
fichier qui se lit en entier. Tout le reste se lit **par section**, après
`node scripts/spec-toc.mjs <fichier>`.

## Fichiers de l'Optimizer

Dans ce dossier (l'application) :

- [routage-par-tache.md](routage-par-tache.md) — ce routage.
- [feat-ecran.md](feat-ecran.md) — l'écran, de haut en bas, et le
  routage vers un fichier par bloc de l'écran.
- [feat-listes-et-reservation.md](feat-listes-et-reservation.md) — listes de
  travail, builds validés, réservation de runes et d'artéfacts.
- [feat-exclusion.md](feat-exclusion.md) — exclusion automatique et manuelle,
  runes imposées.
- [feat-interruption.md](feat-interruption.md) — filet de temps, arrêt
  manuel, barre de progression.
- [limites-connues.md](limites-connues.md) — ce que le moteur ne garantit
  pas.

Dans [03-developpeur/optimizer/](../../03-developpeur/optimizer/) (le moteur) :

- `invariants.md` — les contraintes critiques, chacune avec sa source.
- `moteur-pipeline.md` — de la recherche lancée au résultat affiché :
  préparation, moitiés, appariement, résolution, file.
- `harnais.md` — mode d'emploi du harnais de diagnostic et ce qu'il garantit.
- `harnais-extensions.md` — le harnais au-delà de son mode d'emploi :
  construction observée, build cible, différentiel.
- `harnais-scripts.md` — le harnais sur les cas connus, et les scripts de
  diagnostic qui restent à côté de lui.
- `moteur-elagages.md` — meet-in-the-middle, élagages sûrs, pré-filtrage,
  rétention.
- `moteur-artefacts.md` — le choix des artéfacts et la paire non figée.
- `moteur-optimiseur-artefacts.md` — l'optimiseur d'artéfacts : éligibilité,
  effet de chaque ligne, focus élémentaire, moteur, script CLI.
- `verification.md` — tests différentiels, oracles, benchmarks.
- `moteur-parallelisation.md` — l'appariement parallèle, navigateur et Node,
  et le Worker de résolution.
- `moteur-reliques.md` — la dimension relique : contexte, bornes, résolution
  exacte, effet unique, oracle.
- `moteur-diagnostics.md` — faisabilité, conditions bloquantes, quasi-succès
  (« near-miss »).

Dans [07-pilotage/](../../07-pilotage/) : les pistes futures de l'Optimizer
(constat, idée, ce qui les bloque), et celles qui accéléreraient la recherche
sans changer ce qu'elle cherche, avec celles des tests, du harnais et des
scripts de mesure.

## Je touche…

« dev/ » désigne ci-dessous [03-developpeur/optimizer/](../../03-developpeur/optimizer/).

| Je touche… | Lire d'abord | Puis |
| --- | --- | --- |
| la mise en page de l'écran (grille bureau, panneau « Options » au doigt, dépliants) | [feat-ecran.md § Écran (de haut en bas)](feat-ecran.md) ; [dev/ (invariants) § UI](../../03-developpeur/optimizer/) ; [03-developpeur/interface/ (design)](../../03-developpeur/interface/) | [feat-ecran.md](feat-ecran.md) ; [03-developpeur/interface/ (deux formats)](../../03-developpeur/interface/) |
| la recherche du monstre, l'exemplaire, la fiche « Équipement actuel » | [feat-ecran-recherche-du-monstre.md § Recherche du monstre à optimiser](feat-ecran-recherche-du-monstre.md) ; [feat-ecran-equipement-actuel.md § Équipement actuel](feat-ecran-equipement-actuel.md) ; [dev/ (invariants) § UI](../../03-developpeur/optimizer/) | [feat-ecran.md](feat-ecran.md) |
| les listes de travail, les builds validés, la réservation de runes | [feat-listes-et-reservation.md § Listes de travail et réservation de runes](feat-listes-et-reservation.md) ; [dev/ (invariants) § UI](../../03-developpeur/optimizer/) | [feat-listes-et-reservation.md](feat-listes-et-reservation.md) |
| l'objectif de recherche, « Dégâts réels », un passif ou une mécanique de sort | [feat-ecran-objectif-de-recherche.md § Objectif de recherche](feat-ecran-objectif-de-recherche.md) ; [degats-reels/](../degats-reels/) (par section) ; [dev/ (invariants) § Dégâts réels](../../03-developpeur/optimizer/) | skill `game-data-curation` |
| les conditions min/max, « Exclure les runes déjà utilisées », les réglages avancés | [feat-ecran-conditions-et-reglages.md § Conditions, inventaire et réglages avancés](feat-ecran-conditions-et-reglages.md) ; [dev/ (invariants) § Stats et slots](../../03-developpeur/optimizer/) | — |
| les artéfacts (optimisation, carte Artéfacts, « État de mon monstre ») | [feat-ecran-artefacts.md § Artéfacts](feat-ecran-artefacts.md) ; [feat-ecran-etat-de-mon-monstre.md § État de mon monstre](feat-ecran-etat-de-mon-monstre.md) ; [dev/ (moteur-artefacts) § Le choix des artéfacts — un second problème, séparé](../../03-developpeur/optimizer/) ; [dev/ (invariants) § Artéfacts](../../03-developpeur/optimizer/) | [dev/ (moteur-artefacts, moteur-optimiseur-artefacts)](../../03-developpeur/optimizer/) |
| les reliques | [feat-ecran-relique.md § Relique](feat-ecran-relique.md) ; [dev/ (invariants) § Reliques](../../03-developpeur/optimizer/) | [dev/ (moteur-reliques)](../../03-developpeur/optimizer/) ; assiette « au début du combat » : [degats-reels/ (effets d'équipe et leaders) § Sets d'aura d'équipe — modèle](../degats-reels/) |
| l'exclusion de runes (automatique, manuelle), les runes imposées | [feat-exclusion.md § Exclusion des runes déjà portées ailleurs](feat-exclusion.md) ; [feat-exclusion.md § Exclusion manuelle — un monstre précis, dans n'importe quelle source](feat-exclusion.md) ; [feat-exclusion.md § Runes imposées — verrouiller un emplacement sur une rune précise](feat-exclusion.md) | [feat-exclusion.md](feat-exclusion.md) ; [limites-connues.md](limites-connues.md) (CLI siège, `wizard_id`) |
| le moteur `runeBuildOptim.ts` (élagages, meet-in-the-middle, budgets, presets) | [dev/ (moteur-elagages) § Recherche des runes — meet-in-the-middle et élagages](../../03-developpeur/optimizer/) ; [dev/ (invariants) § Algorithme](../../03-developpeur/optimizer/) ; [limites-connues.md § Limites connues](limites-connues.md) | [dev/ (moteur-pipeline, moteur-elagages)](../../03-developpeur/optimizer/) ; [limites-connues.md](limites-connues.md) ; skill `algo-verify` ; [07-pilotage/ (pistes de l'Optimizer)](../../07-pilotage/) avant toute « nouvelle » idée |
| la vérification du moteur (tests différentiels, oracles, benchmarks) | [dev/ (verification) § Vérification](../../03-developpeur/optimizer/) | skill `optimizer-perf-testing` (pièges de mesure) |
| l'interruption, la barre de progression, le cycle de vie du Worker | [feat-interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](feat-interruption.md) ; [feat-interruption.md § Barre de progression](feat-interruption.md) ; [dev/ (invariants) § Workers](../../03-developpeur/optimizer/) | [feat-interruption.md](feat-interruption.md) ; [dev/ (moteur-pipeline ; moteur-parallelisation si l'appariement parallèle est concerné)](../../03-developpeur/optimizer/) |
| la parallélisation de l'appariement (navigateur/Node), le Worker de résolution | [dev/ (invariants) § Workers, § Algorithme](../../03-developpeur/optimizer/) | [dev/ (moteur-parallelisation)](../../03-developpeur/optimizer/) |
| le diagnostic « 0 résultat », le quasi-succès (« near-miss ») | [feat-ecran-resultats.md § Résultats](feat-ecran-resultats.md) ; [dev/ (invariants) § Algorithme](../../03-developpeur/optimizer/) | [dev/ (moteur-diagnostics ; harnais si l'instrumentation est concernée)](../../03-developpeur/optimizer/) |
| le harnais de diagnostic | [dev/ (invariants) § Harnais](../../03-developpeur/optimizer/) | [dev/ (harnais, harnais-extensions, harnais-scripts)](../../03-developpeur/optimizer/) ; skill `optimizer-perf-testing` |
| la recette (export/import, un champ d'`OptimizerState`/`OptimizerRecipe`) | [feat-ecran-lancer-la-recherche.md § Lancer la recherche](feat-ecran-lancer-la-recherche.md) ; skill `optimizer-field-propagation` (plusieurs constructeurs) | [feat-exclusion.md § Exclusion des runes déjà portées ailleurs](feat-exclusion.md) (repli de compatibilité `exploreAll`) |
| les cartes de résultat (tri, moyenne par rune, popover de rune) | [feat-ecran-resultats.md § Résultats](feat-ecran-resultats.md) ; [dev/ (invariants) § UI](../../03-developpeur/optimizer/) | [rta/ (sections runes)](../rta/) pour `StatPanel`/`RuneWheel`/`ArtifactSlots` partagés |
| une piste de perf ou une idée « nouvelle » | [07-pilotage/ (pistes de l'Optimizer, vitesse et vérification)](../../07-pilotage/) | la spec du mécanisme concerné, qui dit une piste écartée avec sa raison |
| la vitesse (speed tune, ordre des tours) | [speed-tuning/](../speed-tuning/) (le modèle réel) | — |
| une spec de ce dossier (en-têtes, lint, publication) | [03-developpeur/ (outillage de la doc)](../../03-developpeur/) ; `node scripts/spec-lint.mjs` | [03-developpeur/ (renvois)](../../03-developpeur/) |

Pas dans ce tableau : les fichiers de code de l'écran et du moteur, listés en
tête de [README.md](README.md) (« Fichiers : … »).
