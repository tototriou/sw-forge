// Tests de rendu — l'interrupteur « Attaque conjointe » de la modale des
// dégâts réels (DamageSetupCard.tsx, rangée « Effets actifs »).
//
// Spec : docs/02-app/optimizer/ecran/objectif-de-recherche.md, « Effets
// actifs » ; docs/02-app/degats-reels/feat-attaques-conjointes.md.
//
// La vignette se lit par la porte `contexteAttaqueConjointe` : présente pour
// un S1 non conjoint par lui-même, absente pour un sort à effet `Ally Attack`
// et pour un S2. Le geste n'est pas simulable au rendu serveur : le clic est
// contrôlé sur la source, comme pour Tempest.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import DamageSetupCard from '../../src/components/outils/DamageSetupCard';
import { DEFAULT_DAMAGE_SETUP, monsterDamageSkills, resolveDamageSkill, type DamageSetup } from '../../src/lib/damage';
import { loadMonsterSkills } from '../../scripts/lib/skillsData';
import { egal, ok, titre } from '../outils';
import { rendre, texteVisible } from './outils-rendu';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const CASSIE = 19315;
const CROSS_FIRE = 10125; // S1 ordinaire
const DEFEAT_WILD_DOG = 10130; // S2 ordinaire
const MONSTRE_TEAM_UP = 11001; // porte le S2 Team Up 2006 (effet Ally Attack)
const TEAM_UP = 2006;

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

function verifier(etroit: boolean) {
  const format = etroit ? 'téléphone' : 'ordinateur';
  const s1 = carte(CASSIE, CROSS_FIRE, etroit);
  ok(vignette(s1, 'inactif'), `${format} : S1 ordinaire — la vignette « Attaque conjointe » est là, éteinte`);
  ok(texteVisible(s1).includes('Attaque conjointe'), `${format} : … et son libellé est lisible`);
  ok(s1.includes('(209 et 225)') && s1.includes('hors du tour du monstre'), `${format} : sa description dit ce qu’elle suppose (infobulle « ? » et survol)`);
  egal(s1.split('Attaque conjointe — ').length - 1, 1, `${format} : une seule vignette`);
  ok(vignette(carte(CASSIE, CROSS_FIRE, etroit, { attaqueConjointe: true }), 'actif'), `${format} : allumée quand attaqueConjointe vaut true`);
  ok(!carte(CASSIE, DEFEAT_WILD_DOG, etroit).includes('Attaque conjointe'), `${format} : S2 ordinaire — absente`);
  ok(!carte(MONSTRE_TEAM_UP, TEAM_UP, etroit).includes('Attaque conjointe'), `${format} : sort Ally Attack (Team Up) — absente`);
  ok(!carte(MONSTRE_TEAM_UP, TEAM_UP, etroit, { attaqueConjointe: true }).includes('Attaque conjointe'), `${format} : sort Ally Attack, réglage resté allumé — absente`);
}

export function testRenduAttaqueConjointeEcran() {
  titre('rendu · attaque conjointe — la vignette des effets actifs (ordinateur)');
  verifier(false);
  titre('rendu · attaque conjointe — la vignette des effets actifs (téléphone)');
  verifier(true);

  titre('rendu · attaque conjointe — le clic écrit attaqueConjointe (source)');
  const source = readFileSync(resolve(racine, 'src/components/outils/DamageSetupCard.tsx'), 'utf8').replace(/\r\n/g, '\n');
  ok(source.includes('basculer: () => maj({ attaqueConjointe: !(setup.attaqueConjointe ?? false) })'), 'le clic bascule `attaqueConjointe` par `maj`');
  ok(
    source.includes("contexteAttaqueConjointe(resolved, { attaqueConjointe: true }, 'sort-choisi') === 'appelee-par-allie'"),
    'la condition est lue par la porte, pas par une copie de la règle'
  );
}
