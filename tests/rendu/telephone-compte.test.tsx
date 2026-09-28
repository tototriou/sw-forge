// Tests de rendu AU TÉLÉPHONE — Mon compte : Monstres, Runes, Artéfacts
// (lot 11c de la refonte graphique, `spec/chantiers/refonte-graphique.md`
// § B.11). Principe dans tests/rendu/outils-rendu.tsx ; rendu téléphone par
// `auTelephone`, qui fait apparaître les panneaux « Options ». Écrits AVANT le
// 11c : ils doivent rester verts sans qu'une assertion change.

import AccountPage from '../../src/pages/AccountPage';
import RunesSection from '../../src/components/account/RunesSection';
import type { AccountView } from '../../src/App';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { auTelephone, boutons, rendre, texteVisible, valeurs } from './outils-rendu';
import { ARTEFACTS, BOX } from './compte.test';
import { RUNES } from './runes.test';

const MONSTRES = monstersJson() as Monster[];

const rendreCompte = (sub: 'monstres' | 'artefacts', vue: AccountView, menuOuvert: boolean) =>
  auTelephone(() => {
    faussLocalStorage({});
    return rendre(
      <AccountPage
        sub={sub}
        vue={vue}
        box={BOX}
        runes={[]}
        artifacts={ARTEFACTS}
        crafts={[]}
        usedRuneIds={[]}
        loadState="live"
        hydrating={false}
        allMonsters={MONSTRES}
        menuOuvert={menuOuvert}
        onFermerMenu={() => {}}
      />,
    );
  });

const rendreRunes = (vue: AccountView, menuOuvert: boolean) =>
  auTelephone(() => {
    faussLocalStorage({});
    return rendre(<RunesSection runes={RUNES} crafts={[]} usedRuneIds={[1, 2]} vue={vue} menuOuvert={menuOuvert} onFermerMenu={() => {}} />);
  });

const dialogues = (html: string) => (html.match(/role="dialog"/g) ?? []).length;

export function testRenduTelephoneMonstres() {
  titre('rendu téléphone · Mon compte · Monstres');
  const html = rendreCompte('monstres', 'liste', true);
  const t = texteVisible(html);
  egal(dialogues(html), 1, 'un panneau « Options »');
  ok(valeurs(html, 'aria-label').includes('Filtrer ma box'), 'le panneau « Filtrer ma box »');
  ok(t.includes('Filtrer ma box Élément Feu Eau Vent Lumière Ténèbres Nat 5★ 4★ 3★ 2★ Doublons 2A'), 'ses filtres : élément, Nat, Doublons, 2A');
  ok(valeurs(html, 'placeholder').includes('Rechercher un monstre…'), 'la recherche reste sur la page');
  ok(boutons(html).some((x) => x.texte === 'Sortie' && x.presse === true), 'le tri reste sur la page');
  ok(t.endsWith('Velajuel Galleon Chasun Lushen Belladeon Veromos'), 'la box, dans l\'ordre « Sortie »');
}

export function testRenduTelephoneArtefacts() {
  titre('rendu téléphone · Mon compte · Artéfacts');
  const liste = rendreCompte('artefacts', 'liste', true);
  const t = texteVisible(liste);
  egal(dialogues(liste), 1, 'Liste : un panneau « Options »');
  ok(t.includes('Filtrer mes artéfacts Catégorie Tous Attribut Type') && t.includes('Rareté Légendaire Héroïque Rare Magique Commun Stat principale Toutes PV ATQ DEF'), 'Liste : ses filtres, catégorie à stat principale');
  ok(t.includes('Propriété 1 — 2 — 8 artéfacts (5 attribut · 3 type)'), 'Liste : la propriété, puis le compte');
  ok(boutons(liste).some((x) => x.ariaLabel === 'Trier du plus petit au plus grand'), 'Liste : le sens du tri');
  const resume = rendreCompte('artefacts', 'resume', true);
  egal(dialogues(resume), 0, 'Résumé : pas de panneau');
  ok(texteVisible(resume).includes('Artéfacts 8 5 attribut · 3 type · 2 à monter'), 'Résumé : les chiffres clés');
  ok(texteVisible(resume).includes('Quad rolls · sur quelle propriété Aucun quad roll dans l\'inventaire.'), 'Résumé : jusqu\'au dernier panneau');
}

export function testRenduTelephoneRunes() {
  titre('rendu téléphone · Mon compte · Runes');
  const liste = rendreRunes('liste', true);
  const tl = texteVisible(liste);
  egal(dialogues(liste), 1, 'Liste : un panneau « Options »');
  ok(valeurs(liste, 'aria-label').includes('Filtrer mes runes'), 'Liste : le panneau « Filtrer mes runes »');
  // ⚠️ Lot 11c (décision 26) : le panneau est rangé en « Trier » puis
  // « Filtrer », dans l'ordre du DOM (il était remonté par CSS) ; « Effacer
  // les filtres » y entre. Mêmes contrôles.
  ok(tl.includes('Filtrer mes runes Trier Trier par Grade'), 'Liste : le bloc « Trier » en tête du panneau');
  ok(tl.includes('Filtrer Sets Slot 1 2 3 4 5 6 Toutes Antiques uniquement Aucune antique Propriété'), 'Liste : le bloc « Filtrer » — sets, slot, antiques, propriété');
  ok(boutons(liste).filter((x) => x.texte === 'Effacer les filtres').length === 2, 'Liste : « Effacer les filtres » dans le panneau aussi');
  ok(tl.includes('9 runes · meilleure efficience 109.5%'), 'Liste : le compte et la meilleure');

  const courbes = texteVisible(rendreRunes('courbes', true));
  ok(courbes.includes('Sets Slot 1 2 3 4 5 6 Toutes Antiques uniquement Aucune antique') && courbes.includes('Gemme + meule Meule seule') && courbes.includes('Nb de runes'), 'Courbes : filtres, potentiel, nombre de runes dans la page');

  const optim = rendreRunes('optimisation', true);
  const to = texteVisible(optim);
  egal(dialogues(optim), 1, 'Optimisation : un panneau');
  // ⚠️ Lot 11c (décision 26) : « Gemme + meule / Meule seule » a quitté le
  // panneau pour la tête de la page (vérifié juste après).
  ok(to.includes('Options d\'optimisation Palier % Runes') && to.includes('Faisable avec ma réserve Sans les immémoriaux Runes utilisées'), 'Optimisation : palier, antiques, options');
  ok(to.includes('Gemme + meule Meule seule Sets'), 'Optimisation : le mode du potentiel en tête de la page, avant les filtres');

  const comparaison = texteVisible(rendreRunes('comparaison', true));
  ok(comparaison.includes('Courbes partagées Fichiers de compte') && comparaison.includes('Exporter ma courbe Importer une courbe'), 'Comparaison : sous-onglets, export, import');

  const resume = rendreRunes('resume', true);
  egal(dialogues(resume), 0, 'Résumé : pas de panneau');
  ok(texteVisible(resume).includes('Runes 9 7 au +15 Eff. moyenne 85.2 %'), 'Résumé : les chiffres clés');
}
