// Tests de rendu AU TÉLÉPHONE — Accueil et RTA (lot 11a de la refonte
// graphique, `spec/chantiers/refonte-graphique.md` § B.11). Principe dans
// tests/rendu/outils-rendu.tsx ; rendu téléphone par `auTelephone`, qui
// fait apparaître les panneaux « Options » (`MobileSheet`). Écrits AVANT le
// 11a : ils doivent rester verts sans qu'une assertion change.

import HomePage, { HomeStats } from '../../src/pages/HomePage';
import RtaPage from '../../src/pages/RtaPage';
import { useRtaState } from '../../src/hooks/useRtaState';
import type { Monster, RtaState } from '../../src/types';
import type { RtaSub } from '../../src/App';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { auTelephone, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

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

function Page({ sub, menuOuvert }: { sub: RtaSub; menuOuvert: boolean }) {
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
      menuOuvert={menuOuvert}
      onFermerMenu={() => {}}
    />
  );
}

const rendreRta = (sub: RtaSub, menuOuvert: boolean) =>
  auTelephone(() => {
    faussLocalStorage({ 'sky-arena-rta-v1': JSON.stringify(PREPA) });
    return rendre(<Page sub={sub} menuOuvert={menuOuvert} />);
  });

const STATS: HomeStats = { rta: 3, defense: 2, offense: 1, recos: 4 };

export function testRenduTelephoneAccueil() {
  titre('rendu téléphone · Accueil');
  const t = texteVisible(auTelephone(() => rendre(<HomePage stats={STATS} onImport={() => {}} />)));
  ok(t.startsWith('SW Forge La boîte à outils pour Summoners War.'), 'le nom et l\'accroche');
  ok(t.includes('Dépose ton fichier .json ici ou clique pour parcourir Export SWEX (.json) lu dans la page, jamais envoyé'), 'l\'import, et ce qu\'il devient');
  ok(t.includes('Ton espace Prépa RTA 3 monstres Défense de siège 2 équipes Offense de siège 1 équipe Recommandations 4 recos'), '« Ton espace » et ses quatre compteurs');
  ok(t.includes('Comment ça marche 01 Exporte ton compte') && t.includes('03 Prépare et optimise'), 'les trois étapes');
  for (const f of ['Préparation RTA', 'Prépa d\'un ami', 'Défenses et offenses', 'Recommandations', 'Analyse de runes', 'Analyse d\'artéfacts', 'Optimiseur de runes', 'Speed tuning', 'Bestiaire', 'Mécaniques', 'Nouveautés', 'Arène classique'])
    ok(t.includes(f), `tuile « ${f} »`);
  ok(t.includes('Prêt à préparer tes équipes ?') && t.includes('Importer mon compte'), 'l\'appel final à importer');
}

export function testRenduTelephoneRta() {
  titre('rendu téléphone · RTA · Ma prépa');
  const ferme = rendreRta('prepa', false);
  const t = texteVisible(ferme);
  egal((ferme.match(/role="dialog"/g) ?? []).length, 0, 'panneau « Options » fermé : aucun dialogue');
  // Au doigt, on ne glisse pas : chaque carte porte le choix de sa section.
  for (const carte of ['Galleon 108 Non classé Swift Violent Despair Autre', 'Chasun 251 Non classé Swift Violent Despair Autre', 'Veromos 190 Non classé Swift Violent Despair Autre'])
    ok(t.includes(carte), `carte « ${carte.split(' ')[0]} » : vitesse et choix de section`);
  ok(t.includes('Despair 0 Glisse des monstres ici') && t.includes('Ajouter une section'), 'sections vides et ajout de section');
  ok(t.includes('Ordre de tour par vitesse combat totale Lead SPD +33% +28% +24% +21% +19% Sans lead'), 'ordre de tour et leads');
  ok(t.endsWith('1 Chasun 267 2 Veromos 205 3 Galleon 125'), 'l\'ordre de tour, rang et vitesse');

  const ouvert = rendreRta('prepa', true);
  const to = texteVisible(ouvert);
  const b = boutons(ouvert);
  egal((ouvert.match(/role="dialog"/g) ?? []).length, 1, 'panneau « Options » ouvert : un dialogue');
  ok(valeurs(ouvert, 'aria-label').includes('Ma prépa RTA'), 'le panneau est nommé');
  ok(to.includes('Ma prépa RTA Monstre Créer un monstre Sauvegarder Reprendre Exporter Importer Catégories Catégorie Vitesses Modifiés Catégories Tout effacer'), 'le panneau : ses actions, dans l\'ordre');
  ok(b.some((x) => x.ariaLabel === 'Reprendre' && x.desactive && x.title === 'Aucun point de sauvegarde : clique d\'abord sur « Sauvegarder »'), '« Reprendre » désactivé, et pourquoi');
  ok(b.some((x) => x.ariaLabel === 'Exporter' && x.title === 'Télécharger ta prépa en fichier .json, pour la partager ou la garder de côté'), '« Exporter », et ce qu\'il fait');
  ok(b.some((x) => x.ariaLabel === 'Importer' && x.title === 'Reprendre une prépa exportée : une archive, ou celle d\'un autre navigateur. Elle remplacera la tienne.'), '« Importer », et ce qu\'il remplace');
  ok(b.some((x) => x.texte === 'Vitesses' && x.presse === true && x.title === 'Masquer les vitesses sur les cartes'), '« Vitesses », enclenché');
  ok(b.some((x) => x.texte === 'Modifiés' && x.presse === true), '« Modifiés », enclenché');
  ok(b.some((x) => x.ariaLabel === 'Fermer'), 'le panneau se ferme');
}

// Lot 13 (décision 28) : le filtre par section au téléphone — ajouté avec lui.
export function testRenduTelephoneRtaFiltre() {
  titre('rendu téléphone · RTA — filtre par section');
  const html = rendreRta('prepa', false);
  ok(valeurs(html, 'aria-label').includes('Afficher une section'), 'la rangée de pastilles est nommée');
  const b = boutons(html);
  ok(b.some((x) => x.texte === 'Tous 3' && x.presse === true), '« Tous », enclenché, avec le nombre de monstres');
  for (const p of ['Non classé 1', 'Swift 1', 'Violent 1', 'Despair 0', 'Autre 0'])
    ok(b.some((x) => x.texte === p && x.presse === false), `« ${p} »`);
  ok(texteVisible(html).endsWith('1 Chasun 267 2 Veromos 205 3 Galleon 125'), 'l\'ordre de tour reste entier');
}

export function testRenduTelephoneRtaAmi() {
  titre('rendu téléphone · RTA · Ami');
  const html = rendreRta('ami', true);
  const t = texteVisible(html);
  ok(t.startsWith('Aucune prépa consultée Ouvre le .json qu\'un ami t\'a partagé'), 'l\'état vide, et quoi ouvrir');
  ok(t.includes('Ta prépa n\'est pas touchée , rien n\'est comparé à tes monstres et rien n\'est conservé.'), 'ce qui ne sera pas touché');
  ok(boutons(html).some((x) => x.texte === 'Ouvrir la prépa d\'un ami' && !!x.title), '« Ouvrir la prépa d\'un ami », et ce qu\'il lit');
  egal((html.match(/role="dialog"/g) ?? []).length, 0, 'pas de panneau « Options » sur « Ami »');
}
