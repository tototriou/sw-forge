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
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  critiqueGarantiParReglage,
  estPrisEnCharge,
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
