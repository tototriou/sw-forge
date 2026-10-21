# Artéfacts

Ce document décrit la carte « Artéfacts » de l'écran.

6. **Artéfacts** — carte « Artéfacts et relique », interrupteur
   **« Activer l'optimisation d'artéfacts et reliques »**,
   **ACTIVÉ par défaut**.

   ⚠️ **Désactivé ne veut PAS dire « sans artéfact ».** Le monstre garde les
   artéfacts et la relique qu'il porte réellement, statistiques comprises :
   on cesse simplement
   d'en chercher d'autres. Sert à composer un runage autour des pièces déjà
   en place. Retirer toute contribution d'artéfact rendrait les conditions
   minimales plus dures à franchir sans raison.

   Activé, deux listes déroulantes (Attribut, Type) proposent :
   **« Libre »** (**défaut** — cherche le meilleur artéfact parmi TOUS les
   artéfacts équipables), **« Comme équipé »**, **ATQ +100**,
   **DEF +100**, **PV +1500** (les trois statistiques principales
   d'artéfact du jeu).

   ⚠️ **Ces cinq choix ne dépendent pas des artéfacts portés** : les deux
   listes s'affichent dès que l'optimisation est active, toujours avec les
   mêmes choix. Elles disent ce qu'on cherche, une entrée du choix de la
   paire, pas une conséquence de l'équipement du monstre.

   ⚠️ **Le sélecteur FILTRE l'inventaire, il n'hypothèque pas.** Choisir
   « ATQ +100 » restreint la recherche aux artéfacts qu'on POSSÈDE portant
   cette principale, avec leurs sous-propriétés. Sans aucun, l'emplacement
   reste vide — on ne peut pas équiper ce qu'on n'a pas. Ne pas fabriquer de
   pièce fictive (« et si j'avais un artéfact PV+1500 ? ») : sans aucune
   sous-propriété, elle ferait calculer les « Dégâts réels » sans aucune
   ligne d'effet, quand « Comme équipé » les compte — deux
   réglages voisins, deux modèles de dégâts, sans que rien ne le signale.

   ⚠️ **Sans choix, la liste affiche « Libre »**, parce que le moteur traite
   une absence de choix comme « Libre » (`candidatsParSorte`,
   artifactOptim.ts). Afficher « Comme équipé » annoncerait le
   contraire de ce qui se passe, et
   tout ce qui se fie à cet affichage (les emplacements considérés comme
   figés, donc l'éditeur de sous-propriétés verrouillées) raisonnerait sur un
   état faux.

   ⚠️ **Il n'y a PAS de cran « Aucun »**.
   Imposer l'emplacement vide pour UNE sorte pendant que l'autre cherche ne
   correspond à rien en jeu : un monstre porte deux artéfacts, ou n'en porte
   pas. Ne pas les compter est une décision **globale**, et l'interrupteur la
   prend d'un seul geste pour les deux emplacements. L'emplacement peut
   toujours rester **vide** si la recherche n'a rien de mieux à y mettre —
   c'est l'imposer par sorte qui n'aurait pas de sens. Une recette qui porte
   encore « Aucun » le voit ramené sur **« Libre »** à l'import
   (`mainsPourCeCompte`, optimizerRecipe.ts).

   ⚠️ **« Comme équipé » conserve la PIÈCE ENTIÈRE**, ses quatre
   sous-propriétés comprises : le pool de cet emplacement tombe à **un seul
   candidat**, l'exemplaire réellement porté (ou rien, s'il n'est pas
   éligible pour ce monstre). Rien n'est cherché.

   ⚠️ **Ce choix ne se PARTAGE pas.** Importer une recette exportée par
   **quelqu'un d'autre** bascule automatiquement « Comme équipé »
   sur **« Libre »**, et le dit dans le message d'import. Raison : ce réglage
   garde l'artéfact porté par **celui qui lit**, pas par l'auteur — chez un
   autre joueur il ne transporte aucune intention, il impose une pièce
   arbitraire, parfois sans rapport avec la recherche décrite. Tout le reste
   d'une recette se re-résout contre le compte du lecteur (le monstre par son
   `com2usId`, les runes par la recherche elle-même) ; celui-ci serait le seul
   à transporter en douce une hypothèse locale. « Libre » est l'intention la
   plus proche : cherche le meilleur artéfact **parmi les tiens**.
   - La comparaison se fait sur le **nom du joueur** (`wizard_name`), écrit
     dans la recette à l'export.
   - ⚠️ **Provenance inconnue = on ne touche à rien** : une recette exportée
     avant ce champ, ou un compte local sans nom, ne permettent aucune
     comparaison. Agir sur une provenance devinée serait pire que de
     transporter la donnée telle quelle.
   - ⚠️ **Le script CLI (`optimizer-search.ts`) ne bascule PAS**, exprès :
     l'appelant y désigne le compte explicitement, presque toujours pour
     rejouer un cas signalé avec l'export de celui qui l'a signalé. Basculer
     rendrait la reproduction moins fidèle.

   ⚠️ **« Comme équipé »**, choisi par l'utilisateur (2026-10) à la place de
   « Garder l'artéfact équipé », trop long pour une liste étroite. Le risque
   reste nommé : posé au milieu de trois statistiques principales, « Comme
   équipé » peut se lire « la principale, comme équipé » — une liste se lit
   comme homogène. Les entrées qui filtrent par stat principale ont porté
   « Principale … » pour l'éviter ; l'utilisateur les a raccourcies
   (2026-10, « ATQ +100 ») pour qu'Attribut et Type tiennent dans une carte
   étroite. Reste l'aide de la carte, qui dit que ce choix garde la pièce
   entière.

## Place de la carte à l'écran

   ⚠️ **Carte à part**, jamais un bloc de « Critères de recherche ».
   L'interrupteur masque d'un coup les deux listes ET les lignes
   verrouillées : dans « Critères de recherche », ce clic ferait REMONTER
   « Conditions », soit un clic qui déplace ce qui le suit
   ([03-developpeur/interface/design/README.md](../../../03-developpeur/interface/design/README.md)).
   Isolée, la carte ne déplace que ce qui la suit.
   - **Au bureau**, première section du panneau de la colonne repliable
     « Artéfacts et relique », 294 px (`ArtefactsEtReliqueBureau`, autour du
     composant partagé dans sa forme `bureau`, sans cadre), suivie de la
     section « Meilleurs artéfacts offensifs pour ce build » (voir
     meilleurs-artefacts-offensifs.md § Affichage et emplacement de la proposition).
     Elle n'est pas repliée au lancement d'une recherche : seul l'onglet
     ferme sa colonne ([README.md](README.md#colonnes-repliables-selon-la-largeur)).
     ⚠️ **Attribut et Type sur une ligne**, chaque liste à la largeur de son
     contenu (décision de l'utilisateur, arrêt 4) : libellés, listes de
     107 px (« Comme équipé » entier), 4 px entre libellé et liste, 8 px
     entre les deux, 293 px pour 294 utiles. Le rembourrage droit de ces
     deux listes passe de 24 à 20 px (le chevron garde 2 px de marge) ; la
     rangée peut encore passer à la ligne si une police plus large
     l'exigeait, plutôt que de déborder du panneau.
   - **Au téléphone**, après « Critères de recherche », sur toute la
     largeur de la colonne.

   ⚠️ **Jamais en pleine largeur d'un écran large** : la pleine
   largeur projette la puce de sorte, le champ de minimum et la croix à
   ~1 400 px de leur libellé — une saccade d'un bout à l'autre de l'écran
   pour lire UNE ligne verrouillée, pire que le repli de texte qu'elle
   corrigerait.

   La **relique** vit dans un **bloc séparé de cette même carte**, le bloc
   qui **ferme la carte** (voir relique.md § Relique).
   L'interrupteur ci-dessus masque d'un seul geste les deux listes
   d'artéfacts ET le bloc Relique.

   ⚠️ **Largeur fixe et commune** aux quatre listes déroulantes de la carte
   (Attribut, Type, Principale relique, Propriété unique relique) : sans elle, un `<select>` natif
   prend la largeur de sa plus longue option — « Soins et boucliers
   accordés en fonction des PV » imposerait une case énorme pour « Propriété
   unique », y compris quand « Libre » y est affiché. La valeur
   **fermée** se tronque par « … » (`truncate`) ; la liste **ouverte**
   garde le texte complet, comportement natif du `<select>`.

