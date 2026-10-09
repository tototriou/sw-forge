# Artéfacts

**Statut :** ÉTAT ACTUEL — décrit la carte « Artéfacts » de l'écran
**Lire si :** on modifie l'interrupteur d'optimisation d'artéfacts ou ses réglages à l'écran

6. **Artéfacts** — carte « Artéfacts et reliques », interrupteur
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
   artéfacts équipables), **« Garder l'artéfact équipé »**, **Principale
   ATQ +100**, **Principale DEF +100**, **Principale PV +1500** (les trois
   statistiques principales d'artéfact du jeu).

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
   ligne d'effet, quand « Garder l'artéfact équipé » les compte — deux
   réglages voisins, deux modèles de dégâts, sans que rien ne le signale.

   ⚠️ **Sans choix, la liste affiche « Libre »**, parce que le moteur traite
   une absence de choix comme « Libre » (`candidatsParSorte`,
   artifactOptim.ts). Afficher « Garder l'artéfact équipé » annoncerait le
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

   ⚠️ **« Garder l'artéfact équipé » conserve la PIÈCE ENTIÈRE**, ses quatre
   sous-propriétés comprises : le pool de cet emplacement tombe à **un seul
   candidat**, l'exemplaire réellement porté (ou rien, s'il n'est pas
   éligible pour ce monstre). Rien n'est cherché.

   ⚠️ **Ce choix ne se PARTAGE pas.** Importer une recette exportée par
   **quelqu'un d'autre** bascule automatiquement « Garder l'artéfact équipé »
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

   ⚠️ **« Garder l'artéfact équipé », jamais « Comme équipé »** : posé au
   milieu de trois statistiques principales, « Comme équipé » se lirait « la
   principale, comme équipé » — une liste se lit comme homogène. D'où
   « Principale » sur les entrées qui filtrent **réellement** par stat
   principale, et un choix qui garde la pièce et le dit.

## Place de la carte à l'écran

   ⚠️ **Carte à part**, colonne 2 rangée 2 — sous « Exemplaire », pas dans
   la colonne droite de « Critères de recherche ». L'interrupteur
   masque d'un coup les deux listes ET les
   lignes verrouillées : en tête de cette colonne,
   ce clic ferait REMONTER « Conditions », soit un clic qui déplace ce qui
   le suit ([03-developpeur/interface/ (design)](../../03-developpeur/interface/)).

   ⚠️ **Pas en pleine largeur** : la pleine
   largeur projette la puce de sorte, le champ de minimum et la croix à
   ~1 400 px de leur libellé — une saccade d'un bout à l'autre de l'écran
   pour lire UNE ligne verrouillée, pire que le repli de texte qu'elle
   corrigerait.

   La **relique** vit dans un **bloc séparé de cette même carte**, le bloc
   qui **ferme la carte**, sous « Meilleurs artéfacts offensifs pour ce
   build » (voir feat-ecran-relique.md § Relique).
   L'interrupteur ci-dessus masque d'un seul geste les deux listes
   d'artéfacts ET le bloc Relique.

   ⚠️ **Largeur fixe et commune** aux quatre listes déroulantes de la carte
   (Attribut, Type, Principale relique, Propriété unique relique) : sans elle, un `<select>` natif
   prend la largeur de sa plus longue option — « Soins et boucliers
   accordés en fonction des PV » imposerait une case énorme pour « Propriété
   unique », y compris quand « Libre » y est affiché. La valeur
   **fermée** se tronque par « … » (`truncate`) ; la liste **ouverte**
   garde le texte complet, comportement natif du `<select>`.

