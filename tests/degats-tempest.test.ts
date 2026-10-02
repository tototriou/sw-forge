// Tempest (Teshar vent, Phoenix vent) — chantier degats-et-aura, lots 9a et 9b.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un passif dont SWARFARM ne porte
// AUCUNE formule (`formule: ""`) écarté en silence par la garde historique
// `!c.formule` de `monsterOffensivePassives`, alors que sa formule curée
// existe dans `FORMULES_CUREES_PAR_ID`. Le joueur cocherait Tempest et ne
// verrait rien changer, sans aucun message. Et depuis 9b, Tempest choisi
// comme sort compté DEUX fois (lui-même, puis le passif resté allumé), ou
// devenu le sort par défaut de Teshar à la place de son S2.
//
// Valeurs de jeu (cadrage degats-et-aura, A.2 ter, utilisateur le 2026-09-23,
// concordant avec l'audit `other_skill=1181`) : `3.7 × ATQ`, en zone, trois
// améliorations « Damage +10% » (+30 %) appliquées à ses dégâts ; seul, une
// seule contribution, jamais 411 ; 402/410 une fois (controle-1c1-amendement).

import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { Competence, DetailMonstre } from '../src/lib/monsterSkills';
import { ArtifactDetail } from '../src/types';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  type ArtifactDamageProfile,
  artifactDamageProfile,
  champsDuCombat,
  computeSkillDamage,
  computeSkillDamageDetail,
  computeTotalDamage,
  damageRelevantStats,
  defaultDamageSkill,
  estPrisEnCharge,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifActif,
  passifCompte,
  passifPeutSuivre,
  resolveDamageSkill,
  skillDamageProfile,
  type PassifOffensifProfile,
} from '../src/lib/damage';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { resolveObjectiveStats } from '../scripts/lib/recipeToSearchParams';
import { LoadedMonster } from '../scripts/lib/loadMonster';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

const TESHAR = 14513;
const PHOENIX_VENT = 14503;
const TEMPEST = 3213;
const ARCANE_BLAST = 3203; // S1 de Teshar
const LIGHTNING_NOVA = 3208; // S2 de Teshar

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

// Profil de RÉFÉRENCE `1 × ATQ`, en zone, de slot 3 comme Tempest : un oracle
// indépendant de la table curée. Toute la chaîne de calcul étant linéaire en
// le coefficient, la contribution de Tempest doit valoir EXACTEMENT 3.7 fois
// celle d'une référence portant les MÊMES améliorations (+30 %), quel que soit
// le mode critique. ⚠️ Sans amélioration, le rapport ne vaut `3.7 × 1.30`
// qu'en « Non critique » : en critique, le modèle place les améliorations dans
// le même terme que les Dgts CRIT (additif), pas en facteur séparé.
function referenceUnAtq(skillupDamagePct: number): SkillDamageProfile {
  return { ...profilSynthetique('1*{ATK}', 3, true), skillupDamagePct };
}

function profilSynthetique(formule: string, slot: number, aoe: boolean): SkillDamageProfile {
  const c: Competence = {
    id: 1, com2usId: 999_001, nom: 'Synthétique', description: null, slot, passif: false, aoe,
    cooldown: null, coups: 1, niveauMax: 1, formule, scale: [], ameliorations: [],
    icone: null, effets: [],
  };
  const p = skillDamageProfile(c);
  if (!p || !estPrisEnCharge(p)) throw new Error(`profil synthétique illisible : ${formule}`);
  return p;
}

function artefacts(subs: { code: number; value: number }[]): ArtifactDamageProfile {
  const a: ArtifactDetail = { id: 0, kind: 'archetype', archetype: 'attack', level: 1, rarity: 5, main: { code: 100, value: 300 }, subs };
  return artifactDamageProfile([a]);
}

