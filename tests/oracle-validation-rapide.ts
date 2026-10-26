// ORACLE DE TEST — copie fidèle de src/lib/validationRapide.ts tel qu'il était
// avant la lecture par rune distincte (révision 5f35cbc5), imports seuls
// adaptés : chaque rune y est relue à chaque occurrence. Les tests comparent
// la validation de production à celle-ci, champ par champ. Ne pas la
// « mettre à jour » avec la production : elle n'a de valeur que figée.
//
// Texte d'origine :
// La validation exacte des paires qui passent `quickOk`, sur tableaux
// typés : celle de l'appariement de production (`Collecteur.validerTypee`,
// appariementRapide.ts), séquentiel et parallèle, dès que son contrat tient ;
// sinon la référence, `Collecteur.valider`, copie du bloc de `pairBuckets`
// (runeBuildOptim.ts). Voir docs/03-developpeur/optimizer/moteur/noyau-appariement.md.
//
// Ce que `pairBuckets` fait après `quickOk`, et ce que ce module en garde :
//
// 1. **Sets réels** : `activeSets` sur les six runes, puis `missingSets`. Ici :
//    les six indices de set, un compte par set, `floor(n / pièces)`
//    activations, le joker qui complète le SEUL set incomplet s'il ne lui
//    manque qu'une pièce (`jokers ≥ missing`, `jokers` plafonné à 1), puis la
//    multiplicité de chaque set demandé — la même règle, écrite sur des
//    comptes. L'ordre de `activeSets` (4 pièces d'abord) ne sert qu'à l'ordre
//    des additions de bonus : sommes d'entiers, ordre indifférent.
// 2. **Stats** (`computeStats`) : `base + ceil(base × Σ% / 100) + Σplat` pour
//    PV/ATQ/DEF, `base + Σplat` sinon. Σ% et Σplat sont des sommes
//    d'ENTIERS (lignes de rune, principale d'artéfact, principale de relique,
//    bonus de set dont le `ceil(base × 25 / 100)` de Swift par activation) :
//    exactes en Float64 dans n'importe quel ordre, donc égales à celles de
//    `computeStats` au bit près, et l'expression finale est recopiée
//    OPÉRANDE PAR OPÉRANDE. D'où le contrat (`motif`) : toute valeur sommée
//    est entière et bornée, sinon ce module refuse et le chemin de
//    référence (`Collecteur.valider`, copie de `pairBuckets`) est pris.
// 3. **Test conjoint** : les tentatives de `pairBuckets` dans le même ordre,
//    un apport de `artPossibles` (ou la paire figée) × une fiche — en mode
//    `recherche`, une par relique représentative (`fichesDuTestConjoint`),
//    sa principale ajoutée à Σ% avant le `ceil` de sa stat ; sinon la fiche
//    du build —, auras RES/PRE propres (activations Tolerance/Accuracy du
//    point 1) : `actual` recalculé par la MÊME suite d'opérations que
//    `totalCondition(total + décalage)`, dans le même ordre.
// 4. Les `StatRow` ne se construisent qu'à l'adaptation objet ou quand le
//    quasi-succès s'améliore (`lignes`), avec les libellés, suffixes et
//    l'ordre des lignes LUS sur `computeStats` lui-même (sonde sans rune) ;
//    `effTotal` est la même somme gauche-droite que `runes.reduce` (préfixe
//    des trois runes de A, puis les trois de B une à une).

import { RuneDetail } from '../src/types';
import { ARTIFACT_MAIN, INTANGIBLE_SET, RELIC_MAIN, RUNE_EFFECT, SET_STAT_BONUS, StatKey, runeEfficiency, runeScore, setPieces } from '../src/lib/effects';
import { StatRow, computeStats } from '../src/lib/stats';
import { PreparedSearch, StatShortfall } from '../src/lib/runeBuildOptim';
import { ColonnesCandidats, GabaritCandidat, ajouterValeursCandidat } from '../src/lib/candidatsCompacts';

