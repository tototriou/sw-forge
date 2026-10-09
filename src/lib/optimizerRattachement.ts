import { comptePeutJuger, exclusionCandidatesFor, exclusionSelectorKey, resolveExclusionEntry, revalidateBuilds,
  type ExclusionSelector, type ExclusionSource, type ExclusionSourceData } from './optimizerExclusion';
import { cleMemoireMembre, type ContenuListeOptimizer, type IdentiteMembreOptimizer, type StockageOptimizer } from './optimizerMemberStorage';

export interface RattachementMembreOptimizer {
  listId: string;
  avant: ExclusionSelector;
  apres: ExclusionSelector;
  com2usId: number;
}
export interface RapportReverificationOptimizer {
  compteVide: boolean;
  membresRetires: number;
  buildsRetires: number;
  rattachements: RattachementMembreOptimizer[];
  identitesAcquises: string[];
  buildsIncomplets: string[];
  memoiresInactives: string[];
  memoiresSuivantSelecteur: string[];
  equipesModifiees: string[];
  equipesDissoutes: string[];
  messages: string[];
}

/** L'identité ne dépend jamais d'une mémoire de critères ni des runes portées. */
export function enregistrerIdentiteMembre(identities: StockageOptimizer['identities'], membre: IdentiteMembreOptimizer) {
  const cle = cleMemoireMembre(membre.listId, membre.selector);
  if (identities.has(cle) || !Number.isSafeInteger(membre.com2usId) || membre.com2usId <= 0) return identities;
  return new Map([...identities, [cle, { ...membre, selector: { ...membre.selector } }]]);
}

/** Appeler sur le compte présent avant de remplacer ses données par un import. */
export function acquerirIdentitesMembres(stockage: StockageOptimizer, data: ExclusionSourceData): StockageOptimizer {
  let identities = stockage.identities;
  for (const membre of stockage.members) {
    if (identities.has(cleMemoireMembre(membre.listId, membre.selector))) continue;
    const resolu = resolveExclusionEntry(membre.selector, data);
    if (resolu?.monster.com2usId) identities = enregistrerIdentiteMembre(identities, { ...membre, com2usId: resolu.monster.com2usId });
  }
  return identities === stockage.identities ? stockage : { ...stockage, identities };
}

const ORDRES: Record<ContenuListeOptimizer | 'absent', readonly ExclusionSource[]> = {
  guilde: ['siege-defense', 'siege-offense', 'box', 'rta'],
  arene: ['rta', 'box', 'siege-defense', 'siege-offense'],
  donjon: ['box', 'rta', 'siege-defense', 'siege-offense'],
  absent: ['box', 'rta', 'siege-defense', 'siege-offense'],
};

