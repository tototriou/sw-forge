// Calcul de dégâts réels (src/lib/damage.ts) — la brique du nouvel objectif
// « Dégâts réels » de l'Optimizer.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici (le critère de tests/README.md) :
// une formule à moitié lue. Le parseur doit refuser tout ce qu'il ne
// comprend pas ENTIÈREMENT — un `0.15*{ATK}*({Relative SPD}+1)` dont on ne
// lirait que `0.15*{ATK}` produirait un nombre parfaitement plausible, donc
// jamais remarqué, et l'Optimizer classerait les builds sur une base fausse.
// D'où le balayage du corpus RÉEL en fin de fichier, pas seulement des cas
// écrits à la main.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import {
  BuildCandidate,
  Objective,
  OBJECTIVE_LABELS,
  OBJECTIVE_RELEVANT_STATS,
  objectiveKeysOf,
  objectiveScore,
} from '../src/lib/runeBuildOptim';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { Competence, DetailMonstre } from '../src/lib/monsterSkills';
import {
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  computeSkillDamageDetail,
  computeTotalDamage,
  damageRelevantStats,
  defaultDamageSkill,
  defenseFactor,
  estPrisEnCharge,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifActif,
  resolveDamageSkill,
  resolvedHits,
  skillDamageProfile,
  summonerSkillBonus,
} from '../src/lib/damage';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

// Stats d'un build, écrites à la main : ce module ne consomme que les totaux,
// jamais le détail base/bonus.
function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({
    key,
    label: key,
    base: 0,
    bonus: valeurs[key] ?? 0,
    total: valeurs[key] ?? 0,
    suffix: '',
  }));
}

// Compétence synthétique — pour exercer le parseur sur des formes que le
// corpus réel ne contient pas forcément toutes.
function sort(formule: string | null, extra: Partial<Competence> = {}): Competence {
  return {
    id: 1,
    com2usId: 1,
    nom: 'Test',
    description: null,
    slot: 3,
    passif: false,
    aoe: false,
    cooldown: null,
    coups: 1,
    niveauMax: 5,
    formule,
    scale: [],
    ameliorations: [],
    icone: null,
    effets: [],
    ...extra,
  };
}

function profil(formule: string, extra: Partial<Competence> = {}): SkillDamageProfile | null {
  const p = skillDamageProfile(sort(formule, extra));
  return p && estPrisEnCharge(p) ? p : null;
}

const LUSHEN = 13413;

