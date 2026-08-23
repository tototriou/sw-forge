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

  // Boost de barre d'attaque : un +30 % ponctuel au tick 3 fait agir plus tôt
  // (7×3 + 30 = 51 au tick 3 → 100 au tick 10, contre 15 sans boost).
  {
    const o = simulerOrdre([camp(100), { id: 'boost', combat: 100, camp: 'allie', atbMod: { 3: 30 } }]);
    egal(o[0].id, 'boost', 'le boost d\'ATB fait agir plus tôt');
    egal(o[0].actTick, 10, 'combat 100 + boost 30 % au tick 3 → agit au tick 10');
    egal(o[1].actTick, 15, 'sans boost, l\'autre agit toujours au tick 15');
    // La trajectoire reflète le saut au tick 3 : 14 → 21 → 51.
    egal(o[0].trajectoire[2], 51, 'la trajectoire montre le saut de barre au tick 3');
  }

  // Réduction de barre d'attaque : un −50 % au tick 2 vide la barre sans
  // jamais la rendre NÉGATIVE (14 − 50 → 0), ce qui retarde l'action.
  {
    const o = simulerOrdre([{ id: 'reduc', combat: 100, camp: 'allie', atbMod: { 2: -50 } }]);
    egal(o[0].trajectoire[1], 0, 'la barre tombe à 0 au tick 2, pas en négatif');
    egal(o[0].actTick, 17, 'après remise à 0 au tick 2, il faut jusqu\'au tick 17');
  }

  // Buff de vitesse SOUTENU : posé au tick 1, +30 % de vitesse jusqu'au bout.
  // 100 × 1,3 = 130 de vitesse effective → 9,1 %/tick → agit au tick 11 (vs 15).
  {
    const o = simulerOrdre([camp(100), { id: 'buff', combat: 100, camp: 'allie', speedMod: { 1: 30 } }]);
    egal(o[0].id, 'buff', 'le buff de vitesse fait agir plus tôt');
    egal(o[0].actTick, 11, 'combat 100 buffé +30 % dès le tick 1 → agit au tick 11');
  }

  // Buff posé PLUS TARD : rien avant le tick 5, puis +30 % soutenu.
  // ticks 1-4 : 7/tick (28). tick 5+ : 9,1/tick. 28 + 9,1×8 = 100,8 → tick 12.
  {
    const o = simulerOrdre([{ id: 'tardif', combat: 100, camp: 'allie', speedMod: { 5: 30 } }]);
    egal(o[0].actTick, 12, 'buff posé au tick 5 : effet seulement à partir de là');
  }

  // Vitesse nulle → n'agit jamais, exclu de l'ordre (pas de boucle infinie).
  {
    const o = simulerOrdre([camp(0), camp(120)]);
    egal(o.length, 1, 'un monstre à vitesse nulle est écarté de l\'ordre');
    egal(o[0].combat, 120, 'seul le monstre qui remplit sa barre reste');
  }

  ok(simulerOrdre([]).length === 0, 'aucun monstre → aucun tour, pas d\'erreur');
}
