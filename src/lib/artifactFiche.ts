// Producteurs de l'écran : paramètres de choix des paires, paire
// représentative et deux crans de « Meilleurs artéfacts offensifs ». La fiche
// garde sa propre relique.
import { ARTIFACT_KINDS, type ArtifactDetail, type ArtifactKind, type GearSet } from '../types';
import type { Objective } from './runeBuildOptim';
import type { StatKey } from './effects';
import type { PorteurArtefact } from './artifacts';
import type { ArtifactSearchParams, ChoixPrincipale, LigneVerrouillee } from './artifactOptim';
import { statsParPaire } from './stats';
import {
  artifactDamageProfile, codesAmplificationActifs, degatsBrutsArtefactsParCoup,
  type AurasPropres, type DamageSetup, type MonsterWideDamageModifiers,
} from './damage';
import {
  evaluerPourRegime, regimeArtefacts, regimeEquipementDe,
  type CanalExclusive, type DegatsContext,
} from './artifactEvaluation';
import { apportExclusive, statsAvecApport } from './relicExclusive';

/**
 * Les emplacements figés sur « Garder l'artéfact équipé ». Une sorte absente
 * vaut « Libre ». Lue par l'éditeur de verrous (grisé) et par
 * `parametresArtefactsFiche` (neutralisation) : une seule définition.
 */
export function sortesFigeesDe(principaleParSorte: Partial<Record<ArtifactKind, ChoixPrincipale>>): ArtifactKind[] {
  return ARTIFACT_KINDS.map(({ key }) => key).filter((key) => (principaleParSorte[key] ?? 'libre') === 'equipped');
}

/** Ensemble vide de réservations : le CLI et le différentiel n'ont pas de liste de travail. */
export const AUCUN_ARTEFACT_RESERVE: ReadonlySet<number> = new Set();

/**
 * Les `ArtifactSearchParams` de la fiche, sans `evaluer` (chaque appelant
 * pose le sien) — degats-et-aura 6bis-b6, constats C5 et C6 de la revue
 * technique 6bis-b. Producteur PUR appelé par l'écran (`artifactParams`,
 * OptimizerSection.tsx), le CLI (`paramsArtefacts`, recipeToSearchParams.ts)
 * et le différentiel relique (`entreeResolution`, relicDifferentiel.ts) :
 * jusque-là, chacun recopiait l'assemblage, et le CLI avait perdu la
 * neutralisation des verrous.
 *
 * - `reserves` : les artéfacts réservés par les autres builds validés de la
 *   liste active (écran) — un artéfact physique ne se porte que sur un
 *   monstre à la fois. Le CLI et le différentiel n'ont pas de liste :
 *   `AUCUN_ARTEFACT_RESERVE`. Sans réservation, l'inventaire est rendu
 *   tel quel (même tableau).
 * - `optimiserArtefacts` faux : « Garder l'artéfact équipé » IMPOSÉ des deux
 *   côtés. Le monstre garde ses pièces et leurs stats ; rien n'est cherché.
 * - `damageSetup` : celui du canal exclusive, d'où viennent les codes
 *   d'amplification de buff (`codesAmplificationActifs`) — sans eux, une
 *   amplification est éliminée par dominance alors qu'elle vaut des dégâts.
 * - `maxStats` : les maximums de la recherche ; seuls ceux réellement posés
 *   (> 0) retirent leur stat de la dominance (B.5b bis, bloquant 1).
 */
export function parametresArtefactsFiche(e: {
  porteur: PorteurArtefact;
  inventaire: ArtifactDetail[];
  reserves: ReadonlySet<number>;
  equipes: ArtifactDetail[];
  optimiserArtefacts: boolean;
  principaleParSorte: Partial<Record<ArtifactKind, ChoixPrincipale>>;
  lignesVerrouillees: LigneVerrouillee[];
  damageSetup: DamageSetup;
  maxStats: Partial<Record<StatKey, number>>;
}): Omit<ArtifactSearchParams, 'evaluer'> & Required<Pick<ArtifactSearchParams, 'lignesVerrouillees' | 'codesAmplification' | 'maxStatsActifs'>> {
  return {
    porteur: e.porteur,
    inventaire: e.reserves.size === 0 ? e.inventaire : e.inventaire.filter((a) => !e.reserves.has(a.id)),
    equipes: e.equipes,
    principaleParSorte: e.optimiserArtefacts ? e.principaleParSorte : { element: 'equipped', archetype: 'equipped' },
    // ⚠️ **Un verrou n'a aucun sens sans recherche.** Sans optimisation, ou
    // avec les DEUX emplacements figés, il n'y a qu'une paire possible :
    // l'écarter parce qu'elle ne tient pas une ligne ne laisse aucune
    // solution de rechange — `paireRepresentative` rendrait un tableau vide et
    // la résolution rejetterait chaque build. Les verrous restants ne sont PAS
    // filtrés ligne par ligne : une ligne posée avant de figer une sorte
    // exprime une exigence que la pièce figée doit tenir, ce que
    // `paireRespecteLignes` vérifie.
    lignesVerrouillees:
      e.optimiserArtefacts && sortesFigeesDe(e.principaleParSorte).length < ARTIFACT_KINDS.length ? e.lignesVerrouillees : [],
    codesAmplification: codesAmplificationActifs(e.damageSetup),
    maxStatsActifs: (Object.keys(e.maxStats) as StatKey[]).filter((k) => (e.maxStats[k] ?? 0) > 0),
  };
}

export function evaluateursArtefactsFiche(
  gear: GearSet,
  objective: Objective,
  propres: AurasPropres,
  degats: DegatsContext | null,
  contexte: Omit<CanalExclusive, 'relique'>,
  combatStats: MonsterWideDamageModifiers['combatStats']
) {
  // Les principales sont déjà dans ces stats ; l'effet unique ne doit
  // jamais modifier la fiche ni les conditions min/max.
  const statsAvec = statsParPaire(gear);
  const exclusive = { ...contexte, relique: gear.relic };
  const reel = degats && evaluerPourRegime('degats_reels', statsAvec, propres, degats, exclusive);
  const brut = (arts: GearSet['artifacts']) => {
    const stats = statsAvec(arts);
    // Recalcul PAR PAIRE : sa principale peut franchir une tranche de Y.
    // A.2 ter (2026-09-30) : seuls les points Bravoure/Éternité/Origine
    // entrent dans 218–221. Conquête et Ténacité ne multiplient pas ce brut.
    const apport = apportExclusive(gear.relic, stats, contexte.setup, propres, contexte.element);
    return degatsBrutsArtefactsParCoup(
      statsAvecApport(stats, apport), contexte.setup, propres, contexte.element,
      artifactDamageProfile(arts), { combatStats }
    );
  };
  // L'objectif de RECHERCHE gouverne la représentative, jamais le tri.
  const regime = regimeEquipementDe(regimeArtefacts(objective), !!degats);
  const representatif = regime === 'degats_reels' ? reel!
    : evaluerPourRegime(regime, statsAvec, propres,
      regime === 'ehp' ? exclusive : undefined);
  return { representatif, brut, reel };
}
