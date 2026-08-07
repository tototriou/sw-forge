// Parse un export de compte Summoners War (format SWEX) — 100% côté navigateur.
//
// Deux imports distincts sont exposés :
//  - parseAccountJson : la BOX RTA (World Arena) — favoris RTA + vitesse des
//    runes RTA (chaque monstre a son propre preset de runes World Arena).
//  - parseSiegeDefense : les DÉFENSES de combat de guilde (siège) — jusqu'à 6
//    decks de 3 monstres, avec les runes propres à chaque défense de siège.

const RUNE_EFF_SPEED = 8; // type d'effet « Vitesse » dans les données com2us
const RUNE_SET_SWIFT = 3; // set_id du set Swift

/* --------------------------------------------------------------------------
 * Helpers partagés
 * ----------------------------------------------------------------------- */

// Somme des SPD apportées par une rune (mainstat + prefix + substats avec meule).
function runeSpeed(rune: any): number {
  let s = 0;
  const pri = rune?.pri_eff;
  if (Array.isArray(pri) && Number(pri[0]) === RUNE_EFF_SPEED) s += Number(pri[1]) || 0;
  const prefix = rune?.prefix_eff;
  if (Array.isArray(prefix) && Number(prefix[0]) === RUNE_EFF_SPEED) s += Number(prefix[1]) || 0;
  const sec = rune?.sec_eff;
  if (Array.isArray(sec)) {
    for (const e of sec) {
      if (Array.isArray(e) && Number(e[0]) === RUNE_EFF_SPEED) {
        s += (Number(e[1]) || 0) + (Number(e[3]) || 0); // valeur + meule
      }
    }
  }
  return s;
}

// Index de TOUTES les runes par rune_id : inventaire (top-level `runes`) +
// runes équipées dans les unités. Un preset (RTA ou siège) peut réutiliser n'importe laquelle.
function indexRunes(data: any): Map<number, any> {
  const runeById = new Map<number, any>();
  const add = (r: any) => {
    const id = Number(r?.rune_id);
    if (Number.isFinite(id)) runeById.set(id, r);
  };
  if (Array.isArray(data?.runes)) data.runes.forEach(add);
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) if (Array.isArray(u?.runes)) u.runes.forEach(add);
  }
  return runeById;
}

// Index des unités possédées par unit_id.
function indexUnits(data: any): Map<number, any> {
  const unitById = new Map<number, any>();
  if (Array.isArray(data?.unit_list)) {
    for (const u of data.unit_list) {
      const uid = Number(u?.unit_id);
      if (Number.isFinite(uid)) unitById.set(uid, u);
    }
  }
  return unitById;
}

// SPD des runes + comptage Swift pour un lot de rune_id donné.
function speedFromRuneIds(runeIds: any[], runeById: Map<number, any>): {
  flatRuneSpeed: number;
  swift: boolean;
} {
  let flatRuneSpeed = 0;
  let swiftCount = 0;
  for (const rid of runeIds) {
    const rune = runeById.get(Number(rid));
    if (!rune) continue;
    if (Number(rune?.set_id) === RUNE_SET_SWIFT) swiftCount++;
    flatRuneSpeed += runeSpeed(rune);
  }
  return { flatRuneSpeed, swift: swiftCount >= 4 };
}

// set_id com2us → clé de RUNE_SETS + nombre de runes requis pour activer le set.
const SET_ID_KEY: Record<number, string> = {
  1: 'energy', 2: 'guard', 3: 'swift', 4: 'blade', 5: 'rage', 6: 'focus', 7: 'endure',
  8: 'fatal', 10: 'despair', 11: 'vampire', 13: 'violent', 14: 'nemesis', 15: 'will',
  16: 'shield', 17: 'revenge', 18: 'destroy', 19: 'fight', 20: 'determination',
  21: 'enhance', 22: 'accuracy', 23: 'tolerance', 24: 'seal', 25: 'intangible',
};
const SET_PIECES: Record<number, number> = {
  // Seuls sets 4 pièces : Swift, Rage, Fatal, Despair, Vampire, Violent.
  // (tous les autres, dont Destroy, sont 2 pièces → valeur par défaut)
  3: 4, 5: 4, 8: 4, 10: 4, 11: 4, 13: 4,
};
const RUNE_SET_INTANGIBLE = 25; // rune « joker » : complète n'importe quel set

