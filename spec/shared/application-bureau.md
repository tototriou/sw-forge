# L'application de bureau (Windows, Linux)

**Statut :** ÉTAT ACTUEL — l'application Electron : construction, démarrage, fenêtre, pont avec la page, données, SW Exporter, installeur, publication, mise à jour, bloc « Application » des Réglages
**Lire si :** on touche `bureau/`, `src/lib/bureau.ts`, `electron-builder.yml`, `.github/workflows/bureau.yml` ou un texte `selonSupport`
**Voir aussi :** [../telecharger.md](../telecharger.md) (la page du site), [import-compte.md](import-compte.md) § « Le dossier SW Exporter »

SW Blacksmith existe aussi en **application de bureau**, construite avec
**Electron** : la même app que le site, dans sa propre fenêtre, installée
sur la machine.

Code : **`bureau/`** (processus principal, hors de `src/` : il tourne dans
Node), `src/lib/bureau.ts` (ce que la page en sait), `electron-builder.yml`
(l'empaquetage), `.github/workflows/bureau.yml` (la publication). Carte des
fichiers : [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Construire et lancer

Electron `44.5.1`, electron-builder `26.15.3`, electron-updater `6.8.9`
(`package.json`, dont `main` désigne le `main.cjs` compilé).

- `scripts/construire-bureau.mjs` compile `bureau/main.ts` et
  `bureau/preload.ts` avec esbuild en `main.cjs` et `preload.cjs`, dans le
  dossier `dist-bureau` (non suivi) : un fichier chacun, CommonJS, cible `node22`, `electron`
  laissé externe. Il lit dans `src/index.css` les couleurs des deux thèmes
  (`--bg`, `--bar`, `--ink` ; `--forge-bg`, `--forge-bar`, `--forge-ink`) et
  les injecte en `#rrggbb` (`__COULEURS_THEMES__`) : la fenêtre s'habille
  avant que la page soit chargée.
- `npm run bureau` : le serveur de dev Vite (par son API), la compilation,
  puis Electron sur l'adresse du serveur (`SWBLACKSMITH_DEV_URL`),
  rechargement à chaud ; fermer la fenêtre arrête tout.
- `npm run bureau:construire` : la compilation seule. `npm run bureau:local` :
  `vite build`, la compilation, puis l'app sur le build.
  `npm run bureau:paquet` : la même chose, puis electron-builder (voir
  « L'installeur »).
- Tout lancement passe par `scripts/lib/electron.mjs`, qui retire
  `ELECTRON_RUN_AS_NODE` de l'environnement (hérité d'un terminal de VS
  Code, il fait démarrer Electron comme un simple Node).

## Le démarrage

`bureau/main.ts` :

1. **Avant `ready`** : `protocol.registerSchemesAsPrivileged` pour `app`
   (`standard`, `secure`, `supportFetchAPI`, `corsEnabled`, `stream`) ; avec
   `SWBLACKSMITH_PREUVE`, le dossier des données passe dans
   `<dossier>/donnees`. ⚠️ **Une seule instance par dossier de données**
   (`app.requestSingleInstanceLock`) : un second lancement quitte et ramène
   la fenêtre du premier au premier plan. Deux processus sur les mêmes
   données se disputeraient le stockage de la page et réécriraient tour à
   tour `session.json`, `swex.json` et `fenetre.json`.
2. **À `ready`** : aucun menu (`Menu.setApplicationMenu(null)`) ;
   `protocol.handle` sert les fichiers du build ; la fenêtre est créée,
   puis branchés la navigation, la mise à jour, le dossier SW Exporter et
   la session en cours ;
   elle charge `SWBLACKSMITH_DEV_URL` sinon `app://swblacksmith/`. En mode
   preuve, le scénario demandé par les variables d'environnement se lance.
3. Toutes les fenêtres fermées : l'app quitte.

## Le pont entre la page et le bureau

Le préchargement (`bureau/preload.ts`) expose par `contextBridge` un seul
objet figé, `window.swblacksmithBureau` ; `src/lib/bureau.ts` en est le seul
lecteur côté page (`estBureau()` = l'objet présent, avec `bureau: true`).

| Côté page | Canal | Sens |
|-----------|-------|------|
| `bureau`, `plateforme` (`process.platform`) | — | valeurs |
| `couleurs({ fond, barre, symboles })` | `bureau:couleurs` | page → bureau |
| `miseAJour.etat()` | `bureau:mise-a-jour` (`invoke`) | état courant |
| `miseAJour.surChangement(rappel)` | `bureau:mise-a-jour` | bureau → page ; rend de quoi se désabonner |
| `miseAJour.rechercher()`, `telecharger()`, `redemarrer()` | `bureau:rechercher`, `bureau:telecharger`, `bureau:redemarrer` | page → bureau |
| `swex.etat()`, `choisirDossier()`, `choisirInvocateur(fichier)`, `oublier()` | `bureau:swex-etat`, `bureau:swex-choisir-dossier`, `bureau:swex-choisir-invocateur`, `bureau:swex-oublier` (`invoke`) | rendent l'état du réglage |
| `swex.surEtat(rappel)`, `swex.surExport(rappel)` | `bureau:swex-etat`, `bureau:swex-export` | bureau → page |
| `swex.pret(pageSansCompte)`, `swex.lu(modifie)` | `bureau:swex-pret`, `bureau:swex-lu` | page → bureau |
| `session.etat()`, `retenir(oui)`, `choisirDossier()`, `oublierDossier()`, `oublier()` | `bureau:session-etat`, `bureau:session-retenir`, `bureau:session-choisir-dossier`, `bureau:session-oublier-dossier`, `bureau:session-oublier` (`invoke`) | rendent l'état : session en cours, dossier SW Blacksmith |
| `session.sauvegarder(texte, nomPropose)`, `sauvegarderSous(texte, nomPropose)` | `bureau:session-sauvegarder`, `bureau:session-sauvegarder-sous` (`invoke`) | rendent l'issue de l'écriture |
| `session.surEtat(rappel)` | `bureau:session-etat` | bureau → page |

Le processus principal n'accepte un message que de la page de SA fenêtre
(`evenement.sender`), et vérifie son contenu.

## Un seul code

⚠️ **Aucune fonctionnalité ne s'écrit deux fois.** La fenêtre affiche le
build Vite (`dist/`) tel quel ; seul ce que le navigateur ne sait pas faire
est propre au bureau. Une ligne propre au bureau se lit derrière
`estBureau()` (le préchargement a posé `swblacksmithBureau`) ; le site ne
change pas. Ce qui en dépend aujourd'hui :

| Sur le site | Dans l'app |
|-------------|-----------|
| Page « Télécharger », son entrée sous Ressources, le bouton et la carte de l'accueil ([telecharger.md](../telecharger.md)) | absents ; `#/telecharger` mène à l'accueil |
| — | bloc « Application » des Réglages : version, mise à jour, dossier SW Exporter |
| — | ligne « Dossier SW Blacksmith » du bloc « Mes données » ([sauvegarde-session.md](sauvegarde-session.md)) |
| « Se déconnecter », barre du haut (ordinateur) | absent : sans compte ni ordinateur partagé, il n'a pas de sens ; « Sauvegarder sous… » à sa place, « Tout supprimer » (Paramètres) reste le moyen de tout effacer |
| « Sauvegarder » télécharge un fichier daté | « Sauvegarder » réécrit la session en cours ; « Sauvegarder sous… » dans la barre du haut et la palette ([sauvegarde-session.md](sauvegarde-session.md)) |
| Textes qui parlent du navigateur (« dans ton navigateur », « en fermant l'onglet », « ta prochaine visite », thème « Auto », « un autre navigateur ») | leur variante : « sur ta machine », « en fermant l'application »… (`selonSupport(site, app)`) |

## La coquille

- **Protocole `app://swblacksmith/`** (`bureau/protocole.ts`, pur et testé) :
  sert `dist/` à la racine d'une origine sécurisée — l'app a besoin d'une
  origine (`BASE_URL`, `fetch` des données, workers module) ; jamais
  `file://`. ⚠️ Rien hors du build : toute adresse qui en sortirait
  (`..` encodé, chemin absolu, octet nul) répond 404.
- **Sécurité** : `contextIsolation`, `sandbox`, `nodeIntegration: false` ; la
  page ne reçoit qu'un objet figé (`bureau/preload.ts`), une fonction à la
  fois. Les messages de la page sont vérifiés (expéditeur, contenu).
- **La fenêtre** (`bureau/fenetre.ts`, pur) : barre de titre intégrée
  (`titleBarStyle: 'hidden'`) — la barre du haut de l'app sert de zone de
  déplacement (`html[data-bureau]`, `index.css`), les boutons de Windows
  sont dessinés par-dessus aux couleurs du thème, sur 47 px
  (`HAUTEUR_BARRE` : la barre de l'app en fait 48, filet compris). Défaut
  1440 × 900, minimum 1024 × 640 (`lg` de Tailwind : jamais le format
  téléphone). Taille normale, position, état agrandi et couleurs du dernier
  thème mémorisés à la fermeture dans `fenetre.json` (dossier des données),
  relus avec méfiance (`lireEtat`) : une position dont la barre n'est plus
  saisissable (120 × 47 px sur un écran) est oubliée, la fenêtre s'ouvre
  centrée sur l'écran principal, jamais plus grande que lui. Affichée une
  fois peinte, fond au dernier thème vu, sinon au thème du système. Titre
  `SW Blacksmith`, icône `favicon.png`.
- **Les couleurs** : au démarrage (`habillerBureau`, `main.tsx`), la page
  pose `data-bureau` et envoie `--bg`, `--bar`, `--ink` calculés, puis à
  chaque changement de `data-theme` ou du thème du système ; le processus
  principal n'accepte que trois `#rrggbb` (`couleursValides`) et recolore
  boutons et fond.
- **Navigation** (`bureau/navigation.ts`) : un lien externe s'ouvre dans le
  navigateur du système (`http`/`https` seulement) ; toute navigation hors
  de l'app est bloquée (un fichier déposé à côté de la zone d'import ne
  remplace plus l'app) ; un téléchargement passe par « Enregistrer le
  fichier », dans Téléchargements.

## Les données

- **Le stockage est celui de la page**, comme sur le site : `localStorage`
  (prépa, équipes, recos, réglages) et IndexedDB (compte), dans le dossier
  de l'app — `%APPDATA%\SW Blacksmith` sous Windows. Même règle : « Garder
  mes données » décide si tout survit à la fermeture.
- ⚠️ **Le site et l'app ne partagent rien** (deux origines) : passer de l'un
  à l'autre = réimporter son compte SWEX, exporter puis importer prépa et
  équipes.
- **Le dossier SW Blacksmith** (réglage, `dossier-swblacksmith.json`) est
  retenu même sans « Garder mes données » ; **la session en cours**
  (`session.json`) seulement avec (`bureau/session.ts`,
  [sauvegarde-session.md](sauvegarde-session.md) § La session en cours (application de bureau)).
- `npm run bureau:local` garde ses données à part (`%APPDATA%\swblacksmith`,
  nom npm) : il ne touche jamais celles de l'app installée.
- **Données du jeu** : celles de l'installeur, rafraîchies à chaque version
  ([donnees-monstres.md](donnees-monstres.md), « Chargement côté app »).

## Le dossier SW Exporter

`bureau/swex.ts` (disque, surveillance), `bureau/swexPur.ts` (pur, testé),
`src/components/SuiviSwex.tsx` (page), bloc « Application » des Réglages.

- **L'invocateur se choisit aussi depuis la carte du compte**, en tête de
  la barre latérale : avec un dossier choisi, la carte ouvre un menu — les
  invocateurs (celui suivi, coché), puis « Importer un fichier… ». Un seul
  réglage, deux accès (`useEtatSwex`) ; le processus principal diffuse
  l'état après chaque choix, pour que l'accès qui n'a pas choisi suive.
- **Le réglage** : « Dossier SW Exporter » (« Choisir… » ouvre la boîte du
  système ; « Retirer ») et « Invocateur » (les exports `<nom>-<id>.json` à
  la **racine** ; sous-dossiers `live`, `plugins`, `cert` ignorés ; un seul export →
  choisi d'office ; deux homonymes → l'identifiant les sépare). Retenu dans
  `swex.json` (dossier des données de l'app) **même sans « Garder mes
  données »** : c'est un réglage. Relu avec méfiance — un nom de fichier,
  jamais un chemin.
- **Ce qui est mis à jour : « Mon compte » seulement** — jamais la prépa RTA
  ni le siège (voir [import-compte.md](import-compte.md), § « Le dossier SW
  Exporter »).
- **Quand** : au chargement de la page, si l'export est plus récent que le
  dernier appliqué (annoncé), ou si la page n'a pas de compte (conservation
  refusée : relu en silence) ; puis à chaque changement du dossier, **1,5 s
  après la dernière écriture** (SW Exporter écrit plusieurs Mo).
- ⚠️ **La page confirme ce qu'elle a appliqué** : un export illisible (à
  moitié écrit) ne passe pas « lu » et sera redonné au prochain changement.
- ⚠️ La page ne se déclare prête qu'**après** le chargement des monstres et
  la relecture du compte conservé : plus tôt, la box serait vide, ou écrasée
  par un compte plus ancien.
- **Un export qui disparaît pendant la lecture du dossier** (SW Exporter le
  réécrit à cet instant) est sauté, sans rendre le dossier « introuvable ».
- ⚠️ **Une surveillance perdue se relance** toutes les 5 s (disque démonté
  un instant, dossier synchronisé, dossier absent au lancement) : l'état est
  diffusé entre-temps, et la surveillance revenue relit le dossier et
  l'export suivi.

## L'installeur

`npm run bureau:paquet` → dossier `paquets`, non suivi (`electron-builder.yml`) :

- **Deux plateformes : Windows et Linux.** Pas de macOS. Sous Linux,
  l'**AppImage** est le seul format qu'electron-updater sait mettre à jour
  (un `.deb` passe par le gestionnaire de paquets).
- **Windows** : assistant NSIS en français (`oneClick: false`) — pour qui
  (« juste pour moi » par défaut, `perMachine: false` : dans le profil,
  sans droits administrateur, et la mise à jour passe sans demande
  d'autorisation ; « tous les utilisateurs » la fait demander à chaque
  fois), quel dossier (`allowToChangeInstallationDirectory`), avancement ;
  désinstallation avec ses pages (bienvenue, avancement, fin). L'icône de
  l'app est sur l'exécutable, l'installeur et les raccourcis (`SW
  Blacksmith`). **Non signé** : Windows avertit au premier lancement (la
  page « Télécharger » dit comment passer). **Linux** : AppImage, icône
  `public/favicon.png`.
- **`appId` `com.swblacksmith.app` — définitif** : Windows et la mise à jour
  reconnaissent l'app par lui.
- Fichiers **sans numéro de version** (`SW-Blacksmith-Setup.exe`,
  `SW-Blacksmith.AppImage`) : seule adresse fixe pour
  `releases/latest/download`.
- Le paquet ne contient que `dist/`, les deux `.cjs` et `package.json`
  (aucun `node_modules`) ; l'icône Windows est `bureau/icone.ico`
  (`scripts/generer-icone-bureau.mjs`), petites tailles en BMP.
- **Une mise à jour garde les données** (l'ancien désinstalleur passe avec
  `--updated`) ; **une désinstallation efface tout** — données, raccourcis,
  copie de l'installeur gardée pour la mise à jour (`bureau/installeur.nsh`).

## La publication

Au **tag `v*`**, `.github/workflows/bureau.yml` construit l'installeur
Windows et l'AppImage, puis les attache à la release du tag **par `gh`** —
ajoutés à une release déjà rédigée (titre et notes intacts), ou dans un
brouillon créé sinon. La version de l'app est celle du tag. ⚠️ Pas par
electron-builder : il ignore sans échouer une release publiée depuis plus de
2 heures.

## La mise à jour

`bureau/miseAJour.ts`, avec electron-updater, dans l'app installée
seulement (`app.isPackaged` ; lancée par `bureau:local`, « Rechercher »
répond « à jour »). ⚠️ **L'utilisateur décide** : au lancement, une
recherche dans les releases GitHub, **rien ne se télécharge** sans
« Mettre à jour » (`autoDownload = false`, `downloadUpdate()` au clic ;
`autoInstallOnAppQuit = true`). Phases données à la page (`EtatMiseAJour`) :
`aucune`, `recherche`, `a-jour`, `injoignable`, `disponible`,
`telechargement`, `prete`, `echec` ; « Redémarrer » =
`quitAndInstall(true, true)`. Composants : `MiseAJourBureau` (la
notification), `BlocApplication` (Réglages).

- « Nouvelle version X disponible · Mettre à jour » — reste jusqu'à la
  réponse (notification `persistante`) ; puis « Téléchargement… », puis
  « Mise à jour prête · Redémarrer » ; sans redémarrage, installée à la
  fermeture. « Réessayer » si le téléchargement demandé échoue.
- **Remise à plus tard** : le bloc « Application » des Réglages garde
  l'offre, et peut relancer une recherche (« Rechercher »).
- **Jamais de bruit sans demande** : une recherche qui échoue au lancement
  ne dit rien ; tout va dans `mise-a-jour.log` (dossier des données).
- ⚠️ **Une recherche se conclut toujours** : quand `checkForUpdates` se
  termine sans aucun événement (il rend `null` quand electron-updater
  s'estime inactif, une AppImage extraite par exemple), elle passe en
  `injoignable` si on l'a demandée, sinon en `aucune` — jamais bloquée sur
  « Recherche… », que « Rechercher » refuserait de relancer.

## Le bloc « Application » des Réglages

`src/components/BlocApplication.tsx`, en dernier dans la liste des
réglages (`SettingsList` : menu ⚙ et page Paramètres), **dans l'app
seulement** (`estBureau()`) : sur le site, le bloc n'existe pas. Chaque
rangée a toujours une ligne de texte dessous (hauteur constante), et ses
boutons restent affichés, désactivés quand il n'y a rien à faire.

- **« Version X »** et UN bouton qui suit la phase de la mise à jour
  (`presentationMiseAJour`, pure) — largeur réservée, pour que « Rechercher »
  → « Recherche… » ne déplace pas le bouton cliqué :

  | Phase | Bouton | Ligne dessous |
  |-------|--------|---------------|
  | `aucune` (ou rien reçu) | Rechercher | Les nouvelles versions sont cherchées au lancement. |
  | `recherche` | Recherche… (désactivé) | Recherche d'une nouvelle version… |
  | `a-jour` | Rechercher | Tu as la dernière version. |
  | `injoignable` | Rechercher | Impossible de vérifier : pas de connexion ? |
  | `disponible` | Mettre à jour | Nouvelle version X disponible. |
  | `telechargement` | Téléchargement… (désactivé) | Téléchargement de la version X… |
  | `prete` | Redémarrer | Version X prête : installée au redémarrage, ou à la fermeture de l'app. |
  | `echec` | Réessayer | Le téléchargement n'a pas abouti. |

- **« Dossier SW Exporter »** — « Retirer » (désactivé sans dossier) et
  « Choisir… » ; dessous, le chemin, ou sans dossier : « Choisis le dossier
  où SW Exporter enregistre ses exports : « Mon compte » suivra chaque
  nouvel export. »
- **« Invocateur »** — un `Selecteur` (« Invocateur à suivre »), désactivé
  sans export ; dessous (`presentationSwex`, pure) : « Aucun dossier
  choisi. », « Dossier introuvable : vérifie qu'il existe encore, ou
  choisis-en un autre. », « Aucun export de compte à la racine de ce
  dossier. », « Choisis l'invocateur à suivre. », puis « Export du <date> —
  lu. » ou « … — lecture en cours… » tant que la page ne l'a pas confirmé.

## Vérifier

```
npm run bureau:preuve                  # l'app se contrôle elle-même (resultats.json)
npm run bureau:preuve -- --conservation  # les données et la session en cours survivent à la fermeture
npm run bureau:preuve -- --swex        # le dossier SW Exporter, sur des fixtures
npm run bureau:preuve -- --session     # « Sauvegarder », « Sauvegarder sous… », conservation refusée
npm run bureau:preuve -- <dossier> --exe "<app installée>"  # la même chose, sur l'app installée
npm run bureau:local                   # la regarder
node tests/run.mjs bureau              # protocole, fenêtre, mise à jour, noms de fichiers
```

Le mode preuve (`bureau/preuve.ts`, variables `SWBLACKSMITH_PREUVE` et
`SWBLACKSMITH_PREUVE_*`) vit dans ses propres données (`<dossier>/donnees`) :
il ne touche jamais celles de l'utilisateur. Il note les liens au lieu de
les ouvrir, range les téléchargements dans `<dossier>/telechargements` et
les sessions dans `<dossier>/swblacksmith/sessions` (le dossier SW
Blacksmith « choisi ») sans boîte de dialogue, simule la
mise à jour, se contrôle de l'intérieur,
écrit ses résultats en JSON puis quitte, sans capture d'écran ; le script
compare et rend 1 si un verdict échoue.
