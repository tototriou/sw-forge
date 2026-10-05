// Le NOM de l'application, écrit UNE fois (rebranding « SW Blacksmith », lot R2
// — spec/chantiers/rebranding-blacksmith.md). Tout texte affiché qui nomme
// l'app le lit ici : barre latérale, titre, infobulles, messages d'import.
// `index.html` aussi, au build : `vite.config.ts` y remplace `%NOM_APP%`.
//
// ⚠️ **Ce qui NE lit PAS ce fichier, et ne doit jamais le lire** : les clés de
// stockage (`swblacksmith-*`, voir lib/migrationStockage.ts), la base IndexedDB
// et les identifiants de format des exports (`sw-forge/prepa-rta`…). Ce sont
// des ADRESSES, pas des textes : un changement de nom affiché ne doit pas les
// déplacer. Quand elles changent (décision 66), c'est avec une migration, et
// l'ancienne adresse reste relue.
export const NOM_APP = 'SW Blacksmith';

// Préfixe des fichiers téléchargés (`swblacksmith-prepa-rta-….json`) — décision
// 14 du rebranding. Seul le NOM change : contenu et format sont les mêmes, et
// l'import ne regarde jamais le nom d'un fichier — un ancien `swforge-…` se
// réimporte comme avant.
export const PREFIXE_FICHIER = 'swblacksmith';
