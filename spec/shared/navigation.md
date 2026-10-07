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

**Sur bureau, le premier niveau est REGROUPÉ** (refonte graphique, décision 5
de Thomas, 2026-09-24 — [cadrage](../chantiers/refonte-graphique.md)) :

```
Accueil
JOUER        RTA ›  Siège ›  Arène
MON COMPTE   Monstres  Runes ›  Artéfacts ›
OUTILS       Optimizer  Speed tuning
RESSOURCES   Bestiaire  Mécaniques  Nouveautés  Télécharger
```

« Télécharger » (application de bureau, décision 14) n'existe que sur le
**site** : `RESOURCES` d'App.tsx l'omet dans l'app de bureau (`estBureau()`),
et la barre latérale, le panneau mobile, la palette et le titre, qui en
dérivent tous, le perdent d'un coup. Voir [telecharger.md](../telecharger.md).

L'ordre est gardé, à une exception près : **Arène rejoint « Jouer »**, à côté
du siège — c'est un mode de jeu. Les inventaires et les outils deviennent des
entrées DIRECTES : Monstres (une seule vue) et les deux outils mènent à leur
page ; Runes et Artéfacts (plusieurs vues) ouvrent leur niveau, comme RTA et
Siège. Aucune destination ne disparaît — vérifié par
`tests/rendu/app.test.tsx`. Les onglets mobiles gardent leurs cinq entrées
(le téléphone a son propre lot).

## Adresses — ce que lit la barre d'adresse

Routage par hash, sans routeur : `parseHash` ([App.tsx](src/App.tsx)) lit
l'adresse et en déduit la page et ses sous-niveaux.

| Adresse | Page |
| --- | --- |
| `#/` | Accueil |
| `#/rta`, `#/rta/ami` | RTA · Ma prépa, Ami |
| `#/siege/defense`, `/offense`, `/recommandations` | Siège |
| `#/compte/<inventaire>/<vue>` | Mon compte — vues de [accountViews.ts](src/lib/accountViews.ts) |
| `#/outils/optimizer`, `/speed-tuning` | Outils |
| `#/arene`, `#/bestiary`, `#/mecaniques`, `#/releases`, `#/parametres` | une page chacune |
| `#/telecharger` | Télécharger — **site seulement** ; dans l'app de bureau, l'accueil |

- ⚠️ **Une adresse tronquée mène au défaut de sa section**, jamais à un écran
  vide : `#/siege` → Défense, `#/compte` → Monstres, `#/compte/runes` →
  Résumé, `#/outils` → Optimizer. L'accueil s'en sert (`#/compte/runes`).
- ⚠️ **Une sous-page inconnue retombe sur le défaut de SA section**
  (`#/compte/artefacts/courbes` → Artéfacts · Résumé, par `vueValide`) ; une
  **section inconnue** retombe sur l'accueil. Jamais d'exception.
- ⚠️ **Garde-fou** (Thomas, 2026-10-01) : `tests/navigation-adresses.test.ts`
  tient la table de toutes les adresses et de leur page. Tout lien `#/…`
  affiché par l'app doit y figurer — un lien ajouté sans y être inscrit, ou qui
  ne mène plus où la table le dit, fait échouer `npm test`.

## ⚠️ La barre navigue SEULE

**La page ne change qu'au choix d'une destination.** C'est la règle qui
gouverne les deux gestes de navigation interne :

- **Dérouler une section** (RTA, Siège, Runes, Artéfacts) affiche ses
  sous-sections **sous son entrée**, en retrait, et **ne charge rien**.
  Cliquer « Siège » ouvrait la page de siège *et* ses sous-sections d'un coup,
  alors qu'on n'avait pas encore choisi entre Défense, Offense et
  Recommandations. Recliquer la referme.
- **Le logo** remet la barre dans l'état de la route *en plus* de ramener à
  l'accueil — même si l'on y était déjà, où la route ne change pas.

Dérouler est donc un **`<button>`** (avec `aria-expanded`), pas un `<a>` : il
ne va nulle part, il n'a rien à faire dans l'historique ni dans un « ouvrir
dans un nouvel onglet ». Le type l'impose — `hash` **ou** `ouvre`, jamais les
deux.

⚠️ **Déroulées sur place, pas un second niveau** (refonte graphique, décision
11 de Thomas, 2026-09-24 — « le menu comme dans la maquette »). Les
sous-sections **remplaçaient** la liste, avec un retour « ‹ Siège » en tête :
on perdait de vue les autres sections dès qu'on entrait dans une. Déroulées
sous leur entrée, avec un filet vertical dans l'axe de son icône, on voit à la
fois où l'on est et tout ce qu'on peut atteindre. Le retour a disparu avec le
niveau qu'il remontait — [retrait #11] du cadrage.

