// Blade Surge — propagation de la cible calculée (`cibleDegatsParSort`) :
// recette, écran, CLI (chantier degats-et-aura, lot 8b ; le calcul est celui
// du lot 8a, vérifié par `testDegatsBladeSurge`).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : une recette qui laisse passer une
// cible inconnue ou un cran posé sur un sort sans coup de zone curé — le
// calcul retomberait en silence sur la cible visée, et l'export suivant
// propagerait la clé fautive —, une recette qui perd le choix à l'aller-retour,
// ou un choix qui survit à un changement d'espèce.

import { egal, ok, titre } from './outils';
import {
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  type SkillDamageProfile,
  cibleDegatsRetenue,
  monsterDamageSkills,
  resolveDamageSkill,
} from '../src/lib/damage';
import { damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadMonsterSkills } from '../scripts/lib/skillsData';

const LAPIS = 19811;
const BLADE_SURGE_LAPIS = 10616;
// Les deux autres sorts actifs de Lapis : un sort ordinaire, et un sort EN
// ZONE dont la séquence n'est pas curée — aucun des deux n'a de cible
// secondaire, la portée seule ne suffit pas.
const MAGIC_SHOT_LAPIS = 10606;
const RETRIEVE_MAGIC_LAPIS = 10611;
// Les huit identifiants du lot 1b (cadrage A.2 ter, `SEQUENCES_DE_COUPS_PAR_ID_CONNUS`).
const FAMILLE = [10601, 10602, 10603, 10604, 10605, 10616, 10618, 10620];

const SECONDAIRE: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  skillCom2usId: BLADE_SURGE_LAPIS,
  enemyDef: 1234,
  cibleDegatsParSort: { [BLADE_SURGE_LAPIS]: 'secondaire' },
};

function recette(setup: DamageSetup): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: LAPIS, monsterName: 'Lapis',
    requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
    damageSetup: setup, metric: 'eff', slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: true, artifactMainByKind: {},
  });
}

function bladeSurgeDeLapis(): SkillDamageProfile {
  const p = resolveDamageSkill(monsterDamageSkills(loadMonsterSkills(LAPIS)), BLADE_SURGE_LAPIS);
  if (p?.skillCom2usId !== BLADE_SURGE_LAPIS) throw new Error('Blade Surge de Lapis introuvable ou refusé');
  return p;
}

