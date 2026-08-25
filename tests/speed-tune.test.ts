// Speed tuning — règle des ticks, ordre « un seul monstre par tick », et
// simulation multi-tours (la barre repart de 0 après chaque tour). Fonctions
// pures de src/lib/speedTune.ts. La formule (combat × 7/100, action à 100) est
// simple, mais la règle « un par tick », les modificateurs et les remises à zéro
// se vérifient à la main.

import {
  speedForTick,
  simuler,
  premiersTours,
  atbParTick,
  diagnostiquerChaine,
  vitessesRequises,
  artefactsRequis,
  diagnostiquerSequence,
  fenetresRequises,
  COMBAT_MAX,
  ARTE_MAX,
  HORIZON_TICKS,
  TuneMonstre,
  ModParTick,
  Simulation,
  VitesseRequise,
  EffetSort,
  ArtefactRequis,
} from '../src/lib/speedTune';
import { deckPourSpeedTune } from '../src/lib/speedTuneDeck';
import { LeadInfo, leadsDeVitesse } from '../src/lib/speed';
import { kitVitesse, sortsVitesse, SortVitesse, BUFF_SPD_JEU } from '../src/lib/speedTuneKit';
import { passifsVitesse, pointsDeGain } from '../src/lib/speedTunePassif';
import {
  Ligne,
  ampliDe,
  appliquerMods,
  combatDe as combatDeLigne,
  deplacerDansCamp,
  estimerCumuls,
  leadPresent,
  ligneReference,
  ligneVierge,
  majMod,
  oublierCamp,
  plusRapideAllie,
  tuneDe,
} from '../src/lib/speedTuneLignes';
import {
  analyseAutomatique,
  combatAuto,
  cumulsEstimes,
  noterChoix,
  sortRetenu,
  sortSecondRetenu,
  AUTO,
  ChoixSorts,
  EntreeAuto,
  DonneesKit,
} from '../src/lib/speedTuneAuto';
import { DetailMonstre, Competence, EffetCompetence } from '../src/lib/monsterSkills';
import { Monster, SiegeTeam } from '../src/types';
import { combatSpeed } from '../src/lib/speed';
import { egal, ok, titre } from './outils';

export default function testSpeedTune() {
  titre('Speed tuning');

  // Règle des ticks : vitesse mini pour agir au tick n = ceil(10000/(7n)).
  egal(speedForTick(11), 130, 'tick 11 → 130');
  egal(speedForTick(6), 239, 'tick 6 → 239 (Lent)');
  egal(speedForTick(5), 286, 'tick 5 → 286 (Rapide)');
  egal(speedForTick(3), 477, 'tick 3 → 477');
  egal(atbParTick(129), 9.03, 'combat 129 → 9,03 % par tick');

  const camp = (combat: number, camp: 'allie' | 'ennemi' = 'allie'): TuneMonstre => ({
    id: `${combat}-${camp}`,
    combat,
    camp,
  });
  const trajDe = (sim: Simulation, id: string) => sim.lignes.find((l) => l.id === id)!.trajectoire;

  // Deux vitesses franches, sans collision : chacun agit à son propre tick.
  {
    const pt = premiersTours(simuler([camp(200), camp(100)]));
    egal(pt.length, 2, 'deux monstres → deux premiers tours');
    egal(pt[0].id, '200-allie', 'le plus rapide joue en premier');
    egal(pt[0].tick, 8, 'combat 200 → agit au tick 8 (14 %/tick, 112 %)');
    egal(pt[1].tick, 15, 'combat 100 → agit au tick 15 (7 %/tick, 105 %)');
    egal(pt[0].ordre, 1, 'ordre 1 au plus rapide');
  }

  // ⚠️ LE cas « un seul par tick » : trois pleins au MÊME tick (9) prennent le
  // tour l'un après l'autre (9, 10, 11), pas tous au même.
  {
    const pt = premiersTours(simuler([camp(173), camp(172, 'ennemi'), camp(171)]));
    egal(pt.map((a) => a.id), ['173-allie', '172-ennemi', '171-allie'], 'ordre par vitesse au même tick');
    egal(pt.map((a) => a.tick), [9, 10, 11], 'un seul par tick : 9 / 10 / 11');
    egal(pt[1].camp, 'ennemi', 'le camp est conservé');
  }

  // Égalité parfaite : l'ordre de placement départage, échelonné d'un tick.
  {
    const pt = premiersTours(simuler([camp(150), camp(150, 'ennemi')]));
    egal(pt[0].id, '150-allie', 'à vitesse égale, le premier placé passe');
    egal(pt[0].tick + 1, pt[1].tick, 'un par tick : le second attend le tick suivant');
  }

  // Boost de barre d'attaque : +30 % au tick 3 → agit plus tôt (tick 10 vs 15).
  {
    const sim = simuler([camp(100), { id: 'boost', combat: 100, camp: 'allie', atbMod: { 3: 30 } }]);
    const pt = premiersTours(sim);
    egal(pt[0].id, 'boost', 'le boost d\'ATB fait agir plus tôt');
    egal(pt[0].tick, 10, 'combat 100 + boost 30 % au tick 3 → agit au tick 10');
    egal(trajDe(sim, 'boost')[2], 51, 'la trajectoire montre le saut de barre au tick 3');
  }

  // Réduction de barre : −50 % au tick 2 vide la barre sans passer en négatif.
  {
    const sim = simuler([{ id: 'reduc', combat: 100, camp: 'allie', atbMod: { 2: -50 } }]);
    egal(trajDe(sim, 'reduc')[1], 0, 'la barre tombe à 0 au tick 2, pas en négatif');
    egal(premiersTours(sim)[0].tick, 17, 'après remise à 0 au tick 2, action au tick 17');
  }

  // ⚠️ Buff de vitesse PAR TICK, sans report : marqué au seul tick 1, il ne
  // profite qu'à ce tick (9,1 %) puis retour à la vitesse de base → tick 14.
  // (S'il était soutenu, ce serait le tick 11 : c'est ce qu'on NE veut PAS.)
  {
    const pt = premiersTours(simuler([{ id: 'buff', combat: 100, camp: 'allie', speedMod: { 1: 30 } }]));
    egal(pt[0].tick, 14, 'buff au seul tick 1 → agit au tick 14 (pas de report)');
  }

  // Un buff qui DURE se marque sur chaque tick : +30 % aux ticks 1→5 → tick 13.
  {
    const speedMod = { 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 };
    const pt = premiersTours(simuler([{ id: 'dure', combat: 100, camp: 'allie', speedMod }]));
    egal(pt[0].tick, 13, 'buff marqué sur les ticks 1→5 → agit au tick 13');
  }

  // Artéfact « Effet aug. VIT » : ⚠️ MULTIPLICATIF sur la VALEUR DU BUFF, pas
  // additif à la vitesse — « 10% artifact makes SPD buff being 33% instead of
  // 30% » (Ellia's Wiki). Actif seulement quand un buff est posé ce tick-là.
  {
    // buff +30 % au tick 1 + artéfact +20 % → buff 36 % → vitesse ×1,36 → 9,52.
    const sim = simuler([
      { id: 'arte', combat: 100, camp: 'allie', speedMod: { 1: 30 }, artefactBuff: 20 },
    ]);
    egal(
      sim.lignes[0].trajectoire[0].toFixed(3),
      '9.520',
      'buff +30 % + artéfact +20 % → buff 36 %, soit 9,52 au tick 1 (et non 10,5 : ce serait additif)'
    );
    // ⚠️ Cas MESURÉ EN JEU : 9 d'artéfact ne passait pas, 10 oui. La valeur du
    // buff est un ENTIER de pourcentage — 30 × 1,09 = 32,7 → 32 % (tronqué),
    // alors que 30 × 1,10 = 33 % tout rond. Le calcul décimal faisait croire
    // que 9 suffisait.
    const neuf = simuler([{ id: 'a9', combat: 100, camp: 'allie', speedMod: { 1: 30 }, artefactBuff: 9 }]);
    const dix = simuler([{ id: 'a10', combat: 100, camp: 'allie', speedMod: { 1: 30 }, artefactBuff: 10 }]);
    egal(neuf.lignes[0].trajectoire[0].toFixed(3), '9.240', '9 % d’artéfact → buff 32 % (tronqué), pas 32,7');
    egal(dix.lignes[0].trajectoire[0].toFixed(3), '9.310', '10 % d’artéfact → buff 33 %');
    ok(
      dix.lignes[0].trajectoire[0] > neuf.lignes[0].trajectoire[0],
      "le dixième point d'artéfact fait bien un saut, le neuvième non"
    );

    // Le cas de la source, vérifié tel quel : 10 % d'artéfact → buff 33 %.
    const wiki = simuler([
      { id: 'wiki', combat: 100, camp: 'allie', speedMod: { 1: 30 }, artefactBuff: 10 },
    ]);
    egal(wiki.lignes[0].trajectoire[0].toFixed(3), '9.310', "10 % d'artéfact → buff 33 % (9,31 au tick 1)");
  }
  {
    // Sans buff ce tick-là, l'artéfact ne fait RIEN (vitesse de base).
    const sim = simuler([{ id: 'sansbuff', combat: 100, camp: 'allie', artefactBuff: 20 }]);
    egal(sim.lignes[0].trajectoire[0], 7, 'artéfact ignoré tant qu\'aucun buff n\'est actif');
  }

  // ⚠️ Multi-tours : après avoir joué, la barre repart de 0 et le monstre rejoue.
  // Sur 40 ticks, combat 300 (inc 21) agit d'abord au tick 5, puis tous les ~5.
  {
    const sim = simuler([camp(300)]);
    egal(sim.lignes[0].trajectoire.length, 40, 'trajectoire calculée sur 40 ticks');
    egal(sim.actions[0].tick, 5, 'combat 300 → premier tour au tick 5');
    ok(sim.actions.length >= 7, 'un monstre rapide rejoue plusieurs fois sur 40 ticks');
    // La barre repart de 0 : au tick juste après le premier tour, elle est basse.
    ok(sim.lignes[0].trajectoire[5] < 100, 'après le tour au tick 5, la barre est repartie de 0');
  }

  // Un seul monstre agit par tick, sur toute la simulation.
  {
    const sim = simuler([camp(300), camp(300, 'ennemi'), camp(200)]);
    const ticks = sim.actions.map((a) => a.tick);
    egal(new Set(ticks).size, ticks.length, 'jamais deux actions sur le même tick');
  }

  // Vitesse nulle → écartée de la simulation.
  {
    const sim = simuler([camp(0), camp(120)]);
    egal(sim.lignes.length, 1, 'un monstre à vitesse nulle est écarté');
    egal(sim.lignes[0].id, '120-allie', 'seul le monstre qui remplit sa barre reste');
  }

  ok(simuler([]).lignes.length === 0, 'aucun monstre → simulation vide, pas d\'erreur');
}

