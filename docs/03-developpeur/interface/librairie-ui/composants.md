# Librairie UI — composants à part entière

Partie de [Librairie UI](README.md).

### Composants à part entière

#### `BarreActions`

**`BarreActions`** — les actions d'un EN-TÊTE d'écran : **toutes en boutons
quand elles tiennent sur la ligne, sinon les actions `toujours` + un `Menu`
« ⋯ »** pour les `autres`. Les entrées sont les mêmes `ElementMenu` dans les
deux formes (libellé, icône, désactivation et raison, `danger` rangé en
dernier derrière un filet) : aucune action n'existe que dans l'une. Demandé par
Le mainteneur (RTA, lot 6) : « sur PC, afficher ces boutons si on a la place ».
⚠️ **La place se MESURE** : une copie invisible et `inert` de la rangée complète
est comparée à la largeur disponible, à chaque redimensionnement. Un point de
rupture fixe se tromperait — la place dépend aussi de la barre latérale
(dépliée ou repliée) et du titre de l'écran. ⚠️ En rendu serveur et au premier
rendu, c'est le **menu** (la forme qui tient partout) ; le basculement se fait
dans un `useLayoutEffect`, avant la première peinture. Tous ses boutons ont la
hauteur d'en-tête (`HAUTEUR_EN_TETE`).
Un axe d'entrée en plus de `danger` (lot 7a, Siège) : **`actif`** — un
bouton à deux états (`aria-pressed`, fond d'accent enclenché), qui devient une
entrée à cocher (`menuitemcheckbox`) s'il tombe dans le menu.
⚠️ **Pas d'axe « principal »** : aucune action n'est mise en avant dans un
en-tête d'écran. Un aplat d'accent a été essayé sur « Vérifier mes speed » et
retiré par le mainteneur (« ça rend pas bien ») — décision 4 précisée.

#### `Menu`

**`Menu`** — un bouton « ⋯ » (nommé par `libelle`) qui ouvre sous lui,
ancrée à droite, une liste d'actions (`Flottant`, `role="menu"`).
⚠️ **Le « ⋯ » a la hauteur des boutons d'EN-TÊTE, 36 px au doigt, 32 px à
la souris** (`HAUTEUR_EN_TETE`, exportée ; 32 = un bouton `md`, décision 16) — pas les 28 px d'un `BoutonIcone` : posé à côté
d'un bouton d'action (« Exporter » dans la RTA), il faisait deux hauteurs
voisines, lues comme deux familles de boutons (relevé par le mainteneur). Les
boutons voisins s'y alignent en reprenant la constante. C'est un `Bouton`
carré dimensionné, pas un `BoutonIcone` dont on écraserait le `h-7` : deux
hauteurs dans la même classe, l'ordre de la feuille de style trancherait. Chaque entrée : icône, libellé, `disabled` + `title` pour dire
pourquoi, et `danger` pour un geste qui perd quelque chose — rangé en dernier,
derrière un filet, en `bad`. Clavier : flèches, Début / Fin, Échap (rend le
focus au bouton), Tab referme ; un clic dehors aussi.
⚠️ **Les entrées restent dans le DOM, menu fermé** (`hidden`) : un bouton ne
quitte jamais le DOM selon l'état de l'écran, et c'est ce qui laisse les tests
de rendu retrouver chaque action, son état et sa raison.
⚠️ **Monté à son PREMIER usage** (la RTA, refonte graphique lot 6, décision
13), contre la règle du deuxième (« Quand ajouter quelque chose ») : l'écrire
dans l'écran aurait fait un contrôle MAISON — ce que la règle qui gouverne tout
le reste interdit — et les maquettes en posent un dans plusieurs écrans.
**Deux axes** nés de la carte du compte (application de bureau, lot 9 : le
choix de l'invocateur « au niveau du menu principal ») : `declencheur` — le
bouton qui ouvre le menu, quand ce n'est pas le « ⋯ » ; il reçoit ce qu'il doit
poser sur son bouton (`ref`, `aria-haspopup`, `aria-expanded`,
`aria-controls`, `onClick`), et le menu prend alors toute la largeur ; `cote`
— le bord auquel la liste s'aligne (droite par défaut ; gauche pour la carte
en tête de barre latérale). Une entrée `actif` (`menuitemcheckbox`) ne se
dessine pas cochée d'elle-même : l'appelant met la coche en icône.

⚠️ **Pas de `Deroulant` (filtre fermé dans un menu)** : ajouté au lot 8a pour
les filtres des runes (la maquette), puis retiré le même jour, sans autre
usage — le mainteneur n'a voulu aucun filtre fermé dans un menu (« sors tout des
boutons »). Un filtre fermé ne dit pas ce qu'il filtre sans qu'on l'ouvre.
Voir [02-app/compte/feat-runes/filtres-set-et-slot.md](../../../02-app/compte/feat-runes/filtres-set-et-slot.md) § Filtrer par set.

