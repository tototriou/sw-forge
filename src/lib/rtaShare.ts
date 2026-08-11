// Partage d'une prépa RTA entre joueurs, et instantané local de restauration.
// 100 % local : aucun envoi réseau, le contenu est téléchargé en fichier.
//
// ⚠️ **Deux usages, un seul modèle** (`RtaSnapshot`) :
//   - le **point de restauration** (« Sauvegarder » / « Reprendre ») vit dans le
//     `localStorage` du joueur ;
//   - le **fichier partagé** est le même contenu, sérialisé en JSON lisible.
// Un seul format évite qu'une prépa restaurée et une prépa importée ne suivent
// pas les mêmes règles — c'est la même chose vue de deux endroits.
//
// Conventions reprises telles quelles de [recoShare.ts](recoShare.ts), le
// précédent en la matière : clés françaises, validation qui REMONTE ses
// corrections au lieu de les taire, un seul format (JSON), un seul support
// (fichier `.json`).

import {
  RtaState,
  RtaEntry,
  RUNE_SETS,
  RTA_OTHER,
  RTA_UNASSIGNED,
  Monster,
  GearSet,
} from '../types';
import { RtaCategory } from '../hooks/useRtaCategories';

const SET_KEYS = new Set<string>(RUNE_SETS.map((s) => s.key));
// Sections acceptées : les sets de runes + les deux sections spéciales.
const isSectionKey = (k: string) => SET_KEYS.has(k) || k === RTA_OTHER || k === RTA_UNASSIGNED;

export const LABEL_MAX = 24; // libellé d'une catégorie (même borne que le hook)
export const NOM_MAX = 60; // nom de la prépa partagée
export const AUTEUR_MAX = 40;

/* --------------------------------------------------------------------------
 * Le modèle transporté
 * ----------------------------------------------------------------------- */

// Une entrée partagée. ⚠️ **`com2usId` et non l'id local** : c'est la seule clé
// stable d'un joueur à l'autre (même règle que les recommandations, voir
// ../../spec/siege/recommandations.md). Le `nom` sert de repli d'affichage si le
// monstre est absent des données chargées chez celui qui importe.
export interface RtaShareEntry {
  com2usId: number;
  nom: string;
  section: string;
  runeSpeed: number | null;
  sets?: string[]; // sets actifs, tels que calculés à l'import de compte
  // ⚠️ Présent SEULEMENT si l'auteur a choisi de partager son équipement.
  // C'est tout l'intérêt de consulter la prépa d'un ami : voir COMMENT il rune,
  // pas seulement quelle vitesse il vise.
  gear?: GearSet;
}

// Une catégorie partagée : l'appartenance est exprimée en `com2usId`, jamais en
// id local — sinon les anneaux atterriraient sur les mauvais monstres.
export interface RtaShareCategory {
  label: string;
  color: string;
  membres: number[]; // com2usId
}

// ⚠️ **L'équipement se partage, mais sur DÉCISION de l'auteur.** Consulter la
// prépa d'un ami sans voir comment il rune n'a pas grand intérêt — c'est
// justement ce qu'on vient y chercher. Mais son équipement dit aussi ce qu'il
// possède : certains ne veulent pas l'exposer. D'où un choix explicite à
// l'export (`avecEquipement`), et non une règle imposée dans un sens ou l'autre.
//
// ⚠️ Ce qui est reçu n'est JAMAIS mélangé à ce qu'on possède : une prépa
// importée s'ouvre **en consultation**, à côté de la sienne (voir
// ../../spec/rta/sauvegarde-partage.md). Elle ne remplace rien et ne se compare
// à rien.
export interface RtaSnapshot {
  nom: string;
  auteur: string;
  sections: string[];
  entries: RtaShareEntry[];
  categories: RtaShareCategory[];
  /** L'auteur a-t-il joint son équipement ? Sert à l'annoncer en consultation. */
  avecEquipement: boolean;
}

/* --------------------------------------------------------------------------
 * Conversion depuis / vers l'état de l'application
 * ----------------------------------------------------------------------- */

// Combien de monstres de la prépa sont réellement partageables ? Sert à prévenir
// AVANT l'export plutôt qu'à laisser découvrir un fichier incomplet.
export function comptePartageable(
  state: RtaState,
  monsterById: Map<string, Monster>
): { partageables: number; perso: number } {
  let partageables = 0;
  let perso = 0;
  for (const id of Object.keys(state.entries)) {
    const m = monsterById.get(id);
    if (m && m.com2usId != null) partageables++;
    else perso++;
  }
  return { partageables, perso };
}

