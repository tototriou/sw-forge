import { CandidatsCompacts } from './candidatsCompacts';
import type { JournalResolution, ResultatArtefacts } from './artifactQueue';
import type { BuildCandidate } from './runeBuildOptim';

/** AVL par ordinal ; les liens codent ordinal + 1, jamais un objet par nœud. */
class OrdreCompact {
  private racine = 0;
  private readonly gauche: Uint32Array;
  private readonly droite: Uint32Array;
  private readonly hauteurs: Uint8Array;
  private readonly totaux: Uint32Array;
  private readonly confirmes: Uint32Array;
  private readonly potentiels: Uint32Array;

  constructor(n: number, private readonly comparer: (a: number, b: number) => number, private readonly confirme: (i: number) => boolean) {
    this.gauche = new Uint32Array(n + 1);
    this.droite = new Uint32Array(n + 1);
    this.hauteurs = new Uint8Array(n + 1);
    this.totaux = new Uint32Array(n + 1);
    this.confirmes = new Uint32Array(n + 1);
    this.potentiels = new Uint32Array(n + 1);
  }
  private actualiser(p: number): void {
    const g = this.gauche[p], d = this.droite[p];
    this.hauteurs[p] = 1 + Math.max(this.hauteurs[g], this.hauteurs[d]);
    this.totaux[p] = 1 + this.totaux[g] + this.totaux[d];
    const confirme = this.confirme(p - 1);
    this.confirmes[p] = Number(confirme) + this.confirmes[g] + this.confirmes[d];
    this.potentiels[p] = Number(!confirme) + this.potentiels[g] + this.potentiels[d];
  }
  private rotationDroite(p: number): number {
    const q = this.gauche[p];
    this.gauche[p] = this.droite[q]; this.droite[q] = p;
    this.actualiser(p); this.actualiser(q); return q;
  }
  private rotationGauche(p: number): number {
    const q = this.droite[p];
    this.droite[p] = this.gauche[q]; this.gauche[q] = p;
    this.actualiser(p); this.actualiser(q); return q;
  }
  private equilibrer(p: number): number {
    this.actualiser(p);
    const g = this.gauche[p], d = this.droite[p];
    if (this.hauteurs[g] - this.hauteurs[d] > 1) {
      if (this.hauteurs[this.droite[g]] > this.hauteurs[this.gauche[g]]) this.gauche[p] = this.rotationGauche(g);
      return this.rotationDroite(p);
    }
    if (this.hauteurs[d] - this.hauteurs[g] > 1) {
      if (this.hauteurs[this.gauche[d]] > this.hauteurs[this.droite[d]]) this.droite[p] = this.rotationDroite(d);
      return this.rotationGauche(p);
    }
    return p;
  }
  inserer(i: number): void {
    const noeud = i + 1;
    this.gauche[noeud] = this.droite[noeud] = 0;
    const inserer = (p: number): number => {
      if (!p) { this.actualiser(noeud); return noeud; }
      if (this.comparer(i, p - 1) < 0) this.gauche[p] = inserer(this.gauche[p]);
      else this.droite[p] = inserer(this.droite[p]);
      return this.equilibrer(p);
    };
    this.racine = inserer(this.racine);
  }
  retirer(i: number): void {
    const detacherMinimum = (p: number): number => {
      if (!this.gauche[p]) return this.droite[p];
      this.gauche[p] = detacherMinimum(this.gauche[p]);
      return this.equilibrer(p);
    };
    const retirer = (p: number): number => {
      if (!p) return 0;
      const comparaison = this.comparer(i, p - 1);
      if (comparaison < 0) this.gauche[p] = retirer(this.gauche[p]);
      else if (comparaison > 0) this.droite[p] = retirer(this.droite[p]);
      else {
        if (!this.gauche[p]) return this.droite[p];
        if (!this.droite[p]) return this.gauche[p];
        let suivant = this.droite[p];
        while (this.gauche[suivant]) suivant = this.gauche[suivant];
        const droite = detacherMinimum(this.droite[p]);
        this.gauche[suivant] = this.gauche[p]; this.droite[suivant] = droite;
        return this.equilibrer(suivant);
      }
      return this.equilibrer(p);
    };
    this.racine = retirer(this.racine);
  }
  vider(): void { this.racine = 0; }
  comptes(): { total: number; confirmes: number; potentiels: number } {
    return { total: this.totaux[this.racine], confirmes: this.confirmes[this.racine], potentiels: this.potentiels[this.racine] };
  }
  page(debut: number, taille: number): number[] {
    const resultat: number[] = [];
    const fin = debut + taille;
    const lire = (p: number, avant: number): void => {
      if (!p || avant >= fin || avant + this.totaux[p] <= debut) return;
      const rang = avant + this.totaux[this.gauche[p]];
      lire(this.gauche[p], avant);
      if (rang >= debut && rang < fin) resultat.push(p - 1);
      lire(this.droite[p], rang + 1);
    };
    lire(this.racine, 0); return resultat;
  }
}

