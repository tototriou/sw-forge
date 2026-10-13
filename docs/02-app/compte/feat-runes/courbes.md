# Runes — onglet Courbes

Partie de [Mon compte — Runes](README.md).

## Onglet Courbes — `RunesCurve`

⚠️ **À la SOURIS** :
- un en-tête : « Courbes », puis ce qu'elles tracent (« Efficience de chaque
  rune, de la meilleure à la moins bonne. », ou « Score », selon le ⚙) ;
- le graphe et sa légende côte à côte : la légende (`CurveLegend`, en
  colonne) passe dans une carte « Séries » à droite du graphe.

Au doigt, la légende est en rangée sous le graphe.

⚠️ **L'infobulle de survol est du HTML posé sur le graphe** : le gabarit des
panneaux flottants de l'app (fond `panel`, contour, ombre, texte 12 px), qui
suit le thème — dessinée en SVG, ce serait une boîte aux couleurs écrites en
dur, sombre même en thème clair. Les noms sont tronqués à la largeur réelle.
Le rang (« N runes »), puis une ligne par courbe : point de couleur, nom,
valeur alignée à droite. La grille, les graduations, les titres d'axes et le
liseré des points lisent eux aussi les tokens (`border-soft`, encres
atténuées, `panel`). Vaut aussi pour la Comparaison, qui partage
`CurveChart`.

Trois courbes, chacune **triée par valeur décroissante** (ordonnée = la **mesure
choisie** — efficience % ou score SW, l'axe et l'infobulle s'adaptent ; abscisse =
nombre de runes) :

- **Actuelle** (bleu, avec aire) — l'efficience des runes aujourd'hui.
- **Potentiel Héro** (violet) / **Potentiel Légend** (orange) — l'efficience si
  chaque rune recevait son optimisation maximale (voir onglet Optimisation) ;
  identiques aux tris « Potentiel héroïque / légendaire » de l'Optimisation.

Détails :
- Rendu SVG **sobre** et **maison** (aucune dépendance) via
  [CurveChart.tsx](src/components/account/CurveChart.tsx) : courbes **lissées**
  (Catmull-Rom → Bézier), aire discrète sous « Actuelle », grille, graduations,
  titres d'axes, axe Y ajusté aux données, sous-échantillonnage ~240 points.
- **Interactif** : au survol, ligne verticale + points sur chaque courbe +
  **infobulle**, ordonnée de la plus haute à la plus basse valeur au point
  survolé. Chaque ligne = **pastille de couleur · NOM de la courbe · valeur**,
  valeurs **alignées à droite** pour se comparer d'un coup d'œil.
  - ⚠️ **Le nom est indispensable** : à trois courbes superposées, une pastille
    de couleur seule obligerait à faire l'aller-retour avec la légende pour
    savoir qui vaut quoi.
  - Le nom est **tronqué à la largeur réelle** de la boîte (le complet reste
    dans la légende).
### ⚠️ Interactif au DOIGT, et lisible en plein écran

Le graphe garde son gabarit de **820 × 380** sur les deux formats. Sur un
téléphone de 390 px il est donc réduit à **42 %**, et ses graduations écrites en
11 px arrivent à l'écran en **4,6**. Plutôt qu'un second graphe pour l'écran
étroit, on donne le moyen de lire celui-ci **en grand**.

- ⚠️ **`touch-action: pan-y` sur le SVG — c'est lui qui rend le graphe
  interactif au doigt.** Sans lui le navigateur prend le glissement horizontal
  pour un début de défilement, s'approprie le geste et n'envoie plus aucun
  `pointermove` : le graphe serait **muet sur téléphone** alors que tout le code
  d'interaction est là. `pan-y` et non `none` : le défilement **vertical** de
  la page doit continuer de passer, sinon on reste coincé en travers du graphe.
- **Bouton plein écran**, en bas à **droite** du cadre, **sous `lg` seulement** :
  à la souris, le graphe a déjà la largeur pour laquelle il est dessiné. Sur le
  même bord que le bouton d'aide, qui occupe le haut : les deux commandes du
  graphe se lisent sur une même verticale, du côté du pouce, plutôt que dans
  deux angles opposés.
