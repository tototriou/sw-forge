// Validation typée de l'appariement (src/lib/validationRapide.ts) contre les
// fonctions de RÉFÉRENCE (`activeSets`, `computeStats`, `pairBuckets`).
//
// 1. **Cas écrits** : les règles d'`activeSets` qu'un compte par set doit
//    reproduire — joker et deux sets incomplets, joker qui complète un set
//    4 pièces, deux Intangible, set 2 pièces activé trois fois, multiplicité
//    d'un set demandé, clé de set vide, Swift sur une VIT de base non
//    multiple de 4.
// 2. **Paire par paire** : sur des demi-builds TIRÉS (sets variés, Intangible,
//    Swift, Tolerance/Accuracy, innées), avec minimums et maximums, auras
//    RES/PRE comptées ou non, paire d'artéfacts figée et `artPossibles`
//    multiples, relique portée ou en mode `recherche` : verdict des sets,
//    `StatRow` entiers, `runeIds`, `effTotal` et manques de chaque tentative
//    égaux à `activeSets`/`computeStats`/la boucle de `pairBuckets`
//    (`comparerPaire`, `Object.is` aux feuilles).
// 3. **Collecteur** : la même suite de paires validée par les deux chemins
//    (typé, copie de `pairBuckets`) rend les mêmes candidats, le même
//    quasi-succès et les mêmes améliorations, dans le même ordre.
// 4. **Bout en bout** : `apparierRapide` (typé, contrôle paire par paire de
//    chaque survivant de `quickOk`), sa validation de référence et le
//    parallèle simulé égaux à `pairBuckets` ; contrat non tenu (valeur non
//    entière) → chemin de référence, résultat inchangé.

import { ArtifactDetail, BaseStats, RelicDetail, RuneDetail } from '../src/types';
import { BuildRequirement, PreparedSearch, SearchParams, SearchResult, buildBuckets, pairBuckets, prepareSearch, totalPairCount } from '../src/lib/runeBuildOptim';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { Collecteur, InitTravailleur, Morceau, ResultatMorceau, apparierRapide, initialiserTravailleur, runesAPlat, traiterMorceau, validationDe } from '../src/lib/appariementRapide';
import { LancerTravailleur } from '../src/lib/appariementRapideParallele';
import { apparierObjetPourTest as apparierRapideEnParallele } from './flux-candidats.test';
import { ValidationTypee } from '../src/lib/validationRapide';
import { bilanVide, comparerPaire, strictementEgal } from '../scripts/lib/controleValidationRapide';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import { executerHarnais, evaluerCompletude, resoudreConfig } from '../scripts/lib/diagnosticHarness';
import { construireMoitieTypee } from '../src/lib/rechercheRunes';
import { objetsDesCompartiments } from '../src/lib/demiBuildsTypes';

// Oracle figé : corps de Collecteur.considererTypee avant la coupe du
// calcul de distance. L'accès aux champs privés reste limité au test.
function considererTypeeOracle(this: any, v: ValidationTypee, n: number): void {
  let slot = -1;
  let parCondition = false;
  if (n === 1) {
    slot = this.slotDe[v.echecs[0]];
    parCondition = !this.existe[slot] || v.manques[0] < this.meilleur[slot];
  }
  let distance = -Infinity;
  for (let i = 0; i < n; i++) distance = Math.max(distance, v.manques[i] / v.conditions[v.echecs[i]].seuil);
  const global = distance < this.globalNearMissDistance;
  if (!parCondition && !global) return;
  const { runeIds, stats, effTotal } = this.materiel(v);
  const shortfalls = v.manquesDe(n);
  if (parCondition) {
    const s = shortfalls[0];
    const mapKey = `${s.key}-${s.kind}`;
    const entree = { key: s.key, kind: s.kind, miss: { runeIds, stats, effTotal, shortfalls } };
    this.nearMissByCondition.set(mapKey, entree);
    this.existe[slot] = 1;
    this.meilleur[slot] = s.shortfall;
    this.instantane = null;
    this.ameliorations?.push({ pos: this.pos, type: 'condition', cle: mapKey, entree });
  }
  if (global) {
    this.globalNearMissDistance = distance;
    this.globalNearMiss = { runeIds, stats, effTotal, shortfalls };
    this.ameliorations?.push({ pos: this.pos, type: 'global', distance, miss: this.globalNearMiss });
  }
}

const etatCollecteur = (c: Collecteur) => ({
  candidates: c.candidates, positions: c.positions, nearMissByCondition: c.snapshot(), globalNearMiss: c.globalNearMiss, ameliorations: c.ameliorations,
});

function exigerIdentique(a: unknown, b: unknown, contexte: string): void {
  if (strictementEgal(a, b)) return;
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.join('|') !== kb.join('|')) throw new Error(`${contexte} : clés [${ka}] ≠ [${kb}]`);
    for (const k of ka) exigerIdentique((a as any)[k], (b as any)[k], `${contexte}.${k}`);
  }
  throw new Error(`${contexte} : reçu ${String(a)}, oracle ${String(b)}`);
}

