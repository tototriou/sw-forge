# Le choix des artéfacts — un second problème, séparé

**Statut :** ÉTAT ACTUEL — décrit la paire d'artéfacts non figée : la paire supposée qui note la recherche de runes, les bornes d'inventaire qui décident de la faisabilité, le test conjoint exact, la vraie paire de chaque build et son régime, la file qui la résout
**Lire si :** on modifie bornesArtefacts, SearchParams.artifactBounds, la paire représentative, le filtre final d'un build, le régime de la paire ou ce qui fait recalculer les paires
**Ne pas lire si :** on cherche l'optimiseur d'artéfacts lui-même — éligibilité, effet des lignes, double boucle, script CLI (optimiseur-artefacts.md)
**Voir aussi :** optimiseur-artefacts.md, elagages.md, pipeline.md, reliques.md, ../ecran/resultats.md, ../invariants.md

Choisir la paire d'un build donné est un problème exact et sans
heuristique : le build de runes est fixe pendant ce choix, et une double
boucle exhaustive sur les deux emplacements le résout, contrainte
d'intangible comprise —
[optimiseur-artefacts.md § Le build est fixe, les artéfacts se posent ensuite](optimiseur-artefacts.md),
[optimiseur-artefacts.md § Éligibilité et contrainte de paire](optimiseur-artefacts.md)
et
[optimiseur-artefacts.md § Pré-filtrage exact — pertinence, obligation, dominance](optimiseur-artefacts.md).
Ce fichier dit comment ce second problème s'articule avec la recherche de
runes : la paire n'est pas figée avant la recherche.

## Pourquoi la paire n'est pas figée avant la recherche

- La principale d'un artéfact est un apport plat de PV, d'ATQ ou de DEF
  (`ARTIFACT_MAIN`, `src/lib/effects.ts`), et c'est tout ce que
  `computeStats` (`src/lib/stats.ts`) lit d'un artéfact : elle entre dans
  les stats que jugent les minimums et les maximums. Figer une paire avant
  la recherche déciderait donc d'avance quels builds sont seulement
  faisables : si la paire figée ne porte pas de DEF, un minimum de DEF doit
  être franchi par les runes seules, alors que l'inventaire contient des
  artéfacts DEF.
- L'erreur frapperait dès le premier étage : la faisabilité écarte des
  runes entières avant toute construction (`eliminateInfeasible`), puis des
  demi-builds, bien avant le classement.
- « Libre » autorise toutes les paires qu'autorise une principale imposée,
  et d'autres. Les bornes d'inventaire de « Libre » contiennent donc
  celles d'une principale imposée : « Libre » ne peut pas rendre moins de
  builds. Avec une paire figée choisie pour son score, il le pouvait.
- La recherche de runes reçoit donc deux entrées distinctes :
  - **la paire représentative** (`SearchParams.artifacts`) note les
    candidats pendant la recherche (`objectiveScore` lit `gear.artifacts`) ;
    elle ne décide pas de leur faisabilité ;
  - **les bornes d'inventaire** (`SearchParams.artifactBounds`) décident de
    la faisabilité.

## Quand ce choix a lieu

