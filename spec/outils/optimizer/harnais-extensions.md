# Harnais de diagnostic — extensions

**Statut :** ÉTAT ACTUEL — ce que le harnais de diagnostic fait au-delà de son mode d'emploi de base (niveaux de coût d'une extension, configuration, observation de la construction, build cible, oracle du différentiel), avec le code qui porte chaque garantie
**Lire si :** on lit ou modifie une sortie du harnais sur la construction des demi-builds (rétention, mémoire, `--progression`), un build cible à six identifiants, un différentiel (`--differentiel`), ou on envisage d'étendre le harnais
**Ne pas lire si :** on cherche le mode d'emploi de base du harnais : harnais.md
**Voir aussi :** harnais.md, invariants.md, verification.md

Ce fichier prolonge [harnais.md](harnais.md), le mode d'emploi (sources,
phases, palier 1, suivi d'une rune, complétude, temps, régime) : ce que le
harnais fait en plus, et où le code le porte (`fichier:lignes`). Les sorties
décrites impriment elles-mêmes leurs avertissements ; la spec dit pourquoi.

## Étendre le harnais : quatre niveaux de coût

Le principe — orchestrer et observer la production, ne réimplémenter aucune
étape — a des degrés. Une extension se classe avant d'être écrite :

| Niveau | Ce qu'il touche | Rapport au principe |
|---|---|---|
| **A-passif** | lit ou combine des valeurs déjà rendues ; aucune mesure ajoutée, rien de `src/` touché | le respecte |
| **A-instrumenté** | associe une information externe (horodatage, compteur) à des événements que la production émet déjà, depuis la coquille de diagnostic | le respecte, mais coûte : le périmètre de la mesure s'écrit avec elle, son coût se mesure |
| **B** | un observateur optionnel de plus dans `src/`, sans effet s'il est omis (le précédent : `onStage`) | le tend ; même validation qu'`onStage` |
| **C** | recalcule ce que la production calcule, ou instrumente une boucle assez chaude pour changer le temps mesuré | le rompt ; en dernier recours |

Le test du niveau C : *ce calcul duplique-t-il une DÉCISION de la
production, donc peut-il en diverger ?* Multiplier des longueurs de tableaux
rendus n'en duplique aucune ; au critère inverse (« toute arithmétique que la
production ne fait pas »), la somme `combosA` serait déjà du niveau C
(`scripts/lib/diagnosticHarness.ts:326-327`). Un niveau C se justifie par une
question falsifiable — deux hypothèses incompatibles produisent les mêmes
observations A, seule une mesure interne les départage —, jamais par « plus
de détail » ; c'est à ce titre que `scripts/monster-search-rank-diag.ts`
reste à part (harnais.md § Limite : la rétention interne de buildBuckets).
Le code étiquette ses instruments par niveau
(`scripts/lib/diagnosticHarness.ts:466-481`, `scripts/lib/diagnosticHarness.ts:497-522`).

## Configuration : une résolution, des arguments refusés, une fidélité bornée

**Une résolution par run.** `executerHarnaisResolu(resolue, options)` est la
fonction de travail ; `executerHarnais(config)` résout puis délègue
(`scripts/lib/diagnosticHarness.ts:187-217`, `scripts/lib/diagnosticHarness.ts:452-464`).
Le CLI lui passe la `ConfigResolue` qu'il vient d'imprimer au palier 1
(`scripts/diagnostic-harness.ts:1040-1065`) : une seconde résolution
relirait recette et export, et le palier 1 pourrait décrire une autre
configuration que celle qui s'exécute. `OptionsHarnais` (`arretApres`,
`suivre`, `blocages`, `horodaterProgression`, `repetitions`) porte
l'orchestration, `ConfigResolue` la configuration du moteur
(`scripts/lib/diagnosticHarness.ts:172-185`) ; `ConfigHarnais` satisfait
`OptionsHarnais` par construction, et la façade la relaie telle quelle, sans
recopie champ à champ où un champ ajouté s'oublierait sans que `tsc` le voie.
Un régime forcé se lit sur `resolue.regimeForce`, jamais re-dérivé des
overrides (`scripts/lib/diagnosticHarness.ts:366-368`).

