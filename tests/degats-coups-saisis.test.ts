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
  coupsAffichesDuSort,
  coupsEnPlusAncienneRecetteActif,
  estPrisEnCharge,
  monsterDamageSkills,
  resolvedHits,
  statsDeCombat,
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
  // Lot P5a2 : le coup en plus est DÉDUIT de l'ATQ adverse, la saisie n'existe plus
  // (voir `testDegatsCoupsSousCondition`, plus bas) : seules la plage et le défaut se lisent ici.
  sansSaisie?: boolean;
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
  { nom: 'Brutal Fists', id: 18301, formes: [28511], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL, sansSaisie: true },
  { nom: 'Brutal Fists', id: 18302, formes: [28512], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL, sansSaisie: true },
  { nom: 'Brutal Fists', id: 18303, formes: [28513], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL, sansSaisie: true },
  { nom: 'Brutal Fists', id: 18304, formes: [28514], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL, sansSaisie: true },
  { nom: 'Brutal Fists', id: 18305, formes: [28515], plage: { min: 3, max: 4 }, cle: 'nom « Brutal Fists »', citation: BRUTAL, sansSaisie: true },
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
        if (e.sansSaisie) continue;
        // La saisie est bornée à la plage. Pour un sort réglé par interrupteur (lot
        // P5a2), c'est la LECTURE D'UNE ANCIENNE RECETTE : elle doit rester celle d'avant.
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

  testDegatsCoupsSousCondition();
}

// ───────────────────────────────────────────────────────────────────────────
// Lot P5a2 — un coup en plus qui ne dépend que d'une CONDITION se règle par un
// interrupteur (éteint par défaut = le minimum), pas par un compteur. Décision de
// l'utilisateur du 2026-10-04 (règle « seuil → interrupteur », A.2 ter D06).
// Brutal Fists : le coup en plus est DÉDUIT du champ « ATQ adverse » (ATQ du build
// strictement supérieure), comme Theonia — aucun réglage neuf. Barrage of Madness et
// Sura's Seal restent des compteurs. Les attendus (bornes, libellés) sont écrits à
// la main, jamais relus dans le code qui calcule.
// ⚠️ GRAVE ET INVISIBLE ici : un interrupteur allumé par défaut (surestimation) ; un
// interrupteur sans effet ; une ancienne recette dont le nombre de coups saisi serait
// ignoré ; le Whirlpool de Seal qui hériterait des coups en plus de celui de Tanjiro.
// ───────────────────────────────────────────────────────────────────────────

interface EntreeInterrupteur {
  nom: string;
  id: number;
  forme: number;
  min: number;
  extra: number;
  // Libellé de l'interrupteur — par la question du joueur.
  libelle: string;
  // `true` : l'interrupteur est celui de « la cible porte un effet nocif » (Brise DEF et
  // Marque l'allument aussi) ; sinon un interrupteur manuel.
  effetNocif?: boolean;
}

const Q_NOCIF = 'La cible porte un effet nocif';
const Q_AUCUN_NOCIF = 'La cible ne porte aucun effet nocif';
const Q_POUND = 'L’état des PV de la cible est pire que le tien, ou elle porte un effet nocif';

const INTERRUPTEURS: EntreeInterrupteur[] = [
  { nom: 'Whirlpool', id: 21311, forme: 31811, min: 1, extra: 2, libelle: Q_NOCIF, effetNocif: true },
  { nom: 'Water Dragon Surge', id: 21911, forme: 32511, min: 1, extra: 2, libelle: Q_NOCIF, effetNocif: true },
  { nom: 'Hammer Punch', id: 11651, forme: 20831, min: 2, extra: 1, libelle: Q_AUCUN_NOCIF },
  { nom: 'Hammer Punch', id: 11652, forme: 20832, min: 2, extra: 1, libelle: Q_AUCUN_NOCIF },
  { nom: 'Hammer Punch', id: 11653, forme: 20833, min: 2, extra: 1, libelle: Q_AUCUN_NOCIF },
  { nom: 'Hammer Punch', id: 11654, forme: 20834, min: 2, extra: 1, libelle: Q_AUCUN_NOCIF },
  { nom: 'Hammer Punch', id: 11655, forme: 20835, min: 2, extra: 1, libelle: Q_AUCUN_NOCIF },
  { nom: 'Pound', id: 11664, forme: 20834, min: 4, extra: 2, libelle: Q_POUND },
  { nom: 'Strafe', id: 11716, forme: 20911, min: 2, extra: 1, libelle: 'Le tir en plus part' },
  { nom: 'Strafe', id: 11717, forme: 20912, min: 2, extra: 1, libelle: 'Le tir en plus part' },
  { nom: 'Strafe', id: 11703, forme: 20913, min: 2, extra: 1, libelle: 'Le tir en plus part' },
  { nom: 'Strafe', id: 11704, forme: 20914, min: 2, extra: 1, libelle: 'Le tir en plus part' },
  { nom: 'Strafe', id: 11720, forme: 20915, min: 2, extra: 1, libelle: 'Le tir en plus part' },
  { nom: "God's Weapon", id: 18308, forme: 28513, min: 2, extra: 1, libelle: 'Le coup en plus part' },
  { nom: "God's Weapon", id: 18310, forme: 28515, min: 2, extra: 1, libelle: 'Le coup en plus part' },
];

