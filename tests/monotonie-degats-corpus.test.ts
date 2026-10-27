// Règle de jeu R, vérifiée sur le CODE : les dégâts d'un sort ne baissent
// jamais quand le PV, l'ATQ ou la DEF du lanceur augmentent, quand les dégâts
// infligés d'une relique de Conquête augmentent, ni quand une ligne du profil
// d'artéfacts augmente (`ArtifactDamageProfile`). La dominance des reliques
// (src/lib/resolutionRapide.ts) en dépend : elle écarte sans note une relique
// qu'une autre égale ou dépasse sur ces canaux.
//
// ⚠️ La règle R est une règle de jeu confirmée par l'utilisateur le
// 2026-10-27 (non relevée en jeu) : ce test vérifie que le code la suit, il ne
// la prouve pas. Un sort qui y contredit est inscrit dans `EXCEPTIONS_REGLE_R`
// (resolutionRapide.ts), avec sa raison : il est alors exclu de la dominance,
// toutes ses reliques sont notées. Une exception se signale, elle ne se
// « répare » pas dans ce test. Le test échoue si un sort hors liste baisse, ou
// si un sort de la liste ne baisse plus (liste périmée).
//
// Corpus : les monstres que propose le sélecteur « Monstre à optimiser »
// (`formesJouables` du bestiaire). Chaque sort calculable, sous les deux
// réglages du test du memo (`memo-combat.test.ts`) et trois jeux de stats de
// base ; chaque canal (PV, ATQ, DEF, dégâts infligés de relique) et chaque
// ligne d'artéfact est augmentée seule, de plusieurs valeurs, sur deux profils
// d'artéfacts (neutre, et toutes les lignes non nulles). Référence de contrôle
// (`algo-verify`) : `computeTotalDamage` lui-même, sans memo.

import { BaseStats } from '../src/types';
import { StatRow, statsParPaire } from '../src/lib/stats';
import { formesJouables } from '../src/lib/monsterForms';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  ArtifactDamageProfile,
  AurasPropres,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  computeTotalDamage,
  estPrisEnCharge,
  monsterDamageSkills,
} from '../src/lib/damage';
import { EXCEPTIONS_REGLE_R } from '../src/lib/resolutionRapide';
import { APPORT_NEUTRE, statsAvecApport } from '../src/lib/relicExclusive';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadMonstersList } from '../scripts/lib/monstersData';
import { loadMonsterSkills } from '../scripts/lib/skillsData';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { RealDamageContext } from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

const BASES: BaseStats[] = [
  { hp: 11000, atk: 780, def: 640, spd: 104, cr: 15, cd: 50, res: 15, acc: 0 },
  { hp: 6000, atk: 420, def: 350, spd: 104, cr: 15, cd: 50, res: 15, acc: 0 },
  { hp: 24000, atk: 1500, def: 1100, spd: 104, cr: 15, cd: 50, res: 15, acc: 0 },
];
const PROPRES: AurasPropres = { fight: 1, determination: 1, enhance: 0, accuracy: 0, tolerance: 0 };
const CANAUX = ['hp', 'atk', 'def'] as const;

const AUTRES: ArtifactDamageProfile = {
  ampliAtkPct: 20, ampliDefPct: 20, ampliVitPct: 20, brutPctPv: 2, brutPctAtk: 3, brutPctDef: 4, brutPctVit: 3,
  degatsElementPct: { fire: 10, water: 10, wind: 10, light: 10, dark: 10 },
  cdPointsParSlot: { 1: 5, 2: 5, 3: 5, 4: 5 }, cdPointsMonoCible: 5, cdPointsPremiereAttaque: 5,
  cdPointsPvCibleHauts: 5, cdPointsPvCibleBas: 5, degatsBombePct: 10, degatsAttaqueConjointePct: 10,
};
const NEUTRE: ArtifactDamageProfile = { ...ARTIFACT_DAMAGE_NEUTRE, degatsElementPct: {}, cdPointsParSlot: {} };
const PROFILS = [NEUTRE, AUTRES];

// Les lignes du profil : chaque champ numérique, et chaque entrée des tables.
type Ligne = { nom: string; poser: (p: ArtifactDamageProfile, d: number) => ArtifactDamageProfile };
const LIGNES: Ligne[] = [
  ...(['ampliAtkPct', 'ampliDefPct', 'ampliVitPct', 'brutPctPv', 'brutPctAtk', 'brutPctDef', 'brutPctVit', 'cdPointsMonoCible',
    'cdPointsPremiereAttaque', 'cdPointsPvCibleHauts', 'cdPointsPvCibleBas', 'degatsBombePct', 'degatsAttaqueConjointePct'] as const)
    .map((k): Ligne => ({ nom: k, poser: (p, d) => ({ ...p, [k]: p[k] + d }) })),
  ...(['fire', 'water', 'wind', 'light', 'dark'] as const)
    .map((el): Ligne => ({ nom: `degatsElementPct.${el}`, poser: (p, d) => ({ ...p, degatsElementPct: { ...p.degatsElementPct, [el]: (p.degatsElementPct[el] ?? 0) + d } }) })),
  ...[1, 2, 3, 4].map((s): Ligne => ({ nom: `cdPointsParSlot.${s}`, poser: (p, d) => ({ ...p, cdPointsParSlot: { ...p.cdPointsParSlot, [s]: (p.cdPointsParSlot[s] ?? 0) + d } }) })),
];
const PAS_LIGNE = [1, 5, 50];
const PAS_DMG = [1, 3, 20];

function contexte(com2usId: number, setup: DamageSetup): RealDamageContext | null {
  return buildRealDamageContext({ objective: 'degats_reels', damageSetup: setup } as unknown as OptimizerRecipe, com2usId, []);
}