1. **Avant la recherche**, l'écran choisit la paire représentative,
   `paireRepresentative(artifactParams)` (`src/lib/artifactOptim.ts`) : la
   meilleure paire pour l'équipement affiché, sous les mêmes principales et
   les mêmes verrous, notée par `evaluateursArtefactsFiche(…).representatif`
   (`src/lib/artifactFiche.ts`). Son régime suit l'**objectif** de la
   recherche, jamais le tri : `Objective` ne vaut jamais PV, ATQ ni DEF,
   donc `degats_reels`, `ehp` ou `aucun`. Il calcule aussi les bornes
   (§ Bornes d'apport pendant la recherche).
2. **Pendant la recherche**, les bornes élaguent et la validation finale
   teste les apports réellement atteignables
   (§ Test conjoint exact à la validation finale). Les stats d'un candidat
   collecté sont calculées avec la paire représentative : elles sont
   provisoires.
3. **Pendant la recherche et après**, la file résout la vraie paire de
   chaque build (`resoudreEquipementDuBuild`, `src/lib/relicQueue.ts`), hors
   du fil de l'écran dans un Worker dédié quand il est disponible : la page
   affichée d'abord, puis l'avance de fond, qui vise `K` combinaisons
   **confirmées** (résolues et conformes) dans l'ordre de base — 300 en mode
   relique `recherche`, 100 sinon (`kDeLaFile`, `src/lib/artifactQueue.ts`),
   l'infini avec « Vérifier toutes les combinaisons trouvées »
   (`cibleDeLaFile`). `K` est fixé par le contexte relique de la recherche
   lancée, jamais par les réglages courants. Trois cents en mode
   `recherche` parce que l'ordre de base y note sans relique : un build
   classé au-delà du centième peut remonter dans la première page une fois
   sa relique résolue. Trois cents réduit ce manque sans l'annuler. Détail
   de la file : [pipeline.md § File de résolution](pipeline.md).

Sans optimisation d'artéfacts, les paramètres de paires restent construits,
avec « Garder l'artéfact équipé » imposé des deux côtés
(`parametresArtefactsFiche`, `src/lib/artifactFiche.ts`) : la seule paire
possible est la portée, et il n'y a pas de file (`resoudreEquipement` est
nul).

Avec des bornes explicites et des apports atteignables, la faisabilité ne
dépend pas de la note de la représentative. Sans bornes (appelant sans
inventaire) ou sans apport atteignable au filtre final, c'est l'apport de la
représentative (`artFlatFige`) qui juge : changer sa note — par exemple en
comptant l'effet unique de la relique de la fiche, en « Dégâts réels » et en
« PV effectifs » — peut changer sa principale, donc l'ensemble des builds
admissibles. Ce repli ne garantit pas l'optimum sur l'inventaire entier.

## Bornes d'apport pendant la recherche

- **`bornesArtefacts(params, statsAvecMinimum, statsAvecMaximum)`**
  (`src/lib/artifactOptim.ts`) rend `BornesArtefacts` : `max`, `min` et
  `possibles` (§ Test conjoint exact à la validation finale).
  - `max[k]` est le meilleur apport atteignable en `k` : borne optimiste,
    pour les branches **minimum** ;
  - `min[k]` est l'apport incompressible, `0` dès que l'emplacement vide
    est candidat : borne pessimiste, pour les branches **maximum**.
  - C'est la dissymétrie que le moteur applique déjà aux sets
    (`guaranteedMin` pour les minimums, `guaranteed` pour les maximums) :
    une borne optimiste ne peut que retenir trop, jamais trop peu. Ne
    jamais employer `max` pour un maximum ni `min` pour un minimum : une
    borne du mauvais côté écarterait des builds valides.
- **Calculées par `chercherPaires`**, avec un `evaluer` qui rend l'apport
  en `k` (son opposé pour `min`) : une recherche exhaustive par stat et par
  sens contraints. Elles héritent ainsi de l'éligibilité,
  d'`artifactPairAllowed` (deux intangibles), du filtre de principale, des
  lignes verrouillées et de l'emplacement vide. `avecCoutDesVerrous` y est
  forcé à faux : il désactiverait l'élagage par obligation. Ne pas calculer
  « le maximum par emplacement, puis la somme » : la forme reste sûre mais
  ignore la contrainte de paire — si les deux maxima sont intangibles, la
  somme n'est atteignable par aucune paire, et chaque point de borne inutile
  coûte de l'élagage.
