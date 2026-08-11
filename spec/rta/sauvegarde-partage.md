# RTA · Point de sauvegarde & partage de prépa

Cinq boutons sous la barre d'actions : **Sauvegarder · Reprendre · Exporter ·
Importer · Consulter celle d'un ami**.

Fichiers : [RtaBackupBar.tsx](src/components/rta/RtaBackupBar.tsx) ·
[RtaFriendView.tsx](src/components/rta/RtaFriendView.tsx) (la consultation) ·
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

## ⚠️ L'instantané porte la prépa ET les catégories

Les deux vivent dans des hooks séparés, mais les catégories désignent des
monstres de la prépa. Restaurer l'un sans l'autre laisserait des anneaux sur des
monstres absents, ou des monstres dépouillés de leur étiquette. **Une seule clé**
(`sw-forge-rta-backup-v1`), un seul geste.

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

Conséquence assumée : un **monstre perso** (`com2usId = null`) n'est pas
partageable. Il est **écarté de l'export, et le message le dit** — un fichier
silencieusement incomplet se découvrirait chez l'ami, trop tard.

### ⚠️ Deux boutons, parce que ce sont deux intentions

Le fichier `.json` sert **deux usages** que rien ne distingue dans son contenu :

| Bouton | Intention | Effet |
|--------|-----------|-------|
| **Importer** | reprendre une prépa **à moi** — une archive, un autre navigateur, une sauvegarde d'il y a six mois | **remplace** ma prépa (avec confirmation) |
| **Consulter celle d'un ami** | regarder la prépa **de quelqu'un d'autre** | **n'y touche pas**, ouvre un panneau en lecture |

⚠️ **L'intention ne se devine pas depuis le fichier** — elle est *déclarée* par
le bouton cliqué. Un bouton unique obligerait à demander « et maintenant, j'en
fais quoi ? » après lecture, alors que l'utilisateur le sait déjà en cliquant.

Une version intermédiaire n'offrait que la consultation : elle rendait impossible
de **reprendre sa propre sauvegarde**, ce à quoi l'export sert tout autant qu'au
partage.

### La consultation

Elle s'ouvre **en lecture, à côté de la sienne**
([RtaFriendView](src/components/rta/RtaFriendView.tsx)) :

- rien n'entre dans l'état local — **aucune confirmation** n'est nécessaire,
  puisqu'il n'y a rien à perdre ;
- l'état vit dans la **page**, non persisté : c'est une lecture de passage.
  La conserver d'une session à l'autre laisserait la prépa de quelqu'un d'autre à
  l'écran sans qu'on sache d'où elle vient ;
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

### L'équipement se partage — sur décision de l'auteur

Consulter une prépa **sans voir les runes** n'a pas grand intérêt : c'est
justement ce qu'on vient y chercher. Mais l'équipement dit aussi **ce qu'on
possède**, et tout le monde ne veut pas l'exposer.

D'où une **question posée à l'export**, et non une règle imposée :

| Choix | Ce que le fichier contient |
|-------|----------------------------|
| **Avec mes runes et artéfacts** | classement, vitesses, **sets actifs et équipement complet** |
| **Classement seul** | classement et vitesses visées — **ni équipement, ni sets** |

⚠️ **Sans équipement, les sets ne partent pas non plus** : ce sont eux qui
trahissent le runage. « Partager sans montrer mes runes » doit vouloir dire
exactement ça — c'est vérifié par un test, en relisant le JSON produit.

L'option « avec » est **désactivée sans compte importé** (rien à joindre), et le
dialogue l'explique plutôt que de laisser un bouton inerte.

### Format (`format: "sw-forge/prepa-rta"`, `version: 2`)

```json
{ "format": "sw-forge/prepa-rta", "version": 2, "exporte_le": "…",
  "nom": "", "auteur": "", "avec_equipement": true,
  "sections": ["swift", "violent", "other"],
  "monstres": [
    { "com2usId": 15214, "nom": "Trevor", "section": "swift", "vitesse": 120,
      "sets": ["swift", "will"],
      "equipement": { "base": {…}, "runes": […], "artifacts": […] } }
  ],
  "categories": [
    { "label": "Striper", "color": "#4ad8d8", "membres": [15214] }
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

⚠️ `avecEquipement` est déduit de **ce qui a réellement été lu**, pas de ce que
le fichier déclare : un `avec_equipement: true` sans la moindre rune afficherait
« runes incluses » sur une prépa qui n'en montre aucune.

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
| `com2usId` invalide | monstre ignoré |
| Même monstre deux fois | seule la première entrée est gardée |
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
