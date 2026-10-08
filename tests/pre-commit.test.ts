// Garde-fou de commit (`.githooks/pre-commit`) — le dossier
// `spec/outils/optimizer/` n'accepte que les fichiers de
// `.githooks/optimizer-publics.txt` (version de l'index), sans marque de
// note privée ; spec/outillage/spec.md, « Refus du `pre-commit` ».
//
// Le hook source est lancé tel quel dans un dépôt jetable, sur une branche
// `forge/…` : c'est ce que Git exécute, une fois installé. Tout se passe
// dans un dossier temporaire.
//
// ⚠️ Les identifiants de lot des contenus d'essai sont assemblés (`LOT`) :
// ce fichier ne porte pas lui-même le motif qu'il vérifie.

import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(RACINE, '.githooks', 'pre-commit');
const LISTE = '.githooks/optimizer-publics.txt';
const O = 'spec/outils/optimizer';
const LOT = 'l' + 'ot';

function git(depot: string, ...args: string[]): string {
  return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8' }).trim();
}

function ecrire(depot: string, rel: string, contenu: string | Buffer) {
  mkdirSync(dirname(join(depot, rel)), { recursive: true });
  writeFileSync(join(depot, rel), contenu);
}

// La sortie est gardée même en cas de succès : un avertissement s'y lit.
function lancer(depot: string): { code: number; sortie: string } {
  const r = spawnSync(process.execPath, [HOOK], { cwd: depot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { code: r.status ?? 1, sortie: (r.stdout ?? '') + (r.stderr ?? '') };
}

export function testPreCommit() {
  titre('pre-commit — spec/outils/optimizer/ : liste des publiés et marques de note privée');
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
  } catch {
    ignore('pre-commit', 'git introuvable');
    return;
  }
  const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-pre-commit-'));
  const depot = join(bac, 'code');
  try {
    mkdirSync(depot, { recursive: true });
    git(depot, 'init', '-b', 'main');
    git(depot, 'config', 'user.email', 'essai@local');
    git(depot, 'config', 'user.name', 'Essai');
    git(depot, 'config', 'core.quotePath', 'true');
    git(depot, 'config', 'core.autocrlf', 'false');
    ecrire(depot, 'README.md', 'base\n');
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '-F', '-'], { input: 'Base\n' });
    git(depot, 'switch', '-q', '-c', 'forge/essai');

    // Un cas : fichiers écrits, chemins nommés indexés, puis, si demandé,
    // l'arbre de travail réécrit SANS réindexer ; hook lancé, dépôt remis à
    // la tête.
    type Fichiers = Record<string, string | Buffer>;
    const cas = (fichiers: Fichiers, indexes: string[] = Object.keys(fichiers), apres: Fichiers = {}) => {
      for (const [rel, contenu] of Object.entries(fichiers)) ecrire(depot, rel, contenu);
      git(depot, 'add', '--', ...indexes);
      for (const [rel, contenu] of Object.entries(apres)) ecrire(depot, rel, contenu);
      const r = lancer(depot);
      git(depot, 'reset', '-q', '--hard', 'HEAD');
      git(depot, 'clean', '-q', '-fd');
      return r;
    };
    // Un refus se reconnaît à son diagnostic, pas au seul code de sortie :
    // un hook qui plante sort aussi en 1.
    const refuse = (r: { code: number; sortie: string }, motif: RegExp) =>
      r.code === 1 && /REFUSÉ — /.test(r.sortie) && motif.test(r.sortie);
    const passe = (r: { code: number }) => r.code === 0;
    const NON_PUBLIE = /REFUSÉ — fichier non publié/;
    const RENVOI = /REFUSÉ — marque de note privée[\s\S]*renvoi aux notes/;
    const IDENTIFIANT = /REFUSÉ — marque de note privée[\s\S]*identifiant de lot/;
    const propre = '# Invariants\n\nUne règle publique.\n';

    /* ------------------------------------------------------ liste absente */
    // En premier : une fois le dossier indexé, un disque insensible à la
    // casse ramène `Optimizer/` à la casse du dossier existant.
    ok(refuse(cas({ 'spec/outils/Optimizer/x.md': propre }), NON_PUBLIE), 'casse différente du dossier : refus');
    ok(refuse(cas({ [`${O}/invariants.md`]: propre }), NON_PUBLIE),
      'ancienne branche (liste absente de l’index) : un fichier propre est refusé');
    ok(refuse(cas({ [LISTE]: `${O}/invariants.md\n`, [`${O}/invariants.md`]: propre }, [`${O}/invariants.md`]), NON_PUBLIE),
      'liste écrite mais non indexée : ignorée, refus');
    ok(passe(cas({ [LISTE]: `# en-tête\n\n  ${O}/invariants.md  \n`, [`${O}/invariants.md`]: propre })),
      'fichier et sa ligne de liste dans le même commit : accepté (commentaire, blancs)');
    ok(passe(cas({ 'spec/outils/optimizer.md': `Résultat du ${LOT} 7b, voir archive/a.md.\n` })),
      '`optimizer.md`, hors du dossier : non concerné');

    // La liste rejoint la tête : la suite se joue avec un nom déjà autorisé.
    ecrire(depot, LISTE, `${O}/invariants.md\n${O}/sous/note.md\n`);
    ecrire(depot, `${O}/invariants.md`, propre);
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '-F', '-'], { input: 'Liste\n' });

    /* ---------------------------------------------- nom absent de la liste */
    let r = cas({ [`${O}/autre.md`]: propre });
    ok(refuse(r, NON_PUBLIE) && /autre\.md/.test(r.sortie), 'nom absent de la liste : refus');
    ok(refuse(cas({ [`${O}/résumé.md`]: propre }), NON_PUBLIE), 'nom non ASCII absent de la liste : refus (chemin non cité)');
    ok(refuse(cas({ '.history/é.md': propre }), /REFUSÉ — chemin privé/), '`.history/` sous un nom non ASCII : refus');

    /* ------------------------------------------- renommage vers le dossier */
    const renommer = (vers: string) => {
      mkdirSync(dirname(join(depot, vers)), { recursive: true });
      git(depot, 'mv', 'README.md', vers);
      const resultat = lancer(depot);
      git(depot, 'reset', '-q', '--hard', 'HEAD');
      git(depot, 'clean', '-q', '-fd');
      return resultat;
    };
    ok(refuse(renommer(`${O}/lu.md`), NON_PUBLIE), 'renommage vers un nom absent de la liste : refus');
    ok(passe(renommer(`${O}/sous/note.md`)), 'renommage vers un nom de la liste, contenu propre : accepté');

    /* ----------------------- ancien outil : note privée sous un nom autorisé */
    const marque = (contenu: string | Buffer) => cas({ [`${O}/invariants.md`]: contenu });
    r = marque('# Invariants\n\nDétail : [historique](archive/historique/h.md).\n');
    ok(refuse(r, RENVOI) && /l\. 3, renvoi aux notes/.test(r.sortie),
      'ancien outil, nom déjà autorisé, renvoi aux notes : refus, ligne citée');
    ok(refuse(marque(`# Invariants\n\nRésultat du ${LOT} 7b : règle vérifiée.\n`), IDENTIFIANT),
      'note privée sans lien privé mais avec un identifiant de lot : refus');
    ok(refuse(cas({ [`${O}/invariants.md`]: 'Voir archive/h.md.\n' }, undefined, { [`${O}/invariants.md`]: propre }), RENVOI),
      'note privée indexée, disque propre : le contenu de l’index fait foi, refus');
    ok(passe(cas({ [`${O}/invariants.md`]: propre }, undefined, { [`${O}/invariants.md`]: 'Voir archive/h.md.\n' })),
      'index propre, disque privé : accepté');
    // Caractères construits par leur code : visibles dans ce source.
    const INSECABLE = String.fromCharCode(0xa0);
    const CIRCONFLEXE = String.fromCharCode(0x302);
    const utf16 = (s: string, grosBoutiste = false) => {
      const octets = Buffer.from(s, 'utf16le');
      return Buffer.concat([Buffer.from(grosBoutiste ? [0xfe, 0xff] : [0xff, 0xfe]), grosBoutiste ? octets.swap16() : octets]);
    };
    ok(refuse(marque(utf16(`Voir archive/h.md, ${LOT} 7b.\r\n`)), RENVOI), 'note en UTF-16 : refus');
    ok(refuse(marque(utf16(`Résultat du ${LOT}${INSECABLE}7b.\r\n`)), IDENTIFIANT),
      'note en UTF-16, identifiant à espace insécable seul : refus');
    ok(refuse(marque(utf16(`Résultat du ${LOT}${INSECABLE}7b.\r\n`, true)), IDENTIFIANT),
      'note en UTF-16 gros-boutiste, identifiant à espace insécable : refus');
    ok(refuse(marque(Buffer.from('Voir archive/h.md.\r\n', 'utf16le')), RENVOI), 'note en UTF-16 sans BOM : refus');
    git(depot, 'update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},${O}/sous/note.md`);
    r = lancer(depot);
    git(depot, 'reset', '-q', '--hard', 'HEAD');
    ok(refuse(r, /REFUSÉ — contenu illisible/), 'contenu illisible dans l’index (sous-module inconnu) : refus');

    const identifiants: [string, string][] = [
      [`Source : ${LOT}s 3a–3c.`, 'pluriel et plage'],
      [`${LOT.toUpperCase()} 12 : fait.`, 'capitales'],
      [`Le ${LOT}-6bis.`, 'tiret et « bis »'],
      [`Étape du ${LOT} P5a2.`, 'étiquette lettres et chiffres'],
      [`{ ${LOT}: '1a2' }`, 'clé de données'],
      [`Résultat du ${LOT}\u00A07b.`, 'espace insécable'],
      [`Résultat du ${LOT}\t7b.`, 'tabulation'],
      [`Résultat du ${LOT}  7b.`, 'deux espaces'],
    ];
    for (const [ligne, libelle] of identifiants) ok(refuse(marque(`${ligne}\n`), IDENTIFIANT), `identifiant de lot, ${libelle} : refus`);
    ok(passe(marque(`Un ${LOT} de runes, le s${LOT} 4, le pi${LOT}e 2, un î${LOT} 7, un i${CIRCONFLEXE}${LOT} 8.\n`)),
      'mot « lot » seul, « slot », « pilote », « îlot » composé ou non : acceptés');

    /* --------------------------------------------- formes du renvoi aux notes */
    const renvois: [string, string][] = [
      ['`chantiers/x.md`', 'chemin nu vers les cadrages'],
      ['decisions/d.md § Titre', 'référence § vers les décisions'],
      ['[a](./archive/a.md)', 'lien en ./'],
      [`[a](${O}/archive/a.md)`, 'chemin depuis la racine'],
      ['[h](Spec/Outils/Optimizer/./archive/h.md)', 'depuis la racine, casse différente'],
      ['https://exemple.org/blob/main/spec/outils/optimizer/decisions/d.md', 'adresse qui contient le chemin'],
      ['[a](../a-publier/a.md)', 'renvoi vers a-publier/'],
      ['« Archive/A.md »', 'casse différente, entre guillemets français'],
      ['[historique](archive)', 'lien vers le dossier lui-même'],
      ['[notes](../a-publier)', 'lien vers a-publier lui-même'],
      ['Source=archive/h.md, Source:decisions/d.md', 'collé à = ou :'],
      ['archive\\historique\\h.md', 'séparateurs Windows'],
      ['[Historique][notes]\n\n[notes]: archive', 'définition de lien par référence vers le dossier'],
    ];
    for (const [ligne, libelle] of renvois) ok(refuse(marque(`${ligne}\n`), RENVOI), `renvoi aux notes, ${libelle} : refus`);
    ok(refuse(cas({ [`${O}/sous/note.md`]: '[h](../archive/h.md)\n' }), RENVOI), 'depuis un sous-dossier publié, `../archive/` : refus');
    ok(passe(marque([
      '[a](../../chantiers/c.md), spec/chantiers/c.md, [d](../degats-reels/decisions/d.md)',
      `[d](${O}/archive/../../degats-reels/decisions/d.md)`,
      'Une archive, des chantiers : [voir](#archive).',
    ].join('\n') + '\n')),
      'renvois publics homonymes, chemin normalisé hors des notes, mots et ancres : acceptés');

    /* ------------------------------------------------ ESLint sur le code indexé */
    // Configuration minimale à elle, ESLint du dépôt par une jonction vers son
    // `node_modules`, ignoré par Git : `git clean` n'y touche jamais.
    const LINT = /REFUSÉ — ESLint refuse le code indexé/;
    ok(passe(cas({ 'a.js': 'debugger;\n' })), 'sans eslint.config.js (branche antérieure au lint) : pas de lint');
    ecrire(depot, '.gitignore', 'node_modules\n');
    ecrire(depot, 'package.json', '{ "type": "module" }\n');
    ecrire(depot, 'eslint.config.js',
      "export default [{ rules: { 'no-debugger': 'error', 'no-unused-vars': 'warn' } }];\n");
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '--no-verify', '-F', '-'], { input: 'Lint\n' });
    r = cas({ 'a.js': 'debugger;\n' });
    ok(passe(r) && /ESLint absent/.test(r.sortie), 'ESLint absent : lint sauté, avertissement, commit accepté');
    symlinkSync(join(RACINE, 'node_modules'), join(depot, 'node_modules'), 'junction');
    r = cas({ 'a.js': 'debugger;\n' });
    ok(refuse(r, LINT) && /a\.js/.test(r.sortie) && /no-debugger/.test(r.sortie), 'erreur ESLint dans un fichier indexé : refus, fichier et règle cités');
    ok(passe(cas({ 'a.js': 'const inutile = 1;\n' })), 'avertissement seul : accepté');
    ok(passe(cas({ 'a.js': 'debugger;\n', 'b.js': 'export const x = 1;\n' }, ['b.js'])), 'fichier fautif non indexé : non lu');
    ok(passe(cas({ 'notes.md': 'debugger;\n' })), 'fichier qui n’est pas du code : non lu');
    ok(refuse(cas({ 'a.js': 'export const x = 1;\n' }, undefined, { 'a.js': 'debugger;\n' }), LINT),
      'limite assumée : le lint lit l’arbre de travail, pas l’index');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
