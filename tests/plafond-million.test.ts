// Le plafond d'un million de builds : la mémoire que le classeur tient,
// comptée par `byteLength` sur le vrai propriétaire (jamais estimée), sa
// libération d'une recherche à l'autre, et l'arrêt sur une allocation
// refusée (aucune relance, l'index déjà construit gardé).
import { MAX_COLLECTED } from '../src/lib/runeBuildOptim';
import { CorpsClassement, estEchecAllocation, reprendreSurMemoire, type InstantaneClassement } from '../src/lib/classementCompact';
import { ARRET_MEMOIRE, ajouterObjetCandidat, ajouterValeursCandidat, creerColonnesCandidats, extraireBlocs, routerMessageDuClasseur, type GabaritCandidat } from '../src/lib/candidatsCompacts';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import type { ResolutionDistante } from '../src/workers/resolutionDistante';
import { computeStats } from '../src/lib/stats';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AvisRechercheTronquee from '../src/components/outils/optimizer/AvisRechercheTronquee';
import { demandeClassementTest, fixtureClassementCombat } from './classement-fixture';
import { verifierInstantane } from './classement-distant.test';
import { egal, ok, titre } from './outils';

const BASE = { hp: 10000, atk: 700, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const GABARITS: GabaritCandidat[] = computeStats({ base: BASE, runes: [], artifacts: [] }).map(({ key, label, base, suffix }) => ({ key, label, base, suffix }));
const BILAN = (n: number) => ({ explored: n, truncated: false, nearMissByCondition: [], globalNearMiss: null });

/** N candidats distincts, en blocs de collecte, sans objet par ligne. */
function blocs(n: number, graine = 12345) {
  const colonnes = creerColonnesCandidats(), ids = new Float64Array(6), totaux = new Float64Array(8);
  let s = graine;
  const alea = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2 ** 32; };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 6; j++) ids[j] = 1 + i * 6 + j;
    for (let j = 0; j < 8; j++) totaux[j] = GABARITS[j].base + Math.floor(alea() * 1000);
    ajouterValeursCandidat(colonnes, ids, totaux, alea() * 300, GABARITS);
  }
  return extraireBlocs(colonnes);
}

function nouveauCorps(publier: (p: InstantaneClassement) => void = () => {}) {
  return new CorpsClassement({ publier, resoudre: () => { throw new Error('Résolution distante sur le classement local'); },
    incident: (r) => { throw new Error(r); } }, false, 'directe');
}

/** Une recherche entière sur `corps` : ouverture, blocs, aperçu, scellé, file jusqu'au point fixe. */
function rechercher(corps: CorpsClassement, id: number, n: number, optimiser = false, toutVerifier = false) {
  const { photo, vue } = demandeClassementTest({}, optimiser, toutVerifier);
  corps.ouvrir(photo, id, vue, id);
  const lots = blocs(n);
  lots.forEach((b, i) => corps.ajouter(id, i, b));
  corps.sceller(id, n, lots.length - 1, BILAN(n));
  let tours = 0;
  do { corps.pomper(0); tours++; } while (corps.travailEnRepli && tours < 5 * n + 10);
  corps.publier(1e9, true);
}

/** Les octets des tampons distincts que l'objet tient, par parcours de son graphe (cache des notés compris). */
function octetsTenus(racine: unknown): { total: number; tableauxJsGeants: number } {
  const vus = new Set<unknown>(), tampons = new Set<ArrayBufferLike>(), pile: unknown[] = [racine];
  let tableauxJsGeants = 0;
  while (pile.length) {
    const o = pile.pop();
    if (o === null || typeof o !== 'object' || vus.has(o)) continue;
    vus.add(o);
    if (ArrayBuffer.isView(o)) { tampons.add(o.buffer); continue; }
    if (o instanceof ArrayBuffer) { tampons.add(o); continue; }
    if (o instanceof Map) for (const [k, v] of o) pile.push(k, v);
    if (o instanceof Set) for (const v of o) pile.push(v);
    if (Array.isArray(o)) { if (o.length > 10_000) tableauxJsGeants++; for (const v of o) pile.push(v); continue; }
    for (const k of Reflect.ownKeys(o)) {
      const d = Object.getOwnPropertyDescriptor(o, k);
      if (d && 'value' in d) pile.push(d.value);
    }
  }
  let total = 0;
  for (const t of tampons) total += t.byteLength;
  return { total, tableauxJsGeants };
}

