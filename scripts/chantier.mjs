#!/usr/bin/env node
// Livraison vérifiée des notes privées d'un chantier.
//
// ⚠️ **Pourquoi cet outil existe.** `spec/outils/optimizer/` est gitignoré
// (protection compétitive) : ces fichiers n'ont donc ni historique, ni merge,
// ni conflit détecté. Tant que le report vers le dépôt documentaire restait une
// case à cocher en fin de chantier, il était une étape oubliée — faite par un
// agent qui a déjà « fini », sur des fichiers qu'aucun hook ne voit.
//
// Cadrage complet : `spec/chantiers/orchestration-parallele.md`, §4.
//
// ⚠️ **L'outil REFUSE plus souvent qu'il n'agit, et c'est sa valeur.** Trois
// refus protègent d'une perte irréversible :
//
//   1. Chantier non ouvert, ou dossier de notes ABSENT → refus. Une copie
//      manquante ne doit JAMAIS devenir une suppression de toutes les notes.
//      C'est la différence entre « rien à reporter » et « tout supprimer ».
//   2. Branche documentaire avancée indépendamment → refus, MÊME si son
//      répertoire est propre. D'où l'enregistrement de sa révision attendue.
//   3. Lien symbolique / junction dans les notes → refus. Les chemins sont
//      contrôlés, et l'empreinte couvre les CHEMINS RELATIFS autant que le
//      contenu : deux arbres au même contenu mais aux chemins différents ne
//      sont pas identiques.
//
// Deux verrous s'y ajoutent après l'incident du 2026-09-23 (lot O du chantier
// degats-et-aura) : `ouvrir` ne garde plus des notes locales inconnues de la
// base, et `livrer` refuse tant que la branche documentaire porte un contenu
// que les notes locales n'ont pas reçu. Voir « Base synchronisée » plus bas.
//
// ⚠️ **Le reçu vit HORS du contenu dont on calcule l'empreinte** (`recus/`, à
// côté de `spec/`), sinon l'écrire changerait la valeur qu'il enregistre.

import { execFileSync } from 'child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from 'fs';
import { createHash } from 'crypto';
import { dirname, join, relative, resolve, sep } from 'path';
import { verifier as verifierSpecLint } from './spec-lint.mjs';

const CHEMIN_NOTES = 'spec/outils/optimizer';
const DOSSIER_RECUS = 'recus';

/* --------------------------------------------------------------------------
 * Sorties
 * ----------------------------------------------------------------------- */

const ROUGE = '\x1b[31m';
const VERT = '\x1b[32m';
const JAUNE = '\x1b[33m';
const GRAS = '\x1b[1m';
const FIN = '\x1b[0m';

function refuser(titre, ...details) {
  console.error(`${ROUGE}REFUSÉ — ${titre}${FIN}`);
  for (const d of details) console.error(`  ${d}`);
  process.exit(1);
}

function dire(msg) {
  console.log(msg);
}

/* --------------------------------------------------------------------------
 * Git
 * ----------------------------------------------------------------------- */

