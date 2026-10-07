// Score chiffré des propriétés uniques de relique
// (`spec/outils/optimizer/moteur/reliques.md`, « L'effet unique — score de la
// propriété exclusive »). Un test par GROUPE, contre des valeurs calculées À LA
// MAIN depuis des pièces RÉELLES des deux exports de compte (le `rid` et le
// `sec_effect = [type, tranche, percent]` de chacune sont cités en
// commentaire, relevés le 2026-09-22 par le vrai chemin d'import).
//
// ⚠️ **`game-data-curation` s'applique intégralement.** La formule
// `⌊Y / t⌋ × percent` et le placement des groupes Conquête (terme `DMG%`),
// Bravoure / Éternité / Origine (valeur de BASE) sont un RELEVÉ EN JEU, décrit
// dans la section de `reliques.md` citée ci-dessus, pas une déduction. La
// Ténacité fait exception : sa traduction en PV effectifs équivalents est une
// SIMPLIFICATION, pas un relevé, et son test fige cette simplification. Deux
// analogies de `damage.ts` s'étant déjà révélées fausses, aucune valeur n'est
// ici « par symétrie » avec une autre.
//
// ⚠️ Ce que les tests ne figent PAS, et qui est dit : l'arrondi de l'apport
// de POINTS (Bravoure/Éternité/Origine) n'a pas été relevé — le code n'en
// pose aucun (voir `apportExclusive`), l'écart est borné par 1 point de stat
// et n'a aucun effet sur un classement hors ex æquo.

