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
//  2. Toute l'app partage ce même budget de 5 Mo : prépa RTA, équipes de
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

import { ArtifactDetail, CraftLine, RelicDetail, RuneDetail } from '../types';
import { BoxMonster, PERIMETRES_UTILISES, RunesUtilisees } from './importAccount';

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
  relics: RelicDetail[];
  crafts: CraftLine[]; // meules & gemmes en réserve
  // Identifiants (`rune_id`) des runes UTILISÉES, PAR PÉRIMÈTRE (RTA, siège,
  // arène, autres decks) — voir `parseUsedRuneIdsParPerimetre`.
  //
  // ⚠️ Stocké, et pas recalculé au démarrage : les decks vivent dans l'export
  // brut, qu'on ne conserve jamais (5 à 8 Mo). Sans cette liste, le filtre
  // « Runes utilisées » se serait éteint à chaque rechargement.
  usedRuneIds: RunesUtilisees;
  // Occupation par rid de relique (nombre d'unités dont `relics[0].rid` vaut
  // ce rid) — calculée à l'import, jamais déduite de `relics.length` (une
  // relique n'est pas exclusive, docs/03-developpeur/optimizer/
  // § Ce que le moteur lit d'une relique). Même raison de
  // stockage que `usedRuneIds` : l'export brut n'est jamais conservé.
  relicUsageById: Record<number, number>;
  // Libellés des marqueurs de runes, numéro → texte saisi en jeu — voir
  // `parseRuneMarkerLabels`. Au niveau du compte, pas recopié dans chaque rune :
  // un marqueur sans libellé en est absent, l'écran affiche alors son numéro.
  runeMarkerLabels: Record<number, string>;
}

// À incrémenter dès qu'un extracteur produit un champ de plus — ou en produit
// un AUTREMENT : un compte enregistré sous l'ancien schéma serait incomplet, ou
// mal lu, et donnerait des chiffres faux en silence. (5 : la propriété unique
// des reliques, qui remplace un `relic.sub` mal modélisé. 6 :
// `ArtifactDetail.id`, le `rid` com2us que `artifactToDetail` lisait sans le
// conserver. 7 : `relics` et `relicUsageById` — l'inventaire de reliques,
// absent jusque-là ; `RuneDetail.marker` — une rune stockée sans ce champ
// serait lue à tort « sans marqueur » —, les libellés `runeMarkerLabels`, et
// `usedRuneIds` rangé par périmètre au lieu d'une liste plate.) À la lecture,
// un schéma différent est **ignoré** — l'app retombe sur « aucun compte » et
// invite à réimporter, comme pour les vieux fichiers de recommandation.
//
// ⚠️ **Le 7 réunit deux chantiers développés en parallèle** (reliques et
// marqueurs), qui avaient chacun pris le numéro 7 pour leur seule moitié.
// Aucune version publiée n'a porté l'une sans l'autre (la v1.13.0 est au 6),
// d'où un seul numéro. Un enregistrement 7 issu d'une seule des deux branches
// est rejeté par `loadAccount`, qui exige les champs des deux.
//
// ⚠️ **Le compte est stocké DÉJÀ PARSÉ**, et l'export brut n'est jamais
// conservé (5 à 8 Mo) : un champ ajouté à l'extraction ne peut donc PAS être
// retrouvé sur un compte existant, seulement au réimport. Oublier
// d'incrémenter ici ne casse rien visiblement — ça produit un manque
// silencieux. Vécu avec `ArtifactDetail.id` : les artéfacts stockés n'avaient
// pas d'identifiant, donc un build validé ne mémorisait aucune paire et
// retombait sur les artéfacts réellement portés, sans le moindre signal.
export const ACCOUNT_SCHEMA = 7;

// Renommée au rebranding (décision 66) : la base s'appelait `sw-forge`. Elle
// est reprise une fois, à la première ouverture — voir `reprendreAncienneBase`.
const DB_NAME = 'swblacksmith';
const ANCIENNE_BASE = 'sw-forge';
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
    // ⚠️ La reprise de l'ancienne base passe AVANT toute opération : la file
    // ne voit la connexion qu'une fois le compte recopié, sinon la première
    // lecture rendrait « aucun compte » à un utilisateur qui en a un.
    req.onsuccess = () => {
      const db = req.result;
      reprendreAncienneBase(db).then(
        () => resolve(db),
        () => resolve(db)
      );
    };
    req.onerror = () => resolve(null);
    // Un autre onglet garde une version antérieure ouverte : on n'insiste pas,
    // on repart en mémoire plutôt que d'attendre indéfiniment.
    req.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/* --------------------------------------------------------------------------
 * Reprise de l'ancienne base `sw-forge` (rebranding, décision 66)
 * ----------------------------------------------------------------------- */

