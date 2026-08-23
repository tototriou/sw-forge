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
| Dépendances runtime | `lucide-react` (icônes), `framer-motion`, `@vercel/analytics` |
| Node | ≥ 24 |
| Calcul lourd | 2 Web Workers (`src/workers/`) |
| Stockage | `localStorage` (prépa, équipes, réglages) + **IndexedDB** (compte importé) |

⚠️ **Pas de librairie de composants.** Tout `src/ui/` est écrit à la main.
Radix UI a été **validé mais jamais installé** — chantier en attente.

```
npm run dev            # serveur de dev
npm run build          # build de prod (⚠️ seul endroit où l'on voit le CSS réellement émis)
npm test               # = node tests/run.mjs
npm run fetch-data     # régénère les données monstres/skills depuis SWARFARM
npm run benchmark:optim
```

---

## 2. Le shell — `src/App.tsx`

Fichier central, gros et volontairement : il tient tout ce qui doit être partagé
entre pages.

- **Routing** `routeFromHash()` sur `window.location.hash`.
- **Nav** : barre latérale (`Sidebar`), barre supérieure (`TopBar`), onglets
  mobiles (`MobileTabs`), recherche de nav (`SidebarSearch`).
- **Repli de la barre supérieure : mesuré, pas fixé à un breakpoint**
  (`useLayoutEffect` + `ResizeObserver`).
- **États instanciés ici puis passés en prop** : `useRtaState`, `useSiegeState`,
  `useSiegeRecos`, `useOptimizerState`, `useMonsters`, `useCustomMonsters`.
  C'est ce qui permet à un import de compte d'alimenter RTA + siège + compte
  d'un seul geste.
- **Import de compte global** (`importAccount`) et **`clearAllData()`**.

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
| **RTA** | `#/rta` | `pages/RtaPage.tsx` | tout `components/rta/` | `spec/rta/` |
| **Siège** | `#/siege/defense`, `/offense`, `/recommandations` | `pages/SiegePage.tsx` | tout `components/siege/` | `spec/siege/` |
| **Mon compte** | `#/compte`, `/runes`, `/artefacts` | `pages/AccountPage.tsx` | tout `components/account/` | `spec/compte/` |
| **Outils** | `#/outils/optimizer`, `/speed-tuning` | `pages/OutilsPage.tsx` | tout `components/outils/` | `spec/outils/` |
| Bestiaire | `#/bestiary` | `pages/BestiaryPage.tsx` | `MonsterGrid`, `FilterBar`, `SearchBar`, `MonsterDetailDialog`, `account/Pager` | `spec/bestiaire.md` |
| Paramètres | `#/parametres` | `pages/SettingsPage.tsx` | `SettingsMenu`, `AccountImportControl` | `spec/shared/navigation.md` |
| Mécaniques | `#/mecaniques` | `pages/MechanicsPage.tsx` | — (page statique) | `spec/mecaniques.md` |
| Nouveautés | `#/releases` | `pages/ReleasesPage.tsx` | `data/releases.ts` | `spec/releases.md` |
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
| `rta/RtaFriendView.tsx` | lecture d'une prépa partagée |
| `rta/DesyncBadge.tsx` | la vitesse saisie ≠ les runes importées |

Hooks : `useRtaState`, `useRtaCategories`, `useRtaBackup`, `useRuneMetric`,
`useOvercapDisplay`, `useStickyState`.
Lib : `rtaShare`, `speed`, `stats`, `gearSync`, `artifacts`, `monsterForms`.

**Siège** — `siege/SiegeBoard.tsx` (défense/offense), `siege/SiegeTeam.tsx`,
`siege/RecoBoard.tsx` + `siege/RecoCard.tsx` (recommandations),
`siege/LeadPill.tsx`. Hooks `useSiegeState`, `useSiegeRecos`. Lib `recoMatch`,
`recoSearch`, `recoShare`, `recoFromSiege`, `ownedBuilds`.

