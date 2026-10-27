import { isDeepStrictEqual } from 'node:util';
import { Worker, MessageChannel } from 'node:worker_threads';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { ClassementDistant, type ReponseClassement, type MessageVersClassement } from '../src/workers/classementDistant';
import { CorpsClassement, TAILLE_PAGE_CLASSEMENT, type InstantaneClassement, type PublicationClassement, type VueClassement } from '../src/lib/classementCompact';
import { contexteResultat, optionsDuContexte, resolutionDuContexte } from '../src/lib/contexteResultat';
import { entreeResolutionDuBuild, etatReliqueDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild, runesDuBuild } from '../src/lib/relicQueue';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { candidatAvecSaPaire, cleBuild, compositionDePage, ordonnerParDepartage, type ResultatArtefacts } from '../src/lib/artifactQueue';
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
    let transport!: InstantaneClassement;
    const corps = new CorpsClassement({ publier: (p) => { transport = p; }, resoudre: () => {}, incident: () => {} });
    corps.ouvrir(f.photo, 1, f.vue, 1);
    const bs = blocs(f.candidats); bs.forEach((b, i) => corps.ajouter(1, i, b));
    corps.sceller(1, f.candidats.length, bs.length - 1, BILAN); corps.publier(0, true);
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: transport } });
    const resultat = b.rendre().result, avant = b.ecritures.length;
    egal(resultat?.nombre, f.candidats.length, 'le bilan porte le nombre de candidats, jamais les candidats');
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: { ...transport,
      versions: { ...transport.versions, revisionPubliee: 2 } } } });
    ok(b.rendre().result === resultat, 'le résultat moteur garde son identité quand seul le classement est publié');
    egal(b.ecritures.length - avant, 1, 'seul le classement est mis à jour ; aucun setResult, setProgress ni setStatus redondant');
  } finally { for (const f of b.fils) f.terminate(); globalThis.Worker = ancien; }
}

