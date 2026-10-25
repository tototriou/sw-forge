import { CandidatsCompacts, RecepteurCandidats, ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, terminerEtapes, trierIndicesEtapes, type BlocCandidats } from './candidatsCompacts';
import { AdaptateurClassement } from './adaptateurClassement';
import { cibleDeLaFile, type JournalResolution, type ResultatArtefacts } from './artifactQueue';
import { scoreDuCandidat, type BuildCandidate, type Objective, type OptionsDeClassement } from './runeBuildOptim';
import type { StatKey } from './effects';
import type { OptimMetric } from './runeOptim';
import { CacheResolutionCompact } from './cacheResolutionCompact';
import { optionsDuContexte, resolutionDuContexte, runesDuContexte, type ContexteResultat } from './contexteResultat';
import { runesDuBuild } from './relicQueue';
import { ResolutionDistante, repliSurErreur, type PortsResolutionDistante } from '../workers/resolutionDistante';
import { CorpsResolution, type MessageVersResolution, type ReponseResolution, type EntreesResolutionSerialisables } from '../workers/resolutionBody';
import type { SearchResult } from './runeBuildOptim';

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
  return terminerEtapes(ordreCollecteEtapes(candidats, critere, options));
}

function* ordreCollecteEtapes(candidats: ArrayLike<BuildCandidate>, critere: StatKey | Objective, options: OptionsDeClassement): Generator<void, Uint32Array> {
  const notes = new Float64Array(candidats.length);
  let calculable = false, nonFini = false;
  for (let i = 0; i < candidats.length; i++) {
    const note = scoreDuCandidat(candidats[i], critere, options);
    calculable ||= note !== null;
    notes[i] = note ?? 0; nonFini ||= note !== null && !Number.isFinite(note);
    yield;
  }
  const ordre = Uint32Array.from({ length: candidats.length }, (_, i) => i);
  if (!calculable) return ordre;
  if (nonFini) return Uint32Array.from(Array.from(ordre).sort((a, b) => notes[b] - notes[a]));
  return yield* trierIndicesEtapes(ordre, (a, b) => notes[b] - notes[a]);
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
    terminerEtapes(this.actualiserEtapes(cache, journal, contexte, score));
  }
  *actualiserEtapes(cache: ReadonlyMap<string, ResultatArtefacts>, journal: JournalResolution | undefined, contexte: unknown, score: NoterCompact): Generator<void> {
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
      for (const g of this.magasin.chefs()) { this.magasin.ingerer(g, cache.get(this.magasin.cle(g))); yield; }
      for (let i = 0; i < this.magasin.longueur; i++) { this.noter(i, score); yield; }
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
        for (const i of this.magasin.lignesDuGroupe(g)) { this.noter(i, score); yield; }
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
  tri: StatKey | Objective;
  metric: OptimMetric;
  page: number;
  adapterArtefactsAuTri: boolean;
  toutVerifier: boolean;
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
/** Projection de compatibilité de l'écran ; les données propriétaires restent en colonnes. */
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
export interface PublicationTransport {
  versions: VersionsClassement;
  vue: VueClassement;
  candidats?: BuildCandidate[];
  ordreBase: Uint32Array;
  ordreAffiche: Uint32Array;
  generationCache: number;
  revisionCache: number;
  changements: [string, ResultatArtefacts][];
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
  private candidatsAcquittes = -1;
  private sourceEnVol: (IdentitePublication & { nombre: number }) | null = null;

  constructor(private readonly sorties: {
    publier: (p: PublicationTransport) => void;
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
      resolutionDuContexte(contexte, vue.tri, vue.adapterArtefactsAuTri)?.regime]);
    if (signature !== this.signature) { this.cache = new CacheResolutionCompact(); this.generationCache = compteurSuivant(this.generationCache); }
    this.signature = signature;
    this.abandonnerReponses();
    this.tache = null; this.nombreCible = 0; this.plages = [];
    this.contexte = contexte; this.vue = null; this.flux = new RecepteurCandidats(0); this.lots = [];
    this.index = null; this.fileExhaustive = null; this.base = new Uint32Array(); this.bilan = null; this.collecteScellee = false;
    this.candidatsAcquittes = -1; this.sourceEnVol = null;
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
  private courant(idRecherche: number) { return this.contexte !== null && idRecherche === this.versions.idRecherche; }
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
    this.activer(idRecherche); this.sale = true;
  }
  private libererSourceScellee(): void {
    // Le magasin n'adopte la source qu'une fois sa construction terminée.
    if (this.collecteScellee && this.index?.magasin.longueur === this.nombreCible && !this.tache) { this.flux.liberer(); this.lots = []; }
  }
  changerVue(vue: VueClassement, idVue: number, idDemande: number): void {
    if (!this.contexte || idVue <= this.versions.idVue) return;
    if (!Number.isSafeInteger(idVue) || !Number.isSafeInteger(idDemande) || !Number.isSafeInteger(vue.page) || vue.page < 1) throw new Error('Vue de classement invalide');
    const avant = this.vue;
    const entrees = resolutionDuContexte(this.contexte, vue.tri, vue.adapterArtefactsAuTri);
    if (entrees?.regime !== this.entrees?.regime || (!avant && entrees)) {
      if (avant) { this.cache.clear(); this.generationCache = compteurSuivant(this.generationCache); }
      this.entrees = entrees; this.versions.idContexteResolution = compteurSuivant(this.versions.idContexteResolution);
      this.signature = JSON.stringify([this.contexte.idInventaire, this.contexte.idEspece, this.contexte.signature, this.contexte.recherche.relicContext?.empreinte, entrees?.regime]);
    }
    // Une publication de l'ancienne vue peut être rejetée sans ACK par l'écran.
    this.sourceEnVol = null;
    this.vue = { ...vue }; this.versions.idVue = idVue; this.versions.idDemande = idDemande;
    if (!vue.toutVerifier) this.fileExhaustive = null;
    if (!avant || avant.tri !== vue.tri || avant.metric !== vue.metric || entrees?.regime !== resolutionDuContexte(this.contexte, avant.tri, avant.adapterArtefactsAuTri)?.regime) this.trierBase();
    this.sale = true;
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
    const base = yield* ordreCollecteEtapes(source, this.vue.tri, optionsDuContexte(this.contexte, null, this.vue.metric));
    yield* index.definirOrdreBaseEtapes(base);
    yield* this.actualiserEtapes(index, base);
    this.index = index; this.base = base;
    this.visites = new Uint32Array(index.magasin.longueur); this.passage = 0;
    this.sale = true;
  }
  private cacheLecture(): ReadonlyMap<string, ResultatArtefacts> {
    return this.cache;
  }
  private actualiser(): void {
    if (this.tache || !this.index || !this.contexte || !this.vue) return;
    if ((this.cache.journal?.version ?? -1) === this.versionLue && (!this.vue.toutVerifier || this.selectionExhaustiveCourante())) return;
    this.programmer(this.actualiserEtapes(this.index));
  }
  private *actualiserEtapes(index: ClassementCompact, base = this.base): Generator<void> {
    if (!this.contexte || !this.vue) return;
    const options = optionsDuContexte(this.contexte, this.cache, this.vue.metric);
    yield* index.actualiserEtapes(this.cacheLecture(), this.cache.journal, `${this.versions.idRecherche}:${this.vue.tri}:${this.vue.metric}:${this.versions.idContexteResolution}`,
      (c) => scoreDuCandidat(c, this.vue!.tri, options));
    yield* this.actualiserSelectionEtapes(index, base);
    this.versionLue = this.cache.journal?.version ?? -1;
  }
  private selectionExhaustiveCourante(): boolean {
    const f = this.fileExhaustive;
    return f !== null && f.index === this.index && f.base === this.base && f.generationCache === this.generationCache
      && f.generationJournal === this.cache.journal?.generation && f.version === (this.cache.journal?.version ?? -1);
  }
  private *actualiserSelectionEtapes(index: ClassementCompact, base: Uint32Array): Generator<void> {
    if (!this.vue?.toutVerifier) { this.fileExhaustive = null; return; }
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
      this.fileExhaustive = this.vue?.toutVerifier ? f : null;
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
    if (!this.index || !this.entrees) return [];
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
    if ((this.cache.journal?.version ?? -1) !== this.versionLue || (this.vue.toutVerifier && !this.selectionExhaustiveCourante())) { this.actualiser(); if (this.tache) return []; }
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
    const K = cibleDeLaFile({ relicContext: this.contexte.recherche.relicContext, toutVerifier: this.vue.toutVerifier });
    if (K === Infinity) {
      const f = this.fileExhaustive!;
      // Trois choix au total, page comprise ; au plus trois maillons lus, sauts compris.
      for (let lien = f.premier; lien && premiers.length < 3; lien = f.suivants[lien - 1]) ajouter(f.ordinaux[lien - 1] - 1);
      return candidatsParIndice(f.nombre, (i) => premiers[i] === undefined ? undefined as unknown as BuildCandidate : this.index!.magasin.candidat(premiers[i], false));
    }
    let confirmees = 0, aVerifier = 0;
    for (let j = 0; j < this.base.length && confirmees + aVerifier < K; j++) {
      const i = this.base[j], etat = this.index.magasin.etat(i);
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
    this.sourceEnVol = null; this.candidatsAcquittes = -1;
    this.publicationForcee = false;
    this.collecteScellee = false;
    this.tache = null; this.nombreCible = 0; this.plages = []; this.reponsesEnAttente = [];
    this.contexte = null; this.vue = null; this.index = null; this.fileExhaustive = null; this.flux.liberer(); this.lots = [];
    this.cache.clear(); this.generationCache = compteurSuivant(this.generationCache); this.entrees = null; this.sale = false;
    for (const m of this.pilote.invalider()) {
      if (this.repli) this.reponsesDirectes.push(...this.direct.recevoir(m)); else this.sorties.resoudre(m);
    }
  }
  acquitter(generationCache: number, revisionCache: number, nombre: number, identite: IdentitePublication): void {
    if (!this.contexte || generationCache !== this.generationCache || identite.idRecherche !== this.versions.idRecherche
      || identite.idVue !== this.versions.idVue || identite.idDemande !== this.versions.idDemande) return;
    if (!Number.isSafeInteger(revisionCache) || revisionCache < 0 || revisionCache > this.cache.version) throw new Error('Acquittement de cache invalide');
    if (!Number.isSafeInteger(identite.revisionPubliee) || identite.revisionPubliee < 1 || identite.revisionPubliee > this.versions.revisionPubliee) return;
    this.cache.acquitter(revisionCache);
    if (this.sourceEnVol?.revisionPubliee === identite.revisionPubliee && this.sourceEnVol.nombre === nombre) {
      this.candidatsAcquittes = nombre; this.sourceEnVol = null;
    }
  }
  publier(maintenant: number, forcer = false): boolean {
    this.publicationForcee ||= forcer;
    if (this.tache) return false;
    if (!this.contexte || !this.vue || !this.sale) return true;
    // Les ordres suivants dépendent de cette source ; ni réexpédition N,
    // ni publication inutilisable avant son adoption. Les changements restent dus.
    if (this.sourceEnVol) return false;
    if (!this.publicationForcee && maintenant - this.dernierePublication < 400) return false;
    this.dernierePublication = maintenant; this.sale = false; this.publicationForcee = false;
    this.versions.revisionPubliee = compteurSuivant(this.versions.revisionPubliee);
    const nombre = this.index?.magasin.longueur ?? 0;
    const candidats = nombre !== this.candidatsAcquittes
      ? Array.from({ length: nombre }, (_, i) => this.index!.magasin.candidat(i, false)) : undefined;
    if (candidats) this.sourceEnVol = { ...this.versions, nombre };
    this.sorties.publier({ versions: { ...this.versions }, vue: { ...this.vue }, candidats,
      ordreBase: this.base.slice(), ordreAffiche: Uint32Array.from(this.index?.page(0, nombre) ?? []),
      generationCache: this.generationCache, revisionCache: this.cache.version, changements: this.cache.changements(),
      enAttente: this.restants().length, bilan: this.bilan });
    return true;
  }
}

/** Consommateur synchrone du propriétaire de production, sans protocole de plateforme. */
export function classerEnLocal(contexte: ContexteResultat, candidats: readonly BuildCandidate[], vue: VueClassement): PublicationClassement {
  let derniere!: PublicationTransport;
  let source: BuildCandidate[] = [];
  const corps = new CorpsClassement({
    publier: (p) => {
      derniere = p;
      if (p.candidats) source = p.candidats;
      // Les différences restent dues jusqu'à la projection finale ; la source, elle, est adoptée.
      corps.acquitter(p.generationCache, 0, source.length, p.versions);
    },
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
  if (!derniere) throw new Error('Classement local sans publication finale');
  return new AdaptateurClassement().appliquer({ ...derniere, candidats: source });
}