// Import d'un deck de siège dans « Ton équipe » (src/lib/speedTuneDeck.ts) :
// les monstres du deck avec leur vitesse de runes, et le lead du leader quand
// il vaut pour TOUT le camp.
export function testSpeedTuneDeck() {
  titre('Speed tuning — import d\'un deck de siège');

  const monstre = (id: string, name: string, lead?: { amount: number; area: string; element: string | null }) =>
    ({ id, name, stats: { speed: 100 }, leaderSkill: lead ? { stat: 'Attack Speed', ...lead } : undefined }) as unknown as Monster;

  const equipe = (
    slots: { monsterId: string | null; runeSpeed: number | null; arte?: number[] }[]
  ): SiegeTeam =>
    ({
      id: 't',
      lead: 0,
      tickAlertDismissed: false,
      slots: slots.map(({ arte, ...s }) => ({
        ...s,
        tick: 0,
        sets: [],
        // Un artéfact par valeur : la propriété « Effet aug. VIT » porte le
        // code 206 (voir ARTIFACT_SUB dans lib/effects.ts).
        gear: arte
          ? {
              base: {},
              runes: [],
              artifacts: arte.map((v) => ({ subs: [{ code: 206, value: v }] })),
            }
          : undefined,
      })),
    }) as unknown as SiegeTeam;

  const trevor = monstre('1', 'Trevor', { amount: 24, area: 'Guild', element: null });
  const bella = monstre('2', 'Bella');
  const loren = monstre('3', 'Loren');
  const fran = monstre('4', 'Fran', { amount: 33, area: 'Element', element: 'water' });
  const arene = monstre('5', 'Tyron', { amount: 19, area: 'Arena', element: null });
  const parId = new Map([trevor, bella, loren, fran, arene].map((m) => [String(m.id), m]));

  {
    const d = deckPourSpeedTune(
      equipe([
        { monsterId: '1', runeSpeed: 155 },
        { monsterId: '2', runeSpeed: 92 },
        { monsterId: '3', runeSpeed: null },
      ]),
      parId
    );
    egal(d.monstres.length, 3, 'les trois slots remplis sont repris');
    egal(d.monstres[0].monster.name, 'Trevor', 'le leader (slot 0) reste en tête');
    egal(d.monstres[0].runeSpeed, 155, 'la vitesse de runes du slot est reprise');
    egal(d.monstres[2].runeSpeed, null, 'un slot sans vitesse de runes reste vide');
    egal(d.lead?.amount, 24, 'un lead de guilde vaut pour tout le camp → appliqué');
    egal(d.lead?.area, 'Guild', 'avec sa portée : le camp porte le lead ENTIER, pas un pourcentage');
  }

  // Slots vides et monstres absents des données : écartés, sans casser le deck.
  {
    const d = deckPourSpeedTune(
      equipe([
        { monsterId: null, runeSpeed: null },
        { monsterId: '404', runeSpeed: 100 },
        { monsterId: '3', runeSpeed: 88 },
      ]),
      parId
    );
    egal(d.monstres.length, 1, 'slot vide et monstre inconnu écartés');
    egal(d.monstres[0].monster.name, 'Loren', 'le slot rempli est bien celui qui reste');
    egal(d.lead, null, 'pas de leader → pas de lead imposé');
  }

  // Set RAPIDITÉ : repris du slot, parce qu'il change la vitesse de combat.
  {
    const equipeSwift = (sets: string[]): SiegeTeam =>
      ({
        id: 't',
        lead: 0,
        tickAlertDismissed: false,
        slots: [{ monsterId: '1', runeSpeed: 200, tick: 0, sets }],
      }) as unknown as SiegeTeam;
    egal(deckPourSpeedTune(equipeSwift(['swift']), parId).monstres[0].swift, true, 'un slot en Swift est repris comme tel');
    egal(deckPourSpeedTune(equipeSwift(['violent']), parId).monstres[0].swift, false, 'un autre set ne coche pas Swift');
  }

  // Artéfact « Effet aug. VIT » : lu sur le gear du slot, pas à ressaisir.
  {
    const d = deckPourSpeedTune(
      equipe([
        { monsterId: '1', runeSpeed: 155, arte: [12] },
        { monsterId: '2', runeSpeed: 92, arte: [8, 5] },
        { monsterId: '3', runeSpeed: 88 },
      ]),
      parId
    );
    egal(d.monstres[0].artefactBuff, 12, "l'artéfact « Effet aug. VIT » est repris");
    egal(d.monstres[1].artefactBuff, 13, 'deux artéfacts porteurs → leurs effets s’additionnent');
    egal(d.monstres[2].artefactBuff, null, 'aucun artéfact porteur → rien à reprendre');
  }

  // ⚠️ Un lead d'ÉLÉMENT ne se transpose pas au modèle « un lead par camp » —
  // il descend MONSTRE PAR MONSTRE.
  //
  // ⚠️ **C'est la correction d'un écart entre les deux écrans.** La card de
  // siège affichait la vitesse lead d'élément compris, le speed tune la
  // recalculait sans : deux nombres pour un même monstre, et un « il manque X de
  // VIT » portant sur une vitesse que personne n'avait sous les yeux.
  {
    // Fran (leader) porte « +33 % VIT alliés Eau » ; on lui adjoint un allié Eau
    // et un allié d'un autre élément.
    const eau = { id: '6', name: 'Ondine', stats: { speed: 100 }, element: 'water' } as unknown as Monster;
    const feu = { id: '7', name: 'Braise', stats: { speed: 100 }, element: 'fire' } as unknown as Monster;
    const avecElements = new Map(parId);
    avecElements.set('6', eau);
    avecElements.set('7', feu);
    avecElements.set('4', { ...fran, element: 'water' } as unknown as Monster);

    const d = deckPourSpeedTune(
      equipe([
        { monsterId: '4', runeSpeed: 100 },
        { monsterId: '6', runeSpeed: 100 },
        { monsterId: '7', runeSpeed: 100 },
      ]),
      avecElements
    );
    // ⚠️ Le camp porte le lead ENTIER, portée comprise : c'est ce qui permet à
    // l'encart de le dire (pastille + sélecteur de portée) et au calcul de ne le
    // donner qu'aux ayants droit.
    egal(d.lead?.amount, 33, 'le camp reçoit le lead du leader');
    egal(d.lead?.area, 'Element', "avec sa portée — sans elle, « +33 % » ne dit pas à qui");
    egal(d.lead?.element, 'water', "et l'élément qu'il favorise");
    egal(d.monstres[0].lead, 33, 'le leader Eau en profite');
    egal(d.monstres[1].lead, 33, "l'allié Eau aussi");
    egal(d.monstres[2].lead, 0, "l'allié Feu, lui, n'a rien — c'est tout l'intérêt du champ");

    // Et la vitesse de combat SUIT, sans qu'un lead de camp soit passé.
    const combatDe = (i: number) =>
      combatAuto(
        { id: `${i}`, monster: d.monstres[i].monster, runeSpeed: 100, lead: d.monstres[i].lead },
        0,
        { kits: new Map(), sorts: new Map(), passifs: new Map() }
      );
    ok(
      (combatDe(1) ?? 0) > (combatDe(2) ?? 0),
      "l'allié Eau est plus rapide que l'allié Feu à runes égales : le lead est VRAIMENT entré dans le calcul"
    );
    egal(
      combatDe(2),
      combatSpeed(100, 100, 0, false),
      "et l'allié Feu vaut exactement ce qu'il vaudrait sans aucun lead (le totem, lui, y est toujours)"
    );
    egal(
      combatDe(1),
      combatSpeed(100, 100, 33, false),
      "quand l'allié Eau vaut exactement ce que donne le lead de 33 %"
    );
  }

  // ⚠️ **Le menu propose TOUS les leads du jeu**, lus dans les données — pas une
  // liste écrite à la main. Le jeu a des +10, +15, +16, +17, et des leads
  // d'ÉLÉMENT à +23 et +30 qu'aucun pourcentage seul ne sait dire.
  {
    const bestiaire = [trevor, bella, loren, fran, arene];
    const dispo = leadsDeVitesse(bestiaire);
    egal(
      dispo.some((l) => l.amount === 24 && !l.element),
      true,
      'un lead de guilde figure au menu, sans élément'
    );
    egal(
      dispo.some((l) => l.amount === 33 && l.element === 'water'),
      true,
      "un lead d'élément aussi, avec le sien"
    );
    egal(
      dispo.some((l) => l.amount === 19),
      false,
      "un lead d'ARÈNE n'y figure pas : il ne compte pas en siège"
    );
    egal(
      dispo.filter((l) => l.amount === 24 && !l.element).length,
      1,
      'et chaque lead n’apparaît qu’une fois, quel que soit le nombre de monstres qui le portent'
    );
  }

  // ⚠️ **Le lead se devine à partir de l'équipe** : un monstre qui en porte un le
  // pose tout seul dans l'encart — l'information est déjà là.
  {
    const ligne = (m: Monster): Ligne => ligneVierge(m, 'allie');
    egal(leadPresent([ligne(bella), ligne(trevor)], 'allie')?.amount, 24, "le lead d'un allié est repéré");
    egal(leadPresent([ligne(bella), ligne(loren)], 'allie'), null, 'aucun porteur → aucun lead');
    egal(
      leadPresent([ligne(trevor), ligne(fran)], 'allie')?.amount,
      33,
      'deux porteurs → le plus fort, un seul leader agit'
    );
    egal(leadPresent([ligne(arene)], 'allie'), null, "un lead d'arène ne compte pas en siège");
    egal(leadPresent([ligne(trevor)], 'ennemi'), null, "et on ne regarde que le camp demandé");
  }

  // Un lead qui vaut pour TOUS reste au camp : le sélecteur garde la main.
  {
    const d = deckPourSpeedTune(equipe([{ monsterId: '1', runeSpeed: 100 }]), parId);
    egal(d.lead?.amount, 24, 'lead de guilde → au camp');
    egal(d.lead?.element, null, 'sans élément : il vaut pour tout le monde');
  }

  {
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '4', runeSpeed: 100 }]), parId).lead?.area,
      'Element',
      "lead d'élément → repris tel quel, portée comprise (le camp sait la dire)"
    );
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '5', runeSpeed: 100 }]), parId).lead,
      null,
      'lead d\'arène → inactif en siège, pas appliqué'
    );
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '2', runeSpeed: 100 }]), parId).lead,
      null,
      'leader sans lead de vitesse → rien à appliquer'
    );
  }
}

/* ------------------------------- Chaîne d'ouverture (combo non coupé) ---- */

// PRNG déterministe (mulberry32) — mêmes scénarios d'une exécution à l'autre.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Axe = 'combat' | 'artefactBuff';

// L'ordre de jeu des alliés, recalculé ICI (la référence n'emprunte pas les
// helpers du code testé).
function ordreAlliesRef(monstres: TuneMonstre[], horizon = HORIZON_TICKS): string[] {
  const premiers = premiersTours(simuler(monstres, horizon));
  const tick = new Map(premiers.map((a) => [a.id, a.tick] as const));
  return monstres
    .filter((m) => m.camp === 'allie')
    .map((m, placement) => ({ id: m.id, t: tick.get(m.id) ?? Infinity, placement }))
    .sort((a, b) => a.t - b.t || a.placement - b.placement)
    .map((x) => x.id);
}

// Le tune tient-il ? Tous les alliés avant le premier adverse, ET l'ordre de jeu
// des alliés inchangé (le boost de barre doit rester devant ceux qu'il pousse).
function tuneTient(essai: TuneMonstre[], ordre: string[], horizon = HORIZON_TICKS): boolean {
  const premiers = premiersTours(simuler(essai, horizon));
  const adverse = premiers.find((a) => a.camp === 'ennemi');
  const nbAllies = essai.filter((m) => m.camp === 'allie').length;
  const passent = premiers.filter(
    (a) => a.camp === 'allie' && (!adverse || a.tick < adverse.tick)
  );
  if (passent.length !== nbAllies) return false;
  // ⚠️ Seul le PREMIER est protégé : le doubler ferait jouer les boostés AVANT
  // le boost. L'ordre des suivants entre eux est libre.
  const vu = ordreAlliesRef(essai, horizon);
  return vu[0] === ordre[0];
}

const poserAxe = (m: TuneMonstre, axe: Axe, v: number) => {
  if (axe === 'combat') m.combat = v;
  else m.artefactBuff = v;
};
const lireAxe = (m: TuneMonstre, axe: Axe) => (axe === 'combat' ? m.combat : (m.artefactBuff ?? 0));

// RÉFÉRENCE DE CONTRÔLE (algo-verify) : « une solution existe-t-elle ? », par
// BALAYAGE EXHAUSTIF des affectations allié -> tick à ORDRE CONSTANT. Elle
// n'emprunte NI la stratégie NI la recherche du solveur — c'est tout l'intérêt :
// la référence précédente rejouait la stratégie « minimum pour chaque monstre
// coupé » du code testé, et validait donc son angle mort (ne jamais accélérer un
// allié qui passe déjà, alors que c'est lui qui achète les ticks des suivants).
//
// Volontairement lente : n alliés × toutes les combinaisons croissantes de ticks
// dans 1..TICKS_REF, une simulation chacune.
const TICKS_REF = 12;
function solutionExisteRef(monstres: TuneMonstre[], axe: Axe): boolean {
  const ordre = ordreAlliesRef(monstres);
  // ⚠️ **La vitesse du PREMIER est une donnée, pas une inconnue** : il porte le
  // meilleur Swift du compte. La référence doit résoudre LE MÊME problème que le
  // solveur, contrainte comprise — sinon elle réclame des solutions injouables.
  const premier = ordre[0];
  const plafond = axe === 'combat' ? COMBAT_MAX : ARTE_MAX;

  const essayer = (vals: Map<string, number>): boolean => {
    const essai = monstres.map((m) => ({ ...m }));
    for (const m of essai) {
      const v = vals.get(m.id);
      if (v !== undefined) poserAxe(m, axe, v);
    }
    return tuneTient(essai, ordre);
  };

  // ⚠️ **EXHAUSTIF ET COMPLET quand il n'y a qu'une inconnue** (2 alliés, le
  // premier figé) : tous les points de 0 à COMBAT_MAX, un par un. C'est la seule
  // forme de contrôle qui ne suppose RIEN du modèle — ni « un allié par tick »,
  // ni des valeurs remarquables. Elle a valeur de preuve.
  if (ordre.length === 2) {
    const cible = ordre[1];
    const dep = lireAxe(monstres.find((m) => m.id === cible)!, axe);
    for (let v = dep; v <= plafond; v++) if (essayer(new Map([[cible, v]]))) return true;
    return false;
  }

  // Au-delà, le produit cartésien est hors d'atteinte : on balaie les
  // affectations allié -> tick, ticks NON DÉCROISSANTS (⚠️ deux alliés peuvent
  // être prêts au MÊME tick et faire la queue — le supposer strictement croissant
  // était justement l'angle mort du solveur), aux deux bords de chaque palier.
  // ⚠️ **Contrôle INCOMPLET, assumé** : il peut rater une solution, jamais en
  // inventer une. Un échec est donc toujours un vrai défaut du solveur.
  const n = ordre.length;
  const combinaisons: number[][] = [];
  const construire = (debut: number, acc: number[]) => {
    if (acc.length === n) {
      combinaisons.push([...acc]);
      return;
    }
    for (let t = debut; t <= TICKS_REF; t++) construire(t, [...acc, t]);
  };
  construire(1, []);
  for (const ticks of combinaisons) {
    for (const bord of ['bas', 'haut'] as const) {
      const vals = new Map<string, number>();
      let interdit = false;
      ordre.forEach((id, i) => {
        const src = lireAxe(monstres.find((m) => m.id === id)!, axe);
        const t = ticks[i];
        const brut =
          axe !== 'combat'
            ? ARTE_MAX
            : bord === 'bas'
              ? speedForTick(t)
              : t <= 1
                ? COMBAT_MAX
                : Math.min(COMBAT_MAX, speedForTick(t - 1) - 1);
        if (id === premier && brut > src) interdit = true;
        vals.set(id, Math.max(src, brut));
      });
      if (!interdit && essayer(vals)) return true;
    }
  }
  return false;
}

// Applique ce que le solveur propose et rend l'équipe corrigée.
function appliquer(
  monstres: TuneMonstre[],
  axe: Axe,
  valeurs: { id: string; requis: number | null }[]
): TuneMonstre[] {
  const essai = monstres.map((m) => ({ ...m }));
  const parId = new Map(essai.map((m) => [m.id, m]));
  for (const v of valeurs) {
    const m = parId.get(v.id);
    if (m && v.requis != null) poserAxe(m, axe, v.requis);
  }
  return essai;
}

// Cas de terrain (deck Mihyang / Adriana / Sonia, lead 28 %, tous en Swift) :
// nos trajectoires doivent tomber au millième sur celles de l'outil de référence
// de la communauté — c'est ce qui a fait apparaître que le Swift manquait.
export function testSpeedTuneReference() {
  titre('Speed tuning — cas de référence (Mihyang / Adriana / Sonia)');

  // Vitesses de combat, Swift compris (voir tests/vitesse.test.ts pour le calcul).
  egal(combatSpeed(111, 228, 28, true), 387, 'Adriana : 111 base + 228 runes, lead 28 %, Swift → 387');
  egal(combatSpeed(119, 203, 28, true), 373, 'Sonia : 373 (374 si l’on oublie le Swift)');
  egal(combatSpeed(101, 205, 28, true), 349, 'Mihyang : 349 (350 sans le Swift)');

  const buff = { 5: 30, 6: 30 };
  const sim = simuler(
    [
      { id: 'adriana', combat: 387, camp: 'allie', speedMod: buff },
      { id: 'sonia', combat: 373, camp: 'allie', speedMod: buff },
      { id: 'mihyang', combat: 349, camp: 'allie', speedMod: buff },
      { id: 'adv', combat: 387, camp: 'ennemi' },
    ],
    12
  );
  const traj = (id: string) =>
    sim.lignes
      .find((l) => l.id === id)!
      .trajectoire.slice(0, 8)
      .map((v) => v.toFixed(3))
      .join(' ');

  egal(
    traj('adriana'),
    '27.090 54.180 81.270 108.360 35.217 70.434 97.524 124.614',
    'Adriana : barre identique à la référence, au millième'
  );
  egal(
    traj('sonia'),
    '26.110 52.220 78.330 104.440 138.383 33.943 60.053 86.163',
    'Sonia : barre identique à la référence'
  );
  egal(
    traj('mihyang'),
    '24.430 48.860 73.290 97.720 129.479 161.238 185.668 24.430',
    'Mihyang : barre identique à la référence'
  );
  egal(
    premiersTours(sim)
      .map((a) => `${a.id}@${a.tick}`)
      .join(' '),
    'adriana@4 sonia@5 adv@6 mihyang@7',
    "ordre des tours identique : un seul monstre par tick, l'adverse s'intercale au 6"
  );
}

