# La sauvegarde de session

**Statut :** ÉTAT ACTUEL — « Sauvegarder la session » : où, ce que contient le fichier, son format et sa relecture
**Lire si :** on touche la ligne « Session » des Paramètres, les actions de la palette, « Sauvegarder » ou « Sauvegarder sous… » de la barre du haut, Ctrl+S, la ligne « Dossier SW Blacksmith » des Paramètres, `src/lib/session.ts`, `src/lib/sessionOptimizer.ts`, `bureau/session.ts`, `bureau/sessionPur.ts`, ou ce qu'un écran retient d'une page à l'autre
**Voir aussi :** [import-compte.md](import-compte.md) (le compte importé), [../outils/optimizer/ecran/equipement-actuel.md](../outils/optimizer/ecran/equipement-actuel.md) (l'exemplaire)

Une session est l'état de l'app à un instant donné, dans un fichier que
l'utilisateur garde où il veut : de quoi reprendre plus tard là où il
s'était arrêté.

## Sauvegarder

Quatre accès à « Sauvegarder », qui font tous la même chose
(`sauvegarderSession`, `src/App.tsx`) :

- **Barre du haut** (`src/components/TopBar.tsx`) : à l'ordinateur, le
  bouton « **Sauvegarder** » (icône `Save`) en tête de la zone droite, avant
  « Se déconnecter » (site) ou « Sauvegarder sous… » (application de
  bureau) ; au téléphone, l'icône seule, nommée « Sauvegarder la
  session (Ctrl+S) », avant la loupe et le ⚙. Infobulle : « Sauvegarder dans
  <nom>.json (Ctrl+S) » quand une session est en cours, sinon « Sauvegarder
  la session dans un fichier (Ctrl+S) ».
- **Ctrl+S** (⌘S) : l'écouteur clavier d'`App.tsx`, à côté de Ctrl K, sans
  Maj ni Alt ; `preventDefault` aussi sur le site, à la place
  d'« Enregistrer la page » ; une touche tenue ne sauvegarde qu'une fois.
- **Paramètres**, bloc « Mes données » (`SettingsList`,
  `src/components/SettingsMenu.tsx`) : une ligne « **Session** » et son
  bouton « **Sauvegarder** » (infobulle « Sauvegarder la session dans un
  fichier »), avant « Tout supprimer », qui reste la dernière ligne du
  bloc. Texte d'aide sur le site : « Tout l'état de l'app dans un fichier, à
  garder où tu veux : le compte, ton travail, les réglages et l'état des
  outils. » ; dans l'application de bureau, « enregistré où tu veux » au
  lieu de « à garder où tu veux ».
- **Palette Ctrl K** : l'action « **Sauvegarder la session** », sous-titrée
  « Tout l'état de l'app dans un fichier ».

**Tant que le compte conservé se relit**, au lancement (`accountHydrating`,
`src/App.tsx`), la sauvegarde attend : « Sauvegarder » et « Sauvegarder
sous… » de la barre du haut, et « Sauvegarder » des Paramètres, restent
affichés, désactivés, avec l'infobulle « Ton compte se charge encore : la
sauvegarde attend qu'il soit relu. » (`sauvegardeIndisponible`) ; l'icône
du téléphone est désactivée aussi, son nom inchangé. Ctrl+S et l'action de
la palette ne font rien. Sinon la session écrite n'aurait pas de
compte — et dans l'app, elle remplacerait la session en cours, que le bureau
a déjà reprise.

`sauvegarderSession` compose la session et l'écrit (`ecrireSession`), puis :

- **sur le site**, la télécharge (`telechargerTexte`,
  `src/lib/telechargement.ts`) : un fichier daté à chaque fois, que le
  navigateur enregistre. Rien d'autre à l'écran ;
- **dans l'application de bureau**, réécrit la session en cours (section
  suivante).

Nom proposé : `swblacksmith-session-AAAA-MM-JJ-HHhMM.json`, à l'heure locale
du clic (`nomFichierSession`). Environ 2,7 Mo avec un vrai compte.

## La session en cours (application de bureau)

