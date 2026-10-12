# Technique

La pile, les commandes, le style, les données et les tests. Les règles de travail (branches,
commits, vérifications) sont dans [AGENTS.md](../../AGENTS.md) et
[03-developpeur/](../03-developpeur/README.md).

## Pile

| | |
| --- | --- |
| Framework | React 18 + TypeScript 5 strict, **sans router** (routage par `window.location.hash`) |
| Build | Vite 5, Tailwind 3, PostCSS + autoprefixer |
| Dépendances runtime | `lucide-react` (icônes), `framer-motion` (animations) — aucune mesure d'audience (retirée le 2026-10-05) |
| Node | **24** (LTS active), déclaré à trois endroits qui doivent rester alignés : `engines` de `package.json`, `.nvmrc` et la CI |
| Calcul lourd | Web Workers (`src/workers/`) |
| Stockage | `localStorage` (prépa, équipes, réglages) + **IndexedDB** (compte importé) |
| Déploiement du site | Vercel (preset Vite, sortie `dist`) : déploiement automatique sur `main`, preview par branche |
| Application de bureau | Electron, voir ci-dessous |

Développer sur une version de Node et vérifier sur une autre laisse passer des écarts d'API — c'est
déjà arrivé (`navigator` en lecture seule sous Node ≥ 22).

⚠️ **Pas de librairie de composants externe.** Tout `src/ui/` est écrit à la main. Radix UI a été
**validé mais jamais installé** — chantier en attente.

### Application de bureau

Code dans **`bureau/`** (hors de `src/` : il tourne dans Node) :

- `main.ts` (fenêtre, protocole `app://swblacksmith/`), `protocole.ts` (règles pures, testées :
  fichier servi, adresse interne, lien ouvrable dehors), `navigation.ts` (liens vers le
  navigateur, navigations bloquées, « Enregistrer sous »), `fenetre.ts` (état mémorisé, pur),
  `preload.ts` ;
- `miseAJour.ts` (mise à jour automatique, `electron-updater`) ;
- `swex.ts` + `swexPur.ts` (dossier SW Exporter : « Mon compte » suit les exports) ;
- `session.ts` + `sessionPur.ts` (session en cours : « Sauvegarder » la réécrit, « Sauvegarder
  sous… », `session.json` ; dossier SW Blacksmith et son sous-dossier `sessions`,
  `dossier-swblacksmith.json`) ;
- `preuve.ts`, `installeur.nsh` (désinstalleur Windows), `icone.ico` (générée par
  `scripts/generer-icone-bureau.mjs`).

Empaqueté par `electron-builder.yml`, publié au tag `v*` par `.github/workflows/bureau.yml`
(installeurs attachés à la release), compilé par `scripts/construire-bureau.mjs` vers le dossier
`dist-bureau` (non suivi). Côté page : `src/lib/bureau.ts` (`estBureau()`, couleurs du thème,
mise à jour), `src/components/MiseAJourBureau.tsx` (la mise à jour dite par la notification),
`src/components/BlocApplication.tsx` (bloc « Application » des Réglages : version, mise à jour à
portée, dossier SW Exporter), `src/components/SuiviSwex.tsx` (applique « Mon compte » à chaque
export), `src/hooks/useEtatSwex.ts` (l'état du dossier, lu par les Réglages et par
`SidebarCompte`, dont la carte devient le menu des invocateurs), `src/hooks/useSessionEnCours.ts`
(la session en cours, « Garder mes données » redit au bureau ; `useEtatSession` pour la ligne
« Dossier SW Blacksmith » de `SettingsList`, bloc « Mes données »). Comportement :
[bureau/](../02-app/bureau/README.md).

## Commandes

```bash
nvm use                # lit .nvmrc
npm install            # installe aussi les hooks Git (script prepare → scripts/installer-hooks.mjs --automatique)
npm run fetch-data     # régénère les données monstres et compétences depuis SWARFARM (mode démo si l'API est KO)
npm run dev            # serveur de dev, http://localhost:5173
npm run build          # build de prod (⚠️ seul endroit où l'on voit le CSS réellement émis)
npm test               # = node tests/run.mjs
npm run lint           # ESLint sur tout le dépôt (eslint.config.js)
npm run benchmark:optim
npm run bureau         # l'application de bureau sur le serveur de dev
npm run bureau:local   # l'application de bureau sur le build (comme installée)
npm run bureau:preuve  # l'app se contrôle elle-même, captures + resultats.json (--exe : l'app installée ;
                       # --conservation : les données survivent à la fermeture ; --swex : le dossier SW Exporter)
npm run bureau:paquet  # l'installeur de la plateforme courante dans paquets/ (electron-builder.yml)
```

Avant d'ouvrir une pull request : `npx tsc --noEmit` (TypeScript strict), `npm run lint` (une
erreur bloque, un avertissement s'affiche), `npm test` (calculs, intégration, rendu, outillage) et
`npm run build`. À chaque commit, les hooks refusent une erreur ESLint dans le code indexé et un
message hors de la forme `type(portée): description` ; la CI rejoue ces contrôles sur chaque commit
de la pull request, en plus des quatre commandes ci-dessus. Détail :
[qualite-code.md](../03-developpeur/qualite-code.md).

## Style — `src/index.css` + `tailwind.config.js`

Source de vérité du rendu : [03-developpeur/interface/](../03-developpeur/interface/README.md).

