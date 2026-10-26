// Oracle objet intact, colonnes sur les mêmes compartiments ; aucun chronométrage.
import { BuildCandidate, Bucket, CHECKPOINT_EVERY, PairingProgress, SearchParams, SearchResult, SLOT_FILTER_PRESETS, pairBuckets, prepareSearch } from '../src/lib/runeBuildOptim';
import { ResultatMorceau, apparierRapide, compterPaires, encoderCompartiments, initialiserTravailleur, traiterMorceau } from '../src/lib/appariementRapide';
import { construireMoitieTypee } from '../src/lib/rechercheRunes';
import { objetsDesCompartiments } from '../src/lib/demiBuildsTypes';
import { BlocCandidats, ColonnesCandidats, LIGNES_PAR_BLOC, RecepteurCandidats, ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, fusionnerCandidats, objetsDesCandidats, tamponsCandidats } from '../src/lib/candidatsCompacts';
import { ErreurAppariementParallele, LIGNES_EN_ATTENTE_PAR_TRAVAILLEUR, MESSAGES_EN_ATTENTE_PAR_TRAVAILLEUR, LancerTravailleur, OptionsParallele, PoigneeTravailleur, ResultatParallele, apparierRapideEnParallele, enResultatDeRecherche, planifierMorceaux } from '../src/lib/appariementRapideParallele';
import { servirAppariement, tamponsResultatMorceau } from '../src/lib/travailleurAppariement';
import { BLOCS_EN_VOL_VERS_PAGE, EmetteurCandidats, drivePairing } from '../src/workers/pairingDriver';
import { assurerBundleAppariementRapide, lancerTravailleurNode } from '../scripts/lib/appariementRapideNode';
import { drain } from '../scripts/lib/drain';
import { mulberry32, randomPool, SETS_JOKER } from '../scripts/lib/randomPool';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { executerHarnais } from '../scripts/lib/diagnosticHarness';
import { configDuProfil, trouverProfil } from '../scripts/lib/diagnosticProfils';
import { RuneDetail } from '../src/types';
import { ok, titre } from './outils';
import React from 'react';
import { useBuildOptimSearch } from '../src/hooks/useBuildOptimSearch';
import { demandeClassementTest } from './classement-fixture';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { resoudreConfig } from '../scripts/lib/diagnosticConfig';

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

/** Projection réservée aux différentiels ; aucune distribution propre à l'oracle objet. */
export async function apparierObjetPourTest(o: OptionsParallele): Promise<ResultatParallele> {
  const candidates: BuildCandidate[] = [];
  const adapter = (c: ColonnesCandidats) => {
    for (const x of objetsDesCandidats(c)) candidates.push(x);
    c.blocs = [];
  };
  try {
    const r = await apparierRapideEnParallele({ ...o, collecte: creerColonnesCandidats(),
      lancer: (init, transfert) => {
        const fil = o.lancer(init, transfert);
        return { ...fil,
          surMessage: (r) => {
            fil.surMessage((message) => {
              // Les vrais fils parlent déjà compact. Seuls les scénarios d'oracle
              // fabriquent un résultat objet de morceau dans ce fichier de tests.
              if (!Array.isArray(message.candidats)) { r(message as unknown as ResultatMorceau<ColonnesCandidats>); return; }
              const c = creerColonnesCandidats();
              for (const candidat of message.candidats) ajouterObjetCandidat(c, candidat);
              c.blocs = extraireBlocs(c);
              r({ ...message, candidats: c });
            });
          },
          acquitter: () => fil.acquitter?.(),
        };
      },
      surProgression: async (n, c) => { adapter(c); await o.surProgression?.(n, candidates); },
    });
    adapter(r.candidates);
    return { ...r, candidates };
  } catch (e) {
    if (e instanceof ErreurAppariementParallele) {
      const r = e.resultat as ResultatParallele<ColonnesCandidats>;
      adapter(r.candidates);
      throw new ErreurAppariementParallele(e.erreur, { ...r, candidates });
    }
    throw e;
  }
}

/** Une fusion bloquée échoue ; le minuteur ne constitue aucune mesure de performance. */
async function paralleleBorne(o: OptionsParallele<ColonnesCandidats>, delaiMs = 15_000) {
  const vivants = new Set<PoigneeTravailleur<ColonnesCandidats>>();
  const signaler = new Set<(erreur: Error) => void>();
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = o.lancer(init, transfert);
    let fini = false;
    let surErreur: ((erreur: Error) => void) | undefined;
    const suivi: PoigneeTravailleur<ColonnesCandidats> = { ...fil,
      surErreur: (rappel) => { surErreur = rappel; signaler.add(rappel); fil.surErreur(rappel); },
      terminer: () => {
        if (fini) return;
        fini = true;
        vivants.delete(suivi);
        if (surErreur) signaler.delete(surErreur);
        fil.terminer();
      },
    };
    vivants.add(suivi);
    return suivi;
  };
  const expiration = new Promise<never>((_, reject) => {
    minuteur = setTimeout(() => {
      const erreur = new Error(`La fusion ne progresse plus : délai de garde de ${delaiMs} ms dépassé`);
      for (const rappeler of signaler) rappeler(erreur);
      for (const fil of vivants) fil.terminer();
      reject(erreur);
    }, delaiMs);
  });
  try {
    return await Promise.race([apparierRapideEnParallele({ ...o, lancer }), expiration]);
  } finally {
    clearTimeout(minuteur);
    for (const fil of vivants) fil.terminer();
  }
}

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

/** Deux statistiques en opposition gardent les runes distinctes à la préparation.
 * Les deux apports alternatifs laissent des tentatives en quasi-succès entre les conformes. */
function espaceDistinct() {
  const pool: RuneDetail[] = [];
  for (let slot = 1; slot <= 6; slot++) for (let i = 0; i < 8; i++) pool.push({
    id: 2 ** 40 + slot * 100 + i, slot, set: 'will', rank: 6, rarity: 5, level: 15,
    main: { code: 8, value: 5 }, subs: [{ code: 2, value: i }, { code: 4, value: 7 - i }],
  });
  const params: SearchParams = { base: BASE, artifacts: [], pool, metric: 'eff', slotFilterCap: 40, maxMs: Infinity, maxCollected: Infinity,
    requirement: { sets: [], minStats: { hp: 10000, atk: 685, spd: 130 } },
    artifactBounds: { max: { hp: 2500, atk: 200 }, min: {}, possibles: [{ hp: 2500 }, { atk: 200 }] } };
  const p = prepareSearch(params);
  if (!p) throw new Error('fixture distincte : préparation vide');
  const A = objetsDesCompartiments(drain(construireMoitieTypee('A', [0, 1, 2], p, p.maxSetsForA)), p.filtered);
  const B = objetsDesCompartiments(drain(construireMoitieTypee('B', [3, 4, 5], p, p.maxSetsForB)), p.filtered);
  return { params, p, A, B, total: compterPaires(p, A, B) };
}

