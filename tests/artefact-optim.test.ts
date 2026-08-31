// Choix de la meilleure PAIRE d'artéfacts pour un build donné.
//
// ⚠️ La recherche étant EXHAUSTIVE, il n'y a pas d'heuristique à valider
// contre une référence : c'est la sélection des candidats et la contrainte de
// paire qui peuvent être fausses, pas l'optimum. Ces tests portent donc sur
// « quels candidats entrent dans la boucle », jamais sur « le tri trouve-t-il
// le maximum ».

import { ArtifactArchetype, ArtifactDetail, ElementKey } from '../src/types';
import {
  candidatsParSorte,
  meilleuresPairesArtefacts,
  nombreDePaires,
  paireRepresentative,
  respecteMinimums,
  type ArtifactSearchParams,
} from '../src/lib/artifactOptim';
import { egal, ok, titre } from './outils';

const attribut = (element: ElementKey, main = 101, sub = 0): ArtifactDetail => ({
  kind: 'element',
  element,
  level: 15,
  rarity: 5,
  main: { code: main, value: 300 },
  subs: sub ? [{ code: 300, value: sub }] : [],
});
const type = (archetype: ArtifactArchetype, main = 101, sub = 0): ArtifactDetail => ({
  kind: 'archetype',
  archetype,
  level: 15,
  rarity: 5,
  main: { code: main, value: 300 },
  subs: sub ? [{ code: 300, value: sub }] : [],
});
const joker = (kind: 'element' | 'archetype'): ArtifactDetail =>
  kind === 'element' ? { ...attribut('unknown'), intangible: true } : { ...type('support'), intangible: true };

const lushen = { element: 'dark' as ElementKey, archetype: 'attack' as ArtifactArchetype };

// Score bidon : la somme des valeurs de substat. Suffit pour vérifier QUI est
// comparé — la justesse du score de dégâts est couverte par degats.test.ts.
const parSubs = (arts: ArtifactDetail[]) => arts.reduce((n, a) => n + a.subs.reduce((s, x) => s + x.value, 0), 0);

