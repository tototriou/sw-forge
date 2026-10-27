import type { ArtifactDetail, RelicDetail } from '../types';
import type { GabaritCandidat } from './candidatsCompacts';
import type { ChangementResolution, JournalResolution, ResultatArtefacts } from './artifactQueue';

const TAILLE = 4096;
type Bloc = { ids: Float64Array[]; stats: Float64Array[]; pieces: Uint32Array[]; nombres: Float64Array[]; flags: Uint8Array };

/** Map de transport reconstruite à la sortie seulement ; aucune clé chaîne conservée par build. */
export class CacheResolutionCompact extends Map<string, ResultatArtefacts> {
  private blocs: Bloc[] = [];
  private nombre = 0;
  private table = new Uint32Array(1024);
  private gabarits: GabaritCandidat[] | null = null;
  private arts: ArtifactDetail[] = [];
  private reliques: RelicDetail[] = [];
  private indicesArts = new Map<number, number>();
  private indicesReliques = new Map<number, number>();
  private generation = {};
  private revision = 0;
  private dernier: { cle: string; resultat: ResultatArtefacts } | null = null;
  private dernierJournal: JournalResolution | undefined;

  override get size() { return this.nombre; }
  get journal() { return this.dernierJournal; }
  get version() { return this.revision; }
  private bloc(i: number) { return this.blocs[Math.floor(i / TAILLE)]; }
  private ids(i: number) { const b = this.bloc(i), j = i % TAILLE; return b.ids.map((c) => c[j]); }
  private emplacement(ids: number[], table = this.table): number {
    let h = 2166136261;
    const bits = new DataView(new ArrayBuffer(8));
    for (const id of ids) { bits.setFloat64(0, id === 0 ? 0 : id); h = Math.imul(h ^ bits.getUint32(0), 16777619); h = Math.imul(h ^ bits.getUint32(4), 16777619); }
    let p = (h >>> 0) & (table.length - 1);
    while (table[p] && !this.ids(table[p] - 1).every((id, j) => id === ids[j])) p = (p + 1) & (table.length - 1);
    return p;
  }
  private lireCle(cle: string): number[] | null {
    const ids = cle.split(',').map(Number);
    return ids.length === 6 && ids.every(Number.isSafeInteger) && ids.join(',') === cle ? ids : null;
  }
  override has(cle: string) { const ids = this.lireCle(cle); return ids !== null && this.table[this.emplacement(ids)] !== 0; }
  override get(cle: string): ResultatArtefacts | undefined {
    if (this.dernier?.cle === cle) return this.dernier.resultat;
    const ids = this.lireCle(cle);
    if (!ids) return undefined;
    const lien = this.table[this.emplacement(ids)];
    return lien ? this.resultat(lien - 1) : undefined;
  }
  private indexer<T extends { id: number }>(p: T | null | undefined, indices: Map<number, number>, pieces: T[]) {
    if (!p) return 0;
    const connu = indices.get(p.id);
    if (connu !== undefined) {
      if (JSON.stringify(pieces[connu - 1]) !== JSON.stringify(p)) throw new Error('Pièce modifiée sous le même identifiant');
      return connu;
    }
    const i = pieces.push(p); indices.set(p.id, i); return i;
  }
  override set(cle: string, resultat: ResultatArtefacts): this {
    const ids = this.lireCle(cle);
    if (!ids) throw new Error('Clé de résolution invalide');
    const avant = this.get(cle), tailleAvant = this.nombre;
    if ((this.nombre + 1) / this.table.length > 0.75) {
      const table = new Uint32Array(this.table.length * 2);
      for (let i = 0; i < this.nombre; i++) table[this.emplacement(this.ids(i), table)] = i + 1;
      this.table = table;
    }
    const p = this.emplacement(ids);
    let i = this.table[p] - 1;
    if (i < 0) {
      // Le bloc s'alloue AVANT que l'entrée ne compte : une allocation refusée
      // (arrêt sur la mémoire du classeur) laisse le cache cohérent.
      if (this.nombre % TAILLE === 0) this.blocs.push({ ids: Array.from({ length: 6 }, () => new Float64Array(TAILLE)),
        stats: Array.from({ length: 8 }, () => new Float64Array(TAILLE)), pieces: Array.from({ length: 5 }, () => new Uint32Array(TAILLE)),
        nombres: [new Float64Array(TAILLE), new Float64Array(TAILLE)], flags: new Uint8Array(TAILLE) });
      i = this.nombre++;
      this.table[p] = i + 1;
    }
    const b = this.bloc(i), j = i % TAILLE;
    ids.forEach((id, k) => { b.ids[k][j] = id; });
    if (resultat.stats.length !== 8 || resultat.artefacts.length > 2) throw new Error('Schéma de résolution inconnu');
    this.gabarits ??= resultat.stats.map(({ key, label, base, suffix }) => ({ key, label, base, suffix }));
    resultat.stats.forEach((s, k) => {
      const g = this.gabarits![k];
      if (s.key !== g.key || s.label !== g.label || s.suffix !== g.suffix || !Object.is(s.base, g.base) || !Object.is(s.bonus, s.total - s.base)) throw new Error('Stat de résolution non reconstructible');
      b.stats[k][j] = s.total;
    });
    b.pieces[0][j] = this.indexer(resultat.artefacts[0], this.indicesArts, this.arts);
    b.pieces[1][j] = this.indexer(resultat.artefacts[1], this.indicesArts, this.arts);
    b.pieces[2][j] = this.indexer(resultat.paire?.element, this.indicesArts, this.arts);
    b.pieces[3][j] = this.indexer(resultat.paire?.archetype, this.indicesArts, this.arts);
    b.pieces[4][j] = this.indexer(resultat.relique, this.indicesReliques, this.reliques);
    b.nombres[0][j] = resultat.paire?.score ?? 0;
    b.nombres[1][j] = resultat.meilleurSansVerrous ?? 0;
    b.flags[j] = Number(resultat.conforme) | (resultat.paire ? 2 : 0) | (resultat.meilleurSansVerrous !== null ? 4 : 0)
      | (Object.prototype.hasOwnProperty.call(resultat, 'relique') ? 8 : 0) | (resultat.sansEffetSurLeTri ? 16 : 0);
    if (!Number.isSafeInteger(++this.revision)) throw new Error('Révision de cache épuisée');
    this.dernier = { cle, resultat };
    const changement: ChangementResolution = { cle, avant, apres: resultat };
    this.dernierJournal = { generation: this.generation, version: this.revision, tailleAvant, tailleApres: this.nombre, changements: [changement] };
    return this;
  }
  private resultat(i: number): ResultatArtefacts {
    const b = this.bloc(i), j = i % TAILLE, flags = b.flags[j];
    const art = (k: number) => this.arts[b.pieces[k][j] - 1] ?? null;
    return { paire: flags & 2 ? { element: art(2), archetype: art(3), score: b.nombres[0][j] } : null,
      artefacts: [art(0), art(1)].filter((a): a is ArtifactDetail => a !== null),
      stats: this.gabarits!.map((g, k) => ({ ...g, total: b.stats[k][j], bonus: b.stats[k][j] - g.base })),
      meilleurSansVerrous: flags & 4 ? b.nombres[1][j] : null, conforme: !!(flags & 1),
      ...(flags & 8 ? { relique: this.reliques[b.pieces[4][j] - 1] } : {}),
      ...(flags & 16 ? { sansEffetSurLeTri: true as const } : {}) };
  }
  override clear(): void {
    this.blocs = []; this.nombre = 0; this.table = new Uint32Array(1024); this.gabarits = null;
    this.arts = []; this.reliques = []; this.indicesArts.clear(); this.indicesReliques.clear();
    this.generation = {}; this.revision = 0; this.dernier = null; this.dernierJournal = undefined;
  }
  override delete(_cle: string): boolean { throw new Error('Le cache vivant ne retire pas de résolution'); }
  override *entries(): MapIterator<[string, ResultatArtefacts]> { for (let i = 0; i < this.nombre; i++) yield [this.ids(i).join(','), this.resultat(i)]; }
  override *keys(): MapIterator<string> { for (let i = 0; i < this.nombre; i++) yield this.ids(i).join(','); }
  override *values(): MapIterator<ResultatArtefacts> { for (let i = 0; i < this.nombre; i++) yield this.resultat(i); }
  override [Symbol.iterator]() { return this.entries(); }
  override forEach(f: (r: ResultatArtefacts, cle: string, map: Map<string, ResultatArtefacts>) => void, thisArg?: unknown) {
    for (const [cle, r] of this) f.call(thisArg, r, cle, this);
  }
}