/** Observe chaque tentative du vrai collecteur, sans variante de production. */
async function avecOracleDistance(action: () => Promise<void>): Promise<void> {
  const prototype = Collecteur.prototype as any;
  const originale = prototype.considererTypee;
  const miroirs = new WeakMap<Collecteur, Collecteur>();
  let tentatives = 0;
  prototype.considererTypee = function (this: any, v: ValidationTypee, n: number) {
    let oracle = miroirs.get(this);
    if (!oracle) {
      oracle = new Collecteur(this.prepared, this.ameliorations !== null, false, v);
      miroirs.set(this, oracle);
    }
    (oracle as any).materielCourant = null;
    (oracle as any).pos = this.pos;
    originale.call(this, v, n);
    considererTypeeOracle.call(oracle, v, n);
    const etat = (c: Collecteur) => ({ conditions: c.snapshot(), global: c.globalNearMiss, ameliorations: c.ameliorations });
    exigerIdentique(etat(this), etat(oracle), `paire [${v.runeIds()}], tentative ${tentatives}, échecs ${v.manquesDe(n).map((s) => `${s.key}-${s.kind}`).join(',')}`);
    tentatives++;
  };
  try {
    await action();
    ok(tentatives > 0, `${tentatives} tentatives du collecteur réel comparées au corps figé de distance`);
  } finally { prototype.considererTypee = originale; }
}

function testDistanceCoupee(): void {
  titre('Validation rapide · distance coupée contre le corps figé, tentative par tentative');
  const prepared = prepareSearch({ base: BASE, artifacts: [], pool: Array.from({ length: 6 }, (_, i) => rune(i + 1, i + 1, 'energy')), requirement: { sets: [], minStats: {} }, metric: 'eff', maxMs: Infinity })!;
  const v = new ValidationTypee(prepared, [], []);
  // Seules les données lues par considererTypee : les frontières numériques
  // restent exerçables même quand prepareSearch refuse une borne non finie.
  const cles = ['hp', 'atk', 'def', 'spd'] as const;
  for (let i = 0; i < cles.length; i++) v.conditions.push({ key: cles[i], kind: 'min', seuil: 1, stat: i, aura: false, auraExterne: 0, auraSet: -1, cle: `${cles[i]}-min` });
  const essais = [
    [[1, 1], [1, 2]], // premier global puis égalité du préfixe
    [[1, 2], [1, 4]], // meilleure distance
    [[1, 0], [1, 4]], // infini
    [[0, 0], [1, 1]], // NaN en tête
    [[1, 1], [0, 0]], // NaN après un préfixe coupable
    [[1, Infinity], [2, Infinity]], // distance zéro
    [[1, 1], [2, 1]], // plus grand que zéro
    [[1, 0]], [[1, 0]], // par condition nouveau puis égal
    [[0, 0]], // amélioration par condition malgré NaN
    [[-1, -Infinity]], // zéro signé
    [[Infinity, 1], [1, 1]],
    [[1, NaN], [1, 1]],
  ];
  for (const distanceInitiale of [Infinity, 1, 0, NaN, -Infinity]) {
    const courant = new Collecteur(prepared, true, false, v);
    const oracle = new Collecteur(prepared, true, false, v);
    (oracle as any).considererTypee = considererTypeeOracle;
    (courant as any).globalNearMissDistance = distanceInitiale;
    (oracle as any).globalNearMissDistance = distanceInitiale;
    for (let t = 0; t < essais.length; t++) {
      const essai = essais[t];
      const simulation = {
        conditions: v.conditions.map((c, i) => ({ ...c, seuil: essai[i]?.[1] ?? 1 })),
        echecs: Int32Array.from(essai, (_, i) => i), manques: Float64Array.from(essai, (e) => e[0]),
        runeIds: () => [t], lignes: () => [], effTotal: () => t,
        manquesDe: () => essai.map(([shortfall, requested], i) => ({ key: cles[i], kind: 'min', requested, actual: requested - shortfall, shortfall })),
      };
      for (const c of [courant, oracle]) {
        (c as any).materielCourant = null;
        (c as any).pos = t;
        (c as any).considererTypee(simulation, essai.length);
      }
      exigerIdentique(etatCollecteur(courant), etatCollecteur(oracle), `distance initiale ${distanceInitiale}, tentative ${t}`);
      exigerIdentique((courant as any).globalNearMissDistance, (oracle as any).globalNearMissDistance, `distance retenue, tentative ${t}`);
    }
  }
  ok(true, '65 tentatives aux frontières : mêmes quasi-succès et améliorations que le corps figé');
}

