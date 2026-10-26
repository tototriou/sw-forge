import { CandidatsCompacts, RecepteurCandidats, ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, terminerEtapes, trierIndicesEtapes, type BlocCandidats } from './candidatsCompacts';
import { candidatAvecSaPaire, cibleDeLaFile, cleBuild, type JournalResolution, type ResultatArtefacts } from './artifactQueue';
import { scoreDuCandidat, type BuildCandidate, type Objective, type OptionsDeClassement } from './runeBuildOptim';
import type { StatKey } from './effects';
import type { OptimMetric } from './runeOptim';
import { CacheResolutionCompact } from './cacheResolutionCompact';
import { optionsDuContexte, resolutionDuContexte, runesDuContexte, type ContexteResultat } from './contexteResultat';
import { runesDuBuild } from './relicQueue';
import { ResolutionDistante, repliSurErreur, type PortsResolutionDistante } from '../workers/resolutionDistante';
import { CorpsResolution, type MessageVersResolution, type ReponseResolution, type EntreesResolutionSerialisables } from '../workers/resolutionBody';
import type { SearchResult } from './runeBuildOptim';
import { triDesResultats, type ColonneResultat } from './colonnesResultats';

/** Adaptation paresseuse : aucun objet par ligne n'est retenu par le propriétaire. */
export function candidatsParIndice(nombre: number, lire: (i: number) => BuildCandidate): BuildCandidate[] {
  return new Proxy([] as BuildCandidate[], { get(cible, cle, receveur) {
    if (cle === 'length') return nombre;
    if (typeof cle === 'string' && /^(0|[1-9][0-9]*)$/.test(cle)) return Number(cle) < nombre ? lire(Number(cle)) : undefined;
    return Reflect.get(cible, cle, receveur);
  }, has(cible, cle) {
    if (typeof cle === 'string' && /^(0|[1-9][0-9]*)$/.test(cle)) return Number(cle) < nombre;
    return Reflect.has(cible, cle);
  } });
}

/** Le tri porte sur les ordinaux ; même soustraction et stabilité que sortCandidates. */
export function ordreCollecte(candidats: ArrayLike<BuildCandidate>, critere: StatKey | Objective, options: OptionsDeClassement): Uint32Array {
  return terminerEtapes(ordreCollecteEtapes(candidats, critere, options)).ordre;
}

/** Notes et appels de comparaison de l'ordre de base, au fil des blocs et au scellé. */
export interface CompteOrdreDeBase { notes: number; comparaisons: number }
/** Le préfixe déjà noté au fil des blocs, et l'ordre complet quand il est rangé. */
interface NotesConnues { nombre: number; note(i: number): number | null; ordre: Uint32Array | null }
interface OrdreDeBase { ordre: Uint32Array; notes: Float64Array; calculable: boolean }

function* ordreCollecteEtapes(candidats: ArrayLike<BuildCandidate>, critere: StatKey | Objective, options: OptionsDeClassement,
  compte?: CompteOrdreDeBase, connues?: NotesConnues): Generator<void, OrdreDeBase> {
  const n = candidats.length, notes = new Float64Array(n);
  let calculable = false, nonFini = false;
  for (let i = 0; i < n; i++) {
    // Une note connue ne relit pas le candidat : seule la lecture coûte encore.
    const connue = connues !== undefined && i < connues.nombre;
    const note = connue ? connues.note(i) : scoreDuCandidat(candidats[i], critere, options);
    if (!connue && compte) compte.notes++;
    calculable ||= note !== null;
    notes[i] = note ?? 0; nonFini ||= note !== null && !Number.isFinite(note);
    if (!connue || (i & 63) === 0) yield;
  }
  const ordre = Uint32Array.from({ length: n }, (_, i) => i);
  if (!calculable) return { ordre, notes, calculable };
  if (nonFini) return { ordre: Uint32Array.from(Array.from(ordre).sort((a, b) => notes[b] - notes[a])), notes, calculable };
  // Rangé au fil des blocs sur ces mêmes notes, toutes finies : le même ordre stable.
  if (connues?.ordre && connues.nombre === n && connues.ordre.length === n) return { ordre: connues.ordre, notes, calculable };
  return { ordre: yield* trierIndicesEtapes(ordre, (a, b) => { if (compte) compte.comparaisons++; return notes[b] - notes[a]; }), notes, calculable };
}

/** Une plage triée couvre des ordinaux contigus ; les plages fusionnent comme un compteur binaire. */
const PLAGE_AU_FIL = 4096;

/**
 * Les notes de base d'un critère, et leur ordre, préparés pendant la recherche
 * bloc par bloc. La note de base ne lit que le candidat collecté et le contexte
 * figé, sans cache : la calculer à l'arrivée ne change pas sa valeur. Sous des
 * notes finies, « note décroissante, puis ordinal » est un préordre total : des
 * plages triées de façon stable puis fusionnées de façon stable, gauche avant
 * droite à égalité, donnent exactement le tri stable du scellé. Une note non
 * finie ou absente laisse l'ordre au tri du scellé.
 */
class OrdreAuFil {
  private valeurs = new Float64Array(PLAGE_AU_FIL);
  private nombre = 0;
  private nulles = 0;
  private nonFinies = 0;
  private plages: { ordre: Uint32Array; niveau: number }[] = [];
  private rangees = 0;
  private enCours: Generator<void> | null = null;
  private final = false;
  private abandonne = false;

  constructor(readonly cle: string, private readonly critere: StatKey | Objective, private readonly options: OptionsDeClassement,
    private readonly flux: RecepteurCandidats, private readonly compte: CompteOrdreDeBase) {}

