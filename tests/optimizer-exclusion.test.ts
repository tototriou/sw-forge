// Exclusion MANUELLE de runes dans l'Optimizer (voir src/lib/
// optimizerExclusion.ts, spec/outils/optimizer.md) — logique de résolution
// PURE, risque « grave et invisible » classique de ce dépôt (une mauvaise
// résolution exclut les mauvaises runes, ou n'exclut rien, sans qu'aucune
// erreur ne le signale à l'écran).

import { BoxItem } from '../src/lib/applyAccount';
import { GearSet, Monster, RtaEntry, RuneDetail, SiegeTeam } from '../src/types';
import {
  ExclusionSourceData,
  OptimizerListMember,
  ValidatedBuild,
  autoExcludedRuneIds,
  exclusionCandidatesFor,
  exclusionSelectorKey,
  findValidatedBuild,
  otherValidatedRuneIds,
  resolveExcludedRuneIds,
  resolveExclusionEntry,
  revalidateBuilds,
  revalidateMembers,
} from '../src/lib/optimizerExclusion';
import { egal, ok, titre } from './outils';

function monster(id: number, name: string): Monster {
  return {
    id,
    com2usId: id,
    name,
    element: 'fire',
    stars: 6,
    naturalStars: 5,
    secondAwaken: false,
    image: null,
    stats: { hp: 0, attack: 0, defense: 0, speed: 0, critRate: 0, critDamage: 0, resistance: 0, accuracy: 0 },
    leaderSkill: null,
  };
}

function rune(id: number): RuneDetail {
  return { id, slot: 1, set: 'fatal', rank: 6, rarity: 5, level: 15, main: { code: 1, value: 100 }, subs: [] };
}

function gear(runeIds: number[]): GearSet {
  return { base: { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 }, artifacts: [], runes: runeIds.map(rune) };
}