// VIT de base 103 : Swift vaut ceil(103 × 25 / 100) = 26, un vrai arrondi.
// PV/ATQ/DEF premiers avec 100 : tous les restes de `ceil(b × p / 100)`.
const BASE: BaseStats = { hp: 8073, atk: 517, def: 401, spd: 103, cr: 15, cd: 50, res: 15, acc: 0 };
// Tous les sets à bonus de fiche, les deux sets d'aura RES/PRE, des sets sans
// effet de fiche, et le joker.
const SETS_RICHES = ['violent', 'swift', 'energy', 'guard', 'fatal', 'blade', 'rage', 'focus', 'endure', 'tolerance', 'accuracy', 'will', 'intangible'];
const CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

function poolRiche(rng: () => number, parSlot: number): RuneDetail[] {
  const pool = randomPool(rng, parSlot, SETS_RICHES);
  for (const r of pool) if (rng() < 0.5) r.innate = { code: CODES[Math.floor(rng() * CODES.length)], value: 1 + Math.floor(rng() * 20) };
  return pool;
}

const artefact = (id: number, code: 100 | 101 | 102, value: number): ArtifactDetail => ({
  id, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code, value }, subs: [],
});

/** Une scène de validation : `prepared` (conditions, apports, relique) et des demi-builds tirés. */
interface Scene {
  nom: string;
  prepared: PreparedSearch;
  runesA: RuneDetail[];
  runesB: RuneDetail[];
}

// Tirage biaisé vers les sets demandés (et le joker) : sans biais, un set
// 4 pièces demandé ne tient presque jamais et les stats ne seraient pas jugées.
function demiBuilds(rng: () => number, pool: RuneDetail[], slots: number[], n: number, preferes: string[]): RuneDetail[] {
  const out: RuneDetail[] = [];
  for (let g = 0; g < n; g++) {
    for (const slot of slots) {
      const duSlot = pool.filter((r) => r.slot === slot);
      const favoris = duSlot.filter((r) => preferes.includes(r.set) || r.set === 'intangible');
      const parmi = favoris.length > 0 && rng() < 0.7 ? favoris : duSlot;
      out.push(parmi[Math.floor(rng() * parmi.length)]);
    }
  }
  return out;
}

function scenes(): Scene[] {
  const out: Scene[] = [];
  const demandes: string[][] = [[], ['violent'], ['swift'], ['energy', 'energy'], ['energy', 'guard', 'blade'], ['rage', 'tolerance'], ['fatal'], ['accuracy']];
  for (let s = 0; out.length < 24 && s < 200; s++) {
    const rng = mulberry32(9100 + s);
    const pool = poolRiche(rng, 12);
    // Une rune sans set (clé vide) : ignorée par `activeSets`.
    if (s % 3 === 0) pool[Math.floor(rng() * pool.length)].set = '';
    const minStats: BuildRequirement['minStats'] = {};
    const maxStats: NonNullable<BuildRequirement['maxStats']> = {};
    if (rng() < 0.7) minStats.spd = 140 + Math.floor(rng() * 60);
    if (rng() < 0.6) minStats.hp = 11_000 + Math.floor(rng() * 6000);
    if (rng() < 0.5) minStats.atk = 800 + Math.floor(rng() * 500);
    if (rng() < 0.4) minStats.cr = 30 + Math.floor(rng() * 60) + 0.5 * Math.floor(rng() * 2);
    if (rng() < 0.5) minStats.res = 40 + Math.floor(rng() * 50);
    if (rng() < 0.4) minStats.acc = 20 + Math.floor(rng() * 50);
    if (rng() < 0.5) maxStats.def = 700 + Math.floor(rng() * 500);
    if (rng() < 0.4) maxStats.acc = 50 + Math.floor(rng() * 50);
    if (rng() < 0.3) maxStats.cd = 120 + Math.floor(rng() * 80);
    if (rng() < 0.3) maxStats.res = 70 + Math.floor(rng() * 40);
    const aura = rng();
    const requirement: BuildRequirement = {
      sets: demandes[s % demandes.length], minStats, maxStats,
      ...(aura < 0.4 ? { auraResPre: { res: 16, acc: 8, compter: true } } : aura < 0.6 ? { auraResPre: { res: 16, acc: 8, compter: false } } : {}),
    };
    const artefacts = rng() < 0.5 ? [artefact(1, 100, 1500 + Math.floor(rng() * 1000)), artefact(2, 101, 60 + Math.floor(rng() * 40))] : [];
    const possibles = rng() < 0.6;
    const relique = rng();
    const relics: RelicDetail[] = [
      { id: 11, upgrade: 9, main: { code: 100, value: 7 + Math.floor(rng() * 10) } },
      { id: 12, upgrade: 9, main: { code: 101, value: 7 + Math.floor(rng() * 10) } },
      { id: 13, upgrade: 9, main: { code: 102, value: 7 + Math.floor(rng() * 10) } },
    ];
    const params: SearchParams = {
      base: BASE, artifacts: artefacts, pool, requirement, metric: rng() < 0.5 ? 'eff' : 'score', maxMs: Infinity, maxCollected: Infinity,
      ...(possibles ? { artifactBounds: { max: { hp: 2500, atk: 100, def: 100 }, min: { hp: 0, atk: 0, def: 0 }, possibles: [{ hp: 2500 }, { atk: 100 }, { hp: 1200, def: 100 }, { def: 100 }] } } : {}),
      ...(relique < 0.35 ? { relic: relics[Math.floor(rng() * 3)] } : relique < 0.7 ? { relicContext: resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, relics) } : {}),
    };
    const prepared = prepareSearch(params);
    if (!prepared) continue;
    out.push({
      nom: `scène ${s} (sets ${requirement.sets.join('+') || '—'}, ${prepared.minEntries.length} min, ${prepared.maxEntries.length} max, aura ${requirement.auraResPre ? (requirement.auraResPre.compter ? 'comptée' : 'éteinte') : '—'}, ${prepared.artPossibles.length} apport(s), relique ${prepared.relicRelache ? 'recherche' : params.relic ? 'portée' : '—'})`,
      prepared,
      runesA: demiBuilds(rng, prepared.filtered.flat(), [1, 2, 3], 36, requirement.sets),
      runesB: demiBuilds(rng, prepared.filtered.flat(), [4, 5, 6], 36, requirement.sets),
    });
  }
  return out;
}

