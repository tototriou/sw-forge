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
  monsterBonusDegatsSelonCr,
  monsterBonusDegatsSelonDef,
  monsterBonusDegatsSelonVit,
  monsterBonusSiAtqSeuil,
  monsterBonusEcartDef,
  monsterBonusFixeMaxHpPropre,
  monsterBonusSacrifice,
  monsterCritRateSelonVit,
  monsterCritSiPlusRapide,
  monsterDamageSkills,
  monsterOffensivePassives,
  resolveDamageSkill,
} from '../../src/lib/damage';
import { computeStats } from '../../src/lib/stats';
import { artifactDamageProfile, computeTotalDamage } from '../../src/lib/damage';
import { paireRepresentative, type ChoixPrincipale } from '../../src/lib/artifactOptim';
import { buildRealDamageContext } from './realDamageCli';
import { loadMonstersList } from './monstersData';
import { StatKey } from '../../src/lib/effects';
import { ArtifactDetail, ArtifactKind, RuneDetail } from '../../src/types';
import { LoadedMonster } from './loadMonster';
import { loadMonsterSkills } from './skillsData';

export function resolveSlotFilterCap(preset: SlotFilterPresetKey): number {
  const found = SLOT_FILTER_PRESETS.find((p) => p.key === preset);
  if (!found) throw new Error(`Préréglage de pré-filtrage inconnu : ${preset}`);
  return found.cap;
}

/**
 * La paire d'artéfacts SUPPOSÉE pendant la recherche de runes.
 *
 * ⚠️ **Le sélecteur de stat principale FILTRE l'inventaire, il n'hypothèque
 * plus.** Il servait à l'origine de « et si j'avais un artéfact PV+1500 ? » et
 * fabriquait pour cela une pièce à `subs: []`. En « Dégâts réels », cette
 * pièce faisait calculer les dégâts SANS aucune ligne d'effet — ni
 * renforcement d'ATQ, ni dégâts additionnels, ni points de Dgts Crit
 * conditionnels — quand « Comme équipé » les comptait : deux réglages voisins,
 * deux modèles de dégâts, sans que rien ne le signale.
 *
 * Le cran désigne donc désormais **vos artéfacts réels portant cette
 * principale**, avec leurs lignes. Décision explicite de l'utilisateur, prise
 * en connaissance du « et si… » perdu.
 *
 * ⚠️ Conséquence assumée : sans aucun artéfact éligible portant la principale
 * demandée, l'emplacement reste VIDE au lieu d'être hypothéqué. On ne peut pas
 * équiper ce qu'on ne possède pas.
 *
 * ⚠️ **Le score dépend de l'objectif, et le raccourci est légitime.**
 * `computeStats` (stats.ts:69) ne lit que la stat PRINCIPALE d'un artéfact,
 * jamais ses sous-propriétés : hors « Dégâts réels », deux artéfacts de même
 * principale ne se distinguent que par sa VALEUR, et prendre la plus haute est
 * exact — inutile de dérouler un modèle de dégâts qui n'entre pas dans le
 * score.
 */
export function resolveArtifacts(recipe: OptimizerRecipe, loaded: LoadedMonster): ArtifactDetail[] {
  if (recipe.ignoreArtifacts) return [];
  const reelle = paireReelle(recipe, loaded);
  if (reelle) return reelle;
  // Espèce introuvable, ou objectif « Dégâts réels » sans sort calculable : on
  // ne sait pas noter une paire. Repli sur l'ancien comportement plutôt que sur
  // une paire arbitraire.
  const out: ArtifactDetail[] = [];
  for (const kind of Object.keys(recipe.artifactMainByKind) as ArtifactKind[]) {
    const choice = recipe.artifactMainByKind[kind] ?? 'equipped';
    if (choice === 'none') continue;
    // ⚠️ `'libre'` n'a AUCUNE stat à hypothéquer — c'est « cherche parmi tous
    // les éligibles », ce que ce repli ne sait précisément pas faire. On garde
    // donc la pièce portée : la seule réponse défendable sans inventaire
    // exploitable, jamais une principale choisie arbitrairement.
    if (choice === 'equipped' || choice === 'libre') {
      const real = loaded.gear.artifacts.find((a) => a.kind === kind);
      if (real) out.push(real);
      continue;
    }
    // ⚠️ id 0 : pièce SYNTHÉTIQUE, elle n’existe pas dans le compte et ne doit
    // jamais être prise pour un artéfact réservable.
    out.push({ id: 0, kind, level: 1, rarity: 5, main: { code: choice, value: ARTIFACT_MAIN_VALUE[choice] }, subs: [] });
  }
  return out;
}

