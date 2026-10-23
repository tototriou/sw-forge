# Lancer la recherche

Ce document décrit la barre d'actions, l'estimation qui précède le lancement
et la progression. Au bureau, tout vit dans le bloc « Objectif et
Rechercher », dont la forme, la place réservée et les hauteurs sont dans
[README.md](README.md#bloc--objectif-et-rechercher-) ; au téléphone, sous la
grille des réglages, la carte du bouton Rechercher, puis le message d'import
et la progression.

10. **Estimation du pool retenu** — dès qu'un monstre et un set sont choisis,
    une ligne affiche le nombre de runes retenues par le pré-filtrage
    **de l'estimation**, détaillé par emplacement (une **somme**, pas un produit),
    recalculée en direct à chaque changement de critère : « N runes gardées
    après pré-filtrage (pool par emplacement : a + b + … ) ». Au bureau, en
    tête du bloc, sans place réservée : elle paraît au choix du
    set, qui se fait plus haut ou dans un flottant, et ne pousse que ce qui
    la suit. Au téléphone, la dernière
    rangée de la grille des réglages. ⚠️ **Le pool, pas
    l'espace de recherche** : le nombre de combinaisons brutes (produit des
    tailles de pool par emplacement) est un ordre de grandeur bien trop
    éloigné du nombre réel de demi-builds construits ou de paires visitées
    par le meet-in-the-middle pour servir de repère. L'estimation appelle
    le même pré-filtrage que la recherche (`estimateSearchSpace`), mais
    sans les élagages sûrs de dominance et de faisabilité : elle compte
    exactement ce pré-filtrage, pas le pool réellement exploré par la
    recherche. Le total est abrégé à l'affichage (`formatBig`) ; les
    comptes par emplacement restent entiers.
