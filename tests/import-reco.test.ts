import { isDeepStrictEqual } from 'node:util';
import type { ArtifactDetail, RecoDeck } from '../src/types';
import { appliquerCriteres, baseCompleteCriteres } from '../src/lib/criteresOptimizer';
import { retrouverDeckCompositionOptimizer } from '../src/lib/deckCompositionOptimizer';
import { ARTIFACT_SUB, artifactSubKinds } from '../src/lib/effects';
import { paireRespecteLignes } from '../src/lib/artifactOptim';
import { leadEffectifMembreOptimizer } from '../src/lib/equipesOptimizer';
import { consommerImportOptimizer } from '../src/lib/importEquipes';
import { importerRecoOptimizer } from '../src/lib/importRecoOptimizer';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSourceData } from '../src/lib/optimizerExclusion';
import { collectOwnedBuilds, collectOwnedTeams, indexBuildsByCom2us } from '../src/lib/ownedBuilds';
import { matchDeck } from '../src/lib/recoMatch';
import { computeStats } from '../src/lib/stats';
import { deckComposition, gearComposition, recommandationComposition, sourcesComposition, stockageComposition } from './import-composition-fixtures';
import { egal, ok, titre } from './outils';

const consommer = (deck: RecoDeck, data = sourcesComposition()) => {
  const p = importerRecoOptimizer(deck, data);
  return { p, ...consommerImportOptimizer(stockageComposition(), null, p, data, 'nouvelle') };
};
function confrontation(deck: RecoDeck, data: ExclusionSourceData) {
  const args = { box: data.box, rta: Object.values(data.rtaEntries), defense: data.siegeDefenseTeams,
    offense: data.siegeOffenseTeams, monsterById: data.monsterById };
  return matchDeck(deck, { builds: indexBuildsByCom2us(collectOwnedBuilds(args)), teams: collectOwnedTeams({ ...args, defense: [] }) });
}
function runage(sets: string[]) {
  const deck = recommandationComposition(); deck.slots[0].setOptions = [sets, ['rage', 'blade']];
  const { p, stockage, rapport } = consommer(deck);
  egal(p.membres[0].criteres.comboSets, sets, 'premier runage, répétitions comprises');
  egal([...stockage.memories.values()][0].criteres.comboSets, sets, 'runage transmis jusqu’à la mémoire');
  egal(rapport.equipesCreees, 1, 'une équipe créée en Guilde');
  egal(stockage.listContents.get('nouvelle'), 'guilde', 'contenu sur la liste');
  ok(rapport.messages.some(m => m.includes('seul le premier')), 'réduction des possibilités dite');
  if (!sets.length) ok(rapport.messages.some(m => m.includes('aucun set sélectionné')), 'aucun set inventé, recherche à compléter');
}
export function testImportRecoRunageQuatrePlusDeux() { titre('Import recommandation · runage 4+2'); runage(['violent', 'will']); }
export function testImportRecoRunageDeuxPlusDeuxPlusDeux() { titre('Import recommandation · runage 2+2+2'); runage(['fight', 'fight', 'fight']); }
export function testImportRecoRunageQuatreSeul() { titre('Import recommandation · runage 4 seul'); runage(['swift']); }
export function testImportRecoRunageVide() { titre('Import recommandation · runage vide'); runage([]); }
export function testImportRecoMinimumsFiche() {
  titre('Import recommandation · huit minimums de fiche et base complète');
  const data = sourcesComposition(), deck = recommandationComposition();
  const gear = gearComposition(200), stats = computeStats(gear);
  deck.slots[0].stats = Object.fromEntries(stats.map(s => [s.key, s.total]));
  data.siegeOffenseTeams[0].slots[1].gear = gear;
  const { p, stockage, rapport } = consommer(deck, data), photo = [...stockage.memories.values()][0].criteres;
  ok(isDeepStrictEqual(photo.minStats, { hp: 10000, atk: 700, def: 600, spd: 301, cr: 15, cd: 50, res: 15 }), 'totaux de fiche sans soustraction de base ; zéro non exigé');
  egal(p.membres[0].criteres.vitesse, { minimum: 301 }, 'VIT portée par le critère extensible');
  deck.slots[1].stats = { acc: 80, hp: 0, atk: -1 };
  const q = importerRecoOptimizer(deck, data);
  egal(q.membres[1].criteres.minStats, { acc: 80 }, 'Précision importée, minimums non positifs non exigés');
  ok(rapport.messages.some(m => m.includes('auras')), 'écart RES/Précision signalé');
  const attendu = baseCompleteCriteres(gear); attendu.minStats = photo.minStats;
  egal(photo, attendu, 'aucun réglage dérivé du build, base complète complétée seulement par les minimums');
  egal(confrontation(deck, data).slots[0].checks.every(c => c.ok), true, 'mêmes nombres jugés par la confrontation');
}
export function testImportRecoLignesPropresEtCommunes() {
  titre('Import recommandation · lignes propres et communes, seuils pour toutes les propriétés reconnues');
  for (const code of Object.keys(ARTIFACT_SUB).map(Number)) {
    const deck = recommandationComposition(), sorte = artifactSubKinds(code)[0];
    deck.slots[0].artifacts[sorte] = [code];
    const { p, stockage, rapport } = consommer(deck);
    egal(p.membres[0].criteres.lignesVerrouillees, [{ code, min: code === 218 ? 0.1 : 1 }], `seuil d’import documenté pour ${code}, anciennes lignes comprises`);
    egal([...stockage.memories.values()][0].criteres.lignesVerrouillees, p.membres[0].criteres.lignesVerrouillees, `verrou ${code} accepté par le consommateur`);
    egal(rapport.membresImportes, 3, 'aucun membre perdu lors de la pose d’un verrou');
  }
  const deck = recommandationComposition(); deck.slots[0].artifacts = { element: [300, 218], archetype: [400, 206] };
  egal(importerRecoOptimizer(deck, sourcesComposition()).membres[0].criteres.lignesVerrouillees,
    [{ code: 300, min: 1 }, { code: 218, min: 0.1 }, { code: 400, min: 1 }, { code: 206, min: 1 }], 'lignes propres et communes importées ensemble');
}
export function testImportRecoPresenceSurPaire() {
  titre('Import recommandation · ligne sur deux pièces, une seule présence importée');
  const data = sourcesComposition(), deck = recommandationComposition();
  deck.slots[0].artifacts = { element: [206, 218], archetype: [206, 218] };
  const art: ArtifactDetail = { id: 1, kind: 'element', element: 'fire', archetype: 'attack', rarity: 5, level: 15,
    main: { code: 101, value: 100 }, subs: [{ code: 206, value: 1 }, { code: 218, value: 0.1 }] };
  data.siegeOffenseTeams[0].slots[1].gear!.artifacts = [art];
  const { p, stockage, rapport } = consommer(deck, data), verrous = [...stockage.memories.values()][0].criteres.lignesVerrouillees;
  egal(verrous, [{ code: 206, min: 1 }, { code: 218, min: 0.1 }], 'chaque propriété commune une fois, sans doublement');
  ok(paireRespecteLignes([art], verrous), 'build avec un seul artéfact accepté par les critères importés');
  ok(!paireRespecteLignes([], verrous), 'paire vide refusée, seuil de présence positif');
  const match = confrontation(deck, data);
  egal(match.status, 'ko', 'même build refusé par la recommandation');
  ok(match.slots[0].artifactChecks.some(c => c.kind === 'archetype' && !c.ok), 'propriété absente de la seconde pièce');
  egal(p.membres.length, 3, 'import conservé malgré le défaut de la confrontation');
  egal(rapport.messages.filter(m => m.includes('une présence sur la paire suffit')).length, 2, 'perte de la demande par pièce explicitement dite pour les deux codes');
}
export function testImportRecoValeursSansSource() {
  titre('Import recommandation · valeurs sans source non importées et signalées');
  const deck = recommandationComposition();
  deck.slots[0].stats = { spd: Infinity, hp: NaN, acc: 20, ...{ mystere: 123 } };
  deck.slots[0].setOptions = [['inconnu'], ['swift']];
  deck.slots[0].artifacts = { element: [999, 100, 400], archetype: [300, 218] };
  const { p, rapport } = consommer(deck), criteres = p.membres[0].criteres;
  egal(criteres.minStats, { acc: 20 }, 'minimums inconnus et non finis retirés');
  egal(criteres.vitesse, undefined, 'aucune VIT inventée');
  egal(criteres.comboSets, [], 'premier runage non représentable, second non substitué');
  egal(criteres.lignesVerrouillees, [{ code: 218, min: 0.1 }], 'code inconnu, principale et mauvaises sortes retirés');
  egal(rapport.messages.filter(m => m.includes('non import')).length, 8, 'chaque valeur sans conversion établie figure au rapport');
  for (const sets of [['intangible'], ['violent', 'swift']]) {
    deck.slots[0].setOptions = [sets];
    egal(importerRecoOptimizer(deck, sourcesComposition()).membres[0].criteres.comboSets, [], 'joker demandé ou coût excessif non inventé');
  }
}
function filtre(nombre: 0 | 1) {
  const data = sourcesComposition(), deck = recommandationComposition();
  data.monsterById = new Map([...data.monsterById].filter(([id]) => nombre === 1 && id === '1'));
  const { p, stockage, rapport } = consommer(deck, data);
  egal(rapport.membresImportes, nombre, 'seuls les monstres connus importés');
  egal(rapport.ignores.length, 3 - nombre, 'inconnus comptés avec raison');
  egal(rapport.equipesCreees, 0, 'aucune équipe après filtrage');
  egal(rapport.listeCreee !== null, nombre > 0, 'import vide sans liste');
  egal(rapport.equipesNonCreees[0].lead, p.equipes[0].lead, 'lead de la source conservé au rapport');
  ok(rapport.messages.some(m => m.includes('n’est appliqué à personne')), 'absence d’application du lead dite');
  if (nombre) egal([...stockage.memories.values()][0].criteres, baseCompleteCriteres(undefined), 'membre seul conserve sa base complète sans lead');
}
export function testImportRecoZeroMonstreConnu() { titre('Import recommandation · zéro monstre connu'); filtre(0); }
export function testImportRecoUnMonstreConnu() { titre('Import recommandation · un monstre connu sans équipe'); filtre(1); }
export function testImportRecoSlotVideEtLeadElement() {
  titre('Import recommandation · slot vide et lead du premier slot sur son élément');
  const data = sourcesComposition(), deck = recommandationComposition([1, 2, null]);
  const { p, stockage, rapport } = consommer(deck, data);
  egal(rapport.membresImportes, 2, 'slot vide sans membre'); egal(rapport.ignores.length, 0, 'slot vide non compté comme ignoré');
  egal(stockage.teams[0].leader, p.membres[0].selector, 'leader du premier slot de recommandation, pas du slot 0 du deck réel');
  egal(stockage.teams[0].lead, data.monsterById.get('1')!.leaderSkill, 'lead du jeu entier, pas SiegeTeam.lead');
  for (const m of p.membres) {
    const element = resolveExclusionEntry(m.selector, data)!.monster.element;
    const effectif = leadEffectifMembreOptimizer(stockage, 'nouvelle', m.selector, element);
    const photo = [...stockage.memories.values()].find(v => v.com2usId === m.com2usId)!.criteres;
    egal(photo.damageSetup, baseCompleteCriteres(undefined).damageSetup, 'lead absent de la mémoire personnelle');
    egal(appliquerCriteres(photo, effectif).damageSetup.leaderSkill, element === 'fire' ? { stat: 'Attack Speed', pct: 30 } : undefined, 'lead effectif seulement sur le feu');
  }
  const sansLeader = consommer(recommandationComposition([null, 2, 3]), data);
  egal(sansLeader.stockage.teams[0].leader, undefined, 'slot 0 vide sans leader de remplacement');
  egal(sansLeader.stockage.teams[0].lead, null, 'slot 0 vide sans lead inventé');
}
export function testImportRecoCompositionRetrouvee() {
  titre('Import recommandation · offense retenue identique à la confrontation');
  const data = sourcesComposition(), deck = recommandationComposition();
  deck.slots[0].stats = { spd: 250 };
  data.siegeOffenseTeams.push(deckComposition('o2'));
  data.siegeOffenseTeams[1].slots[1].gear = gearComposition(200);
  const match = confrontation(deck, data), retrouve = retrouverDeckCompositionOptimizer({ type: 'recommandation', deck }, data);
  egal(match.team, 'Offense 2', 'la meilleure offense est la seconde, pas la première ni une défense');
  egal(retrouve?.team.id, 'o2', 'fonction commune conserve le deck choisi par la confrontation');
  const p = importerRecoOptimizer(deck, data);
  egal(p.membres.map(m => exclusionSelectorKey(m.selector)), ['siege-offense:o2:1', 'siege-offense:o2:2', 'siege-offense:o2:0'], 'slots de l’offense retenue, attribués par espèce');
  p.membres.forEach((m, i) => ok(resolveExclusionEntry(m.selector, data)!.gear === match.slots[i].owned!.gear, 'exactement le build confronté, pas la copie Box'));
}
export function testImportRecoCompositionAmbigue() {
  titre('Import recommandation · première offense à égalité');
  const data = sourcesComposition(), deck = recommandationComposition(); data.siegeOffenseTeams.push(deckComposition('o2'));
  egal(retrouverDeckCompositionOptimizer({ type: 'recommandation', deck }, data)?.team.id, 'o1', 'fonction commune garde la première à égalité');
  egal(importerRecoOptimizer(deck, data).membres[0].selector, { source: 'siege-offense', teamId: 'o1', slotIndex: 1 }, 'appelant recommandation conserve la première offense');
}
export function testImportRecoCompositionModifiee() {
  titre('Import recommandation · composition modifiée, repli offense puis Box');
  const data = sourcesComposition(), deck = recommandationComposition([1, 2, 4]);
  egal(retrouverDeckCompositionOptimizer({ type: 'recommandation', deck }, data), null, 'aucune offense ne réunit la composition modifiée');
  egal(importerRecoOptimizer(deck, data).membres.map(m => exclusionSelectorKey(m.selector)), ['siege-offense:o1:1', 'siege-offense:o1:2', 'box:box-4'], 'offense par espèce sinon Box');
}
function repli(source: 'box' | 'rta' | 'siege-defense' | 'unowned') {
  const data = sourcesComposition(), deck = recommandationComposition(); data.siegeOffenseTeams = [];
  if (source !== 'box') data.box = data.box.filter(b => b.monster.com2usId !== 1001);
  if (source !== 'box' && source !== 'rta') data.rtaEntries = {};
  if (source === 'unowned') data.siegeDefenseTeams = [];
  egal(importerRecoOptimizer(deck, data).membres[0].selector.source, source, 'source réelle choisie seulement après les offenses');
  const { rapport } = consommer(deck, data); egal(rapport.membresImportes, 3, 'sélecteur accepté par le consommateur');
}
export function testImportRecoRepliBox() { titre('Import recommandation · espèce absente des offenses, en Box'); repli('box'); }
export function testImportRecoRepliRta() { titre('Import recommandation · espèce en RTA seule'); repli('rta'); }
export function testImportRecoRepliDefense() { titre('Import recommandation · espèce en défense seule'); repli('siege-defense'); }
export function testImportRecoAbsentePartout() { titre('Import recommandation · espèce absente partout'); repli('unowned'); }
export function testImportRecoPureteEtExemplaireInutilisable() {
  titre('Import recommandation · pureté et exemplaire réel inutilisable');
  const data = sourcesComposition(), deck = recommandationComposition(); deck.slots[0].setOptions = [['swift']];
  const avant = structuredClone({ data, deck }), p = importerRecoOptimizer(deck, data);
  ok(isDeepStrictEqual({ data, deck }, avant), 'aucune mutation des intrants');
  p.membres[0].criteres.comboSets!.push('will'); p.equipes[0].lead!.amount = 1;
  ok(isDeepStrictEqual({ data, deck }, avant), 'critères et lead détachés des intrants');
  data.siegeOffenseTeams = []; data.siegeDefenseTeams = []; data.rtaEntries = {}; delete data.box[0].gear;
  const q = importerRecoOptimizer(deck, data);
  ok(q.membres.every(m => m.com2usId !== 1001), 'espèce réelle sans équipement résolvable jamais convertie en unowned');
  egal(q.ignores.length, 1, 'raison explicite pour l’exemplaire inutilisable');
}

export const verificationsImportReco: [string, () => void][] = [
  testImportRecoRunageQuatrePlusDeux, testImportRecoRunageDeuxPlusDeuxPlusDeux, testImportRecoRunageQuatreSeul, testImportRecoRunageVide,
  testImportRecoMinimumsFiche, testImportRecoLignesPropresEtCommunes, testImportRecoPresenceSurPaire, testImportRecoValeursSansSource,
  testImportRecoZeroMonstreConnu, testImportRecoUnMonstreConnu, testImportRecoSlotVideEtLeadElement,
  testImportRecoCompositionRetrouvee, testImportRecoCompositionAmbigue, testImportRecoCompositionModifiee,
  testImportRecoRepliBox, testImportRecoRepliRta, testImportRecoRepliDefense, testImportRecoAbsentePartout,
  testImportRecoPureteEtExemplaireInutilisable,
].map(test => [test.name, test]);
