# Système visuel — tokens de couleur

Partie de [Système visuel](README.md).

## Tokens

Tous les tokens sont des **variables CSS** déclarées dans
[index.css](../../../../src/index.css), exposées à Tailwind par
[tailwind.config.js](../../../../tailwind.config.js). Un composant n'écrit jamais un
hexadécimal.

### Surfaces et encre

Les valeurs sont celles d'[index.css](../../../../src/index.css).

| Token | Forge (sombre) | Atelier (clair) | Rôle |
|-------|----------------|-----------------|------|
| `bg` | `#161514` | `#f6f0e4` | Fond de page |
| `bar` | `#1b1a19` | `#fffdf8` | Barres de l'application : latérale, du haut |
| `panel` | `#232120` | `#fffdf8` | Carte, panneau |
| `panel2` | `#2e2c2a` | `#efe6d5` | Surface enfoncée (piste de barre, cadre de `Segmented`) |
| `border` | `#5a544d` | `#cdbc9e` | Bordure standard — champs, boutons, puces |
| `border-soft` | `#3a3734` | `#e4d9c6` | Séparateur intérieur, ligne de table, cadre de carte |
| `ink` | `#ede3d1` | `#1b1a19` | Texte principal |
| `ink-dim` | `#cfc3ae` | `#3f3a34` | Texte secondaire, libellés |
| `ink-dimmer` | `#a89a86` | `#6b6259` | Texte tertiaire (rare) |

⚠️ **`bar` n'est pas `panel`.** En Forge, la barre est un cran sous la carte
(1,08) et un cran au-dessus du fond (1,05). En Atelier, elle vaut `panel`, et
c'est son filet qui la détache du fond.

### Accent et sémantique

| Token | Forge | Atelier | Rôle |
|-------|-------|---------|------|
| `accent` | `#ff7a1a` | `#ff7a1a` | La braise VIVE : aplats seulement (`bg-accent`, bouton principal) |
| `accent-lisible` | `#ff7a1a` | `#a64f11` | La braise qui se LIT : texte, contour d'état, focus, trait de graphique |
| `accent-hover` | `#ff9a4d` | `#e0620a` | Survol de l'APLAT de braise (bouton principal) |
| `accent-appui` | `#e0620a` | `#e0620a` | Appui du même aplat ; en Atelier, il ne peut pas foncer plus sans que l'encre passe sous 4,5 (4,90) |
| `accent-soft` | `#3a2415` | `#ffeddd` | Fond d'un élément actif — en Forge, une braise sombre |
| `accent-ink` | `#1b1a19` | `#1b1a19` | Texte posé SUR un aplat de braise (bouton principal plein) |
| `good` | `#73e06b` | `#2f6b36` | Au tick, gain, succès — et **ton camp** |
| `good-soft` | `#253024` | `#e3f1e3` | Fond doux de `good` |
| `warn` | `#f2c230` | `#7c630d` | Avertissement — **jaune / ocre**, pas orange : il se confondrait avec la braise |
| `warn-soft` | `#39311b` | `#fbedb7` | Fond doux de `warn` — en Atelier hors construction (voir index.css) |
| `bad` | `#f27a84` | `#a3303a` | Hors tick, destructif, erreur |
| `bad-soft` | `#372324` | `#f8e4e3` | Fond doux de `bad` |
| `bad-ink` | `#1b1a19` | `#ffffff` | Encre SUR un aplat de `bad` (bouton danger plein) — le pendant d'`accent-ink` |
| `star` | `#c9a227` | `#8c6d0e` | Le laiton : étoiles, maxima d'efficience |

⚠️ **« Orange » dans le code = `warn`.** Le statut d'avertissement s'appelle
`orange` dans le code (`statutEquipe`, les verdicts) et dans certaines fiches ;
il se DESSINE en jaune / ocre. Lire `warn`, pas une teinte. (Ne concerne pas
les couleurs du jeu : rareté légendaire, part de meule, etc.)

