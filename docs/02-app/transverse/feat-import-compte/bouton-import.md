# Import de compte — le bouton d'import

Partie de [Import d'un compte SWEX](README.md).

## Un seul import, plusieurs points d'entrée

L'import part de quatre endroits, et c'est **toujours le même traitement**
(`importAccount` dans [App.tsx](src/App.tsx)) :

- l'**accueil** : le bouton **« Importer mon compte »** et la zone de dépôt
  (voir [accueil/](../../accueil/README.md)) ;
- la **carte du compte** en tête de la barre latérale (« Importer un compte »,
  [SidebarCompte.tsx](src/components/SidebarCompte.tsx)) ;
- la **palette** : l'action « Importer mon compte » ;
- la page **Paramètres** : le bouton **« Importer un JSON »**
  ([AccountImportControl.tsx](src/components/AccountImportControl.tsx)).

Chaque geste ouvre le sélecteur de fichier ; le fichier choisi **remplace le
précédent** et est appliqué. Un import :

1. **traite la page courante** (affichage immédiat), et
2. **remplit les autres en arrière-plan** — RTA, défense, offense **et** « Mon
   compte » sont alimentés en une fois.

Pour rendre ça possible, les états sont **remontés dans [App.tsx](src/App.tsx)**
(`useRtaState`, `useSiegeState('defense')`, `useSiegeState('offense')`), et
`importAccount(text)` les applique tous. Le fichier lui-même n'est **pas
mémorisé** : ce qui en est tiré est conservé ou non selon le réglage unique
**« Garder mes données »** ([persistance.md](persistance.md)).

**Une seule confirmation**, si des données existent déjà (RTA/défense/offense) :
**« Remplacer les données présentes ? »** — « Cet import va remplacer ta prépa
RTA, tes équipes de siège et ta box par le contenu du fichier. Tes
recommandations enregistrées ne sont pas touchées. » Un import **remplace**
toujours la prépa RTA, les équipes de siège et la box.

Un import complet prend une vingtaine de millisecondes (un seul parse) : **pas
d'écran d'attente**, il ne ferait que clignoter.

> ⚠️ **Ne jamais proposer de « fusionner » ici.** Avec un dialogue
> « OK = remplacer · Annuler = fusionner », celui qui veut **annuler** son
> import cliquerait Annuler… et **dédoublerait tout son siège** (50 attaques →
> 100). Un export de compte est un **instantané du jeu**, il ne se cumule pas
> avec le précédent : `importTeams` n'a pas de chemin « ajouter à la suite ».
> Voir aussi la règle générale dans [siege/](../../siege/).

> ⚠️⚠️ **MAIS L'IDENTITÉ D'UNE ÉQUIPE SURVIT AU REMPLACEMENT.** Les **listes de
> travail de l'Optimizer** désignent un monstre par `{ teamId, slotIndex }`
> (voir [../optimizer/](../../optimizer/)). Si `importTeams` régénérait l'`id`
> de chaque équipe (`newId()`), aucun sélecteur ne résoudrait après un import,
> et la revérification supprimerait **définitivement** tous les membres et
> builds validés venus du siège — sur le geste même qu'elle est censée
> servir : ce ne serait pas « mon compte a changé », mais l'identifiant qui
> aurait changé sous eux.
>
> ⚠️ **L'identité, c'est la POSITION** : le siège est remplacé en bloc, et la
> Nᵉ équipe reste la Nᵉ. Ce qui a vraiment bougé — un monstre retiré du deck —
> est justement ce que `revalidateMembers` voit, sur des sélecteurs qui
> résolvent encore. Une équipe sans prédécesseur à sa position reçoit un id
> neuf. **Gardé** par un contrôle de source
> ([tests/optimizer-exclusion.test.ts](tests/optimizer-exclusion.test.ts)).

Message global récapitulatif **éphémère** (disparaît seul ~5 s ; ~9 s pour une
erreur) : « Import : N monstres 6★ · N monstres RTA · N défenses · N attaques ».

### Le dossier SW Exporter — l'app de bureau seulement

Dans l'**application de bureau**, le bloc « Application » des Réglages laisse choisir le **dossier SW
Exporter** et l'**invocateur** à suivre (ses exports `<nom>-<id>.json` à la
racine) — l'invocateur aussi depuis la **carte du compte** de la barre
latérale, qui devient alors un menu.

- **Choisir un invocateur change de compte** : son export s'importe **en
  entier**, comme l'import manuel — prépa RTA, défenses, attaques de siège
  et « Mon compte » —, annoncé par « Compte de <invocateur> chargé depuis
  SW Exporter », avec le récapitulatif de l'import. Choisir un **dossier**
  qui ne contient qu'un export le désigne d'office : même import complet.
  Rechoisir l'invocateur déjà suivi ne fait rien.
