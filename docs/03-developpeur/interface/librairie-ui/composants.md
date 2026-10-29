# Librairie UI — composants à part entière

Partie de [Librairie UI](README.md).

### Composants à part entière

#### `BarreActions`

**`BarreActions`** — les actions d'un EN-TÊTE d'écran : **toutes en boutons
quand elles tiennent sur la ligne, sinon les actions `toujours` + un `Menu`
« ⋯ »** pour les `autres`. Les entrées sont les mêmes `ElementMenu` dans les
deux formes (libellé, icône, désactivation et raison, `danger` rangé en
dernier derrière un filet) : aucune action n'existe que dans l'une.
⚠️ **La place se MESURE** : une copie invisible et `inert` de la rangée complète
est comparée à la largeur disponible, à chaque redimensionnement. Un point de
rupture fixe se tromperait — la place dépend aussi de la barre latérale
(dépliée ou repliée) et du titre de l'écran. ⚠️ En rendu serveur et au premier
rendu, c'est le **menu** (la forme qui tient partout) ; le basculement se fait
dans un `useLayoutEffect`, avant la première peinture. Tous ses boutons ont la
hauteur d'en-tête (`HAUTEUR_EN_TETE`).
Un axe d'entrée en plus de `danger` : **`actif`** — un
bouton à deux états (`aria-pressed`, fond d'accent enclenché), qui devient une
entrée à cocher (`menuitemcheckbox`) s'il tombe dans le menu.
⚠️ **Pas d'axe « principal »** : aucune action n'est mise en avant dans un
en-tête d'écran.

#### `Menu`

**`Menu`** — un bouton « ⋯ » (nommé par `libelle`) qui ouvre sous lui,
ancrée à droite, une liste d'actions (`Flottant`, `role="menu"`).
⚠️ **Le « ⋯ » a la hauteur des boutons d'EN-TÊTE, 36 px au doigt, 32 px à
la souris** (`HAUTEUR_EN_TETE`, exportée ; 32 = un bouton `md`) — pas les 28 px d'un `BoutonIcone` : posé à côté
d'un bouton d'action (« Exporter » dans la RTA), il ferait deux hauteurs
voisines, lues comme deux familles de boutons. Les
boutons voisins s'y alignent en reprenant la constante. C'est un `Bouton`
carré dimensionné, pas un `BoutonIcone` dont on écraserait le `h-7` : deux
hauteurs dans la même classe, l'ordre de la feuille de style trancherait. Chaque entrée : icône, libellé, `disabled` + `title` pour dire
pourquoi, et `danger` pour un geste qui perd quelque chose — rangé en dernier,
derrière un filet, en `bad`. Clavier : flèches, Début / Fin, Échap (rend le
focus au bouton), Tab referme ; un clic dehors aussi.
⚠️ **Les entrées restent dans le DOM, menu fermé** (`hidden`) : un bouton ne
quitte jamais le DOM selon l'état de l'écran, et c'est ce qui laisse les tests
de rendu retrouver chaque action, son état et sa raison.
⚠️ **La liste défile au-delà de `min(70dvh, 480px)`** : les invocateurs d'un
dossier SW Exporter peuvent être des dizaines, et une liste sans plafond
sortait de l'écran. Le rembourrage est sur la zone qui défile, pas sur le
`Flottant` : le filet des entrées `danger` reste dedans, sans défilement
horizontal.
⚠️ **Monté à son PREMIER usage**, contre la règle du deuxième (« Quand ajouter
quelque chose ») : l'écrire dans l'écran en ferait un contrôle MAISON — ce que
la règle qui gouverne tout le reste interdit — et plusieurs écrans en posent
un.
**Deux axes** servent la carte du compte (le choix de l'invocateur) :
`declencheur` — le
bouton qui ouvre le menu, quand ce n'est pas le « ⋯ » ; il reçoit ce qu'il doit
poser sur son bouton (`ref`, `aria-haspopup`, `aria-expanded`,
`aria-controls`, `onClick`), et le menu prend alors toute la largeur ; `cote`
— le bord auquel la liste s'aligne (droite par défaut ; gauche pour la carte
en tête de barre latérale). Une entrée `actif` (`menuitemcheckbox`) ne se
dessine pas cochée d'elle-même : l'appelant met la coche en icône.

⚠️ **Pas de `Deroulant` (filtre fermé dans un menu)** : un filtre fermé ne dit
pas ce qu'il filtre sans qu'on l'ouvre.
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
⚠️ Axe **`decimales`** (0 par défaut) : le nombre de décimales admises à la
frappe, pour une valeur que l'app **écrit** avec des décimales — une borne
d'Efficience des résultats de l'Optimizer se pose comme la carte l'affiche
(« 78.8 »). Point ou virgule admis ; « 78. » reste à l'écran le temps
d'écrire la décimale ; `inputMode="decimal"` au doigt. La lecture d'une
frappe est une fonction pure (`lireFrappe`), vérifiée seule.

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
suivent aucun des deux thèmes — sur fond sombre, une flèche noire disparaît.

**Fermé, c'est le `<select>` natif ; ouverte, la liste est celle de la charte.**
La liste du système (fond blanc, survol bleu) ignorait les deux thèmes.

- ⚠️ **Le champ fermé ne change pas** : on garde le `<select>`, avec sa boîte, sa
  valeur, son `onChange`, son étiquette, ce qu'en lisent les tests de rendu, et
  les classes que les appelants posent sur lui. Seule l'ouverture est
  remplacée : un clic (souris, stylet) ou une touche d'ouverture empêche la
  liste du système et montre la nôtre. La taille d'aucun sélecteur ne bouge
  (« Trier par » des runes 178 × 32, « LEAD » du speed tuning 125 × 28 au
  bureau, 125 × 40 au téléphone, avant comme après).
- **Le dessin des principales imposées** (`SelecteurMultiple`,
  `forme="surbrillance"`) : surface `Flottant`, entrées de 32 px, survol gris
  (`panel2`), valeur retenue en braise légère (contour et fond d'accent),
  entrée atteinte au clavier cerclée de braise, en-tête discret par
  `<optgroup>`, option désactivée atténuée.
- **Les options se lisent dans le DOM du `<select>`** à l'ouverture
  (`<option>`, `<optgroup>`, `disabled`, `hidden`, `title`) : aucun appelant ne
  change. Choisir pose la valeur et émet l'événement `change` du `<select>` ;
  une liste contrôlée qui revient à son invite (« Ajouter… ») le fait encore.
- **Clavier** : Tab atteint le `<select>` (bordure d'accent au focus) ; Flèche
  bas ou haut, Entrée, Espace, F4 ou une lettre ouvrent la liste — une flèche
  ne change plus la valeur à l'aveugle, ce qui comptait pour les listes qui
  agissent à chaque `change`. Dans la liste : flèches, Début / Fin, Page
  préc. / suiv., recherche par lettres, Entrée ou Espace choisit, Échap ferme
  sans fermer le dialogue ou le panneau qui la porte. Un clic dehors ferme
  aussi.
- **Tab parcourt la liste ouverte**, comme les boutons des principales
  imposées : ouverte à la souris, le premier Tab cercle la valeur retenue ;
  ensuite Tab passe à l'entrée suivante, Maj+Tab à la précédente (les entrées
  désactivées sont sautées). Après la dernière, Tab ferme sans choisir et
  continue au contrôle qui suit le `<select>` ; avant la première, Maj+Tab
  revient au `<select>`, liste ouverte — Tab ou une flèche y rentre, Échap,
  Entrée ou Espace la ferme, Maj+Tab la ferme et continue avant lui. C'est le
  parcours du `SelecteurMultiple`, dont le déclencheur précède les options.
  L'entrée atteinte porte l'anneau de focus des boutons (1 px de braise
  lisible, détaché de 1 px, collé à la bordure de la valeur retenue).
- **Lecteurs d'écran** : la liste ouverte prend le focus, `role="listbox"`,
  l'entrée active par `aria-activedescendant`, chaque entrée `role="option"`
  et `aria-selected` ; le `<select>` porte `aria-expanded` et
  `aria-controls` tant qu'elle est ouverte.
- ⚠️ **Au doigt aussi, la liste est celle de la charte** : la roue ou la
  feuille du système ignorait les deux thèmes comme la liste du bureau. Ses
  entrées montent à 40 px sous `(pointer: coarse)` (`compact:h-10`, la cible
  tactile de [deux-formats.md](../deux-formats.md)) ; le champ fermé ne change
  pas (« LEAD » du speed tuning 125 × 40 au téléphone). Seul un navigateur
  sans l'API `popover` garde la liste native.
- ⚠️ **La liste est un `Flottant` ancré sur le `<select>`** (`ancre`), en
  couche supérieure, et la seule couche ouverte : ni un `overflow` d'ancêtre
  (les colonnes qui défilent de l'Optimizer) ni un dialogue en `z-70` ne la
  coupent. `Flottant` la place à 6 px du `<select>`, la recale quand la page
  défile, la borne à l'écran et la masque quand le `<select>` sort de sa
  boîte. Elle reste dans le DOM juste après le `<select>` : un clic dedans
  reste un clic dans le dialogue qui la porte, et ne remonte pas à une carte
  cliquable ou déplaçable. Le `Selecteur` choisit le côté — vers le haut
  quand la place manque dessous, alignée à droite du `<select>` quand elle
  sortirait de l'écran — et la hauteur de la liste, qui défile seule.

#### `SelecteurMultiple`

**`SelecteurMultiple`** — liste à CHOIX MULTIPLES : fermée, elle a le dessin
d'un `Selecteur` (cadre, fond, chevron) et résume ce qui est choisi (« PV%,
ATQ% »), ou son texte `vide` (« Libre ») ; ouverte, une `Case` par option,
dans un `Flottant`. Un choix ou plusieurs, et un choix se retire en
décochant.

> ⚠️ **L'axe que `Selecteur` ne couvre pas.** Un `<select multiple>` natif
> est une boîte à défilement toujours ouverte, qui ne se ferme pas sur un
> résumé et demande Ctrl pour cocher deux options. Une rangée de `Pastille`
> dit bien un choix multiple, mais prend une ligne par réglage. Fermée, la
> liste tient la hauteur d'un `Selecteur` et montre ses choix : elle ne cache
> pas ce qu'elle filtre (voir `Menu`, « Pas de `Deroulant` »).

- ⚠️ **Les cases sont des `Case`** : le clavier natif (Tab, Espace), le nom
  accessible et la coche viennent de la librairie, rien n'est redessiné.
- ⚠️ **La surface reste dans le DOM, fermée** (`hidden`), comme les entrées
  du `Menu` : les tests de rendu lisent chaque option et son état.
- **Elle sort du flux** : ouverte, elle flotte sous son déclencheur, rien ne
  bouge dessous. Échap la referme et rend le focus au déclencheur ; un clic
  dehors, ou un focus qui sort, la referme aussi.
- Le nom accessible du déclencheur est `libelle : résumé` (« Slot 2 :
  Libre »), son infobulle le résumé complet, tronqué à l'écran (sauf
  `resumeEntier`, plus bas).
- `onChange` reçoit les valeurs cochées dans l'ordre des options.

Deux axes de STRUCTURE, nés de son second usage, le set de runes recherché :
son choix est un **multiensemble** (deux fois le même set), qu'une case par
option ne sait pas dire.

- `resume` — ce que montre la liste fermée à la place des libellés choisis
  (les icônes des sets), avec le texte qui nomme le déclencheur.
- `surface` — ce que porte la surface ouverte à la place des cases (la
  grille d'ajout des sets, inchangée). La surface prend alors un
  rembourrage : son contenu n'est pas une liste dont les entrées touchent le
  bord.

Un axe de FORME, né des principales imposées du bureau : **`forme`
`'surbrillance'`** fait de la surface une liste classique — chaque valeur est
un bouton (`aria-pressed`), la valeur choisie en surbrillance (contour et fond
d'accent, le marqueur des filtres), sans case. Le champ fermé ne change pas :
celui d'un `Selecteur` (`sm` pour les principales), qui résume les choix ou dit
« Libre ». Cliquer une valeur la choisit ou la retire, la liste reste ouverte.

Un axe d'OUVERTURE : **`ouvert`** et **`onOuvertChange`** la rendent
contrôlée par l'appelant — le set compact se ferme de lui-même au choix qui
remplit les six emplacements. Sans eux, la liste gère seule son ouverture.

- ⚠️ **Un focus perdu vers rien ne ferme pas la liste.** Un choix qui
  désactive ou retire le bouton cliqué (un set de 4 rend les autres sets de 4
  indisponibles) fait tomber le focus sur le document : ce n'est pas un
  départ. La liste reste ouverte et le focus revient au déclencheur ; seuls
  un focus parti ailleurs, un clic dehors et Échap la ferment.

Un axe de RÉSUMÉ, né des principales du bureau : **`resumeEntier`** fait
montrer au champ fermé toutes les valeurs choisies, à la ligne entre deux
valeurs (chacune insécable : « Taux Crit » ne se coupe pas), rien de tronqué.

- ⚠️ **Le champ prend la hauteur de ce qu'il montre** (une ligne pour
  « Libre », deux quand les choix l'exigent), **et la surface ne descend
  jamais sous le doigt** : ouverte, elle se pose à la hauteur qu'avait le
  champ à l'ouverture (mesurée au seul changement d'ouverture) et y reste.
  Un choix qui fait passer le champ à deux lignes l'allonge sous elle ;
  fermée, la liste montre tout. Ce qui suit le champ descend : la règle
  protège la cible du clic, pas ce qui est dessous. Les rangées restent
  compactes : aucune hauteur réservée pour les options non choisies.

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
**aplat de braise**, texte `accent-ink`.

> ⚠️ **Il s'adapte TOUT SEUL** (`dense` laissé à `undefined`, le défaut) :
> le contrôle mesure la place qu'il reçoit **réellement**. Tant que tous ses
> libellés tiennent sur une ligne, il ne change rien (même hauteur, mêmes
> classes). Sinon, ses libellés **passent sur deux lignes** au texte normal,
> coupés à un espace, jamais dans un mot (« Défenses / siège ») ; il ne
> bascule en texte/rembourrage réduits que si même ainsi il déborderait (un
> mot seul trop long, trop de crans). Un `dense` piloté par
> un seuil de **fenêtre** (`useMediaQuery(SOUS_SM)`, 639 px) serait faux dès
> qu'un contrôle vit dans une colonne qui partage son espace avec un voisin :
> un sélecteur à 4 options longues déborderait sur un écran **1080p** sans que
> le seuil se déclenche, la fenêtre étant large alors que sa colonne ne l'est
> pas. La largeur de la FENÊTRE ne dit rien de la largeur d'un CONTENEUR.
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
> ⚠️ **Sur deux lignes, tous les crans ont la même hauteur**, celle du plus
> haut : un libellé resté sur une ligne y est centré. À la souris, 38 px pour
> deux lignes (interligne serré), jamais moins que les 26 px du cran normal.
> La forme ne dépend que de la place et des libellés, jamais du cran choisi :
> rien ne bouge au clic. Une seconde copie de mesure, en largeur minimale
> (`w-min`), donne la largeur de chaque cran passé sur deux lignes ; la forme
> tient si leur somme tient dans le contenu de la racine (un cran `lg` qui ne
> peut pas descendre sous son mot le plus long garde cette largeur, les autres
> se partagent le reste).
>
> Passer `dense={true|false}` **force** le rendu, à réserver aux cas où l'on
> sait mieux que la mesure — `AncientFilter` resserre par cohérence avec une
> rangée voisine, pas par manque de place.

> **`colonnes`** pose les crans **en grille**, `colonnes` par rangée, à
> largeur égale, dans le même cadre : quatre crans en 2 × 2 dans une colonne
> étroite (l'objectif de recherche du bloc « Objectif et Rechercher » de
> l'Optimizer, au bureau). Le choix reste exclusif à l'œil — un seul cadre,
> un seul aplat. ⚠️ Aucun resserrement automatique en grille : passer à la
> rangée suivante EST la réponse au manque de place. ⚠️ **Les bords
> intérieurs se dessinent** : une grille interne au fond `border`, écartée
> d'1 px, dont chaque case reprend le fond du cadre — des traits de 1 px
> entre les crans, verticaux et horizontaux, comme le trait de la rangée
> `lg`. Sans eux, quatre crans en 2 × 2 se lisaient comme un seul bloc.

#### `Onglets`

**`Onglets`** — de **vrais onglets** posés côte à côte au-dessus d'un contenu,
un seul ouvert. L'onglet ouvert, sur fond de panneau, efface son bord bas et
se **fond dans la ligne de base** ; les autres, sur `panel2` et en encre
atténuée, restent derrière elle. Chaque option : `cle`, `libelle`, `icone`
facultative, `desactive` + `title` (toujours affichée, jamais retirée).
Usages : les groupes d'artéfacts du Top 10 par propriété, au Résumé des
artéfacts ([feat-artefacts.md](../../../02-app/compte/feat-artefacts.md)), les
combinaisons des builds les plus rapides du Résumé des runes
([feat-runes/resume.md](../../../02-app/compte/feat-runes/resume.md)), les
deux sources de la Comparaison des runes
([feat-runes/comparaison.md](../../../02-app/compte/feat-runes/comparaison.md)),
les formes d'un monstre transformable dans sa fiche
([feat-monstres.md](../../../02-app/compte/feat-monstres.md)), les sections de
la prépa RTA au téléphone
([feat-sections-runes.md](../../../02-app/rta/feat-sections-runes.md)).

> ⚠️ **Le critère** : le choix REMPLACE le contenu du dessous (un autre
> écran, une autre fiche, une autre section). Un choix qui règle un mode (le
> potentiel « Gemme + meule »), trie ou restreint une liste reste un
> `Segmented` ou une rangée de pastilles.

> ⚠️ **Ni un `Segmented`, ni des pastilles.** `Segmented` règle un MODE dans une
> rangée de réglages ; une pastille pose un filtre cumulable. Les onglets
> disent QUEL CONTENU on regarde, et le coiffent : on lit le titre de l'onglet
> comme celui de ce qui est dessous.
>
> ⚠️ **Contour unique, 1 px** ([contours.md](contours.md)) : les onglets ne se
> touchent pas, un intervalle de 4 px les sépare, et la ligne de base passe
> sous l'intervalle — un segment par intervalle, plus un pour finir la ligne
> jusqu'au bord. Deux bords accolés feraient un trait de 2 px. Une ligne tracée
> par le conteneur, que l'onglet ouvert recouvrirait d'une marge négative,
> serait rognée par le défilement horizontal.
>
> ⚠️ **La largeur d'un onglet ne dépend jamais de son état** : le libellé en
> gras garde sa place dans les deux états, par une copie invisible superposée
> au libellé visible, hors de l'arbre d'accessibilité. Fermer un onglet ne
> décale donc aucun voisin ; le nom accessible n'est annoncé qu'une fois.
>
> ⚠️ **Au doigt, la rangée défile de côté** au lieu de passer à la ligne : sur
> deux lignes, il n'y a plus de ligne de base unique, et l'on ne sait plus quel
> onglet coiffe le contenu.
>
> Accessibilité d'un `tablist` : rangée nommée (`aria-label` obligatoire),
> `role="tab"` et `aria-selected`, seul l'onglet ouvert dans l'ordre de
> tabulation ; ← et → passent à l'onglet disponible voisin (en bouclant),
> Début et Fin au premier et au dernier.

#### `Pastille`

**`Pastille`** — pilule de filtre à deux états, posée en RANGÉE de critères :
l'élément, la rareté naturelle, les doublons de la box (les mêmes au Bestiaire).
On l'enclenche pour restreindre une liste, et plusieurs le sont souvent à la
fois.

> ⚠️ **Distincte d'un `Bouton actif`.** Un bouton à état signale un MODE ou une
> option et se lit seul ; une pastille POSE UN FILTRE et se lit en rangée. La
> forme serrée (pilule `text-xs`) et l'usage (une grille de critères) en font une
> brique à part.

> ⚠️ **Un seul marqueur d'état, deux schémas jamais mêlés dans une rangée.** Sans
> `couleurs`, l'état actif prend le marqueur de filtre de l'app — c'est le cas de
> filtres qui n'ont pas de couleur propre (Nat, Doublons, 2A) : un seul style les
> rassemble, là où trois surbrillances se liraient comme trois natures de filtre.
> Ce marqueur est la **couleur d'accent teintée** (contour d'accent, fond
> `accent-soft`, une braise sombre) et vit dans une constante
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
  ailleurs la case se choisit, et elle s'enfonce à l'appui de son
  seul bouton principal (`:has(> button:active)` — `:active` gagne aussi les
  ancêtres, l'action ferait sinon enfoncer la case).
  ⚠️ **L'action reste vive quand l'option est désactivée** (un sort refusé
  garde le « ? » de sa prose) : seuls l'icône, le titre et la description
  s'estompent, et le cadre prend l'opacité du `<button>` désactivé par ses
  couleurs (`border-border/40 bg-panel2/40`) — une opacité sur le cadre
  estomperait aussi l'action. **Sans action, l'option est un simple
  `<button>`.**

#### `Flottant`

**`Flottant`** — surface posée au-dessus de la page, ancrée à ce qui l'a ouverte :
popup d'édition, formulaire ancré, liste de résultats d'une recherche.

> ⚠️ **C'est la seule chose de l'app qui ait droit à une OMBRE.** L'élévation dit
> « je suis au-dessus, et je vais repartir » — ce qui est faux d'un bouton actif
> ou d'une carte sélectionnée, qui appartiennent à la page.

> ⚠️ **Toujours au premier plan : la surface passe dans la couche supérieure
> du navigateur** (`popover="manual"`, `showPopover()`). Posée en `absolute`
> dans la page, elle était rognée par tout ancêtre qui défile seul — les
> colonnes de l'Optimizer au bureau, la carte d'un deck du Siège — et passait
> sous sa barre de défilement, voire sous la colonne voisine. La couche
> supérieure échappe aux `overflow`, `clip-path`, `transform` et contextes
> d'empilement de tous les ancêtres, ce que ni un `z-index` ni un
> `position: fixed` en place ne garantissent.

> ⚠️ **Pas un portail** : la surface reste à sa place dans le DOM. Les
> fermetures au clic extérieur (`racine.contains(cible)`), le focus et la
> navigation au clavier continuent de marcher sans qu'aucun écran le sache ; un
> portail les aurait tous cassés.

> ⚠️ **Il s'occupe donc du placement.** La position est calculée en
> coordonnées de l'écran sur l'**ancre** — le premier ancêtre positionné, le
> parent `relative` où l'écran pose le flottant, ou l'élément passé en `ancre`
> (sa boîte de bordure) quand on ne peut pas l'envelopper sans changer sa
> taille : le `<select>` du `Selecteur` — avant de peindre, puis à
> chaque défilement de n'importe quelle boîte et à chaque redimensionnement :
> - à 6 px sous l'ancre (ou au-dessus, ou à côté), alignée sur le bord
>   demandé ; les décalages `left` / `top` de `style` se lisent comme avant
>   dans le repère de l'ancre ;
> - **bornée à l'écran** horizontalement, barre de défilement de la page
>   exclue : une ancre au bout d'une rangée ne la fait plus sortir ;
> - **basculée de l'autre côté** de l'ancre quand elle ne tient pas du sien et
>   qu'il y a plus de place en face, et **bornée en hauteur** (avec
>   défilement) quand elle ne tient d'aucun : ce qui sortirait de l'écran ne
>   se rattraperait plus en faisant défiler la page ;
> - **masquée** quand l'ancre sort de ce qui la montre (une colonne qui
>   défile), plutôt que de flotter sur autre chose.

> ⚠️ **Les largeurs en pourcentage se lisent sur l'ancre** : `w-full` (le
> défaut) et `min-w-full` dans `largeur`, un `width` en `%` dans `style`, sont
> convertis en pixels de la largeur de l'ancre. Hors de ces trois formes, une
> classe en pourcentage vaudrait l'écran entier.