⚠️ **Deux braises, un seul nom de classe**.
En Atelier, la braise vive fait **2,11 à 2,57** sur les fonds : illisible comme
texte, invisible comme contour (seuil 3:1 d'un trait qui porte un état). Elle
reste l'aplat ; tout ce qui se lit ou se trace prend `accent-lisible` (4,52 à
5,51). Le partage est fait **dans `tailwind.config.js`** : `textColor`,
`borderColor`, `ringColor` et `outlineColor` lisent `accent-lisible`, `colors`
(donc `bg-`, `from-`, `accent-`) lit la vive. Un composant écrit `text-accent`
ou `border-accent` et reçoit la bonne braise — aucun renommage, et un
`text-accent` écrit demain sera lisible d'office. Même partage pour `ctx`
(`--ctx-lisible`), dont la valeur par défaut est l'accent. Ce que Tailwind ne
voit pas s'écrit à la main : l'anneau `:focus-visible` (index.css), les traits
SVG des courbes (`rgb(var(--accent-lisible))`).

⚠️ **L'avertissement ressemble à l'accent — assumé.** `warn` a la valeur du
survol de la braise : ΔE 6,7 avec l'accent en Forge, 3,8 avec la braise
lisible en Atelier. Aucun ambre lisible ne s'en éloigne vraiment en clair
(ΔE 10 au mieux, un brun terne). Un avertissement se lit donc à son
**libellé** — une pastille écrite — jamais à sa seule couleur.

⚠️ **Vert et rouge de Forge : saturés, pas pastel.** `#73e06b` et `#f27a84`
font 8,35 et 5,23 de contraste au pire. Le rouge garde sa teinte rosée : vers
le corail, il se rapprocherait de la braise (ΔE 7,7) et du Feu. Atelier a ses
propres valeurs (voir le tableau). Sur l'aplat rouge, le blanc tombe à 2,66 en
Forge : d'où `bad-ink`, sombre en Forge (6,53), blanc en Atelier (6,91).

**Fonds doux : vifs, pas des gris teintés.** Une teinte sémantique fondue à
12 % dans un fond brun donnerait un gris à peine teinté : chaque fond doux
garde assez de chroma pour dire sa teinte. L'encre y fait 9,71 au pire (Forge)
et 13,99 (Atelier). L'accent et la sémantique restent lisibles sur leur propre
fond doux (4,91 au pire, `accent-lisible` en Atelier) ; un élément pas
toujours (3,92 à 10,85) — ses fonds doux portent l'encre, jamais la couleur de
l'élément en texte.

⚠️ **Les trois états sémantiques ont chacun leur fond doux** (`good-soft`,
`warn-soft`, `bad-soft`), construits pareil — la teinte fondue dans le fond de
page, pas une transparence. Sans `warn-soft`, une surface qui veut dire « à
corriger » devrait emprunter `bad-soft` (et faire passer un avertissement pour
une erreur) ou poser une opacité en dur.

⚠️ **`good-soft` et `bad-soft` comblent un AXE, pas une variante de plus** :
comme l'accent et les éléments, la sémantique a son fond doux. Ils vont par
PAIRE et servent à **opposer deux camps** (speed tuning : `good` = ton équipe,
`bad` = en face) là où une transparence ne convient pas — une colonne collante
passe par-dessus le tableau qui défile dessous, il lui faut un fond SOLIDE.

⚠️ **Deux camps, c'est de la SÉMANTIQUE, pas de l'accent.** L'accent dit « ceci
est actif ou sélectionné » — il ne dit pas à qui appartient une ligne. Et
l'accent est une braise, orange : « ton équipe » y virerait à l'orange, à un
cheveu du `warn` d'à côté. `good`/`bad` disent l'état de la donnée, et `bad`
porte déjà « ce qui te coupe » : la paire se referme d'elle-même.

⚠️ **La sémantique n'est pas l'accent.** `good`/`warn`/`bad` disent un état des
données ; `accent` dit « ceci est actif ou sélectionné ». Les confondre rend un
filtre actif indiscernable d'une alerte.

