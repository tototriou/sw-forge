import type { LeaderSkill, SiegeTeam } from '../types';
import { completerCriteresImport, type CriteresPartielsOptimizer } from './criteresOptimizer';
import { equipeApresFiltrageOptimizer, leadEffectifMembreOptimizer } from './equipesOptimizer';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import { contenuListeValide, enregistrerMemoireMembre, type ContenuListeOptimizer, type StockageOptimizer } from './optimizerMemberStorage';

export interface MembreImportOptimizer {
  selector: ExclusionSelector;
  com2usId: number;
  libelle: string;
  criteres: CriteresPartielsOptimizer;
}
export interface EquipeImportOptimizer {
  libelle: string;
  members: ExclusionSelector[];
  leader?: ExclusionSelector;
  lead: LeaderSkill | null;
}
export interface MonstreIgnoreImportOptimizer {
  selector: ExclusionSelector;
  libelle: string;
  raison: string;
}
export interface ImportOptimizer {
  nomListe: string;
  contenu: ContenuListeOptimizer;
  membres: MembreImportOptimizer[];
  equipes: EquipeImportOptimizer[];
  ignores: MonstreIgnoreImportOptimizer[];
  messages: string[];
}
export interface RapportImportOptimizer {
  listeCreee: { id: string; name: string } | null;
  membresImportes: number;
  equipesCreees: number;
  ignores: MonstreIgnoreImportOptimizer[];
  equipesNonCreees: { libelle: string; lead: LeaderSkill | null; raisons: string[] }[];
  messages: string[];
}

const vide = (nomListe: string, contenu: ContenuListeOptimizer): ImportOptimizer => ({ nomListe, contenu, membres: [], equipes: [], ignores: [], messages: [] });
const identiteValide = (id: number | null): id is number => id !== null && Number.isSafeInteger(id) && id > 0;

function ajouterMembre(
  resultat: ImportOptimizer, selector: ExclusionSelector, monsterId: string, runeSpeed: number | null,
  data: ExclusionSourceData
): void {
  const monstre = data.monsterById.get(monsterId);
  const libelle = monstre?.name ?? monsterId;
  const resolu = resolveExclusionEntry(selector, data);
  if (!monstre || !identiteValide(monstre.com2usId) || !resolu || resolu.monster.com2usId !== monstre.com2usId) {
    const raison = !monstre ? 'Monstre inconnu.' : !identiteValide(monstre.com2usId)
      ? 'Identité d’espèce inutilisable.' : 'Exemplaire introuvable ou d’une autre espèce.';
    resultat.ignores.push({ selector, libelle, raison });
    return;
  }
  const criteres: CriteresPartielsOptimizer = {};
  if (runeSpeed !== null) {
    const base = monstre.stats.speed;
    const minimum = base === null ? NaN : base + runeSpeed;
    if (base !== null && Number.isFinite(base) && base >= 0 && Number.isFinite(runeSpeed) && runeSpeed >= 0 && Number.isFinite(minimum)) {
      // runeSpeed contient déjà Swift à plat ; ni le lead ni le tick ne décrivent la fiche.
      criteres.vitesse = { minimum };
    } else resultat.messages.push(`${libelle} : vitesse non importée, VIT de fiche non établie.`);
  }
  resultat.membres.push({ selector: { ...selector }, com2usId: monstre.com2usId, libelle, criteres });
}

function ajouterDeck(resultat: ImportOptimizer, team: SiegeTeam, source: 'siege-defense' | 'siege-offense', libelle: string, data: ExclusionSourceData): void {
  const debut = resultat.membres.length;
  team.slots.forEach((slot, slotIndex) => {
    if (slot.monsterId !== null) ajouterMembre(resultat, { source, teamId: team.id, slotIndex }, slot.monsterId, slot.runeSpeed, data);
  });
  const members = resultat.membres.slice(debut).map(m => m.selector);
  const leader = members.find(s => (s.source === 'siege-defense' || s.source === 'siege-offense') && s.slotIndex === 0);
  const monstreLeader = team.slots[0]?.monsterId ? data.monsterById.get(team.slots[0].monsterId) : undefined;
  resultat.equipes.push({ libelle, members, ...(leader ? { leader } : {}),
    lead: structuredClone(monstreLeader?.leaderSkill ?? null) });
}

export function importerDefensesSiegeOptimizer(data: ExclusionSourceData): ImportOptimizer {
  const resultat = vide('Défenses de siège', 'guilde');
  data.siegeDefenseTeams.forEach((team, i) => ajouterDeck(resultat, team, 'siege-defense', `Défense ${i + 1}`, data));
  return resultat;
}

export function importerOffenseSiegeOptimizer(teamId: string, data: ExclusionSourceData): ImportOptimizer {
  const resultat = vide('Offense de siège', 'guilde');
  const team = data.siegeOffenseTeams.find(t => t.id === teamId);
  if (team) ajouterDeck(resultat, team, 'siege-offense', 'Offense de siège', data);
  else resultat.messages.push('Deck d’offense introuvable : aucun membre importé.');
  return resultat;
}

export function importerPrepaRtaOptimizer(data: ExclusionSourceData): ImportOptimizer {
  const resultat = vide('Prépa RTA', 'arene');
  for (const entry of Object.values(data.rtaEntries)) {
    ajouterMembre(resultat, { source: 'rta', monsterId: entry.monsterId }, entry.monsterId, entry.runeSpeed, data);
  }
  return resultat;
}

