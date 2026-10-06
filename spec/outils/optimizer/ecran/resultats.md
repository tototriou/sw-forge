# Résultats

**Statut :** ÉTAT ACTUEL — décrit la liste des résultats et leurs cartes
**Lire si :** on modifie l'affichage, le tri ou les actions des résultats de la recherche

13. **Résultats** — jusqu'à 20 combinaisons affichées, chacune : rang, les
    sets obtenus, le **panneau de stats** (`StatPanel.tsx`, le même composant
    que dans « Équipement actuel ») et les artéfacts + les 6 runes sur une
    roue à échelle réduite (`BuildCandidateCard.tsx`), tous deux cliquables
    pour ouvrir le détail complet de la pièce. Puis la valeur **moyenne par
    rune** dans la mesure choisie — « Efficience moyenne : X » ou « Score
    moyen : X » selon le réglage global (Efficience/Score SW).
    ⚠️ **Recalculée à l'affichage** (`candidateMetricTotal` dans
    [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), à partir des VRAIES
    runes) plutôt que lue depuis `BuildCandidate.effTotal` : ce champ est
    figé dans la mesure Efficience/Score active AU MOMENT DE LA RECHERCHE
    (voir `SearchParams.metric`) — si l'utilisateur bascule le réglage (menu
    ⚙) APRÈS avoir cherché, sans relancer, `effTotal` reste dans l'ancienne
    mesure alors que le popover d'une rune individuelle, lui, se recalcule
    toujours en direct. Couvert par un test dédié
    ([tests/rune-optim.test.ts](tests/rune-optim.test.ts) : la fonction ne
    doit JAMAIS lire `effTotal`, vérifié avec un `effTotal` délibérément
    faux). Le tri « Trier par efficience » recalcule de même.
    ⚠️ **Une carte tient dans 360 px**, calibré exprès (`scale=0,45` sur la
    roue et les artéfacts, grille `repeat(auto-fill, minmax(min(360px,100%),
    1fr))`, creux `gap-3`) : c'est le PLANCHER d'une carte ; `auto-fill` en
    fait tenir deux dès que la grille dépasse deux fois 360 px plus le
    creux, davantage sur un écran large. La bascule base+bonus ↔ total ne
    déplace jamais les artéfacts, la roue ou la relique voisins : `StatPanel` a une **largeur
    fixe** (`w-[200px]`, voir [rta/sections-runes.md](../../../rta/sections-runes.md)).
    ⚠️ **À la souris, la relique est toujours SOUS LA ROUE** (carte de
    résultat seulement —
    `MonsterGear` garde la sienne à droite) : fiche, artéfacts et roue font
    332 px à l'échelle 0,45, ce que la carte au plancher contient tout
    juste ; à droite de la roue, la relique déborderait des deux côtés. Le
    groupe artéfacts / roue est une grille à deux colonnes : la relique
    occupe la case sous la roue, centrée, et les artéfacts restent centrés
    sur la roue. La colonne vaut la largeur de la roue (`min-content`) : la
    relique et ses marques s'y replient en entier, sans l'élargir — aucun
    libellé raccourci — et la relique ne change jamais de place quand la
    file la résout. Au doigt (`COMPACT`, pointeur seul), rendu inchangé : la
    relique reste à droite de la roue — passe responsive.
    ⚠️ **Détail à la souris vs au doigt — même bascule que « Équipement
    actuel »/RTA/Siège** (voir `MonsterGear.tsx`) : à la souris, un flottant
    ancré à la pièce ; au doigt, le détail s'affiche **en ligne sous la
    carte**, sur sa propre ligne. Un flottant à taille fixe déborderait de
    l'écran sur une carte de résultat déjà compacte en mobile.
    ⚠️ **Cliquer sur une rune** d'un résultat ouvre le **même popover** que
    dans Mon compte → Runes (`DetailPopover` + `RuneDetailBox`, ancré sur la
    rune cliquée) — les runes d'un candidat sont de vraies runes du compte.
    La rune ouverte porte le **même halo orange** que la sélection dans
    `MonsterGear` (`brightness` + `drop-shadow`, voir `RuneWheel.tsx`) — la
    roue de résultat se comporte comme n'importe quelle roue de l'app. Une
    seule rune ouverte à la fois, **parmi TOUS les résultats affichés** (pas
    seulement dans la même carte) ; ⚠️ l'identité d'une rune ouverte (donc du
    halo) combine le candidat ET le slot (`BuildCandidateCard.tsx`), pas
    seulement l'id de la rune : la même rune peut apparaître dans plusieurs
    candidats affichés à la fois, et ne doit ouvrir qu'UNE instance.
    ⚠️ **Le popover passe toujours au premier plan, quel que soit son
    voisinage** : sans z-index, deux éléments `position:absolute` frères
    s'empilent par simple **ordre du DOM**, pas par position à l'écran — le
    popover d'une rune serait recouvert par le cadre d'une autre
    rune de la même roue rendue plus tard, ou par une carte/fiche voisine
    plus loin dans le DOM (grille de résultats, ligne suivante d'un
    `AccordionGrid` en RTA/Siège). Sont donc promus, UNIQUEMENT tant
    qu'un popover y est ouvert, le wrapper de la pièce concernée (`z-10`,
    dans `RuneWheel.tsx`/`ArtifactSlots.tsx`/`MonsterGear.tsx` pour la
    relique) **et** la carte ou fiche entière qui le contient (`relative
    z-10`, `BuildCandidateCard.tsx` et `MonsterGear.tsx`) — deux niveaux,
    parce qu'un popover doit gagner à la fois contre ses voisins immédiats et
    contre les autres cartes de la grille.

