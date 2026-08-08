// Partage d'un lot de recommandations de decks de siège entre joueurs.
// 100 % local : aucun envoi réseau, le contenu est copié/collé ou téléchargé.
//
// **UN SEUL format : le JSON** (clés en clair, éditable à la main, inspectable
// avant import). Un format compact base64 a existé un temps en parallèle ; il a
// été retiré — deux formats pour la même chose, c'est deux fois plus de surface
// à valider pour aucun gain, et un contenu opaque que personne ne peut relire.

import { Reco, RecoDeck, RecoPayload, RecoSlot, RecoStatKey, RECO_STATS, RUNE_SETS } from '../types';
import { canAddSet } from './effects';

const STAT_KEYS = new Set<string>(RECO_STATS.map((s) => s.key));
const SET_KEYS = new Set<string>(RUNE_SETS.map((s) => s.key));

// Longueurs max des consignes (le texte est encodé dans le code partagé).
export const NOTE_MAX = 600; // consignes globales de la recommandation
export const DECK_NOTE_MAX = 400; // consignes d'un deck

/* Validations du contenu reçu : on ne lui fait jamais confiance. Un
   « collecteur » permet de REMONTER ce qui a été corrigé au lieu de le taire
   (voir `validateRecosImport`). */

export interface Issues {
  errors: string[]; // bloquants : rien n'est importé
  warnings: string[]; // corrections appliquées : l'import a lieu quand même
}

const noIssues = (): Issues => ({ errors: [], warnings: [] });
// Une même correction peut se répéter sur 50 decks : on ne l'écrit qu'une fois.
function warn(ctx: Issues, msg: string) {
  if (!ctx.warnings.includes(msg)) ctx.warnings.push(msg);
}

// Stats : seules les clés connues, valeurs numériques > 0.
function cleanStats(raw: unknown, ctx: Issues, where: string): Partial<Record<RecoStatKey, number>> {
  const out: Partial<Record<RecoStatKey, number>> = {};
  if (raw == null) return out;
  if (typeof raw !== 'object') {
    warn(ctx, `${where} : « stats » n'est pas un objet — ignoré.`);
    return out;
  }
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!STAT_KEYS.has(k)) {
      warn(ctx, `${where} : stat inconnue « ${k} » ignorée.`);
      continue;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      warn(ctx, `${where} : valeur invalide pour « ${k} » (${String(v)}) — ignorée.`);
      continue;
    }
    out[k as RecoStatKey] = Math.ceil(n);
  }
  return out;
}

// Sets : seules les clés connues, et une combinaison qui tient dans 6 runes
// (un fichier JSON édité à la main pourrait demander 4+4).
function cleanSets(raw: unknown, ctx: Issues, where: string): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    warn(ctx, `${where} : « sets » n'est pas une liste — ignoré.`);
    return [];
  }
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== 'string' || !SET_KEYS.has(k)) {
      warn(ctx, `${where} : set inconnu « ${String(k)} » ignoré.`);
      continue;
    }
    if (!canAddSet(out, k)) {
      warn(ctx, `${where} : set « ${k} » ignoré, la combinaison dépasserait 6 runes.`);
      continue;
    }
    out.push(k);
  }
  return out;
}

// Texte borné, en signalant la troncature.
function cleanText(raw: unknown, max: number, ctx: Issues, where: string): string {
  if (typeof raw !== 'string') return '';
  if (raw.length > max) {
    warn(ctx, `${where} : texte tronqué à ${max} caractères.`);
    return raw.slice(0, max);
  }
  return raw;
}

/* --------------------------------------------------------------------------
 * Format JSON lisible — celui des FICHIERS échangés
 * ----------------------------------------------------------------------- */

export const JSON_FORMAT = 'sw-forge/recommandations';
export const JSON_VERSION = 2;

