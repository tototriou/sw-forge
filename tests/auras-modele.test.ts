import { egal, ok, titre } from './outils';
import { computeStats, statsParPaire } from '../src/lib/stats';
import { AUCUNE_AURA_PROPRE, ARTIFACT_DAMAGE_NEUTRE, DEFAULT_DAMAGE_SETUP, aurasPropresDesRunes, computeSkillDamage, computeTotalDamage, degatsBrutsArtefactsParCoup, estPrisEnCharge, nombreAura, nombreAuraEffectif, skillDamageProfile, statsDebutCombat } from '../src/lib/damage';
import type { AurasPropres, DamageSetup, SetAura } from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { apportExclusive } from '../src/lib/relicExclusive';
import { evaluerPourRegime, type DegatsContext } from '../src/lib/artifactEvaluation';
import { chercherPaires } from '../src/lib/artifactOptim';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { aurasPropresParRunes, avecAurasConditions, buildBuckets, conditionsPaireFixePosees, diagnoseFeasibility, objectiveScore, pairBuckets, prepareSearch, pvEffectifs, respecteConditionsAvecRelique, respecteConditionsPaireFixe, respecteMinEtMax, scoreDuCandidat, searchBuilds, sortCandidates, contexteDominance, reliquesEquipables, statsLuesParLesLignes, totalPairCount } from '../src/lib/runeBuildOptim';
import { readFileSync } from 'node:fs';
import { prepareOrRefuse } from '../src/workers/prepareForSearch';
import { PARALLEL_PAIRING_THRESHOLD, driveParallelPairing } from '../src/workers/parallelPairing';
import { ensurePairSliceBundle, makeSpawnSliceNode } from '../scripts/lib/spawnSliceNode';
import { runSearchToCompletion } from '../scripts/lib/runSearch';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import type { BuildCandidate, BuildRequirement, RealDamageContext, TraceCandidat } from '../src/lib/runeBuildOptim';
import { drain } from '../scripts/lib/drain';
import { candidatAvecSaPaire, cleBuild, signatureArtefacts } from '../src/lib/artifactQueue';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { entreeResolution, resoudreCandidat, type ReglagesDifferentiel } from '../scripts/lib/relicDifferentiel';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { activeSets, runeEfficiency } from '../src/lib/effects';
import { params, rune } from './relic-search.test';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import type { Competence } from '../src/lib/monsterSkills';
import type { BaseStats, RelicDetail, RuneDetail } from '../src/types';

const BASE: BaseStats = { hp: 1001, atk: 101, def: 101, spd: 100, cr: 15, cd: 50, res: 0, acc: 0 };
const STATS = computeStats({ base: BASE, runes: [], artifacts: [] });
const SETUP = { ...DEFAULT_DAMAGE_SETUP, setsAuraExternes: [
  { set: 'fight' as const, nombre: 2 }, { set: 'determination' as const, nombre: 1 },
  { set: 'enhance' as const, nombre: 1 }, { set: 'accuracy' as const, nombre: 1 },
  { set: 'tolerance' as const, nombre: 1 },
] };

// 6bis-b2 : des runes SANS statistique (principale VIT +0, aucune
// sous-propriété) — seules leurs clés de set comptent, la fiche reste la base.
// Les attentes des tests d'auras propres se calculent donc à la main.
function runesDeSets(idBase: number, sets: string[]): RuneDetail[] {
  return sets.map((set, i) => rune(idBase + i, i + 1, [8, 0], [], set));
}
const SETS_AURA: SetAura[] = ['fight', 'determination', 'enhance', 'accuracy', 'tolerance'];
function vecteur(nombres: Partial<Record<SetAura, number>>): AurasPropres {
  return { fight: 0, determination: 0, enhance: 0, accuracy: 0, tolerance: 0, ...nombres };
}
function avecExternes(nombres: Partial<Record<SetAura, number>>): DamageSetup {
  return { ...DEFAULT_DAMAGE_SETUP, setsAuraExternes: Object.entries(nombres).map(([set, nombre]) => ({ set: set as SetAura, nombre: nombre! })) };
}
// Attentes à la main (base 101 ATQ/DEF, 1001 PV ; invocateur 20 % par défaut,
// élément inconnu) : un seul ceil sur invocateur + 8 % par aura effective.
const atkDebut = (auras: number) => 101 + Math.ceil((101 * (20 + 8 * auras)) / 100);
const hpDebut = (auras: number) => 1001 + Math.ceil((1001 * (20 + 8 * auras)) / 100);
const defDebut = (auras: number) => 101 + Math.ceil((101 * (20 + 8 * auras)) / 100);
// PV effectifs à la main : politique EHP sans lead ni invocateur, UN ceil par
// stat sur l'aura effective, constantes 1142 / 3,572 du facteur de défense.
const ehpMain = (enhance: number, determination: number) => {
  const hp = 1001 + Math.ceil((1001 * 8 * enhance) / 100);
  const def = 101 + Math.ceil((101 * 8 * determination) / 100);
  return (hp * (1142 + 3.572 * def)) / 1000;
};
const proche = (a: number | undefined, b: number) => a != null && Math.abs(a - b) < 1e-9;

function recette() {
  return buildOptimizerRecipe({
    monsterCom2usId: 14104, monsterName: 'Monstre du test',
    requirement: { sets: [], minStats: {} }, objective: 'ehp', damageSetup: SETUP,
    compterAurasResPre: true, metric: 'eff', slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: false, artifactMainByKind: {},
  });
}

export function testAurasRecette() {
  titre('Auras · recette externe, 15 acceptés, 16 refusés, ancien champ et resets');
  const r = recette();
  const lire = (value: unknown) => parseOptimizerRecipe(JSON.stringify(value));
  const avecExternes = (setsAuraExternes: unknown) => lire({ ...r, damageSetup: { ...SETUP, setsAuraExternes } });
  // `erreur` écrit « <chemin> <attente> » : l'espace final exige le chemin exact.
  const refuse = (resultat: ReturnType<typeof lire>, chemin: string) => resultat.recipe === null && !!resultat.error?.includes(`${chemin} `);

  // Plafond de saisie : cinq AUTRES monstres à trois sets (A.2 ter), les
  // activations propres du build s'ajoutant hors de ce champ.
  egal(avecExternes([]).recipe?.damageSetup.setsAuraExternes, [], '0 aura externe acceptée');
  egal(avecExternes([{ set: 'fight', nombre: 15 }]).recipe?.damageSetup.setsAuraExternes,
    [{ set: 'fight', nombre: 15 }], '15 sets d’un type acceptés');
  ok(avecExternes([{ set: 'fight', nombre: 10 }, { set: 'accuracy', nombre: 5 }]).recipe !== null, '15 sets répartis acceptés');
  ok(refuse(avecExternes([{ set: 'fight', nombre: 10 }, { set: 'accuracy', nombre: 6 }]), 'damageSetup.setsAuraExternes'),
    '16 sets répartis refusés avec chemin');
  ok(refuse(avecExternes([{ set: 'fight', nombre: 16 }]), 'damageSetup.setsAuraExternes.0.nombre'),
    '16 sets d’un type refusés avec chemin de l’entrée');
  for (const [invalide, chemin, motif] of [
    [[{ set: 'fight', nombre: 0 }], 'damageSetup.setsAuraExternes.0.nombre', 'zéro'],
    [[{ set: 'fight', nombre: 1.5 }], 'damageSetup.setsAuraExternes.0.nombre', 'non entier'],
    [[{ set: 'fight', nombre: '2' }], 'damageSetup.setsAuraExternes.0.nombre', 'nombre en texte'],
    [[{ set: 'inconnu', nombre: 1 }], 'damageSetup.setsAuraExternes.0.set', 'set inconnu'],
    [[{ set: 'fight', nombre: 1 }, { set: 'fight', nombre: 1 }], 'damageSetup.setsAuraExternes.1.set', 'doublon'],
    [['fight'], 'damageSetup.setsAuraExternes.0', 'entrée non objet'],
    ['fight', 'damageSetup.setsAuraExternes', 'pas une liste'],
  ] as [unknown, string, string][]) {
    ok(refuse(avecExternes(invalide), chemin), `aura externe refusée avec chemin : ${motif}`);
  }
  ok(!!lire({ ...r, compterAurasResPre: 'oui' }).error?.includes('compterAurasResPre'), 'toggle mal typé refusé avec chemin');

  // Ancien `setsAura` (total d'équipe, monstre optimisé inclus) : absent ou
  // vide ne dit rien ; non vide ne se convertit pas en externe, il est refusé.
  const ancien = JSON.parse(JSON.stringify(r));
  delete ancien.damageSetup.setsAuraExternes;
  delete ancien.compterAurasResPre;
  const sansChamp = lire(ancien);
  ok(sansChamp.recipe !== null, 'recette antérieure sans champ d’aura acceptée');
  egal(sansChamp.recipe && nombreAura(sansChamp.recipe.damageSetup, 'fight'), 0, 'champ absent : aucune aura externe');
  const vide = lire({ ...ancien, damageSetup: { ...ancien.damageSetup, setsAura: [] } });
  ok(vide.recipe !== null, 'ancien setsAura vide accepté');
  ok(!!vide.recipe && !('setsAura' in vide.recipe.damageSetup), 'ancien setsAura vide retiré : aucune clé opaque à réexporter');
  const nonVide = lire({ ...ancien, damageSetup: { ...ancien.damageSetup, setsAura: [{ set: 'fight', nombre: 3 }] } });
  ok(refuse(nonVide, 'damageSetup.setsAura') && !!nonVide.error?.includes('damageSetup.setsAuraExternes'),
    'ancien setsAura non vide refusé avec chemin et raison, jamais réinterprété');
  ok(refuse(lire({ ...r, damageSetup: { ...SETUP, setsAura: [{ set: 'fight', nombre: 3 }] } }), 'damageSetup.setsAura'),
    'ancien setsAura non vide refusé même à côté du nouveau champ');
  ok(refuse(lire({ ...ancien, damageSetup: { ...ancien.damageSetup, setsAura: 'fight' } }), 'damageSetup.setsAura'),
    'ancien setsAura mal typé refusé avec chemin');

  // Aller-retour export → import → export : aucune clé perdue ni ajoutée.
  const relue = lire(r).recipe;
  egal(relue?.damageSetup, SETUP, 'aller-retour : damageSetup identique');
  egal(relue && lire(relue).recipe, relue, 'aller-retour : un second import ne change rien');
  egal(relue && nombreAura(relue.damageSetup, 'fight'), 2, 'calcul : la part externe relue est celle lue par nombreAura');

  // Resets : l'import de compte applique le défaut complet (branche
  // `'compte'` de resetSearch), un changement d'espèce garde le contexte.
  egal(DEFAULT_DAMAGE_SETUP.setsAuraExternes, [], 'import de compte : auras externes vidées');
  egal(DAMAGE_SETUP_CLASSIFICATION.setsAuraExternes, 'contexte', 'auras externes classées contexte');
  egal(damageSetupApresChangementMonstre(SETUP).setsAuraExternes, SETUP.setsAuraExternes,
    'changement d’espèce : auras externes conservées');
}

