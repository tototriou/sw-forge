// Le SCORE CHIFFRÉ d'une propriété unique de relique (implementation-relique,
// lot 7 — B.7). Module pur : il traduit une pièce en APPORT, il ne note rien
// lui-même et ne connaît ni objectif, ni régime, ni candidat.
//
// ⚠️ **La formule est RELEVÉE EN JEU, jamais déduite** (A.2 ter T4, rév. 41-43 ;
// `game-data-curation`) :
//
//     gain = ⌊Y / t⌋ × percent
//
// - `t` = `unique.tranche` et `percent` = `unique.percent`, **lus dans
//   l'export** (`sec_effect = [type, tranche, percent]`) — jamais recalculés
//   depuis le niveau de la pièce (`upgrade`), dont on ne connaît que les
//   paliers de tranche, pas le pourcentage ;
// - **tranches ENTIÈRES**, par palier, jamais au prorata (1 % par 1 000 ATQ :
//   1 % à 1 000 comme à 1 800, 2 % à 2 000) ;
// - **AUCUN plafond** : le jeu n'en mentionne nulle part ;
// - `Y` = la statistique de RÉFÉRENCE au **début du combat**
//   (`statsDebutCombat`, damage.ts — reliques.md § 5.2).
//
// ⚠️ **Une pièce sans `percent` est NEUTRE**, jamais estimée : un fichier de
// prépa exporté par une version antérieure ne transporte que le type et la
// tranche (voir `formatRelicUnique`, effects.ts, même règle à l'affichage).
// Un type INCONNU (ajouté par une mise à jour du jeu) est neutre lui aussi, et
// n'élimine jamais rien.
//
// ⚠️ **Aucune circularité, et ce n'est pas un hasard** : par construction de
// `RELIC_UNIQUE`, la stat AMÉLIORÉE n'est jamais la stat de RÉFÉRENCE
// (Bravoure → ATQ depuis VIT/DEF/PV, Éternité → DEF depuis ATQ/VIT/PV,
// Origine → PV depuis ATQ/VIT/DEF). Le score se calcule donc **en une passe**,
// sans point fixe — et le gain ne se réinjecte jamais dans l'assiette qui l'a
// produit. Un type futur qui romprait cette propriété doit être traité, pas
// absorbé en silence.

import { ElementKey, RelicDetail } from '../types';
import { RELIC_UNIQUE, RelicGroupeNom } from './effects';
import { StatRow } from './stats';
import { DamageSetup, statsDebutCombat } from './damage';

/**
 * Ce qu'une relique apporte au score, par BRACKET — jamais un scalaire unique,
 * parce que les trois placements relevés sont de natures différentes et ne se
 * composent pas entre eux.
 *
 * - `dmgPct` — **Conquête** (1-3) : additif dans le bracket `DMG%` de
 *   `(Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel) × Réductions` ;
 * - `reductionPct` — **Ténacité** (4-6) : additif dans `Réductions`, avec les
 *   lignes d'artéfact « −DMG % subis » (305-309) ; côté DÉFENSE, donc il ne
 *   touche jamais les dégâts infligés ;
 * - `hp`/`atk`/`def` — **Bravoure** (7-9 → ATQ), **Éternité** (10-12 → DEF),
 *   **Origine** (13-15 → PV) : des POINTS, calculés multiplicativement sur la
 *   **valeur de base** de la stat augmentée.
 *
 * **Régénération** (16) n'apporte rien : les soins et boucliers ne sont mesurés
 * par aucun objectif (reliques.md § 5.1).
 */
export interface ApportExclusive {
  dmgPct: number;
  reductionPct: number;
  hp: number;
  atk: number;
  def: number;
}

export const APPORT_NEUTRE: ApportExclusive = { dmgPct: 0, reductionPct: 0, hp: 0, atk: 0, def: 0 };

// La stat de RÉFÉRENCE (le « X » de « tous les X pts de … ») d'un type, lue
// dans `RELIC_UNIQUE` — jamais une seconde table. `stat.court` est le mot du
// jeu ; c'est le seul endroit qui le traduit en clé de `StatRow`.
const CLE_DE_REFERENCE: Record<string, 'hp' | 'atk' | 'def' | 'spd'> = {
  PV: 'hp',
  ATQ: 'atk',
  DEF: 'def',
  VIT: 'spd',
};

// La stat AMÉLIORÉE par les trois groupes multiplicatifs — fixe par groupe
// (c'est le gabarit de la phrase du jeu qui la porte, pas la pièce).
const CLE_AMELIOREE: Partial<Record<RelicGroupeNom, 'hp' | 'atk' | 'def'>> = {
  bravoure: 'atk',
  eternite: 'def',
  origine: 'hp',
};

// ⚠️ Le prédicat « ce type a-t-il une formule ? » (`exclusiveChiffrable`) vit
// dans `relicOptim.ts`, PAS ici : ce module-ci importe `damage.ts`, et
// `relicOptim.ts` doit rester libre de cette dépendance (frontière posée au
// lot 3, « aucune dépendance runtime à damage.ts/stats.ts »). Les deux ne
// peuvent donc pas se dériver l'un de l'autre par le typage — c'est
// `tests/relic-exclusive.test.ts` qui verrouille leur accord, type par type,
// sur les seize.

/**
 * Le nombre de TRANCHES entières d'une pièce sur une assiette `Y` — ⌊Y / t⌋,
 * sans plafond. Exposé pour que le test puisse le vérifier au palier près
 * (« juste sous » → n, « juste au palier » → n + 1).
 */
export function tranchesAtteintes(Y: number, tranche: number): number {
  // Une tranche nulle ou négative n'existe pas dans l'export (relevé sur 26
  // pièces réelles, 150 à 45 000) ; s'en protéger évite un `Infinity`
  // silencieux si une donnée future devenait absurde.
  if (!(tranche > 0)) return 0;
  return Math.floor(Y / tranche);
}

