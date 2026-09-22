// Score chiffré des propriétés uniques de relique (implementation-relique,
// lot 7 — B.7). Un test par GROUPE, contre des valeurs calculées À LA MAIN
// depuis des pièces RÉELLES des deux exports du chantier (le `rid` et le
// `sec_effect = [type, tranche, percent]` de chacune sont cités en
// commentaire, relevés le 2026-09-22 par le vrai chemin d'import).
//
// ⚠️ **`game-data-curation` s'applique intégralement.** La formule
// `⌊Y / t⌋ × percent` et le placement de chaque groupe (bracket `DMG%` pour
// Conquête, `Réductions` pour Ténacité, valeur de BASE pour Bravoure /
// Éternité / Origine) sont un RELEVÉ EN JEU de l'utilisateur (A.2 ter T4,
// rév. 41-43), pas une déduction. Ce que ces tests figent, c'est ce relevé —
// et deux analogies de `damage.ts` s'étant déjà révélées fausses, aucune
// valeur n'est ici « par symétrie » avec une autre.
//
// ⚠️ Ce que les tests ne figent PAS, et qui est dit : l'arrondi de l'apport
// de POINTS (Bravoure/Éternité/Origine) n'a pas été relevé — le code n'en
// pose aucun (voir `apportExclusive`), l'écart est borné par 1 point de stat
// et n'a aucun effet sur un classement hors ex æquo.

import { BaseStats, RelicDetail } from '../src/types';
import { computeStats } from '../src/lib/stats';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
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
import { objectiveScore, pvEffectifs } from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

/* --------------------------------------------------------------------------
 * Le banc — une base explicite, aucune rune, aucun artéfact : toute valeur
 * de ce fichier se recalcule à la main depuis ces huit nombres.
 * ----------------------------------------------------------------------- */

const BASE: BaseStats = { hp: 25000, atk: 2000, def: 1800, spd: 200, cr: 15, cd: 50, res: 15, acc: 0 };

// ⚠️ `summonerSkills: 'combat'` est le DÉFAUT du jeu et de l'app (il n'existe
// pas de cran « aucun ») : +20 % ATQ/DEF/PV et +15 % VIT, appliqués à la
// BASE. Ils font partie de l'assiette `Y` (reliques.md § 5.2), donc chaque
// valeur attendue ci-dessous les inclut. `element: null` écarte en revanche
// le +21 % ATQ de la compétence élémentaire, qu'un test dédié vérifie.
const SETUP: DamageSetup = { ...DEFAULT_DAMAGE_SETUP };

function statsDe(relique?: RelicDetail) {
  return computeStats({ base: BASE, runes: [], artifacts: [], relic: relique });
}

