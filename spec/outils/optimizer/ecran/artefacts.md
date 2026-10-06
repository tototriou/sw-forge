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
   en place. Le réglage retirait auparavant TOUTE contribution d'artéfact, ce
   que son libellé ne disait pas et qui rendait les conditions minimales plus
   dures à franchir sans raison.

   Activé, deux listes déroulantes (Attribut, Type) proposent :
   **« Libre »** (**défaut** — cherche le meilleur artéfact parmi TOUS les
   artéfacts équipables), **« Garder l'artéfact équipé »**, **Principale
   ATQ +100**, **Principale DEF +100**, **Principale PV +1500** (les trois
   statistiques principales d'artéfact du jeu).

   ⚠️ **Le défaut affiché était FAUX** : la liste montrait « Garder l'artéfact
   équipé » tant qu'aucun choix n'avait été fait, pendant que la recherche
   cherchait librement — le moteur traite une absence de choix comme
   « Libre ». L'écran annonçait donc le contraire de ce qui se passait, et
   tout ce qui se fiait à cet affichage (les emplacements considérés comme
   figés, donc l'éditeur de sous-propriétés verrouillées) raisonnait sur un
   état faux. Le comportement n'a pas changé — seul l'affichage a été mis
   d'accord avec lui.

   ⚠️ **Il n'y a PAS de cran « Aucun »** — il a existé, il a été retiré.
   Imposer l'emplacement vide pour UNE sorte pendant que l'autre cherche ne
   correspond à rien en jeu : un monstre porte deux artéfacts, ou n'en porte
   pas. Ne pas les compter est une décision **globale**, et l'interrupteur la
   prend d'un seul geste pour les deux emplacements. L'emplacement peut
   toujours rester **vide** si la recherche n'a rien de mieux à y mettre —
   c'est l'imposer par sorte qui n'avait pas de sens. Une recette exportée
   avant ce retrait voit son « Aucun » ramené sur **« Libre »** à l'import.

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
   `com2usId`, les runes par la recherche elle-même) ; celui-ci était le seul
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

   ⚠️ Ce choix s'appelait **« Comme équipé »**, et le mot « principale »
   n'apparaissait nulle part. Posé au milieu de trois statistiques
   principales, il se lisait « la principale, comme équipé » — une liste se
   lit comme homogène. Signalé à l'usage. Le qualificatif a donc été ajouté
   aux entrées qui filtrent **réellement** par stat principale, et le choix
   qui garde la pièce dit maintenant qu'il la garde.

## Place de la carte à l'écran

   ⚠️ **Carte à part**, colonne 2 rangée 2 — sous « Exemplaire », plus dans
   la colonne droite de « Critères de recherche ». L'interrupteur
   « Activer l'optimisation d'artéfacts et reliques » masque d'un coup les deux listes ET les
   lignes verrouillées : tant que le bloc vivait en tête de cette colonne,
   ce clic faisait REMONTER « Conditions », soit un clic qui déplace ce qui
   le suit ([shared/design.md](shared/design.md)). Le trait qui séparait
   Artéfacts de Conditions a disparu avec lui — un trait en tête de colonne
   ne sépare plus rien.

   ⚠️ **Pas en pleine largeur** : essayé et rejeté sur capture. La pleine
   largeur projette la puce de sorte, le champ de minimum et la croix à
   ~1 400 px de leur libellé — une saccade d'un bout à l'autre de l'écran
   pour lire UNE ligne verrouillée, pire que le repli de texte qu'elle
   corrigeait.

   La **relique** vit dans un **bloc séparé de cette même carte**, renommée
   **« Artéfacts et reliques »** (voir « Relique » ci-dessous) : elle a d'abord vécu ici même (deux
   listes), puis dans sa propre carte — écartée à la
   vue du rendu (T9 re-tranché une seconde fois) au profit d'un bloc à
   droite de la rangée Attribut / Type, lui-même écarté à son
   tour (T9 re-tranché une troisième fois) au profit du bloc qui **ferme la
   carte**, sous « Meilleurs artéfacts offensifs pour ce build ».
   L'interrupteur ci-dessus, renommé **« Activer l'optimisation
   d'artéfacts et reliques »**, masque d'un seul geste les deux listes
   d'artéfacts ET le bloc Relique.

   ⚠️ **Largeur fixe et commune** aux quatre listes déroulantes de la carte
   (Attribut, Type, Principale relique, Propriété unique relique) : sans elle, un `<select>` natif
   prend la largeur de sa plus longue option — « Soins et boucliers
   accordés en fonction des PV » imposait une case énorme pour « Propriété
   unique », y compris quand « Libre » y était affiché. La valeur
   **fermée** se tronque par « … » (`truncate`) ; la liste **ouverte**
   garde le texte complet, comportement natif du `<select>`.

