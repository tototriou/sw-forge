// Couverture des livraisons que rien ne gardait (degats-et-aura 15a) : des
// entrées curées de `damage.ts`, livrées depuis des mois, dont AUCUN test ne
// citait l'identifiant. Supprimer l'une d'elles ne faisait échouer rien
// (skill game-data-curation § 8 : une entrée par nom ou par identifiant n'est
// protégée que par son test). Ce fichier n'ajoute AUCUNE mécanique : il pose,
// pour chaque identifiant, un contrôle nommé « N — » (N = constat de l'audit)
// qui passe par le vrai chemin de calcul et rougit si l'entrée disparaît.
//
// Familles, chacune pilotée par une table (identifiant, attendu) :
//   - garanties de critique sans test (CG-1) ;
//   - bonus de Taux Crit et de Dgts Crit propres au sort (TC-2) ;
//   - ignore DEF conditionnel sans test (IGN-a) ;
//   - livraisons partielles de la partie 2 (VP-a) : variables de formule,
//     conditions de sort, statistiques de combat.
//
// Les attendus viennent des sondes des preuves 13b (formule ou prose, écrits à
// la main, jamais recalculés par le code testé) ; la source de chaque famille
// est nommée au-dessus de sa table.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  computeTotalDamage,
  critiqueGarantiParReglage,
  estPrisEnCharge,
  monsterBonusParEffetCible,
  monsterBonusStatFixe,
  monsterCombatStatProfiles,
  monsterConditionsCombat,
  monsterDamageSkills,
  statsDeCombat,
} from '../src/lib/damage';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BuildCandidate, objectiveScore } from '../src/lib/runeBuildOptim';
import { StatKey } from '../src/lib/effects';
import { StatRow } from '../src/lib/stats';
import type { ElementKey } from '../src/types';
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

function prose(forme: number, sort: number): string {
  return fiche(forme).competences.find((c) => c.com2usId === sort)?.description ?? '';
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

// Build et réglage de la sonde `02-chemin-production.ts` de la preuve
// 13b-critiques-garantis (même build que `tests/audit-degats-conditionnels`).
const build = stats({ hp: 20000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 });
const base: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  enemyDef: 0,
  enemyHp: 1_000_000,
  enemyHpPct: 100,
  critMode: 'normal',
  summonerSkills: 'combat',
};
const enCritique = (setup: DamageSetup): DamageSetup => ({ ...setup, critMode: 'crit' });

// ---------------------------------------------------------------------------
// CG-1 — garanties de critique livrées sans test
// Source : controle-13b-critiques-garantis.md § 3 et § 5 (22 identifiants sans
// assertion), sonde 02-sortie.txt § 1 (totaux à ATQ 1 000, DEF cible nulle,
// élément eau). « Non critique » égale « Critique » ⇔ critique imposé.
// ---------------------------------------------------------------------------

// [constat, monstre, identifiant du sort, formes jouables du corpus, total]
const GARANTIES: [number, string, number, number[], number][] = [
  [240, 'Kumar', 8317, [17412], 10495],
  [242, 'Chiwu', 9407, [18602, 18612], 14886],
  [242, 'Pungbaek', 9408, [18603, 18613], 14886],
  [242, 'Woonsa', 9410, [18605, 18615], 14886],
  [245, 'Ritesh', 8318, [17413], 10495],
  [248, 'Mihyang', 9118, [18311], 17646],
  [250, 'Chandra', 8316, [17411], 10495],
  [251, 'Taor', 4211, [14601, 14611], 17592],
  [253, 'Shazam', 8319, [17414], 10495],
  [255, 'Rahul', 8320, [17415], 10495],
  [257, 'Ryan', 10811, [20001, 20011], 19046],
  [258, 'Logan', 10813, [20003, 20013], 17075],
  [259, 'Karl', 10815, [20005, 20015], 19308],
  [261, 'Josephine', 12516, [21811], 8932],
  [272, 'Yuji vent', 20113, [30403, 30413], 16734],
  [273, 'Yuji ténèbres', 20115, [30405, 30415], 19737],
  [274, 'Rick feu', 20712, [31002, 31012], 10070],
  [275, 'Rick vent', 20713, [31003, 31013], 16734],
  [276, 'Rick ténèbres', 20715, [31005, 31015], 19737],
  [277, 'Theonia', 23515, [34205, 34215], 7566],
  [278, 'Anduril', 2763, [11733, 610203], 18932],
];

