// File d'optimisation d'artéfacts alimentée AU FIL DE L'EAU.
//
// ⚠️ **Pourquoi au fil de l'eau, et pas en passe finale.** Un premier
// raisonnement concluait « passe finale obligatoire » : les candidats arrivent
// dans l'ordre d'APPARIEMENT, pas dans celui du classement, donc on ne saurait
// qu'à la fin lesquels méritent d'être optimisés. La prémisse est juste, la
// conclusion ne l'est pas :
//
//  - `combosOrderMode` vaut `'objective'` (runeBuildOptim.ts) : l'ordre
//    d'appariement EST piloté par l'objectif, et les bons builds sortent tôt —
//    quelques secondes, là où la recherche s'écoule sur plusieurs minutes ;
//  - le travail perdu sur un build évincé plus tard ne coûte RIEN s'il a été
//    fait pendant que les Workers cherchaient. Attendre la fin, si.
//
// ⚠️ Ce module ne planifie rien : il dit seulement QUI traiter et dans quel
// ordre. Le « quand » vit dans `useArtifactOptimQueue` (temps d'inactivité du
// fil principal), le « comment » dans `artifactOptim.ts`. Trois responsabilités
// séparées, dont celle-ci est la seule testable sans navigateur.

import { BuildCandidate } from './runeBuildOptim';
import { ArtifactDetail } from '../types';
import { PaireArtefacts } from './artifactOptim';

/**
 * Identité d'un build, pour ne pas l'optimiser deux fois.
 *
 * ⚠️ **Triée.** Deux candidats portant les mêmes runes dans un ordre différent
 * sont le MÊME build — l'emplacement d'une rune est porté par la rune, pas par
 * sa position dans le tableau. Sans le tri, le cache raterait et on paierait
 * deux fois le même travail.
 */
export function cleBuild(c: BuildCandidate): string {
  return [...c.runeIds].sort((a, b) => a - b).join(',');
}

export interface ResultatArtefacts {
  paire: PaireArtefacts | null;
  artefacts: ArtifactDetail[];
  // `null` quand le coût n'a pas été demandé — voir `avecCoutDesVerrous`.
  meilleurSansVerrous: number | null;
}

/**
 * Les builds à traiter ensuite : les `K` mieux classés qui n'ont pas encore
 * leur paire, dans l'ordre de priorité.
 *
 * ⚠️ `triees` doit ARRIVER trié par l'objectif (via `sortCandidates`, la source
 * unique). Ce module ne trie pas : un second tri ici finirait par diverger de
 * celui de l'écran, exactement le défaut qui avait fait lire
 * `candidates[0]` comme « le meilleur » alors qu'il ne l'était pas.
 *
 * ⚠️ Le classement se fait sur les dégâts SANS artéfacts optimisés — c'est le
 * seul disponible pendant la recherche. Un build peut donc entrer dans les `K`
 * puis en sortir quand de meilleurs arrivent ; son résultat déjà calculé reste
 * en cache et ne coûte plus rien. C'est le pari du temps masqué, assumé.
 */
export function prochainsATraiter(
  triees: readonly BuildCandidate[],
  deja: ReadonlySet<string>,
  K: number
): BuildCandidate[] {
  const out: BuildCandidate[] = [];
  const vusDansCeLot = new Set<string>();
  for (let i = 0; i < triees.length && i < K; i++) {
    const c = triees[i]!;
    const cle = cleBuild(c);
    // ⚠️ `vusDansCeLot` en plus de `deja` : un même build peut figurer deux
    // fois dans l'aperçu accumulé (deltas successifs d'un Worker relancé après
    // escalade). Sans cette garde, il serait mis en file deux fois et le
    // travail refait.
    if (deja.has(cle) || vusDansCeLot.has(cle)) continue;
    vusDansCeLot.add(cle);
    out.push(c);
  }
  return out;
}

/**
 * Le cache reste-t-il valable ?
 *
 * ⚠️ **Tout ce qui change le SCORE d'une paire invalide le cache**, pas
 * seulement l'inventaire : changer l'élément visé, une stat principale exigée
 * ou une ligne verrouillée change quelles lignes comptent
 * (`analyserPertinence`) et donc quelle paire gagne. Garder les résultats
 * d'avant afficherait des paires optimales pour un réglage que l'utilisateur
 * a quitté — sans que rien ne le signale.
 */
export function signatureReglages(parts: {
  monstreCom2usId: number;
  skillCom2usId: number | null;
  elementVise: string | null;
  principaleParSorte: Record<string, unknown>;
  lignesVerrouillees: { code: number; min: number }[];
  nbArtefacts: number;
}): string {
  const lignes = [...parts.lignesVerrouillees]
    .filter((l) => l.min > 0)
    .sort((a, b) => a.code - b.code)
    .map((l) => `${l.code}:${l.min}`)
    .join('|');
  return [
    parts.monstreCom2usId,
    parts.skillCom2usId ?? '-',
    parts.elementVise ?? '-',
    JSON.stringify(parts.principaleParSorte),
    lignes,
    parts.nbArtefacts,
  ].join('§');
}
