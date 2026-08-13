// Mapping des codes d'effets com2us (runes, artéfacts, reliques) → libellés.
// Aligné sur sw-exporter (app/mapping.js) et vérifié sur des exports réels.

import { ArtifactKind, EffectLine, RuneDetail } from '../types';

export type StatKey = 'hp' | 'atk' | 'def' | 'spd' | 'cr' | 'cd' | 'res' | 'acc';

// Taux Crit, RES et Précision sont PLAFONNÉS à 100 % dans le jeu — leur effet
// ne va jamais au-delà, même si le total brut dépasse. Dmg Crit n'a pas ce
// plafond (200 %+ courant), ni les autres stats. Partagé entre la saisie de
// conditions (Outils → Optimizer) et l'affichage d'une fiche de monstre
// (MonsterGear.tsx) : même fait de jeu, une seule source de vérité.
export const CAPPED_STATS: ReadonlySet<StatKey> = new Set(['cr', 'res', 'acc']);

// Rune ANTIQUE : com2us encode sa classe au-delà de 10 (6★ antique = 16).
// Elles ont leurs propres tables de valeurs max, donc leur efficience et leur
// potentiel ne se comparent pas à ceux d'une rune normale.
export function isAncient(rune: { rank: number }): boolean {
  return rune.rank > 10;
}

// Effet de rune (pri_eff / prefix_eff / sec_eff) → stat visée + affichage.
interface RuneEff {
  label: string; // libellé court (colonnes de stats)
  stat: StatKey;
  pct: boolean; // true → valeur en % qui s'applique à la base (PV/ATQ/DEF)
  suffix: string; // suffixe d'affichage ('%' ou '')
}

export const RUNE_EFFECT: Record<number, RuneEff> = {
  1: { label: 'PV', stat: 'hp', pct: false, suffix: '' },
  2: { label: 'PV%', stat: 'hp', pct: true, suffix: '%' },
  3: { label: 'ATQ', stat: 'atk', pct: false, suffix: '' },
  4: { label: 'ATQ%', stat: 'atk', pct: true, suffix: '%' },
  5: { label: 'DEF', stat: 'def', pct: false, suffix: '' },
  6: { label: 'DEF%', stat: 'def', pct: true, suffix: '%' },
  8: { label: 'VIT', stat: 'spd', pct: false, suffix: '' },
  9: { label: 'Taux Crit', stat: 'cr', pct: false, suffix: '%' },
  10: { label: 'Dmg Crit', stat: 'cd', pct: false, suffix: '%' },
  11: { label: 'RES', stat: 'res', pct: false, suffix: '%' },
  12: { label: 'Précision', stat: 'acc', pct: false, suffix: '%' },
};

// Stat principale d'artéfact (pri_effect) : PV / ATQ / DEF plats.
export const ARTIFACT_MAIN: Record<number, { label: string; stat: StatKey }> = {
  100: { label: 'PV', stat: 'hp' },
  101: { label: 'ATQ', stat: 'atk' },
  102: { label: 'DEF', stat: 'def' },
};