export function testCouvertureGarantiesCritique() {
  titre('Garanties de critique livrées sans test — 22 identifiants (degats-et-aura 15a, CG-1)');

  // Témoin : un sort SANS garantie (Heavenly Sword d'Artamiel) donne bien un
  // total « Non critique » inférieur au total « Critique » dans ce réglage.
  const temoin = profilDe(17014, 6304);
  ok(
    computeSkillDamage(temoin, build, base, AUCUNE_AURA_PROPRE, 'water') <
      computeSkillDamage(temoin, build, enCritique(base), AUCUNE_AURA_PROPRE, 'water'),
    'témoin — sans garantie, « Non critique » reste sous « Critique » dans ce réglage'
  );

  for (const [constat, nom, sort, formes, total] of GARANTIES) {
    for (const forme of formes) {
      const p = profilDe(forme, sort);
      const etiquette = `${constat} — ${nom} (${sort}, forme ${forme})`;
      ok(/Critical Hits?/.test(prose(forme, sort)), `${etiquette} : la prose de la compétence porte la garantie`);
      const normal = computeSkillDamage(p, build, base, AUCUNE_AURA_PROPRE, 'water');
      const critique = computeSkillDamage(p, build, enCritique(base), AUCUNE_AURA_PROPRE, 'water');
      egal(normal, critique, `${etiquette} : « Non critique » égale « Critique »`);
      egal(Math.round(normal), total, `${etiquette} : total attendu de la sonde`);
      ok(critiqueGarantiParReglage(p, base), `${etiquette} : l'écran neutralise « Non critique »`);
    }
  }

  // Kalantatze (Flame Strike, 17911) : la garantie dépend de l'élément de la
  // cible (« if the target's attribute is Wind »), les effets de la donnée
  // n'en disent rien — la prose fait foi.
  for (const forme of [28101, 28111]) {
    const p = profilDe(forme, 17911);
    const etiquette = `267 — Kalantatze (17911, forme ${forme})`;
    ok(/always lands as a Critical Hit and deals 100% increased damage if the target's attribute is Wind/.test(prose(forme, 17911)),
      `${etiquette} : la prose porte la garantie sous condition d'élément`);
    const vent = { ...base, enemyElement: 'wind' } as DamageSetup;
    const feu = { ...base, enemyElement: 'fire' } as DamageSetup;
    egal(computeSkillDamage(p, build, vent, AUCUNE_AURA_PROPRE, 'water'), computeSkillDamage(p, build, enCritique(vent), AUCUNE_AURA_PROPRE, 'water'),
      `${etiquette} : cible Vent, « Non critique » égale « Critique »`);
    egal(Math.round(computeSkillDamage(p, build, vent, AUCUNE_AURA_PROPRE, 'water')), 27032, `${etiquette} : total attendu contre une cible Vent`);
    ok(computeSkillDamage(p, build, feu, AUCUNE_AURA_PROPRE, 'water') < computeSkillDamage(p, build, enCritique(feu), AUCUNE_AURA_PROPRE, 'water'),
      `${etiquette} : cible Feu, aucune garantie`);
    egal(Math.round(computeSkillDamage(p, build, feu, AUCUNE_AURA_PROPRE, 'water')), 6620, `${etiquette} : total attendu contre une cible Feu`);
  }
}

// ---------------------------------------------------------------------------
// TC-2 — bonus de Taux Crit et de Dgts Crit propres, livrés depuis 826fb331
// Source : controle-13b-critiques-bonus-tc-dc.md § 2 et § 3, sonde 05-sortie.txt
// § 1 et § 3. Depuis le lot CM (mode « Moyenne » supprimé), un bonus de TC seul
// ne change AUCUN total : le contrôle le dit (inerte), il ne l'ignore pas ;
// un bonus de DC ne compte qu'en « Critique » (Fire Wall : ×1,4082).
// ---------------------------------------------------------------------------

