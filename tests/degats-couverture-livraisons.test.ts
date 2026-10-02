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
  monsterConditionsCombat,
  monsterDamageSkills,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
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
