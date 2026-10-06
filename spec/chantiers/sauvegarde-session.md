# Cadrage — la sauvegarde de session

**Statut :** CHANTIER en cours — branche forge/sauvegarde-session

## Partie A — préambule commun (le brief de chaque lot)

### A.1 Pourquoi

Thomas veut que l'utilisateur puisse **tout sauvegarder à un instant donné,
comme dans un jeu**, choisir où le fichier est enregistré, puis **recharger
cette session** plus tard (2026-10-06). Aujourd'hui, rien ne réunit l'état de
l'app en un fichier. Mesuré le 2026-10-06 sur `forge/application-bureau`
(`git grep`) :

| Ce qui existe | Où | Exportable aujourd'hui |
|---------------|----|------------------------|
| Prépa RTA, ses catégories, sa sauvegarde interne | `localStorage` (`swblacksmith-rta-v1`, `-rta-categories-v1`, `-rta-backup-v1`, `-rta-import-v1`) | la prépa seule (`swblacksmith/prepa-rta`) |
| Équipes de siège, défense et offense | `localStorage` (`-siege-defense-v1`, `-siege-offense-v1`) | oui (`swblacksmith/siege-equipes`) |
| Recommandations | `localStorage` (`-siege-recos-v1`) | oui (`swblacksmith/recommandations`) |
| Monstres perso, listes de travail de l'Optimizer | `localStorage` (`-custom-monsters-v1`, `-optimizer-lists-v1`) | non |
| Réglages : thème, score, overcap, adversaire de référence, conservation | `localStorage` (5 clés) | non |
| Compte importé (box, inventaire, reliques…) | IndexedDB, base `swblacksmith`, clé `current` (`src/lib/accountStore.ts`) | non (réimport SWEX) |
| État des outils : speed tuning, filtres et vues des écrans du compte, critères de l'Optimizer | **mémoire seulement** : `useStickyState` (17 appels, 8 fichiers), `useOptimizerState` | non — perdu au rechargement |

Ce qui est sur le disque ne survit que si « Garder mes données » est
activé ; ce qui est en mémoire ne survit jamais au rechargement.

### A.2 Cible et périmètre

**Cible**, vérifiable :
- « **Sauvegarder la session** » écrit UN fichier qui contient tout ce que
  Thomas a retenu (décision 2) ; « **Charger une session** » le relit et
  rend l'app dans l'état sauvegardé — vérifié par un aller-retour
  sauvegarder → tout effacer → charger → comparer, champ par champ ;
- sur le **site** comme dans l'**application de bureau**, avec un seul code :
  téléchargement et sélecteur de fichier ; dans l'app, la boîte
  « Enregistrer sous » existe déjà (navigation.ts, chantier
  application-bureau) ;
- dans l'app, **Ctrl+S** réécrit le fichier de la session ouverte sans
  redemander, « Sauvegarder sous… » demande où (décision 4) ;
- le chargement ne perd jamais rien sans choix : « Sauvegarder d'abord /
  Charger / Annuler » (décision 3) ;
- un fichier d'une version ultérieure, abîmé ou d'un autre format est
  refusé avec un message, sans rien toucher ;
- spec d'état actuel, ARCHITECTURE.md, notes de la 2.0.0 à jour.

**Hors périmètre** : la synchronisation entre appareils, plusieurs
« emplacements » de sauvegarde gérés par l'app, la sauvegarde automatique ;
les exports existants (prépa, équipes, recos, courbes), qui restent tels
quels ; le dossier SW Exporter.

**Intouchable** : les formats d'export existants et leur relecture ; le
comportement de « Garder mes données ».

### A.3 Hiérarchie des priorités

1 ne rien perdre (la session en cours, un fichier relu) · 2 un fichier
relisable par les versions suivantes (format versionné, champs inconnus
ignorés) · 3 erreurs dites, jamais silencieuses · 4 un seul code site / app
· 5 taille du fichier.

### A.4 Catégories de lots

M mécanique, C classification, J jugement. Les lots sont menés dans la
session principale, sans sous-agent (comme le chantier application-bureau),
sauf décision contraire de Thomas. La catégorie dit le niveau de preuve.

### A.5 Branche, fichiers transverses

