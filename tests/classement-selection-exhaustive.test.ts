import { CorpsClassement, type ClassementCompact, type VueClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { contexteResultat } from '../src/lib/contexteResultat';
import { sortCandidates, type BuildCandidate } from '../src/lib/runeBuildOptim';
import { optionsDuContexte } from '../src/lib/contexteResultat';
import { cleBuild, classementResolu, compositionDePage } from '../src/lib/artifactQueue';
import { CacheResolutionCompact } from '../src/lib/cacheResolutionCompact';
import { fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';
import { banc as bancDiffere } from './classement-publication.test';
import { AdaptateurClassement } from '../src/lib/adaptateurClassement';
import { verifierOracle } from './classement-distant.test';

/** Compte chaque lecture numérique, y compris celle d'un maillon ignoré. */
function observer(colonne: Uint32Array, lire: () => void, ecrire = () => {}): Uint32Array {
  return new Proxy(colonne, { get(cible, cle) {
    if (typeof cle === 'string' && /^(0|[1-9][0-9]*)$/.test(cle)) lire();
    if (cle === Symbol.iterator) return function* () { for (let i = 0; i < colonne.length; i++) { lire(); yield colonne[i]; } };
    const valeur = Reflect.get(cible, cle, cible);
    return typeof valeur === 'function' ? valeur.bind(cible) : valeur;
  }, set(cible, cle, valeur) {
    if (typeof cle === 'string' && /^(0|[1-9][0-9]*)$/.test(cle)) ecrire();
    return Reflect.set(cible, cle, valeur, cible);
  } });
}

function banc(nombre: number, doublons = false, apercu = false) {
  const f = fixtureClassementCombat('ehp');
  const candidats: BuildCandidate[] = Array.from({ length: nombre }, (_, i) => ({ ...f.candidats[i % 32],
    runeIds: Array.from({ length: 6 }, (_, s) => 10000 + i * 6 + s), effTotal: nombre - i }));
  if (doublons) candidats.push({ ...candidats[0], runeIds: [...candidats[0].runeIds].reverse(), effTotal: nombre + 1 });
  const runeById = new Map(f.params.pool.map(r => [r.id, r]));
  const pool = candidats.flatMap((c, i) => f.candidats[i % 32].runeIds.map((id, slot) => ({ ...runeById.get(id)!, id: c.runeIds[slot] })));
  // La copie doublonnée partage exactement ses pièces ; aucun identifiant ne manque au pool.
  if (doublons) pool.splice(-6);
  const photo = contexteResultat({ ...f.photo, params: { ...f.params, pool, objective: 'efficience' } });
  const vue: VueClassement = { ...f.vue, tri: 'efficience', adapterArtefactsAuTri: false };
  const corps = new CorpsClassement({ publier: () => {}, resoudre: () => {}, incident: () => {} });
  corps.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach(c => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  if (apercu) corps.activer(1); else corps.sceller(1, candidats.length, lots.length - 1, null);
  const base = sortCandidates(candidats, vue.tri, optionsDuContexte(photo, null, vue.metric));
  return { corps, candidats, photo, vue, lots, base };
}

type Interne = {
  base: Uint32Array; index: ClassementCompact; cache: CacheResolutionCompact;
  fileExhaustive: { suivants: Uint32Array; precedents: Uint32Array; ordinaux: Uint32Array } | null;
  restants(): BuildCandidate[]; pageIndices(): number[]; actualiser(): void;
};

function suivre(corps: CorpsClassement) {
  const interne = corps as unknown as Interne;
  let base = 0, page = 0, fond = 0, liens = 0, appels = 0;
  interne.base = observer(interne.base, () => base++);
  const pageIndices = interne.pageIndices.bind(interne);
  interne.pageIndices = () => new Proxy(pageIndices(), { get(cible, cle, receveur) {
    if (typeof cle === 'string' && /^(0|[1-9][0-9]*)$/.test(cle)) page++;
    return Reflect.get(cible, cle, receveur);
  } });
  const enveloppes = new WeakSet<Uint32Array>();
  const lire = () => {
    interne.actualiser();
    const f = interne.fileExhaustive;
    if (f) for (const cle of ['suivants', 'precedents', 'ordinaux'] as const) if (!enveloppes.has(f[cle])) {
      f[cle] = observer(f[cle], () => { liens++; if (cle === 'suivants') fond++; }, () => liens++);
      enveloppes.add(f[cle]);
    }
    appels++;
    return interne.restants();
  };
  return { interne, lire, compte: () => ({ base, page, fond, liens, appels, total: base + page + fond }) };
}

export function testClassementSelectionExhaustiveBorne() {
  titre('Sélection exhaustive — lectures et entretien bornés indépendamment du volume');
  for (const nombre of [64, 128, 256]) {
    const b = banc(nombre), s = suivre(b.corps);
    ok(b.base.some((c, i) => c !== b.candidats[i]), `${nombre} lignes : les pièces du pool produisent un ordre réellement différent de la collecte`);
    const appels = 40, premieres: number[][] = [];
    for (let q = 0; q < appels; q++) premieres.push(s.lire().slice(0, 3).map(c => c.runeIds[0]));
    egal(premieres, Array.from({ length: appels }, () => b.base.slice(0, 3).map(c => c.runeIds[0])),
      `${nombre} lignes : lire ne consomme pas les trois prochains groupes`);
    const avant = s.compte();
    ok(avant.total <= nombre + 23 * avant.appels,
      `${nombre} lignes : une construction et 23 visites par lecture (${JSON.stringify(avant)})`);
    // Aucune page prioritaire : chaque requête visite réellement les trois maillons de fond.
    b.corps.changerVue({ ...b.vue, page: 99, pageImprimee: true }, 2, 2);
    for (let i = 0; i < nombre; i++) {
      const restants = s.lire(), c = restants[0];
      egal(c.runeIds, b.base[i].runeIds, `fond ${nombre}/${i} : ordre de base conservé`);
      s.interne.cache.set(cleBuild(c), { conforme: i % 3 !== 0, stats: c.stats, artefacts: [], paire: null, meilleurSansVerrous: null });
    }
    egal(s.lire().length, 0, `${nombre} lignes : conforme ou rejeté retire exactement son groupe`);
    const fin = s.compte();
    // Le premier cache non vide entraîne également le repli complet de l'index.
    ok(fin.total <= 2 * nombre + nombre + 23 * fin.appels,
      `${nombre} lignes : entretien linéaire et requêtes bornées, sauts compris (${JSON.stringify(fin)})`);
    ok(fin.liens <= 6 * (fin.appels + nombre), `${nombre} lignes : accès aux trois colonnes après construction, entretien compris (${fin.liens})`);
    ok(fin.fond >= 3 * (nombre - 2), `${nombre} lignes : le compteur observe aussi les vrais maillons de fond`);
  }
  const b = banc(22), interne = b.corps as unknown as Interne;
  for (const c of b.base.slice(0, 19)) interne.cache.set(cleBuild(c), {
    conforme: true, stats: c.stats, artefacts: [], paire: null, meilleurSansVerrous: null,
  });
  b.corps.changerVue({ ...b.vue, pageImprimee: true }, 2, 2);
  const s = suivre(b.corps), choix = s.lire();
  egal(choix.slice(0, 3).map(c => c.runeIds), b.base.slice(19).map(c => c.runeIds),
    'une seule inconnue dans la page : deux choix de fond complètent les trois');
  egal(s.compte().fond, 3, 'le maillon de page sauté est compté avec les deux maillons de fond');
}

export function testClassementSelectionExhaustiveTransitions() {
  titre('Sélection exhaustive — oracle de file, doublons, vues, cache et source');
  for (const pageImprimee of [false, true]) {
    const b = banc(48, true), interne = b.corps as unknown as Interne;
    let vue = { ...b.vue, pageImprimee }, idVue = 1;
    const attendus = () => {
      const options = optionsDuContexte(b.photo, null, vue.metric);
      const base = sortCandidates(b.candidats, vue.tri, options);
      // Oracle volontairement linéaire : page précise, puis premier représentant de base.
      const affiches = classementResolu(base, interne.cache, vue.tri, optionsDuContexte(b.photo, interne.cache, vue.metric));
      const page = vue.pageImprimee ? affiches.slice((vue.page - 1) * 20, vue.page * 20)
        : compositionDePage({ classement: affiches, parBuild: interne.cache, page: vue.page, taillePage: 20 }).aVerifier;
      const resultat: BuildCandidate[] = [], vus = new Set<string>();
      for (const c of [...page, ...base]) {
        const cle = cleBuild(c);
        if (!interne.cache.has(cle) && !vus.has(cle)) { vus.add(cle); resultat.push(c); }
      }
      return resultat;
    };
    const verifier = (raison: string) => {
      interne.actualiser();
      const attendu = attendus(), reel = interne.restants();
      egal(reel.length, attendu.length, `${raison} : compte de groupes inconnus`);
      egal(reel.slice(0, 3).map(c => c.runeIds), attendu.slice(0, 3).map(c => c.runeIds), `${raison} : trois représentants exacts, ordre et priorité`);
      return reel;
    };
    const changer = (partiel: Partial<VueClassement>) => {
      vue = { ...vue, ...partiel }; b.corps.changerVue(vue, ++idVue, idVue);
    };
    changer({});
    verifier('source avec doublon éloigné');
    // Le transport réserve réellement ses deux places ; les lectures restent non consommatrices.
    const avantEnvoi = verifier('avant envoi').slice(0, 3).map(cleBuild);
    b.corps.pomper(0);
    egal(verifier('demandes en vol').slice(0, 3).map(cleBuild), avantEnvoi, 'envoyer deux demandes ne retire aucun groupe');
    const connu = (c: BuildCandidate, conforme: boolean) => interne.cache.set(cleBuild(c), {
      conforme, stats: c.stats, artefacts: [], paire: null, meilleurSansVerrous: null,
    });
    const premiers = verifier('avant écritures').slice(0, 3);
    connu(premiers[0], true); connu(premiers[1], false);
    verifier('deux écritures sans lecture, journal non consécutif');
    connu(premiers[2], false); verifier('delta consécutif rejeté');
    interne.cache.set('900001,900002,900003,900004,900005,900006', {
      conforme: false, stats: premiers[0].stats, artefacts: [], paire: null, meilleurSansVerrous: null,
    });
    verifier('groupe hors base');
    changer({ page: 2 }); verifier('nouvelle page');
    changer({ page: 99 }); verifier('page vide, priorité de fond');
    changer({ toutVerifier: false });
    egal(interne.fileExhaustive, null, 'K fini libère les colonnes de sélection exhaustive');
    changer({ toutVerifier: true }); verifier('false vers true sans nouveau tri');
    changer({ tri: 'hp', page: 1 }); verifier('nouvel ordre de base');
    b.corps.changerVue({ ...vue, page: 99 }, idVue - 1, 999);
    verifier('vieille vue sans effet');
    b.corps.acquitter(-1, 0, b.candidats.length, { idRecherche: 1, idVue: 1, idDemande: 1, revisionPubliee: 1 });
    verifier('vieil ACK sans effet');
    const derniere = verifier('avant clear')[0];
    interne.cache.clear(); connu(derniere, false); verifier('nouvelle génération de cache et repli complet');
    b.corps.liberer();
    egal(interne.fileExhaustive, null, 'libérer détruit les liens propriétaires');
  }
  // Un ordre de base déjà calculé peut placer la ligne doublonnée avant son chef physique.
  const d = banc(8, true), di = d.corps as unknown as Interne;
  const doublon = d.candidats.length - 1;
  di.base = Uint32Array.from([doublon, ...di.base].filter((i, rang) => i !== doublon || rang === 0));
  di.index.definirOrdreBase(di.base);
  d.corps.changerVue({ ...d.vue, page: 99, pageImprimee: true }, 2, 2);
  egal(di.restants()[0].runeIds, d.candidats[doublon].runeIds,
    'le fond renvoie le premier représentant de base, même distinct du chef physique du groupe');
  const b = banc(3010), interne = b.corps as unknown as Interne;
  b.corps.liberer();
  b.corps.ouvrir(b.photo, 2, b.vue, 2);
  b.lots.forEach((lot, i) => b.corps.ajouter(2, i, lot));
  b.corps.activer(2);
  egal(interne.restants().length, 3000, 'aperçu : seuls les 3000 candidats adoptés entrent dans la sélection');
  const c = interne.restants()[0];
  interne.cache.set(cleBuild(c), { conforme: false, stats: c.stats, artefacts: [], paire: null, meilleurSansVerrous: null });
  egal(interne.restants().length, 2999, 'aperçu : un cache commis retire son groupe');
  b.corps.sceller(2, b.candidats.length, b.lots.length - 1, null);
  egal(interne.restants().length, 3009, 'final : nouvelle source complète, résolution de l’aperçu conservée');
}

export function testClassementSelectionExhaustiveDifferee() {
  titre('Sélection exhaustive — vrai corps différé, réponses retenues et ACK retardé');
  const b = bancDiffere(), interne = b.corps as unknown as Interne;
  b.ouvrir(1);
  ok(b.f.vue.toutVerifier, 'la recherche différée exerce K infini');
  const initiale = b.publications[0];
  b.corps.recevoirResolution(b.produire(), 1);
  ok(b.corps.travailEnCours && interne.cache.size === 1, 'une vraie réponse commet le cache puis programme la tâche différée');
  egal(interne.restants().length, 0, 'pendant la tâche, les choix sont indisponibles');
  b.corps.recevoirResolution(b.produire(), 2);
  egal(interne.cache.size, 1, 'la deuxième réponse attend effectivement la fin de tâche');
  for (let tour = 0; tour < 3; tour++) b.pomper(2);
  b.drainer();
  egal(interne.cache.size, 2, 'le pompage commet ensuite la deuxième réponse');
  const choix = interne.restants();
  egal(choix.length, b.f.candidats.length - 2, 'les deux groupes commis sont retirés de la sélection exhaustive');
  egal(interne.restants().slice(0, 3).map(cleBuild), choix.slice(0, 3).map(cleBuild), 'les lectures répétées ne consomment pas les demandes suivantes en vol');
  egal(b.publications.length, 1, 'ACK initial retardé : aucune réexpédition de source');
  b.acquitter(initiale);
  b.pomper(400);
  let lues = 1;
  const adopter = () => { while (lues < b.publications.length) b.acquitter(b.publications[lues++]); };
  adopter();
  for (let i = 3; i <= b.f.candidats.length; i++) { b.repondre(400 + i); adopter(); }
  const finale = b.publications[b.publications.length - 1];
  egal([interne.cache.size, finale.enAttente], [b.f.candidats.length, 0], 'la vraie dernière réponse force la publication finale après pompage');
  const adaptateur = new AdaptateurClassement();
  for (const p of b.publications) verifierOracle(adaptateur.appliquer(p), b.f.photo);
  ok(b.maximum() <= 2, 'le chemin différé maintient la limite de deux demandes sans réponse');
}