function apport(relique?: RelicDetail) {
  return apportExclusive(relique, statsDe(relique), SETUP, null);
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
  titre('Relique — score chiffré des propriétés uniques (lot 7)');

  /* ── Tranches entières, par palier, sans plafond ─────────────────────── */
  {
    // ⚠️ Le relevé (rév. 42) : « 1 % par 1 000 ATQ » vaut 1 % à 1 000 comme à
    // 1 800, et 2 % à 2 000 — JAMAIS au prorata.
    egal(tranchesAtteintes(999, 1000), 0, 'tranche non atteinte → 0 (999 pour 1 000)');
    egal(tranchesAtteintes(1000, 1000), 1, 'juste AU palier → 1 (1 000 pour 1 000)');
    egal(tranchesAtteintes(1800, 1000), 1, 'entre deux paliers → toujours 1, jamais au prorata (1 800 pour 1 000)');
    egal(tranchesAtteintes(2000, 1000), 2, 'palier suivant → 2 (2 000 pour 1 000)');
    // Aucun plafond : 120 tranches sont rendues telles quelles.
    egal(tranchesAtteintes(120_000, 1000), 120, 'aucun plafond sur le nombre de tranches (rév. 43)');
  }

  /* ── L'assiette Y — « au début du combat », sans buff ────────────────── */
  {
    // `statsDebutCombat` = total (base + runes + artéfacts + principale de
    // relique + sets) + ⌈base × (invocateur + lead) / 100⌉.
    // ATQ : 2 000 + ⌈2 000 × 20/100⌉ = 2 400. VIT : 200 + ⌈200 × 15/100⌉ = 230.
    const y = statsDebutCombat(statsDe(), SETUP, null);
    egal(y.atk, 2400, 'Y(ATQ) = 2 000 base + 20 % invocateur = 2 400');
    egal(y.def, 2160, 'Y(DEF) = 1 800 base + 20 % invocateur = 2 160');
    egal(y.hp, 30000, 'Y(PV) = 25 000 base + 20 % invocateur = 30 000');
    egal(y.spd, 230, 'Y(VIT) = 200 base + 15 % invocateur = 230');

    // La compétence élémentaire (+21 % ATQ) n'entre que pour un élément connu.
    egal(statsDebutCombat(statsDe(), SETUP, 'fire').atk, 2820, 'Y(ATQ) avec élément = 2 000 + 41 % = 2 820');
    egal(statsDebutCombat(statsDe(), SETUP, 'unknown').atk, 2400, "Y(ATQ) d'un élément inconnu ne reçoit pas le +21 %");

    // ⚠️ **Sans BUFF** : c'est ce qui distingue `statsDebutCombat` de
    // `statsDeCombat`. Buffs éteints, les deux coïncident exactement — c'est
    // l'extraction qui le garantit pour ATQ/DEF/PV, et cette assertion qui le
    // garantit pour la VIT, dont `maVitCombat` garde sa propre écriture.
    const sansBuff = statsDeCombat(statsDe(), SETUP, null);
    egal([sansBuff.atk, sansBuff.def, sansBuff.hp, sansBuff.spd], [y.atk, y.def, y.hp, y.spd], 'buffs éteints : statsDeCombat ≡ statsDebutCombat (VIT comprise)');
    egal(maVitCombat(statsDe(), SETUP, null), y.spd, 'VIT : le préfixe de maVitCombat est bien Y(VIT)');

    // Buff actif : `statsDeCombat` monte, l'assiette `Y` ne bouge PAS.
    const avecBuff = statsDeCombat(statsDe(), { ...SETUP, atkBuff: true }, null);
    ok(avecBuff.atk > y.atk, 'un buff ATQ fait monter statsDeCombat…');
    egal(statsDebutCombat(statsDe(), { ...SETUP, atkBuff: true }, null).atk, y.atk, '… et laisse Y(ATQ) inchangé — « au début du combat » exclut les buffs');
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
    const sans = computeSkillDamageDetail(p, st, SETUP, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {}, 0).total;
    const avec = computeSkillDamageDetail(p, st, SETUP, null, undefined, ARTIFACT_DAMAGE_NEUTRE, {}, 2).total;
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
    // l'équation, pas posé par analogie (B.7).
    egal(facteurTenacite(0), 1, 'réduction nulle → facteur 1, le score d’avant à l’identique');
    ok(Math.abs(facteurTenacite(1) - 1 / 0.99) < 1e-12, 'réduction de 1 % → facteur 1/0,99');
    const st = statsDe(tenacite);
    const attendu = pvEffectifs(st) / 0.99;
    const recu = objectiveScore({ runeIds: [], stats: st, effTotal: 0 }, 'ehp', undefined, apport(tenacite));
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
    egal(statsDebutCombat(rapide, SETUP, null).spd, 251, 'VIT de base 218 → Y(VIT) = 251, juste au-dessus du palier');
    egal(apportExclusive(bravoureVit, rapide, SETUP, null), { ...APPORT_NEUTRE, atk: 40 }, 'juste AU palier → +1 tranche, soit +2 % de l’ATQ de base (+40)');
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
    ok(objectiveScore({ runeIds: [], stats: st, effTotal: 0 }, 'ehp', undefined, apport(origine)) > pvEffectifs(st), 'le gain de PV d’Origine fait monter les PV effectifs');
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
    egal(objectiveScore({ runeIds: [], stats: st, effTotal: 0 }, 'ehp', undefined, APPORT_NEUTRE), pvEffectifs(st), 'apport neutre → objectiveScore(ehp) est exactement pvEffectifs');
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
      const a = apportExclusive(p, enorme, SETUP, null);
      const chiffre = JSON.stringify(a) !== JSON.stringify(APPORT_NEUTRE);
      if (chiffre === exclusiveChiffrable(type)) accord++;
      else ok(false, `type ${type} (${RELIC_UNIQUE[type]!.groupe}) : exclusiveChiffrable=${exclusiveChiffrable(type)} mais apport ${chiffre ? 'non neutre' : 'neutre'}`);
    }
    egal(accord, 16, 'les 16 types : exclusiveChiffrable ⟺ apportExclusive rend un apport non neutre');
    egal(exclusiveChiffrable(16), false, 'Régénération (16) n’est pas chiffrable — et n’est jamais pertinente, donc ne rend rien partiel');
    egal(exclusiveChiffrable(99), false, 'un type inconnu n’est pas chiffrable');
  }
}
