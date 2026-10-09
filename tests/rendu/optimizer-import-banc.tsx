import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { cleMemoireMembre, ecrireMembresOptimizer, OPTIMIZER_MEMBERS_STORAGE_KEY } from '../../src/lib/optimizerMemberStorage';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from '../../src/lib/optimizerBackup';
import { importerDefensesSiegeOptimizer, importerPrepaRtaOptimizer, type RapportImportOptimizer } from '../../src/lib/importEquipes';
import { exclusionSelectorKey, type ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import type { GearSet, Monster, SiegeTeam } from '../../src/types';

const base = { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const gear: GearSet = { base, runes: [], artifacts: [] };
const monstres: Monster[] = [1, 2].map(id => ({ id, com2usId: 10100 + id, name: `Monstre ${id}`, element: 'fire', archetype: 'attack',
  stars: 6, naturalStars: 5, secondAwaken: false, image: null,
  stats: { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
  leaderSkill: id === 1 ? { stat: 'HP', amount: 33, area: 'Guild', element: null } : null }));
const box = [{ key: '11', monster: monstres[0], stars: 6, level: 40, gear }];
const selector = { source: 'box' as const, unitKey: '11' };
const deck = (id: string): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: [1, 2, 1].map((m, i) => ({ monsterId: String(m), runeSpeed: 120 + i, tick: 0, gear })) });
const dataInitiales: ExclusionSourceData = { box, monsterById: new Map(monstres.map(m => [String(m.id), m])),
  rtaEntries: { '1': { monsterId: '1', runeSpeed: 140, section: 'swift', gear } },
  siegeDefenseTeams: [deck('d1'), deck('d2')], siegeOffenseTeams: [deck('o1'), deck('o2')] };
let etat: OptimizerState, listes: UseOptimizerLists, data: ExclusionSourceData;
let afficher: (v: boolean) => void, changerSources: (v: ExclusionSourceData) => void;
function Banc() {
  const [visible, setVisible] = useState(true), [sources, setSources] = useState(dataInitiales);
  afficher = setVisible; changerSources = setSources; data = sources;
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds: new Set() });
  return visible ? <OptimizerSection box={box} runes={[]} artifacts={[]} relics={[]} relicUsageById={{}}
    allMonsters={monstres} rtaEntries={data.rtaEntries} siegeDefenseTeams={data.siegeDefenseTeams} siegeOffenseTeams={data.siegeOffenseTeams}
    optimizer={etat} onImporterEquipe={etat.importerEquipe} lists={listes} accountName="Synthétique"
    menuOuvert={false} onFermerMenu={() => {}} onOuvrirMenu={() => {}} /> : <p>Autre onglet</p>;
}
async function geste(action: () => void) { flushSync(action); await new Promise(r => setTimeout(r, 0)); flushSync(() => {}); }
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (nom: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && e.textContent?.trim() === nom)!;
const position = (e: Element) => { const { x, y, width, height } = e.getBoundingClientRect(); return { x, y, width, height }; };
const texte = () => document.getElementById('racine')!.innerText;

