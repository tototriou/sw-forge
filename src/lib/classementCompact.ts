import { CandidatsCompacts, RecepteurCandidats, ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, terminerEtapes, trierIndicesEtapes, type BlocCandidats } from './candidatsCompacts';
import { candidatAvecSaPaire, cibleDeLaFile, cleBuild, compteConfirmeDesComptes, type JournalResolution, type ResultatArtefacts } from './artifactQueue';
import { scoreDuCandidat, type BuildCandidate, type Objective, type OptionsDeClassement } from './runeBuildOptim';
import { CAPPED_STATS, type StatKey } from './effects';
import type { OptimMetric } from './runeOptim';
import { CacheResolutionCompact } from './cacheResolutionCompact';
import { optionsDuContexte, resolutionDuContexte, runesDuContexte, type ContexteResultat } from './contexteResultat';
import { runesDuBuild } from './relicQueue';
import { ResolutionDistante, repliSurErreur, type PortsResolutionDistante } from '../workers/resolutionDistante';
import { CorpsResolution, type MessageVersResolution, type ReponseResolution, type EntreesResolutionSerialisables } from '../workers/resolutionBody';
import type { SearchResult } from './runeBuildOptim';
import { triDesResultats, type ColonneResultat } from './colonnesResultats';
import { SENS_PAR_DEFAUT, signeTri, type SensTri } from './tri';
import { CATEGORIE_LIGNE, NOMBRE_CATEGORIES, SANS_FILTRE, colonneDisponible, copierBornes, dansLaVue, estColonneDeStat, etatDesBornes, filtreDesLignes,
  valeurAffichee, valeurAfficheeDeStat,
  AUCUNE_BORNE, objectifsMontres, type BornesResultats, type EtatBornes, type FiltreLignes } from './filtresResultats';

/** Une ligne pas encore notée : aucune catégorie, hors des comptes. */
const NON_JUGEE = 255;

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

/**
 * La note d'une vue dans son sens. En croissant, la note opposée : les mêmes
 * tris décroissants stables rangent alors par note croissante — le seul
 * comparateur de note inversé —, sans toucher au départage (relique, clé,
 * rang de base) ni renverser les égalités, ce que ferait un `reverse()`.
 * En décroissant, la note telle quelle, au bit près.
 */
export function noteDansLeSens(note: number | null, sens: SensTri): number | null {
  return note === null || sens === 'desc' ? note : note * signeTri(sens);
}

function* ordreCollecteEtapes(candidats: ArrayLike<BuildCandidate>, critere: StatKey | Objective, options: OptionsDeClassement,
  compte?: CompteOrdreDeBase, connues?: NotesConnues, sens: SensTri = SENS_PAR_DEFAUT): Generator<void, OrdreDeBase> {
  const notes = yield* notesDeCollecteEtapes(candidats, critere, options, compte, connues, sens);
  return { ordre: yield* rangerNotesEtapes(notes, compte, connues), notes: notes.notes, calculable: notes.calculable };
}

/** Les notes de base d'un critère ; `nulles` : une note au moins est absente (rangée 0). */
interface NotesDeCritere { notes: Float64Array; calculable: boolean; nonFini: boolean; nulles: boolean }

/**
 * `lireStat` : sur un critère de stat, le total que `scoreDuCandidat` lirait
 * sur ce candidat (`statTotal`), pris dans la colonne au lieu du candidat.
 */
function* notesDeCollecteEtapes(candidats: ArrayLike<BuildCandidate>, critere: StatKey | Objective, options: OptionsDeClassement,
  compte?: CompteOrdreDeBase, connues?: NotesConnues, sens: SensTri = SENS_PAR_DEFAUT, lireStat?: (i: number) => number): Generator<void, NotesDeCritere> {
  const n = candidats.length, notes = new Float64Array(n);
  let calculable = false, nonFini = false, nulles = false;
  for (let i = 0; i < n; i++) {
    // Une note connue ne relit pas le candidat : seule la lecture coûte encore.
    // Elle est déjà dans le sens de la vue (`OrdreAuFil`).
    const connue = connues !== undefined && i < connues.nombre;
    const note = connue ? connues.note(i) : noteDansLeSens(lireStat ? lireStat(i) : scoreDuCandidat(candidats[i], critere, options), sens);
    if (!connue && compte) compte.notes++;
    calculable ||= note !== null; nulles ||= note === null;
    notes[i] = note ?? 0; nonFini ||= note !== null && !Number.isFinite(note);
    if (!connue || (i & 63) === 0) yield;
  }
  return { notes, calculable, nonFini, nulles };
}

/** L'ordre de base de ces notes : tri stable décroissant, ou les tris natifs sous une note non finie. */
function* rangerNotesEtapes({ notes, calculable, nonFini }: NotesDeCritere, compte?: CompteOrdreDeBase, connues?: NotesConnues): Generator<void, Uint32Array> {
  const n = notes.length;
  const ordre = Uint32Array.from({ length: n }, (_, i) => i);
  if (!calculable) return ordre;
  if (nonFini) return Uint32Array.from(Array.from(ordre).sort((a, b) => notes[b] - notes[a]));
  // Rangé au fil des blocs sur ces mêmes notes, toutes finies : le même ordre stable.
  if (connues?.ordre && connues.nombre === n && connues.ordre.length === n) return connues.ordre;
  return yield* trierIndicesEtapes(ordre, (a, b) => { if (compte) compte.comparaisons++; return notes[b] - notes[a]; });
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
    private readonly flux: RecepteurCandidats, private readonly compte: CompteOrdreDeBase, private readonly sens: SensTri = SENS_PAR_DEFAUT) {}

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
        const note = noteDansLeSens(scoreDuCandidat(this.flux.lire(i), this.critere, this.options), this.sens);
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

