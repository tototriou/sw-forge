// Déduplication des formes TRANSFORMABLES (Bellenus, les Sœurs…).
//
// SWARFARM décrit ces monstres en DEUX entrées — forme de départ et forme
// transformée — de même nom, même élément, même icône. Affichées côte à côte,
// elles sont indistinguables : on ouvre l'une en croyant ouvrir l'autre.
//
// ⚠️ Le lien `transformsTo` est **bidirectionnel** (A → B et B → A) : il ne dit
// pas laquelle est « la vraie ». C'est la règle de départage qui le décide, et
// c'est elle que ces vérifications figent — une règle non déterministe ferait
// changer la fiche d'un rendu à l'autre.

import { Monster } from '../src/types';
import { sansDoublonDeTransformation } from '../src/lib/monsterForms';
import { egal, titre } from './outils';

function mon(p: Partial<Monster> & { name: string; com2usId: number }): Monster {
  return {
    id: p.com2usId,
    element: 'fire',
    stars: 6,
    naturalStars: 5,
    secondAwaken: false,
    stats: {},
    ...p,
  } as Monster;
}

const noms = (ms: Monster[]) => ms.map((m) => m.com2usId);

export default function testMonstreFormes() {
  titre('Monstres · formes transformables');

  // Bellenus, tel que l'API le décrit : deux entrées qui se pointent l'une
  // l'autre.
  const bellenusA = mon({ name: 'Bellenus', com2usId: 22212, swarfarmId: 1205, transformsTo: 1210 });
  const bellenusB = mon({ name: 'Bellenus', com2usId: 22312, swarfarmId: 1210, transformsTo: 1205 });

  egal(
    noms(sansDoublonDeTransformation([bellenusA, bellenusB])),
    [22212],
    'deux formes qui se pointent → une seule entrée, celle au com2usId le plus petit'
  );

  // ⚠️ L'ordre d'entrée ne doit RIEN changer : c'est le com2usId qui décide, pas
  // la position dans la liste.
  egal(
    noms(sansDoublonDeTransformation([bellenusB, bellenusA])),
    [22212],
    'le résultat ne dépend pas de l’ordre de la liste'
  );

  /* --- ce qui ne doit PAS être touché ------------------------------------ */

  const sansLien = [
    mon({ name: 'Chloe', com2usId: 19315, swarfarmId: 500 }),
    mon({ name: 'Tyron', com2usId: 14312, swarfarmId: 501 }),
  ];
  egal(
    noms(sansDoublonDeTransformation(sansLien)),
    [19315, 14312],
    'des monstres sans transformation passent tous, dans leur ordre'
  );

  // ⚠️ Cible ABSENTE de la liste : rien à dédupliquer. Le cas se produit dès
  // qu'un filtre a retiré l'autre forme — écarter quand même laisserait un trou
  // sans que rien ne l'explique.
  egal(
    noms(sansDoublonDeTransformation([bellenusB])),
    [22312],
    'forme seule (l’autre absente) → conservée, même si son com2usId est le plus grand'
  );

  /* --- un 2A n'est PAS une transformation -------------------------------- */

  // Les deux formes d'un 2A se distinguent (nom, icône, stats) : elles restent.
  const base = mon({ name: 'Seren', com2usId: 15311, swarfarmId: 600 });
  const deuxA = mon({ name: 'Seren', com2usId: 15331, swarfarmId: 601, secondAwaken: true });
  egal(
    noms(sansDoublonDeTransformation([base, deuxA])),
    [15311, 15331],
    'un second éveil n’est pas une transformation : les deux entrées restent'
  );

  /* --- données incomplètes ----------------------------------------------- */

  const sansSwarfarmId = mon({ name: 'X', com2usId: 999, transformsTo: 1210 });
  egal(
    noms(sansDoublonDeTransformation([sansSwarfarmId, bellenusA])),
    [999, 22212],
    'une cible qu’aucune entrée ne porte ne fait rien écarter'
  );

  // Un monstre perso (com2usId nul) n'a ni lien ni id : il traverse intact.
  const perso = { ...mon({ name: 'Perso', com2usId: 0 }), com2usId: null } as Monster;
  egal(
    sansDoublonDeTransformation([perso]).length,
    1,
    'un monstre perso (sans com2usId) est conservé'
  );
}
