// Tests de rendu — Mon compte · Runes (`RunesSection` et ses vues). Principe
// dans tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et
// chaque information sont présentes, jamais l'apparence. Écrits AVANT le lot 8a
// de la refonte graphique (`spec/chantiers/refonte-graphique.md` § B.5 à
// B.10) : ils doivent rester verts sans qu'une assertion change.
//
// ⚠️ Rendu BUREAU : le panneau d'actions mobile est fermé (`menuOuvert` faux).
// ⚠️ La mesure (Efficience / Score SW) est un réglage GLOBAL du menu ⚙, hors
// de cette zone : on reste sur l'efficience, sa valeur par défaut.

import RunesSection from '../../src/components/account/RunesSection';
import type { AccountView } from '../../src/App';
import type { CraftLine, EffectLine, RuneDetail } from '../../src/types';
import { egal, faussLocalStorage, ok, titre } from '../outils';
import { runesUtiliseesVides } from '../../src/lib/importAccount';
import { boutons, rendre, texteVisible, valeurs } from './outils-rendu';

// Une réserve courte mais variée : six slots, six sets, une antique, une rune
// gemmée, une meulée, une innée, des niveaux et des raretés différents — de
// quoi peupler chaque vue.
const e = (code: number, value: number, extra: Partial<EffectLine> = {}): EffectLine => ({ code, value, ...extra });
const rune = (id: number, slot: number, set: string, main: EffectLine, subs: EffectLine[], extra: Partial<RuneDetail> = {}): RuneDetail => ({
  id,
  slot,
  set,
  rank: 6,
  rarity: 5,
  level: 15,
  main,
  subs,
  ...extra,
});

export const RUNES: RuneDetail[] = [
  rune(1, 1, 'violent', e(3, 160), [e(8, 18), e(9, 11), e(4, 14), e(10, 7)]),
  rune(2, 2, 'violent', e(8, 42), [e(9, 16), e(10, 12), e(2, 8), e(4, 5)], { innate: e(11, 6) }),
  rune(3, 3, 'swift', e(5, 160), [e(8, 12), e(2, 13, { grind: 3 }), e(12, 7), e(11, 5)]),
  rune(4, 4, 'will', e(10, 80), [e(8, 6), e(9, 22), e(4, 9, { enchant: true }), e(1, 300)], { rarity: 4 }),
  rune(5, 5, 'fatal', e(1, 2448), [e(4, 21), e(10, 18), e(8, 4)], { rarity: 3, level: 12 }),
  rune(6, 6, 'despair', e(2, 63), [e(8, 25), e(12, 16), e(11, 8), e(6, 11)], { rank: 16 }),
  rune(7, 2, 'swift', e(8, 42), [e(2, 20), e(12, 9), e(11, 7), e(6, 6)], { level: 9, rarity: 4 }),
  rune(8, 6, 'rage', e(4, 63), [e(9, 9), e(10, 21), e(8, 10), e(3, 20)]),
  // Au-dessus de 100 % : c'est le palier par défaut de l'Optimisation, qu'un
  // rendu serveur ne peut pas baisser (état en mémoire, sans clic).
  rune(9, 4, 'violent', e(10, 80), [e(8, 30), e(9, 20), e(4, 8), e(12, 8)]),
];

const CRAFTS: CraftLine[] = [
  { kind: 'grind', setKey: 'violent', stat: 8, grade: 4, ancient: false, amount: 2 } as CraftLine,
];

export function rendreVue(vue: AccountView): string {
  faussLocalStorage({});
  return rendre(
    <RunesSection runes={RUNES} crafts={CRAFTS} usedRuneIds={{ ...runesUtiliseesVides(), rta: [1, 2] }} runeMarkerLabels={{}} vue={vue} menuOuvert={false} onFermerMenu={() => {}} />,
  );
}

const SETS = ['Swift', 'Violent', 'Despair', 'Will', 'Rage', 'Fatal'];

