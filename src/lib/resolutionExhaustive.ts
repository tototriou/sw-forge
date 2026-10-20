// Résolution EXHAUSTIVE de l'équipement d'UN build : chaque paire de chaque
// relique éligible est notée, puis parcourue par score décroissant. C'est la
// RÉFÉRENCE du contrat de `relicQueue.ts` (en-tête : l'ordre des sept
// étapes), écrite étape par étape, et le DIAGNOSTIC d'un build rejeté (le
// meilleur couple au score, jamais montré à l'écran).
//
// ⚠️ **Hors du chemin de l'app.** L'écran, le Worker de résolution et le CLI
// résolvent par `resoudreEquipementDuBuild` (relicQueue.ts), qui passe par
// la résolution rapide (`resolutionRapide.ts`) : même résultat pour un build
// conforme, sans le diagnostic d'un build rejeté. Ce module sert au
// diagnostic à la demande (option `diagnostic` du CLI et du harnais), au
// repli de la résolution rapide sur une note NaN, et de référence aux tests
// et au banc de la résolution.

import { ArtifactDetail, RelicDetail } from '../types';
import { StatRow, computeStats } from './stats';
import { PaireArtefacts, pairesParScore } from './artifactOptim';
import { RechercheRefusee, respecteConditionsAvecRelique } from './runeBuildOptim';
import { bestRelicForBuild } from './relicOptim';
import type { ResultatArtefacts } from './artifactQueue';
import type { EntreeResolution } from './relicQueue';

function artefactsDe(p: PaireArtefacts): ArtifactDetail[] {
  return [p.element, p.archetype].filter((a): a is ArtifactDetail => a != null);
}

/**
 * Le chemin relique FIXE (`gear.relic`), hors mode `recherche` : la meilleure paire
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
 * L'équipement de CE build, toutes les paires notées : sa paire et sa
 * relique, résolues ensemble.
 *
 * Hors mode `recherche` (contexte absent, `off`,
 * `equipped`) : la relique portée est fixe, seule la paire se résout.
 * En mode `recherche` : le contrat des sept étapes
 * (en-tête de relicQueue.ts).
 *
 * ⚠️ **Aucun couple faisable → `conforme: false`**, le build est rejeté par
 * le classement (`affichees`), jamais affiché. Le résultat porte quand même
 * le meilleur couple au score de la PREMIÈRE éligible par `id` — lisible en
 * diagnostic, jamais montré.
 */
export function resoudreEquipementDuBuildExhaustif(e: EntreeResolution): ResultatArtefacts {
  const ctx = e.relicContext;
  if (ctx?.mode !== 'recherche') return resoudreReliqueFixe(e, e.gear.relic);

  // (1) Le pool résolu, transporté par le contexte — jamais recalculé ici.
  const candidates = ctx.eligibles;
  // Vide en mode `recherche` = la recherche a été REFUSÉE en amont
  // (`prepareSearch`) et n'a produit aucun candidat : arriver ici est une
  // incohérence, jamais un « build sans relique » silencieux.
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
    throw new Error(`resoudreEquipementDuBuildExhaustif : le couple retenu (relique ${meilleure.relique.id}) viole les conditions après sélection — bug de résolution.`);
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