// Substats d'artéfacts (sec_effects). Effets conditionnels/situationnels :
// ils portent une valeur mais n'entrent pas dans les 8 stats de base.
export const ARTIFACT_SUB: Record<number, (v: number) => string> = {
  200: (v) => `ATQ + selon PV perdus, jusqu'à +${v}%`,
  201: (v) => `DEF + selon PV perdus, jusqu'à +${v}%`,
  202: (v) => `VIT + selon PV perdus, jusqu'à +${v}%`,
  203: (v) => `VIT sous effet d'incapacité +${v}%`,
  204: (v) => `Effet d'augmentation d'ATQ +${v}%`,
  205: (v) => `Effet d'augmentation de DEF +${v}%`,
  206: (v) => `Effet d'augmentation de VIT +${v}%`,
  207: (v) => `Effet d'augmentation du taux crit +${v}%`,
  208: (v) => `Dégâts de contre-attaque +${v}%`,
  209: (v) => `Dégâts d'attaque conjointe +${v}%`,
  210: (v) => `Dégâts de bombe +${v}%`,
  211: (v) => `Dégâts de réflexion +${v}%`,
  212: (v) => `Dégâts de coup dévastateur +${v}%`,
  213: (v) => `Dégâts reçus sous incapacité -${v}%`,
  214: (v) => `Dégâts crit reçus -${v}%`,
  215: (v) => `Vol de vie +${v}%`,
  216: (v) => `PV à la résurrection +${v}%`,
  217: (v) => `Barre d'action à la résurrection +${v}%`,
  218: (v) => `Dégâts add. par ${v}% des PV`,
  219: (v) => `Dégâts add. par ${v}% de l'ATQ`,
  220: (v) => `Dégâts add. par ${v}% de la DEF`,
  221: (v) => `Dégâts add. par ${v}% de la VIT`,
  222: (v) => `Dmg crit +${v}% si PV ennemi élevés`,
  223: (v) => `Dmg crit +${v}% si PV ennemi bas`,
  224: (v) => `Dmg crit mono-cible +${v}% à ton tour`,
  225: (v) => `Dégâts contre/attaque conjointe +${v}%`,
  226: (v) => `Effet Buff ATQ/DEF +${v}%`,
  300: (v) => `Dégâts sur le Feu +${v}%`,
  301: (v) => `Dégâts sur l'Eau +${v}%`,
  302: (v) => `Dégâts sur le Vent +${v}%`,
  303: (v) => `Dégâts sur la Lumière +${v}%`,
  304: (v) => `Dégâts sur les Ténèbres +${v}%`,
  305: (v) => `Dégâts reçus du Feu -${v}%`,
  306: (v) => `Dégâts reçus de l'Eau -${v}%`,
  307: (v) => `Dégâts reçus du Vent -${v}%`,
  308: (v) => `Dégâts reçus de la Lumière -${v}%`,
  309: (v) => `Dégâts reçus des Ténèbres -${v}%`,
  400: (v) => `Dmg crit Compétence 1 +${v}%`,
  401: (v) => `Dmg crit Compétence 2 +${v}%`,
  402: (v) => `Dmg crit Compétence 3 +${v}%`,
  403: (v) => `Dmg crit Compétence 4 +${v}%`,
  404: (v) => `Récupération Compétence 1 +${v}%`,
  405: (v) => `Récupération Compétence 2 +${v}%`,
  406: (v) => `Récupération Compétence 3 +${v}%`,
  407: (v) => `Précision Compétence 1 +${v}%`,
  408: (v) => `Précision Compétence 2 +${v}%`,
  409: (v) => `Précision Compétence 3 +${v}%`,
  410: (v) => `Dmg crit Compétence 3/4 +${v}%`,
  411: (v) => `Dmg crit 1ʳᵉ attaque +${v}%`,
};

// Stat principale de relique (pri_effect) : PV% / ATQ% / DEF%.
export const RELIC_MAIN: Record<number, { label: string; stat: StatKey }> = {
  100: { label: 'PV%', stat: 'hp' },
  101: { label: 'ATQ%', stat: 'atk' },
  102: { label: 'DEF%', stat: 'def' },
};

// Rareté → libellé + couleur de texte + fond de bannière (dégradé sombre),
// façon bannière du jeu (ex. Légendaire = orange sur bordeaux).
//
// ⚠️ `color` sert à DEUX usages qui n'ont pas les mêmes contraintes :
//   - sur la BANNIÈRE, où le fond est le dégradé sombre `bg` dans les deux
//     thèmes — la couleur vive du jeu y est parfaite ;
//   - comme couleur de TEXTE sur un panneau (liste des runes, légende du
//     résumé), où elle doit suivre le thème. En clair, `#7cf0a6` sur blanc est
//     illisible.
// D'où `color` (bannière, fixe) et `ink` (texte, variable de thème). Les valeurs
// claires vivent dans index.css. Voir spec/shared/design.md.
export const RARITY_META: Record<
  number,
  { label: string; color: string; bg: string; ink: string }
