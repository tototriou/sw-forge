export type ElementKey = 'fire' | 'water' | 'wind' | 'light' | 'dark' | 'unknown';

export interface Monster {
  id: number | string;
  name: string;
  element: ElementKey;
  stars: number | null;
  image: string | null;
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
