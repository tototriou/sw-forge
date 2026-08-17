// Exclusion MANUELLE de runes dans l'Optimizer (voir spec/outils/optimizer.md) —
// se superpose à l'exclusion AUTOMATIQUE « Exclure les runes déjà utilisées »
// (voir `autoExcludedRuneIds` plus bas, et `excludedRuneIds` dans
// runeBuildOptim.ts pour son cas particulier « périmètre Box »), qui ne
// couvre qu'UN périmètre entier à la fois (RTA/Défenses siège/Box). Ici :
// n'importe quel monstre déjà connu du compte — box, RTA (favoris), Siège
// défense, Siège offense — peut être choisi explicitement pour exclure SES
// runes actuelles de la recherche.
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
import { excludedRuneIds } from './runeBuildOptim';

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
  // Box/RTA : `undefined`. Siège UNIQUEMENT — un même monstre peut
  // apparaître dans PLUSIEURS équipes (deux « Tractor » de decks
  // différents, indiscernables par le seul nom, voir RuneExclusionPicker.tsx)
  // : de quoi afficher la provenance (numéro d'équipe + les 3 monstres,
  // dans l'ordre des slots, `null` = slot vide ou monstre non résolu).
  teamContext?: { teamNumber: number; slots: (Monster | null)[] };
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
  teams.forEach((team, teamIndex) => {
    // Même numérotation que le reste de l'app (SiegeTeam.tsx : « Équipe
    // {index+1} ») — calculé UNE fois par équipe, réutilisé pour chacun de
    // ses slots.
    const teamNumber = teamIndex + 1;
    const teamSlots = team.slots.map((s) => (s.monsterId ? (data.monsterById.get(s.monsterId) ?? null) : null));
    team.slots.forEach((slot, slotIndex) => {
      if (!slot.gear || slot.gear.runes.length === 0) return;
      if (slot.monsterId == null) return;
      const monster = data.monsterById.get(slot.monsterId);
      if (!monster) return;
      out.push({ selector: { source, teamId: team.id, slotIndex }, monster, gear: slot.gear, teamContext: { teamNumber, slots: teamSlots } });
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
// `excludeUsedRunes`/le monstre choisi.
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

/* --------------------------------------------------------------------------
 * Exclusion AUTOMATIQUE — « Exclure les runes déjà utilisées »
 * (OptimizerSection.tsx) : exclut TOUT un périmètre d'un coup (RTA, Défenses
 * siège ou Box), à l'opposé de l'exclusion MANUELLE ci-dessus qui retient des
 * entrées précises une par une. Un seul périmètre actif à la fois — remplace
 * l'ancienne case « Utiliser tout l'inventaire » (inversée : décochée par
 * défaut désormais, et plus seulement scopée à la box).
 * ----------------------------------------------------------------------- */
export type AutoExclusionScope = 'rta' | 'siege-defense' | 'box';

export const AUTO_EXCLUSION_SCOPES: { key: AutoExclusionScope; label: string }[] = [
  { key: 'rta', label: 'RTA' },
  { key: 'siege-defense', label: 'Défenses siège' },
  { key: 'box', label: 'Box' },
];

// `ownCom2usId` : le monstre RECHERCHÉ n'est jamais exclu de LUI-MÊME, quel
// que soit le périmètre — comparaison par ESPÈCE (com2usId), pas par entrée
// précise, car la box peut contenir plusieurs exemplaires du même monstre
// (voir excludedRuneIds ci-dessus, dont la branche `box` est directement
// réutilisée pour rester une SEULE définition de « à soi » niveau box).
export function autoExcludedRuneIds(scope: AutoExclusionScope, data: ExclusionSourceData, ownCom2usId: number | null): Set<number> {
  if (scope === 'box') {
    return excludedRuneIds(
      data.box.map((b) => ({ unitKey: b.key, com2usId: b.monster.com2usId, gear: b.gear })),
      ownCom2usId
    );
  }
  const isOwn = (monsterId: string | null | undefined): boolean => {
    if (ownCom2usId == null || monsterId == null) return false;
    return data.monsterById.get(monsterId)?.com2usId === ownCom2usId;
  };
  const out = new Set<number>();
  if (scope === 'rta') {
    for (const entry of Object.values(data.rtaEntries)) {
      if (isOwn(entry.monsterId)) continue;
      for (const r of entry.gear?.runes ?? []) out.add(r.id);
    }
    return out;
  }
  // 'siege-defense'
  for (const team of data.siegeDefenseTeams) {
    for (const slot of team.slots) {
      if (isOwn(slot.monsterId)) continue;
      for (const r of slot.gear?.runes ?? []) out.add(r.id);
    }
  }
  return out;
}
