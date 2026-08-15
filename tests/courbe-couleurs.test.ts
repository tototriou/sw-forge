// Couleurs des courbes en comparaison.
//
// Deux courbes de la même couleur sont indistinguables, et la légende ment
// puisqu'elle donne un nom à chacune. Le bug s'est produit sur le cas le plus
// courant qui soit — la PREMIÈRE courbe importée — et il est resté invisible
// parce que rien ne relie, à l'œil, la couleur du joueur et la palette
// d'import. Ces vérifications le figent.

import { OVERLAY_COLORS, OWN_COLOR, couleurLibre } from '../src/components/account/curveColors';
import { egal, ok, titre } from './outils';

export default function testCouleursCourbes() {
  titre('Couleurs des courbes de comparaison');

  // ⚠️ LA cause du bug : `OWN_COLOR` ouvrait aussi `OVERLAY_COLORS`, donc la
  // première courbe importée tombait exactement sur le bleu de « Moi ».
  ok(
    !OVERLAY_COLORS.some((c) => c.toLowerCase() === OWN_COLOR.toLowerCase()),
    'la couleur du joueur ne figure pas dans la palette d’import'
  );

  egal(
    new Set(OVERLAY_COLORS.map((c) => c.toLowerCase())).size,
    OVERLAY_COLORS.length,
    'la palette n’a aucun doublon'
  );

  // Le cas de départ : rien d'importé encore, et pourtant une couleur est déjà
  // prise — celle du joueur, toujours affichée.
  ok(
    couleurLibre([]).toLowerCase() !== OWN_COLOR.toLowerCase(),
    'la première courbe importée ne reprend pas la couleur du joueur'
  );

  // Ajouts successifs : chaque courbe doit obtenir une couleur neuve.
  const posees: string[] = [];
  for (let i = 0; i < OVERLAY_COLORS.length; i++) posees.push(couleurLibre(posees));
  egal(
    new Set(posees.map((c) => c.toLowerCase())).size,
    OVERLAY_COLORS.length,
    'toute la palette est distribuée sans jamais se répéter'
  );

  // ⚠️ La seconde cause : la couleur se prenait à `[nombre % palette.length]`.
  // Supprimer la 1re courbe puis en ajouter une redonnait la couleur de la 2e,
  // toujours à l'écran. On raisonne donc sur les couleurs RÉELLEMENT posées.
  const apresSuppression = [posees[1], posees[2]]; // on a retiré la première
  const reprise = couleurLibre(apresSuppression);
  egal(reprise, posees[0], 'une couleur libérée est réattribuée');
  ok(
    !apresSuppression.some((c) => c.toLowerCase() === reprise.toLowerCase()),
    'la couleur reprise n’est portée par aucune courbe restante'
  );

  // Au-delà de la palette, l'unicité n'est plus tenable : on ne promet alors
  // qu'une couleur valide, et jamais celle du joueur.
  const trop = [...OVERLAY_COLORS];
  const debordement = couleurLibre(trop);
  ok(
    OVERLAY_COLORS.includes(debordement) && debordement.toLowerCase() !== OWN_COLOR.toLowerCase(),
    'au-delà de la palette, on recycle sans jamais prendre la couleur du joueur'
  );
}
