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
  suit la même suite d'opérations que `pairBuckets`, tentative par
  tentative, relique en « OU » du mode `recherche` comprise (`ecarts(a, f)`
  : la principale de la relique représentative `f` ajoutée à la somme
  entière des pourcentages avant le `ceil`, valeur entière exigée par le
  contrat) ; la sortie compacte écrit directement les totaux, les `StatRow`
  ne se construisent que pour l'adaptation objet ou un quasi-succès amélioré ;
- la **référence** (`Collecteur.valider`), copie conforme du bloc de
  `pairBuckets`, quand le contrat de la validation typée ne tient pas
  (une valeur sommée non entière ou non bornée : `ValidationTypee.motif`).

L'appariement séquentiel et chaque Worker du parallèle décident de la même
façon, sur le même pool ; le résultat dit lequel a servi
(`cheminValidation`, `motifValidation`).

Les demi-builds arrivent de la construction en colonnes
(`CompartimentType`, `src/lib/demiBuildsTypes.ts`), préréglages emboîtés
compris. `encoderCompartiments` en projette les seules colonnes utiles au
noyau : les trois identifiants (`Float64Array`, ceux du jeu dépassent
l'`Int32`), les valeurs plates par stat contrainte et les pourcentages des
seules contraintes PV/ATQ/DEF (`pasPct`, `indicesPct` : −1 pour les autres,
dont le calcul ignore le pourcentage). Les contributions passent en
`Int32Array` seulement après vérification du contrat. La moitié B porte
aussi `W`, son tri et sa permutation par compartiment, puis les bornes des
blocs de 64. Score de rétention, stats non contraintes, comptes et potentiel
ne sont pas copiés vers les Workers d'appariement. Les tables de validation
se reconstruisent depuis les identifiants et le pool préparé, sans `HalfCombo`.

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
tiennent. Sinon, `apparierSansSauts` parcourt les colonnes en séquentiel,
sans conversion en entiers ni saut : mêmes prédicats, expressions de
`quickOk`, validation par `Collecteur.valider`, point de passage avant la
paire toutes les 500 paires et test du temps à chaque paire, comme
`pairBuckets`. Un traceur de diagnostic, que le noyau ne remplit pas, demande
`pairBuckets` lui-même avec l'adaptateur objet. Le motif est nommé.
Jamais de `Float32` pour juger.

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

La sortie de collecte est injectée : objets pour la référence et les outils,
colonnes Float64 pour les Workers. La validation typée écrit les totaux par
la même fonction que `lignes`, sans construire de `StatRow` par candidat.
Le chemin de repli adapte un seul objet temporaire. Les blocs, positions et
visites se coupent ensemble ; les pauses de transport n'ajoutent aucun
jugement ni saut. Les quasi-succès utilisent les mêmes objets et règles.

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
- **Filet de temps** : testé à chaque point de passage, toutes les
  `CHECKPOINT_EVERY` (500) paires TRAITÉES, visitées ou sautées. Le prochain
  contrôle vient du compteur entier de paires traitées, jamais d'une horloge
  plus grossière. Sur une recherche coupée par le temps, l'arrêt peut tomber
  jusqu'à `CHECKPOINT_EVERY − 1` (499) paires plus loin qu'avec `pairBuckets`,
  qui le teste à chaque paire ; la paire du point de passage n'est pas jugée.
  Une recherche peut aussi s'épuiser ou atteindre son plafond avant le
  contrôle suivant. Ce retard est borné en paires, pas en millisecondes.
  Dans un Worker (`parcourirMorceau`), le temps se teste aussi à l'entrée de
  chaque ligne ouverte ; les points de passage suivent la position GLOBALE
  du morceau. Une ligne entièrement sautée qui franchit un point de passage
  teste le temps ; les points franchis d'un seul saut partagent une lecture,
  avec coupure au premier si le filet a expiré. Un morceau coupé ainsi compte
  ses paires traitées jusqu'à ce point. Le coordinateur garde son contrôle
  avant de distribuer un morceau.

## Vérification

Les contrôles du flux compact (`tests/flux-candidats.test.ts`) comparent à
`pairBuckets` des candidats distincts avec conditions et quasi-succès, sous
coupe après plusieurs morceaux puis un bloc `suite`. Un vrai Worker attend
le retour d'un crédit après expiration du filet ; sa coupe est comparée à
la référence au même point logique, sans comparer deux recherches au même
instant réel. Une panne pendant un transfert `MessageChannel` doit encore
permettre de sceller exactement le préfixe reçu. Les tampons de vingt blocs
unitaires occupent exactement 2 400 octets, sans capacité cachée.

`testFluxCandidatsPageLente` utilise de vrais Workers Node et une page
simulée qui acquitte chaque bloc après huit tours de boucle. Il compte les
crédits retenus après fusion, ainsi que les blocs contigus reçus qui
attendraient une publication précédente : aucune attente liée à la page
dans ce scénario, sans mesure de temps. Il compare les 77 125 candidats,
les comptes, les quasi-succès et le motif à la référence séquentielle. Un
contrôle sans acquittement remplit les seize places de la fenêtre, vérifie
que le dix-septième bloc attend, puis que le scellement attend tous les
crédits. Les tampons partiels restent ajustés aux lignes.

Chaque appel parallèle explicite de ces tests a un délai de garde de
15 secondes, qui signale une erreur et ferme les Workers encore vivants ;
ce délai détecte un interblocage, il n'est pas un budget de performance.
Un lanceur muet vérifie aussi ce chemin d'expiration et son nettoyage.

`testConstructionColonnes` (`tests/construction-colonnes.test.ts`) compare
la construction et l'union en colonnes à `buildBuckets` et à l'union objet,
dans les quatre ordres, sur des pools déterministes et sous éviction. Il
compare aussi les candidats, le compte et le quasi-succès, sous plafond et
sans plafond, puis exerce les transferts (tampons détachés) et de vrais
Workers Node de construction et d'appariement. Les colonnes, candidats et
quasi-succès sont comparés valeur par valeur avec `Object.is`, qui distingue
`-0` de `0` et `NaN` de `null`. Un aller-retour de `-0` et les deux sens
d'appariement mixte (moitié objet / moitié typée) sont exercés.
Le cas de base ATQ fractionnaire porte sur une stat contrainte : il affirme
`chemin === 'actuel'` et le motif numérique, parcourt des paires, puis compare
le résultat à la référence objet. Les capacités négatives produisent aussi
le même résultat vide que la référence.

`tests/appariement-rapide.test.ts` (`testAppariementRapide`) :

- les seuils aux frontières, pour chaque forme de condition (minimum ou
  maximum, stat en pourcentage ou plate, aura RES/PRE externe comprise,
  seuil entier ou non), aux totaux `t − 1`, `t`, `t + 1` et sur tous les
  restes de l'arrondi ;
- paire par paire, sur de petits espaces (pools générés, dont six à relique
  portée et paire d'artéfacts figée, leurs apports non nuls sur une stat
  contrainte et pris par la validation typée ; profils synthétiques du
  harnais), qu'aucune paire qui passe `quickOk` n'est
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

`testAppariementHorloge`, dans `tests/appariement-rapide.test.ts`, simule
`Date.now()` : budget court, borne de 499 paires atteinte, nombre de lectures
aux points de passage et coupure d'un morceau décalé sur les positions
globales, candidats complets inchangés. Le contrôle d'une ligne entièrement
sautée est aussi exercé par `tests/appariement-parallele.test.ts`.

Sur les comptes réels, `scripts/banc-appariement-rapide.ts` compare le
chemin de production à `pairBuckets` ([parallelisation.md § Vérifier un changement](parallelisation.md#vérifier-un-changement)),
et `--controle-validation` y compare la validation typée à la référence,
paire par paire, sur tout l'espace.
