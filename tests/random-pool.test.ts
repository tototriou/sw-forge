// Le pool synthétique partagé (`scripts/lib/randomPool.ts`).
//
// ⚠️ **Ce que ce fichier protège n'est pas « le générateur marche », c'est
// « le générateur produit EXACTEMENT ce qu'il produisait avant d'être
// consolidé ».** Les empreintes ci-dessous ont été relevées sur le code
// D'AVANT (le patron dupliqué dans les 8 fichiers, corps vérifié identique au
// caractère près), puis figées ici. Un test qui les aurait calculées avec le
// nouveau module n'aurait vérifié que sa propre cohérence.
//
// Ce qui les casserait : intervertir deux appels à `rng()`, ajouter ou
// retirer un tirage, changer une borne de valeur. Rien de tout ça ne ferait
// échouer un test de moteur de façon lisible — les benchmarks et les tests à
// seed fixe compareraient simplement autre chose qu'avant, en silence.

import { egal, ok, titre } from './outils';
import {
  SETS_JOKER,
  SETS_SANS_JOKER,
  SETS_VARIES,
  mulberry32,
  randomPool,
} from '../scripts/lib/randomPool';
import { RuneDetail } from '../src/types';

// djb2 sur le JSON du pool — court, stable, et sensible au moindre décalage
// d'un tirage.
function empreinte(pool: RuneDetail[]): string {
  const texte = JSON.stringify(pool);
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = (Math.imul(h, 33) ^ texte.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

// Relevées sur le code d'avant la consolidation — voir l'en-tête.
const EMPREINTES: [string, string[], number, number, string][] = [
  ['SETS_JOKER', SETS_JOKER, 1000, 3, '11ba91d2'],
  ['SETS_JOKER', SETS_JOKER, 7, 5, '21a2c672'],
  ['SETS_JOKER', SETS_JOKER, 42, 20, '70568979'],
  ['SETS_SANS_JOKER', SETS_SANS_JOKER, 1000, 3, '95b1556f'],
  ['SETS_SANS_JOKER', SETS_SANS_JOKER, 7, 5, 'e7556ea4'],
  ['SETS_SANS_JOKER', SETS_SANS_JOKER, 42, 20, 'c6301d42'],
  ['SETS_VARIES', SETS_VARIES, 1000, 3, 'baa1b941'],
  ['SETS_VARIES', SETS_VARIES, 7, 5, 'a35c2ad7'],
  ['SETS_VARIES', SETS_VARIES, 42, 20, '509b54a8'],
];

export default function testRandomPool() {
  titre('Pool synthétique partagé — la séquence de tirage est un contrat');

  for (const [nom, sets, seed, perSlot, attendue] of EMPREINTES) {
    const pool = randomPool(mulberry32(seed), perSlot, sets);
    egal(empreinte(pool), attendue, `${nom} seed=${seed} perSlot=${perSlot} : pool IDENTIQUE à l’avant-consolidation`);
  }

  // Déterminisme : deux appels avec la MÊME seed donnent le même pool.
  const a = randomPool(mulberry32(99), 4);
  const b = randomPool(mulberry32(99), 4);
  egal(empreinte(a), empreinte(b), 'même seed → même pool');

  // ⚠️ …mais deux pools tirés du MÊME flux diffèrent : plusieurs appelants en
  // enchaînent volontairement, et les rendre identiques les ferait comparer
  // un pool à lui-même sans rien signaler.
  const flux = mulberry32(99);
  const premier = randomPool(flux, 4);
  const second = randomPool(flux, 4);
  ok(empreinte(premier) !== empreinte(second), 'deux pools du MÊME flux diffèrent (le rng avance)');

  // Structure : 6 emplacements peuplés, ids consécutifs, 4 sous-stats.
  const pool = randomPool(mulberry32(5), 3, SETS_JOKER);
  egal(pool.length, 18, '6 emplacements × perSlot runes');
  egal(
    [1, 2, 3, 4, 5, 6].map((s) => pool.filter((r) => r.slot === s).length),
    [3, 3, 3, 3, 3, 3],
    'chaque emplacement reçoit exactement `perSlot` runes'
  );
  egal(pool.map((r) => r.id), Array.from({ length: 18 }, (_, i) => i + 1), 'ids consécutifs à partir de 1');
  ok(pool.every((r) => r.subs.length === 4), 'quatre sous-stats par rune');
  ok(pool.every((r) => sets_de(r, SETS_JOKER)), 'les sets tirés appartiennent à l’assortiment demandé');
}

function sets_de(r: RuneDetail, sets: string[]): boolean {
  return sets.includes(r.set);
}
