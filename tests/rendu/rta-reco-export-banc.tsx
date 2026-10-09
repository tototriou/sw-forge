import { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import RtaPage from '../../src/pages/RtaPage';
import SiegePage from '../../src/pages/SiegePage';
import OutilsPage from '../../src/pages/OutilsPage';
import OptimizerImportRapport from '../../src/components/outils/OptimizerImportRapport';
import { useRtaState } from '../../src/hooks/useRtaState';
import { useSiegeState } from '../../src/hooks/useSiegeState';
import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import { avecNavigationImportOptimizer } from '../../src/lib/actionImportOptimizer';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { exclusionSelectorKey, type ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { collectOwnedBuilds, collectOwnedTeams, countCopiesByCom2us } from '../../src/lib/ownedBuilds';
import { contexteConfrontationReco, matchDeck } from '../../src/lib/recoMatch';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from '../../src/lib/optimizerBackup';
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import type { RapportImportOptimizer } from '../../src/lib/importEquipes';
import type { GearSet, Monster, Reco, RecoDeck, SiegeTeam } from '../../src/types';

const gear: GearSet = { base: { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
const monstres: Monster[] = [1, 2, 3].map(id => ({ id, com2usId: 10100 + id, name: `Monstre ${id}`, element: 'fire', archetype: 'attack',
  stars: 6, naturalStars: 5, secondAwaken: false, image: null,
  stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
  leaderSkill: id === 1 ? { stat: 'HP', amount: 33, area: 'Guild', element: null } : null }));
const box = [{ key: '11', monster: monstres[0], stars: 6, level: 40, gear }];
const equipe = (id: string, ids: number[]): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: ids.map(m => ({ monsterId: String(m), runeSpeed: 20, tick: 0, gear })) });
const deck: RecoDeck = { name: 'À runer', note: 'Ouvrir avec le leader', counters: [{ note: '', monsters: [1, 2, 3].map(m => ({ com2usId: 10100 + m, name: `Monstre ${m}` })) }],
  slots: [1, 2, 3].map(m => ({ com2usId: 10100 + m, name: `Monstre ${m}`, stats: { spd: 200 + m, hp: 25000 + m },
    setOptions: [['violent', 'will'], ['swift']], artifacts: { element: [218], archetype: [218, 206] } })) };
const reco: Reco = { id: 'r1', name: 'Contres', origin: 'mine', author: '', note: '', decks: [deck,
  { ...deck, name: 'Autre deck', slots: deck.slots.map(s => ({ ...s, stats: { spd: 999 } })) }] };
const initiales = (): ExclusionSourceData => ({ box, monsterById: new Map(monstres.map(m => [String(m.id), m])),
  rtaEntries: Object.fromEntries([1, 2, 3].map(m => [String(m), { monsterId: String(m), runeSpeed: 140 + m, section: m === 1 ? 'swift' : 'unassigned', gear }])),
  siegeDefenseTeams: [], siegeOffenseTeams: [equipe('o1', [1, 2, 1]), equipe('o2', [3, 1, 2])] });
type Source = 'rta' | 'reco' | 'flottant';
let source: Source, telephone: boolean, attente = false, refus = '', racine: Root | undefined;
let etat: OptimizerState, listes: UseOptimizerLists, changerCompte: (v: boolean) => void;
let changerSources: (v: ExclusionSourceData) => void, changerMenu: (v: boolean) => void;

function Banc() {
  const rta = useRtaState(), defense = useSiegeState('defense'), offense = useSiegeState('offense'), recos = useSiegeRecos();
  const [data, setData] = useState(initiales), [charge, setCharge] = useState(true), [menu, setMenu] = useState(telephone && source === 'rta');
  const [route, setRoute] = useState(location.hash), [rapport, setRapport] = useState<RapportImportOptimizer | null>(null);
  changerCompte = setCharge; changerSources = setData; changerMenu = setMenu;
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds: new Set(), reverificationEnAttente: () => attente });
  useEffect(() => { const changer = () => setRoute(location.hash); window.addEventListener('hashchange', changer);
    return () => window.removeEventListener('hashchange', changer); }, []);
  const importer = avecNavigationImportOptimizer(produire => etat.importerEquipe(courantes => {
    if (refus === 'collision') {
      const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
      Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'import' });
      try { const active = listes.activeListId; listes.createList('Concurrente', 'donjon'); listes.setActiveListId(active); }
      finally { if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid); else delete (crypto as Partial<Crypto>).randomUUID; }
    }
    return produire(refus === 'vide' ? { ...courantes, monsterById: new Map() } : courantes);
  }), () => { location.hash = '#/outils/optimizer'; }, r => {
    if (source !== 'flottant') setRapport(r);
  });
  const args = { box: data.box, rta: Object.values(data.rtaEntries), defense: data.siegeDefenseTeams, offense: data.siegeOffenseTeams, monsterById: data.monsterById };
  const monstresCourants = useMemo(() => [...data.monsterById.values()], [data.monsterById]);
  return <>
    {route === '#/outils/optimizer' ? <OutilsPage sub="optimizer" recommandations={recos.state.recos}
      box={data.box} runes={[]} artifacts={[]} relics={[]} relicUsageById={{}} loadState="live" optimizer={etat}
      onImporterEquipe={importer} allMonsters={monstresCourants} rtaEntries={data.rtaEntries} siegeDefenseTeams={data.siegeDefenseTeams}
      siegeOffenseTeams={data.siegeOffenseTeams} lists={listes} accountName="Synthétique" menuOuvert={false}
      onFermerMenu={() => {}} onOuvrirMenu={() => {}} /> : source === 'rta' ?
      <RtaPage sub="prepa" rta={rta} monsters={monstres} loadState="live" onCreateMonster={() => monstres[0]}
        customMonsters={[]} onDeleteMonster={() => {}} menuOuvert={menu} onFermerMenu={() => setMenu(false)}
        onImporterEquipe={importer} sourcesOptimizer={data} compteCharge={charge} /> :
      <SiegePage tab="recos" siege={defense} offense={offense} recos={recos} builds={collectOwnedBuilds(args)} teams={collectOwnedTeams(args)}
        copies6={countCopiesByCom2us(data.box)} monsters={monstres} loadState="live" onCreateMonster={() => monstres[0]}
        customMonsters={[]} onDeleteMonster={() => {}} menuOuvert={menu} onFermerMenu={() => setMenu(false)}
        siegeDefenseTeams={data.siegeDefenseTeams} siegeOffenseTeams={data.siegeOffenseTeams}
        onImporterEquipe={importer} sourcesOptimizer={data} compteCharge={charge} />}
    {rapport && <OptimizerImportRapport rapport={rapport} onFermer={() => setRapport(null)} />}
  </>;
}
async function geste(action: () => void) { flushSync(action); await new Promise(r => setTimeout(r, 30)); flushSync(() => {}); }
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const boutons = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter(visible);
const trouver = (nom: string) => boutons().find(b => b.getAttribute('aria-label') === nom || b.textContent?.trim() === nom || b.title === nom);
const boutonsExport = () => boutons().filter(b => b.getAttribute('aria-label') === "Exporter vers l'Optimizer" || b.textContent?.trim() === "Exporter vers l'Optimizer");
const position = (e: Element) => { const { x, y, width, height } = e.getBoundingClientRect(); return { x, y, width, height }; };
const affichage = () => JSON.stringify({ criteres: photoCriteres(etat, { type: 'personnel' }), proprietaire: etat.proprietaireCriteres,
  selection: etat.sourceSelector, resultat: etat.search.result, statut: etat.search.status });

