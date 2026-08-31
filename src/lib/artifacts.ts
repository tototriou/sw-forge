// Qualité d'un artéfact : **score** (celui du jeu) et **efficience**.
//
// ⚠️ Ce n'est PAS l'efficience des runes, et ça ne peut pas l'être. Une rune se
// mesure sur des stats commensurables ; les substats d'artéfact sont 57 effets
// CONDITIONNELS hétérogènes (« vol de vie », « dégâts de bombe », « dmg crit
// Compétence 2 ») qu'aucun dénominateur commun ne relie. La formule ci-dessous
// ne les met donc pas sur une échelle unique : elle rapporte **chaque ligne au
// plafond de sa propre famille**. Voir spec/compte/calcul-artefacts.md.
//
// ⚠️ Aucun potentiel au-delà de l'état actuel : il n'existe **ni meule ni gemme**
// pour les artéfacts. Un artéfact au +15 a épuisé sa marge, ce qu'il vaut est
// définitif — d'où l'absence de tout `artifactPotential` ici, contrairement à
// runeOptim.ts.

import { ArtifactArchetype, ArtifactDetail, ArtifactKind, ElementKey } from '../types';

/* --------------------------------------------------------------------------
 * Éligibilité — quel artéfact CE monstre peut-il porter
 * ----------------------------------------------------------------------- */

// Ce qu'il faut savoir d'un monstre pour trancher. Volontairement RÉDUIT au
// strict nécessaire plutôt que `Monster` entier : la règle ne dépend de rien
// d'autre, et un type minimal la rend appelable depuis un contexte qui n'a pas
// de fiche complète sous la main (un exemplaire importé, un test).
export interface PorteurArtefact {
  element: ElementKey;
  archetype?: ArtifactArchetype | null;
}

// Règle du jeu : un monstre ne porte qu'UN artéfact de chaque sorte, et chacun
// doit correspondre — l'attribut à son élément, le type à son archétype.
//
// ⚠️ **C'est ce qui rend l'optimisation d'artéfacts abordable.** Sur un
// inventaire réel (~2 000 artéfacts), elle ramène chaque emplacement à ~200
// candidats : plus besoin de meet-in-the-middle ni de plafond de rétention,
// une double boucle exhaustive suffit et reste exacte.
//
// ⚠️ **Un archétype ABSENT ou `null` n'est jamais éligible** à un artéfact de
// type — c'est le cas des monstres de matériau (angelmons), et celui d'un
// `monsters.json` régénéré avant que le champ n'existe. Répondre « oui » par
// défaut proposerait des artéfacts qu'aucun de ces monstres ne peut équiper ;
// répondre « non » ne fait que ne rien proposer, ce qui se voit.
export function artifactFitsMonster(art: ArtifactDetail, porteur: PorteurArtefact): boolean {
  // ⚠️ L'INTANGIBLE est un joker : il se pose sur n'importe quel monstre, dans
  // les deux sortes. Testé EN PREMIER parce que ses champs `element`/
  // `archetype` ne veulent rien dire (com2us y met 98) — les lire d'abord le
  // rejetterait systématiquement.
  //
  // ⚠️ Sa contrepartie est une contrainte de PAIRE, invisible ici : on ne peut
  // pas porter deux intangibles à la fois. Voir `artifactPairAllowed` — filtrer
  // chaque emplacement séparément ne suffit donc PAS.
  if (art.intangible) return true;
  if (art.kind === 'element') return art.element != null && art.element === porteur.element;
  return art.archetype != null && art.archetype === porteur.archetype;
}

// Cette PAIRE est-elle portable ensemble ? Les deux emplacements sont par
// ailleurs indépendants — c'est la seule règle qui les relie.
//
// ⚠️ **Un seul intangible à la fois.** Chaque artéfact pris isolément peut être
// parfaitement éligible et la paire rester interdite : un optimiseur qui se
// contenterait de `eligibleArtifacts` par emplacement proposerait des paires
// impossibles à équiper.
//
// `null` = emplacement laissé vide, toujours permis.
export function artifactPairAllowed(attribut: ArtifactDetail | null, type: ArtifactDetail | null): boolean {
  return !(attribut?.intangible && type?.intangible);
}

