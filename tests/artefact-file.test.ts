// File d'optimisation d'artéfacts alimentée au fil de l'eau.
//
// ⚠️ Ce module ne planifie rien et ne trie rien : il répond seulement à « qui
// traiter ensuite ». Les tests portent donc sur la PRIORITÉ et sur le cache,
// jamais sur le moment où le travail est fait (voir `useArtifactOptimQueue`,
// qui a besoin d'un navigateur) ni sur le choix de la paire (artefact-optim).

import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { candidatAvecSaPaire, cleBuild, ordonnerParDepartage, prochainsATraiter, signatureReglages, signatureArtefacts } from '../src/lib/artifactQueue';
import { regimeEquipementDe } from '../src/lib/artifactEvaluation';
import { egal, ok, titre } from './outils';

const build = (...runeIds: number[]) => ({ runeIds }) as unknown as BuildCandidate;

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
      prochainsATraiter(triees, new Set(), 3).map(cleBuild),
      ['1', '2', '3'],
      'seuls les K mieux classés entrent en file, dans l’ordre reçu'
    );
    // ⚠️ Le tri vient de `sortCandidates` (source unique) : ce module ne trie
    // PAS. Un second tri ici finirait par diverger de celui de l’écran — le
    // défaut qui avait fait lire `candidates[0]` comme « le meilleur ».
    egal(
      prochainsATraiter(triees, new Set(['1', '2']), 3).map(cleBuild),
      ['3'],
      'ce qui est déjà en cache ne repasse pas en file'
    );
    egal(prochainsATraiter(triees, new Set(['1', '2', '3']), 3), [], 'les K premiers tous traités : plus rien à faire');
    // ⚠️ Un build hors des K n'est PAS repêché parce que les K premiers sont
    // finis : le plafond porte sur le RANG, pas sur le nombre restant.
    egal(
      prochainsATraiter(triees, new Set(['1', '2', '3']), 3).length,
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
      prochainsATraiter(avecDoublon, new Set(), 5).map(cleBuild),
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
      prochainsATraiter(triees, new Set(), 2, page).map(cleBuild),
      ['40', '41', '1', '2'],
      'la page consultée est traitée EN PREMIER, puis le top K'
    );
    // ⚠️ Sans la page, ces builds ne seraient JAMAIS servis — c'est le défaut
    // que ce paramètre corrige.
    egal(
      prochainsATraiter(triees, new Set(), 2).map(cleBuild),
      ['1', '2'],
      'sans page fournie, seul le top K est traité (comportement d’origine)'
    );
    // ⚠️ Un build de la page figure PRESQUE TOUJOURS aussi dans le top K : la
    // déduplication n'est donc plus défensive, elle est nécessaire.
    egal(
      prochainsATraiter(triees, new Set(), 3, [build(2)]).map(cleBuild),
      ['2', '1', '3'],
      'un build à la fois dans la page ET dans le top K n’est mis en file qu’UNE fois'
    );
    // Et le cache prime toujours : rien n’est refait, même sur la page.
    egal(
      prochainsATraiter(triees, new Set(['40']), 1, page).map(cleBuild),
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
    // Lot 5b : la dimension relique de la recherche — l'empreinte canonique
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

    // ⚠️ **B.5b bis, BLOQUANT 2 de la revue** (`revue-diff-lot5b-2026-09-21.md`) :
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
  }

  titre('File d’artéfacts — signatureArtefacts (la closure de l’écran, extraite, B.5c)');

  {
    // ⚠️ `signatureArtefacts` (artifactQueue.ts) est la closure d'écran
    // extraite : elle n'assemble RIEN de nouveau, elle relaie `regimeEquipement`
    // vers `objective` (signatureReglages) sous un nom qui protège CONTRE le
    // bug déjà survenu (B.5b bis, contrôle 4 : le mauvais régime — brut,
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

    // Un réglage SANS effet (minimum nul dans une ligne verrouillée, déjà
    // prouvé sur `signatureReglages`) ne change rien à travers l’adaptateur
    // non plus.
    egal(
      signatureArtefacts({ ...base2, lignesVerrouillees: [{ code: 409, min: 0 }] }),
      s2,
      'un réglage sans effet (minimum nul) ne change pas la signature'
    );
  }

  titre('File d’artéfacts — départage canonique (B.5b bis, mineur de la revue)');

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