export function testAurasCombatEtExclusive() {
  titre('Auras · dégâts et assiette de relique, arrondi commun');
  const combat = statsDebutCombat(STATS, SETUP, AUCUNE_AURA_PROPRE);
  egal(combat.atk, 101 + Math.ceil(101 * (20 + 16) / 100), 'ATQ : un ceil commun invocateur + deux Fight');
  egal(combat.def, 101 + Math.ceil(101 * (20 + 8) / 100), 'DEF : un ceil commun');
  egal(combat.hp, 1001 + Math.ceil(1001 * (20 + 8) / 100), 'PV : un ceil commun');
  egal(combat.res, 8, 'Tolerance : 8 points depuis la base 0');
  egal(combat.acc, 8, 'Accuracy : 8 points depuis la base 0');
  const competence: Competence = { id: 1, com2usId: 1, nom: 'Test', description: null, slot: 1, passif: false, aoe: false,
    cooldown: null, coups: 1, niveauMax: 1, formule: '3.0*{ATK}', scale: [], ameliorations: [], icone: null, effets: [] };
  const sort = skillDamageProfile(competence);
  ok(sort != null && estPrisEnCharge(sort), 'sort synthétique calculable');
  if (!sort || !estPrisEnCharge(sort)) throw new Error('sort synthétique non calculable');
  ok(computeSkillDamage(sort, STATS, SETUP, AUCUNE_AURA_PROPRE, null) >
    computeSkillDamage(sort, STATS, DEFAULT_DAMAGE_SETUP, AUCUNE_AURA_PROPRE, null), 'dégâts du sort augmentés');
  const relic: RelicDetail = { id: 1, upgrade: 9, main: { code: 101, value: 0 }, unique: { type: 1, tranche: 130, percent: 1 } };
  ok(apportExclusive(relic, STATS, SETUP, AUCUNE_AURA_PROPRE, null).dmgPct > apportExclusive(relic, STATS, DEFAULT_DAMAGE_SETUP, AUCUNE_AURA_PROPRE, null).dmgPct,
    'exclusive : l’assiette Y contient Fight');
}

export function testAurasArrondiCommunLeadInvocateur() {
  titre('Auras · PV/ATQ/DEF : lead + invocateur + aura, un seul ceil');
  // Attentes fixées par le contrat, avant l'appel au moteur : 20 + 13 + 8 = 41 %
  // de la base. Trois ceil séparés donneraient 1414, 145 et 147.
  // 6bis-b2 : une aura externe ET une propre (16 %) → 20 + 13 + 16 = 49 %.
  // `ceil(externe) + ceil(propre)` séparés donneraient 1493, 152 et 155.
  const cas = [
    { stat: 'HP' as const, key: 'hp' as const, base: 1001, attendu: 1412, arrondisSepares: 1414, attendu16: 1492, separes16: 1493 },
    { stat: 'Attack Power' as const, key: 'atk' as const, base: 101, attendu: 143, arrondisSepares: 145, attendu16: 151, separes16: 152 },
    { stat: 'Defense' as const, key: 'def' as const, base: 103, attendu: 146, arrondisSepares: 147, attendu16: 154, separes16: 155 },
  ];
  const base: BaseStats = { ...BASE, def: 103 };
  const stats = computeStats({ base, runes: [], artifacts: [] });
  const setsAuraExternes = [
    { set: 'enhance' as const, nombre: 1 },
    { set: 'fight' as const, nombre: 1 },
    { set: 'determination' as const, nombre: 1 },
  ];
  // Les mêmes trois auras, activées cette fois par les runes du build.
  const runesAura = runesDeSets(5000, ['enhance', 'enhance', 'fight', 'fight', 'determination', 'determination']);
  const propres = aurasPropresDesRunes(runesAura);
  const statsAvecRunes = computeStats({ base, runes: runesAura, artifacts: [] });
  egal(statsAvecRunes, stats, 'runes sans statistique : la fiche reste la base, aucune aura dans computeStats');
  egal(propres, vecteur({ enhance: 1, fight: 1, determination: 1 }), 'les six runes activent une aura de chaque');
  for (const { stat, key, base: valeurBase, attendu, arrondisSepares, attendu16, separes16 } of cas) {
    const lead = { ...DEFAULT_DAMAGE_SETUP, leaderSkill: { stat, pct: 13 } };
    const setup = { ...lead, setsAuraExternes };
    ok(attendu !== arrondisSepares, `${key} : la base ${valeurBase} distingue les deux règles d'arrondi`);
    egal(statsDebutCombat(stats, setup, AUCUNE_AURA_PROPRE)[key], attendu, `${key} : 20 % invocateur + 13 % lead + 8 % aura, un ceil`);
    egal(statsDebutCombat(statsAvecRunes, lead, propres)[key], attendu,
      `${key} : les 8 % d'une aura PROPRE entrent dans le même ceil qu'une externe`);
    ok(attendu16 !== separes16, `${key} : la base ${valeurBase} distingue ceil(externe + propre) de deux ceil`);
    egal(statsDebutCombat(statsAvecRunes, setup, propres)[key], attendu16,
      `${key} : externe + propre = 16 %, dans le ceil unique invocateur + lead + auras`);
  }
}

export function testAurasChoixEffectifReliqueEhp() {
  titre('Auras · choix effectif entre deux reliques EHP avec Enhance/Determination');
  // Attentes indépendantes du score du moteur : base 1001 PV / 101 DEF ;
  // Enhance ajoute ceil(1001 × 8 %) = 81 PV, Determination ceil(101 × 8 %) = 9 DEF.
  // PV +10 % : (1102 + 81) × (1142 + 3,572 × (101 + 9)) / 1000 = 1815,81036.
  // DEF +40 % : (1001 + 81) × (1142 + 3,572 × (142 + 9)) / 1000 = 1819,244504.
  // Sans aura, les scores sont 1656,054744 et 1650,873224 : l'ordre s'inverse.
  const attendu = {
    avecAura: { pv: 1815.81036, def: 1819.244504, retenue: 102 },
    sansAura: { pv: 1656.054744, def: 1650.873224, retenue: 101 },
  };
  const pv: RelicDetail = { id: 101, upgrade: 9, main: { code: 100, value: 10 } };
  const def: RelicDetail = { id: 102, upgrade: 9, main: { code: 102, value: 40 } };
  const candidates = [pv, def]; // La meilleure avec aura est la seconde, pas la première du pool.
  const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, candidates);
  const gear = { base: BASE, runes: [], artifacts: [] };
  for (const [nom, setup, oracle] of [
    ['avecAura', SETUP, attendu.avecAura],
    ['sansAura', DEFAULT_DAMAGE_SETUP, attendu.sansAura],
  ] as const) {
    const faireParams = (relique: RelicDetail | undefined) => ({
      porteur: { element: 'fire' as const, archetype: 'attack' as const },
      inventaire: [], equipes: [], principaleParSorte: {},
      evaluer: evaluerPourRegime('ehp', statsParPaire({ ...gear, relic: relique }), AUCUNE_AURA_PROPRE, { relique, setup, element: null }),
    });
    const scores = candidates.map((relique) => faireParams(relique).evaluer([]));
    ok(Math.abs(scores[0]! - oracle.pv) < 1e-9, `${nom} : score chiffré de la relique PV`);
    ok(Math.abs(scores[1]! - oracle.def) < 1e-9, `${nom} : score chiffré de la relique DEF`);
    egal(scores[0]! > scores[1]!, oracle.retenue === pv.id, `${nom} : classement chiffré des deux candidates`);
    const resolution = resoudreEquipementDuBuild({ gear, faireParams, respecteConditions: null,
      requirement: { minStats: {}, maxStats: {} }, regimeAucun: false, relicContext: ctx });
    egal(resolution.conforme, true, `${nom} : un couple faisable est retenu`);
    egal(resolution.relique?.id, oracle.retenue, `${nom} : relique effectivement retenue par la résolution`);
    ok(Math.abs((resolution.paire?.score ?? NaN) - Math.max(oracle.pv, oracle.def)) < 1e-9,
      `${nom} : score de la paire retenue égal au meilleur score attendu`);
  }
}

export function testAurasPassifEtAdditionnel() {
  titre('Auras · passif offensif et dégâts additionnels');
  const competence = (id: number, formule: string): Competence => ({ id, com2usId: id, nom: 'Test', description: null,
    slot: 1, passif: false, aoe: false, cooldown: null, coups: 1, niveauMax: 1,
    formule, scale: [], ameliorations: [], icone: null, effets: [] });
  const actif = skillDamageProfile(competence(1, '3.0*{ATK}'));
  const passif = skillDamageProfile(competence(2, '1.0*{MAX HP}'));
  if (!actif || !estPrisEnCharge(actif) || !passif || !estPrisEnCharge(passif)) throw new Error('profils synthétiques non calculables');
  const p = [{ skillCom2usId: 2, nom: 'Test', description: null, critique: 'jamais' as const,
    coupsDuSortActif: false, categorie: { type: 'toujours' as const }, profile: passif }];
  const sans = computeTotalDamage(actif, p, STATS, DEFAULT_DAMAGE_SETUP, AUCUNE_AURA_PROPRE) - computeSkillDamage(actif, STATS, DEFAULT_DAMAGE_SETUP, AUCUNE_AURA_PROPRE);
  const avec = computeTotalDamage(actif, p, STATS, SETUP, AUCUNE_AURA_PROPRE) - computeSkillDamage(actif, STATS, SETUP, AUCUNE_AURA_PROPRE);
  ok(avec > sans, 'le passif proportionnel aux PV reçoit Enhance');
  const ligne = { ...ARTIFACT_DAMAGE_NEUTRE, brutPctDef: 10 };
  ok(degatsBrutsArtefactsParCoup(STATS, SETUP, AUCUNE_AURA_PROPRE, null, ligne) >
    degatsBrutsArtefactsParCoup(STATS, DEFAULT_DAMAGE_SETUP, AUCUNE_AURA_PROPRE, null, ligne),
    'la ligne additionnelle proportionnelle à la DEF reçoit Determination');
}

