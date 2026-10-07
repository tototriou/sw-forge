// L'attaque appelée ACTIVE : une compétence
// active de la fiche enchaînée après UN sort déclencheur (la S2 de RYU appelle
// sa S1). Trois vérifications :
// 1. l'approvisionnement par `ATTAQUES_APPELEES_PAR_DECLENCHEUR` (clé = sort
//    déclencheur, slot appelé ; jamais un nom) ;
// 2. la couverture des 17 amorces, une par une ;
// 3. l'espace de clés de l'interrupteur (`passifsOffensifs`).
//
// ⚠️ AUCUNE entrée de production : la table est vide (« n'en
// code aucune »). Chaque test injecte SES entrées et les retire dans un
// `finally` ; la restauration est vérifiée.
//
// Valeurs de jeu : formules, coups et améliorations des fiches SWARFARM
// (`public/data/skills`), recopiées ici à la main ; inclusion par interrupteur,
// lignes d'artéfact et ordre des effets des Maîtres ivres : `spec/outils/degats-reels/valeurs-de-jeu-curees.md`,
// réponses de
// l'utilisateur. Aucun nombre attendu n'est relu dans le code
// qui calcule, aucun cas n'est déduit d'un voisin.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { Competence, DetailMonstre } from '../src/lib/monsterSkills';
import { ArtifactDetail } from '../src/types';
import {
  ATTAQUES_APPELEES_PAR_DECLENCHEUR,
  AUCUNE_AURA_PROPRE,
  ARTIFACT_DAMAGE_NEUTRE,
  DEFAULT_DAMAGE_SETUP,
  type ArtifactDamageProfile,
  type AttaqueAppeleeConnue,
  type DamageSetup,
  type PassifOffensifProfile,
  type SkillDamageProfile,
  artifactDamageProfile,
  computeSkillDamageDetail,
  computeTotalDamage,
  defaultDamageSkill,
  defenseFactor,
  estPrisEnCharge,
  monsterBonusDegatsConditionnel,
  monsterBonusParEffetCible,
  monsterCombatStatProfiles,
  monsterConditionsCombat,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifPeutSuivre,
  skillDamageProfile,
} from '../src/lib/damage';
import type { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { resolveObjectiveStats } from '../scripts/lib/recipeToSearchParams';
import type { LoadedMonster } from '../scripts/lib/loadMonster';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function toutesLesFiches(): DetailMonstre[] {
  return readdirSync(DOSSIER_SORTS)
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(readFileSync(resolve(DOSSIER_SORTS, n), 'utf8')) as DetailMonstre);
}

// Stats de fiche à base nulle (comme dans `tests/degats-mecanismes-generiques.test.ts`) : ce qui porte sur la base
// (compétences d'invocateur) s'annule, l'ATQ de combat vaut l'ATQ saisie.
function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

function artefacts(subs: { code: number; value: number }[]): ArtifactDamageProfile {
  const a: ArtifactDetail = { id: 0, kind: 'archetype', archetype: 'attack', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs };
  return artifactDamageProfile([a]);
}