export default function testArtefactOptim() {
  titre('Optimisation d’artéfacts — sélection des candidats');

  const inventaire: ArtifactDetail[] = [
    attribut('dark', 101, 10), // éligible
    attribut('dark', 100, 25), // éligible, principale PV
    attribut('fire', 101, 99), // PAS éligible (mauvais élément) — et le meilleur score
    type('attack', 101, 12), // éligible
    type('hp', 101, 99), // PAS éligible (mauvais archétype) — meilleur score aussi
  ];
  const base: ArtifactSearchParams = {
    porteur: lushen,
    inventaire,
    equipes: [],
    principaleParSorte: {},
    evaluer: parSubs,
  };

  // ⚠️ Le piège que ces deux artéfacts à 99 tendent : un filtrage d'éligibilité
  // oublié se verrait tout de suite, puisqu'ils gagneraient.
  const meilleure = meilleuresPairesArtefacts(base)[0]!;
  egal(meilleure.element?.subs[0]?.value, 25, 'le meilleur attribut ÉLIGIBLE est retenu, pas le meilleur tout court');
  egal(meilleure.archetype?.subs[0]?.value, 12, 'idem côté type');
  egal(meilleure.score, 37, 'le score de la paire est bien la somme des deux');

  // `null` est toujours proposé : un emplacement vide reste une option.
  ok(
    candidatsParSorte(base, 'element').includes(null),
    'un emplacement vide figure toujours parmi les candidats'
  );
  egal(candidatsParSorte(base, 'element').length, 3, '… en plus des 2 attributs éligibles');
  egal(candidatsParSorte(base, 'archetype').length, 2, 'et du seul type éligible');

  titre('Optimisation d’artéfacts — contrainte de la stat principale');

  egal(
    candidatsParSorte({ ...base, principaleParSorte: { element: 100 } }, 'element').length,
    2,
    '« principale = PV » ne laisse que l’artéfact PV (plus l’emplacement vide)'
  );
  egal(
    candidatsParSorte({ ...base, principaleParSorte: { element: 'none' } }, 'element'),
    [null],
    '« aucun » ne laisse QUE l’emplacement vide'
  );
  egal(
    candidatsParSorte({ ...base, principaleParSorte: { element: 'libre' } }, 'element').length,
    3,
    '« libre » reprend tous les éligibles'
  );

  {
    // « Comme équipé » ne cherche PAS : il garde ce qui est porté.
    const porte = attribut('dark', 101, 1);
    const avecEquipe = { ...base, equipes: [porte], principaleParSorte: { element: 'equipped' as const } };
    egal(candidatsParSorte(avecEquipe, 'element'), [porte], '« comme équipé » fige l’emplacement sur la pièce portée');
    // ⚠️ …mais vérifie quand même l'éligibilité : un équipement importé peut
    // ne plus correspondre au monstre. Mieux vaut vide qu'inéquipable.
    const porteFaux = { ...base, equipes: [attribut('fire', 101, 1)], principaleParSorte: { element: 'equipped' as const } };
    egal(candidatsParSorte(porteFaux, 'element'), [null], 'une pièce portée devenue INÉLIGIBLE retombe sur l’emplacement vide');
  }

  titre('Optimisation d’artéfacts — l’intangible et sa contrainte de paire');

  {
    // Deux jokers, chacun bien meilleur que tout le reste : la paire des deux
    // est pourtant interdite.
    const jokerAttribut = { ...joker('element'), subs: [{ code: 300, value: 50 }] };
    const jokerType = { ...joker('archetype'), subs: [{ code: 300, value: 50 }] };
    const avecJokers: ArtifactSearchParams = {
      ...base,
      inventaire: [...inventaire, jokerAttribut, jokerType],
    };
    ok(
      candidatsParSorte(avecJokers, 'element').includes(jokerAttribut),
      'un intangible d’attribut est éligible quel que soit l’élément du monstre'
    );
    ok(
      candidatsParSorte(avecJokers, 'archetype').includes(jokerType),
      '… et un intangible de type quel que soit l’archétype'
    );

    const top = meilleuresPairesArtefacts(avecJokers, 3);
    // ⚠️ LE test de ce fichier : la paire à 100 (les deux jokers) est la
    // meilleure sur le papier et n'est JAMAIS proposée.
    ok(
      !top.some((p) => p.element?.intangible && p.archetype?.intangible),
      'la paire de DEUX intangibles n’est jamais proposée, malgré le meilleur score'
    );
    // ⚠️ Et le meilleur réel n'est PAS « le meilleur joker + le meilleur de
    // l'autre sorte » : garder le joker CÔTÉ TYPE (50) avec le meilleur
    // attribut ordinaire (25) donne 75, contre 62 pour l'inverse (joker
    // d'attribut 50 + meilleur type ordinaire 12). C'est exactement ce qu'un
    // choix glouton par emplacement raterait — il faut bien parcourir les
    // paires.
    egal(top[0]!.score, 75, 'le meilleur garde le joker du côté où il rapporte le plus (25 + 50)');
    ok(
      (top[0]!.element?.intangible ?? false) !== (top[0]!.archetype?.intangible ?? false),
      '… soit exactement UN intangible sur les deux emplacements'
    );
  }

  titre('Optimisation d’artéfacts — ampleur de la recherche');

  // ⚠️ `nombreDePaires` doit compter EXACTEMENT ce que la boucle parcourt,
  // contrainte de paire comprise — sinon l'ampleur annoncée ment.
  {
    const avecJokers: ArtifactSearchParams = {
      ...base,
      inventaire: [...inventaire, joker('element'), joker('archetype')],
    };
    egal(nombreDePaires(avecJokers), meilleuresPairesArtefacts(avecJokers, 9999).length, 'l’ampleur annoncée est celle réellement parcourue');
    // 4 attributs (2 éligibles + 1 joker + vide) × 3 types (1 + joker + vide)
    // = 12, moins la paire joker+joker interdite = 11.
    egal(nombreDePaires(avecJokers), 11, 'et vaut bien 4 × 3 − 1 (la paire de jokers exclue)');
  }

  titre('Optimisation d’artéfacts — la paire SUPPOSÉE pendant la recherche de runes');

  // ⚠️ Le sélecteur de stat principale fabriquait un artéfact SANS substats :
  // choisir « ATQ » faisait calculer les dégâts SANS aucune ligne d'effet,
  // là où « Comme équipé » les comptait. Deux réglages voisins, deux modèles
  // de dégâts, sans que rien ne le signale.
  {
    const avecLignes = { ...attribut('dark', 101, 30), subs: [{ code: 204, value: 20 }] };
    const p: ArtifactSearchParams = {
      porteur: lushen,
      inventaire: [avecLignes, attribut('dark', 100, 5), type('attack', 101, 7)],
      equipes: [],
      principaleParSorte: { element: 101 },
      evaluer: parSubs,
    };
    const supposee = paireRepresentative(p);
    const attributSuppose = supposee.find((a) => a.kind === 'element');
    ok(attributSuppose != null, 'une paire représentative est bien proposée');
    ok(
      (attributSuppose?.subs.length ?? 0) > 0,
      'l’artéfact supposé porte ses VRAIES lignes d’effet, jamais une coquille vide'
    );
    egal(attributSuppose?.main.code, 101, '… tout en respectant la principale demandée');
  }

  titre('Optimisation d’artéfacts — les minimums se revérifient APRÈS le choix');

  // ⚠️ La recherche de runes valide les minimums avec la paire SUPPOSÉE. Si la
  // paire finale porte une autre principale, un minimum peut être franchi à la
  // baisse en silence — un build affiché qui viole la condition demandée est
  // pire qu'un build manquant, personne ne le revérifie.
  {
    const stats = [
      { key: 'atk', total: 3400 },
      { key: 'cr', total: 100 },
    ];
    ok(respecteMinimums(stats, { atk: 3000, cr: 100 }), 'tous les minimums atteints');
    ok(!respecteMinimums(stats, { atk: 3600 }), 'un minimum franchi à la baisse est bien détecté');
    ok(respecteMinimums(stats, { atk: 0, def: undefined }), 'un minimum nul ou absent n’exige rien');
    ok(!respecteMinimums(stats, { spd: 100 }), 'une stat ABSENTE des stats compte comme non satisfaite');
  }
}