// Filtres communs à la Liste, aux Courbes et à l'Optimisation : sets, slots
// (tous enclenchés par défaut), et — hors Optimisation, qui les range ailleurs —
// les antiques.
function filtresCommuns(html: string, vue: string) {
  const b = boutons(html);
  ok(b.some((x) => x.ariaLabel === 'Tout désélectionner' && x.presse === true), `${vue} : « Tout désélectionner » (sets)`);
  for (const s of SETS) ok(b.some((x) => x.ariaLabel === s && x.presse === true), `${vue} : set « ${s} », enclenché`);
  for (const n of ['1', '2', '3', '4', '5', '6']) ok(b.some((x) => x.texte === n && x.presse === true), `${vue} : slot ${n}, enclenché`);
  ok(b.some((x) => x.texte === 'Toutes' && x.title === 'Runes normales et antiques' && x.presse === true), `${vue} : antiques « Toutes », enclenché`);
  ok(b.some((x) => x.texte === 'Antiques uniquement' && x.title === 'Uniquement les runes antiques' && x.presse === false), `${vue} : « Antiques uniquement »`);
  ok(b.some((x) => x.texte === 'Aucune antique' && x.title === 'Masquer les runes antiques' && x.presse === false), `${vue} : « Aucune antique »`);
}

// Le potentiel : avec la gemme optimale, ou meules seulement.
function modePotentiel(html: string, vue: string) {
  const b = boutons(html);
  ok(b.some((x) => x.texte === 'Gemme + meule' && x.title === 'Potentiel avec la gemme optimale + les meules' && x.presse === true), `${vue} : « Gemme + meule », enclenché`);
  ok(b.some((x) => x.texte === 'Meule seule' && x.title === 'Potentiel en gardant les stats actuelles (meules seulement)' && x.presse === false), `${vue} : « Meule seule »`);
}

export function testRenduRunesResume() {
  titre('rendu · Mon compte · Runes — Résumé');
  const t = texteVisible(rendreVue('resume'));
  for (const bout of [
    'Runes 9', '7 au +15',
    'Eff. moyenne 85.2 %', 'médiane 83.3 %', 'top 100 85.2 %', 'top 10 : 85.2 %', 'Meilleure 109.5 %',
    '0 rune(s) ≥ 110 %', '≥ 100 % 1 11.1 % du stock', 'Antiques 1 11.1 % du stock',
  ]) ok(t.includes(bout), `chiffres clés : « ${bout} »`);
  ok(t.includes("Distribution d'efficience ≥ 110 % 0 · 0.0 % 100 – 110 % 1 · 11.1 % 90 – 100 % 1 · 11.1 % 80 – 90 % 3 · 33.3 % 70 – 80 % 4 · 44.4 % < 70 % 0 · 0.0 %"), 'la distribution d\'efficience, par palier');
  ok(t.includes('Qualité du stock Montées au +15 7 · 77.8 % 4 substats révélés 8 · 88.9 % Gemmées 1 · 11.1 % Antiques 1 · 11.1 %'), 'la qualité du stock');
  ok(t.includes('Raretés Légendaire 6 Héroïque 2 Rare 1 Magique 0 Commun 0'), 'les raretés');
  ok(t.includes('Slot 1 1 moy. 89.9 % max 89.9 %') && t.includes('Slot 4 2 moy. 94.7 % max 109.5 %') && t.includes('Slot 6 2 moy. 90.0 % max 96.7 %'), 'par emplacement : nombre, moyenne, maximum');
  ok(t.includes('Stats principales (slots 2 · 4 · 6) VIT 2 · 33.3 % Dmg Crit 2 · 33.3 % PV% 1 · 16.7 % ATQ% 1 · 16.7 %'), 'les stats principales des slots pairs');
  ok(t.includes('Marge de progression') && t.includes('Eff. moyenne 85.2 % aujourd\'hui Potentiel moyen 112.9 % +27.7 pts'), 'la marge de progression : aujourd\'hui, potentiel, écart');
  ok(t.includes('Meules à poser 9 100.0 % du stock Gemmes à poser 8 88.9 % du stock'), 'meules et gemmes à poser');
  ok(t.includes('Par set (6) Violent 3 moy. 94.5 % · max 109.5 %'), 'par set : nombre, moyenne, maximum');
}

