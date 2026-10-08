// Producteurs de l'écran : paramètres de choix des paires, paire
// représentative et deux crans de « Meilleurs artéfacts offensifs ». La fiche
// garde sa propre relique.
import { ARTIFACT_KINDS, type ArtifactDetail, type ArtifactKind, type GearSet } from '../types';
import type { Objective } from './runeBuildOptim';
import type { StatKey } from './effects';
import type { PorteurArtefact } from './artifacts';
import { candidatsParSorte, type ArtifactSearchParams, type ChoixPrincipale, type LigneVerrouillee } from './artifactOptim';
import { statsParPaire } from './stats';
import {
  artifactDamageProfile, codesAmplificationActifs, degatsBrutsArtefactsParCoup, statsDesLignesBrutes,
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

/**
 * Les pièces que la résolution ne choisit pas : celle que la fiche porte sur
 * chaque emplacement figé (`sortesFigeesDe`), `null` pour un emplacement figé
 * vide — exactement ce que `candidatsParSorte` (artifactOptim.ts) lit dans
 * `equipes` en `'equipped'`, avant un contrôle d'éligibilité qui ne dépend que
 * du porteur (l'espèce). Une sorte « Libre » ou à principale imposée n'y entre
 * pas : sa pièce portée n'est jamais lue.
 *
 * Entre dans la signature de la file : valider un
 * build de CE monstre, « Voir le runage réellement porté » ou changer
 * d'exemplaire de la même espèce changent `selected.gear.artifacts` sans rien
 * changer d'autre à la signature — l'emplacement figé changeait alors de pièce
 * pour les builds encore à résoudre, pas pour ceux déjà en cache.
 */
export function piecesFigeesDe(
  principaleParSorte: Partial<Record<ArtifactKind, ChoixPrincipale>>,
  equipes: readonly ArtifactDetail[]
): { sorte: ArtifactKind; piece: ArtifactDetail | null }[] {
  return sortesFigeesDe(principaleParSorte).map((sorte) => ({ sorte, piece: equipes.find((a) => a.kind === sorte) ?? null }));
}

/** Ensemble vide de réservations : le CLI et le différentiel n'ont pas de liste de travail. */
export const AUCUN_ARTEFACT_RESERVE: ReadonlySet<number> = new Set();

/**
 * Les `ArtifactSearchParams` de la fiche, sans `evaluer` (chaque appelant
 * pose le sien). Producteur PUR appelé par l'écran (`artifactParams`,
 * OptimizerSection.tsx), le CLI (`paramsArtefacts`, recipeToSearchParams.ts)
 * et le différentiel relique (`entreeResolution`, relicDifferentiel.ts) :
 * un assemblage recopié par chacun perdrait la neutralisation des verrous.
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
 *   (> 0) retirent leur stat de la dominance.
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

/**
 * Les stats lues par les lignes 218–221 des artéfacts que la résolution peut
 * équiper avec ces paramètres — `SearchParams.statsLignesArtefactsEquipables`,
 * que la dominance des runes protège en « Dégâts réels ». Appelé par l'écran
 * (`handleSearch`, sur `artifactParams`) et par le CLI
 * (`resolveStatsLignesArtefacts`, sur `artefactsDuCli`).
 *
 * L'union porte sur les candidats de `candidatsParSorte`, des deux sortes :
 * la vue COMPLÈTE, avant élagage et sans verrous, dont la résolution
 * (`chercherPaires`, par `candidatsPourRecherche`) ne tire qu'une partie — un
 * sur-ensemble sûr. Elle suit donc la principale imposée et « Garder
 * l'artéfact équipé » par sorte (cas mixte compris) et, sans optimisation,
 * se réduit aux pièces portées. Le CLI n'a pas de réservations : son union
 * peut être plus large que celle de l'écran, jamais plus étroite.
 */
export function statsLignesArtefactsEquipables(params: ArtifactSearchParams): StatKey[] {
  const pieces = ARTIFACT_KINDS.flatMap(({ key }) => candidatsParSorte(params, key)).filter((a): a is ArtifactDetail => a != null);
  return statsDesLignesBrutes(artifactDamageProfile(pieces));
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
    // Seuls les points Bravoure/Éternité/Origine entrent dans 218–221
    // (docs/02-app/degats-reels/ § Les valeurs de jeu
    // — curées, avec leur source). Conquête et Ténacité ne multiplient pas ce brut.
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
