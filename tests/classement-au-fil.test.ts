import { isDeepStrictEqual } from 'node:util';
import { CorpsClassement, ordreCollecte, type InstantaneClassement, type PublicationClassement, type VueClassement } from '../src/lib/classementCompact';
import { optionsDuContexte, type ContexteResultat } from '../src/lib/contexteResultat';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, type BlocCandidats } from '../src/lib/candidatsCompacts';
import type { BuildCandidate } from '../src/lib/runeBuildOptim';
import { computeStats } from '../src/lib/stats';
import { fixtureClassementCombat } from './classement-fixture';
import { verifierInstantane } from './classement-distant.test';
import { egal, ok, titre } from './outils';

const BILAN = { explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null };

function generateur(graine: number) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** N candidats tirés du pool de la fixture : doublons d'équipement, égalités de note, valeurs non finies au choix. */
function population(objectif: 'degats_reels' | 'ehp', n: number, hasard: () => number, nonFinis: number[] = []) {
  const f = fixtureClassementCombat(objectif, false);
  const runes = new Map(f.params.pool.map((r) => [r.id, r]));
  const candidats: BuildCandidate[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && hasard() < 0.05) {
      // Deux lignes du même équipement : même groupe, ordinaux distincts.
      const autre = candidats[Math.floor(hasard() * candidats.length)];
      candidats.push({ ...autre, runeIds: [...autre.runeIds].reverse(), effTotal: hasard() });
      continue;
    }
    const ids = Array.from({ length: 6 }, (_, j) => 1000 + Math.floor(hasard() * 32) * 6 + j);
    const stats = computeStats({ base: f.params.base, runes: ids.map((id) => runes.get(id)!), artifacts: f.params.artifacts });
    candidats.push({ runeIds: ids, stats, effTotal: Math.floor(hasard() * 50) });
  }
  for (const [k, i] of nonFinis.entries()) {
    const total = k % 2 ? Infinity : NaN, c = candidats[i];
    candidats[i] = { ...c, stats: c.stats.map((s) => s.key === 'hp' ? { ...s, total, bonus: total - s.base } : s) };
  }
  return { f, candidats };
}

/** Des blocs contigus de tailles variées, chacun avec ses propres tampons. */
function decouper(candidats: BuildCandidate[], taille: () => number): BlocCandidats[] {
  const blocs: BlocCandidats[] = [];
  for (let debut = 0; debut < candidats.length;) {
    const n = Math.min(Math.max(1, taille()), candidats.length - debut);
    const colonnes = creerColonnesCandidats();
    for (let i = debut; i < debut + n; i++) ajouterObjetCandidat(colonnes, candidats[i]);
    blocs.push({ ...extraireBlocs(colonnes)[0], debut });
    debut += n;
  }
  return blocs;
}
const copier = (b: BlocCandidats): BlocCandidats => ({ ...b, ids: b.ids.map((c) => c.slice()), totaux: b.totaux.map((c) => c.slice()), efficience: b.efficience.slice() });

/** Un propriétaire de production différé, résolution directe ; ses instantanés gardés. */
function proprietaire() {
  const publications: InstantaneClassement[] = [];
  const corps = new CorpsClassement({ publier: (p) => { publications.push(p); }, resoudre: () => { throw new Error('résolution distante'); },
    incident: (r) => { throw new Error(r); } }, true, 'directe');
  return { corps, publications };
}

interface Scenario {
  nom: string; graine: number; objectif: 'degats_reels' | 'ehp'; n: number; taille: (h: () => number) => number;
  vue?: StatOuObjectif; nonFinis?: number[]; coupure?: 'relance' | 'liberation'; changements?: StatOuObjectif[];
}
type StatOuObjectif = VueClassement['tri'];

/**
 * Le même flux, les mêmes vues et la même file, à deux propriétaires : l'un
 * prépare notes et ordre de base au fil des blocs, entrelacés avec ses tâches
 * (aperçu, actualisations) à des cadences tirées, l'autre ne prépare rien et
 * classe tout au scellé. Leurs instantanés et projections doivent être égaux.
 * Les deux passent par le même code au scellé : la référence indépendante de
 * leur ordre de base est `ordreCollecte` (`verifierOrdresDeBase`).
 */
