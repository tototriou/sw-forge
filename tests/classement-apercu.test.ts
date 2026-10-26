// L'aperçu d'un geste de vue : la page d'un tri, d'un sens, d'une mesure ou
// de bornes part avant l'ordre complet. Oracle : le chemin de fin de tâche,
// le même corps sans tâche différée (chaque tâche drainée dans le geste),
// qui publie après l'ordre complet. Le classeur différé avance pas à pas,
// publie ce qu'il peut pendant sa tâche, et doit rendre exactement les mêmes
// instantanés, puis le même ordre complet, sans jamais publier une vue
// quittée.
import { isDeepStrictEqual } from 'node:util';
import type { InstantaneClassement, VueClassement } from '../src/lib/classementCompact';
import { COLONNES_RESULTATS, type ColonneResultat } from '../src/lib/colonnesResultats';
import { statTotal, type BuildCandidate } from '../src/lib/runeBuildOptim';
import type { BornesResultats } from '../src/lib/filtresResultats';
import type { StatKey } from '../src/lib/effects';
import { avecTotal, classeur, classeurFini, drainer, empreinteCache, generateur, ligne, ordreDeBaseDeReference, population, resoudre, tic,
  type Classeur, type Stats } from './classement-notes-de-base.test';
import { egal, ok, titre } from './outils';

/** L'instantané sans ses deux compteurs de cadence, qui suivent le nombre de publications et d'écritures. */
function sansCadence(p: InstantaneClassement) {
  const { revisionPubliee: _r, revisionDonnees: _d, ...versions } = p.versions;
  return { ...p, versions };
}

interface Bilan { gestes: number; apercus: number; replis: number; ecarts: string[] }

/**
 * Un geste sur l'oracle : la vue, puis sa publication sans pas de file
 * (`publier` forcé, aucune résolution entre les deux).
 */
function gesteOracle(r: Classeur, vue: VueClassement, id: number): InstantaneClassement {
  r.corps.changerVue(vue, id, id);
  if (r.corps.travailEnCours) throw new Error('Oracle avec une tâche différée');
  r.corps.publier(tic(), true);
  const p = r.publications[r.publications.length - 1].p;
  if (p.versions.idVue !== id) throw new Error('Oracle sans publication du geste');
  return p;
}

/**
 * Le même geste sur le classeur différé, pas à pas, pompe après chaque pas :
 * `interruption.faire` est appelé au pas donné, avant la fin de la tâche.
 */
function gesteDiffere(d: Classeur, vue: VueClassement, id: number, interruption?: { pas: number; faire: () => void }) {
  d.corps.changerVue(vue, id, id);
  for (let pas = 0; ;) {
    if (interruption && pas === interruption.pas) { interruption.faire(); interruption = undefined; }
    if (!d.corps.travailEnCours) {
      if (!interruption) break;
      // Le premier geste a fini avant le second : sa publication de fin de tâche, puis le second.
      d.corps.publier(tic(), true);
      interruption.faire(); interruption = undefined;
      continue;
    }
    d.corps.avancer(); pas++;
    // Sans pomper après le dernier pas : la pompe d'après la tâche ferait un pas de file.
    if (d.corps.travailEnCours) d.corps.pomper(tic());
  }
  // Fin de tâche : la publication de l'ordre complet, sans pas de file.
  d.corps.publier(tic(), true);
}

