// `npm run bureau:preuve [dossier] [--exe <chemin>] [--conservation]` — lance
// l'application de bureau sur le BUILD en mode preuve (voir bureau/preuve.ts) :
// contrôles, `resultats.json`, puis l'app se ferme d'elle-même.
// Chantier application-bureau.
//
// Dossier par défaut : `preuve` dans `dist-bureau` (gitignoré). Le build
// (`dist/`) et `dist-bureau` doivent être à jour : `npm run bureau:local` les
// refait.
// `--exe` : rejoue la même preuve sur une app INSTALLÉE (lot 3), par exemple
// `%LOCALAPPDATA%\Programs\SW Blacksmith\SW Blacksmith.exe`.
// `--conservation` (lot 8) : DEUX lancements sur un dossier de données neuf —
// le premier importe `tests/fixtures/compte-miniature.json` et répond
// « Garder mes données » et choisit une session en cours, le second relit et
// la réécrit par Ctrl+S — puis compare ; code de sortie 1 si quelque chose
// s'est perdu.
// `--swex` (lot 9) : le dossier SW Exporter sur des fixtures — choix, export
// réécrit, rechargement, sous-dossier `live` ; prépa RTA et siège jamais
// touchés.
// `--session` (spec/shared/sauvegarde-session.md) : conservation refusée,
// « Sauvegarder » depuis les Paramètres, Ctrl K, Ctrl+S et la barre du haut,
// puis « Sauvegarder sous… » ; chaque fichier relu par `lireSession`.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { lancerElectronEtAttendre } from './lib/electron.mjs';

const args = process.argv.slice(2);
const iExe = args.indexOf('--exe');
const exe = iExe >= 0 ? args.splice(iExe, 2)[1] : undefined;
const iConservation = args.indexOf('--conservation');
const conservation = iConservation >= 0 && args.splice(iConservation, 1).length > 0;
const iSwex = args.indexOf('--swex');
const swex = iSwex >= 0 && args.splice(iSwex, 1).length > 0;
const iSession = args.indexOf('--session');
const session = iSession >= 0 && args.splice(iSession, 1).length > 0;

