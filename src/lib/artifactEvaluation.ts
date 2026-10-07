// Quel `evaluer` (callback de notation d'une paire d'artéfacts, voir
// `artifactOptim.ts`) pour quel régime — UNE seule définition, consommée par
// les trois sites qui en construisaient une chacun (OptimizerSection.tsx ×2,
// scripts/lib/recipeToSearchParams.ts ×1). Voir
// spec/outils/optimizer/moteur/artefacts.md § Régime de la paire.
//
// ⚠️ Volontairement SÉPARÉ de `artifactOptim.ts`, qui reste sans logique de
// dégâts (sa seule dépendance vers `damage.ts` est le code
// `CODE_AMPLI_VIT`) et se teste sans contexte de combat
// (spec/outils/optimizer/moteur/optimiseur-artefacts.md § La double boucle).
// `computeTotalDamage`/`pvEffectifs`/`statsParPaire` casseraient cette
// frontière.

import { ArtifactDetail, ElementKey, RelicDetail } from '../types';
import { StatKey } from './effects';
import { Objective, pvEffectifs, statTotal, type RealDamageContext } from './runeBuildOptim';
import { StatRow } from './stats';
import { ArtifactDamageProfile, AurasPropres, DamageSetup, artifactDamageProfile, computeTotalDamage } from './damage';
import { APPORT_NEUTRE, ApportExclusive, apportExclusive, facteurTenacite, statsAvecApport } from './relicExclusive';

export type RegimeArtefacts = 'aucun' | 'hp' | 'atk' | 'def' | 'ehp' | 'degats_reels';

/**
 * Le régime qui gouverne le choix de paire pour un critère donné (tri OU
 * objectif — l'appelant décide lequel des deux passer).
 *
 * ⚠️ Branche EXHAUSTIVE sur les valeurs réelles de `StatKey | Objective`, pas
 * un `else` qui absorberait un cas imprévu : `'aucun'` est le régime propre à
 * efficience/vitesse/TC/DCC/RES/PRE — celles où AUCUN artéfact n'entre dans
 * le score (voir spec/outils/optimizer/moteur/artefacts.md § Régime de la
 * paire), pas un repli pour un oubli.
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
 * Le CANAL EXCLUSIVE (spec/outils/optimizer/moteur/reliques.md § L'effet unique — score de la propriété
 * exclusive) : la relique
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
 * Absent → apport neutre : aucune note d'effet unique.
 * Lu par les régimes `degats_reels` et `ehp` seulement : les régimes
 * `hp`/`atk`/`def` jugent la fiche (degats-et-aura 6bis-b9).
 */
export interface CanalExclusive {
  relique: RelicDetail | undefined;
  setup: DamageSetup;
  element: ElementKey | null;
}

/**
 * Au plus tant de paires en cache (`CacheProfilsParPaire`) : un peu plus du
 * double des 7 727 paires distinctes que parcourt la résolution de 300 builds
 * × 4 reliques sur la recette « Dégâts réels » de référence (degats-et-aura
 * 6bis-b13), loin des ~100 000 paires de l'inventaire entier (250 × 430
 * candidats). Atteinte, le cache se vide d'un coup : jamais plus de cette
 * borne d'entrées vivantes, jamais un résultat différent.
 */
export const BORNE_PROFILS_PAR_PAIRE = 16_384;

// Au plus tant de tableaux de stats dont l'évaluateur d'une paire retient
// l'apport (`evaluerPourRegime`) : une poignée de sommes de principales par
// build et par relique ; pour un `statsAvec` qui rendrait un tableau neuf à
// chaque appel, la mémoire tourne sans grandir.
export const BORNE_APPORTS_PAR_STATS = 64;

// Emplacement vide dans la clé : jamais un identifiant de pièce, puisqu'une
// pièce d'identifiant ≤ 0 ne passe pas par le cache.
const SANS_PIECE = -1;

/**
 * Le profil de dégâts d'une paire (`artifactDamageProfile`), mémoïsé par les
 * identifiants de ses pièces, dans l'ordre reçu, emplacement vide compris
 * (degats-et-aura 6bis-b13).
 *
 * ⚠️ **Exact parce que le profil ne lit que les pièces** : leurs
 * sous-propriétés, rien du build, de la relique ni du réglage (damage.ts) ;
 * le même identifiant désigne la même pièce tant que l'inventaire ne change
 * pas — d'où la durée de vie du cache, celle d'UNE file (vidé avec la
 * signature des réglages ou l'inventaire, voir `nouveauxCachesResolution`).
 * Un profil rendu est partagé : aucun consommateur ne le modifie, seul
 * `artifactDamageProfile` écrit dans l'objet qu'il construit.
 *
 * ⚠️ Une pièce d'identifiant ≤ 0 n'est pas une vraie pièce (les sondes de
 * `analyserPertinence`) : jamais en cache, le profil est recalculé.
 */
export class CacheProfilsParPaire {
  private parPremiere = new Map<number, Map<number, ArtifactDamageProfile>>();
  private entrees = 0;

  get taille(): number {
    return this.entrees;
  }

  profil(arts: ArtifactDetail[]): ArtifactDamageProfile {
    if (arts.length > 2) return artifactDamageProfile(arts);
    const premiere = arts[0]?.id ?? SANS_PIECE;
    const seconde = arts[1]?.id ?? SANS_PIECE;
    if ((arts.length > 0 && premiere <= 0) || (arts.length > 1 && seconde <= 0)) return artifactDamageProfile(arts);
    let interne = this.parPremiere.get(premiere);
    const connu = interne?.get(seconde);
    if (connu) return connu;
    const p = artifactDamageProfile(arts);
    if (this.entrees >= BORNE_PROFILS_PAR_PAIRE) {
      this.parPremiere.clear();
      this.entrees = 0;
      interne = undefined;
    }
    if (!interne) {
      interne = new Map();
      this.parPremiere.set(premiere, interne);
    }
    interne.set(seconde, p);
    this.entrees++;
    return p;
  }
}