export function testRenduRunesListe() {
  titre('rendu · Mon compte · Runes — Liste');
  const html = rendreVue('liste');
  const t = texteVisible(html);
  const b = boutons(html);
  filtresCommuns(html, 'liste');

  // Filtre par propriété secondaire (la modale du jeu).
  ok(t.includes('Propriété'), 'filtre « Propriété »');
  egal(b.filter((x) => x.title === 'Choisir une propriété').map((x) => x.texte), ['1 —', '2 —'], 'deux cases de propriété, vides');
  ok(b.some((x) => x.ariaLabel === 'Passer à quatre propriétés' && x.presse === false), '« Passer à quatre propriétés »');

  // Tri : les entrées du jeu, dans son ordre, et le sens.
  // Décision 21, [retrait #21] : une seule entrée de mesure, celle du menu ⚙
  // (ici l'efficience, par défaut). L'assertion d'avant listait « Score » ET
  // « Efficience » ; la fonction qu'elle couvrait (trier par la mesure qu'on ne
  // voit pas) est retirée à la demande de Thomas.
  ok(t.includes('Trier par Grade Propriété secondaire Sous-propriété avant meule Nv. d’amélioration Obtenu Total des sous-prop. Efficience Slot'), 'tri : les entrées du jeu, une seule mesure — celle du ⚙');
  ok(b.some((x) => x.ariaLabel === 'Trier du plus petit au plus grand'), 'sens du tri');

  // Les runes : une tuile par rune, la meilleure en tête.
  ok(t.includes('9 runes · meilleure efficience 109.5%'), 'le compte et la meilleure efficience');
  const tuiles = b.filter((x) => / Efficience \d/.test(x.texte));
  egal(tuiles.length, 9, 'une tuile par rune');
  egal(tuiles[0].texte, 'Dmg Crit +80% Légendaire Efficience 109.5% VIT 30 Taux Crit 20% ATQ 8% Précision 8% 4 Set : Chance de tour supplémentaire 22%', 'la meilleure en tête : stat principale, rareté, efficience, secondaires, effet du set');
  ok(tuiles.some((x) => x.texte.startsWith('VIT +42 RES +6%')), 'la stat innée');
  ok(tuiles.some((x) => x.texte.includes('PV 10% +3%') && x.title === 'Voir les valeurs totales, meule comprise' && x.presse === false), 'une rune meulée : la meule, et la bascule vers les totaux');
  ok(tuiles.some((x) => x.texte.includes('Héroïque')) && tuiles.some((x) => x.texte.includes('Rare')), 'les raretés');
}

export function testRenduRunesCourbes() {
  titre('rendu · Mon compte · Runes — Courbes');
  const html = rendreVue('courbes');
  const t = texteVisible(html);
  const b = boutons(html);
  filtresCommuns(html, 'courbes');
  modePotentiel(html, 'courbes');

  // Combien de runes tracer.
  ok(valeurs(html, 'aria-label').includes('Nombre de runes'), 'nombre de runes à tracer');
  ok(b.some((x) => x.ariaLabel === 'Diminuer' && !x.desactive), '« Diminuer »');
  ok(b.some((x) => x.ariaLabel === 'Augmenter' && x.desactive), '« Augmenter », désactivé au maximum');
  ok(b.some((x) => x.texte === 'Tout'), '« Tout »');

  // Le graphe : aide, plein écran, axes, une légende par courbe (masquable).
  ok(b.some((x) => x.ariaLabel === 'Comment lire ce graphe ?' && x.presse === false), 'aide « Comment lire ce graphe ? »');
  ok(b.some((x) => x.ariaLabel === 'Afficher le graphe en plein écran'), 'plein écran');
  ok(t.includes('Nombre de runes') && t.includes('Efficience (%)'), 'les axes');
  for (const c of ['Actuelle', 'Potentiel Héro', 'Potentiel Légend'])
    ok(b.some((x) => x.texte === c && x.title === 'Masquer cette courbe' && x.presse === true), `courbe « ${c} », affichée et masquable`);
}

