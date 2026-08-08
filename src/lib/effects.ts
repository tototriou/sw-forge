// Mapping des codes d'effets com2us (runes, artéfacts, reliques) → libellés.
// Aligné sur sw-exporter (app/mapping.js) et vérifié sur des exports réels.

import { EffectLine, RuneDetail } from '../types';

export type StatKey = 'hp' | 'atk' | 'def' | 'spd' | 'cr' | 'cd' | 'res' | 'acc';

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

// Rareté → libellé + couleur du texte/bordure (vive) + fond (dégradé sombre),
// façon bannière du jeu (ex. Légendaire = orange sur bordeaux).
export const RARITY_META: Record<number, { label: string; color: string; bg: string }> = {
  5: { label: 'Légendaire', color: '#f8b24a', bg: 'linear-gradient(180deg,#7a2a1c,#431310)' },
  4: { label: 'Héroïque', color: '#c88cff', bg: 'linear-gradient(180deg,#3f2270,#241145)' },
  3: { label: 'Rare', color: '#7cf0a6', bg: 'linear-gradient(180deg,#1f5a39,#0f3121)' },
  2: { label: 'Magique', color: '#8fd4ff', bg: 'linear-gradient(180deg,#1f4a72,#0f2942)' },
  1: { label: 'Commun', color: '#e6e6e6', bg: 'linear-gradient(180deg,#4a4a4a,#2a2a2a)' },
};

// Colorisation du symbole de set selon la rareté de la rune (filtre CSS sur l'image).
// Base sépia+saturation (teinte ~orange), puis hue-rotate par rareté.
const SET_SHADOW = 'drop-shadow(rgba(10, 6, 3, 0.95) 0px 1px 1px)';
export const RARITY_FILTER: Record<number, string> = {
  5: `sepia(1) saturate(7.5) hue-rotate(330deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Légendaire → orange
  4: `sepia(1) saturate(7.5) hue-rotate(235deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Héroïque → violet
  3: `sepia(1) saturate(7.5) hue-rotate(80deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Rare → vert
  2: `sepia(1) saturate(7.5) hue-rotate(175deg) brightness(0.9) contrast(1.18) ${SET_SHADOW}`, // Magique → bleu
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

// Valeurs max (rune 6★, non antique) — pour l'efficience. Source sw-exporter.
export const MAINSTAT_MAX: Record<number, number> = {
  1: 2448, 2: 63, 3: 160, 4: 63, 5: 160, 6: 63, 8: 42, 9: 58, 10: 80, 11: 64, 12: 64,
};
// N.B. substats plats (PV/ATQ/DEF) : max « doublés » façon scoringsw
// (PV 3750, ATQ/DEF 200) → cohérent avec les efficiences observées.
export const SUBSTAT_MAX: Record<number, number> = {
  1: 3750, 2: 40, 3: 200, 4: 40, 5: 200, 6: 40, 8: 30, 9: 30, 10: 35, 11: 40, 12: 40,
};

// Efficience d'une rune (%) : (main plafonné à 1 + Σ substats/max + innée/max) / 2.8.
// Meule incluse (déjà dans value). Max non antiques → antiques > 100%.
export function runeEfficiency(rune: RuneDetail): number {
  let ratio = 0;
  const mm = MAINSTAT_MAX[rune.main.code];
  if (mm) ratio += Math.min(rune.main.value / mm, 1);
  for (const s of rune.subs) {
    const m = SUBSTAT_MAX[s.code];
    if (m) ratio += s.value / m;
  }
  if (rune.innate) {
    const m = SUBSTAT_MAX[rune.innate.code];
    if (m) ratio += rune.innate.value / m;
  }
  return (ratio / 2.8) * 100;
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

// Affichage de la stat principale d'une relique (en %).
export function formatRelicMain(e: EffectLine): string {
  const def = RELIC_MAIN[e.code];
  return def ? `${def.label} +${e.value}%` : `#${e.code} +${e.value}`;
}
