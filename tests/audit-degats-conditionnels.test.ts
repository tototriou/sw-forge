import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import {
  ARTIFACT_DAMAGE_NEUTRE,
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
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsStackable,
  monsterBonusParEffetCible,
  monsterBonusStatFixe,
  monsterCombatStatProfiles,
  monsterConditionsCombat,
  monsterCritInterdit,
  monsterDamageSkills,
  monsterOffensivePassives,
  resolvedBuffsPropresCount,
  resolvedBuffCiblePresent,
  resolvedDebuffsCibleCount,
  resolvedDebuffCiblePresent,
  statsDeCombat,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BuildCandidate, RealDamageContext, objectiveScore } from '../src/lib/runeBuildOptim';
import { StatKey } from '../src/lib/effects';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

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
  const leoNormal = computeSkillDamage(leoTorrent, buildAudit, { ...setupAudit, enemyDef: 1000 });
  const leoSous30 = computeSkillDamage(leoTorrent, buildAudit, {
    ...setupAudit,
    enemyDef: 1000,
    passifsOffensifs: { 7808: true },
  });
  egal(leoTorrent.formule, '5.5*{ATK}', '72 — Torrent ne varie plus proportionnellement avec les PV propres');
  ok(leoSous30 > leoNormal, '72 — le toggle sous 30 % active l’ignore-DÉF de Torrent');

  const zerath = profilDe(14414, 2914);
  const zerath20k = computeSkillDamage(zerath, buildAudit, { ...setupAudit, ownHpPct: 50 });
  const zerath40k = computeSkillDamage(zerath, stats({ ...Object.fromEntries(buildAudit.map((s) => [s.key, s.total])), hp: 40000 }), {
    ...setupAudit,
    ownHpPct: 50,
  });
  egal(zerath40k, zerath20k * 2, '73 — les PV actuels de Zerath sont recalculés pour chaque build candidat');

  const ramagos = profilDe(10733, 1863);
  egal(
    computeSkillDamage(ramagos, buildAudit, { ...setupAudit, ownHpPct: 50 }),
    10000,
    '74 — Clean Shot inflige exactement les PV propres manquants en dégâts fixes'
  );

  const skogul = profilDe(22413, 13008);
  const trasar = profilDe(22415, 13010);
  egal(
    computeSkillDamage(skogul, buildAudit, { ...setupAudit, aliveEnemies: 4 }),
    5000,
    '77 — Atlas Stone répartit les PV max entre les ennemis vivants'
  );
  egal(
    computeSkillDamage(trasar, buildAudit, {
      ...setupAudit,
      aliveEnemies: 4,
      stackPersonnalise: { 13010: 2 },
    }),
    6500,
    '308 — Trasar ajoute 15 % par mort, plafonné à 30 %, sur son Atlas Stone'
  );
  egal(
    computeSkillDamage(skogul, buildAudit, {
      ...setupAudit,
      aliveEnemies: 4,
      stackPersonnalise: { 13010: 2 },
    }),
    5000,
    '308 — le compteur de Trasar ne majore ni Skogul ni son autre identifiant'
  );

  const lamiella = profilDe(31311, 21006);
  egal(lamiella.formule, '1.2*{ATK}', 'Lamiella — la composante 1,2 × ATQ reste présente');
  ok(!!lamiella.composanteFixeAdditionnelle, 'Lamiella — la réserve de Sacrifice est une composante fixe séparée');
  const lamiellaSansReserve = computeSkillDamage(lamiella, buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3 });
  const lamiellaAvecReserve = computeSkillDamage(lamiella, buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3 });
  egal(lamiellaAvecReserve - lamiellaSansReserve, 4000, 'Lamiella — réserve linéaire de PV max répartie entre trois ennemis');
  ok(
    computeSkillDamage(lamiella, buildAudit, { ...setupAudit, sacrificeReservePct: 0, critMode: 'crit' }) > lamiellaSansReserve,
    'Lamiella — la composante ATQ peut infliger un coup critique'
  );

  const velaska = profilDe(31315, 21010);
  egal(velaska.formule, '{MAX HP}*{Sacrifice Reserve %}/{Alive Enemies} (Fixed)', 'Velaska — la formule est entièrement fixe');
  egal(
    computeSkillDamage(velaska, buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3 }),
    4000,
    'Velaska — réserve linéaire de PV max répartie entre trois ennemis'
  );
  egal(
    computeSkillDamage(skogul, buildAudit, { ...setupAudit, aliveEnemies: 99 }),
    5000,
    'ennemis vivants — le moteur plafonne les recettes éditées à la main à quatre'
  );
  const skogulBase = computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4 }, 'wind');
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, mirinaeActif: true }, 'wind'),
    skogulBase,
    'Skogul — Mirinae ne majore pas Atlas Stone'
  );
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, velaskaActif: true, velaskaPvPerduPct: 100 }, 'wind'),
    skogulBase,
    'Skogul — le passif de Velaska ne majore pas Atlas Stone'
  );
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, brand: true }, 'wind'),
    skogulBase * 1.25,
    'Skogul — la Marque reste compatible avec Atlas Stone'
  );
  const artefactFeu20 = { ...ARTIFACT_DAMAGE_NEUTRE, degatsElementPct: { fire: 20 } };
  egal(
    computeTotalDamage(skogul, [], buildAudit, { ...setupAudit, aliveEnemies: 4, enemyElement: 'fire' }, 'wind', artefactFeu20),
    skogulBase * 1.2,
    'Skogul — les dégâts élémentaires d’artéfact majorent Atlas Stone'
  );
  egal(
    computeTotalDamage(velaska, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, enemyElement: 'fire' }, 'dark', artefactFeu20),
    4000,
    'Velaska — les dégâts élémentaires d’artéfact ne majorent pas la réserve'
  );
  const lamiellaMirinae0 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3, mirinaeActif: true }, 'water');
  const lamiellaMirinae60 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, mirinaeActif: true }, 'water');
  egal(lamiellaMirinae60 - lamiellaMirinae0, 4000, 'Lamiella — Mirinae ne majore que la partie ATQ');
  const lamiellaVelaska0 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3, velaskaActif: true, velaskaPvPerduPct: 100 }, 'water');
  const lamiellaVelaska60 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, velaskaActif: true, velaskaPvPerduPct: 100 }, 'water');
  ok(
    Math.abs(lamiellaVelaska60 - lamiellaVelaska0 - 4000) < 1e-9,
    'Lamiella — Price of Pain ne majore que la partie ATQ'
  );
  const lamiellaBrand0 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 0, aliveEnemies: 3, brand: true }, 'water');
  const lamiellaBrand60 = computeTotalDamage(lamiella, [], buildAudit, { ...setupAudit, sacrificeReservePct: 60, aliveEnemies: 3, brand: true }, 'water');
  egal(lamiellaBrand60 - lamiellaBrand0, 5000, 'Lamiella — la Marque majore aussi la réserve fixe');
  const moLong = profilDe(21211, 12011);
  const moLongBase = computeTotalDamage(moLong, [], buildAudit, { ...setupAudit, enemyElement: 'fire' }, 'water');
  egal(
    computeTotalDamage(moLong, [], buildAudit, { ...setupAudit, enemyElement: 'fire' }, 'water', artefactFeu20),
    moLongBase * 1.2,
    'Mo Long — les dégâts élémentaires d’artéfact majorent Reckless Assault'
  );

  const hwa = profilDe(15512, 6907);
  egal(resolvedDebuffsCibleCount(hwa.skillCom2usId, { ...setupAudit, effetsCibleCount: { 6907: 9 }, defBreak: true, brand: true }), 10,
    'compteur ennemi — autres débuffs + Brise DEF + Marque sont plafonnés à 10');
  const hwaAutres = computeSkillDamage(hwa, buildAudit, { ...setupAudit, effetsCibleCount: { 6907: 1 } });
  const hwaAvecEffets = computeSkillDamage(hwa, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { 6907: 1 },
    defBreak: true,
    brand: true,
  });
  ok(hwaAvecEffets > hwaAutres, 'Hwa S2 — Brise DEF et Marque incrémentent automatiquement le compteur de débuffs');
  const brandiaMixte = profilDe(18912, 9712);
  ok(
    computeSkillDamage(brandiaMixte, buildAudit, {
      ...setupAudit, effetsCibleCount: { 9712: 10 }, brand: true,
    }) > computeSkillDamage(brandiaMixte, buildAudit, {
      ...setupAudit, effetsCibleCount: { 9712: 10 },
    }),
    'Brandia — dix effets mixtes peuvent compter une Marque en plus ; seul le compteur des débuffs est plafonné'
  );

  const tesaS2 = profilDe(19212, 10007);
  const passifTesa = monsterBonusParEffetCible(fiche(19212))!;
  const totalTesa = (setup: DamageSetup) => computeTotalDamage(
    tesaS2,
    [],
    buildAudit,
    setup,
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
    manannanS1, [], buildAudit, setup, 'dark', ARTIFACT_DAMAGE_NEUTRE, false, null, null,
    { bonusParEffetCible: passifManannan }
  );
  const manannanToggle = { ...setupAudit, passifsOffensifs: { [passifManannan.skillCom2usId]: true } };
  ok(totalManannan(manannanToggle) > totalManannan(setupAudit), 'Manannan — le toggle binaire active King of the Ruins');
  ok(totalManannan({ ...setupAudit, brand: true }) > totalManannan(setupAudit), 'Manannan — Marque active automatiquement King of the Ruins');

  const arangS3 = profilDe(11213, 2213);
  const arangNu = computeSkillDamage(arangS3, buildAudit, setupAudit, 'wind');
  ok(
    computeSkillDamage(arangS3, buildAudit, {
      ...setupAudit,
      passifsOffensifs: { [arangS3.skillCom2usId]: true },
    }, 'wind') > arangNu,
    'Arang — Sweet Talk utilise un toggle binaire, pas un compteur'
  );
  ok(
    computeSkillDamage(arangS3, buildAudit, { ...setupAudit, defBreak: true }, 'wind') > arangNu,
    'Arang — Brise DEF active automatiquement le bonus binaire de Sweet Talk'
  );

  const willOWisp = profilDe(11213, 2218);
  const willBase = computeSkillDamage(willOWisp, buildAudit, setupAudit, 'wind');
  const willPose = (hit: number) => computeSkillDamage(willOWisp, buildAudit, {
    ...setupAudit,
    scenariosEffetsEntreCoups: {
      [willOWisp.skillCom2usId]: { actif: true, apresCoup: { brand: hit } },
    },
  }, 'wind');
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
    return computeTotalDamage(fengS1, passifsFeng, buildAudit, setup, 'wind') -
      computeTotalDamage(fengS1, [], buildAudit, setup, 'wind');
  };
  ok(
    contributionFeng() < contributionFeng(2) && contributionFeng(2) < contributionFeng(1),
    'Feng Yan — chaque instance de Winds and Clouds lit le Brise DEF avant le coup correspondant'
  );

  // Référence indépendante : sans DEF, critique ni skillup, le quotient des
  // totaux est le multiplicateur annoncé, sans dépendre du moteur de recherche.
  const kroS2 = profilDe(11035, 2060);
  const kroNu = computeSkillDamage(kroS2, buildAudit, setupAudit);
  const kroDeux = computeSkillDamage(kroS2, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { [kroS2.skillCom2usId]: 2 },
  });
  ok(Math.abs(kroDeux / kroNu - 1.4) < 1e-9, 'Kro S2 : +20 % par débuff sur ses dégâts propres');

  const akhamamir = profilDe(19213, 10013);
  const akhaNu = computeSkillDamage(akhamamir, buildAudit, setupAudit);
  const akhaUn = computeSkillDamage(akhamamir, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { [akhamamir.skillCom2usId]: 1 },
  });
  const akhaDeux = computeSkillDamage(akhamamir, buildAudit, {
    ...setupAudit,
    effetsCibleCount: { [akhamamir.skillCom2usId]: 2 },
  });
  ok(Math.abs(akhaUn / akhaNu - 1.5) < 1e-9, 'Akhamamir : exactement un débuff vaut +50 %');
  ok(Math.abs(akhaDeux / akhaNu - 1.6) < 1e-9, 'Akhamamir : deux débuffs valent +30 % chacun');
  const akhaPoseApresUn = computeSkillDamage(akhamamir, buildAudit, {
    ...setupAudit,
    scenariosEffetsEntreCoups: {
      [akhamamir.skillCom2usId]: { actif: true, apresCoup: { unrecoverable: 1 } },
    },
  });
  ok(Math.abs(akhaPoseApresUn / akhaNu - 1.25) < 1e-9, 'Akhamamir : le seuil exactement-un est recalculé pour le coup 2');

  // Aucune réussite, pose après le coup 2, pose après le coup 1 : le coup qui
  // pose l'effet lit toujours l'état antérieur, seuls les suivants en profitent.
  const argen = profilDe(14713, 6513);
  const argenBase = computeSkillDamage(argen, buildAudit, setupAudit);
  const argenApres = (hit: number) =>
    computeSkillDamage(argen, buildAudit, {
      ...setupAudit,
      scenariosEffetsEntreCoups: {
        [argen.skillCom2usId]: { actif: true, apresCoup: { brand: hit } },
      },
    });
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
    }),
    computeSkillDamage(argen, buildAudit, argenMarqueInitiale),
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
  });
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
    }),
    computeSkillDamage(ken, buildAudit, kenInitial),
    'KEN : Marque initiale active dès le premier coup et non recomptée à la pose'
  );
  ok(
    computeSkillDamage(ken, buildAudit, {
      ...setupAudit,
      scenariosEffetsEntreCoups: { [ken.skillCom2usId]: { actif: true, apresCoup: { brand: 1 } } },
    }) > computeSkillDamage(ken, buildAudit, setupAudit),
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
    }) > computeSkillDamage(fullBurst, buildAudit, fullBurstInitial),
    'un DoT réussi s’ajoute même si un DoT existe déjà'
  );

  const cecilia = profilDe(34011, 23311);
  const ceciliaSetup = { ...setupAudit, enemyDef: 1500 };
  const ceciliaNu = computeSkillDamage(cecilia, buildAudit, ceciliaSetup);
  const ceciliaApres = (hit: number) =>
    computeSkillDamage(cecilia, buildAudit, {
      ...ceciliaSetup,
      scenariosEffetsEntreCoups: {
        [cecilia.skillCom2usId]: { actif: true, apresCoup: { 'decrease-def': hit } },
      },
    });
  ok(ceciliaNu < ceciliaApres(2) && ceciliaApres(2) < ceciliaApres(1), 'Cecilia : la DEF change après le coup choisi');

  // Le relevé exhaustif des profils éligibles est figé. Une nouvelle entrée
  // exige une décision de curation, jamais une inclusion par ressemblance.
  const effetsEntreCoupsAttendus = new Set([
    'Arcane Burst',
    'Chain Attack',
    'Death Blow',
    'Full Burst',
    'Ghost Slash',
    'Gouge',
    'Gust',
    'Mach Crush',
    'Panda Supremacy',
    'Rain of Stones',
    'Sequential Attack',
    'Shadow Blade',
    'Shinryuken',
    'Triple Crush',
    'Water Dragon Attack',
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
    computeSkillDamage(baekdu, buildAudit, { ...setupAudit, enemySpd: 100 }) !==
      computeSkillDamage(baekdu, buildAudit, { ...setupAudit, enemySpd: 200 }),
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
    egal(computeSkillDamage(grogen, buildAudit, nonCrit, 'dark'), computeSkillDamage(sansBonus, buildAudit, nonCrit, 'dark'),
      `Grogen ${sortId} : les points de DC ne changent pas un coup non critique`);
    ok(computeSkillDamage(grogen, buildAudit, crit, 'dark') > computeSkillDamage(sansBonus, buildAudit, crit, 'dark'),
      `Grogen ${sortId} : les ${points} points de DC augmentent réellement les dégâts critiques`);
    egal(Math.round(computeSkillDamage(grogen, buildAudit, crit, 'dark') - computeSkillDamage(sansBonus, buildAudit, crit, 'dark')),
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
    computeTotalDamage(profile, [], buildAudit, setup, null, undefined, false, null, null, {}, bonus);
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
  const ghostSansPose = computeSkillDamage(fuukiS1, buildAudit, cibleOnimusha, 'wind');
  const ghostPoseApresPremier = computeSkillDamage(fuukiS1, buildAudit, {
    ...cibleOnimusha,
    scenariosEffetsEntreCoups: { [fuukiS1.skillCom2usId]: { actif: true, apresCoup: { 'decrease-def': 1 } } },
  }, 'wind');
  const ghostBreakInitial = computeSkillDamage(fuukiS1, buildAudit, { ...cibleOnimusha, defBreak: true }, 'wind');
  ok(ghostSansPose < ghostPoseApresPremier && ghostPoseApresPremier < ghostBreakInitial,
    'Ghost Slash : une pose au premier hit ne majore que le second');
  egal(Math.round(ghostPoseApresPremier), Math.round((ghostSansPose + ghostBreakInitial) / 2),
    'Ghost Slash : le scénario vaut un hit sans Brise DEF puis un hit avec');
  ok(!fuukiS1.fixed, 'Onimusha : dégâts ordinaires, pas dégâts fixes');
  const sansCritOnimusha = { critInterdit: monsterCritInterdit(fuuki) };
  egal(
    computeTotalDamage(fuukiS1, [], buildAudit, { ...setupAudit, critMode: 'crit' }, 'wind', undefined, false, null, null, sansCritOnimusha),
    computeTotalDamage(fuukiS1, [], buildAudit, { ...setupAudit, critMode: 'normal' }, 'wind', undefined, false, null, null, sansCritOnimusha),
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
    objectiveScore(candidatCd, 'degats_reels', contexteFuuki(false)) >
      objectiveScore(candidatAtk, 'degats_reels', contexteFuuki(false)),
    'contrôle : critique permis, le build DC gagne'
  );
  ok(
    objectiveScore(candidatAtk, 'degats_reels', contexteFuuki(true)) >
      objectiveScore(candidatCd, 'degats_reels', contexteFuuki(true)),
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
    const nu = computeSkillDamage(profile, buildAudit, setupAudit);
    const avecDefBuff = computeSkillDamage(profile, buildAudit, { ...setupAudit, defBuff: true });
    ok(Math.abs(avecDefBuff / nu - 1.05) < 1e-9,
      `${monstreId}/${sortId} : le buff DEF seul apporte +5 % au S2 sans modifier l'ATQ`);
  }
  for (const [monstreId, sortId] of [[33413, 22713], [33913, 23213]]) {
    const profile = profilDe(monstreId, sortId);
    const nu = computeSkillDamage(profile, buildAudit, setupAudit);
    const avecDefBuff = computeSkillDamage(profile, buildAudit, { ...setupAudit, defBuff: true });
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
    computeTotalDamage(naomiS1, [], buildAudit, setupNaomi, 'wind', undefined, false, null, null, {
      bonusParEffetCible: bonusNaomi,
    }),
    computeTotalDamage(naomiS1, [], buildAudit, { ...setupNaomi, critMode: 'crit' }, 'wind', undefined, false, null, null, {
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
    computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'wind' }, 'water'),
    computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'wind', critMode: 'crit' }, 'water'),
    'Kassandra eau : la cible Vent force le critique en mode Normal'
  );
  ok(
    computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'wind' }, 'water') >
      computeSkillDamage(kassandraEau, buildAudit, { ...setupAudit, enemyElement: 'fire' }, 'water'),
    'Kassandra eau : le +100 % dépend bien de l’élément de la cible'
  );
  const storm = profilDe(18911, 9706);
  egal(
    computeSkillDamage(storm, buildAudit, setupAudit, 'water'),
    computeSkillDamage(storm, buildAudit, { ...setupAudit, critMode: 'crit' }, 'water'),
    'Storm of Midnight : aucun buff adverse force le critique'
  );
  ok(
    computeSkillDamage(storm, buildAudit, { ...setupAudit, buffsCibleCount: { [storm.skillCom2usId]: 1 } }, 'water') <
      computeSkillDamage(storm, buildAudit, setupAudit, 'water'),
    'Storm of Midnight : un buff adverse retire le critique garanti'
  );
  for (const [monstreId, sortId] of [[18911, 9706], [18913, 9708], [18915, 9710]] as const) {
    const s2 = profilDe(monstreId, sortId);
    ok(s2.conditionsCombat?.some((condition) => condition.type === 'aucunBuffCible' && condition.critiqueGaranti) === true,
      `${monstreId} Storm of Midnight : aucun buff adverse garantit le critique`);
    ok(computeSkillDamage(s2, buildAudit, setupAudit, 'water') >
      computeSkillDamage(s2, buildAudit, { ...setupAudit, buffsCibleCount: { [sortId]: 1 } }, 'water'),
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
    computeSkillDamage(bella, buildAudit, { ...setupAudit, stackPersonnalise: { [bella.skillCom2usId]: 10 } }),
    computeSkillDamage(bella, buildAudit, {
      ...setupAudit,
      critMode: 'crit',
      stackPersonnalise: { [bella.skillCom2usId]: 10 },
    }),
    'Bella : dix charges forcent réellement le critique'
  );
  ok(
    computeSkillDamage(bella, buildAudit, { ...setupAudit, stackPersonnalise: { [bella.skillCom2usId]: 10 } }) >
      computeSkillDamage(bella, buildAudit, { ...setupAudit, stackPersonnalise: { [bella.skillCom2usId]: 9 } }),
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
    ok(computeSkillDamage(sort, buildAudit, un, 'wind') > computeSkillDamage(sort, buildAudit, zero, 'wind'),
      `${sort.nom} : un seul buff active le bonus`);
    egal(computeSkillDamage(sort, buildAudit, un, 'wind'), computeSkillDamage(sort, buildAudit, dix, 'wind'),
      `${sort.nom} : dix buffs ne renforcent pas le bonus binaire`);
  }

  const powerSurge = profilDe(19712, 10502);
  const powerNu = computeSkillDamage(powerSurge, buildAudit, setupAudit, 'fire');
  const powerToggle = computeSkillDamage(powerSurge, buildAudit, {
    ...setupAudit,
    passifsOffensifs: { [powerSurge.skillCom2usId]: true },
  }, 'fire');
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
  const atkAstarNu = statsDeCombat(buildAstar, setupAudit, 'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: profilStatsAstar }).atk;
  const atkAstarTouchee = statsDeCombat(buildAstar, {
    ...setupAudit,
    statsCombatActives: { 10612: true },
  }, 'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: profilStatsAstar }).atk;
  egal(atkAstarTouchee - atkAstarNu, 1500, 'Astar — +150 % est appliqué à l’ATQ de base, pas à l’ATQ totale');
  egal(
    statsDeCombat(buildAstar, {
      ...setupAudit,
      passifsOffensifs: { 10612: true },
    }, 'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: profilStatsAstar }).atk,
    atkAstarNu,
    'Astar — le toggle de dégâts n’active pas son bonus d’ATQ indépendant'
  );

  const ceres = profilDe(14912, 5812);
  const ceresAuSeuil = computeSkillDamage(ceres, buildAudit, { ...setupAudit, enemyHp: 40000 });
  const ceresAuDessus = computeSkillDamage(ceres, buildAudit, { ...setupAudit, enemyHp: 40001 });
  ok(ceresAuDessus > ceresAuSeuil, '51 — Ceres : le seuil de PV actuels est strict');
  const ceresBuildPv = stats({ hp: 30000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 });
  egal(
    computeSkillDamage(ceres, ceresBuildPv, { ...setupAudit, enemyHp: 40001 }),
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
    objectiveScore(ceresCandidatA, 'degats_reels', ceresContexte(40001)) >
      objectiveScore(ceresCandidatB, 'degats_reels', ceresContexte(40001)),
    '51 — Optimizer : le build faible en PV gagne seul le bonus de Ceres'
  );
  ok(
    objectiveScore(ceresCandidatB, 'degats_reels', ceresContexte(60001)) >
      objectiveScore(ceresCandidatA, 'degats_reels', ceresContexte(60001)),
    '51 — Optimizer : classement inversé quand les deux builds franchissent le seuil'
  );

  const kassandraVent = profilDe(27613, 17413);
  const kassandraEgalite = computeSkillDamage(kassandraVent, buildAudit, { ...setupAudit, enemyAtk: 1000 });
  const kassandraSous = computeSkillDamage(kassandraVent, buildAudit, { ...setupAudit, enemyAtk: 999 });
  ok(kassandraSous > kassandraEgalite, '63 — Kassandra vent : l’égalité d’ATQ ne donne aucun bonus');
  const kassandraBuildAtk = stats({ hp: 20000, atk: 1200, def: 800, spd: 200, cr: 25, cd: 100 });
  ok(
    computeSkillDamage(kassandraVent, kassandraBuildAtk, { ...setupAudit, enemyAtk: 1000 }) > kassandraEgalite,
    '63 — Kassandra vent : l’ATQ du build candidat déclenche la condition'
  );

  const yujiFeu = profilDe(30412, 20112);
  const yujiDetruit = computeSkillDamage(yujiFeu, buildAudit, { ...setupAudit, enemyHpNotDestroyed: false });
  const yujiIntact = computeSkillDamage(yujiFeu, buildAudit, { ...setupAudit, enemyHpNotDestroyed: true });
  ok(yujiIntact > yujiDetruit, '70 — Yuji : le toggle PV non détruits active le bonus de 50 %');
  egal(
    yujiDetruit,
    computeSkillDamage(yujiFeu, buildAudit, { ...setupAudit, enemyHpNotDestroyed: false, critMode: 'crit' }),
    '70 — Yuji : critique garanti même quand le bonus de PV non détruits est inactif'
  );
  const bearHunt = profilDe(10501, 1611);
  ok(critiqueGarantiParReglage(bearHunt, setupAudit), 'UI — Bear Hunt désactive toujours Non critique et Moyenne');
  const nightmare = profilDe(11215, 2215);
  ok(!critiqueGarantiParReglage(nightmare, setupAudit), 'UI — Nightmare ne force pas le critique sans cible endormie');
  ok(
    critiqueGarantiParReglage(nightmare, { ...setupAudit, passifsOffensifs: { 2215: true } }),
    'UI — Nightmare force le critique quand son toggle de sommeil est actif'
  );

  const copper = profilDe(16533, 7763);
  ok(
    computeSkillDamage(copper, buildAudit, { ...setupAudit, enemyDef: 400 }) >
      computeSkillDamage(copper, buildAudit, { ...setupAudit, enemyDef: 401 }),
    '204 — Copper : ignore DEF au seuil inclusif de la moitié de sa DEF'
  );
  const guardCrush = profilDe(26112, 15907);
  ok(
    computeSkillDamage(guardCrush, buildAudit, { ...setupAudit, enemyDef: 600 }) >
      computeSkillDamage(guardCrush, buildAudit, { ...setupAudit, enemyDef: 601 }),
    '205 — Guard Crush : ignore DEF au seuil inclusif de 60 % de son ATQ'
  );
  const triss = profilDe(29515, 19215);
  const trissSans = computeSkillDamage(triss, buildAudit, { ...setupAudit, enemyDef: 1200 });
  ok(
    computeSkillDamage(triss, buildAudit, {
      ...setupAudit, enemyDef: 1200, passifsOffensifs: { [triss.skillCom2usId]: true },
    }) > trissSans,
    '209 — Triss : un toggle de présence de débuff active l’ignore DEF'
  );
  ok(
    computeSkillDamage(triss, buildAudit, { ...setupAudit, enemyDef: 1200, brand: true }) > trissSans,
    '209 — Triss : Marque active automatiquement l’ignore DEF'
  );

  const odin = fiche(22613);
  const odinS1 = profilDe(22613, 13103);
  const odinCondition = monsterConditionsCombat(odin);
  const odinScore = (stacks: number) => computeTotalDamage(
    odinS1, [], buildAudit,
    { ...setupAudit, enemyDef: 1500, stackPersonnalise: { 13113: stacks } },
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
  const elsharionNu = statsDeCombat(buildAudit, elsharionSetup(0, 0), 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats });
  const elsharionDefBuff = statsDeCombat(buildAudit, { ...elsharionSetup(0, 0), defBuff: true }, 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats });
  ok(elsharionDefBuff.atk > elsharionNu.atk,
    '96 — Elsharion : buff DEF explicite compte comme un buff propre et augmente son ATQ');
  const elsharionPlein = statsDeCombat(buildAudit, elsharionSetup(10, 20), 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats });
  ok(elsharionPlein.atk > elsharionNu.atk && elsharionPlein.spd > elsharionNu.spd,
    '96 — Elsharion : buffs propres et alliés alimentent deux stats distinctes');
  egal(
    statsDeCombat(buildAudit, elsharionSetup(50, 50), 'light', ARTIFACT_DAMAGE_NEUTRE, { combatStats: elsharionStats }),
    elsharionPlein,
    '96 — Elsharion : deux plafonds indépendants à 10 et 20'
  );
  const geraltStats = monsterCombatStatProfiles(fiche(29215));
  const geraltTrois = statsDeCombat(buildAudit, {
    ...setupAudit, buffsPropresCount: { 18915: 3 },
  }, 'dark', ARTIFACT_DAMAGE_NEUTRE, { combatStats: geraltStats });
  const geraltCinq = statsDeCombat(buildAudit, {
    ...setupAudit, buffsPropresCount: { 18915: 3 }, defBuff: true, spdBuff: true,
  }, 'dark', ARTIFACT_DAMAGE_NEUTRE, { combatStats: geraltStats });
  egal(geraltCinq.atk, geraltTrois.atk,
    'Geralt : son passif reste plafonné à trois buffs même si le total propre atteint cinq');

  const goldHeadband = monsterCombatStatProfiles(fiche(16812));
  const goldStats = (stacks: number) => statsDeCombat(
    buildAudit, { ...setupAudit, stackPersonnalise: { 7912: stacks } },
    'fire', ARTIFACT_DAMAGE_NEUTRE, { combatStats: goldHeadband }
  );
  ok(goldStats(10).atk > goldStats(0).atk && goldStats(10).spd > goldStats(0).spd,
    '89 — Gold Headband : ATQ et VIT progressent avec les charges');
  egal(goldStats(11), goldStats(10), '89 — Gold Headband : dix charges au maximum');

  const berserkMonstre = fiche(18811);
  const berserkS1 = profilDe(18811, 9601);
  const berserkConditions = monsterConditionsCombat(berserkMonstre);
  const berserkStats = monsterCombatStatProfiles(berserkMonstre);
  const berserkWide = { conditionsCombat: berserkConditions, combatStats: berserkStats };
  const berserkNu = computeTotalDamage(berserkS1, [], buildAudit, { ...setupAudit, enemyDef: 500 }, 'water', ARTIFACT_DAMAGE_NEUTRE, false, null, null, berserkWide);
  const berserkActifSetup = { ...setupAudit, enemyDef: 500, passifsOffensifs: { 9611: true } };
  const berserkActif = computeTotalDamage(berserkS1, [], buildAudit, berserkActifSetup, 'water', ARTIFACT_DAMAGE_NEUTRE, false, null, null, berserkWide);
  ok(berserkActif > berserkNu, '116 — Berserk : état préalable double les dégâts du S1');
  const statsBerserkNu = statsDeCombat(buildAudit, setupAudit, 'water', ARTIFACT_DAMAGE_NEUTRE, berserkWide);
  const statsBerserkActif = statsDeCombat(buildAudit, berserkActifSetup, 'water', ARTIFACT_DAMAGE_NEUTRE, berserkWide);
  ok(statsBerserkActif.spd > statsBerserkNu.spd && statsBerserkActif.def < statsBerserkNu.def,
    '116 — Berserk : VIT +20 %, DEF −30 % seulement quand l’état est actif');

  const dyeus = fiche(28314);
  const dyeusS1 = profilDe(28314, 18124);
  const dyeusWide = { conditionsCombat: monsterConditionsCombat(dyeus), combatStats: monsterCombatStatProfiles(dyeus) };
  const dyeusSetup = { ...setupAudit, critMode: 'moyenne' as const };
  const dyeusSans = computeTotalDamage(dyeusS1, [], buildAudit, dyeusSetup, 'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null, dyeusWide);
  const dyeusActifSetup = { ...dyeusSetup, passifsOffensifs: { 18139: true } };
  const dyeusActif = computeTotalDamage(dyeusS1, [], buildAudit, dyeusActifSetup, 'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null, dyeusWide);
  ok(dyeusActif > dyeusSans, '268 — Dyeus : Thunderer force le critique en mode Moyenne');
  egal(dyeusActif, computeTotalDamage(dyeusS1, [], buildAudit, { ...dyeusActifSetup, critMode: 'crit' }, 'light', ARTIFACT_DAMAGE_NEUTRE, false, null, null, dyeusWide),
    '268 — Dyeus : critique déjà forcé quand le mode Critique est choisi');

  const toma = profilDe(18711, 9511);
  const tomaSetup = { ...setupAudit, critMode: 'moyenne' as const, enemyDef: 0 };
  egal(computeSkillDamage(toma, buildAudit, { ...tomaSetup, defBreak: true }),
    computeSkillDamage(toma, buildAudit, { ...tomaSetup, defBreak: true, critMode: 'crit' }),
    '244 — Toma : Brise DEF force le critique même en mode Moyenne');
  ok(computeSkillDamage(toma, buildAudit, tomaSetup) < computeSkillDamage(toma, buildAudit, { ...tomaSetup, defBreak: true }),
    '244 — Toma : sans Brise DEF, le critique n’est pas garanti');
  const squall = profilDe(14611, 4206);
  egal(computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 199, critMode: 'moyenne' }),
    computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 199, critMode: 'crit' }),
    '246 — Squall : VIT propre strictement supérieure force le critique');
  ok(computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 200, critMode: 'moyenne' }) <
    computeSkillDamage(squall, buildAudit, { ...setupAudit, enemySpd: 200, critMode: 'crit' }),
    '246 — Squall : égalité de VIT ne force pas le critique');

  const ignoreAleatoire = profilDe(15811, 3311);
  const ignoreSansProc = computeSkillDamage(ignoreAleatoire, buildAudit, { ...setupAudit, enemyDef: 1000 });
  const ignoreAvecProc = computeSkillDamage(ignoreAleatoire, buildAudit, {
    ...setupAudit, enemyDef: 1000, passifsOffensifs: { [ignoreAleatoire.skillCom2usId]: true },
  });
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
    objectiveScore(candidatAtk, 'degats_reels', contexteCli!),
    computeTotalDamage(argen, [], candidatAtk.stats, recette.damageSetup!, 'wind'),
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
    objectiveScore(candidatAtk, 'degats_reels', contexteKassandra!),
    computeTotalDamage(profilDe(27613, 17408), [], candidatAtk.stats, recetteKassandra.damageSetup, 'wind'),
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
  const scoreArtefactsEcranCli = evaluerPourRegime('degats_reels', () => candidatAtk.stats, contexteArtefactsGuillaume)([]);
  egal(
    scoreArtefactsEcranCli,
    objectiveScore(candidatAtk, 'degats_reels', contexteGuillaume!),
    'artefacts écran/CLI et moteur : même score avec le contexte monstre-wide complet'
  );
  ok(
    scoreArtefactsEcranCli >
      evaluerPourRegime('degats_reels', () => candidatAtk.stats, {
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
    computeSkillDamage(argen, buildAudit, ancienScenario),
    computeSkillDamage(argen, buildAudit, { ...ancienScenario, effetsCibleCountAutres: true }),
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
}
