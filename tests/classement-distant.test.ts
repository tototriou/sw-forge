import { isDeepStrictEqual } from 'node:util';
import { Worker, MessageChannel } from 'node:worker_threads';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ClassementDistant, type ReponseClassement, type MessageVersClassement } from '../src/workers/classementDistant';
import { CorpsClassement, type PublicationClassement, type PublicationTransport, type VueClassement } from '../src/lib/classementCompact';
import { AdaptateurClassement } from '../src/lib/adaptateurClassement';
import { contexteResultat, optionsDuContexte, resolutionDuContexte } from '../src/lib/contexteResultat';
import { entreeResolutionDuBuild, etatReliqueDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild, runesDuBuild } from '../src/lib/relicQueue';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { candidatAvecSaPaire, cleBuild, ordonnerParDepartage, type ResultatArtefacts } from '../src/lib/artifactQueue';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, tamponsCandidats } from '../src/lib/candidatsCompacts';
import { aurasPropresParRunes, optionsDeClassement, scoreDeReference, scoreDuCandidat, sortCandidates, type BuildCandidate } from '../src/lib/runeBuildOptim';
import { computeStats } from '../src/lib/stats';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile } from '../src/lib/damage';
import { demandeClassementTest, fixtureClassementCombat } from './classement-fixture';
import { BASE, rune } from './relic-search.test';
import { egal, ok, titre } from './outils';
import { monterRecherche } from './flux-candidats.test';
import { rechercheClasseeTest } from './rendu/optimizer-classement-banc';

const BILAN = { explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null };

export function testClassementArretAvantOuverture() {
  titre('Recherche — arrêt retenu avant ouverture du classeur');
  const b = monterRecherche(), ancien = globalThis.Worker;
  try {
    globalThis.Worker = b.Fil as unknown as typeof globalThis.Worker;
    const f = fixture(false);
    b.rendre().run(f.params, f.photo, f.vue); b.rendre().stop();
    const fil = b.fils[0], ouvrir = fil.envoyes.find((m: any) => m.type === 'ouvrir');
    fil.onmessage({ data: { type: 'ouverte', versionSchema: 1, idRecherche: ouvrir.idRecherche, idDemande: ouvrir.idDemande } });
    const recherche = b.fils.find((f: any) => f.url.pathname.includes('runeBuildOptim.worker'));
    egal(recherche.envoyes.map((m: any) => m.type ?? (m.stop ? 'stop' : '?')), ['recherche', 'stop'], 'l’arrêt précède tout travail suivant, après la demande initiale');
    b.rendre().run(f.params, f.photo, f.vue);
    const ouvertures = fil.envoyes.filter((m: any) => m.type === 'ouvrir');
    const suivante = ouvertures[ouvertures.length - 1];
    fil.onmessage({ data: { type: 'ouverte', versionSchema: 1, idRecherche: suivante.idRecherche, idDemande: suivante.idDemande } });
    egal(b.fils[b.fils.length - 1].envoyes.filter((m: any) => m.stop).length, 0, 'la relance ne reprend pas l’arrêt de la génération précédente');
  } finally { for (const f of b.fils) f.terminate(); globalThis.Worker = ancien; }
}

export function testClassementIncidentInactif() {
  titre('Classeur — incident du résolveur après libération');
  let incidents = 0;
  const pilote = new ClassementDistant({ envoyer: () => {}, publier: () => {}, ouverte: () => {}, erreur: () => {}, incident: () => incidents++ });
  const f = fixture(false); pilote.ouvrir(f.photo, f.vue); pilote.liberer();
  pilote.recevoir({ type: 'incidentResolution', versionSchema: 1, idRecherche: 1, raison: 'canal fermé', detail: null });
  egal(incidents, 1, 'la terminaison du résolveur reste demandée quand le pilote est inactif');
}

