// Nombres de coups variables, SAISIS — chantier degats-et-aura, lot P5a.
//
// Décisions de l'utilisateur : le nombre de coups variable est SAISI (borné à la
// plage) ; le défaut est le MINIMUM ; un coup supplémentaire vaut les autres
// coups (D30). Les bornes viennent de la prose du sort ou d'un champ de la fiche,
// jamais d'une dérivation depuis les stats : chaque borne attendue ci-dessous est
// écrite à la main, avec sa citation, et jamais relue dans le code qui calcule.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : une entrée par NOM qui s'étend à un
// homonyme JOUABLE d'une autre mécanique (le Whirlpool de Seal n'a aucun coup
// supplémentaire) ; un défaut au maximum (surestimation silencieuse) ; un coup
// supplémentaire qui ne vaudrait pas les autres (la formule est la même par coup,
// l'hypothèse « U1 » du contrôle 13b-coups-variables).

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { DetailMonstre } from '../src/lib/monsterSkills';
import {
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  type SkillDamageProfile,
  computeSkillDamage,
  estPrisEnCharge,
  monsterDamageSkills,
  resolvedHits,
} from '../src/lib/damage';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function sortDe(forme: number, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(fiche(forme)).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou refusé sur ${forme}`);
  return p;
}

// Une entrée : le sort (identifiant), ses formes porteuses (balayage du corpus,
// contrôle P5a), la plage ou le nombre fixe attendu, la citation, la clé de la
// curation et, pour une entrée par NOM, les homonymes couverts (même prose).
interface EntreeCoups {
  nom: string;
  id: number;
  formes: number[];
  plage?: { min: number; max: number };
  fixe?: number;
  cle: string;
  citation: string;
  // Homonymes d'un nom curé : [identifiant, forme]. Même plage attendue.
  homonymesCouverts?: [number, number][];
  // Homonymes d'une clé par IDENTIFIANT : autre mécanique, aucune plage.
  homonymesExclus?: [number, number][];
}

// Les cinq Strafe jouables : même prose pour les trois premiers mots, le reste
// de la prose (effets) diffère, jamais le nombre de coups.
const STRAFE = '« Rapidly fires 2 shots, and may fire an additional shot by chance » ; `coups: 2`, effet `Additional Attack`';
const STRAFE_HOMONYMES: [number, number][] = [[11701, 20901], [11702, 20902], [11705, 20905]];
const HAMMER = '« Attacks the enemy 2 times … If the target is not suffering any harmful effects, 1 additional attack is added » ; `coups: 2`';
const HAMMER_HOMONYMES: [number, number][] = [
  [11601, 20801], [11602, 20802], [11603, 20803], [11604, 20804], [11605, 20805], // Frankenstein 1A
  [11673, 48201], [11674, 48202], [11675, 48203], [11676, 48204], [11677, 48205], // boss
];
const BRUTAL = '« Attacks the enemy 3 times … In addition, you attack the enemy one more time if your Attack Power is higher than the enemy target » ; `coups: 4` = le maximum';
const GRINDING ='« Attacks all enemies 3 times … and attacks them once more » : 4 coups ; `coups: 3` en donnée';

const ENTREES: EntreeCoups[] = [
  { nom: 'Strafe', id: 11716, formes: [20911], plage: { min: 2, max: 3 }, cle: 'nom « Strafe »', citation: STRAFE, homonymesCouverts: STRAFE_HOMONYMES },
  { nom: 'Strafe', id: 11717, formes: [20912], plage: { min: 2, max: 3 }, cle: 'nom « Strafe »', citation: STRAFE },
  { nom: 'Strafe', id: 11703, formes: [20913, 20903], plage: { min: 2, max: 3 }, cle: 'nom « Strafe »', citation: STRAFE },
  { nom: 'Strafe', id: 11704, formes: [20914, 20904], plage: { min: 2, max: 3 }, cle: 'nom « Strafe »', citation: STRAFE },
  { nom: 'Strafe', id: 11720, formes: [20915], plage: { min: 2, max: 3 }, cle: 'nom « Strafe »', citation: STRAFE },
  {
    nom: "Sura's Seal", id: 18312, formes: [28512], plage: { min: 4, max: 8 }, cle: "nom « Sura's Seal »",
    citation: '« Attacks the enemy 4 times … The number of attacks increases up to 8 times according to the difference between the target and your Attack Power » ; `coups: 4`',
  },
  {
    nom: "God's Weapon", id: 18308, formes: [28513], plage: { min: 2, max: 3 }, cle: "nom « God's Weapon »",
    citation: '« Attacks all enemies 2 to 3 times »',
  },
  {
    nom: "God's Weapon", id: 18310, formes: [28515], plage: { min: 2, max: 3 }, cle: "nom « God's Weapon »",
    citation: '« Attacks all enemies 2 to 3 times »',
  },
  {
    nom: 'Barrage of Madness', id: 18313, formes: [28513], plage: { min: 3, max: 5 }, cle: 'nom « Barrage of Madness »',
    citation: '« Attacks all enemies 3 to 5 times … The more harmful effects granted on the target, the higher the chance of inflicting more number of attacks »',
  },
  { nom: 'Hammer Punch', id: 11651, formes: [20831], plage: { min: 2, max: 3 }, cle: 'nom « Hammer Punch »', citation: HAMMER, homonymesCouverts: HAMMER_HOMONYMES },
  { nom: 'Hammer Punch', id: 11652, formes: [20832], plage: { min: 2, max: 3 }, cle: 'nom « Hammer Punch »', citation: HAMMER },
  { nom: 'Hammer Punch', id: 11653, formes: [20833], plage: { min: 2, max: 3 }, cle: 'nom « Hammer Punch »', citation: HAMMER },
  { nom: 'Hammer Punch', id: 11654, formes: [20834], plage: { min: 2, max: 3 }, cle: 'nom « Hammer Punch »', citation: HAMMER },
  { nom: 'Hammer Punch', id: 11655, formes: [20835], plage: { min: 2, max: 3 }, cle: 'nom « Hammer Punch »', citation: HAMMER },
  {
    nom: 'Pound', id: 11664, formes: [20834], plage: { min: 4, max: 6 }, cle: 'nom « Pound »',
    citation: '« Attacks the enemy 4 times … 2 additional attacks are added if the enemy\'s HP condition is worse than yours or if the target is suffering a harmful effect » ; `coups: 4`',
    // Même plage, condition différente (11614 : PV max ET effet nocif) — non jouables.
    homonymesCouverts: [[11614, 20804], [11686, 48204]],
  },
  {
    nom: 'Water Dragon Surge', id: 21911, formes: [32511], plage: { min: 1, max: 3 }, cle: 'nom « Water Dragon Surge »',
    citation: '« Deals additional damage 2 more times to targets with harmful effects » (effet `Additional Attack`, `quantite: 2`) ; `coups: 1`',
  },
  { nom: 'Brutal Fists', id: 18301, formes: [28511], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL },
  { nom: 'Brutal Fists', id: 18302, formes: [28512], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL },
  { nom: 'Brutal Fists', id: 18303, formes: [28513], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL },
  { nom: 'Brutal Fists', id: 18304, formes: [28514], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL },
  { nom: 'Brutal Fists', id: 18305, formes: [28515], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL },
  { nom: 'Grinding', id: 16306, formes: [26511], fixe: 4, cle: 'nom « Grinding » (coups fixes corrigés)', citation: GRINDING },
  { nom: 'Grinding', id: 16308, formes: [26513], fixe: 4, cle: 'nom « Grinding » (coups fixes corrigés)', citation: GRINDING },
  { nom: 'Grinding', id: 16310, formes: [26515], fixe: 4, cle: 'nom « Grinding » (coups fixes corrigés)', citation: GRINDING },
  { nom: 'Spinning Tea Spoon', id: 16806, formes: [27011], fixe: 4, cle: 'nom « Spinning Tea Spoon » (coups fixes corrigés)', citation: GRINDING },
  { nom: 'Spinning Tea Spoon', id: 16808, formes: [27013], fixe: 4, cle: 'nom « Spinning Tea Spoon » (coups fixes corrigés)', citation: GRINDING },
  { nom: 'Spinning Tea Spoon', id: 16810, formes: [27015], fixe: 4, cle: 'nom « Spinning Tea Spoon » (coups fixes corrigés)', citation: GRINDING },
  {
    nom: 'Whirlpool', id: 21311, formes: [31811], plage: { min: 1, max: 3 }, cle: 'identifiant 21311',
    citation: '« Deals additional damage 2 more times to targets with harmful effects » (effet `Additional Attack`, `quantite: 2`) ; `coups: 1`',
    homonymesExclus: [[3463, 12133], [3413, 12113], [3478, 48303]],
  },
];

export function testDegatsCoupsSaisis() {
  const st = stats({ atk: 1000, def: 800, hp: 20000, spd: 200, cr: 25, cd: 100 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 0, enemyHp: 1_000_000, enemyHpPct: 100, critMode: 'normal', summonerSkills: 'combat' };
  const calcul = (p: SkillDamageProfile, n?: number) =>
    computeSkillDamage(p, st, n == null ? base : { ...base, coupsPersonnalises: { [p.skillCom2usId]: n } }, AUCUNE_AURA_PROPRE);

  for (const e of ENTREES) {
    titre(`Lot P5a — ${e.nom} (${e.id}) : clé ${e.cle}`);
    for (const forme of e.formes) {
      const p = sortDe(forme, e.id);
      if (e.plage) {
        const { min, max } = e.plage;
        egal(p.hitsRange, { min, max }, `${e.id} sur ${forme} : plage ${min} à ${max} coups — ${e.citation}`);
        egal(p.hits, min, `${e.id} sur ${forme} : défaut = MINIMUM (${min}), jamais le maximum`);
        egal(resolvedHits(p, base), min, `${e.id} sur ${forme} : sans saisie, ${min} coup(s) retenu(s)`);
        // La saisie est bornée à la plage.
        egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: max + 50 } }), max, `${e.id} sur ${forme} : une saisie au-dessus de la plage retombe sur ${max}`);
        egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: 0 } }), min, `${e.id} sur ${forme} : une saisie sous la plage retombe sur ${min}`);
        // Un coup supplémentaire vaut les autres (D30) : le total est proportionnel au nombre de coups.
        const parCoup = calcul(p, min) / min;
        for (let n = min; n <= max; n++) {
          ok(proche(calcul(p, n), n * parCoup), `${e.id} sur ${forme} : ${n} coup(s) = ${n} × un coup (chaque coup vaut les autres)`);
        }
      } else {
        egal(p.hitsRange, undefined, `${e.id} sur ${forme} : pas une plage`);
        egal(p.hits, e.fixe, `${e.id} sur ${forme} : ${e.fixe} coups fixes — ${e.citation}`);
        ok(proche(calcul(p), (e.fixe ?? 0) * calcul({ ...p, hits: 1 })), `${e.id} sur ${forme} : le total vaut ${e.fixe} × un coup (chaque coup vaut les autres)`);
      }
    }
    for (const [idHom, formeHom] of e.homonymesCouverts ?? []) {
      const p = sortDe(formeHom, idHom);
      egal(p.nom, e.nom, `homonyme ${idHom} sur ${formeHom} : même nom, même prose, couvert par la clé « ${e.cle} »`);
      egal(p.hitsRange ?? p.hits, e.plage ?? e.fixe, `homonyme ${idHom} sur ${formeHom} : même nombre de coups que ${e.id}`);
    }
    for (const [idHom, formeHom] of e.homonymesExclus ?? []) {
      const tous = monsterDamageSkills(fiche(formeHom));
      const p = tous.find((s) => s.skillCom2usId === idHom);
      ok(p == null || !estPrisEnCharge(p) || p.hitsRange == null, `homonyme ${idHom} sur ${formeHom} : aucune plage (autre mécanique, hors de la clé « ${e.cle} »)`);
      if (p && estPrisEnCharge(p)) egal(p.hits, 1, `homonyme ${idHom} sur ${formeHom} : un seul coup, comme avant`);
    }
  }

  // Témoins HORS PÉRIMÈTRE de P5a : ils restent comme avant, jusqu'à leur propre lot.
  titre('Lot P5a — témoins hors périmètre : Stormfist (valeur de l\'utilisateur attendue) et Crow Hunt (relevé R9)');
  const stormfist = sortDe(28511, 18306);
  egal([stormfist.hitsRange, stormfist.hits], [undefined, 3], 'Stormfist 18306 : ni plage ni correction, 3 coups comme avant (la règle selon l\'ATQ est à fournir)');
  for (const [id, forme] of [[1607, 10512], [1609, 10514], [1618, 10513]] as const) {
    const p = sortDe(forme, id);
    egal([p.hitsRange, p.hits], [undefined, id === 1618 ? 1 : 4], `Crow Hunt ${id} sur ${forme} : inchangé (${id === 1618 ? '`coups: 1`, relevé R9 attendu' : '`coups: 4`'})`);
  }
}
