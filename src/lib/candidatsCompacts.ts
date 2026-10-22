import type { BuildCandidate } from './runeBuildOptim';
import type { StatRow } from './stats';
import type { ResultatArtefacts } from './artifactQueue';
import type { ArtifactDetail, RelicDetail } from '../types';

/** Une entrée hors du schéma exact doit rester sur la référence objet. */
export class CandidatNonCompactable extends Error {}

function exiger(condition: boolean, raison: string): asserts condition {
  if (!condition) throw new CandidatNonCompactable(raison);
}

const CHAMPS_LIGNE = ['key', 'label', 'base', 'bonus', 'total', 'suffix'];

/** Colonnes privées ; ordinal = adresse de ligne, zéro = absence dans les liens. */
export class CandidatsCompacts {
  readonly longueur: number;
  private readonly ids: Float64Array[];
  private readonly totaux: Float64Array[];
  private readonly resolus: Float64Array[];
  private readonly efficience: Float64Array;
  private readonly gabarits: Omit<StatRow, 'total' | 'bonus'>[];
  private readonly groupes: Uint32Array;
  private readonly suivants: Uint32Array;
  private readonly rangs: Uint32Array;
  private readonly hachage: Uint32Array;
  private readonly etats: Uint8Array;
  private readonly versions: Uint32Array;
  private readonly reliques: Uint32Array;
  private readonly artefacts: Uint32Array[];
  private readonly notesPaire: Float64Array;
  private readonly couts: Float64Array;
  private readonly drapeaux: Uint8Array;
  private readonly inventaireReliques: RelicDetail[] = [];
  private readonly inventaireArtefacts: ArtifactDetail[] = [];
  private readonly indicesReliques = new Map<number, number>();
  private readonly indicesArtefacts = new Map<number, number>();

  constructor(candidats: readonly BuildCandidate[]) {
    this.longueur = candidats.length;
    const n = this.longueur;
    this.ids = Array.from({ length: 6 }, () => new Float64Array(n));
    this.totaux = Array.from({ length: 8 }, () => new Float64Array(n));
    this.resolus = Array.from({ length: 8 }, () => new Float64Array(n));
    this.efficience = new Float64Array(n);
    this.gabarits = candidats[0]?.stats.map(({ key, label, base, suffix }) => ({ key, label, base, suffix })) ?? [];
    this.groupes = new Uint32Array(n);
    this.suivants = new Uint32Array(n);
    this.rangs = new Uint32Array(n);
    this.etats = new Uint8Array(n);
    this.versions = new Uint32Array(n);
    this.reliques = new Uint32Array(n);
    this.artefacts = [new Uint32Array(n), new Uint32Array(n)];
    this.notesPaire = new Float64Array(n);
    this.couts = new Float64Array(n);
    this.drapeaux = new Uint8Array(n);
    let capacite = 1;
    while (capacite < n / 0.75) capacite *= 2;
    this.hachage = new Uint32Array(capacite);
    const cles: { ligne: number; cle: string }[] = [];
    for (let i = 0; i < n; i++) {
      const c = candidats[i];
      exiger(Object.keys(c).length === 3 && c.runeIds.length === 6, 'Schéma du candidat');
      exiger(typeof c.effTotal === 'number', 'Efficience non numérique');
      exiger(c.runeIds.every((id) => Number.isSafeInteger(id)), 'Identifiant atypique');
      this.verifierStats(c.stats);
      for (let j = 0; j < 6; j++) this.ids[j][i] = c.runeIds[j];
      for (let j = 0; j < 8; j++) this.totaux[j][i] = c.stats[j].total;
      this.efficience[i] = c.effTotal;
      const ids = this.idsTries(i);
      const emplacement = this.emplacement(ids);
      const groupe = this.hachage[emplacement];
      if (groupe) {
        this.groupes[i] = groupe;
        this.suivants[i] = this.suivants[groupe - 1];
        this.suivants[groupe - 1] = i + 1;
      } else {
        this.groupes[i] = i + 1;
        this.hachage[emplacement] = i + 1;
        cles.push({ ligne: i, cle: ids.join(',') });
      }
    }
    cles.sort((a, b) => a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0);
    cles.forEach(({ ligne }, rang) => { this.rangs[ligne] = rang; });
  }

  private verifierStats(stats: readonly StatRow[]): void {
    exiger(stats.length === 8 && this.gabarits.length === 8, 'Huit stats requises');
    for (let j = 0; j < 8; j++) {
      const s = stats[j], g = this.gabarits[j];
      exiger(Object.keys(s).length === CHAMPS_LIGNE.length && CHAMPS_LIGNE.every((k) => Object.prototype.hasOwnProperty.call(s, k)), 'Schéma StatRow');
      exiger(s.key === g.key && s.label === g.label && s.suffix === g.suffix && Object.is(s.base, g.base), 'Gabarit ou base incohérente');
      exiger(typeof s.total === 'number' && typeof s.base === 'number', 'Stat non numérique');
      exiger(Object.is(s.bonus, s.total - s.base), 'Bonus non reconstructible');
    }
  }