// Sets de runes ACTIFS d'un build (ex. ['swift','will']). Un set 4 pièces
// s'active à 4 runes, les autres à 2. Une rune Intangible sert de joker et
// complète le set le plus proche d'être plein.
function activeSetsFromRuneIds(runeIds: any[], runeById: Map<number, any>): string[] {
  const count = new Map<number, number>();
  let jokers = 0; // runes Intangible disponibles
  for (const rid of runeIds) {
    const rune = runeById.get(Number(rid));
    if (!rune) continue;
    const sid = Number(rune?.set_id);
    if (!Number.isFinite(sid)) continue;
    if (sid === RUNE_SET_INTANGIBLE) jokers++;
    else count.set(sid, (count.get(sid) ?? 0) + 1);
  }

  const out: string[] = [];
  const partial: { key: string; missing: number }[] = [];
  for (const [sid, n] of count) {
    const key = SET_ID_KEY[sid];
    if (!key) continue;
    const req = SET_PIECES[sid] ?? 2;
    for (let i = 0; i < Math.floor(n / req); i++) out.push(key);
    const rem = n % req;
    if (rem > 0) partial.push({ key, missing: req - rem });
  }

  // L'Intangible complète en priorité le set auquel il manque le moins.
  partial.sort((a, b) => a.missing - b.missing);
  for (const p of partial) {
    if (jokers >= p.missing) {
      out.push(p.key);
      jokers -= p.missing;
    }
  }
  return out;
}

// Aplati récursivement une structure d'ids (gère les groupes imbriqués
// [[...],[...]]) et renvoie les nombres valides.
function flattenIds(value: any, out: Set<number>) {
  if (Array.isArray(value)) {
    for (const v of value) flattenIds(v, out);
  } else {
    const n = Number(value);
    if (Number.isFinite(n)) out.add(n);
  }
}

/* --------------------------------------------------------------------------
 * Import BOX RTA
 * ----------------------------------------------------------------------- */

export interface ImportedUnit {
  com2usId: number;
  flatRuneSpeed: number; // SPD plate cumulée des runes RTA
  swift: boolean; // set Swift complet (4 runes) équipé en RTA
}

export interface ParseResult {
  units: ImportedUnit[];
  error?: string;
}

// Collecte les unit_id des monstres « utilisés souvent » (favoris), en gérant
// les deux formats d'export connus :
//  - récent : favorite_unit_list = [{ type, unit_id_list }, …] (on privilégie type 1)
//  - ancien : world_arena_favorite_unit_id_list = [[…],[…]]
function collectFavoriteUnitIds(data: any): Set<number> {
  const ids = new Set<number>();

  const favList = data?.favorite_unit_list;
  if (Array.isArray(favList) && favList.length > 0) {
    const type1 = favList.filter((f) => Number(f?.type) === 1);
    const source = type1.length > 0 ? type1 : favList;
    for (const f of source) flattenIds(f?.unit_id_list, ids);
    if (ids.size > 0) return ids;
  }

  if (Array.isArray(data?.world_arena_favorite_unit_id_list)) {
    flattenIds(data.world_arena_favorite_unit_id_list, ids);
  }
  return ids;
}

// Localise la liste des runes de preset RTA, quelle que soit la variante de nom.
function findRtaEquipList(data: any): any[] | null {
  if (Array.isArray(data?.world_arena_rune_equip_list)) return data.world_arena_rune_equip_list;
  for (const [key, val] of Object.entries(data ?? {})) {
    if (
      /world_arena/i.test(key) &&
      /rune/i.test(key) &&
      Array.isArray(val) &&
      val.length > 0 &&
      val[0] &&
      typeof val[0] === 'object' &&
      'rune_id' in (val[0] as object) &&
      'occupied_id' in (val[0] as object)
    ) {
      return val as any[];
    }
  }
  return null;
}

