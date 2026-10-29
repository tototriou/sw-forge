import { CorpsClassement, TAILLE_PAGE_CLASSEMENT, type InstantaneClassement, type PublicationClassement, type VueClassement } from '../src/lib/classementCompact';
import { CorpsResolution, type MessageVersResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import type { ReponseClassement } from '../src/workers/classementDistant';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import type { BuildCandidate } from '../src/lib/runeBuildOptim';
import { fixtureClassementCombat } from './classement-fixture';
import { verifierInstantane } from './classement-distant.test';
import { monterRecherche } from './flux-candidats.test';
import { egal, ok, titre } from './outils';

const BILAN = { explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null };

/** Horloge pilotée par le test ; aucune attente ni mesure du processeur. */
export function banc(candidatsDonnes?: BuildCandidate[]) {
  const f = fixtureClassementCombat('ehp'), resolution = new CorpsResolution();
  // Une résolution vaut ici exactement une carte ; les doublons ont leur différentiel dédié.
  f.candidats.pop();
  if (candidatsDonnes) f.candidats.splice(0, f.candidats.length, ...candidatsDonnes);
  // Chaque publication garde aussi la projection objet de son instant, pour l'oracle.
  const publications: InstantaneClassement[] = [], projections: PublicationClassement[] = [], reponses: ReponseResolution[] = [];
  let maintenant = 0, sansReponse = 0, maximum = 0, demandes = 0;
  const corps: CorpsClassement = new CorpsClassement({ publier: p => { publications.push(p); projections.push(corps.projection()); },
    resoudre: m => {
      if (m.type === 'resoudre') { demandes++; sansReponse++; maximum = Math.max(maximum, sansReponse); }
      reponses.push(...resolution.recevoir(m));
    }, incident: () => {} }, true);
  const drainer = () => {
    let garde = 0;
    while (corps.travailEnCours && garde++ < 10000) corps.avancer();
    if (corps.travailEnCours) throw new Error('Tâche de classement sans fin');
  };
  const pomper = (t = maintenant) => { maintenant = t; drainer(); corps.pomper(t); };
  const ouvrir = (id: number) => {
    corps.ouvrir(f.photo, id, f.vue, id);
    const colonnes = creerColonnesCandidats(); f.candidats.forEach(c => ajouterObjetCandidat(colonnes, c));
    const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(id, i, b));
    corps.sceller(id, f.candidats.length, lots.length - 1, BILAN); pomper();
  };
  const produire = () => {
    const r = reponses.shift() ?? resolution.etape();
    if (!r) throw new Error('Résolveur sans demande');
    sansReponse--; return r;
  };
  const repondre = (t: number) => { maintenant = t; corps.recevoirResolution(produire(), t); pomper(t); };
  const cache = () => (corps as unknown as { cache: Map<string, unknown> }).cache;
  const verifierTout = () => publications.forEach((p, i) => verifierInstantane(p, projections[i], f.photo));
  return { f, corps, publications, projections, drainer, pomper, ouvrir, produire, repondre, cache, verifierTout,
    maximum: () => maximum, demandes: () => demandes };
}

export function testClassementCreditsRelance() {
  titre('Classeur — réponses déjà produites, relance et reset jusqu’à la troisième génération');
  for (const reset of [false, true]) {
    const b = banc();
    for (const id of [1, 2, 3]) {
      b.ouvrir(id);
      egal(b.demandes(), id * 2, `${reset ? 'reset' : 'relance'} : génération ${id}, deux nouvelles demandes réelles`);
      // Pas de réponse aux annulations : le vrai résolveur avait déjà répondu.
      const a = b.produire(), c = b.produire();
      b.corps.changerVue({ ...b.f.vue, tri: 'hp' }, 2, id + 10);
      ok(b.corps.travailEnCours, 'les deux réponses arrivent pendant la tâche différée');
      const avant = b.cache().size;
      b.corps.recevoirResolution(a, id); b.corps.recevoirResolution(c, id);
      if (reset) b.corps.liberer();
      egal(b.cache().size, reset ? 0 : avant, 'les réponses retenues puis abandonnées ne remplissent jamais le cache');
    }
    ok(b.maximum() <= 2, 'au plus deux demandes réellement sans réponse, annulations comprises');
  }
}

