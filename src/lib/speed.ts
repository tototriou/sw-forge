import { ElementKey, Monster } from '../types';

// Calcul de vitesse partagé (RTA, Siège, Arène…), pour rester cohérent partout.

// Totem de vitesse de guilde : +15% de vitesse de base, toujours actif.
export const TOTEM_SPEED = 15;

// Leader skills de vitesse **classiques**, du plus fort au plus faible.
//
// ⚠️ Ce sont des raccourcis, pas la liste exhaustive : le jeu en compte d'autres
// (30 %, 23 %…), et les proposer tous ferait une rangée de boutons qu'on ne lit
// plus. On garde les valeurs les plus courantes, et **un champ libre** prend le
// relais pour le reste (voir TurnOrder).
export const SPEED_LEADS = [33, 28, 24, 21, 19];

// Ticks de vitesse de siège (vitesse de combat cible).
export const SIEGE_TICKS: { key: string; label: string; value: number }[] = [
  { key: 'fast', label: 'Rapide', value: 286 },
  { key: 'slow', label: 'Lent', value: 239 },
];

// Zone de danger d'un tick : raté de peu (juste en dessous), ou dépassé de trop
// (overshoot = vitesse gâchée). Un tune propre = pile sur un tick, ou 0–15 au-dessus.
export const TICK_BELOW_MARGIN = 10; // combat entre tick-10 et tick-1 → il manque peu
export const TICK_ABOVE_MARGIN = 15; // dépasser le tick de PLUS de 15 → trop (danger)

// Détecte si une vitesse de combat est mal calée par rapport aux ticks :
//  - « below » : à ≤10 sous un tick (on l'a raté de peu),
//  - « above » : on a franchi un tick mais on le dépasse de >15 (overshoot).
// Renvoie le tick concerné + le sens + l'écart, ou null si le tune est propre.
export function tickDanger(
  combat: number | null
): { tick: number; kind: 'below' | 'above'; diff: number } | null {
  if (combat === null) return null;
  const ticks = SIEGE_TICKS.map((t) => t.value).sort((a, b) => a - b);

  // Raté de peu : un tick juste au-dessus, à 1..10 près.
  for (const t of ticks) {
    const below = t - combat;
    if (below >= 1 && below <= TICK_BELOW_MARGIN) return { tick: t, kind: 'below', diff: below };
  }

  // Overshoot : on dépasse le tick franchi le plus haut de plus de 15.
  const passed = ticks.filter((t) => t <= combat);
  if (passed.length > 0) {
    const t = passed[passed.length - 1];
    const over = combat - t;
    if (over > TICK_ABOVE_MARGIN) return { tick: t, kind: 'above', diff: over };
  }
  return null;
}

// Message d'alerte d'une équipe, à partir des écarts de ses monstres.
//
// ⚠️ **« Ton équipe n'est pas au tick » ne suffit pas** : ça décrit le symptôme
// sans dire dans quel sens corriger. Or les deux cas se réparent à l'opposé l'un
// de l'autre — accélérer, ou libérer de la vitesse pour la mettre ailleurs.
//
// ⚠️ Quand l'équipe **dépasse un tick sans atteindre le suivant**, on nomme les
// DEUX repères. Ne citer que le tick franchi laisserait croire qu'il faut
// ralentir, alors qu'accélérer jusqu'au tick du dessus est souvent le bon geste.
// L'app ne peut pas trancher à la place du joueur : elle lui donne les bornes.
//
// Les valeurs suffisent, on ne nomme pas les monstres : le slot fautif porte
// déjà un anneau rouge, répéter son nom alourdirait la phrase pour rien.
export function tickTeamMessage(dangers: ReturnType<typeof tickDanger>[]): string | null {
  const actifs = dangers.filter(Boolean) as NonNullable<ReturnType<typeof tickDanger>>[];
  if (actifs.length === 0) return null;

  const ticks = [...new Set(actifs.map((d) => d.tick))];
  // Plusieurs ticks en cause → citer une valeur désignerait le mauvais repère
  // pour une partie de l'équipe.
  const tick = ticks.length === 1 ? ticks[0] : null;
  const tousAuDessus = actifs.every((d) => d.kind === 'above');
  const tousEnDessous = actifs.every((d) => d.kind === 'below');

  if (tousEnDessous) {
    if (tick === null) return "Ton équipe n'atteint pas ses ticks.";
    // Pas de décompte des points manquants : le détail par monstre est déjà
    // lisible sur les cartes, et une phrase courte se lit d'un coup d'œil.
    return `Ton équipe est trop lente pour le tick ${tick}.`;
  }

  if (tousAuDessus) {
    if (tick === null) return 'Ton équipe est trop rapide par rapport aux ticks.';
    const suivant = SIEGE_TICKS.map((t) => t.value)
      .sort((a, b) => a - b)
      .find((v) => v > tick);
    return suivant
      ? `Ton équipe est trop rapide par rapport au tick ${tick}, ou trop lente pour le tick ${suivant}.`
      : `Ton équipe est trop rapide par rapport au tick ${tick}.`;
  }

  // Les deux à la fois : chaque monstre doit être regardé séparément, aucune
  // consigne d'équipe n'aurait de sens.
  return "Ton équipe n'est pas au tick : un monstre est en dessous, un autre au-dessus.";
}

