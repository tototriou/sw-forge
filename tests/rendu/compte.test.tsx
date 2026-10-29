// Tests de rendu — Mon compte · Monstres et Artéfacts (`AccountPage`). Principe
// dans tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et
// chaque information sont présentes, jamais l'apparence : un changement de
// style doit les laisser verts sans qu'une assertion change.
//
// ⚠️ Rendu BUREAU : le panneau d'actions mobile est fermé (`menuOuvert` faux).

import AccountPage from '../../src/pages/AccountPage';
import type { AccountView } from '../../src/App';
import type { BoxItem } from '../../src/lib/applyAccount';
import type { ArtifactDetail, EffectLine, Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { runesUtiliseesVides } from '../../src/lib/importAccount';
import { boutons, onglets, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const monstre = (nom: string, el: string) =>
  MONSTRES.filter((m) => m.name === nom && m.element === el && m.com2usId != null).sort(
    (a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0),
  )[0];

// Une box courte mais variée : cinq éléments, des étoiles naturelles
// différentes, un niveau non maximal.
export const BOX: BoxItem[] = [
  ['Lushen', 'wind'],
  ['Veromos', 'dark'],
  ['Chasun', 'wind'],
  ['Galleon', 'water'],
  ['Belladeon', 'light'],
  ['Velajuel', 'fire'],
].map(([nom, el], i) => ({ key: `u${i}`, monster: monstre(nom, el), stars: 6, level: i === 5 ? 35 : 40 }));

const e = (code: number, value: number, rolls = 0): EffectLine => ({ code, value, rolls });
const arte = (id: number, a: Partial<ArtifactDetail>): ArtifactDetail => ({
  id,
  kind: 'element',
  level: 15,
  rarity: 5,
  main: e(101, 100),
  subs: [],
  ...a,
});

// Deux sortes, plusieurs éléments et archétypes, un intangible, des niveaux et
// raretés différents.
export const ARTEFACTS: ArtifactDetail[] = [
  arte(1, { element: 'fire', main: e(101, 160), subs: [e(204, 5, 2), e(206, 6, 1), e(218, 0.3, 1), e(222, 4, 0)] }),
  arte(2, { element: 'water', main: e(100, 1500), subs: [e(210, 8, 1), e(214, 5, 2), e(219, 6, 0), e(225, 4, 1)] }),
  arte(3, { element: 'wind', rarity: 4, level: 12, main: e(102, 100), subs: [e(205, 5, 0), e(217, 4, 1), e(221, 30, 0)] }),
  arte(4, { kind: 'archetype', archetype: 'attack', main: e(101, 160), subs: [e(209, 8, 2), e(212, 6, 1), e(222, 5, 1), e(224, 3, 0)] }),
  arte(5, { kind: 'archetype', archetype: 'support', main: e(100, 1500), subs: [e(206, 7, 2), e(220, 5, 1), e(226, 4, 0), e(215, 4, 1)] }),
  arte(6, { kind: 'archetype', archetype: 'defense', rarity: 3, level: 9, main: e(102, 60), subs: [e(201, 4, 0), e(213, 3, 1)] }),
  arte(7, { kind: 'element', intangible: true, main: e(101, 160), subs: [e(204, 6, 2), e(208, 5, 1), e(222, 4, 1), e(223, 5, 0)] }),
  arte(8, { element: 'light', main: e(100, 1500), subs: [e(210, 6, 1), e(214, 4, 0), e(219, 5, 2), e(224, 4, 1)] }),
];

export function rendreCompte(sub: 'monstres' | 'artefacts', vue: AccountView): string {
  faussLocalStorage({});
  return rendre(
    <AccountPage
      sub={sub}
      vue={vue}
      box={BOX}
      runes={[]}
      artifacts={ARTEFACTS}
      crafts={[]}
      usedRuneIds={runesUtiliseesVides()}
      runeMarkerLabels={{}}
      loadState="live"
      hydrating={false}
      allMonsters={MONSTRES}
      menuOuvert={false}
      onFermerMenu={() => {}}
    />,
  );
}

export function testRenduCompteMonstres() {
  titre('rendu · Mon compte · Monstres — la box');
  const html = rendreCompte('monstres', 'liste');
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.includes('6 monstres différents · 6★'), 'le compte de la box');
  ok(valeurs(html, 'placeholder').includes('Rechercher un monstre…'), 'recherche « Rechercher un monstre… »');
  ok(b.some((x) => x.texte === 'Sortie' && x.presse === true && x.title === 'Par élément, puis les 2A d’abord et les familles par date de sortie'), 'tri « Sortie », enclenché, et ce qu\'il fait');
  ok(b.some((x) => x.texte === 'A → Z' && x.presse === false && x.title === 'Par élément, puis par nom'), 'tri « A → Z », et ce qu\'il fait');
  for (const el of ['Feu', 'Eau', 'Vent', 'Lumière', 'Ténèbres']) ok(b.some((x) => x.texte === el && x.presse === true), `élément « ${el} », enclenché`);
  for (const s of ['5★', '4★', '3★', '2★']) ok(b.some((x) => x.texte === s && x.presse === true), `étoiles naturelles « ${s} », enclenché`);
  ok(b.some((x) => x.texte === 'Doublons' && x.presse === false), '« Doublons »');
  ok(b.some((x) => x.texte === '2A' && x.presse === false && x.title === 'Monstres à second éveil (double éveil)'), '« 2A », et ce que c\'est');
  for (const nom of ['Velajuel', 'Galleon', 'Chasun', 'Lushen', 'Belladeon', 'Veromos']) ok(t.includes(nom), `« ${nom} » dans la box`);
  ok(t.includes('Velajuel Galleon Chasun Lushen Belladeon Veromos'), 'l\'ordre « Sortie » : par élément (feu, eau, vent, lumière, ténèbres)');
}

export function testRenduCompteArtefactsResume() {
  titre('rendu · Mon compte · Artéfacts — Résumé');
  const t = texteVisible(rendreCompte('artefacts', 'resume'));
  for (const bout of [
    'Artéfacts 8', '5 attribut · 3 type · 2 à monter',
    'Eff. moy. · Attribut 50.9 % sur 5', 'Eff. moy. · Type 31.6 % sur 3',
    'Meilleur score 144 attribut 144 · type 93',
    '≥ 90 % d\'eff. 0 0 attribut · 0 type', 'Quad rolls 0 0 attribut · 0 type',
  ]) ok(t.includes(bout), `chiffres clés : « ${bout} »`);
  ok(t.includes('Distribution d\'efficience Attribut Type ≥ 90 % 0 0 80 – 90 % 0 0 70 – 80 % 1 0 60 – 70 % 0 0 50 – 60 % 1 0 < 50 % 3 3'), 'la distribution, attribut et type côte à côte');
  ok(t.includes('Raretés Attribut 5 Légendaire 4 Héroïque 1 Type 3 Légendaire 2 Rare 1'), 'les raretés, par sorte');
  ok(t.includes('Stats principales ATQ 2 1 PV 2 1 DEF 1 1'), 'les stats principales, par sorte');
  ok(!t.includes('Par attribut et par type'), 'plus de carte « Par attribut et par type » (le Top 10 par propriété la remplace)');
  ok(t.includes('Quad rolls · sur quelle propriété Aucun quad roll dans l\'inventaire.'), 'quad rolls : le cas vide, expliqué');
}

export function testRenduCompteArtefactsListe() {
  titre('rendu · Mon compte · Artéfacts — Liste');
  const html = rendreCompte('artefacts', 'liste');
  const t = texteVisible(html);
  const b = boutons(html);
  ok(b.some((x) => x.texte === 'Tous' && x.presse === true), 'catégorie « Tous », enclenchée');
  ok(b.some((x) => x.texte === 'Attribut' && x.presse === false) && b.some((x) => x.texte === 'Type' && x.presse === false), 'catégories « Attribut » et « Type »');
  for (const f of ['Eau', 'Feu', 'Vent', 'Lumière', 'Ténèbres', 'Attaque', 'Défense', 'PV', 'Support', 'Légendaire', 'Héroïque', 'Rare', 'Magique', 'Commun'])
    ok(b.some((x) => x.texte === f), `filtre « ${f} »`);
  ok(t.includes('Stat principale Toutes PV ATQ DEF'), 'filtre « Stat principale »');
  ok(b.some((x) => x.texte === 'Toutes' && x.presse === true), 'stat principale « Toutes », enclenchée');
  egal(b.filter((x) => x.title === 'Choisir une propriété').map((x) => x.texte), ['1 —', '2 —'], 'propriété : deux cases, vides');
  ok(b.some((x) => x.ariaLabel === 'Passer à quatre propriétés' && x.presse === false), '« Passer à quatre propriétés »');
  ok(b.some((x) => x.ariaLabel === 'Trier du plus petit au plus grand'), 'sens du tri');
  ok(t.includes('8 artéfacts (5 attribut · 3 type)'), 'le compte, par sorte');
  ok(t.includes('PV +1500 Légendaire 71.9% 1 Dgts de bombe +8% 2 Dgts CRIT reçus -5%'), 'le meilleur en tête : stat principale, rareté, efficience, propriétés avec leurs rolls');
  ok(t.includes('DEF +60 Rare 3.6%'), 'le moins bon en fin de liste');
}

// La vue « Top 10 » : le groupe Eau par défaut — l'artéfact d'eau n° 2 et
// l'intangible d'attribut n° 7, qui compte pour TOUS les attributs —, les
// groupes en ONGLETS, tous les tableaux de la sorte affichés, une croix par
// rang vide, et les valeurs telles que le jeu les écrit.
export function testRenduCompteArtefactsTop() {
  titre('rendu · Mon compte · Artéfacts — Top 10');
  // ⚠️ Dans le RÉSUMÉ, en dernier : plus une vue à part.
  const html = rendreCompte('artefacts', 'resume');
  const t = texteVisible(html);
  const b = boutons(html);
  ok(
    t.includes('Top 10 par propriété 2 artéfacts'),
    'au Résumé : l’intitulé de la section et l’effectif du groupe, intangible compris'
  );
  ok(
    t.indexOf('Raretés') < t.indexOf('Top 10 par propriété') &&
      t.indexOf('Top 10 par propriété') < t.indexOf('Quad rolls · sur quelle propriété'),
    'la section vient après les raretés, et les quad rolls tout en bas'
  );
  ok(!texteVisible(rendreCompte('artefacts', 'liste')).includes('Top 10 par propriété'), 'pas dans la Liste');

  // Les groupes : des onglets (role="tab"), pas des pastilles.
  const groupes = onglets(html);
  egal(
    groupes.map((o) => o.texte),
    ['Eau', 'Feu', 'Vent', 'Lumière', 'Ténèbres', 'Attaque', 'Défense', 'PV', 'Support'],
    'les groupes en onglets, côte à côte, sans « Intangible » (ils sont dans les tableaux)'
  );
  egal(groupes.filter((o) => o.ouvert).map((o) => o.texte), ['Eau'], 'onglet « Eau » ouvert par défaut, et lui seul');
  ok(
    groupes.find((o) => o.texte === 'PV')?.desactive === true &&
      groupes.find((o) => o.texte === 'PV')?.title === 'Aucun artéfact de ce groupe dans l’inventaire',
    'onglet « PV » sans artéfact : affiché, désactivé, avec la raison'
  );
  ok(groupes.filter((o) => o.texte !== 'PV').every((o) => !o.desactive), 'les autres onglets disponibles');

  ok(t.includes('Stat principale PV ATQ DEF'), 'filtre « Stat principale » : PV · ATQ · DEF');
  for (const s of ['PV', 'ATQ', 'DEF'])
    ok(
      b.filter((x) => x.texte === s && x.presse === true).length === 1,
      `stat principale « ${s} » : une bascule, cochée par défaut (liste blanche)`
    );

  // TOUS les tableaux de la sorte attribut, même vides ; aucun de type.
  for (const famille of [
    'Réduction des dégâts reçus',
    'Augmentation des dégâts infligés',
    'Effet de renforcement',
    'Dégâts supplémentaires en proportion de',
    'Dégâts critiques selon la cible',
    'Autres sous-propriétés',
  ])
    ok(t.includes(famille), `tableau « ${famille} », affiché`);
  ok(!t.includes('Augmentation des soins'), 'aucun tableau impossible pour un attribut (soins par compétence)');
  ok(t.indexOf('Réduction des dégâts reçus') < t.indexOf('Augmentation des dégâts infligés'), 'dégâts reçus d’abord, puis infligés');

  // Une colonne : toujours 10 rangs, une croix là où il n'y a pas d'artéfact.
  const colonne = (code: number) => html.split(`data-colonne-top="${code}"`)[1]?.split('data-colonne-top=')[0] ?? '';
  const rangs = (code: number) => (colonne(code).match(/<li\b/g) ?? []).length;
  const vides = (code: number) => (colonne(code).match(/data-case-vide/g) ?? []).length;
  ok(rangs(300) === 10 && vides(300) === 10, '« Feu » des dégâts infligés, sans artéfact : 10 croix');
  ok(rangs(204) === 10 && vides(204) === 9, '« ATQ » de l’effet de renforcement : la valeur de l’intangible, puis 9 croix');
  ok(colonne(204).includes('+6%'), 'l’intangible dans les tableaux de l’Eau : « Effet de renforcement » › « ATQ » +6%');
  ok(colonne(219).includes('6%'), '« Dégâts supplémentaires en proportion de » › « ATQ » 6%');
  ok(colonne(214).includes('-5%'), 'valeur signée comme dans le jeu : -5 % de dégâts CRIT reçus');
  ok(/aria-label="Aucun artéfact"/.test(colonne(300)), 'une croix se nomme « Aucun artéfact »');

  ok(b.some((x) => x.texte === '+8%' && x.title === 'n° 1 · principale PV'), 'une valeur ouvre sa fiche : son rang et la stat principale en infobulle');
  ok(b.some((x) => x.texte === '+6%' && x.title === 'n° 1 · principale ATQ · intangible'), 'un intangible : dit dans l’infobulle');
  ok(valeurs(html, 'alt').includes('intangible'), 'et marqué par le glyphe intangible du jeu');
  const icones = valeurs(html, 'aria-label');
  ok(icones.includes('PV') && icones.includes('ATQ'), 'l’icône de la stat principale (cœur PV, épées ATQ) devant la valeur, nommée');
  ok(/class="[^"]*text-fire[^"]*"[^>]*aria-label="PV"|aria-label="PV"[^>]*class="[^"]*text-fire/.test(html), 'le cœur PV en couleur');
}

