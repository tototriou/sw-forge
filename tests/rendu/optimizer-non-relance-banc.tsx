import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import { SettingsList } from '../../src/components/SettingsMenu';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import { searchBuilds } from '../../src/lib/rechercheRunes';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs, tamponsCandidats } from '../../src/lib/candidatsCompacts';
import type { DemandeDeRecherche } from '../../src/workers/runeBuildOptim.worker';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { ExclusionSelector, ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import type { Monster, RelicDetail, RuneDetail } from '../../src/types';

// Le moteur de runes tourne dans la page sur un minuscule inventaire ; le
// classeur et le résolveur sont les vrais Workers. Seul le transport de la
// recherche est remplacé, dans le protocole réel (blocs et scellement).
const stats = { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 };
const monstres: Monster[] = [
  { id: 1, com2usId: 10101, name: 'Premier', element: 'fire', archetype: 'attack', stars: 6, naturalStars: 5, secondAwaken: false, image: null, stats, leaderSkill: null },
  { id: 2, com2usId: 10102, name: 'Second', element: 'water', archetype: 'attack', stars: 6, naturalStars: 5, secondAwaken: false, image: null, stats, leaderSkill: null },
];
const base = { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
// Trois runes Énergie par emplacement, VIT, ATQ % ou PV % : aucune ne domine
// les autres, 3⁶ = 729 builds, bien au-delà des K confirmées que la file vise
// (un geste qui relirait un réglage en direct y demanderait des résolutions).
const SOUS = [{ code: 8, base: 4 }, { code: 4, base: 5 }, { code: 2, base: 6 }];
const runes: RuneDetail[] = Array.from({ length: 18 }, (_, i) => ({
  id: 101 + i, slot: (i % 6) + 1, set: 'energy', rank: 6, rarity: 5, level: 15,
  main: { code: i % 6 === 1 ? 8 : 1, value: i % 6 === 1 ? 42 : 100 },
  subs: [{ code: SOUS[Math.floor(i / 6)].code, value: SOUS[Math.floor(i / 6)].base + (i % 6) }],
}));
// Une relique portée : sans relique, la recherche « Libre » serait refusée.
const relique: RelicDetail = { id: 701, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } };
const premier: ExclusionSelector = { source: 'box', unitKey: '11' };
const second: ExclusionSelector = { source: 'box', unitKey: '22' };
const box: BoxItem[] = [
  { key: '11', monster: monstres[0], stars: 6, level: 40, gear: { base, runes: runes.slice(0, 6), artifacts: [], relic: relique } },
  { key: '22', monster: monstres[1], stars: 6, level: 40, gear: { base, runes: [], artifacts: [] } },
];
const data: ExclusionSourceData = { box, rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map(monstres.map(m => [String(m.id), m])) };
const runeIds = new Set(runes.map(r => r.id));
let etat: OptimizerState, listes: UseOptimizerLists, root: Root | null = null;
let recherches = 0, classeurs: Worker[] = [], poserMenu: (ouvert: boolean) => void = () => {};

function Banc() {
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds });
  // Au téléphone, le panneau des réglages s'ouvre depuis la barre de l'app, absente du banc.
  const [menu, setMenu] = useState(false);
  poserMenu = setMenu;
  // Le vrai contrôle de la mesure (« Score », réglages de l'app) à côté de l'écran.
  return <><SettingsList /><OptimizerSection box={box} runes={runes} artifacts={[]} relics={[relique]} relicUsageById={{}} optimizer={etat}
    onImporterEquipe={etat.importerEquipe} lists={listes} allMonsters={monstres} rtaEntries={{}} siegeDefenseTeams={[]} siegeOffenseTeams={[]}
    accountName="Synthétique" menuOuvert={menu} onFermerMenu={() => setMenu(false)} onOuvrirMenu={() => setMenu(true)} /></>;
}

async function geste(action: () => void) {
  flushSync(action);
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); r(null); }; c.port2.postMessage(null); });
  flushSync(() => {});
}

