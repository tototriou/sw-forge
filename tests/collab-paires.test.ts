// Monstres de COLLABORATION et leur équivalent SW.
//
// Le lien est DONNÉ par l'API — un monstre dont le `skill_group_id` diffère de
// son `family_id` emprunte les compétences d'un autre. Mais ce champ recouvre
// trois relations distinctes (collab, second éveil, simple réutilisation de
// compétences), et seule la première doit fusionner deux cartes. Ces
// vérifications figent la façon de les départager.

import { apparierCollabs, libelleCollab } from '../src/lib/collabPairs';
import { Monster } from '../src/types';
import { jumeauDeCollab, sansDoublonDeCollab } from '../src/lib/monsterForms';
import { egal, ok, titre } from './outils';

// Profil par défaut : mêmes stats, même rareté — le cas d'un reskin.
const RESKIN = JSON.stringify([5, { hp: 10380 }]);

function cand(
  com2usId: number,
  familyId: number,
  skillGroupId: number,
  profil = RESKIN,
  suffixe = com2usId % 100
) {
  return { com2usId, familyId, skillGroupId, suffixe, profil };
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

  // Le cas de référence : Werner (famille 30900) porte le groupe de compétences
  // 30300, celui de Satoru Gojo.
  egal(
    apparierCollabs([cand(30311, 30300, 30300), cand(30911, 30900, 30300)]),
    [{ a: 30311, b: 30911 }],
    'deux familles qui partagent un groupe de compétences forment une paire'
  );

  egal(
    apparierCollabs([cand(30311, 30300, 30300), cand(30911, 30900, 30900)]),
    [],
    'des groupes de compétences différents ne s’apparient pas'
  );

  // ⚠️ Une famille porte cinq éléments : le Gojo eau doit trouver le Werner eau,
  // pas le Werner feu. Sans le suffixe, les dix entrées d'une collab se
  // retrouvaient dans un même sac.
  egal(
    apparierCollabs([
      cand(30311, 30300, 30300),
      cand(30312, 30300, 30300),
      cand(30911, 30900, 30300),
      cand(30912, 30900, 30300),
    ]),
    [
      { a: 30311, b: 30911 },
      { a: 30312, b: 30912 },
    ],
    'chaque élément s’apparie avec le sien'
  );

  // ⚠️ Un écart de +10 entre familles est un SECOND ÉVEIL (Elucia 2A, famille
  // 10110, groupe 10100) : même monstre à deux stades, pas une collab. Les
  // fusionner masquerait la 2A.
  egal(
    apparierCollabs([cand(10111, 10100, 10100), cand(10131, 10110, 10100, RESKIN, 11)]),
    [],
    'un second éveil n’est pas une collaboration'
  );

  // ⚠️ Partager un groupe de compétences ne suffit PAS : Fairy Queen emprunte
  // les compétences de Fairy, Vampire Lord celles de Vampire — sans partager
  // leurs stats. Une collab est un RESKIN, stats et rareté identiques.
  const autreProfil = JSON.stringify([3, { hp: 4000 }]);
  egal(
    apparierCollabs([cand(10103, 10100, 10100), cand(19104, 19100, 10100, autreProfil, 3)]),
    [],
    'un monstre qui emprunte des compétences sans les stats n’est pas une paire'
  );

  // ⚠️ Trois monstres dans un même groupe : on ne saurait pas qui apparier.
  egal(
    apparierCollabs([
      cand(30311, 30300, 30300),
      cand(30911, 30900, 30300),
      cand(31911, 31900, 30300),
    ]),
    [],
    'un groupe de trois n’apparie rien'
  );

  // ⚠️ L'ordre doit être STABLE : sinon la moitié affichée à gauche changerait
  // d'une génération à l'autre.
  egal(
    apparierCollabs([cand(30911, 30900, 30300), cand(30311, 30300, 30300)]),
    [{ a: 30311, b: 30911 }],
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
  egal(sansDoublonDeCollab([werner]).length, 1, 'un jumeau absent de la liste n’écarte rien');

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