export function testRenduRunesComparaison() {
  titre('rendu · Mon compte · Runes — Comparaison');
  const html = rendreVue('comparaison');
  const t = texteVisible(html);
  const b = boutons(html);
  ok(b.some((x) => x.texte === 'Courbes partagées' && x.presse === true), 'sous-onglet « Courbes partagées », enclenché');
  ok(b.some((x) => x.texte === 'Fichiers de compte' && x.presse === false), 'sous-onglet « Fichiers de compte »');
  ok(b.some((x) => x.texte === 'Exporter ma courbe'), '« Exporter ma courbe »');
  ok(b.some((x) => x.texte === 'Importer une courbe'), '« Importer une courbe »');
  ok(t.includes('Cet onglet montre tout ce que tu as importé'), 'ce que montre l\'onglet');
  ok(t.includes('Une courbe partagée ne contient que des points'), 'pourquoi les filtres n\'y sont pas');
  ok(valeurs(html, 'aria-label').includes('Nombre de runes'), 'nombre de runes à tracer');
  ok(b.some((x) => x.ariaLabel === 'Diminuer') && b.some((x) => x.ariaLabel === 'Augmenter'), '« Diminuer » / « Augmenter »');
  ok(b.some((x) => x.ariaLabel === 'Afficher le graphe en plein écran'), 'plein écran');
  ok(b.some((x) => x.texte === 'Moi' && x.title === 'Masquer cette courbe' && x.presse === true), 'ma courbe, « Moi », masquable');
}

export function testRenduRunesOptimisation() {
  titre('rendu · Mon compte · Runes — Optimisation');
  const html = rendreVue('optimisation');
  const t = texteVisible(html);
  const b = boutons(html);
  ok(t.includes("Ceci est une optimisation d' efficience : ce n'est pas toujours la bonne solution pour tes runes"), 'l\'avertissement sur l\'efficience');
  filtresCommuns(html, 'optimisation');
  modePotentiel(html, 'optimisation');
  ok(t.includes('Trier par Valeur actuelle Potentiel héroïque Potentiel légendaire Gain héroïque Gain légendaire'), 'tri : les cinq entrées');
  ok(b.some((x) => x.ariaLabel === 'Trier du plus petit au plus grand'), 'sens du tri');
  ok(valeurs(html, 'aria-label').includes('Palier'), 'palier');
  ok(b.some((x) => x.ariaLabel === 'Diminuer') && b.some((x) => x.ariaLabel === 'Augmenter'), 'palier : « Diminuer » / « Augmenter »');
  ok(b.some((x) => x.texte === 'Faisable avec ma réserve' && x.title === 'Ne garder que les runes applicables avec tes 2 meules et gemmes en réserve' && x.presse === false), '« Faisable avec ma réserve », et combien de consommables');
  ok(b.some((x) => x.texte === 'Sans les immémoriaux' && x.presse === false && !!x.title?.startsWith('Garder tes gemmes et meules immémoriales de côté')), '« Sans les immémoriaux », et pourquoi');
  ok(b.some((x) => x.texte === 'Runes utilisées' && x.presse === false && !!x.title?.startsWith('Ne garder que les 2 runes qui jouent')), '« Runes utilisées », et combien');
  ok(b.some((x) => x.ariaLabel === 'Comment est-ce calculé ?' && x.presse === false), 'aide « Comment est-ce calculé ? »');
  ok(t.includes('1 rune ≥ 100%'), 'combien de runes au palier');
  ok(b.some((x) => x.texte === 'Dmg Crit +80% actuelle 109.5% Héro +19.9 → 129.5% Légend +28.3 → 137.8%'), 'une rune : actuelle, puis gain et potentiel héroïque et légendaire');
}

export function testRenduRunesAVenir() {
  titre('rendu · Mon compte · Runes — Meules et Gemmes, en construction');
  for (const vue of ['meules', 'gemmes'] as AccountView[]) {
    const t = texteVisible(rendreVue(vue));
    ok(t.includes('Bientôt disponible') && t.includes('Cet outil est en cours de construction.'), `« ${vue} » : bientôt disponible`);
  }
}

// Lot 8a-1 (décision 20 précisée) : à la souris, les filtres tous VISIBLES sur
// une ligne, plus « Effacer les filtres ». Pas de menu déroulant (essayé, puis
// défait par Thomas). Ajouté avec eux ; les tests d'avant restent inchangés.
export function testRenduRunesFiltresLigne() {
  titre('rendu · Mon compte · Runes — filtres sur une ligne (souris)');
  for (const vue of ['liste', 'courbes', 'optimisation'] as AccountView[]) {
    const html = rendreVue(vue);
    const b = boutons(html);
    ok(!/aria-haspopup="dialog"/.test(html), `${vue} : aucun filtre fermé dans un menu`);
    ok(b.some((x) => x.texte === 'Effacer les filtres' && x.desactive && x.title === 'Aucun filtre posé'), `${vue} : « Effacer les filtres », désactivé sans filtre, et pourquoi`);
  }
}

