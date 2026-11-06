// Les SOURCES de « Mes équipes » : l'équipement qu'un monstre ajouté peut
// copier, et les équipes qu'un import peut créer.
//
// Spec : docs/02-app/compte/feat-equipes.md, « Créer et modifier » et
// « Imports ». Tout se lit dans les données de l'app (Box, prépa RTA, équipes
// de siège, decks d'arène, listes de l'Optimizer) ; rien n'est écrit ici, le
// geste rend une équipe neuve que l'écran ajoute.

import type { GearSet, Monster, SiegeTeam } from '../types';
import type { BoxItem } from './applyAccount';
import type { Dictionnaire } from '../i18n/fr';
import type { DeckArene } from './importAccount';
import { resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import type { StockageOptimizer } from './optimizerMemberStorage';
import { creerDepuisEquipeOptimizer, disponibiliteRetourOptimizer } from './importEquipesEnregistrees';
import {
  MONSTRES_MAX_EQUIPE, MONSTRES_MIN_EQUIPE, creerEquipe,
  type EquipeEnregistree, type InventaireCompte, type MonstreEnregistre, type OngletEquipes,
  type ProvenanceEquipement, type TirerId,
} from './equipesEnregistrees';

export interface ContexteSourcesEquipes {
  box: readonly BoxItem[];
  siegeDefenseTeams: readonly SiegeTeam[];
  siegeOffenseTeams: readonly SiegeTeam[];
  // `null` : compte conservé avant la lecture des decks d'arène.
  arenaDecks: readonly DeckArene[] | null;
  // Un compte est-il chargé (Box ou inventaire non vides) ?
  compte: boolean;
  monsterById: ReadonlyMap<string, Monster>;
  monsterByCom2us: ReadonlyMap<number, Monster>;
}

/* --------------------------------------------------------------------------
 * L'équipement d'un monstre ajouté
 * ----------------------------------------------------------------------- */

export interface SourceEquipement {
  cle: string;
  libelle: string;
  provenance: ProvenanceEquipement;
  unitId: number | null;
  equipement: GearSet | null;
}

// Les choix d'équipement d'une espèce, dans l'ordre de la spec : chaque
// exemplaire de la Box, les decks de siège, les decks d'arène,
// puis « Sans équipement », toujours présent.
export function sourcesEquipementEspece(com2usId: number, ctx: ContexteSourcesEquipes, t: Dictionnaire): SourceEquipement[] {
  const a = t.equipes.ajout;
  const res: SourceEquipement[] = [];
  for (const b of ctx.box) {
    if (b.monster.com2usId !== com2usId) continue;
    const unitId = /^\d+$/.test(b.key) ? Number(b.key) : null;
    res.push({ cle: `box:${b.key}`, libelle: a.porte(b.level), provenance: b.gear ? 'porte' : 'aucun', unitId, equipement: b.gear ?? null });
  }
  const siege = (teams: readonly SiegeTeam[], provenance: ProvenanceEquipement, libelle: (n: number) => string) =>
    teams.forEach((team, i) => team.slots.forEach((slot, s) => {
      if (slot.monsterId !== null && slot.gear && ctx.monsterById.get(slot.monsterId)?.com2usId === com2usId)
        res.push({ cle: `${provenance}:${team.id}:${s}`, libelle: libelle(i + 1), provenance, unitId: null, equipement: slot.gear });
    }));
  siege(ctx.siegeDefenseTeams, 'siege-defense', a.defense);
  siege(ctx.siegeOffenseTeams, 'siege-attaque', a.attaque);
  for (const deck of ctx.arenaDecks ?? []) deck.slots.forEach((slot, s) => {
    if (slot.com2usId !== com2usId) return;
    const provenance: ProvenanceEquipement = deck.cle === 'attaque' ? 'arene-attaque' : 'arene-defense';
    res.push({ cle: `arene:${deck.cle}:${deck.rang}:${s}`, libelle: libelleDeckArene(deck, a), provenance, unitId: slot.unitId, equipement: slot.gear });
  });
  res.push({ cle: 'aucun', libelle: a.sansEquipement, provenance: 'aucun', unitId: null, equipement: null });
  return res;
}

function libelleDeckArene(deck: DeckArene, a: { areneDefense: string; areneDefenseServeur: string; areneAttaque: (n: number) => string }): string {
  return deck.cle === 'defense' ? a.areneDefense : deck.cle === 'defense-serveur' ? a.areneDefenseServeur : a.areneAttaque(deck.rang + 1);
}

/* --------------------------------------------------------------------------
 * Les imports d'équipes
 * ----------------------------------------------------------------------- */

export interface ImportEquipeCree {
  equipe: EquipeEnregistree;
  // Monstres d'espèce inconnue, laissés de côté.
  ignores: number;
}

export interface SourceImportEquipe {
  cle: string;
  groupe: string;
  libelle: string;
  monstres: Monster[];
  // La raison quand la source n'a rien à importer ; `null` : utilisable.
  raison: string | null;
  creer: (id: string, tirerUid: TirerId, maintenant: Date) => ImportEquipeCree | null;
}

// `leader` : le membre vient du slot 0 de sa source (siège) ou de la tête du deck (arène).
interface MembreBrut { com2usId: number | null; unitId: number | null; equipement: GearSet | null; leader: boolean }

function equipeDepuisMembres(
  membres: MembreBrut[], onglet: OngletEquipes, nom: string, provenance: ProvenanceEquipement,
  ctx: ContexteSourcesEquipes, id: string, tirerUid: TirerId, maintenant: Date
): ImportEquipeCree {
  let ignores = 0;
  const monstres: MonstreEnregistre[] = [];
  let leader: string | null = null;
  for (const m of membres.slice(0, MONSTRES_MAX_EQUIPE)) {
    if (m.com2usId === null || !ctx.monsterByCom2us.has(m.com2usId)) { ignores++; continue; }
    const uid = tirerUid();
    if (m.leader) leader = uid;
    monstres.push({ uid, com2usId: m.com2usId, unitId: m.unitId, provenance: m.equipement ? provenance : 'aucun',
      equipement: m.equipement ? structuredClone(m.equipement) : null });
  }
  return { equipe: { ...creerEquipe(id, onglet, nom, maintenant), monstres, leader }, ignores };
}

const monstresConnus = (ids: (number | null)[], ctx: ContexteSourcesEquipes) =>
  ids.map((c) => (c === null ? undefined : ctx.monsterByCom2us.get(c))).filter((m): m is Monster => !!m);
// Un deck vide, ou de moins de deux espèces connues, n'est pas importable : une
// équipe enregistrée a au moins deux monstres.
const raisonDeck = (membres: MembreBrut[], connus: Monster[], im: Dictionnaire['equipes']['imports']) =>
  !membres.length ? im.aucunDeck : connus.slice(0, MONSTRES_MAX_EQUIPE).length < MONSTRES_MIN_EQUIPE ? im.moinsDeDeux : null;

export function sourcesImportEquipes(
  ctx: ContexteSourcesEquipes, optimizer: { stockage: StockageOptimizer; data: ExclusionSourceData } | null,
  inv: InventaireCompte, ongletOuvert: OngletEquipes, t: Dictionnaire
): SourceImportEquipe[] {
  const im = t.equipes.imports;
  const res: SourceImportEquipe[] = [];
  const siege = (teams: readonly SiegeTeam[], groupe: string, onglet: OngletEquipes, provenance: ProvenanceEquipement, libelle: (n: number) => string) =>
    teams.forEach((team, i) => {
      // Le leader est le slot 0, et lui seul : un slot 0 vide laisse l'équipe sans leader.
      const membres: MembreBrut[] = team.slots.flatMap((s, i) => (s.monsterId === null ? [] : [{
        com2usId: ctx.monsterById.get(s.monsterId)?.com2usId ?? null, unitId: null, equipement: s.gear ?? null, leader: i === 0 }]));
      const connus = monstresConnus(membres.map((m) => m.com2usId), ctx);
      res.push({ cle: `${provenance}:${team.id}`, groupe, libelle: libelle(i + 1), monstres: connus, raison: raisonDeck(membres, connus, im),
        creer: (id, tirerUid, maintenant) => equipeDepuisMembres(membres, onglet, libelle(i + 1), provenance, ctx, id, tirerUid, maintenant) });
    });
  siege(ctx.siegeDefenseTeams, im.siegeDefenses, 'siege-defense', 'siege-defense', im.defense);
  siege(ctx.siegeOffenseTeams, im.siegeAttaques, 'siege-attaque', 'siege-attaque', im.attaque);

  // Arène : lue dans l'export de compte.
  if (!ctx.compte || ctx.arenaDecks === null || ctx.arenaDecks.length === 0) {
    const raison = !ctx.compte ? im.sansCompte : ctx.arenaDecks === null ? im.reimporter : im.aucunDeck;
    res.push({ cle: 'arene', groupe: im.arene, libelle: im.arene, monstres: [], raison, creer: () => null });
  } else for (const deck of ctx.arenaDecks) {
    const libelle = deck.cle === 'defense' ? im.areneDefense : deck.cle === 'defense-serveur' ? im.areneDefenseServeur : im.areneAttaque(deck.rang + 1);
    const onglet: OngletEquipes = deck.cle === 'attaque' ? 'arene-attaque' : 'arene-defense';
    const provenance: ProvenanceEquipement = onglet;
    const membres: MembreBrut[] = deck.slots.map((s, i) => ({ com2usId: s.com2usId, unitId: s.unitId, equipement: s.gear, leader: i === 0 }));
    const connus = monstresConnus(membres.map((m) => m.com2usId), ctx);
    res.push({ cle: `arene:${deck.cle}:${deck.rang}`, groupe: im.arene, libelle, monstres: connus, raison: raisonDeck(membres, connus, im),
      creer: (id, tirerUid, maintenant) => equipeDepuisMembres(membres, onglet, libelle, provenance, ctx, id, tirerUid, maintenant) });
  }

  // Optimizer : une équipe d'une liste.
  const st = optimizer?.stockage;
  if (!optimizer || !st || st.lists.length === 0) {
    res.push({ cle: 'optimizer', groupe: im.optimizer, libelle: im.optimizer, monstres: [], raison: im.aucuneListe, creer: () => null });
    return res;
  }
  for (const liste of st.lists) {
    const equipes = st.teams.filter((e) => e.listId === liste.id);
    const especes = (selectors: ExclusionSelector[]) => selectors
      .map((sel) => resolveExclusionEntry(sel, optimizer.data)?.monster).filter((m): m is Monster => !!m);
    const brouillon = (id: string, equipeId: string, nom: string, maintenant: Date): EquipeEnregistree => ({
      ...creerEquipe(id, ongletOuvert, nom, maintenant), lienOptimizer: { listId: liste.id, equipeId, correspondance: [] } });
    // Un membre que le compte ne résout plus rend la source indisponible, avec sa raison.
    const raisonOptimizer = (equipeId: string) => {
      const r = disponibiliteRetourOptimizer(brouillon('', equipeId, '', new Date(0)), st, optimizer.data);
      return r ? t.equipes.retour.refus[r] : null;
    };
    const creerDepuis = (equipeId: string, nom: string) => (id: string, tirerUid: TirerId, maintenant: Date): ImportEquipeCree | null => {
      const r = creerDepuisEquipeOptimizer({ listId: liste.id, equipeId, nom, onglet: ongletOuvert }, st, optimizer.data, inv, id, tirerUid, maintenant);
      if (typeof r === 'string') return null;
      // Une copie, sans lien : seuls l'export et « Enregistrer dans Mes équipes »
      // de l'Optimizer en posent, pour qu'une équipe de l'Optimizer n'ait
      // qu'une équipe enregistrée qui la suive.
      const { lienOptimizer: _lien, ...equipe } = r.equipe;
      return { equipe: { ...equipe, modifieLe: maintenant.toISOString() }, ignores: 0 };
    };
    // Une équipe à la fois, jamais une liste entière (décision de l'utilisateur) :
    // une liste sans équipe n'est pas une source.
    equipes.forEach((e, i) => {
      const nom = im.equipeListe(liste.name, i + 1);
      res.push({ cle: `optimizer:${liste.id}:${e.id}`, groupe: im.optimizer, libelle: nom, monstres: especes(e.members), raison: raisonOptimizer(e.id), creer: creerDepuis(e.id, nom) });
    });
  }
  if (!res.some((x) => x.groupe === im.optimizer))
    res.push({ cle: 'optimizer', groupe: im.optimizer, libelle: im.optimizer, monstres: [], raison: im.aucuneEquipe, creer: () => null });
  return res;
}
