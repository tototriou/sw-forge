// Colonnes des demi-builds, de la construction à l'appariement. Float64
// conserve aussi les entrées fractionnaires des outils ; le noyau entier
// vérifie son contrat avant toute conversion. Voir
// docs/03-developpeur/optimizer/moteur/pipeline.md § Construction des moitiés.
import { RuneDetail } from '../types';
import { StatKey } from './effects';
import { Bucket, HalfCombo } from './runeBuildOptim';

export interface ColonnesCombos {
  length: number;
  cles: StatKey[];
  ids: Float64Array;
  pct: Float64Array;
  flat: Float64Array;
  relevance: Float64Array;
}

export interface CompartimentType extends Omit<Bucket, 'combos' | 'skyline'> {
  combos: ColonnesCombos;
}

export type Compartiment = Bucket | CompartimentType;
export type VueCombo = Pick<HalfCombo, 'pct' | 'flat' | 'relevanceScore'> & { cles?: readonly StatKey[] };
export const nouvelleVueCombo = (): VueCombo => ({ pct: {}, flat: {}, relevanceScore: 0 });

export function nouvellesColonnes(length: number, cles: StatKey[]): ColonnesCombos {
  return { length, cles, ids: new Float64Array(3 * length), pct: new Float64Array(length * cles.length),
    flat: new Float64Array(length * cles.length), relevance: new Float64Array(length) };
}

/** Une vue réutilisée par ligne, jamais un objet HalfCombo par demi-build. */
export function lireCombo(b: Compartiment, i: number, vue: VueCombo): VueCombo {
  const c = b.combos;
  if (Array.isArray(c)) return c[i];
  if (vue.cles !== c.cles) {
    for (const k of Object.keys(vue.pct)) delete vue.pct[k];
    for (const k of Object.keys(vue.flat)) delete vue.flat[k];
    vue.cles = c.cles;
  }
  for (let k = 0; k < c.cles.length; k++) {
    vue.pct[c.cles[k]] = c.pct[i * c.cles.length + k];
    vue.flat[c.cles[k]] = c.flat[i * c.cles.length + k];
  }
  vue.relevanceScore = c.relevance[i];
  return vue;
}

export function idCombo(b: Compartiment, i: number, r: number): number {
  return Array.isArray(b.combos) ? b.combos[i].runes[r].id : b.combos.ids[3 * i + r];
}

/** Copie des lignes, sans objets de demi-build. */
export function copierLigne(cible: ColonnesCombos, i: number, source: ColonnesCombos, j: number): void {
  for (let r = 0; r < 3; r++) cible.ids[3 * i + r] = source.ids[3 * j + r];
  if (cible.cles === source.cles) {
    // Mêmes clés, même ordre : la colonne `k` de l'une est celle de l'autre, sans chercher chaque clé.
    const m = cible.cles.length;
    for (let k = 0; k < m; k++) {
      cible.pct[i * m + k] = source.pct[j * m + k];
      cible.flat[i * m + k] = source.flat[j * m + k];
    }
    cible.relevance[i] = source.relevance[j];
    return;
  }
  for (let k = 0; k < cible.cles.length; k++) {
    const s = source.cles.indexOf(cible.cles[k]);
    cible.pct[i * cible.cles.length + k] = s < 0 ? 0 : source.pct[j * source.cles.length + s];
    cible.flat[i * cible.cles.length + k] = s < 0 ? 0 : source.flat[j * source.cles.length + s];
  }
  cible.relevance[i] = source.relevance[j];
}

export function typerCompartiments(buckets: Bucket[]): CompartimentType[] {
  return buckets.map((b) => {
    const cles = [...new Set(b.combos.flatMap((c) => Object.keys(c.pct).concat(Object.keys(c.flat))))] as StatKey[];
    const c = nouvellesColonnes(b.combos.length, cles);
    b.combos.forEach((hc, i) => {
      for (let r = 0; r < 3; r++) c.ids[3 * i + r] = hc.runes[r].id;
      for (let k = 0; k < cles.length; k++) {
        c.pct[i * cles.length + k] = hc.pct[cles[k]] ?? 0;
        c.flat[i * cles.length + k] = hc.flat[cles[k]] ?? 0;
      }
      c.relevance[i] = hc.relevanceScore;
    });
    const { combos: _combos, skyline: _skyline, ...meta } = b;
    return { ...meta, combos: c };
  });
}

/** Adaptateur explicite pour la référence objet et les consommateurs d'outillage. */
export function objetsDesCompartiments(buckets: readonly Compartiment[], pools: readonly RuneDetail[][]): Bucket[] {
  const parId = new Map(pools.flat().map((r) => [r.id, r]));
  return buckets.map((b): Bucket => {
    if (Array.isArray(b.combos)) return b as Bucket;
    const vue = nouvelleVueCombo();
    const combos: HalfCombo[] = [];
    for (let i = 0; i < b.combos.length; i++) {
      lireCombo(b, i, vue);
      const runes = [0, 1, 2].map((r) => {
        const id = idCombo(b, i, r);
        const rune = parId.get(id);
        if (!rune) throw new Error(`demiBuildsTypes : rune ${id} absente du pool`);
        return rune;
      }) as HalfCombo['runes'];
      combos.push({ runes, counts: b.counts.slice(), jokers: b.jokers, pct: { ...vue.pct }, flat: { ...vue.flat }, relevanceScore: vue.relevanceScore });
    }
    return { ...b, combos };
  });
}

export function tamponsDesDemiBuilds(buckets: readonly CompartimentType[]): ArrayBuffer[] {
  return buckets.flatMap(({ combos: c }) => [c.ids.buffer, c.pct.buffer, c.flat.buffer, c.relevance.buffer] as ArrayBuffer[]);
}
