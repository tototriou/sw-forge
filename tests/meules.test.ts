// Réserve de meules et de gemmes : décodage de l'export, puis la seule question
// qui compte — « ce plan, je peux l'appliquer MAINTENANT ? ».
//
// ⚠️ Se tromper ici est silencieux et coûteux : une rune annoncée faisable
// envoie le joueur ouvrir le jeu pour rien, une rune écartée à tort lui cache
// le meilleur chantier de sa soirée.

import { parseCrafts } from '../src/lib/importAccount';
import {
  buildCraftStock,
  craftLabel,
  craftsToSpend,
  missingCrafts,
  ownsCraft,
  pickCraft,
  GRADE_SCENARIO,
} from '../src/lib/crafts';
import { planNeeds, runePlan, runePotential } from '../src/lib/runeOptim';
import { CraftLine, RuneDetail } from '../src/types';
import { convertirPalier } from '../src/hooks/useRuneMetric';
import { egal, ignore, ok, titre, exportReel } from './outils';

const stock = (lignes: Partial<CraftLine>[]) =>
  buildCraftStock(
    lignes.map((l) => ({
      kind: 'grind',
      setKey: 'violent',
      stat: 8,
      grade: 5,
      ancient: false,
      amount: 1,
      ...l,
    })) as CraftLine[]
  );