// `propres` (6bis-b2, les deux surcharges) : les activations d'aura des runes
// du build dont `statsAvec` calcule les stats. Constantes pour toutes ses
// paires et reliques (ni artéfact ni relique ne porte de set), obligatoires :
// la note d'une paire, celle qui choisit la relique et celle qui classe les
// voient toutes trois (D6, une seule note).
// Surcharge 1 : `degats_reels` EXIGE le contexte de dégâts — omission =
// erreur `tsc`, pas un repli silencieux sur la somme des principales.
// `profils` (6bis-b13) : le profil de chaque paire est lu dans ce cache au
// lieu d'être recalculé — même valeur, voir `CacheProfilsParPaire`. Absent :
// recalculé à chaque paire, comme avant.
export function evaluerPourRegime(
  regime: 'degats_reels',
  statsAvec: (arts: ArtifactDetail[]) => StatRow[],
  propres: AurasPropres,
  degats: DegatsContext,
  exclusive?: CanalExclusive,
  profils?: CacheProfilsParPaire
): (arts: ArtifactDetail[]) => number;
// Surcharge 2 : tout autre régime n'a pas besoin de contexte de dégâts.
export function evaluerPourRegime(
  regime: Exclude<RegimeArtefacts, 'degats_reels'>,
  statsAvec: (arts: ArtifactDetail[]) => StatRow[],
  propres: AurasPropres,
  exclusive?: CanalExclusive
): (arts: ArtifactDetail[]) => number;
// Implémentation — signature élargie, jamais appelée directement de
// l'extérieur (les deux surcharges ci-dessus sont le seul contrat public).
export function evaluerPourRegime(
  regime: RegimeArtefacts,
  statsAvec: (arts: ArtifactDetail[]) => StatRow[],
  propres: AurasPropres,
  degatsOuExclusive?: DegatsContext | CanalExclusive,
  exclusiveApresDegats?: CanalExclusive,
  profils?: CacheProfilsParPaire
): (arts: ArtifactDetail[]) => number {
  // Le 4ᵉ paramètre porte le contexte de dégâts en `degats_reels`, le canal
  // exclusive partout ailleurs — les deux surcharges publiques le fixent, ce
  // démêlage n'existe que pour l'implémentation commune.
  const degats = regime === 'degats_reels' ? (degatsOuExclusive as DegatsContext | undefined) : undefined;
  const exclusive = regime === 'degats_reels' ? exclusiveApresDegats : (degatsOuExclusive as CanalExclusive | undefined);
  // L'apport de la relique essayée, pour CETTE paire d'artéfacts.
  const apportPour = (stats: StatRow[]) =>
    exclusive ? apportExclusive(exclusive.relique, stats, exclusive.setup, propres, exclusive.element) : APPORT_NEUTRE;
  // ⚠️ L'apport et les stats qui l'incluent ne dépendent que du TABLEAU de
  // stats de la paire (`apportExclusive`, `statsAvecApport` : pures) :
  // calculés une fois par tableau, reconnu à son identité — `statsParPaire`
  // rend le même tableau aux paires de mêmes principales (degats-et-aura
  // 6bis-b13). Exact pour tout `statsAvec` ; au plus
  // `BORNE_APPORTS_PAR_STATS` tableaux retenus, puis la mémoire se vide.
  const parStats = new Map<StatRow[], { stats: StatRow[]; apport: ApportExclusive }>();
  const avecApport = (brutes: StatRow[]) => {
    let r = parStats.get(brutes);
    if (!r) {
      const apport = apportPour(brutes);
      r = { stats: statsAvecApport(brutes, apport), apport };
      if (parStats.size >= BORNE_APPORTS_PAR_STATS) parStats.clear();
      parStats.set(brutes, r);
    }
    return r;
  };
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
    const profilDe = profils ? (arts: ArtifactDetail[]) => profils.profil(arts) : artifactDamageProfile;
    return (arts) => {
      // Bravoure/Éternité/Origine : des POINTS de stat, jamais posés dans
      // `computeStats` (les minimums/maximums restent jugés hors combat).
      const { stats, apport } = avecApport(statsAvec(arts));
      return computeTotalDamage(
        degats.profile,
        degats.passifs,
        stats,
        degats.setup,
        propres,
        degats.element,
        profilDe(arts),
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
      const { stats, apport } = avecApport(statsAvec(arts));
      // Ténacité — terme de `Réductions` : des PV effectifs ÉQUIVALENTS.
      return pvEffectifs(stats, propres, exclusive?.setup) * facteurTenacite(apport.reductionPct);
    };
  }
  if (regime === 'hp' || regime === 'atk' || regime === 'def') {
    // ⚠️ **La FICHE, sans l'effet unique** : `statTotal`, l'expression MÊME
    // du tri par stat (`scorerPour`), que la carte affiche (`row.total`) et
    // que jugent les conditions min/max. Le canal exclusive est ignoré ici —
    // les points Bravoure/Éternité/Origine ne départagent plus ni les paires
    // ni les reliques (degats-et-aura 6bis-b9, option (a) de l'utilisateur).
    // `computeStats` garantit une entrée par `StatKey`.
    return (arts) => statTotal(statsAvec(arts), regime);
  }
  if (regime === 'aucun') {
    // Aucun artéfact n'entre dans ce score (voir
    // spec/outils/optimizer/moteur/artefacts.md § Régime de la paire) — la somme
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
