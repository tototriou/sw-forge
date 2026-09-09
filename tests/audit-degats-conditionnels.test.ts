import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  BonusDegatsConditionnelProfile,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  computeTotalDamage,
  damageRelevantStats,
  estPrisEnCharge,
  monsterBonusDegatsConditionnel,
  monsterBonusDegatsStackable,
  monsterBonusParEffetCible,
  monsterBonusStatFixe,
  monsterConditionsCombat,
  monsterCritInterdit,
  monsterDamageSkills,
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
  summonerSkills: 'aucune',
};

export default function testAuditDegatsConditionnels() {
  titre('Audit des dégâts conditionnels — étape 1');

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
    'Gouge',
    'Gust',
    'Mach Crush',
    'Panda Supremacy',
    'Rain of Stones',
    'Shadow Blade',
    'Shinryuken',
    'Triple Crush',
    'Water Dragon Attack',
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
    [19712, 10502, 'aucunDebuffPropre'],
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

  for (const [monstreId, sortId] of [
    [31311, 21006],
    [31315, 21010],
  ]) {
    const profile = monsterDamageSkills(fiche(monstreId)).find((p) => p.skillCom2usId === sortId);
    ok(profile != null && !estPrisEnCharge(profile), `${monstreId}/${sortId} : formule ATQ importée explicitement refusée`);
  }

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
  const ancienneRelue = parseOptimizerRecipe(JSON.stringify(ancienneRecette)).recipe;
  ok(ancienneRelue?.damageSetup != null, 'ancienne recette sans nouveaux champs toujours lisible');
  ok(!ancienneRelue?.damageSetup?.scenariosEffetsEntreCoups, 'ancienne recette : aucun scénario implicite');
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
  verifierRefus('damageSetup.buffsPropresCount.6513', (r) => { r.damageSetup.buffsPropresCount = { 6513: -1 }; });
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
