// Préréglages emboîtés : la rétention d'une moitié est l'UNION de celle du
// préréglage de la recherche et de celle de chaque préréglage plus étroit,
// chacune construite avec SES paramètres (pool `filterSlot`, `bucketCap`
// dérivé, bornes de sets et joker de son pool : `CranEmboite`). Sans elle, un
// préréglage plus large ne contient pas forcément ce que retient un plus
// étroit : son pool plus grand met plus de demi-builds en concurrence pour des
// places qui ne grandissent pas autant. Voir
// docs/03-developpeur/optimizer/moteur/elagages.md § Préréglages emboîtés et
// docs/04-decisions/adr/prereglages-emboites.md.
//
// ⚠️ Ce module ne touche ni la construction d'un préréglage (`buildBuckets`,
// le noyau `construireMoitieRapide`), ni les compartiments du préréglage de la
// recherche : il leur AJOUTE, compartiment par compartiment, les demi-builds
// qu'un préréglage plus étroit retient et que celui de la recherche a évincés,
// puis les range dans l'ordre de `combosOrderMode`. Pourquoi le reste est
// exact :
// - le pool d'un préréglage plus étroit est inclus dans celui de la recherche
//   (`CranEmboite.indices`, vérifié par `prepareSearch`), et ses élagages de
//   set sont plus stricts (bornes de sets et joker tirées de son propre pool,
//   plus petit) : chacun de ses demi-builds est un triplet que la construction
//   de la recherche a ÉNUMÉRÉ. Son compartiment existe donc, ses bornes
//   `maxPct`/`maxFlat` le couvrent déjà (elles s'étendent à toute combinaison
//   rencontrée), et le meilleur score de chaque tranche ne change pas (le
//   meilleur d'une tranche ne s'évince jamais) : `potential` du compartiment,
//   et l'ordre des compartiments, sont inchangés ;
// - dans un compartiment, le tri est celui de `buildBuckets`
//   (`ordonnerCombos`), STABLE, sur les demi-builds de la recherche dans leur
//   ordre suivis des ajouts : les demi-builds de la recherche gardent leur
//   ordre relatif, et un compartiment sans ajout est rendu tel quel.

import { RuneDetail } from '../types';
import { Bucket, ContexteOrdreCombos, HalfCombo, bucketKeyOf, ordonnerCombos, scoresDeTranche } from './runeBuildOptim';
import { ColonnesCombos, CompartimentType, copierLigne, idCombo, lireCombo, nouvelleVueCombo, nouvellesColonnes } from './demiBuildsTypes';

type OrdreCombos = 'potential' | 'relevance' | 'combined' | 'objective';

/**
 * L'union, construite au fil des préréglages plus étroits pour ne garder en
 * mémoire que leurs AJOUTS, jamais leurs compartiments entiers : `ajouter`
 * après chaque préréglage plus étroit, `resultat` à la fin.
 */
export class UnionDesRetentions {
  private readonly parCle = new Map<string, { bucket: Bucket; ajouts: HalfCombo[] }>();
  private readonly vus = new Set<number>();
  private readonly positions: Map<number, number>[];
  private readonly n1: number;
  private readonly n2: number;
  private nAjouts = 0;

  /**
   * `propre` : les compartiments du préréglage de la recherche ; `pools` : ses
   * trois pools, dans l'ordre des emplacements de la moitié (un demi-build se
   * repère par la position de ses runes, un triplet appartenant à un seul
   * compartiment).
   */
  constructor(private readonly propre: Bucket[], pools: readonly [RuneDetail[], RuneDetail[], RuneDetail[]]) {
    this.positions = pools.map((p) => new Map(p.map((r, i) => [r.id, i] as const)));
    this.n1 = pools[1].length;
    this.n2 = pools[2].length;
    for (const b of propre) {
      this.parCle.set(bucketKeyOf(b.counts, b.jokers), { bucket: b, ajouts: [] });
      for (const c of b.combos) this.vus.add(this.code(c));
    }
  }

  private code(c: HalfCombo): number {
    const p = c.runes.map((r, s) => {
      const i = this.positions[s].get(r.id);
      if (i === undefined) throw new Error(`retentionEmboitee : la rune ${r.id} manque au pool de la recherche (emplacement ${s + 1} de la moitié) — préréglages non emboîtés.`);
      return i;
    });
    return (p[0] * this.n1 + p[1]) * this.n2 + p[2];
  }

  /**
   * Ajoute les demi-builds des compartiments d'un préréglage plus étroit que
   * la recherche n'a pas déjà, sans doublon. ⚠️ Lève si un compartiment
   * manque à la recherche : l'inclusion des pools serait rompue.
   */
  ajouter(etroit: Bucket[]): void {
    for (const b of etroit) {
      const cle = bucketKeyOf(b.counts, b.jokers);
      const cible = this.parCle.get(cle);
      if (!cible) throw new Error(`retentionEmboitee : compartiment ${cle} d'un préréglage plus étroit absent de la recherche — préréglages non emboîtés.`);
      for (const c of b.combos) {
        const k = this.code(c);
        if (this.vus.has(k)) continue;
        this.vus.add(k);
        cible.ajouts.push(c);
        this.nAjouts++;
      }
    }
  }

  /** Le nombre de demi-builds ajoutés jusqu'ici. */
  get ajoutes(): number {
    return this.nAjouts;
  }