Le fichier que « Sauvegarder » réécrit sans rien demander. Les sessions
s'enregistrent dans le sous-dossier `sessions` du **dossier SW Blacksmith**.
Côté page : `useSessionEnCours` et `useEtatSession`
(`src/hooks/useSessionEnCours.ts`), le pont `sessionBureau()`
(`src/lib/bureau.ts`), la ligne « Dossier SW Blacksmith »
(`ReglageDossierSwblacksmith`, `src/components/SettingsMenu.tsx`) ; côté
bureau : `bureau/session.ts`
(boîtes de dialogue, messages, réglage) et `bureau/sessionPur.ts` (pur,
testé).

- **Le dossier SW Blacksmith** : Paramètres, bloc « Mes données », ligne
  « Dossier SW Blacksmith », juste après « Session », dans l'application de
  bureau seulement : « Retirer »
  (désactivé sans dossier, infobulle « Ne plus utiliser ce dossier : la
  prochaine session le redemandera ») et « Choisir… » (boîte « Dossier SW
  Blacksmith » du système, bouton « Choisir ce dossier », création de
  dossier permise). Dessous : le chemin, sinon « Choisis le dossier de SW
  Blacksmith : les sessions s'enregistrent dans son sous-dossier
  « sessions ». » (`presentationDossierSwblacksmith`). C'est un **réglage** :
  retenu dans `dossier-swblacksmith.json` (dossier des données,
  `{ "dossier": … }`) même sans « Garder mes données », et gardé par
  « Tout supprimer ». En changer ou le retirer ne change pas la session en
  cours : seules les sessions suivantes vont dans le nouveau dossier.
- **Aucune session au départ** : la première sauvegarde demande le dossier
  SW Blacksmith s'il n'y en a pas (la même boîte ; annulée, rien ne se
  passe), crée `sessions` au besoin, puis y écrit le nom daté proposé, sans
  autre question ; ce fichier devient la session en cours. Un nom déjà pris
  (deux sauvegardes dans la même minute) devient `<nom> (2).json`,
  `(3)`… (`cheminLibre`) : jamais d'écrasement.
- **« Sauvegarder »** réécrit la session en cours, sans boîte.
- **« Sauvegarder sous… »** (barre du haut à l'ordinateur, après
  « Sauvegarder », infobulle « Enregistrer la session dans un autre
  fichier, qui devient la session en cours (l'ancien n'est plus
  modifié) » ; palette, sous-titrée « Un autre fichier, qui devient la
  session en cours ») demande le dossier SW Blacksmith s'il n'y en a pas,
  puis ouvre la boîte « Sauvegarder la session sous » dans son dossier
  `sessions` (filtre `.json`, nom daté proposé, confirmation avant
  d'écraser) ; le fichier choisi devient la session en cours, l'ancien
  n'est plus touché. Absent du site. Un nom tapé sans `.json` le reçoit
  (`avecExtension`) ; si ce fichier-là existe déjà, la boîte n'a rien vu
  (sous Linux, elle n'ajoute pas l'extension du filtre) : une seconde
  question, « « <nom>.json » existe déjà. », demande « Annuler » (le défaut)
  ou « Remplacer » (`confirmationApresExtension`).
- **Après l'écriture**, la notification « Session enregistrée · <nom>.json »
  (`useNotifier`). **Un échec** (dossier disparu, accès refusé, disque
  plein…) ouvre une modale « La session n'a pas été enregistrée » avec la
  cause et « Fermer » ; la session en cours ne change pas. La cause : celle
  de l'écriture (`messageEchec` ; un dossier de session disparu renvoie vers
  « Sauvegarder sous… »), ou, quand le dossier SW Blacksmith ne peut pas
  recevoir `sessions`, « Le dossier SW Blacksmith ne peut pas recevoir la
  session : <raison>. Choisis-en un autre dans Paramètres › « Dossier SW
  Blacksmith ». » (`messageEchecDossier`) — « Sauvegarder sous… »
  échouerait pareil.
- **Écriture sûre** (`ecrireSansRisque`) : un fichier temporaire caché dans
  le même dossier, vidé sur le disque, puis renommé par-dessus l'ancien
  (renommage retenté cinq fois sur `EPERM`, `EBUSY`, `EACCES`). Un échec
  retire le temporaire et laisse l'ancien fichier intact.
