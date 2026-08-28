# RTA · Point de sauvegarde & partage de prépa

Cinq boutons sous la barre d'actions de **Ma prépa** : **Sauvegarder ·
Reprendre · Réinitialiser · Exporter · Importer**.

⚠️ **Consulter la prépa d'un ami n'est plus un de ces boutons** : c'est un
sous-onglet à part, `#/rta/ami` — voir « La consultation » plus bas et
[README.md](README.md).

Fichiers : [RtaBackupBar.tsx](src/components/rta/RtaBackupBar.tsx) ·
[RtaAmiSection.tsx](src/components/rta/RtaAmiSection.tsx) (l'écran de
consultation) · [RtaFriendView.tsx](src/components/rta/RtaFriendView.tsx) (la
prépa lue) · [RtaValidationReport.tsx](src/components/rta/RtaValidationReport.tsx)
(le rapport de lecture, **partagé** par les deux) ·
[useRtaBackup.ts](src/hooks/useRtaBackup.ts) (le point local) ·
[rtaShare.ts](src/lib/rtaShare.ts) (format, validation, traduction d'ids) ·
[rta-partage.test.ts](tests/rta-partage.test.ts).

## ⚠️ « Sauvegarder » n'est PAS de l'enregistrement

**La prépa est déjà écrite à chaque changement** ([useRtaState](src/hooks/useRtaState.ts),
[useRtaCategories](src/hooks/useRtaCategories.ts)) : on retrouve son écran exactement
tel qu'on l'a laissé, sans rien cliquer. Un bouton qui prétendrait « enregistrer »
mentirait deux fois — il ne ferait rien de plus, et sa présence laisserait croire
que sans lui tout est perdu.

Ce bouton répond à un autre besoin : **essayer sans risque**. On fige un
classement qui convient, on remanie librement, on revient au point posé si
l'essai ne donne rien. D'où le vocabulaire — « point de sauvegarde »,
« Reprendre » — et l'infobulle qui rappelle que la conservation automatique
existe par ailleurs.

Le point est **annoncé sous les boutons** (« Point de sauvegarde : 42 monstres ·
il y a 3 min »). Sans repère visible, on ne sait pas s'il existe ni de quand il
date — donc on n'ose pas expérimenter, et la fonctionnalité ne sert à rien.

## « Réinitialiser » — revenir à l'état de l'import

Un classement se remanie beaucoup, et on finit parfois par vouloir **repartir de
ce que le fichier de compte disait** : chaque monstre dans la section de son set,
rien d'ajouté à la main. C'est ce que fait ce bouton.

⚠️ **DEUX instantanés, sur deux clés distinctes**
([useRtaBackup.ts](src/hooks/useRtaBackup.ts)) :

| Point | Clé | Posé par | Ramène à |
|-------|-----|----------|----------|
| **manuel** | `sw-forge-rta-backup-v1` | « Sauvegarder » | ce qu'on a figé soi-même |
| **import** | `sw-forge-rta-import-v1` | **automatiquement**, à chaque import de compte | la prépa telle que le fichier l'a produite |

Les confondre ferait qu'importer un compte effacerait sans un mot le point qu'on
venait de poser — ou que « Réinitialiser » ramènerait à un classement remanié à
la main, ce qui n'est pas ce qu'il promet.

- Le point d'import est posé **dans la page RTA** et non dans `App` : il embarque
  les **catégories**, qui vivent là. Le déclencheur est un **compteur** d'imports
  (`UseRtaState.importCount`) — un booléen déjà à `true` ne redéclencherait rien
  au second import.
- ⚠️ Le bouton **n'apparaît que si un compte a été importé** : sans point
  d'import, il n'aurait aucun état où revenir. Le griser en permanence aurait
  ajouté une promesse à qui n'importe jamais de compte.
- La confirmation **dit les deux pertes** : tout le classement fait depuis
  l'import, et le fait que le point de sauvegarde manuel pointe désormais vers un
  état d'avant ce retour en arrière. Elle rappelle qu'**« Exporter » est le seul
  moyen** de garder le travail en cours.
- Le point d'import est **annoncé sous les boutons**, comme le point manuel :
  sans repère, on ne sait pas vers quel état on revient ni de quand il date.

## ⚠️ L'instantané porte la prépa ET les catégories

Les deux vivent dans des hooks séparés, mais les catégories désignent des
monstres de la prépa. Restaurer l'un sans l'autre laisserait des anneaux sur des
monstres absents, ou des monstres dépouillés de leur étiquette. **Une seule clé
par instantané**, un seul geste — vrai pour le point manuel comme pour celui de
l'import.

À la restauration, `seeded` passe à **vrai** : sans ça « Lead SPD » se
réamorcerait par-dessus ce qu'on vient de restaurer, et réapparaîtrait
précisément chez qui l'avait supprimée avant de sauvegarder.

## ⚠️ « Tout effacer » ne touche PAS au point de sauvegarde

C'est ce qui permet de revenir sur un effacement. L'effacer aussi ferait de ce
bouton une perte sans retour. La modale de confirmation le dit explicitement
quand un point existe.

## Partage entre joueurs

Même problème que les [recommandations de siège](../siege/recommandations.md), et
mêmes réponses — un seul format (**JSON**), un seul support (**fichier `.json`**),
clés en français, validation qui **remonte ses corrections** au lieu de les taire.

### ⚠️ `com2usId`, jamais l'id local

Une prépa se range par `monsterId` **local**, qui ne veut rien dire d'un joueur à
l'autre. L'export traduit en `com2usId` (la seule clé stable, celle des imports
SWEX), l'import retraduit dans les ids du destinataire.

Si cette traduction dérape, **rien ne plante** : les monstres arrivent rangés sur
les mauvaises cartes et les anneaux se posent à côté. C'est le « grave et
invisible » que couvrent les tests.

#### ⚠️ Les monstres perso partent AUSSI — décrits en entier

Un **monstre perso** (`com2usId = null`) ne peut pas être *retrouvé* chez le
lecteur. Mais il se **décrit** entièrement — nom, élément, vitesse de base,
lead — et c'est tout ce qu'il faut pour l'**afficher**.

Une première version les écartait purement et simplement : une prépa contenant
une sortie récente arrivait **amputée**, et son ordre de tour était faux d'un
monstre. Chaque entrée porte donc soit un `com2usId`, soit un objet `perso`.

Conséquences :

- ils s'affichent **sans portrait** chez le lecteur (aucune image ne leur
  correspond) — le message d'export le dit ;
