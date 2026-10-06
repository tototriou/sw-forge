# Set de runes recherché et statistique principale imposée

**Statut :** ÉTAT ACTUEL — décrit le choix du set de runes et des statistiques principales imposées
**Lire si :** on modifie le sélecteur de combo de sets ou les pastilles des emplacements 2, 4 et 6

4. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés. Y choisir
   **Accuracy** ou **Tolerance** guide vers l'interrupteur des auras RES/PRE
   des réglages avancés, sans toucher aux auras externes (degats-et-aura 7b,
   ouverture guidée : voir « État de mon monstre »).

   ⚠️ **L'Intangible ne figure PAS dans la grille.** C'est un **joker à une
   pièce** qui complète n'importe quel set : on ne le vise jamais pour
   lui-même, et le demander revenait à réclamer un set de 2 pièces qui
   n'existe pas. Il apparaissait sous « Set secondaire » parce que ce groupe
   se définissait par la négation — « tout ce qui n'est pas un set de 4 » —
   or l'Intangible n'est ni l'un ni l'autre. Signalé à l'usage. Il reste
   évidemment **utilisable par la recherche**, qui s'en sert pour compléter
   les sets demandés ; c'est seulement le CHOISIR comme objectif qui n'avait
   pas de sens. Un combo ancien qui en contiendrait un reste affiché et
   retirable.

   ⚠️ **Obligatoire** :
   tenter de lancer une recherche sans set sélectionné met cette zone en
   **surbrillance rouge marquée** au lieu de silencieusement ne rien faire —
   on montre OÙ agir. Repasse normale dès qu'un set est ajouté. **Colonne
   GAUCHE** de la carte (demande explicite), avec le point suivant.
   ⚠️ **Rouge Tailwind `red-500` littéral, pas le jeton sémantique `bad`** du
   thème — exception assumée à « aucune couleur Tailwind native »
   (CLAUDE.md) : `bad` (voir [shared/design.md](shared/design.md)) est
   volontairement une teinte corail douce en thème sombre, pensée pour un
   état des DONNÉES — trop proche du fond du contrôle pour se voir comme un
   vrai signal d'alerte. Ce cas précis en avait besoin, demandé explicitement
   après deux essais d'intensification du jeton `bad` jugés encore
   insuffisants (bordure épaisse + fond teinté + halo large).
   ⚠️ **Densité** (demandes explicites, « plus compact » / « resserré ») :
   `max-w-md` sur le conteneur de « Set de runes recherché » ; **Set principal
   (4 pièces) sur DEUX LIGNES en permanence** (`SetComboPicker.tsx`, `grid
   grid-cols-3` sans préfixe `compact:` — le bureau adopte l'agencement
   asymétrique du tactile, demande « comme sur mobile » : Set principal
   étroit, Set secondaire récupère la largeur libérée).
5. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision
   ⚠️ **Un maximum saisi SOUS le minimum retombe au défaut de la case**
   (demande explicite) : la condition serait insatisfaisable par construction,
   et la recherche renverrait « 0 build » sans que rien ne dise pourquoi.
   - À la **sortie du champ**, jamais à la frappe : on ne saurait pas
     distinguer un « 5 » définitif d'un « 50 » en cours d'écriture. C'est le
     même piège que celui que `NumberField` documente déjà pour le bornage par
     `min` — d'où un axe `onBlur` ajouté au composant, réservé aux règles qui
     lient DEUX champs (borner celui-ci reste le travail de `min`/`max`).
   - Le champ est **effacé**, pas remonté à la valeur du minimum : il retrouve
     ainsi son placeholder, donc son défaut (le plafond pour une stat bornée à
     100, « aucun maximum » sinon). Le corriger en « max = min » poserait une
     contrainte que personne n'a demandée, et qui ne laisse passer qu'une
     seule valeur.

   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. **Colonne
   GAUCHE**, sous Set de runes recherché (demande explicite : les deux
   contraintes qui portent sur les runes elles-mêmes, groupées ensemble). Ce
   filtre s'applique **avant** tout le reste, dans la construction même du
   pool par slot — il réduit donc le nombre de candidats réellement
   considérés dès le départ.