export function testClassementCadenceDifferee() {
  titre('Classeur — actualisation indisponible, vraie fin de page et cadence du fond');
  const b = banc(); b.ouvrir(1);
  for (let i = 1; i <= 18; i += 2) {
    const a = b.produire(), c = b.produire();
    b.corps.recevoirResolution(a, i);
    ok(b.corps.travailEnCours, 'la première réponse déclenche une tâche');
    b.corps.recevoirResolution(c, i + 1);
    // Deux réponses déjà produites, dont une retenue pendant la tâche.
    for (let tour = 0; tour < 3; tour++) b.pomper(i + 1);
  }
  b.repondre(19);
  egal(b.publications.length, 1, 'aucune fausse fin de file pendant les dix-neuf premières actualisations');
  b.repondre(20);
  egal(b.publications.length, 2, 'la vingtième carte force la publication sans attendre 400 ms');
  ok(b.publications[1].enAttente > 0 && b.publications[1].page.cartes.length === TAILLE_PAGE_CLASSEMENT,
    'le fond est encore vivant à la vraie fin de page, et la page est complète');
  for (let i = 21; i <= 24; i++) b.repondre(i);
  b.pomper(419);
  egal(b.publications.length, 2, 'le fond attend les 400 ms depuis la dernière publication');
  b.pomper(420);
  egal(b.publications.length, 3, 'les écritures retenues sont publiées à l’échéance virtuelle');
  for (let i = 0; i < 30 && b.publications[b.publications.length - 1].enAttente; i++) b.repondre(421);
  const dernier = b.publications[b.publications.length - 1];
  egal(dernier.enAttente, 0, 'vraie fin de file forcée à 421 ms, dernière écriture comprise');
  b.verifierTout();
  ok(b.maximum() <= 2, 'le traitement différé conserve les deux crédits');
}

/** Le `self` du vrai Worker de classement, chargé une fois dans ce processus : ses sorties vont au journal du test en cours. */
let soiDuClasseur: { postMessage(r: ReponseClassement): void; onmessage: ((e: { data: unknown }) => void) | null } | null = null;
let journalDuClasseur: { r: ReponseClassement; t: number }[] = [];
let generationDuClasseur = 0;

async function attendre<T>(lire: () => T | undefined | false, ms: number): Promise<T | undefined> {
  const fin = performance.now() + ms;
  for (;;) {
    const v = lire();
    if (v || performance.now() > fin) return v || undefined;
    await new Promise((r) => setTimeout(r, 5));
  }
}

