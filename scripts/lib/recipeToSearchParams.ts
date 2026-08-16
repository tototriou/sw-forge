// Combine une RECETTE exportée depuis l'écran (src/lib/optimizerRecipe.ts)
// avec un monstre chargé (loadMonster.ts) pour reconstruire le `SearchParams`
// EXACT que l'app enverrait au moteur — même logique que les useMemos
// `searchArtifacts`/`pool`/`slotFilterCap` de OptimizerSection.tsx, tenue à
// UN SEUL endroit (SLOT_FILTER_PRESETS/ARTIFACT_MAIN_VALUE viennent de
// runeBuildOptim.ts, pas d'une copie locale) pour qu'un script ne puisse
// plus diverger silencieusement de l'écran comme c'est arrivé cette session.

import {
  SearchParams,
  SlotFilterPresetKey,
  SLOT_FILTER_PRESETS,
  ARTIFACT_MAIN_VALUE,
  excludedRuneIds,
} from '../../src/lib/runeBuildOptim';
import { OptimizerRecipe } from '../../src/lib/optimizerRecipe';
import { ArtifactDetail, ArtifactKind, GearSet, RuneDetail } from '../../src/types';
import { LoadedMonster } from './loadMonster';

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

// Même logique que `pool` (OptimizerSection.tsx) : `exploreAll` coché (défaut
// de l'écran) → tout l'inventaire ; décoché → exclut les runes déjà portées
// par un AUTRE monstre de la box. `boxForExclusion` n'est nécessaire que
// dans ce second cas — omis, `exploreAll=false` lève une erreur explicite
// plutôt que de silencieusement retomber sur le pool complet.
export function resolvePool(
  recipe: OptimizerRecipe,
  loaded: LoadedMonster,
  boxForExclusion?: { unitKey: string; com2usId: number | null; gear?: GearSet }[]
): RuneDetail[] {
  if (recipe.exploreAll) return loaded.allRunes;
  if (!boxForExclusion) {
    throw new Error(
      "recipe.exploreAll=false : il faut fournir boxForExclusion (la box complète) pour reproduire fidèlement l'exclusion des runes portées ailleurs."
    );
  }
  const excluded = excludedRuneIds(boxForExclusion, loaded.com2usId);
  return excluded.size === 0 ? loaded.allRunes : loaded.allRunes.filter((r) => !excluded.has(r.id));
}

const HARD_TIMEOUT_MS = 10 * 60 * 1000; // ⚠️ IDENTIQUE à HARD_TIMEOUT_MS (OptimizerSection.tsx).

export function recipeToSearchParams(
  recipe: OptimizerRecipe,
  loaded: LoadedMonster,
  boxForExclusion?: { unitKey: string; com2usId: number | null; gear?: GearSet }[]
): SearchParams {
  return {
    base: loaded.gear.base,
    artifacts: resolveArtifacts(recipe, loaded),
    relic: loaded.gear.relic,
    pool: resolvePool(recipe, loaded, boxForExclusion),
    requirement: recipe.requirement,
    metric: recipe.metric,
    objective: recipe.objective,
    // ⚠️ `?? false` : une recette exportée avant l'ajout de ce réglage n'a pas
    // ce champ — même repli que `importRecipe` (OptimizerSection.tsx).
    maxMs: (recipe.exhaustiveSearch ?? false) ? Number.POSITIVE_INFINITY : HARD_TIMEOUT_MS,
    slotFilterCap: resolveSlotFilterCap(recipe.slotFilterPreset),
    adaptiveTrancheWeighting: recipe.adaptiveTrancheWeighting,
  };
}