**Aucun repli silencieux dans les arguments.** Les lecteurs typés du CLI
(`lireEnum`, `lireEntier` borné, `lireReelPositif`, `lireListeEntiers`, et
`refuser`, qui nomme l'attendu : `scripts/diagnostic-harness.ts:123-198`)
refusent aussi ce qui passait pour une autre valeur : une statistique
inconnue dans `--min`/`--max`, dont le « 0 build » se lirait comme un verdict
du moteur (`scripts/diagnostic-harness.ts:206-220`) ; un verrou hors des
emplacements 1-6 (`scripts/diagnostic-harness.ts:363-372`) ; un
`--assortiment` inconnu, qui mesurerait un autre pool
(`scripts/diagnostic-harness.ts:379-383`) ; une graine non entière, qui ne
rejouerait pas le même pool (`scripts/diagnostic-harness.ts:390-393`) ; un
`--siege` au `deckId` non entier ou à la variante autre que `defense`
(`scripts/diagnostic-harness.ts:412-430`). `--cap` reste sans défaut au CLI :
`resoudreConfig` refuse le run sans lui
(harnais.md § Les overrides et leurs deux pièges).

**Ce que la fidélité ne prouve pas.** La liste imprimée sous son verdict
(`horsPerimetre` : composition du pool, paramètre absent de la table,
coquille d'exécution) est STRUCTURELLE : élargir la table des paramètres n'en
retire aucune ligne, aucune de ces choses n'étant un paramètre
(`scripts/lib/diagnosticConfig.ts:321-332`).

## La construction observée

Trois instruments rendent, sous `demiBuilds`, ce que `buildBuckets` a fait
dans chaque moitié (`scripts/lib/diagnosticHarness.ts:326-345`) ; le CLI
imprime chacun avec son avertissement (`scripts/diagnostic-harness.ts:703-783`).

**Taux de rétention de la construction** (`demiBuilds.retention`,
`retentionConstruction`, `scripts/lib/diagnosticHarness.ts:483-495`) : par
moitié, `parEmplacement`, `produitBrut` |f₀|×|f₁|×|f₂|, `retenus`
(demi-builds des compartiments) et `taux` ; le CLI y ajoute le rapport A/B.
A-passif :
les longueurs sont celles de l'étage `filterslot` lu par `onStage`, le
tableau même qui devient `prepared.filtered` et que reçoivent les deux fils,
emplacements 1-3 pour A et 4-6 pour B (`scripts/lib/buildHalvesNode.ts:147-148`) ;
le produit est le majorant exact des triplets énumérables de la moitié qui a
tourné (`tests/diagnostic-harness.test.ts:195-226`). Le nom est imposé :
rétention **de la construction** (`buildBuckets` sous `bucketCap`), pas « du
pré-filtrage », qui serait `filterSlot` ; jamais « rendement » ni
« efficacité », que le test interdit : le ratio ne dit rien de la qualité des
retenus ni de la survie de l'optimum. Il peut étayer un plafonnement par
`bucketCap` quand A a plusieurs fois le produit brut de B et retient autant
(`scripts/lib/diagnosticHarness.ts:476-480`).

**Mémoire de fin de construction** (`demiBuilds.memoire`) : `heapUsed`,
`heapTotal`, `rss` par moitié ; le CLI y ajoute le rapport `heapUsed` A/B. Chaque moitié a
son `worker_threads`, donc son tas (`scripts/lib/build-half-worker.ts:63-82`) ;
`process.memoryUsage()` est lu en fin de fil, après le chronomètre et avant
la sérialisation, hors de tout temps (`scripts/lib/build-half-worker.ts:195-209`).
C'est ce que la moitié laisse derrière elle, pas son pic, sans les pauses de
ramassage. Le caveat imprimé (`CAVEAT_MEMOIRE`,
`scripts/lib/diagnosticHarness.ts:686-691`, `tests/diagnostic-harness.test.ts:228-251`)
le dit, et que le ramasse-miettes de Node n'est pas celui du navigateur : le
chiffre compare A à B dans un même processus, il ne prédit pas ce que vit
l'utilisateur. Ne pas brancher un `PerformanceObserver` sur `gc` tant que ce
relevé ne montre pas d'écart : son coût s'insérerait dans la phase mesurée.
`scripts/lib/build-half-worker.ts` exécute du code au chargement : ses types
s'importent par `import type`, jamais par un import de valeur qui le ferait
tourner dans le fil principal (`scripts/lib/buildHalvesNode.ts:48-51`,
`scripts/lib/diagnosticHarness.ts:75-78`, `scripts/perf-battery.ts:112-116`) ;
`scripts/perf-battery.ts`, qui le partage, n'en lit que `buckets` et `ms`
(`scripts/perf-battery.ts:371-376`).

**Cartographie de l'élagage** (`--progression`, `horodaterProgression`,
`scripts/diagnostic-harness.ts:76-79`, `scripts/diagnostic-harness.ts:319-319`) :
horodate les `BuildingProgress` que `buildBuckets` émet déjà, un par rune de
l'emplacement extérieur, et rend `demiBuilds.progression`, titré A₂ dans la
sortie. A-instrumenté, et OPT-IN parce que `scripts/perf-battery.ts` partage
le worker : sans le drapeau, le générateur est drainé par `drain()`, sans
horloge ni champ de plus (`scripts/lib/build-half-worker.ts:140-162`,
`tests/diagnostic-harness.test.ts:253-263`) ; avec, le worker l'itère à la
main, sans `yield` ajouté au moteur ni `drain.ts` touché, et le relevé part
une seule fois avec le résultat, jamais un message par `yield`
(`scripts/lib/build-half-worker.ts:45-61`, `scripts/lib/build-half-worker.ts:163-193`).
Trois périmètres d'horloge, jamais mélangés (`ProgressionMoitie`,
`scripts/lib/build-half-worker.ts:84-128`) :

