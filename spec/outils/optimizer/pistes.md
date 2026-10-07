# Optimizer — pistes futures

**Statut :** ÉTAT ACTUEL — liste les pistes futures de l'Optimizer, chacune avec son constat, l'idée et ce qui la bloque
**Lire si :** on envisage une amélioration du moteur, des artéfacts, des reliques ou de l'écran de l'Optimizer, avant de la proposer comme nouvelle
**Ne pas lire si :** on cherche ce qui est fait, ou pourquoi une variante a été écartée : la spec du mécanisme le dit (README.md dit laquelle)
**Voir aussi :** README.md, invariants.md, limites-connues.md, pistes-vitesse-et-verification.md

Une piste est ce qui n'est pas fait. Chaque entrée donne le **constat** (ce
que le code fait aujourd'hui, avec sa coordonnée), l'**idée** et ce qui la
**bloque** : une mesure, un relevé en jeu, une décision de produit, un
chantier à ouvrir ou un changement de code pas encore fait. Ce qui
est fait se lit dans la spec du mécanisme, que le
[README.md](README.md) désigne ; une variante essayée puis écartée y tient en
une ligne « ne pas… parce que… », pour qu'on ne la réessaie pas sans sa
raison. Celles du moteur de recherche des runes :
[moteur/elagages.md § Variantes écartées ou gardées en réserve](moteur/elagages.md).
Les pistes qui accéléreraient la recherche sans changer ce qu'elle cherche,
et celles des tests, du harnais et des scripts de mesure :
[pistes-vitesse-et-verification.md](pistes-vitesse-et-verification.md).

## Moteur de recherche des runes

### Prototypes de `buildBuckets`

- **Constat** : deux paramètres de `buildBuckets`
  (`src/lib/runeBuildOptim.ts`) sont annoncés « PROTOTYPE EN MESURE ».
  `skylineKeys` (frontière de Pareto des demi-builds de chaque
  compartiment, `Bucket.skyline`, `insertIntoSkyline`,
  `dominatesHalfCombo`) n'est passé par aucun appel de `src/`, `scripts/`
  ni `tests/` : seuls ses deux auxiliaires sont testés
  (`tests/rune-optim.test.ts`), et le script de mesure que cite son
  commentaire n'existe plus. `adaptiveTrancheWeighting`, lui, est en
  production : l'interrupteur « Prioriser les stats les plus difficiles »
  le transmet (`src/components/outils/OptimizerSection.tsx`,
  `src/workers/runeBuildOptim.worker.ts`), alors que son commentaire le dit
  faux dans tous les appels de production.
- **Idée** : retirer `skylineKeys`, `Bucket.skyline` et leurs auxiliaires,
  ou les garder comme instrument appelé par un script de mesure ; récrire
  le commentaire d'`adaptiveTrancheWeighting` d'après le code.
- **Bloque** : un changement de code, et le choix entre retirer et garder.
  La variante elle-même est écartée
  ([moteur/elagages.md § Variantes écartées ou gardées en réserve](moteur/elagages.md)).

### Dominance « avec marge » entre sets différents

- **Constat** : deux runes de sets différents ne se comparent que si les
  deux sets sont interchangeables (`isSetComparable`,
  [moteur/elagages.md § Élagages sûrs](moteur/elagages.md)). Une rune d'un
  set protégé n'est donc jamais éliminée par une rune d'un autre set, même
  meilleure sur chaque stat d'une marge supérieure au bonus du set. La
  prudence coûte de la vitesse (plus de runes survivent), jamais le
  résultat.
- **Idée** : B élimine A, dont le set S est protégé, si B égale ou dépasse A
  partout et dépasse A d'au moins le bonus de S sur la stat de ce bonus.