- **Puis chaque nouvel export de cet invocateur** — au lancement s'il est
  plus récent que le dernier lu, puis à chaque écriture tant que l'app est
  ouverte — met à jour **« Mon compte » seulement** (box 6★, inventaire,
  reliques, runes utilisées, marqueurs), annoncé par « Compte de
  <invocateur> mis à jour depuis SW Exporter ».
- ⚠️ **Après le choix, jamais la prépa RTA ni le siège.** L'import complet
  les REMPLACE (classement RTA, leads et ticks remis à zéro) : le faire à
  chaque connexion au jeu effacerait le travail de l'utilisateur. Le
  processus principal ([bureau/swex.ts](bureau/swex.ts)) marque `complet`
  le seul export qui suit un choix, jusqu'à ce que la page l'ait appliqué.
- ⚠️ **Avant de changer de compte, la sauvegarde est proposée.** Choisir un
  autre invocateur (carte du compte ou Réglages) ou un dossier, quand le
  travail a changé depuis la dernière sauvegarde de session, ouvre
  « Sauvegarder ta session ? » (`ChangementCompteDialog`) : « Le compte de
  SW Exporter va remplacer ta prépa RTA, tes équipes de siège et ta box. Les
  changements faits depuis ta dernière sauvegarde seront perdus si tu ne
  sauvegardes pas. » Trois actions, empilées : « Changer sans sauvegarder »
  (ton `danger`), « Annuler » (rien ne change, Échap aussi) et « Sauvegarder
  et changer » (mise en avant, le focus) — une sauvegarde annulée ou en
  échec ne change pas de compte. Désactivé avec la raison en infobulle
  tant que le compte conservé se relit. Le « Remplacer les données
  présentes ? » de l'import manuel n'est pas reposé.
- **« Le travail a changé »** (`travailNonSauvegarde`, `src/lib/session.ts`) :
  l'empreinte de la session (`empreinteTravail` — stockage et outils, sans
  la date, la version ni le compte, que l'export redonne) diffère de celle
  de la dernière sauvegarde. Sans sauvegarde depuis le lancement : dès
  qu'il y a une prépa RTA ou des équipes de siège, ce que le changement
  remplacerait. Demander pour rien coûte un clic ; ne pas demander peut
  coûter la prépa.
- **Un seul chemin** : `appliquerTout` (App.tsx) est l'import complet,
  appelé par l'import manuel et par le choix d'un invocateur ;
  `appliquerCompte` en est la moitié « Mon compte », appelée seule par les
  exports suivants — même extraction, même enregistrement (selon « Garder
  mes données »), même remise à zéro de l'exclusion de runes et du speed
  tuning quand l'invocateur CHANGE (`wizard_id`).
- Pas de question de conservation : le dossier est un réglage, posé une fois.
- Vérifier : `node tests/run.mjs bureauswex session renduchangementcompte`
  (l'annonce, le marquage `complet` du processus principal par contrôle de
  source, l'empreinte, la modale) et `npm run bureau:preuve -- --swex` (le
  branchement et le parcours entier dans l'app : la garde au choix du
  dossier et de l'invocateur, « Annuler », « Changer sans sauvegarder »,
  « Sauvegarder et changer », exports suivants).
- Détail (surveillance, réglage retenu, export illisible) :
  [bureau/README.md](../../bureau/README.md#le-dossier-sw-exporter) § « Le dossier SW Exporter ».

Helpers partagés par les deux parseurs : `runeSpeed` (SPD d'une rune : mainstat +
prefix + substats avec meule), `indexRunes` (index rune_id → rune, inventaire +
runes des unités), `indexUnits` (unit_id → unité), `speedFromRuneIds` (SPD plate
cumulée + set Swift complet pour un lot de rune_id).

### ⚠️ Un seul `JSON.parse` par import

Un import enchaîne **cinq** extracteurs sur le même fichier. Pour éviter cinq
`JSON.parse` d'un export de 8 Mo, ils acceptent
aussi l'**objet déjà parsé** (`AccountSource = string | objet`) ;
[App.tsx](src/App.tsx) parse une fois via `parseAccountSource` et passe le
résultat aux cinq. Le texte reste accepté pour les appels isolés — la
comparaison de comptes ([compte/](../../compte/)) n'appelle qu'un
extracteur.

Les trois index sont **mémoïsés** sur l'objet parsé (`WeakMap`, donc libérés
avec lui), au lieu d'être reconstruits jusqu'à quatre fois sur des milliers
d'entrées. Mesure sur un export réel de 7,8 Mo : **22 ms** (87 ms sans
mémoïsation).

> ⚠️ **Un index mémoïsé est PARTAGÉ, donc en lecture seule** — d'où le type
> `ReadonlyMap` en sortie. Un `.set()` en corromprait quatre autres, et le
> symptôme apparaîtrait dans un extracteur voisin, loin de la faute. Un
> extracteur qui a besoin d'un index à lui écrit `new Map(index)`.
