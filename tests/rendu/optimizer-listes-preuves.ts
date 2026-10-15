import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../../src/lib/damage';

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

export async function preuvesCompetencesListeOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await b.geste(() => { b.etat().effacerProprietaireCriteres(); b.etat().setObjective('degats_reels'); b.etat().setDamageSetup(s => ({ ...s, summonerSkills: 'guilde' })); });
  const memorise = JSON.stringify([...b.listes().memories]);
  async function constater(mode: 'normal' | 'guilde', etape: string) {
    verifier(b.etat().lireCombatMembre().setup.summonerSkills === mode, `${etape} : combat lu depuis le contenu, sans propriétaire`);
    const carte = [...document.querySelectorAll('p')].find(e => visible(e) && e.textContent === 'État de mon monstre')!.parentElement!.parentElement!;
    verifier(!carte.textContent?.includes('Invocateur') && !carte.querySelector('[aria-label="Compétences d’invocateur"]'), `${etape} : aucun choix des compétences dans État de mon monstre`);
    await b.geste(() => bouton('Modifier la description du combat').click());
    const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const echo = [...dialogue.querySelectorAll('p')].find(e => e.textContent?.includes('État du monstre :'))?.textContent ?? '';
    verifier(mode === 'guilde' ? echo.includes('Contenu de guilde') : echo.includes('Contenu normal') && !echo.includes('Contenu de guilde'), `${etape} : écran du combat sous le même mode effectif`);
    await b.geste(() => bouton('Fermer', dialogue).click());
    const textes: Promise<string>[] = [], creerUrl = URL.createObjectURL, cliquer = HTMLAnchorElement.prototype.click;
    try {
      URL.createObjectURL = blob => { textes.push((blob as Blob).text()); return creerUrl(blob); };
      HTMLAnchorElement.prototype.click = function () { if (!this.download) cliquer.call(this); };
      const exporter = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e)
        && [...e.querySelectorAll('span')].some(s => visible(s) && ['Exporter', 'Exporter les paramètres de recherche'].includes(s.textContent?.trim() ?? '')))!;
      await b.geste(() => exporter.click());
      const recette = parseOptimizerRecipe(await textes[0]).recipe;
      verifier(recette?.damageSetup.summonerSkills === mode, `${etape} : vrai export sous le même mode effectif que l’écran`);
    } finally { URL.createObjectURL = creerUrl; HTMLAnchorElement.prototype.click = cliquer; }
    verifier(JSON.stringify([...b.listes().memories]) === memorise, `${etape} : mémoires conservées intactes`);
  }
  await constater('normal', 'Liste historique sans contenu');
  await editerContenuListe(b, 'guilde'); await constater('guilde', 'Guilde');
  await editerContenuListe(b, 'donjon'); await constater('normal', 'Donjon');
  await editerContenuListe(b, 'arene'); await constater('normal', 'Arène');
  const recette = buildOptimizerRecipe({ monsterCom2usId: 10101, monsterName: 'Premier', damageSetup: { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'guilde' },
    requirement: { sets: ['swift'], minStats: { spd: 240 } }, objective: 'vitesse', metric: 'eff', slotFilterPreset: 'moyen',
    adaptiveTrancheWeighting: false, exhaustiveSearch: false, excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
  const lire = File.prototype.text;
  try {
    File.prototype.text = async () => JSON.stringify(recette);
    const fichiers = new DataTransfer(); fichiers.items.add(new File([''], 'recette.json', { type: 'application/json' }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept=".json,application/json"]')!;
    await b.geste(() => { input.files = fichiers.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
    // La lecture du fichier est asynchrone : sous charge, elle peut finir
    // après le geste. Attendre son application, borné, avant de constater.
    for (let essai = 0; essai < 50 && b.etat().minStats.spd !== 240; essai++) await b.geste(() => {});
  } finally { File.prototype.text = lire; }
  verifier(b.etat().damageSetup.summonerSkills === 'guilde' && b.etat().minStats.spd === 240 && b.etat().proprietaireCriteres === null,
    'recette Contenu de guilde réellement importée sur liste Arène, sans propriétaire');
  await b.geste(() => b.etat().setObjective('degats_reels'));
  await constater('normal', 'Recette importée sur Arène');
  // Les index orphelins restent conservés, sans décider d’un combat hors liste.
  await b.geste(() => {
    b.listes().setActiveListId(null);
    b.listes().replaceAfterRevalidation({ ...b.listes(),
      listContents: new Map([...b.listes().listContents, ['orpheline', 'guilde']]) });
  });
  await constater('normal', 'Sans liste active');
  return preuves;
}
