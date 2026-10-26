// Le pool de résolveurs : plusieurs Workers de résolution derrière un seul
// classeur. Ce qui se vérifie ici dépend de la latence réelle des messages
// (ordre d'arrivée des réponses, crédits rendus, panne pendant que d'autres
// calculent) : chaque test fait tourner les coquilles de production sur de
// vrais fils Node, jamais une simulation séquentielle.
//
// La référence est la résolution directe du classeur (`classerPourLaPage`),
// une voie : le résultat d'un seul résolveur.

import { isDeepStrictEqual } from 'node:util';
import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { CorpsClassement, type InstantaneClassement, type PublicationClassement, type VueClassement } from '../src/lib/classementCompact';
import { contexteResultat } from '../src/lib/contexteResultat';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, tamponsCandidats } from '../src/lib/candidatsCompacts';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile, estPrisEnCharge, skillDamageProfile } from '../src/lib/damage';
import { computeStats } from '../src/lib/stats';
import type { BuildCandidate, RealDamageContext, SearchParams } from '../src/lib/runeBuildOptim';
import type { ResultatArtefacts } from '../src/lib/artifactQueue';
import { ResolutionDistante } from '../src/workers/resolutionDistante';
import type { MessageVersResolution, ReponseResolution } from '../src/workers/resolutionBody';
import type { ReponseClassement } from '../src/workers/classementDistant';
import type { ArtifactDetail, RuneDetail } from '../src/types';
import { classerPourLaPage } from './classement-fixture';
import { fil } from './classement-distant.test';
import { BASE } from './relic-search.test';
import { egal, ok, titre } from './outils';

const BILAN = { explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null };
const VOIES = 3;

/** Générateur pseudo-aléatoire à graine (mulberry32) : un ordre d'arrivée reproductible à la graine près. */
function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Des builds « Dégâts réels » sans relique (K = 100) : une condition de VIT
 * qu'un build sur quatre manque quelle que soit la paire, si bien que la file
 * écarte des builds et s'arrête avant le dernier trouvé.
 */
function fixturePool(n: number, e: { enemyDef: number; signature: string; toutVerifier: boolean; sans904?: boolean }) {
  const setup = { ...DEFAULT_DAMAGE_SETUP, atkBuff: true, enemyDef: e.enemyDef };
  const inventaire = ([
    { id: 901, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 100 }, subs: [{ code: 219, value: 5 }] },
    { id: 902, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 102, value: 100 }, subs: [] },
    { id: 903, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 100, value: 1500 }, subs: [] },
    { id: 904, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 101, value: 80 }, subs: [{ code: 218, value: 1 }] },
    { id: 905, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 60 }, subs: [{ code: 220, value: 4 }] },
  ] as ArtifactDetail[]).filter((a) => !(e.sans904 && a.id === 904));
  const pool: RuneDetail[] = [], candidats: BuildCandidate[] = [];
  for (let i = 0; i < n; i++) {
    const vit = i % 4 === 0 ? 0 : 3;
    const runes: RuneDetail[] = Array.from({ length: 6 }, (_, j) => ({ id: 1000 + i * 6 + j, slot: j + 1, set: j < 2 ? 'fight' : 'violent', rank: 6, rarity: 5, level: 15,
      main: { code: 3, value: 20 + (i * 7) % 35 }, subs: [{ code: 1, value: 100 + (i * 19) % 400 }, { code: 5, value: ((31 - i) * 4 + 400) % 120 }, { code: 8, value: vit }] }));
    pool.push(...runes);
    candidats.push({ runeIds: runes.map((r) => r.id), stats: computeStats({ base: BASE, runes, artifacts: inventaire.slice(0, 2) }), effTotal: i });
  }
  // Deux lignes du même équipement : elles partagent une seule résolution.
  candidats.push({ ...candidats[7], runeIds: [...candidats[7].runeIds].reverse() });
  const profile = skillDamageProfile({ id: 1, com2usId: 1, nom: 'Test', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: 1, niveauMax: 1, formule: '3.0*{ATK}', scale: [], ameliorations: [], icone: null, effets: [] });
  if (!profile || !estPrisEnCharge(profile)) throw new Error('Sort de la fixture non calculable');
  const realDamage: RealDamageContext = { profile, passifs: [], setup, element: 'fire', artefacts: artifactDamageProfile(inventaire.slice(0, 2)),
    critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {}, bonusDegatsConditionnel: null,
    bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null };
  const requirement = { sets: [], minStats: { spd: 110 } };
  const params: SearchParams = { base: BASE, pool, artifacts: inventaire.slice(0, 2), requirement, metric: 'eff', objective: 'degats_reels' };
  const fiche = { base: BASE, runes: pool.slice(0, 6), artifacts: params.artifacts, relic: undefined };
  const exclusive = { setup, element: 'fire' as const };
  const photo = contexteResultat({ params, fiche, realDamage, damageSetup: setup, exclusive, signature: e.signature, idInventaire: 1, idEspece: 1, toutVerifier: e.toutVerifier,
    resolution: { fiche, artifactParams: { porteur: { element: 'fire', archetype: 'attack' }, inventaire, equipes: params.artifacts, principaleParSorte: {}, lignesVerrouillees: [] },
      regime: 'degats_reels', degats: realDamage, exclusive, requirement, relicContext: undefined } });
  const vue: VueClassement = { tri: 'degats_reels', metric: 'eff', page: 1 };
  return { photo, vue, candidats };
}
type Fixture = ReturnType<typeof fixturePool>;

