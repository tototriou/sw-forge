// Refuse un `Read` sans `offset`/`limit` sur un `spec/**.md` de plus de
// 300 lignes — voir CADRAGE-rangement-specs.md, B.9 § Hook `Read`, et
// CLAUDE.md, « La spec avant le code ».
//
// ⚠️ Niveau 2 (« garde-fou outil », B.9) : refuse le chemin le PLUS COURANT
// d'une lecture par erreur d'un fichier entier — ni `cat`, ni un autre outil
// de lecture, ni un `Read` avec un offset choisi pour contourner le rappel ne
// sont couverts. Ce n'est pas un invariant, seulement une aide.
//
// Exception : `invariants.md` (spec/outils/optimizer/invariants.md) — seul
// fichier que CLAUDE.md désigne pour être lu en entier, tenu compact pour ça.
//
// Protocole identique à refuse-commit-m.mjs : JSON de l'outil sur stdin,
// sortie 2 pour REFUSER (stderr rendu à l'agent), tout le reste laisse passer.

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const SEUIL_LIGNES = 300;

let brut = '';
for await (const morceau of process.stdin) brut += morceau;

let charge;
try {
  charge = JSON.parse(brut);
} catch {
  // Entrée illisible : un hook qui bloque sur son propre bug serait pire que
  // le défaut qu'il prévient.
  process.exit(0);
}

if (charge.tool_name !== 'Read') process.exit(0);

const entree = charge.tool_input ?? {};
const cheminBrut = String(entree.file_path ?? '');
if (!cheminBrut) process.exit(0);

// Une lecture PARTIELLE est exactement ce que le rappel demande de faire.
if (entree.offset != null || entree.limit != null) process.exit(0);

const racine = String(charge.cwd ?? process.cwd());
const cheminAbsolu = isAbsolute(cheminBrut) ? cheminBrut : resolve(racine, cheminBrut);
const relatif = relative(racine, cheminAbsolu).replace(/\\/g, '/');

if (!/^spec\/.*\.md$/.test(relatif)) process.exit(0);
if (relatif === 'spec/outils/optimizer/invariants.md') process.exit(0);
if (!existsSync(cheminAbsolu)) process.exit(0);

let nbLignes = 0;
try {
  nbLignes = readFileSync(cheminAbsolu, 'utf8').split(/\r\n|\n/).length;
} catch {
  process.exit(0);
}

if (nbLignes <= SEUIL_LIGNES) process.exit(0);

process.stderr.write(
  `REFUSÉ — lecture entière de ${relatif} (${nbLignes} lignes, > ${SEUIL_LIGNES}) sans offset/limit.\n\n` +
    `CLAUDE.md : « jamais un fichier entier de plus de 300 lignes sans raison écrite ».\n` +
    `Ouvrir le sommaire, puis lire seulement la section utile :\n\n` +
    `  node scripts/spec-toc.mjs ${relatif}\n`
);
process.exit(2);
