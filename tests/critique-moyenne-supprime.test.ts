// Le mode critique « Moyenne » supprimé (degats-et-aura, lot CM — décision de
// l'utilisateur du 2026-10-02). Une recette déjà exportée ou partagée qui le
// porte est CONVERTIE en « Critique » (le défaut) avec un avertissement
// visible, à l'écran comme dans le CLI — jamais refusée, jamais changée en
// silence. Toute autre valeur inconnue reste refusée ; l'export n'écrit
// jamais « moyenne ».
//
// ⚠️ Le dépôt ne teste pas les composants React : la part écran est un
// contrôle de SOURCE de `importRecipe` (même patron que
// `optimizer-recipe-import-selection.test.ts`), la part CLI passe par le vrai
// `chargerRecette` sur l'export miniature.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { egal, ok, titre, monstersJson } from './outils';
import { AVERTISSEMENT_CRIT_MOYENNE, buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { CRIT_MODE_LABELS, DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { chargerRecette } from '../scripts/lib/chargerRecette';
import { classeMessageImport, delaiEffacementImport } from '../src/lib/messageImport';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
// Monstre de l'export miniature (unité 101), résolu par son nom comme le CLI.
const COM2US_MINIATURE = 15105;

function recetteBrute(critMode: unknown, monsterCom2usId = 14104, monsterName = 'Camilla (test)') {
  const recette = buildOptimizerRecipe({
    monsterCom2usId,
    monsterName,
    requirement: { sets: [], minStats: {} },
    objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP,
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
  return { ...recette, damageSetup: { ...recette.damageSetup, critMode } };
}

export function testCritiqueMoyenneImport() {
  titre('Coup critique — « Moyenne » supprimé : conversion à l’import, refus du reste, export (lot CM)');

  egal(CRIT_MODE_LABELS.map((c) => c.key), ['crit', 'normal'], 'deux modes proposés : Critique, Non critique');

  const lue = parseOptimizerRecipe(JSON.stringify(recetteBrute('moyenne')));
  ok(lue.recipe !== null, '« moyenne » : la recette est lue, jamais refusée');
  egal(lue.recipe?.damageSetup.critMode, 'crit', '« moyenne » est converti en « crit » (Critique, le défaut)');
  egal(lue.avertissements, [AVERTISSEMENT_CRIT_MOYENNE], '… avec UN avertissement');
  ok(
    ['damageSetup.critMode', '« moyenne »', '« crit »'].every((morceau) => AVERTISSEMENT_CRIT_MOYENNE.includes(morceau)),
    'l’avertissement nomme le chemin du champ, l’ancienne et la nouvelle valeur'
  );
  egal(
    { ...lue.recipe?.damageSetup, critMode: 'crit' },
    { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'combat' },
    'aucun autre champ du réglage ne change'
  );

  for (const valeur of ['crit', 'normal'] as const) {
    const r = parseOptimizerRecipe(JSON.stringify(recetteBrute(valeur)));
    egal([r.recipe?.damageSetup.critMode, r.avertissements], [valeur, undefined], `« ${valeur} » : lu tel quel, sans avertissement`);
  }
  const sansMode = recetteBrute(undefined);
  const rSans = parseOptimizerRecipe(JSON.stringify(sansMode));
  egal([rSans.recipe !== null, rSans.avertissements], [true, undefined], 'mode absent : recette lue, sans avertissement');

  for (const inconnue of ['Moyenne', 'moyen', 'esperance', '', 1]) {
    const r = parseOptimizerRecipe(JSON.stringify(recetteBrute(inconnue)));
    ok(
      r.recipe === null && (r.error ?? '').includes('damageSetup.critMode'),
      `valeur inconnue ${JSON.stringify(inconnue)} : refusée avec son chemin (${r.error ?? 'acceptée'})`
    );
  }

  // L'export : l'écran exporte son `damageSetup` d'état (`exportRecipe`),
  // posé par l'import converti — réexporter la recette lue n'écrit plus
  // « moyenne ».
  const reexportee = JSON.stringify(buildOptimizerRecipe({ ...lue.recipe! }));
  ok(!reexportee.includes('moyenne'), 'la recette convertie, réexportée, ne contient plus « moyenne »');
  egal(JSON.parse(reexportee).damageSetup.critMode, 'crit', '… elle porte « crit »');
}

// Décision de l'utilisateur du 2026-10-02 : le message porteur d'un
// avertissement de conversion prend le token `warn` et ne s'efface plus après
// 5 s — il reste jusqu'au prochain import (réussi ou refusé), qui le
// remplace ; le message ordinaire garde sa minuterie.
export function testCritiqueMoyenneMessageImport() {
  titre('Coup critique — message d’import porteur d’un avertissement : token warn, sans effacement automatique (lot CM)');

  egal(
    [classeMessageImport({ text: 'x', avertissement: true }), delaiEffacementImport({ text: 'x', avertissement: true })],
    ['text-warn', null],
    'avertissement : token warn, jamais effacé par une minuterie'
  );
  egal(
    [classeMessageImport({ text: 'x' }), delaiEffacementImport({ text: 'x' })],
    ['text-good', 5000],
    'succès ordinaire : inchangé (good, 5 s)'
  );
  egal(
    [classeMessageImport({ text: 'x', error: true }), delaiEffacementImport({ text: 'x', error: true })],
    ['text-bad', 9000],
    'refus : inchangé (bad, 9 s)'
  );

  const source = readFileSync(resolve(racine, 'src/components/outils/OptimizerSection.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const debut = source.indexOf('function importRecipe');
  const importRecipe = source.slice(debut, source.indexOf('\n  }\n', debut));
  ok(importRecipe.includes('const avecAvertissement = (avertissements ?? []).length > 0;'), 'écran : le message est marqué dès que le parseur a converti quelque chose');
  egal((importRecipe.match(/avertissement: avecAvertissement/g) ?? []).length, 2, 'écran : les deux branches d’un import réussi portent la marque');
  ok(
    /const delai = delaiEffacementImport\(importMsg\);\n\s*if \(delai === null\) return;\n\s*const t = setTimeout\(\(\) => setImportMsg\(null\), delai\);/.test(source),
    'écran : la minuterie suit `delaiEffacementImport` et ne programme rien pour un avertissement'
  );
  ok(source.includes('className={`text-[12.5px] ${classeMessageImport(importMsg)}`}'), 'écran : la couleur du message vient de `classeMessageImport`');
  // « Jusqu'au prochain import » : seuls les trois messages de `importRecipe`
  // (refus, monstre trouvé, monstre introuvable) et la minuterie écrivent
  // l'état — un nouvel import, réussi ou non, remplace donc l'avertissement.
  egal((source.match(/setImportMsg\(/g) ?? []).length, 4, 'écran : seuls les trois messages d’import et la minuterie écrivent le message');
  egal((importRecipe.match(/setImportMsg\(/g) ?? []).length, 3, '… dont les trois de `importRecipe` (refus compris)');
}

export function testCritiqueMoyenneEcranEtCli() {
  titre('Coup critique — « Moyenne » converti : avertissement à l’écran et dans le CLI (lot CM)');

  // L'écran : `importRecipe` lit les avertissements du parseur et les ajoute
  // au message d'import, dans les deux branches (monstre trouvé ou non).
  const source = readFileSync(resolve(racine, 'src/components/outils/OptimizerSection.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const debut = source.indexOf('function importRecipe');
  const fin = source.indexOf('\n  }\n', debut);
  const importRecipe = source.slice(debut, fin);
  ok(debut !== -1 && fin > debut, 'la fonction importRecipe existe (sinon ce test contrôle la mauvaise fonction)');
  ok(importRecipe.includes('const { recipe, error, avertissements } = parseOptimizerRecipe(text);'), 'écran : les avertissements du parseur sont lus');
  ok(/\+ \(avertissements \?\? \[\]\)\.map\(\(a\) => ` \$\{a\}`\)\.join\(''\);/.test(importRecipe), 'écran : chacun est ajouté au message d’import');
  egal((importRecipe.match(/\$\{suffixeLocks\}/g) ?? []).length, 2, 'écran : le message qui les porte est affiché dans les deux branches de l’import');

  // Le CLI : le vrai `chargerRecette`, sur l'export miniature.
  const espece = monstersJson().find((m: { com2usId: number }) => m.com2usId === COM2US_MINIATURE);
  ok(espece != null, `précondition : ${COM2US_MINIATURE} est dans monsters.json`);
  if (!espece) return;
  const compte = resolve(racine, 'tests/fixtures/compte-miniature.json');
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-lot-cm-'));
  try {
    const cheminMoyenne = join(dossier, 'moyenne.json');
    const cheminCrit = join(dossier, 'crit.json');
    writeFileSync(cheminMoyenne, JSON.stringify(recetteBrute('moyenne', COM2US_MINIATURE, espece.name)));
    writeFileSync(cheminCrit, JSON.stringify(recetteBrute('crit', COM2US_MINIATURE, espece.name)));
    const moyenne = chargerRecette(compte, cheminMoyenne);
    const crit = chargerRecette(compte, cheminCrit);
    ok(moyenne.avertissements.includes(AVERTISSEMENT_CRIT_MOYENNE), 'CLI : l’avertissement de conversion est rendu par chargerRecette');
    ok(!crit.avertissements.includes(AVERTISSEMENT_CRIT_MOYENNE), 'CLI : rien de tel pour une recette en « crit »');
    egal(moyenne.recipe, crit.recipe, 'CLI : la recette convertie est celle en « crit »');
    egal(JSON.stringify(moyenne.params), JSON.stringify(crit.params), 'CLI : les paramètres de recherche sont ceux de « crit »');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
