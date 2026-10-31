# Siège (`#/siege/defense`, `#/siege/offense`, `#/siege/recommandations`)

Composer des équipes de **3 monstres** de combat de guilde, avec lead de vitesse
**automatique** et vérification des **speed tune** (ticks). La page est découpée en
**trois sous-onglets** : **Défense**, **Offense** et **Recommandations**.

Fichiers :
- [SiegePage.tsx](src/pages/SiegePage.tsx) — shell : titre + sous-onglets, choisit
  l'onglet selon la route (`#/siege/defense` par défaut, `#/siege/offense`,
  `#/siege/recommandations`). Type `SiegeTab = 'defense' | 'offense' | 'recos'`
  (distinct de `SiegeSide`, qui ne pilote que le stockage des deux côtés jouables).
- [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx) — le board réutilisable,
  paramétré par `side` ('defense' | 'offense'). Monté avec `key={side}` pour
  réinitialiser au changement d'onglet.
- État : [useSiegeState.ts](src/hooks/useSiegeState.ts) — **une liste d'équipes
  par côté**, `localStorage` `swblacksmith-siege-defense-v1` / `swblacksmith-siege-offense-v1`
  (une clé unique `swblacksmith-siege-v1`, si elle existe, est reprise comme défense).

Les deux côtés **jouables** (défense/offense) partagent **exactement la même
mécanique** (composition, lead auto, ticks) — voir [feat-equipes.md](feat-equipes.md) et
[feat-speed-tick.md](feat-speed-tick.md). Seules diffèrent les données d'import (voir
ci-dessous). L'onglet **Recommandations** a son propre modèle et sa propre
persistance : voir [feat-recommandations/](feat-recommandations/README.md).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `src/pages/SiegePage.tsx`, `src/components/siege/SiegeBoard.tsx`, `src/components/siege/ChoixExportSiege.tsx`, `src/hooks/useSiegeState.ts`, `src/lib/siegeShare.ts`, `src/lib/equipementPartage.ts` | ce README |
| `src/components/siege/SiegeTeam.tsx`, `src/components/siege/LeadPill.tsx`, `src/components/siege/slotVideSuivant.ts`, `src/components/MonsterPicker.tsx` | [feat-equipes.md](feat-equipes.md) |
| la vitesse d'une équipe, les ticks, `src/components/siege/pastilleStatut.ts`, `src/lib/siegeStatut.ts`, `src/components/outils/SpeedTuneModale.tsx` | [feat-speed-tick.md](feat-speed-tick.md), [../transverse/feat-calcul-vitesse.md](../transverse/feat-calcul-vitesse.md) |
| `src/components/siege/RecoBoard.tsx`, `src/components/siege/RecoCard.tsx`, `src/components/siege/ChoixFusionRecos.tsx`, `src/hooks/useSiegeRecos.ts`, les `reco…` de `src/lib/`, `src/lib/ownedBuilds.ts` | [feat-recommandations/](feat-recommandations/README.md) |

## Vue d'ensemble

1. **En-tête BUREAU** : titre « Défense » / « Offense », compteur
   d'équipes, puis les actions via `BarreActions` : **toutes en boutons quand
   elles tiennent sur la ligne** (place mesurée), sinon **Vérifier mes speed**
   et **Ajouter une équipe** visibles, et **Créer un monstre**, **Tout
   effacer** (séparé, en `bad`) dans le menu « ⋯ » Plus d'actions.
   - « Vérifier mes speed » vient en premier : c'est pour vérifier ses équipes
     qu'on vient ici, on n'en ajoute qu'une de temps en temps. Bouton à deux
     états : fond d'accent doux quand il est allumé (`aria-pressed`).
   - ⚠️ **Aucune action mise en avant** : pas d'aplat d'accent dans l'en-tête.
   - « Créer un monstre » est **en dernier des actions** : c'est le geste le plus
     rare.
   - Tous les boutons d'en-tête font **36 px** (`HAUTEUR_EN_TETE`).
2. **Sous-onglets** : Défense / Offense — dans la barre latérale (bureau) et
   le panneau de navigation (téléphone), pas dans la page.
3. **Téléphone** : le compteur et l'**interrupteur « Vérifier mes speed »**
   dans la page ; les autres actions dans le panneau « Options » (Ajouter une
   équipe, Exporter, Importer, Créer un monstre, puis Tout effacer séparé).
   ⚠️ L'interrupteur est dans la page, pas dans le panneau : c'est un AFFICHAGE
   qu'on allume et éteint en parcourant ses équipes, pas une action rare. Même
   état que le bouton du bureau, désactivé sans équipe, infobulle selon l'état.
   Les équipes gardent leurs trois monstres côte à côte.
