# Preuve — lot 11c de la refonte graphique : téléphone · Mon compte

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), B.11. Décision
appliquée (A.2 bis) : **26**, corrigée le même jour pour les Courbes —
résumés en carte de chiffres clés ; filtres des Courbes gardés dans la page ;
mode de l'Optimisation sur la page ; panneau des runes en deux blocs avec
« Effacer les filtres ». Ajouts de la maquette au lot 13.

## Tests écrits AVANT (commit `17c0ffbc`)

`tests/rendu/telephone-compte.test.tsx`, 23 vérifications par
`auTelephone` : Monstres (panneau « Filtrer ma box », recherche et tri sur la
page), Artéfacts (panneau « Filtrer mes artéfacts », compte, sens du tri ;
Résumé sans panneau), Runes (panneaux « Filtrer mes runes » et « Options
d'optimisation », filtres des Courbes dans la page, Comparaison, Résumé).

## Le lot

| Commit | Quoi |
|---|---|
| `74b1cb44` | décision 26 écrite dans le cadrage, avant le code |
| `170861df` | panneau « Filtrer mes runes » : « Trier » puis « Filtrer », « Effacer les filtres » (`EffacerFiltres`, extrait de `FiltresRunes`) ; règle CSS `order: -1` retirée |
| `8597bb65` | Optimisation : « Gemme + meule / Meule seule » en tête de page au doigt (`modeControl`) |
| `7bb97872` | Résumés : les six chiffres clés dans une carte sur deux colonnes au doigt (`CARTE_CHIFFRES_DOIGT`) |
| `0b199970` | décision 26 corrigée : les filtres des Courbes restent dans la page |

**Écart de méthode, corrigé** : la question des Courbes avait été posée sans
l'historique de `spec/compte/runes.md` (filtres déjà descendus dans le
panneau puis remontés). Relevé avant de coder, redemandé au mainteneur avec
l'historique : les filtres restent dans la page. Rien n'avait été codé.

Rien n'est retiré. **Deux assertions changent**, signalées au mainteneur —
écrites au début du lot, elles suivent les deux panneaux modifiés (ordre
« Trier » puis « Filtrer » ; mode sorti du panneau de l'Optimisation),
chacune complétée par une vérification du nouvel emplacement.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu                    → 753 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; ordre max-lg vérifié
```

**Lot 11c clos le 2026-09-28** sur « ok continue » du mainteneur.
