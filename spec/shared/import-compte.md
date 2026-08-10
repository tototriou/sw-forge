# Import d'un compte SWEX (transverse — RTA & Siège)

Extraire des données d'un export de compte Summoners War (format SWEX). **100 %
côté navigateur** — aucun fichier n'est envoyé. Un **seul import global** remplit
**tout** d'un coup, via trois parseurs :

- **Box RTA** → prépa RTA (`parseAccountJson`).
- **Défenses de siège** → équipes de défense (`parseSiegeDefense`).
- **Offense de siège** → équipes d'attaque sauvegardées (`parseSiegeOffense`).
- **Box 6★** → page « Mon compte » (`parseAccountBox`).
- **Inventaire runes/artéfacts** → page « Mon compte » (`parseAccountInventory`).

Fichiers : [importAccount.ts](src/lib/importAccount.ts) (parseurs) ·
[applyAccount.ts](src/lib/applyAccount.ts) (mapping monstres + vitesses) ·
[AccountImportControl.tsx](src/components/AccountImportControl.tsx) (bouton nav) ·
[App.tsx](src/App.tsx) (orchestration `importAccount`).

## Un seul bouton d'import invariant (barre de nav)

Le bouton **« Importer mon compte »** vit dans la barre de navigation (desktop à
droite des onglets ; mobile dans le menu). Il est **toujours identique** : chaque
clic ouvre le sélecteur de fichier ; le fichier choisi **remplace le précédent**
et est appliqué. Un import :

1. **traite la page courante** (affichage immédiat), et
2. **remplit les autres en arrière-plan** — RTA, défense **et** offense sont
   alimentées en une fois.

Pour rendre ça possible, les états sont **remontés dans [App.tsx](src/App.tsx)**
(`useRtaState`, `useSiegeState('defense')`, `useSiegeState('offense')`), et
`importAccount(text)` applique les trois. Le fichier n'est **pas mémorisé** : pas
besoin, un import couvre déjà toutes les pages. Rien n'est persisté sur le disque.

À côté du bouton : un lien **« Supprimer mes données »** (efface prépa RTA,
équipes de siège, monstres perso puis recharge).

**Une seule confirmation**, si des données existent déjà (RTA/défense/offense) :
**« L'import va remplacer toutes les données présentes. Es-tu sûr ? »** Un import
**remplace** toujours la prépa RTA, les équipes de siège et la box.

⚠️ Elle est posée **avant** l'écran d'attente : une boîte native par-dessus un
spinner donne l'impression que le traitement a planté.

> ⚠️ **Ne jamais proposer de « fusionner » ici.** L'ancien dialogue disait
> « OK = remplacer · Annuler = fusionner » : celui qui voulait **annuler** son
> import cliquait Annuler… et **dédoublait tout son siège** (50 attaques → 100).
> Un export de compte est un **instantané du jeu**, il ne se cumule pas avec le
> précédent. Le chemin « ajouter à la suite » a été **retiré de `importTeams`**
> pour qu'il ne puisse pas être rebranché. Voir aussi la règle générale dans
> [siege/recommandations.md](../siege/recommandations.md).

Message global récapitulatif **éphémère** (disparaît seul ~5 s ; ~9 s pour une
erreur) : « Import : N monstres 6★ · N monstres RTA · N défenses · N attaques ».

Helpers partagés par les deux parseurs : `runeSpeed` (SPD d'une rune : mainstat +
prefix + substats avec meule), `indexRunes` (index rune_id → rune, inventaire +
runes des unités), `indexUnits` (unit_id → unité), `speedFromRuneIds` (SPD plate
cumulée + set Swift complet pour un lot de rune_id).

### ⚠️ Un seul `JSON.parse` par import

Un import enchaîne **cinq** extracteurs sur le même fichier. Chacun recevait le
texte brut et le reparsait : cinq `JSON.parse` d'un export de 8 Mo. Ils acceptent
donc aussi l'**objet déjà parsé** (`AccountSource = string | objet`) ;
[App.tsx](src/App.tsx) parse une fois via `parseAccountSource` et passe le
résultat aux cinq. Le texte reste accepté pour les appels isolés — la
comparaison de comptes ([compte/runes.md](../compte/runes.md)) n'appelle qu'un
extracteur.