4. **Recherche d'équipe** (champ sous l'en-tête) — voir ci-dessous.
5. **Liste d'équipes** (ou état vide incitant à ajouter/importer).

### Recherche d'équipe par monstre

- Un champ **« Nom du monstre… »** sous l'en-tête, aux deux formats, avec
  **une liste de suggestions sous le champ**, comme les autres recherches de
  monstre de l'app (RTA, Recommandations — `MonsterPicker`) : on tape, on
  **choisit** un monstre, et seules les équipes qui le contiennent restent
  affichées.
- ⚠️ **Les suggestions ne proposent que les monstres PRÉSENTS dans les équipes
  de ce côté** : un autre monstre ne trouverait aucune équipe.
- Le monstre choisi devient un **jeton** (portrait + nom) ; sa croix retire le
  filtre (« Vider la recherche »). Filtré, le compteur le dit : « 2 équipes
  sur 8 ». Aucune équipe trouvée → un message, et « Effacer la recherche ».
- La comparaison des noms (`rechercheEquipe.ts`) reste insensible aux accents
  et à la casse.
- ⚠️ **Le filtre n'est PAS enregistré** : il ne vit que le temps de l'écran.
  Revenir sur la page montre toutes ses équipes — un filtre oublié ferait
  croire à des équipes disparues.
- ⚠️ Le filtre ne change **pas la numérotation** : « Équipe 5 » reste
  « Équipe 5 » même affichée seule. C'est son identité dans la liste.

### Exporter et importer des équipes

Logique : [siegeShare.ts](src/lib/siegeShare.ts), testée par
[tests/siege-partage.test.ts](tests/siege-partage.test.ts). 100 % local.

- **« Exporter »** télécharge les équipes **affichées** — toutes, ou celles
  du filtre actif : l'infobulle le dit — dans un fichier
  `swblacksmith-siege-<defense|offense>-AAAA-MM-JJ.json`, daté du jour
  **local** (`jourLocal`, pas le jour UTC).
- ⚠️ **« Exporter » demande d'abord si l'on joint les runes**
  ([ChoixExportSiege.tsx](src/components/siege/ChoixExportSiege.tsx)), comme
  l'export de la prépa RTA : « Avec les runes et les artéfacts » (le nombre
  de monstres concernés ; désactivé si aucun ne porte de runes connues) ou
  « Composition et vitesses ». Partager ses runes, c'est montrer ce qu'on
  possède : la question se pose à voix haute, au moment d'exporter. La
  croix ferme sans rien télécharger.
- Format `swblacksmith/siege-equipes` (un fichier `sw-forge/siege-equipes`
  est relu aussi), version 1, clés en français :
  `{ format, version, cote, equipes: [{ monstres: [{ com2usId, nom,
  vitesseRunes, tick, sets, equipement? }] × 3 }] }`. Le **slot 0 est le
  leader**, comme dans l'app.
  - ⚠️ **Le `com2usId`, jamais l'id local** : c'est le seul identifiant qui
    vaille d'un joueur à l'autre (même règle que les recommandations et la
    prépa RTA). Le nom accompagne, pour qu'un fichier se lise.
  - `equipement` : runes, artéfacts, relique et stats de base du monstre,
    **seulement si l'auteur a choisi de les joindre** — même clé que la
    prépa RTA. Un champ en plus, que la version 1 ignore : le format ne
    change pas de version. Une équipe reçue avec ses runes se réexporte avec
    elles.
  - Un monstre **perso** (sans `com2usId`) ne part pas : son emplacement
    part vide, et le message d'export le dit.
- **« Importer »** lit un tel fichier et **AJOUTE** ses équipes à la fin des
  siennes — rien n'est remplacé ni effacé (« Tout effacer » existe pour qui
  veut repartir de zéro). Un monstre absent des données chargées laisse son
  emplacement vide, et le rapport le dit. Un fichier de l'autre côté (une
  défense importée dans l'offense) est accepté : c'est une composition, elle
  se joue des deux côtés — le message le signale.
