import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import {
  AUCUNE_AURA_PROPRE, ARTIFACT_DAMAGE_NEUTRE,
  artifactDamageProfile,
  autresBuffsPropresDepuisTotal,
  BonusDegatsConditionnelProfile,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  computeTotalDamage,
  critiqueGarantiParReglage,
  defenseFactor,
  damageRelevantStats,
  estPrisEnCharge,
  idsStatsCombatConnus,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsStackable,
  monsterBonusParEffetCible,
  monsterBonusStatFixe,
  monsterCombatStatProfiles,
  monsterConditionsCombat,
  monsterCritInterdit,
  monsterDamageSkills,
  monsterModificateursVit,
  monsterOffensivePassives,
  resolvedBuffsPropresCount,
  resolvedBuffCiblePresent,
  resolvedDebuffsCibleCount,
  resolvedDebuffCiblePresent,
  statsDeCombat,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { formesJouables } from '../src/lib/monsterForms';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BuildCandidate, RealDamageContext, objectiveScore } from '../src/lib/runeBuildOptim';
import { StatKey } from '../src/lib/effects';
import { StatRow, computeStats, monsterBaseStats } from '../src/lib/stats';
import { ArtifactDetail, RuneDetail } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dossierSorts = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(dossierSorts, `${com2usId}.json`), 'utf8'));
}

function profilDe(monstreId: number, sortId: number): SkillDamageProfile {
  const trouve = monsterDamageSkills(fiche(monstreId)).find((p) => p.skillCom2usId === sortId);
  if (!trouve || !estPrisEnCharge(trouve)) throw new Error(`Profil ${monstreId}/${sortId} introuvable`);
  return trouve;
}

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

const buildAudit = stats({ hp: 20000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 });
const setupAudit: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  enemyDef: 0,
  enemyHp: 1_000_000,
  enemyHpPct: 100,
  critMode: 'normal',
  summonerSkills: 'combat',
};