```
[logo] SW Blacksmith                    [repli]
┌─────────────────────────────────────┐
│ T  Tototriou                      ⇕ │   carte du compte = import
│    Export du 9 août · 342 monstres  │
└─────────────────────────────────────┘
[🔍 Aller à…                   Ctrl K]
⌂  Accueil
JOUER
⚔  RTA                              ›
🏰 Siège                            ⌄
   │ Défense                            ← sous-section active : fond
   │ Offense
   │ Recommandations
🏆 Arène                      Bientôt
MON COMPTE · OUTILS · RESSOURCES …
───────────────────────────────────────
⚙  Paramètres
```

**Dans l'app de bureau, avec un dossier SW Exporter choisi** (lot 9,
décision 15 du chantier [application-bureau](../chantiers/application-bureau.md)),
la carte du compte ouvre un **menu** (`Menu`, axe `declencheur`) au lieu du
sélecteur de fichier : les invocateurs du dossier (celui suivi, coché), puis
« Importer un fichier… ». Choisir un invocateur ne change que « Mon compte ».
Sans dossier, et sur le site : la carte importe, comme ci-dessus.

### Le gabarit d'une entrée

**32 px de haut**, icône **16** (18 pour les icônes d'inventaire du jeu),
texte **14** (`text-md`, `font-medium`), rayon 8 px — le gabarit de la
maquette. Les sous-sections : texte 13, en retrait de 36 px, **avec leur
icône** (16) — la maquette n'en montrait pas ; Thomas les a fait remettre
(2026-09-24) : chaque vue a la sienne, et elle se repère plus vite qu'un mot.
⚠️ **Le filet est UN contour gauche du bloc des sous-sections** (décalé de
18 px, dans l'axe de l'icône parente), pas un trait dessiné dans chaque
ligne : ainsi dessiné, il traversait le fond de la sous-section choisie et
se coupait entre deux lignes (« fait bizarre », Thomas). Le fond de sélection
commence après le filet.

⚠️ **Le texte était à 13 (`text-sm`) et la colonne se lisait serrée** ; 15
l'appuyait trop. L'échelle n'avait rien entre les deux : le palier `md` a donc
été **ajouté à l'échelle** ([design.md](design.md)), pas posé en `text-[14px]`
sur place — une valeur en dur aurait été hors système, et la première d'une
série. C'est le seul emploi de ce palier.

⚠️ **Ce gabarit ne concerne QUE le bureau.** La barre latérale est
`hidden lg:flex`, et le panneau de navigation du téléphone
([MobileNavSheet](src/components/MobileNavSheet.tsx)) a son propre rendu — il ne
partage que les *types* (`SidebarSection`, `SidebarGroupe`). Une correction
destinée à un format ne touche pas l'autre
([deux-applications.md](deux-applications.md)).

⚠️ **`w-full` sur l'entrée** : un `<button>` ne s'étire pas comme un `<a>` — il
fait `width: auto` même en `display: flex`. Sans lui, les entrées à
sous-section étaient larges comme leur texte et leur fond au survol s'arrêtait au
milieu de la barre.

Une entrée peut porter un **badge** à droite (`badge`) : « Bientôt » sur
Arène, dont la page l'annonce déjà. Un état de la PAGE, pas de la navigation.

### Les icônes — des objets d'atelier (rebranding R4)

⚠️ **Une icône par section, du jeu d'icônes de la toile « SW Blacksmith »**
([IconesAtelier.tsx](../../src/components/IconesAtelier.tsx) ; décisions 9, 27
et 28 du [cadrage](../chantiers/rebranding-blacksmith.md)) : enclume (Accueil),
épées croisées (RTA, Ma prépa), tour (Siège), bouclier et épée (Défense,
Offense), parchemin (Recommandations), coffre (Mon compte), pierre runique
(Runes), grimoire griffé (Bestiaire), engrenage (Mécaniques), étincelle
(Nouveautés), curseurs (Paramètres) ; dessinées pour l'app et choisies par
Thomas sur planche : coupe (Arène), compagnons (Ami), œuf fêlé (Monstres),
médaillon (Artéfacts), tenailles (Outils), compas (Optimizer), chronomètre
(Speed tuning). Grille 24, trait 2, `currentColor`, au contrat de lucide
(`size`, `color`). Les ACTIONS gardent lucide (importer, rechercher…).
Hors de la nav, **une icône qui nomme une section prend la sienne** : cartes
de l'accueil (décision 37) ; au Siège, états vides (bouclier ou épée selon le
côté, parchemin des Recommandations), « Voir le speed tune » (chronomètre),
« Importer un deck d'offense » et « Fort contre » (épée) — décision 44 ; à la
RTA, l'état vide, le bouton d'ouverture et l'en-tête d'une prépa d'« Ami »
(compagnons) ; au Bestiaire, « Aucun monstre ne correspond » (grimoire) ; au
Speed tuning, la pastille de l'en-tête au téléphone (chronomètre). L'écran
vide de l'Optimizer (clé à molette) attend les lots de l'Optimizer
(décision 60).
⚠️ `InventaireIcon` n'est pas touché : il reste le rendu du jeu des écrans du
compte (tête de monstre, rune, médaillon) ; la nav a ses propres icônes des
trois inventaires.