/** La capacité du hachage des groupes : la puissance de deux qui garde un taux de remplissage ≤ 0,75. */
function capaciteHachage(n: number): number {
  let c = 1;
  while (c < n / 0.75) c *= 2;
  return c;
}

/**
 * Sans file : 286 octets par build (colonnes du magasin, de l'index et de
 * l'arbre), 4 par place du hachage, et une part fixe. Le compte est exact,
 * à 100 000 comme au million : une colonne de plus change ce test, et le
 * budget de l'ADR « Plafond de builds » avec lui.
 */
export function testPlafondCompactMillion() {
  titre('Plafond — un million de builds tenus en compact, octets comptés sur le vrai classeur');
  egal(MAX_COLLECTED, 1_000_000, 'le plafond de production est d’un million de builds');
  const parTaille: number[] = [];
  for (const n of [100_000, 1_000_000]) {
    let instantane: InstantaneClassement | null = null;
    const corps = nouveauCorps((p) => { instantane = p; });
    rechercher(corps, 1, n);
    const publie = instantane as InstantaneClassement | null;
    egal(publie?.comptes.recus, n, `${n} builds reçus et classés, aucun écarté`);
    egal(publie?.page.cartes.length, 20, `${n} : la première page est pleine`);
    const { total, tableauxJsGeants } = octetsTenus(corps);
    egal(tableauxJsGeants, 0, `${n} : aucun tableau JS par build ne reste tenu (tout est en tableaux typés)`);
    egal(total, 286 * n + 4 * capaciteHachage(n) + 4261, `${n} : 286 octets par build + 4 par place de hachage + part fixe (${total} octets)`);
    parTaille.push(total / n);
  }
  ok(parTaille[1] <= parTaille[0], `linéaire : ${parTaille.map((x) => x.toFixed(2)).join(' puis ')} octets par build`);
  ok(parTaille[1] < 300, 'au million, moins de 300 octets par build sans file (≈ 281 Mio)');
}

/** Cinq recherches sur le même classeur, puis une libération : rien ne s'accumule d'une génération à l'autre. */
export function testRelancesCompactLiberation() {
  titre('Plafond — cinq relances et une libération rendent leurs tampons');
  const corps = nouveauCorps();
  const tenus: number[] = [];
  for (let id = 1; id <= 5; id++) {
    rechercher(corps, id, 20_000);
    tenus.push(octetsTenus(corps).total);
  }
  ok(tenus.every((t) => t === tenus[0]), `même mémoire tenue après chaque relance (${tenus.join(', ')} octets)`);
  corps.liberer();
  const apres = octetsTenus(corps).total;
  ok(apres < 0.05 * tenus[0], `libéré : ${apres} octets tenus, contre ${tenus[0]} pendant la recherche`);
}

/** « Vérifier toutes les combinaisons » relancé sur la même signature : le cache des notés ne grandit pas. */
export function testCacheRelanceBorne() {
  titre('Plafond — le cache des notés est borné par les builds d’une recherche, pas par le nombre de relances');
  const corps = nouveauCorps();
  const n = 8_000, tenus: number[] = [];
  for (let id = 1; id <= 3; id++) {
    rechercher(corps, id, n, true, true);
    const p = corps.projection();
    egal(p.parBuild.size, n, `relance ${id} : ${n} builds notés, autant d’entrées dans le cache`);
    tenus.push(octetsTenus(corps).total);
  }
  ok(tenus[2] === tenus[1], `même mémoire tenue à la deuxième et à la troisième relance (${tenus.join(', ')} octets)`);
}

/**
 * Une allocation refusée au scellé (l'index de N lignes) : arrêt propre. La
 * page garde l'aperçu déjà construit, annonce « arrêt : mémoire », la file
 * s'arrête, et aucune allocation de la taille refusée n'est retentée.
 */
