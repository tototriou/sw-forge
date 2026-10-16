// Attaques conjointes — le champ `damageSetup.attaqueConjointe` de la recette :
// validé, relu à l'identique, lu de la même façon par l'écran, le CLI et le
// Worker de résolution (qui reçoivent le `damageSetup` entier), éteint au
// changement de monstre, conservé au changement de sort. Le calcul est celui
// de `degats-attaques-conjointes.test.ts`.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE : un champ optionnel jamais relu par un
// constructeur (`tsc` ne le voit pas) — l'interrupteur allumé à l'écran serait
// alors éteint au CLI, ou perdu à l'aller-retour d'une recette.
//
// Écran : le dépôt n'a pas de test React (voir tests/run.mjs) ; les points de
// passage sont contrôlés sur la source. CLI : le vrai `chargerRecette` et
// `buildRealDamageContext` sur un export miniature dont un monstre est changé
// en Cassie (S1 non coopératif).

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { egal, ok, titre, monstersJson } from './outils';
import {
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  contexteAttaqueConjointe,
  interrupteurAttaqueConjointe,
  mentionAttaqueConjointe,
  monsterDamageSkills,
  resolveDamageSkill,
} from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { chargerRecette } from '../scripts/lib/chargerRecette';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { loadMonsterSkills } from '../scripts/lib/skillsData';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lireSource = (fichier: string) => readFileSync(resolve(racine, fichier), 'utf8').replace(/\r\n/g, '\n');

// Cassie : S1 « Cross Fire » (10125) et S2 « Defeat Wild Dog » (10130), aucun
// des deux coopératif.
const CASSIE = 19315;
const CROSS_FIRE = 10125;
const DEFEAT_WILD_DOG = 10130;

// Sabrina (Boomerang Warrior eau) : Triple Strike (12706), attaque d'une
// famille coopérative — interrupteur allumé quand le champ manque.
const SABRINA = 22011;
const TRIPLE_STRIKE = 12706;

function recette(setup: DamageSetup, monsterName = 'Cassie', monsterCom2usId = CASSIE): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId, monsterName,
    requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
    damageSetup: setup, metric: 'eff', slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: true, artifactMainByKind: {},
  });
}

const lire = (valeur: unknown) => parseOptimizerRecipe(JSON.stringify(valeur));
const refuse = (resultat: ReturnType<typeof lire>, chemin: string) =>
  resultat.recipe === null && !!resultat.error?.includes(`${chemin} `);

export function testAttaquesConjointesRecetteChamp() {
  titre('Attaques conjointes · recette — booléen validé, absent = éteint, aller-retour identique');

  const allume: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: CROSS_FIRE, attaqueConjointe: true };
  const eteint: DamageSetup = { ...allume, attaqueConjointe: false };

  // Aller-retour export → import → export : le champ survit tel quel.
  const relueAllume = lire(recette(allume)).recipe;
  egal(relueAllume?.damageSetup, allume, 'allumé : relu identique');
  egal(relueAllume && lire(relueAllume).recipe, relueAllume, 'allumé : un second import ne change rien');
  const relueEteint = lire(recette(eteint)).recipe;
  egal(relueEteint?.damageSetup.attaqueConjointe, false, 'éteint explicitement : `false` relu tel quel');

  // Absent : toute recette antérieure au champ, valide, éteinte, sans clé ajoutée.
  const sansChamp = JSON.parse(JSON.stringify(recette(allume)));
  delete sansChamp.damageSetup.attaqueConjointe;
  const relueSans = lire(sansChamp).recipe;
  ok(relueSans !== null, 'absent : recette acceptée');
  ok(relueSans !== null && !('attaqueConjointe' in relueSans.damageSetup), 'absent : aucune clé ajoutée à l’import');
  egal(relueSans?.damageSetup.attaqueConjointe === true, false, 'absent : éteint');
  ok(!('attaqueConjointe' in DEFAULT_DAMAGE_SETUP), 'défaut du réglage : aucune clé, donc éteint');

  // Une valeur non booléenne est refusée, avec le chemin du champ.
  for (const [valeur, motif] of [
    ['oui', 'texte'], ['true', 'texte « true »'], [1, 'nombre'], [0, 'zéro'], [null, 'null'], [[], 'liste'], [{}, 'objet'],
  ] as [unknown, string][]) {
    ok(refuse(lire({ ...recette(allume), damageSetup: { ...allume, attaqueConjointe: valeur } }), 'damageSetup.attaqueConjointe'),
      `refusé avec son chemin : ${motif}`);
  }
  const raison = lire({ ...recette(allume), damageSetup: { ...allume, attaqueConjointe: 'oui' } }).error ?? '';
  ok(raison.includes('doit être un booléen'), `la raison est dite : « ${raison} »`);

  // Famille coopérative : sans le champ, la recette relue est allumée (par la
  // porte, sans clé ajoutée) ; `false` relu tel quel l'éteint.
  const triple = resolveDamageSkill(monsterDamageSkills(loadMonsterSkills(SABRINA)), TRIPLE_STRIKE)!;
  const familleSans: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: TRIPLE_STRIKE };
  const relueFamilleSans = lire(recette(familleSans, 'Sabrina', SABRINA)).recipe;
  ok(relueFamilleSans !== null && !('attaqueConjointe' in relueFamilleSans.damageSetup), 'famille, sans le champ : recette acceptée, aucune clé ajoutée');
  egal(relueFamilleSans && interrupteurAttaqueConjointe(triple, relueFamilleSans.damageSetup), { cas: 'familles-cooperatives', allume: true, allumeParDefaut: true },
    'fige une décision de l’utilisateur (2026-10-16) : famille, recette sans le champ, relue : interrupteur allumé par défaut');
  egal(relueFamilleSans && contexteAttaqueConjointe(triple, relueFamilleSans.damageSetup, 'sort-choisi'), 'propre', 'famille, recette sans le champ, relue : conjoint');
  const relueFamilleEteinte = lire(recette({ ...familleSans, attaqueConjointe: false }, 'Sabrina', SABRINA)).recipe;
  egal(relueFamilleEteinte?.damageSetup.attaqueConjointe, false, 'famille éteinte : `false` relu tel quel');
  egal(relueFamilleEteinte && interrupteurAttaqueConjointe(triple, relueFamilleEteinte.damageSetup)?.allume, false, 'famille éteinte, relue : interrupteur éteint');
  egal(relueFamilleEteinte && contexteAttaqueConjointe(triple, relueFamilleEteinte.damageSetup, 'sort-choisi'), null, 'famille éteinte, relue : non conjoint');
  const relueFamilleAllumee = lire(recette({ ...familleSans, attaqueConjointe: true }, 'Sabrina', SABRINA)).recipe;
  egal(relueFamilleAllumee?.damageSetup.attaqueConjointe, true, 'famille allumée explicitement : `true` relu tel quel');
}