export function testSpeedTuneChaine() {
  titre("Speed tuning — chaîne d'ouverture");

  const m = (id: string, combat: number, camp: 'allie' | 'ennemi'): TuneMonstre => ({ id, combat, camp });

  // Aucun adverse : rien ne peut couper le combo.
  {
    const d = diagnostiquerChaine([m('a', 200, 'allie'), m('b', 150, 'allie')]);
    ok(d.ok, 'sans adverse, la chaîne tient');
    egal(d.coupeur, null, 'aucun coupeur désigné');
    egal(vitessesRequises([m('a', 200, 'allie')]).length, 0, 'rien à corriger sans adverse');
  }

  // Eshir (base 115 rapide) s'intercale entre deux alliés → combo coupé.
  {
    const monstres = [m('rapide', 300, 'allie'), m('eshir', 250, 'ennemi'), m('lent', 180, 'allie')];
    const d = diagnostiquerChaine(monstres);
    ok(!d.ok, "un adverse plus rapide qu'un allié coupe la chaîne");
    egal(d.coupeur?.id, 'eshir', 'le coupeur est le premier adverse à agir');
    egal(d.coupes.length, 1, 'un seul allié coupé');
    egal(d.coupes[0].id, 'lent', "c'est le plus lent qui passe après");

    const req = vitessesRequises(monstres);
    egal(req.length, 1, 'une vitesse à trouver');
    egal(req[0].id, 'lent', "la correction porte sur l'allié coupé");
    ok(req[0].combatRequis != null && req[0].combatRequis > 180, 'il lui faut plus que sa vitesse actuelle');

    // La vitesse proposée répare VRAIMENT la chaîne, et un point de moins ne suffit pas.
    const avec = (v: number) => monstres.map((x) => (x.id === 'lent' ? { ...x, combat: v } : x));
    ok(diagnostiquerChaine(avec(req[0].combatRequis!)).ok, 'à la vitesse proposée, la chaîne tient');
    ok(!diagnostiquerChaine(avec(req[0].combatRequis! - 1)).ok, "un point de moins et elle est coupée : c'est bien le minimum");
  }

  // Un boost de barre d'attaque suffit parfois : la vitesse requise en tient compte.
  {
    const base = [m('rapide', 300, 'allie'), m('eshir', 250, 'ennemi'), m('lent', 180, 'allie')];
    const sansBoost = vitessesRequises(base)[0].combatRequis!;
    const boost = base.map((x) => (x.id === 'lent' ? { ...x, atbMod: { 1: 20 } } : x));
    const avecBoost = vitessesRequises(boost)[0].combatRequis!;
    ok(avecBoost < sansBoost, "un boost d'ATB au tick 1 abaisse la vitesse à trouver");
    // Assez de boost et il n'y a plus rien à corriger du tout.
    const gros = base.map((x) => (x.id === 'lent' ? { ...x, atbMod: { 1: 30 } } : x));
    ok(diagnostiquerChaine(gros).ok, 'un boost suffisant répare la chaîne sans toucher aux vitesses');
  }

  // Un seul monstre agit par tick : cinq alliés ne peuvent pas tous passer
  // avant un adverse qui agit au tick 3, même à vitesse maximale.
  {
    const monstres: TuneMonstre[] = [
      m('e', COMBAT_MAX, 'ennemi'),
      ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => m(id, 100, 'allie')),
    ];
    const req = vitessesRequises(monstres);
    ok(
      req.some((r) => r.combatRequis === null),
      "trop d'alliés à caser avant l'adverse → au moins un cas déclaré insoluble"
    );
  }

  // Compétences déclenchées par le TOUR : un allié qui remplit la barre de son
  // camp accélère les siens à partir du tick où il joue.
  {
    const sans = premiersTours(simuler([m('boosteur', 300, 'allie'), m('lent', 150, 'allie')]));
    const avec = premiersTours(
      simuler([{ ...m('boosteur', 300, 'allie'), sort: { atbEquipe: 40 } }, m('lent', 150, 'allie')])
    );
    const tickDe = (pt: ReturnType<typeof premiersTours>, id: string) => pt.find((a) => a.id === id)!.tick;
    egal(tickDe(avec, 'boosteur'), tickDe(sans, 'boosteur'), 'le lanceur joue au même tick');
    ok(tickDe(avec, 'lent') < tickDe(sans, 'lent'), 'son allié joue plus tôt grâce au boost de barre');
  }

  // Le boost ne franchit pas les CAMPS : un adverse qui remplit la barre des
  // siens ne remplit pas la nôtre.
  //
  // ⚠️ Ce qu'on vérifie ici est bien la BARRE, pas le tick d'action : la règle
  // « un seul monstre par tick » fait qu'un adverse qui joue plus souvent occupe
  // d'autres ticks, ce qui peut décaler notre tour dans un sens comme dans
  // l'autre — sans que sa compétence ne nous ait jamais touchés.
  {
    const barre = (skill?: number) =>
      simuler([{ ...m('eshir', 300, 'ennemi'), sort: { atbEquipe: skill } }, m('nous', 150, 'allie')]).lignes.find(
        (l) => l.id === 'nous'
      )!.trajectoire;
    const sans = barre();
    const avec = barre(40);
    egal(
      avec.slice(0, 6).map((v) => v.toFixed(2)).join(' '),
      sans.slice(0, 6).map((v) => v.toFixed(2)).join(' '),
      "le boost d'un adverse ne remplit pas la barre de notre camp"
    );
  }

  // Buff de vitesse de compétence : à partir du tick SUIVANT le tour du lanceur.
  {
    const sans = simuler([m('buffeur', 300, 'allie'), m('lent', 150, 'allie')]);
    const avec = simuler([{ ...m('buffeur', 300, 'allie'), sort: { buffEquipe: 30 } }, m('lent', 150, 'allie')]);
    const traj = (sim: Simulation, id: string) => sim.lignes.find((l) => l.id === id)!.trajectoire;
    const tourBuffeur = premiersTours(sans).find((a) => a.id === 'buffeur')!.tick;
    egal(
      traj(avec, 'lent')[tourBuffeur - 1].toFixed(2),
      traj(sans, 'lent')[tourBuffeur - 1].toFixed(2),
      'au tick du lanceur, rien ne change encore (le gain est déjà acquis)'
    );
    ok(
      traj(avec, 'lent')[tourBuffeur] > traj(sans, 'lent')[tourBuffeur],
      'dès le tick suivant, son allié monte plus vite'
    );
  }

  // Un adverse qui remplit la barre des siens est pris en compte par le
  // solveur : la vitesse à trouver n'est pas la même sans lui.
  {
    const base = [m('a1', 260, 'allie'), m('a2', 170, 'allie'), m('eshir', 250, 'ennemi')];
    const avecSkill = base.map((x) => (x.id === 'a1' ? { ...x, sort: { atbEquipe: 35 } } : x));
    const sans = vitessesRequises(base);
    const avec = vitessesRequises(avecSkill);
    ok(sans.length > 0, 'sans compétence, un allié est coupé');
    // ⚠️ **Le coût se lit sur l'ÉQUIPE, pas sur un monstre.** La compétence peut
    // déplacer la correction d'un allié à l'autre : ici, accélérer le PORTEUR du
    // boost de 26 points revient moins cher que d'en trouver 80 sur celui qu'il
    // pousse. Comparer « la vitesse du premier de la liste » ne veut donc plus
    // rien dire — c'est le total des points à trouver qui doit baisser.
    const cout = (rs: VitesseRequise[]) =>
      rs.reduce((t, r) => t + ((r.combatRequis ?? r.combatActuel) - r.combatActuel), 0);
    ok(
      avec.length === 0 || cout(avec) < cout(sans),
      `la compétence d'un allié abaisse le total à trouver (${cout(avec)} contre ${cout(sans)})`
    );
  }

  // L'AUTRE levier : l'artéfact « Effet aug. VIT », qui amplifie le buff de
  // vitesse reçu. Sans buff, il n'y a rien à en attendre.
  {
    const sansBuff = [m('a1', 260, 'allie'), m('a2', 170, 'allie'), m('eshir', 250, 'ennemi')];
    egal(
      artefactsRequis(sansBuff).every((r) => r.artefactRequis === null),
      true,
      "sans buff de vitesse, l'artéfact ne peut rien : aucune valeur proposée"
    );

    // Un allié rapide qui pose un buff de vitesse sur son camp, un allié lent
    // coupé de peu : l'artéfact qui amplifie ce buff peut suffire à le sauver.
    const avecBuff = [
      { ...m('a1', 250, 'allie'), sort: { buffEquipe: 30 } },
      m('a2', 105, 'allie'),
      m('eshir', 130, 'ennemi'),
    ];
    const arte = artefactsRequis(avecBuff).find((r) => r.artefactRequis != null);
    ok(!!arte, 'avec un buff de vitesse, un artéfact suffisant est proposé');
    if (arte) {
      const avec = (v: number) =>
        avecBuff.map((x) => (x.id === arte.id ? { ...x, artefactBuff: v } : x));
      ok(diagnostiquerChaine(avec(arte.artefactRequis!)).ok, "à l'artéfact proposé, la chaîne tient");
      ok(
        !diagnostiquerChaine(avec(arte.artefactRequis! - 1)).ok,
        "un point d'artéfact de moins et elle est coupée : c'est bien le minimum"
      );
    }
  }

  // ⚠️ CIBLES. Breeze (Kroa) remplit la barre d'UN allié — celui qui l'a la plus
  // basse — pas de toute l'équipe. Confondre les deux triplait son effet.
  {
    const sim = simuler([
      { ...m('kroa', 300, 'allie'), sort: { atbAllie: 30 } },
      m('rapide', 250, 'allie'),
      m('lent', 120, 'allie'),
    ]);
    const t = premiersTours(sim);
    const sans = premiersTours(simuler([m('kroa', 300, 'allie'), m('rapide', 250, 'allie'), m('lent', 120, 'allie')]));
    const tickDe = (pt: typeof t, id: string) => pt.find((a) => a.id === id)!.tick;
    ok(tickDe(t, 'lent') < tickDe(sans, 'lent'), "le boost va à l'allié dont la barre est la plus basse");
    egal(tickDe(t, 'rapide'), tickDe(sans, 'rapide'), "il ne va PAS à toute l'équipe");
  }

  // ⚠️ Une cible DÉSIGNÉE l'emporte sur la barre la plus basse : certains sorts
  // laissent le joueur viser (« the target ally », S3 de Sapsaree).
  {
    const equipe = (cible?: string) => [
      { ...m('lanceur', 300, 'allie'), sort: { atbAllie: 40, cibleAllie: cible } },
      m('bas', 100, 'allie'),
      m('haut', 240, 'allie'),
    ];
    const gainDe = (sim: Simulation, id: string) => Object.values(sim.lignes.find((l) => l.id === id)!.effetAtb);
    const defaut = simuler(equipe(), 12);
    egal(gainDe(defaut, 'bas')[0], 40, 'sans cible désignée, la barre la plus basse reçoit');
    egal(gainDe(defaut, 'haut').length, 0, "et l'autre ne reçoit rien");

    const visee = simuler(equipe('haut'), 12);
    egal(gainDe(visee, 'haut')[0], 40, "la cible désignée reçoit, même si sa barre n'est pas la plus basse");
    egal(gainDe(visee, 'bas').length, 0, 'et la plus basse ne reçoit plus rien');
  }

  // Vider la barre de l'adverse est l'autre façon de passer devant lui.
  {
    // ⚠️ Il faut jouer AVANT lui pour lui retirer quoi que ce soit : un retrait
    // posé après son tour ne change évidemment rien à ce tour-là.
    const sans = premiersTours(simuler([m('moi', 300, 'allie'), m('e', 200, 'ennemi')]));
    const avec = premiersTours(
      simuler([{ ...m('moi', 300, 'allie'), sort: { atbEnnemi: 50 } }, m('e', 200, 'ennemi')])
    );
    const tickDe = (pt: typeof sans, id: string) => pt.find((a) => a.id === id)?.tick ?? null;
    ok(
      tickDe(avec, 'e')! > tickDe(sans, 'e')!,
      "un retrait de barre repousse le tour de l'adverse visé"
    );
  }

  // Ralentir l'adverse : sa vitesse baisse à partir du tick suivant.
  {
    const sans = premiersTours(simuler([m('moi', 300, 'allie'), m('e', 150, 'ennemi')]));
    const avec = premiersTours(
      simuler([{ ...m('moi', 300, 'allie'), sort: { ralenti: 30 } }, m('e', 150, 'ennemi')])
    );
    const tickDe = (pt: typeof sans, id: string) => pt.find((a) => a.id === id)!.tick;
    ok(tickDe(avec, 'e') > tickDe(sans, 'e'), "un ralenti repousse le tour de l'adverse");
  }

  // Buff et ralenti de COMPÉTENCES se compensent (ils ne s'empilent pas chacun
  // de leur côté) : +30 posé sur une cible ralentie de 30 la ramène à sa base.
  {
    const gainDe = (ms: TuneMonstre[]) => {
      const l = simuler(ms, 6).lignes.find((x) => x.id === 'cible')!;
      return l.trajectoire[3] - l.trajectoire[2];
    };
    const seul = gainDe([{ id: 'cible', combat: 200, camp: 'allie' }]);
    const buffEtRalenti = gainDe([
      { id: 'cible', combat: 200, camp: 'allie' },
      { id: 'buffeur', combat: COMBAT_MAX, camp: 'allie', sort: { buffEquipe: 30 } },
      { id: 'ralentisseur', combat: COMBAT_MAX, camp: 'ennemi', sort: { ralenti: 30, ralentiTous: true } },
    ]);
    egal(
      buffEtRalenti.toFixed(3),
      seul.toFixed(3),
      'un buff +30 sur une cible ralentie de 30 la ramène à sa vitesse de base'
    );
  }

  // ⚠️ LA GRILLE REMPLACE, elle n'ajoute pas. C'est ce qui permet d'écarter un
  // effet aléatoire (réduction d'ATB à 70 % de chances) dont un tune ne doit pas
  // dépendre : on pose 0 dans la case et le sort ne compte plus.
  {
    const scenario = (atbMod?: ModParTick) => [
      { id: 'moi', combat: 300, camp: 'allie' as const, sort: { atbEnnemi: 50 } },
      { id: 'e', combat: 200, camp: 'ennemi' as const, atbMod },
    ];
    const avecSort = simuler(scenario(), 10).lignes.find((l) => l.id === 'e')!;
    const tickDuSort = Object.keys(avecSort.effetAtb).map(Number)[0];
    egal(avecSort.effetAtb[tickDuSort], -50, "le sort retire bien 50 % à l'adverse");

    const annule = simuler(scenario({ [tickDuSort]: 0 }), 10).lignes.find((l) => l.id === 'e')!;
    egal(annule.effetAtb[tickDuSort] ?? 0, 0, '0 dans la case ANNULE le retrait du sort');
    const sansSort = simuler([{ id: 'e', combat: 200, camp: 'ennemi' }], 10).lignes[0];
    egal(
      annule.trajectoire.slice(0, 8).map((v) => v.toFixed(3)).join(),
      sansSort.trajectoire.slice(0, 8).map((v) => v.toFixed(3)).join(),
      'annulé, tout se passe comme si le sort n’existait pas'
    );

    const remplace = simuler(scenario({ [tickDuSort]: -20 }), 10).lignes.find((l) => l.id === 'e')!;
    egal(remplace.effetAtb[tickDuSort], -20, 'une valeur saisie REMPLACE celle du sort (−20 au lieu de −50)');
  }

  // Même règle sur la vitesse : la case remplace ce que le sort donne.
  {
    const base = [
      { id: 'buffeur', combat: COMBAT_MAX, camp: 'allie' as const, sort: { buffEquipe: 30 } },
      { id: 'moi', combat: 200, camp: 'allie' as const },
    ];
    const avec = simuler(base, 6).lignes.find((l) => l.id === 'moi')!;
    egal(avec.effetSpeed[3], 30, 'le buff du sort court sur les ticks suivants');
    const sans = simuler(
      [base[0], { ...base[1], speedMod: { 3: 0 } }],
      6
    ).lignes.find((l) => l.id === 'moi')!;
    egal(sans.effetSpeed[3] ?? 0, 0, '0 dans la case annule le buff pour ce tick-là');
  }

  // ⚠️ RECHARGEMENT : un sort à 3 tours ne repart qu'au 4ᵉ tour du lanceur.
  // Sans ça, la simulation relançait le S3 à chaque tour et l'équipe montait
  // bien plus vite qu'en jeu.
  {
    const sansCd = simuler([{ id: 'b', combat: 300, camp: 'allie', sort: { atbEquipe: 30 } }], 40);
    const avecCd = simuler(
      [{ id: 'b', combat: 300, camp: 'allie', sort: { atbEquipe: 30, cooldown: 3 } }],
      40
    );
    const ticksDeSort = (sim: Simulation) =>
      Object.keys(sim.lignes[0].effetAtb)
        .map(Number)
        .sort((x, y) => x - y);
    ok(ticksDeSort(sansCd).length > ticksDeSort(avecCd).length, 'un rechargement espace les lancers');

    // Un tour sur trois, précisément : les tours 1, 4, 7… du LANCEUR.
    // ⚠️ Les ticks se lisent dans la simulation AVEC rechargement : sans lui, le
    // monstre se boostant lui-même joue plus souvent, ses tours ne tombent donc
    // pas aux mêmes ticks — comparer d'une simulation à l'autre n'aurait aucun
    // sens.
    const tours = avecCd.actions.map((a) => a.tick);
    const lances = ticksDeSort(avecCd);
    egal(lances[0], tours[0], 'le premier tour lance le sort');
    egal(lances[1], tours[3], 'le suivant tombe au 4ᵉ tour du lanceur (3 tours de rechargement)');
    egal(lances[2], tours[6], 'puis au 7ᵉ');
  }

  // Un sort sans rechargement repart à chaque tour.
  {
    const sim = simuler([{ id: 'b', combat: 300, camp: 'allie', sort: { atbEquipe: 10 } }], 20);
    egal(
      Object.keys(sim.lignes[0].effetAtb).length,
      sim.actions.length,
      'sans rechargement, le sort part à chacun de ses tours'
    );
  }

  // ⚠️ TOUR SUPPLÉMENTAIRE (Kroa : Owl's Hoot buffe toute l'équipe et lui rend
  // son tour). Il tombe AU MÊME TICK : aucune horloge ne tourne entre les deux.
  {
    const kroa = { ...m('kroa', 300, 'allie'), rejoue: true, sort: { buffEquipe: 30 } };
    const sim = simuler([kroa, m('autre', 150, 'allie')]);
    const aTick = sim.actions.filter((a) => a.id === 'kroa' && a.tick === sim.actions[0].tick);
    egal(aTick.length, 2, 'elle joue deux fois au même tick');
    egal(aTick[1].rejoue, true, 'le second tour est marqué comme rendu par la compétence');
    egal(
      premiersTours(sim).filter((a) => a.id === 'kroa').length,
      1,
      "le tour supplémentaire n'ajoute pas un PREMIER tour de plus"
    );
    // Les autres ne gagnent rien pendant ce tour : aucune horloge n'a tourné.
    const sans = simuler([{ ...kroa, rejoue: false }, m('autre', 150, 'allie')]);
    const traj = (x: Simulation) => x.lignes.find((l) => l.id === 'autre')!.trajectoire.slice(0, 8).join();
    egal(traj(sim), traj(sans), 'la barre des autres est identique, avec ou sans son tour rendu');
  }

  // Le SECOND tour lance une autre compétence, quand on la lui a désignée.
  {
    const base = [{ ...m('kroa', 300, 'allie'), rejoue: true }, m('lent', 150, 'allie')];
    const avecSecond = [{ ...base[0], sort2: { atbEquipe: 40 } }, base[1]];
    const tickDe = (ms: TuneMonstre[]) => premiersTours(simuler(ms)).find((a) => a.id === 'lent')!.tick;
    ok(tickDe(avecSecond) < tickDe(base), 'le boost de son second tour profite bien à son camp');
  }

  // TEST DIFFÉRENTIEL (algo-verify) : le solveur est le VÉRIFICATEUR RETOURNÉ —
  // on ne compare donc pas à un miroir de sa stratégie (l'ancienne référence en
  // était un, et validait son angle mort), on contrôle TROIS propriétés, sur des
  // scénarios aléatoires à seed fixe :
  //   P1 JUSTESSE     — ce qu'il propose, appliqué, fait tenir le tune (tous les
  //                     alliés avant l'adverse) SANS changer leur ordre de jeu ;
  //   P2 MINIMALITÉ   — un seul point de moins sur n'importe laquelle des
  //                     valeurs proposées et le tune ne tient plus ;
  //   P3 COMPLÉTUDE   — « hors de portée » n'est prononcé que si le balayage
  //                     exhaustif des affectations allié -> tick, à ordre
  //                     constant, n'en trouve pas non plus.
  {
    let justesse = 0;
    let minimalite = 0;
    let complets = 0;
    let solubles = 0;
    let horsPortee = 0;
    const scenarios = 40;
    for (let s = 0; s < scenarios; s++) {
      const rng = mulberry32(7000 + s * 97);
      const nbAllies = 2 + Math.floor(rng() * 3);
      const nbEnnemis = 1 + Math.floor(rng() * 2);
      const monstres: TuneMonstre[] = [];
      const tirer = (camp: 'allie' | 'ennemi', i: number): TuneMonstre => {
        const combat = 80 + Math.floor(rng() * 320);
        const mm: TuneMonstre = { id: `${camp}${i}`, combat, camp };
        if (rng() < 0.3) mm.atbMod = { [1 + Math.floor(rng() * 4)]: Math.floor(rng() * 60) };
        if (rng() < 0.3) mm.speedMod = { [1 + Math.floor(rng() * 4)]: 30 };
        // Compétences déclenchées par le tour (boost de barre / buff de vitesse
        // sur tout le camp) : c'est exactement ce que le solveur doit suivre.
        if (rng() < 0.35) mm.sort = { atbEquipe: 10 + Math.floor(rng() * 40) };
        if (rng() < 0.25) mm.sort = { ...(mm.sort ?? {}), buffEquipe: 30 };
        return mm;
      };
      for (let i = 0; i < nbAllies; i++) monstres.push(tirer('allie', i));
      for (let i = 0; i < nbEnnemis; i++) monstres.push(tirer('ennemi', i));
      if (diagnostiquerChaine(monstres).ok) continue;

      const ordre = ordreAlliesRef(monstres);
      const req = vitessesRequises(monstres).map((r) => ({ id: r.id, requis: r.combatRequis }));
      const bloque = req.some((r) => r.requis === null);

      if (bloque) {
        horsPortee++;
        // P3 : personne d'autre ne fait mieux.
        if (!solutionExisteRef(monstres, 'combat')) complets++;
        else ok(false, `scénario ${s} : « hors de portée » alors qu'une solution existe`);
        continue;
      }
      solubles++;

      // P1 : la proposition tient.
      const corrige = appliquer(monstres, 'combat', req);
      if (tuneTient(corrige, ordre)) justesse++;
      else ok(false, `scénario ${s} : la proposition ${JSON.stringify(req)} ne fait pas tenir le tune`);

      // P2 : chaque valeur proposée est la plus petite qui tienne.
      let serre = true;
      for (const r of req) {
        if (r.requis == null) continue;
        const moins = appliquer(monstres, 'combat', [
          ...req.filter((x) => x.id !== r.id),
          { id: r.id, requis: r.requis - 1 },
        ]);
        if (tuneTient(moins, ordre)) {
          serre = false;
          ok(false, `scénario ${s} : ${r.id} tient encore à ${r.requis - 1}, ${r.requis} est de trop`);
        }
      }
      if (serre) minimalite++;
    }
    ok(
      justesse > 0 && justesse === solubles,
      `P1 — la proposition fait tenir le tune sans que personne ne double le premier (${justesse} scénarios)`
    );
    ok(
      minimalite === solubles,
      `P2 — aucune valeur proposée n'est surévaluée d'un seul point (${minimalite} scénarios)`
    );
    ok(
      complets === horsPortee,
      `P3 — « hors de portée » confirmé par le balayage exhaustif à ordre constant (${horsPortee} scénarios)`
    );
  }

  // ⚠️ **LE SOLVEUR EST FIGÉ À TROIS ALLIÉS.** Ce cas-là est validé : la méthode
  // à la main et le solveur tombent d'accord (P4), et ces cinq compos en
  // rendent les chiffres EXACTS. Toute évolution qui les déplace doit échouer
  // ici et être justifiée — c'est le contrat, pas une simple photo.
  {
    const b = (id: string, combat: number, camp: 'allie' | 'ennemi', sort?: EffetSort): TuneMonstre => ({
      id,
      combat,
      camp,
      ...(sort ? { sort } : {}),
    });
    const figes: [string, TuneMonstre[], Record<string, number | null>][] = [
      [
        'booster + 2, adverse rapide',
        [
          b('booster', 300, 'allie', { atbEquipe: 30 }),
          b('a2', 220, 'allie'),
          b('a3', 150, 'allie'),
          b('e1', 240, 'ennemi'),
          b('e2', 200, 'ennemi'),
        ],
        { a3: 179 },
      ],
      [
        'booster + 2, un seul adverse',
        [
          b('booster', 280, 'allie', { atbEquipe: 40 }),
          b('a2', 200, 'allie'),
          b('a3', 120, 'allie'),
          b('e1', 230, 'ennemi'),
        ],
        { a3: 159 },
      ],
      [
        // Les trois finissent à la même vitesse : ils sont prêts au même tick et
        // FONT LA QUEUE, un par tick, devant un adverse de même vitesse.
        'sans boost, le dernier fait la queue',
        [
          b('a1', 260, 'allie'),
          b('a2', 170, 'allie'),
          b('a3', 165, 'allie'),
          b('e1', 250, 'ennemi'),
        ],
        { a2: 250, a3: 250 },
      ],
      [
        'buff de vitesse d’équipe',
        [
          b('a1', 270, 'allie', { buffEquipe: 30 }),
          b('a2', 210, 'allie'),
          b('a3', 140, 'allie'),
          b('e1', 245, 'ennemi'),
        ],
        { a2: 235, a3: 228 },
      ],
      [
        // Le premier joue APRÈS l'adverse et sa vitesse est intouchable : il n'y
        // a rien à proposer à personne, et le dire est la seule réponse juste.
        'premier trop lent : rien à faire',
        [
          b('a1', 150, 'allie'),
          b('a2', 140, 'allie'),
          b('a3', 130, 'allie'),
          b('e1', 400, 'ennemi'),
        ],
        { a1: null, a2: null, a3: null },
      ],
    ];

    for (const [nom, equipe, attendu] of figes) {
      const obtenu = Object.fromEntries(
        vitessesRequises(equipe).map((r) => [r.id, r.combatRequis])
      );
      egal(JSON.stringify(obtenu), JSON.stringify(attendu), `figé — ${nom}`);
      // ⚠️ Et le chiffre figé DOIT marcher : un contrat qui n'est plus qu'une
      // photo ne protège de rien.
      if (Object.values(attendu).every((v) => v !== null)) {
        const corrige = equipe.map((m) =>
          attendu[m.id] != null ? { ...m, combat: attendu[m.id]! } : m
        );
        ok(diagnostiquerChaine(corrige).ok, `figé — ${nom} : appliqué, le tune tient`);
      }
    }
  }

  // P4 — LA MÉTHODE À LA MAIN (algo-verify). La meilleure référence de contrôle
  // n'est pas une variante du code : c'est la façon dont un joueur règle un tune
  // à la main, décrite telle quelle et rejouée par BALAYAGE LINÉAIRE.
  //
  //   1. la vitesse du 1er est une donnée (le meilleur Swift du compte) ;
  //   2. les intermédiaires ne sont pas le point limitant : on les « colle »
  //      devant, chacun à la plus grande vitesse qui ne double pas celui d'avant ;
  //   3. on cherche alors à quelle vitesse le DERNIER doit être pour que la
  //      chaîne tienne — c'est lui qui décide ;
  //   4. on redescend les intermédiaires au minimum, du dernier vers l'avant : un
  //      seul monstre joue par tick, il suffit que chacun soit entre celui qui le
  //      précède et celui qui le suit.
  //
  // ⚠️ Vérifié à TROIS **et à QUATRE** alliés : à trois, il n'y a qu'un
  // intermédiaire à recaser et la méthode ne peut pas se tromper d'ordre ; à
  // quatre, il y en a deux, et c'est là que le solveur pourrait diverger.
  {
    const aLaMain = (monstres: TuneMonstre[], ordre: string[]): number | null => {
      const p1 = ordre[0];
      const dernier = ordre[ordre.length - 1];
      const vitesse = (ms: TuneMonstre[], id: string) => ms.find((m) => m.id === id)!.combat;
      const poser = (ms: TuneMonstre[], id: string, v: number) =>
        ms.map((m) => (m.id === id ? { ...m, combat: v } : m));
      const tickDe = (ms: TuneMonstre[], id: string) =>
        premiersTours(simuler(ms)).find((a) => a.id === id)?.tick ?? Infinity;
      // ⚠️ Le joueur applique cette règle sans l'écrire : personne ne double
      // celui qui ouvre, sinon les boostés jouent AVANT le boost.
      const premierTient = (ms: TuneMonstre[]) => ordreAlliesRef(ms)[0] === p1;

      let etat = monstres.map((m) => ({ ...m }));
      // 2. Les intermédiaires collés devant.
      for (let i = 1; i < ordre.length - 1; i++) {
        let colle = vitesse(etat, ordre[i]);
        for (let v = colle; v <= COMBAT_MAX; v++) {
          etat = poser(etat, ordre[i], v);
          if (tickDe(etat, ordre[i]) <= tickDe(etat, ordre[i - 1])) break;
          colle = v;
        }
        etat = poser(etat, ordre[i], colle);
      }
      // 3. La vitesse du dernier — c'est lui qui décide.
      let trouve = false;
      for (let v = vitesse(etat, dernier); v <= COMBAT_MAX; v++) {
        etat = poser(etat, dernier, v);
        if (!premierTient(etat)) break; // au-delà il double le premier
        if (diagnostiquerChaine(etat).ok) {
          trouve = true;
          break;
        }
      }
      if (!trouve) return null;
      // 4. Les intermédiaires redescendus au minimum, du dernier vers l'avant.
      for (let i = ordre.length - 2; i >= 1; i--) {
        let bas = vitesse(etat, ordre[i]);
        for (let v = bas; v >= 1; v--) {
          etat = poser(etat, ordre[i], v);
          if (!diagnostiquerChaine(etat).ok) break;
          bas = v;
        }
        etat = poser(etat, ordre[i], bas);
      }
      return ordre.reduce((t, id) => t + Math.max(0, vitesse(etat, id) - vitesse(monstres, id)), 0);
    };

    for (const nbAllies of [3, 4]) {
      let identiques = 0;
      let compares = 0;
      const scenarios = 120;
      for (let s = 0; s < scenarios; s++) {
        const rng = mulberry32(4200 + s * 131 + nbAllies * 7919);
        const monstres: TuneMonstre[] = [];
        for (let i = 0; i < nbAllies; i++) {
          const mm: TuneMonstre = {
            id: `allie${i}`,
            combat: 120 + Math.floor(rng() * 200),
            camp: 'allie',
          };
          if (rng() < 0.5) mm.sort = { atbEquipe: 10 + Math.floor(rng() * 40) };
          monstres.push(mm);
        }
        for (let i = 0; i < 1 + Math.floor(rng() * 2); i++) {
          monstres.push({ id: `ennemi${i}`, combat: 150 + Math.floor(rng() * 200), camp: 'ennemi' });
        }
        if (diagnostiquerChaine(monstres).ok) continue;
        const ordre = ordreAlliesRef(monstres);
        if (ordre.length !== nbAllies) continue;

        const coutMain = aLaMain(monstres, ordre);
        if (coutMain === null) continue; // la main non plus n'y arrive pas

        const sol = vitessesRequises(monstres);
        const bredouille = sol.some((r) => r.combatRequis === null);
        const coutSolveur = sol.reduce(
          (t, r) => t + (r.combatRequis == null ? 0 : r.combatRequis - r.combatActuel),
          0
        );
        compares++;
        // ⚠️ **On compare le COÛT, pas le chiffre au point près.** La méthode à
        // la main redescend jusqu'au premier refus ; le domaine n'étant pas un
        // intervalle, elle s'arrête parfois un cran trop haut. Le solveur a le
        // droit d'être MEILLEUR — jamais moins bon, et jamais bredouille là où
        // la main trouve.
        if (!bredouille && coutSolveur <= coutMain) identiques++;
        else if (bredouille)
          ok(
            false,
            `${nbAllies} alliés, scénario ${s} : « hors de portée » alors que la main trouve (${coutMain} points)`
          );
        else
          ok(
            false,
            `${nbAllies} alliés, scénario ${s} : solveur ${coutSolveur} points, à la main ${coutMain}`
          );
      }
      ok(
        compares > 0 && identiques === compares,
        `P4 — à ${nbAllies} alliés, le solveur fait aussi bien ou mieux que la méthode à la main, jamais bredouille (${compares} équipes)`
      );
    }
  }
}