/**
 * La paire réelle que le Mode A choisirait pour l'ÉQUIPEMENT ACTUEL.
 *
 * ⚠️ **Évaluée sur le build courant, faute de mieux** : au moment où ces
 * paramètres se construisent, aucun build candidat n'existe encore. C'est un
 * représentant, pas la paire finale — d'où la revérification des minimums une
 * fois le vrai build trouvé (`respecteMinimums`).
 *
 * ⚠️ Les lignes verrouillées s'appliquent ICI aussi : chaque verrou mange un
 * emplacement de sous-propriété qui aurait pu porter une ligne de dégâts.
 * Une paire supposée qui les ignorerait noterait les candidats sur un
 * potentiel que la paire finale ne pourra pas atteindre.
 *
 * Rend `null` si aucun sort n'est calculable — l'appelant retombe alors sur
 * l'hypothèque.
 */
function paireReelle(recipe: OptimizerRecipe, loaded: LoadedMonster): ArtifactDetail[] | null {
  const espece = loadMonstersList().find((m) => m.com2usId === loaded.com2usId);
  if (!espece) return null;

  let evaluer: (arts: ArtifactDetail[]) => number;
  if (recipe.objective === 'degats_reels') {
    // ⚠️ Contexte construit avec l'équipement PORTÉ, uniquement pour obtenir le
    // profil de sort et les passifs — `artefacts` est recalculé par paire dans
    // `evaluer`, donc la valeur passée ici n'influence pas le choix.
    const ctx = buildRealDamageContext(recipe, loaded.com2usId, loaded.gear.artifacts);
    if (!ctx) return null;
    const setup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
    evaluer = (arts) =>
      computeTotalDamage(
        ctx.profile,
        ctx.passifs,
        computeStats({ ...loaded.gear, artifacts: arts }),
        setup,
        espece.element,
        artifactDamageProfile(arts)
      );
  } else {
    // ⚠️ Hors « Dégâts réels », la somme des principales SUFFIT et reste
    // exacte : les sous-propriétés d'artéfact n'entrent pas dans
    // `computeStats`, donc deux pièces de même principale ne se distinguent que
    // par sa valeur, et une valeur plus haute n'est jamais pire pour aucun de
    // ces objectifs. Dérouler un modèle de dégâts ici noterait sur un critère
    // qui n'est pas celui de la recherche.
    evaluer = (arts) => arts.reduce((n, a) => n + a.main.value, 0);
  }

  return paireRepresentative({
    porteur: { element: espece.element, archetype: espece.archetype },
    inventaire: loaded.allArtifacts,
    equipes: loaded.gear.artifacts,
    principaleParSorte: recipe.artifactMainByKind as Partial<Record<ArtifactKind, ChoixPrincipale>>,
    // ⚠️ `?? []` : une recette exportée AVANT ce champ ne le porte pas.
    //
    // ⚠️ Les verrous s'appliquent DÈS ICI, sur la paire supposée : chaque
    // ligne verrouillée mange un emplacement de sous-propriété qui aurait pu
    // porter une ligne de dégâts. Une paire supposée qui les ignorerait
    // noterait tous les candidats sur un potentiel que la paire finale ne
    // pourra pas atteindre.
    lignesVerrouillees: recipe.lignesVerrouillees ?? [],
    evaluer,
  });
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
    monsterBonusDegatsSelonVit(detail),
    monsterCritRateSelonVit(detail),
    monsterBonusEcartDef(detail),
    monsterBonusFixeMaxHpPropre(detail) != null || monsterBonusSacrifice(detail) != null,
    monsterBonusDegatsSelonCr(detail),
    monsterBonusDegatsSelonDef(detail),
    monsterBonusSiAtqSeuil(detail)
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
