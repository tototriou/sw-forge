// La sauvegarde de session — le format. Voir docs/02-app/transverse/.
//
// Tout l'état de l'app à un instant donné, dans UN fichier que l'utilisateur
// place où il veut et recharge plus tard, comme une sauvegarde de jeu : le
// travail et les réglages (le stockage local), le compte importé, l'état des
// outils (mémoire : `useStickyState`, et la photo de l'Optimizer,
// sessionOptimizer.ts). Ce module est PUR : il compose, écrit et relit ; il
// ne lit ni n'écrit rien dans l'app.
//
// ⚠️ **Un fichier se relit entier, puis se valide, avant que l'app n'y
// touche** : `lireSession` rend une session valide ou une erreur dite,
// jamais une session à moitié lue.
// ⚠️ **Relisible par les versions suivantes** : un champ inconnu est
// ignoré ; une version PLUS RÉCENTE que celle-ci est refusée, avec un
// message, plutôt que lue de travers.

import { ACCOUNT_SCHEMA, compteValide, StoredAccount } from './accountStore';
import { formatExport, formatReconnu } from './formatsExport';
import { CHAMPS_OPTIMIZER_SESSION } from './sessionOptimizer';
import { jourLocal } from './telechargement';
import { PREFIXE_FICHIER } from '../marque';
import { OPTIMIZER_MEMBERS_STORAGE_KEY } from './optimizerMemberStorage';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from './optimizerBackup';

export const FORMAT_SESSION = formatExport('session');
export const VERSION_SESSION = 2;

// Le travail et les réglages : les clés du stockage local qui entrent dans
// une session, et elles seules — à la relecture, une clé hors de
// cette liste est ignorée. Hors liste, à dessein : « Garder mes données »
// (`-persist-v1`), propre à l'appareil, et les anciennes clés déjà migrées.
export const CLES_SESSION = [
  // Le travail.
  'swblacksmith-rta-v1',
  'swblacksmith-rta-categories-v1',
  'swblacksmith-rta-backup-v1',
  'swblacksmith-rta-import-v1',
  'swblacksmith-siege-defense-v1',
  'swblacksmith-siege-offense-v1',
  'swblacksmith-siege-recos-v1',
  'swblacksmith-custom-monsters-v1',
  'swblacksmith-optimizer-lists-v1',
  OPTIMIZER_MEMBERS_STORAGE_KEY,
  OPTIMIZER_BACKUP_STORAGE_KEY,
  // Les réglages.
  'swblacksmith-theme-v1',
  'swblacksmith-rune-metric-v1',
  'swblacksmith-overcap-display-v1',
  'swblacksmith-adversaire-reference-v1',
] as const;

// La forme de chaque valeur, telle que son hook l'ÉCRIT. ⚠️ Pas toutes du
// JSON : les réglages sont des mots ou des `0`/`1` écrits tels quels.
const VALEURS_PERMISES: Partial<Record<(typeof CLES_SESSION)[number], readonly string[]>> = {
  'swblacksmith-theme-v1': ['auto', 'light', 'dark'],
  'swblacksmith-rune-metric-v1': ['eff', 'score'],
  'swblacksmith-overcap-display-v1': ['0', '1'],
  'swblacksmith-adversaire-reference-v1': ['0', '1'],
};

// Une valeur du stockage est-elle de la forme que son hook relit ? Les
// réglages : une valeur permise ; le travail : du JSON, sauf le point dont
// le lecteur spécialisé conserve aussi un texte cassé sans l'appliquer.
export function valeurStockageValide(cle: (typeof CLES_SESSION)[number], valeur: string): boolean {
  if (cle === OPTIMIZER_BACKUP_STORAGE_KEY) return true;
  const permises = VALEURS_PERMISES[cle];
  if (permises) return permises.includes(valeur);
  try {
    JSON.parse(valeur);
    return true;
  } catch {
    return false;
  }
}

// L'état des outils en mémoire (`useStickyState`) : tout, sauf les
// préférences d'interface propres à l'appareil.
export const STICKY_HORS_SESSION = ['sidebar.retractee', 'mobileNotice.ferme'] as const;