// État de l'app → instantané transportable.
//
// ⚠️ Les **monstres perso** (`com2usId = null`) sont **écartés** : ils n'existent
// que dans le navigateur de leur auteur, rien ne permettrait de les retrouver
// ailleurs. C'est signalé à l'export, jamais silencieux.
export function toSnapshot(
  state: RtaState,
  categories: RtaCategory[],
  monsterById: Map<string, Monster>,
  meta: { nom?: string; auteur?: string; avecEquipement?: boolean } = {}
): RtaSnapshot {
  const avecEquipement = meta.avecEquipement !== false; // équipement joint par défaut
  const entries: RtaShareEntry[] = [];
  // id local → com2usId, pour traduire l'appartenance aux catégories.
  const com2usParId = new Map<string, number>();

  for (const e of Object.values(state.entries)) {
    const m = monsterById.get(e.monsterId);
    if (!m || m.com2usId == null) continue; // perso ou inconnu : non partageable
    com2usParId.set(e.monsterId, m.com2usId);
    entries.push({
      com2usId: m.com2usId,
      nom: m.name.slice(0, 40),
      section: isSectionKey(e.section) ? e.section : RTA_UNASSIGNED,
      runeSpeed: typeof e.runeSpeed === 'number' && Number.isFinite(e.runeSpeed) ? e.runeSpeed : null,
      // ⚠️ Sans équipement, les SETS ne partent pas non plus : ce sont eux qui
      // trahissent le runage. Ne garder que la vitesse visée, c'est bien le
      // sens de « partager sans montrer mes runes ».
      sets: avecEquipement ? e.sets : undefined,
      gear: avecEquipement ? e.gear : undefined,
    });
  }

  return {
    nom: (meta.nom ?? '').slice(0, NOM_MAX),
    auteur: (meta.auteur ?? '').slice(0, AUTEUR_MAX),
    sections: state.sections.filter(isSectionKey),
    entries,
    avecEquipement,
    // Une catégorie dont aucun membre n'est partageable est conservée quand même
    // (libellé + couleur ont une valeur en soi), mais vidée de fait.
    categories: categories.map((c) => ({
      label: c.label.slice(0, LABEL_MAX),
      color: c.color,
      membres: c.members
        .map((id) => com2usParId.get(id))
        .filter((v): v is number => typeof v === 'number'),
    })),
  };
}

// Une prépa reçue, prête à être AFFICHÉE — jamais fusionnée avec la sienne.
//
// ⚠️ **Rien n'est comparé à ce que je possède.** Les monstres et les runes
// affichés sont ceux de l'auteur, tels quels. Confronter à ma box répondrait à
// une autre question (« puis-je jouer ça ? ») — c'est le rôle des
// [recommandations de siège](../../spec/siege/recommandations.md), qui existent
// précisément pour ça. Ici on regarde la prépa d'un ami comme on regarderait
// son écran par-dessus son épaule.
export interface RtaVueAmi {
  nom: string;
  auteur: string;
  avecEquipement: boolean;
  sections: string[];
  /** Monstres résolus dans le bestiaire local (le portrait, le nom, les stats). */
  entries: { monster: Monster; entry: RtaEntry }[];
  categories: { label: string; color: string; members: Set<string> }[];
  /** `com2usId` absents des données chargées : annoncés, jamais avalés. */
  inconnus: number[];
}

