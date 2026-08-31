// Choix de la meilleure PAIRE d'artéfacts pour un build donné.
//
// ⚠️ La recherche étant EXHAUSTIVE, il n'y a pas d'heuristique à valider
// contre une référence : c'est la sélection des candidats et la contrainte de
// paire qui peuvent être fausses, pas l'optimum. Ces tests portent donc sur
// « quels candidats entrent dans la boucle », jamais sur « le tri trouve-t-il
// le maximum ».

import { ArtifactArchetype, ArtifactDetail, ElementKey } from '../src/types';
import {
  budgetEmplacements,
  analyserPertinence,
  candidatsParSorte,
  preFiltrerCandidats,
  chercherPaires,
  meilleurCumulParLigne,
  meilleuresPairesArtefacts,
  nombreDePaires,
  nombreDePairesRetenues,
  paireRepresentative,
  paireRespecteLignes,
  plafondLigne,
  respecteMinimums,
  type ArtifactSearchParams,
} from '../src/lib/artifactOptim';
import { ARTIFACT_SUB_MAX } from '../src/lib/artifacts';
import { formatArtifactSub, splitArtifactSub, valeurArtefactPropre } from '../src/lib/effects';
import { egal, ok, titre } from './outils';

const attribut = (element: ElementKey, main = 101, sub = 0): ArtifactDetail => ({
  id: 0, kind: 'element',
  element,
  level: 15,
  rarity: 5,
  main: { code: main, value: 300 },
  subs: sub ? [{ code: 300, value: sub }] : [],
});
const type = (archetype: ArtifactArchetype, main = 101, sub = 0): ArtifactDetail => ({
  id: 0, kind: 'archetype',
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
    // ⚠️ Le compte porte sur les candidats APRÈS élagage, dominance comprise —
    // c'est bien ce que la boucle parcourt, et l'égalité ci-dessus le
    // verrouille. Un nombre figé ici mesurerait l'inventaire de ce test, pas le
    // contrat ; ce qui compte, c'est que la paire de jokers reste exclue.
    ok(
      meilleuresPairesArtefacts(avecJokers, 9999).every((p) => !(p.element?.intangible && p.archetype?.intangible)),
      'et la paire de DEUX intangibles reste exclue du compte'
    );
  }

  titre('Dominance — un intangible n’élimine JAMAIS un artéfact ordinaire');

  // ⚠️ Le bug que ce test verrouille : l'intangible traîne une contrainte de
  // PAIRE qu'aucune dimension du vecteur ne porte. S'il élimine l'ordinaire
  // qu'il domine, toute paire dont l'AUTRE emplacement est déjà intangible
  // devient infaisable — un candidat légal perdu en silence. Troisième
  // occurrence de ce piège dans ce dépôt.
  {
    // Le joker d'attribut domine l'ordinaire sur tout : même principale, et
    // une ligne en plus.
    const jokerFort: ArtifactDetail = { ...joker('element'), subs: [{ code: 300, value: 50 }] };
    const ordinaire: ArtifactDetail = { ...attribut('dark'), subs: [{ code: 300, value: 10 }] };
    const jokerType: ArtifactDetail = { ...joker('archetype'), subs: [{ code: 409, value: 50 }] };
    const p: ArtifactSearchParams = {
      porteur: lushen,
      inventaire: [jokerFort, ordinaire, jokerType],
      equipes: [],
      principaleParSorte: {},
      evaluer: parSubs,
    };
    const pert = analyserPertinence(p);
    const restants = preFiltrerCandidats(candidatsParSorte(p, 'element'), 'element', [], pert);
    ok(restants.includes(ordinaire), 'l’ordinaire survit, bien que dominé sur toutes les dimensions');
    // …et la meilleure paire l'utilise vraiment : le joker d'attribut serait
    // meilleur, mais il est incompatible avec le joker de type qui vaut plus.
    const top = meilleuresPairesArtefacts(p, 1)[0]!;
    egal(top.archetype, jokerType, 'le joker part du côté où il rapporte le plus');
    egal(top.element, ordinaire, '… et l’ordinaire, sauvé de l’élagage, prend l’autre emplacement');
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

  titre('Lignes verrouillées — le minimum se lit sur la PAIRE');

  // ⚠️ 219 (« Dégâts add. par % de l'ATQ ») est en 200-299 : les DEUX sortes
  // peuvent la porter, donc ses valeurs se cumulent. C'est le relevé en jeu de
  // Jessica (2 % de PV = cumul type + attribut, alors qu'une pièce plafonne à
  // 1,5 %) qui a établi cette règle.
  {
    const attr219 = { ...attribut('dark'), subs: [{ code: 219, value: 12 }] };
    const type219 = { ...type('attack'), subs: [{ code: 219, value: 9 }] };

    ok(paireRespecteLignes([attr219, type219], [{ code: 219, min: 21 }]), '12 + 9 satisfait un minimum de 21');
    ok(!paireRespecteLignes([attr219, type219], [{ code: 219, min: 22 }]), '… mais pas de 22');
    ok(
      !paireRespecteLignes([attr219], [{ code: 219, min: 21 }]),
      'une seule pièce ne suffit pas quand le minimum dépasse ce qu’elle porte'
    );
    ok(paireRespecteLignes([], [{ code: 219, min: 0 }]), 'un minimum nul n’exige rien');
    ok(paireRespecteLignes([attr219], undefined), 'aucun verrou : tout passe');
  }

  titre('Lignes verrouillées — le bruit de virgule flottante de com2us');

  // ⚠️ **Le bruit vient de l'export, pas d'un calcul à nous.** Relevé dans le
  // fichier brut d'un compte réel : le code 218 y prend les valeurs
  // `0.8999999999999998`, `1.0999999999999999`, `1.4000000000000001`… Le jeu
  // accumule ses rolls en flottant et sérialise le résultat tel quel ; l'import
  // le lit sans y toucher.
  {
    // ⚠️ **Cas MESURÉ, pas inventé.** Sur l'inventaire réel, 55 couples de
    // valeurs du code 218 somment sous leur cible arrondie. Celui-ci est le
    // plus parlant : deux valeurs pourtant PROPRES à l'écran (0,1 et 0,7)
    // donnent 0.7999999999999999 — donc strictement moins que 0,8.
    const attr = { ...attribut('dark'), subs: [{ code: 218, value: 0.1 }] };
    const typ = { ...type('attack'), subs: [{ code: 218, value: 0.7 }] };
    ok(0.1 + 0.7 < 0.8, 'la situation est bien celle du bruit : 0,1 + 0,7 tombe SOUS 0,8');

    // SANS tolérance, cette paire serait REJETÉE face à un minimum de 0,8 —
    // alors que l'écran affiche 0,1 et 0,7 des deux côtés. Un refus
    // incompréhensible et invisible.
    ok(
      paireRespecteLignes([attr, typ], [{ code: 218, min: 0.8 }]),
      'une somme bruitée juste sous le minimum est ACCEPTÉE (tolérance)'
    );
    // …mais la tolérance ne laisse rien passer de RÉEL : le plus petit écart
    // entre deux valeurs de cette ligne est 0,1, cent mille fois l'epsilon.
    ok(
      !paireRespecteLignes([attr, typ], [{ code: 218, min: 0.9 }]),
      '… alors qu’un manque RÉEL (0,1 d’écart) reste refusé'
    );
  }

  titre('Affichage — la valeur bruitée est nettoyée, jamais tronquée');

  {
    // ⚠️ Arrondi à 2 décimales, JAMAIS à l'entier : les lignes
    // proportionnelles valent des dixièmes (0,1 à 1,4 sur 1 588 artéfacts
    // réels), et arrondir à l'unité écraserait 1,4 en 1.
    egal(valeurArtefactPropre(1.4000000000000001), 1.4, 'le bruit disparaît');
    egal(valeurArtefactPropre(0.8999999999999998), 0.9, '… y compris par en dessous');
    egal(valeurArtefactPropre(54), 54, 'une valeur entière reste intacte');
    egal(valeurArtefactPropre(1.4), 1.4, 'une décimale RÉELLE est préservée, pas arrondie à l’unité');
    // Le libellé complet ne doit plus porter la traîne.
    ok(
      !formatArtifactSub({ code: 218, value: 1.4000000000000001 }).includes('0000'),
      'le libellé affiché ne montre plus « 1.4000000000000001 »'
    );
    // ⚠️ Et le découpage autour de la valeur doit suivre : bâti sur la valeur
    // BRUTE, son motif ne matcherait plus la chaîne nettoyée, et la ligne
    // perdrait sa teinte de valeur en silence.
    egal(
      splitArtifactSub({ code: 218, value: 1.4000000000000001 }).valeur,
      '1.4%',
      'le découpage retrouve la valeur nettoyée dans le texte'
    );
  }

  titre('Lignes verrouillées — le plafond NE double pas pour toutes');

  // ⚠️ LE piège de cette fonctionnalité. Doubler le plafond « par symétrie »
  // laisserait saisir 60 % sur une ligne qu'une seule pièce peut porter —
  // une exigence que RIEN ne peut jamais satisfaire, sans que rien ne le dise.
  {
    // 219 : plage 200-299, les deux sortes → cumulable.
    egal(plafondLigne(219), ARTIFACT_SUB_MAX[219] * 2, 'une ligne des DEUX sortes double son plafond');
    // 307 (« Dégâts reçus du Vent ») : plage 300-399, attribut SEUL.
    egal(plafondLigne(307), ARTIFACT_SUB_MAX[307], 'une ligne d’ATTRIBUT garde son plafond simple');
    // 409 (« Précision Compétence 3 ») : plage 400-499, type SEUL.
    egal(plafondLigne(409), ARTIFACT_SUB_MAX[409], 'une ligne de TYPE garde son plafond simple');
    // 203 : ancienne ligne, sans fourchette connue.
    egal(plafondLigne(203), 0, 'une ligne sans fourchette connue rend 0, jamais un plafond deviné');
  }

  titre('Lignes verrouillées — arithmétique des emplacements');

  // ⚠️ Un artéfact porte 4 sous-propriétés, la paire 8, en DEUX MOITIÉS DE 4
  // qui ne communiquent pas. Cette arithmétique-là a déjà été fausse deux fois
  // dans ce dépôt en la généralisant par analogie — chaque cas est donc testé,
  // y compris ceux qui « devraient » découler des autres.
  {
    const typeOnly = (code: number) => ({ code, min: 1 });
    // 4 lignes de type : tient tout juste.
    const b4 = budgetEmplacements([404, 405, 406, 409].map(typeOnly));
    egal(b4.type, 4, '4 lignes réservées au type occupent 4 emplacements');
    ok(!b4.impossible, '… ce qui tient exactement dans la moitié « type »');
    // 5 : impossible, quelle que soit la richesse de l'inventaire.
    const b5 = budgetEmplacements([404, 405, 406, 409, 400].map(typeOnly));
    ok(b5.impossible, '5 lignes réservées au type sont impossibles d’avance');
    // Les deux moitiés ne se prêtent RIEN : 4 type + 4 attribut = 8, valide.
    const plein = budgetEmplacements([
      ...[404, 405, 406, 409].map(typeOnly),
      ...[300, 301, 302, 303].map(typeOnly),
    ]);
    egal([plein.attribut, plein.type], [4, 4], '4 + 4 se répartissent bien dans les deux moitiés');
    ok(!plein.impossible, '… et remplissent les 8 emplacements sans déborder');
    // ⚠️ Le cas que la seule somme raterait : une ligne cumulable dont le
    // minimum dépasse le plafond d'UNE pièce exige les DEUX, donc un
    // emplacement de CHAQUE côté — pas un seul « libre ».
    const surPlafond = budgetEmplacements([{ code: 219, min: ARTIFACT_SUB_MAX[219] + 1 }]);
    egal([surPlafond.attribut, surPlafond.type, surPlafond.libres], [1, 1, 0], 'au-delà du plafond d’une pièce, la ligne occupe les DEUX moitiés');
    const sousPlafond = budgetEmplacements([{ code: 219, min: ARTIFACT_SUB_MAX[219] }]);
    egal([sousPlafond.attribut, sousPlafond.type, sousPlafond.libres], [0, 0, 1], '… alors qu’à hauteur du plafond, une seule pièce suffit');
    // ⚠️ La 3ᵉ condition n'est PAS impliquée par les deux premières : 3 lignes
    // par moitié (6) + 3 libres = 9 > 8, alors qu'aucune moitié ne dépasse 4.
    const troisTrois = budgetEmplacements([
      ...[404, 405, 406].map(typeOnly),
      ...[300, 301, 302].map(typeOnly),
      ...[219, 220, 221].map(typeOnly),
    ]);
    egal([troisTrois.attribut, troisTrois.type, troisTrois.libres], [3, 3, 3], '3 + 3 réservées, 3 libres');
    ok(troisTrois.impossible, '… soit 9 lignes pour 8 emplacements : impossible, bien qu’aucune moitié ne déborde');
    // Et le cas limite juste en dessous : 3 + 3 + 2 = 8, valide.
    ok(
      !budgetEmplacements([
        ...[404, 405, 406].map(typeOnly),
        ...[300, 301, 302].map(typeOnly),
        ...[219, 220].map(typeOnly),
      ]).impossible,
      'à 8 pile, ça passe encore'
    );
    egal(budgetEmplacements([{ code: 219, min: 0 }]).libres, 0, 'un minimum nul ne réserve aucun emplacement');
  }

  titre('Lignes verrouillées — le filtre, et le coût qu’il chiffre');

  {
    // Le meilleur sur le papier ne porte PAS la ligne exigée : c'est tout
    // l'intérêt du verrou, et ce qu'un filtre oublié laisserait gagner.
    const gros = { ...attribut('dark'), subs: [{ code: 300, value: 40 }] };
    const conforme = { ...attribut('dark'), subs: [{ code: 300, value: 10 }, { code: 307, value: 25 }] };
    // ⚠️ Code 409 (« Précision Compétence 3 »), pas 300 : les 300-399 ne
    // tombent QUE sur un artéfact d'attribut. Un artéfact de type porteur d'une
    // ligne élémentaire n'existe pas en jeu — et une donnée de test impossible
    // fait passer un test pour la mauvaise raison.
    const piece = { ...type('attack'), subs: [{ code: 409, value: 5 }] };
    const p: ArtifactSearchParams = {
      porteur: lushen,
      inventaire: [gros, conforme, piece],
      equipes: [],
      principaleParSorte: {},
      evaluer: parSubs,
    };

    const sans = chercherPaires(p);
    egal(sans.paires[0]?.element?.subs[0]?.value, 40, 'sans verrou, le plus gros score gagne');
    egal(sans.meilleurSansVerrous, null, '… et il n’y a aucun coût à chiffrer');

    const avec = chercherPaires({ ...p, lignesVerrouillees: [{ code: 307, min: 20 }], avecCoutDesVerrous: true });
    egal(avec.paires[0]?.element, conforme, 'avec verrou, seule la paire conforme est retenue');
    // ⚠️ Le coût se chiffre dans le MÊME balayage : 45 (gros + type) contre
    // 40 (conforme + type) une fois le verrou posé.
    egal(avec.meilleurSansVerrous, 45, 'le meilleur SANS verrou est rapporté par le même parcours');
    egal(avec.paires[0]?.score, 40, '… face au meilleur AVEC verrou');

    // ⚠️ Aucune paire ne passe → tableau VIDE, jamais un repli sur une paire
    // qui viole l'exigence : elle s'afficherait sans que rien ne le signale.
    const impossible = chercherPaires({ ...p, lignesVerrouillees: [{ code: 307, min: 99 }], avecCoutDesVerrous: true });
    egal(impossible.paires, [], 'aucune paire conforme : rien n’est retenu, pas un repli silencieux');
    egal(impossible.meilleurSansVerrous, 45, '… mais le coût reste chiffrable');

    egal(nombreDePairesRetenues({ ...p, lignesVerrouillees: [{ code: 307, min: 20 }] }), 2, 'le compte des paires RETENUES suit le verrou');
    egal(nombreDePaires(p), 6, '… alors que le compte des paires PARCOURUES ne bouge pas');

    titre('Lignes verrouillées — diagnostiquer depuis l’inventaire, jamais depuis la théorie');

    // ⚠️ Le « au mieux » est OBSERVÉ : c'est ce que l'inventaire a réellement
    // produit, pas une déduction. Une déduction pourrait annoncer
    // « impossible » sur une combinaison réalisable — bien pire que se taire.
    const diag = meilleurCumulParLigne(p, [
      { code: 307, min: 20 },
      { code: 300, min: 99 },
    ]);
    egal(diag[0], { code: 307, min: 20, auMieux: 25, atteint: true }, 'la ligne atteignable est rapportée comme telle');
    egal(diag[1], { code: 300, min: 99, auMieux: 40, atteint: false }, 'et la ligne bloquante dit de COMBIEN elle bloque');
  }

  titre('Pré-filtrage — le seuil obligatoire n’est PAS le minimum demandé');

  // ⚠️ Le piège : pour une ligne CUMULABLE, la pièce n'a pas à porter le
  // minimum entier — l'autre peut en apporter jusqu'à un plafond. Exiger `min`
  // des deux côtés écarterait des paires parfaitement valides.
  {
    const capA = ARTIFACT_SUB_MAX[219]; // ligne cumulable (200-299)
    // Chaque pièce porte la moitié : ni l'une ni l'autre n'atteint `min`.
    const moitie = () => [{ code: 219, value: capA }];
    const attrMoitie = { ...attribut('dark'), subs: moitie() };
    const typeMoitie = { ...type('attack'), subs: moitie() };
    const p: ArtifactSearchParams = {
      porteur: lushen,
      inventaire: [attrMoitie, typeMoitie],
      equipes: [],
      principaleParSorte: {},
      evaluer: parSubs,
      lignesVerrouillees: [{ code: 219, min: capA * 2 }],
    };
    egal(
      chercherPaires(p).paires[0]?.score,
      capA * 2,
      'deux demi-contributions satisfont un minimum qu’AUCUNE pièce n’atteint seule'
    );
    // ⚠️ …et l'emplacement vide est bien écarté : au-delà du plafond d'une
    // pièce, les DEUX doivent porter la ligne.
    ok(
      !preFiltrerCandidats(candidatsParSorte(p, 'element'), 'element', p.lignesVerrouillees!).includes(null),
      'l’emplacement VIDE tombe quand la ligne exige les deux pièces'
    );

    // Une ligne EXCLUSIVE, elle, doit être portée en entier par sa sorte.
    const q: ArtifactSearchParams = {
      ...p,
      inventaire: [{ ...attribut('dark'), subs: [{ code: 307, value: 10 }] }, type('attack')],
      lignesVerrouillees: [{ code: 307, min: 25 }],
    };
    egal(
      preFiltrerCandidats(candidatsParSorte(q, 'element'), 'element', q.lignesVerrouillees!),
      [],
      'une pièce sous le seuil d’une ligne EXCLUSIVE est écartée'
    );
    egal(chercherPaires(q).paires, [], '… donc aucune paire ne peut se former');

    // ⚠️ **L'INVARIANT qui protège le diagnostic.** Le pré-filtrage a d'abord
    // été posé dans `candidatsParSorte`, et il y était faux :
    // `meilleurCumulParLigne` serait parti des candidats déjà élagués et aurait
    // annoncé « au mieux 10 % » sur un inventaire qui monte à 10 % — en ayant
    // écarté la pièce même qu'il devait rapporter. La vue complète doit rester
    // complète.
    egal(
      candidatsParSorte(q, 'element').length,
      2,
      'la vue COMPLÈTE ignore les verrous : le diagnostic doit voir tout l’inventaire'
    );
    egal(
      meilleurCumulParLigne(q, q.lignesVerrouillees!),
      [{ code: 307, min: 25, auMieux: 10, atteint: false }],
      '… et rapporte donc bien la pièce que l’élagage aurait fait disparaître'
    );
  }

  titre('Pré-filtrage — les doublons inertes, et ceux qui n’en sont pas');

  {
    // Trois artéfacts sans le moindre effet sur les dégâts (code 215, « Vol de
    // vie » : absent d'`artifactDamageProfile`). Deux partagent la même
    // principale — ils sont interchangeables, `computeStats` ne lisant que
    // celle-ci.
    const inerte = (mainValue: number, v: number): ArtifactDetail => ({
      ...attribut('dark'),
      main: { code: 101, value: mainValue },
      subs: [{ code: 215, value: v }],
    });
    const base2: ArtifactSearchParams = {
      porteur: lushen,
      inventaire: [inerte(300, 5), inerte(300, 8), inerte(220, 5)],
      equipes: [],
      principaleParSorte: {},
      evaluer: parSubs,
    };
    // ⚠️ **Sans analyse de pertinence, AUCUNE dominance** — défaut prudent :
    // comparer sur les seules principales laisserait le premier venu éliminer
    // un artéfact bien meilleur de même principale.
    egal(
      preFiltrerCandidats(candidatsParSorte(base2, 'element'), 'element').length,
      4,
      'sans pertinence fournie, rien n’est élagué : les 3 pièces et le vide restent'
    );
    // Avec elle, la dominance fait son travail : le plus fourni des trois les
    // domine tous (même ligne, valeur supérieure, principale supérieure).
    egal(
      preFiltrerCandidats(candidatsParSorte(base2, 'element'), 'element', [], analyserPertinence(base2)).length,
      2,
      'avec pertinence, seul le dominant survit (plus l’emplacement vide)'
    );

    // ⚠️ Un artéfact qui PÈSE sur les dégâts n'est jamais un doublon, même à
    // principale identique — c'est tout l'enjeu du filtre.
    const utile: ArtifactDetail = {
      ...attribut('dark'),
      main: { code: 101, value: 300 },
      subs: [{ code: 219, value: 9 }],
    };
    // ⚠️ Deux artéfacts qui excellent sur des LIGNES DIFFÉRENTES ne se
    // dominent pas : aucun n'est ≥ l'autre partout. Les deux survivent.
    const mixte = { ...base2, inventaire: [inerte(300, 5), utile] };
    egal(
      preFiltrerCandidats(candidatsParSorte(mixte, 'element'), 'element', [], analyserPertinence(mixte)).length,
      3,
      'deux artéfacts forts sur des lignes différentes survivent tous les deux'
    );

    // ⚠️ Ni un artéfact porteur d'une ligne VERROUILLÉE, même inerte sur les
    // dégâts : c'est lui qui rend la paire faisable.
    const porteurVerrou: ArtifactDetail = {
      ...attribut('dark'),
      main: { code: 101, value: 300 },
      subs: [{ code: 215, value: 9 }, { code: 307, value: 25 }],
    };
    const verrou = [{ code: 307, min: 20 }];
    const avecVerrou = preFiltrerCandidats(
      candidatsParSorte({ ...base2, inventaire: [inerte(300, 5), porteurVerrou], lignesVerrouillees: verrou }, 'element'),
      'element',
      verrou
    );
    egal(avecVerrou, [porteurVerrou], 'le porteur du verrou reste, l’inerte de même principale tombe sur le seuil');
  }
}