export function testBladeSurgeRecette() {
  titre('Blade Surge · recette — cibleDegatsParSort validé, refusé avec son chemin, aller-retour et resets (degats-et-aura 8b)');

  const lire = (valeur: unknown) => parseOptimizerRecipe(JSON.stringify(valeur));
  const avecCible = (cibleDegatsParSort: unknown) =>
    lire({ ...recette(SECONDAIRE), damageSetup: { ...SECONDAIRE, cibleDegatsParSort } });
  // `erreur` écrit « <chemin> <attente> » : l'espace final exige le chemin
  // EXACT — une erreur sur `…cibleDegatsParSort.10616` ne passe pas pour une
  // erreur sur le champ entier, ni l'inverse.
  const refuse = (resultat: ReturnType<typeof lire>, chemin: string) =>
    resultat.recipe === null && !!resultat.error?.includes(`${chemin} `);
  const bs = bladeSurgeDeLapis();

  // Absent : toute recette antérieure à ce champ, valide, cible visée.
  const sansChamp = JSON.parse(JSON.stringify(recette(SECONDAIRE)));
  delete sansChamp.damageSetup.cibleDegatsParSort;
  const relueSans = lire(sansChamp).recipe;
  ok(relueSans !== null, 'champ absent : recette acceptée');
  ok(relueSans !== null && !('cibleDegatsParSort' in relueSans.damageSetup), 'champ absent : aucune clé ajoutée à l’import');
  egal(relueSans && cibleDegatsRetenue(bs, relueSans.damageSetup), 'visee', 'champ absent : cible visée');
  egal(avecCible({}).recipe?.damageSetup.cibleDegatsParSort, {}, 'objet vide accepté : aucun choix');

  // Présent et valide : les deux crans, sur chacun des huit identifiants.
  const refusesALaFamille = FAMILLE.flatMap((id) =>
    (['visee', 'secondaire'] as const)
      .filter((cible) => !egalProfond(avecCible({ [id]: cible }).recipe?.damageSetup.cibleDegatsParSort, { [id]: cible }))
      .map((cible) => `${id} ${cible}`)
  );
  egal(refusesALaFamille, [], 'les deux crans acceptés et relus tels quels sur les huit identifiants');

  // Mal typé ou hors de l'union : refusé, avec le chemin exact.
  const champ = 'damageSetup.cibleDegatsParSort';
  for (const [valeur, chemin, motif] of [
    [[], champ, 'une liste au lieu d’un objet'],
    ['secondaire', champ, 'un texte au lieu d’un objet'],
    [null, champ, 'null au lieu d’un objet'],
    [{ abc: 'secondaire' }, `${champ}.abc`, 'clé non numérique'],
    [{ '-10616': 'secondaire' }, `${champ}.-10616`, 'clé négative'],
    [{ 0: 'secondaire' }, `${champ}.0`, 'clé nulle'],
    [{ '10616.5': 'secondaire' }, `${champ}.10616.5`, 'clé non entière'],
    [{ [BLADE_SURGE_LAPIS]: 'autre' }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur inconnue'],
    [{ [BLADE_SURGE_LAPIS]: 'Secondaire' }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur à la mauvaise casse'],
    [{ [BLADE_SURGE_LAPIS]: '' }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur vide'],
    [{ [BLADE_SURGE_LAPIS]: true }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur booléenne'],
    [{ [BLADE_SURGE_LAPIS]: 1 }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur numérique'],
    [{ [BLADE_SURGE_LAPIS]: null }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur null'],
  ] as [unknown, string, string][]) {
    ok(refuse(avecCible(valeur), chemin), `refusé avec son chemin : ${motif}`);
  }

  // Un sort sans coup de zone curé : refusé quelle que soit la valeur, sur la
  // table de capacité (cadrage B.0) — jamais un cran posé en silence sur un
  // sort qui ne le connaît pas.
  for (const [id, motif] of [
    [MAGIC_SHOT_LAPIS, 'sort ordinaire (Lapis S2)'],
    [RETRIEVE_MAGIC_LAPIS, 'sort en zone sans séquence curée (Lapis S3)'],
    [1, 'identifiant inconnu des données'],
  ] as [number, string][]) {
    for (const cible of ['visee', 'secondaire']) {
      ok(refuse(avecCible({ [id]: cible }), `${champ}.${id}`), `refusé avec son chemin : ${motif}, « ${cible} »`);
    }
  }
  ok(refuse(avecCible({ [BLADE_SURGE_LAPIS]: 'secondaire', [MAGIC_SHOT_LAPIS]: 'visee' }), `${champ}.${MAGIC_SHOT_LAPIS}`),
    'une seule clé fautive parmi des clés valides suffit à refuser, avec son chemin');
  const raison = avecCible({ [MAGIC_SHOT_LAPIS]: 'secondaire' }).error ?? '';
  ok(raison.includes('sans coup de zone curé'), `la raison est dite : « ${raison} »`);

  // Aller-retour export → import → export : aucune clé perdue ni ajoutée.
  const relue = lire(recette(SECONDAIRE)).recipe;
  egal(relue?.damageSetup, SECONDAIRE, 'aller-retour : damageSetup identique, cible comprise');
  egal(relue && lire(relue).recipe, relue, 'aller-retour : un second import ne change rien');
  egal(relue && cibleDegatsRetenue(bs, relue.damageSetup), 'secondaire', 'la cible relue est celle que retient le calcul');

  // Resets (B.0). L'import de recette écrit sa valeur telle quelle, sans
  // reset ultérieur (`setDamageSetup(recipe.damageSetup ?? …)`, contrôlé à son
  // point d'appel par `testOptimizerDamageTransitions`, comme le changement
  // d'exemplaire, qui n'efface que les résultats).
  const apresEspece = damageSetupApresChangementMonstre(relue!.damageSetup);
  egal(apresEspece.cibleDegatsParSort, undefined, 'changement d’espèce : choix de cible vidé (classe « sort »)');
  egal(cibleDegatsRetenue(bs, apresEspece), 'visee', '… retour à la cible visée');
  egal(apresEspece.enemyDef, 1234, '… le contexte de la cible conservé');
  egal(DEFAULT_DAMAGE_SETUP.cibleDegatsParSort, undefined, 'import de compte (défaut complet) : aucun choix, cible visée');
}

function egalProfond(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
