// Le protocole maison de l'application de bureau — chantier application-bureau,
// lot 1 (spec/chantiers/application-bureau.md).
//
// ⚠️ **Pourquoi pas `file://`.** L'app lit `import.meta.env.BASE_URL` (`/`) à
// 19 endroits et charge ses données par `fetch` (`/data/monsters.json`) : sous
// `file://`, « / » désignerait la racine du DISQUE. Servie par
// `app://swblacksmith/`, l'app retrouve une racine à elle — et une ORIGINE
// stable, sous laquelle vivent son stockage et ses workers.
//
// Ce module est PUR (aucun import d'Electron) : il est testé sans lancer l'app
// (`tests/bureau-protocole.test.ts`).

import { isAbsolute, join, normalize, relative } from 'node:path';

export const SCHEMA = 'app';
export const HOTE = 'swblacksmith';
export const URL_ACCUEIL = `${SCHEMA}://${HOTE}/index.html`;

// Le fichier de `racine` (le build, `dist/`) que sert une URL du protocole, ou
// `null` si elle n'en désigne aucun.
//
// ⚠️ **Rien hors de la racine, jamais.** Une page ne doit pas pouvoir lire
// `package.json`, ni un fichier de l'utilisateur, en forgeant une adresse : les
// `..`, y compris ENCODÉS (`%2e%2e`, `%5c`), sont résolus PUIS confrontés à la
// racine — c'est le chemin final qui décide, pas l'allure de l'URL.
export function cheminDuFichier(url: string, racine: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== `${SCHEMA}:` || u.host !== HOTE) return null;
  let chemin: string;
  try {
    chemin = decodeURIComponent(u.pathname);
  } catch {
    return null; // encodage invalide (`%E0%A4%A`)
  }
  if (chemin.includes('\0')) return null;
  if (chemin === '' || chemin === '/') chemin = '/index.html';
  const base = normalize(racine);
  const cible = normalize(join(base, chemin));
  const rel = relative(base, cible);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  return cible;
}
