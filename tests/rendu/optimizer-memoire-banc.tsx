import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { useOptimizerState, type OptimizerState } from '../../src/hooks/useOptimizerState';
import { useOptimizerLists, type UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import { setPersistence } from '../../src/hooks/usePersistence';
import OptimizerSection from '../../src/components/outils/OptimizerSection';
import { baseCompleteCriteres, photoCriteres } from '../../src/lib/criteresOptimizer';
import { cleMemoireMembre, ecrireMembresOptimizer, OPTIMIZER_MEMBERS_STORAGE_KEY, type MemoireMembreOptimizer } from '../../src/lib/optimizerMemberStorage';
import type { Monster, RtaEntry, SiegeTeam, RuneDetail } from '../../src/types';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { ExclusionSelector, ExclusionSourceData } from '../../src/lib/optimizerExclusion';
import { buildOptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { preuvesSupplementaires, preparerClicInclusion, verifierClicInclusion } from './optimizer-memoire-preuves';
import { preuvesRattachementOptimizer, preuvesIdentiteEnregistree } from './optimizer-rattachement-preuves';
import { preuvesLeadEquipeOptimizer, preuvesDialogueEquipeOptimizer, preuvesContenuCreationOptimizer } from './optimizer-equipes-preuves';
import { preuvesRefusIdentitePerime } from './optimizer-refus-identite-preuves';
import { preuvesRecetteLeadEquipe, preuvesLeadAncienHorsEquipe, preuvesContenuSansDeplacement } from './optimizer-combat-preuves';

export const premier: ExclusionSelector = { source: 'box', unitKey: '11' };
export const second: ExclusionSelector = { source: 'box', unitKey: '22' };
export const troisieme: ExclusionSelector = { source: 'box', unitKey: '33' };
const rta: ExclusionSelector = { source: 'rta', monsterId: '1' };
const siege: ExclusionSelector = { source: 'siege-defense', teamId: 'defense', slotIndex: 0 };
const stats = { hp: 10000, attack: 800, defense: 700, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 };
const monstres: Monster[] = [
  { id: 1, com2usId: 10101, name: 'Premier', element: 'fire', archetype: 'attack', stars: 6, naturalStars: 5, secondAwaken: false, image: null, stats, leaderSkill: null },
  { id: 2, com2usId: 10102, name: 'Second', element: 'water', archetype: 'attack', stars: 6, naturalStars: 5, secondAwaken: false, image: null, stats, leaderSkill: null },
];
const base = { hp: 10000, atk: 800, def: 700, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };
const box: BoxItem[] = [
  { key: '11', monster: monstres[0], stars: 6, level: 40, gear: { base, runes: [], artifacts: [] } },
  { key: '22', monster: monstres[1], stars: 6, level: 40, gear: { base, runes: [], artifacts: [] } },
  { key: '33', monster: monstres[0], stars: 6, level: 40, gear: { base, runes: [], artifacts: [] } },
];
let etat: OptimizerState, listes: UseOptimizerLists, root: Root;
let afficher: (oui: boolean) => void, changerBox: (box: BoxItem[]) => void;
let changerRunes: (runes: RuneDetail[]) => void, compteActuel: ExclusionSourceData, runesActuelles: RuneDetail[];
const runesInclusion: RuneDetail[] = Array.from({ length: 6 }, (_, i) => ({
  id: 101 + i, slot: i + 1, set: 'energy', rank: 6, rarity: 5, level: 15,
  main: { code: i === 1 ? 8 : 1, value: i === 1 ? 42 : 100 }, subs: [],
}));
const rtaEntries: Record<string, RtaEntry> = { '1': { monsterId: '1', section: 'swift', runeSpeed: 0, gear: { base, runes: [], artifacts: [] } } };
const siegeDefenseTeams: SiegeTeam[] = [{ id: 'defense', lead: 0, tickAlertDismissed: false,
  slots: [{ monsterId: '1', runeSpeed: 0, tick: 0, gear: { base, runes: [], artifacts: [] } },
    { monsterId: null, runeSpeed: null, tick: 0 }, { monsterId: null, runeSpeed: null, tick: 0 }] }];
let avecRunes = false;

function Banc() {
  const [visible, setVisible] = useState(true);
  const [compte, setCompte] = useState(() => box.map(item => avecRunes && item.key === '22'
    ? { ...item, gear: { ...item.gear!, runes: runesInclusion } } : item));
  afficher = setVisible; changerBox = setCompte;
  const [inventaire, setInventaire] = useState(() => avecRunes ? runesInclusion : []);
  changerRunes = setInventaire; runesActuelles = inventaire;
  listes = useOptimizerLists();
  const data: ExclusionSourceData = { box: compte, rtaEntries, siegeDefenseTeams, siegeOffenseTeams: [], monsterById: new Map(monstres.map(m => [String(m.id), m])) };
  compteActuel = data;
  etat = useOptimizerState({ lists: listes, data, runeIds: new Set(inventaire.map(r => r.id)) });
  return visible ? <OptimizerSection box={compte} runes={inventaire} artifacts={[]} relics={[]} relicUsageById={{}}
    optimizer={etat} lists={listes} allMonsters={monstres} rtaEntries={rtaEntries} siegeDefenseTeams={siegeDefenseTeams} siegeOffenseTeams={[]}
    accountName="Synthétique" menuOuvert={false} onFermerMenu={() => {}} onOuvrirMenu={() => {}} /> : <div>Autre onglet</div>;
}

export async function geste(action: () => void) {
  flushSync(action);
  await new Promise(r => setTimeout(r, 0));
  flushSync(() => {});
}

export async function monter(avecRapport = false) {
  localStorage.clear();
  const criteres = baseCompleteCriteres(undefined);
  criteres.minStats = { spd: 230 }; criteres.comboSets = ['swift']; criteres.critereArtefacts = 'reel';
  criteres.damageSetup.enemyDef = 2222; criteres.lockedRunes = { 1: 999 };
  localStorage.setItem('swblacksmith-optimizer-lists-v1', JSON.stringify({
    lists: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bêta' }], activeListId: 'a', validated: [],
    members: ['a', 'b'].flatMap(listId => [premier, second, troisieme, rta, siege].map(selector => ({ listId, selector }))),
  }));
  localStorage.setItem(OPTIMIZER_MEMBERS_STORAGE_KEY, ecrireMembresOptimizer({
    identities: new Map(),
    memories: new Map<string, MemoireMembreOptimizer>([
      [cleMemoireMembre('a', premier), { listId: 'a', selector: premier, com2usId: 10101, criteres }],
      [cleMemoireMembre('b', premier), { listId: 'b', selector: premier, com2usId: 10101, criteres: { ...criteres, minStats: { spd: 190 } } }],
      ...[rta, siege].map((selector, i) => [cleMemoireMembre('a', selector), { listId: 'a', selector, com2usId: 10101,
        criteres: { ...criteres, minStats: { spd: 270 + i * 10 } } }] as const),
    ]), teams: [], listContents: new Map(), rejets: { memories: [], teams: [], listContents: [] },
  }));
  if (avecRapport) {
    const brut = JSON.parse(localStorage.getItem(OPTIMIZER_MEMBERS_STORAGE_KEY)!);
    brut.memories.push(['abimee', { listId: 'a' }]);
    localStorage.setItem(OPTIMIZER_MEMBERS_STORAGE_KEY, JSON.stringify(brut));
  }
  setPersistence(true);
  // Les données synthétiques rendent le chargement des sorts sans réseau.
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  root = createRoot(document.getElementById('racine')!);
  await geste(() => root.render(<Banc />));
}

export async function scenario(nom: string): Promise<[boolean, string][]> {
  avecRunes = nom.startsWith('rattachement');
  await monter(nom === 'zone-c');
  if (nom.startsWith('rattachement')) return preuvesRattachementOptimizer({ etat: () => etat, listes: () => listes,
    data: () => compteActuel, runes: () => runesActuelles, changerBox, changerRunes, afficher, geste, premier }, nom === 'rattachement-demonte');
  const preuves: [boolean, string][] = [];
  const verifier = (condition: boolean, texte: string) => preuves.push([condition, condition ? texte : `${texte} — ${JSON.stringify({ selectedId: etat.selectedId, selector: etat.sourceSelector, proprietaire: etat.proprietaireCriteres, min: etat.minStats, compter: etat.compterAurasResPre, cran: etat.critereArtefacts, rapport: etat.rapportCriteres, stockage: listes.rapportStockage })}`]);
  const choisir = (selector = premier) => geste(() => etat.choisirMembre('a', selector));
  const memoire = (listId: string, selector = premier) => listes.memories.get(cleMemoireMembre(listId, selector));
  await choisir();
  const bancEquipes = { etat: () => etat, listes: () => listes, geste, premier, second };
  if (nom === 'recette-lead-equipe') return preuvesRecetteLeadEquipe(bancEquipes);
  if (nom === 'lead-ancien-hors-equipe') return preuvesLeadAncienHorsEquipe(bancEquipes);
  if (nom === 'contenu-sans-deplacement') return preuvesContenuSansDeplacement(bancEquipes);
  if (nom === 'refus-identite-perime') return preuvesRefusIdentitePerime(bancEquipes);
  if (nom === 'lead-equipe') return preuvesLeadEquipeOptimizer(bancEquipes);
  if (nom === 'dialogue-equipe') return preuvesDialogueEquipeOptimizer(bancEquipes);
  if (nom === 'contenu-creation') return preuvesContenuCreationOptimizer(bancEquipes);
  if (nom === 'identite-enregistree') return preuvesIdentiteEnregistree({ etat: () => etat, listes: () => listes,
    data: () => compteActuel, changerBox, geste, premier });
  const supplement = await preuvesSupplementaires(nom, { etat: () => etat, listes: () => listes, geste, premier, second, rta, siege });
  if (supplement) return supplement;
  if (nom === 'selection') {
    verifier(etat.proprietaireCriteres?.listId === 'a' && etat.minStats.spd === 230, 'clic : propriétaire et mémoire appliquée');
    verifier(!Object.keys(etat.lockedRunes).length && etat.rapportCriteres.some(m => m.includes('1 rune')), 'rune imposée absente retirée et dite');
    verifier(memoire('a')?.criteres.lockedRunes[1] === 999, 'restauration : mémoire originale inchangée');
    await geste(() => etat.setMinStats({ spd: 240 }));
    verifier(memoire('a')?.criteres.minStats.spd === 240 && memoire('b')?.criteres.minStats.spd === 190, 'saisie vers la bonne liste seulement');
    await choisir(second); await geste(() => etat.setMinStats({ spd: 170 })); await choisir();
    verifier(etat.minStats.spd === 240, 'retour au membre : critères retrouvés');
  } else if (nom === 'sans-memoire') {
    for (const selector of [second, troisieme]) {
      await choisir(); await choisir(selector);
      verifier(JSON.stringify(photoCriteres(etat, { type: 'personnel' })) === JSON.stringify(baseCompleteCriteres(undefined)), 'sans mémoire : base complète, autre espèce ou même espèce');
      verifier(!memoire('a', selector), 'aucune capture à la sélection');
      await geste(() => etat.setRelicMinUpgrade(12));
      verifier(etat.relicMinUpgrade === 12 && !memoire('a', selector), 'réglage global : aucune mémoire créée');
      await geste(() => etat.setCompterAurasResPre(false));
      verifier(memoire('a', selector)?.criteres.compterAurasResPre === false, 'première saisie : mémoire créée');
    }
  } else if (nom === 'listes') {
    await geste(() => listes.setActiveListId('b'));
    verifier(etat.minStats.spd === 190 && etat.proprietaireCriteres?.listId === 'b', 'changement de liste : mémoire de la destination');
    await geste(() => listes.setActiveListId('a'));
    verifier(etat.minStats.spd === 230, 'retour à la première liste');
    await choisir(second); await geste(() => listes.setActiveListId('b'));
    verifier(etat.proprietaireCriteres === null, 'destination sans mémoire : aucun propriétaire');
    await geste(() => etat.setMinStats({ spd: 155 }));
    verifier(!memoire('b', second), 'sans propriétaire : aucune mémoire créée');
  } else if (nom === 'retrait') {
    await geste(() => listes.removeMember('a', premier));
    verifier(etat.proprietaireCriteres === null, 'retrait du membre affiché : aucun propriétaire');
    await geste(() => etat.setMinStats({ spd: 155 }));
    verifier(!memoire('a'), 'retrait puis modification : mémoire non recréée');
    await choisir(second);
    await geste(() => { listes.removeMember('a', second); etat.setMinStats({ spd: 180 }); });
    verifier(!memoire('a', second), 'retrait et modification groupés : garde du stockage avant écriture');
    await geste(() => listes.addMember('a', second, monstres[1].com2usId!));
    await choisir(second); await geste(() => listes.deleteList('a'));
    verifier(etat.proprietaireCriteres === null, 'suppression de sa liste : aucun propriétaire');
  } else if (nom === 'inclusion') {
    await geste(() => { etat.setSourceSelector(second); etat.setSelectedId('2'); etat.setMinStats({ spd: 160 }); listes.removeMember('a', second); });
    await geste(() => { listes.addMember('a', second, monstres[1].com2usId!); etat.capturerMembre('a', second); });
    verifier(memoire('a', second)?.criteres.minStats.spd === 160 && etat.proprietaireCriteres?.com2usId === 10102, 'ajout : capture et propriétaire');
    await geste(() => { etat.setSourceSelector(troisieme); etat.setSelectedId('1'); listes.removeMember('a', troisieme); });
    await geste(() => { listes.validateBuild('a', troisieme, [1, 2, 3, 4, 5, 6], [], monstres[0].com2usId!); etat.capturerMembre('a', troisieme); });
    verifier(!!memoire('a', troisieme), 'validation avec inclusion : capture');
    await geste(() => { const id = listes.createList('Nouvelle'); listes.addMember(id, troisieme, monstres[0].com2usId!); etat.capturerMembre(id, troisieme); });
    verifier(etat.proprietaireCriteres?.listId === listes.activeListId && !!memoire(listes.activeListId!, troisieme), 'création et ajout : capture au même geste');
  } else if (nom === 'hors-liste') {
    for (const action of [() => etat.setSelectedId('1'), () => etat.setGearSource('box'), () => etat.setSourceSelector(premier)]) {
      await choisir(); await geste(action); await geste(() => etat.setMinStats({ spd: 140 }));
      verifier(etat.proprietaireCriteres === null && memoire('a')?.criteres.minStats.spd === 230, 'bestiaire, source ou zone D : propriétaire effacé');
    }
    await geste(() => root.unmount());
    root = createRoot(document.getElementById('racine')!); await geste(() => root.render(<Banc />));
    verifier(etat.proprietaireCriteres === null, 'rechargement : aucun propriétaire repris');
    await choisir(); verifier(etat.minStats.spd === 230, 'rechargement : mémoire disponible au clic');
  } else if (nom === 'identite') {
    await geste(() => changerBox(box.map(item => item.key === '11' ? { ...item, monster: monstres[1] } : item)));
    verifier(etat.proprietaireCriteres === null, 'changement d’espèce : propriétaire effacé');
    await choisir();
    verifier(etat.rapportCriteres.some(m => m.includes('sans application')) && etat.minStats.spd === undefined, 'mémoire d’une autre espèce : non appliquée et dite');
    verifier(memoire('a')?.com2usId === 10101, 'identité différente : mémoire conservée');
    await geste(() => etat.setMinStats({ spd: 155 }));
    verifier(memoire('a')?.criteres.minStats.spd === 230 && listes.rapportStockage.some(m => m.includes('ne correspond pas')), 'écriture d’une autre espèce refusée et dite');
    await geste(() => etat.resetSearch('compte'));
    verifier(etat.proprietaireCriteres === null && etat.importDuCompte === 1, 'compte : attribution effacée avant reset');
    await choisir(second); await geste(() => changerBox(box.filter(item => item.key !== '22')));
    verifier(etat.proprietaireCriteres === null, 'exemplaire introuvable : attribution effacée');
  } else if (nom === 'navigation') {
    await geste(() => etat.setCritereArtefacts('reel')); await geste(() => etat.setMinStats({ spd: 250 }));
    await geste(() => afficher(false));
    verifier(!document.querySelector('input[type="file"]'), 'aller : écran réellement démonté');
    await geste(() => afficher(true));
    verifier(etat.critereArtefacts === 'reel' && etat.minStats.spd === 250, 'retour : cran et critères survivent au remontage');
    await geste(() => afficher(false)); await choisir(second);
    verifier(etat.proprietaireCriteres?.com2usId === 10102 && !Object.keys(etat.minStats).length, 'action choisir un membre utilisable sans écran');
    await choisir(); await geste(() => etat.setRelicMainChoice(101));
    await geste(() => etat.resetSearch('compte')); await choisir();
    await geste(() => afficher(true));
    verifier(etat.relicMainChoice === 101 && memoire('a')?.criteres.relicMainChoice === 101, 'compte réimporté puis membre choisi écran absent : sa relique restaurée survit au montage');
  } else if (nom === 'recette') {
    const recette = buildOptimizerRecipe({ monsterCom2usId: 10101, monsterName: 'Premier',
      damageSetup: baseCompleteCriteres(undefined).damageSetup,
      requirement: { sets: ['swift'], minStats: { spd: 310 } }, objective: 'vitesse', metric: 'eff',
      slotFilterPreset: 'moyen', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
      excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
    let resoudre!: (texte: string) => void;
    const textOriginal = File.prototype.text;
    File.prototype.text = () => new Promise<string>(r => { resoudre = r; });
    try {
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      const fichiers = new DataTransfer(); fichiers.items.add(new File([''], 'recette.json', { type: 'application/json' }));
      await geste(() => { input.files = fichiers.files; input.dispatchEvent(new Event('change', { bubbles: true })); });
      await choisir(second); await geste(() => etat.setMinStats({ spd: 185 }));
      await geste(() => resoudre(JSON.stringify(recette)));
      verifier(etat.proprietaireCriteres === null && etat.minStats.spd === 310, 'recette retardée : effacement et application à la résolution');
      verifier(memoire('a')?.criteres.minStats.spd === 230 && memoire('a', second)?.criteres.minStats.spd === 185, 'recette : aucune mémoire écrasée entre deux choix de membre');
    } finally { File.prototype.text = textOriginal; }
  } else if (nom === 'auras-destination') {
    await choisir(troisieme);
    await geste(() => etat.setDamageSetup({ ...etat.damageSetup, setsAuraExternes: [{ set: 'accuracy', nombre: 1 }] }));
    await choisir();
    const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
    const pli = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && e.textContent?.includes('Monstres à optimiser'));
    if (pli) await geste(() => pli.click());
    const zone = [...document.querySelectorAll<HTMLElement>('[aria-label="Rapport des critères"]')].find(visible)!.parentElement!;
    const cliquer = (index: number) => geste(() => zone.querySelectorAll<HTMLElement>('[role="button"]')[index].click());
    const rappel = () => [...document.querySelectorAll('p')].some(e => visible(e) && e.textContent?.includes('Pense à vérifier les sets'));
    const memoireAvant = JSON.stringify(memoire('a', troisieme));
    await cliquer(2);
    verifier(rappel() && etat.damageSetup.setsAuraExternes?.[0]?.set === 'accuracy',
      'clic autre exemplaire : rappel des auras de la destination, même si le membre précédent n’en avait aucune');
    verifier(JSON.stringify(memoire('a', troisieme)) === memoireAvant && !etat.showAdvanced && !document.querySelector('[role="dialog"]'),
      'rappel : mémoire intacte, aucune ouverture guidée ni fenêtre du combat');
    await cliquer(1);
    verifier(!rappel() && !etat.damageSetup.setsAuraExternes?.length, 'destination sans auras : aucun rappel, précédent rappel effacé');
    await choisir(troisieme);
    verifier(!rappel(), 'restauration autonome avec auras : aucun rappel');
    await geste(() => listes.setActiveListId('b')); await geste(() => listes.setActiveListId('a'));
    verifier(!rappel(), 'restauration par changement de liste : aucun rappel');
    await cliquer(2);
    verifier(!rappel(), 'recliquer le même exemplaire : aucun rappel');
    await cliquer(0); await cliquer(2);
    verifier(rappel(), 'nouveau clic vers la destination avec auras : rappel');
    await new Promise(r => setTimeout(r, 3100));
    verifier(!rappel(), 'rappel effacé après sa minuterie de trois secondes');
  } else if (nom === 'automatismes') {
    const origine = JSON.stringify(memoire('a'));
    await geste(() => etat.poserCriteresAutomatiques({ relicMainChoice: 101, minStats: { spd: 210 }, lockedRunes: {} }));
    verifier(etat.relicMainChoice === 101 && etat.minStats.spd === 210 && JSON.stringify(memoire('a')) === origine,
      'pose automatique avec propriétaire : affichage changé, mémoire intacte');
    await geste(() => etat.poserTriRecherche('spd'));
    verifier(etat.sortBy === 'spd' && JSON.stringify(memoire('a')) === origine, 'tri dérivé : aucune capture');
    await geste(() => afficher(false)); await geste(() => etat.resetSearch('compte')); await geste(() => afficher(true));
    verifier(etat.relicMainChoice === 'libre' && etat.importReliqueTraite.current === etat.importDuCompte
      && JSON.stringify(memoire('a')) === origine, 'compte sans restauration : défaut traité sans écriture de mémoire');
    await choisir(second); await geste(() => etat.poserCriteresAutomatiques({ relicMainChoice: 101 }));
    verifier(!memoire('a', second), 'pose automatique sur membre sans mémoire : aucune création');
    await geste(() => etat.setMinStats({ spd: 205 }));
    verifier(memoire('a', second)?.criteres.relicMainChoice === 101, 'saisie suivante : photo du véritable affichage');
  } else if (nom === 'saisies') {
    const valeurs = {
      comboSets: ['violent'], minStats: { spd: 245 }, maxStats: { res: 80 }, excludeBase: false,
      optimiserArtefacts: false, adapterArtefactsAuTri: false, artifactMainByKind: { element: 100 },
      relicMainChoice: 101, relicUniqueChoice: 1, lignesVerrouillees: [{ code: 206, min: 5 }],
      mainStatsBySlot: { 2: [8] }, lockedRunes: { 1: 888 }, objective: 'vitesse',
      damageSetup: { ...baseCompleteCriteres(undefined).damageSetup, enemyDef: 1234 }, sortBy: 'hp',
      compterAurasResPre: false, critereArtefacts: 'brut',
    };
    for (const [champ, valeur] of Object.entries(valeurs)) {
      const setter = `set${champ[0].toUpperCase()}${champ.slice(1)}`;
      await geste(() => (etat as unknown as Record<string, (v: unknown) => void>)[setter](valeur));
      verifier(JSON.stringify((etat as unknown as Record<string, unknown>)[champ]) === JSON.stringify(valeur), `${champ} : valeur demandée affichée`);
      verifier(JSON.stringify((memoire('a')?.criteres as unknown as Record<string, unknown>)[champ]) === JSON.stringify(valeur), `${champ} : valeur demandée mémorisée`);
      verifier(JSON.stringify(memoire('a')?.criteres) === JSON.stringify(photoCriteres(etat, { type: 'personnel' })), `${champ} : photo complète écrite par le vrai setter`);
    }
  } else if (nom === 'zone-c') {
    const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
    const pli = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && e.textContent?.includes('Monstres à optimiser'));
    if (pli) await geste(() => pli.click());
    const zone = [...document.querySelectorAll<HTMLElement>('[aria-label="Rapport des critères"]')].find(visible)!;
    verifier(zone.textContent!.includes('malformée'), 'rapport du stockage chargé affiché dans la zone C');
    const groupe = zone.parentElement!;
    const cadre = groupe.getBoundingClientRect();
    verifier(cadre.left >= 0 && cadre.right <= window.innerWidth, 'zone C contenue dans la largeur de l’écran');
    const marque = groupe.querySelector('[aria-label="Critères mémorisés"]');
    verifier(!!marque && visible(marque), 'marque des membres à mémoire visible');
    const ligne = [...groupe.querySelectorAll<HTMLElement>('[role="button"]')].find(e => e.textContent?.includes('Second'))!;
    verifier(!ligne.querySelector('[aria-label="Critères mémorisés"]'), 'membre sans mémoire : marque absente');
    const avant = ligne.getBoundingClientRect();
    await geste(() => ligne.click());
    const apres = ligne.getBoundingClientRect();
    verifier(avant.x === apres.x && avant.y === apres.y && avant.height === apres.height, 'clic de membre : la cible reste en place');
    await geste(() => etat.setMinStats({ spd: 175 }));
    const marqueNouvelle = ligne.querySelector('[aria-label="Critères mémorisés"]');
    const fin = ligne.getBoundingClientRect();
    verifier(!!marqueNouvelle && fin.x === avant.x && fin.y === avant.y && fin.width === avant.width, 'première saisie : marque présente sans déplacer la ligne');
    verifier(getComputedStyle(groupe).borderTopWidth === '1px' && getComputedStyle(ligne.parentElement!).borderTopWidth === '1px', 'contours de la zone et des lignes : 1 px');
  }
  return preuves;
}

const contextePreuves = () => ({ etat: () => etat, listes: () => listes, geste, premier, second, rta, siege });
export async function preparerInclusion(genre: string) {
  avecRunes = true;
  await monter();
  return preparerClicInclusion(genre, contextePreuves());
}
export async function verifierInclusion() {
  // Le clic Playwright précède parfois les effets passifs qui publient la
  // mémoire ; le même point de stabilisation sert aux autres gestes du banc.
  await geste(() => {});
  return verifierClicInclusion(contextePreuves());
}
