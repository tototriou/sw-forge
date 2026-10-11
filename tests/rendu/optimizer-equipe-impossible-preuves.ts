import { exclusionSelectorKey } from '../../src/lib/optimizerExclusion';
import { bouton, deplierListes, type BancRetouches } from './optimizer-retouches-preuves';

const MESSAGE = 'Pas assez de monstres pour faire une équipe : rajoute des monstres dans la liste.';
export async function preuvesEquipeImpossible(b: BancRetouches, cas: string): Promise<[boolean, string][]> {
  await deplierListes(b);
  const initial = b.listes();
  const gardes = cas === 'zero-libre' ? [] : cas === 'un-libre' ? [b.premier] : [b.premier, b.second];
  await b.geste(() => b.listes().replaceAfterRevalidation({ ...initial,
    members: initial.members.filter(m => m.listId !== 'a' || gardes.some(s => exclusionSelectorKey(s) === exclusionSelectorKey(m.selector))),
    // Une référence conservée d'équipe peut pointer hors des propositions actuelles.
    teams: cas === 'deux-dont-un-lie' ? [{ id: 'autre', listId: 'a', members: [b.premier, { source: 'box', unitKey: '33' }], lead: null }] : [],
  }));
  const preuves: [boolean,string][] = [];
  const ouvrir = bouton('Lier une équipe');
  preuves.push([!!ouvrir && !ouvrir.disabled, `${cas} : déclencheur actif malgré le nombre de membres libres`]);
  if (!ouvrir || ouvrir.disabled) return preuves;
  const avant=ouvrir.getBoundingClientRect(), etatInitial=JSON.stringify(b.listes().teams);
  await b.geste(()=>ouvrir.click());
  await new Promise(r=>setTimeout(r,250));
  const dialogue=document.querySelector<HTMLElement>('[role="dialog"]')!;
  preuves.push([!!dialogue && dialogue.textContent?.includes(MESSAGE) === true, `${cas} : message exact dans la fenêtre`]);
  const cases=[...dialogue.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  preuves.push([cases.length === (cas==='zero-libre'?0:1), `${cas} : seul le membre libre reste proposé, aucun membre d'une autre équipe`]);
  if (cases.length) await b.geste(()=>cases[0].click());
  preuves.push([bouton('Lier',dialogue).disabled, 'Lier reste désactivé même après sélection du membre libre']);
  await b.geste(()=>bouton('Annuler',dialogue).click());
  preuves.push([!document.querySelector('[role="dialog"]') && JSON.stringify(b.listes().teams)===etatInitial, 'Annuler ferme sans modifier les équipes']);
  await b.geste(()=>ouvrir.click());
  await b.geste(()=>bouton('Fermer',document.querySelector('[role="dialog"]')!).click());
  const apres=ouvrir.getBoundingClientRect();
  preuves.push([!document.querySelector('[role="dialog"]') && avant.x===apres.x && avant.y===apres.y, 'la croix ferme et le déclencheur conserve sa place']);
  await b.geste(()=>{
    b.listes().replaceAfterRevalidation({ ...initial, teams: [{ id:'existante',listId:'a',members:[b.premier,b.second],lead:null }] });
  });
  await b.geste(()=>bouton('Modifier l’équipe').click());
  const edition=document.querySelector<HTMLElement>('[role="dialog"]')!;
  preuves.push([!edition.textContent?.includes(MESSAGE) && edition.querySelectorAll('input[type="checkbox"]:checked').length===2
    && !bouton('Enregistrer',edition).disabled, 'équipe existante : ses membres restent proposés et enregistrables sans message']);
  await b.geste(()=>bouton('Annuler',edition).click());
  await b.geste(()=>b.listes().setActiveListId(null));
  preuves.push([!bouton('Lier une équipe') || bouton('Lier une équipe').disabled, 'sans liste active : aucun déclencheur actif']);
  preuves.push([document.documentElement.scrollWidth<=innerWidth, 'aucun débordement horizontal aux deux formats']);
  return preuves;
}
