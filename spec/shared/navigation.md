# Navigation — barre latérale, barre supérieure et onglets mobiles

> ⚠️ La navigation est l'endroit où les **deux formats** divergent le plus :
> barre latérale sur bureau, barre d'onglets et panneau montant sur mobile. Voir
> [deux-applications.md](deux-applications.md) pour la règle de cadre.

Depuis la refonte UI, la navigation repose sur trois pièces :
une **barre latérale** (au-dessus de `lg`), une **barre supérieure** fixe, et
une **barre d'onglets en bas** (sous `lg`).

Fichiers : [Sidebar.tsx](src/components/Sidebar.tsx),
[TopBar.tsx](src/components/TopBar.tsx),
[MobileTabs.tsx](src/components/MobileTabs.tsx),
[SidebarSearch.tsx](src/components/SidebarSearch.tsx),
[SidebarCompte.tsx](src/components/SidebarCompte.tsx), assemblés dans
[App.tsx](src/App.tsx).

## Pourquoi une barre latérale

L'ancienne navigation était une **rangée horizontale** avec deux menus
déroulants (« Mon compte », « Ressources ») et un bouton hamburger de repli.

- ⚠️ **Le problème n'était pas esthétique : la rangée ne tenait plus.** Neuf
  destinations, dont **six enfouies** derrière les deux menus — qu'il fallait
  ouvrir pour savoir ce qu'ils contenaient.
- ⚠️ **Un intitulé de groupe n'est PAS un lien.** « Ressources » annonce ce qui
  suit, il ne mène nulle part. Le menu déroulant confondait les deux.
- La **mécanique de mesure** de l'ancienne barre a disparu avec elle : trois
  `ref`, un `ResizeObserver` et un `useLayoutEffect` décidaient quand replier la
  rangée en hamburger. Une barre verticale ne déborde pas.

### ⚠️ L'ordre d'importance ne change pas

**Accueil → RTA → Siège → Mon compte → Outils → Arène**, puis les ressources.
C'est celui de [README.md](README.md), issu de l'usage : la refonte change la
**forme** de la navigation, pas la hiérarchie.

## ⚠️ La barre navigue SEULE

**La page ne change qu'au choix d'une destination.** C'est la règle qui
gouverne les deux gestes de navigation interne :

- **Ouvrir une section** (Siège, Mon compte, Outils) affiche ses sous-sections
  et **ne charge rien**. Cliquer « Siège » ouvrait la page de siège *et* le
  second niveau d'un coup, alors qu'on n'avait pas encore choisi entre Défense,
  Offense et Recommandations.
- **Remonter** (« ‹ Siège » en tête du second niveau) réaffiche la liste des
  sections et **ne quitte pas l'écran**. Le retour pointait vers `#/` : on
  perdait sa page pour consulter un menu.
- **Le logo** remet la barre au premier niveau *en plus* de ramener à l'accueil.
  Il change la route, donc l'état se repose de lui-même — sauf si on était
  **déjà** sur l'accueil avec une section ouverte à la main : la route ne
  changeait pas, et la barre restait au second niveau.

Ouvrir et remonter sont donc des **`<button>`**, pas des `<a>` : ils ne vont
nulle part, ils n'ont rien à faire dans l'historique ni dans un « ouvrir dans un
nouvel onglet ». Le type l'impose — `hash` **ou** `ouvre`, jamais les deux.

⚠️ **`w-full` sur l'entrée** : un `<button>` ne s'étire pas comme un `<a>`. Sans
lui, les trois entrées à sous-section étaient larges comme leur texte et leur
fond au survol s'arrêtait au milieu de la barre.

### L'entrée active — contour + fond, le marqueur unique de l'app

⚠️ **`border-ctx bg-ctx-soft`**, comme toute pastille de l'app
([design.md](design.md)) : le **contour porte l'état**, le fond ne fait que
l'appuyer.

- ⚠️ **Le contour n'est pas décoratif.** L'entrée n'a longtemps porté que
  `bg-ctx-soft` — exactement le cas que la règle décrit : *un fond de panneau
  trop proche du gris ambiant, qui ne se voit pas*. Au second niveau, où toutes
  les entrées sont des vues d'un même inventaire (Runes → Résumé, Liste,
  Courbes…), **on ne savait plus laquelle on lisait**.
- ⚠️ Le contour vit sur le **calque en `absolute`**, pas sur l'entrée elle-même :
  posé sur elle, il décalerait l'icône et le libellé de 1 px au changement de
  page — un clic déplacerait ce qu'on vient de cliquer.
- ⚠️ **L'icône ne se teinte plus.** Elle portait `text-ctx` sur l'entrée active :
  avec le contour, cela faisait un **troisième signal** pour dire la même chose.
  Elle suit l'encre du libellé, qui passe à `ink`.
- Le **survol** est un calque distinct rendu **dessous** : une entrée déjà
  sélectionnée ne change pas d'aspect quand la souris la traverse.

### L'état de la barre : trois valeurs, pas deux

| Valeur | Sens |
|--------|------|
| `undefined` | Suivre la route — l'état initial et celui de chaque changement de page |
| `null` | Premier niveau, après un retour |
| le **titre** d'une section | Ouverte à la main |

⚠️ Changer de page **repose** l'état sur `undefined` : arriver sur
`#/siege/offense` doit montrer les sous-sections du Siège, même si on avait
remonté ailleurs juste avant.

⚠️ **C'est le TITRE qui est mémorisé, jamais l'objet section.** L'objet y était
stocké tel quel, donc **figé à l'instant du clic**, avec les `actif` calculés à
ce moment-là. Or la remise à zéro ci-dessus ne se déclenche qu'au changement de
*section* : en naviguant de « Liste » à « Courbes », on reste dans « Mon
compte », elle ne se déclenchait donc pas et la barre continuait d'afficher
l'ancien objet — **le surlignage ne suivait la navigation qu'après un
aller-retour au premier niveau**. Le titre, lui, est ré-résolu à chaque rendu
sur les `groupes` reçus, que l'appelant reconstruit à chaque changement de page.

