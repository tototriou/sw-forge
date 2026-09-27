# Preuve — lot 8b de la refonte graphique : Mon compte · Monstres et Artéfacts

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), section B.5 à
B.10. Décision appliquée (A.2 bis) : **20**, telle que Thomas l'a précisée
pour les runes, reprise sans nouvelle question (annoncé à Thomas avant le
code) : filtres visibles, jamais en menus ; en-tête de vue avec titre et
compteur ; chiffres clés en bandeau.

## Tests écrits AVANT (commit `bb30d069`)

`tests/rendu/compte.test.tsx`, rendu bureau, 59 vérifications. La fixture
comprend une box de 6 monstres (cinq éléments, un niveau non maximal) et
8 artéfacts (deux sortes, un intangible, trois raretés).

- **Box** : compte, recherche, tri « Sortie » / « A → Z » et ce qu'il fait,
  éléments, Nat, Doublons, 2A, ordre des cartes.
- **Artéfacts · Résumé** : les six chiffres clés, distribution, raretés,
  stats principales, par attribut et par type (intangible à part), quad
  rolls vides.
- **Artéfacts · Liste** : catégorie, attributs, types, raretés, stat
  principale, propriétés, sens du tri, compte par sorte, premier et dernier
  artéfact.

## Le lot, puis les retours de Thomas

| Commit | Quoi | Retour de Thomas |
|---|---|---|
| `2227712c` | Box : en-tête « Ma box » + compte en pastille ; recherche, filtres et tri sur une seule barre | capture : « ça va pas » — la recherche écrasée, le tri seul à la ligne |
| `ec5ec310` | Artéfacts : en-têtes « Résumé » et « Liste » + nombre d'artéfacts ; chiffres clés en bandeau (`Kpi bandeau`) ; les six rangées de filtres sur la ligne, intitulés à leur largeur ; spec « Onglet Résumé », qui manquait | — |
| `2498f8b0` | test `testRenduCompteSouris` (3) : les trois en-têtes | — |
| `aee4db26` | Box sur deux lignes : recherche à largeur fixe et tri, puis les filtres | « mets l'ordre à la suite des filtres » |
| `6c35a1b2` | Box : le tri sous les filtres, sur la ligne de la pagination (calée à droite) ; la ligne reste sans résultat ni seconde page | « ok good » |

Rien n'est retiré. Les 59 vérifications d'avant sont inchangées.

Non ajouté, faute de décision : « Effacer les filtres » dans la box et la
liste d'artéfacts (décidé pour les runes seulement). Proposé à Thomas, resté
sans réponse ; porté aux candidats du lot 13.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu-compte             → 62 vérifications passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; classes lg: émises
```

**Lot 8b validé par Thomas le 2026-09-28** (« ok good »).
Téléphone non regardé (lot 11).
