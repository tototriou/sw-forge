# Preuve — lot R10 du rebranding : les Outils

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R10 ;
décisions 43, 44, 47 et 60. Script du scratchpad : `r10-verif.mjs`,
2026-09-30.

## 1. Relevé — sans planche

La toile ne dessine ni le Speed tuning ni l'Arène : le lot applique les
décisions déjà prises.

| Règle | Relevé | Suite |
|---|---|---|
| Couleurs d'état (43) | `SpeedTuningSection`, `SpeedTuneModale`, `OutilsPage`, `ComingSoon` : aucune couleur d'élément ; les camps sont déjà en `good` / `bad` | rien |
| Icônes (44) | en-tête du Speed tuning au téléphone : `Timer` de lucide | → `IconeSpeedTuning` |
| | page Arène : `IconeArene` depuis le R4 | rien |
| | « Ton équipe » (`Users`), « En face » (`Swords`) : des camps, pas des sections ; le reste, des actions | lucide gardé |
| | écran vide des Outils (`Wrench`, « Aucune donnée de compte chargée ») : c'est l'Optimizer | **décision 60** : attend les lots 9a / 11e |
| Librairie | aucun `<button>`, `<input>` ni `<select>` natif ; un `<select>` évité à dessein, commentaire à l'appui | rien |

## 2. Le changement et sa validation

Commit `f1870822`, montré avant commit : capture de l'en-tête au téléphone
tactile (390 px, deux thèmes), une page à vérifier donnée au mainteneur ;
réponse : « ok ».

```text
npx tsc --noEmit                                  → 0
node tests/run.mjs RenduSpeedTune RenduTelephoneOutilsRessources navigation → 128 passées
node scripts/inventaire-ui.mjs --verifier         → aucune perte
node scripts/chemins-interdits.mjs 6110609        → aucun modifié
npm run build                                     → built
```

## 3. Ce que je n'ai pas pu prouver

- La modale du Speed tuning ouverte depuis le Siège au téléphone : même
  composant (`entete` désactivé en modale), non capturée.