> = {
  5: {
    label: 'Légendaire',
    color: '#f8b24a',
    bg: 'linear-gradient(180deg,#7a2a1c,#431310)',
    ink: 'rgb(var(--rarity-5))',
  },
  // ⚠️ Ordre du jeu : Commun (blanc) → Magique (VERT) → Rare (BLEU) → Héroïque
  // → Légendaire (orange). Vert et bleu étaient intervertis ici.
  //
  // Le RARE prend #154c79 comme teinte de référence : un bleu posé, pas
  // électrique. Il sert de FOND ; la couleur de texte en reprend la teinte
  // éclaircie, #154c79 étant trop sombre pour rester lisible sur le panneau.
  // L'héroïque garde son violet : essayé en #691d42, le rendu ne passait pas.
  4: {
    label: 'Héroïque',
    color: '#c88cff',
    bg: 'linear-gradient(180deg,#3f2270,#241145)',
    ink: 'rgb(var(--rarity-4))',
  },
  3: {
    label: 'Rare',
    color: '#6fa3cf',
    bg: 'linear-gradient(180deg,#154c79,#0d2c47)',
    ink: 'rgb(var(--rarity-3))',
  },
  2: {
    label: 'Magique',
    color: '#7cf0a6',
    bg: 'linear-gradient(180deg,#1f5a39,#0f3121)',
    ink: 'rgb(var(--rarity-2))',
  },
  1: {
    label: 'Commun',
    color: '#e6e6e6',
    bg: 'linear-gradient(180deg,#4a4a4a,#2a2a2a)',
    ink: 'rgb(var(--rarity-1))',
  },
};

