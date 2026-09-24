// Tests de rendu — Siège · Défense et Offense (`SiegeBoard`). Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et chaque
// information sont présentes, jamais l'apparence. Écrits sur l'écran AVANT la
// refonte (`spec/chantiers/refonte-graphique.md`) : ils doivent rester verts
// après.

import SiegeBoard from '../../src/components/siege/SiegeBoard';
import { useSiegeState, SiegeSide } from '../../src/hooks/useSiegeState';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { bouton, boutons, rendre, texteVisible } from './outils-rendu';

const MONSTRES = monstersJson() as Monster[];
const id = (nom: string, el: string) =>
  String(MONSTRES.filter((m) => m.name === nom && m.element === el).sort((a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0))[0].id);

function Banc({ side }: { side: SiegeSide }) {
  const siege = useSiegeState(side);
  return (
    <SiegeBoard
      side={side}
      siege={siege}
      monsters={MONSTRES}
      siegeDefenseTeams={[]}
      siegeOffenseTeams={[]}
      loadState="live"
      onCreateMonster={() => MONSTRES[0]}
      customMonsters={[]}
      onDeleteMonster={() => {}}
      menuOuvert={false}
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

// Deux équipes : une complète avec lead, une avec un emplacement vide.
function rendreCamp(side: SiegeSide): string {
  faussLocalStorage({
    [`sw-forge-siege-${side}-v1`]: JSON.stringify({
      teams: [
        equipe([['Lushen', 'wind'], ['Veromos', 'dark'], ['Chasun', 'wind']], [120, 130, 140], 24),
        equipe([['Galleon', 'water'], ['Belladeon', 'light'], ['', '']], [110, null, null], 0),
      ],
    }),
  });
  return rendre(<Banc side={side} />);
}

function verifierCamp(side: SiegeSide) {
  const html = rendreCamp(side);
  const texte = texteVisible(html);

  // Actions de la page — toujours présentes (un bouton ne disparaît jamais).
  ok(!!bouton(html, 'Ajouter une équipe'), 'bouton « Ajouter une équipe »');
  const verifier = bouton(html, 'Vérifier mes speed');
  ok(!!verifier, 'bouton « Vérifier mes speed »');
  ok(!!verifier?.title?.includes('speed tune'), 'son infobulle explique ce qu\'il colore');
  const creer = bouton(html, 'Créer un monstre');
  ok(!!creer && !!creer.title, 'bouton « Créer un monstre », avec son infobulle');
  ok(!!bouton(html, 'Tout effacer'), 'bouton « Tout effacer »');
  ok(texte.includes('2 équipes'), 'compteur « 2 équipes »');

  // Chaque équipe : titre, actions, monstres avec leur vitesse, speed tune.
  ok(texte.includes('Équipe 1') && texte.includes('Équipe 2'), 'les deux équipes sont titrées');
  egal(boutons(html).filter((b) => b.ariaLabel === "Éditer l'équipe").length, 2, '« Éditer l\'équipe » sur chaque équipe');
  egal(boutons(html).filter((b) => b.ariaLabel === "Supprimer l'équipe").length, 2, '« Supprimer l\'équipe » sur chaque équipe');
  const speedTune = boutons(html).filter((b) => b.texte.includes('Voir le speed tune'));
  egal(speedTune.length, 2, '« Voir le speed tune » sur chaque équipe');
  ok(speedTune.every((b) => !!b.title), 'avec son infobulle');

  // Informations calculées : vitesse de combat, bonus du leader.
  for (const m of ['Lushen', 'Veromos', 'Chasun', 'Galleon', 'Belladeon']) {
    ok(boutons(html).some((b) => new RegExp(`^${m} \\d{3}$`).test(b.texte)), `${m} affiché avec sa vitesse de combat`);
  }
  ok(/\+\d+%/.test(texte), 'bonus de vitesse du leader affiché');
  ok(!!bouton(html, '+ vide'), 'un emplacement vide reste choisissable');
}

export function testRenduSiegeDefense() {
  titre('rendu · Siège · Défense — fonctionnalités présentes');
  verifierCamp('defense');
}

export function testRenduSiegeOffense() {
  titre('rendu · Siège · Offense — fonctionnalités présentes');
  verifierCamp('offense');
}
