// Le top des artéfacts par propriété secondaire (src/lib/artifactsTop.ts,
// docs/02-app/compte/feat-artefacts.md § Top 10).
//
// ⚠️ Ce que la vue promet : un groupe montre SES artéfacts (un intangible
// dans tous les groupes de sa sorte), chaque colonne classe sa propriété seule, les familles
// suivent l'ordre du jeu, et une colonne sans valeur n'existe pas.

import { ArtifactDetail, EffectLine } from '../src/types';
import { dansGroupe, effectifsGroupes, FamilleTop, GROUPES_TOP, TITRE_AUTRES, topParPropriete } from '../src/lib/artifactsTop';
import { parseAccountInventory } from '../src/lib/importAccount';
import { artifactSubName } from '../src/lib/effects';
import { egal, exportReel, ignore, ok, titre } from './outils';

const e = (code: number, value: number, rolls = 0): EffectLine => ({ code, value, rolls });
const arte = (id: number, a: Partial<ArtifactDetail>): ArtifactDetail => ({
  id,
  kind: 'element',
  element: 'water',
  level: 15,
  rarity: 5,
  main: e(101, 160),
  subs: [],
  ...a,
});

// Les valeurs d'une colonne, et les en-têtes d'une famille.
const colonneDe = (familles: FamilleTop[], code: number) =>
  familles.flatMap((f) => f.colonnes).find((c) => c.code === code)?.cellules ?? [];
const colonnesDe = (familles: FamilleTop[], titre: string) =>
  familles.find((f) => f.titre === titre)?.colonnes.map((c) => c.entete) ?? [];