export interface Session {
  format: string;
  version: number;
  // ISO : quand la session a été sauvegardée.
  enregistreeLe: string;
  // La version de l'app qui l'a écrite (diagnostic, jamais un critère).
  versionApp: string;
  // Clé du stockage local → sa valeur brute, telle que l'app l'écrit.
  stockage: Partial<Record<(typeof CLES_SESSION)[number], string>>;
  compte: StoredAccount | null;
  outils: {
    // Clé `useStickyState` → valeur ; `Set` et `Map` encodés (`encoder`).
    memoire: Record<string, unknown>;
    // L'Optimizer : la photo de ses champs de données (`photoOptimizer`) —
    // sélection, critères, tri ; encodée comme la mémoire.
    optimizer: Record<string, unknown> | null;
  };
}

export interface SourcesSession {
  maintenant: Date;
  versionApp: string;
  stockage: Record<string, string | null | undefined>;
  compte: StoredAccount | null;
  memoire: Record<string, unknown>;
  optimizer: Record<string, unknown> | null;
}

// ── `Set` et `Map` en JSON ──────────────────────────────────────────────
// Une quinzaine d'états des outils sont des `Set` : JSON les écrirait `{}`.
// Ils sont marqués, et rendus tels quels à la relecture.

const MARQUE_SET = '$set';
const MARQUE_MAP = '$map';

export function encoder(valeur: unknown): unknown {
  if (valeur instanceof Set) return { [MARQUE_SET]: [...valeur].map(encoder) };
  if (valeur instanceof Map) return { [MARQUE_MAP]: [...valeur].map(([k, v]) => [encoder(k), encoder(v)]) };
  if (Array.isArray(valeur)) return valeur.map(encoder);
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, encoder(v)]));
  }
  return valeur;
}

export function decoder(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(decoder);
  if (valeur && typeof valeur === 'object') {
    const o = valeur as Record<string, unknown>;
    const cles = Object.keys(o);
    if (cles.length === 1 && cles[0] === MARQUE_SET && Array.isArray(o[MARQUE_SET])) {
      return new Set((o[MARQUE_SET] as unknown[]).map(decoder));
    }
    if (cles.length === 1 && cles[0] === MARQUE_MAP && Array.isArray(o[MARQUE_MAP])) {
      return new Map(
        (o[MARQUE_MAP] as unknown[])
          .filter((e): e is [unknown, unknown] => Array.isArray(e) && e.length === 2)
          .map(([k, v]) => [decoder(k), decoder(v)])
      );
    }
    return Object.fromEntries(cles.map((k) => [k, decoder(o[k])]));
  }
  return valeur;
}

// Les champs de l'Optimizer qui voyagent (sessionOptimizer.ts), et eux seuls.
function garderChampsOptimizer(o: Record<string, unknown>): Record<string, unknown> {
  const garde: Record<string, unknown> = {};
  for (const champ of CHAMPS_OPTIMIZER_SESSION) if (champ in o) garde[champ] = o[champ];
  return garde;
}

// ── Composer, écrire ────────────────────────────────────────────────────

// Le compte de la session : celui EN MÉMOIRE dans l'app (le dernier import),
// au schéma courant ; `null` sans compte (ni box, ni rune, ni artéfact).
export function compteDeSession(compte: Omit<StoredAccount, 'schema' | 'savedAt'>, maintenant: Date): StoredAccount | null {
  if (compte.box.length === 0 && compte.runes.length === 0 && compte.artifacts.length === 0) return null;
  return { schema: ACCOUNT_SCHEMA, savedAt: maintenant.getTime(), ...compte };
}

export function composerSession(s: SourcesSession): Session {
  const stockage: Session['stockage'] = {};
  for (const cle of CLES_SESSION) {
    const v = s.stockage[cle];
    if (typeof v === 'string') stockage[cle] = v;
  }
  const memoire: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(s.memoire)) {
    if (!(STICKY_HORS_SESSION as readonly string[]).includes(cle)) memoire[cle] = encoder(v);
  }
  return {
    format: FORMAT_SESSION,
    version: VERSION_SESSION,
    enregistreeLe: s.maintenant.toISOString(),
    versionApp: s.versionApp,
    stockage,
    compte: s.compte,
    outils: { memoire, optimizer: s.optimizer ? (encoder(garderChampsOptimizer(s.optimizer)) as Record<string, unknown>) : null },
  };
}

