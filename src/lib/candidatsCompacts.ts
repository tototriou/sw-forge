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

export const LIGNES_PAR_BLOC = 4096;
export type GabaritCandidat = Omit<StatRow, 'total' | 'bonus'>;
/** Même schéma numérique que le magasin de classement, sans ses index d'équipement. */
export interface BlocCandidats {
  schema: 1;
  debut: number;
  longueur: number;
  gabarits: GabaritCandidat[];
  ids: Float64Array[];
  totaux: Float64Array[];
  efficience: Float64Array;
}
/** `length` est cumulatif ; les blocs déjà transférés sont retirés. */
export interface ColonnesCandidats { length: number; blocs: BlocCandidats[] }
export type SortieCandidats = BuildCandidate[] | ColonnesCandidats;
/**
 * Empreinte de six identifiants de runes pour une table à adressage ouvert,
 * masquée ensuite sur ses bits bas. Mélanger les deux mots conserve les
 * identifiants dépassant 32 bits. Le brassage final est nécessaire : un petit
 * entier n'occupe que les bits hauts de son flottant, que la multiplication ne
 * fait jamais descendre — sans lui, des identifiants petits (pool synthétique)
 * tombent sur quelques cases et la table devient quadratique.
 */
export function hacherIds(ids: readonly number[]): number {
  const bits = new DataView(new ArrayBuffer(8));
  let h = 2166136261;
  for (const id of ids) {
    bits.setFloat64(0, id === 0 ? 0 : id);
    h = Math.imul(h ^ bits.getUint32(0), 16777619);
    h = Math.imul(h ^ bits.getUint32(4), 16777619);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export const creerColonnesCandidats =(): ColonnesCandidats => ({ length: 0, blocs: [] });

/** Le message que le classeur poste à la recherche pour l'arrêter sur sa mémoire (`arreterSurMemoire`). */
export const ARRET_MEMOIRE = { arret: 'memoire' } as const;
/** Un message du classeur vers la recherche : l'arrêt sur sa mémoire, ou un crédit de bloc. */
export function routerMessageDuClasseur(data: unknown, recherche: { acquitter: () => void; arreter: () => void }): void {
  if (typeof data === 'object' && data !== null && (data as { arret?: unknown }).arret === ARRET_MEMOIRE.arret) recherche.arreter();
  else recherche.acquitter();
}

/** Fusion stable sur ordinaux, avec points de reprise indépendants de la plateforme. */
export function* trierIndicesEtapes(ordre: Uint32Array, comparer: (a: number, b: number) => number): Generator<void, Uint32Array> {
  let source: Uint32Array = ordre, destination: Uint32Array = new Uint32Array(ordre.length);
  for (let largeur = 1; largeur < ordre.length; largeur *= 2) {
    for (let debut = 0; debut < ordre.length; debut += 2 * largeur) {
      const milieu = Math.min(debut + largeur, ordre.length), fin = Math.min(debut + 2 * largeur, ordre.length);
      let a = debut, b = milieu;
      for (let i = debut; i < fin; i++) {
        destination[i] = a < milieu && (b === fin || comparer(source[a], source[b]) <= 0) ? source[a++] : source[b++];
        if ((i & 63) === 0) yield;
      }
    }
    [source, destination] = [destination, source];
  }
  return source;
}

export function terminerEtapes<T>(etapes: Generator<void, T>): T {
  let etape = etapes.next();
  while (!etape.done) etape = etapes.next();
  return etape.value;
}

export function ajouterValeursCandidat(sortie: ColonnesCandidats, ids: ArrayLike<number>, totaux: ArrayLike<number>, eff: number, gabarits: GabaritCandidat[]): void {
  let bloc = sortie.blocs[sortie.blocs.length - 1];
  if (!bloc || bloc.longueur === LIGNES_PAR_BLOC) {
    bloc = { schema: 1, debut: sortie.length, longueur: 0, gabarits,
      ids: Array.from({ length: 6 }, () => new Float64Array(LIGNES_PAR_BLOC)),
      totaux: Array.from({ length: 8 }, () => new Float64Array(LIGNES_PAR_BLOC)),
      efficience: new Float64Array(LIGNES_PAR_BLOC) };
    sortie.blocs.push(bloc);
  }
  const i = bloc.longueur++;
  for (let j = 0; j < 6; j++) bloc.ids[j][i] = ids[j];
  for (let j = 0; j < 8; j++) bloc.totaux[j][i] = totaux[j];
  bloc.efficience[i] = eff;
  sortie.length++;
}

export function ajouterObjetCandidat(sortie: SortieCandidats, c: BuildCandidate): void {
  if (Array.isArray(sortie)) { sortie.push(c); return; }
  exiger(c.runeIds.length === 6 && c.stats.length === 8, 'Schéma du candidat collecté');
  const gabarits = c.stats.map(({ key, label, base, suffix }) => ({ key, label, base, suffix }));
  const connu = sortie.blocs[0]?.gabarits;
  c.stats.forEach((s, j) => {
    exiger(Object.keys(s).length === CHAMPS_LIGNE.length && CHAMPS_LIGNE.every((k) => Object.prototype.hasOwnProperty.call(s, k)), 'Schéma StatRow collecté');
    exiger(Object.is(s.bonus, s.total - s.base), 'Bonus collecté non reconstructible');
    if (connu) exiger(memeGabarit(connu[j], gabarits[j]), 'Base collectée incohérente');
  });
  ajouterValeursCandidat(sortie, c.runeIds, c.stats.map((s) => s.total), c.effTotal, connu ?? gabarits);
}

function memeGabarit(a: GabaritCandidat, b: GabaritCandidat): boolean {
  return a.key === b.key && a.label === b.label && a.suffix === b.suffix && Object.is(a.base, b.base);
}

export function candidatDuBloc(bloc: BlocCandidats, i: number): BuildCandidate {
  return {
    runeIds: bloc.ids.map((c) => c[i]),
    stats: bloc.gabarits.map(({ key, label, base, suffix }, j) => {
      const total = bloc.totaux[j][i];
      return { key, label, base, bonus: total - base, total, suffix };
    }),
    effTotal: bloc.efficience[i],
  };
}

export function objetsDesCandidats(sortie: SortieCandidats): BuildCandidate[] {
  if (Array.isArray(sortie)) return sortie;
  const out: BuildCandidate[] = [];
  for (const b of sortie.blocs) for (let i = 0; i < b.longueur; i++) out.push(candidatDuBloc(b, i));
  return out;
}

/** Lecture de diagnostic sans matérialiser les fiches des candidats. */
export function* identifiantsDesCandidats(sortie: SortieCandidats): Generator<number[]> {
  if (Array.isArray(sortie)) { for (const c of sortie) yield c.runeIds; return; }
  for (const b of sortie.blocs) for (let i = 0; i < b.longueur; i++) yield b.ids.map((colonne) => colonne[i]);
}

/** Adoption des tampons, coupe au même ordinal que les comptes ; aucune reconstruction d'objet. */
export function fusionnerCandidats(dest: SortieCandidats, source: SortieCandidats, nombre: number): void {
  if (Array.isArray(dest)) {
    const objets = objetsDesCandidats(source);
    for (let i = 0; i < nombre; i++) dest.push(objets[i]);
  } else {
    exiger(!Array.isArray(source), 'Fusion compacte reçue en objets');
    let reste = nombre;
    for (const bloc of source.blocs) {
      if (!reste) break;
      const longueur = Math.min(reste, bloc.longueur);
      dest.blocs.push({ ...bloc, debut: dest.length, longueur });
      dest.length += longueur;
      reste -= longueur;
    }
    exiger(reste === 0, 'Bloc manquant à la fusion');
    source.blocs = [];
  }
}

export function extraireBlocs(sortie: ColonnesCandidats): BlocCandidats[] {
  const blocs = sortie.blocs;
  sortie.blocs = [];
  // Une sous-vue conserverait la réserve entière chez le propriétaire suivant.
  for (const b of blocs) {
    const ajuster = (c: Float64Array) => c.length === b.longueur && c.byteOffset === 0 && c.buffer.byteLength === b.longueur * 8
      ? c : c.slice(0, b.longueur);
    b.ids = b.ids.map(ajuster);
    b.totaux = b.totaux.map(ajuster);
    b.efficience = ajuster(b.efficience);
  }
  return blocs;
}
export function tamponsCandidats(blocs: readonly BlocCandidats[]): ArrayBuffer[] {
  return blocs.flatMap((b) => [...b.ids, ...b.totaux, b.efficience].map((c) => c.buffer as ArrayBuffer));
}

/** Adaptateur de l'écran actuel : aperçu borné, identité conservée au scellement. */
export class RecepteurCandidats {
  private nombre = 0;
  private blocs: BlocCandidats[] = [];
  private apercu: BuildCandidate[] = [];
  private publication: BuildCandidate[] = [];
  private gabarits: GabaritCandidat[] | null = null;
  private scelle = false;
  constructor(private readonly plafondApercu = 3000) {}

  recevoir(blocs: BlocCandidats[]): void {
    exiger(!this.scelle, 'Flux déjà scellé');
    for (const b of blocs) {
      exiger(b.schema === 1 && b.debut === this.nombre && b.longueur > 0 && b.longueur <= LIGNES_PAR_BLOC, 'Plage de candidats non contiguë');
      exiger(b.ids.length === 6 && b.totaux.length === 8 && b.gabarits.length === 8, 'Schéma de bloc inconnu');
      exiger([...b.ids, ...b.totaux, b.efficience].every((c) => c instanceof Float64Array && c.length === b.longueur && c.byteOffset === 0 && c.buffer.byteLength === b.longueur * 8), 'Longueur de colonne invalide');
      if (this.gabarits) exiger(b.gabarits.every((g, j) => memeGabarit(g, this.gabarits![j])), 'Gabarit du flux incohérent');
      this.gabarits ??= b.gabarits;
      for (let i = 0; i < b.longueur && this.apercu.length < this.plafondApercu; i++) this.apercu.push(candidatDuBloc(b, i));
      this.nombre += b.longueur;
      this.blocs.push(b);
    }
  }
  apercuCourant(): BuildCandidate[] {
    if (this.publication.length !== this.apercu.length) this.publication = this.apercu.slice();
    return this.publication;
  }
  get longueur(): number { return this.nombre; }
  lire(i: number): BuildCandidate {
    if (!Number.isInteger(i) || i < 0 || i >= this.nombre) throw new Error('Ordinal de candidat absent');
    // Les derniers blocs peuvent être partiels : debut est l'adresse canonique.
    let gauche = 0, droite = this.blocs.length - 1;
    while (gauche < droite) {
      const milieu = Math.ceil((gauche + droite) / 2);
      if (this.blocs[milieu].debut <= i) gauche = milieu; else droite = milieu - 1;
    }
    const b = this.blocs[gauche];
    return candidatDuBloc(b, i - b.debut);
  }
  scellerColonnes(nombre: number): void {
    exiger(!this.scelle && nombre === this.nombre, 'Scellement incomplet ou répété');
    this.scelle = true;
  }
  liberer(): void { this.blocs = []; this.apercu = []; this.publication = []; }
  sceller(nombre: number): BuildCandidate[] {
    exiger(!this.scelle && nombre === this.nombre, 'Scellement incomplet ou répété');
    this.scelle = true;
    const candidats = this.apercu;
    this.apercu = [];
    for (const b of this.blocs) {
      for (let i = Math.max(0, candidats.length - b.debut); i < b.longueur; i++) candidats.push(candidatDuBloc(b, i));
      // Libérer chaque bloc dès sa projection plutôt qu'après les N objets.
      b.ids = []; b.totaux = []; b.efficience = new Float64Array(0);
    }
    this.blocs = [];
    return candidats;
  }
}

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
  // Les confirmations en fond (verdict sans note) : un octet par groupe,
  // alloué à la première ; à part de `etats`, qui ne dit que le cache des
  // notés. Un groupe confirmé reste « non résolu » pour la page et la file.
  private confirmes: Uint8Array | null = null;
  // Lignes des groupes confirmés sans note (état 0), tenu à jour à la
  // confirmation et à l'ingestion d'un résultat noté.
  private lignesConfirmees = 0;
  private confirmationContredite = false;
  private readonly inventaireReliques: RelicDetail[] = [];
  private readonly inventaireArtefacts: ArtifactDetail[] = [];
  private readonly indicesReliques = new Map<number, number>();
  private readonly indicesArtefacts = new Map<number, number>();

  constructor(candidats: ArrayLike<BuildCandidate>, differe = false) {
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
    if (!differe) terminerEtapes(this.initialiser(candidats));
  }

  *initialiser(candidats: ArrayLike<BuildCandidate>): Generator<void> {
    const n = this.longueur;
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
      yield;
    }
    const ordre = yield* trierIndicesEtapes(Uint32Array.from({ length: cles.length }, (_, i) => i),
      (a, b) => cles[a].cle < cles[b].cle ? -1 : cles[a].cle > cles[b].cle ? 1 : 0);
    for (let rang = 0; rang < ordre.length; rang++) { this.rangs[cles[ordre[rang]].ligne] = rang; yield; }
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
    let p = hacherIds(ids) & (this.hachage.length - 1);
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
  groupe(i: number): number { return this.groupes[i] - 1; }
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

  private taille(g: number): number {
    let n = 0;
    for (const _ of this.lignesDuGroupe(g)) n++;
    return n;
  }

  /**
   * Le groupe de la ligne `i` est confirmé conforme, sans note. Sans effet
   * sur un groupe déjà noté, ou déjà confirmé ; un groupe noté rejeté
   * contredit la confirmation (défaut signalé, jamais absorbé en silence).
   */
  confirmer(i: number): void {
    const g = this.groupes[i] - 1;
    if (this.etats[g] === 2) this.signalerContradiction(g);
    if (this.etats[g] !== 0) return;
    this.confirmes ??= new Uint8Array(this.longueur);
    if (this.confirmes[g]) return;
    this.confirmes[g] = 1;
    this.lignesConfirmees += this.taille(g);
  }
  /** Le groupe de la ligne `i` a-t-il été confirmé en fond (noté depuis, ou non) ? */
  confirme(i: number): boolean { return this.confirmes?.[this.groupes[i] - 1] === 1; }
  /** Les lignes confirmées conformes en fond et pas encore notées. */
  get confirmeesSansNote(): number { return this.lignesConfirmees; }
  private signalerContradiction(g: number): void {
    if (this.confirmationContredite) return;
    this.confirmationContredite = true;
    console.error(`Confirmation sans note contredite par la résolution notée (build ${this.cle(g)}) — défaut de la confirmation.`);
  }

  ingerer(i: number, resultat: ResultatArtefacts | undefined): void {
    const g = this.groupes[i] - 1;
    exiger(this.versions[g] < 0xffffffff, 'Version équipement épuisée');
    this.versions[g]++;
    const etat = resultat ? resultat.conforme ? 1 : 2 : 0;
    if (this.confirmes?.[g] && (this.etats[g] === 0) !== (etat === 0)) {
      this.lignesConfirmees += etat === 0 ? this.taille(g) : -this.taille(g);
      if (etat === 2) this.signalerContradiction(g);
    }
    this.etats[g] = etat;
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

  /**
   * Le total d'une stat tel que `statTotal(candidat(i, resolu).stats, cle)`
   * le lit (première ligne de cette clé, 0 sans elle), sans matérialiser le
   * candidat : la même colonne, le même nombre.
   */
  totalDeLaStat(i: number, cle: string, resolu = true): number {
    const j = this.gabarits.findIndex((g) => g.key === cle);
    if (j < 0) return 0;
    const g = this.groupes[i] - 1;
    return resolu && this.etats[g] === 1 ? this.resolus[j][g] : this.totaux[j][i];
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
