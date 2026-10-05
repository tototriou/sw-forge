# Preuve — lot 1, la coquille Electron

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 1. Mené le
2026-10-05 sur `forge/application-bureau`, depuis `ea661ac2`, sous Windows 11,
Electron 44.5.1 (version exacte dans `package.json`).

## Ce qui a été construit

- `bureau/main.ts` — fenêtre, protocole `app://swblacksmith/` (déclaré
  `standard`, `secure`, `supportFetchAPI`, `corsEnabled`, `stream`),
  `contextIsolation` / `sandbox` / pas de `nodeIntegration`.
- `bureau/protocole.ts` — `cheminDuFichier`, PUR, testé.
- `bureau/preload.ts` — un seul objet figé, `swblacksmithBureau`.
- `bureau/preuve.ts` — mode preuve (`SWBLACKSMITH_PREUVE`), voir plus bas.
- `scripts/construire-bureau.mjs` (esbuild → `dist-bureau/`),
  `scripts/bureau-dev.mjs`, `scripts/bureau-local.mjs`,
  `scripts/bureau-preuve.mjs`, `scripts/lib/electron.mjs`.
- Scripts npm `bureau`, `bureau:construire`, `bureau:local`,
  `bureau:preuve` ; `package.json` `main` → `dist-bureau/main.cjs`.

## Preuve 1 — l'app se contrôle elle-même

```
npx vite build && node scripts/construire-bureau.mjs && node scripts/bureau-preuve.mjs
```

Sortie (`resultats.json`, relevée de l'intérieur de la page) :

```json
{
  "origine": "app://swblacksmith",
  "titre": "SW Blacksmith — Boîte à outils Summoners War",
  "stockage": true,
  "prechargement": "{\"bureau\":true,\"plateforme\":\"win32\"}",
  "nodeDansLaPage": "undefined / undefined",
  "fetchDonnees": 200,
  "horsRacineEncode": 404,
  "worker": "ok : runeBuildOptim.worker-CGsxgmW5.js",
  "bestiaire": "2 859 monstres"
}
```

| Contrôle | Attendu | Lu |
|----------|---------|----|
| Origine stable | `app://swblacksmith` | ✓ |
| `localStorage` | écrit et relu | ✓ |
| Préchargement | objet figé, rien d'autre | ✓ |
| Node dans la page | `require` et `process` absents | ✓ `undefined / undefined` |
| `fetch` des données | 200 | ✓ |
| Fichier hors du build (`/..%2Fpackage.json`, qui existe à la racine du dépôt) | refusé | ✓ 404 |
| Worker module de l'Optimizer | démarre sans erreur | ✓ |
| Bestiaire | données affichées | ✓ « 2 859 monstres » |

Captures : [lot-1-accueil.png](lot-1-accueil.png) (accueil, logo, barre
latérale), [lot-1-bestiaire.png](lot-1-bestiaire.png) (2 859 monstres et
leurs portraits, chargés par `fetch`).

## Preuve 2 — la frontière du protocole

```
node tests/run.mjs bureau
```

→ `19 vérifications passées` : six adresses servies au bon fichier, onze
formes d'évasion qui restent dans le build ou sont refusées, deux refus
exigés de la fonction elle-même (`..%2F`, `..%5C`).

## Écarts au contrat, et ce qui n'est pas prouvé

- **`ELECTRON_RUN_AS_NODE`** : le terminal de VS Code (lui-même une app
  Electron) la pose à 1 ; héritée, Electron démarrait comme Node. Tous les
  lancements passent par `scripts/lib/electron.mjs`, qui la retire — d'où
  `bureau:local` par un script Node plutôt que `electron .`.
- **`%2e%2e` seul n'est pas une évasion** : l'analyse standard de l'URL le
  résout comme `..` et retombe dans le build. Le contrat disait « refusé » :
  le test exige maintenant « jamais hors du build », et le refus par la
  fonction pour la forme qui le requiert (`..` + barre encodée).
- **Une recherche complète de l'Optimizer n'est pas prouvée** : elle demande
  un compte importé. Le worker démarre ; la recherche elle-même sera essayée
  à la vérification à l'écran (lot 2, import d'un compte).
- `npm run bureau` (serveur de dev) n'a pas été lancé dans cette preuve.
