# Preuve — lot 3, l'empaquetage Windows et Linux

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 3, décisions 3
et 8. Mené le 2026-10-06 sur `forge/application-bureau`, depuis `4a140d7`,
sous Windows 11, Electron 44.5.1, electron-builder 26.15.3.

## Ce qui a été construit

- `electron-builder.yml` : `appId` `com.swblacksmith.app`, nom
  `SW Blacksmith` (aussi écrit dans le package.json EMBARQUÉ, sans quoi l'app
  s'appelait `swblacksmith`), cibles NSIS (assistant en français : pour qui,
  quel dossier, avancement ; désinstallation avec ses pages) et AppImage,
  sortie `paquets/`.
- `bureau/icone.ico`, produite par `scripts/generer-icone-bureau.mjs` depuis
  `public/favicon.png` (voir preuve 4).
- `bureau/installeur.nsh` : la désinstallation efface aussi la copie de
  l'installeur gardée pour la mise à jour (voir preuve 3).
- `npm run bureau:paquet` ; `bureau:preuve --exe <chemin>` rejoue la preuve
  sur l'app installée.
- `package.json` : `author` (l'éditeur affiché par Windows),
  `electron-builder` 26.15.3 exact.

## Preuve 1 — le paquet

`npm run bureau:paquet`, puis lecture de `app.asar` (`@electron/asar`) :

| Mesure | Valeur |
|--------|--------|
| `SW-Blacksmith-Setup-1.14.0.exe` | **112,9 Mo**, `NotSigned` (décision 2) — un clic comme assistant |
| installé (`win-unpacked`) | 399,0 Mo, dont `app.asar` 14,1 Mo |
| `app.asar` | 3 172 entrées : `dist/` 3 168, `dist-bureau/` 3 (`main.cjs`, `preload.cjs` et le dossier), `package.json` |
| `node_modules` dans le paquet | **0** |
| `resources/app-update.yml` | `provider: github`, `tototriou/sw-forge` (déduit du dépôt, pour le lot 5) |

Deux défauts trouvés au premier paquet et corrigés : le dossier de preuve
(`dist-bureau/preuve/`, captures et profil Chromium) était embarqué — 28,2 Mo
d'`app.asar` ; et `productName` manquait au package.json embarqué.

`package-lock.json` : 205 paquets avant, 470 après ; aucune version ni
empreinte changée, aucun disparu, les 265 ajoutés sont tous `dev`.

## Preuve 2 — l'app installée se contrôle elle-même

`node scripts/bureau-preuve.mjs <dossier> --exe "%LOCALAPPDATA%\Programs\swblacksmith\SW Blacksmith.exe"`
(installeur en un clic, première version du lot : le paquet `app.asar` est
le même ensuite — 3 172 entrées, 14,1 Mo — seuls l'icône de l'exécutable et
l'installeur ont changé)

```json
"empaquetee": true, "nomApp": "SW Blacksmith", "ouverteReduite": false,
"origine": "app://swblacksmith", "stockage": true,
"nodeDansLaPage": "undefined / undefined", "fetchDonnees": 200,
"horsRacineEncode": 404, "worker": "ok : runeBuildOptim.worker-CGsxgmW5.js",
"zoneDeplacement": "drag", "boutonCliquable": "no-drag",
"margeBoutonsWindows": "137px", "menu": "aucun",
"fenetre-dark": "ok", "fenetre-light": "ok",
"liensExternes": { "cliques": 29, "confiesAuNavigateur": 29, "manquants": [] },
"navigationFichier": { "ouvertDehors": false },
"navigationWeb": { "confieAuNavigateur": true },
"telechargement": "{\"preuve\":\"lot 2\"}", "bestiaire": "2 859 monstres"
```

Tous les contrôles des lots 1, 1 bis et 2 passent dans l'app EMPAQUETÉE :
le protocole sert bien depuis `app.asar`, le worker démarre. Capture :
[lot-3-installee.png](lot-3-installee.png).

⚠️ Les deux premiers passages, juste après l'installation, ont donné
`margeBoutonsWindows: 0px` et « fenêtre introuvable » : la fenêtre était
**réduite** (rectangle `-32000,-32000` relevé sur un lancement par
`Start-Process`). Windows impose au premier affichage l'état demandé par le
processus lanceur, ici un shell caché. Les trois passages suivants : jamais
réduite, tout passe. Cause exacte des deux premiers non établie ; la preuve
note désormais `ouverteReduite` et rouvre la fenêtre. À l'écran (Thomas,
installeur en un clic) : « ok super pour l'installation ».

## Preuve 3 — installation, mise à jour, désinstallation

`cycle-installation.ps1` (scratchpad), installeur en silencieux (`/S`),
rejoué tel quel avec l'installeur en un clic puis avec l'assistant — mêmes
résultats :

| Étape | Programme | Données (`%APPDATA%\SW Blacksmith`) | Cache (`%LOCALAPPDATA%\swblacksmith-updater`) | Raccourcis bureau / menu | « Applications installées » |
|-------|-----------|------|------|------|------|
| départ | non | 0 | — | non / non | 0 |
| installée, lancée, fermée | oui | 80 fichiers + témoin | oui | oui / oui | 1 |
| réinstallée par-dessus | oui | **80 + témoin** | oui | oui / oui | 1 |
| désinstallée | non | **0** | **non** | non / non | 0 |

Entrée Windows : « SW Blacksmith 1.14.0 », éditeur « SW Blacksmith »,
installée par défaut dans `%LOCALAPPDATA%\Programs\SW Blacksmith`
(`…\swblacksmith` avec l'installeur en un clic).

- **Décision 8, données gardées par une mise à jour** : une installation
  par-dessus appelle l'ancien désinstalleur avec `--updated`
  (`installUtil.nsh` l. 205–206), et la suppression est gardée par
  `${ifNot} ${isUpdated}` (`uninstaller.nsh` l. 224). Constaté : 80
  fichiers et le témoin survivent.
- **Le cache de la mise à jour** : l'installeur se recopie (113 Mo) dans
  `swblacksmith-updater\installer.exe` (`installer.nsh` l. 93), et le
  désinstalleur d'origine ne l'effaçait pas — constaté au premier cycle.
  `bureau/installeur.nsh` l'efface, sauf pendant une mise à jour.
- **Effet de bord** : la désinstallation efface aussi `%APPDATA%\swblacksmith`,
  les données de `npm run bureau:local` (nom du package), ce qui ne concerne
  qu'une machine de développement. Sauvegardées puis restaurées ici
  (1 473 fichiers).

## Preuve 4 — l'icône et l'assistant (retour de Thomas à l'écran)

Retour de la première séance d'écran : « il manque l'icône de l'appli »,
« laisse le choix à l'utilisateur d'où il veut installer », « pour la
désinstallation affiche une fenêtre d'avancement » → décision 8 amendée.

- **Icône** : electron-builder convertissait `favicon.png` en un `.ico`
  dont les 7 tailles sont en PNG ; Windows n'en lit aucune en petit
  (icône générique, relevé par `System.Drawing.Icon.ExtractAssociatedIcon`).
  `electron.exe` : 16, 32, 48 en BMP, 256 seule en PNG. `bureau/icone.ico`
  suit ce modèle — 16, 20, 24, 32, 40, 48, 64 en BMP 32 bits, 256 en PNG,
  57 876 octets. Relu dans les deux exécutables (`resedit`) : 7 BMP + 1 PNG ;
  icône extraite par Windows : l'enclume, cristal orange (ordre BGRA juste).
- **Assistant** : `oneClick: false`, `allowToChangeInstallationDirectory`.
  Première page capturée : [lot-3-assistant.png](lot-3-assistant.png) —
  « Choisis les options d'installation », « Juste pour moi (Thomas) » coché.
  La page du désinstalleur n'a pas pu être capturée (recouverte par une
  autre fenêtre) : ses pages (bienvenue, avancement, fin) viennent du
  gabarit `assistedInstaller.nsh`, à voir à l'écran.
- **Installée « pour tous les utilisateurs »**, la copie de l'installeur
  reste dans le profil : `installeur.nsh` repasse dans ce contexte pour
  l'effacer. Non essayé (demande les droits administrateur).

## Ce qui n'est pas prouvé

- **La vraie mise à jour N → N+1** : la réinstallation porte la même version
  (1.14.0). Le chemin est le même (`--updated`), la preuve complète est celle
  du lot 5.
- **L'assistant page par page** et la désinstallation avec sa fenêtre :
  seulement la première page de l'installeur ici, le reste à l'écran.
- **Une installation « pour tous les utilisateurs »** (dans Program Files) :
  sa mise à jour demandera les droits administrateur à chaque fois.
- **L'avertissement SmartScreen** : un fichier construit sur la machine ne
  porte pas la marque « téléchargé d'Internet » ; il ne se voit qu'avec
  l'installeur publié (lot 4).
- **L'AppImage** : se construit sous Linux, preuve au lot 4 (CI).
