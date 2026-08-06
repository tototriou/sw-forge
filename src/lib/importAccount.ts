// Parse un export de compte Summoners War (format SWEX) — 100% côté navigateur.
// On cible la BOX RTA (World Arena) : en RTA, chaque monstre a son propre preset
// de runes, stocké à part dans `world_arena_rune_equip_list` (et NON dans les
// runes équipées classiques de `unit_list[].runes`). On en déduit, pour chaque
// monstre présent dans ce preset, sa vitesse de runes RTA (+ set Swift).

const RUNE_EFF_SPEED = 8; // type d'effet « Vitesse » dans les données com2us
const RUNE_SET_SWIFT = 3; // set_id du set Swift

export interface ImportedUnit {
  com2usId: number;
  flatRuneSpeed: number; // SPD plate cumulée des runes RTA
  swift: boolean; // set Swift complet (4 runes) équipé en RTA
}

export interface ParseResult {
  units: ImportedUnit[];
  error?: string;
}

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

  // Index de TOUTES les runes par rune_id : équipées (dans les unités) + en
  // inventaire (top-level `runes`). Un preset RTA peut réutiliser n'importe laquelle.
  const runeById = new Map<number, any>();
  const addRune = (r: any) => {
    const id = Number(r?.rune_id);
    if (Number.isFinite(id)) runeById.set(id, r);
  };
  if (Array.isArray(data.runes)) data.runes.forEach(addRune);
  for (const u of unitList) if (Array.isArray(u?.runes)) u.runes.forEach(addRune);

  // Index des unités par unit_id (instance possédée).
  const unitById = new Map<number, any>();
  for (const u of unitList) {
    const uid = Number(u?.unit_id);
    if (Number.isFinite(uid)) unitById.set(uid, u);
  }

  const rtaList = findRtaEquipList(data);
  if (!rtaList || rtaList.length === 0) {
    return {
      units: [],
      error:
        "Aucun preset RTA trouvé dans ce fichier (world_arena_rune_equip_list). Vérifie que l'export contient bien tes runes de World Arena.",
    };
  }

  // Regroupe les runes RTA par monstre (occupied_id = unit_id équipé en RTA).
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

  const units: ImportedUnit[] = [];
  for (const [uid, runes] of runesByUnit) {
    const unit = unitById.get(uid);
    if (!unit) continue;
    const com2usId = Number(unit?.unit_master_id);
    if (!Number.isFinite(com2usId)) continue;
    let flatRuneSpeed = 0;
    let swiftCount = 0;
    for (const r of runes) {
      if (Number(r?.set_id) === RUNE_SET_SWIFT) swiftCount++;
      flatRuneSpeed += runeSpeed(r);
    }
    units.push({ com2usId, flatRuneSpeed, swift: swiftCount >= 4 });
  }

  return { units };
}
