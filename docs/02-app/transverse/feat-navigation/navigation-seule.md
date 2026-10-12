# Navigation — la barre navigue seule

Partie de [Navigation](README.md).

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
11 du mainteneur, 2026-09-24 — « le menu comme dans la maquette »). Les
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

**Dans l'app de bureau, avec un dossier SW Exporter choisi**
([bureau/](../../bureau/)), la carte du compte ouvre un **menu** (`Menu`, axe `declencheur`) au lieu du
sélecteur de fichier : les invocateurs du dossier (celui suivi, coché), puis
« Importer un fichier… ». Choisir un invocateur ne change que « Mon compte ».
Sans dossier, et sur le site : la carte importe, comme ci-dessus.

### Le gabarit d'une entrée

**32 px de haut**, icône **16** (18 pour les icônes d'inventaire du jeu),
texte **14** (`text-md`, `font-medium`), rayon 8 px — le gabarit de la
maquette. Les sous-sections : texte 13, en retrait de 36 px, **avec leur
icône** (16) — la maquette n'en montrait pas ; le mainteneur les a fait remettre
(2026-09-24) : chaque vue a la sienne, et elle se repère plus vite qu'un mot.
⚠️ **Le filet est UN contour gauche du bloc des sous-sections** (décalé de
18 px, dans l'axe de l'icône parente), pas un trait dessiné dans chaque
ligne : ainsi dessiné, il traversait le fond de la sous-section choisie et
se coupait entre deux lignes (« fait bizarre », le mainteneur). Le fond de sélection
commence après le filet.

⚠️ **Le texte était à 13 (`text-sm`) et la colonne se lisait serrée** ; 15
l'appuyait trop. L'échelle n'avait rien entre les deux : le palier `md` a donc
été **ajouté à l'échelle** ([03-developpeur/interface/](../../../03-developpeur/interface/)), pas posé en `text-[14px]`
sur place — une valeur en dur aurait été hors système, et la première d'une
série. C'est le seul emploi de ce palier.

⚠️ **Ce gabarit ne concerne QUE le bureau.** La barre latérale est
`hidden lg:flex`, et le panneau de navigation du téléphone
([MobileNavSheet](src/components/MobileNavSheet.tsx)) a son propre rendu — il ne
partage que les *types* (`SidebarSection`, `SidebarGroupe`). Une correction
destinée à un format ne touche pas l'autre
([03-developpeur/interface/](../../../03-developpeur/interface/)).

⚠️ **`w-full` sur l'entrée** : un `<button>` ne s'étire pas comme un `<a>` — il
fait `width: auto` même en `display: flex`. Sans lui, les entrées à
sous-section étaient larges comme leur texte et leur fond au survol s'arrêtait au
milieu de la barre.

Une entrée peut porter un **badge** à droite (`badge`) : « Bientôt » sur
Arène, dont la page l'annonce déjà. Un état de la PAGE, pas de la navigation.

### Les icônes — des objets d'atelier (rebranding R4)

⚠️ **Une icône par section, du jeu d'icônes de la toile « SW Blacksmith »**
([IconesAtelier.tsx](../../../../src/components/IconesAtelier.tsx)) : enclume (Accueil),
épées croisées (RTA, Ma prépa), tour (Siège), bouclier et épée (Défense,
Offense), parchemin (Recommandations), coffre (Mon compte), pierre runique
(Runes), grimoire griffé (Bestiaire), engrenage (Mécaniques), étincelle
(Nouveautés), curseurs (Paramètres) ; dessinées pour l'app et choisies par
Le mainteneur sur planche : coupe (Arène), compagnons (Ami), œuf fêlé (Monstres),
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
  contour d'accent (« un seul marqueur », [03-developpeur/interface/](../../../03-developpeur/interface/)). La couleur
  est posée en `color` inline sur l'icône, à la source dans `App.tsx` : elle
  voyage avec l'entrée jusqu'à la barre latérale, aux onglets du bas, au panneau
  mobile, à la barre supérieure et à la recherche de navigation, sans être
  ressaisie nulle part. (Elle a longtemps été monochrome et suivait l'encre du
  libellé ; la refonte lui rend l'identité colorée de l'accueil.)
- ⚠️ **Dans la barre latérale BUREAU, l'icône est redevenue MONOCHROME**
  (refonte graphique, décision 3 du mainteneur, 2026-09-24) : la couleur quitte
  le menu et reste aux données du jeu (éléments, raretés, statuts). La barre
  bureau a ses propres sections (`groupesBureau` dans `App.tsx`), sans
  couleur ; les onglets du bas, le panneau mobile, la barre supérieure et la
  recherche gardent pour l'instant la teinte de signature — le téléphone a son
  propre lot, et l'accueil le sien. ⚠️ Les teintes de section ont été
  **réessayées sur les icônes puis écartées** par le mainteneur le même jour : il
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
