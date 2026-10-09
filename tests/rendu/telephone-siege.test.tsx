// Tests de rendu AU TÉLÉPHONE — Siège : Défense, Offense, Recommandations
// (lot 11b de la refonte graphique). Principe dans tests/rendu/outils-rendu.tsx ; rendu téléphone par
// `auTelephone`, qui fait apparaître les panneaux « Options ». Écrits AVANT le
// 11b : ils doivent rester verts sans qu'une assertion change.

import SiegeBoard from '../../src/components/siege/SiegeBoard';
import RecoBoard from '../../src/components/siege/RecoBoard';
import { useSiegeState, SiegeSide } from '../../src/hooks/useSiegeState';
import { useSiegeRecos } from '../../src/hooks/useSiegeRecos';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { auTelephone, boutons, rendre, texteVisible, valeurs } from './outils-rendu';
import { RECOS } from './recos.test';

const MONSTRES = monstersJson() as Monster[];
const id = (nom: string, el: string) =>
  String(MONSTRES.filter((m) => m.name === nom && m.element === el).sort((a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0))[0].id);

function Banc({ side, menuOuvert }: { side: SiegeSide; menuOuvert: boolean }) {
  const siege = useSiegeState(side);
  return (
    <SiegeBoard
      compteCharge={false}
      sourcesOptimizer={{ box: [], rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map() }}
      onImporterEquipe={() => { throw new Error('Export désactivé sans compte.'); }}
      side={side}
      siege={siege}
      monsters={MONSTRES}
      siegeDefenseTeams={[]}
      siegeOffenseTeams={[]}
      loadState="live"
      onCreateMonster={() => MONSTRES[0]}
      customMonsters={[]}
      onDeleteMonster={() => {}}
      menuOuvert={menuOuvert}
      onFermerMenu={() => {}}
    />
  );
}

const equipe = (noms: [string, string][], vit: (number | null)[], lead: number) => ({
  id: noms.map((n) => n[0]).join('-'),
  lead,
  tickAlertDismissed: false,
  slots: noms.map((n, i) => ({ monsterId: n[0] ? id(n[0], n[1]) : null, runeSpeed: vit[i], tick: 0, sets: ['swift'] })),
});

const rendreCamp = (side: SiegeSide, menuOuvert: boolean) =>
  auTelephone(() => {
    faussLocalStorage({
      [`swblacksmith-siege-${side}-v1`]: JSON.stringify({
        teams: [
          equipe([['Lushen', 'wind'], ['Veromos', 'dark'], ['Chasun', 'wind']], [120, 130, 140], 24),
          equipe([['Galleon', 'water'], ['Belladeon', 'light'], ['', '']], [110, null, null], 0),
        ],
      }),
    });
    return rendre(<Banc side={side} menuOuvert={menuOuvert} />);
  });

function Recos({ menuOuvert }: { menuOuvert: boolean }) {
  const recos = useSiegeRecos();
  const offense = useSiegeState('offense');
  return (
    <RecoBoard recos={recos} monsters={MONSTRES} builds={[]} teams={[]} copies6={new Map()} offense={offense} menuOuvert={menuOuvert} onFermerMenu={() => {}}
      onImporterEquipe={() => { throw new Error('Action non attendue dans le rendu serveur.'); }} compteCharge={false}
      sourcesOptimizer={{ box: [], rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [], monsterById: new Map(MONSTRES.map(m => [String(m.id), m])) }} />
  );
}
const rendreRecos = (menuOuvert: boolean) =>
  auTelephone(() => {
    faussLocalStorage({ 'swblacksmith-siege-recos-v1': JSON.stringify(RECOS) });
    return rendre(<Recos menuOuvert={menuOuvert} />);
  });

const dialogues = (html: string) => (html.match(/role="dialog"/g) ?? []).length;

