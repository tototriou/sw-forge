# Set de runes recherché et statistique principale imposée

**Statut :** ÉTAT ACTUEL — décrit le choix du set de runes et des statistiques principales imposées
**Lire si :** on modifie le sélecteur de combo de sets ou les pastilles des emplacements 2, 4 et 6

4. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés. Y choisir
   **Accuracy** ou **Tolerance** guide vers l'interrupteur des auras RES/PRE
   des réglages avancés, sans toucher aux auras externes (voir
   feat-ecran-etat-de-mon-monstre.md § Ouverture guidée vers l'interrupteur des auras RES/PRE).

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
   on montre OÙ agir. Repasse normale dès qu'un set est ajouté. **Colonne
   GAUCHE** de la carte, avec le point suivant.
   ⚠️ **Densité** :
   `max-w-md` sur le conteneur de « Set de runes recherché » ; **Set principal
   (4 pièces) sur DEUX LIGNES en permanence** (`SetComboPicker.tsx`, `grid
   grid-cols-3` sans préfixe `compact:` — le bureau adopte l'agencement
   asymétrique du tactile : Set principal
   étroit, Set secondaire récupère la largeur libérée).
5. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision

   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. **Colonne
   GAUCHE**, sous Set de runes recherché (les deux
   contraintes qui portent sur les runes elles-mêmes, groupées ensemble). Ce
   filtre s'applique **avant** tout le reste, dans la construction même du
   pool par slot — il réduit donc le nombre de candidats réellement
   considérés dès le départ.
