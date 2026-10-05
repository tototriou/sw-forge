// Identifiants de format des fichiers exportés (`"format": "…"` en tête du
// JSON) — décision 66 du rebranding (spec/chantiers/rebranding-blacksmith.md).
//
// Ils s'écrivaient `sw-forge/<nom>` ; ils s'écrivent `swblacksmith/<nom>`.
// ⚠️ **L'ancien identifiant reste reconnu, pour toujours** : un fichier exporté
// avant le changement doit se réimporter tel quel, sans avertissement — il n'a
// rien de faux, il est seulement plus vieux. Ce sont des ADRESSES, pas des
// textes : elles ne lisent jamais `NOM_APP` (src/marque.ts).

const PREFIXE = 'swblacksmith/';
const ANCIEN_PREFIXE = 'sw-forge/';

// L'identifiant que l'app ÉCRIT.
export const formatExport = (nom: string): string => PREFIXE + nom;

// Ceux qu'elle RELIT : le sien, et celui d'avant le rebranding.
export const formatsAcceptes = (nom: string): string[] => [PREFIXE + nom, ANCIEN_PREFIXE + nom];

export const formatReconnu = (declare: unknown, nom: string): boolean =>
  typeof declare === 'string' && formatsAcceptes(nom).includes(declare);
