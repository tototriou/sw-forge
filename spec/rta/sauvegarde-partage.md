# RTA · Point de sauvegarde & partage de prépa

Quatre boutons sous la barre d'actions : **Sauvegarder · Reprendre · Exporter ·
Importer**.

Fichiers : [RtaBackupBar.tsx](src/components/rta/RtaBackupBar.tsx) ·
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

### ⚠️ L'équipement (`gear`) n'est PAS transporté

C'est l'inventaire de runes lu dans l'export de compte de l'auteur. Le partager
afficherait chez le destinataire **des runes qu'il ne possède pas**, sous ses
propres monstres.

Une prépa partage un **classement** — qui runer, en quel set, à quelle vitesse
viser — pas un inventaire. À l'import, le `gear` local de chaque monstre est donc
**préservé** : la prépa reçue dit quoi viser, elle ne prétend pas décrire les
runes de celui qui la reçoit.

### Format (`format: "sw-forge/prepa-rta"`, `version: 1`)

```json
{ "format": "sw-forge/prepa-rta", "version": 1, "exporte_le": "…",
  "nom": "", "auteur": "",
  "sections": ["swift", "violent", "other"],
  "monstres": [
    { "com2usId": 15214, "nom": "Trevor", "section": "swift", "vitesse": 120 }
  ],
  "categories": [
    { "label": "Striper", "color": "#4ad8d8", "membres": [15214] }
  ] }
```

Les catégories sont **omises si vides**. L'appartenance y est exprimée en
`com2usId`, comme les monstres.

### ⚠️ Un fichier d'un autre type est REFUSÉ, pas lu de travers

Un `format` différent est une **erreur bloquante**, pas un avertissement —
contrairement aux recommandations, où l'import ne fait qu'ajouter. Ici l'import
**remplace** : se tromper de fichier coûterait le classement en place.

### ⚠️ L'import REMPLACE (et le dit)

Il n'y a **qu'une** prépa RTA : deux classements ne peuvent pas coexister, donc
l'ajout n'a pas de sens ici. D'où une **confirmation**, qui énonce ce qu'on perd
— et qui **prévient quand aucun point de sauvegarde n'existe**, en invitant à en
poser un d'abord.

Conformément à la règle générale (voir [../README.md](../README.md)), le défaut
ne perd rien : « Annuler » est le bouton mis en avant, l'action porte la couleur
d'alerte.

### Corrections signalées à la lecture

| Cas | Traitement |
|-----|-----------|
| `com2usId` invalide | monstre ignoré |
| Même monstre deux fois | seule la première entrée est gardée |
| Section inconnue | rangé en « Non classé » plutôt que perdu |
| Vitesse négative / non numérique | laissée vide, le monstre est gardé |
| Section utilisée mais absente de `sections` | **recréée** — sinon le monstre serait invisible |
| Monstre absent des données chargées | non importé, et **remonté** dans le rapport |
| Catégorie sans libellé ou couleur invalide | ignorée |

« Autre » est garantie présente, comme partout ailleurs dans l'app.

Le **rapport de validation** reste affiché jusqu'à fermeture (il y a quelque
chose à lire) ; le message de succès, lui, est éphémère — même convention que
l'import de compte.