/** Les huit stats, dans l'ordre des voies plates ; voies 8 à 10 : les % de PV, ATQ, DEF. */
const CLES: readonly StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
const NV = 11;
const voiePlate = (k: StatKey): number => CLES.indexOf(k);
const voiePct = (k: StatKey): number => (k === 'hp' ? 8 : k === 'atk' ? 9 : k === 'def' ? 10 : -1);
const estPct = (k: StatKey) => k === 'hp' || k === 'atk' || k === 'def';

/** Borne d'une valeur sommée : 6 runes × ~10 lignes restent loin de 2^31 par moitié, et de 2^53 au total. */
const BORNE_VALEUR = 2 ** 20;
const entierBorne = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= BORNE_VALEUR;

/** Indices de set réservés : 0 = clé vide (ignorée par `activeSets`), 1 = Intangible. */
const SET_IGNORE = 0;
const SET_JOKER = 1;

/** Une condition jugée par le test conjoint, dans l'ordre de `pairBuckets` : minimums puis maximums. */
export interface ConditionTypee {
  key: StatKey;
  kind: 'min' | 'max';
  /** Le seuil BRUT (`requested` du quasi-succès). */
  seuil: number;
  /** Indice dans `stats` (ordre des voies plates). */
  stat: number;
  /** `totalCondition` ajoute l'aura (RES/PRE, toggle actif). */
  aura: boolean;
  auraExterne: number;
  /** 'tolerance' pour RES, 'accuracy' pour PRE. */
  auraSet: number;
  /** `${key}-${kind}` : la clé du quasi-succès par condition. */
  cle: string;
}

/** État local du collecteur, relu à chaque tentative ; les tampons restent partagés en lecture. */
export interface LimitesEcarts {
  readonly slotDe: Int32Array;
  readonly existe: Uint8Array;
  readonly meilleur: Float64Array;
  readonly distanceGlobale: () => number;
}

export class ValidationTypee {
  /** `null` si le contrat tient ; sinon pourquoi le chemin de référence est pris. */
  readonly motif: string | null;
  readonly conditions: ConditionTypee[] = [];
  /** Nombre d'apports jugés (`artPossibles`, ou la paire figée). */
  readonly nApports: number;
  /** Nombre de fiches jugées par apport : les reliques représentatives en mode `recherche`, 1 sinon. */
  readonly nFiches: number;

  private readonly nA: number;
  private readonly nB: number;
  /** Par demi-build : sommes des voies (`NV` par demi-build), indices de set (3), valeurs de rune pour `effTotal`. */
  private readonly sommeA: Int32Array;
  private readonly sommeB: Int32Array;
  private readonly setsA: Uint8Array;
  private readonly setsB: Uint8Array;
  /** A : `((0 + v0) + v1) + v2` ; B : `v3, v4, v5`. */
  private readonly effA: Float64Array;
  private readonly effB: Float64Array;
  private readonly idsA: Float64Array;
  private readonly idsB: Float64Array;

  /** Par indice de set : pièces, voie de son bonus de fiche (−1 sans), valeur par activation. */
  private readonly pieces: Uint8Array;
  private readonly voieBonus: Int8Array;
  private readonly valeurBonus: Int32Array;
  /** Les sets demandés, avec leur multiplicité. */
  private readonly demandes: Int32Array;
  private readonly multiplicites: Int32Array;

