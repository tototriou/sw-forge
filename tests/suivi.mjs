// Suivi en direct des vérifications — tests/README.md, « Suivi en direct ».
//
//   npm run test:suivi [-- filtres… | --depuis origin/<base>]
//   node tests/suivi.mjs [--web [port]] [arguments de tests/run.mjs…]
//
// Lance `tests/run.mjs` avec un manifeste d'exécution (tests/execution.ts) et
// dessine, dans le terminal, un tableau qui se redessine sur place : barre
// d'avancement, compteurs, entrée en cours, une mosaïque d'un caractère par
// entrée, les échecs dès qu'ils arrivent. À la fin, le tableau reste, suivi du
// détail complet des échecs. `--web` sert en plus le même suivi dans le
// navigateur. Le code de sortie est celui du lanceur.
//
// ⚠️ **Hors d'un terminal** (tube, CI), rien n'est dessiné : la sortie du
// lanceur passe telle quelle. Un tableau redessiné à coups de codes de
// curseur serait illisible dans un journal.
//
// ⚠️ Le manifeste s'écrit hors du dépôt (`os.tmpdir()`) : le lanceur le refuse
// dans le worktree, où il entrerait dans la sélection et l'empreinte.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ⚠️ **Node 24 d'abord, et en clair.** Le rendu est en TypeScript, que Node
// n'importe directement qu'à partir de sa version 24 (comme run.mjs avec
// selection.ts). Avant, l'import échoue sur un `ERR_UNKNOWN_FILE_EXTENSION`
// qui ne dit pas quoi faire : on le dit ici, avant d'importer.
const [majeur] = process.versions.node.split('.').map(Number);
if (majeur < 24) {
  console.error(
    `Node ${process.versions.node} : le dépôt demande Node 24 (.nvmrc), npm test comme npm run test:suivi.\n` +
      'Avec nvm : « nvm install » (une fois) puis « nvm use » dans ce terminal, et relancer.'
  );
  process.exit(1);
}
const { COULEURS_ANSI, LecteurSortie, tableau } = await import('./suivi/rendu.ts');

const racine = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
let port = null;
const transmis = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--web') {
    port = /^\d+$/.test(args[i + 1] ?? '') ? Number(args[++i]) : 4317;
    continue;
  }
  transmis.push(args[i]);
}
const commande = ['node tests/run.mjs', ...transmis].join(' ');

if (!process.stdout.isTTY && port === null) {
  const p = spawn(process.execPath, [join(racine, 'tests/run.mjs'), ...transmis], { cwd: racine, stdio: 'inherit' });
  p.on('close', (code) => process.exit(code ?? 1));
} else {
  suivre();
}

function suivre() {
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-suivi-'));
  const manifeste = join(dossier, 'manifeste.json');
  const journal = join(dossier, 'sortie.txt');
  const lecteur = new LecteurSortie();
  const brut = [];
  const debut = Date.now();
  let fin = null;
  const terminal = process.stdout.isTTY;

  const enfant = spawn(process.execPath, [join(racine, 'tests/run.mjs'), '--manifeste', manifeste, ...transmis], { cwd: racine });
  const lire = (morceau) => {
    const texte = morceau.toString();
    brut.push(texte);
    lecteur.lire(texte);
    if (!terminal) process.stdout.write(texte);
  };
  enfant.stdout.on('data', lire);
  enfant.stderr.on('data', lire);

  const etat = () => {
    let m = null;
    try { m = JSON.parse(readFileSync(manifeste, 'utf8')); } catch { /* pas encore écrit, ou en cours d'écriture */ }
    return { manifeste: m, echecs: lecteur.echecs, titre: lecteur.titre, queue: lecteur.queue.slice(-12), fin, debut, maintenant: Date.now(), commande };
  };

  // Redessiner sur place : remonter d'autant de lignes que le tableau précédent,
  // effacer jusqu'en bas, réécrire. Chaque ligne tient dans la largeur (sinon
  // elle passerait à la ligne et le compte serait faux).
  let hauteurPrecedente = 0;
  const dessiner = () => {
    const largeur = process.stdout.columns || 100;
    const hauteur = (process.stdout.rows || 40) - 1;
    // ⚠️ Une erreur d'affichage n'arrête jamais le suivi : le lanceur, lui,
    // continuerait sans personne pour rendre son code de sortie.
    let lignes;
    try {
      lignes = tableau(etat(), largeur, hauteur, COULEURS_ANSI);
    } catch (e) {
      lignes = [COULEURS_ANSI.mauvais(` Affichage impossible : ${String(e?.message ?? e)}`.slice(0, largeur))];
    }
    const remonter = hauteurPrecedente ? `\x1b[${hauteurPrecedente}F` : '';
    process.stdout.write(`${remonter}\x1b[J${lignes.join('\n')}\n`);
    hauteurPrecedente = lignes.length;
  };

  let minuterie = null;
  if (terminal) {
    process.stdout.write('\x1b[?25l'); // curseur masqué pendant le suivi
    dessiner();
    minuterie = setInterval(dessiner, 200);
  }
  const restaurer = () => { if (terminal) process.stdout.write('\x1b[?25h'); };

  let serveur = null;
  if (port !== null) {
    const page = readFileSync(new URL('./suivi/page.html', import.meta.url), 'utf8');
    serveur = createServer((req, res) => {
      if (req.url === '/etat') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(etat()));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page);
    }).listen(port, '127.0.0.1');
  }

  enfant.on('close', (code, signal) => {
    fin = { code, signal, a: Date.now() };
    if (minuterie) clearInterval(minuterie);
    writeFileSync(journal, brut.join(''));
    if (terminal) {
      // Le manifeste final s'écrit juste avant la sortie : dernier dessin, à jour.
      dessiner();
      restaurer();
      const echecs = lecteur.echecs;
      if (echecs.length) {
        process.stdout.write(`\n${COULEURS_ANSI.mauvais(`Échecs (${echecs.length}) :`)}\n`);
        for (const e of echecs) process.stdout.write(`\n  ${COULEURS_ANSI.pale(e.titre || '—')}\n  ${e.texte.replace(/\n/g, '\n  ')}\n`);
      } else if (code !== 0) {
        // Arrêté sans « KO » : avant de commencer (filtre inconnu, sélection
        // refusée) ou sur une exception. La raison est dans ses dernières lignes.
        const dernieres = lecteur.queue.filter((l) => l.trim()).slice(-12).map((l) => (l.length > 400 ? `${l.slice(0, 400)}…` : l));
        process.stdout.write(`\n${COULEURS_ANSI.mauvais('Le lanceur s’est arrêté :')}\n${dernieres.join('\n')}\n`);
      }
      process.stdout.write(`\n${COULEURS_ANSI.pale(`Sortie complète du lanceur : ${journal}`)}\n`);
    }
    if (serveur) {
      process.stdout.write(`${COULEURS_ANSI.pale(`Suivi web toujours servi sur http://127.0.0.1:${port}/ — Ctrl+C pour quitter.`)}\n`);
      process.exitCode = code ?? 1;
      return;
    }
    process.exit(code ?? 1);
  });

  if (port !== null && terminal) {
    // Annoncé au-dessus du tableau, qui se redessine en dessous.
    process.stdout.write(`\x1b[${hauteurPrecedente}F\x1b[JSuivi web : http://127.0.0.1:${port}/\n`);
    hauteurPrecedente = 0;
    dessiner();
  }

  process.on('SIGINT', () => {
    restaurer();
    if (!fin) enfant.kill('SIGINT');
    rmSync(manifeste, { force: true });
    process.exit(130);
  });
}
