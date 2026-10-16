// Tests de rendu — l'interrupteur « Attaque conjointe » de la modale des
// dégâts réels (DamageSetupCard.tsx, rangée « Effets actifs »).
//
// Spec : docs/02-app/optimizer/ecran/objectif-de-recherche.md, « Effets
// actifs » ; docs/02-app/degats-reels/feat-attaques-conjointes.md.
//
// La vignette se lit par `interrupteurAttaqueConjointe` : présente, éteinte
// par défaut, pour un S1 non conjoint par lui-même ; présente et allumée par
// défaut sur une attaque des familles coopératives ; absente pour un sort à
// effet `Ally Attack` et pour un S2 ordinaire. La seconde vignette « Pendant le
// tour d'un allié » se lit par `vignettePendantTourAllie` : sur un S1 des
// familles seulement, interrupteur allumé. Le geste n'est pas simulable au
// rendu serveur : le clic est contrôlé sur la source, comme pour Tempest.

import DamageSetupCard from '../../src/components/outils/DamageSetupCard';
import { DEFAULT_DAMAGE_SETUP, monsterDamageSkills, resolveDamageSkill, type DamageSetup } from '../../src/lib/damage';
import { loadMonsterSkills } from '../../scripts/lib/skillsData';
import { egal, ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';


const CASSIE = 19315;
const CROSS_FIRE = 10125; // S1 ordinaire
const DEFEAT_WILD_DOG = 10130; // S2 ordinaire
const MONSTRE_TEAM_UP = 11001; // porte le S2 Team Up 2006 (effet Ally Attack)
const TEAM_UP = 2006;
// Sabrina (Boomerang Warrior eau), Triple Strike : une attaque d'une famille
// coopérative. Nezuko (31915) et Vermilion Bird Dancer (32615), ténèbres :
// Purification, Cooperation! et Rite of Ashes, conjoints par leur formule curée.
const SABRINA = 22011;
const TRIPLE_STRIKE = 12706;
const RETURNING_BOOMERANG = 12701; // son S1
const NEZUKO = 31915;
const PURIFICATION = 21415;
const VERMILION = 32615;
const RITE_OF_ASHES = 22015;

function carte(monstre: number, skillCom2usId: number, etroit: boolean, setup: Partial<DamageSetup> = {}): string {
  const sorts = monsterDamageSkills(loadMonsterSkills(monstre));
  const resolved = resolveDamageSkill(sorts, skillCom2usId);
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

const vignette = (html: string, etat: 'actif' | 'inactif') => html.includes(`aria-label="Attaque conjointe — ${etat}"`);
// Le survol de la vignette : la même source que l'infobulle « ? » (`effetsActifs`).
const survol = (html: string) => html.match(/aria-label="Attaque conjointe — (?:actif|inactif)"[^>]*? title="([^"]*)"/)?.[1] ?? '';
// La seconde vignette des S1 des familles, « Pendant le tour d'un allié ».
const seconde = (html: string, etat: 'actif' | 'inactif') => html.includes(`aria-label="Pendant le tour d’un allié — ${etat}"`);
// Le bouton d'une vignette, de son nom accessible à sa fermeture : son icône est dedans.
const bouton = (html: string, libelle: string) => {
  const i = html.indexOf(`aria-label="${libelle} — `);
  return i < 0 ? '' : html.slice(i, html.indexOf('</button>', i));
};
const survolSeconde = (html: string) => html.match(/aria-label="Pendant le tour d’un allié — (?:actif|inactif)"[^>]*? title="([^"]*)"/)?.[1] ?? '';

