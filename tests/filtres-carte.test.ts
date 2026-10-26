import { CorpsClassement, type InstantaneClassement, type VueClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { contexteResultat, optionsDuContexte } from '../src/lib/contexteResultat';
import { scoreDuCandidat } from '../src/lib/runeBuildOptim';
import { objectifsMontres } from '../src/lib/filtresResultats';
import { fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';

// Une carte gardée par une borne sur PV effectifs ou Dégâts réels écrit la
// valeur bornée, même quand ni l'objectif ni le tri ne la demandent ; le
// tableau reçoit les onze valeurs (`colonnesCompletes`). Le classeur calcule,
// l'écran montre, sur la même règle (`objectifsMontres`).

function banc(sansSort = false) {
  const f = fixtureClassementCombat('degats_reels', false);
  const photo = contexteResultat({ ...f.photo, params: f.params, toutVerifier: false, resolution: null, ...(sansSort ? { realDamage: null } : {}) });
  const vue: VueClassement = { tri: 'spd', metric: 'eff', page: 1 };
  let derniere!: InstantaneClassement;
  const corps = new CorpsClassement({ publier: (p) => { derniere = p; }, resoudre: () => {}, incident: () => {} }, false, 'directe');
  corps.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); f.candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, f.candidats.length, lots.length - 1, null);
  let t = 0, id = 1;
  const pomper = () => { do { corps.pomper(t += 400); } while (corps.travailEnRepli); corps.publier(t, true); return derniere; };
  const changer = (v: Partial<VueClassement>) => { Object.assign(vue, v); corps.changerVue({ ...vue }, ++id, id); return pomper(); };
  return { photo, pomper, changer };
}

export function testFiltresResultatsValeurBornee() {
  titre('Filtres d’affichage — la carte écrit la valeur bornée ; le tableau reçoit les onze valeurs');
  egal(objectifsMontres('efficience', 'spd', []), { ehp: false, degats: false }, 'règle : ni objectif, ni tri, ni borne → aucune rangée');
  egal(objectifsMontres('efficience', 'spd', ['ehp']), { ehp: true, degats: false }, 'règle : une borne active sur PV effectifs → sa rangée');
  egal(objectifsMontres('degats_reels', 'ehp', []), { ehp: true, degats: true }, 'règle : objectif et tri restent montrés');

  const b = banc();
  const options = optionsDuContexte(b.photo, null, 'eff');
  const sans = b.pomper();
  ok(sans.page.cartes.length > 0 && sans.page.cartes.every((c) => c.pvEffectifs === null && c.degatsReels !== null),
    `objectif Dégâts réels, tri VIT, sans borne : dégâts sur la carte, pas de PV effectifs (${sans.page.cartes.length} cartes)`);
  const bornee = b.changer({ bornes: { ehp: { min: 0, max: null } } });
  ok(bornee.page.cartes.length > 0 && bornee.page.cartes.every((c) => c.pvEffectifs !== null && Object.is(c.pvEffectifs, scoreDuCandidat(c.candidat, 'ehp', options))),
    'borne sur PV effectifs : chaque carte porte la valeur bornée, celle que la borne juge');
  ok(b.changer({ bornes: {} }).page.cartes.every((c) => c.pvEffectifs === null), 'borne relâchée : la valeur quitte la carte');
  const completes = b.changer({ colonnesCompletes: true });
  ok(completes.page.cartes.every((c) => c.pvEffectifs !== null && c.degatsReels !== null), 'tableau : les onze valeurs sur chaque carte');
  egal(completes.page.cartes.map((c) => c.candidat.runeIds.join()), sans.page.cartes.map((c) => c.candidat.runeIds.join()),
    'tableau : même ordre, mêmes builds — la demande ne change rien d’autre');

  const s = banc(true);
  const inactive = s.changer({ bornes: { degats_reels: { min: 0, max: null } } });
  ok(inactive.filtre.bornes.inactives.includes('degats_reels') && inactive.page.cartes.every((c) => c.degatsReels === null),
    'sans sort calculable : borne de Dégâts réels inactive, aucune valeur inventée sur la carte');
}
