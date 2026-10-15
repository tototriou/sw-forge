# Navigation — écran partagé

Partie de [Navigation](README.md).

Deux pages côte à côte, chacune dans un **volet** : préparer une RTA d'un côté
pendant que l'Optimizer cherche de l'autre. **Au bureau seulement**, sur le
site comme dans l'application de bureau : au téléphone, 348 px utiles ne
logent pas deux pages.

Fichiers : [volets.ts](src/lib/volets.ts) (toutes les transitions et les
largeurs, en calcul pur), [VoletEcran.tsx](src/components/VoletEcran.tsx) (un
volet et son en-tête), [DeuxVolets.tsx](src/ui/DeuxVolets.tsx) (les deux zones
et le séparateur), [postcssVolets.ts](scripts/lib/postcssVolets.ts) (le
responsive des volets), assemblés dans [App.tsx](src/App.tsx). Vérifié par `tests/volets.test.ts` et
`tests/rendu/ecran-partage.test.tsx`.

## Ouvrir et fermer

- **« Écran partagé »**, dans la [barre supérieure](barre-superieure.md) :
  ouvre à droite un **volet vide**, la page courante passant à gauche. En
  écran partagé, il est enfoncé et referme un volet : le vide s'il y en a un,
  sinon celui qui n'est pas verrouillé, l'inactif d'abord.
- **Le volet vide** montre en son centre un **sélecteur de page** : le champ et
  la liste de la palette Ctrl K ([recherche-et-palette.md](recherche-et-palette.md)),
  réduits aux pages, sans celle déjà affichée à côté. Clavier comme la
  palette : flèches, Entrée ; Échap referme le volet vide.
- ⚠️ **Tant qu'un volet est vide, la prochaine page ouverte y va** — par le
  sélecteur, la barre latérale, la palette ou un lien — et il devient actif.
  Il se marque comme le volet actif : c'est là qu'ira la navigation. Il n'a
  pas de cadenas (rien à verrouiller), et fermer la page à côté de lui le
  ferme lui aussi.
- **« Ouvrir à côté »**, au survol d'une entrée de la barre latérale ou au
  focus clavier : la page s'ouvre dans l'autre volet (vide ou non), qui
  devient actif. Le bouton n'apparaît que si la fenêtre a la place de deux
  volets (voir [Largeurs](#largeurs)), et jamais sur la page du volet actif.
- **La croix d'un volet** le ferme ; l'autre reprend toute la largeur.
- ⚠️ **Le bouton de la barre supérieure reste affiché quand la fenêtre est
  trop étroite**, désactivé, avec sa raison (« agrandis-la ou replie la barre
  latérale ») : masqué, on ne saurait jamais que le mode existe.

## Le volet actif

⚠️ **L'adresse décrit le volet ACTIF, et lui seul.** L'autre volet garde sa
page dans l'état de l'app. Tout ce qui navigue — barre latérale, palette
Ctrl K, liens dans les pages, « Précédent » du navigateur — passe par
l'adresse : chaque chemin va donc au volet actif sans rien savoir de l'écran
partagé, et aucun lien n'a eu à changer.

- **Un volet devient actif dès qu'on y entre** : un appui (souris, stylet) ou
  le focus clavier, en phase de **capture**. Il l'est donc avant que le clic
  n'atteigne un lien de sa page, et ce lien navigue dans CE volet. Un dialogue
  ouvert depuis une page appartient à son volet (les événements React
  remontent à travers les portails).
- **Activer un volet n'ajoute rien à l'historique** (`replaceState`) : on n'a
  pas navigué. Ouvrir une page à côté en ajoute une, comme toute navigation.
- **Il se marque d'UN contour d'accent**, qui remplace le contour neutre, et
  d'une pastille d'accent dans son en-tête.
- **La barre latérale** marque d'un fond la page du volet actif, comme hors
  écran partagé ; la page de l'autre volet porte la mention « à droite » ou
  « à gauche ». Une section refermée porte la mention de sa sous-section.
- ⚠️ **Chaque volet porte son fil d'Ariane** dans son en-tête, et la barre
  supérieure n'en affiche plus : deux fils pour une même page se liraient
  comme deux pages.
- L'en-tête d'un volet porte aussi le cadenas, « Inverser les volets » et la
  croix.

## Une page n'est jamais ouverte deux fois

Toutes les pages partagent l'état remonté dans `App.tsx` (une seule prépa RTA,
un seul Optimizer). Deux volets sur la même page en seraient deux miroirs.
Choisir la page déjà ouverte dans l'autre volet **active ce volet**.

Deux vues distinctes d'une même section (Siège · Défense et Siège · Offense,
Runes · Liste et Runes · Courbes) sont deux pages : elles s'ouvrent côte à
côte.

## Verrouiller un volet

Le cadenas de l'en-tête verrouille le volet : **sa page ne change plus en
naviguant**. On y travaille normalement (saisir, lancer une recherche) ;
seul le changement de page est bloqué.

- **Naviguer depuis un volet verrouillé** ouvre la page dans l'autre volet,
  qui devient actif. « Ouvrir à côté », quand l'autre volet est verrouillé,
  navigue dans le volet actif.
- ⚠️ **Un seul volet verrouillé à la fois** : verrouillés tous deux, une
  navigation n'aurait nulle part où aller. Le cadenas de l'autre volet est
  grisé et le dit.
- **Un volet verrouillé ne se ferme pas** : sa croix est grisée
  (« Déverrouiller pour fermer »), et « Écran partagé » ferme l'autre.
