import { createContext } from 'react';

// Ce que la page de bureau dit au set de runes recherché
// (`SetDeRunesCompact`) : dans quelle forme se dessiner, et comment lui
// rendre la mesure dont elle décide.
//
// ⚠️ **Déplié (la grille du téléphone) tant que « Critères » tient
// sans défiler une fois dépliée, compact sinon.** La page seule sait la
// hauteur de la colonne ; le set seul sait ce que son dépli ajoute
// (`ecart` : la hauteur de la grille dépliée moins celle de la liste
// fermée, mesurée sur deux copies invisibles qui ne dépendent d'aucun choix).
// Hors de la page (banc de gabarits, tests de rendu), pas de contexte : la
// forme compacte. En deux piles, toujours compact.
export interface SetDeplieContexte {
  deplie: boolean;
  // Le set annonce ce que son dépli ajoute à la colonne, en pixels.
  reporterEcart: (ecart: number) => void;
}

export const SetDeplieContext = createContext<SetDeplieContexte | null>(null);
