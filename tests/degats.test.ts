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
  damageRelevantStats,
  defaultDamageSkill,
  defenseFactor,
  estPrisEnCharge,
  monsterDamageSkills,
  resolveDamageSkill,
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
    objectiveScore(bidon, 'degats_reels', { profile: s3!, setup: DEFAULT_DAMAGE_SETUP }),
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