const BRUTAL_FISTS: [number, number][] = [[18301, 28511], [18302, 28512], [18303, 28513], [18304, 28514], [18305, 28515]];

function testDegatsCoupsSousCondition() {
  const st = stats({ atk: 1000, def: 800, hp: 20000, spd: 200, cr: 25, cd: 100 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 0, enemyHp: 1_000_000, enemyHpPct: 100, critMode: 'normal', summonerSkills: 'combat' };
  const calcul = (p: SkillDamageProfile, s: DamageSetup, stat = st) => computeSkillDamage(p, stat, s, AUCUNE_AURA_PROPRE);
  const unCoup = (p: SkillDamageProfile, s: DamageSetup, stat = st) => calcul({ ...p, hits: 1, hitsRange: undefined }, s, stat);

  for (const e of INTERRUPTEURS) {
    titre(`Lot P5a2 — ${e.nom} (${e.id}) : interrupteur « ${e.libelle} », +${e.extra} coup(s)`);
    const p = sortDe(e.forme, e.id);
    const max = e.min + e.extra;
    const regle = (p.conditionsCombat ?? []).filter((c) => c.coupsEnPlus);
    egal(regle.length, 1, `${e.id} : une seule condition de coups en plus`);
    egal(regle[0]?.coupsEnPlus, e.extra, `${e.id} : +${e.extra} coup(s) quand la condition est remplie`);
    egal(regle[0]?.type, e.effetNocif ? 'debuffCiblePresent' : 'manuel', `${e.id} : l'interrupteur existant (${e.effetNocif ? 'effet nocif sur la cible' : 'manuel'})`);
    if (!e.effetNocif) {
      egal(regle[0]?.type === 'manuel' ? regle[0].libelle : null, e.libelle, `${e.id} : libellé par la question du joueur`);
    }
    egal(p.hitsRange, { min: e.min, max }, `${e.id} : bornes ${e.min} à ${max}, comme avant`);
    const parCoup = unCoup(p, base);
    // Éteint par défaut : le minimum.
    egal(resolvedHits(p, base), e.min, `${e.id} : éteint, ${e.min} coup(s)`);
    ok(proche(calcul(p, base), e.min * parCoup), `${e.id} : éteint, total = ${e.min} × un coup`);
    // Allumé : l'ancien maximum.
    const allume: DamageSetup = { ...base, passifsOffensifs: { [e.id]: true } };
    egal(resolvedHits(p, allume), max, `${e.id} : allumé, ${max} coup(s)`);
    ok(proche(calcul(p, allume), max * parCoup), `${e.id} : allumé, total = ${max} × un coup`);
    ok(proche(calcul(p, allume), calcul(p, { ...base, coupsPersonnalises: { [e.id]: max } })), `${e.id} : allumé = l'ancien maximum saisi`);
    // Un interrupteur d'un autre sort n'allume pas celui-ci.
    egal(resolvedHits(p, { ...base, passifsOffensifs: { [e.id + 1000000]: true } }), e.min, `${e.id} : l'interrupteur d'un autre sort est sans effet ici`);
    if (e.effetNocif) {
      egal(resolvedHits(p, { ...base, defBreak: true }), max, `${e.id} : Brise DEF sur la cible allume l'interrupteur (effet nocif présent)`);
      egal(resolvedHits(p, { ...base, brand: true }), max, `${e.id} : Marque sur la cible allume l'interrupteur`);
    }
    // Ancienne recette : le nombre de coups saisi reste lu, borné à la plage…
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: max } }), max, `${e.id} : ancienne recette à ${max} coup(s), lue telle quelle`);
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: max + 50 } }), max, `${e.id} : ancienne recette hors plage, bornée à ${max}`);
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: e.min } }), e.min, `${e.id} : ancienne recette au minimum, ${e.min}`);
    ok(coupsEnPlusAncienneRecetteActif(p, { ...base, coupsPersonnalises: { [e.id]: max } }), `${e.id} : l'ancienne recette à ${max} s'affiche interrupteur allumé`);
    ok(!coupsEnPlusAncienneRecetteActif(p, base), `${e.id} : sans saisie, l'interrupteur s'affiche éteint`);
    // … jusqu'à ce que l'interrupteur soit touché, dans un sens ou l'autre.
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: max }, passifsOffensifs: { [e.id]: false } }), e.min, `${e.id} : interrupteur éteint à la main, il prévaut sur l'ancienne saisie`);
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [e.id]: e.min }, passifsOffensifs: { [e.id]: true } }), max, `${e.id} : interrupteur allumé à la main, il prévaut sur l'ancienne saisie`);
  }

  titre('Lot P5a2 — Pound : une ancienne recette à 5 coups reste à 5 (jamais arrondie)');
  egal(resolvedHits(sortDe(20834, 11664), { ...base, coupsPersonnalises: { 11664: 5 } }), 5, 'Pound : 5 coups saisis avant le lot, 5 coups après');

  titre('Lot P5a2 — Whirlpool de Seal (3463) : aucun interrupteur, aucun coup en plus');
  {
    const p = sortDe(12133, 3463);
    egal([p.hitsRange, p.conditionsCombat, p.hits], [undefined, undefined, 1], 'Whirlpool 3463 : ni plage ni condition, un coup');
    egal(resolvedHits(p, { ...base, passifsOffensifs: { 3463: true } }), 1, 'Whirlpool 3463 : l\'interrupteur de Tanjiro ne l\'atteint pas');
  }

  const stat = (atk: number) => stats({ atk, def: 800, hp: 20000, spd: 200, cr: 25, cd: 100 });
  for (const [id, forme] of BRUTAL_FISTS) {
    titre(`Lot P5a2 — Brutal Fists (${id}) : +1 coup si l'ATQ du build dépasse l'ATQ adverse, sans réglage neuf`);
    const p = sortDe(forme, id);
    egal(p.conditionsCombat?.map((c) => [c.type, (c as { ratio?: number }).ratio, c.coupsEnPlus]), [['atkCibleSousAtkPropre', 1, 1]], `${id} : la condition de Theonia (ATQ adverse < ATQ du build, ratio 1), +1 coup`);
    egal(p.hitsRange, { min: 3, max: 4 }, `${id} : bornes 3 à 4, comme avant`);
    // Total pour un build d'ATQ `atk`, une ATQ adverse (absente = ancienne recette) et une ancienne saisie.
    const total = (atk: number, enemyAtk: number | undefined, coups?: number) =>
      calcul(p, { ...base, enemyAtk, ...(coups == null ? {} : { coupsPersonnalises: { [id]: coups } }) }, stat(atk));
    const parCoupA = (atk: number, enemyAtk: number) => unCoup(p, { ...base, enemyAtk }, stat(atk));
    ok(proche(total(1000, 500), 4 * parCoupA(1000, 500)), `${id} : ATQ du build 1 000, adverse 500 : 4 coups`);
    ok(proche(total(1000, 999), 4 * parCoupA(1000, 999)), `${id} : ATQ du build 1 000, adverse 999 : 4 coups`);
    ok(proche(total(1000, 1000), 3 * parCoupA(1000, 1000)), `${id} : ATQ du build 1 000, adverse 1 000 : STRICT, 3 coups`);
    ok(proche(total(1000, 1500), 3 * parCoupA(1000, 1500)), `${id} : ATQ du build 1 000, adverse 1 500 : 3 coups`);
    ok(proche(total(1000, undefined), 3 * parCoupA(1000, 1000)), `${id} : ancienne recette sans ATQ adverse : la valeur affichée (1 000), 3 coups`);
    ok(proche(total(2000, 1500), 4 * parCoupA(2000, 1500)), `${id} : le build compte — ATQ 2 000 contre 1 500 : 4 coups`);
    ok(proche(total(900, 1000), 3 * parCoupA(900, 1000)), `${id} : le build compte — ATQ 900 contre 1 000 : 3 coups`);
    // Une ancienne saisie ne s'applique plus : la déduction prévaut.
    ok(proche(total(1000, 1500, 4), 3 * parCoupA(1000, 1500)), `${id} : ancienne saisie à 4 ignorée, la déduction (adverse 1 500) donne 3`);
    ok(proche(total(1000, 500, 3), 4 * parCoupA(1000, 500)), `${id} : ancienne saisie à 3 ignorée, la déduction (adverse 500) donne 4`);
    // Aucun interrupteur : la clé du sort n'y change rien.
    ok(proche(calcul(p, { ...base, enemyAtk: 1500, passifsOffensifs: { [id]: true } }), 3 * parCoupA(1000, 1500)), `${id} : aucun interrupteur ne force le coup en plus`);
  }

  titre('Lot P5a3 — l\'affichage lit le même nombre de coups que le calcul (fonction partagée)');
  for (const [id, forme] of BRUTAL_FISTS) {
    const p = sortDe(forme, id);
    for (const [enemyAtk, attendu] of [[500, 4], [999, 4], [1000, 3], [1500, 3]] as const) {
      const s = { ...base, enemyAtk };
      const combat = statsDeCombat(stat(1000), s, AUCUNE_AURA_PROPRE);
      const avec = coupsAffichesDuSort(p, s, combat);
      egal([avec.hits, avec.max, avec.dependDuBuild], [attendu, attendu, false], `${id} : avec le build (ATQ 1 000, adverse ${enemyAtk}), l'affichage annonce ${attendu}`);
      ok(proche(calcul(p, s, stat(1000)), avec.hits * unCoup(p, s, stat(1000))), `${id} : adverse ${enemyAtk}, le total du calcul vaut le nombre annoncé (${attendu}) × un coup`);
      // Sans build (résumé de l'écran, ligne du CLI) : la plage, jamais un minimum présenté comme le nombre du calcul.
      const sans = coupsAffichesDuSort(p, s);
      egal([sans.hits, sans.max, sans.dependDuBuild], [3, 4, true], `${id} : sans build, l'affichage annonce 3 à 4 (selon l'ATQ du build), adverse ${enemyAtk}`);
    }
  }
  titre('Lot P5a3 — le résumé de l\'écran et la ligne du CLI passent par la fonction partagée');
  {
    const ecran = readFileSync(resolve(racine, 'src/components/outils/DamageSetupCard.tsx'), 'utf8');
    const cli = readFileSync(resolve(racine, 'scripts/optimizer-search.ts'), 'utf8');
    ok(ecran.includes('const affiches = coupsAffichesDuSort(p, setup);'), 'écran : resumeSort lit le nombre de coups par coupsAffichesDuSort');
    ok(cli.includes('const coupsAffiches = coupsAffichesDuSort(profile, s);'), 'CLI : la ligne du sort lit le nombre de coups par coupsAffichesDuSort');
    ok(!/const hits = hitsOverride \?\? resolvedHits\(/.test(ecran), 'écran : plus de lecture directe de resolvedHits dans le résumé');
  }
  titre('Lot P5a3 — les autres sorts : l\'affichage n\'a pas changé');
  for (const [id, forme] of [[11664, 20834], [21311, 31811]] as const) {
    const p = sortDe(forme, id);
    const sans = coupsAffichesDuSort(p, base);
    egal([sans.hits, sans.max, sans.dependDuBuild], [resolvedHits(p, base), resolvedHits(p, base), false], `${id} : un interrupteur, pas une plage selon le build : le minimum, comme avant`);
  }

  titre('Lot P5a2 — Barrage of Madness et Sura\'s Seal : toujours des compteurs, inchangés');
  for (const [nom, id, forme, min, max] of [['Barrage of Madness', 18313, 28513, 3, 5], ["Sura's Seal", 18312, 28512, 4, 8]] as const) {
    const p = sortDe(forme, id);
    egal([p.conditionsCombat, p.hitsRange, p.hits], [undefined, { min, max }, min], `${nom} : aucune condition, plage ${min} à ${max}`);
    egal(resolvedHits(p, { ...base, passifsOffensifs: { [id]: true } }), min, `${nom} : un interrupteur n'y change rien`);
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [id]: max } }), max, `${nom} : la saisie du compteur vaut ${max}`);
    egal(resolvedHits(p, { ...base, coupsPersonnalises: { [id]: max + 50 } }), max, `${nom} : saisie hors plage, bornée à ${max}`);
  }
}