function rejouer(s: Scenario) {
  const hasard = generateur(s.graine);
  const { f, candidats } = population(s.objectif, s.n, hasard, s.nonFinis);
  const vueInitiale: VueClassement = { ...f.vue, tri: s.vue ?? f.vue.tri };
  const a = proprietaire(), r = proprietaire();
  let t = 0, idVue = 1, demande = 1, id = 1, auFil = 0;
  // La référence draine ses tâches ; l'autre intercale le travail au fil, même pendant une tâche.
  const synchroniser = () => {
    for (let garde = 0; a.corps.travailEnCours || hasard() < 0.3; garde++) {
      if (garde > 5e6) throw new Error('Tâche sans fin');
      if (hasard() < 0.5) { if (a.corps.avancerAuFil()) auFil++; } else a.corps.avancer();
      if (!a.corps.travailEnCours && hasard() < 0.5) break;
    }
    while (r.corps.travailEnCours) r.corps.avancer();
    t += 50; a.corps.pomper(t); r.corps.pomper(t);
    while (a.corps.travailEnCours) a.corps.avancer();
    while (r.corps.travailEnCours) r.corps.avancer();
  };
  const ouvrir = () => { for (const p of [a, r]) p.corps.ouvrir(f.photo, id, vueInitiale, demande); idVue = 1; };
  const envoyer = (blocs: BlocCandidats[], jusqua: number, depuis = 0) => {
    for (let k = depuis; k < jusqua; k++) {
      a.corps.ajouter(id, k, copier(blocs[k])); r.corps.ajouter(id, k, copier(blocs[k]));
      a.corps.activer(id); r.corps.activer(id);
      if (s.changements && hasard() < 0.15) {
        const tri = s.changements[Math.floor(hasard() * s.changements.length)];
        const vue = { ...vueInitiale, tri, page: 1 + Math.floor(hasard() * 2) };
        idVue++; demande++;
        a.corps.changerVue(vue, idVue, demande); r.corps.changerVue(vue, idVue, demande);
      }
      // Parfois tout rattraper, parfois rien : le scellé trouve tous les états.
      if (hasard() < 0.3) while (a.corps.avancerAuFil()) auFil++;
      synchroniser();
    }
  };
  ouvrir();
  let blocs = decouper(candidats, () => s.taille(hasard));
  if (s.coupure) {
    envoyer(blocs, Math.ceil(blocs.length / 2));
    if (s.coupure === 'liberation') { a.corps.liberer(); r.corps.liberer(); }
    id++; demande++; ouvrir();
    blocs = decouper(candidats, () => s.taille(hasard));
  }
  envoyer(blocs, blocs.length);
  for (const p of [a, r]) p.corps.sceller(id, candidats.length, blocs.length - 1, BILAN);
  for (let tour = 0; tour < 2000; tour++) {
    synchroniser();
    if (!a.corps.travailEnRepli && !r.corps.travailEnRepli) break;
  }
  t += 1000; a.corps.publier(t, true); r.corps.publier(t, true);
  return { f, candidats, a, r, auFil };
}

/**
 * La référence indépendante du travail au fil : `ordreCollecte`, l'ancien
 * chemin, qui note les N lignes et les trie d'un bloc (`trierIndicesEtapes`),
 * pour l'ordre de base de la vue et, quand la vue ne suit pas le lancement,
 * pour l'ordre du fond.
 */
function verifierOrdresDeBase(nom: string, corps: CorpsClassement, photo: ContexteResultat, p: PublicationClassement) {
  const interne = corps as unknown as { base: Uint32Array; fondPropre: { ordre: Uint32Array } | null };
  const ecart = (recu: Uint32Array, attendu: Uint32Array) => attendu.findIndex((i, k) => recu[k] !== i);
  const attendu = ordreCollecte(p.candidats, p.vue.tri, optionsDuContexte(photo, null, p.vue.metric));
  if (interne.base.length !== attendu.length || ecart(interne.base, attendu) >= 0)
    throw new Error(`ARRÊT ${nom} : ordre de base contre ordreCollecte, premier écart au rang ${ecart(interne.base, attendu) + 1}`);
  const objectif = photo.recherche.objective ?? 'efficience', metric = photo.recherche.metric;
  if (p.vue.tri === objectif && p.vue.metric === metric) return;
  const fond = ordreCollecte(p.candidats, objectif, optionsDuContexte(photo, null, metric));
  if (!interne.fondPropre || ecart(interne.fondPropre.ordre, fond) >= 0) throw new Error(`ARRÊT ${nom} : ordre du fond contre ordreCollecte`);
}

function comparer(s: Scenario) {
  const { f, candidats, a, r, auFil } = rejouer(s);
  const pa: PublicationClassement = a.corps.projection(), pr: PublicationClassement = r.corps.projection();
  verifierOrdresDeBase(`${s.nom}, au fil`, a.corps, f.photo, pa);
  verifierOrdresDeBase(`${s.nom}, au scellé`, r.corps, f.photo, pr);
  ok(true, `${s.nom} : ordre de base (et du fond) des deux propriétaires égal à ordreCollecte, tri des N lignes d'un bloc`);
  if (a.publications.length !== r.publications.length) throw new Error(`ARRÊT ${s.nom} : ${a.publications.length} publications au fil contre ${r.publications.length} au scellé`);
  a.publications.forEach((p, k) => {
    if (!isDeepStrictEqual(p, r.publications[k])) throw new Error(`ARRÊT ${s.nom} : publication ${k + 1} différente\n${JSON.stringify(p).slice(0, 400)}\n${JSON.stringify(r.publications[k]).slice(0, 400)}`);
  });
  if (!isDeepStrictEqual(pa, pr)) throw new Error(`ARRÊT ${s.nom} : projection différente (ordre de base, classement, cache)`);
  ok(true, `${s.nom} : ${a.publications.length} instantanés, comptes, versions, ordre de base et classement complets identiques (${candidats.length} candidats, ${auFil} pas au fil)`);
  // L'oracle objet indépendant (sortCandidates, classementResolu) sur le dernier état.
  verifierInstantane(a.publications[a.publications.length - 1], pa, f.photo);
  return { a, r, candidats };
}

