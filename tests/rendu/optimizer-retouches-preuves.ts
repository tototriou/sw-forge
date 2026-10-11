import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
export interface BancRetouches {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
export const bouton = (nom: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .find(e => visible(e) && (e.textContent?.trim() === nom || e.getAttribute('aria-label') === nom))!;
export async function deplierListes(b: BancRetouches) {
  const gerer = bouton('Gérer mes listes');
  if (gerer?.getAttribute('aria-expanded') === 'false') await b.geste(() => gerer.click());
}
export async function preuvesCreationObligatoire(b: BancRetouches): Promise<[boolean, string][]> {
  await b.geste(() => b.listes().setActiveListId(null));
  const champ = [...document.querySelectorAll<HTMLInputElement>('[placeholder="Rechercher un monstre…"]')].find(visible)!;
  await b.geste(() => {
    champ.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, 'Second');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const choix = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(e => visible(e) && e.textContent?.includes('Second'))!;
  await b.geste(() => choix.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
  await new Promise(r => setTimeout(r, 250));
  const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  const creer = bouton('Créer', dialogue), styleVide = getComputedStyle(menu);
  const couleurVide = styleVide.borderTopColor;
  const preuves: [boolean, string][] = [
    [menu.value === '' && menu.selectedOptions[0].textContent === 'Choisis le contenu de la liste', 'création : invitation explicite, aucune présélection'],
    [menu.classList.contains('border-accent') && styleVide.borderTopWidth === '1px' && styleVide.boxShadow === 'none'
      && (styleVide.outlineStyle === 'none' || styleVide.outlineColor === 'rgba(0, 0, 0, 0)'),
      `contenu absent : contour accent unique de 1 px, aucun halo (${styleVide.borderTopWidth}, ${styleVide.boxShadow}, ${styleVide.outlineStyle}, ${styleVide.outlineColor})`],
    [dialogue.textContent?.includes("Obligatoire : le contenu décide des leads actifs et des compétences d'invocateur.") === true
      && !!document.getElementById(menu.getAttribute('aria-describedby')!), 'aide obligatoire sous le champ et liée au menu'],
    [creer.disabled && creer.title === "Choisis d'abord le contenu.", 'Créer grisé : infobulle du contenu à choisir'],
  ];
  const avant = creer.getBoundingClientRect();
  await b.geste(() => { menu.focus(); menu.value = 'guilde'; menu.dispatchEvent(new Event('change', { bubbles: true })); });
  await new Promise(r => setTimeout(r, 200));
  const apres = creer.getBoundingClientRect();
  preuves.push([!creer.disabled && !creer.title && menu.classList.contains('border-border') && getComputedStyle(menu).borderTopColor !== couleurVide,
    'contenu choisi : contour normal et Créer actif sans infobulle de blocage']);
  preuves.push([avant.x === apres.x && avant.y === apres.y, 'choix du contenu : action immobile']);
  preuves.push([document.documentElement.scrollWidth <= innerWidth, 'création sans débordement horizontal']);
  return preuves;
}
