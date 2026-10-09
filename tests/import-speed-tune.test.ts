import { isDeepStrictEqual } from 'node:util';
import type { ArtifactDetail, GearSet, Monster, SiegeTeam } from '../src/types';
import { appliquerCriteres, baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { paireRespecteLignes } from '../src/lib/artifactOptim';
import { leadEffectifMembreOptimizer } from '../src/lib/equipesOptimizer';
import { consommerImportOptimizer } from '../src/lib/importEquipes';
import { importerSpeedTuneOptimizer } from '../src/lib/importSpeedTuneOptimizer';
import { exclusionSelectorKey, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { cleMemoireMembre, type StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { combatSpeed, type LeadInfo } from '../src/lib/speed';
import { ligneVierge, type Ligne } from '../src/lib/speedTuneLignes';
import { computeStats } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const lead: LeadInfo = { amount: 30, area: 'Element', element: 'fire' };
function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: id === 2 ? 'water' : 'fire',
    stars: 5, naturalStars: 5, secondAwaken: false, image: null,
    stats: { hp: 10000, attack: 700, defense: 600, speed: 101, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null };
}
function gear(swift = false, points = 100): GearSet {
  return { base: { hp: 10000, atk: 700, def: 600, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 }, artifacts: [],
    runes: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, slot: i + 1, set: swift && i < 4 ? 'swift' : 'will',
      rank: 6, rarity: 5, level: 15, main: { code: 8, value: i === 0 ? points : 0 }, subs: [] })) };
}
function deck(id: string, ids = [1, 2, 3]): SiegeTeam {
  return { id, lead: 99, tickAlertDismissed: false, slots: ids.map(m => ({ monsterId: String(m), runeSpeed: 999, tick: 300,
    sets: ['violent'], gear: { ...gear(), relic: { id: 50 + m, upgrade: 15, main: { code: 100, value: 20 } } } })) };
}
function sources(): ExclusionSourceData {
  return { box: [1, 2, 3, 4, 5, 6].map(id => ({ key: `box-${id}`, monster: monstre(id), stars: 6, level: 40, gear: gear() })),
    rtaEntries: { '1': { monsterId: '1', section: 'swift', runeSpeed: 999, gear: gear(true) } },
    siegeDefenseTeams: [deck('d1')], siegeOffenseTeams: [deck('o1')],
    monsterById: new Map([1, 2, 3, 4, 5, 6, 7].map(id => [String(id), monstre(id)])) };
}
const ligne = (id: number, swift = false, runeSpeed: number | null = 100): Ligne => ({ ...ligneVierge(monstre(id), 'allie'), runeSpeed, swift });
function stockage(): StockageOptimizer {
  return { identities: new Map(), lists: [], members: [], validated: [], memories: new Map(), teams: [], listContents: new Map(), rejets: { memories: [], teams: [], listContents: [] } };
}
const consommer = (p: ReturnType<typeof importerSpeedTuneOptimizer>, data: ExclusionSourceData) =>
  consommerImportOptimizer(stockage(), null, p, data, 'nouvelle');

