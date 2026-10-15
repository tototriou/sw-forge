import type { DeckInitial } from '../hooks/useSpeedTune';
import type { SiegeTeam } from '../types';
import type { ImportOptimizer } from './importEquipes';
import { exclusionSelectorKey, resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';
import { retrouverDeckCompositionOptimizer, selecteurRepliCompositionOptimizer } from './deckCompositionOptimizer';
import type { LeadInfo } from './speed';
import type { Ligne } from './speedTuneLignes';

export function importerSpeedTuneOptimizer(
  lignes: readonly Ligne[], lead: LeadInfo | null, data: ExclusionSourceData, deckInitial?: DeckInitial
): ImportOptimizer {
  const resultat: ImportOptimizer = { nomListe: 'Speed tuning', contenu: 'guilde', membres: [], equipes: [], ignores: [],
    messages: ['La VIT minimum de fiche ne garantit pas l’ordre des tours ; les fenêtres de l’analyse ne sont pas importées.'] };
  let deck: SiegeTeam | undefined;
  let sourceDeck: 'siege-defense' | 'siege-offense' | undefined;
  if (deckInitial) {
    const teams = deckInitial.source === 'defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
    // Même résolution que l'ouverture du speed tuning depuis un deck.
    deck = teams.find(t => t.id === deckInitial.teamId) ?? teams[Number(deckInitial.teamId)];
    sourceDeck = deckInitial.source === 'defense' ? 'siege-defense' : 'siege-offense';
  } else {
    const composition = lignes.filter(l => l.camp === 'allie').map(l => {
      const monstre = data.monsterById.get(String(l.monster.id));
      return monstre?.com2usId === l.monster.com2usId ? monstre?.com2usId ?? null : null;
    });
    const retrouve = retrouverDeckCompositionOptimizer({ type: 'speed-tuning', composition }, data);
    deck = retrouve?.team;
    sourceDeck = retrouve?.source;
  }
  const slotsUtilises = new Set<number>();
  for (const ligne of lignes) {
    if (ligne.camp !== 'allie') continue;
    const monsterId = String(ligne.monster.id), monstre = data.monsterById.get(monsterId);
    let selector: ExclusionSelector = { source: 'unowned', monsterId };
    const ignorer = (raison: string) => resultat.ignores.push({ selector: { ...selector }, libelle: ligne.monster.name, raison });
    if (!monstre || !Number.isSafeInteger(monstre.com2usId) || monstre.com2usId === null
      || monstre.com2usId <= 0 || monstre.com2usId !== ligne.monster.com2usId) {
      ignorer('Monstre inconnu ou identité d’espèce inutilisable.');
      continue;
    }
    if (deckInitial && !deck) {
      ignorer('Deck d’origine introuvable : exemplaire non établi.');
      continue;
    }
    const slotIndex = deck?.slots.findIndex((s, i) => !slotsUtilises.has(i) && s.monsterId !== null
      && data.monsterById.get(s.monsterId)?.com2usId === monstre.com2usId) ?? -1;
    if (deck && sourceDeck && slotIndex >= 0) {
      selector = { source: sourceDeck, teamId: deck.id, slotIndex };
      slotsUtilises.add(slotIndex);
    } else {
      const choisi = selecteurRepliCompositionOptimizer(monsterId, monstre.com2usId, data, 'box');
      if (!choisi) {
        ignorer('Exemplaire réel sans équipement résolvable.');
        continue;
      }
      selector = choisi;
      if (deck) resultat.messages.push(`${monstre.name} : absent des slots disponibles du deck d’origine ; exemplaire choisi dans le compte.`);
    }
    const resolu = resolveExclusionEntry(selector, data);
    if (!resolu || resolu.monster.com2usId !== monstre.com2usId) {
      ignorer('Exemplaire introuvable ou d’une autre espèce.');
      continue;
    }
    const base = ligne.monster.stats.speed, runeSpeed = ligne.runeSpeed;
    if (runeSpeed === null || base === null || !Number.isFinite(base) || base < 0
      || !Number.isFinite(runeSpeed) || runeSpeed < 0 || !Number.isFinite(base + runeSpeed)) {
      ignorer('Vitesse non saisie ou VIT de fiche non établie.');
      continue;
    }
    // La saisie porte déjà Swift à plat, comme la fiche computeStats.
    const criteres: ImportOptimizer['membres'][number]['criteres'] = { vitesse: { minimum: base + runeSpeed } };
    if (ligne.swift) criteres.comboSets = ['swift'];
    else resultat.messages.push(`${monstre.name} : aucun set sélectionné ; choisir un set avant de rechercher.`);
    if (ligne.artefactBuff !== null) {
      if (Number.isFinite(ligne.artefactBuff) && ligne.artefactBuff > 0) {
        criteres.lignesVerrouillees = [{ code: 206, min: ligne.artefactBuff }];
      } else if (!Number.isFinite(ligne.artefactBuff) || ligne.artefactBuff < 0) {
        resultat.messages.push(`${monstre.name} : Effet aug. VIT non importé, valeur invalide.`);
      }
    }
    resultat.membres.push({ selector: { ...selector }, com2usId: monstre.com2usId, libelle: monstre.name, criteres });
  }
  // La cardinalité se juge dans le consommateur après sa revérification. Le
  // lead reste sur la proposition pour être nommé même si l'équipe est refusée.
  const members = resultat.membres.map(m => m.selector);
  const leader = deck && sourceDeck ? members.find(s => exclusionSelectorKey(s)
    === exclusionSelectorKey({ source: sourceDeck, teamId: deck.id, slotIndex: 0 })) : undefined;
  resultat.equipes.push({ libelle: 'Ton équipe', members, ...(leader ? { leader: { ...leader } } : {}),
    lead: lead ? { stat: 'Attack Speed', amount: lead.amount, area: lead.area, element: lead.element } : null });
  return resultat;
}
