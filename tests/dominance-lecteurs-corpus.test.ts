// Garde-fou de la table des lecteurs de la note de « Dégâts réels »
// (`statsDuLanceurLuesParLaNote`, src/lib/damage.ts), sur laquelle repose la
// dominance des reliques par classe de paires (src/lib/resolutionRapide.ts,
// `DominanceParPaire`) : une stat que la table déclare INERTE pour une classe
// de paires ne change jamais la note quand elle augmente seule.
//
// ⚠️ La table repose sur des règles de jeu confirmées par l'utilisateur le
// 2026-10-27 (non relevées en jeu) : seules les lignes d'artéfact 218-220
// lisent les PV, l'ATQ et la DEF totales ; les effets entre les coups ne
// changent pas le scaling d'un sort ; un modificateur du monstre qui lit une
// stat est écrit dans ses passifs. Ce test vérifie que le CODE les suit, il ne
// les prouve pas. Il échouera le jour où un modificateur encore non modélisé
// (l'équilibrage d'ATQ et de DEF d'Internal Force, Leona ; la conversion des PV
// en ATQ de Diana) entrera dans le calcul sans que la table ne le lise : la
// table se corrige alors (canal actif), jamais la note.
//
// Référence de contrôle (`algo-verify`) : `computeTotalDamage` lui-même, sans
// memo. Chaque sort calculable de chaque fiche du corpus, sous les deux
// réglages du test du memo (`memo-combat.test.ts`) : le défaut, et le réglage
// « riche » (buffs, Miriam, tous les passifs allumés, VIT adverse basse,
// scénario d'effets entre les coups actif). Pour chaque classe de paires (les
// lignes 218, 219, 220 présentes ou non, avec ou sans toutes les autres lignes
// d'artéfact), chaque stat inerte est augmentée seule, par le chemin même d'un
// apport de relique (`statsAvecApport`), de trois valeurs (1 point, un tiers,
// trois fois le total) : la note reste la même au bit près (`Object.is`).
// Témoin : la table vidée se fait prendre.

import { BaseStats } from '../src/types';
import { statsParPaire } from '../src/lib/stats';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  ArtifactDamageProfile,
  AurasPropres,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  computeTotalDamage,
  estPrisEnCharge,
  monsterDamageSkills,
  statsDuLanceurLuesParLaNote,
} from '../src/lib/damage';
import { APPORT_NEUTRE, statsAvecApport } from '../src/lib/relicExclusive';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { loadMonstersList } from '../scripts/lib/monstersData';
import { loadMonsterSkills } from '../scripts/lib/skillsData';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { RealDamageContext } from '../src/lib/runeBuildOptim';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const BASE: BaseStats = { hp: 11000, atk: 780, def: 640, spd: 104, cr: 15, cd: 50, res: 15, acc: 0 };
const PROPRES: AurasPropres = { fight: 1, determination: 1, enhance: 0, accuracy: 0, tolerance: 0 };
const CANAUX = ['hp', 'atk', 'def'] as const;
type Canal = (typeof CANAUX)[number];

// Toutes les lignes d'artéfact autres que 218-220, non nulles.
const AUTRES_LIGNES: Omit<ArtifactDamageProfile, 'brutPctPv' | 'brutPctAtk' | 'brutPctDef'> = {
  ampliAtkPct: 20, ampliDefPct: 20, ampliVitPct: 20, brutPctVit: 3,
  degatsElementPct: { fire: 10, water: 10, wind: 10, light: 10, dark: 10 },
  cdPointsParSlot: { 1: 5, 2: 5, 3: 5, 4: 5 }, cdPointsMonoCible: 5, cdPointsPremiereAttaque: 5,
  cdPointsPvCibleHauts: 5, cdPointsPvCibleBas: 5, degatsBombePct: 10, degatsAttaqueConjointePct: 10,
};

// Classe de paires : bit 1 ligne 218 (PV), 2 ligne 219 (ATQ), 4 ligne 220 (DEF).
function profilDeClasse(classe: number, autres: boolean): ArtifactDamageProfile {
  return {
    ...(autres ? AUTRES_LIGNES : { ...ARTIFACT_DAMAGE_NEUTRE, degatsElementPct: {}, cdPointsParSlot: {} }),
    brutPctPv: classe & 1 ? 2 : 0, brutPctAtk: classe & 2 ? 3 : 0, brutPctDef: classe & 4 ? 4 : 0,
  };
}
const canauxDeClasse = (classe: number): Canal[] => CANAUX.filter((_, i) => classe & (1 << i));

function contexte(com2usId: number, setup: DamageSetup): RealDamageContext | null {
  return buildRealDamageContext({ objective: 'degats_reels', damageSetup: setup } as unknown as OptimizerRecipe, com2usId, []);
}

