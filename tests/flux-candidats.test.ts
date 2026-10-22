// Oracle objet intact, colonnes sur les mêmes compartiments ; aucun chronométrage.
import { BuildCandidate, Bucket, PairingProgress, SearchParams, SearchResult, SLOT_FILTER_PRESETS, pairBuckets, prepareSearch } from '../src/lib/runeBuildOptim';
import { apparierRapide, compterPaires } from '../src/lib/appariementRapide';
import { construireMoitieTypee } from '../src/lib/rechercheRunes';
import { objetsDesCompartiments } from '../src/lib/demiBuildsTypes';
import { ColonnesCandidats, LIGNES_PAR_BLOC, RecepteurCandidats, ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, objetsDesCandidats, tamponsCandidats } from '../src/lib/candidatsCompacts';
import { ErreurAppariementParallele, LancerTravailleur, apparierRapideEnParallele, enResultatDeRecherche } from '../src/lib/appariementRapideParallele';
import { tamponsResultatMorceau } from '../src/lib/travailleurAppariement';
import { EmetteurCandidats, drivePairing } from '../src/workers/pairingDriver';
import { assurerBundleAppariementRapide, lancerTravailleurNode } from '../scripts/lib/appariementRapideNode';
import { drain } from '../scripts/lib/drain';
import { mulberry32, randomPool, SETS_JOKER } from '../scripts/lib/randomPool';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { executerHarnais } from '../scripts/lib/diagnosticHarness';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import { RuneDetail } from '../src/types';
import { ok, titre } from './outils';

const BASE = { hp: 8073, atk: 517, def: 401, spd: 103, cr: 15, cd: 50, res: 15, acc: 0 };

