// Speed tuning : à chaque « tick » d'horloge, la barre d'action (ATB) de chaque
// monstre monte de `vitesse_combat × 7 %` ; un monstre agit dès qu'elle atteint
// 100. Modèle partagé avec la page Mécaniques (`ΔATB/tick = combat × 7/100`) et
// avec les ticks de siège (voir lib/speed.ts). Fonctions PURES, testées sans
// rendu (voir tests/speed-tune.test.ts).

// Un tick fait monter l'ATB de 7 % de la vitesse de combat.
export const ATB_PAR_TICK = 7;

// Horizon de simulation par défaut : on déroule 40 ticks pour voir plusieurs
// TOURS de chaque monstre, pas seulement le premier.
export const HORIZON_TICKS = 40;

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
//   - atbMod[t]   : modification PONCTUELLE de la barre au tick t (+% pour
//                   remplir, −% pour vider). La barre ne descend jamais sous 0.
//   - speedMod[t] : buff/ralenti de VITESSE appliqué **UNIQUEMENT au tick t**.
//                   ⚠️ **Pas de report** : les ticks non marqués calculent l'ATB
//                   à la vitesse de base. Un buff qui dure plusieurs ticks se
//                   marque sur chacun des ticks où il est actif.
export type ModParTick = Record<number, number>;

// La vitesse de combat de base (base + runes + totem + lead), calculée par
// l'appelant (combatSpeed de speed.ts). La simulation lui applique les
// modificateurs par tick.
export interface TuneMonstre {
  id: string;
  combat: number;
  camp: Camp;
  atbMod?: ModParTick;
  speedMod?: ModParTick;
  // Bonus d'artéfact « augmente l'effet du buff de vitesse » (%), ADDITIF au
  // buff appliqué et actif UNIQUEMENT quand un buff de vitesse (> 0) est présent
  // ce tick-là. Ex. buff +30 % + artéfact +10 % → vitesse × 1,40 ce tick.
  // (Ne s'applique pas à un ralenti.) Modèle communautaire, voir
  // spec/outils/speed-tuning.md.
  artefactBuff?: number;
}

// Un tour pris : quel monstre, à quel tick, et son rang dans la séquence GLOBALE
// des actions (1 = la toute première action de la simulation).
export interface Action {
  id: string;
  camp: Camp;
  tick: number;
  ordre: number;
}

export interface LigneSim {
  id: string;
  camp: Camp;
  combat: number;
  incBase: number; // ATB/tick de base (sans modificateur), pour repère
  // Barre d'action à chaque tick, de 1 à `horizon` (index i = tick i+1). Chute à
  // 0 le tick suivant chaque tour de ce monstre. C'est la trajectoire RÉELLE
  // (buffs, boosts et remises à zéro inclus) affichée dans le tableau.
  trajectoire: number[];
}

export interface Simulation {
  horizon: number;
  lignes: LigneSim[];
  actions: Action[]; // toutes les actions, dans l'ordre chronologique
}

// Simule `horizon` ticks avec la règle **un seul monstre agit par tick** et les
// modificateurs par tick. Contrairement à une lecture « premier tour », le
// monstre qui agit NE SORT PAS : sa barre **repart de 0** (le surplus au-dessus
// de 100 n'est pas conservé) et se remplit à nouveau — il peut donc rejouer.
// Cela donne l'enchaînement des tours sur toute la durée. Voir
// spec/outils/speed-tuning.md.
//
// À chaque tick : chaque monstre gagne `atbParTick(combat × (1 + buffActif))`,
// puis reçoit sa modification de barre (`atbMod`), sans jamais descendre sous 0.
// Si au moins un a atteint 100, UN SEUL prend le tour — barre la plus haute,
// départagée par la vitesse de combat de base puis par l'ordre de placement.
//
// ⚠️ Ce N'EST PAS un tri par vitesse : trois monstres pleins au même tick jouent
// aux ticks n, n+1, n+2. Un boost d'ATB ou un buff de vitesse posé tôt peut
// faire passer un monstre devant un plus rapide.
export function simuler(monstres: TuneMonstre[], horizon = HORIZON_TICKS): Simulation {
  // Vitesse de base ≤ 0 (base inconnue) → n'agit jamais, écarté de la
  // simulation (plutôt que de fausser la lecture avec une barre plate).
  const etat = monstres
    .map((m, placement) => ({
      ...m,
      incBase: atbParTick(m.combat),
      atb: 0,
      placement,
      traj: [] as number[],
    }))
    .filter((m) => m.combat > 0);

  const actions: Action[] = [];
  for (let tick = 1; tick <= horizon; tick++) {
    for (const m of etat) {
      // Buff de vitesse UNIQUEMENT sur les ticks marqués ; sinon vitesse de base.
      // Un buff (> 0) est amplifié par le bonus d'artéfact, additivement ; un
      // ralenti (< 0) n'est pas concerné.
      const buffBase = m.speedMod?.[tick] ?? 0;
      const buff = buffBase > 0 ? buffBase + (m.artefactBuff ?? 0) : buffBase;
      m.atb += atbParTick((m.combat * (100 + buff)) / 100);
      const boost = m.atbMod?.[tick] ?? 0;
      if (boost) m.atb += boost;
      if (m.atb < 0) m.atb = 0;
      // On enregistre AVANT la remise à zéro : la case du tour montre la barre
      // pleine (≥ 100) qui a déclenché l'action.
      m.traj.push(m.atb);
    }
    const prets = etat.filter((m) => m.atb >= 100);
    if (prets.length === 0) continue;
    prets.sort((a, b) => b.atb - a.atb || b.combat - a.combat || a.placement - b.placement);
    const gagnant = prets[0];
    actions.push({ id: gagnant.id, camp: gagnant.camp, tick, ordre: actions.length + 1 });
    gagnant.atb = 0; // tour pris : la barre repart de 0 au tick suivant
  }

  return {
    horizon,
    actions,
    lignes: etat.map((m) => ({
      id: m.id,
      camp: m.camp,
      combat: m.combat,
      incBase: m.incBase,
      trajectoire: m.traj,
    })),
  };
}

// Le PREMIER tour de chaque monstre, dans l'ordre où il tombe : c'est « qui joue
// avant qui ». `ordre` est renuméroté 1..k sur ces premiers tours.
export function premiersTours(sim: Simulation): Action[] {
  const vus = new Set<string>();
  const out: Action[] = [];
  for (const a of sim.actions) {
    if (vus.has(a.id)) continue;
    vus.add(a.id);
    out.push({ ...a, ordre: out.length + 1 });
  }
  return out;
}
