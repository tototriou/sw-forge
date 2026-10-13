# Import de compte — persistance optionnelle du compte

Partie de [Import d'un compte SWEX](README.md).

## Persistance optionnelle du compte — [accountStore.ts](src/lib/accountStore.ts)

Stockage **IndexedDB**, pour rendre le ré-import facultatif. Déclenché par le
réglage **« Garder mes données »** ([usePersistence.ts](src/hooks/usePersistence.ts)),
dans les réglages (bloc « Mes données ») — un seul réglage pour toute l'app, le
compte compris.

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

Une base `swblacksmith`, un store `account`, **une clé fixe** `current` :
`{ schema, savedAt, box, runes, artifacts, relics, crafts, usedRuneIds, relicUsageById, runeMarkerLabels }`.

- ⚠️ **La base s'appelait `sw-forge`** jusqu'au rebranding.
  À la première ouverture, `reprendreAncienneBase` recopie son compte dans la
  nouvelle, le RELIT, puis supprime l'ancienne — avant toute opération de la
  file, sinon la première lecture rendrait « aucun compte ». Un compte déjà
  présent dans la nouvelle base fait foi. Copie impossible : l'ancienne reste,
  reprise au lancement suivant. ⚠️ `indexedDB.open` créerait une base absente :
  la création est annulée (`oldVersion === 0`), aucune base `sw-forge` vide
  n'apparaît.

- ⚠️ **La sortie des extracteurs (`BoxMonster[]`), jamais l'état affiché
  (`BoxItem[]`).** Un `BoxItem` embarque l'objet `Monster` complet : ça duplique
  ~0,25 Mo, mais surtout ça **fige** la résolution `com2usId → Monster`. Le jour
  où `monsters.json` gagne un monstre, un compte enregistré resterait aveugle.
  En gardant la sortie brute, on re-mappe à chaque démarrage avec les données du
  jour.
- ⚠️ **Le compte du joueur, et lui seul.** Les JSON d'autres joueurs importés
  dans la comparaison restent en mémoire, comme les courbes partagées.
- ⚠️ **`usedRuneIds` est stocké, pas recalculé.** Les decks ne vivent que dans
  l'**export brut**, qu'on ne conserve jamais (5 à 8 Mo) : sans cette liste, le
  filtre « Runes utilisées » s'éteindrait à chaque rechargement d'un compte
  conservé. Quelques milliers d'entiers, négligeable à côté des runes. Elle est
  rangée **par périmètre** (un tableau par clé) : une liste plate est rejetée à
  la lecture.
- ⚠️ **`runeMarkerLabels` aussi** : `markers` ne vit que dans l'export brut. Le
  marqueur de chaque rune, lui, voyage dans `runes` (`RuneDetail.marker`).
- `schema` (`ACCOUNT_SCHEMA`, **7** : l'inventaire de reliques — `relics` et
  `relicUsageById`, absents jusque-là —, les marqueurs de runes et les runes
  utilisées par périmètre ; 6 : `ArtifactDetail.id` ; 5 : propriété unique des
  reliques, qui remplace un `relic.sub` mal modélisé — voir
  [compte/](../../compte/)) est à
  **incrémenter dès qu'un extracteur produit un champ de plus** : un enregistrement d'un autre schéma est ignoré à la lecture,
  et l'app invite à réimporter — sinon elle affiche des chiffres incomplets en
  silence.
- ⚠️ **Le 7 réunit deux chantiers parallèles** (reliques ; marqueurs et runes
  utilisées par périmètre), qui avaient chacun pris le 7 pour leur seule
  moitié. Aucune version publiée n'a porté l'une sans l'autre (la v1.13.0 est
  au 6), d'où un seul numéro. Un « 7 » incomplet, laissé par un navigateur qui
  a fait tourner l'une des deux branches, est rejeté par la **validation** des
  champs, pas par le numéro — vérifié dans `tests/stockage.test.ts`.
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
> [conventions](../../../03-developpeur/conventions.md) (« Persistance navigateur »).
>
> ⚠️ **Trois états : oui / non / jamais demandé.** Un booléen à `false` par défaut
> confondait « a refusé » et « n'a jamais été consulté ». Résultat observé : on
> importe, on recharge, **le compte a disparu alors que la prépa RTA et le siège
> sont toujours là**. Incohérence jamais expliquée, dans un menu que personne
> n'ouvre.

La question est donc posée **à la fin du premier import**
([Dialogs.tsx](src/ui/Dialogs.tsx) → `KeepAccountDialog`),
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

⚠️ **Fermer sans répondre n'enregistre rien** — on redemandera plutôt que
d'interpréter un silence.

### ⚠️ La question revient à CHAQUE import — au moins une fois par session

Sauf si l'utilisateur coche **« Ne plus me montrer pendant cette session »**. Un
choix pris une fois pour toutes vieillit mal : on accepte la conservation chez
soi, puis on ouvre le site sur le poste d'un ami sans que rien ne le rappelle.
Reposer la question au dépôt du fichier, c'est la reposer là où le contexte a pu
changer.

⚠️ **La case vit en mémoire, jamais sur le disque.** Elle évite d'être
resollicité quand on enchaîne plusieurs fichiers d'affilée ; elle ne fait pas
taire la question pour toujours. Au rechargement suivant, elle est reposée — la
garantie tenue est « **au moins une fois par session** ». Elle s'applique aux
**deux** réponses.

> ⚠️ **Refuser alors qu'on conservait déjà efface l'existant** — prépa RTA,
> équipes, recommandations, compte. La fenêtre revenant à chaque import, un clic
> machinal coûterait des mois de travail : une confirmation s'interpose, dont le
> défaut est **de ne rien perdre** (« Annuler = continuer à conserver »).

Le réglage ⚙ reste le point de changement d'avis :

- **Activation** : enregistre immédiatement le compte déjà en mémoire (sinon il
  faudrait réimporter le même fichier pour rien) et appelle
  `requestPersistence()` **dans le clic**.
- **Désactivation** : **efface** tout de suite. Un réglage décoché qui laisserait
  le compte sur le disque serait un mensonge.
- Stockage indisponible → l'interrupteur est **grisé**, il dit pourquoi, et la
  question n'est pas posée à l'import.

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
- Affiché dans le **menu ⚙**, juste sous le réglage « Garder mes données » : c'est
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
