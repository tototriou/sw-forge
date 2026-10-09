import { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import SiegePage from '../../src/pages/SiegePage';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import OptimizerImportRapport from '../../src/components/outils/OptimizerImportRapport';
import { useSiegeState } from '../../src/hooks/useSiegeState';
import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import { avecNavigationImportOptimizer } from '../../src/lib/actionImportOptimizer';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { exclusionSelectorKey, type ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from '../../src/lib/optimizerBackup';
import type { RapportImportOptimizer } from '../../src/lib/importEquipes';
import type { GearSet, Monster, SiegeTeam } from '../../src/types';

const gear: GearSet = { base: { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const monstres: Monster[] = [1, 2, 3].map(id => ({ id, com2usId: 10100 + id, name: `Monstre ${id}`, element: 'fire', archetype: 'attack',
  stars: 6, naturalStars: 5, secondAwaken: false, image: null,
  stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
  leaderSkill: id === 1 ? { stat: 'HP', amount: 33, area: 'Guild', element: null } : null }));
const box = [{ key: '11', monster: monstres[0], stars: 6, level: 40, gear }];
const deck = (id: string, vitesse: number): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: [1, 2, 1].map((m, i) => ({ monsterId: String(m), runeSpeed: vitesse + i, tick: 0, gear })) });
let etat: OptimizerState, listes: UseOptimizerLists, racine: Root | undefined;
let compteCharge = true, attente = false, refus = '', cote: 'defense' | 'offense' = 'defense';
let changerMenu: (v: boolean) => void, changerCompte: (v: boolean) => void, changerSources: (v: ExclusionSourceData) => void;
const initiales = (): ExclusionSourceData => ({ box, rtaEntries: {}, monsterById: new Map(monstres.map(m => [String(m.id), m])),
  siegeDefenseTeams: [deck('d1', 120), deck('d2', 140)].map((d, i) => i ? d : { ...d, slots: d.slots.map((s, j) => j === 2 ? { ...s, monsterId: '3' } : s) }),
  siegeOffenseTeams: [deck('o1', 160), deck('o2', 180)] });

function Banc() {
  const defense = useSiegeState('defense'), offense = useSiegeState('offense'), recos = useSiegeRecos();
  const [data, setData] = useState(initiales), [charge, setCharge] = useState(compteCharge);
  const [route, setRoute] = useState(location.hash), [menu, setMenu] = useState(false);
  const [rapport, setRapport] = useState<RapportImportOptimizer | null>(null);
  changerMenu = setMenu; changerCompte = setCharge; changerSources = setData;
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds: new Set(), reverificationEnAttente: () => attente });
  useEffect(() => {
    const naviguer = () => setRoute(location.hash);
    window.addEventListener('hashchange', naviguer);
    return () => window.removeEventListener('hashchange', naviguer);
  }, []);
  const importer = avecNavigationImportOptimizer(produire => etat.importerEquipe(courantes => {
    if (refus === 'collision') {
      const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'import' });
      try { const active = listes.activeListId; listes.createList('Concurrente', 'donjon'); listes.setActiveListId(active); }
      finally { if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid); else delete (crypto as Partial<Crypto>).randomUUID; }
    }
    return produire(refus === 'vide' ? { ...courantes, siegeDefenseTeams: [], siegeOffenseTeams: [] } : courantes);
  }), () => { location.hash = '#/outils/optimizer'; }, setRapport);
  return <>
    {route === '#/outils/optimizer' ? <OptimizerSection box={box} runes={[]} artifacts={[]} relics={[]} relicUsageById={{}}
      allMonsters={monstres} rtaEntries={{}} siegeDefenseTeams={data.siegeDefenseTeams} siegeOffenseTeams={data.siegeOffenseTeams}
      optimizer={etat} onImporterEquipe={importer} lists={listes} accountName="Synthétique"
      menuOuvert={false} onFermerMenu={() => {}} onOuvrirMenu={() => {}} /> :
      <SiegePage tab={cote} siege={cote === 'defense' ? defense : offense} offense={offense} recos={recos}
        builds={[]} teams={[]} copies6={new Map()} monsters={monstres} loadState="live"
        siegeDefenseTeams={data.siegeDefenseTeams} siegeOffenseTeams={data.siegeOffenseTeams}
        compteCharge={charge} sourcesOptimizer={data} onImporterEquipe={importer}
        onCreateMonster={() => monstres[0]} customMonsters={[]} onDeleteMonster={() => {}}
        menuOuvert={menu} onFermerMenu={() => setMenu(false)} />}
    {rapport && <OptimizerImportRapport rapport={rapport} onFermer={() => setRapport(null)} />}
  </>;
}
async function geste(action: () => void) { flushSync(action); await new Promise(r => setTimeout(r, 30)); flushSync(() => {}); }
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const position = (e: Element) => { const { x, y, width, height } = e.getBoundingClientRect(); return { x, y, width, height }; };
const boutonsExport = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter(e => visible(e)
  && (e.getAttribute('aria-label') === "Exporter vers l'Optimizer" || e.textContent?.trim() === "Exporter vers l'Optimizer"));