export function testAurasEhpEtConditions() {
  titre('Auras · EHP et conditions min/max RES/PRE seulement');
  ok(pvEffectifs(STATS, AUCUNE_AURA_PROPRE, SETUP) > pvEffectifs(STATS, AUCUNE_AURA_PROPRE), 'EHP inclut Enhance et Determination');
  const candidat = { runeIds: [], stats: STATS, effTotal: 0 };
  egal(objectiveScore(candidat, 'ehp', AUCUNE_AURA_PROPRE, undefined, undefined, SETUP), pvEffectifs(STATS, AUCUNE_AURA_PROPRE, SETUP), 'score EHP identique à la comparaison');
  egal(evaluerPourRegime('ehp', () => STATS, AUCUNE_AURA_PROPRE, { relique: undefined, setup: SETUP, element: null })([]), pvEffectifs(STATS, AUCUNE_AURA_PROPRE, SETUP),
    'choix de paire EHP sur les stats avec aura');
  const actif = avecAurasConditions({ sets: [], minStats: { res: 8, acc: 8 }, maxStats: { res: 8, acc: 8 } }, SETUP, true);
  ok(respecteMinEtMax(STATS, actif, AUCUNE_AURA_PROPRE), 'min et max RES/PRE franchis à partir de zéro');
  const inactif = avecAurasConditions(actif, SETUP, false);
  ok(!respecteMinEtMax(STATS, inactif, AUCUNE_AURA_PROPRE), 'toggle désactivé : min RES/PRE non franchis');
  ok(pvEffectifs(STATS, AUCUNE_AURA_PROPRE, SETUP) > pvEffectifs(STATS, AUCUNE_AURA_PROPRE), 'toggle désactivé : EHP reste augmenté');
  const tropBas = avecAurasConditions({ sets: [], minStats: {}, maxStats: { res: 7, acc: 7 } }, SETUP, true);
  ok(!respecteMinEtMax(STATS, tropBas, AUCUNE_AURA_PROPRE), 'max RES/PRE dépassés');
  const physiques = avecAurasConditions({ sets: [], minStats: { atk: 102 }, maxStats: {} }, SETUP, true);
  ok(!respecteMinEtMax(STATS, physiques, AUCUNE_AURA_PROPRE), 'Fight reste hors des conditions ATQ');
}

export function testAurasReliqueFinaleEtDiagnostics() {
  titre('Auras · filtre final de relique et diagnostics min/max');
  const gear = { base: BASE, runes: [], artifacts: [] };
  const exact = avecAurasConditions({ sets: [], minStats: { res: 8, acc: 8 }, maxStats: { res: 8, acc: 8 } }, SETUP, true);
  ok(respecteConditionsAvecRelique(gear, undefined, exact).respecte,
    'filtre final de relique : minimums et maximums franchis avec aura');
  ok(!respecteConditionsAvecRelique(gear, undefined, avecAurasConditions(exact, SETUP, false)).respecte,
    'filtre final de relique : toggle désactivé retire les points de condition');
  const maximum = avecAurasConditions({ sets: [], minStats: {}, maxStats: { res: 7, acc: 7 } }, SETUP, true);
  ok(!respecteConditionsAvecRelique(gear, undefined, maximum).respecte,
    'filtre final de relique : maximum seul bloque le résultat');
  ok(conditionsPaireFixePosees(maximum) && !respecteConditionsPaireFixe(STATS, maximum, AUCUNE_AURA_PROPRE),
    'paire à relique fixe : maximum RES/PRE seul bloque le résultat');
  ok(!conditionsPaireFixePosees({ minStats: {}, maxStats: { atk: 100 } }),
    'paire à relique fixe : ancien comportement T11 des autres maximums préservé');
  const diagnosticMin = diagnoseFeasibility({ base: BASE, artifacts: [], pool: [], requirement: exact, metric: 'eff' });
  egal(diagnosticMin.filter((d) => d.kind === 'min').map((d) => [d.key, d.bound, d.satisfiable]),
    [['res', 8, true], ['acc', 8, true]], 'diagnostic de minimum : borne avec aura');
  const diagnosticMax = diagnoseFeasibility({ base: BASE, artifacts: [], pool: [], requirement: maximum, metric: 'eff' });
  egal(diagnosticMax.filter((d) => d.kind === 'max').map((d) => [d.key, d.bound, d.satisfiable]),
    [['res', 8, false], ['acc', 8, false]], 'diagnostic de maximum : plancher avec aura');
}

export function testAurasPariteEcranCliEtCache() {
  titre('Auras · parité écran/CLI, tri et cache');
  const r = recette();
  const loaded: LoadedMonster = { unitId: 1, com2usId: r.monsterCom2usId, monsterName: r.monsterName,
    gear: { base: BASE, runes: [], artifacts: [] }, allRunes: [], allArtifacts: [], allRelics: [] };
  const paramsCli = recipeToSearchParams(r, loaded);
  egal(paramsCli.requirement.auraResPre, avecAurasConditions(r.requirement, r.damageSetup, true).auraResPre,
    'CLI et écran construisent les mêmes bonus de condition');
  egal(recipeToSearchParams({ ...r, compterAurasResPre: false }, loaded).requirement.auraResPre, { res: 0, acc: 0, compter: false },
    'CLI désactivé : les deux conditions sont hors aura');
  egal(recipeToSearchParams({ ...r, compterAurasResPre: undefined }, loaded).requirement.auraResPre, { res: 8, acc: 8, compter: true },
    'ancienne recette : le défaut de condition est activé');
  const deux = [
    { runeIds: [1], stats: STATS, effTotal: 1 },
    { runeIds: [2], stats: STATS.map((s) => s.key === 'hp' ? { ...s, total: s.total + 1 } : s), effTotal: 2 },
  ];
  egal(sortCandidates(deux, 'ehp', { damageSetup: SETUP, aurasPropresDe: () => AUCUNE_AURA_PROPRE })[0].runeIds, [2], 'tri EHP avec aura');
  const signature = (compterAurasResPre: boolean) => signatureArtefacts({ monstreCom2usId: 1, damageSetup: SETUP,
    compterAurasResPre, regimeEquipement: 'ehp', ignoreArtifacts: false, principaleParSorte: {},
    lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null,
    requirement: { minStats: { res: 8 }, maxStats: {} } });
  ok(signature(true) !== signature(false), 'le toggle invalide le cache');
  ok(signatureArtefacts({ monstreCom2usId: 1, damageSetup: { ...SETUP, setsAuraExternes: [] },
    compterAurasResPre: true, regimeEquipement: 'ehp', ignoreArtifacts: false, principaleParSorte: {},
    lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null,
    requirement: { minStats: { res: 8 }, maxStats: {} } }) !== signature(true), 'la liste invalide le cache');

  // 6bis-b4 — cache (T5). La signature GLOBALE suit le nombre d'auras
  // externes, le toggle et le régime ; la clé PAR BUILD (six runeIds, sans
  // ordre) porte les activations propres, qui ne dépendent que des runes.
  const sig = (externes: Partial<Record<SetAura, number>>, compter: boolean, regime: string) => signatureArtefacts({
    monstreCom2usId: 1, damageSetup: avecExternes(externes), compterAurasResPre: compter, regimeEquipement: regime,
    ignoreArtifacts: false, principaleParSorte: {}, lignesVerrouillees: [], relique: null, nbArtefacts: 0,
    empreinteRelique: null, requirement: { minStats: { res: 8 }, maxStats: {} } });
  ok(sig({ fight: 3 }, true, 'degats_reels') !== sig({ fight: 2 }, true, 'degats_reels'), 'cache : 3 → 2 Fight externes invalide');
  ok(sig({ fight: 3 }, true, 'degats_reels') !== sig({ fight: 3 }, false, 'degats_reels'), 'cache : toggle RES/PRE invalide');
  ok(sig({ fight: 3 }, true, 'degats_reels') !== sig({ fight: 3 }, true, 'ehp'), 'cache : changement de régime invalide');
  egal(sig({ fight: 3 }, true, 'degats_reels'), sig({ fight: 3 }, true, 'degats_reels'), 'cache : mêmes réglages, même signature (résultats conservés)');

  // Relique FIXE (sans contexte relique) : deux builds aux fiches identiques,
  // mêmes auras externes, auras propres différentes → deux résultats.
  const runesAura = runesDeSets(8000, ['enhance', 'enhance', 'determination', 'determination', 'will', 'will']);
  const runesSans = runesDeSets(8100, ['violent', 'violent', 'violent', 'violent', 'will', 'will']);
  const pool = [...runesAura, ...runesSans];
  const candidat = (runes: RuneDetail[]): BuildCandidate =>
    ({ runeIds: runes.map((x) => x.id), stats: computeStats({ base: BASE, runes, artifacts: [] }), effTotal: 0 });
  const cAura = candidat(runesAura);
  const cSans = candidat(runesSans);
  const p = params(pool, { sets: [], minStats: {} }, { base: BASE, objective: 'ehp' });
  const reglages = (externes: Partial<Record<SetAura, number>>): ReglagesDifferentiel => ({ critere: 'ehp',
    porteur: { element: 'fire', archetype: 'attack' }, exclusive: { setup: avecExternes(externes), element: null } });
  const aura = resoudreCandidat(p, cAura, undefined, reglages({ enhance: 3 }));
  const sans = resoudreCandidat(p, cSans, undefined, reglages({ enhance: 3 }));
  ok(proche(aura.paire?.score, ehpMain(4, 1)) && proche(sans.paire?.score, ehpMain(3, 0)),
    `relique fixe : 3 externes + propres par build — ${aura.paire?.score} / ${sans.paire?.score}`);
  const cache = new Map([[cleBuild(cAura), aura], [cleBuild(cSans), sans]]);
  const permute: BuildCandidate = { ...cAura, runeIds: [...cAura.runeIds].reverse() };
  ok(cache.get(cleBuild(permute)) === aura, 'cache : mêmes six runeIds dans un autre ordre → même entrée');
  egal(resoudreCandidat(p, permute, undefined, reglages({ enhance: 3 })), aura, 'cache : même build, mêmes réglages → même résultat recalculé');
  const moinsUne = resoudreCandidat(p, cAura, undefined, reglages({ enhance: 2 }));
  ok(proche(moinsUne.paire?.score, ehpMain(3, 1)) && !proche(moinsUne.paire?.score, aura.paire!.score),
    'auras externes changées : le résultat change, d’où l’invalidation de la signature');
}

