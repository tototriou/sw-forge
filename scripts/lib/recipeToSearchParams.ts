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
import { computeStats, statsParPaire } from '../../src/lib/stats';
import { artifactDamageProfile, codesAmplificationActifs, computeTotalDamage } from '../../src/lib/damage';
import { bornesArtefacts, paireRepresentative, type BornesArtefacts, type ChoixPrincipale } from '../../src/lib/artifactOptim';
import { buildRealDamageContext } from './realDamageCli';
import { loadMonstersList } from './monstersData';
import { StatKey } from '../../src/lib/effects';
import { ArtifactDetail, ArtifactKind, RuneDetail } from '../../src/types';
import { PorteurArtefact } from '../../src/lib/artifacts';
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
/**
 * ⚠️ **Ce chemin NE bascule PAS « equipped » → « libre » sur un compte
 * différent, contrairement à l'écran — et c'est délibéré.**
 *
 * `importRecipe` le fait parce qu'un joueur qui reçoit une recette veut
 * reproduire une INTENTION sur son propre inventaire : « garde ce que tu
 * portes » n'y transporte rien d'utile. Ici, l'appelant désigne
 * EXPLICITEMENT le compte sur la ligne de commande, presque toujours pour
 * rejouer un cas signalé — avec l'export de celui qui l'a signalé. Basculer
 * rendrait la reproduction moins fidèle, pas plus.
 *
 * `recipe.wizardName` est donc volontairement ignoré ici. Ne pas « corriger »
 * en croyant à un oubli de propagation.
 */
export function resolveArtifacts(recipe: OptimizerRecipe, loaded: LoadedMonster): ArtifactDetail[] {
  // ⚠️ **`ignoreArtifacts` coupe la RECHERCHE, pas les artéfacts.** Le monstre
  // garde les pièces qu'il porte réellement et leurs statistiques : ce drapeau
  // retirait avant TOUTE contribution d'artéfact, ce qui rendait les conditions
  // minimales plus dures à franchir sans que rien ne le dise. Le champ garde
  // son nom (format de recette stable) ; c'est l'écran qui l'expose désormais
  // à l'endroit, « Activer l'optimisation d'artéfacts ».
  if (recipe.ignoreArtifacts) return loaded.gear.artifacts;
  const reelle = paireReelle(recipe, loaded);
  if (reelle) return reelle;
  // Espèce introuvable, ou objectif « Dégâts réels » sans sort calculable : on
  // ne sait pas noter une paire. Repli sur l'ancien comportement plutôt que sur
  // une paire arbitraire.
  const out: ArtifactDetail[] = [];
  for (const kind of Object.keys(recipe.artifactMainByKind) as ArtifactKind[]) {
    // ⚠️ `'libre'` : le MÊME défaut que `candidatsParSorte` (artifactOptim.ts)
    // et que le sélecteur de l'écran. Sans effet sur CE repli — les deux crans
    // y gardent la pièce portée, faute d'inventaire exploitable — mais un
    // défaut qui diverge d'un fichier à l'autre finit toujours par être lu
    // quelque part où il compte.
    const choice = recipe.artifactMainByKind[kind] ?? 'libre';
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
    // ⚠️ Un seul `computeStats` pour toutes les paires — voir `statsParPaire`.
    const statsAvec = statsParPaire(loaded.gear);
    evaluer = (arts) =>
      computeTotalDamage(
        ctx.profile,
        ctx.passifs,
        statsAvec(arts),
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

  return paireRepresentative(
    paramsArtefacts(recipe, loaded, { element: espece.element, archetype: espece.archetype }, evaluer)
  );
}

/**
 * L'`ArtifactSearchParams` du CLI — factorisé pour que la paire supposée
 * (`paireReelle`) et les bornes de faisabilité (`resolveArtifactBounds`)
 * partent EXACTEMENT du même contexte.
 *
 * ⚠️ **Second constructeur d'`ArtifactSearchParams`** (l'autre est
 * `artifactParams`, OptimizerSection.tsx). Un champ ajouté là-bas doit l'être
 * ici — `tsc` ne le dira pas tant qu'il reste optionnel (voir CLAUDE.md,
 * « un type partagé a PLUSIEURS constructeurs »).
 */
function paramsArtefacts(
  recipe: OptimizerRecipe,
  loaded: LoadedMonster,
  porteur: PorteurArtefact,
  evaluer: (arts: ArtifactDetail[]) => number
): Parameters<typeof paireRepresentative>[0] {
  return {
    porteur,
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
    // ⚠️ Sans cette ligne, le CLI élaguerait des artéfacts que l'écran garde,
    // et ne reproduirait donc pas la même paire supposée. Une amplification de
    // buff est invisible à la sonde de pertinence — voir
    // `codesAmplificationActifs` (damage.ts).
    codesAmplification: codesAmplificationActifs(recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP),
    evaluer,
  };
}

/**
 * Ce que l'INVENTAIRE d'artéfacts peut apporter, borné des deux côtés — ce qui
 * décide désormais de la FAISABILITÉ (voir `SearchParams.artifactBounds`).
 *
 * ⚠️ Pendant EXACT de `searchArtifactBounds` (OptimizerSection.tsx). Le CLI
 * doit produire les mêmes bornes que l'écran, sinon il rejouerait un moteur
 * plus contraint que celui qui tourne réellement — exactement le genre de
 * divergence silencieuse que ce fichier existe pour empêcher.
 *
 * `undefined` quand la recette ignore les artéfacts, quand l'espèce est
 * introuvable, ou quand aucune condition n'est posée : le moteur retombe alors
 * sur l'apport de la paire représentative, comportement d'avant le §12.
 */
export function resolveArtifactBounds(
  recipe: OptimizerRecipe,
  loaded: LoadedMonster
): BornesArtefacts | undefined {
  // ⚠️ Sans recherche, il n'y a qu'UNE paire possible : celle qui est portée.
  // `undefined` fait retomber le moteur sur son apport, des deux côtés — c'est
  // exactement la borne juste, et il n'y a rien à balayer.
  if (recipe.ignoreArtifacts) return undefined;
  const espece = loadMonstersList().find((m) => m.com2usId === loaded.com2usId);
  if (!espece) return undefined;
  const avecMinimum = (Object.keys(recipe.requirement.minStats) as StatKey[]).filter(
    (k) => (recipe.requirement.minStats[k] ?? 0) > 0
  );
  const avecMaximum = (Object.keys(recipe.requirement.maxStats ?? {}) as StatKey[]).filter(
    (k) => (recipe.requirement.maxStats?.[k] ?? 0) > 0
  );
  if (avecMinimum.length === 0 && avecMaximum.length === 0) return undefined;
  // ⚠️ L'`evaluer` passé ici n'a aucune importance : `bornesArtefacts` le
  // remplace par l'apport de chaque stat. Seuls comptent les AUTRES champs
  // (éligibilité, filtre de principale, verrous, amplifications).
  const params = paramsArtefacts(
    recipe,
    loaded,
    { element: espece.element, archetype: espece.archetype },
    (arts) => arts.reduce((n, a) => n + a.main.value, 0)
  );
  return bornesArtefacts(params, avecMinimum, avecMaximum);
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
    // ⚠️ **Troisième constructeur de `artifactBounds`** (les autres :
    // `searchArtifactBounds` dans OptimizerSection.tsx, et le repli du moteur
    // quand il est absent). Sans cette ligne, le CLI figerait le choix
    // d'artéfact avant la recherche là où l'écran ne le fige plus — il
    // rejouerait donc un moteur qui n'existe plus, en silence.
    artifactBounds: resolveArtifactBounds(recipe, loaded),
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
