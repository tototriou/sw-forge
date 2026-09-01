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
import { DamageSetup } from './damage';
import { AutoExclusionScope, ExclusionSelector } from './optimizerExclusion';
import { ArtifactKind } from '../types';
import { ArtifactMainChoice, SlotFilterPresetKey } from '../hooks/useOptimizerState';
import { LigneVerrouillee } from './artifactOptim';
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
/**
 * Les choix de principale d'une recette, adaptés au compte qui la LIT.
 *
 * ⚠️ **« Garder l'artéfact équipé » ne se partage pas.** Ce choix garde
 * l'artéfact porté par le LECTEUR, pas par l'auteur : chez quelqu'un d'autre,
 * il n'exporte aucune intention — il impose une pièce arbitraire, parfois sans
 * rapport avec la recherche décrite. Tout le reste d'une recette se re-résout
 * contre le compte du lecteur (le monstre par son `com2usId`, les runes par la
 * recherche) ; ce réglage était le seul à transporter silencieusement une
 * hypothèse locale. On bascule donc sur « Libre » — l'intention la plus
 * proche : cherche le meilleur artéfact parmi les tiens.
 *
 * ⚠️ **Uniquement quand on SAIT que les comptes diffèrent.** Recette sans
 * `wizardName` (exportée avant ce champ) ou compte local sans nom : aucune
 * comparaison possible, on ne touche à rien. Agir sur une provenance devinée
 * serait pire que de transporter la donnée telle quelle.
 *
 * Fonction PURE et exportée exprès : la logique vivait dans `importRecipe`,
 * une closure de composant qu'aucun test ne pouvait atteindre.
 */
export function mainsPourCeCompte(
  recipe: Pick<OptimizerRecipe, 'artifactMainByKind' | 'wizardName'>,
  accountName: string | null
): { mains: OptimizerRecipe['artifactMainByKind']; bascules: boolean } {
  const memeCompte = recipe.wizardName == null || accountName == null || recipe.wizardName === accountName;
  if (memeCompte) return { mains: recipe.artifactMainByKind, bascules: false };
  const entrees = Object.entries(recipe.artifactMainByKind);
  return {
    mains: Object.fromEntries(
      entrees.map(([k, v]) => [k, v === 'equipped' ? 'libre' : v])
    ) as OptimizerRecipe['artifactMainByKind'],
    bascules: entrees.some(([, v]) => v === 'equipped'),
  };
}

export interface OptimizerRecipe {
  version: typeof OPTIMIZER_RECIPE_VERSION;
  // Pour readabilité humaine et pour retrouver le monstre à l'import — le
  // nom seul ne suffit pas (traductions, homonymes potentiels), le com2usId
  // est la clé stable côté données du jeu.
  monsterCom2usId: number;
  monsterName: string;
  /**
   * Nom du joueur qui a exporté (`wizard_info.wizard_name`) — sert
   * UNIQUEMENT à reconnaître, à l'import, qu'une recette vient d'un AUTRE
   * compte.
   *
   * ⚠️ **Pourquoi c'est nécessaire** : « Garder l'artéfact équipé » garde
   * l'artéfact porté **par le lecteur**, pas par l'auteur. Chez quelqu'un
   * d'autre, ce réglage ne reproduit donc pas l'intention exportée — il
   * impose une pièce arbitraire, éventuellement sans rapport. `importRecipe`
   * bascule ce choix sur « Libre » quand les comptes diffèrent.
   *
   * ⚠️ Optionnel : une recette exportée AVANT ce champ n'en a pas. On ne
   * peut alors PAS savoir d'où elle vient, et on ne bascule rien — préserver
   * le comportement connu vaut mieux qu'agir sur une provenance devinée.
   */
  wizardName?: string | null;
  requirement: BuildRequirement;
  objective: Objective;
  // Réglage de l'objectif « Dégâts réels » — voir spec/outils/degats-reels.md.
  // ⚠️ Ne porte que le com2usId du SORT et les valeurs d'adversaire saisies,
  // jamais le profil de dégâts calculé : celui-ci se redéduit de la fiche du
  // monstre chez qui importe la recette, exactement comme `monsterCom2usId`
  // se re-résout contre sa box. Un sort introuvable (autre monstre, données
  // régénérées) retombe silencieusement sur le sort par défaut, jamais une
  // erreur — même tolérance que le reste de ce fichier.
  damageSetup: DamageSetup;
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
  // Sous-propriétés d'artéfact exigées, minimum lu sur la PAIRE.
  //
  // ⚠️ **OPTIONNEL, et il doit le rester** : une recette exportée avant ce
  // champ ne le porte pas. Tout lecteur applique `?? []` — voir
  // « Compatibilité arrière » dans le skill `optimizer-field-propagation`.
  //
  // ⚠️ Purement de la saisie (un code de sous-propriété du jeu et un nombre) :
  // rien à re-résoudre contre le compte de qui importe, contrairement à
  // `excludedSelectors`. La règle de tête de ce fichier tient.
  lignesVerrouillees?: LigneVerrouillee[];
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