### L'entrée active — en braise (bureau)

⚠️ **Depuis le rebranding (décision 29)** : fond `accent-soft` (le « braise
sombre » de la toile), texte et icône en braise lisible (`text-accent`, 5,58
en Forge, 4,91 en Atelier) ; le survol garde le voile d'encre (`bg-ink/5`).
Avant : `bg-ink/10`, la décision 11 de la refonte, décrite ci-dessous.

⚠️ **Dans la barre latérale BUREAU, depuis la décision 11** : fond
`bg-ink/10`, survol `bg-ink/5` — le gabarit de la maquette. Un voile d'ENCRE
et non une surface : la barre a le fond de la page, et `panel`/`panel2` ne s'en
écartent pas dans le même ordre d'un thème à l'autre ; l'encre s'en écarte
toujours d'autant plus qu'elle est dense. **Une section déroulée ne porte pas
le fond** : c'est sa sous-section active qui le porte, juste en dessous ;
refermée à la main, elle le reprend — on sait toujours où l'on est.

Ce qui suit décrit le marqueur d'avant, qui reste celui du panneau mobile
(lot 11 de la refonte) :

- ⚠️ **`border-ctx bg-ctx-soft`**, comme toute pastille de l'app. **Le contour
  n'est pas décoratif.** L'entrée n'a longtemps porté que
  `bg-ctx-soft` — exactement le cas que la règle décrit : *un fond de panneau
  trop proche du gris ambiant, qui ne se voit pas*. Au second niveau, où toutes
  les entrées sont des vues d'un même inventaire (Runes → Résumé, Liste,
  Courbes…), **on ne savait plus laquelle on lisait**.
- ⚠️ Le contour vit sur le **calque en `absolute`**, pas sur l'entrée elle-même :
  posé sur elle, il décalerait l'icône et le libellé de 1 px au changement de
  page — un clic déplacerait ce qu'on vient de cliquer.
- ⚠️ **L'icône porte la couleur de SIGNATURE de sa section**, la même que la
  carte de l'accueil (`src/data/couleursSection.ts` — une seule source pour
  l'accueil et la nav). RTA en violet, Siège en rouge, Mon compte en cyan… La
  teinte est **constante, active ou non** : elle dit *quelle* section, pas *si*
  on y est. Ce n'est donc pas un second marqueur d'état — l'actif reste le
  contour d'accent (« un seul marqueur », [design.md](design.md)). La couleur
  est posée en `color` inline sur l'icône, à la source dans `App.tsx` : elle
  voyage avec l'entrée jusqu'à la barre latérale, aux onglets du bas, au panneau
  mobile, à la barre supérieure et à la recherche de navigation, sans être
  ressaisie nulle part. (Elle a longtemps été monochrome et suivait l'encre du
  libellé ; la refonte lui rend l'identité colorée de l'accueil.)
- ⚠️ **Dans la barre latérale BUREAU, l'icône est redevenue MONOCHROME**
  (refonte graphique, décision 3 de Thomas, 2026-09-24) : la couleur quitte
  le menu et reste aux données du jeu (éléments, raretés, statuts). La barre
  bureau a ses propres sections (`groupesBureau` dans `App.tsx`), sans
  couleur ; les onglets du bas, le panneau mobile, la barre supérieure et la
  recherche gardent pour l'instant la teinte de signature — le téléphone a son
  propre lot, et l'accueil le sien. ⚠️ Les teintes de section ont été
  **réessayées sur les icônes puis écartées** par Thomas le même jour : il
  préfère le menu neutre. Ce qu'il voulait voir, ce sont les **groupes** —
  voir « Un filet entre les groupes » plus bas.
### L'état de la barre : la route, plus ce qu'on a basculé à la main

La section de l'entrée active est **déroulée d'office** ; la barre la déduit
des `groupes` reçus (`sectionRoute`), l'appelant ne la lui passe pas. Par-dessus,
`bascules` retient, **par titre**, les sections déroulées ou refermées à la main.

⚠️ Changer de page **vide** `bascules` : arriver sur `#/siege/offense` doit
montrer les sous-sections du Siège, même si on l'avait refermé juste avant, et
ce qu'on avait déroulé en passant se referme.

⚠️⚠️ **« Changer de page » se mesure sur la DESTINATION, pas sur la section.**
La clé de comparaison ne valait que le titre de section : passer d'
`#/outils/optimizer` à `#/outils/speed-tuning` la laissait identique, donc
**aucune remise à zéro** — choisir une sous-section de la section où l'on
était déjà ne faisait rien bouger, alors que la choisir dans une **autre**
section remettait bien la barre sur la route : deux comportements pour un
seul geste (vu avec le panneau de survol, retiré depuis). La clé est donc `titre de section | entrée
active de la section | entrée active du premier niveau`, ce dernier terme
distinguant deux pages sans sous-sections (Accueil, Bestiaire). Fonction pure
`cleRouteBarre`, **gardée** par
[tests/navigation.test.ts](tests/navigation.test.ts).