export function testCouvertureBonusCritique() {
  titre('Bonus de critique propres livrés — 287, 289, 293, 303, 304 (degats-et-aura 15a, TC-2)');

  egal(monsterBonusStatFixe(fiche(10735)), { cr: 20, cd: 0 }, '287 — Gorgo (1865, forme 10735) : +20 points de TC, aucun point de DC');

  const eludain = profilDe(11734, 2759);
  egal(eludain.critRatePoints, 50, '293 — Eludain (2759, forme 11734) : +50 points de TC');
  const sansTc = { ...eludain, critRatePoints: 0 };
  for (const mode of ['normal', 'crit'] as const) {
    egal(
      computeSkillDamage(eludain, build, { ...base, critMode: mode }, AUCUNE_AURA_PROPRE, 'fire'),
      computeSkillDamage(sansTc, build, { ...base, critMode: mode }, AUCUNE_AURA_PROPRE, 'fire'),
      `293 — Eludain : le TC seul ne change aucun total depuis le lot CM (mode ${mode})`
    );
  }

  // 289 — Naomi 2A : la garantie de Tiger's Appearance vient d'un débuff sur la
  // cible (la `note` de l'effet dit l'inverse, la prose fait foi).
  const naomi = fiche(15033);
  const bonusNaomi = monsterBonusParEffetCible(naomi)!;
  egal(bonusNaomi.skillCom2usId, 6163, '289 — Naomi 2A (6163, forme 15033) : passif par débuff exact');
  egal(bonusNaomi.critiqueGarantiSiPresent, true, '289 — Naomi 2A : la garantie suit la présence d\'un débuff');
  const chain = profilDe(15033, 6158);
  const totalNaomi = (setup: DamageSetup) =>
    computeTotalDamage(chain, [], build, setup, AUCUNE_AURA_PROPRE, 'wind', undefined, false, null, null, { bonusParEffetCible: bonusNaomi });
  const avecDebuff = { ...base, effetsCibleCount: { 6163: 1 } };
  egal(totalNaomi(avecDebuff), totalNaomi(enCritique(avecDebuff)), '289 — Naomi 2A : un débuff sur la cible, « Non critique » égale « Critique »');
  ok(totalNaomi(base) < totalNaomi(enCritique(base)), '289 — Naomi 2A : sans débuff sur la cible, aucune garantie');

  // 303 et 304 — Fire Wall (Triss) et Flame Eruption (Enshia) : +100 points de DC.
  for (const [constat, nom, forme, sort] of [[303, 'Triss', 29512, 19212], [304, 'Enshia', 29912, 19612]] as const) {
    const p = profilDe(forme, sort);
    const sansDc = { ...p, critDamagePoints: 0 };
    const etiquette = `${constat} — ${nom} (${sort}, forme ${forme})`;
    egal(p.critDamagePoints, 100, `${etiquette} : +100 points de DC`);
    egal(
      computeSkillDamage(p, build, base, AUCUNE_AURA_PROPRE, 'fire'),
      computeSkillDamage(sansDc, build, base, AUCUNE_AURA_PROPRE, 'fire'),
      `${etiquette} : le DC ne change pas un coup non critique`
    );
    const rapport = computeSkillDamage(p, build, enCritique(base), AUCUNE_AURA_PROPRE, 'fire') /
      computeSkillDamage(sansDc, build, enCritique(base), AUCUNE_AURA_PROPRE, 'fire');
    ok(Math.abs(rapport - 1.4082) < 1e-4, `${etiquette} : rapport critique avec / sans le bonus de 1,4082 (reçu ${rapport.toFixed(4)})`);
  }
}

// ---------------------------------------------------------------------------
// IGN-a — ignore DEF conditionnel livré sans test
// Source : controle-13b-ignore-def.md § 2 et § 6, sonde 04-sonde.txt (même
// build et même réglage que `tests/audit-degats-conditionnels`, DEF de la cible
// 1 500 sauf Guard Crush, au seuil de 600). « sans » : condition non remplie ;
// « avec » : interrupteur actif (proc, présence de débuff, cible endormie…).
// ---------------------------------------------------------------------------

const arrondi = (x: number) => Math.round(x);

// Sorts dont la condition est portée par le sort (CONDITIONS_COMBAT_PAR_ID_CONNUS).
// [constat, nom, forme, sort, interrupteur actif, DEF de la cible, sans, avec]
const IGNORE_DEF_PAR_SORT: [number, string, number, number, boolean, number, number, number][] = [
  [200, "Bull's Eye Wayne", 15611, 7001, true, 1500, 720, 4098],
  [200, "Bull's Eye Randy", 15612, 7002, true, 1500, 720, 4098],
  [200, "Bull's Eye Roger", 15613, 7003, true, 1500, 720, 4098],
  [200, "Bull's Eye Walkers", 15614, 7004, true, 1500, 720, 4098],
  [200, "Bull's Eye Jamie", 15615, 7005, true, 1500, 720, 4098],
  [200, 'Dark Dragon Attack Fei', 17315, 8215, true, 1500, 2800, 15937],
  [201, 'Shadow Arrow Bethony', 15415, 6815, true, 1500, 818, 4658],
  [203, 'Torrent Ragdoll', 16615, 7810, true, 1500, 1100, 6261],
  [205, 'Guard Crush Sonia', 26113, 15908, false, 600, 1330, 3831],
  [205, 'Guard Crush Destiny', 26115, 15910, false, 600, 1330, 3831],
  [214, 'Black Meteor Celestara', 29915, 19615, true, 1500, 498, 2837],
];

// Passifs monstre-wide (CONDITIONS_MONSTRE_PAR_ID_CONNUS) : la condition vaut
// pour chaque sort du monstre. [constat, nom, forme, passif, [[sort, sans, avec]]]
const IGNORE_DEF_MONSTRE: [number, string, number, number, [number, number, number][]][] = [
  [202, "Hawk's Eye Nangrim", 18512, 9312, [[9302, 820, 4667], [9307, 1100, 6261]]],
  [208, 'Infinity Shadow Shun', 25914, 15714, [[15704, 731, 4159], [15709, 692, 3940]]],
  [209, 'Dream Invader Bombay', 26015, 15815, [[15805, 840, 4781]]],
];