  /** Voies fixes : principales d'artéfact (plat), principale de relique (%, hors mode `recherche`). */
  private readonly fixe = new Float64Array(NV);
  private readonly base = new Float64Array(8);
  /** `(apport[k] ?? 0) − (artFlatFige[k] ?? 0)`, par apport et condition. */
  private readonly decalage: Float64Array;
  /**
   * Par fiche (`fichesDuTestConjoint`) : la voie plate de la stat de sa
   * relique (0 à 2 ; −1 sans relique ou principale inconnue) et la valeur de
   * sa principale.
   */
  private readonly ficheVoie: Int8Array;
  private readonly ficheValeur: Float64Array;
  /** Par fiche : le total de la stat de sa relique pour la paire courante (calculé si une condition lit cette stat). */
  private readonly ficheTotal: Float64Array;
  /** Les stats lues par au moins une condition. */
  private readonly statsUtiles: Int32Array;
  /** L'ordre, les libellés et les suffixes des lignes de `computeStats`. */
  private readonly gabarit: { key: StatKey; label: string; suffix: string; i: number }[];

  // Tampons d'une paire.
  private readonly compte: Int8Array;
  private readonly activations: Int8Array;
  private readonly touches = new Int32Array(6);
  private readonly voiesSet = new Float64Array(NV);
  /** Total `computeStats` de chaque stat utile de la paire courante. */
  readonly total = new Float64Array(8);
  /** Activations Tolerance (RES) et Accuracy (PRE) propres de la paire courante. */
  private auraRes = 0;
  private auraAcc = 0;
  /** Les conditions en échec du dernier apport jugé (`ecarts`). */
  readonly echecs: Int32Array;
  readonly actuels: Float64Array;
  readonly manques: Float64Array;

  private ga = -1;
  private gb = -1;
  private readonly totauxCollectes = new Float64Array(8);
  private gabaritsCollectes: GabaritCandidat[] | null = null;