// Clés en clair (français, comme l'interface) pour qu'un joueur puisse ouvrir
// le fichier, le relire et le corriger sans décodeur.
function recoToJson(r: Reco) {
  const out = noIssues(); // à l'écriture les données viennent de l'app : rien à signaler
  return {
    nom: r.name.slice(0, 60),
    auteur: r.author.slice(0, 40),
    consignes: r.note.slice(0, NOTE_MAX),
    decks: r.decks
      .filter((d) => d.slots.some((s) => s.com2usId != null))
      .map((d) => ({
        nom: d.name.slice(0, 40),
        consignes: d.note.slice(0, DECK_NOTE_MAX),
        monstres: d.slots.map((sl) =>
          sl.com2usId == null
            ? null
            : {
                com2usId: sl.com2usId,
                nom: sl.name.slice(0, 40),
                sets: cleanSets(sl.sets, out, ''),
                stats: cleanStats(sl.stats, out, ''),
              }
        ),
      })),
  };
}

// Sérialise en JSON indenté (fichier destiné à être lu par un humain).
export function encodeRecosJson(recos: Reco[]): string {
  const utiles = recos.filter((r) => r.decks.some((d) => d.slots.some((s) => s.com2usId != null)));
  return JSON.stringify(
    {
      format: JSON_FORMAT,
      version: JSON_VERSION,
      exporte_le: new Date().toISOString(),
      recommandations: utiles.map(recoToJson),
    },
    null,
    2
  );
}

// Lecture tolérante d'un slot au format lisible. Les clés anglaises (celles du
// modèle interne) sont acceptées en plus des françaises : un fichier bricolé à
// partir des types passe quand même.
function jsonToSlot(raw: unknown, ctx: Issues, where: string): RecoSlot {
  if (raw == null) return { com2usId: null, name: '', stats: {}, sets: [] };
  if (typeof raw !== 'object') {
    warn(ctx, `${where} : entrée invalide — slot laissé vide.`);
    return { com2usId: null, name: '', stats: {}, sets: [] };
  }
  const o = raw as Record<string, unknown>;
  const nom = o.nom ?? o.name;
  const rawId = o.com2usId;
  const id = Number(rawId);
  const valide = Number.isFinite(id) && id > 0;
  if (rawId != null && !valide) {
    warn(ctx, `${where} : « com2usId » invalide (${String(rawId)}) — slot laissé vide.`);
  }
  return {
    com2usId: valide ? Math.round(id) : null,
    name: typeof nom === 'string' ? nom.slice(0, 40) : '',
    stats: cleanStats(o.stats, ctx, where),
    sets: cleanSets(o.sets, ctx, where),
  };
}

function jsonToDeck(raw: unknown, ctx: Issues, where: string): RecoDeck {
  const o = (raw ?? {}) as Record<string, unknown>;
  const nom = o.nom ?? o.name;
  const note = o.consignes ?? o.note;
  const name = typeof nom === 'string' ? nom.slice(0, 40) : '';
  const label = name ? `${where} « ${name} »` : where;
  const slots = (
    Array.isArray(o.monstres) ? o.monstres : Array.isArray(o.slots) ? o.slots : []
  ) as unknown[];
  if (slots.length > 3) {
    warn(ctx, `${label} : ${slots.length} monstres — seuls les 3 premiers sont gardés.`);
  }
  return {
    name,
    note: cleanText(note, DECK_NOTE_MAX, ctx, label),
    slots: [0, 1, 2].map((i) => jsonToSlot(slots[i], ctx, `${label}, monstre ${i + 1}`)),
  };
}

