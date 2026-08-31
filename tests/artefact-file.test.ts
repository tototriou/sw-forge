// File d'optimisation d'artéfacts alimentée au fil de l'eau.
//
// ⚠️ Ce module ne planifie rien et ne trie rien : il répond seulement à « qui
// traiter ensuite ». Les tests portent donc sur la PRIORITÉ et sur le cache,
// jamais sur le moment où le travail est fait (voir `useArtifactOptimQueue`,
// qui a besoin d'un navigateur) ni sur le choix de la paire (artefact-optim).

import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { cleBuild, prochainsATraiter, signatureReglages } from '../src/lib/artifactQueue';
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
    // ⚠️ Le même build peut figurer DEUX FOIS dans l'aperçu accumulé : les
    // deltas d'un Worker relancé après escalade peuvent le renvoyer. Sans
    // garde, il partirait deux fois en file et le travail serait refait.
    const avecDoublon = [build(1), build(1), build(2)];
    egal(
      prochainsATraiter(avecDoublon, new Set(), 5).map(cleBuild),
      ['1', '2'],
      'un build présent deux fois n’est mis en file qu’une seule fois'
    );
  }

  titre('File d’artéfacts — ce qui invalide le cache');

  {
    const base = {
      monstreCom2usId: 14311,
      skillCom2usId: 4713,
      elementVise: null,
      principaleParSorte: { element: 101 },
      lignesVerrouillees: [] as { code: number; min: number }[],
      nbArtefacts: 2518,
    };
    const s = signatureReglages(base);
    // ⚠️ Tout ce qui change quelles LIGNES comptent change la paire gagnante
    // (`analyserPertinence`). Garder le cache afficherait des paires optimales
    // pour un réglage que l'utilisateur a quitté.
    ok(signatureReglages({ ...base, elementVise: 'wind' }) !== s, 'changer l’élément visé invalide le cache');
    ok(signatureReglages({ ...base, skillCom2usId: 4712 }) !== s, 'changer de sort aussi');
    ok(signatureReglages({ ...base, principaleParSorte: { element: 100 } }) !== s, '… et la stat principale exigée');
    ok(signatureReglages({ ...base, lignesVerrouillees: [{ code: 409, min: 15 }] }) !== s, '… et une ligne verrouillée');
    ok(signatureReglages({ ...base, nbArtefacts: 2519 }) !== s, '… et l’arrivée d’un artéfact en inventaire');

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
