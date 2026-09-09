#!/usr/bin/env node
// Livraison vérifiée des notes privées d'un chantier.
//
// ⚠️ **Pourquoi cet outil existe.** `spec/outils/optimizer/` est gitignoré
// (protection compétitive) : ces fichiers n'ont donc ni historique, ni merge,
// ni conflit détecté. Tant que le report vers le dépôt documentaire restait une
// case à cocher en fin de chantier, il était une étape oubliée — faite par un
// agent qui a déjà « fini », sur des fichiers qu'aucun hook ne voit.
//
// Cadrage complet : `CADRAGE-orchestration-parallele.md`, §4.
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

function empreinteArbre(racine) {
  const fichiers = listerFichiers(racine).sort();
  const h = createHash('sha256');
  for (const rel of fichiers) {
    h.update(rel, 'utf8');
    h.update('\0');
    h.update(readFileSync(join(racine, rel)));
    h.update('\0');
  }
  return { empreinte: h.digest('hex'), fichiers };
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

function copierMiroir(source, cible) {
  mkdirSync(cible, { recursive: true });
  const voulus = new Set(listerFichiers(source));
  const presents = existsSync(cible) ? listerFichiers(cible) : [];

  for (const rel of presents) {
    if (!voulus.has(rel)) rmSync(join(cible, rel));
  }
  for (const rel of voulus) {
    const dest = join(cible, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(source, rel), dest);
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

function controlerWorktreeDoc(chantier) {
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
    refuser(
      'la branche documentaire a avancé indépendamment',
      `Attendue : ${revisionDocAttendue}`,
      `Trouvée  : ${tete}`,
      '',
      "⚠️ Le répertoire est propre, et c'est justement le piège : un commit fait",
      "de l'autre côté ne laisse aucune trace dans le répertoire de travail. Sans",
      'cette vérification, le report écraserait ce travail en silence.'
    );
  }
  return tete;
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
  if (!config || config.depotDocumentaire !== depotDoc) {
    config = { depotDocumentaire: depotDoc, cheminNotes: CHEMIN_NOTES };
    ecrireConfig(depotCode, config);
  }

  if (existsSync(cheminChantier(depotCode, nom))) {
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

  const base = options.base || git(depotDoc, 'rev-parse', 'HEAD');
  mkdirSync(dirname(worktreeDoc), { recursive: true });
  git(depotDoc, 'worktree', 'add', '-b', brancheDoc, worktreeDoc, base);
  git(depotDoc, 'worktree', 'lock', worktreeDoc);

  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  const notesCode = join(depotCode, ...CHEMIN_NOTES.split('/'));

  if (!existsSync(notesCode)) {
    copierMiroir(notesDoc, notesCode);
    dire(`Notes copiées depuis la révision ${base.slice(0, 7)}.`);
  } else {
    const ici = empreinteArbre(notesCode).empreinte;
    const la = empreinteArbre(notesDoc).empreinte;
    if (ici !== la) {
      dire(
        `${JAUNE}Les notes locales diffèrent de la base documentaire${FIN} — elles sont` +
          ' CONSERVÉES telles quelles, et seront reportées au prochain `livrer`.'
      );
    } else {
      dire('Notes locales déjà identiques à la base documentaire.');
    }
  }

  const chantier = {
    nom,
    depotCode,
    brancheCode: git(depotCode, 'rev-parse', '--abbrev-ref', 'HEAD'),
    depotDoc,
    brancheDoc,
    worktreeDoc,
    revisionDocBase: git(worktreeDoc, 'rev-parse', 'HEAD'),
    revisionDocAttendue: git(worktreeDoc, 'rev-parse', 'HEAD'),
    ouvertLe: new Date().toISOString(),
  };
  ecrireChantier(depotCode, nom, chantier);

  dire(`${VERT}Chantier « ${nom} » ouvert.${FIN}`);
  dire(`  branche documentaire : ${brancheDoc}`);
  dire(`  worktree documentaire : ${worktreeDoc} ${GRAS}(verrouillé)${FIN}`);
}

function nom_depot(chemin) {
  const parts = resolve(chemin).split(sep).filter(Boolean);
  return parts[parts.length - 1];
}

/* --------------------------------------------------------------------------
 * livrer
 * ----------------------------------------------------------------------- */

function livrer(nom) {
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);

  if (!estPropre(depotCode)) {
    refuser(
      'le dépôt de code porte des modifications non commitées',
      'Un reçu associe les notes à un COMMIT de code précis : livrer maintenant',
      "l'associerait à un état qui n'existe dans aucun commit.",
      '',
      'Committer le code, puis relancer.'
    );
  }

  const notesCode = notesDuCode(depotCode);
  controlerWorktreeDoc(chantier);

  const { worktreeDoc } = chantier;
  const notesDoc = join(worktreeDoc, ...CHEMIN_NOTES.split('/'));
  copierMiroir(notesCode, notesDoc);

  // Contrôle d'égalité APRÈS report : la copie n'est pas supposée fidèle, elle
  // est vérifiée fidèle.
  const avant = empreinteArbre(notesCode);
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
  if (git(worktreeDoc, 'status', '--porcelain') !== '') {
    gitAvecEntree(
      worktreeDoc,
      ['commit', '-F', '-'],
      `Notes du chantier ${nom} — code ${commitCode.slice(0, 7)}\n\n` +
        `Report automatique par \`chantier livrer\`.\n` +
        `Empreinte des notes : ${apres.empreinte}\n` +
        `${apres.fichiers.length} fichiers.\n`
    );
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
    }
  }

  chantier.revisionDocAttendue = git(worktreeDoc, 'rev-parse', 'HEAD');
  chantier.dernierRecu = recu;
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

function verifier(nom) {
  const depotCode = racineCode();
  const chantier = lireChantier(depotCode, nom);
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
  ajouter(
    'les notes actuelles sont celles du reçu',
    empreinteActuelle.empreinte === recu.empreinteNotes,
    `${empreinteActuelle.fichiers.length} fichiers · ${empreinteActuelle.empreinte.slice(0, 16)}…`
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

  dire(`${GRAS}Chantier « ${nom} »${FIN}`);
  for (const c of controles) {
    const marque = c.ok ? `${VERT}ok${FIN}` : `${ROUGE}KO${FIN}`;
    dire(`  ${marque}   ${c.libelle}${c.detail ? ` — ${c.detail}` : ''}`);
  }

  const echecs = controles.filter((c) => !c.ok);
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

  dire('');
  dire(`${VERT}Reçu valide.${FIN} code ${recu.commitCode.slice(0, 7)} ↔ notes ${recu.commitDoc.slice(0, 7)}`);
  dire(
    `${JAUNE}Ce que ce reçu NE dit PAS${FIN} : que toutes les notes utiles ont été` +
      ' écrites. Seulement que celles qui existent sont conservées et associées au bon code.'
  );
}

/* --------------------------------------------------------------------------
 * Entrée
 * ----------------------------------------------------------------------- */

function lireOptions(argv) {
  const options = {};
  const restes = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [cle, valeurCollee] = a.slice(2).split('=');
      options[cle] = valeurCollee ?? argv[++i];
    } else {
      restes.push(a);
    }
  }
  return { options, restes };
}

const { options, restes } = lireOptions(process.argv.slice(2));
const commande = restes[0];
const nom = options.chantier;

if (!commande || options.aide || options.help) {
  dire(`${GRAS}chantier${FIN} — livraison vérifiée des notes privées

  node scripts/chantier.mjs ouvrir   --chantier <nom> [--depot-doc <chemin>]
  node scripts/chantier.mjs livrer   --chantier <nom>
  node scripts/chantier.mjs verifier --chantier <nom>

Voir CADRAGE-orchestration-parallele.md, §4.`);
  process.exit(commande ? 0 : 1);
}

if (!nom) refuser('aucun chantier désigné', 'Ajouter --chantier <nom>.');

switch (commande) {
  case 'ouvrir':
    ouvrir(nom, options);
    break;
  case 'livrer':
    livrer(nom);
    break;
  case 'verifier':
    verifier(nom);
    break;
  default:
    refuser(`commande inconnue : ${commande}`, 'Connues : ouvrir, livrer, verifier.');
}