// Lot 8a-1 : à la souris, le tri de l'Optimisation en ONGLETS (`Segmented`),
// comme le reste de la page. Celui de la Liste reste une liste déroulante
// (neuf entrées en onglets : « un peu gros », Thomas). Ajouté avec eux ; les
// tests d'avant restent inchangés.
export function testRenduRunesTriOnglets() {
  titre('rendu · Mon compte · Runes — le tri en onglets (souris)');
  const liste = boutons(rendreVue('liste'));
  ok(!liste.some((x) => x.texte === 'Score' || x.texte === 'Grade'), 'liste : pas d\'onglets de tri, la liste déroulante reste');
  const optim = boutons(rendreVue('optimisation'));
  ok(optim.some((x) => x.texte === 'Valeur actuelle' && x.presse === true), 'optimisation : « Valeur actuelle », enclenché par défaut');
  for (const e of ['Potentiel héroïque', 'Potentiel légendaire', 'Gain héroïque', 'Gain légendaire'])
    ok(optim.some((x) => x.texte === e && x.presse === false), `optimisation : onglet « ${e} »`);
}

// Lot 8a-2 : le Résumé à la souris — en-tête, bandeau de chiffres, barres
// par emplacement. Ajouté avec eux ; les tests d'avant restent inchangés.
export function testRenduRunesResumeSouris() {
  titre('rendu · Mon compte · Runes — Résumé à la souris');
  const html = rendreVue('resume');
  const t = texteVisible(html);
  ok(/<h1[^>]*>Résumé<\/h1>/.test(html) && t.includes('Résumé 9 runes'), 'l\'en-tête : « Résumé », puis le nombre de runes');
  const barres = html.match(/data-emplacements-barres[\s\S]*?<\/section>/)?.[0] ?? '';
  const texteBarres = texteVisible(barres);
  egal((texteBarres.match(/Slot \d/g) ?? []).length, 6, 'une barre par emplacement');
  ok(texteBarres.includes('89.9 % Slot 1 1 · max 89.9 %') && texteBarres.includes('94.7 % Slot 4 2 · max 109.5 %'), 'chaque barre dit la moyenne, le slot, le nombre et le maximum');
}

// Lot 8a-2 : la Liste à la souris — l'en-tête. Ajouté avec lui ; les tests
// d'avant restent inchangés.
export function testRenduRunesListeSouris() {
  titre('rendu · Mon compte · Runes — Liste à la souris');
  const html = rendreVue('liste');
  ok(/<h1[^>]*>Liste<\/h1>/.test(html) && texteVisible(html).includes('Liste 9 runes'), 'l\'en-tête : « Liste », puis le nombre de runes de l\'inventaire');
}

// Lot 8a-3 : Courbes, Comparaison, Optimisation à la souris — en-têtes et
// légende « Séries ». Ajouté avec eux ; les tests d'avant restent inchangés.
export function testRenduRunesVuesSouris() {
  titre('rendu · Mon compte · Runes — Courbes, Comparaison, Optimisation à la souris');
  const courbes = rendreVue('courbes');
  ok(/<h1[^>]*>Courbes<\/h1>/.test(courbes) && texteVisible(courbes).includes('Efficience de chaque rune, de la meilleure à la moins bonne.'), 'Courbes : le titre, et ce qu\'elles tracent');
  ok(texteVisible(courbes).includes('Séries Actuelle Potentiel Héro Potentiel Légend'), 'Courbes : la légende, sous « Séries »');
  const comparaison = rendreVue('comparaison');
  ok(/<h1[^>]*>Comparaison<\/h1>/.test(comparaison), 'Comparaison : le titre');
  ok(texteVisible(comparaison).includes('Séries Moi'), 'Comparaison : la légende, sous « Séries »');
  const optim = rendreVue('optimisation');
  ok(/<h1[^>]*>Optimisation<\/h1>/.test(optim) && texteVisible(optim).includes('Ce que tes meules et gemmes permettent d\'améliorer, rune par rune.'), 'Optimisation : le titre, et ce qu\'elle cherche');
}