## Trois niveaux — « Mon compte »

Le second niveau porte des **groupes**, pas une liste plate :

```
‹ Mon compte
─────────────
MONSTRES     → Ma box
RUNES        → Résumé · Liste · Courbes · Comparaison · Optimisation · Meules · Gemmes
ARTÉFACTS    → Résumé · Liste
```

- ⚠️ **Onze destinations, dont huit étaient cachées.** Les vues (Résumé,
  Courbes, Comparaison…) vivaient dans une rangée d'onglets en haut de page,
  invisible tant qu'on n'était pas déjà sur la bonne page.
- ⚠️ **Les vues sont passées dans l'URL** (`#/compte/runes/courbes`). Elles
  vivaient dans un `useStickyState` local, ce qui les rendait impossibles à
  porter dans la barre : rien n'aurait dit laquelle est active, et un lien
  direct n'existait pas.
- ⚠️ **Une source unique** ([accountViews.ts](src/lib/accountViews.ts)) partagée
  par la barre, les onglets mobiles et les sections. Chaque section portait sa
  propre liste d'onglets ; les remonter sans les unifier aurait fait deux listes
  à tenir d'accord.
- ⚠️ **`vueValide`** gère le changement d'inventaire : passer des Runes (sur
  « Courbes ») aux Artéfacts, qui n'en ont pas, laissait un écran blanc.
- Le nom de l'inventaire est un **titre de groupe**, comme « Ressources » : il
  annonce, il ne mène nulle part. C'est la vue qu'on choisit.

### ⚠️ Un filet entre les groupes

Les onze entrées se suivaient en trois blocs que seule une marge distinguait :
à cette densité, l'œil ne voyait qu'une longue liste. Le filet n'apparaît qu'à
partir du **deuxième** groupe — en tête, il séparerait le premier de rien.

Repliée, le filet **remplace** l'intitulé : « Artéfacts » n'a pas de version en
trois lettres qui veuille dire quelque chose.

## Repli — deux états, jamais trois

- La **largeur s'anime** (224 → 56 px), pas un `translateX` : la barre se replie
  **sur elle-même** et rend sa place au contenu, dont la marge suit à la même
  courbe.
- ⚠️ **Pas de déploiement au survol.** Il a été essayé et retiré : la barre
  devenait incohérente avec elle-même — repliée dans le Siège on voyait les
  icônes des *sections*, au survol elle basculait sur les *sous-sections*, donc
  d'autres icônes aux mêmes places. Le contenu changeait sous le curseur.
- Repliée, les libellés cèdent la place aux `title` : neuf icônes ne se
  distinguent pas toutes au premier regard.
- Le repli tient pour la **session** (`useStickyState`), sans être persisté :
  une préférence d'affichage ne justifie pas de passer par le consentement de
  conservation — même règle que [MobileNotice](src/components/MobileNotice.tsx).

## Recherche de navigation

Un champ en tête de la barre, `⌘K` depuis n'importe où.

- ⚠️ **Elle ne cherche QUE des destinations** — les quinze de l'app,
  sous-sections comprises. Pas les monstres : c'est le rôle du Bestiaire et de
  la box, qui ont leurs filtres. Un champ répondant aux deux obligerait à trier
  du regard deux natures de résultats.
- ⚠️ **Dérivée des mêmes constantes que la barre**, pas ressaisie : une seconde
  liste aurait divergé au premier écran ajouté, et le manque serait passé
  inaperçu — on ne cherche pas ce dont on ignore l'existence.
- La navigation au clavier vient de `useComboboxNav`, comme toute barre à
  suggestions — voir [recherche-clavier.md](recherche-clavier.md).
- Comparaison **insensible aux accents** : « arene » doit trouver « Arène ».
- ⚠️ Un **chevron vers la droite**, pas un badge « ⌘K » : le badge annonçait un
  raccourci qu'on lit une fois puis qu'on n'utilise plus, tout en occupant le
  champ en permanence. Vers la droite et non vers le bas — ce champ mène à une
  **page**, il n'ouvre pas un panneau.

## Barre supérieure

Trois zones : l'identité à gauche, **où l'on est** au centre, ce qui **sort** à
droite.

⚠️ **Le contenu de la zone droite diffère selon le format** — c'est l'un des
endroits où les deux se séparent (voir
[deux-applications.md](deux-applications.md)) :

| | Zone droite |
|---|---|
| **Bureau** | « Se déconnecter » seule |
| **Mobile** | ⚙ **Paramètres** seul |

- ⚠️ **Un seul bouton de chaque côté, et ce n'est pas le même.** Sur bureau, le
  ⚙ a été retiré : le **pied de la barre latérale** en porte déjà un, à côté du
  nom du compte et de l'import (`SidebarCompte`). Deux chemins vers le même
  écran, à 60 px l'un de l'autre, se lisent comme deux réglages différents — et
  c'est dans le bloc compte que celui-ci a sa place.
- ⚠️ Sur mobile, à l'inverse, le ⚙ est le **seul accès** aux paramètres : il n'y
  a pas de barre latérale, et aucun des cinq onglets n'y mène. C'est donc la
  déconnexion qui descend, pas lui.

- ⚠️ Sur **mobile**, trois cibles dans 48 px de haut, à côté d'un titre centré
  en absolu, ne laissaient à chacune ni la place ni la marge d'erreur qu'un
  doigt réclame — et le bouton ⚙ chevauchait « RTA ». L'import descend dans les
  paramètres, où il côtoie l'état du compte ; la déconnexion aussi, où elle
  côtoie le réglage de conservation. Le titre porte en outre des marges qui
  réservent leur place au bouton restant.
- ⚠️ Sur **bureau**, la déconnexion reste ici : c'est la zone qui porte ce qui
  sort, et la largeur y suffit largement. La descendre n'aurait rien réglé
  là-bas — le problème tenait aux 348 px d'un téléphone, pas au geste lui-même.
