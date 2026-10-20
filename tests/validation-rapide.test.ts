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
import { LancerTravailleur, apparierRapideEnParallele } from '../src/lib/appariementRapideParallele';
import { ValidationTypee } from '../src/lib/validationRapide';
import { bilanVide, comparerPaire, strictementEgal } from '../scripts/lib/controleValidationRapide';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';

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
      for (let gb = 0; gb < s.runesB.length / 3; gb++) comparerPaire(v, s.prepared, ga, gb, runesDe(s, ga, gb), bilan);
    }
    egal(bilan.premierEcart, null, `${s.nom} : ${bilan.paires} paires, ${bilan.statsComparees} StatRow, ${bilan.tentatives} tentatives, ${bilan.collectables} collectables — aucun écart`);
    for (const k of Object.keys(total) as (keyof typeof total)[]) if (k !== 'premierEcart') (total[k] as number) += bilan[k] as number;
  }
  // Un contrôle qui n'exerce pas chaque issue ne prouve rien sur elle.
  ok(total.setsRefuses > 0 && total.statsComparees > 0 && total.collectables > 0 && total.tentatives > total.statsComparees,
    `les issues sont exercées : ${total.setsRefuses} paires refusées par les sets, ${total.statsComparees} jugées, ${total.collectables} collectables, ${total.tentatives} tentatives`);
}

function testCollecteur(sc: Scene[]): void {
  titre('Validation rapide · collecteur typé = collecteur de référence (candidats, quasi-succès, améliorations)');
  let ameliorations = 0;
  let candidats = 0;
  for (const s of sc) {
    const v = new ValidationTypee(s.prepared, s.runesA, s.runesB);
    const typee = new Collecteur(s.prepared, true, true, v);
    const reference = new Collecteur(s.prepared, true, true);
    let pos = 0;
    for (let ga = 0; ga < s.runesA.length / 3; ga++) {
      for (let gb = 0; gb < s.runesB.length / 3; gb++) {
        pos++;
        const a = typee.validerTypee(ga, gb, pos);
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
  testCasEcrits();
  const sc = scenes();
  ok(sc.length >= 20, `${sc.length} scènes construites`);
  testPaireParPaire(sc);
  testCollecteur(sc);
  await testBoutEnBout();
}
