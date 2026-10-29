import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import { contexteResultat, type ContexteResultat } from '../../src/lib/contexteResultat';
import { resoudreContexteRelique } from '../../src/lib/relicOptim';
import { classerPourLaPage, fixtureClassementCombat } from '../classement-fixture';
import type { Monster, RelicDetail } from '../../src/types';

// Le résultat est synthétique ; hooks, effets, validation et cartes sont ceux de l'application.
const f = fixtureClassementCombat('ehp');
const monster: Monster = { id: 1, com2usId: 1, name: 'Test', element: 'fire', archetype: 'attack', stars: 6,
  naturalStars: 5, secondAwaken: false, image: null, leaderSkill: null,
  stats: { hp: 10000, attack: 700, defense: 600, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 } };
const allMonsters = [monster], rtaEntries = {}, siegeDefenseTeams: [] = [], siegeOffenseTeams: [] = [];
const runeIds = new Set(f.params.pool.map(r => r.id));

/**
 * `fixe` : la relique portée, seule possible. `recherche` : le monstre porte
 * une relique de PV et la recherche en retient une autre — le cas où une
 * fiche validée gardait la relique portée et « Comparer » ce build à
 * lui-même donnait un écart.
 */
export type VarianteRelique = 'fixe' | 'recherche';

function preparer(variante: VarianteRelique) {
  const reliques = f.photo.resolution!.relicContext!.eligibles;
  const portee: RelicDetail = variante === 'fixe' ? f.photo.fiche.relic! : reliques.find(r => r.id !== f.photo.fiche.relic!.id)!;
  const fiche = { ...f.photo.fiche, relic: portee };
  const relicContext = variante === 'fixe'
    ? resoudreContexteRelique({ mode: 'off', principale: 'libre', type: 'libre', seuil: 6 }, portee, [])
    : resoudreContexteRelique({ mode: 'recherche', principale: 'libre', type: 'libre', seuil: 6 }, portee, reliques);
  const photo = contexteResultat({ ...f.photo, fiche, params: { ...f.params, relicContext, objective: 'degats_reels' },
    resolution: { ...f.photo.resolution!, fiche, relicContext } });
  const { instantane: publication } = classerPourLaPage(photo, f.candidats, f.vue);
  const box = [{ key: '1', monster, gear: fiche, stars: 6, level: 40 }];
  return { photo, publication, box, portee, relics: variante === 'fixe' ? [portee] : reliques,
    resultat: { ...publication.bilan!, nombre: publication.comptes.recus },
    data: { box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, monsterById: new Map([['1', monster]]) },
    photoInitiale: JSON.stringify(photo), ordreInitial: publication.page.cartes };
}

let banc: ReturnType<typeof preparer>;
let etat: OptimizerState, listes: UseOptimizerLists, afficherResultat: () => void;

function Banc() {
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data: banc.data, runeIds });
  const [resultatVisible, setResultatVisible] = useState(false);
  afficherResultat = () => setResultatVisible(true);
  const photo: ContexteResultat = banc.photo;
  const optimizer: OptimizerState = resultatVisible ? { ...etat,
    search: { ...etat.search, status: 'done', result: banc.resultat, contexte: photo, classement: banc.publication } } : etat;
  return <OptimizerSection box={banc.box} runes={f.params.pool} artifacts={f.photo.resolution!.artifactParams.inventaire}
    relics={banc.relics} relicUsageById={{}} optimizer={optimizer} lists={listes} allMonsters={allMonsters}
    rtaEntries={rtaEntries} siegeDefenseTeams={siegeDefenseTeams} siegeOffenseTeams={siegeOffenseTeams}
    accountName="Synthétique" menuOuvert={false} onFermerMenu={() => {}} onOuvrirMenu={() => {}}
    onImporterEquipe={etat.importerEquipe} />;
}

async function geste(action: () => void) {
  flushSync(action);
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); c.port2.close(); r(null); }; c.port2.postMessage(null); });
  flushSync(() => {});
}

export async function monter(variante: VarianteRelique = 'fixe') {
  banc = preparer(variante);
  localStorage.clear();
  setPersistence(false);
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  const root = createRoot(document.getElementById('racine')!);
  await geste(() => root.render(<Banc />));
  let listId = '';
  await geste(() => { listId = listes.createList('Comparaison', 'guilde'); });
  await geste(() => { listes.addMember(listId, { source: 'box', unitKey: '1' }, monster.com2usId!); });
  await geste(() => { etat.choisirMembre(listId, { source: 'box', unitKey: '1' }); });
  await geste(afficherResultat);
  // En `recherche`, une carte dont la relique retenue n'est pas la portée.
  const indice = banc.publication.page.cartes.findIndex(c => c.candidat.runeIds[0] !== f.photo.fiche.runes[0].id
    && (variante === 'fixe' || (c.resultat?.relique != null && c.resultat.relique.id !== banc.portee.id)));
  if (indice < 0) throw new Error(`La fixture ne fournit pas de carte différente de la fiche (relique ${variante})`);
  const carte = banc.publication.page.cartes[indice];
  return { indice, labels: carte.candidat.stats.map(s => s.label), reliqueCarte: carte.resultat?.relique?.id ?? banc.portee.id };
}

export function etatApresValidation() {
  return {
    valide: listes.validated.length === 1,
    photoConservee: JSON.stringify(banc.photo) === banc.photoInitiale,
    ordreConserve: banc.publication.page.cartes === banc.ordreInitial,
    contexteVivantDistinct: etat.damageSetup.enemyDef !== banc.photo.damageSetup.enemyDef,
    runesValidees: listes.validated[0]?.runeIds ?? [],
    reliqueValidee: listes.validated[0]?.reliqueId ?? null,
  };
}
