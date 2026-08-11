// Partage d'une prépa RTA : aller-retour export → consultation, et surtout la
// **traduction d'identifiants**.
//
// Pourquoi ces vérifications-là : une prépa se range par `monsterId` **local**,
// qui ne veut rien dire d'un joueur à l'autre. L'export traduit en `com2usId`,
// la consultation retraduit dans les ids du lecteur. Si cette traduction dérape,
// rien ne plante : les monstres s'affichent simplement **sur les mauvaises
// cartes**, les anneaux de catégorie se posent à côté, et personne ne sait dire
// pourquoi. C'est exactement le « grave et invisible » que ces tests couvrent
// (voir tests/README.md).
//
// Le second enjeu est le **choix d'export** : « sans mes runes » doit vraiment
// ne rien laisser filtrer de l'équipement — un oubli exposerait ce que
// l'utilisateur a explicitement demandé de cacher.

import {
  appliquer,
  comptePartageable,
  encodeSnapshot,
  toSnapshot,
  validateRtaImport,
  versVueAmi,
} from '../src/lib/rtaShare';
import { Monster, RtaState, RTA_OTHER, RTA_UNASSIGNED } from '../src/types';
import { RtaCategory } from '../src/hooks/useRtaCategories';
import { egal, ok, titre } from './outils';

// Deux bestiaires aux ids LOCAUX différents pour le même `com2usId` : c'est la
// situation réelle entre deux joueurs, et ce que le partage doit absorber.
function monstre(id: string, com2usId: number | null, name: string): Monster {
  return {
    id,
    com2usId,
    name,
    element: 'fire',
    stars: 5,
    naturalStars: 5,
    secondAwaken: false,
    image: null,
    stats: { hp: null, attack: null, defense: null, speed: 100, critRate: null, critDamage: null, resistance: null, accuracy: null },
    leaderSkill: null,
  };
}

const chezMoi = [
  monstre('1', 15214, 'Trevor'),
  monstre('2', 19315, 'Bella'),
  monstre('3', null, 'Mon monstre perso'), // non partageable
];

// Même monstres, autres ids locaux — le bestiaire du destinataire.
const chezLui = [monstre('900', 15214, 'Trevor'), monstre('901', 19315, 'Bella')];

const parId = (l: Monster[]) => new Map(l.map((m) => [String(m.id), m]));
const parCom2us = (l: Monster[]) =>
  new Map(l.filter((m) => m.com2usId != null).map((m) => [m.com2usId as number, m]));