- **Bloque** : les pièges à traiter avant tout code — l'Intangible ne
  complète un set que s'il est le seul incomplet, et retirer une pièce peut
  changer le set qu'elle complète ; une marge par set dans la bonne unité
  (Energy et Guard, 15 % de la stat de base ; Fatal, 35 % d'ATQ sur une
  seule rune ; Swift, 25 % de la VIT de base contre une VIT de rune en
  points ; Blade, 12 de Taux Crit ; auras, 8 % de la base et points de RES
  ou de PRE) ; une rune B qui ajoute un set incomplet ; les sets demandés,
  jamais comparés. Gain incertain : « meilleure partout, plus une marge »
  est rare sur un vrai inventaire. Avant de l'ouvrir : un oracle exhaustif
  noté par la note de production (skill `algo-verify`) et une mesure du
  gain sur des comptes réels (skill `optimizer-perf-testing`).

### Borne des sets comptée par emplacement distinct

- **Constat** : `additionalSetActivationHeadroom` et `auraResPreHeadroom`
  comptent les runes d'un set sur tout le pool (`runeBuildOptim.ts`),
  alors que la dominance compte les emplacements distincts du pool après
  verrous (`contexteDominance`). Un set dont toutes les runes sont sur un
  même emplacement n'apporte jamais plus d'une pièce. Ce n'est pas un faux
  rejet : la borne reste sûre, seulement plus large.
- **Idée** : compter les emplacements distincts, borne plus serrée et
  toujours sûre.
- **Bloque** : un gain attendu nul sur un vrai compte, où chaque set occupe
  les six emplacements, sauf avec des emplacements verrouillés (ces bornes
  se calculent sur le pool avant les verrous). À mesurer avant toute
  adoption (skill `algo-verify`).

### Écarter les runes hors combo avant la dominance

- **Constat** : quand le combo demandé coûte les six emplacements,
  `filterSlot` écarte toute rune qui n'est ni d'un set demandé ni une
  Intangible (`hasFreeSlots`, `src/lib/runeBuildOptim.ts`) : un élagage
  sûr, mais au dernier étage de `prepareSearch`, après
  `mainStatFilteredBySlot`, `pruneDominated` et `eliminateInfeasible`.
  `pruneDominated` compare chaque paire de runes d'un emplacement, et y
  renonce au-delà de `DOMINANCE_MAX_POOL` (2 000 runes).
- **Idée** : appliquer cette coupe en tête. La dominance coûterait moins,
  et un emplacement repassé sous le seuil la retrouverait : un pool mieux
  élagué pour toute la suite, pas seulement plus vite.
- **Bloque** : jamais mesuré, et sans effet dès qu'un emplacement reste
  libre. `contexteDominance` et `eliminateInfeasible` se calculent sur le
  pool de l'étage, que la coupe réduirait : vérifier contre un oracle que
  rien n'en devient faux (skill `algo-verify`).

### Partition des moitiés selon leur coût

- **Constat** : les moitiés sont fixes, emplacements 1 à 3 puis 4 à 6
  (`slotIdxs` de `src/workers/runeBuildOptim.worker.ts`). La moitié A porte
  deux des trois emplacements à principale fixe (1 et 3), dont les pools
  sont plus gros : sa construction est plus longue sur les cas mesurés, et
  comme les deux moitiés se construisent en parallèle
  ([moteur/pipeline.md § Construction des moitiés](moteur/pipeline.md)), le
  temps perçu est celui de la plus lente. Le débit de demi-builds retenus
  est aussi plus faible côté A, et sa cause n'est pas établie : le
  plafonnement par compartiment l'explique en partie, l'énumération
  elle-même n'est pas comptée
  ([harnais-extensions.md § La construction observée](harnais-extensions.md)).
- **Idée** : choisir la partition selon un modèle de coût réel, pas
  seulement le produit des tailles ; sûr, puisque ce qui est cherché ne
  change pas.
- **Bloque** : jamais construit ni mesuré. Avant d'attribuer une cause au
  débit, un compteur d'énumération dans la boucle interne de
  `buildBuckets`, sur une question falsifiable.

### Repli de `slotFilterCap` quand le paramètre est omis

