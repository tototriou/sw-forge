# Cadrage — l'application de bureau (Electron)

**Statut :** CHANTIER en cours — branche forge/application-bureau

## Partie A — préambule commun (le brief de chaque lot)

### A.1 Pourquoi

Thomas veut proposer SW Blacksmith **en application de bureau** à ceux qui la
veulent en local (2026-10-04), et la faire entrer **dans la 2.0.0**
(2026-10-05). Choix faits avant ce cadrage, avec Thomas :

- **Electron**, pas Tauri ni une PWA (2026-10-04) : tout reste en
  TypeScript / Node comme le reste du dépôt, Chromium embarqué = même rendu
  partout, outillage mûr. Coût accepté : ~100–150 Mo, plus de mémoire.
- **Un seul code** : l'application emballe le build Vite ; aucune
  fonctionnalité ne se développe deux fois. Seul ce que le navigateur ne sait
  pas faire est propre au bureau.
- **Le `.exe` n'entre ni dans git ni dans le site** (hook `pre-commit` :
  refus au-delà de 5 Mo) : il est construit par une action GitHub au tag et
  attaché à la release GitHub ; le site pointe dessus.
- **Mise à jour automatique** (2026-10-05) : `electron-updater` lit les
  releases GitHub — téléchargement en fond, redémarrage **proposé**, jamais
  imposé. Exige un **installeur** (NSIS), pas un `.exe` portable.

Mesuré le 2026-10-05 sur `release/v2.0.0` (`79b8063b`) :

| Fait | Mesure | Conséquence |
|------|--------|-------------|
| Dépôt `tototriou/sw-forge` | `gh repo view` → `PUBLIC` | l'updater lit les releases sans jeton |
| `import.meta.env.BASE_URL` | 19 usages dans `src/` (`git grep`) | l'app doit être servie à la RACINE d'une origine : pas de `file://` |
| Données chargées par `fetch` | `useMonsters.ts`, `monsterSkills.ts` | idem |
| Workers | 4 `new Worker(new URL(…, import.meta.url))` | l'origine doit autoriser les workers module |
| Liens externes | 6 (`target="_blank"`, `window.open`) | à ouvrir dans le navigateur du système |
| Téléchargements | 5 (`download=` / `.download =`) | comportement Electron à vérifier |
| Mesure d'audience | `@vercel/analytics` dans `Analytics.tsx` | n'a pas de sens hors du site |
| Build | `dist` 19 Mo, dont `public/data` 16 Mo, 3 074 fichiers | taille de l'installeur |
| Versions | electron 44.5.1, electron-builder 26.15.3, electron-updater 6.8.9 (`npm view`) | à figer au lot 1 |
| Stockage | origine du site ≠ origine de l'app | données séparées : on passe par les exports |

### A.2 Cible et périmètre