> ⚠️ La feuille du navigateur centre un `popover` et lui impose cadre,
> rembourrage et couleur : `:where([popover])` (`index.css`), de spécificité
> nulle, rend la main aux classes. Le `z-30` reste, repli d'un navigateur sans
> couche supérieure et rang dans l'échelle de l'app — contenu → barre du haut
> (20) → **flottants (30)** → onglets mobiles (40) → panneau montant (50) →
> panneau de second niveau (60) → dialogues (70). En couche supérieure, la
> dernière surface ouverte passe devant les autres, y compris devant une
> `Modale` ouverte après elle s'il en reste une ouverte.

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

> **`onFermer`** : fourni, un appui (`pointerdown`) n'importe où hors de la
> surface la referme — c'est ainsi que se ferme le détail d'une rune, d'un
> artéfact ou d'une relique, partout dans l'app. ⚠️ **L'ancre est exclue** :
> la pièce qui a ouvert la surface garde sa propre bascule (sinon l'appui
> fermerait, puis le clic rouvrirait). Une autre pièce est dehors : l'appui
> ferme le détail ouvert, le clic ouvre le sien.

> ⚠️ **Sans rembourrage par défaut** (`rembourrage="aucun"`), à la différence
> de `Flottant` : il sert aussi aux LISTES, dont les entrées touchent le bord.
> Un TEXTE posé dedans demande donc `rembourrage="md"`, sans quoi il colle au
> cadre. Un texte LONG demande aussi une hauteur bornée avec
> défilement (`max-h-[…] overflow-y-auto`), sans quoi il sort de l'écran par
> le bas. `HelpPopover` pose les deux, et détache son titre (13 px, filet
> dessous) du corps (12 px).

