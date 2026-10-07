// L'interrupteur « Vérifier toutes les combinaisons
// trouvées » (Réglages avancés, désactivé par défaut) : la file vérifie tous
// les builds trouvés au lieu de s'arrêter à K confirmées (`cibleDeLaFile`,
// artifactQueue.ts). Gardé dans la recette (champ optionnel
// `verifierToutesLesCombinaisons`) et respecté par le CLI.
//
// La parité CLI/écran sur une vraie recherche vit dans
// `testCliClassementParMode` (cli-classement.test.ts) ; ici, la fonction pure,
// la recette et le branchement de l'écran, contrôlé sur la source (le dépôt
// n'a pas d'infrastructure de test React).

import { readFileSync } from 'node:fs';
import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { cibleDeLaFile, cleBuild, kDeLaFile, prochainsATraiter } from '../src/lib/artifactQueue';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { relicIntentDepuisEtat } from '../src/hooks/useOptimizerState';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { toutVerifierDeLaRecette } from '../scripts/lib/recipeToSearchParams';
import { RelicDetail } from '../src/types';
import { egal, ok, titre } from './outils';

const build = (id: number) => ({ runeIds: [id] }) as unknown as BuildCandidate;
const ordre = (n: number) => Array.from({ length: n }, (_, i) => build(i + 1));
const RELIQUE: RelicDetail = { id: 1, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } };

function recette(verifier?: boolean) {
  return buildOptimizerRecipe({
    monsterCom2usId: 13413, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: {} }, objective: 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    ...(verifier === undefined ? {} : { verifierToutesLesCombinaisons: verifier }),
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' },
  });
}

