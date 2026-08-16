// Charge un monstre + son gear + le pool de runes du compte, pour un script
// qui doit lancer/reproduire une recherche Optimizer. TROIS modes, chacun sa
// PROPRE règle de choix quand plusieurs exemplaires du même monstre existent
// — ce ne sont PAS des variantes d'une seule règle générique :
//   - `box`  : meilleur exemplaire par Σ efficience des runes équipées
//              (même règle que `gearedMonsters`, OptimizerSection.tsx).
//   - `siege`: AUCUNE ambiguïté à résoudre — un slot de deck désigne un
//              unitId précis (voir deckMonster.ts, inchangé, déjà correct).
//   - `rta`  : meilleur exemplaire par vitesse de runes MAXIMALE (SPD plate
//              + bonus Swift), même règle que `mapRtaItems` (applyAccount.ts).
// Réutiliser une règle unique aurait été FAUSSE dans au moins un des trois
// contextes — voir la discussion qui a mené à ce module.
//
// ⚠️ La relique appartient à l'UNITÉ (voir `buildGear`, importAccount.ts),
// pas au contexte de chargement — le mauvais exemplaire choisi entraîne à la
// fois les mauvaises stats de base ET la mauvaise relique. D'où
// `printMonsterSummary` : imprimer TOUJOURS ce qui a été choisi, jamais
// l'utiliser en silence — une hypothèse fausse sur la relique fausse tous
// les seuils demandés en aval sans qu'on s'en rende compte (vécu cette
// session : +2000 ATQ n'a pas le même sens avec ou sans relique ATQ%+12%).

import { readFileSync } from 'fs';
import {
  parseAccountSource,
  parseAccountBox,
  parseAccountInventory,
  parseAccountJson,
} from '../../src/lib/importAccount';
import { runeSpeedOf } from '../../src/lib/applyAccount';
import { runeEfficiency } from '../../src/lib/effects';
import { GearSet, RuneDetail } from '../../src/types';
import { loadDeckMonster, DeckMonsterArgs } from './deckMonster';

export interface LoadedMonster {
  unitId: number;
  com2usId: number;
  monsterName: string;
  gear: GearSet;
  allRunes: RuneDetail[];
}

// Index nom ↔ com2usId, chargé une fois par script — même source que
// deckMonster.ts et l'app elle-même (public/data/monsters.json).
export function loadMonsterNames(): Map<number, string> {
  const raw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.monsters;
  return new Map<number, string>(list.map((m: any) => [m.com2usId, m.name]));
}

export function loadMonsterSpeeds(): Map<number, number> {
  const raw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.monsters;
  return new Map<number, number>(list.map((m: any) => [m.com2usId, Number(m.stats?.speed) || 0]));
}

// Imprime TOUJOURS ce qui a été choisi — jamais une hypothèse silencieuse
// (voir le commentaire de tête). À appeler juste après chaque loader.
export function printMonsterSummary(label: string, m: LoadedMonster): void {
  const relic = m.gear.relic ? `main ${JSON.stringify(m.gear.relic.main)}${m.gear.relic.sub ? ` sub ${JSON.stringify(m.gear.relic.sub)}` : ''}` : 'AUCUNE';
  console.log(
    `[${label}] ${m.monsterName} (unitId ${m.unitId}, com2usId ${m.com2usId}) — ` +
      `base atk=${m.gear.base.atk} spd=${m.gear.base.spd} hp=${m.gear.base.hp} def=${m.gear.base.def} ` +
      `cr=${m.gear.base.cr} cd=${m.gear.base.cd} res=${m.gear.base.res} acc=${m.gear.base.acc} — ` +
      `relique : ${relic} — ${m.gear.runes?.length ?? 0} rune(s) équipée(s), pool ${m.allRunes.length} rune(s)`
  );
}