const cle = (c: BuildCandidate) => c.runeIds.join(',');

function auPoint<C>(gen: Generator<PairingProgress<C>, SearchResult<C>, void>, N: number): SearchResult<C> {
  let step = gen.next();
  while (!step.done && step.value.explored < N) step = gen.next();
  if (step.done || step.value.explored !== N) throw new Error(`point de passage ${N} absent`);
  return { ...step.value, truncated: true };
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
    const parallele = await paralleleBorne({ params: { ...e.params, maxCollected }, prepared: p, bucketsA: e.A, bucketsB: e.B,
      totalPaires: e.total, travailleurs: 2, lancer: lancerTravailleurNode<ColonnesCandidats>(chemin), startedAt: p.startedAt,
      collecte: creerColonnesCandidats(), cibleMorceau: 8192 });
    identiques(etat(reference), etat(objets(enResultatDeRecherche(parallele))), `plafond parallèle ${maxCollected}`);
    identiques(parallele.traitees, r.traitees, 'coupe des traitées');
    identiques(parallele.visitees, r.visitees, 'coupe des visitées');
    identiques(parallele.motif, 'maxCollected', 'motif du plafond');
  }
  const N = 9000;
  const attendu = auPoint(pairBuckets(e.p, e.A, e.B), N);
  const arret = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
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
  await coupeDistincte(chemin);
  await tempsApresSuite();
}

function auPoint500<C>(gen: Generator<PairingProgress<C>, SearchResult<C>, void>): SearchResult<C> {
  const s = gen.next();
  if (s.done) throw new Error('premier point de passage absent');
  return { ...s.value, truncated: true };
}

async function coupeDistincte(chemin: string) {
  const e = espaceDistinct();
  const plan = planifierMorceaux(e.p, e.A, e.B, 8192);
  const contexte = initialiserTravailleur({ params: e.params, startedAt: e.p.startedAt, compartiments: encoderCompartiments(e.p, e.A, e.B), forcerValidation: 'reference' });
  let avant = 0;
  let choix: { id: number; plafond: number; position: number } | undefined;
  for (const m of plan) {
    const r = traiterMorceau(contexte, m);
    if (m.id > 0 && r.candidats.length > LIGNES_PAR_BLOC + 19) {
      choix = { id: m.id, plafond: avant + LIGNES_PAR_BLOC + 19, position: r.positions[LIGNES_PAR_BLOC + 18] };
      break;
    }
    avant += r.candidats.length;
  }
  if (!choix || !avant) throw new Error('fixture : aucune coupe après un morceau puis un bloc plein');
  const { id, plafond: maxCollected, position } = choix;
  const p = { ...e.p, maxCollected };
  const reference = drain(pairBuckets(p, e.A, e.B));
  if (!reference.globalNearMiss || !reference.nearMissByCondition.length) throw new Error('fixture de coupe sans quasi-succès');
  if (new Set(reference.candidates.map(cle)).size !== reference.candidates.length) throw new Error('fixture de coupe avec doublons');
  let suiteDuMorceau = false;
  const brut = lancerTravailleurNode<ColonnesCandidats>(chemin);
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = brut(init, transfert);
    return { ...fil, surMessage: (rappel) => fil.surMessage((r) => {
      if (r.id === id && r.issue === 'suite') suiteDuMorceau = true;
      rappel(r);
    }) };
  };
  const r = await paralleleBorne({ params: { ...e.params, maxCollected }, prepared: p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer, startedAt: p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192 });
  identiques(etat(reference), etat(objets(r)), `coupe distincte au rang ${maxCollected}, morceau ${id}, deuxième bloc`);
  identiques(r.traitees, position, 'coupe : même position de référence, après les morceaux précédents');
  identiques(r.motif, 'maxCollected', 'coupe : même motif que la référence saturée');
  if (!suiteDuMorceau) throw new Error('le morceau de la coupe n’a pas émis de suite');
  ok(true, `candidats distincts, quasi-succès et coupe après ${avant} candidats de morceaux précédents, puis 4096 + 19`);
}

async function tempsApresSuite() {
  const e = espaceDistinct();
  if (e.B.length !== 1) throw new Error('fixture temps : une seule largeur de ligne attendue');
  const largeur = e.B[0].combos.length;
  const startedAt = 0, maxMs = 10;
  let horloge = 0;
  let point = 0;
  let retenu = false;
  let terminal: ResultatMorceau<ColonnesCandidats> | undefined;
  const lancer: LancerTravailleur<ColonnesCandidats> = (init) => {
    let rappel: (r: ResultatMorceau<ColonnesCandidats>) => void = () => {};
    let erreur: (e: unknown) => void = () => {};
    const serveur = servirAppariement<ColonnesCandidats>((r) => {
        const prochainPoint = (Math.floor(r.traitees / CHECKPOINT_EVERY) + 1) * CHECKPOINT_EVERY;
        const finLigne = Math.ceil(r.traitees / largeur) * largeur;
        if (!retenu && r.issue === 'suite' && prochainPoint <= finLigne) {
          retenu = true; point = prochainPoint;
          // Avancer au passage logique voulu, avant le crédit, sans délai machine.
          horloge = maxMs + 1;
        }
        if (r.issue !== 'suite') terminal = r;
        rappel(r);
    }, { maintenant: () => 0 });
    const recevoir = (m: Parameters<typeof serveur.recevoir>[0]) => { void serveur.recevoir(m).catch((e) => erreur(e)); };
    recevoir({ type: 'init', init });
    return {
      envoyer: (m) => recevoir(m),
      surMessage: (r) => { rappel = r; }, surErreur: (r) => { erreur = r; },
      acquitter: () => recevoir({ type: 'credit' }),
      arreter: () => recevoir({ type: 'arret' }), terminer: () => recevoir({ type: 'arret' }),
    };
  };
  const ancienneHorloge = Date.now;
  let r;
  try {
    Date.now = () => horloge;
    r = await paralleleBorne({ params: { ...e.params, maxMs }, prepared: { ...e.p, startedAt, maxMs }, bucketsA: e.A, bucketsB: e.B,
      totalPaires: e.total, travailleurs: 1, lancer, startedAt, collecte: creerColonnesCandidats(), cibleMorceau: e.total });
  } finally { Date.now = ancienneHorloge; }
  if (!retenu || !point || !terminal || terminal.issue !== 'temps' || r.candidates.length < LIGNES_PAR_BLOC) throw new Error('le filet n’a pas coupé après un bloc suite');
  const reference = auPoint(pairBuckets(e.p, e.A, e.B), point);
  identiques(etat(reference), etat(objets(r)), `temps après suite, référence au même travail ${point}`);
  identiques(r.traitees, point, 'temps : même nombre de paires traitées au point logique de coupe');
  identiques(r.motif, 'maxMs', 'filet expiré après le bloc plein');
  ok(true, 'horloge logique : filet après suite, mêmes candidats ordonnés, comptes et quasi-succès que la référence au point logique de coupe');
}

