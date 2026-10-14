# Recommandations — repli et édition

Partie de [Siège · Recommandations](README.md).

## Interactions

### Repliée par défaut — bouton « Consulter »

Une recommandation contenant plusieurs decks de 3 monstres, la liste serait
illisible tout déplié. Chaque carte est donc **repliée par défaut** :

- **Repliée** : l'en-tête (nom, puce « Importée », nombre de decks, auteur)
  **+ un aperçu d'une ligne** — une puce par deck avec son
  **nom** et un **point de couleur** (vert/orange/rouge/neutre) reprenant son
  statut, plus un repère « consignes » si la recommandation en porte. On voit
  donc quoi ouvrir **sans rien déplier**. Cliquer l'aperçu déplie aussi.
- **Bouton « Consulter »** (chevron) dans l'en-tête → déplie et affiche les
  consignes générales puis tous les decks ; devient **« Réduire »**.
  ⚠️ **À la SOURIS seulement.** Au doigt, ce petit bouton du coin serait une
  seconde cible pour le même geste que le titre — sur un écran qu'on parcourt
  au pouce, la plus petite des deux. À la souris, viser un bouton précis ne
  coûte rien, et le chevron confirme l'état d'un coup d'œil.
  ⚠️ **À la souris, c'est un CHEVRON seul en tête de ligne**, le même que
  celui de chaque deck : pointe à droite replié, en bas déplié, libellé
  « Consulter » / « Réduire » en infobulle et `aria-label`. Le bouton étiqueté
  « Consulter / Réduire » au bout de la ligne ne vit que sous `lg` (souris sur
  fenêtre étroite). En édition, le chevron reste en place, **désactivé**
  (« Termine l'édition pour replier ») : le retirer décalerait le champ du nom.
- **Le TITRE bascule aussi la carte** — même geste que « Consulter », pas un
  second, et le SEUL au doigt. Masqué en édition, comme « Consulter » : le
  titre devient alors le champ de saisie du nom.
- **Plusieurs recommandations peuvent être dépliées** en même temps (état local
  au board, non persisté).
- **Éditer implique déplier** : une carte en édition (recommandation **ou** l'un
  de ses decks) est toujours affichée en entier
  (`expanded = open || editing || editingDeck !== null`) — le bouton
  « Consulter » est donc **masqué en édition** (il n'aurait aucun effet).

### Repli deck par deck

« Exporter vers l'Optimizer » est présent sur chaque ligne de deck, repliée
ou dépliée, aux deux formats, ainsi que sur les offenses de la vue Défense.
Il importe ce seul deck avec les exemplaires retenus par la confrontation,
ouvre l’Optimizer et présente le rapport en modale. Sans compte ou sans
membre importable, il reste désactivé avec sa raison ; un refus garde la page.
Voir [l’import d’équipes](../../optimizer/feat-import-equipes.md#exporter-la-pr%C3%A9pa-rta-et-un-deck-recommand%C3%A9).

Indépendamment du repli de la carte, **chaque deck a son propre chevron**.

- ⚠️ **Les decks sont repliés par défaut** : déplier une recommandation montre la
  **liste de ses decks**, pas leur contenu. On ouvre ensuite celui qui intéresse.
  Sans ça, une reco de 6 decks déroulait tout l'écran d'un coup.
- ⚠️ **À la SOURIS, un TABLEAU de decks, chacun dépliable en sa carte
  détaillée.** Chaque deck est une LIGNE, sous une rangée d'intitulés de
  colonnes :
  - **Offense · sets visés** : les 3 monstres (portrait + nom), le leader
    d'abord avec son badge de lead ; les **icônes des sets visés collées à
    chaque monstre** (première possibilité de runage) — on voit qui porte
    quoi sans ouvrir. Pas de colonne « Sets et stats » à part : on ne saurait
    plus quel monstre porte quel set ; les stats visées sont dans le détail,
    trop nombreuses pour une ligne.
  - **Fort contre** : les portraits de la première défense visée (+N s'il y
    en a d'autres).
  - **Verdict** : après analyse, la pastille du statut avec les libellés des
    filtres (Bon · À composer · À revoir · Monstre manquant, `VERDICTS`), la
    phrase complète en infobulle, et « réalisable N fois ». Avant analyse,
    rien.
  - Le chevron est dans la ligne ; le crayon n'y est pas : c'est « Éditer ce
    deck », en pied du détail déplié (voir en tête de fichier) — le MÊME
    bouton qu'au doigt, seule la disposition change.
  Déplier une ligne montre, dessous, la **carte détaillée** (consignes du
  deck, les 3 monstres avec runage, stats et artéfacts, « Fort contre » avec
  ses précisions, édition). **Au doigt**, les decks sont des cartes empilées,
  repliées par défaut, qui s'ouvrent au toucher ; la rangée repliée montre
  **« Fort contre »** (séparé de l'offense par un filet) et, dessous, les
  **sets visés** de chaque monstre (une pastille par monstre, première
  possibilité de runage).
  ⚠️ **Au doigt, l'en-tête est une grille de deux colonnes** : à
  gauche, la rangée — chevron, les trois portraits, « Fort contre » sur la
  même ligne — et, dessous, les sets visés, **chaque pastille centrée sous
  son monstre** (un monstre sans set garde sa place, vide) ; à droite, sur la
  hauteur de la rangée et des sets, une **colonne d'actions** : Supprimer,
  Éditer, Exporter vers l'Optimizer, de haut en bas. Sur une seule ligne, à
  360 px, ces trois icônes ne laissaient que 19 à 24 px à chaque enveloppe de
  portrait de 34 px : les portraits se chevauchaient. Les enveloppes ne
  rétrécissent plus (`max-lg:flex-none`), 10 px les séparent (la largeur
  d'une pastille de deux sets, 42 px, tient sous chacun ; une pastille de
  **trois sets** perd son rembourrage et ses espacements — icônes de 13 px
  collées, l'arrondi au ras des icônes, au doigt comme à la souris : 41 px
  au lieu de 57, qui mordaient de 5,5 px sur les voisines) ; la rangée garde
  ses 40 px de haut, et la colonne (trois icônes de 20 px) tient dans la
  rangée et les sets : la carte ne grandit pas. L'export y prend la taille
  de ses voisins (20 px, `data-cible-fine` : exempté de la règle des 40 px)
  et garde sa raison de désactivation en infobulle ; en
  édition, « Annuler les modifications » se place sous le ✓, que la colonne
  ne déplace pas. Les trois icônes sont sur **le même axe vertical** et
  **réparties à espacements égaux** sur toute la hauteur de la rangée et des
  sets (65 px, 2,5 px entre deux icônes). Les deux `BoutonIcone` à
  libellé « à la souris » perdaient 3 px à gauche du centre (le `<span>` vide
  du libellé masqué recevait l'espacement du bouton) : `max-lg:gap-0` les
  recentre. À la souris, rien ne change.
  Une ligne par deck se lit d'un regard, sans
  demi-largeur vide — ce qu'une grille de cartes sur deux colonnes ne permet
  pas. ⚠️ Le deck en édition ne porte pas de `lg:col-span-2` : dans le tableau
  à UNE colonne, il en créerait une seconde, implicite, où la rangée
  d'intitulés et les lignes se tasseraient.
- **Lead du leader** : affiché **sur le monstre** en slot 0, comme en siège et
  avec les mêmes composants ([LeadPill.tsx](src/components/siege/LeadPill.tsx)) —
  `LeadBadge` sur son portrait dans l'aperçu replié (pastille `lead` de
  [MonsterAvatar](src/components/MonsterAvatar.tsx), comme la couronne du
  leader sans lead), `LeadPill` (icône +
  montant) sous son nom dans le deck déplié. **Pas** dans l'en-tête du deck :
  on doit voir de quel monstre vient le lead. Voir [feat-equipes.md](../feat-equipes.md).
- **En-tête du deck, replié OU déplié** : chevron + **les 3 monstres en
  icônes** (portrait hexagonal 34 px + badge d'élément, **sans nom, sans
  titre texte**), cliquables pour basculer le repli, + le badge de statut et
  les icônes **Éditer**/Supprimer. ⚠️ **Aucun texte n'identifie le deck** :
  les portraits (34 px) portent seuls ce qu'un titre — libre ou calculé —
  redoublerait.
  Toujours affichés, quel que soit l'état de repli : c'est le seul repère du
  deck qu'on garde en le dépliant, avant que sets/artéfacts/stats n'arrivent
  plus bas.
- ⚠️ **Une rangée qui finit sur un portrait garde la place de son icône
  d'élément**, qui dépasse de 4 px à droite (`-right-1` dans
  [MonsterAvatar](../../../../src/components/MonsterAvatar.tsx)) : `pr-1 -mr-1`
  sur l'enveloppe de portrait de l'en-tête (au doigt seulement, `max-lg:`) —
  et, depuis la colonne d'actions, sur « Fort contre » et sur la
  rangée de l'en-tête, qu'il finit —, la
  rangée de portraits d'une vignette « Fort contre » sans note, et les
  portraits d'une défense et d'une offense en vue Défense. Le rembourrage met
  l'icône dans la boîte de sa rangée ; la marge négative le rend à
  l'espacement voisin : aucun élément ne bouge.
- ⚠️ **Sur mobile, le verdict et le nombre de copies passent chacun à la
  ligne** (`basis-full sm:basis-auto` sur les deux `span` qui les portent) :
  icônes des monstres sur une ligne, verdict sur la suivante, « réalisable N
  fois » sur la dernière. Un simple `flex-wrap` sur la rangée ne suffit
  pas — un item flex qui trouve un peu de place restante après les icônes s'y
  installe et enroule son PROPRE texte au mot (« indis- » collé aux icônes,
  « ponible… » en dessous) au lieu de descendre entier à la ligne suivante :
  le repli semblerait aléatoire (net sur un deck, tronqué sur le suivant) selon
  la largeur qu'occupent les icônes déjà posées. `basis-full` force chaque
  ligne à démarrer la sienne, systématiquement, tant qu'il n'y a pas la place
  de tout tenir sur une seule (`sm:basis-auto` au-delà).
- ⚠️ **Le crayon Éditer/Supprimer reste hors de la rangée verdict/copies**
  (au doigt, dans la colonne d'actions de l'en-tête, voir plus haut),
  plutôt que dans la même rangée `flex-wrap` qu'eux. Un bouton d'action ne doit pas changer de
  position selon ce qui s'affiche à côté de lui : mêlé au verdict, le crayon
  suivrait le badge sur sa ligne et se retrouverait repoussé en bas dès que
  « réalisable N fois » gagne sa propre ligne (voir ci-dessus) — il reste en
  haut à droite, toujours.
- **Padding réduit au tactile** (`compact:p-1`, contre `p-2.5` à la souris) :
  les cartes de deck sont dans une liste déjà dense (jusqu'à une
  demi-douzaine par recommandation) sur un écran étroit. Même resserrement
  sur l'espacement de la rangée verdict/copies (`compact:gap-1 compact:mt-0.5`).
- **« Déplier / Replier tous les decks »** : lien en haut à droite de la liste,
  affiché dès **2 decks**. À la souris, un **bouton fantôme** de la librairie,
  toujours **au-dessus** du tableau : en dessous, le clic le repousserait de
  toute la hauteur des decks dépliés.
- Un deck **en édition est toujours déplié**, quel que soit son état de repli.
- État **local à la carte** (`openDecks` = les decks ouverts), réinitialisé quand
  le **nombre de decks change** (les index se décalent à l'ajout/suppression).
  Replier puis rouvrir la recommandation **conserve** les decks qu'on avait
  ouverts.

- **Créer une recommandation** → carte ajoutée en fin de liste **avec un deck
  vide**, **ouverte en édition** (recommandation **et** son deck), et **scroll
  automatique** jusqu'à elle (comme « Ajouter une équipe », voir
  [README.md](../README.md)).
### Trois niveaux d'édition, séparés

| Bouton | Où | Ce qu'il ouvre |
|--------|----|----------------|
| ✏️ (en-tête de la carte) | recommandation | **nom, auteur, consignes générales** + **Ajouter un deck vide** / **Importer un deck d'offense** |
| ✏️ (en-tête de chaque deck) | deck | **ses consignes, ses monstres, sets, artéfacts et stats** + 🗑 **Supprimer ce deck** (le nom n'est plus saisi, voir plus haut) |
| **+ Défense** / ✏️ sur une vignette | défenses visées | **une** défense que ce deck bat — indépendant du deck |

⚠️ Le troisième est **volontairement détaché** du deuxième : ajouter une défense
qu'on vient d'affronter est un geste **de passage**, éditer les stats d'un deck
est un **travail de fond**. Il n'a d'ailleurs **pas de mode édition de bloc** —
juste un « + » qui ajoute et ouvre l'entrée créée. Voir « Défenses visées » plus
haut.

#### « Annuler les modifications » — sortir sans garder

Chaque modification s'enregistre **tout de suite** ; le ✓ termine l'édition en
gardant tout. Pendant une édition, un bouton **« Annuler les modifications »**
(icône ↶) termine l'édition en remettant ce qu'il y avait **à son ouverture**
— logique pure dans [annulerEdition.ts](src/lib/annulerEdition.ts) :

| Où | Ce qui revient | Ce qui reste |
|----|----------------|--------------|
| deck (pied à la souris, à côté du ✓ au doigt) | consignes, monstres, sets, artéfacts, stats | les **défenses visées** — édition détachée, on ne défait pas l'une avec l'autre |
| recommandation (en-tête, à côté du ✓) | nom, auteur, consignes générales, **et** le deck en cours d'édition s'il y en a un — symétrique de « Terminer », qui termine aussi le deck | les decks **ajoutés** pendant l'édition (on les retire avec « Supprimer ce deck ») |

- **Placé juste AVANT le ✓** : le groupe d'actions est en bout de ligne (au
  doigt) ou calé à droite (pied, à la souris) ; il s'allonge vers la gauche,
  le ✓ qu'on vient de toucher ne bouge pas. À la souris, le pied l'écrit en
  toutes lettres, comme « Terminer l'édition de ce deck ».
- **Grisé tant que rien n'a changé** (comparaison par valeur : retaper la même
  chose n'est pas une modification).
- ⚠️ **Ni confirmation, ni notification.** Une confirmation serait un « OK »
  qui détruit ; une notification « Modifications annulées · Rétablir » ferait
  une **annulation d'annulation**. La sortie du mode édition dit assez ce qui
  s'est passé ; le bouton grisé tant que rien n'a changé évite le clic pour
  rien.
- **Un deck tout juste ajouté** (création d'une recommandation, « Ajouter un
  deck vide », « Importer un deck d'offense ») s'ouvre en édition : annuler le
  remet **comme à l'ajout** (vide, ou tel qu'importé), il ne le retire pas.
- ⚠️ **Le nombre de decks change pendant une édition** (un autre deck
  supprimé, ou remis par « Annuler ») : les index se décalent, le deck mémorisé
  ne serait plus le même. L'édition se **termine** alors, modifications
  gardées — sauf pour le deck qu'on vient d'ajouter en fin de liste
  (`deckEditeApresChangement`).
- **Supprimer un deck termine l'édition** avant de le retirer : supprimer le
  dernier le remplace par un deck vide sans changer leur nombre, et l'édition
  resterait sinon ouverte sur ce deck vide, prête à recopier une partie du
  deck supprimé.

⚠️ **Un monstre choisi, le curseur passe au monstre suivant** : dans les 3
slots d'un deck comme dans les 3 monstres d'une défense visée, le champ du
**slot vide suivant** prend le focus
— en bouclant sur ceux d'avant si on a commencé par le milieu ; trio complet,
le focus ne bouge pas. On compose ainsi un trio au clavier, sans revenir à la
souris. Calcul dans
[slotVideSuivant.ts](../../../../src/components/siege/slotVideSuivant.ts) (testé :
`siege-slot-suivant`), focus par le `jetonFocus` de
[MonsterPicker](../../../../src/components/MonsterPicker.tsx) — un jeton qui change
à chaque demande, car le champ suivant est DÉJÀ affiché (`autoFocus` n'agit
qu'au montage).

#### ⚠️ Le titre et les icônes d'action partagent LEUR PROPRE rangée

L'en-tête est **trois zones empilées**, pas deux côte à côte :

| Rangée | Contenu | Comportement |
|--------|---------|--------------|
| 1 — titre + actions | titre (cliquable, bascule la carte, tronqué s'il déborde) et, sur la MÊME ligne : « Consulter » (souris seulement), Exporter ↑, Éditer ✏️, Supprimer 🗑 | `items-center`, une seule ligne |
| 2 — métadonnées | puce « Importée », compteur de decks, auteur, « Analyser mes decks » (souris seulement) | passe à la ligne librement, sous la rangée 1 |

⚠️ **Pas deux zones côte à côte** (titre+badges à gauche, icônes à droite) :
- avec `items-start`, c'est correct tant que le titre est seul sur sa ligne,
  mais la zone de gauche passe couramment sur DEUX lignes dès que le nom n'est
  pas très court (badges qui débordent en dessous) — pas un cas rare, le cas
  courant sur une carte de largeur mobile ;
- avec `items-center`, les icônes se placeraient **entre** les deux lignes de
  gauche : ni alignées sur le titre, ni sur les badges.

Le problème n'est pas l'alignement CSS mais la STRUCTURE : titre et badges
n'ont aucune raison de partager une hauteur commune avec les icônes, ce sont
deux informations différentes. Les séparer en deux rangées résout tout d'un
coup — la rangée 1 ne contient plus QUE le titre et les icônes, qui peuvent
alors se centrer l'un sur l'autre sans qu'un troisième élément interfère.

⚠️ Le titre porte `leading-none` (sa boîte de ligne, interligne 1,6 de
l'échelle, dépasserait sinon la hauteur des icônes) et `p-0` explicite (un
`<button>` a un rembourrage par défaut du navigateur, invisible à l'œil mais
qui élargit sa boîte au-delà du texte).

⚠️ **Icônes en 24 px (`h-6 w-6`), pas 20**, pour respirer un peu plus, sans
perdre l'exemption tactile (`taille="serre"` garde `data-cible-fine`, donc les
40 px de la règle au doigt ne s'appliquent pas). L'override passe par
`className`, et ça tient parce que `h-6` est PLUS LOIN que le `h-5` du
composant dans la feuille de style construite (Tailwind range ses valeurs par
ordre croissant) — vérifié dans le CSS, pas supposé.

Dans un `flex-wrap` unique, les trois icônes suivraient le flux et
**retomberaient sous le titre** dès que la ligne est pleine — leur position
changerait d'une carte à l'autre selon la longueur du nom, et il faudrait les
chercher des yeux à chaque fois. Une barre d'outils se trouve à un endroit
fixe, ou elle n'en est pas une.

**Icônes nues partout** dans les en-têtes — carrés de 24 px, **sans cadre ni
fond**, groupés et resserrés (`gap-0.5`) à droite de la ligne :

- **recommandation** : Exporter ↑, Éditer ✏️, Supprimer 🗑 — la ligne porte déjà
  le titre, la puce « Importée », le compteur de decks, l'auteur, et
  « Analyser mes decks » / « Consulter » à la souris. Analyser vit au doigt
  dans le panneau « Options » (voir plus haut), pas dans ce groupe.
- **deck** : Éditer ✏️, puis Supprimer 🗑 — **toujours visible**, pas seulement
  en édition.
- Le sens passe par l'**infobulle** et l'`aria-label` (obligatoire : une icône
  seule n'est pas lisible au lecteur d'écran).
- Faute de cadre pour marquer l'état actif, l'**édition en cours** se lit à
  l'icône qui devient un **✓ doré** (`text-star`) + `aria-pressed`. Les deux
  crayons sont des `BoutonIcone` : la couleur dorée est posée sur
  l'**icône**, pas sur le bouton — deux classes de couleur rivales sur le même
  élément n'ont pas d'ordre garanti dans la feuille.
- À la souris, ces carrés passent à **28 px aux coins arrondis** (voir en tête
  de fichier, « un seul bouton d'icône »).
- Les libellés ne sont conservés que là où la place ne manque pas : « Analyser
  mes decks », « Consulter », et les actions de la barre du haut.

- Éditer la recommandation **ne rend pas les decks modifiables** : les deux
  portées sont indépendantes, on ne touche pas au contenu d'un deck en corrigeant
  un titre.
- **Un seul deck en édition à la fois** (et une seule recommandation) : on
  travaille sur un deck, pas sur six.
- **« Terminer » sur la recommandation termine aussi l'édition de ses decks** :
  un seul geste referme tout, on ne laisse pas un deck en édition derrière soi.
  Vaut également quand le board bascule l'édition vers **une autre**
  recommandation (implémenté par effet sur `editing`, pas dans le `onClick`).
- Un deck **en édition est toujours déplié**, même s'il était replié.
- Le bouton d'édition d'un deck est accessible **dès que la carte est dépliée**,
  sans passer par l'édition de la recommandation.
- **Raccourcis** : créer une recommandation ouvre directement son deck vide en
  édition ; ajouter/importer un deck ouvre le nouveau deck en édition.
- La suppression d'un deck **se défait** (« Deck supprimé · Annuler ») au
  lieu de se confirmer.
- **Disposition** : les recommandations sont **empilées en pleine largeur** (une
  par ligne) — elles contiennent plusieurs decks de 3 monstres, une mise en
  2 colonnes serait illisible. À l'intérieur, les decks sont empilés et chaque
  deck affiche ses 3 slots en ligne (1 colonne sous `sm`).
- **Supprimer** une recommandation (avec confirmation) · **Tout effacer**.
