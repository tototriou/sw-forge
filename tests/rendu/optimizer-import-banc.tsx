import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { cleMemoireMembre, ecrireMembresOptimizer, reverifierStockageOptimizer, OPTIMIZER_MEMBERS_STORAGE_KEY, type StockageOptimizer } from '../../src/lib/optimizerMemberStorage';
import { OPTIMIZER_BACKUP_STORAGE_KEY } from '../../src/lib/optimizerBackup';
import { importerDefensesSiegeOptimizer, importerPrepaRtaOptimizer, type RapportImportOptimizer } from '../../src/lib/importEquipes';
import * as importsEquipes from '../../src/lib/importEquipes';
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
const autreSelector = { source: 'rta' as const, monsterId: '1' };
const deck = (id: string): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: [1, 2, 1].map((m, i) => ({ monsterId: String(m), runeSpeed: 120 + i, tick: 0, gear })) });
const dataInitiales: ExclusionSourceData = { box, monsterById: new Map(monstres.map(m => [String(m.id), m])),
  rtaEntries: { '1': { monsterId: '1', runeSpeed: 140, section: 'swift', gear } },
  siegeDefenseTeams: [deck('d1'), deck('d2')], siegeOffenseTeams: [deck('o1'), deck('o2')] };
let etat: OptimizerState, listes: UseOptimizerLists, data: ExclusionSourceData;
let reverificationEnAttente = false;
let afficher: (v: boolean) => void, changerSources: (v: ExclusionSourceData) => void;
function Banc() {
  const [visible, setVisible] = useState(true), [sources, setSources] = useState(dataInitiales);
  afficher = setVisible; changerSources = setSources; data = sources;
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds: new Set(), reverificationEnAttente: () => reverificationEnAttente });
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
const photographierExistant = (stockage: StockageOptimizer, ids: Set<string>) => JSON.stringify({
  lists: stockage.lists.filter(l => ids.has(l.id)), members: stockage.members.filter(m => ids.has(m.listId)),
  validated: stockage.validated.filter(v => ids.has(v.listId)),
  identities: [...stockage.identities].filter(([, m]) => ids.has(m.listId)),
  memories: [...stockage.memories].filter(([, m]) => ids.has(m.listId)),
  teams: stockage.teams.filter(e => ids.has(e.listId)), listContents: [...stockage.listContents].filter(([id]) => ids.has(id)),
  rejets: { memories: stockage.rejets.memories, identities: stockage.rejets.identities,
    teams: stockage.rejets.teams, listContents: stockage.rejets.listContents },
});

const photographierAffichage = () => JSON.stringify({ selectedId: etat.selectedId, sourceSelector: etat.sourceSelector,
  proprietaire: etat.proprietaireCriteres, criteres: photoCriteres(etat, { type: 'personnel' }),
  result: etat.search.result, progress: etat.search.progress, status: etat.search.status,
  page: etat.resultsPage, arret: etat.stoppedManually, detail: etat.openDetailKey });

async function preparerResultatsRefus() {
  // Un transport synthétique remplit le vrai hook pour vérifier qu'un refus
  // conserve aussi un résultat déjà reçu, sans exécuter le moteur.
  globalThis.Worker = class {
    onmessage: ((e: MessageEvent) => void) | null = null; onerror = null;
    postMessage() { queueMicrotask(() => this.onmessage?.(new MessageEvent('message', { data: { type: 'result', candidates: [], explored: 1,
      truncated: false, durationMs: 1, nearMissByCondition: {}, globalNearMiss: null } }))); }
    terminate() { this.onmessage = null; }
  } as unknown as typeof Worker;
  await geste(() => etat.search.run({} as never));
  await geste(() => { etat.setResultsPage(4); etat.setStoppedManually(true); etat.setOpenDetailKey('à conserver'); });
  if (!etat.search.result || etat.search.status !== 'done' || !etat.proprietaireCriteres) throw new Error('Précondition de refus manquante.');
}

export async function changerDisponibiliteImport(disponible: boolean) {
  await geste(() => changerSources(disponible ? dataInitiales : { ...data, rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [] }));
}