export function testAurasRechercheDifferentielle() {
  titre('Auras · recherche et élagages contre énumération exhaustive bornée');
  for (let seed = 0; seed < 12; seed++) {
    const rng = mulberry32(7600 + seed);
    const pool = randomPool(rng, 2);
    const compter = seed % 2 === 0;
    const parSlot = Array.from({ length: 6 }, (_, i) => pool.filter((r) => r.slot === i + 1));
    let jokers = 0;
    const runesTemoin = parSlot.map((slot) => {
      const rune = slot.find((r) => r.set !== 'intangible') ?? slot[0];
      if (rune.set !== 'intangible') return rune;
      if (jokers++ === 0) return rune;
      return slot[1];
    });
    const temoin = computeStats({ base: BASE, runes: runesTemoin, artifacts: [] });
    const temoinRes = temoin.find((s) => s.key === 'res')!.total + (compter ? 8 : 0);
    const temoinAcc = temoin.find((s) => s.key === 'acc')!.total + (compter ? 8 : 0);
    const minRes = seed % 4 === 0 ? 1000 : Math.max(1, temoinRes - Math.floor(rng() * 6));
    const minAcc = Math.max(1, temoinAcc - Math.floor(rng() * 6));
    const maxRes = temoinRes + Math.floor(rng() * 6);
    const maxAcc = temoinAcc + Math.floor(rng() * 6);
    const requirement = avecAurasConditions({ sets: [], minStats: { res: minRes, acc: minAcc },
      maxStats: { res: maxRes, acc: maxAcc } }, SETUP, compter);
    let reference = 0;
    let meilleur = -Infinity;
    for (const a of parSlot[0]) for (const b of parSlot[1]) for (const c of parSlot[2])
      for (const d of parSlot[3]) for (const e of parSlot[4]) for (const f of parSlot[5]) {
        if ([a, b, c, d, e, f].filter((r) => r.set === 'intangible').length > 1) continue;
        const stats = computeStats({ base: BASE, runes: [a, b, c, d, e, f], artifacts: [] });
        const res = stats.find((s) => s.key === 'res')!.total + (compter ? 8 : 0);
        const acc = stats.find((s) => s.key === 'acc')!.total + (compter ? 8 : 0);
        if (res >= minRes && res <= maxRes && acc >= minAcc && acc <= maxAcc) {
          reference++;
          meilleur = Math.max(meilleur, [a, b, c, d, e, f].reduce((s, r) => s + runeEfficiency(r), 0));
        }
      }
    const moteur = searchBuilds({ base: BASE, artifacts: [], pool, requirement, metric: 'eff', maxMs: 30000 });
    ok(!moteur.truncated, `seed ${seed} : recherche complète`);
    egal(moteur.candidates.length > 0, reference > 0, `seed ${seed} : faisabilité identique (${reference} combinaisons exhaustives)`);
    if (reference > 0 && !moteur.truncated) egal(Math.max(...moteur.candidates.map((c) => c.effTotal)), meilleur,
      `seed ${seed} : meilleur score identique à la référence`);
    ok(moteur.candidates.every((c) => {
      const res = c.stats.find((s) => s.key === 'res')!.total + (compter ? 8 : 0);
      const acc = c.stats.find((s) => s.key === 'acc')!.total + (compter ? 8 : 0);
      return res >= minRes && res <= maxRes && acc >= minAcc && acc <= maxAcc;
    }), `seed ${seed} : aucun faux positif`);
    const diagnostic = diagnoseFeasibility({ base: BASE, artifacts: [], pool, requirement, metric: 'eff' });
    ok(reference > 0 || diagnostic.every((d) => d.satisfiable || !moteur.candidates.length),
      `seed ${seed} : diagnostic compatible avec le résultat`);
  }
}

/* --------------------------------------------------------------------------
 * 6bis-b2 — activations PROPRES aux six runes de chaque build. Attentes
 * calculées à la main (aides en tête de fichier), jamais par le moteur.
 * ----------------------------------------------------------------------- */

export function testAurasPropresResolution() {
  titre('Auras propres · résolues par activeSets sur les runes du build');
  // Aucune règle de jeu nouvelle : `activeSets` (Intangible compris) est la
  // seule source ; ce test vérifie la COHÉRENCE du vecteur avec elle.
  const cas: [string, string[], Partial<Record<SetAura, number>>][] = [
    ['2 Fight actifs', ['fight', 'fight', 'fight', 'fight', 'will', 'will'], { fight: 2 }],
    ['3 Fight actifs', ['fight', 'fight', 'fight', 'fight', 'fight', 'fight'], { fight: 3 }],
    ['Rage seul demandé, Fight complété par Intangible', ['rage', 'rage', 'rage', 'rage', 'fight', 'intangible'], { fight: 1 }],
    ['set non demandé : Enhance à côté de Violent', ['violent', 'violent', 'violent', 'violent', 'enhance', 'enhance'], { enhance: 1 }],
    ['un seul set incomplet : Intangible complète Fight', ['will', 'will', 'fight', 'energy', 'energy', 'intangible'], { fight: 1 }],
    ['deux sets incomplets (Fight, Violent) : Intangible ne complète rien', ['will', 'will', 'fight', 'violent', 'violent', 'intangible'], {}],
    ['aucune rune : zéro', [], {}],
  ];
  for (const [nom, sets, attendu] of cas) {
    const propres = aurasPropresDesRunes(runesDeSets(1000, sets));
    const actifs = activeSets(sets);
    egal(propres, vecteur(attendu), `${nom} : vecteur attendu`);
    ok(SETS_AURA.every((s) => propres[s] === actifs.filter((a) => a === s).length),
      `${nom} : cohérent avec activeSets [${actifs.join('+') || 'aucun'}]`);
  }
  // Exemples obligatoires du chapeau 6bis, avec 3 Fight externes.
  const trois = avecExternes({ fight: 3 });
  egal(nombreAuraEffectif(trois, aurasPropresDesRunes(runesDeSets(1000, ['fight', 'fight', 'fight', 'fight', 'will', 'will'])), 'fight'), 5,
    '3 Fight externes + 2 actifs = 5');
  egal(nombreAuraEffectif(trois, aurasPropresDesRunes(runesDeSets(1000, ['fight', 'fight', 'fight', 'fight', 'fight', 'fight'])), 'fight'), 6,
    '3 Fight externes + 3 actifs = 6');
  egal(nombreAuraEffectif(avecExternes({ fight: 15 }), aurasPropresDesRunes(runesDeSets(1000, ['fight', 'fight', 'fight', 'fight', 'fight', 'fight'])), 'fight'), 18,
    '15 externes + 3 propres = 18, la borne physique');
  ok(Object.isFrozen(AUCUNE_AURA_PROPRE) && SETS_AURA.every((s) => AUCUNE_AURA_PROPRE[s] === 0), 'zéro explicite figé');
  // La fiche hors combat ignore les sets d'aura : jamais un premier compte
  // par `computeStats` qui doublerait celui du combat.
  const fiche = (sets: string[]) => computeStats({ base: BASE, runes: runesDeSets(1000, sets), artifacts: [] });
  egal(fiche(['fight', 'fight', 'enhance', 'enhance', 'determination', 'determination']), fiche(['violent', 'violent', 'violent', 'violent', 'will', 'will']),
    'computeStats identique avec ou sans sets d’aura : aucun double compte');
  // Par le pool, comme l'écran, le CLI et les scripts (`aurasPropresParRunes`).
  const pool = runesDeSets(2000, ['fight', 'fight', 'enhance', 'enhance', 'tolerance', 'tolerance']);
  egal(aurasPropresParRunes(new Map(pool.map((r) => [r.id, r])))({ runeIds: pool.map((r) => r.id) }), aurasPropresDesRunes(pool),
    'depuis le pool : mêmes runes, même vecteur');
}

