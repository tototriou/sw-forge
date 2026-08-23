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

// Modificateurs saisis dans les deux grilles éditables, indexés PAR TICK.
//   - atbMod[t]   : boost PONCTUEL de barre d'action au tick t (+% appliqué une
//                   fois, ce tick-là). Peut être négatif (réduction d'ATB).
//   - speedMod[t] : buff/ralenti de VITESSE posé au tick t. ⚠️ **SOUTENU** : il
//                   reste actif du tick t jusqu'à la fin (ou jusqu'à un autre
//                   `speedMod` posé plus tard) — un buff « +30 % » ne se saisit
//                   qu'une fois, au tick où il tombe, pas sur chaque tick suivant.
export type ModParTick = Record<number, number>;

// Le buff de vitesse ACTIF au tick `t` = le dernier `speedMod` posé à un tick
// ≤ t (report vers l'avant), ou 0 si aucun.
export function buffActif(speedMod: ModParTick | undefined, t: number): number {
  if (!speedMod) return 0;
  let meilleur = -1;
  let valeur = 0;
  for (const cle in speedMod) {
    const tick = Number(cle);
    if (tick <= t && tick > meilleur) {
      meilleur = tick;
      valeur = speedMod[cle];
    }
  }
  return valeur;
}

// La vitesse de combat de base (base + runes + totem + lead), calculée par
// l'appelant (combatSpeed de speed.ts). La simulation lui applique les
// modificateurs par tick.
export interface TuneMonstre {
  id: string;
  combat: number;
  camp: Camp;
  atbMod?: ModParTick;
  speedMod?: ModParTick;
}

export interface OrdreEntree {
  id: string;
  camp: Camp;
  combat: number;
  incBase: number; // ATB/tick de base (sans modificateur), pour repère
  actTick: number; // tick où ce monstre prend son tour
  rang: number; // 1 = joue en premier
  // Barre d'action cumulée à chaque tick, de 1 à `actTick` (index i = tick i+1).
  // C'est la trajectoire RÉELLE (buffs et boosts inclus) affichée dans le
  // tableau — plus linéaire dès qu'un modificateur entre en jeu.
  trajectoire: number[];
}

// Ordre de tour par simulation tick par tick, avec la règle **un seul monstre
// agit par tick** et les modificateurs par tick.
//
// À chaque tick : chaque monstre gagne `atbParTick(combat × (1 + buffActif))`,
// puis reçoit son boost ponctuel de barre (`atbMod`), sans jamais descendre
// sous 0. Si au moins un a atteint 100, UN SEUL prend le tour — barre la plus
// haute, départagée par la vitesse de combat de base puis par l'ordre de
// placement — et sort de la course (on ne modélise que le PREMIER tour de
// chacun). Voir spec/outils/speed-tuning.md.
//
// ⚠️ Ce N'EST PAS un tri par vitesse : trois monstres pleins au même tick
// prennent le tour aux ticks n, n+1, n+2. Et un boost d'ATB ou un buff de
// vitesse posé tôt peut faire passer un monstre devant un plus rapide.
export function simulerOrdre(monstres: TuneMonstre[], limite = 500): OrdreEntree[] {
  // Vitesse de base ≤ 0 (base inconnue) → n'agit jamais, écarté de l'ordre
  // (plutôt que de boucler jusqu'à la limite puis de fausser les rangs).
  const reste = monstres
    .map((m, placement) => ({
      ...m,
      incBase: atbParTick(m.combat),
      atb: 0,
      placement,
      traj: [] as number[],
    }))
    .filter((m) => m.combat > 0);

  const ordre: OrdreEntree[] = [];
  let tick = 0;
  while (reste.length > 0 && tick < limite) {
    tick++;
    for (const m of reste) {
      const buff = buffActif(m.speedMod, tick);
      m.atb += atbParTick((m.combat * (100 + buff)) / 100);
      const boost = m.atbMod?.[tick] ?? 0;
      if (boost) m.atb += boost;
      if (m.atb < 0) m.atb = 0;
      m.traj.push(m.atb);
    }
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
      incBase: gagnant.incBase,
      actTick: tick,
      rang: ordre.length + 1,
      trajectoire: gagnant.traj,
    });
    reste.splice(reste.indexOf(gagnant), 1);
  }
  return ordre;
}
