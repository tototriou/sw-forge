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

// Ce qu'une compétence FAIT à la barre d'action et à la vitesse, cible par
// cible. Lu dans le kit du monstre (speedTuneKit.ts) ou choisi dans l'analyse
// poussée — la simulation l'applique au tick où le lanceur joue.
//
// ⚠️ **La cible compte autant que la valeur.** Breeze (Kroa) remplit la barre
// d'UN allié — celui qui l'a la plus basse — pas de toute l'équipe : le
// confondre avec un boost de zone triplait son effet. Wood Vine, elle, VIDE la
// barre d'un adverse, ce qui aide tout autant à passer devant lui.
export interface EffetSort {
  // Barre d'action, en % (positif = on remplit).
  atbEquipe?: number; // tout son camp, lui compris
  atbAllie?: number; // UN allié : celui dont la barre est la plus basse
  atbSoi?: number; // lui seul
  atbEnnemi?: number; // RETIRÉ à l'adverse (valeur positive = retrait)
  atbEnnemiTous?: boolean; // le retrait touche tout le camp adverse
  // Vitesse, en % (le jeu : +30 en buff, −30 en ralenti).
  buffEquipe?: number;
  buffSoi?: number;
  ralenti?: number; // posé sur l'adverse
  ralentiTous?: boolean;
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
  // Compétence de ce monstre, déclenchée par SON TOUR, sur TOUT SON CAMP (lui
  // compris — dans le jeu, « augmente la barre d'attaque de tous les alliés »
  // inclut le lanceur, dont la barre vient de retomber à 0).
  //
  //   - `sort`  : ce qu'il lance à son tour ;
  //   - `sort2` : ce qu'il lance à son SECOND tour, quand sa compétence lui rend
  //               son tour (`rejoue`). Rien par défaut : on ne devine pas.
  //
  // ⚠️ C'est ce qui rend l'outil AUTOMATIQUE : un Eshir qui remplit la barre des
  // siens n'a plus à être posé à la main dans la grille, tick par tick — il
  // frappe là où sa vitesse le fait jouer, et suit quand on change les vitesses.
  sort?: EffetSort;
  rejoue?: boolean;
  sort2?: EffetSort;
  // Bonus d'artéfact « Effet aug. VIT » (%), actif UNIQUEMENT quand un buff de
  // vitesse (> 0) est présent ce tick-là (il n'a rien à amplifier sinon, et il ne
  // s'applique pas à un ralenti).
  //
  // ⚠️ **MULTIPLICATIF sur la VALEUR DU BUFF**, pas additif à la vitesse :
  // « 10% artifact makes SPD buff being 33% instead of 30% »
  // ([Ellia's Wiki](https://elliabot.neocities.org/game_mechanics/artifacts/)).
  // Une version précédente ajoutait les deux (30 + 10 = 40 %), ce qui rendait
  // l'artéfact TROIS À QUATRE FOIS trop fort — signalé par l'utilisateur sur un
  // deck où 10 d'artéfact valent ~3 de vitesse, pas ~20.
  artefactBuff?: number;
}

// Un tour pris : quel monstre, à quel tick, et son rang dans la séquence GLOBALE
// des actions (1 = la toute première action de la simulation).
export interface Action {
  id: string;
  camp: Camp;
  tick: number;
  ordre: number;
  // Ce tour-ci est le tour SUPPLÉMENTAIRE rendu par sa compétence, pris au même
  // tick que le précédent.
  rejoue?: boolean;
}

