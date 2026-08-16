# Navigation — barre latérale, barre supérieure et onglets mobiles

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

### L'état de la barre : trois valeurs, pas deux

| Valeur | Sens |
|--------|------|
| `undefined` | Suivre la route — l'état initial et celui de chaque changement de page |
| `null` | Premier niveau, après un retour |
| une section | Ouverte à la main |

⚠️ Changer de page **repose** l'état sur `undefined` : arriver sur
`#/siege/offense` doit montrer les sous-sections du Siège, même si on avait
remonté ailleurs juste avant.

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

Trois zones : l'identité à gauche, **où l'on est** au centre, les
**paramètres** à droite. Et rien de plus.

- ⚠️ Elle a d'abord porté l'**import** et la **déconnexion**. Ni l'un ni l'autre
  n'y avait sa place : ce sont des gestes **rares**, et la barre est ce qu'on
  lit en permanence. Ils vivent dans les paramètres, où l'on va justement quand
  on veut changer quelque chose — l'import y côtoie l'état du compte, la
  suppression des données y côtoie le réglage de conservation.
- ⚠️ Sur mobile, ces trois éléments à gauche poussaient le titre centré en
  absolu **sous** eux : le bouton ⚙ chevauchait « RTA ». Le titre porte
  désormais des marges qui réservent leur place aux boutons.

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
- ⚠️ Les onglets mobiles **naviguent directement**, contrairement à la barre
  latérale : il n'y a pas de second niveau où choisir ensuite.
- Chaque page à sous-sections porte **ses propres onglets** sous `lg`
  (`lg:hidden`), puisque la barre latérale n'existe pas.

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
[NumberField](src/components/NumberField.tsx), qui avait le même défaut.

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
| Courbes | 980 px | ⚠️ Le graphe suit son conteneur : sur 2 000 px la courbe s'aplatissait jusqu'à la ligne droite, et les écarts entre runes — la seule chose qu'on vient y lire — disparaissaient |

## Tiroir d'actions mobile

Sous `lg`, la barre supérieure porte un bouton **hamburger** à gauche (à la
place du logo) qui ouvre `MobileDrawer` — un panneau glissant **depuis la
gauche**, du même côté que le bouton qui l'appelle et que la barre latérale
qu'il remplace.

Il reçoit les **filtres et les actions** de la page, ceux qui occupaient trois
ou quatre rangées avant la première donnée. Ce qui y entre et ce qui reste :

| Page | Reste visible | Passe dans le tiroir |
|------|---------------|----------------------|
| RTA | La grille des équipes | Filtres, sauvegarde, import/export |
| Bestiaire | La recherche | `FilterBar` (élément, étoiles, tri) |
| Mon compte → Monstres | La recherche et le tri | Élément, étoiles, doublons, 2A |

⚠️ **La recherche ne descend jamais dans le tiroir.** C'est le geste le plus
fréquent de ces trois écrans ; l'enfouir derrière une ouverture de panneau
coûterait deux gestes là où il y en avait zéro.

⚠️ **Le Siège n'a pas de tiroir**, et son hamburger ne s'affiche donc pas
(`PAGES_AVEC_MENU` dans `App.tsx`). Sa barre d'outils tient en quatre boutons
qui passent déjà à la ligne seuls : les extraire imposerait de découper
`SiegeBoard` sans gagner une hauteur mesurable. **Ouvrir un panneau vide serait
pire que ne rien proposer** — c'est la règle qui décide de l'appartenance à
cette liste, pas la page.

⚠️ Le tiroir porte `data-tiroir` : les libellés masqués par `hidden sm:inline`
y sont **rétablis** (`src/index.css`). Un bouton réduit à son icône a du sens
dans une barre d'outils serrée ; dans un panneau qui a toute la largeur, il ne
dit plus ce qu'il fait.

⚠️ Les filtres sont **un seul JSX**, posé à deux endroits selon la largeur
(`hidden lg:contents` dans la page, et le même fragment dans le tiroir). Deux
copies auraient divergé au premier filtre ajouté.
