import { isDeepStrictEqual } from 'node:util';
import { CorpsClassement, type InstantaneClassement, type VueClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { contexteResultat } from '../src/lib/contexteResultat';
import { cleBuild, type ResultatArtefacts } from '../src/lib/artifactQueue';
import { statTotal, type BuildCandidate } from '../src/lib/runeBuildOptim';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { fixtureClassementCombat } from './classement-fixture';
import { ok, titre } from './outils';

/**
 * Classeur en mode différé (les tâches avancent pas à pas, comme dans le
 * Worker), vraie résolution ; une ligne sur cinq est un doublon exact de la
 * précédente (mêmes runes).
 */
function banc(nombre: number) {
  const f = fixtureClassementCombat('degats_reels', false);
  const uniques: BuildCandidate[] = [];
  const candidats: BuildCandidate[] = [];
  for (let i = 0; i < nombre; i++) {
    if (i % 5 === 4) { candidats.push({ ...candidats[i - 1] }); continue; }
    const c = { ...f.candidats[i % 32], runeIds: Array.from({ length: 6 }, (_, s) => 20000 + i * 6 + s), effTotal: nombre - i };
    candidats.push(c); uniques.push(c);
  }
  const runeById = new Map(f.params.pool.map((r) => [r.id, r]));
  const pool = uniques.flatMap((c) => { const k = (c.runeIds[0] - 20000) / 6; return f.candidats[k % 32].runeIds.map((id, slot) => ({ ...runeById.get(id)!, id: c.runeIds[slot] })); });
  const photo = contexteResultat({ ...f.photo, params: { ...f.params, pool }, toutVerifier: false });
  const vue: VueClassement = { tri: 'degats_reels', metric: 'eff', page: 1 };
  const resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  let demandes = 0;
  const publications: InstantaneClassement[] = [];
  const corps = new CorpsClassement({ publier: (p) => { publications.push(p); },
    resoudre: (m) => { if (m.type === 'resoudre') demandes++; reponses.push(...resolution.recevoir(m)); }, incident: () => {} }, true);
  const enTache = () => corps.travailEnCours;
  const vider = () => { for (let n = 0; enTache() && n < 1e7; n++) corps.avancer(); };
  corps.ouvrir(photo, 1, vue, 1); vider();
  const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, candidats.length, lots.length - 1, null); vider();
  let t = 0, idVue = 1;
  const pomper = (pas = Infinity) => {
    vider(); corps.pomper(t); vider();
    for (let k = 0; k < pas && k < 20000; k++) {
      const r = reponses.shift() ?? resolution.etape();
      if (!r) break;
      vider(); corps.recevoirResolution(r, ++t); vider(); corps.pomper(t); vider();
    }
    vider(); corps.pomper(t += 400); vider(); corps.publier(t, true);
  };
  const changerSansPomper = (v: Partial<VueClassement>) => { Object.assign(vue, v); corps.changerVue({ ...vue }, ++idVue, idVue); };
  const changer = (v: Partial<VueClassement>, pas = 0) => { changerSansPomper(v); pomper(pas); return publications[publications.length - 1]; };
  const avancer = (n: number) => { for (let k = 0; k < n && enTache(); k++) corps.avancer(); };
  return { avancer, corps, candidats, vue, pomper, changer, changerSansPomper, enTache, publications, demandes: () => demandes,
    cache: () => (corps as unknown as { cache: Map<string, ResultatArtefacts> }).cache };
}

const ids = (cs: readonly BuildCandidate[]) => cs.map((c) => c.runeIds.join());