  /**
   * `runesA[3·g + r]` : la rune `r` du demi-build A d'indice global `g` (ordre
   * des compartiments, comme `encoderCompartiments`) ; de même pour B.
   */
  constructor(prepared: PreparedSearch, runesA: readonly RuneDetail[], runesB: readonly RuneDetail[]) {
    this.nA = runesA.length / 3;
    this.nB = runesB.length / 3;
    const { base, artifacts, relic, relicRelache, requirement, minEntries, maxEntries, artPossibles, artFlatFige, metric } = prepared;
    this.motif = ValidationTypee.contrat(prepared, runesA, runesB);

    // Sets : un indice par clé rencontrée (runes, puis demandes).
    const indice = new Map<string, number>();
    const cles: string[] = ['', INTANGIBLE_SET];
    const indiceDe = (key: string): number => {
      if (!key) return SET_IGNORE;
      if (key === INTANGIBLE_SET) return SET_JOKER;
      let i = indice.get(key);
      if (i === undefined) {
        i = cles.length;
        indice.set(key, i);
        cles.push(key);
      }
      return i;
    };
    for (const r of runesA) indiceDe(r.set);
    for (const r of runesB) indiceDe(r.set);
    const parDemande = new Map<number, number>();
    for (const key of requirement.sets) {
      const i = indiceDe(key);
      parDemande.set(i, (parDemande.get(i) ?? 0) + 1);
    }
    const nSets = cles.length;
    this.pieces = new Uint8Array(nSets);
    this.voieBonus = new Int8Array(nSets).fill(-1);
    this.valeurBonus = new Int32Array(nSets);
    for (let i = 2; i < nSets; i++) {
      const key = cles[i];
      this.pieces[i] = setPieces(key);
      // Même lecture que `computeStats` : `flat` d'abord, puis `pct`.
      const bonus = SET_STAT_BONUS[key];
      if (!bonus) continue;
      if (bonus.flat != null) {
        this.voieBonus[i] = voiePlate(bonus.stat);
        this.valeurBonus[i] = bonus.flat;
      } else if (bonus.pct != null) {
        if (estPct(bonus.stat)) {
          this.voieBonus[i] = voiePct(bonus.stat);
          this.valeurBonus[i] = bonus.pct;
        } else {
          this.voieBonus[i] = voiePlate(bonus.stat);
          this.valeurBonus[i] = Math.ceil((base[bonus.stat] * bonus.pct) / 100);
        }
      }
    }
    this.demandes = Int32Array.from(parDemande.keys());
    this.multiplicites = Int32Array.from(parDemande.values());
    this.compte = new Int8Array(nSets);
    this.activations = new Int8Array(nSets);
    const tolerance = indice.get('tolerance') ?? -1;
    const accuracy = indice.get('accuracy') ?? -1;

    // Voies fixes, comme les boucles `gear.artifacts` et `gear.relic` de `computeStats`.
    for (const a of artifacts) {
      const def = ARTIFACT_MAIN[a.main.code];
      if (def) this.fixe[voiePlate(def.stat)] += a.main.value;
    }
    const relique = relicRelache ? undefined : relic;
    if (relique) {
      const def = RELIC_MAIN[relique.main.code];
      if (def) this.fixe[voiePct(def.stat)] += relique.main.value;
    }
    CLES.forEach((k, i) => {
      this.base[i] = base[k];
    });

    // Conditions et apports.
    const aura = requirement.auraResPre;
    const condition = (key: StatKey, kind: 'min' | 'max', seuil: number): ConditionTypee => {
      const compte = (key === 'res' || key === 'acc') && !!aura?.compter;
      return {
        key, kind, seuil, stat: voiePlate(key),
        aura: compte, auraExterne: compte ? aura![key as 'res' | 'acc'] : 0,
        auraSet: key === 'res' ? tolerance : accuracy,
        cle: `${key}-${kind}`,
      };
    };
    for (const { k, min } of minEntries) this.conditions.push(condition(k, 'min', min));
    for (const { k, max } of maxEntries) this.conditions.push(condition(k, 'max', max));
    const apports = artPossibles.length > 0 ? artPossibles : [artFlatFige];
    this.nApports = apports.length;
    const E = this.conditions.length;
    this.decalage = new Float64Array(this.nApports * E);
    apports.forEach((apport, a) => {
      this.conditions.forEach((c, e) => {
        this.decalage[a * E + e] = (apport[c.key] ?? 0) - (artFlatFige[c.key] ?? 0);
      });
    });
    // Les fiches, dans l'ordre de `fichesDuTestConjoint`.
    const reps = relicRelache ? prepared.reliquesRepresentatives : null;
    this.nFiches = reps ? reps.length : 1;
    this.ficheVoie = reps ? Int8Array.from(reps, (r) => {
      const def = RELIC_MAIN[r.main.code];
      return def ? voiePlate(def.stat) : -1;
    }) : Int8Array.of(-1);
    this.ficheValeur = reps ? Float64Array.from(reps, (r) => r.main.value) : Float64Array.of(0);
    this.ficheTotal = new Float64Array(this.nFiches);
    this.statsUtiles = Int32Array.from(new Set(this.conditions.map((c) => c.stat)));
    this.echecs = new Int32Array(E);
    this.actuels = new Float64Array(E);
    this.manques = new Float64Array(E);

    // L'ordre et les libellés des lignes, lus sur `computeStats` lui-même.
    this.gabarit = computeStats({ base, runes: [], artifacts: [] }).map((r) => ({ key: r.key, label: r.label, suffix: r.suffix, i: voiePlate(r.key) }));

    // Demi-builds.
    const valeur = (r: RuneDetail) => (metric === 'eff' ? runeEfficiency(r) : runeScore(r));
    const encoder = (runes: readonly RuneDetail[], n: number, estA: boolean) => {
      const somme = new Int32Array(NV * n);
      const sets = new Uint8Array(3 * n);
      const eff = new Float64Array(estA ? n : 3 * n);
      const ids = new Float64Array(3 * n);
      if (this.motif) return { somme, sets, eff, ids };
      const ligne = (g: number, code: number, value: number) => {
        const def = RUNE_EFFECT[code];
        if (!def) return;
        // Un % hors PV/ATQ/DEF n'entre dans aucun total de `computeStats` (voie −1 : ignoré).
        const voie = def.pct ? voiePct(def.stat) : voiePlate(def.stat);
        if (voie >= 0) somme[g * NV + voie] += value;
      };
      for (let g = 0; g < n; g++) {
        let pre = 0;
        for (let r = 0; r < 3; r++) {
          const rune = runes[3 * g + r];
          ligne(g, rune.main.code, rune.main.value);
          if (rune.innate) ligne(g, rune.innate.code, rune.innate.value);
          for (const s of rune.subs) ligne(g, s.code, s.value);
          sets[3 * g + r] = indiceDe(rune.set);
          ids[3 * g + r] = rune.id;
          if (estA) pre = pre + valeur(rune);
          else eff[3 * g + r] = valeur(rune);
        }
        if (estA) eff[g] = pre;
      }
      return { somme, sets, eff, ids };
    };
    const a = encoder(runesA, this.nA, true);
    const b = encoder(runesB, this.nB, false);
    this.sommeA = a.somme;
    this.setsA = a.sets;
    this.effA = a.eff;
    this.idsA = a.ids;
    this.sommeB = b.somme;
    this.setsB = b.sets;
    this.effB = b.eff;
    this.idsB = b.ids;
  }

