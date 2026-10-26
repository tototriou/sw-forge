// La validation typée (`ValidationTypee`, validationRapide.ts) lit chaque rune
// DISTINCTE une fois — ses lignes, son set, sa valeur, son contrat —, alors
// qu'une rune revient dans des centaines de demi-builds. L'oracle : la même
// construction sur des runes toutes distinctes (une copie par occurrence),
// où rien ne peut se partager, c'est-à-dire la lecture occurrence par
// occurrence. Les deux validations doivent être identiques champ par champ
// (`Object.is` sur chaque élément des tableaux typés), motif de repli
// compris ; puis le travail retiré, en lectures de rune comptées.

import { BaseStats, RuneDetail } from '../src/types';
import { BuildRequirement, PreparedSearch, SearchParams, prepareSearch } from '../src/lib/runeBuildOptim';
import { construireMoitie } from '../src/lib/rechercheRunes';
import { runesAPlat } from '../src/lib/appariementRapide';
import { ValidationTypee } from '../src/lib/validationRapide';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 9000, atk: 700, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function ecart(a: unknown, b: unknown, chemin = ''): string | null {
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.constructor !== b.constructor) return `${chemin} : types différents`;
    const x = a as unknown as ArrayLike<number>;
    const y = b as unknown as ArrayLike<number>;
    if (x.length !== y.length) return `${chemin} : longueurs ${x.length} ≠ ${y.length}`;
    for (let i = 0; i < x.length; i++) if (!Object.is(x[i], y[i])) return `${chemin}[${i}] : ${x[i]} ≠ ${y[i]}`;
    return null;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return `${chemin} : longueurs différentes`;
    for (let i = 0; i < a.length; i++) { const d = ecart(a[i], b[i], `${chemin}[${i}]`); if (d) return d; }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${chemin} : clés ${ka} ≠ ${kb}`;
    for (const k of ka) { const d = ecart((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${chemin}.${k}`); if (d) return d; }
    return null;
  }
  return Object.is(a, b) ? null : `${chemin} : ${String(a)} ≠ ${String(b)}`;
}
const identique = (a: unknown, b: unknown, libelle: string) => { const d = ecart(a, b); ok(d === null, d === null ? libelle : `${libelle} — ${d}`); };

interface Cas { nom: string; prepared: PreparedSearch; runesA: RuneDetail[]; runesB: RuneDetail[] }

function cas(): Cas[] {
  const out: Cas[] = [];
  for (let s = 0; out.length < 6 && s < 300; s++) {
    const rng = mulberry32(27_500 + s);
    const pool = randomPool(rng, 6 + Math.floor(rng() * 5), SETS_JOKER);
    const minStats: BuildRequirement['minStats'] = { spd: 110 + Math.floor(rng() * 50) };
    if (rng() < 0.5) minStats.cr = 30 + Math.floor(rng() * 30);
    if (rng() < 0.5) minStats.res = 20 + Math.floor(rng() * 30);
    const maxStats: NonNullable<BuildRequirement['maxStats']> = rng() < 0.4 ? { def: 900 + Math.floor(rng() * 400) } : {};
    const requirement: BuildRequirement = {
      sets: rng() < 0.5 ? [SETS_JOKER[Math.floor(rng() * (SETS_JOKER.length - 1))]] : [], minStats, maxStats,
      ...(rng() < 0.5 ? { auraResPre: { compter: true, res: 8, acc: 0 } } : {}),
    };
    const params: SearchParams = { base: BASE, artifacts: [], pool, requirement, metric: rng() < 0.5 ? 'eff' : 'score', maxMs: Infinity, maxCollected: Infinity, slotFilterCap: 80 };
    const prepared = prepareSearch(params);
    if (!prepared) continue;
    const A = drain(construireMoitie('A', [0, 1, 2], prepared, prepared.maxSetsForA));
    const B = drain(construireMoitie('B', [3, 4, 5], prepared, prepared.maxSetsForB));
    const runesA = runesAPlat(A, prepared.filtered);
    const runesB = runesAPlat(B, prepared.filtered);
    if (runesA.length < 300 || runesB.length < 300) continue;
    out.push({ nom: `pool ${s} (${params.metric}, ${runesA.length / 3} + ${runesB.length / 3} demi-builds)`, prepared, runesA, runesB });
  }
  return out;
}

/** Une copie par occurrence : aucune rune n'est le même objet qu'une autre. */
const occurrences = (runes: RuneDetail[]) => runes.map((r) => structuredClone(r));

/** Chaque lecture des sous-stats d'une rune (contrat et lignes en lisent une par rune jugée) est comptée ; le même objet par rune d'origine. */
function compteur(runesA: RuneDetail[], runesB: RuneDetail[]) {
  let n = 0;
  const par = new Map<RuneDetail, RuneDetail>();
  const envelopper = (r: RuneDetail) => {
    let p = par.get(r);
    if (!p) {
      p = new Proxy(r, { get: (t, k, rec) => { if (k === 'subs') n++; return Reflect.get(t, k, rec); } });
      par.set(r, p);
    }
    return p;
  };
  return { runesA: runesA.map(envelopper), runesB: runesB.map(envelopper), lectures: () => n, distinctes: par.size };
}

export default function testValidationParRune(): void {
  titre('Validation typée · une lecture par rune distincte, identique à la lecture par occurrence');
  const liste = cas();
  ok(liste.length >= 4, `${liste.length} pools construits par la construction de production`);
  for (const c of liste) {
    const partagee = new ValidationTypee(c.prepared, c.runesA, c.runesB);
    const parOccurrence = new ValidationTypee(c.prepared, occurrences(c.runesA), occurrences(c.runesB));
    egal(partagee.motif, null, `${c.nom} : contrat tenu`);
    identique(partagee, parOccurrence, `${c.nom} : tous les champs identiques à la lecture par occurrence (tables, sets, conditions, tampons)`);

    // Trois lectures des sous-stats par rune jugée : le contrat, les lignes, la valeur (efficience ou score).
    const k = compteur(c.runesA, c.runesB);
    new ValidationTypee(c.prepared, k.runesA, k.runesB);
    const avant = compteur(occurrences(c.runesA), occurrences(c.runesB));
    new ValidationTypee(c.prepared, avant.runesA, avant.runesB);
    egal(avant.lectures(), 3 * (c.runesA.length + c.runesB.length), `${c.nom} : lecture par occurrence, ${avant.lectures()} lectures (3 par occurrence)`);
    egal(k.lectures(), 3 * k.distinctes, `${c.nom} : ${k.distinctes} runes distinctes, ${k.lectures()} lectures (3 par rune distincte)`);
  }

  titre('Validation typée · même motif de repli hors contrat');
  const c = liste[0];
  // Une rune de B, rendue fractionnaire sur une sous-stat ; sa première occurrence est loin dans la liste.
  const cible = c.runesB[c.runesB.length - 1];
  const fautive: RuneDetail = { ...cible, subs: cible.subs.map((s, i) => (i === 0 ? { ...s, value: s.value + 0.5 } : s)) };
  const runesB = c.runesB.map((r) => (r === cible ? fautive : r));
  const motif = new ValidationTypee(c.prepared, c.runesA, runesB).motif;
  ok(motif !== null && motif.includes(`rune ${cible.id}`), `rune fractionnaire : repli nommé (${motif})`);
  egal(motif, new ValidationTypee(c.prepared, occurrences(c.runesA), occurrences(runesB)).motif, 'même motif que la lecture par occurrence');
}
