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
import testRuneOptim from './rune-optim.test';
import testRuneOptimDifferential from './rune-optim-differential.test';
import testSetsIntangible from './sets-intangible.test';
import testRuneTri from './rune-tri.test';
import testMonstreTri from './monstre-tri.test';
import testMonstreFormes from './monstre-formes.test';
import testStockage from './stockage.test';
import testVitesse from './vitesse.test';

async function main() {
  testVitesse();
  testImport();
  testReco();
  testDefensesVisees();
  testTrimPartage();
  testRechercheMonstre();
  testRechercheMultiple();
  testDecksMontables();
  testFormesJouables();
  testRtaPartage();
  testSetsIntangible();
  testRuneTri();
  testMonstreTri();
  testMonstreFormes();
  testRuneOptim();
  testRuneOptimDifferential();
  testMeules();
  testArtefacts();
  testRegistre();
  testSansDowngrade();
  testPalier();
  await testStockage();
  await testPersistance();

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
