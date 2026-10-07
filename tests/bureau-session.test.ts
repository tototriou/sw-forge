// La session en cours de l'application de bureau (bureau/sessionPur.ts).
//
// ⚠️ Ce module décide quel fichier de l'utilisateur est réécrit, et comment :
// un chemin mal relu écrirait ailleurs, un texte mal vérifié écrirait autre
// chose qu'une session, une écriture interrompue laisserait une sauvegarde
// à moitié écrite à la place de la bonne.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  avecExtension,
  cheminLibre,
  cheminSessionValide,
  dossierSessions,
  ecrireSansRisque,
  etatDe,
  FORMAT_FICHIER_SESSION,
  lireDossierRetenu,
  lireSessionRetenue,
  messageEchec,
  nomProposeValide,
  texteSessionValide,
} from '../bureau/sessionPur';
import { presentationDossierSwblacksmith } from '../src/components/SettingsMenu';
import { FORMAT_SESSION, nomFichierSession } from '../src/lib/session';
import { egal, ok, titre } from './outils';

export default async function testBureauSession() {
  const racine = process.platform === 'win32' ? 'C:\\Users\\Moi\\Documents' : '/home/moi/Documents';
  const session = join(racine, 'ma-session.json');

  titre('bureau · session en cours — le format concorde avec la page');
  egal(FORMAT_FICHIER_SESSION, FORMAT_SESSION, 'le format vérifié par le bureau est celui que la page écrit');

  titre('bureau · session en cours — ce que la page voit');
  egal(etatDe(null, null), { chemin: null, nom: null, dossier: null }, 'aucune session en cours, aucun dossier');
  egal(etatDe(session, racine), { chemin: session, nom: 'ma-session.json', dossier: racine }, 'le nom est celui du fichier');

  titre('bureau · session en cours — le dossier SW Blacksmith');
  egal(lireDossierRetenu(null), null, 'jamais choisi : rien');
  egal(lireDossierRetenu({ dossier: racine }), racine, 'un chemin absolu : repris');
  egal(lireDossierRetenu({ dossier: 'Documents' }), null, 'un chemin relatif : refusé');
  egal(lireDossierRetenu({ dossier: null }), null, 'retiré : rien');
  egal(dossierSessions(racine), join(racine, 'sessions'), 'les sessions vont dans son sous-dossier « sessions »');
  ok(presentationDossierSwblacksmith(null).includes('sous-dossier « sessions »'), 'Paramètres, sans dossier : ce qu’il sert à faire');
  egal(presentationDossierSwblacksmith(etatDe(null, racine)), racine, 'Paramètres, avec : le chemin');
  const pris = new Set([join(racine, 'a.json'), join(racine, 'a (2).json')]);
  egal(cheminLibre(racine, 'b.json', (c) => pris.has(c)), join(racine, 'b.json'), 'nom libre : tel quel');
  egal(cheminLibre(racine, 'a.json', (c) => pris.has(c)), join(racine, 'a (3).json'), 'nom pris : le premier numéro libre, jamais d’écrasement');

  titre('bureau · session en cours — session.json relu avec méfiance');
  egal(lireSessionRetenue(null), null, 'premier lancement : rien');
  egal(lireSessionRetenue('abîmé'), null, 'fichier abîmé : rien');
  egal(lireSessionRetenue({ chemin: session }), session, 'un chemin absolu en .json : repris');
  egal(lireSessionRetenue({ chemin: 'ma-session.json' }), null, 'un chemin relatif : refusé');
  egal(lireSessionRetenue({ chemin: join(racine, 'notes.txt') }), null, 'un fichier qui n’est pas un .json : refusé');
  egal(lireSessionRetenue({ chemin: `${session}\0` }), null, 'un octet nul : refusé');
  ok(cheminSessionValide(join(racine, 'MA-SESSION.JSON')), 'l’extension, en capitales : acceptée');

  titre('bureau · session en cours — le nom proposé par la page');
  ok(nomProposeValide(nomFichierSession(new Date(2026, 9, 7, 14, 5))), 'le nom daté de la page');
  for (const mauvais of ['../session.json', 'sous/session.json', 'sous\\session.json', 'C:session.json', 'session.txt', '.json', '..json', 'a'.repeat(200) + '.json', 42])
    ok(!nomProposeValide(mauvais), `refusé : ${String(mauvais).slice(0, 30)}`);

  titre('bureau · session en cours — le texte à écrire');
  ok(texteSessionValide(JSON.stringify({ format: FORMAT_SESSION, version: 1 })), 'une session');
  ok(!texteSessionValide(JSON.stringify({ format: 'autre', version: 1 })), 'un autre format : refusé');
  ok(!texteSessionValide('{ pas du json'), 'pas du JSON : refusé');
  ok(!texteSessionValide(JSON.stringify([FORMAT_SESSION])), 'pas un objet : refusé');
  ok(!texteSessionValide(null), 'pas un texte : refusé');

  titre('bureau · session en cours — le nom rendu par « Sauvegarder sous »');
  egal(avecExtension(join(racine, 'sans-extension')), join(racine, 'sans-extension.json'), 'un nom sans extension prend .json');
  egal(avecExtension(session), session, 'un nom en .json ne change pas');

  titre('bureau · session en cours — le message d’échec');
  ok(messageEchec('ENOENT').includes('Sauvegarder sous'), 'dossier disparu : « Sauvegarder sous… » est la sortie');
  ok(messageEchec('ENOSPC') === 'Le disque est plein.', 'disque plein');
  ok(messageEchec('EINVAL') === 'L’écriture a échoué (EINVAL).', 'code inconnu : cité');
  ok(messageEchec(undefined) === 'L’écriture a échoué.', 'sans code : rien à citer');

  titre('bureau · session en cours — l’écriture ne laisse jamais un fichier à moitié écrit');
  const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-session-'));
  try {
    const cible = join(bac, 'session.json');
    await ecrireSansRisque(cible, 'premier');
    egal(readFileSync(cible, 'utf8'), 'premier', 'fichier neuf : écrit');
    await ecrireSansRisque(cible, 'second');
    egal(readFileSync(cible, 'utf8'), 'second', 'fichier existant : remplacé');
    egal(readdirSync(bac), ['session.json'], 'aucun fichier temporaire laissé');

    const absent = join(bac, 'disparu', 'session.json');
    let code: unknown = null;
    try {
      await ecrireSansRisque(absent, 'x');
    } catch (e) {
      code = (e as NodeJS.ErrnoException).code;
    }
    egal(code, 'ENOENT', 'dossier disparu : l’erreur remonte avec son code');
    ok(!existsSync(join(bac, 'disparu')), 'et rien n’est créé');

    // Le renommage échoue (la cible est un dossier non vide) : la cible reste
    // telle quelle, et le temporaire disparaît.
    const bloque = join(bac, 'bloque.json');
    mkdirSync(bloque);
    writeFileSync(join(bloque, 'dedans.txt'), 'intact');
    let echoue = false;
    try {
      await ecrireSansRisque(bloque, 'nouveau');
    } catch {
      echoue = true;
    }
    ok(echoue, 'renommage impossible : l’écriture échoue');
    egal(readdirSync(bac).sort(), ['bloque.json', 'session.json'], 'le temporaire est retiré après l’échec');
    egal(readFileSync(join(bloque, 'dedans.txt'), 'utf8'), 'intact', 'la cible n’a pas bougé');
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
}