#### `Champ`

**`Champ`** — saisie texte. ⚠️ `compact:text-base` n'est **pas un choix de
taille, c'est un correctif** : sous 16 px, iOS **zoome** sur le champ à la mise
au point, et la page ne revient pas seule de ce zoom. C'est la seule raison pour
laquelle un champ grossit au doigt alors que tout le reste rétrécit. Écrit une
fois ici, ce piège ne peut plus être oublié dans un formulaire neuf.

⚠️ **Un texte saisi est TRIMÉ à la sortie du champ**, jamais à la frappe.
Les espaces de tête et de queue ne veulent rien dire — mais « Defs G3 » et
« Defs G3&nbsp;&nbsp;» se lisent pareil à l'écran tout en étant deux chaînes
différentes partout ailleurs : dans un nom de fichier exporté, dans une
comparaison, dans un tri.

- ⚠️ **À `onBlur`, jamais à `onChange`** : trimer pendant la frappe empêche
  d'écrire une espace entre deux mots.
- Les espaces et retours à la ligne **intérieurs sont conservés** : ils font
  partie de la mise en forme voulue par l'auteur (voir les consignes des
  recommandations, rendues en `whitespace-pre-line`).
- Le trim est **rejoué à l'écriture et à la lecture** d'un fichier partagé
  (`texteSortant` / `cleanText` dans
  [recoShare.ts](src/lib/recoShare.ts)) : un fichier peut avoir été bricolé à
  la main, et la saisie d'une version antérieure a pu laisser passer des
  espaces.
- Les champs de **recherche** ne sont pas trimés à la frappe non plus —
  l'espace y est un caractère de saisie comme un autre.

#### `NumberField`

**`NumberField`** — saisie numérique, deux boutons − / + encadrant la valeur
(jamais `type="number"` : les flèches natives sont hors charte). ⚠️ Axe
**`sansBoutons`** pour les **grilles denses** — une cellule numérique par case
d'un tableau (les mods de speed tuning) : les boutons disparaissent, il ne reste
que le champ (on saisit au pavé numérique). Deux boutons de 24 px par cellule
rendraient la grille illisible ; le cadre et la logique de frappe restent ceux du
composant, ce n'est pas un input nu.
⚠️ Axe **`ton`** (`neutre` / `good` / `bad`) : ce que la valeur **veut dire**, pas
un habillage. Une grille de modificateurs mêle des gains et des pertes, et le
signe seul — en mono 12 px au milieu de quarante colonnes — ne saute pas aux
yeux. Il teinte le **texte et le contour**, jamais le fond : un fond plein par
cellule ferait un damier, et ces tableaux portent déjà des surlignages.

⚠️ **`type="text"` + `inputMode="numeric"`, jamais `type="number"`**, partout
dans l'app. Les flèches natives du navigateur sont deux triangles gris
minuscules, hors charte, impossibles à styler et pénibles à viser (surtout au
tactile) : le composant dessine ses propres boutons **− à gauche, + à droite**,
et `inputMode="numeric"` fait remonter le pavé numérique sur mobile. Un champ
`number` garde aussi le **texte tapé tel quel** : saisir « 015 » donne bien `15`
dans l'état, mais la valeur ne changeant plus au caractère suivant, React ne
réécrit pas le DOM et le **zéro de tête reste affiché**. En `text`, la valeur
rendue est toujours celle de l'état, donc le zéro disparaît à la frappe.

La frappe non numérique est **ignorée** : plus prévisible qu'un champ qui se
vide ou se corrige pendant qu'on tape.