export function parseAccountJson(text: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { units: [], error: 'Fichier JSON illisible.' };
  }

  const unitList = data?.unit_list;
  if (!Array.isArray(unitList)) {
    return {
      units: [],
      error: "Ce fichier ne contient pas de 'unit_list' — un export de compte SWEX est attendu.",
    };
  }

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);

  // Regroupe les runes RTA par monstre (occupied_id = unit_id équipé en RTA).
  const rtaList = findRtaEquipList(data) ?? [];
  const runesByUnit = new Map<number, any[]>();
  for (const e of rtaList) {
    const uid = Number(e?.occupied_id);
    const rid = Number(e?.rune_id);
    if (!Number.isFinite(uid) || !Number.isFinite(rid)) continue;
    const rune = runeById.get(rid);
    if (!rune) continue;
    if (!runesByUnit.has(uid)) runesByUnit.set(uid, []);
    runesByUnit.get(uid)!.push(rune);
  }

  // Monstres « utilisés souvent » = favoris mémorisés par le jeu.
  const favIds = collectFavoriteUnitIds(data);

  // Cible : les favoris si présents, sinon repli sur tous les monstres runés RTA.
  const targetUnitIds = favIds.size > 0 ? Array.from(favIds) : Array.from(runesByUnit.keys());
  if (targetUnitIds.length === 0) {
    return {
      units: [],
      error:
        "Aucun monstre favori RTA ni preset de runes RTA trouvé dans ce fichier (world_arena_favorite_unit_id_list / world_arena_rune_equip_list).",
    };
  }

  const units: ImportedUnit[] = [];
  for (const uid of targetUnitIds) {
    const unit = unitById.get(uid);
    if (!unit) continue;
    const com2usId = Number(unit?.unit_master_id);
    if (!Number.isFinite(com2usId)) continue;
    const runeIds = (runesByUnit.get(uid) ?? []).map((r) => r.rune_id);
    const { flatRuneSpeed, swift } = speedFromRuneIds(runeIds, runeById);
    units.push({ com2usId, flatRuneSpeed, swift });
  }

  return { units };
}

/* --------------------------------------------------------------------------
 * Import ÉQUIPES DE SIÈGE (combat de guilde) — défense & offense
 *
 * Les deux côtés partagent la même forme : des decks de 3 monstres (index 0 =
 * leader) où chaque monstre a son propre preset de runes de siège.
 *  - Défense : guildsiege_defense_deck_unit_list (+ …_equip_list). Le leader est
 *    le 1ᵉʳ de unit_id_list ; unit_id = 0 => slot vide.
 *  - Offense : deck_list filtré sur deck_type = 22 (équipes d'attaque
 *    sauvegardées). Le leader est donné par leader_unit_id ; runes dans dk.equip.
 * ----------------------------------------------------------------------- */

// deck_type des équipes d'attaque de siège sauvegardées (dans deck_list).
// Identifié sur des exports réels : 3 monstres/deck avec presets de runes.
const SIEGE_OFFENSE_DECK_TYPE = 22;

// Un slot importé, ou null pour un slot vide (unit_id = 0).
export interface SiegeImportedSlot {
  com2usId: number;
  flatRuneSpeed: number; // SPD plate des runes de ce build de siège
  swift: boolean; // set Swift complet équipé sur ce build de siège
  sets: string[]; // sets de runes actifs (clés RUNE_SETS), ex. ['swift','will']
}

// Un deck = 3 slots ordonnés (index 0 = leader).
export interface SiegeImportedDeck {
  deckId: number | string;
  slots: (SiegeImportedSlot | null)[]; // longueur 3, null = slot vide
}

export interface SiegeParseResult {
  decks: SiegeImportedDeck[];
  error?: string;
}

// Convertit un tableau `equip` ([{ unit_id, rune_id_list }, …]) en Map unit_id → rune_id_list.
function equipArrayToMap(equip: any): Map<number, any[]> {
  const map = new Map<number, any[]>();
  if (!Array.isArray(equip)) return map;
  for (const e of equip) {
    const uid = Number(e?.unit_id);
    if (!Number.isFinite(uid)) continue;
    map.set(uid, Array.isArray(e?.rune_id_list) ? e.rune_id_list : []);
  }
  return map;
}

// Définition brute d'un deck avant résolution en monstres/vitesses.
interface DeckDef {
  deckId: number | string;
  unitIds: any[]; // 3 slots ordonnés, leader en tête ; 0 = vide
  runeIdsByUnit: Map<number, any[]>;
}

