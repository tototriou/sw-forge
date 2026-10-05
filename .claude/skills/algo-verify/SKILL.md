---
name: algo-verify
description: Discipline à suivre pour tout algorithme de recherche combinatoire ou d'optimisation sous contraintes ajouté ou modifié dans SW Blacksmith (ex. runeBuildOptim.ts) — jamais un seul choix d'algorithme "qui a l'air de marcher" sans référence de contrôle, test différentiel et benchmark chiffré avant de figer des constantes.
---

# Vérification des algorithmes combinatoires (SW Blacksmith)

Ce skill porte sur la **discipline de vérification** avant de considérer
une implémentation comme fiable (ex. le moteur de recherche de builds,
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), pas sur la connaissance
d'une technique (branch-and-bound, meet-in-the-middle…).

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
  ou de complétude. La **parallélisation** d'un algorithme déjà correct
  compte aussi (ex. `pairBuckets` séquentiel → `partitionBucketsALPT` +
  `runParallelPairing` + `pairSlice.worker.ts`, plusieurs Workers) : changer
  COMMENT le travail est réparti peut introduire une classe de bug propre
  (perte de candidats par déséquilibre de charge entre workers), même sans
  toucher au critère de sélection lui-même.
- **Tout script ad hoc (diagnostic, reproduction d'un cas signalé, mesure) qui
  appelle les fonctions internes du moteur directement** (`prepareSearch`,
  `buildBuckets`, `pairBuckets`…) plutôt que l'API publique (`searchBuilds`/
  `searchBuildsSteps`) — voir « Fidélité des scripts diagnostics » ci-dessous.
  ⚠️ **Et d'abord se demander si ce script doit exister** :
  `scripts/diagnostic-harness.ts` couvre déjà la plupart de ces questions, en
  étant fidèle par construction (voir la section ci-dessous). Ce déclencheur
  vaut pour CHAQUE script écrit, pas une fois par tâche.

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
   n'existent qu'au VOLUME réel**, parce qu'une référence brute-force
   n'énumère que de petits pools (`rune-optim-differential.test.ts` :
   3 runes/slot), alors qu'un bug de rétention comme la dilution
   `BUCKET_CAP`/`slotFilterCap` n'apparaît que sur des pools de centaines
   de runes par slot. Une constante de RÉTENTION/CAPPING
   (qui ne joue un rôle qu'une fois le volume de candidats dépassé) a
   besoin d'un test dédié à l'échelle réelle (voir point 4), PAS d'une
   simple extension du test différentiel existant — les deux répondent à
   des questions différentes (« le moteur trouve-t-il la bonne réponse » vs
   « le moteur perd-il une bonne réponse qu'il avait déjà en élargissant un
   paramètre »), voir `rune-optim-scale-monotonicity.test.ts` pour un
   exemple du second genre.
   ⚠️ **De la même façon, un budget de TEMPS artificiellement court peut
   faire diverger un test différentiel sans que ce soit représentatif d'un
   usage réel**, parce qu'il faut un minimum de temps RÉEL pour qu'un
   déséquilibre de charge initial entre workers se corrige, et qu'AUCUN
   réglage d'écran ni arrêt manuel réel ne descend à quelques centaines de
   millisecondes : un utilisateur ne met jamais de limite de temps, tout au
   plus il arrête une recherche au bout de quelques dizaines de secondes. Voir
   `tests/rune-optim-parallel-pairing.test.ts` (`maxMs=30000` committé
   comme plancher vérifié) et la mémoire
   `sw-forge-realistic-test-parameters.md`. Un paramètre juste « assez
   extrême pour déclencher le chemin de code » (peu de temps, un plafond
   serré…) peut être QUALITATIVEMENT différent d'un paramètre réaliste —
   vérifier À L'ÉCHELLE D'USAGE RÉELLE avant de conclure à un risque, pas
   seulement à l'échelle qui fait apparaître le symptôme.
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
   qu'UNE phase. Repère : `buildBuckets` seul
   (sans `pairBuckets`) répond en quelques secondes à « ce demi-build
   survit-il à la rétention ? », contre plusieurs minutes (jusqu'à
   `HARD_TIMEOUT_MS`) pour la même question posée
   via une recherche complète. Avant de
   relancer un pipeline complet pour vérifier un changement, se demander
   quelle phase il touche réellement, et s'il existe un point d'arrêt
   intermédiaire qui répond déjà à la question posée. Voir le skill
   `optimizer-perf-testing` pour la boîte à outils complète (quel script
   utiliser pour quelle question) et les pièges de mécanique de mesure
   déjà rencontrés (contention, `git worktree`, `spawn` sur Windows) — ce
   point-ci reste le SEUL qui touche à la correction de l'algorithme
   lui-même, le reste est hors du périmètre de ce skill-ci.

## Fidélité des scripts diagnostics

### ⚠️ D'abord : ne pas écrire le script

`scripts/diagnostic-harness.ts` existe précisément pour ça. Il **orchestre et
observe** les fonctions de production — il ne réimplémente aucune étape — et
il rend d'office ce qu'un script ad hoc doit sinon penser à faire :
l'ORIGINE de chaque paramètre effectif (dont le `bucketCap` **dérivé** de
`slotFilterCap`), le marquage « DIVERGE DE LA PROD » dès qu'un override est
posé, le régime d'appariement choisi comme la production le choisirait, la
complétude avec son motif, l'autodiagnostic `explored` contre `totalPairs`,
et la distinction élagage SÛR / rétention HEURISTIQUE.