- ⚠️ **Un seul chemin de purge** : ce bouton déclenche le même geste que
  « Effacer mes données » des paramètres. Deux chemins auraient divergé à la
  première garde ajoutée (le dialogue de conservation, par exemple).

- ⚠️ **Elle COMMENCE après la barre latérale**, elle ne la surplombe pas
  (`z-20` contre `z-30`). La barre latérale est la navigation principale : la
  couper d'un bandeau horizontal la ferait passer pour un panneau secondaire.
- ⚠️ Le titre est **centré en absolu**, pas dans le flux : centré par la
  disposition, il se serait décalé dès que la zone de droite change de largeur.
  Un repère qui bouge n'en est plus un.
- ⚠️ **Fond opaque, pas de flou** : le contenu qu'on devinait derrière ne disait
  rien d'utile et brouillait le titre par transparence.
- Le titre et son icône sont **dérivés** des constantes de navigation — jamais
  une table de libellés en plus, qui aurait divergé au premier renommage.
- ⚠️ **Le titre nomme la SOUS-SECTION courante** quand la section en a, pas le
  nom de la section : l'**inventaire** sur « Mon compte » (Monstres / Runes /
  Artéfacts), la **vue** sur le « Siège » (Défense / Offense / Recommandations).
  Répéter « Mon compte » ou « Siège » faisait **doublon avec la navigation** —
  l'onglet de la barre du bas au doigt, l'en-tête de section de la barre latérale
  à la souris. Nommer la sous-section apprend **où l'on est** au lieu de répéter
  le niveau au-dessus. (Outils n'a qu'une sous-section pour l'instant —
  même règle le moment venu.)
- ⚠️ `PageHeader` a disparu avec elle : chaque page portait son titre, et les
  garder aurait fait deux fois le même à 60 px d'écart.

## Barre d'onglets — sous `lg`

- ⚠️ **En bas, pas en haut.** Sur un téléphone tenu à une main, le haut de
  l'écran est hors d'atteinte du pouce. C'est aussi ce que fait le système, donc
  le geste est déjà acquis.
- ⚠️ **Cinq entrées au maximum.** Au-delà, les cibles passent sous 44 px de
  large et on tape à côté. L'app en compte neuf : les cinq principales sont
  visibles. Ce n'est pas un choix esthétique — c'est ce que la largeur d'un
  pouce autorise.
- ⚠️ **`env(safe-area-inset-bottom)`** : sans lui, la barre passe sous la barre
  de geste des iPhone récents et le dernier onglet devient intouchable.

### ⚠️ Un onglet à sous-sections les FAIT CHOISIR — [MobileNavSheet.tsx](src/components/MobileNavSheet.tsx)

**Toucher « Siège » ou « Compte » n'ouvre pas une page : ça ouvre un panneau où
l'on choisit la sous-section.** C'est la règle « la barre navigue SEULE » portée
au tactile — on choisit d'abord **où**, la page ne change qu'ensuite.

Avant, chaque page à sous-sections portait **ses propres rangées d'onglets** sous
`lg` (`lg:hidden`) :

- « Compte » menait droit à l'inventaire de monstres, et ses **dix autres vues**
  n'étaient atteignables que par **deux rangées** posées en haut de la page —
  onze destinations empilées avant le premier résultat, et **invisibles tant
  qu'on n'était pas déjà sur la page**. « Siège » ouvrait la Défense, ses deux
  autres vues idem.
- Ces rangées étaient écrites **page par page**, chacune avec son rendu : deux
  jeux de contrôles à tenir d'accord avec la barre latérale.

Le panneau les remplace toutes.

#### ⚠️ DEUX TEMPS quand la section a des groupes

Sur « Mon compte », on choisit **l'inventaire** (Monstres · Runes · Artéfacts),
**puis** sa vue.

Les dix destinations ont d'abord été posées **à plat**, groupes et intitulés
compris — c'est la liste de la barre latérale, qui tient sur un écran de bureau
de 900 px de haut et **pas** dans un panneau qui s'arrête au tiers de l'écran.
On y défilait pour trouver, alors que les trois inventaires suffisent à
s'orienter.

- ⚠️ **Un seul temps quand il n'y a rien à trancher.** « Siège » n'a qu'un
  groupe, sans intitulé : ses trois vues s'affichent directement. Faire choisir
  un groupe unique ajoute un geste sans rien donner à décider — la même règle qui
  laisse « Outils » en simple lien dans la barre d'onglets.
- ⚠️ **Un groupe à VUE UNIQUE mène directement à elle.** « Monstres » n'a que
  « Ma box » : il devient un lien, sans chevron. Il garde le libellé du
  **groupe** — c'est la liste des inventaires qu'on lit, et « Ma box » n'y aurait
  pas le même sens que ses deux voisins.
- Le **titre du panneau suit le temps** où l'on est (« Mon compte », puis
  « Runes ») : c'est la seule chose qui dise ce qu'on est en train de choisir. Le
  retour, en tête du second temps, ramène au premier **sans refermer**.
- Le **groupe courant porte le marqueur d'état**, comme les destinations : sans
  lui, le premier temps ne disait pas dans quel inventaire on se trouve déjà.
- On repart **toujours du premier temps** à l'ouverture. Rouvrir « Compte » sur
  les vues de Runes parce qu'on y était la fois d'avant ferait apparaître une
  liste dont le titre ne dit pas d'où elle sort.
- ⚠️ La hauteur du panneau est **re-mesurée au changement de temps**
  (`mesureCle`). Elle est figée à l'ouverture pour qu'un dépliage interne ne
  fasse pas remonter ce qu'on vient de toucher ; mais ici tout le contenu est
  **remplacé** — figée sur les trois inventaires, la liste des sept vues se
  serait lue en défilant dans une fenêtre trois fois trop courte. Ce n'est pas
  un dépliage : rien de ce qu'on vient de toucher n'est encore là.

Le reste :