export default function testAuditDegatsConditionnels() {
  titre('Audit des dégâts conditionnels — étapes 1 et 2');

  const leoTorrent = profilDe(16613, 7808);
  const leoNormal = computeSkillDamage(leoTorrent, buildAudit, { ...setupAudit, enemyDef: 1000 }, AUCUNE_AURA_PROPRE);
  const leoSous30 = computeSkillDamage(leoTorrent, buildAudit, {
    ...setupAudit,
    enemyDef: 1000,
    passifsOffensifs: { 7808: true },
  }, AUCUNE_AURA_PROPRE);
  egal(leoTorrent.formule, '5.5*{ATK}', '72 — Torrent ne varie plus proportionnellement avec les PV propres');
  ok(leoSous30 > leoNormal, '72 — le toggle sous 30 % active l’ignore-DÉF de Torrent');

  const zerath = profilDe(14414, 2914);
  const zerath20k = computeSkillDamage(zerath, buildAudit, { ...setupAudit, ownHpPct: 50 }, AUCUNE_AURA_PROPRE);
  const zerath40k = computeSkillDamage(zerath, stats({ ...Object.fromEntries(buildAudit.map((s) => [s.key, s.total])), hp: 40000 }), {
    ...setupAudit,
    ownHpPct: 50,
  }, AUCUNE_AURA_PROPRE);
  egal(zerath40k, zerath20k * 2, '73 — les PV actuels de Zerath sont recalculés pour chaque build candidat');

  const ramagos = profilDe(10733, 1863);
  egal(
    computeSkillDamage(ramagos, buildAudit, { ...setupAudit, ownHpPct: 50 }, AUCUNE_AURA_PROPRE),
    10000,
    '74 — Clean Shot inflige exactement les PV propres manquants en dégâts fixes'
  );

  const skogul = profilDe(22413, 13008);
  const trasar = profilDe(22415, 13010);
  egal(
    computeSkillDamage(skogul, buildAudit, { ...setupAudit, aliveEnemies: 4 }, AUCUNE_AURA_PROPRE),
    5000,
    '77 — Atlas Stone répartit les PV max entre les ennemis vivants'
  );
  egal(
    computeSkillDamage(trasar, buildAudit, {
      ...setupAudit,
      aliveEnemies: 4,
      stackPersonnalise: { 13010: 2 },
    }, AUCUNE_AURA_PROPRE),
    6500,
    '308 — Trasar ajoute 15 % par mort, plafonné à 30 %, sur son Atlas Stone'
  );
  egal(
    computeSkillDamage(skogul, buildAudit, {
      ...setupAudit,
      aliveEnemies: 4,
      stackPersonnalise: { 13010: 2 },
    }, AUCUNE_AURA_PROPRE),
    5000,
    '308 — le compteur de Trasar ne majore ni Skogul ni son autre identifiant'
  );

  const lamiella = profilDe(31311, 21006);
  egal(lamiella.formule, '1.2*{ATK}', 'Lamiella — la composante 1,2 × ATQ reste présente');
  ok(!!lamiella.composanteFixeAdditionnelle, 'Lamiella — la réserve de Sacrifice est une composante fixe séparée');
  const lamiellaSansReserve = computeSkillDamage(lamiella, buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3 }, AUCUNE_AURA_PROPRE);
  const lamiellaAvecReserve = computeSkillDamage(lamiella, buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3 }, AUCUNE_AURA_PROPRE);
  egal(lamiellaAvecReserve - lamiellaSansReserve, 4000, 'Lamiella — réserve linéaire de PV max répartie entre trois ennemis');
  ok(
    computeSkillDamage(lamiella, buildAudit, { ...setupAudit, sacrificeReservePct: 0, critMode: 'crit' }, AUCUNE_AURA_PROPRE) > lamiellaSansReserve,
    'Lamiella — la composante ATQ peut infliger un coup critique'
  );

  const velaska = profilDe(31315, 21010);
  egal(velaska.formule, '{MAX HP}*{Sacrifice Reserve %}/{Alive Enemies} (Fixed)', 'Velaska — la formule est entièrement fixe');
  egal(
    computeSkillDamage(velaska, buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3 }, AUCUNE_AURA_PROPRE),
    4000,
    'Velaska — réserve linéaire de PV max répartie entre trois ennemis'
  );
  egal(
    computeSkillDamage(skogul, buildAudit, { ...setupAudit, aliveEnemies: 99 }, AUCUNE_AURA_PROPRE),
    5000,
    'ennemis vivants — le moteur plafonne les recettes éditées à la main à quatre'
  );
  const skogulBase = computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4 }, AUCUNE_AURA_PROPRE, 'wind');
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, mirinaeActif: true }, AUCUNE_AURA_PROPRE, 'wind'),
    skogulBase,
    'Skogul — Mirinae ne majore pas Atlas Stone'
  );
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, velaskaActif: true, velaskaPvPerduPct: 100 }, AUCUNE_AURA_PROPRE, 'wind'),
    skogulBase,
    'Skogul — le passif de Velaska ne majore pas Atlas Stone'
  );
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, brand: true }, AUCUNE_AURA_PROPRE, 'wind'),
    skogulBase * 1.25,
    'Skogul — la Marque reste compatible avec Atlas Stone'
  );
  const artefactFeu20 = { ...ARTIFACT_DAMAGE_NEUTRE, degatsElementPct: { fire: 20 } };
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, enemyElement: 'fire' }, AUCUNE_AURA_PROPRE, 'wind', artefactFeu20),
    skogulBase * 1.2,
    'Skogul — les dégâts élémentaires d’artéfact majorent Atlas Stone'
  );
  egal(
    computeTotalDamage(velaska, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, enemyElement: 'fire' }, AUCUNE_AURA_PROPRE, 'dark', artefactFeu20),
    4000,
    'Velaska — les dégâts élémentaires d’artéfact ne majorent pas la réserve'
  );
  const lamiellaMirinae0 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3, mirinaeActif: true }, AUCUNE_AURA_PROPRE, 'water');
  const lamiellaMirinae60 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, mirinaeActif: true }, AUCUNE_AURA_PROPRE, 'water');
  egal(lamiellaMirinae60 - lamiellaMirinae0, 4000, 'Lamiella — Mirinae ne majore que la partie ATQ');
  const lamiellaVelaska0 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3, velaskaActif: true, velaskaPvPerduPct: 100 }, AUCUNE_AURA_PROPRE, 'water');
  const lamiellaVelaska60 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, velaskaActif: true, velaskaPvPerduPct: 100 }, AUCUNE_AURA_PROPRE, 'water');
  ok(
    Math.abs(lamiellaVelaska60 - lamiellaVelaska0 - 4000) < 1e-9,
    'Lamiella — Price of Pain ne majore que la partie ATQ'
  );
  const lamiellaBrand0 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3, brand: true }, AUCUNE_AURA_PROPRE, 'water');
  const lamiellaBrand60 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, brand: true }, AUCUNE_AURA_PROPRE, 'water');
  egal(lamiellaBrand60 - lamiellaBrand0, 5000, 'Lamiella — la Marque majore aussi la réserve fixe');
  const moLong = profilDe(21211, 12011);
  const moLongBase = computeTotalDamage(moLong, [], buildAudit, { ...setupAudit, enemyElement: 'fire' }, AUCUNE_AURA_PROPRE, 'water');
  egal(
    computeTotalDamage(moLong, [], buildAudit, { ...setupAudit, enemyElement: 'fire' }, AUCUNE_AURA_PROPRE, 'water', artefactFeu20),
    moLongBase * 1.2,
    'Mo Long — les dégâts élémentaires d’artéfact majorent Reckless Assault'
  );

  const hwa = profilDe(15512, 6907);
  egal(resolvedDebuffsCibleCount(hwa.skillCom2usId, { ...setupAudit, effetsCibleCount: { 6907: 9 }, defBreak: true, brand: true }), 10,
    'compteur ennemi — autres débuffs + Brise DEF + Marque sont plafonnés à 10');
  const hwaAutres = computeSkillDamage(hwa, buildAudit, { ...setupAudit, effetsCibleCount: { 6907: 1 } }, AUCUNE_AURA_PROPRE);
  const hwaAvecEffets = computeSkillDamage(hwa, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { 6907: 1 },
    defBreak: true,
    brand: true,
  }, AUCUNE_AURA_PROPRE);
  ok(hwaAvecEffets > hwaAutres, 'Hwa S2 — Brise DEF et Marque incrémentent automatiquement le compteur de débuffs');
  const brandiaMixte = profilDe(18912, 9712);
  ok(
    computeSkillDamage(brandiaMixte, buildAudit, {
      ...setupAudit, effetsCibleCount: { 9712: 10 }, brand: true,
    }, AUCUNE_AURA_PROPRE) > computeSkillDamage(brandiaMixte, buildAudit, {
      ...setupAudit, effetsCibleCount: { 9712: 10 },
    }, AUCUNE_AURA_PROPRE),
    'Brandia — dix effets mixtes peuvent compter une Marque en plus ; seul le compteur des débuffs est plafonné'
  );

  const tesaS2 = profilDe(19212, 10007);
  const passifTesa = monsterBonusParEffetCible(fiche(19212))!;
  const totalTesa = (setup: DamageSetup) => computeTotalDamage(
    tesaS2,
    [],
    buildAudit,
    setup,
    AUCUNE_AURA_PROPRE,
    'fire',
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    null,
    { bonusParEffetCible: passifTesa }
  );
  ok(!resolvedDebuffCiblePresent(passifTesa.skillCom2usId, setupAudit), 'Tesarion — condition binaire inactive par défaut');
  ok(
    resolvedDebuffCiblePresent(passifTesa.skillCom2usId, {
      ...setupAudit,
      passifsOffensifs: { [passifTesa.skillCom2usId]: true },
    }),
    'Tesarion — le toggle active la présence d’un effet néfaste sans compteur'
  );
  for (const [label, patch] of [['Brise DEF', { defBreak: true }], ['Marque', { brand: true }]] as const) {
    const avec = { ...setupAudit, ...patch };
    ok(resolvedDebuffCiblePresent(passifTesa.skillCom2usId, avec), `Tesarion — ${label} active automatiquement le passif`);
    ok(totalTesa(avec) > totalTesa(setupAudit), `Tesarion — ${label} applique réellement +30 %`);
  }
  const tesaPoseApres = (hit: number) => totalTesa({
    ...setupAudit,
    scenariosEffetsEntreCoups: {
      [tesaS2.skillCom2usId]: { actif: true, apresCoup: { 'decrease-def': hit } },
    },
  });
  ok(
    totalTesa(setupAudit) < tesaPoseApres(2) && tesaPoseApres(2) < tesaPoseApres(1),
    'Tesarion — Brise DEF posée au coup 1 ou 2 active le passif seulement sur les coups suivants'
  );

  const manannanS1 = profilDe(19715, 10505);
  const passifManannan = monsterBonusParEffetCible(fiche(19715))!;
  const totalManannan = (setup: DamageSetup) => computeTotalDamage(
    manannanS1, [], buildAudit, setup, AUCUNE_AURA_PROPRE, 'dark', ARTIFACT_DAMAGE_NEUTRE, false, null, null,
    { bonusParEffetCible: passifManannan }
  );
  const manannanToggle = { ...setupAudit, passifsOffensifs: { [passifManannan.skillCom2usId]: true } };
  ok(totalManannan(manannanToggle) > totalManannan(setupAudit), 'Manannan — le toggle binaire active King of the Ruins');
  ok(totalManannan({ ...setupAudit, brand: true }) > totalManannan(setupAudit), 'Manannan — Marque active automatiquement King of the Ruins');

  const arangS3 = profilDe(11213, 2213);
  const arangNu = computeSkillDamage(arangS3, buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'wind');
  ok(
    computeSkillDamage(arangS3, buildAudit, {
      ...setupAudit,
      passifsOffensifs: { [arangS3.skillCom2usId]: true },
    }, AUCUNE_AURA_PROPRE, 'wind') > arangNu,
    'Arang — Sweet Talk utilise un toggle binaire, pas un compteur'
  );
  ok(
    computeSkillDamage(arangS3, buildAudit, { ...setupAudit, defBreak: true }, AUCUNE_AURA_PROPRE, 'wind') > arangNu,
    'Arang — Brise DEF active automatiquement le bonus binaire de Sweet Talk'
  );

  const willOWisp = profilDe(11213, 2218);
  const willBase = computeSkillDamage(willOWisp, buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'wind');
  const willPose = (hit: number) => computeSkillDamage(willOWisp, buildAudit, {
    ...setupAudit,
    scenariosEffetsEntreCoups: {
      [willOWisp.skillCom2usId]: { actif: true, apresCoup: { brand: hit } },
    },
  }, AUCUNE_AURA_PROPRE, 'wind');
  ok(willBase < willPose(2) && willPose(2) < willPose(1), "Will-o'-the-Wisp — une Marque réussie amplifie seulement les coups suivants");

  const fengYan = fiche(21213);
  const fengS1 = profilDe(21213, 12003);
  const passifsFeng = monsterOffensivePassives(fengYan);
  const fengSetup = { ...setupAudit, enemyDef: 1500 };
  const contributionFeng = (poseApres?: number) => {
    const setup = poseApres == null
      ? fengSetup
      : {
          ...fengSetup,
          scenariosEffetsEntreCoups: {
            [fengS1.skillCom2usId]: { actif: true, apresCoup: { 'decrease-def': poseApres } },
          },
        };
    return computeTotalDamage(fengS1, passifsFeng, buildAudit, setup, AUCUNE_AURA_PROPRE, 'wind') -
      computeTotalDamage(fengS1, [], buildAudit, setup, AUCUNE_AURA_PROPRE, 'wind');
  };
  ok(
    contributionFeng() < contributionFeng(2) && contributionFeng(2) < contributionFeng(1),
    'Feng Yan — chaque instance de Winds and Clouds lit le Brise DEF avant le coup correspondant'
  );

  // Référence indépendante : sans DEF, critique ni skillup, le quotient des
  // totaux est le multiplicateur annoncé, sans dépendre du moteur de recherche.
  const kroS2 = profilDe(11035, 2060);
  const kroNu = computeSkillDamage(kroS2, buildAudit, setupAudit, AUCUNE_AURA_PROPRE);
  const kroDeux = computeSkillDamage(kroS2, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { [kroS2.skillCom2usId]: 2 },
  }, AUCUNE_AURA_PROPRE);
  ok(Math.abs(kroDeux / kroNu - 1.4) < 1e-9, 'Kro S2 : +20 % par débuff sur ses dégâts propres');

  const akhamamir = profilDe(19213, 10013);
  const akhaNu = computeSkillDamage(akhamamir, buildAudit, setupAudit, AUCUNE_AURA_PROPRE);
  const akhaUn = computeSkillDamage(akhamamir, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { [akhamamir.skillCom2usId]: 1 },
  }, AUCUNE_AURA_PROPRE);
  const akhaDeux = computeSkillDamage(akhamamir, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { [akhamamir.skillCom2usId]: 2 },
  }, AUCUNE_AURA_PROPRE);
  ok(Math.abs(akhaUn / akhaNu - 1.5) < 1e-9, 'Akhamamir : exactement un débuff vaut +50 %');
  ok(Math.abs(akhaDeux / akhaNu - 1.6) < 1e-9, 'Akhamamir : deux débuffs valent +30 % chacun');
  const akhaPoseApresUn = computeSkillDamage(akhamamir, buildAudit, {
    ...setupAudit,
    scenariosEffetsEntreCoups: {
      [akhamamir.skillCom2usId]: { actif: true, apresCoup: { unrecoverable: 1 } },
    },
  }, AUCUNE_AURA_PROPRE);
  ok(Math.abs(akhaPoseApresUn / akhaNu - 1.25) < 1e-9, 'Akhamamir : le seuil exactement-un est recalculé pour le coup 2');

  // Aucune réussite, pose après le coup 2, pose après le coup 1 : le coup qui
  // pose l'effet lit toujours l'état antérieur, seuls les suivants en profitent.
  const argen = profilDe(14713, 6513);
  const argenBase = computeSkillDamage(argen, buildAudit, setupAudit, AUCUNE_AURA_PROPRE);
  const argenApres = (hit: number) =>
    computeSkillDamage(argen, buildAudit, {
      ...setupAudit,
      scenariosEffetsEntreCoups: {
        [argen.skillCom2usId]: { actif: true, apresCoup: { brand: hit } },
      },
    }, AUCUNE_AURA_PROPRE);
  ok(argenBase < argenApres(2) && argenApres(2) < argenApres(1), 'Argen : aucune pose < après coup 2 < après coup 1');

  const argenMarqueInitiale: DamageSetup = {
    ...setupAudit,
    brand: true,
    effetsCibleCount: { [argen.skillCom2usId]: 1 },
  };
  egal(
    computeSkillDamage(argen, buildAudit, {
      ...argenMarqueInitiale,
      scenariosEffetsEntreCoups: { [argen.skillCom2usId]: { actif: true, apresCoup: { brand: 1 } } },
    }, AUCUNE_AURA_PROPRE),
    computeSkillDamage(argen, buildAudit, argenMarqueInitiale, AUCUNE_AURA_PROPRE),
    'réappliquer une Marque déjà présente ne double pas le compteur'
  );
  const argenDeuxEffets = computeSkillDamage(argen, buildAudit, {
    ...setupAudit,
    scenariosEffetsEntreCoups: {
      [argen.skillCom2usId]: {
        actif: true,
        apresCoup: { brand: 1, 'beneficial-effects-blocked': 1 },
      },
    },
  }, AUCUNE_AURA_PROPRE);
  ok(argenDeuxEffets > argenApres(1), 'deux débuffs distincts posés au même instant comptent séparément');

  const ken = profilDe(24112, 14012);
  const kenInitial: DamageSetup = {
    ...setupAudit,
    brand: true,
    effetsCibleCount: { [ken.skillCom2usId]: 1 },
  };
  egal(
    computeSkillDamage(ken, buildAudit, {
      ...kenInitial,
      scenariosEffetsEntreCoups: { [ken.skillCom2usId]: { actif: true, apresCoup: { brand: 1 } } },
    }, AUCUNE_AURA_PROPRE),
    computeSkillDamage(ken, buildAudit, kenInitial, AUCUNE_AURA_PROPRE),
    'KEN : Marque initiale active dès le premier coup et non recomptée à la pose'
  );
  ok(
    computeSkillDamage(ken, buildAudit, {
      ...setupAudit,
      scenariosEffetsEntreCoups: { [ken.skillCom2usId]: { actif: true, apresCoup: { brand: 1 } } },
    }, AUCUNE_AURA_PROPRE) > computeSkillDamage(ken, buildAudit, setupAudit, AUCUNE_AURA_PROPRE),
    'KEN : une Marque posée après le coup 1 amplifie les coups suivants'
  );

  // Les noms de compétences ne suffisent pas quand des homonymes portent un
  // texte différent. Chaque négatif ci-dessous a été trouvé dans le corpus.
  ok(!profilDe(11031, 2056).bonusParEffetCible, 'Team Up de Ramahan ne reçoit pas le bonus propre à Kro');
  ok(!profilDe(17113, 6413).bonusParEffetCible, 'Mach Crush 6413 ne reçoit pas la règle d’Akhamamir 2A');
  ok(!profilDe(11511, 2511).bonusParEffetCible, 'Pursuit 2511 ne reçoit pas le bonus propre à Kahn 2A');
  ok(!profilDe(10611, 1506).bonusParEffetCible, 'Ambush 1506 ne reçoit pas le bonus propre à Tarq 2A');
  egal(profilDe(14415, 2910).bonusConditionnelPropre?.pct, 50, 'Dark Storm de Grogen garde sa clause d’incapacité');
  ok(!profilDe(11115, 2110).bonusConditionnelPropre, 'Dark Storm 2110 ne reçoit pas la clause de Grogen');
  ok(!profilDe(16531, 7751).bonusConditionnelPropre, 'Pulverize 7751 ne reçoit pas la clause propre à Iron');
  ok(!profilDe(11714, 2709).conditionsCombat?.length, 'Flash Pierce 2709 ne reçoit pas la clause propre à Eludain');
  ok(!profilDe(11711, 2706).critDamagePoints, 'Ice Pierce 2706 n’ajoute pas les 50 points de DC propres à Purian');
  ok(!profilDe(15011, 6106).effetsEntreCoups?.length, 'Chain Attack 6106 ne pose pas une Marque par homonymie');

  const fullBurst = profilDe(25415, 15315);
  const fullBurstInitial: DamageSetup = {
    ...setupAudit,
    effetsCibleCount: { [fullBurst.skillCom2usId]: 1 },
  };
  ok(
    computeSkillDamage(fullBurst, buildAudit, {
      ...fullBurstInitial,
      scenariosEffetsEntreCoups: {
        [fullBurst.skillCom2usId]: { actif: true, apresCoup: { 'continuous-damage': 1 } },
      },
    }, AUCUNE_AURA_PROPRE) > computeSkillDamage(fullBurst, buildAudit, fullBurstInitial, AUCUNE_AURA_PROPRE),
    'un DoT réussi s’ajoute même si un DoT existe déjà'
  );

  const cecilia = profilDe(34011, 23311);
  const ceciliaSetup = { ...setupAudit, enemyDef: 1500 };
  const ceciliaNu = computeSkillDamage(cecilia, buildAudit, ceciliaSetup, AUCUNE_AURA_PROPRE);
  const ceciliaApres = (hit: number) =>
    computeSkillDamage(cecilia, buildAudit, {
      ...ceciliaSetup,
      scenariosEffetsEntreCoups: {
        [cecilia.skillCom2usId]: { actif: true, apresCoup: { 'decrease-def': hit } },
      },
    }, AUCUNE_AURA_PROPRE);
  ok(ceciliaNu < ceciliaApres(2) && ceciliaApres(2) < ceciliaApres(1), 'Cecilia : la DEF change après le coup choisi');

  // Le relevé exhaustif des profils éligibles est figé. Une nouvelle entrée
  // exige une décision de curation, jamais une inclusion par ressemblance.
  const effetsEntreCoupsAttendus = new Set([
    'Arcane Burst',
    'Blackout Kick', // Sia 3454 seul, par identifiant
    'Chain Attack',
    'Crushed Hopes', // Cichlid 10413
    'Death Blow',
    'Divergent Fist', // Yuji S2 — curé comme effet entre les coups
    'Double Strike', // Melissa 12608
    'Fast Link', // Barbara, Masha, Xiana 13606/13607/13610
    'Full Burst',
    'Ghost Slash',
    'Gouge',
    'Gust',
    'Harpoon Impalement', // Eivor 17507/17509
    'Mach Crush',
    'Panda Supremacy',
    'Rain of Stones',
    'Reelseiden・Flurry', // Übel 25206/25210
    'Sequential Attack',
    'Shadow Blade',
    'Shinryuken',
    'Shockwave Fist', // Rick S2 — curé comme celui de Yuji S2
    'Triple Crush',
    'Water Dragon Attack',
    'Weakness Shot', // Carlos, Dominic, Benedict 15507/15508/15509
    "Will-o'-the-Wisp",
  ]);
  const effetsEntreCoupsTrouves = new Set<string>();
  for (const fichier of readdirSync(dossierSorts)) {
    const detail: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, fichier), 'utf8'));
    for (const p of monsterDamageSkills(detail)) {
      if (estPrisEnCharge(p) && p.effetsEntreCoups?.length) effetsEntreCoupsTrouves.add(p.nom);
    }
  }
  egal([...effetsEntreCoupsTrouves].sort(), [...effetsEntreCoupsAttendus].sort(), 'corpus complet des profils inter-coups curés');

  const baekdu = profilDe(18514, 9314);
  ok(baekdu.variables.includes('Target SPD'), 'Target SPD est accepté par le parseur');
  ok(
    computeSkillDamage(baekdu, buildAudit, { ...setupAudit, enemySpd: 100 }, AUCUNE_AURA_PROPRE) !==
      computeSkillDamage(baekdu, buildAudit, { ...setupAudit, enemySpd: 200 }, AUCUNE_AURA_PROPRE),
    'Target SPD lit la VIT adverse saisie'
  );

  const plagesAttendues: [number, number, number, number][] = [
    [14412, 2907, 3, 5],
    [16312, 7502, 2, 3],
    [29513, 19213, 2, 4],
    [30311, 20006, 2, 3],
    [15934, 7364, 3, 4],
    [35712, 24912, 2, 3],
    [10132, 1162, 4, 6],
  ];
  for (const [monstreId, sortId, min, max] of plagesAttendues) {
    egal(profilDe(monstreId, sortId).hitsRange, { min, max }, `${monstreId}/${sortId} : ${min}-${max} coups`);
  }
  egal(profilDe(31015, 20715).hits, 4, 'Rick ténèbres S3 : quatre coups fixes');

  const cdPropres: [number, number, number][] = [
    [19315, 10135, 50],
    [14415, 2905, 20],
    [14415, 2915, 150],
    [29512, 19212, 100],
    [29912, 19612, 100],
    [11731, 2756, 50],
  ];
  for (const [monstreId, sortId, points] of cdPropres) {
    egal(profilDe(monstreId, sortId).critDamagePoints, points, `${monstreId}/${sortId} : bonus DC propre`);
  }
  for (const [sortId, points] of [[2905, 20], [2915, 150]] as const) {
    const grogen = profilDe(14415, sortId);
    const sansBonus = { ...grogen, critDamagePoints: 0 };
    const nonCrit = { ...setupAudit, critMode: 'normal' as const };
    const crit = { ...setupAudit, critMode: 'crit' as const };
    egal(computeSkillDamage(grogen, buildAudit, nonCrit, AUCUNE_AURA_PROPRE, 'dark'), computeSkillDamage(sansBonus, buildAudit, nonCrit, AUCUNE_AURA_PROPRE, 'dark'),
      `Grogen ${sortId} : les points de DC ne changent pas un coup non critique`);
    ok(computeSkillDamage(grogen, buildAudit, crit, AUCUNE_AURA_PROPRE, 'dark') > computeSkillDamage(sansBonus, buildAudit, crit, AUCUNE_AURA_PROPRE, 'dark'),
      `Grogen ${sortId} : les ${points} points de DC augmentent réellement les dégâts critiques`);
    egal(Math.round(computeSkillDamage(grogen, buildAudit, crit, AUCUNE_AURA_PROPRE, 'dark') - computeSkillDamage(sansBonus, buildAudit, crit, AUCUNE_AURA_PROPRE, 'dark')),
      Math.round(1000 * (sortId === 2905 ? 4.6 : 5.2) * points / 100 * defenseFactor(0)),
      `Grogen ${sortId} : l'écart suit ATQ × coefficient × points de DC × mitigation`);
    ok(!!grogen.description?.length, `Grogen ${sortId} : la prose est transmise au choix du sort`);
  }
  egal(profilDe(11734, 2759).critRatePoints, 50, 'Eludain : +50 points de TC');
  egal(profilDe(11731, 2756).critRatePoints, 50, 'Purian : +50 points de TC');

  const isabelle = fiche(19915);
  const bonusIsabelle = monsterBonusDegatsConditionnel(isabelle)!;
  const s1Isabelle = monsterDamageSkills(isabelle).find((p) => estPrisEnCharge(p) && p.slot === 1) as SkillDamageProfile;
  const s3Isabelle = profilDe(19915, 10715);
  const setupIsabelle = { ...setupAudit, passifsOffensifs: { [bonusIsabelle.skillCom2usId]: true } };
  const totalIsabelle = (
    profile: SkillDamageProfile,
    setup: DamageSetup,
    bonus: BonusDegatsConditionnelProfile | null = bonusIsabelle
  ) =>
    computeTotalDamage(profile, [], buildAudit, setup, AUCUNE_AURA_PROPRE, null, undefined, false, null, null, {}, bonus);
  ok(
    Math.abs(totalIsabelle(s1Isabelle, setupIsabelle) / totalIsabelle(s1Isabelle, setupAudit, null) - 1.5) < 1e-9,
    'Isabelle : S1 reçoit +50 % quand S3 est en recharge'
  );
  egal(
    totalIsabelle(s3Isabelle, setupIsabelle),
    totalIsabelle(s3Isabelle, setupAudit, null),
    'Isabelle : S3 ne reçoit jamais son propre bonus'
  );

  for (const id of [25111, 25112, 25113, 25114, 25115]) {
    ok(monsterCritInterdit(fiche(id)), `${id} : Onimusha détecté par son passif exact`);
  }
  const fuuki = fiche(25113);
  const fuukiS1 = profilDe(25113, 15003);
  for (const [monstreId, sortId] of [[25111, 15001], [25112, 15002], [25113, 15003], [25114, 15004], [25115, 15005]] as const) {
    egal(profilDe(monstreId, sortId).effetsEntreCoups?.[0]?.effetCombat, 'defBreak',
      `${monstreId}/${sortId} : Ghost Slash peut poser Brise DEF au premier coup`);
  }
  const cibleOnimusha = { ...setupAudit, enemyDef: 1200 };
  const ghostSansPose = computeSkillDamage(fuukiS1, buildAudit, cibleOnimusha, AUCUNE_AURA_PROPRE, 'wind');
  const ghostPoseApresPremier = computeSkillDamage(fuukiS1, buildAudit, {
    ...cibleOnimusha,
    scenariosEffetsEntreCoups: { [fuukiS1.skillCom2usId]: { actif: true, apresCoup: { 'decrease-def': 1 } } },
  }, AUCUNE_AURA_PROPRE, 'wind');
  const ghostBreakInitial = computeSkillDamage(fuukiS1, buildAudit, { ...cibleOnimusha, defBreak: true }, AUCUNE_AURA_PROPRE, 'wind');
  ok(ghostSansPose < ghostPoseApresPremier && ghostPoseApresPremier < ghostBreakInitial,
    'Ghost Slash : une pose au premier hit ne majore que le second');
  egal(Math.round(ghostPoseApresPremier), Math.round((ghostSansPose + ghostBreakInitial) / 2),
    'Ghost Slash : le scénario vaut un hit sans Brise DEF puis un hit avec');
  ok(!fuukiS1.fixed, 'Onimusha : dégâts ordinaires, pas dégâts fixes');
  const sansCritOnimusha = { critInterdit: monsterCritInterdit(fuuki) };
  egal(
    computeTotalDamage(fuukiS1, [], buildAudit, { ...setupAudit, critMode: 'crit' }, AUCUNE_AURA_PROPRE, 'wind', undefined, false, null, null, sansCritOnimusha),
    computeTotalDamage(fuukiS1, [], buildAudit, { ...setupAudit, critMode: 'normal' }, AUCUNE_AURA_PROPRE, 'wind', undefined, false, null, null, sansCritOnimusha),
    'Onimusha : le mode Critique ne crée pas un critique impossible'
  );

  const candidatCd = { stats: stats({ atk: 1200, cd: 300 }), effTotal: 0 } as unknown as BuildCandidate;
  const candidatAtk = { stats: stats({ atk: 1600, cd: 50 }), effTotal: 0 } as unknown as BuildCandidate;
  const contexteFuuki = (critInterdit: boolean): RealDamageContext => ({
    profile: fuukiS1,
    passifs: [],
    setup: { ...setupAudit, critMode: 'crit' },
    element: 'wind',
    artefacts: ARTIFACT_DAMAGE_NEUTRE,
    critSiPlusRapide: false,
    bonusDegatsSelonVit: null,
    bonusDegatsStack: null,
    monsterWide: { critInterdit },
    bonusDegatsConditionnel: null,
    bonusDegatsSelonCr: null,
    bonusDegatsSelonDef: null,
    bonusSiAtqSeuil: null,
  });
  ok(
    objectiveScore(candidatCd, 'degats_reels', AUCUNE_AURA_PROPRE, contexteFuuki(false)) >
      objectiveScore(candidatAtk, 'degats_reels', AUCUNE_AURA_PROPRE, contexteFuuki(false)),
    'contrôle : critique permis, le build DC gagne'
  );
  ok(
    objectiveScore(candidatAtk, 'degats_reels', AUCUNE_AURA_PROPRE, contexteFuuki(true)) >
      objectiveScore(candidatCd, 'degats_reels', AUCUNE_AURA_PROPRE, contexteFuuki(true)),
    'classement réel : critique interdit, le build ATQ devient optimal'
  );
  ok(
    !damageRelevantStats(
      fuukiS1,
      [],
      setupAudit,
      false,
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      sansCritOnimusha
    ).includes('cd'),
    'le pré-filtrage Onimusha ne privilégie pas le DC sans effet'
  );

  for (const [monstreId, sortId] of [
    [15412, 6802],
    [15411, 6801],
    [15413, 6803],
    [15414, 6804],
    [15415, 6805],
  ]) {
    egal(profilDe(monstreId, sortId).bonusParEffetCible?.pct, 15, `Magic Arrow ${monstreId} : variante couverte`);
  }

  const bonusParDebuffAttendus: [number, number, number][] = [
    [11035, 2060, 20],
    [11035, 2065, 50],
    [14412, 2902, 10],
    [18511, 9306, 15],
    [18513, 9308, 15],
    [18515, 9310, 15],
    [17811, 8706, 30],
    [17813, 8708, 30],
    [17815, 8710, 30],
    [14713, 6513, 25],
    [19213, 10013, 30],
    [17311, 8211, 15],
    [11531, 2561, 15],
    [24112, 14012, 15],
    [24612, 14512, 15],
    [15512, 6907, 15],
    [15514, 6909, 15],
    [21212, 12012, 20],
    [25415, 15315, 10],
    [1000111, 10113000, 20],
    [1000112, 10123000, 20],
    [1000113, 10133000, 20],
    [34011, 23311, 15],
    [33512, 22812, 15],
    [10631, 1556, 30],
    [11213, 2213, 50],
    [16914, 8034, 25],
    [16915, 8035, 25],
    [17911, 9017, 50],
    [17914, 9009, 50],
    [19712, 10512, 50],
    [30115, 19815, 50],
    [33012, 22312, 15],
  ];
  for (const [monstreId, sortId, pct] of bonusParDebuffAttendus) {
    egal(profilDe(monstreId, sortId).bonusParEffetCible?.pct, pct, `${monstreId}/${sortId} : bonus par débuff curé`);
  }

  for (const [monstreId, sortId] of [
    [27612, 17407],
    [27613, 17408],
    [27615, 17410],
    [28112, 17907],
    [28113, 17908],
    [28115, 17910],
  ]) {
    const profile = profilDe(monstreId, sortId);
    egal(profile.bonusParEffetPropre?.pct, 5, `${monstreId}/${sortId} : +5 % par buff propre`);
    ok(profile.ignoreDef, `${monstreId}/${sortId} : ignore DEF explicite`);
  }
  const buffsExplicites: DamageSetup = {
    ...setupAudit, buffsPropresCountAutres: true,
    atkBuff: true, defBuff: true, spdBuff: true,
    buffsPropresCount: { 17408: 2 },
  };
  egal(DEFAULT_DAMAGE_SETUP.buffsPropresCountAutres, true,
    'les nouveaux réglages saisissent les autres buffs propres par défaut');
  egal(resolvedBuffsPropresCount(17408, buffsExplicites), 5,
    'Kassandra : deux autres buffs + ATQ/DEF/VIT actifs = cinq buffs propres');
  egal(autresBuffsPropresDepuisTotal(5, buffsExplicites), 2,
    'le compteur affiché à cinq reconstruit deux autres buffs à l’enregistrement');
  egal(resolvedBuffsPropresCount(17408, { ...buffsExplicites, buffsPropresCount: { 17408: 7 } }), 10,
    'buffs propres : sept autres + trois explicites atteignent le plafond de dix');
  egal(resolvedBuffsPropresCount(17408, { ...buffsExplicites, buffsPropresCount: { 17408: 40 } }), 10,
    'buffs propres : une recette éditée à la main ne peut dépasser dix');
  egal(resolvedBuffsPropresCount(17408, { ...buffsExplicites, atkBuff: false, defBuff: false, spdBuff: false }), 2,
    'buffs propres : les interrupteurs désactivés ne contribuent pas');
  const ancienCompteBuffs = { ...buffsExplicites, buffsPropresCountAutres: undefined };
  egal(resolvedBuffsPropresCount(17408, ancienCompteBuffs), 3,
    'ancienne recette : le total inclusif ne recompte pas ATQ/DEF/VIT');
  egal(autresBuffsPropresDepuisTotal(3, ancienCompteBuffs), 3,
    'ancienne recette : modifier le compteur ne le convertit pas en autres buffs');
  egal(resolvedBuffsPropresCount(17408, { ...ancienCompteBuffs, spdBuff: false }), 2,
    'ancienne recette : le total historique de deux buffs reste inchangé');
  for (const [monstreId, sortId] of [
    [27612, 17407], [27613, 17408], [27615, 17410],
    [28112, 17907], [28113, 17908], [28115, 17910],
  ]) {
    const profile = profilDe(monstreId, sortId);
    const nu = computeSkillDamage(profile, buildAudit, setupAudit, AUCUNE_AURA_PROPRE);
    const avecDefBuff = computeSkillDamage(profile, buildAudit, { ...setupAudit, defBuff: true }, AUCUNE_AURA_PROPRE);
    ok(Math.abs(avecDefBuff / nu - 1.05) < 1e-9,
      `${monstreId}/${sortId} : le buff DEF seul apporte +5 % au S2 sans modifier l'ATQ`);
  }
  for (const [monstreId, sortId] of [[33413, 22713], [33913, 23213]]) {
    const profile = profilDe(monstreId, sortId);
    const nu = computeSkillDamage(profile, buildAudit, setupAudit, AUCUNE_AURA_PROPRE);
    const avecDefBuff = computeSkillDamage(profile, buildAudit, { ...setupAudit, defBuff: true }, AUCUNE_AURA_PROPRE);
    ok(Math.abs(avecDefBuff / nu - 1.15) < 1e-9,
      `${monstreId}/${sortId} : un buff propre explicite alimente aussi le bonus de 15 %`);
  }
  for (const [monstreId, sortId] of [
    [33413, 22713],
    [33913, 23213],
  ]) {
    const profile = profilDe(monstreId, sortId);
    egal(profile.bonusParEffetCible?.pct, 15, `${monstreId}/${sortId} : débuffs cible pris en compte`);
    egal(profile.bonusParEffetPropre?.pct, 15, `${monstreId}/${sortId} : buffs propres pris en compte`);
  }

  const bonusMonstreAttendus: [number, number, number][] = [
    [10133, 1163, 30],
    [15033, 6163, 20],
    [19212, 10011, 30],
    [19715, 10515, 100],
  ];
  for (const [monstreId, passifId, pct] of bonusMonstreAttendus) {
    const profile = monsterBonusParEffetCible(fiche(monstreId));
    egal(profile?.skillCom2usId, passifId, `${monstreId} : passif par débuff exact`);
    egal(profile?.pct, pct, `${monstreId} : pourcentage du passif par débuff`);
  }

  const naomi = fiche(15033);
  const naomiS1 = profilDe(15033, 6158);
  const bonusNaomi = monsterBonusParEffetCible(naomi)!;
  const setupNaomi = {
    ...setupAudit,
    effetsCibleCount: { [bonusNaomi.skillCom2usId]: 1 },
  };
  egal(
    computeTotalDamage(naomiS1, [], buildAudit, setupNaomi, AUCUNE_AURA_PROPRE, 'wind', undefined, false, null, null, {
      bonusParEffetCible: bonusNaomi,
    }),
    computeTotalDamage(naomiS1, [], buildAudit, { ...setupNaomi, critMode: 'crit' }, AUCUNE_AURA_PROPRE, 'wind', undefined, false, null, null, {
      bonusParEffetCible: bonusNaomi,
    }),
    'Naomi : un débuff force réellement le critique en mode Normal'
  );

  const conditionsDirectes: [number, number, string][] = [
    [11813, 3013, 'aucunBuffCible'],
    [19812, 10607, 'aucunBuffCible'],
    [19813, 10608, 'aucunBuffCible'],
    [19814, 10609, 'aucunBuffCible'],
    [11734, 2759, 'aucunBuffCible'],
    [19712, 10502, 'manuel'],
    [33211, 22506, 'buffCiblePresent'],
    [33711, 23006, 'buffCiblePresent'],
    [19515, 10315, 'pvCibleMax'],
    [21911, 12611, 'pvCibleMax'],
    [27611, 17411, 'elementCible'],
    [28111, 17911, 'elementCible'],
    [18911, 9706, 'aucunBuffCible'],
    [16914, 8034, 'elementCible'],
    [16915, 8035, 'elementCible'],
  ];
  for (const [monstreId, sortId, type] of conditionsDirectes) {
    ok(
      profilDe(monstreId, sortId).conditionsCombat?.some((c) => c.type === type) === true,
      `${monstreId}/${sortId} : condition ${type}`
    );
  }

  const kassandraEau = profilDe(27611, 17411);
  egal(
    computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'wind' }, AUCUNE_AURA_PROPRE, 'water'),
    computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'wind', critMode: 'crit' }, AUCUNE_AURA_PROPRE, 'water'),
    'Kassandra eau : la cible Vent force le critique en mode Normal'
  );
  ok(
    computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'wind' }, AUCUNE_AURA_PROPRE, 'water') >
      computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'fire' }, AUCUNE_AURA_PROPRE, 'water'),
    'Kassandra eau : le +100 % dépend bien de l’élément de la cible'
  );
  const storm = profilDe(18911, 9706);
  egal(
    computeSkillDamage(storm, buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'water'),
    computeSkillDamage(storm, buildAudit, { ...setupAudit, critMode: 'crit' }, AUCUNE_AURA_PROPRE, 'water'),
    'Storm of Midnight : aucun buff adverse force le critique'
  );
  ok(
    computeSkillDamage(storm, buildAudit, { ...setupAudit, buffsCibleCount: { [storm.skillCom2usId]: 1 } }, AUCUNE_AURA_PROPRE, 'water') <
      computeSkillDamage(storm, buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'water'),
    'Storm of Midnight : un buff adverse retire le critique garanti'
  );
  for (const [monstreId, sortId] of [[18911, 9706], [18913, 9708], [18915, 9710]] as const) {
    const s2 = profilDe(monstreId, sortId);
    ok(s2.conditionsCombat?.some((condition) => condition.type === 'aucunBuffCible' && condition.critiqueGaranti) === true,
      `${monstreId} Storm of Midnight : aucun buff adverse garantit le critique`);
    ok(computeSkillDamage(s2, buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'water') >
      computeSkillDamage(s2, buildAudit, { ...setupAudit, buffsCibleCount: { [sortId]: 1 } }, AUCUNE_AURA_PROPRE, 'water'),
      `${monstreId} Storm of Midnight : le buff adverse retire la garantie`);
  }

  const togglesSortAttendus: [number, number, number][] = [
    [15411, 6811, 50],
    [14415, 2910, 50],
    [20914, 11714, 50],
    [13311, 5306, 50],
    [16532, 7752, 50],
    [14914, 5814, 30],
    [31811, 21301, 50],
    [32511, 21901, 50],
  ];
  for (const [monstreId, sortId, pct] of togglesSortAttendus) {
    egal(profilDe(monstreId, sortId).bonusConditionnelPropre?.pct, pct, `${monstreId}/${sortId} : condition déclarative propre au sort`);
  }
  egal(monsterBonusDegatsConditionnel(fiche(34811))?.pct, 100, 'Gollum : Dissimulation majore les attaques du monstre');
  egal(monsterBonusDegatsConditionnel(fiche(35411))?.pct, 100, 'Lob Ear : Dissimulation majore les attaques du monstre');
  egal(monsterBonusDegatsConditionnel(fiche(20715))?.pct, 50, 'Dusky : bonus sous bouclier');
  egal(monsterBonusDegatsConditionnel(fiche(25115))?.pct, 50, 'Ongyouki : bonus au tour de dissipation');
  egal(monsterBonusDegatsConditionnel(fiche(1000112))?.pct, 30, 'Homunculus Attaque : Magic Power Explosion');
  ok(!monsterBonusDegatsConditionnel(fiche(1000215)), 'Homunculus Support : Explosion II reste hors périmètre');

  egal(monsterBonusStatFixe(fiche(10812))?.cd, 50, 'Bremis : +50 points de DC');
  egal(monsterBonusStatFixe(fiche(14115))?.cd, 100, 'Guillaume : +100 points de DC');
  egal(monsterBonusStatFixe(fiche(10735))?.cr, 20, 'Gorgo : +20 points de TC');
  const stacksMonstreAttendus: [number, number, number, number][] = [
    [22913, 13318, 15, 5],
    [23113, 13413, 20, 5],
    [28315, 18135, 10, 5],
  ];
  for (const [monstreId, passifId, ratio, max] of stacksMonstreAttendus) {
    const profile = monsterBonusDegatsStackable(fiche(monstreId));
    egal(profile?.skillCom2usId, passifId, `${monstreId} : passif de charges exact`);
    egal(profile?.ratio, ratio, `${monstreId} : ratio par charge`);
    egal(profile?.triggerMax, max, `${monstreId} : plafond de charges`);
  }
  egal(profilDe(22915, 13315).bonusStackPropre?.critiqueGarantiAuMax, true, 'Bella : critique garanti à dix charges');
  const bella = profilDe(22915, 13315);
  egal(
    computeSkillDamage(bella, buildAudit, { ...setupAudit, stackPersonnalise: { [bella.skillCom2usId]: 10 } }, AUCUNE_AURA_PROPRE),
    computeSkillDamage(bella, buildAudit, {
      ...setupAudit,
      critMode: 'crit',
      stackPersonnalise: { [bella.skillCom2usId]: 10 },
    }, AUCUNE_AURA_PROPRE),
    'Bella : dix charges forcent réellement le critique'
  );
  ok(
    computeSkillDamage(bella, buildAudit, { ...setupAudit, stackPersonnalise: { [bella.skillCom2usId]: 10 } }, AUCUNE_AURA_PROPRE) >
      computeSkillDamage(bella, buildAudit, { ...setupAudit, stackPersonnalise: { [bella.skillCom2usId]: 9 } }, AUCUNE_AURA_PROPRE),
    'Bella : la dixième charge ajoute le dernier palier de dégâts et le critique'
  );
  egal(profilDe(27314, 17114).bonusStackPropre?.ratio, 25, 'Altaïr : +25 % par tour');
  egal(profilDe(27814, 17614).bonusStackPropre?.ratio, 25, 'Frederic : +25 % par tour');

  egal(monsterBonusDegatsStackable(fiche(24211))?.ratio, 0.5, 'M. BISON Eau : alias de Borgnine');
  egal(monsterBonusDegatsConditionnel(fiche(24311))?.pct, 100, 'DHALSIM Eau : alias de Kyle');
  egal(monsterConditionsCombat(fiche(15514))[0]?.condition.type, 'pvCibleMax', 'Pang : seuil de PV sur le passif exact');
  ok(!monsterBonusDegatsStackable(fiche(22415)), 'Trasar : aucun bonus global avant le déblocage d’Atlas Stone en étape 2');

  for (const [monstreId, sortId] of [[31311, 21006], [31315, 21010]] as const) {
    const profile = monsterDamageSkills(fiche(monstreId)).find((p) => p.skillCom2usId === sortId);
    ok(profile != null && estPrisEnCharge(profile), `${monstreId}/${sortId} : formule PV/réserve curée et prise en charge`);
  }
  const combosBuffBinaire = [
    [33211, 22506], [33213, 22508], [33214, 22509],
    [33711, 23006], [33713, 23008], [33714, 23009],
  ] as const;
  for (const [monstreId, sortId] of combosBuffBinaire) {
    const sort = profilDe(monstreId, sortId);
    const zero = { ...setupAudit, buffsCibleCount: { [sort.skillCom2usId]: 0 } };
    const un = { ...setupAudit, buffsCibleCount: { [sort.skillCom2usId]: 1 } };
    const dix = { ...setupAudit, buffsCibleCount: { [sort.skillCom2usId]: 10 } };
    ok(!resolvedBuffCiblePresent(sort.skillCom2usId, zero), `${sort.nom} : pas de buff`);
    ok(resolvedBuffCiblePresent(sort.skillCom2usId, dix), `${sort.nom} : ancienne recette à dix buffs`);
    ok(computeSkillDamage(sort, buildAudit, un, AUCUNE_AURA_PROPRE, 'wind') > computeSkillDamage(sort, buildAudit, zero, AUCUNE_AURA_PROPRE, 'wind'),
      `${sort.nom} : un seul buff active le bonus`);
    egal(computeSkillDamage(sort, buildAudit, un, AUCUNE_AURA_PROPRE, 'wind'), computeSkillDamage(sort, buildAudit, dix, AUCUNE_AURA_PROPRE, 'wind'),
      `${sort.nom} : dix buffs ne renforcent pas le bonus binaire`);
  }

  const powerSurge = profilDe(19712, 10502);
  const powerNu = computeSkillDamage(powerSurge, buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'fire');
  const powerToggle = computeSkillDamage(powerSurge, buildAudit, {
    ...setupAudit,
    passifsOffensifs: { [powerSurge.skillCom2usId]: true },
  }, AUCUNE_AURA_PROPRE, 'fire');
  ok(Math.abs(powerToggle / powerNu - 1.15) < 1e-9, 'Power Surge — le toggle « aucun effet néfaste » applique +15 %');

  const inosuke = fiche(32112);
  const conditionInosuke = monsterConditionsCombat(inosuke)[0]!;
  egal(conditionInosuke.condition.type, 'manuel', 'Inosuke feu — la clause 0 ou 1 effet néfaste est un toggle');
  const inosukeS1 = profilDe(32112, 21502);
  const totalInosuke = (actif: boolean) => computeTotalDamage(
    inosukeS1,
    [],
    buildAudit,
    { ...setupAudit, passifsOffensifs: { [conditionInosuke.skillCom2usId]: actif } },
    AUCUNE_AURA_PROPRE,
    'fire',
    ARTIFACT_DAMAGE_NEUTRE,
    false,
    null,
    null,
    { conditionsCombat: [conditionInosuke] }
  );
  ok(Math.abs(totalInosuke(true) / totalInosuke(false) - 1.3) < 1e-9, 'Inosuke feu — le toggle applique +30 % de dégâts');

  const astar = fiche(19812);
  const profilStatsAstar = monsterCombatStatProfiles(astar);
  const buildAstar = stats({ hp: 20000, atk: 2000, def: 800, spd: 100, cr: 0, cd: 50 });
  const ligneAtkAstar = buildAstar.find((s) => s.key === 'atk')!;
  ligneAtkAstar.base = 1000;
  const atkAstarNu = statsDeCombat(buildAstar, setupAudit, AUCUNE_AURA_PROPRE, 'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: profilStatsAstar }).atk;
  const atkAstarTouchee = statsDeCombat(buildAstar, {
    ...setupAudit,
    statsCombatActives: { 10612: true },
  }, AUCUNE_AURA_PROPRE, 'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: profilStatsAstar }).atk;
  egal(atkAstarTouchee - atkAstarNu, 1500, 'Astar — +150 % est appliqué à l’ATQ de base, pas à l’ATQ totale');
  egal(
    statsDeCombat(buildAstar, {
      ...setupAudit,
      passifsOffensifs: { 10612: true },
    }, AUCUNE_AURA_PROPRE, 'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: profilStatsAstar }).atk,
    atkAstarNu,
    'Astar — le toggle de dégâts n’active pas son bonus d’ATQ indépendant'
  );

  const ceres = profilDe(14912, 5812);
  const ceresAuSeuil = computeSkillDamage(ceres, buildAudit, { ...setupAudit, enemyHp: 40000 }, AUCUNE_AURA_PROPRE);
  const ceresAuDessus = computeSkillDamage(ceres, buildAudit, { ...setupAudit, enemyHp: 40001 }, AUCUNE_AURA_PROPRE);
  ok(ceresAuDessus > ceresAuSeuil, '51 — Ceres : le seuil de PV actuels est strict');
  const ceresBuildPv = stats({ hp: 30000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 });
  egal(
    computeSkillDamage(ceres, ceresBuildPv, { ...setupAudit, enemyHp: 40001 }, AUCUNE_AURA_PROPRE),
    ceresAuSeuil,
    '51 — Ceres : le seuil est recalculé sur les PV du build candidat'
  );
  const ceresCandidatA = { stats: buildAudit, effTotal: 0 } as unknown as BuildCandidate;
  const ceresCandidatB = {
    stats: stats({ hp: 30000, atk: 1100, def: 800, spd: 200, cr: 25, cd: 100 }),
    effTotal: 0,
  } as unknown as BuildCandidate;
  const ceresContexte = (enemyHp: number): RealDamageContext => ({
    profile: ceres,
    passifs: [],
    setup: { ...setupAudit, enemyHp },
    element: 'fire',
    artefacts: ARTIFACT_DAMAGE_NEUTRE,
    critSiPlusRapide: false,
    bonusDegatsSelonVit: null,
    bonusDegatsStack: null,
    monsterWide: {},
    bonusDegatsConditionnel: null,
    bonusDegatsSelonCr: null,
    bonusDegatsSelonDef: null,
    bonusSiAtqSeuil: null,
  });
  ok(
    objectiveScore(ceresCandidatA, 'degats_reels', AUCUNE_AURA_PROPRE, ceresContexte(40001)) >
      objectiveScore(ceresCandidatB, 'degats_reels', AUCUNE_AURA_PROPRE, ceresContexte(40001)),
    '51 — Optimizer : le build faible en PV gagne seul le bonus de Ceres'
  );
  ok(
    objectiveScore(ceresCandidatB, 'degats_reels', AUCUNE_AURA_PROPRE, ceresContexte(60001)) >
      objectiveScore(ceresCandidatA, 'degats_reels', AUCUNE_AURA_PROPRE, ceresContexte(60001)),
    '51 — Optimizer : classement inversé quand les deux builds franchissent le seuil'
  );

  const kassandraVent = profilDe(27613, 17413);
  const kassandraEgalite = computeSkillDamage(kassandraVent, buildAudit, { ...setupAudit, enemyAtk: 1000 }, AUCUNE_AURA_PROPRE);
  const kassandraSous = computeSkillDamage(kassandraVent, buildAudit, { ...setupAudit, enemyAtk: 999 }, AUCUNE_AURA_PROPRE);
  ok(kassandraSous > kassandraEgalite, '63 — Kassandra vent : l’égalité d’ATQ ne donne aucun bonus');
  const kassandraBuildAtk = stats({ hp: 20000, atk: 1200, def: 800, spd: 200, cr: 25, cd: 100 });
  ok(
    computeSkillDamage(kassandraVent, kassandraBuildAtk, { ...setupAudit, enemyAtk: 1000 }, AUCUNE_AURA_PROPRE) > kassandraEgalite,
    '63 — Kassandra vent : l’ATQ du build candidat déclenche la condition'
  );

  const yujiFeu = profilDe(30412, 20112);
  const yujiDetruit = computeSkillDamage(yujiFeu, buildAudit, { ...setupAudit, enemyHpNotDestroyed: false }, AUCUNE_AURA_PROPRE);
  const yujiIntact = computeSkillDamage(yujiFeu, buildAudit, { ...setupAudit, enemyHpNotDestroyed: true }, AUCUNE_AURA_PROPRE);
  ok(yujiIntact > yujiDetruit, '70 — Yuji : le toggle PV non détruits active le bonus de 50 %');
  egal(
    yujiDetruit,
    computeSkillDamage(yujiFeu, buildAudit, { ...setupAudit, enemyHpNotDestroyed: false, critMode: 'crit' }, AUCUNE_AURA_PROPRE),
    '70 — Yuji : critique garanti même quand le bonus de PV non détruits est inactif'
  );
  const bearHunt = profilDe(10501, 1611);
  ok(critiqueGarantiParReglage(bearHunt, setupAudit), 'UI — Bear Hunt désactive toujours Non critique');
  const nightmare = profilDe(11215, 2215);
  ok(!critiqueGarantiParReglage(nightmare, setupAudit), 'UI — Nightmare ne force pas le critique sans cible endormie');
  ok(
    critiqueGarantiParReglage(nightmare, { ...setupAudit, passifsOffensifs: { 2215: true } }),
    'UI — Nightmare force le critique quand son toggle de sommeil est actif'
  );

  // ⚠️ La borne inclusive se mesure CONTRE UNE DEF NULLE : au seuil, le total
  // égale celui d'une cible sans DEF (la DEF est réellement ignorée), un point
  // au-dessus il lui reste inférieur. L'ancienne forme `seuil > seuil + 1`
  // passait encore quand la borne était devenue stricte, puisqu'une DEF plus
  // basse augmente déjà les dégâts sans aucun ignore (mutation éprouvée).
  const ignoreAuSeuil = (profil: SkillDamageProfile, seuil: number) => {
    const degats = (enemyDef: number) => computeSkillDamage(profil, buildAudit, { ...setupAudit, enemyDef }, AUCUNE_AURA_PROPRE);
    return degats(seuil) === degats(0) && degats(seuil + 1) < degats(0);
  };
  ok(ignoreAuSeuil(profilDe(16533, 7763), 400),
    '204 — Copper : ignore DEF au seuil inclusif de la moitié de sa DEF (total égal à celui d’une DEF nulle)');
  ok(ignoreAuSeuil(profilDe(26112, 15907), 600),
    '205 — Guard Crush : ignore DEF au seuil inclusif de 60 % de son ATQ (total égal à celui d’une DEF nulle)');
  const triss = profilDe(29515, 19215);
  const trissSans = computeSkillDamage(triss, buildAudit, { ...setupAudit, enemyDef: 1200 }, AUCUNE_AURA_PROPRE);
  ok(
    computeSkillDamage(triss, buildAudit, {
      ...setupAudit, enemyDef: 1200, passifsOffensifs: { [triss.skillCom2usId]: true },
    }, AUCUNE_AURA_PROPRE) > trissSans,
    '214 — Triss : un toggle de présence de débuff active l’ignore DEF'
  );
  ok(
    computeSkillDamage(triss, buildAudit, { ...setupAudit, enemyDef: 1200, brand: true }, AUCUNE_AURA_PROPRE) > trissSans,
    '214 — Triss : Marque active automatiquement l’ignore DEF'
  );

  const odin = fiche(22613);
  const odinS1 = profilDe(22613, 13103);
  const odinCondition = monsterConditionsCombat(odin);
  const odinScore = (stacks: number) => computeTotalDamage(
    odinS1, [], buildAudit,
    { ...setupAudit, enemyDef: 1500, stackPersonnalise: { 13113: stacks } },
    AUCUNE_AURA_PROPRE,
    'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null,
    { conditionsCombat: odinCondition }
  );
  ok(odinScore(0) < odinScore(1) && odinScore(1) < odinScore(4) && odinScore(4) < odinScore(5),
    '206 — Odin : ignore DEF croissant puis 100 % à cinq connaissances');
  egal(odinScore(5), odinScore(50), '206 — Odin : connaissances plafonnées à cinq');

  const lexy = fiche(19912);
  const lexyS1 = profilDe(19912, 10702);
  const lexyCondition = monsterConditionsCombat(lexy);
  const lexyScore = (soins: number) => computeTotalDamage(
    lexyS1, [], buildAudit,
    { ...setupAudit, enemyDef: 1500, compteurPersonnalise: { 10712: soins } },
    AUCUNE_AURA_PROPRE,
    'fire', ARTIFACT_DAMAGE_NEUTRE, false, null, null,
    { conditionsCombat: lexyCondition }
  );
  egal(lexyScore(0), lexyScore(4), '207 — Lexy : quatre soins adverses ne déclenchent rien');
  ok(lexyScore(5) > lexyScore(4), '207 — Lexy : ignore DEF après cinq soins adverses');

  const elsharionStats = monsterCombatStatProfiles(fiche(19214));
  const elsharionSetup = (buffsPropres: number, buffsAllies: number): DamageSetup => ({
    ...setupAudit,
    buffsPropresCount: { 10014: buffsPropres },
    buffsAlliesCount: { 10014: buffsAllies },
  });
  const elsharionNu = statsDeCombat(buildAudit, elsharionSetup(0, 0), AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats });
  const elsharionDefBuff = statsDeCombat(buildAudit, { ...elsharionSetup(0, 0), defBuff: true }, AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats });
  ok(elsharionDefBuff.atk > elsharionNu.atk,
    '97 — Elsharion : buff DEF explicite compte comme un buff propre et augmente son ATQ');
  const elsharionPlein = statsDeCombat(buildAudit, elsharionSetup(10, 20), AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats });
  ok(elsharionPlein.atk > elsharionNu.atk && elsharionPlein.spd > elsharionNu.spd,
    '97 — Elsharion : buffs propres et alliés alimentent deux stats distinctes');
  egal(
    statsDeCombat(buildAudit, elsharionSetup(50, 50), AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats }),
    elsharionPlein,
    '97 — Elsharion : deux plafonds indépendants à 10 et 20'
  );
  const geraltStats = monsterCombatStatProfiles(fiche(29215));
  const geraltTrois = statsDeCombat(buildAudit, {
    ...setupAudit, buffsPropresCount: { 18915: 3 },
  }, AUCUNE_AURA_PROPRE, 'dark', ARTIFACT_DAMAGE_NEUTRE, { combatStats: geraltStats });
  const geraltCinq = statsDeCombat(buildAudit, {
    ...setupAudit, buffsPropresCount: { 18915: 3 }, defBuff: true, spdBuff: true,
  }, AUCUNE_AURA_PROPRE, 'dark', ARTIFACT_DAMAGE_NEUTRE, { combatStats: geraltStats });
  egal(geraltCinq.atk, geraltTrois.atk,
    'Geralt : son passif reste plafonné à trois buffs même si le total propre atteint cinq');

  // Gold Headband (`7912`) — curation de l'utilisateur (`docs/02-app/degats-reels/`) :
  // chaque cumul ajoute 20 % de l'ATQ de BASE et 12 % de
  // la VIT de BASE, au plus 10 ; la VIT SANS arrondi, comme l'ATQ :
  // 13,92 par cumul pour une base 116. Les attendus sont
  // écrits en clair, pas recalculés par la formule testée. Bases réelles de
  // monsters.json. L'ancien contrôle, seulement monotone, tournait sur
  // `buildAudit`, dont la base est nulle : il ne pouvait pas voir l'assiette.
  const procheGold = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
  // Comme `egal`, mais à la tolérance du flottant : le reçu n'est imprimé qu'en cas d'échec.
  const apportExact = (recu: [number, number], attendu: [number, number], libelle: string) => {
    const bon = procheGold(recu[0], attendu[0]) && procheGold(recu[1], attendu[1]);
    ok(bon, bon ? libelle : `${libelle} — reçu ${JSON.stringify(recu)}, attendu ${JSON.stringify(attendu)}`);
  };
  const runeGold: RuneDetail = {
    id: 1, slot: 1, set: 'violent', rank: 6, rarity: 5, level: 15,
    main: { code: 3, value: 160 }, subs: [{ code: 4, value: 20 }, { code: 8, value: 20 }],
  };
  const formesGold: [number, string, number, number, [number, number][]][] = [
    // forme, nom, ATQ de base, VIT de base, [apport ATQ, apport VIT] à 1 puis 10 cumuls
    [16812, 'Mei Hou Wang', 692, 116, [[138.4, 13.92], [1384, 139.2]]],
    [16802, 'Monkey King', 659, 100, [[131.8, 12], [1318, 120]]],
  ];
  for (const [forme, nomForme, atkBase, spdBase, [unCumul, dixCumuls]] of formesGold) {
    const monstre = monstersJson().find((m) => m.com2usId === forme);
    const nu = computeStats({ base: monsterBaseStats(monstre), runes: [], artifacts: [] });
    egal([nu.find((s) => s.key === 'atk')?.base, nu.find((s) => s.key === 'spd')?.base], [atkBase, spdBase],
      `89 — Gold Headband ${nomForme} : précondition, ATQ et VIT de base de monsters.json`);
    const goldHeadband = monsterCombatStatProfiles(fiche(forme));
    egal(goldHeadband.map((p) => [p.skillCom2usId, p.source, p.max, p.atkBasePct, p.spdBasePct, p.atkPct, p.spdPct, p.spdFlat]),
      [[7912, 'stacks', 10, 20, 12, undefined, undefined, undefined]],
      `89 — Gold Headband ${nomForme} : 20 % de l'ATQ de base et 12 % de la VIT de base par cumul, 10 cumuls — ni % de combat, ni points`);
    // Apport = stats de combat avec N cumuls − stats de combat sans le passif.
    const apport = (stats: StatRow[], setup: DamageSetup, cumuls: number): [number, number] => {
      const sans = statsDeCombat(stats, setup, AUCUNE_AURA_PROPRE, 'fire', ARTIFACT_DAMAGE_NEUTRE, {});
      const avec = statsDeCombat(stats, { ...setup, stackPersonnalise: { 7912: cumuls } }, AUCUNE_AURA_PROPRE, 'fire',
        ARTIFACT_DAMAGE_NEUTRE, { combatStats: goldHeadband });
      return [avec.atk - sans.atk, avec.spd - sans.spd];
    };
    egal(apport(nu, setupAudit, 0), [0, 0], `89 — Gold Headband ${nomForme} : 0 cumul, aucun apport`);
    apportExact(apport(nu, setupAudit, 1), unCumul,
      `89 — Gold Headband ${nomForme} : 1 cumul = +${unCumul[0]} ATQ et +${unCumul[1]} VIT, sans arrondi`);
    apportExact(apport(nu, setupAudit, 10), dixCumuls,
      `89 — Gold Headband ${nomForme} : 10 cumuls = +${dixCumuls[0]} ATQ et +${dixCumuls[1]} VIT`);
    egal(apport(nu, setupAudit, 11), apport(nu, setupAudit, 10), `89 — Gold Headband ${nomForme} : dix cumuls au maximum`);
    // L'assiette est la BASE : runes, buffs ATQ/VIT, lead et Miriam ne changent pas l'apport.
    const rune = computeStats({ base: monsterBaseStats(monstre), runes: [runeGold], artifacts: [] });
    apportExact(apport(rune, {
      ...setupAudit, atkBuff: true, spdBuff: true, miriamActif: true, leaderSkill: { stat: 'Attack Speed', pct: 24 },
    }, 1), unCumul,
    `89 — Gold Headband ${nomForme} : runes, buffs, lead et Miriam actifs, l'apport d'un cumul reste +${unCumul[0]} ATQ / +${unCumul[1]} VIT`);
  }
  const relevantesMeiHouWang = damageRelevantStats(profilDe(16812, 7902), [], setupAudit, false, null, null, null, false,
    null, null, null, { combatStats: monsterCombatStatProfiles(fiche(16812)) });
  ok(relevantesMeiHouWang.includes('atk') && relevantesMeiHouWang.includes('spd'),
    '89 — Gold Headband : ATQ et VIT restent des stats pertinentes de Mei Hou Wang (`spdBasePct` à parité avec `atkBasePct`)');

  // Rankyaku (`14313`, Chun-Li vent) et Accelerando (`14813`,
  // Cordelia) : « Your Attack Power increases in proportion to the Attack
  // Speed », formule `5*{SPD}` de la donnée. La VIT lue est la VIT FINALE
  // (`docs/02-app/degats-reels/`, confirmation de l'utilisateur) :
  // base + runes + set + lead + effet d'augmentation de vitesse,
  // amplifié par les artéfacts. Profils extraits des données réelles, deux
  // vitesses connues (avec et sans Swift), lead et buff actifs ; attendus
  // calculés À LA MAIN depuis cette définition, jamais par `maVitCombat`, dont
  // c'est la preuve.
  const runeVit = (id: number, slot: number, set: string, main: [number, number], subs: [number, number][]): RuneDetail => ({
    id, slot, set, rank: 6, rarity: 5, level: 15,
    main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })),
  });
  // VIT des runes 93, Swift (4 pièces) +ceil(105 × 25 %) = +27 : fiche 105 + 93 + 27 = 225.
  const runesRapides = [
    runeVit(11, 1, 'violent', [3, 160], [[8, 18]]),
    runeVit(12, 2, 'swift', [8, 42], [[4, 10]]),
    runeVit(13, 3, 'swift', [5, 160], [[8, 12]]),
    runeVit(14, 4, 'swift', [9, 58], [[8, 6]]),
    runeVit(15, 5, 'swift', [1, 2448], [[8, 10]]),
    runeVit(16, 6, 'violent', [4, 63], [[8, 5]]),
  ];
  // VIT des runes 16, aucun set de VIT : fiche 105 + 16 = 121.
  const runesLentes = [
    runeVit(21, 1, 'violent', [3, 160], [[8, 9]]),
    runeVit(22, 2, 'violent', [4, 63], [[2, 10]]),
    runeVit(23, 3, 'violent', [5, 160], [[8, 7]]),
    runeVit(24, 4, 'violent', [9, 58], [[4, 8]]),
    runeVit(25, 5, 'will', [1, 2448], [[3, 20]]),
    runeVit(26, 6, 'will', [4, 63], [[1, 300]]),
  ];
  // « Effet aug. VIT +6 % » (code 206) : amplifie le buff de VIT, jamais la VIT elle-même.
  const artefactVit: ArtifactDetail = {
    id: 31, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5,
    main: { code: 101, value: 100 }, subs: [{ code: 206, value: 6 }],
  };
  const leadVit = { stat: 'Attack Speed' as const, pct: 24 };
  const cransVit: [string, Partial<DamageSetup>, boolean][] = [
    ['compétence d’invocateur seule', {}, false],
    ['+ lead VIT 24 %', { leaderSkill: leadVit }, false],
    ['+ lead + buff de VIT', { leaderSkill: leadVit, spdBuff: true }, false],
    ['+ lead + buff + artéfact « Effet aug. VIT +6 % »', { leaderSkill: leadVit, spdBuff: true }, true],
  ];
  // VIT finale attendue par cran, base 105 : invocateur fiche + ceil(105 × 15 %) = fiche + 16 ;
  // lead fiche + ceil(105 × 39 %) = fiche + 41 ; buff × 1,30 ; artéfact × (1 + 0,30 × 1,06) = × 1,318.
  const vitFinaleAttendue: [RuneDetail[], number, number[]][] = [
    [runesRapides, 225, [241, 266, 345.8, 350.588]],
    [runesLentes, 121, [137, 162, 210.6, 213.516]],
  ];
  const formesRankyaku: [number, number, string, number][] = [
    [24413, 14313, 'Chun-Li (Rankyaku)', 14303],
    [24913, 14813, 'Cordelia (Accelerando)', 14803],
  ];
  for (const [forme, sortId, nomForme, s1Id] of formesRankyaku) {
    const profils = monsterCombatStatProfiles(fiche(forme));
    egal(profils.map((p) => [p.skillCom2usId, p.source, p.atkDepuisSpd]), [[sortId, 'toujours', 5]],
      `110 — ${nomForme} : profil ${sortId} extrait des données, 5 × VIT, toujours actif`);
    egal(fiche(forme).competences.find((c) => c.com2usId === sortId)?.formule, '5*{SPD}',
      `110 — ${nomForme} : la donnée SWARFARM porte bien \`5*{SPD}\``);
    const monstre = monstersJson().find((m) => m.com2usId === forme);
    egal(monstre.stats.speed, 105, `110 — ${nomForme} : précondition, VIT de base 105 (monsters.json)`);
    for (const [runes, vitFiche, attendus] of vitFinaleAttendue) {
      egal(computeStats({ base: monsterBaseStats(monstre), runes, artifacts: [] }).find((s) => s.key === 'spd')?.total, vitFiche,
        `110 — ${nomForme} : précondition, VIT de fiche ${vitFiche} (base + runes + set)`);
      cransVit.forEach(([cran, reglage, avecArtefact], i) => {
        const gear = { base: monsterBaseStats(monstre), runes, artifacts: avecArtefact ? [artefactVit] : [] };
        const stats = computeStats(gear);
        const artefacts = artifactDamageProfile(gear.artifacts);
        const setup = { ...setupAudit, ...reglage };
        const sans = statsDeCombat(stats, setup, AUCUNE_AURA_PROPRE, 'wind', artefacts, {});
        const avec = statsDeCombat(stats, setup, AUCUNE_AURA_PROPRE, 'wind', artefacts, { combatStats: profils });
        const attendu = 5 * attendus[i];
        const apportAtk = avec.atk - sans.atk;
        const bon = procheGold(apportAtk, attendu);
        ok(bon, `110 — ${nomForme}, fiche ${vitFiche} VIT, ${cran} : ATQ + 5 × ${attendus[i]} = +${Number(attendu.toFixed(6))}${bon ? '' : ` — reçu ${apportAtk}`}`);
      });
    }
    // Bout en bout : le S1 (3,8 × ATQ, DEF adverse nulle, sans critique) suit
    // l'ATQ augmentée de 5 × VIT finale — `computeTotalDamage` lit la même ATQ.
    const gear = { base: monsterBaseStats(monstre), runes: runesRapides, artifacts: [artefactVit] };
    const stats = computeStats(gear);
    const artefacts = artifactDamageProfile(gear.artifacts);
    const setup = { ...setupAudit, leaderSkill: leadVit, spdBuff: true };
    const s1 = profilDe(forme, s1Id);
    const atkSans = statsDeCombat(stats, setup, AUCUNE_AURA_PROPRE, 'wind', artefacts, {}).atk;
    const degatsSans = computeTotalDamage(s1, [], stats, setup, AUCUNE_AURA_PROPRE, 'wind', artefacts, false, null, null, {});
    const degatsAvec = computeTotalDamage(s1, [], stats, setup, AUCUNE_AURA_PROPRE, 'wind', artefacts, false, null, null,
      { combatStats: profils });
    const degatsAttendus = (degatsSans * (atkSans + 5 * 350.588)) / atkSans;
    const bonBout = procheGold(degatsAvec, degatsAttendus);
    ok(bonBout, `110 — ${nomForme} : dégâts du S1 = ceux sans le passif × (ATQ + 5 × 350,588) / ATQ, lead et buff actifs${bonBout ? '' : ` — reçu ${degatsAvec}, attendu ${degatsAttendus}`}`);
  }

  const berserkMonstre = fiche(18811);
  const berserkS1 = profilDe(18811, 9601);
  const berserkConditions = monsterConditionsCombat(berserkMonstre);
  const berserkStats = monsterCombatStatProfiles(berserkMonstre);
  const berserkWide = { conditionsCombat: berserkConditions, combatStats: berserkStats };
  const berserkNu = computeTotalDamage(berserkS1, [], buildAudit, { ...setupAudit, enemyDef: 500 }, AUCUNE_AURA_PROPRE, 'water', ARTIFACT_DAMAGE_NEUTRE, false, null, null, berserkWide);
  const berserkActifSetup = { ...setupAudit, enemyDef: 500, passifsOffensifs: { 9611: true } };
  const berserkActif = computeTotalDamage(berserkS1, [], buildAudit, berserkActifSetup, AUCUNE_AURA_PROPRE, 'water', ARTIFACT_DAMAGE_NEUTRE, false, null, null, berserkWide);
  ok(berserkActif > berserkNu, '116 — Berserk : état préalable double les dégâts du S1');
  const statsBerserkNu = statsDeCombat(buildAudit, setupAudit, AUCUNE_AURA_PROPRE, 'water', ARTIFACT_DAMAGE_NEUTRE, berserkWide);
  const statsBerserkActif = statsDeCombat(buildAudit, berserkActifSetup, AUCUNE_AURA_PROPRE, 'water', ARTIFACT_DAMAGE_NEUTRE, berserkWide);
  ok(statsBerserkActif.spd > statsBerserkNu.spd && statsBerserkActif.def < statsBerserkNu.def,
    '116 — Berserk : VIT +20 %, DEF −30 % seulement quand l’état est actif');

  const dyeus = fiche(28314);
  const dyeusS1 = profilDe(28314, 18124);
  const dyeusWide = { conditionsCombat: monsterConditionsCombat(dyeus), combatStats: monsterCombatStatProfiles(dyeus) };
  // Les trois cas ci-dessous éprouvaient le critique forcé « en mode
  // Moyenne », supprimé : convertis en « Non
  // critique », le seul mode restant où un critique forcé change le calcul.
  const dyeusSetup = { ...setupAudit, critMode: 'normal' as const };
  const dyeusSans = computeTotalDamage(dyeusS1, [], buildAudit, dyeusSetup, AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null, dyeusWide);
  const dyeusActifSetup = { ...dyeusSetup, passifsOffensifs: { 18139: true } };
  const dyeusActif = computeTotalDamage(dyeusS1, [], buildAudit, dyeusActifSetup, AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null, dyeusWide);
  ok(dyeusActif > dyeusSans, '268 — Dyeus : Thunderer force le critique en mode Non critique');
  egal(dyeusActif, computeTotalDamage(dyeusS1, [], buildAudit, { ...dyeusActifSetup, critMode: 'crit' }, AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null, dyeusWide),
    '268 — Dyeus : critique déjà forcé quand le mode Critique est choisi');

  const toma = profilDe(18711, 9511);
  const tomaSetup = { ...setupAudit, critMode: 'normal' as const, enemyDef: 0 };
  egal(computeSkillDamage(toma, buildAudit, { ...tomaSetup, defBreak: true }, AUCUNE_AURA_PROPRE),
    computeSkillDamage(toma, buildAudit, { ...tomaSetup, defBreak: true, critMode: 'crit' }, AUCUNE_AURA_PROPRE),
    '244 — Toma : Brise DEF force le critique même en mode Non critique');
  ok(computeSkillDamage(toma, buildAudit, tomaSetup, AUCUNE_AURA_PROPRE) < computeSkillDamage(toma, buildAudit, { ...tomaSetup, defBreak: true }, AUCUNE_AURA_PROPRE),
    '244 — Toma : sans Brise DEF, le critique n’est pas garanti');
  const squall = profilDe(14611, 4206);
  egal(computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 199, critMode: 'normal' }, AUCUNE_AURA_PROPRE),
    computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 199, critMode: 'crit' }, AUCUNE_AURA_PROPRE),
    '246 — Squall : VIT propre strictement supérieure force le critique');
  ok(computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 200, critMode: 'normal' }, AUCUNE_AURA_PROPRE) <
    computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 200, critMode: 'crit' }, AUCUNE_AURA_PROPRE),
    '246 — Squall : égalité de VIT ne force pas le critique');

  const ignoreAleatoire = profilDe(15811, 3311);
  const ignoreSansProc = computeSkillDamage(ignoreAleatoire, buildAudit, { ...setupAudit, enemyDef: 1000 }, AUCUNE_AURA_PROPRE);
  const ignoreAvecProc = computeSkillDamage(ignoreAleatoire, buildAudit, {
    ...setupAudit, enemyDef: 1000, passifsOffensifs: { [ignoreAleatoire.skillCom2usId]: true },
  }, AUCUNE_AURA_PROPRE);
  ok(ignoreAvecProc > ignoreSansProc, '200 — ignore DEF aléatoire : proc activé explicitement, jamais implicite');

  const recette = buildOptimizerRecipe({
    monsterCom2usId: 14713,
    monsterName: 'Argen',
    requirement: { sets: [], minStats: {} },
    objective: 'degats_reels',
    damageSetup: {
      ...setupAudit,
      skillCom2usId: argen.skillCom2usId,
      scenariosEffetsEntreCoups: {
        [argen.skillCom2usId]: { actif: true, apresCoup: { brand: 1 } },
      },
      statsCombatActives: { 10612: true },
      buffsAlliesCount: { 10014: 4 },
      atkDebuff: true,
    },
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
  const relue = parseOptimizerRecipe(JSON.stringify(recette)).recipe;
  egal(relue?.damageSetup, recette.damageSetup, 'UI/recette : le scénario survit à l’export/import');
  const contexteCli = buildRealDamageContext(recette, 14713, []);
  ok(contexteCli != null, 'CLI : le contexte de dégâts réels est reconstruit');
  egal(
    objectiveScore(candidatAtk, 'degats_reels', AUCUNE_AURA_PROPRE, contexteCli!),
    computeTotalDamage(argen, [], candidatAtk.stats, recette.damageSetup!, AUCUNE_AURA_PROPRE, 'wind'),
    'UI/CLI : même recette, même score conditionnel'
  );
  const recetteKassandra = {
    ...recette,
    monsterCom2usId: 27613,
    monsterName: 'Kassandra',
    damageSetup: {
      ...setupAudit, skillCom2usId: 17408, buffsPropresCountAutres: true,
      buffsPropresCount: { 17408: 2 }, defBuff: true,
    },
  };
  const contexteKassandra = buildRealDamageContext(recetteKassandra, 27613, []);
  ok(contexteKassandra != null, 'CLI : le contexte Kassandra avec buffs propres est reconstruit');
  egal(parseOptimizerRecipe(JSON.stringify(recetteKassandra)).recipe?.damageSetup, recetteKassandra.damageSetup,
    'recette récente : le marqueur autres buffs propres traverse l’export/import');
  egal(resolvedBuffsPropresCount(17408, contexteKassandra!.setup), 3,
    'CLI : la recette conserve deux autres buffs et le buff DEF actif');
  egal(
    objectiveScore(candidatAtk, 'degats_reels', AUCUNE_AURA_PROPRE, contexteKassandra!),
    computeTotalDamage(profilDe(27613, 17408), [], candidatAtk.stats, recetteKassandra.damageSetup, AUCUNE_AURA_PROPRE, 'wind'),
    'UI/CLI : même score Kassandra avec buffs propres ajoutés automatiquement'
  );

  // Le helper est celui des trois évaluateurs d'artéfacts de l'écran ET du
  // CLI. Guillaume rend l'omission de `monsterWide` observable : son passif
  // ajoute 100 points de Dgts Crit à tous ses sorts.
  const recetteGuillaume = {
    ...recette,
    monsterCom2usId: 14115,
    monsterName: 'Guillaume',
    damageSetup: { ...setupAudit, skillCom2usId: null, critMode: 'crit' as const },
  };
  const contexteGuillaume = buildRealDamageContext(recetteGuillaume, 14115, []);
  ok(contexteGuillaume != null, 'CLI : le contexte complet de Guillaume est reconstruit');
  const { artefacts: _artefactsGuillaume, ...contexteArtefactsGuillaume } = contexteGuillaume!;
  const scoreArtefactsEcranCli = evaluerPourRegime('degats_reels', () => candidatAtk.stats, AUCUNE_AURA_PROPRE, contexteArtefactsGuillaume)([]);
  egal(
    scoreArtefactsEcranCli,
    objectiveScore(candidatAtk, 'degats_reels', AUCUNE_AURA_PROPRE, contexteGuillaume!),
    'artefacts écran/CLI et moteur : même score avec le contexte monstre-wide complet'
  );
  ok(
    scoreArtefactsEcranCli >
      evaluerPourRegime('degats_reels', () => candidatAtk.stats, AUCUNE_AURA_PROPRE, {
        ...contexteArtefactsGuillaume,
        monsterWide: {},
      })([]),
    'témoin différentiel : retirer le +100 DC monstre-wide change bien le score de Guillaume'
  );

  const ancienneRecette = JSON.parse(JSON.stringify(recette));
  delete ancienneRecette.damageSetup.scenariosEffetsEntreCoups;
  delete ancienneRecette.damageSetup.buffsCibleCount;
  delete ancienneRecette.damageSetup.buffsPropresCount;
  delete ancienneRecette.damageSetup.buffsPropresCountAutres;
  delete ancienneRecette.damageSetup.statsCombatActives;
  delete ancienneRecette.damageSetup.buffsAlliesCount;
  delete ancienneRecette.damageSetup.atkDebuff;
  delete ancienneRecette.damageSetup.effetsCibleCountAutres;
  const ancienneRelue = parseOptimizerRecipe(JSON.stringify(ancienneRecette)).recipe;
  ok(ancienneRelue?.damageSetup != null, 'ancienne recette sans nouveaux champs toujours lisible');
  ok(!ancienneRelue?.damageSetup?.scenariosEffetsEntreCoups, 'ancienne recette : aucun scénario implicite');
  egal(ancienneRelue?.damageSetup?.buffsPropresCountAutres, undefined,
    'ancienne recette : l’absence du marqueur conserve le compteur inclusif');
  const ancienneKassandra = JSON.parse(JSON.stringify(recetteKassandra));
  delete ancienneKassandra.damageSetup.buffsPropresCountAutres;
  const ancienneKassandraRelue = parseOptimizerRecipe(JSON.stringify(ancienneKassandra)).recipe;
  egal(resolvedBuffsPropresCount(17408, ancienneKassandraRelue!.damageSetup!), 2,
    'ancienne recette Kassandra : buff DEF déjà inclus dans le total de deux');
  const ancienCompteur = { ...setupAudit, effetsCibleCountAutres: undefined, effetsCibleCount: { 6907: 2 }, defBreak: true };
  egal(resolvedDebuffsCibleCount(6907, ancienCompteur), 2,
    'ancienne recette : son total de débuffs incluait déjà Brise DEF, sans double comptage');
  const ancienScenario = {
    ...setupAudit,
    effetsCibleCountAutres: undefined,
    effetsCibleCount: { [argen.skillCom2usId]: 1 },
    scenariosEffetsEntreCoups: {
      [argen.skillCom2usId]: { actif: true, apresCoup: { brand: 1 } },
    },
  };
  egal(
    computeSkillDamage(argen, buildAudit, ancienScenario, AUCUNE_AURA_PROPRE),
    computeSkillDamage(argen, buildAudit, { ...ancienScenario, effetsCibleCountAutres: true }, AUCUNE_AURA_PROPRE),
    'ancienne recette : une Marque posée entre les coups ajoute bien un nouveau débuff'
  );
  const recetteAvantDegats = JSON.parse(JSON.stringify(recette));
  delete recetteAvantDegats.damageSetup;
  ok(parseOptimizerRecipe(JSON.stringify(recetteAvantDegats)).recipe != null, 'recette antérieure au réglage de dégâts toujours lisible');
  const recetteObjectifLegacy = { ...recetteAvantDegats, objective: 'speed_nuker' };
  ok(parseOptimizerRecipe(JSON.stringify(recetteObjectifLegacy)).recipe != null, 'ancien objectif speed_nuker accepté pour migration');
  const recetteArtefactLegacy = { ...recetteAvantDegats, artifactMainByKind: { element: 'none' } };
  ok(parseOptimizerRecipe(JSON.stringify(recetteArtefactLegacy)).recipe != null, 'ancien choix d’artéfact none accepté pour migration');

  const verifierRefus = (path: string, modifier: (copie: any) => void) => {
    const copie = JSON.parse(JSON.stringify(recette));
    modifier(copie);
    const resultat = parseOptimizerRecipe(JSON.stringify(copie));
    ok(resultat.recipe == null, `recette invalide refusée : ${path}`);
    ok(resultat.error?.includes(path) === true, `erreur lisible et localisée : ${path}`);
  };
  verifierRefus('objective', (r) => { r.objective = 'inconnu'; });
  verifierRefus('metric', (r) => { r.metric = 42; });
  verifierRefus('requirement.sets', (r) => { r.requirement.sets = ['set-inconnu']; });
  verifierRefus('requirement.sets', (r) => { r.requirement.sets = ['violent', 'rage']; });
  verifierRefus('requirement.minStats.atk', (r) => { r.requirement.minStats.atk = 'beaucoup'; });
  verifierRefus('requirement.mainStats.2', (r) => { r.requirement.mainStats = { 2: [10] }; });
  verifierRefus('artifactMainByKind.element', (r) => { r.artifactMainByKind = { element: 999 }; });
  verifierRefus('lignesVerrouillees.0', (r) => { r.lignesVerrouillees = [{ code: 'brand', min: 4 }]; });
  verifierRefus('damageSetup.buffsCibleCount', (r) => { r.damageSetup.buffsCibleCount = []; });
  verifierRefus('damageSetup.aliveEnemies', (r) => { r.damageSetup.aliveEnemies = 5; });
  verifierRefus('damageSetup.enemyHpNotDestroyed', (r) => { r.damageSetup.enemyHpNotDestroyed = 'oui'; });
  verifierRefus('damageSetup.buffsPropresCount.6513', (r) => { r.damageSetup.buffsPropresCount = { 6513: -1 }; });
  verifierRefus('damageSetup.buffsPropresCountAutres', (r) => { r.damageSetup.buffsPropresCountAutres = 'oui'; });
  verifierRefus('damageSetup.statsCombatActives.10612', (r) => { r.damageSetup.statsCombatActives = { 10612: 1 }; });
  verifierRefus('damageSetup.buffsAlliesCount.10014', (r) => { r.damageSetup.buffsAlliesCount = { 10014: -1 }; });
  verifierRefus('damageSetup.atkDebuff', (r) => { r.damageSetup.atkDebuff = 'oui'; });
  verifierRefus('damageSetup.effetsCibleCountAutres', (r) => { r.damageSetup.effetsCibleCountAutres = 'oui'; });
  verifierRefus('damageSetup.scenariosEffetsEntreCoups.6513.actif', (r) => {
    r.damageSetup.scenariosEffetsEntreCoups = { 6513: { actif: 'oui' } };
  });
  verifierRefus('damageSetup.scenariosEffetsEntreCoups.6513.presentsInitialement', (r) => {
    r.damageSetup.scenariosEffetsEntreCoups = { 6513: { presentsInitialement: ['brand', 12] } };
  });
  verifierRefus('damageSetup.scenariosEffetsEntreCoups.6513.apresCoup.brand', (r) => {
    r.damageSetup.scenariosEffetsEntreCoups = { 6513: { apresCoup: { brand: 0 } } };
  });

  testClesStatsCombatParId();
  testHomonymesParIdentifiant();
  testEffetsEntreCoups322();
  testSuiteDuSortVoitLesPosesP4b();
}

// Une contribution qui SUIT le sort (passif qui frappe
// après lui, attaque appelée, Tempest) lit l'état de la cible après le dernier
// coup du sort, poses du scénario comprises ; un passif qui ACCOMPAGNE chaque
// coup (`coupsDuSortActif`, Feng Yan) garde sa lecture coup par coup ; sans
// scénario, rien ne change. Les quatre formes jouables qui ont à la fois une
// contribution post-sort et un sort à effet posable :
// Sia, Dominic, Benedict (suivent), Feng Yan (accompagne).
// Chemin de production : recette → `buildRealDamageContext` → `objectiveScore`.
// Montage des témoins : ATQ 1 000, DEF cible 1 500, non critique.
function testSuiteDuSortVoitLesPosesP4b() {
  titre('Les coups qui suivent le sort voient les effets qu’il a posés');

  const cible: DamageSetup = { ...setupAudit, enemyDef: 1500 };
  const candidat = { stats: buildAudit, effTotal: 0 } as unknown as BuildCandidate;
  const contexte = (forme: number, setup: DamageSetup): RealDamageContext => {
    const passifsOn = Object.fromEntries(monsterOffensivePassives(fiche(forme)).map((p) => [p.skillCom2usId, true]));
    const recette = buildOptimizerRecipe({
      monsterCom2usId: forme,
      monsterName: String(forme),
      requirement: { sets: [], minStats: {} },
      objective: 'degats_reels',
      damageSetup: { ...setup, passifsOffensifs: passifsOn },
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
    return ctx;
  };
  const score = (forme: number, setup: DamageSetup, sansPassifs = false) => {
    const ctx = contexte(forme, setup);
    return objectiveScore(candidat, 'degats_reels', AUCUNE_AURA_PROPRE, sansPassifs ? { ...ctx, passifs: [] } : ctx);
  };
  const pose = (sort: number, effet: string, apresCoup?: number): Partial<DamageSetup> => ({
    scenariosEffetsEntreCoups: { [sort]: { actif: true, ...(apresCoup ? { apresCoup: { [effet]: apresCoup } } : {}) } },
  });
  const arrondi = (x: number, n: number) => Math.round(x * 10 ** n) / 10 ** n;

  // Sia — Blackout Kick (3454) pose sa réduction de DEF au coup 1 (note
  // « First hit ») ; Great Friends (2 coups par défaut) frappe après le sort.
  const sia = { ...cible, skillCom2usId: 3454 };
  const siaSans = score(12134, sia);
  egal(arrondi(siaSans, 4), 1292.3077, 'Sia : sans scénario, total inchangé (témoin)');
  egal(score(12134, { ...sia, ...pose(3454, 'decrease-def') }), siaSans, 'Sia : scénario actif sans réussite, total inchangé');
  const siaPose = score(12134, { ...sia, ...pose(3454, 'decrease-def', 1) });
  const sortSans = score(12134, sia, true);
  const sortPose = score(12134, { ...sia, ...pose(3454, 'decrease-def', 1) }, true);
  egal(arrondi(sortPose / sortSans, 3), 1.682, 'Sia : la part de Blackout Kick, posée après le coup 1, vaut ×1,682 (coup 2 seul sous la réduction)');
  // La part de Great Friends sous la réduction de DEF, mesurée par le réglage
  // manuel « réduction déjà présente » (qui existe indépendamment du scénario).
  const passifBrise = score(12134, { ...sia, defBreak: true }) - score(12134, { ...sia, defBreak: true }, true);
  ok(
    Math.abs(siaPose - (sortPose + passifBrise)) < 1e-6,
    'Sia : posée après le coup 1, Great Friends frappe entièrement sous la réduction (sort ×1,682 + passif réduit)'
  );
  ok(siaPose > sortPose + (siaSans - sortSans), 'Sia : le passif ne garde plus l’état d’avant la pose (ancienne lecture, ×1,429)');
  egal(arrondi(siaPose / siaSans, 3), 1.935, 'Sia : total posé après le coup 1 = ×1,935 (sort ×1,682, passif ×2,364)');

  // Feng Yan — Winds and Clouds ACCOMPAGNE chaque coup de Sequential Attack
  // (12003) : lecture coup par coup inchangée (mêmes totaux que sans scénario).
  const feng = { ...cible, skillCom2usId: 12003 };
  egal(arrondi(score(21213, feng), 4), 1547.5385, 'Feng Yan : sans scénario, total inchangé');
  egal(arrondi(score(21213, { ...feng, ...pose(12003, 'decrease-def', 1) }), 4), 2954.9238, 'Feng Yan : posée après le coup 1, total inchangé (×1,909)');
  egal(arrondi(score(21213, { ...feng, ...pose(12003, 'decrease-def', 2) }), 4), 2251.2311, 'Feng Yan : posée après le coup 2, total inchangé (×1,455)');

  // Dominic (Improvisation) et Benedict (Final Strike) — la Marque de Weakness
  // Shot (coup 1) majore aussi la contribution qui suit le sort.
  for (const [forme, sort, sans, ratio, nom] of [
    [25713, 15508, 3979.0517, 1.225, 'Dominic'],
    [25714, 15509, 3050.1551, 1.218, 'Benedict'],
  ] as const) {
    const s = { ...cible, skillCom2usId: sort };
    const total = score(forme, s);
    egal(arrondi(total, 4), sans, `${nom} : sans scénario, total inchangé`);
    const avec = score(forme, { ...s, ...pose(sort, 'brand', 1) });
    const ancienne = score(forme, { ...s, ...pose(sort, 'brand', 1) }, true) + (total - score(forme, s, true));
    ok(avec > ancienne, `${nom} : le passif voit la Marque posée après le coup 1`);
    egal(arrondi(avec / total, 3), ratio, `${nom} : total, Marque posée après le coup 1 = ×${String(ratio).replace('.', ',')}`);
  }
}

// Treize sorts dont la donnée
// pose un `Decrease DEF` ou une `Brand` sur un coup précis sont curés PAR
// IDENTIFIANT dans `EFFETS_ENTRE_COUPS_PAR_ID_CONNUS`, jamais par nom : un
// nom (« Blackout Kick ») a des homonymes au texte différent. Chaque entrée a
// son test : l'effet de la donnée, aucun changement sans scénario, et la pose
// après le coup qui la fait réellement (coup 1, sauf Cichlid : coup 2) vaut
// « les coups d'avant sans l'effet, les suivants avec ». Les ratios sont
// ceux d'une sonde du chemin de production (DEF cible 1 500, ATQ 1 000, non critique).
function testEffetsEntreCoups322() {
  titre('Effets posés entre les coups, par identifiant');

  // [forme jouable, sort, effet de la donnée, effetCombat, coup poseur, ratio « posé après le coup poseur »]
  const entrees: [number, number, string, 'defBreak' | 'brand', number, number][] = [
    [19613, 10413, 'decrease-def', 'defBreak', 2, 1.455], // Cichlid — « the second attack decreases the Defense »
    [21913, 12608, 'decrease-def', 'defBreak', 1, 1.682], // Melissa — note « First hit only »
    [23511, 13606, 'decrease-def', 'defBreak', 1, 1.682], // Barbara — « The beast's attack decreases the enemy's Defense »
    [23512, 13607, 'decrease-def', 'defBreak', 1, 1.682], // Masha
    [23515, 13610, 'decrease-def', 'defBreak', 1, 1.682], // Xiana
    [25712, 15507, 'brand', 'brand', 1, 1.188], // Carlos — « leave a Branding effect … attacks 3 more times »
    [25713, 15508, 'brand', 'brand', 1, 1.188], // Dominic
    [25714, 15509, 'brand', 'brand', 1, 1.188], // Benedict
    [27712, 17507, 'brand', 'brand', 1, 1.125], // Eivor — note « 1st hit »
    [27714, 17509, 'brand', 'brand', 1, 1.125], // Eivor
    [12134, 3454, 'decrease-def', 'defBreak', 1, 1.682], // Sia — note « First hit »
    [36011, 25206, 'decrease-def', 'defBreak', 1, 1.682], // Übel — note « 1st hit », en zone
    [36015, 25210, 'decrease-def', 'defBreak', 1, 1.682], // Übel
  ];
  const cible = { ...setupAudit, enemyDef: 1500 };
  const total = (p: SkillDamageProfile, setup: DamageSetup) => computeSkillDamage(p, buildAudit, setup, AUCUNE_AURA_PROPRE);

  for (const [forme, sort, effet, effetCombat, poseur, ratio] of entrees) {
    const p = profilDe(forme, sort);
    const nom = `${p.nom} ${sort}`;
    const coups = p.hits;
    egal(p.effetsEntreCoups?.length, 1, `${nom} : un seul effet curé (Brise DEF ou Marque, rien d'autre)`);
    egal(p.effetsEntreCoups?.[0]?.id, effet, `${nom} : effet de la donnée`);
    egal(p.effetsEntreCoups?.[0]?.effetCombat, effetCombat, `${nom} : change l'état de la cible (${effetCombat})`);
    ok(coups > 1, `${nom} : sort à plusieurs coups`);

    const sans = total(p, cible);
    const scenario = (apresCoup?: number): DamageSetup => ({
      ...cible,
      scenariosEffetsEntreCoups: { [sort]: { actif: true, ...(apresCoup ? { apresCoup: { [effet]: apresCoup } } : {}) } },
    });
    egal(total(p, scenario()), sans, `${nom} : scénario actif sans réussite, total inchangé`);
    const initial = total(p, { ...cible, ...(effetCombat === 'brand' ? { brand: true } : { defBreak: true }) });
    ok(initial > sans, `${nom} : l'effet présent dès le coup 1 majore le total (témoin)`);

    const apres = total(p, scenario(poseur));
    ok(apres > sans && apres < initial, `${nom} : posé après le coup ${poseur}, entre sans effet et effet dès le coup 1`);
    // Weakness Shot : la formule lit les PV actuels de la cible, qui baissent
    // coup par coup — les coups ne sont pas égaux, l'égalité linéaire ne vaut
    // pas ; le ratio ci-dessous le fige à la place.
    if (!p.variables.includes('Target Current HP %')) {
      ok(
        Math.abs(apres - (poseur * sans + (coups - poseur) * initial) / coups) < 1e-6,
        `${nom} : posé après le coup ${poseur} = ${poseur} coup(s) sans l'effet, ${coups - poseur} avec`
      );
    }
    egal(Math.round((apres / sans) * 1000) / 1000, ratio, `${nom} : total posé après le coup ${poseur} = ×${ratio} (sonde de la preuve)`);
  }

  // Les homonymes ne reçoivent rien : 3454 « Blackout Kick » est curé par
  // identifiant, ses homonymes (autre texte) restent sans effet curé.
  const blackout = new Set<number>();
  for (const f of readdirSync(dossierSorts)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8'));
    for (const c of d.competences) if (c.nom === 'Blackout Kick' && c.com2usId != null && c.com2usId !== 3454) blackout.add(c.com2usId);
  }
  ok(blackout.size > 0, 'témoin : des homonymes « Blackout Kick » existent dans le corpus');
  for (const f of readdirSync(dossierSorts)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8'));
    for (const p of monsterDamageSkills(d)) {
      if (estPrisEnCharge(p) && p.nom === 'Blackout Kick' && blackout.has(p.skillCom2usId)) {
        ok(!p.effetsEntreCoups?.length, `Blackout Kick ${p.skillCom2usId} (forme ${d.com2usId}) : aucun effet entre les coups par homonymie`);
      }
    }
  }
}

// Deux noms de passif qui
// débordaient sur un homonyme sont passés par identifiant : l'effet reste sur
// la forme jouable qui le porte (témoin de non-régression), et les homonymes
// qui ne la jouent pas ne l'ont plus. Aucune valeur de jeu n'est touchée.
function testHomonymesParIdentifiant() {
  titre('Homonymes par nom — Tiger’s Appearance et Charge passent par identifiant');

  // Tiger's Appearance : 6163 (Naomi 2A, jouable) garde +20 %/débuff et la garantie ;
  // 6113 (Naomi 1A, « 25 % Critical Chance », pas une garantie) et 6178 (Martial
  // Cat 2A générique) ne l'ont plus.
  const naomi = monsterBonusParEffetCible(fiche(15033));
  egal(naomi?.skillCom2usId, 6163, 'Naomi 2A (15033) : Tiger’s Appearance = 6163');
  egal(naomi?.pct, 20, 'Naomi 2A : +20 % par effet nocif');
  egal(naomi?.critiqueGarantiSiPresent, true, 'Naomi 2A : critique garanti si un effet nocif est présent');
  for (const [forme, id] of [[15003, 6113], [15013, 6113], [47603, 6178]] as const) {
    ok(fiche(forme).competences.some((c) => c.com2usId === id), `témoin : la forme ${forme} porte ${id}`);
    egal(monsterBonusParEffetCible(fiche(forme)), null, `${forme} (${id}, homonyme non jouable) : plus de bonus par effet nocif ni de garantie`);
  }

  // Charge (Passive) : 1865 (Gorgo 2A) garde +20 points de TC ; 1880 (Warbear 2A générique) non.
  egal(monsterBonusStatFixe(fiche(10735)), { cr: 20, cd: 0 }, 'Gorgo (10735, 1865) : +20 points de TC, aucun point de DC');
  ok(fiche(47305).competences.some((c) => c.com2usId === 1880 && c.nom === 'Charge (Passive)'), 'témoin : 47305 porte 1880, « Charge (Passive) »');
  egal(monsterBonusStatFixe(fiche(47305)), null, 'Warbear 2A (47305, 1880, homonyme non jouable) : plus de bonus de TC');
  ok(monsterModificateursVit(fiche(47305)).every((m) => m.skillCom2usId !== 1880), '1880 : plus affiché parmi les modificateurs toujours actifs');
  ok(monsterModificateursVit(fiche(10735)).some((m) => m.skillCom2usId === 1865), '1865 : toujours affiché pour Gorgo');
}

// La table `STATS_COMBAT_PAR_ID_CONNUS` est écrite à
// la main, par identifiant : une clé mal recopiée, orpheline, ou posée sur une
// forme que personne ne joue n'échouait nulle part (aucun test ne la lisait).
// Ce test garde des IDENTIFIANTS ; il ne dit rien des valeurs.
function testClesStatsCombatParId() {
  titre('Stats de combat par identifiant — chaque clé est un identifiant du corpus porté par au moins une forme jouable');

  const jouables = new Set<number>();
  for (const m of formesJouables(monstersJson())) if (m.com2usId != null) jouables.add(m.com2usId);
  const formesParId = new Map<number, number[]>();
  for (const f of readdirSync(dossierSorts)) {
    if (!f.endsWith('.json')) continue;
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8'));
    for (const c of d.competences) {
      if (c.com2usId != null) formesParId.set(c.com2usId, [...(formesParId.get(c.com2usId) ?? []), d.com2usId]);
    }
  }

  const cles = idsStatsCombatConnus();
  ok(cles.length > 0, 'la table est lisible et non vide');
  ok(jouables.size > 0, 'témoin : le filtre des formes jouables en laisse');
  for (const id of cles) {
    const formes = formesParId.get(id) ?? [];
    ok(formes.length > 0, `${id} : identifiant présent dans public/data/skills`);
    ok(formes.some((f) => jouables.has(f)), `${id} : porté par au moins une forme jouable (parmi ${formes.join(', ') || 'aucune'})`);
  }
}
