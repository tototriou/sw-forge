# Navigation — la barre navigue seule

Partie de [Navigation](README.md).

## ⚠️ La barre navigue SEULE

**La page ne change qu'au choix d'une destination.** C'est la règle qui
gouverne les deux gestes de navigation interne :

- **Dérouler une section** (RTA, Siège, Runes, Artéfacts) affiche ses
  sous-sections **sous son entrée**, en retrait, et **ne charge rien**.
  Ouvrir la page de siège en même temps que ses sous-sections trancherait à la
  place de l'utilisateur, qui n'a pas encore choisi entre Défense, Offense et
  Recommandations. Recliquer la referme.
- **Le logo** remet la barre dans l'état de la route *en plus* de ramener à
  l'accueil — même si l'on y était déjà, où la route ne change pas.

Dérouler est donc un **`<button>`** (avec `aria-expanded`), pas un `<a>` : il
ne va nulle part, il n'a rien à faire dans l'historique ni dans un « ouvrir
dans un nouvel onglet ». Le type l'impose — `hash` **ou** `ouvre`, jamais les
deux.

⚠️ **Déroulées sur place, pas un second niveau.** Si les sous-sections
**remplaçaient** la liste, avec un retour « ‹ Siège » en tête, on perdrait de
vue les autres sections dès qu'on entre dans une. Déroulées sous leur entrée,
avec un filet vertical dans l'axe de son icône, on voit à la fois où l'on est
et tout ce qu'on peut atteindre.

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
texte **14** (`text-md`, `font-medium`), rayon 8 px. Les sous-sections : texte
13, en retrait de 36 px, **avec leur icône** (16) : chaque vue a la sienne, et
elle se repère plus vite qu'un mot.
⚠️ **Le filet est UN contour gauche du bloc des sous-sections** (décalé de
18 px, dans l'axe de l'icône parente), pas un trait dessiné dans chaque
ligne : dessiné par ligne, il traverserait le fond de la sous-section choisie
et se couperait entre deux lignes. Le fond de sélection commence après le
filet.

⚠️ **Le texte est à 14 (`text-md`)** : à 13 (`text-sm`) la colonne se lit
serrée, à 15 trop appuyée. Le palier `md` est **dans l'échelle**
([03-developpeur/interface/](../../../03-developpeur/interface/)), pas posé en
`text-[14px]` sur place — une valeur en dur serait hors système, et la
première d'une série. C'est le seul emploi de ce palier.

⚠️ **Ce gabarit ne concerne QUE le bureau.** La barre latérale est
`hidden lg:flex`, et le panneau de navigation du téléphone
([MobileNavSheet](src/components/MobileNavSheet.tsx)) a son propre rendu — il ne
partage que les *types* (`SidebarSection`, `SidebarGroupe`). Une correction
destinée à un format ne touche pas l'autre
([03-developpeur/interface/](../../../03-developpeur/interface/)).

⚠️ **`w-full` sur l'entrée** : un `<button>` ne s'étire pas comme un `<a>` — il
fait `width: auto` même en `display: flex`. Sans lui, les entrées à
sous-section seraient larges comme leur texte et leur fond au survol
s'arrêterait au milieu de la barre.

Une entrée peut porter un **badge** à droite (`badge`) : « Bientôt » sur
Arène, dont la page l'annonce déjà. Un état de la PAGE, pas de la navigation.

### Les icônes — des objets d'atelier

⚠️ **Une icône par section**
([IconesAtelier.tsx](../../../../src/components/IconesAtelier.tsx)) : enclume (Accueil),
épées croisées (RTA, Ma prépa), tour (Siège), bouclier et épée (Défense,
Offense), parchemin (Recommandations), coffre (Mon compte), pierre runique
(Runes), grimoire griffé (Bestiaire), engrenage (Mécaniques), étincelle
(Nouveautés), curseurs (Paramètres), coupe (Arène), compagnons (Ami), œuf
fêlé (Monstres), médaillon (Artéfacts), tenailles (Outils), compas
(Optimizer), chronomètre (Speed tuning). Grille 24, trait 2, `currentColor`,
au contrat de lucide (`size`, `color`). Les ACTIONS gardent lucide (importer,
rechercher…).
Hors de la nav, **une icône qui nomme une section prend la sienne** : cartes
de l'accueil ; au Siège, états vides (bouclier ou épée selon le
côté, parchemin des Recommandations), « Voir le speed tune » (chronomètre),
« Importer un deck d'offense » et « Fort contre » (épée) ; à la
RTA, l'état vide, le bouton d'ouverture et l'en-tête d'une prépa d'« Ami »
(compagnons) ; au Bestiaire, « Aucun monstre ne correspond » (grimoire) ; au
Speed tuning, la pastille de l'en-tête au téléphone (chronomètre). L'écran
vide de l'Optimizer porte une clé à molette.
⚠️ `InventaireIcon` est le rendu du jeu des écrans du compte (tête de monstre,
rune, médaillon) ; la nav a ses propres icônes des trois inventaires.