- ⚠️ **Alimenté par les mêmes `SidebarSection` que la barre latérale**, pas une
  seconde liste — elle aurait divergé au premier écran ajouté, et le manque
  serait passé inaperçu. Même règle que la recherche de navigation.
- ⚠️ **`MobileSheet`, le composant déjà en place**, monté depuis le BAS : son
  déclencheur est un onglet de la barre du bas, et un menu qui surgirait en haut
  obligerait à refaire le lien entre les deux à chaque fois.
- ⚠️ Un onglet qui ouvre une section est un **`<button>`**, pas un `<a>` : il ne
  va nulle part, il n'a rien à faire dans l'historique. Même distinction que la
  barre latérale.
- ⚠️ **« Outils » reste un LIEN** : une seule sous-section. Un panneau pour un
  seul choix ajoute un geste sans rien donner à décider.
- ⚠️ **La barre d'onglets RESTE VISIBLE sous le panneau** — l'inverse du panneau
  d'actions, qui la recouvre à dessein (`z-50` contre son `z-40`) parce qu'elle
  mène ailleurs alors qu'on règle la page où l'on est. Ici le panneau **est** la
  navigation : la masquer retirerait de l'écran la section où l'on se trouve et
  le moyen d'en changer, au moment précis où l'on navigue — et le déclencheur
  qu'on vient de toucher disparaîtrait sous son propre résultat. D'où la
  variante `surLesOnglets` de `MobileSheet` : panneau en `z-[35]`, voile en
  `z-30`, tous deux **sous** les onglets, et le panneau décalé de leur hauteur.
  - ⚠️ **Pas d'`aria-modal` dans cette variante.** L'attribut annonce que tout
    le reste de la page est inerte ; les onglets, eux, restent cliquables — un
    lecteur d'écran aurait masqué la seule chose qu'on laisse délibérément
    visible.
  - La hauteur des onglets vit dans [layout.ts](src/lib/layout.ts), pas dans
    `MobileTabs` : trois pièces la lisent, et la déclarer dans le composant
    forçait `src/ui/` à importer `src/components/` — un **cycle**, puisque
    `MobileTabs` importe déjà la librairie. La librairie est la couche du
    dessous, elle ne connaît pas les écrans.
- ⚠️ **Retoucher l'onglet déjà ouvert REFERME le panneau.** Le geste qui ouvre
  doit pouvoir défaire ce qu'il vient de faire : sans la bascule, on ouvrait
  « Compte » par erreur et il fallait viser la croix ou le voile pour en sortir
  — deux cibles ailleurs sur l'écran, alors que le doigt est encore sur
  l'onglet.
