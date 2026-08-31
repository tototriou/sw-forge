// File d'optimisation d'artéfacts alimentée au fil de l'eau.
//
// ⚠️ Ce module ne planifie rien et ne trie rien : il répond seulement à « qui
// traiter ensuite ». Les tests portent donc sur la PRIORITÉ et sur le cache,
// jamais sur le moment où le travail est fait (voir `useArtifactOptimQueue`,
// qui a besoin d'un navigateur) ni sur le choix de la paire (artefact-optim).

import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { candidatAvecSaPaire, cleBuild, prochainsATraiter, signatureReglages } from '../src/lib/artifactQueue';
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
      [cleBuild(c2), { paire: null, artefacts: [], stats: stat(110), meilleurSansVerrous: null }],
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
  }
}
