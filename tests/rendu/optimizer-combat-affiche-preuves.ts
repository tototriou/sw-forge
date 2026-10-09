import type { OptimizerState } from '../../src/hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';
import type { SearchParams } from '../../src/lib/runeBuildOptim';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';

interface Banc {
  etat: () => OptimizerState;
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
  troisieme: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (texte: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button')]
  .find(e => visible(e) && (e.textContent?.trim() === texte || e.getAttribute('aria-label') === texte))!;
async function choisirMenu(b: Banc, label: string, valeur: string, racine: ParentNode = document) {
  await b.geste(() => {
    const menu = [...racine.querySelectorAll<HTMLSelectElement>(`select[aria-label="${label}"]`)].find(visible)!;
    menu.value = valeur; menu.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export async function preuvesCombatAfficheOptimizer(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  await b.geste(() => {
    b.listes().setListContent('a', 'guilde');
    b.listes().setTeams([{ id: 'ea', listId: 'a', members: [b.premier, b.second, b.troisieme],
      lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } }]);
  });
  // La préparation publie les critères après l'équipe pour établir le lead
  // initial affiché ; les étapes suivantes ne changent plus ces critères.
  await b.geste(() => {
    b.etat().setDamageSetup(s => ({ ...s, leaderSkill: { stat: 'HP', pct: 44 }, leaderSpeedPct: 19 }));
    b.etat().setObjective('degats_reels');
  });
  const pli = bouton('Monstres à optimiser');
  if (pli) await b.geste(() => pli.click());
  const selection = () => JSON.stringify([b.etat().selectedId, b.etat().sourceSelector]);
  const membre = selection();
  const personnel = JSON.stringify(b.etat().damageSetup);
  const memoire = () => JSON.stringify(b.listes().memories.get(cleMemoireMembre('a', b.premier)));
  const photo = memoire();
  const carte = [...document.querySelectorAll('p')].find(e => visible(e) && e.textContent === 'État de mon monstre')!.parentElement!.parentElement!;
  const menuType = carte.querySelector<HTMLSelectElement>('select[aria-label="Type de leader skill"]')!;
  const lireAffichage = () => ({ type: menuType.value, libelle: menuType.selectedOptions[0]?.textContent,
    valeur: [...carte.querySelectorAll<HTMLSelectElement>('select[aria-label="Valeur du leader skill"]')].find(visible)?.value ?? null,
    motif: [...carte.querySelectorAll('span')].find(e => visible(e) && e.textContent === 'Cette portée de lead est inactive pour ce contenu.')?.textContent ?? null });
  async function ouvrirEquipe() {
    const groupe = [...document.querySelectorAll<HTMLElement>('section[aria-label="Équipe 1"]')].find(visible)!;
    await b.geste(() => bouton('Modifier l’équipe', groupe).click());
    return document.querySelector<HTMLElement>('[role="dialog"]')!;
  }
  const messages: SearchParams[] = [], vraiWorker = globalThis.Worker;
  // Observer la frontière réelle du hook sans exécuter le moteur de runes.
  class WorkerObserve {
    postMessage(params: SearchParams) { messages.push(params); }
    terminate() {}
  }
  globalThis.Worker = WorkerObserve as unknown as typeof Worker;
  async function constater(etape: string, type: string, libelle: string, valeur: string | null, inactif = false) {
    const affiche = lireAffichage();
    verifier(menuType.isConnected && visible(menuType) && affiche.type === type && affiche.libelle === libelle
      && affiche.valeur === valeur, `${etape} : menus d’État de mon monstre — ${JSON.stringify(affiche)}`);
    verifier(inactif ? affiche.motif !== null : affiche.motif === null, `${etape} : motif affiché seulement quand le lead est inactif`);
    verifier(selection() === membre && JSON.stringify(b.etat().damageSetup) === personnel && memoire() === photo,
      `${etape} : même membre affiché, critères personnels et mémoire intacts`);
    await b.geste(() => bouton('Modifier la description du combat').click());
    const dialogue = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const echo = [...dialogue.querySelectorAll('p')].find(e => visible(e) && e.textContent?.includes('État du monstre :'))?.textContent ?? '';
    verifier(echo.includes('État du monstre :') && (valeur ? echo.includes(`lead ${type} +${valeur} %`) : !/lead [^·]+ \+/.test(echo)),
      `${etape} : écho de Dégâts réels — ${echo}`);
    await b.geste(() => bouton('Fermer', dialogue).click());
    const avant = messages.length;
    await b.geste(() => bouton('Rechercher').click());
    const params = messages[avant];
    verifier(messages.length === avant + 1 && params?.metric === 'eff' && params.objective === 'degats_reels'
      && params.base.spd === 100 && params.requirement.minStats.spd === 230 && params.requirement.sets.includes('swift'),
      `${etape} : lancement observé, metric=${params?.metric}, objectif=${params?.objective}, minimum VIT=${params?.requirement.minStats.spd}`);
    await b.geste(() => b.etat().effacerResultats());
  }
  try {
    await constater('Membre lié initial', 'Attack Speed', 'VIT', '24');
    let dialogue = await ouvrirEquipe();
    await choisirMenu(b, 'Valeur du lead de l’équipe', '33', dialogue);
    await b.geste(() => bouton('Enregistrer', dialogue).click());
    await constater('Lead changé dans le dialogue', 'Attack Speed', 'VIT', '33');
    await choisirMenu(b, 'Contenu de la liste', 'donjon');
    await constater('Contenu incompatible', '', 'Aucun', null, true);
    dialogue = await ouvrirEquipe();
    await b.geste(() => dialogue.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[0].click());
    await b.geste(() => bouton('Enregistrer', dialogue).click());
    verifier(b.listes().teams.length === 1 && b.listes().teams[0].members.length === 2
      && !b.listes().teams[0].members.some(s => JSON.stringify(s) === JSON.stringify(b.premier)),
      'retrait par le dialogue : équipe des deux autres membres conservée');
    await constater('Membre retiré de l’équipe', 'HP', 'PV', '44');
  } finally {
    await b.geste(() => b.etat().effacerResultats());
    globalThis.Worker = vraiWorker;
  }
  return preuves;
}
