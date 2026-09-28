import { egal, ok, titre } from './outils';
import { computeStats, statsParPaire } from '../src/lib/stats';
import { ARTIFACT_DAMAGE_NEUTRE, DEFAULT_DAMAGE_SETUP, computeSkillDamage, computeTotalDamage, degatsBrutsArtefactsParCoup, estPrisEnCharge, nombreAura, skillDamageProfile, statsDebutCombat } from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { apportExclusive } from '../src/lib/relicExclusive';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { avecAurasConditions, conditionsPaireFixePosees, diagnoseFeasibility, objectiveScore, pvEffectifs, respecteConditionsAvecRelique, respecteConditionsPaireFixe, respecteMinEtMax, searchBuilds, sortCandidates } from '../src/lib/runeBuildOptim';
import { signatureArtefacts } from '../src/lib/artifactQueue';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { runeEfficiency } from '../src/lib/effects';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import type { Competence } from '../src/lib/monsterSkills';
import type { BaseStats, RelicDetail } from '../src/types';

const BASE: BaseStats = { hp: 1001, atk: 101, def: 101, spd: 100, cr: 15, cd: 50, res: 0, acc: 0 };
const STATS = computeStats({ base: BASE, runes: [], artifacts: [] });
const SETUP = { ...DEFAULT_DAMAGE_SETUP, setsAuraExternes: [
  { set: 'fight' as const, nombre: 2 }, { set: 'determination' as const, nombre: 1 },
  { set: 'enhance' as const, nombre: 1 }, { set: 'accuracy' as const, nombre: 1 },
  { set: 'tolerance' as const, nombre: 1 },
] };

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
  const combat = statsDebutCombat(STATS, SETUP);
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
  ok(computeSkillDamage(sort, STATS, SETUP, null) >
    computeSkillDamage(sort, STATS, DEFAULT_DAMAGE_SETUP, null), 'dégâts du sort augmentés');
  const relic: RelicDetail = { id: 1, upgrade: 9, main: { code: 101, value: 0 }, unique: { type: 1, tranche: 130, percent: 1 } };
  ok(apportExclusive(relic, STATS, SETUP, null).dmgPct > apportExclusive(relic, STATS, DEFAULT_DAMAGE_SETUP, null).dmgPct,
    'exclusive : l’assiette Y contient Fight');
}

