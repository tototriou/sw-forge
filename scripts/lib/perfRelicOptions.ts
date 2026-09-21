// Les trois options relique de `perf-battery.ts` (implementation-relique,
// B.6, rév. 35) : `--relic-main=<equipped|libre|100|101|102>
// --relic-type=<libre|1..16> --relic-min-upgrade=<0..15>`.
//
// Module SÉPARÉ de `perfShared.ts` (chargé par un `worker_threads`, qui ne
// doit tirer ni React ni `damage.ts`) : le défaut du seuil vient de
// `useOptimizerState.ts` (`DEFAULT_RELIC_MIN_UPGRADE`, la constante de
// l'écran — jamais recopiée), et ce fichier-là importe React. Analyse PURE
// d'un `argv` (aucune lecture de `process.argv`), donc testable.

import type { Case } from './perfShared';
import { DEFAULT_RELIC_MIN_UPGRADE, RelicMainChoice, RelicUniqueChoice } from '../../src/hooks/useOptimizerState';

export type OptionRelique = NonNullable<Case['relic']>;

const PREFIXES = ['--relic-main=', '--relic-type=', '--relic-min-upgrade='] as const;

/**
 * Aucune des trois options posée → `undefined`, comportement d'avant (pas de
 * `relicContext`) ; au moins une → les absentes prennent le défaut de
 * l'écran (`libre`, `libre`, `DEFAULT_RELIC_MIN_UPGRADE`). Une valeur hors
 * domaine ou une option `--relic-*` inconnue est REFUSÉE, jamais ignorée en
 * silence : cette validation rend les jetons sûrs à recopier tels quels dans
 * la ligne de commande du processus `--case=` (règle `spawn` du skill
 * optimizer-perf-testing — chaque morceau est un littéral d'un ensemble fini).
 */
export function parseOptionsRelique(argv: readonly string[]): OptionRelique | undefined {
  const lire = (prefixe: string) => argv.find((a) => a.startsWith(prefixe))?.slice(prefixe.length);
  const inconnues = argv.filter((a) => a.startsWith('--relic-') && !PREFIXES.some((p) => a.startsWith(p)));
  if (inconnues.length > 0) throw new Error(`Option relique inconnue : ${inconnues.join(' ')} (attendu ${PREFIXES.join(', ')}).`);
  const main = lire('--relic-main=');
  const type = lire('--relic-type=');
  const seuil = lire('--relic-min-upgrade=');
  if (main == null && type == null && seuil == null) return undefined;

  let principale: RelicMainChoice = 'libre';
  if (main != null) {
    if (main === 'equipped' || main === 'libre') principale = main;
    else if (main === '100') principale = 100;
    else if (main === '101') principale = 101;
    else if (main === '102') principale = 102;
    else throw new Error(`--relic-main=${main} : attendu equipped, libre, 100, 101 ou 102.`);
  }
  let typeChoisi: RelicUniqueChoice = 'libre';
  if (type != null && type !== 'libre') {
    const n = Number(type);
    if (!Number.isInteger(n) || n < 1 || n > 16) throw new Error(`--relic-type=${type} : attendu libre ou un entier entre 1 et 16.`);
    typeChoisi = n;
  }
  let seuilChoisi = DEFAULT_RELIC_MIN_UPGRADE;
  if (seuil != null) {
    const n = Number(seuil);
    if (!Number.isInteger(n) || n < 0 || n > 15) throw new Error(`--relic-min-upgrade=${seuil} : attendu un entier entre 0 et 15.`);
    seuilChoisi = n;
  }
  return { principale, type: typeChoisi, seuil: seuilChoisi };
}

/** Les jetons `--relic-*` d'un `argv`, à recopier tels quels au processus `--case=` — après `parseOptionsRelique`, jamais avant. */
export function jetonsRelique(argv: readonly string[]): string[] {
  return argv.filter((a) => PREFIXES.some((p) => a.startsWith(p)));
}

// Le libellé du run porte l'intention relique (B.6 : « inscrites dans le
// libellé du run ») — un résultat mesuré avec relique ne peut ainsi jamais
// se confondre avec l'entrée sans relique de `perf-baseline.json`.
export function libelleAvecRelique(label: string, relic: OptionRelique | undefined): string {
  return relic ? `${label} [relique ${String(relic.principale)}/${String(relic.type)}/+${relic.seuil}]` : label;
}

export function caseAvecRelique(c: Case, relic: OptionRelique | undefined): Case {
  return relic ? { ...c, label: libelleAvecRelique(c.label, relic), relic } : c;
}