// Décode un fichier JSON de recommandations. Renvoie null si ce n'est pas un
// export reconnaissable (on n'essaie pas de deviner n'importe quelle structure).
export function decodeRecosJson(text: string, ctx: Issues = noIssues()): RecoPayload[] | null {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch (e) {
    ctx.errors.push(`JSON invalide : ${(e as Error).message}`);
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    ctx.errors.push("Le JSON doit être un objet contenant une clé « recommandations ».");
    return null;
  }
  if (typeof obj.format === 'string' && obj.format !== JSON_FORMAT) {
    warn(ctx, `Format déclaré « ${obj.format} » (attendu « ${JSON_FORMAT} ») — lecture tentée quand même.`);
  }
  const list = (
    Array.isArray(obj.recommandations) ? obj.recommandations : Array.isArray(obj.recos) ? obj.recos : null
  ) as unknown[] | null;
  if (!list) {
    ctx.errors.push("Clé « recommandations » absente ou invalide : ce n'est pas un export SW Forge.");
    return null;
  }
  if (list.length === 0) {
    ctx.errors.push('Le fichier ne contient aucune recommandation.');
    return null;
  }

  const out: RecoPayload[] = [];
  list.forEach((raw, ri) => {
    if (!raw || typeof raw !== 'object') {
      warn(ctx, `Recommandation ${ri + 1} ignorée : entrée invalide.`);
      return;
    }
    const r = raw as Record<string, unknown>;
    const nom = r.nom ?? r.name;
    const name = typeof nom === 'string' && nom.trim() ? nom.slice(0, 60) : 'Recommandation';
    const label = `« ${name} »`;
    const rawDecks = Array.isArray(r.decks) ? r.decks : [];
    if (rawDecks.length === 0) warn(ctx, `${label} : aucune liste « decks ».`);
    const decks = rawDecks
      .map((d, di) => jsonToDeck(d, ctx, `${label}, deck ${di + 1}`))
      .filter((d) => {
        if (d.slots.some((s) => s.com2usId != null)) return true;
        warn(ctx, `${label} : un deck sans aucun monstre a été ignoré.`);
        return false;
      });
    if (decks.length === 0) {
      warn(ctx, `${label} ignorée : aucun deck exploitable.`);
      return;
    }
    const auteur = r.auteur ?? r.author;
    const consignes = r.consignes ?? r.note;
    out.push({
      name,
      author: typeof auteur === 'string' ? auteur.slice(0, 40) : '',
      note: cleanText(consignes, NOTE_MAX, ctx, label),
      decks,
    });
  });

  if (out.length === 0) {
    ctx.errors.push('Aucune recommandation exploitable dans ce fichier.');
    return null;
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Validateur d'import
 * ----------------------------------------------------------------------- */

export interface ImportReport extends Issues {
  recos: RecoPayload[] | null; // null = rien d'importable
  counts: { recos: number; decks: number; monstres: number };
}

// **Validateur d'import** — JSON uniquement (fichier `.json` ou texte collé).
// Rend compte de ce qu'il a lu : erreurs bloquantes ET corrections appliquées
// (clés inconnues, valeurs hors bornes, decks vides…).
export function validateRecosImport(text: string): ImportReport {
  const ctx = noIssues();
  const empty: ImportReport = { ...ctx, recos: null, counts: { recos: 0, decks: 0, monstres: 0 } };

  const t = text.trim();
  if (!t) {
    ctx.errors.push('Contenu vide.');
    return { ...empty, ...ctx };
  }
  // Message explicite plutôt qu'une erreur de parseur cryptique si on colle
  // autre chose qu'un JSON.
  if (!t.startsWith('{') && !t.startsWith('[')) {
    ctx.errors.push(
      "Attendu un JSON de recommandations (fichier .json d'export ou son contenu collé)."
    );
    return { ...empty, ...ctx };
  }

  const recos = decodeRecosJson(t, ctx);
  if (!recos) return { ...empty, ...ctx };

  const decks = recos.reduce((n, r) => n + r.decks.length, 0);
  const monstres = recos.reduce(
    (n, r) => n + r.decks.reduce((m, d) => m + d.slots.filter((s) => s.com2usId != null).length, 0),
    0
  );
  return { ...ctx, recos, counts: { recos: recos.length, decks, monstres } };
}

// Nom de fichier propre pour le téléchargement (« Def anti-Trevor » → « def-anti-trevor »).
export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // marques diacritiques laissées par NFD
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'recos'
  );
}
