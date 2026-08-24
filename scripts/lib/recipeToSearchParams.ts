// Combine une RECETTE exportée depuis l'écran (src/lib/optimizerRecipe.ts)
// avec un monstre chargé (loadMonster.ts) pour reconstruire le `SearchParams`
// EXACT que l'app enverrait au moteur — même logique que les useMemos
// `searchArtifacts`/`pool`/`slotFilterCap` de OptimizerSection.tsx, tenue à
// UN SEUL endroit (SLOT_FILTER_PRESETS/ARTIFACT_MAIN_VALUE viennent de
// runeBuildOptim.ts, pas d'une copie locale) pour qu'un script ne puisse
// plus diverger silencieusement de l'écran comme c'est arrivé cette session.

import { SearchParams, SlotFilterPresetKey, SLOT_FILTER_PRESETS, ARTIFACT_MAIN_VALUE } from '../../src/lib/runeBuildOptim';
import { ExclusionSourceData, autoExcludedRuneIds, resolveExcludedRuneIds } from '../../src/lib/optimizerExclusion';
import { OptimizerRecipe } from '../../src/lib/optimizerRecipe';
import {
  DEFAULT_DAMAGE_SETUP,
  damageRelevantStats,
  monsterBonusDegatsSelonVit,
  monsterCritSiPlusRapide,
  monsterDamageSkills,
  monsterOffensivePassives,
  resolveDamageSkill,
} from '../../src/lib/damage';
import { StatKey } from '../../src/lib/effects';
import { ArtifactDetail, ArtifactKind, RuneDetail } from '../../src/types';
import { LoadedMonster } from './loadMonster';
import { loadMonsterSkills } from './skillsData';

export function resolveSlotFilterCap(preset: SlotFilterPresetKey): number {
  const found = SLOT_FILTER_PRESETS.find((p) => p.key === preset);
  if (!found) throw new Error(`Préréglage de pré-filtrage inconnu : ${preset}`);
  return found.cap;
}

// Même logique que `searchArtifacts` (OptimizerSection.tsx) : `'equipped'`
// reprend l'artéfact réellement porté par CE monstre à cet emplacement,
// `'none'` le retire, un code numérique hypothèque une stat différente.
export function resolveArtifacts(recipe: OptimizerRecipe, loaded: LoadedMonster): ArtifactDetail[] {
  if (recipe.ignoreArtifacts) return [];
  const out: ArtifactDetail[] = [];
  for (const kind of Object.keys(recipe.artifactMainByKind) as ArtifactKind[]) {
    const choice = recipe.artifactMainByKind[kind] ?? 'equipped';
    if (choice === 'none') continue;
    if (choice === 'equipped') {
      const real = loaded.gear.artifacts.find((a) => a.kind === kind);
      if (real) out.push(real);
      continue;
    }
    out.push({ kind, level: 1, rarity: 5, main: { code: choice, value: ARTIFACT_MAIN_VALUE[choice] }, subs: [] });
  }
  return out;
}

// Même logique que `pool` (OptimizerSection.tsx) : `excludeUsedRunes` coché
// → exclut les runes déjà utilisées dans `recipe.excludeUsedScope` (RTA/
// Défenses siège/Box, un seul à la fois — voir `autoExcludedRuneIds`) ;
// décoché (défaut de l'écran) → tout l'inventaire. `exclusionData` (box +
// RTA + siège + monsterById) n'est nécessaire que si `excludeUsedRunes` est
// coché OU si `excludedSelectors` (exclusion MANUELLE, voir
// optimizerExclusion.ts) n'est pas vide — omis dans l'un ou l'autre cas,
// une erreur explicite plutôt qu'un repli silencieux sur le pool complet.
// ⚠️ `String(loaded.unitId)` : même format que `BoxItem.key` (voir son
// usage dans `resolveExcludedRuneIds`) — `loaded.unitId=-1` en RTA/siège
// (voir `loadRtaMonster`/`loadSiegeMonster`) est sans effet, cette garde ne
// compte que pour le périmètre box. Même correctif que
// `scripts/optimizer-search.ts` (commit `46867d7`) — signature à 4
// arguments obligatoires (`optimizerExclusion.ts`), sans défaut, invisible
// à `tsc --noEmit` (scripts/ hors du périmètre `tsconfig.json`).
export function resolvePool(
  recipe: OptimizerRecipe,
  loaded: LoadedMonster,
  exclusionData?: ExclusionSourceData
): RuneDetail[] {
  const auto = recipe.excludeUsedRunes
    ? (() => {
        if (!exclusionData) {
          throw new Error(
            'recipe.excludeUsedRunes=true : il faut fournir exclusionData (box + RTA + siège chargés) pour reproduire fidèlement cette exclusion automatique.'
          );
        }
        return autoExcludedRuneIds(recipe.excludeUsedScope, exclusionData, loaded.com2usId);
      })()
    : new Set<number>();
  const manual = (() => {
    if (recipe.excludedSelectors == null || recipe.excludedSelectors.length === 0) return new Set<number>();
    if (!exclusionData) {
      throw new Error(
        'recipe.excludedSelectors non vide : il faut fournir exclusionData (box + RTA + siège chargés) pour reproduire fidèlement ces exclusions manuelles.'
      );
    }
    return resolveExcludedRuneIds(recipe.excludedSelectors, exclusionData, String(loaded.unitId), loaded.com2usId);
  })();
  if (auto.size === 0 && manual.size === 0) return loaded.allRunes;
  return loaded.allRunes.filter((r) => !auto.has(r.id) && !manual.has(r.id));
}

