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
import { DamageSetup, IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID, LEADER_SKILL_STATS, cibleSecondairePriseEnCharge, cransDeLaRegleIgnoreDef } from './damage';
import { erreurAurasExternes } from './aurasExternes';
import { AutoExclusionScope, ExclusionSelector } from './optimizerExclusion';
import { ArtifactKind, RUNE_SETS } from '../types';
import { ArtifactMainChoice, RelicMainChoice, RelicUniqueChoice, SlotFilterPresetKey } from '../hooks/useOptimizerState';
import { LigneVerrouillee } from './artifactOptim';
import { RuneMetric } from '../hooks/useRuneMetric';
import { RELIC_UNIQUE, setsCost } from './effects';

export const OPTIMIZER_RECIPE_VERSION = 1;

// ⚠️ **Un champ ajouté ici traverse plusieurs endroits indépendants, pas un
// seul** : l'oublier dans l'un fait diverger un script de l'écran en silence
// (aucune erreur `tsc`, le champ manquant reste un type optionnel valide).
// Incident vécu : `exhaustiveSearch` branché dans OptimizerSection.tsx
// (l'écran) mais oublié dans recipeToSearchParams.ts, repéré seulement
// parce que l'utilisateur a posé la question — voir spec/README.md,
// « Conventions communes », pour la règle générale, et le skill
// `optimizer-field-propagation` pour les producteurs purs qui remplacent
// ces constructeurs et pour la checklist de ceux qui subsistent. Les deux
// principaux :
// 1. `OptimizerSection.tsx` — `exportRecipe`/`importRecipe`/`handleSearch`
//    (l'écran, source de vérité).
// 2. `scripts/lib/recipeToSearchParams.ts` — `recipeToSearchParams` (rejoue
//    une recette depuis un script, utilisé par `scripts/optimizer-search.ts`),
//    et ses lecteurs des champs qui n'entrent pas dans `SearchParams`
//    (`toutVerifierDeLaRecette`, lu par `classementCli.ts`).
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

/**
 * Miroir de `mainsPourCeCompte` pour la relique (D1 : « mêmes trois règles
 * que l'artéfact ») : `'equipped'` ne se partage pas — importé d'un AUTRE
 * `wizard_name`, il bascule sur `'libre'` et le signale ; provenance
 * inconnue (`wizardName` absent d'un côté ou de l'autre) ne touche à rien.
 *
 * ⚠️ **Pas factorisée avec `mainsPourCeCompte`** : celle-ci bascule une
 * `Record<ArtifactKind, …>` (deux emplacements), ici un scalaire unique —
 * assez différent pour que partager le code coûte plus qu'il ne rend, d'où
 * le test parallèle plutôt que l'appel partagé (D1 l'autorise explicitement).
 */
export function relicMainPourCeCompte(
  recipe: Pick<OptimizerRecipe, 'relicMainChoice' | 'wizardName'>,
  accountName: string | null
): { main: RelicMainChoice | undefined; bascule: boolean } {
  const memeCompte = recipe.wizardName == null || accountName == null || recipe.wizardName === accountName;
  if (memeCompte || recipe.relicMainChoice !== 'equipped') return { main: recipe.relicMainChoice, bascule: false };
  return { main: 'libre', bascule: true };
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
  compterAurasResPre?: boolean;
  metric: RuneMetric;
  slotFilterPreset: SlotFilterPresetKey;
  adaptiveTrancheWeighting: boolean;
  exhaustiveSearch: boolean;
  /**
   * « Vérifier toutes les combinaisons trouvées » (degats-et-aura 6bis-b18) :
   * la file de résolution vérifie tous les builds trouvés au lieu de s'arrêter
   * à K confirmées (`cibleDeLaFile`, artifactQueue.ts).
   *
   * ⚠️ **OPTIONNEL, et il doit le rester** : une recette exportée avant ce
   * champ ne le porte pas, et tout lecteur applique `?? false` — l'écran
   * (`importRecipe`), le CLI (`toutVerifierDeLaRecette`, recipeToSearchParams.ts).
   * Il n'entre pas dans `SearchParams` : le moteur de runes l'ignore, seule la
   * file le lit. Purement de la saisie, rien à re-résoudre chez qui importe.
   */
  verifierToutesLesCombinaisons?: boolean;
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
  /**
   * Intention de recherche de relique (A.2 bis D1/D2) : principale ET
   * propriété unique demandées, seuil de niveau. **Trois champs OPTIONNELS,
   * et ils doivent le rester** : une recette exportée sans ces champs n'en
   * porte aucun — tout lecteur applique le défaut de
   * `defaultRelicMainChoice`/`'libre'`/`DEFAULT_RELIC_MIN_UPGRADE`
   * (hooks/useOptimizerState.ts), jamais une valeur devinée ici. Sans effet
   * sur `SearchParams` hors du mode `recherche` (D1 : `libre` et le type n'ont
   * d'effet qu'avec la recherche de relique).
   */
  relicMainChoice?: RelicMainChoice;
  relicUniqueChoice?: RelicUniqueChoice;
  relicMinUpgrade?: number;
}

