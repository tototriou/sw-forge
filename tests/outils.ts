// Boîte à outils des tests : assertions, faux stockage navigateur, et accès aux
// fichiers d'exemple. Volontairement minuscule — voir tests/README.md pour le
// pourquoi de l'absence de framework.

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/* --------------------------------------------------------------------------
 * Assertions
 * ----------------------------------------------------------------------- */

let echecs = 0;
let total = 0;
let ignores = 0;

export function ok(condition: boolean, libelle: string) {
  total++;
  if (condition) {
    console.log('  [32mok[0m   ' + libelle);
  } else {
    echecs++;
    console.log('  [31mKO[0m   ' + libelle);
  }
}

export function egal(recu: unknown, attendu: unknown, libelle: string) {
  const memeChose = JSON.stringify(recu) === JSON.stringify(attendu);
  ok(memeChose, memeChose ? libelle : `${libelle} — reçu ${JSON.stringify(recu)}, attendu ${JSON.stringify(attendu)}`);
}

// Un test qui a besoin d'un fichier absent ne doit pas passer pour un échec :
// l'export réel du développeur est gitignoré et manque sur les autres machines.
export function ignore(libelle: string, raison: string) {
  ignores++;
  console.log(`  [33m--[0m   ${libelle} [2m(${raison})[0m`);
}

export function bilan(): { total: number; echecs: number; ignores: number } {
  return { total, echecs, ignores };
}

export function titre(t: string) {
  console.log(`\n[1m${t}[0m`);
}

/* --------------------------------------------------------------------------
 * Faux navigateur
 * ----------------------------------------------------------------------- */

// `localStorage` minimal, énumérable — le module de persistance parcourt ses
// clés (`Object.keys`) pour purger les données.
export function faussLocalStorage(initial: Record<string, string> = {}) {
  const mem = new Map(Object.entries(initial));
  const api = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  };
  (globalThis as any).localStorage = new Proxy(api, {
    ownKeys: () => [...mem.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  return mem;
}

/* --------------------------------------------------------------------------
 * Fichiers d'exemple
 * ----------------------------------------------------------------------- */

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// Export miniature écrit à la main, commité : il exerce chaque chemin des
// extracteurs sans contenir la moindre donnée réelle.
// ⚠️ Le nom ne doit contenir ni « export » ni « account » : `.gitignore` exclut
// `*export*.json` et `*account*.json` pour empêcher qu'un vrai export de compte
// soit commité par accident. Un fichier d'exemple ainsi nommé serait exclu lui
// aussi, et les tests échoueraient sur un dépôt fraîchement cloné.
export function exportSynthetique(): string {
  return readFileSync(resolve(racine, 'tests/fixtures/compte-miniature.json'), 'utf8');
}

// ⚠️ Export RÉEL du développeur — **gitignoré**, donc absent partout ailleurs.
// Les tests qui s'en servent (mesures, cas réels) s'ignorent quand il manque.
export function exportReel(): string | null {
  const candidats = ['tototriou-12889591.json'];
  for (const nom of candidats) {
    const chemin = resolve(racine, nom);
    if (existsSync(chemin)) return readFileSync(chemin, 'utf8');
  }
  return null;
}

export function monstersJson(): any[] {
  const brut = JSON.parse(readFileSync(resolve(racine, 'public/data/monsters.json'), 'utf8'));
  return Array.isArray(brut) ? brut : brut.monsters;
}
