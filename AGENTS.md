# SW Blacksmith — guide agents & contributeurs

Boîte à outils **Summoners War** : préparation RTA et siège, exploration du compte, Optimizer de
runes, speed tuning, dégâts réels. **100 % local** : une app web sans serveur, qui lit un export de
compte dans le navigateur et n'envoie rien. La même app existe en **application de bureau**
(Electron, Windows et Linux). Le dépôt est **public**.

> Documentation : [`docs/`](docs/) (carte : [docs/README.md](docs/README.md)). Où se trouve quoi,
> par écran : [docs/01-presentation/02-architecture.md](docs/01-presentation/02-architecture.md). Décisions : [`docs/04-decisions/`](docs/04-decisions/README.md).

## ⚠️ Avant tout travail : lire la documentation de ce qui va être touché

Avant la première ligne écrite, code ou doc — pas après, pas en cours de route. Deux lectures,
toujours :

1. **Les bonnes pratiques du travail à faire** :
   - produire du code → [conventions.md](docs/03-developpeur/conventions.md) (règles communes à
     toutes les pages) et [qualite-code.md](docs/03-developpeur/qualite-code.md) (lint, hooks,
     commits) ; un écran ou un composant en plus →
     [interface/](docs/03-developpeur/interface/README.md) (deux formats, système visuel, librairie UI) ;
   - écrire ou réorganiser la documentation →
     [documentation.md](docs/03-developpeur/documentation.md).
2. **La documentation du code qui va être touché** : la table « Le changement touche… » ci-dessous
   donne le dossier ; son README donne le document, dont on lit la section utile. Avant un chantier
   Optimizer, en plus : [invariants.md](docs/03-developpeur/optimizer/invariants.md) (en entier — le
   seul fichier lu ainsi) et le [routage par tâche](docs/02-app/optimizer/routage-par-tache.md).

Si la doc contredit le code ou manque, le dire avant de coder. La doc se met à jour dans le **même
commit** que le code.

## Stack

| Couche | Techno |
| --- | --- |
| Runtime | **Node ≥ 24** (`.nvmrc`), npm, ESM (`"type": "module"`) |
| App | **React 18** + **TypeScript 5**, **sans router** : routage par `window.location.hash` (`src/App.tsx`) |
| Build & style | **Vite 5**, **Tailwind 3** (PostCSS + autoprefixer), tokens CSS dans `src/index.css` |
| Dépendances runtime | `lucide-react` (icônes), `framer-motion` (animation) — aucune mesure d'audience |
| Calcul lourd | **Web Workers** (`src/workers/`) : recherche de l'Optimizer, résolution de l'équipement |
| Stockage | `localStorage` (prépa, équipes, réglages) + **IndexedDB** (compte importé), tous deux opt-in |
| Bureau | **Electron** + `electron-builder` + `electron-updater` (`bureau/`, hors de `src/`) |
| Tests | lanceur maison `tests/run.mjs` (registre `tests/index.ts`), `fake-indexeddb`, rendu par `react-dom/server` |
| Qualité | `tsc` strict (couvre `src/`, `scripts/`, `tests/`), ESLint (flat config) |

## Structure

```
src/
  App.tsx        # le shell : routage par hash, nav, état remonté, import de compte
  pages/         # une page par route (HomePage, RtaPage, SiegePage, AccountPage, OutilsPage…)
  components/    # composants par page : rta/, siege/, account/, outils/, palette/ ; à la racine,
                 # ce qui sert plusieurs pages (Sidebar, TopBar, MobileTabs, RuneWheel, MonsterAvatar…)
  ui/            # la librairie d'interface : TOUT contrôle vient d'ici (Bouton, Champ, Selecteur,
                 # Modale, Flottant, Pastille…) — point d'entrée src/ui/index.ts
  hooks/         # état et persistance (usePersistence, useOptimizerState, useSpeedTune…)
  lib/           # calcul pur, testé : vitesse (speed.ts), runes, artéfacts, reliques, dégâts réels
                 # (damage.ts), moteur de l'Optimizer (runeBuildOptim.ts), import de compte, session
  workers/       # Web Workers de l'Optimizer (recherche, appariement parallèle, résolution)
  data/          # contenu statique (journal des versions releases.ts)
bureau/          # application de bureau Electron (main, protocole, session, SW Exporter, mise à jour)
public/          # icônes, portraits, données SWARFARM (public/data, régénérées par npm run fetch-data)
scripts/         # outillage Node : données, benchmarks, harnais de diagnostic, hooks, bureau
tests/           # vérifications (run.mjs + index.ts), fixtures, tests de rendu (tests/rendu/)
docs/            # documentation en sections (01-presentation … 05-pilotage)
.githooks/       # sources des hooks pre-commit et commit-msg (installés par npm install)
```

