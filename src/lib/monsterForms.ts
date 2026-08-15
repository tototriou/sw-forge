// Quelles FORMES d'un monstre proposer quand on en choisit un — calcul pur.
//
// SWARFARM liste toutes les formes sous le même nom : la non éveillée,
// l'éveillée, et le second éveil (2A) quand il existe. Chercher « Seren » en
// renvoyait donc trois, dont deux qu'on ne joue jamais.
//
// ⚠️ **Les sélecteurs seulement, jamais le Bestiaire.** Celui-ci est une base
// qu'on consulte : y masquer des formes empêcherait de lire les stats d'un
// monstre non éveillé ou de comparer une forme à l'autre. Ici on choisit un
// monstre à jouer, ce n'est pas la même question.

import { Monster } from '../types';

// Une forme est ÉVEILLÉE quand son grade obtenable dépasse sa rareté naturelle :
// l'éveil ajoute une étoile (nat4 → 5★), le second éveil trois (nat3 → 6★).
//
// ⚠️ On ne peut pas se fier au seul `secondAwaken`, qui ne marque que le 2A —
// il ne distingue pas une forme éveillée d'une forme brute. Et `awaken_level`,
// qui le dirait directement, n'est pas conservé dans nos données.
//
// Les monstres créés à la main (`stars`/`naturalStars` nuls) sont considérés
// comme jouables : ils n'existent que parce que l'utilisateur les a saisis.
export function estEveille(m: Monster): boolean {
  if (m.stars == null || m.naturalStars == null) return true;
  return m.stars > m.naturalStars;
}

// Formes proposables : les éveillées, et **la 2A seule** quand elle existe.
//
// ⚠️ Deux règles, pas une :
//   1. les formes NON éveillées disparaissent — on ne les joue pas ;
//   2. quand un monstre a un second éveil, il REMPLACE sa forme éveillée
//      simple. Les deux portent le même nom et la même icône d'élément : les
//      laisser côte à côte oblige à deviner laquelle est laquelle, alors que
//      c'est la 2A qu'on joue.
//
// Le regroupement se fait sur (nom, élément) : deux monstres homonymes
// d'éléments différents restent bien deux entrées distinctes.
export function formesJouables(monsters: Monster[]): Monster[] {
  const eveilles = monsters.filter(estEveille);
  // Noms+élément pour lesquels une 2A existe.
  const avec2A = new Set<string>();
  for (const m of eveilles) {
    if (m.secondAwaken) avec2A.add(`${m.name}|${m.element}`);
  }
  return eveilles.filter((m) => m.secondAwaken || !avec2A.has(`${m.name}|${m.element}`));
}
