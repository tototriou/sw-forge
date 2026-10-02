// Blade Surge — propagation de la cible calculée (`cibleDegatsParSort`) :
// recette, écran, CLI (chantier degats-et-aura, lot 8b ; le calcul est celui
// du lot 8a, vérifié par `testDegatsBladeSurge`).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : une recette qui laisse passer une
// cible inconnue ou un cran posé sur un sort sans coup de zone curé — le
// calcul retomberait en silence sur la cible visée, et l'export suivant
// propagerait la clé fautive —, une recette qui perd le choix à l'aller-retour,
// ou un choix qui survit à un changement d'espèce ; un écran qui propose les
// deux crans pour un sort qui ne les connaît pas, ou dont le texte au-dessus
// des crans change quand on bascule (le contrôle bougerait sous le pointeur).
//
// Écran : le dépôt n'a pas de test React (voir tests/run.mjs). L'arbre
// syntaxique de DamageSetupCard.tsx établit OÙ les crans s'affichent et à
// quelle condition ; la condition elle-même (`cibleSecondairePriseEnCharge`)
// est balayée sur tout le corpus par `testDegatsBladeSurge`.

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { egal, ok, titre } from './outils';
import {
  AUCUNE_AURA_PROPRE,
  CIBLE_DEGATS_LABELS,
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  type SkillDamageProfile,
  cibleDegatsRetenue,
  computeTotalDamage,
  monsterDamageSkills,
  monsterOffensivePassives,
  resolveDamageSkill,
  resumeSequenceDeCoups,
} from '../src/lib/damage';
import { damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { objectiveScore, type BuildCandidate } from '../src/lib/runeBuildOptim';
import { computeStats } from '../src/lib/stats';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { loadMonstersList } from '../scripts/lib/monstersData';
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
  titre('Blade Surge · recette — cibleDegatsParSort validé, refusé avec son chemin, aller-retour et resets (degats-et-aura 8b, 8c)');

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
    // `Number` la ramène à Blade Surge de Lapis, mais le calcul lit la clé
    // « 10616 » : la même règle que `premierCoupIgnoreDefParSort` (8c).
    [{ [`0${BLADE_SURGE_LAPIS}`]: 'secondaire' }, `${champ}.0${BLADE_SURGE_LAPIS}`, 'clé à zéro de tête'],
    [{ '00': 'secondaire' }, `${champ}.00`, 'clé nulle à zéro de tête'],
    [{ [BLADE_SURGE_LAPIS]: 'autre' }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur inconnue'],
    [{ [BLADE_SURGE_LAPIS]: 'Secondaire' }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur à la mauvaise casse'],
    [{ [BLADE_SURGE_LAPIS]: '' }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur vide'],
    [{ [BLADE_SURGE_LAPIS]: true }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur booléenne'],
    [{ [BLADE_SURGE_LAPIS]: 1 }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur numérique'],
    [{ [BLADE_SURGE_LAPIS]: null }, `${champ}.${BLADE_SURGE_LAPIS}`, 'valeur null'],
  ] as [unknown, string, string][]) {
    ok(refuse(avecCible(valeur), chemin), `refusé avec son chemin : ${motif}`);
  }
  // Clé à zéro de tête : refusée par la règle de la clé, pas par la table de
  // capacité (`Number` la ramènerait à un sort qui a la capacité) ; la même
  // clé écrite sans zéro de tête est acceptée et relue telle quelle (8c).
  const zeroDeTete = avecCible({ [`0${BLADE_SURGE_LAPIS}`]: 'secondaire' }).error ?? '';
  ok(zeroDeTete.includes('identifiant de compétence invalide'), `clé à zéro de tête : la raison est la clé — « ${zeroDeTete} »`);
  egal(avecCible({ [BLADE_SURGE_LAPIS]: 'secondaire' }).recipe?.damageSetup.cibleDegatsParSort, { [BLADE_SURGE_LAPIS]: 'secondaire' },
    'la même clé sans zéro de tête : acceptée, relue telle quelle');

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

const lireSource = (fichier: string) => readFileSync(fichier, 'utf8').replace(/\r\n/g, '\n');

// Le code seul : un commentaire qui CITE le champ ou la condition ne doit ni
// faire échouer ni faire passer un contrôle (même outil que proses-sort.test.ts).
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

function fonctionDe(source: ts.SourceFile, nom: string): ts.FunctionDeclaration | undefined {
  let trouvee: ts.FunctionDeclaration | undefined;
  const visiter = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nom) trouvee = n;
    else ts.forEachChild(n, visiter);
  };
  visiter(source);
  return trouvee;
}

export function testBladeSurgeEcran() {
  titre('Blade Surge · écran — deux crans sous « Compétence utilisée », seulement pour un sort qui le permet (degats-et-aura 8b)');

  egal(CIBLE_DEGATS_LABELS, [
    { key: 'visee', label: 'Dégâts sur la cible visée' },
    { key: 'secondaire', label: 'Dégâts sur les autres ennemis' },
  ], 'les deux crans, libellés retenus par l’utilisateur (n° 8), la cible visée d’abord');
  egal(DEFAULT_DAMAGE_SETUP.cibleDegatsParSort, undefined, 'défaut : aucune clé, donc la cible visée, premier cran');

  const texte = lireSource('src/components/outils/DamageSetupCard.tsx');
  const source = ts.createSourceFile('DamageSetupCard.tsx', texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const champ = fonctionDe(source, 'champCibleDegats');
  ok(!!champ, 'précondition : la fonction qui rend les deux crans');
  const instructions = champ?.body?.statements.map((s) => s.getText(source)) ?? [];
  egal(instructions[0], 'if (!cibleSecondairePriseEnCharge(profile.skillCom2usId)) return null;',
    'garde en tête : aucun cran pour un sort sans coup de zone curé — la table de capacité même du parseur');
  const rendu = instructions.slice(1).join('\n');
  ok(/<Segmented<CibleDegats>/.test(rendu), 'un Segmented de la librairie, rien de custom');
  ok(/options=\{CIBLE_DEGATS_LABELS\}/.test(rendu), 'ses deux crans : les libellés partagés avec le CLI');
  ok(/value=\{cibleDegatsRetenue\(profile, setup\)\}/.test(rendu), 'cran allumé : la cible que retient le calcul');
  ok(/onChange=\{\(v\) => maj\(\{ cibleDegatsParSort: \{ \.\.\.\(setup\.cibleDegatsParSort \?\? \{\}\), \[profile\.skillCom2usId\]: v \} \}\)\}/.test(rendu),
    'écriture : la clé du sort affiché, celles des autres sorts conservées');

  const code = sansCommentaires(texte);
  ok(/\{champCoupsVariables\(resolved, setup, maj\)\}\s*\{champCibleDegats\(resolved, setup, maj\)\}/.test(code),
    'place : sous la liste des sorts, juste après le champ des coups variables — ce qui apparaît pousse vers le bas, la case cliquée ne bouge pas');
  egal((code.match(/champCibleDegats\(/g) ?? []).length, 2, 'un seul point d’appel, plus la déclaration');
  egal((code.match(/cibleDegatsParSort/g) ?? []).length, 2, 'la carte n’écrit le champ qu’à cet endroit');

  // Rien au-dessus du contrôle ne lit le cran : basculer ne change pas le
  // texte des cases de sort, donc pas leur hauteur, donc pas la place du
  // contrôle.
  const resume = fonctionDe(source, 'resumeSort')?.getText(source) ?? '';
  ok(resume.length > 0, 'précondition : le résumé des sorts');
  ok(!/cibleDegats/.test(resume), 'résumé du sort : ne lit jamais la cible choisie — le texte au-dessus des crans ne bouge pas');
  ok(/const sequence = p\.sequenceDeCoups;/.test(resume) && /resumeSequenceDeCoups\(sequence\)/.test(resume),
    'résumé du sort : la séquence curée, par la fonction partagée avec le CLI');
  ok(/sequence\.map\(\(g\) => formuleLisible\(g\.formule\)\)\.join\(' puis '\)/.test(resume),
    'ratio : la formule de chaque groupe, dans l’ordre des coups');
  egal(resumeSequenceDeCoups(bladeSurgeDeLapis().sequenceDeCoups ?? []), '2 coups · Cible unique, puis 1 coup · Zone',
    'Blade Surge : la séquence entière — l’ancien « 2 coups · Cible unique » oubliait le coup de zone');

  // L'aide : la portée reste lue, seule la cible se choisit.
  const aide = (code.match(/<HelpPopover title="Compétence utilisée">([\s\S]*?)<\/HelpPopover>/)?.[1] ?? '').replace(/\s+/g, ' ');
  ok(aide.includes('jamais à saisir'), 'aide : les paramètres du sort restent lus, jamais saisis');
  ok(CIBLE_DEGATS_LABELS.every(({ label }) => aide.includes(label)), 'aide : les libellés exacts des deux crans');
  ok(aide.includes('les champs de l&apos;adversaire décrivent alors cet autre ennemi'),
    'aide : les champs de l’adversaire décrivent l’autre ennemi, aucun champ nouveau');
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export function testBladeSurgePariteEcranCli() {
  titre('Blade Surge · parité écran/CLI — la recette porte la cible, le CLI calcule celle de l’écran (degats-et-aura 8b)');

  const bs = bladeSurgeDeLapis();
  const detail = loadMonsterSkills(LAPIS);
  const element = loadMonstersList().find((m) => m.com2usId === LAPIS)?.element ?? null;
  // Une fiche fixe : seul le cran change d'un calcul à l'autre.
  const candidat: BuildCandidate = {
    runeIds: [],
    effTotal: 0,
    stats: computeStats({ base: { hp: 10000, atk: 1000, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] }),
  };
  const relire = (setup: DamageSetup) => parseOptimizerRecipe(JSON.stringify(recette(setup))).recipe;
  // Le CLI : `chargerRecette` lit la recette par `parseOptimizerRecipe`, puis
  // `buildRealDamageContext` transmet son `damageSetup` entier au score.
  const scoreCli = (setup: DamageSetup) => {
    const relue = relire(setup);
    const contexte = relue && buildRealDamageContext(relue, LAPIS, []);
    return contexte ? objectiveScore(candidat, 'degats_reels', AUCUNE_AURA_PROPRE, contexte) : NaN;
  };
  // L'écran : l'import écrit `recipe.damageSetup` tel quel dans l'état, que
  // `contexteDegatsArtefacts` (puis `realDamage`) transmet entier au calcul.
  const scoreEcran = (setup: DamageSetup) => {
    const relue = relire(setup);
    return relue
      ? computeTotalDamage(bs, monsterOffensivePassives(detail), candidat.stats, relue.damageSetup, AUCUNE_AURA_PROPRE, element)
      : NaN;
  };
  const VISEE: DamageSetup = { ...SECONDAIRE, cibleDegatsParSort: { [BLADE_SURGE_LAPIS]: 'visee' } };
  const SANS: DamageSetup = { ...SECONDAIRE, cibleDegatsParSort: undefined };

  for (const [setup, nom] of [[VISEE, 'cible visée'], [SECONDAIRE, 'autres ennemis'], [SANS, 'clé absente']] as [DamageSetup, string][]) {
    const cli = scoreCli(setup);
    ok(Number.isFinite(cli) && cli === scoreEcran(setup), `${nom} : même score au CLI et à l’écran (${cli.toFixed(1)})`);
  }
  ok(scoreCli(SECONDAIRE) < scoreCli(VISEE), 'le CLI applique le cran : un autre ennemi reçoit moins que la cible visée');
  egal(scoreCli(SANS), scoreCli(VISEE), 'clé absente = cible visée, au CLI aussi');
  ok(proche(scoreCli(VISEE) / scoreCli(SECONDAIRE), (0.5 * 2 + 3.0) / 3.0),
    'cible visée / autres ennemis = (0,5 × 2 + 3,0) / 3,0 — valeurs curées ; Lapis sans passif offensif, sans artéfact');

  // Les points de passage, à leur source : rien ne filtre le champ en route.
  const ecran = sansCommentaires(lireSource('src/components/outils/OptimizerSection.tsx'));
  ok(ecran.includes('setDamageSetup(recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP)'), 'écran : l’import écrit le damageSetup de la recette tel quel, cible comprise');
  ok(/profile: resolvedSkill,\s*setup: damageSetup,/.test(ecran), 'écran : le contexte de dégâts transmet le damageSetup entier');
  ok(/const recipe = buildOptimizerRecipe\(\{[\s\S]*?\n\s*damageSetup,\n/.test(ecran), 'écran : l’export écrit le damageSetup entier, cible comprise');
  ok(sansCommentaires(lireSource('scripts/lib/realDamageCli.ts')).includes('setup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,'),
    'CLI : le contexte de dégâts transmet le damageSetup de la recette entier');
  ok(sansCommentaires(lireSource('scripts/lib/chargerRecette.ts')).includes('parseOptimizerRecipe(readFileSync(cheminRecette'),
    'CLI : la recette passe par le même parseur que l’écran, donc par les mêmes refus');

  // La ligne du sort du CLI : la séquence et la cible, avec les textes de l'écran.
  const cli = sansCommentaires(lireSource('scripts/optimizer-search.ts'));
  ok(/const sequence = profile\.sequenceDeCoups;/.test(cli) && cli.includes('${sequence ? resumeSequenceDeCoups(sequence) : `${resolvedHits(profile, s)} coup(s)`}'),
    'ligne du CLI : la séquence entière, par la fonction du résumé de l’écran');
  ok(cli.includes('${!sequence && profile.aoe ? \', zone\' : \'\'}'), 'ligne du CLI : la portée du sort seulement hors séquence (la donnée ne décrit que le premier groupe)');
  ok(/const cibleCalculee = cibleSecondairePriseEnCharge\(profile\.skillCom2usId\)\s*\?\s*CIBLE_DEGATS_LABELS\.find\(\(c\) => c\.key === cibleDegatsRetenue\(profile, s\)\)\?\.label\s*:\s*undefined;/.test(cli)
    && cli.includes('${cibleCalculee ? `${cibleCalculee} — ` : \'\'}'),
    'ligne du CLI : la cible calculée, avec le libellé du cran de l’écran, pour un sort qui le permet');
}

export function testBladeSurgeLigneArtifactSearch() {
  titre('Blade Surge · script de diagnostic des artéfacts — la ligne du sort dit la séquence curée, comme le CLI (degats-et-aura 8c)');

  const script = sansCommentaires(lireSource('scripts/artifact-search.ts'));
  ok(/const sequence = sort\.sequenceDeCoups;/.test(script) && script.includes('${sequence ? resumeSequenceDeCoups(sequence) : `${sort.hits} coup(s)`}'),
    'ligne « Sort : … » : la séquence entière, par la fonction du résumé de l’écran et de la ligne du CLI');
  ok(script.includes('${!sequence && sort.aoe ? \', zone\' : \'\'}'), '… la portée seulement hors séquence (la donnée ne décrit que le premier groupe)');
  egal((script.match(/coup\(s\)/g) ?? []).length, 1, '« coup(s) » ne reste que dans le repli hors séquence');
  egal(resumeSequenceDeCoups(bladeSurgeDeLapis().sequenceDeCoups ?? []), '2 coups · Cible unique, puis 1 coup · Zone',
    'Blade Surge de Lapis : ce que la ligne écrit désormais, au lieu de « 2 coup(s) »');
}