export function testRenduTelephoneSiege() {
  titre('rendu téléphone · Siège · Défense et Offense');
  const ferme = rendreCamp('defense', false);
  const t = texteVisible(ferme);
  egal(dialogues(ferme), 0, 'panneau « Options » fermé : aucun dialogue');
  ok(t.includes("Équipe 1 +33% (donjon) Exporter vers l'Optimizer Éditer Supprimer Lushen 239 Veromos 245 Chasun 256 Speed tune Voir le speed tune"), 'équipe 1 : lead, actions, monstres et vitesses, speed tune');
  ok(t.includes("Équipe 2 +24% Exporter vers l'Optimizer Éditer Supprimer Galleon 261 Belladeon 151 + vide Speed tune Voir le speed tune"), 'équipe 2 : l\'emplacement vide, à remplir');
  ok(valeurs(ferme, 'aria-label').includes('Chercher une équipe par monstre'), 'la recherche d\'équipe');
  // Lot 11b (décision 25) : ajouté avec l'interrupteur.
  ok(t.includes('2 équipes Vérifier mes speed') && valeurs(ferme, 'aria-label').includes('Vérifier mes speed'), '« Vérifier mes speed » : un interrupteur sur la page, à côté du compteur');

  for (const side of ['defense', 'offense'] as const) {
    const ouvert = rendreCamp(side, true);
    const to = texteVisible(ouvert);
    const b = boutons(ouvert);
    egal(dialogues(ouvert), 1, `${side} : panneau « Options » ouvert`);
    ok(valeurs(ouvert, 'aria-label').includes(`Actions — ${side === 'defense' ? 'défense' : 'attaque'}`), `${side} : le panneau est nommé`);
    // ⚠️ Lot 11b (décision 25) : « Vérifier mes speed » a quitté le panneau
    // pour un interrupteur sur la page (vérifié plus bas) ; le reste du
    // panneau, dans le même ordre.
    ok(to.includes(side === 'defense'
      ? "Équipe Ajouter une équipe Exporter Importer Monstre Créer un monstre Exporter vers l'Optimizer Tout effacer"
      : 'Équipe Ajouter une équipe Exporter Importer Monstre Créer un monstre Tout effacer'), `${side} : ses actions, groupées, dans l'ordre`);
    ok(b.some((x) => x.texte === 'Exporter' && x.title === 'Exporter les équipes affichées en fichier .json'), `${side} : « Exporter », et ce qu'il exporte`);
    ok(b.some((x) => x.texte === 'Importer' && x.title === 'Ajouter les équipes d\'un fichier .json exporté par SW Blacksmith — les tiennes ne sont pas touchées'), `${side} : « Importer », et ce qu'il ne touche pas`);
  }
  const b = boutons(ferme);
  ok(b.filter((x) => x.ariaLabel === 'Éditer l\'équipe').length === 2 && b.filter((x) => x.ariaLabel === 'Supprimer l\'équipe').length === 2, 'éditer et supprimer, sur chaque équipe');
  egal(b.filter((x) => x.title === 'Modifier').length, 6, 'chaque emplacement se modifie, le vide compris');
  ok(b.filter((x) => x.title === 'Ouvre le speed tuning avec cette équipe déjà chargée').length === 2, '« Voir le speed tune » sur chaque équipe');
}

export function testRenduTelephoneRecos() {
  titre('rendu téléphone · Siège · Recommandations');
  const ferme = rendreRecos(false);
  const t = texteVisible(ferme);
  egal(dialogues(ferme), 0, 'panneau « Options » fermé : aucun dialogue');
  ok(t.includes('Contres des défenses feu Consulter 2 decks · par Joueur Analyser mes decks Lushen - Veromos - Chasun Galleon - Belladeon - Chasun'), 'une recommandation : nom, decks, auteur, analyse, compositions');
  ok(t.includes('Defs de guilde Consulter Importée 1 deck · par Ami'), 'une recommandation importée, marquée');

  const ouvert = rendreRecos(true);
  const to = texteVisible(ouvert);
  const b = boutons(ouvert);
  egal(dialogues(ouvert), 1, 'panneau « Options » ouvert');
  ok(valeurs(ouvert, 'aria-label').includes('Actions — recommandations'), 'le panneau est nommé');
  ok(to.includes('Actions — recommandations Créer Créer une recommandation Importer Exporter Tout exporter Analyser une recommandation Importe ton compte pour analyser Contres des défenses feu Defs de guilde Analyser Vue Attaque Défense'), 'ses actions, l\'analyse d\'une recommandation, la vue');
  ok(b.some((x) => x.texte === 'Analyser' && x.desactive), '« Analyser » désactivé sans compte');
  ok(b.some((x) => x.texte === 'Attaque' && x.presse === true) && b.some((x) => x.texte === 'Défense' && x.presse === false), 'vue Attaque / Défense');
  for (const a of ['Consulter', 'Exporter cette recommandation (tous ses decks)', 'Éditer la recommandation', 'Supprimer cette recommandation'])
    egal(b.filter((x) => x.ariaLabel === a).length, 2, `« ${a} » sur chaque recommandation`);
  egal(b.filter((x) => x.texte === 'Analyser mes decks' && x.desactive && x.title === 'Importe ton compte pour analyser').length, 2, '« Analyser mes decks » désactivé sans compte, et pourquoi');
}
