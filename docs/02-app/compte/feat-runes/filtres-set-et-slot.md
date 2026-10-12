# Runes — filtres par set et par slot

Partie de [Mon compte — Runes](README.md).

## Filtrer par set — `SetFilter`

[SetFilter.tsx](src/components/account/SetFilter.tsx), partagé par **Liste**,
**Courbes** et **Optimisation**.

⚠️ **À la SOURIS, les filtres tiennent sur UNE ligne, tous VISIBLES**
(refonte graphique, lot 8a, décision 20 précisée) —
[FiltresRunes.tsx](../../../../src/components/account/FiltresRunes.tsx) : sets ·
emplacements · antiques, les MÊMES contrôles qu'avant (`SetFilter`,
`SlotFilter`, `AncientFilter`, inchangés), puis **« Effacer les filtres »**.
Ils prenaient trois rangées.
- ⚠️ **Aucun menu déroulant** : la maquette en posait trois (« Set ▾ »,
  « Emplacement ▾ », « Antiques ▾ »). Essayés, puis défaits par le mainteneur, pour
  les sets d'abord (« pas très fan d'avoir des drop-down pour un set filtre
  dedans »), puis pour le reste (« sors tout des boutons »). Un filtre fermé
  dans un menu ne dit pas ce qu'il filtre sans qu'on l'ouvre.
- ⚠️ **Tous au même gabarit, celui du `Segmented`** (le mainteneur : « ce serait
  bien que les boutons aient tous la même tête ») : à la souris, les barres
  de sets et d'emplacements prennent le cadre `panel2` de 32 px, des cases de
  26 px et le marqueur du `Segmented` (sans contour ; un aplat de braise
  depuis le rebranding, décision 19 — fond d'accent doux avant),
  comme le filtre des antiques voisin —
  [gabaritFiltre.ts](../../../../src/components/account/gabaritFiltre.ts).
  « Effacer les filtres » est à la même hauteur (32 px), et les antiques
  reçoivent l'intitulé « Runes », comme leurs voisins « Sets » et « Slot »
  (c'est celui que leur donne déjà l'Optimisation). Avant, trois gabarits
  cohabitaient : barres de 38 px au fond `panel` et cases cerclées d'accent,
  `Segmented` de 32 px, bouton de 28 px.
- **Le symbole d'un set** est doré (`runeSetIconFilter`, `effects.ts`),
  éclairci quand le set est actif — sauf **à la souris** : posé sur l'aplat
  de braise, il garde le doré du repos (éclairci sur l'orange plein, le
  contraste agressait l'œil). Au doigt, l'actif garde un fond doux et le doré
  éclairci.
- « Effacer les filtres » remet tous les sets, tous les emplacements et
  toutes les runes. Il est **toujours affiché**, désactivé quand rien n'est
  filtré (« Aucun filtre posé »).
- L'Optimisation n'a que Set et Emplacement : ses antiques vivent dans ses
  options, avec « Faisable avec ma réserve ».
- **Au doigt, rien ne change** (lot 11) : la Liste garde ses rangées dans le
  panneau « Options » ; les Courbes et l'Optimisation, dans la page.

⚠️ **Règle d'interface : un filtre de set affiche l'icône du jeu, SANS le nom.**
Partout dans l'appli. Les icônes sont reconnues d'un coup d'œil par n'importe
quel joueur, alors qu'une rangée de libellés fait un mur de texte et réduit le
nombre de sets visibles sans défilement. Le nom reste en `title` et en
`aria-label`, donc rien n'est perdu pour l'accessibilité.

- ⚠️ **Symboles colorisés en OR.** Les icônes du jeu sont multicolores :
  alignées par vingt-cinq elles font une rangée bruyante où rien ne ressort.
  Ramenées à une seule teinte, la barre se lit comme une frise et **seul l'état
  actif se détache** (or plus clair).
  - ⚠️ **Par un FILTRE CSS, pas par un masque.** Masquer l'alpha du PNG
    (`tintColor` de [RuneIcon](src/components/RuneIcon.tsx)) remplit le glyphe
    d'aplat : tout le relief interne disparaît et l'icône **paraît floue** à
    18 px. Le filtre conserve la luminance d'origine, donc le dessin reste net.
    Même technique que `RARITY_FILTER` ([effects.ts](src/lib/effects.ts)).
- Rendu en **une seule barre continue** (conteneur bordé, icônes serrées),
  et non en boutons détachés : les symboles se lisent comme une rangée
  d'icônes du jeu, et l'ensemble tient sur une ligne même avec 25 sets. Seul
  l'**état actif** porte un cadre ; l'inactif est simplement atténué.
- ⚠️ **Liste BLANCHE, tout coché par défaut.** Un set coché est un set
  **affiché** ; à l'ouverture, tous les présents le sont (tout est montré), et
  n'en cocher **aucun** revient à **ne rien vouloir voir** (liste vide). C'est la
  même logique partout dans l'app. (Avant : « aucun coché = aucun filtre » —
  l'inverse.)
- **Seuls les sets réellement présents** dans l'inventaire sont proposés : un
  filtre qui ne peut rien renvoyer n'aide personne. ⚠️ En **Comparaison**, les
  sets d'un compte d'ami importé **rejoignent la sélection** : sans ça, un set
  qu'il possède et pas moi serait masqué d'emblée et sa courbe faussée.
- Bascule **« Tous »** : sélectionne tous les sets présents, ou les
  déselectionne tous d'un coup (indispensable à vingt-cinq sets). **Tuile EN
  TÊTE de la même grille**, au même gabarit que les pastilles de set — comme la
  case « Tous » du jeu — et non un bouton texte greffé à côté de la barre.
  Icône `Layers` (lucide), pas de nom de set possible pour ce rôle.
- ⚠️ **Au doigt (`pointer: coarse`), les symboles passent de 18 à 24 px** et leur
  case de 28 à 36 px : 28 px se visaient mal du pouce. À la souris, inchangé.

### Filtrer par slot — `SlotFilter`

[SlotFilter.tsx](src/components/account/SlotFilter.tsx), même grammaire visuelle
que `SetFilter` (hauteur 32 px, même bordure) pour que les deux se lisent comme
une seule barre. **Même logique de liste blanche** : les six slots cochés par
défaut, aucun coché = rien affiché.

- ⚠️ **Pas de bouton « Tout / Rien ».** Six cases se cochent d'un geste ; le
  raccourci n'y gagnait rien, là où il est utile côté SETS (vingt-cinq).
- Différence assumée : les **six slots sont toujours proposés**, alors que les
  sets se limitent à ceux présents. Un slot sans rune reste une information utile
  (« je n'ai rien en 2 »), là où un set absent n'est qu'un bouton mort.

### ⚠️ Dans le panneau « Options » (mobile), les filtres prennent toute la largeur

Le bloc de filtres est le **même** qu'au desktop (rendu une fois, posé à deux
endroits selon la largeur). Dans le panneau, il s'étire pour occuper toute la
largeur, comme les autres popups — au lieu de rester compact, aligné à gauche :
les **six emplacements se répartissent** sur la ligne (`SlotFilter`), les **cases
de propriété** remplissent la largeur (une par ligne en mode 2, **grille 2×2** en
mode 4), et le **tri** occupe toute la largeur. Ciblé par `data-filtres-runes`
sous `[data-tiroir]` (voir index.css) ; le desktop garde ses contrôles à la
largeur de leur contenu.
