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
  de `LeadPill.tsx` (`title={leadTitle(ls)}`), des libellés calculés dans
  `src/lib/`. Les chaînes de `src/lib/` sont protégées autrement : le fichier
  est un chemin interdit, il ne change pas.
- **Une information sans texte** (couleur de statut, badge, icône, grisé) :
  couverte par la liste de A.2 « information portée par la forme » et la
  relecture des captures, lot par lot.
- **Un comportement** (ce qu'un clic déclenche) : la logique ne bouge pas
  (chemins interdits) ; le branchement du contrôle à cette logique se
  vérifie à l'œil sur les captures et au clic, lot par lot.

## Non fait dans ce lot

Les **captures « avant »** (B.0, point 6) : elles exigent de piloter un
navigateur (`run-sw-forge`), ce qui demande l'accord explicite de Thomas —
demandé, pas encore donné. Aucun lot visuel ne démarre sans elles.