export async function testFluxCandidatsCredits() {
  titre('Flux candidats · vrais fils, désordre imposé, crédits et drainage');
  const e = espaceDistinct();
  const reference = drain(pairBuckets(e.p, e.A, e.B));
  if (!reference.globalNearMiss || !reference.nearMissByCondition.length) throw new Error('fixture distincte sans quasi-succès');
  if (new Set(reference.candidates.map(cle)).size !== reference.candidates.length) throw new Error('fixture distincte avec doublons');
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
  const r = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192 });
  identiques(etat(reference), etat(objets(r)), 'candidats distincts et quasi-succès dans le désordre');
  identiques(r.traitees, reference.explored, 'épuisement : même nombre de paires traitées');
  ok(arrivees[0] !== 0 || arrivees[1] !== 1, 'les deux premiers retours ne suivent pas le plan');
  ok(pic <= 8 * 1024 * 1024 && pic > 0 && enVol === 0, `crédit global borné, tout rendu (${pic} octets, reste ${enVol})`);
  ok(termines === lances && tailles.size === 0, 'tous les fils terminés après acquittement');
  const grandMorceau = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer: brut, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: e.total });
  identiques(etat(reference), etat(objets(grandMorceau)), 'morceau distinct plus gros que le crédit');
  ok(grandMorceau.candidates.length * 136 > 8 * 1024 * 1024, 'un morceau plus gros que le crédit global progresse bloc par bloc');

  let arreter: (() => void) | undefined;
  const objetsRecus: BuildCandidate[] = [];
  const parMorceau = new Map<number, { traitees: number; visitees: number }>();
  const suiviArret: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = brut(init, transfert);
    return { ...fil, surMessage: (rappel) => fil.surMessage((r) => {
      parMorceau.set(r.id, { traitees: r.traitees, visitees: r.visitees });
      rappel(r);
    }) };
  };
  const coupe = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer: suiviArret, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192,
    surControle: (c) => { arreter = c.arreter; },
    surProgression: (_, c) => { for (const x of objetsDesCandidats(c)) objetsRecus.push(x); extraireBlocs(c); arreter?.(); },
  });
  const contexteArret = initialiserTravailleur({ params: e.params, startedAt: e.p.startedAt, compartiments: encoderCompartiments(e.p, e.A, e.B), forcerValidation: 'reference' });
  const planArret = planifierMorceaux(e.p, e.A, e.B, 8192);
  const attenduArret: SearchResult = { candidates: [], explored: 0, truncated: true, nearMissByCondition: [], globalNearMiss: null };
  const conditions = new Map<string, SearchResult['nearMissByCondition'][number]>();
  let distance = Infinity, visitesAttendues = 0;
  for (const m of planArret) {
    const recu = parMorceau.get(m.id);
    if (!recu) continue;
    const oracle = traiterMorceau(contexteArret, m);
    const position = m.offset + recu.traitees;
    for (let i = 0; i < oracle.candidats.length; i++) if (oracle.positions[i] <= position) attenduArret.candidates.push(oracle.candidats[i]);
    for (const a of oracle.ameliorations) if (a.pos <= position) {
      if (a.type === 'condition') {
        const avant = conditions.get(a.cle);
        if (!avant || a.entree.miss.shortfalls[0].shortfall < avant.miss.shortfalls[0].shortfall) conditions.set(a.cle, a.entree);
      } else if (a.distance < distance) { distance = a.distance; attenduArret.globalNearMiss = a.miss; }
    }
    attenduArret.explored += recu.traitees;
    visitesAttendues += recu.visitees;
  }
  attenduArret.nearMissByCondition = [...conditions.values()];
  identiques(etat(attenduArret), etat({ ...coupe, candidates: objetsRecus }), 'arrêt parallèle : chaque candidat, rang, compte et quasi-succès contre la référence');
  identiques(coupe.visitees, visitesAttendues, 'arrêt parallèle : toutes les visites reçues sont fusionnées');
  identiques(coupe.sautees, coupe.traitees - visitesAttendues, 'arrêt parallèle : même périmètre des sauts');
  identiques(coupe.motif, 'manuel', 'arrêt coopératif pendant les crédits');
  ok(objetsRecus.length > 0 && objetsRecus.length < e.total, 'arrêt après un bloc avec résultat partiel');

  // Une panne pendant une publication asynchrone doit attendre cette publication
  // avant de rendre son bilan, sans fusionner les messages arrivés ensuite.
  let signalerPanne: ((e: unknown) => void) | undefined;
  let publicationAchevee = false;
  let panneAvantReception = false;
  let nombrePublie = 0, blocsTransferes = 0;
  let libererPage = false, reglee = false, saturationVue = false;
  let notifierSaturation!: () => void;
  const saturation = new Promise<void>((resolve) => { notifierSaturation = resolve; });
  const retenusPage: BlocCandidats[] = [];
  const recepteur = new RecepteurCandidats();
  const canal = new MessageChannel();
  const transport = new EmetteurCandidats((bloc, transfert) => {
    nombrePublie += bloc.longueur;
    blocsTransferes++;
    canal.port1.postMessage(bloc, transfert);
    if (!transfert.every((t) => t.byteLength === 0)) throw new Error('transfert de panne sans détachement');
  });
  const adopter = (bloc: BlocCandidats) => { recepteur.recevoir([bloc]); transport.acquitter(); };
  canal.port2.onmessage = (e: MessageEvent<BlocCandidats>) => {
    if (libererPage) adopter(e.data);
    else retenusPage.push(e.data);
  };
  let rejet: unknown;
  const panne: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = brut(init, transfert);
    return { ...fil, surErreur: (rappel) => { signalerPanne = rappel; fil.surErreur(rappel); } };
  };
  try {
    const execution = paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
        travailleurs: 2, lancer: panne, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192,
        surProgression: async (_, c) => {
          const pleine = blocsTransferes + c.blocs.length > BLOCS_EN_VOL_VERS_PAGE;
          const transfert = transport.transmettre(c);
          if (pleine) {
            saturationVue = true;
            panneAvantReception = !libererPage;
            signalerPanne?.(new Error('panne pendant la transmission du dix-septième bloc'));
            notifierSaturation();
          }
          await transfert;
          if (pleine) publicationAchevee = true;
        },
      }).then(() => { reglee = true; }, (erreur) => { reglee = true; rejet = erreur; });
    await Promise.race([saturation, execution.then(() => { throw new Error('panne sans saturation de la fenêtre'); })]);
    // Un tour complet, et ses microtâches : retirer await receptions rendrait
    // déjà le rejet, alors que le dix-septième bloc attend encore son crédit.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const attenteObservee = !reglee && !publicationAchevee && blocsTransferes === BLOCS_EN_VOL_VERS_PAGE;
    libererPage = true;
    for (const bloc of retenusPage.splice(0)) adopter(bloc);
    await execution;
    ok(attenteObservee, 'panne : bilan retenu pendant la publication bloquée derrière les seize blocs sans crédit');
    if (!(rejet instanceof ErreurAppariementParallele)) throw rejet ?? new Error('panne non portée');
    const resultat = rejet.resultat as typeof r;
    const nombre = await transport.sceller(resultat.candidates);
    const finaux = recepteur.sceller(nombre);
    const prefixeReference = drain(pairBuckets({ ...e.p, maxCollected: nombre }, e.A, e.B));
    identiques(etat(prefixeReference), etat({ ...resultat, candidates: finaux }), 'panne : préfixe scellé contre référence, chaque champ et chaque rang');
    identiques(resultat.traitees, prefixeReference.explored, 'panne : même nombre de paires traitées');
    identiques(resultat.motif, 'erreur', 'panne signalée sans résultat ordinaire');
    ok(saturationVue && blocsTransferes > BLOCS_EN_VOL_VERS_PAGE && panneAvantReception && publicationAchevee && nombre === nombrePublie && new Set(finaux.map(cle)).size === nombre,
      'vrai transfert MessageChannel : tampons détachés, panne en vol, scellement sans doublon ni perte');
  } finally {
    libererPage = true;
    for (const bloc of retenusPage.splice(0)) adopter(bloc);
    canal.port1.close(); canal.port2.close();
  }

  let terminesMuets = 0, lancesMuets = 0;
  const muet: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = brut(init, transfert); lancesMuets++;
    return { ...fil, surMessage: () => {}, terminer: () => { terminesMuets++; fil.terminer(); } };
  };
  let expiration: unknown;
  try {
    await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
      travailleurs: 2, lancer: muet, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192 }, 100);
  } catch (erreur) { expiration = erreur; }
  ok(expiration instanceof Error && /fusion ne progresse plus/.test(expiration.message) && lancesMuets > 0 && terminesMuets === lancesMuets,
    'garde de délai : absence de réponse → échec borné et terminaison de tous les Workers');
}

