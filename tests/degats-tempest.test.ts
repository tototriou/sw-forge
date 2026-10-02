// Tempest (Teshar vent, Phoenix vent) — chantier degats-et-aura, lot 9a.
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un passif dont SWARFARM ne porte
// AUCUNE formule (`formule: ""`) écarté en silence par la garde historique
// `!c.formule` de `monsterOffensivePassives`, alors que sa formule curée
// existe dans `FORMULES_CUREES_PAR_ID`. Le joueur cocherait Tempest et ne
// verrait rien changer, sans aucun message.
//
// Valeurs de jeu (cadrage degats-et-aura, A.2 ter, utilisateur le 2026-09-23,
// concordant avec l'audit `other_skill=1181`) : `3.7 × ATQ`, en zone, trois
// améliorations « Damage +10% » (+30 %) appliquées à ses dégâts.

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { Competence, DetailMonstre } from '../src/lib/monsterSkills';
import {
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  DamageSetup,
  SkillDamageProfile,
  computeSkillDamage,
  computeTotalDamage,
  defaultDamageSkill,
  estPrisEnCharge,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifActif,
  skillDamageProfile,
  type PassifOffensifProfile,
} from '../src/lib/damage';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

const TESHAR = 14513;
const PHOENIX_VENT = 14503;
const TEMPEST = 3213;
const ARCANE_BLAST = 3203; // S1 de Teshar
const LIGHTNING_NOVA = 3208; // S2 de Teshar

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

// Profil de RÉFÉRENCE `1 × ATQ`, en zone, de slot 3 comme Tempest : un oracle
// indépendant de la table curée. Toute la chaîne de calcul étant linéaire en
// le coefficient, la contribution de Tempest doit valoir EXACTEMENT 3.7 fois
// celle d'une référence portant les MÊMES améliorations (+30 %), quel que soit
// le mode critique. ⚠️ Sans amélioration, le rapport ne vaut `3.7 × 1.30`
// qu'en « Non critique » : en critique, le modèle place les améliorations dans
// le même terme que les Dgts CRIT (additif), pas en facteur séparé.
function referenceUnAtq(skillupDamagePct: number): SkillDamageProfile {
  const c: Competence = {
    id: 1, com2usId: 1, nom: 'Référence', description: null, slot: 3, passif: false, aoe: true,
    cooldown: null, coups: 1, niveauMax: 1, formule: '1*{ATK}', scale: [], ameliorations: [],
    icone: null, effets: [],
  };
  const p = skillDamageProfile(c);
  if (!p || !estPrisEnCharge(p)) throw new Error('profil de référence illisible');
  return { ...p, skillupDamagePct };
}

function sortDe(detail: DetailMonstre, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(detail).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou non pris en charge`);
  return p;
}

function tempestDe(detail: DetailMonstre): PassifOffensifProfile | undefined {
  return monsterOffensivePassives(detail).find((p) => p.skillCom2usId === TEMPEST);
}

/** Point 1 — la formule curée d'un passif passe par la table curée. */
export function testDegatsTempestFormule() {
  titre('Tempest — la formule curée d’un passif sans formule SWARFARM est lue');

  for (const forme of [TESHAR, PHOENIX_VENT]) {
    const detail = fiche(forme);
    const brute = detail.competences.find((c) => c.com2usId === TEMPEST);
    ok(
      brute != null && brute.passif && brute.formule === '' && brute.aoe && brute.slot === 3,
      `${forme} : la donnée brute est bien un passif de slot 3, en zone, SANS formule (« » dans SWARFARM)`
    );
    const tempest = tempestDe(detail);
    ok(tempest != null, `${forme} : Tempest est reconnu comme passif offensif malgré « formule: "" » (formule de la table curée)`);
    if (!tempest) continue;
    egal(tempest.profile.formule, '3.7*{ATK}', `${forme} : formule retenue = 3.7 × ATQ (A.2 ter, utilisateur + audit other_skill=1181)`);
    egal(tempest.profile.variables, ['ATK'], `${forme} : la formule curée est analysée comme une formule de données (ATQ seule)`);
    egal(tempest.profile.skillupDamagePct, 30, `${forme} : les trois « Damage +10% » s’appliquent (+30 %, A.2 ter)`);
    egal(tempest.profile.aoe, true, `${forme} : en zone (donnée « aoe » du passif)`);
    egal(tempest.profile.slot, 3, `${forme} : slot 3 (celui des lignes d’artéfact 402/410)`);
    egal(tempest.profile.hits, 1, `${forme} : une seule instance (« once more »), jamais Competence.coups`);
    egal(tempest.profile.fixed, false, `${forme} : pas de dégâts fixes`);
    egal(tempest.profile.ignoreDef, false, `${forme} : n’ignore pas la DEF`);
    egal(tempest.categorie.type, 'conditionnel', `${forme} : interrupteur (recharge non simulée, A.2 ter)`);
    egal(tempest.critique, 'suit', `${forme} : critique comme le mode choisi`);
  }

  const teshar = fiche(TESHAR);
  egal(
    defaultDamageSkill(monsterDamageSkills(teshar))?.skillCom2usId,
    LIGHTNING_NOVA,
    'Teshar : la table curée ne fait pas de Tempest un sort — le sort par défaut reste le S2 (Lightning Nova)'
  );

  const tempest = tempestDe(teshar)!;
  const s2 = sortDe(teshar, LIGHTNING_NOVA);
  const st = stats({ atk: 3000, cr: 100, cd: 150 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: LIGHTNING_NOVA, summonerSkills: 'combat' };
  const passifs = monsterOffensivePassives(teshar);

  ok(!passifActif(tempest, base), 'Tempest désactivé par défaut, jamais deviné actif');
  egal(
    computeTotalDamage(s2, passifs, st, base, AUCUNE_AURA_PROPRE, null),
    computeSkillDamage(s2, st, base, AUCUNE_AURA_PROPRE, null),
    'interrupteur éteint : le total vaut le seul S2, au bit près'
  );

  const actif: DamageSetup = { ...base, passifsOffensifs: { [TEMPEST]: true } };
  const contributionTempest = (setup: DamageSetup) =>
    computeTotalDamage(s2, passifs, st, setup, AUCUNE_AURA_PROPRE, null) - computeSkillDamage(s2, st, setup, AUCUNE_AURA_PROPRE, null);
  for (const critMode of ['normal', 'crit', 'moyenne'] as const) {
    const setup = { ...actif, critMode };
    const rapport = contributionTempest(setup) / computeSkillDamage(referenceUnAtq(30), st, setup, AUCUNE_AURA_PROPRE, null);
    ok(
      Math.abs(rapport - 3.7) < 1e-9,
      `mode ${critMode} : interrupteur allumé, Tempest ajoute exactement 3.7 fois un « 1 × ATQ » de référence aux mêmes +30 % (reçu ${rapport.toFixed(6)})`
    );
  }
  const normal = { ...actif, critMode: 'normal' as const };
  const rapportSansAmelioration = contributionTempest(normal) / computeSkillDamage(referenceUnAtq(0), st, normal, AUCUNE_AURA_PROPRE, null);
  ok(
    Math.abs(rapportSansAmelioration - 3.7 * 1.3) < 1e-9,
    `« Non critique » : contre une référence SANS amélioration, le rapport vaut 3.7 × 1.30 — les +30 % comptent (reçu ${rapportSansAmelioration.toFixed(6)})`
  );
}