Branche `forge/sauvegarde-session`, **partie de `release/v2.0.0`** une fois
le chantier application-bureau fusionné (décision 1) — et non de `main` :
elle s'appuie sur la 2.0.0 (clés `swblacksmith-*`, application de bureau).
`release/v2.0.0` reçoit aussi le travail du collaborateur de Thomas : avant
chaque fusion, branche et push, `git fetch` et vérifier ce qu'elle a reçu ;
son travail fait référence.

Fichiers transverses portés par ce chantier : `src/App.tsx`, `package.json`,
`ARCHITECTURE.md`, `spec/README.md`, `src/data/releases.ts`.

### A.6 Si une vérification échoue, si un cas est ambigu

Vérification échouée → pas de commit. Cas non prévu → on garde le
comportement actuel, on l'écrit dans A.8 et dans le rapport. Jamais un
chargement qui écrase sans avoir lu et validé tout le fichier d'abord.

### A.6 bis Preuves

`spec/chantiers/sauvegarde-session-preuves/lot-<n>.md` : H1, en-tête
`**Statut :** CHANTIER en cours — branche forge/sauvegarde-session`,
commandes, sorties, captures `lot-<n>-*.png`.

### A.7 Ordre, dépendances, suivi

`A → B : B requiert A`.

```text
1 → 2 (sauvegarder écrit le format du lot 1)
1 → 3 (charger relit le format du lot 1)
2 → 3 (« Sauvegarder d'abord » réutilise la sauvegarde)
3 → 4 (Ctrl+S réécrit la session OUVERTE, qu'ouvre le chargement)
{1 … 4} → 5 (clôture)
```

| Lot | Cat. | Statut | Commit / date |
|-----|------|--------|---------------|
| 1 le format de session : ce qu'il contient, le lire, l'écrire | J | **validé par Thomas** (« ok ») — `swblacksmith/session` v1, 40 tests, 2,68 Mo avec un vrai compte | `38d32f05`, 2026-10-06 |
| 2 sauvegarder (site et app) | J | à faire | |
| 3 charger : « Sauvegarder d'abord / Charger / Annuler » | J | à faire | |
| 4 l'app de bureau : Ctrl+S, « Sauvegarder sous… », session ouverte | J | à faire | |
| 5 clôture : spec d'état actuel, `npm test`, fusion dans `release/v2.0.0` | M | à faire | |

### A.8 Décisions et questions ouvertes

**Décisions de Thomas (2026-10-06)** :

1. **Dans la 2.0.0**, après la clôture du chantier application-bureau ;
   branche partie de `release/v2.0.0`.
2. **Tout dans la sauvegarde** : le compte importé, tout le travail (prépa
   RTA et catégories, siège, recos, monstres perso, listes de l'Optimizer),
   les réglages, l'état des outils.
3. **Charger** : « Sauvegarder d'abord / Charger / Annuler », le bouton par
   défaut ne perd rien.
4. **Comme un jeu** : dans l'app, « Sauvegarder » (Ctrl+S) réécrit le
   fichier de la session chargée ou déjà sauvée, sans redemander ;
   « Sauvegarder sous… » demande où. Le site demande toujours.

**Décisions du relevé du lot 1 (2026-10-06)** :

5. **Q1 → l'état des outils, tout sauf l'interface** : speed tuning, critères
   de l'Optimizer (sa recette, `buildOptimizerRecipe` /
   `parseOptimizerRecipe`), filtres et vues des écrans du compte, recherche
   des recos, leads de l'ordre de tour, prépa d'un ami chargée. Pas la barre
   latérale repliée ni l'avertissement mobile fermé (propres à l'appareil) ;
   pas les résultats de l'Optimizer (ils se recalculent). Relevé : une
   cinquantaine de clés `useStickyState`, dont une quinzaine de `Set`.
6. **Q2 → un `.json` daté** : `swblacksmith-session-AAAA-MM-JJ-HHhMM.json`,
   format `swblacksmith/session` dans le fichier, comme les autres exports.

**Questions ouvertes** (à trancher au relevé du lot indiqué) :

- **Q3 → lot 2.** Où vivent les boutons : Réglages « Mes données », la
  palette Ctrl K, la carte du compte.