| `next()` | Ce qu'il exécute | Champ |
|---|---|---|
| le premier | le prologue, aucune rune | `prologueMs` |
| les suivants | le corps d'une rune extérieure | `intervallesMs`, seule série homogène |
| le dernier | la dernière rune **et** l'épilogue (tri des combos de chaque compartiment, puis des compartiments) | `derniereEtEpilogueMs`, qui majore l'épilogue sans l'isoler |

Un intervalle, pris entre deux `next()` du consommateur, couvre aussi la
suspension et la reprise du générateur : ce n'est pas « le temps passé dans
`buildBuckets` ». La restitution (`scripts/lib/diagnosticHarness.ts:523-602`)
est une distribution, jamais un scalaire : `n`, min, médiane vraie (moyenne
des deux valeurs centrales sur un effectif pair), p90, max, total et un
histogramme en 12 classes, parce qu'une série bimodale ne se voit dans aucun
jeu de quantiles et qu'une moyenne l'écraserait. `runesExterieures` est le
`total` annoncé par le moteur. La médiane divisée par |f₁|×|f₂| (|f₄|×|f₅|
pour la moitié B) est une
DIVISION ARITHMÉTIQUE par le majorant des paires intérieures, jamais un
« temps par triplet énumérable » (`scripts/lib/diagnosticHarness.ts:664-668`).
Partent avec la mesure, chacun verrouillé par un test
(`scripts/lib/diagnosticHarness.ts:612-657`, `tests/diagnostic-harness.test.ts:253-350`) :
ce que l'instrument n'est pas (`avertissementPortee`), le périmètre de
l'horloge (`perimetreHorloge`), son coût mesuré (`coutInstrumentation`). La
distribution dit OÙ `buildBuckets` coupe, une propriété de la topologie du
pool ; elle ne dit pas quelle moitié est plus lente, le temps par rune
extérieure mélangeant vitesse d'exécution et taux d'élagage.

