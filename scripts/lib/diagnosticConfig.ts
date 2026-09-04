// Configuration du harnais : d'une `ConfigHarnais` déclarée à un
// `SearchParams` exécutable, PLUS la liste des paramètres réellement
// effectifs avec leur ORIGINE et le drapeau de fidélité.
//
// ⚠️ **C'est le palier 1 du cadrage (§5) : instantané, avant toute
// exécution.** Rien ici ne lance de recherche — c'est précisément le but,
// pouvoir challenger la configuration d'un run AVANT de le laisser tourner
// vingt minutes pour un résultat faux.
//
// ⚠️ **Deux pièges vérifiés, et c'est ce module qui les rend visibles**
// (§4.3) :
// - **La cascade.** `bucketCap = params.bucketCap ?? bucketCapFor(slotCap)`.
//   Surcharger `slotFilterCap` déplace donc AUSSI `bucketCap` : deux
//   paramètres bougent, un seul a été touché. D'où l'origine « dérivé ».
// - **Le défaut du MOTEUR n'est pas le défaut de la PROD.** Un run qui omet
//   `slotFilterCap` prend 40 (`MAX_PER_SLOT_MATCH`) et 3000 de `bucketCap`,
//   là où la production réelle (préréglage « Moyen ») donne 80 et 6000 — la
//   MOITIÉ de la rétention sur les deux axes, en silence. En mode
//   synthétique le harnais EXIGE donc un `slotFilterCap` explicite, plutôt
//   que de laisser le moteur retomber sur son défaut.
//
// ⚠️ Ce piège-là est un défaut du MOTEUR, pas du harnais ; le corriger à la
// source est une piste d'amélioration consignée ailleurs (la correction
// naïve — `MAX_PER_SLOT_MATCH = 80` — casserait la production, cette
// constante servant AUSSI d'ancre à `bucketCapFor`). En attendant, la règle
// ci-dessus protège le harnais.

import {
  DEFAULT_MAX_MS,
  MAX_COLLECTED,
  MAX_PER_SLOT_MATCH,
  SLOT_FILTER_PRESETS,
  SearchParams,
  bucketCapFor,
} from '../../src/lib/runeBuildOptim';
import { PARALLEL_PAIRING_THRESHOLD } from '../../src/workers/parallelPairing';
import { chargerRecette } from './chargerRecette';
import { SETS_JOKER, mulberry32, randomPool } from './randomPool';
import {
  ConfigHarnais,
  Fidelite,
  ParametreEffectif,
  RegimeAppariement,
} from './diagnosticTypes';
import { BaseStats } from '../../src/types';

/** Le préréglage réel de l'app — « Moyen », le défaut de l'écran. */
const CAP_PRODUCTION = SLOT_FILTER_PRESETS.find((p) => p.key === 'moyen')!.cap;
/** ⚠️ IDENTIQUE à `HARD_TIMEOUT_MS` (OptimizerSection.tsx) : 10 minutes. */
const MAX_MS_PRODUCTION = 10 * 60 * 1000;

/**
 * Base de monstre pour un pool synthétique — la même que celle utilisée par
 * tous les tests et benchmarks du dépôt, pour que leurs chiffres restent
 * comparables entre eux.
 */
const BASE_SYNTHETIQUE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export interface ConfigResolue {
  params: SearchParams;
  parametres: ParametreEffectif[];
  fidelite: Fidelite;
  avertissements: string[];
  source: 'recette' | 'synthetique';
  descriptionSource: string;
  /**
   * ⚠️ `undefined` = le harnais applique le seuil de la PRODUCTION, il ne
   * choisit rien. Renseigné = régime forcé, donc un override marqué.
   */
  regimeForce?: RegimeAppariement;
  /** Utile au classement (§3, phase D) et au suivi de pièces. */
  poolInitial: SearchParams['pool'];
  recette?: import('../../src/lib/optimizerRecipe').OptimizerRecipe;
  monstre?: import('./loadMonster').LoadedMonster;
}

/**
 * ⚠️ Lève une `Error` sur configuration invalide plutôt que d'appliquer un
 * repli : « aucun repli silencieux » est une règle du cadrage (§4.4, règle
 * 4), pas une préférence de style. Un repli ici produirait un run qui
 * mesure autre chose que ce qui a été demandé, sans que rien ne le dise.
 */
