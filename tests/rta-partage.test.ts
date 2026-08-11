// Partage d'une prépa RTA : aller-retour export → import, et surtout la
// **traduction d'identifiants**.
//
// Pourquoi ces vérifications-là : une prépa se range par `monsterId` **local**,
// qui ne veut rien dire d'un joueur à l'autre. L'export traduit en `com2usId`,
// l'import retraduit dans les ids du destinataire. Si cette traduction dérape,
// rien ne plante : les monstres arrivent simplement **rangés sur les mauvaises
// cartes**, les anneaux de catégorie se posent à côté, et personne ne sait dire
// pourquoi. C'est exactement le « grave et invisible » que ces tests couvrent
// (voir tests/README.md).

import {
  appliquer,
  comptePartageable,
  encodeSnapshot,
  toSnapshot,
  validateRtaImport,
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

  const state: RtaState = {
    sections: ['swift', 'violent', RTA_OTHER],
    entries: {
      '1': { monsterId: '1', section: 'swift', runeSpeed: 120, gear: { base: {} } as any },
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

  const json = encodeSnapshot(snap);
  ok(!json.includes('"gear"'), "l’équipement n’est jamais transporté (ce sont les runes de l’auteur)");

  /* ---- Import chez QUELQU'UN D'AUTRE ------------------------------------ */

  const rapport = validateRtaImport(json);
  ok(rapport.snapshot !== null, 'un export de SW Forge se relit sans erreur bloquante');
  egal(rapport.errors, [], 'aucune erreur sur un fichier produit par l’app');

  const recu = appliquer(rapport.snapshot!, parCom2us(chezLui), { sections: [], entries: {} });

  egal(
    Object.keys(recu.state.entries).sort(),
    ['900', '901'],
    'les monstres sont rangés sur les ids LOCAUX du destinataire, pas ceux de l’auteur'
  );
  egal(recu.state.entries['900'].section, 'swift', 'chacun retrouve sa section');
  egal(recu.state.entries['900'].runeSpeed, 120, 'la vitesse de runes suit');
  egal(recu.state.entries['901'].runeSpeed, null, 'une vitesse non saisie reste vide (et non 0)');
  egal(recu.categories[0].members, ['900'], 'les catégories se reposent sur les bons monstres');

  /* ---- Ce qui appartient au destinataire n'est pas écrasé ---------------- */

  const avecMesRunes: RtaState = {
    sections: [],
    entries: {
      '900': { monsterId: '900', section: RTA_UNASSIGNED, runeSpeed: 55, gear: { base: 'à moi' } as any },
    },
  };
  const fusion = appliquer(rapport.snapshot!, parCom2us(chezLui), avecMesRunes);
  egal(
    (fusion.state.entries['900'].gear as any)?.base,
    'à moi',
    'mon équipement importé de MON compte survit à une prépa reçue'
  );
  egal(fusion.state.entries['900'].section, 'swift', 'mais le classement reçu, lui, s’applique bien');

  /* ---- Monstre inconnu du destinataire ---------------------------------- */

  const partiel = appliquer(rapport.snapshot!, parCom2us([chezLui[0]]), { sections: [], entries: {} });
  egal(partiel.inconnus, [19315], 'un monstre absent des données est remonté, pas avalé en silence');
  egal(Object.keys(partiel.state.entries), ['900'], 'et il n’entre pas dans la prépa');

  titre('Partage d’une prépa RTA · fichiers douteux');

  /* ---- Refus d'un fichier d'un AUTRE type -------------------------------- */

  // ⚠️ Bloquant, et non simple avertissement : importer une prépa REMPLACE
  // celle en cours. Se tromper de fichier coûterait le classement en place.
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
