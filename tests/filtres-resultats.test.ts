import { isDeepStrictEqual } from 'node:util';
import { ClassementCompact, CorpsClassement, TAILLE_PAGE_CLASSEMENT, type InstantaneClassement, type PublicationClassement, type VueClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { contexteResultat, optionsDuContexte, type ContexteResultat } from '../src/lib/contexteResultat';
import { CacheResolutionJournalise, cleBuild, journalResolution, type ResultatArtefacts } from '../src/lib/artifactQueue';
import { candidateMetricTotal, scoreDuCandidat, statTotal, type BuildCandidate } from '../src/lib/runeBuildOptim';
import { COLONNES_RESULTATS, type ColonneResultat } from '../src/lib/colonnesResultats';
import { CATEGORIE_LIGNE, COLONNES_IMMUABLES, categorieDeLaLigne, etatDesBornes, filtreDesLignes, type BornesResultats } from '../src/lib/filtresResultats';
import { chiffresMesureRune, moyenneParRune } from '../src/lib/valeursAffichees';
import { formatRuneMetric } from '../src/hooks/useRuneMetric';
import { computeStats } from '../src/lib/stats';
import type { StatKey } from '../src/lib/effects';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';

function generateur(graine: number) {
  let s = graine >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

/**
 * Plus de builds que K (300 en relique « recherche ») : après le point fixe,
 * une partie reste non vérifiée. Vrai corps du classeur, vraie résolution.
 */
function banc(nombre = 420, e: { avecFile?: boolean; sansSort?: boolean } = {}) {
  const f = fixtureClassementCombat('degats_reels', false);
  const candidats: BuildCandidate[] = Array.from({ length: nombre }, (_, i) => ({ ...f.candidats[i % 32],
    runeIds: Array.from({ length: 6 }, (_, s) => 20000 + i * 6 + s), effTotal: nombre - i }));
  const runeById = new Map(f.params.pool.map((r) => [r.id, r]));
  const pool = candidats.flatMap((c, i) => f.candidats[i % 32].runeIds.map((id, slot) => ({ ...runeById.get(id)!, id: c.runeIds[slot] })));
  const photo = contexteResultat({ ...f.photo, params: { ...f.params, pool }, toutVerifier: false,
    ...(e.avecFile === false ? { resolution: null } : {}), ...(e.sansSort ? { realDamage: null } : {}) });
  const vue: VueClassement = { tri: 'degats_reels', metric: 'eff', page: 1 };
  const resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  let demandes = 0;
  const publications: InstantaneClassement[] = [];
  const corps = new CorpsClassement({ publier: (p) => { publications.push(p); },
    resoudre: (m) => { if (m.type === 'resoudre') demandes++; reponses.push(...resolution.recevoir(m)); }, incident: () => {} });
  corps.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, candidats.length, lots.length - 1, null);
  let t = 0, idVue = 1;
  /** `pas` : nombre de réponses du résolveur au plus (Infinity = jusqu'au point fixe). */
  const pomper = (pas = Infinity) => {
    corps.pomper(t);
    for (let k = 0; k < pas && k < 20000; k++) {
      const r = reponses.shift() ?? resolution.etape();
      if (!r) break;
      corps.recevoirResolution(r, ++t); corps.pomper(t);
    }
    corps.pomper(t += 400); corps.publier(t, true);
  };
  const changer = (v: Partial<VueClassement>, pas = 0) => {
    Object.assign(vue, v); corps.changerVue({ ...vue }, ++idVue, idVue); pomper(pas);
    return publications[publications.length - 1];
  };
  return { corps, photo, candidats, vue, pomper, changer, publications, demandes: () => demandes,
    cache: () => (corps as unknown as { cache: Map<string, ResultatArtefacts> }).cache };
}

/** Ce que la carte écrit, recalculé ici par la carte même : `formatRuneMetric` pour la mesure, l'entier pour les objectifs. */
function valeurDeLaCarte(colonne: ColonneResultat, c: BuildCandidate, photo: ContexteResultat, parBuild: ReadonlyMap<string, ResultatArtefacts>): number {
  const options = optionsDuContexte(photo, parBuild, 'eff');
  if (colonne === 'efficience') return Number(formatRuneMetric(candidateMetricTotal(c, options.runeById!, 'eff') / 6, 'eff').replace('%', ''));
  if (colonne === 'ehp' || colonne === 'degats_reels') return Math.round(scoreDuCandidat(c, colonne, options)!);
  return statTotal(c.stats, colonne);
}
function tient(v: number, b: { min: number | null; max: number | null }) { return (b.min === null || v >= b.min) && (b.max === null || v <= b.max); }
const confirme = (p: PublicationClassement, c: BuildCandidate) => p.parBuild.get(cleBuild(c))?.conforme === true;
const ids = (cs: readonly BuildCandidate[]) => cs.map((c) => c.runeIds.join());

/** Les cartes de toutes les pages, en naviguant… sans naviguer : la projection de la vue, confirmées seules. */
function cartesDeLaVue(p: PublicationClassement) { return p.affichees.filter((c) => confirme(p, c)); }

export function testFiltresResultatsBornes() {
  titre('Filtres d’affichage — bornes inclusives par colonne, ET, contradiction, colonne indisponible, arrondi de la carte');
  const b = banc();
  b.pomper();
  const p0 = b.corps.projection(), confirmes = cartesDeLaVue(p0);
  ok(confirmes.length === 300 && p0.affichees.length > 300, `point fixe : 300 confirmées et ${p0.affichees.length - 300} non vérifiées`);

  // Inclusive, sur la valeur exacte d'une carte.
  const atq = confirmes.map((c) => statTotal(c.stats, 'atk')).sort((x, y) => x - y), v = atq[Math.floor(atq.length / 2)];
  let i = b.changer({ bornes: { atk: { min: v, max: null } } });
  let p = b.corps.projection();
  ok(cartesDeLaVue(p).every((c) => statTotal(c.stats, 'atk') >= v) && cartesDeLaVue(p).some((c) => statTotal(c.stats, 'atk') === v), `ATQ ≥ ${v} : toutes les cartes tiennent la borne, la valeur égale comprise`);
  egal(i.page.cartes.map((c) => c.candidat.runeIds.join()), ids(cartesDeLaVue(p).slice(0, TAILLE_PAGE_CLASSEMENT)), 'la page 1 : les premières confirmées de la vue');
  i = b.changer({ bornes: { atk: { min: v + 1, max: null } } });
  ok(cartesDeLaVue(b.corps.projection()).every((c) => statTotal(c.stats, 'atk') > v), `ATQ ≥ ${v + 1} : la carte à ${v} sort de la vue`);
  egal(i.filtre.bornes, { actives: ['atk'], inactives: [], contradictoires: [] }, 'bornes publiées : ATQ active');

  // ET : deux colonnes.
  const vit = confirmes.map((c) => statTotal(c.stats, 'spd')).sort((x, y) => x - y)[Math.floor(confirmes.length / 3)];
  b.changer({ bornes: { atk: { min: v, max: null }, spd: { min: null, max: vit } } });
  p = b.corps.projection();
  egal(ids(cartesDeLaVue(p)), ids(confirmes.filter((c) => statTotal(c.stats, 'atk') >= v && statTotal(c.stats, 'spd') <= vit)), 'ATQ ≥ v ET VIT ≤ w : exactement les confirmées qui tiennent les deux, dans le même ordre');

  // Minimum au-dessus du maximum : vue vide signalée.
  i = b.changer({ bornes: { hp: { min: 20000, max: 10000 } } });
  egal([i.filtre.vide, i.page.cartes.length, i.page.placesEnAttente, i.filtre.comptes.visiblesConfirmes, i.filtre.comptes.potentielsNonVerifies, i.filtre.pages],
    ['bornes-contradictoires', 0, 0, 0, 0, 1], 'PV min > max : vue vide signalée, aucune carte, aucune place, une page');
  egal(i.filtre.bornes.contradictoires, ['hp'], 'la colonne contradictoire est nommée');

  // Une borne vide n'est pas une borne.
  i = b.changer({ bornes: { hp: { min: null, max: null } } });
  egal([i.filtre.bornes.actives, ids(b.corps.projection().affichees)], [[], ids(p0.affichees)], 'bornes vides : aucune borne, la vue entière');

  // Bornes mal formées : refusées, jamais ramenées en silence.
  let refus = 0;
  for (const bornes of [{ atk: { min: Number.NaN, max: null } }, { vitesse: { min: 1, max: null } }, { atk: { min: '5', max: null } }] as unknown as BornesResultats[]) {
    try { b.corps.changerVue({ ...b.vue, bornes }, 1000 + refus, 1000 + refus); } catch { refus++; }
  }
  egal(refus, 3, 'NaN, colonne inconnue, texte : vue refusée');

  // Dégâts réels sans sort calculable : borne inactive.
  const s = banc(60, { sansSort: true });
  s.pomper();
  const sansBorne = s.changer({ tri: 'atk', bornes: {} }), avant = s.corps.projection();
  const inactive = s.changer({ bornes: { degats_reels: { min: 1e12, max: null } } });
  egal(inactive.filtre.bornes, { actives: [], inactives: ['degats_reels'], contradictoires: [] }, 'Dégâts réels sans sort : borne inactive, listée');
  ok(isDeepStrictEqual(ids(s.corps.projection().affichees), ids(avant.affichees)) && isDeepStrictEqual(inactive.filtre.comptes, sansBorne.filtre.comptes),
    'borne inactive : rien n’est masqué, mêmes comptes');

  // L'arrondi de la carte : 78.76 s'écrit 78.8 et passe ≥ 78.8 ; la valeur brute ne passerait pas.
  egal(chiffresMesureRune(moyenneParRune(472.56), 'eff'), '78.8', 'une moyenne de 78,76 s’écrit « 78.8 »');
  const borne = etatDesBornes({ efficience: { min: 78.8, max: null } }, () => true);
  egal(categorieDeLaLigne(() => Number(chiffresMesureRune(78.76, 'eff')), true, borne), CATEGORIE_LIGNE.visible, '78,76 affiché 78.8 : passe ≥ 78.8');
  egal(categorieDeLaLigne(() => 78.76, true, borne), CATEGORIE_LIGNE.masquee, 'témoin : la valeur brute 78,76 serait masquée');
  // Sur les cartes : une efficience arrondie au-dessus de sa valeur brute.
  const options = optionsDuContexte(b.photo, p0.parBuild, 'eff');
  const arrondie = confirmes.find((c) => { const m = candidateMetricTotal(c, options.runeById!, 'eff') / 6; return valeurDeLaCarte('efficience', c, b.photo, p0.parBuild) > m; });
  ok(arrondie !== undefined, 'une carte dont l’efficience affichée est arrondie au-dessus');
  if (arrondie) {
    const affichee = valeurDeLaCarte('efficience', arrondie, b.photo, p0.parBuild);
    b.changer({ bornes: { efficience: { min: affichee, max: affichee } } });
    ok(ids(cartesDeLaVue(b.corps.projection())).includes(arrondie.runeIds.join()), `efficience bornée à ${affichee} (sa valeur affichée) : la carte reste`);
  }
}

export function testFiltresResultatsReversibles() {
  titre('Filtres d’affichage — relâcher rend les mêmes builds et équipements, sans aucune résolution');
  const b = banc();
  b.pomper();
  const p0 = b.corps.projection(), i0 = b.publications[b.publications.length - 1], demandes = b.demandes(), cache = new Map(b.cache());
  const hasard = generateur(42), confirmes = cartesDeLaVue(p0);
  for (let essai = 0; essai < 12; essai++) {
    const bornes: BornesResultats = {};
    for (const colonne of COLONNES_RESULTATS) if (hasard() < 0.25) {
      const valeurs = confirmes.map((c) => valeurDeLaCarte(colonne, c, b.photo, p0.parBuild));
      bornes[colonne] = { min: hasard() < 0.5 ? valeurs[Math.floor(hasard() * valeurs.length)] : null, max: hasard() < 0.5 ? valeurs[Math.floor(hasard() * valeurs.length)] : null };
    }
    b.changer({ bornes, page: 1 });
  }
  ok(b.demandes() === demandes && isDeepStrictEqual(new Map(b.cache()), cache),
    `12 jeux de bornes : aucune demande au résolveur (${b.demandes() - demandes} de plus), cache identique (${cache.size} équipements, ${b.cache().size} après)`);
  const relache = b.changer({ bornes: undefined, page: 1 });
  const p1 = b.corps.projection();
  ok(isDeepStrictEqual(p1.affichees, p0.affichees) && isDeepStrictEqual(p1.base, p0.base) && isDeepStrictEqual(p1.parBuild, p0.parBuild),
    'bornes relâchées : mêmes lignes, même ordre, mêmes stats et même équipement');
  ok(isDeepStrictEqual([relache.comptes, relache.page, relache.filtre], [i0.comptes, i0.page, i0.filtre]), 'bornes relâchées : même instantané (comptes, page, cartes et valeurs)');
  const large = b.changer({ bornes: { hp: { min: 0, max: 1e9 }, efficience: { min: -1, max: null } } });
  ok(isDeepStrictEqual(b.corps.projection().affichees, p0.affichees) && large.filtre.comptes.visiblesConfirmes === 300, 'bornes plus larges que la recherche : rien de plus, rien de moins');
  // Seule une page demandée en naviguant passe devant le fond ; poser des bornes n'en demande aucune.
  const priorite = () => (b.corps as unknown as { pagePrioritaire: boolean }).pagePrioritaire;
  b.changer({ bornes: undefined, page: 1 }); b.changer({ page: 2 });
  const apresNavigation = priorite();
  b.changer({ bornes: { atk: { min: 0, max: null } }, page: 2 });
  const apresBornes = priorite();
  b.changer({ page: 3 });
  egal([apresNavigation, apresBornes, priorite()], [true, false, true], 'priorité de page : la navigation la donne, les bornes la retirent, la navigation suivante la rend');
  // Pendant la file : des bornes posées puis relâchées ne perdent aucun build en cours de vérification.
  const c = banc();
  c.pomper(40);
  const tot = c.corps.projection();
  c.changer({ bornes: { atk: { min: 1e9, max: null } } }, 30);
  c.changer({ bornes: undefined }, 0);
  c.pomper();
  const fin = c.corps.projection(), reference = banc();
  reference.pomper(40); reference.pomper(30); reference.pomper();
  ok(tot.affichees.length > 0 && isDeepStrictEqual(ids(fin.affichees), ids(reference.corps.projection().affichees)) && isDeepStrictEqual(fin.parBuild, reference.corps.projection().parBuild),
    'bornes pendant la file puis relâchées : même classement et même équipement qu’une file sans borne');
}

export function testFiltresResultatsIndetermines() {
  titre('Filtres d’affichage — un build non vérifié n’est jamais jugé sur ses stats provisoires');
  const b = banc();
  b.pomper();
  const p0 = b.corps.projection();
  const nonVerifies = p0.affichees.filter((c) => !p0.parBuild.has(cleBuild(c)));
  ok(nonVerifies.length > 0, `${nonVerifies.length} builds non vérifiés au point fixe`);
  // Les colonnes immuables le sont : stats collectées et résolues égales.
  const collectes = new Map(b.candidats.map((c) => [cleBuild(c), c]));
  const resolus = [...p0.parBuild.entries()].filter(([, r]) => r.conforme);
  ok(resolus.every(([k, r]) => (['spd', 'cr', 'cd', 'res', 'acc'] as StatKey[]).every((s) => statTotal(r.stats, s) === statTotal(collectes.get(k)!.stats, s))),
    `colonnes immuables : VIT, Taux Crit, Dmg Crit, RES, Précision égales avant et après résolution (${resolus.length} builds)`);
  ok(resolus.some(([k, r]) => statTotal(r.stats, 'atk') !== statTotal(collectes.get(k)!.stats, 'atk')), 'témoin : l’ATQ, elle, change à la résolution');
  ok([...COLONNES_IMMUABLES].every((c) => !['hp', 'atk', 'def', 'ehp', 'degats_reels'].includes(c)), 'aucune colonne de PV, ATQ, DEF ni d’objectif n’est immuable');

  // Borne sur une colonne qui change à la résolution : aucun non vérifié masqué.
  let i = b.changer({ bornes: { atk: { min: 1e9, max: null } } });
  egal([i.filtre.comptes.masquesNonVerifies, i.filtre.comptes.potentielsNonVerifies, i.filtre.comptes.visiblesConfirmes], [0, nonVerifies.length, 0],
    'ATQ ≥ 10⁹ : les confirmées masquées, chaque non vérifié reste potentiel');
  ok(i.filtre.vide === null && i.page.placesEnAttente > 0, 'pas d’absence définitive tant que des potentiels restent ; leurs places demeurent');
  // Borne sur une colonne immuable : l'échec est démontré, même non vérifié.
  const efficiences = nonVerifies.map((c) => valeurDeLaCarte('efficience', c, b.photo, p0.parBuild)).sort((x, y) => x - y);
  const seuil = efficiences[Math.floor(efficiences.length / 2)];
  const echouent = efficiences.filter((e) => e < seuil).length;
  i = b.changer({ bornes: { efficience: { min: seuil, max: null } } });
  ok(echouent > 0 && echouent < nonVerifies.length, `efficience ≥ ${seuil} : sépare les non vérifiés (${echouent} en dessous)`);
  egal([i.filtre.comptes.masquesNonVerifies, i.filtre.comptes.potentielsNonVerifies], [echouent, nonVerifies.length - echouent],
    `efficience ≥ ${seuil} (colonne immuable) : ${echouent} non vérifiés en échec démontré, les autres potentiels`);
  i = b.changer({ bornes: { spd: { min: 1e9, max: null } } });
  egal([i.filtre.vide, i.page.placesEnAttente], ['aucune-sous-filtre', 0], 'VIT ≥ 10⁹ : recherche scellée, aucun potentiel → absence définitive dite');

  // Pendant la file : un build potentiel sous ATQ devient visible ou masqué selon son ATQ RÉSOLUE.
  const c = banc();
  c.pomper(5);
  const atq = cartesDeLaVue(c.corps.projection()).map((x) => statTotal(x.stats, 'atk')).sort((x, y) => x - y);
  const v = atq[Math.floor(atq.length / 2)];
  c.changer({ bornes: { atk: { min: v, max: null } } }, 0);
  c.pomper();
  const p = c.corps.projection();
  const vues = cartesDeLaVue(p), dansLaVue = new Set(ids(p.affichees));
  ok(vues.length > 0 && vues.every((x) => statTotal(x.stats, 'atk') >= v), `vérifiés pendant la borne : jugés sur l’ATQ de leur vraie paire (${vues.length} visibles)`);
  const sous = c.candidats.filter((x) => { const r = p.parBuild.get(cleBuild(x)); return r?.conforme && statTotal(r.stats, 'atk') < v; });
  ok(sous.length > 0 && sous.every((x) => !dansLaVue.has(x.runeIds.join())), `${sous.length} vérifiés sous la borne (ATQ résolue) : hors de la vue`);

  // Valeur non finie sous une borne active : indéterminée, ni visible ni masquée.
  egal(categorieDeLaLigne(() => Number.NaN, true, etatDesBornes({ atk: { min: 0, max: null } }, () => true)), CATEGORIE_LIGNE.indeterminee, 'NaN sous borne : indéterminé');
  egal(categorieDeLaLigne((col) => col === 'atk' ? Number.NaN : 0, true, etatDesBornes({ atk: { min: 0, max: null }, hp: { min: 1, max: null } }, () => true)),
    CATEGORIE_LIGNE.masquee, 'NaN sous borne et autre borne manquée : masqué');
  egal(categorieDeLaLigne(() => Number.POSITIVE_INFINITY, true, etatDesBornes({ atk: { min: 0, max: null } }, () => true)), CATEGORIE_LIGNE.visible, '+∞ ≥ 0 : comparaison ordinaire');
  const index = indexNaN();
  egal([index.categorie(0), index.page(0, 10).includes(0), index.comptesParCategorie()[1][CATEGORIE_LIGNE.indeterminee]], [CATEGORIE_LIGNE.indeterminee, false, 1],
    'index : la ligne à l’ATQ NaN sous ATQ ≥ 0 est indéterminée, hors de la vue, comptée');
}

/** Un index direct : la ligne 0 résolue avec une ATQ `NaN`, les autres finies. */
function indexNaN() {
  const BASE = { hp: 10000, atk: 1000, def: 600, spd: 100, cr: 30, cd: 75, res: 15, acc: 0 };
  const base: BuildCandidate[] = Array.from({ length: 6 }, (_, i) => {
    const runes = Array.from({ length: 6 }, (_, j) => ({ id: 6 * i + j + 1, slot: j + 1, set: 'fight', rank: 6, rarity: 5, level: 15, main: { code: 3, value: 10 * i }, subs: [] }));
    return { runeIds: runes.map((r) => r.id), stats: computeStats({ base: BASE, runes, artifacts: [] }), effTotal: i };
  });
  const cache = new CacheResolutionJournalise();
  base.forEach((c, i) => cache.set(cleBuild(c), { paire: null, artefacts: [], meilleurSansVerrous: null, conforme: true,
    stats: c.stats.map((s) => s.key === 'atk' && i === 0 ? { ...s, total: Number.NaN, bonus: Number.NaN - s.base } : s) }));
  const publie = cache.publier();
  const index: ClassementCompact = new ClassementCompact(base);
  index.actualiser(publie, journalResolution(publie), {}, (c) => statTotal(c.stats, 'hp'),
    filtreDesLignes({ bornes: etatDesBornes({ atk: { min: 0, max: null } }, () => true), avecFile: true, cle: 'atk≥0',
      candidat: (i) => index.magasin.candidat(i), valeur: (col, c) => statTotal(c.stats, col as StatKey) }));
  return index;
}

export function testFiltresResultatsComptesPages() {
  titre('Filtres d’affichage — comptes de la vue, pages sous filtre, comptes globaux inchangés');
  const pages = (C: number, U: number, avecFile: boolean) => avecFile ? Math.max(1, Math.min(Math.ceil((C + U) / 20), Math.ceil(C / 20) + 1)) : Math.max(1, Math.ceil(C / 20));
  for (const avecFile of [true, false]) {
    const b = banc(420, { avecFile });
    const hasard = generateur(avecFile ? 7 : 8);
    for (const etape of ['partielle', 'point fixe']) {
      b.pomper(etape === 'partielle' ? 25 : Infinity);
      const sansBorne = b.changer({ bornes: undefined, page: 1 });
      const p0 = b.corps.projection(), confirmes = avecFile ? cartesDeLaVue(p0) : p0.affichees;
      let incoherences = 0, tours = 0;
      for (let essai = 0; essai < 10; essai++) {
        const bornes: BornesResultats = {};
        for (const colonne of COLONNES_RESULTATS) if (hasard() < 0.3) {
          const valeurs = confirmes.map((c) => valeurDeLaCarte(colonne, c, b.photo, p0.parBuild));
          bornes[colonne] = { min: hasard() < 0.6 ? valeurs[Math.floor(hasard() * valeurs.length)] ?? null : null, max: hasard() < 0.4 ? valeurs[Math.floor(hasard() * valeurs.length)] ?? null : null };
        }
        const i = b.changer({ bornes, page: 1 }), k = i.filtre.comptes;
        if (i.filtre.vide === 'bornes-contradictoires') continue;
        tours++;
        const identites = k.visiblesConfirmes + k.masquesConfirmes + k.indeterminesNumeriques === k.confirmesGlobaux
          && k.potentielsNonVerifies + k.masquesNonVerifies === k.nonVerifiesGlobaux
          && k.confirmesGlobaux + k.nonVerifiesGlobaux + k.ecartesResolution === k.recusActifs && k.recusActifs === b.candidats.length;
        const globaux = isDeepStrictEqual(i.comptes, sansBorne.comptes) && k.confirmesGlobaux === sansBorne.filtre.comptes.confirmesGlobaux;
        const lesPages = i.filtre.pages === pages(k.visiblesConfirmes, k.potentielsNonVerifies, avecFile);
        const cartes = i.page.cartes.length + i.page.placesEnAttente === Math.min(20, k.visiblesConfirmes + (avecFile ? k.potentielsNonVerifies : 0));
        if (!identites || !globaux || !lesPages || !cartes) incoherences++;
      }
      egal(incoherences, 0, `${avecFile ? 'avec file' : 'sans file'}, vérification ${etape} : ${tours} jeux de bornes, identités des comptes, comptes globaux inchangés, pages et page 1 sous filtre`);
    }
    if (!avecFile) {
      const i = b.changer({ bornes: { atk: { min: 1e9, max: null } } });
      egal([i.filtre.comptes.nonVerifiesGlobaux, i.filtre.comptes.potentielsNonVerifies, i.filtre.comptes.masquesConfirmes, i.filtre.vide],
        [0, 0, b.candidats.length, 'aucune-sous-filtre'], 'sans file : valeurs définitives, ATQ jugée sur tous les reçus');
    }
  }
}

export function testFiltresResultatsDifferentiel() {
  titre('Filtres d’affichage — différentiel : le classeur filtré contre un filtre de référence sur les confirmées');
  const b = banc();
  b.pomper();
  const p0 = b.corps.projection(), hasard = generateur(1818);
  const confirmes = cartesDeLaVue(p0), nonVerifies = p0.affichees.filter((c) => !p0.parBuild.has(cleBuild(c)));
  const valeurs = new Map(COLONNES_RESULTATS.map((col) => [col, confirmes.map((c) => valeurDeLaCarte(col, c, b.photo, p0.parBuild))]));
  let ecarts = 0, compares = 0, vides = 0;
  for (let essai = 0; essai < 60; essai++) {
    const bornes: BornesResultats = {};
    const nombre = 1 + Math.floor(hasard() * 3);
    for (let k = 0; k < nombre; k++) {
      const colonne = COLONNES_RESULTATS[Math.floor(hasard() * COLONNES_RESULTATS.length)], vs = valeurs.get(colonne)!;
      const tirer = () => vs[Math.floor(hasard() * vs.length)];
      bornes[colonne] = { min: hasard() < 0.7 ? tirer() : null, max: hasard() < 0.5 ? tirer() : null };
    }
    const i = b.changer({ bornes, page: 1 });
    const actives = Object.entries(bornes).filter(([, x]) => x!.min !== null || x!.max !== null) as [ColonneResultat, { min: number | null; max: number | null }][];
    if (actives.some(([, x]) => x.min !== null && x.max !== null && x.min > x.max)) { vides++; if (i.filtre.vide !== 'bornes-contradictoires' || i.page.cartes.length) ecarts++; continue; }
    compares++;
    const p = b.corps.projection();
    const attendus = confirmes.filter((c) => actives.every(([col, x]) => tient(valeurDeLaCarte(col, c, b.photo, p0.parBuild), x)));
    const potentiels = nonVerifies.filter((c) => actives.every(([col, x]) => !COLONNES_IMMUABLES.has(col) || tient(valeurDeLaCarte(col, c, b.photo, p0.parBuild), x)));
    const recus = p.affichees.filter((c) => confirme(p, c)), recusPotentiels = p.affichees.filter((c) => !p.parBuild.has(cleBuild(c)));
    if (!isDeepStrictEqual(recus, attendus) || !isDeepStrictEqual(ids(recusPotentiels), ids(potentiels))
      || !isDeepStrictEqual(i.page.cartes.map((c) => c.candidat), attendus.slice(0, TAILLE_PAGE_CLASSEMENT))
      || i.filtre.comptes.visiblesConfirmes !== attendus.length || i.filtre.comptes.masquesConfirmes !== confirmes.length - attendus.length) ecarts++;
  }
  ok(compares >= 40 && vides > 0, `${compares} jeux de bornes comparés, ${vides} contradictoires`);
  egal(ecarts, 0, 'cartes, ordre, potentiels, page 1 et comptes identiques à la référence (valeurs écrites par la carte, ordre sans borne)');
}
