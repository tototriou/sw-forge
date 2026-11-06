import type { LeaderSkill, SiegeTeam } from '../types';
import { completerCriteresImport, type CriteresPartielsOptimizer } from './criteresOptimizer';
import { equipeApresFiltrageOptimizer, leadEffectifMembreOptimizer } from './equipesOptimizer';
import type { Dictionnaire } from '../i18n/fr';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData, type ValidatedBuild } from './optimizerExclusion';
import { contenuListeValide, enregistrerMemoireMembre, type ContenuListeOptimizer, type StockageOptimizer } from './optimizerMemberStorage';
import { enregistrerIdentiteMembre } from './optimizerRattachement';
import type { SpeedTuneEquipe } from './speedTuneEquipe';

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
  // Le speed tune de l'équipe : ses liens ne gardent, à la consommation, que
  // les membres acceptés (feat-contrainte-speed-tune.md, « Membres et lignes »).
  speedTune?: SpeedTuneEquipe;
}
export interface MonstreIgnoreImportOptimizer {
  selector: ExclusionSelector;
  libelle: string;
  raison: string;
}
// Un build à valider à l'import : seul l'export d'une équipe de « Mes
// équipes » en propose (docs/02-app/compte/feat-equipes.md). Les autres
// producteurs laissent `buildsAValider` absent : ils ne valident rien.
export interface BuildAValiderImport {
  selector: ExclusionSelector;
  libelle: string;
  runeIds: number[];
  runesManquantes: number[];
  artifactIds: number[];
  artefactsManquants: number[];
  reliqueId?: number;
}
export interface ImportOptimizer {
  buildsAValider?: BuildAValiderImport[];
  nomListe: string;
  contenu: ContenuListeOptimizer;
  membres: MembreImportOptimizer[];
  equipes: EquipeImportOptimizer[];
  ignores: MonstreIgnoreImportOptimizer[];
  messages: string[];
}
// Un producteur d'import : il reçoit les sources du geste et le dictionnaire
// du consommateur, dans lequel il rédige noms et messages.
export type ProducteurImportOptimizer = (data: ExclusionSourceData, t: Dictionnaire) => ImportOptimizer;

export interface RapportImportOptimizer {
  listeCreee: { id: string; name: string } | null;
  // Les équipes créées, dans l'ordre de la proposition (absent : aucune).
  equipesCreeesIds?: string[];
  buildsValides?: number;
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
  data: ExclusionSourceData, t: Dictionnaire
): void {
  const m = t.optimizer.importsEquipe;
  const monstre = data.monsterById.get(monsterId);
  const libelle = monstre?.name ?? monsterId;
  const resolu = resolveExclusionEntry(selector, data);
  if (!monstre || !identiteValide(monstre.com2usId) || !resolu || resolu.monster.com2usId !== monstre.com2usId) {
    const raison = !monstre ? m.monstreInconnu : !identiteValide(monstre.com2usId)
      ? m.identiteInutilisable : m.exemplaireIntrouvable;
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
    } else resultat.messages.push(m.vitesseNonImportee(libelle));
  }
  resultat.membres.push({ selector: { ...selector }, com2usId: monstre.com2usId, libelle, criteres });
}

function ajouterDeck(resultat: ImportOptimizer, team: SiegeTeam, source: 'siege-defense' | 'siege-offense', libelle: string, data: ExclusionSourceData, t: Dictionnaire): void {
  const debut = resultat.membres.length;
  team.slots.forEach((slot, slotIndex) => {
    if (slot.monsterId !== null) ajouterMembre(resultat, { source, teamId: team.id, slotIndex }, slot.monsterId, slot.runeSpeed, data, t);
  });
  const members = resultat.membres.slice(debut).map(m => m.selector);
  const leader = members.find(s => (s.source === 'siege-defense' || s.source === 'siege-offense') && s.slotIndex === 0);
  const monstreLeader = team.slots[0]?.monsterId ? data.monsterById.get(team.slots[0].monsterId) : undefined;
  resultat.equipes.push({ libelle, members, ...(leader ? { leader } : {}),
    lead: structuredClone(monstreLeader?.leaderSkill ?? null) });
}

// Les producteurs reçoivent le dictionnaire du consommateur (`produire(data, t)`) :
// le nom de la liste prend la langue du moment de sa création.
export function importerDefensesSiegeOptimizer(data: ExclusionSourceData, t: Dictionnaire): ImportOptimizer {
  const m = t.optimizer.importsEquipe;
  const resultat = vide(m.defenses, 'guilde');
  data.siegeDefenseTeams.forEach((team, i) => ajouterDeck(resultat, team, 'siege-defense', m.defense(i + 1), data, t));
  return resultat;
}