- ⚠️ **Les deux boutons font 28 px, et portent `data-cible-fine` +
  `cible-tactile` ENSEMBLE.** Le premier exempte de la règle tactile globale
  (`min-height: 40px` au doigt), qui étirerait un bouton de 28 px en **ovale
  de 28 × 40** — le piège que documente index.css. Le second lui rend ses 44 px
  de zone touchable par un pseudo-élément qui déborde : la cible reste
  réglementaire, le dessin reste petit. Retirer l'un des deux casse soit la
  forme, soit la visée.
- ⚠️ **On TOURNE le graphe, on ne force pas l'appareil.** Verrouiller
  l'orientation (`screen.orientation.lock`) exige le plein écran natif, que
  Safari iOS n'accorde qu'à la vidéo : le geste marcherait sur un téléphone
  et pas sur l'autre. Une rotation CSS donne le même résultat partout — et on ne
  tourne **que si l'écran est encore en portrait**, l'appareil tourné
  physiquement restant correct.
  - La boîte tournée **échange largeur et hauteur** : après un quart de tour, la
    largeur du dessin longe la hauteur de l'écran. Sans cet échange, le graphe
    dépasserait des deux côtés.
  - Centrage `translate(-50%, -50%)` **avant** la rotation — tourner d'abord
    ferait pivoter aussi le déplacement.
- ⚠️ **Le pointeur se convertit par `getScreenCTM()`, pas par le cadre du
  SVG.** `getBoundingClientRect()` rend un rectangle **aligné sur l'écran** :
  dès que le graphe est tourné, il décrit la boîte englobante de la rotation et
  le point visé tomberait n'importe où. La matrice inverse ramène un point de
  l'écran dans le repère du dessin, quelles que soient les transformations
  traversées.
- Plein écran en `z-[70]`, le niveau des **dialogues** : sans quoi la barre
  d'onglets et le panneau de navigation resteraient posés dessus.
- ⚠️ **En plein écran, le clic n'ouvre pas de rune.** On y vient lire la courbe
  en grand, et le geste s'y confond avec le pincement : un doigt qui se pose
  pour zoomer ouvrirait une carte de rune par-dessus le graphe. Le détail reste à
  sa place, dans la page.

#### ⚠️ Le zoom est fait DANS le graphe, pas délégué au navigateur

`index.html` pose `maximum-scale=1` pour empêcher Safari iOS de zoomer tout seul
à la mise au point d'un champ — une contrainte pesée et documentée là-bas, qu'on
ne défait pas pour un graphe. Le pincement agit donc sur la **fenêtre de rangs**
du dessin : même résultat à l'œil, identique sur tous les navigateurs, et rien
n'est retiré au reste de l'application.

- **Un doigt lit la courbe, deux la zooment.** C'est le nombre de pointeurs
  posés qui départage les deux gestes.
- ⚠️ **Le zoom porte sur l'axe des RANGS seul**, jamais sur la hauteur. Les
  trois mille runes s'écrasent en largeur, pas en hauteur ; et une échelle
  verticale qui bougerait ferait mentir la comparaison entre courbes — deux
  points à la même hauteur doivent valoir la même chose.
- Le rang sous le **milieu des doigts ne bouge pas** : on zoome là où l'on
  regarde, et non vers le centre du graphe. Le déplacement de ce milieu fait
  glisser la fenêtre, ce qui donne le **panoramique dans le même geste**.
- Plancher à **5 rangs** : en dessous, la courbe n'est plus qu'un segment entre
  deux runes et le lissage n'a plus rien à lisser.
- ⚠️ **Détourage de l'aire de tracé** (`clipPath`) : zoomé, le classement déborde
  des deux côtés de la fenêtre. `downsample` parcourt **toutes** les runes, et
  celles hors fenêtre se dessineraient par-dessus les graduations Y et jusque dans
  les marges.
- Le zoom **se remet à plat en quittant le plein écran** : gardé, on
  reviendrait à la page sur un graphe montrant cinquante runes sans rien qui
  dise pourquoi.

#### ⚠️ L'aide « Comment lire ce graphe ? » a DEUX supports

