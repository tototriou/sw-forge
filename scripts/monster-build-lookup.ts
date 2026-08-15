// Retrouve un monstre précis dans un deck d'offense de siège d'un export de
// compte réel, affiche son gear (runes/artéfacts/relique) et ses stats
// calculées (computeStats) — utile pour vérifier le pipeline de calcul de
// stats contre les valeurs annoncées en jeu. Générique : monstre et deck
// viennent des arguments, rien n'est en dur.
//
// Usage : monster-build-lookup.ts <export.json> <deckId> <nomMonstre> [--expect cle=val,cle=val,...]
// Les clés de --expect sont celles de computeStats (hp, atk, def, spd, cr, cd, res, acc).

import { computeStats } from '../src/lib/stats';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE = 'Usage: monster-build-lookup.ts <export.json> <deckId> <nomMonstre> [--expect cle=val,cle=val,...]';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);

const expectArg = process.argv.find((a) => a.startsWith('--expect='));
const expect: Record<string, number> = {};
if (expectArg) {
  for (const pair of expectArg.slice('--expect='.length).split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) expect[k] = Number(v);
  }
}

const { deck, gear } = loadDeckMonster(args);
console.log(`Deck retenu : deckId=${deck.deckId}`);

console.log(`\n=== ${args.monsterName} — base ===`);
console.log(gear.base);

console.log(`\n=== ${args.monsterName} — runes ===`);
for (const r of gear.runes) {
  console.log(
    `slot ${r.slot} · ${r.set} · rang ${r.rank} · rareté ${r.rarity} · +${r.level} · main ${r.main.code}:${r.main.value}` +
      (r.innate ? ` · innée ${r.innate.code}:${r.innate.value}` : '') +
      ` · subs [${r.subs.map((s) => `${s.code}:${s.value}${s.grind ? `(+${s.grind})` : ''}${s.enchant ? '*' : ''}`).join(', ')}]`
  );
}

console.log(`\n=== ${args.monsterName} — artéfacts ===`);
for (const a of gear.artifacts) {
  console.log(
    `${a.kind} · rareté ${a.rarity} · +${a.level} · main ${a.main.code}:${a.main.value} · subs [${a.subs
      .map((s) => `${s.code}:${s.value}${s.enchant ? '*' : ''}`)
      .join(', ')}]`
  );
}

console.log(`\n=== ${args.monsterName} — relique ===`);
console.log(gear.relic ?? '(aucune)');

console.log('\n=== Stats calculées (computeStats) ===');
const stats = computeStats(gear);
for (const row of stats) {
  console.log(`${row.label.padEnd(12)} base ${String(row.base).padStart(7)}  bonus +${row.bonus}${row.suffix}  total ${row.total}${row.suffix}`);
}

if (Object.keys(expect).length > 0) {
  console.log('\n=== Comparaison aux valeurs annoncées (--expect) ===');
  for (const row of stats) {
    const a = expect[row.key];
    if (a == null) continue;
    const ecart = row.bonus - a;
    console.log(`${row.label.padEnd(12)} bonus calculé +${row.bonus}${row.suffix}  vs annoncé +${a}${row.suffix}  écart ${ecart}`);
  }
}