/* --------------------------------------- Kit : détection automatique ----- */

// Ce que l'outil lit tout seul dans le kit d'un monstre (public/data/skills) :
// remplissage de barre de ZONE et buff de vitesse de ZONE. L'utilisateur n'a pas
// à aller chercher lui-même — d'où l'importance de ne retenir QUE ce qui touche
// tout le camp.
export function testSpeedTuneKit() {
  titre('Speed tuning — lecture du kit');

  const effet = (nom: string, quantite: number, aoe: boolean, surSoi = false): EffetCompetence =>
    ({
      nom,
      type: 'Neutral',
      bonus: true,
      description: null,
      icone: null,
      chance: 0,
      quantite,
      surSoi,
      aoe,
      surCritique: false,
      surMort: false,
      note: null,
    }) as EffetCompetence;

  const comp = (
    nom: string,
    effets: EffetCompetence[],
    passif = false,
    ameliorations: string[] = []
  ): Competence =>
    ({
      id: 1,
      com2usId: null,
      nom,
      description: null,
      slot: 2,
      passif,
      aoe: true,
      cooldown: null,
      coups: 1,
      niveauMax: 5,
      formule: null,
      scale: [],
      ameliorations,
      icone: null,
      effets,
    }) as Competence;

  const detail = (competences: Competence[]): DetailMonstre =>
    ({
      com2usId: 1,
      archetype: null,
      skillUpsToMax: null,
      awakensFrom: null,
      awakensTo: null,
      source: [],
      competences,
    }) as DetailMonstre;

  // ⚠️⚠️ **`aoe` ET `surSoi` NE S'EXCLUENT PAS.** `aoe + surSoi` veut dire « tout
  // le camp, LUI COMPRIS » — c'est la forme NORMALE d'un boost d'équipe, pas un
  // boost sur soi. Le cas de terrain : le S3 de Jeogun (« Blossom Painting »),
  // « increases the Attack Power of all allies for 2 turns and their Attack Bar
  // by 10% », porte les deux drapeaux. Tester `surSoi` d'abord le rangeait dans
  // « lui seul » : le reste de l'équipe ne recevait rien.
  {
    const blossom = comp('Blossom Painting', [
      effet('Increase ATB', 10, true, true),
      effet('Increase ATK', 2, true, true),
    ]);
    const [sort] = sortsVitesse(detail([blossom]));
    egal(
      JSON.stringify(sort.effet),
      JSON.stringify({ atbEquipe: 10 }),
      'de zone + sur soi = TOUT LE CAMP, lui compris (et non « lui seul »)'
    );
    egal(sort.buffsEquipe, 2, 'les deux buffs de zone sont comptés, `surSoi` ou non');
    egal(kitVitesse(detail([blossom])).atb, 10, 'et le kit le retient comme boost d’équipe');

    // Les deux autres cibles restent distinctes — c'est tout l'intérêt.
    egal(
      JSON.stringify(sortsVitesse(detail([comp('Sur soi', [effet('Increase ATB', 30, false, true)])]))[0].effet),
      JSON.stringify({ atbSoi: 30 }),
      'sans zone, `surSoi` reste « lui seul »'
    );
    egal(
      JSON.stringify(sortsVitesse(detail([comp('Un allié', [effet('Increase ATB', 30, false, false)])]))[0].effet),
      JSON.stringify({ atbAllie: 30 }),
      'ni zone ni soi = UN allié (Breeze de Kroa)'
    );
    // Même règle pour le buff de vitesse, qu'aucune donnée ne déclenche
    // aujourd'hui — mais la logique était la même, donc le défaut aussi.
    egal(
      JSON.stringify(sortsVitesse(detail([comp('Buff', [effet('Increase ATK SPD', 0, true, true)])]))[0].effet),
      JSON.stringify({ buffEquipe: BUFF_SPD_JEU }),
      'un buff de vitesse de zone vaut pour le camp, `surSoi` ou non'
    );
  }


  egal(kitVitesse(null).atb, 0, 'aucune fiche → rien de détecté');

  // Barre d'attaque de zone : détectée, avec la compétence d'où elle vient.
  {
    const k = kitVitesse(detail([comp('Vent du changement', [effet('Increase ATB', 30, true)])]));
    egal(k.atb, 30, 'remplissage de barre de zone détecté');
    egal(k.atbCompetence, 'Vent du changement', 'la compétence source est nommée');
  }

  // ⚠️ Ce qui ne touche PAS tout le camp est écarté : le modèle applique l'effet
  // à toute l'équipe, un « remplit TA barre » la gonflerait en entier.
  {
    egal(
      kitVitesse(detail([comp('Lames', [effet('Increase ATB', 50, false, true)])])).atb,
      0,
      'un remplissage sur SOI est écarté'
    );
    egal(
      kitVitesse(detail([comp('Purifier', [effet('Increase ATB', 25, false)])])).atb,
      0,
      "un remplissage sur UN allié est écarté"
    );
    egal(
      kitVitesse(detail([comp('Hostilité', [effet('Increase ATB', 30, true)], true)])).atb,
      0,
      'une compétence PASSIVE est écartée (elle ne part pas au tour du monstre)'
    );
  }

  // Plusieurs compétences qui remplissent la barre : la plus forte l'emporte.
  {
    const k = kitVitesse(
      detail([
        comp('Petite', [effet('Increase ATB', 15, true)]),
        comp('Grosse', [effet('Increase ATB', 40, true)]),
      ])
    );
    egal(k.atb, 40, 'la plus forte des deux est retenue');
    egal(k.atbCompetence, 'Grosse', "et c'est bien elle qui est nommée");
  }

  // ⚠️ SKILL-UPS : la valeur de SWARFARM est celle du NIVEAU 1. Le Tailwind de
  // Bernard 2A remplit 30 % au niveau 1 et 45 % maxé (+5 puis +10) — c'est maxé
  // qu'on le joue, et l'écran doit dire que le chiffre le suppose.
  {
    const k = kitVitesse(
      detail([
        comp('Tailwind', [effet('Increase ATB', 30, true)], false, [
          'Attack Bar Recovery +5%',
          'Attack Bar Recovery +10%',
        ]),
      ])
    );
    egal(k.atb, 45, 'Tailwind maxé remplit 45 % de barre, pas 30');
    egal(k.atbNiveau1, 30, 'la valeur du niveau 1 reste lisible');
    egal(k.atbSkillUp, 15, "ce que les skill-ups ajoutent est isolé (pour l'annoncer à l'écran)");
  }

  // Une amélioration qui ne touche pas la barre ne change rien.
  {
    const k = kitVitesse(
      detail([comp('Vent', [effet('Increase ATB', 30, true)], false, ['Cooltime Turn -1', 'Damage +10%'])])
    );
    egal(k.atb, 30, 'les autres skill-ups (rechargement, dégâts) ne gonflent pas la barre');
    egal(k.atbSkillUp, 0, 'et rien à annoncer sur le skill-up');
  }

  // La LISTE des sorts (analyse poussée) : le même filtre, mais sans garder
  // seulement le plus fort — c'est à l'utilisateur de choisir ce qu'il lance.
  {
    const d = detail([
      comp('Petite', [effet('Increase ATB', 15, true)]),
      comp('Grosse', [effet('Increase ATB', 30, true)], false, ['Attack Bar Recovery +5%']),
      comp('Frappe', [effet('Increase ATB', 50, false, true)]),
      comp('Passive', [effet('Increase ATB', 40, true)], true),
      comp('Cri', [effet('Increase ATK SPD', 2, true)]),
    ]);
    const sorts = sortsVitesse(d);
    // ⚠️ TOUTES les compétences lançables sont proposées — même « Frappe », qui
    // ne remplit que SA barre : on doit pouvoir dire « à ce tour-là, il joue
    // ça ». Ce qui change, c'est la CIBLE de l'effet, pas la présence du sort.
    egal(
      sorts.map((x) => x.nom).join(', '),
      'Petite, Grosse, Frappe, Cri',
      'toutes les compétences non passives sont proposées'
    );
    egal(sorts[1].effet.atbEquipe, 35, 'la valeur proposée est celle de la compétence maxée');
    egal(sorts[2].effet.atbSoi, 50, 'un remplissage sur SOI est rangé comme tel, pas comme un boost de camp');
    egal(sorts[2].effet.atbEquipe, undefined, "et il ne compte pas pour l'équipe");
    egal(sorts[3].effet.buffEquipe, BUFF_SPD_JEU, 'le buff de vitesse figure dans la liste');
    egal(sortsVitesse(null).length, 0, 'aucune fiche → aucun sort à proposer');
  }

  // Buff de vitesse : les données ne donnent que sa DURÉE, la valeur du jeu vaut.
  {
    const k = kitVitesse(detail([comp('Cri du prédateur', [effet('Increase ATK SPD', 2, true)])]));
    egal(k.buff, BUFF_SPD_JEU, 'buff de vitesse de zone → +30 % (valeur du jeu)');
    egal(k.buffCompetence, 'Cri du prédateur', 'la compétence source est nommée');
  }
}