export function testClassementBilanStable() {
  titre('Recherche — publications de file après le bilan');
  const b = monterRecherche(), ancien = globalThis.Worker;
  try {
    globalThis.Worker = b.Fil as unknown as typeof globalThis.Worker;
    const f = fixture(false); b.rendre().run(f.params, f.photo, f.vue);
    const fil = b.fils[0];
    let transport!: PublicationTransport;
    const corps = new CorpsClassement({ publier: (p) => { transport = p; }, resoudre: () => {}, incident: () => {} });
    corps.ouvrir(f.photo, 1, f.vue, 1);
    const bs = blocs(f.candidats); bs.forEach((b, i) => corps.ajouter(1, i, b));
    corps.sceller(1, f.candidats.length, bs.length - 1, BILAN); corps.publier(0, true);
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: transport } });
    const resultat = b.rendre().result, avant = b.ecritures.length;
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: { ...transport, candidats: undefined,
      versions: { ...transport.versions, revisionPubliee: 2 } } } });
    ok(b.rendre().result === resultat, 'le résultat moteur garde son identité quand seul le classement est publié');
    egal(b.ecritures.length - avant, 1, 'seul le classement est mis à jour ; aucun setResult, setProgress ni setStatus redondant');
  } finally { for (const f of b.fils) f.terminate(); globalThis.Worker = ancien; }
}

export function testClassementPublicationForceeDifferee() {
  titre('Classeur — dernière attente de page pendant une notation différée');
  const f = fixture(), resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  const adapter = new AdaptateurClassement();
  let derniere!: PublicationClassement;
  let publications = 0;
  const corps = new CorpsClassement({ publier: (p) => {
    publications++; derniere = adapter.appliquer(p);
    corps.acquitter(p.generationCache, p.revisionCache, derniere.candidats.length, p.versions);
  },
    resoudre: (m) => { reponses.push(...resolution.recevoir(m)); }, incident: () => {} }, true);
  const drainer = () => { for (let garde = 0; corps.travailEnCours && garde < 10000; garde++) corps.avancer(); };
  corps.ouvrir(f.photo, 1, f.vue, 1);
  const bs = blocs(f.candidats); bs.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, f.candidats.length, bs.length - 1, BILAN); drainer(); corps.pomper(0);
  const resolues = new Set<string>();
  for (let garde = 0; resolues.size < 20 && garde < 200; garde++) {
    const r = reponses.shift() ?? resolution.etape();
    if (!r) throw new Error('File arrêtée avant la fin de la page');
    if (r.type === 'resultat') resolues.add(r.cle);
    corps.recevoirResolution(r, 1); drainer(); corps.pomper(1);
    if (resolues.size === 19) egal(publications, 1, 'aucune publication forcée avant la vraie fin de page');
  }
  egal(resolues.size, 20, 'vingt résolutions achevées, avec travail de fond restant');
  ok(derniere.parBuild.size >= 20 && derniere.enAttente > 0, 'dernière carte publiée à 1 ms virtuel, sans attendre 400 ms ni vider le fond');
}
function fixture(optimiser = true) {
  const candidats: BuildCandidate[] = [];
  const pool = [];
  for (let i = 0; i < 28; i++) {
    const runes = Array.from({ length: 6 }, (_, j) => rune(1 + 6 * i + j, j + 1, [3, 10 + i], [[8, i % 5]], i % 3 ? 'fight' : 'violent'));
    pool.push(...runes);
    candidats.push({ runeIds: runes.map((r) => r.id), stats: computeStats({ base: BASE, runes, artifacts: [] }), effTotal: i });
  }
  // Deux lignes distinctes du même équipement gardent leur place canonique.
  candidats.push({ ...candidats[3], runeIds: [...candidats[3].runeIds].reverse(), effTotal: 100 });
  const d = demandeClassementTest({ pool, objective: 'ehp' }, optimiser);
  const vue: VueClassement = { ...d.vue, tri: 'atk', toutVerifier: true };
  return { ...d, vue, candidats };
}
function blocs(candidats: BuildCandidate[]) {
  const sortie = creerColonnesCandidats();
  for (const c of candidats) ajouterObjetCandidat(sortie, c);
  return extraireBlocs(sortie);
}
function optionsOracle(photo: ReturnType<typeof fixture>['photo'], cache: ReadonlyMap<string, ResultatArtefacts> | null, metric: VueClassement['metric']) {
  // Assemblage de 411765e3:OptimizerSection : aucun appel à optionsDuContexte.
  const runeById = new Map(photo.recherche.pool.map((r) => [r.id, r]));
  return optionsDeClassement({ realDamage: photo.realDamage, damageSetup: photo.damageSetup, runeById, metric,
    aurasPropresDe: aurasPropresParRunes(runeById), contexteExclusive: { setup: photo.damageSetup, element: photo.exclusive.element },
    artefactsDuBuild: (c) => { const r = cache?.get(cleBuild(c)); return r ? artifactDamageProfile(r.artefacts) : null; },
    etatReliqueDe: (c) => etatReliqueDuBuild(cache?.get(cleBuild(c)), photo.recherche.relicContext, photo.fiche.relic) });
}
export function verifierOracle(p: PublicationClassement, photo: ReturnType<typeof fixture>['photo']) {
  const base = sortCandidates(p.candidats, p.vue.tri, optionsOracle(photo, null, p.vue.metric));
  const options = optionsOracle(photo, p.parBuild, p.vue.metric);
  const optionsProduction = optionsDuContexte(photo, p.parBuild, p.vue.metric);
  const attendu = p.parBuild.size ? sortCandidates(ordonnerParDepartage(base.filter((c) => p.parBuild.get(cleBuild(c))?.conforme !== false),
    (c) => p.parBuild.get(cleBuild(c))?.relique?.id).map((c) => candidatAvecSaPaire(c, p.parBuild)), p.vue.tri, options) : base;
  if (!isDeepStrictEqual(p.base, base) || !isDeepStrictEqual(p.affichees, attendu)) throw new Error(`ARRÊT oracle du classeur : recherche ${p.versions.idRecherche}, publication ${p.versions.revisionPubliee}`);
  for (let i = 0; i < attendu.length; i++) if (!Object.is(scoreDuCandidat(p.affichees[i], p.vue.tri, optionsProduction), scoreDuCandidat(attendu[i], p.vue.tri, options))) throw new Error(`ARRÊT note du classeur au rang ${i + 1}`);
  ok(true, `publication ${p.versions.revisionPubliee} : ordre complet, lignes, doublons et notes identiques à l'oracle objet`);
}