// « Effacer les filtres » dans la box et la liste
// d'artéfacts — présent, et désactivé avec sa raison quand rien n'est filtré.
export function testRenduCompteEffacerFiltres() {
  titre('rendu · Mon compte — « Effacer les filtres » (box, artéfacts)');
  for (const [nom, html] of [['box', rendreCompte('monstres', 'liste')], ['artéfacts', rendreCompte('artefacts', 'liste')]] as const) {
    const b = boutons(html).filter((x) => x.texte === 'Effacer les filtres');
    egal(b.length, 1, `${nom} : « Effacer les filtres » présent`);
    ok(b[0]?.desactive === true && b[0]?.title === 'Aucun filtre posé', `${nom} : désactivé sans filtre, et pourquoi`);
  }
}

// Les en-têtes à la souris. Ajoutés avec eux ; les tests d'avant
// restent inchangés.
export function testRenduCompteSouris() {
  titre('rendu · Mon compte · Monstres et Artéfacts — en-têtes à la souris');
  const box = rendreCompte('monstres', 'liste');
  ok(/<h1[^>]*>Ma box<\/h1>/.test(box) && texteVisible(box).includes('Ma box 6 monstres différents · 6★'), 'la box : « Ma box », puis son compte');
  const resume = rendreCompte('artefacts', 'resume');
  ok(/<h1[^>]*>Résumé<\/h1>/.test(resume) && texteVisible(resume).includes('Résumé 8 artéfacts Artéfacts 8'), 'le Résumé : « Résumé », le nombre d\'artéfacts, puis les chiffres clés');
  const liste = rendreCompte('artefacts', 'liste');
  ok(/<h1[^>]*>Liste<\/h1>/.test(liste) && texteVisible(liste).includes('Liste 8 artéfacts Catégorie'), 'la Liste : « Liste », le nombre d\'artéfacts de l\'inventaire, puis les filtres');
}
