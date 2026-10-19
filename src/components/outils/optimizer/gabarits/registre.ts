import { GABARITS_ESSENTIELS } from './essentiels';
import { GABARITS_COLONNES } from './colonnes';
import { GABARITS_DROITE } from './droite';
import type { Gabarit } from './types';

// Le registre de la vue des gabarits : une liste par groupe de boîtes, dans
// l'ordre de la page. Un groupe de plus = un fichier de plus et une ligne ici ;
// la vue n'a pas à changer.
export const GABARITS: Gabarit[] = [...GABARITS_ESSENTIELS, ...GABARITS_COLONNES, ...GABARITS_DROITE];
