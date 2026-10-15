# Runes — onglet Résumé

Partie de [Mon compte — Runes](README.md).

## Onglet Résumé — `RunesSummary`

Vue d'ensemble **chiffrée** de l'inventaire : où en est le compte d'un coup d'œil,
sans parcourir les runes. **Aucun filtre** (volontairement global), **aucune
pagination** (les chiffres ne rendent rien par rune → un seul passage mémoïsé
sur l'inventaire, fluide à ~2000 runes ; seuls les builds les plus rapides
dessinent des runes, 6 par carte et au plus 10 cartes par combinaison). Fichier :
[RunesSummary.tsx](src/components/account/RunesSummary.tsx).

⚠️ **À la SOURIS** :
- un **en-tête** : « Résumé » et le nombre de runes ;
- les six chiffres clés dans **un bandeau** (`Kpi bandeau`) : des cases
  séparées par un filet ;
- **trois colonnes** : Distribution · Qualité du stock · Marge de
  progression, puis Par emplacement et Stats principales (sur deux
  colonnes), puis Par set sur toute la largeur ;
- **Par emplacement** en barres verticales : la hauteur suit l'efficience
  moyenne ; le nombre de runes et le maximum sont écrits sous chaque barre ;
- **Builds les plus rapides** en dernier, sur toute la largeur.

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
8. **Builds les plus rapides** — pleine largeur, en dernier aux deux formats.
   Voir la section suivante.

## Builds les plus rapides — `BuildsRapides`

Pour chaque combinaison de sets choisie, les builds de 6 runes les plus
rapides du compte. Fichiers : le calcul dans
[buildsRapides.ts](src/lib/buildsRapides.ts), le bloc dans
[BuildsRapides.tsx](src/components/account/BuildsRapides.tsx), le réglage
dans [useBuildsRapides.ts](src/hooks/useBuildsRapides.ts) et sa fenêtre
[DialogueBuildsRapides.tsx](src/components/DialogueBuildsRapides.tsx).

### Ce qui est calculé

- **VIT d'un build** = 100 + VIT des 6 runes + bonus Swift (`ceil(100 × 25 %)`
  = +25 quand Swift est actif). Un monstre **fictif de base 100**, sans totem ni
  lead : on compare des runes, pas des monstres. La VIT d'une rune vient de
  `runeContribution(rune, 'spd')` (principale, innée, secondaires, meules et
  gemmes comprises), la source de l'Optimizer.
- **#1** : le build le plus rapide de la combinaison. **#2** : le plus rapide
  **sans aucune rune du #1** ; #3 sans celles du #1 et du #2, etc. On s'arrête au
  nombre choisi, ou plus tôt si plus aucun build ne se forme.
- ⚠️ **L'exclusion vaut DANS une combinaison seulement.** Chaque combinaison
  repart de tout l'inventaire : une même rune Swift peut figurer dans Swift +
  Will et dans Swift + Shield. C'est le choix validé.
- ⚠️ **Le #k est le meilleur build sans les runes des k−1 premiers**, pas la
  répartition qui maximiserait la somme des k builds : un #1 plus lent pourrait
  laisser un meilleur #2. On veut voir le meilleur build du compte en premier.
- À VIT égale : la meilleure efficience totale, puis le plus petit `rune_id`
  slot par slot (`comparerBuilds`). Le résultat est donc déterministe.
