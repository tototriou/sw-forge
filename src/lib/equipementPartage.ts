// L'équipement (runes, artéfacts, relique, stats de base) reçu d'un tiers dans
// un fichier partagé : la prépa RTA (rtaShare.ts) et les équipes de siège
// (siegeShare.ts) le lisent par la même porte.
//
// Il n'est utilisé QU'À L'AFFICHAGE (roue de runes, stats totales de
// l'auteur) : il n'entre jamais dans ce que l'app croit posséder, et ne se
// compare à rien.
//
// ⚠️ Validation structurelle seulement — types et bornes. On ne juge pas la
// **plausibilité** des valeurs : un socle de rune inhabituel peut venir d'une
// nouveauté du jeu que cette version ne connaît pas encore, et refuser
// l'affichage serait pire que montrer un chiffre surprenant.

import { GearSet, RelicUnique, RUNE_SETS } from '../types';

const SET_KEYS = new Set<string>(RUNE_SETS.map((s) => s.key));

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

// Propriété unique d'une relique reçue d'un tiers.
//
// ⚠️ **Deux formes acceptées.** Les fichiers exportés jusqu'ici portaient
// `relic.sub = { code, value }` — où `code` était en réalité le TYPE de la
// relique et `value` la TRANCHE de stat, le pourcentage étant perdu à
// l'extraction. On les lit encore, sans pourcentage : la tranche seule
// s'affiche, plutôt qu'un « +0 % » faux. Les fichiers récents portent
// `relic.unique = { type, tranche, percent }`.
function cleanRelicUnique(relic: Record<string, unknown> | undefined): RelicUnique | null {
  if (!relic) return null;
  const u = relic.unique as Record<string, unknown> | undefined;
  if (u && typeof u === 'object') {
    const type = Number(u.type);
    const tranche = Number(u.tranche);
    if (!Number.isFinite(type) || !Number.isFinite(tranche) || type <= 0 || tranche <= 0) return null;
    const percent = Number(u.percent);
    return { type, tranche, ...(Number.isFinite(percent) && percent > 0 ? { percent } : {}) };
  }
  const ancien = cleanEffect(relic.sub);
  if (!ancien || ancien.code <= 0 || ancien.value <= 0) return null;
  return { type: ancien.code, tranche: ancien.value };
}

const nombre = (v: unknown, defaut = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : defaut;
};

// `avertir` reçoit les corrections appliquées (une relique ignorée), à
// remonter au lecteur ; `where` situe l'équipement dans le fichier.
export function cleanGear(raw: unknown, avertir: (message: string) => void, where: string): GearSet | undefined {
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

  const relicRaw = o.relic as Record<string, unknown> | undefined;
  const relicMain = cleanEffect(relicRaw?.main);
  // ⚠️ `id` et `upgrade` sont non optionnels dans `RelicDetail` (commit
  // `75f073f`) : un lien émis avant cette version ne les
  // porte pas. On ne les fabrique jamais avec `undefined` — la relique entière
  // est ignorée, avec un avertissement, plutôt que de mentir sur son typage.
  const relicId = Number(relicRaw?.id);
  const relicUpgrade = Number(relicRaw?.upgrade);
  const relicIdValide = Number.isFinite(relicId) && relicId > 0;
  const relicUpgradeValide = Number.isFinite(relicUpgrade) && relicUpgrade >= 0 && relicUpgrade <= 15;
  let relic: GearSet['relic'];
  if (relicMain) {
    if (relicIdValide && relicUpgradeValide) {
      const relicUnique = cleanRelicUnique(relicRaw);
      relic = {
        id: Math.round(relicId),
        upgrade: Math.round(relicUpgrade),
        main: relicMain,
        ...(relicUnique ? { unique: relicUnique } : {}),
      };
    } else {
      avertir(`${where} : relique sans « id » ou « upgrade » valide (fichier d'une version antérieure de l'application) — ignorée.`);
    }
  }

  // Un équipement entièrement vide ne vaut pas la peine d'être transporté :
  // il ferait apparaître un chevron « voir le détail » qui n'ouvre rien.
  if (runes.length === 0 && artifacts.length === 0 && !relic) return undefined;

  return {
    base,
    runes,
    artifacts,
    ...(relic ? { relic } : {}),
  } as GearSet;
}