Le texte fait une demi-page. Ancré à un bouton de 28 px, il descendrait sous le
bas de l'écran et ses dernières lignes passeraient **derrière la barre
d'onglets** (`z-40` contre le `z-20` du popover). Le plafonner à `60dvh` et le
faire défiler ne suffit pas : un pavé de texte dans une bulle flottante reste
illisible sur un téléphone.

| Format | Support |
|---|---|
| **Bureau** | popover ancré au bouton — l'écran est haut, le texte tient, et le geste (clic hors zone) est celui d'un popover |
| **Téléphone** | **`MobileSheet`** — il monte du bas, se pose au-dessus de la barre d'onglets, prend toute la largeur et défile |

- Le texte est **écrit une fois** et passé aux deux : deux copies
  divergeraient à la première correction.
- ⚠️ L'écouteur de **clic extérieur** ne vaut que pour le popover : le panneau
  a son propre voile et sa croix, et cet écouteur le refermerait au premier
  appui à l'intérieur.
- ⚠️ **Ce patron est le composant partagé [HelpPopover.tsx](src/components/HelpPopover.tsx)** :
  bouton `BoutonIcone` + bulle `FlottantAuto` (souris) + `MobileSheet` (doigt),
  le tout écrit une seule fois. Il sert ici, à l'onglet **Optimisation**
  (« Comment est-ce calculé ? ») et à l'**Optimiseur d'Outils**.
  `title` sert de titre au panneau et d'en-tête à la bulle ; `ariaLabel` donne au
  bouton un libellé distinct quand il diffère (« Comment lire ce graphe ? »).

#### ⚠️ Pas de panneau « Options » ici — les filtres restent dans la page

Les Courbes portent pourtant les mêmes filtres que la Liste (sets, slots,
antiques). Descendus dans le tiroir, ils laisseraient un écran qui ne porte
qu'un graphe et deux réglages : la page paraîtrait **vide**, et le bouton
flottant annoncerait un contenu qu'on ne devine pas.

La Liste, elle, a **3 000 tuiles** à montrer : chaque rangée de filtre lui prend
un écran de résultats, et la place libérée profite immédiatement.

> ⚠️ **Avoir des filtres ne suffit pas à mériter le panneau.** Il faut aussi
> que la page ait de quoi remplir la place qu'ils libèrent. C'est ce qui décide
> de l'appartenance à `pageAPanneau` ([App.tsx](src/App.tsx)) — au même titre
> que l'Optimiseur, dont les réglages SONT le contenu.