⚠️ **Il répond en particulier à la question** — *« ce build de 6 runes est-il
dans le résultat, et sinon, QUI l'a perdu ? »* :

```
diagnostic-harness.ts … --suivre=<les 6 ids du build>
```

Six identifiants dans `--suivre` (pas d'option de plus) et il rend un
**verdict structuré**, qui cherche le PREMIER POINT DE DIVERGENCE au lieu de
constater l'absence finale : `ENTRÉE_INADMISSIBLE` · `MOITIÉ_A_ÉCARTÉE` ·
`MOITIÉ_B_ÉCARTÉE` · `ABSENT_DES_COMPARTIMENTS` · `PERDUE_À_L_APPARIEMENT`
(avec l'ÉTAGE d'appariement qui a coupé la paire) · `PRÉSENT_DANS_LE_TOP_N` ·
`PRÉSENT_HORS_TOP_N` **avec son rang** · `NON_OBSERVABLE`.

**Le rang vient du classement ENTIER**, jamais d'un top-N déjà coupé.

⚠️ **Deux valeurs à ne jamais contourner en les remplaçant par une cause
plausible** :
- `NON_OBSERVABLE` n'est pas un aveu de faiblesse — c'est ce qui EMPÊCHE
  l'outil de fabriquer une cause quand il n'en connaît pas.
- `PERDUE_À_L_APPARIEMENT` nomme l'ÉTAGE, pas une perte : il recouvre une
  paire écartée par un élagage SÛR (elle ne pouvait rien produire) ET une
  paire visitée dont le build échoue le test conjoint (il ne satisfait pas les
  conditions posées). L'`explication` distingue les deux.

⚠️ **Et il ne se lit JAMAIS sans sa complétude**, qui voyage dans le verdict
lui-même : sur un run TRONQUÉ, « la cible n'est pas dans le classement » ne
veut pas dire « le moteur ne la trouve pas ».

**Avant d'écrire un script qui appelle `prepareSearch`/`buildBuckets`/
`pairBuckets`, vérifier que le harnais ne répond pas déjà à la question**,
parce qu'un script ad hoc dérive précisément sur ce que le harnais fait
d'office (contexte min/max reconstruit à la main, `guaranteedMin` et les
bornes d'artéfact manquants).

Le diff ligne à ligne décrit plus bas garde tout son sens pour ce que le
harnais ne couvre PAS : l'intérieur de `buildBuckets`, une charge concurrente
opposée au moteur, un prototype d'algorithme. Dans ces cas-là, tout ce qui
suit s'applique intégralement.

### Quand le script est nécessaire quand même

⚠️ **Un script qui copie la séquence d'appels de la production
(`prepareSearch`/`buildBuckets`/`pairBuckets`) peut rester infidèle sans que
`tsc` ni les types ne le détectent** : l'appel est parfaitement valide, juste
incomplet.

⚠️⚠️ Le moteur n'a plus de budget de paires ni d'escalade (voir
`spec/outils/optimizer/pistes.md`, piste 8, et
`archive/historique/historique-diagnostics-et-robustesse.md`, « Suite — suppression du budget de
nœuds ») : `pairBuckets(prepared, bucketsA, bucketsB)` prend TROIS arguments,
et un appel nu explore exactement ce
que la production explore. Ne pas chercher à « reproduire l'escalade » dans un
script neuf — un script qui la reproduirait aujourd'hui serait lui-même
infidèle.

**La règle** : *un script infidèle qui ne
trouve rien ressemble EXACTEMENT à un vrai bug*. Les deux façons de le
devenir, aujourd'hui :

- **Réimposer une limite que la production n'a plus.** Un plafond de paires
  posé « pour que ça finisse » (dans la boucle de pilotage, ou via un `maxMs`
  raccourci) mesure une recherche TRONQUÉE, pas la recherche réelle. Si un
  script en a besoin comme instrument (voir `optimum-rank-diag.ts`, qui coupe
  sur `step.value.explored`), il doit le dire dans sa sortie, jamais le
  laisser passer pour une recherche complète.
- **Le budget-TEMPS, qui est désormais la SEULE borne pouvant tronquer.**
  `searchBuilds` retombe sur `DEFAULT_MAX_MS` = **15 s** quand l'appelant ne
  précise rien, alors que l'écran donne 10 min (`HARD_TIMEOUT_MS`) — ou
  `Infinity` en mode exhaustif. Un script qui omet `maxMs` mesure donc une
  recherche 40× plus courte que celle de l'utilisateur, avec exactement la
  signature d'échec d'un vrai bug (« rien trouvé »). **C'est le
  premier paramètre à vérifier** dans tout script de mesure.

⚠️ Corollaire à ne pas manquer : `totalPairCount` est maintenant la borne
EXACTE de l'espace (`explored` ne peut pas la dépasser, prédicats identiques).
Un script qui trouve `explored < totalPairCount` sur une recherche annoncée
exhaustive a donc été tronqué — par le temps ou par lui-même. C'est un
autodiagnostic gratuit : l'afficher en tête de sortie vaut mieux que le
déduire après coup.

## ⚠️ La fidélité s'arrête rarement à la recherche : elle va jusqu'à l'ÉCRAN

⚠️ **`SearchResult.candidates` n'est PAS trié par l'objectif.** L'ordre est
celui de la collecte à l'appariement. Le classement est celui de
`sortCandidates` (runeBuildOptim.ts), source unique partagée : lire
`result.candidates[0]` comme le meilleur build est faux.

**Le « vrai chemin de production » inclut ce que l'ÉCRAN fait du résultat**,
pas seulement ce que le moteur calcule. Avant de conclure quoi que ce soit
d'une sortie de moteur, se demander : *l'écran applique-t-il encore un tri,
un filtre, un repli, un recalcul, après cet appel ?* Chercher dans le
composant, pas seulement dans la lib.

⚠️ **Et faire d'abord le test le moins cher.** Avant « le moteur manque X »,
poser `candidates.findIndex(…)` : trois lignes qui distinguent *absent* de
*mal classé*. Comparer un score au premier élément d'une liste non triée ne
prouve rien — et ressemble EXACTEMENT à un vrai bug.

### La CHARGE opposée au système est un chemin de production, elle aussi

⚠️ Tout ce qui précède porte sur l'appel au MOTEUR. Ce piège-ci porte sur la
**charge** qu'un script de mesure oppose au système — et elle se vérifie
exactement pareil.

Exemple : une charge qui rejoue bien `chercherPaires`, le vrai point
d'entrée, mais dont l'`evaluer` somme les stats au lieu de dérouler le
calcul de dégâts ne lit **aucune sous-propriété d'artéfact**.

La cascade, invisible à la lecture du script :

1. `analyserPertinence` sonde chaque code contre `evaluer` → aucune ligne ne
   fait bouger le score → **zéro ligne « croissante »** ;
2. sans dimensions, la dominance ne compare plus que les 3 stats principales ;
3. l'inventaire s'effondre de ~12 000 paires parcourues à **une poignée** ;
4. la « charge » coûte **0,4 ms au lieu de 86 ms**.

La mesure annonce alors « aucun ralentissement » : vrai, et vide de sens, il
n'y a aucune charge. ⚠️ **Rien dans le script ne le dit** — seul un compteur
incohérent, s'il figure dans la sortie, le trahit.

**Contre-mesure : faire dire au script sa PROPRE fidélité, avant de mesurer.**
Deux nombres en tête de sortie, avec leur fourchette attendue :

```
Charge par build : 86 ms sur 12 315 paires parcourues.
(attendu ~75-85 ms sur ~12 000 paires — bien moins signale une charge effondrée)
```

Une charge effondrée se voit alors à la première ligne, au lieu de se déduire
après coup en relisant des compteurs. ⚠️ La fourchette doit venir d'une mesure
INDÉPENDANTE et citer le bon régime : un repère pris sur l'espace NON élagué
est faux, la production élaguant elle aussi.

⚠️ **Un évaluateur simplifié n'est jamais anodin quand l'algorithme s'en sert
pour DÉCIDER.** `analyserPertinence` et la
dominance en dérivent leur comportement. Remplacer un score par « quelque chose
de moins cher » change alors la STRUCTURE de ce qui est exécuté, pas seulement
sa valeur.


**Règle** : avant de faire confiance au résultat d'un script qui appelle les
internes du moteur (pas l'API publique `searchBuilds`), le DIFFER
explicitement, ligne par ligne, contre le vrai chemin de production —
`runeBuildOptim.worker.ts` (recherche séquentielle) et/ou `perf-battery.ts`,
**et `pairSliceBody.ts` si le script touche l'appariement PARALLÉLISÉ**
(chaque tranche y reçoit sa PART du plafond de candidats,
`perWorkerMaxCollected`, et le `startedAt` GLOBAL — un script qui donnerait à
chaque tranche le plafond entier, ou un chrono frais, mesurerait autre chose
que la production) — pas seulement « même noms de fonctions dans le même
ordre ». En particulier vérifier :
- Tout paramètre optionnel avec une valeur par défaut différente du
  comportement réel. ⚠️ Le cas d'école (`pairBuckets(..., nodeBudget)`, 4ᵉ
  argument au défaut FIGÉ) a été supprimé — mais `maxMs` en est un autre,
  bien vivant : `searchBuilds` retombe sur 15 s là où l'écran donne 10 min.
- Toute boucle englobante autour d'un générateur (`while (!step.done)`) dans
  le vrai chemin — un simple `drain()` qui ignore les valeurs intermédiaires
  (`step.value` à chaque itération) est un signal qu'un comportement basé sur
  la PROGRESSION (arrêt anticipé, relevé d'un instant précis, coupure de
  mesure) a pu être perdu. Inversement, une boucle pas à pas qui ne fait RIEN
  de `step.value` n'a aucune raison d'exister : `drain()` suffit.
- Les VALEURS de chaque paramètre transmis (caps, objectif, metric, pool,
  exclusions…), pas seulement leur présence — un défaut d'écran qui a changé
  depuis la dernière fois (ex. l'exclusion automatique de runes, renommée ET
  son défaut INVERSÉ entre deux sessions — « Utiliser tout l'inventaire »
  cochée par défaut devenue « Exclure les runes déjà utilisées » décochée
  par défaut, voir `excludeUsedRunes`/`autoExcludedRuneIds`) invalide
  silencieusement un script écrit avant ce changement.
Si le script reproduit un cas signalé par l'utilisateur, ne jamais conclure
« bug confirmé dans le moteur » avant que cette fidélité soit vérifiée — un
script infidèle qui ne trouve rien ressemble EXACTEMENT à un vrai bug.

## Arithmétique joker/pièces — ne jamais généraliser par analogie

⚠️ **Classe d'erreur à ne pas commettre** : combiner « pièces réelles
d'un set » (`counts[k]`)
et « crédit joker » (`jokers`/`jokerCredit`) par analogie avec une borne
déjà établie ailleurs dans le fichier, sans revérifier que le résultat
tient dans la limite physique de **3 emplacements par moitié** (6 au
total, meet-in-the-middle).
1. `stillFeasible` (élagage optimiste dans `buildBuckets`) additionne
   `otherHalfMaxSets[k] + jokerCredit` comme si les deux étaient
   atteignables INDÉPENDAMMENT dans la même moitié de 3 emplacements —
   défaut identifié, resté non corrigé (la vérification EXACTE en aval,
   `demiBuildMort`/`activeSets` final, garantit la justesse malgré cette
   sur-addition — un pruning trop généreux ne peut qu'ÉCHOUER à couper
   une branche morte, jamais couper une branche valide à tort, donc pas
   un bug actif, mais révèle déjà le biais).
2. Une condition de « compartiment de secours » `counts[k] =
   requiredPieces[k]-1 ET jokers=1` pour un set à 4 pièces est physiquement
   IMPOSSIBLE (3 pièces réelles + 1 joker = 4 runes dans une moitié qui
   n'en contient que 3). La condition RÉELLEMENT prouvée par
   `demiBuildMort` est `counts[k]=0 ET jokers≥1` : la moitié n'apporte
   AUCUNE pièce réelle, uniquement le joker, et ne survit QUE parce que
   l'AUTRE moitié devra fournir EXACTEMENT ses 3 pièces réelles (le
   maximum physique d'une moitié) pour atteindre 4 au total — la
   configuration la plus tendue possible, pas « une pièce manque,
   n'importe où ».

**Règle** : avant d'énoncer une formule ou une condition impliquant
`counts[k]`/`jokers`/`requiredPieces[k]` (pruning, priorité de
classement, estimation…), écrire concrètement l'inventaire des 3
emplacements d'UNE moitié (quelles runes, combien de réelles, combien de
jokers) et vérifier que la somme ne dépasse jamais 3 — jamais réutiliser
par analogie une borne déjà établie pour un AUTRE cas sans repasser par
ce calcul concret à chaque fois.

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
- [ ] Aucun script de diagnostic n'a été écrit pour une question à laquelle
      `scripts/diagnostic-harness.ts` répond déjà — et si un script était
      quand même nécessaire, sa fidélité au chemin de prod a été diffée
      explicitement.
- [ ] `npx tsc --noEmit`, `npm test` et `npm run build` passent.
