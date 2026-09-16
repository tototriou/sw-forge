// Sommaire compact d'une spec : en-tête (statut, lire si) puis, pour chaque
// titre, niveau / plage de lignes / première phrase. Objectif : ouvrir une
// spec sans la lire en entier. Voir `CADRAGE-rangement-specs.md`, B.3.
//
// Usage : `node scripts/spec-toc.mjs <fichier|dossier> [--json]`
//
// ⚠️ Le parseur (titres, plages, en-tête, première phrase) vit dans
// `scripts/lib/spec-markdown.mjs`, partagé avec le futur `spec-lint` — ce
// script ne fait qu'appeler `sections()`/`enTete()` et mettre en forme.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enTete, sections } from './lib/spec-markdown.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

function listerFichiersMarkdown(chemin) {
  const info = statSync(chemin);
  if (info.isFile()) return [chemin];
  const resultat = [];
  for (const entree of readdirSync(chemin, { withFileTypes: true })) {
    if (entree.name === 'node_modules' || entree.name === '.git') continue;
    const sousChemin = join(chemin, entree.name);
    if (entree.isDirectory()) resultat.push(...listerFichiersMarkdown(sousChemin));
    else if (entree.name.endsWith('.md')) resultat.push(sousChemin);
  }
  return resultat.sort();
}

function analyser(chemin) {
  const texte = readFileSync(chemin, 'utf8');
  const { statut, lireSi } = enTete(texte);
  return {
    fichier: relative(RACINE, chemin).replace(/\\/g, '/'),
    statut,
    lireSi,
    sections: sections(texte),
  };
}

function imprimer(resultat) {
  console.log(
    `${resultat.fichier} — statut : ${resultat.statut ?? '—'} · lire si : ${resultat.lireSi ?? '—'}`
  );
  for (const s of resultat.sections) {
    console.log(`  ${'#'.repeat(s.niveau)} L${s.debut}-${s.fin} ${s.titre} — ${s.premierePhrase}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const veutJson = args.includes('--json');
  const cible = args.find((a) => !a.startsWith('--'));
  if (!cible) {
    console.error('Usage : node scripts/spec-toc.mjs <fichier|dossier> [--json]');
    process.exit(1);
  }

  const fichiers = listerFichiersMarkdown(cible);
  const resultats = fichiers.map(analyser);

  if (veutJson) {
    console.log(JSON.stringify(resultats, null, 2));
    return;
  }
  resultats.forEach((r, i) => {
    if (i > 0) console.log('');
    imprimer(r);
  });
}

main();