function sortDe(detail: DetailMonstre, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(detail).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou non pris en charge`);
  return p;
}

function tempestDe(detail: DetailMonstre): PassifOffensifProfile | undefined {
  return monsterOffensivePassives(detail).find((p) => p.skillCom2usId === TEMPEST);
}

/** Point 1 — la formule curée d'un passif passe par la table curée. */
export function testDegatsTempestFormule() {
  titre('Tempest — la formule curée d’un passif sans formule SWARFARM est lue');

  for (const forme of [TESHAR, PHOENIX_VENT]) {
    const detail = fiche(forme);
    const brute = detail.competences.find((c) => c.com2usId === TEMPEST);
    ok(
      brute != null && brute.passif && brute.formule === '' && brute.aoe && brute.slot === 3,
      `${forme} : la donnée brute est bien un passif de slot 3, en zone, SANS formule (« » dans SWARFARM)`
    );
    const tempest = tempestDe(detail);
    ok(tempest != null, `${forme} : Tempest est reconnu comme passif offensif malgré « formule: "" » (formule de la table curée)`);
    if (!tempest) continue;
    egal(tempest.profile.formule, '3.7*{ATK}', `${forme} : formule retenue = 3.7 × ATQ (A.2 ter, utilisateur + audit other_skill=1181)`);
    egal(tempest.profile.variables, ['ATK'], `${forme} : la formule curée est analysée comme une formule de données (ATQ seule)`);
    egal(tempest.profile.skillupDamagePct, 30, `${forme} : les trois « Damage +10% » s’appliquent (+30 %, A.2 ter)`);
    egal(tempest.profile.aoe, true, `${forme} : en zone (donnée « aoe » du passif)`);
    egal(tempest.profile.slot, 3, `${forme} : slot 3 (celui des lignes d’artéfact 402/410)`);
    egal(tempest.profile.hits, 1, `${forme} : une seule instance (« once more »), jamais Competence.coups`);
    egal(tempest.profile.fixed, false, `${forme} : pas de dégâts fixes`);
    egal(tempest.profile.ignoreDef, false, `${forme} : n’ignore pas la DEF`);
    egal(tempest.categorie.type, 'conditionnel', `${forme} : interrupteur (recharge non simulée, A.2 ter)`);
    egal(tempest.critique, 'suit', `${forme} : critique comme le mode choisi`);
  }

  const teshar = fiche(TESHAR);
  egal(
    defaultDamageSkill(monsterDamageSkills(teshar))?.skillCom2usId,
    LIGHTNING_NOVA,
    'Teshar : le sort par défaut reste le S2 (Lightning Nova), jamais Tempest (choisissable depuis 9b, voir testDegatsTempestCommeSort)'
  );

  const tempest = tempestDe(teshar);
  if (!tempest) {
    ok(false, 'Teshar : Tempest absent des passifs offensifs — le calcul ne peut pas être vérifié');
    return;
  }
  const s2 = sortDe(teshar, LIGHTNING_NOVA);
  const st = stats({ atk: 3000, cr: 100, cd: 150 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: LIGHTNING_NOVA, summonerSkills: 'combat' };
  const passifs = monsterOffensivePassives(teshar);

  ok(!passifActif(tempest, base), 'Tempest désactivé par défaut, jamais deviné actif');
  egal(
    computeTotalDamage(s2, passifs, st, base, AUCUNE_AURA_PROPRE, null),
    computeSkillDamage(s2, st, base, AUCUNE_AURA_PROPRE, null),
    'interrupteur éteint : le total vaut le seul S2, au bit près'
  );

  const actif: DamageSetup = { ...base, passifsOffensifs: { [TEMPEST]: true } };
  const contributionTempest = (setup: DamageSetup) =>
    computeTotalDamage(s2, passifs, st, setup, AUCUNE_AURA_PROPRE, null) - computeSkillDamage(s2, st, setup, AUCUNE_AURA_PROPRE, null);
  for (const critMode of ['normal', 'crit', 'moyenne'] as const) {
    const setup = { ...actif, critMode };
    const rapport = contributionTempest(setup) / computeSkillDamage(referenceUnAtq(30), st, setup, AUCUNE_AURA_PROPRE, null);
    ok(
      Math.abs(rapport - 3.7) < 1e-9,
      `mode ${critMode} : interrupteur allumé, Tempest ajoute exactement 3.7 fois un « 1 × ATQ » de référence aux mêmes +30 % (reçu ${rapport.toFixed(6)})`
    );
  }
  const normal = { ...actif, critMode: 'normal' as const };
  const rapportSansAmelioration = contributionTempest(normal) / computeSkillDamage(referenceUnAtq(0), st, normal, AUCUNE_AURA_PROPRE, null);
  ok(
    Math.abs(rapportSansAmelioration - 3.7 * 1.3) < 1e-9,
    `« Non critique » : contre une référence SANS amélioration, le rapport vaut 3.7 × 1.30 — les +30 % comptent (reçu ${rapportSansAmelioration.toFixed(6)})`
  );
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Point 2 — Tempest se déclenche après S1 ou S2 (A.2 ter), lu avec le slot du
 * sort RETENU par `computeTotalDamage` ET `damageRelevantStats` ; les lignes
 * d'artéfact suivent le chemin passif existant (prouvé ici, pas recodé).
 */
export function testDegatsTempestDeclenchement() {
  titre('Tempest — déclenché après S1 ou S2 seulement, artéfacts du chemin passif');

  const teshar = fiche(TESHAR);
  const passifs = monsterOffensivePassives(teshar);
  const tempest = tempestDe(teshar);
  if (!tempest) {
    ok(false, 'Teshar : Tempest absent des passifs offensifs — le déclenchement ne peut pas être vérifié');
    return;
  }
  egal(tempest.slotsDeclencheurs, [1, 2], 'slots déclencheurs curés : S1 et S2 (A.2 ter)');

  const s1 = sortDe(teshar, ARCANE_BLAST);
  const s2 = sortDe(teshar, LIGHTNING_NOVA);
  // ⚠️ Sort FICTIF : Teshar n'a aucun S3 actif (son slot 3 est Tempest
  // lui-même). Il n'existe que pour vérifier que le champ curé est bien LU —
  // sans lui, rien n'empêcherait Tempest de suivre un autre slot.
  const s3Fictif: SkillDamageProfile = { ...s2, slot: 3, skillCom2usId: 999_003 };
  const st = stats({ atk: 3000, cr: 100, cd: 150 });
  const actif: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    summonerSkills: 'combat',
    critMode: 'crit',
    enemyHp: 100_000_000,
    passifsOffensifs: { [TEMPEST]: true },
  };
  const attendu = 3.7 * computeSkillDamage(referenceUnAtq(30), st, actif, AUCUNE_AURA_PROPRE, null);
  const contribution = (sort: SkillDamageProfile, setup: DamageSetup, art: ArtifactDamageProfile = ARTIFACT_DAMAGE_NEUTRE, s = st) =>
    computeTotalDamage(sort, passifs, s, setup, AUCUNE_AURA_PROPRE, null, art) -
    computeSkillDamageDetail(sort, s, setup, AUCUNE_AURA_PROPRE, null, undefined, art).total;

  for (const [nom, sort] of [['S1', s1], ['S2', s2]] as const) {
    const setup = { ...actif, skillCom2usId: sort.skillCom2usId };
    ok(passifCompte(tempest, sort, setup), `${nom} choisi, interrupteur allumé : Tempest compte`);
    ok(proche(contribution(sort, setup), attendu), `${nom} choisi : Tempest ajoute ses 3.7 × ATQ (+30 %) au ${nom}`);
    ok(!passifCompte(tempest, sort, { ...setup, passifsOffensifs: {} }), `${nom} choisi, interrupteur éteint : Tempest ne compte pas`);
  }

  // `setup.skillCom2usId` à `null` (« le sort par défaut ») : le slot vient du
  // sort RÉSOLU (S2), jamais de l'identifiant stocké.
  const parDefaut: DamageSetup = { ...actif, skillCom2usId: null };
  const resolu = resolveDamageSkill(monsterDamageSkills(teshar), parDefaut.skillCom2usId);
  egal(resolu?.skillCom2usId, LIGHTNING_NOVA, 'skillCom2usId null : le sort résolu est le S2');
  ok(resolu != null && proche(contribution(resolu, parDefaut), attendu), 'skillCom2usId null : Tempest suit le S2 résolu');

  const setupS3 = { ...actif, skillCom2usId: s3Fictif.skillCom2usId };
  ok(!passifCompte(tempest, s3Fictif, setupS3), 'sort fictif de slot 3 : Tempest ne compte pas, même interrupteur allumé');
  egal(
    computeTotalDamage(s3Fictif, passifs, st, setupS3, AUCUNE_AURA_PROPRE, null),
    computeSkillDamage(s3Fictif, st, setupS3, AUCUNE_AURA_PROPRE, null),
    'sort fictif de slot 3 : le total vaut ce sort seul, au bit près — computeTotalDamage lit les slots déclencheurs'
  );

  // `damageRelevantStats` suit EXACTEMENT le même filtre (invariant « même
  // interrupteur que computeTotalDamage ») : un sort fictif à la DEF seule ne
  // fait travailler l'ATQ que par Tempest.
  const defSeulS2 = profilSynthetique('1*{DEF}', 2, false);
  const defSeulS3 = { ...defSeulS2, slot: 3 };
  ok(damageRelevantStats(defSeulS2, passifs, actif).includes('atk'), 'stats à privilégier, sort DEF de slot 2 + Tempest allumé : l’ATQ entre (par Tempest)');
  ok(!damageRelevantStats(defSeulS3, passifs, actif).includes('atk'), 'stats à privilégier, sort DEF de slot 3 + Tempest allumé : l’ATQ n’entre pas — damageRelevantStats lit les slots déclencheurs');
  ok(!damageRelevantStats(defSeulS2, passifs, { ...actif, passifsOffensifs: {} }).includes('atk'), 'stats à privilégier, Tempest éteint : l’ATQ n’entre pas');
  ok(
    damageRelevantStats(defSeulS2, passifs, actif).includes('atk') === contribution(defSeulS2, actif) > 0 &&
      damageRelevantStats(defSeulS3, passifs, actif).includes('atk') === contribution(defSeulS3, actif) > 0,
    'damageRelevantStats et computeTotalDamage s’accordent sur Tempest, slot par slot'
  );

  titre('Tempest — les lignes d’artéfact après S1/S2 (chemin passif existant)');

  for (const [nom, sort, ligneDuSort] of [['S1', s1, 400], ['S2', s2, 401]] as const) {
    const setup = { ...actif, skillCom2usId: sort.skillCom2usId };
    const nu = contribution(sort, setup);
    const sortSeul = (art: ArtifactDamageProfile) => computeSkillDamageDetail(sort, st, setup, AUCUNE_AURA_PROPRE, null, undefined, art).total;

    // 411 — « premier coup du tour seulement ; jamais sur Tempest » (A.2 ter).
    const a411 = artefacts([{ code: 411, value: 30 }]);
    ok(sortSeul(a411) > sortSeul(ARTIFACT_DAMAGE_NEUTRE), `${nom} : 411 majore bien le premier coup du tour, celui du ${nom}`);
    ok(proche(contribution(sort, setup, a411), nu), `${nom} : 411 ne s’applique jamais à Tempest`);

    // 402 et 410 — « s'appliquent une fois à Tempest, compétence de slot 3 »
    // (utilisateur, 2026-09-23, controle-1c1-amendement L73-75). Oracle : les
    // mêmes points en Dgts CRIT de fiche, une fois — jamais deux.
    const statsPlus = (pts: number) => stats({ atk: 3000, cr: 100, cd: 150 + pts });
    const uneFois = contribution(sort, setup, ARTIFACT_DAMAGE_NEUTRE, statsPlus(20));
    const deuxFois = contribution(sort, setup, ARTIFACT_DAMAGE_NEUTRE, statsPlus(40));
    for (const code of [402, 410]) {
      const art = artefacts([{ code, value: 20 }]);
      const avec = contribution(sort, setup, art);
      ok(proche(avec, uneFois) && !proche(avec, deuxFois), `${nom} : ${code} (+20) s’applique UNE fois à Tempest`);
      ok(proche(sortSeul(art), sortSeul(ARTIFACT_DAMAGE_NEUTRE)), `${nom} : ${code} ne touche pas le ${nom} (slot ${sort.slot})`);
    }

    // La ligne du sort déclencheur (400 pour S1, 401 pour S2) reste au sort :
    // Tempest n'en hérite jamais (cadrage, lot 9 « Artéfacts »).
    const aSort = artefacts([{ code: ligneDuSort, value: 20 }]);
    ok(sortSeul(aSort) > sortSeul(ARTIFACT_DAMAGE_NEUTRE), `${nom} : ${ligneDuSort} majore le ${nom}`);
    ok(proche(contribution(sort, setup, aSort), nu), `${nom} : Tempest n’hérite pas de la ligne ${ligneDuSort} du ${nom}`);

    // 224 — mono-cible seulement : jamais sur Tempest, en zone.
    const a224 = artefacts([{ code: 224, value: 20 }]);
    ok(sortSeul(a224) > sortSeul(ARTIFACT_DAMAGE_NEUTRE), `${nom} : 224 majore le ${nom}, mono-cible`);
    ok(proche(contribution(sort, setup, a224), nu), `${nom} : 224 ne s’applique jamais à Tempest (zone)`);

    // 222/223 — Tempest voit les PV laissés par le S1/S2 (utilisateur,
    // 2026-09-23, controle-1c1-amendement L80-81). Cible entamée par le sort :
    // la rampe vaut `points × f` (222) ou `points × (1 − f)` (223), avec f la
    // fraction de PV que le sort laisse — jamais celle du réglage (100 %).
    const entamee: DamageSetup = { ...setup, enemyHp: 60_000, enemyHpPct: 100 };
    for (const code of [222, 223]) {
      const art = artefacts([{ code, value: 30 }]);
      const f = computeSkillDamageDetail(sort, st, entamee, AUCUNE_AURA_PROPRE, null, undefined, art).pvRestantsPct / 100;
      const pts = 30 * (code === 222 ? f : 1 - f);
      const ptsSurPvInitiaux = code === 222 ? 30 : 0;
      ok(f > 0.05 && f < 0.95, `${nom}, ${code} : le ${nom} entame bien la cible (PV restants ${(f * 100).toFixed(1)} %)`);
      const avec = contribution(sort, entamee, art);
      ok(
        proche(avec, contribution(sort, entamee, ARTIFACT_DAMAGE_NEUTRE, statsPlus(pts))) &&
          !proche(avec, contribution(sort, entamee, ARTIFACT_DAMAGE_NEUTRE, statsPlus(ptsSurPvInitiaux))),
        `${nom}, ${code} : Tempest lit les PV laissés par le ${nom}, pas ceux du réglage`
      );
    }
  }
}

/**
 * 9b — Tempest comme sort (cadrage degats-et-aura, lot 9, point 3 ; A.2 ter
 * « Artéfact 411 » et « Tempest seul » ; controle-1c1-amendement L73-75). Un
 * passif curé `selectionnableCommeSort` entre dans la liste des sorts avec SON
 * profil de passif ; jamais le sort par défaut ; choisi, une seule
 * contribution (jamais ajouté à lui-même), sans 411, 402/410 une fois, sans
 * 224 (zone), sur les PV saisis.
 */
export function testDegatsTempestCommeSort() {
  titre('Tempest comme sort — liste des sorts, sort par défaut, résolution (degats-et-aura 9b)');

  for (const forme of [TESHAR, PHOENIX_VENT]) {
    const detail = fiche(forme);
    const sorts = monsterDamageSkills(detail);
    const tempest = tempestDe(detail);
    const commeSort = sorts.find((s) => s.skillCom2usId === TEMPEST);
    if (!tempest || !commeSort || !estPrisEnCharge(commeSort)) {
      ok(false, `${forme} : Tempest absent des sorts ou des passifs — le choix comme sort ne peut pas être vérifié`);
      continue;
    }
    egal(commeSort, tempest.profile, `${forme} : le sort « Tempest » EST le profil du passif, champ pour champ — une seule source`);
    egal(commeSort.passif, true, `${forme} : profil marqué « passif »`);
    egal(sorts.map((s) => s.slot), [1, 2, 3], `${forme} : S1, S2 puis Tempest (S3), dans l’ordre des slots`);
    egal(defaultDamageSkill(sorts)?.skillCom2usId, LIGHTNING_NOVA, `${forme} : le sort par défaut reste le S2, jamais Tempest (réponse n° 9 de l’utilisateur)`);
    egal(resolveDamageSkill(sorts, null)?.skillCom2usId, LIGHTNING_NOVA, `${forme} : sort non précisé (null) → S2`);
    egal(resolveDamageSkill(sorts, TEMPEST)?.skillCom2usId, TEMPEST, `${forme} : sort 3213 demandé (l’identifiant d’un passif) → Tempest`);
  }

  // Garde du corpus : seul 3213 est sélectionnable, sur ses deux formes, sans
  // ajustement que la boucle des passifs serait seule à porter (`critique`
  // hors `'suit'`, `coupsDuSortActif`, `bonusPvCible`, catégorie autre que
  // `conditionnel`) — choisi seul, il est calculé comme un sort. Et aucun
  // monstre du corpus n'a un passif pour sort par défaut.
  const selectionnables: string[] = [];
  const ajustementsInterdits: string[] = [];
  const passifParDefaut: string[] = [];
  for (const f of readdirSync(DOSSIER_SORTS)) {
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    for (const p of monsterOffensivePassives(d)) {
      if (!p.selectionnableCommeSort) continue;
      selectionnables.push(`${f.replace(/\.json$/, '')}:${p.skillCom2usId}`);
      if (p.critique !== 'suit' || p.coupsDuSortActif || p.bonusPvCible || p.categorie.type !== 'conditionnel') {
        ajustementsInterdits.push(`${f} : ${p.nom}`);
      }
    }
    if (defaultDamageSkill(monsterDamageSkills(d))?.passif) passifParDefaut.push(f);
  }
  egal(selectionnables.sort(), ['14503:3213', '14513:3213'], 'corpus : seul Tempest (3213) est un passif sélectionnable, sur Phoenix vent et Teshar');
  egal(ajustementsInterdits, [], 'corpus : aucun passif sélectionnable ne porte d’ajustement propre à la boucle des passifs');
  egal(passifParDefaut, [], 'corpus : aucun monstre n’a un passif pour sort par défaut');

  titre('Tempest comme sort — une seule contribution, jamais ajouté à lui-même');

  const teshar = fiche(TESHAR);
  const passifs = monsterOffensivePassives(teshar);
  const tempest = tempestDe(teshar);
  if (!tempest) {
    ok(false, 'Teshar : Tempest absent des passifs offensifs — le calcul du cran « Tempest seul » ne peut pas être vérifié');
    return;
  }
  const seul = tempest.profile;
  const s1 = sortDe(teshar, ARCANE_BLAST);
  const s2 = sortDe(teshar, LIGHTNING_NOVA);
  const st = stats({ atk: 3000, cr: 100, cd: 150 });
  // Interrupteur resté ALLUMÉ : choisi comme sort, Tempest ne s'ajoute pas
  // pour autant une seconde fois.
  const actif: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    summonerSkills: 'combat',
    critMode: 'crit',
    enemyHp: 100_000_000,
    passifsOffensifs: { [TEMPEST]: true },
  };
  const choisi: DamageSetup = { ...actif, skillCom2usId: TEMPEST };
  const setupS2: DamageSetup = { ...actif, skillCom2usId: LIGHTNING_NOVA };
  ok(!passifPeutSuivre(tempest, seul) && !passifCompte(tempest, seul, choisi), 'Tempest choisi : son passif ne le suit pas, même interrupteur allumé');
  ok(passifPeutSuivre(tempest, s1) && passifPeutSuivre(tempest, s2), 'S1 ou S2 choisi : Tempest peut les suivre');
  const totalSeul = computeTotalDamage(seul, passifs, st, choisi, AUCUNE_AURA_PROPRE, null);
  egal(
    totalSeul,
    computeSkillDamage(seul, st, choisi, AUCUNE_AURA_PROPRE, null),
    'Tempest choisi, interrupteur allumé : le total vaut Tempest seul, au bit près — une seule contribution (A.2 ter, « Tempest seul »)'
  );
  const apresS2 = computeTotalDamage(s2, passifs, st, setupS2, AUCUNE_AURA_PROPRE, null) - computeSkillDamage(s2, st, setupS2, AUCUNE_AURA_PROPRE, null);
  ok(proche(totalSeul, apresS2), 'Tempest seul vaut exactement ce qu’il ajoute après le S2 (même profil, sans artéfact)');
  ok(
    proche(totalSeul, 3.7 * computeSkillDamage(referenceUnAtq(30), st, choisi, AUCUNE_AURA_PROPRE, null)),
    'Tempest seul = 3.7 fois un « 1 × ATQ » de référence aux mêmes +30 %'
  );

  // Mécanisme générique : un passif sélectionnable SANS slots déclencheurs (un
  // futur cas de même architecture) suivrait n'importe quel sort — sauf
  // lui-même. Ici, seule l'exclusion par identifiant l'empêche de doubler.
  const sansSlots: PassifOffensifProfile = { ...tempest, slotsDeclencheurs: undefined };
  ok(!passifPeutSuivre(sansSlots, seul), 'générique, sans slots déclencheurs : un passif ne suit jamais le sort qu’il est lui-même');
  ok(passifPeutSuivre(sansSlots, { ...s2, slot: 3, skillCom2usId: 999_003 }), 'générique, sans slots déclencheurs : il suit un autre sort, même de slot 3');
  egal(
    computeTotalDamage(seul, [sansSlots], st, choisi, AUCUNE_AURA_PROPRE, null),
    computeSkillDamage(seul, st, choisi, AUCUNE_AURA_PROPRE, null),
    'générique, sans slots déclencheurs, choisi comme sort : une seule contribution (computeTotalDamage écarte le passif qui est le sort)'
  );
  // `damageRelevantStats` passe par la MÊME porte : un « sort » fictif qui
  // porte l'identifiant de Tempest mais ne lit que la DEF ne ferait
  // travailler l'ATQ que si le passif (ATQ) s'ajoutait à lui-même.
  const defSeulCommeTempest: SkillDamageProfile = { ...profilSynthetique('1*{DEF}', 3, true), skillCom2usId: TEMPEST, passif: true };
  ok(
    !damageRelevantStats(defSeulCommeTempest, [sansSlots], choisi).includes('atk'),
    'générique : damageRelevantStats n’ajoute pas non plus le passif qui est le sort (même porte que computeTotalDamage)'
  );
  egal(damageRelevantStats(seul, passifs, choisi), ['atk', 'cd'], 'Tempest choisi : stats à privilégier = ATQ (sa formule) et Dgts Crit');
  egal(champsDuCombat(seul), { defEnnemie: true, crit: true }, 'Tempest choisi : la DEF adverse et le critique comptent (ni ignore DEF, ni dégâts fixes)');

  titre('Tempest comme sort — lignes d’artéfact du cran « Tempest seul »');

  const total = (setup: DamageSetup, art: ArtifactDamageProfile = ARTIFACT_DAMAGE_NEUTRE, s = st) =>
    computeTotalDamage(seul, passifs, s, setup, AUCUNE_AURA_PROPRE, null, art);
  const nu = total(choisi);
  const statsPlus = (pts: number) => stats({ atk: 3000, cr: 100, cd: 150 + pts });

  // 411 — « jamais sur Tempest, même sélectionné seul » (A.2 ter). Témoin : le
  // même profil d'artéfacts majore bien le S1 choisi seul.
  const a411 = artefacts([{ code: 411, value: 30 }]);
  const setupS1: DamageSetup = { ...choisi, skillCom2usId: ARCANE_BLAST, passifsOffensifs: {} };
  ok(
    computeTotalDamage(s1, passifs, st, setupS1, AUCUNE_AURA_PROPRE, null, a411) > computeTotalDamage(s1, passifs, st, setupS1, AUCUNE_AURA_PROPRE, null),
    'témoin : 411 majore le S1 choisi seul (premier coup du tour)'
  );
  ok(proche(total(choisi, a411), nu), '411 ne s’applique jamais à Tempest seul : il frappe toujours après le S1/S2 qui le déclenche');

  // 402 et 410 — une fois (controle-1c1-amendement L73-75). Oracle : les mêmes
  // points en Dgts CRIT de fiche, une fois — jamais deux.
  const uneFois = total(choisi, ARTIFACT_DAMAGE_NEUTRE, statsPlus(20));
  const deuxFois = total(choisi, ARTIFACT_DAMAGE_NEUTRE, statsPlus(40));
  for (const code of [402, 410]) {
    const avec = total(choisi, artefacts([{ code, value: 20 }]));
    ok(proche(avec, uneFois) && !proche(avec, deuxFois), `${code} (+20) s’applique UNE fois à Tempest seul (compétence de slot 3)`);
  }
  // 400/401 — lignes du S1/du S2 : jamais sur Tempest seul.
  for (const code of [400, 401]) {
    ok(proche(total(choisi, artefacts([{ code, value: 20 }])), nu), `${code} ne touche pas Tempest seul (slot 3)`);
  }
  // 224 — mono-cible seulement : jamais sur Tempest, en zone.
  ok(proche(total(choisi, artefacts([{ code: 224, value: 20 }])), nu), '224 ne s’applique jamais à Tempest seul (zone)');
  // 222/223 — « les PV saisis y décrivent l'état avant Tempest » (cadrage,
  // lot 9) : 60 % saisis, soit `30 × 0.6` (222) et `30 × 0.4` (223) points ;
  // jamais la valeur à 100 % de PV (30 et 0).
  const pv60: DamageSetup = { ...choisi, enemyHpPct: 60 };
  for (const [code, pts, ptsA100] of [[222, 30 * 0.6, 30], [223, 30 * 0.4, 0]] as const) {
    const avec = total(pv60, artefacts([{ code, value: 30 }]));
    ok(
      proche(avec, total(pv60, ARTIFACT_DAMAGE_NEUTRE, statsPlus(pts))) && !proche(avec, total(pv60, ARTIFACT_DAMAGE_NEUTRE, statsPlus(ptsA100))),
      `${code} : Tempest seul lit les PV saisis (60 %), soit +${pts} points`
    );
  }
}

/**
 * 9b — aller-retour de recette avec `skillCom2usId` = 3213, l'identifiant d'un
 * PASSIF (cadrage degats-et-aura, recalage du lot 9, « preuve en plus »), relue
 * par les chemins du CLI : `buildRealDamageContext` (score) et
 * `resolveObjectiveStats` (pré-filtrage). L'état des passifs affiché par le CLI
 * passe par `passifCompte`, avec le sort retenu.
 */
export function testDegatsTempestRecette() {
  titre('Tempest comme sort — recette portant l’identifiant d’un passif, relue par le CLI (degats-et-aura 9b)');

  const damageSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: TEMPEST, passifsOffensifs: { [TEMPEST]: true } };
  const recette = buildOptimizerRecipe({
    monsterCom2usId: TESHAR,
    monsterName: 'Teshar (test)',
    requirement: { sets: [], minStats: {} },
    objective: 'degats_reels',
    damageSetup,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'box',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: {},
  });
  const lue = parseOptimizerRecipe(JSON.stringify(recette));
  ok(lue.recipe != null, `recette relue sans erreur${lue.error ? ` — ${lue.error}` : ''}`);
  if (!lue.recipe) return;
  egal(lue.recipe.damageSetup.skillCom2usId, TEMPEST, 'aller-retour : skillCom2usId 3213 conservé tel quel');
  egal(lue.recipe.damageSetup, damageSetup, 'aller-retour : réglage de combat intact');

  const ctx = buildRealDamageContext(lue.recipe, TESHAR, []);
  ok(ctx != null, 'CLI : contexte « Dégâts réels » construit pour Teshar');
  if (!ctx) return;
  egal(ctx.profile.skillCom2usId, TEMPEST, 'CLI : le sort résolu est Tempest, pas le repli sur le S2');
  egal(ctx.profile.passif, true, 'CLI : le sort résolu est le profil du passif');
  ok(ctx.passifs.some((p) => p.skillCom2usId === TEMPEST), 'CLI : Tempest reste aussi dans la liste des passifs du contexte');
  const st = stats({ atk: 3000, cr: 100, cd: 150 });
  egal(
    computeTotalDamage(ctx.profile, ctx.passifs, st, ctx.setup, AUCUNE_AURA_PROPRE, ctx.element, ctx.artefacts),
    computeTotalDamage(ctx.profile, [], st, ctx.setup, AUCUNE_AURA_PROPRE, ctx.element, ctx.artefacts),
    'CLI : le score de la recette compte Tempest une seule fois, interrupteur resté allumé'
  );
  const teshar: LoadedMonster = {
    unitId: 1,
    com2usId: TESHAR,
    monsterName: 'Teshar (test)',
    // Jamais lus par `resolveObjectiveStats`, qui ne lit que l'espèce.
    gear: { base: { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 }, runes: [], artifacts: [] },
    allRunes: [],
    allArtifacts: [],
    allRelics: [],
  };
  egal(resolveObjectiveStats(lue.recipe, teshar), ['atk', 'cd'], 'CLI : stats privilégiées de la recette = celles de Tempest (ATQ, Dgts Crit)');

  const cli = readFileSync(resolve(racine, 'scripts/optimizer-search.ts'), 'utf8');
  ok(!/\bpassifActif\(/.test(cli), 'CLI (optimizer-search.ts) : plus aucun état de passif lu par passifActif seul, qui ignore le sort');
  egal((cli.match(/passifCompte\(p, profile, s\)/g) ?? []).length, 2, 'CLI : les états « def break » et « conditionnel » passent par passifCompte, avec le sort retenu');
  ok(cli.includes('choisi comme sort : compté une seule fois'), 'CLI : un passif choisi comme sort est annoncé comme tel, pas « désactivé »');
}

// Le code seul (même parti pris que tests/proses-sort.test.ts) : un
// commentaire qui CITE l'ancien rendu ne doit ni faire échouer ni faire
// passer un contrôle.
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/**
 * 9b — l'écran (`DamageSetupCard.tsx`), lu sur la source : le dépôt n'a pas
 * d'infrastructure de test React (tests/run.mjs). Réponses de l'utilisateur du
 * 2026-10-02 : n° 10 (interrupteur MASQUÉ quand Tempest est la compétence
 * choisie) et n° 11 (« Tempest (S3) se déclenche après ce sort », désactivé
 * par défaut, à la place de la phrase de condition de 9a).
 */
export function testDegatsTempestEcran() {
  titre('Tempest comme sort — l’interrupteur à l’écran (DamageSetupCard.tsx, degats-et-aura 9b)');

  const carte = sansCommentaires(readFileSync(resolve(racine, 'src/components/outils/DamageSetupCard.tsx'), 'utf8').replace(/\r\n/g, '\n'));
  ok(
    carte.includes('const passifsSuivants = passifs.filter((p) => passifPeutSuivre(p, resolved));'),
    'passifs affichés = ceux qui peuvent suivre le sort choisi (passifPeutSuivre, la porte du calcul)'
  );
  ok(carte.includes('{passifsSuivants.map((p) => {') && !carte.includes('{passifs.map('), 'chaque passif rendu vient de passifsSuivants, jamais de la liste complète');
  ok(carte.includes('{(passifsSuivants.length > 0 ||'), 'la section « Passifs offensifs » ne compte que les passifs affichables');
  ok(
    carte.includes("const apresSort = cat.type === 'conditionnel' && p.slotsDeclencheurs != null;"),
    'passif qui frappe après certains sorts = conditionnel à slots déclencheurs curés'
  );
  ok(/apresSort\s*\?\s*`\$\{nom\} \(S\$\{p\.profile\.slot\}\) se déclenche après ce sort`/.test(carte), 'son interrupteur s’intitule « <nom> (S<slot>) se déclenche après ce sort »');
  ok(
    carte.includes('{!apresSort && <p className="mt-1 text-xs leading-snug text-ink-dim">{texteCondition}</p>}'),
    'la phrase « Se déclenche si … » laisse la place à ce libellé'
  );
  ok(carte.includes("const nom = p.nom.replace(/\\s*\\(Passive\\)\\s*$/i, '');"), 'nom affiché : celui du jeu, sans « (Passive) »');
  ok(carte.includes('const actif = setup.passifsOffensifs?.[p.skillCom2usId] ?? false;'), 'interrupteur éteint tant que rien n’est saisi');

  const teshar = fiche(TESHAR);
  const tempest = tempestDe(teshar);
  if (!tempest) {
    ok(false, 'Teshar : Tempest absent des passifs offensifs — l’interrupteur ne peut pas être vérifié');
    return;
  }
  egal(
    `${tempest.nom.replace(/\s*\(Passive\)\s*$/i, '')} (S${tempest.profile.slot}) se déclenche après ce sort`,
    'Tempest (S3) se déclenche après ce sort',
    'Teshar : le libellé vaut « Tempest (S3) se déclenche après ce sort » (réponse n° 11)'
  );
  ok(tempest.categorie.type === 'conditionnel' && tempest.slotsDeclencheurs != null, 'Teshar : Tempest prend la branche « après certains sorts »');
  ok(!passifActif(tempest, DEFAULT_DAMAGE_SETUP), 'Teshar : interrupteur désactivé par défaut');
  const affiches = (sort: SkillDamageProfile) =>
    monsterOffensivePassives(teshar)
      .filter((p) => passifPeutSuivre(p, sort))
      .map((p) => p.skillCom2usId);
  egal(affiches(sortDe(teshar, ARCANE_BLAST)), [TEMPEST], 'S1 choisi : l’interrupteur Tempest est affiché');
  egal(affiches(sortDe(teshar, LIGHTNING_NOVA)), [TEMPEST], 'S2 choisi : l’interrupteur Tempest est affiché');
  egal(affiches(tempest.profile), [], 'Tempest choisi : son interrupteur est MASQUÉ (réponse n° 10), plus aucun passif à afficher');
}
