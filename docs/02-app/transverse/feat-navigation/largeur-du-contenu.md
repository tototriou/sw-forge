# Navigation — largeur du contenu

Partie de [Navigation](README.md).

## Largeur du contenu

⚠️ **Pas de plafond de largeur.** Avec une barre latérale, la page commence à
son bord droit et va jusqu'au bout — les grilles de monstres, les tableaux de
runes et l'optimiseur y gagnent une à deux colonnes.

**Des exceptions**, bornées volontairement (le tableau les tient toutes) :

| Page | Largeur | Pourquoi |
|------|---------|----------|
| Mécaniques | 1100 px | Texte suivi — une ligne de 2 000 px se lit mal, l'œil perd le début de la suivante |
| Nouveautés | 900 px | Liste de textes courts lus de haut en bas |
| Télécharger | 760 px | Trois cartes et deux boutons : étalés, les boutons s'isoleraient loin de leur explication |
| Paramètres | 620 px | Lignes « intitulé / contrôle » |
| Roue de runes | ×0,72 sous `sm` | ⚠️ C'est un DESSIN calculé en pixels (cadres, icônes de set, décalages) : il ne se réduit pas seul comme une image. À 208 px il occuperait plus de la moitié des 348 px utiles. En dessous de 0,72 les icônes de set passent sous 14 px et le set ne se reconnaît plus |
| Emplacements d'artéfacts | ×0,72 sous `sm` | **La même échelle que la roue**, et ce n'est pas un hasard : les deux se lisent côte à côte, les réduire inégalement les désaccorderait. 58 px → 42 |

⚠️ **Artéfacts, roue et relique tiennent sur UNE ligne** sous `sm` — ce sont les
trois faces d'un même équipement, et séparés on perd la vue d'ensemble qu'on
vient chercher. Le budget : 42 + 6 + 150 + 6 + 62 ≈ **266 px** sur 348.

C'est le **panneau de stats** qui les en empêcherait : à 200 px il occuperait
plus de la moitié de la largeur et pousserait la roue à la ligne suivante,
laissant les artéfacts seuls à côté de lui — l'équipement se lirait en trois
morceaux. Il est donc sur sa propre ligne sous `sm`.

⚠️ Pour `RuneWheel` comme pour `ArtifactSlots`, une **`scale` explicite remplace**
l'adaptation mobile, elle ne s'y multiplie pas. La carte de résultat de
l'Optimiseur passe déjà 0,45 pour tenir deux cartes par ligne ; multiplier
donnerait 0,32, soit une icône de 8 px où l'artéfact ne se reconnaît plus.
| Courbes | 980 px | ⚠️ Le graphe suit son conteneur : sur 2 000 px la courbe s'aplatirait jusqu'à la ligne droite, et les écarts entre runes — la seule chose qu'on vient y lire — disparaîtraient |
