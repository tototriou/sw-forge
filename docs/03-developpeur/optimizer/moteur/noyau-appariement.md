# Noyau d'appariement sur tableaux typés

Voir aussi : pipeline.md, elagages.md, parallelisation.md, ../verification.md, ../invariants.md.

Ce que fait le noyau de l'appariement de production, `apparierRapide`
(`src/lib/appariementRapide.ts`), et pourquoi il rend exactement le résultat
de `pairBuckets` (`src/lib/runeBuildOptim.ts`), la référence. Il sert
l'appariement séquentiel (`apparier`, `src/lib/rechercheRunes.ts`) et chaque
Worker de l'appariement parallèle (`parcourirMorceau`). Sa place dans une
recherche : [pipeline.md § Appariement séquentiel](pipeline.md). Pourquoi
des seuils exacts sur tableaux typés, et ce qu'ils écartent :
[ADR](../../../04-decisions/adr/appariement-par-seuils-exacts.md).

## Ce qui change, ce qui ne change pas

Le noyau ne remplace que la boucle la plus intérieure de `pairBuckets`,
celle des combinaisons B. L'ordre des paires de compartiments
(`ordreDesCompartiments`, le même tas que `orderedCompartmentPairs`), les
prédicats de compartiment et de combinaison A (`satisfiesSets`, jokers,
`bucketPairFeasibleMin`, `comboAFeasible`, les fonctions mêmes) sont ceux
de `pairBuckets`. Il saute, sans les juger une à une, des paires qui
échoueraient SÛREMENT à `quickOk`, et rien d'autre : aucune heuristique de
plus.

Ce qui suit le test rapide — sets réels, stats, test conjoint sur
`artPossibles`, quasi-succès, collecte — a deux écritures, de même
résultat :

- la **validation typée** (`ValidationTypee`, `src/lib/validationRapide.ts`,
  appelée par `Collecteur.validerTypee`), prise dès que son contrat tient :
  les sets se comptent sur les indices de set des six runes (joker compris),
  les stats sont des sommes d'entiers exactes en `Float64` puis la même
  expression que `computeStats`, opérande par opérande, et le test conjoint
  suit la même suite d'opérations que `pairBuckets` ; les `StatRow` ne se
  construisent que pour une paire gardée ou un quasi-succès amélioré ;
- la **référence** (`Collecteur.valider`), copie conforme du bloc de
  `pairBuckets`, quand le contrat de la validation typée ne tient pas
  (une valeur sommée non entière ou non bornée : `ValidationTypee.motif`).

L'appariement séquentiel et chaque Worker du parallèle décident de la même
façon, sur le même pool ; le résultat dit lequel a servi
(`cheminValidation`, `motifValidation`).

