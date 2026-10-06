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

import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
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

function ecrire(depot: string, rel: string, contenu: string) {
  mkdirSync(dirname(join(depot, rel)), { recursive: true });
  writeFileSync(join(depot, rel), contenu);
}

function lancer(depot: string): { code: number; sortie: string } {
  try {
    execFileSync(process.execPath, [HOOK], { cwd: depot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, sortie: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: (err.stdout ?? '') + (err.stderr ?? '') };
  }
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

    // Un cas : fichiers écrits, chemins nommés indexés, hook lancé, dépôt
    // remis à la tête.
    const cas = (fichiers: Record<string, string>, indexes: string[] = Object.keys(fichiers)) => {
      for (const [rel, contenu] of Object.entries(fichiers)) ecrire(depot, rel, contenu);
      git(depot, 'add', '--', ...indexes);
      const r = lancer(depot);
      git(depot, 'reset', '-q', '--hard', 'HEAD');
      git(depot, 'clean', '-q', '-fd');
      return r;
    };
    const refuse = (r: { code: number }) => r.code === 1;
    const passe = (r: { code: number }) => r.code === 0;
    const propre = '# Invariants\n\nUne règle publique.\n';

    /* ------------------------------------------------------ liste absente */
    let r = cas({ [`${O}/invariants.md`]: propre });
    ok(refuse(r) && /fichier non publié/.test(r.sortie),
      'ancienne branche (liste absente de l’index) : un fichier propre est refusé');
    r = cas({ [LISTE]: `${O}/invariants.md\n`, [`${O}/invariants.md`]: propre }, [`${O}/invariants.md`]);
    ok(refuse(r), 'liste écrite mais non indexée : ignorée, refus');
    r = cas({ [LISTE]: `# en-tête\n\n  ${O}/invariants.md  \n`, [`${O}/invariants.md`]: propre });
    ok(passe(r), 'fichier et sa ligne de liste dans le même commit : accepté (commentaire, blancs)');
    ok(passe(cas({ 'spec/outils/optimizer.md': `Résultat du ${LOT} 7b, voir archive/a.md.\n` })),
      '`optimizer.md`, hors du dossier : non concerné');

    // La liste rejoint la tête : la suite se joue avec un nom déjà autorisé.
    ecrire(depot, LISTE, `${O}/invariants.md\n${O}/sous/note.md\n`);
    ecrire(depot, `${O}/invariants.md`, propre);
    git(depot, 'add', '-A');
    execFileSync('git', ['-C', depot, 'commit', '-q', '-F', '-'], { input: 'Liste\n' });

    /* ---------------------------------------------- nom absent de la liste */
    r = cas({ [`${O}/autre.md`]: propre });
    ok(refuse(r) && /autre\.md/.test(r.sortie), 'nom absent de la liste : refus');
    ok(refuse(cas({ [`${O}/résumé.md`]: propre })), 'nom non ASCII absent de la liste : refus (chemin non cité)');
    ok(refuse(cas({ 'spec/outils/Optimizer/x.md': propre })), 'casse différente du dossier : refus');
    ok(refuse(cas({ '.history/é.md': propre })), '`.history/` sous un nom non ASCII : refus');

    /* ----------------------- ancien outil : note privée sous un nom autorisé */
    const marque = (contenu: string) => cas({ [`${O}/invariants.md`]: contenu });
    r = marque('# Invariants\n\nDétail : [historique](archive/historique/h.md).\n');
    ok(refuse(r) && /l\. 3, renvoi aux notes/.test(r.sortie),
      'ancien outil, nom déjà autorisé, renvoi aux notes : refus, ligne citée');
    r = marque(`# Invariants\n\nRésultat du ${LOT} 7b : règle vérifiée.\n`);
    ok(refuse(r) && /identifiant de lot/.test(r.sortie), 'note privée sans lien privé mais avec un identifiant de lot : refus');
    ok(refuse(marque(`Source : ${LOT}s 3a–3c.\n`)), 'identifiant de lot : pluriel et plage');
    ok(refuse(marque(`${LOT.toUpperCase()} 12 : fait.\n`)), 'identifiant de lot : capitales');
    ok(refuse(marque(`Le ${LOT}-6bis.\n`)), 'identifiant de lot : tiret et « bis »');
    ok(refuse(marque(`Étape du ${LOT} P5a2.\n`)), 'identifiant de lot : étiquette lettres et chiffres');
    ok(refuse(marque(`{ ${LOT}: '1a2' }\n`)), 'identifiant de lot : clé de données');
    ok(passe(marque(`Un ${LOT} de runes, le s${LOT} 4, le pi${LOT}e 2.\n`)), 'mot « lot » seul, « slot », « pilote » : acceptés');

    /* --------------------------------------------- formes du renvoi aux notes */
    const renvois: [string, string][] = [
      ['`chantiers/x.md`', 'chemin nu vers les cadrages'],
      ['decisions/d.md § Titre', 'référence § vers les décisions'],
      ['[a](./archive/a.md)', 'lien en ./'],
      [`[a](${O}/archive/a.md)`, 'chemin depuis la racine'],
      ['https://exemple.org/blob/main/spec/outils/optimizer/decisions/d.md', 'adresse qui contient le chemin'],
      ['[a](../a-publier/a.md)', 'renvoi vers a-publier/'],
      ['« Archive/A.md »', 'casse différente, entre guillemets français'],
    ];
    for (const [ligne, libelle] of renvois) ok(refuse(marque(`${ligne}\n`)), `renvoi aux notes, ${libelle} : refus`);
    ok(refuse(cas({ [`${O}/sous/note.md`]: '[h](../archive/h.md)\n' })), 'depuis un sous-dossier publié, `../archive/` : refus');
    ok(passe(marque('[a](../../chantiers/c.md), spec/chantiers/c.md, [d](../degats-reels/decisions/d.md)\n')),
      'renvois publics homonymes (spec/chantiers/, degats-reels/decisions/) : acceptés');
  } finally {
    // bac provient exclusivement de mkdtempSync sous tmpdir.
    rmSync(bac, { recursive: true, force: true });
  }
}