// Résout des DeckDef en SiegeImportedDeck (mapping unité → monstre + vitesses).
function buildSiegeDecks(
  defs: DeckDef[],
  runeById: Map<number, any>,
  unitById: Map<number, any>
): SiegeImportedDeck[] {
  const decks: SiegeImportedDeck[] = [];
  for (const def of defs) {
    const slots: (SiegeImportedSlot | null)[] = [0, 1, 2].map((i) => {
      const uid = Number(def.unitIds[i]);
      if (!Number.isFinite(uid) || uid === 0) return null;
      const unit = unitById.get(uid);
      if (!unit) return null;
      const com2usId = Number(unit?.unit_master_id);
      if (!Number.isFinite(com2usId)) return null;
      const runeIds = def.runeIdsByUnit.get(uid) ?? [];
      const { flatRuneSpeed, swift } = speedFromRuneIds(runeIds, runeById);
      const sets = activeSetsFromRuneIds(runeIds, runeById);
      return { com2usId, flatRuneSpeed, swift, sets };
    });
    // On ignore les decks totalement vides (jamais configurés).
    if (slots.some((s) => s !== null)) decks.push({ deckId: def.deckId, slots });
  }
  return decks;
}

// Import des DÉFENSES de siège.
export function parseSiegeDefense(text: string): SiegeParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { decks: [], error: 'Fichier JSON illisible.' };
  }
  if (!Array.isArray(data?.unit_list)) {
    return {
      decks: [],
      error: "Ce fichier ne contient pas de 'unit_list' — un export de compte SWEX est attendu.",
    };
  }

  const deckList = data?.guildsiege_defense_deck_unit_list;
  if (!Array.isArray(deckList) || deckList.length === 0) {
    return {
      decks: [],
      error:
        "Aucune défense de siège trouvée (guildsiege_defense_deck_unit_list). Enregistre tes défenses de combat de guilde en jeu avant d'exporter.",
    };
  }

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);
  const equipList = data?.guildsiege_defense_deck_equip_list;

  const defs: DeckDef[] = deckList.map((dk: any, i: number) => {
    const entry = equipList?.[String(dk?.deck_id)] ?? equipList?.[dk?.deck_id];
    return {
      deckId: dk?.deck_id ?? i,
      // Positions conservées : le 1ᵉʳ slot est le leader ; 0 = vide.
      unitIds: Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : [],
      runeIdsByUnit: equipArrayToMap(entry?.equip),
    };
  });

  const decks = buildSiegeDecks(defs, runeById, unitById);
  if (decks.length === 0) {
    return { decks: [], error: 'Aucune défense de siège configurée dans ce fichier.' };
  }
  return { decks };
}

// Import des ÉQUIPES D'ATTAQUE de siège (offense).
export function parseSiegeOffense(text: string): SiegeParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { decks: [], error: 'Fichier JSON illisible.' };
  }
  if (!Array.isArray(data?.unit_list)) {
    return {
      decks: [],
      error: "Ce fichier ne contient pas de 'unit_list' — un export de compte SWEX est attendu.",
    };
  }

  const deckList = Array.isArray(data?.deck_list) ? data.deck_list : [];
  const offense = deckList.filter((dk: any) => Number(dk?.deck_type) === SIEGE_OFFENSE_DECK_TYPE);
  if (offense.length === 0) {
    return {
      decks: [],
      error:
        "Aucune équipe d'attaque de siège trouvée (deck_list). Sauvegarde tes équipes d'attaque de combat de guilde en jeu avant d'exporter.",
    };
  }

  const runeById = indexRunes(data);
  const unitById = indexUnits(data);

  const defs: DeckDef[] = offense.map((dk: any, i: number) => {
    // Leader en tête (leader_unit_id), puis les autres unités non nulles.
    const ids = (Array.isArray(dk?.unit_id_list) ? dk.unit_id_list : [])
      .map(Number)
      .filter((x: number) => Number.isFinite(x) && x !== 0);
    const lead = Number(dk?.leader_unit_id);
    const ordered = Number.isFinite(lead)
      ? [lead, ...ids.filter((x: number) => x !== lead)]
      : ids;
    return {
      deckId: dk?.deck_seq ?? i,
      unitIds: [ordered[0] ?? 0, ordered[1] ?? 0, ordered[2] ?? 0],
      runeIdsByUnit: equipArrayToMap(dk?.equip),
    };
  });

  const decks = buildSiegeDecks(defs, runeById, unitById);
  if (decks.length === 0) {
    return { decks: [], error: "Aucune équipe d'attaque de siège configurée dans ce fichier." };
  }
  return { decks };
}