const runesDe = (sc: Scene, ga: number, gb: number) => [...sc.runesA.slice(3 * ga, 3 * ga + 3), ...sc.runesB.slice(3 * gb, 3 * gb + 3)];

/* --------------------------------------------------------------------------
 * 1. Cas écrits
 * ----------------------------------------------------------------------- */

function rune(id: number, slot: number, set: string, extra: Partial<RuneDetail> = {}): RuneDetail {
  return { id, slot, set, rank: 6, rarity: 5, level: 15, main: { code: slot === 1 ? 3 : slot === 3 ? 5 : slot === 5 ? 1 : 8, value: 100 }, subs: [{ code: 8, value: 5 }, { code: 2, value: 7 }], ...extra };
}

function testCasEcrits(): void {
  titre('Validation rapide · règles des sets, cas écrits (contre activeSets/computeStats)');
  const cas: { nom: string; sets: string[]; demandes: string[]; base?: Partial<BaseStats> }[] = [
    { nom: 'joker + deux sets incomplets : il ne complète rien', sets: ['violent', 'violent', 'violent', 'energy', 'intangible', 'will'], demandes: ['violent'] },
    { nom: 'joker qui complète un set 4 pièces (3 + joker)', sets: ['violent', 'violent', 'violent', 'intangible', 'energy', 'energy'], demandes: ['violent'] },
    { nom: 'deux Intangible : un seul compte', sets: ['swift', 'swift', 'swift', 'intangible', 'intangible', 'guard'], demandes: ['swift'] },
    { nom: 'joker, set à 2 pièces manquantes : rien', sets: ['violent', 'violent', 'intangible', 'energy', 'energy', 'blade'], demandes: ['violent'] },
    { nom: 'six Energy : trois activations', sets: ['energy', 'energy', 'energy', 'energy', 'energy', 'energy'], demandes: ['energy', 'energy', 'energy'] },
    { nom: 'multiplicité : deux Energy demandés, un seul actif', sets: ['energy', 'energy', 'guard', 'guard', 'blade', 'rage'], demandes: ['energy', 'energy'] },
    { nom: 'clé de set vide ignorée', sets: ['', 'endure', 'endure', 'focus', 'focus', 'intangible'], demandes: ['endure', 'focus'] },
    { nom: 'Swift sur une VIT de base non multiple de 4', sets: ['swift', 'swift', 'swift', 'swift', 'tolerance', 'tolerance'], demandes: ['swift'], base: { spd: 101 } },
    { nom: 'Tolerance + Accuracy + joker, auras comptées', sets: ['tolerance', 'tolerance', 'accuracy', 'intangible', 'fatal', 'fatal'], demandes: [] },
    { nom: 'Intangible demandé (jamais actif)', sets: ['intangible', 'energy', 'energy', 'guard', 'guard', 'blade'], demandes: ['intangible'] },
  ];
  for (const [i, c] of cas.entries()) {
    const runes = c.sets.map((set, r) => rune(1000 * i + r + 1, r + 1, set));
    const params: SearchParams = {
      base: { ...BASE, ...c.base }, artifacts: [], pool: runes, metric: 'eff', maxMs: Infinity,
      requirement: { sets: [], minStats: { spd: 1, res: 1 }, maxStats: { cr: 1000, acc: 1000 }, auraResPre: { res: 8, acc: 0, compter: true } },
    };
    const prepared = prepareSearch(params);
    if (!prepared) throw new Error(`préparation vide (${c.nom})`);
    const p: PreparedSearch = { ...prepared, requirement: { ...prepared.requirement, sets: c.demandes } };
    const v = new ValidationTypee(p, runes.slice(0, 3), runes.slice(3));
    egal(v.motif, null, `${c.nom} : contrat tenu`);
    const bilan = bilanVide();
    egal(comparerPaire(v, p, 0, 0, runes, bilan), null, `${c.nom} : même verdict, mêmes StatRow, mêmes manques que la production`);
  }
}

