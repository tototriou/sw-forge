---
name: algo-verify
description: Discipline à suivre pour tout algorithme de recherche combinatoire ou d'optimisation sous contraintes ajouté ou modifié dans SW Forge (ex. runeBuildOptim.ts) — jamais un seul choix d'algorithme "qui a l'air de marcher" sans référence de contrôle, test différentiel et benchmark chiffré avant de figer des constantes.
---

# Vérification des algorithmes combinatoires (SW Forge)

Née de la comparaison entre le moteur de recherche de builds
([runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) et une conversation externe sur
le même problème : le point qui manquait n'était pas la connaissance d'une
technique (branch-and-bound, meet-in-the-middle…), mais la **discipline de
vérification** avant de considérer une implémentation comme fiable.

## Quand ce skill s'applique

- Ajout ou modification d'un algorithme de **recherche sous contraintes** ou
  d'**optimisation combinatoire** dans `src/lib/` (sélection d'un sous-ensemble
  optimal parmi beaucoup de candidats, avec des contraintes à satisfaire et un
  critère à maximiser).
- Changement d'une **constante de performance** existante (bornes de
  pré-filtrage, budget de nœuds, plafond de candidats collectés…) dans un tel
  moteur.
- Réécriture d'un algorithme existant vers une technique plus complexe
  (ex. branch-and-bound → meet-in-the-middle) pour des raisons de performance
  ou de complétude.
- **Tout script ad hoc (diagnostic, reproduction d'un cas signalé, mesure) qui
  appelle les fonctions internes du moteur directement** (`prepareSearch`,
  `buildBuckets`, `pairBuckets`…) plutôt que l'API publique (`searchBuilds`/
  `searchBuildsSteps`) — voir « Fidélité des scripts diagnostics » ci-dessous.

**Hors périmètre** : filtres, tris simples, ou calculs qui ne cherchent pas
« la meilleure combinaison parmi énormément de possibilités » — un `Array.sort`
ou un filtre linéaire n'a pas besoin de cette discipline.

## Méthode

