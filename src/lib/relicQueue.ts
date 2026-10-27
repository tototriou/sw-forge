// Résolution EXACTE de l'équipement d'UN build : la paire d'artéfacts ET la
// relique, ensemble (« consommation »).
//
// ⚠️ **Pourquoi ensemble, et pas la relique après la paire.** La principale
// d'une relique est un POURCENTAGE qui entre dans `computeStats` AVANT les
// plats d'artéfact : la meilleure paire dépend des stats, donc de la relique.
// Choisir la paire avec la relique portée puis « ajouter » une relique
// noterait un couple qui n'existe pas. Chaque candidate reçoit SES paires,
// classées par le régime effectif avec ses stats à elle.
//
// ⚠️ **L'ordre du contrat est absolu** (l'ordre
// « meilleur puis filtre » perdait un build) : énumérer les éligibles →
// remplacer `relic` → stats exactes du couple → éliminer par
// `respecteConditionsAvecRelique` (minimums ET maximums) → noter par le régime
// effectif → meilleur couple FAISABLE → aucun faisable = build rejeté. Jamais
// deux notes indépendantes : la note d'un couple est le `score` que
// `chercherPaires` lui a donné par `evaluer` — le régime effectif, construit
// sur les stats AVEC la candidate — et rien d'autre.
//
// Deux écritures du contrat : le calcul EXHAUSTIF
// (`resoudreEquipementDuBuildExhaustif`, resolutionExhaustive.ts), qui le
// suit étape par étape en notant toutes les paires, et la résolution RAPIDE
// (resolutionRapide.ts), qui juge la faisabilité avant toute note et ne note
// que les paires faisables. Le point d'entrée de l'app,
// `resoudreEquipementDuBuild`, est la rapide ; l'exhaustive reste la
// référence des tests et le diagnostic à la demande.
//
// ⚠️ Ce module ne planifie rien (le « quand » vit dans le classeur,
// `CorpsClassement`, le « qui » dans `artifactQueue.ts`) : il répond à
// « quel équipement pour CE build ». C'est la partie pure que le différentiel
// contre l'oracle (`tests/relic-queue.test.ts`) exerce sur TOUS les candidats
// d'une recherche, sans navigateur.

import { ArtifactDetail, ElementKey, GearSet, RelicDetail, RuneDetail } from '../types';
import { computeStats, statsParPaire } from './stats';
import { ArtifactSearchParams, MemoPreFiltre } from './artifactOptim';
import {
  BuildCandidate,
  BuildRequirement,
  conditionsPaireFixePosees,
  respecteConditionsPaireFixe,
} from './runeBuildOptim';
import { RelicContext } from './relicOptim';
import { ResultatArtefacts } from './artifactQueue';
import { CacheProfilsParPaire, DegatsContext, RegimeArtefacts, evaluerPourRegime } from './artifactEvaluation';
import { DamageSetup, PreparationReglage, aurasPropresDesRunes } from './damage';
import { CachesResolutionRapide, resoudreEquipementDuBuildRapide } from './resolutionRapide';

/**
 * Ce que la résolution de PLUSIEURS builds peut partager sans changer un
 * résultat : le profil de dégâts de chaque paire
 * (`CacheProfilsParPaire`, qui ne dépend que des deux pièces), les
 * candidats élagués de chaque sorte (`MemoPreFiltre`, sur leurs entrées
 * réelles) et les représentants des formes de paire de la résolution
 * rapide (`CachesResolutionRapide`, sur les entrées de `candidatsParSorte`),
 * et ce que le calcul des dégâts réels lit du seul réglage
 * (`PreparationReglage`, damage.ts, sur ses entrées par identité : le contexte
 * de dégâts de la file). Les deux premiers sont bornés ; le troisième ne
 * garde qu'un jeu de formes ; la préparation a ses bornes.
 *
 * ⚠️ **Durée de vie : une file** — créés par l'écran avec la signature des
 * réglages et les paramètres de paires (donc l'inventaire), par le Worker de
 * résolution à chaque contexte, par le CLI une fois par recette ; jamais un
 * état global du module, qu'un changement d'inventaire laisserait périmé.
 */
export interface CachesResolution {
  profils: CacheProfilsParPaire;
  preFiltre: MemoPreFiltre;
  rapide: CachesResolutionRapide;
  reglage: PreparationReglage;
}

export function nouveauxCachesResolution(): CachesResolution {
  return {
    profils: new CacheProfilsParPaire(), preFiltre: new MemoPreFiltre(), rapide: new CachesResolutionRapide(),
    reglage: new PreparationReglage(),
  };
}