/* ------------------------------------------ Séquence imposée (analyse+) --- */

// Un combo construit demande un ORDRE précis, pas seulement « tout le monde
// avant l'adverse ». Conséquence : un monstre peut devoir être RALENTI pour
// laisser passer celui qui doit jouer avant lui — d'où des FENÊTRES de vitesse.
export function testSpeedTuneSequence() {
  titre('Speed tuning — ordre imposé');

  const m = (id: string, combat: number, camp: 'allie' | 'ennemi'): TuneMonstre => ({ id, combat, camp });

  // L'ordre voulu est celui que donnent les vitesses : rien à signaler.
  {
    const monstres = [m('a', 300, 'allie'), m('b', 200, 'allie'), m('c', 150, 'allie')];
    const d = diagnostiquerSequence(monstres, ['a', 'b', 'c']);
    ok(d.ok, "l'ordre demandé est celui qui sort de la simulation");
    egal(d.problemes.length, 0, 'aucun problème à signaler');
  }

  // Ordre inversé demandé : les deux fautifs sont nommés, avec le sens de l'erreur.
  {
    const monstres = [m('a', 300, 'allie'), m('b', 200, 'allie')];
    const d = diagnostiquerSequence(monstres, ['b', 'a']);
    ok(!d.ok, 'un ordre que les vitesses ne produisent pas est signalé');
    egal(d.problemes.find((p) => p.id === 'a')?.raison, 'trop-tot', 'le rapide joue trop tôt');
    egal(d.problemes.find((p) => p.id === 'b')?.raison, 'trop-tard', 'le lent joue trop tard');
  }

  // Passer après l'adverse prime sur l'ordre interne : l'ordre ne sert plus.
  {
    const monstres = [m('a', 300, 'allie'), m('lent', 120, 'allie'), m('e', 250, 'ennemi')];
    const d = diagnostiquerSequence(monstres, ['a', 'lent']);
    egal(d.problemes.find((p) => p.id === 'lent')?.raison, 'apres-adverse', "coupé par l'adverse d'abord");
  }

  // ⚠️ Le cas qui n'existait pas dans l'analyse simple : pour tenir le SECOND
  // rang, il faut être assez rapide ET assez lent. La fenêtre le dit.
  {
    const monstres = [m('a', 300, 'allie'), m('b', 200, 'allie'), m('c', 150, 'allie')];
    const f = fenetresRequises(monstres, ['a', 'b', 'c']).find((x) => x.id === 'b')!;
    ok(f.ok, 'à 200, il tient déjà son rang');
    ok(f.min != null && f.max != null, 'sa fenêtre a bien deux bornes');
    ok(f.min! <= 200 && 200 <= f.max!, 'sa vitesse actuelle est dans la fenêtre');
    // Les bornes sont les bonnes : un cran de plus ou de moins casse l'ordre.
    const avec = (v: number) => monstres.map((x) => (x.id === 'b' ? { ...x, combat: v } : x));
    ok(!diagnostiquerSequence(avec(f.max! + 1), ['a', 'b', 'c']).ok, 'un point de plus et il passe devant a');
    ok(!diagnostiquerSequence(avec(f.min! - 1), ['a', 'b', 'c']).ok, 'un point de moins et c le double');
  }

  // TEST DIFFÉRENTIEL (algo-verify) : les deux bornes trouvées par dichotomie
  // valent celles d'un BALAYAGE EXHAUSTIF, et l'ensemble des vitesses valides
  // est bien un INTERVALLE — c'est l'hypothèse qui autorise la dichotomie.
  {
    let identiques = 0;
    let intervalles = 0;
    const scenarios = 12;
    for (let s = 0; s < scenarios; s++) {
      const rng = mulberry32(4200 + s * 61);
      const monstres: TuneMonstre[] = [];
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const mm: TuneMonstre = { id: `a${i}`, combat: 90 + Math.floor(rng() * 260), camp: 'allie' };
        if (rng() < 0.3) mm.sort = { atbEquipe: 10 + Math.floor(rng() * 30) };
        monstres.push(mm);
      }
      if (rng() < 0.7) monstres.push({ id: 'e', combat: 100 + Math.floor(rng() * 250), camp: 'ennemi' });
      // Ordre voulu : un mélange déterministe des alliés.
      const ordre = monstres.filter((x) => x.camp === 'allie').map((x) => x.id);
      for (let i = ordre.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
      }

      for (const f of fenetresRequises(monstres, ordre)) {
        // Balayage exhaustif : toutes les vitesses où CE monstre tient son rang,
        // les autres inchangés. Pas plus fin que la dichotomie, juste bête.
        const valides: number[] = [];
        for (let v = 1; v <= COMBAT_MAX; v++) {
          const essai = monstres.map((x) => (x.id === f.id ? { ...x, combat: v } : x));
          const d = diagnostiquerSequence(essai, ordre);
          if (!d.problemes.some((p) => p.id === f.id)) valides.push(v);
        }
        const contigu = valides.every((v, i) => i === 0 || v === valides[i - 1] + 1);
        if (contigu) intervalles++;
        else ok(false, `scénario ${s} / ${f.id} : les vitesses valides ne forment pas un intervalle`);
        if (valides.length === 0) {
          // Aucune vitesse ne convient : la fenêtre doit être VIDE (bornes
          // croisées ou absentes), jamais un intervalle qu'on proposerait à tort.
          const vide = f.min == null || f.max == null || f.min > f.max;
          if (vide) identiques++;
          else ok(false, `scénario ${s} / ${f.id} : fenêtre proposée alors qu'aucune vitesse ne convient`);
          continue;
        }
        const attendu = [valides[0], valides[valides.length - 1]];
        if (f.min === attendu[0] && f.max === attendu[1]) identiques++;
        else
          ok(
            false,
            `scénario ${s} / ${f.id} : fenêtre ${JSON.stringify([f.min, f.max])} ≠ balayage ${JSON.stringify(attendu)}`
          );
      }
    }
    ok(intervalles > 0 && identiques > 0, `${intervalles} fenêtres contrôlées au balayage exhaustif (seed fixe)`);
  }
}