- **Constat** : `prepareSearch` replie sur
  `params.slotFilterCap ?? MAX_PER_SLOT_MATCH`, soit 40, le préréglage
  « Bas », alors que l'écran envoie toujours son préréglage (« Moyen »,
  80, par défaut). Un appelant qui l'omet mesure moitié moins de
  rétention, et `bucketCapFor` lui donne aussi moitié moins de `bucketCap`.
  `MAX_PER_SLOT_MATCH` porte trois rôles : défaut de `filterSlot`, repli de
  `prepareSearch`, point de référence de `bucketCapFor`
  (`BUCKET_CAP_REFERENCE_SLOT_FILTER_CAP`).
- **Idée** : en deux temps. D'abord démêler les trois rôles (un défaut de
  repli distinct, la référence de `bucketCap` nommée pour ce qu'elle est),
  sans changement de comportement. Puis, au choix : porter le repli à 80,
  ou rendre `slotFilterCap` obligatoire, pour que tout appelant qui
  l'oublie échoue à la compilation.
- **Bloque** : ⚠️ passer `MAX_PER_SLOT_MATCH` à 80 sans le premier temps
  diviserait par deux le `bucketCap` de production (`bucketCapFor(80)`
  vaudrait 3000 au lieu de 6000), sans que `tsc` le voie. Le second temps
  change le comportement des tests et benchmarks qui omettent le
  paramètre, et rend leurs repères historiques incomparables ; le choix
  entre les deux options reste à faire.

### Le joker au pré-filtrage