- **Les runes reçues se consultent** : un clic sur le monstre d'une équipe
  importée ouvre son détail (roue, artéfacts, relique), précédé de
  « Équipement de l'auteur du fichier ». Elles comptent aussi pour le speed
  tune (l'artéfact « Effet aug. VIT »).
  - ⚠️ **Elles vont dans `gearPartage`, JAMAIS dans `gear`.** `gear` est
    l'équipement du JOUEUR : les builds possédés des recommandations
    ([ownedBuilds.ts](src/lib/ownedBuilds.ts)), les exclusions de
    l'Optimizer et l'alerte d'équipement incomplet le lisent comme tel. Les
    runes d'un ami y feraient croire qu'on possède ses monstres et ses
    builds.
  - Changer le monstre d'un emplacement efface l'équipement reçu : il
    décrivait le monstre de l'auteur.
  - Un équipement illisible est ignoré, pas le fichier ; une relique sans
    identifiant est ignorée, et le message le dit. La lecture est celle de la
    prépa RTA ([equipementPartage.ts](src/lib/equipementPartage.ts)).
- Validation : un fichier qui n'est pas au format est **refusé** avec la
  raison, rien n'est touché. Une version absente ou qui n'est pas un nombre
  est un fichier abîmé (« version illisible »), distinct d'une version plus
  récente que l'app.
- Où : dans les actions de l'en-tête (`BarreActions` : en boutons s'il y a la
  place, sinon dans « ⋯ ») et dans le panneau « Options » au doigt.

### Disposition de la liste — autant d'équipes par ligne que la place en permet

- ⚠️ **Des colonnes d'au moins 480 px, en nombre suivant la largeur RÉELLE**
  (`repeat(auto-fill, minmax(min(100%, 480px), 1fr))`). 480 px, c'est
  la largeur où les trois monstres d'une équipe tiennent côte à côte, nom et
  vitesse lisibles. Barre latérale comprise, cela donne 1 colonne sur un écran
  de 1024 px, 2 sur 1280, 3 sur 1920.
- **La carte est resserrée à la souris** : rembourrage 12 px (16 au doigt,
  `compact:`), en-tête à 8 px de la rangée, titre en `text-base`, pied calé
  dessus.
- **Une équipe en cours d'édition reprend toute la ligne** (`col-span-full`) :
  les 3 slots détaillés (picker, SPD, ticks, position) seraient trop à
  l'étroit dans une colonne.
- Pour ça, l'état « équipe dépliée » est **remonté dans
  [SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx)** (`expandedIds`, un
  `Set`) et passé en prop ; **plusieurs équipes peuvent rester dépliées** en même
  temps.
- `items-start` : une équipe dépliée n'étire pas la carte compacte d'à côté.

### Ajouter une équipe → scroll automatique

Cliquer **Ajouter une équipe** ajoute l'équipe **en fin de liste** et **scrolle
automatiquement** jusqu'à elle (`scrollIntoView`, `behavior: 'smooth'`,
`block: 'center'`) — indispensable avec ~50 équipes importées, sinon la nouvelle
équipe naît hors écran. Implémenté dans
[SiegeBoard.tsx](src/components/siege/SiegeBoard.tsx) : la **dernière** équipe
rendue porte une `ref`, et un flag `scrollToLast` déclenche le scroll au rendu
suivant.

**Au bureau, une carte en pointillés « Ajouter une équipe » termine la
grille**, en plus du bouton de l'en-tête. Le téléphone n'en a pas : il ajoute
depuis « Options ».
- ⚠️ **Elle est la place de la nouvelle équipe** : l'équipe naît exactement là
  où l'on a cliqué, la carte passe à la case suivante. Donc **aucun
  défilement** — contrairement au bouton d'en-tête, dont l'équipe naît hors de
  vue.
- Même hauteur qu'une équipe à côté d'elle (`self-stretch`), celle d'une carte
  repliée seule sur sa ligne.
- **Désactivée pendant une recherche**, avec la raison en infobulle : une
  équipe vide n'y apparaîtrait pas, alors que la carte promet de la montrer
  là. Ni l'état vide ni « aucune équipe trouvée » ne l'affichent : ils n'ont
  pas de grille.

### ⚠️ Supprimer une équipe demande confirmation

Le bouton **Supprimer** est juste à côté d'**Éditer**, qu'on utilise sans arrêt,
et rien ne permet de revenir en arrière : ni annulation, ni corbeille. Trois
monstres et leurs vitesses saisies partent avec l'équipe.

La modale **nomme les monstres concernés** — « Supprimer l'équipe 3 ? » ne dit
rien, « Chilling, Susano, Tarq » si — et rappelle que les autres équipes ne sont
pas touchées. Voir la convention des modales dans le [README](README.md).

Même règle pour les **decks de recommandation** et les recommandations
elles-mêmes (voir [feat-recommandations/](feat-recommandations/README.md)).

### Bouton « Vérifier mes speed »

