# Librairie UI — contours

Partie de [Librairie UI](README.md).

## Les contours : 1 px, et UN SEUL

> ⚠️ **Aucun contour d'INTERFACE ne dépasse 1 px, et jamais deux superposés.** Un
> contour cerne ce qu'il désigne, il ne l'encadre pas.

> ⚠️ **La règle ne vaut PAS pour l'équipement** — runes, artéfacts, reliques. Ces
> objets-là appartiennent au jeu, pas à l'interface : sélectionnés, ils se
> mettent en valeur **comme dans le jeu**, avec halo doré, éclat et liseré
> appuyé. C'est ce qui les distingue d'un bouton au milieu de la même page. La
> roue de runes et les emplacements d'artéfacts font de même, et il ne faut pas
> les « corriger ».
>
> La frontière est celle-ci : un composant de `src/ui/` suit la règle ; un objet
> que le joueur reconnaît de sa partie ne la suit pas. Aucun ton de la librairie
> ne porte le doré du jeu : il inviterait à ramener ces objets dans le système
> d'interface.

Le piège n'est presque jamais l'épaisseur d'un trait : c'est le **cumul**. Une
bordure *et* un anneau, une bordure *et* une ombre portée — l'épaisseur réelle
n'est alors celle d'aucun des deux, et les traits concentriques se lisent comme
un contour flou plutôt que comme deux informations.

| Où | Cumul à éviter | Épaisseur réelle |
|----|-------|------------------|
| Palette de couleurs | `ring-2` + `ring-offset-2` | **4 px** autour d'une case de 24 |
| Recommandations, équipes de siège | `border-X` + `ring-2 ring-X/50` | 3 px, en deux traits |
| Doublon de l'Optimiseur | `border-2` + `ring-4` | **6 px** |
| Relique, lead | `border-star` + `ring-1` | 2 px, en deux traits |
| Section, au survol du dépôt | `borderColor` + ombre 2 px | 3 px |
| Puce de légende | `border-2` sur un disque de 10 px | le trait mange la moitié |

> ⚠️ **Avant d'ajouter un trait, vérifier que celui d'en dessous n'est pas déjà
> teinté.** C'est l'erreur qui revient : on colore une bordure existante, puis on
> ajoute un anneau pour « que ça se voie mieux ».

⚠️ **Un `Flottant` posant déjà un cadre, ce qu'il contient n'en pose pas un
second.** Une carte qui a SON PROPRE cadre (`PieceDetailBox`, `OptimPlanBox` —
bord + fond + coins arrondis) ouverte dans un `Flottant`/`FlottantAuto` donnerait
une carte dans une carte : deux bords à un pixel l'un de l'autre, à des rayons
de coin différents (`rounded-xl` du flottant contre `rounded-lg` de la carte),
qui se lisent comme un contour flou plutôt que comme deux informations.
`PieceDetailBox` porte la règle comme un axe (`encadre`, `false` dans un
flottant) plutôt que par une copie retouchée. Le rembourrage passe alors au
flottant (`rembourrage="md"`) : sans cadre, la carte n'a pas de bord à en
tenir éloigné.

⚠️ **Une seule exception nommée : le contour du haut d'une colonne de
l'Optimizer au bureau est une bande braise de 3 px.** Chaque panneau de
colonne de la page de bureau (essentiels, colonnes repliables, colonne de
droite) a pour contour du haut une bande de 3 px de braise vive, à la place
du trait de 1 px (pas sous lui : aucun cumul), aux coins arrondis du
panneau, et qui s'efface en dégradé vers le contour de 1 px jusqu'au bas de
l'arrondi ; elle reste en haut de la colonne, arrondie, quand la colonne
défile seule. Décision de l'utilisateur : le seul panneau ne séparait pas
assez des colonnes côte à côte. La bande ne cerne rien, elle marque le haut
d'une colonne ; elle ne s'étend à aucun autre panneau, ni à une section, un
bloc ou une carte posés dans une colonne.
Détail : [fiche de l'écran de l'Optimizer](../../../02-app/optimizer/ecran/README.md#panneaux-et-sections).

**Deux exceptions, et elles ne sont pas des contours :**

- Le **`ring-offset`** de la palette est un *écart*, pas un second trait : sans
  lui, l'anneau d'encre touche l'aplat de couleur et devient illisible sur les
  teintes sombres.
- L'**anneau de focus clavier** (`outline: 2px`, dans `index.css`) reste à 2 px.
  Il n'apparaît qu'en tabulant — jamais à la souris ni au doigt — et sa taille
  est ce qui le rend repérable quand on ne sait plus où l'on est dans la page.
  Voir la règle de focus dans [design/regles-transverses.md](../design/regles-transverses.md).