export function testCouvertureIgnoreDefIdentifiants() {
  titre('Ignore DEF conditionnel livré sans test — 15 identifiants (degats-et-aura 15a, IGN-a)');

  for (const [constat, nom, forme, sort, interrupteur, def, sans, avec] of IGNORE_DEF_PAR_SORT) {
    const p = profilDe(forme, sort);
    const etiquette = `${constat} — ${nom} (${sort}, forme ${forme})`;
    const actif = interrupteur ? { passifsOffensifs: { [sort]: true } } : {};
    // Sans interrupteur (Guard Crush), la condition porte sur la DEF saisie : un point de plus ne la remplit plus.
    const dehors = interrupteur ? def : def + 1;
    const total = (setup: Partial<DamageSetup>) => computeSkillDamage(p, build, { ...base, ...setup }, AUCUNE_AURA_PROPRE);
    egal(arrondi(total({ enemyDef: dehors })), sans, `${etiquette} : condition non remplie, DEF de la cible ${dehors}`);
    egal(arrondi(total({ enemyDef: def, ...actif })), avec, `${etiquette} : condition remplie, la DEF de la cible ne compte plus`);
    egal(total({ enemyDef: def, ...actif }), total({ enemyDef: 0 }),
      `${etiquette} : condition remplie, le total égale celui d'une DEF nulle`);
  }

  // Isael (215) : ignore 50 % de la DEF d'une cible endormie (prose seule).
  const isael = profilDe(13315, 5315);
  const totalIsael = (setup: Partial<DamageSetup>) => computeSkillDamage(isael, build, { ...base, ...setup }, AUCUNE_AURA_PROPRE);
  egal(arrondi(totalIsael({ enemyDef: 1500 })), 923, '215 — Night Hag\'s Scuttle Isael (5315, forme 13315) : cible éveillée');
  egal(arrondi(totalIsael({ enemyDef: 1500, passifsOffensifs: { 5315: true } })), 1570,
    '215 — Night Hag\'s Scuttle Isael : cible endormie, 1 570');
  egal(totalIsael({ enemyDef: 1500, passifsOffensifs: { 5315: true } }), totalIsael({ enemyDef: 750 }),
    '215 — Night Hag\'s Scuttle Isael : cible endormie, le total égale celui d\'une DEF réduite de moitié (50 %)');

  for (const [constat, nom, forme, passif, sorts] of IGNORE_DEF_MONSTRE) {
    const conditions = monsterConditionsCombat(fiche(forme));
    ok(conditions.some((c) => c.skillCom2usId === passif && c.condition.type === 'manuel'),
      `${constat} — ${nom} (${passif}, forme ${forme}) : condition monstre-wide à interrupteur`);
    for (const [sort, sans, avec] of sorts) {
      const p = profilDe(forme, sort);
      const etiquette = `${constat} — ${nom} (${passif}), sort ${sort}`;
      const total = (setup: Partial<DamageSetup>) =>
        computeTotalDamage(p, [], build, { ...base, ...setup }, AUCUNE_AURA_PROPRE, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null,
          { conditionsCombat: conditions });
      egal(arrondi(total({ enemyDef: 1500 })), sans, `${etiquette} : condition non remplie`);
      egal(arrondi(total({ enemyDef: 1500, passifsOffensifs: { [passif]: true } })), avec,
        `${etiquette} : condition remplie, la DEF de la cible ne compte plus`);
    }
  }
}

// ---------------------------------------------------------------------------
// VP-a — livraisons de la partie 2 dont des identifiants n'avaient aucun test
// Source : controle-13b-verif-partie2.md § 2, § 5 et § 6 ; sonde 08-sonde.ts /
// 08-sonde.txt : chemin de production du CLI (`buildRealDamageContext`, puis
// `objectiveScore`) sur un build à BASE NON NULLE (une base nulle masque
// l'assiette des statistiques de combat). Les attendus sont des RAPPORTS écrits
// à la main depuis la formule de la donnée ou le coefficient de la prose :
// invocateur, compétences et multiplicateurs communs s'annulent.
// ---------------------------------------------------------------------------

const BASE_SONDE: Record<StatKey, number> = { hp: 10000, atk: 800, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const TOTAL_SONDE: Record<StatKey, number> = { hp: 25000, atk: 2000, def: 1200, spd: 200, cr: 30, cd: 150, res: 15, acc: 0 };
const buildSonde: StatRow[] = (Object.keys(BASE_SONDE) as StatKey[]).map((key) => ({
  key, label: key, base: BASE_SONDE[key], bonus: TOTAL_SONDE[key] - BASE_SONDE[key], total: TOTAL_SONDE[key], suffix: '',
}));
const candidatSonde = { stats: buildSonde, effTotal: 0, runeIds: [] } as unknown as BuildCandidate;
const baseSonde: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP, enemyDef: 0, enemyHp: 1_000_000, enemyHpPct: 100, critMode: 'normal',
};

