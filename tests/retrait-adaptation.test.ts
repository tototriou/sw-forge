import { baseCompleteCriteres, CLASSEMENT_CHAMPS_OPTIMIZER } from '../src/lib/criteresOptimizer';
import { CHAMPS_OPTIMIZER_SESSION } from '../src/lib/sessionOptimizer';
import { composerSession, ecrireSession, lireSession } from '../src/lib/session';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer } from '../src/lib/optimizerMemberStorage';
import { lirePointOptimizer, photographierPointOptimizer, preparerRepriseOptimizer } from '../src/lib/optimizerBackup';
import { resolutionDuContexte } from '../src/lib/contexteResultat';
import { CorpsClassement } from '../src/lib/classementCompact';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import type { ExclusionSelector, ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { GearSet, Monster } from '../src/types';
import { fixtureClassementCombat } from './classement-fixture';
import { egal, ok, titre } from './outils';

const RETIRE = 'adapterArtefactsAuTri';
const box: ExclusionSelector = { source: 'box', unitKey: '11' };
const gear: GearSet = { base: { hp: 1000, atk: 100, def: 100, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const monstre = { id: 1, com2usId: 10001, name: 'Monstre test', element: 'wind', stats: { speed: 100 }, leaderSkill: null } as Monster;
const compte: ExclusionSourceData = { box: [{ key: '11', monster: monstre, stars: 6, level: 40, gear }], rtaEntries: {},
  siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map([['1', monstre]]) };

/** Un stockage écrit avant le retrait : la mémoire porte encore le réglage. */
function stockageHistorique(valeur: unknown) {
  const criteres = { ...baseCompleteCriteres(undefined), minStats: { spd: 200 }, sortBy: 'hp', [RETIRE]: valeur };
  return JSON.stringify({ memories: [[cleMemoireMembre('l1', box), { listId: 'l1', selector: box, com2usId: 10001, criteres }]], teams: [],
    listContents: [{ listId: 'l1', contenu: 'guilde' }] });
}

export function testRetraitAdaptationMigrations() {
  titre('Retrait d’« Adapter les artéfacts et reliques au tri » — critères, mémoires, point, session, classeur');
  ok(!(RETIRE in baseCompleteCriteres(undefined)) && !(RETIRE in CLASSEMENT_CHAMPS_OPTIMIZER)
    && !(CHAMPS_OPTIMIZER_SESSION as readonly string[]).includes(RETIRE), 'le réglage n’est plus un critère, ni un champ de session');

  for (const valeur of [true, false]) {
    const lu = lireMembresOptimizer(stockageHistorique(valeur));
    const m = lu.memories.get(cleMemoireMembre('l1', box));
    ok(!!m && !(RETIRE in m.criteres), `mémoire historique (${valeur}) : acceptée, réglage ôté à la lecture`);
    egal([m?.criteres.minStats, m?.criteres.sortBy], [{ spd: 200 }, 'hp'], `mémoire historique (${valeur}) : les autres critères sont conservés`);
    egal(lu.rapport, [], `mémoire historique (${valeur}) : aucun avertissement`);
    ok(!ecrireMembresOptimizer({ ...lu }).includes(RETIRE), `mémoire historique (${valeur}) : la réécriture ne le contient plus`);
  }
  const malForme = lireMembresOptimizer(stockageHistorique('oui'));
  ok(malForme.memories.size === 0 && malForme.rejets.memories.length === 1, 'valeur historique mal typée : mémoire rejetée et conservée brute, jamais acceptée comme migration');

  const brut = stockageHistorique(true);
  const point = photographierPointOptimizer({ ...lireMembresOptimizer(brut), lists: [{ id: 'l1', name: 'Liste' }], members: [{ listId: 'l1', selector: box }],
    validated: [], activeListId: 'l1' }, null, new Date('2026-10-25T10:00:00Z'), brut);
  const relu = lirePointOptimizer(JSON.stringify(point)).point!;
  egal(relu.membres, brut, 'point de sauvegarde : texte opaque des membres inchangé');
  const reprise = preparerRepriseOptimizer(relu, compte, new Set(), new Set());
  ok(![...reprise.stockage.memories.values()].some((x) => RETIRE in x.criteres), 'reprise du point : même lecteur, réglage ôté');

  const sources = { maintenant: new Date('2026-10-25T10:00:00Z'), versionApp: 'test', stockage: {}, compte: null, memoire: {},
    optimizer: { sortBy: 'hp', [RETIRE]: false } };
  const session = composerSession(sources);
  ok(!(RETIRE in (session.outils.optimizer ?? {})) && session.outils.optimizer?.sortBy === 'hp', 'session : le réglage n’est plus écrit, le reste oui');
  const ancienne = JSON.parse(ecrireSession(session));
  ancienne.outils.optimizer[RETIRE] = true;
  const lue = lireSession(JSON.stringify(ancienne));
  ok(lue.ok && !(RETIRE in (lue.session.outils.optimizer ?? {})) && lue.avertissements.length === 0,
    'session historique : réglage ignoré, sans erreur ni avertissement');

  // Le classeur : l'équipement suit l'objectif photographié ; aucun tri ne change
  // son régime, son cache ni sa génération de contexte.
  const f = fixtureClassementCombat('ehp');
  const entrees = resolutionDuContexte(f.photo)!;
  ok(entrees.regime === 'ehp', 'résolution : régime de l’objectif lancé');
  let derniere: { idContexte: number; generation: number } | null = null;
  const corps: CorpsClassement = new CorpsClassement({ publier: (p) => { derniere = { idContexte: p.versions.idContexteResolution,
    generation: (corps as unknown as { generationCache: number }).generationCache }; },
    resoudre: () => {}, incident: () => {} }, false, 'directe');
  corps.ouvrir(f.photo, 1, f.vue, 1);
  const colonnes = creerColonnesCandidats(); f.candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
  extraireBlocs(colonnes).forEach((b, i) => corps.ajouter(1, i, b));
  corps.publier(0, true);
  const avant = derniere!;
  for (const [i, tri] of (['degats_reels', 'hp', 'atk', 'efficience'] as const).entries()) {
    corps.changerVue({ ...f.vue, tri }, 2 + i, 2 + i); corps.publier(1000 * (i + 1), true);
  }
  egal(derniere, avant, 'quatre tris de régimes différents : même contexte de résolution, aucun cache vidé');
}