export async function scenario(s: Source, mobile: boolean, motif = 'accepte', conserverRapport = false): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (v: boolean, m: string) => preuves.push([v, `${s}/${motif} : ${m}`]);
  if (racine) await geste(() => racine!.unmount());
  localStorage.clear(); setPersistence(true); source = s; telephone = mobile; attente = false; refus = '';
  const data = initiales();
  localStorage.setItem('swblacksmith-rta-v1', JSON.stringify({ sections: ['swift'], entries: data.rtaEntries }));
  localStorage.setItem('swblacksmith-siege-recos-v1', JSON.stringify({ recos: [reco] }));
  location.hash = s === 'rta' ? '#/rta' : s === 'reco' ? '#/siege/recommandations' : '#/outils/optimizer';
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  racine = createRoot(document.getElementById('racine')!);
  await geste(() => racine!.render(<Banc />));
  verifier(matchMedia('(pointer: coarse)').matches === mobile, 'pointage du format attendu');
  if (s === 'reco') {
    await geste(() => (trouver('Consulter') ?? trouver('Contres'))!.click());
    verifier(boutonsExport().length === 2, 'une action pour chacun des deux decks repliés');
    await geste(() => trouver('Déplier ce deck')!.click());
    verifier(boutonsExport().length === 2, 'actions conservées quand un deck est déplié');
    await geste(() => trouver('Replier ce deck')!.click());
    if (mobile) await geste(() => changerMenu(true));
    await geste(() => trouver('Défense')!.click());
    if (mobile) await geste(() => changerMenu(false));
    verifier(boutonsExport().length === 2, 'une action par offense dans la vue Défense');
    if (mobile) await geste(() => changerMenu(true));
    await geste(() => trouver('Attaque')!.click());
    if (mobile) await geste(() => changerMenu(false));
  }
  if (s === 'rta' && !mobile && !boutonsExport().length) await geste(() => trouver("Plus d'actions")!.click());
  if (s === 'flottant') {
    const ancre = trouver('Importer une équipe')!; ancre.scrollIntoView({ block: 'center' });
    const avant = JSON.stringify(position(ancre));
    await geste(() => ancre.click());
    verifier(JSON.stringify(position(ancre)) === avant, 'flottant sans déplacement de l’ancre');
    verifier(boutons().filter(b => b.textContent?.startsWith('Recommandation 1 · Contres · Deck')).length === 2, 'un choix nommé par deck recommandé');
  }
  if (motif === 'apercu') return preuves;
  let ancienne = '';
  await geste(() => { ancienne = listes.createList('Ancienne', 'donjon'); });
  await geste(() => { listes.addMember(ancienne, { source: 'box', unitKey: '11' }, 10101); etat.choisirMembre(ancienne, { source: 'box', unitKey: '11' }); });
  await geste(() => { etat.setMinStats({ spd: 999 }); listes.sauvegarderPoint({ listId: ancienne, selector: { source: 'box', unitKey: '11' } }, data); });
  const point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY), stockage = JSON.stringify(listes.lireStockageCourant()), avantAffichage = affichage();
  const ancre = s === 'flottant' ? boutons().find(b => b.textContent?.startsWith('Recommandation 1 · Contres · Deck 1'))! : boutonsExport()[0];
  if (!ancre) throw new Error(`Action absente : ${s}`);
  ancre.scrollIntoView({ block: 'center' });
  // La mesure commence après l’animation d’entrée de la liste des decks.
  await new Promise(r => setTimeout(r, 250));
  // Une entrée de Menu se referme au choix ; son déclencheur reste le repère de page.
  const repere = ancre.closest('[role="menu"]') ? trouver("Plus d'actions")! : ancre;
  const geometrie = JSON.stringify(position(repere)), route = location.hash;
  if (motif === 'indisponible') {
    if (s !== 'flottant') {
      await geste(() => changerCompte(false));
      verifier(boutonsExport().length > 0 && boutonsExport().every(b => b.disabled && b.title.includes('compte')), 'sans compte : actions conservées et raison');
      await geste(() => { changerCompte(true); changerSources({ ...data, monsterById: new Map() }); });
      verifier(boutonsExport().length > 0 && boutonsExport().every(b => b.disabled && b.title.includes('Aucun monstre importable')), 'source inutilisable : actions désactivées avec raison');
    } else {
      await geste(() => changerSources({ ...data, monsterById: new Map() }));
      const choix = boutons().filter(b => b.textContent?.startsWith('Recommandation 1'));
      verifier(choix.length === 2 && choix.every(b => b.disabled && b.title.includes('Aucun membre résolvable')), 'recommandations inutilisables affichées avec raison');
    }
    verifier(location.hash === route && JSON.stringify(listes.lireStockageCourant()) === stockage, 'indisponibilité sans écriture ni navigation');
  } else {
    attente = motif === 'attente'; refus = ['collision', 'vide'].includes(motif) ? motif : '';
    await geste(() => ancre.click());
    const rapport = document.querySelector<HTMLElement>('[aria-label="Rapport d’import"]')?.innerText ?? '';
    if (motif !== 'accepte') {
      verifier(location.hash === route, 'refus sans navigation');
      verifier(rapport.includes(motif === 'attente' ? 'revérification' : motif === 'collision' ? 'déjà occupé' : 'Aucune liste créée'), 'refus lu à l’écran');
      verifier(JSON.stringify(position(repere)) === geometrie, `repère immobile à l’ouverture du rapport (${geometrie} → ${JSON.stringify(position(repere))})`);
      verifier(affichage() === avantAffichage, 'critères, propriétaire, sélection et résultats conservés');
      verifier(motif === 'collision' ? listes.lists.length === 2 && listes.members.length === 1 && listes.activeListId === ancienne
        : JSON.stringify(listes.lireStockageCourant()) === stockage, 'aucune donnée d’import publiée');
    } else {
      verifier(location.hash === '#/outils/optimizer', 'un clic termine l’action et ouvre l’Optimizer');
      const id = listes.activeListId!, membres = listes.members.filter(m => m.listId === id), equipes = listes.teams.filter(e => e.listId === id);
      verifier(listes.lists.length === 2 && id !== ancienne && membres.length === 3, 'nouvelle liste active et trois membres, ancienne liste conservée');
      verifier(listes.lists.find(l => l.id === id)?.name === (s === 'rta' ? 'Prépa RTA' : 'À runer'), 'nom de la source exacte, aucun autre deck');
      verifier(listes.listContents.get(id) === (s === 'rta' ? 'arene' : 'guilde'), 'contenu Arène ou Guilde attendu');
      const premier = s === 'rta' ? 'rta:1' : 'siege-offense:o2:1';
      verifier(exclusionSelectorKey(etat.sourceSelector!) === premier && etat.proprietaireCriteres?.listId === id, 'premier membre choisi et gardé après réconciliation');
      verifier(s === 'rta' ? equipes.length === 0 : equipes.length === 1 && equipes[0].members.length === 3
        && exclusionSelectorKey(equipes[0].leader!) === premier && equipes[0].lead?.amount === 33 && equipes[0].lead.area === 'Guild', 'équipes et lead exacts');
      const attendus = baseCompleteCriteres(gear);
      attendus.minStats = s === 'rta' ? { spd: 241 } : { hp: 25001, spd: 201 };
      if (s !== 'rta') { attendus.comboSets = ['violent', 'will']; attendus.lignesVerrouillees = [{ code: 218, min: 0.1 }, { code: 206, min: 1 }]; }
      verifier(JSON.stringify(photoCriteres(etat, { type: 'personnel' })) === JSON.stringify(attendus), 'critères complets de la source, aucun minimum précédent');
      verifier(membres.every(m => s === 'rta' ? m.selector.source === 'rta' : m.selector.source === 'siege-offense' && m.selector.teamId === 'o2'), 'exemplaires précis de toute la source');
      verifier(membres.every((m, i) => listes.memories.get(cleMemoireMembre(id, m.selector))?.criteres.minStats.spd === (s === 'rta' ? 241 + i : 201 + i)), 'vitesses importées et mémorisées pour les trois membres');
      if (s !== 'rta') {
        const args = { box, rta: Object.values(data.rtaEntries), defense: [], offense: data.siegeOffenseTeams, monsterById: data.monsterById };
        verifier(matchDeck(deck, contexteConfrontationReco(collectOwnedBuilds(args), collectOwnedTeams(args), countCopiesByCom2us(box))).team === 'Offense 2', 'même offense que la confrontation de l’écran');
        verifier(rapport.includes('une présence sur la paire suffit') && rapport.includes('premier runage'), 'écarts du producteur lus au rapport');
      }
      verifier(rapport.includes(`3 monstre(s), ${s === 'rta' ? 0 : 1} équipe(s)`), 'rapport lisible après l’action');
      verifier(document.querySelectorAll('[role="dialog"]').length === (s === 'flottant' ? 0 : 1), 'une modale hors Optimizer, rapport flottant interne');
      if (!conserverRapport) await geste(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      const minimum = [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible);
      verifier(minimum?.value === (s === 'rta' ? '141' : '101'), 'vitesse importée lue dans le contrôle de l’Optimizer');
      verifier(etat.search.result === null && etat.search.status === 'idle', 'atterrissage sans recherche');
    }
  }
  verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'point de sauvegarde intact');
  verifier(document.documentElement.scrollWidth <= innerWidth, 'aucun débordement horizontal');
  return preuves;
}

export async function afficherSource(s: Source, mobile: boolean) { await scenario(s, mobile, 'apercu'); }
