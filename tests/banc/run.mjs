// Banc d'affichage : construit l'app, la sert, l'ouvre dans Chromium sans
// fenêtre aux deux formats, amène chaque écran dans chacun de ses états
// (ecrans.ts), mesure ce qui déborde (règle : tête de mesure.ts) et capture.
//
//   node tests/banc/run.mjs --tous
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
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import net from 'net';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve, sep, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { atteintPour, ECRANS, FORMATS, ORDRE_FORMATS, preparationPour, taillesPour } from './ecrans.ts';
import { ecransPourFichiers } from './selection.ts';
import {
  attendrePose,
  borne,
  compteAbsent,
  ErreurBanc,
  importerCompte,
  lancerNavigateur,
  medias,
  mesurerEtCapturer,
  ouvrirContexte,
  preparer,
  verifierAtteint,
  verifierOptimizer,
} from './session.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEPOT_BANC = resolve(ICI, '../..');
// La miniature, plus les cas d'affichage relevés sur un export réel.
const COMPTE_EXEMPLE = join(DEPOT_BANC, 'tests', 'fixtures', 'compte-banc.json');
// Bornes de temps : une étape qui ne rend pas la main arrête le banc en
// code 2, jamais en attente sans fin.
const DELAI_CONSTRUCTION_MS = 180000;
const DELAI_FERMETURE_NAVIGATEUR_MS = 15000;

const AIDE = `Banc d'affichage — rien ne déborde, aux deux formats.

  node tests/banc/run.mjs (--tous | --ecrans <id,…> | --depuis <réf> | --plage <a>..<b>) [options]

Sélection (une seule, obligatoire) :
  --tous               tous les écrans de tests/banc/ecrans.ts
  --ecrans <id,…>      les écrans nommés
  --depuis <réf>       les écrans que touchent les fichiers de « git diff --name-only <réf> HEAD »
                       (dans l'arbre --racine)
  --plage <a>..<b>     les écrans que touchent les fichiers de « git diff --name-only <a> <b> »,
                       quel que soit l'arbre construit ; deux bornes obligatoires

Options :
  --racine <dossier>   l'arbre à construire et mesurer (défaut : le dépôt qui contient
                       ce lanceur, quel que soit le dossier courant)
  --compte <fichier>   l'export importé (défaut : tests/fixtures/compte-banc.json) ;
                       hors de tests/fixtures/, il est traité comme un compte réel :
                       sortie obligatoirement hors de tout dépôt Git, aucun message
                       de la page sur la sortie standard
  --sortie <dossier>   où créer le sous-dossier neuf de l'exécution (banc-…), qui
                       reçoit captures et manifeste.json (défaut : SWB_BANC_SORTIE,
                       sinon le dossier temporaire du système) ; une destination
                       liée (lien, jonction) est refusée
  --aide               cette aide

Codes : 0 rien ne déborde · 1 débordement · 2 le banc n'a pas pu mesurer.`;

/** Refus du banc : code 2, message écrit par le banc. */
class Refus extends Error {}

