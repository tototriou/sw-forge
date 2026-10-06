# Preuve — lot 5, la mise à jour automatique

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 5,
décision 10. Mené le 2026-10-06 sur `forge/application-bureau`, Electron
44.5.1, electron-updater 6.8.9.

## Ce qui a été construit

⚠️ **L'utilisateur décide** (Thomas, à l'arrêt avant commit : « il faut
demander à l'utilisateur avant de télécharger, c'est lui qui choisit ») :
la première version téléchargeait d'elle-même ; refaite. Ses réponses :
après le téléchargement, proposer « Redémarrer » ; la question reste
jusqu'à sa réponse.

- `bureau/miseAJour.ts` : au lancement de l'app INSTALLÉE,
  `checkForUpdates` sur les releases GitHub, **`autoDownload: false`** ;
  un état en quatre phases — `disponible` → (« Mettre à jour »)
  `telechargement` → `prete` (« Redémarrer » → `quitAndInstall(true,
  true)`, sinon installée à la fermeture), ou `echec` (« Réessayer »).
  Journal `mise-a-jour.log` (dossier des données, réécrit à chaque
  lancement), rien à l'écran tant qu'il n'a rien demandé.
- Préchargement : `miseAJour.etat()`, `surChangement()`, `telecharger()`,
  `redemarrer()`.
- Page : `suivreMiseAJour`, `telechargerMiseAJour`,
  `redemarrerPourMettreAJour` (`src/lib/bureau.ts`) ;
  `src/components/MiseAJourBureau.tsx`, monté dans `App.tsx`, dit chaque
  phase par la notification.
- Notification : deux axes — le libellé de l'action (`libelleAction`,
  « Annuler » par défaut ; le rappel `annuler` renommé `action`, quatre
  appels et le test suivis) et la durée (`persistante` : jusqu'à l'action
  ou la croix) ; `spec/shared/design.md` à jour.
- `electron-builder.yml` : `publish` écrit (github, `tototriou/sw-forge`),
  plus déduit du dépôt git.

## Preuve 1 — le chemin dans l'app, sans réseau (mode preuve)

`npm run bureau:preuve` — une version « 9.9.9 » simulée disponible :

```json
"miseAJour": {
  "avant": "aucune",
  "disponible": "Nouvelle version 9.9.9 disponible Mettre à jour",
  "disponibleApres7s": "Nouvelle version 9.9.9 disponible Mettre à jour",
  "telechargementsSansAccord": 0,
  "clicMettreAJour": "cliqué",
  "pendant": "Téléchargement de la mise à jour…",
  "telechargements": 1,
  "prete": "Mise à jour prête Redémarrer",
  "clicRedemarrer": "cliqué",
  "redemarrages": 1,
  "apresRechargement": "Mise à jour prête Redémarrer"
}
```

La question reste au-delà des 6 s (`persistante`), rien n'est téléchargé
avant « Mettre à jour », « Redémarrer » atteint le processus principal
(compté au lieu de redémarrer), et une page rechargée retrouve l'état
(`etat()`). Tous les contrôles des lots précédents passent. Non simulée :
la phase `echec`.

Premier passage : texte lu vide — la preuve visait la première zone
`role="status"`, et `App.tsx` en a une, toujours présente. Corrigé : la
notification se repère à sa croix « Fermer la notification ».

## Preuve 2 — le vrai chemin réseau, dans l'app installée

`essai-mise-a-jour.ps1` (scratchpad) : installation silencieuse, lancement
normal, 15 s, fermeture, journal, désinstallation.

```text
toujours ouverte après 15 s : True
info Checking for update
info Generated new staging user ID: …
erreur Error: Error: Cannot find latest.yml in the latest release artifacts
  (https://github.com/tototriou/sw-forge/releases/download/v1.14.0/latest.yml): HttpError: 404
reste : programme=False donnees=False cache=False
```

`app-update.yml` lu, GitHub interrogé, la dernière release (v1.14.0, sans
`latest.yml`) refusée proprement : l'app reste ouverte, rien à l'écran.
Rejoué après la refonte « l'utilisateur décide » : même journal.
Premier passage : la même erreur écrite **trois fois** (journal
d'electron-updater, événement `error`, rejet de `checkForUpdates`) ; les
deux derniers écouteurs sont désormais muets — une ligne.

## Preuve 3 — tests et build

- `node tests/run.mjs bureau notification refonteinventaire` → **95
  passées** (dont : « Redémarrer » remplace « Annuler », pas les deux ;
  « Annuler » par défaut).
- `npx tsc --noEmit`, `npm run build` : sans erreur.
- `electron-updater` est dans `main.cjs` (esbuild) : aucun `require` restant,
  `app.asar` sans `node_modules` (14,7 Mo).

## Ce qui n'est pas prouvé (décision 10)

- **Le passage réel N → N+1** : question, téléchargement, installation au
  redémarrage ou à la fermeture, données gardées. À constater à la
  première version publiée après la v2.0.0, avec `mise-a-jour.log`.
- **La phase `echec`** (« Réessayer ») : jamais provoquée.
- **Sous Linux** (AppImage), la mise à jour ne marche que lancée depuis
  l'AppImage elle-même : jamais essayée.
- **Une installation « tous les utilisateurs »** : la mise à jour y demande
  les droits administrateur.
- **Une session longue** : la recherche n'a lieu qu'au lancement.