Les trois index sont **mémoïsés** sur l'objet parsé (`WeakMap`, donc libérés
avec lui) : ils étaient reconstruits jusqu'à quatre fois sur des milliers
d'entrées. Mesure sur un export réel de 7,8 Mo : **87 ms → 22 ms**.

> ⚠️ **Un index mémoïsé est PARTAGÉ, donc en lecture seule** — d'où le type
> `ReadonlyMap` en sortie. Avant, chaque extracteur avait sa copie ; un `.set()`
> en corromprait maintenant quatre autres, et le symptôme apparaîtrait dans un
> extracteur voisin, loin de la faute. Un extracteur qui a besoin d'un index à
> lui écrit `new Map(index)`.

## Objectif métier

Récupérer **les monstres « utilisés souvent » (favoris RTA)** avec **la vitesse
de leurs runes RTA** — et **pas** toute la box classique.

Points clés découverts (à ne pas régresser) :
- En RTA, chaque monstre a **son propre preset de runes**, stocké **à part** dans
  `world_arena_rune_equip_list` (et **non** dans `unit_list[].runes`).
- Les favoris (« utilisés souvent ») sont mémorisés par le jeu ; il faut cibler
  **ces monstres-là**, pas tous ceux qui ont une rune.

## Algorithme

1. **Parse JSON** ; exige un `unit_list` (sinon erreur « export SWEX attendu »).
2. **Index des runes** par `rune_id` : inventaire (`data.runes`) **+** runes
   équipées dans chaque unité. Un preset RTA peut réutiliser n'importe laquelle.
3. **Index des unités** par `unit_id`.
4. **Runes RTA par monstre** : via `world_arena_rune_equip_list`, on regroupe par
   `occupied_id` (= `unit_id` équipé en RTA). `findRtaEquipList` gère les
   variantes de nom de clé.
5. **Favoris** (`collectFavoriteUnitIds`), deux formats gérés :
   - **récent** : `favorite_unit_list = [{ type, unit_id_list }, …]` — on
     privilégie `type === 1`, avec aplatissement récursif des groupes.
   - **ancien** : `world_arena_favorite_unit_id_list = [[…],[…]]`.
6. **Cible** = favoris si présents, **sinon repli** sur tous les monstres runés RTA.
7. Pour chaque unité cible → `ImportedUnit { com2usId, flatRuneSpeed, swift }` :
   - `flatRuneSpeed` = somme des SPD (effet type **8**) sur mainstat + prefix +
     substats (**valeur + meule/gemme**).
   - `swift` = **`sets.includes('swift')`** (`swiftActive`), et rien d'autre.

> ### ⚠️ Une seule source de vérité pour le Swift : les **sets actifs**
>
> Ne **jamais** recompter les runes Swift à côté (`swiftCount >= 4`). C'est ce
> qu'on faisait, et ça divergeait de `activeSets` dès qu'une rune **Intangible**
> servait de joker : **3 Swift + 1 Intangible** → `activeSets` renvoie bien
> `swift`, le comptage disait non.
>
> Conséquence observée : le bonus de +25 % n'était pas intégré à la « SPD runes »
> alors que l'affichage de la vitesse de combat, lui, le **retirait** (voir
> `swiftFlat` dans [calcul-vitesse.md](calcul-vitesse.md)) → **26 points de
> vitesse en moins** sur un monstre à 101 de base, et **lui seul dans son
> équipe**. C'est ce « un seul monstre faux » qui a mis sur la piste.
>
> Cas réel de contrôle (compte de l'auteur) : *Chilling* (base 101, brut 195,
> Swift complété par une Intangible) sous lead **+30 %** → **367** en jeu ;
> l'import en donnait 341.

## Constantes SW

| Constante | Valeur | Sens |
|-----------|--------|------|
| `RUNE_EFF_SPEED` | `8` | Type d'effet « Vitesse » (com2us). |
| `RUNE_SET_SWIFT` | `3` | `set_id` du set Swift. |
| jointure | `unit_master_id` (SWEX) = `com2usId` (`Monster`) | Mapping unité → monstre. |

## Côté RTA (consommation)

Dans `handleImportFile` de [RtaPage.tsx](src/pages/RtaPage.tsx) :