function note(ctx: RealDamageContext, stats: StatRow[], artefacts: ArtifactDamageProfile): number {
  return computeTotalDamage(
    ctx.profile, ctx.passifs, stats, ctx.setup, PROPRES, ctx.element, artefacts, ctx.critSiPlusRapide,
    ctx.bonusDegatsSelonVit, ctx.bonusDegatsStack, ctx.monsterWide, ctx.bonusDegatsConditionnel, ctx.bonusDegatsSelonCr,
    ctx.bonusDegatsSelonDef, ctx.bonusSiAtqSeuil, 0
  );
}

// La stat `k` augmentée de `d`, seule, comme un apport de relique.
const augmentee = (stats: StatRow[], k: Canal, d: number) => statsAvecApport(stats, { ...APPORT_NEUTRE, [k]: d });

// Les écarts d'un contexte : chaque (classe, stat inerte, augmentation) qui change la note.
function ecartsDuContexte(ctx: RealDamageContext, lues: readonly Canal[], stats: StatRow[]): string[] {
  const out: string[] = [];
  for (let classe = 0; classe < 8; classe++) {
    const actifs = new Set<Canal>([...lues, ...canauxDeClasse(classe)]);
    for (const autres of [false, true]) {
      const artefacts = profilDeClasse(classe, autres);
      const avant = note(ctx, stats, artefacts);
      for (const k of CANAUX) {
        if (actifs.has(k)) continue;
        const t = stats.find((r) => r.key === k)!.total;
        for (const d of [1, Math.round(t / 3), 3 * t]) {
          const apres = note(ctx, augmentee(stats, k, d), artefacts);
          if (!Object.is(avant, apres)) {
            out.push(`classe [${canauxDeClasse(classe).join('+') || 'aucune ligne'}${autres ? ', autres lignes' : ''}], ${k} +${d} : ${avant} → ${apres}`);
          }
        }
      }
    }
  }
  return out;
}

export default function testDominanceLecteursCorpus() {
  titre('Table des lecteurs de la note de « Dégâts réels » — repose sur des règles de jeu confirmées par l’utilisateur le 2026-10-27 (non relevées en jeu), échouera si Leona ou Diana sont modélisés sans mise à jour de la table : une stat inerte augmentée seule ne change pas la note (corpus)');
  const stats = statsParPaire({ base: BASE, runes: [], artifacts: [] })([]);
  const ecarts: string[] = [];
  let contextes = 0;
  let inertes = 0;
  let sensibles = 0;
  let temoin: { ctx: RealDamageContext; lues: Canal[] } | null = null;
  const vus = new Set<number>();
  for (const m of loadMonstersList()) {
    const id = m.com2usId;
    if (id == null || vus.has(id)) continue;
    vus.add(id);
    const detail = loadMonsterSkills(id);
    if (!detail) continue;
    for (const sort of monsterDamageSkills(detail).filter(estPrisEnCharge)) {
      // Les deux réglages du test du memo (`memo-combat.test.ts`).
      const defaut: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: sort.skillCom2usId, critMode: 'crit' };
      const base = contexte(id, defaut);
      if (!base) continue;
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
        const lues = statsDuLanceurLuesParLaNote(ctx);
        inertes += CANAUX.length - lues.length;
        for (const e of ecartsDuContexte(ctx, lues, stats)) {
          if (ecarts.length < 10) ecarts.push(`${m.name} (${id}) sort ${sort.skillCom2usId} ${sort.nom} (${setup === defaut ? 'défaut' : 'riche'}) : ${e}`);
        }
        // Sensibilité : une stat lue fait bouger la note (sinon l'augmentation ne prouverait rien).
        for (const k of lues) {
          const t = stats.find((r) => r.key === k)!.total;
          if (!Object.is(note(ctx, stats, profilDeClasse(0, false)), note(ctx, augmentee(stats, k, t), profilDeClasse(0, false)))) sensibles++;
        }
        if (!temoin && lues.length > 0) temoin = { ctx, lues };
      }
    }
  }
  egal(ecarts, [], `${contextes} contextes (sort × réglage) × 8 classes de paires × 2 jeux de lignes : aucune stat inerte ne change la note (${inertes} stats inertes hors lignes)`);
  ok(contextes > 1000 && inertes > 0, `corpus parcouru : ${contextes} contextes, ${inertes} stats inertes hors lignes`);
  ok(sensibles > contextes / 2, `les augmentations sont sensibles : ${sensibles} stats lues font bouger la note`);
  ok(temoin != null && ecartsDuContexte(temoin.ctx, [], stats).length > 0,
    `témoin : la table vidée se fait prendre (${temoin?.ctx.profile.nom}, lues ${temoin?.lues.join('+')})`);
}