- **Q4 → lot 3.** Charger quand « Garder mes données » est refusé : la
  session vit en mémoire jusqu'à la fermeture, ou le chargement propose de
  la garder.

## Partie B — les lots

### Lot 1 — le format de session · J

**Intrant** : A ; les hooks de persistance (`src/hooks/use*State.ts`,
`useRtaCategories.ts`, `useSiegeRecos.ts`, `useCustomMonsters.ts`,
`useOptimizerLists.ts`, `usePersistence.ts`), `src/lib/accountStore.ts`,
`src/hooks/useStickyState.ts`, `src/hooks/useOptimizerState.ts` (la forme de
l'état, pas tout le fichier), `src/lib/formatsExport.ts`.

**Sortie** : un module pur `session.ts` dans `src/lib` — le format
`swblacksmith/session` (version 1) : `composerSession(sources)` et
`lireSession(texte)` → session validée ou erreur dite ; ce que contient
chaque section ; Q1 et Q2 tranchées par Thomas au relevé.

**Preuve** : `lot-1.md` — tests purs : aller-retour composer → texte → lire
identique sur un état complet (fixture), fichier abîmé, autre format,
version ultérieure, champ inconnu ignoré ; taille mesurée avec un vrai
compte.

**Ne fait pas** : aucun bouton, aucune écriture dans l'app.

**Résultat (2026-10-06)** — `38d32f05`, validé par Thomas, preuve
[lot-1.md](sauvegarde-session-preuves/lot-1.md) ; spec d'état actuel
[shared/sauvegarde-session.md](../shared/sauvegarde-session.md). 40 tests ;
aller-retour identique avec le vrai compte du développeur, 2,68 Mo.
Mutation du pilote (version plus récente acceptée) : 1 échec sur 40 —
restaurée. Écarts :
- les quatre réglages ne sont pas du JSON (`dark`, `score`, `0`/`1`) :
  validation par clé (`valeurStockageValide`), découvert avant les tests ;
- `compteValide` extraite de `loadAccount` (pure, partagée) ; `stockage`
  59 passées ;
- la photo de la mémoire et sa restauration restent aux lots 2 et 3.

### Lot 2 — sauvegarder · J

**Intrant** : A, le lot 1, Q3, `src/components/SettingsMenu.tsx`, la
palette.

**Sortie** : « Sauvegarder la session » (site : téléchargement ; app : la
boîte « Enregistrer sous » existante) ; spec à jour.

**Preuve** : `lot-2.md` — le fichier produit relu par `lireSession`, sur le
site (Playwright) et dans l'app (mode preuve) ; captures.

**Ne fait pas** : Ctrl+S et la session ouverte (lot 4).

### Lot 3 — charger · J

**Intrant** : A, lots 1 et 2, Q4, les hooks de persistance, `src/App.tsx`
(cycle de vie du compte).

**Sortie** : « Charger une session… » → lecture et validation complètes,
puis « Sauvegarder d'abord / Charger / Annuler » ; l'app rendue dans l'état
du fichier (stockage, compte, mémoire).

**Preuve** : `lot-3.md` — aller-retour dans l'app et sur le site :
sauvegarder → tout effacer → charger → chaque section comparée ; un fichier
refusé ne touche rien (état avant = état après).

**Ne fait pas** : la session ouverte et Ctrl+S (lot 4).

### Lot 4 — l'app de bureau : Ctrl+S · J

**Intrant** : A, lots 2 et 3, `bureau/`.

**Sortie** : la « session ouverte » (chemin retenu par le processus
principal), Ctrl+S qui la réécrit sans demander, « Sauvegarder sous… »,
Ctrl+O ; le nom de la session visible.

**Preuve** : `lot-4.md` — mode preuve : charger, modifier, Ctrl+S, relire le
fichier ; « Sauvegarder sous » vers un autre chemin.

**Ne fait pas** : rien sur le site (il demande toujours).

### Lot 5 — clôture · M

**Sortie** : spec d'état actuel, ARCHITECTURE.md, notes de la 2.0.0, ligne du
README des specs, `npm test` complet, fusion `--no-ff` dans
`release/v2.0.0` (après `git fetch`).
