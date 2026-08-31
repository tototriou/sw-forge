// Choix de la meilleure PAIRE d'artéfacts pour un build DONNÉ.
//
// ⚠️ **Rien à voir avec `runeBuildOptim.ts`, et c'est voulu.** Toute la
// machinerie des runes (meet-in-the-middle, compartiments, plafonds de
// rétention, budget de nœuds) existe parce qu'elles forment un espace de 6
// emplacements sous contraintes de sets. Ici : DEUX emplacements, et la règle
// d'éligibilité ramène chacun à ~200 candidats sur un inventaire réel. Une
// **double boucle exhaustive** suffit — elle est exacte, et c'est elle la
// référence, il n'y a aucune heuristique à valider.
//
// ⚠️ Le build de runes est FIXE. Ce module ne cherche pas les deux ensemble :
// un artéfact amplifie un build, il n'en déplace pas la cible (voir
// spec/outils/degats-reels.md, « Ces lignes n'entrent PAS dans
// `damageRelevantStats` »).

import { ARTIFACT_KINDS, ArtifactDetail, ArtifactKind } from '../types';
import { PorteurArtefact, artifactFitsMonster, artifactPairAllowed, eligibleArtifacts } from './artifacts';

// Ce qu'on impose à la stat principale d'un emplacement.
//
// ⚠️ Superset d'`ArtifactMainChoice` (hooks/useOptimizerState.ts), qui n'a pas
// encore `'libre'` : cette valeur n'a de sens QU'AVEC une recherche
// d'artéfacts, et l'ajouter au sélecteur avant que celle-ci existe y poserait
// une option morte.
export type ChoixPrincipale =
  | 'equipped' // ne PAS chercher cet emplacement : garder ce qui est porté
  | 'none' // laisser l'emplacement vide
  | 'libre' // chercher parmi TOUS les éligibles
  | 100 // … ou seulement ceux dont la principale est PV
  | 101 // … ATQ
  | 102; // … DEF

export interface ArtifactSearchParams {
  porteur: PorteurArtefact;
  // L'inventaire COMPLET : le filtrage d'éligibilité se fait ici, pas chez
  // l'appelant — c'est la règle du jeu, elle n'a pas à être redite ailleurs.
  inventaire: ArtifactDetail[];
  // Ce que le monstre porte AUJOURD'HUI, pour le choix `'equipped'`.
  equipes: ArtifactDetail[];
  // Par sorte ; une sorte absente vaut `'libre'`.
  principaleParSorte: Partial<Record<ArtifactKind, ChoixPrincipale>>;
  // Score d'une paire. ⚠️ L'appelant recalcule les stats DEDANS : la stat
  // principale d'un artéfact entre dans les stats du monstre, donc changer
  // d'artéfact change le build. Un score qui l'ignorerait comparerait des
  // paires sur des stats fausses.
  evaluer: (artefacts: ArtifactDetail[]) => number;
}

export interface PaireArtefacts {
  element: ArtifactDetail | null;
  archetype: ArtifactDetail | null;
  score: number;
}

// Candidats d'un emplacement, une fois l'éligibilité ET le filtre de
// principale appliqués. `null` y figure quand l'emplacement peut rester vide.
export function candidatsParSorte(params: ArtifactSearchParams, kind: ArtifactKind): (ArtifactDetail | null)[] {
  const choix = params.principaleParSorte[kind] ?? 'libre';
  if (choix === 'none') return [null];
  if (choix === 'equipped') {
    const porte = params.equipes.find((a) => a.kind === kind) ?? null;
    // ⚠️ Même en `'equipped'`, on vérifie l'éligibilité : un exemplaire dont
    // l'équipement vient d'un import peut ne plus correspondre au monstre
    // (forme changée, donnée ancienne). Mieux vaut un emplacement vide qu'une
    // paire qu'on ne peut pas équiper.
    return [porte && artifactFitsMonster(porte, params.porteur) ? porte : null];
  }
  const eligibles = eligibleArtifacts(params.inventaire, params.porteur, kind);
  const filtres = choix === 'libre' ? eligibles : eligibles.filter((a) => a.main.code === choix);
  // ⚠️ `null` TOUJOURS proposé : un emplacement vide reste une option valide,
  // et c'est parfois la seule (aucun candidat éligible). Sans lui, un monstre
  // sans artéfact d'attribut ne produirait aucune paire du tout.
  return [null, ...filtres];
}

