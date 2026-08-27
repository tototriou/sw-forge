import { titre, egal, ok } from './outils';
import { statutEquipe, raisonSansVerdict, EntreeStatut } from '../src/lib/siegeStatut';
import { ResultatAuto } from '../src/lib/speedTuneAuto';

// Le statut d'une card de siège en mode « Vérifier mes tick ATB ».
//
// ⚠️ Cette décision vivait en ternaires imbriqués dans `SiegeTeam.tsx` : le jour
// où le mode a semblé « ne plus rien faire », il n'y avait aucun moyen de dire
// quel cas répondait quoi — il fallait cliquer sur ses propres équipes. Chaque
// cas est ici un test.
export default function testSiegeStatut() {
  titre('Siège — statut d’une équipe');

  const tune = (ok: boolean, cibleIndecise = false) =>
    ({ verdict: { ok }, requis: [], arte: [], ordre: [], combats: new Map(), reference: null, mods: new Map(), cibleIndecise }) as unknown as ResultatAuto;

  const base: EntreeStatut = {
    verifier: true,
    desMonstres: true,
    leo: false,
    ignoree: false,
    swift: false,
    speedTune: null,
    horsTick: false,
    slotsRemplis: 4,
    monstresConnus: 4,
  };

  // Le mode éteint : les équipes s'affichent telles quelles.
  egal(statutEquipe({ ...base, verifier: false }), 'neutre', 'mode éteint → rien de coloré');
  egal(statutEquipe({ ...base, verifier: false, horsTick: true }), 'neutre', 'même une équipe hors tick');

  // Équipe SANS Rapidité : elle se juge au tick.
  egal(statutEquipe(base), 'vert', 'tous au tick → vert');
  egal(statutEquipe({ ...base, horsTick: true }), 'rouge', 'un monstre mal calé → rouge');

  // Équipe AVEC Rapidité : elle ne se juge JAMAIS au tick, seulement au tune.
  egal(
    statutEquipe({ ...base, swift: true, horsTick: true, speedTune: tune(true) }),
    'vert',
    'Swift speed tune → vert, MÊME hors tick (le tick ne la concerne pas)'
  );
  egal(
    statutEquipe({ ...base, swift: true, horsTick: false, speedTune: tune(false) }),
    'orange',
    'Swift pas tune → orange, même si tout le monde est au tick'
  );

  // ⚠️ **QUAND LA CIBLE DÉCIDE, le siège ne tranche pas.** Un sort retenu qui ne
  // touche qu'UN allié donne un résultat différent selon qui on vise, et ce
  // choix n'appartient qu'au joueur : le siège retombe sur « la barre la plus
  // basse » pour CALCULER, ce qui ne suffit pas pour DÉCLARER.
  egal(
    statutEquipe({ ...base, swift: true, speedTune: tune(true, true) }),
    'orange',
    'cible indécise → orange, MÊME quand le verdict deviné est bon'
  );
  // ⚠️ Dans l'autre sens aussi : un « il manque tant » calculé sur une cible
  // devinée est aussi faux qu'un vert. Ce n'est pas un verdict tiède, c'est
  // l'absence de verdict.
  egal(
    statutEquipe({ ...base, swift: true, speedTune: tune(false, true) }),
    'orange',
    'et orange aussi quand il est mauvais — on ne dit pas de combien'
  );
  // Le contrôle qui empêche le test de passer pour de mauvaises raisons : sans
  // l'indécision, le vert revient.
  egal(
    statutEquipe({ ...base, swift: true, speedTune: tune(true, false) }),
    'vert',
    'cible désignée ou sort de camp → le verdict se dit comme avant'
  );
  // ⚠️ Une équipe SANS Swift se juge au tick : les sorts n'y changent rien, donc
  // l'indécision ne la concerne pas.
  egal(
    statutEquipe({ ...base, swift: false, horsTick: false, speedTune: tune(true, true) }),
    'vert',
    'une équipe jugée au tick ignore l’indécision de cible'
  );

  // Ce qu'on écarte à la main prime sur tout le reste.
  egal(statutEquipe({ ...base, ignoree: true, horsTick: true }), 'vert', 'recommandation ignorée → vert');
  egal(
    statutEquipe({ ...base, ignoree: true, swift: true, speedTune: tune(false) }),
    'vert',
    'et elle prime aussi sur un tune raté'
  );

  // Les cas sans réponse.
  egal(statutEquipe({ ...base, desMonstres: false }), 'neutre', 'équipe vide → neutre');
  egal(statutEquipe({ ...base, leo: true, horsTick: true }), 'neutre', 'Leo → neutre');
  egal(
    statutEquipe({ ...base, swift: true, speedTune: null }),
    'neutre',
    'Swift sans verdict calculable → neutre'
  );

  // ⚠️ **Le mode allumé répond TOUJOURS quelque chose.** Un statut neutre et pas
  // un mot, c'est exactement « le bouton ne fait rien » : on a demandé une
  // vérification, la card n'a pas bougé, et rien ne dit pourquoi.
  ok(raisonSansVerdict({ ...base, verifier: false }) === null, 'mode éteint : aucune raison à donner');
  ok(raisonSansVerdict(base) === null, 'un statut tranché parle de lui-même');
  ok(
    (raisonSansVerdict({ ...base, desMonstres: false }) ?? '').length > 0,
    'équipe vide : la card le dit'
  );
  ok((raisonSansVerdict({ ...base, leo: true }) ?? '').length > 0, 'Leo : la card le dit');
  ok(
    (raisonSansVerdict({ ...base, swift: true, speedTune: null }) ?? '').length > 0,
    'Swift sans verdict : la card dit pourquoi, au lieu de rester grise et muette'
  );

  // ⚠️ **Ne pas accuser l'utilisateur d'un défaut qui n'est pas le sien.** Au
  // rechargement de la page, le catalogue de monstres n'est pas encore là : les
  // slots sont remplis, les monstres pas encore reconnus. La card disait alors
  // « il faut au moins deux monstres » à une équipe qui en a quatre — et
  // envoyait corriger ce qui était déjà bon.
  {
    const enChargement = { ...base, swift: true, speedTune: null, slotsRemplis: 4, monstresConnus: 0 };
    const vraimentCourte = { ...base, swift: true, speedTune: null, slotsRemplis: 1, monstresConnus: 1 };
    const m1 = raisonSansVerdict(enChargement) ?? '';
    const m2 = raisonSansVerdict(vraimentCourte) ?? '';
    ok(m1.length > 0 && m2.length > 0, 'les deux cas disent quelque chose');
    ok(
      m1 !== m2,
      'chargement en cours et équipe trop courte ne se disent PAS de la même façon'
    );
    ok(
      !m1.includes('au moins deux monstres'),
      "une équipe de quatre monstres ne s'entend pas dire qu'il en faut deux"
    );
    ok(
      m2.includes('au moins deux monstres'),
      'une équipe qui en a vraiment un seul, si'
    );
  }
}