**La règle d'interprétation** (`regleInterpretation`,
`scripts/lib/diagnosticHarness.ts:670-678`) part avec le résultat, comme
l'avertissement de comparaison des temps : « A retient moins · A est plus
lent · donc A est lent parce qu'il travaille plus » est permis par la
corrélation, jamais démontré par elle. Le produit brut est le majorant de
l'énumération, pas l'énumération — les `continue` de faisabilité et de jokers
coupent des sous-arbres sans trace —, et d'autres explications restent
ouvertes : distribution des pools, coût des prédicats de faisabilité,
profondeur des branches coupées, composition en sets. Aucun instrument ne
compte les triplets réellement énumérés : ce compteur, dans la boucle interne
de `buildBuckets`, serait du niveau C
(harnais.md § Limite : la rétention interne de buildBuckets).

## Le suivi d'un build cible

`--suivre` avec les six identifiants d'un build — la même option, pas une de
plus (`scripts/diagnostic-harness.ts:64-72`) — répond à « ce build est-il
dans le résultat, et sinon, quel étage l'a perdu ? » : prouver d'abord
qu'une information a été perdue, chercher ensuite pourquoi.

| Étage | Champ du résultat | Code |
|---|---|---|
| 0 — admissibilité à l'entrée | `admissibiliteBuildCible` | `admissibiliteBuild`, `scripts/lib/diagnosticHarness.ts:1524-1599` |
| 1 à 3 — survie des runes, des deux demi-builds | `suivi`, `detailDemiBuilds` | le suivi d'une rune de harnais.md |
| 4 et 5 — paire de compartiments, rang | `appariementBuildCible` | `scripts/lib/diagnosticHarness.ts:1406-1497` |
| verdict | `verdictBuildCible` | `scripts/lib/diagnosticHarness.ts:1665-1810` |

**Étage 0**, avant toute accusation d'élagage, sans quoi une absence causée
par l'entrée serait imputée au moteur : structure (six identifiants
distincts, six emplacements), présence dans le pool, admissibilité par
emplacement lue sur `mainStatFilteredBySlot` (verrou et principale imposée),
combo de sets lu par `activeSets` + `missingSets`, le test par lequel
`pairBuckets` accepte un build, jamais le pré-filtre optimiste
`satisfiesSets`. Chaque refus nomme sa cause (rune absente du pool, verrou
qui impose une autre rune, principale non portée, set manquant) ; l'étage est
calculé avant tout retour anticipé, donc rendu même sur une configuration
invalide (`scripts/lib/diagnosticHarness.ts:279-288`,
`tests/diagnostic-harness.test.ts:607-726`).

**Étages 4 et 5.** La paire de compartiments s'arrête à `sets-compartiment`,
`joker`, `borne-compartiment`, `borne-comboA` ou `explorée`, dans l'ordre de
`pairBuckets` (`src/lib/runeBuildOptim.ts:4256-4284`), pas dans celui de
`totalPairCount`, qui teste le joker avant les sets
(`src/lib/runeBuildOptim.ts:3180-3184`) : c'est la boucle d'appariement qui
décide. Les prédicats du moteur sont exportés et appelés, jamais retapés
(`src/lib/runeBuildOptim.ts:3010-3010`, `src/lib/runeBuildOptim.ts:3052-3052`,
`src/lib/runeBuildOptim.ts:3081-3081`). `explorée` dit qu'aucun élagage
n'écarte la paire — la boucle l'aurait visitée, pas qu'elle l'a visitée.
Suit le RANG de la cible dans le classement ENTIER par `sortCandidates`, jamais
dans le top rendu, avec sa population et la taille du top
(`scripts/lib/diagnosticHarness.ts:396-398`, `tests/diagnostic-harness.test.ts:727-826`).