// Instantané → état de l'app, pour REPRENDRE une prépa à soi (archive, autre
// navigateur, sauvegarde d'il y a six mois).
//
// ⚠️ **Deux lectures d'un même fichier, deux fonctions.** `versVueAmi` affiche
// la prépa de quelqu'un d'autre sans y toucher ; `appliquer` la fait sienne. Le
// fichier est le même — c'est l'INTENTION qui diffère, et elle ne se devine pas :
// l'utilisateur la déclare en choisissant son bouton.
//
// ⚠️ **Le `gear` local prime.** Un monstre déjà présent garde l'équipement venu
// de MON import de compte : c'est l'état réel de mes runes aujourd'hui, plus
// juste que celui figé dans un fichier ancien. L'équipement du fichier ne sert
// qu'à combler les monstres que je n'ai pas encore.
export function appliquer(
  snap: RtaSnapshot,
  monsterByCom2us: Map<number, Monster>,
  actuel: RtaState
): {
  state: RtaState;
  categories: { label: string; color: string; members: string[] }[];
  inconnus: number[];
} {
  const entries: Record<string, RtaEntry> = {};
  const idParCom2us = new Map<number, string>();
  const inconnus: number[] = [];

  for (const e of snap.entries) {
    const m = monsterByCom2us.get(e.com2usId);
    if (!m) {
      if (!inconnus.includes(e.com2usId)) inconnus.push(e.com2usId);
      continue;
    }
    const id = String(m.id);
    idParCom2us.set(e.com2usId, id);
    const precedent = actuel.entries[id];
    entries[id] = {
      monsterId: id,
      section: e.section,
      runeSpeed: e.runeSpeed,
      sets: precedent?.sets ?? e.sets,
      gear: precedent?.gear ?? e.gear,
    };
  }

  const sections = [...snap.sections];
  if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER); // « Autre » est permanente

  return {
    state: { sections, entries },
    categories: snap.categories.map((c) => ({
      label: c.label,
      color: c.color,
      members: c.membres
        .map((cid) => idParCom2us.get(cid))
        .filter((v): v is string => typeof v === 'string'),
    })),
    inconnus,
  };
}

// Instantané → vue consultable. Les entrées portent les runes de L'AUTEUR : ce
// sont des données d'affichage, elles n'entrent jamais dans l'état de l'app.
export function versVueAmi(snap: RtaSnapshot, monsterByCom2us: Map<number, Monster>): RtaVueAmi {
  const entries: { monster: Monster; entry: RtaEntry }[] = [];
  const idParCom2us = new Map<number, string>();
  const inconnus: number[] = [];

  for (const e of snap.entries) {
    const m = monsterByCom2us.get(e.com2usId);
    if (!m) {
      if (!inconnus.includes(e.com2usId)) inconnus.push(e.com2usId);
      continue; // monstre absent des données : rien à afficher
    }
    const id = String(m.id);
    idParCom2us.set(e.com2usId, id);
    entries.push({
      monster: m,
      entry: {
        monsterId: id,
        section: e.section,
        runeSpeed: e.runeSpeed,
        sets: e.sets ?? [],
        gear: e.gear,
      },
    });
  }

  const sections = [...snap.sections];
  if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER); // « Autre » est permanente

  return {
    nom: snap.nom,
    auteur: snap.auteur,
    avecEquipement: snap.avecEquipement,
    sections,
    entries,
    categories: snap.categories.map((c) => ({
      label: c.label,
      color: c.color,
      members: new Set(
        c.membres.map((cid) => idParCom2us.get(cid)).filter((v): v is string => typeof v === 'string')
      ),
    })),
    inconnus,
  };
}

/* --------------------------------------------------------------------------
 * Validation — le contenu vient d'un tiers, on ne lui fait pas confiance
 * ----------------------------------------------------------------------- */

export interface Issues {
  errors: string[]; // bloquants : rien n'est importé
  warnings: string[]; // corrections appliquées : l'import a lieu quand même
}

const noIssues = (): Issues => ({ errors: [], warnings: [] });

// Une même correction peut se répéter sur 80 monstres : on ne l'écrit qu'une fois.
function warn(ctx: Issues, msg: string) {
  if (!ctx.warnings.includes(msg)) ctx.warnings.push(msg);
}

// L'équipement reçu d'un tiers. Il n'est utilisé QU'À L'AFFICHAGE (roue de
// runes, stats totales de l'auteur) : il n'entre jamais dans la prépa locale, ne
// se compare à rien et n'est jamais réexporté comme s'il était à nous.
//
// ⚠️ Validation structurelle seulement — types et bornes. On ne juge pas la
// **plausibilité** des valeurs : un socle de rune inhabituel peut venir d'une
// nouveauté du jeu que cette version ne connaît pas encore, et refuser
// l'affichage serait pire que montrer un chiffre surprenant.
function cleanEffect(raw: unknown): { code: number; value: number; grind?: number; enchant?: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const code = Number(o.code);
  const value = Number(o.value);
  if (!Number.isFinite(code) || !Number.isFinite(value)) return null;
  const grind = Number(o.grind);
  return {
    code,
    value,
    ...(Number.isFinite(grind) && grind !== 0 ? { grind } : {}),
    ...(o.enchant === true ? { enchant: true } : {}),
  };
}

