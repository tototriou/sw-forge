import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import OptimizerEquipeDialog from '../../src/components/outils/OptimizerEquipeDialog';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import { ecrireMembresOptimizer, OPTIMIZER_MEMBERS_STORAGE_KEY, type EquipeOptimizer } from '../../src/lib/optimizerMemberStorage';
import { exclusionSelectorKey, type ExclusionSelector } from '../../src/lib/optimizerExclusion';
import type { Monster } from '../../src/types';
import type { BoxItem } from '../../src/lib/applyAccount';

const base = { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const box: BoxItem[] = Array.from({ length: 28 }, (_, i) => {
  const monster: Monster = { id: i + 1, com2usId: 10101 + i, name: `Membre ${String(i + 1).padStart(2, '0')}`,
    element: 'water', stars: 6, naturalStars: 5, secondAwaken: false, image: null,
    stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: i === 0 ? { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null }
      : i === 2 ? { stat: 'Resistance', amount: 41, area: 'Element', element: 'water' } : null };
  return { key: String(i + 1), monster, stars: 6, level: 40, gear: { base, runes: [], artifacts: [] } };
});
const membres: ExclusionSelector[] = box.map(b => ({ source: 'box', unitKey: b.key }));
const autre: EquipeOptimizer = { id: 'autre', listId: 'a', members: membres.slice(-2), lead: null };
const cible: EquipeOptimizer = { id: 'cible', listId: 'a', members: membres.slice(0, 3),
  lead: { stat: 'HP', amount: 44, area: 'Arena', element: null }, leader: membres[0] };
let listes: UseOptimizerLists, root: Root, fermee = false;

function Banc({ modification }: { modification: boolean }) {
  listes = useOptimizerLists();
  const [ouvert, setOuvert] = useState(true);
  return ouvert ? <OptimizerEquipeDialog contexte={listes} listId="a" equipe={modification ? cible : null}
    data={{ box, rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map() }}
    onValider={listes.setTeams} onClose={() => { fermee = true; setOuvert(false); }} /> : <p>Dialogue fermé</p>;
}
async function geste(action: () => void) {
  flushSync(action); await new Promise(r => setTimeout(r, 0)); flushSync(() => {});
}
export async function preparer(modification = false) {
  if (root) await geste(() => root.unmount());
  fermee = false; localStorage.clear(); setPersistence(true);
  localStorage.setItem('swblacksmith-optimizer-lists-v1', JSON.stringify({
    lists: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bêta' }], activeListId: 'a', validated: [],
    members: ['a', 'b'].flatMap(listId => membres.map(selector => ({ listId, selector }))),
  }));
  localStorage.setItem(OPTIMIZER_MEMBERS_STORAGE_KEY, ecrireMembresOptimizer({
    identities: new Map(), memories: new Map(), listContents: new Map([['a', 'guilde']]),
    teams: [autre, { ...cible, id: 'autre-liste', listId: 'b' }, ...(modification ? [cible] : [])],
    rejets: { memories: [], teams: [], listContents: [] },
  }));
  root = createRoot(document.getElementById('racine')!);
  await geste(() => root.render(<Banc modification={modification} />));
  await new Promise(r => setTimeout(r, 250));
}
const dialogue = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const menu = (label: string) => dialogue().querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
async function choisir(label: string, valeur: string) {
  await geste(() => { const el = menu(label); el.value = valeur; el.dispatchEvent(new Event('change', { bubbles: true })); });
}
const labels = ['Type de lead de l’équipe', 'Valeur du lead de l’équipe', 'Portée du lead de l’équipe', 'Élément du lead de l’équipe'];
const valeurs = () => labels.map(l => menu(l).value);
const bouton = (nom: string) => [...dialogue().querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === nom)!;
async function cocher(index: number) { await geste(() => dialogue().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[index].click()); }

export async function scenario(nom: string): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  if (nom === 'leader') {
    for (const modification of [false, true]) {
      await preparer(modification);
      if (!modification) for (const i of [0, 1, 2]) await cocher(i);
      else verifier(valeurs()[0] === 'HP' && valeurs()[1] === '44', 'ouvrir conserve le lead déjà édité malgré le leader désigné');
      const initial = JSON.stringify(listes.teams), disque = localStorage.getItem(OPTIMIZER_MEMBERS_STORAGE_KEY);
      await choisir('Leader de l’équipe', exclusionSelectorKey(membres[2]));
      verifier(JSON.stringify(valeurs()) === JSON.stringify(['Resistance', '41', 'Element', 'water']), 'leader élémentaire : les quatre menus reprennent son skill');
      verifier(menu(labels[0]).selectedOptions[0].textContent!.includes('sans effet calculé'), 'Résistance : valeur conservée et sans effet calculé affiché');
      verifier(dialogue().querySelector('[role="status"]')!.textContent!.includes('sans effet calculé'), 'la mention est lisible dans le corps, même si le menu tronque son libellé');
      await choisir('Leader de l’équipe', exclusionSelectorKey(membres[0]));
      verifier(valeurs()[0] === 'Attack Speed' && valeurs()[1] === '24' && valeurs()[2] === 'Guild' && menu(labels[3]).disabled, 'autre leader : type, montant et portée remplacés, élément désactivé');
      await choisir(labels[0], 'HP'); await choisir(labels[1], '44'); await choisir(labels[2], 'Element'); await choisir(labels[3], 'wind');
      verifier(JSON.stringify(valeurs()) === JSON.stringify(['HP', '44', 'Element', 'wind']), 'les quatre champs restent modifiables après le choix du leader');
      await choisir('Leader de l’équipe', '');
      verifier(JSON.stringify(valeurs()) === JSON.stringify(['HP', '44', 'Element', 'wind']), 'Aucun leader conserve les quatre champs édités');
      await choisir('Leader de l’équipe', exclusionSelectorKey(membres[1]));
      verifier(valeurs()[0] === '' && valeurs()[1] === '' && labels.slice(1).every(l => menu(l).disabled), 'leader sans skill : Aucun, menus dépendants désactivés');
      verifier(JSON.stringify(listes.teams) === initial && localStorage.getItem(OPTIMIZER_MEMBERS_STORAGE_KEY) === disque, 'tous les choix restent locaux : équipe et stockage inchangés');
      await choisir('Leader de l’équipe', exclusionSelectorKey(membres[2]));
      await geste(() => bouton(modification ? 'Enregistrer' : 'Lier').click());
      const publiee = listes.teams.find(e => e.listId === 'a' && e.id !== 'autre')!;
      verifier(fermee && publiee.lead?.stat === 'Resistance' && publiee.lead.amount === 41 && publiee.lead.area === 'Element' && publiee.lead.element === 'water', 'validation : skill complet publié et dialogue fermé');
      verifier(box[2].monster.leaderSkill?.amount === 41, 'le skill source reste intact');
    }
  } else if (nom === 'membres') {
    for (const modification of [false, true]) {
      await preparer(modification);
      const contenu = dialogue().textContent!;
      verifier(!contenu.includes('Membre 27') && !contenu.includes('Membre 28'), 'membres de l’autre équipe de la même liste absents');
      verifier(dialogue().querySelectorAll('input[type="checkbox"]').length === 26, 'seuls les membres disponibles sont proposés');
      verifier(contenu.includes('Membre 01') && contenu.includes('Membre 02') && contenu.includes('Membre 03'), 'les membres liés dans une autre liste ou dans l’équipe modifiée restent proposés');
      verifier(dialogue().querySelectorAll('input:checked').length === (modification ? 3 : 0), 'la modification garde la sélection propre à la cible');
      const avant = JSON.stringify(listes.teams);
      await cocher(3);
      verifier(JSON.stringify(listes.teams) === avant, 'filtrer et cocher ne modifie aucune équipe');
      await geste(() => bouton('Annuler').click());
      verifier(fermee && JSON.stringify(listes.teams) === avant, 'annulation sans publication');
    }
  } else if (nom === 'defilement') {
    await preparer(true);
    const d = dialogue(), tete = d.querySelector('h2')!.parentElement!.parentElement!;
    const pied = bouton('Enregistrer').parentElement!.parentElement!;
    const leader = menu('Leader de l’équipe');
    const corps = [...d.children].find(e => getComputedStyle(e).overflowY === 'auto') as HTMLElement;
    const liste = d.querySelector('input[type="checkbox"]')!.parentElement!;
    const telephone = window.matchMedia('(max-width: 1023px)').matches;
    const mesurer = () => [telephone ? tete.querySelector('h2')! : tete, leader, menu(labels[0]),
      telephone ? bouton('Annuler') : pied, bouton('Enregistrer'), tete.querySelector('p')!].map(e => {
      const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
    });
    const avant = mesurer(), premierAvant = liste.getBoundingClientRect().y;
    verifier(corps.scrollHeight > corps.clientHeight, 'la longue liste impose un véritable défilement');
    verifier(corps.contains(leader) === telephone, 'champs dans le corps au téléphone, fixes hors du corps au bureau');
    await geste(() => { corps.scrollTop = 180; corps.dispatchEvent(new Event('scroll')); });
    const apres = mesurer();
    verifier(corps.scrollTop === 180 && liste.getBoundingClientRect().y < premierAvant, 'les membres défilent effectivement');
    const fixes = telephone ? [0, 3, 4, 5] : [0, 1, 2, 3, 4, 5];
    verifier(fixes.every(i => JSON.stringify(avant[i]) === JSON.stringify(apres[i])), 'en-tête, partie fixe et actions gardent exactement leurs positions');
    verifier(!telephone || apres[1][1] < avant[1][1], 'au téléphone, le leader suit encore le défilement du corps');
    await geste(() => { corps.scrollTop = corps.scrollHeight; corps.dispatchEvent(new Event('scroll')); });
    const fin = mesurer();
    verifier(fixes.every(i => JSON.stringify(avant[i]) === JSON.stringify(fin[i])), 'les positions fixes restent identiques jusqu’au bas de la liste');
    verifier(document.documentElement.scrollWidth <= window.innerWidth, 'aucun débordement horizontal');
  } else throw new Error(`Scénario de dialogue inconnu : ${nom}`);
  return preuves;
}