/** Le serveur suspend chaque envoi jusqu'au crédit : la poignée permet de
 * compter ceux déjà fusionnés que la réception de la page retient encore. */
export async function testFluxCandidatsPageLente() {
  titre('Flux candidats · crédits indépendants de la réception lente de la page');
  const e = espaceDistinct();
  const maxCollected = 77_125;
  const reference = drain(pairBuckets({ ...e.p, maxCollected }, e.A, e.B));
  const chemin = await assurerBundleAppariementRapide();
  const brut = lancerTravailleurNode<ColonnesCandidats>(chemin);
  const attendent = new Map<number, { numero: number; r: ResultatMorceau<ColonnesCandidats> }>();
  const retenusParPage = new Set<number>();
  const plan = planifierMorceaux(e.p, e.A, e.B, 8192);
  let numeros = 0, credits = 0, fils = 0, tours = 0, blocs = 0, prochainMorceau = 0;
  const compter = () => {
    for (const { numero, r } of attendent.values()) {
      // Le morceau contigu déjà reçu ne doit pas attendre non plus derrière
      // une publication précédente ; les morceaux en avance attendent l'ordre.
      if ((r.candidats.length > 0 && r.candidats.blocs.length === 0) || r.id === prochainMorceau) retenusParPage.add(numero);
    }
  };
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const w = fils++, fil = brut(init, transfert);
    return { ...fil,
      surMessage: (rappel) => fil.surMessage((r) => {
        if (attendent.has(w)) throw new Error('Worker ayant envoyé deux blocs sans crédit');
        attendent.set(w, { numero: ++numeros, r });
        rappel(r);
      }),
      acquitter: () => {
        credits++; attendent.delete(w); fil.acquitter!();
      },
    };
  };
  const reception = new RecepteurCandidats();
  let receptionsPage = Promise.resolve();
  const transport = new EmetteurCandidats((bloc, transfert) => {
    blocs++;
    const recu = structuredClone(bloc, { transfer: transfert });
    receptionsPage = receptionsPage.then(async () => {
      // Plusieurs tours de boucle, sans horloge ni délai mesuré.
      for (let tour = 0; tour < 8; tour++) {
        compter(); tours++;
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      reception.recevoir([recu]);
      transport.acquitter();
    });
  });
  const r = await paralleleBorne({ params: { ...e.params, maxCollected }, prepared: { ...e.p, maxCollected }, bucketsA: e.A, bucketsB: e.B,
    totalPaires: e.total, travailleurs: 2, lancer, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: 8192,
    surProgression: (explored, c) => {
      // Le crédit de réception ne dit plus quel morceau a été fusionné.
      while (prochainMorceau < plan.length && plan[prochainMorceau].offset + plan[prochainMorceau].taille <= explored) prochainMorceau++;
      return transport.transmettre(c);
    },
  });
  const nombre = await transport.sceller(r.candidates);
  await receptionsPage;
  identiques(etat(reference), etat({ ...r, candidates: reception.sceller(nombre) }), 'page lente : chaque candidat, champ, rang et quasi-succès');
  identiques(r.traitees, reference.explored, 'page lente : mêmes paires traitées');
  identiques(r.motif, 'maxCollected', 'page lente : même motif');
  identiques(credits, numeros, 'page lente : exactement un crédit par résultat reçu, bilans vides compris');
  ok(blocs > 10 && tours === blocs * 8 && credits > 10 && attendent.size === 0, `${blocs} blocs, ${credits} crédits, ${tours} tours de page lente, tous rendus`);
  ok(retenusParPage.size === 0, `${retenusParPage.size} attente(s) de crédit après fusion dues à la page (attendu : zéro)`);
  await fenetrePage(reference.candidates[0]);
}