- Mapping `com2usId → Monster` ; les unités inconnues sont ignorées.
- **SPD runes importée** = `flatRuneSpeed + (swift ? ceil(base × 25 / 100) : 0)`.
  → Ici, comme on part des **runes brutes**, on **rajoute** le +25 % Swift sur la
  base (contrairement à la saisie manuelle, voir
  [calcul-vitesse.md](calcul-vitesse.md)).
- **Déduplication** par monstre : on garde le **meilleur build** (SPD max) ; ses
  **sets** et son **nombre de runes** sont conservés.
- **Pré-classement par set** (`mapRtaItems`) : un monstre avec **6 runes** va dans
  la section de son **set principal** (`primarySection` : Violent/Swift/Despair/
  Rage/Fatal/Vampire, sinon « Autre ») ; **< 6 runes → « Non classé »**. Les sets
  actifs (`activeSetsFromRuneIds`, 4 pièces en premier) sont stockés sur l'entrée
  pour l'affichage.
- Si une prépa existe déjà : `confirm` unique (importer / ne rien faire) ; l'import **remplace** (`clearAll` puis `importEntries`).
- Messages : succès (`n monstres favoris importés`) ou erreur (aucun favori/preset
  reconnu, JSON illisible…).

## Import des équipes de siège (défense & offense)

Défense et offense partagent la **même forme** : des decks de 3 monstres (index
0 = leader) où chaque monstre a **ses propres runes de siège** (comme la box RTA,
le siège stocke des presets de runes par monstre). D'où une logique factorisée :

- `equipArrayToMap(equip)` : `[{ unit_id, rune_id_list }, …]` → `Map<unit_id, rune_id_list>`.
- `buildSiegeDecks(defs, runeById, unitById)` : résout des `DeckDef` (3 unit_id
  ordonnés + runes) en `SiegeImportedDeck` (mapping monstre + `speedFromRuneIds`),
  ignore les decks totalement vides, garde les decks partiels.

### Défense — `parseSiegeDefense`

Jusqu'à 6 decks. Champs SWEX :

| Clé | Rôle |
|-----|------|
| `guildsiege_defense_deck_unit_list` | `[{ deck_id, unit_id_list }, …]`. `unit_id_list` = 3 slots ; **index 0 = leader** (par position) ; `0` = slot vide. |
| `guildsiege_defense_deck_equip_list` | Indexé par `deck_id` → `{ equip: [{ unit_id, rune_id_list }, …] }`. |

### Offense — `parseSiegeOffense`

Les équipes d'**attaque sauvegardées** (≈ 50 possibles). Champs SWEX :

| Clé | Rôle |
|-----|------|
| `deck_list` filtré sur `deck_type === 22` | Chaque deck : `{ deck_seq, unit_id_list, leader_unit_id, equip }`. `equip` = runes inline par unité. |

- `deck_type = 22` = équipes d'attaque de siège (constante `SIEGE_OFFENSE_DECK_TYPE`,
  identifiée sur des exports réels : decks de 3 monstres avec presets de runes).
- **Leader** donné par `leader_unit_id` → replacé en 1ᵉʳ (les autres unités non
  nulles suivent).