export function buildOptimizerRecipe(input: Omit<OptimizerRecipe, 'version'>): OptimizerRecipe {
  return { version: OPTIMIZER_RECIPE_VERSION, ...input };
}

export interface RecipeValidationResult {
  recipe: OptimizerRecipe | null;
  error?: string;
  /**
   * Ce que l'import a CONVERTI pour rendre la recette lisible (jamais une
   * erreur : la recette est rendue). Chaque entrée nomme le champ, l'ancienne
   * et la nouvelle valeur. ⚠️ Optionnel, donc invisible pour `tsc` chez un
   * lecteur qui l'ignore : l'écran (`importRecipe`) l'ajoute au message
   * d'import, le CLI et le harnais le reçoivent par les `avertissements` de
   * `chargerRecette`. Absent quand rien n'a été converti.
   */
  avertissements?: string[];
}

// L'ancien mode critique « Moyenne », supprimé : une recette exportée avant
// sa suppression le porte encore. Elle est CONVERTIE en « Critique », le défaut — jamais
// refusée, jamais changée en silence. Toute autre valeur inconnue reste
// refusée (`validerDamageSetup`).
const CRIT_MODE_SUPPRIME = 'moyenne';
export const AVERTISSEMENT_CRIT_MOYENNE =
  "damageSetup.critMode : « moyenne » → « crit » — le mode critique « Moyenne » n'existe plus, la recette est passée en « Critique ».";

const OBJECTIFS_ACCEPTES = new Set(['efficience', 'ehp', 'vitesse', 'degats_reels', 'speed_nuker', 'degats']);
const METRIQUES_ACCEPTEES = new Set(['eff', 'score']);
const PRESETS_ACCEPTES = new Set<string>(SLOT_FILTER_PRESETS.map((p) => p.key));
const SETS_ACCEPTES = new Set(RUNE_SETS.map((s) => s.key));
const STATS_ACCEPTEES = new Set(['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc']);
const CHOIX_ARTEFACT_ACCEPTES = new Set<unknown>(['equipped', 'libre', 'none', 100, 101, 102]);
// ⚠️ Pas de `'none'` ici : ce cran n'a jamais existé pour la relique (D1),
// contrairement à l'artéfact qui le tolère encore en compatibilité arrière.
const CHOIX_RELIC_MAIN_ACCEPTES = new Set<unknown>(['equipped', 'libre', 100, 101, 102]);
const RELIC_UNIQUE_TYPES_ACCEPTES = new Set<number>(Object.keys(RELIC_UNIQUE).map(Number));

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

// LA règle de clé d'identifiant de compétence de toute la recette (degats-et-aura
// 8d) : entier positif SANS zéro de tête. « 010616 » désignerait bien le sort
// 10616 par `Number`, mais le calcul lit la clé « 10616 » et ne verrait jamais
// l'autre ; la clé morte repartirait à l'export suivant.
function estIdentifiantDeCompetence(cle: string): boolean {
  return /^[1-9]\d*$/.test(cle);
}

