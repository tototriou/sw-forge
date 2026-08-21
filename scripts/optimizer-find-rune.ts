// Diagnostic AD HOC (temporaire) — retrouve dans le pool box d'un compte la
// rune décrite par l'utilisateur (slot/set/rareté/main/innée/sous-stats
// approximatives), pour ensuite l'utiliser dans un diagnostic buildBuckets
// (voir optimizer-bucket-rank-diag.ts). Même chargement (`loadBoxMonster`)
// que scripts/optimizer-search.ts — même pool que les recherches déjà
// lancées cette session.
//
// Usage : optimizer-find-rune.ts <export.json> <nomMonstre> <slot> <set> <mainCode>

import { loadBoxMonster } from './lib/loadMonster';

const [exportPath, monsterName, slotArg, setArg, mainCodeArg] = process.argv.slice(2);
if (!exportPath || !monsterName || !slotArg || !setArg || !mainCodeArg) {
  console.error('Usage: optimizer-find-rune.ts <export.json> <nomMonstre> <slot> <set> <mainCode>');
  process.exit(1);
}
const { allRunes } = loadBoxMonster(exportPath, monsterName);

const candidates = allRunes.filter(
  (r) => r.slot === Number(slotArg) && r.set === setArg && r.rarity === 5 && r.main.code === Number(mainCodeArg)
);

console.log(`${candidates.length} candidat(s) slot4/violent/légendaire/main Dmg Crit :`);
for (const r of candidates) {
  const subsStr = r.subs.map((s) => `code${s.code}=${s.value}`).join(' ');
  console.log(
    `  id=${r.id} niveau=+${r.level} main=${r.main.value} innée=${r.innate ? `code${r.innate.code}=${r.innate.value}` : 'aucune'} subs=[${subsStr}]`
  );
}
