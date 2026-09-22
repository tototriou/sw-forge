// Quel `evaluer` (callback de notation d'une paire d'artéfacts, voir
// `artifactOptim.ts`) pour quel régime — UNE seule définition, consommée par
// les trois sites qui en construisaient une chacun (OptimizerSection.tsx ×2,
// scripts/lib/recipeToSearchParams.ts ×1). Voir
// spec/outils/optimizer/decisions/cadrage-score-artefacts-ehp.md pour le cadrage complet.
//
// ⚠️ Volontairement SÉPARÉ de `artifactOptim.ts`, qui reste libre de toute
// dépendance à `damage.ts`/`stats.ts` (spec/outils/optimizer/artefacts.md,
// §6bis, « ce qui garde ce module testable sans monter un contexte de
// dégâts »). `computeTotalDamage`/`pvEffectifs`/`statsParPaire` casseraient
// cette frontière.

import { ArtifactDetail, ElementKey, RelicDetail } from '../types';
import { StatKey } from './effects';
import { Objective, pvEffectifs, type RealDamageContext } from './runeBuildOptim';
import { StatRow } from './stats';
import { DamageSetup, artifactDamageProfile, computeTotalDamage } from './damage';
import { APPORT_NEUTRE, apportExclusive, facteurTenacite, statsAvecApport } from './relicExclusive';

export type RegimeArtefacts = 'aucun' | 'hp' | 'atk' | 'def' | 'ehp' | 'degats_reels';

/**
 * Le régime qui gouverne le choix de paire pour un critère donné (tri OU
 * objectif — l'appelant décide lequel des deux passer).
 *
 * ⚠️ Branche EXHAUSTIVE sur les valeurs réelles de `StatKey | Objective`, pas
 * un `else` qui absorberait un cas imprévu : `'aucun'` est le régime propre à
 * efficience/vitesse/TC/DCC/RES/PRE — celles où AUCUN artéfact n'entre dans
 * le score (voir §12.6 d'artefacts.md), pas un repli pour un oubli.
 */
export function regimeArtefacts(critere: StatKey | Objective): RegimeArtefacts {
  if (critere === 'degats_reels' || critere === 'ehp') return critere;
  if (critere === 'hp' || critere === 'atk' || critere === 'def') return critere;
  return 'aucun';
}

/**
 * Le régime EFFECTIF de l'ÉQUIPEMENT COMPLET — paire d'artéfacts ET relique,
 * un seul régime pour les deux (D7, implementation-relique) : rabat
 * `'degats_reels'` sur `'aucun'` tant qu'aucun sort n'est calculable pour ce
 * monstre, sinon le régime brut tel quel.
 *
 * ⚠️ **C'est CE régime, jamais le brut, qui doit alimenter la signature de
 * cache et le choix de paire/relique** (B.5b bis, contrôle 4 — un bug a
 * laissé passer le régime brut dans la signature) : pendant la transition
 * « sort indisponible → calculable » (le contexte de dégâts passe de
 * `null`/absent à disponible), le régime brut reste `'degats_reels'` dans
 * les deux cas — un cache indexé dessus resterait périmé.
 */
export function regimeEquipementDe(regime: RegimeArtefacts, contexteDegatsDisponible: boolean): RegimeArtefacts {
  return regime === 'degats_reels' && !contexteDegatsDisponible ? 'aucun' : regime;
}

// Le choix de paire recalcule SON profil d'artéfacts, mais doit recevoir tout
// le reste du même contexte que `objectiveScore`. Le dériver du type moteur
// rend toute future extension de `RealDamageContext` obligatoire ici aussi :
// une omission ne peut plus rester silencieuse comme avant cet audit.
export type DegatsContext = Omit<RealDamageContext, 'artefacts'>;

/**
 * Le CANAL EXCLUSIVE (implementation-relique, lot 7 — B.7) : la relique
 * qu'`evaluate` est en train d'essayer pour ce build, et le contexte dont son
 * assiette `Y` a besoin (leader skill, compétences d'invocateur).
 *
 * ⚠️ **L'apport se recalcule PAR PAIRE**, jamais une fois par relique : `Y`
 * est une statistique de début de combat, et la principale plate d'un
 * artéfact y entre. Deux paires différentes peuvent donc franchir un palier
 * de tranche différent.
 *
 * ⚠️ **Une seule note** (D6) : le score rendu ici est celui qui choisit la
 * paire, celui qui choisit la relique (`PaireArtefacts.score`, lu par
 * `bestRelicForBuild`) et celui qui classe. Jamais un score de principale
 * auquel on ajouterait un score d'exclusive.
 *
 * Absent → apport neutre, comportement strictement d'avant le lot 7.
 */
export interface CanalExclusive {
  relique: RelicDetail | undefined;
  setup: DamageSetup;
  element: ElementKey | null;
}

