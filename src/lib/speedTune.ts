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
//   - atbMod[t]   : modification de la barre au tick t (+% pour remplir, −% pour
//                   vider). La barre ne descend jamais sous 0.
//   - speedMod[t] : buff/ralenti de VITESSE au tick t.
//
// ⚠️ **Ce sont des REMPLACEMENTS, pas des ajouts.** Une valeur posée dans une
// case REMPLACE ce que les compétences y mettent pour ce monstre et ce tick —
// **0 ANNULE** l'effet du sort. Sans ça, on ne pouvait qu'ajouter par-dessus :
// impossible d'écarter une réduction d'ATB à 70 % de chances, alors qu'un tune
// solide ne doit justement pas en dépendre. Une case VIDE laisse la compétence
// faire (et la grille montre en repère ce qu'elle y met).
//
// ⚠️ **Pas de report d'un tick sur l'autre** pour ce qui est saisi : les ticks
// non marqués retombent sur ce que les compétences donnent, sinon sur la vitesse
// de base. Un buff saisi qui dure plusieurs ticks se marque sur chacun d'eux.
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
  // ⚠️ **L'allié VISÉ**, quand on le désigne. Certains sorts laissent le joueur
  // choisir sa cible (« increases the Attack Bar of the target ally », le S3 de
  // Sapsaree) : la barre la plus basse est un défaut raisonnable, pas une règle
  // du jeu. `undefined` = on retombe sur ce défaut.
  //
  // ⚠️ **Le lanceur est une cible comme une autre.** Le jeu autorise à se viser
  // soi-même avec un sort « sur un allié », et c'est même l'usage recherché
  // quand le sort porte un buff de vitesse (Rabbit's Agility de Racuni / Harg).
  cibleAllie?: string;
  atbSoi?: number; // lui seul
  atbEnnemi?: number; // RETIRÉ à l'adverse (valeur positive = retrait)
  atbEnnemiTous?: boolean; // le retrait touche tout le camp adverse
  // Vitesse, en % (le jeu : +30 en buff, −30 en ralenti).
  buffEquipe?: number;
  buffSoi?: number;
  // ⚠️ **Le buff de vitesse posé sur l'allié VISÉ** — la même cible que
  // `atbAllie`, parce que c'est le même sort. Rabbit's Agility remplit une barre
  // ET donne +30 % de vitesse : n'en garder que la barre plaçait bien le tour
  // suivant de la cible, et tous les autres trop tard.
  buffAllie?: number;
  ralenti?: number; // posé sur l'adverse
  ralentiTous?: boolean;
  // ⚠️ **RECHARGEMENT**, en tours du lanceur (0 = aucun). Un sort à 3 tours de
  // rechargement lancé au 1ᵉʳ tour ne repart qu'au 4ᵉ : entre les deux, le
  // monstre joue autre chose (son S1, dont on ne sait rien — donc rien du tout).
  // Sans ça, la simulation relançait le S3 à CHAQUE tour et l'équipe montait
  // bien plus vite qu'en jeu.
  cooldown?: number;
  // ⚠️ **L'IDENTITÉ du sort, pour son horloge de rechargement.** Le moteur
  // comptait le rechargement par TOUR (`id#1`), ce qui allait tant qu'un monstre
  // relançait toujours le même sort. Dès qu'un combo lui en fait lancer DEUX
  // (S2 puis S1), les deux partageaient la même horloge : le second héritait du
  // rechargement du premier. Deux sorts distincts ont deux clés distinctes ; le
  // même sort relancé à deux tours garde la sienne. Absent = comportement
  // d'avant (une horloge par tour).
  cle?: string;
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
  // ⚠️ **Ce qu'il lance à son Nᵉ tour** (index 0 = son 1ᵉʳ tour), quand un combo
  // le fait jouer plusieurs fois dans la fenêtre : Racuni se vise lui-même au S2
  // (barre pleine → il rejoue au tick suivant) puis enchaîne son S1. Sans ça, le
  // moteur relançait le MÊME sort à chaque tour — donc rien du tout dès que le
  // rechargement l'en empêchait, et le combo était invisible.
  //
  // ⚠️ Une case vide (`undefined`) ou un tour au-delà de la liste retombent sur
  // `sort` : le défaut reste « il relance ce qu'il lance ».
  // ⚠️ À ne pas confondre avec `sort2`, qui est le tour SUPPLÉMENTAIRE pris au
  // MÊME tick (`rejoue`) — celui-là ne fait pas avancer le compteur de tours.
  sortsParTour?: (EffetSort | undefined)[];
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
// Le même sort, PRIVÉ de ce qu'il fait subir à l'adverse (retrait de barre,
// ralenti).
//
// ⚠️ **Un speed tune, c'est ce qui tient quand on n'a rien retiré à l'autre.**
// Compter le −30 % de barre d'une Madeleine Cookie revient à déclarer une
// équipe tunée parce qu'elle aura freiné l'adverse : le jour où le retrait
// rate, se voit résisté, ou tombe sur un monstre déjà passé, l'équipe se coupe.
// Les monstres doivent jouer les uns après les autres SANS ça — donc la
// simulation du tune ne voit jamais ces effets, et les grilles n'en montrent
// aucune trace (ce qui est affiché est exactement ce qui est calculé).
//
// Ce que l'utilisateur pose LUI-MÊME dans une case de grille reste intact :
// c'est une saisie, pas une déduction.
export function sansReductionAdverse(e: EffetSort): EffetSort {
  const copie = { ...e };
  delete copie.atbEnnemi;
  delete copie.atbEnnemiTous;
  delete copie.ralenti;
  delete copie.ralentiTous;
  return copie;
}

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
  // ⚠️ **Un buff INDIVIDUEL, quelle qu'en soit la source** : posé sur soi
  // (`buffSoi`) ou reçu d'un allié qui vous vise (`buffAllie`). Les deux
  // aboutissent au même endroit — c'est le monstre buffé qui compte, pas qui
  // l'a buffé.
  const buffIndiv: Record<string, number> = {};
  // Rechargement : combien de tours ce monstre a joués, et à quel tour chacun de
  // ses deux sorts a été lancé pour la dernière fois.
  const tours: Record<string, number> = {};
  const dernier: Record<string, number> = {};

  for (let tick = 1; tick <= horizon; tick++) {
    for (const m of etat) {
      // Ce que les COMPÉTENCES donnent à ce monstre ce tick-ci : le plus fort
      // buff d'un côté, le plus fort ralenti de l'autre (ils ne s'empilent pas),
      // les deux se compensant.
      const parSort = Math.max(buffCamp[m.camp], buffIndiv[m.id] ?? 0) - ralentiCamp[m.camp];
      // ⚠️ La saisie de la grille REMPLACE cette part (0 = on annule le sort).
      const saisi = m.speedMod?.[tick];
      const buffBase = saisi ?? parSort;
      if (buffBase !== 0) m.effetSpeed[tick] = buffBase;
      // Un buff (> 0) est amplifié par le bonus d'artéfact, additivement ; un
      // ralenti (< 0) n'est pas concerné.
      // ⚠️ **La valeur du buff est un ENTIER de pourcentage.** Le jeu affiche
      // « +30 % », « +33 % » — pas 32,7 %. Un artéfact de 9 % donne
      // 30 × 1,09 = 32,7 → **32 %**, tronqué, quand 10 % donne 33 % tout rond :
      // c'est exactement ce qui a été mesuré en jeu (9 ne passait pas, 10 oui)
      // alors que le calcul décimal disait que 9 suffisait. On TRONQUE (et non
      // arrondit) : arrondir donnerait 33 % à 9 d'artéfact, ce que le jeu
      // dément.
      const buff =
        buffBase > 0 ? Math.floor(buffBase * (1 + (m.artefactBuff ?? 0) / 100)) : buffBase;
      m.atb += atbParTick((m.combat * (100 + buff)) / 100);
      if (m.atb < 0) m.atb = 0;
      // On enregistre AVANT la remise à zéro : la case du tour montre la barre
      // pleine (≥ 100) qui a déclenché l'action.
      m.traj.push(m.atb);
    }
    // ⚠️ La barre saisie dans la grille est posée AVANT l'arbitrage du tick :
    // c'est elle qui décide qui a la barre pleine, comme un sort lancé au tick
    // précédent l'aurait fait.
    for (const m of etat) {
      const saisi = m.atbMod?.[tick];
      if (saisi === undefined || saisi === 0) continue;
      m.atb += saisi;
      if (m.atb < 0) m.atb = 0;
      m.effetAtb[tick] = saisi;
      m.traj[m.traj.length - 1] = m.atb;
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
      // ⚠️ Une case SAISIE pour ce monstre et ce tick a le dernier mot : le sort
      // ne s'y ajoute pas (0 saisi = sort annulé, cas d'un effet aléatoire dont
      // on ne veut pas dépendre).
      if (m.atbMod?.[tick] !== undefined) return;
      m.atb += v;
      if (m.atb < 0) m.atb = 0;
      m.effetAtb[tick] = (m.effetAtb[tick] ?? 0) + v;
      majTraj(m);
    };
    // Le sort est-il disponible ? Un rechargement se compte en TOURS DU
    // LANCEUR : lancé à son tour n, un sort à 3 tours revient à son tour n+3.
    const disponible = (sort: EffetSort | undefined, cle: string): boolean => {
      const cd = sort?.cooldown ?? 0;
      if (cd <= 0) return true;
      const precedent = dernier[cle];
      return precedent === undefined || tours[gagnant.id] - precedent >= cd;
    };
    const poser = (sort: EffetSort | undefined, cleParDefaut?: string) => {
      if (!sort) return;
      // L'horloge du SORT quand il se nomme, celle du TOUR sinon.
      const cle = sort.cle ? `${gagnant.id}@${sort.cle}` : cleParDefaut;
      if (cle) {
        if (!disponible(sort, cle)) return;
        dernier[cle] = tours[gagnant.id];
      }
      const camp = gagnant.camp;
      const adverse: Camp = camp === 'allie' ? 'ennemi' : 'allie';
      if (sort.atbEquipe) for (const m of etat) if (m.camp === camp) ajouter(m, sort.atbEquipe);
      if (sort.atbSoi) ajouter(gagnant, sort.atbSoi);
      // La cible d'un sort « sur un allié », résolue UNE FOIS : la barre et le
      // buff de vitesse partent du même sort, donc sur le même monstre. Les
      // résoudre séparément aurait permis de remplir la barre de l'un et de
      // buffer l'autre.
      const cibleAlliee = (() => {
        if (!sort.atbAllie && !sort.buffAllie) return null;
        // ⚠️ **Une cible DÉSIGNÉE l'emporte, le lanceur COMPRIS.** C'est le
        // joueur qui vise, en jeu, et le jeu l'autorise à se viser lui-même.
        if (sort.cibleAllie) {
          const visee = etat.find((m) => m.camp === camp && m.id === sort.cibleAllie);
          if (visee) return visee;
        }
        // ⚠️ **Mais le lanceur est EXCLU du choix PAR DÉFAUT** : sa barre vient
        // de retomber à 0, il serait systématiquement « celui qui l'a la plus
        // basse » et se rendrait à lui-même un boost dont personne ne compte.
        // Se viser soi-même doit être un geste, jamais le défaut.
        const cibles = etat.filter((m) => m.camp === camp && m !== gagnant);
        return cibles.length > 0 ? cibles.reduce((a, b) => (b.atb < a.atb ? b : a)) : null;
      })();
      if (sort.atbAllie && cibleAlliee) ajouter(cibleAlliee, sort.atbAllie);
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
      if (sort.buffSoi && sort.buffSoi > (buffIndiv[gagnant.id] ?? 0)) buffIndiv[gagnant.id] = sort.buffSoi;
      if (sort.buffAllie && cibleAlliee && sort.buffAllie > (buffIndiv[cibleAlliee.id] ?? 0))
        buffIndiv[cibleAlliee.id] = sort.buffAllie;
      if (sort.ralenti && sort.ralenti > ralentiCamp[adverse]) ralentiCamp[adverse] = sort.ralenti;
    };
    tours[gagnant.id] = (tours[gagnant.id] ?? 0) + 1;
    // Le sort de CE tour-ci : celui qu'on a désigné pour son Nᵉ tour, sinon son
    // sort par défaut. ⚠️ Le compteur vient d'être incrémenté, donc le 1ᵉʳ tour
    // est l'index 0.
    const sortDuTour = gagnant.sortsParTour?.[tours[gagnant.id] - 1] ?? gagnant.sort;
    poser(sortDuTour, `${gagnant.id}#1`);

    // ⚠️ Tour SUPPLÉMENTAIRE : il rejoue AU MÊME TICK, sans qu'aucune horloge ne
    // tourne — les autres ne gagnent donc rien entre les deux. Son second tour
    // lance une AUTRE compétence, celle qu'on lui a désignée : rien par défaut,
    // on ne devine pas.
    if (gagnant.rejoue) {
      actions.push({ id: gagnant.id, camp: gagnant.camp, tick, ordre: actions.length + 1, rejoue: true });
      poser(gagnant.sort2, `${gagnant.id}#2`);
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

// L'ordre dans lequel les monstres VONT JOUER : id → tick de leur premier tour.
// Ceux qui n'agissent pas dans l'horizon n'y figurent pas.
//
// ⚠️ **Tout ce qui énumère des monstres s'y range.** Une liste de problèmes
// donnée dans l'ordre des slots oblige à reconstruire mentalement la chronologie
// pour comprendre qui coupe qui — alors que c'est précisément la question. Dans
// l'ordre de jeu, on lit la chaîne comme elle se déroule.
export function ordreDeJeu(monstres: TuneMonstre[], horizon = HORIZON_TICKS): Map<string, number> {
  return new Map(premiersTours(simuler(monstres, horizon)).map((a) => [a.id, a.tick]));
}

// Trie une liste de monstres par ordre de jeu. Celui qui n'agit pas passe en
// DERNIER : il ne s'insère nulle part dans la chronologie, et le mettre en tête
// (tick « 0 » implicite) le ferait passer pour le plus rapide.
function rangerParJeu<T extends { id: string }>(liste: T[], ordre: Map<string, number>): T[] {
  return [...liste].sort(
    (a, b) => (ordre.get(a.id) ?? Infinity) - (ordre.get(b.id) ?? Infinity)
  );
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
  // Dans l'ordre où ils jouent, pas dans celui des slots : c'est la chronologie
  // qu'on lit quand on cherche ce qui coupe le combo.
  const ordre = new Map(premiers.map((a) => [a.id, a.tick]));
  return { coupeur, coupes: rangerParJeu(coupes, ordre), ok: coupes.length === 0 };
}

// Ce qu'il faut trouver, allié par allié, pour que TOUTE l'équipe joue avant le
// premier adverse. C'est le VÉRIFICATEUR RETOURNÉ : même critère que
// `diagnostiquerChaine` — la chaîne tient — mais on cherche les vitesses au lieu
// de les juger.
//
// ⚠️ **C'est un RÉGLAGE D'ÉQUIPE, pas une somme de corrections individuelles.**
// Un seul monstre agit par tick : occuper les ticks de tête REPOUSSE l'adverse
// et libère de la place pour les suivants. Mais le tick gagné ne se paie pas au
// même prix des deux côtés — l'adverse rapide encaisse ~25 d'ATB par tick et
// **garde son dépassement** au-dessus de 100, quand le dernier de l'équipe, lent,
// n'en encaisse ~7. Retarder l'adverse ne suffit donc pas : il faut monter TOUTE
// l'équipe jusqu'au point où le dernier convertit réellement les ticks gagnés.
//
// ⚠️ **L'ORDRE DE JEU DES ALLIÉS EST CONSERVÉ.** Celui qui remplit la barre doit
// rester devant ceux qu'il pousse : s'ils le doublent, ils jouent AVANT le boost
// et le combo tombe. La recherche ne propose donc jamais une vitesse qui ferait
// doubler un allié — l'ordre de départ est une contrainte, au même titre que
// « passer avant l'adverse ». Changer d'ordre relève de l'analyse poussée
// (`fenetresRequises`), pas d'ici.
//
// Méthode, en deux temps :
//   1. **Candidat tassé** — chaque allié monté au plus haut que son rang permet
//      (le 1er au tick 1, le 2e au tick 2..., via `speedForTick`, sans jamais
//      doubler celui d'avant). C'est le maximum atteignable à ordre constant :
//      ce qui reste coupé là est vraiment hors de portée.
//   2. **Redescente** — chaque allié ramené par dichotomie à la plus petite
//      valeur qui PRÉSERVE le résultat du candidat tassé, du dernier au premier.
//      Sans ça on afficherait « 1429 » là où 715 suffit.
//
// Le prédicat de chaque redescente est monotone (plus vite = barre plus haute à
// chaque tick = tour plus tôt), ce qui rend la dichotomie valide ; c'est vérifié
// par test différentiel (tests/speed-tune.test.ts) contre une référence qui
// n'emprunte NI la stratégie NI la recherche du code testé — balayage exhaustif
// des affectations allié -> tick à ordre constant.

// Un allié coupé et la vitesse de combat qui le ferait passer avant le coupeur.
export interface VitesseRequise {
  id: string;
  combatActuel: number;
  // `null` = même l'équipe entière tassée au maximum le laisse coupé (l'adverse
  // accumule plus vite que lui : les ticks gagnés ne se convertissent pas).
  combatRequis: number | null;
}

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

// Nombre maximal de passes de redescente (voir `resoudre`) : baisser un allié
// peut rendre du mou à un autre, on repasse tant que ça baisse.
const DESCENTES_MAX = 4;

// ⚠️ **LA VITESSE DU PREMIER DE L'ÉQUIPE EST INTOUCHABLE.** Celui qui ouvre le
// combo porte déjà le meilleur Swift du compte : lui demander des points de
// vitesse, c'est proposer ce que le joueur ne peut pas faire. Aucun candidat ne
// le monte — même quand c'est la seule issue : le verdict est alors « hors de
// portée », ce qui est la vérité pour le joueur.
//
// ⚠️ La contrainte ne vaut QUE sur l'axe vitesse. Un artéfact se change ; le
// meilleur Swift du compte, non.

// L'ordre de jeu des ALLIÉS, du premier au dernier. Celui qui n'agit pas dans
// l'horizon ferme la marche (il ne s'insère nulle part).
function ordreAllies(monstres: TuneMonstre[], horizon: number): string[] {
  const premiers = premiersTours(simuler(monstres, horizon));
  const tick = new Map(premiers.map((a) => [a.id, a.tick] as const));
  return monstres
    .filter((m) => m.camp === 'allie')
    .map((m, placement) => ({ id: m.id, t: tick.get(m.id) ?? Infinity, placement }))
    .sort((a, b) => a.t - b.t || a.placement - b.placement)
    .map((x) => x.id);
}

// Les alliés qui jouent avant le premier adverse, dans l'état donné.
function passants(monstres: TuneMonstre[], horizon: number): Set<string> {
  const premiers = premiersTours(simuler(monstres, horizon));
  const adverse = premiers.find((a) => a.camp === 'ennemi');
  const out = new Set<string>();
  for (const a of premiers) {
    if (a.camp !== 'allie') continue;
    if (!adverse || a.tick < adverse.tick) out.add(a.id);
  }
  return out;
}

// Cœur commun aux deux solveurs. Voir le commentaire au-dessus pour la méthode :
// seul l'axe cherché change.
//
// ⚠️ Sur l'axe `artefactBuff`, un allié qui ne reçoit AUCUN buff de vitesse est
// insensible au levier (l'artéfact n'amplifie que le buff) : le tasser ne change
// rien et il ressort `null` — c'est le comportement attendu, il n'y a rien à
// proposer de ce côté-là.
function resoudre(monstres: TuneMonstre[], horizon: number, axe: Axe): Resolution[] {
  const valeur = (m: TuneMonstre): number => (axe === 'combat' ? m.combat : (m.artefactBuff ?? 0));
  const poser = (m: TuneMonstre, v: number) => {
    if (axe === 'combat') m.combat = v;
    else m.artefactBuff = v;
  };

  const initial = diagnostiquerChaine(monstres, horizon);
  if (initial.ok || !initial.coupeur) return [];

  const ordre = ordreAllies(monstres, horizon);
  const courant = monstres.map((m) => ({ ...m }));
  const parId = new Map(courant.map((m) => [m.id, m]));
  const source = new Map(monstres.map((m) => [m.id, valeur(m)] as const));

  // ⚠️ **UNE SEULE simulation par essai.** Ordre de jeu, alliés qui passent et
  // verdict se lisent tous les trois dans les mêmes premiers tours : les
  // recalculer séparément triplait le coût d'une recherche déjà appelée à chaque
  // frappe.
  interface Etat {
    ordreTenu: boolean;
    passent: Set<string>;
    tick: Map<string, number>;
    ok: boolean;
  }
  const etat = (): Etat => {
    const premiers = premiersTours(simuler(courant, horizon));
    const tick = new Map(premiers.map((a) => [a.id, a.tick] as const));
    const adverse = premiers.find((a) => a.camp === 'ennemi');
    const passent = new Set<string>();
    for (const a of premiers) {
      if (a.camp === 'allie' && (!adverse || a.tick < adverse.tick)) passent.add(a.id);
    }
    // ⚠️ **Seul le PREMIER est protégé, pas tout l'ordre.** Ce qui casse un combo,
    // c'est de doubler celui qui ouvre : les boostés joueraient AVANT le boost.
    // Entre les suivants, l'ordre est libre — un seul monstre joue par tick, il
    // suffit que chacun se case entre le premier et l'adverse. Protéger tout
    // l'ordre refusait des réglages que la méthode à la main trouve.
    const tPremier = tick.get(ordre[0]) ?? Infinity;
    const premierTenu = ordre
      .slice(1)
      .every((id) => (tick.get(id) ?? Infinity) > tPremier);
    return {
      ordreTenu: premierTenu,
      passent,
      tick,
      ok: passent.size === ordre.length,
    };
  };
  // Le tune tient-il ? C'est le VÉRIFICATEUR, appelé ici à l'envers : on cherche
  // les valeurs qui le satisfont.
  const tuneTient = () => {
    const e = etat();
    return e.ok && e.ordreTenu;
  };

  // 1. CANDIDAT. ⚠️ **On place les alliés, on n'énumère pas des ticks.** Les
  //    monstres FONT LA QUEUE : deux barres pleines au même tick jouent l'une
  //    après l'autre (la plus haute d'abord). Un allié peut donc jouer au tick 7
  //    en étant prêt au 6 — c'est même le cas courant juste derrière celui qui
  //    ouvre. Raisonner « un allié par palier de tick » manquait ces
  //    placements-là et déclarait « hors de portée » des équipes réglables.
  //
  //    Chaque allié retenu est poussé AU PLUS TÔT : la plus grande vitesse qui
  //    ne lui fait pas doubler celui qui joue devant lui. C'est ce qui achète un
  //    tick à ceux de derrière — le dernier de l'équipe est celui qui décide.
  //
  //    ⚠️ On essaie les SOUS-ENSEMBLES d'alliés à pousser, du plus petit au plus
  //    grand, parce que **pousser quelqu'un peut NUIRE** : avancer un monstre
  //    libère le tick où il barrait la route à l'adverse.
  const auPlusTot = (m: TuneMonstre) => {
    const min = source.get(m.id) ?? valeur(m);
    let a = min;
    let b = PLAFOND[axe];
    while (a < b) {
      const mi = Math.ceil((a + b) / 2);
      poser(m, mi);
      if (etat().ordreTenu) a = mi;
      else b = mi - 1;
    }
    poser(m, a);
  };
  const remettre = () => {
    for (const [id, v] of source) {
      const m = parId.get(id);
      if (m) poser(m, v);
    }
  };
  // ⚠️ **Le premier n'est jamais du lot** (indice 0) : il porte le meilleur Swift
  // du compte, on ne peut rien lui trouver de plus.
  const poussables = ordre.slice(1);
  const sousEnsembles: number[][] = [];
  for (let masque = 0; masque < 1 << poussables.length; masque++) {
    const sous: number[] = [];
    for (let i = 0; i < poussables.length; i++) if ((masque >> i) & 1) sous.push(i + 1);
    sousEnsembles.push(sous);
  }
  // ⚠️ **Du PLUS GRAND au plus petit** : la méthode à la main pousse TOUT le
  // monde devant, puis redescend — et c'est ce qui donne le réglage le moins
  // cher, parce que la redescente rend ensuite à chacun ce dont il n'a pas
  // besoin. Commencer par les petits sous-ensembles faisait retenir la première
  // solution TROUVÉE, pas la moins chère : 136 points là où la main en demandait
  // 85. Les petits restent essayés ensuite, pour le cas où pousser NUIT.
  sousEnsembles.sort((a, b) => b.length - a.length);

  let meilleur: number[] = [];
  let mieux = -1;
  for (const sous of sousEnsembles) {
    remettre();
    // Dans l'ordre de jeu : chacun se place derrière celui déjà posé.
    for (const i of sous) {
      const m = parId.get(ordre[i]);
      if (m) auPlusTot(m);
    }
    const e = etat();
    if (!e.ordreTenu) continue;
    if (e.ok) {
      meilleur = sous;
      mieux = ordre.length;
      break;
    }
    if (e.passent.size > mieux) {
      mieux = e.passent.size;
      meilleur = sous;
    }
  }
  remettre();
  for (const i of meilleur) {
    const m = parId.get(ordre[i]);
    if (m) auPlusTot(m);
  }

  // Ce que ce candidat atteint : au-delà, personne ne passera de plus.
  const cible = etat().passent;
  const tenu = (e: Etat = etat()) => {
    if (!e.ordreTenu) return false;
    for (const id of cible) if (!e.passent.has(id)) return false;
    return true;
  };

  // 2. REDESCENTE, du DERNIER au premier : le dernier est contraint par
  //    l'adverse, ceux de devant ne servent qu'à lui acheter des ticks — c'est
  //    donc à eux qu'il reste le plus à rendre une fois lui posé.
  //
  // ⚠️ **Balayage ascendant, pas dichotomie.** Le domaine des valeurs valides
  // d'un allié n'est pas un intervalle (voir plus haut) : une dichotomie
  // s'arrête au bord de la mauvaise fenêtre et surévalue la vitesse annoncée.
  // On prend la PREMIÈRE valeur qui tient en partant de la vitesse actuelle —
  // donc le vrai minimum.
  //
  // ⚠️ **Par PALIERS DE TICK, pas point par point.** Entre deux valeurs qui
  // laissent l'allié au même tick, seul son dépassement d'ATB change (il ne
  // départage que les égalités) : essayer les 1 200 points un par un coûtait
  // ~90 ms par frappe. On essaie donc le BAS de chaque palier — la plus petite
  // valeur qui l'amène à ce tick, trouvée par dichotomie sur SON tick, qui lui
  // est bien monotone — et le HAUT du palier, qui est le cas où il gagne une
  // égalité. Le vrai minimum est toujours l'un des deux.
  const sonTick = (id: string, e: Etat = etat()) => e.tick.get(id) ?? Infinity;
  for (let tour = 0; tour < DESCENTES_MAX; tour++) {
    let baisse = false;
    for (let i = ordre.length - 1; i >= 0; i--) {
      const id = ordre[i];
      const m = parId.get(id);
      if (!m) continue;
      const haut = valeur(m);
      const bas = source.get(id) ?? haut;
      if (bas >= haut) continue;

      // La plus petite valeur de [lo, haut] qui amène l'allié au tick `cibleT`
      // ou avant (son propre tick est monotone en sa propre valeur).
      const seuil = (cibleT: number, lo: number): number => {
        let a = lo;
        let b = haut;
        while (a < b) {
          const mi = Math.floor((a + b) / 2);
          poser(m, mi);
          if (sonTick(id) <= cibleT) b = mi;
          else a = mi + 1;
        }
        return a;
      };

      let v = bas;
      let trouve = haut;
      while (v <= haut) {
        poser(m, v);
        const e = etat();
        if (tenu(e)) {
          trouve = v;
          break;
        }
        const t = sonTick(id, e);
        // Début du palier suivant : la plus petite valeur qui le fait jouer plus
        // tôt. Au-dessus de tout palier utile, il n'y a plus rien à essayer.
        const suivant = t === Infinity ? seuil(horizon, v + 1) : seuil(t - 1, v + 1);
        if (suivant > haut) break;
        // Le HAUT du palier courant : même tick, dépassement d'ATB maximal. S'il
        // tient alors que le bas ne tenait pas, c'est qu'une ÉGALITÉ bascule
        // quelque part dans le palier — le dépassement départage les barres
        // pleines. On va chercher ce point par dichotomie : à tick constant,
        // monter ne peut que lui faire gagner des égalités, jamais en perdre.
        if (suivant - 1 > v) {
          poser(m, suivant - 1);
          if (tenu()) {
            let a = v + 1;
            let b = suivant - 1;
            while (a < b) {
              const mi = Math.floor((a + b) / 2);
              poser(m, mi);
              if (tenu()) b = mi;
              else a = mi + 1;
            }
            trouve = a;
            break;
          }
        }
        v = suivant;
      }
      poser(m, trouve);
      if (trouve < haut) baisse = true;
    }
    if (!baisse) break;
  }

  // Verdict : ce qui reste coupé au maximum atteignable est hors de portée, le
  // reste porte la valeur retenue. ⚠️ Rendu dans l'ORDRE DE JEU de DÉPART — on
  // lit ce qui manque à une équipe telle qu'elle est aujourd'hui.
  const out: Resolution[] = [];
  for (const m of monstres) {
    if (m.camp !== 'allie') continue;
    const dep = valeur(m);
    if (!cible.has(m.id)) out.push({ id: m.id, actuel: dep, requis: null });
    else {
      const trouve = valeur(parId.get(m.id) ?? m);
      if (trouve > dep) out.push({ id: m.id, actuel: dep, requis: trouve });
    }
  }
  return rangerParJeu(out, ordreDeJeu(monstres, horizon));
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
/* ------------------------------------------------------- Occurrences ---- */

// ⚠️ **Un monstre peut figurer PLUSIEURS FOIS dans l'ordre voulu.** Un combo le
// fait jouer deux fois avant l'adverse (Racuni se vise au S2, sa barre se
// remplit, il rejoue et enchaîne son S1) : l'ordre doit pouvoir le dire, sinon
// le combo n'est ni descriptible ni vérifiable.
//
// ⚠️ **La 1ᵉʳᵉ occurrence garde l'identifiant NU.** C'est ce qui rend la
// nouveauté invisible pour tout ce qui existait : un ordre déjà enregistré, une
// grille, un sort choisi — tous keyés sur l'uid — continuent de valoir sans
// migration. Seules les occurrences SUPPLÉMENTAIRES portent un suffixe.
// (`uid` vaut `allie:123` : le `#` n'y apparaît jamais.)
export function cleOccurrence(id: string, n: number): string {
  return n <= 1 ? id : `${id}#${n}`;
}

export function litOccurrence(cle: string): { id: string; n: number } {
  const i = cle.lastIndexOf('#');
  if (i < 0) return { id: cle, n: 1 };
  const n = Number(cle.slice(i + 1));
  return Number.isInteger(n) && n > 1 ? { id: cle.slice(0, i), n } : { id: cle, n: 1 };
}

// Le tick de chaque OCCURRENCE : `allie:12` → son 1ᵉʳ tour, `allie:12#2` → son
// 2ᵉ. ⚠️ Les tours pris au même tick par `rejoue` comptent : c'est bien un tour
// de plus, et le combo qu'on décrit passe souvent par lui.
export function ticksParOccurrence(sim: Simulation): Map<string, number> {
  const vus = new Map<string, number>();
  const out = new Map<string, number>();
  for (const a of sim.actions) {
    const n = (vus.get(a.id) ?? 0) + 1;
    vus.set(a.id, n);
    out.set(cleOccurrence(a.id, n), a.tick);
  }
  return out;
}

export function diagnostiquerSequence(
  monstres: TuneMonstre[],
  ordre: string[],
  horizon = HORIZON_TICKS
): DiagnosticSequence {
  const sim = simuler(monstres, horizon);
  const coupeur = sim.actions.find((a) => a.camp === 'ennemi') ?? null;
  // ⚠️ Par OCCURRENCE, pas par monstre : un id nu reste son 1ᵉʳ tour, donc un
  // ordre sans occurrence supplémentaire se lit exactement comme avant.
  const tickDe = ticksParOccurrence(sim);

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
  horizon = HORIZON_TICKS,
  // Sur quel levier chercher : la vitesse de combat, ou l'artéfact qui amplifie
  // le buff de vitesse reçu (voir `artefactsRequis`). Même méthode, même
  // garanties — seule la grandeur cherchée change.
  axe: 'combat' | 'artefactBuff' = 'combat'
): Fenetre[] {
  const out: Fenetre[] = [];
  const plafond = axe === 'combat' ? COMBAT_MAX : ARTE_MAX;

  for (const id of ordre) {
    const original = monstres.find((m) => m.id === id);
    if (!original) continue;
    const depart = axe === 'combat' ? original.combat : (original.artefactBuff ?? 0);

    // Copie de travail : on ne bouge QUE lui.
    const essai = monstres.map((m) => ({ ...m }));
    const moi = essai.find((m) => m.id === id)!;
    const poser = (v: number) => {
      if (axe === 'combat') moi.combat = v;
      else moi.artefactBuff = v;
    };
    const avant = ordre[ordre.indexOf(id) - 1] ?? null;
    const apres = ordre[ordre.indexOf(id) + 1] ?? null;

    const positions = (v: number) => {
      poser(v);
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
    if (assezRapide(0)) min = 0;
    else if (assezRapide(plafond)) {
      let bas = 1;
      let haut = plafond;
      while (bas < haut) {
        const milieu = Math.floor((bas + haut) / 2);
        if (assezRapide(milieu)) haut = milieu;
        else bas = milieu + 1;
      }
      min = bas;
    }

    let max: number | null = null;
    if (assezLent(plafond)) max = plafond;
    else if (assezLent(0)) {
      let bas = 0;
      let haut = plafond - 1;
      while (bas < haut) {
        const milieu = Math.ceil((bas + haut) / 2);
        if (assezLent(milieu)) bas = milieu;
        else haut = milieu - 1;
      }
      max = bas;
    }

    poser(depart);
    const ok = assezRapide(depart) && assezLent(depart);
    poser(depart);
    out.push({ id, combatActuel: depart, min, max, ok });
  }

  return out;
}
