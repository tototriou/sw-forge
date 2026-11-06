// Conservation des équipes de « Mes équipes », dans IndexedDB.
//
// Spec : docs/02-app/compte/feat-equipes.md, « Conservation ».
//
// ⚠️ **Une base à elle** (`swblacksmith-equipes`), pas un store de plus dans
// celle du compte : monter la version de `swblacksmith` ferait échouer
// l'ouverture qu'en fait encore un autre onglet, et le compte retomberait en
// mémoire. Deux bases ne se gênent pas.
//
// ⚠️ **Une entrée par équipe** (clé = `id`) : des centaines d'équipes à six
// monstres équipés pèsent plusieurs mégaoctets ; réécrire tout à chaque frappe
// dans une note coûterait autant.
//
// Toute erreur devient `null` ou `false`, jamais une exception : l'app retombe
// sur ses équipes en mémoire.

import { lireEquipeEnregistree, type EquipeEnregistree, type SignalementEquipe } from './equipesEnregistrees';

const DB_NAME = 'swblacksmith-equipes';
const DB_VERSION = 1;
const STORE = 'equipes';

function disponible(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function ouvrir(): Promise<IDBDatabase | null> {
  if (!disponible()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

// Les opérations s'exécutent dans l'ordre des gestes : une suppression n'est
// jamais ressuscitée par une écriture en retard, et la dernière action gagne.
let file: Promise<unknown> = Promise.resolve();
function enfiler<T>(op: () => Promise<T>): Promise<T> {
  const suite = file.then(op, op);
  file = suite.catch(() => undefined);
  return suite;
}

function transaction<T>(mode: IDBTransactionMode, faire: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T | null> {
  return ouvrir().then((db) => new Promise<T | null>((resolve) => {
    if (!db) { resolve(null); return; }
    try {
      const t = db.transaction(STORE, mode);
      const req = faire(t.objectStore(STORE));
      let valeur: T | null = null;
      if (req) req.onsuccess = () => { valeur = req.result; };
      t.oncomplete = () => resolve(req ? valeur : (true as unknown as T));
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

export interface RelectureEquipes {
  equipes: EquipeEnregistree[];
  // Les entrées illisibles restent telles quelles dans la base, jamais
  // réécrites ni supprimées par la relecture : leur nombre remonte, et leurs
  // clés, que l'import d'un fichier ne doit pas reprendre (il les écraserait).
  illisibles: number;
  clesIllisibles: string[];
  signalements: { id: string; signalements: SignalementEquipe[] }[];
}

// `null` : stockage indisponible.
export function chargerEquipes(): Promise<RelectureEquipes | null> {
  return enfiler(async () => {
    const brut = await transaction<unknown[]>('readonly', (s) => s.getAll());
    if (brut === null) return null;
    // Même ordre que `getAll` (ordre des clés) ; rien n'écrit entre les deux, la file est sérielle.
    const cles = (await transaction<IDBValidKey[]>('readonly', (s) => s.getAllKeys())) ?? [];
    const res: RelectureEquipes = { equipes: [], illisibles: 0, clesIllisibles: [], signalements: [] };
    for (const [i, v] of brut.entries()) {
      const lu = lireEquipeEnregistree(v);
      if (!lu) { res.illisibles++; if (cles[i] !== undefined) res.clesIllisibles.push(String(cles[i])); continue; }
      res.equipes.push(lu.equipe);
      if (lu.signalements.length) res.signalements.push({ id: lu.equipe.id, signalements: lu.signalements });
    }
    return res;
  });
}

export function enregistrerEquipes(equipes: readonly EquipeEnregistree[]): Promise<boolean> {
  if (equipes.length === 0) return Promise.resolve(true);
  return enfiler(async () => {
    const r = await transaction<IDBValidKey>('readwrite', (s) => {
      for (const e of equipes) s.put(e, e.id);
      return null;
    });
    return r !== null;
  });
}

export function supprimerEquipes(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return Promise.resolve(true);
  return enfiler(async () => {
    const r = await transaction<undefined>('readwrite', (s) => {
      for (const id of ids) s.delete(id);
      return null;
    });
    return r !== null;
  });
}

export function viderEquipes(): Promise<boolean> {
  return enfiler(async () => (await transaction<undefined>('readwrite', (s) => s.clear())) !== null);
}

// Pour les tests : oublie la connexion, comme un rechargement de page.
export function oublierConnexionEquipes(): void {
  dbPromise = null;
}
