# Preuve — lot 0 de la refonte graphique : garde-fous

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.0.
Base de référence : `6110609` (aucun fichier de `src/` modifié depuis :
`git diff --stat 6110609 -- src` → vide).

## Ce qui est livré

- `scripts/inventaire-ui.mjs` — extraction par le compilateur TypeScript des
  points d'entrée visibles de chaque `src/**/*.tsx`.
- `scripts/lib/inventaire-comparer.mjs` — comparaison pure (référence,
  courant, déplacements, décisions de retrait).
- `scripts/chemins-interdits.mjs` — logique, données, types et rendus du jeu.
- `inventaire-reference.json` — 80 fichiers, 1 756 entrées (967 `texte`,
  620 `attr`, 131 `prop`, 28 `route`, 10 `message`).
- `deplacements.json` — vide.
- Vérifications `testRefonteInventaireExtraction`,
  `testRefonteInventaireComparer`, `testRefonteInventaire`,
  `testRefonteCheminsInterdits` (filtre `refonte`).

## Commandes et sorties

```text
$ node scripts/inventaire-ui.mjs --ecrire
référence figée : 80 fichiers, 1756 entrées → spec\chantiers\refonte-graphique-preuves\inventaire-reference.json

$ node scripts/inventaire-ui.mjs --verifier
inventaire : aucune perte (référence retrouvée, déplacements faits, retraits décidés)

$ node scripts/chemins-interdits.mjs 6110609
chemins interdits : aucun modifié depuis 6110609

$ node tests/run.mjs refonte
35 vérifications passées

$ npx tsc --noEmit
(aucune sortie, code 0)
```

Déterminisme : deux `--json` successifs comparés par `cmp` → identiques.

## Preuve négative sur le vrai code

Altération temporaire de deux fichiers réels, puis `git checkout --` :
`libelle="Tout effacer"` → `"Vider"` dans `SiegeBoard.tsx`, et une ligne de
commentaire ajoutée à `src/lib/speed.ts`.

```text
$ node scripts/inventaire-ui.mjs --verifier
PERDU      src/components/siege/SiegeBoard.tsx :: attr:libelle:Tout effacer
(code 1)

$ node scripts/chemins-interdits.mjs 6110609
INTERDIT src/lib/speed.ts
(code 1)
```

Après restauration : `git status -s src` vide, les deux commandes rendent 0.

Le premier passage du test de comparaison a trouvé un défaut réel :
`decisionsRetrait` lisait toujours une section A.2 bis vide (la recherche
du titre suivant retombait sur le titre de A.2 bis lui-même). Corrigé avant
commit ; le test le couvre.

## Ce que l'inventaire ne voit pas — limites connues

- **Un texte construit par une fonction** n'est pas relevé : ex. l'infobulle
  de `LeadPill.tsx` (`title={leadTitle(ls)}`). Les **tests de rendu** le
  voient (ci-dessous : le bonus du leader apparaît dans le rendu du siège).
- **Une information sans texte** (couleur de statut, icône, grisé) :
  couverte par un test de rendu quand elle est exposée en sens, par le test
  de la logique qui la calcule sinon (A.2 « information portée par la
  forme »).
- **Un comportement déclenché par un clic** : le rendu serveur n'exécute ni
  clic ni effet. La logique ne bouge pas (chemins interdits) ; qu'un bouton
  soit présent, nommé et actif est testé, que son `onClick` reste branché
  se vérifie dans l'app.

## Tests de rendu (point 6)

`tests/rendu/outils-rendu.tsx` (rendre, texte visible, boutons avec
`aria-label` / `title` / `disabled`) ; `tests/run.mjs` définit désormais
`import.meta.env` pour les composants qui lisent `BASE_URL`.
`tests/rendu/siege.test.tsx` affiche le vrai `SiegeBoard` (défense et
offense) avec deux équipes réelles lues dans `public/data/monsters.json` via
le faux `localStorage`.

```text
$ node tests/run.mjs rendusiege
36 vérifications passées
```

Preuve négative : `libelle="Tout effacer"` → `"Vider"` dans
`SiegeBoard.tsx`, puis `git checkout --` :

```text
$ node tests/run.mjs rendusiegedefense
  KO   bouton « Tout effacer »
1 échec(s) sur 18 vérifications
```

## Amendement — captures abandonnées

Le point 6 prévoyait d'abord des captures d'écran de chaque route (bureau et
téléphone, clair et sombre). Elles ont été faites (92), puis **abandonnées
sur décision du mainteneur** : des captures mesurent l'apparence, pas les
fonctionnalités. Script et images supprimés ; les tests de rendu les
remplacent (cadrage A.6).
