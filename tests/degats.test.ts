// Calcul de dégâts réels (src/lib/damage.ts) — la brique du nouvel objectif
// « Dégâts réels » de l'Optimizer.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici (le critère de tests/README.md) :
// une formule à moitié lue. Le parseur doit refuser tout ce qu'il ne
// comprend pas ENTIÈREMENT — un `0.15*{ATK}*({Attacker's Level}+1)` dont on
// ne lirait que `0.15*{ATK}` produirait un nombre parfaitement plausible,
// donc jamais remarqué, et l'Optimizer classerait les builds sur une base
// fausse. D'où le balayage du corpus RÉEL en fin de fichier, pas seulement
// des cas écrits à la main.

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
import { ArtifactDetail } from '../src/types';
import {
  ATK_BUFF_PCT,
  BRAND_BONUS_PCT,
  DEBORAH_AMPLIFY,
  DEF_BREAK_FACTOR,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  EULDONG_CD_POINTS,
  LEADER_SKILL_PRESETS,
  MIRIAM_AMPLIFY_PCT,
  MIRINAE_BONUS_PCT,
  SPD_BUFF_PCT,
  TRANSMISSION_BONUS_PCT,
  VELASKA_PCT_PAR_PV_PERDU,
  SkillDamageProfile,
  bonusDegatsConditionnelActif,
  computeSkillDamage,
  computeSkillDamageDetail,
  computeTotalDamage,
  damageRelevantStats,
  defaultDamageSkill,
  defenseFactor,
  estPrisEnCharge,
  maVitCombat,
  bonusConditionnelPropreActif,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsSelonCr,
  monsterBonusDegatsSelonDef,
  monsterBonusDegatsSelonVit,
  monsterBonusSiAtqSeuil,
  monsterBonusDegatsStackable,
  monsterBonusEcartDef,
  monsterBonusFixeCiblePvMax,
  monsterBonusFixeMaxHpPropre,
  monsterBonusParEffetCible,
  monsterBonusParEffetPropre,
  monsterBonusSacrifice,
  monsterBonusStatFixe,
  monsterCritRateSelonVit,
  monsterCritSiPlusRapide,
  monsterDamageSkills,
  monsterModificateursVit,
  monsterOffensivePassives,
  passifActif,
  resolveDamageSkill,
  resolvedCompteurPersonnalise,
  resolvedEffetsCibleCount,
  resolvedEffetsPropresCount,
  resolvedHits,
  resolvedPvActuelsAvantSacrificePctMonstre,
  resolvedStackPct,
  resolvedStackTrigger,
  skillDamageProfile,
  ARTIFACT_DAMAGE_NEUTRE,
  degatsBrutsArtefactsParCoup,
  artifactDamageProfile,
  artifactCritDamagePoints,
  artifactElementBonusPct,
  speedBuffAmpliPct,
  summonerSkillBonus,
  type PassifOffensifProfile,
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

// `stats()` fixe `base=0` pour tout — sans conséquence pour la plupart des
// tests (les compétences d'invocateur, seules à lire `base` avant cette
// section, sont testées avec `summonerSkills: 'aucune'`), mais un leader
// skill PORTE PRÉCISÉMENT sur cette base (voir `avecInvocateur`,
// `maVitCombat`) — la tester exige une base RÉELLEMENT non nulle, distincte
// du total runé.
function statsAvecBase(cle: StatKey, base: number, total: number, autres: Partial<Record<StatKey, number>> = {}): StatRow[] {
  return stats(autres).map((r) => (r.key === cle ? { ...r, base, total } : r));
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
  ok(profil("0.15*{ATK}*({Attacker's Level}+1)") === null, 'une variable inconnue fait refuser tout le sort');
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

  titre('Dégâts réels — les bombes sont des dégâts fixes');

  // ⚠️ Une bombe ne peut pas être critique et ignore la défense — donc
  // `fixed`. Mais AUCUNE des deux détections habituelles ne l'attrape : sa
  // formule ne porte pas de marqueur `(Fixed)`, et l'ignore-défense n'est
  // écrit que dans la PROSE de l'effet `Bomb`, jamais dans son NOM (que
  // `ignoreDef` compare pourtant à `'Ignore DEF'`).
  const bombeDe = (id: number, nom: string) =>
    monsterDamageSkills(fiche(id))
      .filter(estPrisEnCharge)
      .find((s) => s.nom === nom)!;

  const fateOfDestruction = bombeDe(15713, 'Fate of Destruction'); // Seara
  ok(fateOfDestruction != null, 'Seara : Fate of Destruction est calculable');
  egal(fateOfDestruction.fixed, true, 'Seara : la bombe est reconnue comme dégâts fixes');
  egal(fateOfDestruction.ignoreDef, false, '… et PAS via `ignoreDef` : son effet s’appelle « Bomb », pas « Ignore DEF »');
  egal(bombeDe(13401, 'Surprise Bomb').fixed, true, 'Joker (Eau) : Surprise Bomb, même famille');

  // ⚠️ **Le discriminant est `coups === 0`, pas « porte un effet Bomb »** —
  // cinq familles FRAPPENT en plus de poser leur bombe, et leur formule
  // décrit ce coup direct, qui crite et se fait mitiger normalement. Les
  // marquer fixes les aurait faussées. Vérifié sur le corpus complet.
  egal(bombeDe(19415, 'Bombardment').fixed, false, 'Frigate (Ténèbres) : Bombardment frappe ET pose — pas de dégâts fixes');
  egal(bombeDe(29215, 'Dancing Star').fixed, false, 'Geralt (Ténèbres) : Dancing Star frappe ET pose');
  egal(bombeDe(29615, 'Star of Explosion').fixed, false, 'Valdemar : Star of Explosion frappe ET pose');

  // ⚠️ **`coups` ment sur ce sort-là**, d'où la curation par nom
  // (`BOMBES_SANS_COUP_DIRECT_CONNUS`) : `Cursed Apple` porte `coups: 1`,
  // mais sa prose ne décrit aucune attaque (« Installs a bomb … and stuns »)
  // — le 1 compte l'application de l'étourdissement, pas un coup porté.
  // ⚠️ Ce test est la SEULE protection de cette curation : `coups === 1` seul
  // le classerait « frappe et pose », et le sort redeviendrait critable et
  // mitigé sans que rien d'autre ne le signale.
  egal(bombeDe(27205, 'Cursed Apple').fixed, true, 'Puppeteer (Ténèbres) : Cursed Apple ne fait que POSER, malgré coups=1');

  // Le cas le plus net : UN SEUL monstre porte les deux sortes de bombe.
  egal(bombeDe(18101, 'Time Bomb').fixed, true, 'Kobold Bomber (Eau) : Time Bomb pose sans frapper → fixe');
  egal(bombeDe(18101, 'Firecracker').fixed, false, '… et Firecracker, même monstre, frappe ET pose → pas fixe');

  // ⚠️ `bombe` est DISTINCT de `fixed` : un sort ordinaire marqué `(Fixed)`
  // est fixe sans être une bombe, et ne doit donc PAS profiter de la ligne
  // d'artéfact « Dgts de bombe ».
  egal(bombeDe(18101, 'Time Bomb').bombe, true, 'Time Bomb est bien marquée comme bombe');
  egal(bombeDe(18101, 'Firecracker').bombe, false, 'Firecracker frappe : pas une bombe au sens du calcul');
  egal(profil('1*{ATK} (Fixed)')!.bombe, false, 'un sort ordinaire marqué (Fixed) est fixe SANS être une bombe');
  {
    // +24 % de dégâts de bombe ne s'appliquent qu'au sort de bombe.
    const artefactBombe = artifactDamageProfile([
      { id: 0, kind: 'element', element: 'water', level: 1, rarity: 5, main: { code: 100, value: 300 }, subs: [{ code: 210, value: 24 }] },
    ]);
    const st = stats({ atk: 4150 });
    const setupB: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal', enemyDef: 0 };
    const seara = bombeDe(15713, 'Fate of Destruction');
    const nu = computeSkillDamage(seara, st, setupB);
    egal(
      Math.round(computeSkillDamageDetail(seara, st, setupB, null, undefined, artefactBombe).total),
      Math.round(nu * 1.24),
      'Seara : +24 % de dégâts de bombe — recale le second relevé en jeu (~34 000)'
    );
    // Le MÊME artéfact sur un sort qui n'est pas une bombe : aucun effet.
    const ordinaire = profil('1*{ATK} (Fixed)')!;
    egal(
      computeSkillDamageDetail(ordinaire, st, setupB, null, undefined, artefactBombe).total,
      computeSkillDamageDetail(ordinaire, st, setupB, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total,
      '… et rien du tout sur un sort qui n’est pas une bombe'
    );
  }

  {
    // Ni la DEF adverse ni le critique ne doivent bouger le résultat.
    const setupBombe: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal', enemyDef: 0 };
    const st = stats({ atk: 4150 });
    const nu = computeSkillDamage(fateOfDestruction, st, setupBombe);
    egal(computeSkillDamage(fateOfDestruction, st, { ...setupBombe, enemyDef: 3000 }), nu, 'la DEF adverse ne change RIEN aux dégâts de bombe');
    egal(computeSkillDamage(fateOfDestruction, st, { ...setupBombe, critMode: 'crit' }), nu, 'le critique non plus — une bombe ne crite pas');
    // `5,0 × {ATK} × 1,30` (3 × « Damage +10% »). Recale le relevé EN JEU
    // (~27 000 à ~4 150 d'ATQ, base + équipement + invocateur de guilde).
    egal(Math.round(nu), 26975, 'Seara : 5,0 × 4150 × 1,30 — le relevé en jeu se recale');
  }

  titre('Dégâts réels — l’équation');

  // Lushen S3 : 0.68 × ATQ, 3 coups, ignore défense, +30 % d’améliorations.
  // Coup critique garanti, 2000 ATQ, 200 % de Dgts Crit.
  //   0.68 × 2000            = 1360
  //   × (1 + 0.30 + 1 × 2.0) = 4488
  //   × 1000/1142            ≈ 3929,95   (plancher d’ignore défense)
  //   × 3 coups              ≈ 11810,5
  const build = stats({ atk: 2000, cd: 200, cr: 50 });
  // ⚠️ `summonerSkills: 'aucune'` EXPLICITE — ce test épingle l'équation
  // NUE. Le défaut de l'app est « combat » (ces compétences sont permanentes
  // en jeu), qui ajoute 25 points de Dgts Crit : s'appuyer sur le défaut
  // ferait échouer ce test à chaque révision de ce choix produit, alors que
  // l'équation, elle, n'aurait pas bougé.
  const critique: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'crit', summonerSkills: 'aucune' };
  const attendu = 0.68 * 2000 * (1 + 0.3 + 2.0) * (1000 / 1142) * 3;
  ok(s3 !== null && Math.abs(computeSkillDamage(s3, build, critique) - attendu) < 0.01, 'le total suit l’équation de spec/mecaniques.md');

  const normal = computeSkillDamage(s3!, build, { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' });
  const moyenne = computeSkillDamage(s3!, build, { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne' });
  const crit = computeSkillDamage(s3!, build, critique);
  ok(normal < moyenne && moyenne < crit, 'non critique < moyenne < critique');

  // Taux Crit plafonné à 100 % : `computeStats` renvoie le total brut, mais
  // au-delà de 100 % il ne rapporte plus rien en jeu.
  // ⚠️ `critMode: 'moyenne'` EXPLICITE — seul mode où le Taux Crit pèse sur
  // le résultat (`crit`/`normal` l'ignorent entièrement) ; s'appuyer sur le
  // défaut de l'écran (désormais « crit ») rendrait ce test VACUEUX : il
  // passerait toujours, mais plus pour la raison qu'il prétend vérifier.
  const critModeMoyenne: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne' };
  const cr100 = computeSkillDamage(s3!, stats({ atk: 2000, cd: 200, cr: 100 }), critModeMoyenne);
  const cr130 = computeSkillDamage(s3!, stats({ atk: 2000, cd: 200, cr: 130 }), critModeMoyenne);
  egal(cr130, cr100, 'au-delà de 100 % de Taux Crit, plus aucun dégât supplémentaire');

  // Ignore défense : la DEF de la cible et la réduction de défense n’y
  // changent rien — c’est ce qui permet à l’écran de masquer ces réglages.
  const durci = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 20000 };
  egal(
    computeSkillDamage(s3!, build, durci),
    computeSkillDamage(s3!, build, DEFAULT_DAMAGE_SETUP),
    'un sort qui ignore la défense ne réagit pas à la DEF ennemie'
  );
  // ⚠️ Question directe de l'utilisateur : le def break (posé AVANT le
  // sort, `setup.defBreak`) n'y change rien NON PLUS — `defEff =
  // profile.ignoreDef ? 0 : …` court-circuite `facteurDefBreak` avant même
  // de l'évaluer, que Deborah l'amplifie ou non.
  egal(
    computeSkillDamage(s3!, build, { ...DEFAULT_DAMAGE_SETUP, defBreak: true }),
    computeSkillDamage(s3!, build, DEFAULT_DAMAGE_SETUP),
    'un sort qui ignore la défense ne réagit pas non plus au def break'
  );
  egal(
    computeSkillDamage(s3!, build, { ...DEFAULT_DAMAGE_SETUP, defBreak: true, deborahActif: true }),
    computeSkillDamage(s3!, build, DEFAULT_DAMAGE_SETUP),
    'ni au def break amplifié par Deborah — rien à amplifier, la DEF effective est déjà à 0'
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

  ok(Math.abs(defenseFactor(0) - 1000 / 1142) < 1e-9, 'à DEF = 0 le facteur vaut ~0,876, jamais 1');

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
  // ⚠️ `critMode: 'moyenne'` EXPLICITE — le ratio attendu ci-dessous suppose
  // `partCrit = cr` (0,5), vrai UNIQUEMENT sous ce mode (`crit`, le défaut de
  // l'écran, donnerait `partCrit = 1` et casserait le calcul).
  const sansInvoc = computeSkillDamage(s3!, buildInvoc, { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne', summonerSkills: 'aucune' });
  const avecCombat = computeSkillDamage(s3!, buildInvoc, { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne', summonerSkills: 'combat' }, 'wind');
  ok(avecCombat > sansInvoc, 'activer les compétences de Combat augmente les dégâts');
  // 800 de base × 41 % = 328 (arrondi supérieur) — sur la BASE, pas sur 2000.
  const attenduAtk = 2000 + Math.ceil((800 * 41) / 100);
  ok(
    Math.abs(avecCombat / sansInvoc - ((attenduAtk * (1 + 0.3 + 0.5 * 2.25)) / (2000 * (1 + 0.3 + 0.5 * 2.0)))) < 1e-9,
    'le bonus porte sur la BASE (800), pas sur le total runé (2000)'
  );

  titre('Dégâts réels — VIT de l’adversaire ({Relative SPD})');

  // ⚠️ « (Ta VIT totale − VIT totale de la cible) / VIT totale de la cible »
  // — confirmé par l'utilisateur. Beast Rider S1 (« Spear of Protector »,
  // `2.0*{ATK}*({Relative SPD}+1)`) était REJETÉ avant cette confirmation :
  // 20 sorts du corpus en dépendent, tous sur cette même formule.
  ok(profil('2.0*{ATK}*({Relative SPD}+1)') !== null, '{Relative SPD} est maintenant une variable reconnue');
  const beastRider = fiche(23504);
  const spearOfProtector = monsterDamageSkills(beastRider).filter(estPrisEnCharge).find((s) => s.nom === 'Spear of Protector')!;
  ok(spearOfProtector != null, 'Beast Rider : « Spear of Protector » est désormais calculable');
  egal(spearOfProtector.variables, ['ATK', 'Relative SPD'], 'sa formule dépend bien de ATQ et de Relative SPD');

  const brStats = stats({ atk: 2000, cd: 200, cr: 100, spd: 150 });
  const brSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: spearOfProtector.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
  };
  // Comparés en RATIO (pas en valeur absolue) : le facteur de défense et la
  // mitigation sont constants entre ces trois appels, seul {Relative SPD}
  // varie — le ratio isole exactement sa contribution, sans avoir à
  // reproduire le reste de l'équation à la main.
  // Même VIT que l'adversaire → Relative SPD = 0 → le facteur (…+1) vaut 1.
  const memeVit = computeSkillDamage(spearOfProtector, brStats, { ...brSetup, enemySpd: 150 });
  // Deux fois plus rapide → Relative SPD = 1 → coefficient × 2.
  const deuxFoisPlusRapide = computeSkillDamage(spearOfProtector, brStats, { ...brSetup, enemySpd: 75 });
  ok(Math.abs(deuxFoisPlusRapide / memeVit - 2) < 1e-9, 'deux fois plus rapide que l’adversaire : les dégâts doublent');
  // Deux fois plus LENT → Relative SPD = -0,5 → coefficient × 0,5.
  const deuxFoisPlusLent = computeSkillDamage(spearOfProtector, brStats, { ...brSetup, enemySpd: 300 });
  ok(Math.abs(deuxFoisPlusLent / memeVit - 0.5) < 1e-9, 'deux fois plus lent que l’adversaire : les dégâts sont réduits de moitié');
  ok(memeVit > 0 && deuxFoisPlusRapide > memeVit && memeVit > deuxFoisPlusLent, 'plus on est rapide face à l’adversaire, plus les dégâts montent');

  // VIT adverse ≤ 0 : bornée à 1, jamais une division par zéro qui casse le calcul.
  ok(Number.isFinite(computeSkillDamage(spearOfProtector, brStats, { ...brSetup, enemySpd: 0 })), 'VIT adverse à 0 : pas de division par zéro');
  ok(Number.isFinite(computeSkillDamage(spearOfProtector, brStats, { ...brSetup, enemySpd: -50 })), 'VIT adverse négative : bornée, pas de NaN');

  ok(damageRelevantStats(spearOfProtector).includes('spd'), 'Relative SPD fait travailler la VIT du monstre optimisé, comme SPD');

  // Rigna — « Concentrated Stab » (S2, `4.7*{ATK}`) : ignore une FRACTION de
  // la DEF, proportionnelle à l'écart de VIT — donnée communautaire
  // confirmée par l'utilisateur (SWGT) : 126 points d'écart = 100 % ignoré,
  // linéaire en-dessous, 0 % si la cible est aussi rapide ou plus.
  const rigna = fiche(29711);
  const concentratedStab = monsterDamageSkills(rigna).filter(estPrisEnCharge).find((s) => s.nom === 'Concentrated Stab')!;
  ok(concentratedStab != null, 'Rigna : « Concentrated Stab » est calculable');
  egal(concentratedStab.ignoreDef, false, 'ce n’est PAS un ignore total — distinct du booléen `ignoreDef`');
  egal(concentratedStab.ignoreDefSelonVit, { ecartMax: 126 }, 'la plage curée (126 points) est bien portée par le profil');
  ok(
    concentratedStab.variables.includes('Relative SPD'),
    'Relative SPD est injectée dans `variables` même si la FORMULE (4.7×ATQ) ne la lit pas — c’est l’ignore-DEF qui en dépend'
  );

  const rignaStats = stats({ atk: 2000, cd: 200, cr: 100, spd: 200 });
  const rignaSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: concentratedStab.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
    enemyDef: 1000,
  };
  // Cible aussi rapide : écart nul, la DEF s'applique intégralement — même
  // résultat qu'un sort ordinaire sur cette DEF.
  const ecartNul = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetup, enemySpd: 200 });
  const sansIgnore = computeSkillDamage({ ...concentratedStab, ignoreDefSelonVit: undefined }, rignaStats, rignaSetup);
  egal(ecartNul, sansIgnore, 'cible aussi rapide : aucune DEF ignorée, comme un sort qui ne connaît pas ce mécanisme');
  // Cible PLUS rapide : écart négatif, borné à 0 % ignoré (jamais un ignore négatif).
  const cibleReste = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetup, enemySpd: 260 });
  egal(cibleReste, sansIgnore, 'cible plus rapide que Rigna : le bonus tombe à 0 %, pas de DEF ignorée');
  // Écart de 63 (la moitié de 126) → 50 % de la DEF ignorée.
  const demiEcart = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetup, enemySpd: 137 });
  const demiDef = computeSkillDamage({ ...concentratedStab, ignoreDefSelonVit: undefined }, rignaStats, { ...rignaSetup, enemyDef: 500 });
  egal(demiEcart, demiDef, 'écart de 63 points (la moitié de 126) : exactement 50 % de la DEF est ignorée');
  // Écart ≥ 126 → 100 % ignoré, comme un `ignoreDef` classique.
  const ecartMax = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetup, enemySpd: 74 });
  const ecartAuDela = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetup, enemySpd: 10 });
  const ignoreTotal = computeSkillDamage({ ...concentratedStab, ignoreDef: true, ignoreDefSelonVit: undefined }, rignaStats, rignaSetup);
  egal(ecartMax, ignoreTotal, 'écart de 126 points pile : 100 % de la DEF ignorée, comme ignoreDef=true');
  egal(ecartAuDela, ignoreTotal, 'écart AU-DELÀ de 126 : plafonné à 100 %, jamais plus');
  ok(ecartNul < demiEcart && demiEcart < ecartMax, 'plus l’écart de VIT grandit, plus la DEF ignorée augmente');

  titre('Dégâts réels — leader skill, artéfacts et crit garanti si plus rapide');

  // « Ta VIT totale » (confirmé par l'utilisateur) = runes + totem (déjà
  // dans les compétences d'invocateur) + buff VIT (éventuellement amplifié
  // par un artéfact) + leader skill d'ÉQUIPE. `maVitCombat` les combine.
  const vitNue = maVitCombat(rignaStats, rignaSetup, null);

  const setupAvecBuff: DamageSetup = { ...rignaSetup, spdBuff: true };
  const vitBuffNu = maVitCombat(rignaStats, setupAvecBuff, null);
  const vitBuffAmplifie = maVitCombat(rignaStats, setupAvecBuff, null, 50);
  // Buff nu = +30 % (SPD_BUFF_PCT) ; amplifié de 50 % = +30%×1,5 = +45 %.
  ok(Math.abs(vitBuffNu / vitNue - 1.3) < 1e-9, 'le buff de VIT nu ajoute +30 %, comme les autres buffs');
  ok(
    Math.abs(vitBuffAmplifie / vitNue - 1.45) < 1e-9,
    'un artéfact « Effet aug. VIT +50 % » amplifie le buff (30 % → 45 %), jamais la VIT plate'
  );
  ok(
    Math.abs(maVitCombat(rignaStats, rignaSetup, null, 50) / vitNue - 1) < 1e-9,
    'sans buff de VIT actif, une amplification d’artéfact ne change rien (rien à amplifier)'
  );

  // `speedBuffAmpliPct` : somme le code 206 (« Effet aug. VIT ») sur tous les
  // artéfacts équipés, ignore les autres codes, cumule s'il y en a plusieurs.
  const artefactVit: ArtifactDetail = {
    id: 0, kind: 'element',
    element: 'water',
    level: 1,
    rarity: 5,
    main: { code: 100, value: 300 },
    subs: [
      { code: 206, value: 20 }, // Effet aug. VIT +20%
      { code: 207, value: 15 }, // Effet aug. taux CRIT — pas le même code, ignoré
    ],
  };
  const artefactSansVit: ArtifactDetail = { ...artefactVit, subs: [{ code: 207, value: 15 }] };
  egal(speedBuffAmpliPct([]), 0, 'aucun artéfact : aucune amplification');
  egal(speedBuffAmpliPct([artefactSansVit]), 0, 'un artéfact sans code 206 : aucune amplification');
  egal(speedBuffAmpliPct([artefactVit]), 20, 'le code 206 (Effet aug. VIT) est bien lu, les autres codes ignorés');
  egal(speedBuffAmpliPct([artefactVit, artefactVit]), 40, 'deux artéfacts avec la ligne se CUMULENT, comme en jeu');

  // `artifactDamageProfile` — même mécanique étendue à l'ATQ (204) et à la
  // DEF (205), plus la ligne 226 qui porte sur LES DEUX.
  egal(artifactDamageProfile([]), ARTIFACT_DAMAGE_NEUTRE, 'aucun artéfact : profil neutre, aucun canal alimenté');
  const artefactAtk: ArtifactDetail = { ...artefactVit, subs: [{ code: 204, value: 12 }] };
  const artefactDef: ArtifactDetail = { ...artefactVit, subs: [{ code: 205, value: 8 }] };
  const artefactAtkDef: ArtifactDetail = { ...artefactVit, subs: [{ code: 226, value: 10 }] };
  egal(
    artifactDamageProfile([artefactAtk]),
    { ...ARTIFACT_DAMAGE_NEUTRE, ampliAtkPct: 12 },
    'le code 204 alimente l’ATQ seule'
  );
  egal(
    artifactDamageProfile([artefactDef]),
    { ...ARTIFACT_DAMAGE_NEUTRE, ampliDefPct: 8 },
    'le code 205 alimente la DEF seule'
  );
  // ⚠️ 226 est UNE ligne du jeu qui porte sur les deux stats — elle compte
  // donc en entier des DEUX côtés, ce n'est pas un partage.
  egal(
    artifactDamageProfile([artefactAtkDef]),
    { ...ARTIFACT_DAMAGE_NEUTRE, ampliAtkPct: 10, ampliDefPct: 10 },
    'le code 226 alimente l’ATQ ET la DEF, en entier des deux côtés'
  );
  egal(
    artifactDamageProfile([artefactAtk, artefactAtkDef, artefactVit]),
    { ...ARTIFACT_DAMAGE_NEUTRE, ampliAtkPct: 22, ampliDefPct: 10, ampliVitPct: 20 },
    'les canaux se cumulent indépendamment sur une paire d’artéfacts'
  );

  // « Dgts supp. en prop. de <stat> » (218-221) — dégâts BRUTS par coup.
  const artefactBrut: ArtifactDetail = {
    ...artefactVit,
    subs: [
      { code: 218, value: 1.5 }, // % des PV
      { code: 219, value: 20 }, // % de l'ATQ
      { code: 220, value: 20 }, // % de la DEF
      { code: 221, value: 200 }, // % de la VIT
    ],
  };
  egal(
    artifactDamageProfile([artefactBrut]),
    { ...ARTIFACT_DAMAGE_NEUTRE, brutPctPv: 1.5, brutPctAtk: 20, brutPctDef: 20, brutPctVit: 200 },
    'les quatre lignes 218-221 sont lues sur leurs canaux respectifs'
  );

  // « Aug. des dgts infl. au <élément> » (300-304) — une table PAR élément.
  const artefactElement: ArtifactDetail = {
    ...artefactVit,
    subs: [
      { code: 300, value: 12 }, // au Feu
      { code: 302, value: 9 }, // au Vent
    ],
  };
  egal(
    artifactDamageProfile([artefactElement]).degatsElementPct,
    { fire: 12, wind: 9 },
    'les codes 300-304 alimentent une entrée par élément visé'
  );
  egal(
    artifactDamageProfile([artefactElement, artefactElement]).degatsElementPct,
    { fire: 24, wind: 18 },
    'deux artéfacts portant la même ligne se cumulent, élément par élément'
  );
  // ⚠️ Le profil doit rester une fonction PURE : deux appels ne doivent pas
  // partager la même table (le piège du spread d'une constante d'objet).
  {
    const a = artifactDamageProfile([artefactElement]);
    const b = artifactDamageProfile([]);
    egal(b.degatsElementPct, {}, 'un profil sans ligne élémentaire reste vide…');
    ok(a.degatsElementPct !== b.degatsElementPct, '… et deux profils ne partagent JAMAIS la même table');
    egal(ARTIFACT_DAMAGE_NEUTRE.degatsElementPct, {}, 'la constante neutre n’a pas été polluée au passage');
  }
  // Dgts CRIT par compétence (400-403, 410), mono-cible (224), bombe (210).
  const artefactType: ArtifactDetail = {
    ...artefactVit,
    subs: [
      { code: 400, value: 10 }, // Comp.1
      { code: 410, value: 6 }, // Comp.3 ET Comp.4
      { code: 224, value: 5 }, // mono-cible pendant ton tour
      { code: 210, value: 24 }, // dégâts de bombe
    ],
  };
  const profilType = artifactDamageProfile([artefactType]);
  // ⚠️ 410 compte EN ENTIER pour les slots 3 et 4 — ce n'est pas un partage,
  // même logique que le code 226 pour ATQ/DEF.
  egal(profilType.cdPointsParSlot, { 1: 10, 3: 6, 4: 6 }, '410 alimente les slots 3 ET 4, en entier');
  egal(profilType.cdPointsMonoCible, 5, 'le code 224 a son propre canal');
  egal(profilType.degatsBombePct, 24, 'le code 210 aussi');
  {
    const monoS1 = { ...profil('1*{ATK}')!, slot: 1, aoe: false };
    const zoneS1 = { ...monoS1, aoe: true };
    const monoS3 = { ...monoS1, slot: 3 };
    const monoS2 = { ...monoS1, slot: 2 };
    egal(artifactCritDamagePoints(profilType, monoS1), 15, 'S1 mono-cible : 10 (Comp.1) + 5 (mono-cible)');
    egal(artifactCritDamagePoints(profilType, zoneS1), 10, 'le MÊME sort en zone perd les 5 points mono-cible');
    egal(artifactCritDamagePoints(profilType, monoS3), 11, 'S3 mono-cible : 6 (Comp.3/4) + 5');
    egal(artifactCritDamagePoints(profilType, monoS2), 5, 'S2 : aucune ligne par compétence ici, seuls les 5 restent');
    egal(artifactCritDamagePoints(ARTIFACT_DAMAGE_NEUTRE, monoS1), 0, 'sans artéfact, aucun point');
  }

  {
    // ── 411 (1re attaque) et 222/223 (rampes sur les PV de la cible) ──
    // Les seules lignes qui VARIENT d'un coup à l'autre.
    const art = (subs: { code: number; value: number }[]) =>
      artifactDamageProfile([{ ...artefactVit, subs }]);
    egal(art([{ code: 411, value: 8 }]).cdPointsPremiereAttaque, 8, '411 a son propre canal');
    egal(art([{ code: 222, value: 6 }]).cdPointsPvCibleHauts, 6, '222 aussi');
    egal(art([{ code: 223, value: 12 }]).cdPointsPvCibleBas, 12, '223 aussi');

    // Sort à 3 coups, critique forcé, cible immense pour qu'elle ne se creuse
    // presque pas : les PV restent ~100 %, donc 222 vaut plein et 223 rien.
    const troisCoups = { ...profil('1*{ATK}')!, hits: 3, slot: 3, aoe: false };
    const st = stats({ atk: 2000, cd: 100 });
    const cible: DamageSetup = {
      ...DEFAULT_DAMAGE_SETUP,
      summonerSkills: 'aucune',
      critMode: 'crit',
      enemyDef: 0,
      enemyHp: 100_000_000,
      enemyHpPct: 100,
    };
    const nu = computeSkillDamageDetail(troisCoups, st, cible, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total;
    // ⚠️ 411 ne majore QUE le premier des 3 coups : son apport doit valoir le
    // TIERS de celui d'une ligne équivalente qui vaudrait pour tous les coups.
    const avec411 = computeSkillDamageDetail(troisCoups, st, cible, null, undefined, art([{ code: 411, value: 30 }])).total;
    const avec224 = computeSkillDamageDetail(troisCoups, st, cible, null, undefined, art([{ code: 224, value: 30 }])).total;
    ok(avec411 > nu, '411 majore bien quelque chose');
    ok(
      Math.abs((avec411 - nu) * 3 - (avec224 - nu)) < 1e-6,
      '411 (1er coup seul) apporte exactement le TIERS de 224 (les 3 coups), à valeur égale'
    );

    // ⚠️ Les rampes se vérifient sur UN SEUL coup : à plusieurs coups la
    // cible se creuse entre les coups, donc `pvFrac` dérive légèrement et
    // aucune égalité EXACTE n'est possible. Un coup unique fige la fraction.
    const unCoup = { ...troisCoups, hits: 1 };
    const aPvPct = (pct: number, subs: { code: number; value: number }[]) =>
      computeSkillDamageDetail(unCoup, st, { ...cible, enemyHpPct: pct }, null, undefined, art(subs)).total;
    const nuAPvPct = (pct: number) =>
      computeSkillDamageDetail(unCoup, st, { ...cible, enemyHpPct: pct }, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total;

    const nu1 = nuAPvPct(100);
    const plein = aPvPct(100, [{ code: 224, value: 30 }]) - nu1; // référence : 30 points, inconditionnels
    // ⚠️ Comparaison à TOLÉRANCE, pas à l'identique : une rampe passe par
    // `coefCdParCoup` (appliqué APRÈS `critTerm`) là où une ligne
    // inconditionnelle entre dans `cd` AVANT lui. Même quantité, ordre des
    // opérations différent — les derniers bits divergent, et c'est sans
    // conséquence. Même raison que la note de `objectiveScore('ehp')` sur
    // `hp / defenseFactor(def)`.
    ok(Math.abs(aPvPct(100, [{ code: 222, value: 30 }]) - nu1 - plein) < 1e-9, 'à 100 % de PV, 222 vaut PLEIN');
    egal(aPvPct(100, [{ code: 223, value: 30 }]), nu1, '… et 223 ne vaut RIEN');
    egal(aPvPct(0, [{ code: 222, value: 30 }]), nuAPvPct(0), 'à 0 % de PV, 222 ne vaut plus rien…');
    ok(
      Math.abs(aPvPct(0, [{ code: 223, value: 30 }]) - nuAPvPct(0) - plein) < 1e-9,
      '… et 223 vaut PLEIN — la rampe est bien inversée'
    );
    // Le point qui distingue une RAMPE d'un palier : à mi-chemin, moitié.
    ok(
      Math.abs((aPvPct(50, [{ code: 222, value: 30 }]) - nuAPvPct(50)) * 2 - plein) < 1e-9,
      'à 50 % de PV, 222 vaut exactement la MOITIÉ — rampe linéaire, jamais un palier'
    );
    ok(
      Math.abs((aPvPct(50, [{ code: 223, value: 30 }]) - nuAPvPct(50)) * 2 - plein) < 1e-9,
      'et 223 aussi : à 50 %, les deux rampes se croisent'
    );

    // ⚠️ Garde-fou de coût : sans critique, ces lignes ne peuvent rien
    // changer, et le calcul ne doit pas basculer sur le chemin séquentiel.
    const sansCrit: DamageSetup = { ...cible, critMode: 'normal' };
    egal(
      computeSkillDamageDetail(troisCoups, st, sansCrit, null, undefined, art([{ code: 222, value: 30 }])).total,
      computeSkillDamageDetail(troisCoups, st, sansCrit, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total,
      'sans critique, une ligne de Dgts CRIT ne change RIEN (et ne coûte pas la boucle)'
    );
  }

  {
    // ⚠️ **La Marque et Mirinae ne sont PAS de la même famille**, malgré des
    // libellés quasi identiques. MESURÉ EN JEU par l'utilisateur :
    //   - la Marque agit sur les bombes ET sur le passif de Shahat ;
    //   - Mirinae n'agit NI sur l'une NI sur l'autre ;
    //   - les artéfacts élémentaires non plus.
    // Les traiter ensemble majorait à tort les bombes et tout le bucket
    // Additionnel.
    const st = stats({ atk: 4150, hp: 30000 });
    const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal', enemyDef: 0 };
    const artFeu = artifactDamageProfile([{ ...artefactVit, subs: [{ code: 300, value: 12 }] }]);

    // ── Sur une BOMBE ────────────────────────────────────────────────────
    const bombe = bombeDe(15713, 'Fate of Destruction');
    const nuBombe = computeSkillDamage(bombe, st, { ...base, enemyElement: 'fire' });
    egal(
      computeSkillDamageDetail(bombe, st, { ...base, enemyElement: 'fire' }, null, undefined, artFeu).total,
      nuBombe,
      'artéfact élémentaire : AUCUN effet sur une bombe'
    );
    egal(
      computeSkillDamage(bombe, st, { ...base, mirinaeActif: true }),
      nuBombe,
      'Mirinae : aucun effet sur une bombe non plus'
    );
    // ⚠️ Dr. Matteo suit Mirinae, et c'est MESURÉ — pas déduit de lui. Les
    // deux analogies précédentes de ce fichier s'étant révélées fausses, celle
    // -ci a été vérifiée en jeu avant d'être reconduite.
    egal(
      computeSkillDamage(bombe, st, { ...base, transmissionActif: true }),
      nuBombe,
      'Dr. Matteo : aucun effet sur une bombe (mesuré, pas déduit de Mirinae)'
    );
    egal(
      Math.round(computeSkillDamage(bombe, st, { ...base, brand: true })),
      Math.round(nuBombe * 1.25),
      '… mais la Marque, elle, s’applique bien à une bombe'
    );

    // ── Sur le bucket ADDITIONNEL (passif de Shahat) ─────────────────────
    const sortSimple = { ...profil('1*{ATK}')!, hits: 1 };
    const shahat = { bonusFixeMaxHpPropre: { pct: 7 } }; // 7 % de 30000 = 2100 bruts
    const ecart = (setup: DamageSetup, art = ARTIFACT_DAMAGE_NEUTRE) =>
      computeSkillDamageDetail(sortSimple, st, setup, null, undefined, art, shahat).total -
      computeSkillDamageDetail(sortSimple, st, setup, null, undefined, art).total;
    egal(Math.round(ecart(base)), 2100, 'référence : le passif de Shahat vaut 2100 bruts');
    egal(
      Math.round(ecart({ ...base, enemyElement: 'fire' }, artFeu)),
      2100,
      'artéfact élémentaire : aucun effet sur le passif de Shahat'
    );
    egal(Math.round(ecart({ ...base, mirinaeActif: true })), 2100, 'Mirinae non plus');
    egal(Math.round(ecart({ ...base, transmissionActif: true })), 2100, 'Dr. Matteo non plus (mesuré)');

    // ⚠️ **RELEVÉ JULIE** — un bonus de sort « +X % par effet » ne touche pas
    // non plus le bucket Additionnel. S3 « Thousand Shots » : +50 % par effet
    // BÉNÉFIQUE sur la cible. Mesuré en jeu : ~700 par coup sans Will (0 buff)
    // contre ~730 avec Will (1 buff). Si le +50 % touchait tout, on lirait
    // 1 050. Le système donne part du sort = 60, additionnel = 640 — le modèle
    // en prédit 635 (0,21 × 2 139 DEF + 0,007 × 26 545 PV), moins de 1 %
    // d'écart.
    const julie = { ...sortSimple, bonusParEffetCible: { pct: 50, source: 'buffs' as const } };
    const ecartJulie = (setup: DamageSetup) =>
      computeSkillDamageDetail(julie, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, shahat).total -
      computeSkillDamageDetail(julie, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total;
    const setupUnBuff: DamageSetup = { ...base, effetsCibleCount: { [julie.skillCom2usId]: 1 } };
    egal(
      Math.round(ecartJulie(setupUnBuff)),
      2100,
      '« +50 % par effet sur la cible » ne majore PAS les dégâts bruts (relevé Julie)'
    );
    ok(
      computeSkillDamageDetail(julie, st, setupUnBuff, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total >
        computeSkillDamageDetail(julie, st, base, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total,
      '… alors qu’il majore bien la part du SORT — sinon le test ne prouverait rien'
    );

    // ⚠️ **RELEVÉ JESSICA** — deuxième membre de la famille mesuré, et par
    // l'autre porte : « Blessing of Curse » majore de +20 % par effet néfaste
    // sur SOI (`bonusParEffetPropre`), là où Julie compte les buffs de la
    // CIBLE. Jessica à 53 050 PV / 827 DEF / 163 VIT, artéfacts 2 % PV + 6 %
    // DEF + 102 % VIT, contre un Xiong Fei très défensif, en COUP CRITIQUE :
    //   0 débuff → ~2 250 · 1 débuff → ~2 450 · 2 débuffs → ~2 600.
    // Si le +20 % touchait tout, 2 débuffs donneraient 3 150. Le modèle prédit
    // un additionnel de 1 277 ; la résolution du système en donne 1 250.
    //
    // ⚠️ Ce relevé prouve AUSSI, indépendamment, que le bucket ne CRITE pas :
    // les trois mesures sont des critiques, et un additionnel critique (×2,5)
    // vaudrait à lui seul 3 192 — plus que le total observé de 2 250.
    const jessica = {
      ...sortSimple,
      bonusParEffetPropre: { skillCom2usId: sortSimple.skillCom2usId, pct: 20 },
    };
    const ecartJessica = (nbDebuffs: number) => {
      const s: DamageSetup = { ...base, effetsPropresCount: { [sortSimple.skillCom2usId]: nbDebuffs } };
      return (
        computeSkillDamageDetail(sortSimple, st, s, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {
          ...shahat,
          bonusParEffetPropre: jessica.bonusParEffetPropre,
        }).total -
        computeSkillDamageDetail(sortSimple, st, s, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {
          bonusParEffetPropre: jessica.bonusParEffetPropre,
        }).total
      );
    };
    egal(Math.round(ecartJessica(0)), 2100, 'Blessing of Curse, 0 débuff : les dégâts bruts valent leur valeur nue');
    egal(Math.round(ecartJessica(2)), 2100, '… et 2 débuffs (+40 % sur le sort) ne les majorent toujours PAS');

    // ⚠️ **RELEVÉ MOMO** — même verdict pour les modificateurs appliqués
    // APRÈS coup sur le total (Sonia, Momo, Zenitsu, Gideon, Brita, Velaska).
    // Ceux-là traversaient toute l'accumulation et majoraient donc aussi les
    // dégâts bruts. Momo à 53 545 PV, ligne PV à 2,3 %, sans critique, contre
    // un Feng Yan très défensif : ~1 300 par coup sans stack, ~1 700 stack
    // plein (+200 %, donc ×3). Si le stack touchait tout : 3 900.
    //
    // ⚠️ Ce test passe par `computeTotalDamage` et NON par
    // `computeSkillDamageDetail` : c'est là, et là seulement, que cette chaîne
    // s'applique.
    const momo = {
      skillCom2usId: sortSimple.skillCom2usId,
      nom: 'Secret Book (Passive)',
      description: null,
      icone: null,
      triggerMax: 20,
      triggerStep: 1,
      ratio: 10,
      pctMax: 200,
      label: 'Attaques alliées',
      aide: '',
      suffix: '',
    };
    const totalMomo = (attaques: number, avecBrut: boolean) =>
      computeTotalDamage(
        sortSimple,
        [],
        st,
        { ...base, stackPersonnalise: { [sortSimple.skillCom2usId]: attaques } },
        null,
        ARTIFACT_DAMAGE_NEUTRE,
        false,
        null,
        momo,
        avecBrut ? shahat : {}
      );
    const brutSansStack = totalMomo(0, true) - totalMomo(0, false);
    const brutStackPlein = totalMomo(20, true) - totalMomo(20, false);
    egal(Math.round(brutSansStack), 2100, 'sans stack, les dégâts bruts valent leur valeur nue');
    egal(Math.round(brutStackPlein), 2100, '… et stack PLEIN (+200 %) ne les majore pas d’un point');
    ok(
      totalMomo(20, false) > totalMomo(0, false) * 2.9,
      '… alors que la part du SORT est bien triplée — sinon le test ne prouverait rien'
    );
    egal(
      Math.round(ecart({ ...base, brand: true })),
      Math.round(2100 * 1.25),
      '… mais la Marque majore bien le passif de Shahat'
    );
  }

  const profilFeu = artifactDamageProfile([artefactElement]);
  egal(artifactElementBonusPct(profilFeu, 'fire'), 12, 'contre du Feu, la ligne Feu s’applique');
  egal(artifactElementBonusPct(profilFeu, 'dark'), 0, 'contre un élément non couvert, rien ne s’applique');
  egal(artifactElementBonusPct(profilFeu, null), 0, '« ignorer l’élément » : ces lignes comptent 0, jamais un repli sur la meilleure');
  egal(artifactElementBonusPct(profilFeu, undefined), 0, 'une recette exportée AVANT ce champ se comporte comme « ignorer »');

  {
    // Effet sur le calcul : additif avec la Marque, pas un multiplicateur à part.
    const profilFixe2 = profil('1*{ATK} (Fixed)')!;
    const st = stats({ atk: 2000 });
    const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal' };
    const nu = computeSkillDamageDetail(profilFixe2, st, base, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total;
    egal(Math.round(nu), 2000, 'référence sans artéfact ni marque');
    egal(
      Math.round(computeSkillDamageDetail(profilFixe2, st, { ...base, enemyElement: 'fire' }, null, undefined, profilFeu).total),
      2240,
      'contre du Feu : +12 % (2000 → 2240)'
    );
    egal(
      Math.round(computeSkillDamageDetail(profilFixe2, st, { ...base, enemyElement: null }, null, undefined, profilFeu).total),
      2000,
      '« ignorer l’élément » : l’artéfact ne change rien, même en le portant'
    );
    // ⚠️ **DEUX BRACKETS, donc MULTIPLICATIFS entre eux.** La ligne élémentaire
    // est dans le terme DMG%, la Marque dans Réductions : 2000 × 1,12 × 1,25 =
    // 2800, et non 2000 × (1 + 0,12 + 0,25) = 2740.
    //
    // ⚠️ Ce test figeait 2740 — une DÉDUCTION faite « par symétrie » avec les
    // artéfacts −DMG% (305-309), qui sont bien dans Réductions. La symétrie
    // n'existait pas. Corrigé d'après swcalc.cz/game-mechanics.
    egal(
      Math.round(computeSkillDamageDetail(profilFixe2, st, { ...base, brand: true }, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total),
      2500,
      'la Marque seule : +25 %'
    );
    egal(
      Math.round(
        computeSkillDamageDetail(profilFixe2, st, { ...base, brand: true, enemyElement: 'fire' }, null, undefined, profilFeu).total
      ),
      2800,
      'Marque × ligne élémentaire : MULTIPLICATIF (2 brackets), pas additif (qui donnerait 2740)'
    );
  }

  {
    // ⚠️ L'amplification ne s'applique qu'à un buff RÉELLEMENT actif — sinon
    // il n'y a rien à amplifier, exactement comme pour la VIT plus haut.
    // ⚠️ `neutre` n'est déclaré que bien plus bas dans ce fichier — on
    // reconstruit ici le même profil (coefficient 1, 1 coup, `(Fixed)` donc
    // `horsCoup = 1`) plutôt que de déplacer sa déclaration.
    const profilFixe = profil('1*{ATK} (Fixed)')!;
    const st = stats({ atk: 2000 });
    const sansBuff: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal', atkBuff: false };
    const avecBuff: DamageSetup = { ...sansBuff, atkBuff: true };
    const profilAtk = { ...ARTIFACT_DAMAGE_NEUTRE, ampliAtkPct: 20 };
    egal(
      computeSkillDamageDetail(profilFixe, st, sansBuff, null, undefined, profilAtk).total,
      computeSkillDamageDetail(profilFixe, st, sansBuff, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total,
      'sans buff d’ATQ actif, l’amplification d’artéfact ne change rien'
    );
    // Buff d'ATQ = +50 %, amplifié de 20 % → +60 %. Sur 2000 d'ATQ :
    // 3200 contre 3000.
    egal(
      Math.round(computeSkillDamageDetail(profilFixe, st, avecBuff, null, undefined, profilAtk).total),
      3200,
      'buff d’ATQ amplifié de 20 % : 50 % → 60 %, soit 2000 → 3200'
    );
    egal(
      Math.round(computeSkillDamageDetail(profilFixe, st, avecBuff, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total),
      3000,
      '… contre 3000 sans artéfact — le buff nu à +50 %'
    );
  }

  {
    // ⚠️ Lignes 218-221 : dégâts BRUTS, À CHAQUE COUP. Le sort est ORDINAIRE
    // (pas `(Fixed)`) et la cible a de la défense — sans quoi « brut » serait
    // indiscernable de « mitigé », comme pour les passifs plus bas.
    const profilTroisCoups: SkillDamageProfile = { ...profil('1*{ATK}')!, hits: 3 };
    const st = stats({ hp: 40000, atk: 2000, def: 1000, spd: 200 });
    const base: DamageSetup = {
      ...DEFAULT_DAMAGE_SETUP,
      summonerSkills: 'aucune',
      critMode: 'crit',
      enemyDef: 3000,
    };
    const brut = { ...ARTIFACT_DAMAGE_NEUTRE, brutPctPv: 1.5, brutPctAtk: 20, brutPctDef: 20, brutPctVit: 200 };
    // 1,5 % × 40000 = 600 | 20 % × 2000 = 400 | 20 % × 1000 = 200
    // | 200 % × 200 VIT = 400  →  1600 par coup, × 3 coups = 4800.
    const ecart = (setup: DamageSetup) =>
      computeSkillDamageDetail(profilTroisCoups, st, setup, null, undefined, brut).total -
      computeSkillDamageDetail(profilTroisCoups, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total;
    egal(Math.round(ecart(base)), 4800, '218-221 : 1600 bruts par coup, appliqués aux 3 coups');
    // ⚠️ Les deux invariants qui font tout l'intérêt de ces lignes : l'écart
    // ne bouge NI avec la défense adverse, NI avec le critique.
    egal(
      Math.round(ecart({ ...base, enemyDef: 0 })),
      Math.round(ecart({ ...base, enemyDef: 12000 })),
      'l’écart est le même à 0 et à 12000 de DEF adverse — ces dégâts ne sont pas mitigés'
    );
    egal(
      Math.round(ecart({ ...base, critMode: 'normal' })),
      Math.round(ecart({ ...base, critMode: 'crit' })),
      'l’écart est le même avec et sans critique — ces dégâts ne critent pas'
    );
    // Garde-fou : la part du SORT, elle, DOIT réagir à la défense.
    ok(
      computeSkillDamageDetail(profilTroisCoups, st, { ...base, enemyDef: 0 }, null, undefined, ARTIFACT_DAMAGE_NEUTRE).total >
        computeSkillDamageDetail(profilTroisCoups, st, { ...base, enemyDef: 12000 }, null, undefined, ARTIFACT_DAMAGE_NEUTRE)
          .total,
      'sinon le test ne prouverait rien : la part du sort est bien mitigée par la DEF'
    );
  }

  titre('Dégâts réels — leader skill généralisé (PV, ATQ, DEF, VIT, Taux Crit, Dégâts Crit)');

  // ⚠️ Signalé par l'utilisateur : « les leaderskill s'appliquent sur les
  // statistiques de BASE », exactement comme `pctSpeedBonus`/`combatSpeed`
  // (speed.ts, page RTA) : `base + rune + ceil(base × pct/100)`, jamais un
  // pourcentage du total runé. `stats()` fixe `base=0` pour tout — d'où
  // `statsAvecBase` pour ces tests, seul moyen de distinguer base et total.

  // VIT — remplace l'ancien test qui pinçait à tort le total runé.
  const vitStatsBase = statsAvecBase('spd', 120, 200, { atk: 2000, cd: 200, cr: 100 });
  const vitSetupSansLead: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune' };
  const vitSansLead = maVitCombat(vitStatsBase, vitSetupSansLead, null);
  egal(vitSansLead, 200, 'sans lead : la VIT de combat est le total runé (base ne joue aucun rôle sans lead ni invocateur)');
  const vitAvecLead = maVitCombat(vitStatsBase, { ...vitSetupSansLead, leaderSkill: { stat: 'Attack Speed', pct: 24 } }, null);
  egal(
    vitAvecLead,
    200 + Math.ceil((120 * 24) / 100),
    'le lead VIT porte sur la VIT de BASE (120 → +29), PAS sur le total runé (200 → aurait donné +48)'
  );
  const vitAvecLegacy = maVitCombat(vitStatsBase, { ...vitSetupSansLead, leaderSpeedPct: 24 }, null);
  egal(vitAvecLegacy, vitAvecLead, 'compatibilité arrière : `leaderSpeedPct` (recette pré-généralisation) résout au même calcul que `leaderSkill` VIT');

  // ATQ — Lushen S3 ne dépend que de l'ATQ (`variables === ['ATK']`), le
  // ratio isole exactement la contribution du lead.
  const atkStatsBase = statsAvecBase('atk', 1000, 2000, { cd: 200, cr: 100 });
  const setupLeadSansCrit: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal', summonerSkills: 'aucune' };
  const atkSansLead = computeSkillDamage(s3!, atkStatsBase, setupLeadSansCrit);
  const atkAvecLead44 = computeSkillDamage(s3!, atkStatsBase, { ...setupLeadSansCrit, leaderSkill: { stat: 'Attack Power', pct: 44 } });
  const atkEffectifAvecLead = 2000 + Math.ceil((1000 * 44) / 100); // 2000 + 440 = 2440
  ok(
    Math.abs(atkAvecLead44 / atkSansLead - atkEffectifAvecLead / 2000) < 1e-9,
    'le lead ATQ porte sur l’ATQ de BASE (1000 → +440), pas sur le total runé (2000 → aurait donné +880)'
  );
  // Le buff ATQ, LUI, porte sur le TOTAL — s'applique donc APRÈS le lead déjà
  // relevé, jamais sommé avec lui dans la même étape.
  const atkAvecLeadEtBuff = computeSkillDamage(
    s3!,
    atkStatsBase,
    { ...setupLeadSansCrit, atkBuff: true, leaderSkill: { stat: 'Attack Power', pct: 44 } }
  );
  const atkEffectifAvecLeadEtBuff = (atkEffectifAvecLead * (100 + ATK_BUFF_PCT)) / 100;
  ok(
    Math.abs(atkAvecLeadEtBuff / atkSansLead - atkEffectifAvecLeadEtBuff / 2000) < 1e-9,
    'le buff ATQ (%TOTAL) s’applique APRÈS le lead ATQ (%BASE) déjà posé, jamais sommé avec lui'
  );
  // Un lead sur une AUTRE stat que celle du sort n'a aucun effet.
  egal(
    computeSkillDamage(s3!, atkStatsBase, { ...setupLeadSansCrit, leaderSkill: { stat: 'Defense', pct: 50 } }),
    atkSansLead,
    'un lead DEF ne change rien à un sort qui ne dépend que de l’ATQ'
  );

  // DEF et PV — aucun sort du corpus utilisé ailleurs dans ce fichier n'en
  // dépend : formules synthétiques via `profil`, même patron que le reste
  // du fichier pour exercer une variable hors des sorts réels disponibles.
  const defProfil = profil('1.0*{DEF}');
  ok(defProfil !== null, 'formule DEF synthétique acceptée par le parseur');
  const defStatsBase = statsAvecBase('def', 500, 1200);
  const defSansLead = computeSkillDamage(defProfil!, defStatsBase, setupLeadSansCrit);
  const defAvecLead38 = computeSkillDamage(defProfil!, defStatsBase, { ...setupLeadSansCrit, leaderSkill: { stat: 'Defense', pct: 38 } });
  const defEffectifAvecLead = 1200 + Math.ceil((500 * 38) / 100); // 1200 + 190 = 1390
  ok(
    Math.abs(defAvecLead38 / defSansLead - defEffectifAvecLead / 1200) < 1e-9,
    'le lead DEF porte sur la DEF de BASE (500 → +190), pas sur le total runé (1200)'
  );

  const hpProfil = profil('1.0*{MAX HP}');
  ok(hpProfil !== null, 'formule PV synthétique acceptée par le parseur');
  const hpStatsBase = statsAvecBase('hp', 8000, 20000);
  const hpSansLead = computeSkillDamage(hpProfil!, hpStatsBase, setupLeadSansCrit);
  const hpAvecLead50 = computeSkillDamage(hpProfil!, hpStatsBase, { ...setupLeadSansCrit, leaderSkill: { stat: 'HP', pct: 50 } });
  const hpEffectifAvecLead = 20000 + Math.ceil((8000 * 50) / 100); // 20000 + 4000 = 24000
  ok(
    Math.abs(hpAvecLead50 / hpSansLead - hpEffectifAvecLead / 20000) < 1e-9,
    'le lead PV porte sur les PV de BASE (8000 → +4000), pas sur le total runé (20000)'
  );

  // Taux Crit / Dégâts Crit — des POINTS FLATS ajoutés à la stat, jamais un
  // pourcentage de la base : même famille que les compétences d'invocateur
  // et Euldong, PAS la même famille que PV/ATQ/DEF/VIT ci-dessus.
  const crSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne', summonerSkills: 'aucune' };
  const crStats = stats({ atk: 2000, cd: 200, cr: 50 });
  const crSansLead = computeSkillDamage(s3!, crStats, crSetup);
  const crAvecLead38 = computeSkillDamage(s3!, crStats, { ...crSetup, leaderSkill: { stat: 'Critical Rate', pct: 38 } });
  const skillup = s3!.skillupDamagePct / 100;
  const critTermCrSans = 1 + skillup + 0.5 * 2.0;
  const critTermCrAvec = 1 + skillup + Math.min(1, (50 + 38) / 100) * 2.0;
  ok(
    Math.abs(crAvecLead38 / crSansLead - critTermCrAvec / critTermCrSans) < 1e-9,
    'un lead Taux Crit ajoute 38 POINTS à la stat (50 % → 88 %), jamais un pourcentage de la base'
  );

  const cdSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'crit', summonerSkills: 'aucune' };
  const cdStats = stats({ atk: 2000, cd: 100, cr: 100 });
  const cdSansLead = computeSkillDamage(s3!, cdStats, cdSetup);
  const cdAvecLead25 = computeSkillDamage(s3!, cdStats, { ...cdSetup, leaderSkill: { stat: 'Critical DMG', pct: 25 } });
  const critTermCdSans = 1 + skillup + 1 * (100 / 100);
  const critTermCdAvec = 1 + skillup + 1 * ((100 + 25) / 100);
  ok(
    Math.abs(cdAvecLead25 / cdSansLead - critTermCdAvec / critTermCdSans) < 1e-9,
    'un lead Dégâts Crit ajoute 25 POINTS à la stat, même famille qu’Euldong'
  );

  // Paliers réels du jeu, confirmés par l'utilisateur — jamais une formule
  // générique, ces paliers ne suivent pas une progression régulière d'une
  // stat à l'autre.
  egal(LEADER_SKILL_PRESETS.HP, [28, 33, 38, 40, 44, 50], 'paliers PV');
  egal(LEADER_SKILL_PRESETS['Attack Power'], [28, 33, 38, 40, 44, 50], 'paliers ATQ');
  egal(LEADER_SKILL_PRESETS.Defense, [28, 33, 38, 40, 44, 50], 'paliers DEF');
  egal(LEADER_SKILL_PRESETS['Attack Speed'], [21, 24, 28, 30, 33], 'paliers VIT');
  egal(LEADER_SKILL_PRESETS['Critical Rate'], [21, 24, 28, 33, 38], 'paliers Taux Crit');
  egal(LEADER_SKILL_PRESETS['Critical DMG'], [25], 'palier Dégâts Crit — un seul connu');

  // `monsterCritSiPlusRapide` : Rigna/Ciri Eau/Magic Order Swordsinger
  // portent un passif SANS formule ni dégâts propres qui force le critique —
  // confirmé par l'utilisateur : « ce n'est pas un PASSIFS_OFFENSIFS_CONNUS ».
  ok(monsterCritSiPlusRapide(rigna), 'Rigna force le critique quand elle est plus rapide (Speed Difference)');
  ok(!monsterCritSiPlusRapide(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  ok(!monsterCritSiPlusRapide(null), 'fiche absente : false, jamais une exception');
  egal(
    monsterOffensivePassives(rigna).length,
    0,
    'Speed Difference N’EST PAS un passif offensif : aucune formule, aucun dégât propre'
  );

  // Intégration dans `computeTotalDamage` : force le critique sur le sort
  // actif (et sur un passif qui SUIT le réglage) uniquement quand Rigna est
  // RÉELLEMENT plus rapide que la cible configurée.
  const rignaSetupNonCrit: DamageSetup = { ...rignaSetup, critMode: 'normal' };
  const totalPlusRapide = computeTotalDamage(concentratedStab, [], rignaStats, { ...rignaSetupNonCrit, enemySpd: 100 }, null, ARTIFACT_DAMAGE_NEUTRE, true);
  const totalMemeVit = computeTotalDamage(concentratedStab, [], rignaStats, { ...rignaSetupNonCrit, enemySpd: 200 }, null, ARTIFACT_DAMAGE_NEUTRE, true);
  const critForce = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetupNonCrit, critMode: 'crit', enemySpd: 100 }, null);
  const sansCrit100 = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetupNonCrit, enemySpd: 100 }, null);
  const sansCrit200 = computeSkillDamage(concentratedStab, rignaStats, { ...rignaSetupNonCrit, enemySpd: 200 }, null);
  egal(totalPlusRapide, critForce, 'plus rapide que la cible : le critique est forcé, quel que soit le mode choisi');
  egal(totalMemeVit, sansCrit200, 'aussi rapide (ou plus lent) que la cible : le mécanisme ne se déclenche pas');
  ok(
    computeTotalDamage(concentratedStab, [], rignaStats, { ...rignaSetupNonCrit, enemySpd: 100 }, null, ARTIFACT_DAMAGE_NEUTRE, false) === sansCrit100,
    '`critSiPlusRapide=false` (monstre sans ce passif) : aucun effet, même VIT identique'
  );

  // Sonia — « Evasion (Passive) », TROISIÈME mécanique liée à la VIT,
  // distincte des deux précédentes : un bonus de dégâts CONTINU (pas un
  // critique binaire), confirmé linéaire par l'utilisateur — 50 points
  // d'écart de VIT = +50 %, 3 points = +3 %, 42 points = +42 %.
  const sonia = fiche(26113);
  const soniaBase = defaultDamageSkill(monsterDamageSkills(sonia));
  ok(soniaBase !== null, 'Sonia : un sort de dégâts par défaut est trouvé');
  ok(!soniaBase!.variables.includes('SPD'), 'aucun sort de Sonia ne dépend directement de la VIT');
  egal(monsterOffensivePassives(sonia).length, 0, 'Evasion N’EST PAS un passif offensif : aucune formule, aucun dégât propre');
  egal(
    monsterBonusDegatsSelonVit(sonia),
    { ecartMax: 50, pctMax: 50 },
    'Sonia porte bien le bonus continu (50 points = 50 %, curé)'
  );
  ok(!monsterBonusDegatsSelonVit(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  ok(!monsterBonusDegatsSelonVit(null), 'fiche absente : null, jamais une exception');

  const soniaStats = stats({ atk: 2000, cd: 200, cr: 100, spd: 200 });
  const soniaSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: soniaBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
  };
  const soniaConfig = monsterBonusDegatsSelonVit(sonia)!;
  const soniaSansEcart = computeSkillDamage(soniaBase!, soniaStats, { ...soniaSetup, enemySpd: 200 }, null);
  const totalMemeVitSonia = computeTotalDamage(soniaBase!, [], soniaStats, { ...soniaSetup, enemySpd: 200 }, null, ARTIFACT_DAMAGE_NEUTRE, false, soniaConfig);
  const total25 = computeTotalDamage(soniaBase!, [], soniaStats, { ...soniaSetup, enemySpd: 175 }, null, ARTIFACT_DAMAGE_NEUTRE, false, soniaConfig);
  const total50 = computeTotalDamage(soniaBase!, [], soniaStats, { ...soniaSetup, enemySpd: 150 }, null, ARTIFACT_DAMAGE_NEUTRE, false, soniaConfig);
  const total100 = computeTotalDamage(soniaBase!, [], soniaStats, { ...soniaSetup, enemySpd: 100 }, null, ARTIFACT_DAMAGE_NEUTRE, false, soniaConfig);
  const totalPlusLente = computeTotalDamage(soniaBase!, [], soniaStats, { ...soniaSetup, enemySpd: 260 }, null, ARTIFACT_DAMAGE_NEUTRE, false, soniaConfig);
  egal(totalMemeVitSonia, soniaSansEcart, 'aussi rapide que la cible : aucun bonus');
  ok(Math.abs(total25 / soniaSansEcart - 1.25) < 1e-9, '25 points d’écart : exactement +25 %');
  ok(Math.abs(total50 / soniaSansEcart - 1.5) < 1e-9, '50 points d’écart : exactement +50 % (le plafond)');
  ok(Math.abs(total100 / soniaSansEcart - 1.5) < 1e-9, '100 points d’écart : plafonné à +50 %, jamais plus');
  egal(totalPlusLente, soniaSansEcart, 'cible plus rapide que Sonia : le bonus tombe à 0 %, jamais négatif');
  ok(
    computeTotalDamage(soniaBase!, [], soniaStats, { ...soniaSetup, enemySpd: 100 }, null, ARTIFACT_DAMAGE_NEUTRE, false, null) === soniaSansEcart,
    'bonusDegatsSelonVit=null (monstre sans ce passif) : aucun effet, même VIT identique'
  );
  ok(
    damageRelevantStats(soniaBase, [], soniaSetup, false, soniaConfig).includes('spd'),
    'la VIT est privilégiée au pré-filtrage même si AUCUN sort de Sonia ne la lit directement'
  );

  // `monsterModificateursVit` — AFFICHAGE seul (icône/nom/description) des
  // deux modificateurs, pour qu'ils apparaissent dans « Passifs offensifs »
  // comme Feng Yan/Dominic — signalé absent par l'utilisateur.
  const modifSonia = monsterModificateursVit(sonia);
  egal(modifSonia.length, 1, 'Sonia : un seul modificateur affiché (Evasion)');
  egal(modifSonia[0]?.nom, 'Evasion (Passive)', 'nom exact du passif, pour l’icône/la recherche SWARFARM');
  ok(modifSonia[0]?.detail.includes('+50 %'), 'le détail affiché mentionne le plafond');
  const modifRigna = monsterModificateursVit(rigna);
  egal(modifRigna.length, 1, 'Rigna : un seul modificateur affiché (Speed Difference)');
  ok(modifRigna[0]?.detail.includes('critique garanti'), 'le détail affiché de Rigna mentionne le critique, pas un bonus de dégâts');

  // Zenitsu Agatsuma (Ténèbres)/Qilin Slasher (Ténèbres) — « Hidden Sense of
  // Justice »/« Lethal Intent », point 29 du catalogue : QUATRIÈME
  // mécanique liée à une stat (le Taux Crit cette fois, pas la VIT), même
  // famille que Sonia (multiplicatif sur le TOTAL, toujours actif). `quantite: 0`/
  // `null` en données — confirmé par l'utilisateur : « 1% de Taux critique =
  // 0,8% de dégâts supplémentaire », linéaire, sans plafond.
  const zenitsuTen = fiche(32215);
  const zenitsuTenBase = defaultDamageSkill(monsterDamageSkills(zenitsuTen));
  ok(zenitsuTenBase !== null, 'Zenitsu (Ténèbres) : un sort de dégâts par défaut est trouvé');
  egal(monsterBonusDegatsSelonCr(zenitsuTen), { ratio: 0.8 }, 'Zenitsu (Ténèbres) : Hidden Sense of Justice, 0,8 %/point de Taux Crit');
  const qilinTen = fiche(32915);
  egal(monsterBonusDegatsSelonCr(qilinTen) ? 'Lethal Intent (Passive)' : 'absent', 'Lethal Intent (Passive)', 'Qilin Slasher (Ténèbres) : même mécanisme, nom différent');
  egal(monsterBonusDegatsSelonCr(qilinTen), { ratio: 0.8 }, 'Qilin Slasher (Ténèbres) : même ratio');
  ok(!monsterBonusDegatsSelonCr(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  const crConfig = monsterBonusDegatsSelonCr(zenitsuTen)!;
  const zenitsuStats = stats({ atk: 2000, cd: 200, cr: 60 });
  const zenitsuSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: zenitsuTenBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
  };
  const zenitsuSans = computeSkillDamage(zenitsuTenBase!, zenitsuStats, zenitsuSetup);
  const zenitsuAvec = computeTotalDamage(zenitsuTenBase!, [], zenitsuStats, zenitsuSetup, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null, crConfig);
  // 60 % de Taux Crit × 0,8 = +48 %.
  ok(Math.abs(zenitsuAvec / zenitsuSans - 1.48) < 1e-9, '60 % de Taux Crit : exactement +48 % (60 × 0,8)');
  ok(
    computeTotalDamage(zenitsuTenBase!, [], zenitsuStats, zenitsuSetup, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null, null) === zenitsuSans,
    'bonusDegatsSelonCr=null (monstre sans ce passif) : aucun effet'
  );
  ok(
    damageRelevantStats(zenitsuTenBase, [], zenitsuSetup, false, null, null, null, false, crConfig).includes('cr'),
    'le Taux Crit est privilégié au pré-filtrage — SEUL cas de ce fichier (partout ailleurs, plafonné à 100 %, jamais une cible à maximiser)'
  );

  // Gideon (« Aegis Shell »), point 30a — CINQUIÈME mécanique liée à une
  // stat, cette fois la DEF PROPRE (pas un écart avec la cible, contrairement
  // à Martial Arts Specialist). `quantite: 100` confirmé en données —
  // confirmé par l'utilisateur : 100 % à 5000 DEF.
  const gideon = fiche(32311);
  const gideonBase = defaultDamageSkill(monsterDamageSkills(gideon));
  ok(gideonBase !== null, 'Gideon : un sort de dégâts par défaut est trouvé');
  egal(monsterBonusDegatsSelonDef(gideon), { defMax: 5000, pctMax: 100 }, 'Gideon : Aegis Shell, 100 % à 5000 DEF');
  ok(!monsterBonusDegatsSelonDef(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  const gideonConfig = monsterBonusDegatsSelonDef(gideon)!;
  const gideonStats = stats({ atk: 2000, def: 2500, cd: 200, cr: 100 });
  const gideonSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: gideonBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
  };
  const gideonSans = computeSkillDamage(gideonBase!, gideonStats, gideonSetup);
  const gideonAvec2500 = computeTotalDamage(gideonBase!, [], gideonStats, gideonSetup, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null, null, gideonConfig);
  // 2500 DEF = la moitié de 5000 → la moitié du plafond (50 %).
  ok(Math.abs(gideonAvec2500 / gideonSans - 1.5) < 1e-9, '2 500 DEF (la moitié de 5 000) : exactement +50 % (la moitié du plafond)');
  const gideonAvec10000 = computeTotalDamage(
    gideonBase!,
    [],
    stats({ atk: 2000, def: 10000, cd: 200, cr: 100 }),
    gideonSetup,
    null,
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    null,
    {},
    null,
    null,
    gideonConfig
  );
  const gideonSans10000 = computeSkillDamage(gideonBase!, stats({ atk: 2000, def: 10000, cd: 200, cr: 100 }), gideonSetup);
  ok(Math.abs(gideonAvec10000 / gideonSans10000 - 2) < 1e-9, '10 000 DEF (le double du plafond) : reste à +100 %, jamais plus (×2)');

  // Brita (« Might of the Mercenary »)/Eivor Eau (« Might of the Clan »),
  // point 30b — jumeaux de COLLABORATION (`jumeauCollab`, mêmes stats/
  // compétences), SEUIL absolu d'ATQ (pas linéaire, contrairement aux
  // quatre précédents). Deux réponses successives de l'utilisateur,
  // reconciliées : la première (Brita, « +633 d'ATQ, sans lead ») avait
  // été mal interprétée comme un écart sur la BASE seule (736+633=1369) ;
  // la seconde (Eivor, même mécanique confirmée indépendamment) donne le
  // total ABSOLU directement : « 1671, toute source confondue (base + rune
  // + lead + compétence d'invocateur) ». Les deux se recoupent EXACTEMENT :
  // 736 (base) + 302 (compétence d'invocateur combat, 41 % de la base) +
  // 633 (rune) = 1671 — confirme que `+633` désignait la part RUNE seule,
  // pas un écart sur la base entière. Seuil = 1671, ABSOLU (contrairement
  // à tous les autres seuils de ce fichier, des écarts), et INCLUT le lead
  // cette fois (contrairement à la première interprétation).
  const brita = fiche(28211);
  const britaBase = defaultDamageSkill(monsterDamageSkills(brita));
  ok(britaBase !== null, 'Brita : un sort de dégâts par défaut est trouvé');
  egal(monsterBonusSiAtqSeuil(brita), { seuil: 1671, pct: 100 }, 'Brita : Might of the Mercenary, seuil ABSOLU 1671');
  ok(!monsterBonusSiAtqSeuil(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  const eivorEau = fiche(27711);
  egal(monsterBonusSiAtqSeuil(eivorEau), { seuil: 1671, pct: 100 }, 'Eivor (Eau) : Might of the Clan, même mécanisme, nom différent (jumeaux de collaboration)');
  const britaSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: britaBase!.skillCom2usId,
    summonerSkills: 'combat',
    critMode: 'normal',
  };
  const britaConfig = monsterBonusSiAtqSeuil(brita)!;
  // Base 736 (Eau) + compétence d'invocateur combat (+20 % + 21 % élément
  // Eau = 41 % de la base, arrondi au-dessus) = 736 + 302 = 1038 sans
  // aucune rune. Seuil = 1671, donc 1671 − 1038 = 633 points d'ATQ de
  // RUNES nécessaires (`row.total`, le champ AVANT compétence
  // d'invocateur) pour l'atteindre pile — exactement le chiffre donné par
  // l'utilisateur pour Brita, confirmé être la part RUNE plutôt qu'un
  // écart sur la base.
  const britaStatsJusteSous = statsAvecBase('atk', 736, 736 + 632, { cd: 200, cr: 100 });
  const britaStatsPile = statsAvecBase('atk', 736, 736 + 633, { cd: 200, cr: 100 });
  const britaSansJusteSous = computeSkillDamage(britaBase!, britaStatsJusteSous, britaSetup, 'water');
  // ⚠️ Comparé à un SANS-bonus calculé sur LES MÊMES stats (+633) — un
  // point d'ATQ de runes change aussi légèrement le dégât DE BASE (l'ATQ
  // est une variable de la formule), pas seulement le déclenchement du
  // seuil : isoler le ×2 exige de garder les stats identiques des deux
  // côtés de la comparaison.
  const britaSansPile = computeSkillDamage(britaBase!, britaStatsPile, britaSetup, 'water');
  const britaJusteSous = computeTotalDamage(britaBase!, [], britaStatsJusteSous, britaSetup, 'water', ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null, null, null, britaConfig);
  const britaPile = computeTotalDamage(britaBase!, [], britaStatsPile, britaSetup, 'water', ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null, null, null, britaConfig);
  egal(britaJusteSous, britaSansJusteSous, '632 points de runes ATQ : un point sous le seuil, aucun bonus');
  ok(Math.abs(britaPile / britaSansPile - 2) < 1e-9, '633 points de runes ATQ : le seuil est atteint pile, +100 % (×2)');
  // Un lead ATQ DOIT maintenant aider à atteindre ce seuil (« toute source
  // confondue », confirmé explicitement — contrairement à la première
  // interprétation) : 632 points de runes (sous le seuil sans lead) avec
  // un lead ATQ +15 % pousse au-delà.
  const britaAvecLeadSousLeSeuil = computeTotalDamage(
    britaBase!,
    [],
    britaStatsJusteSous,
    { ...britaSetup, leaderSkill: { stat: 'Attack Power', pct: 15 } },
    'water',
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    null,
    {},
    null,
    null,
    null,
    britaConfig
  );
  const britaSansLeadMemeReglage = computeTotalDamage(
    britaBase!,
    [],
    britaStatsJusteSous,
    { ...britaSetup, leaderSkill: { stat: 'Attack Power', pct: 15 } },
    'water',
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    null,
    {},
    null,
    null,
    null,
    null
  );
  ok(
    Math.abs(britaAvecLeadSousLeSeuil / britaSansLeadMemeReglage - 2) < 1e-9,
    '632 points de runes ATQ SOUS le seuil sans lead, mais un lead ATQ +15 % pousse au-delà — le seuil est franchi, +100 % (×2)'
  );
  egal(monsterModificateursVit(fiche(LUSHEN)).length, 0, 'Lushen : aucun modificateur');
  egal(monsterModificateursVit(null).length, 0, 'fiche absente : liste vide, jamais une exception');

  titre('Dégâts réels — catalogue « passifs non implémentés », réponses jusqu’au point 26');

  // Chun-Li (Lumière)/Leah (Lumière) — même mécanisme que Sonia, seuls les
  // paliers changent (confirmé par l'utilisateur : max 200 % à 150 pts
  // d'écart, contre 50/50 pour Sonia).
  const chunli = fiche(24414);
  const chunliBase = defaultDamageSkill(monsterDamageSkills(chunli));
  ok(chunliBase !== null, 'Chun-Li (Lumière) : un sort de dégâts par défaut est trouvé');
  egal(monsterBonusDegatsSelonVit(chunli), { ecartMax: 150, pctMax: 200 }, 'Chun-Li (Lumière) : paliers confirmés par l’utilisateur');
  const leah = fiche(24914);
  const leahBase = defaultDamageSkill(monsterDamageSkills(leah));
  ok(leahBase !== null, 'Leah (Lumière) : un sort de dégâts par défaut est trouvé');
  egal(monsterBonusDegatsSelonVit(leah), { ecartMax: 150, pctMax: 200 }, 'Leah (Lumière) : mêmes paliers');
  ok(!monsterBonusDegatsSelonVit(fiche(24413)), 'Chun-Li (Vent) porte un passif différent (Rankyaku), pas ce mécanisme');
  const chunliStats = stats({ atk: 2000, cd: 200, cr: 100, spd: 200 });
  const chunliSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: chunliBase!.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  const chunliConfig = monsterBonusDegatsSelonVit(chunli)!;
  const chunliSansEcart = computeSkillDamage(chunliBase!, chunliStats, { ...chunliSetup, enemySpd: 200 });
  const chunliAvec150 = computeTotalDamage(chunliBase!, [], chunliStats, { ...chunliSetup, enemySpd: 50 }, null, ARTIFACT_DAMAGE_NEUTRE, false, chunliConfig);
  ok(Math.abs(chunliAvec150 / chunliSansEcart - 3) < 1e-9, 'Chun-Li : 150 pts d’écart = +200 % (le plafond), soit ×3');
  // ⚠️ RÉGRESSION trouvée en implémentant Gideon (point 30a), PAS signalée
  // par l'utilisateur : le plafond clampait `ecartVit` sur `pctMax` (200) au
  // lieu de `ecartMax` (150) — invisible sur Sonia (50 % = 50 pts,
  // coïncidence), mais un écart de VIT > 150 donnait ~267 % au lieu de
  // rester à 200 %. `enemySpd` très bas pour dépasser largement les 150 pts.
  const chunliAvecEcartEnorme = computeTotalDamage(chunliBase!, [], chunliStats, { ...chunliSetup, enemySpd: 1 }, null, ARTIFACT_DAMAGE_NEUTRE, false, chunliConfig);
  ok(
    Math.abs(chunliAvecEcartEnorme / chunliSansEcart - 3) < 1e-9,
    'Chun-Li : BIEN AU-DELÀ de 150 pts d’écart, toujours plafonné à +200 % (×3), jamais ~267 %'
  );

  // Ciri (Feu)/Magic Order Swordsinger (Feu)/Reyka — Taux Crit selon la VIT
  // (1 pt tous les 12 pts, confirmé), surplus au-delà de 100 % reversé en
  // Dgts Crit 1 pour 1 (y compris le surplus apporté par ce même passif).
  egal(monsterCritRateSelonVit(fiche(29312)), { ptsParVit: 12 }, 'Ciri (Feu)');
  egal(monsterCritRateSelonVit(fiche(29702)), { ptsParVit: 12 }, 'Magic Order Swordsinger (Feu)');
  egal(monsterCritRateSelonVit(fiche(29712)), { ptsParVit: 12 }, 'Reyka');
  ok(!monsterCritRateSelonVit(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  ok(!monsterCritRateSelonVit(null), 'fiche absente : null, jamais une exception');
  const critVitConfig = { critRateSelonVit: { ptsParVit: 12 } };
  // maVit = 240 (spd runé, aucune compétence d'invocateur) → crDepuisVit =
  // floor(240/12) = 20 pts.
  const critVitStatsSansOverflow = stats({ atk: 2000, cd: 100, cr: 40, spd: 240 });
  const critVitSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne', summonerSkills: 'aucune' };
  const skillupS3 = s3!.skillupDamagePct / 100;
  const detailAvecVit = computeSkillDamageDetail(s3!, critVitStatsSansOverflow, critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, critVitConfig);
  const detailSansVit = computeSkillDamageDetail(s3!, critVitStatsSansOverflow, critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
  ok(
    Math.abs(detailAvecVit.total / detailSansVit.total - (1 + skillupS3 + 0.6 * 1.0) / (1 + skillupS3 + 0.4 * 1.0)) < 1e-9,
    '20 pts de Taux Crit ajoutés par la VIT (40 % → 60 %), sans dépasser 100 % : aucun reversement en Dgts Crit'
  );
  // Même stats mais cr=90 : crBrut = 90+20 = 110 → 10 pts de surplus
  // reversés en Dgts Crit, cr plafonné à 100 %.
  const critVitStatsOverflow = stats({ atk: 2000, cd: 100, cr: 90, spd: 240 });
  const detailOverflow = computeSkillDamageDetail(s3!, critVitStatsOverflow, critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, critVitConfig);
  const detailOverflowSansPassif = computeSkillDamageDetail(s3!, critVitStatsOverflow, critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
  ok(
    Math.abs(
      detailOverflow.total / detailOverflowSansPassif.total -
        (1 + skillupS3 + 1 * 1.1) / (1 + skillupS3 + 0.9 * 1.0)
    ) < 1e-9,
    'le surplus de Taux Crit au-delà de 100 % (10 pts) se reverse en Dgts Crit, 1 pour 1'
  );
  // ⚠️ Régression ciblée : SANS le passif, un Taux Crit BRUT > 100 % (runes
  // très généreuses) doit rester simplement plafonné, jamais reversé.
  const sansVitCr130 = computeSkillDamageDetail(s3!, stats({ atk: 2000, cd: 100, cr: 130, spd: 240 }), critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
  const sansVitCr100 = computeSkillDamageDetail(s3!, stats({ atk: 2000, cd: 100, cr: 100, spd: 240 }), critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
  egal(sansVitCr130.total, sansVitCr100.total, 'un monstre SANS ce passif reste simplement plafonné à 100 %, aucun reversement');

  // Lizardman (Lumière)/Glinodon — « Detect Weakspot » : +20 pts de Taux
  // Crit et +20 pts de Dgts Crit, inconditionnels (« Automatic Effect »).
  egal(monsterBonusStatFixe(fiche(17804)), { cr: 20, cd: 20 }, 'Lizardman (Lumière)');
  egal(monsterBonusStatFixe(fiche(17814)), { cr: 20, cd: 20 }, 'Glinodon');
  ok(!monsterBonusStatFixe(fiche(17801)), 'Lizardman (Eau) porte un passif différent (Bloody Skin), pas Detect Weakspot');
  ok(!monsterBonusStatFixe(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  const fixeStats = stats({ atk: 2000, cd: 100, cr: 50, spd: 100 });
  const detailAvecFixe = computeSkillDamageDetail(s3!, fixeStats, critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, { bonusStatFixe: { cr: 20, cd: 20 } });
  const detailSansFixe = computeSkillDamageDetail(s3!, fixeStats, critVitSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
  ok(
    Math.abs(
      detailAvecFixe.total / detailSansFixe.total - (1 + skillupS3 + 0.7 * 1.2) / (1 + skillupS3 + 0.5 * 1.0)
    ) < 1e-9,
    'Detect Weakspot : +20 pts de Taux Crit ET +20 pts de Dgts Crit, toujours actif'
  );

  // Bonus conditionnel à bouton — douze passifs sans formule propre,
  // condition que l'app ne peut pas déduire (PV propres, comparaison avec
  // la cible, état d'un allié, tour précédent…). Détection un par un,
  // contre le texte SWARFARM réel (pas la paraphrase d'une recherche).
  const conditionnelAttendus: [number, string, number][] = [
    [33111, 'Indomitable Will (Passive)', 100], // Jin Kazama
    [33601, "Martial Artist's Will (Passive)", 100], // Kai
    [30103, 'Self Repair (Passive)', 100], // Cyborg (Vent)
    [18004, 'Small Grudge (Passive)', 100], // Brownie Magician (Lumière)
    [18014, 'Small Grudge (Passive)', 100], // Gemini
    [19812, 'Vengeful Fire(Passive)', 100], // Astar
    [14112, 'Quality of Phantom (Passive)', 100], // Jean
    [24811, 'Strategic Advantage (Passive)', 100], // Kyle
    [30312, 'Infinity (Passive)', 100], // Satoru Gojo (Feu)
    [30902, 'Magic Resistance (Passive)', 100], // Werner (Feu)
    [32212, 'Protective Power (Passive)', 50], // Zenitsu Agatsuma (Feu)
    [32912, 'Retributive Power (Passive)', 50], // Qilin Slasher (Feu)
    [21205, 'Almighty Strength (Passive)', 50], // Panda Warrior (Ténèbres)
    [21215, 'Almighty Strength (Passive)', 50], // Mi Ying
    // « Hidden Aim » : demandé explicitement par l'utilisateur (interrupteur
    // pour Carcano) alors que ce n'est PAS un passif (S2 actif, formule
    // vide — voir le filtre relâché dans `monsterBonusDegatsConditionnel`).
    // Même nom partagé par TOUTE la famille Sniper Mk.I/Carcano/Carbine/
    // Dragunov (3 éléments × 2 stades d'éveil) sans code supplémentaire,
    // même mécanisme de curation par nom exact que « Ray Spears ».
    [22712, 'Hidden Aim', 200], // Carcano (Feu)
  ];
  for (const [id, nom, pct] of conditionnelAttendus) {
    const p = monsterBonusDegatsConditionnel(fiche(id));
    egal(p?.nom, nom, `${id} : nom exact du passif détecté`);
    egal(p?.pct, pct, `${id} (${nom}) : pourcentage confirmé`);
  }
  ok(!monsterBonusDegatsConditionnel(fiche(LUSHEN)), 'Lushen ne porte aucun de ces modificateurs');
  ok(!monsterBonusDegatsConditionnel(null), 'fiche absente : null, jamais une exception');

  // Profondeur numérique sur UN cas représentatif (Jin Kazama) : le bouton
  // (désactivé par défaut) multiplie le TOTAL par exactement 1+pct/100.
  const jinKazama = fiche(33111);
  const jkBase = defaultDamageSkill(monsterDamageSkills(jinKazama));
  ok(jkBase !== null, 'Jin Kazama : un sort de dégâts par défaut est trouvé');
  const jkStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const jkSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: jkBase!.skillCom2usId, summonerSkills: 'aucune' };
  const jkConfig = monsterBonusDegatsConditionnel(jinKazama)!;
  egal(bonusDegatsConditionnelActif(jkConfig, jkSetup), false, 'désactivé par défaut, jamais deviné actif');
  const jkSansToggle = computeTotalDamage(jkBase!, [], jkStats, jkSetup, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, jkConfig);
  const jkAvecToggle = computeTotalDamage(
    jkBase!,
    [],
    jkStats,
    { ...jkSetup, passifsOffensifs: { [jkConfig.skillCom2usId]: true } },
    null,
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    null,
    {},
    jkConfig
  );
  ok(Math.abs(jkAvecToggle / jkSansToggle - 2) < 1e-9, 'Indomitable Will activé : exactement +100 % (×2)');
  egal(
    computeTotalDamage(jkBase!, [], jkStats, jkSetup, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null, {}, null),
    jkSansToggle,
    'bonusDegatsConditionnel=null (monstre sans ce passif) : aucun effet, même réglages identiques'
  );

  titre('Dégâts réels — bonus de dégâts ACCUMULABLE (Momo)');

  // Momo — « Secret Book (Passive) » : « increases the damage by 10% each,
  // up to 200%, whenever an ally attacks » — RIEN que l'app ne simule (le
  // nombre d'attaques alliées portées ce combat), donc un champ saisi par
  // l'utilisateur plutôt qu'un état déduit.
  const momo = fiche(25213);
  const momoBase = defaultDamageSkill(monsterDamageSkills(momo));
  ok(momoBase !== null, 'Momo : un sort de dégâts par défaut est trouvé');
  egal(monsterOffensivePassives(momo).length, 0, 'Secret Book N’EST PAS un passif offensif : aucune formule, aucun dégât propre');
  const stackMomo = monsterBonusDegatsStackable(momo)!;
  ok(stackMomo != null, 'Momo porte bien le bonus accumulable');
  egal(stackMomo.ratio, 10, '+10 % de dégâts par attaque alliée, confirmé par le texte du jeu');
  egal(stackMomo.triggerMax, 20, 'plafond DÉCLENCHEUR : 20 attaques (20 × 10 % = 200 %)');
  egal(stackMomo.pctMax, 200, 'plafond de DÉGÂTS : 200 %, confirmé par le texte du jeu');
  ok(!monsterBonusDegatsStackable(fiche(LUSHEN)), 'Lushen n’a pas ce mécanisme');
  ok(!monsterBonusDegatsStackable(null), 'fiche absente : null, jamais une exception');

  const momoStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const momoSetupSansStack: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: momoBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
  };
  egal(resolvedStackTrigger(stackMomo, momoSetupSansStack), 0, 'sans réglage utilisateur, le déclencheur retombe sur 0 — jamais deviné actif');
  egal(resolvedStackPct(stackMomo, momoSetupSansStack), 0, 'donc 0 % de dégâts');
  const momoSansStack = computeSkillDamage(momoBase!, momoStats, momoSetupSansStack, null);
  const totalSansStack = computeTotalDamage(momoBase!, [], momoStats, momoSetupSansStack, null, ARTIFACT_DAMAGE_NEUTRE, false, null, stackMomo);
  egal(totalSansStack, momoSansStack, 'déclencheur à 0 : aucun effet sur les dégâts');

  // ⚠️ Le DÉCLENCHEUR (nombre d'attaques alliées, ici 5) et le BONUS DE
  // DÉGÂTS qui en résulte (5 × 10 % = 50 %) sont DEUX NOMBRES DIFFÉRENTS —
  // `stackPersonnalise` porte désormais le DÉCLENCHEUR, jamais le bonus
  // directement (bug corrigé, signalé par l'utilisateur sur Borgnine/Trevor).
  const momoSetup5Attaques: DamageSetup = {
    ...momoSetupSansStack,
    stackPersonnalise: { [stackMomo.skillCom2usId]: 5 },
  };
  egal(resolvedStackTrigger(stackMomo, momoSetup5Attaques), 5, 'le déclencheur saisi (5 attaques) est bien repris');
  egal(resolvedStackPct(stackMomo, momoSetup5Attaques), 50, '5 attaques × 10 % = exactement 50 % de dégâts, jamais le déclencheur brut');
  const momoTotal50 = computeTotalDamage(momoBase!, [], momoStats, momoSetup5Attaques, null, ARTIFACT_DAMAGE_NEUTRE, false, null, stackMomo);
  ok(Math.abs(momoTotal50 / momoSansStack - 1.5) < 1e-9, '5 attaques : exactement +50 % de dégâts');

  // Hors plage — jamais laissé tel quel (recette écrite pour une autre
  // version des données, ou déclencheur saisi puis monstre différent
  // chargé) : le déclencheur lui-même est borné à `triggerMax` (20), pas
  // seulement le résultat.
  const momoSetupTropHaut: DamageSetup = {
    ...momoSetupSansStack,
    stackPersonnalise: { [stackMomo.skillCom2usId]: 35 },
  };
  egal(resolvedStackTrigger(stackMomo, momoSetupTropHaut), 20, 'un déclencheur saisi AU-DELÀ de 20 attaques est borné à 20, jamais plus');
  egal(resolvedStackPct(stackMomo, momoSetupTropHaut), 200, 'donc 200 % de dégâts, jamais plus');
  const totalTropHaut = computeTotalDamage(momoBase!, [], momoStats, momoSetupTropHaut, null, ARTIFACT_DAMAGE_NEUTRE, false, null, stackMomo);
  const total20 = computeTotalDamage(
    momoBase!,
    [],
    momoStats,
    { ...momoSetupSansStack, stackPersonnalise: { [stackMomo.skillCom2usId]: 20 } },
    null,
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    stackMomo
  );
  egal(totalTropHaut, total20, '35 attaques saisies ou 20 pile : même résultat, le plafond du déclencheur fait foi');

  ok(
    computeTotalDamage(momoBase!, [], momoStats, momoSetup5Attaques, null, ARTIFACT_DAMAGE_NEUTRE, false, null, null) === momoSansStack,
    'bonusDegatsStack=null (monstre sans ce passif) : le champ stackPersonnalise de la recette est ignoré'
  );

  // Trois nouvelles entrées, MÊME mécanisme que Momo (aucun nouveau code,
  // juste des paliers curés) — réponses de l'utilisateur au catalogue
  // « passifs non implémentés ».
  const dominatorFermion = monsterBonusDegatsStackable(fiche(17015));
  egal(dominatorFermion?.nom, 'Dominator (Passive)', 'Fermion : nom exact du passif détecté');
  egal(dominatorFermion?.ratio, 10, 'Fermion : +10 % par allié mort');
  egal(dominatorFermion?.triggerMax, 3, 'Fermion : plafond déclencheur, 3 alliés morts');
  egal(dominatorFermion?.pctMax, 30, 'Fermion : plafonné à +30 % de dégâts');
  const rollAgainLudo = monsterBonusDegatsStackable(fiche(21312));
  egal(rollAgainLudo?.nom, 'Roll Again (Passive)', 'Ludo : nom exact du passif détecté');
  egal(rollAgainLudo?.ratio, 20, 'Ludo : +20 % de dégâts par point du dé');
  egal(rollAgainLudo?.triggerMax, 6, 'Ludo : le dé va de 1 à 6, confirmé par l’utilisateur');
  egal(rollAgainLudo?.pctMax, 100, 'Ludo : plafonné à 100 % de dégâts');
  const absorbShadowMartina = monsterBonusDegatsStackable(fiche(22015));
  egal(absorbShadowMartina?.nom, 'Absorb Shadow (Passive)', 'Martina : nom exact du passif détecté');
  egal(absorbShadowMartina?.ratio, 10, 'Martina : +10 % par vol de BUFF (pas de PV, corrigé)');
  egal(absorbShadowMartina?.label, 'Buffs volés', 'Martina : « Steal Buff » en données SWARFARM, pas un vol de PV');
  egal(absorbShadowMartina?.pctMax, 150, 'Martina : plafonné à +150 % (15 fois)');

  titre('Dégâts réels — effets d’ÉQUIPE (Euldong, Mirinae, Deborah, Miriam)');

  // Quatre effets portés par un AUTRE monstre que celui optimisé, demandés
  // sélectionnables dans « Effets actifs » comme un buff ATQ, portrait du
  // monstre en icône.
  const equipeStats = stats({ atk: 2000, cd: 100, cr: 100 });
  const equipeSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: s3!.skillCom2usId, summonerSkills: 'aucune' };

  // Euldong — +100 POINTS de Dgts Crit (pas un facteur ×2), confirmé par
  // l'utilisateur. En mode Critique garanti, critTerm = 1 + skillup% + cd —
  // le ratio isole exactement l'effet, indépendamment du reste de l'équation.
  const euldongOff = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, critMode: 'crit' }, null);
  const euldongOn = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, critMode: 'crit', euldongActif: true }, null);
  const critTermSansEuldong = 1 + s3!.skillupDamagePct / 100 + 1 * (100 / 100);
  const critTermAvecEuldong = 1 + s3!.skillupDamagePct / 100 + 1 * ((100 + EULDONG_CD_POINTS) / 100);
  ok(
    Math.abs(euldongOn / euldongOff - critTermAvecEuldong / critTermSansEuldong) < 1e-9,
    'Euldong ajoute exactement 100 points à la stat Dgts Crit utilisée par le critTerm'
  );

  // Mirinae — +30 % additif dans les Réductions, même famille que la Marque.
  const mirinaeOff = computeTotalDamage(s3!, [], equipeStats, equipeSetup, null);
  const mirinaeOn = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, mirinaeActif: true }, null);
  ok(Math.abs(mirinaeOn / mirinaeOff - (1 + MIRINAE_BONUS_PCT / 100)) < 1e-9, 'Mirinae ajoute exactement +30 % au total, comme la Marque');
  const mirinaeEtBrand = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, mirinaeActif: true, brand: true }, null);
  ok(
    Math.abs(mirinaeEtBrand / mirinaeOff - (1 + MIRINAE_BONUS_PCT / 100 + BRAND_BONUS_PCT / 100)) < 1e-9,
    'Mirinae et la Marque s’ADDITIONNENT (confirmé : « stacks additively »), ne se multiplient pas entre elles'
  );

  // Deborah — amplifie la RÉDUCTION d'une réduction de DEF déjà active :
  // 91 % de DEF effective en moins (0,7 × 1,30) avec `defBreak` ET Deborah,
  // contre 70 % (`DEF_BREAK_FACTOR` seul) sans elle. `s1p` (déjà défini plus
  // haut, n'ignore PAS la défense) — comparé via `defenseFactor`, seule la
  // mitigation change entre les deux calculs.
  const deborahBase: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: s1p.skillCom2usId, summonerSkills: 'aucune', defBreak: true };
  const deborahOff = computeTotalDamage(s1p, [], equipeStats, deborahBase, null);
  const deborahOn = computeTotalDamage(s1p, [], equipeStats, { ...deborahBase, deborahActif: true }, null);
  const mitigationSansDeborah = defenseFactor(1000 * DEF_BREAK_FACTOR);
  const mitigationAvecDeborah = defenseFactor(1000 * (1 - (1 - DEF_BREAK_FACTOR) * DEBORAH_AMPLIFY));
  ok(
    Math.abs(deborahOn / deborahOff - mitigationAvecDeborah / mitigationSansDeborah) < 1e-9,
    'Deborah amplifie la réduction de DEF de 30 % (70 % → 91 % de DEF en moins), jamais une réduction à elle seule'
  );
  const deborahSansDefBreak = computeTotalDamage(
    s1p,
    [],
    equipeStats,
    { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: s1p.skillCom2usId, summonerSkills: 'aucune', defBreak: false, deborahActif: true },
    null
  );
  const sansRienDuTout = computeTotalDamage(
    s1p,
    [],
    equipeStats,
    { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: s1p.skillCom2usId, summonerSkills: 'aucune', defBreak: false },
    null
  );
  egal(deborahSansDefBreak, sansRienDuTout, 'Deborah SANS def break actif : rien à amplifier, aucun effet');

  // Miriam — amplifie la MAGNITUDE des buffs ATQ/DEF/VIT déjà actifs de
  // 35 %, jamais leur simple présence. `s3` ne dépend que de l'ATQ
  // (`variables === ['ATK']`) : le ratio isole exactement l'amplification.
  const miriamOff = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, atkBuff: true }, null);
  const miriamOn = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, atkBuff: true, miriamActif: true }, null);
  const buffAtkSansMiriam = 1 + ATK_BUFF_PCT / 100;
  const buffAtkAvecMiriam = 1 + (ATK_BUFF_PCT * (1 + MIRIAM_AMPLIFY_PCT / 100)) / 100;
  ok(
    Math.abs(miriamOn / miriamOff - buffAtkAvecMiriam / buffAtkSansMiriam) < 1e-9,
    'Miriam amplifie le buff ATQ de 35 % (+50 % devient +67,5 %), pas la stat plate'
  );
  const miriamSansBuff = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, miriamActif: true }, null);
  const sansMiriamNiBuff = computeTotalDamage(s3!, [], equipeStats, equipeSetup, null);
  egal(miriamSansBuff, sansMiriamNiBuff, 'Miriam SANS aucun buff actif : rien à amplifier, aucun effet');
  // VIT aussi (via maVitCombat, déjà responsable de speedBuffAmpliPct) — stats
  // dédiées avec une VIT non nulle, `equipeStats` n'en porte pas.
  const statsAvecVit = stats({ atk: 2000, cd: 100, cr: 100, spd: 100 });
  const vitSansMiriam = maVitCombat(statsAvecVit, { ...equipeSetup, spdBuff: true }, null);
  const vitAvecMiriam = maVitCombat(statsAvecVit, { ...equipeSetup, spdBuff: true, miriamActif: true }, null);
  ok(
    Math.abs(vitAvecMiriam / vitSansMiriam - (1 + (SPD_BUFF_PCT * (1 + MIRIAM_AMPLIFY_PCT / 100)) / 100) / (1 + SPD_BUFF_PCT / 100)) <
      1e-9,
    'Miriam amplifie aussi le buff de VIT, comme un artéfact « Effet aug. VIT »'
  );

  // Dr. Matteo (« Transmission ») — même famille que Mirinae (formulation
  // identique dans le texte du jeu), additif dans le terme Réductions.
  const transmissionOff = computeTotalDamage(s3!, [], equipeStats, equipeSetup, null);
  const transmissionOn = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, transmissionActif: true }, null);
  ok(
    Math.abs(transmissionOn / transmissionOff - (1 + TRANSMISSION_BONUS_PCT / 100)) < 1e-9,
    'Dr. Matteo ajoute exactement +20 % au total'
  );
  const transmissionEtMirinae = computeTotalDamage(
    s3!,
    [],
    equipeStats,
    { ...equipeSetup, transmissionActif: true, mirinaeActif: true },
    null
  );
  ok(
    Math.abs(transmissionEtMirinae / transmissionOff - (1 + TRANSMISSION_BONUS_PCT / 100 + MIRINAE_BONUS_PCT / 100)) < 1e-9,
    'Dr. Matteo et Mirinae s’ADDITIONNENT, ne se multiplient pas entre eux (même terme Réductions)'
  );

  // Velaska (« Price of Pain ») — +0,5 % de dégâts par point de % de PV
  // perdu SAISI (l'app ne simule pas les PV réels du monstre optimisé).
  const velaskaSetupInactif: DamageSetup = { ...equipeSetup, velaskaActif: false, velaskaPvPerduPct: 40 };
  const velaskaInactif = computeTotalDamage(s3!, [], equipeStats, velaskaSetupInactif, null);
  egal(velaskaInactif, transmissionOff, 'velaskaActif=false : le % de PV perdus saisi est ignoré, même sans le remettre à 0');
  const velaskaSans0 = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, velaskaActif: true }, null);
  egal(velaskaSans0, transmissionOff, 'velaskaActif=true mais 0 % de PV perdus (défaut) : aucun effet');
  const velaska40 = computeTotalDamage(s3!, [], equipeStats, { ...equipeSetup, velaskaActif: true, velaskaPvPerduPct: 40 }, null);
  ok(
    Math.abs(velaska40 / transmissionOff - (1 + (VELASKA_PCT_PAR_PV_PERDU * 40) / 100)) < 1e-9,
    '40 % de PV perdus : exactement +20 % de dégâts (0,5 % × 40)'
  );

  titre('Dégâts réels — bonus de dégâts selon les effets sur la CIBLE (Julie, Melissa)');

  // Julie/Pierrette — « Thousand Shots » : « The damage increases by 50%
  // for each beneficial effect on the enemies. » Confirmé dans les données
  // SWARFARM elles-mêmes (`quantite: 50` sur l'effet « Buff Bonus
  // Damage ») — pas seulement la prose. ⚠️ Les coups sont VARIABLES (4 à 6,
  // 6 pile à pleine vie, confirmé par l'utilisateur) — même mécanisme que
  // Okeanos S3/Amber S2 (`COUPS_VARIABLES_CONNUS`), min retenu par défaut
  // (4), jamais une surestimation.
  const julie = fiche(13911);
  const julieSkills = monsterDamageSkills(julie);
  const thousandShots = julieSkills.find((s) => estPrisEnCharge(s) && s.nom === 'Thousand Shots');
  ok(thousandShots != null && estPrisEnCharge(thousandShots), 'Thousand Shots : profil calculable trouvé');
  const thousandShotsProfile = thousandShots as SkillDamageProfile;
  egal(thousandShotsProfile.bonusParEffetCible, { pct: 50, source: 'buffs' }, 'Julie : +50 % par effet BÉNÉFIQUE uniquement, confirmé par les données');
  egal(thousandShotsProfile.hitsRange, { min: 4, max: 6, defaut: 6 }, 'Julie : coups variables, 4 à 6 (6 à pleine vie)');
  egal(thousandShotsProfile.hits, 6, 'le défaut (6, pleine vie) est retenu — exception explicite au « jamais une surestimation » général');
  const julieStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const julieSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: thousandShotsProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  egal(resolvedEffetsCibleCount(thousandShotsProfile, julieSetup), 0, 'sans réglage utilisateur, 0 effet — jamais deviné');
  const julieSans = computeSkillDamage(thousandShotsProfile, julieStats, julieSetup);
  const julieAvec3 = computeSkillDamage(thousandShotsProfile, julieStats, { ...julieSetup, effetsCibleCount: { [thousandShotsProfile.skillCom2usId]: 3 } });
  ok(Math.abs(julieAvec3 / julieSans - 2.5) < 1e-9, '3 effets bénéfiques sur la cible : exactement +150 % (50 % × 3), soit ×2,5');

  // Melissa/Chakram Dancer — « Massacre Dance » : « increases the damage by
  // 10% each according to the number of beneficial AND harmful effects » —
  // BUFFS ET DEBUFFS, contrairement à Julie. `quantite: 10` confirmé sur
  // LES DEUX effets (« Buff Bonus Damage » ET « Debuff Bonus Damage »).
  const melissa = fiche(21913);
  const melissaSkills = monsterDamageSkills(melissa);
  const massacreDance = melissaSkills.find((s) => estPrisEnCharge(s) && s.nom === 'Massacre Dance');
  ok(massacreDance != null && estPrisEnCharge(massacreDance), 'Massacre Dance : profil calculable trouvé');
  const massacreDanceProfile = massacreDance as SkillDamageProfile;
  egal(massacreDanceProfile.bonusParEffetCible, { pct: 10, source: 'buffsEtDebuffs' }, 'Melissa : +10 % par effet, BUFFS ET DEBUFFS confondus');
  const melissaStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const melissaSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: massacreDanceProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  const melissaSans = computeSkillDamage(massacreDanceProfile, melissaStats, melissaSetup);
  const melissaAvec5 = computeSkillDamage(massacreDanceProfile, melissaStats, { ...melissaSetup, effetsCibleCount: { [massacreDanceProfile.skillCom2usId]: 5 } });
  ok(Math.abs(melissaAvec5 / melissaSans - 1.5) < 1e-9, '5 effets (buffs+debuffs confondus) : exactement +50 % (10 % × 5)');

  // Un sort SANS ce mécanisme (Lushen S3) n'y est jamais sensible, même si
  // `effetsCibleCount` porte une valeur pour une autre clé.
  ok(!s3!.bonusParEffetCible, 'Lushen S3 ne porte pas ce mécanisme');
  egal(
    computeSkillDamage(s3!, julieStats, { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', effetsCibleCount: { 999: 10 } }),
    computeSkillDamage(s3!, julieStats, { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune' }),
    'un effetsCibleCount saisi pour un AUTRE sort n’a aucun effet ici'
  );

  // Covenant (« Suppressive Fire ») — `quantite: 0` dans les données
  // SWARFARM, mais confirmé par l'utilisateur en aparté : « chaque buff sur
  // l'ennemi rajoute 100% au ratio du sort » — comme Julie, BUFFS seuls.
  const covenant = fiche(22711);
  const suppressiveFire = monsterDamageSkills(covenant).find((s) => estPrisEnCharge(s) && s.nom === 'Suppressive Fire');
  ok(suppressiveFire != null && estPrisEnCharge(suppressiveFire), 'Covenant : Suppressive Fire calculable');
  const suppressiveFireProfile = suppressiveFire as SkillDamageProfile;
  egal(suppressiveFireProfile.bonusParEffetCible, { pct: 100, source: 'buffs' }, 'Covenant : +100 % par effet BÉNÉFIQUE, confirmé par l’utilisateur');
  const covenantStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const covenantSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: suppressiveFireProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  const covenantSans = computeSkillDamage(suppressiveFireProfile, covenantStats, covenantSetup);
  const covenantAvec2 = computeSkillDamage(suppressiveFireProfile, covenantStats, {
    ...covenantSetup,
    effetsCibleCount: { [suppressiveFireProfile.skillCom2usId]: 2 },
  });
  ok(Math.abs(covenantAvec2 / covenantSans - 3) < 1e-9, '2 buffs retirés : exactement +200 % (100 % × 2), soit ×3');

  // Brandia (« Touch of Mercy ») — trouvé en cherchant pourquoi elle
  // n'apparaissait dans AUCUNE table existante malgré un signalement direct
  // de l'utilisateur (« augmente ses dégâts selon le nombre d'effets
  // néfastes sur l'ennemi ») : elle porte le flag SWARFARM « Debuff Bonus
  // Damage », jamais cherché par le catalogue original (qui ne cherchait que
  // « Increase Damage »/« Increase Critical Damage »/« Buff Bonus Damage »).
  // `quantite: 40` confirmé en données — BUFFS ET DEBUFFS comptés ensemble
  // (comme Melissa), pas « débuffs seuls » malgré la description du
  // signalement (le texte réel du jeu dit « harmful effect OR beneficial
  // effect »).
  const brandia = fiche(18912);
  const touchOfMercy = monsterDamageSkills(brandia).find((s) => estPrisEnCharge(s) && s.nom === 'Touch of Mercy');
  ok(touchOfMercy != null && estPrisEnCharge(touchOfMercy), 'Brandia : Touch of Mercy calculable');
  const touchOfMercyProfile = touchOfMercy as SkillDamageProfile;
  egal(touchOfMercyProfile.bonusParEffetCible, { pct: 40, source: 'buffsEtDebuffs' }, 'Brandia : +40 % par effet, BUFFS ET DEBUFFS confondus, confirmé en données');
  const brandiaStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const brandiaSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: touchOfMercyProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  const brandiaSans = computeSkillDamage(touchOfMercyProfile, brandiaStats, brandiaSetup);
  const brandiaAvec3 = computeSkillDamage(touchOfMercyProfile, brandiaStats, {
    ...brandiaSetup,
    effetsCibleCount: { [touchOfMercyProfile.skillCom2usId]: 3 },
  });
  ok(Math.abs(brandiaAvec3 / brandiaSans - 2.2) < 1e-9, '3 effets (buffs+debuffs) : exactement +120 % (40 % × 3), soit ×2,2');

  // Brandia — SECONDE clause de « Touch of Mercy », signalée séparément par
  // l'utilisateur : « Targets that have immunity against sleep will be
  // inflicted with 50% more damage. » Aucun effet SWARFARM dédié (seuls
  // « Sleep »/« Debuff Bonus Damage » sont listés) — condition que l'app ne
  // peut pas déduire, bouton RESTREINT À CE SORT (comme Emergency Drive),
  // PAS monstre-wide : le texte ne décrit que cette attaque précise.
  egal(
    touchOfMercyProfile.bonusConditionnelPropre,
    { pct: 50, condition: 'la cible est immunisée au sommeil' },
    'Brandia : +50 % si la cible est immunisée au sommeil, confirmé par l’utilisateur'
  );
  ok(!bonusConditionnelPropreActif(touchOfMercyProfile, brandiaSetup), 'désactivé par défaut, jamais deviné actif');

  // Zaiross (« Fiery Breath ») — demande explicite : « if the enemy's Attack
  // Power is half or less than your Attack Power, ... increases the damage
  // dealt against the enemy by 50%. » Condition (ATQ adverse) que l'app ne
  // peut pas déduire — bouton RESTREINT À CE SORT, même patron que Touch of
  // Mercy/Rending Claw. La clause « critique garanti » du même texte reste
  // hors modèle (non demandée).
  const zaiross = fiche(14412);
  const fieryBreath = monsterDamageSkills(zaiross).find((s) => estPrisEnCharge(s) && s.nom === 'Fiery Breath');
  ok(fieryBreath != null && estPrisEnCharge(fieryBreath), 'Zaiross : Fiery Breath calculable');
  const fieryBreathProfile = fieryBreath as SkillDamageProfile;
  egal(
    fieryBreathProfile.bonusConditionnelPropre,
    { pct: 50, condition: "l'ATQ de la cible est ≤ la moitié de la tienne" },
    'Zaiross : +50 % si l’ATQ adverse est ≤ la moitié de la sienne'
  );
  const zairossStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const zairossSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: fieryBreathProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  ok(!bonusConditionnelPropreActif(fieryBreathProfile, zairossSetup), 'désactivé par défaut, jamais deviné actif');
  const zairossSans = computeSkillDamage(fieryBreathProfile, zairossStats, zairossSetup);
  const zairossAvec = computeSkillDamage(fieryBreathProfile, zairossStats, {
    ...zairossSetup,
    passifsOffensifs: { [fieryBreathProfile.skillCom2usId]: true },
  });
  ok(Math.abs(zairossAvec / zairossSans - 1.5) < 1e-9, 'activé : exactement ×1,5, ni plus ni moins');
  const brandiaAvecImmunite = computeSkillDamage(touchOfMercyProfile, brandiaStats, {
    ...brandiaSetup,
    passifsOffensifs: { [touchOfMercyProfile.skillCom2usId]: true },
  });
  ok(Math.abs(brandiaAvecImmunite / brandiaSans - 1.5) < 1e-9, 'activé seul (0 effet sur la cible) : exactement +50 % (×1,5)');
  // Les deux clauses se COMPOSENT (multiplicatives, comme partout ailleurs
  // dans ce fichier) : 3 effets (+120 %) ET cible immunisée (+50 %) à la
  // fois donne ×2,2 × ×1,5, pas une simple somme des pourcentages.
  const brandiaAvecLesDeux = computeSkillDamage(touchOfMercyProfile, brandiaStats, {
    ...brandiaSetup,
    effetsCibleCount: { [touchOfMercyProfile.skillCom2usId]: 3 },
    passifsOffensifs: { [touchOfMercyProfile.skillCom2usId]: true },
  });
  ok(Math.abs(brandiaAvecLesDeux / brandiaSans - 2.2 * 1.5) < 1e-9, 'les deux clauses actives ensemble : ×2,2 × ×1,5, multiplicatif pas additif');

  titre('Dégâts réels — formule bespoke selon un compteur (Crawler, Frankenstein)');

  // Crawler — « Hammer Punch » (S1), « Rage Charge (Passive) » : formule
  // exacte fournie par l'utilisateur, avec démonstration algébrique — « Si
  // Crawler subit N attaques avant de lancer son S1 (2,04×Défense/coup),
  // les dégâts par coup s'expriment ainsi : (2,04×Défense)+(N×0,20×Défense).
  // Compteur configurable de 0 à 9999. »
  const crawler = fiche(20835);
  const crawlerSkills = monsterDamageSkills(crawler);
  const hammerPunchCrawler = crawlerSkills.find((s) => estPrisEnCharge(s) && s.nom === 'Hammer Punch');
  ok(hammerPunchCrawler != null && estPrisEnCharge(hammerPunchCrawler), 'Crawler : Hammer Punch calculable');
  const hammerPunchCrawlerProfile = hammerPunchCrawler as SkillDamageProfile;
  egal(
    hammerPunchCrawlerProfile.bonusCoefficientParCompteur?.coeffParPoint,
    0.2,
    'Crawler : +0,2 × DEF par attaque reçue, confirmé par l’utilisateur'
  );
  egal(hammerPunchCrawlerProfile.bonusCoefficientParCompteur?.variable, 'DEF', 'le terme additif porte sur la DEF, même variable que la formule de base');
  const crawlerStats = stats({ atk: 2000, def: 1000, cd: 200, cr: 100 });
  const crawlerSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: hammerPunchCrawlerProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  egal(resolvedCompteurPersonnalise(hammerPunchCrawlerProfile, crawlerSetup), 0, 'sans réglage utilisateur, 0 attaque reçue — jamais deviné');
  const crawlerSansCompteur = computeSkillDamage(hammerPunchCrawlerProfile, crawlerStats, crawlerSetup);
  const crawlerAvec10 = computeSkillDamage(hammerPunchCrawlerProfile, crawlerStats, {
    ...crawlerSetup,
    compteurPersonnalise: { [hammerPunchCrawlerProfile.skillCom2usId]: 10 },
  });
  // (2,04×1000 + 10×0,2×1000) / (2,04×1000) = 4040 / 2040
  ok(Math.abs(crawlerAvec10 / crawlerSansCompteur - 4040 / 2040) < 1e-9, '10 attaques reçues : le ratio suit exactement (2,04+10×0,2)/2,04');

  // Hors plage — jamais laissé tel quel (recette écrite pour une autre
  // règle), même discipline que `resolvedStackPct`.
  egal(
    resolvedCompteurPersonnalise(hammerPunchCrawlerProfile, {
      ...crawlerSetup,
      compteurPersonnalise: { [hammerPunchCrawlerProfile.skillCom2usId]: 50000 },
    }),
    9999,
    'un compteur saisi AU-DELÀ de 9999 est borné, jamais plus'
  );

  // Frankenstein « classique » (coefficient 1,8×DEF, pas 2,04) porte le
  // MÊME passif « Rage Charge (Passive) » avec le même texte : le terme
  // additif +0,2×DEF s'applique aussi, l'utilisateur n'ayant chiffré que
  // le cas Crawler mais le mécanisme étant partagé (même nom de sort ET de
  // passif dans les données).
  const frankenstein = fiche(20805);
  const hammerPunchFrankenstein = monsterDamageSkills(frankenstein).find((s) => estPrisEnCharge(s) && s.nom === 'Hammer Punch');
  ok(hammerPunchFrankenstein != null && estPrisEnCharge(hammerPunchFrankenstein), 'Frankenstein : Hammer Punch calculable');
  egal(
    (hammerPunchFrankenstein as SkillDamageProfile).bonusCoefficientParCompteur?.coeffParPoint,
    0.2,
    'Frankenstein classique porte le même mécanisme que Crawler'
  );

  // Un sort SANS ce mécanisme (Lushen S3) n'y est jamais sensible.
  ok(!s3!.bonusCoefficientParCompteur, 'Lushen S3 ne porte pas ce mécanisme');
  egal(resolvedCompteurPersonnalise(s3!, { ...DEFAULT_DAMAGE_SETUP, compteurPersonnalise: { [s3!.skillCom2usId]: 999 } }), 999, 'le compteur se résout normalement même sans mécanisme associé (jamais utilisé dans ce cas)');

  titre('Dégâts réels — stats à privilégier dans la recherche');

  egal(damageRelevantStats(s3), ['atk', 'cd'], 'un sort ATQ fait travailler ATQ et Dgts Crit');
  egal(damageRelevantStats(profil('{ATK}*({SPD}+70)/30')), ['atk', 'spd', 'cd'], 'un sort VIT y ajoute la VIT');
  egal(damageRelevantStats(profil('0.2*{MAX HP}')), ['hp', 'cd'], 'un sort PV fait travailler les PV');
  egal(damageRelevantStats(null), ['atk', 'cd'], 'sans sort résolu, on retombe sur ATQ + Dgts Crit');
  // Le Taux Crit n'y figure JAMAIS ici (plafonné en jeu : une condition, pas
  // une cible), sauf via `bonusDegatsSelonCr` (Zenitsu/Qilin, testé plus
  // bas) où il devient directement une source de dégâts.
  ok(!damageRelevantStats(s3).includes('cr'), 'le Taux Crit n’est jamais une stat à maximiser');
  // Martial Arts Specialist (Sin)/Sickle Blade/Sand Blade/Calculated
  // Sacrifice — la DEF/les PV comptent même pour un sort dont la formule ne
  // les lit pas (`s3`, `4.2*{ATK}` seul), exactement comme `bonusDegatsSelonVit`
  // fait déjà travailler la VIT pour Sonia.
  ok(
    damageRelevantStats(s3, [], DEFAULT_DAMAGE_SETUP, false, null, null, { coeff: 0.5 }).includes('def'),
    'Martial Arts Specialist : la DEF entre dans le pré-filtrage même pour un sort qui ne la lit pas'
  );
  ok(
    damageRelevantStats(s3, [], DEFAULT_DAMAGE_SETUP, false, null, null, null, true).includes('hp'),
    'Sickle Blade/Calculated Sacrifice : les PV entrent dans le pré-filtrage même pour un sort qui ne les lit pas'
  );

  // ── BUG CORRIGÉ (revue de code externe, perf) : le mode « Non critique »
  // (`critMode: 'normal'`) annule TOUJOURS la part critique dans le calcul
  // réel (`partCrit` vaut 0, voir `computeSkillDamageDetail`) — Dégâts Crit
  // ne devrait donc PLUS être retenu au pré-filtrage dans ce mode, sauf
  // `critSiPlusRapide` qui force un critique garanti et passe outre. ──
  ok(
    !damageRelevantStats(s3, [], { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' }).includes('cd'),
    "« Non critique » : Dégâts Crit ne pèse plus sur aucun dégât, donc plus retenu au pré-filtrage"
  );
  ok(
    damageRelevantStats(s3, [], { ...DEFAULT_DAMAGE_SETUP, critMode: 'moyenne' }).includes('cd'),
    '« Moyenne » (espérance) : Dégâts Crit compte toujours, contrairement à « Non critique »'
  );
  ok(
    damageRelevantStats(s3, [], { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' }, true).includes('cd'),
    "critSiPlusRapide force un critique garanti — Dégâts Crit reste retenu MÊME en « Non critique »"
  );
  // ⚠️⚠️ **ET UN PASSIF `'toujours'` AUSSI** (Hidden Gun, Meticulous Attack) :
  // `computeTotalDamage` lui impose `critMode: 'crit'` pour sa propre
  // contribution, quel que soit le mode choisi. La garde n'exceptait d'abord
  // que `critSiPlusRapide` et retirait donc les Dgts Crit à un monstre dont un
  // composant crit pourtant à coup sûr — le remède pire que le mal.
  {
    // ⚠️ `categorie` est OBLIGATOIRE : `passifActif` la lit d'abord. Un faux
    // passif sans elle plante avant d'atteindre ce qu'on veut vérifier.
    // `type: 'bonus'` = toujours actif, comme Hidden Gun.
    const toujours: PassifOffensifProfile = {
      nom: 'Coup garanti',
      profile: profil('1.0*{ATK}'),
      critique: 'toujours',
      categorie: { type: 'bonus', pct: 100, condition: 'test' },
    } as unknown as PassifOffensifProfile;
    const jamais: PassifOffensifProfile = { ...toujours, nom: 'Sans crit', critique: 'jamais' };
    ok(
      damageRelevantStats(s3, [toujours], { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' }).includes('cd'),
      "un passif `'toujours'` crit quoi qu'il arrive — Dégâts Crit reste retenu en « Non critique »"
    );
    // Le contrôle qui empêche le test de passer pour de mauvaises raisons.
    ok(
      !damageRelevantStats(s3, [jamais], { ...DEFAULT_DAMAGE_SETUP, critMode: 'normal' }).includes('cd'),
      "un passif qui ne crit jamais ne rattrape rien — Dégâts Crit reste écarté"
    );
  }

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

  // Dominic — « Improvisation (Passive) » : `bonus` avec `dejaInclus: true`
  // (demande explicite de l'utilisateur : un bouton, comme Hidden Gun/Ezio).
  // La formule `(Fixed)` porte le cas MAJORÉ (`2.0*{ATK}` = 100 % de base ×
  // (1 + 100 % si PV > 50 %)) — décoché (par défaut), la contribution est
  // DIVISÉE par 2 pour retomber au cas de base, jamais multipliée.
  const dominic = fiche(25713);
  const dominicBase = defaultDamageSkill(monsterDamageSkills(dominic));
  ok(dominicBase !== null, 'Dominic : un sort de dégâts par défaut est trouvé');
  const dominicPassifs = monsterOffensivePassives(dominic);
  egal(dominicPassifs.length, 1, 'Dominic : un seul passif reconnu (Improvisation)');
  const dominicCat = dominicPassifs[0]!.categorie;
  egal(dominicCat.type, 'bonus', 'Improvisation est un « bonus » à bouton, plus « toujours »');
  ok(dominicCat.type === 'bonus' && dominicCat.dejaInclus === true, 'dejaInclus : la formule (Fixed) porte déjà le cas majoré');
  ok(dominicPassifs[0]!.profile.fixed, 'sa formule porte (Fixed) : ni critique ni facteur de défense');
  const dominicStats = stats({ atk: 2000, cd: 200, cr: 100, hp: 20000 });
  const dominicSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: dominicBase!.skillCom2usId,
    summonerSkills: 'aucune',
  };
  const dominicSort = computeSkillDamage(dominicBase!, dominicStats, dominicSetup, null);
  const dominicPassifMajore = computeSkillDamage(dominicPassifs[0]!.profile, dominicStats, dominicSetup, null);
  egal(
    computeTotalDamage(
      dominicBase!,
      dominicPassifs,
      dominicStats,
      { ...dominicSetup, passifsOffensifs: { [dominicPassifs[0]!.skillCom2usId]: true } },
      null
    ),
    dominicSort + dominicPassifMajore,
    'bouton coché : la contribution du passif est le cas MAJORÉ tel que parsé (2.0 × ATQ)'
  );
  ok(
    Math.abs(
      computeTotalDamage(dominicBase!, dominicPassifs, dominicStats, dominicSetup, null) -
        (dominicSort + dominicPassifMajore / 2)
    ) < 1e-9,
    'bouton décoché (par défaut) : la contribution est DIVISÉE par 2, retombant au cas de base (1.0 × ATQ)'
  );
  // Question directe de l'utilisateur : les dégâts de ce passif (`(Fixed)`)
  // sont-ils bien insensibles à la DEF adverse ? Oui — et PLUS FORT qu'un
  // simple `ignoreDef` : `mitigation = profile.fixed ? 1 : defenseFactor(…)`
  // saute ENTIÈREMENT le facteur de défense (aucune réduction, même pas le
  // plancher `defenseFactor(0) ≈ 0,877` qu'`ignoreDef` laisserait subsister).
  ok(dominicPassifs[0]!.profile.ignoreDef === false, 'le passif ne porte PAS le marqueur ignoreDef — sa neutralité à la DEF vient de `fixed`, un mécanisme différent');
  const dominicDefNulle = computeSkillDamage(dominicPassifs[0]!.profile, dominicStats, { ...dominicSetup, enemyDef: 0 });
  const dominicDefEnorme = computeSkillDamage(dominicPassifs[0]!.profile, dominicStats, { ...dominicSetup, enemyDef: 999999 });
  egal(dominicDefNulle, dominicDefEnorme, 'la DEF adverse (0 à 999999) ne change RIEN au passif (Fixed) — le facteur de défense est sauté, pas juste plafonné à 0');

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

  // ── BUG CORRIGÉ (revue de code externe) : le chemin SÉQUENTIEL ajoutait
  // `ajoutUneFois` (Sickle Blade/Sand Blade, Calculated Sacrifice — un
  // modificateur monstre-wide UNE FOIS par sort) au `.total` retourné, mais
  // JAMAIS au `pvCourant` utilisé pour calculer `pvRestantsPct` — contraire
  // au chemin COURT, qui les créuse ensemble. `pvRestantsPct` restait donc
  // SURESTIMÉ dès qu'un sort au chemin séquentiel portait aussi un
  // `ajoutUneFois`, faussant tout seuil de passif suivant basé sur les PV
  // restants (Final Strike/Benedict). ──
  const wStatsAvecHp = stats({ atk: 2000, cd: 200, cr: 100, hp: 10000 });
  const sansAjoutUneFois = computeSkillDamageDetail(weakness, wStatsAvecHp, wSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
  const avecAjoutUneFois = computeSkillDamageDetail(weakness, wStatsAvecHp, wSetup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {
    bonusFixeMaxHpPropre: { pct: 50 },
  });
  ok(
    avecAjoutUneFois.total > sansAjoutUneFois.total,
    "l'ajout ponctuel (bonusFixeMaxHpPropre) augmente bien les dégâts totaux"
  );
  ok(
    avecAjoutUneFois.pvRestantsPct < sansAjoutUneFois.pvRestantsPct,
    'et les PV restants reflètent cet ajout — pas seulement les dégâts par coup (chemin séquentiel)'
  );

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

  titre('Dégâts réels — catalogue « passifs non implémentés », points 26 à 43');

  // Bonus conditionnel à bouton — six entrées de plus dans la même famille
  // que le premier lot (Jin Kazama…) : condition non déductible, +X % au
  // TOTAL, désactivé par défaut. Deux (Idunn's Heart/Innate Physical) sont
  // en réalité un TROU du lot précédent (réponses déjà données, jamais
  // câblées) plutôt qu'une nouveauté de ce lot.
  const conditionnelSuite: [number, string, number][] = [
    [27712, "Idunn's Heart (Passive)", 100], // Eivor (Feu)
    [28212, 'Innate Physical (Passive)', 100], // Solveig
    [30712, 'Path of the Brave Warrior (Passive)', 200], // Deragron
    [22011, 'Female Warrior (Passive)', 20], // Sabrina
    [26511, 'Cold Brew (Passive)', 200], // Espresso Cookie (Eau)
    [27011, 'Iced Tea (Passive)', 200], // Rosemary
  ];
  for (const [id, nom, pct] of conditionnelSuite) {
    const p = monsterBonusDegatsConditionnel(fiche(id));
    egal(p?.nom, nom, `${id} : nom exact du passif détecté`);
    egal(p?.pct, pct, `${id} (${nom}) : pourcentage confirmé`);
  }
  // ⚠️ Female Warrior : la réponse de l'utilisateur (« jusqu'à 200 % ») ne
  // correspond PAS aux données réelles (`quantite: 20`, texte fixe) — très
  // probablement une confusion avec Cold Brew/Iced Tea juste en dessous,
  // répondues dans le même message. Les données réelles ont prévalu.
  egal(monsterBonusDegatsConditionnel(fiche(22011))?.pct, 20, 'Female Warrior : 20 %, PAS 200 % — les données SWARFARM prévalent sur une réponse en aparté imprécise');

  // Internal Force (Paladin/Leona) — PAS un `BONUS_DEGATS_CONDITIONNEL_CONNUS`
  // malgré la demande initiale d'un « toggle » : il a sa PROPRE formule dans
  // les données SWARFARM (`2.0*{DEF}`) — un `PASSIFS_OFFENSIFS_CONNUS`
  // `conditionnel` (bouton, compte à 100 % activé), la même catégorie que
  // Roid/Ruins, jamais un pourcentage du TOTAL.
  const leona = fiche(21815);
  const internalForcePassif = monsterOffensivePassives(leona).find((p) => p.nom === 'Internal Force (Passive)');
  ok(internalForcePassif != null, 'Leona : Internal Force reconnu comme passif offensif');
  egal(internalForcePassif?.categorie, { type: 'conditionnel', condition: 'tu as un Bouclier actif' }, 'Internal Force : catégorie conditionnel, formule propre');
  egal(internalForcePassif?.profile.formule, '2.0*{DEF}', 'Internal Force : le Bouclier vaut 2×DEF');
  ok(!passifActif(internalForcePassif!, { ...DEFAULT_DAMAGE_SETUP }), 'désactivé par défaut, jamais deviné actif');
  ok(
    passifActif(internalForcePassif!, { ...DEFAULT_DAMAGE_SETUP, passifsOffensifs: { [internalForcePassif!.skillCom2usId]: true } }),
    'activé une fois le bouton coché'
  );

  // Comeuppance (Onmyouji/Giou) — D'ABORD exclu à tort de
  // `PASSIFS_OFFENSIFS_CONNUS` (sa formule, `0.2*{Target MAX HP}`, ne
  // dépend QUE de la cible) par analogie avec `skillDamageProfile`, qui
  // rejette un sort ACTIF stat-indépendant — mais RECONSIDÉRÉ après un
  // signalement de l'utilisateur (capture du bestiaire confirmant le
  // ratio) : `skillDamageProfile` rejette parce qu'un sort stat-indépendant
  // est INUTILE comme référence de classement des builds, une raison qui
  // ne s'applique PAS à `monsterOffensivePassives` (sommer une contribution
  // RÉELLE au total affiché, jamais utilisée pour classer). Le filtre
  // correspondant a été retiré dans `monsterOffensivePassives`.
  const giou = fiche(25013);
  const comeuppancePassif = monsterOffensivePassives(giou).find((p) => p.nom === 'Comeuppance (Passive)');
  ok(comeuppancePassif != null, 'Giou : Comeuppance reconnu comme passif offensif');
  egal(comeuppancePassif?.profile.formule, '0.2*{Target MAX HP}', 'Comeuppance : 20 % des PV max de la cible');
  egal(comeuppancePassif?.critique, 'jamais', 'Comeuppance ne critique jamais, confirmé par l’utilisateur');
  egal(comeuppancePassif?.categorie.type, 'conditionnel', 'Comeuppance : catégorie conditionnel, comme Internal Force');
  ok(!passifActif(comeuppancePassif!, { ...DEFAULT_DAMAGE_SETUP }), 'désactivé par défaut, jamais deviné actif');
  ok(
    passifActif(comeuppancePassif!, { ...DEFAULT_DAMAGE_SETUP, passifsOffensifs: { [comeuppancePassif!.skillCom2usId]: true } }),
    'activé une fois le bouton coché'
  );
  const giouBase = defaultDamageSkill(monsterDamageSkills(giou));
  ok(giouBase !== null, 'Giou : un sort de dégâts par défaut est trouvé');
  const giouStats = stats({ atk: 2000, def: 900, cd: 200, cr: 100 });
  const giouSetupOff: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: giouBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
    enemyHp: 40000,
    enemyDef: 1000,
  };
  const giouTotalOff = computeTotalDamage(giouBase!, [comeuppancePassif!], giouStats, giouSetupOff);
  const giouTotalOn = computeTotalDamage(giouBase!, [comeuppancePassif!], giouStats, {
    ...giouSetupOff,
    passifsOffensifs: { [comeuppancePassif!.skillCom2usId]: true },
  });
  const attendue = 0.2 * 40000 * defenseFactor(1000);
  ok(
    Math.abs(giouTotalOn - giouTotalOff - attendue) < 1e-6,
    'Comeuppance activé : contribution exacte 0,2 × PV max cible × facteur de défense (jamais de critique)'
  );

  // Bonus accumulable — quatre entrées de plus dans la même famille que Momo
  // (stack SAISI, jamais un état simulé), mêmes deux mécanismes distincts
  // déjà rencontrés : « PV détruits sur la cible » (Borgnine/Moogwang) et
  // « PV perdus soi-même » (Trevor), tous deux réutilisant le stepper de
  // stack sans code nouveau.
  const stackSuite: [number, string, number, number][] = [
    [26011, 'Sleep Talk (Passive)', 1, 200], // Birman
    [24711, 'Destroyer of Battlefield (Passive)', 0.5, 30], // Borgnine
    [28912, 'Fire Bead (Passive)', 1, 60], // Moogwang
    [20012, "Brawler's Will (Passive)", 2, 200], // Trevor
  ];
  for (const [id, nom, ratio, pctMax] of stackSuite) {
    const p = monsterBonusDegatsStackable(fiche(id));
    egal(p?.nom, nom, `${id} : nom exact du passif accumulable détecté`);
    egal(p?.ratio, ratio, `${id} (${nom}) : ratio dégâts/déclencheur confirmé`);
    egal(p?.pctMax, pctMax, `${id} (${nom}) : plafond de DÉGÂTS confirmé`);
  }

  // ⚠️ Signalé par l'utilisateur (DEUXIÈME incohérence, après le texte) :
  // le DÉCLENCHEUR (ce que l'utilisateur saisit) et le BONUS DE DÉGÂTS qui
  // en résulte sont deux plages DIFFÉRENTES, jamais confondues. Borgnine :
  // 0 à 60 % de PV cible détruits (pas de 1 %), dégâts 0 à 30 % (pas de
  // 0,5 %). Trevor : PV perdus CAPÉS à 100 % (pas 200), dégâts jusqu'à
  // 200 %.
  const stackBorgnine = monsterBonusDegatsStackable(fiche(24711))!;
  egal(stackBorgnine.triggerMax, 60, 'Borgnine : le DÉCLENCHEUR (PV cible détruits) va jusqu’à 60 %, pas 30');
  egal(stackBorgnine.triggerStep, 1, 'Borgnine : pas de 1 % sur le déclencheur');
  egal(stackBorgnine.ratio, 0.5, 'Borgnine : 60 % de déclencheur × 0,5 = 30 % de dégâts (le plafond)');
  const stackTrevor = monsterBonusDegatsStackable(fiche(20012))!;
  egal(stackTrevor.triggerMax, 100, 'Trevor : le DÉCLENCHEUR (PV perdus) est CAPÉ à 100 %, pas 200');
  egal(stackTrevor.ratio, 2, 'Trevor : 100 % de déclencheur × 2 = 200 % de dégâts (le plafond)');
  egal(stackTrevor.pctMax, 200, 'Trevor : les DÉGÂTS, eux, vont bien jusqu’à 200 %');
  const stackLudo = monsterBonusDegatsStackable(fiche(21312))!;
  egal(stackLudo.triggerMax, 6, 'Ludo : le dé va de 1 à 6 (confirmé par l’utilisateur), pas un pourcentage');
  egal(stackLudo.pctMax, 100, 'Ludo : les dégâts vont de 0 à 100 %, confirmé par l’utilisateur');
  // ⚠️ Un dé ne tombe JAMAIS sur 0 — signalé par l'utilisateur : le
  // résultat 1 (le VRAI minimum du dé) doit donner 0 % de bonus, pas
  // 20 %. `offset: 1` décale la pente ; 0 (rien saisi) et 1 (le minimum
  // réel) donnent tous les deux 0 %, jamais négatif.
  egal(stackLudo.offset, 1, 'Ludo : offset de 1, seule entrée de la table à en porter un');
  const ludoSetupSansOffset: DamageSetup = { ...DEFAULT_DAMAGE_SETUP };
  egal(resolvedStackPct(stackLudo, { ...ludoSetupSansOffset, stackPersonnalise: { [stackLudo.skillCom2usId]: 0 } }), 0, 'Ludo : 0 (rien saisi) → 0 % de dégâts');
  egal(resolvedStackPct(stackLudo, { ...ludoSetupSansOffset, stackPersonnalise: { [stackLudo.skillCom2usId]: 1 } }), 0, 'Ludo : résultat 1 (minimum réel du dé) → 0 % de dégâts, PAS 20 %');
  egal(resolvedStackPct(stackLudo, { ...ludoSetupSansOffset, stackPersonnalise: { [stackLudo.skillCom2usId]: 2 } }), 20, 'Ludo : résultat 2 → 20 % de dégâts');
  egal(resolvedStackPct(stackLudo, { ...ludoSetupSansOffset, stackPersonnalise: { [stackLudo.skillCom2usId]: 6 } }), 100, 'Ludo : résultat 6 (maximum) → 100 % de dégâts (le plafond)');

  // Profondeur numérique sur Borgnine : 40 % de PV détruits (déclencheur)
  // doit donner exactement 20 % de dégâts (40 × 0,5), PAS 40 % — la
  // confusion exacte signalée par l'utilisateur.
  const borgnine = fiche(24711);
  const borgnineBase = defaultDamageSkill(monsterDamageSkills(borgnine));
  ok(borgnineBase !== null, 'Borgnine : un sort de dégâts par défaut est trouvé');
  const borgnineStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const borgnineSetup: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: borgnineBase!.skillCom2usId,
    summonerSkills: 'aucune',
    critMode: 'normal',
    stackPersonnalise: { [stackBorgnine.skillCom2usId]: 40 },
  };
  egal(resolvedStackTrigger(stackBorgnine, borgnineSetup), 40, 'Borgnine : le déclencheur saisi (40 % de PV détruits) est repris tel quel');
  egal(resolvedStackPct(stackBorgnine, borgnineSetup), 20, 'Borgnine : 40 % × 0,5 = 20 % de dégâts, JAMAIS 40 % (l’ancienne confusion)');
  const borgnineSans = computeSkillDamage(borgnineBase!, borgnineStats, { ...borgnineSetup, stackPersonnalise: {} });
  const borgnineAvec = computeTotalDamage(borgnineBase!, [], borgnineStats, borgnineSetup, null, ARTIFACT_DAMAGE_NEUTRE, false, null, stackBorgnine);
  ok(Math.abs(borgnineAvec / borgnineSans - 1.2) < 1e-9, 'Borgnine : 40 % de PV détruits → exactement +20 % de dégâts (×1,2)');

  // ⚠️ Signalé par l'utilisateur (PREMIÈRE incohérence, sur le texte) : le
  // champ de saisie de Trevor affichait « Stack actuel » avec une infobulle
  // écrite pour Momo (« nombre d'attaques alliées ») — incohérent, Trevor
  // compte ses PROPRES PV perdus, pas des attaques. Chaque entrée porte
  // désormais son propre `label`/`aide` — vérifié qu'ils sont bien
  // DISTINCTS entre deux mécanismes différents (Momo vs Trevor), pas un
  // texte générique partagé.
  const stackMomoLabels = monsterBonusDegatsStackable(momo)!;
  ok(stackMomoLabels.label !== stackTrevor.label, 'Momo et Trevor ont des libellés de champ DIFFÉRENTS');
  ok(stackMomoLabels.aide !== stackTrevor.aide, 'Momo et Trevor ont des infobulles DIFFÉRENTES');
  egal(stackTrevor.label, 'PV perdus', 'Trevor : le champ parle de PV perdus, pas de « stack »');
  ok(!/attaque/i.test(stackTrevor.aide), "Trevor : l'infobulle ne mentionne PAS les attaques alliées (texte de Momo)");
  egal(stackMomoLabels.label, 'Attaques alliées', 'Momo : le champ garde son texte d’origine, inchangé');
  // Absorb Shadow (Martina) — deuxième correction signalée : « ce n'est pas
  // un vol de PV mais un vol de buff » (confirmé par l'effet SWARFARM
  // « Steal Buff », voir plus haut).
  const stackMartina = monsterBonusDegatsStackable(fiche(22015))!;
  egal(stackMartina.label, 'Buffs volés', 'Martina : « vol de buff », PAS « vol de PV » (corrigé)');
  ok(!/PV/i.test(stackMartina.label) && !/PV/.test(stackMartina.aide), "Martina : ni le libellé ni l'infobulle ne mentionnent des PV");
  // Borgnine et Moogwang (« PV cible détruits ») partagent le MÊME libellé
  // entre eux (même nature de compteur), mais restent DIFFÉRENTS de Trevor
  // (PV PROPRES, pas ceux de la cible).
  const stackMoogwang = monsterBonusDegatsStackable(fiche(28912))!;
  egal(stackBorgnine.label, stackMoogwang.label, 'Borgnine et Moogwang : même nature de compteur (PV cible détruits), même libellé');
  ok(stackBorgnine.label !== stackTrevor.label, 'Borgnine (cible) et Trevor (soi-même) restent distincts');

  titre('Dégâts réels — modificateurs MONSTRE-WIDE additifs (Spear of Tenacity, Martial Arts Specialist, Sickle Blade/Sand Blade, Calculated Sacrifice)');

  // Profil SYNTHÉTIQUE NEUTRE (`1*{ATK} (Fixed)`) : `(Fixed)` élimine le
  // critique ET la mitigation de Défense (`critTerm=mitigation=1`), aucune
  // réduction active (`reductions=1`) — `horsCoup` vaut alors EXACTEMENT 1,
  // donc `sans.total = ATK × coups` pile, sans avoir à connaître le
  // coefficient ni la Défense adverse. Isole ainsi CHAQUE ajout monstre-wide
  // à l'état pur, sans bruit d'un vrai sort du corpus.
  const competenceNeutre: Competence = {
    id: 1,
    com2usId: 900001,
    nom: 'Test neutre',
    description: null,
    slot: 1,
    passif: false,
    aoe: false,
    cooldown: null,
    coups: 1,
    niveauMax: 1,
    formule: '1*{ATK} (Fixed)',
    scale: ['ATK'],
    ameliorations: [],
    icone: null,
    effets: [],
  };
  const neutre = skillDamageProfile(competenceNeutre) as SkillDamageProfile;
  ok(neutre != null && 'noeud' in neutre, 'profil neutre : calculable');
  const setupNeutre: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal' };

  // Spear of Tenacity (Pholus) — `pct/100 × {Target MAX HP}` ajouté au
  // multiplicateur, toujours actif, soumis au critique/à la défense comme
  // le reste (même traitement qu'`ajoutCompteur`/Crawler, mais MONSTRE-WIDE).
  egal(monsterBonusFixeCiblePvMax(fiche(34113)), { pct: 2 }, 'Pholus : Spear of Tenacity, +2 % des PV max de la cible');
  ok(!monsterBonusFixeCiblePvMax(fiche(LUSHEN)), 'Lushen ne porte pas ce mécanisme');
  {
    const setup: DamageSetup = { ...setupNeutre, enemyHp: 40000 };
    const st = stats({ atk: 2000 });
    const sans = computeSkillDamageDetail(neutre, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
    const avec = computeSkillDamageDetail(neutre, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, { bonusFixeCiblePvMax: { pct: 2 } });
    egal(sans.total, 2000, 'profil neutre : sans ajout, exactement ATK (coefficient 1, 1 coup)');
    // ajout = 2 % × 40000 = 800.
    egal(avec.total, 2800, 'Pholus : +2 % des PV max de la cible (800) ajoutés au multiplicateur');
  }

  // Martial Arts Specialist (Sin) — `coeff × max(0, DEF_propre − DEF_cible)`,
  // toujours actif, à CHAQUE coup, jamais négatif.
  egal(monsterBonusEcartDef(fiche(20212)), { coeff: 0.5 }, 'Sin : Martial Arts Specialist, 50 % de l’écart de DEF');
  ok(!monsterBonusEcartDef(fiche(LUSHEN)), 'Lushen ne porte pas ce mécanisme');
  {
    const setup: DamageSetup = { ...setupNeutre, enemyDef: 400 };
    const st = stats({ atk: 2000, def: 1000 });
    const avec = computeSkillDamageDetail(neutre, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, { bonusEcartDef: { coeff: 0.5 } });
    // ajout = 0,5 × (1000 − 400) = 300.
    egal(avec.total, 2300, 'Sin : +300 (50 % de l’écart de DEF, 1000 − 400) ajoutés au multiplicateur');
    // Écart de DEF nul ou négatif (DEF cible plus haute) : aucun bonus.
    const setupInverse: DamageSetup = { ...setup, enemyDef: 5000 };
    const avecInverse = computeSkillDamageDetail(neutre, st, setupInverse, null, undefined, ARTIFACT_DAMAGE_NEUTRE, { bonusEcartDef: { coeff: 0.5 } });
    egal(avecInverse.total, 2000, 'DEF cible plus haute que la sienne : aucun bonus, jamais une pénalité (max(0, …))');
  }

  // Sickle Blade (Bayek Vent)/Sand Blade (Desert Warrior Vent, Shahat) —
  // `pct/100 × {MAX HP}` propre, dégâts BRUTS (ni critiques, ni mitigés par
  // la défense) infligés À CHAQUE COUP.
  //
  // ⚠️ Ces tests affirmaient l'inverse (« une seule fois par sort »), sur la
  // foi d'une confirmation qui était une ERREUR. Levée par un relevé EN JEU :
  // Shahat ~50 000 PV, S2 sur une cible à ~3 000 DEF → ~4 500 par coup,
  // contre 770 à 1 760 que donnait l'ancien calcul. Voir
  // spec/outils/degats-reels.md, « Corrections identifiées ».
  egal(monsterBonusFixeMaxHpPropre(fiche(27513)), { pct: 7 }, 'Bayek (Vent) : Sickle Blade, +7 % de ses PV max');
  egal(monsterBonusFixeMaxHpPropre(fiche(28013)), { pct: 7 }, 'Shahat : Sand Blade, même mécanisme, nom différent');
  ok(!monsterBonusFixeMaxHpPropre(fiche(LUSHEN)), 'Lushen ne porte pas ce mécanisme');
  {
    // 3 coups : seul moyen de vérifier « par coup, pas une fois ».
    const profilTroisCoups: SkillDamageProfile = { ...neutre, hits: 3 };
    const st = stats({ hp: 30000, atk: 2000 });
    const sans = computeSkillDamageDetail(profilTroisCoups, st, setupNeutre, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
    const avec = computeSkillDamageDetail(profilTroisCoups, st, setupNeutre, null, undefined, ARTIFACT_DAMAGE_NEUTRE, { bonusFixeMaxHpPropre: { pct: 7 } });
    egal(sans.total, 6000, 'profil neutre à 3 coups : ATK × 3, sans ajout');
    // ajout = 7 % × 30000 = 2100, à CHACUN des 3 coups → 6300.
    egal(avec.total, 12300, 'Sickle Blade : +7 % des PV max PROPRES, à CHAQUE coup (2100 × 3)');
  }
  {
    // ⚠️ **L'AUTRE axe du correctif**, qu'aucun test ne couvrait : le terme
    // est BRUT. Impossible à voir avec `neutre`, dont la formule porte
    // `(Fixed)` — `horsCoup` y vaut 1, un terme mitigé y serait donc
    // indiscernable d'un terme brut. Il faut un sort ORDINAIRE, une cible qui
    // a de la défense, et le critique forcé.
    const competenceMitigee: Competence = { ...competenceNeutre, com2usId: 900002, formule: '1*{ATK}' };
    const mitige = skillDamageProfile(competenceMitigee) as SkillDamageProfile;
    const setup: DamageSetup = { ...setupNeutre, critMode: 'crit', enemyDef: 1000 };
    const st = stats({ hp: 30000, atk: 2000 });
    const sans = computeSkillDamageDetail(mitige, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
    const avec = computeSkillDamageDetail(mitige, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, { bonusFixeMaxHpPropre: { pct: 7 } });
    ok(Math.abs(sans.total - 2000) > 1, 'garde-fou : la part du SORT est bien critée et mitigée ici (sinon le test ne prouverait rien)');
    egal(
      Math.round(avec.total - sans.total),
      2100,
      'Sickle Blade : exactement 7 % × 30000, ni multiplié par le critique, ni réduit par les 1000 de DEF'
    );
  }

  // Calculated Sacrifice (Onimusha, Fuuki) — dégâts bruts dérivés d'une
  // saisie manuelle (« PV actuels avant le sacrifice de ce tour », défaut
  // 100 % = premier tour), À CHAQUE COUP comme Sickle Blade. ⚠️ Même
  // correction que ci-dessus, et c'est délibérément le MÊME accumulateur :
  // les deux familles ont exactement le même comportement.
  const fuuki = fiche(25113);
  const sacrificeProfile = monsterBonusSacrifice(fuuki);
  ok(sacrificeProfile != null, 'Fuuki : Calculated Sacrifice détecté');
  egal(sacrificeProfile, { ...sacrificeProfile!, pctPerte: 20, pctSurPerte: 15 }, 'Fuuki : 20 % de PV perdus/tour, +15 % de la perte en dégâts');
  ok(!monsterBonusSacrifice(fiche(LUSHEN)), 'Lushen ne porte pas ce mécanisme');
  egal(resolvedPvActuelsAvantSacrificePctMonstre(sacrificeProfile!.skillCom2usId, DEFAULT_DAMAGE_SETUP), 100, 'sans réglage utilisateur, 100 % (premier tour) — SEULE exception « défaut non nul » de ce fichier');
  {
    const profilTroisCoups: SkillDamageProfile = { ...neutre, hits: 3 };
    const st = stats({ hp: 30000, atk: 2000 });
    const avecDefaut = computeSkillDamageDetail(profilTroisCoups, st, setupNeutre, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {
      bonusSacrifice: { skillCom2usId: sacrificeProfile!.skillCom2usId, pctPerte: 20, pctSurPerte: 15 },
    });
    // 100 % PV actuels (défaut) : perte = 20 % × 30000 = 6000, ajout = 15 % × 6000 = 900, à CHACUN des 3 coups.
    egal(avecDefaut.total, 8700, 'PV actuels 100 % (défaut) : ajout = 15 % × (20 % × 30000) = 900, à chaque coup (× 3)');
    const avecMoitie = computeSkillDamageDetail(
      profilTroisCoups,
      st,
      { ...setupNeutre, pvActuelsAvantSacrificePct: { [sacrificeProfile!.skillCom2usId]: 50 } },
      null,
      undefined,
      ARTIFACT_DAMAGE_NEUTRE,
      { bonusSacrifice: { skillCom2usId: sacrificeProfile!.skillCom2usId, pctPerte: 20, pctSurPerte: 15 } }
    );
    // 50 % PV actuels : perte = 20 % × 15000 = 3000, ajout = 15 % × 3000 = 450 par coup — exactement la moitié.
    egal(avecMoitie.total, 7350, 'PV actuels à 50 % : ajout divisé par deux, linéaire (450 × 3)');
  }

  titre('Dégâts réels — modificateurs MONSTRE-WIDE selon un compte d’effets (Backup Code, Blessing of Curse)');

  // Backup Code (Hacker/570RM) — même mécanisme que Julie/Melissa/Brandia,
  // mais MONSTRE-WIDE (majore le sort choisi quel qu'il soit, pas un sort
  // précis) : `quantite: 20` confirmé en données, DÉBUFFS seuls sur la
  // CIBLE — premier cas « débuffs seuls » de tout ce fichier.
  const rm570 = fiche(30013);
  const backupCode = monsterBonusParEffetCible(rm570);
  egal(backupCode, { ...backupCode!, pct: 20, source: 'debuffs' }, '570RM : Backup Code, +20 % par débuff sur la cible');
  ok(!monsterBonusParEffetCible(fiche(LUSHEN)), 'Lushen ne porte pas ce mécanisme');
  {
    const setup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal' };
    const st = stats({ atk: 2000 });
    const sans = computeSkillDamageDetail(s3!, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
    const avec2 = computeSkillDamageDetail(
      s3!,
      st,
      { ...setup, effetsCibleCount: { [backupCode!.skillCom2usId]: 2 } },
      null,
      undefined,
      ARTIFACT_DAMAGE_NEUTRE,
      { bonusParEffetCible: { skillCom2usId: backupCode!.skillCom2usId, pct: 20, source: 'debuffs' } }
    );
    ok(Math.abs(avec2.total / sans.total - 1.4) < 1e-9, '2 débuffs sur la cible : exactement +40 % (20 % × 2)');
  }

  // Blessing of Curse (Devil Maiden/Jessica) — même famille, mais sur SOI
  // (`effetsPropresCount`, stockage séparé) : `quantite: 20` confirmé.
  const jessica = fiche(28614);
  const blessingOfCurse = monsterBonusParEffetPropre(jessica);
  egal(blessingOfCurse, { ...blessingOfCurse!, pct: 20 }, 'Jessica : Blessing of Curse, +20 % par débuff sur SOI');
  ok(!monsterBonusParEffetPropre(fiche(LUSHEN)), 'Lushen ne porte pas ce mécanisme');
  egal(resolvedEffetsPropresCount(blessingOfCurse!.skillCom2usId, DEFAULT_DAMAGE_SETUP), 0, 'sans réglage utilisateur, 0 débuff — jamais deviné');
  {
    const setup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune', critMode: 'normal' };
    const st = stats({ atk: 2000 });
    const sans = computeSkillDamageDetail(s3!, st, setup, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {});
    const avec3 = computeSkillDamageDetail(
      s3!,
      st,
      { ...setup, effetsPropresCount: { [blessingOfCurse!.skillCom2usId]: 3 } },
      null,
      undefined,
      ARTIFACT_DAMAGE_NEUTRE,
      { bonusParEffetPropre: { skillCom2usId: blessingOfCurse!.skillCom2usId, pct: 20 } }
    );
    ok(Math.abs(avec3.total / sans.total - 1.6) < 1e-9, '3 débuffs sur soi : exactement +60 % (20 % × 3)');
  }

  titre('Dégâts réels — bouton RESTREINT À UN SORT (Emergency Drive, Cynthia)');

  // Emergency Drive (Cynthia/Arcane Weapon) — contrairement à
  // `BONUS_DEGATS_CONDITIONNEL_CONNUS` (majore le TOTAL quel que soit le
  // sort), ce bouton ne majore QUE « Rending Claw » (le sort forcé pendant
  // le Mechanical Frame State) — `SkillDamageProfile.bonusConditionnelPropre`.
  const cynthia = fiche(34012);
  const cynthiaSkills = monsterDamageSkills(cynthia);
  const rendingClaw = cynthiaSkills.find((s) => estPrisEnCharge(s) && s.nom === 'Rending Claw');
  ok(rendingClaw != null && estPrisEnCharge(rendingClaw), 'Cynthia : Rending Claw calculable');
  const rendingClawProfile = rendingClaw as SkillDamageProfile;
  egal(
    rendingClawProfile.bonusConditionnelPropre,
    { pct: 50, condition: 'tu es en Mechanical Frame State (Emergency Drive)' },
    'Rending Claw : +50 % en Mechanical Frame State, confirmé en données'
  );
  const mechanicalFist = cynthiaSkills.find((s) => estPrisEnCharge(s) && s.nom === 'Mechanical Fist');
  ok(mechanicalFist != null && estPrisEnCharge(mechanicalFist), 'Cynthia : Mechanical Fist (S1) calculable');
  ok(!(mechanicalFist as SkillDamageProfile).bonusConditionnelPropre, 'Mechanical Fist (S1) NE porte PAS ce bonus — restreint à Rending Claw seul');
  const cynthiaStats = stats({ atk: 2000, cd: 200, cr: 100 });
  const cynthiaSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: rendingClawProfile.skillCom2usId, summonerSkills: 'aucune', critMode: 'normal' };
  ok(!bonusConditionnelPropreActif(rendingClawProfile, cynthiaSetup), 'désactivé par défaut, jamais deviné actif');
  const cynthiaSans = computeSkillDamage(rendingClawProfile, cynthiaStats, cynthiaSetup);
  const cynthiaAvec = computeSkillDamage(rendingClawProfile, cynthiaStats, {
    ...cynthiaSetup,
    passifsOffensifs: { [rendingClawProfile.skillCom2usId]: true },
  });
  ok(Math.abs(cynthiaAvec / cynthiaSans - 1.5) < 1e-9, 'activé : exactement +50 % (×1,5)');

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
  egal(objectiveKeysOf('ehp', ['spd']), ['spd'], "l'override remplace la table, il ne s'y ajoute pas");
  egal(objectiveKeysOf(undefined, undefined), [], 'aucun objectif, aucun override → aucun biais');
  // ⚠️ Un override VIDE doit rester un override (« ce sort ne privilégie
  // rien »), pas retomber sur la table — un `??`/`||` mal placé confondrait
  // les deux, sans que rien ne le signale.
  egal(objectiveKeysOf('ehp', []), [], 'un override vide reste un override');
  // ⚠️ `speed_nuker` retiré (v1.8.1 → forge/calcul-degats-reels) et `degats`
  // retiré (2026-08-27 → approximation devenue redondante avec « Dégâts
  // réels ») : une recette exportée pendant leur durée de vie porte encore
  // ces valeurs, jamais validées par `parseOptimizerRecipe`. Sans repli, le
  // spread sur `undefined` plus haut dans la pile lève une TypeError.
  egal(objectiveKeysOf('speed_nuker' as unknown as Objective, undefined), [], 'un objectif retiré (recette ancienne) dégrade vers aucun biais, sans lever');
  egal(objectiveKeysOf('degats' as unknown as Objective, undefined), [], "« degats », retiré à son tour, dégrade pareillement");

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
    objectiveScore(bidon, 'degats_reels', {
      profile: s3!,
      passifs: [],
      setup: DEFAULT_DAMAGE_SETUP,
      element: null,
      artefacts: ARTIFACT_DAMAGE_NEUTRE,
      critSiPlusRapide: false,
      bonusDegatsSelonVit: null,
      bonusDegatsStack: null,
      monsterWide: {},
      bonusDegatsConditionnel: null,
      bonusDegatsSelonCr: null,
      bonusDegatsSelonDef: null,
      bonusSiAtqSeuil: null,
    }),
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

  titre('Dégâts BRUTS des artéfacts — sans sort, sans cible, sans critique');

  // ⚠️ **La promesse de cette fonction**, et ce qui la rend utilisable pour un
  // monstre dont l’objectif de recherche n’est PAS les dégâts : elle ne demande
  // ni compétence, ni adversaire, ni mode de critique. Les lignes 218-221 ne
  // critent pas et ignorent la défense adverse — leur contribution ne dépend
  // donc que des stats et des buffs.
  {
    const build = stats({ hp: 40000, atk: 2000, def: 1000, spd: 200, cr: 15, cd: 50 });
    const profil = { ...ARTIFACT_DAMAGE_NEUTRE, brutPctPv: 1.5, brutPctAtk: 20, brutPctDef: 20, brutPctVit: 200 };

    const nu = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'aucune' as const };
    const attendu = 0.015 * 40000 + 0.2 * 2000 + 0.2 * 1000 + 2 * 200;
    egal(
      Math.round(degatsBrutsArtefactsParCoup(build, nu, null, profil)),
      Math.round(attendu),
      'somme des quatre lignes sur les stats du build'
    );

    // ⚠️ Ni la CIBLE ni le CRITIQUE ne doivent bouger le résultat : si l’un des
    // deux entrait, le chiffre cesserait d’être calculable sans réglage.
    const autreCible = { ...nu, enemyDef: 5000, enemyHp: 999999, enemyHpPct: 10, critMode: 'normal' as const };
    egal(
      degatsBrutsArtefactsParCoup(build, autreCible, null, profil),
      degatsBrutsArtefactsParCoup(build, nu, null, profil),
      'la cible et le mode de critique n’ont AUCUN effet'
    );

    // …mais les BUFFS, si : ils changent les stats que ces lignes récoltent.
    const avecBuffs = { ...nu, atkBuff: true, defBuff: true };
    ok(
      degatsBrutsArtefactsParCoup(build, avecBuffs, null, profil) >
        degatsBrutsArtefactsParCoup(build, nu, null, profil),
      'les buffs ATQ/DEF augmentent bien les dégâts bruts récoltés'
    );

    // ⚠️ Et l’AMPLIFICATION du buff par les artéfacts entre aussi : c’est une
    // ligne d’artéfact (204/205/226) qui agit sur une AUTRE ligne d’artéfact.
    const avecAmpli = { ...profil, ampliAtkPct: 25 };
    ok(
      degatsBrutsArtefactsParCoup(build, avecBuffs, null, avecAmpli) >
        degatsBrutsArtefactsParCoup(build, avecBuffs, null, profil),
      'l’amplification du buff ATQ augmente ce que la ligne « prop. ATQ » récolte'
    );
    // …et reste SANS effet quand le buff n’est pas actif — elle amplifie une
    // magnitude, elle ne crée pas le buff.
    egal(
      degatsBrutsArtefactsParCoup(build, nu, null, avecAmpli),
      degatsBrutsArtefactsParCoup(build, nu, null, profil),
      'sans buff ATQ actif, son amplification ne change rien'
    );
  }
}