// Les artéfacts de l'inventaire que CE monstre peut porter, pour UNE sorte.
// ⚠️ Deux emplacements indépendants : on filtre par sorte plutôt que de rendre
// une liste mêlée que l'appelant devrait re-séparer.
export function eligibleArtifacts(
  inventaire: ArtifactDetail[],
  porteur: PorteurArtefact,
  kind: ArtifactKind
): ArtifactDetail[] {
  return inventaire.filter((a) => a.kind === kind && artifactFitsMonster(a, porteur));
}

// Fourchette de **proc** d'une propriété : ce qu'un tirage lui ajoute, du moins
// bon au meilleur. Valeurs du jeu, relevées à la main.
//
// ⚠️ On raisonne en PROCS, pas en valeurs observées. Une propriété peut être
// **gemmée**, ce qui rehausse sa valeur : déduire les plafonds d'un inventaire
// réel ferait entrer les gemmes dans l'étalon, et le score de tout le monde
// changerait selon le fichier importé.
const PROC: Record<number, [min: number, max: number]> = {
  200: [9, 14], // ATQ + selon PV perdus
  201: [9, 14], // DEF + selon PV perdus
  202: [9, 14], // VIT + selon PV perdus
  204: [3, 5], // Effet d'augmentation d'ATQ
  205: [2, 4], // Effet d'augmentation de DEF
  206: [4, 6], // Effet d'augmentation de VIT
  208: [2, 4], // Dégâts de contre-attaque
  209: [2, 4], // Dégâts d'attaque conjointe
  210: [2, 4], // Dégâts de bombe
  214: [2, 4], // Dégâts crit reçus
  215: [5, 8], // Vol de vie
  216: [4, 6], // PV à la résurrection
  217: [4, 6], // Barre d'action à la résurrection
  218: [0.2, 0.3], // Dégâts add. par % des PV
  219: [2, 4], // Dégâts add. par % de l'ATQ
  220: [2, 4], // Dégâts add. par % de la DEF
  221: [25, 40], // Dégâts add. par % de la VIT
  222: [4, 6], // Dmg crit si PV ennemi élevés
  223: [8, 12], // Dmg crit si PV ennemi bas
  224: [2, 4], // Dmg crit mono-cible à ton tour
  225: [2, 4], // Dégâts contre/attaque conjointe
  226: [3, 5], // Effet Buff ATQ/DEF

  // ── Élémentaires (artéfacts d'attribut)
  300: [3, 5], // dégâts infligés au Feu
  301: [3, 5], // … à l'Eau
  302: [3, 5], // … au Vent
  303: [3, 5], // … à la Lumière
  304: [3, 5], // … aux Ténèbres
  305: [4, 6], // dégâts reçus du Feu
  306: [4, 6], // … de l'Eau
  307: [4, 6], // … du Vent
  308: [4, 6], // … de la Lumière
  309: [4, 6], // … des Ténèbres

  // ── Compétences (artéfacts de type)
  400: [4, 6], // dmg crit Compétence 1
  401: [4, 6], // … 2
  402: [4, 6], // … 3
  403: [4, 6], // … 4
  404: [4, 6], // récupération Compétence 1
  405: [4, 6], // … 2
  406: [4, 6], // … 3
  407: [4, 6], // précision Compétence 1
  408: [4, 6], // … 2
  409: [4, 6], // … 3
  410: [4, 6], // dmg crit Compétence 3/4
  411: [4, 6], // dmg crit 1ʳᵉ attaque

  // ⚠️ Codes SANS fourchette connue — absents de l'inventaire de référence
  // comme de la table relevée : 203 (VIT sous incapacité), 207 (augmentation du
  // taux crit), 211 (réflexion), 212 (coup dévastateur), 213 (dégâts reçus sous
  // incapacité). Ils comptent **0** au score plutôt qu'une valeur devinée, cf.
  // `subsRatio`.
};

// ⚠️ Une propriété proc **5 fois** au maximum : le proc initial, puis les 4
// améliorations. C'est la même mécanique que le « quad roll » (4 améliorations
// au même endroit) — d'où 5 et non 4.
//
// Calage : cette constante est ce qui fait tomber la capture de référence sur
// **147**, le score exact affiché par le jeu. Avec 4, elle donnait 184 et
// 24 lignes d'un compte réel dépassaient leur plafond ; avec 5, aucune.
const PROCS_MAX = 5;

// Plafond d'une propriété = ce qu'elle vaut si ses 5 procs sortent au maximum.
export const ARTIFACT_SUB_MAX: Record<number, number> = Object.fromEntries(
  Object.entries(PROC).map(([code, [, max]]) => [code, max * PROCS_MAX])
);