// Colorisation du symbole de set selon la rareté de la rune (filtre CSS sur l'image).
// Base sépia+saturation (teinte ~orange), puis hue-rotate par rareté.
const SET_SHADOW = 'drop-shadow(rgba(10, 6, 3, 0.95) 0px 1px 1px)';
export const RARITY_FILTER: Record<number, string> = {
  5: `sepia(1) saturate(7.5) hue-rotate(330deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Légendaire → orange
  4: `sepia(1) saturate(7.5) hue-rotate(235deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Héroïque → violet
  // Rare : saturation abaissée (7.5 → 4.5) pour s'accorder au #154c79 posé de
  // `RARITY_META` — à 7.5 le bleu virait au néon.
  3: `sepia(1) saturate(4.5) hue-rotate(180deg) brightness(0.95) contrast(1.15) ${SET_SHADOW}`, // Rare → bleu
  2: `sepia(1) saturate(7.5) hue-rotate(80deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Magique → vert
  1: `saturate(0) brightness(1.7) contrast(1.05) ${SET_SHADOW}`, // Normal → blanc
};

// Bonus de set (nombre de pièces + effet), pour la ligne « X Set : … ».
export const SET_BONUS: Record<string, { pieces: number; label: string }> = {
  swift: { pieces: 4, label: 'VIT +25%' },
  violent: { pieces: 4, label: 'Chance de tour supplémentaire 22%' },
  despair: { pieces: 4, label: "Chance d'étourdissement 25%" },
  rage: { pieces: 4, label: 'Dégâts critiques +40%' },
  fatal: { pieces: 4, label: 'ATQ +35%' },
  vampire: { pieces: 4, label: 'Vol de vie 35%' },
  energy: { pieces: 2, label: 'PV +15%' },
  guard: { pieces: 2, label: 'DEF +15%' },
  blade: { pieces: 2, label: 'Taux critique +12%' },
  focus: { pieces: 2, label: 'Précision +20%' },
  endure: { pieces: 2, label: 'Résistance +20%' },
  will: { pieces: 2, label: 'Immunité 1 tour' },
  nemesis: { pieces: 2, label: "Barre d'action +4% par 7% de PV perdus" },
  shield: { pieces: 2, label: 'Bouclier 3 tours (15% PV)' },
  revenge: { pieces: 2, label: 'Chance de contre-attaque +15%' },
  destroy: { pieces: 2, label: 'Détruit 4% des PV max ennemi' },
  fight: { pieces: 2, label: 'ATQ alliés +8%' },
  determination: { pieces: 2, label: 'DEF alliés +8%' },
  enhance: { pieces: 2, label: 'PV alliés +8%' },
  accuracy: { pieces: 2, label: 'Précision alliés +10%' },
  tolerance: { pieces: 2, label: 'Résistance alliés +10%' },
  seal: { pieces: 2, label: "Réduit les PV max de l'ennemi vaincu" },
  intangible: { pieces: 1, label: 'Joker (complète un set)' },
};

/* --------------------------------------------------------------------------
 * Sets de runes : activation
 * ----------------------------------------------------------------------- */

// Sets à 4 pièces. Tous les autres (dont Destroy) s'activent à 2 runes.
export const FOUR_PIECE_SETS = new Set(['swift', 'rage', 'fatal', 'despair', 'vampire', 'violent']);
export const INTANGIBLE_SET = 'intangible'; // rune joker : complète n'importe quel set

// Nombre de runes nécessaires pour activer un set.
export function setPieces(key: string): number {
  return FOUR_PIECE_SETS.has(key) ? 4 : 2;
}

// Un monstre porte 6 runes : une combinaison de sets ne peut pas coûter plus.
export const MAX_SET_PIECES = 6;

// Coût en runes d'une combinaison de sets.
export function setsCost(sets: string[]): number {
  return sets.reduce((n, k) => n + setPieces(k), 0);
}

// Peut-on encore ajouter ce set ? Combinaisons possibles sur 6 runes :
// 4+2 · 2+2+2 · 4 seul · 2+2 · 2 seul · aucun. Un seul set 4 pièces (4+4 = 8 > 6).
export function canAddSet(sets: string[], key: string): boolean {
  return setsCost(sets) + setPieces(key) <= MAX_SET_PIECES;
}

// Sets ACTIFS d'un build, à partir des sets de ses runes.
// Un set 2 pièces peut être actif PLUSIEURS fois (ex. 6 runes Fight → 3× Fight),
// d'où une liste (avec répétitions) et non un ensemble. Une rune Intangible sert
// de joker et complète le set auquel il manque le moins de pièces.
// Tri d'affichage : sets 4 pièces d'abord.
export function activeSets(keys: string[]): string[] {
  const count = new Map<string, number>();
  let jokers = 0;
  for (const key of keys) {
    if (!key) continue;
    if (key === INTANGIBLE_SET) jokers++;
    else count.set(key, (count.get(key) ?? 0) + 1);
  }

  const out: string[] = [];
  const partial: { key: string; missing: number }[] = [];
  for (const [key, n] of count) {
    const req = setPieces(key);
    for (let i = 0; i < Math.floor(n / req); i++) out.push(key);
    const rem = n % req;
    if (rem > 0) partial.push({ key, missing: req - rem });
  }

  partial.sort((a, b) => a.missing - b.missing);
  for (const p of partial) {
    if (jokers >= p.missing) {
      out.push(p.key);
      jokers -= p.missing;
    }
  }
  out.sort((a, b) => (FOUR_PIECE_SETS.has(a) ? 0 : 1) - (FOUR_PIECE_SETS.has(b) ? 0 : 1));
  return out;
}

/* --------------------------------------------------------------------------
 * Bonus de set appliqués aux STATS du monstre
 * ----------------------------------------------------------------------- */

// Deux natures de bonus, à ne pas confondre :
//  - `pct`  : pourcentage de la stat de BASE (Swift +25 % de la VIT de base) ;
//  - `flat` : points ajoutés directement (Blade +12 POINTS de taux crit, et non
//             12 % des 15 % de base).
//
// ⚠️ Les sets « d'alliés » (Fight, Determination, Enhance, Accuracy, Tolerance)
// ne sont PAS ici : dans SW ils buffent l'équipe en combat et n'apparaissent pas
// sur la fiche de stats du monstre. Les autres sets (Violent, Despair, Vampire,
// Will, Nemesis, Shield, Revenge, Destroy, Seal, Intangible) n'ont aucun effet
// sur les stats.
export const SET_STAT_BONUS: Record<string, { stat: StatKey; pct?: number; flat?: number }> = {
  energy: { stat: 'hp', pct: 15 },
  guard: { stat: 'def', pct: 15 },
  swift: { stat: 'spd', pct: 25 },
  fatal: { stat: 'atk', pct: 35 },
  blade: { stat: 'cr', flat: 12 },
  rage: { stat: 'cd', flat: 40 },
  focus: { stat: 'acc', flat: 20 },
  endure: { stat: 'res', flat: 20 },
};

// Valeurs max (rune 6★, non antique) — pour l'efficience. Source sw-exporter.
export const MAINSTAT_MAX: Record<number, number> = {
  1: 2448, 2: 63, 3: 160, 4: 63, 5: 160, 6: 63, 8: 42, 9: 58, 10: 80, 11: 64, 12: 64,
};
// N.B. substats plats (PV/ATQ/DEF) : max « doublés » façon scoringsw
// (PV 3750, ATQ/DEF 200) → cohérent avec les efficiences observées.
export const SUBSTAT_MAX: Record<number, number> = {
  1: 3750, 2: 40, 3: 200, 4: 40, 5: 200, 6: 40, 8: 30, 9: 30, 10: 35, 11: 40, 12: 40,
};

// Dénominateurs du **SCORE SW** (celui affiché dans le jeu). Identiques à ceux
// de l'efficience pour les % / VIT / crit ; SEULES LES STATS PLATES DIFFÈRENT :
// le jeu les pondère à **0,35** (PV /1875 × 0,35, ATQ et DEF /100 × 0,35) là où
// l'efficience utilise la convention « doublée » de scoringsw.
//   → PV plat  : /5357,14 (score) contre /3750 (efficience)
//   → ATQ/DEF  : /285,71  (score) contre /200  (efficience)
// Une stat plate pèse donc ~1,43× moins dans le score que dans l'efficience.
const SCORE_FLAT_WEIGHT = 0.35;
export const SCORE_MAX: Record<number, number> = {
  1: 1875 / SCORE_FLAT_WEIGHT, // PV plat
  2: 40,
  3: 100 / SCORE_FLAT_WEIGHT, // ATQ plat
  4: 40,
  5: 100 / SCORE_FLAT_WEIGHT, // DEF plat
  6: 40,
  8: 30,
  9: 30,
  10: 35,
  11: 40,
  12: 40,
};

// Somme des ratios des stats SECONDAIRES (innée + substats, meule incluse),
// selon la table de dénominateurs fournie.
function subsRatio(rune: RuneDetail, table: Record<number, number>): number {
  let ratio = 0;
  for (const s of rune.subs) {
    const m = table[s.code];
    if (m) ratio += s.value / m;
  }
  if (rune.innate) {
    const m = table[rune.innate.code];
    if (m) ratio += rune.innate.value / m;
  }
  return ratio;
}

// **Score SW** — celui affiché dans le jeu. Ne compte QUE les stats secondaires
// (la principale n'entre pas), en centièmes, arrondi :
//
//   score = round( ( PV%+ATQ%+DEF%+PRÉ%+RES% )/40 + (VIT+TC)/30 + DCC/35
//                  + PV/1875×0,35 + (ATQ+DEF)/100×0,35 ) × 100 )
export function runeScore(rune: RuneDetail): number {
  return Math.round(subsRatio(rune, SCORE_MAX) * 100);
}

// Efficience d'une rune (%) : (main plafonné à 1 + Σ substats/max + innée/max) / 2.8.
// Meule incluse (déjà dans value). Max non antiques → antiques > 100%.
export function runeEfficiency(rune: RuneDetail): number {
  const mm = MAINSTAT_MAX[rune.main.code];
  const main = mm ? Math.min(rune.main.value / mm, 1) : 0;
  return ((main + subsRatio(rune, SUBSTAT_MAX)) / 2.8) * 100;
}

// Affichage d'un effet de rune (« ATQ +160 », « VIT +23 », « Dmg Crit +7% »).
export function formatRuneEffect(e: EffectLine): string {
  const def = RUNE_EFFECT[e.code];
  if (!def) return `#${e.code} +${e.value}`;
  return `${def.label} +${e.value}${def.suffix}`;
}

// Affichage de la stat principale d'un artéfact (plat).
export function formatArtifactMain(e: EffectLine): string {
  const def = ARTIFACT_MAIN[e.code];
  return def ? `${def.label} +${e.value}` : `#${e.code} +${e.value}`;
}

// Affichage d'un substat d'artéfact (conditionnel).
export function formatArtifactSub(e: EffectLine): string {
  const fn = ARTIFACT_SUB[e.code];
  return fn ? fn(e.value) : `#${e.code} +${e.value}`;
}

/* ---- Propriétés secondaires d'artéfact, hors de tout exemplaire ----------
 * Une recommandation désigne une propriété SANS valeur (voir `RecoSlot.artifacts`)
 * : il faut donc pouvoir la nommer et savoir sur quelle sorte d'artéfact elle
 * peut tomber, sans avoir d'artéfact sous la main.
 * ---------------------------------------------------------------------- */

// Les formateurs ci-dessus intègrent la valeur ; on leur passe un JOKER plutôt
// que de dupliquer 45 libellés dans une seconde table qui dériverait.
//
// ⚠️ Le « +X% » est GARDÉ tel quel. Le retirer par expression régulière cassait
// les libellés qui portent la valeur au milieu (« Dégâts add. par X% des PV »)
// ou qui l'annoncent (« …, jusqu'à +X% » → « …, jusqu'à »).
export function artifactSubLabel(code: number): string {
  const fn = ARTIFACT_SUB[code];
  return fn ? fn('X' as unknown as number) : `#${code}`;
}

export function isArtifactSub(code: number): boolean {
  return Number.isFinite(code) && ARTIFACT_SUB[code] != null;
}

// Sur quelle sorte d'artéfact une propriété peut-elle apparaître ? Les codes
// sont rangés par PLAGES dans les données com2us :
//   200-299 → les deux · 300-399 → attribut seul · 400-499 → type seul.
// Vérifié sur 2 120 artéfacts d'un compte réel : aucune plage ne débordait.
export function artifactSubKinds(code: number): ArtifactKind[] {
  if (code >= 300 && code < 400) return ['element'];
  if (code >= 400 && code < 500) return ['archetype'];
  return ['element', 'archetype'];
}

// Propriétés proposables pour une sorte d'artéfact, dans l'ordre des codes
// (celui du jeu : effets généraux, puis élémentaires ou par compétence).
export function artifactSubsFor(kind: ArtifactKind): { code: number; label: string }[] {
  return Object.keys(ARTIFACT_SUB)
    .map(Number)
    .filter((c) => artifactSubKinds(c).includes(kind))
    .sort((a, b) => a - b)
    .map((code) => ({ code, label: artifactSubLabel(code) }));
}

// Affichage de la stat principale d'une relique (en %).
export function formatRelicMain(e: EffectLine): string {
  const def = RELIC_MAIN[e.code];
  return def ? `${def.label} +${e.value}%` : `#${e.code} +${e.value}`;
}
