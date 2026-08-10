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
  stars: number | null; // grade obtenable (base_stars) — utilisé par le Bestiaire
  naturalStars: number | null; // rareté naturelle réelle (nat 1..5)
  secondAwaken: boolean; // monstre à second éveil (double éveil / 2A)
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
 * Équipement détaillé d'un monstre (runes / artéfacts / relique)
 * Extrait à l'import d'un compte, propre au contexte (preset RTA ou deck de
 * siège). Sert à afficher le détail au clic sur un monstre.
 * ----------------------------------------------------------------------- */

// Une ligne d'effet brute. `code` = type d'effet com2us (voir lib/effects.ts).
// Pour un substat de rune, `value` inclut déjà la meule ; `grind` la rappelle.
export interface EffectLine {
  code: number;
  value: number;
  grind?: number;
  enchant?: boolean;
}

export interface RuneDetail {
  // Identifiant com2us de l'exemplaire (`rune_id`). Stable d'un export à
  // l'autre, contrairement à l'index dans le tableau : c'est lui qui permet de
  // désigner UNE rune précise (ex. « ce plan, je l'ai appliqué »).
  id: number;
  slot: number; // 1..6
  set: string; // clé RUNE_SETS
  rank: number; // classe com2us (étoiles ; > 10 = antique)
  rarity: number; // rareté 1..5 (1 Commun, 2 Magique, 3 Rare, 4 Héroïque, 5 Légendaire)
  level: number; // niveau d'amélioration (+X)
  main: EffectLine;
  innate?: EffectLine; // stat innée (prefix)
  subs: EffectLine[]; // substats
}

/* --------------------------------------------------------------------------
 * Meules et gemmes en réserve (rune_craft_item_list)
 * ----------------------------------------------------------------------- */

// `grind` = meule (pierre de meulage), `gem` = gemme d'enchantement.
export type CraftKind = 'grind' | 'gem';

// Un lot de consommables identiques. Ce qu'il faut pour savoir si on peut
// appliquer un plan d'optimisation **tout de suite**.
export interface CraftLine {
  kind: CraftKind;
  // Clé de `RUNE_SETS`, ou **`null` = immémorial** : utilisable sur n'importe
  // quel set. Une meule Violent ne va que sur une rune Violent.
  setKey: string | null;
  stat: number; // code d'effet (voir lib/effects.ts) : 8 = VIT, 4 = ATQ%…
  grade: number; // 1 Commun … 5 Légendaire (échelle des raretés de runes)
  ancient: boolean; // consommable ANTIQUE, réservé aux runes antiques
  amount: number; // quantité possédée
}

// Un monstre porte au plus DEUX artéfacts, un de chaque sorte : celui
// d'**attribut** (lié à son élément) et celui de **type** (lié à son archétype).
// Le jeu les nomme ainsi ; `element`/`archetype` sont les clés des données
// com2us (`type` 1 / 2).
export type ArtifactKind = 'element' | 'archetype';

export const ARTIFACT_KINDS: { key: ArtifactKind; label: string }[] = [
  { key: 'element', label: 'Attribut' },
  { key: 'archetype', label: 'Type' },
];

export interface ArtifactDetail {
  kind: ArtifactKind;
  element?: ElementKey; // si kind === 'element'
  archetype?: 'attack' | 'defense' | 'hp' | 'support'; // si kind === 'archetype'
  level: number;
  rarity: number; // rareté 1..5
  main: EffectLine; // code 100/101/102 → PV/ATQ/DEF plat
  subs: EffectLine[]; // effets conditionnels
}

export interface RelicDetail {
  main: EffectLine; // code 100/101/102 → PV%/ATQ%/DEF%
  sub?: EffectLine;
}

// Stats de base du monstre (lues sur l'unité à l'import : con×15, atk, def…).
export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  cr: number; // taux critique
  cd: number; // dégâts critiques
  res: number;
  acc: number; // précision
}

export interface GearSet {
  base: BaseStats;
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  relic?: RelicDetail;
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
  sets?: string[]; // sets de runes actifs (clés RUNE_SETS), renseignés à l'import
  gear?: GearSet; // détail runes/artéfacts/relique (preset RTA), renseigné à l'import
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
  sets?: string[]; // sets de runes actifs (clés RUNE_SETS), renseignés à l'import
  gear?: GearSet; // détail runes/artéfacts/relique (deck de siège), renseigné à l'import
}

export interface SiegeTeam {
  id: string;
  slots: SiegeSlot[]; // toujours 3 slots ; le slot 0 est le leader
  lead: number; // lead SPD du leader (0 = aucun)
  tickAlertDismissed: boolean; // l'utilisateur a masqué l'alerte de vitesse (aura rouge)
}

export interface SiegeState {
  teams: SiegeTeam[];
}

/* --------------------------------------------------------------------------
 * Siège — recommandations de decks (partageables entre joueurs)
 * ----------------------------------------------------------------------- */

