# Résultats

Ce document décrit la liste des résultats et leurs cartes. Au bureau, ils
vivent dans la section « Résultats » (`ResultatsBureau`), dernière du panneau
de la colonne de droite, présente dès le départ avec sa place d'attente,
sous « Exemplaire » et le bloc « Objectif et
Rechercher » : sa largeur, ses messages d'attente et la hauteur qu'elle
garde à la relance sont dans
[README.md](README.md#zone-des-résultats-et-place-en-plus). Au téléphone,
ils suivent la progression, sur toute la largeur.

Les résultats gardent le contexte photographié au clic « Rechercher » :
conditions, inventaires, fiche, combat, objectif et « Vérifier toutes les
combinaisons trouvées ». **Seul « Rechercher » lance une recherche** :
modifier les stats, les conditions minimum et maximum, l'objectif, les sets
ou un réglage de recherche prépare la prochaine, sans relancer ni la
recherche ni l'équipement des builds, et sans changer les résultats
affichés ; rafraîchir la page ne relance rien ; changer de monstre (dans le
bestiaire ou dans la liste) efface les résultats, sans rien relancer non
plus. Le tri, la mesure et la page ne font que choisir ce qui est montré :
ils ne résolvent aucun équipement, sauf la page demandée en naviguant
(ci-dessous). Le classement et la file vivent dans un Worker dédié,
conservé pendant la navigation ; l'écran n'en reçoit que la page affichée,
ses comptes et ses versions. L'équipement se vérifie sur plusieurs Workers
à la fois (autant que la machine en accorde à la recherche) ; la panne de
l'un est reprise par les autres, celle de tous dans le classeur. Perte du classeur : le message d'échec de recherche existant
s'affiche et la dernière page reçue reste visible, marquée interrompue, ses
actions désactivées (§ Compte des combinaisons confirmées et pagination),
sans relance automatique ni reconstruction d'un résultat depuis l'écran.

13. **Résultats** — jusqu'à 20 combinaisons affichées par page, chacune : rang, les
    sets obtenus, le **panneau de stats** (`StatPanel.tsx`, le même composant
    que dans « Équipement actuel ») et les artéfacts + les 6 runes sur une
    roue à échelle réduite (`BuildCandidateCard.tsx`), tous deux cliquables
    pour ouvrir le détail complet de la pièce. Puis la valeur **moyenne par
    rune** dans la mesure choisie — « Efficience moyenne : X » ou « Score
    moyen : X » selon le réglage global (Efficience/Score SW).
    ⚠️ **Au bureau, l'en-tête d'une carte tient sur une ligne** (décision
    de l'utilisateur : la carte raccourcit) : le rang et ses sets à gauche,
    la valeur moyenne calée à droite (décision de l'utilisateur), au lieu
    d'une ligne de sets à part ; des sets trop longs se replient sous le
    rang, jamais la valeur. « Comparer » et « Valider ce build »
    restent **en bas de la carte**, comme au téléphone (décision de
    l'utilisateur) : « Comparer » à sa largeur, « Valider » à la largeur fixe
    de son plus long libellé (160 px ; « Valider les artéfacts » en mesure
    123), si bien que passer à « Validé » ne déplace ni lui ni « Comparer ».
    ⚠️ **Aux deux formats, l'écart de « Comparer » s'affiche À GAUCHE de la
    valeur qu'il qualifie**, sur sa ligne (valeur moyenne, PV effectifs,
    dégâts ; décision de l'utilisateur) : sous elle, il faisait grandir la
    carte au clic, et « Comparer » descendait sous le pointeur. Sa place
    (44 px) est réservée même vide : la valeur reste calée à droite et la
    ligne garde sa hauteur. Vérifié au navigateur aux deux formats, avec
    l'en-tête du bureau, les boutons à parts égales du téléphone et la
    fiche resserrée au pire cas
    ([optimizer-carte-resultat-navigateur.test.ts](tests/rendu/optimizer-carte-resultat-navigateur.test.ts)).
    Mesuré (carte de 356 à 716 px, compte d'exemple, sans « Dégâts ») :
    en-tête de 19 px, carte de 284 px avec un ou deux boutons. Le téléphone
    garde son en-tête et sa ligne de sets ; ses deux boutons se partagent la
    largeur de la carte (une enveloppe `flex-1` autour de chaque bouton
    `pleineLargeur` : un `flex-1` posé sur le bouton lui-même perd contre le
    `flex-none` du socle de `Bouton`).
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
    ⚠️ **Les runes et la mesure de la carte sont celles que le classeur a
    jugées** : les runes du contexte de la recherche (`runesDuContexte`,
    le pool photographié au lancement) et la mesure de la vue publiée. Une
    borne d'Efficience compare ainsi le chiffre même de la carte ; avec
    l'inventaire vivant, un inventaire changé sous des résultats encore
    affichés aurait fait écrire à la carte un autre chiffre que celui jugé.
    ⚠️ **Au téléphone et au doigt, une carte tient dans 360 px** (`scale=0,45` sur la
    roue et les artéfacts, grille `repeat(auto-fill, minmax(min(360px,100%),
    1fr))`, creux `gap-3`) : c'est la largeur d'une carte par rangée ;
    `auto-fill` en fait tenir deux dès que la grille dépasse deux fois 360 px
    plus le creux, davantage sur un écran large. Plus étroite, la grille
    garde une carte, à toute sa largeur : au bureau, la colonne de droite
    descend jusqu'à 356 px de contenu (fiche d'« Exemplaire » repliée), où
    la carte tient sans déborder (mesuré, relique comprise). La bascule base+bonus ↔ total ne
    déplace jamais les artéfacts, la roue ou la relique voisins : `StatPanel` a une **largeur
    fixe** (`w-[200px]`, voir [rta/feat-sections-runes.md](../../rta/feat-sections-runes.md)).
    ⚠️ **Au bureau, à la souris, une carte tient dans 328 px** (décision
    de l'utilisateur : une carte de plus par rangée) : la grille passe à
    `minmax(min(328px,100%),1fr)`, et la fiche de stats se resserre à
    174 px, fixe elle aussi, avec 6 px de rembourrage latéral au lieu de 12 :
    la place retirée est l'écart entre la colonne des libellés et celle des
    stats de base. La table garde 160 px pour 157 au pire cas mesuré (base à
    six chiffres comme les 19 755 PV, la plus haute des données, bonus
    « +40 000 ») : rien n'est tronqué ni replié. Rembourrage de la carte et
    creux entre cartes inchangés. Mesuré (compte d'exemple, A3) : 3 cartes
    par rangée au lieu de 2 à 1920 × 940, 2 au lieu de 1 avec « Artéfacts et
    relique » ; 5 au lieu de 4 à 2560 × 1300, 4 au lieu de 3 avec la
    colonne. Au doigt et au téléphone, 360 px et la fiche de 200 px.
    ⚠️ **Au bureau, ses lignes sont resserrées** (`StatPanel`, `serre`,
    décision de l'utilisateur) : un pas de 22 px au lieu de 27, taille du
    texte inchangée (interligne `snug`, 2 px de rembourrage au lieu de 4).
    Mesuré : le panneau passe de 241 à 197 px, la carte d'autant. La
    fiche d'« Exemplaire » et le téléphone gardent le pas de 27 px.
    ⚠️ **À la souris, la relique est toujours SOUS LA ROUE** (carte de
    résultat seulement —
    `MonsterGear` garde la sienne à droite) : fiche, artéfacts et roue font
    332 px à l'échelle 0,45 (306 au bureau, fiche de 174 px, dans une carte
    de 328), ce que la carte au plancher contient tout juste ; à droite de la roue, la relique déborderait des deux côtés. Le
    groupe artéfacts / roue est une grille à deux colonnes : la relique
    occupe la case sous la roue, centrée, et les artéfacts restent centrés
    sur la roue. La colonne vaut la largeur de la roue (`min-content`) : la
    relique et ses marques s'y replient en entier, sans l'élargir — aucun
    libellé raccourci — et la relique ne change jamais de place quand la
    file la résout. Au doigt (`COMPACT`, pointeur seul), la relique reste à
    droite de la roue : la disposition du téléphone, gardée telle quelle
    ([README.md § Au format téléphone](README.md#au-format-téléphone)).
    ⚠️ **Détail à la souris vs au doigt — même bascule que « Équipement
    actuel »/RTA/Siège** (voir `MonsterGear.tsx`) : à la souris, un flottant
    ancré à la pièce ; au doigt, le détail s'affiche **en ligne sous la
    carte**, sur sa propre ligne. Un flottant à taille fixe déborderait de
    l'écran sur une carte de résultat déjà compacte en mobile.
    ⚠️ **Cliquer sur une rune** d'un résultat ouvre son détail complet
    (`RuneDetailBox`, partagé avec Mon compte → Runes) : dans un
    `FlottantAuto` ancré sur la rune à la souris, en ligne sous la carte
    au doigt. Les runes d'un candidat sont de vraies runes du compte.
    La rune ouverte porte le **même halo orange** que la sélection dans
    `MonsterGear` (`brightness` + `drop-shadow`, voir `RuneWheel.tsx`) — la
    roue de résultat se comporte comme n'importe quelle roue de l'app. Une
    seule rune ouverte à la fois, **parmi TOUS les résultats affichés** (pas
    seulement dans la même carte) ; ⚠️ l'identité d'une rune ouverte (donc du
    halo) combine le candidat ET le slot (`BuildCandidateCard.tsx`), pas
    seulement l'id de la rune : la même rune peut apparaître dans plusieurs
    candidats affichés à la fois, et ne doit ouvrir qu'UNE instance.
    ⚠️ **Le flottant passe dans la couche supérieure** (`FlottantAuto`,
    fondé sur `Flottant`) : les cartes voisines et les panneaux qui
    défilent ne peuvent ni le recouvrir ni le rogner. Il suit son ancre
    et reste borné à la fenêtre. Les marques `z-10` de la pièce ouverte
    et de sa carte restent présentes ; elles ne portent pas cette
    garantie, assurée par l'API `popover`.

## Diagnostic sur 0 résultat

⚠️ **Sur 0 résultat**, jusqu'à trois encadrés diagnostic apparaissent, à la
suite (au bureau, sans encadré, chacun sous un trait fin, alors que chaque
résultat garde sa carte : voir [Panneaux et sections](README.md#panneaux-et-sections)) :
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
file : rien ne change. Le nombre de pages ne lit pas ce compte, mais celui
des confirmées ; l'en-tête des résultats écrit les deux (ci-dessous). **Sous « Aucune combinaison ne répond à ces critères »**
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
confirmée(s) sur YY trouvée(s) pour l'instant — recherche en cours… »,
puis « XX combinaison(s) confirmée(s) sur YY trouvée(s) » tant qu'il en
reste à vérifier, et « XX combinaison(s) confirmée(s) » une fois tout
vérifié (les deux nombres sont alors égaux) : XX, seulement
les builds de cette recherche vérifiés conformes, lus dans l'instantané de
la file — **une combinaison confirmée a au moins un équipement
(paire d'artéfacts, relique) qui tient toutes les conditions** : soit
notée (son meilleur équipement résolu, ce que montre une carte), soit
confirmée en fond sans note (la file s'arrête au premier équipement qui
tient, sans en chercher le meilleur, une fois les builds à noter servis :
../../../03-developpeur/optimizer/moteur/pipeline.md § File de résolution) ;
en fin de fond, chaque trouvée est jugée, et XX est le vrai total des
valides ; YY, le compte des trouvées de la ligne de
progression (`compteAffichable`, ci-dessus), qui peut baisser à mesure que
la vérification écarte des builds. Sans file, l'en-tête ne dit que « XX
combinaison(s) confirmée(s) » : les deux nombres sont égaux. Le
compte **ne baisse jamais pendant une recherche** : le cache ne fait que
grandir, l'aperçu des reçus aussi ; ni le tri ni la page ne vident le
cache, dont la signature est photographiée au lancement. Une petite infobulle
(« Combinaisons confirmées », à droite de l'en-tête, quand une file
vérifie) dit la différence avec les trouvées :
une combinaison confirmée tient vraiment toutes les conditions avec les
pièces de l'inventaire ; « trouvée(s) » est une estimation optimiste,
retenue stat par stat, dont une partie est écartée à la vérification ;
les combinaisons affichées sont vérifiées en premier, avec leur meilleur
équipement, et toutes les autres sont ensuite confirmées en fond.
**« Aucune combinaison ne répond à ces critères »** ne s'affiche qu'une
fois la recherche finie et tout vérifié sans aucune confirmée — la file
va jusqu'au dernier build trouvé faute de K confirmées (voir
../../../03-developpeur/optimizer/moteur/artefacts.md § Quand ce choix a lieu) ; alors seulement « Trier par » se masque,
comme sur un moteur vide. Jamais après un arrêt sur la mémoire : le
classement n'a pas gardé tout le trouvé, l'avis « Arrêt : mémoire » le dit,
et l'en-tête compte les trouvées du moteur, les mêmes que cet avis.
**Les pages suivent les confirmées** : les pages des confirmées, plus
une tant qu'il reste des builds non vérifiés qui n'ont pas de place sur
la dernière — ses places « Vérification… » se résolvent quand on
l'ouvre (ci-dessous) —, soit `min(⌈(confirmées + non vérifiés) / 20⌉,
⌈confirmées / 20⌉ + 1)`, au moins 1 : jamais une page vide. Par exemple,
5 100 trouvées et 300 confirmées donnent 16 pages, et non 255. Si le nombre de pages diminue (la page au-delà des
confirmées perd ses derniers non vérifiés, ou la vérification
recommence), la page courante revient sur la dernière. **Le « + » dit
seulement que d'autres pages peuvent encore apparaître** : « / 16+ »
quand le plafond « une page au-delà des confirmées » coupe des non
vérifiés (`⌈(confirmées + non vérifiés) / 20⌉` dépasse les pages
écrites, par exemple 300 confirmées et 1 000 non vérifiées, la
vérification s'étant arrêtée à K confirmées), ou quand le moteur a trouvé
plus de combinaisons qu'il n'en a été reçu, pendant la recherche seulement
(`aRecevoir` : après un arrêt sur la mémoire, le reste trouvé ne sera
jamais reçu) ; sinon le nombre exact, même
s'il reste des non vérifiés qui ne peuvent que le faire baisser (45
confirmées et 10 non vérifiées : « / 3 », 3 est déjà le maximum). La
confirmation en fond juge ensuite toutes les trouvées : en fin de fond,
plus aucun non vérifié, le nombre de pages est exact et le « + » tombe ;
une page au-delà des builds notés montre ses places « Vérification… » et
fait noter ses builds à la demande, comme avant. Sous « Vérifier toutes
les combinaisons trouvées », tout est noté, sans confirmation. Le
« + » garde sa place, invisible, quand il disparaît : la vérification
déclenchée par « Page suivante » ne déplace pas la flèche cliquée. Une
seule fonction pure, `compteConfirme` (artifactQueue.ts), donne le compte,
les non vérifiés, les pages, si elles peuvent encore monter
(`pagesPeuventMonter`) et
l'état « Aucune combinaison… » ; l'écran l'appelle
sur les comptes de l'instantané du classeur (`compteConfirmeDesComptes`),
sans jamais recevoir la liste des reçus, et n'écrit que ce que
`pagesDesResultats` en retient. Sans optimisation d'artéfacts, pas de file :
l'équipement est celui de la fiche, déjà jugé exactement par le moteur —
les confirmées sont les trouvées, les pages celles des reçus, toujours
exactes (jamais « + »), et l'infobulle ne s'affiche pas.
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
../../../03-developpeur/optimizer/moteur/artefacts.md § Quand ce choix a lieu). Une page au-delà des vérifiés (au-delà des K
confirmées, après la recherche) montre ses places et se résout quand on
l'ouvre — au prix de
tous les builds non résolus classés avant elle, puisque le rang d'un
vérifié dépend de tous ceux du dessus. ⚠️ **Seule une page demandée en
naviguant passe devant le fond** (précédente, suivante, numéro saisi) : la
page qui revient à 1 parce que le tri ou la mesure a changé n'en demande
aucune (la mesure, réglage global, remet la page à 1 comme le tri, même
changée depuis une autre page). Aucune place « Vérification… » ne reste
sans travail : la page 1 est toujours sous les K confirmées que le fond
vise, une page plus loin n'est atteinte qu'en naviguant, et une page
interrompue n'en montre plus aucune (ci-dessous). Elle montre les confirmées dans le nouvel ordre, puis ses places en
attente, que le fond (qui vérifie toujours dans l'ordre de l'objectif de la
recherche) ou une navigation remplissent. Ni l'ordre du fond, ni K, ni la
résolution ne changent. Le classeur compose la page (cartes, places, builds
à vérifier) selon la règle de `compositionDePage` (artifactQueue.ts), sa
référence de test, et n'envoie à l'écran que ses vingt cartes au plus.
Les comptes gardent leur règle (ci-dessus) ; une ligne dit
combien la file doit encore vérifier (« N combinaison(s) en
vérification… » : le reste de la file, places en attente puis avance de
fond), sa place réservée tant que la file tourne : sous l'en-tête au
téléphone, sous le compte des confirmées au bureau. Sans optimisation
d'artéfacts, pas de file : la page est la tranche du classement.
⚠️ **Au bureau, l'en-tête des résultats tient sur une rangée**
(`EnteteResultats`, `bureau`, décision de l'utilisateur : la première
carte remonte) : à gauche le compte des confirmées et, sous lui, la ligne
« en vérification », l'aide à leur droite ; à droite le tri ; 4 px avant
la première carte. Quand la colonne est étroite, la rangée
passe à la ligne d'elle-même (le tri sous le compte),
sans déborder à la largeur minimale de la colonne : le passage ne dépend
que de la largeur. Mesuré (compte d'exemple, 20 résultats), la première
carte remonte de 26 px à 1920 × 940 et 2560 × 1300, de 34 px à la largeur
minimale de la colonne.

⚠️ **Page interrompue.** Si le Worker de classement est perdu, le message
d'échec de recherche s'affiche et la dernière page reçue reste à l'écran :
ses cartes telles quelles, sans les places « Vérification… » qu'elle
attendait encore, que plus rien ne remplira — une page non pleine ne montre
que ses cartes. La ligne « en vérification » laisse sa place réservée à
l'avis « Classement interrompu : relance la recherche pour agir sur ces
résultats. », et le tri, la pagination, « Comparer » et « Valider ce
build » sont désactivés, au bureau comme au téléphone. Le détail d'une
rune ou d'un artéfact reste consultable. Rien n'est relancé : « Rechercher »
efface cette page, comme toute nouvelle recherche, et lance la suivante.

## Tri des résultats

Le tri se choisit **par les têtes de colonne** au bureau (bande de onze
têtes au-dessus des cartes, en-têtes du tableau ; § Cartes ou tableau), et
par un sélecteur **« Trier par »** suivi du bouton de sens au téléphone. Il
re-trie **côté
client, dans le Worker de classement**, sans relancer la recherche : le moteur a déjà
calculé les stats complètes de chaque combinaison retenue. Le tri porte
sur une des **onze colonnes des résultats** (`COLONNES_RESULTATS`,
colonnesResultats.ts), en deux groupes d'options — les 8 stats brutes, et
les objectifs Efficience, Dégâts réels et PV effectifs (voir
objectif-de-recherche.md § Les quatre objectifs disponibles ; « Dégâts
réels » n'y figure que si un sort est réellement calculable pour ce
monstre).
⚠️ **L'objectif Vitesse n'est pas un tri** : sa note est la VIT de la
fiche, celle de la colonne VIT, candidat par candidat (l'effet unique d'une
relique ne porte que sur PV, ATQ et DEF). Une recherche lancée sur Vitesse
se trie donc par VIT, et un tri `vitesse` enregistré (mémoire de membre,
session) se relit VIT ; une seule fonction fait cette lecture
(`triDesResultats`), appelée par l'écran au lancement, le CLI, le harnais,
le lecteur de mémoires et celui de session. L'objectif de recherche
Vitesse, lui, reste.
**Le tri a un sens**, décroissant par défaut, croissant sur demande : la
vue envoyée au classeur le porte (`sens`). En croissant, seule la note
s'inverse ; à note égale, les builds gardent l'ordre du décroissant
(relique, clé, ordre de base). Changer de sens est un changement de tri :
la page revient à 1 sans demander de page, rien n'est résolu et le cache
reste. Un clic sur une tête trie sa colonne en décroissant, un second clic
sur la même passe en croissant, et retour ; une autre tête repart en
décroissant (au téléphone : une autre colonne de « Trier par » repart en
décroissant, `BoutonSensTri` bascule le sens). La valeur triée est mise en
avant sur chaque carte : la ligne de la fiche de stats pour les huit stats
(`StatPanel`, `ligneMiseEnAvant`), la valeur moyenne en accent pour
Efficience ; PV effectifs et Dégâts ont leur rangée.

⚠️ **Le tri ne résout aucun équipement.** Les artéfacts et la relique de
chaque build sont ceux qui servent l'**objectif de la recherche** : changer
de tri ne les change pas, ne vide pas le cache et ne remet aucun build en
vérification ; « Valider les artéfacts » propose donc la même chose quel
que soit le tri. Pour un équipement choisi sur un autre critère, on relance
la recherche avec cet objectif. Le tri ne fait que réordonner les
combinaisons confirmées ; la vérification de fond continue dans l'ordre de
l'objectif de la recherche (§ Compte des combinaisons confirmées et
pagination). Ne pas réoptimiser l'équipement pour le tri affiché (c'était
l'interrupteur « Adapter les artéfacts et reliques au tri », retiré) : un
changement de vue deviendrait une nouvelle vérification. Une mémoire de
membre ou une session qui porte encore ce réglage est relue sans lui, sans
avertissement. Pourquoi le tri et les filtres d'affichage ne résolvent rien :
[ADR](../../../04-decisions/adr/classement-dans-un-worker-dedie.md).

## Filtres d'affichage par colonne

Les résultats se filtrent **après coup**, colonne par colonne : une borne
minimum et une borne maximum sur chacune des onze colonnes (PV, ATQ, DEF,
VIT, Taux Crit, Dmg Crit, RES, Précision, Efficience, Dégâts réels, PV
effectifs). Ce sont des filtres d'affichage, séparés des conditions de
recherche : ils ne deviennent jamais une condition, ne relancent rien et ne
résolvent aucun équipement. La vue envoyée au classeur les porte
(`VueClassement.bornes`, filtresResultats.ts) ; le classeur filtre **avant
de paginer**. Les bornes et le sens du tri sont des critères personnels de
l'écran (`bornesResultats`, `sensTri`, useOptimizerState.ts), comme le
tri : **mémorisés par membre** (rétablis au retour sur lui), effacés au
changement de monstre — y compris par l'import d'une recette d'une autre
espèce, qui passe par le même `resetSearch` (même espèce : gardés) —,
conservés par une nouvelle recherche, qui remet
seulement le sens en décroissant avec le tri de son objectif ; dans la
session, jamais dans la recette ni le CLI (réglages d'affichage, comme le
tri ; ../feat-listes-equipes-et-sauvegarde.md § Mémoires des membres).

- **Règle.** Bornes inclusives, combinées par ET ; une borne vide
  (`null`) = sans borne. Un minimum plus grand que le maximum sur une même
  colonne donne une **vue vide signalée** (`bornes-contradictoires`), sans
  correction silencieuse. Une borne sur une colonne indisponible — « Dégâts
  réels » sans sort calculable — est **inactive** : elle reste dans la vue,
  listée à part, et ne masque rien.
- **La valeur comparée est celle de la carte, arrondie comme la carte
  l'écrit**, par la même fonction (valeursAffichees.ts) : une carte qui
  affiche « 78.8% » passe une borne ≥ 78.8. Les huit stats : le total de la
  fiche avec la vraie paire et la relique retenue (`row.total`, un entier,
  que la carte écrit tel quel ; sans les points de combat, comme les
  conditions). Efficience : la moyenne par rune de la carte, une décimale en
  Efficience ou un entier en Score SW, suivant la mesure de la vue. Dégâts
  réels et PV effectifs : le chiffre de la carte (`scoreDuCandidat` du
  classement), arrondi à l'entier. ⚠️ Quand « afficher au-delà du plafond »
  est coupé, le panneau de stats écrit Taux Crit, RES et Précision au plus
  à 100 (`displayedTotal`, valeursAffichees.ts) : la borne compare cette
  valeur, par la même fonction, la vue portant le réglage
  (`afficherDepassement`, absent = affiché, le défaut de l'application) ;
  une carte qui écrit « 100 % » passe une borne ≤ 100. Le réglage affiché,
  la borne compare le total. Les conditions de recherche, elles, jugent
  toujours le total brut. Changer ce réglage ne reclasse la vue que sous une
  borne de l'une de ces trois colonnes.
- **La borne d'Efficience garde sa mesure.** La colonne change d'échelle
  avec la mesure (moyenne d'efficience en %, ou Score SW entier), et les deux
  n'ont pas de rapport fixe : l'Efficience compte la principale et double
  les maximums des plates, le Score SW ne lit que les sous-stats et pondère
  les plates à 0,35 (effects.ts). Aucune conversion, donc : la borne retient
  la mesure sous laquelle elle a été posée (`BorneColonne.mesure`, écrite
  par `avecBorne`, filtresResultats.ts). Sous l'autre mesure, réglage global
  changé depuis n'importe quelle page, elle est **mise de côté** : elle
  n'entre pas dans la vue envoyée au classeur et la colonne ne la montre
  pas (`bornesSousMesure`, colonnesResultats.ts, appelé par
  OptimizerSection.tsx) ; au retour à sa mesure, elle revient telle quelle.
  Cela vaut pour le membre affiché comme pour la mémoire de chaque membre,
  qui porte la mesure avec la borne (session comprise). Sous l'autre mesure,
  une saisie vide dans la colonne laisse la borne mise de côté ; un nombre
  saisi pose une borne neuve sous la mesure courante, qui la remplace (une
  borne par colonne) ; « Effacer » ne retire que les bornes montrées
  (`bornesMisesDeCote`). ⚠️ **Compatibilité** : une borne d'Efficience
  enregistrée avant que la borne retienne sa mesure (mémoire, session) est
  réputée posée sous la mesure courante à son chargement ; au premier
  changement de mesure, elle prend celle qui s'achève (`bornesAvecMesure` :
  au rendu pour les bornes affichées, useOptimizerState.ts ; par un effet
  pour toutes les mémoires, `fixerMesureDesBornes`, useOptimizerLists.ts).
- **Un build non vérifié n'est jamais jugé sur ses stats provisoires** :
  sa paire et sa relique peuvent encore changer PV, ATQ, DEF et les deux
  objectifs. Il reste « potentiel » (il garde sa place dans la pagination et
  peut être vérifié), sauf échec démontré sur une colonne que la résolution
  ne change pas : VIT, Taux Crit, Dmg Crit, RES, Précision et Efficience
  (`COLONNES_IMMUABLES` : une principale d'artéfact ou de relique ne porte
  que PV, ATQ ou DEF). Sans optimisation d'artéfacts, pas de file : les
  valeurs de chaque build reçu sont définitives et jugées toutes.
- **Une valeur `NaN` sous une borne active** rend le build **indéterminé**
  — ni affiché, ni masqué, compté à part ; sans borne sur cette colonne, il
  s'affiche comme avant. Les infinis se comparent normalement.
- **Comptes** (instantané, `filtre.comptes`) : trouvés par le moteur, reçus,
  écartés à la résolution, confirmés et non vérifiés (globaux, que les
  filtres ne changent pas ; sans file, tout reçu compte comme confirmé),
  puis, pour la vue, confirmés visibles, confirmés masqués, potentiels non
  vérifiés, non vérifiés masqués (échec démontré) et indéterminés. Les
  pages suivent la règle des confirmées (§ Compte des combinaisons
  confirmées et pagination) sur la vue filtrée : confirmées visibles et
  potentiels (`filtre.pages`). Une **absence définitive sous filtre**
  (`aucune-sous-filtre`) n'est dite que recherche finie, sans potentiel ni
  indéterminé, avec au moins un build masqué : ce n'est pas « Aucune
  combinaison… », qui reste le constat sur la recherche entière.
- **Un filtre ne perd rien.** Poser, changer ou relâcher une borne ne
  renote pas, ne vide pas le cache et ne retire aucun équipement : relâcher
  rend exactement les mêmes builds, dans le même ordre, avec le même
  équipement ; une borne plus large que la recherche n'ajoute rien. Comme un
  changement de tri, il ne donne pas la priorité à la page affichée : seule
  une page demandée en naviguant la reprend, et le fond continue dans
  l'ordre de l'objectif lancé.

### À l'écran : « Filtrer l'affichage »

Une grille calquée sur « Conditions » (libellé, Min, Max, `NumberField`,
`FiltresResultats.tsx`), sous la phrase fixe « Masque des builds déjà
trouvés ; ne relance pas la recherche. » : la grille ressemble trait pour
trait aux conditions de recherche, elle vit donc dans l'en-tête des
résultats, jamais dans « Critères de recherche ». **Un seul JSX, deux
contenants** : un `Flottant` ancré au bouton « Filtrer l'affichage (n) »
au bureau (fermé au clic dehors et à Échap), un `MobileSheet` au
téléphone. `n` compte les colonnes bornées. « Effacer les filtres » vide
toutes les bornes (dans l'en-tête au bureau, au pied de la grille aux deux
formats). Les libellés et unités viennent de `filtresAffichage.ts` ;
« Efficience » devient « Score SW » avec le réglage.

- **Ligne de comptes, toujours présente** sous l'en-tête dès qu'il y a des
  résultats : « Aucun filtre » sans borne, sinon « Filtres : 12 visibles ·
  30 masquées · 8 à vérifier · 2 indéterminées » (comptes de la vue
  publiés par le classeur ; les deux derniers seulement s'ils ne sont pas
  nuls), suivie au bureau du **résumé des bornes** (« VIT ≥ 220 · 30% ≤
  Taux Crit ≤ 100% », tronqué sur une ligne, entier au survol), sur sa
  propre ligne au téléphone. Toujours là : poser une borne n'ajoute aucune
  ligne au-dessus des cartes.
- **Minimum > maximum** : les deux champs de la colonne en `ton="bad"`, et à
  la place des cartes (ou des lignes du tableau) « Vue vide : le minimum de
  VIT (220) dépasse son maximum (200). » Rien n'est corrigé.
- **Plus rien sous les filtres** (`aucune-sous-filtre`) : « Aucune
  combinaison confirmée ne passe ces filtres. », distinct de « Aucune
  combinaison… », qui reste le constat sur la recherche entière.
- **Dégâts réels sans sort calculable** : tête grisée (« Aucun sort
  calculable pour ce monstre » au survol), champs désactivés qui gardent
  leur valeur, borne dite « (inactive) » dans le résumé, colonne grisée
  sans valeur dans le tableau.
- **Pages** : sous une borne active, le nombre de pages est celui de la vue
  filtrée (`filtre.pages`) ; sans borne, celui de la recherche. « / N+ »
  sous la même règle, appliquée à la vue : ses confirmées sont les
  visibles (`filtre.comptes.visiblesConfirmes`), ses non vérifiés les
  potentiels (`potentielsNonVerifies`) — un non vérifié déjà masqué
  (échec démontré) ne compte pas — ; ou une trouvée qui arrivera encore
  (`aRecevoir`, la règle de la recherche).
- **Décimales** : une borne d'Efficience admet une décimale (« 78.8 »,
  point ou virgule), comme la carte l'écrit (`NumberField decimales`,
  `decimalesColonne`) ; Score SW et les autres colonnes, des entiers.
- **Page interrompue** : têtes, choix de forme, « Filtrer » et « Effacer »
  désactivés, comme « Comparer » et « Valider » ; le « + » des pages
  s'éteint à sa place (plus aucune page ne viendra).

### Cartes ou tableau

Au bureau, un `Segmented` « Cartes / Tableau » au-dessus des résultats
(décision de l'utilisateur, les deux formes au choix), mémorisé comme un
réglage : `useFormeResultats`, clé `swblacksmith-optimizer-resultats-forme-v1`,
écrite même sans l'accord de conservation (persistance.md, « Un seul
interrupteur »), dans la session. **Le téléphone garde les cartes**, sans
ce choix.

⚠️ **Choisir la forme ne déplace rien** (un clic ne déplace jamais ce qu'on
vient de cliquer) : à droite de « Cartes / Tableau », une place partagée, de
la largeur du plus large de ses deux occupants, porte « Filtrer
l'affichage » (cartes, et tableau sous le seuil) ou « Stats totales / Stats
bonus » (tableau affiché) ; les deux y sont toujours, superposés, l'absent
invisible (`VISIBLE_AVEC_LE_TABLEAU`, `INVISIBLE_AVEC_LE_TABLEAU`,
TableauResultats.tsx). Vérifié au navigateur dans les deux sens, tableau
affiché (`testRenduFiltresResultatsCartes`).

- **Cartes** : au bureau, la bande des onze têtes de tri (`TetesDeTri.tsx`)
  au-dessus de la grille. Chaque tête réserve la place de son icône de sens
  (`ArrowUpDown` estompée tant qu'elle ne trie pas) et du point « borne
  posée » : rien ne change de largeur au clic. Icône de sens de 16 px :
  flèche nette sur la colonne triée, ⇅ estompé ailleurs. Des `Bouton`, pas des
  `Pastille` : elles trient, elles ne filtrent pas. L'état à trois valeurs
  passe par `actif` et le nom accessible (« VIT, tri décroissant, borne
  posée ») : `aria-sort` n'est valide que sur un en-tête de colonne.
- **Tableau** (`TableauResultats.tsx`) : une ligne par build, rang puis les
  onze colonnes ; en-têtes triables : le même `Bouton` sm que la bande, sur
  toute la largeur de sa colonne, le libellé (sur deux lignes si besoin) au-
  dessus de l'icône de sens (`aria-sort` sur le `<th>`) ; la colonne triée a
  son bouton en accent plein et ses cellules teintées sur toute sa hauteur
  (`bg-accent-soft`). Deux lignes de bornes Min / Max dessous (`NumberField
  sansBoutons`, toute la largeur de la colonne). ⚠️ **Une colonne, un seul
  bord** : bouton, deux champs et valeurs prennent toute la largeur de leur
  cellule, au même rembourrage, et se centrent (bords vérifiés au navigateur,
  au seuil et à pleine largeur : `testRenduOptimizerTableauAlignement`). Un clic sur une ligne, ou sur
  son rang au clavier, ouvre la carte telle quelle dans une `Modale`
  (« Build n° 3 », croix) : « Comparer » et « Valider » y sont. Les places
  « Vérification… » sont des lignes. La vue demande alors les onze valeurs
  de chaque build (`colonnesCompletes`), dès celle du lancement (`run`).
- ⚠️ **Largeurs selon le contenu** : la mise en page automatique du
  `<table>` ; un en-tête de deux mots passe sur deux lignes ; chaque borne a
  la largeur de la plus grande valeur de sa colonne (`CHIFFRES_MAX_COLONNE`,
  en `ch` de la police du champ : PV à 5 chiffres, PV effectifs et dégâts à
  6, Efficience à « 118.6 »). **Largeur minimale mesurée : 661 px** dans
  l'app construite, polices chargées, chaque valeur remplacée par la plus
  large de sa colonne et les bornes « 150000 » posées ; c'est le seuil
  (`SEUIL_TABLEAU_PX`), lu par une requête de conteneur sur la zone des
  résultats (`@container/resultats`) : en dessous, les cartes, avec la ligne
  « Trop étroit pour le tableau : cartes affichées ». Zones relevées : 716 px à 1920 avec une
  colonne insérée, 1 052 colonnes fermées, 1 356 à 2560 en pleine page
  (tableau) ; 516 à 2560 scindé et 358 au téléphone (cartes). Vérifié sans rognage au seuil
  (tests/rendu/optimizer-tableau-navigateur.test.ts).
- **« Stats totales / Stats bonus »** (deux choix exclusifs dans l'en-tête,
  un `Segmented` de la forme de « Cartes / Tableau », à sa droite, à la place
  de « Filtrer l'affichage » ; forme
  tableau seulement, visible avec le tableau) : un réglage d'**affichage**,
  distinct de « Stats de base exclues » des conditions, qui reste un réglage
  de recherche. Il part de la valeur de celui-ci **photographiée au
  lancement** (exclues : « Stats bonus »), puis ne change que par
  l'utilisateur. En Stats bonus, PV, ATQ, DEF et VIT montrent total − base du
  monstre (la base du contexte de la recherche) ; Taux Crit, Dmg Crit, RES et
  Précision restent en total, PV effectifs, Dégâts réels et Efficience ne
  changent pas. **Les bornes se convertissent** : le classeur les garde en
  total, le tableau les écrit et les saisit dans le mode courant
  (`versAffichage`, `depuisAffichage`, filtresAffichage.ts) ; à 900 d'ATQ de
  base, un minimum de 3500 s'écrit 2600 en Stats bonus, et basculer ne masque ni ne
  révèle aucun build. Une borne en total sous la base s'écrit négative en
  Stats bonus : le plancher du champ est un total de 0 (−base), rien ne la
  réécrit à la sortie du champ. Le tri ne change pas. Les cartes gardent leur bascule
  propre (clic sur la fiche).

## Valeur d'objectif affichée sur les cartes

⚠️ **Objectif « Dégâts réels »** : chaque carte affiche en tête le
**nombre de dégâts** qui a servi à la classer, et la part des PV de la
cible qu'il emporte (« tue la cible » à partir de 100 %). Visible dès que
ce critère ordonne la liste — que ce soit l'objectif de la recherche ou
un tri choisi après coup —, et dès qu'une borne active le juge (§ Filtres
d'affichage par colonne) : une carte gardée par « Dégâts réels ≥ 50 000 »
écrit la valeur bornée. Une seule règle pour le classeur, qui calcule, et
l'écran, qui montre (`objectifsMontres`, filtresResultats.ts) ; le tableau
demande les onze valeurs de chaque carte (`colonnesCompletes` de la vue).
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
../feat-listes-et-reservation.md § Comparer, valider sans recherche et persistance.
⚠️ **Aucun écart « grâce aux artéfacts » sur une carte.** Ne pas en
afficher un qui compare la paire retenue à la paire supposée par la
recherche : cette référence est un détail interne que rien ne nomme, et le
chiffre, même exact, resterait illisible. Une comparaison n'a de sens que si
sa référence se nomme ; celle qui se nomme, contre les artéfacts que le
monstre porte, vit dans « Meilleurs artéfacts offensifs pour ce build »
(voir meilleurs-artefacts-offensifs.md § Deux crans : dégâts supplémentaires ou dégâts réels). La carte, elle, se suffit : ses
statistiques et son chiffre comptent déjà la paire retenue, affichée à côté.
⚠️ **L'effet unique compte dans les trois modes de relique** — la
relique est celle que la carte affiche
(`etatReliqueDuBuild`, une seule expression pour la case et le score) :
interrupteur coupé ou « Comme équipée », **la relique de la
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
résolution complète coûte environ 20 fois la recherche.
⚠️ Comme celui de l'écran, ce classement n'est pas exhaustif : en mode
`recherche`, l'ordre de base ignore la relique, et un build au-delà de
la K-ième confirmée peut remonter très haut une fois résolu sans que la
file le résolve. Sur la fixture de `testCliClassementParMode`
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
../../../03-developpeur/optimizer/moteur/elagages.md § Recherche des runes — meet-in-the-middle et élagages). Les tris « Dégâts réels » et « PV
effectifs » gardent l'effet unique, comme ci-dessus.

## Validation d'un build et relique

⚠️ **« Valider ce build »**, sur chaque carte — réserve les 6 runes de CE
résultat (elles n'apparaissent plus dans les recherches suivantes de la
même liste de travail), jusqu'à libération explicite : voir
../feat-listes-et-reservation.md § Listes de travail et réservation de runes.

⚠️ **Relique, un emplacement, quatre états** — un emplacement « Relique »,
sous la roue à la souris, à sa droite au doigt (voir plus haut), même
modèle que celui de la fiche d'équipement
(`MonsterGear.tsx`) : composant partagé `RelicSlot`, jamais une copie.
Hors mode `recherche` (interrupteur coupé, « Comme équipée »), la relique
portée ; sans relique, la case grisée « Relique »
barrée d'une icône, infobulle « Aucune relique équipée ». En mode `recherche`,
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

