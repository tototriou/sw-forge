// Tests de rendu — Siège · Recommandations (`RecoBoard`, `RecoCard`). Principe
// dans tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et
// chaque information sont présentes, jamais l'apparence. Écrits AVANT le lot 7b
// de la refonte graphique (`spec/chantiers/refonte-graphique.md` § B.5 à
// B.10) : ils doivent rester verts sans qu'une assertion change.
//
// ⚠️ Rendu BUREAU : le panneau d'actions mobile est fermé (`menuOuvert` faux).

import RecoBoard from '../../src/components/siege/RecoBoard';
import RecoCard from '../../src/components/siege/RecoCard';
import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import { chercheMonstre } from '../../src/lib/recoSearch';
import { useSiegeState } from '../../src/hooks/useSiegeState';
import type { Monster } from '../../src/types';
import type { VueRecos } from '../../src/lib/recoDefenses';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { boutons, rendre, texteVisible, valeurs } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const c2u = (nom: string, el: string) =>
  MONSTRES.filter((m) => m.name === nom && m.element === el && m.com2usId != null).sort((a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0))[0].com2usId!;

const slot = (nom: string, el: string, extra: object = {}) => ({
  com2usId: c2u(nom, el),
  name: nom,
  stats: {},
  setOptions: [[]],
  artifacts: { attribute: [], type: [] },
  ...extra,
});

export const RECOS = {
  recos: [
    {
      id: 'r1',
      origin: 'mine',
      name: 'Contres des défenses feu',
      author: 'Thomas',
      note: 'Toujours viser le heal en premier.',
      decks: [
        {
          name: 'Def 1',
          note: 'Lushen ouvre.',
          slots: [
            slot('Lushen', 'wind', { stats: { spd: 200 }, setOptions: [['violent', 'will']] }),
            slot('Veromos', 'dark'),
            slot('Chasun', 'wind'),
          ],
          counters: [{ monsters: [
            { com2usId: c2u('Galleon', 'water'), name: 'Galleon' },
            { com2usId: c2u('Belladeon', 'light'), name: 'Belladeon' },
            { com2usId: null, name: '' },
          ], note: 'si Galleon est en lead' }],
        },
        {
          name: 'Def 2',
          note: '',
          slots: [slot('Galleon', 'water'), slot('Belladeon', 'light'), slot('Chasun', 'wind')],
          counters: [],
        },
      ],
    },
    {
      id: 'r2',
      origin: 'imported',
      name: 'Defs de guilde',
      author: 'Ami',
      note: '',
      decks: [{ name: '', note: '', slots: [slot('Lushen', 'wind'), slot('Veromos', 'dark'), slot('Chasun', 'wind')], counters: [] }],
    },
  ],
};

function Page() {
  const recos = useSiegeRecos();
  const offense = useSiegeState('offense');
  return (
    <RecoBoard
      recos={recos}
      monsters={MONSTRES}
      builds={[]}
      teams={[]}
      copies6={new Map()}
      offense={offense}
      menuOuvert={false}
      onFermerMenu={() => {}}
    />
  );
}

export function rendreRecos(etat: object = RECOS): string {
  faussLocalStorage({ 'sw-forge-siege-recos-v1': JSON.stringify(etat) });
  return rendre(<Page />);
}

function Carte({ ouverte, edition, cherche, vue }: { ouverte: boolean; edition: boolean; cherche?: string; vue?: VueRecos }) {
  const recos = useSiegeRecos();
  const monsterByCom2us = new Map(MONSTRES.filter((m) => m.com2usId != null).map((m) => [m.com2usId!, m]));
  const monsterById = new Map(MONSTRES.map((m) => [String(m.id), m]));
  // Le rendu serveur ne clique pas : une RECHERCHE (la vraie, `chercheMonstre`)
  // déplie d'office les decks qui contiennent le monstre — c'est par elle qu'on
  // voit leur contenu.
  const hit = cherche
    ? (chercheMonstre(recos.state.recos, cherche, 'all', monsterByCom2us) ?? []).find((h) => h.reco.id === recos.state.recos[0].id) ?? null
    : undefined;
  return (
    <RecoCard
      reco={recos.state.recos[0]}
      index={0}
      monsters={MONSTRES}
      monsterByCom2us={monsterByCom2us}
      monsterById={monsterById}
      offenseTeams={[]}
      match={null}
      canAnalyze={false}
      onAnalyze={() => {}}
      onClearAnalysis={() => {}}
      open={ouverte}
      onToggleOpen={() => {}}
      editing={edition}
      onToggleEdit={() => {}}
      onExport={() => {}}
      recos={recos}
      hit={hit}
      vue={vue}
    />
  );
}

