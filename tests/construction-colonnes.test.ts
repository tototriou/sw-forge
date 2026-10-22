// Différentiel du chemin en colonnes contre buildBuckets + union objet.
// L'oracle construit chaque cran depuis SES paramètres, sans appeler le
// matérialiseur typé. Aucun chrono : seul le résultat est comparé.
import { Bucket, PreparedSearch, SearchParams, SearchResult, buildBuckets, pairBuckets, prepareSearch, totalPairCount } from '../src/lib/runeBuildOptim';
import { construireMoitieTypee, searchBuilds } from '../src/lib/rechercheRunes';
import { construireMoitiesEmboiteesTypees, requetesDeLaMoitie } from '../src/lib/constructionEmboitee';
import { UnionDesRetentions } from '../src/lib/retentionEmboitee';
import { OrdreCombos, premiereDivergence } from '../src/lib/constructionRapide';
import { CompartimentType, objetsDesCompartiments, tamponsDesDemiBuilds, typerCompartiments } from '../src/lib/demiBuildsTypes';
import { apparierRapide, compterPaires, encoderCompartiments, tamponsDe, verifierContrat } from '../src/lib/appariementRapide';
import { apparierRapideEnParallele, enResultatDeRecherche } from '../src/lib/appariementRapideParallele';
import { assurerBundleAppariementRapide, lancerTravailleurNode } from '../scripts/lib/appariementRapideNode';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from '../scripts/lib/buildHalvesNode';
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