// Stats à privilégier au pré-filtrage quand l'objectif est « Dégâts réels » —
// elles dépendent du SORT choisi, pas seulement du nom de l'objectif.
//
// ⚠️ Même logique que `objectiveStats` (OptimizerSection.tsx), et surtout
// **les mêmes fonctions** : `resolveDamageSkill` + `damageRelevantStats`
// (src/lib/damage.ts). Rien n'est réimplémenté ici — c'est précisément le
// genre de recopie qui a déjà fait diverger un script de l'écran en silence
// (voir spec/README.md, « Conventions communes »).
export function resolveObjectiveStats(recipe: OptimizerRecipe, loaded: LoadedMonster): StatKey[] | undefined {
  if (recipe.objective !== 'degats_reels') return undefined;
  const detail = loadMonsterSkills(loaded.com2usId);
  const skills = monsterDamageSkills(detail);
  // ⚠️ `?? null` : une recette exportée AVANT ce champ n'a pas de
  // `damageSetup` — repli sur le sort par défaut, comme à l'import d'écran.
  const profile = resolveDamageSkill(skills, recipe.damageSetup?.skillCom2usId ?? null);
  // Mêmes passifs offensifs que l'écran (OptimizerSection.tsx) — sinon le
  // pré-filtrage CLI serait plus étroit que celui de l'écran pour la même
  // recette dès qu'un passif utilise une stat absente du sort de base. Même
  // chose pour les deux modificateurs monstre-wide liés à la VIT
  // (`critSiPlusRapide`/`bonusDegatsSelonVit`) : sans eux, un monstre comme
  // Sonia (dont AUCUN sort actif ne dépend de la VIT) ne verrait jamais la
  // VIT privilégiée par le CLI, contrairement à l'écran.
  const passifs = monsterOffensivePassives(detail);
  return damageRelevantStats(
    profile,
    passifs,
    recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,
    monsterCritSiPlusRapide(detail),
    monsterBonusDegatsSelonVit(detail)
  );
}

const HARD_TIMEOUT_MS = 10 * 60 * 1000; // ⚠️ IDENTIQUE à HARD_TIMEOUT_MS (OptimizerSection.tsx).

export function recipeToSearchParams(
  recipe: OptimizerRecipe,
  loaded: LoadedMonster,
  exclusionData?: ExclusionSourceData
): SearchParams {
  return {
    base: loaded.gear.base,
    artifacts: resolveArtifacts(recipe, loaded),
    relic: loaded.gear.relic,
    pool: resolvePool(recipe, loaded, exclusionData),
    requirement: recipe.requirement,
    metric: recipe.metric,
    objective: recipe.objective,
    objectiveStats: resolveObjectiveStats(recipe, loaded),
    // ⚠️ `?? false` : une recette exportée avant l'ajout de ce réglage n'a pas
    // ce champ — même repli que `importRecipe` (OptimizerSection.tsx).
    maxMs: (recipe.exhaustiveSearch ?? false) ? Number.POSITIVE_INFINITY : HARD_TIMEOUT_MS,
    slotFilterCap: resolveSlotFilterCap(recipe.slotFilterPreset),
    adaptiveTrancheWeighting: recipe.adaptiveTrancheWeighting,
  };
}
