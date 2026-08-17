// Exclusion MANUELLE de runes dans l'Optimizer (voir spec/outils/optimizer.md) —
// se superpose à l'exclusion automatique existante (« Utiliser tout
// l'inventaire », voir `excludedRuneIds` dans runeBuildOptim.ts), qui ne
// couvre que la box. Ici : n'importe quel monstre déjà connu du compte —
// box, RTA (favoris), Siège défense, Siège offense — peut être choisi
// explicitement pour exclure SES runes actuelles de la recherche.
//
// ⚠️ Volontairement PAS une extension de `collectOwnedBuilds`
// (ownedBuilds.ts) : cette fonction est déjà utilisée par les
// recommandations de siège (recoMatch.ts, RecoBoard.tsx) — la faire porter
// une responsabilité de plus (un sélecteur stable par entrée) risquerait de
// la faire diverger pour un usage qu'elle ne sert pas. Même agrégation
// (box + RTA + défense + offense), dupliquée ici délibérément, avec un
// sélecteur RÉSOLVABLE en plus (voir `ExclusionSelector`).
//
// ⚠️ Chaque sélection est PAR ENTRÉE PRÉCISE, pas par monstre : le même
// monstre peut avoir un runage différent en box, en RTA et dans un deck de
// siège — exclure « Camilla (RTA) » n'exclut QUE son runage RTA.
import { BoxItem } from './applyAccount';
import { GearSet, Monster, RtaEntry, SiegeTeam } from '../types';

export type ExclusionSource = 'box' | 'rta' | 'siege-defense' | 'siege-offense';

export type ExclusionSelector =
  | { source: 'box'; unitKey: string }
  | { source: 'rta'; monsterId: string }
  | { source: 'siege-defense'; teamId: string; slotIndex: number }
  | { source: 'siege-offense'; teamId: string; slotIndex: number };

export interface ExclusionCandidate {
  selector: ExclusionSelector;
  monster: Monster;
  gear: GearSet;
}

// Clé canonique — dédoublonnage et comparaison, jamais recalculée à la main
// ailleurs (voir son usage dans RuneExclusionPicker.tsx).
export function exclusionSelectorKey(sel: ExclusionSelector): string {
  switch (sel.source) {
    case 'box':
      return `box:${sel.unitKey}`;
    case 'rta':
      return `rta:${sel.monsterId}`;
    case 'siege-defense':
      return `siege-defense:${sel.teamId}:${sel.slotIndex}`;
    case 'siege-offense':
      return `siege-offense:${sel.teamId}:${sel.slotIndex}`;
  }
}

export interface ExclusionSourceData {
  box: BoxItem[];
  rtaEntries: Record<string, RtaEntry>;
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
  // Indexé par `String(monster.id)` — même clé que `RtaEntry.monsterId`/
  // `SiegeSlot.monsterId` (voir applyAccount.ts, `mapRtaItems`/`mapSiegeTeams`).
  monsterById: Map<string, Monster>;
}

// Liste des monstres proposables à l'exclusion pour UNE source — filtre les
// entrées sans runes équipées (rien à exclure) et, pour la box, le monstre
// actuellement recherché (s'exclure soi-même n'a pas de sens).
export function exclusionCandidatesFor(source: ExclusionSource, data: ExclusionSourceData, excludeOwnUnitKey: string | null): ExclusionCandidate[] {
  const out: ExclusionCandidate[] = [];
  if (source === 'box') {
    for (const item of data.box) {
      if (item.key === excludeOwnUnitKey) continue;
      if (!item.gear || item.gear.runes.length === 0) continue;
      out.push({ selector: { source: 'box', unitKey: item.key }, monster: item.monster, gear: item.gear });
    }
    return out;
  }
  if (source === 'rta') {
    for (const entry of Object.values(data.rtaEntries)) {
      if (!entry.gear || entry.gear.runes.length === 0) continue;
      const monster = data.monsterById.get(entry.monsterId);
      if (!monster) continue;
      out.push({ selector: { source: 'rta', monsterId: entry.monsterId }, monster, gear: entry.gear });
    }
    return out;
  }
  const teams = source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
  teams.forEach((team) => {
    team.slots.forEach((slot, slotIndex) => {
      if (!slot.gear || slot.gear.runes.length === 0) return;
      if (slot.monsterId == null) return;
      const monster = data.monsterById.get(slot.monsterId);
      if (!monster) return;
      out.push({ selector: { source, teamId: team.id, slotIndex }, monster, gear: slot.gear });
    });
  });
  return out;
}

// Résout UN sélecteur vers son monstre + son équipement — pour l'affichage
// (chaque sélection retenue à l'écran, voir RuneExclusionPicker.tsx), sans
// recalculer la liste complète des candidats de sa source.
export function resolveExclusionEntry(sel: ExclusionSelector, data: ExclusionSourceData): { monster: Monster; gear: GearSet } | null {
  if (sel.source === 'box') {
    const item = data.box.find((b) => b.key === sel.unitKey);
    return item?.gear ? { monster: item.monster, gear: item.gear } : null;
  }
  if (sel.source === 'rta') {
    const entry = data.rtaEntries[sel.monsterId];
    const monster = entry ? data.monsterById.get(entry.monsterId) : undefined;
    return entry?.gear && monster ? { monster, gear: entry.gear } : null;
  }
  const teams = sel.source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
  const team = teams.find((t) => t.id === sel.teamId);
  const slot = team?.slots[sel.slotIndex];
  const monster = slot?.monsterId ? data.monsterById.get(slot.monsterId) : undefined;
  return slot?.gear && monster ? { monster, gear: slot.gear } : null;
}

// Résout une liste de sélecteurs (venus de l'état de l'écran, OU relus
// depuis une recette importée — voir optimizerRecipe.ts) contre les
// données ACTUELLEMENT chargées. Un sélecteur introuvable (monstre reruné
// depuis, deck modifié, recette d'un AUTRE compte…) est silencieusement
// ignoré — jamais une erreur : même tolérance que l'import de recette pour
// `exploreAll`/le monstre choisi.
export function resolveExcludedRuneIds(selectors: ExclusionSelector[], data: ExclusionSourceData): Set<number> {
  const out = new Set<number>();
  for (const sel of selectors) {
    let gear: GearSet | undefined;
    if (sel.source === 'box') {
      gear = data.box.find((b) => b.key === sel.unitKey)?.gear;
    } else if (sel.source === 'rta') {
      gear = data.rtaEntries[sel.monsterId]?.gear;
    } else {
      const teams = sel.source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
      gear = teams.find((t) => t.id === sel.teamId)?.slots[sel.slotIndex]?.gear;
    }
    for (const r of gear?.runes ?? []) out.add(r.id);
  }
  return out;
}