## Commandes essentielles

```bash
npm install                    # dépendances + installation des hooks Git (script prepare)
npm run dev                    # serveur de dev Vite
npm run build                  # build de production (Tailwind n'émet que ce qu'il trouve dans le SOURCE)
npm run lint                   # ESLint sur tout le dépôt
npx tsc --noEmit               # types : src/, scripts/ et tests/
node tests/run.mjs <filtre>    # les vérifications d'une zone (ex. speed-tune) ; plusieurs filtres possibles
npm test                       # TOUTES les vérifications — seulement avant une fusion sur main ou dans une release
npm run fetch-data             # régénère les données SWARFARM de public/data
npm run bureau                 # l'application de bureau en développement
npm run bureau:preuve          # la vérification de l'application de bureau
```

## Données et persistance

- **Rien ne quitte le navigateur** : l'export de compte (SWEX) se lit en local, aucune requête ne
  l'envoie. Les données de jeu viennent de SWARFARM, figées dans `public/data`.
- **Un seul interrupteur de conservation** : `usePersistence` — aucun hook n'appelle
  `localStorage.setItem` directement, tout passe par `saveLocal` ; clés préfixées `swblacksmith-`.
  Les données (prépa, équipes, recommandations, monstres perso, compte) ne sont conservées que si
  l'utilisateur l'a accepté ; les clés de réglage font exception (détail :
  [conventions.md](docs/03-developpeur/conventions.md), « Persistance navigateur »).
- Le compte importé vit en **IndexedDB** (`src/lib/accountStore.ts`), relu au démarrage s'il a été
  gardé. Détail : [feat-import-compte/](docs/02-app/transverse/feat-import-compte/README.md).
- Les fichiers exportés portent un identifiant `swblacksmith/<nom>` (`src/lib/formatsExport.ts`).

## Le changement touche… → documentation à lire

