// Speed tuning — règle des ticks et ordre de tour « un seul monstre par tick ».
// Fonctions pures de src/lib/speedTune.ts. Cas vérifiables à la main : la
// formule (combat × 7/100, action à 100) est simple, mais la règle « un par
// tick » décale les ex æquo, ce qui n'est PAS un simple tri par vitesse.

import { speedForTick, simulerOrdre, atbParTick, TuneMonstre } from '../src/lib/speedTune';
import { egal, ok, titre } from './outils';

export default function testSpeedTune() {
  titre('Speed tuning');

  // Règle des ticks : vitesse mini pour agir au tick n = ceil(10000/(7n)).
  // Repères connus des joueurs (siège) : 239 « Lent », 286 « Rapide ».
  egal(speedForTick(11), 130, 'tick 11 → 130');
  egal(speedForTick(10), 143, 'tick 10 → 143');
  egal(speedForTick(9), 159, 'tick 9 → 159');
  egal(speedForTick(8), 179, 'tick 8 → 179');
  egal(speedForTick(7), 205, 'tick 7 → 205');
  egal(speedForTick(6), 239, 'tick 6 → 239 (Lent)');
  egal(speedForTick(5), 286, 'tick 5 → 286 (Rapide)');
  egal(speedForTick(4), 358, 'tick 4 → 358');
  egal(speedForTick(3), 477, 'tick 3 → 477');

  egal(atbParTick(129), 9.03, 'combat 129 → 9,03 % par tick');

  const camp = (combat: number, camp: 'allie' | 'ennemi' = 'allie'): TuneMonstre => ({
    id: `${combat}-${camp}`,
    combat,
    camp,
  });

  // Deux vitesses franches, sans collision : chacun agit à son propre tick.
  {
    const o = simulerOrdre([camp(200), camp(100)]);
    egal(o.length, 2, 'deux monstres → deux tours');
    egal(o[0].combat, 200, 'le plus rapide joue en premier');
    egal(o[0].actTick, 8, 'combat 200 → agit au tick 8 (14 %/tick, 112 %)');
    egal(o[1].actTick, 15, 'combat 100 → agit au tick 15 (7 %/tick, 105 %)');
    egal(o[0].rang, 1, 'rang 1 au plus rapide');
    egal(o[1].rang, 2, 'rang 2 au plus lent');
  }

  // ⚠️ LE cas de la règle « un seul par tick » : trois monstres franchissent 100
  // au MÊME tick (9), mais prennent le tour l'un après l'autre (9, 10, 11) — un
  // simple tri par vitesse leur donnerait le même tick, ce qui est faux.
  {
    const o = simulerOrdre([camp(173), camp(172, 'ennemi'), camp(171)]);
    egal(
      o.map((e) => e.combat),
      [173, 172, 171],
      'ordre par vitesse quand tout se joue au même tick'
    );
    egal(
      o.map((e) => e.actTick),
      [9, 10, 11],
      'un seul par tick : les tours s\'échelonnent 9 / 10 / 11'
    );
    egal(o[1].camp, 'ennemi', 'le camp est conservé dans l\'ordre');
  }

  // Égalité PARFAITE de vitesse : l'ordre de placement départage (premier
  // ajouté = premier servi), et la règle « un par tick » les échelonne.
  {
    const o = simulerOrdre([camp(150), camp(150)]);
    egal(o[0].id, '150-allie', 'à vitesse égale, le premier placé passe');
    egal(o[0].actTick + 1, o[1].actTick, 'un par tick : le second attend le tick suivant');
  }

  // Vitesse nulle → n'agit jamais, exclu de l'ordre (pas de boucle infinie).
  {
    const o = simulerOrdre([camp(0), camp(120)]);
    egal(o.length, 1, 'un monstre à vitesse nulle est écarté de l\'ordre');
    egal(o[0].combat, 120, 'seul le monstre qui remplit sa barre reste');
  }

  ok(simulerOrdre([]).length === 0, 'aucun monstre → aucun tour, pas d\'erreur');
}