- leur appartenance aux **catégories** passe par leur **position** dans
  `monstres` (`membresPerso`), faute d'identifiant ;
- la **déduplication** ne porte que sur les monstres identifiés : deux perso ont
  tous deux `com2usId: null` sans être le même monstre ;
- à l'**import** (et non à la consultation), ils sont **recréés** dans la liste
  de monstres perso du lecteur — la confirmation l'annonce, et la création n'a
  lieu **qu'à la validation** : annuler ne laisse rien derrière soi.

### ⚠️ Deux ÉCRANS, parce que ce sont deux intentions

Le fichier `.json` sert **deux usages** que rien ne distingue dans son contenu :

| Où | Intention | Effet |
|----|-----------|-------|
| **Importer** (Ma prépa) | reprendre une prépa **à moi** — une archive, un autre navigateur, une sauvegarde d'il y a six mois | **remplace** ma prépa (avec confirmation) |
| **Onglet Ami** (`#/rta/ami`) | regarder la prépa **de quelqu'un d'autre** | **n'y touche pas**, lecture seule |

⚠️ **L'intention ne se devine pas depuis le fichier** — elle est *déclarée* par
l'endroit où on l'ouvre. Un point d'entrée unique obligerait à demander « et
maintenant, j'en fais quoi ? » après lecture, alors que l'utilisateur le sait
déjà avant de cliquer.

⚠️ **Les deux boutons étaient côte à côte**, dans la même rangée, à lire le même
format : rien ne disait lequel touchait à ma prépa. Séparer les intentions par
l'ÉCRAN, et non par deux boutons voisins, est ce qui les distingue vraiment —
« Importer » vit avec les gestes qui modifient ma prépa, la consultation avec ce
qui ne la modifie pas.

Une version intermédiaire n'offrait que la consultation : elle rendait impossible
de **reprendre sa propre sauvegarde**, ce à quoi l'export sert tout autant qu'au
partage.

### La consultation