| Le changement touche… | Lire |
| --- | --- |
| `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/components/MobileTabs.tsx`, `src/components/Palette.tsx`, `src/pages/SettingsPage.tsx` | [transverse/feat-navigation/](docs/02-app/transverse/feat-navigation/README.md) |
| `src/pages/HomePage.tsx`, `src/data/releases.ts` | [accueil/](docs/02-app/accueil/README.md), [nouveautes/](docs/02-app/nouveautes/README.md) |
| `src/pages/RtaPage.tsx`, `src/components/rta/`, `src/lib/rtaShare.ts` | [rta/](docs/02-app/rta/README.md) |
| `src/pages/SiegePage.tsx`, `src/components/siege/`, les `reco…` et `siege…` de `src/lib/` | [siege/](docs/02-app/siege/README.md) |
| `src/pages/AccountPage.tsx`, `src/components/account/`, `src/lib/runeOptim.ts`, `src/lib/artifacts.ts` | [compte/](docs/02-app/compte/README.md) |
| `src/pages/OutilsPage.tsx`, la garde d'accès aux outils | [outils/](docs/02-app/outils/README.md) |
| les `Optimizer…` de `src/components/outils/`, `src/hooks/useOptimizerState.ts`, `src/hooks/useOptimizerLists.ts`, les `optimizer…` de `src/lib/`, `src/lib/equipesOptimizer.ts`, `src/lib/importEquipes.ts` | [optimizer/](docs/02-app/optimizer/README.md) |
| `src/lib/runeBuildOptim.ts`, `src/lib/artifactOptim.ts`, `src/lib/relicOptim.ts`, `src/lib/relicQueue.ts`, `src/workers/` | [03-developpeur/optimizer/](docs/03-developpeur/optimizer/README.md) |
| `src/lib/damage.ts`, `src/components/outils/DamageSetupCard.tsx` | [degats-reels/](docs/02-app/degats-reels/README.md) |
| `src/components/outils/SpeedTuningSection.tsx`, `src/hooks/useSpeedTune.ts`, les `speedTune…` de `src/lib/` | [speed-tuning/](docs/02-app/speed-tuning/README.md) |
| `src/lib/speed.ts`, `src/lib/stats.ts` | [transverse/feat-calcul-vitesse.md](docs/02-app/transverse/feat-calcul-vitesse.md) |
| `src/lib/importAccount.ts`, `src/lib/applyAccount.ts`, `src/lib/accountStore.ts`, `src/components/AccountImportControl.tsx` | [transverse/feat-import-compte/](docs/02-app/transverse/feat-import-compte/README.md) |
| `src/lib/session.ts`, `src/lib/sessionOptimizer.ts`, `src/hooks/useSessionEnCours.ts` | [transverse/feat-sauvegarde-session.md](docs/02-app/transverse/feat-sauvegarde-session.md) |
| `src/hooks/useMonsters.ts`, `src/components/CreateMonster.tsx`, `src/components/MonsterAvatar.tsx`, `public/data/` | [transverse/feat-donnees-monstres.md](docs/02-app/transverse/feat-donnees-monstres.md) |
| `src/hooks/useComboboxNav.ts`, une barre de recherche à suggestions | [transverse/feat-recherche-clavier.md](docs/02-app/transverse/feat-recherche-clavier.md) |
| `src/pages/BestiaryPage.tsx`, `src/components/MonsterGrid.tsx`, `src/components/FilterBar.tsx` | [bestiaire/](docs/02-app/bestiaire/README.md) |
| `src/pages/MechanicsPage.tsx` | [mecaniques/](docs/02-app/mecaniques/README.md) |
| `bureau/`, `src/lib/bureau.ts`, `electron-builder.yml`, `src/pages/TelechargerPage.tsx` | [bureau/](docs/02-app/bureau/README.md), [telecharger/](docs/02-app/telecharger/README.md) |
| `src/ui/`, `src/index.css`, `tailwind.config.js`, tout rendu d'écran | [03-developpeur/interface/](docs/03-developpeur/interface/README.md) |
| `eslint.config.js`, `.githooks/`, `scripts/installer-hooks.mjs`, `.github/workflows/` | [qualite-code.md](docs/03-developpeur/qualite-code.md) |
| `tests/renvois.test.ts`, un fichier déplacé ou renommé | [renvois.md](docs/03-developpeur/renvois.md) |
| `docs/` | [documentation.md](docs/03-developpeur/documentation.md) |

## Conventions de code

- **Français partout** : interface, commentaires, documentation, messages de commit. Les **libellés
  affichés sont ceux du jeu**, jamais reformulés.
- **Un commentaire donne la raison et l'invariant**, sans récit ; un commit donne le pourquoi en
  bref, sans journal.
- **Calcul pur dans `src/lib/`**, testé ; un composant ne calcule pas ce qu'une fonction de `src/lib/`
  peut porter (ex. `src/lib/speedTuneLignes.ts` pour l'écran du speed tuning).
- ⚠️ **Un type partagé entre l'écran et un script a PLUSIEURS constructeurs** (ex. `OptimizerRecipe`
  et `recipeToSearchParams.ts`). `tsc` attrape un champ dont le **type change** ou qui devient
  **obligatoire**, jamais un champ **optionnel** oublié dans l'un d'eux. Avant de considérer un champ
  ajouté ou renommé comme terminé : `grep -rn` du nom sur `src/`, `scripts/` **et** `tests/`. Détail :
  [conventions.md](docs/03-developpeur/conventions.md), « Conventions communes ».
- **Toute page ou section ajoutée, renommée ou supprimée** se répercute sur l'accueil, sur la nav de
  `App.tsx` et sur [docs/02-app/README.md](docs/02-app/README.md), dans le même commit.

### Interface

- **Deux formats de premier rang** : téléphone et ordinateur. Aucun n'est le cas dégradé de
  l'autre — **une correction destinée à l'un ne touche pas l'autre**.
- **Rien de custom** : tout contrôle vient de `src/ui/`. On n'ajoute à la librairie que quand un
  **axe** manque, jamais une variante de plus.
