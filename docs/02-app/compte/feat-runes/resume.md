# Runes — onglet Résumé

Partie de [Mon compte — Runes](README.md).

## Onglet Résumé — `RunesSummary`

Vue d'ensemble **chiffrée** de l'inventaire : où en est le compte d'un coup d'œil,
sans parcourir les runes. **Aucun filtre** (volontairement global), **aucune
pagination** (rien n'est rendu par rune → un seul passage mémoïsé sur l'inventaire,
fluide à ~2000 runes). Fichier :
[RunesSummary.tsx](src/components/account/RunesSummary.tsx).

⚠️ **À la SOURIS** :
- un **en-tête** : « Résumé » et le nombre de runes ;
- les six chiffres clés dans **un bandeau** (`Kpi bandeau`) : des cases
  séparées par un filet ;
- **trois colonnes** : Distribution · Qualité du stock · Marge de
  progression, puis Par emplacement et Stats principales (sur deux
  colonnes), puis Par set sur toute la largeur ;
- **Par emplacement** en barres verticales : la hauteur suit l'efficience
  moyenne ; le nombre de runes et le maximum sont écrits sous chaque barre.

L'ordre de la souris est posé par `lg:order-*`. Au doigt, une colonne, et les
cartes par slot. ⚠️ **Au doigt, les six chiffres clés dans UNE carte** : deux
colonnes (trois dès `sm`), les cases séparées par un filet d'1 px venu de
l'écart de la grille sur fond `border-soft` (`CARTE_CHIFFRES_DOIGT`,
`SummaryBits.tsx`) — un seul trait entre deux cases, aucun contre le bord.
Même traitement au Résumé des artéfacts. Le choix de la mesure n'est pas dans
la page : c'est un réglage du ⚙.

Blocs, dans l'ordre :

1. **Chiffres clés** (6 tuiles) : nombre de runes (+ nb au **+15**) ·
   **efficience moyenne du top 400** (+ médiane du même top) ·
   **efficience moyenne du top 100** (+ `top 10 : X %`) · **meilleure**
   (+ nb ≥ 110 %) · **nb ≥ 100 %** (+ part) · **antiques** (+ part).

   > ### ⚠️ Les moyennes portent sur un TOP, jamais sur l'inventaire entier
   >
   > Une moyenne sur **toutes** les runes mesure surtout la **quantité de déchet
   > stocké** : farmer sans jeter la fait baisser, jeter la fait monter — alors
   > que le compte n'a pas bougé d'un point. Elle ne dit rien de la qualité, et
   > n'est donc **plus affichée du tout**.
   >
   > `TOP_N = 400` ≈ ce qu'un compte mûr **équipe réellement** (6 runes × ~65
   > monstres joués). En dessous de 400 runes, le top vaut l'inventaire entier —
   > la valeur reste juste, seul le libellé perd son « top 400 ».
   >
   > La **médiane suit le même périmètre** que la moyenne affichée : mélanger
   > moyenne du top et médiane globale donnerait deux nombres incomparables.
   >
   > ⚠️ Le sous-titre du top 100 s'écrit **« top 10 : X % »**, deux-points
   > compris : sans lui, « top 10 126.1 % » se lit comme un seul nombre.
2. **Distribution d'efficience** : barres par palier **≥ 110 · 100–110 · 90–100 ·
   80–90 · 70–80 · < 70 %**, avec effectif et part du stock.
3. **Qualité du stock** : barres *montées au +15* · *4 substats révélés* ·
   *gemmées* (≥ 1 substat `enchant`) · *antiques* ; puis une **barre empilée des
   raretés** aux couleurs du jeu (`RARITY_META`) + légende chiffrée.
4. **Par emplacement** : une tuile par slot 1→6 (effectif, efficience moyenne,
   meilleure).
5. **Stats principales (slots 2 · 4 · 6)** : répartition des mainstats, triée par
   volume. Les slots **impairs sont exclus** (mainstat figée : 1 ATQ, 3 DEF, 5 PV).
6. **Marge de progression** : efficience moyenne actuelle vs **potentiel moyen
   légendaire** (gemme + meule) avec le delta en points, **sur les mêmes 400
   meilleures runes des deux côtés** — comparer le top 400 actuel au potentiel de
   tout l'inventaire n'aurait aucun sens · **meules à poser**
   (runes dont le potentiel *meule seule* dépasse l'actuel) · **gemmes à poser**
   (runes non gemmées). Réutilise `runePotential` de
   [runeOptim.ts](src/lib/runeOptim.ts) → cohérent avec l'onglet Optimisation.
7. **Par set** : une tuile par set **présent** dans l'inventaire (icône + accent de
   la couleur du set), effectif, efficience moyenne et max, **triée par volume**.