function blocs(candidats: readonly BuildCandidate[]) {
  const colonnes = creerColonnesCandidats();
  for (const c of candidats) ajouterObjetCandidat(colonnes, c);
  return extraireBlocs(colonnes);
}

/** Le cache d'une projection, rangé par clé : l'ordre d'écriture dépend de l'ordre d'arrivée, pas son contenu. */
function cacheRange(p: PublicationClassement): [string, ResultatArtefacts][] {
  return [...p.parBuild].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Ce qu'un instantané montre à la page, sans ses numéros de version. */
function vu(i: InstantaneClassement) {
  return { comptes: i.comptes, filtre: i.filtre, page: i.page, enAttente: i.enAttente, incident: i.incident, bilan: i.bilan };
}

/** Une réponse du résolveur retenue par le test, et ce qui la livre au classeur. */
interface Retenue { r: ReponseResolution; livrer: () => void }

interface Observation {
  /** Réponses reçues dans le désordre : une demande plus ancienne qu'une réponse déjà reçue. */
  inversions: number;
  /** Résultats reçus par voie. */
  parVoie: number[];
  /** Demandes sans réponse au plus fort, toutes voies. */
  maxEnVol: number;
}

/**
 * Le vrai corps du classeur sur le fil du test, branché à `voies` vrais
 * résolveurs ; chaque réponse est retardée au hasard (graine) avant d'entrer
 * dans le classeur, pour mélanger l'ordre d'arrivée. `geste`, appelé après
 * chaque réponse livrée jusqu'à ce qu'il rende vrai, agit sur le corps en
 * cours de file ; en attendant, jusqu'à une réponse par voie est retenue.
 */
async function classerAvecPool(voies: number, graine: number, recherches: { f: Fixture; id: number }[],
  geste?: (etape: { corps: CorpsClassement; recues: number; retenues: Retenue[] }) => boolean) {
  const resolveurs = await Promise.all(Array.from({ length: voies }, () => fil('resolution')));
  const tirage = alea(graine);
  const observation: Observation = { inversions: 0, parVoie: new Array<number>(voies).fill(0), maxEnVol: 0 };
  const recuesParVoie: ReponseResolution[][] = resolveurs.map(() => []);
  let corps!: CorpsClassement, horloge = 0, recues = 0, plusGrandeRecue = 0, gesteFait = false, publication: InstantaneClassement | null = null;
  const retenues: Retenue[] = [];
  const pilote = () => (corps as unknown as { pilote: ResolutionDistante }).pilote;
  try {
    const fini = new Promise<void>((accepter, refuser) => {
      const filet = setTimeout(() => refuser(new Error('Pool : délai de garde dépassé (une demande ne revient jamais ?)')), 60000);
      const verifier = () => {
        try {
          observation.maxEnVol = Math.max(observation.maxEnVol, pilote().demandesEnVol);
          if (pilote().demandesEnVol === 0 && corps.projection().enAttente === 0 && retenues.length === 0) { clearTimeout(filet); accepter(); }
        } catch (e) { clearTimeout(filet); refuser(e); }
      };
      corps = new CorpsClassement({ publier: (p) => { publication = p; },
        resoudre: (m: MessageVersResolution, voie: number) => { resolveurs[voie].postMessage(m); },
        incident: (raison) => { clearTimeout(filet); refuser(new Error(`incident inattendu : ${raison}`)); } }, false);
      corps.brancherVoies(voies);
      resolveurs.forEach((w, voie) => w.on('message', (r: ReponseResolution) => {
        recuesParVoie[voie].push(r);
        const livrer = () => setTimeout(() => {
          try {
            recues++;
            if (r.idDemande < plusGrandeRecue) observation.inversions++;
            plusGrandeRecue = Math.max(plusGrandeRecue, r.idDemande);
            if (r.type === 'resultat') observation.parVoie[voie]++;
            corps.recevoirResolution(r, ++horloge); corps.pomper(++horloge);
            if (geste && !gesteFait) gesteFait = geste({ corps, recues, retenues });
            verifier();
          } catch (e) { refuser(e); }
        }, Math.floor(tirage() * 12));
        // Un geste peut retenir des réponses pour les livrer plus tard (annulation en cours).
        if (geste && !gesteFait && recues >= 1 && retenues.length < voies) retenues.push({ r, livrer }); else livrer();
      }));
      for (const { f, id } of recherches) {
        corps.ouvrir(f.photo, id, f.vue, id);
        const bs = blocs(f.candidats); bs.forEach((b, i) => corps.ajouter(id, i, b));
        corps.sceller(id, f.candidats.length, bs.length - 1, BILAN);
        corps.pomper(++horloge);
      }
      observation.maxEnVol = pilote().demandesEnVol;
    });
    await fini;
    corps.publier(1e9, true);
    return { corps, projection: corps.projection(), instantane: publication as unknown as InstantaneClassement, observation, recuesParVoie };
  } finally { await Promise.all(resolveurs.map((w) => w.terminate())); }
}

export function testResolutionDistanteVoies() {
  titre('Résolution — pilote à plusieurs voies : crédits par voie, contexte sur chaque voie, panne d’une voie');
  const E = { fiche: null } as unknown as ContexteEntrees;
  const c1 = { entrees: E, signature: 's' };
  const b = (i: number) => ({ runeIds: [i, i + 1, i + 2, i + 3, i + 4, i + 5], stats: [], effTotal: 0 }) as unknown as BuildCandidate;
  const sansRunes = () => [];
  const resume = (envois: { voie: number; message: MessageVersResolution }[]) => envois.map(({ voie, message: m }) =>
    m.type === 'contexte' ? `${voie}:contexte@${m.idContexte}` : m.type === 'resoudre' ? `${voie}:resoudre #${m.idDemande}` : `${voie}:annuler #${m.idDemande}`);
  const p = new ResolutionDistante(2, 3);
  egal([p.maxEnVol, p.voiesVivantes], [6, 3], 'trois voies de deux crédits : six demandes sans réponse au plus');
  egal(resume(p.planifierVoies(c1, [1, 2, 3, 4, 5, 6, 7, 8].map(b), sansRunes)),
    ['0:contexte@1', '1:contexte@1', '2:contexte@1', '0:resoudre #1', '1:resoudre #2', '2:resoudre #3', '0:resoudre #4', '1:resoudre #5', '2:resoudre #6'],
    'le contexte part sur chaque voie, puis les demandes à la voie la moins chargée, dans l’ordre des restants');
  egal(p.demandesParVoie, [2, 2, 2], 'deux demandes par voie');
  egal(resume(p.planifierVoies(c1, [1, 2, 3, 4, 5, 6, 7, 8].map(b), sansRunes)), [], 'idempotent');
  // La page change : seules les plus anciennes de chaque voie, commencées, gardent leur place.
  egal(resume(p.planifierVoies(c1, [20, 21, 22, 23, 24, 25].map(b), sansRunes)), ['0:annuler #4', '1:annuler #5', '2:annuler #6'],
    'une autre page : la plus ancienne de CHAQUE voie est gardée, les autres annulées auprès de leur voie');
  egal(p.recevoir({ type: 'annule', idContexte: 1, idDemande: 5, cle: '', motif: 'demande' }, null, null).issue, 'ignoree', 'une annulation revenue libère sa place');
  egal(resume(p.planifierVoies(c1, [20, 21, 22, 23, 24, 25].map(b), sansRunes)), ['1:resoudre #7'], 'la place libérée part vers sa voie');
  // Panne de la voie 1 : ses demandes redeviennent à faire, sur les autres voies.
  egal(p.retirerVoie(1), 2, 'voie 1 retirée : deux voies vivantes');
  egal([p.maxEnVol, p.demandesParVoie], [4, [2, 0, 2]], 'ses crédits disparaissent avec elle ; ses demandes sont oubliées');
  const r2 = p.recevoir({ type: 'resultat', idContexte: 1, idDemande: 2, cle: '', resultat: {} as ResultatArtefacts }, new Map(), c1);
  egal(r2, { issue: 'ignoree', motif: 'demande-inconnue' }, 'une réponse tardive de la voie retirée ne correspond plus à rien');
  egal(p.recevoir({ type: 'resultat', idContexte: 1, idDemande: 1, cle: '', resultat: {} as ResultatArtefacts }, null, null).issue, 'ignoree', 'voie 0 : une réponse rend sa place');
  egal(resume(p.planifierVoies(c1, [20, 21, 22, 23, 24, 25].map(b), sansRunes)), ['0:resoudre #8'],
    'la place rendue repart sur une voie vivante, jamais sur la voie retirée');
  const q = new ResolutionDistante();
  egal([q.maxEnVol, q.voiesVivantes], [2, 1], 'par défaut : une voie, deux crédits — un seul résolveur');
  q.planifierVoies(c1, [1, 2].map(b), sansRunes);
  q.brancherVoies(2);
  egal([q.demandesEnVol, q.maxEnVol], [0, 4], 'de nouveaux canaux : les demandes des anciens sont oubliées');
  egal(resume(q.planifierVoies(c1, [1, 2].map(b), sansRunes)), ['0:contexte@2', '1:contexte@2', '0:resoudre #3', '1:resoudre #4'],
    'le contexte repart sur les nouveaux canaux, sans réutiliser un identifiant');
}
type ContexteEntrees = import('../src/workers/resolutionBody').EntreesResolutionSerialisables;

export async function testResolutionPoolDifferentiel() {
  titre('Résolution — pool de vrais Workers contre un seul résolveur : mêmes équipements, même classement, même page');
  const cas = [
    { nom: 'K = 100, écartés', graine: 1, f: fixturePool(180, { enemyDef: 1200, signature: 'pool', toutVerifier: false }) },
    { nom: 'K = 100, autre ordre d’arrivée', graine: 7, f: fixturePool(180, { enemyDef: 1200, signature: 'pool', toutVerifier: false }) },
    { nom: 'tout vérifier', graine: 3, f: fixturePool(70, { enemyDef: 800, signature: 'pool-tout', toutVerifier: true }) },
  ];
  for (const { nom, graine, f } of cas) {
    const ref = classerPourLaPage(f.photo, f.candidats, f.vue);
    const rejets = [...ref.projection.parBuild.values()].filter((r) => !r.conforme).length;
    const pool = await classerAvecPool(VOIES, graine, [{ f, id: 1 }]);
    const o = pool.observation;
    ok(o.inversions > 0 && o.parVoie.every((n) => n > 0) && o.maxEnVol > 2,
      `${nom} : précondition — ${o.inversions} réponse(s) arrivée(s) avant une plus récente, résultats par voie ${o.parVoie.join('/')}, jusqu’à ${o.maxEnVol} demandes en vol`);
    if (!f.photo.toutVerifier) ok(rejets > 0 && ref.projection.parBuild.size < f.candidats.length - 1,
      `${nom} : précondition — la file écarte ${rejets} build(s) et s’arrête avant le dernier trouvé (${ref.projection.parBuild.size} résolus sur ${f.candidats.length} lignes)`);
    ok(isDeepStrictEqual(cacheRange(pool.projection), cacheRange(ref.projection)),
      `${nom} : ${ref.projection.parBuild.size} builds résolus, les mêmes, avec le même équipement, la même conformité et les mêmes stats`);
    ok(isDeepStrictEqual(pool.projection.base, ref.projection.base) && isDeepStrictEqual(pool.projection.affichees, ref.projection.affichees),
      `${nom} : même ordre de base et même classement affiché (${ref.projection.affichees.length} lignes)`);
    ok(isDeepStrictEqual(vu(pool.instantane), vu(ref.instantane)), `${nom} : même instantané de page (cartes, comptes, filtre)`);
  }
}

/** Le vrai classeur et le pool, sur de vrais fils ; chaque canal passe par un relais du test qui retarde les réponses. */
export async function testResolutionPoolPanne() {
  titre('Résolution — panne d’un Worker du pool en cours de file : retiré, ses builds repris, aucune perte');
  const f = fixturePool(180, { enemyDef: 1200, signature: 'pool', toutVerifier: false });
  const ref = classerPourLaPage(f.photo, f.candidats, f.vue);
  const classeur = await fil('classement');
  const resolveurs = await Promise.all(Array.from({ length: VOIES }, () => fil('resolution')));
  const tirage = alea(11), PANNE = 1;
  const enVol = resolveurs.map(() => new Set<number>());
  let recues = 0, enVolALaPanne = -1, derniere: InstantaneClassement | null = null, incidentVoie: number | undefined = undefined, incidents = 0;
  const recherche = new MessageChannel();
  const ports: MessagePort[] = [];
  try {
    const fini = new Promise<void>((accepter, refuser) => {
      const filet = setTimeout(() => refuser(new Error('Pool en panne : délai de garde dépassé (des builds de la voie perdue jamais repris ?)')), 60000);
      resolveurs.forEach((w, voie) => {
        const versClasseur = new MessageChannel(), versResolveur = new MessageChannel();
        ports.push(versClasseur.port1);
        versClasseur.port2.on('message', (m: MessageVersResolution) => {
          if (m.type === 'resoudre') enVol[voie].add(m.idDemande);
          versResolveur.port1.postMessage(m);
        });
        versResolveur.port1.on('message', (r: ReponseResolution) => setTimeout(() => {
          enVol[voie].delete(r.idDemande);
          versClasseur.port2.postMessage(r);
          if (++recues === 12) {
            // La voie perd son Worker pendant qu'il a encore des demandes.
            enVolALaPanne = enVol[PANNE].size;
            void resolveurs[PANNE].terminate().then(() => classeur.postMessage({ type: 'panneResolution', versionSchema: 1, idRecherche: 1,
              raison: 'panne injectée', detail: 'résolveur terminé', voie: PANNE }));
          }
        }, Math.floor(tirage() * 12)));
        w.postMessage({ type: 'port', port: versResolveur.port2 }, [versResolveur.port2]);
      });
      classeur.on('error', (e) => { clearTimeout(filet); refuser(e); });
      classeur.on('message', (m: ReponseClassement) => {
        try {
          if (m.type === 'erreur') throw new Error(m.message);
          if (m.type === 'incidentResolution') { incidents++; incidentVoie = m.voie; }
          if (m.type === 'ouverte') {
            classeur.postMessage({ type: 'portRecherche', idRecherche: 1, port: recherche.port1 }, [recherche.port1]);
            const bs = blocs(f.candidats);
            bs.forEach((b, i) => recherche.port2.postMessage({ type: 'candidats', idRecherche: 1, sequence: i, bloc: b }, tamponsCandidats([b])));
            recherche.port2.postMessage({ type: 'sceller', idRecherche: 1, nombre: f.candidats.length, derniereSequence: bs.length - 1, bilan: BILAN });
          }
          if (m.type === 'publication') {
            derniere = m.publication;
            if (derniere.bilan && derniere.enAttente === 0 && enVolALaPanne >= 0) { clearTimeout(filet); accepter(); }
          }
        } catch (e) { clearTimeout(filet); refuser(e); }
      });
    });
    classeur.postMessage({ type: 'portsResolution', ports }, ports);
    classeur.postMessage({ type: 'ouvrir', versionSchema: 1, idRecherche: 1, idDemande: 1, contexte: f.photo, vue: f.vue });
    await fini;
    const instantane = derniere as unknown as InstantaneClassement;
    ok(enVolALaPanne > 0, `précondition — la voie ${PANNE} avait ${enVolALaPanne} demande(s) sans réponse quand son Worker est tombé`);
    egal([incidents, incidentVoie], [1, PANNE], 'un incident, nommant la voie retirée : seul ce Worker quitte le pool');
    egal(instantane.incident, null, 'aucun repli dans le classeur : l’instantané ne porte pas d’incident');
    ok(isDeepStrictEqual(vu(instantane), vu(ref.instantane)),
      `même page, mêmes comptes que le résolveur unique (${instantane.comptes.resolus} résolus, ${instantane.comptes.confirmees} confirmées) : les builds de la voie perdue ont été repris`);
  } finally {
    recherche.port2.close();
    await classeur.terminate(); await Promise.all(resolveurs.map((w) => w.terminate()));
  }
}

export async function testResolutionPoolAnnulation() {
  titre('Résolution — nouvelle recherche pendant que le pool calcule : aucune réponse de l’ancienne appliquée');
  // Même clé de build, autre inventaire d'artéfacts : l'ancienne réponse écrite se verrait.
  const a = fixturePool(180, { enemyDef: 1200, signature: 'pool-a', toutVerifier: false });
  const b = fixturePool(180, { enemyDef: 300, signature: 'pool-b', toutVerifier: false, sans904: true });
  const ref = classerPourLaPage(b.photo, b.candidats, b.vue);
  let anciennes: ReponseResolution[] = [];
  const pool = await classerAvecPool(VOIES, 5, [{ f: a, id: 1 }], ({ corps, recues, retenues }) => {
    if (recues < 2 || retenues.length < VOIES) return false;
    // Des réponses de la recherche 1 sont retenues ; la recherche 2 s'ouvre, puis elles arrivent.
    corps.ouvrir(b.photo, 2, b.vue, 2);
    const bs = blocs(b.candidats); bs.forEach((bloc, i) => corps.ajouter(2, i, bloc));
    corps.sceller(2, b.candidats.length, bs.length - 1, BILAN);
    corps.pomper(0);
    anciennes = retenues.map((x) => x.r);
    for (const { livrer } of retenues.splice(0)) livrer();
    return true;
  });
  const differentes = anciennes.filter((r) => {
    const neuf = ref.projection.parBuild.get(r.cle);
    return r.idContexte === 1 && r.type === 'resultat' && neuf !== undefined && !isDeepStrictEqual(neuf, r.resultat);
  });
  ok(anciennes.length === VOIES && differentes.length > 0,
    `précondition — ${anciennes.length} réponse(s) de la recherche 1 livrées après l’ouverture de la 2, dont ${differentes.length} résultat(s) différent(s) sous une clé que la 2 résout`);
  ok(isDeepStrictEqual(cacheRange(pool.projection), cacheRange(ref.projection)),
    'le cache final est celui de la recherche 2 seule : aucun équipement de la recherche 1 écrit');
  ok(isDeepStrictEqual(pool.projection.affichees, ref.projection.affichees) && isDeepStrictEqual(vu(pool.instantane), vu(ref.instantane)),
    'même classement et même page que la recherche 2 résolue par un seul résolveur');
  egal((pool.corps as unknown as { pilote: ResolutionDistante }).pilote.demandesEnVol, 0, 'chaque réponse, ancienne comprise, a rendu son crédit');
}