export function testClassementDifferentielCombat() {
  titre('Classeur — oracle indépendant Dégâts réels et PV effectifs, paire et exclusive');
  for (const objectif of ['degats_reels', 'ehp'] as const) {
    const f = fixtureClassementCombat(objectif), adaptateur = new AdaptateurClassement();
    let derniere!: PublicationClassement;
    const corps = new CorpsClassement({ publier: (p) => {
      derniere = adaptateur.appliquer(p); verifierOracle(derniere, f.photo);
      corps.acquitter(p.generationCache, p.revisionCache, derniere.candidats.length, p.versions);
    }, resoudre: () => {}, incident: () => {} }, false, 'directe');
    corps.ouvrir(f.photo, 1, f.vue, 1);
    const bs = blocs(f.candidats); bs.forEach((b, i) => corps.ajouter(1, i, b));
    corps.sceller(1, f.candidats.length, bs.length - 1, BILAN);
    for (let garde = 0; garde < 200; garde++) {
      corps.pomper(garde * 400); corps.publier(garde * 400, true);
      if (!corps.travailEnRepli) break;
    }
    egal(derniere.affichees.length, f.candidats.length, `${objectif} : nombre et doublon conservés`);
    const options = optionsDuContexte(f.photo, derniere.parBuild, f.vue.metric);
    let effetsArtefacts = 0, effetsExclusifs = 0;
    for (const c of derniere.affichees) {
      const r = derniere.parBuild.get(cleBuild(c))!;
      const fiche = { ...f.photo.fiche, runes: runesDuBuild(c, new Map(f.params.pool.map((r) => [r.id, r]))), artifacts: r.artefacts, relic: r.relique };
      const reference = { degats: f.photo.realDamage, damageSetup: f.photo.damageSetup, exclusive: f.photo.exclusive };
      const score = scoreDeReference(objectif, fiche, reference);
      egal(scoreDuCandidat(c, objectif, options), score, `${objectif} : note de l'équipement entier, ${cleBuild(c)}`);
      if (score !== scoreDeReference(objectif, { ...fiche, relic: fiche.relic && { ...fiche.relic, unique: undefined } }, reference)) effetsExclusifs++;
      if (score !== scoreDeReference(objectif, { ...fiche, artifacts: [] }, reference)) effetsArtefacts++;
    }
    ok(effetsArtefacts > 0 && effetsExclusifs > 0, `${objectif} : les artéfacts et la propriété exclusive ont un effet chiffré, aucun canal neutre`);
    // Seuls les paramètres de calcul restent photographiés ; Comparer suit la fiche affichée.
    const reference = { degats: f.photo.realDamage, damageSetup: f.photo.damageSetup, exclusive: f.photo.exclusive };
    const avant = scoreDeReference(objectif, f.photo.fiche, reference);
    const ficheVivante = { ...f.photo.fiche, base: { ...f.photo.fiche.base, hp: 1, atk: 1 } };
    ok(avant !== scoreDeReference(objectif, ficheVivante, reference), `${objectif} : changer la fiche affichée change sa note de référence`);
  }
}