/** Préserver chaque membre ; les clés migrent simultanément, y compris en cas de permutation. */
export function rattacherStockageOptimizer(stockage: StockageOptimizer, data: ExclusionSourceData, runeIds: Set<number>) {
  const rapport: RapportReverificationOptimizer = { compteVide: false, membresRetires: 0, buildsRetires: 0,
    rattachements: [], identitesAcquises: [], buildsIncomplets: [], memoiresInactives: [], memoiresSuivantSelecteur: [],
    equipesModifiees: [], equipesDissoutes: [], messages: [] };
  if (!comptePeutJuger(data, runeIds)) { rapport.compteVide = true; return { stockage, rapport }; }
  const acquis = acquerirIdentitesMembres(stockage, data);
  const noms = new Map(stockage.lists.map(l => [l.id, l.name]));
  for (const [cle, identite] of acquis.identities) if (!stockage.identities.has(cle)) {
    rapport.identitesAcquises.push(cle);
    const nom = resolveExclusionEntry(identite.selector, data)?.monster.name ?? 'Monstre';
    rapport.messages.push(`« ${noms.get(identite.listId) ?? 'Liste introuvable'} » — ${nom} : identité inconnue avant le réimport, espèce acquise depuis le nouveau compte.`);
  }
  const prises = new Map<string, Set<string>>();
  const clesGardees = new Set<string>();
  const occupees = (listId: string) => {
    if (!prises.has(listId)) prises.set(listId, new Set());
    return prises.get(listId)!;
  };
  // Réserver d'abord toutes les références encore valides : un membre à
  // rattacher ne peut pas prendre l'exemplaire d'un membre placé après lui.
  for (const membre of acquis.members) {
    const cle = cleMemoireMembre(membre.listId, membre.selector), identite = acquis.identities.get(cle);
    const resolu = resolveExclusionEntry(membre.selector, data), key = exclusionSelectorKey(membre.selector);
    if (identite && resolu?.monster.com2usId === identite.com2usId && !occupees(membre.listId).has(key)) {
      clesGardees.add(cle); occupees(membre.listId).add(key);
    }
  }
  const migrations = new Map<string, ExclusionSelector>();
  const members = acquis.members.map(membre => {
    const cle = cleMemoireMembre(membre.listId, membre.selector), identite = acquis.identities.get(cle);
    if (clesGardees.has(cle)) return membre;
    if (!identite) {
      rapport.messages.push(`« ${noms.get(membre.listId) ?? 'Liste introuvable'} » — membre ${exclusionSelectorKey(membre.selector)} conservé : espèce inconnue et référence introuvable.`);
      return membre;
    }
    const prisesListe = occupees(membre.listId);
    const runesBuild = new Set(acquis.validated.filter(b => cleMemoireMembre(b.listId, b.selector) === cle).flatMap(b => b.runeIds));
    let selector: ExclusionSelector | undefined;
    for (const source of ORDRES[acquis.listContents.get(membre.listId) ?? 'absent']) {
      let meilleur = -1;
      for (const candidat of exclusionCandidatesFor(source, data, null, null, false)) {
        if (candidat.monster.com2usId !== identite.com2usId || prisesListe.has(exclusionSelectorKey(candidat.selector))) continue;
        const commun = candidat.gear.runes.filter(r => runesBuild.has(r.id)).length;
        if (commun > meilleur) { meilleur = commun; selector = candidat.selector; }
      }
      if (selector) break;
    }
    const monstre = [...data.monsterById.values()].find(m => m.com2usId === identite.com2usId);
    if (!selector && monstre) {
      selector = { source: 'unowned', monsterId: String(monstre.id) };
      let copie = 2;
      while (prisesListe.has(exclusionSelectorKey(selector))) selector = { source: 'unowned', monsterId: String(monstre.id), copie: copie++ };
    }
    if (!selector) {
      rapport.messages.push(`« ${noms.get(membre.listId) ?? 'Liste introuvable'} » — espèce ${identite.com2usId} conservée : absente du bestiaire, rattachement impossible.`);
      return membre;
    }
    prisesListe.add(exclusionSelectorKey(selector)); migrations.set(cle, selector);
    rapport.rattachements.push({ listId: membre.listId, avant: membre.selector, apres: selector, com2usId: identite.com2usId });
    rapport.messages.push(`« ${noms.get(membre.listId) ?? 'Liste introuvable'} » — ${monstre?.name ?? identite.com2usId} : rattaché de ${exclusionSelectorKey(membre.selector)} à ${exclusionSelectorKey(selector)} ; identité, mémoire, équipe et build conservés.`);
    return { ...membre, selector };
  });
  const migrer = (listId: string, selector: ExclusionSelector) => migrations.get(cleMemoireMembre(listId, selector)) ?? selector;
  const rejets = { ...acquis.rejets };
  function migrerIndex<T extends IdentiteMembreOptimizer>(index: Map<string, T>, genre: 'memories' | 'identities'): Map<string, T> {
    if (!migrations.size) return index;
    const resultat = new Map<string, T>();
    // Les entrées migrées ont priorité ; les entrées orphelines en collision
    // restent dans les rejets, sans écrasement ni réactivation automatique.
    const entrees = [...index].sort(([a], [b]) => Number(migrations.has(b)) - Number(migrations.has(a)));
    for (const [cle, valeur] of entrees) {
      const selector = migrer(valeur.listId, valeur.selector), destination = cleMemoireMembre(valeur.listId, selector);
      if (resultat.has(destination)) {
        rejets[genre] = [...(rejets[genre] ?? []), [cle, valeur]];
        rapport.messages.push(`Entrée ${genre === 'memories' ? 'de mémoire' : 'd’identité'} en collision conservée sans application : ${cle}.`);
      } else resultat.set(destination, selector === valeur.selector ? valeur : { ...valeur, selector });
    }
    return resultat;
  }
  const identities = migrerIndex(acquis.identities, 'identities'), memories = migrerIndex(acquis.memories, 'memories');
  const teams = acquis.teams.map(equipe => {
    const members = equipe.members.map(s => migrer(equipe.listId, s));
    const leader = equipe.leader ? migrer(equipe.listId, equipe.leader) : undefined;
    if (members.every((s, i) => s === equipe.members[i]) && leader === equipe.leader) return equipe;
    rapport.equipesModifiees.push(equipe.id);
    return { ...equipe, members, ...(leader ? { leader } : {}) };
  });
  const builds = acquis.validated.map(build => {
    const selector = migrer(build.listId, build.selector);
    return selector === build.selector ? build : { ...build, selector };
  });
  const validated = revalidateBuilds(builds, data, runeIds).kept;
  for (const build of validated) if (build.runesManquantes?.length) {
    const cle = cleMemoireMembre(build.listId, build.selector);
    rapport.buildsIncomplets.push(cle);
    rapport.messages.push(`« ${noms.get(build.listId) ?? 'Liste introuvable'} » — ${resolveExclusionEntry(build.selector, data)?.monster.name ?? exclusionSelectorKey(build.selector)} : build conservé, ${build.runesManquantes.length} rune(s) absente(s) du compte, sans réservation pour ces runes.`);
  }
  const clesMembres = new Set(members.map(m => cleMemoireMembre(m.listId, m.selector)));
  for (const [cle, memoire] of memories) {
    if (!noms.has(memoire.listId) || !clesMembres.has(cle) || resolveExclusionEntry(memoire.selector, data)?.monster.com2usId !== memoire.com2usId) {
      rapport.memoiresInactives.push(cle);
      rapport.messages.push(`Mémoire d’un membre de « ${noms.get(memoire.listId) ?? 'Liste introuvable'} » conservée sans application : membre absent ou espèce différente.`);
    } else if (memoire.selector.source === 'rta' || memoire.selector.source.startsWith('siege-')) rapport.memoiresSuivantSelecteur.push(cle);
  }
  const modifie = acquis !== stockage || migrations.size || validated.some((b, i) => b !== stockage.validated[i]);
  return { stockage: modifie ? { ...acquis, members, identities, memories, teams, validated, rejets } : stockage, rapport };
}