⚠️ **C'est le TITRE qui est mémorisé, jamais l'objet section.** Un objet
stocké est **figé à l'instant du clic**, avec les `actif` calculés à ce
moment-là — le surlignage ne suivait plus la navigation. Le titre est
ré-résolu à chaque rendu sur les `groupes` reçus, que l'appelant reconstruit à
chaque changement de page.

## Trois niveaux — « Mon compte »

⚠️ **Sur bureau, ce niveau n'existe plus** depuis la refonte graphique
(décision 5) : Monstres, Runes et Artéfacts sont au premier niveau, et Runes /
Artéfacts déroulent directement leurs vues (Résumé · Liste · Courbes ·
Comparaison · Optimisation). **Meules et Gemmes n'y figurent plus** tant
qu'elles sont « Bientôt » — [retrait #6] décidé par Thomas ; leurs routes et
leur page restent. Ce qui suit décrit le **panneau mobile**, qui garde les
trois niveaux (choisir l'inventaire, puis sa vue).

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

⚠️ **Barre latérale bureau** : les groupes (Jouer, Mon compte, Outils,
Ressources) sont séparés par un **filet pleine largeur** (`bg-border`) et
annoncés par leur **intitulé en capitales à la couleur principale**
(`.label text-accent` — 5,4 à 9,7:1 sur le fond, mesuré au lot 3). La
maquette ne portait qu'un intitulé gris, sans filet : les quatre groupes se
lisaient comme une seule liste, et Thomas a demandé (2026-09-24) qu'ils se
séparent « d'une manière plus visible ». Le reste du menu reste neutre.
Repliée, l'intitulé disparaît et le filet raccourcit.

## Repli — deux états, jamais trois

- La **largeur s'anime** (248 → 56 px), pas un `translateX` : la barre se replie
  **sur elle-même** et rend sa place au contenu, dont la marge suit à la même
  courbe. 248 et non plus 224 depuis la décision 11 : la carte du compte
  tronquait sa seconde ligne.
- Le bouton de repli vit **en tête**, à côté du logo (décision 11) : un réglage
  de la barre elle-même, pas une destination. Icône seule, son nom dans
  l'infobulle. Repliée, logo et bouton s'empilent.
- ⚠️ **Pas de déploiement au survol.** Il a été essayé et retiré : la barre
  devenait incohérente avec elle-même — repliée dans le Siège on voyait les
  icônes des *sections*, au survol elle basculait sur les *sous-sections*, donc
  d'autres icônes aux mêmes places. Le contenu changeait sous le curseur.
- Repliée, les libellés cèdent la place aux `title` : neuf icônes ne se
  distinguent pas toutes au premier regard.
- Le repli tient pour la **session** (`useStickyState`), sans être persisté :
  une préférence d'affichage ne justifie pas de passer par le consentement de
  conservation — même règle que [MobileNotice](src/components/MobileNotice.tsx).

## Pas d'aperçu au survol (bureau)

Survoler une section refermée (RTA, Siège, Runes, Artéfacts) ouvrait un
panneau flottant à droite de la barre, qui en listait les sous-sections.
**Retiré** par Thomas le 2026-09-24 — [retrait #12] du cadrage de la
refonte graphique : les sous-sections se déroulent désormais sous leur
entrée, le panneau doublait ce geste et surgissait dès qu'on traversait la
barre. Toutes restent atteignables en déroulant la section, au clic comme
au clavier. [tests/navigation.test.ts](tests/navigation.test.ts) vérifie
qu'il ne revient pas.

## Recherche de navigation

Un champ en tête de la barre, `⌘K` depuis n'importe où.

⚠️ **Depuis le lot 13 (décision 29), ce champ OUVRE LA PALETTE** (section
suivante) : toucher le champ ou `Ctrl K` ouvre la même palette, qui cherche
pages, monstres et actions. Il n'existe qu'**une** recherche — le contrat du
lot 13 interdisait d'en ajouter une seconde à côté de celle-ci. Ce qui suit
décrit ce qu'elle garde de la recherche de pages d'avant.

- ⚠️ **Elle ne cherchait QUE des destinations** — les quinze de l'app,
  sous-sections comprises. « Pas les monstres : un champ répondant aux deux
  obligerait à trier du regard deux natures de résultats. » La palette y
  répond par des **groupes intitulés** (Pages, Monstres, Actions) : les
  natures sont séparées, pas mêlées.
- ⚠️ **Dérivée des mêmes constantes que la barre**, pas ressaisie : une seconde
  liste aurait divergé au premier écran ajouté, et le manque serait passé
  inaperçu — on ne cherche pas ce dont on ignore l'existence.
- La navigation au clavier vient de `useComboboxNav`, comme toute barre à
  suggestions — voir [recherche-clavier.md](recherche-clavier.md).
- Comparaison **insensible aux accents** : « arene » doit trouver « Arène ».
- L'indication **`Ctrl K`** à droite du champ (décision 11, la maquette). Elle
  avait été remplacée par un chevron — un raccourci qu'on lit une fois, jugé
  encombrant ; Thomas a retenu la maquette, qui l'affiche. Le raccourci marche
  avec Ctrl comme avec ⌘.
- ⚠️ **Un résultat a le rendu exact d'une entrée du menu** : 32 px, icône
  NEUTRE de 16, texte 14, rayon 8, voile d'encre pour le résultat choisi
  (`bg-ink/10`) et au survol (`bg-ink/5`) ; la section en contexte à droite,
  en petit. Thomas l'a relevé (2026-09-24) : les résultats avaient gardé
  l'ancien gabarit (texte 13, icônes colorées, fond `ctx-soft`) et se
  lisaient comme une autre sorte de liste.

## Palette Ctrl K

Refonte graphique, lot 13, décision 29 de Thomas, la maquette (planche
« Palette »). Composant `src/components/Palette.tsx`, monté une fois par
`App.tsx`.

- **S'ouvre** par `Ctrl K` / `⌘K` de n'importe où, par le champ de recherche
  de la barre latérale (bureau), et au téléphone par une **loupe** dans la
  barre du haut, à côté du ⚙ — sans clavier, c'est son seul accès.
- **Une modale centrée en haut** (bureau), plein écran au téléphone : un
  champ « Rechercher une page, un monstre, une action… », puis les résultats
  en **trois groupes intitulés** — **Pages** (les destinations du menu, comme
  avant, dérivées des mêmes constantes), **Monstres** (le bestiaire ; choisir
  ouvre la **fiche** du monstre, sans changer de page), **Actions**.
- **Actions** (décision 29) — aucune destructrice : **Importer mon compte**
  (le choix de fichier des Paramètres) ; **Sauvegarder la session** (le
  bouton des Paramètres, [sauvegarde-session.md](sauvegarde-session.md)) ;
  **Sauvegarder sous…**, dans l'application de bureau seulement ;
  **Thème auto / clair / sombre** ;
  **Créer une recommandation** (ouvre les Recommandations et en crée une) ;
  **Mesure : efficience / score SW** (le réglage du menu ⚙) ; **Speed tuning
  d'une équipe** (les équipes de siège dont un monstre correspond à la
  recherche ; choisir ouvre leur speed tuning en modale).
- **Vide, elle propose** les pages (comme le menu) et les actions ; les
  monstres n'apparaissent qu'à partir de deux lettres tapées — 3 000 fiches
  ne se parcourent pas.
- Clavier : `↑` `↓` naviguent sur toute la liste, groupes compris, `Entrée`
  ouvre, `Échap` ferme. ⚠️ **Géré par la palette elle-même, pas par
  `useComboboxNav`** : ce hook n'ouvre sa liste qu'une fois quelque chose
  tapé, alors que la palette montre déjà pages et actions quand le champ est
  vide — les flèches doivent y marcher aussi.
  Comparaison **insensible aux accents**. Au plus **8 monstres** et **8
  équipes** affichés : la palette mène quelque part, elle ne remplace pas le
  Bestiaire.
- Chaque groupe affiche au plus ce qui tient ; « Aucun résultat pour « … » »
  et « Essaie un nom de monstre, de page ou d'action. » quand rien ne répond.

## Barre supérieure

Trois zones : l'identité à gauche, **où l'on est** au centre, ce qui **sort** à
droite.

⚠️ **Sur BUREAU, « où l'on est » est un FIL D'ARIANE à gauche**, plus le
titre centré (refonte graphique, lot 4, 2026-09-24) : le chemin du menu
jusqu'à la page — intitulé de groupe, entrée, sous-section (« Jouer › Siège ›
Défense », « Mon compte › Runes › Liste »), texte 13, les étapes en
`ink-dim`, la dernière en `ink` semi-gras, sans icône. Relevé par Thomas :
le titre centré en Cinzel, icône colorée, « n'est pas raccord avec le menu ».
⚠️ Le fil est **tiré de `groupesBureau`** (`filBureau` dans `App.tsx`),
jamais ressaisi : il ne peut pas contredire la barre latérale. Une vue hors
menu (Meules, Gemmes) garde son nom ; une page hors menu (Paramètres), son
titre seul. Gardé par `testRenduAppFil` ([tests/rendu/app.test.tsx](tests/rendu/app.test.tsx)).

