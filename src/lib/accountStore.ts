// Persistance OPTIONNELLE du compte importé, dans IndexedDB.
//
// Ce que ça résout : la box, les runes et les artéfacts vivaient uniquement en
// mémoire, donc s'évaporaient au moindre rechargement. La prépa RTA et les
// équipes de siège, elles, sont déjà persistées dans `localStorage`.
//
// ⚠️ **Pourquoi PAS `localStorage`** — trois raisons, la deuxième est la vraie :
//  1. Ça ne rentre pas. Le quota est d'environ 5 Mo par origine, souvent compté
//     en UTF-16 (2 octets par caractère). Le modèle utile d'un gros compte pèse
//     2,2 Mo (box 0,73 + runes 0,91 + artéfacts 0,53), soit ~4,4 Mo de quota :
//     à la limite. L'export brut, lui, fait 5 à 8 Mo — impossible.
//  2. Tout SW Forge partage ce même budget de 5 Mo : prépa RTA, équipes de
//     siège, recommandations, catégories, monstres perso. Ces données-là sont
//     **écrites à la main** par le joueur, il ne peut pas les régénérer. Le
//     compte, lui, se réimporte en deux secondes. Mettre le gros consommable
//     dans le même seau que l'irremplaçable, c'est accepter qu'un jour un
//     `QuotaExceededError` fasse échouer la sauvegarde d'un deck de siège.
//  3. `localStorage` est synchrone : sérialiser 2 Mo bloque le thread principal.
//
// IndexedDB n'a aucun de ces défauts : asynchrone, quota basé sur un
// pourcentage du disque, et **structured clone** — on stocke les objets tels
// quels, sans `JSON.stringify` à l'écriture ni re-parse à la lecture.

import { ArtifactDetail, CraftLine, RuneDetail } from '../types';
import { BoxMonster } from './importAccount';

/* --------------------------------------------------------------------------
 * Ce qu'on stocke
 * ----------------------------------------------------------------------- */

// ⚠️ On stocke la **sortie des extracteurs**, jamais l'état affiché (`BoxItem`).
// Un `BoxItem` embarque l'objet `Monster` complet : ça duplique ~0,25 Mo, mais
// surtout ça **fige la résolution** `com2usId → Monster` au moment de l'import.
// Le jour où `monsters.json` gagne un monstre, un compte enregistré il y a trois
// semaines continuerait de l'ignorer. En gardant la sortie brute, on re-mappe à
// chaque démarrage avec les données du jour, et le compte se répare tout seul.
export interface StoredAccount {
  schema: number;
  savedAt: number; // epoch ms — quand l'app a enregistré (diagnostic)
  // ⚠️ Date de l'EXPORT (`tvalue`), pas de l'import : c'est elle qu'on affiche.
  // Réimporter un fichier de trois semaines annoncerait sinon « aujourd'hui ».
  // `null` si le fichier ne la porte pas (export ancien ou retouché).
  exportedAt: number | null;
  // Nom du joueur (`wizard_info.wizard_name`), pour dire QUEL compte est chargé.
  //
  // ⚠️ **Facultatif, et c'est délibéré.** Le rendre obligatoire aurait imposé
  // d'incrémenter `ACCOUNT_SCHEMA`, donc de REJETER tous les comptes déjà
  // conservés — un réimport forcé pour un simple libellé. Un compte enregistré
  // avant cette version n'a pas de nom : l'app affiche « Compte importé », et
  // le nom apparaît au prochain import.
  wizardName?: string | null;
  box: BoxMonster[];
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  crafts: CraftLine[]; // meules & gemmes en réserve
  // Identifiants (`rune_id`) des runes UTILISÉES : posées sur un monstre d'un
  // deck (tous contenus) ou en RTA — voir `parseUsedRuneIds`.
  //
  // ⚠️ Stocké, et pas recalculé au démarrage : les decks vivent dans l'export
  // brut, qu'on ne conserve jamais (5 à 8 Mo). Sans cette liste, le filtre
  // « Runes utilisées » se serait éteint à chaque rechargement.
  usedRuneIds: number[];
}

// À incrémenter dès qu'un extracteur produit un champ de plus : un compte
// enregistré sous l'ancien schéma serait incomplet et donnerait des chiffres
// faux en silence. À la lecture, un schéma différent est **ignoré** — l'app
// retombe sur « aucun compte » et invite à réimporter, comme pour les vieux
// fichiers de recommandation.
export const ACCOUNT_SCHEMA = 4;

const DB_NAME = 'sw-forge';
const DB_VERSION = 1;
const STORE = 'account';
const KEY = 'current'; // ⚠️ clé FIXE : un seul compte, celui du joueur.
// Les JSON d'autres joueurs importés dans la comparaison de courbes restent en
// mémoire — on ne stocke jamais le compte de quelqu'un d'autre sur sa machine.

