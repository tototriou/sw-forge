// Les vraies entrées CLI : la liste est comparée à ce que le manifeste a exécuté.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { egal, ok, titre } from './outils';
import { inventaire, selectionner } from './selection';

const racine = resolve('.');
async function cli(args: string[]) {
  return new Promise<{ code: number | null; sortie: string }>((fini, echec) => {
    const p = spawn(process.execPath, ['tests/run.mjs', ...args], { cwd: racine, stdio: ['ignore', 'pipe', 'pipe'] });
    let sortie = '';
    p.stdout.on('data', (d) => { sortie += d; });
    p.stderr.on('data', (d) => { sortie += d; });
    p.on('error', echec);
    p.on('close', (code) => fini({ code, sortie }));
  });
}
const noms = (sortie: string) => [...sortie.matchAll(/^  (\w+) — /gm)].map((m) => m[1]);

export async function testRunSelection(): Promise<void> {
  titre('Lanceur — prévisualisation, sélection finale et garde de volume');
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-run-selection-'));
  try {
    const manifeste = join(dossier, 'execution.json');
    const filtres = ['suivilecture', 'compteaffichable'];
    const apercu = await cli(['--lister', '--silencieux', '--manifeste', manifeste, ...filtres]);
    egal(apercu.code, 0, 'prévisualisation : code 0');
    egal(noms(apercu.sortie), ['testSuiviLecture', 'testCompteAffichable'], 'filtres multiples : ordre du registre et liste exacte, même en silence');
    ok(!existsSync(manifeste) && !apercu.sortie.includes('vérifications passées') && apercu.sortie.includes('aucune vérification lancée'),
      'prévisualisation : aucun manifeste ni bilan d’exécution');
    ok(apercu.sortie.includes('filtre par nom :'), 'raison donnée pour les noms filtrés');
    const lance = await cli(['--max-entrees', '2', '--manifeste', manifeste, ...filtres]);
    egal(lance.code, 0, 'limite égale à la sélection : exécution autorisée');
    const preuve = JSON.parse(readFileSync(manifeste, 'utf8'));
    egal(noms(apercu.sortie), preuve.attendues, 'liste prévisualisée = attendues du manifeste');
    egal(noms(apercu.sortie), preuve.entrees.map((e: { id: string }) => e.id), 'liste prévisualisée = entrées exécutées');
    rmSync(manifeste);
    const refuse = await cli(['--max-entrees', '1', '--manifeste', manifeste, ...filtres]);
    ok(refuse.code === 2 && refuse.sortie.includes('dépassé') && !existsSync(manifeste), 'garde dépassée : refus avant toute exécution');

    // Sélection réelle du dépôt, sérialisée comme par --depuis : les noms finaux
    // développent le groupe et conservent les prérequis calculés par selectionner.
    const inv = await inventaire(racine);
    const selection = join(dossier, 'selection.json');
    const parFichiers = selectionner(inv, ['tests/import-equipes.test.ts'], inv.sourceIndex, 'essai');
    ok(!parFichiers.complet && parFichiers.execution.groupes.length > 0, 'sélection réelle contenant un groupe d’étalements');
    writeFileSync(selection, JSON.stringify({
      execution: { complet: false, noms: ['testCompteAffichable'], groupes: parFichiers.execution.groupes },
      retenues: parFichiers.retenues.filter((r) => r.genre === 'etalement'),
    }));
    const union = await cli(['--lister', '--selection', selection, 'suivilecture']);
    const unionNoms = noms(union.sortie);
    ok(union.code === 0 && unionNoms.includes('testSuiviLecture') && unionNoms.length > 1 && union.sortie.includes('groupe d’étalements'),
      'union fichiers + filtre : étalements développés et raisons conservées');
    const unionRun = await cli(['--selection', selection, 'suivilecture', '--manifeste', manifeste, '--silencieux']);
    if (unionRun.code !== 0) throw new Error('Union réelle : ' + unionRun.sortie);
    const unionPreuve = JSON.parse(readFileSync(manifeste, 'utf8'));
    ok(unionRun.code === 0 && unionPreuve.complet, 'union réelle exécutée avec succès');
    egal(unionNoms, unionPreuve.attendues, 'union prévisualisée = attendues du manifeste dans l’ordre du registre');
    egal(unionNoms, unionPreuve.entrees.map((e: { id: string }) => e.id), 'union prévisualisée = union exécutée, ordre et étalements compris');
    const pre = selectionner(inv, ['tests/persistance.test.ts'], inv.sourceIndex, 'essai');
    writeFileSync(selection, JSON.stringify(pre));
    const prerequis = await cli(['--lister', '--selection', selection]);
    ok(prerequis.code === 0 && noms(prerequis.sortie).includes('testStockage') && prerequis.sortie.includes('prérequis d’ordre'.replace('’', "'")),
      'prévisualisation : prérequis de stockage conservé et expliqué');
    writeFileSync(selection, JSON.stringify({ execution: { complet: false, noms: [], groupes: [] } }));
    const vide = await cli(['--lister', '--max-entrees', '0', '--selection', selection]);
    ok(vide.code === 0 && /Entrées finales \(0\//.test(vide.sortie), 'sélection vide autorisée avec limite zéro');
    writeFileSync(selection, JSON.stringify({ execution: { complet: false, noms: ['absenteDuRegistre'], groupes: [] } }));
    const incoherent = await cli(['--lister', '--selection', selection]);
    ok(incoherent.code === 1 && incoherent.sortie.includes('incohérente'), 'sélection incohérente : erreur avant exécution');

    const repli = await cli(['--depuis', 'reference-inexistante-workflow', '--lister', '--max-entrees', '0']);
    ok(repli.code === 2 && repli.sortie.includes('SUITE COMPLÈTE') && repli.sortie.includes('lecture de Git a échoué') && repli.sortie.includes('dépassé'),
      'repli Git : suite complète annoncée puis refusée par la garde, sans réduction silencieuse');
    const invalide = [ ['--max-entrees'], ['--max-entrees', '-1'], ['--max-entrees', '1.5'], ['--max-entrees', '9007199254740992'],
      ['--inconnue'], ['--depuis'], ['--plage', 'HEAD'], ['--depuis', 'HEAD', '--plage', 'HEAD..HEAD'], ['--lister', '--lister'] ];
    for (const args of invalide) {
      const r = await cli(args);
      ok(r.code === 2 && r.sortie.includes('Refus'), 'arguments invalides refusés : ' + args.join(' '));
    }
    const inconnu = await cli(['--lister', 'filtre-inexistant-workflow']);
    ok(inconnu.code === 1 && inconnu.sortie.includes('Disponibles'), 'filtre inconnu : même échec que l’exécution');
  } finally { rmSync(dossier, { recursive: true, force: true }); }
}