export function testArretMemoireClassement() {
  titre('Plafond — arrêt sur la mémoire : index gardé, motif annoncé, aucune relance');
  ok(estEchecAllocation(new RangeError('Array buffer allocation failed')), 'le refus d’allocation de V8 est reconnu');
  ok(!estEchecAllocation(new RangeError('Invalid typed array length: -1')), 'une longueur invalide reste un défaut du code');
  // Avec la file (K confirmées) puis avec « Vérifier toutes les combinaisons trouvées ».
  for (const toutVerifier of [false, true]) arretAuScelle(toutVerifier);
}
function arretAuScelle(toutVerifier: boolean) {
  titre(`Plafond — arrêt au scellé, ${toutVerifier ? 'tout vérifier' : 'file vers K'}`);
  const n = 10_000, seuil = LIGNES_MAX_SANS_REFUS;
  const Original = globalThis.Float64Array;
  let refus = 0, tentativesApres = 0, arretPose = false;
  const Refusant = new Proxy(Original, { construct(cible, args, nouvelle) {
    if (typeof args[0] === 'number' && args[0] > seuil) {
      if (arretPose) tentativesApres++;
      refus++;
      throw new RangeError('Array buffer allocation failed');
    }
    return Reflect.construct(cible, args, nouvelle);
  } });
  let instantane: InstantaneClassement | null = null;
  const corps = nouveauCorps((p) => { instantane = p; });
  const { photo, vue } = demandeClassementTest({}, true, toutVerifier);
  const id = 1;
  corps.ouvrir(photo, id, vue, id);
  const lots = blocs(n);
  lots.forEach((b, i) => corps.ajouter(id, i, b));
  corps.activer(id);
  let reprise: ReturnType<CorpsClassement['arreterSurMemoire']> = null;
  (globalThis as { Float64Array: Float64ArrayConstructor }).Float64Array = Refusant;
  try {
    try {
      corps.sceller(id, n, lots.length - 1, BILAN(n));
      ok(false, 'l’index de N lignes devait être refusé');
    } catch (e) {
      ok(estEchecAllocation(e), 'le refus remonte du scellé comme un échec d’allocation');
      reprise = corps.arreterSurMemoire();
      arretPose = true;
    }
    egal(reprise?.collecteEnCours, false, 'collecte déjà scellée : rien à demander à la recherche');
    egal(corps.arreterSurMemoire(), null, 'une seconde panne n’est pas reprise : aucune boucle');
    let tours = 0;
    do { corps.pomper(0); tours++; } while (corps.travailEnRepli && tours < 1000);
    corps.publier(1e9, true);
  } finally {
    (globalThis as { Float64Array: Float64ArrayConstructor }).Float64Array = Original;
  }
  ok(refus >= 1, 'une allocation a bien été refusée');
  egal(tentativesApres, 0, 'aucune allocation de la taille refusée n’est retentée après l’arrêt');
  const publie = instantane as InstantaneClassement | null;
  egal(publie?.arretMemoire, { gardes: 3000, trouves: n }, 'motif « arrêt : mémoire » publié : l’aperçu de 3 000 gardé sur 10 000 trouvés');
  egal(publie?.comptes.recus, 3000, 'la page classe les lignes gardées');
  egal(publie?.filtre.comptes.trouvesMoteur, n, 'le total trouvé par le moteur reste annoncé');
  egal(publie?.page.cartes.length, 20, 'la première page reste servie');
  ok(!corps.travailEnRepli, 'la file est arrêtée');
  // L'arrêt vaut pour une recherche : la suivante, sur le même classeur, repart entière.
  rechercher(corps, 2, 2_000);
  egal(corps.projection().candidats.length, 2_000, 'le même classeur, relancé, classe toute la nouvelle recherche');
}
/**
 * Le branchement des deux Workers : la reprise du classeur (ce que sa coquille
 * appelle sur une faute) et le routage côté recherche (ce que la sienne
 * appelle sur un message du classeur). Pendant la collecte, l'arrêt demande
 * à la recherche de s'arrêter ; le scellé qui suit n'agrandit plus l'index.
 */