Elle a son **sous-onglet** (`#/rta/ami`,
[RtaAmiSection](src/components/rta/RtaAmiSection.tsx)), qui porte le bouton
d'ouverture du fichier et affiche la prépa lue
([RtaFriendView](src/components/rta/RtaFriendView.tsx)) :

- rien n'entre dans l'état local — **aucune confirmation** n'est nécessaire,
  puisqu'il n'y a rien à perdre ;
- ⚠️ **Un écran, plus un panneau au-dessus de sa prépa.** Elle s'affichait EN
  TÊTE de sa propre prépa : deux prépas dans la même page, dont celle du haut
  n'était pas la sienne, et un écran qui doublait de longueur sans prévenir ;
- **écran vide parlant** tant qu'aucun fichier n'est ouvert : il dit d'où vient
  le fichier (« Exporter », chez l'ami) et ce qu'on y verra — pas une page
  blanche ;
- le bouton reste **le même une fois une prépa ouverte**, seul son libellé change
  (« Ouvrir une autre prépa ») : en comparer deux est le geste courant, obliger à
  fermer d'abord ajouterait un clic sans rien protéger ;
- l'état vit dans la **page**, en mémoire, **jamais sur le disque**
  (`useStickyState`) : c'est la prépa de quelqu'un d'autre. Elle survit en
  revanche à la navigation — depuis qu'elle a son onglet, aller vérifier une
  vitesse sur sa prépa puis revenir ne doit pas obliger à rouvrir le fichier ;
- les cartes sont **inertes** : ni poignée de glisser-déposer, ni croix, ni
  sélecteur de section — aucun de ces gestes n'a de sens sur la prépa d'autrui.

### L'import (« reprendre une prépa »)

Il **remplace** : il n'y a qu'une prépa RTA, deux classements ne peuvent pas
coexister. D'où une **confirmation** qui énonce ce qu'on perd, **prévient quand
aucun point de sauvegarde n'existe** (en invitant à en poser un d'abord), et
rappelle que « Consulter » existe si l'intention était seulement de regarder.

Conformément à la règle générale (voir [../README.md](../README.md)), le défaut
ne perd rien : « Annuler » est le bouton mis en avant, l'action porte la couleur
d'alerte.

#### ⚠️ Mon équipement actuel prime sur celui du fichier

Un monstre **déjà présent** chez moi garde le `gear` venu de **mon** import de
compte : c'est l'état réel de mes runes aujourd'hui, forcément plus juste que
celui figé dans une sauvegarde d'il y a six mois. L'équipement du fichier ne sert
qu'à **combler les monstres que je n'ai pas encore**.

Ce qu'on reprend d'un fichier, c'est un **classement** — sections, vitesses
visées, catégories.

### ⚠️ Rien n'est comparé à ce que je possède

Les monstres, les vitesses et les runes affichés sont **ceux de l'auteur**, tels
quels. Confronter à ma box répondrait à une autre question — « puis-je jouer
ça ? » — et c'est exactement le rôle des
[recommandations de siège](../siege/recommandations.md), qui existent pour ça.

Ici, on regarde la prépa d'un ami **comme on regarderait son écran par-dessus son
épaule**. Le panneau le dit à voix haute (« Ta prépa n'a pas bougé et rien n'est
comparé à tes monstres ») : sans ça, on cherche un verdict qui n'existe pas sur
cet écran, et on se demande si sa propre prépa a bougé.

### Trois niveaux de partage, choisis à l'export

Consulter une prépa **sans voir les runes** n'a pas grand intérêt : c'est
justement ce qu'on vient y chercher. Mais l'équipement dit aussi **ce qu'on
possède**, et tout le monde ne veut pas l'exposer.

D'où une **question posée à l'export**, et non une règle imposée :

⚠️ **Un niveau ORDONNÉ, pas des cases à cocher.** Chaque palier retire une couche
de plus, et chaque couche retirée l'est parce qu'elle **révèle le runage**.
Des drapeaux indépendants laisseraient composer « runes sans vitesses », qui n'a
aucun sens : les runes *portent* la vitesse.

| Niveau | Le fichier contient | Chez le lecteur |
|--------|---------------------|-----------------|
| **Tout** | sections, catégories, vitesses, sets, **équipement** | prépa complète + ordre de tour calculé |
| **Vitesses finales seules** | **vitesses** — ni sections, ni sets, ni équipement | ordre de tour calculé, rien d'autre |
| **Ordre de tour seul** | le **rang** de chaque monstre, et rien d'autre | vignettes numérotées seules |