// Le chemin du moteur : recette → contexte du CLI → `objectiveScore`.
function contexteSonde(forme: number, sort: number, patch: Partial<DamageSetup>) {
  const recette = buildOptimizerRecipe({
    monsterCom2usId: forme,
    monsterName: String(forme),
    requirement: { sets: [], minStats: {} },
    objective: 'degats_reels',
    damageSetup: { ...baseSonde, ...patch, skillCom2usId: sort },
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
  if (!ctx) throw new Error(`contexte ${forme}/${sort} introuvable`);
  if (ctx.profile.skillCom2usId !== sort) throw new Error(`sort résolu ${ctx.profile.skillCom2usId} ≠ ${sort}`);
  return ctx;
}

function scoreSonde(forme: number, sort: number, patch: Partial<DamageSetup>): number {
  return objectiveScore(candidatSonde, 'degats_reels', AUCUNE_AURA_PROPRE, contexteSonde(forme, sort, patch));
}

// Stats de combat du candidat, lues sur le contexte de production (jamais recopiées).
function combatSonde(forme: number, sort: number) {
  const ctx = contexteSonde(forme, sort, {});
  return statsDeCombat(buildSonde, ctx.setup, AUCUNE_AURA_PROPRE, ctx.element, ctx.artefacts, ctx.monsterWide);
}

const proche = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b));

function rapportSonde(libelle: string, forme: number, sort: number, a: Partial<DamageSetup>, b: Partial<DamageSetup>, attendu: number) {
  const r = scoreSonde(forme, sort, b) / scoreSonde(forme, sort, a);
  ok(proche(r, attendu), proche(r, attendu) ? libelle : `${libelle} — reçu ${r}, attendu ${attendu}`);
}

// Critique imposé ⇔ « Non critique » égale « Critique ».
function critiqueImpose(forme: number, sort: number, patch: Partial<DamageSetup>): boolean {
  return scoreSonde(forme, sort, { ...patch, critMode: 'normal' }) === scoreSonde(forme, sort, { ...patch, critMode: 'crit' });
}

// [constat, formule, sort, forme, rapport] — formules `{Current HP %}` : rapport
// d'un total à PV propres 0 % sur le total à 100 %, lu dans la formule de la donnée.
const FORMULES_PV: [number, string, number, number, number][] = [
  [72, 'Destructive Blow {DEF}*(8,5 − 3,0·h)', 8707, 17812, 8.5 / 5.5],
  [72, 'Destructive Blow {DEF}*(8,5 − 3,0·h)', 8709, 17814, 8.5 / 5.5],
  [72, 'Crushing Armor {ATK}*(4,0 + 3,5·h)', 5407, 14812, 4 / 7.5],
  [72, 'Crushing Armor {ATK}*(4,0 + 3,5·h)', 5408, 14813, 4 / 7.5],
  [72, 'Crushing Armor {ATK}*(4,0 + 3,5·h)', 5410, 14815, 4 / 7.5],
  [72, 'Dagger of Grudge {ATK}*(2,2 + 0,6·h)', 9115, 18315, 2.2 / 2.8],
  [72, 'Devour/Razor Cut {ATK}*(3,4 + 1,6·h)', 21507, 32112, 3.4 / 5],
  [72, 'Devour/Razor Cut {ATK}*(3,4 + 1,6·h)', 21508, 32113, 3.4 / 5],
  [72, 'Devour/Razor Cut {ATK}*(3,4 + 1,6·h)', 21510, 32115, 3.4 / 5],
  [72, 'Devour/Razor Cut {ATK}*(3,4 + 1,6·h)', 22107, 32812, 3.4 / 5],
  [72, 'Devour/Razor Cut {ATK}*(3,4 + 1,6·h)', 22108, 32813, 3.4 / 5],
  [72, 'Devour/Razor Cut {ATK}*(3,4 + 1,6·h)', 22110, 32815, 3.4 / 5],
];

