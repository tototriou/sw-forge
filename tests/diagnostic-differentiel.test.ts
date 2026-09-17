// Le DIFFÉRENTIEL ENTRELACÉ — piste 11c (§5.2 bis des extensions).
//
// ⚠️ **Ce test ne vérifie pas que le moteur a raison ; il vérifie que le
// différentiel REFUSE ce qu'il doit refuser.** C'est la propriété qui compte
// ici : un différentiel qui compare tout ce qu'on lui donne rendrait des
// « divergences » qui ne sont que du bruit de troncature — exactement la
// classe d'erreur que le n° 6 existe pour empêcher, recréée un étage plus
// haut. Le portier, le préfixe et le mot `NON_COMPARABLE` sont donc les
// premiers sujets, avant toute divergence trouvée.
//
// ⚠️ **Et il verrouille le contraire du silence** : les sept éléments sont
// TOUJOURS rendus, jamais omis. Une case absente se lirait « pareil », ce qui
// est un silence remplacé par un mensonge — même doctrine que
// `NON_OBSERVABLE` au §5.1 et que les phases de temps absentes du §5.3.
//
// ⚠️ `algo-verify` ne s'y applique pas, même doctrine que
// `diagnostic-profils.test.ts` : c'est de l'OUTILLAGE, et ce qui est en jeu
// n'est pas la justesse d'un algorithme mais la fidélité de ce que le
// différentiel rapporte. Ce module n'appelle aucune fonction du moteur.

import { egal, ok, titre } from './outils';
import {
  ORDRE_LECTURE,
  executerDifferentiel,
} from '../scripts/lib/diagnosticDifferentiel';
import { trouverProfil } from '../scripts/lib/diagnosticProfils';

