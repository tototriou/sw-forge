# Architecture — la carte du dépôt

À quoi sert ce fichier : **ouvrir les bons fichiers du premier coup**. Pour une
demande donnée, la table « Par écran » dit quoi ouvrir ; les tables suivantes
disent ce que contient chaque brique. Le comportement attendu, lui, est dans
`spec/` — ici on dit *où*, pas *quoi*.

---

## 1. Pile et commandes

| | |
|---|---|
| Framework | React 18 + TypeScript 5, **sans router** (routing par `window.location.hash`) |
| Build | Vite 5, Tailwind 3, PostCSS + autoprefixer |
| Dépendances runtime | `lucide-react` (icônes), `framer-motion` — aucune mesure d'audience (retirée le 2026-10-05) |
| Node | ≥ 24 |
| Calcul lourd | 2 Web Workers (`src/workers/`) |
| Stockage | `localStorage` (prépa, équipes, réglages) + **IndexedDB** (compte importé) |
| Application de bureau | Electron, code dans **`bureau/`** (hors de `src/` : il tourne dans Node) — `main.ts` (fenêtre, protocole `app://swblacksmith/`), `protocole.ts` (règles pures, testées : fichier servi, adresse interne, lien ouvrable dehors), `navigation.ts` (liens vers le navigateur, navigations bloquées, « Enregistrer sous »), `fenetre.ts` (état mémorisé, pur), `preload.ts`, `miseAJour.ts` (mise à jour automatique, `electron-updater`), `swex.ts` + `swexPur.ts` (dossier SW Exporter : « Mon compte » suit les exports), `session.ts` + `sessionPur.ts` (session en cours : « Sauvegarder » la réécrit, « Sauvegarder sous… », `session.json` ; dossier SW Blacksmith et son sous-dossier `sessions`, `dossier-swblacksmith.json`), `preuve.ts`, `installeur.nsh` (désinstalleur Windows), `icone.ico` (générée par `scripts/generer-icone-bureau.mjs`) ; empaqueté par `electron-builder.yml`, publié au tag `v*` par `.github/workflows/bureau.yml` (installeurs attachés à la release) ; côté page `src/lib/bureau.ts` (`estBureau()`, couleurs du thème, mise à jour), `src/components/MiseAJourBureau.tsx` (la mise à jour dite par la notification) et `src/components/BlocApplication.tsx` (bloc « Application » des Réglages : version, mise à jour à portée, dossier SW Exporter), `src/components/SuiviSwex.tsx` (applique « Mon compte » à chaque export), `src/hooks/useEtatSwex.ts` (l'état du dossier, lu par les Réglages et par `SidebarCompte`, dont la carte devient le menu des invocateurs), `src/hooks/useSessionEnCours.ts` (la session en cours, « Garder mes données » redit au bureau ; `useEtatSession` pour la ligne « Dossier SW Blacksmith » de `SettingsList`, bloc « Mes données ») ; compilé par `scripts/construire-bureau.mjs` vers le dossier `dist-bureau` (non suivi). État actuel [spec/shared/application-bureau.md](spec/shared/application-bureau.md), chantier [spec/chantiers/application-bureau.md](spec/chantiers/application-bureau.md) |

⚠️ **Pas de librairie de composants.** Tout `src/ui/` est écrit à la main.
Radix UI a été **validé mais jamais installé** — chantier en attente.

```
npm run dev            # serveur de dev
npm run build          # build de prod (⚠️ seul endroit où l'on voit le CSS réellement émis)
npm test               # = node tests/run.mjs
npm run fetch-data     # régénère les données monstres/skills depuis SWARFARM
npm run benchmark:optim
npm run bureau         # l'application de bureau sur le serveur de dev
npm run bureau:local   # l'application de bureau sur le build (comme installée)
npm run bureau:preuve  # l'app se contrôle elle-même, captures + resultats.json (--exe : l'app installée ; --conservation : les données survivent à la fermeture ; --swex : le dossier SW Exporter)
npm run bureau:paquet  # l'installeur de la plateforme courante dans paquets/ (electron-builder.yml)
```

---

## 2. Le shell — `src/App.tsx`

Fichier central, gros et volontairement : il tient tout ce qui doit être partagé
entre pages.

- **Routing** `parseHash()` sur `window.location.hash` — table des adresses
  et garde-fou : `spec/shared/navigation.md` § Adresses.
- **Nav** : barre latérale (`Sidebar`), barre supérieure (`TopBar`), onglets
  mobiles (`MobileTabs`), recherche de nav (`SidebarSearch`).
- **Repli de la barre supérieure : mesuré, pas fixé à un breakpoint**
  (`useLayoutEffect` + `ResizeObserver`).
- **États instanciés ici puis passés en prop** : `useRtaState`, `useSiegeState`,
  `useSiegeRecos`, `useOptimizerState`, `useMonsters`, `useCustomMonsters`.
  C'est ce qui permet à un import de compte d'alimenter RTA + siège + compte
  d'un seul geste.
- **Import de compte global** (`importAccount`) et **`clearAllData()`**.
- **Sauvegarde de session** (`sauvegarderSession`, `sauvegarderSessionSous`, Ctrl+S) :
  `spec/shared/sauvegarde-session.md`.

⚠️ **Cycle d'imports** : `AccountPage` et `OutilsPage` importent des types depuis
`src/App`. Conséquence pratique : un parcours automatique des dépendances depuis
ces deux pages remonte **toute la codebase**. Se fier à la table §3, pas à un
arbre calculé.

⚠️ **`src/ui/index.ts` est un baril** : importer un seul composant depuis `../ui`
fait apparaître les 16 dans n'importe quelle analyse de dépendances.

---

## 3. Par écran — quoi ouvrir

| Écran | Route | Page | Composants propres | Spec |
|---|---|---|---|---|
| Accueil | `#/` | `pages/HomePage.tsx` | `ElementIcon`, `data/releases` | `spec/accueil.md` |
| **RTA** | `#/rta`, `#/rta/ami` | `pages/RtaPage.tsx` | tout `components/rta/` | `spec/rta/` |
| **Siège** | `#/siege/defense`, `/offense`, `/recommandations` | `pages/SiegePage.tsx` | tout `components/siege/` | `spec/siege/` |
| **Mon compte** | `#/compte`, `/runes`, `/artefacts` | `pages/AccountPage.tsx` | tout `components/account/` | `spec/compte/` |
| **Outils** | `#/outils/optimizer`, `/speed-tuning` | `pages/OutilsPage.tsx` | tout `components/outils/` | `spec/outils/` |
| Bestiaire | `#/bestiary` | `pages/BestiaryPage.tsx` | `MonsterGrid`, `FilterBar`, `SearchBar`, `MonsterDetailDialog`, `account/Pager` | `spec/bestiaire.md` |
| Paramètres | `#/parametres` | `pages/SettingsPage.tsx` | `SettingsMenu`, `AccountImportControl` | `spec/shared/navigation.md` |
| Mécaniques | `#/mecaniques` | `pages/MechanicsPage.tsx` | — (page statique) | `spec/mecaniques.md` |
| Nouveautés | `#/releases` | `pages/ReleasesPage.tsx` | `data/releases.ts` | `spec/releases.md` |
| Télécharger (site seulement) | `#/telecharger` | `src/pages/TelechargerPage.tsx` | `src/lib/bureau.ts` (`TELECHARGEMENTS`), `src/components/IconesSystemes.tsx` | `spec/telecharger.md` |
| Arène | `#/arene` | `pages/ComingSoon.tsx` | — | `spec/arene.md` |

### Détail des écrans denses

**RTA** — `pages/RtaPage.tsx` + :

| Fichier | Rôle |
|---|---|
| `rta/RtaSection.tsx` | une section (groupe classé) et ses cartes |
| `rta/RtaCard.tsx` | la carte d'un monstre : vitesse, tick, équipement |
| `rta/CategoryBar.tsx` | barre des catégories, création/édition, choix des monstres |
| `rta/CategoryRing.tsx` | l'anneau de couleurs d'une carte |
| `rta/TurnOrder.tsx` | ordre de tour calculé |
| `rta/RtaSearch.tsx` | ajout d'un monstre à la prépa |
| `rta/RtaBackupBar.tsx` | sauvegarde / restauration / partage / import |
| `rta/RtaAmiSection.tsx` | le sous-onglet « Ami » : ouvre le fichier (prépa exportée **ou** export SWEX), ou l'invite |
| `rta/RtaFriendView.tsx` | lecture d'une prépa partagée |
| `rta/RtaValidationReport.tsx` | rapport de lecture d'un fichier, **partagé** par la barre de sauvegarde et le sous-onglet Ami |
| `rta/DesyncBadge.tsx` | la vitesse saisie ≠ les runes importées |

Hooks : `useRtaState`, `useRtaCategories`, `useRtaBackup`, `useRuneMetric`,
`useOvercapDisplay`, `useStickyState`.
Lib : `rtaShare`, `speed`, `stats`, `gearSync`, `artifacts`, `monsterForms`.

**Siège** — `siege/SiegeBoard.tsx` (défense/offense), `siege/SiegeTeam.tsx`,
`siege/RecoBoard.tsx` + `siege/RecoCard.tsx` (recommandations),
`siege/LeadPill.tsx`. Hooks `useSiegeState`, `useSiegeRecos`. Lib `recoMatch`,
`recoSearch`, `recoShare`, `recoFromSiege`, `recoDefenses` (la vue Défense,
calculée à partir des decks), `ownedBuilds`, **`siegeStatut`**
(le statut vert/orange/rouge d'une équipe en mode « Vérifier mes tick ATB » —
pur et testé, il ne vit pas dans la card).

**Mon compte** — `account/RunesSection.tsx` et `account/ArtifactsSection.tsx`
sont les deux racines ; dessous : `RunesList`, `RunesSummary`, `RunesCurve` +
`CurveChart` + `curveColors`, `RunesCompare`, `RunesOptim`, `SetFilter`,
`SlotFilter`, `SubSearchBar` + `SubSearchDialog`, `Pager`, `SummaryBits`,
`ArtifactsList`, `ArtifactsSummary`. Lib `accountStore` (IndexedDB),
`accountViews`, `runeSort`, `runeOptim`, `monsterSort`, `crafts`.

**Optimiseur** — `src/components/outils/OptimizerSection.tsx` (racine), `MonsterSourcePicker`
(recherche — deux modes, bestiaire/compte réel), `OptimizerListPicker`
(listes de travail), `SetComboPicker`, `BuildCandidateCard` — spec :
`spec/outils/optimizer/ecran/README.md § Écran (de haut en bas)`. Hooks
`useOptimizerState` + `useBuildOptimSearch` (saisie et recherche, jamais
persistées) et `useOptimizerLists` (listes de travail créées par
l'utilisateur + runes validées scopées par liste — seul état PERSISTÉ
de l'écran — spec : `spec/outils/optimizer/listes-et-reservation.md § Listes de travail et
réservation de runes`). Moteur `lib/runeBuildOptim.ts`, exécuté dans
`src/workers/runeBuildOptim.worker.ts` et
`src/workers/buildHalf.worker.ts` — spec : `spec/outils/optimizer/moteur/elagages.md
§ Algorithme (résumé fonctionnel)`. ⚠️ Disposition mobile dédiée pour « Monstre &
équipement » seul — le reste de l'écran n'est pas encore audité en
mobile.

**Speed tuning** — `outils/SpeedTuningSection.tsx` (racine) ne fait que
**rendre** : aucune règle métier n'y vit. Le modèle de l'écran (une `Ligne` =
un monstre posé dans un camp, et tout ce qu'on en déduit — vitesse de combat,
sort actif, entrée du moteur, référence, estimations) est dans
`lib/speedTuneLignes.ts` ; l'état, les actions et les dérivées sont dans
`hooks/useSpeedTune.ts`. Un champ qui manque à l'un des deux écrans se voit
donc en test, pas à l'œil. Calcul pur
`lib/speedTune.ts` (règle des ticks, simulation « un seul monstre par tick » et
verdict de chaîne « le combo passe-t-il ? » + vitesses requises, testé dans
`tests/speed-tune.test.ts`), vitesse de combat via `lib/speed.ts`.
S'ouvre aussi **en modale depuis un deck de siège**
(`outils/SpeedTuneModale.tsx`, monté par `siege/SiegeBoard.tsx`) : même
composant, mêmes réglages — la page dessous ne bouge pas, fermer rend sa place.
Ne dépend pas d'un compte importé — mais sait **importer une équipe de siège**
dans « Ton équipe » (`lib/speedTuneDeck.ts`) et **lire le kit** des monstres pour
en déduire boosts de barre et buffs de vitesse (`lib/speedTuneKit.ts`, d'après
`public/data/skills`). Analyse poussée (ordre imposé + sort de chacun) dans le
même moteur. Tout est testé dans `tests/speed-tune.test.ts`.

---

## 4. `src/ui/` — la librairie partagée

Spec : [`spec/shared/librairie-ui.md`](spec/shared/librairie-ui.md).
**Rien ne se redessine ailleurs.** Ces composants combinent des **axes**
(`ton` × `fond` × `trait` × `forme` × `taille`) plutôt que des variantes nommées.

| Fichier | Ce que c'est |
|---|---|
| `Bouton.tsx` | **la fondation** — tous les axes, la constante `PRESSION` |
| `BoutonGroupe.tsx` | le bouton des **rangées** : libellé + icône optionnelle à gauche + actions optionnelles à droite |
| `BoutonIcone.tsx` | préréglage carré, `libelle` obligatoire (→ `aria-label` + `title`) |
| `Vignette.tsx` | case **sélectionnable** d'une grille ; la `teinte` vient de l'appelant |
| `Pastille.tsx` | **pilule de filtre** à deux états d'une rangée de critères (élément, rareté, doublons) ; teinte optionnelle fournie par l'appelant |
| `ZoneCliquable.tsx` | une **surface** rendue cliquable (ligne dépliante, poignée) |
| `Champ.tsx` / `NumberField.tsx` | saisie texte / numérique (⚠️ jamais `type="number"`) |
| `Selecteur.tsx` | liste déroulante |
| `Case.tsx` / `Interrupteur.tsx` | à cocher / à glissière |
| `Option.tsx` | choix riche : icône + titre + explication ; action optionnelle juste à droite du titre (`actionTitre`, hors du bouton principal : le « ? » d'une prose de sort) |
| `Dialogs.tsx` | `Modale` (portalisée), `ConfirmDialog`, `PromptDialog`, `KeepAccountDialog` |
| `PiedDeDialogue.tsx` | la rangée d'actions d'un dialogue |
| `Flottant.tsx` / `FlottantAuto.tsx` | surface ancrée ; la variante **mesure et choisit son côté avant peinture** |
| `MobileSheet.tsx` | panneau d'actions mobile (`data-tiroir`) |
| `index.ts` | baril de réexport |

**Hors librairie mais partagés** (`src/components/`) : `Segmented`, `Switch`,
`SearchBar`, `FilterBar`, `MonsterCard`, `MonsterGrid`, `MonsterPicker`,
`MonsterAvatar`, `MonsterGear`, `MonsterDetailDialog`, `CreateMonster`,
`AccordionGrid`, `StatPanel`, `PieceDetail` (⚠️ **la coquille unique** des
fiches de rune ET d'artéfact), `RuneIcon`, `RuneSlotIcon`, `RuneWheel`,
`ArtifactIcon`, `ArtifactFrameIcon`, `ArtifactSlots`, `BoutonSensTri`, `ElementIcon`, `InventaireIcon`,
`CollabPortrait`, `HelpPopover`.

⚠️ **Frontière UI / jeu** : les composants de `src/ui/` suivent la règle du
contour unique de 1 px. Runes, artéfacts et reliques se marquent **comme dans le
jeu** (halo, éclat) et en sont exemptés.

---

## 5. Hooks — `src/hooks/`

| Hook | Rôle |
|---|---|
| `useMonsters` / `useCustomMonsters` | données SWARFARM / monstres créés à la main |
| `useRtaState`, `useRtaCategories`, `useRtaBackup` | état de la prépa RTA |
| `useSiegeState`, `useSiegeRecos` | défense/offense, recommandations |
| `useOptimizerState`, `useBuildOptimSearch` | réglages et recherche de l'Optimiseur |
| `useOptimizerLists` | Listes de travail + runes validées — SEUL état de l'Optimiseur qui persiste sur disque, contrairement à `useOptimizerState` |
| `usePersistence` | **un seul interrupteur** pour toute conservation ; ⚠️ aucun hook n'appelle `localStorage.setItem` directement ; clés préfixées `swblacksmith-`, migrées depuis l'ancien nom par `lib/migrationStockage.ts` (premier import de `main.tsx`) |
| `useStickyState` | état conservé en mémoire à travers la navigation, sans persister |
| `useSessionEnCours`, `useEtatSession` | la session en cours de l'application de bureau (`null` sur le site), redit « Garder mes données » au bureau ; l'état complet, dossier SW Blacksmith compris |
| `useRuneMetric`, `useOvercapDisplay`, `useTheme` | réglages globaux (menu ⚙) |
| `useMediaQuery` | une media query lue depuis React |
| `useScrollBloque` | ⚠️ **compteur de verrous** — blocage du défilement, verrou `position: fixed` sur `body` (iOS ignore `overflow: hidden` au toucher) |
| `useClavierOuvert` | clavier virtuel déployé ? via `visualViewport` |
| `useRecalageEcran` | ramène dans l'écran un flottant qui déborde par la droite |
| `useComboboxNav` | ↑/↓/Entrée/Échap des barres de recherche à suggestions |
| `useSpeedTune` | ⚠️ **tout** l'état, les actions et les dérivées du speed tuning — la page ne fait que rendre |
| `useDonneesKit` | charge kits, sorts et passifs d'une poignée de monstres (outil **et** siège, un seul chemin) |
| `useAdversaireReference` | réglage global : toujours poser l'adversaire de référence en face |

---

## 6. Calcul — `src/lib/`

Fonctions **pures**, testables sans rendu. C'est ici que va toute logique, jamais
dans un composant.

| Domaine | Fichiers |
|---|---|
| Vitesse & stats | `speed.ts` (source de vérité), `stats.ts` |
| Speed tuning | `speedTune.ts` (moteur de ticks), `speedTuneLignes.ts` (modèle de l'écran), `speedTuneAuto.ts` (analyse partagée outil/siège), `speedTuneKit.ts` + `speedTunePassif.ts` (lecture des kits), `speedTuneDeck.ts` (import d'un deck), `siegeStatut.ts` (statut d'une équipe de siège) |
| Runes | `runeOptim.ts`, `runeBuildOptim.ts`, `runeSort.ts`, `runeCurveShare.ts` |
| Reliques | `relicOptim.ts` (choix de la meilleure relique pour un build, pertinence et dominance structurelle) ; `relicQueue.ts` (résolution EXACTE de l'équipement d'un build — paire d'artéfacts ET relique, ensemble — la partie pure de la file `useArtifactOptimQueue`, et l'état de la relique d'un candidat pour l'écran) |
| Tri | `tri.ts` (le SENS d'un tri, partagé par toutes les listes) |
| Artéfacts | `artifacts.ts` |
| Import de compte | `importAccount.ts` (parse SWEX), `applyAccount.ts` (→ états), `accountStore.ts` (IndexedDB), `accountViews.ts` |
| Monstres | `monsterForms.ts`, `monsterSkills.ts`, `monsterSort.ts`, `collabPairs.ts` |
| Siège / recos | `recoMatch.ts`, `recoSearch.ts`, `recoShare.ts`, `recoFromSiege.ts`, `recoDefenses.ts`, `ownedBuilds.ts`, `annulerEdition.ts` (« Annuler les modifications » d'une reco ou d'un deck en édition) |
| Session | `session.ts` (format `swblacksmith/session` : composer, écrire, relire), `sessionOptimizer.ts` (photo de l'Optimiseur), `telechargement.ts` (un texte téléchargé en fichier) |
| Fichiers exportés | `formatsExport.ts` (identifiant `swblacksmith/<nom>` écrit, l'ancien `sw-forge/<nom>` relu — lu par `rtaShare`, `recoShare`, `siegeShare`, `runeCurveShare`) |
| Divers | `effects.ts` (codes com2us → libellés), `crafts.ts`, `gearSync.ts`, `detecteurDebordement.ts` (dev seulement), `migrationStockage.ts` (clés de stockage de l'ancien nom) |

---

## 7. Style — `index.css` + `tailwind.config.js`

Source de vérité du rendu : [`spec/shared/design.md`](spec/shared/design.md).

- ⚠️ **Les tokens sont des TRIPLETS RGB**, consommés avec `<alpha-value>`. Écrits
  en hexadécimal, Tailwind n'émet **aucune** règle pour `bg-panel/50`.
- **Deux thèmes** : Forge (sombre) / Atelier (clair), + `data-theme` forcé.
- **Accent contextuel `--ctx`** : posé par un `data-ctx` sur un ancêtre. Un
  composant écrit `text-ctx` sans rien savoir de l'élément courant.
- **Variantes maison** : `hoverable:` (remplace `hover:`), `no-hover:`,
  `coarse:` (cibles), `compact:` (densité). ⚠️ `coarse` et `compact` valent tous
  deux `(pointer: coarse)` : **le pointeur décide, jamais la largeur**. La
  largeur (`lg:` = 1024 px) ne pilote que la **navigation**.
- **Échelle typo** : `nano` 10 (⚠️ `compact:` seulement) / `micro` 11 / `xs` 12 /
  `sm` 13 / `base` **15** / `lg` 17 / `xl` clamp.
- **Focus** : une règle globale de 1 px, désactivée là où une bordure marque déjà
  le focus.
- ⚠️ **`html` est le conteneur de défilement** (`body` a un `min-height` calculé).

### Pièges connus d'`index.css`

- ⚠️ **La famille `[data-tiroir]`** (panneau mobile) contient des règles
  **descendantes** qui touchent tout ce qui se trouve dedans — dont
  `[data-tiroir] .flex-col { align-items: flex-start }`, qui a décentré une
  modale entière. **Réponse structurelle : le portail.** Un dialogue ouvert
  depuis le panneau passe par `createPortal`, ce que `position: fixed` ne suffit
  pas à faire.
- ⚠️ **La règle des 40 px au doigt gonfle le cadre, pas le bouton** : d'où
  `data-cible-fine` sur les boutons internes de `BoutonGroupe`.
- ⚠️ **iOS zoome au focus** d'un `input`/`textarea` sous 16 px — **pas** d'un
  `select`. La règle des 16 px ne vise donc que les deux premiers.
- ⚠️ **L'ordre des classes dans l'attribut ne décide de rien**, seul l'ordre de
  la feuille compte : on ajoute un **axe** (`taille="carre"`) plutôt qu'un `p-0`
  en `className`.

---

## 8. Données et scripts

- `public/` : icônes d'éléments, icônes de jeu, portraits.
- `scripts/fetch-monsters.mjs`, `fetch-skills.mjs`, `link-collabs.mjs` —
  régénèrent les données depuis SWARFARM.
- `scripts/benchmark-*.mjs` — mesures de l'optimiseur.
- `scripts/inventaire-ui.mjs` + `scripts/lib/inventaire-comparer.mjs` —
  inventaire des points d'entrée visibles (textes, libellés, infobulles,
  routes) comparé à une référence figée ; `scripts/chemins-interdits.mjs` —
  ce qu'un lot de refonte ne touche pas. Chantier
  `spec/chantiers/refonte-graphique.md`.
- `scripts/lib/relicOracle.ts` — oracle de contrôle de la dimension relique : N recherches du moteur réel, une par principale éligible distincte, et point d'entrée CLI pour les mesures du chantier.
- `src/data/releases.ts` — le journal des versions, lu par l'accueil **et** la
  page Nouveautés.

---

## 9. Tests — `tests/`

`node tests/run.mjs`. Volontairement limités à ce qui serait **grave et
invisible** : vitesse de combat, lecture d'un export, stockage, conservation,
tris, optimiseur (dont un test différentiel).

⚠️ **Aucun test d'interface** — elle se vérifie à l'œil ; des tests d'affichage
ne feraient que figer le rendu du jour.

Une exception, qui ne fige PAS le rendu : `refonte-inventaire` refuse qu'une
entrée visible (texte, libellé, infobulle, route) **disparaisse** sans
déplacement déclaré ni décision écrite — la forme et la place restent libres.
Référence et déplacements : `spec/chantiers/refonte-graphique-preuves/`.

Même esprit pour les **tests de rendu** (`tests/rendu/`) : un vrai composant
affiché avec `react-dom/server` et des données d'exemple, interrogé sur le
SENS (texte, `aria-label`, `title`, `disabled`), jamais sur les classes ou la
disposition — ils vérifient qu'une fonctionnalité est là, pas à quoi elle
ressemble.