  /** Un pas : une note, ou au plus 64 lignes triées ou fusionnées ; faux quand tout le reçu est traité. */
  avancer(): boolean {
    if (this.abandonne) return false;
    this.enCours ??= this.travailler();
    try {
      if (!this.enCours.next().done) return true;
    } catch {
      // Une note qui lève lèvera aussi au scellé, qui recalcule tout sans ce travail.
      this.abandonne = true;
    }
    this.enCours = null;
    return false;
  }
  private comparer(a: number, b: number): number {
    this.compte.comparaisons++;
    return this.valeurs[b] - this.valeurs[a];
  }
  private *travailler(): Generator<void> {
    for (;;) {
      if (this.nombre < this.flux.longueur) {
        const i = this.nombre;
        if (i === this.valeurs.length) { const plus = new Float64Array(2 * i); plus.set(this.valeurs); this.valeurs = plus; }
        const note = scoreDuCandidat(this.flux.lire(i), this.critere, this.options);
        this.compte.notes++;
        this.valeurs[i] = note ?? 0;
        if (note === null) this.nulles++; else if (!Number.isFinite(note)) this.nonFinies++;
        this.nombre++;
        yield; continue;
      }
      if (this.nulles || this.nonFinies) return;
      const reste = this.nombre - this.rangees;
      if (reste >= PLAGE_AU_FIL || (this.final && reste > 0)) {
        const debut = this.rangees, longueur = this.final ? reste : PLAGE_AU_FIL;
        const ordre = yield* trierIndicesEtapes(Uint32Array.from({ length: longueur }, (_, k) => debut + k), (a, b) => this.comparer(a, b));
        this.rangees = debut + longueur;
        this.plages.push({ ordre, niveau: 0 });
        while (this.plages.length > 1 && (this.final || this.plages[this.plages.length - 2].niveau === this.plages[this.plages.length - 1].niveau)) yield* this.fusionner();
        continue;
      }
      if (this.final && this.plages.length > 1) { yield* this.fusionner(); continue; }
      return;
    }
  }
  /** Deux plages voisines, la plus ancienne à gauche ; à égalité, la gauche d'abord. */
  private *fusionner(): Generator<void> {
    const droite = this.plages.pop()!.ordre, plage = this.plages.pop()!, gauche = plage.ordre;
    const sortie = new Uint32Array(gauche.length + droite.length);
    let g = 0, d = 0;
    for (let k = 0; k < sortie.length; k++) {
      sortie[k] = g < gauche.length && (d === droite.length || this.comparer(gauche[g], droite[d]) <= 0) ? gauche[g++] : droite[d++];
      if ((k & 63) === 0) yield;
    }
    this.plages.push({ ordre: sortie, niveau: plage.niveau + 1 });
  }
  /** Le préfixe noté, sans ordre : pour l'aperçu, qui ne couvre pas tout le reçu. */
  connues(n: number): NotesConnues | undefined {
    // Une note absente parmi d'autres présentes ne se relit pas : tout est recalculé.
    if (this.abandonne || (this.nulles && this.nulles !== this.nombre)) return undefined;
    const nulle = this.nulles > 0;
    return { nombre: Math.min(n, this.nombre), note: (i) => nulle ? null : this.valeurs[i], ordre: null };
  }
  /** Au scellé : noter et ranger le reste, puis rendre notes et ordre complet. */
  *finir(n: number): Generator<void, NotesConnues | undefined> {
    this.final = true;
    while (this.avancer()) yield;
    const connues = this.connues(n);
    if (!connues || this.nombre !== n) return undefined;
    const ordre = this.nulles || this.nonFinies ? null : n === 0 ? new Uint32Array(0) : this.plages.length === 1 && this.plages[0].ordre.length === n ? this.plages[0].ordre : null;
    return { ...connues, ordre };
  }
}

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
  page(debut: number, taille: number, choix: 'total' | 'confirmes' | 'potentiels' = 'total'): number[] {
    const resultat: number[] = [];
    const fin = debut + taille;
    const comptes = choix === 'confirmes' ? this.confirmes : choix === 'potentiels' ? this.potentiels : this.totaux;
    const lire = (p: number, avant: number): void => {
      if (!p || avant >= fin || avant + comptes[p] <= debut) return;
      const rang = avant + comptes[this.gauche[p]];
      const retenu = choix === 'total' || (choix === 'confirmes' ? this.confirme(p - 1) : !this.confirme(p - 1));
      lire(this.gauche[p], avant);
      if (retenu && rang >= debut && rang < fin) resultat.push(p - 1);
      lire(this.droite[p], rang + Number(retenu));
    };
    lire(this.racine, 0); return resultat;
  }
}

export interface TravailClassementCompact {
  controlees: number;
  notes: number;
  /** Lignes non résolues notées par leur note de base, sans recalcul. */
  reprises: number;
  comparaisons: number;
  complet: boolean;
  repliNonFini: boolean;
}

/** Un score est produit par le même adaptateur que le classement objet. */
export type NoterCompact = (c: BuildCandidate) => number | null;

export class ClassementCompact {
  readonly magasin: CandidatsCompacts;
  readonly travail: TravailClassementCompact = { controlees: 0, notes: 0, reprises: 0, comparaisons: 0, complet: true, repliNonFini: false };
  private notesDeBase: { critere: string; notes: Float64Array; calculable: boolean } | null = null;
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
  private ordreBase: Uint32Array;
  private readonly rangBase: Uint32Array;

  constructor(base: ArrayLike<BuildCandidate>, ordreBase?: Uint32Array, differe = false) {
    this.magasin = new CandidatsCompacts(base, differe);
    this.notes = new Float64Array(base.length);
    this.notesPresentes = new Uint8Array(base.length);
    this.versionsNotes = new Uint32Array(base.length);
    this.ordreBase = ordreBase ?? (differe ? new Uint32Array(base.length) : Uint32Array.from({ length: base.length }, (_, i) => i));
    this.rangBase = new Uint32Array(base.length);
    if (!differe) this.ordreBase.forEach((i, rang) => { this.rangBase[i] = rang; });
    this.ordre = new OrdreCompact(base.length, (a, b) => this.comparer(a, b), (i) => this.magasin.etat(i) === 1);
  }
  private comparer(a: number, b: number): number {
    this.travail.comparaisons++;
    const note = this.notesPresentes[a] ? this.notes[b] - this.notes[a] : 0;
    if (note) return note;
    const ra = this.magasin.rid(a) ?? Infinity, rb = this.magasin.rid(b) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return this.magasin.rangCle(a) - this.magasin.rangCle(b) || this.rangBase[a] - this.rangBase[b];
  }
  private nonFini(i: number): boolean {
    const rid = this.magasin.rid(i);
    return (this.notesPresentes[i] === 1 && !Number.isFinite(this.notes[i])) || (rid !== undefined && (!Number.isSafeInteger(rid) || rid < 0));
  }
  private noter(i: number, score: NoterCompact, base: { notes: Float64Array; calculable: boolean } | null): void {
    this.travail.controlees++;
    const etat = this.magasin.etat(i);
    // Non résolue, la ligne n'a ni paire, ni relique, ni stats résolues dans le
    // cache : sa note est exactement sa note de base, pour le même critère.
    const reprise = etat === 0 && base !== null;
    const note = etat === 2 ? null : reprise ? (base.calculable ? base.notes[i] : null) : score(this.magasin.candidat(i));
    this.notesPresentes[i] = Number(note !== null);
    this.notes[i] = note ?? 0;
    this.versionsNotes[i] = this.magasin.version(i);
    if (reprise) this.travail.reprises++;
    else if (note !== null) this.travail.notes++;
    if (etat !== 2 && this.nonFini(i)) this.nonFinis++;
  }
  /** Les notes de l'ordre de base, sans cache, pour ce critère (tri et mesure). */
  definirNotesDeBase(critere: string, notes: Float64Array, calculable: boolean): void {
    if (notes.length !== this.magasin.longueur) throw new Error('Notes de base d’une autre population');
    this.notesDeBase = { critere, notes, calculable };
  }