/** Compte chaque Worker créé ; la recherche passe par le moteur de la page. */
function installerWorkers() {
  const WorkerNatif = (globalThis as unknown as { WorkerNatif?: typeof Worker }).WorkerNatif ?? globalThis.Worker;
  (globalThis as unknown as { WorkerNatif: typeof Worker }).WorkerNatif = WorkerNatif;
  class RechercheSimulee {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror = null; onmessageerror = null;
    private port: MessagePort | null = null;
    private actif = true;
    constructor() { recherches++; }
    postMessage(demande: DemandeDeRecherche | { stop: true }) {
      if (!('params' in demande)) return;
      if (!demande.classement) throw new Error('Port du classeur absent du banc de recherche');
      const { port, idRecherche } = demande.classement;
      this.port = port;
      const { candidates, ...bilan } = searchBuilds(demande.params);
      const colonnes = creerColonnesCandidats();
      for (const c of candidates) ajouterObjetCandidat(colonnes, c);
      queueMicrotask(() => {
        if (!this.actif) return;
        const blocs = extraireBlocs(colonnes);
        blocs.forEach((bloc, sequence) => port.postMessage({ type: 'candidats', idRecherche, sequence, bloc }, tamponsCandidats([bloc])));
        port.postMessage({ type: 'sceller', idRecherche, nombre: candidates.length, derniereSequence: blocs.length - 1, bilan });
      });
    }
    terminate() { this.actif = false; this.onmessage = null; this.port?.close(); }
  }
  globalThis.Worker = function(url: string | URL, options?: WorkerOptions) {
    const chemin = new URL(url, location.href).pathname;
    if (chemin.endsWith('/runeBuildOptim.worker.ts')) return new RechercheSimulee();
    const w = new WorkerNatif(url, options);
    if (chemin.endsWith('/classement.worker.ts')) classeurs.push(w);
    if (chemin.endsWith('/resolution.worker.ts')) relayerResolveur(w);
    return w;
  } as unknown as typeof Worker;
}

// Chaque canal classeur ↔ résolveur du pool passe par la page, sans rien
// changer aux messages : le test peut y retenir les réponses des vrais
// résolveurs, comme des résolutions longues en vol. Le compte des réponses
// libres est commun au pool ; une réponse retenue repart par son canal.
let reponsesLibres = Infinity, reponsesRetenues: { classeur: MessagePort; data: unknown }[] = [];
function relayerResolveur(w: Worker) {
  const poster = w.postMessage.bind(w) as (m: unknown, t?: Transferable[]) => void;
  w.postMessage = ((m: { type?: string; port?: MessagePort }, t?: Transferable[]) => {
    if (m?.type !== 'port' || !m.port) { poster(m, t); return; }
    const classeur = m.port, relais = new MessageChannel();
    reponsesLibres = Infinity; reponsesRetenues = reponsesRetenues.filter((r) => r.classeur !== classeur);
    classeur.onmessage = (e) => relais.port1.postMessage(e.data);
    relais.port1.onmessage = (e) => {
      if (reponsesLibres > 0) { reponsesLibres--; classeur.postMessage(e.data); } else reponsesRetenues.push({ classeur, data: e.data });
    };
    poster({ type: 'port', port: relais.port2 }, [relais.port2]);
  }) as typeof w.postMessage;
}

/** Les `n` prochaines réponses du pool passent, les suivantes sont retenues. */
export function retenirResolutionsApres(n: number) { reponsesLibres = n; }
/** Une réponse retenue part vers le classeur, par son canal ; rend le nombre qui reste retenu. */
export function relacherUneResolution() {
  const r = reponsesRetenues.shift();
  if (r) r.classeur.postMessage(r.data);
  return reponsesRetenues.length;
}

