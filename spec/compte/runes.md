# Mon compte — Runes (`#/compte/runes`)

Explorer et analyser **tout l'inventaire de runes**. Composant conteneur :
`RunesSection` ([RunesSection.tsx](src/components/account/RunesSection.tsx)), avec
**5 onglets internes** (« Résumé » en premier, **vue par défaut**) :

| Onglet | Composant | Rôle |
|--------|-----------|------|
| Résumé | `RunesSummary` | Vue d'ensemble chiffrée de tout l'inventaire |
| Liste | `RunesList` | Toutes les runes, filtrables/triables |
| Courbes | `RunesCurve` | Courbes de qualité (actuelle + potentiels) |
| Comparaison | `RunesCompare` | Export/import & superposition de courbes entre amis |
| Optimisation | `RunesOptim` | Ce qu'il faut grinder/gemmer pour gagner en qualité |

**Persistance** : les tris/filtres de chaque onglet (et l'onglet actif) sont
conservés à la navigation via `useStickyState` ([useStickyState.ts](src/hooks/useStickyState.ts))
— cache mémoire par clé, remis à zéro au reload (comme les données de compte).
**Un seul détail (popover) ouvert à la fois** par section (ouvrir une rune ferme
la précédente).

> 📐 **Toutes les formules, tables (efficience, grind max, gemme max) et le
> décodage SWEX** sont détaillés, valeurs comprises, dans
> [calcul-runes.md](calcul-runes.md) — référence auto-suffisante.

## Choix de la mesure — **Efficience** ou **Score SW**

La qualité d'une rune peut s'afficher de deux façons, au choix :

| Mesure | Ce que c'est |
|--------|--------------|
| **Efficience** (défaut) | convention communautaire — stat principale incluse, `/2,8` |
| **Score SW** | le score **affiché dans le jeu** — stats secondaires uniquement |

Formules et écart entre les deux : [calcul-runes.md §3 et §3 bis](calcul-runes.md).

- ⚠️ **C'est un RÉGLAGE GLOBAL de l'application**, pas un filtre de page : il se
  pose **une fois** dans le menu **⚙** (tout à droite de la barre de nav, voir
  [../README.md](../README.md)). Aucun sélecteur n'est répété dans les pages.
- **Persisté** dans `localStorage` (`sw-forge-rune-metric-v1`) : un réglage
  d'application survit au rechargement, contrairement aux filtres et tris qui
  sont des préférences de vue jetables. Effacé par « Supprimer mes données ».
- Implémenté par un **store externe** (`useSyncExternalStore`,
  [useRuneMetric.ts](src/hooks/useRuneMetric.ts)) et **non** par `useStickyState` :
  ce dernier ne relit son cache **qu'au montage**, il ne synchroniserait pas les
  vues déjà affichées au moment du changement.
- **Même couleur** dans les deux cas (`text-star` dans le détail, couleur de
  rareté sur les tuiles) : c'est la même information, seule l'unité change.
- Les deux valeurs sont calculées **une fois par import** → bascule instantanée.
- **Portée** : **Liste**, **Courbes**, **Comparaison** et **Optimisation** suivent
  le réglage, ainsi que le détail d'équipement en RTA/siège. Seul le **Résumé**
  reste en efficience (ses paliers et agrégats sont calibrés dessus).
- ⚠️ Dans l'**Optimisation** et les **Courbes de potentiel**, ce n'est pas un
  simple changement d'unité : `runePotential` **refait le calcul** dans la mesure
  demandée. Les stats plates ne pesant pas pareil dans les deux tables, la
  **meilleure gemme peut différer** (typiquement entre un ATQ plat et un ATQ %).
  Voir `OptimMetric` dans [runeOptim.ts](src/lib/runeOptim.ts).
- **Arrondi** : en mode score, potentiels et gains sont des **entiers**
  (`round(… × 100)`, comme la formule du jeu). L'arrondi n'intervient qu'**en
  sortie** — les comparaisons internes du choix de gemme travaillent en pleine
  précision, sinon deux gemmes séparées d'un centième seraient à égalité et le
  choix deviendrait arbitraire. Les **gains** sont calculés sur les valeurs déjà
  arrondies, pour que « gain = potentiel − actuel » soit vrai **à l'écran**.

## Efficience d'une rune

Formule validée (détail + tables `MAINSTAT_MAX` / `SUBSTAT_MAX` dans
[calcul-runes.md](calcul-runes.md)) :

```
eff = (min(main/mainMax, 1) + Σ(substat/subMax) + innée/subMax) / 2.8 × 100
```

Substats = **valeur meule incluse**. Maxes 6★ **non antiques** → une rune antique
peut dépasser 100 %.

## Onglet Résumé — `RunesSummary`

Vue d'ensemble **chiffrée** de l'inventaire : où en est le compte d'un coup d'œil,
sans parcourir les runes. **Aucun filtre** (volontairement global), **aucune
pagination** (rien n'est rendu par rune → un seul passage mémoïsé sur l'inventaire,
fluide à ~2000 runes). Fichier :
[RunesSummary.tsx](src/components/account/RunesSummary.tsx).

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

## Onglet Liste — `RunesList`

- **Tuiles uniformes** : à gauche le **cadre de rune** (image du jeu) **orienté
  selon le slot** ((slot−1)×60°) avec l'**icône du set dedans** colorisée par
  rareté ([RuneSlotIcon.tsx](src/components/RuneSlotIcon.tsx), halo blanc si
  antique ; petit décalage de l'icône le long de l'axe d'orientation par slot) ;
  à côté la **stat principale** ; en dessous la **valeur** dans la mesure choisie
  (teintée par rareté).
- **Détail au clic** : carte récap façon jeu (`RuneDetailBox`) en **popover
  flottant** à **placement automatique** ([DetailPopover.tsx](src/components/account/DetailPopover.tsx)) —
  s'ouvre vers la gauche/haut près d'un bord, jamais coupée, ne décale pas la grille.
  Le détail affiche la **mesure choisie** (voir ci-dessus), dans la même couleur
  quelle qu'elle soit.
- **Filtres** : **sets** (`SetFilter`) et **slot** (`SlotFilter`) — voir
  ci-dessous — plus **antiques**.
- La **mesure** (réglage global, voir plus haut) pilote la valeur des tuiles, le
  tri « valeur » et le repère « meilleur… » de l'en-tête.
- **Tri** : ↓ décroissant (défaut) · ↑ croissant — **sur la mesure choisie** —
  · Niveau ↓ · Slot ↑.
- **Pagination** ([Pager.tsx](src/components/account/Pager.tsx)) : 60 tuiles/page
  → DOM borné (fluide même à ~2000 runes). Composant **partagé par toutes les
  listes paginées** de l'app.
  - Trois éléments : flèche précédente, **champ de saisie de la page**, flèche
    suivante. Les flèches sont de simples icônes ; c'est le champ qui compte.
  - ⚠️ **Le champ est indispensable** : à ~2000 runes on dépasse 30 pages, et
    avancer d'une flèche à la fois est intenable. Une liste de numéros ne
    tiendrait pas sur une ligne à ce volume.
  - La saisie est **séparée de la page réelle** : on doit pouvoir vider le champ
    ou taper « 12 » **sans sauter à la page 1** au premier chiffre. Elle est
    validée à **Entrée** ou à la **perte de focus**, bornée à `[1, N]`, annulée
    par **Échap**, et resynchronisée quand la page change ailleurs (filtre, tri).
- **Rotation animée** : les tuiles utilisent une **clé positionnelle** (et non
  l'id de la rune), donc elles sont **réutilisées** d'une page/d'un filtre/d'un
  tri à l'autre → le cadre **pivote** vers l'orientation de son nouveau slot au
  lieu de sauter. Constante `SPIN` dans
  [RuneSlotIcon.tsx](src/components/RuneSlotIcon.tsx) (300 ms, `ease-out`),
  partagée avec la roue de [MonsterGear.tsx](src/components/MonsterGear.tsx).

## Onglet Courbes — `RunesCurve`

Trois courbes, chacune **triée par valeur décroissante** (ordonnée = la **mesure
choisie** — efficience % ou score SW, l'axe et l'infobulle s'adaptent ; abscisse =
nombre de runes) :

- **Actuelle** (bleu, avec aire) — l'efficience des runes aujourd'hui.
- **Potentiel Héro** (violet) / **Potentiel Légend** (orange) — l'efficience si
  chaque rune recevait son optimisation maximale (voir onglet Optimisation) ;
  identiques aux tris « Potentiel héroïque / légendaire » de l'Optimisation.

Détails :
- Rendu SVG **sobre** et **maison** (aucune dépendance) via
  [CurveChart.tsx](src/components/account/CurveChart.tsx) : courbes **lissées**
  (Catmull-Rom → Bézier), aire discrète sous « Actuelle », grille, graduations,
  titres d'axes, axe Y ajusté aux données, sous-échantillonnage ~240 points.
- **Interactif** : au survol, ligne verticale + points sur chaque courbe +
  **infobulle**, ordonnée de la plus haute à la plus basse valeur au point
  survolé. Chaque ligne = **pastille de couleur · NOM de la courbe · valeur**,
  valeurs **alignées à droite** pour se comparer d'un coup d'œil.
  - ⚠️ **Le nom est indispensable** : à trois courbes superposées, une pastille
    de couleur seule obligeait à faire l'aller-retour avec la légende pour savoir
    qui valait quoi.
  - Le nom est **borné à 16 caractères** (le complet reste dans la légende) et la
    **largeur de la boîte est mesurée sur le contenu réel** : en dur, les noms
    débordaient.
- **Légende sous le graphe** : cliquer un nom **masque/affiche** sa courbe.
- **Filtres** : sets (`SetFilter`), slot (`SlotFilter`), antiques.
- **Nombre de runes** : champ libre (défaut **400**) + **Tout**.
- **Mode** : **Gemme + meule** / **Meule seule** (voir Optimisation).
- **Aide « ? »** superposée en coin du graphe (popup fermable au clic extérieur)
  expliquant la lecture et renvoyant vers l'Optimisation.

## Onglet Comparaison — `RunesCompare`

Se comparer entre amis en superposant plusieurs courbes.

### ⚠️ DEUX sous-onglets, parce que les deux formats ne portent pas la même chose

| Sous-onglet | Ce qu'il AFFICHE | Filtres disponibles |
|---|---|---|
| **Courbes partagées** | **tout l'importé** : courbes partagées **et** fichiers de compte | **nombre de runes** seulement |
| **Fichiers de compte** | **les fichiers de compte seulement** | **sets · slot · antiques · nombre de runes** |

⚠️ **L'inclusion ne va que dans un sens.** Un fichier de compte se réduit
toujours à des points, donc il a sa place dans l'onglet Courbes. L'inverse est
impossible : une courbe partagée n'a pas les runes sur lesquelles les filtres de
l'onglet Comptes s'appliquent. « Courbes » est donc la **vue d'ensemble**,
« Comptes » la **vue filtrable**.

Pourquoi cette séparation plutôt qu'un onglet unique :

- Un **export de courbe ne contient que les points**, et c'est **volontaire** —
  il ne doit transporter **aucune donnée de compte**. Les sets, l'emplacement et
  la rareté n'y sont donc pas : un filtre par set y est **impossible**, pas
  seulement « pas encore fait ».
- Pire, l'appliquer à ma seule courbe **fausserait la comparaison** : on
  opposerait *mon top Violent* à *tout le stock* de l'autre.
- Avec un **fichier de compte**, les runes sont là : le **même filtre est
  appliqué à tout le monde**, donc la comparaison reste honnête.
- Un onglet unique aux filtres actifs une fois sur deux se lirait comme un bug.

Le sous-onglet « Courbes partagées » **explique l'absence** des autres filtres,
sinon on la prend pour un oubli.

### Courbes partagées

- **Exporter** (icône **Upload ↑**) : demande un nom, produit un **JSON lisible**
  (`format: "sw-forge/courbe-runes"`, **version 2**, voir
  [runeCurveShare.ts](src/lib/runeCurveShare.ts)) — **téléchargé** en
  `swforge-runes-<nom>.json` **et copié** au presse-papier.
  - ⚠️ Le fichier porte **LES DEUX séries** : `efficiences` **et** `scores`.
    Celui qui l'importe la lit donc dans **sa** mesure, sans dépendre du réglage
    de l'expéditeur.
- **Importer une courbe** (icône **Download ↓**) : charge le fichier d'un ami.
  **JSON uniquement** — l'ancien code compact `SWF-RUNES-1:` n'est plus ni
  produit ni lu.

### Fichiers de compte

- **Importer un fichier de compte** : l'export SWEX brut d'un ami, runes
  extraites à la volée (`parseAccountInventory`). **Lu dans la page, jamais
  envoyé.**
- Filtres identiques à l'onglet **Courbes** (`SetFilter`, `SlotFilter`,
  « Antiques », nombre de runes), **appliqués à toutes les courbes à la fois**.
- ⚠️ Le filtre de sets propose les sets présents **chez moi OU chez un ami** :
  sinon on ne pourrait pas filtrer sur un set qu'on ne possède pas encore.
- Pas de « gemme + meule / meule seule » : la comparaison porte sur l'**état
  actuel** des runes, pas sur un potentiel — et un potentiel comparé entre deux
  comptes n'aurait pas de sens tant que chacun n'a pas posé ses meules.

### ⚠️ RIEN de ce qui est importé ici n'est conservé

Courbes partagées **et** fichiers de compte vivent **en mémoire seulement**
(`useStickyState` — un cache par clé, **pas** `localStorage`). Ils survivent à la
navigation entre onglets et **disparaissent au rechargement**.

C'est délibéré : ce sont les données **de quelqu'un d'autre**. Elles n'ont rien à
faire sur le disque de celui qui les consulte, et il ne doit pas avoir à y penser.
⚠️ **Ne pas** basculer cet état vers `localStorage` « pour le confort » — c'est la
seule partie de l'app où de la donnée tierce transite.

### « Tout retirer » — vider la comparaison

Bouton en haut à droite, **affiché seulement s'il y a quelque chose à retirer**,
avec le compte de ce qui partira, et une **confirmation**.

⚠️ Il ne touche **QUE ce qui a été importé ici** — les deux sous-onglets à la
fois. **Pas** le compte du joueur (box, runes, artéfacts), **pas** ses
recommandations, **pas** sa prépa RTA ni ses équipes. Le message de confirmation
**le dit explicitement** : sans ça, on n'ose pas cliquer, de peur d'effacer son
propre import.

> Pour tout effacer, c'est « Tout supprimer » dans le menu ⚙ — action distincte,
> à un autre endroit, et c'est voulu.

Les listes importées vivent donc dans `RunesCompare`, pas dans chaque
sous-onglet : c'est ce qui permet un bouton unique qui les vide toutes les deux.

### Communs aux deux sous-onglets

- **Superposition** : ma courbe (« Moi ») en bleu, les amis en couleurs vives
  (palette cyclique). Bornes recalculées sur les courbes **visibles**.
- **Légende** : pastille + nom + (max · médiane · nb) ; **cliquer le nom
  masque/affiche** ; la croix (✕) **retire** une courbe importée.
- Deux courbes homonymes sont **renommées** (« Ami (2) »), **en tenant compte des
  deux listes à la fois** puisqu'elles cohabitent dans l'onglet Courbes : sinon
  la légende serait illisible et la croix ambiguë.
- ⚠️ Le retrait est **attaché à chaque ligne**, pas déduit d'un index : l'onglet
  Courbes mélange deux listes, un index n'y désignerait plus rien de fiable.

> Convention d'icônes : **Exporter = Upload ↑**, **Importer = Download ↓**.

## Filtrer par set — `SetFilter`

[SetFilter.tsx](src/components/account/SetFilter.tsx), partagé par **Liste**,
**Courbes** et **Optimisation**.

⚠️ **Règle d'interface : un filtre de set affiche l'icône du jeu, SANS le nom.**
Partout dans l'appli. Les icônes sont reconnues d'un coup d'œil par n'importe
quel joueur, alors qu'une rangée de libellés fait un mur de texte et réduit le
nombre de sets visibles sans défilement. Le nom reste en `title` et en
`aria-label`, donc rien n'est perdu pour l'accessibilité.

- ⚠️ **Symboles colorisés en OR.** Les icônes du jeu sont multicolores :
  alignées par vingt-cinq elles font une rangée bruyante où rien ne ressort.
  Ramenées à une seule teinte, la barre se lit comme une frise et **seul l'état
  actif se détache** (or plus clair).
  - ⚠️ **Par un FILTRE CSS, pas par un masque.** Masquer l'alpha du PNG
    (`tintColor` de [RuneIcon](src/components/RuneIcon.tsx)) remplit le glyphe
    d'aplat : tout le relief interne disparaît et l'icône **paraît floue** à
    18 px. Le filtre conserve la luminance d'origine, donc le dessin reste net.
    Même technique que `RARITY_FILTER` ([effects.ts](src/lib/effects.ts)).
- Rendu en **une seule barre continue** (conteneur bordé, icônes serrées),
  et non en boutons détachés : les symboles se lisent comme une rangée
  d'icônes du jeu, et l'ensemble tient sur une ligne même avec 25 sets. Seul
  l'**état actif** porte un cadre ; l'inactif est simplement atténué.
- Multi-sélection ; aucun set coché = aucun filtre.
- **Seuls les sets réellement présents** dans l'inventaire sont proposés : un
  filtre qui ne peut rien renvoyer n'aide personne.
- Bouton **« ✕ tout »** pour tout décocher, affiché seulement s'il y a une
  sélection. **Même gabarit que les pastilles de set** (32 px, même rayon,
  même bordure) pour ne pas casser la rangée, mais sans fond actif et virant
  au rouge au survol : c'est une action, pas un set de plus.

### Filtrer par slot — `SlotFilter`

[SlotFilter.tsx](src/components/account/SlotFilter.tsx), même grammaire visuelle
que `SetFilter` (hauteur 32 px, même bordure, même bouton « ✕ tout ») pour que
les deux se lisent comme une seule barre.

Différence assumée : les **six slots sont toujours proposés**, alors que les sets
se limitent à ceux présents. Un slot sans rune reste une information utile
(« je n'ai rien en 2 »), là où un set absent n'est qu'un bouton mort.

## Onglet Optimisation — `RunesOptim`

Calcule, pour chaque rune, son **potentiel maximal** et **ce qu'il faut faire**
pour l'atteindre. Calcul pur & linéaire dans [runeOptim.ts](src/lib/runeOptim.ts)
(`runePotential`, `runePlan`) — réutilisable dans un Web Worker.

> **Disclaimer** affiché en tête : c'est une optimisation d'**efficience**, pas
> forcément la bonne stat pour ton monstre.

### Potentiel = gemme optimale **puis** grind au max

Deux scénarios calculés (héroïque & légendaire, **tables classiques et antiques
distinctes**) :

- **Meules (grinds)** : chaque substat grindable porté **exactement** à son grind
  max (RES/Précision/Taux Crit/Dmg Crit **non grindables**). Une rune déjà grindée
  au-delà (ex. légendaire) est **ramenée** au max du scénario en héroïque (delta
  négatif possible).
- **Gemme** :
  - rune **non gemmée** → on choisit **le meilleur substat à remplacer** par la
    **meilleure stat grindable** (PV%/ATQ%/DEF%/VIT, sinon un flat), **sans
    doublon** (≠ principale / innée / autres substats) et en respectant les
    **emplacements** (slot 1 : pas de DEF ; slot 3 : pas d'ATQ) ;
  - rune **déjà gemmée** → la stat gemmée est **figée** (on ne peut pas en gemmer
    une autre) ; seul gain possible = **procker au max** (porter la base de la
    gemme au max si elle n'y est pas déjà). Rien si déjà au max.
  - total de la stat gemmée = `gemMax + grindMax`.

**Toutes les tables de valeurs** (grind max & base max de gemme,
classiques/antiques, héro/légend) et l'**algorithme complet** `best()` sont dans
[calcul-runes.md §4](calcul-runes.md).

### Modes

- **Gemme + meule** (défaut) : potentiel complet ci-dessus.
- **Meule seule** : garde les **stats actuelles** (aucune gemme), ne pousse que les
  meules → pour repérer les runes à **grinder en priorité**.

### Affichage & interactions

- **Tri** (dropdown) : Efficience actuelle (défaut) · Potentiel héroïque ·
  Potentiel légendaire · Gain héroïque · Gain légendaire. **Gain** = potentiel −
  efficience actuelle.
- **Palier** : champ % — n'affiche que les runes dont l'efficience actuelle ≥ palier
  (défaut 100 %).
- **Sets** (`SetFilter`) et **slot** (`SlotFilter`) : mêmes composants que les
  autres onglets.
- **Runes** (segmenté) : **Toutes** (défaut) · **Antiques uniquement** ·
  **Aucune antique**.
  Pourquoi les trois et pas seulement un filtre « antiques » comme dans les
  autres onglets : les antiques ont leurs **propres tables de max**, donc un
  potentiel qui **ne se compare pas** à celui d'une rune normale. Les mélanger
  dans un même classement fausse la lecture des tris « potentiel » et « gain » —
  on veut pouvoir **écarter** les antiques autant que les isoler.
  Le compteur et le message de liste vide rappellent le filtre actif
  (« hors antiques » / « antiques seules »), pour qu'un résultat vide ne passe
  pas pour une absence de runes.
- **Tuiles** : efficience **actuelle**, puis **Héro** et **Légend** avec leur gain
  et l'efficience cible colorée **vert** (au-dessus de l'actuelle) / **rouge** (en
  dessous). Pagination 60/page.
- **Rotation animée** des cadres, même mécanique que l'onglet Liste (clé
  positionnelle + `SPIN`).
- **Détail au clic** : plan **« Actuel | Optimisé »** (`OptimPlanBox`) — substats
  actuels à gauche (base blanche + meule orange), optimisés à droite avec **seul ce
  qui change en violet** (grind posé ou 💎 gemme/proc max).
- **Aide « ? »** sur la ligne des filtres (popup fermable au clic extérieur).
