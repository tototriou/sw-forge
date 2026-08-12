// Aide partagée par les scripts scripts/monster-*.ts : retrouve un monstre
// précis (par nom) dans un deck d'offense de siège d'un export de compte réel,
// et expose son gear + l'inventaire complet de runes du compte. Générique —
// aucun nom de monstre ni deck n'est en dur ici, ils viennent des arguments
// CLI de l'appelant.

import { readFileSync } from 'fs';
import { parseAccountSource, parseAccountInventory, parseSiegeOffense } from '../../src/lib/importAccount';
import { GearSet } from '../../src/types';

export interface DeckMonsterArgs {
  exportPath: string;
  deckId: number;
  monsterName: string;
}

export function parseDeckMonsterArgs(argv: string[], usage: string): DeckMonsterArgs {
  const [exportPath, deckIdRaw, monsterName] = argv;
  if (!exportPath || !deckIdRaw || !monsterName) {
    console.error(usage);
    process.exit(1);
  }
  const deckId = Number(deckIdRaw);
  if (!Number.isFinite(deckId)) {
    console.error(`deckId invalide : ${deckIdRaw}`);
    process.exit(1);
  }
  return { exportPath, deckId, monsterName };
}

export function loadDeckMonster({ exportPath, deckId, monsterName }: DeckMonsterArgs) {
  const raw = readFileSync(exportPath, 'utf8');
  const data = parseAccountSource(raw)!;

  const monstersRaw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
  const monstersList = Array.isArray(monstersRaw) ? monstersRaw : monstersRaw.monsters;
  const nameByCom2us = new Map<number, string>(monstersList.map((m: any) => [m.com2usId, m.name]));

  const { decks, error } = parseSiegeOffense(data);
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
  return { data, deck, gear, allRunes };
}