- **Intangible** compte comme joker, une seule rune par build, et seulement là
  où le jeu active le set à coup sûr (règle d'`activeSets`, effects.ts).
- **Broken** (« Swift + Broken ») : 4 pièces du set, et 2 runes de n'importe
  quel set. Le terme de la communauté, gardé tel quel.

### Comment

À rôles de slot fixés (4 Swift + 2 Will, par exemple), les slots sont
indépendants, puisqu'une rune n'a qu'un slot : le meilleur build est la
meilleure rune de chaque slot pour son rôle. Le calcul énumère donc les
**répartitions de rôles** qui activent la combinaison, et elles seules :

| Combinaison | Répartitions (A = set 4 pièces, J = Intangible) |
| --- | --- |
| A + B | 4A+2B · 3A+J+2B · 4A+J+B |
| A + Broken | 4A + 2 libres · 4A + 1 libre + J · 3A+J+2S (S un set 2 pièces) |

⚠️ Avec 3A+J en Broken, les deux runes restantes ne doivent laisser **aucun
autre set incomplet**, sinon le joker ne complète rien. Deux runes d'un même
set 2 pièces le complètent ; tout autre cas revient à 4A, ou fait échouer le
joker. « Libre » exclut Intangible : la seconde rune Intangible passe par J.

- L'inventaire des répartitions est vérifié contre une énumération de tous les
  6-uplets de runes ([builds-rapides.test.ts](tests/builds-rapides.test.ts)).
- **Coût** : ~4 ms pour les 9 combinaisons × 5 builds, ~6 ms × 10 builds, de
  500 à 4 000 runes (mesuré sur le pool synthétique). Un `useMemo` suffit,
  sans Worker. Aucune constante de plafond : le calcul est exact.

### Réglage

Les combinaisons affichées, dans leur ordre, et le **nombre de builds par
combinaison** (1 à 10, 5 par défaut) sont un **réglage** des Paramètres
(« Builds les plus rapides » → « Choisir… »), demandé ainsi : on choisit une
fois les combinaisons qu'on joue. Défaut : Swift, Violent et Despair + Will,
Swift + Shield, Swift + Broken, Violent + Destroy, Violent + Nemesis,
Violent + Broken, Despair + Broken. Voir
[compte-et-parametres.md](../../transverse/feat-navigation/compte-et-parametres.md).
Le bouton « Choisir les combinaisons », dans l'en-tête du bloc, ouvre **la même
fenêtre sur place**, sans quitter le Résumé.

### Affichage

- ⚠️ **À partir de `xl` (1280 px de fenêtre), TOUTES les combinaisons**, l'une
  sous l'autre, chacune sous son titre (symboles des sets, « Swift + Will ») :
  la largeur porte 4 cartes par ligne, 5 à partir de 1536 px.
- ⚠️ **Sous `xl`, un ONGLET par combinaison**, et sous la rangée, les seuls
  builds de l'onglet choisi : 9 combinaisons × 5 builds à la suite y feraient
  trop de cartes. La rangée **passe à la ligne** : jamais une bande qui défile
  à l'horizontale (demandé). Ce sont des `Bouton` à état (`actif`) et non un
  `Segmented`, qui ne passe pas à la ligne. Chaque onglet porte les symboles
  des sets, « Swift + Will », et la **VIT de son #1** (« — » sans build) : on
  compare les combinaisons sans les ouvrir une à une. L'onglet choisi survit à
  la navigation (`useStickyState`) ; une combinaison retirée du réglage ramène
  au premier.
- Les deux régimes sont **un seul rendu, basculé en CSS** : chaque combinaison
  est écrite une fois ; la rangée d'onglets porte `xl:hidden`, les combinaisons
  autres que l'onglet choisi `hidden xl:block`, et le titre d'une combinaison
  ne s'affiche qu'à partir de `xl` (en dessous, l'onglet enfoncé la nomme).
  Dans un volet de l'écran partagé, le seuil suit la largeur du volet, comme
  tout le CSS.
- Une combinaison sans build possible le dit (« Aucun build possible avec tes
  runes. ») ; aucune combinaison choisie renvoie à « Choisir les
  combinaisons ».
- **Carte** : la roue de runes du jeu (`RuneWheel`, échelle 0,45, celle des
  cartes de l'Optimizer) ; le rang `#k` ; l'efficience moyenne des 6 runes ; la
  **VIT totale**, bonus Swift compris ; le détail **Base / Runes**. Le bonus n'a
  pas de case (demandé) : sur un build Swift, Base + Runes vaut donc 25 de
  moins que le total. Un
  clic sur une rune ouvre son détail ; un seul détail ouvert dans tout le
  bloc.
- Les cartes en **grille** qui passe à la ligne (`minmax(min(100%, 228px),
  1fr)`) : une colonne au téléphone, plusieurs à l'ordinateur. 228 px et non
  plus large : c'est ce qui fait tenir 4 cartes à 1280 px et 5 à 1536.
- Le détail d'une rune : en **flottant** ancré à la rune à la souris, **sous la
  roue** dans la carte au doigt — comme les cartes de l'Optimizer.