/** `coupure` : rang de la première publication après le second geste ; aucune vue plus ancienne ne part ensuite. */
function comparerPublications(d: Classeur, depuis: number, attendues: Map<number, InstantaneClassement>, bilan: Bilan, ou: string,
  idCourant: number, coupure: number) {
  for (const [k, { p, pendantLaTache }] of d.publications.entries()) {
    if (k < depuis) continue;
    const attendue = attendues.get(p.versions.idVue);
    if (pendantLaTache) bilan.apercus++;
    if (!attendue) { bilan.ecarts.push(`${ou} : publication d'une vue ${p.versions.idVue} sans oracle`); continue; }
    if (k >= coupure && p.versions.idVue !== idCourant) bilan.ecarts.push(`${ou} : vue ${p.versions.idVue} publiée après la vue ${idCourant}`);
    if (!isDeepStrictEqual(sansCadence(p), sansCadence(attendue))) {
      bilan.ecarts.push(`${ou} : vue ${p.versions.idVue}${pendantLaTache ? ' (aperçu)' : ''}\n  reçu   ${JSON.stringify({ c: p.page.cartes.map((x) => x.ordinal), pl: p.page.placesEnAttente, a: p.enAttente, f: p.filtre.comptes })}`
        + `\n  attendu ${JSON.stringify({ c: attendue.page.cartes.map((x) => x.ordinal), pl: attendue.page.placesEnAttente, a: attendue.enAttente, f: attendue.filtre.comptes })}`);
    }
  }
}

/** Des bornes tirées sur les valeurs de la population : une ou deux colonnes de stat, min et/ou max, parfois Dégâts réels. */
function bornesAuHasard(hasard: () => number, candidats: readonly BuildCandidate[]): BornesResultats {
  const bornes: BornesResultats = {};
  for (let k = 0, n = 1 + Math.floor(hasard() * 2); k < n; k++) {
    const colonne = COLONNES_RESULTATS[Math.floor(hasard() * 8)] as StatKey;
    const v = () => statTotal(candidats[Math.floor(hasard() * candidats.length)].stats, colonne);
    bornes[colonne] = { min: hasard() < 0.8 ? v() : null, max: hasard() < 0.3 ? v() : null };
  }
  if (hasard() < 0.15) bornes.degats_reels = { min: 1, max: null };
  return bornes;
}

function vueAuHasard(hasard: () => number, vue: VueClassement, candidats: readonly BuildCandidate[]): VueClassement {
  const x = hasard();
  if (x < 0.35) return { ...vue, tri: COLONNES_RESULTATS[Math.floor(hasard() * COLONNES_RESULTATS.length)] as ColonneResultat, page: 1 };
  if (x < 0.5) return { ...vue, sens: vue.sens === 'asc' ? 'desc' : 'asc', page: 1 };
  if (x < 0.6) return { ...vue, metric: vue.metric === 'eff' ? 'score' : 'eff', page: 1 };
  if (x < 0.8) return { ...vue, bornes: hasard() < 0.2 ? {} : bornesAuHasard(hasard, candidats), page: 1 };
  if (x < 0.93) return { ...vue, page: 1 + Math.floor(hasard() * 3) };
  return { ...vue, colonnesCompletes: !vue.colonnesCompletes };
}

/**
 * Le scénario : file menée `avant` pas de résolution, puis des gestes tirés,
 * dont certains interrompus par un second geste avant la fin de leur tâche ;
 * `entre` pas de résolution après chaque geste, sur les deux classeurs.
 */
