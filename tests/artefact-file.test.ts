// File d'optimisation d'artéfacts alimentée au fil de l'eau.
//
// ⚠️ Ce module ne planifie rien et ne trie rien : il répond seulement à « qui
// traiter ensuite ». Les tests portent donc sur la PRIORITÉ et sur le cache,
// jamais sur le moment où le travail est fait (voir `useArtifactOptimQueue`,
// qui a besoin d'un navigateur) ni sur le choix de la paire (artefact-optim).

import { readFileSync } from 'node:fs';
import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { candidatAvecSaPaire, cleBuild, ordonnerParDepartage, prochainsATraiter, signatureReglages, signatureArtefacts } from '../src/lib/artifactQueue';
import { regimeEquipementDe } from '../src/lib/artifactEvaluation';
import { piecesFigeesDe } from '../src/lib/artifactFiche';
import type { ArtifactDetail } from '../src/types';
import { egal, ok, titre } from './outils';

const build = (...runeIds: number[]) => ({ runeIds }) as unknown as BuildCandidate;
// Le cache de la file : des builds résolus ET conformes. La conformité ne change
// la fenêtre que pour un écarté (`tests/file-confirmees.test.ts`).
const resolus = (...cles: string[]) => new Map(cles.map((cle) => [cle, { conforme: true }]));

// Pièces portées minimales : seuls `id` et `kind` sont lus par
// `piecesFigeesDe` ; la principale distingue deux pièces d'une même sorte.
const piece = (id: number, kind: 'element' | 'archetype', code: number) =>
  ({ id, kind, main: { code, value: 100 }, subs: [] }) as unknown as ArtifactDetail;
const ART_ELEMENT_1 = piece(9001, 'element', 100);
const ART_ELEMENT_2 = piece(9002, 'element', 101);
const ART_TYPE_1 = piece(9101, 'archetype', 100);
const ART_TYPE_2 = piece(9102, 'archetype', 102);

