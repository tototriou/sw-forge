// Banc d'affichage : construit l'app, la sert, l'ouvre dans Chromium sans
// fenêtre aux deux formats, amène chaque écran dans chacun de ses états
// (ecrans.ts), mesure ce qui déborde (règle : tête de mesure.ts) et capture.
//
//   node tests/banc/run.mjs --tous --compte tests/fixtures/compte-miniature.json
//   node tests/banc/run.mjs --ecrans optimizer
//
// Codes de sortie : 0 rien ne déborde ; 1 un débordement ; 2 le banc n'a pas
// pu mesurer (Chromium absent, construction ou serveur en échec, état
// non atteint, compte ou sortie refusés).
//
// Le banc vérifie un invariant, il ne compare aucune capture : les captures
// servent à regarder ce qui a été mesuré. Il ne tourne ni dans `npm test` ni
// en CI (tests/README.md).

import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import net from 'net';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve, sep, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { atteintPour, ECRANS, FORMATS, ORDRE_FORMATS, preparationPour } from './ecrans.ts';
import {
  attendrePose,
  compteAbsent,
  ErreurBanc,
  importerCompte,
  lancerNavigateur,
  medias,
  mesurerEtCapturer,
  ouvrirContexte,
  preparer,
  verifierAtteint,
} from './session.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEPOT_BANC = resolve(ICI, '../..');
const COMPTE_EXEMPLE = join(DEPOT_BANC, 'tests', 'fixtures', 'compte-miniature.json');

const AIDE = `Banc d'affichage — rien ne déborde, aux deux formats.

  node tests/banc/run.mjs (--tous | --ecrans <id,…>) [options]

Sélection (une seule, obligatoire) :
  --tous               tous les écrans de tests/banc/ecrans.ts
  --ecrans <id,…>      les écrans nommés

Options :
  --racine <dossier>   l'arbre à construire et mesurer (défaut : ce dépôt)
  --compte <fichier>   l'export importé (défaut : tests/fixtures/compte-miniature.json) ;
                       hors de tests/fixtures/, il est traité comme un compte réel :
                       sortie obligatoirement hors de tout dépôt Git, aucun message
                       de la page sur la sortie standard
  --sortie <dossier>   captures et manifeste.json (défaut : SWB_BANC_SORTIE, sinon
                       un dossier temporaire)
  --aide               cette aide

Codes : 0 rien ne déborde · 1 débordement · 2 le banc n'a pas pu mesurer.`;

/** Refus du banc : code 2, message écrit par le banc. */
class Refus extends Error {}

function lireArguments(argv) {
  const args = { tous: false, ecrans: null, racine: null, compte: null, sortie: null, aide: false };
  const AVEC_VALEUR = { '--ecrans': 'ecrans', '--racine': 'racine', '--compte': 'compte', '--sortie': 'sortie' };
  for (let i = 0; i < argv.length; i++) {
    const brut = argv[i];
    const egal = brut.indexOf('=');
    const nom = brut.startsWith('--') && egal > 0 ? brut.slice(0, egal) : brut;
    if (nom === '--tous') args.tous = true;
    else if (nom === '--aide' || nom === '--help' || nom === '-h') args.aide = true;
    else if (nom in AVEC_VALEUR) {
      const valeur = egal > 0 && brut.startsWith('--') ? brut.slice(egal + 1) : argv[++i];
      if (valeur === undefined || valeur === '') throw new Refus(`${nom} attend une valeur\n\n${AIDE}`);
      args[AVEC_VALEUR[nom]] = valeur;
    } else throw new Refus(`option inconnue : ${brut}\n\n${AIDE}`);
  }
  return args;
}

function sha256(donnees) {
  return createHash('sha256').update(donnees).digest('hex');
}

function sousDossier(chemin, dossier) {
  const r = relative(dossier, chemin);
  return r !== '' && !r.startsWith('..') && !isAbsolute(r);
}

/** Le premier dossier ancêtre (lui compris) qui contient un `.git`, ou null. */
function depotGitContenant(chemin) {
  // Chemin réel du premier ancêtre existant : un lien ou une jonction ne doit
  // pas faire passer un dossier du dépôt pour un dossier extérieur.
  let existant = resolve(chemin);
  while (!existsSync(existant)) {
    const parent = dirname(existant);
    if (parent === existant) break;
    existant = parent;
  }
  for (let d = realpathSync(existant); ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d;
    if (dirname(d) === d) return null;
  }
}

