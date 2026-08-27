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
import { monsterBaseStats } from './stats';

export type ExclusionSource = 'box' | 'rta' | 'siege-defense' | 'siege-offense';

// ⚠️ Remonté depuis RuneExclusionPicker.tsx à son deuxième usage (le
// sélecteur de source de « Monstre & équipement », voir
// OptimizerSection.tsx) plutôt que recopié — même quatre libellés, même
// ordre, une seule source si jamais l'un d'eux change.
export const SOURCE_OPTIONS: { key: ExclusionSource; label: string }[] = [
  { key: 'box', label: 'Box' },
  { key: 'rta', label: 'RTA' },
  { key: 'siege-defense', label: 'Défenses siège' },
  { key: 'siege-offense', label: 'Offenses siège' },
];

// ⚠️ `'unowned'` — demande explicite (« ajouter un monstre qu'on ne possède
// pas dans une liste : le joueur a obtenu le monstre et veut essayer des
// runages de teams sans avoir mis à jour son json ») : une ESPÈCE choisie
// via la recherche bestiaire (voir `MonsterSourcePicker mode="bestiary"`)
// mais absente des 4 sources du compte — pas un exemplaire réel, juste une
// espèce (`monsterId` = `String(Monster.id)`, même clé que `monsterById`,
// PAS `com2usId` : une espèce précise, un élément/palier d'éveil précis,
// pas toute la famille). N'a JAMAIS de runes propres (`resolveSelectorRaw`
// renvoie toujours `runes: []`) — rien à exclure pour les autres, mais
// « Ajouter à la liste »/« Valider ce build » fonctionnent identiquement à
// un exemplaire réel : les RUNES trouvées par la recherche restent de
// VRAIES runes du compte, réservables comme n'importe quel autre build
// validé (voir ValidatedBuild plus bas).
export type ExclusionSelector =
  | { source: 'box'; unitKey: string }
  | { source: 'rta'; monsterId: string }
  | { source: 'siege-defense'; teamId: string; slotIndex: number }
  | { source: 'siege-offense'; teamId: string; slotIndex: number }
  | { source: 'unowned'; monsterId: string };

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
    case 'unowned':
      return `unowned:${sel.monsterId}`;
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
// entrées sans runes équipées (rien à exclure) et le monstre actuellement
// recherché (s'exclure soi-même n'a pas de sens).
//
// ⚠️ Deux gardes DISTINCTES, une par granularité — trouvé manquant pour RTA/
// siège par une revue de code externe (voir spec/outils/optimizer/
// historique-acceleration-et-outillage.md) :
// - `excludeOwnUnitKey` (box UNIQUEMENT) : compare par ENTRÉE précise (clé de
//   box), pas par espèce — la box peut contenir plusieurs exemplaires du même
//   monstre (voir l'en-tête du fichier), et SEUL l'exemplaire réellement en
//   cours d'optimisation doit être écarté ; un AUTRE exemplaire de la même
//   espèce reste une exclusion manuelle légitime et différente.
// - `excludeOwnCom2usId` (RTA + siège) : compare par ESPÈCE (com2usId), même
//   principe que `autoExcludedRuneIds`/`isOwn` plus bas — RTA et un slot de
//   siège n'ont qu'UNE seule entrée par monstre, donc la bonne granularité
//   est directement l'espèce, pas une clé d'entrée qui n'existe pas ici.
export function exclusionCandidatesFor(source: ExclusionSource, data: ExclusionSourceData, excludeOwnUnitKey: string | null, excludeOwnCom2usId: number | null): ExclusionCandidate[] {
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
      if (excludeOwnCom2usId != null && monster.com2usId === excludeOwnCom2usId) continue;
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
      if (excludeOwnCom2usId != null && monster.com2usId === excludeOwnCom2usId) return;
      out.push({ selector: { source, teamId: team.id, slotIndex }, monster, gear: slot.gear, teamContext: { teamNumber, slots: teamSlots } });
    });
  });
  return out;
}