/* --------------------------------------------------------------------------
 * 2. Paire par paire, 3. Collecteur
 * ----------------------------------------------------------------------- */

function testPaireParPaire(sc: Scene[]): void {
  titre('Validation rapide · paire par paire sur demi-builds tirés (contre activeSets/computeStats/pairBuckets)');
  const total = bilanVide();
  for (const s of sc) {
    const v = new ValidationTypee(s.prepared, s.runesA, s.runesB);
    egal(v.motif, null, `${s.nom} : contrat tenu`);
    const bilan = bilanVide();
    for (let ga = 0; ga < s.runesA.length / 3; ga++) {
      for (let gb = 0; gb < s.runesB.length / 3; gb++) {
        const ecart = comparerPaire(v, s.prepared, ga, gb, runesDe(s, ga, gb), bilan);
        if (ecart) throw new Error(`${s.nom}, ${bilan.premierEcart}`);
      }
    }
    egal(bilan.premierEcart, null, `${s.nom} : ${bilan.paires} paires, ${bilan.statsComparees} StatRow, ${bilan.tentatives} tentatives, ${bilan.collectables} collectables — aucun écart`);
    for (const k of Object.keys(total) as (keyof typeof total)[]) if (k !== 'premierEcart') (total[k] as number) += bilan[k] as number;
  }
  // Un contrôle qui n'exerce pas chaque issue ne prouve rien sur elle.
  ok(total.setsRefuses > 0 && total.statsComparees > 0 && total.collectables > 0 && total.tentatives > total.statsComparees,
    `les issues sont exercées : ${total.setsRefuses} paires refusées par les sets, ${total.statsComparees} jugées, ${total.collectables} collectables, ${total.tentatives} tentatives`);
  // De même en relique `recherche` : des paires jugées relique par relique,
  // dont certaines qu'aucune tentative ne retient.
  ok(total.reliquesOu > 0 && total.reliquesOuRejetes > 0 && total.reliquesOuRejetes < total.reliquesOu,
    `relique en « OU » exercée sur le chemin typé : ${total.reliquesOu} paires jugées relique par relique, ${total.reliquesOuRejetes} rejetées`);
}

function testCollecteur(sc: Scene[]): void {
  titre('Validation rapide · collecteur typé = collecteur de référence (candidats, quasi-succès, améliorations)');
  let ameliorations = 0;
  let candidats = 0;
  for (const s of sc) {
    const v = new ValidationTypee(s.prepared, s.runesA, s.runesB);
    const typee = new Collecteur(s.prepared, true, true, v);
    const oracle = new Collecteur(s.prepared, true, true, new ValidationTypee(s.prepared, s.runesA, s.runesB));
    (oracle as any).considererTypee = considererTypeeOracle;
    const reference = new Collecteur(s.prepared, true, true);
    let pos = 0;
    for (let ga = 0; ga < s.runesA.length / 3; ga++) {
      for (let gb = 0; gb < s.runesB.length / 3; gb++) {
        pos++;
        const a = typee.validerTypee(ga, gb, pos);
        oracle.validerTypee(ga, gb, pos);
        exigerIdentique(etatCollecteur(typee), etatCollecteur(oracle), `${s.nom}, paire (${ga}, ${gb})`);
        const b = reference.valider(runesDe(s, ga, gb), pos);
        if (a !== b) throw new Error(`${s.nom} : verdict divergent à la paire (${ga}, ${gb})`);
      }
    }
    const etat = (c: Collecteur) => ({
      candidates: c.candidates, positions: c.positions, nearMissByCondition: c.snapshot(), globalNearMiss: c.globalNearMiss, ameliorations: c.ameliorations,
    });
    ok(strictementEgal(etat(typee), etat(reference)), `${s.nom} : ${typee.candidates.length} candidats, ${typee.ameliorations!.length} améliorations du quasi-succès, identiques`);
    ameliorations += typee.ameliorations!.length;
    candidats += typee.candidates.length;
  }
  ok(ameliorations > sc.length && candidats > 0, `quasi-succès et collecte exercés : ${ameliorations} améliorations, ${candidats} candidats`);
}

/* --------------------------------------------------------------------------
 * 4. Bout en bout
 * ----------------------------------------------------------------------- */

const etatDe = (r: Pick<SearchResult, 'candidates' | 'explored' | 'truncated' | 'nearMissByCondition' | 'globalNearMiss'>) => ({
  candidates: r.candidates, explored: r.explored, truncated: r.truncated, nearMissByCondition: r.nearMissByCondition, globalNearMiss: r.globalNearMiss,
});