**Le verdict** prend huit valeurs (`scripts/lib/diagnosticTypes.ts:990-998`) :
`ENTRÉE_INADMISSIBLE`, `MOITIÉ_A_ÉCARTÉE`, `MOITIÉ_B_ÉCARTÉE`,
`ABSENT_DES_COMPARTIMENTS`, `PERDUE_À_L_APPARIEMENT`, `PRÉSENT_DANS_LE_TOP_N`,
`PRÉSENT_HORS_TOP_N`, `NON_OBSERVABLE`. Il ne calcule rien : il ordonne les
étages observés, l'étage 0 d'abord, nomme le PREMIER point de divergence et
rend `NON_OBSERVABLE` là où l'observation s'est arrêtée avant la réponse, ce
qui l'empêche de fabriquer une cause ; il est assemblé à un seul endroit,
après tous les points d'arrêt (`scripts/lib/diagnosticHarness.ts:206-216`).
Trois garde-fous :

1. la complétude est COPIÉE dans le verdict et ses chiffres `explored /
   totalPairs` sont dans `avertissementTroncature` : extraire le seul verdict
   d'un `--json` emporte la troncature (`scripts/lib/diagnosticHarness.ts:1605-1632`) ;
2. « paire explorée, cible absente » ne rend `PERDUE_À_L_APPARIEMENT` que sur
   un run complet, sinon `NON_OBSERVABLE` ;
3. chaque branche écrit sa conséquence — un élagage sûr ne craint pas la
   troncature, une cible trouvée garde un rang relatif aux seuls candidats
   collectés —, jamais un avertissement unique sous tous les verdicts
   (`scripts/lib/diagnosticHarness.ts:1634-1650`).

`PERDUE_À_L_APPARIEMENT` nomme l'ÉTAGE, pas une perte : paire écartée par un
élagage sûr ou build visité qui échoue le test conjoint, aucun des deux un
défaut du moteur. `ABSENT_DES_COMPARTIMENTS` est une rétention heuristique
(`bucketCap`), pas un élagage prouvé. Un test garde un run complet où la
cible, trouvée, sort hors du top rendu : lire `candidates[0]` ou les vingt
premiers conclurait à tort au build manqué (`tests/diagnostic-harness.test.ts:828-909`).

## Le différentiel : l'oracle

`--differentiel` compare deux CONFIGURATIONS du même code
(`scripts/lib/diagnosticDifferentiel.ts`) ; deux versions du code, c'est
`scripts/perf-battery-compare.ts`. Un seul élément de l'oracle est bruité,
l'INSTANT DE TRONCATURE, et seulement sous `maxMs` ; le reste est une fonction
déterministe du préfixe exploré (`scripts/lib/diagnosticDifferentiel.ts:9-27`).
L'alternance ne sert donc qu'aux temps et à `explored` sous `maxMs` ; le
reste tient en deux runs et un refus de comparer des préfixes différents.

### Sept éléments, dans l'ordre du pipeline

`ORDRE_LECTURE` (`scripts/lib/diagnosticDifferentiel.ts:136-151`,
`tests/diagnostic-differentiel.test.ts:31-37`) cherche le premier point de
divergence : une divergence de classement rapportée sans dire que les
populations diffèrent déjà accuse le mauvais étage. Lecteurs :
`scripts/lib/diagnosticDifferentiel.ts:730-1180`.

| Élément | Champ lu | Statut | Piège |
|---|---|---|---|
| troncature | `completude.complet`, `motif`, `incoherence`, `configurationInvalide` | déterministe, sauf un bras qui frôle son quota (`maxMs` ↔ `maxCollected`) : les répétitions l'attrapent | un motif qui diffère est un ARRÊT, pas une ligne parmi d'autres |
| étage de perte | `appariementBuildCible.arreteA`, `compartimentA`, `compartimentB` | déterministe sans condition, en amont de toute troncature | `explorée` n'est pas un élagage de plus |
| verdict | `verdictBuildCible.verdict` | déterministe à préfixe égal | `NON_OBSERVABLE` est une absence d'observation ; `PRÉSENT_DANS_LE_TOP_N` contre `PRÉSENT_HORS_TOP_N` tient à l'instant où la collecte s'arrête, pas au build |
| population | `appariementBuildCible.rang.population`, `meilleurs` | déterministe à préfixe égal | seuls le top-N et le cardinal se comparent, et le cardinal exige un build cible |
| classement | ordre de `meilleurs`, `appariementBuildCible.rang.rang` | déterministe à préfixe égal | rang ET population, jamais le rang seul |
| near-miss | `quasiSucces.global`, `quasiSucces.parCondition` | déterministe à préfixe égal | absent dès que `meilleurs` n'est pas vide : d'un seul côté, c'est la divergence du verdict ; le manque se compare en valeur absolue, dans l'unité de la stat |
| explored | `completude.explored` | bruité sous `maxMs` seulement | mélange vitesse du moteur et coût par paire |