- ⚠️ **Un appui PROLONGÉ sur − ou + fait défiler la valeur en continu**, et la
  cadence **accélère**. Ces champs portent des valeurs qui varient sur des
  dizaines d'unités (une vitesse de 180 à 240, un minimum de crit de 15 à 85) :
  un pas par clic imposerait soixante clics, ou de repasser par le clavier
  alors qu'on a déjà le doigt sur le bouton. À cadence fixe, il faudrait
  choisir entre trop lent pour traverser 60 unités et si vif qu'on dépasse
  toujours sa cible.
  - Le défilement démarre après **400 ms** — assez pour qu'un clic ordinaire,
    même mou, n'en déclenche jamais un et ne fasse pas sauter la valeur de deux.
  - Il **s'arrête à la butée** (`min`/`max`), au relâchement **même hors du
    bouton** (on glisse souvent le doigt à côté), et si l'on quitte l'onglet.
- ⚠️ **`min`/`max` ne sont appliqués qu'à la SORTIE du champ** (`onBlur`) et
  sur les boutons ± — jamais à chaque frappe. Border chaque frappe casse la
  saisie dès qu'un `min` positif dépasse un chiffre isolé : avec `min={15}`
  `max={100}`, taper « 5 » sauterait à 15, puis « 0 » (lu comme « 150 »)
  sauterait à 100 — impossible d'écrire 50. Les conditions minimum de
  l'[Optimizer](../../../02-app/optimizer/README.md) passent un tel `min`.
- ⚠️ Un champ à **brouillon** (saisie séparée de la valeur, comme
  [Pager.tsx](src/components/account/Pager.tsx)) doit **remettre le brouillon
  en forme lui-même** à la validation : un effet de resynchronisation ne se
  déclenche que si la valeur CHANGE, donc « 007 » sur la page 7 resterait
  affiché tel quel.

#### `Selecteur`

**`Selecteur`** — liste déroulante ([ton du sélecteur](../selecteur.md)). ⚠️ `appearance-none` + notre propre chevron :
le contrôle natif dessine sa flèche avec les couleurs du **système**, qui ne
suivent aucun des deux thèmes — sur fond sombre, une flèche noire disparaît. La
**liste ouverte** reste celle du système : c'est le seul morceau de l'app qu'on
ne dessine pas, et le remplacer coûterait un menu flottant complet à claviériser.

#### `Interrupteur`

**`Interrupteur`** — glissière avec libellé. ⚠️ `role="switch"` et non `button` :
un lecteur d'écran annonce « interrupteur, activé » plutôt que « bouton » — la
différence entre savoir dans quel état on est et devoir l'essayer pour le
découvrir.

> ⚠️ **Interrupteur ou Pastille ?** Ils ont le même rôle logique, et le choix
> n'est pas affaire de goût. La **pastille** vit dans une RANGÉE de ses
> semblables, où seul le fond peut porter l'état sans que trois voisines se
> disputent le regard. La **glissière** vit SEULE, avec une phrase à côté : elle
> a la place de dessiner son état, et le mouvement du curseur dit dans quel sens
> on va.

#### `Segmented`

