// Règles d'écriture du public, appliquées aux specs de l'Optimizer et des
// dégâts réels. Contrat : spec/outillage/spec.md § Test des règles d'écriture.
//
// Chaque ligne de chaque `.md` du périmètre est confrontée à cinq règles :
// une date, un identifiant de lot (avec ou sans le mot « lot »),
// « décision de l'utilisateur », « incident », « session ». Une occurrence
// n'est admise que par une exception de la liste plus bas, qui porte sa
// raison ; une exception qui ne couvre plus rien fait échouer.
//
// ⚠️ Les cas négatifs de `testEcriturePubliqueFormes` écrivent à dessein des
// formes proscrites, toutes fictives : ce fichier est hors du périmètre.

import { readFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { fichiersMarkdown } from '../scripts/lib/spec-markdown.mjs';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

// Motifs à la manière de `spec/spec-lint.json` : un dossier et tout ce qu'il
// contient.
export const PERIMETRE = ['spec/outils/optimizer/**', 'spec/outils/degats-reels/**'];

// Seul fichier dont une colonne admet une date : la provenance d'une valeur
// de jeu (qui l'a fournie, quand) reste publique.
export const VALEURS_CUREES = 'spec/outils/degats-reels/valeurs-de-jeu-curees.md';

export type Regle = 'date' | 'identifiant' | 'decision' | 'incident' | 'session';

const MOIS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';

// Date ISO, année-mois, jj/mm/aaaa, « 14 février », « mars 2031 ».
const DATE = new RegExp(
  [
    String.raw`\b\d{4}-\d{2}-\d{2}\b`,
    String.raw`\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])\b`,
    String.raw`\b\d{1,2}/\d{1,2}/(?:19|20)\d{2}\b`,
    String.raw`\b\d{1,2}(?:er)? (?:${MOIS})\b`,
    String.raw`\b(?:${MOIS}) (?:19|20)\d{2}\b`,
  ].join('|'),
  'i'
);

// Identifiants de lot ou de pilotage. Le mot « lot » suivi d'un numéro ou
// d'une étiquette (jamais « lot » seul : « un lot de runes » passe), puis les
// formes qui se passent du mot.
const IDENTIFIANTS: RegExp[] = [
  /\b(?:[Ll]ots?|LOTS?)[ -]?(?:[0-9]+(?:[a-z][0-9]?)?(?:bis|[-–][0-9a-z]+)?|[A-Z]{1,2}[0-9]+[a-z0-9]*|CM\b|EX[0-9]?\b)|\blot: ?['"][0-9][0-9a-z]*['"]/,
  /\b\d+bis(?:-[a-z0-9]+)?\b/, // numéro « bis », avec ou sans suite
  // numéro à lettre puis suite ; « e » exclu devant un chiffre, qui est une
  // notation scientifique (`1e-9`)
  /\b\d+[a-df-z]\d*-[a-z]?\d+\b|\b\d+[a-z]\d*-[a-z]\d+\b/,
  /\b[A-Z]{1,2}\d+[a-z]\d*\b/, // étiquette lettre, chiffres, lettre
  /\b[DQ]\d{1,3}\b/, // décision ou question numérotée
  /\b[A-Z]{2,3}-\d{2,}\b/, // sigle, tiret, numéro
  /\bconstats? (?:n°\s?)?\d+/i,
  /\b[A-Z]\.\d+(?:\.\d+)*(?:\s(?:bis|ter|quater)\b)?/, // section d'un cadrage
];

// « § n.m » : refusé, sauf derrière le nom d'un `.md`, qui en fait un renvoi
// vers un titre numéroté d'une spec publique (vérifié par `spec-lint`).
const PARAGRAPHE = /§\s?\d+(?:\.\d+)+/g;
const DERRIERE_UN_FICHIER = /[\w-]+\.md`?\s*$/;

const REGLES: [Regle, (ligne: string) => boolean][] = [
  ['date', (l) => DATE.test(l)],
  [
    'identifiant',
    (l) => IDENTIFIANTS.some((re) => re.test(l)) || [...l.matchAll(PARAGRAPHE)].some((m) => !DERRIERE_UN_FICHIER.test(l.slice(0, m.index))),
  ],
  ['decision', (l) => /\bdécisions? (?:de l['’]utilisateur|utilisateur)\b/i.test(l)],
  ['incident', (l) => /\bincidents?\b/i.test(l)],
  // `sessionStorage` (API du navigateur) ne correspond pas : mot entier.
  ['session', (l) => /\bsessions?\b/i.test(l)],
];

export interface Occurrence {
  fichier: string;
  ligne: number;
  regle: Regle;
  texte: string;
}

export interface Exception {
  fichier: string;
  fragment: string;
  regle: Regle;
  raison: string;
}

// Une exception couvre, dans son fichier, la règle nommée sur toute ligne qui
// contient son fragment, et rien d'autre.
export const EXCEPTIONS: Exception[] = [
  {
    fichier: VALEURS_CUREES,
    fragment: '(joueur), le 2026-09-23, sauf mention contraire',
    regle: 'date',
    raison: 'provenance par défaut des valeurs du tableau, dite une fois au-dessus de la colonne « Source »',
  },
  {
    fichier: 'spec/outils/optimizer/ecran/README.md',
    fragment: 'onglets de la session en cours',
    regle: 'session',
    raison: 'session du navigateur : la saisie vit tant que l’onglet reste ouvert',
  },
  {
    fichier: 'spec/outils/optimizer/invariants.md',
    fragment: 'avant tout import de la session',
    regle: 'session',
    raison: 'session du navigateur : depuis l’ouverture de l’onglet',
  },
];

// Découpe une ligne de tableau sur ses `|` non échappés.
function cellules(ligne: string): string[] {
  return ligne.split(/(?<!\\)\|/);
}

// Dans le fichier des valeurs curées, la cellule « Source » de chaque ligne
// de tableau est vidée avant contrôle : sa date est une provenance.
function sansColonneSource(lignes: string[]): string[] {
  let colonne = -1;
  return lignes.map((l) => {
    if (!l.trimStart().startsWith('|')) {
      colonne = -1;
      return l;
    }
    const c = cellules(l);
    const entete = c.findIndex((x) => x.trim() === 'Source');
    if (colonne === -1 && entete !== -1) {
      colonne = entete;
      return l;
    }
    if (colonne === -1 || colonne >= c.length) return l;
    c[colonne] = '';
    return c.join('|');
  });
}

export function relever(fichier: string, texte: string): Occurrence[] {
  const brutes = texte.split(/\r?\n/);
  const lignes = fichier === VALEURS_CUREES ? sansColonneSource(brutes) : brutes;
  const occurrences: Occurrence[] = [];
  lignes.forEach((l, i) => {
    for (const [regle, refuse] of REGLES) {
      if (refuse(l)) occurrences.push({ fichier, ligne: i + 1, regle, texte: brutes[i].trim() });
    }
  });
  return occurrences;
}

export function appliquerExceptions(
  occurrences: Occurrence[],
  exceptions: Exception[]
): { restantes: Occurrence[]; inutilisees: Exception[] } {
  const servies = new Set<Exception>();
  const restantes = occurrences.filter((o) => {
    const e = exceptions.find((x) => x.fichier === o.fichier && x.regle === o.regle && o.texte.includes(x.fragment));
    if (e) servies.add(e);
    return !e;
  });
  return { restantes, inutilisees: exceptions.filter((e) => !servies.has(e)) };
}

function regles(fichier: string, texte: string): Regle[] {
  return relever(fichier, texte).map((o) => o.regle);
}

export function testEcriturePubliqueFormes() {
  titre('écriture publique · formes refusées et admises — texte fourni');

  const F = 'exemple.md';
  const refusees: [string, Regle][] = [
    ['Décidé le 2031-02-14.', 'date'],
    ['Plan de 2031-02 repris.', 'date'],
    ['Relu le 14 février, sans suite.', 'date'],
    ['Constaté en mars 2031.', 'date'],
    ['Note du 14/02/2031.', 'date'],
    ['Voir le lot 9c pour la suite.', 'identifiant'],
    ['Repris de 9bis-c4 tel quel.', 'identifiant'],
    ['Étape 9a-b2 close.', 'identifiant'],
    ['Étape P7b2 close.', 'identifiant'],
    ['Tranché par D99.', 'identifiant'],
    ['Ouvert par XY-07.', 'identifiant'],
    ['Voir le constat 3.', 'identifiant'],
    ['Comme le dit A.2 ter, rien ne bouge.', 'identifiant'],
    ['Règle B.9 du cadrage.', 'identifiant'],
    ['Voir § 4.2 du cadrage.', 'identifiant'],
    ["Sur décision de l'utilisateur, le défaut change.", 'decision'],
    ['Sur décision de l’utilisateur, le défaut change.', 'decision'],
    ['Après un incident de mesure, on relance.', 'incident'],
    ['Pendant la session de travail, le cache grossit.', 'session'],
  ];
  for (const [ligne, regle] of refusees) {
    ok(regles(F, ligne).includes(regle), `refusé (${regle}) : ${ligne}`);
  }

  const admises = [
    'Un lot de runes, un lot de 3 runes.',
    'Le slot 2 porte la VIT.',
    'Le S3 de Lynn peut être critique.',
    '`sessionStorage` garde la saisie de l’onglet.',
    'Voir [bonus](compte/calcul-runes.md § 5.2 Bonus de set).',
    'Voir `calcul-runes.md` § 5.2 Bonus de set.',
    'Un écart de 1e-9 tranche, une tolérance de 1e-6.',
    'Lignes 2016-2048 du harnais.',
    'Ratio 3.7 × ATQ, 6 coups au plus.',
    'Le choix de l’utilisateur règle l’interrupteur.',
  ];
  for (const ligne of admises) {
    egal(regles(F, ligne), [], `admis : ${ligne}`);
  }

  // Colonne « Source » : la date n'y est admise que dans le fichier des
  // valeurs curées, et seulement dans cette colonne.
  const tableau = [
    '| Mécanique | Valeur retenue | Source |',
    '| --- | --- | --- |',
    '| Coup 3 | `3.0 × ATQ` | utilisateur, 2031-02-14 |',
    '| Coup 4 | relevé du 2031-02-14 | utilisateur |',
  ].join('\n');
  const dansCurees = relever(VALEURS_CUREES, tableau).filter((o) => o.regle === 'date');
  egal(dansCurees.map((o) => o.ligne), [4], 'valeurs curées : date admise en colonne « Source », refusée dans une autre colonne');
  egal(
    relever(F, tableau).filter((o) => o.regle === 'date').map((o) => o.ligne),
    [3, 4],
    'hors du fichier des valeurs curées, la colonne « Source » n’admet pas de date'
  );
  egal(
    relever(VALEURS_CUREES, 'Fourni le 2031-02-14, hors tableau.').map((o) => o.regle),
    ['date'],
    'valeurs curées : une date hors tableau est refusée'
  );

  // Exceptions : une exception couvre sa règle sur sa ligne, rien d'autre,
  // et une exception qui ne couvre rien est signalée.
  const occ = relever(F, 'Dans la session du 2031-02-14.');
  const sert: Exception = { fichier: F, fragment: 'la session du', regle: 'session', raison: 'cas d’essai' };
  const sertPlus: Exception = { fichier: F, fragment: 'absent', regle: 'session', raison: 'cas d’essai' };
  const { restantes, inutilisees } = appliquerExceptions(occ, [sert, sertPlus]);
  egal(restantes.map((o) => o.regle), ['date'], 'une exception « session » ne couvre pas la date de la même ligne');
  egal(inutilisees, [sertPlus], 'une exception qui ne couvre plus rien est signalée');
}

export function testEcriturePublique() {
  titre('écriture publique · specs de l’Optimizer et des dégâts réels');

  const fichiers = PERIMETRE.flatMap((m) => fichiersMarkdown(join(RACINE, m.replace(/\/\*\*$/, '')))).map((f) =>
    relative(RACINE, f).split('\\').join('/')
  );
  ok(fichiers.includes(VALEURS_CUREES) && fichiers.length > 40, `précondition : périmètre lu (${fichiers.length} fichiers)`);

  const occurrences = fichiers.flatMap((f) => relever(f, readFileSync(join(RACINE, f), 'utf8')));
  const { restantes, inutilisees } = appliquerExceptions(occurrences, EXCEPTIONS);

  ok(
    restantes.length === 0,
    restantes.length === 0
      ? `aucune forme proscrite hors exception (${occurrences.length - restantes.length} occurrence(s) admise(s))`
      : `${restantes.length} forme(s) proscrite(s) — ` +
          restantes.map((o) => `${o.fichier}:${o.ligne} [${o.regle}] ${o.texte.slice(0, 100)}`).join(' · ')
  );
  ok(
    inutilisees.length === 0,
    inutilisees.length === 0
      ? `chaque exception sert (${EXCEPTIONS.length})`
      : `exception(s) qui ne servent plus — ${inutilisees.map((e) => `${e.fichier} « ${e.fragment} » [${e.regle}]`).join(' · ')}`
  );
}
