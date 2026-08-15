# Mon compte — Runes (`#/compte/runes`)

Explorer et analyser **tout l'inventaire de runes**. Composant conteneur :
`RunesSection` ([RunesSection.tsx](src/components/account/RunesSection.tsx)), avec
**7 onglets internes** (« Résumé » en premier, **vue par défaut**) :

| Onglet | Composant | Rôle |
|--------|-----------|------|
| Résumé | `RunesSummary` | Vue d'ensemble chiffrée de tout l'inventaire |
| Liste | `RunesList` | Toutes les runes, filtrables/triables |
| Courbes | `RunesCurve` | Courbes de qualité (actuelle + potentiels) |
| Comparaison | `RunesCompare` | Export/import & superposition de courbes entre amis |
| Optimisation | `RunesOptim` | Ce qu'il faut grinder/gemmer pour gagner en qualité |
| Meules | `ComingSoon` | **En construction** — ce qui manque en meules, et où le farmer |
| Gemmes | `ComingSoon` | **En construction** — ce qui manque en gemmes, et où le farmer |

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
- ⚠️ **Cliquer un point ouvre la rune correspondante**, sous le graphe. On lit
  « ma 12ᵉ meilleure rune vaut 78 % » ; la question suivante est toujours
  « laquelle ? », et il fallait aller la chercher à la main dans la liste.
  - Le rang cliqué est marqué d'une **verticale tiretée** avec un **point sur
    chaque courbe ouverte** — ⚠️ **exactement le repère du survol**, ni plus
    épais ni plus gros. C'est le même geste de visée, seulement **figé** : le
    marquer davantage en faisait un autre objet, une graduation du graphe. Sa
    seule différence est qu'il **survit au départ du pointeur**, ce qui est tout
    son rôle — dire d'où sort le détail lu en dessous une fois la souris partie
    vers les flèches.
    - ⚠️ Les couleurs des attributs SVG s'écrivent **`rgb(var(--accent))`** :
      posés nus, les tokens (des triplets) rendent l'attribut invalide et le
      trait n'est **pas peint du tout**, sans la moindre erreur. Voir
      [../shared/design.md](../shared/design.md).
  - ⚠️ **Une carte par courbe OUVRABLE, à ce rang** — et ce que « ouvrable »
    veut dire diffère selon l'onglet, parce que les courbes n'y disent pas la
    même chose :

    | Onglet | Ouvrables | Pourquoi |
    |--------|-----------|----------|
    | **Courbes** | « Actuelle » seule | Les potentiels ne sont pas d'autres runes : c'est la **même box** projetée dans une autre hypothèse. Trois cartes quasi identiques pour une seule question — « quelle est cette rune ? ». |
    | **Comparaison** | **toutes** celles qui portent leurs runes | Chaque courbe est un **compte différent** : « à ma 12ᵉ meilleure rune, qu'ont-ils, eux ? ». N'en montrer qu'une obligeait à recliquer chaque courbe pour la même question. |

    Les cartes sont ordonnées **par valeur décroissante**, comme les courbes au
    point X et comme l'infobulle de survol : même lecture partout. Une courbe
    **masquée** dans la légende n'apparaît pas (elle n'atteint pas le graphe).
  - Le détail est précédé de l'**image de la rune** (cadre du slot + symbole du
    set, `RuneSlotIcon`) puis de son **set** et de son **slot**. ⚠️ L'image
    d'abord : c'est à elle qu'on reconnaît une rune d'un coup d'œil, le texte ne
    fait que confirmer. **Même rendu que les tuiles de l'onglet Liste**, pour
    retrouver la même rune sans changer de langage d'un onglet à l'autre.
  - ⚠️ **Sous le graphe, dans le flux — pas en flottant.** La carte d'une rune
    fait ~300 px de haut : un popover de cette taille ancré sur un point
    recouvrirait la courbe qu'on vient de lire.
  - Le détail est **centré**, précédé d'une **barre de navigation** : les deux
    flèches **côte à côte, juste sous la courbe**, encadrant le rang
    (« n° 12 / 340 »). Elles font parcourir le **classement** — l'axe du graphe
    au-dessus —, pas la carte du dessous : les placer de part et d'autre de la
    carte les éloignait l'une de l'autre alors qu'on les enchaîne.
    - Le rang est à **largeur fixe**, sinon les flèches se déplacent au passage
      de « 9 » à « 10 ». Il n'est **pas répété** dans la carte.
    - Elles **bornent au lieu de boucler** (le classement a un début et une
      fin ; repasser du dernier au premier ferait croire à un saut de position)
      et sont désactivées aux extrémités. Les **touches ← →** font la même chose.
  - Re-cliquer le même point **referme** (le geste est son propre inverse) ;
    **Échap** et la croix ferment aussi.
  - ⚠️ **Cliquable seulement là où la courbe porte ses runes**
    (`CurveSeries.runes`, aligné sur `effs`, même tri). Une courbe **partagée**
    ne porte que des valeurs : elle reste en lecture seule. Un **fichier de
    compte**, lui, porte ses runes — ses points sont donc ouvrables, dans les
    deux sous-onglets de Comparaison.
  - Le **nom de la courbe** est rappelé sur chaque carte dès qu'il y a plusieurs
    ouvrables ; masqué sinon, où il n'apprendrait rien.
  - On mémorise le **rang seul** : c'est une **position du classement**, et
    c'est cette position qu'on lit sur toutes les courbes à la fois. La
    navigation porte sur le rang le plus élevé des courbes ouvrables (le
    **max**, pas le min : une courbe plus courte cesse simplement d'être
    affichée, elle ne bride pas les autres).
  - On mémorise le **rang**, jamais les runes : les séries se recalculent à
    chaque changement de filtre ou de mesure, et des runes figées désigneraient
    un point disparu.
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

