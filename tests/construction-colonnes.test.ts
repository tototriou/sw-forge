// Différentiel du chemin en colonnes contre buildBuckets + union objet.
// L'oracle construit chaque cran depuis SES paramètres, sans appeler le
// matérialiseur typé. Aucun chrono : seul le résultat est comparé.
import { Bucket, PreparedSearch, SearchParams, SearchResult, buildBuckets, pairBuckets, prepareSearch, totalPairCount } from '../src/lib/runeBuildOptim';
import { construireMoitieTypee, searchBuilds } from '../src/lib/rechercheRunes';
import { construireMoitiesEmboiteesTypees, entreeDeTranche, lancerConstruction, requetesDeLaMoitie, TravailleurConstruction } from '../src/lib/constructionEmboitee';
import { UnionDesRetentions } from '../src/lib/retentionEmboitee';
import { construireTranche, fusionnerTranchesTypees, OrdreCombos, premiereDivergence, repartirIdx0, tamponsDeTranche } from '../src/lib/constructionRapide';
import { CompartimentType, objetsDesCompartiments, tamponsDesDemiBuilds, typerCompartiments } from '../src/lib/demiBuildsTypes';
import { apparierRapide, compterPaires, encoderCompartiments, tamponsDe, verifierContrat } from '../src/lib/appariementRapide';
import { enResultatDeRecherche } from '../src/lib/appariementRapideParallele';
import { apparierObjetPourTest as apparierRapideEnParallele } from './flux-candidats.test';
import { assurerBundleAppariementRapide, lancerTravailleurNode } from '../scripts/lib/appariementRapideNode';
import { construireMoitiesEnParallele, creerConstructionNode, ensureBuildHalfBundle } from '../scripts/lib/buildHalvesNode';
import { nombreDeTravailleurs } from '../src/workers/parallelPairing';
import { SETS_JOKER, mulberry32, randomPool } from '../scripts/lib/randomPool';
import { drain } from '../scripts/lib/drain';
import { egal, ok, titre } from './outils';

const BASE = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const ORDRES: OrdreCombos[] = ['potential', 'relevance', 'combined', 'objective'];

function reference(p: PreparedSearch, half: 'A' | 'B', mode: OrdreCombos): Bucket[] {
  const requetes = requetesDeLaMoitie(p, half, mode);
  const construire = (r: typeof requetes[number]) => drain(buildBuckets(half, r.slotIdxs, r, r.otherHalfMaxSets, undefined, mode));
  const propre = construire(requetes[0]);
  const slots = requetes[0].slotIdxs;
  const union = new UnionDesRetentions(propre, [p.filtered[slots[0]], p.filtered[slots[1]], p.filtered[slots[2]]]);
  for (const r of requetes.slice(1)) union.ajouter(construire(r));
  return union.resultat(p, mode);
}