// La meilleure paire, ou les `combien` meilleures.
//
// ⚠️ **La contrainte de paire n'est PAS un détail** : deux intangibles ne
// peuvent pas être portés ensemble, alors que chacun est éligible seul.
// Filtrer emplacement par emplacement puis prendre le meilleur de chaque côté
// produirait une paire inéquipable.
export function meilleuresPairesArtefacts(params: ArtifactSearchParams, combien = 1): PaireArtefacts[] {
  const parSorte = ARTIFACT_KINDS.map(({ key }) => candidatsParSorte(params, key));
  const [candidatsElement, candidatsArchetype] = parSorte;
  const trouvees: PaireArtefacts[] = [];
  // Réutilisé d'un tour à l'autre : à ~50 000 paires, une allocation par
  // itération se verrait.
  const paire: ArtifactDetail[] = [];
  for (const element of candidatsElement) {
    for (const archetype of candidatsArchetype) {
      if (!artifactPairAllowed(element, archetype)) continue;
      paire.length = 0;
      if (element) paire.push(element);
      if (archetype) paire.push(archetype);
      trouvees.push({ element, archetype, score: params.evaluer(paire) });
    }
  }
  // ⚠️ Tri DÉCROISSANT stable : à score égal, l'ordre de l'inventaire départage.
  // Un tri instable rendrait le résultat dépendant du moteur JS.
  trouvees.sort((a, b) => b.score - a.score);
  return trouvees.slice(0, Math.max(1, combien));
}

/**
 * La paire à SUPPOSER pendant une recherche de RUNES, quand les artéfacts
 * seront choisis après coup.
 *
 * ⚠️ **Corrige une asymétrie qui faussait le classement.** Un artéfact
 * « hypothéqué » par le sélecteur de stat principale était fabriqué avec
 * `subs: []` — donc AUCUNE ligne d'effet. Choisir « ATQ » faisait calculer
 * les dégâts sans les +30 % de renforcement d'ATQ ni les points de Dgts Crit
 * conditionnels, alors que « Comme équipé » les comptait. Deux réglages
 * voisins, deux modèles de dégâts différents, sans que rien ne le signale.
 *
 * Ici, la paire supposée est celle que le Mode A choisirait **pour le build
 * courant**, sous la même contrainte de principale : de vrais artéfacts, avec
 * leurs vraies lignes. Ce n'est pas la paire finale (elle dépend du build que
 * la recherche va trouver), mais c'est un représentant honnête plutôt qu'une
 * coquille vide.
 *
 * ⚠️ La paire finale peut différer — d'où `respecteMinimums`, à repasser sur
 * le build trouvé une fois ses vrais artéfacts choisis.
 */
export function paireRepresentative(params: ArtifactSearchParams): ArtifactDetail[] {
  const meilleure = meilleuresPairesArtefacts(params)[0];
  if (!meilleure) return [];
  return [meilleure.element, meilleure.archetype].filter((a): a is ArtifactDetail => a != null);
}

/**
 * Un build satisfait-il encore ses minimums, une fois sa VRAIE paire choisie ?
 *
 * ⚠️ **Indispensable dès que les artéfacts sont cherchés après les runes.** La
 * recherche de runes valide les minimums avec la paire SUPPOSÉE ; si la paire
 * finale porte une autre stat principale, un minimum peut être franchi à la
 * baisse sans que rien ne le dise. Un build affiché qui viole la condition
 * demandée est pire qu'un build manquant : l'utilisateur ne le vérifie pas.
 *
 * `stats` = celles du build AVEC sa paire finale.
 */
export function respecteMinimums(stats: { key: string; total: number }[], minStats: Record<string, number | undefined>): boolean {
  for (const [k, min] of Object.entries(minStats)) {
    if (min == null || min <= 0) continue;
    const s = stats.find((x) => x.key === k);
    if (!s || s.total < min) return false;
  }
  return true;
}

// Nombre de paires que la recherche va réellement parcourir — utile pour
// annoncer l'ampleur AVANT de lancer, et pour vérifier que l'éligibilité fait
// bien son travail d'élagage.
export function nombreDePaires(params: ArtifactSearchParams): number {
  const [e, a] = ARTIFACT_KINDS.map(({ key }) => candidatsParSorte(params, key));
  let n = 0;
  for (const x of e) for (const y of a) if (artifactPairAllowed(x, y)) n++;
  return n;
}