export function testAurasPropresCombatEtScore() {
  titre('Auras propres · combat et score : 3 externes + 2 propres = 5, jamais 7');
  // Build A : 4 Fight + 2 Enhance → 2 Fight et 1 Enhance propres.
  const runesA = runesDeSets(3000, ['fight', 'fight', 'fight', 'fight', 'enhance', 'enhance']);
  const propresA = aurasPropresDesRunes(runesA);
  const statsA = computeStats({ base: BASE, runes: runesA, artifacts: [] });
  const setup3 = avecExternes({ fight: 3, enhance: 3 });
  egal(propresA, vecteur({ fight: 2, enhance: 1 }), 'build A : 2 Fight et 1 Enhance propres');

  // Début de combat, `ceil` commun.
  const debut = statsDebutCombat(statsA, setup3, propresA);
  egal(debut.atk, atkDebut(5), 'début de combat : ATQ avec 3 + 2 = 5 Fight');
  ok(debut.atk !== atkDebut(7) && debut.atk !== atkDebut(3), '… ni 7 (double compte), ni 3 (propres oubliées)');
  egal(debut.hp, hpDebut(4), 'début de combat : PV avec 3 + 1 = 4 Enhance');
  const runes18 = runesDeSets(3100, ['fight', 'fight', 'fight', 'fight', 'fight', 'fight']);
  egal(statsDebutCombat(computeStats({ base: BASE, runes: runes18, artifacts: [] }), avecExternes({ fight: 15 }), aurasPropresDesRunes(runes18)).atk,
    atkDebut(18), '15 externes + 3 propres = 18 dans le ceil commun');
  const runesRage = runesDeSets(3200, ['rage', 'rage', 'rage', 'rage', 'fight', 'intangible']);
  egal(statsDebutCombat(computeStats({ base: BASE, runes: runesRage, artifacts: [] }), DEFAULT_DAMAGE_SETUP, aurasPropresDesRunes(runesRage)).atk,
    atkDebut(1), 'Rage seul demandé : le Fight complété par Intangible reçoit son +8 % ATQ de base');
  const runesNonDemande = runesDeSets(3300, ['violent', 'violent', 'violent', 'violent', 'enhance', 'enhance']);
  egal(statsDebutCombat(computeStats({ base: BASE, runes: runesNonDemande, artifacts: [] }), DEFAULT_DAMAGE_SETUP, aurasPropresDesRunes(runesNonDemande)).hp,
    hpDebut(1), 'set non demandé : l’Enhance du build compte');
  const runesRp = runesDeSets(3400, ['tolerance', 'tolerance', 'accuracy', 'accuracy', 'will', 'will']);
  const statsRp = computeStats({ base: BASE, runes: runesRp, artifacts: [] });
  const rp = statsDebutCombat(statsRp, DEFAULT_DAMAGE_SETUP, aurasPropresDesRunes(runesRp));
  egal([rp.res, rp.acc], [8, 8], 'RES/PRE propres : 8 points depuis une base nulle');
  const rp2 = statsDebutCombat(statsRp, avecExternes({ tolerance: 1, accuracy: 2 }), aurasPropresDesRunes(runesRp));
  egal([rp2.res, rp2.acc], [16, 24], 'RES/PRE : points externes et propres additionnés');

  // Dégâts : sort + passif, puis part additionnelle.
  const competence = (id: number, formule: string): Competence => ({ id, com2usId: id, nom: 'Test', description: null,
    slot: 1, passif: false, aoe: false, cooldown: null, coups: 1, niveauMax: 1,
    formule, scale: [], ameliorations: [], icone: null, effets: [] });
  const actif = skillDamageProfile(competence(1, '3.0*{ATK}'));
  const passif = skillDamageProfile(competence(2, '1.0*{MAX HP}'));
  if (!actif || !estPrisEnCharge(actif) || !passif || !estPrisEnCharge(passif)) throw new Error('profils synthétiques non calculables');
  const p = [{ skillCom2usId: 2, nom: 'Test', description: null, critique: 'jamais' as const,
    coupsDuSortActif: false, categorie: { type: 'toujours' as const }, profile: passif }];
  const total = (setup: DamageSetup, propres: AurasPropres) => computeTotalDamage(actif, p, statsA, setup, propres);
  // Référence : le même total avec 5 Fight et 4 Enhance EXTERNES, chemin du
  // lot 6 sans aura propre — les propres entrent dans le même terme, une fois.
  const reference5 = total(avecExternes({ fight: 5, enhance: 4 }), AUCUNE_AURA_PROPRE);
  egal(total(setup3, propresA), reference5, 'dégâts (sort + passif) : 3 + 2 Fight valent 5 Fight externes');
  ok(total(setup3, propresA) !== total(avecExternes({ fight: 7, enhance: 5 }), AUCUNE_AURA_PROPRE), 'dégâts : jamais 7 (double compte)');
  ok(total(setup3, propresA) > total(setup3, AUCUNE_AURA_PROPRE), 'dégâts : les propres augmentent le total');
  const ligne = { ...ARTIFACT_DAMAGE_NEUTRE, brutPctAtk: 10 };
  egal(degatsBrutsArtefactsParCoup(statsA, setup3, propresA, null, ligne), (ligne.brutPctAtk / 100) * atkDebut(5),
    'part additionnelle (218-221) : ATQ de combat avec 5 Fight');

  // `atkCombatComplet` (Brita) et `defCombat` (Gideon) : dérivés de
  // `statsDebutCombat` depuis 6bis-b2. ⚠️ Décision de cadrage (A.2, cible 2 :
  // les auras entrent dans les passifs ; « toute source confondue » pour
  // Brita), pas un relevé en jeu.
  const seul = (propres: AurasPropres, seuilAtq: { seuil: number; pct: number } | null, selonDef: { defMax: number; pctMax: number } | null, stats = statsA) =>
    computeTotalDamage(actif, [], stats, DEFAULT_DAMAGE_SETUP, propres, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null, null, selonDef, seuilAtq);
  const brita = { seuil: atkDebut(1), pct: 50 };
  ok(Math.abs(seul(propresA, brita, null) / seul(propresA, null, null) - 1.5) < 1e-12,
    `Brita : seuil ${brita.seuil} franchi grâce aux 2 Fight propres (ATQ ${atkDebut(2)}) → +50 %`);
  egal(seul(AUCUNE_AURA_PROPRE, brita, null), seul(AUCUNE_AURA_PROPRE, null, null), `Brita : sans aura, ATQ ${atkDebut(0)} sous le seuil`);
  const runesG = runesDeSets(3500, ['determination', 'determination', 'determination', 'determination', 'will', 'will']);
  const statsG = computeStats({ base: BASE, runes: runesG, artifacts: [] });
  const gideon = { defMax: 1000, pctMax: 100 };
  ok(Math.abs(seul(aurasPropresDesRunes(runesG), null, gideon, statsG) / seul(aurasPropresDesRunes(runesG), null, null, statsG) - (1 + defDebut(2) / 1000)) < 1e-12,
    `Gideon : DEF de combat ${defDebut(2)} avec 2 Determination propres`);

  // EHP : build B, 4 Enhance → 2 propres, avec 3 externes.
  const runesB = runesDeSets(3600, ['enhance', 'enhance', 'enhance', 'enhance', 'will', 'will']);
  const propresB = aurasPropresDesRunes(runesB);
  const statsB = computeStats({ base: BASE, runes: runesB, artifacts: [] });
  const setupE = avecExternes({ enhance: 3 });
  egal(pvEffectifs(statsB, propresB, setupE), ehpMain(5, 0), 'EHP : 3 + 2 = 5 Enhance');
  ok(pvEffectifs(statsB, propresB, setupE) !== ehpMain(7, 0) && pvEffectifs(statsB, propresB, setupE) !== ehpMain(3, 0), 'EHP : ni 7, ni 3');
  const candidatB: BuildCandidate = { runeIds: runesB.map((r) => r.id), stats: statsB, effTotal: 0 };
  egal(objectiveScore(candidatB, 'ehp', propresB, undefined, undefined, setupE), ehpMain(5, 0), 'score EHP direct : 5');

  // Paire : l'évaluateur de paires EHP et Dégâts réels.
  egal(evaluerPourRegime('ehp', statsParPaire({ base: BASE, runes: runesB, artifacts: [] }), propresB, { relique: undefined, setup: setupE, element: null })([]),
    ehpMain(5, 0), 'paire EHP : 3 + 2 = 5, jamais 7');
  const degats: DegatsContext = { profile: actif, passifs: p, setup: setup3, element: null, critSiPlusRapide: false,
    bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {}, bonusDegatsConditionnel: null,
    bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null };
  egal(evaluerPourRegime('degats_reels', statsParPaire({ base: BASE, runes: runesA, artifacts: [] }), propresA, degats)([]), reference5,
    'paire Dégâts réels : 3 + 2 Fight valent 5 Fight externes');

  // Exclusive : assiette Y (Conquête sur l'ATQ, tranche de 10).
  const conquete: RelicDetail = { id: 1, upgrade: 9, main: { code: 101, value: 0 }, unique: { type: 1, tranche: 10, percent: 1 } };
  const apport = apportExclusive(conquete, statsA, setup3, propresA).dmgPct;
  egal(apport, Math.floor(atkDebut(5) / 10), `exclusive : Y = ${atkDebut(5)} avec 5 Fight`);
  ok(apport !== Math.floor(atkDebut(7) / 10) && apport !== Math.floor(atkDebut(3) / 10), 'exclusive : ni 7, ni 3');

  // Deux candidats aux fiches identiques, aux auras propres différentes.
  const runesF = runesDeSets(3700, ['violent', 'violent', 'violent', 'violent', 'fight', 'fight']);
  const runesN = runesDeSets(3800, ['violent', 'violent', 'violent', 'violent', 'will', 'will']);
  const cF: BuildCandidate = { runeIds: runesF.map((r) => r.id), stats: computeStats({ base: BASE, runes: runesF, artifacts: [] }), effTotal: 0 };
  const cN: BuildCandidate = { runeIds: runesN.map((r) => r.id), stats: computeStats({ base: BASE, runes: runesN, artifacts: [] }), effTotal: 0 };
  egal(cF.stats, cN.stats, 'deux candidats : fiches identiques');
  const aurasPropresDe = aurasPropresParRunes(new Map([...runesF, ...runesN].map((r) => [r.id, r])));
  const realDamage: RealDamageContext = { ...degats, setup: DEFAULT_DAMAGE_SETUP, artefacts: ARTIFACT_DAMAGE_NEUTRE };
  ok(objectiveScore(cF, 'degats_reels', aurasPropresDe(cF), realDamage) > objectiveScore(cN, 'degats_reels', aurasPropresDe(cN), realDamage),
    'score direct : le candidat au Fight propre fait plus de dégâts');
  egal(sortCandidates([cN, cF], 'degats_reels', { realDamage, aurasPropresDe })[0].runeIds, cF.runeIds, 'tri : le Fight propre passe devant');
  egal(sortCandidates([cN, cF], 'degats_reels', { realDamage, aurasPropresDe: () => AUCUNE_AURA_PROPRE }).map((c) => c.runeIds), [cN.runeIds, cF.runeIds],
    'témoin : sans aura propre, ex æquo, ordre d’entrée conservé');

  // Non-mutation : aucun consommateur n'écrit dans `DamageSetup`.
  const geler = <T,>(o: T): T => {
    if (o && typeof o === 'object') { for (const v of Object.values(o)) geler(v); Object.freeze(o); }
    return o;
  };
  const gele = geler(JSON.parse(JSON.stringify(setup3)) as DamageSetup);
  const avant = JSON.stringify(gele);
  statsDebutCombat(statsA, gele, propresA);
  computeTotalDamage(actif, p, statsA, gele, propresA);
  pvEffectifs(statsA, propresA, gele);
  apportExclusive(conquete, statsA, gele, propresA);
  evaluerPourRegime('ehp', () => statsA, propresA, { relique: undefined, setup: gele, element: null })([]);
  egal(JSON.stringify(gele), avant, 'setup gelé relu à l’identique après tous les consommateurs');
  egal(Object.keys(gele).sort(), Object.keys(setup3).sort(), 'aucune clé ajoutée à DamageSetup');
}

export function testAurasPvEffectifsCeilUnique() {
  titre('Auras propres · pvEffectifs : un seul ceil sur externes + propres');
  // Base 1001 PV / 101 DEF, 1 externe + 1 propre de chaque : ceil(1001 × 16 %)
  // = 161 contre 81 + 81 = 162 en deux ceil ; ceil(101 × 16 %) = 17 contre 18.
  const runes = runesDeSets(6000, ['enhance', 'enhance', 'determination', 'determination', 'will', 'will']);
  const stats = computeStats({ base: BASE, runes, artifacts: [] });
  const propres = aurasPropresDesRunes(runes);
  const setup = avecExternes({ enhance: 1, determination: 1 });
  const separes = ((1001 + 81 + 81) * (1142 + 3.572 * (101 + 9 + 9))) / 1000;
  ok(ehpMain(2, 2) !== separes, 'la base distingue un ceil unique de deux ceil');
  egal(pvEffectifs(stats, propres, setup), ehpMain(2, 2), 'pvEffectifs : un seul ceil sur base × 8 × (externes + propres)');
  egal(pvEffectifs(stats, AUCUNE_AURA_PROPRE, avecExternes({ enhance: 2, determination: 2 })), ehpMain(2, 2),
    'même valeur que deux auras externes : la part propre rejoint le même terme');
}