/* ------------------------------------------- Passifs (lecture + gain) ---- */

// Ce qu'un passif fait à la vitesse, lu dans le texte de la compétence. Les cas
// sont ceux relevés avec l'utilisateur : ce sont eux qui ont corrigé la lecture.
export function testSpeedTunePassif() {
  titre('Speed tuning — passifs de vitesse');

  const passif = (nom: string, description: string, effets: string[] = []): DetailMonstre =>
    ({
      com2usId: 1,
      archetype: null,
      skillUpsToMax: null,
      awakensFrom: null,
      awakensTo: null,
      source: [],
      competences: [
        {
          id: 1,
          com2usId: null,
          nom,
          description,
          slot: 3,
          passif: true,
          aoe: false,
          cooldown: null,
          coups: null,
          niveauMax: 1,
          formule: null,
          scale: [],
          ameliorations: [],
          icone: null,
          effets: effets.map((n) => ({
            nom: n,
            type: 'Neutral',
            bonus: true,
            description: null,
            icone: null,
            chance: 0,
            quantite: 0,
            surSoi: true,
            aoe: false,
            surCritique: false,
            surMort: false,
            note: null,
          })),
        },
      ],
    }) as unknown as DetailMonstre;

  // Shumar : un gain PERMANENT, la seule catégorie réglable une fois pour toutes.
  {
    const [p] = passifsVitesse(
      passif('Spurt (Passive)', 'Increases the attack speed by 15. The attack speed increases as the HP decreases.')
    );
    egal(p.gain?.valeur, 15, 'Shumar : +15 de vitesse');
    egal(p.gain?.parCumul, false, 'et ce gain ne dépend de rien : il est permanent');
    egal(pointsDeGain(p.gain, 115, 0), 15, 'appliqué tel quel, sans cumul à compter');
  }

  // Elsharion : +5 par buff allié, plafonné à 100.
  {
    const [p] = passifsVitesse(
      passif(
        'Master of Magic Power (Passive)',
        'Also increases your Attack Power by 30% for each beneficial effect you are granted with, and increases your Attack Speed by 5 for each beneficial effect granted on the allies, up to 100.'
      )
    );
    egal(p.gain?.valeur, 5, 'Elsharion : +5 par buff allié');
    egal(p.gain?.plafond, 100, 'plafonné à 100');
    egal(pointsDeGain(p.gain, 100, 6), 30, 'six buffs → +30');
    egal(pointsDeGain(p.gain, 100, 40), 100, "et jamais plus que le plafond");
  }

  // Misty : le montant se dit dans l'AUTRE sens (« is increased by 15% »).
  {
    const [p] = passifsVitesse(
      passif(
        'Long Waiting (Passive)',
        "Becomes immune against inability effects. Your Attack Speed is increased by 15%, up to 150%, whenever an enemy's turn ends.",
        ['Accumulate SPD']
      )
    );
    egal(p.gain?.valeur, 15, 'Misty : +15 % par tour adverse');
    egal(p.gain?.pourcent, true, 'en pourcentage');
    egal(p.gain?.plafond, 150, 'plafonné à 150 %');
    // ⚠️ Un pourcentage se compte sur la vitesse de BASE, comme le totem.
    egal(pointsDeGain(p.gain, 100, 2), 30, 'base 100, deux tours adverses → +30');
  }

  // Ciri : « decreases » parle des PV de la cible, pas de la vitesse.
  {
    const [p] = passifsVitesse(
      passif(
        'Flash Step (Passive)',
        "After attacking the enemy on your turn, attacks 2 more times to deal damage that increases as the target's HP status decreases and increases your Attack Speed by 50 each, up to 250."
      )
    );
    egal(p.gain?.valeur, 50, "Ciri : +50 par attaque, malgré le « decreases » de la phrase");
    egal(p.gain?.plafond, 250, 'plafonné à 250');
  }

  // Juno : une DURÉE sans montant → c'est le BUFF du jeu, pas un gain propre.
  {
    const [p] = passifsVitesse(
      passif(
        'Loss of Cause and Effect (Passive)',
        'Increases your Attack Speed for 2 turns if you get a harmful effect.',
        ['Increase ATK SPD']
      )
    );
    egal(p.buff, true, 'Juno : le passif pose le buff de vitesse du jeu');
    egal(p.gain, null, "et surtout PAS un gain propre — l'artéfact l'amplifie, lui");
  }

  // Chilling : rien dans les données, mais un relevé de terrain.
  {
    const [p] = passifsVitesse(
      passif(
        'The Cunning (Passive)',
        'Your Attack Speed increases according to the number of beneficial effects currently on you.',
        ['Increase ATK SPD']
      )
    );
    egal(p.gain?.valeur, 20, 'Chilling : +20 par buff, relevé en jeu');
    egal(p.gain?.releve, true, 'et marqué comme relevé, pas comme donnée');
  }

  // Miriam : elle n'accélère personne, elle AMPLIFIE les buffs que son camp
  // reçoit — le même levier que l'artéfact « spd buff effect ».
  {
    const [p] = passifsVitesse(
      passif(
        "Blacksmith's Technique (Passive)",
        'Increases the increasing effects of Attack Power, Defense and Attack Speed that allies receive by 35%. The same skill effects do not stack with each other.'
      )
    );
    egal(p.amplifieBuff?.valeur, 35, "Miriam : +35 % d'effet de buff");
    egal(p.amplifieBuff?.equipe, true, "et c'est pour tout le camp, pas pour elle seule");
    egal(p.gain, null, "ce n'est PAS un gain de vitesse : elle ne va pas plus vite");
  }

  // Leshen : une baisse sur l'ADVERSE n'est pas un gain.
  {
    const [p] = passifsVitesse(
      passif('Root Prison (Passive)', "Decreases the stunned enemy's Attack Speed by 90%.")
    );
    egal(p?.gain ?? null, null, "un ralenti posé sur l'adverse n'est pas un gain de vitesse");
  }

  // Un monstre sans passif de vitesse ne remonte rien.
  egal(passifsVitesse(passif('Bouclier (Passive)', 'Creates a shield.')).length, 0, 'aucun passif de vitesse → rien');
  egal(passifsVitesse(null).length, 0, 'aucune fiche → rien');
}

/* ------------------------------------- Analyse automatique (partagée) ---- */