Interrupteur de la barre d'actions (icône jauge) qui **colore le statut** des
équipes (vert / orange / rouge, voir [feat-speed-tick.md](feat-speed-tick.md)) — ⚠️ par le
**contour et la pastille** de l'en-tête, jamais par le fond de la card.

⚠️ **« mes speed », pas « mes tick ATB ».** Le bouton couvre les DEUX questions :
une équipe **Swift** se juge sur son **speed tune**, les autres sur leur
**tick**. « Mes tick ATB » n'en nommerait qu'une — et pas celle qui compte pour
les équipes speed. L'infobulle dit les deux.

- **Désactivé par défaut** : les équipes sont affichées **telles quelles**, en
  neutre — contour neutre, aucun point de statut, aucun anneau rouge sur les slots,
  aucun message, donc aucune des deux actions (« Valider le speed tune » / « Valider
  le tick », « Voir le speed tune »).
- ⚠️ **Une fois allumé, TOUT est automatique** : statut, message nommant les
  monstres fautifs, et **l'ordre de tours d'une équipe Swift** (voir
  [feat-speed-tick.md](feat-speed-tick.md)). Le bouton dit **quand on veut voir**, il ne
  demande jamais de refaire un calcul soi-même.
- **Par côté** (défense / offense indépendants) et **non persisté sur disque** :
  `useStickyState` — l'état survit à la navigation, se remet à `false` au reload.
- Le bouton n'apparaît que s'il y a **au moins une équipe**.
- Les **boutons de tick** de chaque monstre restent disponibles dans les deux
  cas : c'est un réglage, pas un affichage de statut.

L'**import est global** (bouton « Importer mon compte » dans la barre de nav) :
il remplit défense **et** offense **et** RTA d'un coup — pas de bouton d'import
par côté. Rappel « données locales » + suppression : footer global.

Nombre d'équipes **illimité** par côté (l'import offense peut créer ~50 équipes
d'attaque sauvegardées).

## Sous-sections (specs détaillées)

| Sous-section | Spec |
|--------------|------|
| Composition d'équipe, slots, leader, drag & drop | [feat-equipes.md](feat-equipes.md) |
| Vitesse de combat, lead auto, ticks & retour manque/surplus | [feat-speed-tick.md](feat-speed-tick.md) |
| Recommandations : lots de decks (création, partage, confrontation à la box) | [feat-recommandations/](feat-recommandations/README.md) |

## Modèle d'état

```ts
interface SiegeSlot {
  monsterId: string | null; runeSpeed: number | null; tick: number; sets?: string[];
  gear?: GearSet;        // mon équipement, venu de l'import du compte
  gearPartage?: GearSet; // celui de l'auteur d'un fichier d'équipes — affichage seulement
}
interface SiegeTeam { id: string; slots: SiegeSlot[]; lead: number; tickAlertDismissed: boolean }
interface SiegeState { teams: SiegeTeam[] }
```

- Chaque équipe a **toujours 3 slots** ; **le slot 0 est le leader**.
- `slot.tick` : vitesse de combat cible **par monstre** (0 = aucun tick actif) →
  ticks mixables au sein d'une équipe (ex. 2 rapides + 1 lent).
- `lead` : champ présent dans le modèle mais **le lead effectif est déduit
  automatiquement du leader** (voir [feat-speed-tick.md](feat-speed-tick.md)) ; le lead
  manuel n'est pas exposé dans l'UI actuelle.

## Persistance & robustesse

- Sauvegarde `localStorage` à chaque changement.
- Au chargement, chaque équipe est normalisée à exactement 3 slots, types validés,
  `id` régénéré si manquant.

## Import depuis le compte (global)

L'import est **unique et global** (bouton de la barre de nav). Il crée les
équipes des **deux** côtés en une fois :

- **Défense** : `guildsiege_defense_deck_unit_list`.
- **Offense** : équipes d'attaque sauvegardées (`deck_list`, `deck_type = 22`).

Chaque deck → une équipe (leader en slot 0, SPD runes de siège incluses). Détail
complet dans [../transverse/](../transverse/).

## Règles clés

- **Lead automatique** : porté par le leader (slot 0), appliqué par monstre selon
  les règles de siège (voir [../transverse/](../transverse/)).
- **Vitesse de combat mise en avant** (gros chiffre) sur chaque slot rempli.
- Les boutons de tick servent à **informer** l'utilisateur : combien il **manque**
  ou est **en trop** pour atteindre le tick — ils ne modifient pas la vitesse.
- Réutilisable au tactile : chaque slot a un **sélecteur de position** (repli du
  drag & drop).