export function testAurasPropresNoteDesCouples() {
  titre('Auras propres · note des couples de resoudreEquipementDuBuild et caches par build');
  // Les chiffres de testAurasChoixEffectifReliqueEhp, mais l'Enhance et la
  // Determination viennent des RUNES du build, sans aucune aura externe.
  const pv: RelicDetail = { id: 101, upgrade: 9, main: { code: 100, value: 10 } };
  const def: RelicDetail = { id: 102, upgrade: 9, main: { code: 102, value: 40 } };
  const attendu = { pv: 1815.81036, def: 1819.244504, pvSansAura: 1656.054744 };
  // PV +10 % : fiche 1102 PV / 101 DEF, + ceil(1001 × 8 %) = 81 PV et
  // ceil(101 × 8 %) = 9 DEF d'aura propre.
  ok(proche(((1102 + 81) * (1142 + 3.572 * (101 + 9))) / 1000, attendu.pv), 'attente PV +10 % recalculée à la main');
  const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, [pv, def]);
  const runesAura = runesDeSets(4000, ['enhance', 'enhance', 'determination', 'determination', 'will', 'will']);
  const runesSans = runesDeSets(4100, ['violent', 'violent', 'violent', 'violent', 'will', 'will']);
  const pool = [...runesAura, ...runesSans];
  const candidat = (runes: RuneDetail[]): BuildCandidate =>
    ({ runeIds: runes.map((r) => r.id), stats: computeStats({ base: BASE, runes, artifacts: [] }), effTotal: 0 });
  const cAura = candidat(runesAura);
  const cSans = candidat(runesSans);
  egal(cAura.stats, cSans.stats, 'deux builds aux fiches identiques');
  // Le constructeur du différentiel, « exactement ce que l'écran pose dans
  // faireParamsArtefacts » : les auras propres y sont résolues sur les runes.
  const r: ReglagesDifferentiel = { critere: 'ehp', porteur: { element: 'fire', archetype: 'attack' },
    exclusive: { setup: DEFAULT_DAMAGE_SETUP, element: null } };
  const p = params(pool, { sets: [], minStats: {} }, { base: BASE, objective: 'ehp' });
  const e = entreeResolution(p, cAura, ctx, r);
  const notes = [pv, def].map((relique) => chercherPaires(e.faireParams(relique)).paires[0]?.score);
  ok(proche(notes[0], attendu.pv) && proche(notes[1], attendu.def), `note des couples essayés avec l’aura propre : ${notes.join(' / ')}`);
  const retenu = resoudreEquipementDuBuild(e);
  egal(retenu.relique?.id, def.id, 'couple retenu : la DEF +40 %, grâce aux auras propres');
  ok(proche(retenu.paire?.score, attendu.def), 'note du couple retenu = meilleure note attendue');
  const sans = resoudreCandidat(p, cSans, ctx, r);
  egal(sans.relique?.id, pv.id, 'mêmes fiches, runes sans aura : la PV +10 % reste retenue');
  ok(proche(sans.paire?.score, attendu.pvSansAura), 'note sans aura propre');

  // Usage « conditions » (b3a) inchangé : les couples y sont jugés sur la
  // FICHE. PV max 1150 : la fiche PV +10 % (1102) passe, alors que ses PV de
  // combat (1102 + 81 = 1183) échoueraient ; DEF max 141 écarte la DEF +40 %
  // (fiche 142), pourtant la mieux notée.
  const pMax = params(pool, { sets: [], minStats: {}, maxStats: { def: 141, hp: 1150 } }, { base: BASE, objective: 'ehp' });
  const sousMax = resoudreCandidat(pMax, cAura, ctx, r);
  egal(sousMax.conforme, true, 'conditions : un couple faisable reste retenu');
  egal(sousMax.relique?.id, pv.id, 'conditions : la DEF +40 % écartée par le maximum DEF de la fiche');
  ok(proche(sousMax.paire?.score, attendu.pv), 'conditions : la note du couple retenu garde l’aura propre');
  egal(sousMax.stats, computeStats({ base: BASE, runes: runesAura, artifacts: [], relic: pv }),
    'conditions : couple transmis = stats de fiche du build avec la relique essayée, sans aura');

  // Caches : clé par build (six runeIds), résultats séparés.
  const cache = new Map([[cleBuild(cAura), retenu], [cleBuild(cSans), sans]]);
  egal(cache.size, 2, 'cache : une entrée par build');
  egal([...cache.values()].map((x) => x.relique?.id), [def.id, pv.id], 'cache : chaque entrée garde la relique de SON build');
  egal(candidatAvecSaPaire(cAura, cache).stats, computeStats({ base: BASE, runes: runesAura, artifacts: [], relic: def }),
    'cache : le candidat relit SES stats, relique DEF comprise');
  egal(aurasPropresParRunes(new Map(pool.map((x) => [x.id, x])))(cAura), aurasPropresDesRunes(runesAura),
    'les six runeIds de la clé déterminent les auras propres : la signature globale n’a pas à les porter');
}

/* --------------------------------------------------------------------------
 * 6bis-b3a — conditions RES/PRE EXACTES avec les auras propres du build.
 * Candidats CONSTRUITS, jamais issus de `searchBuilds`. Attentes à la main :
 * +8 points par activation (A.2 ter), externes de `SETUP` = 1 Tolerance et
 * 1 Accuracy, fiche sans rune de RES/PRE (base 0). `activeSets` reste la
 * seule source des sets actifs (cohérence prouvée par
 * `testAurasPropresResolution`).
 * ----------------------------------------------------------------------- */

const V4 = ['violent', 'violent', 'violent', 'violent'];
// [nom, sets des six runes, RES attendue, PRE attendue] — toggle actif.
const CANDIDATS_CONDITIONS: [string, string[], number, number][] = [
  ['Tolerance propre non demandée', [...V4, 'tolerance', 'tolerance'], 16, 8],
  ['Tolerance complétée par Intangible', [...V4, 'tolerance', 'intangible'], 16, 8],
  ['Accuracy propre non demandée', [...V4, 'accuracy', 'accuracy'], 8, 16],
  ['Accuracy complétée par Intangible', [...V4, 'accuracy', 'intangible'], 8, 16],
  ['trois Tolerance propres', ['tolerance', 'tolerance', 'tolerance', 'tolerance', 'tolerance', 'tolerance'], 32, 8],
  ['aucune aura propre', [...V4, 'will', 'will'], 8, 8],
];

function conditions(minStats: BuildRequirement['minStats'], maxStats: BuildRequirement['maxStats'], compter: boolean) {
  return avecAurasConditions({ sets: [], minStats, maxStats }, SETUP, compter);
}

export function testAurasConditionsPropresFonctions() {
  titre('Auras propres · conditions RES/PRE exactes (respecteMinEtMax, paire fixe, relique)');
  for (const [nom, sets, res, acc] of CANDIDATS_CONDITIONS) {
    const runes = runesDeSets(3000, sets);
    const gear = { base: BASE, runes, artifacts: [] };
    const stats = computeStats(gear);
    const propres = aurasPropresDesRunes(runes);
    // Les trois chemins reçoivent les mêmes conditions et doivent rendre le
    // même verdict : stats + propres, paire à relique fixe, relique finale.
    const verdicts = (req: BuildRequirement) => [
      respecteMinEtMax(stats, req, propres),
      respecteConditionsPaireFixe(stats, req, propres),
      respecteConditionsAvecRelique(gear, undefined, req).respecte,
    ];
    const exact = conditions({ res, acc }, { res, acc }, true);
    egal(verdicts(exact), [true, true, true], `${nom} : min = max = ${res} RES / ${acc} PRE, franchis exactement`);
    egal(verdicts(conditions({ res: res + 1 }, {}, true)), [false, false, false],
      `${nom} : minimum RES ${res + 1} non franchi — l'aura propre n'est comptée qu'une fois`);
    egal(verdicts(conditions({ acc: acc + 1 }, {}, true)), [false, false, false], `${nom} : minimum PRE ${acc + 1} non franchi`);
    egal(verdicts(conditions({}, { res: res - 1 }, true)), [false, false, false], `${nom} : maximum RES ${res - 1} dépassé`);
    egal(verdicts(conditions({}, { acc: acc - 1 }, true)), [false, false, false], `${nom} : maximum PRE ${acc - 1} dépassé`);
    // Toggle éteint : ni externe ni propre, dans les deux sens.
    egal(verdicts(conditions({ res: 1 }, {}, false)), [false, false, false], `${nom} : toggle éteint, aucune aura ne franchit le minimum`);
    egal(verdicts(conditions({}, { res: 1, acc: 1 }, false)), [true, true, true], `${nom} : toggle éteint, aucune aura ne dépasse le maximum`);
  }
  // Minimum franchi GRÂCE à l'aura propre, maximum dépassé À CAUSE d'elle :
  // deux candidats qui ne diffèrent que par leurs deux runes de set.
  const avec = runesDeSets(3100, [...V4, 'tolerance', 'tolerance']);
  const sans = runesDeSets(3200, [...V4, 'will', 'will']);
  const verdict = (runes: RuneDetail[], req: BuildRequirement) =>
    respecteMinEtMax(computeStats({ base: BASE, runes, artifacts: [] }), req, aurasPropresDesRunes(runes));
  egal([verdict(avec, conditions({ res: 16 }, {}, true)), verdict(sans, conditions({ res: 16 }, {}, true))], [true, false],
    'minimum RES 16 : seule la Tolerance propre le franchit');
  egal([verdict(avec, conditions({}, { res: 15 }, true)), verdict(sans, conditions({}, { res: 15 }, true))], [false, true],
    'maximum RES 15 : seule la Tolerance propre le dépasse');
  // PV/ATQ/DEF jamais dans les conditions, même avec Fight/Enhance/Determination propres.
  const physiques = runesDeSets(3300, ['fight', 'fight', 'enhance', 'enhance', 'determination', 'determination']);
  ok(!verdict(physiques, conditions({ atk: 102 }, {}, true)) && !verdict(physiques, conditions({ hp: 1002 }, {}, true))
    && !verdict(physiques, conditions({ def: 102 }, {}, true)), 'Fight, Enhance et Determination propres restent hors des conditions');
  // `auraResPre` absent : aucune aura dans les conditions, pas même externe.
  ok(!respecteMinEtMax(computeStats({ base: BASE, runes: avec, artifacts: [] }), { minStats: { res: 1 } }, aurasPropresDesRunes(avec)),
    'sans auraResPre : aucune aura, ni externe ni propre');
}