export function testAttaquesConjointesRecetteTransitions() {
  titre('Attaques conjointes · transitions — monstre : éteint ; sort : conservé');

  const allume: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: CROSS_FIRE, enemyDef: 1234, attaqueConjointe: true };

  // Changement de monstre : le réglage propre au sort est remis à son défaut,
  // le contexte (ici la DEF de la cible) est gardé.
  egal(DAMAGE_SETUP_CLASSIFICATION.attaqueConjointe, 'sort', 'classé « sort »');
  const apresEspece = damageSetupApresChangementMonstre(allume);
  egal(apresEspece.attaqueConjointe, undefined, 'changement de monstre : éteint');
  egal(apresEspece.enemyDef, 1234, '… le contexte de la cible conservé');

  // Changement de sort : l'écran n'écrit que `skillCom2usId` (`maj`), le
  // réglage reste donc ; hors d'un S1 non conjoint il est sans effet.
  const sorts = monsterDamageSkills(loadMonsterSkills(CASSIE));
  const s1 = resolveDamageSkill(sorts, CROSS_FIRE)!;
  const s2 = resolveDamageSkill(sorts, DEFEAT_WILD_DOG)!;
  const versS2: DamageSetup = { ...allume, skillCom2usId: DEFEAT_WILD_DOG };
  egal(versS2.attaqueConjointe, true, 'changement de sort : conservé');
  egal(contexteAttaqueConjointe(s1, allume, 'sort-choisi'), 'appelee-par-allie', 'sur le S1 : agit');
  egal(contexteAttaqueConjointe(s2, versS2, 'sort-choisi'), null, 'sur le S2, conservé : sans effet');

  // Vers une famille coopérative : le champ remis à absent la rallume.
  const triple = resolveDamageSkill(monsterDamageSkills(loadMonsterSkills(SABRINA)), TRIPLE_STRIKE)!;
  const depuisEteint = damageSetupApresChangementMonstre({ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: CROSS_FIRE, attaqueConjointe: false });
  const versSabrina: DamageSetup = { ...depuisEteint, skillCom2usId: TRIPLE_STRIKE };
  egal(versSabrina.attaqueConjointe, undefined, 'changement de monstre depuis un réglage éteint : champ absent');
  egal(interrupteurAttaqueConjointe(triple, versSabrina)?.allume, true, 'fige une décision de l’utilisateur (2026-10-16) : arrivé sur une famille, l’interrupteur est allumé (défaut)');
}