export function testArretMemoireBranchement() {
  titre('Plafond — arrêt sur la mémoire pendant la collecte : la recherche est arrêtée, le scellé garde l’aperçu');
  const appels: string[] = [];
  const recherche = { acquitter: () => appels.push('crédit'), arreter: () => appels.push('arrêt') };
  routerMessageDuClasseur({ credit: true }, recherche);
  routerMessageDuClasseur(ARRET_MEMOIRE, recherche);
  routerMessageDuClasseur(undefined, recherche);
  egal(appels, ['crédit', 'arrêt', 'crédit'], 'côté recherche : un crédit reste un crédit, l’arrêt mémoire arrête comme « Arrêter »');
  let instantane: InstantaneClassement | null = null;
  const corps = nouveauCorps((p) => { instantane = p; });
  const { photo, vue } = demandeClassementTest({}, false, false);
  corps.ouvrir(photo, 1, vue, 1);
  const lots = blocs(10_000);
  lots.slice(0, 1).forEach((b, i) => corps.ajouter(1, i, b));
  corps.activer(1);
  egal(reprendreSurMemoire(corps, new Error('autre faute')), null, 'une autre faute n’est pas reprise : le propriétaire est perdu');
  egal(reprendreSurMemoire(corps, new RangeError('Array buffer allocation failed')), { collecteEnCours: true }, 'pendant la collecte : la recherche doit être arrêtée');
  egal(reprendreSurMemoire(corps, new RangeError('Array buffer allocation failed')), null, 'une seconde panne n’est pas reprise');
  lots.slice(1).forEach((b, i) => corps.ajouter(1, i + 1, b));
  corps.sceller(1, 10_000, lots.length - 1, BILAN(10_000));
  do { corps.pomper(0); } while (corps.travailEnRepli);
  corps.publier(1e9, true);
  const publie = instantane as InstantaneClassement | null;
  egal(publie?.arretMemoire, { gardes: 3000, trouves: 10_000 }, 'au scellé, l’index n’est pas agrandi : l’aperçu gardé, tout le trouvé compté');
  egal(publie?.comptes.recus, 3000, 'la page classe les lignes gardées');
  const html = renderToStaticMarkup(createElement(AvisRechercheTronquee, { result: null, stoppedManually: true, arretMemoire: publie!.arretMemoire }));
  ok(html.includes('data-arret-memoire') && html.includes('Arrêt : mémoire') && /3.000 builds gardés sur 10.000 trouvés/.test(html),
    `l’écran annonce l’arrêt sur la mémoire, à la place de l’arrêt manuel (${html})`);
}
/**
 * L'arrêt sur la mémoire pendant une tâche du classeur différé (celui du
 * Worker), une réponse du résolveur déjà arrivée et retenue derrière la tâche :
 * sa demande rend son crédit, comme à l'ouverture. Vrais corps de résolution,
 * une voie puis trois. La page de la recherche arrêtée se vérifie encore ; la
 * recherche suivante, sur le même classeur, sert ses 20 cartes sans demande en
 * vol. Le refus lui-même (une allocation qui lève dans la tâche) est celui de
 * `arretAuScelle` ; ici, la coquille du Worker le reprend comme elle le fait
 * (`reprendreSurMemoire`).
 */
export function testArretMemoireCredits() {
  for (const voies of [1, 3]) arretPendantUneTache(voies);
}
function arretPendantUneTache(voies: number) {
  titre(`Plafond — arrêt sur la mémoire pendant une tâche, réponse retenue, ${voies} voie(s) : aucun crédit perdu`);
  const f = fixtureClassementCombat('ehp', false);
  const resolveurs = Array.from({ length: voies }, () => new CorpsResolution());
  const files: ReponseResolution[][] = resolveurs.map(() => []);
  let instantane: InstantaneClassement | null = null;
  const corps = new CorpsClassement({ publier: (p) => { instantane = p; },
    resoudre: (m, voie) => { files[voie].push(...resolveurs[voie].recevoir(m)); },
    incident: (r) => { throw new Error(`incident inattendu : ${r}`); } }, true);
  corps.brancherVoies(voies);
  const enVol = () => (corps as unknown as { pilote: ResolutionDistante }).pilote.demandesEnVol;
  let t = 0;
  const horloge = () => (t += 0.25);
  const tranches = () => { for (let garde = 0; corps.tranche(horloge); garde++) if (garde > 100_000) throw new Error('Tranches sans fin'); };
  // La plus ancienne réponse d'une voie, à tour de rôle.
  let tour = 0;
  const reponse = (): ReponseResolution | null => {
    for (let k = 0; k < voies; k++) {
      const v = (tour + k) % voies, r = files[v].shift() ?? resolveurs[v].etape();
      if (r) { tour = v + 1; return r; }
    }
    return null;
  };
  const auRepos = () => {
    for (let garde = 0; garde < 100_000; garde++) {
      tranches();
      const r = reponse();
      if (!r) { corps.publier(horloge() + 1e6, true); return; }
      corps.recevoirResolution(r, horloge());
    }
    throw new Error('Classeur jamais au repos');
  };
  const rechercher = (id: number) => {
    corps.ouvrir(f.photo, id, f.vue, id);
    const colonnes = creerColonnesCandidats();
    for (const c of f.candidats) ajouterObjetCandidat(colonnes, c);
    const lots = extraireBlocs(colonnes);
    lots.forEach((b, i) => corps.ajouter(id, i, b));
    corps.sceller(id, f.candidats.length, lots.length - 1, BILAN(f.candidats.length));
    tranches();
  };
  rechercher(1);
  // Une réponse écrit le cache : l'actualisation de l'index devient la tâche
  // du classeur ; la réponse suivante arrive pendant cette tâche et attend.
  corps.recevoirResolution(reponse()!, horloge());
  ok(corps.travailEnCours, 'une réponse écrite : l’actualisation de l’index est en cours');
  corps.recevoirResolution(reponse()!, horloge());
  ok(corps.travailEnRepli, 'la réponse suivante, arrivée pendant la tâche, est retenue');
  corps.avancer();
  egal(reprendreSurMemoire(corps, new RangeError('Array buffer allocation failed')), { collecteEnCours: false }, 'arrêt sur la mémoire au milieu de la tâche');
  auRepos();
  const arretee = instantane as InstantaneClassement | null;
  ok(arretee?.arretMemoire !== null, 'l’arrêt est annoncé');
  egal([arretee?.page.cartes.length, arretee?.page.placesEnAttente, enVol()], [20, 0, 0],
    'la page de la recherche arrêtée se vérifie : 20 cartes, aucune place en attente, aucune demande en vol');
  rechercher(2);
  auRepos();
  const suivante = instantane as InstantaneClassement | null;
  egal([suivante?.versions.idRecherche, suivante?.arretMemoire, suivante?.page.cartes.length, suivante?.page.placesEnAttente, enVol()], [2, null, 20, 0, 0],
    'la recherche suivante : 20 cartes, aucune place en attente, aucune demande en vol');
  verifierInstantane(suivante!, corps.projection(), f.photo);
}
/**
 * L'arrêt sur la mémoire pendant la collecte, sur le classeur différé mené
 * par tranches comme dans le Worker : les blocs qui arrivent encore se
 * comptent sans être gardés ; aucun ordre au fil n'est recréé, aucune note
 * recalculée, ni pendant la collecte ni au scellé.
 */