### L'entrée active — en braise (bureau)

⚠️ **Dans la barre latérale BUREAU** : fond `accent-soft` (une braise sombre),
texte et icône en braise lisible (`text-accent`, 5,58 en Forge, 4,91 en
Atelier) ; le survol est un voile d'encre (`bg-ink/5`). Un voile d'ENCRE et
non une surface : la barre a le fond de la page, et `panel`/`panel2` ne s'en
écartent pas dans le même ordre d'un thème à l'autre ; l'encre s'en écarte
toujours d'autant plus qu'elle est dense. **Une section déroulée ne porte pas
le fond** : c'est sa sous-section active qui le porte, juste en dessous ;
refermée à la main, elle le reprend — on sait toujours où l'on est.

Le marqueur du panneau mobile :

- ⚠️ **`border-ctx bg-ctx-soft`**, comme toute pastille de l'app. **Le contour
  n'est pas décoratif** : `bg-ctx-soft` seul est *un fond de panneau trop
  proche du gris ambiant, qui ne se voit pas*. Au second niveau, où toutes
  les entrées sont des vues d'un même inventaire (Runes → Résumé, Liste,
  Courbes…), **on ne saurait plus laquelle on lit**.
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
  ressaisie nulle part.
- ⚠️ **Dans la barre latérale BUREAU, l'icône est MONOCHROME** : la couleur
  est réservée aux données du jeu (éléments, raretés, statuts). La barre
  bureau a ses propres sections (`groupesBureau` dans `App.tsx`), sans
  couleur ; les onglets du bas, le panneau mobile, la barre supérieure et la
  recherche portent la teinte de signature. Le menu est neutre : ce qu'il
  montre, ce sont les **groupes** — voir « Un filet entre les groupes » plus
  bas.
### L'état de la barre : la route, plus ce qu'on a basculé à la main

La section de l'entrée active est **déroulée d'office** ; la barre la déduit
des `groupes` reçus (`sectionRoute`), l'appelant ne la lui passe pas. Par-dessus,
`bascules` retient, **par titre**, les sections déroulées ou refermées à la main.

⚠️ Changer de page **vide** `bascules` : arriver sur `#/siege/offense` doit
montrer les sous-sections du Siège, même si on l'avait refermé juste avant, et
ce qu'on avait déroulé en passant se referme.

⚠️⚠️ **« Changer de page » se mesure sur la DESTINATION, pas sur la section.**
Une clé qui ne vaudrait que le titre de section resterait identique
d'`#/outils/optimizer` à `#/outils/speed-tuning`, donc **aucune remise à
zéro** — choisir une sous-section de la section où l'on est déjà ne ferait
rien bouger, alors que la choisir dans une **autre** section remettrait bien
la barre sur la route : deux comportements pour un seul geste. La clé est donc
`titre de section | entrée active de la section | entrée active du premier
niveau`, ce dernier terme distinguant deux pages sans sous-sections (Accueil,
Bestiaire). Fonction pure `cleRouteBarre`, **gardée** par
[tests/navigation.test.ts](tests/navigation.test.ts).

⚠️ **C'est le TITRE qui est mémorisé, jamais l'objet section.** Un objet
stocké est **figé à l'instant du clic**, avec les `actif` calculés à ce
moment-là — le surlignage ne suivrait plus la navigation. Le titre est
ré-résolu à chaque rendu sur les `groupes` reçus, que l'appelant reconstruit à
chaque changement de page.