function validerRecordNumerique(value: unknown, path: string, entier = false): string | null {
  if (value === undefined) return null;
  if (!estObjet(value)) return erreur(path, 'doit être un objet indexé par identifiant de compétence');
  for (const [id, n] of Object.entries(value)) {
    if (!estIdentifiantDeCompetence(id)) return erreur(`${path}.${id}`, "utilise un identifiant de compétence invalide");
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
    if (!estIdentifiantDeCompetence(id)) return erreur(`${path}.${id}`, "utilise un identifiant de compétence invalide");
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
  // ⚠️ L'ancien `setsAura` comptait l'équipe ENTIÈRE, monstre optimisé
  // inclus : ses nombres ne se traduisent pas en auras des autres monstres
  // (on ignore lesquelles venaient des runes du monstre lui-même). Absent ou
  // vide, il ne dit rien et reste accepté — `parseOptimizerRecipe` le retire
  // alors ; non vide, il est refusé plutôt que réinterprété en silence.
  if (setup.setsAura !== undefined) {
    if (!Array.isArray(setup.setsAura)) return erreur('damageSetup.setsAura', 'doit être une liste');
    if (setup.setsAura.length > 0) {
      return erreur(
        'damageSetup.setsAura',
        "est l'ancien total d'auras de l'équipe, monstre optimisé inclus, qui ne peut pas être converti en auras des autres monstres : " +
          'retirer ce champ et saisir les auras des autres monstres dans damageSetup.setsAuraExternes'
      );
    }
  }
  // Une ligne par set, entier de 1 à 15, somme ≤ 15 (cinq autres monstres à
  // trois sets ; les activations propres du build s'y ajoutent hors de ce
  // champ). ⚠️ La MÊME validation que la saisie de l'écran
  // (`aurasExternes.ts`) : ce que l'écran écrit, la recette le relit.
  const erreurAuras = erreurAurasExternes(setup.setsAuraExternes);
  if (erreurAuras) return erreur(`damageSetup.setsAuraExternes${erreurAuras.chemin}`, erreurAuras.attente);
  if (setup.skillCom2usId !== undefined && setup.skillCom2usId !== null) {
    const e = validerNombre(setup.skillCom2usId, 'damageSetup.skillCom2usId', true);
    if (e) return e;
  }
  for (const champ of [
    'enemyDef', 'enemyHp', 'enemyHpPct', 'ownHpPct', 'livingAlliesPct', 'aliveEnemies',
    'sacrificeReservePct', 'enemyAtk', 'enemyDestroyedHpPct', 'enemySpd', 'leaderSpeedPct',
    'velaskaPvPerduPct',
  ]) {
    if (setup[champ] !== undefined) {
      const e = validerNombre(setup[champ], `damageSetup.${champ}`);
      if (e) return e;
    }
  }
  // Le lead s'additionne aux auras : un `pct` en texte (« "20" ») concaténait
  // au lieu d'additionner — revue externe de la v1.14.0, constat 6.
  if (setup.leaderSkill !== undefined) {
    const lead = setup.leaderSkill;
    if (!estObjet(lead)) return erreur('damageSetup.leaderSkill', 'doit être un objet');
    if (!(LEADER_SKILL_STATS as readonly unknown[]).includes(lead.stat)) {
      return erreur('damageSetup.leaderSkill.stat', 'contient une stat de lead inconnue');
    }
    const e = validerNombre(lead.pct, 'damageSetup.leaderSkill.pct');
    if (e) return e;
  }
  for (const champ of ['ownHpPct', 'livingAlliesPct', 'sacrificeReservePct', 'enemyDestroyedHpPct']) {
    if (setup[champ] !== undefined && ((setup[champ] as number) < 0 || (setup[champ] as number) > 100)) {
      return erreur(`damageSetup.${champ}`, 'doit être compris entre 0 et 100');
    }
  }
  if (
    setup.aliveEnemies !== undefined &&
    (!Number.isInteger(setup.aliveEnemies) || (setup.aliveEnemies as number) < 1 || (setup.aliveEnemies as number) > 4)
  ) {
    return erreur('damageSetup.aliveEnemies', 'doit être un entier compris entre 1 et 4');
  }
  for (const champ of [
    'atkBuff', 'defBuff', 'spdBuff', 'defBreak', 'defBreakParLeSort', 'brand', 'effetsCibleCountAutres', 'buffsPropresCountAutres', 'atkDebuff', 'defDebuff', 'spdDebuff', 'euldongActif', 'mirinaeActif',
    'deborahActif', 'miriamActif', 'transmissionActif', 'velaskaActif', 'enemyHpNotDestroyed',
  ]) {
    if (setup[champ] !== undefined && typeof setup[champ] !== 'boolean') return erreur(`damageSetup.${champ}`, 'doit être un booléen');
  }
  // `CRIT_MODE_SUPPRIME` reste accepté ICI uniquement pour être converti par
  // `parseOptimizerRecipe`, avec son avertissement.
  if (setup.critMode !== undefined && ![CRIT_MODE_SUPPRIME, 'crit', 'normal'].includes(String(setup.critMode))) {
    return erreur('damageSetup.critMode', 'contient un mode de critique inconnu');
  }
  // ⚠️ « aucune » n'existe plus dans l'écran ni dans `SummonerSkills`, mais
  // reste accepté ICI uniquement pour migrer une recette déjà exportée. Le
  // parseur le transforme en « combat » avant de rendre la recette.
  if (setup.summonerSkills !== undefined && !['aucune', 'combat', 'guilde'].includes(String(setup.summonerSkills))) {
    return erreur('damageSetup.summonerSkills', "contient un mode de compétences d'invocateur inconnu");
  }
  if (setup.enemyElement !== undefined && setup.enemyElement !== null && !['fire', 'water', 'wind', 'light', 'dark'].includes(String(setup.enemyElement))) {
    return erreur('damageSetup.enemyElement', 'contient un élément inconnu');
  }

  for (const champ of ['coupsPersonnalises', 'effetsCibleCount', 'buffsCibleCount', 'buffsPropresCount', 'buffsAlliesCount', 'compteurPersonnalise', 'effetsPropresCount']) {
    const e = validerRecordNumerique(setup[champ], `damageSetup.${champ}`, true);
    if (e) return e;
  }
  for (const champ of ['stackPersonnalise', 'pvActuelsAvantSacrificePct']) {
    const e = validerRecordNumerique(setup[champ], `damageSetup.${champ}`);
    if (e) return e;
  }
  const ePassifs = validerRecordBooleen(setup.passifsOffensifs, 'damageSetup.passifsOffensifs');
  if (ePassifs) return ePassifs;
  const eStatsCombat = validerRecordBooleen(setup.statsCombatActives, 'damageSetup.statsCombatActives');
  if (eStatsCombat) return eStatsCombat;
  // Cible calculée d'un sort à séquence curée (degats-et-aura 8b, cadrage B.0) :
  // clé = identifiant entier positif du SORT, valeur dans l'union, et
  // seulement pour un sort dont la séquence curée porte un coup de zone — la
  // MÊME table de capacité que celle qui décide d'afficher les deux crans
  // (`cibleSecondairePriseEnCharge`, DamageSetupCard.tsx). Jamais un cran
  // appliqué en silence à un sort sans cette capacité.
  if (setup.cibleDegatsParSort !== undefined) {
    if (!estObjet(setup.cibleDegatsParSort)) {
      return erreur('damageSetup.cibleDegatsParSort', 'doit être un objet indexé par identifiant de compétence');
    }
    for (const [skillId, cible] of Object.entries(setup.cibleDegatsParSort)) {
      const path = `damageSetup.cibleDegatsParSort.${skillId}`;
      // « 010616 » passerait la table de capacité (`Number` le ramène à
      // 10616) : la règle de clé la refuse d'abord (degats-et-aura 8c, 8d).
      if (!estIdentifiantDeCompetence(skillId)) return erreur(path, "utilise un identifiant de compétence invalide");
      if (cible !== 'visee' && cible !== 'secondaire') return erreur(path, 'doit valoir « visee » ou « secondaire »');
      if (!cibleSecondairePriseEnCharge(Number(skillId))) {
        return erreur(path, 'désigne un sort sans coup de zone curé, dont la cible calculée ne se choisit pas');
      }
    }
  }

  if (setup.scenariosEffetsEntreCoups !== undefined) {
    if (!estObjet(setup.scenariosEffetsEntreCoups)) {
      return erreur('damageSetup.scenariosEffetsEntreCoups', 'doit être un objet indexé par identifiant de compétence');
    }
    for (const [skillId, scenarioBrut] of Object.entries(setup.scenariosEffetsEntreCoups)) {
      const path = `damageSetup.scenariosEffetsEntreCoups.${skillId}`;
      if (!estIdentifiantDeCompetence(skillId)) return erreur(path, "utilise un identifiant de compétence invalide");
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
  // Rang du premier coup qui ignore la DEF, par sort (les Blade Dancers,
  // degats-et-aura 10b, contrat B.0) : validé À L'IMPORT selon la règle curée
  // du sort, DÉRIVÉE de `IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID` par
  // `cransDeLaRegleIgnoreDef` — les crans mêmes du sélecteur de l'écran :
  // variante à 3 coups `null`, 2 ou 3 ; variante à 7 coups 2 à 7, jamais
  // `null`. Toute autre valeur, et la clé d'un sort sans cette règle, est
  // REFUSÉE avec son chemin, jamais ramenée en silence au défaut. Le repli de
  // `resolvedPremierCoupIgnoreDef` (damage.ts) reste une seconde garde, pour ce
  // qui n'arrive pas par une recette.
  if (setup.premierCoupIgnoreDefParSort !== undefined) {
    if (!estObjet(setup.premierCoupIgnoreDefParSort)) {
      return erreur('damageSetup.premierCoupIgnoreDefParSort', 'doit être un objet indexé par identifiant de compétence');
    }
    for (const [skillId, rang] of Object.entries(setup.premierCoupIgnoreDefParSort)) {
      const path = `damageSetup.premierCoupIgnoreDefParSort.${skillId}`;
      // « 014808 » désignerait bien un sort de la table : la règle de clé
      // le refuse d'abord (degats-et-aura 8d).
      if (!estIdentifiantDeCompetence(skillId)) return erreur(path, "utilise un identifiant de compétence invalide");
      const regle = IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID[Number(skillId)];
      // Le message ne compte ni ne nomme les sorts de la table : il resterait
      // faux dès une entrée de plus.
      if (!regle) {
        return erreur(path, "désigne un sort sans réglage d'ignore DEF par coup");
      }
      const permis = cransDeLaRegleIgnoreDef(regle).map((c) => c.rang);
      if (!permis.includes(rang as number | null)) {
        return erreur(path, `doit valoir ${permis.map((r) => (r === null ? 'null' : String(r))).join(', ')} pour ce sort`);
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

  for (const champ of ['adaptiveTrancheWeighting', 'exhaustiveSearch', 'excludeUsedRunes', 'ignoreArtifacts', 'compterAurasResPre', 'verifierToutesLesCombinaisons']) {
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
  if (d.relicMainChoice !== undefined && !CHOIX_RELIC_MAIN_ACCEPTES.has(d.relicMainChoice)) {
    return { recipe: null, error: erreur('relicMainChoice', 'contient un choix de relique invalide') };
  }
  if (
    d.relicUniqueChoice !== undefined &&
    d.relicUniqueChoice !== 'libre' &&
    (typeof d.relicUniqueChoice !== 'number' || !RELIC_UNIQUE_TYPES_ACCEPTES.has(d.relicUniqueChoice))
  ) {
    return { recipe: null, error: erreur('relicUniqueChoice', 'contient un type de propriété unique inconnu') };
  }
  if (d.relicMinUpgrade !== undefined) {
    const e = validerNombre(d.relicMinUpgrade, 'relicMinUpgrade', true);
    if (e) return { recipe: null, error: e };
  }
  // Compatibilité arrière : l'ancien cran « aucune » décrivait une situation
  // impossible en jeu. Une recette qui le porte repart donc sur le défaut
  // réel « combat » ; cette normalisation centrale protège autant l'écran que
  // le CLI, tous deux consommateurs du résultat de ce parseur.
  // L'ancien `setsAura`, accepté seulement absent ou vide (voir
  // `validerDamageSetup`), est retiré : aucune clé hors de `DamageSetup` ne
  // survit à l'import ni ne repart dans l'export suivant.
  // L'ancien mode critique « Moyenne » devient « Critique », DIT par un
  // avertissement (voir `AVERTISSEMENT_CRIT_MOYENNE`) : même normalisation
  // centrale, pour l'écran comme pour le CLI.
  const avertissements: string[] = [];
  let normalisee = d;
  if (estObjet(d.damageSetup)) {
    const { setsAura: _ancienTotal, ...setupLu } = d.damageSetup;
    let setup = setupLu;
    if (setup.critMode === CRIT_MODE_SUPPRIME) {
      setup = { ...setup, critMode: 'crit' };
      avertissements.push(AVERTISSEMENT_CRIT_MOYENNE);
    }
    normalisee = {
      ...d,
      damageSetup: ['combat', 'guilde'].includes(String(setup.summonerSkills)) ? setup : { ...setup, summonerSkills: 'combat' },
    };
  }
  // ⚠️ Le seuil est un FILTRE D'ENTRÉE, jamais un critère (D2) : une valeur
  // hors bornes (fichier édité à la main, futur relâchement du jeu) est
  // NORMALISÉE plutôt que rejetée — contrairement à tout le reste de ce
  // parseur, qui refuse. Bornes `[0, 15]`, D2.
  const avecSeuilNormalise =
    d.relicMinUpgrade !== undefined
      ? { ...normalisee, relicMinUpgrade: Math.min(15, Math.max(0, d.relicMinUpgrade as number)) }
      : normalisee;
  return {
    recipe: avecSeuilNormalise as unknown as OptimizerRecipe,
    ...(avertissements.length > 0 ? { avertissements } : {}),
  };
}