export function resoudreConfig(config: ConfigHarnais): ConfigResolue {
  const overrides = config.overrides ?? {};
  const avertissements: string[] = [];
  const parametres: ParametreEffectif[] = [];

  let params: SearchParams;
  let source: 'recette' | 'synthetique';
  let descriptionSource: string;
  let recette: ConfigResolue['recette'];
  let monstre: ConfigResolue['monstre'];
  /** Ce que la PRODUCTION appliquerait pour ce cas, avant tout override. */
  let capProd: number;
  let maxMsProd: number;
  let origineCap: ParametreEffectif['origine'];

  if (config.source.type === 'recette') {
    const chargee = chargerRecette(config.source.cheminCompte, config.source.cheminRecette, config.source.mode);
    recette = chargee.recipe;
    monstre = chargee.loaded;
    params = chargee.params;
    avertissements.push(...chargee.avertissements);
    source = 'recette';
    descriptionSource = `recette ${chargee.recipe.monsterName} (${chargee.modeLabel}, préréglage ${chargee.recipe.slotFilterPreset}) sur ${config.source.cheminCompte}`;
    // En mode recette, la recette FAIT FOI : son préréglage EST le
    // comportement de production pour ce run, quel qu'il soit.
    capProd = params.slotFilterCap ?? MAX_PER_SLOT_MATCH;
    maxMsProd = params.maxMs ?? DEFAULT_MAX_MS;
    origineCap = 'recette';
  } else {
    const s = config.source;
    // ⚠️ Règle 4 — aucun repli silencieux. Un `slotFilterCap` omis ferait
    // mesurer la moitié de la rétention de production sur deux axes.
    if (!Number.isFinite(s.slotFilterCap) || s.slotFilterCap <= 0) {
      throw new Error(
        'Mode synthétique : `slotFilterCap` explicite OBLIGATOIRE. ' +
          `Omis, le moteur retomberait sur ${MAX_PER_SLOT_MATCH} (et ${bucketCapFor(MAX_PER_SLOT_MATCH)} de bucketCap), ` +
          `soit la moitié de la production réelle (${CAP_PRODUCTION} et ${bucketCapFor(CAP_PRODUCTION)}).`
      );
    }
    const pool = randomPool(mulberry32(s.seed), s.runesParEmplacement, s.sets ?? SETS_JOKER);
    params = {
      base: BASE_SYNTHETIQUE,
      artifacts: [],
      pool,
      requirement: s.requirement,
      metric: 'eff',
      objective: s.objective,
      slotFilterCap: s.slotFilterCap,
    };
    source = 'synthetique';
    descriptionSource = `pool synthétique (seed ${s.seed}, ${s.runesParEmplacement} runes/emplacement, ${pool.length} au total)`;
    capProd = s.slotFilterCap;
    // ⚠️ Sans recette, il n'y a pas de « ce que la prod ferait » pour le
    // temps : le moteur retomberait sur 15 s là où l'écran donne 10 min. On
    // prend donc le budget de l'écran comme référence, et le run le dira.
    maxMsProd = MAX_MS_PRODUCTION;
    if (params.maxMs == null && overrides.maxMs == null) {
      params.maxMs = MAX_MS_PRODUCTION;
      avertissements.push(
        `Mode synthétique sans \`maxMs\` : le budget de l'écran (${MAX_MS_PRODUCTION / 1000} s) est appliqué, ` +
          `PAS le défaut du moteur (${DEFAULT_MAX_MS / 1000} s) — sinon le run mesurerait une recherche 40× plus courte que celle de l'utilisateur.`
      );
    }
    origineCap = 'recette';
  }

  // ── Les paramètres effectifs, chacun avec son ORIGINE.
  const capEffectif = overrides.slotFilterCap ?? capProd;
  params.slotFilterCap = capEffectif;
  parametres.push({
    nom: 'slotFilterCap',
    valeur: capEffectif,
    origine: overrides.slotFilterCap != null ? 'override' : origineCap,
    valeurProd: capProd,
  });

  // ⚠️ LE PIÈGE DE LA CASCADE, rendu visible : sans override explicite,
  // `bucketCap` est DÉRIVÉ de `slotFilterCap` — donc surcharger le second
  // déplace le premier, alors qu'un seul a été touché.
  const bucketCapEffectif = overrides.bucketCap ?? bucketCapFor(capEffectif);
  params.bucketCap = bucketCapEffectif;
  parametres.push({
    nom: 'bucketCap',
    valeur: bucketCapEffectif,
    origine: overrides.bucketCap != null ? 'override' : 'dérivé',
    derivéDe: overrides.bucketCap != null ? undefined : 'slotFilterCap',
    valeurProd: bucketCapFor(capProd),
  });

  const maxCollectedEffectif = overrides.maxCollected ?? params.maxCollected ?? MAX_COLLECTED;
  params.maxCollected = maxCollectedEffectif;
  parametres.push({
    nom: 'maxCollected',
    valeur: maxCollectedEffectif,
    origine: overrides.maxCollected != null ? 'override' : 'défaut moteur',
    valeurProd: MAX_COLLECTED,
  });

  const maxMsEffectif = overrides.maxMs ?? params.maxMs ?? DEFAULT_MAX_MS;
  params.maxMs = maxMsEffectif;
  parametres.push({
    nom: 'maxMs',
    valeur: Number.isFinite(maxMsEffectif) ? maxMsEffectif : 'infini (exhaustif)',
    origine: overrides.maxMs != null ? 'override' : source === 'recette' ? 'recette' : 'défaut moteur',
    valeurProd: Number.isFinite(maxMsProd) ? maxMsProd : 'infini (exhaustif)',
  });

  if (overrides.combosOrderMode != null) {
    params.combosOrderMode = overrides.combosOrderMode;
    parametres.push({
      nom: 'combosOrderMode',
      valeur: overrides.combosOrderMode,
      origine: 'override',
      valeurProd: 'relevance',
    });
  }

  parametres.push({
    nom: 'régime d’appariement',
    valeur: overrides.regime ?? `seuil de prod (${(PARALLEL_PAIRING_THRESHOLD / 1_000_000).toFixed(0)}M paires)`,
    origine: overrides.regime != null ? 'override' : 'défaut moteur',
    valeurProd: `seuil de prod (${(PARALLEL_PAIRING_THRESHOLD / 1_000_000).toFixed(0)}M paires)`,
  });

  return {
    params,
    parametres,
    fidelite: evaluerFidelite(parametres),
    regimeForce: overrides.regime,
    avertissements,
    source,
    descriptionSource,
    poolInitial: params.pool,
    recette,
    monstre,
  };
}

