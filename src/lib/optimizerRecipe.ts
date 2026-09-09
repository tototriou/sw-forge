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
import { BuildRequirement, Objective, SLOT_FILTER_PRESETS, SLOT_MAIN_OPTIONS } from './runeBuildOptim';
import { DamageSetup } from './damage';
import { AutoExclusionScope, ExclusionSelector } from './optimizerExclusion';
import { ArtifactKind, RUNE_SETS } from '../types';
import { ArtifactMainChoice, SlotFilterPresetKey } from '../hooks/useOptimizerState';
import { LigneVerrouillee } from './artifactOptim';
import { RuneMetric } from '../hooks/useRuneMetric';
import { setsCost } from './effects';

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
  // ⚠️ **`'none'` a été RETIRÉ du sélecteur** — laisser un emplacement vide
  // pendant que l'autre cherche n'a aucun sens en jeu, et « ne pas compter les
  // artéfacts » se dit avec l'interrupteur, pour les DEUX emplacements à la
  // fois. Une recette exportée avant ce retrait peut encore le porter : on le
  // ramène sur « Libre », l'intention la plus proche (cherche le meilleur
  // parmi les tiens). ⚠️ TOUJOURS, avant même la question du compte : une
  // valeur qui n'existe plus ne doit atteindre aucun appelant.
  const normalisees = Object.fromEntries(
    Object.entries(recipe.artifactMainByKind).map(([k, v]) => [k, v === ('none' as unknown) ? 'libre' : v])
  ) as OptimizerRecipe['artifactMainByKind'];
  const memeCompte = recipe.wizardName == null || accountName == null || recipe.wizardName === accountName;
  if (memeCompte) return { mains: normalisees, bascules: false };
  const entrees = Object.entries(normalisees);
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

const OBJECTIFS_ACCEPTES = new Set(['efficience', 'ehp', 'vitesse', 'degats_reels', 'speed_nuker', 'degats']);
const METRIQUES_ACCEPTEES = new Set(['eff', 'score']);
const PRESETS_ACCEPTES = new Set<string>(SLOT_FILTER_PRESETS.map((p) => p.key));
const SETS_ACCEPTES = new Set(RUNE_SETS.map((s) => s.key));
const STATS_ACCEPTEES = new Set(['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc']);
const CHOIX_ARTEFACT_ACCEPTES = new Set<unknown>(['equipped', 'libre', 'none', 100, 101, 102]);

function estObjet(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function erreur(path: string, attente: string): string {
  return `Fichier invalide : ${path} ${attente}.`;
}

function validerNombre(value: unknown, path: string, entier = false): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || (entier && !Number.isInteger(value))) {
    return erreur(path, entier ? 'doit être un nombre entier fini' : 'doit être un nombre fini');
  }
  return null;
}

function validerRecordNumerique(value: unknown, path: string, entier = false): string | null {
  if (value === undefined) return null;
  if (!estObjet(value)) return erreur(path, 'doit être un objet indexé par identifiant de compétence');
  for (const [id, n] of Object.entries(value)) {
    if (!/^\d+$/.test(id) || Number(id) <= 0) return erreur(`${path}.${id}`, "utilise un identifiant de compétence invalide");
    const e = validerNombre(n, `${path}.${id}`, entier);
    if (e) return e;
    if ((n as number) < 0) return erreur(`${path}.${id}`, 'doit être positif ou nul');
  }
  return null;
}

function validerRecordBooleen(value: unknown, path: string): string | null {
  if (value === undefined) return null;
  if (!estObjet(value)) return erreur(path, 'doit être un objet indexé par identifiant de compétence');
  for (const [id, actif] of Object.entries(value)) {
    if (!/^\d+$/.test(id) || Number(id) <= 0) return erreur(`${path}.${id}`, "utilise un identifiant de compétence invalide");
    if (typeof actif !== 'boolean') return erreur(`${path}.${id}`, 'doit être un booléen');
  }
  return null;
}

function validerStats(value: unknown, path: string): string | null {
  if (!estObjet(value)) return erreur(path, 'doit être un objet de statistiques');
  for (const [stat, n] of Object.entries(value)) {
    if (!STATS_ACCEPTEES.has(stat)) return erreur(`${path}.${stat}`, 'désigne une statistique inconnue');
    const e = validerNombre(n, `${path}.${stat}`);
    if (e) return e;
    if ((n as number) < 0) return erreur(`${path}.${stat}`, 'doit être positif ou nul');
  }
  return null;
}

