// Tests de rendu — RTA, « Ma prépa » et « Ami » (`RtaPage`). Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et chaque
// information sont présentes, jamais l'apparence. Écrits AVANT le lot 6 de la
// refonte graphique (`spec/chantiers/refonte-graphique.md` § B.5 à B.10) :
// ils doivent rester verts sans qu'une assertion change.
//
// ⚠️ Rendu BUREAU : le panneau d'actions mobile est fermé (`menuOuvert`
// faux). Le téléphone a son propre lot (11).

import RtaPage from '../../src/pages/RtaPage';
import { useRtaState } from '../../src/hooks/useRtaState';
import type { Monster, RtaState } from '../../src/types';
import type { RtaSub } from '../../src/App';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { bouton, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const id = (nom: string, el: string) =>
  String(MONSTRES.filter((m) => m.name === nom && m.element === el).sort((a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0))[0].id);

const CHASUN = id('Chasun', 'wind');
const GALLEON = id('Galleon', 'water');
const VEROMOS = id('Veromos', 'dark');

const PREPA: RtaState = {
  sections: ['swift', 'violent', 'despair', 'other'],
  entries: {
    [CHASUN]: { monsterId: CHASUN, section: 'swift', runeSpeed: 150 },
    [GALLEON]: { monsterId: GALLEON, section: 'unassigned', runeSpeed: null },
    [VEROMOS]: { monsterId: VEROMOS, section: 'violent', runeSpeed: 90 },
  },
};

const CATEGORIES = {
  categories: [{ id: 'c1', label: 'Striper', color: '#e4463a', members: [CHASUN] }],
  seeded: true,
};

function Page({ sub }: { sub: RtaSub }) {
  const rta = useRtaState();
  return (
    <RtaPage
      sub={sub}
      rta={rta}
      monsters={MONSTRES}
      loadState="live"
      onCreateMonster={() => MONSTRES[0]}
      customMonsters={[]}
      onDeleteMonster={() => {}}
      menuOuvert={false}
      onFermerMenu={() => {}}
    />
  );
}

function rendrePrepa(stockage: Record<string, unknown>, sub: RtaSub = 'prepa'): string {
  faussLocalStorage(Object.fromEntries(Object.entries(stockage).map(([k, v]) => [k, JSON.stringify(v)])));
  return rendre(<Page sub={sub} />);
}

export function testRenduRtaPrepa() {
  titre('rendu · RTA · Ma prépa — une prépa de trois monstres');

  const html = rendrePrepa({ 'swblacksmith-rta-v1': PREPA, 'swblacksmith-rta-categories-v1': CATEGORIES });
  const t = texteVisible(html);

  // Ajout d'un monstre : le champ de recherche.
  ok(valeurs(html, 'placeholder').includes('Rechercher un monstre à ajouter à ta prépa RTA…'), 'champ « Rechercher un monstre à ajouter à ta prépa RTA… »');

  // Compteur et actions de construction.
  ok(t.includes('3 monstres en prépa'), 'compteur « 3 monstres en prépa »');
  ok(!!bouton(html, 'Créer un monstre'), 'bouton « Créer un monstre »');
  ok(!!bouton(html, 'Tout effacer'), 'bouton « Tout effacer » (prépa non vide)');

  // Point de sauvegarde et partage.
  const sauver = bouton(html, 'Sauvegarder');
  ok(!!sauver && !sauver.desactive && (sauver.title ?? '').startsWith('Fige la prépa actuelle comme point de retour.'), '« Sauvegarder » actif, son infobulle');
  const reprendre = bouton(html, 'Reprendre');
  ok(!!reprendre && reprendre.desactive && reprendre.title === "Aucun point de sauvegarde : clique d'abord sur « Sauvegarder »", '« Reprendre » désactivé sans point de sauvegarde, et pourquoi');
  ok(!bouton(html, 'Réinitialiser'), '« Réinitialiser » absent tant qu\'aucun compte n\'a été importé');
  const exporter = bouton(html, 'Exporter');
  ok(!!exporter && !exporter.desactive && exporter.title === 'Télécharger ta prépa en fichier .json, pour la partager ou la garder de côté', '« Exporter » actif, son infobulle');
  const importer = bouton(html, 'Importer');
  ok(!!importer && importer.title === "Reprendre une prépa exportée : une archive, ou celle d'un autre navigateur. Elle remplacera la tienne.", '« Importer » (une prépa), son infobulle');
  ok(!t.includes('Point de sauvegarde ·'), 'pas de ligne « Point de sauvegarde · » sans point');

  // Catégories.
  ok(t.includes('Catégories'), 'barre « Catégories »');
  ok(t.includes('Striper'), 'la catégorie « Striper »');
  ok(!!bouton(html, 'Catégorie'), 'bouton de création « Catégorie »');

  // Sections : Non classé, les sets, Autre ; leurs compteurs ; leur suppression.
  for (const s of ['Non classé', 'Swift', 'Violent', 'Despair', 'Autre']) ok(t.includes(s), `section « ${s} »`);
  const suppr = boutons(html).filter((b) => b.ariaLabel === 'Supprimer la section (les monstres reviennent en Non classé)' || b.title === 'Supprimer la section (les monstres reviennent en Non classé)');
  egal(suppr.length, 3, 'trois sections supprimables (Swift, Violent, Despair) — « Autre » ne l\'est pas');
  ok(t.includes('Glisse des monstres ici'), 'une section vide invite à y glisser des monstres');

  // Cartes : chaque monstre, son retrait, son sélecteur de section.
  for (const nom of ['Chasun', 'Galleon', 'Veromos']) {
    ok(t.includes(nom), `carte « ${nom} »`);
    ok(!!boutons(html).find((b) => b.ariaLabel === `Retirer ${nom}` || b.title === `Retirer ${nom}`), `carte « ${nom} » : bouton « Retirer ${nom} »`);
  }
  egal(valeurs(html, 'title').filter((v) => v === 'Déplacer vers une section').length, 3, 'chaque carte a son sélecteur « Déplacer vers une section »');

  // Ajouter une section.
  ok(t.includes('Ajouter une section'), '« Ajouter une section »');
  ok(t.includes('Choisir un set de runes…'), 'sélecteur « Choisir un set de runes… »');
  const creer = boutons(html).find((b) => b.texte === 'Créer');
  ok(!!creer && creer.desactive, '« Créer » (une section) désactivé tant qu\'aucun set n\'est choisi');

  // Ordre de tour.
  ok(t.includes('Ordre de tour') && t.includes('par vitesse combat totale'), '« Ordre de tour · par vitesse combat totale »');
  ok(t.includes('Lead SPD'), 'rangée « Lead SPD »');
  ok(!!bouton(html, 'Sans lead'), 'bouton « Sans lead »');
  egal(valeurs(html, 'placeholder').filter((v) => v === '+ runes').length, 3, 'un champ « + runes » par monstre de l\'ordre de tour');
  ok(!!bouton(html, 'Surligner les changements'), 'bouton « Surligner les changements »');
}

// Décision 13 (lot 6) : sur bureau, « Exporter » dans l'en-tête, le reste dans
// le menu « ⋯ ». Ajouté APRÈS le commit des tests d'avant : les assertions
// ci-dessus, elles, n'ont pas changé.
export function testRenduRtaMenu() {
  titre('rendu · RTA · Ma prépa — l\'en-tête bureau et son menu « ⋯ »');

  const html = rendrePrepa({
    'swblacksmith-rta-v1': PREPA,
    'swblacksmith-rta-backup-v1': { date: '2026-09-01T10:00:00.000Z', state: PREPA, categories: [] },
    'swblacksmith-rta-import-v1': { date: '2026-09-01T10:00:00.000Z', state: PREPA, categories: [] },
  });
  ok(texteVisible(html).includes('Ma prépa 3 monstres en prépa'), 'en-tête : « Ma prépa », puis le compteur');
  ok(!!bouton(html, "Plus d'actions"), 'bouton « Plus d\'actions »');
  const menu = html.match(/<div[^>]*role="menu"[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
  const entrees = boutons(menu).map((b) => b.texte);
  egal(entrees, ['Sauvegarder', 'Reprendre', 'Importer une prépa', 'Créer un monstre', 'Réinitialiser', 'Tout effacer'], 'le menu, dans l\'ordre : construction, puis les deux gestes destructeurs');
  ok(!entrees.includes('Exporter') && !!bouton(html, 'Exporter'), '« Exporter » reste visible, hors du menu');
}

export function testRenduRtaVide() {
  titre('rendu · RTA · Ma prépa — prépa vide');

  const html = rendrePrepa({});
  const t = texteVisible(html);
  ok(t.includes('0 monstre en prépa'), 'compteur au singulier : « 0 monstre en prépa »');
  ok(!bouton(html, 'Tout effacer'), 'pas de « Tout effacer » sur une prépa vide');
  const sauver = bouton(html, 'Sauvegarder');
  ok(!!sauver && sauver.desactive && sauver.title === 'Ajoute des monstres avant de poser un point de sauvegarde', '« Sauvegarder » désactivé, et pourquoi');
  ok(!!bouton(html, 'Exporter')?.desactive, '« Exporter » désactivé');
  ok(t.includes("Ajoute des monstres pour visualiser l'ordre de tour."), 'l\'ordre de tour invite à ajouter des monstres');
}

export function testRenduRtaSauvegarde() {
  titre('rendu · RTA · Ma prépa — point de sauvegarde et import de compte');

  const point = { date: '2026-09-01T10:00:00.000Z', state: PREPA, categories: [] };
  const html = rendrePrepa({
    'swblacksmith-rta-v1': PREPA,
    'swblacksmith-rta-backup-v1': point,
    'swblacksmith-rta-import-v1': point,
  });
  const t = texteVisible(html);
  const reprendre = bouton(html, 'Reprendre');
  ok(!!reprendre && !reprendre.desactive && (reprendre.title ?? '').startsWith('Revenir au point de sauvegarde ('), '« Reprendre » actif, avec la date du point');
  const reinit = bouton(html, 'Réinitialiser');
  ok(!!reinit && (reinit.title ?? '').startsWith("Remettre la prépa dans l'état de ton dernier import de compte ("), '« Réinitialiser » présent après un import, son infobulle');
  ok(t.includes('Point de sauvegarde ·'), 'ligne « Point de sauvegarde · … »');
}

// Lot 13 (décision 29) : « Sauvegardé il y a … » — ajouté avec lui. Avant tout
// changement dans la session, il dit la conservation sans inventer d'heure.
export function testRenduRtaIndicateur() {
  titre('rendu · RTA · Ma prépa — « Enregistré sur cet appareil »');
  const t = texteVisible(rendrePrepa({ 'swblacksmith-rta-v1': PREPA }));
  egal((t.match(/Enregistré sur cet appareil/g) ?? []).length, 2, 'l\'indicateur, à chaque format (en-tête bureau, ligne téléphone)');
  ok(t.includes('Ma prépa 3 monstres en prépa Enregistré sur cet appareil'), 'à la souris, juste après le compteur');
}

export function testRenduRtaAmi() {
  titre('rendu · RTA · Ami — aucune prépa ouverte');

  const html = rendrePrepa({}, 'ami');
  const t = texteVisible(html);
  ok(t.includes('Aucune prépa consultée'), '« Aucune prépa consultée »');
  ok(t.includes('Ta prépa n\'est pas touchée'), '« Ta prépa n\'est pas touchée »');
  const ouvrir = bouton(html, "Ouvrir la prépa d'un ami");
  ok(!!ouvrir && ouvrir.title === 'Ouvrir un .json en lecture : une prépa exportée, ou un export SWEX complet dont on ne lira que la box RTA. Ta prépa n\'est pas touchée.', 'bouton « Ouvrir la prépa d\'un ami », son infobulle');
  ok(!t.includes('Ordre de tour'), 'la prépa de l\'utilisateur n\'est pas affichée sur « Ami »');
}
