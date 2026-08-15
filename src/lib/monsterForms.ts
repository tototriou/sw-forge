// Quelles FORMES d'un monstre proposer quand on en choisit un — calcul pur.
//
// SWARFARM liste toutes les formes sous le même nom : la non éveillée,
// l'éveillée, et le second éveil (2A) quand il existe. Chercher « Seren » en
// renvoyait donc trois, dont deux qu'on ne joue jamais.
//
// ⚠️ **`formesJouables` : les sélecteurs seulement, jamais le Bestiaire.**
// Celui-ci est une base qu'on consulte : y masquer les formes non éveillées
// empêcherait de lire leurs stats ou de comparer une forme à l'autre. Ici on
// choisit un monstre à jouer, ce n'est pas la même question.
//
// ⚠️ `sansDoublonDeTransformation` fait EXCEPTION et s'applique **partout,
// Bestiaire compris** : deux formes transformables portent le même nom, le même
// élément et la même icône. Ce n'est pas « deux formes à comparer » comme
// éveillé/non éveillé — c'est **le même monstre affiché deux fois**, et on ouvre
// l'une en croyant ouvrir l'autre.

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
  return sansDoublonDeTransformation(
    eveilles.filter((m) => m.secondAwaken || !avec2A.has(`${m.name}|${m.element}`))
  );
}

// ⚠️ **Un monstre TRANSFORMABLE n'a droit qu'à UNE entrée.**
//
// Bellenus, les Sœurs… existent en deux exemplaires chez SWARFARM : la forme de
// départ et la forme transformée. Elles portent le **même nom**, le **même
// élément** et la **même icône** — côte à côte, on ne sait pas laquelle est
// laquelle, et on ouvre l'une en croyant ouvrir l'autre.
//
// Le lien `transformsTo` est **bidirectionnel** (A → B et B → A) : il ne dit
// donc pas laquelle est « la vraie ». On retient celle dont le `com2usId` est le
// PLUS PETIT — c'est la forme de départ, celle qu'on invoque et sous laquelle on
// connaît le monstre. Le choix doit surtout être **stable** : n'importe quelle
// règle déterministe conviendrait, mais elle doit donner le même résultat à
// chaque rendu, sinon la fiche changerait sous le curseur.
// L'autre forme d'un monstre transformable, si elle est dans la liste.
//
// ⚠️ La fiche en a besoin : les deux formes n'ont PAS les mêmes compétences —
// Bellenus voit son S2 passer de 3.0 à 2.0 × ATQ et son passif changer
// entièrement. Les dédupliquer dans la grille était juste (deux cartes
// indistinguables), mais masquer la seconde dans la fiche perdrait la moitié de
// l'information.
export function autreForme(m: Monster, monsters: Monster[]): Monster | null {
  if (m.transformsTo == null) return null;
  return monsters.find((x) => x.swarfarmId === m.transformsTo && x !== m) ?? null;
}

// Le jumeau de COLLABORATION d'un monstre, s'il est dans la liste.
//
// ⚠️ Même forme qu'`autreForme`, mais **une tout autre relation** : les deux
// formes d'un transformable ont des compétences DIFFÉRENTES et méritent chacune
// leur fiche, alors que les deux faces d'une collab sont le même monstre —
// mêmes stats, mêmes compétences, seuls le nom et le portrait changent. C'est
// pourquoi l'une donne un sélecteur de forme et l'autre un portrait partagé.
export function jumeauDeCollab(m: Monster, monsters: Monster[]): Monster | null {
  if (m.jumeauCollab == null) return null;
  return monsters.find((x) => x.com2usId === m.jumeauCollab && x !== m) ?? null;
}

// ⚠️ **Une paire de COLLABORATION n'occupe qu'UNE carte.** Satoru Gojo et
// Werner sont le même monstre : deux cartes laisseraient croire à deux
// recrutements possibles, et on chercherait lequel prendre.
//
// On garde celui au `com2usId` le plus PETIT — l'entrée SW d'origine, arrivée
// avant la collab. Comme pour les transformations, ce qui compte est surtout que
// la règle soit **déterministe** : le même monstre doit rester en carte d'un
// rendu à l'autre, sinon l'affichage changerait sous le curseur.
//
// ⚠️ **Si le jumeau est absent de la liste, rien n'est écarté** : un filtre
// d'élément ou une recherche peut l'avoir retiré, et écarter quand même
// laisserait un trou inexplicable.
export function sansDoublonDeCollab(monsters: Monster[]): Monster[] {
  const parId = new Map<number, Monster>();
  for (const m of monsters) {
    if (m.com2usId != null) parId.set(m.com2usId, m);
  }

  const ecartes = new Set<Monster>();
  for (const m of monsters) {
    if (m.jumeauCollab == null) continue;
    const jumeau = parId.get(m.jumeauCollab);
    if (!jumeau || jumeau === m) continue;
    const idA = m.com2usId ?? Infinity;
    const idB = jumeau.com2usId ?? Infinity;
    if (idA > idB) ecartes.add(m);
  }

  return ecartes.size === 0 ? monsters : monsters.filter((m) => !ecartes.has(m));
}

export function sansDoublonDeTransformation(monsters: Monster[]): Monster[] {
  // Index par id SWARFARM : c'est la clé que `transformsTo` référence.
  const parSwarfarm = new Map<number, Monster>();
  for (const m of monsters) {
    if (m.swarfarmId != null) parSwarfarm.set(m.swarfarmId, m);
  }

  const ecartes = new Set<Monster>();
  for (const m of monsters) {
    if (m.transformsTo == null) continue;
    const autre = parSwarfarm.get(m.transformsTo);
    // Cible absente de la liste (filtrée, ou hors de nos données) : rien à
    // dédupliquer, on garde l'entrée telle quelle.
    if (!autre || autre === m) continue;
    // Les deux formes sont là : on écarte celle au `com2usId` le plus grand.
    const idA = m.com2usId ?? Infinity;
    const idB = autre.com2usId ?? Infinity;
    if (idA > idB) ecartes.add(m);
  }

  return ecartes.size === 0 ? monsters : monsters.filter((m) => !ecartes.has(m));
}
