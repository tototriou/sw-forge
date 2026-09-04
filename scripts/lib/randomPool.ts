// Le pool de runes SYNTHÉTIQUE — un PRNG à seed, des runes plausibles, et
// rien d'autre. Consolidation d'un patron qui existait, quasi identique, dans
// 13 fichiers (4 tests + 9 scripts) : même corps au caractère près dans 8
// d'entre eux, seule la liste des sets changeait.
//
// ⚠️ **La séquence de tirage est un CONTRAT, pas un détail
// d'implémentation.** Chaque appel à `rng()` se fait dans un ordre précis
// (set → principale → 4 sous-stats → valeur de la principale) : intervertir
// deux lignes, ajouter un tirage ou en retirer un décale TOUT le pool à
// partir de là. Les tests et les benchmarks qui s'appuient sur une seed fixe
// ne compareraient alors plus rien à ce qu'ils comparaient avant, sans qu'un
// seul d'entre eux échoue de façon lisible. `tests/random-pool.test.ts` fige
// des empreintes RELEVÉES SUR LE CODE D'AVANT cette consolidation — c'est
// leur seule raison d'être.
//
// ⚠️ **Ce n'est PAS le pool le plus réaliste possible**, et ça n'a jamais été
// le but : les sous-stats sont tirées uniformément, sans les corrélations du
// jeu (qualité, meules, stat principale interdite en sous-stat…). C'est un
// générateur de VOLUME reproductible, pour exercer la mécanique du moteur.
// Une question qui dépend du réalisme des runes se pose sur un compte réel
// (voir `scripts/lib/loadMonster.ts`), jamais ici.
//
// ⚠️ **Cinq variantes du dépôt ne passent PAS par ce module, délibérément** :
// elles biaisent le tirage pour provoquer une situation précise, donc leur
// séquence diffère et les migrer changerait leurs pools —
// `rune-optim-filterslot-topk.test.ts` et `filterslot-topk-diag.ts` (mode
// `sparse`), `parallel-pairing-quota-diag.ts` (sets rapides vs lents, pour
// déséquilibrer les tranches), `stress-tranche-weighting-diag.ts` et
// `stress-tranche-weighting-attainable-diag.ts` (principales FORCÉES par
// emplacement). Leur biais est le sujet même de ce qu'elles mesurent.

import { RuneDetail, EffectLine } from '../../src/types';

/**
 * PRNG déterministe (mulberry32) — aucune dépendance, et une seed fixe
 * redonne exactement le même pool d'une exécution à l'autre, sur n'importe
 * quelle machine.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Les trois assortiments de sets en usage, chacun choisi pour ce qu'il fait
 * travailler — ce ne sont PAS trois façons arbitraires d'écrire la même
 * chose.
 */
// Deux sets 4 pièces, deux sets 2 pièces, et Intangible : assez varié pour
// exercer le groupage par compte, y compris la concurrence d'un joker avec un
// set HORS combo demandé (Shield isolé).
export const SETS_JOKER = ['violent', 'swift', 'will', 'shield', 'fight', 'intangible'];
// Le même, SANS joker : pour isoler un comportement de l'arithmétique
// particulière du joker (une seule rune Intangible équipable par monstre).
export const SETS_SANS_JOKER = ['violent', 'swift', 'will', 'shield', 'fight'];
// Neuf sets : dilue le pool, donc moins de pièces par set demandé et des
// compartiments plus nombreux — le régime que veulent les benchmarks.
export const SETS_VARIES = ['violent', 'swift', 'despair', 'will', 'shield', 'fight', 'focus', 'endure', 'intangible'];

// Les codes de statistique tirables. ⚠️ Ne couvre PAS les règles du jeu sur
// les principales par emplacement (slot 1 toujours ATQ+, etc.) : le pool est
// volontairement plus permissif que la réalité, ce qui donne au moteur DAVANTAGE
// de candidats à écarter, jamais moins.
const STAT_CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

/**
 * Une rune plausible, à +15, rang 6, légendaire — quatre sous-stats
 * distinctes de sa principale (dans la limite de 10 essais, après quoi un
 * doublon passe : c'est le comportement d'origine, conservé tel quel).
 */
export function randomRune(id: number, slot: number, rng: () => number, setKeys: string[] = SETS_JOKER): RuneDetail {
  const set = setKeys[Math.floor(rng() * setKeys.length)];
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
  for (let i = 0; i < 4; i++) {
    let code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
    let tries = 0;
    while (used.has(code) && tries < 10) {
      code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
      tries++;
    }
    used.add(code);
    subs.push({ code, value: 5 + Math.floor(rng() * 40) });
  }
  return {
    id, slot, set, rank: 6, rarity: 5, level: 15,
    main: { code: mainCode, value: 10 + Math.floor(rng() * 100) },
    subs,
  };
}

/**
 * `perSlot` runes pour CHACUN des 6 emplacements, ids consécutifs à partir
 * de 1, emplacement par emplacement.
 *
 * ⚠️ Prend un `rng` DÉJÀ construit, jamais une seed : plusieurs appelants
 * enchaînent volontairement plusieurs pools sur le même flux (un second pool
 * tiré du même `rng` doit être DIFFÉRENT du premier, pas identique).
 */
export function randomPool(rng: () => number, perSlot: number, setKeys: string[] = SETS_JOKER): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng, setKeys));
  }
  return out;
}