1. **Référence de contrôle, avant tout.** Écrire (ou réutiliser) une version
   **volontairement naïve et exhaustive**, valable uniquement sur de petites
   entrées (quelques dizaines d'éléments) — jamais optimisée, jamais pré-filtrée.
   C'est elle qui définit « la bonne réponse ».
2. **Test différentiel, pas seulement des cas écrits à la main.** En plus des
   cas manuels (`egal`/`ok` sur des scénarios précis, déjà la norme dans
   `tests/`), générer plusieurs jeux de données **aléatoires mais
   déterministes** (seed fixe) de petite taille, et vérifier que le moteur
   optimisé retrouve **exactement** ce que trouve la référence — mêmes
   candidats valides, ou au minimum même verdict de faisabilité et même
   meilleure valeur. Un algorithme qui ne diverge jamais sur des dizaines de
   jeux aléatoires est une preuve bien plus solide que trois cas choisis à la
   main.
   ⚠️ **Un test différentiel à PETITE échelle ne couvre PAS les bugs qui
   n'existent qu'au VOLUME réel.** Vécu directement : `rune-optim-
   differential.test.ts` (3 runes/slot, comparé à une référence
   brute-force) passait de façon identique avec et sans le bug de dilution
   `BUCKET_CAP`/`slotFilterCap` — ce bug n'apparaît que sur des pools de
   centaines de runes par slot, très au-delà de ce qu'une référence
   brute-force peut encore énumérer. Une constante de RÉTENTION/CAPPING
   (qui ne joue un rôle qu'une fois le volume de candidats dépassé) a
   besoin d'un test dédié à l'échelle réelle (voir point 4), PAS d'une
   simple extension du test différentiel existant — les deux répondent à
   des questions différentes (« le moteur trouve-t-il la bonne réponse » vs
   « le moteur perd-il une bonne réponse qu'il avait déjà en élargissant un
   paramètre »), voir `rune-optim-scale-monotonicity.test.ts` pour un
   exemple du second genre.
3. **Ne jamais choisir une stratégie sur intuition.** Si plusieurs approches
   sont plausibles (brute-force / backtracking / branch-and-bound /
   meet-in-the-middle…), les implémenter — au moins à l'état de prototype — et
   les **mesurer**, pas les deviner. La décision se justifie par un chiffre,
   pas par « ça semble plus malin ».
4. **Benchmark aux échelles réelles avant de figer une constante.** Les
   volumes réels du projet sont connus (voir
   [compte/calcul-runes.md](../../../spec/compte/calcul-runes.md) §6 et
   [compte/runes.md](../../../spec/compte/runes.md) — comptes réels à
   plusieurs milliers de runes). Toute constante ajustable (plafond par slot,
   budget de nœuds, nombre de candidats collectés…) doit être calibrée sur des
   jeux synthétiques d'au moins 500 / 1000 / 2000 / 3000+ éléments, en notant
   temps d'exécution et, si pertinent, nombre de branches explorées/élaguées —
   pas une valeur choisie « au jugé » et jamais revérifiée.
5. **Documenter, pas seulement coder.** Le résultat (constante retenue,
   pourquoi cette technique plutôt qu'une autre, limites connues — ex.
   « heuristique, pas une garantie d'optimalité globale ») va dans le fichier
   `spec/` concerné, avec un ⚠️ si c'est un piège à ne pas retomber dedans —
   même convention que le reste de `spec/`.
6. **Vérifier au bon ÉTAGE du pipeline, pas systématiquement de bout en
   bout.** Un pipeline en plusieurs phases (ex. `prepareSearch` →
   `buildBuckets` → `pairBuckets` dans `runeBuildOptim.ts`) n'a pas besoin
   d'être rejoué EN ENTIER pour vérifier une hypothèse qui ne concerne
   qu'UNE phase. Repère utilisé toute cette session : `buildBuckets` seul
   (sans `pairBuckets`) répond en quelques secondes à « ce demi-build
   survit-il à la rétention ? », contre plusieurs minutes (jusqu'à
   `HARD_TIMEOUT_MS`, avec l'escalade de budget) pour la même question posée
   via une recherche complète — c'est cette différence qui a rendu possible
   toute l'investigation `BUCKET_CAP` en un temps raisonnable. Avant de
   relancer un pipeline complet pour vérifier un changement, se demander
   quelle phase il touche réellement, et s'il existe un point d'arrêt
   intermédiaire qui répond déjà à la question posée. Voir le skill
   `optimizer-perf-testing` pour la boîte à outils complète (quel script
   utiliser pour quelle question) et les pièges de mécanique de mesure
   déjà rencontrés (contention, `git worktree`, `spawn` sur Windows) — ce
   point-ci reste le SEUL qui touche à la correction de l'algorithme
   lui-même, le reste est hors du périmètre de ce skill-ci.

## Fidélité des scripts diagnostics

⚠️ **Incident vécu** : un script écrit pour reproduire un cas signalé par
l'utilisateur (builds Sonia qui diminuent quand `slotFilterCap` augmente)
appelait `prepareSearch`/`buildBuckets`/`pairBuckets` directement, en copiant
la même séquence d'appels que `searchBuildsSteps` — mais SANS l'escalade de
budget (`NodeBudget` mutable, `ESCALATION_FACTOR=2`, doublé tant qu'il reste
du temps sous `maxMs` et pas assez de candidats), présente à la fois dans
`runeBuildOptim.worker.ts` (le vrai chemin de prod) et `perf-battery.ts`. Le
script s'arrêtait donc net au budget INITIAL (~38M paires) au lieu de monter
à ~600M+ comme la vraie recherche sur 10 minutes — il n'explorait qu'une
fraction dérisoire (~3×10⁻⁶ %) de l'espace réellement couvert. Résultat :
« 0 build trouvé » partout, un faux signal de bug pris pour argent comptant
pendant une bonne partie d'une session, alors que `tsc`/les types ne
pouvaient rien détecter (l'appel était parfaitement valide, juste
incomplet).

**Règle** : avant de faire confiance au résultat d'un script qui appelle les
internes du moteur (pas l'API publique `searchBuilds`), le DIFFER
explicitement, ligne par ligne, contre le vrai chemin de production
(`runeBuildOptim.worker.ts`) et/ou `perf-battery.ts` — pas seulement « même
noms de fonctions dans le même ordre ». En particulier vérifier :
- Tout paramètre optionnel avec une valeur par défaut différente du
  comportement réel (ici `pairBuckets(..., nodeBudget)` — le 4ᵉ argument a un
  défaut FIGÉ, documenté comme tel, alors que la prod passe toujours un objet
  mutable + une boucle d'escalade autour du générateur).
- Toute boucle englobante autour d'un générateur (`while (!step.done)`) dans
  le vrai chemin — un simple `drain()` qui ignore les valeurs intermédiaires
  (`step.value` à chaque itération) est un signal qu'un comportement basé sur
  la PROGRESSION (escalade, arrêt anticipé, mise à jour d'un budget) a pu
  être perdu.
- Les VALEURS de chaque paramètre transmis (caps, objectif, metric, pool,
  exclusions…), pas seulement leur présence — un défaut d'écran qui a changé
  depuis la dernière fois (ex. « Utiliser tout l'inventaire » passé de
  décoché à coché par défaut) invalide silencieusement un script écrit avant
  ce changement.
Si le script reproduit un cas signalé par l'utilisateur, ne jamais conclure
« bug confirmé dans le moteur » avant que cette fidélité soit vérifiée — un
script infidèle qui ne trouve rien ressemble EXACTEMENT à un vrai bug.

## Checklist avant de considérer un tel algorithme comme terminé

- [ ] Une référence naïve/exhaustive existe, même si elle n'est utilisée que
      dans les tests.
- [ ] Au moins un test différentiel (jeux aléatoires, seed fixe) compare le
      moteur optimisé à cette référence.
- [ ] Si une constante de RÉTENTION/CAPPING est en jeu (elle ne joue un rôle
      qu'au-delà d'un certain volume de candidats) : au moins un test de
      régression à ÉCHELLE RÉELLE existe en plus du test différentiel à
      petite échelle — celui-ci ne peut PAS le remplacer (voir point 2).
- [ ] Les cas limites connus sont couverts par des tests écrits à la main
      (contrainte inatteignable, exclusion, égalité de score…).
- [ ] Si plusieurs stratégies étaient plausibles, au moins deux ont été
      mesurées avant de choisir.
- [ ] Chaque constante ajustable a été testée à une échelle proche des
      volumes réels du projet, pas seulement sur un petit jeu de test.
- [ ] Les limites connues (heuristique, non-exhaustivité au-delà d'un budget…)
      sont écrites dans le fichier `spec/` correspondant.
- [ ] `npx tsc --noEmit`, `npm test` et `npm run build` passent.