// ⚠️ Diviseur de l'EFFICIENCE. Joue le rôle du 2,8 des runes : il ramène la
// somme des ratios sur une échelle où 100 % est un artéfact excellent, pas
// parfait (4 lignes au plafond vaudraient 250 %).
//
// Calibré sur un inventaire réel de 2 120 artéfacts : médiane **76 %**,
// meilleure pièce **97,9 %**. L'échelle garde donc de la marge au-dessus du
// meilleur drop constaté, sans que personne n'y arrive par accident.
export const ARTIFACT_EFF_DIVISOR = 1.6;

// ⚠️ Facteur du SCORE affiché par le jeu. Vérifié à l'unité près sur un artéfact
// réel — lignes 303 (+3 %), 308 (−11 %), 302 (+6 %), 219 (9 %) :
//   3/25 + 11/30 + 6/25 + 9/20 = 1,176667 → round(× 125) = **147**,
// exactement ce que le jeu affiche sur la fiche de cet artéfact.
export const SCORE_FACTOR = 125;

// Somme des ratios `valeur / plafond` des substats.
//
// ⚠️ Un code inconnu compte **0** plutôt que de prendre un dénominateur par
// défaut : une valeur inventée fausserait le score sans que rien ne le signale.
// Les codes non couverts par ARTIFACT_SUB_MAX sont donc simplement ignorés.
function subsRatio(art: ArtifactDetail): number {
  let total = 0;
  for (const sub of art.subs) {
    const max = ARTIFACT_SUB_MAX[sub.code];
    if (max) total += sub.value / max;
  }
  return total;
}

// **Score** de l'artéfact — le nombre affiché dans le jeu (entier).
export function artifactScore(art: ArtifactDetail): number {
  return Math.round(subsRatio(art) * SCORE_FACTOR);
}

// **Efficience** de l'artéfact, en %.
export function artifactEfficiency(art: ArtifactDetail): number {
  return (subsRatio(art) / ARTIFACT_EFF_DIVISOR) * 100;
}

// Rolls (améliorations) tombés sur chaque substat, et total de l'artéfact.
//
// ⚠️ C'est `sec_effects[i][2]`, décodé à l'import dans `EffectLine.rolls`. Ne
// pas confondre avec `[4]` (`enchant`, substat modifié) : les deux ont été pris
// l'un pour l'autre une fois, et `[4]` monte jusqu'à 87 — il ne compte rien.
export function artifactRolls(art: ArtifactDetail): number {
  return art.subs.reduce((n, s) => n + (s.rolls ?? 0), 0);
}

// Rolls qu'un artéfact reçoit **au total** une fois monté au +15, par rareté.
// Vérifié sur 2 120 artéfacts : la somme des rolls vaut exactement ce nombre
// dès que le niveau est 15.
export const ROLLS_BY_RARITY: Record<number, number> = { 3: 2, 4: 3, 5: 4 };

// Le maximum de rolls qu'un artéfact PEUT porter (sa rareté au +15).
export function maxRolls(rarity: number): number {
  return ROLLS_BY_RARITY[rarity] ?? 0;
}

// **Quad roll** — tous les rolls de l'artéfact sont tombés sur LA MÊME ligne
// (proc initial + les 4 améliorations au même endroit, pour un légendaire).
//
// ⚠️ C'est le meilleur tirage possible : la valeur d'une seule propriété est
// poussée au maximum au lieu d'être éparpillée sur quatre. Rare — 50 artéfacts
// sur 2 120 (2,4 %), tous légendaires, puisque seule cette rareté distribue
// 4 rolls.
//
// Le seuil suit donc la rareté : un héroïque « concentré » porte ses 3 rolls au
// même endroit. Comparer un héroïque à 3 et un légendaire à 4 sur le même
// critère « 4 rolls » ne dirait rien de la qualité du tirage — un héroïque ne
// peut structurellement pas y arriver.
function bestRollStack(art: ArtifactDetail): number {
  let best = 0;
  for (const sub of art.subs) {
    const r = sub.rolls ?? 0;
    if (r > best) best = r;
  }
  return best;
}

// L'artéfact a-t-il concentré TOUS ses rolls sur une seule ligne ?
export function isFullStack(art: ArtifactDetail): boolean {
  const max = maxRolls(art.rarity);
  return max > 0 && bestRollStack(art) === max;
}
