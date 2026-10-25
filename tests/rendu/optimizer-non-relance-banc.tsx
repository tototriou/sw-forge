import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
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
// Deux runes Énergie par emplacement, l'une VIT, l'autre ATQ : aucune ne domine
// l'autre, 64 builds, quatre pages de cartes.
const runes: RuneDetail[] = Array.from({ length: 12 }, (_, i) => ({
  id: 101 + i, slot: (i % 6) + 1, set: 'energy', rank: 6, rarity: 5, level: 15,
  main: { code: i % 6 === 1 ? 8 : 1, value: i % 6 === 1 ? 42 : 100 }, subs: [i < 6 ? { code: 8, value: 4 + i } : { code: 4, value: 5 + i }],
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
let recherches = 0, classeurs: Worker[] = [];

function Banc() {
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds });
  return <OptimizerSection box={box} runes={runes} artifacts={[]} relics={[relique]} relicUsageById={{}} optimizer={etat}
    onImporterEquipe={etat.importerEquipe} lists={listes} allMonsters={monstres} rtaEntries={{}} siegeDefenseTeams={[]} siegeOffenseTeams={[]}
    accountName="Synthétique" menuOuvert={false} onFermerMenu={() => {}} onOuvrirMenu={() => {}} />;
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
    return w;
  } as unknown as typeof Worker;
}

export async function monter() {
  localStorage.clear();
  setPersistence(false);
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

/** « Rafraîchir » : tout l'état de la page disparaît et l'écran se remonte, sans rien relancer. */
export async function remonter() {
  await geste(() => root?.unmount());
  recherches = 0; classeurs = [];
  root = createRoot(document.getElementById('racine')!);
  await geste(() => root!.render(<Banc />));
}

export function releve() {
  const c = etat.search.classement;
  return {
    recherches, classeurs: classeurs.length, status: etat.search.status, interrompu: etat.search.classementInterrompu,
    idRecherche: c?.versions.idRecherche ?? null, enAttente: c?.enAttente ?? null, resolus: c?.comptes.resolus ?? null,
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
    else if (nom === 'toutVerifier') etat.setVerifierToutesLesCombinaisons(true);
    else if (nom === 'tri') etat.setSortBy('hp');
    else if (nom === 'monstre') etat.choisirMembre(listes.activeListId!, second);
    else throw new Error(`Geste inconnu : ${nom}`);
  });
}

/** Le Worker de classement tombe en faute, comme un plantage réel. */
export async function perdreClasseur() {
  const w = classeurs[classeurs.length - 1];
  if (!w?.onerror) throw new Error('Classeur absent');
  await geste(() => { (w.onerror as (e: ErrorEvent) => void)(new ErrorEvent('error', { message: 'classeur perdu (banc)' })); });
}