⚠️ **Sur TÉLÉPHONE, « où l'on est » est à gauche, sur deux lignes**
(refonte graphique, lot 11a, décision 24, la maquette) : la section en petit
(`ink-dimmer`, le fil sauf son dernier élément joint par « · » : « Jouer ·
RTA », « Mon compte · Runes »), la page dessous en semi-gras (« Ma prépa »,
« Résumé »). **Tiré du MÊME fil** que le bureau ; sans fil, le titre seul.
Il était **centré en absolu, en Cinzel, avec l'icône colorée de la
section** : il ne disait que la page, pas où elle se range. Les attendus de
`testRenduAppRoutes` pour « Mon compte » ont suivi (« Mon compte · Runes
Résumé » au lieu de « Runes · Résumé »).

⚠️ **Le contenu de la zone droite diffère selon le format** — c'est l'un des
endroits où les deux se séparent (voir
[deux-applications.md](deux-applications.md)) :

| | Zone droite |
|---|---|
| **Bureau** | « Sauvegarder », puis « Sauvegarder sous… » (application de bureau) ou « Se déconnecter » (site) |
| **Mobile** | « Sauvegarder » (icône), la loupe, ⚙ **Paramètres** |

- « Sauvegarder » ouvre la zone (`ml-auto`) aux deux formats : c'est la
  sauvegarde de la session, Ctrl+S
  ([sauvegarde-session.md](sauvegarde-session.md) § Sauvegarder). Au
  téléphone, une icône de 32 px nommée « Sauvegarder la session (Ctrl+S) »,
  du même gabarit que la loupe et le ⚙.
