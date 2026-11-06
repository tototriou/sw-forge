# Mes équipes (`#/compte/equipes`)

Un stockage durable d'équipes construites : chaque équipe garde ses monstres, leur
équipement complet (runes, artéfacts, relique), son leader et, s'il existe, son speed
tune. Les équipes se rangent par contenu, se retrouvent par les monstres qui les
composent, et font l'aller-retour avec l'Optimizer.

Le jeu limite le nombre de decks par contenu : cette page garde ce que le jeu ne garde
pas, une équipe construite, optimisée puis rangée pour plus tard.

Fichiers : `src/components/account/equipes/` (écran), `src/lib/equipesEnregistrees.ts`
(modèle pur, validation, comparaison au compte), `src/lib/equipesStore.ts` (IndexedDB),
`src/lib/equipesFichier.ts` (export et import de fichier),
`src/lib/importEquipesEnregistrees.ts` (conversions depuis et vers l'Optimizer),
`src/hooks/useEquipesEnregistrees.ts` (état, instancié dans `src/App.tsx`).

Voir aussi : [feat-import-equipes.md](../optimizer/feat-import-equipes.md) (le modèle
d'import de l'Optimizer, que l'export réutilise),
[persistance.md](../transverse/feat-import-compte/persistance.md) (l'interrupteur de
conservation).

## Place dans l'app

- 4ᵉ sous-section du dropdown « Mon compte », après « Artéfacts » : « Mes équipes »,
  route `#/compte/equipes`. Elle entre aussi dans la palette Ctrl K, sur l'accueil
  (carte « Mon compte ») et dans [../README.md](../README.md).
- **Lisible sans compte importé** : une équipe porte une copie de son équipement, elle
  s'affiche telle qu'enregistrée. Sans compte, la comparaison au compte (plus bas) et
  les imports qui lisent le compte sont désactivés, avec leur raison en `title`.
- Pendant la relecture du compte conservé (`accountHydrating`), les équipes
  s'affichent déjà ; seuls les marqueurs d'écart attendent le compte.

## Onglets

Une rangée `Onglets` (`src/ui/Onglets.tsx`), dans cet ordre :

| Clé | Libellé | Contenu de liste de l'Optimizer |
| --- | --- | --- |
| `rta` | « RTA » | `arene` |
| `arene-attaque` | « Arène — attaque » | `arene` |
| `arene-defense` | « Arène — défense » | `arene` |
| `siege-attaque` | « Siège — attaque » | `guilde` |
| `siege-defense` | « Siège — défense » | `guilde` |
| `guerre-guilde` | « Guerre de guilde » | `guilde` |
| `pve` | « PVE » | `donjon` |

Chaque libellé porte le nombre d'équipes de l'onglet. L'onglet ouvert et la recherche
se gardent pour la session, comme l'état des autres outils (`useStickyState`).

Une équipe appartient à un seul onglet ; « Déplacer vers… » la change d'onglet. Elle
compte **de 2 à 6 monstres** (décision de l'utilisateur), quel que soit l'onglet : le
jeu impose des tailles différentes selon le contenu (3 au siège, 4 en arène, 5 en
donjon, 6 en raid), et la page n'en refuse aucune dans cet intervalle. Une équipe de
0 ou 1 monstre n'est jamais enregistrée : illisible à la relecture (stockage,
fichier, session), elle va aux rejets ; « Nouvelle équipe » reste un brouillon tant
qu'elle n'a pas deux monstres ; le retrait du deuxième est refusé. Toute équipe
enregistrée s'exporte donc vers une équipe de l'Optimizer, qui en accepte 2 à 6.

## Ce qu'une équipe enregistre

`EquipeEnregistree` :

- `id` : chaîne unique, tirée à la création, jamais réutilisée ;
- `onglet` : une clé du tableau ci-dessus ;
- `nom` : texte non vide (« Équipe N » libre par défaut), trimé à la sortie du champ ;
- `note` : texte libre, vide par défaut ;
- `monstres` : 0 à 6 `MonstreEnregistre`, **dans l'ordre de l'équipe** ;
- `leader` : l'`uid` d'un monstre de `monstres`, ou `null` ;
- `speedTune` (facultatif) : la forme de `SpeedTuneEquipe`
  (`src/lib/speedTuneEquipe.ts`) entière — `plan` (`PlanSpeedTune`, ou `null` pour un
  plan perdu), et pour chaque ligne alliée son `uid` de ligne, son état `attache` et
  ses valeurs de `repli` —, à ceci près que le membre d'une ligne est désigné par
  l'`uid` d'un monstre de l'équipe au lieu d'un sélecteur de l'Optimizer. Un speed
  tune malformé à la relecture (plan illisible, lien vers un `uid` absent, champ mal
  typé) ne rejette jamais l'équipe : le plan illisible devient `null`, le lien
  invalide est retiré, et la carte le signale (« Speed tune incomplet ») ;
- `lienOptimizer` (facultatif) : `{ listId, equipeId, correspondance }`, la liste de
  l'Optimizer créée par le dernier export de cette équipe, l'équipe de cette liste
  (toujours désignée : un lien sans équipe est retiré à la relecture), et pour chaque
  membre exporté le couple `{ uid, selecteur }` (le monstre de l'équipe et son
  sélecteur dans la liste) ;
- `creeLe`, `modifieLe` : dates ISO.

`MonstreEnregistre` :

- `uid` : identifiant du monstre **dans l'équipe**, tiré à l'ajout, stable quand on
  réordonne. Le leader et les lignes du speed tune le désignent : réordonner ne
  change aucune désignation ; retirer un monstre remet `leader` à `null` s'il le
  désignait et retire ses liens de lignes (la ligne reste dans le plan, sans
  monstre, comme dans l'Optimizer) ;
- `com2usId` : l'espèce. Le `Monster` se re-résout à chaque lecture avec les données
  du jour, jamais figé dans l'enregistrement (même règle que le compte conservé) ;
- `unitId` : l'unité du jeu (`unit_id`) **quand la source la connaît** : un
  exemplaire de la Box, un membre Box de l'Optimizer, un deck d'arène. Les presets de
  siège ne la portent pas dans l'app : `unitId` vaut alors `null`, et aucune copie de la
  Box n'est choisie à sa place. Même règle pour un monstre ajouté sans exemplaire ;
- `provenance` : d'où vient l'équipement (`porte`, `siege-defense`,
  `siege-attaque`, `arene-defense`, `arene-attaque`, `optimizer`, `aucun`) ;
- `equipement` : un `GearSet` **copié** au moment de l'enregistrement — stats de base
  de l'unité, runes (`RuneDetail` complet, identifiant compris), artéfacts
  (`ArtifactDetail`), relique (`RelicDetail`). `null` pour un monstre sans équipement.

⚠️ **Une copie, pas une référence.** Le compte change (runes meulées, vendues,
déplacées) ; une équipe doit rester lisible, et dire ce qui a changé, même si plus
rien de son équipement n'existe. Les identifiants gardés servent à la comparaison,
jamais à relire l'équipement.

## Comparaison au compte

Avec un compte chargé, chaque pièce enregistrée est comparée, par son identifiant, à
l'inventaire actuel (`runes`, `artifacts`, `relics` du compte) :

| État | Règle |
| --- | --- |
| identique | la pièce existe, et tous ses champs sont égaux, sauf les exclusions ci-dessous |
| modifiée | la pièce existe, mais un champ comparé diffère |
| disparue | aucune pièce de cet identifiant dans l'inventaire |

L'égalité est champ à champ sur le type de la pièce (`RuneDetail`, `ArtifactDetail`,
`RelicDetail`), lignes d'effet comprises dans leur ordre, par une seule fonction pure
(`comparerPiece`) : un champ ajouté à ces types est comparé sans qu'on y pense. La
seule exclusion est le marqueur de rune posé en jeu (`marker`), qui n'est pas une
stat. Une pièce
d'identifiant non strictement positif (pièce synthétique) n'est jamais comparée :
elle est marquée « hors compte ».

Par monstre, une ligne dit en plus ce que porte son exemplaire :

| `unitId` | Équipement | Ligne |
| --- | --- | --- |
| connu, dans la Box | égal pièce à pièce à l'enregistré | « Équipé ainsi » |
| connu, dans la Box | différent | « Équipé autrement » |
| connu, absent de la Box | — | « Exemplaire absent du compte » |
| `null` | — | aucune ligne : l'exemplaire n'est pas connu |

Un monstre sans équipement enregistré n'a ni pièce ni ligne d'exemplaire.

⚠️ **La page affiche l'écart, elle ne corrige rien.** Aucune équipe n'est réécrite
parce que le compte a changé : seul un geste de l'utilisateur la modifie (mise à jour
depuis l'Optimizer, édition).

La carte d'une équipe résume l'état de pire gravité : rien quand tout est identique,
sinon « N pièces modifiées », « N pièces disparues ». Le détail marque chaque pièce.

## Écran

### Ordinateur

- En tête : la rangée d'onglets, puis une ligne d'actions : la recherche, « Nouvelle
  équipe », « Importer » (menu des sources), et, à droite, « Exporter le fichier » et
  « Importer un fichier ».
- Dessous, une grille de cartes (autant de colonnes que la largeur le permet, par
  requête de conteneur). Une carte : le nom, les avatars des monstres dans l'ordre
  (le leader marqué), la note sur une ligne tronquée, le résumé d'écart, et un menu
  d'actions (`Menu`) : « Ouvrir », « Exporter vers l'Optimizer », « Mettre à jour
  depuis l'Optimizer », « Dupliquer », « Déplacer vers… », « Supprimer ».
- Au-delà de 24 équipes dans l'onglet (après recherche), la grille se pagine
  (`Pager`), posé **au-dessus** de la grille : la hauteur d'une page varie avec ses
  cartes, et un pager placé dessous bougerait sous le clic.
- « Ouvrir » affiche le détail dans une modale large (`Modale`, croix en coin) : le
  nom et la note éditables, puis une fiche par monstre (l'équipement enregistré par
  `MonsterGear` : stats calculées, roue de runes, artéfacts, relique ; puis l'état de
  chaque pièce qui n'est pas identique), et la modification de la composition. Le
  détail est une consultation qu'on ferme ; l'écran partagé (`DeuxVolets`) reste
  celui de l'app, pas un second volet propre à la page.

### Téléphone

- La rangée d'onglets défile de côté. Sous elle, la recherche sur toute la largeur,
  puis « Nouvelle équipe ». Le bouton « Options » de la barre du haut (panneau
  d'actions, [panneau-actions-mobile.md](../transverse/feat-navigation/panneau-actions-mobile.md))
  regroupe les imports et les fichiers.
- Les équipes en une colonne de cartes, mêmes informations, même menu.
- « Ouvrir » ouvre le détail en `MobileSheet`, les fiches de monstre à la suite.
  Dans une fiche, le leader et la position passent sous le nom quand la place
  manque (requête de conteneur), pour ne pas tronquer le nom.

Aucune des deux mises en page n'est dérivée de l'autre : chacune a son agencement
et ses tests de rendu. Le banc d'affichage mesure la page (`compte-equipes` :
ouverture, sources d'import, équipe importée, détail) et l'Optimizer sur une liste
liée (`optimizer`, état `equipe-liee`).

## Recherche

- Un champ à suggestions de monstres (`useComboboxNav`), qui ajoute un monstre à la
  recherche sous forme de `Jeton` ; plusieurs jetons possibles.
- Une équipe est retenue si elle contient **tous** les monstres recherchés. Une
  collaboration et sa version SW (`jumeauCollab`) comptent pour la même espèce,
  comme dans la confrontation des recommandations.
- La recherche porte **sur l'onglet ouvert** seulement ; les jetons restent quand on
  change d'onglet, et le compte de chaque onglet reste le total de l'onglet.
- Le nom de l'équipe n'est pas cherché : la recherche est une recherche par monstre.
- Ordre des cartes : la dernière modifiée en premier.

## Créer et modifier

- « Nouvelle équipe » ouvre le détail d'un **brouillon** dans l'onglet ouvert (« L'équipe
  s'enregistre dès qu'elle a deux monstres. ») : rien n'est enregistré avant le
  deuxième monstre (`gesteSurBrouillon`), et fermer le détail avant l'abandonne.
- « Ajouter un monstre » : une recherche d'espèce, puis le choix de l'équipement
  parmi ce que le compte connaît de cette espèce, chaque choix nommé par sa
  provenance : « Équipement porté » (chaque exemplaire de la Box),
  « Défense de siège N », « Attaque de siège N », « Défense d'arène », « Attaque
  d'arène N », ou « Sans équipement ». Le choix copie l'équipement à cet instant.
- Réordonner par un sélecteur de position (« Position N », le même geste aux deux
  formats, sans glisser-déposer), désigner le leader, retirer un monstre. À deux
  monstres, la croix est désactivée, son infobulle dit « Une équipe garde au moins
  deux monstres. »
- « Reprendre l'équipement actuel » sur une fiche de monstre remplace sa copie par
  ce que son exemplaire porte aujourd'hui (provenance `porte`). Il n'existe que si
  `unitId` est connu et présent dans la Box.
- « Dupliquer » copie l'équipe dans le même onglet, nom suffixé, nouveaux `id` et
  `uid` ; le leader et les liens du speed tune suivent la correspondance ancien →
  nouveau `uid`, et les `uid` des lignes du plan restent. La copie n'a **pas** de
  `lienOptimizer` : deux équipes ne mettent jamais à jour la même liste.
- « Supprimer » une équipe passe par une confirmation (`Dialogs.tsx`), dont le défaut
  est « Annuler ».

## Imports

Le menu « Importer » liste ses sources avec la grammaire de l'import de l'Optimizer
(un en-tête par section, avatars, libellé court, source sans contenu désactivée avec
sa raison). Chaque choix crée **une nouvelle équipe** ; rien d'existant n'est
modifié.

| Source | Onglet de l'équipe créée | Équipement copié |
| --- | --- | --- |
| Une défense de siège | « Siège — défense » | le preset du deck |
| Une attaque de siège | « Siège — attaque » | le preset du deck |
| La défense d'arène (et celle d'arène de serveur) | « Arène — défense » | le preset de la défense, même vide ; sans preset pour l'unité, ce qu'elle porte |
| Une attaque d'arène | « Arène — attaque » | ce que portent les monstres à l'export |
| Une équipe de l'Optimizer | l'onglet ouvert | le build validé du membre, sinon son équipement affiché |

- Siège : depuis les équipes de siège de l'app (`SiegeTeam`, slot 0 = leader).
- Arène : les decks d'arène sont lus à l'import du compte (`parseArenaDecks` :
  `defense_deck_info`, `server_arena_defense_deck_info`, `deck_list` au `deck_type`
  1) et conservés avec le compte dans un champ facultatif, `arenaDecks`, sans
  changer de schéma. Un compte conservé avant ce champ n'a pas ses decks d'arène : la
  source est désactivée, « Réimporte ton compte pour lire tes decks d'arène ». Ces
  decks connaissent l'unité de chaque monstre : leurs monstres gardent leur
  `unitId`.
- RTA : la prépa RTA n'est pas une source, ni d'équipe ni d'équipement (décision de
  l'utilisateur) ; les équipes RTA se créent à la main ou depuis l'Optimizer.
- Optimizer : une équipe d'une liste (ses membres, son leader, son speed tune), une à
  la fois. **Jamais une liste entière** (décision de l'utilisateur) : une liste sans
  équipe n'est pas une source ; sans aucune équipe, la source est désactivée, « Aucune
  équipe dans l'Optimizer ». Une source dont un membre ne se résout plus dans le compte
  est désactivée, avec sa raison.
- Siège : le leader est le monstre du slot 0, et lui seul ; un slot 0 vide donne une
  équipe sans leader.
- Un deck de siège ou d'arène de moins de deux espèces connues est désactivé, « Moins
  de deux monstres connus. »
- Guerre de guilde et PVE n'ont pas de source dans l'export de compte : leurs équipes
  se créent à la main ou depuis l'Optimizer.

Un rapport (modale) suit chaque import : l'équipe créée, les monstres ignorés et leur
raison (espèce inconnue, slot vide sans monstre).

## Aller-retour avec l'Optimizer

### Exporter vers l'Optimizer

« Exporter vers l'Optimizer » crée une **nouvelle liste** par l'action commune
`importerEquipe` (voir [feat-import-equipes.md](../optimizer/feat-import-equipes.md)),
avec un producteur dédié, `preparerExportEquipeOptimizer` (`src/lib/importEquipesEnregistrees.ts`) :

- nom de liste : le nom de l'équipe ; contenu : celui de l'onglet (tableau plus haut) ;
- membres, dans l'ordre de l'équipe : un monstre dont l'`unitId` est dans la Box
  prend le sélecteur Box de cette unité ; sinon le sélecteur `unowned` de son espèce,
  avec une `copie` distincte par occurrence (deux occurrences d'une espèce restent
  deux membres), et le rapport le dit. Deux monstres de la même unité Box : le
  second est ignoré avec sa raison (un exemplaire ne figure qu'une fois dans une
  liste) ;
- équipe : créée si 2 à 6 membres restent (règle de l'Optimizer) ; leader et lead du
  monstre leader ; speed tune reporté sur les membres de ses lignes. Si un doublon
  d'unité laisse moins de deux membres, la liste n'a pas d'équipe et aucun lien
  n'est posé ;
- **point de départ** : un build validé par membre, dans l'ordre de l'équipe, quand
  son équipement enregistré compte 6 runes d'identifiant strictement positif,
  distinctes, une par emplacement de 1 à 6. Les artéfacts repris sont ceux de la
  copie, au plus un par sorte (attribut, type) ; une copie qui en porte deux d'une
  même sorte ne reprend aucun artéfact, et le rapport le dit. La paire vient d'un
  équipement du jeu, où elle était valide : aucun autre contrôle d'éligibilité
  n'est fait. Les identifiants
  d'artéfacts et de relique non positifs ne sont pas repris. Une pièce
  disparue va dans `runesManquantes` / `artefactsManquants`. Une pièce modifiée est
  validée sous son identifiant, et le rapport la nomme, puisque l'Optimizer lira sa
  version actuelle. Si une rune ou un artéfact présent est déjà réservé par un membre
  précédent de la même liste (deux presets qui partagent une pièce), le membre n'a
  pas de build validé, et le rapport nomme les deux monstres. Un membre sans
  6 runes n'a pas de build validé.

⚠️ **C'est la seule entrée dont le consommateur pose des builds validés.** Le
consommateur commun (`consommerImportOptimizer`) reçoit pour cela un champ facultatif
de l'import, `buildsAValider`, que les autres producteurs laissent absent ; il les
pose après l'ajout des membres, avec les contrôles de réservation de la validation
manuelle. [feat-import-equipes.md](../optimizer/feat-import-equipes.md) borne son
« aucun build n'est validé par l'import » à ce seul cas, dans le même commit.

Après acceptation, l'équipe enregistre `lienOptimizer = { listId, equipeId, correspondance }` et
l'Optimizer s'ouvre, comme pour les autres exports. Le lien est stocké avec l'équipe
enregistrée, jamais dans le stockage des listes de l'Optimizer, qui ne change pas de
format.

### Mettre à jour depuis l'Optimizer

Une équipe dont la liste liée existe encore propose « Mettre à jour depuis
l'Optimizer ». Dans l'Optimizer, **chaque équipe d'une liste** porte « Enregistrer
dans Mes équipes » dans sa fenêtre « Modifier l'équipe » (le brouillon de la fenêtre
est appliqué d'abord ; l'en-tête de la bande n'a pas la place d'un geste de plus au
téléphone). **L'enregistrement se fait équipe par équipe,
jamais pour une liste entière** (décision de l'utilisateur). Le geste ouvre « Mes
équipes » et, après sa relecture :

- une équipe enregistrée suit déjà cette équipe de l'Optimizer (`equipeLieeA` :
  même `listId`, même `equipeId`) : la même confirmation que « Mettre à jour depuis
  l'Optimizer », sur l'onglet de l'équipe ;
- sinon : « Enregistrer dans Mes équipes », une confirmation qui crée une **nouvelle**
  équipe (`creerDepuisEquipeOptimizer`), nommée « liste — équipe N », avec un
  sélecteur d'onglet (l'onglet ouvert par défaut : le contenu d'une liste de
  l'Optimizer ne désigne pas un onglet) et les pièces introuvables nommées. L'équipe
  créée est **liée** : l'enregistrer à nouveau la met à jour au lieu d'en créer une
  autre. L'import « Optimizer » de Mes équipes, lui, crée une copie sans lien, pour
  qu'une équipe de l'Optimizer n'ait qu'une équipe enregistrée qui la suive.

**La source est fixée par le lien** :

- `equipeId` désigne une équipe qui existe encore dans la liste : ses membres, dans
  leur ordre, son leader et son speed tune.

Un membre repris retrouve son monstre enregistré par la
`correspondance` du lien (clé `exclusionSelectorKey` du sélecteur) et garde son
`uid` ; un membre sans correspondance (ajouté dans l'Optimizer, ou dont la
revérification du compte a changé le sélecteur) devient un nouveau monstre. Un
monstre enregistré sans membre repris est retiré, avec son leader et ses liens de
lignes ; la confirmation le nomme.

- `equipeId` désigne une équipe disparue : l'action est désactivée, « L'équipe de
  l'Optimizer n'existe plus », et rien n'est deviné.

⚠️ **Un membre qui ne se résout
pas** (compte pas encore relu, exemplaire disparu) refuse toute la mise à jour : le
reprendre comme absent retirerait son monstre de l'équipe. Sans compte chargé,
l'action est désactivée (« Importe ton compte pour mettre à jour depuis l'Optimizer »).
L'équipe de l'Optimizer compte 2 à 6 membres : la mise à jour ne vide jamais une
équipe enregistrée.

L'équipement de chaque monstre se reconstruit pièce par pièce :

- avec un build validé, ses identifiants de runes (`runeIds` et `runesManquantes`),
  d'artéfacts (`artifactIds` et `artefactsManquants`) et de relique ; sans build
  validé, l'équipement affiché de l'exemplaire (provenance `optimizer` dans les deux
  cas) ;
- chaque identifiant se relit dans l'inventaire actuel ; absent de l'inventaire, la
  copie de la pièce de **même type et même identifiant** est cherchée dans tout
  l'équipement enregistré de l'équipe (une pièce a pu passer d'un monstre à
  l'autre). Plusieurs copies de cet identifiant au contenu différent : celle du même
  monstre d'abord, sinon la première dans l'ordre de l'équipe, et la confirmation
  nomme ce choix ; absente des deux, la pièce **manque** ;
- un build validé sans `artifactIds` (validé avant ce champ) garde les artéfacts
  enregistrés, et la confirmation dit « artéfacts gardés » ; un build validé sans
  `reliqueId` garde la relique enregistrée,
  jamais la relique portée. La confirmation dit « relique gardée » : l'Optimizer ne
  distingue pas un retrait volontaire de la relique d'un build validé sans relique,
  et le retrait se refait à la main dans le détail (« Retirer la relique ») ;
- les stats de base sont celles de l'exemplaire actuel s'il est dans la Box, sinon
  celles de la copie enregistrée du monstre, sinon celles de l'espèce (6★ niveau
  max, comme un monstre non possédé de l'Optimizer).

Une confirmation (`Dialogs.tsx`) précède l'écriture, qui remplace l'équipe. Elle
nomme le nombre de monstres et de pièces qui changent (les pièces d'un monstre retiré
comprises), et **chaque pièce manquante**
avec son monstre ; son défaut est « Annuler ». Nom, note, onglet et `creeLe`
restent ; `modifieLe` change. La `correspondance` du lien est réécrite avec les
membres repris, nouveaux compris, pour que le retour suivant les retrouve.

Une liste liée supprimée de l'Optimizer désactive l'action (« La liste de l'Optimizer
n'existe plus ») ; le lien reste, inoffensif. Exporter de nouveau remplace le lien
par la nouvelle liste.

## Conservation

- Les équipes vivent en **IndexedDB**, dans une base à elles,
  `swblacksmith-equipes` : un store `equipes` (une entrée par équipe, clé = `id`). La base du compte (`swblacksmith`) n'est pas touchée et garde sa
  version. Raison de l'IndexedDB : des centaines d'équipes à six monstres équipés
  pèsent plusieurs mégaoctets, hors de portée de `localStorage`.
- **Sous l'interrupteur unique de conservation** (`usePersistence`) : écrites
  seulement si l'utilisateur l'a accepté ; sans accord, elles vivent en mémoire pour
  la session.
- **État « jamais demandé »** : la première équipe créée ou importée pose la question
  de conservation (`KeepAccountDialog`), comme le premier import de compte. Fermer
  sans répondre n'enregistre rien. Une fois la question tranchée, créer une équipe
  ne la repose pas : elle revient à l'import de compte, comme aujourd'hui.
- **Activer la conservation** écrit tout de suite les équipes déjà en mémoire.
  **Refuser alors qu'on conservait**, et « Tout supprimer », effacent aussi les
  équipes, avec les confirmations existantes ; l'effacement est attendu avant le
  rechargement de « Tout supprimer ».
- **Relecture au démarrage et gestes** : les équipes conservées se relisent au
  démarrage. Un geste fait avant la fin de la relecture (créer, importer, modifier,
  supprimer) s'applique **par-dessus** les équipes relues, jamais à leur place : la
  relecture fusionne par `id`, l'état en mémoire gagne pour une même équipe, et une
  équipe supprimée pendant la relecture ne revient pas.
- Toutes les écritures passent par une file sérielle, comme le compte : la dernière
  action gagne, et une suppression n'est jamais ressuscitée par une écriture en
  retard.
- Une entrée illisible à la relecture est écartée de l'écran et signalée une fois par
  une notification ; elle reste telle quelle dans la base, jamais réécrite ni
  supprimée par la relecture (seuls « Tout supprimer » et le refus de conservation
  l'effacent).
- Erreur de stockage (navigation privée, quota) : repli en mémoire, comme le compte,
  sans exception.

### Fichier

- « Exporter le fichier » télécharge toutes les équipes, tous onglets confondus :
  `{ "format": "swblacksmith/equipes", "version": 1, "exporteLe": …, "equipes": [...] }`
  (`formatExport`, `src/lib/formatsExport.ts`).
- « Importer un fichier » est désactivé tant que les équipes conservées se relisent
  (« Lecture des équipes enregistrées… ») : les collisions d'`id` se résolvent contre
  l'ensemble complet.
- « Importer un fichier » **ajoute** les équipes du fichier, jamais ne remplace : une
  équipe dont l'`id` existe déjà reçoit un nouvel `id`, et le rapport dit combien. Les
  clés des entrées illisibles de la base comptent comme prises : un import ne les
  écrase jamais. Les collisions se résolvent contre l'état courant au moment de
  l'ajout, deux fichiers lus en même temps ne se donnent pas le même `id`. Un speed
  tune abîmé dans le fichier est signalé sur la carte (« Speed tune incomplet »).
  Les `lienOptimizer` importés sont retirés (ils désignent les listes d'un autre
  navigateur). Une équipe invalide est ignorée avec sa raison ; un fichier d'un autre
  format est refusé entier.
- L'application de bureau ajoute les équipes à la session sauvegardée, comme le reste
  du travail ([feat-sauvegarde-session.md](../transverse/feat-sauvegarde-session.md)).

## Hors périmètre

- Partager une équipe avec un autre joueur (lien ou fichier d'une seule équipe).
- Lire les decks de guerre de guilde et de donjon dans l'export de compte.
- Corriger automatiquement une équipe dont les pièces ont changé.