- Erreur claire si aucun deck de ce type (⇒ il faut avoir **sauvegardé ses
  attaques en jeu** avant d'exporter).

### Modèle retourné (commun)

```ts
interface SiegeImportedSlot { com2usId: number; flatRuneSpeed: number; swift: boolean }
interface SiegeImportedDeck { deckId: number|string; slots: (SiegeImportedSlot|null)[] } // len 3, 0=leader
interface SiegeParseResult { decks: SiegeImportedDeck[]; error?: string }
```

### Consommation (mapping)

Dans [applyAccount.ts](src/lib/applyAccount.ts), réutilisé par `importAccount` :

- `mapRtaItems(units, byCom2us)` → entrées RTA (dédup au meilleur build, SPD max).
- `mapSiegeTeams(decks, byCom2us)` → `{ teams, missing }` ; unité inconnue → slot
  vide + compteur `missing`.
- **SPD runes** (les deux) = `flatRuneSpeed + (swift ? ceil(base × 25 / 100) : 0)`
  (Swift ajouté car on part des runes brutes), avec `swift` **déduit des sets
  actifs** — voir l'encadré « une seule source de vérité » plus haut.
- **Sets de runes** (`slot.sets`) : extraits des runes du deck
  (`activeSetsFromRuneIds`) — sets 4 pièces (**Swift, Rage, Fatal, Despair,
  Vampire, Violent**) actifs à 4 runes, tous les autres (dont **Destroy**) à 2.
  Une rune **Intangible** joue le joker et complète le set le plus proche d'être
  plein. Affichés en icônes dans la vue compacte du siège.

Puis `importAccount` applique : `rta.importEntries` (après `clearAll`),
`siegeDef.importTeams(_)`, `siegeOff.importTeams(_)` — qui **remplacent**. `lead`/`tick`
des équipes à 0 ; le lead est ensuite **déduit automatiquement** du leader (slot 0).
Seules les cibles qui ont des données sont touchées (un compte sans favoris RTA ne
vide pas la prépa RTA).

## Import « Mon compte » — box 6★ & inventaire

Contrairement à RTA/siège (persistés en `localStorage`), les données de « Mon
compte » restent **en mémoire dans [App.tsx](src/App.tsx)** (`useState` : `box`,
`runes`, `artifacts`) → **ré-import nécessaire à chaque session**. Choix assumé de
sobriété : un gros compte (des milliers de runes) ne remplit pas le stockage.

### Box 6★ — `parseAccountBox`

- Parcourt `unit_list`, ne garde que les unités **montées 6★** (`class === 6`).
- Pour chacune : `com2usId` (`unit_master_id`), `unit_level`, et un `GearSet`
  construit depuis l'équipement **actuellement équipé** (runes/artéfacts embarqués
  dans l'unité + relique).
- `mapBoxMonsters` résout `com2usId → Monster` ; les unités inconnues des données
  sont ignorées. Renvoie `{ key, monster, stars, level, gear }` (key = `unit_id`).

### Inventaire — `parseAccountInventory`

- **Toutes** les runes et **tous** les artéfacts possédés (inventaire + équipés,
  dédupliqués par id via `indexRunes` / `indexArtifacts`).
- Chaque rune → `RuneDetail` (slot, set, rareté = `extra`, antique = `class > 10`,
  niveau, main/innée/substats meule incluse) ; chaque artéfact → `ArtifactDetail`
  (type élément/archétype, rareté = `natural_rank`, main, substats, `enchant`).
- Utilisé par les sous-sections **Runes** et **Artéfacts** (voir
  [compte/runes.md](../compte/runes.md), [compte/artefacts.md](../compte/artefacts.md)).

## Persistance optionnelle du compte — [accountStore.ts](src/lib/accountStore.ts)

Stockage **IndexedDB**, pour rendre le ré-import facultatif. Déclenché par le
réglage **« Garder mon compte »** ([useKeepAccount.ts](src/hooks/useKeepAccount.ts)),
dans le menu ⚙.

### ⚠️ Pourquoi pas `localStorage`

1. **Ça ne rentre pas.** Quota ~5 Mo par origine, souvent compté en UTF-16. Le
   modèle utile d'un gros compte pèse **2,2 Mo** (box 0,73 + runes 0,91 +
   artéfacts 0,53), soit ~4,4 Mo de quota. L'export brut fait 5 à 8 Mo.
2. **Le danger n'est pas de perdre le compte, c'est de perdre le reste.** Prépa
   RTA, équipes, recommandations, catégories et monstres perso partagent ce même
   budget — et ceux-là sont **écrits à la main**, irremplaçables. Le compte se
   réimporte en deux secondes. Un `QuotaExceededError` doit rester impossible.
3. `localStorage` est **synchrone** : sérialiser 2 Mo bloque le thread principal.

IndexedDB n'a aucun de ces défauts, et son **structured clone** évite le
`JSON.stringify` à l'écriture comme le re-parse à la lecture.

### Ce qu'on stocke

Une base `sw-forge`, un store `account`, **une clé fixe** `current` :
`{ schema, savedAt, box, runes, artifacts }`.

- ⚠️ **La sortie des extracteurs (`BoxMonster[]`), jamais l'état affiché
  (`BoxItem[]`).** Un `BoxItem` embarque l'objet `Monster` complet : ça duplique
  ~0,25 Mo, mais surtout ça **fige** la résolution `com2usId → Monster`. Le jour
  où `monsters.json` gagne un monstre, un compte enregistré resterait aveugle.
  En gardant la sortie brute, on re-mappe à chaque démarrage avec les données du
  jour.