- **Seulement ce qui est contraint, dans le sens qui l'est** : `max` pour
  les stats qui portent un minimum, `min` pour celles qui portent un
  maximum ; sans maximum posé, aucun balayage pour `min`. Les stats
  qu'aucune principale d'artéfact ne porte (VIT, Taux CRIT, Dgts CRIT, RES,
  PRE) sont ignorées : leur apport est nul des deux côtés. La liste des
  stats portables est déduite d'`ARTIFACT_MAIN`, jamais réécrite. Une stat
  dont aucune paire ne tient les verrous n'a pas d'entrée (lue `?? 0`).
- **Deux producteurs**, à tenir identiques : `searchArtifactBounds`
  (`src/components/outils/OptimizerSection.tsx`) et `resolveArtifactBounds`
  (`scripts/lib/recipeToSearchParams.ts`). Les deux partent des paramètres
  de paires de `parametresArtefactsFiche` et rendent `undefined` sans
  minimum ni maximum posé ; le CLI rend aussi `undefined` sans optimisation
  d'artéfacts, ce qui revient au même (une seule paire possible, la
  portée). Un écart entre eux ferait rejouer au CLI un moteur différent de
  celui de l'écran.
- **Trois consommateurs à l'écran**, avec les mêmes bornes : la recherche
  (`handleSearch`), `diagnoseFeasibility` et `rankBlockingConditions`.
  `diagnoseFeasibility` prouve une impossibilité (« hors de portée ») :
  nourri d'une borne plus étroite que celle qui a élagué, il l'affirmerait
  à tort, alors qu'un autre artéfact l'atteindrait.
