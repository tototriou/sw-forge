import { CorpsClassement, type VueClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { contexteResultat, optionsDuContexte } from '../src/lib/contexteResultat';
import { cleBuild, prochainsATraiter } from '../src/lib/artifactQueue';
import { sortCandidates, type BuildCandidate } from '../src/lib/runeBuildOptim';
import { CorpsResolution, type ReponseResolution } from '../src/workers/resolutionBody';
import { fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';

/** Plus de builds que K (300 en relique « recherche ») : le fond s'arrête avant la fin. */
function banc(nombre: number, toutVerifier: boolean) {
  const f = fixtureClassementCombat('ehp');
  const candidats: BuildCandidate[] = Array.from({ length: nombre }, (_, i) => ({ ...f.candidats[i % 32],
    runeIds: Array.from({ length: 6 }, (_, s) => 20000 + i * 6 + s), effTotal: nombre - i }));
  const runeById = new Map(f.params.pool.map(r => [r.id, r]));
  const pool = candidats.flatMap((c, i) => f.candidats[i % 32].runeIds.map((id, slot) => ({ ...runeById.get(id)!, id: c.runeIds[slot] })));
  const photo = contexteResultat({ ...f.photo, params: { ...f.params, pool, objective: 'efficience' }, toutVerifier });
  const vue: VueClassement = { tri: 'efficience', metric: 'eff', page: 1 };
  const resolution = new CorpsResolution(), reponses: ReponseResolution[] = [];
  let demandes = 0, generation = -1;
  // La génération du cache est interne : l'instantané n'en dit rien à la page.
  const corps: CorpsClassement = new CorpsClassement({ publier: () => { generation = (corps as unknown as { generationCache: number }).generationCache; },
    resoudre: (m) => { if (m.type === 'resoudre') demandes++; reponses.push(...resolution.recevoir(m)); }, incident: () => {} });
  corps.ouvrir(photo, 1, vue, 1);
  const colonnes = creerColonnesCandidats(); candidats.forEach(c => ajouterObjetCandidat(colonnes, c));
  const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
  corps.sceller(1, candidats.length, lots.length - 1, null);
  let t = 0, idVue = 1;
  const pointFixe = () => {
    corps.pomper(t);
    for (let garde = 0; garde < 20000; garde++) {
      const r = reponses.shift() ?? resolution.etape();
      if (!r) break;
      corps.recevoirResolution(r, ++t); corps.pomper(t);
    }
    corps.pomper(t += 400); corps.publier(t, true);
  };
  const changer = (v: Partial<VueClassement>) => { Object.assign(vue, v); corps.changerVue({ ...vue }, ++idVue, idVue); pointFixe(); };
  const cache = () => (corps as unknown as { cache: Map<string, { conforme: boolean }> }).cache;
  return { corps, photo, candidats, vue, pointFixe, changer, cache, demandes: () => demandes, generation: () => generation };
}

export function testTriSansNouvelleResolution() {
  titre('Classeur — changer le tri ou la mesure ne résout aucun équipement ; seule la navigation en demande');
  const b = banc(420, false);
  b.pointFixe();
  const apresLancement = b.demandes(), resolus = new Set(b.cache().keys()), generation = b.generation();
  const confirmees = [...b.cache().values()].filter(r => r.conforme).length;
  ok(apresLancement > 0 && resolus.size < b.candidats.length && confirmees === 300,
    `lancement : le fond s'arrête à K = 300 confirmées sur ${b.candidats.length} builds (${resolus.size} résolus)`);
  const parAtq = sortCandidates(b.candidats, 'atk', optionsDuContexte(b.photo, null, 'eff'));
  ok(prochainsATraiter(parAtq, b.cache(), 300, []).length > 0,
    'témoin : l’ancienne fenêtre de fond suivant le tri ATQ aurait demandé de nouvelles résolutions');

  const derniere = Math.ceil(confirmees / 20) + 1;
  // Le tri change aussi quand la page reste au-delà des confirmées (mesure changée dans les réglages).
  for (const geste of [{ tri: 'atk', page: 1 }, { tri: 'hp', page: 1 }, { metric: 'score', page: 1 }, { tri: 'ehp', metric: 'eff', page: 1 },
    { tri: 'atk', page: derniere }, { metric: 'score', page: derniere }] as Partial<VueClassement>[]) {
    b.changer(geste);
    egal([b.demandes(), b.cache().size, b.generation()], [apresLancement, resolus.size, generation],
      `${JSON.stringify(geste)} : aucune demande, aucun équipement nouveau, cache intact`);
  }
  // Une page au-delà des confirmées, ouverte en naviguant : elle seule résout.
  b.changer({ tri: 'efficience', metric: 'eff', page: 1 });
  b.changer({ page: derniere });
  ok(b.demandes() > apresLancement, `navigation vers la page ${derniere} : ses places en attente se résolvent (${b.demandes() - apresLancement} demandes)`);
  const avantRetour = b.demandes();
  b.changer({ tri: 'efficience', page: 1 });
  egal(b.demandes(), avantRetour, 'retour au tri de l’objectif : rien de plus à résoudre');
}

export function testToutVerifierPhotographie() {
  titre('Classeur — « Vérifier toutes les combinaisons trouvées » suit la photographie du lancement');
  const fini = banc(330, false);
  fini.pointFixe();
  ok(fini.cache().size < 330, `photographié désactivé : K fini (${fini.cache().size} résolus sur 330)`);
  const tout = banc(330, true);
  tout.pointFixe();
  egal(tout.cache().size, 330, 'photographié activé : toutes les combinaisons vérifiées');
  const cles = new Set(tout.candidats.map(cleBuild));
  ok([...tout.cache().keys()].every(k => cles.has(k)), 'seuls les builds de cette recherche entrent au cache');
}