  actualiser(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, contexte: unknown, score: NoterCompact): void {
    terminerEtapes(this.actualiserEtapes(cache, journal, contexte, score));
  }
  /** `critere` désigne le critère de `score` : ses notes de base servent aux lignes non résolues. */
  *actualiserEtapes(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, contexte: unknown, score: NoterCompact,
    critere?: string): Generator<void> {
    Object.assign(this.travail, { controlees: 0, notes: 0, reprises: 0, comparaisons: 0, complet: false, repliNonFini: false });
    const base = critere !== undefined && this.notesDeBase?.critere === critere ? this.notesDeBase : null;
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
      for (const g of this.magasin.chefs()) { this.magasin.ingerer(g, cache.get(this.magasin.cle(g))); yield; }
      for (let i = 0; i < this.magasin.longueur; i++) { this.noter(i, score, base); yield; }
    } else if (consecutif) {
      // Retirer sous les anciennes clés avant toute ingestion de groupe.
      for (const c of journal.changements) {
        const g = this.magasin.groupeDeCle(c.cle);
        if (g === undefined) continue;
        for (const i of this.magasin.lignesDuGroupe(g)) {
          if (this.magasin.etat(i) === 2) continue;
          if (this.nonFini(i)) this.nonFinis--;
          if (!etaitNonFini) this.ordre.retirer(i);
          yield;
        }
        this.magasin.ingerer(g, c.apres);
        for (const i of this.magasin.lignesDuGroupe(g)) { this.noter(i, score, base); yield; }
      }
    }
    this.cacheVide = cache.size === 0;
    if (this.nonFinis) {
      // Même entrée, mêmes expressions, mêmes deux tris natifs que l'oracle.
      const indices = Array.from(this.ordreBase).filter((i) => this.magasin.etat(i) !== 2);
      indices.sort((a, b) => {
        const ra = this.magasin.rid(a) ?? Infinity, rb = this.magasin.rid(b) ?? Infinity;
        if (ra !== rb) return ra - rb;
        return this.magasin.rangCle(a) - this.magasin.rangCle(b);
      });
      if (indices.some((i) => this.notesPresentes[i])) indices.sort((a, b) => this.notes[b] - this.notes[a]);
      this.ordreDeReference = indices; this.travail.repliNonFini = true;
    } else if (complet || etaitNonFini) {
      this.ordre.vider();
      for (let i = 0; i < this.magasin.longueur; i++) { if (this.magasin.etat(i) !== 2) this.ordre.inserer(i); yield; }
    } else if (consecutif) {
      for (const c of journal.changements) {
        const g = this.magasin.groupeDeCle(c.cle);
        if (g !== undefined) for (const i of this.magasin.lignesDuGroupe(g)) { if (this.magasin.etat(i) !== 2) this.ordre.inserer(i); yield; }
      }
    }
    this.generation = journal?.generation; this.version = journal?.version ?? 0;
    this.tailleCache = cache.size; this.contexte = contexte;
    this.publicationCourante = new WeakSet([cache]);
  }

  invalider(): void { this.contexte = {}; }
  page(debut: number, taille: number): number[] {
    if (this.cacheVide) return Array.from(this.ordreBase.slice(debut, debut + taille));
    return this.ordreDeReference?.slice(debut, debut + taille) ?? this.ordre.page(debut, taille);
  }
  comptes(): { total: number; confirmes: number; potentiels: number } {
    if (!this.ordreDeReference) return this.ordre.comptes();
    const confirmes = this.ordreDeReference.reduce((n, i) => n + Number(this.magasin.etat(i) === 1), 0);
    return { total: this.ordreDeReference.length, confirmes, potentiels: this.ordreDeReference.length - confirmes };
  }
  note(i: number): number | null { return this.notesPresentes[i] ? this.notes[i] : null; }
  /** Les confirmées de rang `debut` à `debut + taille − 1` parmi les confirmées, dans l'ordre du classement. */
  pageConfirmees(debut: number, taille: number): number[] {
    if (this.cacheVide) return [];
    if (this.ordreDeReference) return this.ordreDeReference.filter((i) => this.magasin.etat(i) === 1).slice(debut, debut + taille);
    return this.ordre.page(debut, taille, 'confirmes');
  }
  enAttente(taille: number): number[] {
    if (this.cacheVide) return Array.from(this.ordreBase.slice(0, taille));
    if (this.ordreDeReference) return this.ordreDeReference.filter((i) => this.magasin.etat(i) === 0).slice(0, taille);
    return this.ordre.page(0, taille, 'potentiels');
  }
  definirOrdreBase(ordre: Uint32Array): void {
    terminerEtapes(this.definirOrdreBaseEtapes(ordre));
  }
  *definirOrdreBaseEtapes(ordre: Uint32Array): Generator<void> {
    this.ordreBase = ordre;
    for (let rang = 0; rang < ordre.length; rang++) { this.rangBase[ordre[rang]] = rang; if ((rang & 63) === 0) yield; }
    this.contexte = Symbol('ordre de base remplacé');
  }
}

