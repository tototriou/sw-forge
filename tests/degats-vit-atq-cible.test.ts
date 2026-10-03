// VIT en points de Ciri et Birgitta, ATQ ennemie inférieure de Theonia
// (degats-et-aura 15e, damage.ts) :
//   - Flash Step (19014) et Turning Slash (19414) : +50 de VIT en POINTS par
//     cumul, 5 cumuls au plus (« up to 250 »), dans `STATS_COMBAT_PAR_ID_CONNUS` ;
//   - Summary Justice (23515) : +100 % de dégâts quand l'ATQ ennemie saisie
//     (`enemyAtk`) est STRICTEMENT inférieure à l'ATQ du build, dans
//     `CONDITIONS_COMBAT_PAR_ID_CONNUS` ;
//   - une recette SANS `enemyAtk` prend l'ATQ ennemie affichée par l'écran
//     (1 000) et non 0 : Theonia, Kassandra, Eleni, Zaiross (15f).
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

export function testTheoniaAtqCible() {
  titre('Theonia (Summary Justice) — +100 % contre une ATQ ennemie inférieure, borne stricte (degats-et-aura 15e)');
  for (const forme of [34215, 34205]) {
    const nom = forme === 34215 ? 'Theonia' : 'Justice (non éveillée)';
    const c = fiche(forme).competences.find((x) => x.com2usId === 23515)!;
    ok(c.description?.includes('For enemies with Attack Power lower than yours, the damage dealt increases by 100%') === true,
      `23515 ${nom} — la prose porte « Attack Power lower than yours […] by 100% »`);
    ok(c.effets.some((e) => e.nom === 'Increase Damage' && e.quantite === 100 && e.note === 'For enemies with Attack Power lower than yours'),
      `23515 ${nom} — la donnée porte Increase Damage 100, note « For enemies with Attack Power lower than yours »`);
    const p = profilDe(forme, 23515);
    // ⚠️ La clause VIT (« Attack Speed lower than yours », `quantite: null`)
    // n'est PAS modélisée : une seule condition, et c'est voulu (relevé R11).
    egal(p.conditionsCombat, [{ type: 'atkCibleSousAtkPropre', ratio: 1, pct: 100 }],
      `23515 ${nom} — une condition, ATQ cible < ATQ propre, +100 % (clause VIT non modélisée, sans valeur en donnée)`);
    ok(p.critiqueGaranti === true, `23515 ${nom} — critique garanti conservé`);

    const total = (enemyAtk: number, valeurs = BUILD) =>
      computeSkillDamage(p, stats(valeurs), { ...base, skillCom2usId: 23515, enemyAtk }, AUCUNE_AURA_PROPRE, 'dark');
    const egalite = total(1000);
    ok(proche(total(999), 2 * egalite), `23515 ${nom} — ATQ ennemie 999 contre 1 000 : total ×2 exactement`);
    egal(total(1001), egalite, `23515 ${nom} — ATQ ennemie supérieure : aucun bonus`);
    egal(egalite, total(5000), `23515 ${nom} — égalité d'ATQ : aucun bonus (borne stricte, « lower than yours »)`);
    const buildFort = { ...BUILD, atk: 1001 };
    ok(proche(total(1000, buildFort), 2 * total(5000, buildFort)),
      `23515 ${nom} — l'ATQ du build candidat déclenche la condition (1 001 contre 1 000 : ×2)`);
  }
  // Le chemin du moteur, recette comprise.
  const setup = { ...base, skillCom2usId: 23515 };
  ok(proche(score(34215, { ...setup, enemyAtk: 999 }), 2 * score(34215, { ...setup, enemyAtk: 1000 })),
    '23515 Theonia — moteur : ATQ ennemie 999 → score ×2 ; 1 000 → aucun bonus');
  const recette = recetteDe(34215, { ...setup, enemyAtk: 1234 });
  egal(parseOptimizerRecipe(JSON.stringify(recette)).recipe?.damageSetup?.enemyAtk, 1234,
    'recette : l’ATQ ennemie saisie survit à l’export puis à la relecture');

  // Une recette SANS `enemyAtk` (ancienne recette) prend la valeur que
  // l'écran affiche, 1 000 (`DEFAULT_DAMAGE_SETUP.enemyAtk`), et non 0
  // (degats-et-aura 15f, décision de l'utilisateur du 2026-10-03). ⚠️ Un 0
  // allumerait la condition à tort sur toute ancienne recette, sans rien
  // afficher d'anormal : le champ montre 1 000. Les quatre monstres dont une
  // condition est `atkCibleSousAtkPropre` sont couverts, écrits à la main.
  // [forme, sort, nom, ATQ du build où la condition est éteinte contre 1 000,
  //  ATQ du build où elle est allumée contre 1 000]
  const MONSTRES_ATQ_CIBLE: [number, number, string, number, number][] = [
    [34215, 23515, 'Theonia', 900, 1200],
    [27613, 17413, 'Kassandra vent', 900, 1200],
    [28113, 17913, 'Eleni vent', 900, 1200],
    [14412, 2912, 'Zaiross (seuil inclusif à 50 % de l’ATQ)', 1900, 2000],
  ];
  for (const [forme, sort, nom, atqEteinte, atqAllumee] of MONSTRES_ATQ_CIBLE) {
    const sansChamp = { ...base, skillCom2usId: sort } as Partial<DamageSetup>;
    delete sansChamp.enemyAtk;
    egal('enemyAtk' in sansChamp, false, `${sort} ${nom} — la recette de test ne porte pas le champ enemyAtk`);
    const avec1000 = { ...base, skillCom2usId: sort, enemyAtk: 1000 };
    // L'ancienne recette passe par l'export JSON puis la relecture, comme à l'import.
    const relue = parseOptimizerRecipe(JSON.stringify(recetteDe(forme, sansChamp as DamageSetup))).recipe;
    egal(relue?.damageSetup?.enemyAtk, undefined, `${sort} ${nom} — relue, la recette n'a toujours pas de enemyAtk`);
    const scoreSans = (valeurs: Partial<Record<StatKey, number>>) => {
      const ctx = buildRealDamageContext(relue!, forme, []);
      return objectiveScore({ stats: stats(valeurs), effTotal: 0 } as unknown as BuildCandidate, 'degats_reels', AUCUNE_AURA_PROPRE, ctx!);
    };
    const eteinte = { ...BUILD, atk: atqEteinte };
    const allumee = { ...BUILD, atk: atqAllumee };
    const horsCondition = score(forme, { ...avec1000, enemyAtk: 1_000_000 }, allumee);
    egal(scoreSans(eteinte), score(forme, { ...avec1000, enemyAtk: 1_000_000 }, eteinte),
      `${sort} ${nom} — sans enemyAtk, ATQ du build ${atqEteinte} : condition éteinte (aucun bonus, pas de 0 allumant le +X %)`);
    ok(scoreSans(allumee) > horsCondition,
      `${sort} ${nom} — sans enemyAtk, ATQ du build ${atqAllumee} : condition allumée`);
    egal(scoreSans(eteinte), score(forme, avec1000, eteinte),
      `${sort} ${nom} — ATQ ${atqEteinte} : recette sans enemyAtk = recette qui porte 1 000`);
    egal(scoreSans(allumee), score(forme, avec1000, allumee),
      `${sort} ${nom} — ATQ ${atqAllumee} : recette sans enemyAtk = recette qui porte 1 000`);
  }

  // La fenêtre « Dégâts réels » ouvre le champ « ATQ adverse » dès qu'une
  // condition du sort choisi est `atkCibleSousAtkPropre` : c'est ce que la
  // ligne de Theonia active. Lu dans le source, hors commentaires.
  const carte = readFileSync(resolve(racine, 'src/components/outils/DamageSetupCard.tsx'), 'utf8');
  ok(carte.includes("const demandeAtkCible = conditionsAvecCle.some(({ condition }) => condition.type === 'atkCibleSousAtkPropre');")
    && carte.includes('{demandeAtkCible && (') && carte.includes('onChange={(v) => maj({ enemyAtk: v ?? 0 })}'),
  'écran : le champ « ATQ adverse » (`enemyAtk`) s’ouvre pour une condition `atkCibleSousAtkPropre`');
}
