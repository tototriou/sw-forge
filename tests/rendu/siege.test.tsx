// Tests de rendu — Siège · Défense et Offense (`SiegeBoard`). Principe dans
// tests/rendu/outils-rendu.tsx : on vérifie que chaque fonctionnalité et chaque
// information sont présentes, jamais l'apparence. Écrits sur l'écran AVANT la
// refonte (`spec/chantiers/refonte-graphique.md`) : ils doivent rester verts
// après.

import SiegeBoard from '../../src/components/siege/SiegeBoard';
import SiegeTeam from '../../src/components/siege/SiegeTeam';
import { useSiegeState, SiegeSide } from '../../src/hooks/useSiegeState';
import type { Monster } from '../../src/types';
import { egal, faussLocalStorage, monstersJson, ok, titre } from '../outils';
import { bouton, boutons, rendre, texteVisible, valeurs } from './outils-rendu';

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
    [`swblacksmith-siege-${side}-v1`]: JSON.stringify({
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

// L'ÉDITION d'une équipe (vue dépliée). ⚠️ Écrit PENDANT le lot 7a, après le
// resserrement de l'édition — les tests d'avant ne couvraient que la vue
// compacte. Il fixe ce que chaque slot doit garder : le choix d'un monstre,
// le retrait, la vitesse et sa base, le champ SPD, les ticks, l'écart au tick
// et la position.
export function testRenduSiegeEdition() {
  titre('rendu · Siège — une équipe en édition garde tous ses contrôles');
  faussLocalStorage();
  const team = {
    ...equipe([['Lushen', 'wind'], ['Veromos', 'dark'], ['', '']], [120, 130, null], 24),
    slots: equipe([['Lushen', 'wind'], ['Veromos', 'dark'], ['', '']], [120, 130, null], 24).slots.map((s, i) =>
      i === 0 ? { ...s, tick: 239 } : s
    ),
  };
  const monsterById = new Map(MONSTRES.map((m) => [String(m.id), m]));
  const rien = () => {};
  const html = rendre(
    <SiegeTeam
      team={team}
      index={0}
      monsters={MONSTRES}
      monsterById={monsterById}
      expanded
      onToggleExpand={rien}
      onRemoveTeam={rien}
      onPickMonster={rien}
      onClearSlot={rien}
      onSlotRune={rien}
      onSlotTick={rien}
      checkTicks={false}
      onDismissAlert={rien}
      onVoirSpeedTune={rien}
      onSwap={rien}
    />
  );
  const t = texteVisible(html);

  ok(!!bouton(html, "Terminer l'édition"), 'le bouton « Terminer l\'édition »');
  ok(valeurs(html, 'placeholder').includes('Choisir un monstre…'), 'le slot vide propose « Choisir un monstre… »');
  egal(boutons(html).filter((b) => b.ariaLabel === 'Retirer' || b.title === 'Retirer').length, 2, 'chaque monstre posé a sa croix « Retirer »');
  egal(valeurs(html, 'aria-label').filter((v) => v === 'SPD des runes').length, 2, 'chaque monstre posé a son champ « SPD des runes »');
  egal((t.match(/base \d+/g) ?? []).length, 2, 'chaque monstre posé affiche sa vitesse de base');
  egal(boutons(html).filter((b) => b.texte === 'Off').length, 2, 'chaque monstre posé a sa rangée de ticks (« Off » + les ticks)');
  ok(/manque \d+ pour 239|\+\d+ au-dessus de 239|pile au tick 239/.test(t), 'le monstre visant 239 affiche son écart au tick');
  ok(valeurs(html, 'title').filter((v) => v === 'Changer la position (intervertir les monstres)').length >= 2, 'chaque monstre posé a son sélecteur « Position »');
  ok(t.includes('1 · Leader'), 'la position « 1 · Leader » est proposée');

  // À la souris, les flèches ← → (demandées par Thomas, lot 7a). Aux bords,
  // affichées mais désactivées, et l'infobulle dit pourquoi.
  // Recliquer sur le tick visé l'enlève (demandé par Thomas) : l'infobulle
  // du tick actif le dit, celle des autres propose de le viser.
  ok(valeurs(html, 'title').includes('Ne plus viser le tick 239'), 'le tick visé (239) se désactive d\'un reclic — son infobulle le dit');
  ok(valeurs(html, 'title').includes('Viser le tick 286'), 'un tick non visé propose « Viser le tick 286 »');

  const premier = bouton(html, 'Déjà en première position');
  ok(!!premier && premier.desactive, 'slot 1 : « ← » désactivé — « Déjà en première position »');
  ok(!!bouton(html, 'Déplacer à gauche (devient le leader)'), 'slot 2 : « ← » annonce qu\'il devient le leader');
  ok(!!bouton(html, 'Déplacer à droite (le monstre suivant devient le leader)'), 'slot 1 : « → » annonce que le suivant devient le leader');
}

// Lot 7a de la refonte : l'en-tête bureau. Ajouté APRÈS les tests ci-dessus,
// dont aucune assertion n'a changé.
export function testRenduSiegeEnTete() {
  titre('rendu · Siège — l\'en-tête bureau et son menu « ⋯ »');
  for (const [side, nom] of [['defense', 'Défense'], ['offense', 'Offense']] as const) {
    const html = rendreCamp(side);
    ok(texteVisible(html).includes(`${nom} 2 équipes`), `${nom} : le titre, puis le compteur`);
    ok(!!bouton(html, "Plus d'actions"), `${nom} : bouton « Plus d'actions »`);
    const menu = html.match(/<div[^>]*role="menu"[\s\S]*?<\/div><\/div>/)?.[0] ?? '';
    // (Décision 14 : « Exporter » et « Importer » s'ajoutent en tête du menu.)
    egal(boutons(menu).map((b) => b.texte), ['Exporter', 'Importer', 'Créer un monstre', 'Tout effacer'], `${nom} : le menu porte Exporter, Importer, Créer un monstre, puis Tout effacer`);
    const exp = boutons(menu).find((b) => b.texte === 'Exporter');
    ok(!!exp && !exp.desactive && (exp.title ?? '').includes('.json'), `${nom} : « Exporter » actif, son infobulle parle du fichier .json`);
    ok((boutons(menu).find((b) => b.texte === 'Importer')?.title ?? '').includes('ne sont pas touchées'), `${nom} : « Importer » dit que les équipes existantes ne sont pas touchées`);
    ok(/aria-label="Chercher une équipe par monstre"/.test(html) && /placeholder="Nom du monstre…"/.test(html), `${nom} : le champ de recherche « Nom du monstre… »`);
    const hors = boutons(html.replace(menu, ''));
    ok(hors.some((b) => b.texte === 'Ajouter une équipe') && hors.some((b) => b.texte === 'Vérifier mes speed'), `${nom} : « Ajouter une équipe » et « Vérifier mes speed » restent visibles`);
  }
}