export async function scenario(nom: string): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, libelle: string) => preuves.push([oui, libelle]);
  localStorage.clear(); setPersistence(true);
  const criteres = baseCompleteCriteres(undefined); criteres.comboSets = ['violent']; criteres.minStats = { spd: 999 }; criteres.objective = 'ehp';
  localStorage.setItem('swblacksmith-optimizer-lists-v1', JSON.stringify({ lists: [{ id: 'a', name: 'Ancienne' }], activeListId: 'a',
    members: [{ listId: 'a', selector }], validated: [{ listId: 'a', selector, runeIds: [91], artifactIds: [92] }] }));
  localStorage.setItem(OPTIMIZER_MEMBERS_STORAGE_KEY, ecrireMembresOptimizer({ identities: new Map(),
    memories: new Map([[cleMemoireMembre('a', selector), { listId: 'a', selector, com2usId: 10101, criteres }]]),
    teams: [], listContents: new Map([['a', 'guilde']]), rejets: { memories: [], teams: [], listContents: [] } }));
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  const root = createRoot(document.getElementById('racine')!);
  await geste(() => root.render(<Banc />));
  await geste(() => etat.choisirMembre('a', selector));
  await geste(() => listes.sauvegarderPoint({ listId: 'a', selector }, data));
  const point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY), ancienne = JSON.stringify(listes.memories.get(cleMemoireMembre('a', selector)));
  if (nom === 'action') {
    await geste(() => afficher(false));
    // Le transport injecte un résultat synthétique dans le vrai hook ; aucun moteur n'est lancé.
    globalThis.Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null; onerror = null;
      postMessage() { queueMicrotask(() => this.onmessage?.(new MessageEvent('message', { data: { type: 'result', candidates: [], explored: 1,
        truncated: false, durationMs: 1, nearMissByCondition: {}, globalNearMiss: null } }))); }
      terminate() { this.onmessage = null; }
    } as unknown as typeof Worker;
    await geste(() => etat.search.run({} as never));
    await geste(() => { etat.setResultsPage(4); etat.setStoppedManually(true); etat.setOpenDetailKey('ancien'); });
    verifier(etat.search.result !== null && etat.search.status === 'done', 'précondition : résultat reçu par le vrai hook, écran démonté');
    let rapport!: RapportImportOptimizer;
    await geste(() => { rapport = etat.importerEquipe(importerDefensesSiegeOptimizer); });
    const id = listes.activeListId!;
    verifier(rapport.listeCreee?.id === id && listes.lists.length === 2, 'action démontée : nouvelle liste active publiée');
    verifier(listes.teams.length === 2 && listes.teams.every(e => e.lead?.amount === 33 && e.members.length === 3), 'action : deux équipes et leads conservés');
    verifier(listes.listContents.get(id) === 'guilde' && listes.identities.size === 6, 'action : contenu Guilde et six identités indépendantes');
    verifier(listes.members.filter(m => m.listId === id).map(m => exclusionSelectorKey(m.selector)).join(',') === 'siege-defense:d1:0,siege-defense:d1:1,siege-defense:d1:2,siege-defense:d2:0,siege-defense:d2:1,siege-defense:d2:2', 'action : tous les exemplaires des deux défenses, copies distinctes');
    verifier(etat.proprietaireCriteres?.listId === id && exclusionSelectorKey(etat.proprietaireCriteres.selector) === 'siege-defense:d1:0'
      && etat.proprietaireCriteres.com2usId === 10101, 'après réconciliation : propriétaire exact du premier membre gardé');
    const attendus = baseCompleteCriteres(gear); attendus.minStats = { spd: 220 };
    verifier(JSON.stringify(photoCriteres(etat, { type: 'personnel' })) === JSON.stringify(attendus), 'action : base complète et vitesse importée, aucun critère contraignant précédent');
    verifier(etat.search.result === null && etat.search.progress === null && etat.search.status === 'idle' && etat.resultsPage === 1
      && !etat.stoppedManually && etat.openDetailKey === null, 'action : résultats, progression, page, arrêt et détail effacés');
    verifier(listes.validated.length === 1 && listes.validated[0].runeIds[0] === 91 && listes.validated[0].artifactIds?.[0] === 92
      && JSON.stringify(listes.memories.get(cleMemoireMembre('a', selector))) === ancienne, 'action : ancienne mémoire et build intacts');
    const memoires = JSON.stringify([...listes.memories]);
    await geste(() => etat.search.run({} as never));
    const resultatAvantImportVide = etat.search.result;
    await geste(() => { etat.importerEquipe(courantes => importerPrepaRtaOptimizer({ ...courantes, rtaEntries: {} })); });
    verifier(listes.activeListId === id && listes.lists.length === 2 && JSON.stringify([...listes.memories]) === memoires
      && etat.proprietaireCriteres?.listId === id && resultatAvantImportVide !== null && etat.search.result === resultatAvantImportVide,
      'import vide : état, propriétaire et résultats conservés');
    await geste(() => etat.setMinStats({ spd: 250 }));
    verifier(listes.memories.get(cleMemoireMembre(id, etat.sourceSelector!))?.criteres.minStats.spd === 250
      && JSON.stringify(listes.memories.get(cleMemoireMembre('a', selector))) === ancienne, 'saisie suivante : seule la mémoire du premier membre importé change');
    await geste(() => etat.importerEquipe(importerDefensesSiegeOptimizer));
    verifier(listes.lists[listes.lists.length - 1]?.name === 'Défenses de siège (2)' && listes.lists.length === 3, 'second import : nouvelle liste au nom suffixé');
  } else {
    await geste(() => { etat.setSelectedId(null); etat.setSourceSelector(null); });
    if (nom === 'defenses') await geste(() => changerSources({ ...data, siegeDefenseTeams: [...data.siegeDefenseTeams,
      { ...deck('d3'), slots: [
        { monsterId: '1', runeSpeed: 120, tick: 0, gear },
        { monsterId: 'inconnu', runeSpeed: null, tick: 0, gear },
        { monsterId: null, runeSpeed: null, tick: 0 },
      ] },
    ] }));
    const ancre = bouton('Importer une équipe');
    if (nom === 'indisponible') {
      await geste(() => changerSources({ ...data, rtaEntries: {}, siegeDefenseTeams: [deck('inconnu')].map(e => ({ ...e, slots: e.slots.map(s => ({ ...s, monsterId: 'inconnu' })) })), siegeOffenseTeams: [] }));
      verifier(ancre.disabled && ancre.title.includes('Aucune source utilisable'), 'bouton toujours visible, source non vide mais inutilisable : désactivé avec raison');
    } else {
      ancre.scrollIntoView({ block: 'center' });
      const avant = JSON.stringify(position(ancre));
      await geste(() => ancre.click());
      verifier(JSON.stringify(position(ancre)) === avant, `ouverture : géométrie de l’ancre intacte ${avant}`);
      verifier(['Défenses de siège', 'Prépa RTA', 'Offense de siège 1', 'Offense de siège 2'].every(t => texte().includes(t)), 'flottant : défenses, chaque deck distinct et toute la prépa RTA');
      const cible = nom === 'defenses' ? 'Défenses de siège' : nom === 'rta' ? 'Prépa RTA' : 'Offense de siège 2 · Monstre 1, Monstre 2, Monstre 1';
      await geste(() => bouton(cible).click());
      verifier(JSON.stringify(position(ancre)) === avant, `rapport : géométrie de l’ancre intacte ${JSON.stringify(position(ancre))}`);
      const rapport = [...document.querySelectorAll<HTMLElement>('[aria-label="Rapport d’import"]')].find(visible)!;
      verifier(!!rapport && rapport.textContent!.includes('créée') && rapport.textContent!.includes(nom === 'defenses' ? '7 monstre(s), 2 équipe(s)' : nom === 'rta' ? '1 monstre(s), 0 équipe(s)' : '3 monstre(s), 1 équipe(s)'), 'rapport de création lu à l’écran');
      if (nom === 'defenses') verifier(rapport.textContent!.includes('inconnu : Monstre inconnu.')
        && rapport.textContent!.includes('Défense 3 — lead de la source') && rapport.textContent!.includes('appliqué'), 'rapport lu à l’écran : membre inconnu ignoré, équipe à un membre et lead non appliqué dits');
      verifier(getComputedStyle(rapport.parentElement!).position === 'absolute' && getComputedStyle(rapport.parentElement!).borderTopWidth === '1px', 'rapport hors du flux dans la surface au contour de 1 px');
      await geste(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
      verifier(ancre.getAttribute('aria-expanded') === 'false', 'Échap ferme les sources sans import supplémentaire');
      const pli = bouton('Monstres à optimiser'); if (pli) await geste(() => pli.click());
      verifier(texte().includes(nom === 'defenses' ? 'Monstres de « Défenses de siège »' : nom === 'rta' ? 'Monstres de « Prépa RTA »' : 'Monstres de « Offense de siège »'), 'liste active importée lue à l’écran');
      const minimum = [...document.querySelectorAll<HTMLInputElement>('[aria-label="VIT minimum"]')].find(visible);
      verifier(minimum?.value === String(nom === 'rta' ? 140 : 120), 'vitesse importée lue dans le champ réel de l’écran');
      verifier(etat.sourceSelector?.source === (nom === 'defenses' ? 'siege-defense' : nom === 'rta' ? 'rta' : 'siege-offense')
        && (nom !== 'offense' || etat.sourceSelector.source === 'siege-offense' && etat.sourceSelector.teamId === 'o2'), 'exemplaire de la source choisie, second deck d’offense distingué');
      verifier(nom === 'rta' ? listes.teams.length === 0 : !!bouton('Modifier l’équipe'), 'équipes importées visibles, prépa RTA sans équipe');
    }
    verifier(document.documentElement.scrollWidth <= window.innerWidth, 'format sans débordement horizontal');
  }
  verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'point de sauvegarde intact');
  return preuves;
}