export function testClassementBancResultats() {
  titre('Banc de rendu — publication confirmée, rejet et aperçu par le vrai corps');
  const f = fixture(false), fiche = { ...f.photo.fiche, runes: f.params.pool.slice(0, 6) };
  const result = { ...BILAN, candidates: f.candidats.slice(0, 1) };
  const entree = { fiche, pool: f.params.pool, optimiser: true, vue: f.vue };
  const confirme = rechercheClasseeTest({ status: 'done', result }, entree, true);
  ok(confirme.contexte?.resolution !== null && confirme.classement?.parBuild.get(cleBuild(result.candidates[0]))?.conforme === true,
    'le résultat injecté est réellement résolu, file active et cache publié');
  const rejete = rechercheClasseeTest({ status: 'done', result }, { ...entree, requirement: { sets: [], minStats: { spd: 999 } } }, true);
  ok(rejete.classement?.parBuild.get(cleBuild(result.candidates[0]))?.conforme === false && rejete.classement.affichees.length === 0,
    'condition impossible : vrai rejet de résolution, retiré du classement');
  const apercu = rechercheClasseeTest({ status: 'running', progress: { phase: 'pairing', explored: 10, found: 5, pct: 0.1, totalPairs: 100, candidates: result.candidates } },
    { ...entree, requirement: { sets: [], minStats: { spd: 999 } } }, true);
  ok(apercu.progress?.phase === 'pairing' && apercu.progress.found === 5 && apercu.classement?.parBuild.size === 1 && apercu.classement.affichees.length === 0,
    'aperçu : cinq trouvées et un rejet réellement publié, sans fabriquer de bilan final');
}