- ⚠️ **Les paramètres et la déconnexion ne sont pas du même côté.** Sur bureau, le
  ⚙ a été retiré : le **pied de la barre latérale** porte déjà « Paramètres »
  (`SidebarParametres`). Deux chemins vers le même écran se lisent comme deux
  réglages différents.
- ⚠️ Sur mobile, à l'inverse, le ⚙ est le **seul accès** aux paramètres : il n'y
  a pas de barre latérale, et aucun des cinq onglets n'y mène. C'est donc la
  déconnexion qui descend, pas lui.
- ⚠️ **Les deux ⚙ BASCULENT** — voir « Le ⚙ ouvre ET referme » plus bas.

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
- ⚠️ Le titre était **centré en absolu**, pas dans le flux : centré par la
  disposition, il se serait décalé dès que la zone de droite change de largeur.
  Depuis le lot 11a il est **aligné à gauche**, juste après le logo : le
  problème ne se pose plus, son point de départ ne dépend plus de la droite.
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
  le niveau au-dessus. (Outils — Optimizer / Speed tuning — suit la même règle.)
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

**Toucher « RTA », « Siège » ou « Compte » n'ouvre pas une page : ça ouvre un
panneau où l'on choisit la sous-section.** C'est la règle « la barre navigue SEULE » portée
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
  un groupe unique ajoute un geste sans rien donner à décider.
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
- ⚠️ **Le passage d'un temps à l'autre GLISSE**, du même mouvement que les deux
  niveaux de la barre latérale — `GLISSEMENT` et `COURBE` sont **importés de
  `Sidebar`**, pas réécrits : descendre d'un niveau est le même geste quel que
  soit le format, et deux définitions auraient dérivé au premier réglage. On
  entre par la droite, on ressort par la gauche (8 px, 180 ms) : un fondu seul
  dirait « ça a changé » sans dire « tu es descendu ».
  - ⚠️ **`mode="popLayout"`** : le niveau sortant quitte le **flux** au lieu de
    rester empilé sous l'entrant. C'est ce qui permet de re-mesurer la hauteur
    sur le seul niveau entrant — les deux en flux, elle aurait relevé la **somme
    des deux** et le panneau se serait figé à une hauteur qui n'existe à aucun
    moment. Le conteneur est `relative` : sans ancêtre positionné, le sortant se
    calait sur le panneau `fixed` entier, donc en travers du titre.

#### ⚠️ Une LISTE, une rangée par entrée

Refonte graphique, lot 11a, **décision 24** (Thomas, la maquette) : une
colonne de rangées au lieu d'une grille de cases encadrées.

