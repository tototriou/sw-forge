// Résolution EXACTE de l'équipement d'UN build : la paire d'artéfacts ET la
// relique, ensemble (implementation-relique, lot 5b — garantie G,
// « consommation »).
//
// ⚠️ **Pourquoi ensemble, et pas la relique après la paire.** La principale
// d'une relique est un POURCENTAGE qui entre dans `computeStats` AVANT les
// plats d'artéfact : la meilleure paire dépend des stats, donc de la relique.
// Choisir la paire avec la relique portée puis « ajouter » une relique
// noterait un couple qui n'existe pas. Chaque candidate reçoit SES paires,
// classées par le régime effectif avec ses stats à elle.
//
// ⚠️ **L'ordre du contrat est absolu** (B.5b, rév. 6 BLOC-1 — l'ordre
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

import { ArtifactDetail, GearSet, RelicDetail } from '../types';
import { StatRow, computeStats } from './stats';
import { ArtifactSearchParams, PaireArtefacts, chercherPaires } from './artifactOptim';
import { BuildRequirement, RechercheRefusee, respecteConditionsAvecRelique } from './runeBuildOptim';
import { RelicContext, bestRelicForBuild } from './relicOptim';
import { ResultatArtefacts } from './artifactQueue';

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
   * Le prédicat de conformité d'AVANT ce lot — `respecteMinimums` sur les
   * MINIMUMS seulement (T11, défaut préexistant côté artéfacts, hors
   * chantier) — appliqué hors mode `recherche` pour rester byte-identique à
   * la base. `null` = aucun minimum posé, toute paire convient.
   */
  respecteConditions: ((artefacts: ArtifactDetail[]) => boolean) | null;
  // Minimums ET maximums — le filtre exact de la dimension relique, mode
  // `recherche` seulement (`respecteConditionsAvecRelique`).
  requirement: Pick<BuildRequirement, 'minStats' | 'maxStats'>;
  // Le régime effectif est-il `aucun` (Efficience, Vitesse, VIT, TC, DCC,
  // RES, PRE) ? La relique n'a alors aucun effet sur le tri : contrat de B.3
  // (équipée si candidate et faisable, sinon première par `id`).
  regimeAucun: boolean;
  // Le contexte canonique de la recherche dont ce build est issu (garantie
  // G) — jamais recalculé ici. Absent : chemin écran d'avant le lot 5c.
  relicContext: RelicContext | undefined;
}

function artefactsDe(p: PaireArtefacts): ArtifactDetail[] {
  return [p.element, p.archetype].filter((a): a is ArtifactDetail => a != null);
}

/**
 * Le chemin d'AVANT ce lot, relique FIXE (`gear.relic`) : la meilleure paire
 * au score, la première CONFORME si un minimum est posé — recopié de
 * `useArtifactOptimQueue.tranche()` tel qu'il était, pour que le chemin écran
 * sans contexte reste byte-identique (fait relevé au brief, rév. 26).
 */
function resoudreReliqueFixe(e: EntreeResolution, relique: RelicDetail | undefined): ResultatArtefacts {
  // ⚠️ TOUTES les paires, pas seulement la meilleure — il faut la meilleure
  // QUI TIENT LES MINIMUMS, pas la meilleure tout court. `chercherPaires`
  // accumule et trie déjà l'ensemble ; `combien` ne fait que trancher à la
  // fin, demander la liste complète ne coûte donc rien.
  const r = chercherPaires(e.faireParams(relique), Number.MAX_SAFE_INTEGER);
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

  // (1) Le pool résolu de B.3, transporté par 5a — jamais recalculé ici.
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
      const r = chercherPaires(e.faireParams(relique), Number.MAX_SAFE_INTEGER);
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
    // croissant (`bestRelicForBuild`, la même convention que l'oracle) ;
    // régime `aucun` : contrat de B.3.
    { regimeAucun: e.regimeAucun, equipee: ctx.equipee }
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
  // Garde DÉFENSIVE (rév. 5 C1, requalifiée rév. 7 CORR-4) : la faisabilité
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
 * La relique équipée est-elle EXCLUE du pool cherché (principale, type ou
 * seuil) ? Le candidat le porte (« relique équipée exclue par le filtre ») :
 * la meilleure relique admissible peut alors légitimement noter moins que
 * l'équipée — non-régression CONDITIONNELLE (rév. 4, MAJ-3), la version
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
