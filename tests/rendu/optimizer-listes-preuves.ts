import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';

interface Banc {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (texte: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .find(e => visible(e) && (e.textContent?.trim() === texte || e.getAttribute('aria-label') === texte))!;
export function boutonListeActive() {
  return [...document.querySelectorAll('p')].find(e => visible(e) && e.textContent === 'Liste active')!.parentElement!.querySelector<HTMLButtonElement>('button')!;
}
export async function ouvrirEditionListe(b: Banc) {
  const pli = bouton('Gérer mes listes');
  if (pli && pli.getAttribute('aria-expanded') === 'false') await b.geste(() => pli.click());
  const actif = b.listes().lists.find(l => l.id === b.listes().activeListId)!;
  if (boutonListeActive().getAttribute('aria-expanded') !== 'true') await b.geste(() => boutonListeActive().click());
  const ligne = [...document.querySelectorAll<HTMLElement>('[role="button"]')]
    .find(e => visible(e) && e.textContent?.trim().startsWith(`${actif.name} - `))!.parentElement!;
  await b.geste(() => bouton('Éditer la liste', ligne).click());
  return document.querySelector<HTMLElement>('[role="dialog"]')!;
}
export async function editerContenuListe(b: Banc, valeur: string) {
  const dialogue = await ouvrirEditionListe(b);
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  await b.geste(() => { menu.value = valeur; menu.dispatchEvent(new Event('change', { bubbles: true })); });
  await b.geste(() => bouton('Enregistrer', dialogue).click());
}

export async function preuvesEditionListeOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const dialogue = await ouvrirEditionListe(b);
  const champ = dialogue.querySelector<HTMLInputElement>('[aria-label="Nom de la liste"]')!;
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  verifier(dialogue.textContent?.includes('Éditer la liste') === true && champ.value === 'Alpha' && menu.value === '' && bouton('Enregistrer', dialogue).disabled,
    'liste ancienne : nom prérempli, contenu absent et enregistrement bloqué');
  await b.geste(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, 'Nouvelle Alpha');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    menu.value = 'guilde'; menu.dispatchEvent(new Event('change', { bubbles: true }));
  });
  verifier(b.listes().lists[0].name === 'Alpha' && !b.listes().listContents.has('a'), 'édition en brouillon : aucun changement publié');
  await b.geste(() => bouton('Annuler', dialogue).click());
  verifier(b.listes().lists[0].name === 'Alpha' && !b.listes().listContents.has('a'), 'annuler garde nom et contenu');
  const suivant = await ouvrirEditionListe(b);
  await b.geste(() => {
    const c = suivant.querySelector<HTMLInputElement>('[aria-label="Nom de la liste"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(c, 'Nouvelle Alpha');
    c.dispatchEvent(new Event('input', { bubbles: true }));
    const m = suivant.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
    m.value = 'guilde'; m.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await b.geste(() => bouton('Enregistrer', suivant).click());
  verifier(b.listes().lists[0].name === 'Nouvelle Alpha' && b.listes().listContents.get('a') === 'guilde', 'édition publie nom et contenu ensemble');
  verifier(boutonListeActive().textContent === 'Nouvelle Alpha - Guilde' && ![...document.querySelectorAll('[aria-label="Contenu de la liste"]')].some(visible),
    'page : Nom - Contenu et aucun sélecteur de contenu');
  return preuves;
}
async function rechercher(b: Banc) {
  const champ = [...document.querySelectorAll<HTMLInputElement>('[placeholder="Rechercher un monstre…"]')].find(visible)!;
  await b.geste(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, 'Second');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(e => visible(e) && e.textContent?.includes('Second'))!;
  await b.geste(() => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
}

export async function preuvesRechercheCreationOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await b.geste(() => b.listes().setActiveListId(null));
  await rechercher(b);
  let dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  verifier(!!dialogue && dialogue.textContent?.includes('Nouvelle liste') === true, 'recherche sans liste : création ouverte');
  verifier(bouton('Créer', dialogue).disabled, 'recherche : Créer bloqué sans contenu');
  await b.geste(() => bouton('Annuler', dialogue).click());
  verifier(!document.querySelector('[role="dialog"]') && b.etat().selectedId === '2' && b.listes().activeListId === null,
    'annuler garde le monstre affiché sans créer ni activer une liste');
  await rechercher(b);
  dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const contenu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  await b.geste(() => { contenu.value = 'arene'; contenu.dispatchEvent(new Event('change', { bubbles: true })); });
  verifier(!bouton('Créer', dialogue).disabled, 'nom vide et contenu choisi : Créer actif');
  await b.geste(() => bouton('Créer', dialogue).click());
  const id = b.listes().activeListId!, selector = b.etat().sourceSelector!;
  verifier(b.listes().lists.find(l => l.id === id)?.name === 'Liste 1' && b.listes().listContents.get(id) === 'arene',
    'création depuis la recherche : nom par défaut et contenu choisi');
  verifier(b.listes().members.some(m => cleMemoireMembre(m.listId, m.selector) === cleMemoireMembre(id, selector))
    && b.listes().memories.has(cleMemoireMembre(id, selector)) && b.etat().proprietaireCriteres?.listId === id,
    'exemplaire choisi ajouté avec sa mémoire et le bon propriétaire');
  await rechercher(b);
  verifier(!document.querySelector('[role="dialog"]') && b.listes().lists.length === 3, 'recherche avec liste active : aucune création');
  return preuves;
}