export interface LigneSim {
  id: string;
  camp: Camp;
  combat: number;
  incBase: number; // ATB/tick de base (sans modificateur), pour repère
  // ⚠️ **Ce que les COMPÉTENCES ont réellement posé sur CE monstre**, tick par
  // tick : barre gagnée ou perdue (`effetAtb`), % de vitesse subi
  // (`effetSpeed`). C'est la simulation qui le dit, pas une reconstitution :
  // elle seule sait quel allié avait la barre la plus basse quand Breeze est
  // partie, ou quel adverse Wood Vine a visé. Les grilles s'en servent pour
  // montrer où l'effet tombe.
  effetAtb: ModParTick;
  effetSpeed: ModParTick;
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
      effetAtb: {} as ModParTick,
      effetSpeed: {} as ModParTick,
    }))
    .filter((m) => m.combat > 0);

  const actions: Action[] = [];
  // Modificateurs de vitesse posés par les COMPÉTENCES, camp par camp, actifs à
  // partir du tick qui suit le tour du lanceur et jusqu'à la fin.
  //
  // ⚠️ **Les buffs ne s'empilent pas, les ralentis non plus** (le jeu n'en garde
  // qu'un de chaque) : on retient le plus fort de chaque côté. En revanche buff
  // et ralenti **se compensent** — +30 posé sur une cible ralentie de 30 la
  // ramène à sa vitesse de base, exactement comme en jeu. D'où une somme des
  // deux, et non un maximum global.
  const buffCamp: Record<Camp, number> = { allie: 0, ennemi: 0 };
  const ralentiCamp: Record<Camp, number> = { allie: 0, ennemi: 0 };
  const buffSoi: Record<string, number> = {};

  for (let tick = 1; tick <= horizon; tick++) {
    for (const m of etat) {
      // Buff de vitesse : celui des compétences (camp ou personnel) et celui
      // saisi à la main sur ce tick, qui ne s'empilent pas non plus.
      const manuel = m.speedMod?.[tick] ?? 0;
      const positif = Math.max(manuel > 0 ? manuel : 0, buffCamp[m.camp], buffSoi[m.id] ?? 0);
      const negatif = Math.max(manuel < 0 ? -manuel : 0, ralentiCamp[m.camp]);
      const buffBase = positif - negatif;
      // La part qui vient des COMPÉTENCES (sans la saisie manuelle) : c'est elle
      // que la grille montre en repère.
      const parSort = Math.max(buffCamp[m.camp], buffSoi[m.id] ?? 0) - ralentiCamp[m.camp];
      if (parSort !== 0) m.effetSpeed[tick] = parSort;
      // Un buff (> 0) est amplifié par le bonus d'artéfact, additivement ; un
      // ralenti (< 0) n'est pas concerné.
      const buff = buffBase > 0 ? buffBase * (1 + (m.artefactBuff ?? 0) / 100) : buffBase;
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

    // Ce que sa compétence pose, CIBLE PAR CIBLE.
    const majTraj = (m: (typeof etat)[number]) => {
      // La case du tick montre la barre APRÈS l'effet — sauf pour le lanceur,
      // dont la case garde la barre pleine qui a déclenché son tour.
      if (m !== gagnant) m.traj[m.traj.length - 1] = m.atb;
    };
    const ajouter = (m: (typeof etat)[number], v: number) => {
      m.atb += v;
      if (m.atb < 0) m.atb = 0;
      m.effetAtb[tick] = (m.effetAtb[tick] ?? 0) + v;
      majTraj(m);
    };
    const poser = (sort: EffetSort | undefined) => {
      if (!sort) return;
      const camp = gagnant.camp;
      const adverse: Camp = camp === 'allie' ? 'ennemi' : 'allie';
      if (sort.atbEquipe) for (const m of etat) if (m.camp === camp) ajouter(m, sort.atbEquipe);
      if (sort.atbSoi) ajouter(gagnant, sort.atbSoi);
      if (sort.atbAllie) {
        // ⚠️ **Le lanceur est EXCLU** : sa barre vient de retomber à 0, il serait
        // systématiquement « celui qui l'a la plus basse » et se rendrait à
        // lui-même un boost dont personne ne compte.
        const cibles = etat.filter((m) => m.camp === camp && m !== gagnant);
        if (cibles.length > 0) {
          const cible = cibles.reduce((a, b) => (b.atb < a.atb ? b : a));
          ajouter(cible, sort.atbAllie);
        }
      }
      if (sort.atbEnnemi) {
        const ennemis = etat.filter((m) => m.camp === adverse);
        // ⚠️ Cible d'un retrait de barre : celui qui est le PLUS AVANCÉ — c'est
        // lui qu'on cherche à retarder, et c'est ce qu'un joueur vise.
        const cibles = sort.atbEnnemiTous
          ? ennemis
          : ennemis.length
            ? [ennemis.reduce((a, b) => (b.atb > a.atb ? b : a))]
            : [];
        for (const m of cibles) ajouter(m, -sort.atbEnnemi);
      }
      if (sort.buffEquipe && sort.buffEquipe > buffCamp[camp]) buffCamp[camp] = sort.buffEquipe;
      if (sort.buffSoi && sort.buffSoi > (buffSoi[gagnant.id] ?? 0)) buffSoi[gagnant.id] = sort.buffSoi;
      if (sort.ralenti && sort.ralenti > ralentiCamp[adverse]) ralentiCamp[adverse] = sort.ralenti;
    };
    poser(gagnant.sort);

    // ⚠️ Tour SUPPLÉMENTAIRE : il rejoue AU MÊME TICK, sans qu'aucune horloge ne
    // tourne — les autres ne gagnent donc rien entre les deux. Son second tour
    // lance une AUTRE compétence, celle qu'on lui a désignée : rien par défaut,
    // on ne devine pas.
    if (gagnant.rejoue) {
      actions.push({ id: gagnant.id, camp: gagnant.camp, tick, ordre: actions.length + 1, rejoue: true });
      poser(gagnant.sort2);
      gagnant.atb = 0;
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
      effetAtb: m.effetAtb,
      effetSpeed: m.effetSpeed,
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

/* ------------------------------------------- Séquence imposée (analyse+) --- */

// Un combo un peu construit ne demande pas seulement « tout le monde avant
// l'adverse » : il demande un ORDRE PRÉCIS — celui qui remplit la barre part en
// premier, le nettoyeur de buffs ensuite, le gros dégât en dernier. Vérifier cet
// ordre est une question différente, avec une conséquence qui l'est aussi :
//
// ⚠️ **Ici, un monstre peut avoir besoin d'être RALENTI.** Tenir un rang, ce
// n'est pas seulement jouer assez tôt, c'est aussi jouer assez tard — d'où des
// FENÊTRES de vitesse (un minimum ET un maximum), là où l'analyse simple ne
// cherchait qu'un plancher.

export type RaisonOrdre = 'nagit-pas' | 'apres-adverse' | 'trop-tot' | 'trop-tard';

export interface ProblemeOrdre {
  id: string;
  raison: RaisonOrdre;
  tick: number | null;
  // Rang réellement obtenu (1 = premier des alliés listés), `null` s'il n'agit pas.
  rang: number | null;
}

export interface DiagnosticSequence {
  coupeur: Action | null;
  problemes: ProblemeOrdre[];
  ok: boolean;
}

// `ordre` : les identifiants alliés, du premier au dernier tour VOULU. Les
// alliés absents de la liste ne sont pas contraints entre eux (ils restent
// soumis à « avant l'adverse » par `diagnostiquerChaine`).
//
// ⚠️ **La contrainte se juge PAR VOISIN, jamais sur un rang global.** Une
// première version comparait le rang obtenu au rang voulu : quand plusieurs
// monstres sont déplacés, ce rang peut retomber juste par accident — un monstre
// « à sa place » qui joue pourtant avant celui qu'il doit suivre. Le test
// différentiel des fenêtres l'a attrapé (les deux critères ne décrivaient pas la
// même chose). Ce qui compte est local : je joue APRÈS mon prédécesseur et
// AVANT mon successeur.
export function diagnostiquerSequence(
  monstres: TuneMonstre[],
  ordre: string[],
  horizon = HORIZON_TICKS
): DiagnosticSequence {
  const premiers = premiersTours(simuler(monstres, horizon));
  const coupeur = premiers.find((a) => a.camp === 'ennemi') ?? null;
  const tickDe = new Map(premiers.map((a) => [a.id, a.tick]));

  // Rang RÉELLEMENT obtenu parmi les alliés listés — pour l'affichage (« il joue
  // 3ᵉ alors que tu le veux 2ᵉ »), pas pour le verdict.
  const reel = ordre.filter((id) => tickDe.has(id)).sort((a, b) => tickDe.get(a)! - tickDe.get(b)!);
  const rangDe = new Map(reel.map((id, i) => [id, i + 1]));

  const problemes: ProblemeOrdre[] = [];
  ordre.forEach((id, i) => {
    const tick = tickDe.get(id) ?? null;
    const rang = rangDe.get(id) ?? null;
    if (tick == null) {
      problemes.push({ id, raison: 'nagit-pas', tick: null, rang: null });
      return;
    }
    // Passer après l'adverse prime : l'ordre interne ne sert plus à rien.
    if (coupeur && tick > coupeur.tick) {
      problemes.push({ id, raison: 'apres-adverse', tick, rang });
      return;
    }
    const avant = tickDe.get(ordre[i - 1] ?? '') ?? null;
    const apres = tickDe.get(ordre[i + 1] ?? '') ?? null;
    if (avant != null && tick < avant) problemes.push({ id, raison: 'trop-tot', tick, rang });
    else if (apres != null && tick > apres) problemes.push({ id, raison: 'trop-tard', tick, rang });
  });

  return { coupeur, problemes, ok: problemes.length === 0 };
}

// La FENÊTRE de vitesse de combat d'un allié : le minimum pour ne pas jouer trop
// tard (après son successeur ou après l'adverse) et le maximum pour ne pas jouer
// trop tôt (avant son prédécesseur).
export interface Fenetre {
  id: string;
  combatActuel: number;
  // `null` = aucune borne de ce côté (rien à respecter, ou hors de portée).
  min: number | null;
  max: number | null;
  // Sa vitesse actuelle tient-elle ses contraintes ?
  ok: boolean;
}

// ⚠️ **Une fenêtre se lit « toutes choses égales par ailleurs »** : elle est
// calculée avec les AUTRES à leur vitesse du moment. C'est le contraire de
// `vitessesRequises`, qui empile ses corrections — et c'est voulu : un ordre se
// règle un monstre à la fois, en regardant ce que ça laisse aux autres.
//
// Les deux bornes se cherchent par dichotomie sur des prédicats MONOTONES DE
// SENS OPPOSÉS : « joue avant son successeur / avant l'adverse » se gagne en
// accélérant, « joue après son prédécesseur » se perd en accélérant. Vérifié par
// test différentiel contre un balayage exhaustif, qui contrôle en plus que
// l'ensemble des vitesses valides est bien un INTERVALLE (tests/speed-tune.test.ts).
export function fenetresRequises(
  monstres: TuneMonstre[],
  ordre: string[],
  horizon = HORIZON_TICKS
): Fenetre[] {
  const out: Fenetre[] = [];

  for (const id of ordre) {
    const original = monstres.find((m) => m.id === id);
    if (!original) continue;
    const depart = original.combat;

    // Copie de travail : on ne bouge QUE lui.
    const essai = monstres.map((m) => ({ ...m }));
    const moi = essai.find((m) => m.id === id)!;
    const avant = ordre[ordre.indexOf(id) - 1] ?? null;
    const apres = ordre[ordre.indexOf(id) + 1] ?? null;

    const positions = (v: number) => {
      moi.combat = v;
      const premiers = premiersTours(simuler(essai, horizon));
      const t = (x: string | null) => (x == null ? null : (premiers.find((a) => a.id === x)?.tick ?? null));
      return {
        moi: t(id),
        avant: t(avant),
        apres: t(apres),
        adverse: premiers.find((a) => a.camp === 'ennemi')?.tick ?? null,
      };
    };

    // Côté HAUT : assez rapide pour passer avant son successeur et avant l'adverse.
    const assezRapide = (v: number) => {
      const p = positions(v);
      if (p.moi == null) return false;
      if (p.adverse != null && p.moi > p.adverse) return false;
      if (p.apres != null && p.moi > p.apres) return false;
      return true;
    };
    // Côté BAS : assez lent pour rester après son prédécesseur. ⚠️ Un
    // prédécesseur qui n'agit pas ne contraint personne — c'est LUI qui sera
    // signalé (`nagit-pas`), pas son successeur.
    const assezLent = (v: number) => {
      const p = positions(v);
      if (p.moi == null || p.avant == null) return true;
      return p.moi > p.avant;
    };

    let min: number | null = null;
    if (assezRapide(1)) min = 1;
    else if (assezRapide(COMBAT_MAX)) {
      let bas = 2;
      let haut = COMBAT_MAX;
      while (bas < haut) {
        const milieu = Math.floor((bas + haut) / 2);
        if (assezRapide(milieu)) haut = milieu;
        else bas = milieu + 1;
      }
      min = bas;
    }

    let max: number | null = null;
    if (assezLent(COMBAT_MAX)) max = COMBAT_MAX;
    else if (assezLent(1)) {
      let bas = 1;
      let haut = COMBAT_MAX - 1;
      while (bas < haut) {
        const milieu = Math.ceil((bas + haut) / 2);
        if (assezLent(milieu)) bas = milieu;
        else haut = milieu - 1;
      }
      max = bas;
    }

    moi.combat = depart;
    const ok = assezRapide(depart) && assezLent(depart);
    moi.combat = depart;
    out.push({ id, combatActuel: depart, min, max, ok });
  }

  return out;
}