// Résout UN sélecteur vers son monstre + son équipement bruts (l'un ou
// l'autre — ou les deux — peuvent être absents : entrée introuvable, sans
// runes équipées…) — factorisé une seule fois, réutilisé par
// `resolveExclusionEntry` (résolution pour l'affichage) ET
// `resolveExcludedRuneIds` (résolution pour le calcul du pool), qui
// réimplémentaient chacune le même branchement à 3 voies (box/rta/siège).
function resolveSelectorRaw(sel: ExclusionSelector, data: ExclusionSourceData): { monster: Monster | undefined; gear: GearSet | undefined } {
  if (sel.source === 'box') {
    const item = data.box.find((b) => b.key === sel.unitKey);
    return { monster: item?.monster, gear: item?.gear };
  }
  if (sel.source === 'rta') {
    const entry = data.rtaEntries[sel.monsterId];
    const monster = entry ? data.monsterById.get(entry.monsterId) : undefined;
    return { monster, gear: entry?.gear };
  }
  if (sel.source === 'unowned') {
    // `monsterById` couvre TOUT le bestiaire (voir OptimizerSection.tsx,
    // construit depuis `allMonsters`, pas seulement les entrées possédées) —
    // se résout donc quel que soit le compte chargé. Stats de base 6★ niveau
    // max, sans rune ni artéfact — même construction que le repli « espèce
    // seule » de `selected` (OptimizerSection.tsx), une seule source de
    // vérité pour « à quoi ressemble un monstre non possédé ».
    const monster = data.monsterById.get(sel.monsterId);
    return { monster, gear: monster ? { base: monsterBaseStats(monster), runes: [], artifacts: [] } : undefined };
  }
  const teams = sel.source === 'siege-defense' ? data.siegeDefenseTeams : data.siegeOffenseTeams;
  const slot = teams.find((t) => t.id === sel.teamId)?.slots[sel.slotIndex];
  const monster = slot?.monsterId != null ? data.monsterById.get(slot.monsterId) : undefined;
  return { monster, gear: slot?.gear };
}

// Résout UN sélecteur vers son monstre + son équipement — pour l'affichage
// (chaque sélection retenue à l'écran, voir RuneExclusionPicker.tsx), sans
// recalculer la liste complète des candidats de sa source.
export function resolveExclusionEntry(sel: ExclusionSelector, data: ExclusionSourceData): { monster: Monster; gear: GearSet } | null {
  const { monster, gear } = resolveSelectorRaw(sel, data);
  return monster && gear ? { monster, gear } : null;
}