// Compact : le compte pèse quelques Mo, l'indentation les doublerait.
export const ecrireSession = (session: Session): string => JSON.stringify({ ...session, version: VERSION_SESSION });

// `swblacksmith-session-2026-10-06-15h42.json`, à l'heure locale.
export function nomFichierSession(d: Date): string {
  const n = (x: number) => String(x).padStart(2, '0');
  return `${PREFIXE_FICHIER}-session-${jourLocal(d)}-${n(d.getHours())}h${n(d.getMinutes())}.json`;
}

// ── Relire ──────────────────────────────────────────────────────────────

export type LectureSession =
  | { ok: true; session: Session; avertissements: string[] }
  | { ok: false; erreur: string };

export function lireSession(texte: string): LectureSession {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: 'Fichier illisible : ce n’est pas une sauvegarde de session.' };
  }
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) {
    return { ok: false, erreur: 'Fichier illisible : ce n’est pas une sauvegarde de session.' };
  }
  const o = brut as Record<string, unknown>;
  if (!formatReconnu(o.format, 'session')) {
    return { ok: false, erreur: 'Ce fichier n’est pas une sauvegarde de session (un autre export de l’app ?).' };
  }
  if (typeof o.version !== 'number' || !Number.isInteger(o.version) || o.version < 1) {
    return { ok: false, erreur: 'Sauvegarde de session abîmée : version illisible.' };
  }
  if (o.version > VERSION_SESSION) {
    return { ok: false, erreur: 'Cette sauvegarde vient d’une version plus récente de l’app : mets-la à jour pour la charger.' };
  }

  const avertissements: string[] = [];

  // Le stockage : chaque valeur est le TEXTE que l'app écrit. Une valeur qui
  // n'a pas la forme que son hook relit fait refuser le fichier : la charger
  // casserait la page qui la relit. Le point voyage comme texte opaque ; son
  // lecteur décide séparément s'il permet une reprise.
  const stockage: Session['stockage'] = {};
  const st = o.stockage;
  if (st !== undefined && (!st || typeof st !== 'object' || Array.isArray(st))) {
    return { ok: false, erreur: 'Sauvegarde de session abîmée : le travail est illisible.' };
  }
  for (const cle of CLES_SESSION) {
    const v = (st as Record<string, unknown> | undefined)?.[cle];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !valeurStockageValide(cle, v)) {
      return { ok: false, erreur: `Sauvegarde de session abîmée : « ${cle} » illisible.` };
    }
    stockage[cle] = v;
  }

  // Le compte : la même validation qu'à la relecture d'IndexedDB. Un compte
  // d'un schéma périmé n'empêche pas le reste : il est dit, et laissé.
  let compte: StoredAccount | null = null;
  if (o.compte !== undefined && o.compte !== null) {
    compte = compteValide(o.compte);
    if (!compte) avertissements.push('Le compte importé de cette sauvegarde n’est plus lisible : réimporte ton export SWEX.');
  }

  // Les outils.
  const out = (o.outils ?? {}) as Record<string, unknown>;
  const mem = out.memoire;
  const memoire: Record<string, unknown> = {};
  if (mem && typeof mem === 'object' && !Array.isArray(mem)) {
    for (const [cle, v] of Object.entries(mem)) {
      if (!(STICKY_HORS_SESSION as readonly string[]).includes(cle)) memoire[cle] = decoder(v);
    }
  }
  // L'Optimizer : les champs connus, et eux seuls. Leur FORME se vérifie au
  // chargement, contre l'état de l'écran — ici, seulement un objet.
  let optimizer: Record<string, unknown> | null = null;
  if (out.optimizer !== undefined && out.optimizer !== null) {
    if (typeof out.optimizer === 'object' && !Array.isArray(out.optimizer)) {
      optimizer = decoder(garderChampsOptimizer(out.optimizer as Record<string, unknown>)) as Record<string, unknown>;
    } else avertissements.push('Les critères de l’Optimizer de cette sauvegarde sont illisibles : ignorés.');
  }

  return {
    ok: true,
    avertissements,
    session: {
      format: FORMAT_SESSION,
      version: o.version,
      enregistreeLe: typeof o.enregistreeLe === 'string' ? o.enregistreeLe : '',
      versionApp: typeof o.versionApp === 'string' ? o.versionApp : '',
      stockage,
      compte,
      outils: { memoire, optimizer },
    },
  };
}
