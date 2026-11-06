// Tests de rendu — « Mes équipes » (docs/02-app/compte/feat-equipes.md), aux
// deux formats. Principe dans tests/rendu/outils-rendu.tsx : ce que la page
// dit et permet, jamais son apparence.

import type { Monster } from '../../src/types';
import EquipesSection, { ConfirmationCreation } from '../../src/components/account/equipes/EquipesSection';
import DetailEquipe from '../../src/components/account/equipes/DetailEquipe';
import ImportEquipeModale from '../../src/components/account/equipes/ImportEquipeModale';
import type { EquipesEnregistreesApi } from '../../src/hooks/useEquipesEnregistrees';
import { creerEquipe, indexerInventaire, type EquipeEnregistree } from '../../src/lib/equipesEnregistrees';
import { sourcesImportEquipes, type ContexteSourcesEquipes } from '../../src/lib/sourcesEquipesEnregistrees';
import { fr } from '../../src/i18n/fr';
import { egal, ok, titre } from '../outils';
import { auTelephone, bouton, onglets, rendre, texteVisible, valeurs } from './outils-rendu';
import { equipementEx, monstreEx, runeEx } from '../equipes-enregistrees.test';

const T0 = new Date('2026-11-05T10:00:00Z');
function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 1, attack: 1, defense: 1, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null };
}
const MONSTRES = [1, 2, 3].map(monstre);
const ctx = (compte = true): ContexteSourcesEquipes => ({
  box: compte ? [{ key: '11', monster: MONSTRES[0], stars: 6, level: 40, gear: equipementEx(1) }] : [],
  siegeDefenseTeams: [], siegeOffenseTeams: [], arenaDecks: compte ? [] : null, compte,
  monsterById: new Map(MONSTRES.map((m) => [String(m.id), m])),
  monsterByCom2us: new Map(MONSTRES.map((m) => [m.com2usId as number, m])),
});
// La rune 3 a changé depuis l'enregistrement.
const eq1 = equipementEx(1);
const INVENTAIRE = indexerInventaire(eq1.runes.map((r) => (r.id === 3 ? runeEx(3, 3, 99) : r)), eq1.artifacts, [eq1.relic!]);
const EQUIPES: EquipeEnregistree[] = [
  { ...creerEquipe('e1', 'rta', 'Ma RTA', T0), note: 'contre Lushen', monstres: [monstreEx('a', 1001, 11), monstreEx('b', 1002, null, null)], leader: 'a' },
  { ...creerEquipe('e2', 'rta', 'Autre RTA', T0), monstres: [monstreEx('d', 1002, null, null), monstreEx('e', 1003, null, null)] },
  { ...creerEquipe('e3', 'pve', 'Donjon', T0), monstres: [monstreEx('c', 1003, null, null), monstreEx('f', 1001, null, null)] },
];
const api = (equipes = EQUIPES, relecture: 'en-cours' | 'finie' = 'finie'): EquipesEnregistreesApi => ({
  equipes, relecture, illisibles: 0, signalements: [], clesReservees: new Set(), signaler: () => {}, appliquer: () => {}, remplacerTout: () => {},
});
const section = (o: { api?: EquipesEnregistreesApi; compte?: boolean; menuOuvert?: boolean } = {}) => (
  <EquipesSection api={o.api ?? api()} ctx={ctx(o.compte ?? true)} inventaire={o.compte === false ? null : INVENTAIRE}
    allMonsters={MONSTRES} optimizer={null} onImporterOptimizer={() => ({ listeCreee: null, membresImportes: 0, equipesCreees: 0, ignores: [], equipesNonCreees: [], messages: [] })}
    onEquipeCreee={() => {}} menuOuvert={o.menuOuvert ?? false} onFermerMenu={() => {}} />
);
const e = fr.equipes;