export async function scenarioDisponibiliteMemoisee(): Promise<[boolean, string][]> {
  const noms = ['importerDefensesSiegeOptimizer', 'importerOffenseSiegeOptimizer', 'importerPrepaRtaOptimizer'] as const;
  const appels = new Map<string, number>();
  const descripteurs = noms.map(nom => Object.getOwnPropertyDescriptor(importsEquipes, nom)!);
  try {
    for (const nom of noms) {
      const original = importsEquipes[nom];
      Object.defineProperty(importsEquipes, nom, { configurable: true, value: (...args: unknown[]) => {
        appels.set(nom, (appels.get(nom) ?? 0) + 1);
        return (original as (...args: unknown[]) => unknown)(...args);
      } });
    }
    const preuves = await scenario('rta');
    appels.clear();
    await geste(() => etat.setResultsPage(3));
    preuves.push([appels.size === 0, 'rendu sans changement des sources, flottant fermé : aucun producteur rappelé']);
    await geste(() => bouton('Importer une équipe').click());
    await geste(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    preuves.push([appels.size === 0, 'ouverture et fermeture sans changement des sources : propositions réutilisées']);
    await geste(() => changerSources({ ...data, rtaEntries: {} }));
    preuves.push([noms.every((nom, i) => appels.get(nom) === (i === 1 ? 2 : 1)),
      'sources modifiées : chaque proposition recalculée une fois pour les deux formats']);
    appels.clear();
    await changerDisponibiliteImport(false);
    preuves.push([appels.get(noms[0]) === 1 && !appels.has(noms[1]) && appels.get(noms[2]) === 1
      && bouton('Importer une équipe').disabled, 'nouvelles sources vides : disponibilité actualisée sans double calcul']);
    return preuves;
  } finally { noms.forEach((nom, i) => Object.defineProperty(importsEquipes, nom, descripteurs[i])); }
}

export async function scenario(nom: string): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, libelle: string) => preuves.push([oui, libelle]);
  localStorage.clear(); setPersistence(true); reverificationEnAttente = false;
  const criteres = baseCompleteCriteres(undefined); criteres.comboSets = ['violent']; criteres.minStats = { spd: 999 }; criteres.objective = 'ehp';
  localStorage.setItem('swblacksmith-optimizer-lists-v1', JSON.stringify({ lists: [{ id: 'a', name: 'Ancienne' }], activeListId: 'a',
    members: [selector, autreSelector].map(selector => ({ listId: 'a', selector })), validated: [{ listId: 'a', selector, runeIds: [91], artifactIds: [92] }] }));
  localStorage.setItem(OPTIMIZER_MEMBERS_STORAGE_KEY, ecrireMembresOptimizer({
    identities: new Map([selector, autreSelector].map(selector => [cleMemoireMembre('a', selector), { listId: 'a', selector, com2usId: 10101 }])),
    memories: new Map([selector, autreSelector].map(selector => [cleMemoireMembre('a', selector), { listId: 'a', selector, com2usId: 10101, criteres }])),
    teams: [{ id: 'ancienne-equipe', listId: 'a', members: [selector, autreSelector], leader: selector, lead: monstres[0].leaderSkill! }],
    listContents: new Map([['a', 'guilde']]), rejets: { memories: [{ listId: 'rejete', valeur: 'mémoire brute' }],
      teams: [{ listId: 'rejete', valeur: 'équipe brute' }], listContents: [{ listId: 'rejete', contenu: 'inconnu' }],
      identities: [{ listId: 'rejete', com2usId: 'inconnu' }] } }));
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  const root = createRoot(document.getElementById('racine')!);
  await geste(() => root.render(<Banc />));
  await geste(() => etat.choisirMembre('a', selector));
  await geste(() => listes.sauvegarderPoint({ listId: 'a', selector }, data));
  const point = localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY), ancienne = JSON.stringify(listes.memories.get(cleMemoireMembre('a', selector)));
  const idsAvant = new Set(listes.lists.map(l => l.id));
  let avant = photographierExistant(listes, idsAvant);
  verifier(listes.memories.size === 2 && listes.identities.size === 2 && listes.teams.length === 1
    && Object.values(listes.rejets).every(r => r.length > 0), 'précondition : mémoires, identités, équipe, contenu et chaque catégorie de rejets non vides');
  if (nom === 'attente') {
    await preparerResultatsRefus();
    const affichageAvant = photographierAffichage(), resultatAvant = etat.search.result;
    let rapport!: RapportImportOptimizer, appels = 0;
    await geste(() => {
      reverificationEnAttente = true;
      rapport = etat.importerEquipe(courantes => { appels++; return importerDefensesSiegeOptimizer(courantes); });
    });
    verifier(rapport.listeCreee === null && rapport.membresImportes === 0 && rapport.equipesCreees === 0
      && rapport.messages.some(m => m.includes('refusé') && m.includes('revérification') && m.includes('en attente')), 'réimport en attente : refus explicite au rapport');
    verifier(appels === 0, 'refus avant le producteur et toute écriture');
    verifier(listes.activeListId === 'a' && photographierExistant(listes, idsAvant) === avant, 'refus : liste active et toutes les données intactes');
    verifier(photographierAffichage() === affichageAvant && etat.search.result === resultatAvant,
      'refus : sélection, propriétaire après réconciliation, critères et tous les résultats conservés');
    await geste(() => bouton('Importer une équipe').click());
    await geste(() => bouton('Défenses de siège').click());
    verifier([...document.querySelectorAll('[aria-label="Rapport d’import"]')].some(e => visible(e)
      && e.textContent?.includes('revérification') && e.textContent.includes('en attente')), 'refus de revérification lu dans le rapport à l’écran');
    verifier(photographierAffichage() === affichageAvant && etat.search.result === resultatAvant,
      'clic refusé : affichage et résultat toujours intacts');
    await geste(() => {
      const runeIds = new Set<number>(), rev = reverifierStockageOptimizer(listes.lireStockageCourant(), data, runeIds, new Set());
      listes.replaceAfterRevalidation(rev.stockage);
      etat.appliquerReverificationMembres(rev.stockage, rev.rapport, data, runeIds);
      reverificationEnAttente = false;
    });
    avant = photographierExistant(listes, idsAvant);
    await geste(() => { rapport = etat.importerEquipe(importerDefensesSiegeOptimizer); });
    verifier(rapport.listeCreee?.id === listes.activeListId && listes.lists.length === 2, 'revérification terminée : import accepté');
    verifier(etat.proprietaireCriteres?.listId === listes.activeListId && exclusionSelectorKey(etat.proprietaireCriteres.selector) === 'siege-defense:d1:0',
      'après revérification et réconciliation : premier membre importé propriétaire');
  } else if (nom === 'collision') {
    await preparerResultatsRefus();
    const affichageAvant = photographierAffichage(), resultatAvant = etat.search.result;
    let rapport!: RapportImportOptimizer;
    await geste(() => {
      rapport = etat.importerEquipe(courantes => {
        // Simuler une publication concurrente entre la préparation et l'ajout,
        // en gardant la liste active et le propriétaire existants.
        const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
        Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'import' });
        try { listes.createList('Concurrente', 'donjon'); listes.setActiveListId('a'); }
        finally {
          if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid); else delete (crypto as Partial<Crypto>).randomUUID;
        }
        idsAvant.add('import'); avant = photographierExistant(listes.lireStockageCourant(), idsAvant);
        return importerDefensesSiegeOptimizer(courantes);
      });
    });
    verifier(rapport.listeCreee === null && rapport.membresImportes === 0 && rapport.equipesCreees === 0
      && rapport.messages.some(m => m.includes('refusé') && m.includes('identifiant') && m.includes('occupé')), 'collision : refus contrôlé et dit au rapport, sans exception');
    verifier(listes.activeListId === 'a' && photographierExistant(listes, idsAvant) === avant,
      'collision : état courant conservé, liste concurrente comprise');
    verifier(photographierAffichage() === affichageAvant && etat.search.result === resultatAvant,
      'collision : sélection, propriétaire après réconciliation, critères et tous les résultats conservés');
  } else if (nom === 'groupe') {
    let creee = '', rapport!: RapportImportOptimizer, attente = '';
    const uuid = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => 'import' });
    try {
      await geste(() => {
        etat.setMinStats({ spd: 321 });
        listes.renameList('a', 'Ancienne modifiée');
        listes.setListContent('a', 'arene');
        creee = listes.createList('Créée dans le geste', 'donjon');
        listes.addMember(creee, autreSelector, 10101);
        listes.replaceAfterRevalidation(reverifierStockageOptimizer(listes.lireStockageCourant(), data, new Set(), new Set()).stockage);
        const courant = listes.lireStockageCourant();
        idsAvant.add(creee);
        attente = photographierExistant(courant, idsAvant);
        rapport = etat.importerEquipe(importerDefensesSiegeOptimizer);
      });
    } finally {
      if (uuid) Object.defineProperty(crypto, 'randomUUID', uuid); else delete (crypto as Partial<Crypto>).randomUUID;
    }
    verifier(creee === 'import' && listes.lists.length === 3 && listes.lists.some(l => l.id === creee), 'création et import groupés : les deux listes ajoutées sont conservées');
    verifier(rapport.listeCreee?.id === listes.activeListId && listes.activeListId !== creee
      && new Set(listes.lists.map(l => l.id)).size === 3, 'identifiant importé libre dans l’état courant, création en attente comprise');
    verifier(listes.memories.get(cleMemoireMembre('a', selector))?.criteres.minStats.spd === 321,
      'saisie mémorisée groupée avec création et import : valeur conservée');
    verifier(photographierExistant(listes, idsAvant) === attente, 'toutes les écritures en attente et toutes les anciennes données restent identiques après import');
    verifier(etat.proprietaireCriteres?.listId === listes.activeListId && exclusionSelectorKey(etat.proprietaireCriteres.selector) === 'siege-defense:d1:0',
      'après le geste groupé et la réconciliation : premier membre importé propriétaire');
  } else if (nom === 'action') {
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
    avant = photographierExistant(listes, idsAvant);
    let rapport!: RapportImportOptimizer;
    await geste(() => { rapport = etat.importerEquipe(importerDefensesSiegeOptimizer); });
    const id = listes.activeListId!;
    verifier(rapport.listeCreee?.id === id && listes.lists.length === 2, 'action démontée : nouvelle liste active publiée');
    verifier(listes.teams.filter(e => e.listId === id).length === 2 && listes.teams.filter(e => e.listId === id).every(e => e.lead?.amount === 33 && e.members.length === 3), 'action : deux équipes et leads conservés');
    verifier(listes.listContents.get(id) === 'guilde' && [...listes.identities.values()].filter(m => m.listId === id).length === 6, 'action : contenu Guilde et six identités indépendantes');
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
    const ancre = bouton('Importer une équipe');
    const recherche = [...document.querySelectorAll<HTMLInputElement>('input[placeholder="Rechercher un monstre…"]')].find(visible)!;
    const choisi = [...document.querySelectorAll('span')].find(e => visible(e) && e.textContent === 'Monstre 1'
      && position(e).y >= position(recherche).y + position(recherche).height && position(e).y + position(e).height <= position(ancre).y);
    verifier(!!choisi, 'le monstre choisi reste entre sa recherche et les contrôles de liste, sans bouton intercalé');
    const pliListe = bouton('Monstres à optimiser');
    if (pliListe) await geste(() => pliListe.click());
    const selecteurListe = bouton('Ancienne');
    const ecartListe = position(selecteurListe).y - position(ancre).y - position(ancre).height;
    verifier(ecartListe >= 0 && ecartListe <= 42 && position(selecteurListe).x === position(ancre).x
      && position(selecteurListe).width === position(ancre).width, 'import immédiatement au-dessus du sélecteur de listes dans le format visible');
    if (pliListe) await geste(() => pliListe.click());
    const avantDeselection = JSON.stringify(position(ancre));
    await geste(() => { etat.setSelectedId(null); etat.setSourceSelector(null); });
    verifier(JSON.stringify(position(ancre)) === avantDeselection, 'place du monstre réservée : la désélection ne déplace pas l’ancre');
    if (nom === 'defenses') await geste(() => changerSources({ ...data, siegeDefenseTeams: [...data.siegeDefenseTeams,
      { ...deck('d3'), slots: [
        { monsterId: '1', runeSpeed: 120, tick: 0, gear },
        { monsterId: 'inconnu', runeSpeed: null, tick: 0, gear },
        { monsterId: null, runeSpeed: null, tick: 0 },
      ] },
    ] }));
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
      verifier(nom === 'rta' ? listes.teams.every(e => e.listId !== listes.activeListId) : !!bouton('Modifier l’équipe'), 'équipes importées visibles, prépa RTA sans équipe');
    }
    verifier(document.documentElement.scrollWidth <= window.innerWidth, 'format sans débordement horizontal');
  }
  if (nom !== 'groupe') verifier(photographierExistant(listes, idsAvant) === avant,
    'toutes les anciennes listes, appartenances, builds, mémoires, identités, équipes, contenus et rejets sont conservés');
  verifier(localStorage.getItem(OPTIMIZER_BACKUP_STORAGE_KEY) === point, 'point de sauvegarde intact');
  return preuves;
}