// Surcharge 1 : `degats_reels` EXIGE le contexte de dégâts — omission =
// erreur `tsc`, pas un repli silencieux sur la somme des principales.
export function evaluerPourRegime(
  regime: 'degats_reels',
  statsAvec: (arts: ArtifactDetail[]) => StatRow[],
  degats: DegatsContext,
  exclusive?: CanalExclusive
): (arts: ArtifactDetail[]) => number;
// Surcharge 2 : tout autre régime n'a pas besoin de contexte de dégâts.
export function evaluerPourRegime(
  regime: Exclude<RegimeArtefacts, 'degats_reels'>,
  statsAvec: (arts: ArtifactDetail[]) => StatRow[],
  exclusive?: CanalExclusive
): (arts: ArtifactDetail[]) => number;
// Implémentation — signature élargie, jamais appelée directement de
// l'extérieur (les deux surcharges ci-dessus sont le seul contrat public).
export function evaluerPourRegime(
  regime: RegimeArtefacts,
  statsAvec: (arts: ArtifactDetail[]) => StatRow[],
  degatsOuExclusive?: DegatsContext | CanalExclusive,
  exclusiveApresDegats?: CanalExclusive
): (arts: ArtifactDetail[]) => number {
  // Le 3ᵉ paramètre porte le contexte de dégâts en `degats_reels`, le canal
  // exclusive partout ailleurs — les deux surcharges publiques le fixent, ce
  // démêlage n'existe que pour l'implémentation commune.
  const degats = regime === 'degats_reels' ? (degatsOuExclusive as DegatsContext | undefined) : undefined;
  const exclusive = regime === 'degats_reels' ? exclusiveApresDegats : (degatsOuExclusive as CanalExclusive | undefined);
  // L'apport de la relique essayée, pour CETTE paire d'artéfacts.
  const apportPour = (stats: StatRow[]) =>
    exclusive ? apportExclusive(exclusive.relique, stats, exclusive.setup, exclusive.element) : APPORT_NEUTRE;
  if (regime === 'degats_reels') {
    // ⚠️ Backstop runtime, censé être INATTEIGNABLE une fois les deux
    // surcharges en place — un appel bien typé ne peut pas arriver ici sans
    // `degats`. Gardé pour un appelant qui contournerait le typage (`as
    // any`) : mieux vaut planter que scorer sur une somme incommensurable.
    if (!degats) {
      throw new Error(
        "evaluerPourRegime('degats_reels') exige un contexte de dégâts — les surcharges publiques devraient déjà l'imposer à la compilation."
      );
    }
    return (arts) => {
      const brutes = statsAvec(arts);
      const apport = apportPour(brutes);
      return computeTotalDamage(
        degats.profile,
        degats.passifs,
        // Bravoure/Éternité/Origine : des POINTS de stat, jamais posés dans
        // `computeStats` (les minimums/maximums restent jugés hors combat).
        statsAvecApport(brutes, apport),
        degats.setup,
        degats.element,
        artifactDamageProfile(arts),
        degats.critSiPlusRapide,
        degats.bonusDegatsSelonVit,
        degats.bonusDegatsStack,
        degats.monsterWide,
        degats.bonusDegatsConditionnel,
        degats.bonusDegatsSelonCr,
        degats.bonusDegatsSelonDef,
        degats.bonusSiAtqSeuil,
        // Conquête — additive dans le bracket `DMG%`.
        apport.dmgPct
      );
    };
  }
  if (regime === 'ehp') {
    return (arts) => {
      const brutes = statsAvec(arts);
      const apport = apportPour(brutes);
      // Ténacité — terme de `Réductions` : des PV effectifs ÉQUIVALENTS.
      return pvEffectifs(statsAvecApport(brutes, apport)) * facteurTenacite(apport.reductionPct);
    };
  }
  if (regime === 'hp' || regime === 'atk' || regime === 'def') {
    // `!` et non `?? 0` : computeStats() garantit une entrée par StatKey —
    // si elle manquait un jour, on veut un plantage, pas un score à 0 qui
    // ferait perdre silencieusement cette stat dans le classement.
    return (arts) => {
      const brutes = statsAvec(arts);
      return statsAvecApport(brutes, apportPour(brutes)).find((r) => r.key === regime)!.total;
    };
  }
  if (regime === 'aucun') {
    // Aucun artéfact n'entre dans ce score (§12.6 d'artefacts.md) — la somme
    // des principales sert seulement à ne pas rendre une paire arbitraire,
    // jamais à maximiser quoi que ce soit.
    return (arts) => arts.reduce((n, a) => n + a.main.value, 0);
  }
  // ⚠️ Exhaustivité vérifiée à la COMPILATION : si `RegimeArtefacts` gagne un
  // jour une 7ᵉ valeur, `regime` n'est plus `never` ici et `tsc` refuse de
  // compiler cette ligne — jamais un `else` qui absorberait la nouvelle
  // valeur dans la somme sans que rien ne le signale.
  const _exhaustif: never = regime;
  throw new Error(`evaluerPourRegime : régime non couvert (${_exhaustif})`);
}