function verifier(etroit: boolean) {
  const format = etroit ? 'téléphone' : 'ordinateur';
  const s1 = carte(CASSIE, CROSS_FIRE, etroit);
  ok(vignette(s1, 'inactif'), `${format} : S1 ordinaire — la vignette « Attaque conjointe » est là, éteinte par défaut`);
  ok(texteVisible(s1).includes('Attaque conjointe'), `${format} : … et son libellé est lisible`);
  ok(survol(s1).includes('appelé par un allié') && survol(s1).includes('hors du tour du monstre'), `${format} : sa description dit ce qu’elle suppose`);
  egal(s1.split('Attaque conjointe — ').length - 1, 1, `${format} : une seule vignette`);
  ok(vignette(carte(CASSIE, CROSS_FIRE, etroit, { attaqueConjointe: true }), 'actif'), `${format} : allumée quand attaqueConjointe vaut true`);
  ok(!carte(CASSIE, DEFEAT_WILD_DOG, etroit).includes('Attaque conjointe'), `${format} : S2 ordinaire — absente`);
  ok(!carte(MONSTRE_TEAM_UP, TEAM_UP, etroit).includes('Attaque conjointe'), `${format} : sort Ally Attack (Team Up) — absente`);
  ok(!carte(MONSTRE_TEAM_UP, TEAM_UP, etroit, { attaqueConjointe: true }).includes('Attaque conjointe'), `${format} : sort Ally Attack, réglage resté allumé — absente`);

  // Familles coopératives : proposée sur l'attaque, allumée par défaut.
  const famille = carte(SABRINA, TRIPLE_STRIKE, etroit);
  ok(vignette(famille, 'actif'), `${format} : Triple Strike (Boomerang Warrior) — la vignette est là, allumée par défaut`);
  ok(survol(famille).includes('Un monstre de l’autre famille est au combat'), `${format} : … sa description dit pourquoi l’attaque est conjointe`);
  ok(vignette(carte(SABRINA, TRIPLE_STRIKE, etroit, { attaqueConjointe: false }), 'inactif'), `${format} : … éteinte quand attaqueConjointe vaut false`);
  ok(vignette(carte(SABRINA, TRIPLE_STRIKE, etroit, { attaqueConjointe: true }), 'actif'), `${format} : … allumée quand attaqueConjointe vaut true`);

  // D21 : aucun numéro d'artéfact dans les descriptions ; D20 : l'icône de Team Up.
  for (const [nom, html] of [['S1 ordinaire', s1], ['famille', famille]] as const) {
    ok(survol(html) !== '' && !/209|224|225/.test(survol(html)), `${format} : ${nom} — aucun numéro d’artéfact dans la description`);
    ok(html.includes('skill_icon_0001_6_3.png'), `${format} : ${nom} — l’icône de Team Up de Raoq éveillé`);
  }

  // Seconde vignette « Pendant le tour d'un allié » des S1 des familles
  // (décision de l'utilisateur, 2026-10-16) : par `vignettePendantTourAllie`.
  const s1Famille = carte(SABRINA, RETURNING_BOOMERANG, etroit);
  ok(vignette(s1Famille, 'actif') && seconde(s1Famille, 'inactif'),
    `${format} : Returning Boomerang (S1 de famille), interrupteur au défaut — « Pendant le tour d’un allié » est là, éteinte par défaut`);
  ok(texteVisible(s1Famille).includes('Pendant le tour d’un allié'), `${format} : … et son libellé est lisible`);
  const posPremiere = s1Famille.indexOf('aria-label="Attaque conjointe — ');
  const posSeconde = s1Famille.indexOf('aria-label="Pendant le tour d’un allié — ');
  ok(posPremiere >= 0 && posSeconde > posPremiere && s1Famille.slice(posPremiere, posSeconde).split('aria-label="').length - 1 === 1,
    `${format} : … juste après « Attaque conjointe », sans vignette entre les deux`);
  egal(s1Famille.split('Pendant le tour d’un allié — ').length - 1, 1, `${format} : … une seule fois`);
  ok(bouton(s1Famille, 'Pendant le tour d’un allié').includes('skill_icon_0016_4_3.png') && !bouton(s1Famille, 'Pendant le tour d’un allié').includes('skill_icon_0001_6_3.png'),
    `${format} : … avec sa propre icône, celle de Crescent Moon Slash (S1 de Shaina, choix de l’utilisateur 2026-10-16)`);
  ok(bouton(s1Famille, 'Attaque conjointe').includes('skill_icon_0001_6_3.png') && !bouton(s1Famille, 'Attaque conjointe').includes('skill_icon_0016_4_3.png'),
    `${format} : … « Attaque conjointe » garde l’icône de Team Up de Raoq éveillé`);
  const description = survolSeconde(s1Famille);
  ok(description.includes('pendant le tour de l’allié') && description.includes('dégâts critiques sur cible unique pendant ton tour ne comptent pas'),
    `${format} : … sa description dit ce qu’elle suppose, en mots du jeu`);
  ok(description !== '' && !/\d/.test(description), `${format} : … aucun numéro (d’artéfact ou autre) dans sa description`);
  ok(seconde(carte(SABRINA, RETURNING_BOOMERANG, etroit, { pendantTourAllie: true }), 'actif'), `${format} : … allumée quand pendantTourAllie vaut true`);
  ok(vignette(carte(SABRINA, RETURNING_BOOMERANG, etroit, { pendantTourAllie: true }), 'actif'), `${format} : … « Attaque conjointe » reste allumée à côté`);
  for (const [nom, html] of [
    ['S1 de famille, interrupteur éteint', carte(SABRINA, RETURNING_BOOMERANG, etroit, { attaqueConjointe: false })],
    ['S1 de famille, interrupteur éteint, champ resté allumé', carte(SABRINA, RETURNING_BOOMERANG, etroit, { attaqueConjointe: false, pendantTourAllie: true })],
    ['S2 de famille (Triple Strike)', carte(SABRINA, TRIPLE_STRIKE, etroit)],
    ['S2 de famille, champ resté allumé', carte(SABRINA, TRIPLE_STRIKE, etroit, { pendantTourAllie: true })],
    ['S1 ordinaire allumé, champ resté allumé', carte(CASSIE, CROSS_FIRE, etroit, { attaqueConjointe: true, pendantTourAllie: true })],
  ] as const) {
    ok(!html.includes('Pendant le tour d’un allié'), `${format} : ${nom} — « Pendant le tour d’un allié » absente`);
  }

  // D17 : le ratio curé s'affiche dans la ligne du sort.
  ok(texteVisible(carte(NEZUKO, PURIFICATION, etroit)).includes('4.5 × ATQ'), `${format} : Nezuko, Purification, Cooperation! — le ratio 4.5 × ATQ est dans la ligne du sort`);
  ok(texteVisible(carte(VERMILION, RITE_OF_ASHES, etroit)).includes('4.5 × ATQ'), `${format} : Vermilion Bird Dancer, Rite of Ashes — le ratio 4.5 × ATQ est dans la ligne du sort`);
}

export function testRenduAttaqueConjointeEcran() {
  titre('rendu · attaque conjointe — la vignette des effets actifs (ordinateur)');
  verifier(false);
  titre('rendu · attaque conjointe — la vignette des effets actifs (téléphone)');
  verifier(true);
  // Le clic et la condition, lus sur la source : `testEffetsActifsInfobulle`
  // (tests/proses-sort.test.ts), qui lit déjà cette carte.
}