/** `garder` : la conservation acceptée, pour qu'un rechargement relise listes et réglages. */
export async function monter(garder = false) {
  localStorage.clear();
  setPersistence(garder);
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  installerWorkers();
  recherches = 0; classeurs = [];
  root = createRoot(document.getElementById('racine')!);
  await geste(() => root!.render(<Banc />));
  let listId = '';
  await geste(() => { listId = listes.createList('Essai', 'guilde'); });
  await geste(() => { listes.addMember(listId, premier, 10101); listes.addMember(listId, second, 10102); });
  await geste(() => { etat.choisirMembre(listId, premier); });
  await geste(() => { etat.setComboSets(['energy', 'energy', 'energy']); });
  return { listId };
}

/** Après un vrai rechargement de la page (Playwright) : l'écran se monte sur ce que le stockage a gardé. */
export async function apresRechargement() {
  installerWorkers();
  recherches = 0; classeurs = [];
  root = createRoot(document.getElementById('racine')!);
  await geste(() => root!.render(<Banc />));
}

export function releve() {
  const c = etat.search.classement;
  return {
    recherches, classeurs: classeurs.length, status: etat.search.status, interrompu: etat.search.classementInterrompu,
    idRecherche: c?.versions.idRecherche ?? null, enAttente: c?.enAttente ?? null, resolus: c?.comptes.resolus ?? null,
    confirmees: c?.comptes.confirmees ?? null, premierRang: c?.page.premierRang ?? null, places: c?.page.placesEnAttente ?? null,
    resultsPage: etat.resultsPage, metric: c?.vue.metric ?? null, tri: c?.vue.tri ?? null,
    listes: listes.lists.length, membre: etat.selectedId ?? null,
    recus: c?.comptes.recus ?? null, cartes: c?.page.cartes.map(x => x.candidat.runeIds.join('-')) ?? [],
    contexte: JSON.stringify(etat.search.contexte), toutVerifierPhoto: etat.search.contexte?.toutVerifier ?? null,
    minStatsPhoto: etat.search.contexte?.recherche.requirement.minStats ?? null,
  };
}

export async function gesteNomme(nom: string) {
  await geste(() => {
    if (nom === 'stats') etat.setMinStats({ spd: 101 });
    else if (nom === 'maximums') etat.setMaxStats({ atk: 5000 });
    else if (nom === 'objectif') etat.setObjective('vitesse');
    else if (nom === 'sets') etat.setComboSets(['energy', 'energy']);
    else throw new Error(`Geste inconnu : ${nom}`);
  });
}

/** Le panneau du téléphone, comme le bouton de la barre de l'app l'ouvre et le ferme. */
export async function menuTelephone(ouvert: boolean) { await geste(() => poserMenu(ouvert)); }

/**
 * Le Worker de classement tombe en faute juste après avoir publié une page au-delà
 * de la première, entamée et non pleine (des cartes, des places en attente) :
 * l'écran a reçu cette page, puis perd son classeur.
 */
export function perdreClasseurSurPageEntamee() {
  const w = classeurs[classeurs.length - 1];
  if (!w?.onerror) throw new Error('Classeur absent');
  const surMessage = (e: MessageEvent) => {
    const p = e.data?.type === 'publication' ? e.data.publication : null;
    if (!p || p.page.premierRang === 1 || p.page.cartes.length === 0 || p.page.placesEnAttente === 0) return;
    w.removeEventListener('message', surMessage);
    (w.onerror as (e: ErrorEvent) => void)(new ErrorEvent('error', { message: 'classeur perdu (banc)' }));
  };
  // Après le `onmessage` du hook : la page est déjà reçue quand la faute arrive.
  w.addEventListener('message', surMessage);
}

/** Le Worker de classement tombe en faute, comme un plantage réel. */
export async function perdreClasseur() {
  const w = classeurs[classeurs.length - 1];
  if (!w?.onerror) throw new Error('Classeur absent');
  await geste(() => { (w.onerror as (e: ErrorEvent) => void)(new ErrorEvent('error', { message: 'classeur perdu (banc)' })); });
}