export default async function testDiagnosticDifferentiel() {
  titre('Différentiel entrelacé (11c) — le portier refuse-t-il ce qu’il doit refuser ?');

  /* ── L'ordre de lecture : les sept éléments, dans l'ordre du pipeline ── */

  egal(
    ORDRE_LECTURE,
    ['troncature', 'etage-perte', 'verdict', 'population', 'classement', 'near-miss', 'explored'],
    'l’ordre de lecture est celui du PIPELINE — c’est lui qui LOCALISE la divergence, pas une liste à plat'
  );

  /* ── La MÉCANIQUE, sur le profil de fumée ──────────────────────────── */

  const fumee = trouverProfil('fumee');
  const d = await executerDifferentiel(fumee, 'bucketCap', 6000, 500, { repetitions: 2 });

  // ⚠️ L'entrelacement est vérifié sur la TRACE d'exécution, pas sur une
  // promesse : `A×N puis B×N` est le protocole en BLOCS, dont le biais se
  // REPRODUIT (+4,8 % deux fois de suite, +0,3 % une fois entrelacé).
  egal(
    d.entrelacement,
    ['T1', 'C1', 'T2', 'C2'],
    'les bras ALTERNENT (témoin, comparé, témoin, comparé…) — jamais deux blocs à la suite'
  );
  egal(d.temoin.runs.length, 2, 'le témoin a bien tourné N fois');
  egal(d.compare.runs.length, 2, 'le comparé a bien tourné N fois');

  // ⚠️ Les SEPT éléments sont toujours rendus. Une case absente se lirait
  // « pareil » : c'est le défaut que `NON_COMPARABLE` existe pour empêcher.
  egal(
    d.lectures.map((l) => l.element),
    ORDRE_LECTURE,
    'les SEPT éléments sont rendus, dans l’ordre — jamais une case omise'
  );
  ok(
    d.lectures.every((l) => l.ou !== '' && l.combien !== '' && l.surCombien !== '' && l.autorise !== ''),
    'chaque lecture porte ses QUATRE champs (OÙ · COMBIEN · SUR COMBIEN · CE QUE ÇA AUTORISE), jamais moins'
  );

  // ⚠️ Le constat n° 1 de 11b, tenu en code : `fumee` ne peut RIEN détecter,
  // et le différentiel ne doit donc jamais y écrire « aucune divergence ».
  egal(d.premiereDivergence, null, 'fumee — aucun point de divergence, comme mesuré par 11b');
  egal(
    d.verdict,
    'AUCUNE_DIVERGENCE_SENSIBILITÉ_NON_ÉTABLIE',
    'un profil INSENSIBLE à cet axe rend « sensibilité non établie », JAMAIS « aucune divergence »'
  );
  egal(d.sensibilite.axeDeclareSensible, false, 'fumee ne déclare aucun axe sensible — c’est son résultat, pas un oubli');

  // ⚠️ Deux bras COMPLETS n'ont pas de préfixe : c'est ce qui supprime le
  // portier, le plancher et le bruit d'un seul coup (exigence n° 1 de 11a).
  egal(d.admissibilite.portier, 'OUVERT', 'fumee — deux bras complets : le portier est ouvert');
  egal(d.admissibilite.prefixe, 'SANS_OBJET', 'deux bras COMPLETS n’ont pas de préfixe partiel à comparer');

  /* ── Une VRAIE divergence, LOCALISÉE ───────────────────────────────── */

  const sensible = trouverProfil('complet-sensible');
  const div = await executerDifferentiel(sensible, 'bucketCap', 6000, 500);

  egal(div.verdict, 'DIVERGENCE_LOCALISÉE', 'complet-sensible — bucketCap 6000 → 500 produit une divergence');
  egal(
    div.premiereDivergence,
    'population',
    'le PREMIER point de divergence est la POPULATION — pas le classement, qui viendrait après dans le pipeline'
  );
  const population = div.lectures.find((l) => l.element === 'population')!;
  egal(population.etat, 'DIVERGENT', 'la population diverge');
  ok(
    population.combien.includes('candidats'),
    `COMBIEN est dans l’unité de l’élément (des candidats), reçu « ${population.combien} »`
  );

  // ⚠️ Le constat n° 3 de 11b, verrouillé : le RANG ne bouge PAS alors que la
  // POPULATION bouge. Un différentiel qui ne lirait que le rang ne verrait
  // rien ici — c'est la justification vivante d'un oracle multi-éléments.
  const classement = div.lectures.find((l) => l.element === 'classement')!;
  egal(classement.etat, 'IDENTIQUE', 'le RANG de la cible ne bouge pas sous bucketCap');
  ok(
    classement.autorise.includes('populations DIFFÉRENTES'),
    'un rang identique sur des populations DIFFÉRENTES est DIT, jamais rendu comme « à pool égal »'
  );
  ok(
    classement.surCombien.includes('populations'),
    'le rang part TOUJOURS avec sa population — un rang seul est illisible'
  );

  /* ── Le PORTIER — la propriété qui compte le plus ───────────────────── */

  // Un bras tronqué par quota contre un bras complet : les deux n'ont pas
  // parcouru le même espace, donc rien de ce qui dépend du préfixe ne se
  // compare — pas même deux valeurs qui se trouveraient égales.
  const portier = await executerDifferentiel(sensible, 'maxCollected', 1000, 100000);

  egal(portier.admissibilite.portier, 'FERMÉ', 'motifs de troncature différents → le PORTIER ferme');
  egal(portier.premiereDivergence, 'troncature', 'la troncature est la seule divergence rendue — c’est un ARRÊT');
  for (const element of ['verdict', 'population', 'classement', 'explored'] as const) {
    egal(
      portier.lectures.find((l) => l.element === element)?.etat,
      'NON_COMPARABLE',
      `portier fermé — « ${element} » est NON_COMPARABLE, jamais une case vide qui se lirait « pareil »`
    );
  }
  // ⚠️ **Et l'étage de perte SURVIT au portier**, ce n'est pas une exception
  // de confort : il est évalué sur la STRUCTURE des compartiments, en amont de
  // toute troncature. Le fermer aussi jetterait la seule information qui
  // reste — « le refus est LOCAL, jamais global » (§5.2 bis, règle 3).
  egal(
    portier.lectures.find((l) => l.element === 'etage-perte')?.etat,
    'IDENTIQUE',
    'l’étage de perte reste LISIBLE malgré le portier fermé — il ne dépend d’aucun préfixe'
  );
  // ⚠️ Le cas exact de la mesure I de 11a : deux rangs très différents
  // (#396/1 000 contre #1 424/27 449) qui ne disent RIEN, la population ayant
  // changé. Les rendre comparables ferait lire « le paramètre déplace la
  // cible de mille rangs ».
  const classementFerme = portier.lectures.find((l) => l.element === 'classement')!;
  ok(
    classementFerme.temoin !== classementFerme.compare,
    'les deux rangs DIFFÈRENT franchement, et c’est exactement pourquoi ils ne doivent pas être comparés'
  );
}