export interface TravailClassementCompact {
  controlees: number;
  notes: number;
  comparaisons: number;
  complet: boolean;
  repliNonFini: boolean;
}

/** Un score est produit par le même adaptateur que le classement objet. */
export type NoterCompact = (c: BuildCandidate) => number | null;

export class ClassementCompact {
  readonly magasin: CandidatsCompacts;
  readonly travail: TravailClassementCompact = { controlees: 0, notes: 0, comparaisons: 0, complet: true, repliNonFini: false };
  private readonly notes: Float64Array;
  private readonly notesPresentes: Uint8Array;
  private readonly versionsNotes: Uint32Array;
  private readonly ordre: OrdreCompact;
  private generation: object | undefined;
  private version = 0;
  private tailleCache = 0;
  private contexte: unknown;
  private nonFinis = 0;
  private cacheVide = true;
  private ordreDeReference: number[] | undefined;
  private publicationCourante = new WeakSet<ReadonlyMap<string, ResultatArtefacts>>();

  constructor(base: readonly BuildCandidate[]) {
    this.magasin = new CandidatsCompacts(base);
    this.notes = new Float64Array(base.length);
    this.notesPresentes = new Uint8Array(base.length);
    this.versionsNotes = new Uint32Array(base.length);
    this.ordre = new OrdreCompact(base.length, (a, b) => this.comparer(a, b), (i) => this.magasin.etat(i) === 1);
  }
  private comparer(a: number, b: number): number {
    this.travail.comparaisons++;
    const note = this.notesPresentes[a] ? this.notes[b] - this.notes[a] : 0;
    if (note) return note;
    const ra = this.magasin.rid(a) ?? Infinity, rb = this.magasin.rid(b) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return this.magasin.rangCle(a) - this.magasin.rangCle(b) || a - b;
  }
  private nonFini(i: number): boolean {
    const rid = this.magasin.rid(i);
    return (this.notesPresentes[i] === 1 && !Number.isFinite(this.notes[i])) || (rid !== undefined && (!Number.isSafeInteger(rid) || rid < 0));
  }
  private noter(i: number, score: NoterCompact): void {
    this.travail.controlees++;
    const note = this.magasin.etat(i) === 2 ? null : score(this.magasin.candidat(i));
    this.notesPresentes[i] = Number(note !== null);
    this.notes[i] = note ?? 0;
    this.versionsNotes[i] = this.magasin.version(i);
    if (note !== null) this.travail.notes++;
    if (this.magasin.etat(i) !== 2 && this.nonFini(i)) this.nonFinis++;
  }