function scenario(nom: string, graine: number, e: Parameters<typeof population>[0] & { avant: number; entre: number; gestes: number }): Bilan {
  const { photo, candidats, vue: vue0 } = population(e);
  const r = classeur(photo, candidats, vue0, false), d = classeur(photo, candidats, vue0, true);
  resoudre(r, e.avant); resoudre(d, e.avant);
  const bilan: Bilan = { gestes: 0, apercus: 0, replis: 0, ecarts: [] };
  if (empreinteCache(r) !== empreinteCache(d)) throw new Error(`ARRÊT ${nom} : les deux files n'ont pas résolu les mêmes builds, banc invalide`);
  const hasard = generateur(graine);
  const attendues = new Map<number, InstantaneClassement>();
  let vue = vue0, id = 1;
  for (let g = 0; g < e.gestes; g++) {
    // Du temps mort, parfois interrompu en cours de note : seul le classeur différé prépare des objectifs à l'avance.
    // Le temps mort attend la file au repos, que seule une pompe constate : la même pompe sur les deux
    // classeurs (elle peut faire un pas de file), puis le temps mort du seul classeur différé.
    if (hasard() < 0.5) {
      r.corps.pomper(tic()); drainer(d); d.corps.pomper(tic());
      for (let k = 0, n = Math.floor(hasard() * 1500); k < n && d.corps.avancerAuRepos(); k++) { /* temps mort */ }
      drainer(d);
    }
    const depuis = d.publications.length;
    const v1 = vueAuHasard(hasard, vue, candidats), id1 = ++id;
    attendues.set(id1, gesteOracle(r, v1, id1)); bilan.gestes++;
    let courant = id1, coupure = Infinity;
    if (hasard() < 0.35) {
      // Un second geste avant la fin du premier : la vue quittée ne doit plus jamais partir.
      const v2 = vueAuHasard(hasard, v1, candidats), id2 = ++id;
      attendues.set(id2, gesteOracle(r, v2, id2)); bilan.gestes++;
      gesteDiffere(d, v1, id1, { pas: Math.floor(hasard() * 3000), faire: () => {
        coupure = d.publications.length; d.corps.changerVue(v2, id2, id2); courant = id2;
      } });
      vue = v2;
    } else { gesteDiffere(d, v1, id1); vue = v1; }
    const apercusAvant = bilan.apercus;
    comparerPublications(d, depuis, attendues, bilan, `${nom}, geste ${g}`, courant, coupure);
    if (bilan.apercus === apercusAvant) bilan.replis++;
    resoudre(r, e.entre);
    // Une actualisation après une écriture du cache n'a jamais d'aperçu à publier.
    if (resoudre(d, e.entre)) bilan.ecarts.push(`${nom}, geste ${g} : publication pendant une actualisation de la file (aperçu périmé)`);
    if (empreinteCache(r) !== empreinteCache(d)) throw new Error(`ARRÊT ${nom} : files divergentes après le geste ${g}, banc invalide`);
    // L'ordre complet, une fois tout fini : la projection objet entière, et
    // l'ordre de base contre une référence indépendante (notes gardées, sens opposé, colonnes lues).
    if (g % 5 === 4 || g === e.gestes - 1) {
      const pr = r.corps.projection(), pd = d.corps.projection();
      if (!isDeepStrictEqual(pr.affichees.map(ligne), pd.affichees.map(ligne)) || !isDeepStrictEqual(pr.base.map(ligne), pd.base.map(ligne))) {
        bilan.ecarts.push(`${nom}, geste ${g} : ordre complet différent`);
      }
      const reference = ordreDeBaseDeReference(candidats, photo, vue);
      if (!isDeepStrictEqual(pd.base.map(ligne), reference) || !isDeepStrictEqual(pr.base.map(ligne), reference)) bilan.ecarts.push(`${nom}, geste ${g} : ordre de base ≠ référence`);
    }
  }
  return bilan;
}

function verifierScenario(nom: string, b: Bilan, apercusMin: number) {
  if (b.ecarts.length) throw new Error(`ARRÊT ${nom} : ${b.ecarts.length} écart(s) contre la fin de tâche\n${b.ecarts.slice(0, 3).join('\n')}`);
  ok(b.apercus >= apercusMin, `${nom} : ${b.gestes} gestes, ${b.apercus} aperçus publiés pendant la tâche, ${b.replis} gestes sans aperçu — instantanés et ordre complet identiques à la fin de tâche`);
}

export function testClassementApercuDifferentiel() {
  titre('Aperçu d’un geste de vue — différentiel contre la publication de fin de tâche (file, doublons, ex æquo, bornes, gestes interrompus)');
  verifierScenario('file finie, K = 300', scenario('file finie', 3401, { nombre: 380, avecFile: true, avant: Infinity, entre: Infinity, gestes: 40 }), 15);
  verifierScenario('file en cours', scenario('file en cours', 3402, { nombre: 380, avecFile: true, avant: 40, entre: 3, gestes: 30 }), 10);
  verifierScenario('file non commencée', scenario('file vide', 3403, { nombre: 120, avecFile: true, avant: 0, entre: 0, gestes: 20 }), 6);
  verifierScenario('sans file', scenario('sans file', 3404, { nombre: 200, avecFile: false, avant: Infinity, entre: 0, gestes: 30 }), 10);
  // Sans pas de file entre les gestes : en vérification exhaustive, la cadence différée change l'ordre des envois.
  verifierScenario('vérification exhaustive', scenario('exhaustive', 3405, { nombre: 90, avecFile: true, toutVerifier: true, avant: 30, entre: 0, gestes: 20 }), 6);
}

