// Bornes strictes (degats-et-aura 15d, damage.ts) : Jaara et Varus comparent
// la DEF de la cible STRICTEMENT, Copper et Guard Crush restant inclusifs
// (drapeau `inclusif` par entrée).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un critique compté (ou retiré) en
// mode « Non critique », qui change le classement des builds sans rien
// afficher d'anormal. Une entrée curée n'est protégée que par son test
// (skill game-data-curation § 8) : chaque identifiant a son témoin réel.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import {
  AUCUNE_AURA_PROPRE,
  ARTIFACT_DAMAGE_NEUTRE,
  ConditionCombatProfile,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  estPrisEnCharge,
  monsterConditionsCombat,
  monsterDamageSkills,
  statsDeCombat,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BuildCandidate, objectiveScore } from '../src/lib/runeBuildOptim';
import { StatKey } from '../src/lib/effects';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(forme: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${forme}.json`), 'utf8'));
}

function profilDe(forme: number, sort: number): SkillDamageProfile {
  const trouve = monsterDamageSkills(fiche(forme)).find((p) => p.skillCom2usId === sort);
  if (!trouve || !estPrisEnCharge(trouve)) throw new Error(`Profil ${forme}/${sort} introuvable`);
  return trouve;
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

const build = stats({ hp: 20000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 });
const candidat = { stats: build, effTotal: 0 } as unknown as BuildCandidate;
const base: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  enemyDef: 1000,
  enemyHp: 1_000_000,
  enemyHpPct: 100,
  critMode: 'normal',
  summonerSkills: 'combat',
};

// Le chemin du moteur : recette → contexte du CLI → `objectiveScore`.
function contexte(forme: number, setup: DamageSetup) {
  const recette = buildOptimizerRecipe({
    monsterCom2usId: forme,
    monsterName: String(forme),
    requirement: { sets: [], minStats: {} },
    objective: 'degats_reels',
    damageSetup: setup,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'rta',
    excludedSelectors: [],
    ignoreArtifacts: true,
    artifactMainByKind: {},
  });
  const ctx = buildRealDamageContext(recette, forme, []);
  if (!ctx) throw new Error(`contexte ${forme} introuvable`);
  return { recette, ctx };
}

function score(forme: number, setup: DamageSetup): number {
  return objectiveScore(candidat, 'degats_reels', AUCUNE_AURA_PROPRE, contexte(forme, setup).ctx);
}

export function testBornesStrictesDef() {
  titre('Bornes de DEF — strictes pour Jaara et Varus, inclusives pour Copper et Guard Crush (degats-et-aura 15d)');

  // Chaque entrée du corpus qui compare la DEF de la cible doit être
  // classée ici, sa borne lue dans SA prose. Une entrée nouvelle fait
  // échouer ce test tant qu'on ne l'a pas lue.
  const ATTENDU: Record<number, boolean> = { 2565: false, 3216: false, 7763: true, 15907: true, 15908: true, 15910: true };
  const vus: Record<number, boolean> = {};
  const relever = (id: number, c: ConditionCombatProfile) => {
    if (c.type === 'defCibleSousDefPropre' || c.type === 'defCibleSousAtkPropre') vus[id] = c.inclusif === true;
  };
  for (const f of readdirSync(DOSSIER_SORTS)) {
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    for (const p of monsterDamageSkills(d)) {
      if (!estPrisEnCharge(p)) continue;
      for (const c of p.conditionsCombat ?? []) relever(p.skillCom2usId, c);
    }
    for (const p of monsterConditionsCombat(d)) relever(p.skillCom2usId, p.condition);
  }
  egal(vus, ATTENDU, 'corpus : six entrées comparent la DEF de la cible, chacune avec la borne de sa prose');

  // Jaara (3216) : « with Defense lower than your Attack Power ».
  const { ctx: ctxJaara } = contexte(14515, { ...base, skillCom2usId: null });
  const atkJaara = statsDeCombat(build, base, AUCUNE_AURA_PROPRE, ctxJaara.element, ARTIFACT_DAMAGE_NEUTRE,
    { combatStats: ctxJaara.monsterWide.combatStats }).atk;
  const jaara = (def: number, critMode: DamageSetup['critMode'] = 'normal') =>
    score(14515, { ...base, skillCom2usId: null, enemyDef: def, critMode });
  ok(jaara(atkJaara) < jaara(atkJaara, 'crit'), '3216 Jaara — DEF cible égale à son ATQ : aucune garantie');
  egal(jaara(atkJaara - 1), jaara(atkJaara - 1, 'crit'), '3216 Jaara — DEF cible sous son ATQ : critique garanti');

  // Varus (2565) : « who has lower Defense than yours ».
  const { ctx: ctxVarus } = contexte(11535, { ...base, skillCom2usId: null });
  const defVarus = statsDeCombat(build, base, AUCUNE_AURA_PROPRE, ctxVarus.element, ARTIFACT_DAMAGE_NEUTRE,
    { combatStats: ctxVarus.monsterWide.combatStats }).def;
  const varus = (def: number, critMode: DamageSetup['critMode'] = 'normal') =>
    score(11535, { ...base, skillCom2usId: null, enemyDef: def, critMode });
  ok(varus(defVarus) < varus(defVarus, 'crit'), '2565 Varus — DEF cible égale à sa DEF de combat : aucune garantie');
  egal(varus(defVarus - 1), varus(defVarus - 1, 'crit'), '2565 Varus — DEF cible sous sa DEF de combat : critique garanti');

  // Copper (« half or lower ») et Guard Crush (« 60% or less ») : l'égalité
  // ignore toujours la DEF.
  const copper = profilDe(16533, 7763);
  ok(computeSkillDamage(copper, build, { ...base, enemyDef: 400 }, AUCUNE_AURA_PROPRE) >
    computeSkillDamage(copper, build, { ...base, enemyDef: 401 }, AUCUNE_AURA_PROPRE),
    '7763 Copper — égalité à la moitié de sa DEF : ignore DEF (inclusif, inchangé)');
  for (const [forme, sort] of [[26112, 15907], [26113, 15908], [26115, 15910]]) {
    const gc = profilDe(forme, sort);
    ok(computeSkillDamage(gc, build, { ...base, enemyDef: 600 }, AUCUNE_AURA_PROPRE) >
      computeSkillDamage(gc, build, { ...base, enemyDef: 601 }, AUCUNE_AURA_PROPRE),
      `${sort} Guard Crush — égalité à 60 % de son ATQ : ignore DEF (inclusif, inchangé)`);
  }
}

// L'écran se lit sur la source (le dépôt ne monte pas de composants React).
function carte(): string {
  return readFileSync(resolve(racine, 'src/components/outils/DamageSetupCard.tsx'), 'utf8').replace(/\r\n/g, '\n');
}

export function testResumeConditionDef() {
  titre('Résumé des comparaisons de DEF — effet et borne lus sur l’entrée (DamageSetupCard.tsx, degats-et-aura 15d)');
  const source = carte();
  ok(/function effetCondition\(/.test(source), 'un seul producteur de l’effet d’une condition');
  ok(source.includes("if (condition.critiqueGaranti) return 'critique garanti';"),
    'critique garanti lu sur l’entrée (Jaara, Varus disaient « ignore DEF »)');
  ok(source.includes("return `${effetCondition(condition)} si la DEF cible ${condition.inclusif ? '≤' : '<'} ${condition.ratio}× ta DEF`;") &&
    source.includes("return `${effetCondition(condition)} si la DEF cible ${condition.inclusif ? '≤' : '<'} ${condition.ratio}× ton ATQ`;"),
    'comparaisons de DEF : effet et borne (≤ ou <) lus sur l’entrée');
  ok(!source.includes('`ignore DEF si la DEF cible ≤'), 'plus de texte de comparaison de DEF figé sur « ignore DEF » et « ≤ »');
}
