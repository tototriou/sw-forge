// Diagnostic AD HOC (temporaire) — imprime le build équipé sur un monstre
// chargé depuis un deck de siège précis (offense par défaut), pour
// identifier avec certitude les runes réelles avant un diagnostic ciblé.
//
// Usage : optimizer-dump-siege.ts <export.json> <deckId> <nomMonstre> [--defense]

import { loadSiegeMonster, printMonsterSummary } from './lib/loadMonster';
import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';

const defense = process.argv.includes('--defense');
const [exportPath, deckIdArg, monsterName] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!exportPath || !deckIdArg || !monsterName) {
  console.error('Usage: optimizer-dump-siege.ts <export.json> <deckId> <nomMonstre> [--defense]');
  process.exit(1);
}
const loaded = loadSiegeMonster({ exportPath, deckId: Number(deckIdArg), monsterName, defense, rest: [] });
printMonsterSummary(defense ? 'siège défense' : 'siège offense', loaded);

const stats = computeStats(loaded.gear);
console.log('\nStats du build équipé :');
for (const s of stats) console.log(`  ${s.key} = ${s.total}`);

console.log(`\nSets actifs : ${activeSets(loaded.gear.runes.map((r) => r.set)).join('+') || 'aucun'}`);

console.log('\nRunes équipées :');
for (const r of loaded.gear.runes.slice().sort((a, b) => a.slot - b.slot)) {
  const subsStr = r.subs.map((s) => `code${s.code}=${s.value}`).join(' ');
  console.log(
    `  slot${r.slot} id=${r.id} set=${r.set} rareté=${r.rarity} +${r.level} main=code${r.main.code}=${r.main.value} ` +
      `innée=${r.innate ? `code${r.innate.code}=${r.innate.value}` : 'aucune'} subs=[${subsStr}]`
  );
}