export default function testArtefactsTop() {
  titre('artéfacts · top 10 — quels artéfacts dans quel groupe');
  const eau = arte(1, {});
  const feu = arte(2, { element: 'fire' });
  const attaque = arte(3, { kind: 'archetype', element: undefined, archetype: 'attack' });
  // ⚠️ com2us envoie 98 : l'attribut lu peut valoir n'importe quoi.
  const intangible = arte(4, { intangible: true, element: 'water' });
  const intangibleType = arte(5, { kind: 'archetype', element: undefined, intangible: true, archetype: 'attack' });
  ok(dansGroupe(eau, 'water') && !dansGroupe(eau, 'fire'), 'un artéfact d’eau : groupe Eau seulement');
  ok(dansGroupe(attaque, 'attack') && !dansGroupe(attaque, 'water'), 'un artéfact d’attaque : groupe Attaque seulement');
  ok(
    ['water', 'fire', 'wind', 'light', 'dark'].every((g) => dansGroupe(intangible, g as 'water')) && !dansGroupe(intangible, 'attack'),
    'un intangible d’attribut : dans les CINQ attributs, aucun type'
  );
  ok(
    ['attack', 'defense', 'hp', 'support'].every((g) => dansGroupe(intangibleType, g as 'attack')) && !dansGroupe(intangibleType, 'water'),
    'un intangible de type : dans les QUATRE types, aucun attribut'
  );
  egal(
    effectifsGroupes([eau, feu, attaque, intangible, intangibleType]),
    { water: 2, fire: 2, wind: 1, light: 1, dark: 1, attack: 2, defense: 1, hp: 1, support: 1 },
    'les effectifs de chaque groupe, intangibles compris'
  );

  titre('artéfacts · top 10 — une colonne classe sa propriété');
  // Douze artéfacts d'eau sur « Augmentation des dégâts infligés · Feu » (300) : 1 à 12 %.
  const douze = Array.from({ length: 12 }, (_, i) => arte(10 + i, { subs: [e(300, i + 1)] }));
  const infliges = topParPropriete(douze, 'water').find((f) => f.titre === 'Augmentation des dégâts infligés')!;
  ok(infliges !== undefined, 'titre du tableau : le nom en entier');
  egal(
    infliges.colonnes.map((c) => c.entete),
    ['Feu', 'Eau', 'Vent', 'Lumière', 'Ténèbres'],
    'les cinq colonnes, même vides : l’élément seul, dans l’ordre des codes du jeu'
  );
  ok(infliges.colonnes.every((c) => c.court), 'en-têtes courts marqués comme tels');
  egal(colonneDe(topParPropriete(douze, 'water'), 300).map((c) => c.valeur), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3], 'les 10 meilleures, de la plus haute à la plus basse');
  egal(infliges.colonnes.slice(1).map((c) => c.cellules.length), [0, 0, 0, 0], 'les colonnes sans artéfact : vides, mais présentes');
  egal(colonneDe(topParPropriete(douze, 'water', null, 3), 300).length, 3, 'la taille du top se règle');
  egal(
    topParPropriete(douze, 'fire').map((f) => f.titre),
    topParPropriete(douze, 'water').map((f) => f.titre),
    'un groupe sans artéfact : les MÊMES tableaux, tout vides'
  );
  ok(topParPropriete(douze, 'fire').every((f) => f.colonnes.every((c) => c.cellules.length === 0)), 'et pas une valeur');

  titre('artéfacts · top 10 — filtre de stat principale');
  // « Mes réductions de dégâts reçus du Feu, sur des artéfacts PV. »
  const recus = [
    arte(70, { main: e(100, 1500), subs: [e(305, 4)] }),
    arte(71, { main: e(101, 160), subs: [e(305, 6)] }),
    arte(72, { main: e(100, 1500), subs: [e(305, 5)] }),
    arte(73, { main: e(102, 100), subs: [e(305, 3)] }),
    arte(74, { main: e(100, 1500), intangible: true, element: 'fire', subs: [e(305, 2)] }),
  ];
  const ids = (principales: number[] | null, arts = recus) =>
    colonneDe(topParPropriete(arts, 'water', principales), 305).map((c) => c.art.id);
  egal(ids([100]), [72, 70, 74], 'PV seulement : les artéfacts PV, intangible compris, classés');
  egal(ids([101]), [71], 'ATQ seulement');
  egal(ids([100, 102]), [72, 70, 73, 74], 'PV ET DEF ensemble : cumulables, un seul classement');
  egal(ids([100, 101, 102]).length, 5, 'les trois cochées : tout');
  egal(ids(null).length, 5, 'sans filtre : tout');
  egal(ids([]), [], 'aucune cochée : rien (liste blanche)');
  egal(ids([102], [recus[1]]), [], 'aucun artéfact de ces stats principales : colonne vide');
  ok(topParPropriete(recus, 'water', []).length > 0, 'les tableaux restent, même sans stat cochée');

  titre('artéfacts · top 10 — ex æquo départagés par le score, puis l’identifiant');
  // Même valeur sur 300 ; le second porte une ligne de plus, donc un meilleur score.
  const moinsBon = arte(31, { subs: [e(300, 5)] });
  const meilleur = arte(30, { subs: [e(300, 5), e(215, 8)] });
  const jumeau = arte(29, { subs: [e(300, 5)] });
  egal(
    colonneDe(topParPropriete([moinsBon, meilleur, jumeau], 'water'), 300).map((c) => c.art.id),
    [30, 29, 31],
    'à valeur égale : le meilleur score devant, puis le plus petit identifiant'
  );

  titre('artéfacts · top 10 — les familles : reçus d’abord, puis l’ordre du jeu');
  const familles = topParPropriete([], 'water');
  egal(
    familles.map((f) => f.titre),
    [
      'Réduction des dégâts reçus',
      'Augmentation des dégâts infligés',
      'Effet de renforcement',
      'Dégâts supplémentaires en proportion de',
      'Dégâts critiques selon la cible',
      TITRE_AUTRES,
    ],
    'attribut : dégâts reçus, PUIS infligés, puis l’ordre du jeu — sans aucun tableau de type'
  );
  egal(colonnesDe(familles, 'Dégâts supplémentaires en proportion de'), ['PV', 'ATQ', 'DEF', 'VIT'], 'dégâts proportionnels : PV, ATQ, DEF, VIT');
  const autres = familles[familles.length - 1].colonnes;
  ok(
    autres.every((c) => !c.court && c.entete === artifactSubName(c.code)),
    'sans élément propre, la colonne porte le nom complet de sa propriété'
  );
  egal(autres.slice(0, 3).map((c) => c.code), [206, 210, 214], 'les autres : dans l’ordre du jeu (aug. VIT, bombe, CRIT reçus…)');
  ok(familles.flatMap((f) => f.colonnes).every((c) => c.code < 400), 'aucune propriété de type sur un groupe d’attribut');

  titre('artéfacts · top 10 — propriétés de type');
  const support = topParPropriete([], 'support');
  egal(
    support.map((f) => f.titre),
    [
      'Augmentation des dégâts critiques',
      'Augmentation des soins',
      'Augmentation de la précision',
      'Effet de renforcement',
      'Dégâts supplémentaires en proportion de',
      'Dégâts critiques selon la cible',
      TITRE_AUTRES,
    ],
    'type : dégâts critiques, soins, précision par compétence, puis les familles communes'
  );
  egal(colonnesDe(support, 'Augmentation des soins'), ['[Comp.1]', '[Comp.2]', '[Comp.3]'], 'soins : une colonne par compétence');
  ok(support.flatMap((f) => f.colonnes).every((c) => c.code < 300 || c.code >= 400), 'aucune propriété d’attribut sur un groupe de type');
  ok(
    colonnesDe(support, TITRE_AUTRES).includes('Effet aug. VIT'),
    '« Effet aug. VIT » sous les autres, pas sous « Effet de renforcement »'
  );
  const inconnu = [arte(60, { subs: [e(999, 5), e(215, 3)] })];
  ok(
    !topParPropriete(inconnu, 'water').some((f) => f.colonnes.some((c) => c.code === 999)),
    'un code de propriété inconnu n’ouvre pas de colonne'
  );

  titre('artéfacts · top 10 — sur un inventaire réel');
  const brut = exportReel();
  if (!brut) {
    ignore('top 10 sur un inventaire réel', 'export réel absent');
    return;
  }
  const { artifacts = [] } = parseAccountInventory(JSON.parse(brut));
  const effectifs = effectifsGroupes(artifacts);
  const groupesDe = (a: ArtifactDetail) => GROUPES_TOP.filter((g) => dansGroupe(a, g.key)).length;
  ok(
    artifacts.every((a) => groupesDe(a) === (a.intangible ? (a.kind === 'element' ? 5 : 4) : 1)),
    `chaque artéfact dans son groupe, un intangible dans tous ceux de sa sorte (${artifacts.length})`
  );
  ok(artifacts.some((a) => a.intangible), 'l’inventaire réel contient des intangibles (le contrôle ci-dessus porte)');
  for (const g of GROUPES_TOP) {
    const colonnes = topParPropriete(artifacts, g.key).flatMap((f) => f.colonnes);
    if (effectifs[g.key] === 0) continue;
    ok(colonnes.length > 0, `${g.label} : au moins une colonne`);
    ok(colonnes.every((c) => !c.entete.startsWith('#')), `${g.label} : chaque colonne nommée par le jeu`);
    ok(
      colonnes.every((c) => c.cellules.length <= 10 && c.cellules.every((x, i, t) => i === 0 || t[i - 1].valeur >= x.valeur)),
      `${g.label} : au plus 10 valeurs par colonne, décroissantes`
    );
    ok(new Set(colonnes.map((c) => c.code)).size === colonnes.length, `${g.label} : une propriété dans une seule colonne`);
  }
}