// Stats sur lesquelles une recommandation peut poser un minimum (mêmes clés que
// lib/effects.ts → StatKey, et mêmes lignes que le calcul de stats totales).
export type RecoStatKey = 'hp' | 'atk' | 'def' | 'spd' | 'cr' | 'cd' | 'res' | 'acc';

export const RECO_STATS: { key: RecoStatKey; label: string; suffix: string }[] = [
  { key: 'hp', label: 'PV', suffix: '' },
  { key: 'atk', label: 'ATQ', suffix: '' },
  { key: 'def', label: 'DEF', suffix: '' },
  { key: 'spd', label: 'VIT', suffix: '' },
  { key: 'cr', label: 'Taux Crit', suffix: '%' },
  { key: 'cd', label: 'Dmg Crit', suffix: '%' },
  { key: 'res', label: 'RES', suffix: '%' },
  { key: 'acc', label: 'Précision', suffix: '%' },
];

// Un monstre d'une recommandation. On stocke le **com2usId** (et non l'id local)
// : c'est la seule clé stable d'un compte/joueur à l'autre — même clé de
// jointure que les imports SWEX. `name` sert de repli d'affichage si le monstre
// est absent des données chargées chez celui qui importe.
export interface RecoSlot {
  com2usId: number | null; // null = slot vide
  name: string;
  stats: Partial<Record<RecoStatKey, number>>; // minimums recommandés (absent = non exigé)
  // Runages recommandés, en **PLUSIEURS POSSIBILITÉS au choix** : un monstre se
  // joue souvent « Violent/Némésis OU Violent/Vengeance ». Chaque possibilité
  // est une combinaison de sets (clés RUNE_SETS) avec RÉPÉTITIONS possibles —
  // un set 2 pièces peut être demandé plusieurs fois (3× Fight = 6 runes).
  // Combinaisons valides sur 6 runes : 4+2 · 2+2+2 · 4 · 2+2 · 2 · aucun.
  //
  // ⚠️ La liste contient **toujours au moins une possibilité** (éventuellement
  // vide = « aucun set exigé »), et la confrontation est satisfaite dès qu'**UNE
  // SEULE** l'est. Voir ../spec/siege/recommandations.md.
  setOptions: string[][];
  // Propriétés secondaires d'artéfact exigées, **par sorte d'artéfact** : jusqu'à
  // 4 sur celui d'attribut et 4 sur celui de type (les 4 emplacements du jeu).
  //
  // ⚠️ On stocke les **codes** (`ARTIFACT_SUB` de lib/effects.ts), pas des
  // libellés : c'est ce que porte l'export du compte, donc la confrontation est
  // exacte, et un renommage de libellé ne casse pas les recommandations
  // partagées.
  //
  // ⚠️ Aucune VALEUR minimale : une recommandation d'artéfact porte sur la
  // **présence** de la propriété. Les substats d'artéfacts sont conditionnels
  // (« dégâts sur le Feu », « VIT sous incapacité ») ; exiger un seuil chiffré
  // sur des effets qui ne s'appliquent qu'en situation donnerait une fausse
  // précision, alors que ce qui se joue en pratique est « as-tu la bonne ligne ».
  artifacts: Record<ArtifactKind, number[]>;
}

// 4 emplacements de propriété secondaire par artéfact, comme dans le jeu.
export const MAX_ARTIFACT_SUBS = 4;

// Un deck recommandé : 3 monstres, index 0 = leader (comme une équipe de siège).
export interface RecoDeck {
  name: string; // « Def 1 » (facultatif → « Deck N »)
  note: string; // consignes propres à CE deck (multi-lignes)
  slots: RecoSlot[]; // toujours 3 ; index 0 = leader
}

// D'où vient une recommandation. Purement LOCAL : jamais transporté dans un
// export (ce qui est « à moi » chez l'auteur devient « importé » chez l'autre).
export type RecoOrigin = 'mine' | 'imported';

// Une recommandation = un ENSEMBLE de decks partagé d'un bloc (ex. « Mes 6
// défenses de siège »), pas un deck isolé.
export interface Reco {
  id: string;
  origin: RecoOrigin;
  name: string; // « Défenses de guilde — Thomas »
  author: string; // auteur de la recommandation (facultatif)
  note: string; // consignes globales, valables pour tous les decks (multi-lignes)
  decks: RecoDeck[];
}

// Contenu transportable d'une recommandation : ni l'id (régénéré), ni l'origine
// (attribuée par celui qui importe).
export type RecoPayload = Omit<Reco, 'id' | 'origin'>;

export interface RecoState {
  recos: Reco[];
}

export function emptyRecoSlot(): RecoSlot {
  return { com2usId: null, name: '', stats: {}, setOptions: [[]], artifacts: emptyRecoArtifacts() };
}

export function emptyRecoArtifacts(): Record<ArtifactKind, number[]> {
  return { element: [], archetype: [] };
}

export function emptyRecoDeck(): RecoDeck {
  return { name: '', note: '', slots: [emptyRecoSlot(), emptyRecoSlot(), emptyRecoSlot()] };
}