/** Premier champ divergent, Object.is : NaN et -0 ne disparaissent pas dans JSON. */
function identiques(a: unknown, b: unknown, chemin: string): void {
  if (Object.is(a, b)) return;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) throw new Error(`${chemin} : ${String(a)} ≠ ${String(b)}`);
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) throw new Error(`${chemin} : ${ka.length} champs ≠ ${kb.length}`);
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) throw new Error(`${chemin}.${k} absent`);
    identiques((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${chemin}.${k}`);
  }
}
const etat = <C,>(r: SearchResult<C>) => ({ candidates: r.candidates, explored: r.explored, truncated: r.truncated, nearMissByCondition: r.nearMissByCondition, globalNearMiss: r.globalNearMiss });
const objets = (r: SearchResult<ColonnesCandidats>): SearchResult => ({ ...r, candidates: objetsDesCandidats(r.candidates) });

export async function testFluxCandidatsCompactOrdre() {
  titre('Flux candidats · même oracle, replis numériques, crans emboîtés');
  let gardes = 0, quasi = 0, replis = 0;
  for (let seed = 0; seed < 8; seed++) for (const preset of SLOT_FILTER_PRESETS) {
    const params: SearchParams = {
      base: seed === 7 ? { ...BASE, atk: 517.5 } : BASE,
      pool: randomPool(mulberry32(10800 + seed), 6, SETS_JOKER), artifacts: [], metric: seed % 2 ? 'score' : 'eff',
      requirement: { sets: seed % 2 ? ['violent'] : [], minStats: { hp: 9000, spd: 125, cr: 25, ...(seed === 7 ? { atk: 800 } : {}) }, maxStats: { def: 1500, acc: 80 } },
      objectiveStats: ['atk', 'cd'], slotFilterCap: preset.cap, bucketCap: 3, maxMs: Infinity, maxCollected: Infinity,
      artifactBounds: { max: { hp: 2500, atk: 100 }, min: {}, possibles: [{ hp: 2500 }, { atk: 100 }] },
      ...(seed % 3 === 0 ? { relicContext: resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined,
        [{ id: 1, upgrade: 9, main: { code: 100, value: 10 } }, { id: 2, upgrade: 9, main: { code: 101, value: 15 } }]) } : {}),
    };
    const p = prepareSearch(params);
    if (!p) throw new Error(`préparation vide ${seed}/${preset.key}`);
    const A = drain(construireMoitieTypee('A', [0, 1, 2], p, p.maxSetsForA));
    const B = drain(construireMoitieTypee('B', [3, 4, 5], p, p.maxSetsForB));
    const reference = drain(pairBuckets(p, objetsDesCompartiments(A, p.filtered), objetsDesCompartiments(B, p.filtered)));
    for (const forcerValidation of [undefined, 'reference'] as const) {
      const r = drain(apparierRapide(p, A, B, { collecte: creerColonnesCandidats(), forcerValidation }));
      identiques(etat(reference), etat(objets(r)), `seed ${seed}/${preset.key}/${forcerValidation ?? 'typée'}`);
      if (reference.candidates.length) identiques(JSON.stringify(reference.candidates[0]), JSON.stringify(objetsDesCandidats(r.candidates)[0]), 'forme sérialisée du candidat');
      identiques(r.traitees, reference.explored, 'traitees');
      if (r.chemin === 'actuel') replis++;
      gardes += r.candidates.length;
      quasi += r.nearMissByCondition.length + Number(r.globalNearMiss !== null);
    }
  }
  ok(gardes > 0 && quasi > 0 && replis > 0, `candidats, quasi-succès et repli exercés (${gardes}, ${quasi}, ${replis})`);
  ok(true, 'chaque candidat entier, son rang, les comptes et quasi-succès identiques à la référence');
  const profil = trouverProfil('quota-parallele');
  const parallele = await executerHarnais(configDuProfil(profil));
  const sequentiel = await executerHarnais(configDuProfil(profil, { overrides: { regime: 'sequentiel' } }));
  identiques(etat(parallele.brut!), etat(sequentiel.brut!), 'harnais quota-parallele : champ par champ');
  ok(true, 'harnais : candidats entiers et rangs identiques, indépendamment de la sérialisation des propriétés');
}

/** Doublons intentionnels : leur identité est l'ordinal, jamais la clé de runes. */
function espaceDense() {
  const pool: RuneDetail[] = Array.from({ length: 6 }, (_, i) => ({ id: 2 ** 40 + i, slot: i + 1, set: 'will', rank: 6, rarity: 5, level: 15,
    main: { code: 8, value: 5 }, subs: [{ code: 2, value: 8 }] }));
  const params: SearchParams = { base: BASE, artifacts: [], pool, requirement: { sets: [], minStats: {} }, metric: 'eff', maxMs: Infinity, maxCollected: Infinity, slotFilterCap: 20 };
  const p = prepareSearch(params)!;
  const dense = (half: 'A' | 'B'): Bucket[] => {
    const slots = half === 'A' ? [0, 1, 2] as const : [3, 4, 5] as const;
    const b = objetsDesCompartiments(drain(construireMoitieTypee(half, slots, p, half === 'A' ? p.maxSetsForA : p.maxSetsForB)), p.filtered);
    return b.map((x) => ({ ...x, combos: Array.from({ length: 256 }, () => x.combos[0]) }));
  };
  const A = dense('A'), B = dense('B');
  return { params, p, A, B, total: compterPaires(p, A, B) };
}

export async function testFluxCandidatsCoupe() {
  titre('Flux candidats · plafond, arrêt déterministe, temps et arrêt manuel');
  const e = espaceDense();
  const chemin = await assurerBundleAppariementRapide();
  for (const maxCollected of [1, 7, LIGNES_PAR_BLOC, LIGNES_PAR_BLOC + 19]) {
    const p = { ...e.p, maxCollected };
    const reference = drain(pairBuckets(p, e.A, e.B));
    const r = drain(apparierRapide(p, e.A, e.B, { collecte: creerColonnesCandidats() }));
    identiques(etat(reference), etat(objets(r)), `plafond séquentiel ${maxCollected}`);
    const parallele = await apparierRapideEnParallele({ params: { ...e.params, maxCollected }, prepared: p, bucketsA: e.A, bucketsB: e.B,
      totalPaires: e.total, travailleurs: 2, lancer: lancerTravailleurNode<ColonnesCandidats>(chemin), startedAt: p.startedAt,
      collecte: creerColonnesCandidats(), cibleMorceau: 8192 });
    identiques(etat(reference), etat(objets(enResultatDeRecherche(parallele))), `plafond parallèle ${maxCollected}`);
    identiques(parallele.traitees, r.traitees, 'coupe des traitées');
    identiques(parallele.visitees, r.visitees, 'coupe des visitées');
    identiques(parallele.motif, 'maxCollected', 'motif du plafond');
  }
  const N = 9000;
  const auPoint = <C,>(gen: Generator<PairingProgress<C>, SearchResult<C>, void>) => {
    let step = gen.next();
    while (!step.done && step.value.explored < N) step = gen.next();
    if (step.done) throw new Error('point de passage absent');
    return { ...step.value, truncated: true };
  };
  const attendu = auPoint(pairBuckets(e.p, e.A, e.B));
  const arret = await apparierRapideEnParallele({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer: lancerTravailleurNode<ColonnesCandidats>(chemin), startedAt: e.p.startedAt,
    collecte: creerColonnesCandidats(), cibleMorceau: 8192, arretTraitees: N });
  identiques(etat(attendu), etat(objets(arret)), 'arrêt déterministe après un bloc et un morceau');
  const manuel = await drivePairing(apparierRapide(e.p, e.A, e.B, { collecte: creerColonnesCandidats() }), () => true, () => {});
  const refManuel = auPoint500(pairBuckets(e.p, e.A, e.B));
  identiques(etat(refManuel), etat(objets(manuel)), 'arrêt manuel au premier point');
  const maintenant = Date.now;
  try {
    Date.now = () => 100;
    const p = { ...e.p, startedAt: 0, maxMs: 10 };
    const compact = drain(apparierRapide(p, e.A, e.B, { collecte: creerColonnesCandidats() }));
    identiques(etat(drain(apparierRapide(p, e.A, e.B))), etat(objets(compact)), 'même arrêt par le temps sur le noyau');
    identiques(compact.traitees, 500, 'filet contrôlé au point logique');
  } finally { Date.now = maintenant; }
  ok(true, 'mêmes candidats, rangs, comptes et arrêts aux frontières de blocs et de morceaux');
}

function auPoint500<C>(gen: Generator<PairingProgress<C>, SearchResult<C>, void>): SearchResult<C> {
  const s = gen.next();
  if (s.done) throw new Error('premier point de passage absent');
  return { ...s.value, truncated: true };
}

export async function testFluxCandidatsCredits() {
  titre('Flux candidats · vrais fils, désordre imposé, crédits et drainage');
  const e = espaceDense();
  const chemin = await assurerBundleAppariementRapide();
  let enVol = 0, pic = 0, termines = 0, lances = 0;
  const tailles = new Map<number, number>();
  const retenus: { id: number; livrer: () => void }[] = [];
  let ouvert = false;
  const arrivees: number[] = [];
  const brut = lancerTravailleurNode<ColonnesCandidats>(chemin);
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const w = lances++, fil = brut(init, transfert);
    return { ...fil,
      surMessage: (rappel) => fil.surMessage((r) => {
        const octets = tamponsResultatMorceau(r).reduce((s, b) => s + b.byteLength, 0);
        if (tailles.has(w)) throw new Error('deux blocs non acquittés du même fil');
        tailles.set(w, octets); enVol += octets; pic = Math.max(pic, enVol);
        const livrer = () => { arrivees.push(r.id); rappel(r); };
        if (ouvert) livrer();
        else {
          retenus.push({ id: r.id, livrer });
          if (retenus.length === 2) { ouvert = true; retenus.sort((a, b) => b.id - a.id).forEach((f) => f.livrer()); }
        }
      }),
      acquitter: () => { enVol -= tailles.get(w)!; tailles.delete(w); fil.acquitter!(); },
      terminer: () => { termines++; fil.terminer(); },
    };
  };
  const r = await apparierRapideEnParallele({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192 });
  identiques(etat(drain(pairBuckets(e.p, e.A, e.B))), etat(objets(r)), 'flux dense dans le désordre');
  ok(arrivees[0] !== 0 || arrivees[1] !== 1, 'les deux premiers retours ne suivent pas le plan');
  ok(pic <= 8 * 1024 * 1024 && pic > 0 && enVol === 0, `crédit global borné, tout rendu (${pic} octets, reste ${enVol})`);
  ok(termines === lances && tailles.size === 0, 'tous les fils terminés après acquittement');
  const grandMorceau = await apparierRapideEnParallele({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer: brut, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: e.total });
  ok(grandMorceau.candidates.length === e.total && e.total * 136 > 8 * 1024 * 1024, 'un morceau plus gros que le crédit global progresse bloc par bloc');

  let arreter: (() => void) | undefined;
  const objetsRecus: BuildCandidate[] = [];
  const coupe = await apparierRapideEnParallele({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer: brut, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192,
    surControle: (c) => { arreter = c.arreter; },
    surProgression: (_, c) => { for (const x of objetsDesCandidats(c)) objetsRecus.push(x); extraireBlocs(c); arreter?.(); },
  });
  identiques(coupe.candidates.length, objetsRecus.length, 'arrêt : aucun candidat reçu perdu au drainage');
  identiques(coupe.motif, 'manuel', 'arrêt coopératif pendant les crédits');
  ok(objetsRecus.length > 0 && objetsRecus.length < e.total, 'arrêt après un bloc avec résultat partiel');

  // Une panne pendant une publication asynchrone doit attendre cette publication
  // avant de rendre son bilan, sans fusionner les messages arrivés ensuite.
  let signalerPanne: ((e: unknown) => void) | undefined;
  let publicationAchevee = false;
  let nombrePublie = 0;
  let rejet: unknown;
  const panne: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = brut(init, transfert);
    return { ...fil, surErreur: (rappel) => { signalerPanne = rappel; fil.surErreur(rappel); } };
  };
  try {
    await apparierRapideEnParallele({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
      travailleurs: 2, lancer: panne, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192,
      surProgression: async (_, c) => {
        if (!c.length) return;
        nombrePublie = c.length;
        signalerPanne?.(new Error('panne pendant publication'));
        await Promise.resolve();
        publicationAchevee = true;
      },
    });
  } catch (erreur) { rejet = erreur; }
  ok(rejet instanceof ErreurAppariementParallele && publicationAchevee && rejet.resultat.candidates.length === nombrePublie,
    'panne pendant le transfert : publication achevée, préfixe préservé et erreur portée');
}

export async function testFluxCandidatsApercuFinal() {
  titre('Flux candidats · transfert unique, aperçu stable, scellement');
  const e = espaceDense();
  const base = drain(pairBuckets({ ...e.p, maxCollected: 1 }, e.A, e.B)).candidates[0];
  const sortie = creerColonnesCandidats();
  for (let i = 0; i < 9000; i++) ajouterObjetCandidat(sortie, { ...base, effTotal: i === 10 ? NaN : i === 11 ? -0 : i });
  const recepteur = new RecepteurCandidats();
  const tampons: ArrayBuffer[] = [];
  let messages = 0;
  const flux = new EmetteurCandidats((bloc, transfert) => {
    messages++;
    tampons.push(...transfert);
    const copie = structuredClone(bloc, { transfer: transfert });
    recepteur.recevoir([copie]);
    flux.acquitter();
  });
  await flux.transmettre(sortie);
  const apercu = recepteur.apercuCourant();
  const nombre = await flux.sceller(sortie);
  const final = recepteur.sceller(nombre);
  ok(messages === 3 && tampons.every((b) => b.byteLength === 0), 'trois blocs transférés, tous les tampons émetteurs détachés');
  ok(final.length === 9000 && apercu.length === 3000 && apercu.every((c, i) => c === final[i]), 'mêmes objets entre aperçu et final, doublons gardés');
  ok(Object.is(final[10].effTotal, NaN) && Object.is(final[11].effTotal, -0), 'Float64 conserve NaN et -0');
  for (const tentative of [() => recepteur.sceller(nombre), () => recepteur.recevoir([])]) {
    let refuse = false; try { tentative(); } catch { refuse = true; }
    ok(refuse, 'réémission après scellement refusée');
  }
  const manque = new RecepteurCandidats();
  let refuse = false; try { manque.sceller(1); } catch { refuse = true; }
  ok(refuse, 'scellement avec candidat perdu refusé');
  const doublon = creerColonnesCandidats(); ajouterObjetCandidat(doublon, base);
  const bloc = extraireBlocs(doublon)[0];
  const r = new RecepteurCandidats(); r.recevoir([bloc]);
  refuse = false; try { r.recevoir([bloc]); } catch { refuse = true; }
  ok(refuse, 'ordinal répété refusé, sans dédoublonnage par clé');
  // La taille des tampons du dernier bloc reste bornée, même s'il est partiel.
  ok(tamponsCandidats([bloc]).reduce((s, b) => s + b.byteLength, 0) === 15 * 8 * LIGNES_PAR_BLOC, 'enveloppe de chaque bloc connue');

  const reception = new RecepteurCandidats();
  const transport = new EmetteurCandidats((b, transfert) => {
    reception.recevoir([structuredClone(b, { transfer: transfert })]);
    queueMicrotask(() => transport.acquitter());
  });
  let preview: BuildCandidate[] = [];
  const resultat = await drivePairing(apparierRapide(e.p, e.A, e.B, { collecte: creerColonnesCandidats() }), () => false,
    async (_, c) => { await transport.transmettre(c); preview = reception.apercuCourant(); });
  const total = await transport.sceller(resultat.candidates);
  const candidats = reception.sceller(total);
  identiques(etat(drain(pairBuckets(e.p, e.A, e.B))), etat({ ...resultat, candidates: candidats }), 'producteur, pilote, transfert et récepteur ensemble');
  ok(preview.length === 3000 && preview.every((c, i) => c === candidats[i]), 'pilote réel : aperçu et final partagent les mêmes objets');
}
