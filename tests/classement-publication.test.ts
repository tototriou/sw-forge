import { CorpsClassement, type PublicationTransport } from '../src/lib/classementCompact';
import { ClassementDistant, type MessageVersClassement } from '../src/workers/classementDistant';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { AdaptateurClassement } from '../src/lib/adaptateurClassement';
import { fixtureClassementCombat } from './classement-fixture';
import { verifierOracle } from './classement-distant.test';
import { monterRecherche } from './flux-candidats.test';
import { egal, ok, titre } from './outils';

const BILAN = { explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null };

/** Horloge pilotée par le test ; aucune attente ni mesure du processeur. */
export function banc() {
  const f = fixtureClassementCombat('ehp'), resolution = new CorpsResolution();
  // Une résolution vaut ici exactement une carte ; les doublons ont leur différentiel dédié.
  f.candidats.pop();
  const publications: PublicationTransport[] = [], reponses: ReponseResolution[] = [];
  let maintenant = 0, sansReponse = 0, maximum = 0, demandes = 0;
  const corps = new CorpsClassement({ publier: p => publications.push(p),
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
  const acquitter = (p: PublicationTransport) => corps.acquitter(p.generationCache, p.revisionCache, f.candidats.length, p.versions);
  return { f, corps, publications, drainer, pomper, ouvrir, produire, repondre, acquitter,
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
      b.corps.recevoirResolution(a, id); b.corps.recevoirResolution(c, id);
      if (reset) b.corps.liberer();
      const p = b.publications[b.publications.length - 1];
      egal(p.changements.length, 0, 'les réponses abandonnées ne remplissent jamais le nouveau cache');
    }
    ok(b.maximum() <= 2, 'au plus deux demandes réellement sans réponse, annulations comprises');
  }
}

export function testClassementCadenceDifferee() {
  titre('Classeur — actualisation indisponible, vraie fin de page et cadence du fond');
  const b = banc(); b.ouvrir(1);
  let lus = 0;
  const adopter = () => { while (lus < b.publications.length) b.acquitter(b.publications[lus++]); };
  adopter();
  for (let i = 1; i <= 18; i += 2) {
    const a = b.produire(), c = b.produire();
    b.corps.recevoirResolution(a, i);
    ok(b.corps.travailEnCours, 'la première réponse déclenche une tâche');
    b.corps.recevoirResolution(c, i + 1);
    // Deux réponses déjà produites, dont une retenue pendant la tâche.
    for (let tour = 0; tour < 3; tour++) b.pomper(i + 1);
    adopter();
  }
  b.repondre(19); adopter();
  egal(b.publications.length, 1, 'aucune fausse fin de file pendant les dix-neuf premières actualisations');
  b.repondre(20); adopter();
  egal(b.publications.length, 2, 'la vingtième carte force la publication sans attendre 400 ms');
  ok(b.publications[1].enAttente > 0, 'le fond est encore vivant à la vraie fin de page');
  for (let i = 21; i <= 24; i++) { b.repondre(i); adopter(); }
  b.pomper(419); adopter();
  egal(b.publications.length, 2, 'le fond attend les 400 ms depuis la dernière publication');
  b.pomper(420); adopter();
  egal(b.publications.length, 3, 'les écritures retenues sont publiées à l’échéance virtuelle');
  for (let i = 0; i < 30 && b.publications[b.publications.length - 1].enAttente; i++) { b.repondre(421); adopter(); }
  const dernier = b.publications[b.publications.length - 1];
  egal(dernier.enAttente, 0, 'vraie fin de file forcée à 421 ms, dernière écriture comprise');
  const projection = new AdaptateurClassement();
  for (const p of b.publications) verifierOracle(projection.appliquer(p), b.f.photo);
  ok(b.maximum() <= 2, 'le traitement différé conserve les deux crédits');
}

export function testClassementTransfertInitial() {
  titre('Classeur — source initiale non acquittée, anciennes vues et réveil par ACK');
  const b = banc(), envoyes: MessageVersClassement[] = [];
  const recus: ReturnType<AdaptateurClassement['appliquer']>[] = [];
  const pilote = new ClassementDistant({ envoyer: m => envoyes.push(m), publier: p => { if (p) recus.push(p); },
    ouverte: () => {}, erreur: e => { throw e; }, incident: () => {} });
  pilote.ouvrir(b.f.photo, b.f.vue); b.ouvrir(1);
  const initiale = b.publications[0];
  for (let i = 1; i <= 24; i++) b.repondre(i * 400);
  egal(b.publications.length, 1, 'aucune réexpédition N ni ordre sans sa source pendant l’attente ACK');
  pilote.changerVue({ ...b.f.vue, page: 2 });
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: initiale });
  egal(envoyes.filter(m => m.type === 'publicationRecue').length, 0, 'la première vue dépassée est ignorée SANS ACK');
  b.corps.changerVue({ ...b.f.vue, page: 2 }, 2, 2); b.pomper(10000);
  const nouvelle = b.publications[b.publications.length - 1];
  ok(nouvelle !== initiale && nouvelle.candidats?.length === b.f.candidats.length, 'la nouvelle vue renvoie sa source sans attendre l’ancien ACK');
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: nouvelle });
  const avant = b.publications.length;
  b.repondre(10001);
  b.acquitter(initiale); b.corps.publier(10001, true);
  egal(b.publications.length, avant, 'ancien ACK de même nombre : le nouveau transfert reste verrouillé');
  b.acquitter(nouvelle); b.pomper(10001);
  egal(b.publications.length, avant + 1, 'ACK courant réveille la publication forcée due sans nouvelle réponse');
  const reveillee = b.publications[b.publications.length - 1];
  ok(reveillee.candidats === undefined, 'source adoptée une seule fois dans la vue courante');
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: reveillee });
  verifierOracle(recus[recus.length - 1], b.f.photo);
  b.corps.liberer(); b.acquitter(nouvelle); b.corps.publier(20000, true);
  egal(b.publications.length, avant + 1, 'libération : aucune résurrection par ancien ACK');
  b.ouvrir(2); const relance = b.publications[b.publications.length - 1];
  b.acquitter(nouvelle); b.corps.publier(20001, true);
  ok(b.publications[b.publications.length - 1] === relance, 'relance : ACK de l’ancienne recherche ignoré');

  const fin = banc(); fin.ouvrir(1);
  for (let i = 0; i < fin.f.candidats.length; i++) fin.repondre(i + 1);
  egal(fin.publications.length, 1, 'même la fin de file attend l’adoption de la source, sans la réexpédier');
  fin.acquitter(fin.publications[0]); fin.pomper(33);
  const finale = fin.publications[fin.publications.length - 1];
  egal([finale.enAttente, finale.changements.length], [0, fin.f.candidats.length], 'ACK seul : bilan et dernière écriture forcés, toutes les différences accumulées');
  const adapter = new AdaptateurClassement();
  fin.publications.forEach(p => verifierOracle(adapter.appliquer(p), fin.f.photo));
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
      if (geste === 'refus') b.fils[2].onmessage({ data: { type: 'refus', motif: 'relique-pool-vide', vide: {} } });
      else b.rendre()[geste]();
      const messageAncien = mort.onmessage;
      messageAncien({ data: { type: 'ouverte', versionSchema: 1, idRecherche: ouvrir.idRecherche, idDemande: ouvrir.idDemande } });
      ok(!mort.termine, `${geste} : une réponse ancienne ordinaire ne tue pas le propriétaire`);
      if (incident === 'error') mort.onerror({ message: 'classeur mort' });
      else if (incident === 'messageerror') mort.onmessageerror({});
      else messageAncien({ data: { type: 'erreur', versionSchema: 1, idRecherche: ouvrir.idRecherche, message: 'classeur mort' } });
      ok(mort.termine && b.fils[1].termine && b.rendre().status === 'error', `${geste}/${incident} : propriétaire terminé, erreur visible, aucun secours résolveur`);
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
