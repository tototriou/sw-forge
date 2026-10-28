// Banc du hook de recherche (`useBuildOptimSearch`) au navigateur : ce que
// le VRAI hook poste au Worker de recherche, avec ou sans pont de
// l'application de bureau. Le transport seul est remplacé (un Worker qui note
// les demandes) : aucun moteur n'est lancé.
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useBuildOptimSearch } from '../../src/hooks/useBuildOptimSearch';
import type { SearchParams } from '../../src/lib/runeBuildOptim';
import type { DemandeDeRecherche } from '../../src/workers/runeBuildOptim.worker';
import { ClassementVideTest, demandeClassementTest } from '../classement-fixture';

type Preuves = [boolean, string][];
let lancer: ((params: SearchParams) => void) | null = null;

function Banc() {
  const recherche = useBuildOptimSearch();
  lancer = (params) => { const d = demandeClassementTest(params); recherche.run(params, d.photo, d.vue); };
  return <p>Banc de la recherche</p>;
}

async function geste(action: () => void) {
  flushSync(action);
  await new Promise((r) => setTimeout(r, 0));
  flushSync(() => {});
}

// Le pont que pose le préchargement du bureau, réduit à ce que lit le hook.
// `undefined` : le site, sans pont.
type Pont = { bureau: true; plateforme: string; coeursPhysiques: () => Promise<unknown> } | undefined;

async function demandeAvec(pont: Pont): Promise<{ demandes: DemandeDeRecherche[]; params: SearchParams }> {
  const g = globalThis as unknown as { swblacksmithBureau?: Pont; Worker: unknown };
  const vraiWorker = g.Worker;
  const demandes: DemandeDeRecherche[] = [];
  g.Worker = class extends ClassementVideTest {
    postMessage(demande: DemandeDeRecherche) {
      if (demande.type === 'recherche') demandes.push(demande);
      super.postMessage(demande);
    }
  };
  if (pont) g.swblacksmithBureau = pont;
  else delete g.swblacksmithBureau;
  const racine = document.createElement('div');
  document.body.appendChild(racine);
  const root: Root = createRoot(racine);
  try {
    await geste(() => root.render(<Banc />));
    // La réponse du pont arrive après le montage : la laisser se poser.
    await new Promise((r) => setTimeout(r, 20));
    const params = demandeClassementTest({ marque: 'paramètres de la recherche' } as unknown as SearchParams).params;
    await geste(() => lancer!(params));
    return { demandes, params };
  } finally {
    await geste(() => root.unmount());
    racine.remove();
    delete g.swblacksmithBureau;
    g.Worker = vraiWorker;
  }
}

export async function scenario(): Promise<Preuves> {
  const preuves: Preuves = [];
  const constater = async (cas: string, pont: Pont, attendu: number | null) => {
    const { demandes, params } = await demandeAvec(pont);
    const d = demandes[0];
    preuves.push([demandes.length === 1 && d?.type === 'recherche' && d.params !== params
      && JSON.stringify(d.params) === JSON.stringify(params),
      `${cas} : une demande de recherche, qui porte la copie figée des paramètres passés à run (${demandes.length} demande(s))`]);
    preuves.push([d?.coeursPhysiques === attendu, `${cas} : cœurs physiques de la demande = ${JSON.stringify(attendu)} (reçu ${JSON.stringify(d?.coeursPhysiques)})`]);
  };
  await constater('site, sans pont', undefined, null);
  await constater('bureau, 8 cœurs lus', { bureau: true, plateforme: 'win32', coeursPhysiques: async () => 8 }, 8);
  await constater('bureau, lecture en échec (null)', { bureau: true, plateforme: 'linux', coeursPhysiques: async () => null }, null);
  await constater('bureau, réponse illisible', { bureau: true, plateforme: 'win32', coeursPhysiques: async () => '8' }, null);
  await constater('bureau, réponse non entière', { bureau: true, plateforme: 'win32', coeursPhysiques: async () => 7.5 }, null);
  await constater('bureau, demande rejetée', { bureau: true, plateforme: 'win32', coeursPhysiques: () => Promise.reject(new Error('canal absent')) }, null);
  return preuves;
}