- **La session en cours n'est retenue après fermeture qu'avec « Garder mes
  données »** : dans `session.json` du dossier des données
  (`{ "chemin": … }`). La page redit la conservation au chargement et à
  chaque changement (`retenir`) ; le fichier retenu n'est repris qu'à la
  première réponse, si elle est oui, et si le fichier existe encore.
  Introuvable (support pas encore monté, fichier déplacé), il n'est pas la
  session en cours mais **reste retenu** pour l'ouverture suivante, jusqu'à
  ce qu'une sauvegarde ou « Tout supprimer » le remplace.
  Conservation refusée : `session.json` est effacé, la session en cours ne
  vaut que jusqu'à la fermeture.
- **« Tout supprimer »** (Paramètres ; l'application de bureau n'a pas
  « Se déconnecter ») oublie la session en cours avant de recharger
  (`oublier`) : l'app repart vide, un Ctrl+S réécrirait la sauvegarde avec
  ce vide. Les fichiers de sessions et le dossier SW Blacksmith restent.
- **Une sauvegarde à la fois** : un Ctrl+S pendant une boîte ou l'écriture
  est ignoré, comme « Choisir… » pendant une sauvegarde.
- **Ce que le bureau vérifie** : l'expéditeur (la page de sa fenêtre) ; le
  texte, une session (`texteSessionValide` : JSON de format
  `swblacksmith/session`, 64 Mo au plus) ; le nom proposé, un nom de fichier
  `.json` sans séparateur ni caractère interdit (`nomProposeValide`) ; le
  chemin relu de `session.json`, absolu et en `.json`
  (`lireSessionRetenue`) ; le dossier relu, absolu (`lireDossierRetenu`).
  `FORMAT_FICHIER_SESSION` recopie `FORMAT_SESSION`, un test vérifie qu'ils
  concordent.
- **Messages** (`bureau/preload.ts`, objet `session`) : `etat()`,
  `surEtat(rappel)`, `retenir(oui)`, `sauvegarder(texte, nomPropose)`,
  `sauvegarderSous(texte, nomPropose)`, `choisirDossier()`,
  `oublierDossier()`, `oublier()`. L'état vaut `{ chemin, nom, dossier }`
  et il est diffusé à chaque changement ; `sauvegarder` et
  `sauvegarderSous` rendent `enregistree` (avec l'état), `annulee` ou
  `echec` (avec le message).

## Ce que contient le fichier

**Ce que l'app garde quand on passe d'une page à l'autre, tel qu'il est au
moment du clic**, que « Garder mes données » soit activé ou refusé. Du JSON
compact (`composerSession`, `ecrireSession`, `src/lib/session.ts`) :

| Champ | Contenu | Lu dans l'app par |
|-------|---------|-------------------|
| `format`, `version` | `swblacksmith/session`, `1` | — |
| `enregistreeLe`, `versionApp` | date ISO du clic ; version de l'app | — |
| `stockage` | clé → valeur brute, pour les clés de `CLES_SESSION` : prépa RTA, ses catégories, ses deux points de retour ; siège défense et offense ; recommandations ; monstres perso ; listes de l'Optimizer ; thème, score, overcap, adversaire de référence | `lireTravail` (`usePersistence.ts`) : la dernière valeur écrite par `saveLocal`, gardée en mémoire même conservation refusée (`saveLocal` n'écrit alors rien sur le disque), sinon le stockage local ; `oublierLocal` efface les deux |
| `compte` | le compte importé (`StoredAccount`, schéma 7), ou `null` | le compte en mémoire de `App.tsx`, pas IndexedDB |
| `outils.memoire` | clé → valeur de chaque `useStickyState`, sauf `STICKY_HORS_SESSION` (`sidebar.retractee`, `mobileNotice.ferme`) | `photographierMemoire` (`useStickyState.ts`) |
| `outils.optimizer` | les champs `CHAMPS_OPTIMIZER_SESSION` de `useOptimizerState` : monstre choisi et son exemplaire, set, conditions min/max, principales imposées, runes imposées, sous-propriétés verrouillées, artéfacts, relique, objectif et réglages de combat, exclusions, réglages avancés, tri | `photoOptimizer` (`sessionOptimizer.ts`) |

- `Set` et `Map` s'écrivent `{"$set": […]}` et `{"$map": [[clé, valeur]…]}`,
  à toute profondeur (`encoder`, `decoder`).