// ⚠️ Le siège et l'outil doivent répondre EXACTEMENT la même chose sur la même
// équipe : c'est cette fonction qu'ils partagent. Ce qui est vérifié ici, c'est
// l'enchaînement des étapes — vitesse (Swift + passif), amplification d'équipe,
// sort du kit, adversaire de référence, et le verdict qui en sort.
export function testSpeedTuneAuto() {
  titre('Speed tuning — analyse automatique partagée');

  const monstre = (id: number, nom: string, spd: number): Monster =>
    ({ id, com2usId: id, name: nom, stats: { speed: spd } }) as unknown as Monster;

  const vide: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };

  // Sans kit ni passif : la vitesse de combat est celle de speed.ts, et le plus
  // rapide sert de référence.
  {
    const equipe: EntreeAuto[] = [
      { id: 'a', monster: monstre(1, 'Adriana', 111), runeSpeed: 228, swift: true },
      { id: 'b', monster: monstre(2, 'Sonia', 119), runeSpeed: 203, swift: true },
    ];
    const r = analyseAutomatique(equipe, 28, vide);
    egal(r.combats.get('a'), 387, 'Adriana : 387 (Swift compris)');
    egal(r.combats.get('b'), 373, 'Sonia : 373');
    egal(r.reference?.id, 'a', 'le plus rapide sert de référence');
    // La référence étant une COPIE du plus rapide, elle joue avant les autres :
    // toute l'équipe ne peut pas passer devant elle.
    ok(!r.verdict.ok, "on ne devance pas une copie de son propre plus rapide");
    ok(r.requis.length > 0, 'et l’outil dit ce qu’il manque');
  }

  // ⚠️ **UN ADVERSE QUI COUPE DÉCALE TOUT — l'analyse doit le voir.** Elle ne
  // recevait que les alliés : elle les plaçait donc sur un plateau où personne
  // n'occupait de tick en face. Dès qu'un adverse en prenait un, tous les tours
  // alliés glissaient d'un cran à l'écran, et ce que l'analyse avait écrit dans
  // les grilles ne tombait plus au tick SUIVANT le lanceur mais sur son tour
  // même. Règle : un sort lancé au tick 4 est actif au tick 5, pour tout le camp.
  {
    const sort = (effet: Record<string, number>, nom: string) => ({
      nom,
      slot: 3,
      icone: null,
      effet,
      rejoue: false,
      cooldown: 0,
      atbNiveau1: 0,
      atbSkillUp: 0,
      chance: null,
      neutre: false,
      buffsEquipe: 1,
    });

    for (const [libelle, effet, grille] of [
      ['buff de vitesse', { buffEquipe: 30 }, 'speedMod'],
      ['boost de barre', { atbEquipe: 30 }, 'atbMod'],
    ] as const) {
      const donnees: DonneesKit = {
        kits: new Map(),
        sorts: new Map([[100, [sort(effet, libelle)]]]),
        passifs: new Map(),
      };
      // L'adverse est assez rapide pour prendre un tick AVANT le lanceur.
      const plateau: EntreeAuto[] = [
        { id: 'allie:100', monster: monstre(100, 'Lanceur', 111), runeSpeed: 170, camp: 'allie' },
        { id: 'allie:2', monster: monstre(2, 'Lent', 100), runeSpeed: 90, camp: 'allie' },
        { id: 'ennemi:9', monster: monstre(9, 'Coupeur', 120), runeSpeed: 180, camp: 'ennemi' },
      ];
      const r = analyseAutomatique(plateau, 0, donnees);

      // Le plateau tel que l'ÉCRAN le rejoue : les grilles écrites, aucun effet
      // de sort rappliqué (c'est le contrat de `tuneDe`).
      const affichage: TuneMonstre[] = plateau.map((e) => ({
        id: e.id,
        combat: r.combats.get(e.id)!,
        camp: e.camp!,
        atbMod: r.mods.get(e.id)?.atbMod,
        speedMod: r.mods.get(e.id)?.speedMod,
      }));
      const tours = premiersTours(simuler(affichage));
      const tCoupeur = tours.find((a) => a.id === 'ennemi:9')?.tick ?? 0;
      const tLanceur = tours.find((a) => a.id === 'allie:100')!.tick;
      ok(tCoupeur < tLanceur, `${libelle} : l'adverse coupe bien avant le lanceur (t${tCoupeur} < t${tLanceur})`);

      const pose = Object.keys(
        (grille === 'speedMod' ? r.mods.get('allie:2')!.speedMod : r.mods.get('allie:2')!.atbMod) as Record<string, number>
      )
        .map(Number)
        .sort((a, b) => a - b)[0];
      egal(
        pose - tLanceur,
        1,
        `${libelle} : actif au tick SUIVANT le tour du lanceur (lanceur t${tLanceur}, effet t${pose})`
      );
    }

    // ⚠️ **Rien n'est écrit dans les grilles d'un adverse RÉEL.** L'analyse n'y
    // pose rien — il ne lance pas son kit —, et lui renvoyer une grille vide
    // effacerait ce que l'utilisateur y a saisi à la main.
    {
      const donnees: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
      const plateau: EntreeAuto[] = [
        { id: 'allie:1', monster: monstre(1, 'Allié', 110), runeSpeed: 150, camp: 'allie' },
        {
          id: 'ennemi:9',
          monster: monstre(9, 'Adverse', 120),
          runeSpeed: 150,
          camp: 'ennemi',
          atbMod: { 3: 40 },
        },
      ];
      const r = analyseAutomatique(plateau, 0, donnees);
      egal(r.mods.has('ennemi:9'), false, 'aucune grille rendue pour un adverse réel');
      // Et sa saisie est bien PRISE EN COMPTE : elle avance son tour.
      const sans = analyseAutomatique(
        plateau.map((e) => ({ ...e, atbMod: undefined })),
        0,
        donnees
      );
      const tourAdverse = (x: typeof r) =>
        x.verdict.coupeur?.tick ?? Infinity;
      ok(
        tourAdverse(r) < tourAdverse(sans),
        `la barre saisie à la main sur l'adverse avance son tour (t${tourAdverse(r)} contre t${tourAdverse(sans)})`
      );
    }
  }

  // ⚠️ **« Aucun sort » est un CHOIX, pas l'absence de choix.** Le cas Kroa : son
  // premier sort lui rend son tour, et le kit lui donne d'office un second sort
  // qui remplit la barre d'un allié. Dire « Aucun sort » pour ce second tour
  // EFFAÇAIT le choix au lieu de l'enregistrer — et le kit rappliquait son
  // boost, exactement ce qu'on venait d'écarter. Choisir un AUTRE sort marchait,
  // ce qui rendait le défaut d'autant plus retors.
  {
    const kroa = monstre(30002, 'Kroa', 120);
    const lent = monstre(30003, 'Lent', 100);
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map([
        [
          30002,
          [
            {
              nom: "Owl's Hoot",
              slot: 2,
              icone: null,
              effet: {},
              rejoue: true,
              cooldown: 0,
              atbNiveau1: 0,
              atbSkillUp: 0,
              chance: null,
              neutre: false,
              buffsEquipe: 0,
            },
            {
              nom: 'Breeze',
              slot: 1,
              icone: null,
              effet: { atbAllie: 15 },
              rejoue: false,
              cooldown: 0,
              atbNiveau1: 0,
              atbSkillUp: 0,
              chance: null,
              neutre: false,
              buffsEquipe: 0,
            },
          ],
        ],
      ]),
      passifs: new Map(),
    };
    const equipe: EntreeAuto[] = [
      { id: 'allie:30002', monster: kroa, runeSpeed: 180 },
      { id: 'allie:30003', monster: lent, runeSpeed: 60 },
    ];
    // Ce que le second tour de Kroa pose sur son camp, tick par tick.
    const boostPose = (choix: ChoixSorts | undefined) => {
      const r = analyseAutomatique(equipe, 0, donnees, { choix });
      return JSON.stringify(r.mods.get('allie:30003')?.atbMod ?? {});
    };

    const dOffice = boostPose(undefined);
    ok(dOffice !== '{}', "d'office, le second sort du kit remplit bien la barre de l'allié");

    // ⚠️ Le cœur du test : le choix ENREGISTRÉ par l'écran, tel que le hook
    // l'écrit — pas une main posée à la main dans le bon format.
    const apresClic = noterChoix({}, 'allie:30002', '');
    egal(
      JSON.stringify(apresClic),
      '{"allie:30002":""}',
      '« Aucun sort » s’ENREGISTRE — l’effacer ferait retomber sur le sort du kit'
    );
    egal(boostPose({ sort2: apresClic }), '{}', 'et alors le boost du kit n’est plus appliqué');

    // L'autre convention, elle, efface bien : c'est « laisser le kit décider ».
    egal(
      JSON.stringify(noterChoix({ 'allie:30002': '' }, 'allie:30002', AUTO)),
      '{}',
      'AUTO retire l’entrée : le sort du kit reprend la main'
    );
    egal(
      boostPose({ sort2: noterChoix({ 'allie:30002': '' }, 'allie:30002', AUTO) }),
      dOffice,
      'et on retrouve exactement le comportement d’office'
    );
  }

  // Le PASSIF entre dans la vitesse — et il peut changer qui est le plus rapide.
  {
    const shumar: Monster = monstre(10615, 'Shumar', 115);
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map(),
      passifs: new Map([
        [
          10615,
          [
            {
              nom: 'Spurt (Passive)',
              texte: '',
              amplifieBuff: null,
              gain: { valeur: 15, pourcent: false, plafond: null, parCumul: false, releve: false },
              buff: false,
              barre: null,
              tourSupp: false,
              inconnu: false,
            },
          ],
        ],
      ]),
    };
    const equipe: EntreeAuto[] = [
      { id: 'shumar', monster: shumar, runeSpeed: 100 },
      { id: 'autre', monster: monstre(2, 'Autre', 115), runeSpeed: 108 },
    ];
    const sans = analyseAutomatique(equipe, 0, vide);
    const avec = analyseAutomatique(equipe, 0, donnees);
    egal(avec.combats.get('shumar')! - sans.combats.get('shumar')!, 15, 'le passif ajoute ses 15');
    egal(sans.reference?.id, 'autre', 'sans le passif, c’est l’autre le plus rapide');
    egal(avec.reference?.id, 'shumar', 'avec, Shumar passe devant et devient la référence');
  }

  // L'amplification d'un allié (Miriam) profite à TOUTE l'équipe, pas à la
  // référence — elle est en face.
  {
    const miriam = monstre(25812, 'Miriam', 103);
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map(),
      passifs: new Map([
        [
          25812,
          [
            {
              nom: "Blacksmith's Technique (Passive)",
              texte: '',
              amplifieBuff: { valeur: 35, equipe: true },
              gain: null,
              buff: false,
              barre: null,
              tourSupp: false,
              inconnu: false,
            },
          ],
        ],
      ]),
    };
    const equipe: EntreeAuto[] = [
      { id: 'miriam', monster: miriam, runeSpeed: 100 },
      { id: 'allie', monster: monstre(3, 'Allié', 100), runeSpeed: 120 },
    ];
    ok(
      analyseAutomatique(equipe, 0, donnees).verdict !== null,
      'une équipe avec Miriam se calcule sans erreur'
    );
    egal(
      analyseAutomatique(equipe, 0, donnees).combats.get('allie'),
      analyseAutomatique(equipe, 0, vide).combats.get('allie'),
      "l'amplification ne change AUCUNE vitesse de combat : elle amplifie un buff"
    );
  }

  // ⚠️ CHILLING : son passif compte les buffs qu'il PORTE. Deux sources se
  // connaissent d'avance — la Volonté (Immunité au premier tour) et les buffs de
  // zone que ses alliés lancent.
  {
    const chilling = monstre(20711, 'Chilling', 101);
    const donneur = monstre(30001, 'Donneur', 100);
    const donnees: DonneesKit = {
      kits: new Map([
        [30001, { atb: 0, atbCompetence: null, atbNiveau1: 0, atbSkillUp: 0, buff: 30, buffCompetence: 'Bouclier', rejoue: false }],
      ]),
      sorts: new Map([
        [
          30001,
          [
            {
              nom: 'Bouclier',
              slot: 3,
              icone: null,
              effet: { buffEquipe: 30 },
              rejoue: false,
              cooldown: 0,
              atbNiveau1: 0,
              atbSkillUp: 0,
              chance: null,
              neutre: false,
              // Un bouclier ET un buff de vitesse : DEUX buffs posés.
              buffsEquipe: 2,
            },
          ],
        ],
      ]),
      passifs: new Map([
        [
          20711,
          [
            {
              nom: 'The Cunning (Passive)',
              texte: '',
              amplifieBuff: null,
              gain: { valeur: 20, pourcent: false, plafond: null, parCumul: true, releve: true },
              buff: false,
              barre: null,
              tourSupp: false,
              inconnu: false,
            },
          ],
        ],
      ]),
    };

    const equipe: EntreeAuto[] = [
      { id: 'chilling', monster: chilling, runeSpeed: 100, sets: ['will'] },
      { id: 'donneur', monster: donneur, runeSpeed: 100 },
    ];
    egal(cumulsEstimes(equipe[0], equipe, donnees), 3, 'Volonté (1) + les deux buffs de son allié (2) → 3');

    // ⚠️ Le set BOUCLIER n'est pas personnel : un seul porteur, et TOUT LE MONDE
    // a un bouclier au premier tour — Volonté et Bouclier ne se comptent donc
    // pas de la même façon.
    const avecBouclier: EntreeAuto[] = [
      { ...equipe[0] },
      { ...equipe[1], sets: ['shield'] },
    ];
    egal(
      cumulsEstimes(avecBouclier[0], avecBouclier, donnees),
      4,
      'le bouclier de son allié compte AUSSI pour lui : 3 + 1'
    );
    egal(
      cumulsEstimes(avecBouclier[1], avecBouclier, donnees),
      1,
      "et le porteur du bouclier en profite lui-même, sans compter ses propres sorts"
    );
    egal(
      cumulsEstimes(equipe[1], equipe, donnees),
      0,
      "l'allié ne se compte pas ses propres buffs, et n'a pas de Volonté"
    );

    // Et ces buffs entrent dans sa vitesse : 3 × 20 = +60.
    const sansBuffs: EntreeAuto[] = [{ id: 'chilling', monster: chilling, runeSpeed: 100 }];
    const seul = analyseAutomatique(sansBuffs, 0, donnees).combats.get('chilling')!;
    const entoure = analyseAutomatique(equipe, 0, donnees).combats.get('chilling')!;
    egal(entoure - seul, 60, 'trois buffs portés → +60 de vitesse (Chilling)');

    // ⚠️ Un chiffre saisi n'est JAMAIS écrasé par l'estimation.
    const impose: EntreeAuto[] = [{ ...equipe[0], cumulsPassif: 1 }, equipe[1]];
    egal(
      analyseAutomatique(impose, 0, donnees).combats.get('chilling')! - seul,
      20,
      "un cumul saisi à la main l'emporte sur l'estimation"
    );
  }

  // ⚠️ QUEL SORT le monstre lance par défaut. La priorité se discute, des
  // coefficients inventés non : du plus large au plus étroit, et **jamais** un
  // sort qui vide la barre adverse ni un sort à taux de réussite.
  {
    const sorts = (liste: Partial<SortVitesse>[]): DonneesKit => ({
      kits: new Map(),
      passifs: new Map(),
      sorts: new Map([
        [
          1,
          liste.map((x) => ({
            nom: x.nom ?? '?',
            slot: null,
            icone: null,
            effet: x.effet ?? {},
            rejoue: x.rejoue ?? false,
            cooldown: 0,
            atbNiveau1: 0,
            atbSkillUp: 0,
            chance: x.chance ?? null,
            neutre: false,
            buffsEquipe: 0,
          })) as SortVitesse[],
        ],
      ]),
    });
    const e: EntreeAuto = { id: 'a', monster: monstre(1, 'Test', 100), runeSpeed: 0 };

    egal(
      sortRetenu(e, sorts([{ nom: 'Soi', effet: { buffSoi: 30 } }, { nom: 'Camp', effet: { atbEquipe: 30 } }]))?.nom,
      'Camp',
      "remplir la barre du camp passe avant se buffer soi-même"
    );
    egal(
      sortRetenu(e, sorts([{ nom: 'Rejoue', rejoue: true, effet: { buffSoi: 30 } }, { nom: 'UnAllie', effet: { atbAllie: 15 } }]))
        ?.nom,
      'Rejoue',
      'se rendre son tour passe avant remplir la barre d’un seul allié'
    );
    // ⚠️ Les deux exclusions, qui ont chacune fait mentir un verdict.
    egal(
      sortRetenu(e, sorts([{ nom: 'Videur', effet: { atbEnnemi: 50 } }])),
      null,
      "vider la barre adverse n'est JAMAIS retenu : l'équipe doit jouer d'affilée sans ça"
    );
    egal(
      sortRetenu(e, sorts([{ nom: 'Aleatoire', effet: { atbEquipe: 30 }, chance: 50 }])),
      null,
      "un sort à 50 % de chances n'est jamais retenu d'office"
    );

    // ⚠️ Le SECOND sort n'existe que si le PREMIER rend le tour, et n'est jamais
    // le même sort. Un sort de camp l'emporte sur un sort qui rejoue : dans ce
    // cas il n'y a pas de second tour, donc pas de second sort.
    const rejoueDabord = sorts([
      { nom: 'Rejoue', rejoue: true, effet: { buffSoi: 30 } },
      { nom: 'UnAllie', effet: { atbAllie: 15 } },
    ]);
    egal(sortRetenu(e, rejoueDabord)?.nom, 'Rejoue', 'le tour rendu est retenu en premier');
    egal(sortSecondRetenu(e, rejoueDabord)?.nom, 'UnAllie', 'et le second tour prend le suivant');

    const campDabord = sorts([
      { nom: 'Rejoue', rejoue: true, effet: { buffSoi: 30 } },
      { nom: 'Camp', effet: { atbEquipe: 30 } },
    ]);
    egal(sortRetenu(e, campDabord)?.nom, 'Camp', 'un sort de camp passe devant un tour rendu');
    egal(
      sortSecondRetenu(e, campDabord),
      null,
      "et sans tour rendu, il n'y a pas de second sort"
    );
  }

  // ⚠️ **Ce qui manque se lit dans l'ORDRE DE JEU**, pas dans celui des slots.
  // Une liste de problèmes rangée par slot oblige à reconstruire la chronologie
  // de tête pour comprendre qui coupe qui — alors que c'est la question posée.
  {
    // Trois alliés dans un ordre de slots qui n'est PAS leur ordre de jeu, et un
    // adverse assez rapide pour tous les couper.
    const equipe: TuneMonstre[] = [
      { id: 'lent', combat: 150, camp: 'allie' },
      { id: 'vif', combat: 260, camp: 'allie' },
      { id: 'moyen', combat: 200, camp: 'allie' },
      { id: 'adverse', combat: 1000, camp: 'ennemi' },
    ];
    egal(
      diagnostiquerChaine(equipe).coupes.map((c) => c.id),
      ['vif', 'moyen', 'lent'],
      'les coupés sortent du plus rapide au plus lent, pas dans l’ordre des slots'
    );
    egal(
      vitessesRequises(equipe).map((r) => r.id),
      ['vif', 'moyen', 'lent'],
      'et les vitesses requises suivent la même chronologie'
    );
    egal(
      artefactsRequis(equipe).map((r) => r.id),
      ['vif', 'moyen', 'lent'],
      'les artéfacts requis aussi — une seule règle pour toutes les listes'
    );
    // Celui qui n'agit pas du tout passe en DERNIER : il ne s'insère nulle part
    // dans la chronologie, et le mettre en tête le ferait passer pour le plus
    // rapide.
    const avecMuet: TuneMonstre[] = [
      { id: 'muet', combat: 1, camp: 'allie' },
      { id: 'vif', combat: 260, camp: 'allie' },
      { id: 'adverse', combat: 1000, camp: 'ennemi' },
    ];
    egal(
      diagnostiquerChaine(avecMuet).coupes.map((c) => c.id),
      ['vif', 'muet'],
      'celui qui n’agit pas ferme la marche'
    );
  }

  // ⚠️ **Ce qui est calculé doit pouvoir être MONTRÉ**, et un RETRAIT de barre
  // n'est jamais calculé : le tune se juge sans ce qu'on enlève à l'adverse,
  // même quand le sort est DÉSIGNÉ à la main. Les deux moitiés se tiennent — la
  // grille de la référence rend bien ses modificateurs (identifiant demandé
  // compris), et n'y montre aucun −40 parce qu'aucun −40 n'a été appliqué.
  {
    const videur = monstre(40001, 'Videur', 100);
    const lent = monstre(40002, 'Lent', 100);
    const sortVideur = {
      nom: 'Vide la barre',
      slot: 2,
      icone: null,
      effet: { atbEnnemi: 40 },
      rejoue: false,
      cooldown: 0,
      atbNiveau1: 0,
      atbSkillUp: 0,
      chance: null,
      neutre: false,
      buffsEquipe: 0,
    } as SortVitesse;
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map([[40001, [sortVideur]]]),
      passifs: new Map(),
    };
    const equipe: EntreeAuto[] = [
      { id: 'videur', monster: videur, runeSpeed: 200 },
      { id: 'lent', monster: lent, runeSpeed: 100 },
    ];
    // Le sort n'est pas retenu d'office (il vide une barre) : on le DÉSIGNE.
    const r = analyseAutomatique(equipe, 0, donnees, {
      choix: { sort: { videur: 'Vide la barre' } },
      idReference: 'monRef',
    });
    const modsRef = r.mods.get('monRef');
    ok(!!modsRef, "l'adversaire de référence porte l'identifiant demandé");
    ok(
      !Object.values(modsRef?.atbMod ?? {}).some((v) => v < 0),
      "et rien ne lui est retiré : le retrait de barre n'entre pas dans le tune, même désigné"
    );

    // ⚠️ Le cas qui a mordu : un sort qui fait les DEUX (Madeleine Cookie remplit
    // la barre du camp ET vide celle d'en face). On garde la moitié qui nous
    // fait jouer, on jette celle qui freine l'autre — sinon le tune tient grâce
    // au frein, et se coupe le jour où le frein rate.
    const mixte = { ...sortVideur, nom: 'Les deux', effet: { atbEquipe: 30, atbEnnemi: 40 } } as SortVitesse;
    const rMixte = analyseAutomatique(
      equipe,
      0,
      { kits: new Map(), sorts: new Map([[40001, [mixte]]]), passifs: new Map() },
      { idReference: 'monRef' }
    );
    ok(
      Object.values(rMixte.mods.get('lent')?.atbMod ?? {}).some((v) => v === 30),
      'le +30 % de barre du camp compte'
    );
    ok(
      !Object.values(rMixte.mods.get('monRef')?.atbMod ?? {}).some((v) => v < 0),
      "et le −40 % adverse du même sort ne compte pas"
    );

    // ⚠️ Mais ce que l'utilisateur POSE lui-même dans la grille reste : c'est une
    // saisie, pas une déduction — le moteur l'applique tel quel.
    const aLaMain = simuler([
      { id: 'a', combat: 200, camp: 'allie' },
      { id: 'b', combat: 200, camp: 'ennemi', atbMod: { 1: -50 } },
    ]);
    const barre = (id: string) => aLaMain.lignes.find((l) => l.id === id)!.trajectoire[0];
    ok(
      barre('b') < barre('a'),
      'un retrait écrit à la main dans la grille, lui, est bien appliqué'
    );
  }

  // Un sort DÉSIGNÉ l'emporte sur celui du kit.
  {
    const m1 = monstre(40010, 'Choix', 100);
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map([
        [
          40010,
          [
            { nom: 'Camp', effet: { atbEquipe: 30 } },
            { nom: 'Soi', effet: { atbSoi: 50 } },
          ].map((x) => ({
            ...x,
            slot: null,
            icone: null,
            rejoue: false,
            cooldown: 0,
            atbNiveau1: 0,
            atbSkillUp: 0,
            chance: null,
            neutre: false,
            buffsEquipe: 0,
          })) as SortVitesse[],
        ],
      ]),
      passifs: new Map(),
    };
    const equipe: EntreeAuto[] = [
      { id: 'a', monster: m1, runeSpeed: 200 },
      { id: 'b', monster: monstre(40011, 'Autre', 100), runeSpeed: 100 },
    ];
    const auto = analyseAutomatique(equipe, 0, donnees);
    const impose = analyseAutomatique(equipe, 0, donnees, { choix: { sort: { a: 'Soi' } } });
    ok(
      Object.keys(auto.mods.get('b')?.atbMod ?? {}).length > 0,
      "par défaut le sort de camp est lancé : son allié en profite"
    );
    egal(
      Object.keys(impose.mods.get('b')?.atbMod ?? {}).length,
      0,
      'le sort DÉSIGNÉ (sur soi) remplace celui du kit : son allié ne reçoit plus rien'
    );
  }

  // Une équipe vide ne casse rien, et ne pose pas de référence.
  {
    const r = analyseAutomatique([], 0, vide);
    egal(r.reference, null, 'aucune référence sans équipe');
    ok(r.verdict.ok, 'et rien à signaler');
  }
}