  /** Le contrat numérique de la validation : valeurs entières, sommes bornées. */
  static contrat(prepared: PreparedSearch, runesA: readonly RuneDetail[], runesB: readonly RuneDetail[]): string | null {
    const { base, artifacts, relic, relicRelache } = prepared;
    for (const k of CLES) if (typeof base[k] !== 'number' || !Number.isFinite(base[k])) return `base ${k} non finie (${base[k]})`;
    for (const { k } of [...prepared.minEntries, ...prepared.maxEntries]) if (!CLES.includes(k)) return `condition sur une stat inconnue (${k})`;
    const verifierLigne = (code: number, value: number, ou: string): string | null =>
      RUNE_EFFECT[code] && !entierBorne(value) ? `${ou} : valeur non entière ou hors borne (${value})` : null;
    const ensembles = new Set<string>();
    for (const runes of [runesA, runesB]) {
      if (runes.length % 3 !== 0) return 'demi-builds incomplets';
      for (const r of runes) {
        if (r.set) ensembles.add(r.set);
        const m = verifierLigne(r.main.code, r.main.value, `rune ${r.id}, principale`)
          ?? (r.innate ? verifierLigne(r.innate.code, r.innate.value, `rune ${r.id}, innée`) : null)
          ?? r.subs.reduce<string | null>((acc, s) => acc ?? verifierLigne(s.code, s.value, `rune ${r.id}, sous-stat`), null);
        if (m) return m;
      }
    }
    if (ensembles.size + prepared.requirement.sets.length > 250) return `trop de sets distincts (${ensembles.size})`;
    for (const a of artifacts) if (ARTIFACT_MAIN[a.main.code] && !entierBorne(a.main.value)) return `artéfact ${a.id} : principale non entière (${a.main.value})`;
    if (!relicRelache && relic && RELIC_MAIN[relic.main.code] && !entierBorne(relic.main.value)) return `relique ${relic.id} : principale non entière (${relic.main.value})`;
    if (relicRelache) {
      for (const r of prepared.reliquesRepresentatives) {
        if (RELIC_MAIN[r.main.code] && !entierBorne(r.main.value)) return `relique ${r.id} : principale non entière (${r.main.value})`;
      }
    }
    for (const key of ensembles) {
      const bonus = SET_STAT_BONUS[key];
      if (!bonus) continue;
      const v = bonus.flat != null ? bonus.flat : bonus.pct != null ? (estPct(bonus.stat) ? bonus.pct : Math.ceil((base[bonus.stat] * bonus.pct) / 100)) : 0;
      if (!entierBorne(v)) return `bonus du set ${key} non entier ou hors borne (${v})`;
    }
    return null;
  }