const texteRapport = () => document.querySelector<HTMLElement>('[aria-label="Rapport d’import"]')?.innerText ?? '';

export async function afficherEtatExport(charge: boolean, telephone: boolean) {
  const terminer = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => visible(b) && b.getAttribute('aria-label') === "Terminer l'édition");
  if (terminer) await geste(() => terminer.click());
  await geste(() => { changerCompte(charge); changerSources(charge ? { ...initiales(), monsterById: new Map() } : initiales()); changerMenu(telephone); });
  await new Promise(r => setTimeout(r, 300));
}

export async function scenario(nom: string, telephone: boolean): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (v: boolean, m: string) => preuves.push([v, `${nom} : ${m}`]);
  if (racine) await geste(() => racine!.unmount());
  localStorage.clear(); setPersistence(true);
  attente = false; refus = ''; compteCharge = true; cote = nom === 'offense' ? 'offense' : 'defense';
  const data = initiales();
  for (const side of ['defense', 'offense'] as const) localStorage.setItem(`swblacksmith-siege-${side}-v1`, JSON.stringify({ teams: side === 'defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams }));
  location.hash = `#/siege/${cote}`;
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  racine = createRoot(document.getElementById('racine')!);
  await geste(() => racine!.render(<Banc />));
  verifier(window.matchMedia('(pointer: coarse)').matches === telephone, 'mode de pointage attendu pour le format');
  const carte = boutonsExport().find(b => b.closest('section'))!;
  verifier(!!carte && getComputedStyle(carte.querySelector('span')!).display === (telephone ? 'none' : 'block'),
    'libellé visible au bureau, icône seule au doigt');
  let ancienne = '';
  await geste(() => { ancienne = listes.createList('Ancienne', 'donjon'); });
  await geste(() => { listes.addMember(ancienne, { source: 'box', unitKey: '11' }, 10101); etat.choisirMembre(ancienne, { source: 'box', unitKey: '11' }); });
  await geste(() => { etat.setMinStats({ spd: 999 }); listes.sauvegarderPoint({ listId: ancienne, selector: { source: 'box', unitKey: '11' } }, data); });
  const avantStockage = JSON.stringify(listes.lireStockageCourant()), point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY);
  const avantAffichage = JSON.stringify({ criteres: photoCriteres(etat, { type: 'personnel' }), proprietaire: etat.proprietaireCriteres, selection: etat.sourceSelector });
  if (nom === 'indisponible') {
    verifier(boutonsExport().filter(b => b.closest('section')).length === 2 && boutonsExport().every(b => !b.disabled), 'deux cartes exportables, écran replié');
    await geste(() => changerCompte(false));
    verifier(boutonsExport().filter(b => b.closest('section')).length === 2 && boutonsExport().every(b => b.disabled && b.title.includes('compte')), 'cartes sans compte : boutons désactivés et raison');
    if (telephone) await geste(() => changerMenu(true));
    verifier(boutonsExport().some(b => b.disabled && b.title.includes('compte') && !b.closest('section')), 'page Défense sans compte : désactivation avec raison');
    await geste(() => { changerCompte(true); changerSources({ ...data, monsterById: new Map() }); });
    verifier(boutonsExport().every(b => b.disabled && b.title.includes('Aucun monstre importable')), 'source non vide mais inutilisable : boutons et raisons');
    verifier(location.hash === '#/siege/defense' && JSON.stringify(listes.lireStockageCourant()) === avantStockage, 'indisponibilité sans import ni navigation');
    await geste(() => { changerSources(data); changerMenu(false); });
    await new Promise(r => setTimeout(r, 300));
    const editer = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => visible(b) && b.getAttribute('aria-label') === "Éditer l'équipe")!;
    await geste(() => editer.click());
    verifier(boutonsExport().filter(b => b.closest('section')).length === 2 && boutonsExport().every(b => !b.disabled), 'export présent aussi dans une carte dépliée');
  } else {
    const toutes = nom === 'defenses';
    if (toutes) {
      const recherche = document.querySelector<HTMLInputElement>('[aria-label="Chercher une équipe par monstre"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      await geste(() => { recherche.focus(); setter.call(recherche, 'Monstre 3'); recherche.dispatchEvent(new Event('input', { bubbles: true })); });
      const resultat = [...document.querySelectorAll('[role="option"]')].find(e => e.textContent?.includes('Monstre 3'));
      if (!resultat) throw new Error('Résultat de recherche absent.');
      await geste(() => resultat.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      verifier(document.querySelectorAll('section').length === 1, 'une seule défense affichée par la recherche avant export de toutes les défenses');
    }
    if (telephone && toutes) await geste(() => changerMenu(true));
    const ancre = toutes ? boutonsExport().find(b => !b.closest('section'))! : boutonsExport().find(b => b.closest('section')?.textContent?.includes('Équipe 2'))!;
    verifier(!!ancre && !ancre.disabled, 'bouton réel visible et utilisable');
    if (!ancre) throw new Error(`Bouton absent pour ${nom}`);
    ancre.scrollIntoView({ block: 'center' });
    const geometrie = JSON.stringify(position(ancre));
    if (['attente', 'collision', 'vide'].includes(nom)) { attente = nom === 'attente'; refus = nom; }
    await geste(() => ancre.click());
    if (refus) {
      verifier(location.hash === '#/siege/defense', 'refus sans navigation');
      verifier(texteRapport().includes(nom === 'attente' ? 'revérification' : nom === 'collision' ? 'déjà occupé' : 'Aucune liste créée'), 'raison du refus lue à l’écran');
      verifier(JSON.stringify(position(ancre)) === geometrie, 'géométrie du bouton intacte au rapport');
      verifier(JSON.stringify({ criteres: photoCriteres(etat, { type: 'personnel' }), proprietaire: etat.proprietaireCriteres, selection: etat.sourceSelector }) === avantAffichage,
        'refus : critères, sélection et propriétaire intacts après réconciliation');
      if (nom !== 'collision') verifier(JSON.stringify(listes.lireStockageCourant()) === avantStockage, 'refus : stockage intact');
      else verifier(listes.lists.length === 2 && listes.activeListId === ancienne && listes.members.length === 1, 'collision : seule la liste concurrente ajoutée, aucun import');
    } else {
      verifier(location.hash === '#/outils/optimizer', 'un clic ouvre la route Optimizer');
      const listId = listes.activeListId!, source = nom === 'offense' ? 'siege-offense' : 'siege-defense';
      const id = toutes ? 'd1' : nom === 'offense' ? 'o2' : 'd2', vitesse = toutes ? 120 : nom === 'offense' ? 180 : 140;
      verifier(listes.lists.length === 2 && listId !== ancienne, 'nouvelle liste active, liste existante conservée');
      verifier(listes.members.filter(m => m.listId === listId).length === (toutes ? 6 : 3)
        && listes.members.filter(m => m.listId === listId).every(m => m.selector.source === source), 'tous les membres de la source avec leurs exemplaires');
      const equipes = listes.teams.filter(e => e.listId === listId);
      verifier(equipes.length === (toutes ? 2 : 1) && equipes.every(e => e.members.length === 3 && e.lead?.amount === 33 && e.lead.area === 'Guild'), 'une équipe par défense ou deck, leads exacts');
      verifier(listes.listContents.get(listId) === 'guilde' && exclusionSelectorKey(etat.sourceSelector!) === `${source}:${id}:0`
        && etat.proprietaireCriteres?.listId === listId, 'Guilde et premier membre exact après réconciliation');
      const attendus = baseCompleteCriteres(gear); attendus.minStats = { spd: 100 + vitesse };
      verifier(JSON.stringify(photoCriteres(etat, { type: 'personnel' })) === JSON.stringify(attendus), 'critères complets importés, aucun critère précédent');
      verifier(texteRapport().includes(`${toutes ? 6 : 3} monstre(s), ${toutes ? 2 : 1} équipe(s)`), 'rapport lisible après navigation');
      await geste(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      const minimum = [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible);
      verifier(minimum?.value === String(vitesse), 'critère de vitesse importé lu dans l’Optimizer');
      verifier(etat.search.result === null && etat.search.status === 'idle', 'atterrissage sans lancer de recherche');
    }
  }
  verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'point de sauvegarde inchangé');
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'aucun débordement horizontal');
  return preuves;
}
