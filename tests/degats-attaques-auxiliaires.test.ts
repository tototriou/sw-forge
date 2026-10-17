// Attaques chiffrées par une compétence auxiliaire, hors du sort lui-même :
// - attaques supplémentaires conditionnelles après un sort
//   (`ATTAQUES_AUXILIAIRES_PAR_DECLENCHEUR`) : Jackie, Minato, Ren, Ritsu ;
// - passifs qui frappent hors du tour, choisis seuls (Psamathe, Hollyberry
//   Cookie, Manon).
//
// Ce qui serait GRAVE ET INVISIBLE : l'attaque comptée sans que l'interrupteur
// soit allumé (le défaut doit rester le sort seul), comptée après un autre sort
// que son déclencheur, ou une riposte qui s'ajouterait au total d'un sort.
// Ratios relevés dans l'API (auxiliaires), écrits à la main.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetailMonstre } from '../src/lib/monsterSkills';
import type { StatRow } from '../src/lib/stats';
import type { StatKey } from '../src/lib/effects';
import {
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  type SkillDamageProfile,
  computeSkillDamageDetail,
  computeTotalDamage,
  defenseFactor,
  estPrisEnCharge,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifPeutSuivre,
} from '../src/lib/damage';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(racine, 'public/data/skills', `${com2usId}.json`), 'utf8'));
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const ATQ = 2000;
const DEF = 1500;

function sortDe(detail: DetailMonstre, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(detail).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou refusé`);
  return p;
}

// [monstre, forme, déclencheur, slot, auxiliaire, ratio, skillups %, libellé]
const DECLENCHEES: [string, number, number, number, number, number, number, string][] = [
  ['Jackie', 20215, 11015, 3, 11016, 7.4, 20, 'Exploding Hands — attaque en plus'],
  ['Minato', 25911, 15706, 2, 15716, 4.5, 25, 'Shadow of Right Arm — attaque en Menace'],
  ['Ren', 25912, 15707, 2, 15717, 4.5, 25, 'Shadow of Right Arm — attaque en Menace'],
  ['Ritsu', 25915, 15710, 2, 15720, 4.5, 25, 'Shadow of Right Arm — attaque en Menace'],
];

// [monstre, forme, passif, formule, zone, skillups %]
const HORS_TOUR: [string, number, number, string, boolean, number][] = [
  ['Psamathe', 21111, 11911, '6.0*{ATK}', true, 30],
  ['Hollyberry Cookie', 26411, 16211, '3.5*{DEF}', false, 25],
  ['Manon', 26911, 16711, '3.5*{DEF}', false, 25],
];

export default function testDegatsAttaquesAuxiliaires() {
  const st = stats({ atk: ATQ, def: DEF, hp: 20000 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 100_000_000, enemyHpPct: 100, critMode: 'normal' };
  const df = defenseFactor(1000);

  for (const [monstre, forme, declencheur, slot, aux, ratio, skillup, libelle] of DECLENCHEES) {
    titre(`Attaque auxiliaire — ${monstre} (${forme}) : ${libelle}, après le S${slot} seul, sur interrupteur`);
    const detail = fiche(forme);
    const passifs = monsterOffensivePassives(detail);
    const p = passifs.find((x) => x.skillCom2usId === aux);
    ok(p !== undefined, `${forme} : l’attaque de l’auxiliaire ${aux} est proposée`);
    if (!p) continue;
    egal(
      { nom: p.nom, slots: p.slotsDeclencheurs, type: p.categorie.type, formule: p.profile.formule, hits: p.profile.hits, skillup: p.profile.skillupDamagePct },
      { nom: libelle, slots: [slot], type: 'conditionnel', formule: `${ratio}*{ATK}`, hits: 1, skillup },
      `${forme} : ${ratio} × ATQ, un coup, +${skillup} %, après le S${slot}, interrupteur`,
    );
    const sort = sortDe(detail, declencheur);
    const seul = computeSkillDamageDetail(sort, st, base, AUCUNE_AURA_PROPRE, null).total;
    const eteint = computeTotalDamage(sort, passifs, st, { ...base, skillCom2usId: declencheur }, AUCUNE_AURA_PROPRE, null);
    const allume = computeTotalDamage(sort, passifs, st, { ...base, skillCom2usId: declencheur, passifsOffensifs: { [aux]: true } }, AUCUNE_AURA_PROPRE, null);
    ok(proche(eteint, seul), `${forme} : interrupteur éteint (défaut) = le sort seul`);
    const attendu = ATQ * ratio * (1 + skillup / 100) * df;
    ok(proche(allume - seul, attendu), `${forme} : allumé, + ${ratio} × ATQ × ${1 + skillup / 100} × FacteurDéf = ${attendu.toFixed(2)}`);
    for (const autre of monsterDamageSkills(detail)) {
      if (!estPrisEnCharge(autre) || autre.skillCom2usId === declencheur) continue;
      ok(!passifPeutSuivre(p, autre), `${forme} : ne suit pas ${autre.nom} (S${autre.slot})`);
    }
  }

  for (const [monstre, forme, passif, formule, zone, skillup] of HORS_TOUR) {
    titre(`Passif hors tour — ${monstre} (${forme}) : choisi seul, jamais après un sort`);
    const detail = fiche(forme);
    const sort = sortDe(detail, passif);
    egal({ formule: sort.formule, zone: sort.aoe, passif: sort.passif, skillup: sort.skillupDamagePct },
      { formule, zone, passif: true, skillup }, `${forme} : ${formule}, ${zone ? 'zone' : 'mono-cible'}, +${skillup} %, proposé comme sort`);
    const p = monsterOffensivePassives(detail).find((x) => x.skillCom2usId === passif)!;
    for (const autre of monsterDamageSkills(detail)) {
      if (!estPrisEnCharge(autre) || autre.skillCom2usId === passif) continue;
      ok(!passifPeutSuivre(p, autre), `${forme} : ne s’ajoute jamais à ${autre.nom} (S${autre.slot})`);
    }
    const defaut = monsterDamageSkills(detail).filter((s) => estPrisEnCharge(s) && !s.passif);
    ok(defaut.length === 0 || !defaut.some((s) => s.skillCom2usId === passif), `${forme} : jamais parmi les sorts actifs`);
  }
}