**Mon compte** — `account/RunesSection.tsx` et `account/ArtifactsSection.tsx`
sont les deux racines ; dessous : `RunesList`, `RunesSummary`, `RunesCurve` +
`CurveChart` + `curveColors`, `RunesCompare`, `RunesOptim`, `SetFilter`,
`SlotFilter`, `SubSearchBar` + `SubSearchDialog`, `Pager`, `SummaryBits`,
`ArtifactsList`, `ArtifactsSummary`. Lib `accountStore` (IndexedDB),
`accountViews`, `runeSort`, `runeOptim`, `monsterSort`, `crafts`.

**Optimiseur** — `outils/OptimizerSection.tsx` (racine), `SetComboPicker`,
`MonsterGearPicker`, `BuildCandidateCard`. Hook `useOptimizerState` +
`useBuildOptimSearch`. Moteur `lib/runeBuildOptim.ts`, exécuté dans
`workers/runeBuildOptim.worker.ts` et `workers/buildHalf.worker.ts`.
⚠️ Jamais audité en mobile.

**Speed tuning** — `outils/SpeedTuningSection.tsx` (racine). Calcul pur
`lib/speedTune.ts` (règle des ticks + simulation « un seul monstre par tick »,
testé dans `tests/speed-tune.test.ts`), vitesse de combat via `lib/speed.ts`.
Ne dépend pas d'un compte importé — mais sait **importer une équipe de siège**
dans « Ton équipe » (`lib/speedTuneDeck.ts`, même fichier de test).

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
| `Option.tsx` | choix riche : icône + titre + explication |
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
`ArtifactIcon`, `ArtifactFrameIcon`, `ArtifactSlots`, `ElementIcon`, `InventaireIcon`,
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
| `usePersistence` | **un seul interrupteur** pour toute conservation ; ⚠️ aucun hook n'appelle `localStorage.setItem` directement |
| `useStickyState` | état conservé en mémoire à travers la navigation, sans persister |
| `useRuneMetric`, `useOvercapDisplay`, `useTheme` | réglages globaux (menu ⚙) |
| `useMediaQuery` | une media query lue depuis React |
| `useScrollBloque` | ⚠️ **compteur de verrous** — blocage du défilement, verrou `position: fixed` sur `body` (iOS ignore `overflow: hidden` au toucher) |
| `useClavierOuvert` | clavier virtuel déployé ? via `visualViewport` |
| `useRecalageEcran` | ramène dans l'écran un flottant qui déborde par la droite |
| `useComboboxNav` | ↑/↓/Entrée/Échap des barres de recherche à suggestions |

---

## 6. Calcul — `src/lib/`

Fonctions **pures**, testables sans rendu. C'est ici que va toute logique, jamais
dans un composant.

| Domaine | Fichiers |
|---|---|
| Vitesse & stats | `speed.ts` (source de vérité), `stats.ts` |
| Runes | `runeOptim.ts`, `runeBuildOptim.ts`, `runeSort.ts`, `runeCurveShare.ts` |
| Artéfacts | `artifacts.ts` |
| Import de compte | `importAccount.ts` (parse SWEX), `applyAccount.ts` (→ états), `accountStore.ts` (IndexedDB), `accountViews.ts` |
| Monstres | `monsterForms.ts`, `monsterSkills.ts`, `monsterSort.ts`, `collabPairs.ts` |
| Siège / recos | `recoMatch.ts`, `recoSearch.ts`, `recoShare.ts`, `recoFromSiege.ts`, `ownedBuilds.ts` |
| Divers | `effects.ts` (codes com2us → libellés), `crafts.ts`, `gearSync.ts`, `detecteurDebordement.ts` (dev seulement) |

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
- `src/data/releases.ts` — le journal des versions, lu par l'accueil **et** la
  page Nouveautés.

---

## 9. Tests — `tests/`

`node tests/run.mjs`. Volontairement limités à ce qui serait **grave et
invisible** : vitesse de combat, lecture d'un export, stockage, conservation,
tris, optimiseur (dont un test différentiel).

⚠️ **Aucun test d'interface** — elle se vérifie à l'œil ; des tests d'affichage
ne feraient que figer le rendu du jour.