export function testCouvertureVariablesFormule() {
  titre('Variables de formule : PV propres et alliés vivants — constats 72, 73, 75 (degats-et-aura 15a, VP-a)');

  for (const [constat, nom, sort, forme, attendu] of FORMULES_PV) {
    rapportSonde(`${constat} — ${nom} (${sort}, forme ${forme}) : PV propres 100 % → 0 %, rapport ${attendu.toFixed(4)}`,
      forme, sort, { ownHpPct: 100 }, { ownHpPct: 0 }, attendu);
  }

  // 72 — Torrent de Ragdoll (7810) : coefficient CONSTANT 5,5 × ATQ, comme celui de
  // Leo (7808, déjà gardé). ⚠️ C'est la décision livrée de la partie 2, dont la
  // source n'est écrite nulle part (relevé R1 de la preuve : la donnée dit
  // 7,5 − 2,0·h) : ce contrôle garde la livraison, il ne la déclare pas établie.
  egal(profilDe(16615, 7810).formule, '5.5*{ATK}', '72 — Torrent de Ragdoll (7810, forme 16615) : coefficient constant de la décision livrée');
  rapportSonde('72 — Torrent de Ragdoll (7810) : PV propres 100 % → 31 %, total inchangé', 16615, 7810, { ownHpPct: 100 }, { ownHpPct: 31 }, 1);

  // 73 — Risky Dash de Lusha (1864) : 1,4 × PV actuels, PV saisis AVANT le sort.
  rapportSonde('73 — Risky Dash (1864, forme 10734) : PV propres 100 % → 50 %, total ×0,5', 10734, 1864, { ownHpPct: 100 }, { ownHpPct: 50 }, 0.5);

  // 75 — Justice : {ATK}*(13,5 − 5,5 × alliés vivants %) → 8 à 100 %, 13,5 à 0 %.
  for (const [sort, forme] of [[7806, 16611], [7807, 16612], [7809, 16614]] as const) {
    rapportSonde(`75 — Justice (${sort}, forme ${forme}) : alliés vivants 100 % → 0 %, rapport 13,5 / 8`,
      forme, sort, { livingAlliesPct: 100 }, { livingAlliesPct: 0 }, 13.5 / 8);
  }
}

export function testCouvertureConditionsSort() {
  titre('Conditions de sort : bornes et interrupteurs — constats 63, 70, 246, 249, 264 (degats-et-aura 15a, VP-a)');

  // 63 — Eleni (17913) : +30 % si l'ATQ de la cible est STRICTEMENT inférieure à la sienne.
  {
    const atq = combatSonde(28113, 17913).atk;
    rapportSonde(`63 — Eleni (17913, forme 28113) : ATQ cible ${atq} (égale) → ${atq - 1}, +30 %`,
      28113, 17913, { enemyAtk: atq }, { enemyAtk: atq - 1 }, 1.3);
    egal(scoreSonde(28113, 17913, { enemyAtk: atq }), scoreSonde(28113, 17913, { enemyAtk: atq + 1 }),
      '63 — Eleni : à l\'égalité d\'ATQ, aucun bonus (borne stricte)');
  }

  // 70 — Rick feu (20712) : +50 % sur une cible dont les PV ne sont pas détruits ; critique garanti sans condition.
  rapportSonde('70 — Rick feu (20712, forme 31012) : PV non détruits faux → vrai, +50 %', 31012, 20712,
    { enemyHpNotDestroyed: false }, { enemyHpNotDestroyed: true }, 1.5);
  ok(critiqueImpose(31012, 20712, { enemyHpNotDestroyed: false }),
    '70 — Rick feu : critique garanti même sans le bonus de PV non détruits');

  // 246 — Squall : critique garanti si la VIT de la cible est STRICTEMENT inférieure à la sienne.
  for (const [nom, sort, forme] of [['Lagmaron', 4208, 14613], ['Shan', 4209, 14614]] as const) {
    const vit = combatSonde(forme, sort).spd;
    ok(critiqueImpose(forme, sort, { enemySpd: vit - 1 }), `246 — Squall ${nom} (${sort}, forme ${forme}) : VIT cible ${vit - 1} < ${vit}, critique garanti`);
    ok(!critiqueImpose(forme, sort, { enemySpd: vit }), `246 — Squall ${nom} (${sort}) : VIT cible égale, aucune garantie`);
  }

  // 249 — Liesel (6511) : critique garanti contre un monstre Feu.
  ok(critiqueImpose(14711, 6511, { enemyElement: 'fire' }), '249 — Liesel (6511, forme 14711) : cible Feu, critique garanti');
  ok(!critiqueImpose(14711, 6511, { enemyElement: 'water' }), '249 — Liesel (6511) : cible Eau, aucune garantie');

  // 264 — Hiva 2A (6258) : critique garanti si les PV de la cible sont à 30 % ou moins (prose, inclusive).
  ok(critiqueImpose(16033, 6258, { enemyHpPct: 30 }), '264 — Hiva 2A (6258, forme 16033) : PV cible 30 %, critique garanti');
  ok(!critiqueImpose(16033, 6258, { enemyHpPct: 31 }), '264 — Hiva 2A (6258) : PV cible 31 %, aucune garantie');
}