## Diagnostic sur 0 résultat

⚠️ **Sur 0 résultat**, jusqu'à trois encadrés diagnostic apparaissent, à la
suite :
- **Toujours** : une liste de conditions mathématiquement hors de portée
  (avec leur borne exacte), ou un message neutre orientant vers la
  conjonction des contraintes ou un pré-filtrage plus large.
- **Si « Diagnostic approfondi sur 0 résultat » est coché** (décoché par
  défaut, plus coûteux — voir conditions-et-reglages.md § Réglages avancés) : pour chaque
  condition posée, DE COMBIEN la desserrer suffit à faire grandir le pool
  pré-filtré (« VIT −15 suffit (≥ 160) »), ou « aucun gain, même
  desserrée entièrement » si ce n'est pas la stat qui bloque à ce stade.
  Décoché, une simple invitation discrète à l'activer.
- **« Quoi ajuster pour trouver des builds »**, systématique (coût nul,
  sans réglage) : contrairement au point précédent, qui ne regarde que le
  pré-filtrage, celui-ci vient de la recherche RÉELLE — la meilleure
  combinaison de runes déjà examinée qui échoue de peu. Pour chaque
  condition posée, si une combinaison satisfait tout le reste et ne
  manque QUE celle-ci, son écart (« VIT −5 suffirait (≥ 105) »), plus la
  combinaison la plus proche toutes conditions confondues. N'apparaît que
  s'il existe au moins un tel résultat parmi ce que la recherche a
  réellement exploré — un near-miss encore plus proche, jamais atteint
  avant l'arrêt de la recherche, resterait invisible.

Ces trois encadrés ne portent que sur un **moteur vide**
(`result.candidates.length === 0`) : leurs chiffres viennent des bornes
du moteur, pas de la résolution exacte.
⚠️ **La ligne de progression compte les trouvées** : trouvés par le
moteur — `result.candidates.length` à la fin, `progress.found` pendant
l'appariement — moins ceux que la résolution exacte a écartés faute de
couple artéfacts/relique faisable (`conforme: false`). Les écartés se
mesurent comme candidats reçus (`fullSortedCandidates`) moins
affichables (`affichees`), jamais en comptant les entrées
`conforme: false` du cache de la file : il n'est vidé qu'au changement
de signature, et une recherche relancée aux mêmes réglages garderait
les rejets de la précédente. Une seule fonction pure,
`compteAffichable` (artifactQueue.ts), alimente la ligne de progression
(« X / Y combinaisons examinées · Z trouvée(s) ») et la ligne de raison
ci-dessous. Le compte suit chaque publication du cache de la file
(400 ms), en pleine recherche comme après sa fin ; un build pas encore
résolu reste compté : c'est une borne optimiste, qui baisse à mesure que
la vérification écarte des builds. Sans optimisation d'artéfacts, pas de
file : rien ne change. L'en-tête des résultats et le nombre de pages ne
lisent pas ce compte, mais celui des confirmées (ci-dessous). **Sous « Aucune combinaison ne répond à ces critères »**
(tout vérifié, aucune confirmée), une ligne de raison : « 1 combinaison
trouvée par la recherche a été écartée : aucune paire d'artéfacts ni
relique réelles ne tient toutes les conditions. » (pluriel : « N
combinaisons trouvées par la recherche ont été écartées »). Hors relique
« recherche » de la recherche lancée, la relique est celle de la fiche
et la ligne ne parle que de la paire (« aucune paire d'artéfacts réelle
ne tient toutes les conditions. »). Les trois encadrés ci-dessus ne
s'affichent pas sous un tel zéro.

