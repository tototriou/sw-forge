# Preuve — lot 4, l'action GitHub au tag

**Statut :** CHANTIER en cours — branche forge/application-bureau

Chantier [application-bureau.md](../application-bureau.md), lot 4,
décision 9. Mené le 2026-10-06 sur `forge/application-bureau`.

## Relevé

- Releases du dépôt rédigées et publiées **à la main** (`gh release list` ;
  v1.14.0 publiée le 2026-10-05 par enzoputzulu, aucun fichier attaché).
- Actions autorisées, jeton par défaut en écriture
  (`gh api …/actions/permissions/workflow` → `"default_workflow_permissions":"write"`).
- electron-builder (`electron-publish/out/gitHubPublisher.js`, l. 58–110) :
  vise le tag `v` + la version de package.json ; une release publiée
  depuis plus de 2 heures → `log.warn("GitHub release not created")` et
  `return null` — **aucun échec**. D'où la décision 9 : `gh` attache.

## Ce qui a été construit

`.github/workflows/bureau.yml` : au tag `v*` (et `workflow_dispatch` avec le
tag, une fois sur `main`) ; matrice `windows-latest` / `ubuntu-latest` —
`npm ci`, version prise du tag (avertissement si package.json diffère),
`npm run bureau:paquet` (sans publier), fichiers gardés un jour ; puis
`publier` : release du tag trouvée → fichiers ajoutés, titre et notes
intacts ; absente → brouillon (`--verify-tag`) ; `gh release upload --clobber`.

## Preuve 1 — l'action relue

- `actionlint` 1.7.12 sur `bureau.yml` et `update-data.yml` : aucune
  remarque (sans ShellCheck, absent de la machine : le shell n'est pas
  analysé).
- YAML lu (`js-yaml`) : déclencheurs `push.tags: v*` et `workflow_dispatch`,
  `publier` attend `construire`, `contents: write`.
- Motifs Windows confrontés au `paquets/` du lot 3 : pris
  `SW-Blacksmith-Setup-1.14.0.exe`, `.exe.blockmap`, `latest.yml` — et rien
  d'autre (`builder-debug.yml`, `win-unpacked/` écartés). `latest.yml`
  désigne `SW-Blacksmith-Setup-1.14.0.exe`, le nom attaché tel quel.

## Ce qui n'est pas prouvé (décision 9)

- **Aucune exécution** : la première est celle du tag `v2.0.0`. Son journal
  et la liste des fichiers attachés s'ajoutent ici à la publication.
- **La moitié Linux n'a jamais été construite** : ni Docker (arrêté) ni WSL
  (absent) sur la machine. Si l'AppImage ou `latest-linux.yml` manque,
  `if-no-files-found: error` fait échouer l'action — l'installeur Windows
  n'est alors PAS attaché non plus (`publier` attend les deux).
- **Le brouillon créé par l'action** et l'ajout à une release publiée : les
  deux chemins de `publier`, jamais exécutés.
- **SmartScreen** sur un installeur téléchargé : à la publication.
