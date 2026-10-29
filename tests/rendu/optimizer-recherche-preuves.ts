import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { SiegeTeam } from '../../src/types';
import type { ExclusionSelector, ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';

interface Banc {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  data: () => ExclusionSourceData;
  changerBox: (box: BoxItem[]) => void;
  changerDefenses: (teams: SiegeTeam[]) => void;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
  troisieme: ExclusionSelector;
}
const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (texte: string) => [...document.querySelectorAll<HTMLButtonElement>('button')]
  .find(e => visible(e) && e.textContent?.trim().startsWith(texte))!;
async function rechercher(b: Banc, nom = 'Premier') {
  const champ = [...document.querySelectorAll<HTMLInputElement>('[placeholder="Rechercher un monstre…"]')].find(visible)!;
  await b.geste(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, nom);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(e => visible(e) && e.textContent?.includes(nom))!;
  await b.geste(() => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
}
async function creer(b: Banc) {
  const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const menu = dialogue.querySelector<HTMLSelectElement>('[aria-label="Contenu de la liste"]')!;
  await b.geste(() => { menu.value = 'arene'; menu.dispatchEvent(new Event('change', { bubbles: true })); });
  const action = [...dialogue.querySelectorAll<HTMLButtonElement>('button')].find(e => e.textContent?.trim() === 'Créer')!;
  await b.geste(() => action.click());
  return b.listes().activeListId;
}

export async function preuvesRechercheOptimizer(b: Banc, nom: string): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [];
  const verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const membres = () => b.listes().members.filter(m => m.listId === b.listes().activeListId);
  const memoire = (selector: ExclusionSelector) => b.listes().memories.get(cleMemoireMembre(b.listes().activeListId!, selector));
  const capture = (selector: ExclusionSelector, spd: number | undefined) => {
    verifier(membres().length === 1 && egal(membres()[0].selector, selector), 'seul l’exemplaire explicitement résolu est ajouté');
    verifier(memoire(selector)?.criteres.minStats.spd === spd && egal(memoire(selector)?.criteres, photoCriteres(b.etat(), { type: 'personnel' })),
      'capture complète des critères au geste de résolution');
    verifier(egal(b.etat().proprietaireCriteres?.selector, selector) && b.etat().proprietaireCriteres?.listId === b.listes().activeListId,
      'résolution : propriétaire attribué au membre de la liste active');
  };
  await b.geste(() => b.listes().replaceAfterRevalidation({ ...b.listes(), members: [], validated: [],
    memories: new Map(), identities: new Map(), teams: [] }));
  const gerer = bouton('Gérer mes listes');
  if (gerer?.getAttribute('aria-expanded') === 'false') await b.geste(() => gerer.click());
  if (nom === 'deja-membre') {
    const criteres = baseCompleteCriteres(undefined); criteres.minStats = { spd: 243 };
    await b.geste(() => b.listes().replaceAfterRevalidation({ ...b.listes(),
      members: [{ listId: 'a', selector: b.troisieme }],
      memories: new Map([[cleMemoireMembre('a', b.troisieme), { listId: 'a', selector: b.troisieme, com2usId: 10101, criteres }]]) }));
    const avant = JSON.stringify(memoire(b.troisieme));
    await rechercher(b);
    verifier(egal(b.etat().sourceSelector, b.premier) && membres().length === 2,
      'recherche : premier Box absent ajouté sans rappeler le membre présent de cette espèce');
    verifier(JSON.stringify(memoire(b.troisieme)) === avant,
      'membre présent : sa mémoire reste intacte');
  } else if (nom === 'box-resolu') {
    await b.geste(() => { b.etat().setSelectedId('1'); b.etat().setMinStats({ spd: 257 }); });
    await rechercher(b);
    verifier(membres().length === 1 && egal(membres()[0].selector, b.premier), 'recherche Box : premier exemplaire résolu ajouté automatiquement');
    verifier(memoire(b.premier)?.criteres.minStats.spd === 257 && egal(memoire(b.premier)?.criteres, photoCriteres(b.etat(), { type: 'personnel' })),
      'ajout automatique : capture complète des critères du geste ordinaire');
    verifier(egal(b.etat().proprietaireCriteres, { listId: 'a', selector: b.premier, com2usId: 10101 }), 'ajout automatique : propriétaire et identité exacts');
    verifier(!document.querySelector('[role="dialog"]'), 'liste active : aucune création demandée');
  } else if (nom === 'exemplaire-suivant') {
    await rechercher(b);
    verifier(membres().length === 1 && egal(b.etat().sourceSelector, b.premier), 'premier exemplaire inclus par la recherche');
    await b.geste(() => b.etat().setMinStats({ spd: 235 }));
    await b.geste(() => { b.etat().setDamageSetup(s => ({ ...s, enemyDef: 3456 })); b.etat().setResultsPage(3); });
    const criteresAvant = JSON.stringify(photoCriteres(b.etat(), { type: 'personnel' }));
    await rechercher(b);
    verifier(membres().length === 2 && egal(b.etat().sourceSelector, b.troisieme), 'recherche répétée : exemplaire Box suivant ajouté une seule fois');
    verifier(memoire(b.troisieme)?.criteres.minStats.spd === 235 && memoire(b.premier)?.criteres.minStats.spd === 235,
      'exemplaire suivant : critères conservés et capturés, mémoire du premier intacte');
    verifier(b.etat().resultsPage === 1 && JSON.stringify(photoCriteres(b.etat(), { type: 'personnel' })) === criteresAvant
      && JSON.stringify(memoire(b.troisieme)?.criteres) === criteresAvant,
      'transition Box suivante de l’espèce affichée : pagination effacée, critères et combat gardés et immédiatement capturés');
    await rechercher(b);
    verifier(membres().length === 2 && egal(b.etat().sourceSelector, b.troisieme), 'Box complète : clic refusé, sélection inchangée');
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(e => visible(e) && e.textContent?.includes('Premier'))!;
    verifier(option.getAttribute('aria-disabled') === 'true' && option.textContent?.includes('Les 2 Premier de ta Box sont dans la liste') === true,
      'ligne indisponible : affichée avec sa raison et aria-disabled');
    const champ = [...document.querySelectorAll<HTMLInputElement>('[placeholder="Rechercher un monstre…"]')].find(visible)!;
    await b.geste(() => champ.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    verifier(membres().length === 2 && egal(b.etat().sourceSelector, b.troisieme) && champ.value === 'Premier', 'ligne indisponible au clavier : Entrée refusée, champ conservé');
  } else if (nom === 'source-rta' || nom === 'source-siege' || nom === 'desambiguise' || nom === 'creation-sans-source') {
    await b.geste(() => b.changerBox(b.data().box.filter(m => m.monster.com2usId !== 10101)));
    if (nom === 'desambiguise') await b.geste(() => {
      const equipe = b.data().siegeDefenseTeams[0];
      b.changerDefenses([equipe, { ...equipe, id: 'defense2' }]);
    });
    if (nom === 'creation-sans-source') await b.geste(() => b.listes().setActiveListId(null));
    await rechercher(b);
    verifier(egal(b.etat().sourceSelector, { source: 'rta', monsterId: '1' }),
      'espèce sans Box : représentant RTA résolu immédiatement');
    if (nom === 'creation-sans-source') {
      verifier(!!document.querySelector('[role="dialog"]') && b.listes().lists.length === 2, 'sans liste : création ouverte avant résolution, aucune liste prématurée');
      const id = await creer(b);
      verifier(id !== null && b.listes().lists.find(l => l.id === id)?.name === 'Liste 1' && b.listes().listContents.get(id!) === 'arene',
        'création sans exemplaire : liste créée et active avec nom et contenu');
      capture({ source: 'rta', monsterId: '1' }, undefined);
    }
    await b.geste(() => b.etat().setMinStats({ spd: 321 }));
    const etatAvant = JSON.stringify({ criteres: photoCriteres(b.etat(), { type: 'personnel' }),
      source: b.etat().sourceSelector, gearSource: b.etat().gearSource, membres: b.listes().members, memoires: [...b.listes().memories] });
    const libelle = 'Défenses siège';
    const ancre = bouton(libelle), avantAncre = ancre.getBoundingClientRect();
    await b.geste(() => bouton(libelle).click());
    if (nom === 'desambiguise') {
      verifier(membres().length === 1 && egal(b.etat().sourceSelector, { source: 'rta', monsterId: '1' }), 'puce ambiguë : membre optimisé conservé');
      const ligne = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e)
        && e.textContent?.includes('Premier') && e.textContent.includes('Équipe 2'))!;
      await b.geste(() => ligne.click());
    }
    verifier(JSON.stringify({ criteres: photoCriteres(b.etat(), { type: 'personnel' }), source: b.etat().sourceSelector,
      gearSource: b.etat().gearSource, membres: b.listes().members, memoires: [...b.listes().memories] }) === etatAvant,
      'aperçu par puce ou zone D : critères, membre, sources et mémoires inchangés');
    verifier(document.body.textContent?.includes("Ce n'est pas l'exemplaire de la liste.") === true, 'aperçu annoncé avec Revenir');
    const apresAncre = ancre.getBoundingClientRect();
    verifier(Math.abs(avantAncre.x - apresAncre.x) < 1 && Math.abs(avantAncre.y - apresAncre.y) < 1,
      `aperçu : la puce cliquée reste en place (${avantAncre.y} → ${apresAncre.y})`);
    await b.geste(() => bouton(libelle).click());
    verifier(![...document.querySelectorAll('button')].some(e => visible(e) && e.textContent?.trim() === 'Revenir'), 'recliquer la puce allumée revient à la vue précédente');
    // Après annulation, une source seule ne doit pas inventer une liste.
    await b.geste(() => { b.listes().setActiveListId(null); b.etat().effacerProprietaireCriteres(); });
    await rechercher(b);
    await b.geste(() => bouton('Annuler').click());
    const total = b.listes().members.length;
    await b.geste(() => bouton('RTA').click());
    verifier(b.listes().activeListId === null && b.listes().members.length === total && b.etat().proprietaireCriteres === null,
      'sans liste après annulation : choix de source sans ajout ni création implicite');
  } else if (nom === 'non-possede' || nom === 'sans-liste-box') {
    const nonPossede = nom === 'non-possede';
    if (nonPossede) await b.geste(() => b.changerBox(b.data().box.filter(m => m.monster.com2usId !== 10102)));
    const selector: ExclusionSelector = nonPossede ? { source: 'unowned', monsterId: '2' } : b.second;
    if (nonPossede) {
      await rechercher(b, 'Second');
      verifier(egal(b.etat().sourceSelector, selector), 'espèce absente de toutes les sources : sélecteur non possédé résolu');
      capture(selector, undefined);
    }
    await b.geste(() => { b.listes().setActiveListId(null); b.etat().effacerProprietaireCriteres(); b.etat().setSelectedId('2'); b.etat().setMinStats({ spd: 219 }); });
    await rechercher(b, 'Second');
    verifier(!!document.querySelector('[role="dialog"]') && b.listes().activeListId === null, 'sans liste : création ouverte pour l’exemplaire résolu');
    const id = await creer(b);
    verifier(id !== null && b.listes().listContents.get(id!) === 'arene', 'liste créée et activée avec le contenu choisi');
    capture(selector, 219);
  } else throw new Error(`Scénario inconnu : ${nom}`);
  verifier(b.listes().rapportStockage.length === 0 && b.etat().rapportCriteres.length === 0, 'aucun message d’erreur de doublon ou de stockage');
  return preuves;
}
