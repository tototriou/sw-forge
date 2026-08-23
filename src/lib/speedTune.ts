// Speed tuning : à chaque « tick » d'horloge, la barre d'action (ATB) de chaque
// monstre monte de `vitesse_combat × 7 %` ; un monstre agit dès qu'elle atteint
// 100. Modèle partagé avec la page Mécaniques (`ΔATB/tick = combat × 7/100`) et
// avec les ticks de siège (voir lib/speed.ts). Fonctions PURES, testées sans
// rendu (voir tests/speed-tune.test.ts).

// Un tick fait monter l'ATB de 7 % de la vitesse de combat.
export const ATB_PAR_TICK = 7;

// ATB gagnée par tick pour une vitesse de combat donnée.
export function atbParTick(combat: number): number {
  return (combat * ATB_PAR_TICK) / 100;
}

// Vitesse de combat MINIMALE pour agir au tick `n` (barre pleine à ce tick) :
//   combat × 7/100 × n ≥ 100  ⇔  combat ≥ 10000 / (7n).
// Arrondi au supérieur (il faut ATTEINDRE 100, pas s'en approcher). C'est la
// « règle des ticks » affichée en tête de page — 130 au tick 11, 239 au tick 6
// (« Lent » en siège), 286 au tick 5 (« Rapide »)…
export function speedForTick(n: number): number {
  if (n <= 0) return Infinity;
  return Math.ceil(10000 / (ATB_PAR_TICK * n));
}

export type Camp = 'allie' | 'ennemi';

// Un monstre à départager. La vitesse de COMBAT est déjà calculée par
// l'appelant (via combatSpeed de speed.ts : base + runes + totem + lead) — la
// simulation ne connaît que ce nombre, pour rester découplée du calcul de
// vitesse et testable sur des valeurs brutes.
export interface TuneMonstre {
  id: string;
  combat: number;
  camp: Camp;
}

export interface OrdreEntree {
  id: string;
  camp: Camp;
  combat: number;
  inc: number; // ATB gagnée par tick
  actTick: number; // tick où ce monstre prend son tour
  rang: number; // 1 = joue en premier
}

// Ordre de tour par simulation tick par tick, avec la règle **un seul monstre
// agit par tick**.
//
// À chaque tick : tout le monde gagne son ATB ; si au moins un monstre a
// atteint 100, UN SEUL prend le tour — celui dont la barre est la plus haute,
// départagé par la vitesse de combat puis par l'ordre de placement (départage
// du jeu : à barre et vitesse égales, le premier placé passe). Le gagnant sort
// de la course : on ne modélise que le PREMIER tour de chaque monstre (l'ordre
// « qui joue avant qui »), pas les tours suivants d'un monstre très rapide qui
// rejouerait avant qu'un lent ait agi — raffinement laissé pour plus tard, sans
// effet sur l'ORDRE relatif (un rapide reste toujours devant un lent). Voir
// spec/outils/speed-tuning.md.
//
// ⚠️ **Le départage NE PEUT PAS se réduire à trier par vitesse décroissante.**
// Deux monstres qui franchissent 100 à des ticks différents ne se départagent
// pas par la vitesse mais par le tick d'action : le plus lent qui a démarré sa
// barre « en avance » (jamais le cas ici, tous partent de 0) — dans notre
// modèle à ATB de départ nulle, l'ordre par tick d'action coïncide presque
// avec l'ordre par vitesse, MAIS la règle « un par tick » décale les ex æquo :
// trois monstres pleins au même tick prennent le tour aux ticks n, n+1, n+2.
export function simulerOrdre(monstres: TuneMonstre[], limite = 500): OrdreEntree[] {
  // Un monstre à vitesse nulle ou négative ne remplit jamais sa barre : il
  // n'agit pas et n'entre pas dans l'ordre (plutôt que de boucler jusqu'à la
  // limite puis de fausser les rangs).
  const reste = monstres
    .map((m, placement) => ({ ...m, inc: atbParTick(m.combat), atb: 0, placement }))
    .filter((m) => m.inc > 0);

  const ordre: OrdreEntree[] = [];
  let tick = 0;
  while (reste.length > 0 && tick < limite) {
    tick++;
    for (const m of reste) m.atb += m.inc;
    const prets = reste.filter((m) => m.atb >= 100);
    if (prets.length === 0) continue;
    prets.sort(
      (a, b) => b.atb - a.atb || b.combat - a.combat || a.placement - b.placement
    );
    const gagnant = prets[0];
    ordre.push({
      id: gagnant.id,
      camp: gagnant.camp,
      combat: gagnant.combat,
      inc: gagnant.inc,
      actTick: tick,
      rang: ordre.length + 1,
    });
    reste.splice(reste.indexOf(gagnant), 1);
  }
  return ordre;
}
