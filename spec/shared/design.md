# Système visuel — thèmes, tokens, échelles

> ⚠️ **Ce document décrit le système visuel COMMUN aux deux formats** (couleurs,
> échelle typographique, animations). La façon dont chaque écran l'emploie, elle,
> diffère entre mobile et bureau — voir
> [deux-applications.md](deux-applications.md), qui prime en cas de doute.

> **Source de vérité** pour toute décision d'apparence. Une valeur qui n'est pas
> ici n'a pas à être écrite en dur dans un composant.

Ce document est né d'un constat : il n'existait aucune spec de design, et
l'interface le montrait — **248 couleurs en dur** dans le TSX, **21 tailles de
texte** de 9 px à 76 px, **aucune règle de focus**. Chaque composant réarbitrait
au pixel ce qu'aucun document ne fixait.

## Deux thèmes, jamais trois

| Thème | Nom | Quand |
|-------|-----|-------|
| Sombre | **Forge** | `prefers-color-scheme: dark` |
| Clair | **Atelier** | `prefers-color-scheme: light`, et défaut si non exprimé |

Le thème suit le navigateur **par défaut**, et se force depuis le menu ⚙
(`Auto` / `Clair` / `Sombre`, voir [Réglage](#réglage-du-thème)).

⚠️ **Le choix se stocke comme un réglage, pas comme une donnée.** Il s'écrit
toujours dans `localStorage`, même persistance refusée — comme le choix de
conservation lui-même et la mesure de score (voir
[README](../README.md#conventions-communes-toutes-les-pages)). Un thème oublié à
chaque visite serait un bug, pas une protection.

### Pourquoi deux directions nommées et pas une palette inversée

Une inversion mécanique produit un thème clair délavé : les gris qui portaient la
profondeur en sombre deviennent des gris sales sur blanc. Forge et Atelier sont
**deux systèmes cohérents chacun**, qui partagent leur structure de tokens mais
pas leurs valeurs.

Depuis le rebranding « SW Blacksmith » (lot R1, 2026-09-29,
[cadrage](../chantiers/rebranding-blacksmith.md)), les deux thèmes sont ceux
de la toile :

- **Forge** — charbon brun presque noir, **braise** (`#FF7A1A`) en accent
  unique, laiton pour les étoiles, données chiffrées en mono. La braise reste à
  distance du rouge de l'élément Feu : ΔE 9,7 (OKLab ×100).
- **Atelier** — papier chaud, encre de l'atelier, la même braise en aplat, et
  une **braise foncée** (`#A64F11`) pour tout ce qui se lit ou se trace : la
  vive tombe sous 2,6 sur fond clair (voir « Deux braises » plus bas).

Avant : Forge bleu nuit et cuivre, Atelier gris neutre et indigo
([preuve du R1](../chantiers/rebranding-preuves/lot-R1.md)).

## Tokens

Tous les tokens sont des **variables CSS** déclarées dans
[index.css](../../src/index.css), exposées à Tailwind par
[tailwind.config.js](../../tailwind.config.js). Un composant n'écrit jamais un
hexadécimal.

### Surfaces et encre

⚠️ **Les deux colonnes : valeurs du lot R1 du rebranding** (2026-09-29), les
jetons de la toile `--bs-*`, relues dans [index.css](../../src/index.css). La
colonne Forge avait décroché du code avant le rebranding (elle donnait `bg` à
`#0c0b0f` quand le code valait `#12131c`) : elle est réalignée.

| Token | Forge (sombre) | Atelier (clair) | Toile | Rôle |
|-------|----------------|-----------------|-------|------|
| `bg` | `#161514` | `#f6f0e4` | `bg` | Fond de page |
| `bar` | `#1b1a19` | `#fffdf8` | `bar` | Barres de l'application : latérale, du haut (décision 5) |
| `panel` | `#232120` | `#fffdf8` | `surface` | Carte, panneau |
| `panel2` | `#2e2c2a` | `#efe6d5` | `surface-2` | Surface enfoncée (piste de barre, cadre de `Segmented`) |
| `border` | `#5a544d` | `#cdbc9e` | `border-strong` | Bordure standard — champs, boutons, puces |
| `border-soft` | `#3a3734` | `#e4d9c6` | `border` | Séparateur intérieur, ligne de table, cadre de carte |
| `ink` | `#ede3d1` | `#1b1a19` | `text` | Texte principal |
| `ink-dim` | `#cfc3ae` | `#3f3a34` | `text-2` | Texte secondaire, libellés |
| `ink-dimmer` | `#a89a86` | `#6b6259` | `text-3` | Texte tertiaire (rare) |

⚠️ **`bar` n'est pas `panel`.** En Forge, la barre est un cran sous la carte
(1,08) et un cran au-dessus du fond (1,05) : c'est la toile. En Atelier, elle
vaut `panel` — la toile les confond — et c'est son filet qui la détache du
fond.

### Accent et sémantique

| Token | Forge | Atelier | Rôle |
|-------|-------|---------|------|
| `accent` | `#ff7a1a` | `#ff7a1a` | La braise VIVE : aplats seulement (`bg-accent`, bouton principal) |
| `accent-lisible` | `#ff7a1a` | `#a64f11` | La braise qui se LIT : texte, contour d'état, focus, trait de graphique |
| `accent-hover` | `#ff9a4d` | `#e0620a` | Survol de l'APLAT de braise (bouton principal) — R3a |
| `accent-appui` | `#e0620a` | `#e0620a` | Appui du même aplat ; en Atelier, il ne peut pas foncer plus sans que l'encre passe sous 4,5 (4,90) |
| `accent-soft` | `#3a2415` | `#ffeddd` | Fond d'un élément actif — en Forge, le « braise sombre » de la toile depuis le R3a (il valait `#3d2c1f`, fondu à 12 %) |
| `accent-ink` | `#1b1a19` | `#1b1a19` | Texte posé SUR un aplat de braise (bouton principal plein) |
| `good` | `#73e06b` | `#2f6b36` | Au tick, gain, succès — et **ton camp** |
| `good-soft` | `#253024` | `#e3f1e3` | Fond doux de `good` |
| `warn` | `#f2c230` | `#7c630d` | Avertissement — **jaune / ocre** (décision 46 du rebranding) ; il était orange et se confondait avec la braise |
| `warn-soft` | `#39311b` | `#fbedb7` | Fond doux de `warn` — en Atelier hors construction (voir index.css) |
| `bad` | `#f27a84` | `#a3303a` | Hors tick, destructif, erreur |
| `bad-soft` | `#372324` | `#f8e4e3` | Fond doux de `bad` |
| `bad-ink` | `#1b1a19` | `#ffffff` | Encre SUR un aplat de `bad` (bouton danger plein) — le pendant d'`accent-ink` |
| `star` | `#c9a227` | `#8c6d0e` | Le laiton : étoiles, maxima d'efficience |

⚠️ **« Orange » dans les specs = `warn`.** Le statut d'avertissement s'appelle
encore `orange` dans le code (`statutEquipe`, les verdicts) et dans les specs
écrites avant la décision 46 ; il se DESSINE en jaune / ocre. Lire `warn`, pas
une teinte. (Ne concerne pas les couleurs du jeu : rareté légendaire, part de
meule, etc.)

⚠️ **Deux braises, un seul nom de classe** (décisions 4 et 11 du rebranding).
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
SVG des courbes (`rgb(var(--accent-lisible))`). (`.title-gradient`, le dégradé
des grands titres, a disparu avec la décision 57 du rebranding : les titres
sont à l'encre unie.)

⚠️ **L'avertissement ressemble à l'accent — assumé** (décision 12). La toile
donne à `warn` la valeur du survol de la braise : ΔE 6,7 avec l'accent en
Forge, 3,8 avec la braise lisible en Atelier (29 avant, avec l'indigo). Aucun
ambre lisible ne s'en éloigne vraiment en clair (ΔE 10 au mieux, un brun
terne). Un avertissement se lit donc à son **libellé** — une pastille écrite,
décision 8 de la refonte — jamais à sa seule couleur.

⚠️ **Vert et rouge de Forge : plus saturés que la toile** (décision 13 —
Le mainteneur : « ça me paraît pâle »). La toile donne `#9fd39a` et `#e5848a`,
pastel. Même clarté OKLCH et même teinte, chroma relevée à mi-chemin du
maximum : `#73e06b` et `#f27a84`, contraste inchangé (8,35 et 5,23 au pire).
Le rouge garde sa teinte rosée : le ramener vers le corail de l'ancien rouge
le rapprochait de la braise (ΔE 7,7) et du Feu. Atelier garde ceux de la
toile. Sur l'aplat rouge, le blanc tombait à 2,66 en Forge : d'où `bad-ink`,
sombre en Forge (6,53), blanc en Atelier (6,91).

**Fonds doux : la vivacité d'avant, dans la teinte de la toile.** Chacun
prend la plus vive (chroma OKLCH) de deux constructions : la teinte fondue à
12 % dans `panel`, ou la chroma et l'écart de clarté de l'ancien fond doux
reportés sur le nouveau `panel`. ⚠️ Le 12 % seul a été posé d'abord, puis
repris (le mainteneur, R1 : « ça me paraît pâle », les camps du speed tuning) : la
sémantique de la toile est pastel, et la fondre dans un fond brun donnait des
gris à peine teintés — le vert des camps à la moitié de sa chroma d'avant.
L'encre y fait 9,71 au pire (Forge) et 13,99 (Atelier). L'accent et la
sémantique restent lisibles sur leur propre fond doux (4,91 au pire,
`accent-lisible` en Atelier) ; un élément pas toujours (3,92 à 10,85) — ses
fonds doux portent l'encre, jamais la couleur de l'élément en texte.

⚠️ **`warn-soft` ferme le trio, il ne l'ouvre pas.** `good-soft` et `bad-soft`
existaient, l'ambre non : toute surface qui voulait dire « à corriger » devait
donc soit emprunter `bad-soft` (et faire passer un avertissement pour une
erreur), soit poser une opacité en dur. Les trois états sémantiques ont
maintenant chacun leur fond doux, construits pareil — la teinte fondue dans le
fond de page, pas une transparence.

⚠️ **`good-soft` et `bad-soft` comblent un AXE, pas une variante de plus** :
l'accent et les éléments avaient leur fond doux, la sémantique non. Ils vont par
PAIRE et servent à **opposer deux camps** (speed tuning : `good` = ton équipe,
`bad` = en face) là où une transparence ne convient pas — une colonne collante
passe par-dessus le tableau qui défile dessous, il lui faut un fond SOLIDE.

⚠️ **Deux camps, c'est de la SÉMANTIQUE, pas de l'accent.** L'accent dit « ceci
est actif ou sélectionné » — il ne dit pas à qui appartient une ligne. Et sur le
thème Forge il était cuivre (braise depuis le rebranding, orange lui aussi) : « ton équipe » y virait à l'orange, à un cheveu du
`warn` d'à côté. `good`/`bad` disent l'état de la donnée, et `bad` portait déjà
« ce qui te coupe » : la paire se referme d'elle-même.

⚠️ **La sémantique n'est pas l'accent.** `good`/`warn`/`bad` disent un état des
données ; `accent` dit « ceci est actif ou sélectionné ». Les confondre rend un
filtre actif indiscernable d'une alerte.

⚠️ **`accent-ink` n'est jamais du blanc.** Sur la braise, le blanc tombe sous
le seuil ; l'encre sombre de la toile (`#1b1a19`) y fait **6,66**, dans les
deux thèmes. En Atelier, l'aplat de braise ne se détache du fond qu'à 2,30 —
sous le 3,0 d'un élément d'interface — mais un bouton plein porte son
libellé, et c'est lui qui l'identifie. Mesures du R1
([preuve](../chantiers/rebranding-preuves/lot-R1.md)).

### Rayon intérieur : `rounded-lg-inner`

⚠️ **Un enfant à FOND PLEIN collé au bord d'un panneau arrondi doit rentrer d'un
pixel.** À rayon égal, son fond déborde dans l'arrondi et le coin redevient
carré — c'est visible dès que l'enfant est teinté (bandeau de titre d'une carte,
colonne collante d'un tableau).

`rounded-lg-inner` vaut `calc(var(--radius-lg) - 1px)` : le rayon du panneau
moins son contour, 7 px (voir [Rayons](#rayons)).

⚠️ **`overflow-hidden` sur le parent n'est PAS la solution** : il règle le coin
mais coupe les menus flottants, qui se placent en `absolute` à l'intérieur du
panneau.

### UN SEUL marqueur de sélection

⚠️ **Un élément sélectionné porte UN marqueur, jamais deux.** L'app cumulait
jusqu'à quatre signaux pour dire une seule chose — `bg-accent-soft` +
`border-accent` + `text-accent` + `shadow`. Le résultat est une zone qui se
surligne elle-même deux fois : on ne lit plus « c'est sélectionné », on voit un
empilement qui bave sur ses voisins, et l'écran devient bruyant dès que trois
filtres sont posés.

**Le marqueur dépend du support** — un seul dans les deux cas :

| Support | Marqueur | Pourquoi pas l'autre |
|---------|----------|----------------------|
| **Champ de saisie** (`select`, `input`, `textarea`) | `border-accent` | Un fond coloré passe derrière du texte qu'on doit lire, et concurrence le curseur |
| **Pastille de filtre** (`Pastille`, sets, emplacements, étoiles du Bestiaire) | `MARQUEUR_FILTRE_ACTIF` : `border-accent bg-accent-soft text-ink` | **La couleur de l'app, teintée** (refonte graphique, décision 9, 2026-09-24) : le contour porte l'état, le fond le rend lisible d'un coup d'œil. Depuis le rebranding (décision 20), le fond est le « braise sombre » de la toile (`accent-soft`, `#3a2415` en Forge), au lieu de la braise à 25 % ; **sans la coche ni le gras** de la toile, qui élargissaient la pastille au clic. Contraste mesuré : texte 11,44 (Forge) et 15,23 (Atelier) ; contour, en `accent-lisible`, 5,58 et 4,91. Une couleur inversée (aplat d'encre) a été essayée puis écartée par le mainteneur : un aplat blanc en thème sombre. Une seule constante, exportée de `Pastille`, importée par les filtres qui ne passent pas par elle. ⚠️ **Exception, à la souris : les filtres de sets et d'emplacements des RUNES** prennent le gabarit et le marqueur du `Segmented` (sans contour ; un aplat de braise depuis la décision 19) — posés sur une ligne à côté du filtre des antiques, qui EST un `Segmented`, deux marqueurs se lisaient comme deux familles de boutons (le mainteneur : « que les boutons aient tous la même tête », lot 8a ; `gabaritFiltre.ts`) |
| **Cran de `Segmented`, onglet** | `bg-accent text-accent-ink` (le cadre porte le contour) | Un choix UNIQUE dans un cadre commun, pas un filtre en rangée. **Un APLAT de braise** depuis le rebranding (décision 19, la planche « Actions » de la toile) — il gardait le fond d'accent léger depuis la décision 9. Toujours un seul marqueur. Encre dessus : 6,66 |

⚠️ **Les pastilles voisines partagent le même marqueur.** Les numéros de
`SlotFilter`, les sets de `SetFilter`, les étoiles du Bestiaire et les filtres
de Ma box (Nat / Doublons / 2A) portent tous **le même fond d'accent teinté** —
deux marqueurs différents côte à côte se liraient comme deux natures de
filtre. C'est la brique `Pastille` ([librairie-ui.md](librairie-ui.md)) qui le
définit, dans `MARQUEUR_FILTRE_ACTIF`, une fois pour toutes.

**Corollaires :**

- ⚠️ **`shadow` n'est JAMAIS un marqueur d'état.** L'ombre dit l'élévation — ce
  qui flotte au-dessus du reste. Un filtre actif ne décolle pas de la page. Elle
  reste donc aux popovers, menus et dialogues, et disparaît des états actifs.
- ⚠️ **`text-accent` ne se cumule pas avec un fond.** Sur `accent-soft`, l'encre
  d'accent perd du contraste au lieu d'en gagner : le libellé d'un élément
  sélectionné devient moins lisible que ses voisins non sélectionnés. Le texte
  passe à `ink` sur fond actif.
- ⚠️ **Le marqueur d'état est UNIQUE : `border-accent bg-accent-soft text-ink`**
  — un contour d'accent et un fond très léger. Le contour porte l'état, le fond
  ne fait que l'appuyer : `accent-soft` seul ne se voyait pas, étant un fond de
  panneau trop proche du gris ambiant.
  ⚠️ Il a remplacé un **dégradé doré plein** sur les filtres d'étoiles, les
  pastilles de tick et les filtres de la box. Celui-ci criait plus fort que le
  réglage ne le mérite, et faisait surtout **deux vocabulaires selon l'écran** —
  un filtre actif ne doit pas se lire différemment ici et là.
  **Deux exceptions**, qui n'en sont pas vraiment :
  - La **case à cocher** d'un dialogue (15 px) garde son remplissage plein : un
    contour de 1 px y disparaît, et une case cochée se lit par son remplissage.
  - Les boutons de **lead SPD** (ordre de tour) gardent le doré : ce n'est pas un
    marqueur d'état mais le **code couleur du lead** lui-même, celui de
    `LeadPill`.
- Le **survol** garde `hoverable:border-accent` sur les contrôles à fond : il
  agit au repos, quand aucun marqueur n'occupe la bordure — il n'y a donc pas de
  cumul. ⚠️ **Sauf les BOUTONS** (`Bouton`, `BoutonIcone`, le « ⋯ »), depuis
  la décision 16 de la refonte graphique : leur survol peint le **fond**
  (`panel2`, `bad-soft` en danger), comme `.btn-secondary` / `.btn-ghost` de
  la maquette. Pastilles, champs et cartes cliquables gardent le contour.

**Focus mis à part.** L'anneau `:focus-visible` (voir plus bas) n'est pas un
marqueur de sélection mais la position du clavier — les deux peuvent coexister
sur un même élément. C'est justement pour qu'ils restent distinguables que
l'état sélectionné n'a droit qu'à un seul signal : quand la bordure d'accent
d'un `select` posé se doublait de l'anneau d'accent à 2 px, on lisait un seul
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

(Tableau réaligné sur [index.css](../../src/index.css) au rebranding R1 : il
avait décroché du code — Feu donné à `#E4463A` / `#c23528`, etc. Le R1 n'a
changé AUCUNE couleur d'élément.)

⚠️ **La teinte est conservée, jamais remplacée.** Le Vent reste jaune-ocre, il ne
devient pas vert. Un joueur qui repère ses monstres Vent à la volée dans une
liste dense doit continuer à le faire.

Les icônes officielles (`public/elements/`) restent **inchangées** dans les deux
thèmes : ce sont des images du jeu, elles portent leur propre fond.

### Trois familles, trois rôles stricts

| Famille | Police | Rôle | Usages |
|---------|--------|------|--------|
| `font-display` | **Cinzel** | Titres et héros | ~26 |
| `font-body` | **Source Sans 3** | Tout le texte, **libellés compris** | défaut |
| `font-mono` | **JetBrains Mono** | **Chiffres uniquement** | ~96 |

Source Sans 3 remplace Inter au rebranding (R1), comme dans la toile ; les
**tailles** ne bougent pas (décision 7 : le corps de 17 px de la charte vaut
pour elle, pas pour la densité de nos listes).

⚠️ **Une quatrième police, hors de ce système : `font-marque` (Saira 700)**,
le NOM de l'app et rien d'autre — dans le logo (`Logo.tsx`, `CLASSE_NOM` :
capitales espacées) et le héros de l'accueil. Choisie par le mainteneur avec la
nouvelle identité de logo (rebranding R2 bis, décision 24). Les titres restent
en Cinzel : Saira n'est pas une police de titre, c'est la signature.

⚠️ **La mono ne sert qu'à ce qui s'aligne.** Efficiences, vitesses, ticks,
compteurs — des colonnes qu'on compare d'une ligne à l'autre. `tabular-nums` est
posé d'office sur `.font-mono` : sans lui, un « 1 » plus étroit décale toute une
colonne.

⚠️ **JetBrains Mono, pas Space Mono.** Space Mono a des chiffres larges et mous,
illisibles en 11 px — or c'est la taille à laquelle on lit une efficience dans
une liste de 60 tuiles. JetBrains Mono est dessinée pour le petit corps :
hauteur d'x haute, zéro barré, `1` à empattement.

### Le libellé en capitales : une classe, pas un motif

Le motif `font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim` était
répété **55 fois**, à sept tailles différentes. Il devient la classe `.label`.

⚠️ **Dans la police du texte, pas en mono.** Une mono en capitales espacées
est large et molle à 11 px — c'est ce qui donnait cette impression de flou dans
les zones denses. Une linéale en demi-gras est plus nette et plus compacte à
taille égale. `.label` lit `theme('fontFamily.body')` : Inter jusqu'au
rebranding, Source Sans 3 depuis, sans rien réécrire.

### Échelle typographique — plancher à 11 px

| Token | Taille | Usage |
|-------|--------|-------|
| `micro` | 11 px | Libellés mono en capitales, sous-titres de KPI |
| `xs` | 12 px | Texte secondaire, corps de tuile |
| `sm` | 13 px | Texte courant dense (tables, cartes) |
| `md` | 14 px | **Navigation seulement** — voir ci-dessous |
| `base` | 15 px | Texte courant |
| `lg` | 17 px | Titre de section |
| `xl` | `clamp(22px, 3vw, 30px)` | Titre de page |

⚠️ **`md` n'est pas un cran de l'échelle générale.** Il existe pour une seule
raison : la barre latérale du **bureau** se lisait serrée à 13 et trop appuyée à
15 — une colonne de neuf entrées qu'on parcourt du regard, pas du texte de
lecture. Il a été **ajouté à l'échelle** plutôt que posé en `text-[14px]` sur
place : une valeur en dur aurait été hors système, et la première d'une série,
puisque le cran manquant le serait resté.

⚠️ **Ne pas s'en servir pour du corps de texte.** Entre `sm` et `base`, il cale
une densité, il ne marque pas un niveau d'information : deux blocs voisins en
`sm` et `md` se liraient comme une hésitation, pas comme une hiérarchie.

⚠️ **Plancher à 11 px, sans exception.** Les `text-[9px]` et `text-[10px]`
existants remontent à 11 px. En dessous, l'écart ne crée pas de hiérarchie : il
crée du flou.

⚠️ **Pas de demi-pixel.** Les paliers 10.5, 11.5, 12.5, 13.5 et 14.5 px
disparaissent. Un écart de 0,5 px entre deux libellés voisins ne se lit pas comme
une intention, il se ressent comme un défaut d'alignement.

Le héros de l'accueil garde son `clamp()` propre : c'est un titre d'affiche, pas
un palier de l'échelle.

### Rayons

| Token | Classe | Valeur | Rôle |
|-------|--------|--------|------|
| `radius` | `rounded` | 6 px | Petit élément : pastille, badge, touche |
| `radius-lg` | `rounded-lg` | 10 px | Bouton, champ, liste déroulante |
| `radius-xl` | `rounded-xl` | 14 px | Carte, panneau |
| `radius-2xl` | `rounded-2xl` | 20 px | Fenêtre : dialogue, panneau mobile |

**Les mêmes dans les deux thèmes** (refonte graphique, décision 2 du mainteneur,
2026-09-24, [cadrage](../chantiers/refonte-graphique.md)). Forge assumait
jusque-là l'angle vif (4 / 6 px) ; il l'abandonne pour un rendu d'application
plus doux, commun aux deux thèmes. Les valeurs sont celles de la toile depuis
le rebranding (R1) ; elles valaient 6 / 8 / 12 / 14.

⚠️ **`rounded-xl` et `rounded-2xl` sont REDÉFINIS** dans `tailwind.config.js`.
C'étaient les valeurs figées de Tailwind (12 et 16 px), hors tokens : une
classe qui ne suit pas le système se change partout d'un coup ou nulle part.
`rounded-md` (6 px) et `rounded-sm` (2 px) restent ceux de Tailwind ;
`rounded-full` n'a pas de token (un cercle ou une pilule).

### Mouvement

| Token | Valeur | Usage |
|-------|--------|-------|
| `--ease-out` | `cubic-bezier(.23, 1, .32, 1)` | Entrées, sorties, pression |
| `--ease-in-out` | `cubic-bezier(.77, 0, .175, 1)` | Déplacement à l'écran |

⚠️ **Jamais `ease-in` sur un élément d'interface** : il démarre lentement, à
l'instant précis où l'utilisateur regarde. Une même durée paraît plus lente.

⚠️ **Framer Motion ne lit pas les variables CSS** dans son champ `ease`. Les
courbes s'y écrivent donc en points de Bézier — `[0.23, 1, 0.32, 1]`, la
constante `EASE_OUT` de l'accueil — et **jamais** en `'easeOut'` natif, qui est
plus mou : la page démarrait sur une courbe que rien d'autre dans l'app
n'utilise. Seule exception : `easeInOut` sur une **boucle** de va-et-vient (les
icônes qui flottent), où l'aller-retour doit ralentir aux deux extrémités.

Durées : pression 150 ms · infobulle 125 ms · popover 150 ms · modale 200 ms.
**Rien au-dessus de 300 ms** dans l'interface.

⚠️ **`prefers-reduced-motion: reduce`** coupe les **déplacements** et les boucles
infinies (les cinq icônes d'élément de l'accueil), **garde les fondus** — un
mouvement réduit reste un mouvement, pas une absence de retour.

#### Ce qui s'anime, et ce qui ne s'anime pas

⚠️ **La fréquence décide.** Ce qu'on voit cent fois par jour ne s'anime pas :
l'animation y ajoute une attente à chaque passage, et une interface qu'on
connaît par cœur doit répondre instantanément. Ce qui est occasionnel peut
s'annoncer.

| Fréquence | Décision | Exemples ici |
|-----------|----------|--------------|
| Permanent, à chaque frappe | **Aucune animation** | Liste de résultats du `MonsterPicker`, tuiles de rune et d'artéfact, filtres |
| Fréquent | Retour immédiat seulement | Pression au clic (150 ms), survols |
| Occasionnel | Entrée animée | Menus, popovers, dialogues, retour d'import |

Quatre keyframes, déclarés une fois dans `index.css` :

| Keyframe | Mouvement | Pour |
|----------|-----------|------|
| `popover` | fondu + `scale(.96)` | Menus et popovers **ancrés** |
| `voile` | fondu seul | Le fond d'un dialogue |
| `dialogue` | fondu + 8 px + `scale(.98)` | La boîte d'un dialogue |
| `apparition` | fondu + 4 px | Un message ou un bloc qui se pose **en place** |

- ⚠️ **Un flottant ancré grandit depuis SON ANCRE**, jamais depuis son centre :
  `origin-top-left`, ou `origin-top-right` s'il est calé à droite. Sorti du
  centre, on cherche des yeux une origine qui ne correspond à rien.
- ⚠️ **La boîte de dialogue fait exception** et reste centrée : elle n'a pas
  d'ancre, elle ne sort d'aucun bouton.

### ⚠️ Un clic ne déplace JAMAIS ce qu'on vient de cliquer

**Règle globale, mobile et bureau.** Quand une action ouvre quelque chose — le
détail d'une rune, la grille de monstres d'une catégorie, un panneau dépliant —
l'élément **sur lequel on a cliqué reste exactement où il était**. On doit
pouvoir basculer l'état plusieurs fois d'affilée **sans bouger la souris ni le
regard**.

Ce que cela interdit :

| Motif | Pourquoi il déplace |
|-------|---------------------|
| Insérer le détail **au-dessus** de la ligne cliquée | Tout ce qui est en dessous descend, la ligne cliquée avec |
| Faire pousser un conteneur qui **précède** la cible dans le flux | Même effet, un cran plus haut |
| Ouvrir un panneau qui **change la hauteur de la page** et fait défiler | Le pointeur ne vise plus rien |
| Réserver la place **seulement quand c'est ouvert** | La réservation arrive trop tard : le saut a déjà eu lieu |

Ce que cela impose — trois réponses, dans cet ordre de préférence :

1. **La place est réservée d'avance.** Le détail d'une rune a sa colonne (ou son
   bloc) présente en permanence, vide tant qu'on n'a rien choisi. Ouvrir ne fait
   que la remplir. ⚠️ C'est la seule réponse qui tient quand on **enchaîne** les
   clics d'un élément à l'autre : la place ne change pas d'une rune à la suivante.
2. **Ce qui s'ouvre sort du flux** — un flottant ancré, un dialogue, un panneau
   mobile. Rien de ce qui est en dessous ne bouge, parce que rien n'est poussé.
3. **Ce qui s'ouvre pousse vers le BAS uniquement**, jamais vers le haut, et
   l'ancre reste au-dessus du point d'insertion (un accordéon dont l'en-tête ne
   bouge pas).

⚠️ **Le tactile n'en est pas dispensé.** Le doigt ne « reste » pas sur sa cible,
mais l'écran, lui, saute.

⚠️ **La réponse n° 3 est souvent la bonne au doigt**, et la n° 2 souvent la
mauvaise : un flottant ancré s'ouvre exactement là où le doigt vient de se poser,
et la main masque ce qu'on voulait lire. Le détail d'une rune se pose donc SOUS
la roue au doigt, et dans un flottant ancré à la souris — même composant, deux
placements.

⚠️ **Attention à ce qui CONTIENT la cible.** Un panneau collé au bas de l'écran
ne peut grandir que vers le haut : déplier quoi que ce soit dedans remonte tout
son contenu, alors même que ce qui s'ouvre est bien placé — en dessous de ce
qu'on a touché. C'est ce qui se passait en choisissant les monstres d'une
catégorie RTA depuis « Options ». Le panneau lui-même était bon ; c'est le tiroir
qui bougeait. **`MobileSheet` fige donc sa hauteur à l'ouverture** (mesure en
`useLayoutEffect`) : le bord supérieur ne bouge plus, et un contenu qui grandit
se lit en faisant défiler.

⚠️ **Ne pas confondre avec « le contenu ne change pas ».** Le contenu *doit*
changer, et peut s'animer (voir plus haut) ; c'est la **géométrie autour de la
cible** qui est figée.

### ⚠️ Un bouton d'action ne disparaît jamais — il se désactive

Un bouton dont l'existence dépend des données (« Tout exporter » sans rien à
exporter, « Tout effacer » sans rien à effacer, « Analyser » sans compte
importé) reste **toujours affiché**, et se pose en `disabled` avec un `title`
qui dit pourquoi — il ne sort jamais du rendu conditionnel `{condition &&
<Bouton />}`.

⚠️ **Un bouton qui apparaît une fois qu'on a de quoi l'utiliser surprend** : on
ne l'a jamais vu apparaître d'un geste volontaire, il était juste absent, et
rien n'explique d'où il sort. Désactivé, c'est un repère fixe de l'interface —
on sait que l'action existe, juste pas encore qu'elle s'applique.

Cette règle vaut pour les **boutons d'action**, pas pour tout ce qui se
rend conditionnellement :
- **Les changements de MODE restent conditionnels** — un panneau d'édition qui
  remplace un contrôle par un autre (le titre d'une recommandation devient un
  champ de saisie) n'est pas la même nature de disparition.
- **Un bloc de filtre/recherche entier** peut rester absent d'une page vide,
  si ce choix est documenté et réfléchi (voir « UN SEUL bloc de filtres » dans
  [rta/categories.md](../rta/categories.md) et
  [siege/recommandations.md](../siege/recommandations.md)) : un filtre
  au-dessus d'une liste vide n'a rien à filtrer, et laisse parfois croire
  qu'on n'a rien trouvé alors qu'il n'y a rien.

### Ce qui se confirme, et ce qui ne se confirme pas

⚠️ **Un geste se confirme quand ce qu'il détruit ne se retrouve pas.** Le critère
n'est pas le mot « supprimer » sur le bouton, c'est le coût de l'erreur.

**Se confirme** — la donnée est saisie à la main et perdue sans retour :

| Geste | Ce qui part |
|-------|-------------|
| Retirer un monstre d'un slot de siège | Sa vitesse saisie, son tick |
| Supprimer un monstre créé à la main | Le monstre entier : il n'existe pas dans les données du jeu |
| Supprimer une section RTA | Le classement — les monstres, eux, reviennent en « Non classé » |
| Supprimer / vider une catégorie | L'appartenance, cochée un monstre à la fois |
| « Tout effacer » (prépa, équipes, recommandations) | Tout le côté |
| Effacer les données du compte | Tout |

**Se DÉFAIT au lieu de se confirmer** (refonte graphique, lot 13, décision
29 du mainteneur) — le geste se fait tout de suite, puis une **notification
« … · Annuler »** le laisse revenir en arrière quelques secondes :

| Geste | Notification |
|-------|--------------|
| Retirer un monstre de la prépa RTA | « {Monstre} retiré de ta prépa » |
| Supprimer une équipe de siège | « Équipe retirée de la défense / de l'offense » |
| Supprimer un deck | « Deck supprimé » |
| Supprimer une recommandation | « Recommandation supprimée » |

⚠️ **« Annuler » remet l'élément À SA PLACE, tel quel** — même position dans
la liste, mêmes vitesses, mêmes sets, même section —, pas une copie ajoutée
au bout. Voir « Notification « Annuler » » plus bas.

**Ne se confirme PAS** — l'état se repose en un geste :

| Geste | Pourquoi |
|-------|----------|
| Effacer un filtre (sets, slots, éléments) | Un clic pour le reposer |
| Vider une recherche | Idem |
| Retirer un critère de recherche | C'est un critère, pas une donnée |
| Retirer un lead de l'ordre de tour | Il revient en le retapant |
| Retirer un set d'une combinaison en édition | Le geste EST le sujet de l'écran |

⚠️ **Confirmer partout est pire que ne confirmer nulle part.** À force d'en voir,
on valide sans lire — et celle qui compte vraiment passe inaperçue. Deux clics
pour annuler un filtre useraient la patience qu'on veut garder pour l'effacement
d'une prépa.

### Notification « Annuler »

`src/ui/Notification.tsx` (refonte graphique, lot 13, décision 29, la
maquette) — un fournisseur monté une fois par `App.tsx`, et `useNotifier()`
pour annoncer un geste qui se défait (tableau plus haut).

- **À la souris, en bas à droite** (rebranding, décision 23 — la planche
  « Retours et fenêtres » ; elle était centrée) ; **au téléphone, en bas,
  centrée, au-dessus de la barre d'onglets et du bouton « Options »**,
  jamais dessous. Fond `panel2`, un cran au-dessus des cartes qu'elle
  survole. `role="status"` : un lecteur d'écran l'annonce sans voler le focus.
- **Le message, « Annuler », et une croix** pour la fermer. « Annuler » est
  le « fantôme » de la toile : texte braise, sans cadre. **6 secondes**,
  puis elle s'en va ; le survol et le focus la retiennent tant qu'on y est.
- **Une seule à la fois** : la suivante remplace la précédente, dont le
  geste devient alors définitif — deux notifications empilées se liraient
  comme deux choses à décider.
- « Annuler » **restaure l'élément à sa place** (fonctions `restaurer*` des
  hooks, qui réinsèrent à l'index d'origine) puis ferme la notification.
- **Deux axes nés de l'application de bureau** (voir
  [le cadrage](../chantiers/application-bureau.md), lot 5) :
  - **le libellé de l'action** (`libelleAction`, « Annuler » par défaut ; le
    rappel s'appelle `action`) — « Nouvelle version 2.0.1 disponible ·
    **Mettre à jour** », « Mise à jour prête · **Redémarrer** ». Une seule
    action, jamais « Annuler » et une autre côte à côte ;
  - **la durée** (`persistante`) : une **question** reste jusqu'à l'action
    ou la croix, au lieu de 6 secondes — elle ne s'efface pas avant qu'on
    l'ait lue. Défaut : 6 secondes, comme les gestes qui se défont.
- ⚠️ « Une seule à la fois » vaut aussi pour elle : un geste qui se défait
  pendant qu'une question est affichée la remplace (pour la mise à jour,
  elle revient au lancement suivant).
- Même gabarit que les flottants de l'app : fond `panel`, contour 1 px,
  ombre des panneaux.

### Bloquer le défilement derrière un flottant

⚠️ **Par `useScrollBloque`, jamais à la main.** Chaque composant mémorisait la
valeur d'`overflow` à son ouverture pour la restaurer à sa fermeture. Avec un
seul flottant, cela marche ; imbriqués, non :

1. le panneau d'actions s'ouvre, mémorise `''`, pose `hidden` ;
2. une confirmation s'ouvre par-dessus, mémorise `hidden`, repose `hidden` ;
3. on confirme — le panneau se ferme d'abord et restaure `''` ;
4. le dialogue se ferme ensuite et restaure… `hidden`.

La page restait bloquée, **sans qu'aucun flottant ne soit visible pour
l'expliquer**. Le hook tient un compteur : le blocage tombe quand le dernier
verrou est relâché, jamais avant, jamais après — et le résultat ne dépend plus de
l'ordre de démontage.

### L'échelle des plans

⚠️ Deux éléments au **même `z-index`** se départagent par leur ordre dans le
DOM — celui monté en dernier passe devant. C'est ainsi qu'une confirmation
ouverte depuis le panneau d'actions se retrouvait **derrière lui** : tous deux à
`z-50`, et le panneau monté après. On cliquait « Supprimer », rien ne semblait se
produire, et le geste paraissait dépourvu de confirmation.

| Plan | Niveau | Qui |
|------|--------|-----|
| Contenu | — | La page |
| Barre supérieure | `z-20` | Elle passe sous la barre latérale |
| Barre latérale, bouton « Options » | `z-30` | La navigation |
| Barre d'onglets | `z-40` | Sous le panneau qui la recouvre |
| Panneau d'actions | `z-50` | Recouvre la navigation |
| Panneau de second niveau | `z-60` | Recouvre le panneau d'où il sort |
| **Dialogues** | **`z-70`** | **Au-dessus de tout** |

⚠️ **Une confirmation est le dernier mot de l'interface : rien ne se met devant
elle.** Tout dialogue modal — `Modale`, `ConfirmDialog`, et les voiles écrits à
la main comme celui de l'export RTA — porte `z-[70]`.

### Un flottant ne sort jamais de l'écran

⚠️ **`max-width` ne suffit pas.** Il borne la LARGEUR ; un panneau ancré à gauche
d'un déclencheur déjà proche du bord droit sort quand même, parce que c'est sa
POSITION qui dépasse. Le cas se produit dès que la place du déclencheur varie :
une pilule de catégorie au bout d'une rangée, un bouton qui a bougé parce qu'un
libellé s'est allongé, une vignette en fin de ligne. Aucune règle CSS statique ne
peut savoir où ce déclencheur-là se trouve.

Tout flottant **de largeur fixe ancré à gauche** passe donc par
`useRecalageEcran` (`src/hooks/`), qui mesure sa position réelle après rendu et
le ramène dans l'écran :

| Flottant | Ancré sur |
|----------|-----------|
| Création / édition de catégorie | Une pilule, ou « + Catégorie » |
| Création de monstre | Un bouton de barre d'outils ou de panneau |
| Note d'une défense (recommandations) | Une vignette de rangée |

- **`left`, jamais `transform: translateX()`.** Une transformée déplace ce qu'on
  VOIT, mais la boîte de mise en page reste où elle était : le débordement
  subsiste et la page garde son défilement latéral — le bug qu'on prétendait
  corriger. `left` déplace la boîte elle-même.
- Le flottant doit donc porter **`left-0` explicite**. Sans ancrage horizontal
  posé (`left: auto`), une valeur négative ne décale pas : elle repositionne
  depuis un bord que le navigateur choisit seul.
- Le hook pose aussi un **`max-width` mesuré**, car sur un écran plus étroit que
  le flottant le décalage ne suffit pas — il faut le rétrécir.
- **`useLayoutEffect`, pas `useEffect`** : la mesure a lieu avant peinture, le
  flottant ne s'affiche jamais hors cadre, même une image.
- **L'état d'ouverture est passé au hook.** Le flottant n'est monté que lorsqu'il
  est ouvert ; une `ref` ne provoque pas de rendu, donc rien ne redéclencherait
  la mesure à l'ouverture.
- **Remesure au redimensionnement** : une rotation de téléphone change la largeur
  sous un flottant déjà ouvert.
- Les flottants **ancrés à droite** (`right-0`) et ceux **larges comme leur
  ancre** (`w-full`) n'en ont pas besoin — leur position ne peut pas dépasser.

### Jamais de défilement latéral

`html` et `body` portent `overflow-x: hidden` (`index.css`) — **les deux**, car
le navigateur propage le débordement de `body` à `html` quand `body` est seul à
le masquer. Mais ce n'est **qu'un filet de sécurité** : le contenu déborde
toujours, il est simplement coupé, donc inatteignable.

Les quatre causes rencontrées, par ordre de fréquence :

| Cause | Correctif |
|-------|-----------|
| `min-w-[Npx]` rigide | S'écrit `min-w-[min(Npx,100%)]` |
| `minmax(Npx, 1fr)` dans une grille | S'écrit `minmax(min(100%,Npx), 1fr)` |
| Enfant flex qui refuse de se réduire | `min-w-0` — la valeur par défaut est `auto`, qui interdit de passer sous la largeur du contenu |
| Flottant de largeur fixe ancré à gauche | `useRecalageEcran` (voir plus haut) |

⚠️ Le symptôme apparaît **loin de sa cause** : un `min-width` calibré pour une
carte fait défiler la page entière, et on le constate sur un écran qui n'a rien à
voir avec le composant fautif. C'est ce qui rend ces bugs coûteux à chercher — et
pourquoi ils reviennent.

### Le zoom iOS se règle sur le `viewport`, pas sur la taille du texte

⚠️ **`maximum-scale=1` sur la balise `viewport`** ([index.html](../../index.html)).
C'est là qu'est sa place, et deux tentatives précédentes ont montré pourquoi :

| Tentative | Ce qu'elle donnait |
|-----------|--------------------|
| 16 px sur tous les champs, en permanence | Une barre de recherche qui écrit plus gros que le menu déroulant posé à côté — un même écran à deux échelles |
| 16 px en `:focus` seulement | Le champ **change de taille sous le doigt** en s'activant, texte et cadre compris : ça se lit comme un défaut, pas comme une protection |

Le seuil de 16 px contaminait une décision d'interface (la taille du texte) avec
une contrainte de plateforme. Sorti du CSS, les champs de saisie se posent à
**13 px** — la taille des menus déroulants voisins, un champ ne devant écrire ni
plus gros ni plus petit qu'eux.

⚠️ **Le zoom à deux doigts reste possible.** Depuis iOS 10, Safari ignore cette
restriction pour un geste de l'utilisateur et ne l'applique qu'au zoom qu'il
déclenche lui-même. C'est ce qui rend la valeur acceptable, là où un
`user-scalable=no` — qui bloque vraiment — ne le serait pas.

### Les trois pièges d'iOS

⚠️ **`overflow-x: hidden` ne retient PAS un élément `fixed`.** Safari laisse la
page défiler latéralement dès qu'un flottant dépasse la largeur du viewport : la
règle ne borne que le flux normal, pas ce qui en est sorti. `body` porte donc
`position: relative` et `width: 100%`, et un dernier filet plafonne les `.fixed`
et `.sticky`.

⚠️ **`100vh` inclut la barre d'adresse**, qui se replie au défilement : la page
devenait alors plus haute que l'écran, d'où un saut de mise en page à chaque
changement de sens. Toutes les hauteurs de viewport sont en **`dvh`**, avec
`vh` en repli pour les navigateurs qui l'ignorent.

⚠️ **`viewport-fit=cover` est obligatoire** dans le `<meta viewport>`. Sans lui,
`env(safe-area-inset-*)` vaut **zéro** : toutes les gardes posées sur l'encoche
ou sur la barre de geste sont alors inertes, sans que rien ne le signale. La
barre supérieure passait ainsi sous l'encoche, et l'on ne pouvait pas remonter
jusqu'aux premiers éléments de la page.

⚠️ La barre supérieure **descend sous l'encoche** (`height: calc(3rem +
env(safe-area-inset-top))` + `padding-top`), et le dégagement du contenu suit.
Une valeur fixe laissait le haut de la page sous la barre.



⚠️ **Le « tirer pour recharger » est CONSERVÉ** — c'est un geste attendu sur un
téléphone. Il a été bloqué un temps parce qu'il se déclenchait *avant* que le
contenu n'ait atteint le haut, mais c'était traiter le symptôme.

⚠️ Deux causes se cumulaient pour le déclencher trop tôt.

**La hauteur de `body` était en `dvh`** : cette unité suit la hauteur courante du
viewport, donc elle **change** quand la barre d'adresse se replie ou se déplie.
En remontant, la barre se déplie, `dvh` diminue et la page raccourcit sous le
doigt — le défilement se retrouve poussé au-delà du haut.

**La page ne pouvait pas défiler sous la barre supérieure.** Quand son contenu
tient dans l'écran, il n'y a rien à faire défiler : le navigateur est « en haut »
dès le départ, et le moindre geste vers le bas déclenche le rechargement — avant
même qu'on ait vu le premier bloc, qui se trouve pourtant **derrière la barre**.
La hauteur minimale de `body` ajoute donc celle de la barre : il reste toujours
de quoi remonter, et « en haut » signifie bien « je vois le début du contenu ».

`svh` est la hauteur du plus **petit** état (barre dépliée) et ne bouge jamais.
C'est la bonne unité pour une hauteur de page. `dvh` reste correct sur les
**plafonds** d'éléments fixes (`max-h` d'un panneau, d'un dialogue), qui doivent
au contraire suivre la hauteur visible.

⚠️ **`overflow-x: hidden` vit sur `html`, jamais sur `body`.** C'est `html` qui
défile ; sur `body`, la propriété en fait un **second conteneur de défilement**
dont la hauteur se borne au viewport — la molette n'a alors plus rien à faire
défiler sur un écran de bureau.

| Propriété | Sur `html` | Sur `body` |
|-----------|-----------|------------|
| `overflow-x: hidden` | ✅ la garde | ❌ immobilise la page |
| `min-height: 100svh` | — | ✅ hauteur de page |
| `position: relative` + `width: 100%` | — | ✅ largeur de référence des `fixed` |

⚠️ **Safari grossit les polices en paysage** (« text autosizing ») si rien ne
l'en empêche : les tailles calculées ne valent alors plus rien et un bloc dessiné
pour tenir déborde. `html` porte `-webkit-text-size-adjust: 100%`.

⚠️ **Un détecteur nomme le coupable en développement**
(`src/lib/detecteurDebordement.ts`). Il parcourt le DOM après chaque changement,
ne retient que l'élément **le plus profond** qui dépasse — un enfant trop large
déborde tous ses parents, les signaler tous noierait le vrai coupable — et
l'écrit dans la console avec le nombre de pixels en cause. Il est éliminé du
bundle de production (`import.meta.env.DEV`).

⚠️ Il compare à `documentElement.clientWidth`, **jamais** à `window.innerWidth` :
le second inclut la barre de défilement verticale, et tout paraîtrait déborder de
~15 px sur desktop. C'est aussi pourquoi `100vw` est trompeur dans un `calc()`.

⚠️ Le **panneau d'actions mobile** reçoit une garde supplémentaire : ses enfants
flex et grid ont `min-width: 0` d'office. Il accueille des contrôles dessinés
pour une rangée desktop de 900 px, où un `min-width` calibré là-bas déborde
systématiquement.
- ⚠️ **Jamais depuis `scale(0)`** : rien n'apparaît de nulle part. `.96` au
  minimum.
- ⚠️ **Pas de `scale` sur du texte** (`apparition`) : la mise à l'échelle
  déforme les lettres pendant l'animation, et rien ne « grandit » — le message
  se pose, il n'arrive pas de loin.
- La boîte d'un dialogue est **plus lente que son voile** (200 vs 150 ms) : elle
  doit finir après le fond qu'elle recouvre, sinon elle semble le précéder.

## Contraste — mesuré, jamais estimé

⚠️ **Toute valeur de couleur se vérifie au ratio WCAG avant d'être posée.** Le
premier jet du thème clair « paraissait » correct : à la mesure, `ink-dimmer`
était à 2,65, le vent à 3,39 et `star` — qui porte les maxima d'efficience — à
3,14. Rien de tout cela ne se voit à l'œil sur un écran calibré.

| Rôle | Seuil | Tenu par |
|------|-------|----------|
| Texte courant | **4,5** | `ink`, `ink-dim`, `ink-dimmer`, `accent-lisible`, `good`, `warn`, `bad`, `star` |
| Couleurs d'élément | **4,5** | les six, sur `panel` (voir l'arbitrage plus bas) |
| Bordure porteuse de sens | **3,0** | `accent-lisible` (champ actif, sélection, focus) |
| Aplat | *son libellé* | `accent` (bouton plein : `accent-ink` dessus, 6,66) |
| Bordure décorative | *aucun* | `border`, `border-soft` |

**Les trois surfaces comptent.** Un token doit passer sur `bg`, `panel` **et**
`panel2` — c'est `bg` la plus exigeante en thème clair, `panel2` en sombre.

### Le ratio ne suffit pas : la saturation aussi

⚠️ **Un ratio conforme ne garantit pas qu'on voie la couleur.** WCAG mesure la
luminance, pas la présence d'une teinte. Le vent est passé à 5,12 sur blanc tout
en restant pâle et indistinct — conforme, invisible.

Les couleurs d'élément visent donc **deux critères** : ratio ≥ 4,5 **et**
saturation ≥ 45 %. Assombrir une couleur vers le gris satisfait le premier et
trahit le second ; il faut saturer, pas seulement foncer.

| Élément | Clair | Sombre | Note |
|---------|-------|--------|------|
| Feu | 85 % | 77 % | — |
| Eau | 100 % | 74 % | — |
| Vent | 100 % | 79 % | Jaune franc, jamais kaki |
| Lumière | 70 % | 17 % | Doré en clair ; en sombre c'est du blanc, la couleur du jeu |
| Ténèbres | 68 % | 71 % | — |
| Inconnu | 17 % | 16 % | Gris par nature — un monstre non identifié |

⚠️ **Vent et Lumière : arbitrage assumé.** Un jaune reste jaune tant qu'il est
clair ; l'assombrir jusqu'à 4,5 sur `bg` le fait virer au kaki, et le joueur ne
reconnaît plus son élément. On tient donc **4,5 sur `panel`** — la surface des
cartes et des listes, où ces libellés apparaissent réellement — et on accepte
moins sur `bg`, qui ne porte quasiment aucun texte d'élément : ~3,6 sur
l'ancien fond, 4,29 au lot 14, **4,08 depuis le rebranding** (fond de papier
chaud ; 3,74 sur `panel2`). Ce sont des libellés courts et gras, pas du texte
courant. Même tolérance pour les paliers du résumé de compte et pour le laiton
(`star`, 4,79 sur `panel`, 3,93 sur `panel2`).
**Règle gardée au rebranding** (décision 8) : 4,5 sur `panel`, rien de plus.
Sur les fonds de la toile, elle n'a fait bouger que deux paliers, d'un
cheveu : `pal-1` en Atelier (4,47 → 4,53) et `pal-6` en Forge (3,35 → 4,52).
Mesures complètes : [preuve du R1](../chantiers/rebranding-preuves/lot-R1.md).

### Les trois surfaces se distinguent deux à deux

`panel2` sert **à la fois** de fond enfoncé sur `panel` (détail de rune, piste de
barre) et de surface posée sur `bg`. Il lui faut donc un écart perceptible avec
les deux — ni confondu avec le blanc, ni avec le fond de page.

| Paire | Forge | Atelier |
|-------|-------|---------|
| `panel2` / `panel` | 1,15 | 1,22 |
| `panel2` / `bg` | 1,31 | **1,09** (1,04 au lot 14) |
| `panel` / `bg` | 1,14 | **1,12** |

(Valeurs du rebranding R1.)

C'est ce qui manquait quand le détail d'une rune « semblait n'avoir aucun fond » :
`panel2` était à 1,08 de `panel` — l'écart `panel2` / `panel` est tenu.
⚠️ **Arbitrage du lot 14** : avec les fonds neutres et clairs de la maquette,
`panel2` ne se distingue presque plus de `bg`. Une surface `panel2` posée
directement sur la page est séparée par sa BORDURE, pas par son fond — le
choix de la maquette, retenu par le mainteneur. De même, une carte `panel` ne se
détache du fond qu'à 1,08 au lot 14 (1,28 avant), 1,12 depuis le rebranding :
un papier clair sur un papier chaud, avec son contour.

### Raretés : deux couleurs, deux usages

`RARITY_META` ([effects.ts](../../src/lib/effects.ts)) porte **deux** couleurs
par rareté, parce qu'elles servent à deux choses :

- **`color`** — la couleur vive du jeu, posée sur la **bannière** dont le fond
  est un dégradé sombre dans les deux thèmes. Elle ne change jamais.
- **`ink`** — la couleur de **texte** sur un panneau (valeur d'efficience d'une
  tuile, légende du résumé). Elle suit le thème via `--rarity-1..5`.

⚠️ Utiliser `color` comme couleur de texte est le bug qu'il faut éviter : le vert
magique `#7cf0a6` sur fond blanc est illisible.

⚠️ **`border` et `border-soft` sont volontairement sous 3,0** (depuis le
rebranding, les deux bordures de la toile : en clair `border` 1,50 à 1,83,
`border-soft` 1,13 à 1,37 ; en sombre 1,86 à 2,44 et 1,18 à 1,54 —
`border-soft` pour les cadres, `border` un cran plus marquée pour qu'on voie
où taper). Ce
seuil vaut pour un contour qui *porte une information* — un champ de saisie, un
élément sélectionné. Une bordure de carte est décorative : la monter à 3,0
quadrillerait une interface qui affiche 60 tuiles par écran. Ce qui distingue
une carte, c'est sa surface (`panel` sur `bg`), pas son trait.

### Une seule source par thème

Les valeurs de Forge vivent dans des variables `--forge-*` déclarées **une fois**,
que les deux déclencheurs (media query et `[data-theme="dark"]`) se contentent de
référencer.

⚠️ **Ne jamais recopier la liste dans les deux blocs.** Elle l'a été, et les
copies ont divergé en une seule session : le thème forcé gardait des couleurs
sous le seuil pendant que celui du système était corrigé. Un thème qui change
selon la façon dont on l'a activé est un bug indétectable à la lecture.

## Règles transverses

### ⚠️ Les tokens sont des TRIPLETS, pas des couleurs

Les variables de couleur valent `255 122 26`, **pas** `#ff7a1a` : c'est ce qui
permet à Tailwind d'y appliquer une opacité (`bg-accent/10`). Elles ne sont donc
utilisables **que** enveloppées :

```
stroke="rgb(var(--accent))"   ✅
stroke="var(--accent)"        ❌ attribut invalide → RIEN n'est peint
```

⚠️ **L'échec est SILENCIEUX** : pas d'erreur, pas d'avertissement, le trait
n'existe simplement pas. C'est ce qui a rendu invisibles les repères verticaux
des courbes de runes. Le piège guette surtout les **attributs SVG**
(`stroke`, `fill`), où l'on écrit la couleur à la main au lieu de passer par une
classe Tailwind.

### Aucune couleur Tailwind native

⚠️ **`amber-400`, `emerald-500`, `sky-300` sont interdits.** Ce sont des valeurs
figées : elles ne suivent pas le thème, exactement comme un hexadécimal. La
vérification des ticks ATB était illisible en clair pour cette raison — un
`text-amber-300` sur fond blanc.

| Interdit | À utiliser | Sens |
|----------|-----------|------|
| `amber-*` | `warn` | Avertissement |
| `emerald-*` | `good` | Succès, gain, au tick |
| `sky-*` | `water` | Information |
| `rose-*`, `red-*` | `bad` | Erreur, hors tick |

Les nuances 300/400/500 se réduisent à **un seul token** : la variation de
luminosité est déjà portée par le thème (`--warn` vaut `217 164 65` en sombre,
`138 87 12` en clair). Garder trois nuances reproduirait le problème.

⚠️ **Les aplats sémantiques sont à /10, jamais à /5.** Sur fond clair, un aplat à
5 % ne se distingue pas du panneau — l'aura d'une équipe hors tick disparaissait.

⚠️ **Pas de halo en `rgba()` figé.** Un `shadow-[0_0_20px_rgba(245,158,11,.65)]`
est un halo orange vif : correct sur fond sombre, criard sur fond clair. Utiliser
la bordure et l'anneau, qui passent par les tokens.

*Exception* : les `rgba()` noirs ou blancs sur les **icônes du jeu**
(`drop-shadow`) restent — ils fonctionnent dans les deux thèmes.

### ⚠️ `autoFocus` fait DÉFILER la modale

Le navigateur défile jusqu'à l'élément focalisé. Un `autoFocus` posé sur un
bouton situé **sous une longue liste** ouvre donc la boîte **tout en bas**, sur
ses boutons, le contenu invisible — c'est ce qui est arrivé à la recherche
détaillée de sous-propriétés, où le bouton « OK » suit 40 lignes.

La coquille `Modale` ([Dialogs.tsx](../../src/ui/Dialogs.tsx)) pose donc
le focus initial sur **la boîte elle-même** (`tabIndex={-1}` +
`focus({ preventScroll: true })`), et remet son défilement en haut. Elle ne le
fait **que si rien à l'intérieur n'a déjà pris le focus** : un `autoFocus`
délibéré — le champ d'un `PromptDialog`, l'« Annuler » d'une confirmation — reste
prioritaire.

**Règle** : `autoFocus` est réservé à ce qu'on va **utiliser tout de suite** (un
champ de saisie), et seulement dans une boîte **qui tient à l'écran sans
défiler**.

### Croix de fermeture — sur ce qu'on consulte, pas sur ce qu'on décide

Une modale se ferme par **Échap** et par le **clic à côté**. Ni l'un ni l'autre
ne se **voit** : sur une boîte qui ne fait que montrer quelque chose, rien
n'indique par où sortir, et on cherche.

`Modale` porte donc une **croix optionnelle** (`croix`), posée en coin :

- ⚠️ **Sur les modales de CONSULTATION** — la fiche d'un monstre, d'une rune,
  un outil ouvert par-dessus une page. Elles ne demandent rien, donc elles n'ont
  aucun bouton, donc aucune sortie visible.
- ⚠️ **Et alors elles n'ont PAS de pied non plus.** Un « Fermer » en bas à droite
  ferait doublon avec la croix — deux portes pour la même sortie — et coûterait
  une **bande entière**, soit ~50 px. Sur une modale qui prend 90 % de la hauteur
  d'écran pour montrer un tableau, ce sont deux lignes de données en moins au
  profit d'un bouton qui ne dit rien de plus que la croix. La croix reste à sa
  place habituelle, en haut à droite : on ne la déplace pas en bas sous prétexte
  qu'on a retiré le pied.
- ⚠️ **Pas sur les CONFIRMATIONS ni les boîtes de choix** : leur « Annuler »
  **est** la sortie. Une croix à côté ferait deux portes pour une décision qui
  n'en a qu'une, et on hésiterait sur ce qu'elle ferme — abandon, ou simple
  fermeture ?
- ⚠️ **Nue** — ni cadre, ni fond. Encadrée, elle se lisait comme un **bouton
  d'action de plus**, au même rang que ce qu'on est venu consulter. Le symbole
  se reconnaît seul et s'éclaircit au survol. Seule une **ombre portée** reste :
  sans fond, la croix passe devant le contenu qui défile dessous, et un trait
  fin sur du texte devient illisible.
- ⚠️ **`sticky`, jamais `absolute`** : la boîte **défile**, et une croix absolue
  part vers le haut dès les premières lignes d'une fiche longue — c'est-à-dire
  exactement au moment où on la cherche. Hauteur nulle (`h-0`) et décalages
  négatifs : elle se pose dans le padding sans pousser le contenu d'une ligne.
- Elle vit **dans la coquille**, pas dans chaque fiche : posée au cas par cas,
  elle aurait fini à trois endroits différents selon la modale.

### Les deux bandes d'une modale : un trait, et seulement s'il dit quelque chose

L'en-tête et le pied ne défilent pas ; le corps, si. Sans rien entre les deux, le
contenu se glisse **sous** les bandes : une card coupée en deux au bord de la
bande, et on ne sait plus si elle est tronquée ou si c'est la fin de la liste.

- ⚠️ **Le trait est une INFORMATION, pas une décoration** : « il y a autre chose
  au-dessus / en dessous ». Il n'apparaît donc que lorsque du contenu passe
  réellement derrière la bande — mesuré au défilement **et** au redimensionnement
  du corps (un panneau qui s'ouvre change la donne sans qu'on ait défilé). Posé
  en permanence, il mentirait sur une modale dont tout tient à l'écran, et
  alourdirait les confirmations.
- **1 px, `border-border`, un seul** — comme partout. Quand il apparaît, le corps
  reprend son rembourrage haut (ou bas) : sinon une card viendrait toucher le
  trait, ce qui ferait **deux contours superposés**.
- ⚠️ **Densité (`bandes`) : c'est un AXE, pas une variante.** `compactes` retire
  de la hauteur aux deux bandes **sans toucher au corps**. C'est ce qu'il faut à
  une modale qui contient un **outil entier** (le speed tuning prend 90 % de la
  hauteur d'écran) : chaque pixel de bande y est une ligne de tableau en moins.
  Une confirmation garde l'air par défaut. `compactes` **remplace** le
  rembourrage des bandes au lieu de s'y ajouter, et suppose donc le `padding` par
  défaut pour l'axe horizontal.
  - ⚠️ **Le rythme d'une bande n'est pas celui du corps.** Une bande ne porte
    qu'une ligne de texte ou un bouton : lui donner les 16 px du corps lui fait
    manger la hauteur d'une ligne de tableau pour rien. `compactes` la met à
    **8 px** — et le sous-titre y passe en `leading-snug`, une interligne de
    lecture longue n'ayant pas de sens sur une phrase unique.

### Cibles tactiles — 40 px au doigt

```css
@media (pointer: coarse) {
  button, a[role='button'], [role='tab'], summary,
  input, select { min-height: 40px; }
  button.aspect-square, a.aspect-square { min-width: 40px; }
}
```

L'app est dessinée pour la **souris**, qui vise au pixel : les pastilles de
filtre tombent à 26 px, les boutons d'icône à 32. Au doigt on tape à côté, et
sur une rangée de filtres serrée on active le **voisin**.

- ⚠️ Conditionné à **`(pointer: coarse)`**, jamais à une largeur : ce n'est pas
  l'écran qui est petit, c'est le doigt qui est gros. Une tablette au stylet
  garde les tailles fines ; un téléphone en paysage les agrandit quand même.
  C'est le pendant de la variante `hoverable`, qui règle le même problème pour
  le survol.
- ⚠️ Seuls la **hauteur** et la largeur changent — jamais la taille du texte ni
  les couleurs. Une interface qui se réécrit au doigt devient une autre
  interface, et on ne retrouve plus ce qu'on connaît.
- ⚠️ Les boutons **carrés** (icône seule) portent `aspect-square` et gagnent
  aussi en largeur : agrandis en hauteur seulement, ils devenaient des
  rectangles avec l'icône flottant dans un vide vertical.
- ⚠️ **Un bouton qui perd son libellé sous `sm` perd aussi son CADRE.** Il
  devient une icône nue : ni bordure, ni fond. Le cadre était dimensionné pour un
  mot qui n'est plus là — gardé, il fait un rectangle vertical où l'icône flotte ;
  rendu carré, il déclenche les 40 px de la règle tactile et l'on obtient six
  gros carrés dans une barre qu'on cherchait à compacter.
  Le cadre n'apprend d'ailleurs rien : **l'icône dit l'action, sa présence dit
  qu'on peut la toucher.** Il revient à la souris, où la barre a la place et où
  le survol a besoin d'une surface à colorer.
- ⚠️ Une icône nue reste **exemptée** (`data-cible-fine`) et reçoit
  `.cible-tactile` : 20 px dessinés, 44 touchables.
- ⚠️ **L'écart entre icônes nues double** (`gap-4` contre `gap-2`). Sans cadre
  pour les délimiter, six icônes à 8 px d'intervalle se lisent comme une frise
  continue — c'est l'espace qui remplace le trait.
- ⚠️ …mais dans le **panneau d'actions mobile**, le libellé revient (voir
  navigation.md) : la règle `[data-tiroir] button.aspect-square` relâche alors la
  contrainte de forme, sinon le mot déborderait d'un carré. Le marqueur est
  `aspect-square` et non `.h-8` — un sélecteur sur le nom de classe Tailwind
  aurait cassé au premier ajustement de taille.
#### Le nom du monstre est la RÉFÉRENCE

⚠️ Sur une carte de monstre, **rien ne doit peser plus lourd que son nom** sauf
la valeur principale — et celle-ci reste dans un rapport de **1,3** avec lui, pas
davantage. À 2,2 (26 px contre 12), la vitesse était le seul élément qu'on
voyait ; le reste de la carte devenait un décor.

⚠️ Les **capitales espacées** pèsent plus lourd que leur taille ne le dit :
`.label` à 11 px avec `letter-spacing: 0.08em` occupe autant qu'un mot de 13 px
en bas de casse. Au doigt, la classe descend à 10 px et son espacement de moitié
— le rôle d'un libellé est de nommer, pas de rivaliser.

⚠️ Le cran **`nano` (10 px) n'existe que sous `compact:`** : c'est le secours du
tactile, pas une taille de l'échelle générale. Il sert aux mentions qui
accompagnent une valeur sans être lues pour elles-mêmes (« base 107 »). En
dessous, on ne lit plus.

#### Densité d'un bloc répétitif

⚠️ **Ce qui compte n'est pas la taille du texte mais la HAUTEUR DU BLOC.** Le
panneau de stats en est l'exemple : huit lignes à 12 px plus 8 px d'interligne
font ~190 px de haut — il pesait plus lourd que les trois monstres au-dessus,
alors qu'il ne fait que les détailler. Le texte n'était pourtant pas gros.

Au doigt, un bloc de plus de cinq lignes descend donc d'un cran (`compact:`) :
texte à 11 px, interligne de moitié, rembourrage du cadre réduit. À la souris,
rien ne change — la place ne manque pas.

⚠️ Le repère de référence est le **nom du monstre** juste au-dessus : le panneau
doit rester en dessous de lui dans la hiérarchie, puisqu'il le détaille.

#### Quand la taille EST le dessin

⚠️ **Certains contrôles ne peuvent pas grandir sans cesser d'être eux-mêmes.**
Un interrupteur de 22 px porté à 40 devient un cercle dont la pastille pend en
haut ; une pastille ronde devient un ovale. La règle les cassait au lieu de les
servir.

Trois réponses, selon ce qui gêne :

| Marqueur | Effet | Pour qui |
|----------|-------|----------|
| `.cible-tactile` | Zone touchable de 44 px par pseudo-élément, **dessin inchangé** | `Switch` — la hauteur est sa forme, mais il est isolé |
| `data-cible-fine` | Exempté, **aucune** zone étendue — vaut pour les boutons **comme pour les champs** (`input`, `select`) | Le crayon et la corbeille d'une pilule de catégorie : collés l'un à l'autre, une zone de 44 px les ferait se chevaucher et on supprimerait en voulant éditer |
| `data-carte-dense` | 32 px au lieu de 40 | Un contrôle seul sur la largeur de sa carte — rater y est improbable |

⚠️ **`.cible-tactile` est la réponse par défaut** dès qu'un contrôle a une forme
qui porte du sens : elle rend la cible utilisable sans rien déformer. Les deux
autres sont des exceptions qu'il faut justifier — la première parce qu'un
voisinage serré rend la grande cible dangereuse, la seconde parce que le contexte
protège déjà du ratage.

⚠️ **`.cible-tactile` pose `position: relative` sur ELLE-MÊME** (`index.css`)
— pas seulement sur son `::after`. Incident vécu : deux porteurs
(`Pager.tsx`, et `BoutonIcone.tsx` via `zoneEtendue` — utilisé par
`HelpPopover.tsx`, donc quasiment partout dans l'app) posaient la classe sur
un élément resté `position: static`, en comptant sur la convention « tous
les porteurs sont déjà `relative` » sans l'appliquer. Le `::after` (`position:
absolute`) remontait alors jusqu'au premier ancêtre RÉELLEMENT positionné —
souvent `<body>` — et calculait `width/height: 100%` de LUI, pas du petit
bouton : un pseudo-élément invisible de la taille de la page entière
(mesuré : 390×4670 px sur un cas réel), centré dessus, interceptant les
clics/survols d'éléments sans aucun rapport ailleurs sur l'écran — un
utilisateur l'a décrit comme « impossible de cliquer sur une rune », et
« l'infobulle du bouton Page suivante apparaît en survolant une carte de
rune ». Poser `relative` sur la classe elle-même ferme la catégorie entière
plutôt qu'un seul appelant — ne plus compter sur chaque appelant pour s'en
souvenir.

- Les **champs de saisie** aussi : viser un `<input>` de 28 px au doigt demande
  autant de précision qu'un bouton, et rater ouvre le clavier au mauvais
  endroit.

⚠️ **Incident vécu** : les cadres de rune (`RuneWheel.tsx`) et d'artéfact
(`ArtifactSlots.tsx`), à échelle réduite dans les cartes de résultat de
l'Optimizer (`BuildCandidateCard.tsx`), n'avaient PAS `data-cible-fine` —
hérités de `main` sans cet attribut lors de la fusion de `forge/refonte-ui`.
`min-height: 40px` gagnait contre la hauteur fixée en ligne : le cadre
s'étirait (une roue de 6 runes ne tient que 94 px, une cible de 44 px par
rune aurait de toute façon chevauché ses voisines — même cas que la pilule
de catégorie ci-dessus, à vérifier en premier sur tout futur cadre de jeu
réduit sous `compact:`).

### Focus — une règle globale, pas 24 exceptions

```css
:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
```

⚠️ **`outline-none` est interdit sans remplacement visible.** L'app comptait 24
`outline-none` et zéro `focus-visible` : en tabulant, on ne savait jamais où on
était.

⚠️ **1 px, comme tout contour de l'app.** L'anneau en faisait 2, détachés de 2 px
de plus : un halo de quatre pixels autour de chaque contrôle atteint au clavier,
qui bavait sur ses voisins dans une rangée serrée. C'est le **contraste** qui
fait un marqueur de focus, pas l'épaisseur.

⚠️ **Un contrôle qui marque déjà le focus par sa BORDURE n'a pas d'anneau du
tout.** Un `<select>` ou un champ en `focus:border-accent` teinte sa propre
bordure à la mise au point ; l'anneau par-dessus faisait un second trait d'accent
collé au premier, soit 3 px autour d'un contrôle qui n'en demandait qu'un. Le
focus reste porté par la bordure, qui change de couleur au moment précis où le
clavier arrive.

⚠️ En revanche, une bordure d'accent **permanente** (un critère posé, un filtre
actif) ne dit rien du clavier — elle est là avant et après. L'anneau reste donc,
mais collé à elle.

### Survol — toujours derrière une media query

```css
@media (hover: hover) and (pointer: fine) { … }
```

Exposé en variante Tailwind **`hoverable:`**. ⚠️ Un `hover:` nu reste allumé
après un tap au tactile : on croit avoir sélectionné quelque chose.

### Pression

Tout élément cliquable porte `active:scale-[0.97]` avec
`transition-transform duration-150`. Un bouton qui ne bouge pas au clic laisse un
doute d'un dixième de seconde.

⚠️ **Sauf les boutons de la librairie** (rebranding, décision 21 — la
planche « Actions » de la toile) : un `Bouton` (donc aussi `BoutonIcone`)
**descend d'1 px**, et le principal fonce (`accent-appui`). La règle vit dans
`index.css` (`button[data-bouton]`, et `a[data-bouton]` pour un `Bouton`
lien — axe `href`, lot 6 de l'application de bureau ; attribut posé par
`Bouton`), plus
spécifique que celle du rétrécissement ; les cartes, poignées et autres
surfaces cliquables gardent `scale(0.97)`.

### Un élément atteignable ne dépend jamais du survol

⚠️ **`hidden group-hover:*` est interdit** sur un contrôle. L'élément sort du
flux : il n'est ni focusable au clavier, ni atteignable au doigt. Utiliser
`opacity-0 hoverable:group-hover:opacity-100 focus-visible:opacity-100`, et le
laisser visible sous `(hover: none)`.

C'est ce qui rendait le bouton « Retirer » d'une carte RTA **impossible à
actionner sur téléphone**.

### Exporter ↑, importer ↓

⚠️ **Exporter = `Upload` (flèche vers le haut), importer = `Download`
(flèche vers le bas)**, partout : boutons, actions de la palette, zone de
dépôt, étapes de l'accueil. Le fichier qui **sort** de l'app monte, celui
qui **entre** descend — même « Exporte ton compte » de l'accueil, où le
fichier sort du jeu. Ne pas raisonner « on télécharge un fichier, donc
`Download` » : c'est l'inversion qui revenait.

## Réglage du thème

Dans le menu ⚙ ([SettingsMenu.tsx](../../src/components/SettingsMenu.tsx)), un
`<Setting>` « Thème » avec un `<Segmented>` à trois options :

| Option | Comportement |
|--------|--------------|
| **Auto** (défaut) | Suit `prefers-color-scheme`, et **change à chaud** si le système bascule |
| **Clair** | Force Atelier |
| **Sombre** | Force Forge |

⚠️ **Trois états, pas un interrupteur.** Un binaire clair/sombre force à choisir
une valeur qui cesse alors de suivre le système : quelqu'un dont le téléphone
bascule le soir perdrait ce comportement sans l'avoir demandé.

Le thème s'applique par un attribut `data-theme` sur `<html>` (`light` / `dark`),
posé **avant la première peinture** par un script inline dans `index.html` —
sinon la page apparaît dans le mauvais thème le temps d'un frame.

## Ce que ce document ne couvre pas

- **Le responsive.** Chantier séparé et assumé (voir
  [README](../README.md#conventions-communes-toutes-les-pages)). Les tokens ci-dessus
  sont indépendants de la largeur.
- **Les icônes du jeu** (`public/elements/`, `public/icons/`,
  `public/leader-skills/`) : ce sont des ressources Com2uS, hors système visuel.
- **Les couleurs de rareté de rune** (`RARITY_META` dans
  [effects.ts](../../src/lib/effects.ts)) : vocabulaire du jeu, comme les
  éléments. Elles suivront la même logique deux-valeurs si un besoin apparaît.