function identiques(attendu: unknown, recu: unknown, cas: string): void {
  function comparer(a: unknown, b: unknown, chemin: string): void {
    if (Object.is(a, b)) return;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object' || a.constructor !== b.constructor) {
      const valeur = (v: unknown) => Object.is(v, -0) ? '-0' : String(v);
      throw new Error(`Premier écart ${cas}, ${chemin} : attendu ${valeur(a)}, reçu ${valeur(b)}`);
    }
    if (Array.isArray(a) && Array.isArray(b)) comparer(a.length, b.length, `${chemin}.length`);
    const clesA = Object.keys(a).sort();
    const clesB = Object.keys(b).sort();
    if (clesA.length !== clesB.length || clesA.some((k, i) => k !== clesB[i])) {
      throw new Error(`Premier écart ${cas}, ${chemin} : clés ${clesA} / ${clesB}`);
    }
    for (const k of clesA) comparer((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${chemin}.${k}`);
  }
  comparer(attendu, recu, '$');
  ok(true, cas);
}

const etat = (r: SearchResult) => [r.candidates, r.explored, r.truncated, r.nearMissByCondition, r.globalNearMiss];

function comparerMoitie(p: PreparedSearch, half: 'A' | 'B', mode: OrdreCombos, nom: string): { objet: Bucket[]; typee: CompartimentType[] } {
  const slots = half === 'A' ? [0, 1, 2] as const : [3, 4, 5] as const;
  const objet = reference(p, half, mode);
  const typee = drain(construireMoitieTypee(half, slots, p, half === 'A' ? p.maxSetsForA : p.maxSetsForB, mode));
  const divergence = premiereDivergence(objet, objetsDesCompartiments(typee, p.filtered));
  if (divergence) throw new Error(`Premier écart ${nom}, ${half}, ${mode} : ${divergence}`);
  for (const [i, b] of typee.entries()) {
    const c = b.combos;
    const combos = objet[i].combos;
    identiques(Float64Array.from(combos.flatMap((hc) => hc.runes.map((r) => r.id))), c.ids, `${nom}, ${half}, compartiment ${i} : ids`);
    for (const champ of ['pct', 'flat'] as const) {
      identiques(Float64Array.from(combos.flatMap((hc) => c.cles.map((k) => hc[champ][k] ?? 0))), c[champ], `${nom}, ${half}, compartiment ${i} : ${champ}`);
    }
    identiques(Float64Array.from(combos.map((hc) => hc.relevanceScore)), c.relevance, `${nom}, ${half}, compartiment ${i} : pertinence`);
  }
  ok(true, `${nom}, ${half}, ${mode} : mêmes demi-builds, ordre, bornes et potentiel`);
  ok(typee.every((b) => !Array.isArray(b.combos) && b.combos.ids instanceof Float64Array), `${nom}, ${half} : stockage en colonnes`);
  return { objet, typee };
}

export default async function testConstructionColonnes() {
  titre('Construction en colonnes · oracle objet, rétentions emboîtées et transferts');
  for (const [a, b] of [[-0, 0], [NaN, null]]) {
    let refuse = false;
    try { identiques([a], [b], 'sentinelle du comparateur'); } catch { refuse = true; }
    ok(refuse, 'le comparateur distingue -0/0 et NaN/null');
  }
  identiques([NaN, -0], [NaN, -0], 'Object.is conserve NaN et -0');
  for (let seed = 0; seed < 12; seed++) {
    const params: SearchParams = {
      base: BASE, artifacts: [], pool: randomPool(mulberry32(10800 + seed), 6, SETS_JOKER), metric: 'eff',
      requirement: { sets: seed % 2 ? ['violent'] : [], minStats: { hp: 9000, spd: 125, cr: 25 }, maxStats: { def: 1500, acc: 80 } },
      objectiveStats: ['atk', 'cd'], slotFilterCap: seed % 2 ? 40 : 300, bucketCap: 3,
      maxMs: Infinity, maxCollected: Infinity,
      artifactBounds: { max: { hp: 2500, atk: 100 }, min: {}, possibles: [{ hp: 2500 }, { atk: 100 }] },
    };
    const p = prepareSearch(params);
    if (!p) throw new Error(`préparation vide : seed ${seed}`);
    for (const mode of ORDRES) {
      const a = comparerMoitie(p, 'A', mode, `seed ${seed}`);
      const b = comparerMoitie(p, 'B', mode, `seed ${seed}`);
      for (const plafond of [Infinity, 7]) {
        const contexte = { ...p, maxCollected: plafond };
        const ref = drain(pairBuckets(contexte, a.objet, b.objet));
        const r = drain(apparierRapide(contexte, a.typee, b.typee));
        identiques(etat(ref), etat(r), `seed ${seed}, ${mode}, plafond ${plafond} : candidats, compte, quasi-succès et arrêt`);
        egal(r.traitees, ref.explored, 'traitees identique à explored de référence');
      }
      egal(compterPaires(p, a.typee, b.typee), totalPairCount(p, a.objet, b.objet), 'compte exact des mêmes paires');
    }
    const ref = drain(pairBuckets(p, reference(p, 'A', 'objective'), reference(p, 'B', 'objective')));
    identiques(etat(ref), etat(searchBuilds(params)), `seed ${seed} : pipeline public en colonnes`);
  }

  // Rétention sous pression, crans inclus : la petite capacité du cran de
  // recherche force des ajouts que les crans plus étroits ont conservés.
  const params: SearchParams = { base: BASE, artifacts: [], pool: randomPool(mulberry32(10990), 45, SETS_JOKER), metric: 'eff',
    requirement: { sets: ['violent'], minStats: { spd: 130, cr: 35, atk: 800 } }, objectiveStats: ['atk', 'cd'],
    slotFilterCap: 300, bucketCap: 3, maxMs: Infinity, maxCollected: 17 };
  const p = prepareSearch(params)!;
  for (const mode of ORDRES) {
    const a = comparerMoitie(p, 'A', mode, 'éviction + crans');
    comparerMoitie(p, 'B', mode, 'éviction + crans');
    const seul = drain(construireMoitieTypee('A', [0, 1, 2], { ...p, cransEmboites: [] }, p.maxSetsForA, mode));
    ok(a.typee.reduce((n, b) => n + b.combos.length, 0) > seul.reduce((n, b) => n + b.combos.length, 0), 'l’union ajoute réellement des demi-builds');
  }
  const parallele = await construireMoitiesEmboiteesTypees(p, 'objective', async (r, progression) => {
    const gen = construireMoitieTypee(r.half, r.slotIdxs, r, r.otherHalfMaxSets, r.combosOrderMode);
    let step = gen.next();
    while (!step.done) { progression(step.value.scanned, step.value.total); step = gen.next(); }
    const tampons = tamponsDesDemiBuilds(step.value);
    const recu = structuredClone(step.value, { transfer: tampons });
    ok(tampons.every((t) => t.byteLength === 0), 'réponse de construction transférée, tampons détachés');
    await new Promise<void>((resolve) => setTimeout(resolve, (4 - r.rangPrereglage) * 2));
    return recu;
  });
  for (const [half, buckets] of [['A', parallele.bucketsA], ['B', parallele.bucketsB]] as const) {
    const d = premiereDivergence(reference(p, half, 'objective'), objetsDesCompartiments(buckets, p.filtered));
    if (d) throw new Error(`Premier écart union transférée ${half} : ${d}`);
    ok(true, `union transférée ${half} dans le désordre : référence identique`);
  }
  const ct = encoderCompartiments(p, parallele.bucketsA, parallele.bucketsB);
  const pct = ct.cles.filter((k) => ['hp', 'atk', 'def'].includes(k)).length;
  egal(ct.A.pct.length, pct * ct.A.ids.length / 3, 'seuls les pourcentages lus sont encodés');
  ok(!('relevance' in ct.A) && !('counts' in ct.A), 'aucune colonne de rétention ni métadonnée de compartiment dans l’encodage des Workers');
  const transferts = tamponsDe(ct);
  structuredClone(ct, { transfer: transferts });
  ok(transferts.every((t) => t.byteLength === 0), 'tous les tampons d’appariement sont transférables');
  const ref = drain(pairBuckets(p, reference(p, 'A', 'objective'), reference(p, 'B', 'objective')));
  const node = await construireMoitiesEnParallele(p, params, await ensureBuildHalfBundle());
  identiques(parallele.bucketsA, node.bucketsA, 'vrais Workers Node : mêmes colonnes A, crans inclus');
  identiques(parallele.bucketsB, node.bucketsB, 'vrais Workers Node : mêmes colonnes B, crans inclus');
  ok(node.bucketsA.every((b) => b.combos.ids instanceof Float64Array) && node.bucketsB.every((b) => b.combos.ids instanceof Float64Array), 'la coquille Node conserve les colonnes reçues des Workers');
  identiques(etat(ref), etat(drain(apparierRapide(p, node.bucketsA, node.bucketsB))), 'construction Node typée jusqu’à l’appariement : résultat objet identique');
  const r = await apparierRapideEnParallele({ params, prepared: p, ...parallele, totalPaires: compterPaires(p, parallele.bucketsA, parallele.bucketsB),
    startedAt: p.startedAt, travailleurs: 2, cibleMorceau: 2000, lancer: lancerTravailleurNode(await assurerBundleAppariementRapide()) });
  identiques(etat(ref), etat(enResultatDeRecherche(r)), 'vrais Workers : candidats, ordre, compte, quasi-succès, plafond identiques');

  // Les overrides hors Int32 et la validation fractionnaire restent exacts,
  // sans détour par des objets entre construction et appariement.
  for (const bucketCap of [3.5, -1, Infinity, 2 ** 31]) {
    const q = prepareSearch({ ...params, base: { ...BASE, atk: BASE.atk + 0.5 }, pool: randomPool(mulberry32(10991), 4, SETS_JOKER), slotFilterCap: 40, bucketCap })!;
    const a = comparerMoitie(q, 'A', 'objective', `cap ${bucketCap}`);
    const b = comparerMoitie(q, 'B', 'objective', `cap ${bucketCap}`);
    const repli = drain(apparierRapide(q, a.typee, b.typee));
    egal(repli.chemin, 'actuel', `cap ${bucketCap} : repli effectivement emprunté`);
    ok(repli.motifChemin?.startsWith('base atk non entière') === true, 'la base ATQ contrainte force le repli numérique');
    if (bucketCap > 0) ok(repli.traitees > 0, 'le repli parcourt réellement des paires');
    identiques(etat(drain(pairBuckets(q, a.objet, b.objet))), etat(repli), `cap ${bucketCap} : repli sans sauts en colonnes`);
  }

  // Base et apports entiers : la fraction vient de la rune elle-même,
  // conservée dans le demi-build sur une stat réellement contrainte.
  const poolFractionnaire = Array.from({ length: 6 }, (_, i) => ({
    id: 20000 + i, slot: i + 1, set: 'violent', rank: 6, rarity: 5, level: 15,
    main: { code: 3, value: i === 0 ? 10.5 : 100 }, subs: [],
  }));
  const fractionnaire = prepareSearch({ ...params, pool: poolFractionnaire,
    requirement: { sets: ['violent'], minStats: { atk: 800 } }, slotFilterCap: 40, maxCollected: Infinity })!;
  const fractionA = comparerMoitie(fractionnaire, 'A', 'objective', 'demi-build fractionnaire');
  const fractionB = comparerMoitie(fractionnaire, 'B', 'objective', 'demi-build fractionnaire');
  ok(verifierContrat(fractionnaire, fractionA.typee, fractionB.typee)?.startsWith('demi-build A : atk non entier') === true,
    'la fraction ATQ du demi-build contraint force le repli de verifierContrat');
  const refFractionnaire = drain(pairBuckets(fractionnaire, fractionA.objet, fractionB.objet));
  const repliFractionnaire = drain(apparierRapide(fractionnaire, fractionA.typee, fractionB.typee));
  egal(repliFractionnaire.chemin, 'actuel', 'demi-build fractionnaire : repli effectivement emprunté');
  ok(repliFractionnaire.traitees > 0 && refFractionnaire.candidates.length > 0, 'demi-build fractionnaire : paires et candidats réels');
  egal(repliFractionnaire.traitees, refFractionnaire.explored, 'demi-build fractionnaire : même compte traité');
  identiques(etat(refFractionnaire), etat(repliFractionnaire), 'demi-build fractionnaire : résultats et ordre identiques à la référence');

  const mixte = prepareSearch({ ...params, pool: randomPool(mulberry32(10992), 4, SETS_JOKER), slotFilterCap: 40 })!;
  const objetA = reference(mixte, 'A', 'objective');
  const objetB = reference(mixte, 'B', 'objective');
  ok(objetA.length > 0 && objetB.length > 0, 'cas mixte non vide');
  // Le stockage et le transport doivent conserver le signe, même si les
  // additions du calcul final peuvent légitimement produire +0.
  objetA[0].combos[0].flat.atk = -0;
  objetA[0].combos[0].relevanceScore = -0;
  const typeA = typerCompartiments(objetA);
  const typeB = typerCompartiments(objetB);
  ok(Object.is(typeA[0].combos.flat[typeA[0].combos.cles.indexOf('atk')], -0), 'la colonne conserve -0');
  const transferee = structuredClone(typeA, { transfer: tamponsDesDemiBuilds(typeA) });
  identiques(objetA, objetsDesCompartiments(transferee, mixte.filtered), '-0 : aller-retour objet / colonnes transférées');
  const attenduMixte = drain(pairBuckets(mixte, objetA, objetB));
  ok(attenduMixte.explored > 0, 'les compartiments mixtes parcourent des paires réelles');
  for (const [a, b] of [[objetA, typeB], [transferee, objetB]] as const) {
    const obtenu = drain(apparierRapide(mixte, a, b));
    egal(obtenu.chemin, 'noyau', 'appariement mixte sur le noyau réel');
    identiques(etat(attenduMixte), etat(obtenu), 'moitiés objet / typée : candidats, compte et quasi-succès');
    egal(compterPaires(mixte, a, b), totalPairCount(mixte, objetA, objetB), 'compte des compartiments mixtes');
  }

  // 1300³ codes possibles : les deux premières pièces Violent nécessaires
  // figurent en dernière position. Les codes retenus dépassent l'Int32,
  // sans parcourir le cube ; la rétention peut garder aussi des triplets
  // que seul l'appariement rejettera.
  const pools = [0, 1, 2].map((slot) => Array.from({ length: 1300 }, (_, i) => ({
    ...params.pool[slot], id: 2 ** 33 + slot * 1300 + i, slot: slot + 1, set: i === 1299 ? 'violent' : 'will',
  })));
  const grand: PreparedSearch = { ...p, filtered: [...pools, ...p.filtered.slice(3)], distinctKeys: ['violent'], requiredPieces: [4],
    jokerCredit: 0, cransEmboites: [], maxSetsForA: [1] };
  const grandA = comparerMoitie(grand, 'A', 'objective', 'code du triplet au-delà de 2³¹');
  ok(grandA.typee.some((b) => {
    const c = b.combos;
    for (let i = 0; i < c.length; i++) {
      if (c.ids[3 * i] === pools[0][1299].id && c.ids[3 * i + 1] === pools[1][1299].id && c.ids[3 * i + 2] === pools[2][1299].id) return true;
    }
    return false;
  }), 'le triplet final de grand code est réellement retenu');
}

export async function testConstructionTranches() {
  titre('Construction en tranches · ordre exact, crans, pool partagé et frontières');
  const params: SearchParams = { base: BASE, artifacts: [], pool: randomPool(mulberry32(23000), 45, SETS_JOKER), metric: 'eff',
    requirement: { sets: ['violent'], minStats: { spd: 130, cr: 35, atk: 800 } }, objectiveStats: ['atk', 'cd'],
    slotFilterCap: 300, bucketCap: 3, maxMs: Infinity, maxCollected: Infinity };
  const verifier = (p: PreparedSearch, mode: OrdreCombos, r: { bucketsA: CompartimentType[]; bucketsB: CompartimentType[] }, nom: string) => {
    for (const h of ['A', 'B'] as const) {
      const slots = h === 'A' ? [0, 1, 2] as const : [3, 4, 5] as const;
      const attendu = drain(construireMoitieTypee(h, slots, p, h === 'A' ? p.maxSetsForA : p.maxSetsForB, mode));
      const recu = h === 'A' ? r.bucketsA : r.bucketsB;
      identiques(attendu, recu, `${nom}, moitié ${h}, ${mode} : colonnes, ordre, bornes, potentiel`);
      const d = premiereDivergence(reference(p, h, mode), objetsDesCompartiments(recu, p.filtered));
      if (d) throw new Error(`Premier écart ${nom}, moitié ${h}, ${mode} : ${d}`);
    }
  };
  for (const seed of [23000, 23001, 23002]) for (const mode of ORDRES) {
    const p = prepareSearch({ ...params, pool: randomPool(mulberry32(seed), seed === 23000 ? 45 : 7, SETS_JOKER) })!;
    let crees = 0, termines = 0, enVol = 0, maximum = 0, transferts = 0;
    const appels = new Map<number, number>();
    const premiers: string[] = [];
    const points: Record<'A' | 'B', number> = { A: 0, B: 0 };
    const r = await lancerConstruction(p, mode, { concurrence: 16, coeursPhysiques: null,
      creer: () => {
        const fil = crees++;
        return { construire: async (requete, progression) => {
          appels.set(fil, (appels.get(fil) ?? 0) + 1);
          if (premiers.length < 6) premiers.push(`${requete.half}:${requete.rangPrereglage}`);
          enVol++; maximum = Math.max(maximum, enVol);
          // Réponses dans le désordre, sans budget-temps ni état partagé à corriger.
          for (let tour = 0; tour < (6 - fil); tour++) await new Promise<void>((resolve) => setImmediate(resolve));
          const resultat = construireTranche(entreeDeTranche(requete));
          progression(requete.idx0s.length);
          const tampons = tamponsDeTranche(resultat);
          const recu = structuredClone(resultat, { transfer: tampons });
          if (tampons.some((t) => t.byteLength)) throw new Error('Tampon de tranche non détaché.');
          transferts++;
          enVol--;
          return recu;
        }, terminer: () => { termines++; } };
      },
      progression: (half, scanned, total) => {
        if (scanned < points[half] || scanned > total) throw new Error(`Progression ${half} incohérente.`);
        points[half] = scanned;
        const attendu = p.filtered[half === 'A' ? 0 : 3].length + p.cransEmboites.reduce((n, c) => n + c.indices[half === 'A' ? 0 : 3].length, 0);
        if (total !== attendu) throw new Error(`totalConstruction ${half} : ${total}, attendu ${attendu}.`);
      },
    });
    verifier(p, mode, r, `seed ${seed}, crans emboîtés`);
    egal(crees, 6, 'six Workers pour seize fils, tous crans et moitiés confondus');
    egal(termines, crees, 'pool entier terminé au succès');
    ok(maximum <= 6 && transferts > crees && [...appels.values()].some((n) => n > 1), 'pool borné, Workers réutilisés, réponses transférées');
    ok(premiers.some((k) => k.startsWith('A:')) && premiers.some((k) => k.startsWith('B:'))
      && new Set(premiers.map((k) => k.split(':')[1])).size > 1, 'moitiés et crans se partagent le pool dès les premières tâches');
    for (const h of ['A', 'B'] as const) {
      const slots = h === 'A' ? [0, 1, 2] as const : [3, 4, 5] as const;
      egal(points[h], p.filtered[slots[0]].length + p.cransEmboites.reduce((n, c) => n + c.indices[slots[0]].length, 0), 'progression finale garantie');
      for (const requete of requetesDeLaMoitie(p, h, mode)) {
        const tranches = repartirIdx0(requete.filtered[slots[0]].length, 8).map((idx0s) => construireTranche(entreeDeTranche({ ...requete, idx0s })));
        const fusion = fusionnerTranchesTypees(requete, slots, requete.otherHalfMaxSets, mode, tranches.reverse());
        const attendu = drain(construireMoitieTypee(h, slots, requete, requete.otherHalfMaxSets, mode));
        identiques(attendu, fusion, `seed ${seed}, moitié ${h}, cran ${requete.rangPrereglage}, ${mode}`);
      }
    }
  }

  const chemin = await ensureBuildHalfBundle();
  for (const mode of ORDRES) {
    const p = prepareSearch({ ...params, pool: randomPool(mulberry32(23010), 20, SETS_JOKER), slotFilterCap: 80 })!;
    let crees = 0;
    const r = await lancerConstruction(p, mode, { concurrence: 16, coeursPhysiques: null,
      creer: () => { crees++; return creerConstructionNode(chemin); } });
    verifier(p, mode, r, 'vrais Workers réutilisés');
    egal(crees, 6, 'vrais Workers : règle commune des cœurs');
  }
  const p = prepareSearch(params)!;
  const vide = { ...p, cransEmboites: [], filtered: p.filtered.map(() => []) };
  let workersVides = 0;
  const rien = await lancerConstruction(vide, 'objective', { concurrence: 16, coeursPhysiques: null,
    creer: () => { workersVides++; return creerConstructionNode(chemin); } });
  verifier(vide, 'objective', rien, 'pools vides');
  egal(workersVides, 0, 'aucune tâche non vide : aucun Worker créé');
  for (const cap of [0, 3.5, -1, Infinity, 2 ** 31]) {
    const q: PreparedSearch = { ...p, bucketCap: cap, cransEmboites: [], filtered: p.filtered.map((pool, s) => pool.slice(0, s === 0 || s === 3 ? 1 : 4)) };
    let crees = 0;
    const r = await lancerConstruction(q, 'objective', { concurrence: 64, coeursPhysiques: null,
      creer: () => { crees++; return creerConstructionNode(chemin); } });
    verifier(q, 'objective', r, `une rune extérieure, cap ${cap}`);
    egal(crees, 2, 'huit fils possibles et deux tranches non vides : aucun Worker vide');
  }

  // Même contrat que les colonnes séquentielles, sans parcourir 1300³ triplets.
  const pools = [0, 1, 2].map((slot) => Array.from({ length: 1300 }, (_, i) => ({
    ...params.pool[slot], id: 2 ** 33 + slot * 1300 + i, slot: slot + 1, set: i === 1299 ? 'violent' : 'will',
  })));
  const grand: PreparedSearch = { ...p, filtered: [...pools, ...p.filtered.slice(3)], distinctKeys: ['violent'], requiredPieces: [4], jokerCredit: 0, cransEmboites: [], maxSetsForA: [1] };
  const requete = requetesDeLaMoitie(grand, 'A', 'objective')[0];
  const tranches = repartirIdx0(1300, 8).map((idx0s) => construireTranche(entreeDeTranche({ ...requete, idx0s })));
  ok(tranches.every((t) => t.codes instanceof Float64Array) && tranches.some((t) => t.codes.some((c) => c > 2 ** 31)), 'grands codes réellement émis en Float64');
  identiques(drain(construireMoitieTypee('A', [0, 1, 2], grand, grand.maxSetsForA)),
    fusionnerTranchesTypees(requete, requete.slotIdxs, requete.otherHalfMaxSets, 'objective', tranches), 'grands codes : même ordre et mêmes bornes');

  for (const [concurrence, coeurs] of [[undefined, null], [16, null], [64, 4]] as const) {
    let crees = 0, termines = 0, lances = 0;
    let panne: unknown;
    try {
      await lancerConstruction(p, 'objective', { concurrence, coeursPhysiques: coeurs,
        creer: (): TravailleurConstruction => { crees++; return {
          construire: async () => { lances++; throw new Error('panne de construction injectée'); },
          terminer: () => { termines++; },
        }; } });
    } catch (e) { panne = e; }
    ok(panne instanceof Error && panne.message === 'panne de construction injectée', 'panne propagée');
    egal(crees, nombreDeTravailleurs(concurrence, coeurs), 'la fabrique suit la règle commune, cœurs physiques prioritaires');
    egal(termines, crees, 'panne : tous les Workers terminés');
    egal(lances, crees, 'panne : aucune nouvelle tâche distribuée après rejet');
  }
  let annuler!: (e: Error) => void;
  const annulation = new Promise<never>((_, reject) => { annuler = reject; });
  let termines = 0;
  const arret = lancerConstruction(p, 'objective', { concurrence: 16, coeursPhysiques: null, annulation,
    creer: () => ({ construire: () => new Promise(() => {}), terminer: () => { termines++; } }) });
  annuler(new Error('arrêt manuel'));
  let refuse = false;
  try { await arret; } catch { refuse = true; }
  ok(refuse && termines === 6, 'arrêt pendant la construction : attente rejetée, pool entier terminé');

  let injectee = false, fermes = 0, erreur: unknown;
  try {
    await lancerConstruction(p, 'objective', { concurrence: 16, coeursPhysiques: null,
      creer: () => {
        const fil = creerConstructionNode(chemin);
        return { construire: (r, progression) => {
          const invalide = !injectee;
          injectee = true;
          return fil.construire(invalide ? { ...r, idx0s: [-1] } : r, progression);
        }, terminer: async () => { await fil.terminer(); fermes++; } };
      } });
  } catch (e) { erreur = e; }
  ok(erreur instanceof Error && /idx0s/.test(erreur.message), 'vrai Worker : erreur du noyau propagée au lanceur');
  egal(fermes, 6, 'vraie panne : tous les fils sortent avant le rejet du lanceur');
}