function git(depot, ...args) {
  return execFileSync('git', ['-C', depot, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

// ⚠️ Sans `trim()` : dans `status --porcelain`, l'espace de tête est une
// colonne (« ` M` » = modifié sur disque). Le rogner décale tout le premier
// chemin d'un caractère.
function gitBrutOuNull(depot, ...args) {
  try {
    return execFileSync('git', ['-C', depot, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    return null;
  }
}

// Renvoie `null` quand git échoue, la sortie (souvent vide) quand il réussit.
// ⚠️ La distinction porte tout `fermer` : `merge-base --is-ancestor` réussit en
// ne disant RIEN, donc `''` signifie « oui » et `null` signifie « non ».
function gitOuNull(depot, ...args) {
  try {
    return git(depot, ...args);
  } catch {
    return null;
  }
}

// ⚠️ Le message de commit passe par l'ENTRÉE STANDARD (`-F -`), jamais par
// `-m` : ces messages citent des chemins et des empreintes, et un backtick dans
// une chaîne shell serait exécuté. Voir CLAUDE.md.
function gitAvecEntree(depot, args, texte) {
  return execFileSync('git', ['-C', depot, ...args], {
    encoding: 'utf8',
    input: texte,
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function estPropre(depot) {
  return git(depot, 'status', '--porcelain') === '';
}

/* --------------------------------------------------------------------------
 * Empreinte d'un arbre de fichiers
 *
 * ⚠️ Couvre les CHEMINS RELATIFS ET le contenu. Une empreinte du seul contenu
 * laisserait passer un fichier déplacé — or un fichier de notes déplacé est un
 * changement, pas un synonyme.
 * ----------------------------------------------------------------------- */

function listerFichiers(racine, prefixe = '') {
  const sortie = [];
  for (const entree of readdirSync(join(racine, prefixe), { withFileTypes: true })) {
    const rel = prefixe ? `${prefixe}/${entree.name}` : entree.name;
    const abs = join(racine, rel);
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) {
      refuser(
        'lien symbolique ou junction dans les notes',
        `Chemin : ${rel}`,
        "Les notes doivent être des fichiers réels : un lien partagerait le même",
        "exemplaire entre deux chantiers, et le dernier écrivain gagnerait en silence."
      );
    }
    if (st.isDirectory()) {
      if (entree.name === '.git') continue;
      sortie.push(...listerFichiers(racine, rel));
    } else if (st.isFile()) {
      sortie.push(rel);
    }
  }
  return sortie;
}

// `blobs` : l'identifiant Git de chaque fichier tel qu'il est sur disque,
// calculé dans la MÊME lecture que l'empreinte — aucune passe de plus.
function empreinteArbre(racine) {
  const fichiers = listerFichiers(racine).sort();
  const h = createHash('sha256');
  const blobs = {};
  for (const rel of fichiers) {
    const contenu = readFileSync(join(racine, rel));
    h.update(rel, 'utf8');
    h.update('\0');
    h.update(contenu);
    h.update('\0');
    blobs[rel] = idBlobBrut(contenu);
  }
  return { empreinte: h.digest('hex'), fichiers, blobs };
}

// Identifiant Git des octets BRUTS, sans conversion : celui que le dépôt
// documentaire archive, puisque son `.gitattributes` vaut `* -text`.
function idBlobBrut(contenu) {
  return createHash('sha1').update(`blob ${contenu.length}\0`).update(contenu).digest('hex');
}

/* --------------------------------------------------------------------------
 * Registre local — sous le répertoire Git COMMUN
 *
 * ⚠️ `git rev-parse --git-common-dir`, jamais un `.git` supposé être un dossier
 * dans chaque worktree : dans un worktree secondaire, `.git` est un FICHIER.
 * ----------------------------------------------------------------------- */

function racineCode() {
  return git(process.cwd(), 'rev-parse', '--show-toplevel');
}

function dossierEtat(depotCode) {
  const commun = resolve(depotCode, git(depotCode, 'rev-parse', '--git-common-dir'));
  const etat = join(commun, 'forge', 'etat');
  mkdirSync(etat, { recursive: true });
  return etat;
}

function cheminConfig(depotCode) {
  return join(dossierEtat(depotCode), 'config.json');
}

function lireConfig(depotCode) {
  const c = cheminConfig(depotCode);
  return existsSync(c) ? JSON.parse(readFileSync(c, 'utf8')) : null;
}

function ecrireConfig(depotCode, config) {
  writeFileSync(cheminConfig(depotCode), JSON.stringify(config, null, 2) + '\n');
}

function cheminChantier(depotCode, nom) {
  const d = join(dossierEtat(depotCode), 'chantiers');
  mkdirSync(d, { recursive: true });
  return join(d, `${nom}.json`);
}

function lireChantier(depotCode, nom) {
  const c = cheminChantier(depotCode, nom);
  if (!existsSync(c)) {
    refuser(
      `chantier « ${nom} » inconnu`,
      "Aucune trace d'un `ouvrir` pour ce chantier dans le registre local.",
      '',
      "⚠️ C'est un refus DÉLIBÉRÉ, pas une lacune : sans base enregistrée, on ne",
      'peut pas distinguer « les notes ne sont pas encore copiées ici » de « toutes',
      'les notes ont été supprimées volontairement ». Le premier cas reporté',
      "aveuglément effacerait le journal entier.",
      '',
      `Ouvrir d'abord : node scripts/chantier.mjs ouvrir --chantier ${nom}`
    );
  }
  return JSON.parse(readFileSync(c, 'utf8'));
}

function ecrireChantier(depotCode, nom, donnees) {
  writeFileSync(cheminChantier(depotCode, nom), JSON.stringify(donnees, null, 2) + '\n');
}

/* --------------------------------------------------------------------------
 * Copie miroir (ajouts, modifications ET suppressions)
 * ----------------------------------------------------------------------- */

// `arret` : nom d'un point d'arrêt de test, déclenché à mi-copie (voir
// `pointArret`) — la coupure la plus réaliste est celle qui laisse un état
// mélangé, une partie des fichiers copiés et l'autre non.
function copierMiroir(source, cible, { arret } = {}) {
  mkdirSync(cible, { recursive: true });
  const voulus = new Set(listerFichiers(source));
  const presents = existsSync(cible) ? listerFichiers(cible) : [];

  for (const rel of presents) {
    if (!voulus.has(rel)) rmSync(join(cible, rel));
  }
  let copies = 0;
  for (const rel of voulus) {
    const dest = join(cible, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(source, rel), dest);
    if (arret && ++copies === Math.ceil(voulus.size / 2)) pointArret(arret);
  }
  // Dossiers devenus vides après suppression.
  const purger = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) purger(join(d, e.name));
    }
    if (readdirSync(d).length === 0 && d !== cible) rmSync(d, { recursive: true });
  };
  purger(cible);
}

// ⚠️ Points d'arrêt RÉSERVÉS AUX TESTS : une coupure provoquée dans le VRAI
// chemin de code. Un registre bricolé à la main ne prouverait pas qu'on sait
// revenir de l'état réel — seulement de l'état qu'on a soi-même écrit.
function pointArret(nom) {
  if (process.env.CHANTIER_ARRET_TEST === nom) {
    dire(`${JAUNE}[test] arrêt volontaire : ${nom}${FIN}`);
    process.exit(70);
  }
}

const court = (rev) => (rev ? String(rev).slice(0, 7) : '(aucune)');

function apercu(liste, n = 8) {
  if (!liste.length) return '';
  return liste.slice(0, n).join(', ') + (liste.length > n ? ` … (+${liste.length - n})` : '');
}

function estAncetre(depot, a, b) {
  return gitOuNull(depot, 'merge-base', '--is-ancestor', a, b) !== null;
}

/* --------------------------------------------------------------------------
 * Base synchronisée — ce que les notes locales ont REÇU
 *
 * ⚠️ **Incident du 2026-09-23** (cadrage degats-et-aura, A.5) : `ouvrir` a
 * gardé des notes locales en retard sur la base, avec un simple
 * avertissement ; le premier `livrer` les a recopiées en miroir, suppressions
 * comprises, puis `integrer` a fusionné. 529 fichiers et le contenu relique de
 * 7 notes ont quitté le `main` documentaire sans qu'aucun refus ne se
 * déclenche. Le miroir n'était pas fautif : il reportait fidèlement des notes
 * qui n'avaient jamais REÇU ce qu'il effaçait.
 *
 * D'où la base synchronisée, tenue dans le registre : l'état documentaire
 * avec lequel les notes locales ont été synchronisées en dernier — révision,
 * chemins, identifiants de blob tels que le dépôt documentaire les archive.
 * `ouvrir`, `livrer` (après son commit) et `rafraichir` (après sa copie) la
 * posent ; `livrer` refuse de reporter tant que la branche documentaire porte
 * autre chose qu'elle.
 * ----------------------------------------------------------------------- */

// ⚠️ Sous Windows, deux chemins qui ne diffèrent que par la casse désignent le
// MÊME fichier sur disque (comme dans `controlerIdentite`). Les
// correspondances de chemins se font sur cette clé ; les identifiants de
// contenu, eux, ne sont jamais normalisés.
function cleChemin(chemin) {
  return process.platform === 'win32' ? chemin.toLowerCase() : chemin;
}

// Deux chemins Git distincts qui donnent la même clé sont une COLLISION : un
// disque Windows n'en garderait qu'un, en silence.
function indexerParCle(fichiers) {
  const parCle = new Map();
  const groupes = new Map();
  for (const chemin of Object.keys(fichiers)) {
    const k = cleChemin(chemin);
    if (parCle.has(k)) groupes.set(k, [...(groupes.get(k) ?? [parCle.get(k)]), chemin]);
    else parCle.set(k, chemin);
  }
  return { parCle, collisions: [...groupes.values()] };
}

function refuserCollisions(fichiers, ou) {
  const { collisions } = indexerParCle(fichiers);
  if (!collisions.length) return;
  refuser(
    `collision de casse dans ${ou}`,
    ...collisions.map((g) => `  · ${g.join('  ↔  ')}`),
    '',
    'Ces chemins Git sont distincts, mais Windows n’en garderait qu’un sur disque :',
    'la copie perdrait l’autre sans rien dire. Renommer l’un des deux dans le dépôt',
    'documentaire (suppression puis ajout explicites), puis relancer.'
  );
}

// Compare `a` à la référence `b` (chemin → identifiant), chemin par chemin sur
// la clé : identiques, modifiés, ajoutés (dans `a` seulement), retirés (dans
// `b` seulement), et renommages de pure casse parmi les identiques.
function comparer(a, b) {
  const ia = indexerParCle(a).parCle;
  const ib = indexerParCle(b).parCle;
  const r = { identiques: [], modifies: [], ajoutes: [], retires: [], casse: [] };
  for (const [k, ca] of ia) {
    const cb = ib.get(k);
    if (cb === undefined) r.ajoutes.push(ca);
    else if (a[ca] !== b[cb]) r.modifies.push(ca);
    else {
      r.identiques.push(ca);
      if (ca !== cb) r.casse.push(`${cb} → ${ca}`);
    }
  }
  for (const [k, cb] of ib) if (!ia.has(k)) r.retires.push(cb);
  r.egal = !r.modifies.length && !r.ajoutes.length && !r.retires.length;
  return r;
}

// Le sous-arbre des notes d'une révision : chemin → identifiant de blob.
function inventaireGit(depot, rev) {
  const sortie = gitOuNull(depot, 'ls-tree', '-r', '-z', '--full-name', rev, '--', CHEMIN_NOTES);
  if (sortie === null) refuser(`révision documentaire illisible : ${rev}`, `Dépôt : ${depot}`);
  const fichiers = {};
  const modes = {};
  for (const entree of sortie.split('\0').filter(Boolean)) {
    const tab = entree.indexOf('\t');
    const [mode, type, id] = entree.slice(0, tab).split(' ');
    if (type !== 'blob') continue;
    const rel = entree.slice(tab + 1).slice(CHEMIN_NOTES.length + 1);
    fichiers[rel] = id;
    modes[rel] = mode;
  }
  return { fichiers, modes };
}

// Identifiants que le dépôt documentaire ARCHIVERAIT pour ces fichiers locaux,
// selon ses propres règles de fins de ligne (`hash-object` sans `-w` : rien
// n'est écrit). Sous `* -text`, ce sont les identifiants des octets bruts.
function blobsSelonDepot(depot, racine, chemins) {
  if (!chemins.length) return {};
  const sortie = gitAvecEntree(
    depot,
    ['hash-object', '--stdin-paths'],
    chemins.map((rel) => join(racine, rel)).join('\n') + '\n'
  );
  const ids = sortie.split('\n');
  return Object.fromEntries(chemins.map((rel, i) => [rel, ids[i].trim()]));
}

// Identifiant d'arbre Git calculé sans rien écrire, au format de
// `git write-tree` (entrées triées par octets, un répertoire comparé comme
// « nom/ »). Il retrouve en une seule passe la révision dont le sous-arbre des
// notes est EXACTEMENT celui des notes locales.
function arbreGitDe(fichiers, modes = {}) {
  const racine = new Map();
  for (const [chemin, id] of Object.entries(fichiers)) {
    const parts = chemin.split('/');
    let noeud = racine;
    for (const p of parts.slice(0, -1)) {
      if (!(noeud.get(p) instanceof Map)) noeud.set(p, new Map());
      noeud = noeud.get(p);
    }
    noeud.set(parts[parts.length - 1], { id, mode: modes[chemin] ?? '100644' });
  }
  const hacher = (noeud) => {
    const entrees = [...noeud].map(([nom, v]) =>
      v instanceof Map
        ? { tri: Buffer.from(`${nom}/`), tete: `40000 ${nom}`, id: hacher(v) }
        : { tri: Buffer.from(nom), tete: `${v.mode} ${nom}`, id: v.id }
    );
    entrees.sort((x, y) => Buffer.compare(x.tri, y.tri));
    const corps = Buffer.concat(entrees.flatMap((e) => [Buffer.from(`${e.tete}\0`), Buffer.from(e.id, 'hex')]));
    return createHash('sha1').update(`tree ${corps.length}\0`).update(corps).digest('hex');
  };
  return hacher(racine);
}

// `--full-history` : sans lui, la simplification d'historique écarte les
// branches latérales dont une fusion a gardé l'autre côté — des états réels
// des notes qu'on ne retrouverait jamais.
function revisionsNotes(depot, revs) {
  return (gitOuNull(depot, 'rev-list', '--full-history', ...revs, '--', CHEMIN_NOTES) || '')
    .split('\n')
    .filter(Boolean);
}

// Identifiant du sous-arbre des notes de chaque révision, en UN processus.
function arbresDesRevisions(depot, revs) {
  const m = new Map();
  if (!revs.length) return m;
  const sortie = gitAvecEntree(
    depot,
    ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
    revs.map((r) => `${r}:${CHEMIN_NOTES}`).join('\n') + '\n'
  );
  const lignes = sortie.split('\n');
  revs.forEach((r, i) => {
    const [id, type] = (lignes[i] ?? '').trim().split(' ');
    if (type === 'tree') m.set(r, id);
  });
  return m;
}

// Révisions parmi `revs` (et leurs ancêtres) dont le sous-arbre des notes est
// celui de `ids`. Deux variantes du calcul local : les chemins tels quels, et
// réalignés sur la casse de la base (un disque Windows peut garder une autre
// casse que Git pour le même fichier).
function revisionsIdentiques(depot, revs, ids, invBase) {
  const { parCle } = indexerParCle(invBase.fichiers);
  const realignes = {};
  for (const [c, id] of Object.entries(ids)) realignes[parCle.get(cleChemin(c)) ?? c] = id;
  const cherches = new Set([arbreGitDe(ids, invBase.modes), arbreGitDe(realignes, invBase.modes)]);
  const candidats = revisionsNotes(depot, revs);
  const arbres = arbresDesRevisions(depot, candidats);
  return candidats.filter((r) => cherches.has(arbres.get(r)));
}

// Toutes les versions (clé de chemin + blob) qu'a connues l'historique des
// notes jusqu'à `rev` : distingue une note EN RETARD d'une note INÉDITE.
function versionsConnues(depot, rev) {
  const sortie =
    gitOuNull(depot, '-c', 'core.quotePath=false', 'log', '-m', '--full-history', '--root', '--format=',
      '--raw', '--no-abbrev', '--no-renames', rev, '--', CHEMIN_NOTES) || '';
  const connues = new Set();
  for (const ligne of sortie.split('\n')) {
    if (!ligne.startsWith(':')) continue;
    const tab = ligne.indexOf('\t');
    const [, , avant, apres] = ligne.slice(1, tab).split(' ');
    const rel = ligne.slice(tab + 1).slice(CHEMIN_NOTES.length + 1);
    for (const id of [avant, apres]) if (!/^0+$/.test(id)) connues.add(`${cleChemin(rel)}\0${id}`);
  }
  return connues;
}

// Registre ouvert avant le lot O : pas de base enregistrée. Elle se
// reconstruit depuis le plus récent du dernier reçu (qui prouve l'égalité des
// notes locales avec l'état livré) et du dernier rafraîchissement.
function baseReconstruite(chantier) {
  const { worktreeDoc } = chantier;
  const candidats = [];
  const recu = chantier.dernierRecu;
  const raf = chantier.dernierRafraichissement;
  if (recu?.commitDoc) {
    candidats.push({ revision: recu.commitDoc, origine: 'migration (reçu)', empreinte: recu.empreinteNotes, le: recu.livreLe });
  }
  if (raf?.apres) {
    candidats.push({ revision: raf.apres, origine: 'migration (rafraîchissement)', empreinte: raf.empreinteApres, le: raf.le });
  }
  if (!candidats.length) return null;
  let choisi = candidats[0];
  if (candidats.length === 2) {
    const [a, b] = candidats;
    const aAvantB = estAncetre(worktreeDoc, a.revision, b.revision);
    const bAvantA = estAncetre(worktreeDoc, b.revision, a.revision);
    if (aAvantB && !bAvantA) choisi = b;
    else if (bAvantA && !aAvantB) choisi = a;
    else choisi = String(a.le) >= String(b.le) ? a : b;
  }
  const { fichiers } = inventaireGit(worktreeDoc, choisi.revision);
  return { revision: choisi.revision, fichiers, empreinte: choisi.empreinte, origine: choisi.origine, enregistree: false };
}

function baseDe(chantier) {
  return chantier.base ? { ...chantier.base, enregistree: true } : baseReconstruite(chantier);
}

function decrireBase(base) {
  if (!base) return 'absente';
  const ou = base.revision ? ` @ ${court(base.revision)}` : base.adopteeSur ? ` (adoptée sur ${court(base.adopteeSur)})` : '';
  return `${base.enregistree ? 'enregistrée' : 'reconstruite, non enregistrée'} — ${base.origine}${ou}, ` +
    `${Object.keys(base.fichiers).length} fichiers`;
}

function nouvelleBase(worktreeDoc, revision, empreinte, origine) {
  return {
    revision,
    fichiers: inventaireGit(worktreeDoc, revision).fichiers,
    empreinte,
    origine,
    le: new Date().toISOString(),
  };
}

// La garde de `livrer`, en lecture seule : deux égalités.
//  - le sous-arbre Git des notes à la TÊTE de la branche documentaire est la
//    base (le sous-arbre, pas le commit : la tête est souvent un reçu) ;
//  - l'inventaire PHYSIQUE du worktree documentaire, fichiers ignorés compris,
//    est cette tête. `git status` ne voit pas un fichier exclu par
//    `.git/info/exclude`, alors que `copierMiroir` l'effacerait : on liste le
//    disque, on exige un worktree propre et aucun fichier masqué à `status`
//    (`skip-worktree`, `assume-unchanged`). Les contenus suivis sont alors
//    ceux de la tête, sans hacher le disque une fois de plus.
function evaluerGarde(chantier, base) {
  const { worktreeDoc } = chantier;
  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  const tete = inventaireGit(worktreeDoc, 'HEAD');
  const collisions = indexerParCle(tete.fichiers).collisions;
  const arbre = base ? comparer(tete.fichiers, base.fichiers) : null;
  const vide = (liste) => Object.fromEntries(liste.map((c) => [c, '']));
  const physiques = existsSync(notesDoc) ? listerFichiers(notesDoc) : [];
  const chemins = comparer(vide(physiques), vide(Object.keys(tete.fichiers)));
  const masques = (gitOuNull(worktreeDoc, 'ls-files', '-v', '-z', '--', CHEMIN_NOTES) || '')
    .split('\0')
    .filter((l) => l && l[0] !== 'H')
    .map((l) => l.slice(2));
  const propre = estPropre(worktreeDoc);
  return {
    tete,
    collisions,
    arbre,
    arbreOk: Boolean(arbre?.egal),
    horsBranche: chemins.ajoutes,
    manquants: chemins.retires,
    masques,
    propre,
    physiqueOk: !chemins.ajoutes.length && !chemins.retires.length && !masques.length && propre,
  };
}

// Une coupure laisse chaque chemin dans son état de départ ou dans son état
// attendu. Tout autre valeur (absence comprise) : quelqu'un a écrit entre-temps.
function cheminsInexpliques(actuel, initial, attendu) {
  const indexer = (m) => new Map(Object.entries(m).map(([c, id]) => [cleChemin(c), { c, id }]));
  const [ia, ii, it] = [actuel, initial, attendu].map(indexer);
  const r = [];
  for (const k of new Set([...ia.keys(), ...ii.keys(), ...it.keys()])) {
    const v = ia.get(k)?.id ?? null;
    if (v !== (ii.get(k)?.id ?? null) && v !== (it.get(k)?.id ?? null)) {
      r.push(ia.get(k)?.c ?? ii.get(k)?.c ?? it.get(k)?.c);
    }
  }
  return r;
}

function dossierSauvegardes(depotCode, nom) {
  const commun = resolve(depotCode, git(depotCode, 'rev-parse', '--git-common-dir'));
  return join(commun, 'forge', 'sauvegardes', nom);
}

/* --------------------------------------------------------------------------
 * Contrôles partagés
 * ----------------------------------------------------------------------- */

function notesDuCode(depotCode) {
  const chemin = join(depotCode, ...CHEMIN_NOTES.split('/'));
  if (!existsSync(chemin)) {
    refuser(
      'le dossier de notes est ABSENT',
      `Attendu : ${chemin}`,
      '',
      "⚠️ Un dossier absent n'est PAS un dossier vidé. Reporter ici supprimerait",
      "toutes les notes du dépôt documentaire au motif qu'on n'en trouve aucune",
      'localement — une perte irréversible pour une simple copie manquante.',
      '',
      "Restaurer la copie (`ouvrir`) avant de livrer."
    );
  }
  if (lstatSync(chemin).isSymbolicLink()) {
    refuser(
      'le dossier de notes est un LIEN',
      `Chemin : ${chemin}`,
      'Un lien partage le même exemplaire entre chantiers : le dernier écrivain',
      "gagnerait sans que rien ne le signale. Une copie réelle est exigée."
    );
  }
  return chemin;
}

/**
 * L'appelant est-il BIEN le chantier qu'il prétend être ?
 *
 * ⚠️ **Sans ce contrôle, le registre étant COMMUN à tous les worktrees, un
 * `livrer --chantier a` lancé depuis le worktree de B reporte les notes de B
 * dans la branche documentaire de A.** Aucun garde-fou existant ne l'attrape :
 * le worktree documentaire est le bon, il est propre, il est à la révision
 * attendue — tout est cohérent, sauf la provenance des notes.
 */
function controlerIdentite(depotCode, chantier) {
  const normaliser = (x) => {
    const p = resolve(x).replace(/[\\/]+$/, '');
    // Windows : la casse d'un chemin ne le distingue pas.
    return process.platform === 'win32' ? p.toLowerCase() : p;
  };

  if (chantier.depotCode && normaliser(depotCode) !== normaliser(chantier.depotCode)) {
    refuser(
      `ce chantier n’appartient pas à ce worktree`,
      `Chantier « ${chantier.nom} » enregistré pour : ${chantier.depotCode}`,
      `Commande lancée depuis          : ${depotCode}`,
      '',
      '⚠️ Le registre est COMMUN à tous les worktrees : rien n’empêche de nommer',
      "le chantier d'un autre. Reporter d'ici enverrait LES NOTES D'ICI dans la",
      "branche documentaire de là-bas — tout serait cohérent sauf la provenance.",
      '',
      'Se placer dans le bon worktree, ou ouvrir un chantier pour celui-ci.'
    );
  }

  const branche = git(depotCode, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (chantier.brancheCode && branche !== chantier.brancheCode) {
    refuser(
      'la branche de code a changé depuis l’ouverture du chantier',
      `Enregistrée : ${chantier.brancheCode}`,
      `Actuelle    : ${branche}`,
      '',
      'Un reçu lie des notes à un commit de code précis. Livrer depuis une autre',
      "branche associerait le journal a un travail qui n'est pas le sien.",
      '',
      'Revenir sur la branche du chantier, ou en ouvrir un nouveau.'
    );
  }
}

function controlerWorktreeDoc(depotCode, chantier, optionsAppel = {}) {
  const { worktreeDoc, brancheDoc, revisionDocAttendue } = chantier;
  if (!existsSync(worktreeDoc)) {
    refuser(
      'le worktree documentaire est absent',
      `Attendu : ${worktreeDoc}`,
      'Le chantier est enregistré mais son espace documentaire a disparu.'
    );
  }
  const branche = git(worktreeDoc, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (branche !== brancheDoc) {
    refuser(
      'le worktree documentaire est sur une autre branche',
      `Attendu : ${brancheDoc}`,
      `Trouvé  : ${branche}`
    );
  }
  if (!estPropre(worktreeDoc)) {
    refuser(
      'le worktree documentaire porte des modifications non commitées',
      `Chemin : ${worktreeDoc}`,
      "Elles seraient écrasées par le report. Les trancher d'abord."
    );
  }
  const tete = git(worktreeDoc, 'rev-parse', 'HEAD');
  if (revisionDocAttendue && tete !== revisionDocAttendue) {
    // Une livraison interrompue ne passe plus par ici : son journal est repris
    // AVANT ce contrôle (`reprendre`), qui avance la révision attendue.
    const descend = estAncetre(worktreeDoc, revisionDocAttendue, tete);
    const touches = descend
      ? (gitOuNull(worktreeDoc, 'diff', '--name-only', `${revisionDocAttendue}..${tete}`) || '')
          .split('\n')
          .filter(Boolean)
      : [];

    // ⚠️ Reprise après un CONFLIT de `rafraichir` résolu à la main (voir la
    // marche à suivre affichée par le refus « CONFLIT » : `git merge`,
    // résoudre, committer dans le worktree documentaire). Ce commit de fusion
    // est alors le nouveau HEAD, différent de `revisionDocAttendue` par
    // construction — sans ce cas, la reprise reste bloquée pour toujours.
    // On ne l'adopte que si TROIS conditions tiennent ensemble ; un commit
    // ordinaire venu d'ailleurs ne les remplit jamais toutes :
    //  - `tete` est un commit de fusion à EXACTEMENT deux parents ;
    //  - son premier parent est EXACTEMENT `revisionDocAttendue` (pas un
    //    ancêtre : une fusion qui saute par-dessus une révision non vue
    //    reste refusée) ;
    //  - son second parent est la source du rafraîchissement (`main`) ou un
    //    ancêtre de cette source — jamais une fusion depuis autre chose.
    // Seul `rafraichir` passe `optionsAppel.source` : `livrer` garde son
    // refus strict, une fusion à la main n'est pas son sujet.
    // ⚠️ Rien n'est écrit ici (lot O) : la révision attendue et la base
    // n'avancent qu'après la copie vers le code. Une coupure avant la fin de
    // la copie laisse donc la fusion reconnaissable au lancement suivant.
    const parents = (gitOuNull(worktreeDoc, 'rev-list', '--parents', '-n', '1', tete) || '')
      .trim()
      .split(/\s+/);
    const [, premierParent, secondParent, troisiemeParent] = parents;
    const fusionSurAttendue = premierParent === revisionDocAttendue && Boolean(secondParent) && !troisiemeParent;
    if (optionsAppel.source && fusionSurAttendue) {
      if (estAncetre(worktreeDoc, secondParent, optionsAppel.source)) {
        dire(
          `${JAUNE}Fusion résolue à la main reprise${FIN} : ${brancheDoc} porte un commit de` +
            ` fusion de ${optionsAppel.source} (${court(revisionDocAttendue)} → ${court(tete)}).`
        );
        return {
          tete,
          repriseFusionManuelle: true,
          baseAvant: premierParent,
          sourceFusionnee: secondParent,
        };
      }
    }

    refuser(
      'la branche documentaire a avancé indépendamment',
      `Attendue : ${revisionDocAttendue}`,
      `Trouvée  : ${tete}`,
      '',
      "⚠️ Le répertoire est propre, et c'est justement le piège : un commit fait",
      "de l'autre côté ne laisse aucune trace dans le répertoire de travail. Sans",
      'cette vérification, le report écraserait ce travail en silence.',
      '',
      chantier.journal || chantier.livraisonEnCours
        ? "Une opération interrompue est enregistrée, mais l'avance ne lui correspond pas."
        : "Aucune opération interrompue enregistrée : cette avance vient d'ailleurs.",
      touches.length ? `Fichiers touchés : ${apercu(touches, 5)}` : '',
      fusionSurAttendue && !optionsAppel.source
        ? 'Fusion à la main détectée sur la révision attendue : `rafraichir` la reprend.'
        : ''
    );
  }
  return { tete, repriseFusionManuelle: false };
}

/* --------------------------------------------------------------------------
 * Reprise vérifiée d'une opération interrompue
 *
 * Chaque opération qui écrit des notes (copie vers le code à `ouvrir` et à
 * `rafraichir`, miroir et commits de `livrer`) enregistre AVANT d'écrire un
 * journal : d'où elle part, et l'état EXACT des notes qu'elle doit produire
 * (identifiants de blob par chemin). Une coupure laisse donc un état que l'on
 * reconnaît fichier par fichier — chaque chemin dans son état de départ ou
 * dans son état attendu, rien d'autre. Tout autre écart est un refus :
 * quelqu'un a écrit entre-temps.
 *
 * ⚠️ Faiblesse corrigée (lot O) : l'ancien marqueur `livraisonEnCours` ne
 * retenait que la révision de départ, et le registre avançait après le commit
 * des notes sans lui (`depuis` ≠ révision attendue) : une coupure après le
 * commit du reçu échouait à la reprise. Une livraison qui ne changeait que le
 * reçu n'avait, elle, aucun marqueur. Le journal garde `depuis` fixe et
 * vérifie le CONTENU atteint, pas seulement la forme de l'avance.
 * ----------------------------------------------------------------------- */

function reprendre(depotCode, chantier, { simulation = false } = {}) {
  const { journal } = chantier;
  if (!journal) return null;
  if (journal.operation === 'livrer') return reprendreLivraison(depotCode, chantier, simulation);
  return reprendreCopieVersCode(depotCode, chantier, simulation);
}

// `quoi` : « livraison interrompue », « rafraîchissement interrompu »…
function refuserReprise(quoi, echecs) {
  refuser(
    `${quoi} : l'état trouvé ne s'explique pas par la coupure`,
    ...echecs.map((e) => `  · ${e}`),
    '',
    "Rien n'a été touché. Un état intermédiaire n'est repris que si chaque",
    "chemin vaut son état de départ ou son état attendu : sinon, quelqu'un a écrit",
    'entre-temps, et reprendre écraserait ce travail. Examiner ces chemins à la main.'
  );
}

// `ouvrir` et `rafraichir` : copie du worktree documentaire vers les notes
// locales, suivie du registre.
function reprendreCopieVersCode(depotCode, chantier, simulation) {
  const { journal, worktreeDoc } = chantier;
  const libelle = journal.operation === 'ouvrir' ? 'ouverture' : 'rafraîchissement';
  const notesCode = join(depotCode, ...CHEMIN_NOTES.split('/'));
  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  const echecs = [];
  const tete = git(worktreeDoc, 'rev-parse', 'HEAD');
  if (tete !== journal.cible) echecs.push(`branche documentaire à ${court(tete)}, attendue ${court(journal.cible)}`);
  if (!estPropre(worktreeDoc)) echecs.push('le worktree documentaire, source de la copie, est modifié');
  const source = existsSync(notesDoc) ? empreinteArbre(notesDoc).empreinte : null;
  if (source !== journal.etatAttendu.empreinte) echecs.push('les notes documentaires, source de la copie, ont changé');
  const locales = existsSync(notesCode) ? empreinteArbre(notesCode) : { empreinte: null, blobs: {} };
  const inexpliques = cheminsInexpliques(locales.blobs, journal.etatInitial, journal.etatAttendu.fichiers);
  if (inexpliques.length) {
    echecs.push(`${inexpliques.length} note(s) locale(s) ni à leur état de départ ni à l'état attendu : ${apercu(inexpliques, 5)}`);
  }
  if (echecs.length) refuserReprise(libelle === 'ouverture' ? 'ouverture interrompue' : 'rafraîchissement interrompu', echecs);
  if (simulation) return { operation: journal.operation, aReprendre: true };

  if (locales.empreinte !== journal.etatAttendu.empreinte) {
    copierMiroir(notesDoc, notesCode);
    const apres = empreinteArbre(notesCode).empreinte;
    if (apres !== journal.etatAttendu.empreinte) {
      refuser('la copie reprise ne rend pas un contenu identique', 'Le journal est conservé : relancer après examen.');
    }
  }
  terminerCopieVersCode(chantier);
  ecrireChantier(depotCode, chantier.nom, chantier);
  const quoi = libelle === 'ouverture' ? "d'une ouverture interrompue" : "d'un rafraîchissement interrompu";
  dire(`${JAUNE}Reprise ${quoi}${FIN} : notes locales amenées à l'état de ${court(journal.cible)}.`);
  return { operation: journal.operation, repris: true };
}

// Après une copie vers le code complète et contrôlée : c'est ICI, et nulle
// part avant, que la base et la révision attendue avancent.
function terminerCopieVersCode(chantier) {
  const { journal, worktreeDoc } = chantier;
  chantier.revisionDocAttendue = journal.cible;
  chantier.base = nouvelleBase(worktreeDoc, journal.cible, journal.etatAttendu.empreinte, journal.operation);
  if (journal.rafraichissement) {
    chantier.dernierRafraichissement = { ...journal.rafraichissement, le: new Date().toISOString() };
  }
  delete chantier.journal;
}

// `livrer` : miroir vers le worktree documentaire, commit des notes, commit du
// reçu. Deux formes de coupure :
//  - AVANT tout commit (pendant le miroir, avant le commit) : le worktree est
//    sale ; chaque écart doit être une copie de l'état attendu. On remet alors
//    le worktree à sa tête — la livraison relancée refait le miroir depuis les
//    notes locales ACTUELLES ;
//  - APRÈS un commit (notes ou reçu) : la tête a avancé depuis `depuis` par des
//    commits simples qui ne touchent que les notes et CE reçu, et les notes
//    reportées sont exactement l'état attendu. La tête est adoptée, et la base
//    avec elle.
function reprendreLivraison(depotCode, chantier, simulation) {
  const { journal, worktreeDoc, nom } = chantier;
  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  const recu = `${DOSSIER_RECUS}/${nom}.json`;
  const attendu = journal.etatAttendu;
  const tete = git(worktreeDoc, 'rev-parse', 'HEAD');
  const echecs = [];
  const idBrut = (rel) => idBlobBrut(readFileSync(join(notesDoc, rel)));
  const attenduParCle = new Map(Object.entries(attendu.fichiers).map(([c, id]) => [cleChemin(c), id]));
  const ecartExplique = (rel) =>
    existsSync(join(notesDoc, rel))
      ? attenduParCle.get(cleChemin(rel)) === idBrut(rel)
      : !attenduParCle.has(cleChemin(rel));
  // Chemins suivis modifiés (index ou disque), sans détection de renommage.
  const sales = (gitBrutOuNull(worktreeDoc, 'status', '--porcelain=v1', '-z', '--no-renames', '-uno') || '')
    .split('\0')
    .filter(Boolean)
    .map((e) => e.slice(3));
  const horsNotes = sales.filter((c) => !c.startsWith(`${CHEMIN_NOTES}/`) && c !== recu);
  if (horsNotes.length) echecs.push(`modifications hors des notes et du reçu : ${apercu(horsNotes, 5)}`);

  if (tete === journal.depuis) {
    const suivis = sales.filter((c) => c.startsWith(`${CHEMIN_NOTES}/`)).map((c) => c.slice(CHEMIN_NOTES.length + 1));
    const cheminsTete = Object.keys(inventaireGit(worktreeDoc, 'HEAD').fichiers);
    const vide = (l) => Object.fromEntries(l.map((c) => [c, '']));
    const extras = existsSync(notesDoc) ? comparer(vide(listerFichiers(notesDoc)), vide(cheminsTete)).ajoutes : [];
    const inexpliques = [...suivis, ...extras].filter((rel) => !ecartExplique(rel));
    if (inexpliques.length) {
      echecs.push(`${inexpliques.length} fichier(s) du worktree documentaire ne sont pas des copies de l'état attendu : ${apercu(inexpliques, 5)}`);
    }
    if (echecs.length) refuserReprise('livraison interrompue', echecs);
    if (simulation) return { operation: 'livrer', aReprendre: true };
    gitOuNull(worktreeDoc, 'reset', '-q', 'HEAD', '--', CHEMIN_NOTES);
    gitOuNull(worktreeDoc, 'reset', '-q', 'HEAD', '--', recu);
    if (Object.keys(inventaireGit(worktreeDoc, 'HEAD').fichiers).length) git(worktreeDoc, 'checkout', '--', CHEMIN_NOTES);
    for (const rel of extras) rmSync(join(notesDoc, rel));
    if (sales.includes(recu)) gitOuNull(worktreeDoc, 'checkout', '--', recu);
    const recuNonSuivi = join(worktreeDoc, ...recu.split('/'));
    if (!gitOuNull(worktreeDoc, 'ls-files', '--', recu) && existsSync(recuNonSuivi)) rmSync(recuNonSuivi);
    if (!estPropre(worktreeDoc)) refuserReprise('livraison interrompue', ['le worktree documentaire reste modifié après remise en état']);
    dire(`${JAUNE}Reprise d'une livraison interrompue avant tout commit${FIN} : copie partielle retirée,` +
      ` ${court(tete)} inchangé.`);
  } else {
    if (!estAncetre(worktreeDoc, journal.depuis, tete)) echecs.push(`${court(tete)} ne descend pas de ${court(journal.depuis)}`);
    else {
      const fusions = (gitOuNull(worktreeDoc, 'rev-list', '--merges', `${journal.depuis}..${tete}`) || '').trim();
      if (fusions) echecs.push("l'avance contient une fusion : ce n'est pas une livraison");
      const touches = (gitOuNull(worktreeDoc, 'diff', '--name-only', journal.depuis, tete) || '').split('\n').filter(Boolean);
      const etrangers = touches.filter((f) => !f.startsWith(`${CHEMIN_NOTES}/`) && f !== recu);
      if (etrangers.length) echecs.push(`l'avance touche d'autres fichiers que les notes et ce reçu : ${apercu(etrangers, 5)}`);
      const attendue = chantier.revisionDocAttendue;
      if (attendue !== journal.depuis && !(estAncetre(worktreeDoc, journal.depuis, attendue) && estAncetre(worktreeDoc, attendue, tete))) {
        echecs.push(`la révision attendue ${court(attendue)} n'est pas sur l'avance ${court(journal.depuis)} → ${court(tete)}`);
      }
    }
    const suivisNotes = sales.filter((c) => c !== recu);
    if (suivisNotes.length) echecs.push(`notes modifiées après le commit : ${apercu(suivisNotes, 5)}`);
    const reportees = existsSync(notesDoc) ? empreinteArbre(notesDoc).empreinte : null;
    if (reportees !== attendu.empreinte) echecs.push("les notes reportées ne sont pas l'état attendu par le journal");
    if (echecs.length) refuserReprise('livraison interrompue', echecs);
    if (simulation) return { operation: 'livrer', aReprendre: true };
    if (sales.includes(recu)) gitOuNull(worktreeDoc, 'checkout', '--', recu);
    const commitNotes = git(worktreeDoc, 'log', '-1', '--format=%H', tete, '--', CHEMIN_NOTES);
    chantier.revisionDocAttendue = tete;
    chantier.base = nouvelleBase(worktreeDoc, commitNotes, attendu.empreinte, 'livrer');
    dire(`${JAUNE}Reprise d'une livraison interrompue${FIN} : la branche documentaire porte déjà` +
      ` l'état attendu (${court(journal.depuis)} → ${court(tete)}).`);
  }
  delete chantier.journal;
  delete chantier.livraisonEnCours;
  ecrireChantier(depotCode, chantier.nom, chantier);
  return { operation: 'livrer', repris: true };
}

/* --------------------------------------------------------------------------
 * ouvrir
 * ----------------------------------------------------------------------- */

function ouvrir(nom, options) {
  const depotCode = racineCode();
  let config = lireConfig(depotCode);

  const depotDoc = options['depot-doc'] ? resolve(options['depot-doc']) : config?.depotDocumentaire;
  if (!depotDoc) {
    refuser(
      'dépôt documentaire inconnu',
      'Le premier appel doit le désigner :',
      '  node scripts/chantier.mjs ouvrir --chantier <nom> --depot-doc <chemin>'
    );
  }
  if (!existsSync(join(depotDoc, '.git'))) {
    refuser('le dépôt documentaire n’est pas un dépôt git', `Chemin : ${depotDoc}`);
  }

  if (existsSync(cheminChantier(depotCode, nom))) {
    // Une ouverture coupée pendant sa copie a déjà écrit son registre et son
    // journal : la relancer la TERMINE, sans rien rouvrir.
    const existant = lireChantier(depotCode, nom);
    if (existant.journal?.operation === 'ouvrir') {
      controlerIdentite(depotCode, existant);
      reprendre(depotCode, existant);
      dire(`${VERT}Chantier « ${nom} » ouvert.${FIN}`);
      return;
    }
    refuser(
      `le chantier « ${nom} » est déjà ouvert`,
      "Le rouvrir écraserait sa base documentaire enregistrée, donc la référence",
      'qui permet de détecter une branche avancée indépendamment.'
    );
  }

  const brancheDoc = `chantier/${nom}`;
  const worktreeDoc = options['worktree-doc']
    ? resolve(options['worktree-doc'])
    : join(dirname(depotDoc), `${nom_depot(depotDoc)}-chantiers`, nom);

  // `--base` est respectée telle quelle ; résolue ici pour qu'une révision
  // inconnue soit un refus nommé, pas une exception de `worktree add`.
  const base = gitOuNull(depotDoc, 'rev-parse', '--verify', '--quiet', `${options.base || 'HEAD'}^{commit}`);
  if (!base) refuser(`révision de base inconnue : ${options.base}`, `Dépôt documentaire : ${depotDoc}`);

  // ⚠️ Tout le diagnostic AVANT le moindre effet : un refus ne laisse ni
  // branche, ni worktree, ni registre.
  const invBase = inventaireGit(depotDoc, base);
  refuserCollisions(invBase.fichiers, `la base ${court(base)}`);
  const notesCode = join(depotCode, ...CHEMIN_NOTES.split('/'));
  if (existsSync(notesCode)) notesDuCode(depotCode); // refuse un dossier qui serait un lien
  const verdict = classerNotesLocales(depotDoc, base, invBase, notesCode, options);

  // Sauvegarde des notes qui vont être remplacées, avant toute création :
  // `.git/forge/sauvegardes/<chantier>/<horodatage>/`, sous le répertoire Git
  // COMMUN, hors des notes, jamais livrée. `fermer` ne la supprime pas.
  if (verdict.cas === 'retard' || verdict.cas === 'casse') {
    const sauvegarde = join(dossierSauvegardes(depotCode, nom), new Date().toISOString().replace(/[:.]/g, '-'));
    copierMiroir(notesCode, sauvegarde);
    if (empreinteArbre(sauvegarde).empreinte !== verdict.locales.empreinte) {
      refuser('la sauvegarde des notes locales ne rend pas un contenu identique', `Sauvegarde : ${sauvegarde}`,
        "Rien n'a été remplacé ni créé.");
    }
    verdict.sauvegarde = sauvegarde;
  }

  if (!config || config.depotDocumentaire !== depotDoc) {
    config = { depotDocumentaire: depotDoc, cheminNotes: CHEMIN_NOTES };
    ecrireConfig(depotCode, config);
  }
  mkdirSync(dirname(worktreeDoc), { recursive: true });
  git(depotDoc, 'worktree', 'add', '-b', brancheDoc, worktreeDoc, base);
  git(depotDoc, 'worktree', 'lock', worktreeDoc);

  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  mkdirSync(notesDoc, { recursive: true });

  const chantier = {
    nom,
    depotCode,
    brancheCode: git(depotCode, 'rev-parse', '--abbrev-ref', 'HEAD'),
    depotDoc,
    brancheDoc,
    worktreeDoc,
    revisionDocBase: base,
    revisionDocAttendue: base,
    ouvertLe: new Date().toISOString(),
  };

  if (verdict.cas === 'identique') {
    chantier.base = nouvelleBase(worktreeDoc, base, verdict.locales.empreinte, 'ouvrir');
    dire(`Notes locales déjà identiques à la base ${court(base)}.`);
  } else if (verdict.cas === 'adoption') {
    // ⚠️ La base est ici l'état LOCAL, pas un état documentaire : le premier
    // `livrer` refusera tant que la branche porte ce que ces notes n'ont pas.
    chantier.base = {
      revision: null,
      adopteeSur: base,
      fichiers: blobsSelonDepot(worktreeDoc, notesCode, verdict.locales.fichiers),
      empreinte: verdict.locales.empreinte,
      origine: 'adoption',
      le: new Date().toISOString(),
    };
    dire(
      `${JAUNE}Notes locales ADOPTÉES${FIN} (--adopter) : conservées telles quelles et enregistrées` +
        ` comme base. \`livrer\` refusera tant que ${brancheDoc} porte un contenu qu'elles n'ont pas reçu.`
    );
  } else {
    // Copie de la base vers le code : absentes, en retard, ou casse seule.
    // Journal écrit AVANT la copie : une coupure se reprend en relançant.
    const source = empreinteArbre(notesDoc);
    chantier.journal = {
      operation: 'ouvrir',
      cible: base,
      etatInitial: verdict.locales.blobs,
      etatAttendu: { empreinte: source.empreinte, fichiers: source.blobs },
      ...(verdict.sauvegarde ? { sauvegarde: verdict.sauvegarde } : {}),
      le: new Date().toISOString(),
    };
    ecrireChantier(depotCode, nom, chantier);
    copierMiroir(notesDoc, notesCode, { arret: 'pendant-copie-ouvrir' });
    if (empreinteArbre(notesCode).empreinte !== source.empreinte) {
      refuser('la copie ne rend pas un contenu identique', 'Le journal est conservé : relancer `ouvrir` le reprend.');
    }
    terminerCopieVersCode(chantier);
    if (verdict.cas === 'absent') {
      dire(`Notes copiées depuis la révision ${court(base)}.`);
    } else {
      const { cmp } = verdict;
      dire(
        verdict.cas === 'retard'
          ? `${JAUNE}Notes locales EN RETARD${FIN} : identiques à ${court(verdict.revision)}, ancêtre de la base` +
              ` ${court(base)}. Remplacées par la base.`
          : `${JAUNE}Notes locales identiques à la base à la casse près${FIN} : noms réalignés sur la base.`
      );
      dire(`  ajoutés   : ${cmp.retires.length}${cmp.retires.length ? ' — ' + apercu(cmp.retires, 20) : ''}`);
      dire(`  modifiés  : ${cmp.modifies.length}${cmp.modifies.length ? ' — ' + apercu(cmp.modifies, 20) : ''}`);
      dire(`  supprimés : ${cmp.ajoutes.length}${cmp.ajoutes.length ? ' — ' + apercu(cmp.ajoutes, 20) : ''}`);
      if (cmp.casse.length) dire(`  casse     : ${apercu(cmp.casse, 20)}`);
      dire(`  sauvegarde des notes remplacées : ${verdict.sauvegarde}`);
    }
  }
  ecrireChantier(depotCode, nom, chantier);

  dire(`${VERT}Chantier « ${nom} » ouvert.${FIN}`);
  dire(`  branche documentaire : ${brancheDoc}`);
  dire(`  worktree documentaire : ${worktreeDoc} ${GRAS}(verrouillé)${FIN}`);
}

// ⚠️ Le cœur du verrou d'`ouvrir`. L'arbre ENTIER des notes locales est
// comparé à la base (`--base` si elle est donnée, sinon HEAD), octets tels que
// le dépôt documentaire les archive :
//  - absent → copie de la base ;
//  - identique à la base → rien à faire (casse seule : réalignée) ;
//  - identique à une révision ANCÊTRE de la base → en retard, remplacé par la
//    base après sauvegarde ;
//  - tout autre cas → refus, sauf `--adopter`. Un état égal à une révision qui
//    n'est PAS ancêtre de la base (une `--base` plus ancienne que les notes)
//    est refusé aussi : `ouvrir` ne fait jamais de retour arrière.
function classerNotesLocales(depotDoc, base, invBase, notesCode, options) {
  if (!existsSync(notesCode)) return { cas: 'absent', locales: { empreinte: null, fichiers: [], blobs: {} } };
  const locales = empreinteArbre(notesCode);
  const ids = blobsSelonDepot(depotDoc, notesCode, locales.fichiers);
  const cmp = comparer(ids, invBase.fichiers);
  if (cmp.egal) return { cas: cmp.casse.length ? 'casse' : 'identique', locales, cmp };

  let retard = null;
  if (locales.fichiers.length) {
    retard = revisionsIdentiques(depotDoc, [base], ids, invBase).find((r) => estAncetre(depotDoc, r, base)) ?? null;
  }
  if (options.adopter === true) return { cas: 'adoption', locales };
  if (retard) return { cas: 'retard', revision: retard, locales, cmp };

  // Refus : diagnostic par fichier, puis marche à suivre.
  const connues = versionsConnues(depotDoc, base);
  const anterieures = [];
  const inedits = [];
  for (const c of [...cmp.modifies, ...cmp.ajoutes]) {
    (connues.has(`${cleChemin(c)}\0${ids[c]}`) ? anterieures : inedits).push(c);
  }
  const ailleurs = locales.fichiers.length
    ? revisionsIdentiques(depotDoc, ['--all'], ids, invBase).find((r) => !estAncetre(depotDoc, r, base))
    : null;
  refuser(
    locales.fichiers.length
      ? 'les notes locales ne sont ni la base ni une version antérieure de la base'
      : 'le dossier de notes existe mais est VIDE',
    `Base         : ${court(base)} (${Object.keys(invBase.fichiers).length} fichiers)`,
    `Notes locales : ${notesCode} (${locales.fichiers.length} fichiers)`,
    '',
    'Diagnostic par fichier :',
    `  ${cmp.identiques.length} identiques à ${court(base)}`,
    `  ${anterieures.length} versions antérieures, connues de l'historique de la base${anterieures.length ? ' : ' + apercu(anterieures) : ''}`,
    `  ${inedits.length} inédits, contenu inconnu de cet historique${inedits.length ? ' : ' + apercu(inedits) : ''}`,
    `  ${cmp.retires.length} absents localement${cmp.retires.length ? ' : ' + apercu(cmp.retires) : ''}`,
    ...(ailleurs
      ? ['', `⚠️ Ces notes sont exactement celles de ${court(ailleurs)}, qui n'est PAS un ancêtre de la base`,
        `${court(base)} : --base plus ancienne que les notes ? \`ouvrir\` ne fait jamais de retour arrière ;`,
        'un retour arrière voulu se fait après l’ouverture, par une livraison.']
      : []),
    '',
    "⚠️ Garder ces notes puis livrer effacerait de la branche documentaire ce qu'elles",
    "n'ont pas reçu : c'est l'incident du 2026-09-23 (529 fichiers retirés du main documentaire).",
    "Rien n'a été créé : ni branche, ni worktree, ni registre.",
    '',
    'Marche à suivre :',
    "  · notes non livrées d'un autre chantier : les livrer depuis celui-ci, puis relancer ;",
    `  · notes à écarter : déplacer ${notesCode} hors du dépôt, puis relancer (copie de la base) ;`,
    '  · les garder en connaissance de cause : relancer avec --adopter. Le premier `livrer`',
    '    refusera tant que la branche porte un contenu que ces notes n’ont pas reçu.'
  );
}

function nom_depot(chemin) {
  const parts = resolve(chemin).split(sep).filter(Boolean);
  return parts[parts.length - 1];
}

/* --------------------------------------------------------------------------
 * Lint des notes privées avant livraison
 *
 * ⚠️ Même périmètre et même config que `pre-commit` (`spec/spec-lint.json`,
 * B.9) : le lint reste la SEULE source de vérité sur ce qui compte, `livrer`
 * ne fait que lui soumettre les notes et refuser si elles ne passent pas.
 * ----------------------------------------------------------------------- */

function verifierLintNotes(depotCode, notesCode, { simulation = false } = {}) {
  const cheminConfig = join(depotCode, 'spec', 'spec-lint.json');
  if (!existsSync(cheminConfig)) return [];
  const config = JSON.parse(readFileSync(cheminConfig, 'utf8'));
  const { erreurs } = verifierSpecLint(depotCode, config);
  const prefixe = `${relative(depotCode, notesCode).replace(/\\/g, '/')}/`;
  const enJeu = erreurs.filter((e) => e.fichier.startsWith(prefixe));
  if (enJeu.length > 0 && !simulation) {
    refuser(
      `spec-lint refuse ${enJeu.length} point(s) sur les notes du chantier`,
      ...enJeu.map((e) => `${e.fichier}${e.ligne ? `:${e.ligne}` : ''} [${e.regle}] ${e.message}`),
      '',
      'Corriger les notes, puis relancer `livrer` :',
      '  node scripts/spec-lint.mjs'
    );
  }
  return enJeu;
}

/* --------------------------------------------------------------------------
 * livrer
 * ----------------------------------------------------------------------- */

// Ordre (lot O) : (a) reprise vérifiée de toute opération interrompue ;
// (b) garde — la branche documentaire et son worktree sont la base
// synchronisée ; (c) miroir, qui ne copie alors QUE le delta base → notes
// locales ; (d) enregistrement de la nouvelle base après le commit.
//
// `--simulation` : même chemin jusqu'à la garde, sans RIEN écrire (ni
// registre, ni fichier, ni index), puis le verdict et le delta du miroir.
// `--adopter` : l'utilisateur déclare avoir fusionné à la main ce que la
// branche porte ; la garde sur l'arbre est levée, pas celle sur le worktree.
function livrer(nom, options = {}) {
  const simulation = options.simulation === true;
  const adopter = options.adopter === true;
  // `git status` rafraîchit l'index par défaut : une écriture, même anodine.
  if (simulation) process.env.GIT_OPTIONAL_LOCKS = '0';
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);
  controlerIdentite(depotCode, chantier);
  const constats = [];

  if (!estPropre(depotCode)) {
    if (simulation) constats.push('le dépôt de code porte des modifications non commitées (livrer refuserait)');
    else refuser(
      'le dépôt de code porte des modifications non commitées',
      'Un reçu associe les notes à un COMMIT de code précis : livrer maintenant',
      "l'associerait à un état qui n'existe dans aucun commit.",
      '',
      'Committer le code, puis relancer.'
    );
  }

  const notesCode = notesDuCode(depotCode);
  // (a) Reprise : un « différent » laissé par une coupure n'est jamais pris
  // pour un contenu non reçu.
  const reprise = reprendre(depotCode, chantier, { simulation });
  const lint = verifierLintNotes(depotCode, notesCode, { simulation });
  if (lint.length) constats.push(`spec-lint : ${lint.length} point(s) sur les notes (livrer refuserait)`);
  if (simulation) {
    dire(`${GRAS}Simulation de livrer — chantier « ${nom} »${FIN} (aucune écriture)`);
    for (const c of constats) dire(`  ${JAUNE}--${FIN}   ${c}`);
    if (reprise?.aReprendre) {
      dire(`  ${JAUNE}--${FIN}   opération interrompue (${reprise.operation}) : reprise vérifiée possible,` +
        ' garde évaluée après elle seulement');
      return;
    }
  }
  const infoDoc = controlerWorktreeDoc(depotCode, chantier);

  const { worktreeDoc } = chantier;
  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));

  // (b) La garde.
  const base = baseDe(chantier);
  const garde = evaluerGarde(chantier, base);
  if (simulation) {
    dire(`  base      : ${decrireBase(base)}`);
    if (base?.revision) {
      const calcule = arbreGitDe(base.fichiers);
      const reel = gitOuNull(worktreeDoc, 'rev-parse', `${base.revision}:${CHEMIN_NOTES}`);
      dire(`  contrôle  : arbre recalculé depuis la base ${calcule === reel ? '=' : '≠'} arbre Git de` +
        ` ${court(base.revision)} (${court(calcule)} / ${court(reel)})`);
    }
    dire(`  tête doc  : ${court(infoDoc.tete)} — ${Object.keys(garde.tete.fichiers).length} fichiers dans le sous-arbre des notes`);
  }
  if (garde.collisions.length) refuserCollisions(garde.tete.fichiers, `la branche ${chantier.brancheDoc}`);
  if (!garde.physiqueOk) {
    refuser(
      'le worktree documentaire ne se réduit pas à sa branche',
      ...(garde.horsBranche.length
        ? [`Fichiers présents sur disque, hors de la branche (ignorés compris) : ${apercu(garde.horsBranche)}`] : []),
      ...(garde.manquants.length ? [`Fichiers de la branche absents du disque : ${apercu(garde.manquants)}`] : []),
      ...(garde.masques.length ? [`Fichiers masqués à git status (skip-worktree, assume-unchanged) : ${apercu(garde.masques)}`] : []),
      ...(garde.propre ? [] : ['Le worktree documentaire porte des modifications non commitées.']),
      '',
      "⚠️ `git status` ne voit pas un fichier exclu (.git/info/exclude, .gitignore), mais",
      'la copie miroir l’effacerait : ce serait perdre un fichier que personne n’a livré.',
      "Rien n'a été copié ni commité. Déplacer ces fichiers hors du worktree documentaire",
      '(ou les rétablir), puis relancer. `--adopter` ne lève pas ce refus.'
    );
  }
  if (!base && !adopter) {
    refuser(
      'aucune base synchronisée pour ce chantier',
      'Ni base enregistrée, ni reçu, ni rafraîchissement : rien ne dit ce que les notes',
      'locales ont reçu de la branche documentaire. Les reporter pourrait effacer ce',
      "qu'elles n'ont jamais eu.",
      '',
      "Rien n'a été copié ni commité. Si les notes locales contiennent tout ce que la",
      `branche ${chantier.brancheDoc} doit garder : livrer --chantier ${nom} --adopter`
    );
  }
  if (base && !garde.arbreOk && !adopter) {
    const { arbre } = garde;
    refuser(
      'la branche documentaire porte un contenu que les notes locales n’ont pas reçu',
      `Base synchronisée : ${decrireBase(base)}`,
      `Tête documentaire : ${court(infoDoc.tete)}`,
      ...(arbre.ajoutes.length ? [`  dans la branche, absents de la base : ${apercu(arbre.ajoutes)}`] : []),
      ...(arbre.modifies.length ? [`  différents de la base            : ${apercu(arbre.modifies)}`] : []),
      ...(arbre.retires.length ? [`  dans la base, absents de la branche : ${apercu(arbre.retires)}`] : []),
      '',
      '⚠️ La copie miroir effacerait ces chemins de la branche : c’est l’incident du',
      '2026-09-23. Rien n’a été copié ni commité.',
      '',
      'Marche à suivre :',
      `  · la branche a reçu une fusion de main : rafraichir --chantier ${nom}, puis livrer ;`,
      '  · les notes locales ont été adoptées (ouvrir --adopter) : fusionner À LA MAIN ce',
      `    contenu dans les notes locales, puis livrer --chantier ${nom} --adopter.`
    );
  }
  if (simulation) {
    const ids = blobsSelonDepot(worktreeDoc, notesCode, listerFichiers(notesCode));
    const delta = comparer(ids, garde.tete.fichiers);
    dire(`  garde     : ${VERT}passerait${FIN} — tête documentaire = base, worktree = tête` +
      ` (${listerFichiers(notesDoc).length} fichiers sur disque)`);
    dire(`  miroir    : +${delta.ajoutes.length} ~${delta.modifies.length} -${delta.retires.length}` +
      `${delta.casse.length ? ` casse ${delta.casse.length}` : ''}` +
      `${[...delta.ajoutes, ...delta.modifies, ...delta.retires].length ? ' — ' + apercu([...delta.ajoutes, ...delta.modifies, ...delta.retires]) : ''}`);
    return;
  }
  if (adopter && (!base || !garde.arbreOk)) {
    const locales = blobsSelonDepot(worktreeDoc, notesCode, listerFichiers(notesCode));
    const ecrase = comparer(garde.tete.fichiers, locales);
    dire(`${JAUNE}Adoption (--adopter)${FIN} : les notes locales remplacent ${chantier.brancheDoc}.`);
    if (ecrase.ajoutes.length) dire(`  retirés de la branche : ${apercu(ecrase.ajoutes, 20)}`);
    if (ecrase.modifies.length) dire(`  remplacés             : ${apercu(ecrase.modifies, 20)}`);
  }

  // Journal AVANT la première écriture : d'où l'on part, et l'état exact que
  // les notes reportées doivent atteindre.
  const avant = empreinteArbre(notesCode);
  chantier.journal = {
    operation: 'livrer',
    depuis: infoDoc.tete,
    etatAttendu: { empreinte: avant.empreinte, fichiers: avant.blobs },
    le: new Date().toISOString(),
  };
  delete chantier.livraisonEnCours;
  ecrireChantier(depotCode, nom, chantier);

  // (c) Le miroir : derrière la garde, il ne copie que le delta base → notes
  // locales — suppressions, modifications et renommages légitimes.
  copierMiroir(notesCode, notesDoc, { arret: 'pendant-miroir' });

  // Contrôle d'égalité APRÈS report : la copie n'est pas supposée fidèle, elle
  // est vérifiée fidèle.
  const apres = empreinteArbre(notesDoc);
  if (avant.empreinte !== apres.empreinte) {
    refuser(
      'le report ne rend pas un contenu identique',
      `Notes locales   : ${avant.empreinte.slice(0, 16)} (${avant.fichiers.length} fichiers)`,
      `Notes reportées : ${apres.empreinte.slice(0, 16)} (${apres.fichiers.length} fichiers)`,
      'Rien n’a été commité côté documentaire.'
    );
  }

  const commitCode = git(depotCode, 'rev-parse', 'HEAD');

  git(worktreeDoc, 'add', '-A', CHEMIN_NOTES);
  enregistrerCheminsExacts(worktreeDoc, avant.fichiers);
  if (git(worktreeDoc, 'status', '--porcelain') !== '') {
    // ⚠️ Le journal, écrit AVANT le miroir, permettra de PROUVER après une
    // coupure que l'avance de la branche documentaire vient de nous.
    gitAvecEntree(
      worktreeDoc,
      ['commit', '-F', '-'],
      `Notes du chantier ${nom} — code ${commitCode.slice(0, 7)}\n\n` +
        `Report automatique par \`chantier livrer\`.\n` +
        `Empreinte des notes : ${apres.empreinte}\n` +
        `${apres.fichiers.length} fichiers.\n`
    );
    // ⚠️ Le registre est mis à jour AVANT d'écrire le reçu, pas après. Une
    // interruption entre les deux laisserait sinon la révision attendue en
    // retard sur la branche, et le `livrer` suivant refuserait à tort pour
    // « branche avancée indépendamment » — un chantier bloqué par sa propre
    // sécurité. L'étape déjà accomplie doit être enregistrée dès qu'elle l'est.
    // ⚠️ Point d'arrêt RÉSERVÉ AUX TESTS, placé ICI et pas ailleurs : la
    // fenêtre dangereuse est celle qui sépare le commit des notes de la mise à
    // jour du registre juste en dessous. S'arrêter après cette mise à jour ne
    // reproduirait rien. On passe par le VRAI chemin de code — un registre
    // bricolé à la main ne prouve pas qu'on sait revenir de l'état réel.
    pointArret('apres-commit-notes');

    // ⚠️ Le journal garde son `depuis` : c'est l'écart entre les deux qui
    // bloquait la reprise après le commit du reçu (L352 de l'ancien outil).
    chantier.revisionDocAttendue = git(worktreeDoc, 'rev-parse', 'HEAD');
    ecrireChantier(depotCode, nom, chantier);
    dire('Notes reportées et commitées.');
  } else {
    dire('Notes déjà à jour côté documentaire — aucun nouveau commit.');
  }

  // ⚠️ `commitDoc` est le dernier commit qui TOUCHE LES NOTES, pas la tête de
  // la branche. La tête inclut le commit du reçu lui-même : la prendre rendait
  // chaque livraison différente de la précédente, donc un nouveau commit de
  // reçu à chaque appel — l'idempotence annoncée était fausse, et l'essai de
  // bout en bout l'a montré.
  const commitDoc = git(worktreeDoc, 'log', '-1', '--format=%H', '--', CHEMIN_NOTES);

  // ⚠️ Le reçu est écrit et commité APRÈS les notes, dans `recus/` — hors du
  // dossier dont on calcule l'empreinte. Sinon l'écrire changerait la valeur
  // qu'il enregistre, et aucun reçu ne pourrait jamais être valide.
  const recu = {
    chantier: nom,
    commitCode,
    commitDoc,
    empreinteNotes: apres.empreinte,
    nbFichiers: apres.fichiers.length,
    livreLe: new Date().toISOString(),
  };
  const cheminRecu = join(worktreeDoc, DOSSIER_RECUS, `${nom}.json`);
  mkdirSync(dirname(cheminRecu), { recursive: true });
  const texteRecu = JSON.stringify(recu, null, 2) + '\n';
  const dejaLeMeme = existsSync(cheminRecu) && lireRecuBrut(cheminRecu, ['livreLe']) === effacerChamps(recu, ['livreLe']);

  if (!dejaLeMeme) {
    writeFileSync(cheminRecu, texteRecu);
    git(worktreeDoc, 'add', '-A', DOSSIER_RECUS);
    if (git(worktreeDoc, 'status', '--porcelain') !== '') {
      gitAvecEntree(
        worktreeDoc,
        ['commit', '-F', '-'],
        `Reçu du chantier ${nom}\n\n` +
          `code ${commitCode.slice(0, 7)} ↔ notes ${commitDoc.slice(0, 7)}\n`
      );
      pointArret('apres-commit-recu');
    }
  }

  // (d) La nouvelle base : ce que la branche porte désormais, et que les notes
  // locales ont par construction — elles en sont la source.
  chantier.revisionDocAttendue = git(worktreeDoc, 'rev-parse', 'HEAD');
  chantier.dernierRecu = recu;
  chantier.base = nouvelleBase(worktreeDoc, commitDoc || chantier.revisionDocAttendue, apres.empreinte, 'livrer');
  // La livraison est allée à son terme : le journal n'a plus de raison
  // d'être, et le laisser autoriserait une reprise qu'on ne veut plus.
  delete chantier.journal;
  delete chantier.livraisonEnCours;
  ecrireChantier(depotCode, nom, chantier);

  dire(`${VERT}Livré.${FIN}`);
  dire(`  code  : ${commitCode.slice(0, 7)}`);
  dire(`  notes : ${commitDoc.slice(0, 7)} (${apres.fichiers.length} fichiers)`);
  dire(`  reçu  : ${DOSSIER_RECUS}/${nom}.json`);
  dire('');
  dire(
    `${JAUNE}Sauvegarde non effectuée par cette commande${FIN} : ` +
      `git -C "${worktreeDoc}" push -u origin ${chantier.brancheDoc}`
  );
}

// ⚠️ Un renommage qui ne change QUE la casse échappe à `git add -A` sous
// Windows (`core.ignorecase`) : le disque porte le nouveau nom, l'index garde
// l'ancien, et le commit perdrait le renommage sans rien dire. On le rend
// explicite — suppression de l'ancien chemin dans l'index, ajout du nouveau.
// Puis l'index doit porter EXACTEMENT les chemins des notes locales : un
// fichier que le dépôt documentaire ignore n'y entrerait pas, et le reçu
// certifierait un contenu que la branche n'a pas.
function enregistrerCheminsExacts(worktreeDoc, cheminsLocaux) {
  const lister = () => (gitOuNull(worktreeDoc, 'ls-files', '-z', '--', CHEMIN_NOTES) || '')
    .split('\0')
    .filter(Boolean)
    .map((c) => c.slice(CHEMIN_NOTES.length + 1));
  const index = lister();
  const dansIndex = new Set(index);
  const locaux = new Set(cheminsLocaux);
  const locauxParCle = new Map(cheminsLocaux.map((c) => [cleChemin(c), c]));
  for (const i of index) {
    if (locaux.has(i)) continue;
    const l = locauxParCle.get(cleChemin(i));
    if (l && !dansIndex.has(l)) {
      git(worktreeDoc, 'rm', '--cached', '-q', '--', `${CHEMIN_NOTES}/${i}`);
      gitOuNull(worktreeDoc, 'add', '--', `${CHEMIN_NOTES}/${l}`);
    }
  }
  const final = new Set(lister());
  const manquants = cheminsLocaux.filter((c) => !final.has(c));
  const exces = [...final].filter((c) => !locaux.has(c));
  if (manquants.length || exces.length) {
    refuser(
      'l’index documentaire ne porte pas exactement les notes locales',
      ...(manquants.length ? [`Absents de l'index (ignorés par le dépôt documentaire ?) : ${apercu(manquants)}`] : []),
      ...(exces.length ? [`En trop dans l'index : ${apercu(exces)}`] : []),
      '',
      "Rien n'a été commité. Corriger la règle en cause, puis relancer `livrer` : le",
      'journal de la livraison permet de reprendre la copie déjà faite.'
    );
  }
}

// Deux reçus ne diffèrent que par leur horodatage quand rien n'a bougé : sans
// cette comparaison, chaque `livrer` créerait un commit vide de sens et
// l'idempotence annoncée serait fausse.
function effacerChamps(objet, champs) {
  const copie = { ...objet };
  for (const c of champs) delete copie[c];
  return JSON.stringify(copie);
}

function lireRecuBrut(chemin, champsIgnores) {
  try {
    return effacerChamps(JSON.parse(readFileSync(chemin, 'utf8')), champsIgnores);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
 * verifier
 *
 * ⚠️ Contrôle l'ÉTAT RÉEL, jamais une case « terminé ». Un reçu n'est valable
 * que si tous ses critères tiennent ENSEMBLE au moment où on le lit.
 * ----------------------------------------------------------------------- */

function verifier(nom, optionsVerif = {}) {
  const silencieux = optionsVerif.silencieux === true;
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);
  controlerIdentite(depotCode, chantier);
  const { worktreeDoc } = chantier;

  const controles = [];
  const ajouter = (libelle, ok, detail) => controles.push({ libelle, ok, detail });

  if (!existsSync(worktreeDoc)) {
    refuser('le worktree documentaire est absent', `Attendu : ${worktreeDoc}`);
  }

  const cheminRecu = join(worktreeDoc, DOSSIER_RECUS, `${nom}.json`);
  if (!existsSync(cheminRecu)) {
    refuser(
      'aucun reçu pour ce chantier',
      `Attendu : ${cheminRecu}`,
      'Le chantier est ouvert mais jamais livré. Lancer `livrer` avant.'
    );
  }
  const recu = JSON.parse(readFileSync(cheminRecu, 'utf8'));

  const teteCode = git(depotCode, 'rev-parse', 'HEAD');
  ajouter(
    'le code livré est le code actuel',
    teteCode === recu.commitCode,
    `reçu ${recu.commitCode.slice(0, 7)} · actuel ${teteCode.slice(0, 7)}`
  );

  ajouter('aucune modification de code en attente', estPropre(depotCode), '');

  const notesCode = notesDuCode(depotCode);
  const empreinteActuelle = empreinteArbre(notesCode);
  // ⚠️ Un `rafraichir` change les notes SANS nouveau reçu : la base a avancé,
  // pas le travail du chantier. Le reçu reste valide pour le code qu'il désigne
  // si les notes actuelles sont EXACTEMENT celles que le dernier rafraîchissement
  // a laissées, et si ce rafraîchissement prolonge bien CE reçu-là — toute
  // autre différence est une modification non livrée, comme avant.
  const raf = chantier.dernierRafraichissement;
  const rafraichiDepuisRecu =
    raf &&
    raf.empreinteRecu === recu.empreinteNotes &&
    empreinteActuelle.empreinte === raf.empreinteApres;
  ajouter(
    'les notes actuelles sont celles du reçu',
    empreinteActuelle.empreinte === recu.empreinteNotes || Boolean(rafraichiDepuisRecu),
    rafraichiDepuisRecu
      ? `${empreinteActuelle.fichiers.length} fichiers · base rafraîchie depuis ${raf.source} ${raf.refSource.slice(0, 7)}` +
          ` après le reçu — un \`livrer\` actualisera l'empreinte`
      : `${empreinteActuelle.fichiers.length} fichiers · ${empreinteActuelle.empreinte.slice(0, 16)}…`
  );

  const brancheDoc = git(worktreeDoc, 'rev-parse', '--abbrev-ref', 'HEAD');
  ajouter('le worktree documentaire est sur sa branche', brancheDoc === chantier.brancheDoc, brancheDoc);
  ajouter('le worktree documentaire est propre', estPropre(worktreeDoc), '');

  const teteDoc = git(worktreeDoc, 'rev-parse', 'HEAD');
  ajouter(
    'la branche documentaire est à la révision attendue',
    teteDoc === chantier.revisionDocAttendue,
    `attendue ${String(chantier.revisionDocAttendue).slice(0, 7)} · trouvée ${teteDoc.slice(0, 7)}`
  );

  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  ajouter(
    'les notes reportées sont identiques aux notes locales',
    existsSync(notesDoc) && empreinteArbre(notesDoc).empreinte === empreinteActuelle.empreinte,
    ''
  );

  // ⚠️ L'intégrité de l'INSTALLATION, pas sa conformité à la branche courante.
  // Comparer l'installé au source de la branche checkoutée ferait échouer toute
  // branche antérieure à la dernière version de l'outil — l'incompatibilité
  // entre branches qu'on cherche justement à éliminer.
  const inst = etatInstallation(depotCode);
  if (inst.presente) {
    ajouter(
      'l’installation commune est intègre',
      inst.alterations.length === 0,
      inst.alterations.length ? `altérés : ${inst.alterations.join(', ')}` : `@ ${inst.manifeste.commitSource.slice(0, 7)}`
    );
  }

  if (!silencieux) {
    dire(`${GRAS}Chantier « ${nom} »${FIN}`);
    for (const c of controles) {
      const marque = c.ok ? `${VERT}ok${FIN}` : `${ROUGE}KO${FIN}`;
      dire(`  ${marque}   ${c.libelle}${c.detail ? ` — ${c.detail}` : ''}`);
    }
    // La base synchronisée (lot O) est AFFICHÉE, sans changer le verdict du
    // reçu : c'est `livrer` qui refuse sur elle.
    const info = (ok, texte) => dire(`  ${ok ? `${VERT}ok${FIN}` : `${JAUNE}--${FIN}`}   ${texte}`);
    const base = baseDe(chantier);
    info(Boolean(base), `base synchronisée : ${decrireBase(base)}`);
    if (base) {
      const arbre = comparer(inventaireGit(worktreeDoc, 'HEAD').fichiers, base.fichiers);
      const ecarts = [...arbre.ajoutes, ...arbre.modifies, ...arbre.retires];
      info(arbre.egal, arbre.egal
        ? 'l’arbre documentaire est égal à la base'
        : `l’arbre documentaire diffère de la base — ${ecarts.length} chemin(s) : ${apercu(ecarts, 5)}`);
    }
    if (chantier.journal) {
      info(false, `opération interrompue en attente : ${chantier.journal.operation} — reprise au prochain livrer ou rafraichir`);
    }
    if (!inst.presente) {
      dire(
        `  ${JAUNE}--${FIN}   aucune installation commune — l'outil tourne depuis le` +
          ' dépôt, donc depuis la branche checkoutée (voir `installer`)'
      );
    }
  }

  const echecs = controles.filter((c) => !c.ok);
  if (echecs.length > 0 && silencieux) {
    dire(`${ROUGE}Livraison invalide — ${echecs.length} contrôle(s) en échec :${FIN}`);
    for (const c of echecs) dire(`  · ${c.libelle}${c.detail ? ` — ${c.detail}` : ''}`);
    process.exit(1);
  }
  if (echecs.length > 0) {
    dire('');
    dire(`${ROUGE}Reçu PÉRIMÉ ou incohérent — ${echecs.length} contrôle(s) en échec.${FIN}`);
    dire('Relancer `livrer` actualise la livraison ; sans changement, aucun commit');
    dire("n'est créé.");
    dire('');
    dire(
      `${JAUNE}⚠️ Une contribution dont le reçu échoue ne doit pas être intégrée.${FIN}`
    );
    process.exit(1);
  }

  if (silencieux) return;
  dire('');
  dire(`${VERT}Reçu valide.${FIN} code ${recu.commitCode.slice(0, 7)} ↔ notes ${recu.commitDoc.slice(0, 7)}`);
  dire(
    `${JAUNE}Ce que ce reçu NE dit PAS${FIN} : que toutes les notes utiles ont été` +
      ' écrites. Seulement que celles qui existent sont conservées et associées au bon code.'
  );
}

/* --------------------------------------------------------------------------
 * installer
 *
 * ⚠️ **Le script SOURCE et son INSTALLATION sont deux objets distincts.** Le
 * source est versionné et relu en revue ; l'installation est propre à la
 * machine et **commune à tous les worktrees**. Confondre les deux a produit
 * deux erreurs successives dans le cadrage :
 *
 *   - `core.hooksPath` RELATIF se résout à l'exécution : chaque worktree
 *     prendrait SON `.githooks`, tel que checkouté sur sa branche ;
 *   - un chemin absolu vers le `.githooks` du worktree principal ne résout
 *     rien non plus — son contenu dépend encore de la branche qui y est
 *     checkoutée.
 *
 * D'où une copie hors arbre de travail, sous le répertoire Git COMMUN, avec
 * son propre manifeste de version. `verifier` contrôle CETTE version installée,
 * jamais le source de la branche courante : comparer à la branche recréerait
 * exactement l'incompatibilité entre anciennes et nouvelles branches qu'on
 * cherche à éliminer.
 * ----------------------------------------------------------------------- */

function dossierInstallation(depotCode) {
  const commun = resolve(depotCode, git(depotCode, 'rev-parse', '--git-common-dir'));
  return join(commun, 'forge', 'installation');
}

// ⚠️ `spec-lint.mjs` et son parseur sont installés pour que le hook
// `pre-commit` (§4) puisse les importer EN RELATIF depuis son propre dossier
// installé (`<installation>/hooks/pre-commit` → `../scripts/spec-lint.mjs`),
// exactement comme depuis `.githooks/` du dépôt de code.
const FICHIERS_INSTALLES = [
  'scripts/chantier.mjs',
  'scripts/hooks-codex.mjs',
  'scripts/spec-lint.mjs',
  'scripts/lib/spec-markdown.mjs',
];
const HOOKS_INSTALLES = ['pre-commit'];

function empreinteFichier(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

function installer(options) {
  const depotCode = racineCode();
  const installation = dossierInstallation(depotCode);
  const manifeste = {
    commitSource: git(depotCode, 'rev-parse', 'HEAD'),
    brancheSource: git(depotCode, 'rev-parse', '--abbrev-ref', 'HEAD'),
    installeLe: new Date().toISOString(),
    fichiers: {},
  };

  if (!estPropre(depotCode)) {
    dire(
      `${JAUNE}⚠️ Le dépôt porte des modifications non commitées${FIN} : le manifeste` +
        ' enregistrera un commit qui ne décrit pas exactement ce qui est installé.'
    );
  }

  mkdirSync(join(installation, 'scripts'), { recursive: true });
  for (const rel of FICHIERS_INSTALLES) {
    const source = join(depotCode, ...rel.split('/'));
    if (!existsSync(source)) refuser(`fichier source absent : ${rel}`);
    const dest = join(installation, ...rel.split('/'));
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(source, dest);
    manifeste.fichiers[rel] = empreinteFichier(dest);
  }

  const hooksInstalles = [];
  mkdirSync(join(installation, 'hooks'), { recursive: true });
  for (const nomHook of HOOKS_INSTALLES) {
    const source = join(depotCode, '.githooks', nomHook);
    if (!existsSync(source)) continue;
    const dest = join(installation, 'hooks', nomHook);
    copyFileSync(source, dest);
    manifeste.fichiers[`.githooks/${nomHook}`] = empreinteFichier(dest);
    hooksInstalles.push(nomHook);
  }

  writeFileSync(join(installation, 'manifeste.json'), JSON.stringify(manifeste, null, 2) + '\n');

  dire(`${VERT}Installé.${FIN} ${installation}`);
  dire(`  source : ${manifeste.brancheSource} @ ${manifeste.commitSource.slice(0, 7)}`);
  for (const rel of Object.keys(manifeste.fichiers)) dire(`  · ${rel}`);

  /* ------------------------------------------------------- câblage du hook */
  if (hooksInstalles.length === 0) {
    dire(`${JAUNE}Aucun hook à installer${FIN} — `.concat('`.githooks/` est absent ou vide.'));
    return;
  }
  const cheminHooks = join(installation, 'hooks');
  const actuel = gitOuNull(depotCode, 'config', 'core.hooksPath');

  if (actuel && resolve(depotCode, actuel) !== cheminHooks) {
    // ⚠️ Signalé, jamais écrasé en silence : un câblage préexistant peut porter
    // des hooks qui ne viennent pas d'ici.
    dire('');
    dire(`${JAUNE}⚠️ Un câblage de hooks existe déjà et n'a PAS été remplacé.${FIN}`);
    dire(`  actuel  : ${actuel}`);
    dire(`  proposé : ${cheminHooks}`);
    dire('  Pour basculer explicitement :');
    dire(`    git config core.hooksPath "${cheminHooks}"`);
    return;
  }
  if (!actuel) {
    if (options['cabler'] === false || options['sans-cablage'] !== undefined) {
      dire(`${JAUNE}Hooks installés mais NON câblés${FIN} (--sans-cablage).`);
      return;
    }
    git(depotCode, 'config', 'core.hooksPath', cheminHooks);
  }
  dire(`  hooks câblés : ${cheminHooks}`);
  if (options['codex-hooks']) installerHooksCodex(resolve(options['codex-hooks']), installation);
}

function installerHooksCodex(chemin, installation) {
  // Opt-in personnel : aucun fichier .codex imposé aux autres contributeurs.
  const config = existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : {};
  config.hooks ??= {};
  const commande = `node "${join(installation, 'scripts', 'hooks-codex.mjs')}"`;
  for (const evenement of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'Stop']) {
    const groupes = config.hooks[evenement] ?? [];
    if (groupes.some(g => g.hooks?.some(h => h.command === commande))) continue;
    groupes.push({ ...(evenement === 'PreToolUse' ? { matcher: 'Bash|apply_patch|Edit|Write' } : {}),
      hooks: [{ type: 'command', command: commande, timeout: 60,
        statusMessage: 'SW Forge : contrôle du chantier' }] });
    config.hooks[evenement] = groupes;
  }
  mkdirSync(dirname(chemin), { recursive: true });
  // Préserver les hooks existants et une copie avant le changement.
  if (existsSync(chemin)) copyFileSync(chemin, `${chemin}.avant-sw-forge`);
  writeFileSync(chemin, JSON.stringify(config, null, 2) + '\n');
  dire(`Hooks Codex configurés : ${chemin}. Les approuver dans /hooks avant utilisation.`);
}

function etatInstallation(depotCode) {
  const installation = dossierInstallation(depotCode);
  const cheminManifeste = join(installation, 'manifeste.json');
  if (!existsSync(cheminManifeste)) return { presente: false };
  const manifeste = JSON.parse(readFileSync(cheminManifeste, 'utf8'));
  const alterations = [];
  for (const [rel, empreinte] of Object.entries(manifeste.fichiers)) {
    const installe =
      rel.startsWith('.githooks/')
        ? join(installation, 'hooks', rel.slice('.githooks/'.length))
        : join(installation, ...rel.split('/'));
    if (!existsSync(installe) || empreinteFichier(installe) !== empreinte) alterations.push(rel);
  }
  return { presente: true, manifeste, alterations, installation };
}

/* --------------------------------------------------------------------------
 * fermer
 *
 * ⚠️ **« Livré » ne veut PAS dire « intégré ».** Une branche documentaire
 * sauvegardée n'autorise pas la disparition du seul exemplaire du travail de
 * CODE. `fermer` exige donc les trois à la fois : reçu valide, sauvegarde
 * distante effective, et code soit intégré soit archivé explicitement.
 * ----------------------------------------------------------------------- */

function fermer(nom, options) {
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);
  controlerIdentite(depotCode, chantier);
  const { worktreeDoc, depotDoc, brancheDoc } = chantier;

  // 1. La livraison tient-elle ? On réutilise `verifier`, qui sort en 1 si non.
  verifier(nom, { silencieux: true });

  // 2. La sauvegarde distante porte-t-elle la branche documentaire ?
  const teteDoc = git(worktreeDoc, 'rev-parse', 'HEAD');
  const distant = gitOuNull(depotDoc, 'ls-remote', 'origin', `refs/heads/${brancheDoc}`);
  if (distant === null) {
    refuser(
      'la sauvegarde distante est injoignable',
      `Dépôt documentaire : ${depotDoc}`,
      '',
      "⚠️ Le chantier reste OUVERT, sans exception. Fermer hors ligne reviendrait",
      "à faire confiance a une sauvegarde qu'on n'a pas pu contrôler.",
      '',
      `Réessayer, ou pousser : git -C "${worktreeDoc}" push -u origin ${brancheDoc}`
    );
  }
  const shaDistant = distant.split(/\s+/)[0] ?? '';
  if (shaDistant !== teteDoc) {
    refuser(
      'la branche documentaire n’est pas sauvegardée',
      `locale   : ${teteDoc.slice(0, 7)}`,
      `distante : ${shaDistant ? shaDistant.slice(0, 7) : '(absente)'}`,
      '',
      `git -C "${worktreeDoc}" push -u origin ${brancheDoc}`
    );
  }

  // 3. Le CODE est-il conservé ? Intégré, ou archivé explicitement.
  const commitCode = chantier.dernierRecu?.commitCode ?? git(depotCode, 'rev-parse', 'HEAD');
  const cible = options['integre-dans'] || 'main';
  const integre =
    gitOuNull(depotCode, 'merge-base', '--is-ancestor', commitCode, cible) !== null;

  if (!integre) {
    const surUnDistant = (gitOuNull(depotCode, 'branch', '-r', '--contains', commitCode) || '').trim();
    if (!options.archive) {
      refuser(
        `le code n’est ni intégré dans ${cible}, ni archivé`,
        `Commit : ${commitCode.slice(0, 7)}`,
        '',
        "⚠️ Une branche documentaire sauvegardée n'autorise pas la disparition du",
        'SEUL exemplaire du travail de code.',
        '',
        `Intégrer dans ${cible}, ou archiver explicitement :`,
        '  (pousser la branche de code, puis relancer avec --archive)'
      );
    }
    if (!surUnDistant) {
      refuser(
        'archivage demandé, mais le commit de code n’est sur AUCUN distant',
        `Commit : ${commitCode.slice(0, 7)}`,
        "Archiver ne peut pas vouloir dire « nulle part ». Pousser la branche d'abord."
      );
    }
    dire(`${JAUNE}Code archivé${FIN} (non intégré dans ${cible}) : ${surUnDistant.split('\n')[0].trim()}`);
  }

  // 4. Nettoyage — le worktree DOCUMENTAIRE seulement.
  // ⚠️ Le worktree principal ne se supprime pas par `git worktree remove` ; ce
  // n'est pas non plus le rôle de cette commande.
  git(depotDoc, 'worktree', 'unlock', worktreeDoc);
  git(depotDoc, 'worktree', 'remove', worktreeDoc);

  const ferme = {
    ...chantier,
    fermeLe: new Date().toISOString(),
    revisionDocFinale: teteDoc,
    commitCodeFinal: commitCode,
    integreDans: integre ? cible : null,
    worktreeDoc: null,
  };
  ecrireChantier(depotCode, nom, ferme);

  dire(`${VERT}Chantier « ${nom} » fermé.${FIN}`);
  dire(`  code  : ${commitCode.slice(0, 7)}${integre ? ` (intégré dans ${cible})` : ' (archivé)'}`);
  dire(`  notes : ${teteDoc.slice(0, 7)} sur ${brancheDoc}, sauvegardé`);
  dire(`  worktree documentaire retiré ; les références restent dans le registre.`);
  const sauvegardes = dossierSauvegardes(depotCode, nom);
  if (existsSync(sauvegardes)) {
    dire(`  sauvegardes d'ouverture conservées : ${sauvegardes} — \`fermer\` ne les supprime jamais.`);
  }
}

/* --------------------------------------------------------------------------
 * integrer
 *
 * ⚠️ **Découple deux rythmes que rien n'obligeait à coupler.** Le code rejoint
 * `main` rarement, par lots de plusieurs chantiers, avec un numéro de version
 * décidé. Les notes d'un chantier, elles, sont valides dès qu'elles sont
 * livrées et que le reçu passe. Faire attendre les secondes sur le premier les
 * fige pour des semaines — et un chantier suivant repartirait alors d'un état
 * de référence périmé, sans voir le travail du précédent.
 *
 * `integrer` avance donc le `main` DOCUMENTAIRE seul, et laisse le chantier
 * OUVERT : `fermer` garde sa condition stricte sur la conservation du code,
 * qui est un autre sujet.
 * ----------------------------------------------------------------------- */

function integrer(nom, options) {
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);
  controlerIdentite(depotCode, chantier);

  // La livraison doit tenir AVANT d'avancer la référence.
  verifier(nom, { silencieux: true });

  const { depotDoc, brancheDoc, worktreeDoc } = chantier;
  const cible = options['integrer-dans'] || 'main';

  const branche = git(depotDoc, 'rev-parse', '--abbrev-ref', 'HEAD');
  if (branche !== cible) {
    refuser(
      `le dépôt documentaire n’est pas sur ${cible}`,
      `Chemin : ${depotDoc}`,
      `Trouvé : ${branche}`,
      "C'est le répertoire de référence : il doit rester sur sa branche."
    );
  }
  if (!estPropre(depotDoc)) {
    refuser(
      `le dépôt documentaire porte des modifications non commitées`,
      `Chemin : ${depotDoc}`,
      "⚠️ Ce répertoire n'est pas un espace de travail : rien n'a à y être édité",
      'à la main. Trancher ces modifications avant de continuer.'
    );
  }

  // Précontrôle seulement : un distant joignable peut encore refuser le push.
  // Le succès exige une confirmation APRÈS le push, y compris à la reprise.
  if (gitOuNull(depotDoc, 'ls-remote', 'origin', `refs/heads/${cible}`) === null) {
    refuser(
      'la sauvegarde distante est injoignable',
      `Dépôt documentaire : ${depotDoc}`,
      '',
      "Rien n'a été fusionné. Réessayer une fois la connexion revenue."
    );
  }

  const avant = git(depotDoc, 'rev-parse', 'HEAD');
  const teteChantier = git(worktreeDoc, 'rev-parse', 'HEAD');

  const dejaIntegre = gitOuNull(depotDoc, 'merge-base', '--is-ancestor', teteChantier, avant) !== null;

  // ⚠️ `git merge` n'accepte PAS `-F -` : contrairement à `commit`, il ne lit
  // pas l'entrée standard (« could not read file '-' »). D'où un fichier de
  // message — et non un `-m`, que ce dépôt proscrit.
  const cheminMessage = join(resolve(depotDoc, git(depotDoc, 'rev-parse', '--git-dir')), 'MERGE_MSG_CHANTIER');
  writeFileSync(
    cheminMessage,
    `Intégration des notes du chantier ${nom}\n\n` +
      `${brancheDoc} → ${cible}\n` +
      `code ${chantier.dernierRecu?.commitCode?.slice(0, 7) ?? '?'}\n`
  );

  try {
    if (!dejaIntegre) git(depotDoc, 'merge', '--no-ff', '-F', cheminMessage, teteChantier);
  } catch {
    // ⚠️ On tente la fusion et on ne refuse QUE si git échoue : sur des notes
    // Markdown modifiées à des endroits différents, un merge git est fiable, et
    // refuser d'office rendrait la commande inutile dans le cas fréquent.
    const conflits = (gitOuNull(depotDoc, 'diff', '--name-only', '--diff-filter=U') || '')
      .split('\n')
      .filter(Boolean);
    gitOuNull(depotDoc, 'merge', '--abort');
    refuser(
      'la fusion des notes est en CONFLIT',
      ...(conflits.length ? ['Fichiers en conflit :', ...conflits.map((f) => `  · ${f}`)] : []),
      '',
      `⚠️ La fusion a été ANNULÉE : ${cible} est resté à ${avant.slice(0, 7)}.`,
      'Deux chantiers ont touché le même passage — ça se tranche à la main, pas',
      'par un outil qui choisirait un côté.',
      '',
      `  git -C "${depotDoc}" merge ${brancheDoc}     # puis résoudre, puis relancer`
    );
  }

  rmSync(cheminMessage, { force: true });
  const apres = git(depotDoc, 'rev-parse', 'HEAD');
  if (gitOuNull(depotDoc, 'push', 'origin', `${apres}:refs/heads/${cible}`) === null) {
    refuser('fusion locale conservée, sauvegarde NON confirmée',
      `La référence locale ${cible} est à ${apres}. Aucun succès d’intégration n’est enregistré.`,
      'Corriger le refus distant puis relancer integrer : la sauvegarde sera retentée sans refaire la fusion.');
  }
  const confirmation = gitOuNull(depotDoc, 'ls-remote', 'origin', `refs/heads/${cible}`);
  if (confirmation === null || confirmation.split(/\s+/)[0] !== apres) {
    refuser('confirmation distante impossible ou référence distante différente',
      'La fusion locale est conservée. Relancer integrer après vérification du distant.');
  }

  const dejaEnregistre = (chantier.integrations ?? []).some(i =>
    i.cible === cible && i.apres === apres && i.teteChantier === teteChantier);
  if (!dejaEnregistre) chantier.integrations = [
    ...(chantier.integrations ?? []),
    { cible, avant, apres, teteChantier, le: new Date().toISOString() },
  ];
  ecrireChantier(depotCode, nom, chantier);

  dire(`${VERT}Notes intégrées.${FIN}`);
  dire(`  ${brancheDoc} → ${cible} : ${avant.slice(0, 7)} → ${apres.slice(0, 7)}`);
  dire(`  poussé sur origin/${cible}`);
  dire('');
  dire(
    `Le chantier reste OUVERT — l'intégration des NOTES ne dit rien du sort du` +
      ` CODE, qui est la condition de \`fermer\`.`
  );
}

/* --------------------------------------------------------------------------
 * rafraichir
 *
 * ⚠️ **Le dispositif POUSSAIT, il ne TIRAIT jamais.** `livrer` → `integrer`
 * fait monter les notes d'un chantier vers le `main` documentaire ; rien ne
 * les faisait REDESCENDRE vers un chantier déjà ouvert — le dossier de notes
 * n'était copié qu'à `ouvrir`, et seulement s'il était absent. Un chantier
 * ouvert avant qu'un autre intègre travaillait donc sur une référence
 * périmée sans le savoir (constaté le 2026-09-17 : 42 fichiers dans un
 * worktree contre 72 dans le `main` documentaire).
 *
 * `rafraichir` fait l'inverse d'`integrer` : `main` → branche du chantier →
 * copie de code. Il ne fait NI lint (c'est `livrer`), NI modification de
 * code, NI push.
 *
 * ⚠️ **Rien d'inédit n'est jamais écrasé** : les notes du worktree de code
 * doivent être IDENTIQUES à celles du worktree documentaire, sinon c'est un
 * refus « livrer d'abord ». La copie miroir de l'étape finale supprime ce
 * qui n'est pas dans la source — sur des notes non livrées, ce serait une
 * perte irréversible.
 * ----------------------------------------------------------------------- */

function rafraichir(nom, options) {
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);
  controlerIdentite(depotCode, chantier);

  const notesCode = notesDuCode(depotCode);
  const source = options['depuis'] || 'main';
  // (a) Une copie interrompue se termine avant tout : sinon des notes locales
  // à moitié copiées passeraient pour « non livrées ».
  reprendre(depotCode, chantier);
  const infoDoc = controlerWorktreeDoc(depotCode, chantier, { source });

  const { depotDoc, brancheDoc, worktreeDoc } = chantier;
  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  const localesAvant = empreinteArbre(notesCode);
  const idsLocaux = () => blobsSelonDepot(worktreeDoc, notesCode, localesAvant.fichiers);

  let avantDoc;
  let apresDoc;
  let refSource;

  if (infoDoc.repriseFusionManuelle) {
    // ⚠️ La fusion a déjà eu lieu À LA MAIN (marche à suivre du refus
    // « CONFLIT » ci-dessous) : `controlerWorktreeDoc` a déjà vérifié que le
    // HEAD documentaire est un commit de fusion dont le premier parent est
    // la révision attendue et le second `source` (ou un ancêtre). Pas de
    // nouvelle fusion — seulement la copie miroir et le registre, comme au
    // cas normal.
    // ⚠️ Rien d'inédit n'est écrasé, ici non plus (lot O) : les notes locales
    // doivent être celles du premier parent — la dernière synchronisation —,
    // sinon la copie effacerait un travail jamais livré.
    const ecart = comparer(idsLocaux(), inventaireGit(worktreeDoc, infoDoc.baseAvant).fichiers);
    if (!ecart.egal) {
      refuser(
        'les notes locales ont changé depuis la dernière synchronisation',
        `Référence : ${court(infoDoc.baseAvant)}, premier parent de la fusion résolue à la main`,
        ...[['modifiés', ecart.modifies], ['ajoutés', ecart.ajoutes], ['supprimés', ecart.retires]]
          .filter(([, l]) => l.length).map(([q, l]) => `  ${q} : ${apercu(l)}`),
        '',
        'La copie de la fusion les écraserait. Rien n’a été touché. Les mettre de côté,',
        'relancer rafraichir, puis les réappliquer et livrer — ou fusionner à la main le',
        `contenu de la branche dans les notes locales, puis livrer --chantier ${nom} --adopter.`
      );
    }
    avantDoc = infoDoc.baseAvant;
    apresDoc = infoDoc.tete;
    refSource = infoDoc.sourceFusionnee;
    dire(`${JAUNE}Fusion résolue à la main reprise${FIN} : recopie et registre, sans nouvelle fusion.`);
  } else {
    avantDoc = infoDoc.tete;

    const reporteesAvant = existsSync(notesDoc)
      ? empreinteArbre(notesDoc)
      : { empreinte: null, fichiers: [] };
    // Deux états sûrs : notes locales = notes reportées (le cas courant), ou
    // notes locales = base synchronisée, quand la branche a avancé par une
    // fusion que les notes n'ont pas encore reçue (fusion reconnue par
    // l'ancien outil, puis coupure). Une base ADOPTÉE n'est pas un état
    // documentaire : elle ne compte pas.
    const aJourAvecDoc = localesAvant.empreinte === reporteesAvant.empreinte;
    const base = aJourAvecDoc ? null : baseDe(chantier);
    const surLaBase = Boolean(base?.revision) && comparer(idsLocaux(), base.fichiers).egal;
    if (surLaBase) avantDoc = base.revision;
    if (!aJourAvecDoc && !surLaBase) {
      refuser(
        'les notes locales ne sont pas celles de la dernière livraison',
        `Notes locales   : ${localesAvant.empreinte.slice(0, 16)} (${localesAvant.fichiers.length} fichiers)`,
        `Notes reportées : ${String(reporteesAvant.empreinte).slice(0, 16)} (${reporteesAvant.fichiers.length} fichiers)`,
        '',
        "⚠️ Rafraîchir recopie les notes du worktree documentaire PAR-DESSUS les",
        'notes locales, suppressions comprises : tout ce qui n’a pas été livré',
        'serait perdu. Rien n’a été touché.',
        '',
        `Livrer d'abord : node scripts/chantier.mjs livrer --chantier ${nom}`
      );
    }

    /* ---------------------------- la référence locale doit être celle du distant */
    const brancheRef = git(depotDoc, 'rev-parse', '--abbrev-ref', 'HEAD');
    if (brancheRef !== source) {
      refuser(
        `le dépôt documentaire n’est pas sur ${source}`,
        `Chemin : ${depotDoc}`,
        `Trouvé : ${brancheRef}`,
        "C'est le répertoire de référence : il doit rester sur sa branche."
      );
    }
    if (!estPropre(depotDoc)) {
      refuser(
        'le dépôt documentaire porte des modifications non commitées',
        `Chemin : ${depotDoc}`,
        "⚠️ Ce répertoire n'est pas un espace de travail : rien n'a à y être édité",
        'à la main. Trancher ces modifications avant de continuer.'
      );
    }
    if (gitOuNull(depotDoc, 'fetch', 'origin', source) === null) {
      refuser(
        'la sauvegarde distante est injoignable',
        `Dépôt documentaire : ${depotDoc}`,
        '',
        `Sans \`fetch\`, on ne sait pas si ${source} est à jour : rafraîchir depuis une`,
        'référence en retard donnerait une base périmée en croyant la remettre à niveau.',
        "Rien n'a été fait. Réessayer une fois la connexion revenue."
      );
    }
    const refLocale = git(depotDoc, 'rev-parse', source);
    const refDistante = git(depotDoc, 'rev-parse', `origin/${source}`);
    if (refLocale !== refDistante) {
      if (gitOuNull(depotDoc, 'merge', '--ff-only', `origin/${source}`) === null) {
        refuser(
          `${source} local et origin/${source} ont divergé`,
          `local   : ${refLocale.slice(0, 7)}`,
          `distant : ${refDistante.slice(0, 7)}`,
          '',
          'La référence locale ne peut pas être avancée en avance rapide : un',
          `\`integrer\` a été fait ici sans push confirmé, ou le distant a été réécrit.`,
          `Trancher à la main dans ${depotDoc} (un \`integrer\` relancé retente le push).`
        );
      }
      dire(`Référence ${source} avancée : ${refLocale.slice(0, 7)} → ${refDistante.slice(0, 7)} (origin).`);
    }
    refSource = git(depotDoc, 'rev-parse', source);
    refuserCollisions(inventaireGit(depotDoc, refSource).fichiers, `${source} @ ${court(refSource)}`);

    /* --------------------------------------------- fusion dans la branche du chantier */
    const dejaAJour = estAncetre(worktreeDoc, refSource, infoDoc.tete);
    if (dejaAJour && aJourAvecDoc) {
      dire(`${VERT}Déjà à jour.${FIN} ${brancheDoc} contient ${source} @ ${refSource.slice(0, 7)} — aucun commit.`);
      return;
    }
    if (dejaAJour) {
      apresDoc = infoDoc.tete;
      dire(`${JAUNE}La branche contient déjà ${source}${FIN}, mais les notes locales n'ont pas reçu sa tête :` +
        ' recopie sans nouvelle fusion.');
    }
  }

  if (!apresDoc) {
    // ⚠️ Même contrainte qu'`integrer` : `git merge` ne lit pas `-F -`, d'où un
    // fichier de message. `--no-ff` : le rafraîchissement doit se VOIR dans
    // l'historique de la branche, avec sa révision de départ.
    const cheminMessage = join(resolve(worktreeDoc, git(worktreeDoc, 'rev-parse', '--git-dir')), 'MERGE_MSG_CHANTIER');
    writeFileSync(
      cheminMessage,
      `Rafraîchissement du chantier ${nom} depuis ${source} ${refSource.slice(0, 7)}\n\n` +
        `${source} → ${brancheDoc}, par \`chantier rafraichir\`.\n`
    );
    try {
      git(worktreeDoc, 'merge', '--no-ff', '-F', cheminMessage, refSource);
    } catch {
      const conflits = (gitOuNull(worktreeDoc, 'diff', '--name-only', '--diff-filter=U') || '')
        .split('\n')
        .filter(Boolean);
      gitOuNull(worktreeDoc, 'merge', '--abort');
      rmSync(cheminMessage, { force: true });
      // ⚠️ `merge --abort` rend un arbre identique POUR GIT, pas octet pour
      // octet : sous Windows, les fichiers que la fusion a touchés reviennent
      // en CRLF (`core.autocrlf`), et `verifier` verrait des notes reportées
      // différentes des notes locales. Les notes du code sont, par la
      // précondition d'entrée, exactement l'état d'avant : on le remet. Puis
      // `add` : `git status` déclare modifié un fichier dont la TAILLE a changé
      // sans comparer son contenu (LF vs CRLF) ; `add` le rehache, constate le
      // même blob, et remet l'index d'aplomb sans rien changer.
      // Si les notes locales ne valaient que la BASE (pas la tête), c'est la
      // tête que git restaure.
      if (avantDoc === infoDoc.tete) copierMiroir(notesCode, notesDoc);
      else gitOuNull(worktreeDoc, 'checkout', 'HEAD', '--', CHEMIN_NOTES);
      gitOuNull(worktreeDoc, 'add', '-A', CHEMIN_NOTES);
      refuser(
        `la fusion de ${source} dans la branche du chantier est en CONFLIT`,
        ...(conflits.length ? ['Fichiers en conflit :', ...conflits.map((f) => `  · ${f}`)] : []),
        '',
        `⚠️ La fusion a été ANNULÉE : ${brancheDoc} est resté à ${infoDoc.tete.slice(0, 7)},`,
        'les notes locales sont intactes.',
        '',
        'Marche à suivre, dans le worktree DOCUMENTAIRE (pas dans le code) :',
        `  git -C "${worktreeDoc}" merge ${source}     # résoudre à la main, puis committer`,
        `  node scripts/chantier.mjs rafraichir --chantier ${nom}   # recopie et enregistre`
      );
    }
    rmSync(cheminMessage, { force: true });
    apresDoc = git(worktreeDoc, 'rev-parse', 'HEAD');
  }

  /* ------------------------------------------------- copie miroir vers le code */
  // ⚠️ Journal AVANT la copie, et la base comme la révision attendue
  // n'avancent qu'APRÈS la copie complète et son contrôle d'égalité
  // (`terminerCopieVersCode`) — jamais à la reconnaissance d'une fusion.
  const reporteesApres = empreinteArbre(notesDoc);
  chantier.journal = {
    operation: 'rafraichir',
    cible: apresDoc,
    etatInitial: localesAvant.blobs,
    etatAttendu: { empreinte: reporteesApres.empreinte, fichiers: reporteesApres.blobs },
    // ⚠️ Enregistré AVEC l'empreinte du reçu qu'il prolonge : `verifier` ne
    // reconnaît un rafraîchissement que si le reçu n'a pas changé depuis.
    rafraichissement: {
      source,
      refSource,
      avant: avantDoc,
      apres: apresDoc,
      empreinteAvant: localesAvant.empreinte,
      empreinteApres: reporteesApres.empreinte,
      empreinteRecu: chantier.dernierRecu?.empreinteNotes ?? null,
    },
    le: new Date().toISOString(),
  };
  ecrireChantier(depotCode, nom, chantier);
  copierMiroir(notesDoc, notesCode, { arret: 'pendant-copie-rafraichir' });
  const localesApres = empreinteArbre(notesCode);
  if (localesApres.empreinte !== reporteesApres.empreinte) {
    refuser(
      'la copie ne rend pas un contenu identique',
      `Notes locales   : ${localesApres.empreinte.slice(0, 16)} (${localesApres.fichiers.length} fichiers)`,
      `Notes reportées : ${reporteesApres.empreinte.slice(0, 16)} (${reporteesApres.fichiers.length} fichiers)`,
      `La branche documentaire est à ${apresDoc.slice(0, 7)} ; le registre n'a pas avancé, le journal est conservé.`
    );
  }
  terminerCopieVersCode(chantier);
  ecrireChantier(depotCode, nom, chantier);

  /* ------------------------------------------------------------------ sortie */
  const changements = (gitOuNull(worktreeDoc, 'diff', '--name-status', '--no-renames', avantDoc, apresDoc, '--', CHEMIN_NOTES) || '')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'))
    .map(([statut, chemin]) => ({ statut, chemin: chemin.slice(CHEMIN_NOTES.length + 1) }));
  const par = (s) => changements.filter((c) => c.statut === s).map((c) => c.chemin);
  const ajoutes = par('A');
  const modifies = par('M');
  const supprimes = par('D');

  dire(`${VERT}Rafraîchi.${FIN} ${brancheDoc} : ${avantDoc.slice(0, 7)} → ${apresDoc.slice(0, 7)} (${source} @ ${refSource.slice(0, 7)})`);
  dire(`  ajoutés   : ${ajoutes.length}${ajoutes.length ? ' — ' + ajoutes.join(', ') : ''}`);
  dire(`  modifiés  : ${modifies.length}${modifies.length ? ' — ' + modifies.join(', ') : ''}`);
  dire(`  supprimés : ${supprimes.length}${supprimes.length ? ' — ' + supprimes.join(', ') : ''}`);
  dire(`  notes     : ${localesApres.fichiers.length} fichiers · ${localesApres.empreinte.slice(0, 16)}…`);
  dire('');
  dire(
    `Le reçu précédent reste valide pour le code qu'il désigne ; un \`livrer\`` +
      ` ultérieur part de cette base (${apresDoc.slice(0, 7)}).`
  );
}

/* --------------------------------------------------------------------------
 * Entrée
 * ----------------------------------------------------------------------- */

// Lecture seule pour les hooks : les règles métier restent dans cet outil.
function contexteHooks() {
  const depotCode = racineCode();
  const commun = resolve(depotCode, git(depotCode, 'rev-parse', '--git-common-dir'));
  const registre = join(commun, 'forge', 'etat', 'chantiers');
  const normaliser = (p) => process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p);
  const ouverts = existsSync(registre) ? readdirSync(registre).filter(n => n.endsWith('.json'))
    .map(n => JSON.parse(readFileSync(join(registre, n), 'utf8'))).filter(c => !c.fermeLe) : [];
  const candidats = ouverts.filter(c => normaliser(c.depotCode) === normaliser(depotCode));
  if (candidats.length > 1) refuser('plusieurs chantiers ouverts dans le même worktree');
  if (!candidats.length) { dire(JSON.stringify({ actif: false })); return; }
  const chantier = candidats[0];
  controlerIdentite(depotCode, chantier);
  const inst = etatInstallation(depotCode);
  if (!inst.presente || inst.alterations.length) refuser('installation commune absente ou altérée');
  const hooks = gitOuNull(depotCode, 'config', 'core.hooksPath');
  if (!hooks || normaliser(resolve(depotCode, hooks)) !== normaliser(join(inst.installation, 'hooks'))) {
    refuser('le hook Git commun n’est pas câblé');
  }
  // Un contrôle d'accès en lecture, sans exiger un reçu ou un arbre propre en cours de travail.
  git(chantier.worktreeDoc, 'rev-parse', 'HEAD');
  const notes = empreinteArbre(notesDuCode(depotCode)).empreinte;
  const empreinte = createHash('sha256').update(JSON.stringify([
    git(depotCode, 'rev-parse', 'HEAD'), git(depotCode, 'status', '--porcelain'),
    git(depotCode, 'diff', 'HEAD', '--binary'), notes,
    git(depotCode, 'ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
      .map(p => [p, empreinteFichier(join(depotCode, p))]),
  ])).digest('hex');
  dire(JSON.stringify({ actif: true, nom: chantier.nom, depotCode, branche: chantier.brancheCode,
    empreinte, propre: estPropre(depotCode), commun,
    contributions: ouverts.filter(c => c.nom !== chantier.nom).map(c => ({ nom: c.nom, depotCode: c.depotCode })),
  }));
}

// Drapeaux SANS valeur : leur présence suffit, ils ne consomment pas
// l'argument suivant (`--adopter --chantier x` doit garder `--chantier x`).
const DRAPEAUX = new Set(['adopter', 'simulation']);

function lireOptions(argv) {
  const options = {};
  const restes = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [cle, valeurCollee] = a.slice(2).split('=');
      options[cle] = DRAPEAUX.has(cle) ? true : valeurCollee ?? argv[++i];
    } else {
      restes.push(a);
    }
  }
  return { options, restes };
}