/**
 * Ce qu'il faut pour résoudre l'équipement d'UN build.
 *
 * ⚠️ `faireParams(relique)` construit les paramètres de `chercherPaires` avec
 * un `evaluer` dont les stats INCLUENT cette relique (`statsParPaire({ ...gear,
 * relic: relique })`) — c'est l'appelant qui possède le régime effectif et le
 * contexte de dégâts (`evaluerPourRegime`, surcharges : pas de repli
 * silencieux). Hors mode `recherche`, il est appelé avec `gear.relic` : la
 * portée.
 */
export interface EntreeResolution {
  // Le build : base, ses 6 runes, les artéfacts PORTÉS, la relique PORTÉE
  // (celle que le moteur a appliquée, `SearchParams.relic`).
  gear: GearSet;
  faireParams: (relique: RelicDetail | undefined) => ArtifactSearchParams;
  // Les paramètres de paires que `faireParams` complète de son `evaluer`, les
  // mêmes pour toute relique : la confirmation sans note
  // (`confirmerEquipementDuBuild`) en tire ses mémoires de file sans calculer
  // de stats. Absent (entrée construite à la main) : elle les relit par `faireParams`.
  artifactParams?: Omit<ArtifactSearchParams, 'evaluer'>;
  /**
   * Le prédicat de conformité hors mode `recherche` —
   * `respecteConditionsPaireFixe` : les minimums, plus les seuls maximums
   * RES/PRE, auras propres du build et toggle compris. Les autres maximums
   * restent hors de ce filtre (défaut préexistant côté artéfacts, hors chantier). `null` = aucune de ces
   * conditions posée (`conditionsPaireFixePosees`), toute paire convient.
   */
  respecteConditions: ((artefacts: ArtifactDetail[]) => boolean) | null;
  // Minimums ET maximums — le filtre exact de la dimension relique, mode
  // `recherche` seulement (`respecteConditionsAvecRelique`).
  requirement: Pick<BuildRequirement, 'minStats' | 'maxStats' | 'auraResPre'>;
  // Le régime effectif est-il `aucun` (Efficience, Vitesse, VIT, TC, DCC,
  // RES, PRE) ? La relique n'a alors aucun effet sur le tri 
  // (équipée si candidate et faisable, sinon première par `id`).
  regimeAucun: boolean;
  // Le régime effectif est-il `hp`, `atk` ou `def` ? La paire et la relique y
  // sont notées sur la fiche, sans l'effet unique : deux reliques de même
  // principale sont ex æquo, et la PORTÉE l'emporte si elle est parmi les
  // meilleures (`bestRelicForBuild`, `departagePortee`). Obligatoire, pour que `tsc` signale un constructeur oublié.
  regimeDeStat: boolean;
  // Le contexte canonique de la recherche dont ce build est issu (garantie
  // G) — jamais recalculé ici. Absent : la relique portée reste fixe, rien n'est résolu.
  relicContext: RelicContext | undefined;
  // Les caches partagés entre builds : le memo du préfiltre sert
  // à chaque `chercherPaires` de la résolution. Absent : tout se recalcule.
  caches?: CachesResolution | null;
}

/**
 * L'équipement de CE build : sa paire et sa relique, résolues ensemble — le
 * point d'entrée de l'app (écran, Worker de résolution, CLI).
 *
 * Hors mode `recherche` (contexte absent, `off`,
 * `equipped`) : la relique portée est fixe, la file ne résout que la paire.
 * En mode `recherche` : le contrat des sept étapes
 * (en-tête).
 *
 * Par la résolution rapide (`resoudreEquipementDuBuildRapide`,
 * resolutionRapide.ts), avec les représentants de formes de la file
 * (`caches.rapide`) : une relique qu'aucune forme de paire ne rend faisable
 * est écartée sans note, et seules les paires faisables sont notées. Pour un
 * build conforme, le résultat est celui du calcul exhaustif
 * (`resoudreEquipementDuBuildExhaustif`, resolutionExhaustive.ts), champ
 * pour champ ; une note NaN vue sur une paire faisable fait résoudre le
 * build par lui, signalé par `console.warn`.
 *
 * ⚠️ **Aucun couple faisable → `conforme: false`**, le build est rejeté par
 * le classement (`affichees`), jamais affiché, et le résultat ne porte ni
 * paire, ni artéfact, ni relique : le diagnostic d'un build rejeté ne se
 * calcule qu'à la demande (option `diagnostic` de la résolution rapide).
 * ⚠️ Écart accepté : une note NaN portée par une paire INFAISABLE seule
 * n'est jamais calculée ; le calcul exhaustif, qui trie avec elle, peut
 * alors ordonner autrement les paires faisables — seulement sur un build
 * dont la note est déjà incohérente.
 */
export function resoudreEquipementDuBuild(e: EntreeResolution): ResultatArtefacts {
  return resoudreEquipementDuBuildRapide(e);
}