11. **« Rechercher »** — lance le calcul. Changer un des critères de
    recherche ne relance rien automatiquement : il faut recliquer. Un bouton
    **« Arrêter »** paraît pendant le calcul — il interrompt la recherche
    et garde le **meilleur trouvé jusque-là**, plutôt que de tout perdre
    (voir ../feat-interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel).
    Au bureau, « Arrêter » prend la place exacte de « Rechercher », dans la
    même case, et reste inactif 300 ms après le lancement : le double clic
    qui a lancé la recherche ne l'arrête pas ; « Rechercher » y est en
    braise pleine dès qu'un set est choisi ; dans la forme large du bloc, il
    est à droite d'« Exporter » · « Importer », ou dessous, pleine largeur,
    quand leur rangée fait moins de 448 px (voir README.md § Bloc
    « Objectif et Rechercher »). Au téléphone, « Rechercher »
    devient « Recherche… », inactif, et « Arrêter » s'ajoute au bout de la
    rangée. Sans set choisi, « Rechercher » reste cliquable sous son aspect
    grisé : le clic ramène au « Set de runes recherché » (voir
    set-et-principale.md § Set de runes recherché et statistique principale imposée).
    ⚠️ **« Exporter les paramètres de recherche » / « Importer
    les paramètres de recherche »** (« Exporter » / « Importer » quand la
    place manque), juste à côté : télécharge/relit un fichier `.json`
    contenant la RECETTE de cette recherche (set, minimums, objectif,
    préréglage, exclusion des runes déjà utilisées, choix d'artéfacts) —
    **jamais le pool de runes ni le compte**, ce qui la rend partageable
    entre joueurs. Le combat exporté porte le **lead personnel** du
    monstre ; pour un membre lié, c’est le lead de son équipe tel qu’il
    agit sur lui, puisque ce lead écrase le lead personnel.
    Les compétences d’invocateur exportées sont celles effectives de la
    liste active : « Contenu de guilde » en Guilde, « Contenu normal » sinon.
    Le CLI sans liste reproduit ce mode depuis la recette. À l’import dans
    l’écran, le contenu de la liste active décide du mode effectif, même si
    la recette en porte un autre ; sans liste ou contenu, « Contenu normal ».
    Exporter ne réécrit ni le lead personnel ni la mémoire du membre. Le
    réimport applique ce lead comme une valeur de recette, sans équipe ni
    propriétaire des critères et sans écraser les mémoires ou équipes
    existantes. Voir ../feat-listes-equipes-et-sauvegarde.md
    § Lead effectif d’un membre.
    Le champ retiré `adaptiveTrancheWeighting` est ignoré à la lecture par
    `parseOptimizerRecipe`, qu'il soit vrai ou faux, sans erreur ni
    avertissement ; les recettes exportées ne le portent plus.
    L'import remplit tous les réglages et sélectionne
    automatiquement le monstre par son `com2usId` — **résolu dans TOUT le
    bestiaire**, pas seulement parmi les monstres possédés : importer la recette
    de quelqu'un d'autre pour un monstre qu'on ne possède pas reste
    utilisable (repli sur ses stats de base). Si le
    `com2usId` ne correspond à AUCUN monstre des données chargées (cas
    limite, ex. monstre retiré du jeu), les réglages sont importés et le
    message dit « ce monstre est introuvable dans les données actuelles —
    choisis-en un manuellement ». Aucune confirmation à l'import :
    remplacer la saisie en cours n'est pas plus destructeur que la modifier
    à la main. Une recette qui porte l'ancien mode critique « Moyenne »
    (`damageSetup.critMode: "moyenne"`, supprimé) est **convertie en « Critique »**, jamais refusée : le
    parseur commun (`parseOptimizerRecipe`) rend un avertissement nommé
    (chemin du champ, ancienne et nouvelle valeur), que l'écran ajoute au
    message d'import et que le CLI imprime (`chargerRecette`) ; toute autre
    valeur inconnue reste refusée, et l'export n'écrit jamais « moyenne ».
    L'interrupteur « Attaque conjointe » voyage dans `damageSetup.attaqueConjointe` :
    un booléen (toute autre valeur est refusée avec son chemin), absent d'une
    recette antérieure = éteint. Le CLI (`optimizer-search.ts`) l'ajoute à la
    ligne « Dégâts réels » (« attaque conjointe (appelée par un allié) ») quand il
    agit, c'est-à-dire pour un S1 choisi qui n'est pas conjoint par lui-même.
    Le message d'import qui porte un tel avertissement prend le token
    d'avertissement (`warn`, jamais `good`) et **ne s'efface pas tout
    seul** : il reste jusqu'au prochain import de recette, réussi ou
    refusé, qui le remplace. Le
    message ordinaire (succès sans avertissement) s'efface après 5 s, le
    refus après 9 s (`messageImport.ts`). Le message vit dans le flux, sous
    la barre Rechercher / Exporter / Importer : le bouton cliqué, au-dessus,
    ne bouge pas. Au bureau, il s'affiche en bas du bloc, au-dessus de la
    progression.
12. **Barre de progression** — au téléphone, se remplit progressivement
    (pas une roue qui tourne), avec le nombre de combinaisons déjà examinées
    et déjà trouvées, suivi d'un message **en gras, couleur dorée** (même
    que le rang `#X` d'un résultat) : « Attendez la fin de la recherche pour
    être sûr de trouver votre build optimal. ». Au bureau, la progression
    est **compacte** : les deux mêmes lignes, sans barre, sous « Rechercher »
    (en A1, à sa droite, dans la barre fine collée au bas de la fenêtre),
    sans place réservée dans le bloc ordinaire : elle paraît sous le bouton
    qu'on vient de cliquer, jamais au-dessus. La barre fine de A1 réserve
    en revanche la hauteur de sa progression la plus haute pour que
    « Rechercher » ne monte pas sous le clic. Pendant la
    préparation, une ligne par moitié (« Préparation — moitié A : x / y
    runes »), avec sa barre au téléphone, sans barre au bureau.