export function testFiltresResultatsDoublonsTaches() {
  titre('Filtres d’affichage — doublons, bornes posées pendant un tri ou un refiltrage, classeur différé');
  const b = banc(400);
  b.pomper(30);
  // Un tri qui lance une tâche, puis des bornes pendant cette tâche.
  b.changerSansPomper({ tri: 'atk' });
  b.avancer(40);
  const enTache = b.enTache();
  const pc = b.corps.projection();
  const atqs = pc.affichees.filter((c) => pc.parBuild.has(cleBuild(c))).map((c) => statTotal(c.stats, 'atk')).sort((x, y) => x - y);
  const seuil = atqs[Math.floor(atqs.length / 2)];
  b.changerSansPomper({ bornes: { atk: { min: seuil, max: null } } });
  ok(enTache, 'une tâche de tri était en cours au moment des bornes');
  b.pomper();
  const i1 = b.publications[b.publications.length - 1], p1 = b.corps.projection();
  const demandes = b.demandes();
  const sans = b.changer({ bornes: undefined }), p0 = b.corps.projection();
  const i2 = b.changer({ bornes: { atk: { min: seuil, max: null } } }), p2 = b.corps.projection();
  ok(isDeepStrictEqual(ids(p1.affichees), ids(p2.affichees)) && isDeepStrictEqual(i1.filtre, i2.filtre) && isDeepStrictEqual(i1.page, i2.page),
    'bornes posées pendant la tâche = bornes reposées hors tâche (lignes, comptes, page)');
  const attendu = p0.affichees.filter((c) => !p0.parBuild.has(cleBuild(c)) || statTotal(c.stats, 'atk') >= seuil);
  ok(isDeepStrictEqual(ids(p2.affichees), ids(attendu)), `ATQ ≥ ${seuil} : sous-suite exacte de la vue sans borne, doublons compris (${attendu.length} lignes)`);
  const doublonsVus = ids(p2.affichees).length - new Set(ids(p2.affichees)).size;
  ok(doublonsVus > 0, `doublons gardés dans la vue filtrée (${doublonsVus})`);
  const k = i2.filtre.comptes;
  ok(k.recusActifs === b.candidats.length && k.confirmesGlobaux + k.nonVerifiesGlobaux + k.ecartesResolution === k.recusActifs
    && k.visiblesConfirmes + k.masquesConfirmes + k.indeterminesNumeriques === k.confirmesGlobaux
    && k.potentielsNonVerifies + k.masquesNonVerifies === k.nonVerifiesGlobaux, 'identités des comptes avec doublons');
  ok(isDeepStrictEqual(i2.comptes, sans.comptes), 'comptes globaux inchangés sous borne');
  ok(b.demandes() === demandes, 'aucune demande de résolution aux changements de bornes');
  // Sens croissant sous borne : mêmes lignes, ATQ non décroissante.
  const asc = b.changer({ sens: 'asc' }), pa = b.corps.projection();
  ok(isDeepStrictEqual(new Set(ids(pa.affichees)), new Set(ids(p2.affichees))) && isDeepStrictEqual(asc.filtre.comptes, i2.filtre.comptes), 'croissant sous borne : mêmes lignes, mêmes comptes');
  const atkA = pa.affichees.map((c) => statTotal(c.stats, 'atk'));
  ok(atkA.every((v, j) => j === 0 || atkA[j - 1] <= v), 'croissant : ATQ non décroissante');
  b.changer({ sens: undefined, bornes: undefined });
  ok(isDeepStrictEqual(ids(b.corps.projection().affichees), ids(p0.affichees)) && b.demandes() === demandes, 'retour décroissant sans borne : même vue, aucune demande');

  // Des bornes changées pendant un refiltrage, puis les mêmes posées à froid.
  const pAvant = b.corps.projection();
  b.changerSansPomper({ bornes: { atk: { min: seuil, max: null } } }); b.avancer(2);
  const enRefiltre = b.enTache();
  b.changerSansPomper({ bornes: { cr: { min: 0, max: 1000 }, atk: { min: null, max: seuil } } }); b.pomper(0);
  const pm = b.corps.projection(), im = b.publications[b.publications.length - 1];
  b.changer({ bornes: undefined });
  const ir = b.changer({ bornes: { cr: { min: 0, max: 1000 }, atk: { min: null, max: seuil } } }), pr = b.corps.projection();
  ok(enRefiltre && isDeepStrictEqual(ids(pm.affichees), ids(pr.affichees)) && isDeepStrictEqual(im.filtre, ir.filtre) && isDeepStrictEqual(im.page, ir.page),
    'bornes changées pendant un refiltrage = mêmes bornes posées à froid');
  b.changer({ bornes: undefined });
  ok(isDeepStrictEqual(ids(b.corps.projection().affichees), ids(pAvant.affichees)) && isDeepStrictEqual(b.corps.projection().parBuild, pAvant.parBuild) && b.demandes() === demandes,
    'relâché : mêmes lignes, même équipement, aucune demande');
}