#### ⚠️ Ce qui révèle le runage, et qui n'en a pas l'air

Trois fuites, corrigées ensemble parce qu'elles disent toutes la même chose :

| Donnée | Ce qu'elle révèle |
|--------|-------------------|
| **Vitesse totale** | la vitesse de base est **publique** (SWARFARM) : l'écart donne **exactement** la vitesse des runes |
| **Section** | une section **EST un set** : ranger un monstre dans « Swift » annonce qu'il est runé Swift |
| **Catégorie** | libre, mais souvent nommée d'après le runage (« Swift lead », « Violent ») |

Une version antérieure exportait « sans les runes » en gardant vitesses et
sections : elle ne cachait rien. Les trois partent donc **avec** les sets, et
c'est vérifié par des tests qui savent échouer.

Vérifié en **relisant le JSON produit**, jamais par une recherche de chaîne dans
un texte indenté — celle-ci n'aurait jamais pu échouer.

#### Le rang est calculé à l'export

Au niveau « ordre de tour seul », le lecteur **ne peut pas** recalculer le
classement : il n'a pas les vitesses, et c'est précisément ce que l'auteur
refuse de donner. Le **rang** (1 = le plus rapide) est donc calculé à l'export et
transmis tel quel.

C'est la seule exception à la règle « l'ordre de tour est recalculé » — et elle
est assumée : sans elle, le niveau n'aurait rien à montrer.

L'option « Tout » est **désactivée sans compte importé** (rien à joindre), et le
dialogue l'explique plutôt que de laisser un bouton inerte.

#### ⚠️ Le nom du fichier dit ce qu'il contient

`swforge-prepa-rta-<niveau>-<AAAA-MM-JJ>.json`, où `<niveau>` vaut `complet`,
`vitesses` ou `ordre-de-tour`.

C'est le **seul repère avant d'ouvrir le fichier** : dans un dossier de
téléchargements, ou quand on en reçoit un d'un ami, un nom générique ne dit pas
si les runes y sont. Le nom est **repris dans le message de confirmation**, pour
qu'on sache quoi chercher.

### L'ordre de tour est RECALCULÉ — sauf au dernier niveau

Aux niveaux **Tout** et **Vitesses seules**, il se déduit des vitesses et du lead
simulé. Le transporter aurait figé un classement qui ne suivrait plus les boutons
de lead, et qu'il faudrait tenir à jour à chaque modification.

La consultation réutilise **le composant de sa propre prépa**
([TurnOrder](src/components/rta/TurnOrder.tsx)), sans `onRuneSpeed` — ce qui
retire les champs de saisie et le rend lisible seul. Une seconde implémentation
aurait divergé au premier changement de règle de tri.

Au niveau **Ordre de tour seul**, le rang vient du fichier (voir ci-dessus) et
s'affiche en **vignettes numérotées**, celles-là mêmes qu'on lit sur sa propre
prépa — aucun repère nouveau à apprendre. Pas de boutons de lead : les simuler
exigerait les vitesses.

#### Options d'affichage, dans la barre de l'ordre de tour

Deux interrupteurs — **Vitesses** et **Catégories** — vivent avec les boutons de
lead, au contact des vignettes qu'ils modifient, et non en tête de panneau où
l'on ne ferait pas le lien.

Ils ne dévoilent **jamais** rien de plus que ce que le fichier porte : ils
masquent, ils ne révèlent pas. « Catégories » n'apparaît que s'il y en a — un
interrupteur sans effet se clique et laisse croire à un bug.

⚠️ **Masquer les vitesses retire l'ICÔNE avec le chiffre.** Ne masquer que la
valeur laissait une icône de vitesse orpheline suivie d'un tiret : on cherche le
chiffre manquant en croyant à un défaut d'affichage.

⚠️ **Masquer les vitesses ne masque pas l'ordre de tour** : le tri continue de
les utiliser, le classement reste juste et lisible sans les chiffres.

#### ⚠️ `categoriesVisible` agit DANS `TurnOrder`, pas chez l'appelant

