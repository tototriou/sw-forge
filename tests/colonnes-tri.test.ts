import { isDeepStrictEqual } from 'node:util';
import { COLONNES_RESULTATS, type ColonneResultat } from '../src/lib/colonnesResultats';
import { candidatAvecSaPaire, cleBuild, ordonnerParDepartage, type ResultatArtefacts } from '../src/lib/artifactQueue';
import { optionsDuContexte, type ContexteResultat } from '../src/lib/contexteResultat';
import { scoreDuCandidat, type BuildCandidate, type OptionsDeClassement } from '../src/lib/runeBuildOptim';
import { CorpsClassement, type PublicationClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { classerPourLaPage, fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';

/** Référence croissante : le tri stable de `sortCandidates`, seul le comparateur de note inversé (jamais `reverse()`). */
function trierCroissant(candidats: readonly BuildCandidate[], colonne: ColonneResultat, options: OptionsDeClassement): BuildCandidate[] {
  const notes = candidats.map((c) => ({ c, s: scoreDuCandidat(c, colonne, options) }));
  if (notes.every((n) => n.s === null)) return candidats.slice();
  return notes.sort((x, y) => (x.s as number) - (y.s as number)).map((n) => n.c);
}

/** Les deux tris de référence du classement affiché : ordre de base, puis départage et note sur la vraie paire. */
function reference(photo: ContexteResultat, candidats: readonly BuildCandidate[], colonne: ColonneResultat, parBuild: ReadonlyMap<string, ResultatArtefacts>) {
  const base = trierCroissant(candidats, colonne, optionsDuContexte(photo, null, 'eff'));
  if (!parBuild.size) return { base, affichees: base };
  const gardes = ordonnerParDepartage(base.filter((c) => parBuild.get(cleBuild(c))?.conforme !== false), (c) => parBuild.get(cleBuild(c))?.relique?.id);
  return { base, affichees: trierCroissant(gardes.map((c) => candidatAvecSaPaire(c, parBuild)), colonne, optionsDuContexte(photo, parBuild, 'eff')) };
}

const ids = (cs: readonly BuildCandidate[]) => cs.map((c) => c.runeIds.join());

export function testColonnesTriAscendant() {
  titre('Classeur — tri croissant sur chacune des onze colonnes, départage inchangé');
  const f = fixtureClassementCombat('degats_reels');
  for (const colonne of COLONNES_RESULTATS) {
    const vue = { ...f.vue, tri: colonne, sens: 'asc' as const };
    const { projection } = classerPourLaPage(f.photo, f.candidats, vue);
    const attendu = reference(f.photo, f.candidats, colonne, projection.parBuild);
    ok(projection.parBuild.size > 0, `${colonne} : des builds résolus`);
    ok(isDeepStrictEqual(ids(projection.base), ids(attendu.base)), `${colonne} : ordre de base croissant = tri stable de référence`);
    ok(isDeepStrictEqual(projection.affichees, attendu.affichees), `${colonne} : classement affiché croissant = référence (lignes, doublons, vraie paire)`);
  }

  // Égalités : Taux Crit est le même pour tous les builds de la fixture. Le
  // sens ne renverse jamais le départage, comme le ferait un `reverse()`.
  const decroissant = classerPourLaPage(f.photo, f.candidats, { ...f.vue, tri: 'cr' }).projection;
  const croissant = classerPourLaPage(f.photo, f.candidats, { ...f.vue, tri: 'cr', sens: 'asc' }).projection;
  ok(new Set(f.candidats.map((c) => scoreDuCandidat(c, 'cr', optionsDuContexte(f.photo, null, 'eff')))).size === 1, 'Taux Crit : une seule valeur, tout est égalité');
  egal(ids(croissant.affichees), ids(decroissant.affichees), 'égalité complète : même ordre dans les deux sens (départage non renversé)');

  // Le geste : décroissant, puis croissant, puis retour — sans aucune résolution de plus.
  const lance = classerPourLaPage(f.photo, f.candidats, f.vue);
  const avant: PublicationClassement = lance.projection;
  const resolus = new Map(avant.parBuild);
  lance.corps.changerVue({ ...f.vue, sens: 'asc' }, 2, 2); lance.corps.pomper(2e9); lance.corps.publier(2e9, true);
  const asc = lance.corps.projection();
  ok(isDeepStrictEqual(asc.affichees, reference(f.photo, f.candidats, f.vue.tri, asc.parBuild).affichees), 'geste croissant : classement de référence');
  lance.corps.changerVue({ ...f.vue, sens: 'desc' }, 3, 3); lance.corps.pomper(3e9); lance.corps.publier(3e9, true);
  const retour = lance.corps.projection();
  ok(isDeepStrictEqual(ids(retour.affichees), ids(avant.affichees)) && isDeepStrictEqual(ids(retour.base), ids(avant.base)), 'retour au décroissant : le même classement qu’avant');
  ok(isDeepStrictEqual(retour.parBuild, resolus), 'changer de sens ne change aucun équipement');

  // Au fil des blocs : notes croissantes préparées pendant la recherche, en
  // plages de 4 096 fusionnées, réutilisées telles quelles au scellé.
  const nombreux: BuildCandidate[] = Array.from({ length: 9000 }, (_, k) => {
    const c = f.candidats[k % f.candidats.length], d = (k * 7919) % 13;
    return { ...c, stats: c.stats.map((s) => s.key === 'hp' ? { ...s, total: s.total + d, bonus: s.bonus + d } : s), effTotal: c.effTotal };
  });
  const corps = new CorpsClassement({ publier: () => {}, resoudre: () => { throw new Error('Résolution distante'); }, incident: (r) => { throw new Error(r); } }, true, 'directe');
  const vueAuFil = { ...f.vue, tri: 'hp' as const, sens: 'asc' as const };
  corps.ouvrir(f.photo, 1, vueAuFil, 1);
  const colonnes = creerColonnesCandidats(); nombreux.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes);
  lots.forEach((b, k) => {
    corps.ajouter(1, k, b); corps.activer(1);
    while (corps.travailEnCours) corps.avancer();
    while (corps.avancerAuFil()) { /* rattraper le reçu */ }
  });
  const notesAvantScelle = corps.travail.notes;
  corps.sceller(1, nombreux.length, lots.length - 1, null);
  while (corps.travailEnCours) corps.avancer();
  const auFil = corps.projection();
  ok(lots.length >= 3, `au fil : ${lots.length} blocs reçus`);
  egal(ids(auFil.base), ids(trierCroissant(nombreux, 'hp', optionsDuContexte(f.photo, null, 'eff'))), 'au fil : ordre de base croissant = tri stable de référence, ex æquo compris');
  ok(notesAvantScelle >= 2 * nombreux.length && corps.travail.notes === notesAvantScelle,
    `au fil : notes de la vue (croissante) et du fond (décroissant) préparées avant le scellé (${notesAvantScelle}, aperçu compris), aucune renotée après`);
}