⚠️ Le réglage « Garder mon compte » (menu ⚙) **ne change rien ici** : il ne
conserve que le compte **du joueur**. On ne stocke jamais le compte d'un tiers.
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
  - ⚠️ **Converti au changement de mesure** (`convertirPalier` dans
    [useRuneMetric.ts](src/hooks/useRuneMetric.ts)) : « 100 » ne veut pas dire la
    même chose en efficience et en score, et garder la valeur brute déplaçait la
    coupe sans prévenir — souvent une liste vide, prise pour un bug.
  - ⚠️ **Pas de facteur de conversion, il n'en existe pas.** Sur un compte réel
    de 3 163 runes, le rapport score/efficience s'étale de **0,98 à 2,37** : la
    principale compte dans l'une et pas dans l'autre, et les tables de max
    diffèrent. Le ratio médian appliqué à un palier de 110 % laisserait passer
    **457 runes au lieu de 139**.
  - La conversion se fait donc **par rang** : on compte ce qui passait, on prend
    la valeur de la n-ième meilleure dans la nouvelle mesure. Exact pour la seule
    question que le palier pose — *où je coupe*.
  - Un palier qui ne gardait **rien** reste au-dessus du maximum : sans ça, la
    liste se remplirait toute seule au changement d'unité.
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
  dessous — seulement hors filtre de réserve, voir `noDowngrade`).
  Pagination 60/page.
- **Rotation animée** des cadres, même mécanique que l'onglet Liste (clé
  positionnelle + `SPIN`).
- **Détail au clic** : plan **« Actuel | Optimisé »** (`OptimPlanBox`) — substats
  actuels à gauche (base blanche + meule orange), optimisés à droite avec **seul ce
  qui change en violet** (grind posé ou 💎 gemme/proc max).
- **Aide « ? »** sur la ligne des filtres (popup fermable au clic extérieur).
  Elle détaille les deux modes, le choix de la gemme, le gain, **le palier** (ce
  qu'il mesure et sa reconversion), **les icônes marteau/gemme** du plan, et le
  filtre de réserve.

### « Faisable avec ma réserve » — le filtre qui regarde le sac

Un potentiel de +20 d'efficience ne vaut rien si la meule qui l'apporte n'est pas
dans le sac. Ce bouton restreint la liste aux runes dont **le plan complet est
couvert** par la réserve de meules et de gemmes du compte.

⚠️ **Un filtre, pas un onglet.** C'est la même liste, restreinte : potentiel
héroïque, potentiel légendaire, les deux gains et le tri restent là. En faire une
vue séparée obligeait à tout y réimplémenter.

- Le **scénario suit le tri** (gain/potentiel héroïque → grade 4, sinon 5) :
  trier par gain héroïque tout en filtrant sur du légendaire n'aurait aucun sens.
- Les plans ne sont calculés **que si le filtre est actif** — c'est plus lourd
  qu'un potentiel, et inutile tant qu'on ne le demande pas.
- Une rune **sans rien à appliquer** est écartée : la question posée est « que
  puis-je améliorer », pas « qu'est-ce qui ne bloque pas ».
- **Désactivé sans réserve connue** (compte enregistré avant `ACCOUNT_SCHEMA` 3),
  avec l'explication en infobulle : un bouton qui viderait la liste sans raison
  vaut moins qu'un bouton grisé qui dit pourquoi.
- Le compteur rappelle le filtre actif (« · faisables avec ma réserve »), pour
  qu'une liste courte ne passe pas pour une absence de runes.

⚠️ **Le plan est RESTREINT à la réserve, il n'est pas exigé en entier.** Une stat
dont le consommable manque n'est simplement pas poussée (`CraftDispo` dans
[runeOptim.ts](src/lib/runeOptim.ts)). Exiger le plan complet écartait des runes
parfaitement travaillables : une Swift dont trois substats sur quatre étaient
meulables disparaissait faute d'une seule meule VIT. Le gain affiché est donc
**celui qu'on peut aller chercher aujourd'hui**, ni plus ni moins — et le plan du
détail applique la même restriction, sans quoi il contredirait le chiffre.