export function testRenduEquipesBureau() {
  titre('rendu · Mes équipes — ordinateur');
  const html = rendre(section());
  const t = texteVisible(html);
  egal(onglets(html).map((o) => [o.texte, o.ouvert]), [
    ['RTA 2', true], ['Arène — attaque 0', false], ['Arène — défense 0', false], ['Siège — attaque 0', false],
    ['Siège — défense 0', false], ['Guerre de guilde 0', false], ['PVE 1', false],
  ], 'sept onglets, chacun avec son total, RTA ouvert');
  ok(t.includes('Ma RTA') && t.includes('Autre RTA') && !t.includes('Donjon'), 'les cartes de l’onglet ouvert seulement');
  ok(t.includes('contre Lushen'), 'la note sur la carte');
  ok(t.includes(e.carte.modifiees(1)), 'l’écart au compte : une pièce modifiée');
  for (const b of [e.nouvelle, e.importer, e.exporterFichier, e.importerFichier]) ok(bouton(html, b)?.desactive === false, `« ${b} » utilisable`);
  ok(valeurs(html, 'placeholder').includes(e.recherche), 'la recherche par monstre');
  ok(!texteVisible(rendre(section({ compte: false }))).includes(e.carte.modifiees(1)), 'sans compte, aucun écart affiché');
  const vide = rendre(section({ api: api([], 'en-cours') }));
  ok(texteVisible(vide).includes(e.chargement), 'pendant la relecture, « Lecture des équipes enregistrées… »');
  egal(bouton(vide, e.importerFichier)?.desactive, true, 'et « Importer un fichier » attend la relecture');
  egal(bouton(vide, e.exporterFichier)?.desactive, true, 'rien à exporter sans équipe');
  ok(texteVisible(rendre(section({ api: api([EQUIPES[2]]) }))).includes(e.aucune), 'un onglet vide le dit');
}

export function testRenduEquipesTelephone() {
  titre('rendu · Mes équipes — téléphone');
  const ferme = auTelephone(() => rendre(section()));
  ok(bouton(ferme, e.nouvelle) !== undefined, '« Nouvelle équipe » sous la recherche');
  ok(bouton(ferme, e.importerFichier) === undefined, 'les fichiers et imports attendent le panneau Options');
  const ouvert = auTelephone(() => rendre(section({ menuOuvert: true })));
  ok(texteVisible(ouvert).includes(e.options), 'le panneau Options');
  for (const b of [e.importer, e.exporterFichier, e.importerFichier]) ok(bouton(ouvert, b) !== undefined, `« ${b} » dans le panneau`);
}

export function testRenduEquipesDetail() {
  titre('rendu · Mes équipes — détail d’une équipe');
  const html = rendre(<DetailEquipe equipe={EQUIPES[0]} onChanger={() => {}} monstreDe={(c) => MONSTRES.find((m) => m.com2usId === c)}
    box={ctx().box} inventaire={INVENTAIRE} onAjouter={() => {}} />);
  const t = texteVisible(html);
  ok(valeurs(html, 'value').includes('Ma RTA') && valeurs(html, 'value').includes('contre Lushen'), 'nom et note éditables');
  ok(t.includes(`${e.detail.provenance.porte} · ${e.detail.exemplaire['equipe-ainsi']}`), 'la provenance et ce que porte l’exemplaire');
  ok(t.includes(`${e.detail.rune(3)} : ${e.detail.etats.modifiee}`), 'la pièce modifiée nommée');
  egal(bouton(html, e.detail.minimum)?.desactive, true, 'à deux monstres, le retrait est refusé et l’infobulle dit pourquoi');
  ok(!texteVisible(html).includes(e.detail.brouillon), 'une équipe enregistrée n’est pas un brouillon');
  ok(bouton(html, e.detail.reprendre) !== undefined, 'reprendre l’équipement actuel, l’exemplaire étant connu');
  egal(bouton(html, e.detail.ajouter)?.desactive, false, 'ajouter un monstre');
  const plein = { ...EQUIPES[0], monstres: [1, 2, 3, 4, 5, 6].map((k) => monstreEx(`m${k}`, 1002, null, null)) };
  const h2 = rendre(<DetailEquipe equipe={plein} onChanger={() => {}} monstreDe={() => undefined} box={[]} inventaire={null} onAjouter={() => {}} />);
  egal([bouton(h2, e.detail.ajouter)?.desactive, bouton(h2, e.detail.ajouter)?.title], [true, e.detail.complet], 'à 6 monstres, l’ajout est désactivé avec sa raison');
  ok(texteVisible(h2).includes(e.detail.sansCompte), 'sans compte, la comparaison est annoncée absente');
  egal(bouton(h2, e.detail.retirer('1002'))?.desactive, false, 'au-delà de deux monstres, le retrait est permis');
  const seul = { ...EQUIPES[0], monstres: [monstreEx('s', 1002, null, null)] };
  const h3 = rendre(<DetailEquipe equipe={seul} brouillon onChanger={() => {}} monstreDe={() => undefined} box={[]} inventaire={null} onAjouter={() => {}} />);
  ok(texteVisible(h3).includes(e.detail.brouillon), 'le brouillon de « Nouvelle équipe » dit quand il s’enregistre');
  egal(bouton(h3, e.detail.retirer('1002'))?.desactive, false, 'un brouillon se vide librement');
}