const { options, restes } = lireOptions(process.argv.slice(2));
const commande = restes[0];
const nom = options.chantier;

if (commande === 'contexte-hooks') {
  contexteHooks();
  process.exit(0);
}

if (!commande || options.aide || options.help) {
  dire(`${GRAS}chantier${FIN} — livraison vérifiée des notes privées

  node scripts/chantier.mjs ouvrir    --chantier <nom> [--depot-doc <chemin>] [--base <rév>] [--adopter]
  node scripts/chantier.mjs livrer    --chantier <nom> [--adopter] [--simulation]
  node scripts/chantier.mjs verifier  --chantier <nom>
  node scripts/chantier.mjs integrer  --chantier <nom> [--integrer-dans <branche doc>]
  node scripts/chantier.mjs rafraichir --chantier <nom> [--depuis <branche doc>]
  node scripts/chantier.mjs fermer    --chantier <nom> [--integre-dans <ref>] [--archive]

  integrer POUSSE les notes du chantier vers le main documentaire ;
  rafraichir les TIRE du main documentaire vers le chantier (fusion dans sa
  branche, puis copie miroir vers le code). Il refuse si les notes locales ne
  sont pas celles de la dernière livraison : livrer d'abord, rien n'est écrasé.

  ouvrir remplace des notes locales EN RETARD sur la base (après sauvegarde)
  et refuse des notes inconnues ; livrer refuse tant que la branche
  documentaire porte ce que les notes locales n'ont pas reçu. --adopter lève
  ces deux refus en connaissance de cause ; livrer --simulation n'écrit rien.
  node scripts/chantier.mjs installer [--sans-cablage] [--codex-hooks <hooks.json personnel>]
  node scripts/chantier.mjs contexte-hooks

⚠️ Les commandes courantes s'appellent depuis l'INSTALLATION commune, jamais
depuis scripts/ du worktree — sinon leur contenu dépend de la branche
checkoutée. Voir spec/chantiers/orchestration-parallele.md, §2.4 et §4.`);
  process.exit(commande ? 0 : 1);
}

if (commande === 'installer') {
  installer(options);
  process.exit(0);
}

if (!nom) refuser('aucun chantier désigné', 'Ajouter --chantier <nom>.');
if (options.simulation && commande !== 'livrer') {
  refuser('--simulation ne vaut que pour livrer', `Commande : ${commande} — rien n'a été fait.`);
}

switch (commande) {
  case 'ouvrir':
    ouvrir(nom, options);
    break;
  case 'livrer':
    livrer(nom, options);
    break;
  case 'verifier':
    verifier(nom);
    break;
  case 'integrer':
    integrer(nom, options);
    break;
  case 'rafraichir':
    rafraichir(nom, options);
    break;
  case 'fermer':
    fermer(nom, options);
    break;
  default:
    refuser(
      `commande inconnue : ${commande}`,
      'Connues : ouvrir, livrer, verifier, integrer, rafraichir, fermer, installer.'
    );
}
