// Diagnostic TEMPORAIRE : pour une liste d'ids de runes donnée, indique quel
// monstre de la box (unit_id/com2usId/nom) les porte ACTUELLEMENT selon
// unit_list, pour comprendre pourquoi excludedRuneIds() les exclut du pool
// d'un autre monstre qui, lui, les référence dans son deck de siège.
//
// Usage : rune-owner-diag.ts <export.json> <id1,id2,...>

import { readFileSync } from 'fs';
import { parseAccountSource, parseAccountBox } from '../src/lib/importAccount';

const [exportPath, idsArg] = process.argv.slice(2);
const ids = new Set(idsArg.split(',').map((s) => Number(s.trim())));

const raw = readFileSync(exportPath, 'utf8');
const data = parseAccountSource(raw)!;
const monstersRaw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const monstersList = Array.isArray(monstersRaw) ? monstersRaw : monstersRaw.monsters;
const nameByCom2us = new Map<number, string>(monstersList.map((m: any) => [m.com2usId, m.name]));

const { monsters: box, error } = parseAccountBox(data);
if (error) console.error('Erreur box :', error);

for (const id of ids) {
  const owners = box.filter((b) => b.gear?.runes.some((r) => r.id === id));
  console.log(`Rune ${id} : portée par ${owners.length} monstre(s) dans la box actuelle :`);
  for (const o of owners) {
    console.log(`  - ${nameByCom2us.get(o.com2usId) ?? '???'} (unitId=${o.unitId}, com2usId=${o.com2usId}, niveau ${o.level})`);
  }
  if (owners.length === 0) console.log('  (aucun — cette rune n\'est équipée sur AUCUN monstre de la box actuelle, elle devrait être en inventaire libre)');
}

// Sonia elle-même : combien d'exemplaires dans la box, quels com2usId ?
const soniaEntries = box.filter((b) => (nameByCom2us.get(b.com2usId) ?? '').toLowerCase().includes('sonia'));
console.log(`\nExemplaires de Sonia dans la box : ${soniaEntries.length}`);
for (const s of soniaEntries) {
  console.log(`  - unitId=${s.unitId}, com2usId=${s.com2usId}, niveau ${s.level}, runes=[${s.gear?.runes.map((r) => r.id).join(',')}]`);
}