/**
 * L'apport d'une relique, sur les stats et le contexte d'UN build donné.
 *
 * `stats` sont les statistiques de ce build **avec la principale de cette
 * relique déjà posée** (c'est `computeStats({ ...gear, relic })`) : la
 * principale entre donc dans `Y`, le gain de l'exclusive non — il n'y a qu'une
 * relique, donc aucune boucle à résoudre (reliques.md § 5.2).
 *
 * `setup`/`element` servent au seul `statsDebutCombat` (leader skill et
 * compétences d'invocateur). Ils sont toujours disponibles : « État de mon
 * monstre » modifie les stats quel que soit l'objectif choisi.
 */
export function apportExclusive(
  relique: RelicDetail | undefined,
  stats: StatRow[],
  setup: DamageSetup,
  element: ElementKey | null = null
): ApportExclusive {
  const u = relique?.unique;
  if (!u) return APPORT_NEUTRE;
  const def = RELIC_UNIQUE[u.type];
  // Type inconnu (ajouté par une mise à jour du jeu) → neutre, jamais éliminé.
  if (!def) return APPORT_NEUTRE;
  // ⚠️ Export ancien sans `percent` → NEUTRE, jamais estimé.
  if (u.percent == null) return APPORT_NEUTRE;

  const cleRef = CLE_DE_REFERENCE[def.stat.court];
  if (!cleRef) return APPORT_NEUTRE;
  const Y = statsDebutCombat(stats, setup, element)[cleRef];
  const gainPct = tranchesAtteintes(Y, u.tranche) * u.percent;
  if (gainPct === 0) return APPORT_NEUTRE;

  if (def.groupe === 'conquete') return { ...APPORT_NEUTRE, dmgPct: gainPct };
  if (def.groupe === 'tenacite') return { ...APPORT_NEUTRE, reductionPct: gainPct };
  const cleAmelioree = CLE_AMELIOREE[def.groupe];
  // Régénération : aucun bracket ne la reçoit — neutre, jamais notée.
  if (!cleAmelioree) return APPORT_NEUTRE;
  const base = stats.find((s) => s.key === cleAmelioree)?.base ?? 0;
  // ⚠️ **Aucun arrondi sur l'apport de points** — l'arrondi du nombre de
  // tranches est relevé (tronqué), celui de l'apport ne l'est PAS. Un `ceil`
  // recopié du voisin (`computeStats`, `statsDebutCombat`) serait une
  // ANALOGIE, et deux analogies de `damage.ts` se sont déjà révélées fausses
  // (`game-data-curation` § 6 ter). Le score est un réel de classement, pas
  // une valeur affichée : l'écart est borné par 1 point de stat.
  return { ...APPORT_NEUTRE, [cleAmelioree]: (base * gainPct) / 100 } as ApportExclusive;
}

/**
 * Les statistiques d'un build AVEC l'apport de points de son exclusive —
 * une COPIE, `computeStats` n'est jamais touchée.
 *
 * ⚠️ **Et surtout pas `computeStats`** : les minimums et maximums de la
 * recherche portent sur la statistique affichée hors combat, pas sur celle du
 * début de combat. Gonfler `computeStats` rendrait faisables des builds qui ne
 * le sont pas, et l'écran afficherait des stats que le jeu ne montre nulle
 * part.
 */
export function statsAvecApport(stats: StatRow[], apport: ApportExclusive): StatRow[] {
  if (apport.hp === 0 && apport.atk === 0 && apport.def === 0) return stats;
  return stats.map((row) => {
    const ajout = row.key === 'hp' ? apport.hp : row.key === 'atk' ? apport.atk : row.key === 'def' ? apport.def : 0;
    if (ajout === 0) return row;
    return { ...row, bonus: row.bonus + ajout, total: row.total + ajout };
  });
}

/**
 * Le facteur qui transforme des PV effectifs en PV effectifs ÉQUIVALENTS sous
 * une réduction de dégâts reçus — **dérivé de l'équation, pas posé par
 * analogie** (B.7) :
 *
 * `Dégâts = (Mult × Crit × DMG% × FacteurDéf × Variance + Additionnel) × Réductions`
 *
 * Ténacité est un terme de `Réductions`. En posant **Variance = 1 et
 * Additionnel = 0** (simplification assumée : les dégâts fixes traversent
 * `FacteurDéf` mais pas `Réductions`), le terme `(Mult × Crit × DMG%)`
 * s'annule dans le rapport et il reste
 *
 * `PV effectifs équivalents = pvEffectifs / (1 − X / 100)`.
 *
 * ⚠️ `X ≥ 100` serait l'invulnérabilité : hors du domaine que le relevé
 * couvre, et inatteignable sur les pièces réelles (26 relevées : tranches de
 * 150 à 45 000, `percent` 1 ou 2 — au plus quelques points de pourcentage).
 * On plante plutôt que de rendre un score infini ou négatif qui se
 * propagerait dans un classement.
 */
export function facteurTenacite(reductionPct: number): number {
  if (reductionPct === 0) return 1;
  if (reductionPct >= 100) {
    throw new Error(
      `facteurTenacite : réduction de ${reductionPct} % — au-delà de 100 %, le modèle de PV effectifs équivalents n'est pas défini (relevé T4 : aucun plafond connu, aucune pièce réelle n'en approche).`
    );
  }
  return 1 / (1 - reductionPct / 100);
}

// Ré-export de commodité : les consommateurs du canal (score, évaluation de
// paire) n'ont besoin que de ces deux clés du contexte pour l'assiette `Y`.
export interface ContexteExclusive {
  setup: DamageSetup;
  element: ElementKey | null;
}