/** Retard logique imposé au lancement du morceau de tête : les suivants
 * exécutent réellement le serveur Node pendant que la tête est retenue. */
export async function testFluxCandidatsReceptionOrdre() {
  titre('Flux candidats · réception créditée avant la fusion du morceau de tête');
  const e = espaceDistinct();
  const reference = drain(pairBuckets(e.p, e.A, e.B));
  const chemin = await assurerBundleAppariementRapide();
  for (const saturer of [false, true]) await receptionAvantFusion(e, reference, chemin, saturer);
  await bilansCourtsAvantFusion(e, reference, chemin);
  await arretApresDerniereReception(e, reference, chemin);
}

/**
 * Le plafond se fusionne dans le morceau de tête : le coordinateur arrête les
 * morceaux encore en vol, dont rien ne serait fusionné, au lieu d'attendre
 * leur fin. Ceux du second Worker restent retenus jusqu'à cet arrêt : sans
 * lui, l'attente irait jusqu'au délai de garde.
 */
export async function testFluxCandidatsArretApresPlafond() {
  titre('Flux candidats · plafond fusionné : les morceaux en vol sont arrêtés');
  const e = espaceDistinct();
  const maxCollected = 5, cibleMorceau = 1_000;
  const params = { ...e.params, maxCollected };
  const prepared = { ...e.p, maxCollected };
  const reference = drain(pairBuckets(prepared, e.A, e.B));
  const plan = planifierMorceaux(e.p, e.A, e.B, cibleMorceau);
  ok(reference.truncated && plan.length >= 4 && reference.explored <= plan[0].offset + plan[0].taille,
    `précondition : le ${maxCollected}ᵉ candidat tombe dans le premier de ${plan.length} morceaux (position ${reference.explored})`);
  const brut = lancerTravailleurNode<ColonnesCandidats>(await assurerBundleAppariementRapide());
  let fils = 0;
  const arretes: number[] = [];
  const issuesDuSecond: string[] = [];
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const w = fils++, fil = brut(init, transfert);
    const retenus: (() => void)[] = [];
    let arrete = false;
    return { ...fil,
      envoyer: (m, t) => {
        if (w === 1 && !arrete) retenus.push(() => fil.envoyer(m, t));
        else fil.envoyer(m, t);
      },
      surMessage: (rappel) => fil.surMessage((r) => {
        if (w === 1) issuesDuSecond.push(r.issue);
        rappel(r);
      }),
      arreter: () => {
        arretes.push(w);
        arrete = true;
        fil.arreter();
        for (const partir of retenus.splice(0)) partir();
      },
    };
  };
  const r = await paralleleBorne({ params, prepared, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer, startedAt: prepared.startedAt, collecte: creerColonnesCandidats(), cibleMorceau });
  identiques(etat(reference), etat(objets(r)), 'plafond dans la tête : candidats, comptes et quasi-succès du séquentiel');
  identiques(r.traitees, reference.explored, 'plafond dans la tête : mêmes paires traitées');
  identiques(r.motif, 'maxCollected', 'plafond dans la tête : motif du plafond');
  ok(arretes.slice().sort().join(',') === '0,1' && issuesDuSecond.length > 0 && issuesDuSecond.every((i) => i === 'arret'),
    `chaque Worker arrêté une fois (${arretes.join(',')}), morceaux en vol rendus sans parcours (${issuesDuSecond.join(',')})`);
}

async function arretApresDerniereReception(e: ReturnType<typeof espaceDistinct>, reference: SearchResult, chemin: string) {
  const brut = lancerTravailleurNode<ColonnesCandidats>(chemin);
  let arreter: (() => void) | undefined;
  let arretDemande = false;
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const fil = brut(init, transfert);
    return { ...fil, surMessage: (rappel) => fil.surMessage((r) => {
      rappel(r);
      if (r.issue === 'complet') {
        // Le bilan est reçu, mais sa fusion attend encore la microtâche de la pompe.
        arretDemande = true; arreter!();
      }
    }) };
  };
  const r = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 1, lancer, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: e.total,
    surControle: (controle) => { arreter = controle.arreter; },
  });
  identiques(etat(reference), etat(objets(r)), 'arrêt après réception du dernier bilan : aucun candidat ni compte perdu avant fusion');
  identiques(r.traitees, reference.explored, 'arrêt après dernière réception : même travail complet');
  identiques(r.motif, 'aucun', 'tout le travail achevé reste un épuisement malgré le signal tardif');
  ok(arretDemande, 'arrêt entre dernière réception et fusion : bilan drainé entièrement');
}

/** Blocs pleins que la réception d'un producteur retient au plus. */
const BLOCS_PLEINS = LIGNES_EN_ATTENTE_PAR_TRAVAILLEUR / LIGNES_PAR_BLOC;