export function testAurasArrondiCommunLeadInvocateur() {
  titre('Auras · PV/ATQ/DEF : lead + invocateur + aura, un seul ceil');
  // Attentes fixées par le contrat, avant l'appel au moteur : 20 + 13 + 8 = 41 %
  // de la base. Trois ceil séparés donneraient 1414, 145 et 147.
  const cas = [
    { stat: 'HP' as const, key: 'hp' as const, base: 1001, attendu: 1412, arrondisSepares: 1414 },
    { stat: 'Attack Power' as const, key: 'atk' as const, base: 101, attendu: 143, arrondisSepares: 145 },
    { stat: 'Defense' as const, key: 'def' as const, base: 103, attendu: 146, arrondisSepares: 147 },
  ];
  const base: BaseStats = { ...BASE, def: 103 };
  const stats = computeStats({ base, runes: [], artifacts: [] });
  const setsAuraExternes = [
    { set: 'enhance' as const, nombre: 1 },
    { set: 'fight' as const, nombre: 1 },
    { set: 'determination' as const, nombre: 1 },
  ];
  for (const { stat, key, base: valeurBase, attendu, arrondisSepares } of cas) {
    const setup = { ...DEFAULT_DAMAGE_SETUP, leaderSkill: { stat, pct: 13 }, setsAuraExternes };
    ok(attendu !== arrondisSepares, `${key} : la base ${valeurBase} distingue les deux règles d'arrondi`);
    egal(statsDebutCombat(stats, setup)[key], attendu, `${key} : 20 % invocateur + 13 % lead + 8 % aura, un ceil`);
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
      evaluer: evaluerPourRegime('ehp', statsParPaire({ ...gear, relic: relique }), { relique, setup, element: null }),
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
  const sans = computeTotalDamage(actif, p, STATS, DEFAULT_DAMAGE_SETUP) - computeSkillDamage(actif, STATS, DEFAULT_DAMAGE_SETUP);
  const avec = computeTotalDamage(actif, p, STATS, SETUP) - computeSkillDamage(actif, STATS, SETUP);
  ok(avec > sans, 'le passif proportionnel aux PV reçoit Enhance');
  const ligne = { ...ARTIFACT_DAMAGE_NEUTRE, brutPctDef: 10 };
  ok(degatsBrutsArtefactsParCoup(STATS, SETUP, null, ligne) >
    degatsBrutsArtefactsParCoup(STATS, DEFAULT_DAMAGE_SETUP, null, ligne),
    'la ligne additionnelle proportionnelle à la DEF reçoit Determination');
}

export function testAurasEhpEtConditions() {
  titre('Auras · EHP et conditions min/max RES/PRE seulement');
  ok(pvEffectifs(STATS, SETUP) > pvEffectifs(STATS), 'EHP inclut Enhance et Determination');
  const candidat = { runeIds: [], stats: STATS, effTotal: 0 };
  egal(objectiveScore(candidat, 'ehp', undefined, undefined, SETUP), pvEffectifs(STATS, SETUP), 'score EHP identique à la comparaison');
  egal(evaluerPourRegime('ehp', () => STATS, { relique: undefined, setup: SETUP, element: null })([]), pvEffectifs(STATS, SETUP),
    'choix de paire EHP sur les stats avec aura');
  const actif = avecAurasConditions({ sets: [], minStats: { res: 8, acc: 8 }, maxStats: { res: 8, acc: 8 } }, SETUP, true);
  ok(respecteMinEtMax(STATS, actif), 'min et max RES/PRE franchis à partir de zéro');
  const inactif = avecAurasConditions(actif, SETUP, false);
  ok(!respecteMinEtMax(STATS, inactif), 'toggle désactivé : min RES/PRE non franchis');
  ok(pvEffectifs(STATS, SETUP) > pvEffectifs(STATS), 'toggle désactivé : EHP reste augmenté');
  const tropBas = avecAurasConditions({ sets: [], minStats: {}, maxStats: { res: 7, acc: 7 } }, SETUP, true);
  ok(!respecteMinEtMax(STATS, tropBas), 'max RES/PRE dépassés');
  const physiques = avecAurasConditions({ sets: [], minStats: { atk: 102 }, maxStats: {} }, SETUP, true);
  ok(!respecteMinEtMax(STATS, physiques), 'Fight reste hors des conditions ATQ');
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
  ok(conditionsPaireFixePosees(maximum) && !respecteConditionsPaireFixe(STATS, maximum),
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
  const params = recipeToSearchParams(r, loaded);
  egal(params.requirement.auraResPre, avecAurasConditions(r.requirement, r.damageSetup, true).auraResPre,
    'CLI et écran construisent les mêmes bonus de condition');
  egal(recipeToSearchParams({ ...r, compterAurasResPre: false }, loaded).requirement.auraResPre, { res: 0, acc: 0 },
    'CLI désactivé : les deux conditions sont hors aura');
  egal(recipeToSearchParams({ ...r, compterAurasResPre: undefined }, loaded).requirement.auraResPre, { res: 8, acc: 8 },
    'ancienne recette : le défaut de condition est activé');
  const deux = [
    { runeIds: [1], stats: STATS, effTotal: 1 },
    { runeIds: [2], stats: STATS.map((s) => s.key === 'hp' ? { ...s, total: s.total + 1 } : s), effTotal: 2 },
  ];
  egal(sortCandidates(deux, 'ehp', { damageSetup: SETUP })[0].runeIds, [2], 'tri EHP avec aura');
  const signature = (compterAurasResPre: boolean) => signatureArtefacts({ monstreCom2usId: 1, damageSetup: SETUP,
    compterAurasResPre, regimeEquipement: 'ehp', ignoreArtifacts: false, principaleParSorte: {},
    lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null,
    requirement: { minStats: { res: 8 }, maxStats: {} } });
  ok(signature(true) !== signature(false), 'le toggle invalide le cache');
  ok(signatureArtefacts({ monstreCom2usId: 1, damageSetup: { ...SETUP, setsAuraExternes: [] },
    compterAurasResPre: true, regimeEquipement: 'ehp', ignoreArtifacts: false, principaleParSorte: {},
    lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null,
    requirement: { minStats: { res: 8 }, maxStats: {} } }) !== signature(true), 'la liste invalide le cache');
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