import { BaseStats, RelicDetail } from '../src/types';
import { computeStats } from '../src/lib/stats';
import {
  AUCUNE_AURA_PROPRE, ARTIFACT_DAMAGE_NEUTRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  artifactDamageProfile,
  computeTotalDamage,
  computeSkillDamageDetail,
  estPrisEnCharge,
  skillDamageProfile,
  statsDebutCombat,
  statsDeCombat,
  maVitCombat,
  type SkillDamageProfile,
} from '../src/lib/damage';
import { Competence } from '../src/lib/monsterSkills';
import { APPORT_NEUTRE, apportExclusive, facteurTenacite, statsAvecApport, tranchesAtteintes } from '../src/lib/relicExclusive';
import { exclusiveChiffrable } from '../src/lib/relicOptim';
import { RELIC_UNIQUE } from '../src/lib/effects';
import { aurasPropresParRunes, objectiveScore, optionsDeClassement, pvEffectifs, scoreDeReference, scoreDuCandidat, sortCandidates, statTotal } from '../src/lib/runeBuildOptim';
import type { BuildCandidate, RealDamageContext } from '../src/lib/runeBuildOptim';
import { bestRelicForBuild, resoudreContexteRelique } from '../src/lib/relicOptim';
import { entreeResolutionDuBuild, etatReliqueDuBuild, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { classementResolu, cleBuild, signatureArtefacts, type ResultatArtefacts } from '../src/lib/artifactQueue';
import { evaluerPourRegime } from '../src/lib/artifactEvaluation';
import type { RelicIntent } from '../src/hooks/useOptimizerState';
import type { ArtifactDetail, GearSet, RuneDetail } from '../src/types';
import { readFileSync } from 'node:fs';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { classer } from '../scripts/lib/diagnosticHarness';
import type { ConfigResolue } from '../scripts/lib/diagnosticConfig';
import { rune } from './relic-search.test';
import { egal, ok, titre } from './outils';

/* --------------------------------------------------------------------------
 * Le banc — une base explicite, aucune rune, aucun artéfact : toute valeur
 * de ce fichier se recalcule à la main depuis ces huit nombres.
 * ----------------------------------------------------------------------- */

const BASE: BaseStats = { hp: 25000, atk: 2000, def: 1800, spd: 200, cr: 15, cd: 50, res: 15, acc: 0 };

// ⚠️ `summonerSkills: 'combat'` est le DÉFAUT du jeu et de l'app (il n'existe
// pas de cran « aucun ») : +20 % ATQ/DEF/PV et +15 % VIT, appliqués à la
// BASE. Ils font partie de l'assiette `Y` (`spec/outils/optimizer/moteur/reliques.md`, « L'effet unique — score de la propriété exclusive »), donc chaque
// valeur attendue ci-dessous les inclut. `element: null` écarte en revanche
// le +21 % ATQ de la compétence élémentaire, qu'un test dédié vérifie.
const SETUP: DamageSetup = { ...DEFAULT_DAMAGE_SETUP };

function statsDe(relique?: RelicDetail) {
  return computeStats({ base: BASE, runes: [], artifacts: [], relic: relique });
}

function apport(relique?: RelicDetail) {
  return apportExclusive(relique, statsDe(relique), SETUP, AUCUNE_AURA_PROPRE, null);
}

// Une pièce réelle, recopiée telle qu'elle est lue dans l'export.
function piece(id: number, code: 100 | 101 | 102, value: number, upgrade: number, type: number, tranche: number, percent?: number): RelicDetail {
  return { id, upgrade, main: { code, value }, unique: percent == null ? { type, tranche } : { type, tranche, percent } };
}

function sortSynthetique(formule: string): SkillDamageProfile {
  const competence: Competence = {
    id: 1, com2usId: 1, nom: 'Test', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: 1, niveauMax: 5, formule, scale: [], ameliorations: [], icone: null, effets: [],
  };
  const p = skillDamageProfile(competence);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sortSynthetique : la formule "${formule}" n'est pas lue par le modèle.`);
  return p;
}

export default function testRelicExclusive() {
  titre('Relique — score chiffré des propriétés uniques');

  /* ── Tranches entières, par palier, sans plafond ─────────────────────── */
  {
    // ⚠️ Le relevé en jeu : « 1 % par 1 000 ATQ » vaut 1 % à 1 000 comme à
    // 1 800, et 2 % à 2 000 — JAMAIS au prorata.
    egal(tranchesAtteintes(999, 1000), 0, 'tranche non atteinte → 0 (999 pour 1 000)');
    egal(tranchesAtteintes(1000, 1000), 1, 'juste AU palier → 1 (1 000 pour 1 000)');
    egal(tranchesAtteintes(1800, 1000), 1, 'entre deux paliers → toujours 1, jamais au prorata (1 800 pour 1 000)');
    egal(tranchesAtteintes(2000, 1000), 2, 'palier suivant → 2 (2 000 pour 1 000)');
    // Aucun plafond : 120 tranches sont rendues telles quelles.
    egal(tranchesAtteintes(120_000, 1000), 120, 'aucun plafond sur le nombre de tranches');
  }

  /* ── L'assiette Y — « au début du combat », sans buff ────────────────── */
  {
    // `statsDebutCombat` = total (base + runes + artéfacts + principale de
    // relique + sets) + ⌈base × (invocateur + lead) / 100⌉.
    // ATQ : 2 000 + ⌈2 000 × 20/100⌉ = 2 400. VIT : 200 + ⌈200 × 15/100⌉ = 230.
    const y = statsDebutCombat(statsDe(), SETUP, AUCUNE_AURA_PROPRE, null);
    egal(y.atk, 2400, 'Y(ATQ) = 2 000 base + 20 % invocateur = 2 400');
    egal(y.def, 2160, 'Y(DEF) = 1 800 base + 20 % invocateur = 2 160');
    egal(y.hp, 30000, 'Y(PV) = 25 000 base + 20 % invocateur = 30 000');
    egal(y.spd, 230, 'Y(VIT) = 200 base + 15 % invocateur = 230');

    // La compétence élémentaire (+21 % ATQ) n'entre que pour un élément connu.
    egal(statsDebutCombat(statsDe(), SETUP, AUCUNE_AURA_PROPRE, 'fire').atk, 2820, 'Y(ATQ) avec élément = 2 000 + 41 % = 2 820');
    egal(statsDebutCombat(statsDe(), SETUP, AUCUNE_AURA_PROPRE, 'unknown').atk, 2400, "Y(ATQ) d'un élément inconnu ne reçoit pas le +21 %");

    // ⚠️ **Sans BUFF** : c'est ce qui distingue `statsDebutCombat` de
    // `statsDeCombat`. Buffs éteints, les deux coïncident exactement — c'est
    // l'extraction qui le garantit pour ATQ/DEF/PV, et cette assertion qui le
    // garantit pour la VIT, dont `maVitCombat` garde sa propre écriture.
    const sansBuff = statsDeCombat(statsDe(), SETUP, AUCUNE_AURA_PROPRE, null);
    egal([sansBuff.atk, sansBuff.def, sansBuff.hp, sansBuff.spd], [y.atk, y.def, y.hp, y.spd], 'buffs éteints : statsDeCombat ≡ statsDebutCombat (VIT comprise)');
    egal(maVitCombat(statsDe(), SETUP, null), y.spd, 'VIT : le préfixe de maVitCombat est bien Y(VIT)');

    // Buff actif : `statsDeCombat` monte, l'assiette `Y` ne bouge PAS.
    const avecBuff = statsDeCombat(statsDe(), { ...SETUP, atkBuff: true }, AUCUNE_AURA_PROPRE, null);
    ok(avecBuff.atk > y.atk, 'un buff ATQ fait monter statsDeCombat…');
    egal(statsDebutCombat(statsDe(), { ...SETUP, atkBuff: true }, AUCUNE_AURA_PROPRE, null).atk, y.atk, '… et laisse Y(ATQ) inchangé — « au début du combat » exclut les buffs');
  }

  /* ── Conquête (1-3) — additive dans le bracket DMG% ──────────────────── */
  {
    // Pièce réelle, export ß☆Enzo : rid 34315, +9, principale ATQ % 12,
    // sec_effect = [1, 1000, 1] (Conquête, référence ATQ).
    const conquete = piece(34315, 101, 12, 9, 1, 1000, 1);
    // ATQ : 2 000 + ⌈2 000 × 12/100⌉ = 2 240 (principale) ;
    // Y = 2 240 + ⌈2 000 × 20/100⌉ = 2 640 ; ⌊2 640 / 1 000⌋ = 2 ; 2 × 1 % = 2 %.
    egal(statsDe(conquete).find((r) => r.key === 'atk')!.total, 2240, 'rid 34315 : la principale ATQ % +12 porte l’ATQ à 2 240');
    egal(apport(conquete), { ...APPORT_NEUTRE, dmgPct: 2 }, 'rid 34315 (Conquête·ATQ, 1 % / 1 000) : ⌊2 640/1 000⌋ × 1 = +2 % de DGTS infligés');

    // Et ce pourcentage vit bien dans le bracket `DMG%` : il multiplie le
    // terme du sort par exactement 1,02.
    const st = statsDe(conquete);
    const p = sortSynthetique('3.6*{ATK}');
    const sans = computeSkillDamageDetail(p, st, SETUP, AUCUNE_AURA_PROPRE, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {}, 0).total;
    const avec = computeSkillDamageDetail(p, st, SETUP, AUCUNE_AURA_PROPRE, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {}, 2).total;
    ok(Math.abs(avec / sans - 1.02) < 1e-9, 'Conquête est ADDITIVE dans DMG% : le terme du sort est multiplié par 1,02 exactement');
  }

  /* ── Ténacité (4-6) — additive dans Réductions, côté défense ─────────── */
  {
    // Pièce réelle, export tototriou : rid 1326, +7, principale DEF % 10,
    // sec_effect = [6, 27000, 1] (Ténacité, référence PV).
    const tenacite = piece(1326, 102, 10, 7, 6, 27000, 1);
    // PV : 25 000 (la principale est DEF %) ; Y = 25 000 + 5 000 = 30 000 ;
    // ⌊30 000 / 27 000⌋ = 1 ; 1 × 1 % = 1 % de dégâts reçus en moins.
    egal(apport(tenacite), { ...APPORT_NEUTRE, reductionPct: 1 }, 'rid 1326 (Ténacité·PV, 1 % / 27 000) : ⌊30 000/27 000⌋ × 1 = −1 % de DGTS reçus');

    // PV effectifs ÉQUIVALENTS = pvEffectifs / (1 − X/100) — dérivé de
    // l'équation, pas posé par analogie.
    egal(facteurTenacite(0), 1, 'réduction nulle → facteur 1, le score d’avant à l’identique');
    ok(Math.abs(facteurTenacite(1) - 1 / 0.99) < 1e-12, 'réduction de 1 % → facteur 1/0,99');
    const st = statsDe(tenacite);
    const attendu = pvEffectifs(st, AUCUNE_AURA_PROPRE) / 0.99;
    const recu = objectiveScore({ runeIds: [], stats: st, effTotal: 0 }, 'ehp', AUCUNE_AURA_PROPRE, undefined, apport(tenacite));
    ok(Math.abs(recu - attendu) < 1e-9, `objectiveScore('ehp') applique le facteur de Ténacité (${attendu.toFixed(3)})`);

    // ⚠️ Ténacité réduit les dégâts REÇUS : elle ne touche jamais les dégâts
    // infligés. Le canal le garantit par construction (aucun `dmgPct`).
    egal(apport(tenacite).dmgPct, 0, 'Ténacité n’apporte rien au bracket DMG% — c’est un terme de défense');

    // Au-delà de 100 %, le modèle n'est pas défini : on plante, on n'invente
    // pas un score infini (aucune pièce réelle n'en approche : 26 relevées,
    // tranches de 150 à 45 000, percent 1 ou 2).
    let leve = false;
    try { facteurTenacite(100); } catch { leve = true; }
    ok(leve, 'une réduction ≥ 100 % lève, plutôt que de rendre un score infini');
  }

  /* ── Bravoure (7-9) → ATQ, multiplicative sur la valeur de BASE ──────── */
  {
    // Pièce réelle, export ß☆Enzo : rid 126672, +9, principale PV % 12,
    // sec_effect = [9, 18000, 2] (Bravoure, référence PV → améliore l'ATQ).
    const bravoure = piece(126672, 100, 12, 9, 9, 18000, 2);
    // PV : 25 000 + ⌈25 000 × 12/100⌉ = 28 000 ; Y = 28 000 + 5 000 = 33 000 ;
    // ⌊33 000 / 18 000⌋ = 1 ; 1 × 2 % de l'ATQ de BASE = 2 000 × 0,02 = 40.
    egal(statsDe(bravoure).find((r) => r.key === 'hp')!.total, 28000, 'rid 126672 : la principale PV % +12 porte les PV à 28 000');
    egal(apport(bravoure), { ...APPORT_NEUTRE, atk: 40 }, 'rid 126672 (Bravoure·PV, 2 % / 18 000) : +2 % de l’ATQ de BASE = +40 points');

    // ⚠️ Sur la BASE (2 000), jamais sur le total runé — ici ils coïncident
    // (aucune rune), donc on le prouve avec une principale ATQ % qui les
    // sépare : rid 1179006 (tototriou, ATQ % 8, sec_effect = [7, 250, 2],
    // Bravoure·VIT). ATQ totale = 2 000 + 160 = 2 160, base toujours 2 000 ;
    // Y(VIT) = 230 ; ⌊230/250⌋ = 0 — la tranche n'est PAS atteinte.
    const bravoureVit = piece(1179006, 101, 8, 5, 7, 250, 2);
    egal(apport(bravoureVit), APPORT_NEUTRE, 'rid 1179006 (Bravoure·VIT, tranche 250) : Y(VIT) = 230 < 250 → aucun gain');
    // La même pièce sur un monstre plus rapide franchit le palier : VIT de
    // base 218 → Y = 218 + ⌈218 × 15/100⌉ = 218 + 33 = 251 ≥ 250 → 1 tranche.
    const rapide = computeStats({ base: { ...BASE, spd: 218 }, runes: [], artifacts: [], relic: bravoureVit });
    egal(statsDebutCombat(rapide, SETUP, AUCUNE_AURA_PROPRE, null).spd, 251, 'VIT de base 218 → Y(VIT) = 251, juste au-dessus du palier');
    egal(apportExclusive(bravoureVit, rapide, SETUP, AUCUNE_AURA_PROPRE, null), { ...APPORT_NEUTRE, atk: 40 }, 'juste AU palier → +1 tranche, soit +2 % de l’ATQ de base (+40)');
  }

  /* ── Éternité (10-12) → DEF, et Origine (13-15) → PV ─────────────────── */
  {
    // Pièce réelle, export ß☆Enzo : rid 521168, +10, principale PV % 13,
    // sec_effect = [11, 150, 2] (Éternité, référence VIT → améliore la DEF).
    const eternite = piece(521168, 100, 13, 10, 11, 150, 2);
    // Y(VIT) = 230 ; ⌊230/150⌋ = 1 ; 1 × 2 % de la DEF de BASE = 1 800 × 0,02 = 36.
    egal(apport(eternite), { ...APPORT_NEUTRE, def: 36 }, 'rid 521168 (Éternité·VIT, 2 % / 150) : +2 % de la DEF de BASE = +36 points');

    // Pièce réelle, export ß☆Enzo : rid 1130275, +8, principale DEF % 11,
    // sec_effect = [15, 1500, 2] (Origine, référence DEF → améliore les PV).
    const origine = piece(1130275, 102, 11, 8, 15, 1500, 2);
    // DEF : 1 800 + ⌈1 800 × 11/100⌉ = 1 998 ; Y = 1 998 + ⌈1 800 × 20/100⌉ = 2 358 ;
    // ⌊2 358 / 1 500⌋ = 1 ; 1 × 2 % des PV de BASE = 25 000 × 0,02 = 500.
    egal(statsDe(origine).find((r) => r.key === 'def')!.total, 1998, 'rid 1130275 : la principale DEF % +11 porte la DEF à 1 998');
    egal(apport(origine), { ...APPORT_NEUTRE, hp: 500 }, 'rid 1130275 (Origine·DEF, 2 % / 1 500) : +2 % des PV de BASE = +500 points');

    // Les points entrent dans les stats QUI NOTENT, jamais dans `computeStats`.
    const st = statsDe(origine);
    egal(statsAvecApport(st, apport(origine)).find((r) => r.key === 'hp')!.total, 25500, 'statsAvecApport ajoute les 500 points aux PV…');
    egal(st.find((r) => r.key === 'hp')!.total, 25000, '… et laisse computeStats intacte (minimums et maximums restent hors combat)');
    ok(objectiveScore({ runeIds: [], stats: st, effTotal: 0 }, 'ehp', AUCUNE_AURA_PROPRE, undefined, apport(origine)) > pvEffectifs(st, AUCUNE_AURA_PROPRE), 'le gain de PV d’Origine fait monter les PV effectifs');
  }

  /* ── Ce qui reste NEUTRE, et ne s'estime jamais ──────────────────────── */
  {
    // Régénération (16) : effet réel en jeu, mesuré par aucun objectif.
    // Pièce réelle, export ß☆Enzo : rid 521171, sec_effect = [16, 18000, 2].
    egal(apport(piece(521171, 100, 14, 11, 16, 18000, 2)), APPORT_NEUTRE, 'rid 521171 (Régénération) : jamais notée — aucun objectif ne mesure soins et boucliers');

    // ⚠️ `percent` ABSENT (export d'une version antérieure, qui ne portait
    // que le type et la tranche) → NEUTRE, jamais estimé.
    egal(apport(piece(34315, 101, 12, 9, 1, 1000)), APPORT_NEUTRE, 'percent absent (export ancien) → neutre, jamais estimé à partir du niveau');

    // Type INCONNU (« d'autres propriétés pourront être ajoutées
    // ultérieurement ») → neutre, et jamais éliminé par ailleurs.
    egal(apport(piece(999, 101, 14, 11, 99, 1000, 5)), APPORT_NEUTRE, 'type inconnu (99) → neutre, jamais deviné');

    // Aucune relique du tout.
    egal(apport(undefined), APPORT_NEUTRE, 'aucune relique → apport neutre');

    // Apport neutre ⇒ score strictement inchangé, sur les deux objectifs
    // que l'exclusive touche.
    const st = statsDe();
    egal(objectiveScore({ runeIds: [], stats: st, effTotal: 0 }, 'ehp', AUCUNE_AURA_PROPRE, undefined, APPORT_NEUTRE), pvEffectifs(st, AUCUNE_AURA_PROPRE), 'apport neutre → objectiveScore(ehp) est exactement pvEffectifs');
  }

  /* ── L'accord entre le prédicat et la formule, type par type ─────────── */
  {
    // ⚠️ `exclusiveChiffrable` (relicOptim.ts, sans dépendance à damage.ts)
    // et `apportExclusive` (relicExclusive.ts) ne peuvent pas se dériver l'un
    // de l'autre — c'est CE test qui les tient ensemble. Une assiette
    // volontairement énorme fait franchir un palier à n'importe quelle
    // tranche réelle (la plus grande relevée : 45 000).
    const enorme = computeStats({ base: { hp: 900000, atk: 900000, def: 900000, spd: 900000, cr: 0, cd: 0, res: 0, acc: 0 }, runes: [], artifacts: [] });
    let accord = 0;
    for (const type of Object.keys(RELIC_UNIQUE).map(Number)) {
      const p = piece(1, 100, 12, 9, type, 45000, 1);
      const a = apportExclusive(p, enorme, SETUP, AUCUNE_AURA_PROPRE, null);
      const chiffre = JSON.stringify(a) !== JSON.stringify(APPORT_NEUTRE);
      if (chiffre === exclusiveChiffrable(type)) accord++;
      else ok(false, `type ${type} (${RELIC_UNIQUE[type]!.groupe}) : exclusiveChiffrable=${exclusiveChiffrable(type)} mais apport ${chiffre ? 'non neutre' : 'neutre'}`);
    }
    egal(accord, 16, 'les 16 types : exclusiveChiffrable ⟺ apportExclusive rend un apport non neutre');
    egal(exclusiveChiffrable(16), false, 'Régénération (16) n’est pas chiffrable — et n’est jamais pertinente, donc ne rend rien partiel');
    egal(exclusiveChiffrable(99), false, 'un type inconnu n’est pas chiffrable');
  }
}

/* --------------------------------------------------------------------------
 * L'effet unique dans le classement AFFICHÉ (tri et
 * cartes « Dégâts réels » / « PV effectifs »), dans les TROIS modes.
 *
 * Producteur réel : `optionsDeClassement`, que l'écran appelle tel quel ;
 * l'état de relique vient d'`etatReliqueDuBuild` sur les contextes de
 * `resoudreContexteRelique` — les deux mêmes fonctions que l'écran. Règle :
 * `off`/`equipped` → la relique de la fiche ; `recherche` → la
 * relique RETENUE ; non résolue → neutre, sans repli ; aucune → neutre.
 *
 * Attentes calculées À LA MAIN, jamais par `scoreDuCandidat` : l'apport
 * (`⌊Y / t⌋ × percent`, relevé en jeu) puis `objectiveScore` ou `pvEffectifs`
 * avec cet apport écrit en dur.
 * ----------------------------------------------------------------------- */

const SORT_ATQ = sortSynthetique('3.0*{ATK}');
const DEGATS: RealDamageContext = {
  profile: SORT_ATQ, passifs: [], setup: SETUP, element: null, artefacts: ARTIFACT_DAMAGE_NEUTRE,
  critSiPlusRapide: false, bonusDegatsSelonVit: null, bonusDegatsStack: null, monsterWide: {},
  bonusDegatsConditionnel: null, bonusDegatsSelonCr: null, bonusDegatsSelonDef: null, bonusSiAtqSeuil: null,
};

// Conquête (type 1, ATQ de référence), principale ATQ +10 % : ATQ 2 200,
// Y = 2 200 + ⌈2 000 × 20 %⌉ = 2 600 → ⌊2 600 / 1 000⌋ × 2 = 4 % de dégâts.
const CONQUETE = piece(701, 101, 10, 9, 1, 1000, 2);
// Ténacité (type 6, PV de référence), principale PV +10 % : PV 27 500,
// Y = 27 500 + ⌈25 000 × 20 %⌉ = 32 500 → ⌊32 500 / 10 000⌋ × 1 = 3 % de réduction.
const TENACITE = piece(702, 100, 10, 9, 6, 10000, 1);
// Régénération (16) : aucun objectif ne la mesure → neutre. MÊMES principales
// que les deux ci-dessus : les stats ne changent pas, seul l'effet unique.
const REGEN_ATQ = piece(703, 101, 10, 9, 16, 1000, 5);
const REGEN_PV = piece(704, 100, 10, 9, 16, 1000, 5);

const intention = (mode: RelicIntent['mode']): RelicIntent => ({ mode, principale: 'libre', type: 'libre', seuil: 0 });

function candidatDe(idBase: number, relique: RelicDetail | undefined, mains: Partial<Record<number, [number, number]>> = {}) {
  const runes: RuneDetail[] = [1, 2, 3, 4, 5, 6].map((slot) => rune(idBase + slot, slot, mains[slot] ?? [8, 0]));
  const c: BuildCandidate = { runeIds: runes.map((r) => r.id), stats: computeStats({ base: BASE, runes, artifacts: [], relic: relique }), effTotal: 0 };
  return { c, runes };
}

// La paire et la relique RETENUES d'un build résolu, telles que la file les
// met en cache (`fileArtefacts.parBuild`).
function resolu(c: BuildCandidate, relique: RelicDetail | undefined): ResultatArtefacts {
  return { paire: null, artefacts: [], stats: c.stats, meilleurSansVerrous: null, conforme: true, ...(relique ? { relique } : {}) };
}

export function testRelicClassementParMode() {
  titre('Relique — effet unique dans le tri et les cartes, dans les trois modes');

  const ctxOff = resoudreContexteRelique(intention('off'), CONQUETE, [CONQUETE]);
  const ctxEquipped = resoudreContexteRelique(intention('equipped'), CONQUETE, [CONQUETE]);
  const ctxRecherche = resoudreContexteRelique(intention('recherche'), REGEN_ATQ, [REGEN_ATQ, REGEN_PV, CONQUETE, TENACITE]);
  egal([ctxOff.mode, ctxEquipped.mode, ctxRecherche.mode], ['off', 'equipped', 'recherche'], 'les trois contextes du vrai producteur');
  egal(ctxRecherche.eligibles.length, 4, 'recherche : les quatre pièces sont éligibles (seuil +0, principale et type libres)');

  const { c: cAtq, runes: runesAtq } = candidatDe(7100, CONQUETE);
  const { c: cPv, runes: runesPv } = candidatDe(7200, TENACITE);
  egal(statTotal(cAtq.stats, 'atk'), 2200, 'précondition : ATQ 2 000 + principale 10 % = 2 200');
  egal(statTotal(cPv.stats, 'hp'), 27500, 'précondition : PV 25 000 + principale 10 % = 27 500');
  const runeById = new Map([...runesAtq, ...runesPv].map((r) => [r.id, r]));
  const aurasPropresDe = aurasPropresParRunes(runeById);

  const options = (etatReliqueDe: (c: BuildCandidate) => ReturnType<typeof etatReliqueDuBuild>) =>
    optionsDeClassement({
      realDamage: DEGATS, damageSetup: SETUP, runeById, metric: 'eff', aurasPropresDe,
      artefactsDuBuild: () => null, etatReliqueDe, contexteExclusive: { setup: SETUP, element: null },
    });
  // L'expression MÊME de l'écran (`etatReliqueDe`) : cache de la file, contexte
  // de la recherche lancée, relique de la fiche.
  const etat = (ctx: typeof ctxOff, fiche: RelicDetail | undefined, cache: Map<string, ResultatArtefacts> = new Map()) =>
    (c: BuildCandidate) => etatReliqueDuBuild(cache.get(cleBuild(c)), ctx, fiche);

  // Attentes à la main.
  const degatsNeutres = objectiveScore(cAtq, 'degats_reels', AUCUNE_AURA_PROPRE, DEGATS);
  const degatsConquete = objectiveScore(cAtq, 'degats_reels', AUCUNE_AURA_PROPRE, DEGATS, { ...APPORT_NEUTRE, dmgPct: 4 });
  ok(Math.abs(degatsConquete / degatsNeutres - 1.04) < 1e-12, 'Conquête additive dans DMG% : ×1,04 sur un sort sans autre bonus');
  const ehpNeutres = pvEffectifs(cPv.stats, AUCUNE_AURA_PROPRE, SETUP);
  const ehpTenacite = ehpNeutres / (1 - 3 / 100);
  const proche = (a: number | null, b: number) => a != null && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

  const cas: { nom: string; etatDegats: (c: BuildCandidate) => ReturnType<typeof etatReliqueDuBuild>; etatEhp: (c: BuildCandidate) => ReturnType<typeof etatReliqueDuBuild>; compte: boolean }[] = [
    { nom: 'off, build pas encore résolu → relique de la fiche', etatDegats: etat(ctxOff, CONQUETE), etatEhp: etat(ctxOff, TENACITE), compte: true },
    { nom: 'off, paire résolue (la file ne renseigne pas la relique) → relique de la fiche',
      etatDegats: etat(ctxOff, CONQUETE, new Map([[cleBuild(cAtq), resolu(cAtq, undefined)]])),
      etatEhp: etat(ctxOff, TENACITE, new Map([[cleBuild(cPv), resolu(cPv, undefined)]])), compte: true },
    { nom: 'equipped → relique de la fiche', etatDegats: etat(ctxEquipped, CONQUETE), etatEhp: etat(ctxEquipped, TENACITE), compte: true },
    { nom: 'recherche résolue → relique RETENUE (la fiche porte une Régénération)',
      etatDegats: etat(ctxRecherche, REGEN_ATQ, new Map([[cleBuild(cAtq), resolu(cAtq, CONQUETE)]])),
      etatEhp: etat(ctxRecherche, REGEN_PV, new Map([[cleBuild(cPv), resolu(cPv, TENACITE)]])), compte: true },
    { nom: 'recherche résolue sur une Régénération → neutre, jamais l’effet de la fiche',
      etatDegats: etat(ctxRecherche, CONQUETE, new Map([[cleBuild(cAtq), resolu(cAtq, REGEN_ATQ)]])),
      etatEhp: etat(ctxRecherche, TENACITE, new Map([[cleBuild(cPv), resolu(cPv, REGEN_PV)]])), compte: false },
    { nom: 'recherche non résolue → neutre, sans repli sur la relique de la fiche',
      etatDegats: etat(ctxRecherche, CONQUETE), etatEhp: etat(ctxRecherche, TENACITE), compte: false },
    { nom: 'aucune relique → neutre', etatDegats: etat(ctxOff, undefined), etatEhp: etat(ctxOff, undefined), compte: false },
  ];
  for (const k of cas) {
    const d = scoreDuCandidat(cAtq, 'degats_reels', options(k.etatDegats));
    ok(proche(d, k.compte ? degatsConquete : degatsNeutres), `Dégâts réels, ${k.nom} : ${d?.toFixed(3)} (attendu ${(k.compte ? degatsConquete : degatsNeutres).toFixed(3)})`);
    const p = scoreDuCandidat(cPv, 'ehp', options(k.etatEhp));
    ok(proche(p, k.compte ? ehpTenacite : ehpNeutres), `PV effectifs, ${k.nom} : ${p?.toFixed(3)} (attendu ${(k.compte ? ehpTenacite : ehpNeutres).toFixed(3)})`);
  }

  /* ── Tri PV/ATQ/DEF : la fiche, comme la carte ────────────────── */
  {
    // Bravoure (type 9 : ATQ depuis les PV) — tranche 12 000, 5 %, principale
    // DEF +0. A : ATQ 2 300, PV 25 000 → Y 30 000 → 2 tranches → +10 % de
    // 2 000 = +200. B : ATQ 2 250, PV 31 000 → Y 36 000 → 3 tranches → +300.
    const bravoure = piece(705, 102, 0, 9, 9, 12000, 5);
    const { c: a, runes: ra } = candidatDe(7300, bravoure, { 1: [3, 300] });
    const { c: b, runes: rb } = candidatDe(7400, bravoure, { 1: [3, 250], 5: [1, 6000] });
    egal([statTotal(a.stats, 'atk'), statTotal(b.stats, 'atk'), statTotal(b.stats, 'hp')], [2300, 2250, 31000], 'précondition : ATQ 2 300 / 2 250, PV de B 31 000');
    const parId = new Map([...ra, ...rb].map((r) => [r.id, r]));
    const propresDe = aurasPropresParRunes(parId);
    egal([apportExclusive(bravoure, a.stats, SETUP, propresDe(a), null).atk, apportExclusive(bravoure, b.stats, SETUP, propresDe(b), null).atk], [200, 300],
      'précondition : les points Bravoure existent (+200, +300) — B franchit une tranche de plus');
    const opts = (e: (c: BuildCandidate) => ReturnType<typeof etatReliqueDuBuild>) => optionsDeClassement({
      realDamage: null, damageSetup: SETUP, runeById: parId, metric: 'eff', aurasPropresDe: propresDe,
      artefactsDuBuild: () => null, etatReliqueDe: e, contexteExclusive: { setup: SETUP, element: null },
    });
    // Avec la relique de la fiche, les points Bravoure ne comptent pas dans
    // le tri : le score est celui de la fiche et A reste devant B.
    for (const [nom, e] of [['off', etat(ctxOff, bravoure)], ['equipped', etat(ctxEquipped, bravoure)]] as const) {
      egal([scoreDuCandidat(a, 'atk', opts(e)), scoreDuCandidat(b, 'atk', opts(e))], [2300, 2250], `tri ATQ, ${nom} : la fiche, 2 300 et 2 250 — les points Bravoure ne classent plus`);
      egal(sortCandidates([a, b], 'atk', opts(e)).map(cleBuild), [a, b].map(cleBuild), `tri ATQ, ${nom} : A reste devant B, que ses points ne font plus passer`);
    }
    // L'ordre de BASE de l'écran (options sans effet unique), affiché tel
    // quel tant que la file n'a rien résolu, coïncide avec le classement
    // affiché.
    const ordreDeBase = sortCandidates([a, b], 'atk', { runeById: parId, metric: 'eff', damageSetup: SETUP, aurasPropresDe: propresDe });
    egal(ordreDeBase.map(cleBuild), sortCandidates([a, b], 'atk', opts(etat(ctxOff, bravoure))).map(cleBuild),
      'ordre de base sans effet unique et classement affiché : le même ordre');
    const nonResolu = etat(ctxRecherche, bravoure);
    egal(scoreDuCandidat(a, 'atk', opts(nonResolu)), 2300, 'tri ATQ, recherche non résolue : neutre (2 300)');
    egal(sortCandidates([a, b], 'atk', opts(nonResolu)).map(cleBuild), [a, b].map(cleBuild), 'tri ATQ, recherche non résolue : ordre des stats seules');
    // La carte (`StatPanel`, `candidate.stats`) montre la valeur qui classe.
    egal(scoreDuCandidat(a, 'atk', opts(etat(ctxOff, bravoure))), statTotal(a.stats, 'atk'),
      'la carte montre l’ATQ de la fiche (2 300), le tri classe sur 2 300');
  }

  /* ── Harnais : classé comme le CLI (invariant « Harnais ») ──────────────── */
  {
    // Lushen (base ATQ 900, PV 9 225), « Dégâts réels » (sort à l'ATQ).
    // Bravoure (type 9 : ATQ depuis les PV), tranche 3 000, 10 %.
    // A : ATQ 1 200, PV 9 225 → Y = 9 225 + ⌈9 225 × 20 %⌉ = 11 070 → 3
    //     tranches → +30 % de 900 = +270 → 1 470.
    // B : ATQ 1 150, PV 12 225 → Y = 14 070 → 4 tranches → +360 → 1 510.
    const lushen = { hp: 9225, atk: 900, def: 461, spd: 103, cr: 15, cd: 50, res: 15, acc: 0 };
    const bravoure = piece(706, 102, 0, 9, 9, 3000, 10);
    const runesA = [1, 2, 3, 4, 5, 6].map((slot) => rune(7700 + slot, slot, slot === 1 ? [3, 300] : [8, 0]));
    const runesB = [1, 2, 3, 4, 5, 6].map((slot) => rune(7800 + slot, slot, slot === 1 ? [3, 250] : slot === 5 ? [1, 3000] : [8, 0]));
    const cand = (runes: RuneDetail[]): BuildCandidate => ({ runeIds: runes.map((r) => r.id), stats: computeStats({ base: lushen, runes, artifacts: [], relic: bravoure }), effTotal: 0 });
    const [ca, cb] = [cand(runesA), cand(runesB)];
    egal([statTotal(ca.stats, 'atk'), statTotal(cb.stats, 'atk'), statTotal(cb.stats, 'hp')], [1200, 1150, 12225], 'harnais, précondition : ATQ 1 200 / 1 150, PV de B 12 225');
    const recette = buildOptimizerRecipe({
      monsterCom2usId: 13413, monsterName: 'Lushen',
      requirement: { sets: [], minStats: {} }, objective: 'degats_reels', damageSetup: DEFAULT_DAMAGE_SETUP,
      compterAurasResPre: true, metric: 'eff', slotFilterPreset: 'bas',
      adaptiveTrancheWeighting: false, exhaustiveSearch: false,
      excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
      ignoreArtifacts: true, artifactMainByKind: {},
    });
    const resolue = {
      recette, monstre: { com2usId: 13413 }, poolInitial: [...runesA, ...runesB],
      params: { artifacts: [], metric: 'eff', objective: 'degats_reels', relic: bravoure, relicContext: resoudreContexteRelique(intention('off'), bravoure, []) },
    } as unknown as ConfigResolue;
    egal(classer([ca, cb], resolue).classes.map(cleBuild), [cb, ca].map(cleBuild),
      'harnais, mode off : B passe devant A par les points Bravoure de la relique portée, comme au CLI');
    egal(classer([ca, cb], { ...resolue, params: { ...resolue.params, relicContext: resoudreContexteRelique(intention('recherche'), bravoure, [bravoure]) } } as ConfigResolue).classes.map(cleBuild),
      [ca, cb].map(cleBuild), 'harnais, mode recherche sans résolution : neutre, A devant B');
  }

  /* ── Effet unique modifié, identifiant de relique constant ─────────────── */
  {
    const conqueteBis: RelicDetail = { ...CONQUETE, unique: { type: 1, tranche: 1000, percent: 3 } };
    egal(conqueteBis.id, CONQUETE.id, 'même identifiant de relique');
    const attendu = objectiveScore(cAtq, 'degats_reels', AUCUNE_AURA_PROPRE, DEGATS, { ...APPORT_NEUTRE, dmgPct: 6 });
    ok(proche(scoreDuCandidat(cAtq, 'degats_reels', options(etat(ctxOff, conqueteBis))), attendu),
      'Conquête réimportée à 3 % (même id) : le score suit la pièce, 6 % et non 4 % — aucune lecture par identifiant');
    const reglages = {
      monstreCom2usId: 1, damageSetup: SETUP, regimeEquipement: 'degats_reels', ignoreArtifacts: false, principaleParSorte: {},
      lignesVerrouillees: [] as { code: number; min: number }[], nbArtefacts: 0, empreinteRelique: null, requirement: { minStats: {}, maxStats: {} },
      artefactsReserves: [] as number[], piecesFigees: [] as unknown[], importDuCompte: 0,
    };
    ok(signatureArtefacts({ ...reglages, relique: CONQUETE }) !== signatureArtefacts({ ...reglages, relique: conqueteBis }),
      'signature de la file : l’effet unique la change à identifiant constant (paires renotées)');
  }

  /* ── L'écran appelle CE producteur, et la carte lit la MÊME relique ────── */
  {
    const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
    ok(/const optionsDuTriAffiche = useMemo\(\s*\(\) =>\s*optionsDeClassement\(\{[\s\S]{0,900}?etatReliqueDe,/.test(ecran),
      'écran : les options du tri affiché viennent d’optionsDeClassement, avec etatReliqueDe');
    ok(/etatRelique=\{etatReliqueDe\(c\)\}/.test(ecran), 'écran : la relique affichée par la carte est celle que le score compte');
    // L'ordre de BASE (`fullSortedCandidates`) est affiché TEL QUEL tant que
    // la file n'a rien résolu — toujours, quand l'optimisation d'artéfacts
    // est coupée (mode `off`). Il doit compter la relique fixe, sans lire le
    // cache de la file (qui se nourrit de cet ordre).
    ok(/const etatReliqueDeBase = useCallback\(\s*\(_c: BuildCandidate\) => etatReliqueDuBuild\(undefined, relicContextRecherche, selected\?\.gear\.relic\)/.test(ecran)
      && /const fullSortedCandidates = useMemo\([\s\S]{0,700}?optionsDeClassement\(\{[\s\S]{0,600}?etatReliqueDe: etatReliqueDeBase/.test(ecran),
      'écran : l’ordre de base compte la relique fixe (off, equipped), sans lire le cache de la file');
    ok(/const etatReliqueDe = useCallback\([\s\S]{0,300}?\[fileArtefacts\.parBuild, relicContextRecherche, selected\?\.gear\.relic\]/.test(ecran),
      'écran : etatReliqueDe dépend de la PIÈCE de la fiche (objet), pas de son identifiant');
    // Le CLI : même producteur ; sans cache de file, `fixe` en off/equipped
    // (relique de la fiche, `SearchParams.relic`), `en attente` en recherche.
    // Ces options de l'ordre de BASE vivent dans
    // `classerCommeLEcran` (scripts/lib/classementCli.ts), que le script
    // appelle ; la résolution par build les complète ensuite.
    const cli = readFileSync('scripts/lib/classementCli.ts', 'utf8');
    ok(/const optionsDuTri = optionsDeClassement\(\{[\s\S]{0,1500}?etatReliqueDe: \(\) => etatReliqueDuBuild\(undefined, params\.relicContext, params\.relic\)/.test(cli),
      'CLI : les options du tri viennent d’optionsDeClassement, relique de la fiche via SearchParams.relic');
    ok(/classerCommeLEcran\(\{/.test(readFileSync('scripts/optimizer-search.ts', 'utf8')), 'CLI : le script classe par classerCommeLEcran');
  }
}

/* --------------------------------------------------------------------------
 * « Comparer » : la FICHE notée comme un candidat
 * (`scoreDeReference`, le producteur que l'écran appelle) — ses stats, ses
 * auras propres, le profil de SA paire d'artéfacts, l'effet unique de SA
 * relique — jamais les stats de la fiche mêlées au profil de
 * `searchArtifacts`, ni l'effet unique omis. Attentes à la main :
 * `computeTotalDamage` / `pvEffectifs` avec l'apport écrit en dur.
 * ----------------------------------------------------------------------- */

function artefact(id: number, kind: 'element' | 'archetype', subs: [number, number][]): ArtifactDetail {
  return {
    id, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
    level: 15, rarity: 5, main: { code: 102, value: 100 }, subs: subs.map(([code, value]) => ({ code, value })),
  };
}

export function testRelicReferenceComparer() {
  titre('Relique — « Comparer » : la fiche notée avec SES artéfacts et SA relique');

  // Fiche : deux runes Fight (une activation propre) et quatre Violent ; sa
  // paire porte 5 % de dégâts bruts sur l'ATQ (219). La paire de la
  // recherche ne la porte pas. Principales d'artéfact identiques (DEF +100) :
  // les stats sont les mêmes, seul le profil de dégâts diffère.
  const runes = [1, 2, 3, 4, 5, 6].map((slot) => rune(7500 + slot, slot, [8, 0], [], slot <= 2 ? 'fight' : 'violent'));
  const artsFiche = [artefact(7601, 'element', [[219, 5]]), artefact(7602, 'archetype', [])];
  const artsRecherche = [artefact(7603, 'element', []), artefact(7604, 'archetype', [])];
  const fiche = (relic: RelicDetail | undefined): GearSet => ({ base: BASE, runes, artifacts: artsFiche, relic });
  const fightUne = { ...AUCUNE_AURA_PROPRE, fight: 1 };
  const profilFiche = artifactDamageProfile(artsFiche);
  const profilRecherche = artifactDamageProfile(artsRecherche);
  egal([profilFiche.brutPctAtk, profilRecherche.brutPctAtk], [5, 0], 'précondition : les deux paires diffèrent par la ligne 219');

  // Le contexte que l'écran passe : celui du combat. On y laisse EXPRÈS le
  // profil de la paire de la recherche : la référence doit l'ignorer.
  const degatsRecherche: RealDamageContext = { ...DEGATS, artefacts: profilRecherche };
  const ctxRef = { degats: degatsRecherche, damageSetup: SETUP, exclusive: { setup: SETUP, element: null } };
  const degats = (stats: ReturnType<typeof computeStats>, profil: typeof profilFiche, dmgPct: number) =>
    computeTotalDamage(SORT_ATQ, [], stats, SETUP, fightUne, null, profil, false, null, null, {}, null, null, null, null, dmgPct);
  const proche = (a: number | null, b: number) => a != null && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

  /* ── Dégâts réels, Conquête ──────────────────────────────────────────── */
  // ATQ 2 200 ; Y = 2 200 + ⌈2 000 × (20 invocateur + 8 Fight propre) %⌉
  // = 2 760 → ⌊2 760 / 1 000⌋ × 2 = 4 %.
  const statsConq = computeStats(fiche(CONQUETE));
  egal(statTotal(statsConq, 'atk'), 2200, 'précondition : ATQ de la fiche 2 200');
  const attenduConq = degats(statsConq, profilFiche, 4);
  const sansConquete = degats(statsConq, profilRecherche, 0);
  ok(Math.abs(attenduConq - sansConquete) > 1, `témoin : la référence (paire de la recherche, sans Conquête) vaudrait ${sansConquete.toFixed(1)}, la fiche vaut ${attenduConq.toFixed(1)}`);
  ok(proche(scoreDeReference('degats_reels', fiche(CONQUETE), ctxRef), attenduConq),
    `référence « Dégâts réels » : paire de la FICHE et Conquête 4 % (${attenduConq.toFixed(3)})`);
  egal(scoreDeReference('degats_reels', fiche(undefined), ctxRef), degats(computeStats(fiche(undefined)), profilFiche, 0),
    'référence sans relique : neutre, paire de la fiche');
  const conqueteBis: RelicDetail = { ...CONQUETE, unique: { type: 1, tranche: 1000, percent: 3 } };
  ok(proche(scoreDeReference('degats_reels', fiche(conqueteBis), ctxRef), degats(statsConq, profilFiche, 6)),
    'référence : Conquête réimportée à 3 % (même id) → 6 %, la pièce et non son identifiant');

  /* ── Écart nul à équipement identique ─────────────────────────────────── */
  const runeById = new Map(runes.map((r) => [r.id, r]));
  const candidat = (relic: RelicDetail): BuildCandidate => ({ runeIds: runes.map((r) => r.id), stats: computeStats(fiche(relic)), effTotal: 0 });
  // Le build IDENTIQUE à la fiche, tel que l'écran le classe en `off` : sa
  // paire résolue est celle de la fiche, la paire supposée celle de la
  // recherche.
  const optionsOff = (relic: RelicDetail) => optionsDeClassement({
    realDamage: degatsRecherche, damageSetup: SETUP, runeById, metric: 'eff', aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: () => profilFiche,
    etatReliqueDe: (c) => etatReliqueDuBuild(undefined, resoudreContexteRelique(intention('off'), relic, [relic]), relic),
    contexteExclusive: { setup: SETUP, element: null },
  });
  const cConq = candidat(CONQUETE);
  const ecartDegats = scoreDuCandidat(cConq, 'degats_reels', optionsOff(CONQUETE))! - scoreDeReference('degats_reels', fiche(CONQUETE), ctxRef)!;
  ok(Math.abs(ecartDegats) < 1e-9, `« Comparer », Dégâts réels, équipement identique (Conquête) : écart ${ecartDegats}`);

  /* ── PV effectifs, Ténacité ──────────────────────────────────────────── */
  // PV 27 500 ; Y = 27 500 + ⌈25 000 × 20 %⌉ = 32 500 → 3 tranches × 1 = 3 %.
  const statsTen = computeStats(fiche(TENACITE));
  egal(statTotal(statsTen, 'hp'), 27500, 'précondition : PV de la fiche 27 500');
  const attenduTen = pvEffectifs(statsTen, fightUne, SETUP) / (1 - 3 / 100);
  ok(proche(scoreDeReference('ehp', fiche(TENACITE), ctxRef), attenduTen),
    `référence « PV effectifs » : Ténacité 3 % (${attenduTen.toFixed(3)} ; sans elle ${pvEffectifs(statsTen, fightUne, SETUP).toFixed(3)})`);
  const cTen = candidat(TENACITE);
  const ecartEhp = scoreDuCandidat(cTen, 'ehp', optionsOff(TENACITE))! - scoreDeReference('ehp', fiche(TENACITE), ctxRef)!;
  ok(Math.abs(ecartEhp) < 1e-9, `« Comparer », PV effectifs, équipement identique (Ténacité) : écart ${ecartEhp}`);

  /* ── L'écran : les deux écarts lisent CE producteur ──────────────────── */
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/scoreDeReference\('degats_reels', selected\.gear, contexteReference\)/.test(ecran) && /total - refDegats/.test(ecran),
    'écran : l’écart « Dégâts réels » se calcule contre scoreDeReference');
  ok(/scoreDeReference\('ehp', selected\.gear, contexteReference\)/.test(ecran) && /total - refEhp/.test(ecran),
    'écran : l’écart « PV effectifs » se calcule contre scoreDeReference');
  ok(!/computeTotalDamage\(/.test(ecran), 'écran : plus aucun computeTotalDamage recopié (ni candidat, ni référence)');
  ok(/const contexteReference = useMemo\([\s\S]{0,200}?\[contexteDegatsArtefacts, damageSetup, contexteExclusive\]/.test(ecran)
    && /const refDegats = useMemo\([\s\S]{0,200}?\[selected, contexteReference\]/.test(ecran),
    'écran : les références dépendent de la fiche entière et du contexte de combat, jamais du cache des résultats');
}

/* --------------------------------------------------------------------------
 * Le tri par PV, ATQ ou DEF classe sur la FICHE : le tri,
 * l'évaluateur de paire des régimes `hp`/`atk`/`def` et la carte lisent une
 * seule valeur, sans les points Bravoure/Éternité/Origine. « Dégâts réels »
 * et « PV effectifs » les comptent toujours (témoins).
 * ----------------------------------------------------------------------- */

// Bravoure (type 9 : ATQ depuis les PV), principale ATQ +10 %, tranche
// 12 000, 5 %. A : ATQ 2 000 + 300 + 200 = 2 500, PV 25 000 → Y = 25 000 +
// ⌈25 000 × 20 %⌉ = 30 000 → 2 tranches → +10 % de 2 000 = +200 → 2 700 en
// combat. B : ATQ 2 450, PV 31 000 → Y 36 000 → 3 tranches → +300 → 2 750.
// B franchit une tranche de plus : il passait devant A, alors que sa carte
// montre 2 450 contre 2 500.
const BRAVOURE_ATQ = piece(690, 101, 10, 9, 9, 12000, 5);

export function testTriParStatSurLaFiche() {
  titre('Tri par PV, ATQ ou DEF — la carte égale le tri, sur la fiche');

  const { c: a, runes: ra } = candidatDe(7500, BRAVOURE_ATQ, { 1: [3, 300] });
  const { c: b, runes: rb } = candidatDe(7600, BRAVOURE_ATQ, { 1: [3, 250], 5: [1, 6000] });
  const parId = new Map([...ra, ...rb].map((r) => [r.id, r]));
  const propresDe = aurasPropresParRunes(parId);
  egal([statTotal(a.stats, 'atk'), statTotal(b.stats, 'atk'), statTotal(b.stats, 'hp')], [2500, 2450, 31000], 'précondition : fiche, ATQ 2 500 / 2 450, PV de B 31 000');
  egal([apportExclusive(BRAVOURE_ATQ, a.stats, SETUP, propresDe(a), null).atk, apportExclusive(BRAVOURE_ATQ, b.stats, SETUP, propresDe(b), null).atk], [200, 300],
    'précondition : points Bravoure +200 et +300 — B franchit une tranche de plus et passerait devant avec eux (2 750 > 2 700)');

  const opts = (e: (c: BuildCandidate) => ReturnType<typeof etatReliqueDuBuild>) => optionsDeClassement({
    realDamage: DEGATS, damageSetup: SETUP, runeById: parId, metric: 'eff', aurasPropresDe: propresDe,
    artefactsDuBuild: () => null, etatReliqueDe: e, contexteExclusive: { setup: SETUP, element: null },
  });
  const etat = (ctx: ReturnType<typeof resoudreContexteRelique>, cache: Map<string, ResultatArtefacts> = new Map()) =>
    (c: BuildCandidate) => etatReliqueDuBuild(cache.get(cleBuild(c)), ctx, BRAVOURE_ATQ);
  const ctxRecherche = resoudreContexteRelique(intention('recherche'), BRAVOURE_ATQ, [BRAVOURE_ATQ]);
  const cacheResolu = new Map([[cleBuild(a), resolu(a, BRAVOURE_ATQ)], [cleBuild(b), resolu(b, BRAVOURE_ATQ)]]);
  // Ce que la carte affiche : `StatPanel` lit `row.total` de `candidate.stats`.
  const carte = (c: BuildCandidate, k: 'hp' | 'atk' | 'def') => c.stats.find((r) => r.key === k)!.total;

  const modes: [string, (c: BuildCandidate) => ReturnType<typeof etatReliqueDuBuild>][] = [
    ['off', etat(resoudreContexteRelique(intention('off'), BRAVOURE_ATQ, [BRAVOURE_ATQ]))],
    ['equipped', etat(resoudreContexteRelique(intention('equipped'), BRAVOURE_ATQ, [BRAVOURE_ATQ]))],
    ['recherche résolue sur la Bravoure', etat(ctxRecherche, cacheResolu)],
  ];
  for (const [nom, e] of modes) {
    egal([scoreDuCandidat(a, 'atk', opts(e)), scoreDuCandidat(b, 'atk', opts(e))], [carte(a, 'atk'), carte(b, 'atk')], `${nom} : le tri ATQ vaut la carte (2 500 et 2 450), sans les points`);
    egal(sortCandidates([b, a], 'atk', opts(e)).map(cleBuild), [a, b].map(cleBuild), `${nom} : A devant B, comme leurs cartes`);
    for (const k of ['hp', 'def'] as const) {
      egal(scoreDuCandidat(b, k, opts(e)), carte(b, k), `${nom} : tri ${k === 'hp' ? 'PV' : 'DEF'} = carte`);
    }
  }
  // Le classement AFFICHÉ (`classementResolu`, cache de la file) : chaque
  // carte montre la valeur qui la classe.
  const resolue = modes[2]![1];
  const affiche = classementResolu(sortCandidates([b, a], 'atk', opts(resolue)), cacheResolu, 'atk', opts(resolue));
  egal(affiche.map(cleBuild), [a, b].map(cleBuild), 'classement affiché (recherche résolue) : A devant B');
  egal(affiche.map((c) => scoreDuCandidat(c, 'atk', opts(resolue))), affiche.map((c) => carte(c, 'atk')), 'classement affiché : chaque carte montre la valeur qui la classe');

  // L'évaluateur de paire des régimes `hp`/`atk`/`def` : la MÊME valeur, le
  // canal exclusive porté par une relique dont les points touchent la stat.
  // Éternité (type 12 : DEF depuis les PV), 12 000, 5 % : Y 36 000 → 3
  // tranches → +15 % de 1 800 = +270. Origine (type 13 : PV depuis l'ATQ),
  // 1 000, 1 % : Y = 2 450 + ⌈2 000 × 20 %⌉ = 2 850 → 2 tranches → +2 % de
  // 25 000 = +500.
  const eternite = piece(691, 101, 10, 9, 12, 12000, 5);
  const origine = piece(692, 101, 10, 9, 13, 1000, 1);
  const propresB = propresDe(b);
  for (const [k, relique, points] of [['atk', BRAVOURE_ATQ, 300], ['def', eternite, 270], ['hp', origine, 500]] as const) {
    egal(apportExclusive(relique, b.stats, SETUP, propresB, null)[k], points, `précondition : ${points} points de ${k} pour B`);
    egal(evaluerPourRegime(k, () => b.stats, propresB, { relique, setup: SETUP, element: null })([]), carte(b, k),
      `évaluateur de paire, régime ${k} : la fiche (${carte(b, k)}), jamais + ${points}`);
  }

  // Témoins : « Dégâts réels » et « PV effectifs » comptent toujours les
  // points, au tri, à la carte et dans l'évaluateur de paire.
  const proche = (x: number | null, y: number) => x != null && Math.abs(x - y) < 1e-9 * Math.max(1, Math.abs(y));
  const fixe = modes[0]![1];
  const degatsAttendus = objectiveScore(b, 'degats_reels', propresB, DEGATS, { ...APPORT_NEUTRE, atk: 300 });
  ok(proche(scoreDuCandidat(b, 'degats_reels', opts(fixe)), degatsAttendus) && degatsAttendus > objectiveScore(b, 'degats_reels', propresB, DEGATS),
    `témoin Dégâts réels : le tri compte +300 ATQ de Bravoure (${degatsAttendus.toFixed(3)})`);
  const etatOrigine = () => etatReliqueDuBuild(undefined, undefined, origine);
  const ehpAttendus = objectiveScore(b, 'ehp', propresB, undefined, { ...APPORT_NEUTRE, hp: 500 }, SETUP);
  ok(proche(scoreDuCandidat(b, 'ehp', opts(etatOrigine)), ehpAttendus) && ehpAttendus > objectiveScore(b, 'ehp', propresB, undefined, APPORT_NEUTRE, SETUP),
    `témoin PV effectifs : le tri compte +500 PV d’Origine (${ehpAttendus.toFixed(3)})`);
  ok(evaluerPourRegime('degats_reels', () => b.stats, propresB, DEGATS, { relique: BRAVOURE_ATQ, setup: SETUP, element: null })([])
    > evaluerPourRegime('degats_reels', () => b.stats, propresB, DEGATS, { relique: undefined, setup: SETUP, element: null })([]),
    'témoin, évaluateur de paire « Dégâts réels » : les points Bravoure comptent');
  ok(evaluerPourRegime('ehp', () => b.stats, propresB, { relique: origine, setup: SETUP, element: null })([])
    > evaluerPourRegime('ehp', () => b.stats, propresB, { relique: undefined, setup: SETUP, element: null })([]),
    'témoin, évaluateur de paire « PV effectifs » : les points Origine comptent');
}

export function testDepartageReliquePortee() {
  titre('Mode recherche, régime de stat — à égalité, la relique PORTÉE l’emporte');

  // Le build B du test précédent : il franchit 3 tranches de Bravoure.
  const runes: RuneDetail[] = [1, 2, 3, 4, 5, 6].map((slot) => rune(7700 + slot, slot, slot === 1 ? [3, 250] : slot === 5 ? [1, 6000] : [8, 0]));
  // Même principale (ATQ +10 %) que la Bravoure 690, plus grande `id` :
  // une note en points ET la seule règle de l'`id` retiendraient 690.
  const portee = piece(695, 101, 10, 9, 16, 1000, 5);
  const autre = piece(696, 101, 10, 9, 16, 1000, 5);
  const principalePv = piece(697, 100, 10, 9, 16, 1000, 5);

  const resoudre = (regime: 'hp' | 'atk' | 'def' | 'ehp' | 'degats_reels', eligibles: RelicDetail[], porteeDuMonstre: RelicDetail) =>
    resoudreEquipementDuBuild(entreeResolutionDuBuild({
      fiche: { base: BASE, runes: [], artifacts: [], relic: porteeDuMonstre },
      runes,
      artifactParams: { porteur: { element: 'fire', archetype: 'attack' }, inventaire: [], equipes: [], principaleParSorte: {} },
      regime,
      degats: regime === 'degats_reels' ? DEGATS : null,
      exclusive: { setup: SETUP, element: null },
      requirement: { sets: [], minStats: {}, maxStats: {} },
      relicContext: resoudreContexteRelique(intention('recherche'), porteeDuMonstre, eligibles),
      caches: null,
    }));

  egal(resoudreContexteRelique(intention('recherche'), portee, [BRAVOURE_ATQ, portee]).eligibles.map((r) => r.id), [690, 695], 'précondition : les deux reliques sont candidates');
  for (const regime of ['atk', 'hp', 'def'] as const) {
    const r = resoudre(regime, [BRAVOURE_ATQ, portee], portee);
    egal([r.conforme, r.relique?.id], [true, 695], `régime ${regime} : Bravoure (690) et portée (695) ex æquo sur la fiche → la portée`);
  }
  egal(resoudre('atk', [BRAVOURE_ATQ, autre, principalePv], principalePv).relique?.id, 690,
    'régime atk : portée candidate mais moins bonne (principale PV) → la plus petite id des ex æquo (690)');

  // Témoins : les autres régimes gardent leur règle.
  egal(resoudre('degats_reels', [BRAVOURE_ATQ, portee], portee).relique?.id, 690, 'témoin Dégâts réels : la Bravoure gagne par ses points, pas d’égalité');
  egal(resoudre('ehp', [BRAVOURE_ATQ, portee], portee).relique?.id, 690,
    'témoin PV effectifs : ex æquo (les points d’ATQ ne touchent pas les PV) → plus petite id, la portée ne passe pas d’abord');

  // `bestRelicForBuild` seul : le départage n'existe que sur demande.
  const constante = () => 1;
  egal(bestRelicForBuild([BRAVOURE_ATQ, portee], constante, { equipee: portee, departagePortee: true })?.relique.id, 695, 'bestRelicForBuild, departagePortee : la portée ex æquo l’emporte');
  egal(bestRelicForBuild([BRAVOURE_ATQ, portee], constante, { equipee: portee })?.relique.id, 690, 'bestRelicForBuild, sans departagePortee : plus petite id (convention de l’oracle)');
  egal(bestRelicForBuild([BRAVOURE_ATQ, portee], (r) => (r.id === 690 ? 2 : 1), { equipee: portee, departagePortee: true })?.relique.id, 690,
    'bestRelicForBuild, departagePortee : la portée moins bien notée ne passe pas devant');
}
