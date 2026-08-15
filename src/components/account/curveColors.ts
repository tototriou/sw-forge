// Attribution des couleurs de courbes en comparaison.
//
// ⚠️ Deux courbes de la MÊME couleur, c'est deux courbes qu'on ne peut plus
// distinguer — et la légende ment, puisqu'elle donne un nom à chacune. C'est
// arrivé au cas le plus courant : la PREMIÈRE courbe importée reprenait
// exactement le bleu de « Moi ».
//
// Deux causes, toutes les deux corrigées ici :
//  1. `OWN_COLOR` (#5cc2ff) ouvrait aussi la palette d'import → la première
//     courbe ajoutée tombait dessus ;
//  2. la couleur se prenait à `[prev.length % palette.length]`, un modulo sur
//     le NOMBRE de courbes. Supprimer la 1re puis en ajouter une redonnait la
//     couleur de la 2e, toujours affichée.

// Couleur de la courbe du JOUEUR (« Moi » / « Actuelle »).
//
// ⚠️ Elle vit ICI, avec la palette, et non dans `CurveChart` : c'est la seule
// place d'où l'on voit d'un coup d'œil qu'elle ne doit apparaître dans aucune
// des deux listes. Tant qu'elle était isolée dans le composant de rendu, rien
// ne signalait qu'elle ouvrait aussi la palette d'import. `CurveChart` la
// réexporte, donc aucun appelant ne change.
// (Ce module reste sans JSX : les vérifications l'importent sans tirer React.)
export const OWN_COLOR = '#5cc2ff'; // bleu

// ⚠️ `OWN_COLOR` n'y figure PAS : elle est réservée à la courbe du joueur.
// Les teintes sont espacées — deux bleus voisins (#5cc2ff / #8fd4ff) se
// confondaient sur un tracé de 1 px.
export const OVERLAY_COLORS = [
  '#7cf0a6', // vert
  '#ff7a9c', // rose
  '#c88cff', // violet
  '#ffd166', // ambre
  '#ff9e5c', // orange
  '#5ce0d8', // turquoise
  '#b8e04a', // vert-jaune
  '#ff6b6b', // rouge
];

// Choisit une couleur qu'AUCUNE courbe affichée ne porte déjà.
//
// ⚠️ On raisonne sur les couleurs RÉELLEMENT prises, pas sur un compteur : le
// nombre de courbes ne dit rien de ce qui est libre dès qu'on en supprime une.
//
// ⚠️ `OWN_COLOR` est écartée d'office. La courbe du joueur est toujours là, et
// c'est la seule qui n'est pas dans `prises` quand l'appelant ne liste que les
// courbes importées — l'oubli qui a produit le bug d'origine.
//
// Au-delà de la palette on ne peut plus garantir l'unicité : on reprend alors
// le cycle, en repartant de la couleur la plus anciennement posée. Mieux vaut
// un doublon entre la 1re et la 9e courbe qu'entre deux voisines.
export function couleurLibre(prises: readonly string[]): string {
  const utilisees = new Set([...prises, OWN_COLOR].map((c) => c.toLowerCase()));
  const libre = OVERLAY_COLORS.find((c) => !utilisees.has(c.toLowerCase()));
  if (libre) return libre;
  return OVERLAY_COLORS[prises.length % OVERLAY_COLORS.length];
}