export function testAurasConditionsPropresResolution() {
  titre('Auras propres · resoudreEquipementDuBuild (relicQueue) en mode recherche');
  const pv: RelicDetail = { id: 201, upgrade: 9, main: { code: 100, value: 10 } };
  const ctx = resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 0 }, undefined, [pv]);
  for (const [nom, sets, res] of CANDIDATS_CONDITIONS.filter(([, , r]) => r > 8)) {
    const runes = runesDeSets(3400, sets);
    const gear = { base: BASE, runes, artifacts: [] };
    const propres = aurasPropresDesRunes(runes);
    const faireParams = (relique: RelicDetail | undefined) => ({
      porteur: { element: 'fire' as const, archetype: 'attack' as const },
      inventaire: [], equipes: [], principaleParSorte: {},
      evaluer: evaluerPourRegime('ehp', statsParPaire({ ...gear, relic: relique }), propres, { relique, setup: SETUP, element: null }),
    });
    const conforme = (req: BuildRequirement) => resoudreEquipementDuBuild({ gear, faireParams, respecteConditions: null,
      requirement: req, regimeAucun: false, relicContext: ctx }).conforme;
    egal(conforme(conditions({ res }, {}, true)), true, `${nom} : minimum RES ${res} franchi, couple retenu`);
    egal(conforme(conditions({ res }, {}, false)), false, `${nom} : toggle éteint, minimum RES ${res} non franchi`);
    egal(conforme(conditions({}, { res: res - 1 }, true)), false, `${nom} : maximum RES ${res - 1} dépassé, aucun couple`);
    egal(conforme(conditions({}, { res: res - 1 }, false)), true, `${nom} : toggle éteint, maximum RES ${res - 1} tenu`);
    // Seuils que la part propre SEULE (≥ 8) franchirait : éteint, elle ne compte pas.
    egal(conforme(conditions({ res: 8 }, {}, false)), false, `${nom} : toggle éteint, la part propre ne franchit pas un minimum RES 8`);
    egal(conforme(conditions({}, { res: 7 }, false)), true, `${nom} : toggle éteint, la part propre ne dépasse pas un maximum RES 7`);
  }
}

// Le contrôle final de `pairBuckets` isolé : `prepareSearch`, `buildBuckets`
// et `pairBuckets` appelés directement (jamais `searchBuilds`), sur un pool
// minuscule où toutes les runes survivent à la préparation. Les runes hors
// Violent portent chacune une sous-propriété distincte : aucune ne domine.
const POOL_PAIR: RuneDetail[] = [
  ...[1, 2, 3, 4].map((slot) => rune(4000 + slot, slot, [8, 0], [], 'violent')),
  ...[5, 6].flatMap((slot) => [
    rune(4100 + slot, slot, [8, 0], [[8, 1]], 'tolerance'),
    rune(4200 + slot, slot, [8, 0], [[9, 1]], 'will'),
    rune(4300 + slot, slot, [8, 0], [[10, 1]], 'endure'),
  ]),
];
const IDS = (a: number, b: number) => [4001, 4002, 4003, 4004, a + 5, b + 6];
const TOLERANCE = IDS(4100, 4100);
const WILL = IDS(4200, 4200);

function pairBucketsSeul(requirement: BuildRequirement, traceur: number[]) {
  const prepared = prepareSearch({ base: BASE, artifacts: [], pool: POOL_PAIR, requirement, metric: 'eff', maxMs: 60000,
    slotFilterCap: 80, traceur: { runeIds: traceur } });
  if (!prepared) throw new Error('pairBucketsSeul : préparation refusée');
  const A = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA));
  const B = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB));
  const resultat = drain(pairBuckets(prepared, A, B));
  return { resultat, trace: prepared.traceur!, collectes: resultat.candidates.map((c) => c.runeIds.join(',')) };
}

export function testAurasConditionsPropresPairBuckets() {
  titre('Auras propres · contrôle final exact de pairBuckets');
  const cle = (ids: number[]) => ids.join(',');
  const passageAmont = (trace: TraceCandidat) => trace.preparation.every((e) => e.presentes.every(Boolean))
    && trace.appariement.paireAtteinte && trace.appariement.missingSets === true;

  // MAXIMUM RES 15 : quickOk (externe seule, minorant) laisse passer ; seul
  // le contrôle final connaît la Tolerance propre (8 + 8 = 16 > 15).
  const req = (minStats: BuildRequirement['minStats'], maxStats: BuildRequirement['maxStats'], compter: boolean) =>
    avecAurasConditions({ sets: ['violent'], minStats, maxStats }, SETUP, compter);
  const max = pairBucketsSeul(req({}, { res: 15 }, true), TOLERANCE);
  ok(passageAmont(max.trace) && max.trace.appariement.quickOkMax === true,
    'maximum : la paire Tolerance passe toutes les coupes amont et quickOk');
  egal([max.trace.appariement.validationFinale, max.trace.appariement.collecte], [false, false],
    'maximum : le contrôle final rejette la Tolerance propre (16 > 15)');
  ok(max.collectes.includes(cle(WILL)) && !max.collectes.includes(cle(TOLERANCE)),
    'maximum : même pool, le candidat Will (8) est collecté, pas le Tolerance (16)');
  const maxEteint = pairBucketsSeul(req({}, { res: 15 }, false), TOLERANCE);
  egal([maxEteint.trace.appariement.validationFinale, maxEteint.collectes.includes(cle(TOLERANCE))], [true, true],
    'maximum, toggle éteint : la Tolerance propre ne pénalise plus');
  const maxEteintSept = pairBucketsSeul(req({}, { res: 7 }, false), TOLERANCE);
  egal([maxEteintSept.trace.appariement.validationFinale, maxEteintSept.collectes.includes(cle(TOLERANCE))], [true, true],
    'maximum RES 7, toggle éteint : la part propre (8) n’est pas comptée');
  const maxExact = pairBucketsSeul(req({}, { res: 16 }, true), TOLERANCE);
  egal(maxExact.trace.appariement.validationFinale, true, 'maximum RES 16 : tenu exactement, aucun double compte');

  // MINIMUM RES 16 : la marge Endure du pool (+20 sur les emplacements
  // libres, `guaranteedMin`) fait passer quickOkMin ; le contrôle final
  // décide alors avec la Tolerance propre.
  const min = pairBucketsSeul(req({ res: 16 }, {}, true), TOLERANCE);
  ok(passageAmont(min.trace) && min.trace.appariement.quickOkMin === true,
    'minimum : quickOkMin passe grâce à la marge Endure du pool');
  egal([min.trace.appariement.validationFinale, min.trace.appariement.collecte], [true, true],
    'minimum : franchi grâce à la Tolerance propre (8 + 8 = 16)');
  ok(min.collectes.includes(cle(TOLERANCE)) && !min.collectes.includes(cle(WILL)),
    'minimum : même pool, Tolerance collecté, Will (8) rejeté');
  const minEteint = pairBucketsSeul(req({ res: 16 }, {}, false), TOLERANCE);
  egal([minEteint.trace.appariement.quickOkMin, minEteint.trace.appariement.validationFinale], [true, false],
    'minimum, toggle éteint : quickOk passe, le contrôle final rejette');
  const minEteintHuit = pairBucketsSeul(req({ res: 8 }, {}, false), TOLERANCE);
  egal([minEteintHuit.trace.appariement.quickOkMin, minEteintHuit.trace.appariement.validationFinale], [true, false],
    'minimum RES 8, toggle éteint : la part propre (8) ne le franchit pas');
  const minTrop = pairBucketsSeul(req({ res: 17 }, {}, true), TOLERANCE);
  egal(minTrop.trace.appariement.validationFinale, false, 'minimum RES 17 : non franchi, aucun double compte');
}

/* --------------------------------------------------------------------------
 * 6bis-b4 — la carte de résultat affiche le chiffre qui CLASSE. Constat hérité
 * de b2 : la carte « Dégâts réels » omettait la Conquête de la relique
 * retenue, que le tri compte ; « PV effectifs » omettait de même Ténacité et
 * points Bravoure/Éternité/Origine. Les deux cartes passent désormais par
 * `scoreDuCandidat`, la fonction même du tri.
 * ----------------------------------------------------------------------- */