export function importerOffenseSiegeOptimizer(teamId: string, data: ExclusionSourceData, t: Dictionnaire): ImportOptimizer {
  const m = t.optimizer.importsEquipe;
  const resultat = vide(m.offense, 'guilde');
  const team = data.siegeOffenseTeams.find(e => e.id === teamId);
  if (team) ajouterDeck(resultat, team, 'siege-offense', m.offense, data, t);
  else resultat.messages.push(m.offenseIntrouvable);
  return resultat;
}

export function importerPrepaRtaOptimizer(data: ExclusionSourceData, t: Dictionnaire): ImportOptimizer {
  const resultat = vide(t.optimizer.importsEquipe.prepaRta, 'arene');
  for (const entry of Object.values(data.rtaEntries)) {
    ajouterMembre(resultat, { source: 'rta', monsterId: entry.monsterId }, entry.monsterId, entry.runeSpeed, data, t);
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
// Une ancienne suppression de liste peut laisser ses identités seules :
// réserver leur liste évite de les attribuer aux nouveaux membres.
function identifiantsOccupes(stockage: StockageOptimizer, champ: 'id' | 'listId'): Set<string> {
  const valeurs: unknown[] = [...stockage.lists.map(l => ({ listId: l.id })), ...stockage.members,
    ...stockage.validated, ...stockage.memories.values(), ...stockage.teams,
    ...(champ === 'listId' ? [...stockage.identities.values(),
      ...(stockage.rejets.identities ?? []).map(v => Array.isArray(v) ? v[1] : v)] : []),
    ...stockage.rejets.memories.map(v => Array.isArray(v) ? v[1] : v), ...stockage.rejets.teams,
    ...[...stockage.listContents.keys()].map(listId => ({ listId })), ...stockage.rejets.listContents];
  return new Set(valeurs.flatMap(v => {
    if (!v || typeof v !== 'object') return [];
    const valeur = (v as Record<string, unknown>)[champ];
    return typeof valeur === 'string' ? [valeur] : [];
  }));
}

export function identifiantListeImportOccupe(stockage: StockageOptimizer, id: string): boolean {
  return identifiantsOccupes(stockage, 'listId').has(id);
}

export function consommerImportOptimizer(
  stockage: StockageOptimizer, activeListId: string | null, proposition: ImportOptimizer,
  data: ExclusionSourceData, idPropose: string, t: Dictionnaire
): { stockage: StockageOptimizer; activeListId: string | null; rapport: RapportImportOptimizer } {
  const m = t.optimizer.importsEquipe;
  const rapport: RapportImportOptimizer = { listeCreee: null, membresImportes: 0, equipesCreees: 0,
    ignores: structuredClone(proposition.ignores), equipesNonCreees: [], messages: [...proposition.messages] };
  if (!contenuListeValide(proposition.contenu)) {
    rapport.messages.push(m.contenuInconnu);
    return { stockage, activeListId, rapport };
  }
  const listId = suffixer(idPropose.trim() || 'import', identifiantsOccupes(stockage, 'listId'));
  const name = suffixer(proposition.nomListe.trim() || m.equipeImportee, new Set(stockage.lists.map(l => l.name)));
  const acceptes = new Map<string, MembreImportOptimizer>(), vus = new Set<string>();
  let memories = stockage.memories;
  let identities = stockage.identities;
  for (const membre of proposition.membres) {
    const cle = exclusionSelectorKey(membre.selector);
    const resolu = resolveExclusionEntry(membre.selector, data);
    let raison: string | undefined;
    if (vus.has(cle)) raison = m.doublon;
    else if (!resolu) raison = m.exemplaireAbsent;
    else if (!identiteValide(membre.com2usId) || resolu.monster.com2usId !== membre.com2usId) raison = m.identiteDifferente;
    vus.add(cle);
    if (!raison && resolu) {
      const ecriture = enregistrerMemoireMembre(memories, { listId, selector: membre.selector, com2usId: membre.com2usId },
        completerCriteresImport(membre.criteres, resolu.gear), data, t);
      if (ecriture.rapport.length) raison = ecriture.rapport.join(' ');
      else {
        memories = ecriture.memories;
        identities = enregistrerIdentiteMembre(identities, { listId, selector: membre.selector, com2usId: membre.com2usId });
        acceptes.set(cle, membre);
      }
    }
    if (raison) rapport.ignores.push({ selector: { ...membre.selector }, libelle: membre.libelle, raison });
  }
  rapport.membresImportes = acceptes.size;
  const nouveau: StockageOptimizer = { ...stockage, lists: [...stockage.lists, { id: listId, name }],
    members: [...stockage.members, ...[...acceptes.values()].map(m => ({ listId, selector: { ...m.selector } }))],
    memories, identities, teams: [...stockage.teams], listContents: new Map([...stockage.listContents, [listId, proposition.contenu]]) };
  const idsEquipes = identifiantsOccupes(stockage, 'id');
  proposition.equipes.forEach((equipe, i) => {
    const members = equipe.members.filter(s => acceptes.has(exclusionSelectorKey(s)));
    const leader = equipe.leader && members.find(s => exclusionSelectorKey(s) === exclusionSelectorKey(equipe.leader!));
    const id = suffixer(`${listId}:equipe:${i + 1}`, idsEquipes);
    const creation = equipeApresFiltrageOptimizer(nouveau, { id, listId, members,
      ...(leader ? { leader } : {}), lead: equipe.lead }, t);
    if (!creation.equipe) {
      rapport.equipesNonCreees.push({ libelle: equipe.libelle, lead: structuredClone(equipe.lead), raisons: creation.rapport });
      const lead = equipe.lead ? m.lead(equipe.lead.stat ?? m.statInconnue, equipe.lead.amount, equipe.lead.area) : m.aucunLead;
      rapport.messages.push(m.leadNonApplique(equipe.libelle, lead, creation.rapport.join(' ')));
    } else {
      const speedTune = equipe.speedTune && { plan: structuredClone(equipe.speedTune.plan),
        membres: structuredClone(equipe.speedTune.membres.filter((l) => acceptes.has(exclusionSelectorKey(l.selector)))) };
      nouveau.teams.push(speedTune ? { ...creation.equipe, speedTune } : creation.equipe);
      idsEquipes.add(id);
      (rapport.equipesCreeesIds ??= []).push(id);
      rapport.equipesCreees++;
      for (const selector of members) {
        const membre = acceptes.get(exclusionSelectorKey(selector))!;
        const monstre = resolveExclusionEntry(selector, data)!.monster;
        const effectif = leadEffectifMembreOptimizer(nouveau, listId, selector, monstre.element);
        if (effectif.type === 'aucun') rapport.messages.push(m.leadInactif(equipe.libelle, membre.libelle, t.optimizer.motifsLead[effectif.motif]));
      }
    }
  });
  if (!acceptes.size) {
    rapport.messages.push(m.importVide);
    return { stockage, activeListId, rapport };
  }
  // Les builds proposés, dans leur ordre : un build dont une pièce présente
  // est déjà réservée par un build précédent de la liste n'est pas validé,
  // comme la validation sans recherche (feat-listes-et-reservation.md).
  if (proposition.buildsAValider?.length) {
    const runesPrises = new Map<number, string>(), artefactsPris = new Map<number, string>();
    const valides: ValidatedBuild[] = [];
    for (const b of proposition.buildsAValider) {
      if (!acceptes.has(exclusionSelectorKey(b.selector))) continue;
      const runes = b.runeIds.filter(id => id > 0 && !b.runesManquantes.includes(id));
      const arts = b.artifactIds.filter(id => id > 0 && !b.artefactsManquants.includes(id));
      const conflit = runes.map(id => runesPrises.get(id)).find(Boolean) ?? arts.map(id => artefactsPris.get(id)).find(Boolean);
      if (conflit) { rapport.messages.push(m.buildNonValide(b.libelle, conflit)); continue; }
      for (const id of runes) runesPrises.set(id, b.libelle);
      for (const id of arts) artefactsPris.set(id, b.libelle);
      valides.push({ listId, selector: { ...b.selector }, runeIds: [...b.runeIds],
        ...(b.runesManquantes.length ? { runesManquantes: [...b.runesManquantes] } : {}),
        artifactIds: b.artifactIds.filter(id => id > 0),
        ...(b.artefactsManquants.length ? { artefactsManquants: [...b.artefactsManquants] } : {}),
        ...(b.reliqueId !== undefined && b.reliqueId > 0 ? { reliqueId: b.reliqueId } : {}) });
    }
    nouveau.validated = [...stockage.validated, ...valides];
    rapport.buildsValides = valides.length;
  }
  rapport.listeCreee = { id: listId, name };
  return { stockage: nouveau, activeListId: listId, rapport };
}
