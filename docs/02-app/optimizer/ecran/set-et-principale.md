# Set de runes recherché et statistique principale imposée

Ce document décrit le choix du set de runes et des statistiques principales imposées.

4. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés. Y choisir
   **Accuracy** ou **Tolerance** guide vers l'interrupteur des auras RES/PRE
   des réglages avancés, sans toucher aux auras externes (voir
   etat-de-mon-monstre.md § Ouverture guidée vers l'interrupteur des auras RES/PRE).

   ⚠️ **L'Intangible ne figure PAS dans la grille.** C'est un **joker à une
   pièce** qui complète n'importe quel set : on ne le vise jamais pour
   lui-même, et le demander reviendrait à réclamer un set de 2 pièces qui
   n'existe pas. Ne pas le ranger sous « Set secondaire » au motif que ce
   groupe se définit par la négation — « tout ce qui n'est pas un set de 4 » :
   l'Intangible n'est ni l'un ni l'autre. Il reste
   évidemment **utilisable par la recherche**, qui s'en sert pour compléter
   les sets demandés ; c'est seulement le CHOISIR comme objectif qui n'a
   pas de sens. Un combo ancien qui en contiendrait un reste affiché et
   retirable.

   ⚠️ **Obligatoire** :
   tenter de lancer une recherche sans set sélectionné met cette zone en
   **surbrillance** — contour et fond teinté au jeton `bad` (`border-bad
   bg-bad/15`), avec le message « Sélectionne au moins un set avant de lancer
   la recherche. » — au lieu de silencieusement ne rien faire :
   on montre OÙ agir. Repasse normale dès qu'un set est ajouté. Au bureau,
   le message prend la place du compteur `N/6 runes`, à droite du libellé :
   aucune ligne réservée sous la liste, et rien ne bouge quand il paraît.
   ⚠️ **Densité** :
   **Set principal (4 pièces) sur DEUX LIGNES en permanence**
   (`SetComboPicker.tsx`, `grid grid-cols-3` sans préfixe `compact:` — les
   deux formats prennent l'agencement asymétrique du tactile : Set principal
   étroit, Set secondaire récupère la largeur libérée).

   **Au téléphone**, la grille est en ligne dans « Critères de recherche »,
   en tête de la carte (`max-w-md`), avant le point suivant puis les
   Conditions, empilés.

   **Au bureau**, le set de runes recherché est une section du panneau des
   essentiels, sous la liste de travail, **sans le titre « Critères de
   recherche »** du téléphone (le panneau et ses traits situent déjà la
   section), en **forme compacte** (`SetDeRunesCompact`) : le compteur `N/6 runes` à droite du libellé (le
   message d'une recherche refusée sans set à sa place), puis
   une seule liste fermée (`SelecteurMultiple`, axe `surface`) qui montre les
   sets choisis, icône et nom, ou « Aucun ». Ouverte, elle porte la grille
   du téléphone telle quelle (jetons, retrait, deux groupes, « Plus de
   place ») en flottant : rien ne bouge dessous. ⚠️ **Une liste, pas deux**
   (principal · secondaire) : le choix est un multiensemble (deux fois le
   même set), que la grille sait dire et une case par set non.
   - ⚠️ **La liste reste ouverte pendant la composition** : après un set de
     4, il reste un set de 2 à choisir. Elle ne se ferme d'elle-même qu'au
     choix qui remplit les six emplacements, sinon au clic ailleurs ou à
     Échap.
   - ⚠️ **La rangée des jetons est réservée** : vide, elle a déjà la hauteur
     d'un jeton, et le premier set choisi ne fait pas descendre la grille
     sous le pointeur.
5. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), un
   choix multiple parmi :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision

   Multi-sélection ; **aucun choix = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. Ce
   filtre s'applique **avant** tout le reste, dans la construction même du
   pool par slot — il réduit donc le nombre de candidats réellement
   considérés dès le départ.

   **Au téléphone**, une rangée de puces à cocher (`Pastille`) par slot,
   sous Set de runes recherché, dans la même carte (les deux contraintes qui
   portent sur les runes elles-mêmes, groupées ensemble), séparée de lui par
   un trait.

   **Au bureau**, une section des essentiels, en tête de la sous-colonne de
   177 px à droite des Conditions, au-dessus d'« État de mon monstre »
   (`PrincipalesImposeesBureau`) : une **rangée compacte par slot**, « Slot
   n » puis sa liste à choix multiples (`SelecteurMultiple`, forme
   « surbrillance » ; schéma de l'utilisateur, arrêt 4). Fermée, la liste dit
   « Libre » sans choix, sinon **toutes** les valeurs choisies, à la ligne
   entre deux valeurs : une ligne pour « Libre » ou deux ou trois valeurs,
   deux pour les cinq d'un slot ; rien n'est tronqué. Sans hauteur réservée :
   ouverte (de la largeur du champ, « Dmg Crit » y tient), la surface se pose à la
   hauteur qu'avait le champ à l'ouverture et n'en bouge plus, même quand un
   choix allonge le champ sous elle ; seules les rangées suivantes
   descendent. Chaque valeur choisie est en surbrillance, sans case. Le
   geste reste celui des puces : une principale à la fois.
