// Garanties de critique et bornes strictes (degats-et-aura 15d, damage.ts) :
//   - Byungchul : la garantie de son passif 18613 sur ses deux sorts actifs
//     (`CRITIQUES_GARANTIS_INCONDITIONNELS`) ;
//   - Yuji et Rick (S2) : critique garanti contre une cible affligée, et sur
//     le coup 2 quand la réduction de DEF du coup 1 est posée (scénario des
//     poses entre les coups) ;
//   - Jaara et Varus : comparaison de DEF STRICTE, Copper et Guard Crush
//     restant inclusifs (drapeau `inclusif` par entrée).
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
  critiqueGarantiParReglage,
  estPrisEnCharge,
  monsterConditionsCombat,
  monsterDamageSkills,
  statsDeCombat,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
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

export function testGarantieByungchul() {
  titre('Byungchul — la garantie du passif 18613 sur S1 et S2 (degats-et-aura 15d)');
  const prose = fiche(28913).competences.find((c) => c.com2usId === 18613)?.description ?? '';
  ok(prose.includes('Your attacks will always land as a Critical Hit whenever you attack the enemy'),
    '18613 — la prose du passif porte la garantie sans condition');
  const actifs = monsterDamageSkills(fiche(28913)).filter(estPrisEnCharge);
  egal(actifs.map((p) => p.skillCom2usId).sort((a, b) => a - b), [18603, 18608],
    'Byungchul — deux sorts calculés, S1 18603 et S2 18608');
  for (const p of actifs) {
    ok(p.critiqueGaranti === true, `${p.skillCom2usId} — critique garanti (source : passif 18613)`);
    ok(critiqueGarantiParReglage(p, base), `${p.skillCom2usId} — « Non critique » neutralisé à l'écran`);
    egal(
      computeSkillDamage(p, build, base, AUCUNE_AURA_PROPRE, 'wind'),
      computeSkillDamage(p, build, { ...base, critMode: 'crit' }, AUCUNE_AURA_PROPRE, 'wind'),
      `${p.skillCom2usId} — en « Non critique », le total vaut celui de « Critique »`
    );
  }
  egal(score(28913, { ...base, skillCom2usId: 18608 }), score(28913, { ...base, skillCom2usId: 18608, critMode: 'crit' }),
    '18608 — moteur : même score en « Non critique » et en « Critique »');
}

// Forme jouable → identifiant de S2. Écrite à la main, jamais dérivée de la
// table : c'est ce qui fait échouer le test quand une ligne disparaît.
const YUJI_RICK: [number, number, string][] = [
  [30412, 20107, 'Yuji feu'],
  [30413, 20108, 'Yuji vent'],
  [30415, 20110, 'Yuji ténèbres'],
  [31012, 20707, 'Rick feu'],
  [31013, 20708, 'Rick vent'],
  [31015, 20710, 'Rick ténèbres'],
];

