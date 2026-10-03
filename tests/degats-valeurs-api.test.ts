// Valeurs connues par l'API SWARFARM seule — chantier degats-et-aura, lot P6.
//
// Règle D12 de l'utilisateur (2026-10-03) : la valeur de l'API par défaut,
// sauf si la prose du sort la contredit. Les valeurs testées ici viennent des
// « compétences auxiliaires » (`other_skill`) lues par l'audit des dégâts
// conditionnels du 2026-09-08, absentes de l'import du corpus : chaque nombre
// attendu est écrit à la main depuis ces valeurs, jamais relu dans le code
// qui calcule.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : la phase de zone d'un sort
// oubliée (Abigail calculée à 3,5 × ATQ au lieu de 3,5 + 4,5), une phase
// mono-cible comptée deux fois (Head Press à 2 × 4,0 au lieu de 4,0 + 5,2),
// ou une séquence refusée parce que la donnée décrit autre chose que son
// premier groupe (garde par empreinte, SZ-1).
//
// ⚠️ Hypothèse du calcul, NON confirmée pour ces sorts (contrairement à Blade
// Surge) : les skillups de la fiche s'appliquent aux deux phases. Les totaux
// ci-dessous la figent ; sur la phase 1 seule, Abigail et Emily vaudraient
// 8,875 au lieu de 10 (× ATQ × FacteurDéf), M. BISON et Sagar 9,8 au lieu de
// 10,58.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { ArtifactDetail } from '../src/types';
import {
  AUCUNE_AURA_PROPRE,
  ARTIFACT_DAMAGE_NEUTRE,
  DEFAULT_DAMAGE_SETUP,
  type ArtifactDamageProfile,
  type DamageSetup,
  type SkillDamageProfile,
  artifactDamageProfile,
  cibleDegatsRetenue,
  cibleSecondairePriseEnCharge,
  computeSkillDamageDetail,
  computeTotalDamage,
  defenseFactor,
  estPrisEnCharge,
  monsterDamageSkills,
  monsterOffensivePassives,
  resumeSequenceDeCoups,
  skillDamageProfile,
} from '../src/lib/damage';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

// Base nulle : ni compétence d'invocateur, ni lead ne touchent l'ATQ.
function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