  actualiser(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, contexte: unknown, score: NoterCompact): void {
    Object.assign(this.travail, { controlees: 0, notes: 0, comparaisons: 0, complet: false, repliNonFini: false });
    const consecutif = journal && journal.generation === this.generation && journal.version === this.version + 1
      && journal.tailleAvant === this.tailleCache && journal.tailleApres === cache.size;
    const memePublication = journal && this.publicationCourante.has(cache) && journal.generation === this.generation
      && journal.version === this.version && journal.tailleApres === this.tailleCache;
    let coherent = Boolean(consecutif || memePublication);
    if (consecutif) {
      let taille = this.tailleCache;
      const vues = new Set<string>();
      for (const c of journal.changements) {
        if (vues.has(c.cle) || cache.get(c.cle) !== c.apres) coherent = false;
        vues.add(c.cle); taille += Number(c.apres !== undefined) - Number(c.avant !== undefined);
      }
      if (taille !== cache.size) coherent = false;
    }
    const complet = !coherent || !Object.is(this.contexte, contexte) || this.cacheVide !== (cache.size === 0);
    const etaitNonFini = this.nonFinis > 0;
    this.ordreDeReference = undefined;
    if (complet) {
      this.travail.complet = true; this.ordre.vider(); this.nonFinis = 0;
      for (const g of this.magasin.chefs()) this.magasin.ingerer(g, cache.get(this.magasin.cle(g)));
      for (let i = 0; i < this.magasin.longueur; i++) this.noter(i, score);
    } else if (consecutif) {
      // Retirer sous les anciennes clés avant toute ingestion de groupe.
      for (const c of journal.changements) {
        const g = this.magasin.groupeDeCle(c.cle);
        if (g === undefined) continue;
        for (const i of this.magasin.lignesDuGroupe(g)) {
          if (this.magasin.etat(i) === 2) continue;
          if (this.nonFini(i)) this.nonFinis--;
          if (!etaitNonFini) this.ordre.retirer(i);
        }
        this.magasin.ingerer(g, c.apres);
        for (const i of this.magasin.lignesDuGroupe(g)) this.noter(i, score);
      }
    }
    this.cacheVide = cache.size === 0;
    if (this.nonFinis) {
      // Même entrée, mêmes expressions, mêmes deux tris natifs que l'oracle.
      const indices = Array.from({ length: this.magasin.longueur }, (_, i) => i).filter((i) => this.magasin.etat(i) !== 2);
      indices.sort((a, b) => {
        const ra = this.magasin.rid(a) ?? Infinity, rb = this.magasin.rid(b) ?? Infinity;
        if (ra !== rb) return ra - rb;
        return this.magasin.rangCle(a) - this.magasin.rangCle(b);
      });
      if (indices.some((i) => this.notesPresentes[i])) indices.sort((a, b) => this.notes[b] - this.notes[a]);
      this.ordreDeReference = indices; this.travail.repliNonFini = true;
    } else if (complet || etaitNonFini) {
      this.ordre.vider();
      for (let i = 0; i < this.magasin.longueur; i++) if (this.magasin.etat(i) !== 2) this.ordre.inserer(i);
    } else if (consecutif) {
      for (const c of journal.changements) {
        const g = this.magasin.groupeDeCle(c.cle);
        if (g !== undefined) for (const i of this.magasin.lignesDuGroupe(g)) if (this.magasin.etat(i) !== 2) this.ordre.inserer(i);
      }
    }
    this.generation = journal?.generation; this.version = journal?.version ?? 0;
    this.tailleCache = cache.size; this.contexte = contexte;
    this.publicationCourante = new WeakSet([cache]);
  }
  page(debut: number, taille: number): number[] {
    if (this.cacheVide) return Array.from({ length: Math.max(0, Math.min(taille, this.magasin.longueur - debut)) }, (_, j) => debut + j);
    return this.ordreDeReference?.slice(debut, debut + taille) ?? this.ordre.page(debut, taille);
  }
  comptes(): { total: number; confirmes: number; potentiels: number } {
    if (!this.ordreDeReference) return this.ordre.comptes();
    const confirmes = this.ordreDeReference.reduce((n, i) => n + Number(this.magasin.etat(i) === 1), 0);
    return { total: this.ordreDeReference.length, confirmes, potentiels: this.ordreDeReference.length - confirmes };
  }
  note(i: number): number | null { return this.notesPresentes[i] ? this.notes[i] : null; }
}