function arreterAuPalier(gen: ReturnType<typeof pairBuckets>, limite: number): SearchResult {
  let step = gen.next();
  while (!step.done) {
    if (step.value.explored >= limite) {
      gen.return(undefined as never);
      return { ...step.value, truncated: true };
    }
    step = gen.next();
  }
  return step.value;
}

async function testProfilsHarnais(): Promise<void> {
  titre('Validation rapide · recherches du harnais, candidats entiers, comptes, quasi-succès et motif');
  for (const nom of ['fumee', 'complet-sensible']) {
    const config = configDuProfil(trouverProfil(nom), { overrides: { maxMs: Infinity, maxCollected: Infinity } });
    const { params } = resoudreConfig(config);
    const p = prepareSearch(params)!;
    const A = drain(construireMoitieTypee('A', [0, 1, 2], p, p.maxSetsForA));
    const B = drain(construireMoitieTypee('B', [3, 4, 5], p, p.maxSetsForB));
    const objetsA = objetsDesCompartiments(A, p.filtered);
    const objetsB = objetsDesCompartiments(B, p.filtered);
    const total = totalPairCount(p, objetsA, objetsB);
    const ref = drain(pairBuckets(p, objetsA, objetsB));
    // Le vrai harnais appelle le même lanceur compact que l'écran.
    // Ses durées ne sont ni lues ni comparées par cette preuve de résultat.
    const h = await executerHarnais(config);
    exigerIdentique(etatDe(h.brut!), etatDe(ref), `harnais ${nom}`);
    exigerIdentique(evaluerCompletude(h.brut!, total, params), evaluerCompletude(ref, total, params), `harnais ${nom}, motif`);
    const petit = { ...p, maxCollected: 3 };
    const rPetit = drain(apparierRapide(petit, A, B));
    const refPetit = drain(pairBuckets(petit, objetsA, objetsB));
    exigerIdentique(etatDe(rPetit), etatDe(refPetit), `${nom}, petit plafond`);
    exigerIdentique(evaluerCompletude(rPetit, total, { ...params, maxCollected: 3 }), evaluerCompletude(refPetit, total, { ...params, maxCollected: 3 }), `${nom}, motif plafond`);
    const limite = 500 * Math.max(1, Math.floor(total / 1000));
    const coupe = arreterAuPalier(apparierRapide(p, A, B), limite);
    const refCoupe = arreterAuPalier(pairBuckets(p, objetsA, objetsB), limite);
    exigerIdentique(etatDe(coupe), etatDe(refCoupe), `${nom}, arrêt logique ${limite}`);
    const par = await apparierRapideEnParallele({
      params, prepared: p, bucketsA: A, bucketsB: B, totalPaires: total, travailleurs: 3,
      lancer: lancerSimule(mulberry32(991)), startedAt: p.startedAt, cibleMorceau: Math.max(1, Math.ceil(total / 23)),
    });
    exigerIdentique(etatDe(par), etatDe(ref), `${nom}, quasi-succès par morceau puis fusion`);
    exigerIdentique(par.traitees, par.visitees + par.sautees, `${nom}, comptes fusionnés`);
    exigerIdentique(par.traitees, total, `${nom}, épuisement`);
    ok(true, `${nom} : ${total} paires, ${ref.candidates.length} candidats, complets/plafond/arrêt logique/fusion identiques`);
  }
}