export function testContexteResultatFige() {
  titre('Contexte du résultat — producteur pur, détaché et clonable');
  const f = fixture();
  const setup = structuredClone(DEFAULT_DAMAGE_SETUP);
  const fiche = { base: { ...BASE }, runes: f.params.pool.slice(0, 6), artifacts: [] };
  const photo = contexteResultat({ params: f.params, fiche, resolution: null, realDamage: null, damageSetup: setup,
    exclusive: { setup, element: 'fire' }, signature: 'même import', idInventaire: 7, idEspece: 12345 });
  const copie = structuredClone(photo);
  setup.enemyHp = 1; fiche.base.atk = 99999; f.params.pool[0].main.value = 99999;
  f.params.requirement.minStats.atk = 99999;
  ok(isDeepStrictEqual(photo, copie), 'les modifications de combat, fiche, pool et conditions ne changent pas la photo');
  ok(Object.isFrozen(photo) && Object.isFrozen(photo.recherche.pool[0].main), 'photographie profondément immuable');
  const externe = runInNewContext('({ base: { hp: 10 }, runes: [], artifacts: [] })');
  const depuisHarnais = contexteResultat({ params: f.params, fiche: externe, resolution: null, realDamage: null,
    damageSetup: setup, exclusive: { setup, element: null }, signature: 'autre contexte JS', idInventaire: 7, idEspece: null });
  egal(depuisHarnais.fiche.base.hp, 10, 'le même producteur accepte les données simples du contexte JS du harnais');
  const source = readFileSync(resolve('src/lib/contexteResultat.ts'), 'utf8');
  ok(!/from ['"](?:react|node:)|\b(?:window|document|self|structuredClone)\b/.test(source), 'producteur sans React ni plateforme');
}

export function testClassementDistantVersions() {
  titre('Classeur distant — recherches, vues, publications et demandes distinctes');
  const f = fixture(false), envoyes: MessageVersClassement[] = [], recus: PublicationClassement[] = [], erreurs: unknown[] = [];
  let ouvertures = 0;
  const pilote = new ClassementDistant({ envoyer: (m) => envoyes.push(m), publier: (p) => { if (p) recus.push(p); }, ouverte: () => ouvertures++, erreur: (e) => erreurs.push(e), incident: () => {} });
  let publication!: PublicationClassement;
  let transport!: PublicationTransport;
  const projection = new AdaptateurClassement();
  const corps = new CorpsClassement({ publier: (p) => { transport = p; publication = projection.appliquer(p); }, resoudre: () => {}, incident: () => {} });
  corps.ouvrir(f.photo, 1, f.vue, 1);
  const lots = blocs(f.candidats);
  lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.ajouter(1, 0, structuredClone(lots[0]));
  corps.sceller(1, f.candidats.length, lots.length - 1, BILAN);
  corps.ajouter(1, 0, structuredClone(lots[0]));
  corps.sceller(1, f.candidats.length, lots.length - 1, BILAN);
  corps.publier(0, true); verifierOracle(publication, f.photo);
  pilote.ouvrir(f.photo, f.vue);
  pilote.recevoir({ type: 'ouverte', versionSchema: 1, idRecherche: 1, idDemande: 1 });
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: transport });
  egal([ouvertures, recus.length], [1, 1], 'acquittement et première vue');
  pilote.changerVue({ ...f.vue, tri: 'hp' });
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: { ...transport, versions: { ...transport.versions, revisionPubliee: 100 } } });
  egal(recus.length, 1, 'réponse de vue dépassée ignorée même avec une révision plus haute');
  const perimee = transport;
  corps.changerVue({ ...f.vue, tri: 'hp' }, 2, 2); corps.publier(1, true);
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: transport });
  egal(recus.length, 2, 'la vue suivante conserve les candidats dont la publication dépassée n’a pas été acquittée');
  verifierOracle(recus[1], f.photo);
  pilote.ouvrir(f.photo, f.vue);
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: perimee });
  egal(recus.length, 2, 'réponse d’ancienne recherche après relance ignorée');
  pilote.liberer(); pilote.recevoir({ type: 'publication', versionSchema: 1, publication: perimee });
  egal(recus.length, 2, 'réponse après libération ignorée');
  egal(erreurs, [], 'les réponses périmées ne sont pas des pannes');

  const publicationsReprises: PublicationClassement[] = [], projectionReprise = new AdaptateurClassement();
  const reprenable = new CorpsClassement({ publier: (p) => publicationsReprises.push(projectionReprise.appliquer(p)), resoudre: () => {}, incident: () => {} }, true);
  reprenable.ouvrir(f.photo, 1, f.vue, 1);
  lots.forEach((b, i) => reprenable.ajouter(1, i, b)); reprenable.sceller(1, f.candidats.length, lots.length - 1, BILAN);
  for (let i = 0; i < 5; i++) reprenable.avancer();
  ok(reprenable.travailEnCours && !reprenable.publier(0, true), 'construction interrompable : aucun index partiellement construit n’est publié');
  reprenable.changerVue({ ...f.vue, tri: 'hp' }, 2, 2);
  for (let garde = 0; reprenable.travailEnCours && garde < 10000; garde++) reprenable.avancer();
  ok(!reprenable.travailEnCours, 'la nouvelle vue termine les étapes sans dépendre d’un événement futur');
  reprenable.pomper(0);
  egal(publicationsReprises.map((p) => p.versions.idVue), [2], 'la vue abandonnée pendant la construction ne produit aucune publication');
  verifierOracle(publicationsReprises[0], f.photo);

  const resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  const publications: PublicationClassement[] = [];
  const g = fixture();
  const adapter = new AdaptateurClassement();
  let projectionsSource = 0;
  const classeur: CorpsClassement = new CorpsClassement({ publier: (p) => {
    if (p.candidats !== undefined) projectionsSource++;
    const vue = adapter.appliquer(p); verifierOracle(vue, g.photo); publications.push(vue);
    classeur.acquitter(p.generationCache, p.revisionCache, vue.candidats.length, p.versions);
  },
    resoudre: (m) => reponses.push(...resolution.recevoir(m)), incident: () => {} });
  const alimenter = (id: number) => { classeur.ouvrir(g.photo, id, g.vue, id); const bs = blocs(g.candidats); bs.forEach((b, i) => classeur.ajouter(id, i, b)); classeur.sceller(id, g.candidats.length, bs.length - 1, BILAN); };
  alimenter(1); classeur.pomper(0);
  const ancienne = resolution.etape()!;
  alimenter(2); classeur.pomper(1);
  classeur.recevoirResolution(ancienne, 2);
  classeur.publier(3, true);
  egal(publications[publications.length - 1].parBuild.size, 0, 'ancienne réponse du résolveur : aucun équipement écrit dans la nouvelle génération');
  for (let garde = 0; garde < 100; garde++) {
    const r = reponses.shift() ?? resolution.etape();
    if (!r) break;
    classeur.recevoirResolution(r, 4);
  }
  classeur.publier(5, true);
  ok(publications[publications.length - 1].enAttente === 0, 'dernière réponse publiée sans dépendre d’un événement suivant');
  egal(projectionsSource, 2, 'un tableau de candidats par génération, aucune réémission après acquittement');
}

