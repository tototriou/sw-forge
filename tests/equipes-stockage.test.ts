// Conservation des équipes de « Mes équipes » (IndexedDB) et leur fichier.
//
// ⚠️ Ce qui casserait sans bruit : une suppression ressuscitée par une
// écriture en retard, une équipe illisible effacée par la relecture, un
// fichier importé qui écrase une équipe présente.

import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { parseArenaDecks } from '../src/lib/importAccount';
import { composerSession, ecrireSession, empreinteTravail, lireSession } from '../src/lib/session';
import { egal, ok, titre } from './outils';
import { chargerEquipes, enregistrerEquipes, oublierConnexionEquipes, supprimerEquipes, viderEquipes } from '../src/lib/equipesStore';
import { ecrireFichierEquipes, lireFichierEquipes } from '../src/lib/equipesFichier';
import { creerEquipe, ecrituresEntre, fusionnerRelecture, type EquipeEnregistree } from '../src/lib/equipesEnregistrees';
import { monstreEx } from './equipes-enregistrees.test';

const T0 = new Date('2026-11-05T10:00:00Z');
const equipe = (id: string): EquipeEnregistree => ({ ...creerEquipe(id, 'rta', `Équipe ${id}`, T0), monstres: [monstreEx('a', 1, 11), monstreEx('b', 2, 12)], leader: 'a' });

async function brutDansLaBase(id: string, valeur: unknown) {
  await new Promise<void>((resolve) => {
    const req = indexedDB.open('swblacksmith-equipes', 1);
    req.onsuccess = () => {
      const t = req.result.transaction('equipes', 'readwrite');
      t.objectStore('equipes').put(valeur, id);
      t.oncomplete = () => { req.result.close(); resolve(); };
    };
  });
}

async function testEquipesStockageFile() {
  titre('Mes équipes — conservation IndexedDB');
  await viderEquipes();
  ok(await enregistrerEquipes([equipe('e1'), equipe('e2')]), 'deux équipes écrites');
  let lu = await chargerEquipes();
  egal(lu?.equipes.map((e) => e.id).sort(), ['e1', 'e2'], 'et relues');
  egal(lu?.equipes.find((e) => e.id === 'e1'), equipe('e1'), 'à l’identique');
  // Écriture puis suppression sans attendre : l'ordre des gestes tient.
  void enregistrerEquipes([{ ...equipe('e1'), nom: 'Modifiée' }]);
  void supprimerEquipes(['e1']);
  lu = await chargerEquipes();
  egal(lu?.equipes.map((e) => e.id), ['e2'], 'une suppression n’est jamais ressuscitée par une écriture en retard');
  await brutDansLaBase('cassee', { id: 'cassee', onglet: 42 });
  oublierConnexionEquipes();
  lu = await chargerEquipes();
  egal([lu?.equipes.length, lu?.illisibles, lu?.clesIllisibles], [1, 1, ['cassee']], 'une entrée illisible est écartée, comptée, et sa clé réservée');
  lu = await chargerEquipes();
  egal(lu?.illisibles, 1, 'et la relecture ne l’efface pas');
  ok(await viderEquipes(), 'vider la base');
  egal((await chargerEquipes())?.equipes.length, 0, 'plus rien après « Tout supprimer »');
}

function testEquipesStockageFusion() {
  titre('Mes équipes — relecture sous les gestes');
  const disque = [equipe('e1'), equipe('e2'), equipe('e3')];
  const memoire = [{ ...equipe('e1'), nom: 'Geste' }, equipe('n1')];
  const fus = fusionnerRelecture(memoire, disque, new Set(['e3']));
  egal(fus.map((e) => e.id), ['e1', 'n1', 'e2'], 'la mémoire gagne, une équipe supprimée pendant la relecture ne revient pas');
  egal(fus[0].nom, 'Geste', 'le geste n’est pas remplacé par la version relue');
  const a = equipe('a');
  const b = equipe('b');
  const b2 = { ...b, nom: 'B2' };
  egal(ecrituresEntre([a, b], [b2]), { aEcrire: [b2], aSupprimer: ['a'] }, 'écritures : les changées et les disparues seulement');
}