/* ------------------------------------- Modèle de l'écran (lignes) -------- */

// ⚠️ Ce que l'écran calculait AVANT dans le composant, donc sans filet. Les deux
// écarts entre le siège et l'outil venaient d'ici : un `TuneMonstre` construit
// deux fois, et une estimation de buffs qui ne voyait pas le bon camp.
export function testSpeedTuneModele() {
  titre('Speed tuning — modèle de l’écran');

  const monstre = (id: number, nom: string, spd: number): Monster =>
    ({ id, com2usId: id, name: nom, stats: { speed: spd } }) as unknown as Monster;
  const vide: DonneesKit = { kits: new Map(), sorts: new Map(), passifs: new Map() };
  const leads = { allie: 28, ennemi: 0 };

  // `uid = camp:id` : le même monstre peut tenir les deux camps.
  {
    const m = monstre(1, 'Bella', 100);
    egal(ligneVierge(m, 'allie').uid, 'allie:1', "l'identifiant porte le camp");
    egal(ligneVierge(m, 'ennemi').uid, 'ennemi:1', 'et le même monstre en face a le sien');
  }

  // ⚠️ **L'ORDRE DE L'ÉQUIPE DÉPARTAGE LES VITESSES ÉGALES** — et il est
  // modifiable. Deux monstres à la même vitesse de combat jouent dans l'ordre de
  // la liste : c'est le seul levier quand un réglage les fait finir à égalité,
  // et il était subi jusqu'ici.
  {
    const a = { ...ligneVierge(monstre(1, 'Premier', 100), 'allie'), runeSpeed: 100 };
    const b = { ...ligneVierge(monstre(2, 'Second', 100), 'allie'), runeSpeed: 100 };
    const face = { ...ligneVierge(monstre(3, 'Face', 60), 'ennemi'), runeSpeed: 0 };
    const sansLead = { allie: 0, ennemi: 0 };
    const qui = (l: Ligne[]) =>
      premiersTours(simuler(tuneDe(l, sansLead, vide, {}))).map((x) => x.id);

    egal(combatDeLigne(a, sansLead, vide), combatDeLigne(b, sansLead, vide), 'les deux ont EXACTEMENT la même vitesse de combat');
    egal(qui([a, b, face])[0], 'allie:1', 'à vitesse égale, le premier de la liste joue le premier');

    const permute = deplacerDansCamp([a, b, face], 'allie:2', -1);
    egal(qui(permute)[0], 'allie:2', 'monté d’un cran, c’est lui qui passe devant');
    egal(permute.map((l) => l.uid).join(' '), 'allie:2 allie:1 ennemi:3', 'seuls les deux voisins ont échangé leur place');

    // ⚠️ L'échange ne saute PAS par-dessus l'autre camp : on ne déplace un
    // monstre qu'au sein du sien.
    const melange = [a, face, b];
    egal(
      deplacerDansCamp(melange, 'allie:2', -1).map((l) => l.uid).join(' '),
      'allie:2 ennemi:3 allie:1',
      'le voisin est celui du MÊME camp, pas la ligne juste au-dessus'
    );

    // Au bout de la liste, rien ne bouge — c'est le bouton qui est désactivé,
    // pas la fonction qui invente un tour.
    egal(
      deplacerDansCamp([a, b, face], 'allie:1', -1).map((l) => l.uid).join(' '),
      'allie:1 allie:2 ennemi:3',
      'déjà en tête : la liste est rendue telle quelle'
    );
    egal(
      deplacerDansCamp([a, b, face], 'allie:2', 1).map((l) => l.uid).join(' '),
      'allie:1 allie:2 ennemi:3',
      'déjà en queue : idem'
    );
    egal(
      deplacerDansCamp([a, b, face], 'allie:404', -1).map((l) => l.uid).join(' '),
      'allie:1 allie:2 ennemi:3',
      'un uid inconnu ne casse rien'
    );
  }

  // Une case de grille : 0 est une VALEUR, seul `null` efface.
  {
    egal(JSON.stringify(majMod({}, 3, 40)), '{"3":40}', 'une valeur s’écrit');
    egal(JSON.stringify(majMod({ 3: 40 }, 3, 0)), '{"3":0}', '0 reste — il ANNULE le sort, il n’efface pas');
    egal(JSON.stringify(majMod({ 3: 40 }, 3, null)), '{}', 'seul le vide efface');
  }

  // ⚠️ L'entrée du moteur : un seul constructeur, et il n'oublie personne.
  {
    const miriam: Ligne = {
      ...ligneVierge(monstre(25812, 'Miriam', 103), 'allie'),
      runeSpeed: 100,
    };
    const allie: Ligne = { ...ligneVierge(monstre(2, 'Allié', 100), 'allie'), runeSpeed: 120 };
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map(),
      passifs: new Map([
        [
          25812,
          [
            {
              nom: 'Blacksmith',
              texte: '',
              amplifieBuff: { valeur: 35, equipe: true },
              gain: null,
              buff: false,
              barre: null,
              tourSupp: false,
              inconnu: false,
            },
          ],
        ],
      ]),
    };
    const lignes = [miriam, allie];
    egal(ampliDe(lignes, 'allie', donnees), 35, "l'amplification de Miriam vaut pour son camp");
    egal(ampliDe(lignes, 'ennemi', donnees), 0, "et pas pour l'autre");
    const tune = tuneDe(lignes, leads, donnees, {});
    egal(
      tune.every((m) => m.artefactBuff === 35),
      true,
      'TOUS les alliés la reçoivent dans l’entrée du moteur — la moitié seulement, et les deux écrans divergent'
    );
  }

  // Le plus rapide, et la référence qui le copie.
  {
    const lent: Ligne = { ...ligneVierge(monstre(3, 'Lent', 100), 'allie'), runeSpeed: 50 };
    const vif: Ligne = {
      ...ligneVierge(monstre(4, 'Vif', 100), 'allie'),
      runeSpeed: 150,
      swift: true,
      sets: ['swift', 'will'],
      artefactBuff: 12,
    };
    const lignes = [lent, vif];
    egal(plusRapideAllie(lignes, leads, vide)?.uid, 'allie:4', 'le plus rapide est repéré');
    const ref = ligneReference(vif, lignes, vide);
    egal(ref.camp, 'ennemi', 'la référence se pose en face');
    egal(ref.reference, true, 'et se signale comme telle');
    egal(ref.runeSpeed, 150, 'elle copie la vitesse de runes');
    egal(ref.artefactBuff, 12, "l'artéfact");
    egal(JSON.stringify(ref.sets), '["swift","will"]', 'et les sets — sans quoi elle serait plus lente que son modèle');
  }

  // ⚠️ **La référence court EXACTEMENT aussi vite que le monstre qu'elle copie**,
  // lead d'élément compris. C'est toute sa raison d'être : « est-ce que mon
  // équipe joue avant un monstre aussi rapide que mon plus rapide ? ». Un repère
  // plus lent que son modèle déclare tuné à peu près n'importe quoi — et c'est
  // ce qui arrivait quand le camp d'en face gardait son propre lead.
  {
    const eau = {
      id: 30,
      com2usId: 30,
      name: 'Ondine',
      element: 'water',
      stats: { speed: 100 },
    } as unknown as Monster;
    const modele: Ligne = { ...ligneVierge(eau, 'allie'), runeSpeed: 150 };
    const lead: LeadInfo = { amount: 33, area: 'Element', element: 'water' };
    const ref = ligneReference(modele, [modele], vide);

    // Le camp d'en face a repris MON lead (ce que fait l'analyse).
    egal(
      combatDeLigne(ref, lead, vide),
      combatDeLigne(modele, lead, vide),
      'même lead des deux côtés → la référence vaut son modèle'
    );
    // Et sans cela, elle est plus lente : le verdict serait faux dans le bon sens.
    ok(
      (combatDeLigne(ref, null, vide) ?? 0) < (combatDeLigne(modele, lead, vide) ?? 0),
      "sans reprendre le lead, elle traîne — et l'outil déclarerait tuné à tort"
    );
  }

  // Ce que l'analyse écrit atterrit bien sur les lignes.
  {
    const l: Ligne = ligneVierge(monstre(5, 'Cible', 100), 'allie');
    const mods = new Map([['allie:5', { atbMod: { 6: 45 }, speedMod: { 7: 30 } }]]);
    const [apres] = appliquerMods([l], mods);
    egal(JSON.stringify(apres.atbMod), '{"6":45}', 'la grille des barres reçoit ce qui a été calculé');
    egal(JSON.stringify(apres.speedMod), '{"7":30}', 'et celle des buffs aussi');
  }

  // Les sorts d'un camp s'en vont avec sa composition.
  {
    const choix = { 'allie:1': 'A', 'ennemi:2': 'B' };
    egal(JSON.stringify(oublierCamp(choix, 'allie')), '{"ennemi:2":"B"}', "l'import d'un deck oublie les sorts du camp");
  }

  // Une vitesse de combat inconnue (base absente) ne casse rien.
  {
    const sansBase: Ligne = ligneVierge({ id: 9, com2usId: 9, name: '?', stats: {} } as unknown as Monster, 'allie');
    egal(combatDeLigne(sansBase, 0, vide), null, 'pas de base → pas de vitesse, et surtout pas 0');
    egal(tuneDe([sansBase], leads, vide, {}).length, 0, 'il est écarté du moteur');
  }

  // L'estimation des buffs ne touche pas une case déjà remplie.
  {
    const chilling: Ligne = {
      ...ligneVierge(monstre(20711, 'Chilling', 101), 'allie'),
      runeSpeed: 100,
      sets: ['will'],
      cumulsPassif: 1,
    };
    const donnees: DonneesKit = {
      kits: new Map(),
      sorts: new Map(),
      passifs: new Map([
        [
          20711,
          [
            {
              nom: 'The Cunning',
              texte: '',
              amplifieBuff: null,
              gain: { valeur: 20, pourcent: false, plafond: null, parCumul: true, releve: true },
              buff: false,
              barre: null,
              tourSupp: false,
              inconnu: false,
            },
          ],
        ],
      ]),
    };
    egal(estimerCumuls([chilling], donnees)[0].cumulsPassif, 1, 'un compte saisi reste intact');
    const vierge = { ...chilling, cumulsPassif: undefined };
    egal(estimerCumuls([vierge], donnees)[0].cumulsPassif, 1, "une case jamais touchée reçoit l'estimation (Volonté)");
  }
}
