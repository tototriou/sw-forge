// VIT en points de Ciri et Birgitta, ATQ ennemie inférieure de Theonia
// (degats-et-aura 15e, damage.ts) :
//   - Flash Step (19014) et Turning Slash (19414) : +50 de VIT en POINTS par
//     cumul, 5 cumuls au plus (« up to 250 »), dans `STATS_COMBAT_PAR_ID_CONNUS`.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un cumul lu comme un pourcentage
// (×1,5 au lieu de +50), ou un bonus accordé à l'égalité d'ATQ — le
// classement des builds change sans rien afficher d'anormal. Une entrée
// curée n'est protégée que par son test (skill game-data-curation § 8).

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import {
  AUCUNE_AURA_PROPRE,
  ARTIFACT_DAMAGE_NEUTRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  estPrisEnCharge,
  monsterCombatStatProfiles,
  monsterDamageSkills,
  statsDeCombat,
} from '../src/lib/damage';
import { DetailMonstre } from '../src/lib/monsterSkills';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BuildCandidate, objectiveScore } from '../src/lib/runeBuildOptim';
import { StatKey } from '../src/lib/effects';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(forme: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${forme}.json`), 'utf8'));
}

function profilDe(forme: number, sort: number): SkillDamageProfile {
  const trouve = monsterDamageSkills(fiche(forme)).find((p) => p.skillCom2usId === sort);
  if (!trouve || !estPrisEnCharge(trouve)) throw new Error(`Profil ${forme}/${sort} introuvable`);
  return trouve;
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

const BUILD = { hp: 20000, atk: 1000, def: 800, spd: 200, cr: 25, cd: 100 };
const base: DamageSetup = {
  ...DEFAULT_DAMAGE_SETUP,
  enemyDef: 1000,
  enemyHp: 1_000_000,
  enemyHpPct: 100,
  critMode: 'normal',
  summonerSkills: 'combat',
};

// Le chemin du moteur : recette → contexte du CLI → `objectiveScore`.
function recetteDe(forme: number, setup: DamageSetup) {
  return buildOptimizerRecipe({
    monsterCom2usId: forme,
    monsterName: String(forme),
    requirement: { sets: [], minStats: {} },
    objective: 'degats_reels',
    damageSetup: setup,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'rta',
    excludedSelectors: [],
    ignoreArtifacts: true,
    artifactMainByKind: {},
  });
}

function score(forme: number, setup: DamageSetup, valeurs: Partial<Record<StatKey, number>> = BUILD): number {
  const ctx = buildRealDamageContext(recetteDe(forme, setup), forme, []);
  if (!ctx) throw new Error(`contexte ${forme} introuvable`);
  const candidat = { stats: stats(valeurs), effTotal: 0 } as unknown as BuildCandidate;
  return objectiveScore(candidat, 'degats_reels', AUCUNE_AURA_PROPRE, ctx);
}

const proche = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

// Forme → [passif, S1 qui lit `{SPD}`, nom]. Écrite à la main, jamais dérivée
// de la table : c'est ce qui fait échouer le test quand une ligne disparaît.
// 29304 (Ciri, nom coréen en donnée) et 29704 (Magic Order Swordsinger) sont
// les formes non éveillées : non sélectionnables (A.2 ter), elles partagent
// l'identifiant du passif.
const FORMES_VIT: [number, number, number, string][] = [
  [29314, 19014, 19004, 'Ciri'],
  [29304, 19014, 19004, 'Ciri non éveillée'],
  [29714, 19414, 19404, 'Birgitta'],
  [29704, 19414, 19404, 'Magic Order Swordsinger'],
];

export function testVitCiriBirgitta() {
  titre('Ciri et Birgitta — +50 de VIT en points par cumul, 250 au plus (degats-et-aura 15e)');
  for (const [forme, passif, s1, nom] of FORMES_VIT) {
    const c = fiche(forme).competences.find((x) => x.com2usId === passif)!;
    ok(c.description?.includes('increases your Attack Speed by 50 each, up to 250') === true,
      `${passif} ${nom} — la prose porte « by 50 each, up to 250 »`);
    const effet = c.effets.find((e) => e.quantite === 50 && e.note === 'Up to 250');
    ok(effet != null, `${passif} ${nom} — la donnée porte 50, note « Up to 250 » (${effet?.nom ?? 'absent'})`);

    const profils = monsterCombatStatProfiles(fiche(forme));
    egal(profils.map((p) => [p.skillCom2usId, p.source, p.max, p.spdFlat, p.spdPct, p.spdBasePct]),
      [[passif, 'stacks', 5, 50, undefined, undefined]],
      `${passif} ${nom} — compteur de 5 cumuls à +50 de VIT en points, ni % de combat, ni % de base`);

    // Apport = VIT de combat avec N cumuls − VIT de combat sans le passif.
    const apport = (setup: DamageSetup, cumuls: number) => {
      const st = stats(BUILD);
      const sans = statsDeCombat(st, setup, AUCUNE_AURA_PROPRE, 'light', ARTIFACT_DAMAGE_NEUTRE, {});
      const avec = statsDeCombat(st, { ...setup, stackPersonnalise: { [passif]: cumuls } }, AUCUNE_AURA_PROPRE, 'light',
        ARTIFACT_DAMAGE_NEUTRE, { combatStats: profils });
      return avec.spd - sans.spd;
    };
    egal(apport(base, 0), 0, `${passif} ${nom} — 0 cumul, aucune VIT ajoutée (jamais deviné)`);
    egal(apport(base, 1), 50, `${passif} ${nom} — 1 cumul = +50 VIT`);
    egal(apport(base, 5), 250, `${passif} ${nom} — 5 cumuls = +250 VIT`);
    egal(apport(base, 9), 250, `${passif} ${nom} — plafond : 250 au plus`);
    egal(apport({ ...base, spdBuff: true, leaderSkill: { stat: 'Attack Speed', pct: 24 } }, 1), 50,
      `${passif} ${nom} — buff de VIT et lead actifs, un cumul reste +50 points (pas un %)`);

    // Le total du S1 (`{SPD}` dans la formule), par le chemin du moteur.
    const setupS1 = { ...base, skillCom2usId: s1 };
    const sansCumul = score(forme, setupS1);
    const cinqCumuls = score(forme, { ...setupS1, stackPersonnalise: { [passif]: 5 } });
    ok(cinqCumuls > sansCumul, `${s1} ${nom} — moteur : 5 cumuls augmentent le total du S1`);
    ok(proche(cinqCumuls, score(forme, setupS1, { ...BUILD, spd: BUILD.spd + 250 })),
      `${s1} ${nom} — moteur : 5 cumuls valent exactement +250 VIT sur le build (reçu ${cinqCumuls} contre ${score(forme, setupS1, { ...BUILD, spd: BUILD.spd + 250 })})`);
  }

  // La recette transporte le compteur, à l'identique.
  const recette = recetteDe(29314, { ...base, skillCom2usId: 19004, stackPersonnalise: { 19014: 3 } });
  egal(parseOptimizerRecipe(JSON.stringify(recette)).recipe?.damageSetup?.stackPersonnalise, { 19014: 3 },
    'recette : le compteur de Flash Step survit à l’export puis à la relecture');
}