> ⚠️ **Dans une boîte qui défile seule, la surface n'est pas rognée** : elle
> est un `Flottant`, en couche supérieure, masqué quand son ancre sort de ce
> qui la montre. Les aides de `HelpPopover` dans les colonnes de la page de
> bureau de l'Optimizer n'ont donc ni portail ni ancre à part.

> ⚠️ Pour ce qui est ancré à un élément **dont la position varie** : une tuile
> dans une grille, une carte de monstre, un badge au bout d'une ligne. Ces ancres
> vont jusqu'aux bords de la page, et un flottant posé toujours du même côté s'y
> trouverait coupé — exactement là où l'on vient de cliquer pour lire quelque
> chose.

> ⚠️ **Le côté seul ne suffit pas près d'un bord.** Ancrée à un élément étroit
> (une tuile de la grille à deux colonnes du téléphone), une surface large alignée
> sur un côté déborde de l'AUTRE, que `html { overflow-x: hidden }` coupe : le
> détail de rune de l'onglet Optimisation deviendrait invisible au doigt. `FlottantAuto`
> mesure donc sa boîte réelle (`maxWidth: 90vw` compris) et **borne sa position
> horizontale à l'écran** via un `left` explicite. Sans débordement — le cas du
> bureau — la position calculée est **celle** d'un `left-0`/`right-0` :
> le bornage n'agit que quand la surface sortirait, il ne change rien ailleurs.

