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
  TuneMonstre,
  Simulation,
} from '../src/lib/speedTune';
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
