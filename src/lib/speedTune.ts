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
  // Compétence de ce monstre, déclenchée par SON TOUR, sur TOUT SON CAMP (lui
  // compris — dans le jeu, « augmente la barre d'attaque de tous les alliés »
  // inclut le lanceur, dont la barre vient de retomber à 0).
  //
  //   - skillAtb   : +% de barre d'attaque posé au tick OÙ IL JOUE.
  //   - skillSpeed : +% de vitesse posé sur son camp À PARTIR DU TICK SUIVANT
  //                  (le gain du tick courant est déjà acquis), et jusqu'à la
  //                  fin de l'horizon — la durée réelle (2 tours) n'est pas
  //                  modélisée, voir spec/outils/speed-tuning.md.
  //
  // ⚠️ C'est ce qui rend l'outil AUTOMATIQUE : un Eshir qui remplit la barre des
  // siens n'a plus à être posé à la main dans la grille, tick par tick — il
  // frappe là où sa vitesse le fait jouer, et suit quand on change les vitesses.
  skillAtb?: number;
  skillSpeed?: number;
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
  // Buff de vitesse posé par une COMPÉTENCE, camp par camp : actif à partir du
  // tick qui suit le tour du lanceur, jusqu'à la fin. Un buff ne s'empile pas
  // avec celui saisi à la main dans la grille — c'est le plus fort qui vaut.
  const buffCamp: Record<Camp, number> = { allie: 0, ennemi: 0 };

  for (let tick = 1; tick <= horizon; tick++) {
    for (const m of etat) {
      // Buff de vitesse UNIQUEMENT sur les ticks marqués ; sinon vitesse de base.
      // Un buff (> 0) est amplifié par le bonus d'artéfact, additivement ; un
      // ralenti (< 0) n'est pas concerné.
      const buffBase = Math.max(m.speedMod?.[tick] ?? 0, buffCamp[m.camp]);
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

    // Sa compétence frappe SON camp au moment où il joue.
    const boost = gagnant.skillAtb ?? 0;
    if (boost) {
      for (const m of etat) {
        if (m.camp !== gagnant.camp) continue;
        m.atb += boost;
        if (m.atb < 0) m.atb = 0;
        // La case du tick montre la barre APRÈS le boost — sauf pour le lanceur,
        // dont la case garde la barre pleine qui a déclenché son tour.
        if (m !== gagnant) m.traj[m.traj.length - 1] = m.atb;
      }
    }
    if (gagnant.skillSpeed && gagnant.skillSpeed > buffCamp[gagnant.camp]) {
      buffCamp[gagnant.camp] = gagnant.skillSpeed;
    }
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

/* ------------------------------------------------- Chaîne d'ouverture ---- */

// « Est-ce que TOUTE mon équipe joue avant que l'adversaire ne s'intercale ? »
// C'est la question du speed tune : un seul adverse qui passe au milieu (souvent
// un monstre à grosse vitesse de base qui remplit la barre des siens) coupe le
// combo. La cible est le PREMIER adverse à agir — la condition la plus stricte.

// Vitesse de combat au-delà de laquelle il n'y a plus rien à gagner : agir dès
// le tick 1 (`speedForTick(1)` = 1429). Sert de borne haute à la recherche.
export const COMBAT_MAX = speedForTick(1);

// Nombre maximal de passes du solveur (voir `vitessesRequises`) : corriger un
// allié change ce qu'il faut aux autres, on repasse tant que ça avance.
export const PASSES_MAX = 4;

// Plafond de l'artéfact « Effet aug. VIT » (code 206) : un proc vaut au mieux
// 6 % (voir PROC dans artifacts.ts), une ligne encaisse au plus 5 procs (le
// tirage initial + les 4 améliorations d'un artéfact +15), et un monstre porte
// DEUX artéfacts → 2 × 30 = 60 %. Au-delà, ce n'est plus une piste à proposer.
export const ARTE_MAX = 60;

export interface Coupure {
  // Le premier adverse à agir, ou `null` s'il n'y en a aucun (rien à vérifier).
  coupeur: Action | null;
  // Alliés dont le PREMIER tour tombe APRÈS lui — `tick: null` = n'agit jamais
  // dans l'horizon simulé.
  coupes: { id: string; tick: number | null }[];
  // Tous les alliés simulés jouent avant le coupeur (vrai aussi s'il n'y a pas
  // d'adverse : rien ne coupe).
  ok: boolean;
}

export function diagnostiquerChaine(monstres: TuneMonstre[], horizon = HORIZON_TICKS): Coupure {
  const sim = simuler(monstres, horizon);
  const premiers = premiersTours(sim);
  const coupeur = premiers.find((a) => a.camp === 'ennemi') ?? null;

  const coupes: Coupure['coupes'] = [];
  for (const l of sim.lignes) {
    if (l.camp !== 'allie') continue;
    const mien = premiers.find((a) => a.id === l.id) ?? null;
    if (!coupeur) continue; // aucun adverse : rien à couper
    if (!mien) coupes.push({ id: l.id, tick: null });
    else if (mien.tick > coupeur.tick) coupes.push({ id: l.id, tick: mien.tick });
  }
  return { coupeur, coupes, ok: coupes.length === 0 };
}

// Un allié coupé et la vitesse de combat qui le ferait passer avant le coupeur.
export interface VitesseRequise {
  id: string;
  combatActuel: number;
  // `null` = même à `COMBAT_MAX`, il reste coupé (trop d'alliés à caser avant
  // l'adverse : un seul agit par tick).
  combatRequis: number | null;
}

// Ce qu'il faut trouver, allié par allié, pour que TOUTE l'équipe joue avant le
// premier adverse.
//
// Recherche DICHOTOMIQUE sur l'axe demandé, avec re-simulation à chaque essai —
// pas de formule fermée : la règle « un seul monstre par tick », les compétences,
// les boosts de barre et les buffs par tick s'y mêlent. Le prédicat « cet allié
// joue avant le premier adverse » est MONOTONE sur les deux axes (plus vite, ou
// buff plus amplifié = barre plus haute à chaque tick = tour plus tôt, et
// l'adverse ne peut qu'être repoussé), ce qui rend la dichotomie valide ; c'est
// vérifié par test différentiel contre un balayage linéaire exhaustif, sur les
// DEUX axes (tests/speed-tune.test.ts).
//
// ⚠️ Les alliés sont traités du PLUS RAPIDE au plus lent, et chaque valeur
// trouvée est CONSERVÉE pour les suivants : les ticks avant l'adverse sont une
// ressource partagée (un seul monstre par tick), donc corriger un allié change
// ce qu'il faut aux autres. Le résultat est un jeu cohérent, pas une somme de
// corrections indépendantes.

// L'AXE sur lequel on cherche : la vitesse de combat, ou le bonus d'artéfact
// « Effet aug. VIT ». Deux leviers pour le même but — passer avant l'adverse —
// et l'écran propose les deux : gagner de la vitesse de runes, OU amplifier le
// buff de vitesse qu'on reçoit déjà.
type Axe = 'combat' | 'artefactBuff';

const PLAFOND: Record<Axe, number> = { combat: COMBAT_MAX, artefactBuff: ARTE_MAX };

interface Resolution {
  id: string;
  actuel: number;
  requis: number | null;
}

// Cœur commun aux deux solveurs. Voir le commentaire de `vitessesRequises` pour
// la méthode (dichotomie + passes) : seul l'axe cherché change.
//
// ⚠️ Sur l'axe `artefactBuff`, un allié qui ne reçoit AUCUN buff de vitesse est
// insensible au levier (l'artéfact n'amplifie que le buff) : la dichotomie
// échoue jusqu'au plafond et renvoie `null` — c'est le comportement attendu, il
// n'y a rien à proposer de ce côté-là.
function resoudre(monstres: TuneMonstre[], horizon: number, axe: Axe): Resolution[] {
  const valeur = (m: TuneMonstre): number => (axe === 'combat' ? m.combat : (m.artefactBuff ?? 0));
  const poser = (m: TuneMonstre, v: number) => {
    if (axe === 'combat') m.combat = v;
    else m.artefactBuff = v;
  };

  const courant = monstres.map((m) => ({ ...m }));
  const parId = new Map(courant.map((m) => [m.id, m]));

  const passeAvant = (id: string): boolean => {
    const premiers = premiersTours(simuler(courant, horizon));
    const adverse = premiers.find((a) => a.camp === 'ennemi');
    const mien = premiers.find((a) => a.id === id);
    if (!mien) return false;
    return !adverse || mien.tick < adverse.tick;
  };

  for (let passe = 0; passe < PASSES_MAX; passe++) {
    const diag = diagnostiquerChaine(courant, horizon);
    if (diag.ok || !diag.coupeur) break;

    // Du PLUS RAPIDE au plus lent : les ticks avant l'adverse sont une ressource
    // partagée (un seul monstre par tick), les plus rapides prennent les leurs
    // d'abord. Chaque valeur trouvée est conservée pour les suivants.
    const aTraiter = diag.coupes
      .map((c) => parId.get(c.id))
      .filter((m): m is (typeof courant)[number] => !!m)
      .sort((a, b) => b.combat - a.combat);

    let progres = false;
    for (const m of aTraiter) {
      if (passeAvant(m.id)) continue; // déjà réglé par la correction d'un autre
      const depart = valeur(m);
      let bas = depart + 1;
      let haut = PLAFOND[axe];
      if (bas > haut) continue; // déjà au plafond de cet axe
      poser(m, haut);
      if (!passeAvant(m.id)) {
        poser(m, depart); // insoluble pour lui : on le laisse tel quel
        continue;
      }
      // Dichotomie sur ]depart, plafond] : la plus petite valeur qui passe.
      while (bas < haut) {
        const milieu = Math.floor((bas + haut) / 2);
        poser(m, milieu);
        if (passeAvant(m.id)) haut = milieu;
        else bas = milieu + 1;
      }
      poser(m, bas);
      progres = true;
    }
    // ⚠️ Une passe ne suffit pas toujours : accélérer un allié peut lui faire
    // prendre le tick d'un autre, ou déplacer le tour de celui qui remplit la
    // barre de l'équipe. On repasse tant que ça avance, dans une limite fixe.
    if (!progres) break;
  }

  // Verdict final sur les valeurs retenues : ce qui reste coupé est déclaré hors
  // de portée, le reste porte la valeur trouvée.
  const fin = diagnostiquerChaine(courant, horizon);
  const coupesFin = new Set(fin.coupes.map((c) => c.id));
  const out: Resolution[] = [];
  for (const m of monstres) {
    if (m.camp !== 'allie') continue;
    const depart = valeur(m);
    if (coupesFin.has(m.id)) out.push({ id: m.id, actuel: depart, requis: null });
    else {
      const trouve = valeur(parId.get(m.id) ?? m);
      if (trouve > depart) out.push({ id: m.id, actuel: depart, requis: trouve });
    }
  }
  return out;
}

export function vitessesRequises(monstres: TuneMonstre[], horizon = HORIZON_TICKS): VitesseRequise[] {
  return resoudre(monstres, horizon, 'combat').map((r) => ({
    id: r.id,
    combatActuel: r.actuel,
    combatRequis: r.requis,
  }));
}

// L'autre levier : l'artéfact « Effet aug. VIT », qui AMPLIFIE le buff de
// vitesse reçu. `artefactRequis: null` = rien à en attendre pour cet allié —
// soit il ne reçoit aucun buff, soit même 60 % n'y suffiraient pas.
export interface ArtefactRequis {
  id: string;
  artefactActuel: number;
  artefactRequis: number | null;
}

export function artefactsRequis(monstres: TuneMonstre[], horizon = HORIZON_TICKS): ArtefactRequis[] {
  return resoudre(monstres, horizon, 'artefactBuff').map((r) => ({
    id: r.id,
    artefactActuel: r.actuel,
    artefactRequis: r.requis,
  }));
}