function validerDamageSetup(value: unknown): string | null {
  if (value === undefined) return null; // compatibilité : recettes antérieures aux dégâts réels
  if (!estObjet(value)) return erreur('damageSetup', 'doit être un objet');

  const setup = value;
  if (setup.skillCom2usId !== undefined && setup.skillCom2usId !== null) {
    const e = validerNombre(setup.skillCom2usId, 'damageSetup.skillCom2usId', true);
    if (e) return e;
  }
  for (const champ of ['enemyDef', 'enemyHp', 'enemyHpPct', 'enemySpd', 'leaderSpeedPct', 'velaskaPvPerduPct']) {
    if (setup[champ] !== undefined) {
      const e = validerNombre(setup[champ], `damageSetup.${champ}`);
      if (e) return e;
    }
  }
  for (const champ of [
    'atkBuff', 'defBuff', 'spdBuff', 'defBreak', 'defBreakParLeSort', 'brand', 'euldongActif', 'mirinaeActif',
    'deborahActif', 'miriamActif', 'transmissionActif', 'velaskaActif',
  ]) {
    if (setup[champ] !== undefined && typeof setup[champ] !== 'boolean') return erreur(`damageSetup.${champ}`, 'doit être un booléen');
  }
  if (setup.critMode !== undefined && !['moyenne', 'crit', 'normal'].includes(String(setup.critMode))) {
    return erreur('damageSetup.critMode', 'contient un mode de critique inconnu');
  }
  if (setup.summonerSkills !== undefined && !['aucune', 'combat', 'guilde'].includes(String(setup.summonerSkills))) {
    return erreur('damageSetup.summonerSkills', "contient un mode de compétences d'invocateur inconnu");
  }
  if (setup.enemyElement !== undefined && setup.enemyElement !== null && !['fire', 'water', 'wind', 'light', 'dark'].includes(String(setup.enemyElement))) {
    return erreur('damageSetup.enemyElement', 'contient un élément inconnu');
  }

  for (const champ of ['coupsPersonnalises', 'effetsCibleCount', 'buffsCibleCount', 'buffsPropresCount', 'compteurPersonnalise', 'effetsPropresCount']) {
    const e = validerRecordNumerique(setup[champ], `damageSetup.${champ}`, true);
    if (e) return e;
  }
  for (const champ of ['stackPersonnalise', 'pvActuelsAvantSacrificePct']) {
    const e = validerRecordNumerique(setup[champ], `damageSetup.${champ}`);
    if (e) return e;
  }
  const ePassifs = validerRecordBooleen(setup.passifsOffensifs, 'damageSetup.passifsOffensifs');
  if (ePassifs) return ePassifs;

  if (setup.scenariosEffetsEntreCoups !== undefined) {
    if (!estObjet(setup.scenariosEffetsEntreCoups)) {
      return erreur('damageSetup.scenariosEffetsEntreCoups', 'doit être un objet indexé par identifiant de compétence');
    }
    for (const [skillId, scenarioBrut] of Object.entries(setup.scenariosEffetsEntreCoups)) {
      const path = `damageSetup.scenariosEffetsEntreCoups.${skillId}`;
      if (!/^\d+$/.test(skillId) || Number(skillId) <= 0) return erreur(path, "utilise un identifiant de compétence invalide");
      if (!estObjet(scenarioBrut)) return erreur(path, 'doit être un objet');
      if (scenarioBrut.actif !== undefined && typeof scenarioBrut.actif !== 'boolean') return erreur(`${path}.actif`, 'doit être un booléen');
      if (
        scenarioBrut.presentsInitialement !== undefined &&
        (!Array.isArray(scenarioBrut.presentsInitialement) || scenarioBrut.presentsInitialement.some((effet) => typeof effet !== 'string'))
      ) {
        return erreur(`${path}.presentsInitialement`, 'doit être une liste de noms d’effets');
      }
      if (scenarioBrut.apresCoup !== undefined) {
        if (!estObjet(scenarioBrut.apresCoup)) return erreur(`${path}.apresCoup`, 'doit être un objet indexé par effet');
        for (const [effet, coup] of Object.entries(scenarioBrut.apresCoup)) {
          if (coup === null) continue;
          const e = validerNombre(coup, `${path}.apresCoup.${effet}`, true);
          if (e) return e;
          if ((coup as number) < 1) return erreur(`${path}.apresCoup.${effet}`, 'doit être supérieur ou égal à 1');
        }
      }
    }
  }
  return null;
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
  if (!estObjet(data)) {
    return { recipe: null, error: 'Fichier invalide : objet JSON attendu.' };
  }
  const d = data;
  if (d.version !== OPTIMIZER_RECIPE_VERSION) {
    return { recipe: null, error: `Version de recette non prise en charge : ${String(d.version)}.` };
  }
  if (typeof d.monsterCom2usId !== 'number' || !Number.isInteger(d.monsterCom2usId) || !estObjet(d.requirement)) {
    return { recipe: null, error: 'Fichier invalide : champs obligatoires manquants.' };
  }
  if (!OBJECTIFS_ACCEPTES.has(String(d.objective))) return { recipe: null, error: erreur('objective', 'contient une valeur inconnue') };
  if (!METRIQUES_ACCEPTEES.has(String(d.metric))) return { recipe: null, error: erreur('metric', 'contient une valeur inconnue') };
  if (!PRESETS_ACCEPTES.has(String(d.slotFilterPreset))) {
    return { recipe: null, error: erreur('slotFilterPreset', 'contient une valeur inconnue') };
  }

  const requirement = d.requirement;
  if (!Array.isArray(requirement.sets) || requirement.sets.some((set) => typeof set !== 'string' || !SETS_ACCEPTES.has(set))) {
    return { recipe: null, error: erreur('requirement.sets', 'doit être une liste de sets connus') };
  }
  if (setsCost(requirement.sets as string[]) > 6) {
    return { recipe: null, error: erreur('requirement.sets', 'demande plus de six runes') };
  }
  const minStatsErreur = validerStats(requirement.minStats, 'requirement.minStats');
  if (minStatsErreur) return { recipe: null, error: minStatsErreur };
  if (requirement.maxStats !== undefined) {
    const maxStatsErreur = validerStats(requirement.maxStats, 'requirement.maxStats');
    if (maxStatsErreur) return { recipe: null, error: maxStatsErreur };
  }
  if (requirement.mainStats !== undefined) {
    if (!estObjet(requirement.mainStats)) return { recipe: null, error: erreur('requirement.mainStats', 'doit être un objet') };
    for (const [slot, codes] of Object.entries(requirement.mainStats)) {
      if (!['2', '4', '6'].includes(slot) || !Array.isArray(codes) || codes.some((code) => typeof code !== 'number' || !SLOT_MAIN_OPTIONS[Number(slot) as 2 | 4 | 6].includes(code))) {
        return { recipe: null, error: erreur(`requirement.mainStats.${slot}`, 'contient une statistique principale invalide') };
      }
    }
  }
  if (requirement.lockedRunes !== undefined) {
    if (!estObjet(requirement.lockedRunes)) return { recipe: null, error: erreur('requirement.lockedRunes', 'doit être un objet') };
    for (const [slot, runeId] of Object.entries(requirement.lockedRunes)) {
      if (!/^[1-6]$/.test(slot) || typeof runeId !== 'number' || !Number.isInteger(runeId) || runeId <= 0) {
        return { recipe: null, error: erreur(`requirement.lockedRunes.${slot}`, 'contient un identifiant de rune invalide') };
      }
    }
  }

  for (const champ of ['adaptiveTrancheWeighting', 'exhaustiveSearch', 'excludeUsedRunes', 'ignoreArtifacts']) {
    if (d[champ] !== undefined && typeof d[champ] !== 'boolean') return { recipe: null, error: erreur(champ, 'doit être un booléen') };
  }
  if (d.excludeUsedScope !== undefined && !['rta', 'siege-defense', 'box'].includes(String(d.excludeUsedScope))) {
    return { recipe: null, error: erreur('excludeUsedScope', "contient un périmètre d'exclusion inconnu") };
  }
  if (d.excludedSelectors !== undefined && !Array.isArray(d.excludedSelectors)) {
    return { recipe: null, error: erreur('excludedSelectors', 'doit être une liste') };
  }
  if (!estObjet(d.artifactMainByKind)) return { recipe: null, error: erreur('artifactMainByKind', 'doit être un objet') };
  for (const [kind, choix] of Object.entries(d.artifactMainByKind)) {
    if (!['element', 'archetype'].includes(kind) || !CHOIX_ARTEFACT_ACCEPTES.has(choix)) {
      return { recipe: null, error: erreur(`artifactMainByKind.${kind}`, "contient un choix d'artéfact invalide") };
    }
  }
  if (d.lignesVerrouillees !== undefined) {
    if (!Array.isArray(d.lignesVerrouillees)) return { recipe: null, error: erreur('lignesVerrouillees', 'doit être une liste') };
    for (const [index, ligne] of d.lignesVerrouillees.entries()) {
      if (
        !estObjet(ligne) ||
        validerNombre(ligne.code, `lignesVerrouillees.${index}.code`, true) ||
        validerNombre(ligne.min, `lignesVerrouillees.${index}.min`) ||
        (ligne.code as number) <= 0 ||
        (ligne.min as number) < 0
      ) {
        return { recipe: null, error: erreur(`lignesVerrouillees.${index}`, 'doit contenir un code entier et un minimum numérique') };
      }
    }
  }
  const damageSetupErreur = validerDamageSetup(d.damageSetup);
  if (damageSetupErreur) return { recipe: null, error: damageSetupErreur };
  return { recipe: d as unknown as OptimizerRecipe };
}