Le drapeau ne pilotait que l'apparence du bouton ; le masquage se faisait en
amont (`categories={visible ? cats : []}`). Une fois masquées, les catégories
n'arrivaient donc plus au composant et **son propre interrupteur ne pouvait plus
rien réafficher**. Les catégories lui sont désormais passées entières.

### Format (`format: "sw-forge/prepa-rta"`, `version: 2`)

```json
{ "format": "sw-forge/prepa-rta", "version": 2, "exporte_le": "…",
  "nom": "", "auteur": "", "niveau": "complet",
  "sections": ["swift", "violent", "other"],
  "monstres": [
    { "com2usId": 15214, "nom": "Trevor", "section": "swift", "vitesse": 120,
      "sets": ["swift", "will"],
      "equipement": { "base": {…}, "runes": […], "artifacts": […] } },
    { "nom": "Sortie récente", "section": "swift", "vitesse": 118,
      "perso": { "nom": "Sortie récente", "element": "fire", "vitesse": 110,
                 "lead": { "stat": "Attack Speed", "amount": 33, "area": "General" } } }
  ],
  "categories": [
    { "label": "Striper", "color": "#4ad8d8", "membres": [15214], "membresPerso": [1] }
  ] }
```

Les catégories sont **omises si vides**. L'appartenance y est exprimée en
`com2usId`, comme les monstres.

| Version | Changement |
|---------|-----------|
| 2 | l'**équipement** (runes, artéfacts, relique) peut accompagner chaque monstre |
| 1 | classement, sections, vitesses et catégories |

Un fichier **v1 se lit sans perte** — il n'a simplement rien à montrer côté
runes — mais **c'est signalé**, pour que son auteur sache qu'il peut le
réexporter plus riche. Sans ça un fichier ancien circule indéfiniment dans la
guilde et personne ne sait qu'un format plus complet existe.

⚠️ Le niveau est déduit de **ce qui a réellement été lu**, jamais de la clé
`niveau` : un `"complet"` sans la moindre rune afficherait « runes incluses » sur
une prépa qui n'en montre aucune. La clé du fichier est donc **informative** —
elle renseigne un humain qui l'ouvre, elle ne fait pas foi.

Une vitesse masquée est **absente** du JSON (`undefined`), et non `null` : une
clé vide se lirait comme « vitesse non saisie » et non « vitesse retirée ». Même
règle pour `rang`, présent au seul niveau « ordre ».

### ⚠️ Un fichier d'un autre type est REFUSÉ, pas lu de travers

Un `format` différent est une **erreur bloquante**. Le lire « au mieux »
afficherait un panneau vide sans dire pourquoi.

### L'équipement reçu est validé, jamais affiché tel quel

Il vient d'un tiers et sert à **dessiner** une roue de runes : une rune sans slot
valide (1–6), sans set connu ou sans stat principale ferait un trou à l'écran.
Elle est donc écartée, les autres restent.

La validation est **structurelle seulement** — types et bornes. On ne juge pas la
**plausibilité** des valeurs : un socle inhabituel peut venir d'une nouveauté du
jeu que cette version ne connaît pas encore, et refuser l'affichage serait pire
que montrer un chiffre surprenant.

Un équipement **entièrement vide n'est pas retenu** : il ouvrirait un chevron
« voir le détail » qui n'affiche rien.

### Corrections signalées à la lecture

| Cas | Traitement |
|-----|-----------|
| Ni `com2usId` valide ni description `perso` | monstre ignoré |
| `perso` sans nom ou sans vitesse > 0 | description ignorée (il fausserait l'ordre de tour) |
| Même monstre **identifié** deux fois | seule la première entrée est gardée |
| Section inconnue | rangé en « Non classé » plutôt que perdu |
| Vitesse négative / non numérique | laissée vide, le monstre est gardé |
| Section utilisée mais absente de `sections` | **recréée** — sinon le monstre serait invisible |
| Monstre absent des données chargées | non affiché, et **remonté** dans le rapport |
| Catégorie sans libellé ou couleur invalide | ignorée |
| Rune sans slot valide, set connu ou stat principale | écartée, les autres restent |
| Équipement entièrement vide | non retenu (il ouvrirait un détail vide) |

« Autre » est garantie présente, comme partout ailleurs dans l'app.

Le **rapport de validation** reste affiché jusqu'à fermeture (il y a quelque
chose à lire) ; le message de succès, lui, est éphémère — même convention que
l'import de compte.