export function testVerifierToutes() {
  titre('« Vérifier toutes les combinaisons trouvées » — la cible de la file');

  {
    const ctx = (principale: 'equipped' | 'libre') =>
      resoudreContexteRelique(relicIntentDepuisEtat(true, principale, 'libre', 0), RELIQUE, [RELIQUE]);
    const equipee = ctx('equipped');
    const recherche = ctx('libre');
    egal([equipee.mode, recherche.mode], ['equipped', 'recherche'], 'précondition : les modes du vrai producteur');
    egal([cibleDeLaFile({ relicContext: undefined, toutVerifier: false }), cibleDeLaFile({ relicContext: equipee, toutVerifier: false }), cibleDeLaFile({ relicContext: recherche, toutVerifier: false })],
      [kDeLaFile(undefined), kDeLaFile(equipee), kDeLaFile(recherche)], 'désactivé (défaut) : la cible est `kDeLaFile`, inchangée');
    egal([kDeLaFile(equipee), kDeLaFile(recherche)], [100, 300], 'kDeLaFile garde sa valeur : 100 et 300 (des confirmées)');
    egal([cibleDeLaFile({ relicContext: undefined, toutVerifier: true }), cibleDeLaFile({ relicContext: equipee, toutVerifier: true }), cibleDeLaFile({ relicContext: recherche, toutVerifier: true })],
      [Infinity, Infinity, Infinity], 'activé : cible infinie, quel que soit le mode de relique');
  }

  {
    // La file avec l'interrupteur : au-delà de K confirmées, tout.
    const triees = ordre(8);
    const cache = new Map([['1', { conforme: true }], ['2', { conforme: true }], ['3', { conforme: false }]]);
    egal(prochainsATraiter(triees, cache, 2).map(cleBuild), [], 'désactivé, K = 2 : 2 confirmées, la file s’arrête');
    egal(prochainsATraiter(triees, cache, Infinity).map(cleBuild), ['4', '5', '6', '7', '8'], 'activé : tous les non résolus, dans l’ordre de base, au-delà des confirmées');
    egal(prochainsATraiter(triees, cache, Infinity, [build(7), build(40)]).map(cleBuild), ['7', '40', '4', '5', '6', '8'],
      'activé : la page passe toujours d’abord, sans doublon');
    // La boucle du hook : tout finit vérifié.
    const c2 = new Map<string, { conforme: boolean }>();
    for (let pas = 0; pas < 20; pas++) {
      const s = prochainsATraiter(triees, c2, Infinity)[0];
      if (!s) break;
      c2.set(cleBuild(s), { conforme: Number(cleBuild(s)) % 3 === 0 });
    }
    egal(c2.size, 8, 'boucle du hook, interrupteur activé : les 8 builds vérifiés');
  }

  titre('« Vérifier toutes les combinaisons trouvées » — gardé dans la recette');

  {
    const allerRetour = (v?: boolean) => parseOptimizerRecipe(JSON.stringify(recette(v))).recipe;
    egal(allerRetour(true)?.verifierToutesLesCombinaisons, true, 'activé : relu activé');
    egal(allerRetour(false)?.verifierToutesLesCombinaisons, false, 'désactivé : relu désactivé');
    const ancienne = allerRetour(undefined);
    egal([ancienne != null, ancienne?.verifierToutesLesCombinaisons], [true, undefined], 'recette exportée avant ce champ : acceptée, champ absent');
    egal([toutVerifierDeLaRecette(ancienne!), toutVerifierDeLaRecette(allerRetour(true)!)], [false, true],
      'CLI (`toutVerifierDeLaRecette`) : absent → désactivé, comme l’écran (`?? false`)');
    const mal = { ...recette(true), verifierToutesLesCombinaisons: 'oui' };
    const lu = parseOptimizerRecipe(JSON.stringify(mal));
    ok(lu.recipe === null && /verifierToutesLesCombinaisons/.test(lu.error ?? ''), `mal typé : refusé avec son chemin (${lu.error})`);
  }

  titre('« Vérifier toutes les combinaisons trouvées » — l’écran, l’état et le CLI, sur la source');

  const lire = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
  const etat = lire('src/hooks/useOptimizerState.ts');
  ok(/const \[verifierToutesLesCombinaisons, setVerifierToutesLesCombinaisons\] = useState\(false\);/.test(etat), 'état : désactivé par défaut');
  const reset = etat.slice(etat.indexOf('function resetSearch('), etat.indexOf('return {', etat.indexOf('function resetSearch(')));
  ok(reset.length > 0 && !/setVerifierToutesLesCombinaisons/.test(reset), 'état : réglage avancé, jamais remis à zéro par `resetSearch`');

  const ecran = lire('src/components/outils/OptimizerSection.tsx');
  const sansCommentaires = ecran.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const exportRecette = sansCommentaires.slice(sansCommentaires.indexOf('function exportRecipe()'), sansCommentaires.indexOf('const jour =', sansCommentaires.indexOf('function exportRecipe()')));
  ok(/\n\s*verifierToutesLesCombinaisons,\n/.test(exportRecette), 'écran : exporté dans la recette');
  ok(/setVerifierToutesLesCombinaisons\(recipe\.verifierToutesLesCombinaisons \?\? false\);/.test(sansCommentaires), 'écran : importé, repli `?? false`');
  const avances = sansCommentaires.slice(sansCommentaires.indexOf('const reglagesAvancesInner = '), sansCommentaires.indexOf('const reglagesAvancesTitre = '));
  const ligne = avances.match(/\{optimiserArtefacts && \(\s*<div className="flex items-center justify-between gap-2 py-3 last:pb-0">[\s\S]*?<\/div>\s*\)\}/)?.[0] ?? '';
  ok(ligne.length > 0, 'Réglages avancés : une rangée, masquée sans optimisation d’artéfacts (pas de file, rien à vérifier)');
  ok(/<span className="text-\[11\.5px\] text-ink-dim">Vérifier toutes les combinaisons trouvées<\/span>/.test(ligne), 'libellé : « Vérifier toutes les combinaisons trouvées »');
  const aide = ligne.match(/<HelpPopover title="Vérifier toutes les combinaisons trouvées">([\s\S]*?)<\/HelpPopover>/)?.[1] ?? '';
  ok(/100 combinaisons sont confirmées/.test(aide) && /300/.test(aide) && /toutes les combinaisons trouvées sont vérifiées/.test(aide) && /plusieurs minutes/.test(aide),
    'aide : au-delà des K confirmées, tout est vérifié, ce qui peut prendre plusieurs minutes');
  ok(/<Interrupteur\s+actif=\{verifierToutesLesCombinaisons\}\s+onChange=\{setVerifierToutesLesCombinaisons\}\s+aria-label="Vérifier toutes les combinaisons trouvées"\s*\/>/.test(ligne),
    'interrupteur `src/ui` branché sur l’état');
  const bulle = sansCommentaires.match(/<HelpPopover title="Combinaisons confirmées">([\s\S]*?)<\/HelpPopover>/)?.[1] ?? '';
  ok(/Vérifier toutes\s+les combinaisons trouvées/.test(bulle), 'infobulle de l’en-tête : renvoie à l’interrupteur');

  const cli = lire('scripts/optimizer-search.ts');
  ok(/vérifier toutes les combinaisons trouvées \$\{toutVerifierDeLaRecette\(recipe\) \? 'ON' : 'off'\}/.test(cli), 'CLI : la ligne de résumé de la recette cite l’interrupteur');
  ok(/Number\.isFinite\(resolu\.K\)/.test(cli) && /toutes les combinaisons trouvées \(« Vérifier toutes les combinaisons trouvées » dans la recette\)/.test(cli),
    'CLI : la console dit quand la file vérifie tout');
}