  /**
   * Sets réels de la paire `(ga, gb)`, puis, s'ils tiennent, les totaux de
   * `computeStats` des stats lues par une condition (`total`) et les
   * activations d'aura propres. Rend faux si un set demandé manque.
   */
  setsEtStats(ga: number, gb: number): boolean {
    this.ga = ga;
    this.gb = gb;
    const { compte, activations, touches, pieces } = this;
    let nt = 0;
    let jokers = 0;
    for (let r = 0; r < 6; r++) {
      const s = r < 3 ? this.setsA[3 * ga + r] : this.setsB[3 * gb + r - 3];
      if (s === SET_IGNORE) continue;
      if (s === SET_JOKER) {
        jokers++;
        continue;
      }
      if (compte[s]++ === 0) touches[nt++] = s;
    }
    let partiels = 0;
    let partiel = -1;
    let manque = 0;
    for (let t = 0; t < nt; t++) {
      const s = touches[t];
      const n = compte[s];
      const req = pieces[s];
      const act = Math.floor(n / req);
      activations[s] = act;
      const reste = n - act * req;
      if (reste > 0) {
        partiels++;
        partiel = s;
        manque = req - reste;
      }
    }
    // Un seul joker compte ; il complète le seul set incomplet s'il ne lui manque qu'une pièce.
    if (jokers > 0 && partiels === 1 && manque <= 1) activations[partiel]++;
    let ok = true;
    for (let d = 0; d < this.demandes.length; d++) {
      if (activations[this.demandes[d]] < this.multiplicites[d]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const v = this.voiesSet;
      v.fill(0);
      for (let t = 0; t < nt; t++) {
        const s = touches[t];
        const vb = this.voieBonus[s];
        if (vb >= 0) v[vb] += activations[s] * this.valeurBonus[s];
      }
      this.auraRes = 0;
      this.auraAcc = 0;
      for (const c of this.conditions) {
        if (!c.aura || c.auraSet < 0) continue;
        if (c.key === 'res') this.auraRes = activations[c.auraSet];
        else this.auraAcc = activations[c.auraSet];
      }
      const oa = ga * NV;
      const ob = gb * NV;
      for (let u = 0; u < this.statsUtiles.length; u++) {
        const i = this.statsUtiles[u];
        const b = this.base[i];
        const plat = this.sommeA[oa + i] + this.sommeB[ob + i] + this.fixe[i] + v[i];
        if (i < 3) {
          const p = 8 + i;
          const pct = this.sommeA[oa + p] + this.sommeB[ob + p] + this.fixe[p] + v[p];
          this.total[i] = b + Math.ceil((b * pct) / 100) + plat;
          // La stat de chaque relique représentative : sa principale entre
          // dans Σ% avant le `ceil`, comme dans `computeStats`.
          for (let f = 0; f < this.nFiches; f++) {
            if (this.ficheVoie[f] === i) this.ficheTotal[f] = b + Math.ceil((b * (pct + this.ficheValeur[f])) / 100) + plat;
          }
        } else {
          this.total[i] = b + plat;
        }
      }
    }
    for (let t = 0; t < nt; t++) {
      compte[touches[t]] = 0;
      activations[touches[t]] = 0;
    }
    return ok;
  }

  /**
   * Les conditions en échec de la paire courante pour la tentative (apport
   * `a`, fiche `f`), dans l'ordre de `pairBuckets` (`echecs`, `actuels`,
   * `manques`). Rend leur nombre (un préfixe suffit si les limites du
   * collecteur prouvent que le quasi-succès ne changera pas) ; 0 = le build
   * tient toutes ses conditions avec cet apport et cette fiche. La stat de la relique lit
   * `ficheTotal`, les autres `total`.
   */
  ecarts(a: number, f: number, limites?: LimitesEcarts): number {
    const E = this.conditions.length;
    const voie = this.ficheVoie[f];
    const distanceGlobale = limites ? limites.distanceGlobale() : Infinity;
    let distance = -Infinity;
    let n = 0;
    for (let e = 0; e < E; e++) {
      const c = this.conditions[e];
      let actual = (c.stat === voie ? this.ficheTotal[f] : this.total[c.stat]) + this.decalage[a * E + e];
      if (c.aura) actual = actual + c.auraExterne + 8 * (c.key === 'res' ? this.auraRes : this.auraAcc);
      if (c.kind === 'min' ? actual < c.seuil : actual > c.seuil) {
        this.echecs[n] = e;
        this.actuels[n] = actual;
        this.manques[n] = c.kind === 'min' ? c.seuil - actual : actual - c.seuil;
        n++;
        if (limites) {
          distance = Math.max(distance, this.manques[n - 1] / c.seuil);
          let parCondition = false;
          if (n === 1) {
            const slot = limites.slotDe[this.echecs[0]];
            parCondition = !limites.existe[slot] || this.manques[0] < limites.meilleur[slot];
          }
          // Sur ce préfixe, considererTypee rend sans écriture : aucune
          // amélioration par condition et maximum déjà atteint. Même repli
          // gauche-droite ; NaN interdit >=, même si une suite aurait un NaN.
          if (!parCondition && distance >= distanceGlobale) return n;
        }
      }
    }
    return n;
  }

  /** Les `StatShortfall` des `n` échecs du dernier `ecarts`, comme `pairBuckets` les construit. */
  manquesDe(n: number): StatShortfall[] {
    const out: StatShortfall[] = [];
    for (let i = 0; i < n; i++) {
      const c = this.conditions[this.echecs[i]];
      out.push({ key: c.key, kind: c.kind, requested: c.seuil, actual: this.actuels[i], shortfall: this.manques[i] });
    }
    return out;
  }

  /** Les six identifiants de la paire courante. */
  runeIds(): number[] {
    const a = 3 * this.ga;
    const b = 3 * this.gb;
    return [this.idsA[a], this.idsA[a + 1], this.idsA[a + 2], this.idsB[b], this.idsB[b + 1], this.idsB[b + 2]];
  }

  /** `runes.reduce((sum, r) => sum + valueOf(r, metric), 0)`, même ordre d'addition. */
  effTotal(): number {
    const b = 3 * this.gb;
    return this.effA[this.ga] + this.effB[b] + this.effB[b + 1] + this.effB[b + 2];
  }

  /**
   * Les `StatRow` de `computeStats` pour la paire courante (après un
   * `setsEtStats` vrai) : les huit lignes, `bonus` compris.
   */
  lignes(): StatRow[] {
    const totaux = this.totauxDeLaPaire();
    return this.gabarit.map(({ key, label, suffix, i }, j) => {
      const base = this.base[i], total = totaux[j];
      return { key, label, base, bonus: total - base, total, suffix };
    });
  }

  /** La collecte lit l'expression même de `lignes`, sans StatRow temporaire. */
  ecrireCandidat(sortie: ColonnesCandidats): void {
    this.gabaritsCollectes ??= this.gabarit.map(({ key, label, suffix, i }) => ({ key, label, suffix, base: this.base[i] }));
    ajouterValeursCandidat(sortie, this.runeIds(), this.totauxDeLaPaire(), this.effTotal(), this.gabaritsCollectes);
  }

  private totauxDeLaPaire(): Float64Array {
    const oa = this.ga * NV;
    const ob = this.gb * NV;
    const v = this.voiesSet;
    this.gabarit.forEach(({ i }, j) => {
      const b = this.base[i];
      const plat = this.sommeA[oa + i] + this.sommeB[ob + i] + this.fixe[i] + v[i];
      let total: number;
      if (i < 3) {
        const p = 8 + i;
        const pct = this.sommeA[oa + p] + this.sommeB[ob + p] + this.fixe[p] + v[p];
        total = b + Math.ceil((b * pct) / 100) + plat;
      } else {
        total = b + plat;
      }
      this.totauxCollectes[j] = total;
    });
    return this.totauxCollectes;
  }
}