// Statistiques de combat des passifs (STATS_COMBAT_PAR_ID_CONNUS), constats
// 90-106, 114, 116, 123. Le contrôle mesure l'apport de chaque stat (ATQ, DEF,
// PV, VIT) entre `statsDeCombat` SANS le passif et AVEC lui, au cumul 1, au
// plafond et au-delà du plafond. Attendus : coefficient et plafond de la prose
// ou de l'effet (sonde § 4), écrits à la main.
//
// ⚠️ Ce que ce contrôle garde : le COEFFICIENT et le PLAFOND de chaque entrée.
// L'ASSIETTE d'un pourcentage (stat de combat totale, livrée aujourd'hui, ou
// stat de base) est INDÉTERMINÉE pour les 26 lignes concernées (I-1 de
// 13b-stats-passifs, relevé R2) : les pourcentages sont lus ici en part de la
// stat de combat sans le passif, comme le calcul actuel, et un relevé qui
// trancherait contre cette assiette fera rougir ces lignes — à mettre à jour
// alors, en connaissance de cause.
type CleStat = 'atk' | 'def' | 'hp' | 'spd';
const CLES_STATS: CleStat[] = ['atk', 'def', 'hp', 'spd'];

function statsSansEtAvec(forme: number, patch: Partial<DamageSetup>, element: ElementKey) {
  const sans = statsDeCombat(buildSonde, baseSonde, AUCUNE_AURA_PROPRE, element, undefined, {});
  const avec = statsDeCombat(buildSonde, { ...baseSonde, ...patch }, AUCUNE_AURA_PROPRE, element, undefined,
    { combatStats: monsterCombatStatProfiles(fiche(forme)) });
  return { sans, avec };
}

// Vrai si, pour chaque stat, l'apport vaut `pct` % de la stat sans le passif plus `pts` points.
function apportConforme(forme: number, patch: Partial<DamageSetup>, element: ElementKey,
  pct: Partial<Record<CleStat, number>>, pts: Partial<Record<CleStat, number>>, facteur: number): string | null {
  const { sans, avec } = statsSansEtAvec(forme, patch, element);
  for (const k of CLES_STATS) {
    const attendu = ((pct[k] ?? 0) * sans[k] / 100 + (pts[k] ?? 0)) * facteur;
    const recu = avec[k] - sans[k];
    if (!proche(recu, attendu, 1e-9)) return `${k} : reçu ${recu}, attendu ${attendu}`;
  }
  return null;
}

const cumuls = (id: number) => (n: number): Partial<DamageSetup> => ({ stackPersonnalise: { [id]: n } });
const buffsPropres = (id: number) => (n: number): Partial<DamageSetup> => ({ buffsPropresCount: { [id]: n } });
const debuffsPropres = (id: number) => (n: number): Partial<DamageSetup> => ({ effetsPropresCount: { [id]: n } });

// [constat, monstre, identifiant, forme, compteur, % par cumul, points par cumul, plafond]
type LigneCumul = [number, string, number, number, (n: number) => Partial<DamageSetup>,
  Partial<Record<CleStat, number>>, Partial<Record<CleStat, number>>, number];
const CUMULS: LigneCumul[] = [
  [90, 'Punish (Elpuria)', 2314, 11314, cumuls(2314), { atk: 20, def: 20 }, {}, 10],
  [91, 'Judge (Artamiel)', 6314, 17014, cumuls(6314), { def: 10 }, {}, 10],
  [92, "King's Rage", 7814, 16614, cumuls(7814), { atk: 50 }, {}, 5],
  [93, 'King of the Dead', 7515, 16315, cumuls(7515), { atk: 100 }, {}, 3],
  [94, "Underworld King's Return", 11213, 20413, cumuls(11213), { atk: 100 }, {}, 3],
  [95, 'Undergo Hardship', 15011, 25111, cumuls(15011), { atk: 10 }, {}, 25],
  [98, 'Addicted Power (Valdemar)', 19315, 29615, buffsPropres(19315), { atk: 100 }, {}, 3],
  [99, 'Strange Reversible Reaction, buffs (Crane)', 11663, 20833, buffsPropres(11663), { def: 25 }, {}, 10],
  [99, 'Strange Reversible Reaction, débuffs (Crane)', 11663, 20833, debuffsPropres(11663), {}, { spd: 25 }, 10],
  [100, 'Constant Training (Mayasura)', 18311, 28511, cumuls(18311), {}, { atk: 100 }, 10],
  [101, 'Quick Steps (Legolas)', 23914, 34714, cumuls(23914), { atk: 10, def: 10 }, {}, 15],
  [101, 'Deer Steps (Elder Horn)', 24414, 35314, cumuls(24414), { atk: 10, def: 10 }, {}, 15],
  [102, 'Reincarnate (Chamie)', 2214, 11214, cumuls(2214), { atk: 50, def: 50 }, {}, 5],
  [103, 'Crouch (Dagora)', 1856, 10731, cumuls(1856), { hp: 20 }, {}, 5],
  [104, 'Stone Claws (Tanzaite)', 13501, 23311, cumuls(13501), { def: 30 }, {}, 5],
  [104, 'Stone Claws (Kunite)', 13502, 23312, cumuls(13502), { def: 30 }, {}, 5],
  [104, 'Stone Claws (Malite)', 13503, 23313, cumuls(13503), { def: 30 }, {}, 5],
  [104, 'Stone Claws (Phenaka)', 13504, 23314, cumuls(13504), { def: 30 }, {}, 5],
  [104, 'Stone Claws (Onyx)', 13505, 23315, cumuls(13505), { def: 30 }, {}, 5],
];