// Ouvre l'ancienne base SI elle existe. ⚠️ `indexedDB.open` CRÉE une base
// absente : on l'en empêche en annulant la création (`oldVersion === 0`), sans
// quoi chaque lancement laisserait une base `sw-forge` vide derrière lui.
function ouvrirAncienneBase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(ANCIENNE_BASE);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = (e) => {
      if (e.oldVersion === 0) req.transaction?.abort();
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null); // y compris la création annulée
    req.onblocked = () => resolve(null);
  });
}

function lireBrut(db: IDBDatabase): Promise<unknown> {
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

function ecrireBrut(db: IDBDatabase, valeur: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(valeur, KEY);
      t.oncomplete = () => resolve(true);
      t.onabort = () => resolve(false); // quota
      t.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function supprimerBase(nom: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(nom);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      // Un onglet resté sur l'ancienne version tient la base ouverte : la
      // suppression aura lieu quand il se fermera, on n'attend pas.
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Recopie le compte de l'ancienne base dans la nouvelle, puis supprime
// l'ancienne. ⚠️ **Jamais de perte** : l'ancienne n'est supprimée qu'une fois
// la copie RELUE dans la nouvelle ; sinon elle reste, et la reprise
// recommencera au lancement suivant. Un compte déjà présent dans la nouvelle
// base fait foi (enregistré depuis la mise à jour) — l'ancien n'est alors
// qu'un doublon périmé.
export async function reprendreAncienneBase(db: IDBDatabase): Promise<void> {
  const vieille = await ouvrirAncienneBase();
  if (!vieille) return;
  try {
    if (vieille.objectStoreNames.contains(STORE)) {
      const ancien = await lireBrut(vieille);
      if (ancien !== undefined && (await lireBrut(db)) === undefined) {
        if (!(await ecrireBrut(db, ancien)) || (await lireBrut(db)) === undefined) return;
      }
    }
  } finally {
    vieille.close();
  }
  await supprimerBase(ANCIENNE_BASE);
}

// Ferme la connexion et l'oublie : la prochaine opération rouvre la base, et
// refait donc la reprise. Réservé aux tests — l'app garde une connexion unique.
export function oublierConnexion(): Promise<void> {
  const p = dbPromise;
  dbPromise = null;
  return (p ?? Promise.resolve(null)).then((db) => db?.close());
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

// Un compte stocké, relu avec méfiance : `null` si sa forme ou son schéma ne
// sont pas ceux d'aujourd'hui. Pure — la relecture d'IndexedDB et celle d'une
// sauvegarde de session (src/lib/session.ts) passent par elle.
export function compteValide(brut: unknown): StoredAccount | null {
  const rec = brut as StoredAccount;
  if (!rec || typeof rec !== 'object') return null;
  if (rec.schema !== ACCOUNT_SCHEMA) return null;
  if (!Array.isArray(rec.box) || !Array.isArray(rec.runes) || !Array.isArray(rec.artifacts)) return null;
  if (!Array.isArray(rec.relics)) return null;
  if (!Array.isArray(rec.crafts)) return null;
  // Un tableau PAR périmètre — une liste plate (schéma 6) n'en est pas un.
  const used = rec.usedRuneIds as unknown;
  if (!used || typeof used !== 'object' || Array.isArray(used)) return null;
  if (!PERIMETRES_UTILISES.every((p) => Array.isArray((used as RunesUtilisees)[p.key]))) return null;
  if (!rec.relicUsageById || typeof rec.relicUsageById !== 'object') return null;
  if (!rec.runeMarkerLabels || typeof rec.runeMarkerLabels !== 'object') return null;
  return rec;
}

// `null` = rien d'exploitable : pas de compte, stockage indisponible, ou schéma
// périmé. L'appelant n'a qu'un cas à traiter.
export function loadAccount(): Promise<StoredAccount | null> {
  return enqueue(async () => compteValide(await tx<StoredAccount>('readonly', (s) => s.get(KEY))));
}

// `false` = non enregistré (stockage indisponible ou plein). L'import reste
// valide en mémoire : on ne casse jamais l'usage courant pour un échec d'écriture.
export function saveAccount(
  data: Pick<
    StoredAccount,
    | 'box'
    | 'runes'
    | 'artifacts'
    | 'relics'
    | 'crafts'
    | 'usedRuneIds'
    | 'relicUsageById'
    | 'runeMarkerLabels'
    | 'exportedAt'
    | 'wizardName'
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
      relics: data.relics,
      crafts: data.crafts,
      usedRuneIds: data.usedRuneIds,
      relicUsageById: data.relicUsageById,
      runeMarkerLabels: data.runeMarkerLabels,
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