// Bonus du set Swift : +25 % de la vitesse de BASE.
export const SWIFT_SPEED = 25;

// Bonus en % appliqué à la vitesse de BASE.
//
// ⚠️ **Tous les pourcentages qui portent sur la base sont SOMMÉS, puis arrondis
// EN UNE SEULE FOIS à l'entier supérieur.** Totem, lead et Swift entrent dans la
// même somme. Ne jamais arrondir bonus par bonus : c'est l'erreur qui a produit
// tous les écarts d'un point observés.
//
// Cas réels de contrôle, tous vérifiés en jeu :
//
//   sans lead ni Swift — trois monstres calés sur le tick 286
//     base  96 + 175 de runes → ceil(96 × 15 %)  = ceil(14,40) = 15 → 286 ✅
//     base  99 + 172          → ceil(99 × 15 %)  = ceil(14,85) = 15 → 286 ✅
//     base 105 + 165          → ceil(105 × 15 %) = ceil(15,75) = 16 → 286 ✅
//       (`round` donnerait 14 sur le premier, `floor` 14 sur les deux premiers)
//
//   avec lead +30 % et Swift — équipe Susano / Tarq / Chilling, tous eau
//     somme = 15 + 30 + 25 = 70 %
//     Chilling, base 101 → ceil(70,70) = 71
//     Susano,   base 107 → ceil(74,90) = 75
//     Tarq,     base 115 → ceil(80,50) = 81  ← 385 en jeu
//       Arrondir séparément donnait 80 sur Tarq (384) et tombait juste sur les
//       deux autres par hasard : exactement le symptôme observé.
export function pctSpeedBonus(base: number, lead: number, swift = false): number {
  return Math.ceil((base * (TOTEM_SPEED + lead + (swift ? SWIFT_SPEED : 0))) / 100);
}

// Le Swift déjà compté À PLAT dans la « SPD runes ».
//
// Convention de l'app (voir ../../spec/shared/calcul-vitesse.md) : le champ
// « SPD : » — saisi ou reconstitué à l'import — contient déjà le bonus Swift.
// Or le Swift doit entrer dans la SOMME des pourcentages, pas s'ajouter à côté.
// On le retire donc avant de le réinjecter, sinon il compterait deux fois.
// Avantage : les états déjà enregistrés restent valides, aucune réimportation.
export function swiftFlat(base: number): number {
  return Math.ceil((base * SWIFT_SPEED) / 100);
}

// Vitesse de combat = base + runes + bonus % (totem + lead + Swift).
export function combatSpeed(
  base: number | null,
  rune: number | null,
  lead: number,
  swift = false
): number | null {
  if (base === null) return null;
  return base + (rune ?? 0) + pctSpeedBonus(base, lead, swift) - (swift ? swiftFlat(base) : 0);
}

// Vitesse de runes nécessaire pour atteindre une vitesse de combat cible (tick).
export function runeSpeedForTarget(
  base: number | null,
  lead: number,
  target: number,
  swift = false
): number | null {
  if (base === null) return null;
  return target - base - pctSpeedBonus(base, lead, swift) + (swift ? swiftFlat(base) : 0);
}

/* --- Leads de vitesse déduits automatiquement de la leader skill --- */

export interface LeadInfo {
  amount: number;
  area: string;
  element: ElementKey | null;
}

// Le lead de vitesse d'un monstre (leader), ou null s'il n'en a pas.
export function speedLeadOf(monster: Monster | null | undefined): LeadInfo | null {
  const ls = monster?.leaderSkill;
  if (!ls || ls.stat !== 'Attack Speed') return null;
  return { amount: ls.amount, area: ls.area, element: ls.element };
}

// Lead effectif EN SIÈGE (contenu de guilde) pour un allié d'élément donné.
// General/Guild → tous ; Element → seulement l'élément ; Arena/Dungeon → inactif.
export function siegeLeadFor(lead: LeadInfo | null, element: ElementKey): number {
  if (!lead) return 0;
  if (lead.area === 'General' || lead.area === 'Guild') return lead.amount;
  if (lead.area === 'Element') return lead.element === element ? lead.amount : 0;
  return 0;
}

// Le lead est-il actif en siège (indépendamment de l'élément de l'allié) ?
export function isSiegeLeadActive(lead: LeadInfo | null): boolean {
  return !!lead && (lead.area === 'General' || lead.area === 'Guild' || lead.area === 'Element');
}
