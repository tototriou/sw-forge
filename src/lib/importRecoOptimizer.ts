import { ARTIFACT_KINDS, RECO_STATS, type RecoDeck, type RecoSlot } from '../types';
import type { CriteresPartielsOptimizer } from './criteresOptimizer';
import { retrouverDeckCompositionOptimizer, selecteurRepliCompositionOptimizer } from './deckCompositionOptimizer';
import { artifactSubKinds, artifactSubName, isArtifactSub, SET_BONUS, setsCost, MAX_SET_PIECES } from './effects';
import type { ImportOptimizer } from './importEquipes';
import { resolveExclusionEntry, type ExclusionSelector, type ExclusionSourceData } from './optimizerExclusion';

function criteresDuSlot(slot: RecoSlot, libelle: string, messages: string[]): CriteresPartielsOptimizer {
  const criteres: CriteresPartielsOptimizer = { minStats: {}, comboSets: [], lignesVerrouillees: [] };
  for (const [key, valeur] of Object.entries(slot.stats)) {
    const stat = RECO_STATS.find(s => s.key === key);
    if (!stat || !Number.isFinite(valeur)) {
      messages.push(`${libelle} : minimum ${key} non importé, statistique ou valeur non établie.`);
    } else if (valeur > 0) {
      // La confrontation juge les totaux de fiche, sans soustraire la base.
      if (stat.key === 'spd') criteres.vitesse = { minimum: valeur };
      else criteres.minStats![stat.key] = valeur;
    }
  }
  const premier = slot.setOptions?.[0] ?? [];
  if (premier.some(s => !Object.prototype.hasOwnProperty.call(SET_BONUS, s) || s === 'intangible') || setsCost(premier) > MAX_SET_PIECES) {
    messages.push(`${libelle} : premier runage non importé, combinaison non représentable.`);
  } else criteres.comboSets = [...premier];
  if (!criteres.comboSets!.length) messages.push(`${libelle} : aucun set sélectionné ; choisir un set avant de rechercher.`);
  if (slot.setOptions?.length > 1) messages.push(`${libelle} : seul le premier runage recommandé est importé.`);

  const sortesParCode = new Map<number, Set<string>>();
  for (const { key } of ARTIFACT_KINDS) {
    for (const code of slot.artifacts?.[key] ?? []) {
      // Vérifier le code avant la sorte : le repli d'un code inconnu admet les deux.
      if (!Number.isSafeInteger(code) || !isArtifactSub(code) || !artifactSubKinds(code).includes(key)) {
        messages.push(`${libelle} : propriété d’artéfact ${code} (${key}) non importée, code ou sorte non établi.`);
        continue;
      }
      const sortes = sortesParCode.get(code) ?? new Set<string>();
      sortes.add(key);
      sortesParCode.set(code, sortes);
    }
  }
  for (const [code, sortes] of sortesParCode) {
    // Ces seuils incluent les anciennes lignes ; ils ne sont pas les minima de tirage actuels.
    criteres.lignesVerrouillees!.push({ code, min: code === 218 ? 0.1 : 1 });
    if (sortes.size === 2) messages.push(`${libelle} — ${artifactSubName(code)} : demandée sur les deux pièces ; une présence sur la paire suffit à l’import.`);
  }
  if (criteres.minStats!.res || criteres.minStats!.acc) messages.push(`${libelle} : les minimums RES/Précision viennent de la fiche ; l’Optimizer peut y compter les auras selon son réglage.`);
  return criteres;
}

export function importerRecoOptimizer(deck: RecoDeck, data: ExclusionSourceData): ImportOptimizer {
  const nom = deck.name.trim() || 'Deck recommandé';
  const resultat: ImportOptimizer = { nomListe: nom, contenu: 'guilde', membres: [], equipes: [], ignores: [], messages: [] };
  const retrouve = retrouverDeckCompositionOptimizer({ type: 'recommandation', deck }, data);
  const slotsUtilises = new Set<number>();
  let leader: ExclusionSelector | undefined;
  deck.slots.forEach((slot, index) => {
    if (slot.com2usId === null) return;
    const monstre = [...data.monsterById.values()].find(m => m.com2usId === slot.com2usId);
    const libelle = monstre?.name ?? (slot.name || `Espèce ${slot.com2usId}`);
    let selector: ExclusionSelector = { source: 'unowned', monsterId: String(monstre?.id ?? slot.com2usId) };
    const ignorer = (raison: string) => resultat.ignores.push({ selector: { ...selector }, libelle, raison });
    if (!monstre || !Number.isSafeInteger(slot.com2usId) || slot.com2usId <= 0) {
      ignorer('Monstre inconnu ou identité d’espèce inutilisable.');
      return;
    }
    if (retrouve) {
      const slotIndex = retrouve.team.slots.findIndex((s, i) => !slotsUtilises.has(i) && s.monsterId !== null
        && data.monsterById.get(s.monsterId)?.com2usId === slot.com2usId);
      if (slotIndex < 0) {
        ignorer('Aucun exemplaire disponible dans les slots du deck retenu.');
        return;
      }
      slotsUtilises.add(slotIndex);
      selector = { source: retrouve.source, teamId: retrouve.team.id, slotIndex };
    } else {
      const choisi = selecteurRepliCompositionOptimizer(String(monstre.id), slot.com2usId, data, 'offense');
      if (!choisi) {
        ignorer('Exemplaire réel sans équipement résolvable.');
        return;
      }
      selector = choisi;
    }
    const resolu = resolveExclusionEntry(selector, data);
    if (!resolu || resolu.monster.com2usId !== slot.com2usId) {
      ignorer('Exemplaire introuvable ou d’une autre espèce.');
      return;
    }
    resultat.membres.push({ selector: { ...selector }, com2usId: slot.com2usId, libelle,
      criteres: criteresDuSlot(slot, libelle, resultat.messages) });
    if (index === 0) leader = { ...selector };
  });
  const monstreLeader = [...data.monsterById.values()].find(m => deck.slots[0]?.com2usId != null && m.com2usId === deck.slots[0].com2usId);
  resultat.equipes.push({ libelle: nom, members: resultat.membres.map(m => ({ ...m.selector })),
    ...(leader ? { leader } : {}), lead: structuredClone(monstreLeader?.leaderSkill ?? null) });
  return resultat;
}