export function testArretMemoireCollecte() {
  titre('Plafond — arrêt sur la mémoire pendant la collecte : aucun travail au fil repris, les blocs suivants comptés sans être gardés');
  let instantane: InstantaneClassement | null = null;
  const corps = new CorpsClassement({ publier: (p) => { instantane = p; }, resoudre: () => { throw new Error('Résolution distante sans file'); },
    incident: (r) => { throw new Error(r); } }, true, 'directe');
  const prive = corps as unknown as { auFil: unknown[]; lots: unknown[] };
  let t = 0;
  const horloge = () => (t += 0.25);
  const tranches = () => { for (let garde = 0; corps.tranche(horloge); garde++) if (garde > 1_000_000) throw new Error('Tranches sans fin'); };
  const n = 10_000, lots = blocs(n);
  const { photo, vue } = demandeClassementTest({}, false, false);
  corps.ouvrir(photo, 1, vue, 1);
  lots.slice(0, 2).forEach((b, i) => corps.ajouter(1, i, b));
  corps.activer(1);
  tranches();
  ok(prive.auFil.length > 0 && corps.travail.notes > 0, 'avant l’arrêt, le reçu est noté au fil des blocs');
  egal(reprendreSurMemoire(corps, new RangeError('Array buffer allocation failed')), { collecteEnCours: true }, 'pendant la collecte : la recherche doit être arrêtée');
  tranches();
  const notes = corps.travail.notes, gardes = prive.lots.length;
  lots.slice(2).forEach((b, i) => { corps.ajouter(1, i + 2, b); tranches(); });
  egal([prive.auFil.length, corps.travailAuFil], [0, false], 'aucun ordre au fil recréé après l’arrêt');
  egal(corps.travail.notes, notes, 'aucune note recalculée pour les blocs arrivés après l’arrêt');
  egal(prive.lots.length, gardes, 'les blocs arrivés après l’arrêt ne sont pas gardés');
  corps.sceller(1, n, lots.length - 1, BILAN(n));
  tranches();
  corps.publier(1e9, true);
  const publie = instantane as InstantaneClassement | null;
  egal(publie?.arretMemoire, { gardes: 3000, trouves: n }, 'au scellé : l’aperçu gardé, tout le trouvé compté');
  egal([publie?.filtre.comptes.trouvesMoteur, publie?.comptes.recus], [n, 3000], 'trouvés par le moteur et lignes classées');
  egal(corps.travail.notes, notes, 'aucune note recalculée au scellé');
}
/** Au-dessus des blocs de collecte (4 096) et de l'aperçu (3 000), sous l'index de 10 000. */
const LIGNES_MAX_SANS_REFUS = 5_000;