- ⚠️ **Le compte du joueur, et lui seul.** Les JSON d'autres joueurs importés
  dans la comparaison restent en mémoire, comme les courbes partagées.
- `schema` (`ACCOUNT_SCHEMA`) est à **incrémenter dès qu'un extracteur produit un
  champ de plus** : un enregistrement d'un autre schéma est ignoré à la lecture,
  et l'app invite à réimporter — sinon elle affiche des chiffres incomplets en
  silence.
- `exportedAt` est la date **de l'export** (`tvalue`), pas de l'enregistrement —
  voir « Âge du compte » plus bas. `savedAt` ne sert qu'au diagnostic.

### Concurrence

Ce sont les **premières écritures asynchrones** de l'app. Toutes les opérations
passent par une **file sérielle** : elles s'exécutent dans l'ordre où
l'utilisateur les a déclenchées (le parse étant synchrone, cet ordre est celui
des clics). Deux conséquences voulues :

- deux imports coup sur coup → **le dernier gagne**, quel que soit l'ordre
  d'achèvement des transactions ;
- une purge déclenchée après un import → **l'effacement tient**. Une écriture en
  retard ne doit jamais ressusciter un compte que l'utilisateur vient d'effacer :
  une action explicite annulée par un effet de bord invisible, c'est le pire cas.

### La question est POSÉE, pas planquée dans un réglage

> ⚠️ **Le réglage vaut pour TOUTE l'app**, pas seulement pour le compte : prépa
> RTA, siège, recommandations, catégories, monstres perso. Voir
> [usePersistence.ts](src/hooks/usePersistence.ts) et la convention dans le
> [README](README.md).
>
> ⚠️ **Trois états : oui / non / jamais demandé.** Un booléen à `false` par défaut
> confondait « a refusé » et « n'a jamais été consulté ». Résultat observé : on
> importe, on recharge, **le compte a disparu alors que la prépa RTA et le siège
> sont toujours là**. Incohérence jamais expliquée, dans un menu que personne
> n'ouvre.

La question est donc posée **à la fin du premier import**
([ImportOverlay.tsx](src/components/ImportOverlay.tsx) → `KeepAccountDialog`),
quand l'utilisateur vient de voir ses données arriver.

Trois éléments du texte à ne jamais retirer :

1. **La recommandation** — « sans ça, tu perds ton travail en fermant l'onglet ».
   Sans elle on répond au hasard : rien ne dit ce qu'on perd en refusant. Le même
   mot figure sur le bouton et dans le `hint` du réglage ⚙, pour que les deux
   endroits disent la même chose.
2. **« dans ton navigateur »** — c'est l'objection immédiate (« mes données
   partent où ? »), la réponse doit être dans la fenêtre, pas ailleurs.
3. **« tu pourras changer d'avis »** — sans ça la question devient un engagement,
   et on répond non par prudence.

⚠️ **Aucune des deux réponses ne détruit quoi que ce soit** : refuser garde le
compte pour la session en cours. **Fermer sans répondre n'enregistre rien** — on
redemandera au prochain import plutôt que d'interpréter un silence.

Le réglage ⚙ reste le point de changement d'avis :

- **Activation** : enregistre immédiatement le compte déjà en mémoire (sinon il
  faudrait réimporter le même fichier pour rien) et appelle
  `requestPersistence()` **dans le clic**.
- **Désactivation** : **efface** tout de suite. Un réglage décoché qui laisserait
  le compte sur le disque serait un mensonge.
- Stockage indisponible → l'interrupteur est **grisé**, il dit pourquoi, et la
  question n'est pas posée à l'import.

### Attente pendant le traitement

⚠️ Un export de 5 à 8 Mo **bloque le thread principal** le temps du parse et du
mapping. Sans repère visuel l'app paraît figée, on reclique, et tout repart.
`ImportSpinner` couvre l'écran pendant l'opération.

L'import est `async` **uniquement pour ça** : sans une respiration de deux frames
avant le travail, React n'a jamais l'occasion de peindre l'attente. Une seule
frame ne suffit pas — le DOM peut être commité sans être peint.