- **Constat** : `filterSlot` (`src/lib/runeBuildOptim.ts`) classe une
  Intangible dans la tranche des sets demandés par `relevance`, sans valeur
  pour le set qu'elle complète, et ne l'admet jamais dans la tranche hors
  set (`offSet`) ; l'ordre des compartiments ne la crédite pas non plus
  ([limites-connues.md § Recherche des runes — le meilleur trouvé, pas l'optimum prouvé](limites-connues.md)).
  Une Intangible aux stats faibles peut donc être écartée avant la
  rétention, qui n'est pas en cause (écart au classement :
  [moteur/elagages.md § Variantes écartées ou gardées en réserve](moteur/elagages.md)).
- **Idée** : lui réserver une place au pré-filtrage, ou lui créditer ce
  qu'elle complète quand un set demandé ne se complète pas sans elle.
- **Bloque** : aucune perte relevée sur un cas réel ; ce qu'elle complète
  dépend des autres emplacements, inconnus à l'étage d'un emplacement. Un oracle
  sur un pool où seule une Intangible complète le set (skill `algo-verify`)
  dirait si la perte existe.

### Optimalité prouvée : Branch & Bound sur les paires, statuts du résultat

- **Constat** : le résultat est « le meilleur trouvé parmi le pool retenu »
  ([moteur/elagages.md § Pré-filtrage heuristique et compartiments](moteur/elagages.md)) :
  le pré-filtrage (`slotFilterCap`) et la rétention (`bucketCap`) sont
  heuristiques, et le produit n'a aucun mode « un seul objectif, arrêt
  précoce ».
- **Idée** : un *Branch & Bound* au niveau des paires de compartiments
  (une borne d'optimalité par paire, en prolongement de
  `bucketPairFeasibleMin`, les paires visitées par potentiel décroissant,
  arrêt dès que la meilleure borne restante est battue) ; puis des statuts
  sur un résultat : valide, meilleur trouvé, optimal prouvé.
- **Bloque** : le premier n'a de valeur que pour un mode qui n'existe pas,
  une décision de produit à prendre d'abord ; les statuts supposent en plus
  de lever le caractère heuristique du pré-filtrage, un chantier bien plus
  large.

### Ce que garde une recherche arrêtée par le plafond de candidats

- **Constat** : `MAX_COLLECTED` atteint, la recherche s'arrête, et les
  candidats gardés sont les premiers collectés dans l'ordre d'exploration
  (compartiments par potentiel, `combosOrderMode`), pas forcément les meilleurs
  ([limites-connues.md § Recherche des runes — le meilleur trouvé, pas l'optimum prouvé](limites-connues.md)).
  Le joueur ne lit que le haut de ce classement.
- **Idée** : un ordre de collecte qui fasse arriver les meilleurs d'abord :
  une piste de pertinence, pas de vitesse.
- **Bloque** : jamais explorée. Se juge sur la qualité sous saturation,
  jamais sur les comptes ([moteur/artefacts.md § Mesurer un changement des bornes](moteur/artefacts.md)).

### GPU comme architecture de remplacement

- **Constat** : porter l'appariement actuel sur GPU est écarté
  ([moteur/parallelisation.md § Choix du régime](moteur/parallelisation.md)).
- **Idée** : une autre architecture, un pré-filtrage léger puis le produit
  cartésien intégral sans branchement, sur GPU.
- **Bloque** : une réécriture majeure (tableaux typés, toute la
  vérification à refaire), une compatibilité WebGPU incertaine selon le
  matériel, et aucun besoin prouvé : le cas le plus lourd mesuré reste
  acceptable sur CPU.

### Solveur joint sur plusieurs monstres

- **Constat** : le moteur optimise un monstre à la fois ; les listes de
  travail et la réservation de runes enchaînent des recherches
  mono-monstre ([listes-et-reservation.md § Créer, valider et réserver dans une liste](listes-et-reservation.md)).
- **Idée** : répartir les runes de toute une box, d'une équipe RTA ou de
  siège en une seule recherche.
- **Bloque** : hors du périmètre du moteur actuel ; horizon lointain.

## Artéfacts et reliques

### Top affiché en mode relique « recherche »

- **Constat** : l'ordre de base note sans relique ; la file résout jusqu'à
  `K` combinaisons confirmées (`kDeLaFile`, 300 en mode `recherche`), et un
  build classé au-delà peut remonter très haut une fois résolu sans
  jamais l'être. « Vérifier toutes les combinaisons trouvées » résout
  tout ([moteur/artefacts.md § Quand ce choix a lieu](moteur/artefacts.md)).
- **Idée** : un critère d'arrêt prouvé par une borne optimiste du score
  avec relique, un ordre de base optimiste, ou un `K` adaptatif.
- **Bloque** : aucun n'est choisi ; chacun demande une borne sûre de
  l'apport d'une relique, et une mesure de ce qu'il coûte à la file.

### Maximums de PV, d'ATQ et de DEF revérifiés hors mode « recherche »

- **Constat** : hors mode `recherche`, le filtre final
  (`respecteConditionsPaireFixe`) ne revérifie que les minimums et les
  maximums de RES et de PRE avec la vraie paire
  ([moteur/artefacts.md § Filtre final sur la vraie paire](moteur/artefacts.md)) :
  un build dont la paire retenue dépasse un maximum de PV, d'ATQ ou de DEF
  reste affiché.
- **Idée** : passer `respecteMinEtMax` sur ce chemin.
- **Bloque** : mesurer d'abord combien de builds affichés aujourd'hui
  disparaîtraient.

### Lignes « −DMG % subis » dans les PV effectifs

- **Constat** : `pvEffectifs` (`runeBuildOptim.ts`) ne pondère les PV que
  par la DEF ; la relique Ténacité s'y ajoute (`facteurTenacite`,
  `src/lib/relicExclusive.ts`), pas les lignes d'artéfact 305 à 309, que
  le modèle de dégâts range pourtant dans le même terme `Réductions`
  (commentaire de l'apport d'une relique, `relicExclusive.ts`). Deux
  sources du même terme sont traitées différemment.
- **Idée** : la forme de Ténacité, `pvEffectifs / (1 − X/100)`, avec `X`
  qui cumule les lignes 305 à 309 de la paire retenue et la Ténacité de la
  relique.
- **Bloque** : à instruire côté artéfacts, avec la mesure de ce que le
  classement change.

### Dominance des reliques non branchée

- **Constat** : `relicDominates` et `dimensionsRetenues` ne sont appelées
  que par les tests
  ([moteur/reliques.md § Pertinence et dominance — écrites, non appelées en production](moteur/reliques.md)) :
  justesse intacte, la résolution essaie toute relique éligible, mais sur
  des pièces qu'une dominance aurait écartées.
- **Idée** : brancher `relicDominates` dans `eligibleRelics` ou juste
  après, avec le régime du point d'appel ; ou retirer le module.
- **Bloque** : mesurer d'abord ce que le pool perd sur un compte réel.

### Gain par rapport à la relique portée

- **Constat** : la carte d'un candidat ne montre pas son gain face à la
  relique que porte le monstre ; la file ne calcule que le meilleur couple
  (paire, relique) de chaque build.
- **Idée** : afficher ce gain.
- **Bloque** : une seconde évaluation du même build avec la relique portée,
  donc un changement de la file, pas de l'écran ; utile seulement si la
  relique change souvent le classement, ce qui n'est pas mesuré.

### Arrondi des points de Bravoure, d'Éternité et d'Origine

- **Constat** : le code ne pose aucun arrondi sur ces points, faute de
  relevé
  ([moteur/reliques.md § L'effet unique — score de la propriété exclusive](moteur/reliques.md)).
- **Idée** : relever l'arrondi en jeu, puis le poser.
- **Bloque** : le relevé en jeu (skill `game-data-curation`, demande d'un
  relevé) ; jamais l'arrondi de `computeStats` recopié par analogie.

### Artéfact reçu par lien RTA sans identifiant

- **Constat** : `cleanGear` (`src/lib/rtaShare.ts`) construit les
  artéfacts d'un lien sans `id`, alors qu'`ArtifactDetail.id` l'exige ; le
  `as GearSet` posé sur l'objet entier le masque. Un artéfact venu d'un
  lien n'est donc pas référençable. La relique d'un lien sans `id`, elle,
  est ignorée avec un avertissement.
- **Idée** : lire `id` dans `cleanGear`, ignorer avec un avertissement un
  artéfact qui n'en a pas, retirer le `as GearSet`.
- **Bloque** : rien qu'un changement de code.

## Dégâts réels

### Gold Headband : arrondi de la VIT par cumul

- **Constat** : chaque cumul ajoute 12 % de la VIT de base, sans arrondi
  dans les dégâts (`statsDeCombat`, `src/lib/damage.ts` : +13,92 par cumul
  pour la base 116 de Mei Hou Wang), arrondi au supérieur par cumul dans
  le Speed tune (`pointsDeGain`, `src/lib/speedTunePassif.ts` : +14). Pour
  une base de 100, les deux lectures donnent +12 et +120
  ([../degats-reels/conditions-et-audit.md § Audit des dégâts conditionnels — partie 2](../degats-reels/conditions-et-audit.md)).
- **Idée** : une seule lecture, la même pour les deux outils.
- **Bloque** : un relevé en jeu de la VIT affichée par Mei Hou Wang sans
  cumul puis à dix cumuls. Règle de décision posée d'avance : un écart de
  +139 exclut l'arrondi supérieur par cumul ; un écart de +140 ne le
  distingue pas d'un simple arrondi de l'affichage (139,2 → 140).

### Attaques conjointes : lignes d'artéfact 209 et 225

- **Constat** : les lignes 209 (« Dégâts d'attaque conjointe ») et 225
  (« Dégâts contre/attaque conjointe ») existent
  (`src/lib/artifacts.ts`), mais le calcul des dégâts n'en lit aucune ; la
  ligne 224 (« Dmg crit mono-cible à ton tour ») est lue, selon la portée
  du sort (`damage.ts`).
- **Idée** : laisser choisir une attaque conjointe pour compter 209 et
  225, avec le rôle du monstre dans le tour pour 224.
- **Bloque** : périmètre et cas sans formule à qualifier : un chantier à
  cadrer.

## Écran, recette et listes

### Durée de la recherche

- **Constat** : l'écran montre une progression (part explorée, candidats
  trouvés), jamais un temps
  ([interruption.md § Barre de progression](interruption.md)). L'instant de
  départ existe déjà côté moteur (`PreparedSearch.startedAt`, l'instant
  global repris par chaque tranche parallèle), et `scripts/perf-battery.ts`
  calcule `foundMs` sur ce principe.
- **Idée** : quatre chiffres — un compteur de secondes pendant la
  recherche, l'instant du premier build trouvé, la durée de l'exploration
  complète quand elle va au bout, le temps écoulé à l'arrêt manuel.
- **Bloque** : en appariement parallèle, « premier build trouvé » est le
  minimum sur les tranches, pas un événement d'un seul fil : à traiter.

### Objectifs personnalisés

- **Constat** : les objectifs sont une liste fermée (`OBJECTIVE_LABELS`) ;
  aucun ne laisse choisir le poids de chaque stat.
- **Idée** : une pondération libre des stats, choisie par l'utilisateur.
- **Bloque** : jamais construit ni mesuré ; un objectif plus large retient
  plus de runes au pré-filtrage
  ([moteur/elagages.md § Variantes écartées ou gardées en réserve](moteur/elagages.md)).

### Détail des stats finales par source

- **Constat** : la fiche de stats d'un résultat (`src/components/StatPanel.tsx`)
  sépare la base du bonus, ou montre le total ; le bonus n'est pas détaillé
  entre runes, artéfacts, relique et buffs.
- **Idée** : afficher le détail par source.
- **Bloque** : jamais construit ; présentation seulement.

### Simuler des améliorations de runes

- **Constat** : la recherche prend les runes telles qu'elles sont.
- **Idée** : chercher le meilleur build en supposant une amélioration
  future des runes possédées (+15, meules, gemmes).
- **Bloque** : jamais évalué.

### Export et import des builds validés

- **Constat** : la recette exporte les critères d'une recherche, jamais les
  builds validés d'une liste
  ([ecran/lancer-la-recherche.md § Lancer la recherche](ecran/lancer-la-recherche.md)) ;
  un compte réimporté peut perdre des validations (`revalidateBuilds`).
- **Idée** : un fichier réimportable des builds validés (liste, monstre,
  six identifiants de runes et paire d'artéfacts par exemplaire).
- **Bloque** : un format à concevoir, avec son écran d'import et la
  résolution contre un autre compte que celui d'origine.

### Listes : import en masse, enchaînement, préréglages par entrée

- **Constat** : « Ajouter à la liste » ajoute un monstre à la fois, et
  rien n'enchaîne au monstre suivant après une validation
  ([listes-et-reservation.md § Créer, valider et réserver dans une liste](listes-et-reservation.md)).
- **Idée** : importer d'un clic un deck de siège, une recommandation ou une
  équipe RTA ; enchaîner « optimiser puis passer au suivant » ; porter des
  critères par entrée de liste, qui remplissent la recherche.
- **Bloque** : jamais construit ; les préréglages par entrée dépendent de
  l'enchaînement.

### La recette ne garde pas l'exemplaire choisi

- **Constat** : la recette porte le monstre par son `com2usId`, jamais
  l'exemplaire choisi (`OptimizerRecipe`, `src/lib/optimizerRecipe.ts`) :
  l'import retient le premier exemplaire de la box
  ([ecran/lancer-la-recherche.md § Lancer la recherche](ecran/lancer-la-recherche.md)).
- **Idée** : garder l'exemplaire dans la recette.
- **Bloque** : une recette se partage entre comptes, où l'exemplaire n'a
  pas de sens : à concevoir, avec la checklist du skill
  `optimizer-field-propagation`.

### Le cran des artéfacts dans la recette

- **Constat** : le cran « Dégâts supplémentaires | Dégâts réels » de la
  proposition d'artéfacts (`critereArtefacts`,
  [ecran/meilleurs-artefacts-offensifs.md § Deux crans : dégâts supplémentaires ou dégâts réels](ecran/meilleurs-artefacts-offensifs.md))
  n'entre pas dans la recette.
- **Idée** : l'y faire entrer.
- **Bloque** : une décision de produit : c'est un mode d'affichage, pas un
  paramètre de recherche. S'il y entre, la checklist du skill
  `optimizer-field-propagation` s'applique.

### Le cran des artéfacts au choix d'un membre de liste

- **Constat** : choisir dans le bestiaire une autre espèce remet le cran
  des artéfacts à « Dégâts supplémentaires » (`pickSpecies`) ; choisir un
  membre de liste d'une autre espèce (`choisirExemplaire`) le laisse tel
  quel. Sur « Dégâts réels », la légende nomme alors le sort par défaut du
  nouveau monstre : le repli est visible, pas empêché
  ([ecran/recherche-du-monstre.md § Recherche du monstre à optimiser](ecran/recherche-du-monstre.md)).
- **Idée** : remettre aussi le cran au défaut dans `choisirExemplaire`.
- **Bloque** : une décision de produit.

### Diagnostics de l'écran avec les paramètres de la recherche

- **Constat** : l'écran appelle `diagnoseFeasibility` et
  `rankBlockingConditions` sans `relicContext`, sans objectif et sans
  `statsLignesArtefactsEquipables` : en mode relique « recherche », la
  preuve d'impossibilité porte sur la relique portée
  ([moteur/diagnostics.md § Paramètres reçus par les diagnostics de l'écran](moteur/diagnostics.md)).
  Le harnais leur passe les paramètres complets.
- **Idée** : leur passer les `SearchParams` de la recherche, comme le
  harnais.
- **Bloque** : un changement de code, jamais fait.

### Fiche du quasi-succès

- **Constat** : `NearMiss.stats` est la fiche calculée avec la paire
  figée, sans relique en mode « recherche », alors que les écarts viennent
  de l'apport essayé
  ([moteur/diagnostics.md § Ce que le quasi-succès retient](moteur/diagnostics.md)) ;
  l'écran en tire les « PV effectifs » qu'il affiche quand c'est
  l'objectif.
- **Idée** : une fiche qui tienne compte de l'apport essayé.
- **Bloque** : un apport essayé n'est qu'une valeur par stat
  (`artPossibles`), sans la paire qui le produit ; la fiche demanderait de
  garder cette paire, et, en mode « recherche », la relique. Jamais
  construit.

### Viser un ordre de tours plutôt qu'une VIT runée

- **Constat** : aucune condition de recherche ne porte sur l'ordre des
  tours. Viser une vitesse finale est écarté
  ([moteur/optimiseur-artefacts.md § Paire supposée et revérifications](moteur/optimiseur-artefacts.md)).
- **Idée** : des couples (intervalle de vitesse de combat, intervalle
  d'effet du buff de vitesse), tirés de l'outil de speed tuning : deux
  contraintes distinctes, pas un scalaire.
- **Bloque** : non cadré ; exige de lire `speedTuneDeck.ts` et
  `useSpeedTune` avant toute proposition
  ([../speed-tuning.md § Formule (modèle partagé)](../speed-tuning.md)).

## Ajouter une piste

1. Vérifier dans le code que l'idée n'est pas déjà faite, et dans la spec du
   mécanisme qu'elle n'y est pas écartée.
2. Ajouter une entrée dans la section de son domaine : un titre, puis
   **Constat** (ce que le code fait, avec sa coordonnée), **Idée** et
   **Bloque** (ce qui manque : mesure, relevé en jeu, décision, chantier
   ou changement de code).
3. Une piste réalisée sort d'ici dans le commit qui la réalise ; la spec du
   mécanisme décrit alors ce qui est fait. Une piste essayée puis écartée
   sort d'ici et laisse dans la spec du mécanisme une ligne « ne pas…
   parce que… ». Les deux mouvements se font dans le même commit que le
   code.
