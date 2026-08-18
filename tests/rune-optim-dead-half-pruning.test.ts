// Test dédié (cas écrits à la main, pas aléatoire) de l'élagage des
// demi-builds MORTS pour un set demandé À PLUS DE 3 PIÈCES (ex. Violent,
// 4 pièces) — voir src/lib/runeBuildOptim.ts, buildBuckets, juste après le
// calcul de `counts`/`jokers`. Trouvé sur un compte réel (Camilla, voir
// spec/outils/optimizer/historique-acceleration-et-outillage.md, « Chantier
// D ») : une tranche entière de compartiments à 0 pièce d'un set 4 pièces,
// aucun n'ayant de joker propre, gaspillait tout son quota de candidats en
// pairing parallèle faute de pouvoir s'apparier avec quoi que ce soit.
//
// Règle, EXACTE (pas une heuristique) : un demi-build (3 runes) sans AUCUNE
// pièce d'un set demandé à plus de 3 pièces ne peut jamais être complété
// par l'autre moitié (max 3 emplacements) SAUF s'il porte LUI-MÊME une rune
// Intangible (joker) — jamais l'autre moitié. Preuve : un joker occupe l'un
// des 3 emplacements de la moitié qui le porte ; si c'est l'AUTRE moitié
// qui le porte, elle ne peut alors fournir que 2 pièces réelles du set (pas
// 3), soit 2+1(joker)=3 au total, jamais 4 — aucune configuration physique
// ne peut faire autrement.
//
// Discipline algo-verify : deux cas MINIMAUX et EXACTS (pas un différentiel
// aléatoire — ce cas est trop étroit pour apparaître fiablement au hasard),
// vérifiant les DEUX côtés de la règle : le cas qui doit être exclu, et le
// cas-limite (joker) qui doit survivre pour ne pas perdre de complétude.

import { BaseStats, RuneDetail } from '../src/types';
import { BuildRequirement, buildBuckets, prepareSearch, searchBuilds } from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

function rune(id: number, slot: number, set: string): RuneDetail {
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: 1, value: 20 }, subs: [{ code: 2, value: 10 }] };
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const requirement: BuildRequirement = { sets: ['violent'], minStats: {} }; // 4 pièces, seul set demandé

export default function testRuneOptimDeadHalfPruning() {
  titre('Optimizer · élagage des demi-builds morts (set à plus de 3 pièces, 0 pièce, 0 joker)');

  // ── Cas 1 : AUCUN joker nulle part dans le pool — moitié A à 0 pièce
  // violent (2 runes "swift", hors combo demandé) face à une moitié B à 3
  // pièces violent (le maximum qu'une moitié seule puisse fournir).
  // Génuinement INFAISABLE (0+3+0 joker = 3 < 4) : la référence naïve ET le
  // moteur doivent tous deux ne rien trouver — ce cas confirme que le
  // résultat vide est correct, pas un effet de bord de l'élagage. ──
  {
    const pool: RuneDetail[] = [
      rune(1, 1, 'swift'), rune(2, 2, 'swift'), rune(3, 3, 'swift'), // moitié A : 0 violent, 0 joker
      rune(4, 4, 'violent'), rune(5, 5, 'violent'), rune(6, 6, 'violent'), // moitié B : 3 violent (le max possible)
    ];
    const params = { base: BASE, artifacts: [], pool, requirement, metric: 'eff' as const };
    const prepared = prepareSearch(params)!;
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
    egal(bucketsA.length, 0, 'sans joker nulle part : le demi-build A (0 violent, 0 joker) est bien exclu de la construction — aucun compartiment A');

    const result = searchBuilds(params);
    egal(result.candidates.length, 0, 'sans joker nulle part : aucun build trouvé — génuinement infaisable (0+3 < 4), pas un faux négatif');
  }

  // ── Cas 2 : UN joker dans la moitié A elle-même — le cas-limite qui DOIT
  // survivre à l'élagage. 0 violent + 1 joker en A, 3 violent en B :
  // 3 (B) + 1 (joker, où qu'il soit) = 4, exactement le compte requis.
  // ⚠️ Remplissage à 'nemesis' (2 pièces, PAS 'swift' — 'swift' est en
  // RÉALITÉ un set à 4 pièces dans ce jeu, voir effects.ts : deux runes
  // 'swift' auraient créé un DEUXIÈME set incomplet, et la vraie règle du
  // jeu dit qu'un joker n'aide personne s'il y a plus d'un set incomplet à
  // la fois (`activeSets`, `partial.length===1`) — piège trouvé en faisant
  // tourner ce test une première fois avec 'swift', 0 candidat au lieu de
  // 1. 'nemesis' × 2 se complète proprement (2/2, aucun reste), laissant
  // UNIQUEMENT violent comme set incomplet pour le joker. ──
  {
    const pool: RuneDetail[] = [
      rune(1, 1, 'intangible'), rune(2, 2, 'nemesis'), rune(3, 3, 'nemesis'), // moitié A : 0 violent, 1 joker
      rune(4, 4, 'violent'), rune(5, 5, 'violent'), rune(6, 6, 'violent'), // moitié B : 3 violent
    ];
    const params = { base: BASE, artifacts: [], pool, requirement, metric: 'eff' as const };
    const prepared = prepareSearch(params)!;
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
    egal(bucketsA.length, 1, 'avec un joker DANS ce demi-build : le compartiment A (0 violent, 1 joker) est bien RETENU — pas de perte de complétude');

    const result = searchBuilds(params);
    egal(result.candidates.length, 1, 'avec un joker DANS ce demi-build : le build (joker complète la 4ᵉ pièce violent) est bien trouvé');
    if (result.candidates.length === 1) {
      ok(result.candidates[0].runeIds.includes(1), 'le build trouvé utilise bien la rune joker (id 1)');
    }
  }

  // ── Cas 3 (contrôle) : set à 2 pièces seulement (nemesis) — 0 pièce dans
  // une moitié reste TOTALEMENT normal (une moitié seule peut fournir les 2
  // pièces), la règle ne doit PAS s'appliquer ici. ──
  {
    const requirement2: BuildRequirement = { sets: ['nemesis'], minStats: {} };
    const pool: RuneDetail[] = [
      rune(1, 1, 'swift'), rune(2, 2, 'swift'), rune(3, 3, 'swift'), // moitié A : 0 nemesis, 0 joker — DOIT rester faisable
      rune(4, 4, 'nemesis'), rune(5, 5, 'nemesis'), rune(6, 6, 'swift'),
    ];
    const params = { base: BASE, artifacts: [], pool, requirement: requirement2, metric: 'eff' as const };
    const prepared = prepareSearch(params)!;
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces));
    egal(bucketsA.length, 1, 'set à 2 pièces seulement : 0 pièce dans une moitié reste normal, jamais élagué (contrôle négatif)');

    const result = searchBuilds(params);
    egal(result.candidates.length, 1, 'set à 2 pièces seulement : le build (2 pièces nemesis côté B seul) est bien trouvé');
  }
}