export async function testClassementVueSansAutreMessage() {
  titre('Classeur — le scellement et un geste de vue sont publiés dès que leur instantané est prêt, sans autre message (vrai Worker)');
  const b = banc(); b.ouvrir(1);
  b.corps.changerVue({ ...b.f.vue, page: 2 }, 2, 2); b.pomper(10);
  egal(b.publications.length, 2, 'corps : la page demandée 10 ms après la publication précédente part aussitôt');
  b.repondre(11);
  egal(b.publications.length, 2, 'corps : la réponse du fond qui suit reste soumise aux 400 ms');

  // Le vrai Worker (sa boucle de tranches, sa relance), un résolveur qui ne
  // répond jamais : deux résolutions longues en vol, aucun autre message.
  const g = globalThis as { self?: unknown }, ancien = g.self;
  const soi = soiDuClasseur ??= { postMessage: (r) => journalDuClasseur.push({ r, t: performance.now() }), onmessage: null };
  g.self = soi; journalDuClasseur = [];
  const resolveur = new MessageChannel(), flux = new MessageChannel();
  try {
    await import('../src/workers/classement.worker');
    const envoyer = (m: unknown) => soi.onmessage!({ data: m });
    const demandes: MessageVersResolution[] = [];
    resolveur.port2.onmessage = (e) => { demandes.push(e.data); };
    envoyer({ type: 'portResolution', port: resolveur.port1 });
    const f = fixtureClassementCombat('ehp'), id = ++generationDuClasseur;
    envoyer({ type: 'ouvrir', versionSchema: 1, idRecherche: id, idDemande: 1, contexte: structuredClone(f.photo), vue: f.vue });
    envoyer({ type: 'portRecherche', idRecherche: id, port: flux.port1 });
    const colonnes = creerColonnesCandidats(); f.candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
    const blocs = extraireBlocs(colonnes);
    blocs.forEach((bloc, sequence) => flux.port2.postMessage({ type: 'candidats', idRecherche: id, sequence, bloc }));
    const publications = () => journalDuClasseur.flatMap(({ r, t }) => r.type === 'publication' ? [{ p: r.publication, t }] : []);
    // La file part avant la fin de la recherche (`activer`, comme le Worker de recherche le demande).
    flux.port2.postMessage({ type: 'activer', idRecherche: id });
    const enVol = await attendre(() => demandes.filter((m) => m.type === 'resoudre').length >= 2, 3000);
    ok(enVol === true, 'file active avant le scellement : deux résolutions en vol, sans réponse');
    const avantScelle = publications(), precedenteScelle = avantScelle[avantScelle.length - 1], tScelle = performance.now();
    flux.port2.postMessage({ type: 'sceller', idRecherche: id, nombre: f.candidats.length, derniereSequence: blocs.length - 1, bilan: BILAN });
    ok(precedenteScelle !== undefined && tScelle - precedenteScelle.t < 400,
      `scellement : ${precedenteScelle ? Math.round(tScelle - precedenteScelle.t) : '?'} ms après la publication précédente, la cadence l’aurait retenu`);
    const scellee = await attendre(() => publications().find(({ p }) => p.bilan !== null), 1000);
    ok(scellee !== undefined && scellee.p.comptes.recus === f.candidats.length,
      `scellement : bilan publié sans réponse du résolveur ni autre message${scellee ? ` (${Math.round(scellee.t - tScelle)} ms)` : ' (rien en 1 s)'}`);
    const gestes: [string, VueClassement][] = [['page 2', { ...f.vue, page: 2 }], ['tri PV', { ...f.vue, tri: 'hp', page: 1 }], ['mesure Score', { tri: 'hp', metric: 'score', page: 1 }]];
    for (const [i, [nom, vue]] of gestes.entries()) {
      const avant = publications(), idVue = i + 2, precedente = avant[avant.length - 1], t0 = performance.now();
      ok(precedente !== undefined && t0 - precedente.t < 400,
        `${nom} : le geste arrive ${precedente ? Math.round(t0 - precedente.t) : '?'} ms après la publication précédente, la cadence l’aurait retenu`);
      envoyer({ type: 'vue', versionSchema: 1, idRecherche: id, idDemande: idVue, idVue, vue });
      const publiee = await attendre(() => publications().find(({ p }) => p.versions.idVue === idVue), 1000);
      ok(publiee !== undefined && publiee.p.vue.page === vue.page && publiee.p.vue.tri === vue.tri && publiee.p.vue.metric === vue.metric,
        `${nom} : publiée sans réponse du résolveur ni autre message${publiee ? ` (${Math.round(publiee.t - t0)} ms)` : ' (rien en 1 s)'}`);
      if (nom === 'page 2') ok(publiee !== undefined && publiee.p.page.premierRang === 21 && publiee.p.page.cartes.length === 0 && publiee.p.page.placesEnAttente > 0,
        'page 2 : son rang, ses places en attente, jamais l’ancienne page sous le nouveau numéro');
    }
    ok(demandes.filter((m) => m.type === 'resoudre').length >= 2 && !journalDuClasseur.some(({ r }) => r.type === 'erreur'), 'aucune erreur du classeur');
    envoyer({ type: 'liberer', versionSchema: 1, idRecherche: id, idDemande: 99 });
    ok(journalDuClasseur.some(({ r }) => r.type === 'liberee'), 'classeur libéré');
  } finally {
    resolveur.port2.close(); flux.port2.close();
    if (ancien === undefined) delete g.self; else g.self = ancien;
  }
}

/** Cherche, dans un message, un tableau qui grandirait avec le nombre de builds. */
function plusLongTableau(v: unknown, vus = new Set<unknown>()): number {
  if (v === null || typeof v !== 'object' || vus.has(v)) return 0;
  vus.add(v);
  const propre = ArrayBuffer.isView(v) ? (v as unknown as ArrayLike<unknown>).length : Array.isArray(v) ? v.length : 0;
  return Math.max(propre, ...Object.values(v as Record<string, unknown>).map(x => plusLongTableau(x, vus)));
}