- Chaque champ de données d'`OptimizerState` est classé dans
  `CHAMPS_OPTIMIZER_SESSION` ou `CHAMPS_OPTIMIZER_HORS_SESSION` (interface,
  état passager, recherche et résultats) ; `tsc` échoue sur un champ non
  classé, un champ classé disparu, ou un champ de la session sans `set…`.
- **Pas dans le fichier** : la page affichée ; « Garder mes données » ; la
  barre latérale repliée et l'avertissement mobile fermé ; les résultats de
  l'Optimizer ; ce qu'un écran oublie déjà en changeant de page.
- Une clé de stockage ou un état `useStickyState` ajoutés entrent dans
  `CLES_SESSION`, ou dans `STICKY_HORS_SESSION` s'ils ne doivent pas
  voyager.

## Relire

`lireSession(texte)` lit et valide le fichier entier, et rend une session
avec ses avertissements, ou une erreur.

- **Refusé** : un texte qui n'est pas du JSON ou pas un objet ; un autre
  format ; une version qui n'est pas un entier ≥ 1, ou plus récente que
  `VERSION_SESSION` (« mets-la à jour pour la charger ») ; un `stockage`
  qui n'est pas un objet ; une valeur de stockage qui n'est pas un texte de
  la forme que son hook relit (`valeurStockageValide` : thème `auto`,
  `light`, `dark` ; score `eff`, `score` ; overcap et adversaire `0`, `1` ;
  le reste du JSON).
- **Lu, avec un avertissement** : un compte qui ne passe pas `compteValide`
  (schéma périmé) devient `null` ; un `outils.optimizer` qui n'est pas un
  objet devient `null`.
- **Ignoré** : un champ inconnu ; une clé de stockage hors `CLES_SESSION` ;
  une clé de mémoire de `STICKY_HORS_SESSION` ; dans l'Optimizer, un champ
  hors `CHAMPS_OPTIMIZER_SESSION`.

Le chargement d'une session dans l'app n'existe pas encore.

## Vérifier

```
node tests/run.mjs session persistance optimizerexemplairemontage renduparametres rendubureautextes rendubarresession bureausession
npm run bureau:preuve -- --session       # l'app, conservation refusée (après vite build et bureau:construire)
npm run bureau:preuve -- --conservation  # l'app, conservation activée : la session en cours survit à la fermeture
node scripts/preuve-session-site.mjs     # le site, conservation acceptée, exemplaire compris (après npm run build)
```

Tests unitaires : le format (aller-retour, refus, avertissements, compte
réel), `compteDeSession`, la photo de l'Optimizer, le miroir de
`saveLocal`, `exemplaireAuMontage`, et `bureau/sessionPur.ts` (relecture
de `session.json` et de `dossier-swblacksmith.json`, sous-dossier
`sessions`, nom libre, nom proposé, texte, ligne des Paramètres, messages
d'échec, écriture sûre sur un dossier temporaire). Tests de rendu : la
ligne « Session » et ses deux textes ; « Sauvegarder » et « Sauvegarder
sous… » de la barre du haut, et leurs infobulles, sur le site et dans
l'app.

`--session` part d'un `session.json` laissé par une ouverture précédente
(il doit être oublié, son fichier jamais réécrit), sans dossier SW
Blacksmith, puis enchaîne Paramètres (le dossier est demandé), palette,
Ctrl+S, « Sauvegarder sous… » et « Sauvegarder » de la barre, « Retirer »
le dossier et Ctrl+S ; après chaque geste, il relève les fichiers écrits
et leur date, l'infobulle, la notification, la ligne « Dossier SW
Blacksmith », `session.json` et `dossier-swblacksmith.json`. En mode
preuve, aucune boîte ne s'ouvre : le dossier SW Blacksmith « choisi » est
`<dossier>/swblacksmith`, et « Sauvegarder sous… » rend
`<n>-<nom proposé>` dans son `sessions`. `--conservation` choisit une
session en cours au premier lancement, la retrouve au second et la
réécrit par Ctrl+S. Le site télécharge depuis les Paramètres, la palette,
la barre du haut et Ctrl+S. Chaque fichier est relu par `lireSession`,
sans capture d'écran.
