# Preuve — lot R5 du rebranding : l'accueil

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R5 ;
décisions 31 à 37. Script du scratchpad : `r5-verif.mjs`, 2026-09-29.

## 1. Relevé : la planche contre l'écran

| Zone | Toile | Notre accueil | Décision |
|---|---|---|---|
| Titre du héros | surtitre, « Forgé pour la guilde. », paragraphe | logo + nom, « La boîte à outils pour Summoners War. » | 31 : gardé |
| Droite du héros | illustration ; deux boutons sous le texte | zone de dépôt, aucun bouton | 32 : gardé |
| Sous le héros | bandeau de trois garanties | — | 33 : non |
| Outils | « L'atelier », six cartes | douze cartes compactes, couleurs de section | 34 : gardé |
| Étapes | « Trois coups de marteau », I · II · III | « Comment ça marche », 01 · 02 · 03 colorés | 35 : gardé |
| Téléphone | accueil réduit (héros, 4 tuiles, une garantie) | même structure, resserrée (décision 24 de la refonte) | 36 : gardé |
| Icônes des cartes | — | lucide | 37 : icônes d'atelier |

Absents de la toile et gardés sans question : « Ton espace » (les habitués),
le dernier appel et la dernière version.

## 2. Le changement

`HomePage.tsx` : les cartes de section — les douze fonctionnalités et les
quatre tuiles de « Ton espace » — prennent les icônes d'`IconesAtelier`,
celles de la nav (défense → bouclier, offense → épée, comme les onglets du
Siège). Les composants acceptent les deux familles d'icônes (type `Icone`) :
les étapes et le titre « Ton espace » gardent lucide, ce ne sont pas des
sections.

## 3. Vérifications

```text
npx tsc --noEmit                              → 0
node tests/run.mjs rendu accueil refonte      → 829 vérifications passées
node scripts/inventaire-ui.mjs --verifier     → aucune perte
npm run build                                 → built
```

Captures de la grille sur l'app construite, dans les deux thèmes
(`r5-verif.mjs`) : les douze icônes dans leurs tuiles colorées, lisibles.

## 4. Ce que je n'ai pas pu prouver

- « Ton espace » à l'œil : il n'apparaît qu'avec des données locales, que
  l'app construite n'avait pas.