export default function testRtaPartage() {
  titre('Partage d’une prépa RTA · traduction des identifiants');

  // Un équipement minimal mais COMPLET du point de vue du validateur : une rune
  // valide (slot, set, stat principale) survit à l'aller-retour, le reste non.
  const gearDeTrevor = {
    base: { hp: 10000, atk: 700, def: 600, spd: 107, cr: 15, cd: 50, res: 15, acc: 0 },
    runes: [
      {
        id: 42,
        slot: 2,
        set: 'swift',
        rank: 6,
        rarity: 5,
        level: 15,
        main: { code: 8, value: 40 },
        subs: [{ code: 8, value: 20, grind: 5 }],
      },
    ],
    artifacts: [
      {
        kind: 'element' as const,
        element: 'fire' as const,
        level: 12,
        rarity: 5,
        main: { code: 100, value: 300 },
        subs: [{ code: 300, value: 10 }],
      },
    ],
  };

  const state: RtaState = {
    sections: ['swift', 'violent', RTA_OTHER],
    entries: {
      '1': {
        monsterId: '1',
        section: 'swift',
        runeSpeed: 120,
        sets: ['swift', 'will'],
        gear: gearDeTrevor as any,
      },
      '2': { monsterId: '2', section: 'violent', runeSpeed: null },
      '3': { monsterId: '3', section: 'swift', runeSpeed: 90 },
    },
  };
  const categories: RtaCategory[] = [
    { id: 'c1', label: 'Striper', color: '#4ad8d8', members: ['1', '3'] },
  ];

  /* ---- Export ---------------------------------------------------------- */

  const snap = toSnapshot(state, categories, parId(chezMoi));

  egal(snap.entries.length, 2, 'le monstre perso (com2usId absent) n’est PAS exporté');
  egal(
    snap.entries.map((e) => e.com2usId).sort(),
    [15214, 19315],
    'les entrées portent le com2usId, jamais l’id local'
  );
  egal(
    comptePartageable(state, parId(chezMoi)),
    { partageables: 2, perso: 1 },
    'le décompte annonce le monstre perso écarté — l’export le dit à l’utilisateur'
  );
  egal(
    snap.categories[0].membres,
    [15214],
    'l’appartenance aux catégories est traduite en com2usId, le perso en est retiré'
  );

  ok(snap.avecEquipement, 'l’équipement est joint par défaut — c’est ce qu’on vient consulter');
  egal(
    snap.entries.find((e) => e.com2usId === 15214)?.gear?.runes.length,
    1,
    'les runes de l’auteur partent avec sa prépa'
  );

  /* ---- Consultation chez QUELQU'UN D'AUTRE ------------------------------ */

  const json = encodeSnapshot(snap);
  const rapport = validateRtaImport(json);
  ok(rapport.snapshot !== null, 'un export de SW Forge se relit sans erreur bloquante');
  egal(rapport.errors, [], 'aucune erreur sur un fichier produit par l’app');

  const vue = versVueAmi(rapport.snapshot!, parCom2us(chezLui));

  egal(
    vue.entries.map((e) => String(e.monster.id)).sort(),
    ['900', '901'],
    'les monstres sont résolus sur les ids LOCAUX du lecteur, pas ceux de l’auteur'
  );

  const trevor = vue.entries.find((e) => e.monster.com2usId === 15214)!;
  const bella = vue.entries.find((e) => e.monster.com2usId === 19315)!;
  egal(trevor.entry.section, 'swift', 'chacun retrouve sa section');
  egal(trevor.entry.runeSpeed, 120, 'la vitesse de runes suit');
  egal(bella.entry.runeSpeed, null, 'une vitesse non saisie reste vide (et non 0)');
  egal(trevor.entry.sets, ['swift', 'will'], 'les sets actifs suivent');
  egal(
    [...vue.categories[0].members],
    ['900'],
    'les catégories se reposent sur les bons monstres'
  );

  /* ---- L'équipement traverse le fichier intact -------------------------- */

  egal(trevor.entry.gear?.runes.length, 1, 'la rune de l’auteur est bien lue à l’arrivée');
  egal(trevor.entry.gear?.runes[0].set, 'swift', 'avec son set');
  egal(trevor.entry.gear?.runes[0].main, { code: 8, value: 40 }, 'et sa stat principale');
  egal(trevor.entry.gear?.runes[0].subs[0].grind, 5, 'la meule d’un substat n’est pas perdue');
  egal(trevor.entry.gear?.artifacts.length, 1, 'les artéfacts aussi');
  egal(trevor.entry.gear?.base.spd, 107, 'les stats de base de l’auteur suivent');
  ok(vue.avecEquipement, 'la vue sait qu’elle a des runes à montrer');

  /* ---- Export SANS équipement : rien ne doit filtrer -------------------- */

  // ⚠️ Ce que l'utilisateur a demandé de cacher doit VRAIMENT être absent du
  // fichier — pas seulement masqué à l'affichage.
  const sansRunes = toSnapshot(state, categories, parId(chezMoi), { avecEquipement: false });
  const jsonSansRunes = encodeSnapshot(sansRunes);

  ok(!jsonSansRunes.includes('"equipement"'), 'aucun équipement dans le fichier');
  ok(!jsonSansRunes.includes('"runes"'), 'aucune rune, pas même une clé vide');
  // ⚠️ Relu depuis le JSON, pas cherché à la ficelle dans le texte : le fichier
  // est indenté, donc un `includes('"swift","will"')` ne peut JAMAIS échouer —
  // il rassurerait à tort pendant que les sets fuient.
  const relu = JSON.parse(jsonSansRunes) as { monstres: { sets?: string[]; equipement?: unknown }[] };
  ok(
    relu.monstres.every((m) => m.sets === undefined),
    'les SETS ne filtrent pas non plus — ils trahiraient le runage'
  );
  ok(
    relu.monstres.every((m) => m.equipement === undefined),
    'ni l’équipement, sur aucun monstre'
  );
  ok(jsonSansRunes.includes('"vitesse": 120'), 'mais la vitesse visée, elle, est bien partagée');

  const vueSansRunes = versVueAmi(validateRtaImport(jsonSansRunes).snapshot!, parCom2us(chezLui));
  ok(!vueSansRunes.avecEquipement, 'la consultation annonce qu’il n’y a pas de runes à voir');
  egal(
    vueSansRunes.entries.find((e) => e.monster.com2usId === 15214)?.entry.gear,
    undefined,
    'et aucun équipement n’arrive chez le lecteur'
  );
  egal(vueSansRunes.entries.length, 2, 'le classement, lui, reste entièrement consultable');

  /* ---- Reprendre une prépa à soi (archive, autre navigateur) ------------- */

  // Même fichier, autre intention : `appliquer` en fait un état utilisable,
  // là où `versVueAmi` se contente de l'afficher.
  const repris = appliquer(rapport.snapshot!, parCom2us(chezLui), { sections: [], entries: {} });
  egal(
    Object.keys(repris.state.entries).sort(),
    ['900', '901'],
    'la prépa reprise est rangée sur MES ids locaux'
  );
  egal(repris.state.entries['900'].section, 'swift', 'avec ses sections');
  egal(repris.categories[0].members, ['900'], 'et ses catégories');
  egal(
    repris.state.entries['900'].gear?.runes.length,
    1,
    'un monstre que je n’ai pas encore reçoit l’équipement du fichier'
  );

  // ⚠️ Le point qui compte pour une VIEILLE sauvegarde : mes runes
  // d'aujourd'hui sont plus justes que celles figées dans le fichier.
  const mesRunesActuelles: RtaState = {
    sections: [],
    entries: {
      '900': {
        monsterId: '900',
        section: RTA_UNASSIGNED,
        runeSpeed: 55,
        gear: { base: { spd: 999 }, runes: [], artifacts: [] } as any,
      },
    },
  };
  const fusion = appliquer(rapport.snapshot!, parCom2us(chezLui), mesRunesActuelles);
  egal(
    fusion.state.entries['900'].gear?.base.spd,
    999,
    'mon équipement actuel prime sur celui figé dans une vieille sauvegarde'
  );
  egal(
    fusion.state.entries['900'].section,
    'swift',
    'mais le classement du fichier, lui, s’applique bien — c’est ce qu’on vient reprendre'
  );

  /* ---- Monstre inconnu du lecteur --------------------------------------- */

  const partiel = versVueAmi(rapport.snapshot!, parCom2us([chezLui[0]]));
  egal(partiel.inconnus, [19315], 'un monstre absent des données est remonté, pas avalé en silence');
  egal(partiel.entries.length, 1, 'et il n’est pas affiché');

  titre('Partage d’une prépa RTA · fichiers douteux');

  /* ---- Refus d'un fichier d'un AUTRE type -------------------------------- */

  // ⚠️ Bloquant, et non simple avertissement : lire un fichier d'un autre type
  // « au mieux » afficherait une prépa vide sans dire pourquoi.
  const autreExport = JSON.stringify({
    format: 'sw-forge/recommandations',
    version: 4,
    recommandations: [],
  });
  const refus = validateRtaImport(autreExport);
  egal(refus.snapshot, null, 'un export de recommandations est REFUSÉ, pas lu de travers');
  ok(refus.errors.length > 0, 'et le refus est expliqué');

  ok(validateRtaImport('').errors.length > 0, 'contenu vide refusé');
  ok(validateRtaImport('pas du json').errors.length > 0, 'contenu non-JSON refusé avec un message clair');
  ok(
    validateRtaImport('{"format":"sw-forge/prepa-rta","monstres":[]}').snapshot === null,
    'un fichier sans aucun monstre exploitable est refusé'
  );

  /* ---- Corrections signalées, jamais silencieuses ------------------------ */

  const bricole = validateRtaImport(
    JSON.stringify({
      format: 'sw-forge/prepa-rta',
      version: 1,
      sections: ['swift', 'inconnu'],
      monstres: [
        { com2usId: 15214, nom: 'Trevor', section: 'section_qui_nexiste_pas', vitesse: 120 },
        { com2usId: 15214, nom: 'Trevor en double', section: 'swift', vitesse: 130 },
        { com2usId: 'pas un id', nom: 'Cassé', section: 'swift' },
        { com2usId: 19315, nom: 'Bella', section: 'violent', vitesse: -5 },
      ],
    })
  );

  ok(bricole.snapshot !== null, 'un fichier partiellement fautif est lu quand même');
  egal(bricole.counts.monstres, 2, 'le doublon et l’entrée sans id valide sont écartés');
  egal(
    bricole.snapshot!.entries.find((e) => e.com2usId === 15214)?.section,
    RTA_UNASSIGNED,
    'une section inconnue range en « Non classé » plutôt que de perdre le monstre'
  );
  egal(
    bricole.snapshot!.entries.find((e) => e.com2usId === 19315)?.runeSpeed,
    null,
    'une vitesse négative est refusée, le monstre est gardé'
  );
  ok(bricole.warnings.length >= 3, 'chaque correction est REMONTÉE à l’utilisateur');
  ok(
    bricole.snapshot!.sections.includes(RTA_OTHER),
    '« Autre » est garantie présente, comme partout ailleurs dans l’app'
  );

  /* ---- Équipement bricolé : trié, jamais avalé tel quel ------------------ */

  // L'équipement vient d'un tiers et sert à DESSINER une roue de runes : une
  // rune sans slot valide ou sans stat principale ferait un trou à l'affichage.
  const gearDouteux = validateRtaImport(
    JSON.stringify({
      format: 'sw-forge/prepa-rta',
      version: 2,
      monstres: [
        {
          com2usId: 15214,
          nom: 'Trevor',
          section: 'swift',
          vitesse: 120,
          equipement: {
            base: { spd: 107 },
            runes: [
              { slot: 2, set: 'swift', main: { code: 8, value: 40 }, subs: [] }, // valide
              { slot: 9, set: 'swift', main: { code: 8, value: 40 } }, // slot hors 1..6
              { slot: 3, set: 'pas_un_set', main: { code: 8, value: 40 } }, // set inconnu
              { slot: 4, set: 'swift' }, // sans stat principale
            ],
            artifacts: [],
          },
        },
      ],
    })
  );

  const runesLues = gearDouteux.snapshot!.entries[0].gear?.runes;
  egal(runesLues?.length, 1, 'seule la rune valide est gardée — les trois autres sont écartées');
  egal(runesLues?.[0].slot, 2, 'et c’est bien la bonne');
  egal(
    gearDouteux.snapshot!.entries[0].gear?.base.atk,
    0,
    'une stat de base absente vaut 0, elle ne rend pas tout l’équipement illisible'
  );

  const gearVide = validateRtaImport(
    JSON.stringify({
      format: 'sw-forge/prepa-rta',
      monstres: [
        { com2usId: 15214, nom: 'Trevor', section: 'swift', equipement: { runes: [], artifacts: [] } },
      ],
    })
  );
  egal(
    gearVide.snapshot!.entries[0].gear,
    undefined,
    'un équipement entièrement vide n’est pas retenu — il ouvrirait un détail vide'
  );
  ok(
    !gearVide.snapshot!.avecEquipement,
    'et la prépa n’annonce pas des runes qu’elle n’a pas'
  );

  /* ---- Une section utilisée est toujours affichable ---------------------- */

  const sectionOrpheline = validateRtaImport(
    JSON.stringify({
      format: 'sw-forge/prepa-rta',
      sections: [], // l'auteur a bricolé le fichier et vidé la liste
      monstres: [{ com2usId: 15214, nom: 'Trevor', section: 'despair', vitesse: 100 }],
    })
  );
  ok(
    sectionOrpheline.snapshot!.sections.includes('despair'),
    'une section utilisée par un monstre est recréée — sinon le monstre serait invisible'
  );
}