/** Les notes d'un critère nouveau pour l'aperçu : ses notes de base (`nonFini` : l'une d'elles ne l'est pas) et la note d'une ligne résolue. */
export interface NotesDeLApercu { notes: Float64Array; calculable: boolean; nonFini: boolean; score: NoterCompact }
/** Ce que l'index publiera une fois sa tâche finie : comptes et confirmées de la vue dans l'ordre. */
export interface ApercuClassement {
  parCategorie: number[][];
  total: number;
  confirmes: number;
  /** Toutes les confirmées de la vue, dans l'ordre de l'arbre. */
  confirmees: number[];
  categories: Uint8Array;
  cacheVide: boolean;
  cleFiltre: string;
}

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
  // La catégorie de chaque ligne sous les bornes de la vue (`CATEGORIE_LIGNE`,
  // NON_JUGEE avant sa première notation) et l'état qu'elle avait alors : les
  // comptes par état et catégorie se tiennent sans parcours.
  private readonly categories: Uint8Array;
  private readonly etatsJuges: Uint8Array;
  private readonly compteurs = new Float64Array(3 * NOMBRE_CATEGORIES);
  private filtre: FiltreLignes = SANS_FILTRE;
  // Le repli des non-finis range toutes les lignes non écartées, la vue en garde une sous-suite.
  private referenceComplete: number[] | undefined;
  // L'ordre de base restreint à la vue, pour le cache vide, refait quand la vue change.
  private baseDeLaVue: { version: number; source: Uint32Array; ordre: Uint32Array } | null = null;
  private versionVue = 0;
  // Ce qu'un aperçu peut lire sans attendre la tâche en cours : le magasin
  // reflète le cache de la dernière actualisation (aucune ingestion
  // interrompue), les catégories celles de `filtre` sur toutes les lignes, et
  // notes, `rangBase` et arbre ceux de la dernière actualisation terminée.
  private ingestionEnCours = false;
  private categoriesFiables = false;
  private notesFiables = false;

  constructor(base: ArrayLike<BuildCandidate>, ordreBase?: Uint32Array, differe = false) {
    this.magasin = new CandidatsCompacts(base, differe);
    this.notes = new Float64Array(base.length);
    this.notesPresentes = new Uint8Array(base.length);
    this.versionsNotes = new Uint32Array(base.length);
    this.categories = new Uint8Array(base.length).fill(NON_JUGEE);
    this.etatsJuges = new Uint8Array(base.length);
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
  private noter(i: number, score: NoterCompact, base: { notes: Float64Array; calculable: boolean } | null, reclasser = true): void {
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
    if (reclasser) this.classer(i);
  }
  /** La catégorie de la ligne sous le filtre courant (ou celle déjà jugée sous ce filtre), et ses comptes. */
  private classer(i: number, connue?: number): void {
    const etat = this.magasin.etat(i);
    const categorie = connue ?? (etat === 2 ? CATEGORIE_LIGNE.ecartee : this.filtre.juger(i, etat as 0 | 1));
    const avant = this.categories[i];
    if (avant !== NON_JUGEE) this.compteurs[this.etatsJuges[i] * NOMBRE_CATEGORIES + avant]--;
    this.categories[i] = categorie; this.etatsJuges[i] = etat;
    this.compteurs[etat * NOMBRE_CATEGORIES + categorie]++;
    if (dansLaVue(avant) !== dansLaVue(categorie)) this.versionVue++;
  }
  /** Dans la vue : visible ou potentielle ; seules ces lignes sont dans l'arbre. */
  private membre(i: number): boolean { return dansLaVue(this.categories[i]); }
  private rangerReference(): void {
    // Même entrée, mêmes expressions, mêmes deux tris natifs que l'oracle, sur
    // toutes les lignes non écartées ; la vue en garde la sous-suite.
    const indices = Array.from(this.ordreBase).filter((i) => this.magasin.etat(i) !== 2);
    indices.sort((a, b) => {
      const ra = this.magasin.rid(a) ?? Infinity, rb = this.magasin.rid(b) ?? Infinity;
      if (ra !== rb) return ra - rb;
      return this.magasin.rangCle(a) - this.magasin.rangCle(b);
    });
    if (indices.some((i) => this.notesPresentes[i])) indices.sort((a, b) => this.notes[b] - this.notes[a]);
    this.referenceComplete = indices;
    this.ordreDeReference = indices.filter((i) => this.membre(i));
  }
  /** Les notes de l'ordre de base, sans cache, pour ce critère (tri et mesure). */
  definirNotesDeBase(critere: string, notes: Float64Array, calculable: boolean): void {
    if (notes.length !== this.magasin.longueur) throw new Error('Notes de base d’une autre population');
    this.notesDeBase = { critere, notes, calculable };
  }

  actualiser(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, contexte: unknown, score: NoterCompact,
    filtre: FiltreLignes = SANS_FILTRE): void {
    terminerEtapes(this.actualiserEtapes(cache, journal, contexte, score, undefined, filtre));
  }
  /**
   * `critere` désigne le critère de `score` : ses notes de base servent aux
   * lignes non résolues. `filtre` classe chaque ligne notée ; un filtre d'une
   * autre clé reclasse toutes les lignes et refait l'arbre.
   */
  *actualiserEtapes(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, contexte: unknown, score: NoterCompact,
    critere?: string, filtre: FiltreLignes = SANS_FILTRE): Generator<void> {
    Object.assign(this.travail, { controlees: 0, notes: 0, reprises: 0, comparaisons: 0, complet: false, repliNonFini: false });
    const autreFiltre = filtre.cle !== this.filtre.cle;
    // Les catégories ne valent plus pour ce filtre tant qu'elles ne sont pas rejugées.
    const categoriesDuFiltre = this.categoriesFiables && !autreFiltre;
    this.filtre = filtre; this.categoriesFiables = false;
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
    // Seul le contexte de notation change (tri, sens, mesure, ordre de base) :
    // le magasin porte déjà ce cache et chaque ligne sa catégorie sous ce
    // filtre. L'ingestion rendrait le même état et le jugement la même
    // catégorie : seules les notes et l'arbre se refont.
    const renoter = complet && this.memeCache(cache, journal) && !this.ingestionEnCours && categoriesDuFiltre;
    const etaitNonFini = this.nonFinis > 0;
    this.ordreDeReference = undefined; this.referenceComplete = undefined;
    this.notesFiables = false;
    if (renoter) {
      // Les catégories ne changent pas : elles restent fiables pendant toute la renotation.
      this.categoriesFiables = true;
      this.travail.complet = true; this.ordre.vider(); this.nonFinis = 0;
      for (let i = 0; i < this.magasin.longueur; i++) { this.noter(i, score, base, false); yield; }
    } else if (complet) {
      this.ingestionEnCours = true;
      this.travail.complet = true; this.ordre.vider(); this.nonFinis = 0;
      this.categories.fill(NON_JUGEE); this.compteurs.fill(0); this.versionVue++;
      for (const g of this.magasin.chefs()) { this.magasin.ingerer(g, cache.get(this.magasin.cle(g))); yield; }
      for (let i = 0; i < this.magasin.longueur; i++) { this.noter(i, score, base); yield; }
    } else if (consecutif) {
      this.ingestionEnCours = true;
      // Retirer sous les anciennes clés avant toute ingestion de groupe.
      for (const c of journal.changements) {
        const g = this.magasin.groupeDeCle(c.cle);
        if (g === undefined) continue;
        for (const i of this.magasin.lignesDuGroupe(g)) {
          if (this.magasin.etat(i) === 2) continue;
          if (this.nonFini(i)) this.nonFinis--;
          // Sous l'ancienne catégorie : l'arbre ne tient que la vue.
          if (!etaitNonFini && !autreFiltre && this.membre(i)) this.ordre.retirer(i);
          yield;
        }
        this.magasin.ingerer(g, c.apres);
        for (const i of this.magasin.lignesDuGroupe(g)) { this.noter(i, score, base); yield; }
      }
    }
    this.ingestionEnCours = false;
    // Un autre filtre : les lignes non renotées prennent aussi leur catégorie, et l'arbre se refait.
    if (autreFiltre && !complet) for (let i = 0; i < this.magasin.longueur; i++) { this.classer(i); if ((i & 63) === 0) yield; }
    this.categoriesFiables = true;
    this.cacheVide = cache.size === 0;
    if (this.nonFinis) {
      this.rangerReference(); this.travail.repliNonFini = true;
    } else if (complet || etaitNonFini || autreFiltre) {
      this.ordre.vider();
      for (let i = 0; i < this.magasin.longueur; i++) { if (this.membre(i)) this.ordre.inserer(i); yield; }
    } else if (consecutif) {
      for (const c of journal.changements) {
        const g = this.magasin.groupeDeCle(c.cle);
        if (g !== undefined) for (const i of this.magasin.lignesDuGroupe(g)) { if (this.membre(i)) this.ordre.inserer(i); yield; }
      }
    }
    this.generation = journal?.generation; this.version = journal?.version ?? 0;
    this.tailleCache = cache.size; this.contexte = contexte;
    this.publicationCourante = new WeakSet([cache]);
    this.notesFiables = true;
  }
  /** Le magasin porte ce cache : aucune écriture depuis la dernière actualisation terminée, aucune ingestion interrompue. */
  aJour(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined): boolean {
    return !this.ingestionEnCours && this.memeCache(cache, journal);
  }
  /** Le cache est celui de la dernière actualisation terminée : aucune écriture depuis. */
  private memeCache(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined): boolean {
    if (!this.publicationCourante.has(cache) || this.tailleCache !== cache.size) return false;
    return journal ? journal.generation === this.generation && journal.version === this.version && journal.tailleApres === this.tailleCache
      : this.generation === undefined && this.version === 0;
  }

  /**
   * D'autres bornes, sans renoter : chaque ligne reprend sa catégorie, et
   * seules celles qui entrent dans la vue ou en sortent passent par l'arbre.
   * Les notes ne changent pas, donc les places des autres non plus.
   */
  *refiltrerEtapes(filtre: FiltreLignes, categories?: Uint8Array): Generator<void> {
    // `categories` : celles qu'un aperçu a déjà jugées sous ce même filtre, sur ce même magasin.
    this.filtre = filtre; this.categoriesFiables = false;
    const arbre = this.ordreDeReference === undefined;
    for (let i = 0; i < this.magasin.longueur; i++) {
      if (this.categories[i] === NON_JUGEE) continue;
      const avant = this.membre(i);
      this.classer(i, categories?.[i]);
      const apres = this.membre(i);
      if (arbre && avant !== apres) { if (avant) this.ordre.retirer(i); else this.ordre.inserer(i); }
      if ((i & 63) === 0) yield;
    }
    if (this.referenceComplete) this.ordreDeReference = this.referenceComplete.filter((i) => this.membre(i));
    this.categoriesFiables = true;
  }
  /**
   * La vue que l'index publiera une fois sa tâche finie, sans toucher à
   * l'arbre : catégories et comptes sous `filtre`, et les confirmées de la vue
   * dans l'ordre de l'arbre. `nouvelles` : les notes d'un autre critère (notes
   * de base de ce critère, note d'une ligne résolue) ; `null` : les notes et
   * l'ordre de base actuels. `null` rendu : l'équivalence n'est pas établie
   * (cache écrit depuis la dernière actualisation, ingestion interrompue,
   * note non finie ou absente parmi des présentes, relique hors contrat), la
   * vue attend la fin de la tâche.
   */
  *apercuEtapes(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, filtre: FiltreLignes,
    nouvelles: NotesDeLApercu | null): Generator<void, ApercuClassement | null> {
    if (this.ingestionEnCours || !this.memeCache(cache, journal)) return null;
    if (nouvelles === null ? !this.notesFiables || this.nonFinis > 0 || this.ordreDeReference !== undefined : nouvelles.nonFini) return null;
    const n = this.magasin.longueur;
    let categories: Uint8Array, compteurs: Float64Array;
    if (filtre.cle === this.filtre.cle && this.categoriesFiables) {
      categories = this.categories.slice(); compteurs = this.compteurs.slice();
    } else {
      categories = new Uint8Array(n); compteurs = new Float64Array(3 * NOMBRE_CATEGORIES);
      for (let i = 0; i < n; i++) {
        const etat = this.magasin.etat(i);
        const c = etat === 2 ? CATEGORIE_LIGNE.ecartee : filtre.juger(i, etat as 0 | 1);
        categories[i] = c; compteurs[etat * NOMBRE_CATEGORIES + c]++;
        if ((i & 63) === 0) yield;
      }
    }
    // La note de chaque ligne résolue sous le nouveau critère : celle que `noter` lui donnera.
    const notesResolues = new Map<number, number | null>();
    const confirmees: number[] = [];
    let total = 0, presentes = 0, absentes = 0;
    for (let i = 0; i < n; i++) {
      const etat = this.magasin.etat(i);
      let present: boolean;
      if (nouvelles === null) present = this.notesPresentes[i] === 1;
      else if (etat === 1) {
        // Comme `nonFini` : toute ligne non écartée compte, dans la vue ou non.
        const note = nouvelles.score(this.magasin.candidat(i)), rid = this.magasin.rid(i);
        if ((note !== null && !Number.isFinite(note)) || (rid !== undefined && (!Number.isSafeInteger(rid) || rid < 0))) return null;
        notesResolues.set(i, note); present = note !== null;
        yield;
      } else present = nouvelles.calculable;
      if (dansLaVue(categories[i])) {
        total++;
        if (present) presentes++; else absentes++;
        if (etat === 1) confirmees.push(i);
      }
      if ((i & 63) === 0) yield;
    }
    // Des notes présentes et absentes ensemble : le comparateur n'est plus symétrique, l'arbre dépend de l'ordre d'insertion.
    if (presentes && absentes) return null;
    const avecNote = presentes > 0;
    const comparer = nouvelles === null ? (a: number, b: number) => this.comparer(a, b) : (a: number, b: number) => {
      this.travail.comparaisons++;
      const note = avecNote ? notesResolues.get(b)! - notesResolues.get(a)! : 0;
      if (note) return note;
      const ra = this.magasin.rid(a) ?? Infinity, rb = this.magasin.rid(b) ?? Infinity;
      if (ra !== rb) return ra - rb;
      // La position dans l'ordre de base à venir : le tri stable de ces notes de base, note décroissante puis ordinal.
      return this.magasin.rangCle(a) - this.magasin.rangCle(b) || nouvelles.notes[b] - nouvelles.notes[a] || a - b;
    };
    const ordre = yield* trierIndicesEtapes(Uint32Array.from(confirmees), comparer);
    return { parCategorie: [0, 1, 2].map((etat) => Array.from(compteurs.subarray(etat * NOMBRE_CATEGORIES, (etat + 1) * NOMBRE_CATEGORIES))),
      total, confirmes: confirmees.length, confirmees: Array.from(ordre), categories, cacheVide: cache.size === 0, cleFiltre: filtre.cle };
  }
  /**
   * Cache vide : les lignes de la vue de l'aperçu de rang `debut` à
   * `debut + taille − 1` dans l'ordre de base — l'actuel (`notes` nul), ou
   * celui de ces notes de base (finies), note décroissante puis ordinal, par
   * une sélection des `debut + taille` premières sans trier les autres.
   */
  teteDeLApercu(apercu: ApercuClassement, notes: Float64Array | null, debut: number, taille: number): number[] {
    const k = debut + taille, membre = (i: number) => dansLaVue(apercu.categories[i]);
    if (notes === null) {
      const tete: number[] = [];
      for (let r = 0; r < this.ordreBase.length && tete.length < k; r++) if (membre(this.ordreBase[r])) tete.push(this.ordreBase[r]);
      return tete.slice(debut);
    }
    // Tas des k meilleures, la moins bonne à la racine.
    const avant = (a: number, b: number) => notes[a] > notes[b] || (notes[a] === notes[b] && a < b);
    const tas: number[] = [];
    const descendre = (p: number) => {
      for (;;) {
        const g = 2 * p + 1, d = g + 1;
        let pire = p;
        if (g < tas.length && avant(tas[pire], tas[g])) pire = g;
        if (d < tas.length && avant(tas[pire], tas[d])) pire = d;
        if (pire === p) return;
        [tas[p], tas[pire]] = [tas[pire], tas[p]]; p = pire;
      }
    };
    for (let i = 0; i < this.magasin.longueur && k > 0; i++) {
      if (!membre(i)) continue;
      if (tas.length < k) {
        tas.push(i);
        for (let p = tas.length - 1; p > 0;) { const q = (p - 1) >> 1; if (!avant(tas[q], tas[p])) break; [tas[p], tas[q]] = [tas[q], tas[p]]; p = q; }
      } else if (avant(i, tas[0])) { tas[0] = i; descendre(0); }
    }
    return tas.sort((a, b) => (avant(a, b) ? -1 : 1)).slice(debut);
  }
  /** Le filtre que l'index applique (sa clé dit si une vue doit reclasser). */
  get cleFiltre(): string { return this.filtre.cle; }
  /** L'ordre de base de la vue (cache vide) : les lignes de la vue, dans l'ordre de base. */
  private ordreBaseDeLaVue(): Uint32Array {
    let horsDeLaVue = 0;
    for (let k = 0; k < this.compteurs.length; k++) if (!dansLaVue(k % NOMBRE_CATEGORIES)) horsDeLaVue += this.compteurs[k];
    if (horsDeLaVue === 0) return this.ordreBase;
    if (this.baseDeLaVue?.version !== this.versionVue || this.baseDeLaVue.source !== this.ordreBase) {
      this.baseDeLaVue = { version: this.versionVue, source: this.ordreBase, ordre: this.ordreBase.filter((i) => this.membre(i)) };
    }
    return this.baseDeLaVue.ordre;
  }
  invalider(): void { this.contexte = {}; this.notesFiables = false; }
  page(debut: number, taille: number): number[] {
    if (this.cacheVide) return Array.from(this.ordreBaseDeLaVue().slice(debut, debut + taille));
    return this.ordreDeReference?.slice(debut, debut + taille) ?? this.ordre.page(debut, taille);
  }
  comptes(): { total: number; confirmes: number; potentiels: number } {
    if (!this.ordreDeReference) return this.ordre.comptes();
    const confirmes = this.ordreDeReference.reduce((n, i) => n + Number(this.magasin.etat(i) === 1), 0);
    return { total: this.ordreDeReference.length, confirmes, potentiels: this.ordreDeReference.length - confirmes };
  }
  note(i: number): number | null { return this.notesPresentes[i] ? this.notes[i] : null; }
  categorie(i: number): number { return this.categories[i]; }
  /** Lignes reçues par état (0 non vérifiée, 1 vérifiée conforme, 2 écartée) et par catégorie : `[état][catégorie]`. */
  comptesParCategorie(): number[][] {
    return [0, 1, 2].map((etat) => Array.from(this.compteurs.subarray(etat * NOMBRE_CATEGORIES, (etat + 1) * NOMBRE_CATEGORIES)));
  }
  /** Les confirmées de rang `debut` à `debut + taille − 1` parmi les confirmées, dans l'ordre du classement. */
  pageConfirmees(debut: number, taille: number): number[] {
    if (this.cacheVide) return [];
    if (this.ordreDeReference) return this.ordreDeReference.filter((i) => this.magasin.etat(i) === 1).slice(debut, debut + taille);
    return this.ordre.page(debut, taille, 'confirmes');
  }
  enAttente(taille: number): number[] {
    if (this.cacheVide) return Array.from(this.ordreBaseDeLaVue().slice(0, taille));
    if (this.ordreDeReference) return this.ordreDeReference.filter((i) => this.magasin.etat(i) === 0).slice(0, taille);
    return this.ordre.page(0, taille, 'potentiels');
  }
  definirOrdreBase(ordre: Uint32Array): void {
    terminerEtapes(this.definirOrdreBaseEtapes(ordre));
  }
  *definirOrdreBaseEtapes(ordre: Uint32Array): Generator<void> {
    // `rangBase` départage l'arbre : jusqu'à la prochaine actualisation, il ne vaut plus.
    this.notesFiables = false;
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
  /**
   * Le sens du tri ; absent = décroissant. Croissant : seul le comparateur
   * de note s'inverse (`noteDansLeSens`), le départage reste le même. Le fond
   * de la file garde l'objectif lancé, décroissant.
   */
  sens?: SensTri;
  metric: OptimMetric;
  page: number;
  /**
   * Les filtres d'affichage : un minimum et un maximum par colonne, `null` ou
   * absent = sans borne (filtresResultats.ts). Absent = aucune borne. Ils
   * masquent sans rien perdre : ni note, ni cache, ni résolution.
   */
  bornes?: BornesResultats;
  /**
   * Le réglage d'application « afficher au-delà du plafond » (absent = vrai,
   * son défaut). Masqué, une borne de Taux Crit, RES ou Précision compare ce
   * que le panneau de stats écrit, au plus 100 (`displayedTotal`).
   */
  afficherDepassement?: boolean;
  /**
   * Les onze valeurs sur chaque carte publiée, PV effectifs et Dégâts réels
   * compris (le tableau des résultats) ; absent = seulement celles que la
   * carte écrit (`objectifsMontres`). Ne change ni l'ordre ni les bornes.
   */
  colonnesCompletes?: boolean;
}
const sensDe = (vue: VueClassement): SensTri => vue.sens ?? SENS_PAR_DEFAUT;
const depassementDe = (vue: VueClassement): boolean => vue.afficherDepassement ?? true;
/** Ce qui décide des catégories : les bornes, et le dépassement seulement sous une borne plafonnée. */
const cleDesBornes = (bornes: EtatBornes, afficherDepassement: boolean) =>
  JSON.stringify([bornes.actives, bornes.contradictoires, bornes.actives.some((b) => CAPPED_STATS.has(b.colonne as StatKey)) ? afficherDepassement : null]);
/** Critère, mesure et sens d'un ordre de base ; leur clé nomme ses notes. */
type CritereDeBase = [StatKey | Objective, OptimMetric, SensTri];
const cleCritere = (critere: StatKey | Objective, metric: OptimMetric, sens: SensTri) => `${critere}|${metric}|${sens}`;
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
/**
 * Les comptes sous les bornes de la vue. Globaux : ceux de la recherche, que
 * les bornes ne changent pas ; sans file, tout reçu non écarté compte comme
 * confirmé (ses valeurs sont définitives). De la vue : les catégories de
 * `CATEGORIE_LIGNE`. Identités : visibles + masqués + indéterminés =
 * confirmés globaux ; potentiels + non vérifiés masqués = non vérifiés
 * globaux ; confirmés + non vérifiés + écartés = reçus.
 */
export interface ComptesDeLaVue {
  /** Candidats reçus du moteur jusqu'ici (tout le flux, au-delà de l'aperçu). */
  trouvesMoteur: number;
  /** Reçus classés par la vue : l'aperçu, puis tous. */
  recusActifs: number;
  ecartesResolution: number;
  confirmesGlobaux: number;
  nonVerifiesGlobaux: number;
  visiblesConfirmes: number;
  masquesConfirmes: number;
  potentielsNonVerifies: number;
  /** Non vérifiés en échec démontré sur une colonne que la résolution ne change pas. */
  masquesNonVerifies: number;
  indeterminesNumeriques: number;
}
export interface FiltrePublie {
  bornes: { actives: ColonneResultat[]; inactives: ColonneResultat[]; contradictoires: ColonneResultat[] };
  comptes: ComptesDeLaVue;
  /** Pages de la vue filtrée, règle des confirmées (`compteConfirmeDesComptes`). */
  pages: number;
  /**
   * `bornes-contradictoires` : un minimum dépasse son maximum ;
   * `aucune-sous-filtre` : recherche scellée, ni potentiel ni indéterminé,
   * au moins un build masqué. Jamais « aucune combinaison » de la recherche.
   */
  vide: 'bornes-contradictoires' | 'aucune-sous-filtre' | null;
}
/** Tout ce que la page reçoit : jamais un objet ni un ordinal par build trouvé. */
export interface InstantaneClassement {
  versions: VersionsClassement;
  vue: VueClassement;
  comptes: ComptesClassement;
  filtre: FiltrePublie;
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

/** Un critère déjà noté sur une population : ses notes de base, et son ordre une fois rangé. */
type EntreeDeBase = NotesDeCritere & { cle: string; ordre: Uint32Array | null };
/** Critères quittés gardés en plus de l'objectif lancé et de la vue : ~12 octets par candidat chacun. */
const CRITERES_QUITTES_GARDES = 4;
/** Les objectifs notés en temps mort, décroissants, sous la mesure de la vue, et gardés comme la vue (~8 octets par candidat chacun). */
const OBJECTIFS_AU_REPOS: readonly ColonneResultat[] = ['degats_reels', 'ehp', 'efficience'];

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
  // Les bornes de la vue, validées et rangées ; inactives sur une colonne sans valeur.
  private bornes: EtatBornes = AUCUNE_BORNE;
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
  // Les notes et ordres de base déjà calculés sur l'index courant, par critère
  // (`tri|mesure|sens`) : ils ne lisent que les candidats collectés et le
  // contexte photographié, sans cache. L'objectif lancé (l'ordre du fond) et
  // la vue courante sont toujours gardés, avec les derniers critères quittés.
  private ordresDeBase: { index: ClassementCompact | null; entrees: EntreeDeBase[] } = { index: null, entrees: [] };
  // La page d'un geste de tri ou de bornes, publiable avant la fin de sa
  // tâche : valable pour l'index et la clé de vue (critère et bornes) qui
  // l'ont produite, quelle que soit la page.
  private apercu: { index: ClassementCompact; cle: string; donnees: ApercuClassement; notes: Float64Array | null; enAttente: number } | null = null;
  // Les notes d'un objectif en cours de préparation en temps mort, et les critères dont une note a levé.
  private repos: { index: ClassementCompact; cle: string; etapes: Generator<void, NotesDeCritere> } | null = null;
  private reposAbandonnes = new Set<string>();
  // Vrai seulement entre la pompe qui trouve la file au repos et le prochain message ou geste.
  private fileAuRepos = false;

  constructor(private readonly sorties: {
    publier: (p: InstantaneClassement) => void;
    resoudre: (m: MessageVersResolution) => void;
    incident: (raison: string, detail: unknown) => void;
  }, private readonly differe = false, modeResolution: 'distante' | 'directe' = 'distante') {
    this.repli = modeResolution === 'directe';
  }

  get travailEnCours() { return this.tache !== null; }
  /**
   * Une tranche du Worker : la tâche par pas, visée 4 ms, puis la pompe
   * (file et publication) ; la tâche finie, le travail au fil des blocs, puis
   * le temps mort, dans ce qui reste d'au plus 1 ms. Vrai s'il reste du
   * travail : le Worker relance une tranche par message de canal, derrière
   * les messages déjà reçus (annulation, crédits, réponses du résolveur).
   * `maintenant` : l'horloge, `performance.now` dans le Worker.
   */
  tranche(maintenant: () => number): boolean {
    const limite = maintenant() + 4;
    do { this.avancer(); } while (this.travailEnCours && maintenant() < limite);
    this.pomper(maintenant());
    if (!this.travailEnCours) {
      const fin = Math.min(limite, maintenant() + 1);
      while (this.avancerAuFil() && maintenant() < fin) { /* tranche au fil des blocs */ }
      while (maintenant() < fin && this.avancerAuRepos()) { /* tranche du temps mort */ }
    }
    return this.travailEnCours || this.travailEnRepli || this.travailAuFil || this.travailAuRepos;
  }
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
    this.ordresDeBase = { index: null, entrees: [] }; this.apercu = null; this.repos = null; this.reposAbandonnes = new Set(); this.fileAuRepos = false;
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
  /** Le fond suit l'objectif lancé, décroissant ; une vue croissante a son propre ordre de base. */
  private vueSuitLeLancement(vue: VueClassement): boolean {
    return vue.tri === this.triDuLancement() && vue.metric === this.contexte?.recherche.metric && sensDe(vue) === SENS_PAR_DEFAUT;
  }
  private courant(idRecherche: number) { return this.contexte !== null && idRecherche === this.versions.idRecherche; }
  private criteresDeBase(): CritereDeBase[] {
    if (!this.contexte || !this.vue) return [];
    const lance: CritereDeBase = [this.triDuLancement(), this.contexte.recherche.metric, SENS_PAR_DEFAUT];
    return this.vueSuitLeLancement(this.vue) ? [lance] : [[this.vue.tri, this.vue.metric, sensDe(this.vue)], lance];
  }
  private ordreAuFil(critere: StatKey | Objective, metric: OptimMetric, sens: SensTri): OrdreAuFil {
    const cle = cleCritere(critere, metric, sens);
    let ordre = this.auFil.find((o) => o.cle === cle);
    if (!ordre) {
      ordre = new OrdreAuFil(cle, critere, optionsDuContexte(this.contexte!, null, metric), this.flux, this.travail, sens);
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
    for (const [critere, metric, sens] of this.criteresDeBase()) if (this.ordreAuFil(critere, metric, sens).avancer()) return true;
    return this.auFilEnAttente = false;
  }
  /**
   * Un objectif à noter en temps mort sur la population scellée : Dégâts
   * réels, PV effectifs et Efficience, chers à noter, que le tri d'une
   * colonne jamais notée attendrait avant sa page. Une stat se lit dans sa
   * colonne, elle n'en a pas besoin.
   */
  private critereAuRepos(): { critere: ColonneResultat; cle: string } | null {
    const index = this.index, vue = this.vue, contexte = this.contexte;
    if (!index || !vue || !contexte || !this.collecteScellee || this.tache || index.magasin.longueur !== this.nombreCible) return null;
    for (const critere of OBJECTIFS_AU_REPOS) {
      if (!colonneDisponible(critere, contexte.realDamage)) continue;
      const cle = cleCritere(critere, vue.metric, SENS_PAR_DEFAUT);
      const connue = this.ordresDeBase.index === index && this.ordresDeBase.entrees.some((e) => e.cle === cle);
      if (!connue && !this.reposAbandonnes.has(cle)) return { critere, cle };
    }
    return null;
  }
  /** Des notes de base restent à préparer en temps mort. */
  get travailAuRepos(): boolean {
    return this.fileAuRepos && ((this.repos !== null && this.repos.index === this.index) || this.critereAuRepos() !== null);
  }
  /**
   * Un pas du temps mort : une note de base d'un objectif jamais noté, la
   * même que la tâche d'un tri calculerait (mêmes candidats collectés, même
   * contexte photographié, sans cache). Faux quand il n'y a rien à faire. Le
   * Worker ne l'appelle qu'après sa tâche, sa file et le travail au fil.
   */
  avancerAuRepos(): boolean {
    // La file d'abord : réponses traitées, crédits rendus, plus rien à vérifier.
    if (this.tache || !this.fileAuRepos) return false;
    const index = this.index;
    if (this.repos && this.repos.index !== index) this.repos = null;
    if (!this.repos) {
      const prochain = this.critereAuRepos();
      if (!prochain || !index) return false;
      const source = candidatsParIndice(index.magasin.longueur, (i) => index.magasin.candidat(i, false));
      this.repos = { index, cle: prochain.cle,
        etapes: notesDeCollecteEtapes(source, prochain.critere, optionsDuContexte(this.contexte!, null, this.vue!.metric), this.travail) };
    }
    const repos = this.repos;
    let pas: IteratorResult<void, NotesDeCritere>;
    try {
      pas = repos.etapes.next();
    } catch {
      // Une note qui lève lèvera aussi dans la tâche d'un tri, qui la signale : rien n'est gardé.
      this.reposAbandonnes.add(repos.cle); this.repos = null;
      return true;
    }
    if (pas.done) {
      this.repos = null;
      // Une tâche a pu noter ce critère entre-temps : la sienne reste.
      if (!this.ordresDeBase.entrees.some((e) => e.cle === repos.cle)) this.garderEntree(repos.index, { ...pas.value, cle: repos.cle, ordre: null });
    }
    return true;
  }
  private *notesConnues(critere: StatKey | Objective, metric: OptimMetric, sens: SensTri, n: number): Generator<void, NotesConnues | undefined> {
    // Source libérée après le scellé : l'ordre se refait sur le magasin, comme avant.
    if (this.collecteScellee && !this.lots.length) return undefined;
    const ordre = this.ordreAuFil(critere, metric, sens);
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
    const realDamage = this.contexte.realDamage;
    const bornes = etatDesBornes(vue.bornes, (c) => colonneDisponible(c, realDamage));
    const avant = this.vue;
    // Le réglage du dépassement ne compte que sous une borne de Taux Crit, RES ou Précision.
    const autresBornes = avant !== null && cleDesBornes(bornes, depassementDe(vue)) !== cleDesBornes(this.bornes, depassementDe(avant));
    // Le régime suit l'objectif photographié : seule l'ouverture le pose.
    const entrees = avant ? this.entrees : resolutionDuContexte(this.contexte);
    if (!avant && entrees) {
      this.entrees = entrees; this.versions.idContexteResolution = compteurSuivant(this.versions.idContexteResolution);
      this.signature = JSON.stringify([this.contexte.idInventaire, this.contexte.idEspece, this.contexte.signature, this.contexte.recherche.relicContext?.empreinte, entrees?.regime]);
    }
    // Tri, sens ou mesure : un autre classement.
    const autreCritere = !avant || avant.tri !== vue.tri || avant.metric !== vue.metric || sensDe(avant) !== sensDe(vue);
    // Des bornes, comme un tri, ne demandent aucune page : seule la navigation en demande une.
    if (!avant) this.pagePrioritaire = true;
    else if (autreCritere || autresBornes) this.pagePrioritaire = false;
    else if (avant.page !== vue.page || avant.pageImprimee !== vue.pageImprimee) this.pagePrioritaire = true;
    this.vue = { ...vue, ...(vue.bornes ? { bornes: copierBornes(vue.bornes) } : {}) };
    this.bornes = bornes; this.versions.idVue = idVue; this.versions.idDemande = idDemande;
    if (autreCritere) {
      // Le critère quitté ne sert plus ; le nouveau se prépare sur tout le reçu.
      const cles = new Set(this.criteresDeBase().map(([c, m, s]) => cleCritere(c, m, s)));
      this.auFil = this.auFil.filter((o) => cles.has(o.cle)); this.auFilEnAttente = this.flux.longueur > 0;
    }
    if (!this.contexte.toutVerifier) this.fileExhaustive = null;
    if (autreCritere) this.trierBase();
    else if (autresBornes) this.refiltrer();
    // Un geste de vue se publie dès que son instantané est prêt (fin du tri
    // éventuel), sans attendre les 400 ms du fond : retenu, il n'attendrait que
    // le prochain message du résolveur, et l'écran garderait l'ancienne page
    // sous le nouveau numéro. Une publication par geste, que la cadence suit.
    // Une page demandée peut remettre la file au travail : la prochaine pompe en juge.
    this.sale = true; this.publicationForcee = true; this.fileAuRepos = false;
  }
  private trierBase(): void {
    if (!this.contexte || !this.vue) return;
    this.apercu = null;
    this.index?.invalider();
    this.programmer(this.trierBaseEtapes());
  }
  /**
   * D'autres bornes, mêmes notes : l'index reclasse ses lignes sans rien
   * renoter ni résoudre. Une tâche en cours (tri, actualisation), ou un cache
   * écrit depuis la dernière actualisation, fait reprendre la vue entière,
   * sous les nouvelles bornes.
   */
  private refiltrer(): void {
    if (!this.contexte || !this.vue) return;
    const index = this.index;
    if (this.tache || (index && !index.aJour(this.cacheLecture(), this.cache.journal))) { this.trierBase(); return; }
    if (!index) return;
    this.apercu = null;
    this.programmer(this.refiltrerEtapes(index));
  }
  private *refiltrerEtapes(index: ClassementCompact): Generator<void> {
    const filtre = this.filtreLignes(index);
    // La page sous les nouvelles bornes, dans l'ordre courant, avant de toucher à l'arbre.
    const donnees = this.differe ? yield* this.apercuEtapes(index, filtre, null, null) : null;
    yield* index.refiltrerEtapes(filtre, donnees?.categories);
    this.apercu = null;
    this.sale = true;
  }
  /** La clé qui dit si un aperçu vaut pour cette vue : critère, sens, mesure et bornes, jamais la page. */
  private cleDeLaVue(vue: VueClassement): string {
    return JSON.stringify([vue.tri, vue.metric, sensDe(vue), cleDesBornes(this.bornes, depassementDe(vue))]);
  }
  /**
   * L'aperçu de la vue courante : la page qu'elle publiera, calculée sans
   * l'ordre complet. `deLaVue` : les notes de base d'un nouveau critère ;
   * `null` : celles de l'index. Rien quand l'équivalence n'est pas établie.
   */
  private *apercuEtapes(index: ClassementCompact, filtre: FiltreLignes, deLaVue: EntreeDeBase | null, notes: NotesDeLApercu | null): Generator<void, ApercuClassement | null> {
    const contexte = this.contexte!, vue = this.vue!;
    const lance = this.entreeDeBase(index, cleCritere(this.triDuLancement(), contexte.recherche.metric, SENS_PAR_DEFAUT));
    if (!lance?.ordre) return null;
    const donnees = yield* index.apercuEtapes(this.cacheLecture(), this.cache.journal, filtre, notes);
    if (donnees) this.apercu = { index, cle: this.cleDeLaVue(vue), donnees, notes: deLaVue?.notes ?? null, enAttente: this.enAttenteDuFond(index, lance.ordre) };
    return donnees;
  }
  /**
   * Ce que `restants` comptera après la tâche, sans page demandée : le fond
   * (l'ordre de l'objectif lancé) jusqu'à K confirmées et à vérifier, groupes
   * distincts ; en vérification exhaustive, les groupes non vérifiés.
   */
  private enAttenteDuFond(index: ClassementCompact, fond: Uint32Array): number {
    if (!this.entrees || !this.contexte) return 0;
    const K = cibleDeLaFile({ relicContext: this.contexte.recherche.relicContext, toutVerifier: this.contexte.toutVerifier });
    if (K === Infinity) {
      let n = 0;
      for (const g of index.magasin.chefs()) if (index.magasin.etat(g) === 0) n++;
      return n;
    }
    const groupes = new Set<number>();
    let confirmees = 0, aVerifier = 0;
    for (let j = 0; j < fond.length && confirmees + aVerifier < K; j++) {
      const i = fond[j], etat = index.magasin.etat(i);
      if (etat === 0) { aVerifier++; groupes.add(index.magasin.groupe(i)); } else if (etat === 1) confirmees++;
    }
    return groupes.size;
  }
  /** L'entrée gardée d'un critère sur cet index, remise en dernier (la plus récente). */
  private entreeDeBase(index: ClassementCompact, cle: string): EntreeDeBase | undefined {
    if (this.ordresDeBase.index !== index) return undefined;
    const entrees = this.ordresDeBase.entrees, k = entrees.findIndex((e) => e.cle === cle);
    if (k < 0) return undefined;
    const [entree] = entrees.splice(k, 1);
    entrees.push(entree);
    return entree;
  }
  private garderEntree(index: ClassementCompact, entree: EntreeDeBase): void {
    if (this.ordresDeBase.index !== index) this.ordresDeBase = { index, entrees: [] };
    const entrees = this.ordresDeBase.entrees.filter((e) => e.cle !== entree.cle);
    entrees.push(entree);
    const vue = this.vue, lance = this.contexte ? cleCritere(this.triDuLancement(), this.contexte.recherche.metric, SENS_PAR_DEFAUT) : '';
    // Les objectifs du temps mort aussi : oubliés, ils se reprépareraient aussitôt.
    const gardees = new Set([lance, vue ? cleCritere(vue.tri, vue.metric, sensDe(vue)) : '',
      ...(vue ? OBJECTIFS_AU_REPOS.map((c) => cleCritere(c, vue.metric, SENS_PAR_DEFAUT)) : [])]);
    let quittes = entrees.filter((e) => !gardees.has(e.cle)).length;
    this.ordresDeBase.entrees = entrees.filter((e) => gardees.has(e.cle) || quittes-- <= CRITERES_QUITTES_GARDES);
  }
  /**
   * Les notes de base d'un critère sur cet index : gardées, opposées depuis
   * le sens contraire (la note croissante est la note décroissante × −1,
   * `noteDansLeSens`, quand aucune n'est absente), ou calculées — une stat se
   * lit dans sa colonne (`statTotal` lit le même nombre), les notes au fil
   * des blocs servent encore.
   */
  private *notesDeBaseEtapes(index: ClassementCompact, source: ArrayLike<BuildCandidate>, critere: StatKey | Objective, metric: OptimMetric,
    sens: SensTri): Generator<void, { entree: EntreeDeBase; connues: NotesConnues | undefined }> {
    const cle = cleCritere(critere, metric, sens);
    const gardee = this.entreeDeBase(index, cle);
    if (gardee) return { entree: gardee, connues: undefined };
    const oppose = this.entreeDeBase(index, cleCritere(critere, metric, sens === 'asc' ? 'desc' : 'asc'));
    if (oppose && (!oppose.calculable || !oppose.nulles)) {
      const entree: EntreeDeBase = { ...oppose, cle, ordre: null, notes: oppose.calculable ? oppose.notes.map((x) => x * -1) : oppose.notes };
      this.garderEntree(index, entree);
      return { entree, connues: undefined };
    }
    const connues = yield* this.notesConnues(critere, metric, sens, source.length);
    const lireStat = estColonneDeStat(critere as ColonneResultat) ? (i: number) => index.magasin.totalDeLaStat(i, critere, false) : undefined;
    const notes = yield* notesDeCollecteEtapes(source, critere, optionsDuContexte(this.contexte!, null, metric), this.travail, connues, sens, lireStat);
    const entree: EntreeDeBase = { ...notes, cle, ordre: null };
    this.garderEntree(index, entree);
    return { entree, connues };
  }
  private *ordreDeBaseEtapes(entree: EntreeDeBase, connues: NotesConnues | undefined): Generator<void, Uint32Array> {
    entree.ordre ??= yield* rangerNotesEtapes(entree, this.travail, connues);
    return entree.ordre;
  }
  /** Le candidat tel que sa carte le montre : les stats de sa vraie paire quand la file l'a résolu. */
  private ligneAffichee(index: ClassementCompact, i: number): { candidat: BuildCandidate; resultat: ResultatArtefacts | null } {
    const brut = index.magasin.candidat(i, false);
    const resultat = this.entrees !== null ? this.cache.get(cleBuild(brut)) ?? null : null;
    return { candidat: resultat ? { ...brut, stats: resultat.stats } : brut, resultat };
  }
  /** Le filtre des bornes de la vue sur cet index : la valeur que la carte écrit, avec les options du classement affiché. */
  private filtreLignes(index: ClassementCompact): FiltreLignes {
    const contexte = this.contexte!, vue = this.vue!, bornes = this.bornes, avecFile = this.entrees !== null;
    const options = optionsDuContexte(contexte, this.cache, vue.metric);
    const afficherDepassement = depassementDe(vue);
    return filtreDesLignes({ bornes, avecFile, cle: JSON.stringify([cleDesBornes(bornes, afficherDepassement), avecFile, vue.metric]),
      candidat: (i) => this.ligneAffichee(index, i).candidat, valeur: (colonne, c) => valeurAffichee(colonne, c, options, afficherDepassement),
      // Une stat se lit dans le magasin, qui porte les stats de la vraie paire d'une ligne vérifiée (`ligneAffichee`) :
      // l'index ne juge une ligne qu'une fois son équipement ingéré, et un cache écrit depuis fait reclasser toute la vue.
      valeurDirecte: (colonne, i) => estColonneDeStat(colonne)
        ? valeurAfficheeDeStat(colonne, index.magasin.totalDeLaStat(i, colonne, avecFile), afficherDepassement) : undefined });
  }
  private *trierBaseEtapes(): Generator<void> {
    if (!this.contexte || !this.vue) return;
    let index = this.index;
    const neuf = !index || index.magasin.longueur !== this.nombreCible;
    if (!index || neuf) {
      const source = candidatsParIndice(this.nombreCible, (i) => this.flux.lire(i));
      index = new ClassementCompact(source, undefined, true);
      yield* index.magasin.initialiser(source);
    }
    const indexTrie = index;
    const source = candidatsParIndice(index.magasin.longueur, (i) => indexTrie.magasin.candidat(i, false));
    const vue = this.vue, contexte = this.contexte, sens = sensDe(vue);
    const deLaVue = yield* this.notesDeBaseEtapes(index, source, vue.tri, vue.metric, sens);
    // La page d'abord, sur ces notes : l'ordre complet suit, dans la même tâche.
    if (this.differe && !neuf) {
      const options = optionsDuContexte(contexte, this.cache, vue.metric), tri = vue.tri;
      yield* this.apercuEtapes(index, this.filtreLignes(index), deLaVue.entree, { notes: deLaVue.entree.notes, calculable: deLaVue.entree.calculable,
        nonFini: deLaVue.entree.nonFini, score: (c) => noteDansLeSens(scoreDuCandidat(c, tri, options), sens) });
    }
    const base = yield* this.ordreDeBaseEtapes(deLaVue.entree, deLaVue.connues);
    index.definirNotesDeBase(cleCritere(vue.tri, vue.metric, sens), deLaVue.entree.notes, deLaVue.entree.calculable);
    yield* index.definirOrdreBaseEtapes(base);
    let fond = base;
    if (!this.vueSuitLeLancement(vue)) {
      // L'objectif lancé déjà rangé sur cet index n'est jamais recalculé.
      const lance = yield* this.notesDeBaseEtapes(index, source, this.triDuLancement(), contexte.recherche.metric, SENS_PAR_DEFAUT);
      fond = yield* this.ordreDeBaseEtapes(lance.entree, lance.connues);
      this.fondPropre = { index, ordre: fond };
    } else this.fondPropre = null;
    yield* this.actualiserEtapes(index, fond);
    this.index = index; this.base = base;
    this.visites = new Uint32Array(index.magasin.longueur); this.passage = 0;
    this.apercu = null;
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
    const { tri, metric } = this.vue, sens = sensDe(this.vue);
    yield* index.actualiserEtapes(this.cacheLecture(), this.cache.journal, `${this.versions.idRecherche}:${cleCritere(tri, metric, sens)}:${this.versions.idContexteResolution}`,
      (c) => noteDansLeSens(scoreDuCandidat(c, tri, options), sens), cleCritere(tri, metric, sens), this.filtreLignes(index));
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
    this.fileAuRepos = false;
    // Pendant la tâche d'un geste, seule sa page déjà prête peut partir.
    if (this.tache) { this.publierApercu(maintenant); return; }
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
    // Le temps mort attend la file au repos : rien à vérifier, aucune demande en vol, aucune réponse retenue.
    this.fileAuRepos = !this.tache && restants.length === 0 && this.pilote.demandesEnVol === 0
      && this.reponsesEnAttente.length === 0 && this.reponsesDirectes.length === 0;
  }
  recevoirResolution(r: ReponseResolution, maintenant: number): void {
    // Une réponse arrivée remet la file au travail jusqu'à la prochaine pompe.
    this.fileAuRepos = false;
    if (this.tache) { this.reponsesEnAttente.push(r); return; }
    this.pilote.surReponse(r, this.ports(maintenant));
  }
  panneResolution(raison: string, detail: unknown): void {
    if (this.repli) return;
    this.sorties.incident(raison, detail);
    this.incident = raison;
    this.reponsesEnAttente = []; this.reponsesDirectes = [];
    this.pilote.renoncer(); this.pilote = new ResolutionDistante(); this.direct = new CorpsResolution(); this.repli = true;
    this.sale = true; this.publicationForcee = true; this.fileAuRepos = false;
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
    this.ordresDeBase = { index: null, entrees: [] }; this.apercu = null; this.repos = null; this.reposAbandonnes = new Set(); this.fileAuRepos = false;
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
  /**
   * La page de l'aperçu, pendant la tâche de son geste : la même
   * publication que celle de fin de tâche (même cadence, même révision).
   */
  private publierApercu(maintenant: number): void {
    if (!this.contexte || !this.vue || !this.sale) return;
    if (!this.publicationForcee && maintenant - this.dernierePublication < 400) return;
    const instantane = this.instantaneDeLApercu();
    if (!instantane) return;
    this.dernierePublication = maintenant; this.sale = false; this.publicationForcee = false;
    this.versions.revisionPubliee = compteurSuivant(this.versions.revisionPubliee);
    this.sorties.publier({ ...instantane, versions: { ...this.versions } });
  }
  /**
   * L'instantané que la vue aura en fin de tâche, lu dans l'aperçu : rien
   * quand il ne vaut pas pour cette vue, ou quand la page demandée attend des
   * non vérifiées (priorité de page), dont l'aperçu ne connaît pas l'ordre.
   */
  private instantaneDeLApercu(): InstantaneClassement | null {
    const a = this.apercu, vue = this.vue, index = this.index;
    if (!a || !vue || !this.contexte || !index || a.index !== index || a.cle !== this.cleDeLaVue(vue)) return null;
    const debut = (vue.page - 1) * TAILLE_PAGE_CLASSEMENT, avecFile = this.entrees !== null, d = a.donnees;
    if (avecFile && this.pagePrioritaire) {
      if (vue.pageImprimee) return null;
      const attendues = Math.min(20, Math.max(0, d.total - debut)), cartes = Math.max(0, Math.min(20, d.confirmes - debut));
      if (attendues > cartes) return null;
    }
    let ordinaux: number[], places = 0;
    if (avecFile) {
      ordinaux = d.cacheVide ? [] : d.confirmees.slice(debut, debut + TAILLE_PAGE_CLASSEMENT);
      places = Math.min(TAILLE_PAGE_CLASSEMENT, Math.max(0, d.total - debut)) - ordinaux.length;
    } else if (d.cacheVide) ordinaux = index.teteDeLApercu(d, a.notes, debut, TAILLE_PAGE_CLASSEMENT);
    else return null;
    return this.composer(index, d.total, d.confirmes, d.parCategorie, ordinaux, places, a.enAttente);
  }
  /** Comptes de l'arbre, confirmées du rang demandé, places attendues : O(log N + 20). */
  private instantane(enAttente: number): InstantaneClassement {
    const vue = this.vue!, index = this.index;
    const debut = (vue.page - 1) * TAILLE_PAGE_CLASSEMENT;
    const { total, confirmes } = index?.comptes() ?? { total: 0, confirmes: 0 };
    const avecFile = this.entrees !== null;
    let ordinaux: number[] = [], places = 0;
    if (index && avecFile) {
      ordinaux = index.pageConfirmees(debut, TAILLE_PAGE_CLASSEMENT);
      places = Math.min(TAILLE_PAGE_CLASSEMENT, Math.max(0, total - debut)) - ordinaux.length;
    } else if (index) ordinaux = index.page(debut, TAILLE_PAGE_CLASSEMENT);
    const parCategorie = index?.comptesParCategorie() ?? [0, 1, 2].map(() => new Array<number>(NOMBRE_CATEGORIES).fill(0));
    return this.composer(index, total, confirmes, parCategorie, ordinaux, places, enAttente);
  }
  /** L'instantané d'une page : ses cartes, ses comptes et ceux de la recherche, une seule écriture. */
  private composer(index: ClassementCompact | null, total: number, confirmes: number, parCategorie: number[][], ordinaux: number[],
    places: number, enAttente: number): InstantaneClassement {
    const contexte = this.contexte!, vue = this.vue!;
    const debut = (vue.page - 1) * TAILLE_PAGE_CLASSEMENT;
    const recus = index?.magasin.longueur ?? 0;
    const avecFile = this.entrees !== null;
    const objectif = contexte.recherche.objective;
    const options = optionsDuContexte(contexte, this.cache, vue.metric);
    // La carte écrit la valeur qui la classe (objectif, tri) ou qu'une borne
    // juge ; le tableau, toutes ses colonnes (`colonnesCompletes`).
    const montres = objectifsMontres(objectif, vue.tri, this.bornes.actives.map((b) => b.colonne));
    const avecEhp = montres.ehp || vue.colonnesCompletes === true;
    const avecDegats = contexte.realDamage !== null && (montres.degats || vue.colonnesCompletes === true);
    const cartes = ordinaux.map((i): CarteClassement => {
      const { candidat, resultat } = this.ligneAffichee(index!, i);
      return { ordinal: i, candidat, resultat,
        pvEffectifs: avecEhp ? scoreDuCandidat(candidat, 'ehp', options) : null,
        degatsReels: avecDegats ? scoreDuCandidat(candidat, 'degats_reels', options) : null };
    });
    // Les comptes de la recherche ne suivent pas les bornes : ceux de la vue vont dans `filtre`.
    const [, confirmees, ecartes] = parCategorie.map((ligne) => ligne.reduce((s, n) => s + n, 0));
    return { versions: { ...this.versions }, vue: { ...vue },
      comptes: { recus, affichables: recus - ecartes, resolus: confirmees + ecartes, confirmees, avecFile },
      filtre: this.filtrePublie(parCategorie, total, confirmes, avecFile, recus),
      page: { premierRang: debut + 1, cartes, placesEnAttente: places }, enAttente, incident: this.incident, bilan: this.bilan };
  }
  private filtrePublie(parCategorie: number[][], total: number, confirmes: number, avecFile: boolean, recus: number): FiltrePublie {
    const [nonVerifies, confirmees, ecartes] = parCategorie.map((ligne) => ligne.reduce((s, n) => s + n, 0));
    const de = (categorie: number) => parCategorie[0][categorie] + parCategorie[1][categorie];
    const comptes: ComptesDeLaVue = {
      trouvesMoteur: this.flux.longueur, recusActifs: recus, ecartesResolution: ecartes,
      // Sans file, l'équipement est celui de la fiche : tout reçu a ses valeurs définitives.
      confirmesGlobaux: avecFile ? confirmees : confirmees + nonVerifies, nonVerifiesGlobaux: avecFile ? nonVerifies : 0,
      visiblesConfirmes: de(CATEGORIE_LIGNE.visible), masquesConfirmes: de(CATEGORIE_LIGNE.masquee),
      potentielsNonVerifies: de(CATEGORIE_LIGNE.potentielle), masquesNonVerifies: de(CATEGORIE_LIGNE.masqueeNonVerifiee),
      indeterminesNumeriques: de(CATEGORIE_LIGNE.indeterminee),
    };
    const b = this.bornes;
    const vide = b.contradictoires.length ? 'bornes-contradictoires'
      : b.actives.length && this.collecteScellee && comptes.visiblesConfirmes + comptes.potentielsNonVerifies + comptes.indeterminesNumeriques === 0
        && comptes.masquesConfirmes + comptes.masquesNonVerifies > 0 ? 'aucune-sous-filtre' : null;
    // La règle des pages des confirmées, sur la vue filtrée : confirmées visibles et potentiels.
    const pages = compteConfirmeDesComptes({ recus: total, resolus: confirmes, confirmees: confirmes, avecFile, trouves: total,
      taillePage: TAILLE_PAGE_CLASSEMENT, termine: false }).pages;
    return { bornes: { actives: b.actives.map((a) => a.colonne), inactives: [...b.inactives], contradictoires: [...b.contradictoires] }, comptes, pages, vide };
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