**Cible**, vérifiable :
- `npm run bureau` lance l'app de bureau sur le serveur de dev ; `npm run
  bureau:paquet` produit un installeur Windows ;
- au tag `v*`, une action GitHub construit l'installeur et l'attache à la
  release, avec le `latest.yml` de l'updater ;
- l'app installée se met à jour seule ;
- le site propose « Télécharger pour Windows », que l'app ne montre pas ;
- spec d'état actuel `spec/shared/application-bureau.md`, `ARCHITECTURE.md`,
  `CLAUDE.md` (« Vérifier ») et notes de la 2.0.0 à jour.

**Hors périmètre** : renommer le dépôt ou l'URL (décision 66 d du
rebranding) ; une app mobile ; toute modification d'un écran au-delà de ce
qu'un lot nomme ; l'import automatique du dossier SWEX tant que la question
Q4 n'est pas tranchée.

**Intouchable** : le rendu et le comportement du site. Une ligne propre au
bureau se lit derrière `estBureau()` (lot 2) ; le site ne change pas.

### A.3 Hiérarchie des priorités

1 ne rien perdre (données de l'utilisateur, fonctions du site) · 2 sécurité
(contexte isolé, pas de Node dans la page) · 3 erreurs observables · 4 un
seul code · 5 taille et temps de build. Un chiffre (taille, durée) est un
constat, jamais une consigne de coupe.

### A.4 Catégories de lots

Celles du dépôt (`cadrage-chantier`) : M mécanique, C classification, J
jugement. M → Sonnet effort bas, C → Sonnet moyen, J → Opus élevé
(`.claude/agents/lot-*.md`).

### A.5 Branche, fichiers transverses

Branche `forge/application-bureau`, **partie de `release/v2.0.0`**
(`79b8063b`) et refusionnée dedans à la fin : la 2.0.0 se publie avec le
bureau. Fichiers transverses portés par ce chantier : `package.json`,
`package-lock.json`, `.gitignore`, `tsconfig.json`, `vite.config.ts`,
`.github/workflows/`, `ARCHITECTURE.md`, `CLAUDE.md`, `src/main.tsx`,
`src/components/Analytics.tsx`. Aucun autre chantier ouvert ne les porte.

Code du bureau dans **`bureau/`** (processus principal, préchargement), à la
racine, hors de `src/` : il tourne dans Node, pas dans la page. Sorties
gitignorées : `dist-bureau/` (code compilé), `paquets/` (installeurs).

### A.6 Si une vérification échoue, si un cas est ambigu

Vérification échouée → pas de commit. Cas non prévu → on garde le
comportement du site, on l'écrit dans « Points ouverts » (A.8) et dans le
rapport. Jamais de `nodeIntegration`, jamais de `webSecurity: false` pour
« faire marcher » quelque chose : on s'arrête et on le dit.

### A.6 bis Preuves

`spec/chantiers/application-bureau-preuves/lot-<n>.md` : H1, en-tête
`**Statut :** ARCHIVE de preuve — lot <n>`, commandes, sorties, captures
(sous 5 Mo). Le message de commit cite le fichier de preuve.

### A.7 Ordre, dépendances, suivi

`A → B : B requiert A`.

```text
1 → 2 (le préchargement et estBureau() vivent dans la coquille)
1 → 3 (on empaquette la coquille)
3 → 4 (la CI rejoue l'empaquetage local)
4 → 5 (l'updater lit ce que la CI publie)
2 → 6 (le bouton se cache dans l'app grâce à estBureau())
Q1 → 7 (les données dépendent du choix de Thomas)
{1 … 7} → 8 (clôture)
```

| Lot | Cat. | Statut | Commit / date |
|-----|------|--------|---------------|
| 1 coquille Electron | J | à faire | |
| 2 le web dans la coquille (liens, téléchargements, audience, `estBureau`) | J | à faire | |
| 3 empaquetage Windows (NSIS) et Linux (AppImage) | M | à faire | |
| 4 action GitHub au tag | J | à faire | |
| 5 mise à jour automatique | J | à faire | |
| 6 « Télécharger pour Windows » sur le site | J | à faire | |
| 7 données du jeu — dans l'installeur (décision 1), une phrase de spec | M | à faire | |
| 8 clôture : spec d'état actuel, docs, `npm test`, fusion dans `release/v2.0.0` | M | à faire | |

### A.8 Questions ouvertes et décisions

**Décisions de Thomas (2026-10-05)** :

1. **Q1 → (a)** : les données du jeu sont **dans l'installeur** et se mettent
   à jour avec l'app. Le lot 7 se réduit à le dire dans la spec.
2. **Q2 → (a)** : **pas de signature** ; une phrase d'explication à côté du
   bouton (« Informations complémentaires → Exécuter quand même »). Signer
   plus tard ne change rien d'autre.
3. **Q3 → Windows + Linux** : installeur NSIS pour Windows, **AppImage** pour
   Linux — seul format Linux que `electron-updater` met à jour (un `.deb`
   passe par le gestionnaire de paquets). macOS hors périmètre.
4. **Q4 → plus tard** : l'import automatique du dossier SWEX est un chantier
   à part, hors 2.0.0.

Restent ouvertes **Q5** (lot 6) et **Q6** (lot 2) ci-dessous.

Les lots 1 à 3 n'en dépendent pas ; chacune bloque le lot indiqué.

- **Q1 → lot 7. Les données du jeu** (`public/data`, rafraîchies chaque
  semaine par `update-data.yml`). (a) Figées dans l'installeur, mises à jour
  avec l'app ; (b) téléchargées depuis le site au lancement, repli sur
  l'embarqué hors ligne. Recommandation : (a) — l'app se met à jour seule,
  et (b) dépend de l'URL qui va changer.
- **Q2 → lot 4. SmartScreen.** Sans signature, Windows avertit au premier
  lancement. (a) Pas de signature, une phrase d'explication à côté du
  bouton ; (b) Azure Trusted Signing (~10 $/mois) ; (c) certificat classique.
- **Q3 → lots 3 et 4. Plateformes.** Windows seul, ou aussi macOS / Linux
  (même action, une matrice ; macOS non signé est encore plus bloqué).
- **Q4 → hors lot. Import automatique du dossier SWEX** : dans ce chantier
  (un lot 9) ou plus tard.
- **Q5 → lot 6. Où vit le bouton** : accueil seulement, ou aussi barre
  latérale / Nouveautés.
- **Q6 → lot 2. Mesure d'audience dans l'app** : coupée (recommandé : elle
  n'a de sens que pour le site, et « 100 % local »), ou gardée.

## Partie B — les lots

### Lot 1 — la coquille Electron · J

**Intrant** : ce cadrage (A), `package.json`, `vite.config.ts`,
`src/main.tsx` (l. 1–40), `index.html`, la doc Electron des protocoles
(`protocol.handle`, `registerSchemesAsPrivileged`).

**Sortie** : `bureau/main.ts`, `bureau/preload.ts`,
`scripts/construire-bureau.mjs` (esbuild → `dist-bureau/`) ; scripts npm
`bureau` (lance Vite puis Electron sur `http://localhost:5173`) et
`bureau:local` (Electron sur le build) ; dépendances `electron` (version
exacte, figée), `esbuild` déjà présent.

**Contrat** :
- Une fenêtre, titre `NOM_APP`, icône `public/favicon.png`.
- Build servi par un protocole maison **`app://swblacksmith/`**, déclaré
  `standard`, `secure`, `supportFetchAPI`, `corsEnabled` : `BASE_URL` (`/`),
  `fetch` des données et workers module marchent sans toucher `src/`.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` ;
  le préchargement n'expose qu'un objet figé par `contextBridge`.
- Fonction pure `cheminDuFichier(url, racine)` (URL du protocole → fichier
  de `dist/`) qui **refuse toute sortie de la racine** (`..`, encodages) ;
  testée dans `tests/` (`bureau-protocole`).

**Preuve** : `lot-1.md` — `npm run bureau:local` ouvre l'accueil ; une page
qui `fetch` (Bestiaire) et une qui lance un worker (Optimizer, une
recherche) marchent ; capture ; `node tests/run.mjs bureau` vert, dont un
cas `app://swblacksmith/../package.json` refusé.

**Ne fait pas** : liens externes, téléchargements, empaquetage, CI.

### Lot 2 — le web dans la coquille · J

**Intrant** : A, `bureau/`, les 6 liens externes et les 5 téléchargements
relevés par `git grep` (A.1), `src/components/Analytics.tsx`.

**Sortie** : `estBureau()` (`src/lib/bureau.ts`, lit l'objet du
préchargement, `false` sur le site) ; liens externes ouverts dans le
navigateur du système (`setWindowOpenHandler`, `will-navigate` hors
`app://`) ; téléchargements avec boîte « Enregistrer sous » ; audience
selon Q6.

**Preuve** : `lot-2.md` — chacun des 6 liens et 5 téléchargements essayé
dans l'app, un par ligne, avec le résultat ; import d'un compte SWEX par le
bouton et par glisser-déposer ; `npm test` sur la zone ; le site inchangé
(`refonte-inventaire`, rendus).

**Ne fait pas** : le bouton de téléchargement du site (lot 6).

### Lot 3 — l'empaquetage Windows et Linux · M

**Intrant** : A, décision 3, la doc `electron-builder` (cibles `nsis`,
`AppImage`).

**Sortie** : configuration `electron-builder` (`electron-builder.yml`) :
`appId`, `productName` SW Blacksmith, icône, cibles **NSIS** (Windows) et
**AppImage** (Linux), fichiers = `dist/` + `dist-bureau/`, sortie
`paquets/` ; scripts `bureau:paquet` (plateforme courante).

**Preuve** : `lot-3.md` — installeur Windows produit sur cette machine,
taille mesurée, installation, lancement, désinstallation propre. L'AppImage
se construit sous Linux : sa preuve vient du lot 4 (CI).

**Ne fait pas** : signature (Q2), publication.

### Lot 4 — l'action GitHub au tag · J

**Intrant** : A, Q2, Q3, `.github/workflows/update-data.yml` (modèle de
rédaction), le lot 3.

**Sortie** : `.github/workflows/bureau.yml` : au tag `v*` (et
`workflow_dispatch` pour un essai), une matrice **`windows-latest`** +
**`ubuntu-latest`** : `npm ci`, build, `bureau:paquet --publish always` vers
la release du tag, `latest.yml` et `latest-linux.yml` compris.

**Preuve** : `lot-4.md` — un essai sur un tag de test (`v0.0.0-essai`, release
en **brouillon**, supprimée ensuite) : journal de l'action, fichiers
attachés.

**Ne fait pas** : le tag `v2.0.0` (posé à la publication, avec Thomas).

### Lot 5 — la mise à jour automatique · J

**Intrant** : A, `bureau/main.ts`, `src/ui/Notification.tsx`.

**Sortie** : `electron-updater` au lancement ; à mise à jour téléchargée,
une notification « Mise à jour prête · **Redémarrer** » — le libellé de
l'action devient un axe de la notification (« Annuler » par défaut,
`spec/shared/design.md` à jour) ; installation à la prochaine fermeture si
on ne redémarre pas.

**Preuve** : `lot-5.md` — deux releases d'essai successives (brouillons
publiés en pré-version, puis supprimées) : l'app installée en N passe à N+1
seule ; journal de l'updater.

**Ne fait pas** : rien sur le site.

### Lot 6 — « Télécharger pour Windows » sur le site · J

**Intrant** : A, Q2, Q5, `src/pages/HomePage.tsx`, `spec/accueil.md`
(`spec-toc` puis la section utile), règle « accueil miroir de l'app ».

**Sortie** : « Télécharger pour Windows » et « … pour Linux », vers
`…/releases/latest` ; absents dans l'app (`estBureau()`) ; la phrase
SmartScreen de la décision 2 ; tests de rendu (boutons sur le site, pas
dans l'app).

**Preuve** : `lot-6.md` — captures bureau et téléphone ; tests.

### Lot 7 — les données du jeu · J

**Intrant** : Q1, `update-data.yml`, `useMonsters.ts`, `monsterSkills.ts`.

**Sortie** : décision 1 (a) — rien à coder : la spec d'état actuel dit que
les données du jeu sont celles de l'installeur, rafraîchies à chaque
version publiée. ⚠️ Conséquence à écrire : une PR de données
(`update-data.yml`) n'atteint l'app qu'à la version suivante. Fusionnable
avec le lot 8.

### Lot 8 — clôture · M

**Sortie** : `spec/shared/application-bureau.md` (état actuel),
`ARCHITECTURE.md` (`bureau/`), `CLAUDE.md` § Vérifier (`npm run
bureau:local` après un changement du bureau), notes de la 2.0.0, ligne du
README des specs passée à « terminé », `npm test` complet, fusion
`--no-ff` dans `release/v2.0.0`.