export function testAurasCarteEgaleTri() {
  titre('Cartes de résultat · le chiffre affiché est celui du tri (Conquête, Ténacité)');
  const competence: Competence = { id: 1, com2usId: 1, nom: 'Test', description: null,
    slot: 1, passif: false, aoe: false, cooldown: null, coups: 1, niveauMax: 1,
    formule: '3.0*{ATK}', scale: [], ameliorations: [], icone: null, effets: [] };
  const actif = skillDamageProfile(competence);
  if (!actif || !estPrisEnCharge(actif)) throw new Error('profil synthétique non calculable');
  const setup = avecExternes({ fight: 3 });
  const realDamage: RealDamageContext = { profile: actif, passifs: [], setup, element: null, artefacts: ARTIFACT_DAMAGE_NEUTRE,
    critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {}, bonusDegatsConditionnel: null,
    bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null };
  // A : ATQ +63 % en principale, relique sans exclusive. B : aucune ATQ, mais
  // 2 Fight propres et une relique Conquête retenue (tranche 10, 5 %).
  const runesA = [1, 2, 3, 4, 5, 6].map((slot) => rune(9300 + slot, slot, slot === 2 ? [4, 63] : [8, 0]));
  const runesB = runesDeSets(9400, ['fight', 'fight', 'fight', 'fight', 'will', 'will']);
  const cA: BuildCandidate = { runeIds: runesA.map((r) => r.id), stats: computeStats({ base: BASE, runes: runesA, artifacts: [] }), effTotal: 0 };
  const cB: BuildCandidate = { runeIds: runesB.map((r) => r.id), stats: computeStats({ base: BASE, runes: runesB, artifacts: [] }), effTotal: 0 };
  const aurasPropresDe = aurasPropresParRunes(new Map([...runesA, ...runesB].map((r) => [r.id, r])));
  const conquete: RelicDetail = { id: 1, upgrade: 9, main: { code: 101, value: 0 }, unique: { type: 1, tranche: 10, percent: 5 } };
  const apportB = apportExclusive(conquete, cB.stats, setup, aurasPropresDe(cB));
  ok(apportB.dmgPct > 0, `Conquête de B : +${apportB.dmgPct} % de dégâts (Y = ATQ de combat, 3 externes + 2 propres)`);
  const opts = { realDamage, damageSetup: setup, aurasPropresDe,
    exclusiveDuBuild: (c: BuildCandidate) => (c === cB ? apportB : null) };

  // Le constat, tel qu'il était : l'ancienne formule de la carte.
  const ancienneCarte = (c: BuildCandidate) => computeTotalDamage(actif, [], c.stats, setup, aurasPropresDe(c), null, ARTIFACT_DAMAGE_NEUTRE,
    false, null, null, {}, null, null, null, null);
  const tri = sortCandidates([cA, cB], 'degats_reels', opts);
  egal(tri.map((c) => c.runeIds), [cB.runeIds, cA.runeIds], 'tri : B passe devant grâce à sa Conquête');
  ok(ancienneCarte(cB) < ancienneCarte(cA),
    `constat confirmé : l'ancienne carte affichait ${Math.round(ancienneCarte(cB))} sur B, au-dessus de ${Math.round(ancienneCarte(cA))} sur A`);
  egal(scoreDuCandidat(cB, 'degats_reels', opts), objectiveScore(cB, 'degats_reels', aurasPropresDe(cB), realDamage, apportB),
    'scoreDuCandidat(B) = objectiveScore avec la Conquête retenue');
  ok(scoreDuCandidat(cB, 'degats_reels', opts)! > scoreDuCandidat(cA, 'degats_reels', opts)!,
    'le chiffre affiché suit le rang : B au-dessus de A');
  egal(scoreDuCandidat(cA, 'degats_reels', opts), ancienneCarte(cA), 'sans exclusive, la carte ne change pas (A)');

  // PV effectifs : Ténacité (type 6, sur les PV) — terme de Réductions.
  const tenace: RelicDetail = { id: 2, upgrade: 9, main: { code: 100, value: 0 }, unique: { type: 6, tranche: 100, percent: 2 } };
  const apportT = apportExclusive(tenace, cA.stats, setup, aurasPropresDe(cA));
  ok(apportT.reductionPct > 0, `Ténacité de A : ${apportT.reductionPct} % de réduction`);
  const optsEhp = { damageSetup: setup, aurasPropresDe, exclusiveDuBuild: (c: BuildCandidate) => (c === cA ? apportT : null) };
  ok(pvEffectifs(cA.stats, aurasPropresDe(cA), setup) !== scoreDuCandidat(cA, 'ehp', optsEhp),
    'constat PV effectifs : l’ancienne carte (pvEffectifs seul) omettait la Ténacité que le tri compte');
  egal(scoreDuCandidat(cA, 'ehp', optsEhp), objectiveScore(cA, 'ehp', aurasPropresDe(cA), undefined, apportT, setup),
    'scoreDuCandidat(A, ehp) = objectiveScore avec la Ténacité');
  egal(scoreDuCandidat(cB, 'ehp', optsEhp), pvEffectifs(cB.stats, aurasPropresDe(cB), setup),
    'sans exclusive, PV effectifs inchangés (B)');
  egal(scoreDuCandidat(cA, 'degats_reels', { damageSetup: setup, aurasPropresDe }), null, 'sans contexte de dégâts : null, comme le tri');

  // L'écran : les deux cartes lisent `scoreDuCandidat`, plus de formule recopiée.
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/degatsReels=\{[\s\S]{0,700}?scoreDuCandidat\(c, 'degats_reels'/.test(ecran), 'écran : la carte « Dégâts réels » lit scoreDuCandidat');
  ok(/pvEffectifs:\s*[\s\S]{0,300}?scoreDuCandidat\(c, 'ehp'/.test(ecran), 'écran : la carte « PV effectifs » lit scoreDuCandidat');
  ok(!/computeTotalDamage\(\s*realDamage\.profile,\s*realDamage\.passifs,\s*c\.stats/.test(ecran),
    'écran : plus de computeTotalDamage recopié sur les stats du candidat');
}

/* --------------------------------------------------------------------------
 * 6bis-b4 — le MÊME build par les constructeurs de l'écran et du CLI, le
 * Worker séquentiel (préparation sur le message cloné, comme `postMessage`)
 * et l'appariement PARALLÈLE de production : `driveParallelPairing` + vrais
 * `worker_threads` exécutant `runPairSlice` (`scripts/lib/pair-slice-worker.ts`).
 * ⚠️ FIDÉLITÉ : DIVERGE DE LA PROD — sur ce petit pool, `totalPairCount` est
 * sous le seuil de 100 M : la production choisirait le séquentiel, le
 * parallèle est FORCÉ ici. Le cas réel au-dessus du seuil est la recette
 * gelée `recette-6bis-degats.json` (preuve privée de 6bis-b4).
 * ----------------------------------------------------------------------- */

export async function testAurasPariteRegimes() {
  titre('Auras · même build : écran/CLI, Worker séquentiel, parallèle forcé (vrais worker_threads)');
  const rng = mulberry32(6400);
  const MAINS: Record<number, [number, number]> = { 1: [3, 160], 2: [4, 63], 3: [5, 160], 4: [10, 80], 5: [1, 2448], 6: [4, 63] };
  const pool: RuneDetail[] = [];
  for (let slot = 1; slot <= 6; slot++) {
    const sets = ['fight', 'fight', 'rage', 'rage', 'will', ...(slot === 3 ? ['intangible'] : []), ...(slot === 5 ? ['tolerance'] : [])];
    sets.forEach((set, i) => pool.push(rune(20000 + slot * 10 + i, slot, MAINS[slot],
      [[4, 5 + Math.floor(rng() * 20)], [10, 5 + Math.floor(rng() * 20)], [9, Math.floor(rng() * 10)]], set)));
  }
  const intangible = pool.find((r) => r.set === 'intangible')!.id;
  const setup = avecExternes({ fight: 3 });
  const r = buildOptimizerRecipe({
    monsterCom2usId: 13413, monsterName: 'Lushen',
    requirement: { sets: [], minStats: {} }, objective: 'degats_reels', damageSetup: setup,
    compterAurasResPre: true, metric: 'eff', slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false, exhaustiveSearch: true,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: true, artifactMainByKind: {},
  });
  const loaded: LoadedMonster = { unitId: 1, com2usId: 13413, monsterName: 'Lushen',
    gear: { base: { hp: 9225, atk: 900, def: 461, spd: 103, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] },
    allRunes: pool, allArtifacts: [], allRelics: [] };

  // Constructeurs : le CLI (`recipeToSearchParams`) et ceux de l'écran.
  const params = recipeToSearchParams(r, loaded);
  egal(params.requirement, avecAurasConditions(r.requirement, setup, true), 'conditions : CLI = écran (avecAurasConditions)');
  ok(params.objective === 'degats_reels' && (params.objectiveStats ?? []).includes('atk'),
    `objectif et stats d'objectif transmis : ${params.objective} [${(params.objectiveStats ?? []).join(', ')}]`);

  // Worker séquentiel : la préparation reçoit le message CLONÉ.
  const message = structuredClone(params);
  const issue = prepareOrRefuse(message);
  if (issue.kind !== 'prepared') throw new Error(`préparation : ${issue.kind}`);
  const prepared = issue.prepared;
  const bucketsA = drain(buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode));
  const bucketsB = drain(buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB, undefined, params.adaptiveTrancheWeighting, params.combosOrderMode));
  const totalPairs = totalPairCount(prepared, bucketsA, bucketsB);
  ok(totalPairs < PARALLEL_PAIRING_THRESHOLD,
    `FIDÉLITÉ : DIVERGE DE LA PROD — ${totalPairs} paires < ${PARALLEL_PAIRING_THRESHOLD} : parallèle FORCÉ, ${Math.min(4, bucketsA.length)} tranches`);
  ok(Math.min(4, bucketsA.length) >= 2, 'au moins deux tranches : le découpage est réellement exercé');
  const sequentiel = drain(pairBuckets(prepared, bucketsA, bucketsB));
  const cli = runSearchToCompletion(params);
  const bundle = await ensurePairSliceBundle();
  const parallele = await driveParallelPairing(makeSpawnSliceNode(bundle), message, prepared, bucketsA, bucketsB, totalPairs, () => {}, prepared.startedAt);
  ok(!sequentiel.truncated && !parallele.truncated && !cli.truncated,
    `trois recherches complètes (truncated=false) : ${sequentiel.candidates.length} candidats`);
  const cles = (res: { candidates: BuildCandidate[] }) => res.candidates.map(cleBuild).sort();
  egal(cles(parallele), cles(sequentiel), 'parallèle (worker_threads) = Worker séquentiel : mêmes builds');
  egal(cles(cli), cles(sequentiel), 'CLI (runSearchToCompletion) = Worker séquentiel : mêmes builds');

  // Legs de b3b : chaque tranche relance `prepareSearch` sur SES paramètres.
  const tranche = structuredClone({ ...params, maxCollected: Math.ceil(prepared.maxCollected / Math.min(4, bucketsA.length)) });
  const apresDominance = (p: typeof params) => {
    let ids: number[][] = [];
    prepareSearch(p, (etage, listes) => { if (etage === 'dominance') ids = listes.map((l) => l.map((x) => x.id)); });
    return ids;
  };
  egal(apresDominance(tranche), apresDominance(params), 'dominance : même pool côté principal et côté tranche');
  const interchangeables = (p: typeof params) => [...contexteDominance(p.requirement, p.pool, p.objective, p.objectiveStats, reliquesEquipables(p.relic, p.relicContext),
    statsLuesParLesLignes(p.objective, p.artifacts, p.statsLignesArtefactsEquipables)).interchangeables].sort();
  egal(interchangeables(tranche), interchangeables(params), 'contexteDominance : mêmes objective/objectiveStats, même contexte');

  // Scores : même classement des deux côtés, auras externes + propres.
  const realDamage = buildRealDamageContext(r, 13413, params.artifacts);
  if (!realDamage) throw new Error('Lushen : sort non calculable');
  const aurasPropresDe = aurasPropresParRunes(new Map(pool.map((x) => [x.id, x])));
  const opts = { realDamage, damageSetup: setup, aurasPropresDe };
  const triSeq = sortCandidates(sequentiel.candidates, 'degats_reels', opts);
  const triPar = sortCandidates(parallele.candidates, 'degats_reels', opts);
  egal(cleBuild(triPar[0]), cleBuild(triSeq[0]), 'même meilleur build dans les deux régimes');
  egal(scoreDuCandidat(triPar[0], 'degats_reels', opts), scoreDuCandidat(triSeq[0], 'degats_reels', opts), 'même score du meilleur build');
  for (const n of [1, 2, 3]) {
    const c = triSeq.find((x) => aurasPropresDe(x).fight === n);
    if (!c) { ok(false, `un build à ${n} Fight propre(s) existe`); continue; }
    egal(nombreAuraEffectif(setup, aurasPropresDe(c), 'fight'), 3 + n, `${n} Fight propre(s) : 3 externes + ${n} = ${3 + n}`);
    ok(scoreDuCandidat(c, 'degats_reels', opts)! > objectiveScore(c, 'degats_reels', AUCUNE_AURA_PROPRE, realDamage),
      `${n} Fight propre(s) : le score les compte (plus haut que sans aura propre)`);
    egal(scoreDuCandidat(triPar.find((x) => cleBuild(x) === cleBuild(c))!, 'degats_reels', opts), scoreDuCandidat(c, 'degats_reels', opts),
      `${n} Fight propre(s) : même score dans le résultat parallèle`);
  }
  const joker = triSeq.find((x) => x.runeIds.includes(intangible) && aurasPropresDe(x).fight === 1
    && x.runeIds.filter((id) => pool.find((p) => p.id === id)!.set === 'fight').length === 1);
  ok(joker != null, 'Intangible : un build à une seule rune Fight active Fight grâce au joker');
  if (joker) egal(scoreDuCandidat(joker, 'degats_reels', opts), objectiveScore(joker, 'degats_reels', vecteur({ fight: 1 }), realDamage),
    'Intangible : score avec 1 Fight propre');
}
