import type { OptimizerState, RelicMainChoice } from '../hooks/useOptimizerState';
import type { GearSet, RelicDetail } from '../types';
import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from './damage';
import { damageSetupApresChangementMonstre } from './damageSetupTransition';

type ChampDonnee = {
  [K in keyof OptimizerState]: OptimizerState[K] extends (...args: never[]) => unknown ? never : K
}[keyof OptimizerState];

// Les critères personnels suivent le membre ; sélection, préférences
// avancées et états passagers restent globaux. Chaque nouveau champ oblige
// à prendre une décision, même s'il n'entre pas dans la session sur disque.
export const CLASSEMENT_CHAMPS_OPTIMIZER = {
  comboSets: 'personnel', minStats: 'personnel', maxStats: 'personnel',
  excludeBase: 'personnel', optimiserArtefacts: 'personnel', adapterArtefactsAuTri: 'personnel',
  artifactMainByKind: 'personnel', relicMainChoice: 'personnel', relicUniqueChoice: 'personnel',
  lignesVerrouillees: 'personnel', mainStatsBySlot: 'personnel', lockedRunes: 'personnel',
  objective: 'personnel', damageSetup: 'personnel', sortBy: 'personnel',
  compterAurasResPre: 'personnel', critereArtefacts: 'personnel',
  selectedId: 'global', gearSource: 'global', sourceSelector: 'global',
  relicMinUpgrade: 'global', excludeUsedRunes: 'global', excludeUsedScope: 'global',
  excludedSelectors: 'global', adaptiveTrancheWeighting: 'global', exhaustiveSearch: 'global',
  verifierToutesLesCombinaisons: 'global', slotFilterPreset: 'global', showAdvanced: 'global',
  setPickerInvalid: 'global', resultsPage: 'global', openDetailKey: 'global',
  diagnoseBlockingEnabled: 'global', stoppedManually: 'global', importDuCompte: 'global',
  importReliqueTraite: 'global', search: 'global',
  proprietaireCriteres: 'global', rapportCriteres: 'global',
} as const satisfies Record<ChampDonnee, 'personnel' | 'global'>;

type ChampPersonnel = {
  [K in keyof typeof CLASSEMENT_CHAMPS_OPTIMIZER]: typeof CLASSEMENT_CHAMPS_OPTIMIZER[K] extends 'personnel' ? K : never
}[keyof typeof CLASSEMENT_CHAMPS_OPTIMIZER];
export type CriteresOptimizer = Pick<OptimizerState, ChampPersonnel>;
export type LeadPersonnelOptimizer = Pick<DamageSetup, 'leaderSkill' | 'leaderSpeedPct'>;

// Le contexte d'équipe est explicite : impossible de photographier le lead
// affiché en oubliant de fournir le lead personnel conservé dans la mémoire.
export type OrigineLeadPhoto =
  | { type: 'personnel' }
  | { type: 'equipe'; personnel: LeadPersonnelOptimizer };
export type LeadEffectifOptimizer =
  | { type: 'personnel' }
  | { type: 'equipe'; lead: NonNullable<DamageSetup['leaderSkill']> }
  | { type: 'aucun' };

// La VIT importée décrit la fiche. L'objet pourra accueillir un autre mode
// sans changer le type des critères de toutes les sources.
export interface CritereVitesseOptimizer {
  minimum: number;
}
export type CriteresPartielsOptimizer = Partial<Omit<CriteresOptimizer, 'minStats'>> & {
  minStats?: Omit<CriteresOptimizer['minStats'], 'spd'>;
  vitesse?: CritereVitesseOptimizer;
};

// Les critères ne contiennent que des données : copier récursivement évite
// qu'une saisie ultérieure modifie une mémoire ou les défauts partagés.
function copie<T>(valeur: T): T {
  if (Array.isArray(valeur)) return valeur.map((v: unknown) => copie(v)) as T;
  if (valeur !== null && typeof valeur === 'object') {
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, copie(v)])) as T;
  }
  return valeur;
}

export function photoCriteres(etat: CriteresOptimizer, origine: OrigineLeadPhoto): CriteresOptimizer {
  const photo = {} as CriteresOptimizer;
  for (const champ of Object.keys(CLASSEMENT_CHAMPS_OPTIMIZER) as (keyof typeof CLASSEMENT_CHAMPS_OPTIMIZER)[]) {
    if (CLASSEMENT_CHAMPS_OPTIMIZER[champ] === 'personnel') {
      // Les clés viennent de la garde exhaustive, jamais d'un objet importé.
      const k = champ as ChampPersonnel;
      (photo as unknown as Record<ChampPersonnel, unknown>)[k] = copie(etat[k]);
    }
  }
  if (origine.type === 'equipe') {
    delete photo.damageSetup.leaderSkill;
    delete photo.damageSetup.leaderSpeedPct;
    if ('leaderSkill' in origine.personnel) photo.damageSetup.leaderSkill = copie(origine.personnel.leaderSkill);
    if ('leaderSpeedPct' in origine.personnel) photo.damageSetup.leaderSpeedPct = origine.personnel.leaderSpeedPct;
  }
  return photo;
}