// Passifs permanents ou à interrupteur : [constat, nom, identifiant, forme, élément, réglage, % ATQ/DEF/PV/VIT]
type LigneFixe = [number, string, number, number, ElementKey, Partial<DamageSetup>, Partial<Record<CleStat, number>>];
const FIXES: LigneFixe[] = [
  [105, 'Fierce Attack! (Inosuke), ATQ', 21515, 32115, 'fire', {}, { atk: 30 }],
  [105, 'Attack Instinct (White Tiger), ATQ', 22115, 32815, 'fire', {}, { atk: 30 }],
  [106, 'Dark Guardian (Varus)', 2565, 11535, 'dark', {}, { def: 50 }],
  [114, 'Inverted Output (Alesia), malus d\'ATQ inversé', 19814, 30114, 'fire', { atkDebuff: true }, { atk: 50 }],
  [114, 'Inverted Output (Alesia), malus de DEF inversé', 19814, 30114, 'fire', { defDebuff: true }, { def: 70 }],
  [114, 'Inverted Output (Alesia), malus de VIT inversé', 19814, 30114, 'fire', { spdDebuff: true }, { spd: 30 }],
  [116, 'Berserk (9612)', 9612, 18812, 'water', { passifsOffensifs: { 9612: true } }, { def: -30, spd: 20 }],
  [116, 'Berserk (9613)', 9613, 18813, 'water', { passifsOffensifs: { 9613: true } }, { def: -30, spd: 20 }],
  [116, 'Berserk (9614)', 9614, 18814, 'water', { passifsOffensifs: { 9614: true } }, { def: -30, spd: 20 }],
  [116, 'Berserk (9615)', 9615, 18815, 'water', { passifsOffensifs: { 9615: true } }, { def: -30, spd: 20 }],
  [123, 'Thunderer, DEF (18136)', 18136, 28311, 'fire', { statsCombatActives: { 18136: true } }, { def: 100 }],
  [123, 'Thunderer, ATQ (18137)', 18137, 28312, 'fire', { statsCombatActives: { 18137: true } }, { atk: 100 }],
  [123, 'Thunderer, VIT (18138)', 18138, 28313, 'fire', { statsCombatActives: { 18138: true } }, { spd: 100 }],
  [123, 'Thunderer, PV (18140)', 18140, 28315, 'fire', { statsCombatActives: { 18140: true } }, { hp: 30 }],
];

export function testCouvertureStatsCombat() {
  titre('Statistiques de combat des passifs — constats 90 à 106, 114, 116, 123 (degats-et-aura 15a, VP-a)');

  for (const [constat, nom, id, forme, compteur, pct, pts, plafond] of CUMULS) {
    const etiquette = `${constat} — ${nom} (${id}, forme ${forme})`;
    for (const [n, facteur, quand] of [[1, 1, '1 cumul'], [plafond, plafond, `plafond de ${plafond}`], [plafond + 1, plafond, `${plafond + 1} cumuls, plafonné à ${plafond}`]] as const) {
      const ecart = apportConforme(forme, compteur(n), 'fire', pct, pts, facteur);
      ok(ecart === null, ecart === null ? `${etiquette} : ${quand}` : `${etiquette} : ${quand} — ${ecart}`);
    }
    ok(apportConforme(forme, compteur(0), 'fire', pct, pts, 0) === null, `${etiquette} : sans cumul, aucun apport`);
  }

  for (const [constat, nom, id, forme, element, reglage, pct] of FIXES) {
    const etiquette = `${constat} — ${nom} (${id}, forme ${forme})`;
    const ecart = apportConforme(forme, reglage, element, pct, {}, 1);
    ok(ecart === null, ecart === null ? `${etiquette} : apport attendu` : `${etiquette} : apport attendu — ${ecart}`);
    if (Object.keys(reglage).length > 0) {
      ok(apportConforme(forme, {}, element, {}, {}, 1) === null, `${etiquette} : sans l'interrupteur, aucun apport`);
    }
  }

  // 105 — la part de Taux Crit (+20 points) ne se lit pas dans ces stats ; depuis le lot CM
  // elle ne change aucun total, la ligne ne porte donc que l'ATQ.

  // 116 — Berserk : la même ligne majore aussi les dégâts de +100 % (prose « damage dealt … increased by 100% »).
  for (const [id, forme, sort] of [[9612, 18812, 9602], [9613, 18813, 9603], [9614, 18814, 9604], [9615, 18815, 9605]] as const) {
    rapportSonde(`116 — Berserk (${id}, forme ${forme}) : dégâts du sort ${sort} avec l'interrupteur, ×2`,
      forme, sort, {}, { passifsOffensifs: { [id]: true } }, 2);
  }
}