**Marquage ligne par ligne** dans le plan (`SubLine`) : chaque substat à
travailler porte l'icône de son consommable — **marteau** pour une meule,
**gemme** pour une gemme — en **vert s'il est en réserve**, grisé sinon. Le plan
dit quoi faire, la réserve dit ce qui est à portée ; sans le croisement il
fallait aller compter ses meules ailleurs pour savoir par où commencer.
⚠️ Une seule marque par ligne, la **gemme prime** : c'est elle qui conditionne le
reste, puisqu'elle remet le meulage du slot à zéro. Le marquage s'affiche dès
qu'une réserve est connue, filtre actif ou non.

Règles de disponibilité (grade ≥ scénario, immémoriaux valables sur tous les
sets, antique et normal étanches) : [crafts.ts](src/lib/crafts.ts).

⚠️ **Sans réserver le stock.** Deux runes qui réclament la même unique meule VIT
sont toutes deux annoncées faisables — ce qui est vrai de chacune. Compter les
quantités répondrait à une autre question (« que farmer pour toutes les faire »),
et c'est le sujet des onglets Meules et Gemmes.

#### ⚠️ Le filtre change AUSSI le calcul — `noDowngrade`

Deux questions légitimes, deux calculs :

| Mode | Question posée | Conséquence |
|------|----------------|-------------|
| défaut | « que vaudrait cette rune si elle était **née** héroïque ? » | une rune meulée légendaire y **perd** — et ce gain négatif est l'information : l'héroïque ne lui apporte rien |
| filtre actif | « qu'est-ce que je peux **encore lui poser** ? » | seules les stats **pas encore au max** bougent, donc **aucun gain négatif** |

⚠️ Les mélanger affiche une contradiction sur la même ligne : une rune annoncée
« faisable » avec un gain négatif. Sous le filtre on regarde ce qu'on va
**réellement poser**, et on ne pose jamais une meule qui dégrade ce qui est là.

Mesuré sur un compte réel (3 163 runes) : **424 gains héroïques négatifs** en
mode par défaut, **0** sous le filtre.

Le **plan affiché suit la même règle** (`runePlan(..., noDowngrade)`), sinon il
contredirait le chiffre annoncé au-dessus. Sur une rune sans meule, les deux
lectures coïncident — l'option ne change rien là où il n'y a rien à préserver.

## Onglets Meules & Gemmes — **en construction**

⚠️ **Ces onglets ne refont pas l'Optimisation.** « Quelles runes puis-je
améliorer avec ce que j'ai » est un **filtre**, pas une vue : il vit dans
l'Optimisation (bouton « Faisable avec ma réserve », voir plus haut). L'en
extraire obligerait à y réimplémenter potentiel héroïque, potentiel légendaire
et les deux gains — tout ce qui fait l'intérêt de la liste.

Ils porteront la question **inverse**, que rien ne couvre aujourd'hui :

- ce qui **manque** en meules / en gemmes pour un **top paramétrable** (10, 50,
  100…) classé par potentiel ou par gain ;
- et donc **où aller le chercher** : quelle faille élémentaire, quel raid.

⚠️ Le second point demande une table **set de rune → donjon qui le fait tomber**,
qui **n'est pas dans l'export** et qui ne doit pas être devinée : envoyer
quelqu'un farmer le mauvais donjon est une erreur silencieuse et coûteuse. La
source reste à choisir avant d'implémenter.

Placeholder : [ComingSoon.tsx](src/pages/ComingSoon.tsx), le même que les pages
d'outils à venir.

> La lecture de la réserve, elle, est **déjà en place** : `parseCrafts`,
> `CraftLine`, la persistance (`ACCOUNT_SCHEMA` 3) et
> [crafts.ts](src/lib/crafts.ts) servent déjà le filtre de l'Optimisation.