// Mode BOX (« Mon compte ») : meilleur exemplaire par Σ efficience des runes
// équipées — même règle que `gearedMonsters` (OptimizerSection.tsx).
export function loadBoxMonster(exportPath: string, monsterName: string): LoadedMonster {
  const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
  const nameByCom2us = loadMonsterNames();
  const { monsters: box, error } = parseAccountBox(data);
  if (error) console.error('Erreur parse box :', error);

  const candidates = box.filter((b) => nameByCom2us.get(b.com2usId) === monsterName && b.gear);
  if (candidates.length === 0) throw new Error(`"${monsterName}" introuvable (6★, monté) dans ${exportPath}.`);
  const scoreOf = (b: (typeof candidates)[number]) => (b.gear!.runes ?? []).reduce((s, r) => s + runeEfficiency(r), 0);
  const best = candidates.reduce((a, b) => (scoreOf(b) > scoreOf(a) ? b : a));

  const { runes: allRunes } = parseAccountInventory(data);
  return { unitId: best.unitId, com2usId: best.com2usId, monsterName, gear: best.gear!, allRunes };
}

// Box complète, dans la forme attendue par `excludedRuneIds` (runeBuildOptim.ts)
// — nécessaire uniquement pour reproduire une recette avec `exploreAll=false`
// (exclusion des runes portées par un AUTRE monstre de la box).
export function loadBoxForExclusion(exportPath: string): { unitKey: string; com2usId: number | null; gear?: GearSet }[] {
  const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
  const { monsters: box } = parseAccountBox(data);
  return box.map((b) => ({ unitKey: String(b.unitId), com2usId: b.com2usId, gear: b.gear }));
}

// Mode RTA : meilleur exemplaire par vitesse de runes MAXIMALE (SPD plate +
// bonus Swift) — même règle que `mapRtaItems` (applyAccount.ts). Le preset
// RTA porte ses PROPRES runes/artéfacts (séparés du build box), voir
// `parseAccountJson`.
export function loadRtaMonster(exportPath: string, monsterName: string): LoadedMonster {
  const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
  const nameByCom2us = loadMonsterNames();
  const speedByCom2us = loadMonsterSpeeds();
  const { units, error } = parseAccountJson(data);
  if (error) throw new Error(`Erreur parse RTA : ${error}`);

  const candidates = units.filter((u) => nameByCom2us.get(u.com2usId) === monsterName && u.gear);
  if (candidates.length === 0) throw new Error(`"${monsterName}" introuvable en RTA (favoris ou runé) dans ${exportPath}.`);
  const baseSpd = speedByCom2us.get(candidates[0].com2usId) ?? 0;
  const speedOf = (u: (typeof candidates)[number]) => runeSpeedOf(u.flatRuneSpeed, u.swift, baseSpd);
  const best = candidates.reduce((a, b) => (speedOf(b) > speedOf(a) ? b : a));

  const { runes: allRunes } = parseAccountInventory(data);
  // `ImportedUnit` n'expose pas l'unitId (non nécessaire à `mapRtaItems`) —
  // absent, pas un problème pour lancer une recherche (seul `gear` compte),
  // seulement pour l'affichage de traçabilité.
  return { unitId: -1, com2usId: best.com2usId, monsterName, gear: best.gear!, allRunes };
}

// Mode SIÈGE (offense OU défense) : AUCUNE ambiguïté à résoudre — un slot de
// deck désigne un `unitId` précis, contrairement à box/RTA où plusieurs
// exemplaires du même monstre peuvent coexister. Enveloppe fine autour de
// `loadDeckMonster` (deckMonster.ts, INCHANGÉ — déjà correct, utilisé par
// perf-battery.ts et monster-search-cap-sweep.ts) : ne réimplémente rien,
// normalise seulement le résultat à la même forme `LoadedMonster` que
// box/RTA pour que `recipeToSearchParams.ts`/`optimizer-search.ts` puissent
// consommer les trois modes de façon interchangeable.
export function loadSiegeMonster(args: DeckMonsterArgs): LoadedMonster {
  const { gear, allRunes, com2usId } = loadDeckMonster(args);
  // `SiegeImportedSlot` n'expose pas l'unitId (voir importAccount.ts) — même
  // absence, même raison que `loadRtaMonster` ci-dessus : sans effet sur la
  // recherche elle-même, seulement sur l'affichage de traçabilité.
  return { unitId: -1, com2usId, monsterName: args.monsterName, gear, allRunes };
}