### Le portier, le préfixe et NON_COMPARABLE

En cascade, pas en parallèle (`evaluerAdmissibilite`,
`scripts/lib/diagnosticDifferentiel.ts:540-640`) :

1. **le portier** : si complétude, motif, incohérence ou invalidité de
   configuration diffèrent, les bras n'ont pas parcouru le même espace ; la
   troncature est rendue divergente, rien de ce qui dépend du préfixe ne se
   compare. Une condition d'entrée, pas un seuil ;
2. **le préfixe** : deux bras complets n'en ont pas de partiel, un
   `explored` différent y est l'effet de la configuration. Deux bras tronqués
   ne se comparent que si l'écart d'`explored` ne dépasse pas la dispersion
   mesurée sur leurs propres répétitions — à une répétition, seule l'égalité
   à l'unité passe ; le plancher ne s'importe jamais d'une autre grandeur.
   Sinon verdict, population, classement et near-miss sont `NON_COMPARABLE` ;
3. **le refus est local** : l'étage de perte, évalué sur la structure des
   compartiments, reste lisible portier fermé
   (`tests/diagnostic-differentiel.test.ts:114-148`).

Un élément qui varie DANS un bras ne se compare pas ENTRE bras ; pour un
élément catégoriel, le plancher est l'égalité stricte de sa signature sur
tous les passages (`scripts/lib/diagnosticDifferentiel.ts:642-685`).
`NON_COMPARABLE` est le mot réservé, jamais une case vide, « aucune
différence » ou « inconclusif » : une case vide se lit « pareil ».
`INDISPONIBLE` en est distinct : l'élément n'existe dans aucun bras
(`scripts/lib/diagnosticDifferentiel.ts:153-165`). Sous `maxMs`, l'estimateur
d'`explored` est le MAXIMUM : dans un budget de temps, une interférence ne
peut que retirer des paires, l'inverse d'un temps ; hors `maxMs`, `explored`
est déterministe (`scripts/lib/diagnosticDifferentiel.ts:495-523`).

### Ce qu'une divergence dit

Chaque lecture porte quatre champs exigés (`LectureElement`,
`scripts/lib/diagnosticDifferentiel.ts:167-188`,
`tests/diagnostic-differentiel.test.ts:55-66`) : **OÙ** (le chemin du
champ comparé ; le rang divergent précis va dans COMBIEN et dans les
exemples), **COMBIEN** (dans son unité : rang, pourcentage de métrique,
candidats, paires ; pour le quasi-succès, un nombre de conditions, le
manque de chacune dans l'unité de sa stat allant dans les exemples),
**SUR COMBIEN** (la taille du support), **CE QUE ÇA AUTORISE** sur ce couple
de runs. Un classement rapporte le premier rang divergent, la population et
l'écart de métrique à ce rang ; l'écart dit seulement si la divergence
départage des ex æquo ou change l'ordre.

L'avertissement (`AVERTISSEMENT_DIFFERENTIEL`,
`scripts/lib/diagnosticDifferentiel.ts:289-313`) s'imprime AVANT le tableau,
dans l'annonce du run, puis avec le résultat, et voyage dans `--json`
(`scripts/lib/diagnosticDifferentiel.ts:1207-1247`, `scripts/lib/diagnosticDifferentiel.ts:1387-1387`).
Il nomme ce que l'alternance ne corrige pas : deux colonnes ressemblent à une
causalité, alors que la cause se lit à l'ÉTAGE de la divergence ; un écart
plus petit que la dispersion ; des bras que le portier sépare, ou qui n'ont
pas exploré autant de paires — l'alternance ne corrige qu'un biais de
position ; le régime d'appariement, à tenir constant ou à prendre pour axe,
le seuil de la production le faisant basculer seul quand `bucketCap` change
`totalPairs`. Les bras alternent (témoin, comparé, témoin…), un run à la
fois, jamais en blocs (`scripts/lib/diagnosticDifferentiel.ts:316-357`,
`tests/diagnostic-differentiel.test.ts:43-53`), ni en même temps comme les
deux processus de `scripts/perf-battery-compare.ts` : le harnais ouvre déjà
ses workers, et deux bras simultanés créeraient une contention inconnue de la
production.

