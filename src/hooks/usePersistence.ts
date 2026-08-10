import { useSyncExternalStore } from 'react';
import { clearAccount, isAvailable, requestPersistence } from '../lib/accountStore';

// **Conservation des données entre deux sessions** — un seul interrupteur pour
// TOUTE l'application : prépa RTA, équipes de siège, recommandations, catégories,
// monstres perso **et** compte importé.
//
// ⚠️ **Un seul réglage, sinon l'app se contredit.** Avant, RTA et siège étaient
// persistés d'office pendant que le compte, lui, disparaissait au rechargement :
// on revenait sur le site avec ses équipes mais sans ses runes, sans explication.
// Deux régimes de mémoire dans le même outil, c'est un bug de conception, pas un
// détail de réglage.
//
// ⚠️ **Trois états : oui / non / jamais demandé.** Un booléen à `false` par
// défaut confondrait « a refusé » et « n'a jamais été consulté ». La question est
// posée à la fin du premier import (`KeepAccountDialog`), au moment où elle a un
// sens — pas dans un menu que personne n'ouvre.

const STORAGE_KEY = 'sw-forge-persist-v1';
const ANCIENNE_CLE = 'sw-forge-keep-account-v1'; // réglage limité au compte

// ⚠️ Ces clés-là restent écrites même quand la conservation est refusée : ce sont
// des **réglages**, pas le travail de l'utilisateur. Refuser la conservation doit
// justement être mémorisé, sinon on repose la question à chaque import.
const CLES_DE_REGLAGE = new Set([STORAGE_KEY, ANCIENNE_CLE, 'sw-forge-rune-metric-v1']);

const estUneCleDeDonnees = (k: string) =>
  (k.startsWith('sw-forge') || k.startsWith('sky-arena')) && !CLES_DE_REGLAGE.has(k);

function clesDeDonnees(): string[] {
  try {
    return Object.keys(localStorage).filter(estUneCleDeDonnees);
  } catch {
    return [];
  }
}

function load(): { actif: boolean; choisi: boolean } {
  try {
    const brut = localStorage.getItem(STORAGE_KEY);
    if (brut !== null) return { actif: brut === '1', choisi: true };

    // Reprise de l'ancien réglage, qui ne portait que sur le compte.
    const ancien = localStorage.getItem(ANCIENNE_CLE);
    if (ancien !== null) return { actif: ancien === '1', choisi: true };

    // ⚠️ **Utilisateur déjà installé** : RTA et siège étaient persistés d'office
    // avant ce réglage. Le mettre à « non » lui ferait perdre en silence une
    // conservation dont il dispose depuis toujours — on considère donc que des
    // données déjà sur le disque valent consentement.
    if (clesDeDonnees().length > 0) return { actif: true, choisi: true };

    return { actif: false, choisi: false };
  } catch {
    return { actif: false, choisi: false };
  }
}

let { actif: current, choisi } = load();
const listeners = new Set<() => void>();

/* --------------------------------------------------------------------------
 * Écriture — le seul chemin autorisé vers `localStorage`
 * ----------------------------------------------------------------------- */

// ⚠️ **Aucun hook n'appelle `localStorage.setItem` directement.** Tout passe par
// ici : c'est ce qui garantit qu'un refus de conservation vaut pour l'app
// entière, et qu'ajouter un état persistant demain n'ouvrira pas une fuite.
export function saveLocal(key: string, value: string) {
  try {
    if (!current) {
      // Refus : on n'écrit pas, et on efface ce qui traînerait d'une session
      // précédente — sinon un vieil état ressusciterait au prochain démarrage.
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible : l'état vaut pour la session */
  }
}

// La lecture, elle, n'est jamais bloquée : au démarrage on ne sait pas encore si
// l'utilisateur a refusé, et ce qui est là lui appartient.
export function loadLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Efface tout ce qui a été conservé, réglages exclus (voir `CLES_DE_REGLAGE`).
export async function purgeDonneesConservees() {
  for (const k of clesDeDonnees()) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignoré */
    }
  }
  await clearAccount();
}

/* --------------------------------------------------------------------------
 * Le réglage
 * ----------------------------------------------------------------------- */

// `onEnable` reçoit la main à l'activation : c'est le moment d'écrire ce qui est
// déjà en mémoire (le compte importé), sinon il faudrait le réimporter pour rien.
export function setPersistence(actif: boolean, onEnable?: () => void) {
  const dejaChoisi = choisi;
  choisi = true;
  if (actif === current && dejaChoisi) return;
  current = actif;
  try {
    localStorage.setItem(STORAGE_KEY, actif ? '1' : '0');
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
  // ⚠️ Notifier AVANT d'écrire : les hooks d'état réagissent au changement en
  // ré-enregistrant ce qu'ils portent. C'est ce qui remplit le disque à
  // l'activation sans que chacun ait à s'en occuper.
  for (const l of listeners) l();

  if (actif) {
    void requestPersistence(); // dans le geste de l'utilisateur : mieux accordé
    onEnable?.();
  } else {
    // ⚠️ Refuser **efface**, ça n'arrête pas seulement d'écrire. Un réglage
    // décoché qui laisserait les données sur le disque serait un mensonge.
    void purgeDonneesConservees();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePersistence(): boolean {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export function persistenceEnabled(): boolean {
  return current;
}

// L'utilisateur a-t-il déjà répondu ? Sert à ne poser la question qu'une fois.
// ⚠️ Fermer la fenêtre sans répondre ne compte PAS comme un choix : on
// redemandera au prochain import plutôt que d'interpréter un silence.
export function persistenceChoisie(): boolean {
  return choisi;
}

// Le stockage est-il seulement utilisable ? Sert à griser le réglage plutôt qu'à
// le laisser promettre une conservation qui n'aura pas lieu (navigation privée).
export function storageAvailable(): boolean {
  return isAvailable();
}