export function testAttaquesConjointesRecetteCli() {
  titre('Attaques conjointes · CLI et Worker — le champ voyage dans le damageSetup entier, la ligne du sort le dit');

  // Le contexte de dégâts du CLI (et du Worker de résolution, qui reçoit le
  // `setup` entier) : la recette allumée donne un S1 appelé par un allié.
  const sorts = monsterDamageSkills(loadMonsterSkills(CASSIE));
  const s1 = resolveDamageSkill(sorts, CROSS_FIRE)!;
  const ctx = (setup: DamageSetup) => buildRealDamageContext(recette(setup), CASSIE, []);
  const allume = ctx({ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: CROSS_FIRE, attaqueConjointe: true });
  const eteint = ctx({ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: CROSS_FIRE });
  ok(allume != null && eteint != null, 'précondition : un contexte de dégâts réels');
  egal(allume && contexteAttaqueConjointe(s1, allume.setup, 'sort-choisi'), 'appelee-par-allie', 'CLI, recette allumée : S1 appelé par un allié');
  egal(eteint && contexteAttaqueConjointe(s1, eteint.setup, 'sort-choisi'), null, 'CLI, recette sans le champ : non conjoint');
  ok(sansCommentaires(lireSource('scripts/lib/realDamageCli.ts')).includes('setup: normaliserCompetencesInvocateur(recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP),'),
    'CLI : le contexte de dégâts transmet le damageSetup de la recette entier');

  // Famille coopérative au CLI : recette sans le champ = allumée, la ligne du
  // sort le dit ; `false` = éteinte, rien.
  const triple = resolveDamageSkill(monsterDamageSkills(loadMonsterSkills(SABRINA)), TRIPLE_STRIKE)!;
  const famille = (setup: DamageSetup) => buildRealDamageContext(recette(setup, 'Sabrina', SABRINA), SABRINA, []);
  const familleSans = famille({ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: TRIPLE_STRIKE });
  const familleEteinte = famille({ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: TRIPLE_STRIKE, attaqueConjointe: false });
  ok(familleSans != null && familleEteinte != null, 'précondition : un contexte de dégâts réels pour Sabrina');
  egal(familleSans && familleSans.profile.skillCom2usId, TRIPLE_STRIKE, 'CLI, famille : le contexte calcule Triple Strike');
  egal(familleSans && contexteAttaqueConjointe(familleSans.profile, familleSans.setup, 'sort-choisi'), 'propre',
    'fige une décision de l’utilisateur (2026-10-16) : CLI, famille, recette sans le champ : conjoint (allumé par défaut)');
  egal(familleSans && mentionAttaqueConjointe(familleSans.profile, familleSans.setup), 'attaque conjointe (un monstre de l’autre famille au combat)',
    'CLI, famille, recette sans le champ : la ligne du sort dit l’attaque conjointe');
  egal(familleEteinte && contexteAttaqueConjointe(triple, familleEteinte.setup, 'sort-choisi'), null, 'CLI, famille éteinte : non conjoint');
  egal(familleEteinte && mentionAttaqueConjointe(triple, familleEteinte.setup), null, 'CLI, famille éteinte : la ligne du sort n’en dit rien');

  // Le vrai `chargerRecette`, sur l'export miniature dont l'unité 101 devient
  // Cassie : même parseur que l'écran, le champ arrive aux paramètres.
  const espece = monstersJson().find((m: { com2usId: number }) => m.com2usId === CASSIE);
  ok(espece != null, `précondition : ${CASSIE} est dans monsters.json`);
  if (!espece) return;
  const compte = JSON.parse(readFileSync(resolve(racine, 'tests/fixtures/compte-miniature.json'), 'utf8'));
  compte.unit_list.find((u: { unit_id: number }) => u.unit_id === 101).unit_master_id = CASSIE;
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-lot-ac-'));
  try {
    const cheminCompte = join(dossier, 'compte.json');
    const cheminRecette = join(dossier, 'recette.json');
    writeFileSync(cheminCompte, JSON.stringify(compte));
    writeFileSync(cheminRecette, JSON.stringify(recette({ ...DEFAULT_DAMAGE_SETUP, skillCom2usId: CROSS_FIRE, attaqueConjointe: true }, espece.name)));
    const chargee = chargerRecette(cheminCompte, cheminRecette);
    egal(chargee.recipe.damageSetup.attaqueConjointe, true, 'chargerRecette : la recette relue porte le champ');
    // Comme `optimizer-search.ts` (l. « const realDamage = »), après le chargement.
    const reel = buildRealDamageContext(chargee.recipe, chargee.loaded.com2usId, chargee.params.artifacts);
    egal(reel && contexteAttaqueConjointe(s1, reel.setup, 'sort-choisi'), 'appelee-par-allie',
      'chargerRecette puis contexte de dégâts du CLI : un S1 appelé par un allié');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }

  // La ligne du sort : affichée quand le réglage agit, par la porte, jamais
  // par une seconde expression de la règle.
  const cli = sansCommentaires(lireSource('scripts/optimizer-search.ts'));
  ok(cli.includes('const mentionConjointe = mentionAttaqueConjointe(profile, s);') && cli.includes('${mentionConjointe ? ` — ${mentionConjointe}` : \'\'}'),
    'ligne du CLI : « attaque conjointe » affiché par la porte (`mentionAttaqueConjointe`, testée dans degats-attaques-conjointes), défaut des familles compris');
  ok(!/attaqueConjointe/.test(cli), 'ligne du CLI : le champ n’est jamais lu directement, seulement par la porte');
}

// Le code seul : un commentaire qui CITE le champ ne fait ni échouer ni passer
// un contrôle (même outil que proses-sort.test.ts).
function sansCommentaires(s: string) {
  return s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