async function receptionAvantFusion(e: ReturnType<typeof espaceDistinct>, reference: SearchResult, chemin: string, saturer: boolean) {
  const brut = lancerTravailleurNode<ColonnesCandidats>(chemin);
  let fils = 0, credits = 0, retours = 0, attentesOrdre = 0, suitesAvantTete = 0;
  let teteLiberee = false, rapideTermineAvantTete = false, saturationVue = false;
  let picBlocs = 0, picOctets = 0;
  const departsRetenus: (() => void)[] = [];
  const retenus = new Map<number, ResultatMorceau<ColonnesCandidats>[]>();
  const attendent = new Map<number, { acquitte: boolean; r: ResultatMorceau<ColonnesCandidats> }>();
  const libererTete = () => {
    if (teteLiberee) return;
    teteLiberee = true;
    for (const partir of departsRetenus) partir();
    departsRetenus.length = 0;
  };
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const w = fils++, fil = brut(init, transfert);
    return { ...fil,
      envoyer: (m, t) => {
        if (w === 0 && !teteLiberee) departsRetenus.push(() => fil.envoyer(m, t));
        else fil.envoyer(m, t);
      },
      surMessage: (rappel) => fil.surMessage((r) => {
        if (attendent.has(w)) throw new Error('Deux résultats du même Worker sans crédit');
        const file = (retenus.get(w) ?? []).filter((r) => r.candidats.blocs.length > 0);
        file.push(r); retenus.set(w, file);
        const octets = file.reduce((s, x) => s + tamponsResultatMorceau(x).reduce((n, b) => n + b.byteLength, 0), 0);
        picBlocs = Math.max(picBlocs, file.length); picOctets = Math.max(picOctets, octets);
        identiques(tamponsResultatMorceau(r).reduce((s, b) => s + b.byteLength, 0), r.candidats.length * 136, 'réception : colonnes, positions et visites ajustées aux lignes');
        const recu = { acquitte: false, r }; attendent.set(w, recu); retours++;
        rappel(r);
        if (r.id === 1 && !teteLiberee) setImmediate(() => {
          if (r.issue === 'suite') suitesAvantTete++;
          if (!recu.acquitte) {
            if (saturer && file.length === BLOCS_PLEINS) saturationVue = true;
            else attentesOrdre++;
            // Le témoin doit terminer aussi : relever le blocage puis relâcher la tête.
            libererTete();
          } else if (r.issue !== 'suite') {
            rapideTermineAvantTete = true;
            libererTete();
          }
        });
      }),
      acquitter: () => {
        const recu = attendent.get(w);
        if (!recu) throw new Error('Crédit sans résultat');
        recu.acquitte = true; attendent.delete(w); credits++; fil.acquitter!();
      },
    };
  };
  const r = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau: saturer ? e.total / 2 : 16_384 });
  identiques(etat(reference), etat(objets(r)), `tête lente${saturer ? ', saturation' : ''} : tous les candidats distincts, champs, rangs et quasi-succès`);
  identiques(r.traitees, reference.explored, 'tête lente : mêmes paires traitées');
  identiques(r.motif, 'aucun', 'tête lente : même épuisement');
  identiques(credits, retours, 'un crédit par résultat, même lorsque plusieurs blocs précèdent la fusion');
  ok(attentesOrdre === 0, `${attentesOrdre} attente(s) de crédit dues à l'ordre de fusion (attendu : zéro)`);
  if (saturer) ok(saturationVue && picBlocs === BLOCS_PLEINS && attendent.size === 0,
    `saturation : ${picBlocs} blocs reçus par Worker au plus, la tête reprend et tout est drainé`);
  else ok(rapideTermineAvantTete && suitesAvantTete >= 1 && attendent.size === 0,
    `morceau suivant entièrement reçu avant le départ de la tête (${suitesAvantTete} bloc suite puis son bilan), tous les crédits rendus`);
  ok(picBlocs <= MESSAGES_EN_ATTENTE_PAR_TRAVAILLEUR && picOctets <= LIGNES_EN_ATTENTE_PAR_TRAVAILLEUR * 136,
    `réception bornée par Worker : ${picBlocs} blocs et ${picOctets} octets, positions et visites comprises`);
}

/**
 * Des bilans courts derrière une tête lente : le producteur qui avance seul
 * garde son crédit tant que ses lignes retenues laissent la place d'un bloc
 * plein et qu'il retient moins de `MESSAGES_EN_ATTENTE_PAR_TRAVAILLEUR`
 * messages. Compter les places en messages le bloquait au quatrième bilan.
 */
async function bilansCourtsAvantFusion(e: ReturnType<typeof espaceDistinct>, reference: SearchResult, chemin: string) {
  const brut = lancerTravailleurNode<ColonnesCandidats>(chemin);
  const cibleMorceau = 1_000;
  const plan = planifierMorceaux(e.p, e.A, e.B, cibleMorceau);
  let fils = 0, teteLiberee = false;
  let recusAvant = 0, lignesAvant = 0, premierDiffere: { messages: number; lignes: number } | null = null;
  const departsRetenus: (() => void)[] = [];
  const libererTete = () => {
    if (teteLiberee) return;
    teteLiberee = true;
    for (const partir of departsRetenus) partir();
    departsRetenus.length = 0;
  };
  const lancer: LancerTravailleur<ColonnesCandidats> = (init, transfert) => {
    const w = fils++, fil = brut(init, transfert);
    let acquitteDansRappel = false;
    return { ...fil,
      envoyer: (m, t) => {
        if (w === 0 && !teteLiberee) departsRetenus.push(() => fil.envoyer(m, t));
        else fil.envoyer(m, t);
      },
      surMessage: (rappel) => fil.surMessage((r) => {
        acquitteDansRappel = false;
        rappel(r);
        if (w !== 1 || teteLiberee) return;
        // La tête retenue, rien de ce Worker n'est fusionné : tout ce qu'il a rendu est retenu.
        recusAvant++; lignesAvant += r.candidats.length;
        if (!acquitteDansRappel) { premierDiffere = { messages: recusAvant, lignes: lignesAvant }; setImmediate(libererTete); }
        else if (r.issue !== 'suite' && recusAvant >= plan.length - 2) setImmediate(libererTete);
      }),
      acquitter: () => { acquitteDansRappel = true; fil.acquitter!(); },
    };
  };
  const r = await paralleleBorne({ params: e.params, prepared: e.p, bucketsA: e.A, bucketsB: e.B, totalPaires: e.total,
    travailleurs: 2, lancer, startedAt: e.p.startedAt, collecte: creerColonnesCandidats(), cibleMorceau });
  identiques(etat(reference), etat(objets(r)), 'bilans courts derrière une tête lente : candidats, comptes et quasi-succès');
  identiques(r.traitees, reference.explored, 'bilans courts : mêmes paires traitées');
  identiques(r.motif, 'aucun', 'bilans courts : même épuisement');
  const d = premierDiffere as { messages: number; lignes: number } | null;
  ok(plan.length >= MESSAGES_EN_ATTENTE_PAR_TRAVAILLEUR + 4 && d !== null && d.messages === MESSAGES_EN_ATTENTE_PAR_TRAVAILLEUR
    && d.lignes + LIGNES_PAR_BLOC <= LIGNES_EN_ATTENTE_PAR_TRAVAILLEUR,
    `crédit retenu au ${d?.messages ?? '—'}ᵉ message (${d?.lignes ?? '—'} lignes) sur ${plan.length} morceaux : la limite de messages, jamais quatre bilans courts`);
}

