// Le protocole `app://swblacksmith/` de l'application de bureau — chantier
// application-bureau, lot 1 (bureau/protocole.ts).
//
// ⚠️ C'est la frontière entre la page et le disque : une adresse forgée qui
// sortirait du build donnerait à la page la lecture de n'importe quel fichier
// de l'utilisateur. Chaque forme connue d'évasion est essayée ici.

import { join, normalize, sep } from 'node:path';
import { cheminDuFichier, estAdresseInterne, ouvrableDehors, URL_ACCUEIL } from '../bureau/protocole';
import { egal, ok, titre } from './outils';

export default function testBureauProtocole() {
  titre('bureau · protocole app:// — ce qui est servi');
  const racine = normalize(join('C:', 'appli', 'dist'));
  egal(URL_ACCUEIL, 'app://swblacksmith/index.html', 'l’adresse de l’accueil');
  egal(cheminDuFichier('app://swblacksmith/', racine), join(racine, 'index.html'), 'la racine sert index.html');
  egal(cheminDuFichier('app://swblacksmith/index.html#/siege/defense', racine), join(racine, 'index.html'), 'le hash ne compte pas (routage par hash)');
  egal(cheminDuFichier('app://swblacksmith/data/monsters.json', racine), join(racine, 'data', 'monsters.json'), 'les données du jeu');
  egal(cheminDuFichier('app://swblacksmith/data/skills/14013.json?v=2', racine), join(racine, 'data', 'skills', '14013.json'), 'la requête ne compte pas');
  egal(cheminDuFichier('app://swblacksmith/assets/Nom%20avec%20espace.js', racine), join(racine, 'assets', 'Nom avec espace.js'), 'un nom encodé est décodé');

  titre('bureau · protocole app:// — rien hors du build');
  for (const [url, quoi] of [
    ['app://swblacksmith/../package.json', '`..` en clair'],
    ['app://swblacksmith/%2e%2e/package.json', '`..` encodé'],
    ['app://swblacksmith/%2E%2E%2Fpackage.json', '`../` encodé d’un bloc'],
    ['app://swblacksmith/data/%2e%2e/%2e%2e/package.json', '`..` encodé au milieu'],
    ['app://swblacksmith/..%5c..%5cWindows%5cwin.ini', 'antislash encodé'],
    ['app://swblacksmith/C:%5cWindows%5cwin.ini', 'chemin absolu encodé'],
    ['app://swblacksmith/a%00.js', 'octet nul'],
    ['app://swblacksmith/%E0%A4%A', 'encodage invalide'],
    ['app://autrehote/index.html', 'autre hôte'],
    ['file:///C:/Windows/win.ini', 'autre protocole'],
    ['pas une url', 'adresse illisible'],
  ] as const) {
    // Le seul critère : RIEN au-dehors de la racine. (`..` en clair est déjà
    // résolu par l'analyse de l'URL — `/package.json` reste DANS le build.)
    const r = cheminDuFichier(url, racine);
    ok(r === null || r.startsWith(racine + sep), `pas d’évasion : ${quoi} (${url}) → ${r ?? 'refusé'}`);
  }
  // ⚠️ `%2e%2e` seul est déjà résolu par l'analyse de l'URL (la norme le lit
  // comme `..`) : il retombe DANS le build. La forme que la fonction doit
  // refuser elle-même, c'est le `..` dont la BARRE est encodée — l'analyseur
  // n'y voit qu'un nom de fichier, le décodage en fait une remontée.
  egal(cheminDuFichier('app://swblacksmith/..%2Fpackage.json', racine), null, '`..` + barre encodée : refusé par la fonction');
  egal(cheminDuFichier('app://swblacksmith/..%5Cpackage.json', racine), null, '`..` + antislash encodé : refusé par la fonction');

  titre('bureau · navigation (lot 2) — ce qui reste dans l’app');
  ok(estAdresseInterne('app://swblacksmith/index.html#/siege/defense'), 'une page de l’app');
  ok(estAdresseInterne('http://localhost:5173/#/rta', 'http://localhost:5173/'), 'en dev : le serveur Vite');
  ok(!estAdresseInterne('http://localhost:5174/', 'http://localhost:5173/'), 'en dev : un AUTRE port n’est pas l’app');
  ok(!estAdresseInterne('http://localhost:5173/'), 'hors dev : localhost n’est pas l’app');
  ok(!estAdresseInterne('app://autrehote/index.html'), 'autre hôte du protocole : pas l’app');
  ok(!estAdresseInterne('file:///C:/Users/moi/compte.json'), 'un fichier déposé : pas l’app');

  titre('bureau · navigation (lot 2) — ce qui part au navigateur');
  ok(ouvrableDehors('https://swarfarm.com'), 'https');
  ok(ouvrableDehors('http://exemple.fr'), 'http');
  for (const url of ['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'ms-settings:', 'mailto:a@b.c', 'app://swblacksmith/', 'pas une url'])
    ok(!ouvrableDehors(url), `jamais confié au système : ${url}`);
}