export function rendreCarte(ouverte: boolean, edition = false, cherche?: string, vue?: VueRecos): string {
  faussLocalStorage({ 'sw-forge-siege-recos-v1': JSON.stringify(RECOS) });
  return rendre(<Carte ouverte={ouverte} edition={edition} cherche={cherche} vue={vue} />);
}

const nomme = (html: string, nom: string) =>
  boutons(html).filter((b) => b.ariaLabel === nom || b.title === nom || b.texte === nom);

export function testRenduRecosPage() {
  titre('rendu · Siège · Recommandations — la page, recommandations repliées');
  const html = rendreRecos();
  const t = texteVisible(html);

  // Actions de la page.
  ok(boutons(html).some((b) => b.texte.includes('Créer une recommandation')), 'bouton « Créer une recommandation »');
  ok(!!nomme(html, "Charger un fichier .json reçu d'un ami")[0], '« Importer », son infobulle');
  ok(!!nomme(html, 'Exporter toutes les recommandations en un seul fichier')[0], '« Tout exporter », son infobulle');
  ok(boutons(html).some((b) => b.texte === 'Tout effacer'), 'bouton « Tout effacer »');

  // Vue Attaque / Défense — remplace le filtre d'origine Toutes / Mes recos /
  // Importées (décision 19, [retrait #19] : ses trois assertions sont
  // remplacées par celles-ci, la fonction qu'elles couvraient n'existe plus).
  // « Attaque », l'affichage d'avant, enclenché par défaut.
  ok(boutons(html).some((b) => b.texte === 'Attaque' && b.presse === true), 'vue « Attaque », enclenchée par défaut');
  ok(boutons(html).some((b) => b.texte === 'Défense' && b.presse === false), 'vue « Défense »');

  // Recherche par monstre.
  ok(valeurs(html, 'placeholder').includes('Nom du monstre…'), 'recherche « Nom du monstre… »');

  // Chaque recommandation, repliée : nom, résumé, compositions, actions.
  for (const [nom, resume, decks] of [
    ['Contres des défenses feu', '2 decks · par Thomas', 2],
    ['Defs de guilde', '1 deck · par Ami', 1],
  ] as const) {
    ok(t.includes(nom), `« ${nom} »`);
    ok(t.includes(resume), `« ${nom} » : « ${resume} »`);
    ok(boutons(html).some((b) => b.texte === 'Consulter' && b.title === `Voir les ${decks} deck(s)`), `« ${nom} » : « Consulter », « Voir les ${decks} deck(s) »`);
  }
  ok(t.includes('Importée'), 'la recommandation reçue porte « Importée »');
  ok(t.includes('Lushen - Veromos - Chasun') && t.includes('Galleon - Belladeon - Chasun'), 'les compositions des decks se lisent repliées');
  for (const nom of ['Exporter cette recommandation (tous ses decks)', 'Éditer la recommandation', 'Supprimer cette recommandation'])
    egal(nomme(html, nom).length, 2, `« ${nom} » sur chaque recommandation`);
  const analyser = boutons(html).filter((b) => b.texte === 'Analyser mes decks');
  ok(analyser.length === 2 && analyser.every((b) => b.desactive && b.title === 'Importe ton compte pour analyser'), '« Analyser mes decks » désactivé sans compte, et pourquoi');
}

