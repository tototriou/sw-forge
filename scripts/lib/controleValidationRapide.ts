// Contrôle PAIRE PAR PAIRE de la validation typée
// (src/lib/validationRapide.ts) contre les fonctions de RÉFÉRENCE : `activeSets`/`missingSets`, `computeStats`,
// `aurasPropresDesSetsActifs`/`pointsAuraResPrePropres`, et la boucle du test
// conjoint de `pairBuckets` (runeBuildOptim.ts), recopiée ici à l'identique.
// Partagé par le test `validation-rapide` (pools générés) et le banc
// (`--controle-validation`, survivants réels de `quickOk`).
//
// ⚠️ Égalité STRICTE : feuilles comparées par `Object.is` (−0 et NaN
// compris), ordre des clés par `JSON.stringify` — l'ordre compte, le banc
// compare les candidats sérialisés.

import { RuneDetail } from '../../src/types';
import { StatKey, activeSets, runeEfficiency, runeScore } from '../../src/lib/effects';
import { computeStats } from '../../src/lib/stats';
import { missingSets } from '../../src/lib/recoMatch';
import { AurasPropres, aurasPropresDesSetsActifs, pointsAuraResPrePropres } from '../../src/lib/damage';
import { BuildRequirement, PreparedSearch, StatShortfall } from '../../src/lib/runeBuildOptim';
import { ValidationTypee } from '../../src/lib/validationRapide';

// Copie de `totalCondition` (runeBuildOptim.ts), privée là-bas.
function totalCondition(total: number, key: string, requirement: Pick<BuildRequirement, 'auraResPre'>, propres: AurasPropres): number {
  if (key !== 'res' && key !== 'acc') return total;
  const aura = requirement.auraResPre;
  if (!aura?.compter) return total;
  return total + aura[key] + pointsAuraResPrePropres(propres)[key];
}

/** Égalité stricte récursive (`Object.is` aux feuilles) et même ordre de clés. */
export function strictementEgal(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b);
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => strictementEgal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export interface BilanControle {
  paires: number;
  setsRefuses: number;
  /** Paires aux sets tenus dont les lignes `computeStats` ont été comparées. */
  statsComparees: number;
  /** Tentatives (paire × apport) comparées. */
  tentatives: number;
  collectables: number;
  ecarts: number;
  premierEcart: string | null;
}

export const bilanVide = (): BilanControle => ({ paires: 0, setsRefuses: 0, statsComparees: 0, tentatives: 0, collectables: 0, ecarts: 0, premierEcart: null });

/**
 * Compare la validation typée de la paire `(ga, gb)` à la production. `v` est
 * une instance PROPRE au contrôle (jamais celle du collecteur, dont elle
 * changerait l'état courant). Rend `null` si tout est égal.
 */
export function comparerPaire(v: ValidationTypee, prepared: PreparedSearch, ga: number, gb: number, runes: RuneDetail[], bilan: BilanControle): string | null {
  const { base, artifacts, relic, relicRelache, requirement, metric, minEntries, maxEntries, artPossibles, artFlatFige, relTermMax, relTermMin } = prepared;
  bilan.paires++;
  const ecart = (m: string) => {
    bilan.ecarts++;
    bilan.premierEcart ??= `paire (${ga}, ${gb}) [${runes.map((r) => r.id).join(',')}] : ${m}`;
    return m;
  };
  const active = activeSets(runes.map((r) => r.set));
  const reference = missingSets(requirement.sets, active).length === 0;
  const typee = v.setsEtStats(ga, gb);
  if (reference !== typee) return ecart(`sets réels : production ${reference}, typée ${typee} (actifs ${active.join('/')})`);
  if (!reference) {
    bilan.setsRefuses++;
    return null;
  }
  const stats = computeStats({ base, runes, artifacts, relic: relicRelache ? undefined : relic });
  bilan.statsComparees++;
  const lignes = v.lignes();
  if (!strictementEgal(stats, lignes)) return ecart(`StatRow : ${JSON.stringify(stats)} ≠ ${JSON.stringify(lignes)}`);
  const ids = runes.map((r) => r.id);
  if (!strictementEgal(ids, v.runeIds())) return ecart(`runeIds : ${ids} ≠ ${v.runeIds()}`);
  const eff = runes.reduce((sum, r) => sum + (metric === 'eff' ? runeEfficiency(r) : runeScore(r)), 0);
  if (!Object.is(eff, v.effTotal())) return ecart(`effTotal : ${eff} ≠ ${v.effTotal()}`);
  const propres = aurasPropresDesSetsActifs(active);
  const apports = artPossibles.length > 0 ? artPossibles : [artFlatFige];
  if (apports.length !== v.nApports) return ecart(`apports : ${apports.length} ≠ ${v.nApports}`);
  let collectable = false;
  for (let a = 0; a < apports.length; a++) {
    const apport = apports[a];
    bilan.tentatives++;
    const decalage = (k: StatKey) => (apport[k] ?? 0) - (artFlatFige[k] ?? 0);
    const shortfalls: StatShortfall[] = [];
    for (const { k, min } of minEntries) {
      const row = stats.find((r) => r.key === k);
      const actual = totalCondition((row?.total ?? 0) + decalage(k) + relTermMax(k), k, requirement, propres);
      if (actual < min) shortfalls.push({ key: k, kind: 'min', requested: min, actual, shortfall: min - actual });
    }
    for (const { k, max } of maxEntries) {
      const row = stats.find((r) => r.key === k);
      const actual = totalCondition((row?.total ?? 0) + decalage(k) + relTermMin(k), k, requirement, propres);
      if (actual > max) shortfalls.push({ key: k, kind: 'max', requested: max, actual, shortfall: actual - max });
    }
    const n = v.ecarts(a);
    const typees = v.manquesDe(n);
    if (!strictementEgal(shortfalls, typees)) return ecart(`apport ${a} : ${JSON.stringify(shortfalls)} ≠ ${JSON.stringify(typees)}`);
    if (shortfalls.length === 0) {
      collectable = true;
      break;
    }
  }
  if (collectable) bilan.collectables++;
  return null;
}
