// Aide partagée par les scripts scripts/monster-*.ts : retrouve un monstre
// précis (par nom) dans un deck de siège (offense OU défense) d'un export de
// compte réel, et expose son gear + l'inventaire complet de runes du compte.
// Générique — aucun nom de monstre ni deck n'est en dur ici, ils viennent des
// arguments CLI de l'appelant.

import { readFileSync } from 'fs';
import { parseAccountSource, parseAccountInventory, parseSiegeOffense, parseSiegeDefense } from '../../src/lib/importAccount';
import { GearSet } from '../../src/types';
import { loadMonstersList } from './monstersData';

export interface DeckMonsterArgs {
  exportPath: string;
  deckId: number;
  monsterName: string;
  defense: boolean;
  // Reste des arguments CLI, dans leur ordre d'origine, une fois les 3
  // positionnels ci-dessus ET `--defense` (peut apparaître n'importe où)
  // retirés — pour que chaque script continue d'indexer ses propres options
  // (statKeys, objective, slotFilterCap…) SANS que leur position ne bouge
  // selon que `--defense` a été passé ou non.
  rest: string[];
}

export function parseDeckMonsterArgs(argv: string[], usage: string): DeckMonsterArgs {
  const defense = argv.includes('--defense');
  const positional = argv.filter((a) => a !== '--defense');
  const [exportPath, deckIdRaw, monsterName, ...rest] = positional;
  if (!exportPath || !deckIdRaw || !monsterName) {
    console.error(usage);
    process.exit(1);
  }
  const deckId = Number(deckIdRaw);
  if (!Number.isFinite(deckId)) {
    console.error(`deckId invalide : ${deckIdRaw}`);
    process.exit(1);
  }
  return { exportPath, deckId, monsterName, defense, rest };
}

export function loadDeckMonster({ exportPath, deckId, monsterName, defense }: DeckMonsterArgs) {
  const raw = readFileSync(exportPath, 'utf8');
  const data = parseAccountSource(raw)!;

  // Lecture/parsage de monsters.json mis en cache — voir `loadMonstersList`,
  // partagée avec `loadMonster.ts` (revue de code externe, point 2).
  const nameByCom2us = new Map<number, string>();
  for (const mon of loadMonstersList()) if (mon.com2usId != null) nameByCom2us.set(mon.com2usId, mon.name);

  const { decks, error } = defense ? parseSiegeDefense(data) : parseSiegeOffense(data);
  if (error) console.error('Erreur parse siège :', error);

  const deck = decks.find((d) => d.deckId === deckId);
  if (!deck) {
    console.error(`Deck ${deckId} introuvable (decks disponibles : ${decks.map((d) => d.deckId).join(', ')}).`);
    process.exit(1);
  }

  const slot = deck.slots.find((s) => s && nameByCom2us.get(s.com2usId) === monsterName);
  if (!slot || !slot.gear) {
    const present = deck.slots
      .map((s) => (s ? nameByCom2us.get(s.com2usId) ?? `com2usId ${s.com2usId}` : null))
      .filter(Boolean);
    console.error(`"${monsterName}" introuvable dans le deck ${deckId} (contient : ${present.join(', ')}).`);
    process.exit(1);
  }

  const gear: GearSet = slot.gear;
  const { runes: allRunes } = parseAccountInventory(data);
  return { data, deck, gear, allRunes, com2usId: slot.com2usId };
}
