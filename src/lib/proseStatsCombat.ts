// « Stats acquises en combat » (carte « Dégâts réels ») : QUELLE PROSE DU JEU
// est rendue, et sur quel réglage le bloc OUVRE un passif — degats-et-aura 11.
//
// Fonction pure, sans React : `DamageSetupCard.tsx` l'appelle telle quelle, et
// `tests/prose-stats-combat.test.ts` l'exerce sur tout le corpus.
//
// Trois règles :
// 1. **Une prose par passif**, jamais une par réglage : Elsharion (`10014`) et
//    Crane (`11663`) ont deux compteurs pour une même compétence, donc une
//    seule description, au-dessus du premier (décision de l'utilisateur
//    n° 14, 2026-10-02).
// 2. **Jamais une prose déjà rendue ailleurs dans la carte.** L'exclusion est
//    DÉRIVÉE des blocs voisins qui rendent déjà la prose d'une compétence
//    (`clesProseDejaRendue`), jamais une liste d'identifiants — même patron
//    que `clesToggleDejaAffichees` dans la carte.
// 3. **La prose du jeu telle quelle**, jamais reformulée : les libellés sont
//    ceux du jeu.

import type { CombatStatProfile } from './damage';

/** Ce qu'un bloc voisin de la carte rend d'une compétence : son identifiant et sa prose. */
export interface ProseDUnBloc {
  skillCom2usId: number;
  description: string | null;
}

/**
 * Les compétences dont un AUTRE bloc de la carte rend déjà la prose (passifs
 * offensifs, conditions de combat, bonus conditionnel, accumulable, par effet,
 * de sacrifice, modificateurs de VIT). Un bloc absent ou sans prose n'exclut
 * rien : il ne rend rien.
 */
export function clesProseDejaRendue(blocs: readonly (ProseDUnBloc | null | undefined)[]): Set<number> {
  const cles = new Set<number>();
  for (const bloc of blocs) {
    if (bloc?.description) cles.add(bloc.skillCom2usId);
  }
  return cles;
}

/** Ce que « Stats acquises en combat » rend autour d'UN réglage. */
export interface RenduReglageCombat {
  /**
   * Le réglage OUVRE son passif dans le bloc : c'est le premier réglage de sa
   * compétence, et aucun autre bloc n'en rend la prose. Quand son contrôle ne
   * nomme pas le passif (un compteur, un interrupteur d'état), la carte pose
   * au-dessus l'icône et le nom du passif (décision de l'utilisateur n° 15).
   */
  ouvre: boolean;
  /** Prose du jeu, rendue sous ce qui nomme le passif et avant le réglage ; `null` = rien. */
  prose: string | null;
}

/** Un rendu par profil, dans l'ordre reçu : la carte lit `rendu[index]`. */
export function renduStatsCombat(
  profils: readonly CombatStatProfile[],
  dejaRendue: ReadonlySet<number>
): RenduReglageCombat[] {
  const ouverts = new Set<number>();
  return profils.map((profil) => {
    const id = profil.skillCom2usId;
    if (dejaRendue.has(id) || ouverts.has(id)) return { ouvre: false, prose: null };
    ouverts.add(id);
    return { ouvre: true, prose: profil.description || null };
  });
}