const nombre = (v: unknown, defaut = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

function cleanGear(raw: unknown): GearSet | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;

  const b = (o.base ?? {}) as Record<string, unknown>;
  const base = {
    hp: nombre(b.hp),
    atk: nombre(b.atk),
    def: nombre(b.def),
    spd: nombre(b.spd),
    cr: nombre(b.cr),
    cd: nombre(b.cd),
    res: nombre(b.res),
    acc: nombre(b.acc),
  };

  const runes = (Array.isArray(o.runes) ? o.runes : [])
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      const ro = r as Record<string, unknown>;
      const main = cleanEffect(ro.main);
      if (!main) return null; // une rune sans stat principale n'est pas affichable
      const slot = nombre(ro.slot);
      const set = typeof ro.set === 'string' && SET_KEYS.has(ro.set) ? ro.set : null;
      if (slot < 1 || slot > 6 || !set) return null;
      const innate = cleanEffect(ro.innate);
      return {
        id: nombre(ro.id),
        slot: Math.round(slot),
        set,
        rank: nombre(ro.rank),
        rarity: nombre(ro.rarity, 1),
        level: nombre(ro.level),
        main,
        ...(innate ? { innate } : {}),
        subs: (Array.isArray(ro.subs) ? ro.subs : [])
          .map(cleanEffect)
          .filter((s): s is NonNullable<ReturnType<typeof cleanEffect>> => !!s),
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  const artifacts = (Array.isArray(o.artifacts) ? o.artifacts : [])
    .map((a) => {
      if (!a || typeof a !== 'object') return null;
      const ao = a as Record<string, unknown>;
      const main = cleanEffect(ao.main);
      const kind = ao.kind === 'element' || ao.kind === 'archetype' ? ao.kind : null;
      if (!main || !kind) return null;
      return {
        kind,
        ...(typeof ao.element === 'string' ? { element: ao.element as GearSet['artifacts'][number]['element'] } : {}),
        ...(typeof ao.archetype === 'string'
          ? { archetype: ao.archetype as GearSet['artifacts'][number]['archetype'] }
          : {}),
        level: nombre(ao.level),
        rarity: nombre(ao.rarity, 1),
        main,
        subs: (Array.isArray(ao.subs) ? ao.subs : [])
          .map(cleanEffect)
          .filter((s): s is NonNullable<ReturnType<typeof cleanEffect>> => !!s),
      };
    })
    .filter((a): a is NonNullable<typeof a> => !!a);

  const relicMain = cleanEffect((o.relic as Record<string, unknown>)?.main);
  const relicSub = cleanEffect((o.relic as Record<string, unknown>)?.sub);

  // Un équipement entièrement vide ne vaut pas la peine d'être transporté :
  // il ferait apparaître un chevron « voir le détail » qui n'ouvre rien.
  if (runes.length === 0 && artifacts.length === 0 && !relicMain) return undefined;

  return {
    base,
    runes,
    artifacts,
    ...(relicMain ? { relic: { main: relicMain, ...(relicSub ? { sub: relicSub } : {}) } } : {}),
  } as GearSet;
}

function cleanEntry(raw: unknown, ctx: Issues, where: string): RtaShareEntry | null {
  if (!raw || typeof raw !== 'object') {
    warn(ctx, `${where} : entrée invalide — ignorée.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = Number(o.com2usId);
  if (!Number.isFinite(id) || id <= 0) {
    warn(ctx, `${where} : « com2usId » invalide (${String(o.com2usId)}) — monstre ignoré.`);
    return null;
  }

  const nom = o.nom ?? o.name;
  const brutSection = o.section;
  let section = typeof brutSection === 'string' ? brutSection : RTA_UNASSIGNED;
  if (!isSectionKey(section)) {
    warn(ctx, `${where} : section inconnue « ${String(brutSection)} » — rangé en « Non classé ».`);
    section = RTA_UNASSIGNED;
  }

  // Vitesse : `null` est une valeur légitime (« pas encore saisie »), à ne pas
  // confondre avec une valeur aberrante.
  const brutVitesse = o.runeSpeed ?? o.vitesse;
  let runeSpeed: number | null = null;
  if (brutVitesse != null) {
    const n = Number(brutVitesse);
    if (!Number.isFinite(n) || n < 0) {
      warn(ctx, `${where} : vitesse invalide (${String(brutVitesse)}) — laissée vide.`);
    } else {
      runeSpeed = Math.round(n);
    }
  }

  const sets = (Array.isArray(o.sets) ? o.sets : []).filter(
    (s): s is string => typeof s === 'string' && SET_KEYS.has(s)
  );

  return {
    com2usId: Math.round(id),
    nom: typeof nom === 'string' ? nom.slice(0, 40) : '',
    section,
    runeSpeed,
    ...(sets.length ? { sets } : {}),
    ...(() => {
      const gear = cleanGear(o.equipement ?? o.gear);
      return gear ? { gear } : {};
    })(),
  };
}

function cleanCategory(raw: unknown, ctx: Issues, where: string): RtaShareCategory | null {
  if (!raw || typeof raw !== 'object') {
    warn(ctx, `${where} : catégorie invalide — ignorée.`);
    return null;
  }
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, LABEL_MAX) : '';
  const color = typeof o.color === 'string' && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null;
  if (!label || !color) {
    warn(ctx, `${where} : catégorie sans libellé ou sans couleur valide — ignorée.`);
    return null;
  }
  const brut = o.membres ?? o.members;
  const membres: number[] = [];
  if (Array.isArray(brut)) {
    for (const v of brut) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0 && !membres.includes(Math.round(n))) membres.push(Math.round(n));
    }
  }
  return { label, color, membres };
}

/* --------------------------------------------------------------------------
 * Format JSON — celui des FICHIERS échangés
 * ----------------------------------------------------------------------- */

export const JSON_FORMAT = 'sw-forge/prepa-rta';
// v2 : l'**équipement** (runes, artéfacts, relique) peut accompagner chaque
// monstre — c'est ce qu'on vient voir dans la prépa d'un ami. Il reste
// facultatif : l'auteur choisit à l'export. Un fichier v1 se lit sans perte, il
// n'a simplement rien à montrer côté runes.
export const JSON_VERSION = 2;

// Clés en clair (français, comme l'interface) : un joueur peut ouvrir le
// fichier, le relire et le corriger sans décodeur.
export function encodeSnapshot(snap: RtaSnapshot): string {
  return JSON.stringify(
    {
      format: JSON_FORMAT,
      version: JSON_VERSION,
      exporte_le: new Date().toISOString(),
      nom: snap.nom,
      auteur: snap.auteur,
      // Annoncé dans le fichier : le lecteur sait si l'absence de runes est un
      // choix de l'auteur ou un fichier d'une version antérieure.
      avec_equipement: snap.avecEquipement,
      sections: snap.sections,
      monstres: snap.entries.map((e) => ({
        com2usId: e.com2usId,
        nom: e.nom,
        section: e.section,
        vitesse: e.runeSpeed,
        sets: e.sets?.length ? e.sets : undefined,
        equipement: e.gear,
      })),
      // Omises si vides : une prépa sans catégorie ne traîne pas une liste vide.
      categories: snap.categories.length
        ? snap.categories.map((c) => ({ label: c.label, color: c.color, membres: c.membres }))
        : undefined,
    },
    null,
    2
  );
}

export interface ImportReport extends Issues {
  snapshot: RtaSnapshot | null; // null = rien d'importable
  counts: { monstres: number; sections: number; categories: number; avecRunes: number };
}

// **Validateur d'import** — JSON uniquement. Rend compte de ce qu'il a lu :
// erreurs bloquantes ET corrections appliquées.
export function validateRtaImport(text: string): ImportReport {
  const ctx = noIssues();
  const vide: ImportReport = {
    ...ctx,
    snapshot: null,
    counts: { monstres: 0, sections: 0, categories: 0, avecRunes: 0 },
  };

  const t = text.trim();
  if (!t) {
    ctx.errors.push('Contenu vide.');
    return { ...vide, ...ctx };
  }
  // Message explicite plutôt qu'une erreur de parseur cryptique.
  if (!t.startsWith('{')) {
    ctx.errors.push("Attendu un JSON de prépa RTA (fichier .json d'export SW Forge).");
    return { ...vide, ...ctx };
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(t) as Record<string, unknown>;
  } catch (e) {
    ctx.errors.push(`JSON invalide : ${(e as Error).message}`);
    return { ...vide, ...ctx };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    ctx.errors.push('Le JSON doit être un objet contenant une clé « monstres ».');
    return { ...vide, ...ctx };
  }

  if (typeof obj.format === 'string' && obj.format !== JSON_FORMAT) {
    // Erreur BLOQUANTE et non simple avertissement : importer une prépa
    // REMPLACE la prépa en cours. Se tromper de fichier (une recommandation de
    // siège, par exemple) coûterait le classement en place.
    ctx.errors.push(
      `Ce fichier est un export « ${obj.format} », pas une prépa RTA (« ${JSON_FORMAT} »).`
    );
    return { ...vide, ...ctx };
  }

  const version = Number(obj.version);
  if (Number.isFinite(version) && version > JSON_VERSION) {
    warn(
      ctx,
      `Fichier au format v${version}, plus récent que cette version de SW Forge (v${JSON_VERSION}) — ` +
        `ce qui n'est pas reconnu a été ignoré.`
    );
  } else if (Number.isFinite(version) && version < JSON_VERSION) {
    // Lu sans perte, mais signalé : sinon un fichier ancien circule
    // indéfiniment dans la guilde et personne ne sait qu'il peut désormais
    // porter les runes (même raisonnement que pour les recommandations).
    warn(
      ctx,
      `Fichier au format v${version} (actuel : v${JSON_VERSION}) : il ne contient pas les runes. ` +
        `Demande à son auteur de le réexporter pour les voir.`
    );
  }

  const brutMonstres = Array.isArray(obj.monstres)
    ? obj.monstres
    : Array.isArray(obj.entries)
      ? obj.entries
      : null;
  if (!brutMonstres) {
    ctx.errors.push("Clé « monstres » absente ou invalide : ce n'est pas un export de prépa RTA.");
    return { ...vide, ...ctx };
  }

  const entries: RtaShareEntry[] = [];
  const vus = new Set<number>();
  brutMonstres.forEach((raw, i) => {
    const e = cleanEntry(raw, ctx, `Monstre ${i + 1}`);
    if (!e) return;
    // Une seule carte par monstre, comme dans l'app : le doublon est écarté.
    if (vus.has(e.com2usId)) {
      warn(ctx, `« ${e.nom || e.com2usId} » apparaît plusieurs fois — seule la première entrée est gardée.`);
      return;
    }
    vus.add(e.com2usId);
    entries.push(e);
  });

  if (entries.length === 0) {
    ctx.errors.push('Aucun monstre exploitable dans ce fichier.');
    return { ...vide, ...ctx };
  }

  // Sections : celles du fichier, plus celles qu'exigent les monstres reçus —
  // un monstre rangé dans une section absente de la liste deviendrait invisible.
  const sections: string[] = [];
  const brutSections = Array.isArray(obj.sections) ? obj.sections : [];
  for (const s of brutSections) {
    if (typeof s !== 'string' || !isSectionKey(s) || s === RTA_UNASSIGNED) continue;
    if (!sections.includes(s)) sections.push(s);
  }
  for (const e of entries) {
    if (e.section !== RTA_UNASSIGNED && !sections.includes(e.section)) sections.push(e.section);
  }
  if (!sections.includes(RTA_OTHER)) sections.push(RTA_OTHER);

  const categories: RtaShareCategory[] = [];
  const brutCats = Array.isArray(obj.categories) ? obj.categories : [];
  brutCats.forEach((raw, i) => {
    const c = cleanCategory(raw, ctx, `Catégorie ${i + 1}`);
    if (c) categories.push(c);
  });

  const nom = typeof obj.nom === 'string' ? obj.nom.slice(0, NOM_MAX) : '';
  const auteur = typeof obj.auteur === 'string' ? obj.auteur.slice(0, AUTEUR_MAX) : '';

  // ⚠️ Ce qu'on a RÉELLEMENT lu prime sur ce que le fichier déclare : un
  // `avec_equipement: true` sans la moindre rune afficherait « runes incluses »
  // sur une prépa qui n'en montre aucune.
  const avecEquipement = entries.some((e) => e.gear);

  return {
    ...ctx,
    snapshot: { nom, auteur, sections, entries, categories, avecEquipement },
    counts: {
      monstres: entries.length,
      sections: sections.length,
      categories: categories.length,
      avecRunes: entries.filter((e) => e.gear).length,
    },
  };
}

// Nom de fichier propre pour le téléchargement.
export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // marques diacritiques laissées par NFD
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'prepa'
  );
}
