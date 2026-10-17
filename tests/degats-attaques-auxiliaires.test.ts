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
  defaultDamageSkill,
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

// [monstre, forme, déclencheur, slots accompagnés, avant le sort, auxiliaire, ratio, skillups %, libellé]
// Minato, Ren, Ritsu : avant le S1 ou le S2, et le S3 pour Ren (utilisateur, 2026-10-17).
const DECLENCHEES: [string, number, number, number[], boolean, number, number, number, string][] = [
  ['Jackie', 20215, 11015, [3], false, 11016, 7.4, 20, 'Exploding Hands — attaque en plus'],
  ['Minato', 25911, 15706, [1, 2], true, 15716, 4.5, 25, 'Shadow of Right Arm — attaque en Menace'],
  ['Ren', 25912, 15707, [1, 2, 3], true, 15717, 4.5, 25, 'Shadow of Right Arm — attaque en Menace'],
  ['Ritsu', 25915, 15710, [1, 2], true, 15720, 4.5, 25, 'Shadow of Right Arm — attaque en Menace'],
  ['Theonia', 34215, 23510, [2], false, 23517, 3.3, 25, 'Guilty Sentence — attaque sur la DEF la plus faible'],
  // Sans auxiliaire dans l'API : celle de Theonia, empruntée (utilisateur, 2026-10-17).
  ['Agrenia', 34212, 23507, [2], false, 23517, 3.3, 25, 'Guilty Sentence — attaque sur la DEF la plus faible'],
  ['Driana', 34213, 23508, [2], false, 23517, 3.3, 25, 'Guilty Sentence — attaque sur la DEF la plus faible'],
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

  for (const [monstre, forme, declencheur, slots, avant, aux, ratio, skillup, libelle] of DECLENCHEES) {
    const moment = `${avant ? 'avant' : 'après'} S${slots.join(', S')}`;
    titre(`Attaque auxiliaire — ${monstre} (${forme}) : ${libelle} (déclencheur ${declencheur}), ${moment}, sur interrupteur`);
    const detail = fiche(forme);
    const passifs = monsterOffensivePassives(detail);
    const p = passifs.find((x) => x.skillCom2usId === aux);
    ok(p !== undefined, `${forme} : l’attaque de l’auxiliaire ${aux} est proposée`);
    if (!p) continue;
    egal(
      { nom: p.nom, slots: p.slotsDeclencheurs, avant: p.avantLeSort ?? false, type: p.categorie.type, formule: p.profile.formule, hits: p.profile.hits, skillup: p.profile.skillupDamagePct },
      { nom: libelle, slots, avant, type: 'conditionnel', formule: `${ratio}*{ATK}`, hits: 1, skillup },
      `${forme} : ${ratio} × ATQ, un coup, +${skillup} %, ${moment}, interrupteur`,
    );
    const attendu = ATQ * ratio * (1 + skillup / 100) * df;
    for (const sort of monsterDamageSkills(detail)) {
      if (!estPrisEnCharge(sort) || sort.passif) continue;
      const seul = computeSkillDamageDetail(sort, st, base, AUCUNE_AURA_PROPRE, null).total;
      const eteint = computeTotalDamage(sort, passifs, st, { ...base, skillCom2usId: sort.skillCom2usId }, AUCUNE_AURA_PROPRE, null);
      const allume = computeTotalDamage(sort, passifs, st, { ...base, skillCom2usId: sort.skillCom2usId, passifsOffensifs: { [aux]: true } }, AUCUNE_AURA_PROPRE, null);
      if (slots.includes(sort.slot)) {
        ok(proche(eteint, seul), `${forme}, ${sort.nom} (S${sort.slot}) : interrupteur éteint (défaut) = le sort seul`);
        ok(proche(allume - seul, attendu), `${forme}, ${sort.nom} (S${sort.slot}) : allumé, + ${ratio} × ATQ × ${1 + skillup / 100} × FacteurDéf = ${attendu.toFixed(2)}`);
      } else {
        ok(!passifPeutSuivre(p, sort), `${forme} : n’accompagne pas ${sort.nom} (S${sort.slot})`);
      }
    }
  }

  titre('Attaque auxiliaire — avant le sort, elle ne profite pas de la réduction de Défense qu’il pose');
  {
    // Shadow of Right Arm (Minato, S2) pose « Decrease DEF » : une attaque qui le
    // SUIT la subirait, celle en Menace le PRÉCÈDE.
    const detail = fiche(25911);
    const passifs = monsterOffensivePassives(detail);
    const s2 = sortDe(detail, 15706);
    ok(s2.appliqueDefBreak, 'précondition : le S2 de Minato pose une réduction de Défense');
    const reglage = { ...base, skillCom2usId: 15706, defBreakParLeSort: true, passifsOffensifs: { 15716: true } };
    const seul = computeSkillDamageDetail(s2, st, { ...base, defBreakParLeSort: true }, AUCUNE_AURA_PROPRE, null).total;
    const total = computeTotalDamage(s2, passifs, st, reglage, AUCUNE_AURA_PROPRE, null);
    ok(proche(total - seul, ATQ * 4.5 * 1.25 * df), 'attaque en Menace : DEF pleine (1 000), la réduction posée par le S2 n’est pas encore là');
  }

  titre('Mode auxiliaire — Unlimited Power (Liam, 25711) : 4 ennemis ou plus dans la fiche, 3 ou moins à part');
  {
    // Valeurs de l'utilisateur (2026-10-17) : 6 coups à 1,5 × ATQ, ignore DEF
    // linéaire de 0 % à pleine vie à 100 % à 70 % de PV perdus.
    const detail = fiche(25711);
    const sorts = monsterDamageSkills(detail).filter(estPrisEnCharge);
    const fiche4 = sorts.find((s) => s.skillCom2usId === 15511)!;
    const mode3 = sorts.find((s) => s.skillCom2usId === 15516);
    egal({ hits: fiche4.hits, aoe: fiche4.aoe, ignoreDef: fiche4.ignoreDef }, { hits: 1, aoe: true, ignoreDef: false },
      '4 ennemis ou plus : un coup sur tous les ennemis, sans ignore DEF');
    ok(mode3 !== undefined, '3 ennemis ou moins : proposé comme un sort de plus');
    if (mode3) {
      egal(
        { nom: mode3.nom, slot: mode3.slot, formule: mode3.formule, hits: mode3.hits, aoe: mode3.aoe, ignoreDef: mode3.ignoreDef, regle: mode3.ignoreDefSelonPvCiblePerdus },
        { nom: 'Unlimited Power — 3 ennemis ou moins', slot: 3, formule: '1.5*{ATK}', hits: 6, aoe: false, ignoreDef: false, regle: { pvPerdusPourTout: 70 } },
        '3 ennemis ou moins : 6 coups à 1,5 × ATQ sur une cible, ignore DEF selon les PV perdus',
      );
      const k = 1 + mode3.skillupDamagePct / 100;
      // Référence écrite à la main : chaque coup lit les PV que les précédents
      // ont laissés, et en déduit sa part de DEF ignorée.
      const reference = (pvMax: number, pvPct: number) => {
        let pv = (pvPct / 100) * pvMax;
        let total = 0;
        for (let i = 0; i < 6; i++) {
          const ignoree = Math.min(1, Math.max(0, (100 - (pv / pvMax) * 100) / 70));
          const coup = 1.5 * ATQ * k * defenseFactor(1000 * (1 - ignoree));
          total += coup;
          pv = Math.max(0, pv - coup);
        }
        return total;
      };
      const pour = (pvMax: number, pv: number) =>
        computeSkillDamageDetail(mode3, st, { ...base, enemyHp: pvMax, enemyHpPct: pv }, AUCUNE_AURA_PROPRE, null).total;
      ok(proche(pour(100_000_000, 100), reference(100_000_000, 100)), 'PV pleins, cible immense : presque aucune DEF ignorée');
      ok(Math.abs(pour(100_000_000, 100) / (6 * 1.5 * ATQ * k * df) - 1) < 1e-3, 'PV pleins, cible immense : à 0,1 % près, la DEF entière');
      ok(proche(pour(100_000_000, 65), reference(100_000_000, 65)), '35 % de PV perdus : environ la moitié de la DEF ignorée');
      ok(proche(pour(100_000_000, 30), 6 * 1.5 * ATQ * k * defenseFactor(0)), '70 % de PV perdus : toute la DEF ignorée, à chaque coup');
      ok(proche(pour(100_000_000, 10), pour(100_000_000, 30)), 'au-delà de 70 % perdus : toujours toute la DEF');
      // Cible de 40 000 PV : les coups creusent assez pour que l'ignore DEF grandisse d'un coup à l'autre.
      ok(proche(pour(40_000, 100), reference(40_000, 100)), '40 000 PV : l’ignore DEF est recalculé à chaque coup');
      ok(pour(40_000, 100) > 6 * 1.5 * ATQ * k * df,
        '40 000 PV : plus de dégâts que six coups à DEF pleine');
      ok(pour(40_000, 50) > pour(40_000, 100), 'moins de PV restants au départ : plus de dégâts');
    }
    egal(defaultDamageSkill(sorts)?.skillCom2usId, 15511, 'le sort par défaut reste celui de la fiche');
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
