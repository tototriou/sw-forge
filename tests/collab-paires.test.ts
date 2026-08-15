// Monstres de COLLABORATION et leur équivalent SW.
//
// SWARFARM ne dit nulle part que Satoru Gojo est Werner : la relation est
// DÉDUITE d'une signature (stats + lead + compétences). Une déduction se trompe
// silencieusement — elle apparie deux monstres sans rapport, ou en manque un —
// et rien dans l'interface ne le signalerait. D'où ces vérifications.

import { apparierCollabs, libelleCollab } from '../src/lib/collabPairs';
import { Monster } from '../src/types';
import { jumeauDeCollab, sansDoublonDeCollab } from '../src/lib/monsterForms';
import { egal, ok, titre } from './outils';

function cand(com2usId: number, name: string, signature: string, image = `img-${name}`) {
  return { com2usId, name, image, signature };
}

function mon(p: Partial<Monster> & { com2usId: number; name: string }): Monster {
  return {
    id: String(p.com2usId),
    element: 'water',
    secondAwaken: false,
    naturalStars: 5,
    stars: 6,
    image: null,
    stats: {},
    leaderSkill: null,
    ...p,
  } as Monster;
}

export default function testCollabPaires() {
  titre('Paires de collaboration');

  egal(
    apparierCollabs([cand(1, 'Gojo', 'S'), cand(2, 'Werner', 'S')]),
    [{ a: 1, b: 2 }],
    'deux monstres de même signature forment une paire'
  );

  egal(
    apparierCollabs([cand(1, 'Gojo', 'S'), cand(2, 'Werner', 'AUTRE')]),
    [],
    'des signatures différentes ne s’apparient pas'
  );

  // ⚠️ Le cas qui a imposé la déduplication par image : SWARFARM liste deux fois
  // Nezuko (familles 319 et 320, portrait identique). Sans elle, le groupe
  // comptait trois entrées et devenait ambigu.
  egal(
    apparierCollabs([
      cand(1, 'Nezuko', 'S', 'nezuko.png'),
      cand(2, 'Nezuko', 'S', 'nezuko.png'),
      cand(3, 'Vermilion', 'S', 'vermilion.png'),
    ]),
    [{ a: 1, b: 3 }],
    'deux entrées du même portrait comptent pour un seul monstre'
  );

  // ⚠️ On préfère ne rien affirmer plutôt qu’apparier au hasard.
  egal(
    apparierCollabs([
      cand(1, 'A', 'S', 'a.png'),
      cand(2, 'B', 'S', 'b.png'),
      cand(3, 'C', 'S', 'c.png'),
    ]),
    [],
    'trois portraits distincts de même signature : aucune paire'
  );

  // ⚠️ L'ordre doit être STABLE : sinon la moitié affichée à gauche changerait
  // d'une génération à l'autre.
  egal(
    apparierCollabs([cand(9, 'Werner', 'S'), cand(4, 'Gojo', 'S')]),
    [{ a: 4, b: 9 }],
    'la paire est ordonnée par com2usId, quel que soit l’ordre d’entrée'
  );

  titre('Libellé d’une paire');

  egal(libelleCollab('Satoru Gojo', 'Werner'), 'Satoru Gojo, Werner', 'les deux noms, virgule');
  // ⚠️ Vendhan et Dyeus portent le MÊME nom des deux côtés : « Vendhan, Vendhan »
  // se lirait comme un bug d'affichage.
  egal(libelleCollab('Vendhan', 'Vendhan'), 'Vendhan', 'un nom identique n’est pas répété');

  titre('Déduplication des paires de collaboration');

  const gojo = mon({ com2usId: 30311, name: 'Satoru Gojo', jumeauCollab: 30911 });
  const werner = mon({ com2usId: 30911, name: 'Werner', jumeauCollab: 30311 });

  const gardes = sansDoublonDeCollab([gojo, werner]);
  egal(gardes.length, 1, 'une paire n’occupe qu’une carte');
  egal(gardes[0].com2usId, 30311, 'c’est le plus petit com2usId qui reste');

  // ⚠️ Le jumeau retiré par un filtre ne doit rien écarter : sinon la liste
  // aurait un trou que rien n'expliquerait.
  egal(
    sansDoublonDeCollab([werner]).length,
    1,
    'un jumeau absent de la liste n’écarte rien'
  );

  egal(
    jumeauDeCollab(gojo, [gojo, werner])?.name,
    'Werner',
    'le jumeau se résout dans les deux sens'
  );
  ok(jumeauDeCollab(gojo, [gojo]) === null, 'jumeau absent → null');

  const ordinaire = mon({ com2usId: 12311, name: 'Lushen' });
  ok(jumeauDeCollab(ordinaire, [ordinaire]) === null, 'un monstre sans collab n’a pas de jumeau');
  egal(
    sansDoublonDeCollab([ordinaire, gojo, werner]).length,
    2,
    'les monstres ordinaires ne sont pas touchés'
  );
}