/**
 * Les runes d'UN candidat, lues dans l'inventaire indexé par identifiant, dans
 * l'ordre de `runeIds` (emplacements 1 à 6) ; une rune absente de l'index est
 * omise.
 *
 * ⚠️ **Le seul producteur des deux résolutions de l'écran** : la directe (`resoudreEquipement`, argument `runes` de
 * `entreeResolutionDuBuild`) et celle hors du fil (`resolutionHorsFil.runesDe`,
 * dont les runes voyagent avec chaque demande au Worker). Deux expressions
 * recopiées pouvaient diverger sans qu'aucun test le voie : la revue du Worker
 * a montré qu'une copie rendant `[]` ferait résoudre au Worker des builds sans
 * runes, tous les tests restant verts.
 */
export function runesDuBuild(c: Pick<BuildCandidate, 'runeIds'>, runeById: ReadonlyMap<number, RuneDetail>): RuneDetail[] {
  return c.runeIds.map((id) => runeById.get(id)).filter((r): r is RuneDetail => r !== undefined);
}

/**
 * L'entrée de `resoudreEquipementDuBuild` pour UN candidat, assemblée comme
 * l'écran l'assemble — le producteur que l'écran (`resoudreEquipement`,
 * OptimizerSection.tsx) et le CLI (`resoudreEquipementCli`,
 * recipeToSearchParams.ts) appellent tous deux, pour que la résolution du
 * CLI soit celle de l'écran par construction.
 *
 * - `fiche` : l'équipement de la fiche (`selected.gear`, `loaded.gear`) — sa
 *   base, ses artéfacts et sa relique PORTÉS ; seules ses runes sont
 *   remplacées par celles du candidat.
 * - `artifactParams` : le contexte de choix des paires (`artifactParams` de
 *   l'écran, `artefactsDuCli` au CLI) ; son `evaluer` est REMPLACÉ ici.
 * - `regime` : le régime EFFECTIF (`regimeEquipement`), le même pour la paire
 *   ET la relique (un seul régime pour l'équipement complet) — jamais un
 *   contexte de dégâts optionnel silencieusement absorbé par le helper.
 * - `requirement` : les conditions AVEC auras (`avecAurasConditions`).
 * - `relicContext` : celui de la recherche LANCÉE (jamais une
 *   relecture des trois champs de l'écran).
 * - `caches` : ceux de la file (`nouveauxCachesResolution`), partagés par tous
 *   ses builds — obligatoire, `null` pour tout recalculer, pour
 *   que `tsc` signale un producteur qui n'a pas choisi.
 */