async function fenetrePage(base: BuildCandidate) {
  const sortie = creerColonnesCandidats();
  const reception = new RecepteurCandidats(0);
  const attendus: BuildCandidate[] = [];
  let postes = 0, enVol = 0, pic = 0, octets = 0;
  const transport = new EmetteurCandidats((bloc, transfert) => {
    postes++; enVol++; pic = Math.max(pic, enVol);
    octets += transfert.reduce((s, b) => s + b.byteLength, 0);
    reception.recevoir([structuredClone(bloc, { transfer: transfert })]);
  });
  const production = (async () => {
    for (let i = 0; i <= BLOCS_EN_VOL_VERS_PAGE; i++) {
      const c = { ...base, effTotal: i };
      attendus.push(c); ajouterObjetCandidat(sortie, c);
      await transport.transmettre(sortie);
    }
  })();
  // Laisser passer toutes les continuations immédiates ; aucun crédit de page.
  for (let i = 0; i < 2 * BLOCS_EN_VOL_VERS_PAGE + 4; i++) await Promise.resolve();
  identiques(postes, BLOCS_EN_VOL_VERS_PAGE, 'la fenêtre admet seize blocs puis retient le dix-septième');
  enVol--; transport.acquitter();
  await production;
  identiques(postes, BLOCS_EN_VOL_VERS_PAGE + 1, 'un seul crédit admet exactement un nouveau bloc');
  let scelle = false;
  const fin = transport.sceller(sortie).then((n) => { scelle = true; return n; });
  await new Promise<void>((resolve) => setImmediate(resolve));
  identiques(scelle, false, 'le scellement attend les blocs encore non acquittés');
  while (enVol > 0) { enVol--; transport.acquitter(); }
  identiques(attendus, reception.sceller(await fin), 'fenêtre saturée : chaque ligne reçue une fois et dans l’ordre');
  identiques(pic, BLOCS_EN_VOL_VERS_PAGE, 'borne de seize blocs non acquittés');
  identiques(octets, (BLOCS_EN_VOL_VERS_PAGE + 1) * 120, 'les tampons de la fenêtre sont ajustés aux lignes réelles');
  ok(true, 'fenêtre : seize blocs admis sans crédit, saturation bornée, reprise sur un crédit et scellement après tous les crédits');
}

