# Preuve — lot 13 de la refonte graphique : ajouts décidés

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [refonte-graphique.md](../refonte-graphique.md), B.13. Décisions
(A.2 bis et B.13) : **28** — parmi les candidats, retenus « Effacer les
filtres » (box, artéfacts) et le filtre par section de la RTA au téléphone ;
**29** — périmètre des trois ajouts de A.2 bis, fichiers permis hors A.2
écrits avant le code, [retrait #29] des quatre confirmations remplacées par
« Annuler ».

## Spec avant le code, puis le code

| Commit | Quoi |
|---|---|
| `54373494` | décision 28 (candidats retenus) |
| `d1fa0c1b`, `41b5cb02` | « Effacer les filtres » : spec, puis box et liste d'artéfacts ; test `testRenduCompteEffacerFiltres` |
| `71458d3c`, `3b8ca2f3` | filtre par section RTA au téléphone : spec, puis code ; test `testRenduTelephoneRtaFiltre` |
| `c97caede` | décision 29, specs des trois ajouts, fichiers permis (cadrage et `chemins-interdits.mjs`) |
| `9123d0b0` | « Sauvegardé il y a … » ; tests `testIndicateurSauvegarde`, `testRenduRtaIndicateur` |
| `3a473569` | hooks : `restaurerMonstre`, `restaurerEquipe`, `restaurerReco`, `restaurerDeck` ; règles pures testées (`testRestauration`) |
| `92eb978e` | correction du 11b : « Vérifier mes speed » sur l'`Interrupteur` de la librairie |
| `6e0294ad` | « Annuler » : `src/ui/Notification.tsx`, quatre suppressions branchées, confirmations retirées ([retrait #29]) ; test `testRenduUiNotification` |
| `6384885f` | palette Ctrl K : pages, monstres, actions ; champ de la barre et loupe du téléphone ; tests `testPalette`, `testRenduPalette` |

Fichiers hors A.2 touchés : `src/hooks/useRtaState.ts`,
`src/hooks/useSiegeRecos.ts` (permis par la décision 29),
`src/hooks/useSiegeState.ts` (déjà permis).

Limite signalée au mainteneur : « Créer une recommandation » depuis la palette
crée et ouvre la page, sans ouvrir la carte en édition.

Écarts de méthode, signalés : deux modifications de fichiers du dépôt par le
shell (`sed`, `cat >>`) au lieu de l'outil d'édition ; contenu vérifié.

```text
$ npx tsc --noEmit                            → code 0
$ node tests/run.mjs Palette rendu            → 805 vérifications passées
$ node tests/run.mjs Restauration IndicateurSauvegarde → passées
$ node scripts/inventaire-ui.mjs --verifier   → aucune perte (retraits #29, déplacements déclarés)
$ node scripts/chemins-interdits.mjs 6110609  → aucun modifié hors permis
$ node scripts/spec-lint.mjs                  → aucune erreur
$ npm run build                               → built
```

**Lot 13 clos le 2026-09-28** sur « ok » du mainteneur.