export interface VueClassement {
  /** Le CLI imprime aussi les non vérifiés ; l'écran compose ses cartes vérifiées. */
  pageImprimee?: boolean;
  /** Une des onze colonnes ; l'objectif de recherche Vitesse se trie par VIT (`triDesResultats`). */
  tri: ColonneResultat;
  metric: OptimMetric;
  page: number;
}
export interface VersionsClassement {
  versionSchema: 1;
  idRecherche: number;
  idInventaire: number;
  idContexteResolution: number;
  revisionDonnees: number;
  idVue: number;
  revisionPubliee: number;
  idDemande: number;
}
export type IdentitePublication = Pick<VersionsClassement, 'idRecherche' | 'idVue' | 'idDemande' | 'revisionPubliee'>;
/** Une carte de la page : le build avec les statistiques de sa vraie paire et son équipement résolu. */
export interface CarteClassement {
  ordinal: number;
  candidat: BuildCandidate;
  /** `null` sans file : l'équipement est celui de la fiche. */
  resultat: ResultatArtefacts | null;
  /** Le chiffre qui classe la carte, quand l'objectif ou le tri le demande ; calculé par le classeur. */
  pvEffectifs: number | null;
  degatsReels: number | null;
}
export interface ComptesClassement {
  /** Candidats reçus de la recherche : l'aperçu, puis tous. */
  recus: number;
  /** Reçus moins les écartés de la résolution. */
  affichables: number;
  /** Reçus dont l'équipement est résolu, conformes ou écartés. */
  resolus: number;
  /** Reçus résolus ET conformes. */
  confirmees: number;
  /** Une file vérifie l'équipement (optimisation d'artéfacts active). */
  avecFile: boolean;
}
/** Tout ce que la page reçoit : jamais un objet ni un ordinal par build trouvé. */
export interface InstantaneClassement {
  versions: VersionsClassement;
  vue: VueClassement;
  comptes: ComptesClassement;
  page: { premierRang: number; cartes: CarteClassement[]; placesEnAttente: number };
  enAttente: number;
  /** Panne du résolveur reprise dans le classeur, s'il y en a eu une. */
  incident: string | null;
  bilan: Omit<SearchResult, 'candidates'> | null;
}
export const TAILLE_PAGE_CLASSEMENT = 20;
/** Projection objet complète, pour Node seulement (CLI, harnais, tests) : jamais envoyée à la page. */
export interface PublicationClassement {
  versions: VersionsClassement;
  vue: VueClassement;
  candidats: BuildCandidate[];
  base: BuildCandidate[];
  affichees: BuildCandidate[];
  parBuild: Map<string, ResultatArtefacts>;
  enAttente: number;
  bilan: Omit<SearchResult, 'candidates'> | null;
}

function compteurSuivant(n: number): number {
  if (!Number.isSafeInteger(n) || n >= Number.MAX_SAFE_INTEGER) throw new Error('Compteur du classeur épuisé ; recréer le propriétaire');
  return n + 1;
}

/** Corps partagé par le Worker et Node : aucune API de plateforme ni de React. */
export class CorpsClassement {
  private flux = new RecepteurCandidats(0);
  private lots: BlocCandidats[] = [];
  private plages: { debut: number; longueur: number }[] = [];
  private nombreCible = 0;
  private tache: Generator<void> | null = null;
  private reponsesEnAttente: ReponseResolution[] = [];
  private index: ClassementCompact | null = null;
  private base: Uint32Array = new Uint32Array();
  // L'ordre du fond suit l'objectif et la mesure LANCÉS : `null` quand la vue
  // les garde, l'ordre de base de la vue sert alors lui-même.
  private fondPropre: { index: ClassementCompact; ordre: Uint32Array } | null = null;
  // Seule une page demandée explicitement passe devant le fond : l'ouverture,
  // ou une vue qui ne change que la page ; jamais un changement de tri.
  private pagePrioritaire = true;
  private cache = new CacheResolutionCompact();
  private signature = '';
  private contexte: ContexteResultat | null = null;
  private vue: VueClassement | null = null;
  private versions: VersionsClassement = { versionSchema: 1, idRecherche: 0, idInventaire: 0, idContexteResolution: 0, revisionDonnees: 0, idVue: 0, revisionPubliee: 0, idDemande: 0 };
  private bilan: Omit<SearchResult, 'candidates'> | null = null;
  private collecteScellee = false;
  private entrees: EntreesResolutionSerialisables | null = null;
  private pilote = new ResolutionDistante();
  private direct = new CorpsResolution();
  private reponsesDirectes: ReponseResolution[] = [];
  private repli = false;
  private dernierePublication = -Infinity;
  private sale = true;
  private publicationForcee = false;
  private visites = new Uint32Array();
  private passage = 0;
  private versionLue = -1;
  private fileExhaustive: {
    index: ClassementCompact; base: Uint32Array; generationCache: number; generationJournal: object | undefined; version: number;
    suivants: Uint32Array; precedents: Uint32Array; ordinaux: Uint32Array; premier: number; nombre: number;
  } | null = null;
  private generationCache = 0;
  private incident: string | null = null;
  // Notes et ordre de base préparés pendant la recherche : la vue et l'objectif
  // lancé, deux critères au plus (un seul quand la vue suit le lancement).
  private auFil: OrdreAuFil[] = [];
  private auFilEnAttente = false;
  /** Notes et comparaisons de l'ordre de base de cette recherche, au fil des blocs et au scellé. */
  readonly travail: CompteOrdreDeBase = { notes: 0, comparaisons: 0 };

  constructor(private readonly sorties: {
    publier: (p: InstantaneClassement) => void;
    resoudre: (m: MessageVersResolution) => void;
    incident: (raison: string, detail: unknown) => void;
  }, private readonly differe = false, modeResolution: 'distante' | 'directe' = 'distante') {
    this.repli = modeResolution === 'directe';
  }

  get travailEnCours() { return this.tache !== null; }
  avancer(): void {
    if (this.tache?.next().done) this.tache = null;
  }
  private programmer(tache: Generator<void>): void {
    this.tache = tache;
    if (!this.differe) while (this.tache) this.avancer();
  }