async function testIntervallesEtAuras(): Promise<void> {
  titre('Validation rapide · intervalles min+max, Intangible, aura et repli numérique');
  const relics: RelicDetail[] = [
    ...[7, 12, 19].map((value, i) => ({ id: i + 1, upgrade: 9, main: { code: 100, value } })),
    { id: 4, upgrade: 9, main: { code: 101, value: 12 } },
    { id: 5, upgrade: 9, main: { code: 102, value: 8 } },
  ];
  for (const compter of [true, false]) for (const fractionnaire of [false, true]) {
    const pool = randomPool(mulberry32(20260), 5, ['tolerance', 'accuracy', 'energy', 'intangible', 'violent']);
    const params: SearchParams = {
      base: { ...BASE, atk: fractionnaire ? 517.25 : 517 }, pool, artifacts: [artefact(1, 100, 1500)],
      requirement: {
        sets: [], minStats: { hp: 12000, atk: 500, spd: 130, res: 40, acc: 20 },
        maxStats: { hp: 25000, atk: 2000, spd: 250, res: 70, acc: 60 },
        auraResPre: { compter, res: 16, acc: 8 },
      },
      relicContext: resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, relics),
      artifactBounds: { max: { hp: 3000, atk: 200, def: 200 }, min: { hp: 0, atk: 0, def: 0 }, possibles: [{ hp: 3000 }, { hp: 1500, atk: 100 }, { atk: 200 }, { def: 200 }] },
      metric: 'eff', slotFilterCap: 80, maxMs: Infinity, maxCollected: Infinity,
    };
    const p = prepareSearch(params);
    if (!p) throw new Error('scène intervalles non préparée');
    const A = drain(construireMoitieTypee('A', [0, 1, 2], p, p.maxSetsForA));
    const B = drain(construireMoitieTypee('B', [3, 4, 5], p, p.maxSetsForB));
    const objetsA = objetsDesCompartiments(A, p.filtered), objetsB = objetsDesCompartiments(B, p.filtered);
    const total = totalPairCount(p, objetsA, objetsB);
    const nom = `intervalles, aura ${compter}, base fractionnaire ${fractionnaire}`;
    const ref = drain(pairBuckets(p, objetsA, objetsB));
    const r = drain(apparierRapide(p, A, B));
    exigerIdentique(etatDe(r), etatDe(ref), nom);
    exigerIdentique([r.traitees, r.visitees + r.sautees], [total, total], `${nom}, comptes`);
    exigerIdentique(evaluerCompletude(r, total, params), evaluerCompletude(ref, total, params), `${nom}, motif`);
    exigerIdentique(r.chemin, fractionnaire ? 'actuel' : 'noyau', `${nom}, chemin numérique`);
    ok(ref.candidates.length > 3 && (ref.nearMissByCondition.length > 0 || ref.globalNearMiss !== null), `${nom} : conformes et quasi-succès exercés`);
    ok(p.filtered.flat().some((r) => r.set === 'intangible'), `${nom} : Intangible dans le pool préparé`);
    for (const plafond of [3, Infinity]) {
      const pp = { ...p, maxCollected: plafond };
      const rr = drain(apparierRapide(pp, A, B));
      const attendu = drain(pairBuckets(pp, objetsA, objetsB));
      exigerIdentique(etatDe(rr), etatDe(attendu), `${nom}, plafond ${plafond}`);
      exigerIdentique(evaluerCompletude(rr, total, { ...params, maxCollected: plafond }), evaluerCompletude(attendu, total, { ...params, maxCollected: plafond }), `${nom}, motif plafond ${plafond}`);
    }
    exigerIdentique(etatDe(arreterAuPalier(apparierRapide(p, A, B), 500)), etatDe(arreterAuPalier(pairBuckets(p, objetsA, objetsB), 500)), `${nom}, arrêt logique`);
    if (!fractionnaire) {
      const par = await apparierRapideEnParallele({
        params, prepared: p, bucketsA: A, bucketsB: B, totalPaires: total, travailleurs: 3,
        lancer: lancerSimule(mulberry32(992)), startedAt: p.startedAt, cibleMorceau: Math.max(1, Math.ceil(total / 17)),
      });
      exigerIdentique(etatDe(par), etatDe(ref), `${nom}, fusion`);
    } else ok(r.motifChemin?.includes('entière') === true, `${nom} : motif de repli explicite`);
  }
}

function lancerSimule(rng: () => number): LancerTravailleur {
  return (init: InitTravailleur) => {
    const ctx = initialiserTravailleur(structuredClone(init));
    let rappel: (r: ResultatMorceau) => void = () => {};
    return {
      envoyer: (m: Morceau) => {
        const copie = structuredClone(m);
        setTimeout(() => rappel(structuredClone(traiterMorceau(ctx, copie))), Math.floor(rng() * 4));
      },
      surMessage: (r) => {
        rappel = r;
      },
      surErreur: () => {},
      arreter: () => {},
      terminer: () => {},
    };
  };
}

