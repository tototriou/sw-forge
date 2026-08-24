// Point d'entrée des vérifications — `npm test`.
//
// ⚠️ L'ORDRE compte un peu : `persistance` installe un faux `localStorage`
// global et le laisse en place. On le passe en dernier pour qu'il ne perturbe
// rien d'autre.

import { bilan } from './outils';
import testImport from './import.test';
import testPersistance from './persistance.test';
import testMeules, { testPalier, testRegistre, testSansDowngrade } from './meules.test';
import testArtefacts from './artefacts.test';
import testReco, {
  testTrimPartage,
  testDefensesVisees,
  testRechercheMonstre,
  testRechercheMultiple,
  testDecksMontables,
  testFormesJouables,
} from './reco.test';
import testRtaPartage from './rta-partage.test';
import testCouleursCourbes from './courbe-couleurs.test';
import testRechargement from './rechargement.test';
import testCollabPaires from './collab-paires.test';
import testRuneOptim from './rune-optim.test';
import testRuneOptimDifferential from './rune-optim-differential.test';
import testRuneOptimScaleMonotonicity from './rune-optim-scale-monotonicity.test';
import testRuneOptimParallelPairing from './rune-optim-parallel-pairing.test';
import testRuneOptimParallelTruncated from './rune-optim-parallel-truncated.test';
import testRuneOptimDeadHalfPruning from './rune-optim-dead-half-pruning.test';
import testFilterSlotTopK from './rune-optim-filterslot-topk.test';
import testOptimizerExclusion from './optimizer-exclusion.test';
import testSetsIntangible from './sets-intangible.test';
import testRuneTri from './rune-tri.test';
import testMonstreTri from './monstre-tri.test';
import testMonstreFormes from './monstre-formes.test';
import testStockage from './stockage.test';
import testVitesse from './vitesse.test';
import testSpeedTune, { testSpeedTuneDeck, testSpeedTuneChaine, testSpeedTuneKit, testSpeedTuneSequence, testSpeedTuneReference, testSpeedTunePassif, testSpeedTuneAuto } from './speed-tune.test';

// Chaque vérification sous son NOM, dans l'ordre d'exécution.
//
// ⚠️ L'ORDRE compte un peu (voir plus haut) : `persistance` reste en dernier.
//
// Ce registre permet de ne lancer QUE ce qu'on touche :
//     node tests/run.mjs speed-tune       (tout ce dont le nom contient « speedtune »)
//     node tests/run.mjs rune-optim vitesse
// Sans argument, tout tourne — c'est ce que fait `npm test`, et ce qu'il FAUT
// faire avant une fusion sur `main` (voir CLAUDE.md).
const VERIFICATIONS: [string, () => void | Promise<void>][] = [
  ['testVitesse', testVitesse],
  ['testSpeedTune', testSpeedTune],
  ['testSpeedTuneDeck', testSpeedTuneDeck],
  ['testSpeedTuneChaine', testSpeedTuneChaine],
  ['testSpeedTuneKit', testSpeedTuneKit],
  ['testSpeedTuneSequence', testSpeedTuneSequence],
  ['testSpeedTuneReference', testSpeedTuneReference],
  ['testSpeedTunePassif', testSpeedTunePassif],
  ['testSpeedTuneAuto', testSpeedTuneAuto],
  ['testImport', testImport],
  ['testReco', testReco],
  ['testDefensesVisees', testDefensesVisees],
  ['testTrimPartage', testTrimPartage],
  ['testRechercheMonstre', testRechercheMonstre],
  ['testRechercheMultiple', testRechercheMultiple],
  ['testDecksMontables', testDecksMontables],
  ['testFormesJouables', testFormesJouables],
  ['testRtaPartage', testRtaPartage],
  ['testSetsIntangible', testSetsIntangible],
  ['testRuneTri', testRuneTri],
  ['testMonstreTri', testMonstreTri],
  ['testMonstreFormes', testMonstreFormes],
  ['testCouleursCourbes', testCouleursCourbes],
  ['testRechargement', testRechargement],
  ['testCollabPaires', testCollabPaires],
  ['testRuneOptim', testRuneOptim],
  ['testRuneOptimDifferential', testRuneOptimDifferential],
  ['testRuneOptimScaleMonotonicity', testRuneOptimScaleMonotonicity],
  ['testRuneOptimParallelPairing', async () => { await testRuneOptimParallelPairing(); }],
  ['testRuneOptimParallelTruncated', testRuneOptimParallelTruncated],
  ['testRuneOptimDeadHalfPruning', testRuneOptimDeadHalfPruning],
  ['testFilterSlotTopK', testFilterSlotTopK],
  ['testOptimizerExclusion', testOptimizerExclusion],
  ['testMeules', testMeules],
  ['testArtefacts', testArtefacts],
  ['testRegistre', testRegistre],
  ['testSansDowngrade', testSansDowngrade],
  ['testPalier', testPalier],
  ['testStockage', async () => { await testStockage(); }],
  ['testPersistance', async () => { await testPersistance(); }],
];

// Un filtre passé en argument : on compare sur le nom mis à plat (sans tirets ni
// casse), pour que « speed-tune », « speedtune » et « SpeedTune » marchent tous.
function retenues(filtres: string[]): [string, () => void | Promise<void>][] {
  if (filtres.length === 0) return VERIFICATIONS;
  const plat = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cibles = filtres.map(plat);
  return VERIFICATIONS.filter(([nom]) => cibles.some((c) => plat(nom).includes(c)));
}

async function main() {
  const filtres = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const liste = retenues(filtres);
  if (liste.length === 0) {
    console.error(
      `
[31mAucune vérification ne correspond à[0m ${filtres.join(' ')}
` +
        `Disponibles : ${VERIFICATIONS.map(([n]) => n).join(', ')}`
    );
    process.exit(1);
  }
  if (filtres.length > 0) {
    console.log(
      `[33mVérifications ciblées[0m (${liste.length}/${VERIFICATIONS.length}) : ` +
        liste.map(([n]) => n).join(', ') +
        `
[33m⚠️  La suite complète reste obligatoire avant une fusion sur main.[0m
`
    );
  }
  for (const [, fn] of liste) await fn();

  const { total, echecs, ignores } = bilan();
  const resume =
    echecs === 0
      ? `\n\x1b[32m${total} vérifications passées\x1b[0m` + (ignores ? `, ${ignores} ignorée(s)` : '')
      : `\n\x1b[31m${echecs} échec(s)\x1b[0m sur ${total} vérifications`;
  console.log(resume);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n\x1b[31mLes vérifications se sont interrompues :\x1b[0m', err);
  process.exit(1);
});