export default function testArtefactFile() {
  titre('File d’artéfacts — identité d’un build');

  // ⚠️ L'emplacement d'une rune est porté par la rune, pas par sa position :
  // deux candidats aux mêmes runes dans un ordre différent sont le MÊME build.
  // Sans tri dans la clé, le cache raterait et on paierait deux fois.
  egal(cleBuild(build(4, 1, 3)), cleBuild(build(1, 3, 4)), 'l’ordre des runes ne change pas l’identité du build');
  ok(cleBuild(build(1, 2)) !== cleBuild(build(1, 3)), '… mais un jeu de runes différent en donne une autre');

  titre('File d’artéfacts — priorité et plafond K');

  {
    const triees = [build(1), build(2), build(3), build(4), build(5)];
    egal(
      prochainsATraiter(triees, resolus(), 3).map(cleBuild),
      ['1', '2', '3'],
      'seuls les K mieux classés entrent en file, dans l’ordre reçu'
    );
    // ⚠️ Le tri vient de `sortCandidates` (source unique) : ce module ne trie
    // PAS. Un second tri ici finirait par diverger de celui de l’écran — le
    // défaut qui avait fait lire `candidates[0]` comme « le meilleur ».
    egal(
      prochainsATraiter(triees, resolus('1', '2'), 3).map(cleBuild),
      ['3'],
      'ce qui est déjà en cache ne repasse pas en file'
    );
    egal(prochainsATraiter(triees, resolus('1', '2', '3'), 3), [], 'les K premiers tous traités : plus rien à faire');
    // ⚠️ Un build au-delà n'est PAS repêché parce que les K premiers sont
    // finis et CONFIRMÉS : la cible porte sur les confirmées, pas
    // sur le nombre restant.
    egal(
      prochainsATraiter(triees, resolus('1', '2', '3'), 3).length,
      0,
      '… et le 4ᵉ n’est pas repêché pour autant'
    );
  }

  {
    // Garde DÉFENSIVE : aucun chemin connu ne produit ce doublon aujourd'hui
    // (curseur monotone sur les deltas, tranches de `bucketsA` disjointes,
    // escalade qui ne relance rien — vérifié dans runeBuildOptim.worker.ts).
    // Ce test fixe le comportement au cas où ce flux changerait, puisque ce
    // module ne le contrôle pas.
    const avecDoublon = [build(1), build(1), build(2)];
    egal(
      prochainsATraiter(avecDoublon, resolus(), 5).map(cleBuild),
      ['1', '2'],
      'un build présent deux fois n’est mis en file qu’une seule fois'
    );
  }

  titre('File d’artéfacts — la page consultée passe AVANT le top K');

  // ⚠️ **Sans ça, aucune page au-delà de la K-ième n'aurait jamais sa paire**,
  // quelle que soit la valeur de K. Le top K est une avance de fond pour les
  // premières pages ; ce que l'utilisateur REGARDE doit passer devant.
  {
    const triees = [build(1), build(2), build(3), build(4), build(5)];
    // L'utilisateur est sur une page profonde : ces builds sont hors du top K.
    const page = [build(40), build(41)];
    egal(
      prochainsATraiter(triees, resolus(), 2, page).map(cleBuild),
      ['40', '41', '1', '2'],
      'la page consultée est traitée EN PREMIER, puis le top K'
    );
    // ⚠️ Sans la page, ces builds ne seraient JAMAIS servis — c'est le défaut
    // que ce paramètre corrige.
    egal(
      prochainsATraiter(triees, resolus(), 2).map(cleBuild),
      ['1', '2'],
      'sans page fournie, seul le top K est traité (comportement d’origine)'
    );
    // ⚠️ Un build de la page figure PRESQUE TOUJOURS aussi dans le top K : la
    // déduplication n'est donc plus défensive, elle est nécessaire.
    egal(
      prochainsATraiter(triees, resolus(), 3, [build(2)]).map(cleBuild),
      ['2', '1', '3'],
      'un build à la fois dans la page ET dans le top K n’est mis en file qu’UNE fois'
    );
    // Et le cache prime toujours : rien n’est refait, même sur la page.
    egal(
      prochainsATraiter(triees, resolus('40'), 1, page).map(cleBuild),
      ['41', '1'],
      'un build déjà optimisé n’est pas repris, même s’il est à l’écran'
    );
  }

  titre('File d’artéfacts — un build optimisé passe devant, sans emballement');

  // ⚠️ **La propriété qui rend le reclassement SÛR** : optimiser un build ne
  // peut que faire MONTER son score, jamais descendre — la paire supposée fait
  // partie des paires candidates, le maximum lui est donc toujours ≥.
  //
  // Conséquence : un build optimisé monte ou reste, un build non optimisé ne
  // peut qu'être repoussé vers le bas, et AUCUN ne peut entrer dans les K
  // premiers de ce fait. L'ensemble à traiter rétrécit — la boucle
  // « trier → optimiser → retrier » converge donc, elle ne s'emballe pas.
  // C'est ce qui autorise à laisser un build passer devant plutôt que
  // d'afficher un total supérieur à un rang inférieur.
  {
    const stat = (atk: number) => [{ key: 'atk', base: 0, bonus: atk, total: atk }] as unknown as BuildCandidate['stats'];
    const c1 = { runeIds: [1], stats: stat(100) } as unknown as BuildCandidate;
    const c2 = { runeIds: [2], stats: stat(90) } as unknown as BuildCandidate;
    const cache = new Map([
      // c2 optimisé : sa paire lui apporte de quoi dépasser c1.
      [cleBuild(c2), { paire: null, artefacts: [], stats: stat(110), meilleurSansVerrous: null, conforme: true }],
    ]);
    egal(candidatAvecSaPaire(c2, cache).stats, stat(110), 'un build optimisé porte ses stats RECALCULÉES');
    egal(candidatAvecSaPaire(c1, cache).stats, stat(100), '… et un build non optimisé garde les siennes');

    // ⚠️ Le cache ne fait JAMAIS baisser un build : une entrée qui rendrait des
    // stats INFÉRIEURES casserait la convergence démontrée ci-dessus. On ne
    // peut pas l'empêcher par le type, mais ce test dit que ce n'est pas prévu.
    const apres = [c1, c2].map((c) => candidatAvecSaPaire(c, cache));
    ok(
      apres.every((c, i) => (c.stats[0]!.total ?? 0) >= ([c1, c2][i]!.stats[0]!.total ?? 0)),
      'aucun build ne voit son score BAISSER en étant optimisé'
    );
  }

  titre('File d’artéfacts — ce qui invalide le cache');

  {
    const setup = {
      skillCom2usId: 4713,
      enemyElement: null,
      atkBuff: false,
      enemyHpPct: 100,
      enemyDef: 1000,
      critMode: 'crit',
    };
    const base = {
      monstreCom2usId: 14311,
      damageSetup: setup,
      objective: 'degats_reels',
      ignoreArtifacts: false,
      principaleParSorte: { element: 101 },
      lignesVerrouillees: [] as { code: number; min: number }[],
      relique: { main: { code: 101, value: 12 } } as unknown,
      nbArtefacts: 2518,
      empreinteRelique: null as string | null,
      requirement: { minStats: { atk: 100 }, maxStats: { def: 2000 } },
      artefactsReserves: [] as Iterable<number>,
      piecesFigees: [] as readonly unknown[],
      importDuCompte: 0,
    };
    const s = signatureReglages(base);
    // ⚠️ Tout ce qui change quelles LIGNES comptent change la paire gagnante
    // (`analyserPertinence`). Garder le cache afficherait des paires optimales
    // pour un réglage que l'utilisateur a quitté.
    ok(signatureReglages({ ...base, damageSetup: { ...setup, enemyElement: 'wind' } }) !== s, 'changer l’élément visé invalide le cache');
    ok(signatureReglages({ ...base, damageSetup: { ...setup, skillCom2usId: 4712 } }) !== s, 'changer de sort aussi');
    ok(signatureReglages({ ...base, principaleParSorte: { element: 100 } }) !== s, '… et la stat principale exigée');
    ok(signatureReglages({ ...base, lignesVerrouillees: [{ code: 409, min: 15 }] }) !== s, '… et une ligne verrouillée');
    ok(signatureReglages({ ...base, nbArtefacts: 2519 }) !== s, '… et l’arrivée d’un artéfact en inventaire');
    ok(signatureReglages({ ...base, objective: 'efficience' }) !== s, '… et le changement d’objectif');
    ok(signatureReglages({ ...base, ignoreArtifacts: true }) !== s, '… et « ignorer les artéfacts »');
    ok(signatureReglages({ ...base, relique: { main: { code: 101, value: 15 } } }) !== s, '… et un changement de relique (elle entre dans les stats)');
    // La dimension relique de la recherche — l'empreinte canonique
    // du contexte (mode, pool éligible, choix, seuil) — invalide aussi ; un
    // contexte absent (chemin écran avant 5c) et un contexte présent ne
    // partagent jamais la clé.
    ok(signatureReglages({ ...base, empreinteRelique: 'recherche|1:100:14:6:1/100/1|libre|libre|6' }) !== s, '… et l’arrivée d’un contexte relique (empreinte)');
    ok(
      signatureReglages({ ...base, empreinteRelique: 'recherche|1:100:14:6:1/100/1|libre|libre|6' }) !==
        signatureReglages({ ...base, empreinteRelique: 'recherche|1:100:14:6:1/100/1|libre|libre|9' }),
      '… et un changement de seuil dans l’empreinte'
    );

    // ⚠️ **LE test — bug rapporté à l'usage.** La signature ne listait que
    // `skillCom2usId` et l'élément visé : changer le buff ATQ, les PV restants
    // de la cible ou sa défense laissait le cache INTACT. L'écran affichait des
    // paires optimisées pour un réglage abandonné, et le « gain » comparait un
    // score d'avant à un total d'après — d'où un « +52,8 % » identique sur
    // toutes les cartes. Toucher au sélecteur de stat principale « réparait »
    // l'affichage, ce qui a mis sur la piste.
    ok(signatureReglages({ ...base, damageSetup: { ...setup, atkBuff: true } }) !== s, 'ACTIVER LE BUFF ATQ invalide le cache');
    ok(signatureReglages({ ...base, damageSetup: { ...setup, enemyHpPct: 30 } }) !== s, '… les PV restants de la cible aussi');
    ok(signatureReglages({ ...base, damageSetup: { ...setup, enemyDef: 1500 } }) !== s, '… sa défense aussi');
    ok(signatureReglages({ ...base, damageSetup: { ...setup, critMode: 'moyen' } }) !== s, '… et le mode de critique');

    // ⚠️ Un minimum à 0 n'exige RIEN : il ne doit pas invalider un cache
    // parfaitement valable, sinon taper puis effacer une valeur relancerait
    // 100 optimisations pour rien.
    egal(
      signatureReglages({ ...base, lignesVerrouillees: [{ code: 409, min: 0 }] }),
      s,
      'un minimum nul ne change rien, donc n’invalide pas'
    );
    // …et l'ORDRE de saisie des lignes non plus.
    egal(
      signatureReglages({ ...base, lignesVerrouillees: [{ code: 409, min: 15 }, { code: 206, min: 35 }] }),
      signatureReglages({ ...base, lignesVerrouillees: [{ code: 206, min: 35 }, { code: 409, min: 15 }] }),
      'l’ordre de saisie des lignes verrouillées est sans effet'
    );

    // ⚠️ **Le maximum entre dans la signature** :
    // `requirement` (minimums ET maximums) doit invalider le cache — sans lui,
    // relancer avec le même contexte et un autre maximum gardait un couple
    // devenu infaisable (`conforme: true` périmé).
    ok(
      signatureReglages({ ...base, requirement: { minStats: base.requirement.minStats, maxStats: { def: 1900 } } }) !== s,
      '… et un changement de MAXIMUM invalide le cache (bloquant 2)'
    );
    ok(
      signatureReglages({ ...base, requirement: { minStats: { atk: 150 }, maxStats: base.requirement.maxStats } }) !== s,
      '… un changement de MINIMUM aussi'
    );
    egal(
      signatureReglages({ ...base, requirement: { minStats: { ...base.requirement.minStats }, maxStats: { ...base.requirement.maxStats } } }),
      s,
      '… mais le MÊME requirement (copie) ne change rien'
    );

    // ⚠️ **Les artéfacts RÉSERVÉS** par les autres builds validés
    // de la liste active sortent de l'inventaire de la paire. Défaut relevé
    // par la revue du Worker : « Libérer les artéfacts » sur la ligne d'un
    // autre monstre de la liste, ou un changement de liste active, laissait la
    // signature IDENTIQUE — les cartes déjà calculées gardaient leur paire
    // d'avant, même après une nouvelle recherche aux mêmes réglages.
    const reserve501 = signatureReglages({ ...base, artefactsReserves: new Set([501]) });
    ok(reserve501 !== s, '… et la réservation d’un artéfact par un autre build validé');
    ok(
      signatureReglages({ ...base, artefactsReserves: new Set([501, 502]) }) !== reserve501,
      '… et un artéfact réservé de plus — ou, lu à l’envers, un artéfact libéré'
    );
    ok(signatureReglages({ ...base, artefactsReserves: new Set([502]) }) !== reserve501, '… et un autre artéfact réservé à la place');
    egal(
      signatureReglages({ ...base, artefactsReserves: [502, 501] }),
      signatureReglages({ ...base, artefactsReserves: new Set([501, 502]) }),
      'le même ensemble de réservations dans un autre ordre ne change rien'
    );
    egal(
      signatureReglages({ ...base, artefactsReserves: [501, 502, 501] }),
      signatureReglages({ ...base, artefactsReserves: [501, 502] }),
      '… un doublon non plus : c’est un ensemble'
    );
    // « Comme avant » : sans réservation, la signature est EXACTEMENT celle
    // du code d'avant les réservations — littéral relevé sur 47cecfa9 avec ces mêmes
    // réglages. Aucun cache n'est donc vidé pour rien
    // chez qui n'a pas de liste de travail.
    egal(
      s,
      '14311§{"skillCom2usId":4713,"enemyElement":null,"atkBuff":false,"enemyHpPct":100,"enemyDef":1000,"critMode":"crit"}§true§degats_reels§-§{"element":101}§§{"main":{"code":101,"value":12}}§2518§§{"atk":100}§{"def":2000}',
      'sans réservation, la signature est exactement le littéral épinglé'
    );
    egal(signatureReglages({ ...base, artefactsReserves: new Set() }), s, '… qu’on passe un tableau vide ou un ensemble vide');

    // ⚠️ **La pièce d'un emplacement FIGÉ** sur « Garder l'artéfact
    // équipé » est le seul candidat de cet emplacement (`candidatsParSorte`) :
    // même nature que les réservations (l'inventaire de la paire). Valider un
    // build de CE monstre, « Voir le runage réellement porté » ou changer
    // d'exemplaire de la même espèce la remplacent sans rien changer d'autre.
    const portes = [ART_ELEMENT_1, ART_TYPE_1];
    egal(piecesFigeesDe({}, portes), [], 'aucun emplacement figé : aucune pièce portée lue');
    egal(piecesFigeesDe({ element: 'libre', archetype: 101 }, portes), [], '… ni en « Libre », ni à principale imposée');
    egal(
      piecesFigeesDe({ element: 'equipped' }, portes),
      [{ sorte: 'element', piece: ART_ELEMENT_1 }],
      'Attribut figé : la pièce d’attribut portée, et elle seule'
    );
    egal(
      piecesFigeesDe({ element: 'equipped', archetype: 'equipped' }, [ART_TYPE_1]),
      [{ sorte: 'element', piece: null }, { sorte: 'archetype', piece: ART_TYPE_1 }],
      'emplacement figé vide : `null`, comme le candidat unique de `candidatsParSorte`'
    );
    const figeAvec = (equipes: ArtifactDetail[]) =>
      signatureReglages({ ...base, principaleParSorte: { element: 'equipped' }, piecesFigees: piecesFigeesDe({ element: 'equipped' }, equipes) });
    ok(
      figeAvec([ART_ELEMENT_2, ART_TYPE_1]) !== figeAvec([ART_ELEMENT_1, ART_TYPE_1]),
      '… et la pièce portée d’un emplacement figé qui change'
    );
    egal(
      figeAvec([ART_ELEMENT_1, ART_TYPE_2]),
      figeAvec([ART_ELEMENT_1, ART_TYPE_1]),
      'la pièce portée d’un emplacement NON figé ne change rien : elle n’est jamais lue'
    );
    egal(signatureReglages({ ...base, piecesFigees: piecesFigeesDe({}, portes) }), s, 'sans emplacement figé, la signature reste le littéral épinglé');

    // ⚠️ **L'IDENTITÉ de l'import du compte.** Le cache est indexé
    // par les identifiants de runes (`cleBuild`) et ne voyait de l'inventaire
    // que le NOMBRE d'artéfacts : un réimport qui changeait des pièces ou des
    // runes à nombre et identifiants égaux laissait la signature IDENTIQUE —
    // une nouvelle recherche reprenait du cache les paires de l'ancien compte.
    // Une identité, pas une empreinte du contenu (décision de l'utilisateur) :
    // tout réimport compte, même celui d'un fichier identique.
    const import1 = signatureReglages({ ...base, importDuCompte: 1 });
    const import2 = signatureReglages({ ...base, importDuCompte: 2 });
    ok(import1 !== s, 'le premier import de la session change la signature');
    ok(import2 !== import1, 'deux imports distincts → deux signatures différentes, à réglages et inventaire de même taille');
    egal(signatureReglages({ ...base, importDuCompte: 1 }), import1, 'même import → signature inchangée');
    // `base` porte `importDuCompte: 0` et `s` est épinglé plus haut sur le
    // littéral d'avant les réservations : avant tout import de la session, la
    // signature reste donc aussi celle d'avant l'identité d'import (rien vidé pour rien).
    ok(!s.includes('import:'), 'avant tout import de la session, aucun composant d’import : la signature ne porte pas d’identité d’import');
  }

  titre('File d’artéfacts — signatureArtefacts (la closure de l’écran, extraite)');

  {
    // ⚠️ `signatureArtefacts` (artifactQueue.ts) est la closure d'écran
    // extraite : elle n'assemble RIEN de nouveau, elle relaie `regimeEquipement`
    // vers `objective` (signatureReglages) sous un nom qui protège CONTRE le
    // bug déjà survenu (le mauvais régime — brut,
    // `regimePaire` — passait à la place de l'effectif).
    const base2 = {
      monstreCom2usId: 14311,
      damageSetup: { skillCom2usId: 4713, enemyElement: null, atkBuff: false, enemyHpPct: 100, enemyDef: 1000, critMode: 'crit' },
      regimeEquipement: 'aucun',
      ignoreArtifacts: false,
      principaleParSorte: {},
      lignesVerrouillees: [] as { code: number; min: number }[],
      relique: null as unknown,
      nbArtefacts: 10,
      empreinteRelique: null as string | null,
      requirement: { minStats: {}, maxStats: {} },
      artefactsReserves: [] as Iterable<number>,
      piecesFigees: [] as readonly unknown[],
      importDuCompte: 0,
    };
    const s2 = signatureArtefacts(base2);
    egal(
      s2,
      signatureReglages({ ...base2, objective: base2.regimeEquipement }),
      'signatureArtefacts n’est qu’un adaptateur de noms vers signatureReglages (objective = regimeEquipement)'
    );

    // ⚠️ **Le contrôle 4 lui-même** : pendant la transition « sort
    // indisponible → calculable », `regimePaire` reste `'degats_reels'` dans
    // les deux cas — seul `regimeEquipementDe` distingue les deux, en
    // rabattant sur `'aucun'` tant que le contexte de dégâts manque. La
    // signature DOIT donc changer entre les deux — sinon la file resservirait
    // une paire choisie sous le régime `'aucun'` une fois le sort calculable.
    egal(regimeEquipementDe('degats_reels', false), 'aucun', 'rabattue sur "aucun" tant que le contexte de dégâts manque');
    egal(regimeEquipementDe('degats_reels', true), 'degats_reels', '… et laissée telle quelle une fois calculable');
    egal(regimeEquipementDe('ehp', false), 'ehp', 'un régime hors "degats_reels" n’est jamais rabattu');
    const indisponible = signatureArtefacts({ ...base2, regimeEquipement: regimeEquipementDe('degats_reels', false) });
    const calculable = signatureArtefacts({ ...base2, regimeEquipement: regimeEquipementDe('degats_reels', true) });
    ok(indisponible !== calculable, 'la transition « sort indisponible → calculable » change la signature (contrôle 4)');

    // `requirement` et `empreinteRelique` traversent l’adaptateur jusqu’à la
    // signature (déjà prouvés sur `signatureReglages` ci-dessus — ici on
    // vérifie qu’ils survivent à travers `signatureArtefacts`, pas seulement
    // dans la fonction sous-jacente).
    ok(
      signatureArtefacts({ ...base2, requirement: { minStats: { atk: 100 }, maxStats: {} } }) !== s2,
      'requirement traverse l’adaptateur jusqu’à la signature'
    );
    ok(
      signatureArtefacts({ ...base2, empreinteRelique: 'recherche|1:100:14:6:1/100/1|libre|libre|6' }) !== s2,
      'empreinteRelique aussi'
    );
    // Les réservations traversent l'adaptateur, et leur absence
    // laisse la signature d'avant (littéral relevé sur 47cecfa9).
    ok(signatureArtefacts({ ...base2, artefactsReserves: new Set([501]) }) !== s2, 'les artéfacts réservés aussi');
    ok(
      signatureArtefacts({ ...base2, piecesFigees: piecesFigeesDe({ element: 'equipped' }, [ART_ELEMENT_1]) }) !==
        signatureArtefacts({ ...base2, piecesFigees: piecesFigeesDe({ element: 'equipped' }, [ART_ELEMENT_2]) }),
      '… et les pièces des emplacements figés'
    );
    ok(
      signatureArtefacts({ ...base2, importDuCompte: 1 }) !== signatureArtefacts({ ...base2, importDuCompte: 2 }),
      '… et l’identité de l’import du compte'
    );
    egal(
      s2,
      '14311§{"skillCom2usId":4713,"enemyElement":null,"atkBuff":false,"enemyHpPct":100,"enemyDef":1000,"critMode":"crit"}§true§aucun§-§{}§§null§10§§{}§{}',
      'sans réservation, la signature de l’écran est exactement le littéral épinglé'
    );

    // Un réglage SANS effet (minimum nul dans une ligne verrouillée, déjà
    // prouvé sur `signatureReglages`) ne change rien à travers l’adaptateur
    // non plus.
    egal(
      signatureArtefacts({ ...base2, lignesVerrouillees: [{ code: 409, min: 0 }] }),
      s2,
      'un réglage sans effet (minimum nul) ne change pas la signature'
    );
  }

  titre('File d’artéfacts — l’écran passe réservations et pièces figées à la signature');

  {
    // Le hook de la file ne vide son cache qu'au changement de signature
    // (`useArtifactOptimQueue`, effet sur `[signature]`) : la fonction pure a
    // beau couvrir les réservations, encore faut-il que l'écran les lui donne
    // — et que son mémo se recalcule quand elles changent. Le dépôt n'a pas de
    // test React : un contrôle de source garde ce raccordement.
    const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
    const appel = /const signatureArtefacts = useMemo\(\s*\(\) =>\s*calculerSignatureArtefacts\(\{([\s\S]*?)\}\),\s*\[([^\]]*)\]\s*\);/.exec(ecran);
    ok(appel !== null, 'écran : la signature de la file est calculée par signatureArtefacts, dans un mémo');
    ok(/^\s*artefactsReserves,\s*$/m.test(appel?.[1] ?? ''), 'écran : la signature reçoit les artéfacts réservés');
    ok(
      (appel?.[2] ?? '').split(',').map((d) => d.trim()).includes('artefactsReserves'),
      'écran : … et son mémo se recalcule quand ils changent'
    );
    // Les MÊMES réservations que celles qui filtrent l'inventaire de
    // `artifactParams` (raccordement gardé par testArtefactsFicheParamsEcran).
    ok(
      /const artefactsReserves = useMemo\(\s*\(\) => otherValidatedArtifactIds\(lists\.validated, lists\.activeListId, ownSelectorKey\),\s*\[lists\.validated, lists\.activeListId, ownSelectorKey\]\s*\);/.test(ecran),
      'écran : ce sont les réservations de la liste ACTIVE — libérer, valider ou changer de liste les recalcule'
    );
    // Les pièces des emplacements figés : celles de la fiche affichée, pour les
    // principales choisies — et le mémo suit les artéfacts de la fiche.
    ok(
      /^\s*piecesFigees: piecesFigeesDe\(artifactMainByKind, selected\?\.gear\.artifacts \?\? \[\]\),\s*$/m.test(appel?.[1] ?? ''),
      'écran : la signature reçoit les pièces des emplacements figés de la fiche'
    );
    ok(
      (appel?.[2] ?? '').split(',').map((d) => d.trim()).includes('selected?.gear.artifacts'),
      'écran : … et son mémo se recalcule quand la fiche change d’artéfacts'
    );
  }

  titre('File d’artéfacts — chaque import du compte change la signature');

  {
    // Même raison que le bloc précédent (pas de test React) : la fonction
    // pure distingue deux imports, encore faut-il que CHAQUE import avance
    // l'identité et que l'écran la passe à la signature.
    const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
    const hook = readFileSync('src/hooks/useOptimizerState.ts', 'utf8');
    const app = readFileSync('src/App.tsx', 'utf8');
    const appel = /const signatureArtefacts = useMemo\(\s*\(\) =>\s*calculerSignatureArtefacts\(\{([\s\S]*?)\}\),\s*\[([^\]]*)\]\s*\);/.exec(ecran);
    ok(/^\s*importDuCompte,\s*$/m.test(appel?.[1] ?? ''), 'écran : la signature reçoit l’identité de l’import du compte');
    ok(
      (appel?.[2] ?? '').split(',').map((d) => d.trim()).includes('importDuCompte'),
      'écran : … et son mémo se recalcule à chaque import'
    );
    const lusDeLEtat = /const \{([^}]*)\}\s*=\s*optimizer;/.exec(ecran)?.[1] ?? '';
    ok(/^\s*importDuCompte,\s*$/m.test(lusDeLEtat), 'écran : … celle de l’état de l’Optimizer, jamais une valeur locale');
    // L'identité vit dans l'état remonté dans App.tsx (jamais démonté) : un
    // import fait depuis un autre onglet l'avance aussi.
    ok(hook.includes('const [importDuCompte, setImportDuCompte] = useState(0);'), 'état : 0 avant tout import de la session');
    const reset = /function resetSearch\(motif: 'monstre' \| 'compte' = 'monstre'\) \{([\s\S]*?)\r?\n  \}\r?\n/.exec(hook);
    ok(reset !== null, 'état : resetSearch trouvé');
    ok(
      (reset?.[1] ?? '').includes("if (motif === 'compte') setImportDuCompte((n) => n + 1);"),
      'état : CHAQUE resetSearch(\'compte\') avance l’identité d’une unité — deux imports, deux identités'
    );
    egal(hook.split('setImportDuCompte(').length - 1, 1, 'état : rien d’autre ne l’avance (un changement de monstre garde la même identité)');
    // App.tsx appelle `resetSearch('compte')` à chaque import réel, jamais à
    // la relecture du compte conservé (`hydrationJustAppliedRef`).
    ok(
      /if \(hydrationJustAppliedRef\.current\) \{\s*hydrationJustAppliedRef\.current = false;\s*return;\s*\}\s*optimizer\.resetSearch\('compte'\);/.test(app),
      'App : resetSearch(\'compte\') à chaque import réel, pas à la relecture du compte conservé'
    );
  }

  titre('File d’artéfacts — départage canonique');

  // ⚠️ À score égal, `sortCandidates` est un tri STABLE : sans départage,
  // l'ordre de sortie suit l'ordre d'entrée (celui de l'appariement), qui n'a
  // rien de canonique. `ordonnerParDepartage` (rid croissant, puis `cleBuild`)
  // s'applique AVANT ce tri stable, pour que le résultat ne dépende plus de
  // l'ordre d'arrivée des candidats.
  {
    const c1 = build(1, 2, 3, 4, 5, 6);
    const c2 = build(11, 12, 13, 14, 15, 16);
    const rid = new Map([[cleBuild(c1), 1], [cleBuild(c2), 1]]); // même rid : cleBuild départage
    const ridDe = (c: BuildCandidate) => rid.get(cleBuild(c));
    const direct = ordonnerParDepartage([c1, c2], ridDe).map(cleBuild);
    const inverse = ordonnerParDepartage([c2, c1], ridDe).map(cleBuild);
    egal(direct, inverse, 'même rid : l’ordre d’ENTRÉE ne change pas la sortie (départage par cleBuild)');
    egal(direct, [cleBuild(c1), cleBuild(c2)].sort(), 'l’ordre rendu suit cleBuild croissant, pas l’ordre d’arrivée');
  }
  {
    const c1 = build(1);
    const c2 = build(2);
    const rid = new Map([[cleBuild(c1), 5], [cleBuild(c2), 2]]);
    const ridDe = (c: BuildCandidate) => rid.get(cleBuild(c));
    egal(
      ordonnerParDepartage([c1, c2], ridDe).map(cleBuild),
      [cleBuild(c2), cleBuild(c1)],
      'rid différents : le plus petit rid passe devant, quel que soit l’ordre d’entrée'
    );
  }
  {
    // Candidat pas encore résolu (`ridDe` rend `undefined`) : toujours en
    // dernier, jamais avant un candidat déjà résolu.
    const resolu = build(1);
    const enAttente = build(2);
    const rid = new Map([[cleBuild(resolu), 3]]);
    egal(
      ordonnerParDepartage([enAttente, resolu], (c) => rid.get(cleBuild(c))).map(cleBuild),
      [cleBuild(resolu), cleBuild(enAttente)],
      'un candidat non résolu (rid absent) va en dernier'
    );
  }
}
