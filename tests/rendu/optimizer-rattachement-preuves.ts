import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { RuneDetail } from '../../src/types';
import { exclusionSelectorKey, otherValidatedRuneIds, type ExclusionSelector, type ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { cleMemoireMembre, reverifierStockageOptimizer } from '../../src/lib/optimizerMemberStorage';
import { acquerirIdentitesMembres } from '../../src/lib/optimizerRattachement';

interface Contexte {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  data: () => ExclusionSourceData;
  runes: () => RuneDetail[];
  changerBox: (box: BoxItem[]) => void;
  changerRunes: (runes: RuneDetail[]) => void;
  afficher: (visible: boolean) => void;
  geste: (action: () => void) => Promise<void>;
  premier: ExclusionSelector;
}
export async function preuvesRattachementOptimizer(c: Contexte, demonte = false): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (condition: boolean, texte: string) => preuves.push([condition, texte]);
  await c.geste(() => c.etat().choisirMembre('a', c.premier));
  await c.geste(() => {
    c.listes().validateBuild('a', c.premier, c.runes().map(r => r.id), [], 10101);
    c.etat().setMinStats({ spd: 255 });
  });
  const origine = acquerirIdentitesMembres(c.listes(), c.data());
  const memoire = JSON.stringify(origine.memories.get(cleMemoireMembre('a', c.premier)));
  if (demonte) await c.geste(() => c.afficher(false));
  const nouveau = { ...c.data(), box: c.data().box.filter(b => b.key !== '11') };
  const runes = c.runes().slice(0, -1), ids = new Set(runes.map(r => r.id));
  const resultat = reverifierStockageOptimizer(origine, nouveau, ids);
  await c.geste(() => {
    c.changerBox(nouveau.box); c.changerRunes(runes);
    c.listes().replaceAfterRevalidation(resultat.stockage);
    c.etat().appliquerReverificationMembres(resultat.stockage, resultat.rapport, nouveau, ids);
  });
  const cible = resultat.rapport.rattachements.find(r => r.listId === 'a' && exclusionSelectorKey(r.avant) === exclusionSelectorKey(c.premier))!.apres;
  verifier(c.etat().selectedId === '1' && exclusionSelectorKey(c.etat().sourceSelector!) === exclusionSelectorKey(cible), 'sélection de même espèce suit le rattachement');
  verifier(exclusionSelectorKey(c.etat().proprietaireCriteres!.selector) === exclusionSelectorKey(cible) && c.etat().minStats.spd === 255,
    'propriétaire et critères suivent, même écran démonté');
  const migree = c.listes().memories.get(cleMemoireMembre('a', cible))!;
  verifier(JSON.stringify({ ...migree, selector: c.premier }) === memoire, 'rattachement automatique : aucune nouvelle photo des critères');
  verifier(c.listes().validated[0].runeIds.length === 6 && c.listes().validated[0].runesManquantes?.length === 1, 'build conservé avec une rune disparue');
  verifier(!otherValidatedRuneIds(c.listes().validated, 'a', null).has(106), 'rune disparue non réservée');
  await c.geste(() => c.etat().setMinStats({ spd: 260 }));
  verifier(c.listes().memories.get(cleMemoireMembre('a', cible))?.criteres.minStats.spd === 260
    && !c.listes().memories.has(cleMemoireMembre('a', c.premier)), 'saisie après rattachement vers la nouvelle clé uniquement');
  if (demonte) await c.geste(() => c.afficher(true));
  const visible = (element: Element) => element.getBoundingClientRect().width > 0 && getComputedStyle(element).visibility !== 'hidden';
  const pli = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => visible(b) && b.textContent?.includes('Monstres à optimiser'));
  if (pli) await c.geste(() => pli.click());
  verifier([...document.querySelectorAll('[role="status"]')].some(e => visible(e) && e.textContent?.includes('1 rune(s) absente(s)')), 'fiche : marque explicite du build incomplet');
  verifier(document.body.textContent!.includes('Build conservé ;') || [...document.querySelectorAll('[title]')].some(e => e.getAttribute('title')?.includes('Build conservé ;')),
    'zone C : build conservé et réservation dite');
  const bouton = [...document.querySelectorAll<HTMLElement>('[aria-label="Voir le runage réellement porté"]')].find(visible)!;
  const avant = bouton.getBoundingClientRect();
  await c.geste(() => bouton.click());
  const apres = bouton.getBoundingClientRect();
  verifier(avant.x === apres.x && avant.y === apres.y, 'bascule de la fiche : le clic ne déplace pas le bouton');
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'aucun débordement horizontal du format');
  return preuves;
}