- ⚠️ **Les tokens sont des TRIPLETS RGB**, consommés avec `<alpha-value>`. Écrits en hexadécimal,
  Tailwind n'émet **aucune** règle pour `bg-panel/50`.
- **Deux thèmes** : Forge (sombre) / Atelier (clair), + `data-theme` forcé.
- **Accent contextuel `--ctx`** : posé par un `data-ctx` sur un ancêtre. Un composant écrit
  `text-ctx` sans rien savoir de l'élément courant.
- **Variantes maison** : `hoverable:` (remplace `hover:`), `no-hover:`, `coarse:` (cibles),
  `compact:` (densité). ⚠️ `coarse` et `compact` valent tous deux `(pointer: coarse)` : **le
  pointeur décide, jamais la largeur**. La largeur (`lg:` = 1024 px) ne pilote que la
  **navigation**.
- **Échelle typo** : `nano` 10 (⚠️ `compact:` seulement) / `micro` 11 / `xs` 12 / `sm` 13 / `base`
  **15** / `lg` 17 / `xl` clamp.
- **Focus** : une règle globale de 1 px, désactivée là où une bordure marque déjà le focus.
- ⚠️ **`html` est le conteneur de défilement** (`body` a un `min-height` calculé).

### Pièges connus d'`index.css`

- ⚠️ **La famille `[data-tiroir]`** (panneau mobile) contient des règles **descendantes** qui
  touchent tout ce qui se trouve dedans — dont `[data-tiroir] .flex-col { align-items: flex-start }`,
  qui a décentré une modale entière. **Réponse structurelle : le portail.** Un dialogue ouvert
  depuis le panneau passe par `createPortal`, ce que `position: fixed` ne suffit pas à faire.
- ⚠️ **La règle des 40 px au doigt gonfle le cadre, pas le bouton** : d'où `data-cible-fine` sur les
  boutons internes de `BoutonGroupe`.
- ⚠️ **iOS zoome au focus** d'un `input`/`textarea` sous 16 px — **pas** d'un `select`. La règle
  des 16 px ne vise donc que les deux premiers.
- ⚠️ **L'ordre des classes dans l'attribut ne décide de rien**, seul l'ordre de la feuille compte :
  on ajoute un **axe** (`taille="carre"`) plutôt qu'un `p-0` en `className`.

## Données et scripts

- `public/` : icônes d'éléments, icônes de jeu, portraits ; `public/data/` : données SWARFARM.
- `scripts/fetch-monsters.mjs`, `scripts/fetch-skills.mjs`, `scripts/link-collabs.mjs` —
  régénèrent les données depuis SWARFARM ; `.github/workflows/update-data.yml` les rafraîchit
  chaque semaine.
- `scripts/benchmark-*.mjs` — mesures de l'Optimizer.
- `scripts/lib/relicOracle.ts` — oracle de contrôle de la dimension relique : N recherches du
  moteur réel, une par principale éligible distincte, et point d'entrée CLI pour les mesures.
- `src/data/releases.ts` — le journal des versions, lu par l'accueil **et** la page Nouveautés.

## Tests — `tests/`

`node tests/run.mjs`, registre dans `tests/index.ts`, mode d'emploi dans
[tests/README.md](../../tests/README.md). Volontairement limités à ce qui serait **grave et
invisible** : vitesse de combat, lecture d'un export, stockage, conservation, tris, Optimizer (dont
un test différentiel).

⚠️ **Aucun test d'interface** — elle se vérifie à l'œil ; des tests d'affichage ne feraient que
figer le rendu du jour. `npm test` ne pilote pas de navigateur et ne simule aucun clic : ce qui suit
une interaction se vérifie à l'écran.

Une exception, qui ne fige PAS le rendu : les **tests de rendu** (`tests/rendu/`) — un vrai
composant affiché avec `react-dom/server` et des données d'exemple, interrogé sur le SENS (texte,
`aria-label`, `title`, `disabled`), jamais sur les classes ou la disposition — ils vérifient
qu'une fonctionnalité est là, pas à quoi elle ressemble.

Seconde exception, qui ne fige pas davantage le rendu : le **banc d'affichage** (`tests/banc/`,
`node tests/banc/run.mjs`). Il construit l'app, l'ouvre dans Chromium sans fenêtre au téléphone
(360 × 800, tactile) et à l'ordinateur (1400 × 1000), amène chaque écran dans les états de
`tests/banc/ecrans.ts` et vérifie un **invariant** : rien ne déborde à l'horizontale, et une
pastille posée en coin d'un portrait de monstre ne recouvre rien d'autre que son portrait (règle et
limites connues : tête de `tests/banc/mesure.ts`). Il capture chaque état pour qu'on regarde ce qui
a été mesuré, mais ne compare **aucune** capture. Il ne tourne ni dans `npm test` ni en CI ; `tsc`
et ESLint couvrent en revanche ses fichiers, CI comprise. Mode d'emploi :
[tests/README.md](../../tests/README.md).

## Versions et releases

`main` est **toujours la version stable en ligne**, déployée sur Vercel. On n'y développe pas
directement : chaque version se prépare dans une branche **`<type>/<sujet>`** (le type comme
pour un commit : `feat/…`, `fix/…`, `docs/…`), fusionnée en
`--no-ff` puis taguée. Le processus complet — étapes, numérotation SemVer, conventions de branche
et de tag — vit dans [nouveautes/](../02-app/nouveautes/README.md) (« Modèle de branches et
processus de release »).