export function testGarantieYujiRick() {
  titre('Yuji et Rick (S2) — critique garanti contre une cible affligée, coup 2 après la réduction de DEF (degats-et-aura 15d)');
  for (const [forme, sort, nom] of YUJI_RICK) {
    const p = profilDe(forme, sort);
    const c = fiche(forme).competences.find((x) => x.com2usId === sort)!;
    ok(c.description?.includes('the Critical Rate increases to 100% when attacking an enemy with harmful effects') === true &&
      c.description.includes('The first hit decreases its Defense'),
      `${sort} ${nom} — la prose porte la garantie et la réduction de DEF du coup 1`);
    egal(p.conditionsCombat, [{ type: 'debuffCiblePresent', critiqueGaranti: true }],
      `${sort} ${nom} — condition « débuff sur la cible » qui garantit le critique`);
    egal(p.effetsEntreCoups, [{ id: 'decrease-def', label: 'Réduction de DEF', cumulable: false, effetCombat: 'defBreak' }],
      `${sort} ${nom} — réduction de DEF posable entre les coups, comptée comme débuff ET comme Brise DEF pour le coup 2 (décision du 2026-10-03)`);

    const element = forme % 10 === 2 ? 'fire' : forme % 10 === 3 ? 'wind' : 'dark';
    const total = (s: Partial<DamageSetup>) =>
      computeSkillDamage(p, build, { ...base, skillCom2usId: sort, ...s }, AUCUNE_AURA_PROPRE, element);
    const unCoup: SkillDamageProfile = { ...p, hits: 1, hitsRange: undefined, effetsEntreCoups: undefined, conditionsCombat: undefined };
    const coup1 = computeSkillDamage(unCoup, build, base, AUCUNE_AURA_PROPRE, element);
    const coup2Crit = computeSkillDamage(unCoup, build, { ...base, critMode: 'crit' }, AUCUNE_AURA_PROPRE, element);
    const coup2CritDefReduite = computeSkillDamage(unCoup, build, { ...base, critMode: 'crit', defBreak: true }, AUCUNE_AURA_PROPRE, element);
    const scenario = (apres: number | null) => ({
      scenariosEffetsEntreCoups: { [sort]: { actif: true, apresCoup: { 'decrease-def': apres } } },
    });
    egal(total({}), 2 * coup1, `${sort} ${nom} — sans débuff ni scénario : deux coups non critiques en « Non critique »`);
    egal(total(scenario(null)), 2 * coup1, `${sort} ${nom} — scénario sans réussite : rien n'est supposé`);
    egal(total(scenario(1)), coup1 + coup2CritDefReduite,
      `${sort} ${nom} — réduction de DEF posée après le coup 1 : le coup 2 devient critique ET subit la DEF réduite`);
    ok(coup2CritDefReduite > coup2Crit,
      `${sort} ${nom} — la DEF réduite du coup 2 augmente bien son total (Brise DEF, pas seulement le critique)`);
    egal(total({ passifsOffensifs: { [sort]: true } }), total({ critMode: 'crit' }),
      `${sort} ${nom} — cible déjà affligée : les deux coups critiques`);
    egal(total({ defBreak: true }), total({ critMode: 'crit', defBreak: true }),
      `${sort} ${nom} — Brise DEF saisie : débuff présent, les deux coups critiques`);
  }

  // Décision de l'utilisateur du 2026-10-03 (degats-et-aura 15f) : la
  // réduction de DEF du coup 1 baisse aussi la DEF que subit le coup 2. Les
  // totaux du témoin Yuji vent (1 000 ATQ, 100 % de Dgts Crit, DEF cible
  // 1 000, « Non critique ») sont figés en valeur : 848,5363 sans scénario
  // (inchangé), 2 231,2793 avec la réduction posée après le coup 1.
  const p = profilDe(30413, 20108);
  const scenario1 = { ...base, skillCom2usId: 20108, scenariosEffetsEntreCoups: { 20108: { actif: true, apresCoup: { 'decrease-def': 1 } } } };
  egal(computeSkillDamage(p, build, { ...base, skillCom2usId: 20108 }, AUCUNE_AURA_PROPRE, 'wind').toFixed(4), '848.5363',
    '20108 — témoin sans scénario : 848,5363, inchangé');
  egal(computeSkillDamage(p, build, scenario1, AUCUNE_AURA_PROPRE, 'wind').toFixed(4), '2231.2793',
    '20108 — témoin avec la réduction posée après le coup 1 : 2 231,2793 (coup 2 critique sous DEF réduite)');

  // Le moteur et la recette : le scénario traverse l'export/import, le
  // score du moteur est celui de l'écran.
  const { recette, ctx } = contexte(30413, scenario1);
  egal(parseOptimizerRecipe(JSON.stringify(recette)).recipe?.damageSetup?.scenariosEffetsEntreCoups,
    scenario1.scenariosEffetsEntreCoups, 'recette : le scénario « decrease-def » survit à l’export/import');
  egal(objectiveScore(candidat, 'degats_reels', AUCUNE_AURA_PROPRE, ctx),
    computeSkillDamage(p, build, scenario1, AUCUNE_AURA_PROPRE, 'wind'),
    '20108 — moteur : même score que l’écran, coup 2 critique');

  // Les S3 feu restent inconditionnels (garantie de la table, pas du scénario).
  ok(profilDe(30412, 20112).critiqueGaranti === true && profilDe(31012, 20712).critiqueGaranti === true,
    '20112, 20712 — S3 feu : critique garanti inconditionnel, inchangé');
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
  // ignore toujours la DEF. ⚠️ Comparer au total contre une DEF NULLE, pas
  // au total un point de DEF plus haut : une DEF plus basse augmente déjà
  // les dégâts sans aucun ignore DEF, et `seuil > seuil + 1` passait encore
  // sous une borne stricte (mutation du lot 15d). Stats de combat = celles
  // du build (aucun passif de stat transmis) : 800 DEF, 1 000 ATQ.
  const ignoreAuSeuil = (p: SkillDamageProfile, seuil: number) => {
    const degats = (def: number) => computeSkillDamage(p, build, { ...base, enemyDef: def }, AUCUNE_AURA_PROPRE);
    return degats(seuil) === degats(0) && degats(seuil + 1) < degats(0);
  };
  ok(ignoreAuSeuil(profilDe(16533, 7763), 400),
    '7763 Copper — égalité à la moitié de sa DEF : ignore DEF (inclusif, inchangé)');
  for (const [forme, sort] of [[26112, 15907], [26113, 15908], [26115, 15910]]) {
    ok(ignoreAuSeuil(profilDe(forme, sort), 600),
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

export function testResumeConditionDebuff() {
  titre('Résumé « débuff sur la cible » — l’effet lu sur l’entrée (DamageSetupCard.tsx, degats-et-aura 15d)');
  const source = carte();
  ok(source.includes("return `${effetCondition(condition)} si la cible a un débuff`;"),
    'débuff sur la cible : l’effet suit l’entrée (Triss : ignore DEF ; Yuji, Rick : critique garanti)');
  ok(!source.includes("'ignore DEF si la cible a un débuff'"), 'plus de texte figé sur « ignore DEF »');
  ok(source.includes("condition.critiqueGaranti ? ' (critique garanti)'"),
    'interrupteur « débuff présent » : le libellé dit « critique garanti » pour Yuji et Rick');
}
