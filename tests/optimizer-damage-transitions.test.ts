import { readFileSync } from 'fs';
import ts from 'typescript';
import { egal, ok, titre } from './outils';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';

export default function testOptimizerDamageTransitions() {
  titre('Optimizer · contexte de dégâts aux cinq transitions');

  // Le contrat de production est exercé avec une valeur distincte sur chaque
  // catégorie ; les cinq chemins UI sont contrôlés à leurs points d'appel.
  const avant: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: 123, enemyDef: 2345, leaderSkill: { stat: 'Attack Speed', pct: 24 },
    leaderSpeedPct: 19, enemyDestroyedHpPct: 7,
    defBreakParLeSort: true, sacrificeReservePct: 42,
    passifsOffensifs: { 123: true }, effetsCibleCount: { 123: 3 },
    effetsCibleCountAutres: false, buffsPropresCountAutres: false,
  };
  const attendu = damageSetupApresChangementMonstre(avant);
  for (const evenement of ['espèce', 'exemplaire', 'liste'] as const) {
    const apres = damageSetupApresChangementMonstre(avant);
    egal(apres, attendu, `${evenement} : transition de production commune`);
    egal(apres.enemyDef, 2345, `${evenement} : contexte préservé`);
    egal(apres.leaderSpeedPct, 19, `${evenement} : compatibilité du lead préservée`);
    egal(apres.skillCom2usId, null, `${evenement} : sort vidé`);
    egal(apres.passifsOffensifs, {}, `${evenement} : passifs du monstre vidés`);
    egal(apres.defBreakParLeSort, false, `${evenement} : état du sort vidé`);
    egal(apres.sacrificeReservePct, 0, `${evenement} : réserve du sort vidée`);
    egal(apres.effetsCibleCountAutres, true, `${evenement} : marqueur associé au compteur remis au défaut`);
  }
  // L'import de recette écrit directement sa valeur ; le compte suit l'autre
  // branche explicite de resetSearch.
  const recette = buildOptimizerRecipe({
    monsterCom2usId: 14104, monsterName: 'Monstre du test',
    requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
    damageSetup: avant, metric: 'eff', slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: false, artifactMainByKind: {},
  });
  const relue = parseOptimizerRecipe(JSON.stringify(recette));
  ok(!!relue.recipe, 'recette : import de production accepté');
  egal(relue.recipe!.damageSetup, avant, 'recette : valeurs transportées intactes');
  egal(DEFAULT_DAMAGE_SETUP.enemyDef, 1000, 'compte : retour au défaut complet');

  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  const hook = readFileSync('src/hooks/useOptimizerState.ts', 'utf8');
  const app = readFileSync('src/App.tsx', 'utf8');
  ok(/if \(id !== selectedId\)\s*\{\s*resetSearch\(\)/.test(ecran), 'espèce : resetSearch de production');
  ok(ecran.includes('if (source !== gearSource) resetDamageSkill()'), 'exemplaire : changement de source');
  ok(ecran.includes('setSourceSelector(c.selector);') && ecran.includes('resetDamageSkill();\n            setSourceSelector(c.selector)'), 'exemplaire : désambiguïsation');
  ok(ecran.includes('onSelect={choisirListe}') && ecran.includes('onCreate={creerListe}'), 'liste : sélection et création');
  ok(ecran.includes('setDamageSetup(recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP)'), 'recette : import direct');
  ok(app.includes("optimizer.resetSearch('compte')"), 'compte : motif explicite');
  ok(hook.includes("motif === 'compte' ? DEFAULT_DAMAGE_SETUP : damageSetupApresChangementMonstre(s)"), 'resetSearch : deux branches de production');

  const source = ts.createSourceFile('damage.ts', readFileSync('src/lib/damage.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((s): s is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(s) && s.name.text === 'DamageSetup');
  ok(!!declaration, 'interface DamageSetup trouvée');
  const champs = declaration!.members.filter(ts.isPropertySignature).map((p) => p.name.getText(source)).sort();
  egal(Object.keys(DAMAGE_SETUP_CLASSIFICATION).sort(), champs, 'tous les champs actuels sont classés une seule fois');
}