// Résout une liste de sélecteurs (venus de l'état de l'écran, OU relus
// depuis une recette importée — voir optimizerRecipe.ts) contre les
// données ACTUELLEMENT chargées. Un sélecteur introuvable (monstre reruné
// depuis, deck modifié, recette d'un AUTRE compte…) est silencieusement
// ignoré — jamais une erreur : même tolérance que l'import de recette pour
// `excludeUsedRunes`/le monstre choisi.
//
// ⚠️ Revérifié ICI, à la RÉSOLUTION — pas seulement au moment où
// `exclusionCandidatesFor` a proposé le sélecteur. Trouvé par une revue de
// code externe : `excludedSelectors` (l'état de l'écran) survit à un
// changement de monstre recherché sans jamais être purgé — un sélecteur
// choisi en toute légitimité en optimisant le monstre A (« exclure les
// runes de B ») devient une AUTO-exclusion si l'utilisateur change ensuite
// le monstre recherché pour B. Défendu ici, au point où l'exclusion est
// RÉELLEMENT appliquée au pool, pour que la garantie « le monstre recherché
// n'est jamais exclu de ses propres runes » tienne quelle que soit la façon
// dont le sélecteur est arrivé dans la liste (choix frais, recette importée,
// ou changement de monstre après coup) — pas seulement au moment du choix.
//
// ⚠️ DEUX gardes séparées, MÊME granularité que `exclusionCandidatesFor` —
// piège vécu en écrivant le test différentiel : une comparaison par
// ESPÈCE (com2usId) pour la box aurait exclu TOUT exemplaire de la même
// espèce, pas seulement celui réellement en cours d'optimisation. La box
// reste PAR ENTRÉE (`ownUnitKey`) — un second exemplaire de la même
// espèce, runage différent, reste une exclusion manuelle légitime.
export function resolveExcludedRuneIds(selectors: ExclusionSelector[], data: ExclusionSourceData, ownUnitKey: string | null, ownCom2usId: number | null): Set<number> {
  const out = new Set<number>();
  for (const sel of selectors) {
    if (sel.source === 'box' && sel.unitKey === ownUnitKey) continue;
    const { monster, gear } = resolveSelectorRaw(sel, data);
    if (sel.source !== 'box' && ownCom2usId != null && monster?.com2usId === ownCom2usId) continue;
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

/* --------------------------------------------------------------------------
 * Listes de travail (Lot 3, voir spec/outils/optimizer/historique-import-
 * monstres-a-optimiser.md) — conteneurs LIBRES créés par l'utilisateur, PAS
 * de liste fixe (Box/RTA/Défense siège ne sont plus des cas spéciaux : c'est
 * l'utilisateur qui décide quels monstres partagent un même pool de runes,
 * ex. une liste par deck d'offense siège, une pour tout son RTA…). Une liste
 * n'a que ce que le joueur y met : rien n'est pré-rempli à la création.
 * ----------------------------------------------------------------------- */
export interface OptimizerList {
  id: string;
  name: string;
}

// Un exemplaire ajouté à une liste (« Inclure à la liste ») — indépendant de
// savoir s'il a déjà un build VALIDÉ (voir ValidatedBuild plus bas) : on peut
// suivre un monstre dans une liste avant même d'avoir lancé une recherche
// pour lui.
export interface OptimizerListMember {
  listId: string;
  selector: ExclusionSelector;
}

/* --------------------------------------------------------------------------
 * Runes VALIDÉES — « Monstres déjà runés » (fusionné dans la zone C d'une
 * liste, Lot 3). 3ᵉ mécanisme d'exclusion, distinct des deux ci-dessus : ni
 * un périmètre entier (AUTO), ni une entrée du compte lue dynamiquement
 * (MANUEL, `ExclusionSelector` résolu à chaque calcul contre le gear ACTUEL)
 * — un build qu'on vient de TROUVER par la recherche, dont les 6 `runeIds`
 * sont un INSTANTANÉ figé au moment de la validation (voir
 * `BuildCandidate.runeIds`, runeBuildOptim.ts), pas re-dérivés du gear
 * courant de l'exemplaire.
 * ⚠️ **Scopé PAR LISTE** (`listId`) — une rune physique ne peut être portée
 * que par UN monstre à la fois, mais SEULEMENT au sein d'un même pool réel
 * (une même liste). Deux decks d'offense siège sont deux presets appliqués
 * MOMENTANÉMENT, jamais simultanément : leurs runes validées ne se bloquent
 * pas entre elles (voir « Suite — cadrage du Lot 3 » pour le détail complet
 * du modèle de rareté). Upsert par PAIRE `(listId, selector)`, pas par
 * `selector` seul : le même exemplaire peut porter un build validé DIFFÉRENT
 * dans deux listes différentes.
 * ----------------------------------------------------------------------- */
export interface ValidatedBuild {
  listId: string;
  // Exemplaire précis (même granularité que ExclusionSelector) sur lequel ce
  // build a été validé — Box par `unitKey`, RTA/siège par espèce/slot.
  selector: ExclusionSelector;
  // Les 6 runes RÉELLEMENT possédées composant le build validé — un
  // INSTANTANÉ (voir l'en-tête), pas une référence recalculée : c'est
  // justement ce qui permet à `otherValidatedRuneIds` de bloquer ces runes
  // pour les AUTRES recherches sans dépendre de ce que porte CET exemplaire
  // dans le compte en ce moment (il n'a pas été réellement réruné en jeu).
  runeIds: number[];
}

// Runes validées de TOUS LES AUTRES exemplaires de LA MÊME LISTE — jamais
// les siennes propres (auto-exemption, même principe que
// `resolveExcludedRuneIds`/`autoExcludedRuneIds`), jamais celles d'une AUTRE
// liste (pools indépendants, voir l'en-tête) : sans l'auto-exemption,
// relancer une recherche sur un monstre déjà validé s'auto-bloquerait avec
// ses propres runes. `listId` null (aucune liste active) → rien à bloquer.
export function otherValidatedRuneIds(validated: ValidatedBuild[], listId: string | null, ownSelectorKey: string | null): Set<number> {
  const out = new Set<number>();
  if (listId == null) return out;
  for (const v of validated) {
    if (v.listId !== listId) continue;
    if (ownSelectorKey != null && exclusionSelectorKey(v.selector) === ownSelectorKey) continue;
    for (const id of v.runeIds) out.add(id);
  }
  return out;
}

// Le build validé de CET exemplaire précis DANS CETTE LISTE, s'il en a un —
// sert à savoir s'il faut afficher le badge « validé » et à substituer les
// runes affichées dans la fiche (voir OptimizerSection.tsx, `selected`).
// `listId` null → jamais de résultat (rien n'est validé hors d'une liste).
export function findValidatedBuild(validated: ValidatedBuild[], listId: string | null, selectorKey: string | null): ValidatedBuild | undefined {
  if (listId == null || selectorKey == null) return undefined;
  return validated.find((v) => v.listId === listId && exclusionSelectorKey(v.selector) === selectorKey);
}

// Revérifie chaque build validé contre le compte ACTUELLEMENT chargé (après
// réimport, voir App.tsx) — un sélecteur qui ne résout plus (monstre
// fusionné/retiré de RTA/deck modifié) OU dont les runes validées ne sont
// plus TOUTES portées par cet exemplaire (runes déplacées, vendues, reforgées
// ailleurs depuis) est abandonné : le garder afficherait un build « validé »
// qui n'a plus rien à voir avec le compte réel. ⚠️ Jamais silencieux — voir
// son appelant (App.tsx), qui avertit l'utilisateur du nombre abandonné
// plutôt que de les perdre sans un mot (point bloquant 4 du cadrage).
// ⚠️ `allRuneIds` (le POOL COMPLET du compte, équipé et non équipé — voir
// OptimizerSection.tsx, `runes`) — nécessaire UNIQUEMENT pour un sélecteur
// `unowned` : son `gear.runes` résolu est TOUJOURS vide (pas d'exemplaire
// réel à comparer), donc la question posée diffère de celle des exemplaires
// réels — pas « ces runes sont-elles encore PORTÉES par lui », mais « ces
// runes EXISTENT-elles encore dans le compte » (ni vendues ni reforgées
// depuis). Plus faible que la vérification « toujours porté » d'un
// exemplaire réel (ne détecte pas une rune réattribuée à un AUTRE monstre
// réel depuis) — limite assumée, documentée dans spec/outils/optimizer/.
export function revalidateBuilds(validated: ValidatedBuild[], data: ExclusionSourceData, allRuneIds: Set<number>): { kept: ValidatedBuild[]; droppedCount: number } {
  const kept: ValidatedBuild[] = [];
  let droppedCount = 0;
  for (const v of validated) {
    const resolved = resolveExclusionEntry(v.selector, data);
    const stillValid =
      v.selector.source === 'unowned'
        ? resolved != null && v.runeIds.every((id) => allRuneIds.has(id))
        : (() => {
            const currentIds = new Set((resolved?.gear.runes ?? []).map((r) => r.id));
            return resolved != null && v.runeIds.every((id) => currentIds.has(id));
          })();
    if (stillValid) kept.push(v);
    else droppedCount++;
  }
  return { kept, droppedCount };
}

// Même principe que `revalidateBuilds`, mais pour l'appartenance à une liste
// (`OptimizerListMember`) — plus léger : seul le sélecteur doit encore
// résoudre, aucune rune à comparer (être MEMBRE d'une liste n'implique pas
// d'avoir un build validé, voir OptimizerListMember). Réutilisée telle
// quelle par App.tsx au réimport, à côté de `revalidateBuilds`.
export function revalidateMembers(members: OptimizerListMember[], data: ExclusionSourceData): { kept: OptimizerListMember[]; droppedCount: number } {
  const kept: OptimizerListMember[] = [];
  let droppedCount = 0;
  for (const m of members) {
    if (resolveExclusionEntry(m.selector, data)) kept.push(m);
    else droppedCount++;
  }
  return { kept, droppedCount };
}