  ouvrir(contexte: ContexteResultat, idRecherche: number, vue: VueClassement, idDemande: number): void {
    if (contexte.versionSchema !== 1 || !Number.isSafeInteger(idRecherche) || idRecherche <= this.versions.idRecherche) throw new Error('Génération de classement invalide');
    const signature = JSON.stringify([contexte.idInventaire, contexte.idEspece, contexte.signature, contexte.recherche.relicContext?.empreinte,
      resolutionDuContexte(contexte)?.regime]);
    if (signature !== this.signature) { this.cache = new CacheResolutionCompact(); this.generationCache = compteurSuivant(this.generationCache); }
    this.signature = signature;
    this.abandonnerReponses();
    this.tache = null; this.nombreCible = 0; this.plages = [];
    this.contexte = contexte; this.vue = null; this.flux = new RecepteurCandidats(0); this.lots = [];
    this.index = null; this.fileExhaustive = null; this.base = new Uint32Array(); this.fondPropre = null; this.bilan = null; this.collecteScellee = false;
    this.auFil = []; this.auFilEnAttente = false; this.travail.notes = 0; this.travail.comparaisons = 0;
    this.versions = { versionSchema: 1, idRecherche, idInventaire: contexte.idInventaire,
      idContexteResolution: this.versions.idContexteResolution, revisionDonnees: 0, idVue: 0, revisionPubliee: 0, idDemande };
    this.entrees = null;
    for (const m of this.pilote.invalider()) {
      if (this.repli) this.reponsesDirectes.push(...this.direct.recevoir(m));
      else this.sorties.resoudre(m);
    }
    this.sale = true; this.publicationForcee = false; this.dernierePublication = -Infinity;
    this.changerVue(vue, 1, idDemande);
  }
  private get fond(): Uint32Array { return this.fondPropre?.index === this.index && this.fondPropre ? this.fondPropre.ordre : this.base; }
  /** La colonne de l'objectif lancé : l'ordre du fond. Vitesse se classe par VIT, même note. */
  private triDuLancement(): ColonneResultat {
    return triDesResultats(this.contexte?.recherche.objective ?? 'efficience');
  }
  private vueSuitLeLancement(vue: VueClassement): boolean {
    return vue.tri === this.triDuLancement() && vue.metric === this.contexte?.recherche.metric;
  }
  private courant(idRecherche: number) { return this.contexte !== null && idRecherche === this.versions.idRecherche; }
  private criteresDeBase(): [StatKey | Objective, OptimMetric][] {
    if (!this.contexte || !this.vue) return [];
    const lance: [StatKey | Objective, OptimMetric] = [this.triDuLancement(), this.contexte.recherche.metric];
    return this.vueSuitLeLancement(this.vue) ? [lance] : [[this.vue.tri, this.vue.metric], lance];
  }
  private ordreAuFil(critere: StatKey | Objective, metric: OptimMetric): OrdreAuFil {
    const cle = `${critere}|${metric}`;
    let ordre = this.auFil.find((o) => o.cle === cle);
    if (!ordre) {
      ordre = new OrdreAuFil(cle, critere, optionsDuContexte(this.contexte!, null, metric), this.flux, this.travail);
      this.auFil.push(ordre);
    }
    return ordre;
  }
  /** Du travail reste à faire au fil des blocs reçus (recherche non scellée). */
  get travailAuFil(): boolean { return this.auFilEnAttente && !this.collecteScellee && this.contexte !== null && this.vue !== null; }
  /**
   * Un pas de travail au fil des blocs : noter et ranger le reçu pour la vue et
   * l'objectif lancé. Faux quand tout est à jour. Le Worker ne l'appelle
   * qu'après sa tâche et sa file, dans le temps qui reste.
   */
  avancerAuFil(): boolean {
    if (!this.travailAuFil) return this.auFilEnAttente = false;
    for (const [critere, metric] of this.criteresDeBase()) if (this.ordreAuFil(critere, metric).avancer()) return true;
    return this.auFilEnAttente = false;
  }
  private *notesConnues(critere: StatKey | Objective, metric: OptimMetric, n: number): Generator<void, NotesConnues | undefined> {
    // Source libérée après le scellé : l'ordre se refait sur le magasin, comme avant.
    if (this.collecteScellee && !this.lots.length) return undefined;
    const ordre = this.ordreAuFil(critere, metric);
    return this.collecteScellee && n === this.flux.longueur ? yield* ordre.finir(n) : ordre.connues(n);
  }
  ajouter(idRecherche: number, sequence: number, bloc: BlocCandidats): void {
    if (!this.courant(idRecherche)) return;
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('Séquence de candidats invalide');
    if (this.collecteScellee && !this.lots.length) {
      const plage = this.plages[sequence];
      if (!plage || plage.debut !== bloc.debut || plage.longueur !== bloc.longueur || bloc.schema !== 1
        || bloc.ids.length !== 6 || bloc.totaux.length !== 8 || bloc.gabarits.length !== 8
        || [...bloc.ids, ...bloc.totaux, bloc.efficience].some((c) => c.length !== bloc.longueur)) throw new Error('Lot retransmis après scellement incohérent');
      for (let i = 0; i < bloc.longueur; i++) {
        const c = this.index!.magasin.candidat(bloc.debut + i, false);
        if (!Object.is(c.effTotal, bloc.efficience[i]) || c.runeIds.some((id, j) => !Object.is(id, bloc.ids[j][i]))
          || c.stats.some((s, j) => !Object.is(s.total, bloc.totaux[j][i]) || !Object.is(s.base, bloc.gabarits[j].base)
            || s.key !== bloc.gabarits[j].key || s.label !== bloc.gabarits[j].label || s.suffix !== bloc.gabarits[j].suffix)) throw new Error('Lot retransmis avec un contenu différent');
      }
      return;
    }
    const connu = this.lots[sequence];
    if (connu) {
      const colonnes = (b: BlocCandidats) => [...b.ids, ...b.totaux, b.efficience];
      if (bloc.debut !== connu.debut || bloc.longueur !== connu.longueur || bloc.schema !== connu.schema
        || bloc.gabarits.length !== connu.gabarits.length || bloc.gabarits.some((g, i) => {
          const autre = connu.gabarits[i];
          return !Object.is(g.base, autre.base) || g.key !== autre.key || g.label !== autre.label || g.suffix !== autre.suffix;
        })
        || colonnes(bloc).some((c, j) => c.length !== colonnes(connu)[j].length || c.some((v, i) => !Object.is(v, colonnes(connu)[j][i])))) throw new Error('Lot retransmis avec un contenu différent');
      return;
    }
    if (this.collecteScellee || sequence !== this.lots.length) throw new Error('Séquence de candidats manquante ou flux scellé');
    this.flux.recevoir([bloc]); this.lots.push(bloc); this.plages.push({ debut: bloc.debut, longueur: bloc.longueur }); this.versions.revisionDonnees = compteurSuivant(this.versions.revisionDonnees);
    this.auFilEnAttente = true;
  }
  activer(idRecherche: number): void {
    if (!this.courant(idRecherche)) return;
    const nombre = this.collecteScellee ? this.flux.longueur : Math.min(3000, this.flux.longueur);
    if (this.nombreCible !== nombre) { this.nombreCible = nombre; this.trierBase(); this.sale = true; }
    this.libererSourceScellee();
  }
  sceller(idRecherche: number, nombre: number, derniereSequence: number, bilan: Omit<SearchResult, 'candidates'> | null): void {
    if (!this.courant(idRecherche)) return;
    if (derniereSequence !== this.plages.length - 1) throw new Error('Scellement de séquence incomplet');
    if (this.collecteScellee) {
      if (nombre !== this.nombreCible || JSON.stringify(bilan) !== JSON.stringify(this.bilan)) throw new Error('Scellement retransmis incohérent');
      return;
    }
    this.flux.scellerColonnes(nombre); this.bilan = bilan; this.collecteScellee = true;
    // Le bilan (fin de recherche) part dès que son instantané est prêt : retenu
    // par la cadence, il n'attendrait que la prochaine réponse du résolveur.
    this.activer(idRecherche); this.sale = true; this.publicationForcee = true;
  }
  private libererSourceScellee(): void {
    // Le magasin n'adopte la source qu'une fois sa construction terminée.
    // Le travail au fil des blocs a servi : l'index porte désormais notes et ordre de base.
    if (this.collecteScellee && this.index?.magasin.longueur === this.nombreCible && !this.tache) { this.flux.liberer(); this.lots = []; this.auFil = []; }
  }
  changerVue(vue: VueClassement, idVue: number, idDemande: number): void {
    if (!this.contexte || idVue <= this.versions.idVue) return;
    if (!Number.isSafeInteger(idVue) || !Number.isSafeInteger(idDemande) || !Number.isSafeInteger(vue.page) || vue.page < 1) throw new Error('Vue de classement invalide');
    const avant = this.vue;
    // Le régime suit l'objectif photographié : seule l'ouverture le pose.
    const entrees = avant ? this.entrees : resolutionDuContexte(this.contexte);
    if (!avant && entrees) {
      this.entrees = entrees; this.versions.idContexteResolution = compteurSuivant(this.versions.idContexteResolution);
      this.signature = JSON.stringify([this.contexte.idInventaire, this.contexte.idEspece, this.contexte.signature, this.contexte.recherche.relicContext?.empreinte, entrees?.regime]);
    }
    if (!avant) this.pagePrioritaire = true;
    else if (avant.tri !== vue.tri || avant.metric !== vue.metric) this.pagePrioritaire = false;
    else if (avant.page !== vue.page || avant.pageImprimee !== vue.pageImprimee) this.pagePrioritaire = true;
    this.vue = { ...vue }; this.versions.idVue = idVue; this.versions.idDemande = idDemande;
    if (!avant || avant.tri !== vue.tri || avant.metric !== vue.metric) {
      // Le critère quitté ne sert plus ; le nouveau se prépare sur tout le reçu.
      const cles = new Set(this.criteresDeBase().map(([c, m]) => `${c}|${m}`));
      this.auFil = this.auFil.filter((o) => cles.has(o.cle)); this.auFilEnAttente = this.flux.longueur > 0;
    }
    if (!this.contexte.toutVerifier) this.fileExhaustive = null;
    if (!avant || avant.tri !== vue.tri || avant.metric !== vue.metric) this.trierBase();
    // Un geste de vue se publie dès que son instantané est prêt (fin du tri
    // éventuel), sans attendre les 400 ms du fond : retenu, il n'attendrait que
    // le prochain message du résolveur, et l'écran garderait l'ancienne page
    // sous le nouveau numéro. Une publication par geste, que la cadence suit.
    this.sale = true; this.publicationForcee = true;
  }
  private trierBase(): void {
    if (!this.contexte || !this.vue) return;
    this.index?.invalider();
    this.programmer(this.trierBaseEtapes());
  }
  private *trierBaseEtapes(): Generator<void> {
    if (!this.contexte || !this.vue) return;
    let index = this.index;
    if (!index || index.magasin.longueur !== this.nombreCible) {
      const source = candidatsParIndice(this.nombreCible, (i) => this.flux.lire(i));
      index = new ClassementCompact(source, undefined, true);
      yield* index.magasin.initialiser(source);
    }
    const source = candidatsParIndice(index.magasin.longueur, (i) => index.magasin.candidat(i, false));
    const n = index.magasin.longueur;
    const deBase = yield* ordreCollecteEtapes(source, this.vue.tri, optionsDuContexte(this.contexte, null, this.vue.metric), this.travail,
      yield* this.notesConnues(this.vue.tri, this.vue.metric, n));
    const base = deBase.ordre;
    index.definirNotesDeBase(`${this.vue.tri}|${this.vue.metric}`, deBase.notes, deBase.calculable);
    yield* index.definirOrdreBaseEtapes(base);
    let fond = base;
    if (!this.vueSuitLeLancement(this.vue)) {
      const objectif = this.triDuLancement(), metric = this.contexte.recherche.metric;
      fond = this.fondPropre?.index === index ? this.fondPropre.ordre
        : (yield* ordreCollecteEtapes(source, objectif, optionsDuContexte(this.contexte, null, metric), this.travail,
          yield* this.notesConnues(objectif, metric, n))).ordre;
      this.fondPropre = { index, ordre: fond };
    } else this.fondPropre = null;
    yield* this.actualiserEtapes(index, fond);
    this.index = index; this.base = base;
    this.visites = new Uint32Array(index.magasin.longueur); this.passage = 0;
    this.sale = true;
  }
  private cacheLecture(): ReadonlyMap<string, ResultatArtefacts> {
    return this.cache;
  }
  private actualiser(): void {
    if (this.tache || !this.index || !this.contexte || !this.vue) return;
    if ((this.cache.journal?.version ?? -1) === this.versionLue && (!this.contexte.toutVerifier || this.selectionExhaustiveCourante())) return;
    this.programmer(this.actualiserEtapes(this.index));
  }
  private *actualiserEtapes(index: ClassementCompact, fond = this.fond): Generator<void> {
    if (!this.contexte || !this.vue) return;
    const options = optionsDuContexte(this.contexte, this.cache, this.vue.metric);
    // Un changement de tri ou de mesure remplace cette tâche : le critère capturé reste celui de la vue.
    const { tri, metric } = this.vue;
    yield* index.actualiserEtapes(this.cacheLecture(), this.cache.journal, `${this.versions.idRecherche}:${tri}:${metric}:${this.versions.idContexteResolution}`,
      (c) => scoreDuCandidat(c, tri, options), `${tri}|${metric}`);
    yield* this.actualiserSelectionEtapes(index, fond);
    this.versionLue = this.cache.journal?.version ?? -1;
  }
  private selectionExhaustiveCourante(): boolean {
    const f = this.fileExhaustive;
    return f !== null && f.index === this.index && f.base === this.fond && f.generationCache === this.generationCache
      && f.generationJournal === this.cache.journal?.generation && f.version === (this.cache.journal?.version ?? -1);
  }
  private *actualiserSelectionEtapes(index: ClassementCompact, base: Uint32Array): Generator<void> {
    if (!this.contexte?.toutVerifier) { this.fileExhaustive = null; return; }
    const journal = this.cache.journal, version = journal?.version ?? -1;
    let f = this.fileExhaustive;
    // Un repli complet ne peut pas se déduire du seul dernier delta du journal.
    if (!f || f.index !== index || f.base !== base || f.generationCache !== this.generationCache || f.generationJournal !== journal?.generation
      || index.travail.complet || (version !== f.version && version !== f.version + 1)) {
      const n = index.magasin.longueur;
      f = { index, base, generationCache: this.generationCache, generationJournal: journal?.generation, version,
        suivants: new Uint32Array(n), precedents: new Uint32Array(n), ordinaux: new Uint32Array(n), premier: 0, nombre: 0 };
      let dernier = 0;
      for (let j = 0; j < base.length; j++) {
        const i = base[j], g = index.magasin.groupe(i);
        if (!f.ordinaux[g] && index.magasin.etat(i) === 0) {
          f.ordinaux[g] = i + 1; f.precedents[g] = dernier;
          if (dernier) f.suivants[dernier - 1] = g + 1; else f.premier = g + 1;
          dernier = g + 1; f.nombre++;
        }
        if ((j & 63) === 0) yield;
      }
      this.fileExhaustive = this.contexte?.toutVerifier ? f : null;
      return;
    }
    if (version === f.version) return;
    for (const c of journal!.changements) {
      const g = index.magasin.groupeDeCle(c.cle);
      // Lire ou envoyer ne consomme rien : seul le cache commis retire un groupe.
      if (g === undefined || !f.ordinaux[g] || index.magasin.etat(g) === 0) continue;
      const avant = f.precedents[g], apres = f.suivants[g];
      if (avant) f.suivants[avant - 1] = apres; else f.premier = apres;
      if (apres) f.precedents[apres - 1] = avant;
      f.ordinaux[g] = 0; f.nombre--;
      yield;
    }
    f.version = version;
  }
  private pageIndices(): number[] {
    if (!this.index || !this.entrees || !this.pagePrioritaire) return [];
    if (this.vue?.pageImprimee) return this.index.page((this.vue.page - 1) * 20, 20)
      .filter((i) => this.index!.magasin.etat(i) === 0);
    const { total, confirmes } = this.index.comptes();
    const debut = ((this.vue?.page ?? 1) - 1) * 20;
    const attendues = Math.min(20, Math.max(0, total - debut));
    const cartes = Math.max(0, Math.min(20, confirmes - debut));
    return attendues > cartes ? this.index.enAttente(Math.min(20, debut + attendues - confirmes)) : [];
  }
  private page(): BuildCandidate[] {
    return this.pageIndices().map((i) => this.index!.magasin.candidat(i, false));
  }
  private restants(): BuildCandidate[] {
    if (this.tache) return [];
    if (!this.entrees || !this.index || !this.vue || !this.contexte) return [];
    if ((this.cache.journal?.version ?? -1) !== this.versionLue || (this.contexte.toutVerifier && !this.selectionExhaustiveCourante())) { this.actualiser(); if (this.tache) return []; }
    if (this.passage === 0xffffffff) { this.visites.fill(0); this.passage = 0; }
    const passage = ++this.passage, premiers: number[] = [];
    let nombre = 0;
    const ajouter = (i: number) => {
      const g = this.index!.magasin.groupe(i);
      if (this.visites[g] === passage) return;
      this.visites[g] = passage; nombre++;
      // Le pilote ne lit que ses deux places en vol et l'entrée suivante.
      if (premiers.length < 3) premiers.push(i);
    };
    for (const i of this.pageIndices()) ajouter(i);
    const K = cibleDeLaFile({ relicContext: this.contexte.recherche.relicContext, toutVerifier: this.contexte.toutVerifier });
    if (K === Infinity) {
      const f = this.fileExhaustive!;
      // Trois choix au total, page comprise ; au plus trois maillons lus, sauts compris.
      for (let lien = f.premier; lien && premiers.length < 3; lien = f.suivants[lien - 1]) ajouter(f.ordinaux[lien - 1] - 1);
      return candidatsParIndice(f.nombre, (i) => premiers[i] === undefined ? undefined as unknown as BuildCandidate : this.index!.magasin.candidat(premiers[i], false));
    }
    let confirmees = 0, aVerifier = 0;
    const fond = this.fond;
    for (let j = 0; j < fond.length && confirmees + aVerifier < K; j++) {
      const i = fond[j], etat = this.index.magasin.etat(i);
      if (etat === 0) { aVerifier++; ajouter(i); }
      else if (etat === 1) confirmees++;
    }
    return candidatsParIndice(nombre, (i) => premiers[i] === undefined ? undefined as unknown as BuildCandidate : this.index!.magasin.candidat(premiers[i], false));
  }
  private ports(maintenant: number): PortsResolutionDistante {
    return { courant: () => this.entrees ? { entrees: this.entrees, signature: `${this.signature}:${this.entrees.regime}` } : null,
      runesDe: (c) => runesDuBuild(c, runesDuContexte(this.contexte!)), restants: () => this.restants(), page: () => this.page(), cache: () => this.cache,
      actualisationEnCours: () => this.travailEnCours,
      envoyer: (m) => { if (this.repli) this.reponsesDirectes.push(...this.direct.recevoir(m)); else this.sorties.resoudre(m); },
      publier: (forcer) => { this.actualiser(); this.versions.revisionDonnees = compteurSuivant(this.versions.revisionDonnees); this.sale = true; return this.publier(maintenant, forcer); },
      enAttente: () => {}, repli: (raison, detail) => this.panneResolution(raison, detail) };
  }
  pomper(maintenant: number): void {
    if (this.tache) return;
    this.libererSourceScellee();
    const reponse = this.reponsesEnAttente.shift();
    if (reponse) { this.recevoirResolution(reponse, maintenant); if (this.tache) return; }
    const p = this.ports(maintenant);
    this.pilote.pomper(p);
    if (this.repli) {
      const r = this.reponsesDirectes.shift() ?? this.direct.etape();
      if (r) {
        if (r.type === 'erreur') throw new Error(`${r.nom}: ${r.message}`);
        this.pilote.surReponse(r, p);
      }
    }
    const restants = this.restants();
    this.publier(maintenant, !this.tache && restants.length === 0);
  }
  recevoirResolution(r: ReponseResolution, maintenant: number): void {
    if (this.tache) { this.reponsesEnAttente.push(r); return; }
    this.pilote.surReponse(r, this.ports(maintenant));
  }
  panneResolution(raison: string, detail: unknown): void {
    if (this.repli) return;
    this.sorties.incident(raison, detail);
    this.incident = raison;
    this.reponsesEnAttente = []; this.reponsesDirectes = [];
    this.pilote.renoncer(); this.pilote = new ResolutionDistante(); this.direct = new CorpsResolution(); this.repli = true;
    this.sale = true; this.publicationForcee = true;
  }
  get travailEnRepli() { return this.reponsesEnAttente.length > 0 || (this.repli && this.restants().length > 0); }
  private abandonnerReponses(): void {
    // Ces réponses ont déjà rendu leur crédit dans le résolveur. Les jeter
    // sans passer par le pilote conserverait à jamais des demandes en vol.
    for (const r of this.reponsesEnAttente) {
      const issue = this.pilote.recevoir(r, null, null);
      if (issue.issue === 'erreur') {
        const { raison, detail } = repliSurErreur(issue);
        this.panneResolution(raison, detail);
      }
    }
    this.reponsesEnAttente = [];
  }
  liberer(): void {
    this.abandonnerReponses();
    this.publicationForcee = false;
    this.collecteScellee = false;
    this.tache = null; this.nombreCible = 0; this.plages = []; this.reponsesEnAttente = [];
    this.contexte = null; this.vue = null; this.index = null; this.fileExhaustive = null; this.flux.liberer(); this.lots = [];
    this.auFil = []; this.auFilEnAttente = false;
    this.cache.clear(); this.generationCache = compteurSuivant(this.generationCache); this.entrees = null; this.sale = false;
    for (const m of this.pilote.invalider()) {
      if (this.repli) this.reponsesDirectes.push(...this.direct.recevoir(m)); else this.sorties.resoudre(m);
    }
  }
  publier(maintenant: number, forcer = false): boolean {
    this.publicationForcee ||= forcer;
    if (this.tache) return false;
    if (!this.contexte || !this.vue || !this.sale) return true;
    if (!this.publicationForcee && maintenant - this.dernierePublication < 400) return false;
    // Un index en retard sur le cache serait publié avec de fausses cartes :
    // la publication reste due jusqu'à la fin de son actualisation.
    const enAttente = this.restants().length;
    if (this.tache) return false;
    this.dernierePublication = maintenant; this.sale = false; this.publicationForcee = false;
    this.versions.revisionPubliee = compteurSuivant(this.versions.revisionPubliee);
    this.sorties.publier(this.instantane(enAttente));
    return true;
  }
  /** Comptes de l'arbre, confirmées du rang demandé, places attendues : O(log N + 20). */
  private instantane(enAttente: number): InstantaneClassement {
    const contexte = this.contexte!, vue = this.vue!, index = this.index;
    const debut = (vue.page - 1) * TAILLE_PAGE_CLASSEMENT;
    const recus = index?.magasin.longueur ?? 0;
    const { total, confirmes } = index?.comptes() ?? { total: 0, confirmes: 0 };
    const avecFile = this.entrees !== null;
    let ordinaux: number[] = [], places = 0;
    if (index && avecFile) {
      ordinaux = index.pageConfirmees(debut, TAILLE_PAGE_CLASSEMENT);
      places = Math.min(TAILLE_PAGE_CLASSEMENT, Math.max(0, total - debut)) - ordinaux.length;
    } else if (index) ordinaux = index.page(debut, TAILLE_PAGE_CLASSEMENT);
    const objectif = contexte.recherche.objective;
    const options = optionsDuContexte(contexte, this.cache, vue.metric);
    const avecEhp = objectif === 'ehp' || vue.tri === 'ehp';
    const avecDegats = contexte.realDamage !== null && (objectif === 'degats_reels' || vue.tri === 'degats_reels');
    const cartes = ordinaux.map((i): CarteClassement => {
      const brut = index!.magasin.candidat(i, false);
      const resultat = avecFile ? this.cache.get(cleBuild(brut)) ?? null : null;
      const candidat = resultat ? { ...brut, stats: resultat.stats } : brut;
      return { ordinal: i, candidat, resultat,
        pvEffectifs: avecEhp ? scoreDuCandidat(candidat, 'ehp', options) : null,
        degatsReels: avecDegats ? scoreDuCandidat(candidat, 'degats_reels', options) : null };
    });
    return { versions: { ...this.versions }, vue: { ...vue },
      comptes: { recus, affichables: total, resolus: recus - total + confirmes, confirmees: confirmes, avecFile },
      page: { premierRang: debut + 1, cartes, placesEnAttente: places }, enAttente, incident: this.incident, bilan: this.bilan };
  }
  /**
   * La projection objet complète de l'état courant : candidats, ordre de base,
   * classement affiché et cache. Node seulement (`classerEnLocal`, tests) :
   * elle matérialise N objets, jamais envoyée à la page.
   */
  projection(): PublicationClassement {
    if (!this.contexte || !this.vue) throw new Error('Projection sans recherche ouverte');
    const index = this.index, n = index?.magasin.longueur ?? 0;
    const candidats = Array.from({ length: n }, (_, i) => index!.magasin.candidat(i, false));
    const parBuild = new Map(this.cache);
    return { versions: { ...this.versions }, vue: { ...this.vue }, candidats, base: Array.from(this.base, (i) => candidats[i]),
      affichees: (index?.page(0, n) ?? []).map((i) => candidatAvecSaPaire(candidats[i], parBuild)), parBuild,
      enAttente: this.restants().length, bilan: this.bilan };
  }
}

/** Consommateur synchrone du propriétaire de production, sans protocole de plateforme. */
export function classerEnLocal(contexte: ContexteResultat, candidats: readonly BuildCandidate[], vue: VueClassement): PublicationClassement {
  let publiee = false;
  const corps = new CorpsClassement({
    publier: () => { publiee = true; },
    resoudre: () => { throw new Error('Résolution distante sur le consommateur local'); },
    incident: (raison) => { throw new Error(raison); },
  }, false, 'directe');
  corps.ouvrir(contexte, 1, vue, 1);
  const colonnes = creerColonnesCandidats();
  for (const c of candidats) ajouterObjetCandidat(colonnes, c);
  const lots = extraireBlocs(colonnes);
  lots.forEach((b, i) => corps.ajouter(1, i, b));
  // Le classement d'une collection ne fabrique pas de bilan de recherche.
  corps.sceller(1, candidats.length, lots.length - 1, null);
  do { corps.pomper(0); } while (corps.travailEnRepli);
  if (!publiee || corps.travailEnCours) throw new Error('Classement local sans publication finale');
  return corps.projection();
}
