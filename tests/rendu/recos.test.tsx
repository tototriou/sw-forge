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

function Carte({ ouverte, edition, cherche }: { ouverte: boolean; edition: boolean; cherche?: string }) {
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
    />
  );
}

export function rendreCarte(ouverte: boolean, edition = false, cherche?: string): string {
  faussLocalStorage({ 'sw-forge-siege-recos-v1': JSON.stringify(RECOS) });
  return rendre(<Carte ouverte={ouverte} edition={edition} cherche={cherche} />);
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

  // Origine : trois filtres avec leur effectif ; « Toutes » enclenché.
  const toutes = boutons(html).find((b) => b.texte === 'Toutes 2');
  ok(!!toutes && toutes.presse === true, 'origine « Toutes 2 », enclenché');
  ok(boutons(html).some((b) => b.texte === 'Mes recos 1' && b.presse === false), 'origine « Mes recos 1 »');
  ok(boutons(html).some((b) => b.texte === 'Importées 1' && b.presse === false), 'origine « Importées 1 »');

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
  egal((t.match(/Fort contre/g) ?? []).length, 2, '« Fort contre » sur chaque deck');
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