  /** Les compartiments de la recherche, chacun complété de ses ajouts et rangé ; l'ordre des compartiments est inchangé. */
  resultat(ctx: ContexteOrdreCombos, combosOrderMode: OrdreCombos): Bucket[] {
    if (this.nAjouts === 0) return this.propre;
    const meilleur = combosOrderMode === 'potential' ? meilleurParTranche(this.propre, ctx) : [];
    return this.propre.map((b) => {
      const { ajouts } = this.parCle.get(bucketKeyOf(b.counts, b.jokers))!;
      if (ajouts.length === 0) return b;
      return { ...b, combos: ordonnerCombos([...b.combos, ...ajouts], ctx, combosOrderMode, meilleur) };
    });
  }
}

/**
 * Le meilleur score de chaque tranche sur toute la moitié, celui qu'a vu la
 * construction (`globalBestBySlice`) : le meilleur demi-build d'une tranche
 * reste dans son tas, et ceux d'un préréglage plus étroit ne le dépassent pas.
 */
function meilleurParTranche(buckets: Bucket[], ctx: ContexteOrdreCombos): number[] {
  const n = 1 + (ctx.minEntries.length > 0 ? 1 : 0) + ctx.retentionKeys.length;
  const g = new Array<number>(n).fill(-Infinity);
  for (const b of buckets) {
    for (const c of b.combos) {
      const s = scoresDeTranche(c, ctx);
      for (let i = 0; i < n; i++) if (s[i] > g[i]) g[i] = s[i];
    }
  }
  return g;
}

/** Même union et même tri stable, sans conserver d'objets de demi-build. */
export class UnionDesRetentionsTypees {
  private readonly parCle = new Map<string, { bucket: CompartimentType; ajouts: ColonnesCombos; n: number }>();
  private readonly vus = new Set<number>();
  private readonly positions: Map<number, number>[];
  private readonly n1: number;
  private readonly n2: number;
  private nAjouts = 0;

  constructor(private readonly propre: CompartimentType[], pools: readonly [RuneDetail[], RuneDetail[], RuneDetail[]]) {
    this.positions = pools.map((p) => new Map(p.map((r, i) => [r.id, i])));
    this.n1 = pools[1].length;
    this.n2 = pools[2].length;
    for (const b of propre) {
      this.parCle.set(bucketKeyOf(b.counts, b.jokers), { bucket: b, ajouts: nouvellesColonnes(0, b.combos.cles), n: 0 });
      for (let i = 0; i < b.combos.length; i++) this.vus.add(this.code(b, i));
    }
  }

  private code(b: CompartimentType, i: number): number {
    let code = 0;
    for (let r = 0; r < 3; r++) {
      const id = idCombo(b, i, r);
      const p = this.positions[r].get(id);
      if (p === undefined) throw new Error(`retentionEmboitee : la rune ${id} manque au pool de la recherche (emplacement ${r + 1} de la moitié) — préréglages non emboîtés.`);
      code = code * (r === 1 ? this.n1 : this.n2) + p;
    }
    return code;
  }

  ajouter(etroit: CompartimentType[]): void {
    for (const b of etroit) {
      const cle = bucketKeyOf(b.counts, b.jokers);
      const cible = this.parCle.get(cle);
      if (!cible) throw new Error(`retentionEmboitee : compartiment ${cle} d'un préréglage plus étroit absent de la recherche — préréglages non emboîtés.`);
      for (let i = 0; i < b.combos.length; i++) {
        const code = this.code(b, i);
        if (this.vus.has(code)) continue;
        this.vus.add(code);
        if (cible.n === cible.ajouts.length) {
          const agrandi = nouvellesColonnes(Math.max(16, cible.n * 2), cible.ajouts.cles);
          for (let j = 0; j < cible.n; j++) copierLigne(agrandi, j, cible.ajouts, j);
          cible.ajouts = agrandi;
        }
        copierLigne(cible.ajouts, cible.n++, b.combos, i);
        this.nAjouts++;
      }
    }
  }

  get ajoutes(): number { return this.nAjouts; }

  resultat(ctx: ContexteOrdreCombos, mode: OrdreCombos): CompartimentType[] {
    if (this.nAjouts === 0) return this.propre;
    const n = 1 + (ctx.minEntries.length > 0 ? 1 : 0) + ctx.retentionKeys.length;
    const meilleur = new Array<number>(n).fill(-Infinity);
    const vue = nouvelleVueCombo();
    if (mode === 'potential') for (const b of this.propre) {
      for (let i = 0; i < b.combos.length; i++) {
        const scores = scoresDeTranche(lireCombo(b, i, vue), ctx);
        for (let s = 0; s < n; s++) if (scores[s] > meilleur[s]) meilleur[s] = scores[s];
      }
    }
    return this.propre.map((b) => {
      const { ajouts, n } = this.parCle.get(bucketKeyOf(b.counts, b.jokers))!;
      if (n === 0) return b;
      // Les demi-builds de la recherche puis les ajouts, lus là où ils sont :
      // l'indice `i` de l'union désigne `b.combos[i]`, puis `ajouts[i − nPropre]`.
      // Une seule copie, celle de l'ordre final.
      const nPropre = b.combos.length;
      const deAjouts = { ...b, combos: ajouts };
      const ordre = ordonnerCombos(Array.from({ length: nPropre + n }, (_, i) => i), ctx, mode, meilleur,
        (i) => (i < nPropre ? lireCombo(b, i, vue) : lireCombo(deAjouts, i - nPropre, vue)));
      const trie = nouvellesColonnes(nPropre + n, b.combos.cles);
      ordre.forEach((j, i) => (j < nPropre ? copierLigne(trie, i, b.combos, j) : copierLigne(trie, i, ajouts, j - nPropre)));
      return { ...b, combos: trie };
    });
  }
}