function sortDe(detail: DetailMonstre, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(detail).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou non pris en charge`);
  return p;
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const auCentieme = (a: number, b: number) => Math.abs(a - b) < 0.01;

const TABLE = ATTAQUES_APPELEES_PAR_DECLENCHEUR as Record<number, AttaqueAppeleeConnue>;

// Injecte des entrées le temps de `corps`, puis rend à la table son état exact.
function avecEntrees(entrees: Record<number, AttaqueAppeleeConnue>, corps: () => void): void {
  const avant = JSON.stringify(TABLE);
  const sauvees = Object.keys(entrees).map((k) => [Number(k), TABLE[Number(k)]] as const);
  try {
    Object.assign(TABLE, entrees);
    corps();
  } finally {
    for (const [k, v] of sauvees) {
      if (v === undefined) delete TABLE[k];
      else TABLE[k] = v;
    }
  }
  egal(JSON.stringify(TABLE), avant, 'table de production restaurée après injection : aucune entrée de test ne reste');
}

const entree = (slotAppele: number, source: string): AttaqueAppeleeConnue => ({ slotAppele, source });

// Les attaques appelées que le chemin des passifs rend pour une fiche : celles
// dont l'identifiant est une compétence ACTIVE de la fiche.
function appeleesDe(detail: DetailMonstre): PassifOffensifProfile[] {
  const actives = new Set(detail.competences.filter((c) => !c.passif).map((c) => c.com2usId));
  return monsterOffensivePassives(detail).filter((p) => actives.has(p.skillCom2usId));
}

// Le profil construit À LA MAIN dans `tests/degats-mecanismes-generiques.test.ts`,
// (`attaqueAppelee`) : la référence du contrôle « même total au centième près ».
function attaqueAppeleeALaMain(appelee: SkillDamageProfile, slotsDeclencheurs: readonly number[]): PassifOffensifProfile {
  return {
    skillCom2usId: appelee.skillCom2usId,
    nom: appelee.nom,
    description: appelee.description,
    critique: 'suit',
    coupsDuSortActif: false,
    slotsDeclencheurs,
    categorie: { type: 'conditionnel', condition: 'la compétence appelée se déclenche à la suite du sort (probabilité non tirée : interrupteur)' },
    profile: appelee,
  };
}

const ATQ = 2000;
const ST = stats({ hp: 20000, atk: ATQ, def: 800, spd: 200, cr: 100, cd: 100 });
const BASE: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 100_000_000, enemyHpPct: 100, critMode: 'normal' };

// Réglages où comparer le chemin de production au profil construit à la main :
// interrupteur allumé et éteint, critique forcé avec un profil d'artéfacts qui
// touche chaque règle (224, 400, 401, 402, 411), cible petite avec 222.
function reglagesDeComparaison(declencheur: SkillDamageProfile, appelee: number): [string, DamageSetup, ArtifactDamageProfile][] {
  const sur = (actif: boolean): DamageSetup => ({ ...BASE, skillCom2usId: declencheur.skillCom2usId, passifsOffensifs: actif ? { [appelee]: true } : {} });
  const mix = artefacts([{ code: 224, value: 20 }, { code: 400, value: 15 }, { code: 401, value: 12 }, { code: 402, value: 9 }, { code: 411, value: 30 }]);
  return [
    ['interrupteur allumé', sur(true), ARTIFACT_DAMAGE_NEUTRE],
    ['interrupteur éteint', sur(false), ARTIFACT_DAMAGE_NEUTRE],
    ['critique, 224/400/401/402/411', { ...sur(true), critMode: 'crit' }, mix],
    ['cible entamée, 222', { ...sur(true), critMode: 'crit', enemyHp: 40_000 }, artefacts([{ code: 222, value: 30 }])],
  ];
}

// ── 1. Approvisionnement ─────────────────────────────────────────────────────

const RYU_FEU = 24012;
const SHORYUKEN_FEU = 13907;
const HADOKEN_FEU = 13902;

export function testAttaqueAppeleeApprovisionnement() {
  titre('Attaque appelée active — une ligne clée par le sort déclencheur, lue par le chemin des passifs');

  egal(Object.keys(TABLE), [], 'production : aucune entrée (la table n’en code aucune)');
  const ryu = fiche(RYU_FEU);
  const passifsAvant = monsterOffensivePassives(ryu);
  const sortsAvant = monsterDamageSkills(ryu);
  egal(appeleesDe(ryu), [], 'RYU feu sans entrée : aucune attaque appelée');
  const s1 = sortDe(ryu, HADOKEN_FEU);
  const s2 = sortDe(ryu, SHORYUKEN_FEU);

  avecEntrees({ [SHORYUKEN_FEU]: entree(1, 'test : RYU feu') }, () => {
    const appelees = appeleesDe(ryu);
    egal(appelees.map((p) => p.skillCom2usId), [HADOKEN_FEU], 'une ligne (déclencheur 13907, slot 1) suffit : Hadoken (13902) entre par monsterOffensivePassives');
    const a = appelees[0];
    if (!a) return;
    egal(a.profile, s1, 'profil = celui de la S1 dans « Compétence utilisée », champ pour champ (skillDamageProfile, même fiche)');
    ok(a.profile.passif !== true, 'marqueur « passif » absent : une S1 n’est pas un passif');
    egal(
      [a.slotsDeclencheurs, a.categorie.type, a.critique, a.coupsDuSortActif, a.selectionnableCommeSort, a.bonusPvCible],
      [[2], 'conditionnel', 'suit', false, undefined, undefined],
      'après le seul slot du déclencheur (2), sur interrupteur, sans ajustement propre à la boucle des passifs'
    );
    egal([a.nom, a.description], [s1.nom, s1.description], 'nom et prose : ceux de la compétence appelée');
    egal(monsterDamageSkills(ryu), sortsAvant, 'liste des sorts inchangée : la S1 n’est pas proposée une seconde fois');
    egal(defaultDamageSkill(monsterDamageSkills(ryu))?.skillCom2usId, SHORYUKEN_FEU, 'sort par défaut inchangé : Shoryuken (S2)');
    ok(passifPeutSuivre(a, s2), 'suit la S2');
    ok(!passifPeutSuivre(a, s1), 'S1 choisie : jamais ajoutée à elle-même (exclusion par identifiant de passifPeutSuivre)');
    ok(!passifPeutSuivre(a, { ...s2, slot: 3, skillCom2usId: 999_003 }), 'sort fictif de slot 3 : ne suit pas');

    // 411 — la neutralisation ne dépend pas du marqueur : toute la boucle des
    // passifs la reçoit ; la S1 choisie seule est la première attaque du tour.
    const crit: DamageSetup = { ...BASE, critMode: 'crit', passifsOffensifs: { [HADOKEN_FEU]: true } };
    const a411 = artefacts([{ code: 411, value: 30 }]);
    const sur = (m: number) => ATQ * m * 0.3 * defenseFactor(1000);
    const gain = (sort: SkillDamageProfile) => {
      const setup = { ...crit, skillCom2usId: sort.skillCom2usId };
      return computeTotalDamage(sort, monsterOffensivePassives(ryu), ST, setup, AUCUNE_AURA_PROPRE, null, a411)
        - computeTotalDamage(sort, monsterOffensivePassives(ryu), ST, setup, AUCUNE_AURA_PROPRE, null);
    };
    ok(proche(gain(s2), sur(6.1)), '411 : S2 + Hadoken appelé, la S2 seule (6,1 × ATQ) — jamais l’attaque appelée');
    ok(proche(gain(s1), sur(3.7)), '411 : S1 choisie seule, interrupteur resté allumé — elle est la première attaque du tour (3,7 × ATQ)');
  });
  egal(monsterOffensivePassives(ryu), passifsAvant, 'entrée retirée : la fiche rend de nouveau ses seuls passifs');

  titre('Attaque appelée active — jamais par nom : seules les formes qui portent le déclencheur la reçoivent');
  avecEntrees(
    { 13907: entree(1, 'test'), 13908: entree(1, 'test'), 13910: entree(1, 'test') },
    () => {
      const recoivent: number[] = [];
      const sansDeclencheur: number[] = [];
      for (const d of toutesLesFiches()) {
        if (!d.competences.some((c) => c.nom === 'Hadoken')) continue;
        if (appeleesDe(d).some((p) => p.nom === 'Hadoken')) recoivent.push(d.com2usId);
        else sansDeclencheur.push(d.com2usId);
      }
      egal(recoivent.sort((x, y) => x - y), [24002, 24003, 24005, 24012, 24013, 24015], 'Hadoken appelé : les six formes qui portent Shoryuken 13907, 13908 ou 13910');
      egal(sansDeclencheur.sort((x, y) => x - y), [24001, 24004, 24011, 24014, 24102, 24112], 'les six autres formes qui ont un « Hadoken » n’en reçoivent aucun (une clé par nom les aurait touchées)');
    }
  );

  titre('Attaque appelée active — les gardes du chemin frère (fiches dérivées de RYU feu)');
  const variante = (modifier: (cs: Competence[]) => Competence[]): DetailMonstre => ({
    ...ryu,
    competences: modifier(ryu.competences.map((c) => ({ ...c }))),
  });
  const brutS1 = ryu.competences.find((c) => c.com2usId === HADOKEN_FEU)!;
  const brutS2 = ryu.competences.find((c) => c.com2usId === SHORYUKEN_FEU)!;
  avecEntrees({ [SHORYUKEN_FEU]: entree(1, 'test') }, () => {
    egal(appeleesDe(variante((cs) => cs.map((c) => (c.com2usId === SHORYUKEN_FEU ? { ...c, passif: true } : c)))), [], 'déclencheur passif : écarté');
    egal(appeleesDe(variante((cs) => cs.map((c) => (c.com2usId === HADOKEN_FEU ? { ...c, passif: true } : c)))).length, 0, 'slot appelé occupé par un passif : écarté');
    egal(appeleesDe(variante((cs) => [...cs, { ...brutS2, com2usId: 999_207 }])), [], 'deux compétences au slot du déclencheur : écarté (le slot ne le désignerait plus seul)');
    egal(appeleesDe(variante((cs) => [...cs, { ...brutS1, com2usId: 999_201 }])), [], 'deux compétences au slot appelé : écarté');
    egal(appeleesDe(variante((cs) => cs.map((c) => (c.com2usId === HADOKEN_FEU ? { ...c, formule: '1.5*1.5**(1*TARGET_{DEF})+1' } : c)))), [], 'compétence appelée non calculable : écartée, jamais un nombre inventé');
    egal(appeleesDe(variante((cs) => cs.filter((c) => c.com2usId !== SHORYUKEN_FEU))), [], 'déclencheur absent de la fiche : rien');
  });
  avecEntrees({ [SHORYUKEN_FEU]: entree(4, 'test') }, () => {
    egal(appeleesDe(ryu), [], 'slot appelé vide : écarté');
  });
  avecEntrees({ [SHORYUKEN_FEU]: entree(2, 'test') }, () => {
    egal(appeleesDe(ryu), [], 'slot appelé = slot du déclencheur : écarté (un sort ne s’appelle pas lui-même)');
  });
}

// ── 2. Couverture des 17 amorces ─────────────────────────────────────────────

// Six S2 qui appellent leur S1 ;
// formes éveillées jouables. Valeurs des fiches : S2 `6.1*{ATK}`, S1
// `3.7*{ATK}`, chacune ses « Damage + » (+25 %), un coup, cible unique.
const CAS_178: { forme: number; monstre: string; s2: number; s1: number }[] = [
  { forme: 24012, monstre: 'RYU feu', s2: 13907, s1: 13902 },
  { forme: 24013, monstre: 'RYU vent', s2: 13908, s1: 13903 },
  { forme: 24015, monstre: 'RYU ténèbres', s2: 13910, s1: 13905 },
  { forme: 24512, monstre: 'Douglas feu', s2: 14407, s1: 14402 },
  { forme: 24513, monstre: 'Kashmir vent', s2: 14408, s1: 14403 },
  { forme: 24515, monstre: 'Vancliffe ténèbres', s2: 14410, s1: 14405 },
];

// Les amorces ACCEPTÉES : le sort déclencheur ne pose rien que
// Rolling Punch lise (vérifié au cas par cas plus bas). Rolling Punch : `1.8*{ATK}`,
// un coup, cible unique, ignore la DEF, « Damage + » 5/10/10 (+25 %).
const CAS_179: { amorce: number; forme: number; monstre: string; slot: number; nom: string; coef: number; coups: number; skillup: number; appelee: number }[] = [
  { amorce: 8107, forme: 17212, monstre: 'Xiao Chun (feu)', slot: 2, nom: 'Drunken Kick', coef: 2.0, coups: 3, skillup: 30, appelee: 8102 },
  { amorce: 8110, forme: 17215, monstre: 'Wei Shin (ténèbres)', slot: 2, nom: 'Drunken Kick', coef: 2.0, coups: 3, skillup: 30, appelee: 8105 },
  { amorce: 8113, forme: 17213, monstre: 'Huan (vent)', slot: 3, nom: 'Phoenix Kick', coef: 2.5, coups: 3, skillup: 20, appelee: 8103 },
  { amorce: 8114, forme: 17214, monstre: 'Tien Qin (lumière)', slot: 3, nom: 'Stork Kick', coef: 2.7, coups: 3, skillup: 20, appelee: 8104 },
  { amorce: 8115, forme: 17215, monstre: 'Wei Shin (ténèbres)', slot: 3, nom: 'Snake Punch', coef: 2.7, coups: 3, skillup: 40, appelee: 8105 },
];

// Le verdict de chacune des 17 amorces, avec
// sa raison. « acceptée » = une entrée de table suffit, total identique au
// profil construit à la main ; « classée » = mécanique voisine ou donnée
// manquante, jamais forcée.
const VERDICTS: Record<number, { verdict: 'acceptée' | 'classée'; raison: string }> = {
  6161: { verdict: 'classée', raison: 'déclencheur = un coup critique de n’importe quel sort, S1 comprise, qui appelle Energy Punch, elle-même la S1 : l’exclusion par identifiant l’interdit après la S1 ; condition liée au critique ; sorts déclencheurs et récursion non curés' },
  8106: { verdict: 'classée', raison: 'One More Drink est un soin : aucun profil de dégâts, jamais « Compétence utilisée » ; Rolling Punch y serait la première attaque du tour et recevrait 411, que la boucle des passifs neutralise' },
  8107: { verdict: 'acceptée', raison: 'Drunken Kick ne pose rien entre les deux attaques' },
  8108: { verdict: 'classée', raison: 'One More Drink (Huan) : même raison que 8106' },
  8109: { verdict: 'classée', raison: 'One More Drink (Tien Qin) : même raison que 8106' },
  8110: { verdict: 'acceptée', raison: 'Drunken Kick ne pose rien ; probabilité 30 % sans effet, interrupteur' },
  8111: { verdict: 'classée', raison: 'buff de VIT posé par Seal Punch, actif pour Rolling Punch et lu par la ligne 221 ; la boucle des passifs ne lit que le buff saisi' },
  8112: { verdict: 'classée', raison: 'buff d’ATQ posé par Tiger Punch, actif pour Rolling Punch ; la boucle des passifs ne lit que le buff saisi' },
  8113: { verdict: 'acceptée', raison: 'la réduction de DEF posée par Phoenix Kick est sans effet : Rolling Punch ignore la DEF' },
  8114: { verdict: 'acceptée', raison: 'le soin de Stork Kick ne porte que sur lui, Unrecoverable n’entre pas dans le calcul' },
  8115: { verdict: 'acceptée', raison: 'la hausse de TC de Snake Punch ne change pas le calcul visé ; la limite du mode Moyenne est tombée avec ce mode' },
  13907: { verdict: 'acceptée', raison: 'Shoryuken ; Marque posée par la S2 non modélisée, à relever avant de curer' },
  13908: { verdict: 'acceptée', raison: 'idem 13907' },
  13910: { verdict: 'acceptée', raison: 'idem 13907' },
  14407: { verdict: 'acceptée', raison: 'Iron Uppercut ; Marque posée par la S2 non modélisée, à relever avant de curer' },
  14408: { verdict: 'acceptée', raison: 'idem 14407' },
  14410: { verdict: 'acceptée', raison: 'idem 14407' },
};

export function testAttaqueAppeleeCouverture() {
  titre('Attaque appelée active — les 17 amorces de compétences appelées');

  egal(Object.keys(VERDICTS).map(Number).sort((a, b) => a - b),
    [6161, 8106, 8107, 8108, 8109, 8110, 8111, 8112, 8113, 8114, 8115, 13907, 13908, 13910, 14407, 14408, 14410],
    'les 17 amorces (« même architecture »), ni plus ni moins');
  const acceptees = Object.entries(VERDICTS).filter(([, v]) => v.verdict === 'acceptée').map(([k]) => Number(k));
  egal([acceptees.length, Object.keys(VERDICTS).length - acceptees.length], [11, 6], 'onze acceptées, six classées avec leur raison');
  egal(acceptees.sort((a, b) => a - b), [...CAS_179.map((c) => c.amorce), ...CAS_178.map((c) => c.s2)].sort((a, b) => a - b),
    'chaque amorce acceptée est exercée ci-dessous, une entrée chacune');

  const df = defenseFactor(1000);

  titre('Les six S2 de RYU et Striker, une entrée chacune, même total que le profil construit à la main');
  for (const c of CAS_178) {
    const detail = fiche(c.forme);
    const s1 = sortDe(detail, c.s1);
    const s2 = sortDe(detail, c.s2);
    avecEntrees({ [c.s2]: entree(1, `test : ${c.monstre}`) }, () => {
      const prod = monsterOffensivePassives(detail);
      egal(appeleesDe(detail).map((p) => p.skillCom2usId), [c.s1], `${c.monstre} : une entrée (déclencheur ${c.s2}, slot 1) → S1 ${c.s1}`);
      const main = [attaqueAppeleeALaMain(s1, [2])];
      for (const [nom, setup, art] of reglagesDeComparaison(s2, c.s1)) {
        const t = computeTotalDamage(s2, prod, ST, setup, AUCUNE_AURA_PROPRE, null, art);
        const r = computeTotalDamage(s2, main, ST, setup, AUCUNE_AURA_PROPRE, null, art);
        ok(auCentieme(t, r), `${c.monstre}, ${nom} : ${t.toFixed(2)} = profil construit à la main (${r.toFixed(2)}), au centième`);
      }
      const allume: DamageSetup = { ...BASE, skillCom2usId: c.s2, passifsOffensifs: { [c.s1]: true } };
      ok(proche(computeTotalDamage(s2, prod, ST, allume, AUCUNE_AURA_PROPRE, null), ATQ * (6.1 + 3.7) * 1.25 * df),
        `${c.monstre} : 2 000 × (6,1 + 3,7) × 1,25 × FacteurDéf, écrit à la main depuis les fiches`);
    });
  }

  titre('Les cinq amorces acceptées des Maîtres ivres, une entrée chacune');
  for (const c of CAS_179) {
    const detail = fiche(c.forme);
    const declencheur = sortDe(detail, c.amorce);
    const rolling = sortDe(detail, c.appelee);
    egal([declencheur.nom, declencheur.slot, declencheur.formule, declencheur.hits, declencheur.skillupDamagePct], [c.nom, c.slot, `${c.coef.toFixed(1)}*{ATK}`, c.coups, c.skillup],
      `${c.monstre} : ${c.nom} (S${c.slot}) = ${c.coef} × ATQ, ${c.coups} coups, +${c.skillup} % (fiche)`);
    egal([rolling.nom, rolling.slot, rolling.formule, rolling.hits, rolling.ignoreDef, rolling.aoe, rolling.skillupDamagePct], ['Rolling Punch', 1, '1.8*{ATK}', 1, true, false, 25],
      `${c.monstre} : Rolling Punch (S1) = 1,8 × ATQ, un coup, cible unique, ignore la DEF, +25 % (ses propres améliorations)`);
    avecEntrees({ [c.amorce]: entree(1, `test : ${c.monstre}`) }, () => {
      const prod = monsterOffensivePassives(detail);
      egal(appeleesDe(detail).map((p) => [p.skillCom2usId, p.slotsDeclencheurs]), [[c.appelee, [c.slot]]], `${c.monstre} : une entrée (déclencheur ${c.amorce}, slot 1) → Rolling Punch ${c.appelee}, après le seul S${c.slot}`);
      const main = [attaqueAppeleeALaMain(rolling, [c.slot])];
      for (const [nom, setup, art] of reglagesDeComparaison(declencheur, c.appelee)) {
        const t = computeTotalDamage(declencheur, prod, ST, setup, AUCUNE_AURA_PROPRE, null, art);
        const r = computeTotalDamage(declencheur, main, ST, setup, AUCUNE_AURA_PROPRE, null, art);
        ok(auCentieme(t, r), `${c.monstre}, ${nom} : ${t.toFixed(2)} = profil construit à la main (${r.toFixed(2)}), au centième`);
      }
      const allume: DamageSetup = { ...BASE, skillCom2usId: c.amorce, passifsOffensifs: { [c.appelee]: true } };
      const attendu = ATQ * c.coef * c.coups * (1 + c.skillup / 100) * df + ATQ * 1.8 * 1.25 * defenseFactor(0);
      ok(proche(computeTotalDamage(declencheur, prod, ST, allume, AUCUNE_AURA_PROPRE, null), attendu),
        `${c.monstre} : 2 000 × ${c.coef} × ${c.coups} × ${(1 + c.skillup / 100).toFixed(2)} × FacteurDéf + 2 000 × 1,8 × 1,25 sans DEF = ${attendu.toFixed(2)}`);
      ok(!passifPeutSuivre(appeleesDe(detail)[0], rolling), `${c.monstre} : Rolling Punch choisi seul n’est jamais ajouté à lui-même`);
    });
  }

  // Les effets que le déclencheur pose avant Rolling Punch : chaque raison
  // d'acceptation se vérifie sur le calcul, jamais par ressemblance.
  titre('Ce que le déclencheur pose ne change pas Rolling Punch (raisons des acceptations)');
  const rpHuan = sortDe(fiche(17213), 8103);
  const rpCalcul = (p: SkillDamageProfile, setup: DamageSetup, st = ST, art = ARTIFACT_DAMAGE_NEUTRE) =>
    computeSkillDamageDetail(p, st, setup, AUCUNE_AURA_PROPRE, null, undefined, art).total;
  ok(fiche(17213).competences.find((k) => k.com2usId === 8113)!.effets.some((e) => e.nom === 'Decrease DEF'), 'Huan : Phoenix Kick pose une réduction de DEF (fiche)');
  ok(proche(rpCalcul(rpHuan, { ...BASE, defBreak: true }), rpCalcul(rpHuan, BASE)), 'Huan : Rolling Punch ignore la DEF, la réduction posée ne le change pas');
  ok(fiche(17214).competences.find((k) => k.com2usId === 8114)!.effets.every((e) => ['Unrecoverable', 'Heal', 'Additional Attack'].includes(e.nom ?? '')),
    'Tien Qin : Stork Kick ne pose que Unrecoverable, un soin et l’attaque supplémentaire (fiche), rien que le calcul lise');
  const rpWei = sortDe(fiche(17215), 8105);
  const tc = (cr: number) => stats({ hp: 20000, atk: ATQ, def: 800, spd: 200, cr, cd: 100 });
  // Les deux modes restants : la « LIMITE ASSUMÉE » du mode Moyenne (la hausse
  // de TC posée par Snake Punch n'y était pas appliquée à Rolling Punch) est
  // retirée avec ce mode.
  for (const critMode of ['normal', 'crit'] as const) {
    ok(proche(rpCalcul(rpWei, { ...BASE, critMode }, tc(50)), rpCalcul(rpWei, { ...BASE, critMode }, tc(80))),
      `Wei Shin, mode ${critMode} : une hausse de TC ne change pas Rolling Punch`);
  }

  titre('Wei Shin : deux déclencheurs (S2 et S3) pour la même S1, un seul interrupteur');
  const wei = fiche(17215);
  avecEntrees({ 8110: entree(1, 'test'), 8115: entree(1, 'test') }, () => {
    const a = appeleesDe(wei);
    egal(a.map((p) => [p.skillCom2usId, p.slotsDeclencheurs]), [[8105, [2, 3]]], 'Wei Shin : un seul profil Rolling Punch (8105), après S2 OU S3');
    ok(passifPeutSuivre(a[0], sortDe(wei, 8110)) && passifPeutSuivre(a[0], sortDe(wei, 8115)) && !passifPeutSuivre(a[0], rpWei), 'suit Drunken Kick et Snake Punch, jamais lui-même');
  });

  titre('Les six amorces classées — chaque raison vérifiée sur la fiche ou le calcul');
  for (const [forme, id] of [[17211, 8106], [17213, 8108], [17214, 8109]] as const) {
    const d = fiche(forme);
    const omd = d.competences.find((k) => k.com2usId === id)!;
    ok(omd.nom === 'One More Drink' && omd.slot === 2 && omd.effets.some((e) => e.nom === 'Heal'), `${forme} : ${id} est One More Drink (S2), un soin (fiche)`);
    egal(skillDamageProfile(omd), null, `${forme} : aucun profil de dégâts pour One More Drink`);
    ok(!monsterDamageSkills(d).some((s) => s.slot === 2), `${forme} : aucun sort de slot 2 proposé — Rolling Punch n’aurait aucun déclencheur à suivre`);
    avecEntrees({ [id]: entree(1, 'test : amorce classée') }, () => {
      const a = appeleesDe(d)[0];
      ok(!!a && monsterDamageSkills(d).every((s) => !estPrisEnCharge(s) || !passifPeutSuivre(a, s)), `${forme} : une entrée forcée ne compterait jamais (aucun sort proposé à suivre)`);
    });
  }
  const st221 = artefacts([{ code: 221, value: 30 }]);
  const mao = fiche(17211);
  ok(mao.competences.find((k) => k.com2usId === 8111)!.effets.some((e) => e.nom === 'Increase ATK SPD'), 'Mao : Seal Punch pose un buff de VIT (fiche)');
  const rpMao = sortDe(mao, 8101);
  ok(proche(rpCalcul(rpMao, { ...BASE, spdBuff: true }), rpCalcul(rpMao, BASE)), 'Mao : sans ligne 221, le buff de VIT ne change pas Rolling Punch…');
  ok(!proche(rpCalcul(rpMao, { ...BASE, spdBuff: true }, ST, st221), rpCalcul(rpMao, BASE, ST, st221)),
    '… mais avec une ligne 221 (dégâts selon la VIT buffée), si : le buff que pose Seal Punch manquerait (8111 classée)');
  const xiao = fiche(17212);
  ok(xiao.competences.find((k) => k.com2usId === 8112)!.effets.some((e) => e.nom === 'Increase ATK'), 'Xiao Chun : Tiger Punch pose un buff d’ATQ (fiche)');
  const rpXiao = sortDe(xiao, 8102);
  ok(!proche(rpCalcul(rpXiao, { ...BASE, atkBuff: true }), rpCalcul(rpXiao, BASE)), 'Xiao Chun : le buff d’ATQ change Rolling Punch — celui que pose Tiger Punch manquerait (8112 classée)');
  const mina = fiche(15031);
  const h2h = mina.competences.find((k) => k.com2usId === 6161)!;
  ok(h2h.passif && h2h.effets.some((e) => e.nom === 'Additional Attack' && e.surCritique), 'Mina : Head to Head est un PASSIF, son attaque supplémentaire suit un coup critique (fiche)');
  ok((h2h.description ?? '').includes('[Energy Punch] when you attack with a critical hit on your turn'), 'Mina : la prose appelle Energy Punch après tout coup critique de son tour');
  const energyPunch = sortDe(mina, 6151);
  egal([energyPunch.nom, energyPunch.slot], ['Energy Punch', 1], 'Mina : Energy Punch est sa S1, proposée comme sort');
  ok(!passifPeutSuivre(attaqueAppeleeALaMain(energyPunch, [1, 2]), energyPunch), 'Mina : après un critique de la S1, l’exclusion par identifiant interdirait le second Energy Punch (6161 classée)');
}

// ── 3. Espace de clés de l'interrupteur ──────────────────────────────────────

// Ce qui, hors de l'interrupteur de l'attaque appelée, lit
// `passifsOffensifs[id]` pour une compétence : réglages du sort (conditions
// « manuel » et « effet néfaste présent », bonus conditionnel propre, bonus par
// effet binaire) et réglages du monstre (conditions de combat, bonus
// conditionnel, stats de combat à interrupteur partagé, bonus par effet
// binaire, passifs offensifs à bouton).
function reglagesSurLaCle(detail: DetailMonstre, id: number): string[] {
  const motifs: string[] = [];
  const binaireNefaste = (b: { source: string; maxCount?: number } | undefined | null) => !!b && b.source !== 'buffs' && b.maxCount === 1;
  for (const s of monsterDamageSkills(detail)) {
    if (!estPrisEnCharge(s) || s.skillCom2usId !== id) continue;
    for (const c of s.conditionsCombat ?? []) if (c.type === 'manuel' || c.type === 'debuffCiblePresent') motifs.push(`condition « ${c.type} » du sort`);
    if (s.bonusConditionnelPropre) motifs.push('bonus conditionnel propre au sort');
    if (binaireNefaste(s.bonusParEffetCible)) motifs.push('bonus par effet néfaste du sort');
  }
  for (const c of monsterConditionsCombat(detail)) {
    if (c.skillCom2usId === id && (c.condition.type === 'manuel' || c.condition.type === 'debuffCiblePresent')) motifs.push(`condition de combat « ${c.condition.type} »`);
  }
  if (monsterBonusDegatsConditionnel(detail)?.skillCom2usId === id) motifs.push('bonus de dégâts conditionnel');
  for (const p of monsterCombatStatProfiles(detail)) {
    if (p.skillCom2usId === id && p.source === 'toggle' && p.togglePartageCondition) motifs.push('stat de combat à interrupteur partagé');
  }
  const parEffet = monsterBonusParEffetCible(detail);
  if (parEffet?.skillCom2usId === id && binaireNefaste(parEffet)) motifs.push('bonus du monstre par effet néfaste');
  const passifsFiche = new Set(detail.competences.filter((c) => c.passif).map((c) => c.com2usId));
  for (const p of monsterOffensivePassives(detail)) {
    if (p.skillCom2usId === id && passifsFiche.has(id) && p.categorie.type !== 'toujours') motifs.push('passif offensif à bouton');
  }
  return motifs;
}

// Les compétences appelées par les 17 amorces, dans leur forme éveillée.
const APPELEES_DES_17: { forme: number; appelee: number; amorces: number[] }[] = [
  { forme: 15031, appelee: 6151, amorces: [6161] },
  { forme: 17211, appelee: 8101, amorces: [8106, 8111] },
  { forme: 17212, appelee: 8102, amorces: [8107, 8112] },
  { forme: 17213, appelee: 8103, amorces: [8108, 8113] },
  { forme: 17214, appelee: 8104, amorces: [8109, 8114] },
  { forme: 17215, appelee: 8105, amorces: [8110, 8115] },
  { forme: 24012, appelee: 13902, amorces: [13907] },
  { forme: 24013, appelee: 13903, amorces: [13908] },
  { forme: 24015, appelee: 13905, amorces: [13910] },
  { forme: 24512, appelee: 14402, amorces: [14407] },
  { forme: 24513, appelee: 14403, amorces: [14408] },
  { forme: 24515, appelee: 14405, amorces: [14410] },
];

function monstreChargé(com2usId: number): LoadedMonster {
  return {
    unitId: 1,
    com2usId,
    monsterName: 'test',
    // Jamais lus par `resolveObjectiveStats`, qui ne lit que l'espèce.
    gear: { base: { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 }, runes: [], artifacts: [] },
    allRunes: [],
    allArtifacts: [],
    allRelics: [],
  };
}

// Le score complet d'une recette (tous les modificateurs du monstre, comme le
// CLI et le moteur) et ses stats à privilégier.
function scoreEtStats(forme: number, setup: DamageSetup): { score: number; stats: StatKey[] | undefined } {
  const recette = { objective: 'degats_reels', damageSetup: setup } as unknown as OptimizerRecipe;
  const ctx = buildRealDamageContext(recette, forme, []);
  if (!ctx) throw new Error(`aucun contexte « Dégâts réels » pour ${forme}`);
  const score = computeTotalDamage(
    ctx.profile, ctx.passifs, ST, ctx.setup, AUCUNE_AURA_PROPRE, ctx.element, ctx.artefacts, ctx.critSiPlusRapide,
    ctx.bonusDegatsSelonVit, ctx.bonusDegatsStack, ctx.monsterWide, ctx.bonusDegatsConditionnel, ctx.bonusDegatsSelonCr,
    ctx.bonusDegatsSelonDef, ctx.bonusSiAtqSeuil
  );
  return { score, stats: resolveObjectiveStats(recette, monstreChargé(forme)) };
}

export function testAttaqueAppeleeEspaceDeCles() {
  titre('Attaque appelée active — la clé de son interrupteur n’est partagée avec aucun réglage du même sort');

  egal(APPELEES_DES_17.flatMap((a) => a.amorces).sort((x, y) => x - y), Object.keys(VERDICTS).map(Number).sort((x, y) => x - y),
    'les compétences appelées par les 17 amorces, toutes examinées');
  for (const { forme, appelee, amorces } of APPELEES_DES_17) {
    const d = fiche(forme);
    // Structure : aucun lecteur connu de `passifsOffensifs[appelee]`.
    egal(reglagesSurLaCle(d, appelee), [], `${forme} : la compétence appelée ${appelee} (amorces ${amorces.join(', ')}) ne porte aucun réglage dans passifsOffensifs`);
    // Comportement : sans attaque appelée, allumer cette clé ne change ni le
    // score complet ni les stats à privilégier, pour chaque sort proposé.
    for (const s of monsterDamageSkills(d)) {
      if (!estPrisEnCharge(s)) continue;
      const sans = scoreEtStats(forme, { ...BASE, skillCom2usId: s.skillCom2usId, passifsOffensifs: {} });
      const avec = scoreEtStats(forme, { ...BASE, skillCom2usId: s.skillCom2usId, passifsOffensifs: { [appelee]: true } });
      ok(sans.score === avec.score && JSON.stringify(sans.stats) === JSON.stringify(avec.stats),
        `${forme}, sort ${s.skillCom2usId} choisi : la clé ${appelee} allumée ne change ni le score complet ni les stats à privilégier`);
    }
  }

  // Garde des entrées FUTURES : toute attaque appelée que la production rend,
  // sur tout le corpus, doit avoir une clé libre. Vide aujourd'hui (aucune
  // entrée) ; exercée ici sur les onze amorces acceptées pour qu'elle ne soit
  // jamais vide de sens.
  titre('Attaque appelée active — garde du corpus : toute attaque appelée de production a une clé libre');
  const gardeDuCorpus = (): { formes: number; collisions: string[] } => {
    let formes = 0;
    const collisions: string[] = [];
    for (const d of toutesLesFiches()) {
      const appelees = appeleesDe(d);
      if (appelees.length > 0) formes++;
      for (const p of appelees) for (const m of reglagesSurLaCle(d, p.skillCom2usId)) collisions.push(`${d.com2usId}:${p.skillCom2usId} — ${m}`);
    }
    return { formes, collisions };
  };
  egal(gardeDuCorpus(), { formes: 0, collisions: [] }, 'production : aucune forme ne reçoit d’attaque appelée (table vide), donc aucune collision');
  const entreesAcceptees = Object.fromEntries(
    Object.entries(VERDICTS).filter(([, v]) => v.verdict === 'acceptée').map(([k]) => [Number(k), entree(1, 'test : amorce acceptée')])
  );
  avecEntrees(entreesAcceptees, () => {
    const g = gardeDuCorpus();
    ok(g.formes >= 10, `les onze amorces acceptées injectées : ${g.formes} formes reçoivent une attaque appelée (la garde s’exerce)`);
    egal(g.collisions, [], 'aucune de leurs clés n’est partagée avec un réglage');
  });
}