**`Segmented`** — choix UNIQUE, options côte à côte dans un même cadre, une
seule enfoncée. À préférer à une rangée de pastilles quand les options
**s'excluent** : des pastilles indépendantes se lisent comme des filtres
cumulables, rien dans leur forme ne dit qu'en activer une désactive les
autres — le cadre commun le dit sans un mot. L'option enfoncée est un
**aplat de braise**, texte `accent-ink` (rebranding, décision 19 ; fond
d'accent doux avant).

> ⚠️ **Il se resserre TOUT SEUL** (`dense` laissé à `undefined`, le défaut) :
> le contrôle mesure la place qu'il reçoit **réellement** et bascule en texte/
> rembourrage réduits uniquement quand il déborderait. Ce fut d'abord un
> `dense={etroit}` piloté par un seuil de **fenêtre**
> (`useMediaQuery(SOUS_SM)`, 639 px) — faux dès qu'un contrôle vit dans une
> colonne qui partage son espace avec un voisin : un sélecteur à 4 options
> longues débordait sur un écran **1080p** sans que le seuil ne se déclenche
> jamais, la fenêtre étant large alors que sa colonne ne l'était pas. La
> largeur de la FENÊTRE ne dit rien de la largeur d'un CONTENEUR.
>
> ⚠️ **Pourquoi une copie de mesure invisible, et pas `scrollWidth` du contenu
> réel** : une fois resserré, le contenu réel ne déborde plus — on repasserait
> au cran normal, donc il déborderait de nouveau, sans fin. La copie reste
> toujours au cran NORMAL : sa largeur naturelle ne dépend pas de l'état
> courant, donc la comparaison est stable. Elle est `flex-none w-max` et non
> `w-full` : une copie en `w-full` PREND la largeur de son parent au lieu de la
> RAPPORTER — dans un conteneur `absolute` sans largeur propre, c'est une
> dépendance circulaire dont la spec CSS ne garantit pas le résultat.
>
> Passer `dense={true|false}` **force** le rendu, à réserver aux cas où l'on
> sait mieux que la mesure — `AncientFilter` resserre par cohérence avec une
> rangée voisine, pas par manque de place.

#### `Pastille`

**`Pastille`** — pilule de filtre à deux états, posée en RANGÉE de critères :
l'élément, la rareté naturelle, les doublons de la box (les mêmes au Bestiaire).
On l'enclenche pour restreindre une liste, et plusieurs le sont souvent à la
fois.

> ⚠️ **Distincte d'un `Bouton actif`.** Un bouton à état signale un MODE ou une
> option et se lit seul ; une pastille POSE UN FILTRE et se lit en rangée. La
> forme serrée (pilule `text-xs`) et l'usage (une grille de critères) en font une
> brique à part — c'est celle que `Bouton` annonçait en tête (« toute pression
> qui n'est pas une pastille de filtre passe par ici ») avant qu'elle existe.

> ⚠️ **Un seul marqueur d'état, deux schémas jamais mêlés dans une rangée.** Sans
> `couleurs`, l'état actif prend le marqueur de filtre de l'app — c'est le cas de
> filtres qui n'ont pas de couleur propre (Nat, Doublons, 2A) : un seul style les
> rassemble, là où trois surbrillances se liraient comme trois natures de filtre.
> Ce marqueur est la **couleur d'accent teintée** (contour d'accent, fond
> `accent-soft` — le « braise sombre » de la toile depuis le rebranding,
> décision 20, sans sa coche ; refonte graphique, décision 9 du mainteneur,
> 2026-09-24 — la couleur inversée, essayée d'abord, a été écartée) et vit dans une constante
> exportée, `MARQUEUR_FILTRE_ACTIF` : les filtres qui ne passent pas par
> `Pastille` (sets, emplacements, étoiles du Bestiaire) l'importent, pour porter
> EXACTEMENT le même.
> Avec `couleurs`, l'**appelant porte la teinte** (l'élément a la sienne, un
> token partagé avec le Bestiaire via `elementStyles.ts`), exactement comme la
> `teinte` d'une `Vignette` : la couleur est une DONNÉE de l'appelant, jamais une
> valeur en dur dans la librairie. La bordure colorée reste visible au repos, le
> fond teinté ne fait que confirmer l'état posé.

#### `Jeton`

**`Jeton`** — pilule qui NOMME un choix déjà posé, avec une croix pour le
retirer : un set ajouté à un combo (SetComboPicker), un monstre exclu d'une
recherche (RuneExclusionPicker). Icône optionnelle à gauche, `detail` atténué
après le libellé (« · Box »), `onRetirer` qui décide de la présence de la croix.

> ⚠️ **Distinct de `Pastille`.** Une pastille est un FILTRE à deux états qu'on
> enclenche et relâche en place, dans une grille de critères fixes ; un jeton
> représente une entrée AJOUTÉE, qui n'existe que tant qu'elle est là et
> disparaît quand on la retire — d'où la croix, qui n'a de sens que sur lui, et
> une liste qui grandit au lieu d'une rangée figée.

> ⚠️ **La croix est un `BoutonIcone` `serre`**, pas une croix dessinée à la
> main : sa cible tactile et son `aria-label` viennent de la librairie, comme les
> deux boutons d'une pilule de catégorie. `serre` parce qu'elle vit DANS le
> jeton, plus petit que la cible de 40 px.

#### `Option`

**`Option`** — choix riche : icône, titre, description. ⚠️ Distinct de `Bouton`
parce qu'il **ne se lit pas pareil** : un bouton s'identifie d'un coup d'œil, une
option se LIT. D'où le texte aligné à gauche et l'icône calée en haut — sur deux
lignes de description, une icône centrée verticalement flotte en face de rien.