// Lot 7b : l'en-tête bureau. Ajouté APRÈS les tests d'avant (40cd2d8).
export function testRenduRecosEnTete() {
  titre('rendu · Siège · Recommandations — l\'en-tête bureau et son menu « ⋯ »');
  const html = rendreRecos();
  ok(texteVisible(html).includes('Recommandations 2 recommandations'), 'le titre, puis le compteur');
  const menu = html.match(/<div[^>]*role="menu"[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
  // Organisation de la maquette (lot 7b, demandée par Thomas) : Importer et
  // Créer restent visibles, le menu ne garde que Tout exporter et Tout effacer.
  egal(boutons(menu).map((b) => b.texte), ['Tout exporter', 'Tout effacer'], 'le menu : Tout exporter, puis Tout effacer');
  const horsMenu = boutons(html.replace(menu, ''));
  ok(horsMenu.some((b) => b.texte === 'Importer'), '« Importer » reste visible');
  ok(horsMenu.some((b) => b.texte === 'Créer une recommandation'), '« Créer une recommandation » reste visible');
}

export function testRenduRecosDeploiement() {
  titre('rendu · Siège · Recommandations — une recommandation dépliée, ses decks ouverts');
  // La recherche « Chasun » ouvre les deux decks (il est dans les deux).
  const html = rendreCarte(true, false, 'Chasun');
  const t = texteVisible(html);

  ok(boutons(html).some((b) => b.texte === 'Réduire' && b.presse === true), '« Réduire » enclenché');
  ok(t.includes('2 sur 2 decks'), 'la recherche dit « 2 sur 2 decks »');
  ok(t.includes('Consignes générales Toujours viser le heal en premier.'), 'les consignes générales');
  ok(t.includes('Consignes du deck Lushen ouvre.'), 'les consignes du deck');
  ok(/Lushen \+33%/.test(t) && /Galleon \+24%/.test(t), 'le bonus du leader de chaque deck');
  ok(t.includes('×4 ×2'), 'les sets recommandés (4 pièces + 2 pièces)');
  ok(boutons(html).some((b) => b.texte === 'VIT 103 +97' && b.title === 'Voir les valeurs totales'), 'la stat recommandée (VIT, base + bonus), bascule vers les totaux');
  ok(t.includes('Aucun set recommandé') && t.includes('Aucune stat recommandée'), 'un monstre sans consigne le dit');
  // (Compté hors de la rangée d'intitulés des colonnes, ajoutée au lot 7b —
  // décision 15 — qui porte elle aussi le mot « Fort contre ».)
  const sansIntitules = texteVisible(html.replace(/<div[^>]*data-intitules-decks[^>]*>[\s\S]*?<\/div>/, ''));
  egal((sansIntitules.match(/Fort contre/g) ?? []).length, 2, '« Fort contre » sur chaque deck');
  ok(!!nomme(html, 'Modifier cette défense')[0], 'la défense visée se modifie');
  egal(nomme(html, 'Ajouter une défense que ce deck bat').length, 2, '« Ajouter une défense que ce deck bat » sur chaque deck');
  egal(nomme(html, 'Replier ce deck').length, 4, 'chaque deck ouvert se replie (chevron et en-tête)');
  egal(nomme(html, 'Éditer ce deck').length, 2, '« Éditer ce deck » sur chaque deck');
}

export function testRenduRecosEdition() {
  titre('rendu · Siège · Recommandations — une recommandation en édition');
  const html = rendreCarte(true, true);
  const t = texteVisible(html);
  ok(boutons(html).some((b) => b.ariaLabel === "Terminer l'édition" && b.presse === true), '« Terminer l\'édition » enclenché');
  ok(boutons(html).some((b) => b.texte === 'Ajouter un deck vide'), '« Ajouter un deck vide »');
  const offense = boutons(html).find((b) => b.texte.startsWith("Importer un deck d'offense"));
  ok(!!offense && offense.desactive && offense.title === 'Aucune équipe d\'offense : importe ton compte (barre du haut) après avoir sauvegardé tes attaques en jeu.', '« Importer un deck d\'offense » désactivé sans équipe, et pourquoi');
  ok(t.includes('Déplier tous les decks'), '« Déplier tous les decks »');
}

// Décision 19 : la vue Défense — chaque défense visée, avec les offenses qui
// la battent. Ajouté avec elle ; les tests d'avant restent inchangés.
export function testRenduRecosVueDefense() {
  titre('rendu · Siège · Recommandations — la vue Défense');

  // Repliée : une puce par défense (et le nombre d'offenses), les decks sans
  // défense comptés à part.
  const repliee = texteVisible(rendreCarte(false, false, undefined, 'defense'));
  ok(repliee.includes('Galleon - Belladeon · 1'), 'repliée : la défense « Galleon - Belladeon », battue par 1 offense');
  ok(repliee.includes('1 deck sans défense visée'), 'repliée : le deck sans défense visée est compté');

  // Dépliée : la défense, puis l'offense qui la bat, avec sa précision.
  const html = rendreCarte(true, false, undefined, 'defense');
  const t = texteVisible(html);
  egal((html.match(/data-defense-visee/g) ?? []).length, 1, 'une ligne par défense visée');
  ok(t.includes('Défense Offenses fortes contre elle'), 'les intitulés des colonnes');
  ok(t.includes('Galleon - Belladeon Lushen - Veromos - Chasun — si Galleon est en lead'), 'la défense, puis son offense et la précision que ce deck donne');
  ok(t.includes('Aucune défense visée Galleon - Belladeon - Chasun'), 'le deck sans défense visée reste affiché, à part');
  egal((html.match(/data-offense-contre/g) ?? []).length, 2, 'chaque deck apparaît : 1 contre la défense, 1 sans défense');

  // Lecture seule : en édition, la carte reprend la vue Attaque.
  const edition = rendreCarte(true, true, undefined, 'defense');
  ok(!edition.includes('data-defense-visee'), 'en édition : plus de vue Défense');
  ok(boutons(edition).some((b) => b.texte === 'Ajouter un deck vide'), 'en édition : les formulaires de la vue Attaque');
}
