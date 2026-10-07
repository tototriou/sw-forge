# Preuve — lot 9a de la refonte : l'Optimizer (et 11e, son téléphone)

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), B.5 à B.10 et
B.11 ; rebranding, décision 64 (l'Optimizer revient dans la branche, sans
`origin/forge/implementation-relique`). Scripts du scratchpad :
`optim-sonde.tsx`, `r9a-optim-captures.mjs`, 2026-10-03.

## 1. Avant de toucher

Aucun test de rendu n'existait pour l'Optimizer. Premier commit du lot,
`c3910f40` : `tests/rendu/optimizer.test.tsx`, écrit sur le code actuel —
écran vide des Outils, outil sans monstre, un monstre et un set choisis,
réglages et partage, panneau « Options » au téléphone.

```text
node tests/run.mjs RenduOptimizer RenduTelephoneOptimizer → 68 vérifications passées
```

Captures sur l'app construite, compte réel (Lora, Fatal), 1440 px deux
thèmes, 390 px tactile.

⚠️ Les notes privées (`spec/outils/optimizer/invariants.md`) ne sont pas sur
cette machine : lot d'affichage seul, le moteur n'est pas touché.

## 2. Relevé : maquettes `Optimizer` et `Mobile-Optimizer` contre l'écran

L'écran suit déjà la grille de la maquette (deux colonnes 1,35 fr / 1 fr,
« Monstre & équipement » pleine largeur, mêmes cartes).

| Zone | Maquette | Notre écran |
|---|---|---|
| En-tête | titre « Optimizer », « Liste active » à droite | pas de titre : bandeau bêta, puis une phrase ; « Liste active » dans la carte du monstre |
| Lancement | barre en bas : pool retenu, « Arrêter », « Lancer la recherche » en aplat braise | carte « Objectif de recherche » en bas : objectif, « Rechercher » à contour braise, Exporter, Importer ; le pool juste au-dessus |
| Objectif | en tête de « Critères de recherche » | dans la carte du bas, avec « Rechercher » |
| Exclusion, Réglages avancés | un résumé de l'état dans l'en-tête de la carte | titre seul, contenu replié |
| Titres de carte | texte seul | pastille avec l'icône du jeu, puis le titre |
| Téléphone | conditions repliées (« 5 autres stats ») ; artéfacts résumés | toutes les conditions ; artéfacts dépliés |

Non proposés (décision 47 du rebranding, une fonction absente) : les combos
de sets suggérés (« Fatal + Blade · Fatal + Rage · Autre combo »), l'écart
« +18,4 % dégâts » sur les résultats.

## 3. Déjà décidé, appliqué sans question

- **Fichiers téléchargés** (rebranding, décision 14) :
  `swforge-optimizer-…` → `swblacksmith-optimizer-…`.
- ~~**Écran vide des Outils** (décision 60) : la clé à molette → les
  tenailles des Outils~~ — **abandonné** (décision 65, voir § 4).
- **Couleurs d'état** (43) : rien — l'Optimizer n'emploie déjà que `bad` et
  `warn`, aucune couleur d'élément pour un état.

## 4. Décision du mainteneur — aucun changement de rendu (rebranding, 65)

Les questions du relevé n'ont pas été posées : Le mainteneur les a arrêtées par
« je ne veux aucun changement de rendu par rapport à l'état actuel de la
page ». Les écarts du § 2 restent donc tels quels, et la décision 60
(icône de l'écran vide des Outils) est abandonnée : c'est la même page.

Seul changement, invisible à l'écran : le nom du fichier exporté
(`98d50547`), `swblacksmith-optimizer-<monstre>-<date>.json`. Montré avant
commit ; le mainteneur : « ok ».

```text
npx tsc --noEmit                                  → 0
node tests/run.mjs RenduOptimizer RenduTelephoneOptimizer OptimizerRecipe marque → 80 passées
node scripts/inventaire-ui.mjs --verifier         → aucune perte
node scripts/chemins-interdits.mjs 6110609        → aucun modifié
```

## 5. Ce que je n'ai pas pu prouver

- Le téléchargement réel du fichier renommé : vérifié dans le code (une
  seule ligne, `PREFIXE_FICHIER`), pas déclenché en capture.
- Les notes privées : absentes de cette machine, non relues.