- **« Inverser les volets »** : le verrou, l'activité et la largeur suivent
  leur page.
- La barre latérale ajoute « verrouillé » à la mention de la page.

## Les pages suivent la largeur de leur volet

⚠️ **Dans un volet, une page se met en page selon le VOLET, jamais selon la
fenêtre**, et sans défilement horizontal. Aucune page n'a été réécrite pour
cela : leur responsive existant est relu à la largeur du volet.

- **La règle** : une page se met en page selon la largeur de son CONTENU,
  comme hors écran partagé. Chaque seuil de fenêtre de Tailwind devient la
  largeur de contenu la plus étroite à laquelle il s'applique aujourd'hui
  (`seuilContenu`) : sous `lg`, la fenêtre moins les marges de la page
  (2 × 24 px) ; à partir de `lg`, moins aussi la barre latérale dépliée
  (248 px). Soit 592 px pour `sm`, 720 pour `md`, 728 pour `lg`, 984 pour
  `xl`. Un volet ne prend donc jamais une mise en page plus large que celles
  qui existent déjà pour cette largeur de contenu.
- **Un volet étroit est au format TÉLÉPHONE** : sous 728 px de contenu, la
  page prend sa mise en page de téléphone, faite pour 348 px. Les actions
  qu'elle range alors dans le panneau « Options » s'ouvrent par un bouton
  **« Options »** dans l'en-tête du volet — au téléphone, ce panneau s'ouvre
  depuis la barre d'onglets du bas, absente au bureau. Un panneau par volet ;
  il monte du bas de la fenêtre ([panneau-actions-mobile.md](panneau-actions-mobile.md)).
- **Le CSS** : au build, chaque `@media` de largeur émis par Tailwind est
  dédoublé ([postcssVolets.ts](scripts/lib/postcssVolets.ts)). Hors d'un
  volet, la règle reste liée à la fenêtre ; dans un volet, une copie
  `@container volet` la lie au corps du volet (`data-volet`). La spécificité
  ne change pas (`:where()`), et la pleine page ne bouge pas d'un pixel.
  PostCSS est donc déclaré dans [vite.config.ts](vite.config.ts), qui seul
  sait charger ce plugin écrit en TypeScript.
- **Le JavaScript** : dans un volet, `useMediaQuery` répond à une requête de
  largeur (`SOUS_LG`, `SOUS_SM`) selon le volet (`requeteDansVolet`). Le volet
  ne prévient sa page qu'en franchissant un seuil : glisser le séparateur ne
  la redessine pas à chaque pixel. Les requêtes de pointeur (`COMPACT`) et de
  thème restent celles de la fenêtre.
- **Ce qui sort du volet reste lié à la fenêtre** : une modale, une popup, la
  barre latérale et la barre supérieure.

## Largeurs

⚠️ **Aucune page n'a de largeur minimale propre** : toutes suivent leur
volet (voir plus haut). Un seul **plancher**, commun, la largeur utile d'un
téléphone (348 px de contenu, plus les marges et les contours du volet,
398 px) : il n'existe que pour qu'on ne puisse pas écraser un volet jusqu'à
rien.

- **Le séparateur** se glisse à la souris jusqu'au plancher de chaque côté,
  se déplace aux flèches une fois sélectionné, et un double-clic le ramène au
  milieu.
- **Le mode est proposé au bureau dès que deux planchers tiennent** à côté de
  la barre latérale : barre latérale + 2 × 12 px de marge + deux volets +
  12 px de séparateur, soit 1 080 px de fenêtre barre dépliée — et jamais sous
  le seuil de bureau (1 024 px), où il n'y a pas de barre latérale.
- ⚠️ **Une fenêtre devenue trop étroite ne ferme rien** : seul le volet actif
  reste affiché, et l'autre revient quand la fenêtre s'élargit.
  Redimensionner n'est pas fermer.

## Défilement et pied de page

En écran partagé, la zone des volets tient dans la fenêtre et **chaque volet
défile seul** : on lit deux pages à des hauteurs différentes. La barre
latérale défile seule aussi, et ⚠️ **la fenêtre ne défile pas** : pas de
barre de défilement globale, qui ne ferait rien d'utile
([index.css](src/index.css), `data-ecran-partage`). Hors écran partagé, `body`
garde sa hauteur d'un écran + 3 rem, pour le « tirer pour recharger » du
téléphone. Une page qui
change revient en haut de SON volet. Le [pied de page](pied-de-page.md) ne
s'affiche pas : il n'aurait sa place que dans l'un des deux volets.

## Ce qui est retenu

L'état des volets (l'autre page, le côté actif, le verrou, la largeur) tient
pour la **session**, comme le repli de la barre latérale (`useStickyState`,
clé `ecranPartage.volets`). Il est **hors de la sauvegarde de session**
([feat-sauvegarde-session.md](../feat-sauvegarde-session.md)) : c'est une
disposition de la fenêtre, qu'un autre écran n'aurait peut-être pas la place
d'afficher.

## Limites

- **Ce qu'une page montre en portail suit la fenêtre, pas le volet** : une
  modale ou une popup ouverte depuis un volet étroit garde sa mise en page de
  bureau. Le panneau « Options » est l'exception : il s'affiche au format
  téléphone, comme la page qui l'ouvre.
- **L'historique du navigateur est unique** : « Précédent » peut ramener dans
  le volet actif une page vue dans l'autre — qui, si elle y est encore,
  active simplement l'autre volet.
- **Inverser les volets remonte les deux pages** de l'autre côté : un état
  propre à un composant, non remonté ni retenu (une saisie en cours), repart
  de zéro.