- ⚠️ **Cliquer un point ouvre la rune correspondante**, sous le graphe. On lit
  « ma 12ᵉ meilleure rune vaut 78 % » ; la question suivante est toujours
  « laquelle ? », et il faudrait aller la chercher à la main dans la liste.
  - Le rang cliqué est marqué d'une **verticale tiretée** avec un **point sur
    chaque courbe ouverte** — ⚠️ **exactement le repère du survol**, ni plus
    épais ni plus gros. C'est le même geste de visée, seulement **figé** : le
    marquer davantage en ferait un autre objet, une graduation du graphe. Sa
    seule différence est qu'il **survit au départ du pointeur**, ce qui est tout
    son rôle — dire d'où sort le détail lu en dessous une fois la souris partie
    vers les flèches.
    - ⚠️ Les couleurs des attributs SVG s'écrivent **`rgb(var(--accent))`** :
      posés nus, les tokens (des triplets) rendent l'attribut invalide et le
      trait n'est **pas peint du tout**, sans la moindre erreur. Voir
      [../../03-developpeur/interface/](../../../03-developpeur/interface/).
  - ⚠️ **Une carte par courbe OUVRABLE, à ce rang** — et ce que « ouvrable »
    veut dire diffère selon l'onglet, parce que les courbes n'y disent pas la
    même chose :

    | Onglet | Ouvrables | Pourquoi |
    |--------|-----------|----------|
    | **Courbes** | « Actuelle » seule | Les potentiels ne sont pas d'autres runes : c'est la **même box** projetée dans une autre hypothèse. Trois cartes quasi identiques pour une seule question — « quelle est cette rune ? ». |
    | **Comparaison** | **toutes** celles qui portent leurs runes | Chaque courbe est un **compte différent** : « à ma 12ᵉ meilleure rune, qu'ont-ils, eux ? ». N'en montrer qu'une obligerait à recliquer chaque courbe pour la même question. |

    Les cartes sont ordonnées **par valeur décroissante**, comme les courbes au
    point X et comme l'infobulle de survol : même lecture partout. Une courbe
    **masquée** dans la légende n'apparaît pas (elle n'atteint pas le graphe).
  - Le détail est précédé de l'**image de la rune** (cadre du slot + symbole du
    set, `RuneSlotIcon`) puis de son **set** et de son **slot**. ⚠️ L'image
    d'abord : c'est à elle qu'on reconnaît une rune d'un coup d'œil, le texte ne
    fait que confirmer. **Même rendu que les tuiles de l'onglet Liste**, pour
    retrouver la même rune sans changer de langage d'un onglet à l'autre.
  - ⚠️ **Sous le graphe, dans le flux — pas en flottant.** La carte d'une rune
    fait ~300 px de haut : un popover de cette taille ancré sur un point
    recouvrirait la courbe qu'on vient de lire.
  - Le détail est **centré**, précédé d'une **barre de navigation** : les deux
    flèches **côte à côte, juste sous la courbe**, encadrant le rang
    (« n° 12 / 340 »). Elles font parcourir le **classement** — l'axe du graphe
    au-dessus —, pas la carte du dessous : les placer de part et d'autre de la
    carte les éloignerait l'une de l'autre alors qu'on les enchaîne.
    - Le rang est à **largeur fixe**, sinon les flèches se déplacent au passage
      de « 9 » à « 10 ». Il n'est **pas répété** dans la carte.
    - Elles **bornent au lieu de boucler** (le classement a un début et une
      fin ; repasser du dernier au premier ferait croire à un saut de position)
      et sont désactivées aux extrémités. Les **touches ← →** font la même chose.
  - Re-cliquer le même point **referme** (le geste est son propre inverse) ;
    **Échap** et la croix ferment aussi.
  - ⚠️ **Cliquable seulement là où la courbe porte ses runes**
    (`CurveSeries.runes`, aligné sur `effs`, même tri). Une courbe **partagée**
    ne porte que des valeurs : elle reste en lecture seule. Un **fichier de
    compte**, lui, porte ses runes — ses points sont donc ouvrables, dans les
    deux sous-onglets de Comparaison.
  - Le **nom de la courbe** est rappelé sur chaque carte dès qu'il y a plusieurs
    ouvrables ; masqué sinon, où il n'apprendrait rien.
  - On mémorise le **rang seul** : c'est une **position du classement**, et
    c'est cette position qu'on lit sur toutes les courbes à la fois. La
    navigation porte sur le rang le plus élevé des courbes ouvrables (le
    **max**, pas le min : une courbe plus courte cesse simplement d'être
    affichée, elle ne bride pas les autres).
  - On mémorise le **rang**, jamais les runes : les séries se recalculent à
    chaque changement de filtre ou de mesure, et des runes figées désigneraient
    un point disparu.
- **Légende sous le graphe** : en **rangée horizontale** (les entrées côte à
  côte), **pastille de couleur + nom** uniquement — pas de valeurs. Cliquer un
  nom **masque/affiche** sa courbe. Composant **partagé avec la Comparaison**,
  [CurveLegend.tsx](src/components/account/CurveLegend.tsx) (voir plus bas).
- **Filtres** : sets (`SetFilter`), slot (`SlotFilter`), antiques (`AncientFilter`,
  le **3 états** commun — voir l'onglet Optimisation).
- **Nombre de runes** : champ libre (défaut **400**) + **Tout**.
- **Mode** : **Gemme + meule** / **Meule seule** (voir Optimisation), suivi du
  bouton **« Autoriser un regemme différent »** (éteint par défaut, grisé en
  « Meule seule » — voir Optimisation § Modes). La rangée passe à la ligne
  (`flex-wrap`) au lieu de déborder sur téléphone.
- **Aide « ? »** superposée en coin du graphe (popup fermable au clic extérieur)
  expliquant la lecture et renvoyant vers l'Optimisation.