export function testClassementAuFilDifferentiel() {
  titre('Classeur — notes et ordre de base au fil des blocs contre classement au scellé');
  const scenarios: Scenario[] = [
    { nom: 'Dégâts réels, blocs de 1 à 4096, vue de lancement puis PV et retour', graine: 1, objectif: 'degats_reels', n: 9000,
      taille: (h) => h() < 0.3 ? 4096 : 1 + Math.floor(h() * 4096), changements: ['degats_reels', 'hp', 'degats_reels'] },
    { nom: 'PV effectifs, tri Précision (ex æquo), NaN et ∞, relance au milieu', graine: 2, objectif: 'ehp', n: 13000, vue: 'acc',
      taille: (h) => 1 + Math.floor(h() * 3000), nonFinis: [17, 9000], coupure: 'relance', changements: ['acc', 'ehp', 'efficience'] },
    { nom: 'Dégâts réels, petits blocs, libération et nouvelle recherche au milieu', graine: 3, objectif: 'degats_reels', n: 6000, vue: 'efficience',
      taille: (h) => 1 + Math.floor(h() * 200), coupure: 'liberation' },
    { nom: 'Un seul bloc partiel', graine: 4, objectif: 'ehp', n: 37, taille: () => 4096 },
    { nom: 'Note non finie au premier bloc, tri PV', graine: 5, objectif: 'ehp', n: 5000, vue: 'hp', nonFinis: [0], taille: () => 4096 },
  ];
  for (const s of scenarios) comparer(s);
  const vide = rejouer({ nom: 'aucun candidat', graine: 6, objectif: 'ehp', n: 0, taille: () => 1 });
  ok(isDeepStrictEqual(vide.a.publications, vide.r.publications) && isDeepStrictEqual(vide.a.corps.projection(), vide.r.corps.projection()), 'aucun candidat : mêmes instantanés');
}

export function testClassementAuFilTravail() {
  titre('Classeur — ce qui reste à faire au scellé quand tout est préparé au fil des blocs');
  const hasard = generateur(7);
  const { f, candidats } = population('degats_reels', 9000, hasard);
  const n = candidats.length, blocs = decouper(candidats, () => 1 + Math.floor(hasard() * 4096));
  for (const auFil of [false, true]) {
    const p = proprietaire();
    p.corps.ouvrir(f.photo, 1, f.vue, 1);
    blocs.forEach((b, k) => {
      p.corps.ajouter(1, k, copier(b)); p.corps.activer(1);
      while (p.corps.travailEnCours) p.corps.avancer();
      p.corps.pomper(k);
      if (auFil) while (p.corps.avancerAuFil()) { /* rattraper */ }
    });
    while (p.corps.travailEnCours) p.corps.avancer();
    ok(p.corps.travailAuFil === !auFil, auFil ? 'au fil : tout le reçu est préparé avant le scellé' : 'sans travail au fil : le reçu attend sa préparation');
    const avant = { ...p.corps.travail };
    p.corps.sceller(1, n, blocs.length - 1, BILAN);
    ok(!p.corps.travailAuFil && !p.corps.avancerAuFil(), 'scellé : plus aucun travail au fil');
    while (p.corps.travailEnCours) p.corps.avancer();
    const index = (p.corps as unknown as { index: { travail: { notes: number; reprises: number; controlees: number }; magasin: { longueur: number; etat(i: number): number } } }).index;
    let resolues = 0;
    for (let i = 0; i < index.magasin.longueur; i++) if (index.magasin.etat(i) !== 0) resolues++;
    const notesApres = p.corps.travail.notes - avant.notes, comparaisonsApres = p.corps.travail.comparaisons - avant.comparaisons;
    if (auFil) {
      egal(notesApres, 0, 'au fil : aucune note de base calculée après le scellé');
      ok(comparaisonsApres < 2 * n, `au fil : seules les dernières fusions restent (${comparaisonsApres} comparaisons, moins de 2 N = ${2 * n})`);
    } else {
      egal(notesApres, n, 'sans travail au fil : les N notes de base se calculent au scellé');
      ok(comparaisonsApres > 10 * n, `sans travail au fil : le tri entier se fait au scellé (${comparaisonsApres} comparaisons)`);
    }
    ok(resolues > 0 && index.travail.reprises === n - resolues && index.travail.notes <= resolues,
      `index : ${index.travail.reprises} lignes non résolues reprises sans recalcul, ${index.travail.notes} notes calculées pour ${resolues} résolues`);
  }
}