> ⚠️ **Ce qu'il ajoute à `Flottant`**, qui borne déjà toute surface à l'écran :
> le bon **côté** d'ouverture, choisi **avant** de peindre. La surface s'ouvre
> vers l'intérieur, alignée sur son ancre, et son animation part du bon coin,
> au lieu d'être tirée vers l'intérieur depuis le mauvais côté.

> ⚠️ `useLayoutEffect` et non `useEffect` : la mesure doit précéder la peinture.
> Avec `useEffect`, la surface apparaîtrait un instant du mauvais côté puis
> sauterait — un scintillement d'une frame, mais visible.

#### `Modale`

**`Modale`** — la coquille de **toute** boîte modale : voile, centrage, fermeture
au clic extérieur et à Échap. `ConfirmDialog`, `PromptDialog` et
`KeepAccountDialog` en dérivent.

> ⚠️ **Elle est montée dans `<body>` par un portail, jamais là où elle est
> écrite.** Sur téléphone, une modale s'ouvre souvent depuis le panneau
> « Options », dont le contenu porte `data-tiroir`. Sans portail, la règle
> `[data-tiroir] .flex-col { align-items: flex-start }`, écrite pour aligner
> les boutons empilés du panneau, tomberait sur la boîte de la modale — son
> en-tête, son corps et son pied se rétréciraient sur leur contenu : la croix
> collée au titre, les champs loin du bord, les boutons à gauche.
>
> **Trois symptômes, une cause, et rien dans le code de la modale ne pourrait
> l'expliquer** puisque la règle vient d'un ancêtre. `position: fixed` ne
> protège pas de cela : il détache la **position**, pas l'héritage des
> sélecteurs descendants. Seul un portail sort du sous-arbre.
>
> Le portail règle deux autres pièges au passage : aucun contexte d'empilement
> parent ne peut coincer le `z-index`, et aucun `overflow: hidden` d'ancêtre
> ne découpe la modale.

#### `DeuxVolets`

**`DeuxVolets`** — deux zones côte à côte et le séparateur qu'on glisse entre
elles : l'écran partagé, au bureau
([ecran-partage.md](../../../02-app/transverse/feat-navigation/ecran-partage.md)).
Le glisser, les bornes, le clavier (flèches sur le séparateur), le rôle
`separator` et le double-clic qui ramène au milieu viennent de
`react-resizable-panels` ; le composant n'y ajoute que le dessin, en tokens :
une zone saisissable de 12 px, un trait de 1 px (`border-soft`, accent au
survol, au glisser et au focus) et une poignée centrale.
⚠️ **Les minimums sont en pixels** (`minGauche`, `minDroite`) : la largeur sous
laquelle la page de chaque côté ne se lit plus, quelle que soit la fenêtre.
⚠️ **La taille est contrôlée** (`taille`, pourcentage de la zone de gauche) :
seul un geste de l'utilisateur la remonte (`onTaille`), jamais un recalcul de
la librairie au montage ou à un redimensionnement de la fenêtre.
