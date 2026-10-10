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
  const memoire = () => b.listes().memories.get(cleMemoireMembre('a', b.premier))!.criteres.damageSetup;
  await ouvrirListe(b);
  await b.geste(() => b.etat().setDamageSetup(s => ({ ...s, leaderSkill: { stat: 'HP', pct: 33 }, leaderSpeedPct: 19 })));
  const personnel = JSON.stringify(memoire());
  const creer = (id: string, listId: string, amount: number) => ({ id, listId, members: [b.premier, b.second], lead: { stat: 'Attack Speed', amount, area: 'Guild', element: null } });
  await b.geste(() => {
    b.listes().setListContent('a', 'guilde'); b.listes().setListContent('b', 'guilde');
    b.listes().setTeams([creer('ea', 'a', 24), creer('eb', 'b', 33)]);
  });
  verifier(b.etat().lireCombatMembre().setup.leaderSkill?.pct === 24 && b.etat().lireCombatMembre().setup.leaderSpeedPct === undefined, 'lead effectif de l’équipe, champ ancien neutralisé');
  verifier(b.etat().damageSetup.leaderSkill?.pct === 33 && JSON.stringify(memoire()) === personnel, 'lier garde le lead personnel moderne et ancien');
  await b.geste(() => b.etat().setMinStats({ spd: 245 }));
  verifier(JSON.stringify(memoire()) === personnel, 'modifier un autre critère photographie le lead personnel');
  await choisirMenu(b, 'Type de leader skill', 'HP');
  await choisirMenu(b, 'Valeur du leader skill', '44');
  verifier(b.listes().teams[0].lead?.stat === 'HP' && b.listes().teams[0].lead?.amount === 44 && b.listes().teams[0].lead?.area === 'Guild', 'État de mon monstre écrit dans le lead partagé en gardant sa portée');
  verifier(JSON.stringify(memoire()) === personnel, 'modifier le lead effectif laisse le lead personnel intact');
  verifier(document.body.textContent!.includes('le modifier change le lead de toute l’équipe'), 'écriture partagée annoncée à l’écran');
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  verifier(b.etat().lireCombatMembre().setup.leaderSkill?.pct === 44, 'autre membre : même lead partagé');
  await b.geste(() => b.etat().setMinStats({ spd: 195 }));
  verifier(!b.listes().memories.get(cleMemoireMembre('a', b.second))!.criteres.damageSetup.leaderSkill, 'membre sans lead personnel : aucun lead effectif copié dans sa première mémoire');
  await b.geste(() => b.listes().setActiveListId('b'));
  await b.geste(() => b.etat().choisirMembre('b', b.premier));
  verifier(b.etat().lireCombatMembre().setup.leaderSkill?.pct === 33, 'même exemplaire dans deux listes : lead propre à Bêta');
  await b.geste(() => b.listes().setActiveListId('a'));
  await b.geste(() => b.etat().choisirMembre('a', b.premier));
  const changerLead = (lead: NonNullable<UseOptimizerLists['teams'][number]['lead']>) => b.geste(() => b.listes().setTeams(b.listes().teams.map(e => e.id === 'ea' ? { ...e, lead } : e)));
  await changerLead({ stat: 'Attack Speed', amount: 24, area: 'Element', element: 'water' });
  verifier(!b.etat().lireCombatMembre().setup.leaderSkill && !b.etat().lireCombatMembre().setup.leaderSpeedPct && b.etat().lireCombatMembre().motif?.includes('élément') === true, 'autre élément : aucun lead ni repli personnel, raison explicite');
  verifier([...document.querySelectorAll('section[aria-label="Équipe 1"] button')].some(e => visible(e)
    && e.getAttribute('aria-label') === 'Lead inactif : Le lead ne concerne pas l’élément de ce membre.'), 'lead d’élément inactif : motif sur l’icône de la carte');
  await changerLead({ stat: 'Attack Speed', amount: 24, area: 'Guild', element: null });
  await b.geste(() => b.listes().setListContent('a', 'donjon'));
  verifier(!b.etat().lireCombatMembre().setup.leaderSkill && b.etat().lireCombatMembre().motif?.includes('inactive') === true, 'contenu incompatible : lead inactif');
  await b.geste(() => b.listes().replaceAfterRevalidation({ ...b.listes(), listContents: new Map([['b', 'guilde']]) }));
  verifier(!b.etat().lireCombatMembre().setup.leaderSkill && document.body.textContent!.includes('Sans contenu : aucun lead d’équipe appliqué.'), 'liste historique sans contenu : aucun lead et message visible');
  await b.geste(() => b.listes().setListContent('a', 'guilde'));
  await changerLead({ stat: 'Resistance', amount: 41, area: 'General', element: null });
  verifier(!b.etat().lireCombatMembre().setup.leaderSkill && document.body.textContent!.includes('sans effet calculé'), 'lead de RES conservé et affiché, sans effet calculé');
  verifier(JSON.stringify(memoire()) === personnel, 'tous les changements de contenu et de lead laissent les critères personnels intacts');
  await b.geste(() => b.listes().setTeams(retirerMembreEquipeOptimizer(b.listes().teams, 'ea', b.premier).teams));
  verifier(b.listes().teams.length === 1 && b.listes().teams[0].id === 'eb', 'retirer un membre d’une équipe de deux dissout seulement cette équipe');
  verifier(b.etat().lireCombatMembre().setup.leaderSkill?.pct === 33 && b.etat().lireCombatMembre().setup.leaderSpeedPct === 19, 'délier rend immédiatement le lead personnel moderne et ancien');
  return preuves;
}

export async function preuvesDialogueEquipeOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await ouvrirListe(b);
  await choisirMenu(b, 'Contenu de la liste', 'guilde');
  const ancre = bouton('Lier une team'), avant = ancre.getBoundingClientRect();
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