Les demi-builds y sont rangés en tableaux typés (`encoderCompartiments`) :
les trois runes de chacun (`Float64Array`, les identifiants du jeu dépassant
l'`Int32`), ses pourcentages et valeurs plates par stat contrainte, et, pour
la moitié B, la contribution scalaire `W`, triée par compartiment, avec le
minimum et le maximum de chaque bloc de 64.

## Une stat, un entier

Pour une stat contrainte de base `b`, la contribution d'une combinaison B se
réduit à un entier : `W = b × pct + 100 × flat` pour PV, ATQ et DEF, `W =
flat` pour les autres stats. Pour une combinaison A, le test rapide d'une
stat devient deux seuils, calculés une fois par ligne (`seuilsLigne`) : la
paire échoue au minimum si et seulement si `W ≤ L`, au maximum si et
seulement si `W > H`.

- Les seuils reprennent les termes MÊMES de `quickOk` : `guaranteedMin`,
  `relPctMax` et `artFlatMax` côté minimum ; `guaranteed`, `relPctMin` et
  `artFlatMin` côté maximum. L'aura RES/PRE externe, que `totalOf` ajoute
  déjà une fois, est lue (`totalOf(k, 0, 0) − b`), jamais rajoutée.
- Les équivalences sont celles de l'arrondi supérieur : `ceil(n / 100) < t`
  ⟺ `n ≤ 100 (t − 1)` et `ceil(n / 100) > t` ⟺ `n > 100 t`. Le minimum est
  pris par `ceil` et le maximum par `floor` AVANT toute soustraction : le
  total étant entier, `T < min` ⟺ `T ≤ ceil(min) − 1`.
- Une paire échoue à `quickOk` si et seulement si, pour UNE stat, `W ≤ L` ou
  `W > H` : l'ordre minimum puis maximum de `quickOk` ne change pas le
  verdict.

## Le contrat numérique

`verifierContrat`, avant toute paire : base, pourcentages et valeurs plates
des demi-builds, apports garantis, d'artéfacts et de relique, aura externe,
tous ENTIERS et bornés ; `|b × pct|` exact en `Float64` ; `W` dans un
`Int32` ; minimums et maximums finis. Sous ces conditions, l'expression
JavaScript de `quickOk` est l'arithmétique exacte et les équivalences
tiennent. Sinon, ou quand un traceur de diagnostic est demandé (le noyau ne
le remplit pas), `pairBuckets` prend l'appariement tel quel, en séquentiel ;
le motif est nommé. Jamais de `Float32` pour juger.

## Trois sauts

Tous fondés sur la même équivalence (`survivantsLigne`) :

1. **Une ligne entière** : pour chaque stat, deux dichotomies sur `W` trié
   comptent les combinaisons B dans `]L, H]` ; une stat à zéro écarte toute
   la ligne.
2. **Une dichotomie** sur la stat la plus sélective, quand elle laisse au
   plus un quart des combinaisons B : seules celles-là sont testées sur les
   autres stats, puis REMISES dans l'ordre d'origine avant d'être visitées.
3. **Un balayage par blocs** dans l'ordre d'origine sinon : un bloc de 64
   est sauté dès qu'une stat l'exclut tout entier (`max(W) ≤ L` ou
   `min(W) > H`), chaque combinaison restante est jugée par `L < W ≤ H`.

## Ordre, garde et comptes

- **Ordre de visite** : celui de `pairBuckets`. Le quasi-succès « le premier
  vu » et les candidats gardés sous `maxCollected` sont donc les mêmes.
- **Garde de référence** : une paire qui franchit les seuils repasse par
  l'expression de `quickOk` sur les valeurs telles quelles
  (`quickOkReference`, mêmes termes sommés dans le même ordre). Le seul
  défaut possible du noyau est donc un saut à tort, et c'est ce que l'oracle
  cherche.
- **Comptes** : une paire sautée compte comme TRAITÉE ; `explored` porte les
  paires traitées, visitées et sautées, et vaut `totalPairCount` sur une
  recherche achevée.
- **Points de passage** : toutes les `CHECKPOINT_EVERY` paires traitées,
  sautées comprises, même quand une ligne entière est sautée. À celui de la
  paire `N`, les paires avant `N` sont jugées et `N` ne l'est pas,
  exactement comme dans `pairBuckets` : un arrêt à `explored = N` laisse le
  même état des deux côtés.
- **Filet de temps** : testé à chaque paire visitée et à chaque point de
  passage. Une paire sautée ne le teste pas une à une : sur une recherche
  coupée par le temps, l'arrêt peut tomber jusqu'à `CHECKPOINT_EVERY − 1`
  paires plus loin qu'avec `pairBuckets`, qui le teste à chaque paire. Il
  en va de même dans un Worker (`parcourirMorceau`) : une ligne entièrement
  sautée qui franchit un point de passage teste le temps, et un morceau
  coupé ainsi compte ses paires traitées jusqu'à ce point.

## Vérification

`tests/appariement-rapide.test.ts` (`testAppariementRapide`) :

- les seuils aux frontières, pour chaque forme de condition (minimum ou
  maximum, stat en pourcentage ou plate, aura RES/PRE externe comprise,
  seuil entier ou non), aux totaux `t − 1`, `t`, `t + 1` et sur tous les
  restes de l'arrondi ;
- paire par paire, sur de petits espaces (pools générés, profils
  synthétiques du harnais), qu'aucune paire qui passe `quickOk` n'est
  sautée, sur les trois chemins de saut, et que `visitées + sautées =
  traitées = totalPairCount` ;
- le résultat contre celui de `pairBuckets` sur les mêmes compartiments :
  non tronqué, sous petit plafond, arrêté à un nombre de paires donné, puis
  réparti en morceaux rendus dans le désordre.

`tests/validation-rapide.test.ts` (`testValidationRapide`) compare la
validation typée à `activeSets`, `computeStats` et au test conjoint de
`pairBuckets` : sur des cas écrits, paire par paire sur des demi-builds
tirés, collecteur contre collecteur, puis l'appariement entier (séquentiel
et parallèle simulé) contre `pairBuckets`, contrat tenu ou non.

Sur les comptes réels, `scripts/banc-appariement-rapide.ts` compare le
chemin de production à `pairBuckets` ([parallelisation.md § Vérifier un changement](parallelisation.md#vérifier-un-changement)),
et `--controle-validation` y compare la validation typée à la référence,
paire par paire, sur tout l'espace.
