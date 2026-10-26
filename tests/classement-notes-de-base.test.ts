// Les notes et l'ordre de base d'un critère, gardés par population : un tri
// ne recalcule jamais l'ordre du fond (objectif lancé), ni un critère déjà
// noté, ni le sens opposé ; une stat se note dans sa colonne ; à cache
// inchangé, un changement de critère ne réingère rien. Compte de travail sur
// le vrai corps du classeur, pas un chrono. Le banc sert aussi l'aperçu
// (classement-apercu.test.ts).
import { CorpsClassement, type InstantaneClassement, type VueClassement } from '../src/lib/classementCompact';
import { CandidatsCompacts, ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { contexteResultat, type ContexteResultat } from '../src/lib/contexteResultat';
import { statTotal, type BuildCandidate } from '../src/lib/runeBuildOptim';
import type { StatKey } from '../src/lib/effects';
import { fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';

const BILAN = { explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null };

export function generateur(graine: number) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

export type Stats = BuildCandidate['stats'];
export const avecTotal = (stats: Stats, cle: StatKey, total: number): Stats => stats.map((s) => s.key === cle ? { ...s, total, bonus: total - s.base } : s);

/**
 * Le corpus de combat répété (ex æquo sur chaque colonne, vraie paire,
 * exclusive et relique), des doublons aux stats collectées différentes (ils
 * partagent l'équipement, jamais la ligne), et des stats spéciales au choix.
 */
export function population(e: { nombre: number; avecFile: boolean; toutVerifier?: boolean; special?: (stats: Stats, i: number) => Stats }) {
  const f = fixtureClassementCombat('degats_reels', e.toutVerifier ?? false);
  const uniques: BuildCandidate[] = Array.from({ length: e.nombre }, (_, i) => {
    const c = { ...f.candidats[i % 32], runeIds: Array.from({ length: 6 }, (_, s) => 30000 + i * 6 + s), effTotal: (i * 7) % 23 };
    return e.special ? { ...c, stats: e.special(c.stats, i) } : c;
  });
  const runeById = new Map(f.params.pool.map((r) => [r.id, r]));
  const pool = uniques.flatMap((c, i) => f.candidats[i % 32].runeIds.map((id, slot) => ({ ...runeById.get(id)!, id: c.runeIds[slot] })));
  const candidats = [...uniques];
  // Un doublon tous les 17 : mêmes runes dans un autre ordre, PV collectés plus hauts d'un point sur deux.
  for (let i = 3; i < e.nombre; i += 17) {
    const c = uniques[i], hp = statTotal(c.stats, 'hp');
    candidats.splice(i + 5, 0, { ...c, runeIds: [...c.runeIds].reverse(), stats: i % 2 ? avecTotal(c.stats, 'hp', hp + 1) : c.stats });
  }
  const photo = contexteResultat({ ...f.photo, params: { ...f.params, pool }, toutVerifier: e.toutVerifier ?? false,
    ...(e.avecFile ? {} : { resolution: null }) });
  const vue: VueClassement = { tri: 'degats_reels', metric: 'eff', page: 1 };
  return { photo, candidats, vue };
}

export interface Classeur { corps: CorpsClassement; publications: { p: InstantaneClassement; pendantLaTache: boolean }[] }

/** Le vrai corps, résolution directe ; `differe` : ses tâches avancent pas à pas, comme dans le Worker. */
export function classeur(photo: ContexteResultat, candidats: readonly BuildCandidate[], vue: VueClassement, differe: boolean): Classeur {
  const publications: Classeur['publications'] = [];
  const corps: CorpsClassement = new CorpsClassement({ publier: (p) => publications.push({ p, pendantLaTache: corps.travailEnCours }),
    resoudre: () => { throw new Error('Résolution distante sur le banc'); }, incident: (r) => { throw new Error(r); } }, differe, 'directe');
  corps.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, candidats.length, lots.length - 1, BILAN);
  return { corps, publications };
}

let horloge = 0;
/** L'horloge virtuelle du banc, avancée de `pas` ms. */
export const tic = (pas = 1) => (horloge += pas);
/**
 * Les tâches avancent pas à pas, une pompe après chaque pas sauf le dernier :
 * pendant une tâche, la pompe ne fait aucun pas de file.
 */
export const drainer = (c: Classeur) => {
  while (c.corps.travailEnCours) { c.corps.avancer(); if (c.corps.travailEnCours) c.corps.pomper(tic()); }
};
/**
 * La file avance de `tours` pas de résolution (Infinity : jusqu'au point
 * fixe). Rend le nombre de publications parties pendant une tâche.
 */
export function resoudre(c: Classeur, tours: number): number {
  const depuis = c.publications.length;
  for (let k = 0; k < tours && k < 100000; k++) {
    drainer(c); c.corps.pomper(tic(400));
    if (!c.corps.travailEnRepli && !c.corps.travailEnCours) break;
  }
  drainer(c);
  return c.publications.slice(depuis).filter((x) => x.pendantLaTache).length;
}
const cacheDe = (c: Classeur) => (c.corps as unknown as { cache: Map<string, { conforme: boolean }> }).cache;
export const empreinteCache = (c: Classeur) => [...cacheDe(c).entries()].map(([k, r]) => `${k}:${r.conforme}`).sort().join('|');

/** Le classeur différé au scellé de la population, file finie. */
export function classeurFini(nombre: number) {
  const { photo, candidats, vue } = population({ nombre, avecFile: true });
  const d = classeur(photo, candidats, vue, true);
  resoudre(d, Infinity);
  return { d, vue, candidats };
}

export function testClassementNotesDeBaseGardees() {
  titre('Classeur — notes de base gardées : l’objectif lancé n’est jamais renoté, un critère déjà noté non plus, une stat se lit dans sa colonne');
  // Plus de builds que K = 300 : les confirmées sont une petite part de la population.
  const { d, vue, candidats } = classeurFini(1200);
  const n = candidats.length;
  const lectures = { candidats: 0, ingestions: 0 };
  const lire = CandidatsCompacts.prototype.candidat, ingerer = CandidatsCompacts.prototype.ingerer;
  CandidatsCompacts.prototype.candidat = function (this: CandidatsCompacts, ...a: Parameters<typeof lire>) { lectures.candidats++; return lire.apply(this, a); };
  CandidatsCompacts.prototype.ingerer = function (this: CandidatsCompacts, ...a: Parameters<typeof ingerer>) { lectures.ingestions++; return ingerer.apply(this, a); };
  try {
    const geste = (v: VueClassement, id: number) => {
      const avant = { notes: d.corps.travail.notes, ...lectures };
      d.corps.changerVue(v, id, id); drainer(d);
      return { notes: d.corps.travail.notes - avant.notes, candidats: lectures.candidats - avant.candidats, ingestions: lectures.ingestions - avant.ingestions };
    };
    const quitter = geste({ ...vue, tri: 'hp' }, 2);
    egal(quitter.notes, n, 'quitter l’objectif lancé : N notes du nouveau critère, l’ordre du fond n’est pas recalculé');
    // Les 300 confirmées sont notées par l'aperçu de la page, puis par l'index ; vingt cartes publiées.
    ok(quitter.candidats <= 700 && quitter.ingestions === 0,
      `tri PV : ${quitter.candidats} candidats lus (les confirmées renotées), aucun pour les ${n} notes de base ; ${quitter.ingestions} ingestion à cache inchangé`);
    egal(geste({ ...vue }, 3).notes, 0, 'revenir à l’objectif lancé : aucune note');
    egal(geste({ ...vue, tri: 'hp' }, 4).notes, 0, 'revenir à un critère déjà noté : aucune note');
    egal(geste({ ...vue, tri: 'hp', sens: 'asc' }, 5).notes, 0, 'inverser le sens : les notes opposées, aucune note');
    egal(geste({ ...vue, tri: 'ehp' }, 6).notes, n, 'un objectif jamais trié : N notes');
    // Cinq critères quittés de plus : le plus ancien quitté s'oublie, l'objectif lancé jamais.
    for (const [k, tri] of (['atk', 'def', 'spd', 'cr', 'cd'] as const).entries()) geste({ ...vue, tri }, 7 + k);
    egal(geste({ ...vue, tri: 'hp', sens: 'asc' }, 12).notes, n, 'au-delà de quatre critères quittés, le plus ancien se renote');
    egal(geste({ ...vue }, 13).notes, 0, 'l’objectif lancé reste gardé');
  } finally {
    CandidatsCompacts.prototype.candidat = lire; CandidatsCompacts.prototype.ingerer = ingerer;
  }
}

export function testClassementNotesAuRepos() {
  titre('Classeur — temps mort : les objectifs jamais triés se notent à l’avance, après le scellé seulement, et leur tri ne renote rien');
  const { photo, candidats, vue } = population({ nombre: 600, avecFile: true });
  const n = candidats.length;
  // Pendant la recherche : le travail au fil seul, jamais le temps mort.
  const enCours = new CorpsClassement({ publier: () => {}, resoudre: () => { throw new Error('Résolution distante'); }, incident: (r) => { throw new Error(r); } }, true, 'directe');
  enCours.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  extraireBlocs(colonnes).forEach((b, i) => enCours.ajouter(1, i, b));
  enCours.activer(1); while (enCours.travailEnCours) enCours.avancer();
  ok(!enCours.travailAuRepos && !enCours.avancerAuRepos(), 'recherche non scellée : aucun temps mort');
  const d = classeur(photo, candidats, vue, true);
  resoudre(d, Infinity);
  ok(d.corps.travailAuRepos, 'scellé, file finie : des objectifs restent à noter en temps mort');
  const notesAvant = d.corps.travail.notes;
  let pas = 0;
  while (d.corps.avancerAuRepos()) pas++;
  egal(d.corps.travail.notes - notesAvant, 2 * n, `temps mort : PV effectifs et Efficience notés (${pas} pas), Dégâts réels déjà noté comme objectif lancé`);
  ok(!d.corps.travailAuRepos && !d.corps.avancerAuRepos(), 'plus rien à préparer');
  const geste = (v: VueClassement, id: number) => {
    const avant = d.corps.travail.notes;
    d.corps.changerVue(v, id, id); drainer(d);
    return d.corps.travail.notes - avant;
  };
  egal(geste({ ...vue, tri: 'ehp' }, 2), 0, 'tri PV effectifs après le temps mort : aucune note');
  egal(geste({ ...vue, tri: 'efficience' }, 3), 0, 'tri Efficience après le temps mort : aucune note');
  egal(geste({ ...vue, tri: 'efficience', metric: 'score' }, 4), n, 'une autre mesure : sa propre note (la clé d’un critère porte la mesure)');
  ok(d.corps.travailAuRepos, 'sous la nouvelle mesure, les autres objectifs sont à préparer de nouveau');
}