async function fil(nom: string): Promise<Worker> {
  const paquet = await build({ stdin: { contents: `import './src/workers/${nom}.worker';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'error' });
  return new Worker(`const {parentPort}=require('node:worker_threads'); global.self={postMessage:(m,t)=>parentPort.postMessage(m,t)};\n${paquet.outputFiles[0].text}\nparentPort.on('message',data=>self.onmessage({data}));`, { eval: true });
}

export async function testClassementDistantPanne() {
  titre('Classeur distant — vrais ports, résolveur perdu, repli dans le propriétaire');
  const f = fixture(), classeur = await fil('classement'), resolution = await fil('resolution');
  const canal = new MessageChannel(), recherche = new MessageChannel();
  let incident = false, derniere: PublicationClassement | null = null;
  const adapter = new AdaptateurClassement();
  try {
    const fini = new Promise<void>((accepter, refuser) => {
      const filet = setTimeout(() => refuser(new Error('Classeur : délai de garde dépassé')), 15000);
      classeur.on('error', (e) => { clearTimeout(filet); refuser(e); });
      classeur.on('message', (m: ReponseClassement) => {
        try {
          if (m.type === 'erreur') throw new Error(m.message);
          if (m.type === 'incidentResolution') incident = true;
          if (m.type === 'ouverte') {
            classeur.postMessage({ type: 'portRecherche', idRecherche: 1, port: recherche.port1 }, [recherche.port1]);
            // Le résolveur a réellement disparu ; les candidats restent chez le classeur.
            void resolution.terminate().then(() => {
              classeur.postMessage({ type: 'panneResolution', versionSchema: 1, idRecherche: 1, raison: 'panne injectée', detail: 'résolveur terminé' });
              const bs = blocs(f.candidats);
              bs.forEach((b, i) => {
                recherche.port2.postMessage({ type: 'candidats', idRecherche: 1, sequence: i, bloc: b }, tamponsCandidats([b]));
                ok(b.ids[0].byteLength === 0, 'le producteur cède effectivement ses tampons au classeur');
              });
              recherche.port2.postMessage({ type: 'sceller', idRecherche: 1, nombre: f.candidats.length, derniereSequence: bs.length - 1, bilan: BILAN });
            });
          }
          if (m.type === 'publication') {
            derniere = adapter.appliquer(m.publication); verifierOracle(derniere, f.photo);
            classeur.postMessage({ type: 'publicationRecue', versionSchema: 1, idRecherche: 1,
              idVue: m.publication.versions.idVue, idDemande: m.publication.versions.idDemande, revisionPubliee: m.publication.versions.revisionPubliee,
              generationCache: m.publication.generationCache, revisionCache: m.publication.revisionCache, nombre: derniere.candidats.length });
            if (derniere.bilan && derniere.enAttente === 0) { clearTimeout(filet); accepter(); }
          }
        } catch (e) { clearTimeout(filet); refuser(e); }
      });
    });
    classeur.postMessage({ type: 'portResolution', port: canal.port1 }, [canal.port1]);
    resolution.postMessage({ type: 'port', port: canal.port2 }, [canal.port2]);
    classeur.postMessage({ type: 'ouvrir', versionSchema: 1, idRecherche: 1, idDemande: 1, contexte: f.photo, vue: f.vue });
    await fini;
    ok(incident && derniere !== null, 'incident rapporté ; le classeur termine la même file sans secours sur la page');
    const publication = derniere as unknown as PublicationClassement;
    const entrees = resolutionDuContexte(f.photo, f.vue.tri, f.vue.adapterArtefactsAuTri)!;
    const runeById = new Map(f.photo.recherche.pool.map((r) => [r.id, r]));
    const caches = nouveauxCachesResolution();
    for (const candidat of f.candidats) {
      const attendu = resoudreEquipementDuBuild(entreeResolutionDuBuild({ ...entrees, runes: runesDuBuild(candidat, runeById), caches }));
      if (!isDeepStrictEqual(publication.parBuild.get(cleBuild(candidat)), attendu)) throw new Error(`ARRÊT équipement contre résolution directe : ${cleBuild(candidat)}`);
    }
    ok(true, 'cache transporté : chaque paire, relique, conformité et StatRow identique à la résolution directe');
  } finally { recherche.port2.close(); await classeur.terminate(); await resolution.terminate(); }

  let erreurs = 0, publications = 0;
  const pilote = new ClassementDistant({ envoyer: () => { throw new Error('création/envoi impossible'); }, publier: (p) => { if (p) publications++; },
    ouverte: () => {}, erreur: () => erreurs++, incident: () => {} });
  pilote.ouvrir(f.photo, f.vue); pilote.panne(new Error('erreur répétée'));
  egal([erreurs, publications], [1, 0], 'perte du classeur : un seul échec, aucune reconstitution ni relance automatique');
}

export function testClassementBranchementApp() {
  titre('Classeur — branchement applicatif, navigation et panne');
  const lire = (chemin: string) => readFileSync(resolve(chemin), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hook = lire('src/hooks/useBuildOptimSearch.ts'), adaptateur = lire('src/hooks/useArtifactOptimQueue.ts');
  const ecran = lire('src/components/outils/OptimizerSection.tsx');
  ok(hook.includes("new URL('../workers/classement.worker.ts'") && hook.includes("new URL('../workers/resolution.worker.ts'") && hook.includes('classement: { port: canal.port2, idRecherche }'), 'le vrai hook crée les deux Workers et transfère le port de recherche');
  ok(!/new Worker|resoudreEquipementDuBuild|CacheResolutionJournalise/.test(adaptateur) && adaptateur.includes('changerVue({'), 'l’adaptateur ne possède ni Worker, ni cache, ni résolution');
  ok(ecran.includes('run(params, photo,') && ecran.includes('const photo = contexteResultat(') && ecran.includes('const affichees = fileArtefacts.affichees;'), 'la photo et le classement propriétaire alimentent le vrai écran');
  ok(hook.includes('setStatus(\'error\')') && !/const \w+ = new RecepteurCandidats/.test(hook), 'perte du classeur via le canal d’erreur, sans récepteur de secours sur la page');
  ok(hook.includes('d.worker.terminate(); d.resolution?.terminate();') && adaptateur.indexOf('terminate(') < 0, 'seul le propriétaire applicatif détruit les Workers ; démonter l’écran retire la souscription seulement');

  const banc = monterRecherche(), ancienWorker = globalThis.Worker, ancienError = console.error;
  try {
    globalThis.Worker = banc.Fil as unknown as typeof globalThis.Worker;
    console.error = () => {};
    const f = fixture(false), proprietaire = banc.rendre();
    proprietaire.run(f.params, f.photo, f.vue);
    const fil = banc.fils[0];
    const ouverture = fil.envoyes.find((m: any) => m.type === 'ouvrir');
    fil.onmessage({ data: { type: 'ouverte', versionSchema: 1, idRecherche: 1, idDemande: ouverture.idDemande } });
    const recherche = banc.fils.find((f: any) => f.url.pathname.includes('runeBuildOptim.worker'));
    const ancienGestionnaire = recherche.onmessage;
    ancienGestionnaire({ data: { type: 'progress', phase: 'pairing', explored: 12, found: 29, pct: 0.5, totalPairs: 42 } });
    let transport!: PublicationTransport;
    const corps = new CorpsClassement({ publier: (p) => { transport = p; }, resoudre: () => {}, incident: () => {} });
    corps.ouvrir(f.photo, 1, f.vue, ouverture.idDemande);
    blocs(f.candidats).forEach((b, i) => corps.ajouter(1, i, b)); corps.activer(1); corps.publier(0, true);
    // Aucun adaptateur d'écran n'est monté : la recherche remonte seule dans App.
    banc.rendre(); fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: transport } });
    const pendantNavigation = banc.rendre();
    ok(pendantNavigation.status === 'running' && pendantNavigation.progress?.phase === 'pairing'
      && pendantNavigation.progress.candidates.length === 29 && !fil.termine && !recherche.termine,
      'navigation : progression et aperçu continuent dans l’état remonté, sans écran monté');
    pendantNavigation.run(f.params, f.photo, f.vue);
    ancienGestionnaire({ data: { type: 'progress', phase: 'pairing', explored: 999, found: 999, pct: 1, totalPairs: 999 } });
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: transport } });
    ok(banc.rendre().status === 'running' && banc.rendre().progress === null && banc.rendre().classement === null,
      'relance : ancien gestionnaire de recherche et ancienne publication du classeur ignorés par le vrai hook');
    fil.onerror({ message: 'classeur perdu' });
    ok(banc.rendre().status === 'error' && banc.rendre().result === null && banc.rendre().classement === null
      && fil.termine && banc.fils.filter((f: any) => f.url.pathname.includes('resolution.worker')).every((f: any) => f.termine),
      'perte du classeur : erreur de recherche existante, données perdues et Workers terminés');
    const creationRefusee = monterRecherche();
    globalThis.Worker = class { constructor() { throw new Error('création du classeur refusée'); } } as unknown as typeof globalThis.Worker;
    creationRefusee.rendre().run(f.params, f.photo, f.vue);
    ok(creationRefusee.rendre().status === 'error' && creationRefusee.fils.length === 0,
      'création impossible du classeur : erreur existante avant tout lancement du moteur');
  } finally { for (const f of banc.fils) f.terminate(); globalThis.Worker = ancienWorker; console.error = ancienError; }
}