  private idsTries(i: number): number[] { return this.ids.map((colonne) => colonne[i]).sort((a, b) => a - b); }

  private emplacement(ids: readonly number[]): number {
    // Mélanger les deux mots conserve les identifiants dépassant 32 bits.
    const bits = new DataView(new ArrayBuffer(8));
    let h = 2166136261;
    for (const id of ids) {
      bits.setFloat64(0, id === 0 ? 0 : id);
      h = Math.imul(h ^ bits.getUint32(0), 16777619);
      h = Math.imul(h ^ bits.getUint32(4), 16777619);
    }
    let p = (h >>> 0) & (this.hachage.length - 1);
    while (this.hachage[p]) {
      const connus = this.idsTries(this.hachage[p] - 1);
      if (connus.every((id, j) => id === ids[j])) break;
      p = (p + 1) & (this.hachage.length - 1);
    }
    return p;
  }

  groupeDeCle(cle: string): number | undefined {
    const ids = cle.split(',').map(Number);
    if (ids.length !== 6 || ids.some((id) => !Number.isSafeInteger(id)) || ids.join(',') !== cle) return undefined;
    const groupe = this.hachage[this.emplacement(ids)];
    return groupe ? groupe - 1 : undefined;
  }

  cle(i: number): string { return this.idsTries(i).join(','); }
  rangCle(i: number): number { return this.rangs[this.groupes[i] - 1]; }
  version(i: number): number { return this.versions[this.groupes[i] - 1]; }
  etat(i: number): number { return this.etats[this.groupes[i] - 1]; }
  rid(i: number): number | undefined {
    const index = this.reliques[this.groupes[i] - 1];
    return index ? this.inventaireReliques[index - 1].id : undefined;
  }
  *lignesDuGroupe(i: number): Generator<number> {
    let lien = this.groupes[i];
    while (lien) { yield lien - 1; lien = this.suivants[lien - 1]; }
  }
  *chefs(): Generator<number> {
    for (let i = 0; i < this.longueur; i++) if (this.groupes[i] === i + 1) yield i;
  }

  private indexer<T extends { id: number }>(piece: T, indices: Map<number, number>, inventaire: T[]): number {
    const connu = indices.get(piece.id);
    if (connu !== undefined) {
      // Les inventaires sont immuables ; un même id ne change pas de pièce.
      exiger(JSON.stringify(inventaire[connu - 1]) === JSON.stringify(piece), 'Pièce modifiée sous le même identifiant');
      return connu;
    }
    const index = inventaire.push(piece);
    indices.set(piece.id, index);
    return index;
  }

  ingerer(i: number, resultat: ResultatArtefacts | undefined): void {
    const g = this.groupes[i] - 1;
    exiger(this.versions[g] < 0xffffffff, 'Version équipement épuisée');
    this.versions[g]++;
    this.etats[g] = resultat ? resultat.conforme ? 1 : 2 : 0;
    this.reliques[g] = 0;
    this.artefacts.forEach((colonne) => { colonne[g] = 0; });
    this.drapeaux[g] = 0;
    if (!resultat) return;
    if (resultat.relique) this.reliques[g] = this.indexer(resultat.relique, this.indicesReliques, this.inventaireReliques);
    if (!resultat.conforme) return;
    this.verifierStats(resultat.stats);
    exiger(resultat.artefacts.length <= 2, 'Deux artéfacts au plus');
    for (let j = 0; j < 8; j++) this.resolus[j][g] = resultat.stats[j].total;
    resultat.artefacts.forEach((a, j) => { this.artefacts[j][g] = this.indexer(a, this.indicesArtefacts, this.inventaireArtefacts); });
    this.notesPaire[g] = resultat.paire?.score ?? 0;
    this.couts[g] = resultat.meilleurSansVerrous ?? 0;
    this.drapeaux[g] = (resultat.paire ? 1 : 0) | (resultat.meilleurSansVerrous !== null ? 2 : 0) | (resultat.sansEffetSurLeTri ? 4 : 0);
  }

  candidat(i: number, resolu = true): BuildCandidate {
    const g = this.groupes[i] - 1;
    const colonnes = resolu && this.etats[g] === 1 ? this.resolus : this.totaux;
    const ligne = colonnes === this.resolus ? g : i;
    return {
      runeIds: this.ids.map((colonne) => colonne[i]),
      stats: this.gabarits.map((gabarit, j) => {
        const total = colonnes[j][ligne];
        return { ...gabarit, total, bonus: total - gabarit.base };
      }),
      effTotal: this.efficience[i],
    };
  }
}