function testEquipesFichier() {
  titre('Mes équipes — fichier');
  const lie = { ...equipe('e1'), lienOptimizer: { listId: 'L', equipeId: 'E', correspondance: [] } };
  const texte = ecrireFichierEquipes([lie, equipe('e2')], T0);
  const brut = JSON.parse(texte);
  egal([brut.format, brut.version, brut.exporteLe], ['swblacksmith/equipes', 1, T0.toISOString()], 'en-tête du fichier');
  let n = 0;
  const lu = lireFichierEquipes(texte, new Set(['e2']), () => `neuf${++n}`);
  ok(lu.ok, 'le fichier se relit');
  if (!lu.ok) return;
  egal(lu.equipes.map((e) => e.id), ['e1', 'neuf1'], 'une équipe dont l’id existe reçoit un nouvel id');
  egal(lu.nouveauxId, 1, 'et le rapport le compte');
  ok(lu.equipes.every((e) => e.lienOptimizer === undefined), 'les liens vers l’Optimizer sont retirés');
  const avecInvalide = JSON.stringify({ ...brut, equipes: [...brut.equipes, { id: 'x' }] });
  const lu2 = lireFichierEquipes(avecInvalide, new Set(), () => 'z');
  egal(lu2.ok && lu2.ignorees, 1, 'une équipe invalide est ignorée et comptée');
  const stCasse = { ...brut, equipes: [{ ...brut.equipes[0], speedTune: { plan: 'illisible', liens: [] } }] };
  const lu3 = lireFichierEquipes(JSON.stringify(stCasse), new Set(['e1']), () => 'nouvel');
  egal(lu3.ok && lu3.signalements, [{ id: 'nouvel', signalements: ['speedTuneIncomplet'] }], 'un speed tune abîmé est signalé sous l’identifiant définitif');
  egal(lireFichierEquipes(JSON.stringify({ ...brut, format: 'swblacksmith/session' }), new Set(), () => 'z'), { ok: false, raison: 'format' }, 'un autre format est refusé entier');
  egal(lireFichierEquipes('pas du json', new Set(), () => 'z'), { ok: false, raison: 'illisible' }, 'un texte illisible est refusé');
  egal(lireFichierEquipes(JSON.stringify({ ...brut, version: 2 }), new Set(), () => 'z'), { ok: false, raison: 'version' }, 'une version inconnue est refusée');
  ok(lireFichierEquipes(JSON.stringify({ ...brut, format: 'sw-forge/equipes' }), new Set(), () => 'z').ok, 'l’ancien préfixe reste reconnu');
}

export const verificationsEquipesStockage: [string, () => void | Promise<void>][] = [
  ['testEquipesStockageFile', testEquipesStockageFile],
  ['testEquipesStockageFusion', testEquipesStockageFusion],
  ['testEquipesFichier', testEquipesFichier],
];

function testEquipesDecksArene() {
  titre('Mes équipes — decks d’arène lus dans l’export');
  const compte = JSON.parse(readFileSync(new URL('./fixtures/compte-banc.json', import.meta.url), 'utf8'));
  const decks = parseArenaDecks(compte);
  egal(decks.map((d) => [d.cle, d.rang, d.slots.map((s) => s.unitId)]),
    [['defense', 0, [102]], ['defense-serveur', 0, [101]], ['attaque', 0, [101]]],
    'défense, défense de serveur (unit_id en objet) et attaque au deck_type 1');
  egal(decks[1].slots[0].gear.runes.map((r) => r.id), [1004], 'une défense prend le preset de son deck');
  egal(decks[0].slots[0].gear.runes.map((r) => r.id), [2001, 2002], 'sans preset, ce que porte le monstre');
  egal(decks[0].slots[0].gear.artifacts.map((a) => a.id), [5002], 'artéfacts portés avec');
  egal(decks[0].slots[0].com2usId, 14314, 'l’espèce de l’unité');
  egal(parseArenaDecks({ unit_list: [] }), [], 'un export sans deck d’arène rend une liste vide');
  const presetVide = { ...compte, defense_deck_info: { ...compte.defense_deck_info, equip: [{ unit_id: 102, rune_id_list: [], artifact_id_list: [] }] } };
  egal(parseArenaDecks(presetVide)[0].slots[0].gear.runes, [], 'un preset présent mais vide fait foi : pas de repli sur ce que porte le monstre');
}

verificationsEquipesStockage.push(['testEquipesDecksArene', testEquipesDecksArene]);

function testEquipesSession() {
  titre('Mes équipes — sauvegarde de session');
  const base = { maintenant: T0, versionApp: 'test', stockage: {}, compte: null, memoire: {}, optimizer: null };
  const session = composerSession({ ...base, equipes: [equipe('e1')] });
  const lu = lireSession(ecrireSession(session));
  egal(lu.ok && lu.session.equipes.map((e) => e.id), ['e1'], 'les équipes voyagent dans la session');
  ok(empreinteTravail(session) !== empreinteTravail(composerSession(base)), 'une équipe change l’empreinte du travail');
  const sansChamp = JSON.parse(ecrireSession(composerSession(base)));
  delete sansChamp.equipes;
  const lu2 = lireSession(JSON.stringify(sansChamp));
  egal(lu2.ok && lu2.session.equipes, [], 'une session écrite avant ce champ se relit sans équipe');
  const abimee = lireSession(JSON.stringify({ ...sansChamp, equipes: [{ id: 'x' }, equipe('e2')] }));
  egal(abimee.ok && [abimee.session.equipes.length, abimee.avertissements.length], [1, 1], 'une équipe illisible est laissée et dite');
}

verificationsEquipesStockage.push(['testEquipesSession', testEquipesSession]);
