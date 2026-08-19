// « Recette » de recherche Optimizer : tout ce qui décrit CE QU'ON DEMANDE
// (set, minimums, objectif, réglages) — jamais le POOL de runes ni le compte,
// qui appartiennent à qui la lance. C'est ce qui rend le fichier partageable
// entre joueurs (chacun l'applique à son propre inventaire) et réutilisable
// tel quel par un script Node (voir scripts/lib/) sans jamais avoir à
// retranscrire à la main ce que l'écran a déjà calculé correctement — la
// source de toutes les erreurs de fidélité rencontrées en investiguant le
// cas Sonia (conversion bonus/total oubliée, défaut d'écran périmé…).
//
// ⚠️ Exporté tel que CONSTRUIT par l'écran (le `requirement` envoyé au
// moteur), jamais les valeurs AFFICHÉES : `requirement.minStats`/`maxStats`
// sont déjà en TOTAL (voir OptimizerSection.tsx, conversion bonus→total à la
// saisie) — un fichier qui stockait l'affiché obligerait quiconque le relit
// à connaître la base du monstre pour le réinterpréter, une source d'erreur
// de plus, pas de moins.
import { BuildRequirement, Objective } from './runeBuildOptim';
import { AutoExclusionScope, ExclusionSelector } from './optimizerExclusion';
import { ArtifactKind } from '../types';
import { ArtifactMainChoice, SlotFilterPresetKey } from '../hooks/useOptimizerState';
import { RuneMetric } from '../hooks/useRuneMetric';

export const OPTIMIZER_RECIPE_VERSION = 1;

// ⚠️ **Deux constructeurs, PAS un seul — un champ ajouté ici doit être
// branché dans les DEUX, sinon un script diverge de l'écran en silence
// (aucune erreur `tsc`, le champ manquant reste un type optionnel valide).
// Incident vécu : `exhaustiveSearch` branché dans OptimizerSection.tsx
// (l'écran) mais oublié dans recipeToSearchParams.ts, repéré seulement
// parce que l'utilisateur a posé la question — voir spec/README.md,
// « Conventions communes », pour la règle générale.
// 1. `OptimizerSection.tsx` — `exportRecipe`/`importRecipe`/`handleSearch`
//    (l'écran, source de vérité).
// 2. `scripts/lib/recipeToSearchParams.ts` — `recipeToSearchParams` (rejoue
//    une recette depuis un script, utilisé par `scripts/optimizer-search.ts`).
export interface OptimizerRecipe {
  version: typeof OPTIMIZER_RECIPE_VERSION;
  // Pour readabilité humaine et pour retrouver le monstre à l'import — le
  // nom seul ne suffit pas (traductions, homonymes potentiels), le com2usId
  // est la clé stable côté données du jeu.
  monsterCom2usId: number;
  monsterName: string;
  requirement: BuildRequirement;
  objective: Objective;
  metric: RuneMetric;
  slotFilterPreset: SlotFilterPresetKey;
  adaptiveTrancheWeighting: boolean;
  exhaustiveSearch: boolean;
  // ⚠️ Remplace l'ancien `exploreAll` (COCHÉ par défaut, portait uniquement
  // sur la box, signification inverse) — voir OptimizerSection.tsx pour le
  // repli de lecture appliqué aux recettes exportées AVANT ce renommage.
  excludeUsedRunes: boolean;
  excludeUsedScope: AutoExclusionScope;
  // ⚠️ Comme `monsterCom2usId`/`excludeUsedRunes` : des IDENTIFIANTS re-résolus
  // contre le compte de qui importe, jamais les runes elles-mêmes (voir
  // resolveExcludedRuneIds, optimizerExclusion.ts) — un sélecteur introuvable
  // chez l'importeur (monstre absent, deck différent…) est silencieusement
  // ignoré, pas une erreur. Ne casse donc pas la règle de tête de ce fichier.
  excludedSelectors: ExclusionSelector[];
  ignoreArtifacts: boolean;
  artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
}

export function buildOptimizerRecipe(input: Omit<OptimizerRecipe, 'version'>): OptimizerRecipe {
  return { version: OPTIMIZER_RECIPE_VERSION, ...input };
}

export interface RecipeValidationResult {
  recipe: OptimizerRecipe | null;
  error?: string;
}

// Lecture défensive : un fichier édité à la main ou corrompu ne doit jamais
// planter, seulement échouer proprement — même esprit que validateRtaImport
// (rtaShare.ts), une discipline déjà établie ailleurs dans l'app pour tout
// import de fichier utilisateur.
export function parseOptimizerRecipe(text: string): RecipeValidationResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { recipe: null, error: "Fichier illisible : ce n'est pas du JSON valide." };
  }
  if (typeof data !== 'object' || data === null) {
    return { recipe: null, error: 'Fichier invalide : objet JSON attendu.' };
  }
  const d = data as Record<string, unknown>;
  if (d.version !== OPTIMIZER_RECIPE_VERSION) {
    return { recipe: null, error: `Version de recette non prise en charge : ${String(d.version)}.` };
  }
  if (typeof d.monsterCom2usId !== 'number' || typeof d.requirement !== 'object' || d.requirement === null) {
    return { recipe: null, error: 'Fichier invalide : champs obligatoires manquants.' };
  }
  return { recipe: d as unknown as OptimizerRecipe };
}