function artefacts(subs: { code: number; value: number }[]): ArtifactDamageProfile {
  const a: ArtifactDetail = { id: 0, kind: 'archetype', archetype: 'attack', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs };
  return artifactDamageProfile([a]);
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function sortDe(forme: number, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(fiche(forme)).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou refusé sur ${forme}`);
  return p;
}

const ATQ = 2000;
const PV = 20000;

// SZ-2 : identifiant, formes porteuses (balayage du corpus, contrôle
// 13b-sequences-zone), donnée de la fiche (l'empreinte), coefficients des deux
// phases (fiche puis auxiliaire de l'API) et skillups « Damage » de la fiche.
const SEQUENCES: {
  id: number; nom: string; formes: number[]; monstre: string;
  donnee: { formule: string; coups: number; aoe: boolean };
  phase1: number; phase2: number; auxiliaire: number; skillup: number;
}[] = [
  { id: 13311, nom: 'Fatal Extinctive Bullet', formes: [22911], monstre: 'Abigail', donnee: { formule: '3.5*{ATK}', coups: 1, aoe: false }, phase1: 3.5, phase2: 4.5, auxiliaire: 2476, skillup: 25 },
  { id: 13314, nom: 'Fatal Armor Bullet', formes: [22914], monstre: 'Emily', donnee: { formule: '3.5*{ATK}', coups: 1, aoe: false }, phase1: 3.5, phase2: 4.5, auxiliaire: 2478, skillup: 25 },
  { id: 14113, nom: 'Head Press', formes: [24203, 24213], monstre: 'M. BISON', donnee: { formule: '4.0*{ATK}', coups: 2, aoe: false }, phase1: 4.0, phase2: 5.2, auxiliaire: 2762, skillup: 15 },
  { id: 14613, nom: 'Great Sword of the End', formes: [24703, 24713], monstre: 'Sagar', donnee: { formule: '4.0*{ATK}', coups: 2, aoe: true }, phase1: 4.0, phase2: 5.2, auxiliaire: 2830, skillup: 15 },
];

export function testDegatsSequencesApi() {
  const st = stats({ atk: ATQ, hp: PV, cr: 100, cd: 100 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 100_000_000, enemyHpPct: 100 };
  const df = defenseFactor(1000);
  const normal: DamageSetup = { ...base, critMode: 'normal' };
  const crit: DamageSetup = { ...base, critMode: 'crit' };
  // Critique forcé : 30 points de Dgts Crit valent `m × ATQ × 0,30 × FacteurDéf`
  // sur un coup de multiplicateur m (même mesure que le test Blade Surge).
  const sur = (m: number) => ATQ * m * 0.3 * df;
  const a224 = artefacts([{ code: 224, value: 30 }]);
  const a411 = artefacts([{ code: 411, value: 30 }]);

  for (const s of SEQUENCES) {
    titre(`Lot P6, SZ-2 — ${s.nom} (${s.id}, ${s.monstre}) : phase 1 de la fiche, phase de zone de l'auxiliaire ${s.auxiliaire} de l'API`);
    ok(cibleSecondairePriseEnCharge(s.id), `${s.id} : un coup de zone curé, le cran « autres ennemis » est permis`);
    const secondaire: DamageSetup = { ...normal, cibleDegatsParSort: { [s.id]: 'secondaire' } };
    const k = 1 + s.skillup / 100;
    for (const forme of s.formes) {
      const p = sortDe(forme, s.id);
      egal(
        { nom: p.nom, slot: p.slot, formule: p.formule, hits: p.hits, aoe: p.aoe, skillup: p.skillupDamagePct,
          sequence: p.sequenceDeCoups?.map((g) => ({ coups: g.coups, zone: g.zone, formule: g.formule })) },
        { nom: s.nom, slot: 3, formule: s.donnee.formule, hits: s.donnee.coups, aoe: s.donnee.aoe, skillup: s.skillup,
          sequence: [
            { coups: 1, zone: false, formule: s.donnee.formule },
            { coups: 1, zone: true, formule: `${s.phase2.toFixed(1)}*{ATK}` },
          ] },
        `${s.id} sur ${forme} : profil = donnée (empreinte ${JSON.stringify(s.donnee)}), séquence = ${s.phase1} × ATQ mono-cible puis ${s.phase2} × ATQ en zone`,
      );
      egal(resumeSequenceDeCoups(p.sequenceDeCoups ?? []), '1 coup · Cible unique, puis 1 coup · Zone', `${s.id} sur ${forme} : résumé de la séquence`);
      ok(!p.hitsRange && !p.effetsEntreCoups, `${s.id} sur ${forme} : ni coups variables ni effets entre coups (non modélisés pour une séquence)`);
      egal(monsterOffensivePassives(fiche(forme)).length, 0, `${forme} : aucun passif offensif`);

      const calcul = (x: DamageSetup, art: ArtifactDamageProfile = ARTIFACT_DAMAGE_NEUTRE) =>
        computeSkillDamageDetail(p, st, x, AUCUNE_AURA_PROPRE, null, undefined, art).total;
      const visee = ATQ * (s.phase1 + s.phase2) * k * df;
      const autres = ATQ * s.phase2 * k * df;
      ok(proche(calcul(normal), visee), `${s.id} sur ${forme}, cible visée : 2 000 × (${s.phase1} + ${s.phase2}) × ${k} × FacteurDéf = ${visee.toFixed(2)}`);
      ok(proche(calcul(secondaire), autres), `${s.id} sur ${forme}, autres ennemis : 2 000 × ${s.phase2} × ${k} × FacteurDéf = ${autres.toFixed(2)} (la phase de zone seule)`);
      egal(cibleDegatsRetenue(p, secondaire), 'secondaire', `${s.id} sur ${forme} : clé « secondaire » retenue`);
      // Avant P6 : la seule donnée (une phase, ou deux fois la phase 1).
      ok(!proche(calcul(normal), ATQ * s.phase1 * s.donnee.coups * k * df), `${s.id} sur ${forme} : plus le calcul d'avant P6 (${s.donnee.coups} × ${s.phase1} × ATQ)`);
      ok(proche(computeTotalDamage(p, monsterOffensivePassives(fiche(forme)), st, { ...normal, skillCom2usId: s.id }, AUCUNE_AURA_PROPRE, null), visee),
        `${s.id} sur ${forme} : computeTotalDamage = le sort seul (aucun passif)`);

      const gain = (art: ArtifactDamageProfile, x: DamageSetup) => calcul(x, art) - calcul(x);
      const critSec: DamageSetup = { ...crit, cibleDegatsParSort: { [s.id]: 'secondaire' } };
      ok(proche(gain(a224, crit), sur(s.phase1)), `${s.id} sur ${forme}, 224, cible visée : la phase 1 mono-cible seulement`);
      ok(proche(gain(a224, critSec), 0), `${s.id} sur ${forme}, 224, autres ennemis : rien, le seul coup reçu est en zone`);
      ok(proche(gain(a411, crit), sur(s.phase1)), `${s.id} sur ${forme}, 411, cible visée : le premier coup du tour`);
      ok(proche(gain(a411, critSec), 0), `${s.id} sur ${forme}, 411, autres ennemis : jamais`);
    }
  }

  titre('Lot P6, SZ-1 — la garde lit l’empreinte de la donnée, jamais le premier groupe');
  {
    // Head Press et Sagar : `coups: 2` compte les deux phases (premier groupe :
    // un coup), Sagar porte en plus `aoe: true` (premier groupe : mono-cible).
    // Acceptés plus haut, ils seraient refusés par une garde qui comparerait
    // la donnée au premier groupe.
    const headPress = fiche(24213).competences.find((c) => c.com2usId === 14113)!;
    const sagar = fiche(24713).competences.find((c) => c.com2usId === 14613)!;
    for (const [libelle, c] of [
      ['Head Press, coups = ceux du premier groupe', { ...headPress, coups: 1 }],
      ['Head Press, formule changée', { ...headPress, formule: '4.1*{ATK}' }],
      ['Sagar, portée = celle du premier groupe', { ...sagar, aoe: false }],
      ['Abigail, portée changée', { ...fiche(22911).competences.find((x) => x.com2usId === 13311)!, aoe: true }],
    ] as const) {
      const p = skillDamageProfile(c);
      ok(!!p && !estPrisEnCharge(p) && p.raison.includes('ne correspond plus'), `${libelle} : refusé, la fiche ne porte plus l’empreinte`);
    }
  }
}
