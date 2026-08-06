export type ElementKey = 'fire' | 'water' | 'wind' | 'light' | 'dark' | 'unknown';

export interface MonsterStats {
  hp: number | null;
  attack: number | null;
  defense: number | null;
  speed: number | null;
  critRate: number | null;
  critDamage: number | null;
  resistance: number | null;
  accuracy: number | null;
}

// Leader skill d'un monstre. `element = null` => s'applique à toutes les cibles.
export interface LeaderSkill {
  stat: string | null; // ex. "Attack Speed", "Attack Power"…
  amount: number; // en %
  area: string; // General | Element | Arena | Guild | Dungeon
  element: ElementKey | null;
}

export interface Monster {
  id: number | string;
  com2usId: number | null; // identifiant com2us (= unit_master_id dans les exports SWEX)
  name: string;
  element: ElementKey;
  stars: number | null;
  image: string | null;
  stats: MonsterStats;
  leaderSkill: LeaderSkill | null;
}

export interface ElementDef {
  key: ElementKey;
  label: string;
}

export const ELEMENTS: ElementDef[] = [
  { key: 'fire', label: 'Feu' },
  { key: 'water', label: 'Eau' },
  { key: 'wind', label: 'Vent' },
  { key: 'light', label: 'Lumière' },
  { key: 'dark', label: 'Ténèbres' },
  { key: 'unknown', label: 'Autre' },
];

export const STAR_OPTIONS = [1, 2, 3, 4, 5, 6];

export interface DataMeta {
  generated_at: string;
  source: 'live' | 'demo';
  count: number;
}

export interface MonstersPayload {
  meta: DataMeta;
  monsters: Monster[];
}

/* --------------------------------------------------------------------------
 * RTA (Real Time Arena) — préparation des builds runes
 * ----------------------------------------------------------------------- */

export interface RuneSet {
  key: string;
  label: string;
  accent: string; // couleur d'accent (hex)
}

// Sets de runes Summoners War. `accent` sert à colorer les sections RTA.
export const RUNE_SETS: RuneSet[] = [
  { key: 'swift', label: 'Swift', accent: '#5CC2FF' },
  { key: 'violent', label: 'Violent', accent: '#E85D3D' },
  { key: 'despair', label: 'Despair', accent: '#A15FE0' },
  { key: 'will', label: 'Will', accent: '#5EDB8F' },
  { key: 'rage', label: 'Rage', accent: '#FF7A52' },
  { key: 'fatal', label: 'Fatal', accent: '#E0553B' },
  { key: 'blade', label: 'Blade', accent: '#7CC4FF' },
  { key: 'energy', label: 'Energy', accent: '#7AE0A0' },
  { key: 'guard', label: 'Guard', accent: '#8890B8' },
  { key: 'focus', label: 'Focus', accent: '#59B0E0' },
  { key: 'endure', label: 'Endure', accent: '#C0A060' },
  { key: 'vampire', label: 'Vampire', accent: '#C0466A' },
  { key: 'nemesis', label: 'Nemesis', accent: '#B06BE0' },
  { key: 'shield', label: 'Shield', accent: '#6FD0E0' },
  { key: 'revenge', label: 'Revenge', accent: '#E06BA0' },
  { key: 'destroy', label: 'Destroy', accent: '#C05050' },
  { key: 'fight', label: 'Fight', accent: '#E0A050' },
  { key: 'determination', label: 'Determination', accent: '#A0B0D0' },
  { key: 'enhance', label: 'Enhance', accent: '#60D090' },
  { key: 'accuracy', label: 'Accuracy', accent: '#70C0E0' },
  { key: 'tolerance', label: 'Tolerance', accent: '#C0C070' },
  { key: 'seal', label: 'Seal', accent: '#9070D0' },
  { key: 'intangible', label: 'Intangible', accent: '#E8C24A' },
];

// Sections spéciales toujours présentes / non liées à un set de runes.
export const RTA_UNASSIGNED = 'unassigned'; // zone tampon « Non classé »
export const RTA_OTHER = 'other'; // section fourre-tout « Autre »

// Sections affichées par défaut (dans l'ordre), « Autre » incluse.
export const RTA_DEFAULT_SECTIONS: string[] = ['swift', 'violent', 'despair', RTA_OTHER];

const RUNE_SET_BY_KEY = new Map(RUNE_SETS.map((s) => [s.key, s]));

export function sectionLabel(key: string): string {
  if (key === RTA_OTHER) return 'Autre';
  if (key === RTA_UNASSIGNED) return 'Non classé';
  return RUNE_SET_BY_KEY.get(key)?.label ?? key;
}

export function sectionAccent(key: string): string {
  if (key === RTA_OTHER || key === RTA_UNASSIGNED) return '#5B6280';
  return RUNE_SET_BY_KEY.get(key)?.accent ?? '#5B6280';
}

// Une entrée = un monstre sélectionné, classé dans une section, avec la
// vitesse apportée par ses runes (qui s'ajoute à la vitesse de base).
export interface RtaEntry {
  monsterId: string;
  section: string; // clé de section (RTA_UNASSIGNED, RTA_OTHER, ou un set)
  runeSpeed: number | null;
}

export interface RtaState {
  sections: string[]; // sections runes visibles (hors « Non classé »)
  entries: Record<string, RtaEntry>; // indexé par monsterId
}

/* --------------------------------------------------------------------------
 * Siège — équipes de 3 monstres (défense / offense)
 * ----------------------------------------------------------------------- */

export interface SiegeSlot {
  monsterId: string | null;
  runeSpeed: number | null;
  tick: number; // vitesse de combat cible pour CE monstre (0 = aucun tick)
}

export interface SiegeTeam {
  id: string;
  slots: SiegeSlot[]; // toujours 3 slots ; le slot 0 est le leader
  lead: number; // lead SPD du leader (0 = aucun)
}

export interface SiegeState {
  teams: SiegeTeam[];
}

