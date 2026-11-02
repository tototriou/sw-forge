// Tests de rendu — le scénario des poses entre les coups dans la fenêtre des
// dégâts réels (DamageSetupCard.tsx), aux deux formats.
//
// Spec : docs/02-app/degats-reels/feat-conditions-et-audit.md (« Poses entre
// les coups »).
//
// Un effet posé par un seul coup se règle par un interrupteur « Posé au
// coup N » ; un effet posé par plusieurs coups, par un sélecteur limité à eux
// (jamais un coup qui ne pose rien) ; un sort sans pose possible n'affiche pas
// la section. Le calcul de chaque réglage : tests/degats-effets-entre-coups.test.ts.

import DamageSetupCard from '../../src/components/outils/DamageSetupCard';
import { DEFAULT_DAMAGE_SETUP, monsterDamageSkills, resolveDamageSkill, type DamageSetup } from '../../src/lib/damage';
import { loadMonsterSkills } from '../../scripts/lib/skillsData';
import { egal, ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';

const CICHLID = 19613; // Crushed Hopes 10413 : Réduction de DEF au coup 2
const RYU_TENEBRES = 24015; // PPK Combo 13915 : Réduction de DEF aux coups 4 et 5
const CRUSHING_ROCKS = { monstre: 12811, sort: 4006 }; // Tigresse : chaque coup, 4 coups
const MEGUMI = 30515; // Domain Expansion 20215 : Réduction de DEF au dernier coup
const TANJIRO = 31811; // Whirlpool 21311 : Gel au coup 1, deux coups en plus
const VENDHAN = 28312; // Wild Bolt 18127 : Marque en état Thunderer
const SCARLETT = 22912; // Fatal Mortar Bullet 13312 : séquence, Marque au coup 1
const SHAINA = 21912; // Crescent Moon Slash 12602 : Réduction de DEF de Precision (passif)

const SECTION = 'Prendre en compte les débuffs posés entre les coups';

function carte(monstre: number, skillCom2usId: number, etroit: boolean, setup: Partial<DamageSetup> = {}): string {
  const sorts = monsterDamageSkills(loadMonsterSkills(monstre));
  const resolved = resolveDamageSkill(sorts, skillCom2usId);
  ok(resolved?.skillCom2usId === skillCom2usId, `témoin : le sort ${skillCom2usId} est bien celui de la fiche ${monstre}`);
  const damageSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId, ...setup };
  return rendre(
    <DamageSetupCard
      skills={sorts}
      resolved={resolved}
      passifs={[]}
      modificateursVit={[]}
      setup={damageSetup}
      setSetup={() => {}}
      chargement={false}
      etroit={etroit}
      critSiPlusRapide={false}
      bonusDegatsSelonVit={null}
      bonusDegatsStack={null}
      critRateSelonVit={null}
      bonusDegatsConditionnel={null}
      bonusParEffetCibleMonstre={null}
      bonusParEffetPropre={null}
      bonusSacrifice={null}
      conditionsCombatMonstre={[]}
      combatStats={[]}
      seuilsPassifEivor={null}
      elementAttaquant={null}
      critInterdit={false}
    />
  );
}

const actif = (skillCom2usId: number, apresCoup: Record<string, number | null> = {}): Partial<DamageSetup> => ({
  scenariosEffetsEntreCoups: { [skillCom2usId]: { actif: true, apresCoup } },
});
// Les options du sélecteur d'un effet, dans l'ordre.
const options = (html: string, libelle: string) => {
  const i = html.indexOf(`aria-label="Moment de pose réussie : ${libelle}"`);
  if (i < 0) return null;
  return [...html.slice(i, html.indexOf('</select>', i)).matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]);
};

function verifier(etroit: boolean) {
  const format = etroit ? 'téléphone' : 'ordinateur';

  // Un seul coup pose : un interrupteur, éteint puis allumé.
  const cichlid = carte(CICHLID, 10413, etroit, actif(10413));
  ok(texteVisible(cichlid).includes(SECTION), `${format} : Crushed Hopes — la section est là`);
  ok(texteVisible(cichlid).includes('Posé au coup 2'), `${format} : Crushed Hopes — « Posé au coup 2 » (prose : le second coup)`);
  egal(options(cichlid, 'Réduction de DEF'), null, `${format} : Crushed Hopes — aucun sélecteur de coup`);
  ok(/aria-checked="false"[^>]*>(?:(?!<\/button>).)*Posé au coup 2/.test(cichlid), `${format} : Crushed Hopes — éteint sans pose`);
  ok(/aria-checked="true"[^>]*>(?:(?!<\/button>).)*Posé au coup 2/.test(carte(CICHLID, 10413, etroit, actif(10413, { 'decrease-def': 2 }))),
    `${format} : Crushed Hopes — allumé quand la pose du coup 2 est choisie`);

  // Plusieurs coups posent : un sélecteur limité à eux.
  egal(options(carte(RYU_TENEBRES, 13915, etroit, actif(13915)), 'Réduction de DEF'), ['Aucune réussite', 'Après le coup 4', 'Après le coup 5'],
    `${format} : PPK Combo — seuls les coups 4 et 5 sont proposés`);
  egal(options(carte(CRUSHING_ROCKS.monstre, CRUSHING_ROCKS.sort, etroit, actif(CRUSHING_ROCKS.sort)), 'Réduction de DEF'),
    ['Aucune réussite', 'Après le coup 1', 'Après le coup 2', 'Après le coup 3'], `${format} : Crushing Rocks — chaque coup avant le dernier`);

  // Rien à poser entre les coups : pas de section.
  ok(!texteVisible(carte(MEGUMI, 20215, etroit, actif(20215))).includes(SECTION), `${format} : Domain Expansion — effet du dernier coup, pas de section`);

  // Un seul coup de base, le Gel du coup 1 crée les suivants.
  const tanjiro = carte(TANJIRO, 21311, etroit, actif(21311));
  ok(texteVisible(tanjiro).includes(SECTION) && texteVisible(tanjiro).includes('Gel') && texteVisible(tanjiro).includes('Posé au coup 1'),
    `${format} : Whirlpool — le Gel du coup 1 est proposé`);

  // Séquence curée : la Marque du coup 1 de Fatal Mortar Bullet.
  const scarlett = texteVisible(carte(SCARLETT, 13312, etroit, actif(13312)));
  ok(scarlett.includes(SECTION) && scarlett.includes('Marque') && scarlett.includes('Posé au coup 1'),
    `${format} : Fatal Mortar Bullet — la Marque du coup 1 est proposée`);
  // Effet posé par un passif : le libellé le nomme.
  ok(texteVisible(carte(SHAINA, 12602, etroit, actif(12602))).includes('Réduction de DEF (par Precision)'),
    `${format} : Crescent Moon Slash — « Réduction de DEF (par Precision) »`);

  // La condition de la pose suit le libellé.
  ok(texteVisible(carte(VENDHAN, 18127, etroit, actif(18127))).includes('Marque (en état Thunderer)'), `${format} : Wild Bolt — « Marque (en état Thunderer) »`);
}

export function testRenduEffetsEntreCoupsEcran() {
  titre('rendu · poses entre les coups — interrupteur ou sélecteur (ordinateur)');
  verifier(false);
  titre('rendu · poses entre les coups — interrupteur ou sélecteur (téléphone)');
  verifier(true);
}