function lireArguments(argv) {
  const args = { tous: false, ecrans: null, depuis: null, plage: null, racine: null, compte: null, sortie: null, aide: false };
  const AVEC_VALEUR = {
    '--ecrans': 'ecrans',
    '--depuis': 'depuis',
    '--plage': 'plage',
    '--racine': 'racine',
    '--compte': 'compte',
    '--sortie': 'sortie',
  };
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

/** Le chemin, ou le premier de ses ancêtres existants, qui est un lien (jonction comprise), ou null. */
function premierLien(chemin) {
  for (let d = resolve(chemin); ; d = dirname(d)) {
    try {
      if (lstatSync(d).isSymbolicLink()) return d;
    } catch {
      // n'existe pas encore : rien à suivre
    }
    if (dirname(d) === d) return null;
  }
}

/** Écrit un fichier en création exclusive : jamais par-dessus un fichier existant. */
function ecrireExclusif(chemin, donnees) {
  writeFileSync(chemin, donnees, { flag: 'wx' });
}

function git(racine, args) {
  return new Promise((ok) => {
    // `GIT_OPTIONAL_LOCKS=0` : `git status` ne rafraîchit pas l'index de
    // l'arbre mesuré, donc ne prend pas son verrou — le banc lit, il n'écrit
    // pas dans un dépôt où un autre outil travaille peut-être.
    const p = spawn('git', ['-C', racine, ...args], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    });
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
  const proc = { p, termine: false, fin: null, texte: () => Buffer.concat(sortie).toString('utf8') };
  proc.fin = new Promise((ok) => {
    p.on('error', () => ok(-1));
    p.on('exit', (code) => ok(code ?? -1));
  }).then((code) => {
    proc.termine = true;
    return code;
  });
  return proc;
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

/** Un délai de garde qui ne retient pas le processus (`unref`). */
const garde = (ms, valeur) => new Promise((ok) => setTimeout(ok, ms, valeur).unref());

async function attendreServeur(base, serveur, maxMs) {
  const debut = Date.now();
  let fini = false;
  serveur.fin.then(() => (fini = true));
  while (Date.now() - debut < maxMs) {
    if (fini) return false;
    try {
      const r = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return true;
    } catch {
      // pas encore à l'écoute, ou réponse trop lente
    }
    await attendre(200);
  }
  return false;
}

/**
 * Arrête un processus lancé par le banc et tout ce qu'il a lancé, puis
 * attend sa fin. Chaque attente est bornée : rend `false` si le processus
 * vit encore.
 */
async function arreterProcessus(proc) {
  if (proc.termine) return true;
  if (process.platform === 'win32') {
    const k = spawn('taskkill.exe', ['/PID', String(proc.p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await Promise.race([
      new Promise((ok) => {
        k.on('error', ok);
        k.on('exit', ok);
      }),
      garde(10000),
    ]);
  } else {
    proc.p.kill('SIGTERM');
  }
  return Promise.race([proc.fin.then(() => true), garde(10000, false)]);
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
  const modes = [args.tous && '--tous', args.ecrans && '--ecrans', args.depuis && '--depuis', args.plage && '--plage'].filter(Boolean);
  if (modes.length > 1) throw new Refus(`${modes.join(', ')} s'excluent : une seule sélection\n\n${AIDE}`);
  if (modes.length === 0) throw new Refus(`aucune sélection d'écrans\n\n${AIDE}`);

  // ── Arbre construit ──
  // Résolu avant la sélection : --depuis et --plage interrogent le Git de cet
  // arbre.
  const racineDemandee = resolve(args.racine ?? DEPOT_BANC);
  if (!existsSync(racineDemandee)) throw new Refus(`--racine : dossier introuvable (${racineDemandee})`);
  const racine = realpathSync(racineDemandee);

  // ── Sélection ──
  let selection = ECRANS;
  if (args.depuis || args.plage) {
    let bornes;
    if (args.depuis) bornes = [args.depuis, 'HEAD'];
    else {
      bornes = args.plage.split('..');
      if (bornes.length !== 2 || bornes.some((b) => b === '' || b.startsWith('.'))) {
        throw new Refus(`--plage attend <a>..<b> (deux bornes), reçu : ${args.plage}`);
      }
    }
    // Une borne qui commencerait par « - » serait lue comme une option de git.
    if (bornes.some((b) => b.startsWith('-'))) throw new Refus(`borne de révision refusée : ${bornes.join('..')}`);
    // `-z` et `core.quotepath` : chemins bruts, sans guillemets ni octal ;
    // `--no-renames` : un fichier renommé compte aux deux endroits.
    const brutDiff = await git(racine, ['-c', 'core.quotepath=false', 'diff', '--name-only', '-z', '--no-renames', ...bornes, '--']);
    if (brutDiff === null) throw new Refus(`git diff ${bornes.join(' ')} a échoué dans ${racine} (révision inconnue ?)`);
    const fichiers = brutDiff.toString('utf8').split('\0').filter(Boolean);
    const choix = ecransPourFichiers(fichiers);
    selection = choix.ecrans;
    console.log(`banc : ${fichiers.length} fichier(s) modifié(s) entre ${bornes.join(' et ')}, ${selection.length} écran(s) sélectionné(s)`);
    for (const d of choix.details) {
      if (d.regle === 'repli') console.log(`  repli : ${d.fichier} hors table → tous`);
      else console.log(`  ${d.fichier} → ${d.regle === 'tous' ? 'tous les écrans' : d.regle === 'aucun' ? 'aucun écran (HORS TABLE)' : d.ecrans.join(', ')}`);
    }
    if (choix.horsTable.length > 0) {
      console.log(`banc : ${choix.horsTable.length} fichier(s) hors de la table des écrans — ils ne sélectionnent rien ; à vérifier à la main, ou --ecrans / --tous.`);
    }
  } else if (args.ecrans) {
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

  // ── Construction ──
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
  // La destination reçoit un sous-dossier NEUF, créé par le banc en
  // exclusif (`mkdtemp`) : une exécution n'écrase jamais une autre, ni un
  // fichier qui l'attendait. Une destination liée (lien symbolique,
  // jonction), elle ou un de ses ancêtres, est refusée : la sortie d'un
  // compte réel ne doit pas pouvoir être redirigée dans un dépôt.
  const destination = resolve(args.sortie ?? process.env.SWB_BANC_SORTIE ?? tmpdir());
  const lien = premierLien(destination);
  if (lien) throw new Refus(`--sortie : destination liée (lien ou jonction : ${lien})`);
  mkdirSync(destination, { recursive: true });
  if (premierLien(destination)) throw new Refus('--sortie : destination liée (lien ou jonction)');
  if (nature === 'reel') {
    const depot = depotGitContenant(destination);
    if (depot) {
      throw new Refus(`compte réel : la sortie doit être hors de tout dépôt Git (dépôt trouvé : ${depot})`);
    }
  }
  const sortie = mkdtempSync(join(destination, 'banc-'));
  etat.sortie = sortie;

  const manifeste = {
    banc: await etatGit(DEPOT_BANC, { chemins: ['tests/banc'] }),
    arbre: { racine, ...(await etatGit(racine)) },
    date: new Date().toISOString(),
    compte: { nature, sha256: compteEmpreinte },
    ecrans: selection.map((e) => e.id),
    etats: selection.flatMap((e) => e.etats.map((s) => `${e.id}/${s.id}`)),
    formats: {},
    tailles: selection.map((e) => ({ ecran: e.id, tailles: taillesPour(e) })),
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
    `banc d'affichage — ${selection.length} écran(s), ${manifeste.etats.length} état(s), ${ORDRE_FORMATS.length} formats, tailles propres à chaque écran (voir manifeste) ; ` +
      `compte ${nature === 'exemple' ? 'd’exemple' : 'réel'} (sha256 ${compteEmpreinte.slice(0, 12)}…)`,
  );
  console.log(`arbre : ${racine} @ ${manifeste.arbre.revision?.slice(0, 8) ?? '?'}${manifeste.arbre.propre === false ? ' (modifié)' : ''}`);

  // ── Construction ──
  const debutConstruction = Date.now();
  const construction = mkdtempSync(join(tmpdir(), 'swb-banc-construction-'));
  etat.construction = construction;
  // La construction est un processus du banc comme le serveur : une
  // interruption l'arrête aussi (nettoyage).
  const build = lancer([vite, 'build', '--outDir', construction], racine);
  etat.processus.push(build);
  const codeConstruction = await Promise.race([build.fin, garde(DELAI_CONSTRUCTION_MS, 'délai')]);
  if (codeConstruction === 'délai') throw new Refus(`construction : délai de ${DELAI_CONSTRUCTION_MS / 1000} s dépassé`);
  if (codeConstruction !== 0) {
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
  etat.processus.push(serveur);
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
  for (const ecran of selection) {
    for (const taille of taillesPour(ecran)) {
      const format = taille.format;
      for (const st of ecran.etats) {
        const preparation = preparationPour(st, format);
        const nom = `${taille.libelle.padEnd(11)} ${ecran.id} / ${st.libelle}`;
        const motif = st.tailles && !st.tailles.includes(taille.id) ? 'état réservé à d’autres tailles' : !Array.isArray(preparation) ? preparation.nonExerce : null;
        if (motif) {
          manifeste.nonExerces.push({ ecran: ecran.id, etat: st.id, format, taille: taille.id, motif });
          console.log(`${nom.padEnd(64)} non exercé : ${motif}`);
          continue;
        }
        const prep = [...(taille.preparation ?? []), ...preparation];
        const capture = `${ecran.id}--${st.id}--${taille.id}.png`;
        const resultat = { ecran: ecran.id, etat: st.id, format, taille: taille.id, attendu: taille.optimizer, statut: null, capture: null };
        manifeste.resultats.push(resultat);
        const { contexte, messages } = await ouvrirContexte(navigateur, taille, { etatStockage: stockages[format], garderTextes });
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
            // Sans préparation, la page est déjà posée : pas de seconde attente
            // (l'accueil, toujours en mouvement, y perdrait 6 s par format).
            if (prep.length) await attendrePose(page);
            await verifierAtteint(page, atteintPour(st, format));
            resultat.medias = await page.evaluate(medias);
            // En tableau, la page choisit la configuration qui lui laisse sa
            // largeur : celle que la taille déclare pour ce cas.
            const enTableau = st.tableau ? taille.optimizer?.enTableau : null;
            const attenduOptimizer = enTableau
              ? { ...taille.optimizer, ...enTableau, set: enTableau.configuration === 'deux-piles' ? 'deplie' : undefined }
              : taille.optimizer;
            resultat.optimizer = await verifierOptimizer(page, attenduOptimizer, st.id === 'guidage-set');
          } catch (err) {
            resultat.statut = 'non atteint';
            resultat.cause =
              err instanceof ErreurBanc ? err.message : `préparation en échec${garderTextes ? ` (${String(err.message).split('\n')[0]})` : ''}`;
            // La capture de l'écran où la préparation s'est arrêtée : de quoi
            // voir ce qui manquait, sans relancer.
            resultat.capture = `${ecran.id}--${st.id}--${taille.id}--non-atteint.png`;
            const image = await page.screenshot({ timeout: 15000 }).catch(() => null);
            if (image) ecrireExclusif(join(sortie, resultat.capture), image);
            else resultat.capture = null;
            resultat.messages = compter(messages, garderTextes);
            console.log(`${nom.padEnd(64)} NON ATTEINT : ${resultat.cause}`);
            continue;
          }
          // Compte réel : descriptions structurelles seulement (ni `id` ni
          // classes), dans le manifeste comme sur la sortie standard.
          const { posee, mesure, image } = await mesurerEtCapturer(page, { detail: garderTextes });
          ecrireExclusif(join(sortie, capture), image);
          resultat.statut = 'mesure';
          resultat.capture = capture;
          resultat.posee = posee;
          resultat.mesure = mesure;
          resultat.deborde = mesure.deborde;
          resultat.messages = compter(messages, garderTextes);
          const notes = [
            posee ? null : 'page encore en mouvement',
            resultat.clicsRejoues.length ? `clic rejoué par element.click() : ${resultat.clicsRejoues.join(' ; ')}` : null,
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
                `    ${{ contenu: 'contenu  ', geometrie: 'géométrie', chevauchement: 'chevauchement', voisins: 'voisins  ' }[s.regle] ?? s.regle} ${s.element.chemin}` +
                  `\n              [${s.gauche} → ${s.droite}] scroll ${s.scrollWidth} / client ${s.clientWidth}` +
                  (s.element.classes ? ` · ${s.element.classes}` : '') +
                  (s.avec ? `\n              avec ${s.avec.chemin}${s.avec.classes ? ` · ${s.avec.classes}` : ''} ; ${s.aire} px²` : '') +
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

/**
 * Nettoyage : le banc possède le navigateur, la construction et le serveur ;
 * il les ferme quoi qu'il arrive (import raté, interruption), vérifie que le
 * port est rendu, puis écrit le manifeste. Idempotent : la fin normale et un
 * signal partagent la même promesse. Rend les causes d'échec, écrites par le
 * banc (jamais un message de la page) ; une seule suffit pour le code 2.
 */
function nettoyer(etat) {
  etat.nettoyage ??= (async () => {
    const echecs = [];
    if (etat.navigateur) {
      try {
        await borne(etat.navigateur.close(), DELAI_FERMETURE_NAVIGATEUR_MS, 'fermeture du navigateur');
      } catch (err) {
        echecs.push(err instanceof ErreurBanc ? err.message : 'fermeture du navigateur en échec');
      }
    }
    for (const proc of etat.processus) {
      if (!(await arreterProcessus(proc))) echecs.push(`un processus du banc (pid ${proc.p.pid}) n'a pas pu être arrêté`);
    }
    if (etat.serveur) {
      const libre = await attendrePortLibre(etat.port, 10000);
      if (etat.manifeste) etat.manifeste.port.libreApresArret = libre;
      console.log(`serveur arrêté : ${etat.serveur.termine ? 'oui' : 'NON'} ; port ${etat.port} libre : ${libre ? 'oui' : 'NON'}`);
      if (!libre) echecs.push(`port ${etat.port} encore occupé`);
    }
    if (etat.construction) {
      try {
        rmSync(etat.construction, { recursive: true, force: true });
      } catch {
        echecs.push('dossier de construction non supprimé');
      }
    }
    return echecs;
  })();
  return etat.nettoyage;
}

/** Fin commune : nettoyage, manifeste, code. Une erreur ici donne 2, jamais 1. */
async function terminer(etat, codeMesure) {
  let code = codeMesure;
  const echecs = await nettoyer(etat);
  for (const e of echecs) console.error(`banc : ${e}`);
  if (echecs.length) code = 2;
  if (etat.manifeste && etat.sortie) {
    etat.manifeste.durees.totaleMs = Date.now() - etat.debut;
    etat.manifeste.nettoyage = echecs;
    etat.manifeste.code = code;
    try {
      ecrireExclusif(join(etat.sortie, 'manifeste.json'), `${JSON.stringify(etat.manifeste, null, 2)}\n`);
      console.log(`sortie : ${etat.sortie}${sep}`);
    } catch {
      console.error('banc : écriture du manifeste en échec');
      code = 2;
    }
  }
  console.log(`durée : ${secondes(Date.now() - etat.debut)} ; code ${code}`);
  return code;
}

const etat = {
  debut: Date.now(),
  reel: true,
  sortie: null,
  manifeste: null,
  navigateur: null,
  serveur: null,
  processus: [],
  port: null,
  construction: null,
  nettoyage: null,
  fini: false,
};

// Une interruption (Ctrl+C, arrêt demandé) passe par le même nettoyage :
// sans lui, le serveur et Chromium resteraient en vie, le port pris.
// ⚠️ Sous Windows, un SIGTERM envoyé par `process.kill` termine le processus
// sans passer par ici ; Ctrl+C (SIGINT) et la fermeture de la console
// (SIGBREAK/SIGHUP) y passent.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
  process.on(signal, () => {
    if (etat.fini) return;
    etat.fini = true;
    console.error(`banc : interrompu (${signal})`);
    terminer(etat, 2).then(
      () => process.exit(2),
      () => process.exit(2),
    );
  });
}
// Filet : la boucle d'évènements se vide sans être passée par la fin
// normale (une promesse jamais tenue) — on nettoie quand même, en code 2.
process.on('beforeExit', () => {
  if (etat.fini) return;
  etat.fini = true;
  console.error('banc : arrêt inattendu (plus rien à exécuter)');
  terminer(etat, 2).then((c) => (process.exitCode = c));
});

let code;
try {
  code = await principal(etat);
} catch (err) {
  if (err instanceof Refus || err instanceof ErreurBanc) console.error(`banc : ${err.message}`);
  // Une erreur imprévue peut citer la page : avec un compte réel, on n'en
  // écrit que la nature.
  else console.error(`banc : erreur imprévue${etat.reel ? '' : ` — ${err?.stack ?? err}`}`);
  code = 2;
}
if (!etat.fini) {
  etat.fini = true;
  process.exitCode = await terminer(etat, code);
}
