// Diagnostic AD HOC (temporaire) — imprime le build ACTUELLEMENT ÉQUIPÉ sur un
// monstre (runes + stats), pour vérifier une hypothèse : les captures d'écran
// envoyées par l'utilisateur correspondent-elles au build équipé réel de ce
// Lushen (même chargement que scripts/optimizer-search.ts, `loadBoxMonster`) ?
//
// Usage : optimizer-dump-equipped.ts <export.json> <nomMonstre>

import { loadBoxMonster, printMonsterSummary } from './lib/loadMonster';
import { computeStats } from '../src/lib/stats';
import { activeSets } from '../src/lib/effects';

const [exportPath, monsterName] = process.argv.slice(2);
if (!exportPath || !monsterName) {
  console.error('Usage: optimizer-dump-equipped.ts <export.json> <nomMonstre>');
  process.exit(1);
}
const loaded = loadBoxMonster(exportPath, monsterName);
printMonsterSummary('box', loaded);

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
