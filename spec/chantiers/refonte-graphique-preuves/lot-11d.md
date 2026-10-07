# Preuve — lot 11d de la refonte graphique : téléphone · Speed tuning, Ressources, Paramètres, Bientôt

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), B.11. Décision
appliquée (A.2 bis) : **27** — Mécaniques (sommaire gardé), Nouveautés et
Paramètres au rendu du bureau (lot 10) ; Speed tuning, Bestiaire et Bientôt
sans changement prévu.

## Tests écrits AVANT (commit `e89fc4d9`)

`tests/rendu/telephone-outils-ressources.test.tsx`, 15 vérifications par
`auTelephone` : Speed tuning (règle, repère, camps, état vide), Bestiaire
(panneau « Filtrer le bestiaire », recherche, grille), Mécaniques
(sommaire), Nouveautés, Paramètres (compte, réglages, données, dix
boutons), Bientôt.

## Le lot, puis le retour du mainteneur

| Commit | Quoi | Retour du mainteneur |
|---|---|---|
| `c2b2f3ca` | décision 27 écrite dans le cadrage, avant le code | — |
| `baecb4ed` | Mécaniques : sections à filet au doigt, sommaire gardé | — |
| `a3811116` | Nouveautés : versions à filet au doigt | — |
| `c9436c21` | Paramètres : blocs « Réglages » et « Mes données » au doigt | capture du Speed tuning : « oula » |
| `a7da34ee` | Speed tuning : camps empilés sous `lg`, en-tête de camp qui passe à la ligne | « ok continue » |

Le défaut du Speed tuning datait d'avant la refonte (deux camps de 280 px
côte à côte dès 560 px) ; le relevé du 11d s'était fié à la maquette sans
regarder cette largeur intermédiaire — écart signalé au mainteneur.

Rien n'est retiré ; aucune assertion ne change.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs rendu                    → 768 vérifications passées
$ node tests/run.mjs RenduSpeedTune RenduTelephoneOutils speed-tune → 481 passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built ; ordre max-lg vérifié
```

**Lot 11d clos le 2026-09-28** sur « ok continue » du mainteneur.