- ⚠️ **Un clic ne déplace jamais ce qu'on vient de cliquer** : la place de ce qui s'ouvre est
  réservée d'avance, ou bien ce qui s'ouvre sort du flux (flottant, dialogue, panneau).
- **Contours : 1 px, et un seul** — pour l'interface ; runes, artéfacts et reliques se marquent
  comme dans le jeu.
- **Grammaire des modales** : titre en haut à gauche, croix en haut à droite, actions en bas à
  droite (empilées pleine largeur si elles ne tiennent pas sur une ligne), corps pleine largeur ou
  centré.
- **Jamais un `confirm()` dont OK détruit** : le défaut est l'action sans perte.
- **Aucune couleur Tailwind native, aucune valeur en dur** : tout passe par les tokens.
- **Passe responsive en cours** : ne pas rustiner le mobile écran par écran.

## Travail

- **Branches `<type>/<sujet>`**, nommées comme un commit : le type dit ce que la branche va
  faire (`feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `style`, `build`, `ci`, `chore`,
  `revert`), le sujet ce qu'elle contient — `feat/prepa-rta`, `fix/tri-runes`,
  `refactor/listes-optimizer`. ⚠️ **Toute nouvelle branche part de `main` ou de la branche de
  release visée** (`git fetch origin && git switch -c <type>/<sujet> origin/<base>`) ; elle
  fusionne dans la release, qui fusionne dans `main`. On ne travaille jamais sur `main` ni sur
  une release : on en part. Le numéro de version se décide à la fusion.
- **Commits atomiques** : un commit = une chose reviewable. L'atomicité se juge sur la cohérence du
  **pourquoi**, pas sur le nombre de fichiers ; plusieurs sujets traités ensemble font plusieurs
  commits.
- **Une décision prise ensemble s'applique jusqu'au bout.** Si le chantier dérive et qu'une étape
  validée reste en attente, le dire.
- **Un registre de suivi (`pistes-*.md` et équivalents) et le fichier qu'il référence** se mettent à
  jour ensemble, jamais l'un sans l'autre.
- **Un travail de plus d'une session** se cadre dans un fichier de
  [docs/04-decisions/cadrages/](docs/04-decisions/cadrages/README.md), jamais dans un plan de
  conversation.

## Vérifier

Avant de considérer un changement de code terminé, dans cet ordre :

```bash
npx tsc --noEmit                  # types — src/, scripts/ et tests/
npx eslint <fichiers touchés>     # lint
node tests/run.mjs <filtre>       # SEULEMENT la zone touchée
npm run build                     # une classe Tailwind « correcte » peut n'être jamais émise
```

⚠️ **La suite complète (`npm test`) ne se lance qu'avant une fusion sur `main` ou dans une
branche `release/*`** — et seulement là.
Le filtre se compare au nom de la vérification, mis à plat (`speed-tune`, `speedtune`, `SpeedTune`) ;
un filtre qui ne correspond à rien échoue en listant ce qui existe. Quand un style ne s'applique pas,
vérifier dans le **CSS construit**, pas dans le composant.

## Hooks Git et CI

- **`pre-commit` refuse** : une erreur ESLint dans le code indexé, un commit sur `main`, un chemin
  privé dans l'index (`.history/`, `.vscode/`), un fichier de plus de 5 Mo (un export de compte).
- **`commit-msg` refuse** un sujet hors de la forme `type(portée): description`, un corps collé au
  sujet et un message qui commence par un BOM.
- Installés **par machine** par `npm install` (jamais en CI, jamais vers une version plus ancienne),
  jamais requis ; à la main : `node scripts/installer-hooks.mjs` (`--simulation` pour voir).
- `--no-verify` reste possible en local, **pas en CI** : chaque commit d'une pull request repasse par
  les deux hooks (`scripts/verifier-commits.mjs`). Détail :
  [qualite-code.md](docs/03-developpeur/qualite-code.md).

## Skills

Les skills du dépôt vivent dans `.claude/skills/<nom>/SKILL.md` (source canonique). Les adaptateurs
de `.agents/skills/` les rendent visibles à Codex : quand un adaptateur s'applique, lire
intégralement le `SKILL.md` canonique qu'il référence avant d'agir. Consignes locales non suivies
par Git : `CLAUDE.local.md` à la racine, s'il existe, à lire juste après ce fichier.