export default function testOptimizerExclusion() {
  titre('Optimizer · exclusion manuelle de runes (box/RTA/siège)');

  const camilla = monster(1, 'Camilla');
  const lushen = monster(2, 'Lushen');
  const monsterById = new Map<string, Monster>([
    [String(camilla.id), camilla],
    [String(lushen.id), lushen],
  ]);

  const box: BoxItem[] = [
    { key: 'unit-camilla', monster: camilla, stars: 6, level: 40, gear: gear([1, 2, 3, 4, 5, 6]) },
    { key: 'unit-lushen', monster: lushen, stars: 6, level: 40, gear: gear([7, 8, 9, 10, 11, 12]) },
    { key: 'unit-bare', monster: monster(3, 'SansRunes'), stars: 6, level: 40, gear: gear([]) },
  ];
  const rtaEntries: Record<string, RtaEntry> = {
    [String(camilla.id)]: { monsterId: String(camilla.id), section: 'violent', runeSpeed: 200, gear: gear([101, 102, 103, 104, 105, 106]) },
  };
  const siegeDefenseTeams: SiegeTeam[] = [
    {
      id: 'team-1',
      lead: 0,
      tickAlertDismissed: false,
      slots: [
        { monsterId: String(lushen.id), runeSpeed: 200, tick: 0, gear: gear([201, 202, 203, 204, 205, 206]) },
        { monsterId: null, runeSpeed: null, tick: 0 },
        { monsterId: String(camilla.id), runeSpeed: 200, tick: 0, gear: gear([301, 302, 303, 304, 305, 306]) },
      ],
    },
  ];
  const data: ExclusionSourceData = { box, rtaEntries, siegeDefenseTeams, siegeOffenseTeams: [], monsterById };

  // ── exclusionCandidatesFor ──────────────────────────────────────────
  {
    const boxCandidates = exclusionCandidatesFor('box', data, null, null);
    egal(boxCandidates.length, 2, 'box : 2 candidats proposables (le troisième, sans runes, est exclu de la liste)');

    const boxWithoutOwn = exclusionCandidatesFor('box', data, 'unit-camilla', null);
    egal(boxWithoutOwn.length, 1, 'box : le monstre RECHERCHÉ (excludeOwnUnitKey) est retiré de ses propres propositions');
    egal(boxWithoutOwn[0].monster.name, 'Lushen', 'box : le candidat restant est bien Lushen, pas Camilla');

    const rtaCandidates = exclusionCandidatesFor('rta', data, null, null);
    egal(rtaCandidates.length, 1, 'rta : un seul favori RTA équipé de runes');
    egal(rtaCandidates[0].selector, { source: 'rta', monsterId: '1' }, 'rta : sélecteur résolu par monsterId');

    const defCandidates = exclusionCandidatesFor('siege-defense', data, null, null);
    egal(defCandidates.length, 2, 'siège défense : 2 slots équipés (le slot vide est ignoré)');
    ok(
      defCandidates.some((c) => c.selector.source === 'siege-defense' && 'slotIndex' in c.selector && c.selector.slotIndex === 0) &&
        defCandidates.some((c) => c.selector.source === 'siege-defense' && 'slotIndex' in c.selector && c.selector.slotIndex === 2),
      'siège défense : les slotIndex 0 et 2 sont bien distingués (le slot 1, vide, est absent)'
    );

    const offCandidates = exclusionCandidatesFor('siege-offense', data, null, null);
    egal(offCandidates.length, 0, 'siège offense : aucune équipe chargée, aucun candidat');
  }

  // ── Trou trouvé par une revue de code externe : `excludeOwnUnitKey`
  // (box) ne protégeait QUE la box — RTA et siège n'avaient AUCUNE garde,
  // le monstre recherché pouvait s'auto-proposer à l'exclusion depuis ces
  // deux sources. `excludeOwnCom2usId` (par ESPÈCE, pas par entrée —
  // RTA/siège n'ont qu'UNE entrée par monstre) corrige les deux. ──
  {
    const rtaWithoutOwn = exclusionCandidatesFor('rta', data, null, camilla.com2usId);
    egal(rtaWithoutOwn.length, 0, "rta : le monstre recherché (excludeOwnCom2usId=Camilla) retiré de ses propres propositions RTA");

    const rtaWithOtherOwn = exclusionCandidatesFor('rta', data, null, lushen.com2usId);
    egal(rtaWithOtherOwn.length, 1, "rta : un AUTRE monstre recherché (Lushen) ne retire pas l'entrée RTA de Camilla");

    const defWithoutOwn = exclusionCandidatesFor('siege-defense', data, null, camilla.com2usId);
    egal(defWithoutOwn.length, 1, 'siège défense : le monstre recherché (Camilla) retiré de ses propres propositions, Lushen reste');
    egal(defWithoutOwn[0]?.monster.name, 'Lushen', 'siège défense : le candidat restant est bien Lushen, pas Camilla');

    // La box, elle, reste gouvernée par excludeOwnUnitKey SEUL (granularité
    // par entrée précise, pas par espèce) — excludeOwnCom2usId ne doit PAS
    // en plus retirer un AUTRE exemplaire de la même espèce en box.
    const boxUnaffectedByCom2usId = exclusionCandidatesFor('box', data, null, camilla.com2usId);
    egal(boxUnaffectedByCom2usId.length, 2, "box : excludeOwnCom2usId seul ne retire rien (granularité par entrée, pas par espèce)");
  }

  // ── Camilla a un runage DIFFÉRENT en box, RTA et siège défense : exclure
  // UNE source précise ne doit exclure QUE ses runes à elle, jamais les
  // deux autres builds du même monstre (voir l'en-tête de optimizerExclusion.ts). ──
  {
    const onlyBox = resolveExcludedRuneIds([{ source: 'box', unitKey: 'unit-camilla' }], data, null, null);
    egal([...onlyBox].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], 'box seul : exclut les runes BOX de Camilla, pas ses runes RTA ni siège');

    const onlyRta = resolveExcludedRuneIds([{ source: 'rta', monsterId: String(camilla.id) }], data, null, null);
    egal([...onlyRta].sort((a, b) => a - b), [101, 102, 103, 104, 105, 106], 'rta seul : exclut les runes RTA de Camilla, distinctes de ses runes box');

    const onlySiege = resolveExcludedRuneIds([{ source: 'siege-defense', teamId: 'team-1', slotIndex: 2 }], data, null, null);
    egal([...onlySiege].sort((a, b) => a - b), [301, 302, 303, 304, 305, 306], 'siège seul : exclut les runes du DECK, distinctes des deux autres');

    const combined = resolveExcludedRuneIds(
      [
        { source: 'box', unitKey: 'unit-camilla' },
        { source: 'rta', monsterId: String(camilla.id) },
      ],
      data,
      null,
      null
    );
    egal(combined.size, 12, 'plusieurs sélecteurs : union des runes exclues (box + RTA de Camilla, aucun chevauchement)');
  }

  // ── Trou trouvé par une revue de code externe : un sélecteur choisi
  // LÉGITIMEMENT en optimisant un AUTRE monstre (« exclure les runes de
  // Camilla » pendant qu'on optimise Lushen) devient une AUTO-exclusion si
  // l'utilisateur change ensuite le monstre recherché pour Camilla —
  // `excludedSelectors` (l'état de l'écran) n'était jusqu'ici jamais purgé
  // ni revérifié à ce changement. Défendu ICI, à la résolution, pour que
  // la garantie tienne quelle que soit la façon dont le sélecteur est
  // arrivé dans la liste (voir aussi le useEffect de purge dans
  // OptimizerSection.tsx, qui nettoie l'AFFICHAGE — cosmétique, cette
  // défense-ci est celle qui garantit le POOL réel). ──
  {
    const staleRta = resolveExcludedRuneIds([{ source: 'rta', monsterId: String(camilla.id) }], data, null, camilla.com2usId);
    egal(staleRta.size, 0, "sélecteur RTA périmé (devenu le monstre recherché lui-même) : ignoré, aucune rune exclue à tort");

    const staleSiege = resolveExcludedRuneIds([{ source: 'siege-defense', teamId: 'team-1', slotIndex: 2 }], data, null, camilla.com2usId);
    egal(staleSiege.size, 0, "sélecteur siège périmé (devenu le monstre recherché lui-même) : ignoré, aucune rune exclue à tort");

    // Box : granularité PAR ENTRÉE (`ownUnitKey`), pas par espèce — sa
    // PROPRE entrée (celle réellement en cours d'optimisation) reste
    // défendue, mais un DEUXIÈME exemplaire de Camilla en box (runage
    // différent, entrée différente) reste, lui, exclusible (voir l'en-tête
    // du fichier : plusieurs exemplaires du même monstre sont possibles).
    const boxSelfExcluded = resolveExcludedRuneIds([{ source: 'box', unitKey: 'unit-camilla' }], data, 'unit-camilla', camilla.com2usId);
    egal([...boxSelfExcluded], [], 'box : sa PROPRE entrée (ownUnitKey) reste défendue');

    const dataWithSecondCamilla: ExclusionSourceData = {
      ...data,
      box: [...box, { key: 'unit-camilla-2', monster: camilla, stars: 6, level: 40, gear: gear([21, 22, 23, 24, 25, 26]) }],
    };
    const boxOtherCopyStillWorks = resolveExcludedRuneIds([{ source: 'box', unitKey: 'unit-camilla-2' }], dataWithSecondCamilla, 'unit-camilla', camilla.com2usId);
    egal(
      [...boxOtherCopyStillWorks].sort((a, b) => a - b),
      [21, 22, 23, 24, 25, 26],
      'box : un AUTRE exemplaire de Camilla (entrée différente, même espèce) reste exclusible — granularité par entrée préservée'
    );

    // Mélange : un sélecteur périmé (RTA de Camilla, désormais soi-même) ET
    // un sélecteur toujours légitime (box de Lushen) dans la MÊME liste —
    // seul le premier doit être ignoré.
    const mixed = resolveExcludedRuneIds(
      [
        { source: 'rta', monsterId: String(camilla.id) }, // périmé : Camilla = soi-même
        { source: 'box', unitKey: 'unit-lushen' }, // toujours légitime
      ],
      data,
      'unit-camilla',
      camilla.com2usId
    );
    egal([...mixed].sort((a, b) => a - b), [7, 8, 9, 10, 11, 12], 'mélange : le sélecteur périmé est ignoré, le légitime reste appliqué');
  }

  // ── Tolérance : un sélecteur introuvable (recette d'un autre compte,
  // deck modifié depuis, monstre reruné...) ne doit JAMAIS planter — voir
  // le commentaire de resolveExcludedRuneIds. ──
  {
    const inconnu = resolveExcludedRuneIds(
      [
        { source: 'box', unitKey: 'unit-jamais-vu' },
        { source: 'rta', monsterId: '999' },
        { source: 'siege-defense', teamId: 'equipe-inconnue', slotIndex: 0 },
        { source: 'siege-offense', teamId: 'team-1', slotIndex: 5 }, // slotIndex hors bornes
      ],
      data,
      null,
      null
    );
    egal(inconnu.size, 0, 'sélecteurs introuvables : silencieusement ignorés, aucune exception, aucune rune exclue à tort');

    const resolved = resolveExclusionEntry({ source: 'box', unitKey: 'unit-jamais-vu' }, data);
    egal(resolved, null, 'resolveExclusionEntry sur un sélecteur introuvable renvoie null, pas une exception');
  }

  // ── Clé canonique : dédoublonnage attendu par RuneExclusionPicker ──
  {
    const k1 = exclusionSelectorKey({ source: 'siege-defense', teamId: 'team-1', slotIndex: 2 });
    const k2 = exclusionSelectorKey({ source: 'siege-defense', teamId: 'team-1', slotIndex: 0 });
    ok(k1 !== k2, 'clé canonique : deux slots de la MÊME équipe restent distincts (slotIndex fait partie de la clé)');
  }

  // ── Contexte d'équipe (teamContext) : LE cas signalé en usage réel — un
  // même monstre dans DEUX équipes de siège différentes est indiscernable
  // par le seul nom/portrait (même espèce = même portrait). Le repère
  // affiché doit être le numéro d'équipe ET les VRAIS coéquipiers de CETTE
  // équipe précise, jamais mélangés avec ceux de l'autre. ──
  {
    const fran = monster(4, 'Fran');
    const vero = monster(5, 'Veromos');
    const monsterById2 = new Map(monsterById);
    monsterById2.set(String(fran.id), fran);
    monsterById2.set(String(vero.id), vero);

    // Deux équipes, TOUTES DEUX avec Lushen — reproduit le cas « deux
    // Tractor » signalé (même monstre, decks différents).
    const twoTeams: SiegeTeam[] = [
      {
        id: 'team-a', lead: 0, tickAlertDismissed: false,
        slots: [
          { monsterId: String(lushen.id), runeSpeed: 200, tick: 0, gear: gear([401, 402, 403, 404, 405, 406]) },
          { monsterId: String(fran.id), runeSpeed: 200, tick: 0, gear: gear([407, 408, 409, 410, 411, 412]) },
          { monsterId: null, runeSpeed: null, tick: 0 },
        ],
      },
      {
        id: 'team-b', lead: 0, tickAlertDismissed: false,
        slots: [
          { monsterId: String(vero.id), runeSpeed: 200, tick: 0, gear: gear([501, 502, 503, 504, 505, 506]) },
          { monsterId: String(lushen.id), runeSpeed: 200, tick: 0, gear: gear([507, 508, 509, 510, 511, 512]) },
          { monsterId: String(camilla.id), runeSpeed: 200, tick: 0, gear: gear([513, 514, 515, 516, 517, 518]) },
        ],
      },
    ];
    const data2: ExclusionSourceData = { box, rtaEntries, siegeDefenseTeams: twoTeams, siegeOffenseTeams: [], monsterById: monsterById2 };
    const candidates = exclusionCandidatesFor('siege-defense', data2, null, null);
    const lushenEntries = candidates.filter((c) => c.monster.name === 'Lushen');
    egal(lushenEntries.length, 2, 'deux équipes avec le même monstre : les 2 entrées Lushen existent bien, séparément');

    const teamNumbers = lushenEntries.map((c) => c.teamContext?.teamNumber).sort();
    egal(teamNumbers, [1, 2], 'chaque Lushen porte le numéro de SA propre équipe (1 et 2, jamais le même)');

    const lushenTeamA = lushenEntries.find((c) => c.teamContext?.teamNumber === 1);
    egal(
      lushenTeamA?.teamContext?.slots.map((m) => m?.name ?? null),
      ['Lushen', 'Fran', null],
      "équipe 1 : les 3 slots affichés sont CEUX de l'équipe 1 (Fran, pas Veromos/Camilla de l'équipe 2), slot vide = null"
    );

    const lushenTeamB = lushenEntries.find((c) => c.teamContext?.teamNumber === 2);
    egal(
      lushenTeamB?.teamContext?.slots.map((m) => m?.name ?? null),
      ['Veromos', 'Lushen', 'Camilla'],
      "équipe 2 : les 3 slots affichés sont CEUX de l'équipe 2 (Veromos/Camilla, pas Fran de l'équipe 1)"
    );

    const boxCandidate = exclusionCandidatesFor('box', data2, null, null)[0];
    egal(boxCandidate.teamContext, undefined, "box : pas de contexte d'équipe (n'a de sens qu'en siège)");
  }

  // ── Exclusion AUTOMATIQUE (« Exclure les runes déjà utilisées »,
  // autoExcludedRuneIds) — remplace l'ancien `exploreAll`/`excludedRuneIds`
  // scopé uniquement box. UN périmètre entier exclu d'un coup, jamais le
  // monstre RECHERCHÉ lui-même (comparaison par ESPÈCE, com2usId — même
  // convention que le reste du fichier, où com2usId === id). ──
  {
    egal(
      [...autoExcludedRuneIds('box', data, camilla.com2usId)].sort((a, b) => a - b),
      [7, 8, 9, 10, 11, 12],
      'scope box : exclut les runes des AUTRES monstres de la box (Lushen), jamais les siennes propres'
    );

    egal(
      [...autoExcludedRuneIds('rta', data, camilla.com2usId)],
      [],
      "scope rta : la SEULE entrée RTA appartient au monstre recherché lui-même → rien à exclure"
    );
    egal(
      [...autoExcludedRuneIds('rta', data, lushen.com2usId)].sort((a, b) => a - b),
      [101, 102, 103, 104, 105, 106],
      "scope rta : pour un AUTRE monstre recherché (Lushen, absent du RTA), l'entrée RTA de Camilla est bien exclue"
    );

    egal(
      [...autoExcludedRuneIds('siege-defense', data, camilla.com2usId)].sort((a, b) => a - b),
      [201, 202, 203, 204, 205, 206],
      'scope siège défense : exclut le slot Lushen (équipe 1), jamais le propre slot de Camilla (équipe 1 aussi)'
    );
    egal(
      [...autoExcludedRuneIds('siege-defense', data, lushen.com2usId)].sort((a, b) => a - b),
      [301, 302, 303, 304, 305, 306],
      'scope siège défense : symétrique — recherché = Lushen, exclut le slot Camilla'
    );

    egal(
      [...autoExcludedRuneIds('siege-defense', data, null)].sort((a, b) => a - b),
      [201, 202, 203, 204, 205, 206, 301, 302, 303, 304, 305, 306],
      'aucun monstre "à soi" (com2usId null) : rien ne peut être reconnu comme le sien, tout le périmètre est exclu'
    );
  }

  // ── Runes VALIDÉES (Lot 3, « Monstres de la liste ») — 3ᵉ mécanisme
  // d'exclusion : un INSTANTANÉ de runeIds, pas une entrée relue
  // dynamiquement, scopé PAR LISTE (deux listes ne se bloquent jamais entre
  // elles — un deck d'offense siège est un preset appliqué momentanément,
  // jamais simultanément à un autre). ──
  {
    const validated: ValidatedBuild[] = [
      { listId: 'deck-a', selector: { source: 'box', unitKey: 'unit-camilla' }, runeIds: [1, 2, 3, 4, 5, 6] },
      { listId: 'deck-a', selector: { source: 'rta', monsterId: String(lushen.id) }, runeIds: [101, 102, 103, 104, 105, 106] },
      // Même sélecteur que Camilla ci-dessus, mais dans une AUTRE liste — ne
      // doit JAMAIS être compté comme une auto-exemption ni bloquer deck-a.
      { listId: 'deck-b', selector: { source: 'box', unitKey: 'unit-camilla' }, runeIds: [21, 22, 23, 24, 25, 26] },
    ];
    const ownKey = exclusionSelectorKey({ source: 'box', unitKey: 'unit-camilla' });

    egal(
      [...otherValidatedRuneIds(validated, 'deck-a', ownKey)].sort((a, b) => a - b),
      [101, 102, 103, 104, 105, 106],
      "runes validées : les AUTRES exemplaires de LA MÊME LISTE bloquent leurs runes, jamais les siennes propres (auto-exemption), jamais celles d'une AUTRE liste"
    );
    egal(
      [...otherValidatedRuneIds(validated, 'deck-a', null)].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 101, 102, 103, 104, 105, 106],
      'runes validées : aucun exemplaire actif (ownSelectorKey=null) → TOUTES les runes validées de CETTE liste bloquent'
    );
    egal(
      [...otherValidatedRuneIds(validated, 'deck-b', null)].sort((a, b) => a - b),
      [21, 22, 23, 24, 25, 26],
      'runes validées : deck-b ignore totalement ce qui est validé dans deck-a — pools indépendants'
    );
    egal([...otherValidatedRuneIds(validated, null, null)], [], 'runes validées : aucune liste active → rien à bloquer');

    egal(
      findValidatedBuild(validated, 'deck-a', ownKey)?.runeIds,
      [1, 2, 3, 4, 5, 6],
      'findValidatedBuild : retrouve le build de CET exemplaire précis DANS CETTE liste'
    );
    egal(
      findValidatedBuild(validated, 'deck-b', ownKey)?.runeIds,
      [21, 22, 23, 24, 25, 26],
      'findValidatedBuild : le MÊME sélecteur porte un build DIFFÉRENT dans une autre liste'
    );
    egal(findValidatedBuild(validated, 'deck-a', 'clé-inconnue'), undefined, 'findValidatedBuild : aucun match → undefined');
    egal(findValidatedBuild(validated, null, ownKey), undefined, 'findValidatedBuild : listId null → jamais de faux positif');
  }

  // ── revalidateBuilds — revérification au réimport (point bloquant 4 du
  // cadrage) : un sélecteur introuvable OU une rune validée qui n'est plus
  // TOUTE sur l'exemplaire (déplacée/vendue/reforgée depuis) est abandonné,
  // jamais silencieusement gardé. ──
  {
    const validated: ValidatedBuild[] = [
      { listId: 'deck-a', selector: { source: 'box', unitKey: 'unit-camilla' }, runeIds: [1, 2, 3, 4, 5, 6] }, // toujours intact → conservé
      { listId: 'deck-a', selector: { source: 'box', unitKey: 'unit-jamais-vu' }, runeIds: [1, 2, 3, 4, 5, 6] }, // sélecteur introuvable → abandonné
      { listId: 'deck-a', selector: { source: 'rta', monsterId: String(camilla.id) }, runeIds: [101, 102, 103, 104, 105, 999] }, // 999 absente de cet exemplaire → abandonné
    ];
    const { kept, droppedCount } = revalidateBuilds(validated, data);
    egal(droppedCount, 2, 'revalidateBuilds : les 2 builds périmés (sélecteur introuvable, rune manquante) sont comptés');
    egal(kept.length, 1, 'revalidateBuilds : le build encore intact (box Camilla) est conservé');
    egal(kept[0]?.selector, { source: 'box', unitKey: 'unit-camilla' }, 'revalidateBuilds : conserve le bon sélecteur');

    const allValid = revalidateBuilds([validated[0]], data);
    egal(allValid.droppedCount, 0, 'revalidateBuilds : rien de périmé → droppedCount à 0, pas juste kept correct');
  }

  // ── revalidateMembers (Lot 3) — même principe que revalidateBuilds, mais
  // pour la simple appartenance à une liste : seul le sélecteur doit encore
  // résoudre, aucune rune à comparer. ──
  {
    const members: OptimizerListMember[] = [
      { listId: 'deck-a', selector: { source: 'box', unitKey: 'unit-camilla' } }, // résout toujours → conservé
      { listId: 'deck-a', selector: { source: 'box', unitKey: 'unit-jamais-vu' } }, // sélecteur introuvable → abandonné
    ];
    const { kept, droppedCount } = revalidateMembers(members, data);
    egal(droppedCount, 1, 'revalidateMembers : le membre au sélecteur introuvable est abandonné');
    egal(kept.length, 1, 'revalidateMembers : le membre encore valide est conservé');
    egal(kept[0]?.selector, { source: 'box', unitKey: 'unit-camilla' }, 'revalidateMembers : conserve le bon sélecteur');
  }
}