### Cycle de vie dans [App.tsx](src/App.tsx)

| Moment | Ce qui se passe |
|---|---|
| Démarrage | Si le réglage est actif : `loadAccount()`, puis **re-mapping** `com2usId → Monster` |
| Import | Affichage d'abord, puis `saveAccount()` **sans attendre** |
| ⚙ « Tout supprimer » | `clearAccount()` **attendu** avant le `location.reload()` |
| Décochage du réglage | `clearAccount()` |

Trois pièges, tous traités :

- ⚠️ **Attendre les données de monstres avant de relire.** La box stockée n'est
  qu'une liste de `com2usId` : sans l'index, elle ressort **vide et sans erreur**.
- ⚠️ **Un import manuel pendant la relecture doit gagner.** L'utilisateur qui
  dépose un fichier ne doit pas le voir remplacé par le compte de la veille,
  arrivé une demi-seconde plus tard (`importedManuallyRef`).
- ⚠️ **L'écriture ne bloque pas l'affichage.** `saveAccount` est lancé après les
  `setState` et sans `await` : 2 Mo ne doivent pas retarder l'apparition du
  compte. Un échec laisse l'import parfaitement utilisable pour la session — on
  ne casse pas l'usage courant pour un problème de confort.

L'état **`accountHydrating`** est propagé à l'accueil (`accountLoaded` a
**trois** valeurs : `oui` / `non` / `chargement`) et à « Mon compte ».

### Âge du compte — [AccountFreshness.tsx](src/components/AccountFreshness.tsx)

⚠️ **Complément indispensable de la persistance**, pas une décoration. Un compte
conservé ne se voit plus arriver : sans date affichée, on travaille sur des runes
d'il y a trois semaines sans le savoir. Le compte volatil n'avait pas ce problème
— on venait de le déposer.

> ### ⚠️ La date de l'EXPORT, jamais celle de l'import
>
> `tvalue` (heure serveur au moment de l'export SWEX), via
> `parseAccountExportDate`. **Pas** `Date.now()` à l'import : réimporter un
> fichier de trois semaines afficherait « aujourd'hui » sur des données périmées,
> soit exactement le mensonge que cette ligne existe pour empêcher.
>
> Vérifié sur des exports réels : `tvalue` colle à la seconde près à la création
> du fichier, et reste bien antérieur à sa date de modification quand il a été
> recopié. Ne pas confondre avec `tvaluelocal`, décalé de l'heure du serveur.
>
> Garde-fou : toute valeur hors [2014, demain] est rejetée (`null`) — un champ
> absent ou dans une autre unité afficherait sinon une date absurde.

- « **Compte exporté le 9 août** » ; l'année n'apparaît que si ce n'est pas
  l'année courante (sinon elle alourdit une ligne qu'on lit en passant).
- Au-delà de **14 jours**, la ligne passe en orange et invite à réexporter :
  l'ordre de grandeur où un joueur actif a refait ses runes.
- Affiché dans le **menu ⚙**, juste sous le réglage « Garder mon compte » : c'est
  là qu'on se pose la question de la fraîcheur, et ça n'encombre aucune page.
- Vaut aussi pour un compte **simplement en mémoire** : c'est l'âge des DONNÉES
  qu'on annonce, pas celui de l'enregistrement.

### Repli

Toute erreur (navigation privée, stockage bloqué, base corrompue, quota atteint)
se résout en `null` ou `false`, **jamais en exception** : l'app retombe sur le
comportement mémoire. Safari efface le stockage écrit par script après ~7 jours
sans visite — c'est un cas **normal**, pas une erreur à signaler.
`requestPersistence()` limite l'éviction et s'appelle **dans un geste
utilisateur**, où les navigateurs accordent plus volontiers.

## Confidentialité

- Traitement local uniquement ; le fichier n'est jamais poussé/envoyé.
- Vaut aussi pour le **JSON d'un ami** importé dans la comparaison de courbes
  (voir [compte/runes.md](../compte/runes.md)) : lu en mémoire, jamais envoyé.
- Les exports de compte sont **gitignorés** (`*account*.json`, `tototriou-*.json`,
  etc.) — ne jamais committer un export réel.
