// Résolution EXACTE de l'équipement d'UN build : la paire d'artéfacts ET la
// relique, ensemble (garantie G, « consommation »).
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
// deux notes indépendantes (D6) : la note d'un couple est le `score` que
// `chercherPaires` lui a donné par `evaluer` — le régime effectif, construit
// sur les stats AVEC la candidate — et rien d'autre.
//
// ⚠️ Ce module ne planifie rien (le « quand » vit dans
// `useArtifactOptimQueue`, le « qui » dans `artifactQueue.ts`) : il répond à
// « quel équipement pour CE build ». C'est la partie pure que le différentiel
// contre l'oracle (`tests/relic-queue.test.ts`) exerce sur TOUS les candidats
// d'une recherche, sans navigateur.

import { ArtifactDetail, ElementKey, GearSet, RelicDetail, RuneDetail } from '../types';
import { StatRow, computeStats, statsParPaire } from './stats';
import { ArtifactSearchParams, MemoPreFiltre, PaireArtefacts, pairesParScore } from './artifactOptim';
import {
  BuildCandidate,
  BuildRequirement,
  RechercheRefusee,
  conditionsPaireFixePosees,
  respecteConditionsAvecRelique,
  respecteConditionsPaireFixe,
} from './runeBuildOptim';
import { RelicContext, bestRelicForBuild } from './relicOptim';
import { ResultatArtefacts } from './artifactQueue';
import { CacheProfilsParPaire, DegatsContext, RegimeArtefacts, evaluerPourRegime } from './artifactEvaluation';
import { DamageSetup, aurasPropresDesRunes } from './damage';

/**
 * Ce que la résolution de PLUSIEURS builds peut partager sans changer un
 * résultat : le profil de dégâts de chaque paire
 * (`CacheProfilsParPaire`, qui ne dépend que des deux pièces) et les
 * candidats élagués de chaque sorte (`MemoPreFiltre`, sur leurs entrées
 * réelles). Les deux sont bornés.
 *
 * ⚠️ **Durée de vie : une file** — créés par l'écran avec la signature des
 * réglages et les paramètres de paires (donc l'inventaire), par le CLI une
 * fois par recette ; jamais un état global du module, qu'un changement
 * d'inventaire laisserait périmé.
 */
export interface CachesResolution {
  profils: CacheProfilsParPaire;
  preFiltre: MemoPreFiltre;
}

export function nouveauxCachesResolution(): CachesResolution {
  return { profils: new CacheProfilsParPaire(), preFiltre: new MemoPreFiltre() };
}

/**
 * Ce qu'il faut pour résoudre l'équipement d'UN build.
 *
 * ⚠️ `faireParams(relique)` construit les paramètres de `chercherPaires` avec
 * un `evaluer` dont les stats INCLUENT cette relique (`statsParPaire({ ...gear,
 * relic: relique })`) — c'est l'appelant qui possède le régime effectif et le
 * contexte de dégâts (`evaluerPourRegime`, surcharges : pas de repli
 * silencieux). Hors mode `recherche`, il est appelé avec `gear.relic` : la
 * portée, exactement comme avant ce lot.
 */
