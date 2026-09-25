// Chemins qu'aucun lot de la refonte graphique ne modifie — A.2 de
// `spec/chantiers/refonte-graphique.md`.
//
// La refonte change l'AFFICHAGE : la logique, les données du jeu et les rendus
// copiés du jeu ne bougent pas. Ce script le prouve à chaque lot.
//
// Usage : node scripts/chemins-interdits.mjs <base>
//   compare l'arbre de travail (commits + modifications non commitées) à <base>
//   et sort en code 1 si un chemin interdit a changé.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Dossiers entiers (préfixe) — la logique et les données.
const DOSSIERS = ['src/lib/', 'src/hooks/', 'src/workers/', 'src/data/', 'public/'];
// Exceptions explicites dans ces dossiers : ce que la refonte a le droit de
// toucher — les couleurs de section (affichage) et les notes de version (la
// refonte y écrit sa propre entrée « Nouveautés ») ; puis les fichiers des
// AJOUTS décidés par Thomas, nommés dans le cadrage AVANT leur code (A.2 bis,
// décision 14 : recherche et export des équipes de siège).
const PERMIS = new Set([
  'src/data/couleursSection.ts',
  'src/data/releases.ts',
  'src/lib/siegeShare.ts',
  'src/hooks/useSiegeState.ts',
]);
// Fichiers isolés : les types, et les rendus copiés du jeu (mémoire
// `rendus-du-jeu-intouchables`), qui restent à l'identique.
const FICHIERS = new Set([
  'src/types.ts',
  'src/components/RuneWheel.tsx',
  'src/components/RuneSlotIcon.tsx',
  'src/components/RuneIcon.tsx',
  'src/components/ArtifactSlots.tsx',
  'src/components/ArtifactFrameIcon.tsx',
  'src/components/ArtifactIcon.tsx',
  'src/components/PieceDetail.tsx',
  'src/components/MonsterAvatar.tsx',
  'src/components/ElementIcon.tsx',
  'src/components/GameIcon.tsx',
  'src/components/InventaireIcon.tsx',
]);

export function interdits(fichiers) {
  return fichiers
    .map((f) => f.split('\\').join('/'))
    .filter((f) => !PERMIS.has(f) && (FICHIERS.has(f) || DOSSIERS.some((d) => f.startsWith(d))))
    .sort();
}

function principal(args) {
  const base = args[0];
  if (!base) {
    console.error('usage : node scripts/chemins-interdits.mjs <base>');
    return 2;
  }
  const sortie = execFileSync('git', ['diff', '--name-only', base], { encoding: 'utf8' });
  const touches = interdits(sortie.split('\n').filter(Boolean));
  if (!touches.length) {
    console.log(`chemins interdits : aucun modifié depuis ${base}`);
    return 0;
  }
  for (const f of touches) console.log(`INTERDIT ${f}`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