- **Historique, à ne pas perdre de vue.** Le panneau a d'abord été une liste
  à filets — « trois libellés séparés par des traits, dont on ne voyait pas où
  commençait la cible » —, puis une **grille de deux colonnes** de cases
  encadrées (`repeat(auto-fit, minmax(max(140px, calc(50% - 4px)), 1fr))`,
  deux colonnes dès 320 px d'écran). Thomas a choisi la liste de la maquette
  en connaissance de cause ; ce qui répond au défaut d'alors :
  - chaque rangée prend **toute la largeur**, sur **52 px** exactement (au-delà
    des 44 de la règle tactile) : la cible est la rangée entière, pas le
    libellé ;
  - elle **s'allume au toucher** (`active:`) et au survol ;
  - un **filet sous chaque rangée, sauf la dernière** — un seul trait entre
    deux entrées, jamais deux.
- L'entrée courante : **encre pleine, semi-gras, icône teintée** de la couleur
  de contexte — le marqueur de la barre latérale.
- ⚠️ **Les DEUX temps partagent la même liste.** Ils se succèdent au même
  endroit à quelques centaines de millisecondes d'intervalle : deux gabarits
  de cible pour un seul geste, et le panneau changerait de nature en
  descendant d'un niveau.
- Le **retour** est la **première rangée**, en haut du panneau, au même
  gabarit que les autres — **toutes les cibles ont la même taille**. Ce qui le
  distingue est son **encre atténuée** et son chevron **vers la gauche**, pas
  son encombrement.
- La **colonne d'icône est à largeur fixe** (18 px) : sans elle les libellés se
  décalent d'une rangée à l'autre au gré de la largeur des symboles.
- Meules et Gemmes n'y reviennent pas (la maquette les montre avec
  « Bientôt ») : elles ont quitté le menu par décision de Thomas, [retrait #6]
  du cadrage de la refonte.
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
- ⚠️ **« Outils » OUVRE ses sous-sections** (Optimizer, Speed tuning), comme
  Siège et Compte. Tant qu'il n'y en avait qu'une, il restait un lien direct — un
  panneau pour un seul choix n'ajoutait qu'un geste.
- ⚠️ **« RTA » aussi, depuis qu'il en a deux** (Ma prépa · Ami). Même règle : la
  consultation de la prépa d'un ami s'ouvrait par un bouton perdu dans la barre
  de fichiers de sa propre prépa, et s'affichait par-dessus elle. C'est une
  destination, elle se choisit comme les autres.
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

Une **carte en tête** de la barre (bureau, décision 11) porte l'avatar, le nom
du joueur (`wizard_info.wizard_name`, voir `parseAccountWizardName`), puis la
date de l'EXPORT et le nombre de monstres (« Export du 9 août · 342
monstres »). **Toute la carte importe** : le double chevron dit « changer », et
charger un autre export est changer de compte. Sans compte : « Aucun compte »,
« Importer un export SWEX ». Repliée, l'avatar seul. Paramètres descend en
**pied**, au gabarit des entrées.

- ⚠️ On jongle entre plusieurs exports — le sien, celui d'un ami dont on compare
  les runes — et rien ne disait lequel était affiché. Une date seule ne
  suffit pas : deux comptes exportés le même jour se ressemblent — d'où le nom
  en premier.
- ⚠️ **L'avatar est une INITIALE, pas une image** : l'export SWEX ne porte
  aucune photo de profil. Une initiale distingue deux comptes d'un coup d'œil
  sans rien inventer, là où un pictogramme générique serait le même pour tous.
- ⚠️ Le champ `wizardName` du stockage est **facultatif** : le rendre
  obligatoire aurait imposé d'incrémenter `ACCOUNT_SCHEMA`, donc de **rejeter
  tous les comptes déjà conservés** — un réimport forcé pour un simple libellé.
- ⚠️ **Le nom seulement, jamais `wizard_id`** : c'est un numéro de compte, il
  n'apprend rien à qui lit son propre écran.

### ⚠️ Le ⚙ ouvre ET referme — la même bascule aux deux formats

Cliquer le ⚙ ouvre `#/parametres` ; **le recliquer ramène à l'écran d'où l'on
vient**. Vaut pour le ⚙ de la barre supérieure (mobile) **comme** pour celui du
pied de la barre latérale (bureau).

- ⚠️ **Un lien ne peut pas défaire ce qu'il vient de faire.** Le ⚙ du bureau
  était un simple `<a href="#/parametres">` : une fois dans les paramètres, on
  n'en sortait qu'en **choisissant une autre destination** — or on y était entré
  pour régler une chose et revenir, pas pour partir ailleurs. Le geste qui ouvre
  doit pouvoir refermer, exactement comme un onglet mobile qu'on retouche (voir
  « Un onglet à sous-sections les FAIT CHOISIR »).
- L'écran de retour est **celui qu'on quittait**, mémorisé au moment d'entrer
  (`avantParametres` dans [App.tsx](src/App.tsx)) — jamais un `history.back()`,
  qui rejouerait n'importe quel détour antérieur. Arrivé **directement** sur
  `#/parametres` (lien, rechargement), le retour se fait sur l'accueil : il n'y
  a rien d'autre à proposer.
- ⚠️ **Une seule fonction pour les deux boutons** (`basculerParametres`), pas une
  logique par barre : c'est ce qui les avait laissés diverger — l'un basculait,
  l'autre pas.
