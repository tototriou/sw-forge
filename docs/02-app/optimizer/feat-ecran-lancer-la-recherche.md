# Lancer la recherche

**Statut :** ÉTAT ACTUEL — décrit la barre d'actions et l'estimation qui précèdent le lancement
**Lire si :** on modifie l'estimation du pool, le bouton de recherche ou l'import et l'export

10. **Estimation du pool retenu** — dès qu'un monstre et un set sont choisis,
    une ligne affiche le nombre **exact** de runes gardées après
    pré-filtrage, détaillé par emplacement (une **somme**, pas un produit),
    recalculée en direct à chaque changement de critère. ⚠️ **Le pool, pas
    l'espace de recherche** : le nombre de combinaisons brutes (produit des
    tailles de pool par emplacement) est un ordre de grandeur bien trop
    éloigné du nombre réel de demi-builds construits ou de paires visitées
    par le meet-in-the-middle pour servir de repère — seul le pool retenu,
    lui, est un nombre exact et directement lisible.
11. **« Rechercher »** — lance le calcul. Changer un des critères de
    recherche ne relance rien automatiquement : il faut recliquer. Un bouton
    **« Arrêter »** apparaît pendant le calcul — il interrompt la recherche
    et garde le **meilleur trouvé jusque-là**, plutôt que de tout perdre
    (voir feat-interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel).
    ⚠️ **« Exporter les paramètres de recherche » / « Importer
    les paramètres de recherche »** (« Exporter » / « Importer » quand la
    place manque), juste à côté : télécharge/relit un fichier `.json`
    contenant la RECETTE de cette recherche (set, minimums, objectif,
    préréglage, exclusion des runes déjà utilisées, choix d'artéfacts) —
    **jamais le pool de runes ni le compte**, ce qui la rend partageable
    entre joueurs. Le combat exporté est le **combat effectif de l’écran** :
    pour un membre lié, le lead actif de son équipe (ou aucun lead s’il est
    inactif), afin de reproduire les valeurs de sa recherche dans l’écran
    ou un script. Exporter garde le lead personnel et la mémoire du membre
    intacts. Le réimport applique ce lead comme une valeur de recette,
    sans équipe ni propriétaire des critères et sans écraser les mémoires
    ou équipes existantes. Voir feat-listes-equipes-et-sauvegarde.md
    § Lead effectif d’un membre.
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
    Le message d'import qui porte un tel avertissement prend le token
    d'avertissement (`warn`, jamais `good`) et **ne s'efface pas tout
    seul** : il reste jusqu'au prochain import de recette, réussi ou
    refusé, qui le remplace. Le
    message ordinaire (succès sans avertissement) s'efface après 5 s, le
    refus après 9 s (`messageImport.ts`). Le message vit dans le flux, sous
    la barre Rechercher / Exporter / Importer : le bouton cliqué, au-dessus,
    ne bouge pas.
12. **Barre de progression** — se remplit progressivement (pas une roue qui
    tourne), avec le nombre de combinaisons déjà examinées et déjà trouvées,
    suivi d'un message **en gras, couleur dorée** (même que le rang `#X`
    d'un résultat) : « Attendez la fin de la recherche pour être sûr de
    trouver votre build optimal ».
