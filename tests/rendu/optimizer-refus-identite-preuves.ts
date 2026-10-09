import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';

export async function preuvesRefusIdentitePerime(c: {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (action: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const refus = () => c.etat().rapportCriteres.some(m => m.includes('identité enregistrée'));
  const cle = cleMemoireMembre('a', c.premier);
  const identities = new Map(c.listes().identities);
  identities.set(cle, { listId: 'a', selector: c.premier, com2usId: 99999 });
  await c.geste(() => c.listes().replaceAfterRevalidation({ ...c.listes(), identities }));
  await c.geste(() => c.etat().choisirMembre('a', c.premier));
  verifier(refus() && document.body.textContent!.includes('l’identité enregistrée'), 'refus réel d’identité affiché');
  await c.geste(() => c.listes().removeMember('b', c.premier));
  const avant = JSON.stringify([...c.listes().memories]);
  verifier(refus(), 'changer une autre liste garde le refus encore pertinent');
  await c.geste(() => c.listes().setActiveListId('b'));
  verifier(!refus() && !document.body.textContent!.includes('l’identité enregistrée'), 'liste sans ce membre : refus périmé effacé du hook et de l’écran');
  await c.geste(() => c.listes().setActiveListId('a'));
  await c.geste(() => c.etat().choisirMembre('a', c.premier));
  verifier(refus(), 'revenir à l’identité incompatible produit un nouveau refus');
  await c.geste(() => {
    c.etat().capturerMembre('b', c.second);
    c.listes().setActiveListId('b');
  });
  verifier(!refus() && c.etat().rapportCriteres.some(m => m.includes('Critères non mémorisés')),
    'même réconciliation : refus périmé effacé et Critères non mémorisés conservé');
  verifier(document.body.textContent!.includes('Critères non mémorisés'), 'refus de capture conservé aussi à l’écran');
  verifier(JSON.stringify([...c.listes().memories]) === avant, 'aucun refus ni changement de contexte ne réattribue les mémoires');
  await c.geste(() => c.listes().setActiveListId('a'));
  await c.geste(() => c.etat().choisirMembre('a', c.premier));
  await c.geste(() => c.listes().removeMember('a', c.premier));
  verifier(!refus(), 'retirer le membre fait disparaître le contexte du refus');
  return preuves;
}