export default function testDegats() {
  titre('Dégâts réels — lecture des formules');

  ok(profil('3.6*{ATK}') !== null, 'la forme la plus courante (coefficient × ATQ) est lue');
  ok(profil('{ATK}*({SPD}+70)/30') !== null, 'la forme « speed nuker » (dépend de la VIT) est lue');
  ok(profil('0.15*{ATK}+0.2*{MAX HP}') !== null, 'une formule à deux stats est lue');
  ok(profil('4.5*{ATK}-100') !== null, 'une soustraction constante est lue');

  // ⚠️ Le cœur du fichier : tout ce qui n'est pas COMPLÈTEMENT compris est
  // refusé, jamais tronqué silencieusement.
  ok(profil('0.15*{ATK}*({Relative SPD}+1)') === null, 'une variable inconnue fait refuser tout le sort');
  ok(profil('{ATK}*(1.5*1.5**(1*TARGET_{DEF})+1)') === null, 'une formule hors grammaire est refusée');
  ok(profil('1.2*{ATK}*ABSORPTION_TOT_CNT') === null, 'un identifiant nu est refusé');
  ok(profil('3.6*{ATK} garbage') === null, 'du texte résiduel fait refuser le sort');
  ok(skillDamageProfile(sort(null)) === null, 'une compétence sans formule ne produit aucun profil');
  ok(skillDamageProfile(sort('3.6*{ATK}', { passif: true })) === null, 'un passif ne produit aucun profil');

  // Une formule calculable mais indépendante des runes : refusée AVEC une
  // raison, pas silencieusement acceptée — optimiser dessus n'a aucun sens.
  const inerte = skillDamageProfile(sort('1500(Fixed)'));
  ok(inerte !== null && !estPrisEnCharge(inerte), 'un sort qui ne dépend d’aucune stat du monstre est écarté');

  titre('Dégâts réels — ce qui est déduit du sort, jamais redemandé');

  const detail = fiche(LUSHEN);
  const sorts = monsterDamageSkills(detail);
  const s3 = defaultDamageSkill(sorts);
  ok(s3 !== null, 'Lushen : un sort de dégâts par défaut est trouvé');
  egal(s3?.nom, 'Amputation Magic', 'le défaut est bien le dernier slot (S3)');
  egal(s3?.hits, 3, 'les 3 coups viennent des données, pas de l’utilisateur');
  egal(s3?.aoe, true, 'la portée de zone vient des données');
  egal(s3?.ignoreDef, true, 'l’ignore défense est déduit de l’effet « Ignore DEF »');
  egal(s3?.skillupDamagePct, 30, 'les 3 « Damage +10% » des améliorations sont sommés');
  egal(s3?.variables, ['ATK'], 'la S3 de Lushen ne dépend que de l’ATQ');

  const s1 = sorts.filter(estPrisEnCharge).find((s) => s.slot === 1);
  egal(s1?.ignoreDef, false, 'la S1 de Lushen, elle, n’ignore PAS la défense');

  titre('Dégâts réels — l’équation');

  // Lushen S3 : 0.68 × ATQ, 3 coups, ignore défense, +30 % d’améliorations.
  // Coup critique garanti, 2000 ATQ, 200 % de Dgts Crit.
  //   0.68 × 2000            = 1360
  //   × (1 + 0.30 + 1 × 2.0) = 4488
  //   × 1000/1140            ≈ 3936,84   (plancher d’ignore défense)
  //   × 3 coups              ≈ 11810,5
  const build = stats({ atk: 2000, cd: 200, cr: 50 });
  // ⚠️ `summonerSkills: 'aucune'` EXPLICITE — ce test épingle l'équation
  // NUE. Le défaut de l'app est « combat » (ces compétences sont permanentes
  // en jeu), qui ajoute 25 points de Dgts Crit : s'appuyer sur le défaut
  // ferait échouer ce test à chaque révision de ce choix produit, alors que
  // l'équation, elle, n'aurait pas bougé.
  const critique: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'crit', summonerSkills: 'aucune' };
  const attendu = 0.68 * 2000 * (1 + 0.3 + 2.0) * (1000 / 1140) * 3;
  ok(s3 !== null && Math.abs(computeSkillDamage(s3, build, critique) - attendu) < 0.01, 'le total suit l’équation de spec/mecaniques.md');

  const normal = computeSkillDamage(s3!, build, { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' });
  const moyenne = computeSkillDamage(s3!, build, { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne' });
  const crit = computeSkillDamage(s3!, build, critique);
  ok(normal < moyenne && moyenne < crit, 'non critique < moyenne < critique');

  // Taux Crit plafonné à 100 % : `computeStats` renvoie le total brut, mais
  // au-delà de 100 % il ne rapporte plus rien en jeu.
  const cr100 = computeSkillDamage(s3!, stats({ atk: 2000, cd: 200, cr: 100 }), DEFAULT_DAMAGE_SETUP);
  const cr130 = computeSkillDamage(s3!, stats({ atk: 2000, cd: 200, cr: 130 }), DEFAULT_DAMAGE_SETUP);
  egal(cr130, cr100, 'au-delà de 100 % de Taux Crit, plus aucun dégât supplémentaire');

  // Ignore défense : la DEF de la cible et la réduction de défense n’y
  // changent rien — c’est ce qui permet à l’écran de masquer ces réglages.
  const durci = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 20000 };
  egal(
    computeSkillDamage(s3!, build, durci),
    computeSkillDamage(s3!, build, DEFAULT_DAMAGE_SETUP),
    'un sort qui ignore la défense ne réagit pas à la DEF ennemie'
  );

  // Sur un sort qui NE l’ignore pas, en revanche, tout doit bouger.
  const s1p = s1!;
  const base = computeSkillDamage(s1p, build, DEFAULT_DAMAGE_SETUP);
  ok(computeSkillDamage(s1p, build, durci) < base, 'plus de DEF ennemie → moins de dégâts');
  ok(computeSkillDamage(s1p, build, { ...DEFAULT_DAMAGE_SETUP, defBreak: true }) > base, 'la réduction de défense augmente les dégâts');
  ok(computeSkillDamage(s1p, build, { ...DEFAULT_DAMAGE_SETUP, brand: true }) > base, 'la marque augmente les dégâts');
  ok(computeSkillDamage(s1p, build, { ...DEFAULT_DAMAGE_SETUP, atkBuff: true }) > base, 'le buff d’attaque augmente les dégâts');
  egal(
    computeSkillDamage(s1p, build, { ...DEFAULT_DAMAGE_SETUP, defBuff: true }),
    base,
    'le buff de défense ne change rien à un sort qui ne dépend pas de la DEF'
  );

  ok(Math.abs(defenseFactor(0) - 1000 / 1140) < 1e-9, 'à DEF = 0 le facteur vaut ~0,877, jamais 1');

  titre('Dégâts réels — compétences d’invocateur');

  // ⚠️ Les compétences d'invocateur portent sur la stat de BASE (comme le
  // totem de vitesse), pas sur le total runé — un build à grosse ATQ runée
  // n'en tire pas plus qu'un build nu de même base.
  egal(summonerSkillBonus('aucune', 'fire'), { pct: { atk: 0, def: 0, hp: 0, spd: 0 }, cdPoints: 0 }, '« Aucune » n’apporte rien');
  egal(
    summonerSkillBonus('combat', 'fire'),
    { pct: { atk: 41, def: 20, hp: 20, spd: 15 }, cdPoints: 25 },
    'Combat : +20 % ATQ + 21 % élémentaire, et 25 points de Dgts Crit'
  );
  egal(
    summonerSkillBonus('guilde', 'fire'),
    { pct: { atk: 61, def: 40, hp: 40, spd: 15 }, cdPoints: 50 },
    'Guilde s’AJOUTE à Combat, jamais à la place'
  );
  egal(summonerSkillBonus('combat', null).pct.atk, 20, 'sans élément connu, la compétence élémentaire ne s’applique pas');
  egal(summonerSkillBonus('combat', 'unknown').pct.atk, 20, '« unknown » n’est pas un élément du jeu : aucune compétence élémentaire');
  // La VIT ne fait pas partie de l'onglet Guilde : elle ne doit PAS doubler.
  egal(summonerSkillBonus('guilde', 'fire').pct.spd, 15, 'la VIT ne vient que de Combat, jamais doublée par Guilde');

  // Effet réel sur les dégâts, base et total distincts pour attraper une
  // application au mauvais étage (total au lieu de base).
  const buildInvoc: StatRow[] = stats({ atk: 2000, cd: 200, cr: 50 }).map((r) =>
    r.key === 'atk' ? { ...r, base: 800, bonus: 1200, total: 2000 } : r
  );
  const sansInvoc = computeSkillDamage(s3!, buildInvoc, { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune' });
  const avecCombat = computeSkillDamage(s3!, buildInvoc, { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'combat' }, 'wind');
  ok(avecCombat > sansInvoc, 'activer les compétences de Combat augmente les dégâts');
  // 800 de base × 41 % = 328 (arrondi supérieur) — sur la BASE, pas sur 2000.
  const attenduAtk = 2000 + Math.ceil((800 * 41) / 100);
  ok(
    Math.abs(avecCombat / sansInvoc - ((attenduAtk * (1 + 0.3 + 0.5 * 2.25)) / (2000 * (1 + 0.3 + 0.5 * 2.0)))) < 1e-9,
    'le bonus porte sur la BASE (800), pas sur le total runé (2000)'
  );

  titre('Dégâts réels — stats à privilégier dans la recherche');

  egal(damageRelevantStats(s3), ['atk', 'cd'], 'un sort ATQ fait travailler ATQ et Dgts Crit');
  egal(damageRelevantStats(profil('{ATK}*({SPD}+70)/30')), ['atk', 'spd', 'cd'], 'un sort VIT y ajoute la VIT');
  egal(damageRelevantStats(profil('0.2*{MAX HP}')), ['hp', 'cd'], 'un sort PV fait travailler les PV');
  egal(damageRelevantStats(null), ['atk', 'cd'], 'sans sort résolu, on retombe sur le biais « Dégâts »');
  // Le Taux Crit n'y figure JAMAIS (plafonné en jeu : une condition, pas une
  // cible) — même règle que l'objectif « Dégâts ».
  ok(!damageRelevantStats(s3).includes('cr'), 'le Taux Crit n’est jamais une stat à maximiser');

  titre('Dégâts réels — passifs offensifs');

  // ⚠️ La liste `PASSIFS_OFFENSIFS_CONNUS` (damage.ts) est une CURATION à la
  // main — jamais déduite automatiquement d'une condition en jeu (voir
  // spec/outils/degats-reels.md, cas Roid). Ces tests épinglent le
  // COMPORTEMENT (toujours actif d'office / bouton désactivé par défaut /
  // bonus qui ne majore QUE la contribution du passif), pas la liste
  // elle-même — l'ajout d'un monstre à la liste n'a pas à faire échouer ceci.

  // Feng Yan — « Winds and Clouds (Passive) », classé « toujours » : aucun
  // bouton, s'ajoute d'office au sort choisi. Trois particularités
  // CONFIRMÉES PAR L'UTILISATEUR (aucune n'est déductible de la formule
  // seule) : le bonus proportionnel à la DEF (`1.6*{DEF}`) ne peut JAMAIS
  // critiquer, s'ajoute à CHAQUE coup du sort actif (pas une fois par tour),
  // et ses 4 améliorations « Damage +X% » (5+5+10+15 = 35 %) comptent bien
  // (une hypothèse antérieure fausse les ignorait pour tout passif).
  const fengYan = fiche(21213);
  const fyBase = defaultDamageSkill(monsterDamageSkills(fengYan));
  ok(fyBase !== null, 'Feng Yan : un sort de dégâts par défaut est trouvé');
  const fyPassifs = monsterOffensivePassives(fengYan);
  egal(fyPassifs.length, 1, 'Feng Yan : un seul passif offensif reconnu (Winds and Clouds)');
  egal(fyPassifs[0]?.categorie.type, 'toujours', 'Winds and Clouds est classé « toujours »');
  egal(fyPassifs[0]?.critique, 'jamais', 'Winds and Clouds ne peut jamais critiquer');
  egal(fyPassifs[0]?.coupsDuSortActif, true, 'le bonus DEF suit les coups du sort actif, pas une instance fixe');
  egal(
    fyPassifs[0]?.profile.skillupDamagePct,
    35,
    'les 4 améliorations « Damage +X% » de Winds and Clouds sont sommées (5+5+10+15), pas ignorées'
  );
  const fySetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: fyBase!.skillCom2usId, summonerSkills: 'aucune' };
  const fyStats = stats({ atk: 2000, cd: 200, cr: 100, hp: 20000, def: 900 });

  const fyContributionReelle =
    computeTotalDamage(fyBase!, fyPassifs, fyStats, fySetup, null) - computeSkillDamage(fyBase!, fyStats, fySetup, null);
  const fyContributionUnitaire = computeSkillDamage(
    { ...fyPassifs[0]!.profile, hits: 1 },
    fyStats,
    { ...fySetup, critMode: 'normal' },
    null
  );
  ok(
    Math.abs(fyContributionReelle - fyContributionUnitaire * fyBase!.hits) < 1e-6,
    'le bonus DEF de Winds and Clouds s’applique à CHAQUE coup du sort actif, pas une fois par tour'
  );

  const fyTotalCrit = computeTotalDamage(fyBase!, fyPassifs, fyStats, { ...fySetup, critMode: 'crit' }, null);
  const fyTotalNormal = computeTotalDamage(fyBase!, fyPassifs, fyStats, { ...fySetup, critMode: 'normal' }, null);
  const fyBaseCrit = computeSkillDamage(fyBase!, fyStats, { ...fySetup, critMode: 'crit' }, null);
  const fyBaseNormal = computeSkillDamage(fyBase!, fyStats, { ...fySetup, critMode: 'normal' }, null);
  ok(
    Math.abs(fyTotalCrit - fyTotalNormal - (fyBaseCrit - fyBaseNormal)) < 1e-6,
    'le passif de Feng Yan ne varie jamais avec le mode critique — seul le sort de base y répond'
  );

  // Sia — « Great Friends (Passive) », coups VARIABLES (« 2 à 3 fois de
  // plus », confirmé par l'utilisateur : critique normalement, contrairement
  // à Winds and Clouds). `Competence.coups` ne porte qu'UN SEUL nombre, pas
  // fiable pour ce genre de sort — d'où un champ de réglage plutôt qu'une
  // valeur devinée.
  const sia = fiche(12134);
  const siaBase = defaultDamageSkill(monsterDamageSkills(sia));
  ok(siaBase !== null, 'Sia : un sort de dégâts par défaut est trouvé');
  const siaPassifs = monsterOffensivePassives(sia);
  egal(siaPassifs.length, 1, 'Sia : un seul passif offensif reconnu (Great Friends)');
  egal(siaPassifs[0]?.critique, 'suit', 'Great Friends peut critiquer normalement, contrairement à Winds and Clouds');
  egal(
    siaPassifs[0]?.profile.hitsRange,
    { min: 2, max: 3 },
    'Great Friends a une plage de coups CONNUE (2 à 3), pas un nombre fixe deviné'
  );
  egal(
    siaPassifs[0]?.profile.hits,
    2,
    'sans réglage utilisateur, le nombre de coups retombe sur le MINIMUM de la plage — jamais une surestimation par défaut'
  );
  const siaSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: siaBase!.skillCom2usId, summonerSkills: 'aucune' };
  const siaStats = stats({ atk: 2000, cd: 200, cr: 100 });
  egal(
    resolvedHits(siaPassifs[0]!.profile, siaSetup),
    2,
    'sans clé dans coupsPersonnalises, resolvedHits retombe sur le minimum'
  );
  const siaSetup3Coups: DamageSetup = {
    ...siaSetup,
    coupsPersonnalises: { [siaPassifs[0]!.skillCom2usId]: 3 },
  };
  egal(resolvedHits(siaPassifs[0]!.profile, siaSetup3Coups), 3, 'le réglage utilisateur est bien pris en compte');
  const siaSetupHorsPlage: DamageSetup = {
    ...siaSetup,
    coupsPersonnalises: { [siaPassifs[0]!.skillCom2usId]: 99 },
  };
  egal(
    resolvedHits(siaPassifs[0]!.profile, siaSetupHorsPlage),
    3,
    'une valeur hors plage (ex. recette écrite pour une autre version des données) est BORNÉE, jamais laissée telle quelle'
  );
  const siaContribution2 =
    computeTotalDamage(siaBase!, siaPassifs, siaStats, siaSetup, null) - computeSkillDamage(siaBase!, siaStats, siaSetup, null);
  const siaContribution3 =
    computeTotalDamage(siaBase!, siaPassifs, siaStats, siaSetup3Coups, null) -
    computeSkillDamage(siaBase!, siaStats, siaSetup3Coups, null);
  ok(
    Math.abs(siaContribution3 / siaContribution2 - 1.5) < 1e-9,
    'passer de 2 à 3 coups multiplie la contribution du passif par 3/2, exactement'
  );

  // Roid — « Slash Waves »/« Slash Wind » : branches MUTUELLEMENT EXCLUSIVES
  // d'une même condition sur la réduction de Défense. Plus aucun bouton par
  // passif : le couple (réduction déjà active AVANT, le sort en pose une)
  // les départage entièrement — les trois scénarios décrits par
  // l'utilisateur sont épinglés un par un ci-dessous.
  const roid = fiche(49003);
  const roidBase = defaultDamageSkill(monsterDamageSkills(roid));
  ok(roidBase !== null, 'Roid : un sort de dégâts par défaut est trouvé');
  ok(roidBase!.appliqueDefBreak, 'le S1 de Roid est bien détecté comme posant lui-même une réduction de DEF');
  const roidPassifs = monsterOffensivePassives(roid);
  egal(roidPassifs.length, 2, 'Roid : les deux passifs (Slash Waves, Slash Wind) sont reconnus');
  ok(
    roidPassifs.every((p) => p.categorie.type === 'defBreak'),
    'les deux sont classés « defBreak » — déclenchement déduit, plus aucun bouton à cocher'
  );
  const slashWaves = roidPassifs.find((p) => p.nom.startsWith('Slash Waves'))!;
  const slashWind = roidPassifs.find((p) => p.nom.startsWith('Slash Wind'))!;
  const roidStats = stats({ atk: 2000, cd: 200, cr: 100, hp: 20000 });
  const roidBaseSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: roidBase!.skillCom2usId,
    summonerSkills: 'aucune',
  };

  // Scénario 1 — réduction de DEF DÉJÀ présente : Slash Waves se déclenche,
  // et tout (sort + passif) profite de la réduction.
  const roidAvecAvant: DamageSetup = { ...roidBaseSetup, defBreak: true };
  ok(passifActif(slashWaves, roidAvecAvant), 'def break AVANT → Slash Waves se déclenche');
  ok(!passifActif(slashWind, roidAvecAvant), 'def break AVANT → Slash Wind ne se déclenche PAS');
  egal(
    computeTotalDamage(roidBase!, roidPassifs, roidStats, roidAvecAvant, null),
    computeSkillDamage(roidBase!, roidStats, roidAvecAvant, null) +
      computeSkillDamage(slashWaves.profile, roidStats, roidAvecAvant, null),
    'def break AVANT : le sort ET Slash Waves sont tous deux calculés avec la réduction'
  );

  // Scénario 2 — aucune réduction, et le sort n'en pose pas : Slash Wind se
  // déclenche, tout est calculé SANS réduction.
  const roidSansRien: DamageSetup = { ...roidBaseSetup, defBreak: false, defBreakParLeSort: false };
  ok(!passifActif(slashWaves, roidSansRien), 'aucune réduction → Slash Waves ne se déclenche pas');
  ok(passifActif(slashWind, roidSansRien), 'aucune réduction → Slash Wind se déclenche');
  egal(
    computeTotalDamage(roidBase!, roidPassifs, roidStats, roidSansRien, null),
    computeSkillDamage(roidBase!, roidStats, roidSansRien, null) +
      computeSkillDamage(slashWind.profile, roidStats, roidSansRien, null),
    'aucune réduction : le sort ET Slash Wind sont tous deux calculés sans réduction'
  );

  // Scénario 3 — le cœur du problème signalé : pas de réduction AVANT, mais
  // le sort en pose une. Le DÉCLENCHEMENT reste celui de « sans réduction »
  // (Slash Wind), mais ses DÉGÂTS profitent de la réduction que le sort vient
  // de poser — alors que le sort lui-même, non.
  const roidPoseeParLeSort: DamageSetup = { ...roidBaseSetup, defBreak: false, defBreakParLeSort: true };
  ok(!passifActif(slashWaves, roidPoseeParLeSort), 'réduction posée PAR le sort → Slash Waves ne se déclenche toujours pas');
  ok(passifActif(slashWind, roidPoseeParLeSort), 'réduction posée PAR le sort → c’est bien Slash Wind qui se déclenche');
  egal(
    computeSkillDamage(roidBase!, roidStats, roidPoseeParLeSort, null),
    computeSkillDamage(roidBase!, roidStats, roidSansRien, null),
    'le sort qui pose la réduction n’en profite JAMAIS lui-même — elle atterrit après son coup'
  );
  egal(
    computeTotalDamage(roidBase!, roidPassifs, roidStats, roidPoseeParLeSort, null),
    computeSkillDamage(roidBase!, roidStats, roidSansRien, null) +
      computeSkillDamage(slashWind.profile, roidStats, { ...roidSansRien, defBreak: true }, null),
    'mais le passif qui frappe APRÈS en profite : S1 sans réduction, Slash Wind avec'
  );
  ok(
    computeTotalDamage(roidBase!, roidPassifs, roidStats, roidPoseeParLeSort, null) >
      computeTotalDamage(roidBase!, roidPassifs, roidStats, roidSansRien, null),
    'poser la réduction avec le sort augmente donc bien le total'
  );

  // Dominic — « Improvisation (Passive) », passé de `bonus` à `toujours` : la
  // condition de PV de l'attaquant est IGNORÉE, le passif compte d'office
  // (sa formule `(Fixed)` correspond déjà au cas majoré).
  const dominic = fiche(25713);
  const dominicBase = defaultDamageSkill(monsterDamageSkills(dominic));
  ok(dominicBase !== null, 'Dominic : un sort de dégâts par défaut est trouvé');
  const dominicPassifs = monsterOffensivePassives(dominic);
  egal(dominicPassifs.length, 1, 'Dominic : un seul passif reconnu (Improvisation)');
  egal(dominicPassifs[0]?.categorie.type, 'toujours', 'Improvisation est désormais « toujours », plus « bonus »');
  ok(dominicPassifs[0]!.profile.fixed, 'sa formule porte (Fixed) : ni critique ni facteur de défense');
  const dominicStats = stats({ atk: 2000, cd: 200, cr: 100, hp: 20000 });
  const dominicSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: dominicBase!.skillCom2usId,
    summonerSkills: 'aucune',
  };
  egal(
    computeTotalDamage(dominicBase!, dominicPassifs, dominicStats, dominicSetup, null),
    computeSkillDamage(dominicBase!, dominicStats, dominicSetup, null) +
      computeSkillDamage(dominicPassifs[0]!.profile, dominicStats, dominicSetup, null),
    'le passif de Dominic est compté d’office, sans aucun bouton ni condition de PV'
  );

  // Ezio — « Hidden Gun (Passive) », `bonus` : le bouton ne porte QUE le
  // surplus. ⚠️ Les dégâts de BASE du passif sont comptés même bouton
  // éteint (« Attacks additionally … when you attack the enemy on your
  // turn » — inconditionnel), correction d'un cas où tout tombait à zéro.
  // Et il critique TOUJOURS, quel que soit le mode choisi à l'écran.
  const ezio = fiche(27415);
  const ezioBase = defaultDamageSkill(monsterDamageSkills(ezio));
  const ezioPassifs = monsterOffensivePassives(ezio);
  egal(ezioPassifs.length, 1, 'Ezio : un seul passif reconnu (Hidden Gun)');
  egal(ezioPassifs[0]?.critique, 'toujours', 'Hidden Gun critique TOUJOURS — « always lands as a Critical Hit »');
  const ezioStats = stats({ atk: 2000, cd: 200, cr: 0 });
  const ezioSansBonus: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: ezioBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
  };
  const contributionSansBonus =
    computeTotalDamage(ezioBase!, ezioPassifs, ezioStats, ezioSansBonus, null) -
    computeSkillDamage(ezioBase!, ezioStats, ezioSansBonus, null);
  ok(contributionSansBonus > 0, 'bouton éteint : la BASE du passif est quand même comptée, jamais zéro');
  ok(
    Math.abs(
      contributionSansBonus - computeSkillDamage(ezioPassifs[0]!.profile, ezioStats, { ...ezioSansBonus, critMode: 'crit' }, null)
    ) < 1e-6,
    'et elle est calculée en coup CRITIQUE alors que l’écran est en « Non critique »'
  );
  const ezioAvecBonus: DamageSetup = {
    ...ezioSansBonus,
    passifsOffensifs: { [ezioPassifs[0]!.skillCom2usId]: true },
  };
  const contributionAvecBonus =
    computeTotalDamage(ezioBase!, ezioPassifs, ezioStats, ezioAvecBonus, null) -
    computeSkillDamage(ezioBase!, ezioStats, ezioAvecBonus, null);
  ok(
    Math.abs(contributionAvecBonus / contributionSansBonus - 2) < 1e-9,
    'activer le bouton double la contribution du passif (+100 %), sans toucher au sort de base'
  );

  // Benedict — confirmé : l'attaque supplémentaire ignore la DEF **et** peut
  // critiquer. Les deux ne vont pas ensemble d'office, d'où le test.
  const benedict = fiche(25714);
  const benedictPassifs = monsterOffensivePassives(benedict);
  egal(benedictPassifs.length, 1, 'Benedict : un seul passif reconnu (Final Strike)');
  ok(benedictPassifs[0]!.profile.ignoreDef, 'Final Strike ignore la défense');
  egal(benedictPassifs[0]?.critique, 'suit', 'Final Strike peut critiquer normalement');
  egal(
    benedictPassifs[0]?.bonusPvCible,
    { seuilPct: 30, pct: 20 },
    'Final Strike porte son seuil de PV (+20 % sous 30 %), déduit sans bouton'
  );

  titre('Dégâts réels — PV de la cible creusés coup par coup');

  // ⚠️ Weakness Shot (Benedict/Dominic S2) : `{ATK}*(3.1 - 1.2*{Target
  // Current HP %})`, 4 coups. Le ratio MONTE à mesure que la cible descend —
  // multiplier un seul coup par 4 sous-estimait donc lourdement le sort.
  const weakness = monsterDamageSkills(benedict).filter(estPrisEnCharge).find((s) => s.nom === 'Weakness Shot')!;
  ok(weakness != null, 'Benedict : « Weakness Shot » est calculable');
  egal(weakness.hits, 4, 'Weakness Shot frappe 4 fois');
  ok(weakness.variables.includes('Target Current HP %'), 'sa formule lit bien les PV courants de la cible');

  const wStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const wSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: weakness.skillCom2usId,
    summonerSkills: 'aucune',
    enemyHp: 30000,
    enemyHpPct: 100,
  };
  const wDetail = computeSkillDamageDetail(weakness, wStats, wSetup, null);
  // Le premier coup frappe une cible PLEINE ; s'il n'y avait pas de
  // creusement, les 4 coups vaudraient exactement 4 fois ce premier coup.
  const premierCoup = computeSkillDamageDetail({ ...weakness, hits: 1, hitsRange: undefined }, wStats, wSetup, null).total;
  ok(
    wDetail.total > premierCoup * 4,
    'les 4 coups rapportent PLUS que 4 fois le premier — chaque coup creuse la cible et fait monter le ratio suivant'
  );
  ok(wDetail.pvRestantsPct < 100, 'et les PV restants de la cible ont bien baissé');

  // Une cible DÉJÀ entamée donne un ratio de départ plus élevé : le même
  // sort, sur une cible à 50 %, frappe plus fort.
  const wDejaEntame = computeSkillDamageDetail(weakness, wStats, { ...wSetup, enemyHpPct: 50 }, null).total;
  ok(wDejaEntame > wDetail.total, 'sur une cible déjà à 50 % de PV, le même sort inflige davantage');

  // Un sort SANS variable de PV n'est pas affecté par la simulation : son
  // total reste strictement `un coup × hits` (chemin court préservé).
  const glaive = monsterDamageSkills(benedict).filter(estPrisEnCharge).find((s) => s.nom === 'Glaive Slash')!;
  const glaiveUn = computeSkillDamageDetail({ ...glaive, hits: 1, hitsRange: undefined }, wStats, wSetup, null).total;
  ok(
    Math.abs(computeSkillDamage(glaive, wStats, wSetup, null) - glaiveUn * glaive.hits) < 1e-6,
    'un sort qui ne lit pas les PV de la cible garde exactement l’ancien calcul (un coup × hits)'
  );

  // Le seuil de Final Strike se juge sur les PV APRÈS le sort actif — donc
  // il s'active tout seul quand le sort a suffisamment entamé la cible, sans
  // que l'utilisateur ait quoi que ce soit à cocher.
  const bStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const bSetupPleine: DamageSetup = { ...wSetup, enemyHp: 200000, enemyHpPct: 100 };
  const bSetupBasse: DamageSetup = { ...wSetup, enemyHp: 200000, enemyHpPct: 25 };
  const ratioPleine =
    (computeTotalDamage(weakness, benedictPassifs, bStats, bSetupPleine, null) -
      computeSkillDamageDetail(weakness, bStats, bSetupPleine, null).total) /
    computeSkillDamageDetail(benedictPassifs[0]!.profile, bStats, bSetupPleine, null).total;
  const ratioBasse =
    (computeTotalDamage(weakness, benedictPassifs, bStats, bSetupBasse, null) -
      computeSkillDamageDetail(weakness, bStats, bSetupBasse, null).total) /
    computeSkillDamageDetail(benedictPassifs[0]!.profile, bStats, bSetupBasse, null).total;
  ok(Math.abs(ratioPleine - 1) < 1e-6, 'cible restée au-dessus de 30 % : Final Strike ne prend PAS son bonus');
  ok(Math.abs(ratioBasse - 1.2) < 1e-6, 'cible tombée sous 30 % : Final Strike prend exactement ses +20 %');

  titre('Dégâts réels — passifs offensifs (suite)');

  // Birgitta / Silver : nombre de coups annoncé en PROSE, que
  // `Competence.coups` contredit — c'est la prose qui fait foi, curée à la
  // main (Turning Slash porte `coups=1` en donnée pour « 2 more times »).
  const birgittaPassifs = monsterOffensivePassives(fiche(29714));
  egal(birgittaPassifs[0]?.profile.hits, 2, 'Turning Slash (Birgitta) compte 2 coups, pas le 1 de la donnée');
  const silverPassifs = monsterOffensivePassives(fiche(16534));
  egal(silverPassifs[0]?.profile.hits, 3, 'Ruins (Silver) compte ses 3 coups');
  egal(silverPassifs[0]?.critique, 'suit', 'Ruins peut critiquer');

  // `damageRelevantStats` doit suivre EXACTEMENT le même interrupteur que
  // `computeTotalDamage` — sinon le pré-filtrage de la recherche privilégie
  // des stats qu'un score différent ignore (ou l'inverse). Roid : quel que
  // soit le scénario, EXACTEMENT un des deux passifs se déclenche, donc les
  // PV (`{MAX HP}` de leurs formules) comptent toujours.
  ok(
    damageRelevantStats(roidBase, roidPassifs, roidSansRien).includes('hp'),
    'Roid : les PV entrent dans le pré-filtrage — un de ses deux passifs se déclenche toujours'
  );
  ok(
    damageRelevantStats(fyBase, fyPassifs, fySetup).length >= damageRelevantStats(fyBase).length,
    'un passif « toujours » ne peut jamais RÉDUIRE l’ensemble des stats à privilégier'
  );

  titre('Dégâts réels — propagation dans la recherche');

  // ⚠️ Ce bloc existe parce que `tsc --noEmit` ne peut PAS voir ces erreurs :
  // un champ non lu reste un accès optionnel valide, et `scripts/` est même
  // hors de son périmètre (voir le skill optimizer-field-propagation, né de
  // trois incidents de ce type exactement).

  // Le repli doit rester STRICTEMENT le comportement d'avant pour les cinq
  // autres objectifs : sans override, la table statique fait foi.
  for (const o of OBJECTIVE_LABELS) {
    egal(objectiveKeysOf(o.key, undefined), OBJECTIVE_RELEVANT_STATS[o.key], `sans override, « ${o.label} » garde ses stats d'origine`);
  }
  egal(objectiveKeysOf('degats', ['spd']), ['spd'], "l'override remplace la table, il ne s'y ajoute pas");
  egal(objectiveKeysOf(undefined, undefined), [], 'aucun objectif, aucun override → aucun biais');
  // ⚠️ Un override VIDE doit rester un override (« ce sort ne privilégie
  // rien »), pas retomber sur la table — un `??`/`||` mal placé confondrait
  // les deux, sans que rien ne le signale.
  egal(objectiveKeysOf('degats', []), [], 'un override vide reste un override');
  // ⚠️ `speed_nuker` retiré (v1.8.1 → forge/calcul-degats-reels) : une
  // recette exportée pendant sa courte durée de vie porte encore cette
  // valeur, jamais validée par `parseOptimizerRecipe`. Sans repli, le spread
  // sur `undefined` plus haut dans la pile lève une TypeError.
  egal(objectiveKeysOf('speed_nuker' as unknown as Objective, undefined), [], 'un objectif retiré (recette ancienne) dégrade vers aucun biais, sans lever');

  // Sans contexte, le score échoue BRUYAMMENT — jamais un repli silencieux
  // sur une autre formule que celle affichée à l'utilisateur.
  const bidon = { stats: stats({ atk: 1000, cd: 100 }), effTotal: 0 } as unknown as BuildCandidate;
  let aLeve = false;
  try {
    objectiveScore(bidon, 'degats_reels');
  } catch {
    aLeve = true;
  }
  ok(aLeve, '« Dégâts réels » sans contexte lève, plutôt que de retomber sur une autre formule');
  egal(
    objectiveScore(bidon, 'degats_reels', { profile: s3!, passifs: [], setup: DEFAULT_DAMAGE_SETUP, element: null }),
    computeSkillDamage(s3!, bidon.stats, DEFAULT_DAMAGE_SETUP),
    'avec contexte, le tri utilise exactement la formule du sort'
  );

  // La recette doit porter le réglage : c'est elle que rejoue le script CLI,
  // et un champ oublié ici ferait diverger le script de l'écran en silence.
  const recette = buildOptimizerRecipe({
    monsterCom2usId: LUSHEN,
    monsterName: 'Lushen',
    requirement: { sets: ['rage'], minStats: {} },
    objective: 'degats_reels',
    damageSetup: { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: s3!.skillCom2usId, defBreak: true },
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'rta',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: {},
  });
  const relue = parseOptimizerRecipe(JSON.stringify(recette)).recipe;
  egal(relue?.damageSetup, recette.damageSetup, 'le réglage survit à un aller-retour export/import de recette');

  // Résolution du sort : la MÊME fonction sert à l'écran et au CLI.
  egal(resolveDamageSkill(sorts, s3!.skillCom2usId)?.nom, 'Amputation Magic', 'un sort demandé et calculable est retenu tel quel');
  egal(resolveDamageSkill(sorts, 999999)?.nom, s3?.nom, 'un sort introuvable retombe sur le défaut, sans erreur');
  egal(resolveDamageSkill([], 999999), null, 'aucun sort calculable → null, jamais une exception');

  titre('Dégâts réels — balayage du corpus complet');

  // Le parseur ne doit jamais lever ni renvoyer NaN/Infini sur les ~6 200
  // formules réelles du corpus, quelle que soit sa décision de les prendre en
  // charge ou non.
  let lus = 0;
  let refuses = 0;
  let anomalies = 0;
  const buildBalayage = stats({ hp: 20000, atk: 1500, def: 900, spd: 200, cr: 60, cd: 150 });
  for (const f of readdirSync(DOSSIER_SORTS)) {
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    for (const p of monsterDamageSkills(d)) {
      if (!estPrisEnCharge(p)) {
        refuses++;
        continue;
      }
      lus++;
      const v = computeSkillDamage(p, buildBalayage, DEFAULT_DAMAGE_SETUP);
      if (!Number.isFinite(v) || v < 0) anomalies++;
    }
  }
  egal(anomalies, 0, `aucun résultat aberrant sur les ${lus} sorts pris en charge`);
  ok(refuses > 0, `${refuses} sorts hors modèle sont refusés explicitement, pas calculés de travers`);
  // Filet de non-régression : si un changement du parseur faisait chuter la
  // couverture, on veut le voir. Marge large, ce n'est pas un objectif chiffré.
  ok(lus > 4000, `couverture du corpus conservée (${lus} sorts calculables)`);
}