function suffixer(propose: string, occupes: Set<string>): string {
  let valeur = propose, numero = 2;
  while (occupes.has(valeur)) valeur = `${propose} (${numero++})`;
  return valeur;
}

// Les données inactives réservent aussi leur cible : un nouvel import ne doit
// jamais écraser une mémoire orpheline ni réactiver un rejet par collision.
function identifiantsOccupes(stockage: StockageOptimizer, champ: 'id' | 'listId'): Set<string> {
  const valeurs: unknown[] = [...stockage.lists.map(l => ({ listId: l.id })), ...stockage.members,
    ...stockage.validated, ...stockage.memories.values(), ...stockage.teams,
    ...stockage.rejets.memories.map(v => Array.isArray(v) ? v[1] : v), ...stockage.rejets.teams,
    ...[...stockage.listContents.keys()].map(listId => ({ listId })), ...stockage.rejets.listContents];
  return new Set(valeurs.flatMap(v => {
    if (!v || typeof v !== 'object') return [];
    const valeur = (v as Record<string, unknown>)[champ];
    return typeof valeur === 'string' ? [valeur] : [];
  }));
}

export function consommerImportOptimizer(
  stockage: StockageOptimizer, activeListId: string | null, proposition: ImportOptimizer,
  data: ExclusionSourceData, idPropose: string
): { stockage: StockageOptimizer; activeListId: string | null; rapport: RapportImportOptimizer } {
  const rapport: RapportImportOptimizer = { listeCreee: null, membresImportes: 0, equipesCreees: 0,
    ignores: structuredClone(proposition.ignores), equipesNonCreees: [], messages: [...proposition.messages] };
  if (!contenuListeValide(proposition.contenu)) {
    rapport.messages.push('Import refusé : contenu de combat de la liste inconnu.');
    return { stockage, activeListId, rapport };
  }
  const listId = suffixer(idPropose.trim() || 'import', identifiantsOccupes(stockage, 'listId'));
  const name = suffixer(proposition.nomListe.trim() || 'Équipe importée', new Set(stockage.lists.map(l => l.name)));
  const acceptes = new Map<string, MembreImportOptimizer>(), vus = new Set<string>();
  let memories = stockage.memories;
  for (const membre of proposition.membres) {
    const cle = exclusionSelectorKey(membre.selector);
    const resolu = resolveExclusionEntry(membre.selector, data);
    let raison: string | undefined;
    if (vus.has(cle)) raison = 'Exemplaire en doublon : première occurrence conservée.';
    else if (!resolu) raison = 'Exemplaire introuvable.';
    else if (!identiteValide(membre.com2usId) || resolu.monster.com2usId !== membre.com2usId) raison = 'Identité d’espèce différente ou inutilisable.';
    vus.add(cle);
    if (!raison && resolu) {
      const ecriture = enregistrerMemoireMembre(memories, { listId, selector: membre.selector, com2usId: membre.com2usId },
        completerCriteresImport(membre.criteres, resolu.gear), data);
      if (ecriture.rapport.length) raison = ecriture.rapport.join(' ');
      else {
        memories = ecriture.memories;
        acceptes.set(cle, membre);
      }
    }
    if (raison) rapport.ignores.push({ selector: { ...membre.selector }, libelle: membre.libelle, raison });
  }
  rapport.membresImportes = acceptes.size;
  const nouveau: StockageOptimizer = { ...stockage, lists: [...stockage.lists, { id: listId, name }],
    members: [...stockage.members, ...[...acceptes.values()].map(m => ({ listId, selector: { ...m.selector } }))],
    memories, teams: [...stockage.teams], listContents: new Map([...stockage.listContents, [listId, proposition.contenu]]) };
  const idsEquipes = identifiantsOccupes(stockage, 'id');
  proposition.equipes.forEach((equipe, i) => {
    const members = equipe.members.filter(s => acceptes.has(exclusionSelectorKey(s)));
    const leader = equipe.leader && members.find(s => exclusionSelectorKey(s) === exclusionSelectorKey(equipe.leader!));
    const id = suffixer(`${listId}:equipe:${i + 1}`, idsEquipes);
    const creation = equipeApresFiltrageOptimizer(nouveau, { id, listId, members,
      ...(leader ? { leader } : {}), lead: equipe.lead });
    if (!creation.equipe) {
      rapport.equipesNonCreees.push({ libelle: equipe.libelle, lead: structuredClone(equipe.lead), raisons: creation.rapport });
      const lead = equipe.lead ? `${equipe.lead.stat ?? 'statistique inconnue'} ${equipe.lead.amount} % (${equipe.lead.area})` : 'aucun';
      rapport.messages.push(`${equipe.libelle} — lead de la source : ${lead}. ${creation.rapport.join(' ')}`);
    } else {
      nouveau.teams.push(creation.equipe);
      idsEquipes.add(id);
      rapport.equipesCreees++;
      for (const selector of members) {
        const membre = acceptes.get(exclusionSelectorKey(selector))!;
        const monstre = resolveExclusionEntry(selector, data)!.monster;
        const effectif = leadEffectifMembreOptimizer(nouveau, listId, selector, monstre.element);
        if (effectif.type === 'aucun') rapport.messages.push(`${equipe.libelle} — ${membre.libelle} : ${effectif.motif}`);
      }
    }
  });
  if (!acceptes.size) {
    rapport.messages.push('Import vide : aucune liste créée.');
    return { stockage, activeListId, rapport };
  }
  rapport.listeCreee = { id: listId, name };
  return { stockage: nouveau, activeListId: listId, rapport };
}