async function nombreuxBlocsPartiels(base: BuildCandidate) {
  const sortie = creerColonnesCandidats();
  const retenus: BlocCandidats[] = [];
  const reception = new RecepteurCandidats(0);
  let envoyes = 0;
  const transport = new EmetteurCandidats((bloc, transfert) => {
    envoyes += transfert.reduce((s, b) => s + b.byteLength, 0);
    const recu = structuredClone(bloc, { transfer: transfert });
    retenus.push(recu);
    reception.recevoir([recu]);
    queueMicrotask(() => transport.acquitter());
  });
  const attendus: BuildCandidate[] = [];
  for (let i = 0; i < 20; i++) {
    const c = { ...base, effTotal: i === 10 ? NaN : i === 11 ? -0 : i };
    attendus.push(c); ajouterObjetCandidat(sortie, c);
    await transport.transmettre(sortie);
  }
  const octetsRetenus = tamponsCandidats(retenus).reduce((s, b) => s + b.byteLength, 0);
  identiques(envoyes, 20 * 15 * 8, 'vingt blocs unitaires : octets transférés proportionnels aux lignes');
  identiques(octetsRetenus, envoyes, 'vingt blocs unitaires : aucune capacité cachée retenue');
  identiques(attendus, reception.sceller(await transport.sceller(sortie)), 'blocs partiels : mêmes candidats au final');

  const plein = creerColonnesCandidats();
  for (let i = 0; i < LIGNES_PAR_BLOC; i++) ajouterObjetCandidat(plein, { ...base, effTotal: i });
  const coupe = creerColonnesCandidats();
  fusionnerCandidats(coupe, plein, 3);
  const blocs = extraireBlocs(coupe);
  identiques(tamponsCandidats(blocs).reduce((s, b) => s + b.byteLength, 0), 3 * 15 * 8, 'bloc coupé à la fusion : réserve retirée avant transfert');
  const mauvais = { ...blocs[0], ids: [...blocs[0].ids] };
  mauvais.ids[0] = new Float64Array(LIGNES_PAR_BLOC).subarray(0, 3);
  let refuse = false; try { new RecepteurCandidats().recevoir([mauvais]); } catch { refuse = true; }
  ok(refuse, 'une sous-vue de trois lignes sur un gros tampon est refusée');
  ok(true, '20 candidats en 20 blocs : exactement 2400 octets retenus, puis scellement identique');
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
  ok(tamponsCandidats([bloc]).reduce((s, b) => s + b.byteLength, 0) === 15 * 8, 'bloc d’une ligne : 120 octets de tampons');
  await nombreuxBlocsPartiels(base);

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

/** Le hook réel, cellules React synchrones ; aucun rendu ni ordonnanceur DOM simulé. */
export function monterRecherche() {
  const internes = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const cellules: unknown[] = [];
  const ecritures: unknown[] = [];
  let index = 0;
  const dispatcher = {
    useState(initial: unknown) {
      const i = index++;
      if (!(i in cellules)) cellules[i] = initial;
      return [cellules[i], (v: any) => { ecritures.push(v); cellules[i] = typeof v === 'function' ? v(cellules[i]) : v; }];
    },
    useRef(initial: unknown) {
      const i = index++;
      if (!(i in cellules)) cellules[i] = { current: initial };
      return cellules[i];
    },
    useCallback<T>(callback: T) { return callback; }, useEffect() {},
  };
  const rendre = () => {
    const avant = internes.ReactCurrentDispatcher.current;
    internes.ReactCurrentDispatcher.current = dispatcher;
    index = 0;
    try { return useBuildOptimSearch(); } finally { internes.ReactCurrentDispatcher.current = avant; }
  };
  const fils: any[] = [];
  class Fil {
    onmessage: any = null; onerror: any = null; onmessageerror: any = null;
    termine = false; envoyes: unknown[] = [];
    constructor(readonly url: URL) { fils.push(this); }
    postMessage(m: unknown) { if (this.termine) throw new Error('envoi après terminaison'); this.envoyes.push(m); }
    terminate() { this.termine = true; for (const m of this.envoyes as any[]) { m.port?.close(); m.classement?.port.close(); } }
  }
  return { rendre, fils, Fil, ecritures };
}

function refusDuHook(type: 'recevoir' | 'sceller') {
  const ancienWorker = globalThis.Worker, ancienError = console.error;
  const banc = monterRecherche();
  const erreurs: unknown[] = [];
  try {
    globalThis.Worker = banc.Fil as unknown as typeof Worker;
    console.error = (...args) => { erreurs.push(args); };
    const hook = banc.rendre();
    const demande = demandeClassementTest(espaceDense().params);
    hook.run(demande.params, demande.photo, demande.vue);
    const fil = banc.fils[0], recevoir = fil.onmessage;
    const message = type === 'recevoir'
      ? { type: 'candidats', bloc: { schema: 1, debut: 1, longueur: 1 } }
      : { type: 'result', nombre: 1, explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null };
    const ouverture = fil.envoyes.find((m: any) => m.type === 'ouvrir');
    recevoir({ data: { type: 'erreur', versionSchema: 1, idRecherche: ouverture.idRecherche,
      message: `Flux ${message.type} refusé par le propriétaire` } });
    identiques(banc.rendre().status, 'error', `${type} refusé : erreur visible`);
    ok(fil.termine && fil.onmessage === null && erreurs.length === 1, `${type} refusé : Worker terminé et erreur journalisée`);
    hook.stop();
    recevoir({ data: { type: 'result', nombre: 0, explored: 0, truncated: false, nearMissByCondition: [], globalNearMiss: null } });
    identiques(banc.rendre().status, 'error', `${type} refusé : réponse tardive ignorée, Arrêter sans blocage`);
    banc.rendre().run(demande.params, demande.photo, demande.vue);
    const classeur = banc.fils.slice().reverse().find((f: any) => f.url.pathname.includes('classement.worker'));
    const suivante = classeur.envoyes.find((m: any) => m.type === 'ouvrir');
    classeur.onmessage({ data: { type: 'ouverte', versionSchema: 1, idRecherche: suivante.idRecherche, idDemande: suivante.idDemande } });
    banc.rendre().stop();
    const recherche = banc.fils.slice().reverse().find((f: any) => f.url.pathname.includes('runeBuildOptim.worker'));
    identiques(recherche.envoyes[1], { stop: true }, `${type} refusé : Arrêter reste branché après une relance`);
    banc.rendre().cancel();
  } finally { for (const f of banc.fils) f.terminate(); globalThis.Worker = ancienWorker; console.error = ancienError; }
}

export function testFluxCandidatsRefusRecevoir() {
  titre('Flux candidats · refus de recevoir visible et nettoyage');
  refusDuHook('recevoir');
}

export function testFluxCandidatsRefusSceller() {
  titre('Flux candidats · refus de sceller visible et nettoyage');
  refusDuHook('sceller');
}

export async function testFluxCandidatsRefusResultat() {
  titre('Flux candidats · rejet de posterResultat rattrapé par la coquille réelle');
  const paquet = await build({ stdin: { contents: "import '../src/workers/runeBuildOptim.worker';", resolveDir: resolve('tests'), loader: 'ts' },
    bundle: true, platform: 'browser', format: 'iife', write: false, logLevel: 'error' });
  const messages: any[] = [], erreurs: unknown[] = [];
  const self: any = { postMessage: (m: any) => {
    if (m.type === 'result') throw new Error('publication finale refusée');
    messages.push(m);
  } };
  runInNewContext(paquet.outputFiles[0].text, { self, Error, console: { error: (...args: unknown[]) => erreurs.push(args) } });
  self.onmessage({ data: { type: 'recherche', params: { ...espaceDense().params, pool: [] }, coeursPhysiques: null } });
  await new Promise<void>((resolve) => setImmediate(resolve));
  identiques(messages, [{ type: 'error', message: 'publication finale refusée' }], 'la promesse rejetée poste une erreur nommée au parent');
  ok(erreurs.length === 1, 'rejet final journalisé une seule fois, aucun rejet non géré');
  const ancienWorker = globalThis.Worker, ancienError = console.error;
  const banc = monterRecherche();
  try {
    globalThis.Worker = banc.Fil as unknown as typeof Worker; console.error = () => {};
    const demande = demandeClassementTest(espaceDense().params);
    banc.rendre().run(demande.params, demande.photo, demande.vue);
    const ouverture = banc.fils[0].envoyes.find((m: any) => m.type === 'ouvrir');
    banc.fils[0].onmessage({ data: { type: 'erreur', versionSchema: 1, idRecherche: ouverture.idRecherche, message: messages[0].message } });
    ok(banc.rendre().status === 'error' && banc.fils[0].termine, 'message réel : hook en error et Worker terminé');
    banc.rendre().stop();
  } finally { for (const f of banc.fils) f.terminate(); globalThis.Worker = ancienWorker; console.error = ancienError; }
}

export async function testFluxCandidatsLanceurCommun() {
  titre('Flux candidats · CLI et harnais empruntent le lanceur de l’écran');
  const cliSource = readFileSync('scripts/optimizer-search.ts', 'utf8');
  ok(/import\s*\{\s*runSearchToCompletion\s*\}\s*from\s*['"]\.\/lib\/runSearch['"]/.test(cliSource)
    && /result\s*=\s*await runSearchToCompletion\(params\)/.test(cliSource), 'entrée CLI : recherche attendue par le cœur instrumenté ci-dessous');
  let appels = 0;
  const paquet = await build({ stdin: { contents: "export { runSearchToCompletion } from './scripts/lib/runSearch'; export { executerHarnais } from './scripts/lib/diagnosticHarness';",
      resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['esbuild'], logLevel: 'error',
    plugins: [{ name: 'observer-lanceur-reel', setup(b) {
      b.onLoad({ filter: /pairingDriver\.ts$/ }, (args) => ({ loader: 'ts', contents:
        readFileSync(args.path, 'utf8').replace('export async function lancerAppariement(', 'async function lancerObserve(') +
        '\nexport async function lancerAppariement(...args: Parameters<typeof lancerObserve>) { globalThis.observerLanceur(); return lancerObserve(...args); }' }));
    } }],
  });
  const module = { exports: {} as any };
  const require = createRequire(resolve('package.json'));
  const contexte = { module, exports: module.exports, require, process, performance, console, setTimeout, clearTimeout, setImmediate,
    structuredClone, MessageChannel, Error, ArrayBuffer, Float64Array, Int32Array, Uint32Array, Uint8Array,
    observerLanceur: () => { appels++; } };
  runInNewContext(paquet.outputFiles[0].text, contexte);
  const profil = configDuProfil(trouverProfil('quota-parallele'));
  const resolue = resoudreConfig(profil);
  const cli = await module.exports.runSearchToCompletion(resolue.params);
  identiques(appels, 1, 'CLI : appel du lanceur commun, instrumenté sans changer son corps');
  const harnais = await module.exports.executerHarnais(profil);
  identiques(appels, 2, 'harnais : appel du même lanceur, y compris en parallèle');
  identiques(etat(cli), etat(harnais.brut), 'CLI et harnais : chaque candidat, rang, compte et quasi-succès');
  ok(true, 'les deux vrais consommateurs utilisent le lanceur commun et sa distribution compacte');
}
