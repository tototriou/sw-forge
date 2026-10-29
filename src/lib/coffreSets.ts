// Les colonnes de la grille des sets dans son coffre, au bureau
// (docs/02-app/optimizer/ecran/set-et-principale.md) : 3 colonnes pour le set
// principal, 4 pour le set secondaire tant qu'elles tiennent ; quand la
// largeur manque, le set principal passe d'abord à 2 colonnes, puis le set
// secondaire à 3, puis à 2. La grille s'allonge vers le bas, ses boutons
// gardent leur taille.

const BOUTON = 32;
const ECART = 4;
// Entre les deux groupes : la marge du principal, le trait, celle du secondaire.
const SEPARATION = 12 + 1 + 12;

const largeurGrille = (colonnes: number) => colonnes * BOUTON + (colonnes - 1) * ECART;

export interface ColonnesCoffre {
  principal: number;
  secondaire: number;
}

// `largeur` : la largeur de contenu du coffre (son rembourrage retiré).
export function colonnesCoffre(largeur: number): ColonnesCoffre {
  const paliers: ColonnesCoffre[] = [
    { principal: 3, secondaire: 4 },
    { principal: 2, secondaire: 4 },
    { principal: 2, secondaire: 3 },
  ];
  for (const p of paliers) {
    if (largeurGrille(p.principal) + SEPARATION + largeurGrille(p.secondaire) <= largeur) return p;
  }
  return { principal: 2, secondaire: 2 };
}