export function testClassementPublicationForceeDifferee() {
  titre('Classeur — dernière attente de page pendant une notation différée');
  const f = fixture(), resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  let derniere!: InstantaneClassement;
  let publications = 0;
  const corps: CorpsClassement = new CorpsClassement({ publier: (p) => {
    publications++; derniere = p; verifierInstantane(p, corps.projection(), f.photo);
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
  ok(derniere.page.cartes.length === TAILLE_PAGE_CLASSEMENT && derniere.enAttente > 0, 'dernière carte publiée à 1 ms virtuel, sans attendre 400 ms ni vider le fond');
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
  const d = demandeClassementTest({ pool, objective: 'ehp' }, optimiser, true);
  const vue: VueClassement = { ...d.vue, tri: 'atk' };
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

/**
 * L'instantané de la page est exactement ce que l'écran calculait sur la
 * projection complète : comptes de `compteConfirme`/`compteAffichable`, page
 * de `compositionDePage`, équipement et valeurs de chaque carte.
 */
/**
 * La file a fini, confirmation en fond comprise : plus rien à noter, et
 * chaque reçu jugé (noté, rejeté ou confirmé) — avec une file, résolus = reçus.
 */
export function fileFinie(i: InstantaneClassement): boolean {
  return i.enAttente === 0 && (!i.comptes.avecFile || i.comptes.resolus === i.comptes.recus);
}

export function verifierInstantane(i: InstantaneClassement, p: PublicationClassement, photo: ReturnType<typeof fixture>['photo']) {
  verifierOracle(p, photo);
  const avecFile = photo.resolution !== null;
  let resolus = 0, confirmees = 0;
  // Confirmées : les notées conformes et celles que la confirmation en fond a jugées sans les noter.
  const sansNote = new Set(p.confirmeesSansNote);
  for (const c of p.candidats) {
    const r = p.parBuild.get(cleBuild(c));
    if (r) { resolus++; if (r.conforme) confirmees++; } else if (sansNote.has(cleBuild(c))) { resolus++; confirmees++; }
  }
  const comptes = { recus: p.candidats.length, affichables: p.affichees.length, resolus: avecFile ? resolus : 0, confirmees: avecFile ? confirmees : 0, avecFile };
  const page = compositionDePage({ classement: p.affichees, parBuild: avecFile ? p.parBuild : null, page: p.vue.page, taillePage: TAILLE_PAGE_CLASSEMENT });
  const options = optionsDuContexte(photo, p.parBuild, p.vue.metric), objectif = photo.recherche.objective;
  const ehp = objectif === 'ehp' || p.vue.tri === 'ehp', degats = photo.realDamage !== null && (objectif === 'degats_reels' || p.vue.tri === 'degats_reels');
  const cartes = page.cartes.map((c) => ({ candidat: c, resultat: avecFile ? p.parBuild.get(cleBuild(c)) ?? null : null,
    pvEffectifs: ehp ? scoreDuCandidat(c, 'ehp', options) : null, degatsReels: degats ? scoreDuCandidat(c, 'degats_reels', options) : null }));
  const attendu = { versions: p.versions, vue: p.vue, comptes, page: { premierRang: page.premierRang, cartes, placesEnAttente: page.placesEnAttente }, enAttente: p.enAttente, bilan: p.bilan };
  const recu = { versions: i.versions, vue: i.vue, comptes: i.comptes, page: { ...i.page, cartes: i.page.cartes.map(({ ordinal: _o, ...c }) => c) }, enAttente: i.enAttente, bilan: i.bilan };
  if (!isDeepStrictEqual(recu, attendu)) {
    throw new Error(`ARRÊT instantané contre l'ancienne page : publication ${i.versions.revisionPubliee}\n${JSON.stringify(recu).slice(0, 600)}\n${JSON.stringify(attendu).slice(0, 600)}`);
  }
  ok(i.page.cartes.every((c) => p.candidats[c.ordinal].runeIds.join() === c.candidat.runeIds.join()),
    `publication ${i.versions.revisionPubliee} : instantané égal à l'ancienne page (comptes, ${i.page.cartes.length} cartes, places, valeurs), ordinaux justes`);
}

export function testClassementDifferentielCombat() {
  titre('Classeur — oracle indépendant Dégâts réels et PV effectifs, paire et exclusive');
  for (const objectif of ['degats_reels', 'ehp'] as const) {
    const f = fixtureClassementCombat(objectif);
    let derniere!: PublicationClassement;
    const corps: CorpsClassement = new CorpsClassement({ publier: (p) => {
      derniere = corps.projection(); verifierInstantane(p, derniere, f.photo);
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
  ok(confirme.contexte?.resolution !== null && confirme.projection.parBuild.get(cleBuild(result.candidates[0]))?.conforme === true
    && confirme.classement?.page.cartes.length === 1 && confirme.result?.nombre === 1,
    'le résultat injecté est réellement résolu, file active et cache publié');
  const rejete = rechercheClasseeTest({ status: 'done', result }, { ...entree, requirement: { sets: [], minStats: { spd: 999 } } }, true);
  ok(rejete.projection.parBuild.get(cleBuild(result.candidates[0]))?.conforme === false && rejete.classement?.comptes.affichables === 0
    && rejete.classement.page.cartes.length === 0,
    'condition impossible : vrai rejet de résolution, retiré du classement');
  const apercu = rechercheClasseeTest({ status: 'running', progress: { phase: 'pairing', explored: 10, found: 5, pct: 0.1, totalPairs: 100, candidates: result.candidates } },
    { ...entree, requirement: { sets: [], minStats: { spd: 999 } } }, true);
  ok(apercu.progress?.phase === 'pairing' && apercu.progress.found === 5 && apercu.classement?.comptes.resolus === 1 && apercu.classement.comptes.affichables === 0
    && !('candidates' in apercu.progress) && apercu.result === undefined,
    'aperçu : cinq trouvées et un rejet réellement publié, sans fabriquer de bilan final');
}

export function testContexteResultatFige() {
  titre('Contexte du résultat — producteur pur, détaché et clonable');
  const f = fixture();
  const setup = structuredClone(DEFAULT_DAMAGE_SETUP);
  const fiche = { base: { ...BASE }, runes: f.params.pool.slice(0, 6), artifacts: [] };
  const photo = contexteResultat({ params: f.params, fiche, resolution: null, realDamage: null, damageSetup: setup,
    exclusive: { setup, element: 'fire' }, signature: 'même import', idInventaire: 7, idEspece: 12345, toutVerifier: false });
  const copie = structuredClone(photo);
  setup.enemyHp = 1; fiche.base.atk = 99999; f.params.pool[0].main.value = 99999;
  f.params.requirement.minStats.atk = 99999;
  ok(isDeepStrictEqual(photo, copie), 'les modifications de combat, fiche, pool et conditions ne changent pas la photo');
  ok(Object.isFrozen(photo) && Object.isFrozen(photo.recherche.pool[0].main), 'photographie profondément immuable');
  const externe = runInNewContext('({ base: { hp: 10 }, runes: [], artifacts: [] })');
  const depuisHarnais = contexteResultat({ params: f.params, fiche: externe, resolution: null, realDamage: null,
    damageSetup: setup, exclusive: { setup, element: null }, signature: 'autre contexte JS', idInventaire: 7, idEspece: null, toutVerifier: false });
  egal(depuisHarnais.fiche.base.hp, 10, 'le même producteur accepte les données simples du contexte JS du harnais');
  const source = readFileSync(resolve('src/lib/contexteResultat.ts'), 'utf8');
  ok(!/from ['"](?:react|node:)|\b(?:window|document|self|structuredClone)\b/.test(source), 'producteur sans React ni plateforme');
}

export function testClassementDistantVersions() {
  titre('Classeur distant — recherches, vues, publications et demandes distinctes');
  const f = fixture(false), envoyes: MessageVersClassement[] = [], recus: InstantaneClassement[] = [], erreurs: unknown[] = [];
  let ouvertures = 0;
  const pilote = new ClassementDistant({ envoyer: (m) => envoyes.push(m), publier: (p) => { if (p) recus.push(p); }, ouverte: () => ouvertures++, erreur: (e) => erreurs.push(e), incident: () => {} });
  let transport!: InstantaneClassement;
  const corps: CorpsClassement = new CorpsClassement({ publier: (p) => { transport = p; verifierInstantane(p, corps.projection(), f.photo); }, resoudre: () => {}, incident: () => {} });
  corps.ouvrir(f.photo, 1, f.vue, 1);
  const lots = blocs(f.candidats);
  lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.ajouter(1, 0, structuredClone(lots[0]));
  corps.sceller(1, f.candidats.length, lots.length - 1, BILAN);
  corps.ajouter(1, 0, structuredClone(lots[0]));
  corps.sceller(1, f.candidats.length, lots.length - 1, BILAN);
  corps.publier(0, true);
  pilote.ouvrir(f.photo, f.vue);
  pilote.recevoir({ type: 'ouverte', versionSchema: 1, idRecherche: 1, idDemande: 1 });
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: transport });
  egal([ouvertures, recus.length], [1, 1], 'acquittement et première vue');
  egal(envoyes.map((m) => m.type), ['ouvrir'], 'aucun acquittement de publication : l’instantané n’a rien à faire adopter');
  pilote.changerVue({ ...f.vue, tri: 'hp' });
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: { ...transport, versions: { ...transport.versions, revisionPubliee: 100 } } });
  egal(recus.length, 1, 'réponse de vue dépassée ignorée même avec une révision plus haute');
  const perimee = transport;
  corps.changerVue({ ...f.vue, tri: 'hp' }, 2, 2); corps.publier(1, true);
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: transport });
  egal(recus.length, 2, 'la vue suivante est publiée sans attendre aucun acquittement de l’ancienne');
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: { ...transport, versions: { ...transport.versions, idInventaire: 99 } } });
  egal(recus.length, 2, 'instantané d’un autre inventaire : jamais mélangé');
  pilote.ouvrir(f.photo, f.vue);
  pilote.recevoir({ type: 'publication', versionSchema: 1, publication: perimee });
  egal(recus.length, 2, 'réponse d’ancienne recherche après relance ignorée');
  pilote.liberer(); pilote.recevoir({ type: 'publication', versionSchema: 1, publication: perimee });
  egal(recus.length, 2, 'réponse après libération ignorée');
  egal(erreurs, [], 'les réponses périmées ne sont pas des pannes');

  const publicationsReprises: InstantaneClassement[] = [];
  const reprenable: CorpsClassement = new CorpsClassement({ publier: (p) => { publicationsReprises.push(p); verifierInstantane(p, reprenable.projection(), f.photo); }, resoudre: () => {}, incident: () => {} }, true);
  reprenable.ouvrir(f.photo, 1, f.vue, 1);
  lots.forEach((b, i) => reprenable.ajouter(1, i, b)); reprenable.sceller(1, f.candidats.length, lots.length - 1, BILAN);
  for (let i = 0; i < 5; i++) reprenable.avancer();
  ok(reprenable.travailEnCours && !reprenable.publier(0, true), 'construction interrompable : aucun index partiellement construit n’est publié');
  reprenable.changerVue({ ...f.vue, tri: 'hp' }, 2, 2);
  for (let garde = 0; reprenable.travailEnCours && garde < 10000; garde++) reprenable.avancer();
  ok(!reprenable.travailEnCours, 'la nouvelle vue termine les étapes sans dépendre d’un événement futur');
  reprenable.pomper(0);
  egal(publicationsReprises.map((p) => p.versions.idVue), [2], 'la vue abandonnée pendant la construction ne produit aucune publication');

  const resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  const publications: InstantaneClassement[] = [];
  const g = fixture();
  const classeur: CorpsClassement = new CorpsClassement({ publier: (p) => { verifierInstantane(p, classeur.projection(), g.photo); publications.push(p); },
    resoudre: (m) => reponses.push(...resolution.recevoir(m)), incident: () => {} });
  const alimenter = (id: number) => { classeur.ouvrir(g.photo, id, g.vue, id); const bs = blocs(g.candidats); bs.forEach((b, i) => classeur.ajouter(id, i, b)); classeur.sceller(id, g.candidats.length, bs.length - 1, BILAN); };
  alimenter(1); classeur.pomper(0);
  const ancienne = resolution.etape()!;
  alimenter(2); classeur.pomper(1);
  classeur.recevoirResolution(ancienne, 2);
  classeur.publier(3, true);
  egal(publications[publications.length - 1].comptes.resolus, 0, 'ancienne réponse du résolveur : aucun équipement écrit dans la nouvelle génération');
  for (let garde = 0; garde < 100; garde++) {
    const r = reponses.shift() ?? resolution.etape();
    if (!r) break;
    classeur.recevoirResolution(r, 4);
  }
  classeur.publier(5, true);
  ok(publications[publications.length - 1].enAttente === 0, 'dernière réponse publiée sans dépendre d’un événement suivant');
}

/** Une coquille de production (`<nom>.worker.ts`) sur un vrai fil Node. */
export async function fil(nom: string): Promise<Worker> {
  const paquet = await build({ stdin: { contents: `import './src/workers/${nom}.worker';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'error' });
  return new Worker(`const {parentPort}=require('node:worker_threads'); global.self={postMessage:(m,t)=>parentPort.postMessage(m,t)};\n${paquet.outputFiles[0].text}\nparentPort.on('message',data=>self.onmessage({data}));`, { eval: true });
}

export async function testClassementDistantPanne() {
  titre('Classeur distant — vrais ports, résolveur perdu, repli dans le propriétaire');
  const f = fixture(), classeur = await fil('classement'), resolution = await fil('resolution');
  const canal = new MessageChannel(), recherche = new MessageChannel();
  let incident = false, derniere: InstantaneClassement | null = null, longueurMax = 0;
  const longueur = (v: unknown, vus = new Set<unknown>()): number => {
    if (v === null || typeof v !== 'object' || vus.has(v)) return 0;
    vus.add(v);
    const propre = ArrayBuffer.isView(v) ? (v as unknown as ArrayLike<unknown>).length : Array.isArray(v) ? v.length : 0;
    return Math.max(propre, ...Object.values(v as Record<string, unknown>).map((x) => longueur(x, vus)));
  };
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
            derniere = m.publication; longueurMax = Math.max(longueurMax, longueur(m));
            if (derniere.bilan && fileFinie(derniere)) { clearTimeout(filet); accepter(); }
          }
        } catch (e) { clearTimeout(filet); refuser(e); }
      });
    });
    classeur.postMessage({ type: 'portResolution', port: canal.port1 }, [canal.port1]);
    resolution.postMessage({ type: 'port', port: canal.port2 }, [canal.port2]);
    classeur.postMessage({ type: 'ouvrir', versionSchema: 1, idRecherche: 1, idDemande: 1, contexte: f.photo, vue: f.vue });
    await fini;
    const publication = derniere as unknown as InstantaneClassement;
    ok(incident && publication.incident === 'panne injectée', 'incident rapporté et porté par l’instantané ; le classeur termine la même file sans secours sur la page');
    ok(longueurMax <= TAILLE_PAGE_CLASSEMENT && publication.comptes.recus === f.candidats.length,
      `vrai Worker : ses messages vers la page ne portent aucun tableau de plus de vingt éléments (max ${longueurMax}), les comptes disent N`);
    const entrees = resolutionDuContexte(f.photo)!;
    const runeById = new Map(f.photo.recherche.pool.map((r) => [r.id, r]));
    const caches = nouveauxCachesResolution();
    const parBuild = new Map<string, ResultatArtefacts>();
    for (const candidat of f.candidats) parBuild.set(cleBuild(candidat), resoudreEquipementDuBuild(entreeResolutionDuBuild({ ...entrees, runes: runesDuBuild(candidat, runeById), caches })));
    for (const carte of publication.page.cartes) {
      if (!isDeepStrictEqual(carte.resultat, parBuild.get(cleBuild(carte.candidat)))) throw new Error(`ARRÊT équipement contre résolution directe : ${cleBuild(carte.candidat)}`);
    }
    // Tout est résolu : l'oracle objet compose la même page à partir de la résolution directe.
    const options = optionsOracle(f.photo, parBuild, f.vue.metric);
    const base = sortCandidates(f.candidats, f.vue.tri, optionsOracle(f.photo, null, f.vue.metric));
    const affichees = sortCandidates(ordonnerParDepartage(base.filter((c) => parBuild.get(cleBuild(c))?.conforme !== false),
      (c) => parBuild.get(cleBuild(c))?.relique?.id).map((c) => candidatAvecSaPaire(c, parBuild)), f.vue.tri, options);
    const page = compositionDePage({ classement: affichees, parBuild, page: 1, taillePage: TAILLE_PAGE_CLASSEMENT });
    ok(isDeepStrictEqual(publication.page.cartes.map((c) => c.candidat), page.cartes) && page.cartes.length === TAILLE_PAGE_CLASSEMENT,
      'cartes de la page : celles de l’oracle objet, dans son ordre, stats de la vraie paire');
    ok(true, 'cache transporté : chaque paire, relique, conformité et StatRow des cartes identique à la résolution directe');
  } finally { recherche.port2.close(); await classeur.terminate(); await resolution.terminate(); }

  let erreurs = 0, publications = 0;
  const pilote = new ClassementDistant({ envoyer: () => { throw new Error('création/envoi impossible'); }, publier: (p) => { if (p) publications++; },
    ouverte: () => {}, erreur: () => erreurs++, incident: () => {} });
  pilote.ouvrir(f.photo, f.vue); pilote.panne(new Error('erreur répétée'));
  egal([erreurs, publications], [1, 0], 'perte du classeur : un seul échec, aucune reconstitution ni relance automatique');
}

export function testClassementBranchementApp() {
  titre('Classeur — branchement applicatif, instantané seul sur la page, navigation et panne');
  const lire = (chemin: string) => readFileSync(resolve(chemin), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hook = lire('src/hooks/useBuildOptimSearch.ts');
  const ecran = lire('src/components/outils/OptimizerSection.tsx');
  ok(hook.includes("new URL('../workers/classement.worker.ts'") && hook.includes("new URL('../workers/resolution.worker.ts'") && hook.includes('classement: { port: canal.port2, idRecherche }'), 'le vrai hook crée les deux Workers et transfère le port de recherche');
  ok(ecran.includes('run(params, photo,') && ecran.includes('const photo = contexteResultat(') && ecran.includes('const instantane = search.classement;')
    && ecran.includes('const cartes = instantane?.page.cartes ?? AUCUNE_CARTE;'), 'la photo et l’instantané du classeur alimentent le vrai écran');
  ok(!/parBuild|fullSortedCandidates|affichees|compositionDePage\(|compteConfirme\(|optionsDuContexte|cleBuild\(/.test(ecran),
    'l’écran ne lit ni cache, ni classement complet, ni composition : aucun parcours de N');
  ok(hook.includes('setStatus(\'error\')') && !/const \w+ = new RecepteurCandidats/.test(hook), 'perte du classeur via le canal d’erreur, sans récepteur de secours sur la page');
  ok(hook.includes('d.worker.terminate(); for (const r of d.resolutions) r?.terminate();'), 'seul le propriétaire applicatif détruit les Workers, tout le pool de résolution');
  ok(hook.includes('nombreDeResolveurs(navigator.hardwareConcurrency, coeursPhysiquesRef.current)')
    && hook.includes("worker.postMessage({ type: 'portsResolution', ports }, ports)"), 'le pool suit la règle des Workers de la machine, ses canaux transférés ensemble au classeur');

  const plusLong = (v: unknown, vus = new Set<unknown>()): number => {
    if (v === null || typeof v !== 'object' || vus.has(v)) return 0;
    vus.add(v);
    const propre = ArrayBuffer.isView(v) ? (v as unknown as ArrayLike<unknown>).length : Array.isArray(v) ? v.length : 0;
    return Math.max(propre, ...Object.values(v as Record<string, unknown>).map((x) => plusLong(x, vus)));
  };
  const etatPage = (r: ReturnType<typeof banc.rendre>) => ({ status: r.status, result: r.result, progress: r.progress, classement: r.classement, contexteResolution: r.contexte?.resolution ?? null });
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
    const publier = (id: number, idDemande: number, nombre = f.candidats.length) => {
      let transport!: InstantaneClassement;
      const corps = new CorpsClassement({ publier: (p) => { transport = p; }, resoudre: () => {}, incident: () => {} });
      corps.ouvrir(f.photo, id, f.vue, idDemande);
      const bs = blocs(f.candidats.slice(0, nombre)); bs.forEach((b, i) => corps.ajouter(id, i, b));
      corps.sceller(id, nombre, bs.length - 1, BILAN); corps.publier(0, true);
      return transport;
    };
    const transport = publier(1, ouverture.idDemande);
    // Aucun écran n'est monté : la recherche remonte seule dans App.
    banc.rendre(); fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: transport } });
    const pendantNavigation = banc.rendre();
    ok(pendantNavigation.status === 'done' && pendantNavigation.result?.nombre === f.candidats.length && !fil.termine,
      'navigation : la publication scellée remonte dans l’état applicatif, sans écran monté');
    ok(plusLong(etatPage(pendantNavigation)) <= 20,
      `ce que reçoit l’écran (bilan, progression, instantané) ne porte aucun tableau de plus de vingt éléments (max ${plusLong(etatPage(pendantNavigation))})`);
    pendantNavigation.run(f.params, f.photo, f.vue);
    ancienGestionnaire({ data: { type: 'progress', phase: 'pairing', explored: 999, found: 999, pct: 1, totalPairs: 999 } });
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: transport } });
    ok(banc.rendre().status === 'running' && banc.rendre().progress === null && banc.rendre().classement === null,
      'relance : ancien gestionnaire de recherche et ancienne publication du classeur ignorés par le vrai hook');
    const relance = fil.envoyes.filter((m: any) => m.type === 'ouvrir')[1];
    fil.onmessage({ data: { type: 'publication', versionSchema: 1, publication: publier(2, relance.idDemande, 5) } });
    const avantPanne = banc.rendre().classement;
    ok(avantPanne?.versions.idRecherche === 2 && avantPanne.comptes.recus === 5, 'la nouvelle recherche publie sa première page');
    const recevoirAncien = fil.onmessage;
    fil.onerror({ message: 'classeur perdu' });
    const apres = banc.rendre();
    ok(apres.status === 'error' && apres.classementInterrompu && apres.classement === avantPanne && apres.result?.nombre === 5
      && fil.termine && banc.fils.filter((f: any) => f.url.pathname.includes('resolution.worker')).every((f: any) => f.termine),
      'perte du classeur : erreur de recherche existante, dernière page gardée et marquée interrompue, Workers terminés');
    recevoirAncien({ data: { type: 'publication', versionSchema: 1, publication: { ...avantPanne!, versions: { ...avantPanne!.versions, revisionPubliee: 99 } } } });
    ok(banc.rendre().classement === avantPanne, 'aucune publication tardive du propriétaire perdu n’est appliquée');
    banc.rendre().run(f.params, f.photo, f.vue);
    ok(banc.rendre().classement === null && !banc.rendre().classementInterrompu && banc.rendre().status === 'running',
      'Rechercher : nouveau propriétaire, la page interrompue est effacée, jamais reconstituée');
    banc.rendre().reset();
    ok(banc.rendre().classement === null && !banc.rendre().classementInterrompu && banc.rendre().status === 'idle', 'reset : plus rien d’affiché');
    const creationRefusee = monterRecherche();
    globalThis.Worker = class { constructor() { throw new Error('création du classeur refusée'); } } as unknown as typeof globalThis.Worker;
    creationRefusee.rendre().run(f.params, f.photo, f.vue);
    ok(creationRefusee.rendre().status === 'error' && creationRefusee.fils.length === 0 && !creationRefusee.rendre().classementInterrompu,
      'création impossible du classeur : erreur existante avant tout lancement du moteur, rien à marquer interrompu');
  } finally { for (const f of banc.fils) f.terminate(); globalThis.Worker = ancienWorker; console.error = ancienError; }
}
