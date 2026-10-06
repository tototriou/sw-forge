# Preuve — lot 2, le web dans la coquille

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 2. Mené le
2026-10-06 sur `forge/application-bureau`, depuis `e3d70d44`, sous Windows 11,
Electron 44.5.1.

## Relevé (`git grep`, au début du lot)

- **6 liens externes** `target="_blank"` dans le source : SWARFARM, GitHub,
  Discord (pied de page, `App.tsx`), SW Exporter (`HomePage.tsx`), dépôt et
  versions (`ReleasesPage.tsx`, dont un lien PAR version publiée).
- **5 téléchargements** `a.download` sur un Blob : `RunesCompare.tsx`,
  `OptimizerSection.tsx`, `RtaBackupBar.tsx`, `RecoBoard.tsx`,
  `SiegeBoard.tsx` — tous construits de la même façon.

## Ce qui a été construit

- `bureau/protocole.ts` : `estAdresseInterne` (protocole maison, ou serveur
  Vite en dev, même origine) et `ouvrableDehors` (`http`/`https` seulement),
  PURES et testées.
- `bureau/navigation.ts` : `setWindowOpenHandler` (jamais de seconde fenêtre,
  lien confié au navigateur du système), `will-navigate` (toute navigation
  hors de l'app bloquée ; ouverte dehors si c'est un lien web),
  `will-download` (boîte « Enregistrer le fichier », dans Téléchargements,
  avec le nom proposé par l'app). En mode preuve : liens notés, fichiers
  rangés dans le dossier de preuve.

## Preuve 1 — l'app se contrôle elle-même

`npx vite build && node scripts/construire-bureau.mjs && node scripts/bureau-preuve.mjs`

```json
"liensExternes": { "cliques": 29, "confiesAuNavigateur": 29, "manquants": [],
  "exemples": ["https://github.com/Xzandro/sw-exporter", "https://swarfarm.com/",
    "https://github.com/tototriou/sw-forge", "https://discord.gg/R2Fe4GJZET",
    "https://github.com/tototriou/sw-forge/releases",
    "https://github.com/tototriou/sw-forge/releases/tag/v1.14.0"],
  "appToujoursLa": "app://swblacksmith" },
"navigationFichier": { "origine": "app://swblacksmith", "ouvertDehors": false },
"navigationWeb": { "origine": "app://swblacksmith", "confieAuNavigateur": true },
"telechargement": "{\"preuve\":\"lot 2\"}"
```

- 29 liens distincts (les 6 du source, dont un par version publiée sur la
  page Nouveautés), tous cliqués, tous confiés au navigateur, aucun manquant,
  l'app toujours en place.
- Vers `file:///C:/Windows/win.ini` : bloqué, rien d'ouvert.
- Vers `https://example.com/` : bloqué, confié au navigateur.
- Un téléchargement construit comme les cinq exports : le fichier arrive,
  nom et contenu exacts.
- Lots 1 et 1 bis rejoués : inchangés.

## Preuve 2 — tests

`node tests/run.mjs bureau` → **52 passées** (dont 14 nouvelles : ce qui
reste dans l'app, dont un autre port en dev ; ce qui ne part JAMAIS au
système : `file:`, `javascript:`, `ms-settings:`, `mailto:`).

## Preuve 3 — à l'écran (Thomas, 2026-10-06)

`npm run bureau:local`, liste de six points : liens SW Exporter, GitHub et
Discord ouverts dans le navigateur, l'app en place ; import d'un export SWEX
au clic et par glisser-déposer ; le même fichier déposé à côté de la zone,
l'app reste ; export d'une prépa RTA par la boîte « Enregistrer le fichier »
dans Téléchargements, nom en `swblacksmith-prepa-rta-…` ; une recherche de
l'Optimizer qui rend des résultats. Réponse : « c'est tout bon ».

## Ce qui n'est pas prouvé

- **Automatiquement**, la vraie boîte « Enregistrer sous », l'import d'un
  compte et la recherche complète de l'Optimizer : le mode preuve ne les
  rejoue pas. Ils ne le sont qu'à l'écran (preuve 3), une fois, sous
  Windows ; Linux attend le lot 3 (AppImage).