- Le bouton porte `aria-pressed`, et quand les paramètres sont ouverts son
  **fond** change (braise sombre dans la barre latérale, `ctx-soft` dans la
  barre du haut) et son libellé devient « Fermer les paramètres ». Il annonce
  ainsi qu'il fera l'**inverse** au prochain clic, sans changer d'icône : une
  croix aurait fait croire à la fermeture de la page entière.
  ⚠️ L'icône était un engrenage qui **pivotait d'un huitième de tour** ; depuis
  le rebranding (décision 28), ce sont les curseurs « Réglages » de la toile
  (l'engrenage est à Mécaniques) — tournés, ils ne diraient rien : la rotation
  est retirée, le fond et le libellé portent l'état.

## Page Paramètres

`#/parametres` — la **même liste** (`SettingsList`) que le popover ⚙, pas une
copie : deux listes auraient divergé au premier réglage ajouté, et personne ne
s'en serait aperçu puisqu'on n'ouvre jamais les deux à la fois.

- ⚠️ **Colonne centrée (620 px)**, contrairement aux autres pages : ce sont des
  lignes « intitulé / contrôle ». Alignées à gauche sur toute la largeur, l'œil
  devait traverser le vide pour relier les deux.
- Le popover reste le geste rapide ; la page est là pour s'y attarder — deux de
  ses réglages portent trois lignes d'explication, illisibles dans 260 px.
- ⚠️ **À la souris** (refonte graphique, lot 10, la maquette) : le titre
  « Paramètres », la carte du compte, puis **deux blocs intitulés** —
  « Réglages » (thème, score, overcap, adversaire de référence) et « Mes
  données » (garder mes données, âge des données, tout supprimer) — chacun
  dans sa carte. Même liste, même ordre (`SettingsList groupes`). **Au doigt
  aussi** depuis le lot 11d (décision 27) : les mêmes blocs intitulés. Le
  popover ⚙ n'est pas groupé.
- **Dans l'application de bureau**, un troisième bloc, « Application » (la
  version, la mise à jour) — page et popover ; absent du site
  (`estBureau()`). Voir [README](../README.md), « Réglages ».
- « Importer un JSON » et « Tout supprimer » sont des `Bouton` de la
  librairie (lot 10), « Tout supprimer » au ton `danger` — ils étaient
  dessinés à la main. Vaut pour la page et le popover.

## Largeur du contenu

⚠️ **Plus de plafond à 1180 px.** Il datait de la navigation horizontale : le
contenu était centré sous une barre elle-même centrée. Avec une barre latérale,
la page commence à son bord droit et va jusqu'au bout — les grilles de monstres,
les tableaux de runes et l'optimiseur y gagnent une à deux colonnes.

**Des exceptions**, bornées volontairement (le tableau les tient toutes ;
il en annonçait « trois » quand il en comptait déjà six) :

| Page | Largeur | Pourquoi |
|------|---------|----------|
| Mécaniques | 1100 px | Texte suivi — une ligne de 2 000 px se lit mal, l'œil perd le début de la suivante |
| Nouveautés | 900 px | Liste de textes courts lus de haut en bas |
| Télécharger | 760 px | Trois cartes et deux boutons : étalés, les boutons s'isolaient loin de leur explication |
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

⚠️ **Le contenu de page doit réserver assez de marge basse pour dégager
CE bouton, pas seulement la barre d'onglets.** Le conteneur principal
(`App.tsx`, `pb-[calc(116px+env(safe-area-inset-bottom))]` sous `lg`) doit
couvrir `HAUTEUR_ONGLETS` (52 px) + le décalage du bouton Options (16 px) +
sa propre hauteur (~40 px) + une marge de respiration, PLUS
`env(safe-area-inset-bottom)` — le même terme que celui déjà appliqué au
`bottom` du bouton (`MobileTabs.tsx`), sinon les deux dérivent l'un de
l'autre. Un ancien `pb-24` (96 px fixe, sans marge de sécurité) était
inférieur au strict nécessaire (108 px avant marge de sécurité) : sur les
pages à contenu dense proche du bas d'écran (ex. les tuiles de
`RunesOptim.tsx`), la toute dernière rangée pouvait finir partiellement
sous ces deux éléments fixes, une fois défilé au maximum. Corrigé — mais
⚠️ **cause SECONDAIRE**, pas la cause principale d'un signalement
utilisateur plus large (« impossible de cliquer sur une rune », touchant
aussi Compte > Runes > Liste, Artéfacts > Liste, Monstres — pas seulement
la dernière rangée d'une page dense) : la vraie cause était
`.cible-tactile` sans `position: relative`, voir
[design.md](design.md), section « cible-tactile ».

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
| Échange de fichier | Exporter · Importer |
| Organisation | Catégories |
| *(détaché)* | Tout effacer |

Empilés en une seule colonne, cinq boutons de nature différente se lisaient comme
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
  les boutons de la barre RTA forment une grille unique de cellules égales, et
  non une grille par rangée. Séparées, celle qui perdait son bouton conditionnel
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
  par sa taille les boutons en dessous alors qu'il ne vaut pas plus qu'eux.
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
tick ATB » → « Ticks », « Créer une recommandation » → « Créer ». Le sens entier
reste dans l'infobulle et dans
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