/**
 * ⚠️ **Un run surchargé est MARQUÉ, et la marque voyage avec le résultat.**
 * Un nombre produit par le harnais ne doit jamais pouvoir être relu comme
 * « ce que fait la prod » s'il ne l'est pas — y compris une fois collé dans
 * une conversation, détaché de son contexte.
 */
export function evaluerFidelite(parametres: ParametreEffectif[]): Fidelite {
  const ecarts = parametres
    .filter((p) => p.valeurProd != null && p.valeur !== p.valeurProd)
    .map((p) => ({ nom: p.nom, valeur: p.valeur, valeurProd: p.valeurProd! }));
  return {
    divergeDeLaProd: ecarts.length > 0,
    ecarts,
    noteNavigateur:
      'Temps mesurés en Node : PLANCHER pour le navigateur (~7 % de moins). ' +
      'Le navigateur rend la main toutes les 50 ms et plafonne à ~4 ms un setTimeout(0) enchaîné — ' +
      'surcoût de plateforme, non corrigeable côté harnais. Chiffre ARITHMÉTIQUE, pas mesuré.',
  };
}

/**
 * Le palier 1 en texte — la configuration effective, lisible avant de lancer
 * quoi que ce soit.
 */
export function rendreParametres(resolue: ConfigResolue): string {
  const lignes: string[] = [];
  lignes.push(`Source          : ${resolue.descriptionSource}`);
  lignes.push('');
  lignes.push('Paramètres effectifs (valeur — origine)');
  lignes.push('---------------------------------------');
  for (const p of resolue.parametres) {
    const origine =
      p.origine === 'dérivé' ? `DÉRIVÉ de ${p.derivéDe}` : p.origine === 'override' ? 'OVERRIDE' : p.origine;
    const prod = p.valeurProd != null && p.valeur !== p.valeurProd ? `   (prod : ${p.valeurProd})` : '';
    lignes.push(`  ${p.nom.padEnd(22)} ${String(p.valeur).padStart(12)}   ${origine}${prod}`);
  }
  lignes.push('');
  if (resolue.fidelite.divergeDeLaProd) {
    lignes.push('⚠️ FIDÉLITÉ : DIVERGE DE LA PROD');
    for (const e of resolue.fidelite.ecarts) {
      lignes.push(`   ${e.nom} = ${e.valeur}  (prod : ${e.valeurProd})`);
    }
  } else {
    lignes.push('✅ FIDÉLITÉ : conforme à la production pour ce cas.');
  }
  for (const a of resolue.avertissements) lignes.push(`⚠️ ${a}`);
  return lignes.join('\n');
}