## Compte des combinaisons confirmées et pagination

⚠️ **L'en-tête compte les combinaisons confirmées**, un nombre stable,
compté après vérification. Pendant la recherche, « XX combinaison(s)
confirmée(s) pour l'instant — recherche en cours… », puis « XX
combinaison(s) confirmée(s) » : seulement les builds de cette recherche
vérifiés (résolus ET conformes), lus dans le cache publié de la file. Le
compte **ne baisse jamais pendant une recherche** : le cache ne fait que
grandir, l'aperçu des reçus aussi ; seul un changement de signature (un
réglage qui change la note d'une paire, dont un tri qui change de régime
avec « Adapter les artéfacts et reliques au tri ») vide le cache et fait
recommencer la vérification, donc le compte. Une petite infobulle
(« Combinaisons confirmées », à droite de l'en-tête, quand une file
vérifie) dit la différence avec les trouvées de la ligne de progression :
une combinaison confirmée tient vraiment toutes les conditions avec les
pièces de l'inventaire ; « trouvée(s) » est une estimation optimiste,
retenue stat par stat, dont une partie est écartée à la vérification ;
la vérification s'arrête à 100 confirmées (300 quand la relique est
cherchée), et « Vérifier toutes les combinaisons trouvées » (Réglages
avancés) va jusqu'au bout.
**« Aucune combinaison ne répond à ces critères »** ne s'affiche qu'une
fois la recherche finie et tout vérifié sans aucune confirmée — la file
va jusqu'au dernier build trouvé faute de K confirmées (voir
../moteur/artefacts.md § Quand ce choix a lieu) ; alors seulement « Trier par » et « Adapter les
artéfacts et reliques au tri » se masquent, comme sur un moteur vide.
**Les pages suivent les confirmées** : les pages des confirmées, plus
une tant qu'il reste des builds non vérifiés qui n'ont pas de place sur
la dernière — ses places « Vérification… » se résolvent quand on
l'ouvre (ci-dessous) —, soit `min(⌈(confirmées + non vérifiés) / 20⌉,
⌈confirmées / 20⌉ + 1)`, au moins 1 : jamais une page vide. Par exemple,
5 100 trouvées et 300 confirmées donnent 16 pages, et non 255. Si le nombre de pages diminue (la page au-delà des
confirmées perd ses derniers non vérifiés, ou la vérification
recommence), la page courante revient sur la dernière. Une seule
fonction pure, `compteConfirme` (artifactQueue.ts), donne le compte, les
non vérifiés, les pages et l'état « Aucune combinaison… », à partir des
reçus et du cache publié. Sans optimisation d'artéfacts, pas de file :
l'équipement est celui de la fiche, déjà jugé exactement par le moteur —
les confirmées sont les trouvées, les pages celles des reçus, et
l'infobulle ne s'affiche pas.
⚠️ **Une carte n'apparaît qu'une fois vérifiée** : une carte qui
apparaîtrait avec sa paire supposée puis se retirerait à la vérification
rendrait la liste illisible. Dès qu'une file tourne (optimisation d'artéfacts
active), la page ne montre que des builds dont l'équipement est résolu
(paire, relique) ET conforme, pendant la recherche comme après : un
build reçu de la recherche ne s'affiche plus avec sa paire supposée, et
un build écarté à la résolution n'est jamais montré. Les cartes de la
page N sont les vérifiés de rang 20 × (N − 1) + 1 à 20 × N parmi les
vérifiés, dans l'ordre du classement réel ; un build vérifié plus tard
prend sa place dans ce classement — une carte peut descendre sous un
meilleur build vérifié, jamais disparaître faute
de conformité. Les places que la page attend encore (comptées sur la
liste paginée, au plus 20) suivent les cartes, marquées
« Vérification… » : un emplacement en pointillé avec son rang, à la
hauteur d'une carte — la plus petite carte mesurée à l'écran, ou, avant
la première, une hauteur de repli relevée au navigateur sur une carte
« Dégâts réels » (388 px à l'ordinateur, 458 px au téléphone) — pour que
la grille et la pagination ne sautent pas quand la carte arrive. La file
résout d'abord les builds qui rempliront ces places (les premiers non
résolus du classement, au plus une page à la fois), puis l'avance de
fond, qui vise K combinaisons **confirmées** (voir
../moteur/artefacts.md § Quand ce choix a lieu). Une page au-delà des vérifiés (au-delà des K
confirmées, après la recherche) montre ses places et se résout quand on
l'ouvre — au prix de
tous les builds non résolus classés avant elle, puisque le rang d'un
vérifié dépend de tous ceux du dessus. Ni l'ordre de base, ni K, ni la
résolution ne changent. Une seule fonction pure, `compositionDePage`
(artifactQueue.ts), donne les cartes, les places et les builds à
vérifier, à partir du classement affiché et du cache publié de la file.
Les comptes gardent leur règle (ci-dessus) ; une ligne sous l'en-tête dit
combien la file doit encore vérifier (« N combinaison(s) en
vérification… » : le reste de la file, places en attente puis avance de
fond), sa place réservée tant que la file tourne. Sans optimisation
d'artéfacts, pas de file : la page est la tranche du classement.

## Tri des résultats

Un sélecteur **« Trier par »** re-trie **côté
client, instantanément**, sans relancer la recherche : le moteur a déjà
calculé les stats complètes de chaque combinaison retenue. Deux groupes
d'options — les 8 stats brutes, et les mêmes objectifs que l'objectif de
recherche (voir objectif-de-recherche.md § Les quatre objectifs disponibles ;
« Dégâts réels » n'y figure que si un sort est réellement calculable
pour ce monstre).

⚠️ **Interrupteur « Adapter les artéfacts et reliques au tri »**
(un seul contrôle gouverne l'équipement complet, paire et relique, d'un
seul geste), collé à GAUCHE de ce sélecteur, **activé par défaut**. Le
tri est une **vue**, l’optimisation une **décision** : les coupler
d’office imposerait un arbitrage.
- **Activé** — chaque build reçoit les artéfacts ET la relique qui
  maximisent le critère affiché : « le meilleur équipement pour ce que je
  regarde ».
- **Désactivé** — ils restent ceux qui servent l’**objectif de la
  recherche**, quel que soit le tri : « le meilleur équipement pour ce que
  j’ai cherché ». Utile pour parcourir les résultats classés autrement sans
  que l'équipement bouge — par exemple garder celui qui maximise les PV
  effectifs tout en regardant les builds triés par une stat.

⚠️ **Désactivé ne veut PAS dire « pas d’optimisation »** — c’est
« Activer l’optimisation d’artéfacts et reliques » qui le fait. Sans référence de
repli définie, « ne pas recalculer » ne voudrait rien dire : il faut savoir
par rapport à quoi, d’où l’objectif de recherche, seule référence stable.

⚠️ **Masqué quand l’optimisation d’artéfacts est désactivée** : il n’y a
alors qu’une paire possible, celle qui est portée. Même règle que les
sélecteurs de principale et les sous-propriétés verrouillées — une saisie
sans effet est pire qu’une saisie absente.

⚠️ Désactivé, la paire est **stable pendant toute l’exploration** : le
bouton « Valider les artéfacts » propose donc la même chose quel que soit
le tri, ce qui rend prévisible une action qui réserve des pièces.

## Valeur d'objectif affichée sur les cartes

⚠️ **Objectif « Dégâts réels »** : chaque carte affiche en tête le
**nombre de dégâts** qui a servi à la classer, et la part des PV de la
cible qu'il emporte (« tue la cible » au-delà de 100 %). Visible dès que
ce critère ordonne la liste — que ce soit l'objectif de la recherche ou
un tri choisi après coup.
⚠️ **Objectif « PV effectifs »** : même traitement, et pour la même
raison — chaque carte affiche la valeur de PV effectifs qui l'a classée :
sans elle, on trierait par PV effectifs sans jamais voir la valeur
triée. Le chiffre vient de `pvEffectifs` (runeBuildOptim.ts), **la même
fonction que celle qui classe** (`objectiveScore` l'appelle), jamais une
copie côté écran, qui divergerait au premier ajustement du facteur de
défense.
⚠️ **Les deux chiffres passent par `scoreDuCandidat`**, avec les options
mêmes du classement affiché : auras externes
et activations propres du build, profil d'artéfacts de SA paire, apport
de SA relique retenue (Conquête pour les dégâts ; Ténacité et points
Bravoure/Éternité/Origine pour les PV effectifs). Recopier
`computeTotalDamage` puis `pvEffectifs` sans cet apport ferait afficher,
en mode relique `recherche`, à un build classé premier par sa Conquête un
chiffre inférieur à celui du suivant. L'écart « Comparer » note la fiche
de la même façon, avec SA paire et SA relique : voir
../listes-et-reservation.md § Comparer, valider sans recherche et persistance.
⚠️ **L'effet unique compte dans les trois modes de relique** — la
relique est celle que la carte affiche
(`etatReliqueDuBuild`, une seule expression pour la case et le score) :
interrupteur coupé ou « Garder la relique équipée », **la relique de la
fiche**, dès la collecte, sans attendre la file — ordre de BASE compris,
celui que la file lit et qui s'affiche tel quel tant qu'elle n'a rien
résolu, donc toujours quand l'optimisation d'artéfacts est coupée
(sans cache de la file : aucune boucle) ; mode `recherche`, **la
relique retenue** pour ce build, et un apport **neutre** tant que la file
ne l'a pas résolu — jamais un repli sur la relique portée ; aucune
relique, neutre. Hors `recherche`, ignorer l'effet unique de la relique
portée ferait classer le tri et les cartes autrement que la file, qui le
compte pour choisir la paire. Les options viennent d'`optionsDeClassement`
(runeBuildOptim.ts), le producteur même que les tests appellent — et
le script CLI (`optimizer-search.ts`).
⚠️ **Le CLI classe comme l'écran, équipement résolu compris**. Dès que l'optimisation d'artéfacts est active
(là où l'écran a une file), il résout l'équipement par les producteurs
mêmes de la file : `entreeResolutionDuBuild` puis
`resoudreEquipementDuBuild` — la paire seule avec la relique de la fiche
en `equipped`, le couple paire/relique en `recherche`, un build sans
couple faisable étant rejeté. Il classe ensuite par `classementResolu`,
le producteur d'`affichees`, avec l'effet unique de la relique retenue.
**Par défaut, il résout COMME LA FILE DE L'ÉCRAN** : l'ordre de base
jusqu'à K combinaisons confirmées (ou jusqu'au dernier build trouvé) et
ses 20 lignes imprimées (sa « page »), choisis par `prochainsATraiter`,
par lots, jusqu'à ce que toutes les lignes imprimées soient résolues ;
les autres candidats restent dans l'ordre de base.
K vaut **300 en mode relique `recherche`, 100 sinon** : `kDeLaFile`
(artifactQueue.ts), la fonction même de l'écran, lue sur le contexte
relique de la recherche lancée (`params.relicContext`) ; K compte des
combinaisons confirmées, pas des rangs.
Avec « Vérifier toutes les combinaisons trouvées » dans la recette
(`verifierToutesLesCombinaisons`, lu par `toutVerifierDeLaRecette`,
recipeToSearchParams.ts, repli `?? false` comme l'écran), la cible est
infinie (`cibleDeLaFile`, la fonction de l'écran) : le CLI résout tous
les candidats, comme la file de l'écran avec l'interrupteur, et son
classement est alors celui de `--resoudre-tout` ; sa console le dit.
`--resoudre-tout` résout TOUS les candidats collectés. Ce n'est pas le
défaut parce qu'avec des artéfacts « Libre » — le défaut de l'écran —, la
résolution complète coûte environ 20 fois la recherche (mesuré : 6,7 min
pour 5 100 builds × 4 reliques).
⚠️ Comme celui de l'écran, ce classement n'est pas exhaustif : en mode
`recherche`, l'ordre de base ignore la relique, et un build au-delà de
la K-ième confirmée peut remonter très haut une fois résolu sans que la
file le résolve. Relevé sur un vrai compte, en PV effectifs : K = 100
laisse manquer les rangs exhaustifs 16, 17 et 19 (rangs de base 107 à
117), que K = 300 rattrape. Sur la fixture de `testCliClassementParMode`
(tests/cli-classement.test.ts), construite pour cela, les 300 premiers
de l'ordre de base laissent manquer 9 des 20 premiers exhaustifs (rangs
de base 305 à 399) ; la file, qui continue au-delà des 112 écartés
jusqu'à 300 confirmées (rang 412), n'en manque aucun. Le top affiché en
mode `recherche` reste une approximation, dite ici, jamais à l'écran.
`--resoudre-tout` reste la référence exacte. Sa console imprime le mode, le nombre de builds
résolus et rejetés, la durée de la résolution, la relique et les
artéfacts retenus de chaque ligne, la troncature éventuelle de la
recherche, et quelle relique compte (« Effet unique de relique dans le
tri : … »). Interrupteur coupé (mode `off`) : ni l'écran ni le CLI ne
résolvent rien.
⚠️ **Un tri par PV, ATQ ou DEF classe sur la FICHE** : la stat que la
carte affiche (`candidate.stats`, le panneau de stats) et que jugent les
conditions minimum et maximum — sans les points Bravoure, Éternité ni
Origine, acquis au début du combat comme les auras, le lead et
l'invocateur, qu'il ne compte pas non plus. Ajouter ces seuls points au
tri le ferait classer sur une valeur que la carte ne montre pas. La même
valeur note la paire d'artéfacts dans ces régimes (voir
../moteur/elagages.md § Recherche des runes — meet-in-the-middle et élagages). Les tris « Dégâts réels » et « PV
effectifs » gardent l'effet unique, comme ci-dessus.

## Validation d'un build et relique

⚠️ **« Valider ce build »**, sur chaque carte — réserve les 6 runes de CE
résultat (elles n'apparaissent plus dans les recherches suivantes de la
même liste de travail), jusqu'à libération explicite : voir
../listes-et-reservation.md § Listes de travail et réservation de runes.

⚠️ **Relique, un emplacement, quatre états** — un emplacement « Relique »,
sous la roue à la souris, à sa droite au doigt (voir plus haut), même
modèle que celui de la fiche d'équipement
(`MonsterGear.tsx`) : composant partagé `RelicSlot`, jamais une copie.
Hors mode `recherche` (interrupteur coupé, « Garder la relique
équipée »), la relique portée, ou la case grisée « aucune » sans relique. En mode `recherche`,
`etatReliqueDuBuild` (seule source) pilote la case :
- **en attente** — la file n'a pas encore traité ce build : **la même
  case**, grisée, « en attente » — rien ne bouge à l'écran quand la file
  résout, seul le contenu de la case change. Cet état ne se voit pas
  sur une carte de résultat : quand une file tourne, un
  build non résolu n'est pas affiché, sa place dit « Vérification… » ;
- **rejeté** — aucune relique éligible ne rend le build faisable :
  jamais affiché, le classement l'a déjà écarté ;
- **résolue** — la relique retenue (principale dans la case ; le détail
  complet — `RelicDetailBox` : principale et phrase de la propriété unique,
  `formatRelicUnique`, celle de la fiche d'objet, jamais le libellé court
  « `<effet>` en fonction `<stat>` » du sélecteur — au clic, comme un
  artéfact : flottant ancré à la
  souris, ligne sous la carte au doigt), avec deux marques possibles
  sous la case : « relique sans effet sur ce tri » (régime `aucun` —
  Efficience, Vitesse…) et « relique équipée exclue par le filtre » (la
  relique portée ne passe pas le seuil/la principale/le type demandés,
  la meilleure admissible peut alors noter moins qu'elle).

⚠️ **Le compte `n / 150`** (occupation de la relique sur le compte,
affichée, jamais bloquante) n'est pas dans la case — trop de détail pour
une case au format artéfact/rune — mais dans le **détail** de la
relique (`RelicDetailBox`, une ligne, « Équipée sur n exemplaires /
150 » — pas un libellé relevé en jeu), visible depuis la carte candidat
ET depuis l'exemplaire (fiche d'équipement de l'Optimizer, même
composant) ; `relicUsageById` redescend jusqu'aux deux appelants de
`RelicSlot` pour ça.
Le classement n'affiche **jamais** de gain contre la relique équipée :
il exigerait une seconde évaluation par build dans la file.

⚠️ **Refus nommé** — pool de reliques vide en mode `recherche` (seuil
trop haut, aucune relique de la principale/du type demandés, ou aucune
relique dans l'inventaire importé) : le refus s'affiche à la place du
lancement, un texte par raison, traité comme une recherche en échec
(même bouton, même état affiché).

⚠️ **Rien n'est appliqué au compte.** L'outil est en lecture seule et
purement indicatif, comme le reste de SW Blacksmith (aucune écriture vers le
jeu) : c'est au joueur de re-runer dans Summoners War.

