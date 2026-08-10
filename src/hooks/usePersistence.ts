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

// Règle de reprise, **isolée et pure** pour être vérifiable telle quelle : c'est
// la décision la plus lourde de conséquences du module, et elle ne s'observe
// qu'au tout premier chargement.
export function etatDepuisStockage(entrees: Record<string, string>): {
  actif: boolean;
  choisi: boolean;
} {
  const brut = entrees[STORAGE_KEY];
  if (brut !== undefined) return { actif: brut === '1', choisi: true };

  // Reprise de l'ancien réglage, qui ne portait que sur le compte.
  const ancien = entrees[ANCIENNE_CLE];
  if (ancien !== undefined) return { actif: ancien === '1', choisi: true };

  // ⚠️ **Utilisateur déjà installé** : RTA et siège étaient persistés d'office
  // avant ce réglage. Le mettre à « non » lui ferait perdre en silence une
  // conservation dont il dispose depuis toujours — des données déjà sur le
  // disque valent donc consentement.
  if (Object.keys(entrees).some(estUneCleDeDonnees)) return { actif: true, choisi: true };

  return { actif: false, choisi: false };
}

function load(): { actif: boolean; choisi: boolean } {
  try {
    const entrees: Record<string, string> = {};
    for (const k of Object.keys(localStorage)) {
      const v = localStorage.getItem(k);
      if (v !== null) entrees[k] = v;
    }
    return etatDepuisStockage(entrees);
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

// ⚠️ **La question est reposée à CHAQUE import**, tant que l'utilisateur n'a pas
// coché « ne plus me montrer ». Un choix fait une fois pour toutes vieillit mal :
// on accepte la conservation sur son ordinateur, puis on ouvre le site chez un
// ami ou sur un poste partagé sans que rien ne le rappelle. Reposer la question
// au moment du dépôt, c'est la reposer là où le contexte a pu changer.
//
// ⚠️ **La case cochée vaut pour la SESSION en cours, et rien de plus** — d'où une
// variable en mémoire plutôt qu'une clé de stockage. Elle sert à ne pas être
// resollicité quand on enchaîne plusieurs fichiers d'affilée, pas à faire taire
// la question pour toujours : au rechargement suivant, elle est reposée. La
// garantie tenue est donc « **au moins une fois par session** ».
let dialogueMasqueSession = false;

export function dialogueMasque(): boolean {
  return dialogueMasqueSession;
}

export function setDialogueMasque(masque: boolean) {
  dialogueMasqueSession = masque;
}

// Le stockage est-il seulement utilisable ? Sert à griser le réglage plutôt qu'à
// le laisser promettre une conservation qui n'aura pas lieu (navigation privée).
export function storageAvailable(): boolean {
  return isAvailable();
}