export function appliquerCriteres(photo: CriteresOptimizer, lead: LeadEffectifOptimizer): CriteresOptimizer {
  const criteres = photoCriteres(photo, { type: 'personnel' });
  if (lead.type !== 'personnel') {
    // Neutraliser aussi l'ancien champ : sans lui « aucun » pourrait encore
    // se résoudre en lead VIT depuis une ancienne recette.
    delete criteres.damageSetup.leaderSkill;
    delete criteres.damageSetup.leaderSpeedPct;
    if (lead.type === 'equipe') criteres.damageSetup.leaderSkill = copie(lead.lead);
  }
  return criteres;
}

/**
 * Le défaut de `relicMainChoice`, calculé au choix du MONSTRE — jamais une
 * constante : `'equipped'` s'il porte déjà une relique,
 * `'libre'` sinon. Fonction PURE et exportée exprès (même raison que
 * `mainsPourCeCompte`, optimizerRecipe.ts) : elle sert à la fois à
 * `recipeToRelicIntent` (une recette exportée sans ce champ ne le porte pas),
 * à `pickSpecies` (OptimizerSection.tsx) et à la base complète ci-dessous.
 *
 * ⚠️ **Le moteur fait foi pour le défaut** : l'écran doit AFFICHER la
 * valeur que le moteur applique, jamais l'inverse — cette fonction est donc
 * la source unique du calcul, pas une case à cocher qui devinerait.
 */
export function defaultRelicMainChoice(relic: RelicDetail | undefined): RelicMainChoice {
  return relic ? 'equipped' : 'libre';
}

/**
 * Le choix de relique après un changement d'EXEMPLAIRE optimisé, hors du
 * bestiaire (membre de la liste de travail, « un autre exemplaire »,
 * réimport du compte).
 *
 * - Autre espèce, ou compte réimporté : les critères repartent de zéro, le
 *   défaut se recalcule contre la relique du nouvel exemplaire, comme dans
 *   `pickSpecies`.
 * - Même espèce : les critères sont conservés, sauf l'incohérence
 *   « Garder la relique équipée » sur un exemplaire qui n'en porte pas :
 *   le mode `equipped` ne refuse pas la recherche, il la ferait tourner SANS
 *   relique, sans rien en dire — elle redevient « Libre ».
 */
export function relicMainChoiceApresChangementExemplaire(
  choixActuel: RelicMainChoice, relic: RelicDetail | undefined, conserverCriteres: boolean
): RelicMainChoice {
  if (!conserverCriteres) return defaultRelicMainChoice(relic);
  return choixActuel === 'equipped' && !relic ? 'libre' : choixActuel;
}

// Une seule base complète pour l'import et le membre sans mémoire,
// indépendante des critères affichés et résolue contre l'exemplaire réel.
export function baseCompleteCriteres(exemplaire: Pick<GearSet, 'relic'> | undefined): CriteresOptimizer {
  return {
    comboSets: [], minStats: {}, maxStats: {}, excludeBase: true,
    optimiserArtefacts: true, adapterArtefactsAuTri: true, artifactMainByKind: {},
    relicMainChoice: defaultRelicMainChoice(exemplaire?.relic), relicUniqueChoice: 'libre',
    lignesVerrouillees: [], mainStatsBySlot: {}, lockedRunes: {}, objective: 'efficience',
    damageSetup: copie(DEFAULT_DAMAGE_SETUP), sortBy: 'efficience',
    compterAurasResPre: true, critereArtefacts: 'brut',
  };
}

export function completerCriteresImport(
  partiels: CriteresPartielsOptimizer, exemplaire: Pick<GearSet, 'relic'> | undefined
): CriteresOptimizer {
  const { vitesse } = partiels;
  const photo = baseCompleteCriteres(exemplaire);
  for (const champ of Object.keys(photo) as ChampPersonnel[]) {
    const valeur = partiels[champ];
    if (valeur !== undefined) {
      (photo as unknown as Record<ChampPersonnel, unknown>)[champ] = copie(valeur);
    }
  }
  if (vitesse) photo.minStats = { ...photo.minStats, spd: vitesse.minimum };
  return photo;
}

export function criteresApresChangementEspece(
  precedent: Pick<CriteresOptimizer, 'damageSetup' | 'compterAurasResPre' | 'critereArtefacts'>,
  motif: 'bestiaire' | 'membre' | 'compte',
  exemplaire: Pick<GearSet, 'relic'> | undefined
): CriteresOptimizer {
  const criteres = baseCompleteCriteres(exemplaire);
  if (motif !== 'compte') {
    criteres.damageSetup = copie(damageSetupApresChangementMonstre(precedent.damageSetup));
    criteres.compterAurasResPre = precedent.compterAurasResPre;
  }
  // Les gestes historiques ne réinitialisent ce cran qu'au bestiaire.
  // Le réimport du compte le conservait, comme le choix d'un membre.
  if (motif !== 'bestiaire') criteres.critereArtefacts = precedent.critereArtefacts;
  return criteres;
}