⚠️ **`accent-ink` n'est jamais du blanc.** Sur la braise, le blanc tombe sous
le seuil ; l'encre sombre (`#1b1a19`) y fait **6,66**, dans les
deux thèmes. En Atelier, l'aplat de braise ne se détache du fond qu'à 2,30 —
sous le 3,0 d'un élément d'interface — mais un bouton plein porte son
libellé, et c'est lui qui l'identifie.

### Rayon intérieur : `rounded-lg-inner`

⚠️ **Un enfant à FOND PLEIN collé au bord d'un panneau arrondi doit rentrer d'un
pixel.** À rayon égal, son fond déborde dans l'arrondi et le coin redevient
carré — c'est visible dès que l'enfant est teinté (bandeau de titre d'une carte,
colonne collante d'un tableau).

`rounded-lg-inner` vaut `calc(var(--radius-lg) - 1px)` : le rayon du panneau
moins son contour, 7 px (voir [Rayons](typographie-et-rayons.md#rayons)).

⚠️ **`overflow-hidden` sur le parent n'est PAS la solution** : il règle le coin
mais coupe les menus flottants, qui se placent en `absolute` à l'intérieur du
panneau.

### UN SEUL marqueur de sélection

⚠️ **Un élément sélectionné porte UN marqueur, jamais deux.** Cumuler
`bg-accent-soft` + `border-accent` + `text-accent` + `shadow` pour dire une
seule chose donne une zone qui se surligne elle-même deux fois : on ne lit
plus « c'est sélectionné », on voit un empilement qui bave sur ses voisins, et
l'écran devient bruyant dès que trois filtres sont posés.

**Le marqueur dépend du support** — un seul dans les deux cas :

| Support | Marqueur | Pourquoi pas l'autre |
|---------|----------|----------------------|
| **Champ de saisie** (`select`, `input`, `textarea`) | `border-accent` | Un fond coloré passe derrière du texte qu'on doit lire, et concurrence le curseur |
| **Pastille de filtre** (`Pastille`, sets, emplacements, étoiles du Bestiaire) | `MARQUEUR_FILTRE_ACTIF` : `border-accent bg-accent-soft text-ink` | **La couleur de l'app, teintée** : le contour porte l'état, le fond le rend lisible d'un coup d'œil. Le fond est une braise sombre (`accent-soft`, `#3a2415` en Forge) ; **ni coche ni gras**, qui élargiraient la pastille au clic. Contraste mesuré : texte 11,44 (Forge) et 15,23 (Atelier) ; contour, en `accent-lisible`, 5,58 et 4,91. Pas de couleur inversée (aplat d'encre) : ce serait un aplat blanc en thème sombre. Une seule constante, exportée de `Pastille`, importée par les filtres qui ne passent pas par elle. ⚠️ **Exception, à la souris : les filtres de sets et d'emplacements des RUNES** prennent le gabarit et le marqueur du `Segmented` (sans contour ; un aplat de braise) — posés sur une ligne à côté du filtre des antiques, qui EST un `Segmented`, deux marqueurs se liraient comme deux familles de boutons (`gabaritFiltre.ts`) |
| **Cran de `Segmented`, onglet** | `bg-accent text-accent-ink` (le cadre porte le contour) | Un choix UNIQUE dans un cadre commun, pas un filtre en rangée. **Un APLAT de braise.** Toujours un seul marqueur. Encre dessus : 6,66 |

⚠️ **Les pastilles voisines partagent le même marqueur.** Les numéros de
`SlotFilter`, les sets de `SetFilter`, les étoiles du Bestiaire et les filtres
de Ma box (Nat / Doublons / 2A) portent tous **le même fond d'accent teinté** —
deux marqueurs différents côte à côte se liraient comme deux natures de
filtre. C'est la brique `Pastille` ([librairie-ui/composants.md](../librairie-ui/composants.md)) qui le
définit, dans `MARQUEUR_FILTRE_ACTIF`, une fois pour toutes.

**Corollaires :**

- ⚠️ **`shadow` n'est JAMAIS un marqueur d'état.** L'ombre dit l'élévation — ce
  qui flotte au-dessus du reste. Un filtre actif ne décolle pas de la page. Elle
  reste donc aux popovers, menus et dialogues, jamais aux états actifs.
- ⚠️ **`text-accent` ne se cumule pas avec un fond.** Sur `accent-soft`, l'encre
  d'accent perd du contraste au lieu d'en gagner : le libellé d'un élément
  sélectionné devient moins lisible que ses voisins non sélectionnés. Le texte
  passe à `ink` sur fond actif.
- ⚠️ **Le marqueur d'état est UNIQUE : `border-accent bg-accent-soft text-ink`**
  — un contour d'accent et un fond très léger. Le contour porte l'état, le fond
  ne fait que l'appuyer : `accent-soft` seul ne se verrait pas, étant un fond
  de panneau trop proche du gris ambiant.
  ⚠️ Pas de **dégradé doré plein** sur les filtres d'étoiles, les pastilles de
  tick ou les filtres de la box : il crierait plus fort que le réglage ne le
  mérite, et ferait **deux vocabulaires selon l'écran** — un filtre actif ne
  doit pas se lire différemment ici et là.
  **Deux exceptions**, qui n'en sont pas vraiment :
  - La **case à cocher** d'un dialogue (15 px) garde son remplissage plein : un
    contour de 1 px y disparaît, et une case cochée se lit par son remplissage.
  - Les boutons de **lead SPD** (ordre de tour) gardent le doré : ce n'est pas un
    marqueur d'état mais le **code couleur du lead** lui-même, celui de
    `LeadPill`.
- Le **survol** garde `hoverable:border-accent` sur les contrôles à fond : il
  agit au repos, quand aucun marqueur n'occupe la bordure — il n'y a donc pas de
  cumul. ⚠️ **Sauf les BOUTONS** (`Bouton`, `BoutonIcone`, le « ⋯ ») : leur
  survol peint le **fond** (`panel2`, `bad-soft` en danger). Pastilles, champs
  et cartes cliquables gardent le contour.

**Focus mis à part.** L'anneau `:focus-visible` (voir plus bas) n'est pas un
marqueur de sélection mais la position du clavier — les deux peuvent coexister
sur un même élément. C'est justement pour qu'ils restent distinguables que
l'état sélectionné n'a droit qu'à un seul signal : quand la bordure d'accent
d'un `select` posé se double de l'anneau d'accent à 2 px, on lit un seul
halo épais au lieu de deux informations.

### Éléments — deux valeurs par élément

Les couleurs d'élément sont du **vocabulaire Summoners War**, pas du style : un
joueur les lit sans réfléchir. Elles ne peuvent donc ni disparaître, ni changer
de teinte.

Mais le Vent (`#E7C22E`) et la Lumière (`#EAEBF0`) sont **illisibles sur fond
clair** — contraste sous 2:1. Chaque élément porte donc **deux valeurs, même
teinte, luminosité adaptée** :

| Élément | Forge (sombre) | Atelier (clair) | Note |
|---------|----------------|-----------------|------|
| Feu | `#E85C50` | `#C41C10` | — |
| Eau | `#2FA0E0` | `#006AA6` | — |
| Vent | `#E7C22E` | `#946F00` | ⚠️ Ocre profond : le jaune vif est illisible sur blanc |
| Lumière | `#EAEBF0` | `#866718` | ⚠️ Doré : le blanc n'existe pas sur blanc |
| Ténèbres | `#B076E8` | `#7624BE` | — |
| Inconnu | `#868DA8` | `#565F7A` | — |

⚠️ **La teinte est conservée, jamais remplacée.** Le Vent reste jaune-ocre, il ne
devient pas vert. Un joueur qui repère ses monstres Vent à la volée dans une
liste dense doit continuer à le faire.

Les icônes officielles (`public/elements/`) restent **inchangées** dans les deux
thèmes : ce sont des images du jeu, elles portent leur propre fond.