function git(racine, args) {
  return new Promise((ok) => {
    const p = spawn('git', ['-C', racine, ...args], { stdio: ['ignore', 'pipe', 'ignore'] });
    const morceaux = [];
    p.stdout.on('data', (d) => morceaux.push(d));
    p.on('error', () => ok(null));
    p.on('close', (code) => ok(code === 0 ? Buffer.concat(morceaux) : null));
  });
}

/**
 * Révision de l'arbre et empreinte de son état de travail : modifications
 * suivies (diff contre HEAD) et fichiers non suivis non ignorés, contenu
 * compris — une mutation non commitée change l'empreinte.
 */
async function etatGit(racine, { chemins = [] } = {}) {
  const revision = await git(racine, ['rev-parse', 'HEAD']);
  if (revision === null) return { revision: null, propre: null, empreinte: null };
  const statut = (await git(racine, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...chemins])) ?? Buffer.alloc(0);
  const diff = (await git(racine, ['diff', 'HEAD', '--binary', '--', ...chemins])) ?? Buffer.alloc(0);
  const nonSuivis = ((await git(racine, ['ls-files', '--others', '--exclude-standard', '-z', '--', ...chemins])) ?? Buffer.alloc(0))
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .sort();
  const h = createHash('sha256');
  h.update(statut).update('\0').update(diff);
  for (const f of nonSuivis) {
    h.update(`\0${f}\0`);
    try {
      h.update(readFileSync(join(racine, f)));
    } catch {
      h.update('(illisible)');
    }
  }
  return { revision: revision.toString('utf8').trim(), propre: statut.length === 0, empreinte: h.digest('hex') };
}

function lancer(args, cwd) {
  const p = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const sortie = [];
  p.stdout.on('data', (d) => sortie.push(d));
  p.stderr.on('data', (d) => sortie.push(d));
  const fin = new Promise((ok) => {
    p.on('error', () => ok(-1));
    p.on('exit', (code) => ok(code ?? -1));
  });
  return { p, fin, texte: () => Buffer.concat(sortie).toString('utf8') };
}

function portLibre(port) {
  return new Promise((ok) => {
    const s = net.createServer();
    s.once('error', () => ok(false));
    s.listen(port, '127.0.0.1', () => s.close(() => ok(true)));
  });
}

