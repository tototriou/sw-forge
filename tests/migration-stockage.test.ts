// Migration des clés de stockage `sw-forge-*` / `sky-arena-*` vers
// `swblacksmith-*` — décision 66 du rebranding
// (spec/chantiers/rebranding-blacksmith.md).
//
// ⚠️ Une migration qui perd une valeur ne se voit qu'une fois, au premier
// lancement après la mise à jour, chez l'utilisateur — et elle ne se rattrape
// pas. D'où des cas écrits pour chaque chemin, quota plein compris.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { migrerStockage, nouvelleCle, planMigration, PREFIXE_STOCKAGE } from '../src/lib/migrationStockage';
import { etatDepuisStockage } from '../src/hooks/usePersistence';
import { egal, ok, titre } from './outils';

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// Faux `Storage`, avec une capacité optionnelle en caractères (clés + valeurs)
// pour simuler un quota plein.
function fauxStockage(depart: Record<string, string>, capacite = Infinity) {
  const m = new Map(Object.entries(depart));
  const taille = () => [...m].reduce((s, [k, v]) => s + k.length + v.length, 0);
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      const avant = m.get(k);
      m.set(k, v);
      if (taille() > capacite) {
        if (avant === undefined) m.delete(k);
        else m.set(k, avant);
        throw new Error('QuotaExceededError');
      }
    },
    removeItem: (k: string) => void m.delete(k),
  };
}

export default function testMigrationStockage() {
  titre('migration du stockage · la règle');
  egal(PREFIXE_STOCKAGE, 'swblacksmith-', 'le nouveau préfixe');
  egal(nouvelleCle('sw-forge-siege-recos-v1'), 'swblacksmith-siege-recos-v1', 'sw-forge-… → swblacksmith-…');
  egal(nouvelleCle('sky-arena-rta-v1'), 'swblacksmith-rta-v1', 'la prépa RTA (sky-arena-…) → swblacksmith-rta-v1');
  egal(nouvelleCle('swblacksmith-theme-v1'), null, 'une clé déjà migrée ne bouge plus');
  egal(nouvelleCle('autre-site-cle'), null, 'une clé étrangère n’est jamais touchée');
  egal(
    planMigration(['sw-forge-theme-v1', 'swblacksmith-theme-v1', 'sw-forge-siege-defense-v1']).map((e) => `${e.de}:${e.action}`).join(' '),
    'sw-forge-siege-defense-v1:copier sw-forge-theme-v1:effacer',
    'nouvelle clé déjà là → elle fait foi, l’ancienne n’est qu’effacée',
  );

  titre('migration du stockage · un utilisateur existant');
  const prepa = '{"entries":{"x":{"note":"é ✓"}}}';
  const s = fauxStockage({
    'sky-arena-rta-v1': prepa,
    'sw-forge-siege-defense-v1': '{"teams":[1]}',
    'sw-forge-siege-recos-v1': '{"recos":[]}',
    'sw-forge-persist-v1': '1',
    'sw-forge-theme-v1': 'dark',
    'autre-site-cle': 'garde-moi',
  });
  const r = migrerStockage(s);
  egal(r.laissees.length, 0, 'aucune clé laissée en place');
  egal(s.m.get('swblacksmith-rta-v1'), prepa, 'la prépa RTA est recopiée à l’identique (accents compris)');
  egal(s.m.get('swblacksmith-siege-defense-v1'), '{"teams":[1]}', 'les équipes de siège');
  egal(s.m.get('swblacksmith-siege-recos-v1'), '{"recos":[]}', 'les recommandations');
  egal(s.m.get('swblacksmith-persist-v1'), '1', 'le consentement à la conservation');
  egal(s.m.get('swblacksmith-theme-v1'), 'dark', 'le thème');
  ok(![...s.m.keys()].some((k) => k.startsWith('sw-forge-') || k.startsWith('sky-arena-')), 'plus aucune ancienne clé');
  egal(s.m.get('autre-site-cle'), 'garde-moi', 'une clé étrangère est laissée intacte');
  egal(etatDepuisStockage(Object.fromEntries(s.m)), { actif: true, choisi: true }, 'après migration, la conservation reste active');

  const avant = JSON.stringify([...s.m]);
  migrerStockage(s);
  egal(JSON.stringify([...s.m]), avant, 'relancée, la migration ne change plus rien');

  titre('migration du stockage · la nouvelle clé fait foi');
  const double = fauxStockage({ 'sw-forge-theme-v1': 'light', 'swblacksmith-theme-v1': 'dark' });
  migrerStockage(double);
  egal(double.m.get('swblacksmith-theme-v1'), 'dark', 'la valeur déjà écrite sous le nouveau nom est gardée');
  egal(double.m.has('sw-forge-theme-v1'), false, 'le doublon périmé est effacé');

  titre('migration du stockage · quota plein');
  // Juste la place des données actuelles, plus 4 caractères : écrire la copie
  // AVANT d'effacer l'original ne tient pas, il faut libérer d'abord.
  const gros = 'x'.repeat(1000);
  const plein = fauxStockage({ 'sw-forge-siege-recos-v1': gros }, 'sw-forge-siege-recos-v1'.length + gros.length + 4);
  const rp = migrerStockage(plein);
  egal(plein.m.get('swblacksmith-siege-recos-v1'), gros, 'quota plein : la copie passe une fois l’ancienne place libérée');
  egal(rp.laissees.length, 0, 'quota plein : rien n’est laissé');

  // Le nouveau nom est plus long (+4) : sans même cette marge, la copie ne
  // tient jamais. L'ancienne doit alors être REMISE, intacte.
  const bloque = fauxStockage({ 'sw-forge-siege-recos-v1': gros }, 'sw-forge-siege-recos-v1'.length + gros.length);
  const rb = migrerStockage(bloque);
  egal(bloque.m.get('sw-forge-siege-recos-v1'), gros, 'impossible à copier : l’ancienne valeur est remise, intacte');
  egal(bloque.m.has('swblacksmith-siege-recos-v1'), false, '… et aucune copie partielle ne traîne');
  egal(rb.laissees, ['sw-forge-siege-recos-v1'], '… et la clé est signalée comme laissée');

  titre('migration du stockage · aucune ancienne clé dans le code');
  // ⚠️ Une clé `sw-forge-…` réintroduite dans `src/` (copiée d'un vieux
  // commit, d'une spec) écrirait sous l'ancien nom — la migration l'effacerait
  // au lancement suivant. Seul le module de migration a le droit de les nommer.
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (/\.tsx?$/.test(n)) fichiers.push(p);
    }
  };
  parcourir(join(RACINE, 'src'));
  const fautifs = fichiers
    .filter((f) => !f.endsWith('migrationStockage.ts'))
    .filter((f) => /['"`](sw-forge-|sky-arena-)/.test(readFileSync(f, 'utf8')));
  egal(fautifs.map((f) => f.slice(RACINE.length + 1)), [], 'aucun littéral `sw-forge-…` / `sky-arena-…` hors de la migration');
}