function note(ctx: RealDamageContext, stats: StatRow[], artefacts: ArtifactDamageProfile, dmgPct = 0): number {
  return computeTotalDamage(
    ctx.profile, ctx.passifs, stats, ctx.setup, PROPRES, ctx.element, artefacts, ctx.critSiPlusRapide,
    ctx.bonusDegatsSelonVit, ctx.bonusDegatsStack, ctx.monsterWide, ctx.bonusDegatsConditionnel, ctx.bonusDegatsSelonCr,
    ctx.bonusDegatsSelonDef, ctx.bonusSiAtqSeuil, dmgPct
  );
}

// Les baisses d'un contexte : chaque (profil, stat ou ligne, augmentation) dont la note baisse (NaN compris).
function baissesDuContexte(ctx: RealDamageContext, jeuxDeStats: StatRow[][]): string[] {
  const out: string[] = [];
  for (const stats of jeuxDeStats) {
    for (const [ip, profil] of PROFILS.entries()) {
      const avant = note(ctx, stats, profil);
      const baisse = (apres: number) => !(apres >= avant);
      for (const k of CANAUX) {
        const t = stats.find((r) => r.key === k)!.total;
        for (const d of [1, Math.round(t / 3), 3 * t]) {
          const apres = note(ctx, statsAvecApport(stats, { ...APPORT_NEUTRE, [k]: d }), profil);
          if (baisse(apres)) out.push(`${k} +${d} (${k} ${t}, profil ${ip}) : ${avant} → ${apres}`);
        }
      }
      for (const d of PAS_DMG) {
        const apres = note(ctx, stats, profil, d);
        if (baisse(apres)) out.push(`dégâts infligés +${d} (profil ${ip}) : ${avant} → ${apres}`);
      }
      for (const l of LIGNES) {
        for (const d of PAS_LIGNE) {
          const apres = note(ctx, stats, l.poser(profil, d));
          if (baisse(apres)) out.push(`ligne ${l.nom} +${d} (profil ${ip}) : ${avant} → ${apres}`);
        }
      }
    }
  }
  return out;
}

export default function testMonotonieDegatsCorpus() {
  titre('Monotonie des dégâts (règle R, confirmée par l’utilisateur le 2026-10-27, non relevée en jeu) — PV, ATQ, DEF, dégâts infligés de relique et lignes d’artéfact : augmenter une seule valeur ne baisse jamais la note, hors `EXCEPTIONS_REGLE_R` (corpus des monstres de l’Optimizer)');
  const jeuxDeStats = BASES.map((base) => statsParPaire({ base, runes: [], artifacts: [] })([]));
  const monstres = formesJouables(loadMonstersList());
  const baissesParSort = new Map<number, { nom: string; baisses: string[] }>();
  let nbMonstres = 0, nbSorts = 0, contextes = 0;
  const vus = new Set<number>();
  for (const m of monstres) {
    const id = m.com2usId;
    if (id == null || vus.has(id)) continue;
    vus.add(id);
    const detail = loadMonsterSkills(id);
    if (!detail) continue;
    nbMonstres++;
    for (const sort of monsterDamageSkills(detail).filter(estPrisEnCharge)) {
      const defaut: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: sort.skillCom2usId, critMode: 'crit' };
      const base = contexte(id, defaut);
      if (!base) continue;
      nbSorts++;
      const riche: DamageSetup = {
        ...defaut, atkBuff: true, defBuff: true, spdBuff: true, miriamActif: true, enemySpd: 40,
        passifsOffensifs: Object.fromEntries(base.passifs.map((p) => [p.skillCom2usId, true])),
        ...(base.profile.effetsEntreCoups?.length
          ? { scenariosEffetsEntreCoups: { [base.profile.skillCom2usId]: { actif: true, apresCoup: Object.fromEntries(base.profile.effetsEntreCoups.map((e) => [e.id, 1])) } } }
          : {}),
      };
      for (const setup of [defaut, riche]) {
        const ctx = setup === defaut ? base : contexte(id, setup)!;
        contextes++;
        for (const b of baissesDuContexte(ctx, jeuxDeStats)) {
          const cle = sort.skillCom2usId;
          const e = baissesParSort.get(cle) ?? { nom: `${m.name} (${id}) ${sort.nom}`, baisses: [] };
          if (e.baisses.length < 4) e.baisses.push(`${setup === defaut ? 'défaut' : 'riche'} : ${b}`);
          baissesParSort.set(cle, e);
        }
      }
    }
  }
  const horsListe = [...baissesParSort].filter(([id]) => !EXCEPTIONS_REGLE_R.has(id));
  egal(horsListe.map(([id, e]) => `${id} ${e.nom} : ${e.baisses.join(' ; ')}`), [], 'aucun sort hors `EXCEPTIONS_REGLE_R` ne baisse');
  const perimees = [...EXCEPTIONS_REGLE_R.keys()].filter((id) => !baissesParSort.has(id));
  egal(perimees, [], 'chaque sort de `EXCEPTIONS_REGLE_R` baisse encore (liste à jour)');
  ok(EXCEPTIONS_REGLE_R.has(5812), 'Ceres, Last Shot (5812) est en exception');
  ok(contextes > 1000 && nbSorts > 300, `corpus parcouru : ${nbMonstres} monstres, ${nbSorts} sorts, ${contextes} contextes (sort × réglage)`);
  console.log(`  corpus : ${nbMonstres} monstres, ${nbSorts} sorts, ${contextes} contextes ; ${baissesParSort.size} sort(s) en baisse`);
  for (const [id, e] of baissesParSort) console.log(`  baisse ${id} ${e.nom} : ${e.baisses.join(' ; ')}`);
}