function portAuHasard() {
  return new Promise((ok, ko) => {
    const s = net.createServer();
    s.once('error', ko);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function attendreServeur(base, serveur, maxMs) {
  const debut = Date.now();
  let fini = false;
  serveur.fin.then(() => (fini = true));
  while (Date.now() - debut < maxMs) {
    if (fini) return false;
    try {
      const r = await fetch(base);
      if (r.ok) return true;
    } catch {
      // pas encore à l'écoute
    }
    await attendre(200);
  }
  return false;
}

/** Arrête le serveur et tout ce qu'il a lancé, puis attend sa fin (bornée). */
async function arreterServeur(serveur) {
  if (process.platform === 'win32') {
    const k = spawn('taskkill.exe', ['/PID', String(serveur.p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await new Promise((ok) => {
      k.on('error', ok);
      k.on('exit', ok);
    });
  } else {
    serveur.p.kill('SIGTERM');
  }
  // `unref` : le délai de garde ne doit pas retenir le processus 10 s de plus
  // une fois le serveur arrêté.
  const garde = new Promise((ok) => setTimeout(ok, 10000, false).unref());
  return Promise.race([serveur.fin.then(() => true), garde]);
}

async function attendrePortLibre(port, maxMs) {
  const debut = Date.now();
  while (Date.now() - debut < maxMs) {
    if (await portLibre(port)) return true;
    await attendre(250);
  }
  return false;
}

const secondes = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

async function principal(etat) {
  const args = lireArguments(process.argv.slice(2));
  if (args.aide) {
    console.log(AIDE);
    return 0;
  }
  if (args.tous && args.ecrans) throw new Refus(`--tous et --ecrans s'excluent\n\n${AIDE}`);
  if (!args.tous && !args.ecrans) throw new Refus(`aucune sélection d'écrans\n\n${AIDE}`);

  // ── Sélection ──
  let selection = ECRANS;
  if (args.ecrans) {
    const ids = args.ecrans.split(',').map((s) => s.trim()).filter(Boolean);
    const inconnus = ids.filter((id) => !ECRANS.some((e) => e.id === id));
    if (inconnus.length) {
      throw new Refus(`écran inconnu : ${inconnus.join(', ')}\nécrans connus : ${ECRANS.map((e) => e.id).join(', ')}`);
    }
    selection = ECRANS.filter((e) => ids.includes(e.id));
  }
  if (selection.length === 0) {
    console.log('banc : aucun écran sélectionné, rien à mesurer.');
    return 0;
  }

  // ── Arbre construit ──
  const racineDemandee = resolve(args.racine ?? DEPOT_BANC);
  if (!existsSync(racineDemandee)) throw new Refus(`--racine : dossier introuvable (${racineDemandee})`);
  const racine = realpathSync(racineDemandee);
  const vite = join(racine, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(join(racine, 'package.json'))) throw new Refus(`--racine : pas de package.json dans ${racine}`);
  if (!existsSync(vite)) throw new Refus(`--racine : Vite introuvable (${vite}) — dépendances non installées ?`);

  // ── Compte ──
  // Pas de variable d'environnement : un environnement hérité ne doit jamais
  // importer un vrai compte.
  const compteDemande = resolve(args.compte ?? COMPTE_EXEMPLE);
  if (!existsSync(compteDemande)) throw new Refus('--compte : fichier introuvable');
  const compte = realpathSync(compteDemande);
  const dossiersExemple = [join(DEPOT_BANC, 'tests', 'fixtures'), join(racine, 'tests', 'fixtures')]
    .filter(existsSync)
    .map((d) => realpathSync(d));
  const nature = dossiersExemple.some((d) => sousDossier(compte, d)) ? 'exemple' : 'reel';
  etat.reel = nature === 'reel';
  const compteEmpreinte = sha256(readFileSync(compte));

  // ── Sortie ──
  const sortieDemandee = args.sortie ?? process.env.SWB_BANC_SORTIE ?? null;
  if (nature === 'reel') {
    const depot = depotGitContenant(sortieDemandee ?? tmpdir());
    if (depot) {
      throw new Refus(`compte réel : la sortie doit être hors de tout dépôt Git (dépôt trouvé : ${depot})`);
    }
  }
  const sortie = sortieDemandee ? resolve(sortieDemandee) : mkdtempSync(join(tmpdir(), 'swb-banc-'));
  mkdirSync(sortie, { recursive: true });
  etat.sortie = sortie;

  const manifeste = {
    banc: await etatGit(DEPOT_BANC, { chemins: ['tests/banc'] }),
    arbre: { racine, ...(await etatGit(racine)) },
    date: new Date().toISOString(),
    compte: { nature, sha256: compteEmpreinte },
    ecrans: selection.map((e) => e.id),
    etats: selection.flatMap((e) => e.etats.map((s) => `${e.id}/${s.id}`)),
    formats: {},
    resultats: [],
    nonExerces: [],
    port: null,
    durees: {},
    code: null,
  };
  etat.manifeste = manifeste;
  for (const e of ECRANS.filter((e) => !selection.includes(e))) {
    manifeste.nonExerces.push({ ecran: e.id, motif: 'écran non sélectionné' });
  }

  console.log(
    `banc d'affichage — ${selection.length} écran(s), ${manifeste.etats.length} état(s), ${ORDRE_FORMATS.length} formats ; ` +
      `compte ${nature === 'exemple' ? 'd’exemple' : 'réel'} (sha256 ${compteEmpreinte.slice(0, 12)}…)`,
  );
  console.log(`arbre : ${racine} @ ${manifeste.arbre.revision?.slice(0, 8) ?? '?'}${manifeste.arbre.propre === false ? ' (modifié)' : ''}`);

  // ── Construction ──
  const debutConstruction = Date.now();
  const construction = mkdtempSync(join(tmpdir(), 'swb-banc-construction-'));
  etat.construction = construction;
  const build = lancer([vite, 'build', '--outDir', construction], racine);
  if ((await build.fin) !== 0) {
    console.error(build.texte().split('\n').slice(-30).join('\n'));
    throw new Refus('construction en échec');
  }
  manifeste.durees.constructionMs = Date.now() - debutConstruction;
  console.log(`construction : ${secondes(manifeste.durees.constructionMs)}`);

  // ── Service ──
  // `--strictPort` empêche Vite de changer de port en silence ; il ne réserve
  // pas le port : un autre processus peut le prendre entre le tirage et le
  // démarrage, et le banc s'arrête alors en code 2.
  const port = await portAuHasard();
  const base = `http://127.0.0.1:${port}`;
  manifeste.port = { numero: port, libreApresArret: null };
  etat.port = port;
  const serveur = lancer([vite, 'preview', '--outDir', construction, '--port', String(port), '--strictPort', '--host', '127.0.0.1'], racine);
  etat.serveur = serveur;
  if (!(await attendreServeur(base, serveur, 30000))) {
    throw new Refus(`serveur : démarrage en échec sur le port ${port}`);
  }

  // ── Navigateur ──
  const debutImport = Date.now();
  try {
    etat.navigateur = await lancerNavigateur();
  } catch {
    throw new Refus('Chromium absent ou impossible à lancer (npx playwright install chromium)');
  }
  const navigateur = etat.navigateur;
  const garderTextes = nature === 'exemple';
  const stockages = {};
  for (const format of ORDRE_FORMATS) {
    const { contexte, messages } = await ouvrirContexte(navigateur, format, { garderTextes });
    try {
      const page = await contexte.newPage();
      try {
        stockages[format] = await importerCompte(page, base, compte);
      } catch (err) {
        if (err instanceof ErreurBanc) throw new Refus(`${FORMATS[format].libelle} : ${err.message}`);
        throw new Refus(`${FORMATS[format].libelle} : import du compte en échec${garderTextes ? ` (${String(err.message).split('\n')[0]})` : ''}`);
      }
      manifeste.formats[format] = { ...FORMATS[format], medias: await page.evaluate(medias), messagesImport: compter(messages, garderTextes) };
    } finally {
      await contexte.close();
    }
  }
  manifeste.durees.importMs = Date.now() - debutImport;

  // ── Mesures ──
  const debutMesures = Date.now();
  for (const format of ORDRE_FORMATS) {
    for (const ecran of selection) {
      for (const st of ecran.etats) {
        const prep = preparationPour(st, format);
        const nom = `${FORMATS[format].libelle.padEnd(11)} ${ecran.id} / ${st.libelle}`;
        if (!Array.isArray(prep)) {
          manifeste.nonExerces.push({ ecran: ecran.id, etat: st.id, format, motif: prep.nonExerce });
          console.log(`${nom.padEnd(64)} non exercé : ${prep.nonExerce}`);
          continue;
        }
        const capture = `${ecran.id}--${st.id}--${format}.png`;
        const resultat = { ecran: ecran.id, etat: st.id, format, statut: null, capture: null };
        manifeste.resultats.push(resultat);
        const { contexte, messages } = await ouvrirContexte(navigateur, format, { etatStockage: stockages[format], garderTextes });
        try {
          const page = await contexte.newPage();
          await page.goto(`${base}/${ecran.hash}`, { waitUntil: 'networkidle' });
          try {
            // L'état part de la page posée, compte chargé : un écran mesuré
            // sans compte passerait pour « rien ne déborde » sur un écran vide.
            await attendrePose(page);
            if (await compteAbsent(page)) throw new ErreurBanc('le compte importé n’est pas chargé sur cet écran');
            resultat.clicsRejoues = (await preparer(page, prep)).clicsRejoues;
            // Postcondition : l'état montre bien ce qu'il déclare (panneau,
            // modale ouverts). Un clic rejoué qui n'a rien ouvert s'arrête ici.
            await attendrePose(page);
            await verifierAtteint(page, atteintPour(st, format));
          } catch (err) {
            resultat.statut = 'non atteint';
            resultat.cause =
              err instanceof ErreurBanc ? err.message : `préparation en échec${garderTextes ? ` (${String(err.message).split('\n')[0]})` : ''}`;
            // La capture de l'écran où la préparation s'est arrêtée : de quoi
            // voir ce qui manquait, sans relancer.
            resultat.capture = `${ecran.id}--${st.id}--${format}--non-atteint.png`;
            await page.screenshot({ path: join(sortie, resultat.capture) }).catch(() => (resultat.capture = null));
            resultat.messages = compter(messages, garderTextes);
            console.log(`${nom.padEnd(64)} NON ATTEINT : ${resultat.cause}`);
            continue;
          }
          const { posee, mesure } = await mesurerEtCapturer(page, join(sortie, capture));
          resultat.statut = 'mesure';
          resultat.capture = capture;
          resultat.posee = posee;
          resultat.mesure = mesure;
          resultat.deborde = mesure.deborde;
          resultat.messages = compter(messages, garderTextes);
          const notes = [
            posee ? null : 'page encore en mouvement',
            resultat.clicsRejoues ? `${resultat.clicsRejoues} clic(s) rejoué(s) par element.click()` : null,
            messages.erreursPage + messages.erreursConsole > 0 ? `${messages.erreursPage + messages.erreursConsole} message(s) d'erreur de la page` : null,
          ].filter(Boolean);
          const suffixe = notes.length ? ` (${notes.join(' ; ')})` : '';
          if (!mesure.deborde) {
            console.log(`${nom.padEnd(64)} ok${suffixe}`);
          } else {
            const parPage = mesure.page.deborde ? `page ${mesure.page.scrollWidth} > ${mesure.largeur} ; ` : '';
            console.log(`${nom.padEnd(64)} DÉBORDE : ${parPage}${mesure.signalements.length} signalement(s)${suffixe}`);
            for (const s of mesure.signalements.slice(0, 6)) {
              console.log(
                `    ${s.regle === 'contenu' ? 'contenu  ' : 'géométrie'} ${s.element.chemin}` +
                  `\n              [${s.gauche} → ${s.droite}] scroll ${s.scrollWidth} / client ${s.clientWidth}` +
                  (s.element.classes ? ` · ${s.element.classes}` : '') +
                  (s.causes
                    ? `\n              cause : ${s.causes.length ? s.causes.map((c) => `<${c.balise}> ${c.classes.slice(0, 90)}`).join(' | ') : 'pseudo-élément ou texte'}`
                    : ''),
              );
            }
            if (mesure.signalements.length > 6) console.log(`    … ${mesure.signalements.length - 6} autre(s) dans le manifeste`);
          }
        } finally {
          await contexte.close();
        }
      }
    }
  }
  manifeste.durees.mesuresMs = Date.now() - debutMesures;

  // Un état demandé et non atteint : le banc n'a pas mesuré ce qu'on lui a
  // demandé, code 2 même si le reste déborde.
  const nonAtteints = manifeste.resultats.filter((r) => r.statut === 'non atteint').length;
  const debordements = manifeste.resultats.filter((r) => r.deborde).length;
  const mesures = manifeste.resultats.filter((r) => r.statut === 'mesure').length;
  console.log(
    `résultat : ${debordements} débordement(s) sur ${mesures} mesure(s)` +
      (nonAtteints ? ` ; ${nonAtteints} état(s) non atteint(s)` : '') +
      (manifeste.nonExerces.length ? ` ; ${manifeste.nonExerces.length} non exercé(s) (voir manifeste)` : ''),
  );
  if (nonAtteints) return 2;
  return debordements ? 1 : 0;
}

function compter(messages, garderTextes) {
  return {
    erreursPage: messages.erreursPage,
    erreursConsole: messages.erreursConsole,
    ...(garderTextes ? { textes: messages.textes.slice(0, 50) } : {}),
  };
}

const debut = Date.now();
const etat = { reel: true, sortie: null, manifeste: null, navigateur: null, serveur: null, port: null, construction: null };
let code;
try {
  code = await principal(etat);
} catch (err) {
  if (err instanceof Refus) console.error(`banc : ${err.message}`);
  // Une erreur imprévue peut citer la page : avec un compte réel, on n'en
  // écrit que la nature.
  else console.error(`banc : erreur imprévue${etat.reel ? '' : ` — ${err?.stack ?? err}`}`);
  code = 2;
} finally {
  // Le banc possède le navigateur et le serveur : il les ferme quoi qu'il
  // arrive, import raté compris, puis vérifie que le port est rendu.
  if (etat.navigateur) await etat.navigateur.close().catch(() => {});
  if (etat.serveur) {
    const arrete = await arreterServeur(etat.serveur);
    const libre = await attendrePortLibre(etat.port, 10000);
    if (etat.manifeste) etat.manifeste.port.libreApresArret = libre;
    console.log(`serveur arrêté : ${arrete ? 'oui' : 'NON'} ; port ${etat.port} libre : ${libre ? 'oui' : 'NON'}`);
    if (!arrete || !libre) code = 2;
  }
  if (etat.construction) rmSync(etat.construction, { recursive: true, force: true });
}
if (etat.manifeste && etat.sortie) {
  etat.manifeste.durees.totaleMs = Date.now() - debut;
  etat.manifeste.code = code;
  writeFileSync(join(etat.sortie, 'manifeste.json'), `${JSON.stringify(etat.manifeste, null, 2)}\n`);
  console.log(`sortie : ${etat.sortie}${sep}`);
}
console.log(`durée : ${secondes(Date.now() - debut)} ; code ${code}`);
process.exitCode = code;