export function testClassementApercuNonFinis() {
  titre('Aperçu d’un geste de vue — NaN, ±∞ et −0 : repli sur la fin de tâche quand l’équivalence n’est pas établie, même résultat');
  const special = (stats: Stats, i: number): Stats => i % 37 === 5 ? avecTotal(stats, 'atk', Number.NaN)
    : i % 41 === 9 ? avecTotal(stats, 'spd', Infinity) : i % 43 === 13 ? avecTotal(stats, 'cr', -Infinity) : i % 29 === 2 ? avecTotal(stats, 'acc', -0) : stats;
  for (const [nom, e] of [
    ['non-finis, file finie', { nombre: 300, avecFile: true, special, avant: Infinity, entre: Infinity, gestes: 30 }],
    ['non-finis, file en cours', { nombre: 300, avecFile: true, special, avant: 25, entre: 2, gestes: 25 }],
    ['non-finis, sans file', { nombre: 200, avecFile: false, special, avant: Infinity, entre: 0, gestes: 25 }],
  ] as const) {
    const b = scenario(nom, 3410 + nom.length, e);
    verifierScenario(nom, b, 3);
    ok(b.replis > 0, `${nom} : des gestes sans aperçu (note non finie sous le tri), publiés en fin de tâche comme avant`);
  }
}

export function testClassementApercuSecondGeste() {
  titre('Aperçu d’un geste de vue — second geste pendant le fond du premier : aucune réponse périmée, la page du second part avant sa propre fin');
  const { d, vue } = classeurFini(300);
  const depuis = d.publications.length;
  d.corps.changerVue({ ...vue, tri: 'hp' }, 2, 2);
  // Jusqu'à l'aperçu du premier geste, sans finir sa tâche.
  while (d.corps.travailEnCours && d.publications.length === depuis) { d.corps.avancer(); d.corps.pomper(tic()); }
  ok(d.corps.travailEnCours && d.publications.length === depuis + 1 && d.publications[depuis].p.versions.idVue === 2,
    'le tri PV est publié pendant sa tâche (aperçu), l’ordre complet reste à faire');
  d.corps.changerVue({ ...vue, tri: 'spd', sens: 'asc' }, 3, 3);
  let apercuDuSecond = false;
  while (d.corps.travailEnCours) { d.corps.avancer(); if (d.corps.travailEnCours) { d.corps.pomper(tic()); apercuDuSecond ||= d.publications.length > depuis + 1; } }
  d.corps.publier(tic(), true);
  const apres = d.publications.slice(depuis + 1);
  ok(apercuDuSecond && apres.length >= 2 && apres.every(({ p }) => p.versions.idVue === 3),
    'après le second geste, seules ses publications partent : son aperçu pendant la tâche, puis la fin de tâche');
  egal(sansCadence(apres[0].p), sansCadence(apres[apres.length - 1].p), 'l’aperçu du second geste est sa publication de fin de tâche');
  // Une page demandée pendant le fond d'un tri : servie par l'aperçu quand elle ne demande aucune non vérifiée.
  const avant = d.publications.length;
  d.corps.changerVue({ ...vue, tri: 'cd' }, 4, 4);
  while (d.corps.travailEnCours && d.publications.length === avant) { d.corps.avancer(); d.corps.pomper(tic()); }
  d.corps.changerVue({ ...vue, tri: 'cd', page: 3 }, 5, 5); d.corps.pomper(tic());
  const page3 = d.publications[d.publications.length - 1];
  ok(page3.pendantLaTache && page3.p.versions.idVue === 5 && page3.p.page.premierRang === 41, 'la page 3 part pendant la tâche du tri, depuis son aperçu');
  drainer(d); d.corps.publier(tic(), true);
  egal(sansCadence(d.publications[d.publications.length - 1].p), sansCadence(page3.p), 'la page 3 de fin de tâche est celle de l’aperçu');
}