export interface EntreeResolution {
  // Le build : base, ses 6 runes, les artéfacts PORTÉS, la relique PORTÉE
  // (celle que le moteur a appliquée, `SearchParams.relic`).
  gear: GearSet;
  faireParams: (relique: RelicDetail | undefined) => ArtifactSearchParams;
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

function artefactsDe(p: PaireArtefacts): ArtifactDetail[] {
  return [p.element, p.archetype].filter((a): a is ArtifactDetail => a != null);
}

/**
 * Le chemin d'AVANT ce lot, relique FIXE (`gear.relic`) : la meilleure paire
 * au score, la première CONFORME si un minimum est posé — recopié de
 * `useArtifactOptimQueue.tranche()` tel qu'il était, pour que le chemin écran
 * sans contexte reste byte-identique.
 */
function resoudreReliqueFixe(e: EntreeResolution, relique: RelicDetail | undefined): ResultatArtefacts {
  // ⚠️ TOUTES les paires, pas seulement la meilleure — il faut la meilleure
  // QUI TIENT LES MINIMUMS, pas la meilleure tout court. `pairesParScore` les
  // rend dans l'ordre de `chercherPaires`, et ne trie l'ensemble que si la
  // meilleure ne convient pas.
  const r = pairesParScore(e.faireParams(relique), e.caches?.preFiltre);
  // Parcours par score DÉCROISSANT, arrêt à la première conforme : dans le cas
  // courant c'est la première, et on ne recalcule les stats que pour les
  // paires réellement examinées.
  let meilleure: PaireArtefacts | null = null;
  let artefactsRetenus: ArtifactDetail[] = [];
  let conforme = false;
  for (const p of r.paires) {
    const arts = artefactsDe(p);
    // Premier tour : on retient la meilleure au score, qu'elle soit conforme
    // ou non — c'est elle qu'on montrera si AUCUNE ne l'est, pour que le
    // diagnostic reste lisible plutôt que d'afficher un build sans artéfacts.
    if (!meilleure) {
      meilleure = p;
      artefactsRetenus = arts;
    }
    if (!e.respecteConditions || e.respecteConditions(arts)) {
      meilleure = p;
      artefactsRetenus = arts;
      conforme = true;
      break;
    }
  }
  return {
    paire: meilleure,
    artefacts: artefactsRetenus,
    // ⚠️ Recalculées avec la paire RETENUE : la stat principale d'un artéfact
    // entre dans les stats du monstre. Sans ça, la carte afficherait des stats
    // issues de la paire supposée à côté des artéfacts réellement choisis.
    stats: computeStats({ ...e.gear, artifacts: artefactsRetenus, relic: relique }),
    meilleurSansVerrous: r.meilleurSansVerrous,
    conforme,
  };
}

interface CoupleFaisable {
  paire: PaireArtefacts;
  artefacts: ArtifactDetail[];
  stats: StatRow[];
  meilleurSansVerrous: number | null;
}

/**
 * L'équipement de CE build : sa paire et sa relique, résolues ensemble.
 *
 * Hors mode `recherche` (contexte absent — chemin écran avant 5c —, `off`,
 * `equipped`) : la relique portée est fixe, la file ne résout que la paire,
 * comportement d'avant. En mode `recherche` : le contrat des sept étapes
 * (en-tête).
 *
 * ⚠️ **Aucun couple faisable → `conforme: false`**, le build est rejeté par
 * le classement (`affichees`), jamais affiché. Le résultat porte quand même
 * le meilleur couple au score de la PREMIÈRE éligible par `id` — lisible en
 * diagnostic, jamais montré.
 */
export function resoudreEquipementDuBuild(e: EntreeResolution): ResultatArtefacts {
  const ctx = e.relicContext;
  if (ctx?.mode !== 'recherche') return resoudreReliqueFixe(e, e.gear.relic);

  // (1) Le pool résolu, transporté par le contexte — jamais recalculé ici.
  const candidates = ctx.eligibles;
  // Vide en mode `recherche` = la recherche a été REFUSÉE en amont
  // (`prepareSearch`) et n'a produit aucun candidat : arriver ici est une
  // incohérence, jamais un « build sans relique » silencieux (D1).
  if (candidates.length === 0) throw new RechercheRefusee(ctx.vide ?? 'inventaire');

  const parRelique = new Map<number, CoupleFaisable>();
  // Le meilleur couple AU SCORE de la première éligible par `id`, faisable
  // ou non — ce qu'on montre en diagnostic si AUCUN couple n'est faisable.
  const diagnostic: { valeur: { relique: RelicDetail; couple: CoupleFaisable } | null } = { valeur: null };

  const meilleure = bestRelicForBuild(
    candidates,
    (relique) => {
      // (2) La candidate REMPLACE la portée (jamais un cumul) : les paires
      // sont classées avec les stats qui l'incluent.
      // Par score décroissant, triées seulement au-delà de la première.
      const r = pairesParScore(e.faireParams(relique), e.caches?.preFiltre);
      for (const p of r.paires) {
        const arts = artefactsDe(p);
        // (3) + (4) Stats EXACTES du couple, minimums ET maximums — un seul
        // `computeStats` par couple examiné, et le couple qui viole une
        // condition est éliminé AVANT d'être noté.
        const { stats, respecte } = respecteConditionsAvecRelique({ ...e.gear, artifacts: arts }, relique, e.requirement);
        const couple = { paire: p, artefacts: arts, stats, meilleurSansVerrous: r.meilleurSansVerrous };
        if (!diagnostic.valeur || relique.id < diagnostic.valeur.relique.id) diagnostic.valeur = { relique, couple };
        if (!respecte) continue;
        parRelique.set(relique.id, couple);
        // (5) La note du couple par le régime effectif : `p.score`, calculé
        // par le MÊME `evaluer` qui a classé les paires — jamais une seconde
        // note. Les paires arrivant par score décroissant, le premier couple
        // faisable est le meilleur faisable pour CETTE candidate.
        return p.score;
      }
      return 'infaisable';
    },
    // (6) Le meilleur couple faisable entre candidates — ex æquo : `id`
    // croissant (`bestRelicForBuild`, la même convention que l'oracle),
    // sauf en régime de stat, où la portée passe d'abord ;
    // régime `aucun`.
    { regimeAucun: e.regimeAucun, equipee: ctx.equipee, departagePortee: e.regimeDeStat }
  );

  // (7) Aucun couple faisable : rejeté.
  if (!meilleure) {
    const d = diagnostic.valeur;
    return {
      paire: d?.couple.paire ?? null,
      artefacts: d?.couple.artefacts ?? [],
      stats: d?.couple.stats ?? computeStats({ ...e.gear, relic: undefined }),
      meilleurSansVerrous: d?.couple.meilleurSansVerrous ?? null,
      conforme: false,
      relique: d?.relique,
    };
  }

  const retenu = parRelique.get(meilleure.relique.id)!;
  // Garde DÉFENSIVE : la faisabilité
  // s'est décidée à l'étape (4) ; le couple retenu la repasse — un échec ici
  // est un bug, pas un filtre.
  if (!respecteConditionsAvecRelique({ ...e.gear, artifacts: retenu.artefacts }, meilleure.relique, e.requirement).respecte) {
    throw new Error(`resoudreEquipementDuBuild : le couple retenu (relique ${meilleure.relique.id}) viole les conditions après sélection — bug de résolution.`);
  }
  return {
    paire: retenu.paire,
    artefacts: retenu.artefacts,
    stats: retenu.stats,
    meilleurSansVerrous: retenu.meilleurSansVerrous,
    conforme: true,
    relique: meilleure.relique,
    ...(meilleure.sansEffetSurLeTri ? { sansEffetSurLeTri: true as const } : {}),
  };
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
 *   ET la relique (D7 : un seul régime pour l'équipement complet) — jamais un
 *   contexte de dégâts optionnel silencieusement absorbé par le helper.
 * - `requirement` : les conditions AVEC auras (`avecAurasConditions`).
 * - `relicContext` : celui de la recherche LANCÉE (garantie G : jamais une
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
    // paire (garantie G, jamais un cumul). Hors mode `recherche`, la
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
      // ajouté après coup (D6).
      const exclusive = { relique, setup: e.exclusive.setup, element: e.exclusive.element };
      // ⚠️ **La paire se choisit sur le critère RÉELLEMENT regardé** (le
      // régime effectif), pas sur une somme de statistiques principales —
      // voir `evaluerPourRegime` (`artifactEvaluation.ts`). Sur Efficience et
      // Vitesse (régime `'aucun'`), il n'y a RIEN à maximiser : le seul
      // travail qui compte est la faisabilité (spec/outils/optimizer/moteur/
      // artefacts.md § Régime de la paire).
      const evaluer =
        e.regime === 'degats_reels'
          ? evaluerPourRegime(e.regime, statsAvec, propres, e.degats!, exclusive, e.caches?.profils)
          : evaluerPourRegime(e.regime, statsAvec, propres, exclusive);
      return { ...e.artifactParams, evaluer };
    },
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
 * L'état de la relique d'un candidat, tel que l'écran (5c) l'affiche — lu
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