/* --------------------------------------------------------------------------
 * Ouverture — toute erreur devient `null`, jamais une exception
 * ----------------------------------------------------------------------- */

// Navigation privée Firefox, extension qui bloque le stockage, base corrompue,
// quota refusé : aucun de ces cas ne doit empêcher l'app de démarrer. Le repli
// est toujours le comportement d'origine — le compte reste en mémoire.
export function isAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false; // l'accès lui-même peut lever selon les réglages du navigateur
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (!isAvailable()) return Promise.resolve(null);
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
    // Un autre onglet garde une version antérieure ouverte : on n'insiste pas,
    // on repart en mémoire plutôt que d'attendre indéfiniment.
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const t = db.transaction(STORE, mode);
          const req = run(t.objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(null);
          t.onabort = () => resolve(null); // quota dépassé, notamment
        } catch {
          resolve(null);
        }
      })
  );
}

/* --------------------------------------------------------------------------
 * Sérialisation des opérations
 * ----------------------------------------------------------------------- */

// ⚠️ Ce sont les **premières écritures asynchrones** de l'app, donc le premier
// endroit où deux actions de l'utilisateur peuvent se croiser :
//  - deux imports coup sur coup, dont les transactions se termineraient dans le
//    désordre → le compte enregistré ne serait pas le dernier importé ;
//  - une purge (« Supprimer mes données », ou décochage du réglage) pendant
//    qu'un import s'écrit → une écriture en retard **ressusciterait** le compte
//    que l'utilisateur vient d'effacer. Une action explicite annulée par un
//    effet de bord invisible : le pire cas.
//
// Une file d'attente sérielle suffit et se raisonne en une phrase : les
// opérations s'exécutent dans l'ordre où l'utilisateur les a déclenchées. Le
// parse étant synchrone, cet ordre est bien celui des clics. La purge gagne donc
// toujours sur ce qui la précède, et jamais sur un import postérieur.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const next = queue.then(op, op); // même en cas d'échec précédent, on continue
  queue = next.catch(() => undefined);
  return next;
}

/* --------------------------------------------------------------------------
 * API
 * ----------------------------------------------------------------------- */

// `null` = rien d'exploitable : pas de compte, stockage indisponible, ou schéma
// périmé. L'appelant n'a qu'un cas à traiter.
export function loadAccount(): Promise<StoredAccount | null> {
  return enqueue(async () => {
    const rec = await tx<StoredAccount>('readonly', (s) => s.get(KEY));
    if (!rec || typeof rec !== 'object') return null;
    if (rec.schema !== ACCOUNT_SCHEMA) return null;
    if (!Array.isArray(rec.box) || !Array.isArray(rec.runes) || !Array.isArray(rec.artifacts)) return null;
    if (!Array.isArray(rec.crafts)) return null;
    if (!Array.isArray(rec.usedRuneIds)) return null;
    return rec;
  });
}

// `false` = non enregistré (stockage indisponible ou plein). L'import reste
// valide en mémoire : on ne casse jamais l'usage courant pour un échec d'écriture.
export function saveAccount(
  data: Pick<
    StoredAccount,
    'box' | 'runes' | 'artifacts' | 'crafts' | 'usedRuneIds' | 'exportedAt' | 'wizardName'
  >
): Promise<boolean> {
  return enqueue(async () => {
    const rec: StoredAccount = {
      schema: ACCOUNT_SCHEMA,
      savedAt: Date.now(),
      exportedAt: data.exportedAt,
      wizardName: data.wizardName ?? null,
      box: data.box,
      runes: data.runes,
      artifacts: data.artifacts,
      crafts: data.crafts,
      usedRuneIds: data.usedRuneIds,
    };
    // `put` sur une clé fixe : un nouvel import remplace, il ne s'ajoute pas.
    const res = await tx<IDBValidKey>('readwrite', (s) => s.put(rec, KEY));
    return res !== null;
  });
}

export function clearAccount(): Promise<void> {
  return enqueue(async () => {
    await tx<undefined>('readwrite', (s) => s.delete(KEY));
  });
}

// Demande au navigateur de ne pas évincer ce stockage. À appeler **dans un geste
// de l'utilisateur** (le clic qui active le réglage) : les navigateurs accordent
// plus volontiers à ce moment-là. Un refus n'est pas une erreur — au pire les
// données seront effacées automatiquement, ce qui ramène au comportement
// d'origine. Safari efface d'ailleurs le stockage écrit par script après ~7
// jours sans visite, quoi qu'on demande.
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