async function testBoutEnBout(): Promise<void> {
  titre('Validation rapide · apparierRapide typé = pairBuckets (contrôle de chaque survivant de quickOk)');
  let espaces = 0;
  let survivants = 0;
  for (let s = 0; espaces < 8 && s < 120; s++) {
    const rng = mulberry32(7300 + s);
    const pool = poolRiche(rng, 5 + Math.floor(rng() * 3));
    const requirement: BuildRequirement = {
      sets: [[], ['violent'], ['swift'], ['energy']][s % 4],
      minStats: { spd: 120 + Math.floor(rng() * 50), ...(rng() < 0.5 ? { hp: 9000 + Math.floor(rng() * 4000) } : {}), ...(rng() < 0.5 ? { res: 30 + Math.floor(rng() * 40) } : {}) },
      maxStats: rng() < 0.5 ? { def: 700 + Math.floor(rng() * 500) } : {},
      ...(rng() < 0.6 ? { auraResPre: { res: 16, acc: 8, compter: true } } : {}),
    };
    const params: SearchParams = {
      base: BASE, artifacts: [], pool, requirement, metric: 'eff', maxMs: Infinity, maxCollected: Infinity, slotFilterCap: 80,
      ...(rng() < 0.6 ? { artifactBounds: { max: { hp: 1500, atk: 100 }, min: { hp: 0, atk: 0 }, possibles: [{ hp: 1500 }, { atk: 100 }] } } : {}),
      ...(rng() < 0.5 ? { relicContext: resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, [{ id: 11, upgrade: 9, main: { code: 100, value: 12 } }, { id: 12, upgrade: 9, main: { code: 102, value: 9 } }]) } : {}),
    };
    const prepared = prepareSearch(params);
    if (!prepared) continue;
    const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, params.combosOrderMode));
    const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, params.combosOrderMode));
    const total = totalPairCount(prepared, bucketsA, bucketsB);
    if (total === 0) continue;
    const reference = etatDe(drain(pairBuckets(prepared, bucketsA, bucketsB)));
    if (reference.candidates.length === 0) continue;
    espaces++;
    const nom = `espace ${s} (${total} paires, ${reference.candidates.length} candidats)`;
    // Le contrôle a sa PROPRE instance : celle du collecteur garde son état courant.
    const controle = new ValidationTypee(prepared, runesAPlat(bucketsA), runesAPlat(bucketsB));
    const bilan = bilanVide();
    const r = drain(apparierRapide(prepared, bucketsA, bucketsB, { controleValidation: { paire: (ga, gb, runes) => comparerPaire(controle, prepared, ga, gb, runes, bilan) } }));
    egal(r.cheminValidation, 'typee', `${nom} : validation typée prise`);
    egal(bilan.premierEcart, null, `${nom} : ${bilan.paires} survivants de quickOk contrôlés paire par paire, aucun écart`);
    survivants += bilan.paires;
    ok(strictementEgal(etatDe(r), reference), `${nom} : apparierRapide typé = pairBuckets`);
    exigerIdentique([r.traitees, r.visitees + r.sautees], [total, total], `${nom}, comptes complets`);
    exigerIdentique(evaluerCompletude(r, total, params), evaluerCompletude(reference, total, params), `${nom}, motif`);
    if (total > 500) {
      exigerIdentique(etatDe(arreterAuPalier(apparierRapide(prepared, bucketsA, bucketsB), 500)), etatDe(arreterAuPalier(pairBuckets(prepared, bucketsA, bucketsB), 500)), `${nom}, arrêt logique 500`);
    }
    const ref2 = drain(apparierRapide(prepared, bucketsA, bucketsB, { forcerValidation: 'reference' }));
    egal(ref2.cheminValidation, 'reference', `${nom} : validation de référence imposée`);
    ok(strictementEgal(etatDe(ref2), reference), `${nom} : apparierRapide de référence = pairBuckets`);
    const petit: PreparedSearch = { ...prepared, maxCollected: 2 };
    ok(strictementEgal(etatDe(drain(apparierRapide(petit, bucketsA, bucketsB))), etatDe(drain(pairBuckets(petit, bucketsA, bucketsB)))), `${nom} : maxCollected = 2, identique`);
    const par = await apparierRapideEnParallele({
      params: { ...params, maxCollected: Infinity }, prepared, bucketsA, bucketsB, totalPaires: total, travailleurs: 3,
      lancer: lancerSimule(mulberry32(5)), startedAt: Date.now(), cibleMorceau: Math.max(1, Math.ceil(total / 23)),
    });
    egal(par.cheminValidation, 'typee', `${nom} : morceaux validés sur tableaux typés`);
    ok(strictementEgal(etatDe(par), reference), `${nom} : parallèle simulé (3 Workers, désordre) = pairBuckets`);
  }
  ok(espaces >= 6 && survivants > 0, `${espaces} espaces, ${survivants} survivants contrôlés`);

  titre('Validation rapide · contrat non tenu → chemin de référence, résultat inchangé');
  const rng = mulberry32(4242);
  const pool = poolRiche(rng, 4);
  pool[0].subs[0] = { ...pool[0].subs[0], value: 12.5 };
  const params: SearchParams = { base: BASE, artifacts: [], pool, requirement: { sets: [], minStats: { spd: 110 } }, metric: 'eff', maxMs: Infinity, maxCollected: Infinity };
  const prepared = prepareSearch(params)!;
  const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
  const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));
  const motif = validationDe(prepared, runesAPlat(bucketsA), runesAPlat(bucketsB)).motif;
  ok(motif != null && motif.includes('non entière'), `motif du refus : ${motif}`);
  const r = drain(apparierRapide(prepared, bucketsA, bucketsB));
  egal(r.cheminValidation, 'reference', 'valeur non entière : validation de référence');
  ok(strictementEgal(etatDe(r), etatDe(drain(pairBuckets(prepared, bucketsA, bucketsB)))), 'valeur non entière : résultat = pairBuckets');
}

export default async function testValidationRapide(): Promise<void> {
  testDistanceCoupee();
  testCasEcrits();
  const sc = scenes();
  ok(sc.length >= 20, `${sc.length} scènes construites`);
  testPaireParPaire(sc);
  await avecOracleDistance(async () => {
    testCollecteur(sc);
    await testBoutEnBout();
    await testProfilsHarnais();
    await testIntervallesEtAuras();
  });
}
