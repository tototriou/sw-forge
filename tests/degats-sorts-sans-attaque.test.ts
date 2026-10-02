// Sorts sans attaque masqués de « Compétence utilisée » (degats-et-aura 15c,
// `SORTS_SANS_ATTAQUE_PAR_ID`, damage.ts).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un bouclier proposé — et même
// retenu par défaut — comme sort de dégâts. Avant ce lot, Frieren, Gandalf,
// Old Wood et une dizaine d'autres classaient leurs builds sur la valeur de
// leur bouclier (`2.8*{ATK}`, `0.2*{MAX HP}`…), un nombre plausible que rien
// ne signalait. Une entrée curée n'est protégée que par son test (skill
// game-data-curation § 8) : chaque identifiant a ici son témoin réel, et la
// liste attendue est écrite À PART de la table, pour qu'un retrait se voie.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { DetailMonstre } from '../src/lib/monsterSkills';
import {
  SORTS_SANS_ATTAQUE_PAR_ID,
  defaultDamageSkill,
  estPrisEnCharge,
  monsterDamageSkills,
  monsterOffensivePassives,
  skillDamageProfile,
} from '../src/lib/damage';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(forme: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${forme}.json`), 'utf8'));
}

// Identifiant du sort → forme jouable témoin (prose citée dans la table et
// dans la preuve `controle-15c.md`). Écrite à la main, jamais dérivée de la
// table : c'est ce qui fait échouer le test quand une ligne disparaît.
const ATTENDUS: [number, number, string][] = [
  [1412, 10412, "Ancestors' Blessing (Tantra)"],
  [2813, 11903, 'Force Field (Sylphid vent, forme non jouable)'],
  [2818, 11913, 'Force Field (Acasis)'],
  [7414, 16214, 'Trade (Conrad)'],
  [10406, 19611, 'Air Shield (Tetra)'],
  [10408, 19613, 'Air Shield (Cichlid)'],
  [10409, 19614, 'Air Shield (Molly)'],
  [10914, 20114, 'Neostone Field (Illianna)'],
  [11311, 20511, "Oasis's Blessing (Bastet)"],
  [11813, 21013, "Deer's Song (Raviti)"],
  [12115, 21315, 'Destiny Dice (Monte)'],
  [12512, 21812, 'Cry of Threat (Ophilia)'],
  [13111, 22611, 'Forbidden Galdr (Bolverk)'],
  [15607, 25812, 'Beneficial Hammering (Miriam)'],
  [15608, 25813, 'Beneficial Hammering (Celine)'],
  [15609, 25814, 'Beneficial Hammering (Madeleine)'],
  [16213, 26413, 'Cries of Unity (Hollyberry Cookie)'],
  [16713, 26913, 'Sweet Shout (Jade)'],
  [21111, 31411, 'Lamplight in Darkness (Mork)'],
  [23706, 34411, "Guardian's Barrier (Gandalf eau)"],
  [23708, 34413, "Guardian's Barrier (Gandalf vent)"],
  [23709, 34414, "Guardian's Barrier (Gandalf lumière)"],
  [24206, 35011, 'Floral Barrier (Old Wood eau)'],
  [24208, 35013, 'Floral Barrier (Old Wood vent)'],
  [24209, 35014, 'Floral Barrier (Old Wood lumière)'],
  [24909, 35714, 'Spell to Create a Field of Flowers (Frieren)'],
  [10243000, 1000214, 'Protection Field (Homunculus support lumière)'],
  [10253000, 1000215, 'Protection Field (Homunculus support ténèbres)'],
];

// Toutes les formes du corpus, lues une fois.
function corpus(): DetailMonstre[] {
  return readdirSync(DOSSIER_SORTS)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8')) as DetailMonstre);
}

export default function testDegatsSortsSansAttaque() {
  const toutes = corpus();

  titre('Sorts sans attaque — chaque identifiant de la table est masqué');

  egal(SORTS_SANS_ATTAQUE_PAR_ID.size, ATTENDUS.length, 'la table compte exactement les identifiants attendus');
  for (const [id, temoin, libelle] of ATTENDUS) {
    ok(SORTS_SANS_ATTAQUE_PAR_ID.has(id), `${id} ${libelle} : dans la table`);
    const c = fiche(temoin).competences.find((x) => x.com2usId === id);
    ok(!!c && !c.passif && !!c.formule, `${id} ${libelle} : sort actif à formule sur la forme ${temoin}`);
    if (c) egal(skillDamageProfile(c), null, `${id} ${libelle} : aucun profil (ni proposé, ni refusé)`);
    // Toutes les formes qui portent le sort, jouables ou non : l'identifiant
    // est partagé, le masquage aussi.
    const porteuses = toutes.filter((d) => d.competences.some((x) => x.com2usId === id));
    ok(porteuses.length > 0, `${id} ${libelle} : porté par au moins une forme`);
    ok(porteuses.every((d) => monsterDamageSkills(d).every((s) => s.skillCom2usId !== id)),
      `${id} ${libelle} : absent de « Compétence utilisée » sur ${porteuses.length} forme(s)`);
  }

  titre('Sorts sans attaque — la table ne contient que des identifiants du corpus');

  const idsDuCorpus = new Set(toutes.flatMap((d) => d.competences.map((c) => c.com2usId)));
  for (const id of SORTS_SANS_ATTAQUE_PAR_ID) {
    ok(idsDuCorpus.has(id), `${id} : identifiant présent dans public/data/skills`);
  }

  titre('Sorts sans attaque — un sort voisin qui attaque reste proposé');

  // Frieren : avant le lot, son bouclier S2 était proposé ET retenu par défaut
  // (calculé à 1 426 sur 35714, preuve 13b-hors-tour-cooperation).
  const frieren = monsterDamageSkills(fiche(35714));
  const s1Frieren = frieren.find((s) => s.skillCom2usId === 24904);
  ok(!!s1Frieren && estPrisEnCharge(s1Frieren), 'Frieren : Ordinary Offensive Magic (24904, S1) reste proposé');
  egal(defaultDamageSkill(frieren)?.skillCom2usId, 24904, 'Frieren : le sort par défaut devient le S1, plus le bouclier');
  const bolverk = monsterDamageSkills(fiche(22611));
  const s1Bolverk = bolverk.find((s) => s.skillCom2usId === 13101);
  ok(!!s1Bolverk && estPrisEnCharge(s1Bolverk), 'Bolverk : Lightning Strike (13101, S1) reste proposé');
  const gandalf = monsterDamageSkills(fiche(34411));
  ok(gandalf.some((s) => estPrisEnCharge(s) && s.skillCom2usId !== 23706), 'Gandalf eau : un sort qui frappe reste proposé');
  for (const [, temoin, libelle] of ATTENDUS) {
    ok(monsterDamageSkills(fiche(temoin)).some((s) => estPrisEnCharge(s)),
      `${libelle} (${temoin}) : il reste au moins un sort calculable`);
  }

  titre('Sorts sans attaque — un passif de la table n’est jamais offensif');

  // Aucun passif dans la table aujourd'hui : la garde se vérifie sur Teshar,
  // dont Tempest (3213) est un passif offensif curé, rebaptisé d'un
  // identifiant de la table. ⚠️ Sa fiche porte `formule: ""` (Tempest
  // n'existe que par `FORMULES_CUREES_PAR_ID[3213]`) : rebaptisé, il perdrait
  // sa formule et sortirait de lui-même, sans la garde. D'où sa formule
  // recopiée (`3.7*{ATK}`, A.2 ter) et le témoin juste dessous, qui prouve
  // que le maquillage SANS identifiant de la table reste offensif.
  const teshar = fiche(14513);
  ok(monsterOffensivePassives(teshar).some((p) => p.skillCom2usId === 3213), 'Teshar : Tempest est un passif offensif (témoin)');
  const maquiller = (id: number): DetailMonstre => ({
    ...teshar,
    competences: teshar.competences.map((c) => (c.com2usId === 3213 ? { ...c, com2usId: id, formule: '3.7*{ATK}' } : c)),
  });
  ok(monsterOffensivePassives(maquiller(99999999)).some((p) => p.skillCom2usId === 99999999),
    'témoin : Tempest rebaptisé d’un identifiant hors table reste offensif');
  ok(monsterOffensivePassives(maquiller(24909)).every((p) => p.skillCom2usId !== 24909),
    'un passif dont l’identifiant est dans la table n’est jamais offensif');

  titre('Sorts sans attaque — candidats laissés hors table');

  // Passifs de Pure Vanilla et Angela : la prose dit « deals damage equal to
  // 50% of the damage dealt to the shield to the attacker » — des dégâts,
  // donc pas un sort sans attaque ; leur `formule` est pourtant le bouclier.
  // Ils ne sont pas des passifs offensifs aujourd'hui (aucune entrée curée).
  for (const [id, forme] of [[16113, 26313], [16613, 26813]] as const) {
    ok(!SORTS_SANS_ATTAQUE_PAR_ID.has(id), `${id} : hors table (la prose décrit une riposte)`);
    ok(monsterOffensivePassives(fiche(forme)).every((p) => p.skillCom2usId !== id), `${id} : pas un passif offensif`);
  }
  // Effets de PV sans coup (A.2 ter) sans formule : déjà hors calcul.
  for (const [id, forme, libelle] of [[12212, 21412, 'Harmonia S3'], [12215, 21415, 'Vivachel S3']] as const) {
    const c = fiche(forme).competences.find((x) => x.com2usId === id)!;
    ok(!c.formule, `${libelle} (${id}) : formule vide`);
    ok(monsterDamageSkills(fiche(forme)).every((s) => s.skillCom2usId !== id), `${libelle} (${id}) : déjà absent de la liste`);
  }
  ok(monsterOffensivePassives(fiche(31213)).every((p) => p.skillCom2usId !== 20913), 'Aya vent (20913, passif sans formule) : déjà hors calcul');
}