> ⚠️ **La description n'est pas décorative.** Ces choix engagent ce qu'on ne peut
> pas défaire d'un clic (ce qu'on publie de son compte, ce qu'on écrase). Un
> titre seul oblige à deviner, et c'est précisément là qu'on se trompe. Voir la
> règle du [conventions](../../) : le défaut ne perd jamais rien, et ce qui perd
> s'explique avant.

- `actionTitre` — une action posée **juste à droite du titre**, dans la case
  mais **hors du bouton principal** : le « ? » qui ouvre la prose d'un sort
  dans « Dégâts réels » (`HelpPopover`). ⚠️ **Un axe qui
  change la structure, pas une variante.** Posée dans `titre`, l'action ferait
  un bouton dans un bouton (HTML invalide) et un clic sur elle choisirait aussi
  l'option. Avec elle, la case devient un **cadre qui dessine** — le patron de
  `BoutonGroupe` : le bouton principal, vide, couvre toute la case (bordure
  comprise, pour que le contour de focus tombe où il tombait) et se nomme par
  le titre et la description (`aria-labelledby`, qu'un `aria-hidden` empêche
  d'être lus une seconde fois) ; l'action, posée après lui et positionnée sans
  `z-index`, passe devant. Cliquer l'action ne choisit pas l'option ; partout
  ailleurs la case se choisit comme avant, et elle s'enfonce à l'appui de son
  seul bouton principal (`:has(> button:active)` — `:active` gagne aussi les
  ancêtres, l'action ferait sinon enfoncer la case).
  ⚠️ **L'action reste vive quand l'option est désactivée** (un sort refusé
  garde le « ? » de sa prose) : seuls l'icône, le titre et la description
  s'estompent, et le cadre prend l'opacité du `<button>` désactivé par ses
  couleurs (`border-border/40 bg-panel2/40`) — une opacité sur le cadre
  estomperait aussi l'action. **Sans action, l'option reste le `<button>`
  d'avant, au caractère près.**

#### `Flottant`

**`Flottant`** — surface posée au-dessus de la page, ancrée à ce qui l'a ouverte :
popup d'édition, formulaire ancré, liste de résultats d'une recherche.

> ⚠️ **C'est la seule chose de l'app qui ait droit à une OMBRE.** L'élévation dit
> « je suis au-dessus, et je vais repartir » — ce qui est faux d'un bouton actif
> ou d'une carte sélectionnée, qui appartiennent à la page. Trois écrans
> recopiaient les mêmes `shadow-glow shadow-black/60`.

> ⚠️ **Le `z-index` est un ORDRE, pas un nombre libre.** L'échelle de l'app —
> contenu → barre du haut (20) → **flottants (30)** → onglets mobiles (40) →
> panneau montant (50) → panneau de second niveau (60) → dialogues (70) — se
> règle ici pour tout ce qui flotte. Un `z-40` écrit à la main « pour que ça
> passe devant » se retrouve un jour derrière la barre d'onglets. La liste de
> résultats de la recherche RTA était d'ailleurs à `z-20`, à égalité avec la
> barre du haut.

> ⚠️ Il ne s'occupe **pas du placement** : le recalage à l'écran reste au hook
> `useRecalageEcran`, qui a besoin de mesurer. Mais il pose `left-0`, sans quoi
> une valeur négative de recalage ne décale pas — elle repositionne depuis un
> bord que le navigateur choisit seul.

> ⚠️ `rembourrage="aucun"` pour une **liste** : ses entrées doivent toucher les
> bords, sinon le survol laisse une bande morte et l'entrée surlignée paraît
> décalée de son propre cadre. C'est pourquoi le flottant porte
> `overflow-hidden` — sans lui, les coins carrés du contenu dépassent de
> l'arrondi du cadre, en quatre petits ergots aux angles.

> ⚠️ **`ancrage="cote"` est un AXE, pas une variante de plus.** Les deux
> ancrages d'origine (`dessous`, `dessus`) placent la surface **au-dessus ou en
> dessous** de son ancre ; `cote:` ne fait que choisir de quel bord elle
> s'aligne. Une surface qui sort sur le **flanc** — les sous-sections au survol
> d'une entrée de la barre latérale ([02-app/transverse/](../../../02-app/transverse/)) — ne
> s'exprime par aucune combinaison des deux : elle s'aligne sur le **haut** de
> l'ancre et se pose à sa **droite**. D'où la troisième valeur, plutôt qu'un
> composant de plus. Elle ignore `cote:`, qui n'a plus de sens quand c'est
> l'axe horizontal lui-même qui porte l'ancrage, et son animation part de
> `origin-top-left` — du bord par lequel elle sort.

#### `FlottantAuto`

**`FlottantAuto`** — le même, mais qui **choisit son côté** en mesurant la place
autour de son ancre : vers la gauche si l'ancre est près du bord droit, vers le
haut si elle est près du bas. Puis il **borne sa position au viewport**, en
gardant la surface ancrée à ce qui l'a ouverte.

> ⚠️ **Sans rembourrage par défaut** (`rembourrage="aucun"`), à la différence
> de `Flottant` : il sert aussi aux LISTES, dont les entrées touchent le bord.
> Un TEXTE posé dedans demande donc `rembourrage="md"` — la bulle d'aide
> `HelpPopover` l'oubliait, son texte collait au cadre (lot 8a de la refonte,
> capture du mainteneur). Un texte LONG demande aussi une hauteur bornée avec
> défilement (`max-h-[…] overflow-y-auto`), sans quoi il sort de l'écran par
> le bas. `HelpPopover` pose les deux, et détache son titre (13 px, filet
> dessous) du corps (12 px).

> ⚠️ Pour ce qui est ancré à un élément **dont la position varie** : une tuile
> dans une grille, une carte de monstre, un badge au bout d'une ligne. Ces ancres
> vont jusqu'aux bords de la page, et un flottant posé toujours du même côté s'y
> trouvait coupé — exactement là où l'on venait de cliquer pour lire quelque
> chose.

> ⚠️ **Le côté seul ne suffit pas près d'un bord.** Ancrée à un élément étroit
> (une tuile de la grille à deux colonnes du téléphone), une surface large alignée
> sur un côté déborde de l'AUTRE, que `html { overflow-x: hidden }` coupe : le
> détail de rune de l'onglet Optimisation devenait invisible au doigt. `FlottantAuto`
> mesure donc sa boîte réelle (`maxWidth: 90vw` compris) et **borne sa position
> horizontale à l'écran** via un `left` explicite. Sans débordement — le cas du
> bureau — la position calculée est **identique** à l'ancien `left-0`/`right-0` :
> le bornage n'agit que quand la surface sortirait, il ne change rien ailleurs.

> ⚠️ **Distinct de `useRecalageEcran`**, qui *tire* une surface débordante vers
> l'intérieur après coup. Ici on choisit le bon côté **avant** de peindre : pas
> de saut visible, et la surface reste alignée sur son ancre au lieu de flotter à
> une position corrigée. Le recalage reste utile quand la surface doit garder son
> côté (le formulaire de catégorie, ancré à sa pilule).

> ⚠️ `useLayoutEffect` et non `useEffect` : la mesure doit précéder la peinture.
> Avec `useEffect`, la surface apparaissait un instant du mauvais côté puis
> sautait — un scintillement d'une frame, mais visible.

#### `Modale`

**`Modale`** — la coquille de **toute** boîte modale : voile, centrage, fermeture
au clic extérieur et à Échap. `ConfirmDialog`, `PromptDialog` et
`KeepAccountDialog` en dérivent.

> ⚠️ **Elle est montée dans `<body>` par un portail, jamais là où elle est
> écrite.** C'est ce qui manquait, et le bug était instructif : sur téléphone, une
> modale s'ouvre souvent depuis le panneau « Options », dont le contenu porte
> `data-tiroir`. La règle `[data-tiroir] .flex-col { align-items: flex-start }`,
> écrite pour aligner les boutons empilés du panneau, tombait donc sur la boîte de
> la modale — son en-tête, son corps et son pied se rétrécissaient sur leur
> contenu. La croix se collait au titre, les champs n'atteignaient plus le bord,
> les boutons restaient à gauche.
>
> **Trois symptômes, une cause, et rien dans le code de la modale ne pouvait
> l'expliquer** puisque la règle venait d'un ancêtre. `position: fixed` ne protège
> pas de cela : il détache la **position**, pas l'héritage des sélecteurs
> descendants. Seul un portail sort du sous-arbre.
>
> Le portail règle deux autres pièges au passage : plus de contexte d'empilement
> parent qui puisse coincer le `z-index`, et plus de découpage par un
> `overflow: hidden` d'ancêtre.