export function testClassementApercuPagePrioritaire() {
  titre('Aperçu d’un geste de vue — une page qui attend des non vérifiées pendant le fond d’un tri attend la fin de la tâche');
  const { photo, candidats, vue } = population({ nombre: 600, avecFile: true });
  const r = classeur(photo, candidats, vue, false), d = classeur(photo, candidats, vue, true);
  resoudre(r, 30); resoudre(d, 30);
  if (empreinteCache(r) !== empreinteCache(d)) throw new Error('ARRÊT : les deux files n’ont pas résolu les mêmes builds, banc invalide');
  const tri: VueClassement = { ...vue, tri: 'spd', sens: 'asc' }, page: VueClassement = { ...tri, page: 4 };
  gesteOracle(r, tri, 2);
  const attendue = gesteOracle(r, page, 3);
  const depuis = d.publications.length;
  d.corps.changerVue(tri, 2, 2);
  while (d.corps.travailEnCours && d.publications.length === depuis) { d.corps.avancer(); d.corps.pomper(tic()); }
  ok(d.corps.travailEnCours && d.publications.length === depuis + 1, 'le tri VIT croissant publie son aperçu, l’ordre complet reste à faire');
  d.corps.changerVue(page, 3, 3);
  while (d.corps.travailEnCours) { d.corps.avancer(); if (d.corps.travailEnCours) d.corps.pomper(tic()); }
  const pendant = d.publications.slice(depuis + 1).filter((x) => x.pendantLaTache).length;
  ok(attendue.page.placesEnAttente > 0 && attendue.enAttente > 0, `la page 4 attend ${attendue.page.placesEnAttente} non vérifiées, que la page fait passer devant le fond`);
  egal(pendant, 0, 'aucune publication de la page 4 pendant la tâche : l’aperçu ne connaît pas l’ordre des non vérifiées');
  d.corps.publier(tic(), true);
  egal(sansCadence(d.publications[d.publications.length - 1].p), sansCadence(attendue), 'la page 4 de fin de tâche est celle du chemin sans tâche différée');
}

export function testClassementApercuTravail() {
  titre('Aperçu d’un geste de vue — compte de travail : avant la page, les seules confirmées, jamais l’ordre complet');
  // Plus de builds que K = 300 : les confirmées sont une petite part de la population.
  const { d, vue, candidats } = classeurFini(1200);
  const depuis = d.publications.length;
  const index = (d.corps as unknown as { index: { travail: { comparaisons: number } } }).index;
  const comparaisons = () => index.travail.comparaisons + d.corps.travail.comparaisons;
  const avant = comparaisons(), avantBase = d.corps.travail.comparaisons, lectures = { n: 0 };
  const magasin = (index as unknown as { magasin: { candidat: (...a: unknown[]) => BuildCandidate } }).magasin, lire = magasin.candidat;
  magasin.candidat = (...a: unknown[]) => { lectures.n++; return lire.apply(magasin, a); };
  try {
    d.corps.changerVue({ ...vue, tri: 'atk' }, 2, 2);
    while (d.corps.travailEnCours && d.publications.length === depuis) { d.corps.avancer(); d.corps.pomper(tic()); }
    const avantLaPage = comparaisons() - avant, lecturesAvantLaPage = lectures.n;
    ok(d.publications.length === depuis + 1 && d.corps.travailEnCours, 'tri ATQ : la page part pendant la tâche');
    drainer(d);
    // L'index repart de zéro à l'actualisation : ses comparaisons sont alors celles de l'arbre, plus le tri de base.
    const total = index.travail.comparaisons + d.corps.travail.comparaisons - avantBase;
    ok(avantLaPage < 4000 && total > 5 * avantLaPage,
      `tri ATQ : ${avantLaPage} comparaisons avant la page (les 300 confirmées), ${total} pour l’ordre complet ensuite`);
    ok(lecturesAvantLaPage <= 320, `tri ATQ : ${lecturesAvantLaPage} candidats lus avant la page (confirmées et cartes), aucun pour les ${candidats.length} notes de base`);
  } finally { magasin.candidat = lire; }
}
