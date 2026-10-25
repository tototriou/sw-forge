import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import { classerEnLocal } from '../../src/lib/classementCompact';
import { contexteResultat } from '../../src/lib/contexteResultat';
import { resoudreContexteRelique } from '../../src/lib/relicOptim';
import { fixtureClassementCombat } from '../classement-fixture';
import type { Monster } from '../../src/types';

// Le résultat est synthétique ; hooks, effets, validation et cartes sont ceux de l'application.
const f = fixtureClassementCombat('ehp');
const relicContext = resoudreContexteRelique({ mode: 'off', principale: 'libre', type: 'libre', seuil: 6 }, f.photo.fiche.relic, []);
const photo = contexteResultat({ ...f.photo, params: { ...f.params, relicContext, objective: 'degats_reels' },
  resolution: { ...f.photo.resolution!, relicContext } });
const publication = classerEnLocal(photo, f.candidats, f.vue);
const resultat = { ...publication.bilan, explored: 42, truncated: false, nearMissByCondition: [], globalNearMiss: null,
  candidates: publication.candidats };
const monster: Monster = { id: 1, com2usId: 1, name: 'Test', element: 'fire', archetype: 'attack', stars: 6,
  naturalStars: 5, secondAwaken: false, image: null, leaderSkill: null,
  stats: { hp: 10000, attack: 700, defense: 600, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 } };
const box = [{ key: '1', monster, gear: f.photo.fiche, stars: 6, level: 40 }];
const allMonsters = [monster], rtaEntries = {}, siegeDefenseTeams: [] = [], siegeOffenseTeams: [] = [];
const data = { box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, monsterById: new Map([['1', monster]]) };
const runeIds = new Set(f.params.pool.map(r => r.id));
let etat: OptimizerState, listes: UseOptimizerLists, afficherResultat: () => void;
const photoInitiale = JSON.stringify(photo), ordreInitial = publication.affichees;

function Banc() {
  listes = useOptimizerLists();
  etat = useOptimizerState({ lists: listes, data, runeIds });
  const [resultatVisible, setResultatVisible] = useState(false);
  afficherResultat = () => setResultatVisible(true);
  const optimizer: OptimizerState = resultatVisible ? { ...etat,
    search: { ...etat.search, status: 'done', result: resultat, contexte: photo, classement: publication } } : etat;
  return <OptimizerSection box={box} runes={f.params.pool} artifacts={f.photo.resolution!.artifactParams.inventaire}
    relics={[f.photo.fiche.relic!]} relicUsageById={{}} optimizer={optimizer} lists={listes} allMonsters={allMonsters}
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

export async function monter() {
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
  const indice = publication.affichees.findIndex(c => c.runeIds[0] !== f.photo.fiche.runes[0].id);
  if (indice < 0) throw new Error('La fixture ne fournit pas de carte différente de la fiche');
  return { indice, labels: publication.affichees[indice].stats.map(s => s.label) };
}

export function etatApresValidation() {
  return {
    valide: listes.validated.length === 1,
    photoConservee: JSON.stringify(photo) === photoInitiale,
    ordreConserve: publication.affichees === ordreInitial,
    contexteVivantDistinct: etat.damageSetup.enemyDef !== photo.damageSetup.enemyDef,
    runesValidees: listes.validated[0]?.runeIds ?? [],
  };
}
