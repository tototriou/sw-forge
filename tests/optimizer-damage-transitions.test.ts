import { readFileSync } from 'fs';
import ts from 'typescript';
import { egal, ok, titre } from './outils';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';

export default function testOptimizerDamageTransitions() {
  titre('Optimizer · contexte de dégâts aux cinq transitions');

  // Le contrat de production est exercé avec une valeur distincte sur chaque
  // catégorie ; les événements UI sont contrôlés à leurs points d'appel.
  const avant: DamageSetup = {
    ...DEFAULT_DAMAGE_SETUP,
    skillCom2usId: 123, enemyDef: 2345, leaderSkill: { stat: 'Attack Speed', pct: 24 },
    leaderSpeedPct: 19, enemyDestroyedHpPct: 7,
    defBreakParLeSort: true, sacrificeReservePct: 42,
    passifsOffensifs: { 123: true }, effetsCibleCount: { 123: 3 },
    effetsCibleCountAutres: false, buffsPropresCountAutres: false,
    premierCoupIgnoreDefParSort: { 14808: 2 },
  };
  const attendu = damageSetupApresChangementMonstre(avant);
  const apres = damageSetupApresChangementMonstre(avant);
  egal(apres, attendu, 'espèce différente : transition de production');
  egal(apres.enemyDef, 2345, 'espèce différente : contexte préservé');
  egal(apres.leaderSpeedPct, 19, 'espèce différente : compatibilité du lead préservée');
  egal(apres.skillCom2usId, null, 'espèce différente : sort vidé');
  egal(apres.passifsOffensifs, {}, 'espèce différente : passifs du monstre vidés');
  egal(apres.defBreakParLeSort, false, 'espèce différente : état du sort vidé');
  egal(apres.sacrificeReservePct, 0, 'espèce différente : réserve du sort vidée');
  egal(apres.premierCoupIgnoreDefParSort, undefined, 'espèce différente : rang d’ignore DEF du sort vidé');
  egal(apres.effetsCibleCountAutres, true, 'espèce différente : marqueur associé au compteur remis au défaut');
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
  ok(ecran.includes('if (id !== selectedId) resetSearch();'), 'membre de liste : seule une autre espèce provoque le reset');
  ok(!ecran.includes('resetDamageSkill'), 'exemplaire et listes : aucun reset propre au sort');
  ok(ecran.includes('onSelect={lists.setActiveListId}') && ecran.includes('onCreate={lists.createList}') && ecran.includes('onDelete={lists.deleteList}'), 'navigation et gestion des listes sans reset');
  ok(ecran.includes('const id = lists.createList(nom);'), 'création et ajout depuis la fenêtre sans reset');
  ok(ecran.includes('damageSetup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP'), 'recette : import direct sans capture');
  ok(app.includes("optimizer.resetSearch('compte')"), 'compte : motif explicite');
  ok(hook.includes("motif === 'compte' ? 'compte' : 'membre'") && hook.includes('criteresApresChangementEspece({ damageSetup: s, compterAurasResPre, critereArtefacts }, raison, undefined).damageSetup'), 'resetSearch : deux motifs transmis au producteur pur');
  ok(!hook.includes('resetDamageSkill'), 'hook : aucune transition superflue sur les listes ou exemplaires');

  titre('Optimizer · changement d’exemplaire de la même espèce');

  // Changer d'exemplaire efface les résultats affichés, comme un changement
  // d'espèce ; l'utilisateur relance lui-même. Le dépôt n'a pas de test React : l'arbre syntaxique du hook
  // établit CE qui est effacé, l'écran QUAND.
  const sourceHook = ts.createSourceFile('useOptimizerState.ts', hook, ts.ScriptTarget.Latest, true);
  const fonctionDuHook = (nom: string) => {
    let trouvee: ts.FunctionDeclaration | undefined;
    const visiter = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) && n.name?.text === nom) trouvee = n;
      else ts.forEachChild(n, visiter);
    };
    visiter(sourceHook);
    return trouvee;
  };
  const instructions = (f: ts.FunctionDeclaration | undefined) => f?.body?.statements.map((s) => s.getText(sourceHook)) ?? [];
  egal(
    instructions(fonctionDuHook('effacerResultats')),
    ['setResultsPage(1);', 'setStoppedManually(false);', 'setOpenDetailKey(null);', 'search.reset();'],
    'effacerResultats : résultat et progression, page, arrêt manuel, détail ouvert — aucun critère, aucun réglage de combat'
  );
  const corpsReset = instructions(fonctionDuHook('resetSearch'));
  ok(corpsReset.includes('effacerResultats();'), 'resetSearch (changement d’espèce) efface par la MÊME fonction');
  ok(!corpsReset.includes('search.reset();'), '… sans copie de l’effacement qui pourrait diverger');
  ok(/resetSearch,\s*effacerResultats,\s*\};/.test(hook), 'le hook expose effacerResultats');
  ok(
    /if \(id !== selectedId\) resetSearch\(\);(?:\s*\/\/[^\n]*)*\s*else if \(key !== ownSelectorKey\) effacerResultats\(\);\s*setSelectedId\(id\);/.test(ecran),
    'membre de liste de la même espèce, autre exemplaire : résultats effacés, sans resetSearch ni relance'
  );
  ok(ecran.includes('const key = exclusionSelectorKey(m.selector);'), '… « autre exemplaire » = le sélecteur du membre cliqué…');
  ok(ecran.includes('const ownSelectorKey = sourceSelector ? exclusionSelectorKey(sourceSelector) : null;'), '… comparé à celui de l’exemplaire affiché (recliquer le même n’efface rien)');

  const source = ts.createSourceFile('damage.ts', readFileSync('src/lib/damage.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((s): s is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(s) && s.name.text === 'DamageSetup');
  ok(!!declaration, 'interface DamageSetup trouvée');
  const champs = declaration!.members.filter(ts.isPropertySignature).map((p) => p.name.getText(source)).sort();
  egal(Object.keys(DAMAGE_SETUP_CLASSIFICATION).sort(), champs, 'tous les champs actuels sont classés une seule fois');
}