export function testRenduEquipesImports() {
  titre('rendu · Mes équipes — sources d’import');
  const sources = sourcesImportEquipes({ ...ctx(), arenaDecks: null }, null, INVENTAIRE, 'rta', fr);
  const html = auTelephone(() => rendre(<ImportEquipeModale sources={sources} onChoisir={() => {}} onFermer={() => {}} />));
  const t = texteVisible(html);
  ok(t.includes(e.imports.titre), 'le titre de la modale');
  egal(bouton(html, e.imports.arene)?.desactive, true, 'une source sans contenu est désactivée');
  ok(t.includes(e.imports.reimporter), 'avec sa raison');
}

export function testRenduEquipesCreationOptimizer() {
  titre('rendu · Mes équipes — enregistrer une équipe de l’Optimizer');
  const creation = { equipe: { ...EQUIPES[0], nom: 'Liste — équipe 1', lienOptimizer: { listId: 'l', equipeId: 'q', correspondance: [] } },
    monstresChanges: 2, piecesChangees: 9, manquantes: [{ libelle: 'Monstre 1', type: 'rune' as const, id: 999 }],
    reliquesGardees: [], artefactsGardes: [], copiesAmbigues: [], retires: [] };
  // Une modale ne se rend qu'avec une fenêtre (auTelephone en fournit une), comme la modale des sources.
  {
    const html = auTelephone(() => rendre(<ConfirmationCreation creation={creation} onChanger={() => {}} onAnnuler={() => {}} onConfirmer={() => {}} />));
    const t = texteVisible(html);
    ok(t.includes(e.creation.message('Liste — équipe 1')), 'ce que crée l’enregistrement, et qu’il restera lié');
    ok(t.includes(e.creation.onglet) && t.includes(e.onglets.rta), 'l’onglet se choisit, l’onglet ouvert par défaut');
    ok(t.includes(e.retour.manquante('Monstre 1', e.retour.pieces.rune, 999)), 'une pièce introuvable est nommée');
    ok(!t.includes(e.retour.resume(2, 9)), 'pas de résumé de changements : tout est nouveau');
    ok(bouton(html, e.creation.action)?.desactive === false, '« Enregistrer » utilisable');
  }
}

export const verificationsRenduEquipes: [string, () => void][] = [
  ['testRenduEquipesCreationOptimizer', testRenduEquipesCreationOptimizer],
  ['testRenduEquipesBureau', testRenduEquipesBureau],
  ['testRenduEquipesTelephone', testRenduEquipesTelephone],
  ['testRenduEquipesDetail', testRenduEquipesDetail],
  ['testRenduEquipesImports', testRenduEquipesImports],
];
