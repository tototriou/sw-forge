import { egal, ok, titre } from './outils';
import { computeStats } from '../src/lib/stats';
import { ARTIFACT_DAMAGE_NEUTRE, DEFAULT_DAMAGE_SETUP, computeSkillDamage, computeTotalDamage, degatsBrutsArtefactsParCoup, estPrisEnCharge, skillDamageProfile, statsDebutCombat } from '../src/lib/damage';
import { apportExclusive } from '../src/lib/relicExclusive';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { avecAurasConditions, conditionsPaireFixePosees, diagnoseFeasibility, objectiveScore, pvEffectifs, respecteConditionsAvecRelique, respecteConditionsPaireFixe, respecteMinEtMax, searchBuilds, sortCandidates } from '../src/lib/runeBuildOptim';
import { signatureArtefacts } from '../src/lib/artifactQueue';
import { recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { mulberry32, randomPool } from '../scripts/lib/randomPool';
import { runeEfficiency } from '../src/lib/effects';
import type { LoadedMonster } from '../scripts/lib/loadMonster';
import type { Competence } from '../src/lib/monsterSkills';
import type { BaseStats, RelicDetail } from '../src/types';

const BASE: BaseStats = { hp: 1001, atk: 101, def: 101, spd: 100, cr: 15, cd: 50, res: 0, acc: 0 };
const STATS = computeStats({ base: BASE, runes: [], artifacts: [] });
const SETUP = { ...DEFAULT_DAMAGE_SETUP, setsAura: [
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
  titre('Auras · recette, 18 acceptés, 19 refusés et ancien format');
  const r = recette();
  const lire = (value: unknown) => parseOptimizerRecipe(JSON.stringify(value));
  egal(lire({ ...r, damageSetup: { ...SETUP, setsAura: [{ set: 'fight', nombre: 18 }] } }).recipe?.damageSetup.setsAura,
    [{ set: 'fight', nombre: 18 }], '18 sets d’un type acceptés');
  ok(lire({ ...r, damageSetup: { ...SETUP, setsAura: [{ set: 'fight', nombre: 10 }, { set: 'accuracy', nombre: 8 }] } }).recipe !== null,
    '18 sets répartis acceptés');
  ok(!!lire({ ...r, damageSetup: { ...SETUP, setsAura: [{ set: 'fight', nombre: 10 }, { set: 'accuracy', nombre: 9 }] } }).error?.includes('damageSetup.setsAura'),
    '19 sets répartis refusés avec chemin');
  for (const invalide of [[{ set: 'fight', nombre: 0 }], [{ set: 'fight', nombre: 1.5 }], [{ set: 'inconnu', nombre: 1 }],
    [{ set: 'fight', nombre: 1 }, { set: 'fight', nombre: 1 }], 'fight']) {
    ok(!!lire({ ...r, damageSetup: { ...SETUP, setsAura: invalide } }).error?.includes('damageSetup.setsAura'),
      'aura mal typée, hors bornes ou répétée refusée avec chemin');
  }
  ok(!!lire({ ...r, compterAurasResPre: 'oui' }).error?.includes('compterAurasResPre'), 'toggle mal typé refusé avec chemin');
  const ancien = JSON.parse(JSON.stringify(r));
  delete ancien.damageSetup.setsAura;
  delete ancien.compterAurasResPre;
  ok(lire(ancien).recipe !== null, 'ancienne recette acceptée');
  egal(lire(r).recipe?.damageSetup.setsAura, SETUP.setsAura, 'aller-retour de la liste de sets');
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
  ok(signatureArtefacts({ monstreCom2usId: 1, damageSetup: { ...SETUP, setsAura: [] },
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