function identiteFiche(swift: boolean) {
  const data = sources(), build = gear(swift), fiche = computeStats(build).find(s => s.key === 'spd')!;
  const l = ligne(1, swift, fiche.bonus), p = importerSpeedTuneOptimizer([l], null, data), r = consommer(p, data);
  egal(p.membres[0].criteres.vitesse, { minimum: fiche.total }, 'minimum identique à la fiche réelle computeStats');
  egal(fiche.total, swift ? 227 : 201, 'Swift à plat inclus exactement une fois dans la saisie');
  const photo = r.stockage.memories.get(cleMemoireMembre('nouvelle', p.membres[0].selector))!.criteres;
  egal(photo.minStats, { spd: fiche.total }, 'minimum transmis par completerCriteresImport jusqu’à la mémoire');
  egal(photo.comboSets, swift ? ['swift'] : [], 'Swift seul sélectionné ; les autres sets ne sont pas imposés');
  if (!swift) ok(r.rapport.messages.some(m => m.includes('aucun set sélectionné')), 'absence de set dite au rapport');
}
export function testImportSpeedTuneFicheSwift() {
  titre('Import speed tuning · identité fiche et saisie avec Swift'); identiteFiche(true);
}
export function testImportSpeedTuneFicheSansSwift() {
  titre('Import speed tuning · identité fiche et saisie sans Swift'); identiteFiche(false);
}
export function testImportSpeedTuneEcartSwift() {
  titre('Import speed tuning · même fiche 227, combat 242 avec Swift et 243 sans Swift');
  const avec = computeStats(gear(true, 100)).find(s => s.key === 'spd')!;
  const sans = computeStats(gear(false, 126)).find(s => s.key === 'spd')!;
  egal(avec.total, 227, 'fiche Swift réelle à 227'); egal(sans.total, 227, 'même fiche sans Swift');
  egal(combatSpeed(101, avec.bonus, 0, true), 242, 'combat avec Swift, lead 0');
  egal(combatSpeed(101, sans.bonus, 0, false), 243, 'combat sans Swift, lead 0 : un point d’écart');
  const p = importerSpeedTuneOptimizer([ligne(1, true, 126), ligne(2, false, 126)], null, sources());
  egal(p.membres.map(m => m.criteres.vitesse?.minimum), [227, 227], 'minimum de fiche identique malgré l’écart de combat');
  ok(p.messages.some(m => m.includes('ne garantit pas l’ordre')), 'absence de garantie d’ordre dite au rapport');
}
export function testImportSpeedTuneLigne206() {
  titre('Import speed tuning · seuil 206 saisi sur le cumul de la paire');
  const data = sources(), l = { ...ligne(1), artefactBuff: 10 }, p = importerSpeedTuneOptimizer([l], lead, data);
  const verrou = p.membres[0].criteres.lignesVerrouillees;
  egal(verrou, [{ code: 206, min: 10 }], 'valeur saisie, sans minimum de présence inventé');
  const art = (value: number, kind: 'element' | 'archetype'): ArtifactDetail => ({ id: value, kind, element: 'fire', archetype: 'attack',
    rarity: 5, level: 15, main: { code: 101, value: 100 }, subs: [{ code: 206, value }] });
  ok(paireRespecteLignes([art(4, 'element'), art(6, 'archetype')], verrou), '4 + 6 satisfait le seuil 10 sur la paire');
  ok(!paireRespecteLignes([art(4, 'element'), art(5, 'archetype')], verrou), '4 + 5 est refusé');
  const r = consommer(p, data);
  egal([...r.stockage.memories.values()][0].criteres.lignesVerrouillees, verrou, 'verrou transmis au consommateur');
  for (const valeur of [null, 0, -1, NaN, Infinity]) {
    const q = importerSpeedTuneOptimizer([{ ...l, artefactBuff: valeur }], null, data);
    egal(q.membres[0].criteres.lignesVerrouillees, undefined, 'valeur absente, nulle ou invalide sans verrou');
    if (valeur !== null && valeur !== 0) ok(q.messages.some(m => m.includes('valeur invalide')), 'amplification invalide signalée');
  }
}
export function testImportSpeedTuneLeadElement() {
  titre('Import speed tuning · lead du camp, Guilde et membre d’un autre élément');
  const data = sources(), p = importerSpeedTuneOptimizer([ligne(1), ligne(2)], lead, data), r = consommer(p, data);
  egal(r.rapport.equipesCreees, 1, 'une équipe de deux membres');
  egal(p.contenu, 'guilde', 'contenu Guilde proposé');
  egal(r.stockage.listContents.get('nouvelle'), 'guilde', 'contenu Guilde stocké pour la liste');
  egal(r.stockage.teams[0].lead, { stat: 'Attack Speed', amount: 30, area: 'Element', element: 'fire' }, 'portée et élément conservés');
  for (const m of p.membres) {
    const photo = r.stockage.memories.get(cleMemoireMembre('nouvelle', m.selector))!.criteres;
    const effectif = leadEffectifMembreOptimizer(r.stockage, 'nouvelle', m.selector, data.monsterById.get(m.com2usId === 1001 ? '1' : '2')!.element);
    egal(photo.damageSetup, baseCompleteCriteres(undefined).damageSetup, 'lead absent de la mémoire personnelle');
    egal(appliquerCriteres(photo, effectif).damageSetup.leaderSkill, m.com2usId === 1001 ? { stat: 'Attack Speed', pct: 30 } : undefined,
      'lead effectif seulement sur le membre feu');
  }
  ok(r.rapport.messages.some(m => m.includes('l’élément')), 'membre eau sans lead, motif dit');
}
export function testImportSpeedTuneLignesIgnorees() {
  titre('Import speed tuning · lignes ignorées et vitesse zéro saisie');
  const data = sources();
  const lignes = [ligne(1, false, null), ligne(2, false, NaN), ligne(3, false, -1), ligne(4, false, Infinity),
    ligne(99), { ...ligne(5), monster: { ...monstre(5), com2usId: 9999 } },
    { ...ligne(6), monster: { ...monstre(6), stats: { ...monstre(6).stats, speed: null } } }, ligne(7, false, 0)];
  const p = importerSpeedTuneOptimizer(lignes, lead, data), r = consommer(p, data);
  egal(p.ignores.length, 7, 'sept lignes invalides ignorées par le producteur');
  egal(r.rapport.ignores.length, 7, 'compte et raisons transmis au rapport');
  ok(p.ignores.every(m => m.raison.length > 0), 'chaque ligne ignorée porte sa raison');
  egal(p.membres.map(m => m.criteres.vitesse), [{ minimum: 101 }], 'zéro est une vitesse saisie');
  egal(p.membres[0].selector, { source: 'unowned', monsterId: '7' }, 'espèce absente du compte : unowned');
}
function cardinalite(nombre: number) {
  const data = sources(), p = importerSpeedTuneOptimizer(Array.from({ length: nombre }, (_, i) => ligne(i + 1)), lead, data), r = consommer(p, data);
  egal(r.rapport.membresImportes, nombre, 'tous les membres retenus sont importés');
  egal(r.rapport.equipesCreees, 0, 'aucune équipe hors de 2 à 5 membres');
  egal(r.rapport.listeCreee !== null, nombre > 0, 'liste créée seulement si non vide');
  egal(r.rapport.equipesNonCreees[0].lead, p.equipes[0].lead, 'lead du camp nommé même sans équipe');
  ok(r.rapport.messages.some(m => m.includes('n’est appliqué à personne')), 'absence d’application dite');
  for (const m of r.stockage.memories.values()) {
    const attendu = baseCompleteCriteres(undefined); attendu.minStats = { spd: 201 };
    egal(m.criteres, attendu, 'base complète, aucun lead personnel ni autre critère');
  }
}
export function testImportSpeedTuneZeroMembre() { titre('Import speed tuning · zéro membre'); cardinalite(0); }
export function testImportSpeedTuneUnMembre() { titre('Import speed tuning · un membre sans équipe'); cardinalite(1); }
export function testImportSpeedTuneSixMembres() { titre('Import speed tuning · six espèces sans équipe'); cardinalite(6); }
export function testImportSpeedTuneAvecDeckOrigine() {
  titre('Import speed tuning · exemplaires du deck d’origine facultatif');
  for (const source of ['defense', 'offense'] as const) {
    const data = sources(), origine = { source, teamId: source === 'defense' ? 'd1' : 'o1' };
    const p = importerSpeedTuneOptimizer([ligne(2), ligne(1, true, 126)], lead, data, origine), r = consommer(p, data);
    const prefixe = source === 'defense' ? 'siege-defense' : 'siege-offense';
    egal(p.membres.map(m => exclusionSelectorKey(m.selector)), [`${prefixe}:${origine.teamId}:1`, `${prefixe}:${origine.teamId}:0`], 'slots retrouvés par espèce après déplacement des lignes');
    egal(p.equipes[0].leader, p.membres[1].selector, 'leader du slot 0, pas première ligne');
    egal([...r.stockage.memories.values()].map(m => m.criteres.relicMainChoice), ['equipped', 'equipped'], 'défaut de relique du deck, pas de la Box');
    egal(p.membres.map(m => m.criteres.vitesse?.minimum), [201, 227], 'saisies actuelles, pas vitesses 999 du deck');
    egal(p.equipes[0].lead?.amount, 30, 'lead du camp actuel, pas team.lead = 99');
    const absent = importerSpeedTuneOptimizer([ligne(1)], lead, data, { source, teamId: 'absent' });
    egal(absent.membres.length, 0, 'deck disparu sans remplacement Box'); egal(absent.ignores.length, 1, 'deck disparu signalé');
    const ajout = importerSpeedTuneOptimizer([ligne(4)], lead, data, origine);
    egal(ajout.membres[0].selector, { source: 'box', unitKey: 'box-4' }, 'nouvelle espèce absente du deck : règle du compte');
    ok(ajout.messages.some(m => m.includes('deck d’origine')), 'repli explicitement signalé');
    const team = source === 'defense' ? data.siegeDefenseTeams[0] : data.siegeOffenseTeams[0];
    delete team.slots[0].gear;
    const invalide = importerSpeedTuneOptimizer([ligne(1)], lead, data, origine);
    egal(invalide.membres.length, 0, 'slot du deck sans équipement non remplacé par Box');
  }
}
export function testImportSpeedTuneSansDeckOrigine() {
  titre('Import speed tuning · premier exemplaire Box, RTA, défense puis offense');
  const data = sources();
  data.box.unshift({ ...data.box[0], key: 'premier', gear: { ...gear(), runes: [] } });
  egal(importerSpeedTuneOptimizer([ligne(1)], null, data).membres[0].selector, { source: 'box', unitKey: 'premier' }, 'première copie Box même sans rune');
  for (const attendu of ['box:box-1', 'rta:1', 'siege-defense:d1:0', 'siege-offense:o1:0', 'unowned:1']) {
    if (attendu === 'box:box-1') data.box.shift();
    const p = importerSpeedTuneOptimizer([ligne(1)], null, data);
    egal(exclusionSelectorKey(p.membres[0].selector), attendu, 'ordre de repli stable');
    if (attendu.startsWith('box:')) data.box = data.box.filter(b => b.monster.com2usId !== 1001);
    else if (attendu.startsWith('rta:')) data.rtaEntries = {};
    else if (attendu.startsWith('siege-defense:')) data.siegeDefenseTeams = [];
    else if (attendu.startsWith('siege-offense:')) data.siegeOffenseTeams = [];
  }
  data.box = [{ key: 'sans-gear', monster: monstre(1), stars: 6, level: 40 }];
  const p = importerSpeedTuneOptimizer([ligne(1)], null, data);
  egal(p.membres.length, 0, 'espèce possédée sans exemplaire résolvable jamais convertie en unowned');
  egal(p.ignores.length, 1, 'exemplaire non résolvable signalé');
}
export function testImportSpeedTuneCopiesDeckEtReverification() {
  titre('Import speed tuning · copies du deck et cardinalité après revérification');
  const data = sources(); data.siegeOffenseTeams = [deck('copies', [1, 2, 1])];
  const p = importerSpeedTuneOptimizer([ligne(1), ligne(2), ligne(1)], lead, data, { source: 'offense', teamId: '0' });
  egal(p.membres.map(m => exclusionSelectorKey(m.selector)), ['siege-offense:copies:0', 'siege-offense:copies:1', 'siege-offense:copies:2'],
    'identifiant numérique historique et copies attribuées aux slots dans leur ordre');
  egal(consommer(p, data).rapport.membresImportes, 3, 'copies de même espèce conservées par le consommateur');
  const q = importerSpeedTuneOptimizer([ligne(1), ligne(2)], lead, data);
  data.box = data.box.filter(b => b.key !== 'box-2');
  const r = consommer(q, data);
  egal(r.rapport.membresImportes, 1, 'exemplaire disparu depuis la proposition : ignoré');
  egal(r.rapport.equipesCreees, 0, 'cardinalité revérifiée sur les membres acceptés');
  ok(r.rapport.messages.some(m => m.includes('n’est appliqué à personne')), 'lead refusé dit après revérification');
}
export function testImportSpeedTunePureteEtAnalyse() {
  titre('Import speed tuning · données copiées et aucune lecture des modificateurs d’analyse');
  const data = sources(), l = { ...ligne(1, true, 126), artefactBuff: 10, masque: true };
  Object.defineProperty(l, 'atbMod', { get: () => { throw new Error('Lecture de l’analyse ATB'); } });
  Object.defineProperty(l, 'speedMod', { get: () => { throw new Error('Lecture de l’analyse VIT'); } });
  Object.defineProperty(l, 'cumulsPassif', { get: () => { throw new Error('Lecture du passif'); } });
  const avant = structuredClone(data), leadAvant = { ...lead };
  const p = importerSpeedTuneOptimizer([l, { ...ligne(2), camp: 'ennemi' }], lead, data);
  egal(p.membres.length, 1, 'ligne alliée masquée conservée ; adversaire exclu');
  ok(isDeepStrictEqual(data, avant), 'aucune mutation des sources'); egal(lead, leadAvant, 'aucune mutation du lead');
  p.equipes[0].lead!.amount = 1; p.membres[0].criteres.comboSets!.push('violent');
  egal(lead.amount, 30, 'lead importé copié'); egal(l.runeSpeed, 126, 'saisie inchangée');
}

export const verificationsImportSpeedTune: [string, () => void][] = [
  testImportSpeedTuneFicheSwift, testImportSpeedTuneFicheSansSwift, testImportSpeedTuneEcartSwift,
  testImportSpeedTuneLigne206, testImportSpeedTuneLeadElement, testImportSpeedTuneLignesIgnorees,
  testImportSpeedTuneZeroMembre, testImportSpeedTuneUnMembre, testImportSpeedTuneSixMembres,
  testImportSpeedTuneAvecDeckOrigine, testImportSpeedTuneSansDeckOrigine, testImportSpeedTunePureteEtAnalyse,
  testImportSpeedTuneCopiesDeckEtReverification,
].map(test => [test.name, test]);
