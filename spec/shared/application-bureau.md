# L'application de bureau (Windows, Linux)

SW Blacksmith existe aussi en **application de bureau**, construite avec
**Electron** : la même app que le site, dans sa propre fenêtre, installée
sur la machine. Chantier et décisions : [application-bureau.md](../chantiers/application-bureau.md).

Code : **`bureau/`** (processus principal, hors de `src/` : il tourne dans
Node), `src/lib/bureau.ts` (ce que la page en sait), `electron-builder.yml`
(l'empaquetage), `.github/workflows/bureau.yml` (la publication). Carte des
fichiers : [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Un seul code

⚠️ **Aucune fonctionnalité ne s'écrit deux fois.** La fenêtre affiche le
build Vite (`dist/`) tel quel ; seul ce que le navigateur ne sait pas faire
est propre au bureau. Une ligne propre au bureau se lit derrière
`estBureau()` (le préchargement a posé `swblacksmithBureau`) ; le site ne
change pas. Ce qui en dépend aujourd'hui :

| Sur le site | Dans l'app |
|-------------|-----------|
| Page « Télécharger », son entrée sous Ressources, le bouton et la carte de l'accueil ([telecharger.md](../telecharger.md)) | absents ; `#/telecharger` mène à l'accueil |
| — | bloc « Application » des Réglages : version et mise à jour |
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
- **La fenêtre** (`bureau/fenetre.ts`, pur) : barre de titre intégrée — la
  barre du haut de l'app sert de zone de déplacement, les boutons de Windows
  sont dessinés aux couleurs du thème (47 px) ; taille, position et état
  agrandi mémorisés (une fenêtre hors de tout écran revient sur l'écran
  principal) ; pas de menu ; fond au thème dès l'ouverture.
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
- `npm run bureau:local` garde ses données à part (`%APPDATA%\swblacksmith`,
  nom npm) : il ne touche jamais celles de l'app installée.
- **Données du jeu** : celles de l'installeur, rafraîchies à chaque version
  ([donnees-monstres.md](donnees-monstres.md), « Chargement côté app »).

## L'installeur

`npm run bureau:paquet` → `paquets/` (`electron-builder.yml`) :

- **Windows** : assistant NSIS en français — pour qui (« juste pour moi »
  par défaut, sans droits administrateur), quel dossier, avancement ;
  désinstallation avec ses pages. **Non signé** : Windows avertit au premier
  lancement (la page « Télécharger » dit comment passer). **Linux** :
  AppImage.
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

`bureau/miseAJour.ts`, dans l'app installée seulement. ⚠️ **L'utilisateur
décide** : au lancement, une recherche dans les releases GitHub, **rien ne
se télécharge** sans « Mettre à jour ».

- « Nouvelle version X disponible · Mettre à jour » — reste jusqu'à la
  réponse (notification `persistante`) ; puis « Téléchargement… », puis
  « Mise à jour prête · Redémarrer » ; sans redémarrage, installée à la
  fermeture. « Réessayer » si le téléchargement demandé échoue.
- **Remise à plus tard** : le bloc « Application » des Réglages garde
  l'offre, et peut relancer une recherche (« Rechercher »).
- **Jamais de bruit sans demande** : une recherche qui échoue au lancement
  ne dit rien ; tout va dans `mise-a-jour.log` (dossier des données).

## Vérifier

```
npm run bureau:preuve                  # l'app se contrôle elle-même (resultats.json)
npm run bureau:preuve -- --conservation  # les données survivent à la fermeture
npm run bureau:preuve -- <dossier> --exe "<app installée>"  # la même chose, sur l'app installée
npm run bureau:local                   # la regarder
node tests/run.mjs bureau              # protocole, fenêtre, mise à jour, noms de fichiers
```

Le mode preuve (`bureau/preuve.ts`) vit dans ses propres données
(`<dossier>/donnees`) : il ne touche jamais celles de l'utilisateur.
⚠️ Lancé depuis un terminal de VS Code, Electron hérite
`ELECTRON_RUN_AS_NODE` et démarre comme un simple Node :
`scripts/lib/electron.mjs` la retire — tout lancement passe par lui.
