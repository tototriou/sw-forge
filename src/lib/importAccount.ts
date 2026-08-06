// Parse un export de compte Summoners War (format SWEX) — 100% côté navigateur.
// On en extrait, pour chaque monstre possédé, l'identifiant com2us et la
// vitesse apportée par ses runes équipées (+ set Swift détecté).

const RUNE_EFF_SPEED = 8; // type d'effet « Vitesse » dans les données com2us
const RUNE_SET_SWIFT = 3; // set_id du set Swift

export interface ImportedUnit {
  com2usId: number;
  flatRuneSpeed: number; // SPD plate cumulée des runes
  swift: boolean; // set Swift complet (4 runes) équipé
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

export function parseAccountJson(text: string): ParseResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return { units: [], error: 'Fichier JSON illisible.' };
  }

  const list = data?.unit_list;
  if (!Array.isArray(list)) {
    return {
      units: [],
      error: "Ce fichier ne contient pas de 'unit_list' — un export de compte SWEX est attendu.",
    };
  }

  const units: ImportedUnit[] = [];
  for (const u of list) {
    const com2usId = Number(u?.unit_master_id);
    if (!Number.isFinite(com2usId)) continue;
    const runes = Array.isArray(u?.runes) ? u.runes : [];
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