// Un module TypeScript de l'app, empaqueté par esbuild (comme tests/run.mjs)
// et chargé tel quel.
async function chargerModule(entree) {
  const { build } = await import('esbuild');
  const r = await build({ entryPoints: [entree], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}

if (session) {
  // La sauvegarde de session : compte importé, conservation REFUSÉE, puis
  // chaque accès à « Sauvegarder » et « Sauvegarder sous… ». Chaque fichier
  // est relu par le vrai `lireSession`.
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve-session');
  rmSync(dossier, { recursive: true, force: true }); // données neuves
  // Une session en cours retenue par une ouverture précédente : conservation
  // refusée, elle doit être oubliée au lancement, et son fichier jamais réécrit.
  const ancienne = resolve(dossier, 'ancienne-session.json');
  mkdirSync(resolve(dossier, 'donnees'), { recursive: true });
  writeFileSync(ancienne, 'ne pas réécrire');
  writeFileSync(resolve(dossier, 'donnees', 'session.json'), JSON.stringify({ chemin: ancienne }));
  const r = lancerElectronEtAttendre(
    { SWBLACKSMITH_PREUVE: dossier, SWBLACKSMITH_PREUVE_SESSION: '1', SWBLACKSMITH_PREUVE_COMPTE: resolve('tests/fixtures/compte-miniature.json') },
    90_000,
    exe
  );
  if (r.error) throw r.error;
  const res = JSON.parse(readFileSync(resolve(dossier, 'resultats-session.json'), 'utf8'));
  const { lireSession } = await chargerModule('src/lib/session.ts');
  const relire = (nom) => {
    const chemin = resolve(dossier, 'swblacksmith', 'sessions', nom);
    if (!existsSync(chemin)) return { ok: false, erreur: 'absent' };
    const texte = readFileSync(chemin, 'utf8');
    const lu = lireSession(texte);
    if (!lu.ok) return lu;
    const s = lu.session;
    return {
      ok: true,
      taille: texte.length,
      avertissements: lu.avertissements,
      cles: Object.keys(s.stockage),
      compte: s.compte ? { invocateur: s.compte.wizardName, monstres: s.compte.box.length, runes: s.compte.runes.length } : null,
      memoire: Object.keys(s.outils.memoire),
      optimizer: s.outils.optimizer ? Object.keys(s.outils.optimizer).length : null,
    };
  };
  // Les deux fichiers : le nom daté, écrit d'office par « Sauvegarder » des
  // Paramètres (aucune session en cours), puis `1-…`, choisi par
  // « Sauvegarder sous… ».
  const premier = res.apresReglages?.fichiers?.[0];
  const second = res.apresNouvelle?.fichiers?.find((f) => f !== premier);
  const dossierSwb = resolve(dossier, 'swblacksmith');
  const reglages = relire(premier ?? 'absent');
  const nouvelle = relire(second ?? 'absent');
  console.log(JSON.stringify({ res, reglages, nouvelle }, null, 2));
  const date = (etape, f) => res[etape]?.dates?.[f];
  const notifie = (etape, f) => res[etape]?.notification?.includes(`Session enregistrée · ${f}`);
  const infobulle = (etape, f) => res[etape]?.infobulle === `Sauvegarder dans ${f} (Ctrl+S)`;
  const verdicts = {
    'au lancement, la session retenue d’avant est oubliée': res.depart?.retenue === false && res.depart?.infobulle === 'Sauvegarder la session dans un fichier (Ctrl+S)',
    'et son fichier n’est jamais réécrit': readFileSync(ancienne, 'utf8') === 'ne pas réécrire',
    'import, conservation refusée': res.import === 'déposé' && res.refus === 'cliqué' && res.disque?.conservation === '0',
    'refusée : prépa RTA et siège absents du disque': res.disque?.prepaRta === null && res.disque?.siegeDefense === null,
    'ligne « Session » des Paramètres': typeof res.ligneSession === 'string' && res.ligneSession.startsWith('Session'),
    'Paramètres, avant : aucun dossier SW Blacksmith': res.avantReglages?.dossierRetenu === 'absent' && res.avantReglages?.ligneDossier?.includes('sous-dossier « sessions »'),
    'Paramètres : le dossier est demandé, puis la session s’écrit dans sessions/, sans autre question': res.clicReglages === 'cliqué' && /^swblacksmith-session-\d{4}-\d\d-\d\d-\d\dh\d\d\.json$/.test(premier ?? '') && JSON.stringify(res.apresReglages?.fichiers) === JSON.stringify([premier]),
    'le dossier est retenu (réglage, même conservation refusée), et affiché': res.apresReglages?.dossierRetenu === dossierSwb && res.apresReglages?.ligneDossier?.includes(dossierSwb),
    '« Session enregistrée · <nom> », et l’infobulle le nomme': notifie('apresReglages', premier) && infobulle('apresReglages', premier),
    'Ctrl K : réécrit la session en cours, sans autre fichier': res.clicPalette === 'cliqué' && res.apresPalette?.fichiers?.length === 1 && date('apresPalette', premier) > date('apresReglages', premier),
    'la palette propose « Sauvegarder sous… » dans l’app': res.actionsPalette?.some((t) => t.startsWith('Sauvegarder sous…')),
    'Ctrl+S : réécrit la session en cours, sans autre fichier': res.apresCtrlS?.fichiers?.length === 1 && date('apresCtrlS', premier) > date('apresPalette', premier),
    'Sauvegarder sous… : un second fichier dans sessions/, qui devient la session en cours': res.clicNouvelle === 'cliqué' && /^1-swblacksmith-session-/.test(second ?? '') && infobulle('apresNouvelle', second) && notifie('apresNouvelle', second) && date('apresNouvelle', premier) === date('apresCtrlS', premier),
    'Sauvegarder (barre) : réécrit la nouvelle, pas l’ancienne': res.clicBarre === 'cliqué' && res.apresBarre?.fichiers?.length === 2 && date('apresBarre', second) > date('apresNouvelle', second) && date('apresBarre', premier) === date('apresCtrlS', premier),
    'aucun fichier temporaire, aucun téléchargement': res.apresBarre?.fichiers?.every((f) => /^[^.].*\.json$/.test(f)) && res.apresBarre?.telechargements?.length === 0,
    'conservation refusée : la session en cours n’est pas retenue': res.apresBarre?.retenue === false,
    'Retirer : plus de dossier, la ligne redit à quoi il sert': res.clicRetirer === 'cliqué' && res.apresRetrait?.dossierRetenu === null && res.apresRetrait?.ligneDossier?.includes('sous-dossier « sessions »'),
    'après Retirer, Ctrl+S réécrit toujours la session en cours': res.apresRetraitCtrlS?.fichiers?.length === 2 && date('apresRetraitCtrlS', second) > date('apresBarre', second),
    'les deux fichiers, relus par lireSession, sans avertissement': reglages.ok && reglages.avertissements.length === 0 && nouvelle.ok && nouvelle.avertissements.length === 0,
    'le travail y est, bien qu’absent du disque': reglages.ok && reglages.cles.includes('swblacksmith-rta-v1') && reglages.cles.includes('swblacksmith-siege-defense-v1'),
    'le compte en mémoire y est': reglages.ok && reglages.compte?.invocateur === 'Testeur' && reglages.compte.monstres > 0,
    'la mémoire des écrans, sans les préférences d’interface': reglages.ok && reglages.memoire.includes('siege.checkTicks.defense') && !reglages.memoire.includes('sidebar.retractee'),
    'la photo de l’Optimizer (27 champs, exemplaire compris)': reglages.ok && reglages.optimizer === 27,
    'aucune erreur': !res.erreur,
  };
  for (const [quoi, bon] of Object.entries(verdicts)) console.log(`${bon ? 'ok' : 'KO'}  ${quoi}`);
  if (Object.values(verdicts).some((v) => !v)) process.exit(1);
} else if (swex) {
  // Lot 9 : un dossier SW Exporter de fixtures — deux invocateurs à la racine
  // (`Testeur-1.json`, `Autre-2.json`, tirés de compte-miniature.json) et un
  // sous-dossier `live` à ignorer.
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve-swex');
  rmSync(dossier, { recursive: true, force: true });
  const fixtures = resolve(dossier, 'swex-fixtures');
  mkdirSync(resolve(fixtures, 'live'), { recursive: true });
  const source = resolve('tests/fixtures/compte-miniature.json');
  const compte = JSON.parse(readFileSync(source, 'utf8'));
  writeFileSync(resolve(fixtures, 'Testeur-1.json'), JSON.stringify(compte));
  writeFileSync(resolve(fixtures, 'Autre-2.json'), JSON.stringify({ ...compte, wizard_info: { ...compte.wizard_info, wizard_id: 2, wizard_name: 'Autre' } }));
  const r = lancerElectronEtAttendre(
    { SWBLACKSMITH_PREUVE: dossier, SWBLACKSMITH_PREUVE_SWEX: fixtures, SWBLACKSMITH_PREUVE_COMPTE: source },
    90_000,
    exe
  );
  if (r.error) throw r.error;
  const res = JSON.parse(readFileSync(resolve(dossier, 'resultats-swex.json'), 'utf8'));
  console.log(JSON.stringify(res, null, 2));
  const verdicts = {
    'import manuel : prépa RTA et siège remplis': res.travailRempli === true,
    'deux invocateurs proposés, live/ ignoré': JSON.stringify(res.options) === JSON.stringify(['Choisir…', 'Autre', 'Testeur']),
    'carte du compte : menu des invocateurs, puis l’import': JSON.stringify(res.menuCompte) === JSON.stringify(['Autre', 'Testeur', 'Importer un fichier…']),
    'invocateur choisi au menu : son compte, annoncé': res.choisirInvocateur === 'cliqué' && res.apresChoix?.compte === 'Autre' && res.apresChoix?.notification === 'Compte de Autre mis à jour depuis SW Exporter',
    'les Réglages suivent le même choix': res.selecteurReglages === 'Autre-2.json',
    'export réécrit : relu, annoncé': res.apresReecriture?.compte === 'Autre-bis' && res.apresReecriture?.notification === 'Compte de Autre-bis mis à jour depuis SW Exporter',
    'rechargement : rien de réannoncé, compte gardé': res.apresRechargement?.notification === 'aucune' && res.apresRechargement?.compte === 'Autre-bis',
    'écriture dans live/ : ignorée': res.apresLive?.notification === 'aucune',
    'prépa RTA et siège INCHANGÉS à chaque étape':
      res.apresChoix?.travailInchange === true && res.apresReecriture?.travailInchange === true && res.apresRechargement?.travailInchange === true,
    'réglage retenu (dossier, invocateur, dernier lu)': res.reglageRetenu?.fichier === 'Autre-2.json' && typeof res.reglageRetenu?.dernierLu === 'number',
    'aucune erreur': !res.erreur,
  };
  for (const [quoi, bon] of Object.entries(verdicts)) console.log(`${bon ? 'ok' : 'KO'}  ${quoi}`);
  if (Object.values(verdicts).some((v) => !v)) process.exit(1);
} else if (!conservation) {
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve');
  const r = lancerElectronEtAttendre({ SWBLACKSMITH_PREUVE: dossier }, 120_000, exe);
  if (r.error) throw r.error;
  console.log(readFileSync(resolve(dossier, 'resultats.json'), 'utf8'));
} else {
  const dossier = resolve(args[0] ?? 'dist-bureau/preuve-conservation');
  rmSync(dossier, { recursive: true, force: true }); // données neuves
  const lire = (etape) => JSON.parse(readFileSync(resolve(dossier, `conservation-${etape}.json`), 'utf8'));
  for (const etape of ['ecrire', 'relire']) {
    const r = lancerElectronEtAttendre(
      {
        SWBLACKSMITH_PREUVE: dossier,
        SWBLACKSMITH_PREUVE_CONSERVATION: etape,
        SWBLACKSMITH_PREUVE_COMPTE: resolve('tests/fixtures/compte-miniature.json'),
      },
      60_000,
      exe
    );
    if (r.error) throw r.error;
  }
  const ecrit = lire('ecrire');
  const relu = lire('relire');
  console.log(JSON.stringify({ ecrit, relu }, null, 2));
  const verdicts = {
    'import puis « Garder »': ecrit.import === 'déposé' && ecrit.garder === 'cliqué',
    'compte affiché après import': ecrit.etat?.compteAffiche === true,
    'compte affiché après réouverture': relu.etat?.compteAffiche === true,
    'conservation activée, et retenue': ecrit.etat?.conservation === '1' && relu.etat?.conservation === '1',
    'mêmes clés de stockage, même taille': JSON.stringify(ecrit.etat?.cles) === JSON.stringify(relu.etat?.cles) && (ecrit.etat?.cles?.length ?? 0) > 1,
    'mêmes bases IndexedDB': JSON.stringify(ecrit.etat?.bases) === JSON.stringify(relu.etat?.bases) && (relu.etat?.bases?.length ?? 0) > 0,
    // La session en cours, choisie avant la fermeture, conservation activée.
    'session en cours choisie, et retenue': ecrit.sauvegarde === 'cliqué' && ecrit.session?.fichiers?.length === 1 && ecrit.session?.retenue === true,
    'session en cours revenue après réouverture': relu.sessionAuLancement?.infobulle === `Sauvegarder dans ${ecrit.session?.fichiers?.[0]} (Ctrl+S)`,
    'Ctrl+S la réécrit, sans rien demander': relu.session?.fichiers?.length === 1 && relu.session?.dates?.[ecrit.session?.fichiers?.[0]] > ecrit.session?.dates?.[ecrit.session?.fichiers?.[0]],
  };
  for (const [quoi, bon] of Object.entries(verdicts)) console.log(`${bon ? 'ok' : 'KO'}  ${quoi}`);
  if (Object.values(verdicts).some((v) => !v)) process.exit(1);
}
