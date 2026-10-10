import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import { retirerMembreEquipeOptimizer } from '../../src/lib/equipesOptimizer';

interface Banc {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (texte: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')].find(b => visible(b) && (b.textContent?.trim() === texte || b.getAttribute('aria-label') === texte))!;
async function ouvrirListe(b: Banc) {
  const pli = bouton('Monstres à optimiser');
  if (pli) await b.geste(() => pli.click());
}
async function choisirMenu(b: Banc, label: string, valeur: string) {
  await b.geste(() => {
    const racine = document.querySelector('[role="dialog"]') ?? document;
    const menu = [...racine.querySelectorAll<HTMLSelectElement>(`[aria-label="${label}"]`)].find(visible)!;
    menu.value = valeur; menu.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export async function preuvesLeadEquipeOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const memoire = (selector = b.premier, listId = 'a') => b.listes().memories.get(cleMemoireMembre(listId, selector))?.criteres.damageSetup;
  const porte = (setup: { leaderSkill?: { stat: string; pct: number } | null; leaderSpeedPct?: number } | undefined, stat: string | null, pct?: number) =>
    !!setup && (stat === null ? !setup.leaderSkill : setup.leaderSkill?.stat === stat && setup.leaderSkill.pct === pct) && setup.leaderSpeedPct === undefined;
  // Le membre affiché, sa mémoire et le combat lu portent le même lead.
  const partout = (stat: string | null, pct?: number) => porte(memoire(), stat, pct) && porte(b.etat().damageSetup, stat, pct)
    && porte(b.etat().lireCombatMembre().setup, stat, pct);
  await ouvrirListe(b);
  await b.geste(() => b.etat().setDamageSetup(s => ({ ...s, leaderSkill: { stat: 'HP', pct: 33 }, leaderSpeedPct: 19 })));
  verifier(memoire()?.leaderSkill?.pct === 33 && memoire()?.leaderSpeedPct === 19, 'hors équipe : lead personnel moderne et ancien en mémoire');
  const creer = (id: string, listId: string, amount: number) => ({ id, listId, members: [b.premier, b.second], lead: { stat: 'Attack Speed', amount, area: 'Guild', element: null } });
  await b.geste(() => {
    b.listes().setListContent('a', 'guilde'); b.listes().setListContent('b', 'guilde');
    b.listes().setTeams([creer('ea', 'a', 24), creer('eb', 'b', 33)]);
  });
  verifier(partout('Attack Speed', 24), 'rejoindre l’équipe écrase le lead personnel : mémoire, critères et combat portent le lead d’équipe, ancien champ effacé');
  verifier(porte(memoire(b.second), 'Attack Speed', 24), 'membre sans mémoire : la synchronisation lui en crée une qui porte le lead d’équipe');
  await b.geste(() => b.etat().setMinStats({ spd: 245 }));
  verifier(partout('Attack Speed', 24), 'modifier un autre critère garde le lead d’équipe en mémoire');
  await choisirMenu(b, 'Type de leader skill', 'HP');
  await choisirMenu(b, 'Valeur du leader skill', '44');
  verifier(b.listes().teams[0].lead?.stat === 'HP' && b.listes().teams[0].lead?.amount === 44 && b.listes().teams[0].lead?.area === 'Guild', 'État de mon monstre écrit dans le lead partagé en gardant sa portée');
  verifier(partout('HP', 44) && porte(memoire(b.second), 'HP', 44), 'le lead personnel de chaque membre suit le changement du lead d’équipe');
  verifier(document.body.textContent!.includes('le modifier change le lead de toute l’équipe'), 'écriture partagée annoncée à l’écran');
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  verifier(porte(b.etat().damageSetup, 'HP', 44) && porte(b.etat().lireCombatMembre().setup, 'HP', 44), 'autre membre : même lead partagé, affiché comme le sien');
  await b.geste(() => b.listes().setActiveListId('b'));
  await b.geste(() => b.etat().choisirMembre('b', b.premier));
  verifier(porte(b.etat().lireCombatMembre().setup, 'Attack Speed', 33) && porte(memoire(b.premier, 'b'), 'Attack Speed', 33),
    'même exemplaire dans deux listes : lead propre à Bêta, écrit dans la mémoire de Bêta');
  await b.geste(() => b.listes().setActiveListId('a'));
  await b.geste(() => b.etat().choisirMembre('a', b.premier));
  verifier(partout('HP', 44), 'retour sur Alpha : la mémoire d’Alpha n’a pas pris le lead de Bêta');
  const changerLead = (lead: NonNullable<UseOptimizerLists['teams'][number]['lead']>) => b.geste(() => b.listes().setTeams(b.listes().teams.map(e => e.id === 'ea' ? { ...e, lead } : e)));
  await changerLead({ stat: 'Attack Speed', amount: 24, area: 'Element', element: 'water' });
  verifier(partout(null) && b.etat().lireCombatMembre().motif?.includes('élément') === true, 'autre élément : lead personnel « Aucun », raison explicite');
  verifier([...document.querySelectorAll('section[aria-label="Équipe 1"] button')].some(e => visible(e)
    && e.getAttribute('aria-label') === 'Lead inactif : Le lead ne concerne pas l’élément de ce membre.'), 'lead d’élément inactif : motif sur l’icône de la carte');
  await changerLead({ stat: 'Attack Speed', amount: 24, area: 'Guild', element: null });
  verifier(partout('Attack Speed', 24), 'lead de nouveau actif : le lead personnel le reprend');
  await b.geste(() => b.listes().setListContent('a', 'donjon'));
  verifier(partout(null) && b.etat().lireCombatMembre().motif?.includes('inactive') === true, 'contenu incompatible : lead inactif, lead personnel « Aucun »');
  await b.geste(() => b.listes().replaceAfterRevalidation({ ...b.listes(), listContents: new Map([['b', 'guilde']]) }));
  verifier(partout(null) && document.body.textContent!.includes('Sans contenu : aucun lead d’équipe appliqué.'), 'liste historique sans contenu : aucun lead et message visible');
  await b.geste(() => b.listes().setListContent('a', 'guilde'));
  await changerLead({ stat: 'Resistance', amount: 41, area: 'General', element: null });
  verifier(partout(null) && document.body.textContent!.includes('sans effet calculé'), 'lead de RES conservé et affiché, sans effet calculé ni lead personnel');
  await changerLead({ stat: 'Attack Speed', amount: 24, area: 'Guild', element: null });
  await b.geste(() => b.listes().setTeams(retirerMembreEquipeOptimizer(b.listes().teams, 'ea', b.premier).teams));
  verifier(b.listes().teams.length === 1 && b.listes().teams[0].id === 'eb', 'retirer un membre d’une équipe de deux dissout seulement cette équipe');
  verifier(partout('Attack Speed', 24) && porte(memoire(b.second), 'Attack Speed', 24), 'quitter l’équipe garde le dernier lead d’équipe : rien n’est restauré');
  return preuves;
}

export async function preuvesDialogueEquipeOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await ouvrirListe(b);
  await choisirMenu(b, 'Contenu de la liste', 'guilde');
  const ancre = bouton('Lier une équipe'), avant = ancre.getBoundingClientRect();
  await b.geste(() => ancre.click());
  const apres = ancre.getBoundingClientRect();
  verifier(avant.x === apres.x && avant.y === apres.y, 'ouvrir le dialogue ne déplace pas son déclencheur');
  const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  verifier(!!dialogue && !!bouton('Fermer', dialogue), 'dialogue : titre et croix visibles');
  for (const index of [0, 1]) await b.geste(() => dialogue.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index].click());
  await choisirMenu(b, 'Type de lead de l’équipe', 'Attack Speed');
  await choisirMenu(b, 'Valeur du lead de l’équipe', '24');
  await choisirMenu(b, 'Portée du lead de l’équipe', 'Guild');
  verifier(b.listes().teams.length === 0 && !document.querySelector('section[aria-label="Équipe 1"]'), 'cocher et choisir un lead ne regroupe rien pendant le dialogue');
  await b.geste(() => bouton('Lier', dialogue).click());
  verifier(b.listes().teams.length === 1 && !document.querySelector('[role="dialog"]'), 'lier publie à la fermeture du dialogue');
  const groupe = [...document.querySelectorAll<HTMLElement>('section[aria-label="Équipe 1"]')].find(visible)!;
  verifier(!!groupe && groupe.textContent!.includes('+24%') && groupe.querySelector('img[src*="leader_skill_Attack_Speed_Guild"]') !== null, 'zone C : groupe et LeadPill du jeu');
  const memoire = JSON.stringify([...b.listes().memories]);
  await b.geste(() => bouton('Modifier l’équipe', groupe).click());
  await choisirMenu(b, 'Valeur du lead de l’équipe', '33');
  verifier(b.listes().teams[0].lead?.amount === 24, 'modification du dialogue reste un brouillon');
  await b.geste(() => bouton('Annuler', document.querySelector('[role="dialog"]')!).click());
  verifier(b.listes().teams[0].lead?.amount === 24, 'annuler garde l’équipe originale');
  await b.geste(() => bouton('Modifier l’équipe', groupe).click());
  await b.geste(() => bouton('Délier', document.querySelector('[role="dialog"]')!).click());
  verifier(b.listes().teams.length === 0 && b.listes().members.length === 10 && JSON.stringify([...b.listes().memories]) === memoire, 'délier garde tous les membres et toutes les mémoires');
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'écran sans débordement horizontal');
  return preuves;
}

export async function preuvesContenuCreationOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await ouvrirListe(b);
  const selecteur = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && e.textContent?.includes('Alpha') && e.getAttribute('aria-expanded') !== null)!;
  await b.geste(() => selecteur.click()); await b.geste(() => bouton('Nouvelle liste…').click());
  const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
  const champ = dialogue.querySelector<HTMLInputElement>('[aria-label="Nom de la liste"]')!;
  await b.geste(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, 'Donjon manuel');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await choisirMenu(b, 'Contenu de la liste', 'donjon');
  verifier(b.listes().lists.length === 2, 'création en brouillon : aucune liste avant validation');
  await b.geste(() => bouton('Créer', dialogue).click());
  const id = b.listes().activeListId!;
  verifier(b.listes().lists.length === 3 && b.listes().listContents.get(id) === 'donjon', 'création manuelle depuis le menu : contenu choisi et liste active');
  await choisirMenu(b, 'Contenu de la liste', 'arene');
  verifier(b.listes().listContents.get(id) === 'arene', 'contenu modifiable depuis la liste affichée');
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'création et sélecteur contenus dans le format');
  return preuves;
}