export function testClassementInstantaneBorne() {
  titre('Classeur — la page ne reçoit que son instantané : vingt cartes, comptes et versions, quel que soit N');
  const f = fixtureClassementCombat('ehp');
  const tailles: number[] = [];
  for (const nombre of [40, 400, 2000]) {
    const candidats = Array.from({ length: nombre }, (_, i) => ({ ...f.candidats[i % 32], effTotal: nombre - i,
      runeIds: f.candidats[i % 32].runeIds }));
    const b = banc(candidats);
    b.ouvrir(1);
    for (let t = 1; t < 40; t++) { try { b.repondre(t * 400); } catch { break; } }
    b.corps.changerVue({ ...b.f.vue, page: 2 }, 2, 2); b.pomper(1e6);
    const longueurs = b.publications.map(p => plusLongTableau(p));
    ok(b.publications.length > 1 && longueurs.every(n => n <= TAILLE_PAGE_CLASSEMENT),
      `${nombre} builds : ${b.publications.length} publications, aucun tableau de plus de vingt éléments (max ${Math.max(...longueurs)})`);
    ok(b.publications.every(p => p.comptes.recus === nombre && p.page.cartes.length <= TAILLE_PAGE_CLASSEMENT),
      `${nombre} builds : les comptes disent N, la page n'en porte que vingt au plus`);
    b.verifierTout();
    tailles.push(Math.max(...b.publications.map(p => JSON.stringify(p).length)));
  }
  ok(tailles[2] < 2 * tailles[0], `taille d'une publication indépendante de N (${tailles.join(' / ')} caractères pour 40 / 400 / 2000 builds)`);
}

export function testClassementMortInactive() {
  titre('Recherche — propriétaire mort après cancel, reset ou refus, puis vraie relance');
  const ancien = globalThis.Worker, ancienError = console.error;
  try {
    console.error = () => {};
    for (const geste of ['cancel', 'reset', 'refus'] as const) for (const incident of ['error', 'messageerror', 'erreur'] as const) {
      const b = monterRecherche(); globalThis.Worker = b.Fil as unknown as typeof Worker;
      const f = fixtureClassementCombat('ehp'); b.rendre().run(f.params, f.photo, f.vue);
      const mort = b.fils[0], ouvrir = mort.envoyes.find((m: any) => m.type === 'ouvrir');
      mort.onmessage({ data: { type: 'ouverte', versionSchema: 1, idRecherche: ouvrir.idRecherche, idDemande: ouvrir.idDemande } });
      const resolveurs = b.fils.filter((fil: any) => fil.url.pathname.includes('resolution.worker'));
      if (geste === 'refus') b.fils.find((fil: any) => fil.url.pathname.includes('runeBuildOptim.worker'))
        .onmessage({ data: { type: 'refus', motif: 'relique-pool-vide', vide: {} } });
      else b.rendre()[geste]();
      const messageAncien = mort.onmessage;
      messageAncien({ data: { type: 'ouverte', versionSchema: 1, idRecherche: ouvrir.idRecherche, idDemande: ouvrir.idDemande } });
      ok(!mort.termine, `${geste} : une réponse ancienne ordinaire ne tue pas le propriétaire`);
      if (incident === 'error') mort.onerror({ message: 'classeur mort' });
      else if (incident === 'messageerror') mort.onmessageerror({});
      else messageAncien({ data: { type: 'erreur', versionSchema: 1, idRecherche: ouvrir.idRecherche, message: 'classeur mort' } });
      ok(mort.termine && resolveurs.length > 0 && resolveurs.every((fil: any) => fil.termine) && b.rendre().status === 'error',
        `${geste}/${incident} : propriétaire et ses ${resolveurs.length} résolveurs terminés, erreur visible, aucun secours résolveur`);
      ok(b.rendre().classement === null && !b.rendre().classementInterrompu, `${geste}/${incident} : aucune page publiée, rien à marquer interrompu`);
      b.rendre().run(f.params, f.photo, f.vue);
      const vivant = b.fils.find((fil: any) => fil !== mort && fil.url.pathname.includes('classement.worker'));
      ok(!!vivant, `${geste}/${incident} : nouveau propriétaire`);
      if (vivant) {
        const o = vivant.envoyes.find((m: any) => m.type === 'ouvrir');
        vivant.onmessage({ data: { type: 'ouverte', versionSchema: 1, idRecherche: o.idRecherche, idDemande: o.idDemande } });
        ok(b.fils[b.fils.length - 1].envoyes.some((m: any) => m.type === 'recherche'), 'la relance lance réellement une recherche');
        messageAncien({ data: { type: 'erreur', versionSchema: 1, idRecherche: 1, message: 'ancien propriétaire' } });
        egal(b.rendre().status, 'running', 'l’ancien propriétaire ne peut plus interrompre le nouveau');
      }
      for (const fil of b.fils) fil.terminate();
    }
  } finally { globalThis.Worker = ancien; console.error = ancienError; }
}