- **Dans le moteur**, `deriveMinMaxContext` (`src/lib/runeBuildOptim.ts`)
  range les bornes dans `MinMaxContext` puis `PreparedSearch` :
  `artFlatMax`, `artFlatMin`, `artPossibles` et `artFlatFige` (l'apport de
  la paire représentative). Chaque lecture de `artFlatMax` ou `artFlatMin`
  va par paire avec l'homologue de set — `guaranteedMin` avec `artFlatMax`,
  `guaranteed` avec `artFlatMin` : `eliminateInfeasible`,
  `bucketPairFeasibleMin` (minimums seuls, donc `artFlatMax` seul),
  `comboAFeasible`, `totalPairCount` (mêmes prédicats que l'appariement),
  le repli rapide `quickOk` de `pairBuckets`, `diagnoseFeasibility`,
  `rankBlockingConditions` et `poolMinSlotSafe`. Le détail de chaque
  élagage : [elagages.md § Élagage sûr — faisabilité](elagages.md).
- **Repli** : `artifactBounds` absent, `artFlatMax` et `artFlatMin` valent
  tous deux `artifactFlatBonus(artifacts)`, l'apport de la paire
  représentative, et `artPossibles` est vide ; `eliminateInfeasible` fait
  de même quand son appelant omet `artFlatMin`, qui vaut alors `artFlatMax`. Le
  repli est sûr — il ne retient jamais un build qu'une paire réelle ne
  rendrait pas faisable — mais il fige le choix d'artéfact : un appelant
  qui l'emploie mesure un moteur plus contraint que la production.

## Test conjoint exact à la validation finale

- Les bornes sont calculées **par stat isolée** : avec des minimums sur PV,
  ATQ et DEF à la fois, `max` suppose les trois maxima réunis, alors qu'une
  paire ne porte que deux principales. Un build qui passe les pré-filtres
  n'est donc pas forcément équipable.
- **`possibles`** (`artPossibles` dans le moteur) liste les apports plats
  **réellement atteignables** par une paire, sur toutes les stats
  contraintes, minimum ou maximum. À la validation finale de
  `pairBuckets`, un build n'est retenu que si l'un d'eux lui fait tenir
  **toutes** ses conditions, minimums et maximums avec le même apport.
  Sans `artPossibles` (repli), c'est l'apport de la paire représentative
  (`artFlatFige`) qui est testé.
- **Aucun `computeStats` de plus** : l'apport d'un artéfact est plat, ajouté
  après le calcul des pourcentages, donc la stat d'un candidat avec un
  autre apport vaut `total − artFlatFige[k] + apport[k]`.
- **Placé à la validation finale seulement**, une fois par candidat retenu.
  Les pré-filtres, qui tournent sur des milliards de paires, gardent
  `artFlatMax` et `artFlatMin`, larges donc admissibles, à coût constant.
- **Construction** (`apportsAtteignables`, `src/lib/artifactOptim.ts`) :
  - sans ligne verrouillée, seule la principale compte ; par sorte, on
    garde, pour chaque code de principale, le meilleur artéfact **et** le
    meilleur non Intangible — le meilleur peut être Intangible, et la paire
    de deux Intangibles est interdite —, plus l'emplacement vide s'il est
    candidat ;
  - avec des lignes verrouillées, cette réduction est impossible (le
    meilleur d'un code peut violer le verrou) : on parcourt tous les
    candidats de `candidatsParSorte`, filtrés par `paireRespecteLignes` ;
  - les paires permises (`artifactPairAllowed`) sont dédoublonnées sur les
    stats suivies, puis réduites à leur frontière de Pareto.
- Rien ne se perd au pré-filtrage de la file, qui passe par
  `preFiltrerCandidats` : la dominance y garde inconditionnellement les
  trois principales, et rend deux artéfacts incomparables sous un maximum
  actif sur leur principale
  ([optimiseur-artefacts.md § Pré-filtrage exact — pertinence, obligation, dominance](optimiseur-artefacts.md)).
- **En mode relique `recherche`**, les stats du candidat sont sans relique
  et le terme de relique s'ajoute en majorant côté minimum, en minorant
  côté maximum : le test reste une borne, et l'exactitude vient de la
  résolution avec la relique réelle —
  [reliques.md § Contexte transporté, bornes relâchées, filtre exact](reliques.md).

## Filtre final sur la vraie paire

La résolution d'un build ([pipeline.md § Résolution de l'équipement d'un build](pipeline.md))
repasse les conditions avec la paire qu'elle retient. Ce filtre est
obligatoire : sans lui, un build retenu sur une borne s'afficherait avec une
paire qui viole ses conditions, ce qui est pire qu'un build manquant.

- **Relique fixe** (hors mode `recherche`) : `resoudreReliqueFixe` parcourt
  les paires par score décroissant (`pairesParScore`) et retient la
  première qui tient `respecteConditionsPaireFixe` — les minimums, plus les
  seuls maximums de RES et de PRE ; aucune ne les tient : la meilleure au
  score, avec `conforme: false`. Sans minimum ni maximum RES/PRE posé
  (`conditionsPaireFixePosees`), toute paire convient.
- **Mode `recherche`** : chaque couple (paire, relique) est jugé par
  `respecteConditionsAvecRelique`, minimums et maximums avec la relique
  réelle — [reliques.md § Résolution exacte par build, file, classement](reliques.md).
- La première paire conforme dans l'ordre décroissant du score est la paire
  conforme qui maximise la note du régime (§ Régime de la paire).
- ⚠️ **Hors mode `recherche`, un maximum de PV, d'ATQ ou de DEF n'est pas
  revérifié avec la vraie paire.** La validation finale l'a tenu avec un
  apport atteignable, mais la paire retenue est la meilleure conforme aux
  minimums : elle peut porter une autre principale et dépasser le maximum.
  Les maximums des autres stats ne dépendent pas des artéfacts.
- `respecteMinimums` (`src/lib/artifactOptim.ts`) n'est appelé par aucun
  chemin de production ; seuls des tests l'emploient. Le filtre de
  production est celui des deux puces précédentes.
- Le résultat (`ResultatArtefacts`, `src/lib/artifactQueue.ts`) porte la
  paire, ses artéfacts, les stats **recalculées** avec la paire retenue (et
  la relique retenue en mode `recherche`), et `conforme`, champ
  obligatoire. Il entre dans le cache conforme ou non ; `classementResolu`
  écarte les builds non conformes, et `compositionDePage` n'affiche que les
  builds résolus et conformes — un build pas encore résolu occupe une place
  « Vérification… », jamais une carte provisoire
  ([pipeline.md § Résultat affiché](pipeline.md)).
- Les stats d'une carte sont celles de sa vraie paire, pas seulement son
  total : la principale d'un artéfact entre dans les stats du monstre, et un
  tri par ATQ porterait sinon sur une valeur périmée.
- Un build résolu peut passer devant dans le classement. La file lit
  l'ordre de base, que la résolution ne touche pas, et son cache ne fait que
  grandir : la boucle « trier → résoudre → retrier » converge. Sans
  condition qui écarte la représentative et à régime égal, la vraie paire
  note au moins autant qu'elle, puisqu'elle figure parmi les paires
  candidates ; quand la représentative ne tient pas les conditions du build,
  la meilleure conforme peut noter moins.

## Régime de la paire

- **Un artéfact ne fait varier que PV, ATQ et DEF**, d'où les régimes de
  `regimeArtefacts` (`src/lib/artifactEvaluation.ts`) : `aucun`, `hp`,
  `atk`, `def`, `ehp`, `degats_reels`. Ce que chacun maximise, et comment
  il départage les reliques :
  [elagages.md § Paire d'artéfacts d'un build](elagages.md) et
  [reliques.md § Régimes : ce qui note la relique](reliques.md).
- **Une seule définition de la note**, `evaluerPourRegime`, appelée par
  `evaluateursArtefactsFiche` (la représentative, à l'écran et au CLI) et
  par `entreeResolutionDuBuild` (la résolution, à l'écran, au CLI et dans le
  Worker). Ses surcharges exigent le contexte de dégâts en `degats_reels` :
  l'oubli échoue à la compilation.
- **Le régime de la représentative suit l'objectif ; celui de la
  résolution, le critère regardé** : `regimeEquipement =
  regimeEquipementDe(regimeArtefacts(adapterArtefactsAuTri ? sortBy :
  objective), contexte de dégâts disponible)`. « Dégâts réels » sans sort
  calculable est rabattu sur `aucun`.
- **Régime `aucun`** (Efficience, Vitesse, VIT, Taux CRIT, Dgts CRIT, RES,
  PRE) : aucun artéfact n'entre dans le score, rien n'est à maximiser. La
  note est la somme des principales, pour un ordre qui ne soit pas
  arbitraire ; la résolution y revient à un test de faisabilité — garder ou
  écarter le build.
- Ne pas noter une paire par la somme de ses principales dans les autres
  régimes : elle additionne des PV plats et des DEF plats, sans commune
  mesure, et un tri par ATQ y retiendrait deux PV+1500 plutôt que deux
  ATQ+100.
- **Le régime effectif entre dans la clé du cache** (`signatureArtefacts`),
  pas le critère : deux critères ne la partagent que si la paire optimale
  y est démontrablement la même, ce qui n'est vrai que dans le régime
  `aucun`. Passer d'Efficience à Vitesse ne recalcule donc rien.
- **« Adapter les artéfacts et reliques au tri »**, activé par défaut, fait
  suivre le tri à la paire ; désactivé, elle suit l'objectif de la recherche
  et reste stable pendant toute l'exploration — ce n'est pas « pas
  d'optimisation ». L'interrupteur est masqué sans optimisation
  d'artéfacts (une seule paire possible) :
  [../ecran/resultats.md § Tri des résultats](../ecran/resultats.md).

## Recalcul quand la paire peut changer

Le cache de la file (paires et reliques résolues, clé `cleBuild`) ne fait que
grandir sous une même signature, et se vide quand `signatureArtefacts`
(`src/lib/artifactQueue.ts`, via `signatureReglages`) change. Elle couvre
tout ce qui change le score d'une paire, l'inventaire ou les conditions :

- le monstre, le réglage de dégâts **entier** (sérialisé, jamais quelques
  champs choisis : une clé de cache ne signale aucun champ oublié) et le
  compte des auras RES/PRE propres ;
- le régime effectif (§ Régime de la paire) et l'optimisation coupée ou
  non ;
- les principales choisies et les lignes verrouillées (minimum positif
  seulement, triées : taper puis effacer une valeur ne vide rien) ;
- la relique portée, le nombre d'artéfacts et l'empreinte du contexte
  relique de la recherche lancée ;
- les minimums et les maximums ;
- les **artéfacts réservés** par les autres builds validés de la liste
  active, lus comme un ensemble — « Libérer les artéfacts » sur un autre
  monstre de la liste, ou changer de liste active, refait les paires ;
- les **pièces des emplacements figés** sur « Garder l'artéfact équipé »
  (`piecesFigeesDe`, `src/lib/artifactFiche.ts`), seul candidat de leur
  emplacement : valider un build du monstre recherché, « Voir le runage
  réellement porté » ou changer d'exemplaire de la même espèce les
  remplace. La pièce portée d'un emplacement libre, jamais lue, n'y entre
  pas ;
- l'**identité de l'import du compte** (`importDuCompte`,
  `src/hooks/useOptimizerState.ts`) : un compteur à 0 au chargement de
  l'application, avancé par chaque `resetSearch('compte')`, donc par chaque
  import réel, jamais par la relecture du compte conservé. Le cache est
  indexé par les identifiants des runes et ne voit de l'inventaire que le
  nombre d'artéfacts : sans ce compteur, un réimport qui change une pièce à
  identifiants et nombre égaux garderait les paires de l'ancien compte.
  C'est une identité, pas une empreinte du contenu : tout réimport vide le
  cache, même d'un fichier identique.

Les composants facultatifs (réservations, pièces figées, import) sont omis
quand ils sont vides ou nuls, et la signature reste alors celle d'un écran
qui ne les connaîtrait pas. Une recherche relancée aux mêmes réglages garde
ce que la précédente a résolu. Changer de page repriorise la file sans rien
recalculer de ce qui est déjà connu ; changer de tri ne refait les paires
que s'il change le régime effectif.

## Résolution hors du fil de l'écran

Quand il est disponible, un Worker dédié (`src/workers/resolution.worker.ts`,
corps `CorpsResolution`) exécute la même résolution que le fil de l'écran,
`entreeResolutionDuBuild` puis `resoudreEquipementDuBuild`, sur des entrées
en données (`entreesSerialisables`, qui ne retire que `evaluer`) et avec les
runes de chaque build produites par `runesDuBuild`, le producteur de la
résolution directe. Ce qui compte pour la paire :

- la priorité reste décidée sur le fil de l'écran (`prochainsATraiter`) ; ni
  les builds traités, ni leur ordre, ni `K` ne changent ;
- un nouveau contexte ne vide pas le cache : seul un changement de
  signature le vide, comme sur le chemin direct ;
- une réponse périmée — d'un contexte remplacé ou d'une demande annulée —
  n'est jamais écrite dans le cache ;
- un Worker qui échoue est journalisé et terminé, et la file reprend sur le
  fil de l'écran, avec le cache tel qu'il est.

Le protocole, l'annulation, la cadence de publication et le repli :
[pipeline.md § Worker de résolution](pipeline.md) et
[pipeline.md § File de résolution](pipeline.md). La logique côté écran est
un module pur, `ResolutionDistante` (`src/workers/resolutionDistante.ts`) :
`tests/resolution-distante.test.ts` y fait tourner une file simulée — le
corps derrière `structuredClone`, des entrelacements aléatoires de messages,
de pages, de candidats et de contextes — qui doit remplir le même cache que
la résolution directe, et garde le branchement du hook par des contrôles de
source.

## Partage entre les builds d'une file

Les builds d'une file essaient en grande partie les mêmes paires. Trois
mémoires et un tri différé partagent ce qui ne dépend pas du build, sans
changer aucun résultat :

- le **profil de dégâts d'une paire** ne lit que ses deux pièces : il se
  calcule une fois par paire (`CacheProfilsParPaire`,
  `src/lib/artifactEvaluation.ts` ; clé = identifiants des pièces dans
  l'ordre reçu, emplacement vide compris ; une pièce d'identifiant ≤ 0 n'est
  pas une pièce et n'y entre jamais) ;
- les **candidats élagués de chaque sorte** ne se recalculent que si leurs
  entrées changent (`MemoPreFiltre`, `src/lib/artifactOptim.ts`) : la
  pertinence reste sondée contre le vrai calcul à chaque build et à chaque
  relique, et la liste n'est réutilisée que pour la même pertinence, le
  même inventaire et les mêmes réglages de paires ;
- les **stats d'une paire** ne dépendent que des sommes de ses principales :
  `statsParPaire` (`src/lib/stats.ts`) rend le même tableau aux paires de
  mêmes sommes, et l'effet unique de la relique essayée n'est calculé
  qu'une fois par tableau (`evaluerPourRegime`) ;
- la résolution ne lit d'ordinaire que la **meilleure paire** :
  `pairesParScore` la trouve en un parcours — plus grand score, premier
  dans l'ordre de l'inventaire en cas d'égalité, comme le tri stable — et
  ne trie toutes les paires que si l'on lit plus loin, ou si un score vaut
  NaN. L'ordre rendu est exactement celui de `chercherPaires`.

Chaque mémoire est bornée (`BORNE_PROFILS_PAR_PAIRE`,
`BORNE_MEMO_PREFILTRE`, `BORNE_STATS_PAR_APPORT`,
`BORNE_APPORTS_PAR_STATS`) et se vide d'un coup à sa borne. Leur durée de vie
est celle d'une file (`nouveauxCachesResolution`) : l'écran les recrée avec
la signature des réglages et les paramètres de paires (donc l'inventaire), le
Worker de résolution à chaque contexte reçu, le CLI une fois par recette —
jamais un état global qu'un nouvel inventaire laisserait périmé. Ce qu'elles
rendent est partagé : à lire, jamais à modifier.

## Mesurer un changement des bornes

- **Le régime « avant » est un paramètre, pas une version du code** : sans
  `artifactBounds`, le moteur retombe sur la paire figée, bornes et test
  final compris (§ Bornes d'apport pendant la recherche). Un différentiel
  avant/après se fait en omettant ce champ, sans second arbre de travail.
- Une comparaison de candidats qui atteint `MAX_COLLECTED` des deux côtés
  compare deux troncatures et ne mesure rien : vérifier la saturation avant
  de lire l'écart, et comparer alors la qualité — `effTotal` du meilleur, la
  meilleure valeur équipable —, jamais les comptes.
- Avant une mesure longue, geler une copie de la recette : ne jamais relire
  le fichier de l'écran entre deux passages. Ne relâcher qu'une condition à
  la fois : plusieurs relâchées ensemble donnent un cas dont on ne sait plus
  quelle stat agit.
- Les cas de `scripts/perf-battery.ts` se cherchent en `efficience` avec
  `objectiveStats` (`scripts/lib/perfShared.ts`) : leurs temps ne reflètent
  pas une recherche en « Dégâts réels ». La batterie mesure la justesse — le
  build cible est-il trouvé —, pas la vitesse ressentie.
- `scripts/monster-search-rank-diag.ts` construit encore son apport
  d'artéfact à la main, depuis la paire portée : il mesure le repli, un
  moteur plus contraint que la production. `scripts/diagnostic-harness-parite.ts`
  reproduit volontairement l'ancien appel d'`eliminateInfeasible`, comme
  référence historique : ne pas le « corriger ».
