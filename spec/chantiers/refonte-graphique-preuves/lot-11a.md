# Preuve — lot 11a de la refonte graphique : téléphone · Accueil et RTA

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), B.11 (découpage
`089c6203`). Décision appliquée (A.2 bis) : **24** — accueil gardé et
resserré ; RTA en rangées, choix de catégorie gardé ; panneau des
sous-sections en liste ; barre du haut section + page à gauche. Ajouts de
la maquette au lot 13.

## Tests écrits AVANT (commit `8d2552b4`)

- `tests/rendu/outils-rendu.tsx` gagne `auTelephone` : `matchMedia` d'un
  téléphone, `document`, portail rendu en place, le temps du rendu
  seulement — sans quoi les panneaux « Options » rendent `null` en rendu
  serveur. Aucun code de l'app modifié.
- `tests/rendu/telephone-accueil-rta.test.tsx`, 37 vérifications : Accueil
  (import, « Ton espace », étapes, tuiles, appel final) ; RTA fermée (choix
  de section sur chaque carte, sections, ordre de tour) et panneau « Ma
  prépa RTA » ouvert (actions dans l'ordre, « Reprendre » désactivé et
  pourquoi, bascules) ; « Ami ».

## Le lot

| Commit | Quoi |
|---|---|
| `8ab9ebfc` | décision 24 écrite dans le cadrage, avant le code |
| `8ce6f6b7` | barre du haut : section en petit au-dessus de la page, à gauche, tirée du fil du menu |
| `e249feb7` | panneau des sous-sections en liste : rangées de 52 px, retour en première rangée |
| `96a1e5ee` | accueil : même structure, marges et zone de dépôt resserrées (`max-lg:`) |
| `54049bff` | RTA : une rangée par monstre, nom rendu, choix de section gardé ; colonnes de 210 px passées de `sm:` à `lg:` (ordre dans le CSS construit) |

Rien n'est retiré. **Neuf assertions d'avant le lot changent**, signalées à
Le mainteneur : les titres attendus de « Mon compte » suivent la nouvelle barre
(« Mon compte · Runes Résumé » au lieu de « Runes · Résumé »), même
information.

Signalés au mainteneur, gardés dans le code et la spec : deux choix déjà essayés
puis abandonnés dans le passé — la liste du panneau (cibles mal délimitées)
et la RTA à une carte par ligne (trente monstres, trente lignes).

Écart de méthode : une ligne du cadrage modifiée par `sed` au lieu de
l'outil d'édition (`089c6203`), signalée ; résultat vérifié.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu                    → 696 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; ordre max-lg / compact / sm vérifié
```

**Lot 11a clos le 2026-09-28** sur « ok continue » du mainteneur.