export function entreeResolutionDuBuild(e: {
  fiche: GearSet;
  runes: RuneDetail[];
  artifactParams: Omit<ArtifactSearchParams, 'evaluer'>;
  regime: RegimeArtefacts;
  degats: DegatsContext | null;
  exclusive: { setup: DamageSetup; element: ElementKey | null };
  requirement: BuildRequirement;
  relicContext: RelicContext | undefined;
  caches: CachesResolution | null;
}): EntreeResolution {
  // ⚠️ Les stats sont recalculées avec LES RUNES DE CE CANDIDAT, pas celles
  // de l'équipement affiché : la stat principale d'un artéfact entre dans
  // les stats du monstre, donc comparer des paires sur un autre build
  // comparerait des scores faux.
  const gear: GearSet = { ...e.fiche, runes: e.runes };
  // ⚠️ Les auras propres de CE candidat, résolues sur les mêmes
  // runes que `gear` : chaque paire et chaque relique essayées pour lui
  // sont notées avec elles, puis la paire et la relique retenues.
  const propres = aurasPropresDesRunes(gear.runes);
  if (e.regime === 'degats_reels' && !e.degats) {
    // `regimeEquipementDe` rabat « Dégâts réels » sans sort sur `aucun` :
    // arriver ici est une incohérence de l'appelant, jamais un repli.
    throw new Error('entreeResolutionDuBuild : régime « Dégâts réels » sans contexte de dégâts — régime effectif non rabattu.');
  }
  // ⚠️ Le filtre final du §12.5 — obligatoire, pas facultatif : la recherche
  // valide les minimums contre une borne PAR STAT ISOLÉE
  // (`searchArtifactBounds`), des builds arrivent donc ici sans qu'aucune
  // paire réelle ne les rende équipables (mesuré : 99 sur 105). `null` quand
  // aucun minimum ni maximum RES/PRE n'est posé (`conditionsPaireFixePosees`).
  // Hors mode `recherche` de la relique seulement ; en mode `recherche`,
  // `respecteConditionsAvecRelique` (minimums ET maximums, avec la
  // candidate) le remplace.
  const conditionsPosees = conditionsPaireFixePosees(e.requirement);
  return {
    gear,
    // ⚠️ `relique` : la candidate que la résolution exacte essaie
    // pour ce build — elle REMPLACE la portée dans les stats qui notent chaque
    // paire (jamais un cumul). Hors mode `recherche`, la
    // résolution passe la portée elle-même.
    faireParams: (relique) => {
      // ⚠️ **UN seul `computeStats` par build et par relique, pas un par
      // paire.** L'évaluateur tourne pour CHAQUE paire autorisée — quelques
      // milliers en « Dégâts réels », où la dominance n'élague plus rien.
      // L'apport d'un artéfact étant PLAT, les stats sans artéfact se
      // calculent une fois et chaque paire ne coûte plus que trois additions
      // (voir `statsParPaire`).
      const statsAvec = statsParPaire({ ...gear, relic: relique });
      // ⚠️ Le canal exclusive : la candidate qu'on essaie, plus le
      // contexte de son assiette `Y`. C'est la MÊME note qui choisit la
      // paire, choisit la relique et classe — jamais un score d'exclusive
      // ajouté après coup.
      const exclusive = { relique, setup: e.exclusive.setup, element: e.exclusive.element };
      // ⚠️ **La paire se choisit sur le critère RÉELLEMENT regardé** (le
      // régime effectif), pas sur une somme de statistiques principales —
      // voir `evaluerPourRegime` (`artifactEvaluation.ts`). Sur Efficience et
      // Vitesse (régime `'aucun'`), il n'y a RIEN à maximiser : le seul
      // travail qui compte est la faisabilité (docs/03-developpeur/optimizer/
      // § Régime de la paire).
      const evaluer =
        e.regime === 'degats_reels'
          ? evaluerPourRegime(e.regime, statsAvec, propres, e.degats!, exclusive, e.caches?.profils, e.caches?.reglage)
          : evaluerPourRegime(e.regime, statsAvec, propres, exclusive);
      return { ...e.artifactParams, evaluer };
    },
    artifactParams: e.artifactParams,
    respecteConditions: conditionsPosees
      ? (arts) => respecteConditionsPaireFixe(computeStats({ ...gear, artifacts: arts }), e.requirement, propres)
      : null,
    requirement: e.requirement,
    regimeAucun: e.regime === 'aucun',
    regimeDeStat: e.regime === 'hp' || e.regime === 'atk' || e.regime === 'def',
    relicContext: e.relicContext,
    caches: e.caches,
  };
}

/**
 * La relique équipée est-elle EXCLUE du pool cherché (principale, type ou
 * seuil) ? Le candidat le porte (« relique équipée exclue par le filtre ») :
 * la meilleure relique admissible peut alors légitimement noter moins que
 * l'équipée — non-régression CONDITIONNELLE, la version
 * artéfacts de l'invariant suppose l'équipée admissible.
 */
export function reliqueEquipeeExclue(ctx: RelicContext | undefined): boolean {
  if (ctx?.mode !== 'recherche' || !ctx.equipee) return false;
  const id = ctx.equipee.id;
  return !ctx.eligibles.some((r) => r.id === id);
}

/**
 * L'état de la relique d'un candidat, tel que l'écran l'affiche — lu
 * dans le cache de la file, jamais recalculé.
 *
 * - `fixe` : pas de dimension relique (contexte absent, `off`, `equipped`) —
 *   la portée, ou rien ;
 * - `en attente` : mode `recherche`, la file n'a pas encore traité ce build
 *   (son entrée est ABSENTE du cache — la même absence qui dit « paire en
 *   attente ») : ses stats sont celles du moteur, SANS relique, son score
 *   n'est pas exact ;
 * - `rejete` : mode `recherche`, aucun couple faisable — le classement
 *   l'écarte, il n'est jamais affiché ;
 * - `resolue` : la relique retenue, avec les deux marques que la carte
 *   affiche.
 */
export type EtatRelique =
  | { etat: 'fixe'; relique: RelicDetail | undefined }
  | { etat: 'en attente' }
  | { etat: 'rejete' }
  | { etat: 'resolue'; relique: RelicDetail; sansEffetSurLeTri: boolean; equipeeExclue: boolean };

export function etatReliqueDuBuild(
  resultat: ResultatArtefacts | undefined,
  ctx: RelicContext | undefined,
  reliquePortee: RelicDetail | undefined
): EtatRelique {
  if (ctx?.mode !== 'recherche') return { etat: 'fixe', relique: reliquePortee };
  if (!resultat) return { etat: 'en attente' };
  if (!resultat.conforme || !resultat.relique) return { etat: 'rejete' };
  return {
    etat: 'resolue',
    relique: resultat.relique,
    sansEffetSurLeTri: resultat.sansEffetSurLeTri === true,
    equipeeExclue: reliqueEquipeeExclue(ctx),
  };
}