### Tronquer par quota, et ce que maxMs autorise

Une question qui n'est pas de temps se pose sur un run complet ou tronqué par
`maxCollected`, jamais par `maxMs` : le protocole supprime le bruit au lieu
de le mesurer. Ce n'est pas le nombre de candidats qui met à l'abri, c'est la
distance à un seuil de découverte, inconnue avant de lancer : à faible
rendement, un candidat de plus d'un côté — la forme la plus convaincante d'un
faux résultat — peut ne venir que de la vitesse de la machine, et un candidat
découvert plus tard ne s'ajoute pas forcément en fin de classement.

| Si… | Alors |
|---|---|
| le quota mord | tronquer par `maxCollected` |
| le quota ne mord pas (peu de candidats) | fixer `maxCollected` ne tronque rien : aller au bout, ou tronquer par le temps aux conditions ci-dessous |
| la recherche ne peut pas finir | comparer en amont de la troncature, `--arret=demi-builds` : étage de perte, admissibilité et rétention ne dépendent d'aucun préfixe |
| rien de tout cela | le portier refuse, et le dit : `NON_COMPARABLE` |

`maxMs` reste un override disponible, marqué. Il est sûr par une asymétrie
que le code tient : une PRÉSENCE trouvée sous troncature prouve que la cible
est trouvable ; une ABSENCE n'est aucune conclusion, `NON_OBSERVABLE` et
jamais `PERDUE_À_L_APPARIEMENT` hors d'un run complet
(`scripts/lib/diagnosticHarness.ts:1764-1810`). Son échec est un run payé
pour rien, pas une conclusion fausse. Deux usages : rejouer un cas dont un run
complet ou tronqué par quota a montré que la cible sort tôt ; confirmer une
présence. Sur un cas neuf, il paie un run pour obtenir `NON_OBSERVABLE`. Dans
un différentiel, un bras tronqué par le temps ne soutient que « les deux bras
ont trouvé la cible », sans rang ni population : un test de fumée, jamais un
instrument de localisation.

### Ce qu'un profil de différentiel tient

Le différentiel prend un profil synthétique nommé
(`scripts/lib/diagnosticProfils.ts`), dont le test relit les promesses
(`AttenduProfil`, `scripts/lib/diagnosticProfils.ts:82-114`,
`tests/diagnostic-profils.test.ts:69-125`) : des bras COMPLETS de
préférence, qui suppriment portier, préfixe, plancher et bruit ; à défaut, une
troncature par quota vérifiée sur le `motif` rendu, un profil qui n'atteint
pas son quota retombant sur `maxMs` en silence ; un régime qui ne bascule pas
entre les bras, essayé bras par bras et consigné (`axesVerifies`) ; un build
cible (`cible`) qui n'est pas au rang 1, où il masquerait la sensibilité du
classement (`scripts/lib/diagnosticProfils.ts:116-169`) ; le générateur
partagé, à côté des générateurs biaisés que `randomPool` ne remplace pas,
jamais en les migrant (`scripts/lib/diagnosticProfils.ts:12-18` ;
harnais.md § Deux sources : une recette ou un pool synthétique).
