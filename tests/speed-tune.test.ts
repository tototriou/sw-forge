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
  COMBAT_MAX,
  HORIZON_TICKS,
  TuneMonstre,
  Simulation,
  VitesseRequise,
} from '../src/lib/speedTune';
import { deckPourSpeedTune } from '../src/lib/speedTuneDeck';
import { Monster, SiegeTeam } from '../src/types';
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

  // Artéfact « augmente l'effet du buff de vitesse » : ADDITIF au buff, actif
  // seulement quand un buff est posé ce tick-là.
  {
    // buff +30 % au tick 1 + artéfact +20 % → vitesse ×1,50 → 10,5 %/tick au tick 1.
    const sim = simuler([
      { id: 'arte', combat: 100, camp: 'allie', speedMod: { 1: 30 }, artefactBuff: 20 },
    ]);
    egal(sim.lignes[0].trajectoire[0], 10.5, 'buff +30 % + artéfact +20 % → 10,5 au tick 1');
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

  const equipe = (slots: { monsterId: string | null; runeSpeed: number | null }[]): SiegeTeam =>
    ({
      id: 't',
      lead: 0,
      tickAlertDismissed: false,
      slots: slots.map((s) => ({ ...s, tick: 0, sets: [] })),
    }) as SiegeTeam;

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
    egal(d.lead, 24, 'un lead de guilde vaut pour tout le camp → appliqué');
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

  // ⚠️ Un lead d'ÉLÉMENT ne se transpose pas au modèle « un lead par camp ».
  {
    egal(
      deckPourSpeedTune(equipe([{ monsterId: '4', runeSpeed: 100 }]), parId).lead,
      null,
      'lead d\'élément → le camp garde son lead saisi'
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

// RÉFÉRENCE DE CONTRÔLE (algo-verify) : même raisonnement que
// `vitessesRequises`, mais la vitesse minimale se cherche par BALAYAGE LINÉAIRE
// exhaustif au lieu d'une dichotomie. Volontairement naïve et lente — elle
// définit « la bonne réponse » pour le test différentiel.
function vitessesRequisesNaif(monstres: TuneMonstre[], horizon = HORIZON_TICKS): VitesseRequise[] {
  const diag = diagnostiquerChaine(monstres, horizon);
  if (diag.ok || !diag.coupeur) return [];
  const courant = monstres.map((m) => ({ ...m }));
  const parId = new Map(courant.map((m) => [m.id, m]));
  const passeAvant = (id: string): boolean => {
    const premiers = premiersTours(simuler(courant, horizon));
    const adverse = premiers.find((a) => a.camp === 'ennemi');
    const mien = premiers.find((a) => a.id === id);
    if (!mien) return false;
    return !adverse || mien.tick < adverse.tick;
  };
  const aTraiter = diag.coupes
    .map((c) => parId.get(c.id))
    .filter((m): m is (typeof courant)[number] => !!m)
    .sort((a, b) => b.combat - a.combat);
  const out: VitesseRequise[] = [];
  for (const m of aTraiter) {
    const depart = m.combat;
    let trouve: number | null = null;
    for (let c = depart + 1; c <= COMBAT_MAX; c++) {
      m.combat = c;
      if (passeAvant(m.id)) {
        trouve = c;
        break;
      }
    }
    m.combat = trouve ?? depart;
    out.push({ id: m.id, combatActuel: depart, combatRequis: trouve });
  }
  return out;
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

  // TEST DIFFÉRENTIEL (algo-verify) : la dichotomie retrouve EXACTEMENT ce que
  // trouve le balayage linéaire exhaustif, sur des scénarios aléatoires à seed
  // fixe (alliés/adverses, vitesses, boosts d'ATB et buffs de vitesse).
  {
    let identiques = 0;
    const scenarios = 24;
    for (let s = 0; s < scenarios; s++) {
      const rng = mulberry32(7000 + s * 97);
      const nbAllies = 1 + Math.floor(rng() * 3);
      const nbEnnemis = 1 + Math.floor(rng() * 2);
      const monstres: TuneMonstre[] = [];
      const tirer = (camp: 'allie' | 'ennemi', i: number): TuneMonstre => {
        const combat = 80 + Math.floor(rng() * 320);
        const mm: TuneMonstre = { id: `${camp}${i}`, combat, camp };
        if (rng() < 0.3) mm.atbMod = { [1 + Math.floor(rng() * 4)]: Math.floor(rng() * 60) };
        if (rng() < 0.3) mm.speedMod = { [1 + Math.floor(rng() * 4)]: 30 };
        return mm;
      };
      for (let i = 0; i < nbAllies; i++) monstres.push(tirer('allie', i));
      for (let i = 0; i < nbEnnemis; i++) monstres.push(tirer('ennemi', i));
      const a = JSON.stringify(vitessesRequises(monstres));
      const b = JSON.stringify(vitessesRequisesNaif(monstres));
      if (a === b) identiques++;
      else ok(false, `scénario ${s} : dichotomie ${a} ≠ balayage exhaustif ${b}`);
    }
    ok(
      identiques === scenarios,
      `dichotomie identique au balayage linéaire exhaustif sur ${scenarios} scénarios aléatoires (seed fixe)`
    );
  }
}