- Le panneau se ferme au **choix d'une destination**, et aussi à tout changement
  de route (retour arrière, lien depuis l'accueil, recherche de navigation) —
  sinon il restait ouvert par-dessus l'écran qu'on vient d'atteindre.
- ⚠️ **Cibles pleine hauteur (44 px)** : c'est une liste qu'on vise du pouce, pas
  une rangée de pastilles serrées. La règle tactile s'y applique sans exception.

⚠️ **Le titre de la barre du haut nomme désormais la VUE** sur « Mon compte »
(« Runes · Liste »), et non plus le seul inventaire : les rangées d'onglets
disaient la vue, et rien d'autre à l'écran ne la disait à leur place. La vue
n'est ajoutée que s'il y a un **choix** — « Monstres · Ma box » répéterait deux
fois la même chose.

### ⚠️ Le responsive était quasi inexistant

Avant cette refonte, **toute l'application comptait 8 occurrences de
breakpoints** et aucune barre de navigation mobile.

La passe qui a suivi a corrigé quatre familles de défauts :

- ⚠️ **`minmax(360px, 1fr)` déborde** sur 348 px utiles : une colonne ne peut
  pas descendre sous son minimum. `minmax(min(360px, 100%), 1fr)` prend la plus
  petite des deux — le minimum voulu, ou toute la largeur.
- ⚠️ **L'ordre de tour DÉFILE** au lieu de passer à la ligne. C'est une
  *séquence* : replié sur trois rangées, on ne lit plus qui joue avant qui —
  précisément l'information de cet écran.
- ⚠️ **La carte de build s'empile** sous `sm` : table de stats, artéfacts et
  roue de runes tiennent sur une ligne à partir de 360 px de carte, pas en
  dessous.
- ⚠️ **Les popovers ancrés à droite** ont besoin d'un `max-w-[calc(100vw-2rem)]` :
  `min-w` seul ne borne rien, et le menu sortait de l'écran.

⚠️ **`overflow-x: hidden` sur le `body` n'est PAS une correction** : il masque
le débordement au lieu de le résoudre, et rend le contenu coupé inatteignable.
Il reste comme garde-fou de dernier recours, jamais comme réponse.

## Accent contextuel — `--ctx`

L'idée directrice de la refonte : **l'élément du monstre consulté teinte
l'écran**. On sait de quel monstre on parle avant d'avoir lu son nom.

```css
--ctx: var(--accent);        /* par défaut : l'accent de l'app */
[data-ctx='water'] { --ctx: var(--el-water); }
```

- ⚠️ **`--ctx` est un ALIAS, jamais une couleur.** Il pointe vers un token qui
  existe déjà — un élément, ou l'accent de l'app. Chaque teinte reste donc celle
  dont le contraste a été **mesuré** (voir [design.md](design.md#contraste)).
- ⚠️ **Valable dans les deux thèmes du seul fait qu'il est un alias** : sa cible
  change avec le thème, lui n'a pas à le savoir.
- L'attribut **`data-ctx`** se pose sur un conteneur ; toute sa sous-arborescence
  prend la teinte. Un composant n'a **rien à connaître** de l'élément courant :
  il écrit `text-ctx` ou `bg-ctx-soft`.
- Exposé à Tailwind : `bg-ctx`, `text-ctx`, `border-ctx`, `bg-ctx-soft`.

### Fonds doux par élément

`--el-*-soft` complète les six couleurs d'élément : la teinte **fondue dans la
surface**, exactement comme `--accent-soft` l'est pour l'accent. Ce sont des
**fonds**, jamais du texte.

⚠️ Comme tous les tokens, ils sont déclarés dans les **deux** blocs de thème
(media query *et* `[data-theme]`). Le fichier rappelle qu'une divergence est
déjà survenue entre ces deux blocs.

### Où il s'applique

- La **fiche d'un monstre** le pose à l'élément affiché — et le suit quand on
  bascule de forme sur un transformable.
- La **barre latérale** porte un liseré vertical à cette teinte, et l'entrée
  active un fond `ctx-soft`.

⚠️ **La pastille de lead ne suit PAS** ([LeadPill.tsx](src/components/siege/LeadPill.tsx)) :
elle reste dorée, y compris dans la fiche. Partagée avec le siège où aucun
élément ne fait contexte, la teinter ici la ferait diverger d'un écran à l'autre
pour la même donnée.

## Animation

Framer Motion, déjà présent — pas de keyframes écrites à la main.

- **Glissement entre niveaux** : on entre par la droite, on ressort par la
  gauche, comme on tourne une page. 8 px, 180 ms : la liste doit sembler
  *glisser*, pas voler à travers l'écran.
- ⚠️ **Pas de `mode="wait"`.** Essayé et retiré : le niveau sortant devait finir
  avant que l'entrant commence, mais une navigation rapide interrompait la
  sortie et l'entrant ne montait jamais — **la barre restait vide**. Les deux
  niveaux se superposent dans une même cellule de grille.
- ⚠️ **La clé désigne le NIVEAU, pas la section.** Elle a contenu le titre
  (`section:Siège`) : passer d'une section à l'autre changeait la clé alors
  qu'on reste au niveau 2, et deux transitions se chevauchaient.
- ⚠️ **Pas de `layoutId` sur le fond de l'entrée active.** Un fond qui glisse
  d'une ligne à l'autre est joli, mais ce nœud traversait le changement de
  niveau géré par `AnimatePresence` : Framer le déplaçait entre deux parents
  dont l'un se démontait, et **les icônes disparaissaient en naviguant**. Une
  transition d'opacité ne peut pas casser.
- ⚠️ **`MotionConfig reducedMotion="user"`** à la racine
  ([main.tsx](src/main.tsx)) : Framer Motion ne respecte **pas**
  `prefers-reduced-motion` par défaut. Sans cette ligne, chaque animation aurait
  dû le gérer une par une, et la première oubliée serait passée inaperçue.

## ⚠️ Un seul contour au focus

```css
.focus-within\:border-accent :focus-visible,
.focus-within\:border-ctx :focus-visible { outline: none; }
```

Un champ posé dans un cadre qui réagit déjà au focus ne porte **pas** son propre
anneau : on obtenait un contour **dans** un contour, à 2 px l'un de l'autre.
C'est le cadre qui marque le focus, le champ le remplit.

Règle **globale**, pas propre à un composant : elle corrige aussi
[NumberField](src/ui/NumberField.tsx), qui avait le même défaut.

## Nom du compte chargé

Le pied de la barre porte l'avatar et le nom du joueur
(`wizard_info.wizard_name`, voir `parseAccountWizardName`).

- ⚠️ On jongle entre plusieurs exports — le sien, celui d'un ami dont on compare
  les runes — et rien ne disait lequel était affiché. Une date d'import ne
  suffit pas : deux comptes importés le même jour se ressemblent.
- ⚠️ **L'avatar est une INITIALE, pas une image** : l'export SWEX ne porte
  aucune photo de profil. Une initiale distingue deux comptes d'un coup d'œil
  sans rien inventer, là où un pictogramme générique serait le même pour tous.
- ⚠️ Le champ `wizardName` du stockage est **facultatif** : le rendre
  obligatoire aurait imposé d'incrémenter `ACCOUNT_SCHEMA`, donc de **rejeter
  tous les comptes déjà conservés** — un réimport forcé pour un simple libellé.
- ⚠️ **Le nom seulement, jamais `wizard_id`** : c'est un numéro de compte, il
  n'apprend rien à qui lit son propre écran.

## Page Paramètres

`#/parametres` — la **même liste** (`SettingsList`) que le popover ⚙, pas une
copie : deux listes auraient divergé au premier réglage ajouté, et personne ne
s'en serait aperçu puisqu'on n'ouvre jamais les deux à la fois.

- ⚠️ **Colonne centrée (620 px)**, contrairement aux autres pages : ce sont des
  lignes « intitulé / contrôle ». Alignées à gauche sur toute la largeur, l'œil
  devait traverser le vide pour relier les deux.
- Le popover reste le geste rapide ; la page est là pour s'y attarder — deux de
  ses réglages portent trois lignes d'explication, illisibles dans 260 px.

## Largeur du contenu

⚠️ **Plus de plafond à 1180 px.** Il datait de la navigation horizontale : le
contenu était centré sous une barre elle-même centrée. Avec une barre latérale,
la page commence à son bord droit et va jusqu'au bout — les grilles de monstres,
les tableaux de runes et l'optimiseur y gagnent une à deux colonnes.

**Trois exceptions**, bornées volontairement :

| Page | Largeur | Pourquoi |
|------|---------|----------|
| Mécaniques | 1100 px | Texte suivi — une ligne de 2 000 px se lit mal, l'œil perd le début de la suivante |
| Nouveautés | 900 px | Liste de textes courts lus de haut en bas |
| Paramètres | 620 px | Lignes « intitulé / contrôle » |
| Optimiseur | 768 px | Suite de réglages lus de haut en bas — étalée, chaque ligne « libellé … champ » devenait un aller-retour du regard |
| Roue de runes | ×0,72 sous `sm` | ⚠️ C'est un DESSIN calculé en pixels (cadres, icônes de set, décalages) : il ne se réduit pas seul comme une image. À 208 px il occupait plus de la moitié des 348 px utiles. En dessous de 0,72 les icônes de set passent sous 14 px et le set ne se reconnaît plus |
| Emplacements d'artéfacts | ×0,72 sous `sm` | **La même échelle que la roue**, et ce n'est pas un hasard : les deux se lisent côte à côte, les réduire inégalement les désaccorderait. 58 px → 42 |

⚠️ **Artéfacts, roue et relique tiennent sur UNE ligne** sous `sm` — ce sont les
trois faces d'un même équipement, et séparés on perd la vue d'ensemble qu'on
vient chercher. Le budget : 42 + 6 + 150 + 6 + 62 ≈ **266 px** sur 348.

C'est le **panneau de stats** qui les en empêchait : à 200 px il occupait plus de
la moitié de la largeur et poussait la roue à la ligne suivante, laissant les
artéfacts seuls à côté de lui — l'équipement se lisait en trois morceaux. Il
passe donc sur sa propre ligne sous `sm`.

⚠️ Pour `RuneWheel` comme pour `ArtifactSlots`, une **`scale` explicite remplace**
l'adaptation mobile, elle ne s'y multiplie pas. La carte de résultat de
l'Optimiseur passe déjà 0,45 pour tenir deux cartes par ligne ; multiplier aurait
donné 0,32, soit une icône de 8 px où l'artéfact ne se reconnaît plus.
| Courbes | 980 px | ⚠️ Le graphe suit son conteneur : sur 2 000 px la courbe s'aplatissait jusqu'à la ligne droite, et les écarts entre runes — la seule chose qu'on vient y lire — disparaissaient |

## Panneau d'actions mobile

Sous `lg`, un bouton **« Options »** flotte **juste au-dessus de la barre
d'onglets**, à droite, et ouvre `MobileSheet` — un panneau qui monte **depuis le
bas** de l'écran.

⚠️ **Ni dans la barre d'onglets, ni dans la barre du haut.**
- *Pas dedans* : la barre est à cinq colonnes, une sixième ferait passer chaque
  cible sous les 44 px que réclame un pouce. Et ce bouton ne mène pas à une
  page — le sortir de la rangée dit qu'il fait autre chose que ses voisins.
- *Pas en haut* : c'était un hamburger à la place du logo. Sur un téléphone tenu
  à une main, le coin haut-gauche est le point le plus éloigné du pouce, pour un
  bouton qu'on ouvre et referme plusieurs fois par écran.

⚠️ Le panneau **monte du bas**, du côté du doigt qui l'a demandé. Le tiroir
glissait de la gauche tant que son déclencheur était en haut à gauche ; le
déclencheur ayant bougé, le mouvement suit — un panneau qui surgit à l'opposé
de son bouton oblige à refaire le lien entre les deux à chaque ouverture.

⚠️ **Un flottant ANCRÉ ne peut pas vivre dans le panneau.** Il défile
(`overflow-y: auto`), donc tout `position: absolute` posé dedans s'y trouve
clippé — on n'en voit qu'une bande. Les formulaires ouverts depuis le panneau
(création d'un monstre, d'une catégorie) passent donc en **panneau de second
niveau** : `MobileSheet centre`, qui recouvre celui d'où il sort.

⚠️ Leur fermeture au clic extérieur doit alors être **désactivée** : le panneau
est monté hors de l'arbre du composant, et tout clic dans le formulaire serait vu
comme extérieur. C'est le voile du panneau qui ferme.

⚠️ **Il s'ouvre à la hauteur de son CONTENU, plafonnée à 80 %** (`max-h-[80dvh]`),
jamais plein écran : la bande de page visible en haut dit qu'on est toujours sur
cette page et qu'un appui hors du panneau le referme ; plein écran, il devient
indiscernable d'un changement de page. Un contenu court ne laisse pas de vide
sous lui ; au-delà de 80 %, le corps défile.
- **Hauteur mesurée puis FIGÉE à l'ouverture** : le panneau est collé en bas et
  ne peut grandir que vers le haut. Sans figer, déplier quelque chose (une
  catégorie, une 4ᵉ propriété) ferait remonter d'un coup ce qu'on vient de
  toucher — l'app l'interdit (voir [design.md](design.md)). On mesure à
  l'ouverture (bornée par le plafond), on fige, et un contenu qui grandit ensuite
  se lit en défilant.
- Le panneau de **second niveau** (`centre`) reste à la taille de son formulaire,
  même plafond.

Il reçoit les **filtres et les actions** de la page, ceux qui occupaient trois
ou quatre rangées avant la première donnée. Ce qui y entre et ce qui reste :

| Écran | Reste visible | Passe dans le panneau |
|-------|---------------|----------------------|
| RTA | Recherche, compteur, grille des équipes | Création de monstre, sauvegarde/reprise/réinitialisation, export/import/consultation, catégories, tout effacer |
| Siège (défense / offense) | Le compteur d'équipes | Ajouter une équipe, vérifier les ticks, créer un monstre, tout effacer |
| Siège → Recommandations | — | Créer, importer, tout exporter, tout effacer |
| Bestiaire | La recherche | `FilterBar` (élément, étoiles, tri) |
| Mon compte → Monstres | Recherche et tri | Élément, étoiles, doublons, 2A |
| Mon compte → Runes → Liste | Le compteur et la pagination | Sets, slots, antiques, propriété secondaire, tri |
| Mon compte → Artéfacts → Liste | Le compteur et la pagination | Catégorie, sous-filtre, stat principale, propriétés |

⚠️ **Le bouton dépend de l'ÉCRAN, pas de la page** (`pageAPanneau` dans
`App.tsx`). Sur « Mon compte », seules les vues en *liste* ont des filtres : le
résumé, les courbes et la comparaison n'en ont aucun, et le bouton n'y apparaît
pas. Une condition sur la seule route aurait ouvert un panneau vide sur trois
vues de sept.

⚠️ **Le panneau se referme aussi sur `accountSub`, `accountView` et
`siegeTab`**, pas seulement sur la route. Ce sont des écrans à part entière,
chacun avec ses filtres — rester ouvert en passant des runes aux artéfacts
aurait montré les contrôles du précédent.

⚠️ **« Tout effacer » reste détaché** des autres actions, sous un séparateur, et
**centré** — pas aligné à gauche comme la colonne au-dessus. Il n'appartient pas
à leur liste : centré, il se lit comme une sortie de secours plutôt que comme une
action de plus, et rien ne se trouve à côté de lui qu'on pourrait toucher à sa
place. Dans la page il se pose à l'opposé (`ml-auto`) ; dans le panneau il garde
cette distance. Un bouton destructeur ne se met pas au contact de celui qu'on presse
en boucle.

### Une rangée par type d'action

⚠️ **Les boutons du panneau se groupent par NATURE, une rangée chacune** — ils
ne forment pas une colonne unique. Sur la prépa RTA :

| Rangée | Ce qu'elle fait |
|--------|-----------------|
| Création | Créer un monstre |
| État courant | Sauvegarder · Reprendre · Réinitialiser |
| Échange de fichier | Exporter · Importer · Ami |
| Organisation | Catégories |
| *(détaché)* | Tout effacer |

Empilés en une seule colonne, six boutons de nature différente se lisaient comme
une liste indifférenciée où il fallait relire chaque libellé. Groupés, on vise
la bonne rangée d'abord et le bon bouton ensuite.

⚠️ Le séparateur vertical qui distinguait ces groupes **dans la page** a disparu
au profit d'un saut de rangée : il passait inaperçu dès que la barre se repliait,
ce qu'elle fait sur tout écran étroit.

⚠️ **Chaque rangée est une GRILLE** (`data-rangee-actions`), pas une file qui se
replie. En `flex-wrap`, chaque bouton prenait la largeur de son texte :
« Sauvegarder » et « Ami » finissaient côte à côte à des tailles différentes, et
la dernière ligne restait à moitié vide. En grille, tous font la même taille et
s'alignent verticalement d'une rangée à l'autre — c'est ce qui rend le
groupement par type lisible d'un coup d'œil.

- ⚠️ **`height: 100%` sur un bouton de grille EXPLOSE la mise en page.** Il
  paraît la bonne réponse pour égaliser les cellules ; comme les rangées sont en
  `display: contents`, il n'y a aucune ligne dont hériter et le pourcentage
  s'étire sans borne — un bouton par écran. Une `min-height` écrite les égalise
  sans dépendre de rien.
- ⚠️ **Les conteneurs intermédiaires s'effacent aussi** (`data-passe-grille`) :
  `RtaBackupBar` empile ses rangées dans un `div` de marge, qui restait sinon
  l'enfant unique de la grille et absorbait à lui seul une cellule. Marqué,
  jamais déduit d'une structure — une règle sur « tout div intermédiaire »
  effacerait aussi ceux qu'on ajoutera demain pour une autre raison.
- ⚠️ La **création de monstre est seule sur sa ligne**, hors de la grille : elle
  ne relève pas du même geste que les six autres, qui échangent ou figent un
  fichier de prépa. Mais elle garde leur **taille exacte** — un tiers de largeur,
  même hauteur : un bouton d'action n'a pas de raison de peser plus qu'un autre,
  et pleine largeur il redevenait le plus gros du panneau. Sa ligne reste donc
  aux deux tiers vide, ce qui dit justement qu'il n'appartient pas au groupe en
  dessous.
- **Les rangées SUCCESSIVES d'un même bloc fusionnent** (`data-grille-actions`) :
  les six boutons de la barre RTA forment une grille unique de six cellules, et
  non deux grilles de trois. Séparées, celle qui perdait son bouton conditionnel
  (« Réinitialiser », absent tant qu'aucun compte n'a été importé) étirait sa
  dernière cellule et plus rien ne s'alignait d'une rangée à l'autre.
- **Trois colonnes fixes, identiques pour toutes les rangées.** Un
  `grid-auto-flow: column` faisait calculer à chaque rangée ses propres
  colonnes : deux boutons s'étalaient en moitiés, trois en tiers, et rien ne
  s'alignait d'une ligne à l'autre — le contraire d'une grille.
- Une rangée incomplète laisse donc une **cellule vide en bout de ligne**, et
  c'est voulu : l'alignement des colonnes vaut mieux qu'un remplissage qui
  décale tout. Les boutons conditionnels (« Réinitialiser » sans import de
  compte) manquent à la fin, là où leur absence ne déplace rien.
- Ciblé par un **attribut**, jamais par la forme du conteneur. Un sélecteur sur
  `.flex-wrap` aurait attrapé les rangées de **pastilles** — six éléments du jeu,
  cinq niveaux d'étoiles — et les aurait forcées à trois par ligne, soit deux
  lignes au lieu d'une : l'inverse du but.
- Une rangée à **un seul bouton est marquée elle aussi** : il occupe UNE cellule,
  pas toute la largeur. Étiré sur trois colonnes, « Créer un monstre » écrasait
  par sa taille les six boutons en dessous alors qu'il ne vaut pas plus qu'eux.
- Le sélecteur vise aussi les boutons **enveloppés** (`> * > button`) :
  `CreateMonster` place le sien dans un `div.relative` qui ancre son popover.
  Sans cela, c'est le div qui remplissait la cellule et le bouton flottait
  dedans à sa taille propre.

⚠️ **Les intitulés de rangée disparaissent** dans le panneau (`.label`).
« Élément », « Trier par », « Stat principale » coûtent 86 px sur une rangée
desktop de 900 px et nomment ce qui suit ; sur 348 px ils prennent le quart de la
largeur pour un mot que les pastilles disent déjà. Masqués en CSS, pas retirés du
DOM : un lecteur d'écran n'a pas la vue d'ensemble qui rend le mot superflu.

⚠️ **Les libellés longs déclinent une version courte** sous `lg` : un bouton
dispose d'un tiers de 348 px. « Ajouter une équipe » → « Équipe », « Vérifier mes
tick ATB » → « Ticks », « Créer une recommandation » → « Créer », « Consulter
celle d'un ami » → « Ami ». Le sens entier reste dans l'infobulle et dans
`aria-label`, où il ne coûte aucune place. « Créer un monstre » → « Monstre »
suit la même règle. La règle
`[data-tiroir] .hidden.lg\:inline { display: none }` empêche que la révélation
des libellés n'affiche les deux variantes côte à côte.

⚠️ Les **marges hautes** (`mt-4`) des barres d'outils sont annulées dans le
panneau : elles les détachent de ce qui précède *dans la page*, mais s'ajoutent
au `gap-3` du panneau et y creusent le double du vide voulu.

⚠️ **La recherche ne descend jamais dans le panneau.** C'est le geste le plus
fréquent de ces trois écrans ; l'enfouir derrière une ouverture de panneau
coûterait deux gestes là où il y en avait zéro.

⚠️ **Le Siège n'a pas de panneau**, et son bouton « Options » ne s'affiche donc
pas
(`PAGES_AVEC_MENU` dans `App.tsx`). Sa barre d'outils tient en quatre boutons
qui passent déjà à la ligne seuls : les extraire imposerait de découper
`SiegeBoard` sans gagner une hauteur mesurable. **Ouvrir un panneau vide serait
pire que ne rien proposer** — c'est la règle qui décide de l'appartenance à
cette liste, pas la page.

⚠️ Un bouton-bascule (`aria-pressed`) **garde son propre fond** dans le
panneau : la règle qui rend leur cadre aux boutons l'aurait écrasé, et les trois
interrupteurs d'affichage de la prépa RTA s'y affichaient tous éteints quel que
soit le réglage.

⚠️ La règle qui **rend les libellés** dans le panneau ne vise que les `<span>`
**d'un bouton**. Écrite sur `.compact:hidden` tout court, elle révélait aussi ce
qu'un composant masque pour de bonnes raisons — la pastille de rappel du
formulaire de catégorie, par exemple, réapparaissait alors qu'elle y fait
doublon avec la palette. Ce qu'on veut rendre, ce sont les libellés que les
boutons ont laissés tomber faute de place dans la barre.

⚠️ Le panneau porte `data-tiroir` : les libellés masqués par `hidden sm:inline`
y sont **rétablis** (`src/index.css`). Un bouton réduit à son icône a du sens
dans une barre d'outils serrée ; dans un panneau qui a toute la largeur, il ne
dit plus ce qu'il fait.

⚠️ Les filtres sont **un seul JSX**, posé à deux endroits selon la largeur
(`hidden lg:contents` ou `hidden lg:flex` dans la page, et le même fragment dans
le panneau). Deux copies auraient divergé au premier filtre ajouté.

⚠️ Des règles CSS adaptent les contrôles au panneau (`src/index.css`), plutôt
que de les réécrire dans chaque composant :

- **Hauteur à 34 px**, contre les 40 px de la règle tactile générale. Ces 40 px
  valent pour un bouton perdu dans une page, entouré d'autre chose à toucher ;
  dans le panneau les boutons sont seuls et empilés, il n'y a rien à rater
  autour. À 40 px plus leur rembourrage propre, quatre actions remplissaient la
  moitié de l'écran.
- **Pas de `width: 100%`.** Une colonne de barres pleine largeur donnait à
  quatre actions le poids visuel d'un menu principal, alors que le panneau en
  est un accessoire. `align-items: flex-start` suffit : les boutons reprennent
  la largeur de leur texte, alignés au même bord gauche.
- **Rembourrage resserré sur les boutons empilés seulement.** Les pastilles
  d'une rangée sont rondes et calibrées au texte : leur imposer un autre padding
  les déforme en ovales inégaux. Elles gagnent la hauteur, pas la géométrie.
- **Alignement à gauche des boutons empilés.** Un libellé centré dans un bouton
  large flotte au milieu du vide, et l'œil repart chercher le début de chaque
  ligne. **Seulement les empilés** : les pastilles de filtre vivent dans un
  `flex-wrap` et doivent garder leur largeur propre, sinon la rangée devient une
  colonne de six pastilles géantes.
- **`.w-[86px]` libéré** — les intitulés à largeur fixe reprennent leur largeur
  naturelle. Calibrés pour une rangée desktop de 900 px, ils amputaient d'un
  quart le contrôle qu'ils désignent.

⚠️ Le **titre** du panneau est en `text-sm`, pas `text-base` : il rappelle où
l'on est, il n'annonce pas une page. À la taille d'un titre de section, il
pesait autant que les actions qu'il coiffe.

## Densité au doigt

⚠️ **La règle tactile a deux paliers**, pas un seul (`src/index.css`) :

| Cible | Hauteur | Pourquoi |
|-------|---------|----------|
| Autonome (barre, page, panneau) | 40 px | Rater signifie ne rien déclencher |
| Imbriquée dans une carte (`data-carte-dense`) | 32 px | Rater est improbable : le contrôle occupe toute la largeur de sa carte, rien d'autre à toucher sur la ligne |
| Posée sur un coin (`data-cible-fine`) | libre | Agrandie, elle déborde la carte et recouvre le contenu |

⚠️ Le palier unique à 40 px avait un effet qu'on ne voit qu'à l'usage : le
sélecteur de section d'une carte RTA pesait plus lourd que le monstre qu'il
classe, et deux cartes ne tenaient plus dans un écran. **Une règle
d'accessibilité appliquée sans discernement finit par coûter en lisibilité ce
qu'elle gagne en visée.**

Compactage sous `sm`, dans le même esprit :

- **Recherche RTA** — 40 px au lieu de 56 (`py-2 text-sm` contre `py-3.5
  text-base`). C'est le rembourrage décoratif qui tombe, pas la zone touchable.
- **Sections RTA** — `p-2` au lieu de `p-3`. La page en empile trois à six :
  chaque rembourrage se paie autant de fois.
