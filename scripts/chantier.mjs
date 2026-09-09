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

function controlerWorktreeDoc(depotCode, chantier) {
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
    // ⚠️ **Reprise après interruption, et elle doit se PROUVER.** Une coupure
    // entre le commit des notes et l'écriture du registre laisse une révision
    // attendue en retard : refuser là serait bloquer le chantier sur un commit
    // que l'outil a fait lui-même. On n'adopte la tête que si les trois
    // conditions tiennent — un marqueur de livraison en cours, une avance
    // linéaire depuis la révision attendue, et des commits qui ne touchent
    // QUE les notes et les reçus. Tout le reste reste un refus.
    const marqueur = chantier.livraisonEnCours;
    const descend =
      gitOuNull(worktreeDoc, 'merge-base', '--is-ancestor', revisionDocAttendue, tete) !== null;
    const touches = descend
      ? (gitOuNull(worktreeDoc, 'diff', '--name-only', `${revisionDocAttendue}..${tete}`) || '')
          .split('\n')
          .filter(Boolean)
      : [];
    const seulementNotres =
      touches.length > 0 &&
      touches.every((f) => f.startsWith(`${CHEMIN_NOTES}/`) || f.startsWith(`${DOSSIER_RECUS}/`));

    if (marqueur && descend && seulementNotres && marqueur.depuis === revisionDocAttendue) {
      dire(
        `${JAUNE}Reprise d'une livraison interrompue${FIN} : la branche documentaire porte` +
          ` ${touches.length} fichier(s) déjà reportés (${revisionDocAttendue.slice(0, 7)} → ${tete.slice(0, 7)}).`
      );
      chantier.revisionDocAttendue = tete;
      ecrireChantier(depotCode, chantier.nom, chantier);
      return tete;
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
      marqueur
        ? "Une livraison interrompue est enregistrée, mais l'avance ne lui correspond pas"
        : "Aucune livraison interrompue enregistrée : cette avance vient d'ailleurs.",
      touches.length ? `Fichiers touchés : ${touches.slice(0, 5).join(', ')}` : ''
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
  controlerIdentite(depotCode, chantier);

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
  controlerWorktreeDoc(depotCode, chantier);

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
    // ⚠️ Marqueur écrit AVANT le commit : c'est lui qui permettra de PROUVER,
    // après une coupure, que l'avance de la branche documentaire vient de nous.
    chantier.livraisonEnCours = { depuis: git(worktreeDoc, 'rev-parse', 'HEAD') };
    ecrireChantier(depotCode, nom, chantier);

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
    if (process.env.CHANTIER_ARRET_TEST === 'apres-commit-notes') {
      dire(`${JAUNE}[test] arrêt volontaire entre le commit des notes et le registre${FIN}`);
      process.exit(70);
    }

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
    }
  }

  chantier.revisionDocAttendue = git(worktreeDoc, 'rev-parse', 'HEAD');
  chantier.dernierRecu = recu;
  // La livraison est allée à son terme : le marqueur de reprise n'a plus de
  // raison d'être, et le laisser autoriserait une adoption qu'on ne veut plus.
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

const FICHIERS_INSTALLES = ['scripts/chantier.mjs', 'scripts/hooks-codex.mjs'];
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

  // ⚠️ Joignabilité contrôlée AVANT la fusion, pas après. L'invariant qu'on
  // veut est « intégré ⇒ sauvegardé » : fusionner puis découvrir qu'on ne peut
  // pas pousser laisserait la référence avancée localement et nulle part
  // ailleurs — exactement l'état que tout ce dispositif existe pour éviter.
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

  if (gitOuNull(depotDoc, 'merge-base', '--is-ancestor', teteChantier, avant) !== null) {
    dire(`${JAUNE}Déjà intégré${FIN} — ${cible} contient ${teteChantier.slice(0, 7)}.`);
    return;
  }

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
    git(depotDoc, 'merge', '--no-ff', '-F', cheminMessage, brancheDoc);
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
  git(depotDoc, 'push', 'origin', cible);

  chantier.integrations = [
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

if (commande === 'contexte-hooks') {
  contexteHooks();
  process.exit(0);
}

if (!commande || options.aide || options.help) {
  dire(`${GRAS}chantier${FIN} — livraison vérifiée des notes privées

  node scripts/chantier.mjs ouvrir    --chantier <nom> [--depot-doc <chemin>]
  node scripts/chantier.mjs livrer    --chantier <nom>
  node scripts/chantier.mjs verifier  --chantier <nom>
  node scripts/chantier.mjs integrer  --chantier <nom> [--integrer-dans <branche doc>]
  node scripts/chantier.mjs fermer    --chantier <nom> [--integre-dans <ref>] [--archive]
  node scripts/chantier.mjs installer [--sans-cablage] [--codex-hooks <hooks.json personnel>]
  node scripts/chantier.mjs contexte-hooks

⚠️ Les commandes courantes s'appellent depuis l'INSTALLATION commune, jamais
depuis scripts/ du worktree — sinon leur contenu dépend de la branche
checkoutée. Voir CADRAGE-orchestration-parallele.md, §2.4 et §4.`);
  process.exit(commande ? 0 : 1);
}

if (commande === 'installer') {
  installer(options);
  process.exit(0);
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
  case 'integrer':
    integrer(nom, options);
    break;
  case 'fermer':
    fermer(nom, options);
    break;
  default:
    refuser(
      `commande inconnue : ${commande}`,
      'Connues : ouvrir, livrer, verifier, integrer, fermer, installer.'
    );
}