export default function testMeules() {
  titre("Décodage de la réserve (rune_craft_item_list)");

  // `craft_type_id` = <set><stat><grade>, les deux derniers sur deux chiffres.
  const brut = {
    unit_list: [],
    rune_craft_item_list: [
      { craft_type: 2, craft_type_id: 130804, amount: 3 }, // meule Violent VIT héroïque
      { craft_type: 1, craft_type_id: 251204, amount: 1 }, // gemme Intangible Précision héroïque
      { craft_type: 4, craft_type_id: 990805, amount: 2 }, // meule immémoriale VIT légendaire
      { craft_type: 6, craft_type_id: 30815, amount: 1 }, // meule antique Swift VIT légendaire
      { craft_type: 2, craft_type_id: 130805, amount: 0 }, // lot vide
      { craft_type: 9, craft_type_id: 130805, amount: 5 }, // famille inconnue
    ],
  };
  const lignes = parseCrafts(brut);
  egal(lignes.length, 4, 'lot vide et famille inconnue écartés');
  egal(
    lignes[0],
    { kind: 'grind', setKey: 'violent', stat: 8, grade: 4, ancient: false, amount: 3 },
    'type pair → meule ; set, stat et grade décodés'
  );
  egal(lignes[1].kind, 'gem', 'type impair → gemme');
  egal(lignes[1].stat, 12, 'stat sur DEUX chiffres (12 = Précision), pas 1 puis 2');
  egal(lignes[2].setKey, null, 'immémorial → aucun set, utilisable partout');
  // ⚠️ Le grade antique est décalé de 10 dans les données, comme le rank d'une
  // rune antique. Le garder tel quel comparerait 15 à 5 et rendrait tout
  // infaisable en silence.
  egal(lignes[3], { kind: 'grind', setKey: 'swift', stat: 8, grade: 5, ancient: true, amount: 1 },
    'consommable antique : grade ramené sur l’échelle 1-5');

  egal(parseCrafts({ unit_list: [] }), [], 'export sans réserve → liste vide, pas une erreur');

  titre('Disponibilité d’un consommable');

  const s = stock([
    { kind: 'grind', setKey: 'violent', stat: 8, grade: 4 },
    { kind: 'grind', setKey: null, stat: 4, grade: 5 },
    { kind: 'gem', setKey: 'swift', stat: 8, grade: 5, ancient: true },
  ]);
  const q = (o: Parameters<typeof ownsCraft>[1]) => ownsCraft(s, o);

  ok(q({ kind: 'grind', setKey: 'violent', stat: 8, grade: 4, ancient: false }), 'le grade exact convient');
  ok(q({ kind: 'grind', setKey: 'violent', stat: 8, grade: 3, ancient: false }), 'un grade supérieur convient');
  ok(
    !q({ kind: 'grind', setKey: 'violent', stat: 8, grade: 5, ancient: false }),
    'un grade inférieur ne convient PAS : une meule héroïque n’atteint pas le max légendaire'
  );
  ok(!q({ kind: 'grind', setKey: 'will', stat: 8, grade: 4, ancient: false }), 'meule d’un autre set → non');
  ok(!q({ kind: 'gem', setKey: 'violent', stat: 8, grade: 4, ancient: false }), 'une meule ne fait pas gemme');

  // ⚠️ Sans la seconde consultation, l'immémorial serait invisible et des
  // chantiers réels passeraient pour bloqués.
  ok(
    q({ kind: 'grind', setKey: 'nemesis', stat: 4, grade: 5, ancient: false }),
    'un immémorial couvre n’importe quel set'
  );
  ok(
    !q({ kind: 'grind', setKey: 'nemesis', stat: 4, grade: 5, ancient: true }),
    'mais pas une rune antique : l’immémorial n’existe pas en antique'
  );
  ok(
    !q({ kind: 'gem', setKey: 'swift', stat: 8, grade: 5, ancient: false }),
    'un consommable antique ne va pas sur une rune normale'
  );
  ok(q({ kind: 'gem', setKey: 'swift', stat: 8, grade: 5, ancient: true }), 'et va bien sur une antique');

  egal(craftLabel({ kind: 'grind', stat: 8 }), 'meule VIT', 'le manque se lit sans décoder un code');

  titre('Ce qu’un plan réclame, confronté à la réserve');

  // Rune Violent slot 2, VIT non meulée : le plan « meule seule » réclame une
  // meule VIT (et rien d'autre — les autres substats ne sont pas meulables).
  const rune: RuneDetail = {
    id: 1,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 5, grind: 0 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const besoins = planNeeds(runePlan(rune, 'legend', false, 'eff'));
  egal(besoins, [{ kind: 'grind', stat: 8 }], 'meule seule → une meule VIT, TC/RES/PRE non meulables');

  const avec = stock([{ kind: 'grind', setKey: 'violent', stat: 8, grade: 5 }]);
  egal(missingCrafts(besoins, rune, GRADE_SCENARIO.legend, avec), [], 'réserve suffisante → rien ne manque');
  egal(
    missingCrafts(besoins, rune, GRADE_SCENARIO.legend, stock([{ stat: 4 }])).map(craftLabel),
    ['meule VIT'],
    'réserve à côté de la plaque → le manque est nommé'
  );
  // ⚠️ Le scénario héroïque se contente d'un grade 4 : confondre les deux
  // écarterait des runes parfaitement meulables ce soir.
  egal(
    missingCrafts(
      planNeeds(runePlan(rune, 'hero', false, 'eff')),
      rune,
      GRADE_SCENARIO.hero,
      stock([{ kind: 'grind', setKey: 'violent', stat: 8, grade: 4 }])
    ),
    [],
    'une meule héroïque suffit au plan héroïque'
  );

  // ⚠️ Le slot GEMMÉ réclame AUSSI sa meule : poser une gemme remet la meule à
  // zéro. Une rune déjà meulée sur ce slot passerait sinon pour faisable sans
  // meule.
  const gemmee: RuneDetail = {
    ...rune,
    subs: [
      { code: 8, value: 25, grind: 20 }, // VIT déjà meulée au max
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const avecGemme = planNeeds(runePlan(gemmee, 'legend', true, 'eff'));
  const gemStat = avecGemme.find((n) => n.kind === 'gem')?.stat;
  ok(gemStat != null, 'le plan avec gemme réclame bien une gemme');
  ok(
    avecGemme.some((n) => n.kind === 'grind' && n.stat === gemStat),
    'et la meule de la stat gemmée, dont le meulage repart de zéro'
  );

  titre('Réserve du compte réel');

  const reel = exportReel();
  if (!reel) {
    ignore('lecture de la réserve réelle', 'export gitignoré, absent de cette machine');
  } else {
    const lots = parseCrafts(reel);
    ok(lots.length > 0, 'la réserve est extraite du vrai export');
    ok(
      lots.every((l) => l.grade >= 1 && l.grade <= 5),
      'aucun grade hors échelle 1-5 (le décalage antique est bien absorbé)'
    );
    // Les meules n'existent que pour les stats meulables ; l'inverse
    // signalerait un décodage de famille erroné.
    const MEULABLES = new Set([1, 2, 3, 4, 5, 6, 8]);
    ok(
      lots.filter((l) => l.kind === 'grind').every((l) => MEULABLES.has(l.stat)),
      'aucune meule sur une stat non meulable — les familles sont bien séparées'
    );
    ok(
      lots.some((l) => l.kind === 'gem' && !MEULABLES.has(l.stat)),
      'des gemmes portent des stats non meulables (TC/DCC/RES/PRE), comme dans le jeu'
    );
  }
}

// Registre de dépenses : ce qu'on déclare avoir utilisé en jeu, sans réexporter.
//
// ⚠️ C'est ici que se cachent les erreurs SILENCIEUSES : un décompte qui rate,
// et l'app propose des runes qu'on n'a plus de quoi améliorer, sans le moindre
// message. Le test le plus important est celui de l'épuisement.
export function testRegistre() {
  titre('Réserve moins les dépenses déclarées');

  const lignes: CraftLine[] = [
    { kind: 'grind', setKey: 'violent', stat: 8, grade: 4, ancient: false, amount: 1 },
    { kind: 'grind', setKey: 'violent', stat: 8, grade: 5, ancient: false, amount: 2 },
  ];
  const q = { kind: 'grind' as const, setKey: 'violent', stat: 8, grade: 4, ancient: false };

  ok(ownsCraft(buildCraftStock(lignes), q), 'sans dépense, la meule est disponible');

  // ⚠️ Le grade SUFFISANT LE PLUS BAS est servi en premier : l'héroïque avant
  // les légendaires. Piocher au hasard grillerait un légendaire pour rien.
  const choisi = pickCraft(buildCraftStock(lignes), q);
  egal(choisi, { setKey: 'violent', grade: 4 }, 'le grade suffisant le plus bas est retenu');

  const apres1 = buildCraftStock(lignes, { 'grind|violent|8|4|n': 1 });
  egal(
    pickCraft(apres1, q),
    { setKey: 'violent', grade: 5 },
    'héroïque épuisée → on se rabat sur la légendaire'
  );

  // ⚠️ LE test : tout dépenser doit rendre la rune infaisable. C'est le cas que
  // l'utilisateur a demandé — meuler une Violent, ne plus s'en voir proposer.
  const vide = buildCraftStock(lignes, { 'grind|violent|8|4|n': 1, 'grind|violent|8|5|n': 2 });
  ok(!ownsCraft(vide, q), 'tout dépensé → plus rien de disponible');
  egal(vide.total, 0, 'et la réserve affichée tombe bien à zéro');

  // Une dépense supérieure au stock (registre incohérent) ne doit pas produire
  // un reste négatif qui rendrait la réserve « infinie » au comptage.
  const trop = buildCraftStock(lignes, { 'grind|violent|8|5|n': 99 });
  egal(trop.total, 1, 'dépense supérieure au stock → bornée à zéro, jamais négative');

  titre('Ce qu’un plan consomme');

  const rune: RuneDetail = {
    id: 42,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 5, grind: 0 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };
  const besoins = planNeeds(runePlan(rune, 'hero', false, 'eff'));
  egal(
    craftsToSpend(besoins, rune, GRADE_SCENARIO.hero, buildCraftStock(lignes)),
    ['grind|violent|8|4|n'],
    'on décompte le lot exact qui aurait servi — même règle que la faisabilité'
  );
  egal(
    craftsToSpend(besoins, rune, GRADE_SCENARIO.hero, vide),
    null,
    'réserve épuisée → rien à décompter, et surtout pas la moitié d’un plan'
  );
}

// ⚠️ Le mode « ce que je peux ENCORE poser » (`noDowngrade`), utilisé par le
// filtre « Faisable avec ma réserve ». Il répond à une autre question que le
// potentiel par défaut, et confondre les deux affiche des contradictions : une
// rune annoncée faisable avec un gain négatif.
export function testSansDowngrade() {
  titre('Potentiel sans dégradation de meule');

  // Rune meulée AU MAX LÉGENDAIRE sur la VIT (+5), regardée en héroïque (max +4).
  const meulee: RuneDetail = {
    id: 7,
    slot: 2,
    set: 'violent',
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: 8, value: 42 },
    subs: [
      { code: 8, value: 12, grind: 5 },
      { code: 9, value: 6 },
      { code: 11, value: 7 },
      { code: 12, value: 8 },
    ],
  };

  const defaut = runePotential(meulee, false, 'eff');
  const sansPerte = runePotential(meulee, false, 'eff', true);

  // Lecture par défaut : « si elle était née héroïque », donc elle y perd.
  ok(defaut.heroGain < 0, 'par défaut, l’héroïque fait PERDRE une rune déjà meulée légendaire');
  // Lecture du filtre : « que puis-je encore lui poser », donc jamais de perte.
  egal(sansPerte.heroGain, 0, 'sans dégradation, l’héroïque n’apporte rien — mais ne retire rien');
  ok(sansPerte.heroEff >= defaut.heroEff, 'et la valeur cible ne descend jamais sous celle par défaut');

  // Le plan affiché doit suivre la même règle, sinon il contredirait le chiffre.
  const plan = runePlan(meulee, 'hero', false, 'eff', true);
  const ligneVit = plan.subs.find((s) => s.code === 8)!;
  egal(ligneVit.grind, 5, 'le plan garde la meule légendaire déjà posée');
  egal(
    runePlan(meulee, 'hero', false, 'eff').subs.find((s) => s.code === 8)!.grind,
    4,
    'alors que par défaut il la redescend au max héroïque'
  );

  // ⚠️ Une rune NON meulée doit donner le même résultat dans les deux modes :
  // l'option ne doit rien changer là où il n'y a rien à préserver.
  const vierge: RuneDetail = { ...meulee, subs: [{ code: 8, value: 7, grind: 0 }, ...meulee.subs.slice(1)] };
  egal(
    runePotential(vierge, false, 'eff', true).heroEff,
    runePotential(vierge, false, 'eff').heroEff,
    'rune sans meule → les deux lectures coïncident'
  );
}

// ⚠️ Conversion du palier au changement de mesure. Un palier qui garde sa
// valeur brute change de sens en changeant d'unité : « 100 » vaut 707 runes en
// efficience et 3 000 en score sur un compte réel. La liste se remplit ou se
// vide toute seule, et on croit à un bug.
export function testPalier() {
  titre('Palier converti d’une mesure à l’autre');

  // 5 runes, valeurs volontairement DÉCORRÉLÉES entre les deux mesures : c'est
  // le cas réel (le rapport score/efficience va de 0,98 à 2,37).
  const paires = [
    { avant: 120, apres: 150 },
    { avant: 110, apres: 260 },
    { avant: 100, apres: 170 },
    { avant: 90, apres: 140 },
    { avant: 80, apres: 300 },
  ];

  // Palier 100 en garde 3 (120, 110, 100) → le nouveau doit en garder 3 aussi :
  // la 3e meilleure valeur « après » est 170.
  egal(convertirPalier(paires, 100), 170, 'la sélection est préservée, pas la valeur');
  egal(paires.filter((p) => p.apres >= convertirPalier(paires, 100)).length, 3, 'et elle garde bien 3 runes');

  egal(convertirPalier(paires, 0), 140, 'palier qui garde tout → le minimum');

  // ⚠️ Un palier qui ne gardait RIEN doit continuer à ne rien garder. Retomber
  // sur le maximum remplirait la liste toute seule.
  const vide = convertirPalier(paires, 999);
  ok(vide > 300, 'palier qui ne garde rien → reste au-dessus du maximum');
  egal(paires.filter((p) => p.apres >= vide).length, 0, 'et ne garde toujours rien');

  egal(convertirPalier([], 100), 100, 'aucune rune → on n’invente pas de conversion');

  // ⚠️ Le cas qui trahit un ratio : palier 120 ne garde QUE la première rune,
  // dont la valeur « après » est 300. Un ratio médian (≈ 1,7) donnerait 204 et
  // en laisserait passer deux — le palier changerait de sens en changeant
  // d'unité, ce qu'on cherche précisément à éviter.
  egal(convertirPalier(paires, 120), 300, 'palier haut : c’est le RANG qui décide, pas un facteur');
  egal(paires.filter((p) => p.apres >= 300).length, 1, 'une seule rune passait, une seule passe encore');
  ok(paires.filter((p) => p.apres >= 204).length === 2, 'là où un ratio en aurait laissé passer deux');
}
