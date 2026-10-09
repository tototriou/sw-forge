import { readFileSync } from 'node:fs';
import { navigateurOptimizer } from './optimizer-navigable-banc';
import { ok, titre } from '../outils';

async function verifier(source: 'rta' | 'reco' | 'flottant', telephone: boolean) {
  titre(`Export vers l’Optimizer · ${source} · ${telephone ? 'téléphone' : 'bureau'}`);
  const { browser, page } = await navigateurOptimizer(telephone, 'tests/rendu/rta-reco-export-banc.tsx');
  try {
    if (process.env.CAPTURES) {
      await page.evaluate(async ({ source, telephone }) => (globalThis as unknown as {
        bancOptimizer: { afficherSource: (source: string, telephone: boolean) => Promise<void> };
      }).bancOptimizer.afficherSource(source, telephone), { source, telephone });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${process.env.CAPTURES}/export-${source}-source-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: !telephone, animations: 'disabled' });
    }
    for (const motif of ['accepte', ...(source === 'rta' ? [] : ['second']), 'indisponible', 'attente', 'collision', 'vide']) {
      const preuves = await page.evaluate(async ({ source, telephone, motif, capture }) => (globalThis as unknown as {
        bancOptimizer: { scenario: (source: string, telephone: boolean, motif: string, conserverRapport: boolean) => Promise<[boolean, string][]> };
      }).bancOptimizer.scenario(source, telephone, motif, capture), { source, telephone, motif, capture: !!process.env.CAPTURES });
      ok(preuves.length > 0, `${source}/${motif} : vrais contrôles et hooks`);
      for (const [condition, texte] of preuves) ok(condition, texte);
      if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/export-${source}-${motif}-${telephone ? 'telephone' : 'bureau'}.png`, fullPage: !telephone, animations: 'disabled' });
    }
  } finally { await browser.close(); }
}
export const testRenduRtaExportOptimizer = () => verifier('rta', false);
export const testRenduTelephoneRtaExportOptimizer = () => verifier('rta', true);
export const testRenduRecoExportOptimizer = () => verifier('reco', false);
export const testRenduTelephoneRecoExportOptimizer = () => verifier('reco', true);
export const testRenduOptimizerImportRecommandation = () => verifier('flottant', false);
export const testRenduTelephoneOptimizerImportRecommandation = () => verifier('flottant', true);

export function testOptimizerImportRtaRecoBranchement() {
  titre('Import Optimizer · parents RTA, recommandation et flottant');
  const lire = (fichier: string) => readFileSync(fichier, 'utf8');
  const montage = (fichier: string, composant: string) => {
    const texte = lire(fichier), debut = texte.indexOf(`<${composant}`), fin = texte.indexOf('/>', debut);
    ok(debut >= 0 && fin > debut, `${fichier} : montage ${composant} trouvé`);
    return debut >= 0 && fin > debut ? texte.slice(debut, fin) : '';
  };
  const rta = montage('src/App.tsx', 'RtaPage'), siege = montage('src/pages/SiegePage.tsx', 'RecoBoard');
  for (const prop of ['onImporterEquipe={importerEquipe}', 'sourcesOptimizer={optimizerData}', 'compteCharge={box.length > 0 || runes.length > 0}']) ok(rta.includes(prop), `App → RTA : ${prop}`);
  for (const prop of ['onImporterEquipe={boardProps.onImporterEquipe}', 'sourcesOptimizer={boardProps.sourcesOptimizer}', 'compteCharge={boardProps.compteCharge}']) ok(siege.includes(prop), `Siège → recommandations : ${prop}`);
  ok(lire('src/pages/RtaPage.tsx').includes('const exporterOptimizer = () => onImporterEquipe(importerPrepaRtaOptimizer);'), 'RTA appelle le producteur de toute la prépa par l’action commune');
  ok(montage('src/components/siege/RecoBoard.tsx', 'RecoCard').includes('onExporterDeckOptimizer={deck => onImporterEquipe(data => importerRecoOptimizer(deck, data))}'), 'board → carte : même action et seul deck transmis');
  ok(montage('src/App.tsx', 'OutilsPage').includes('recommandations={recos.state.recos}'), 'App → outils : recommandations courantes');
  ok(montage('src/pages/OutilsPage.tsx', 'OptimizerSection').includes('recommandations={recommandations}'), 'outils → Optimizer : recommandations relayées');
  const app = lire('src/App.tsx');
  ok(app.includes("if (route !== 'outils' || toolSub !== 'optimizer') setRapportExportOptimizer(rapport);")
    && app.includes('<OptimizerImportRapport rapport={rapportExportOptimizer}'), 'rapport de toute origine externe en modale, interne dans le flottant');
}
