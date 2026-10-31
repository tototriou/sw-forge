// Point d'entrée des traductions : les dictionnaires par langue.
// Décision : docs/04-decisions/adr/traductions-par-dictionnaires.md.
//
// ⚠️ Une langue ajoutée = un fichier typé `Dictionnaire`, une entrée ici, une
// valeur de plus dans `LANGUES` (langue.ts) et son nom dans `NOM_LANGUE`.

import { fr, type Dictionnaire } from './fr';
import { en } from './en';
import type { Langue } from './langue';

export type { Dictionnaire } from './fr';
export * from './langue';

export const DICTIONNAIRES: Record<Langue, Dictionnaire> = { fr, en };

// Le nom de chaque langue DANS cette langue : on reconnaît la sienne même dans
// une interface qu'on ne lit pas.
export const NOM_LANGUE: Record<Langue, string> = { fr: 'Français', en: 'English' };
