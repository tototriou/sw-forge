# Écran (de haut en bas)

**Statut :** ÉTAT ACTUEL — décrit la mise en page de l'écran de l'Optimizer et renvoie à une page par carte
**Lire si :** on modifie la grille de l'écran, l'ordre des cartes ou leur placement

**Mise en page bureau — UNE SEULE grille à partir de `xl`**
([OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx), `grid gap-5
items-start xl:grid-cols-[1.35fr_1fr]`), où chaque carte reçoit un
**placement explicite** (`col-start`/`row-start`/`row-span`) : CSS Grid
l'honore indépendamment de l'ordre du DOM, qui reste donc l'ordre d'USAGE
(monstre → objectif → critères → exclusion/réglages avancés) — et l'ordre de
lecture sous `xl`, où une seule colonne s'affiche sans aucune de ces classes
(le mobile ne dépend jamais de cette grille). Disposition actuelle : rangée 1,
« Monstre & équipement » pleine largeur (`xl:col-span-2`) ; colonne 1,
« Critères de recherche » sur les rangées 2 à 5 (`xl:row-span-4` — ce nombre
suit la colonne d'en face : toute carte ajoutée ou retirée à droite s'y
répercute) ; colonne 2, de haut en bas, « Artéfacts », « État de mon
monstre », « Exclusion de runes », « Réglages avancés » ; en dernier, pleine
largeur, la ligne d'estimation. ⚠️ `items-start` sur la grille : sans lui,
chaque bloc s'étire à la hauteur de sa rangée et les cartes courtes se
retrouvent avec un grand vide bordé. ⚠️ **Colonne 1 en `fr`, jamais en
pixels** : bornée à `minmax(480px,560px)`, elle était trop étroite pour la
rangée d'équipement à taille pleine (≈ 800 px : la roue puis la relique
passaient à la ligne, cette dernière hors du cadre visible) ; en `fr`, elle
suit la largeur réelle de l'écran au lieu d'un plafond deviné. La barre
d'actions, la progression et les résultats restent **pleine largeur, hors de
cette grille** — la grille de cartes de résultat profite directement de la
largeur gagnée (`auto-fill`, voir « Résultats »).

