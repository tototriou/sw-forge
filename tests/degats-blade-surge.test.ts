// Blade Surge — la séquence curée de trois coups et la cible secondaire
// (`spec/outils/degats-reels/sequences-de-coups.md`).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE ici : un troisième coup oublié (le
// calcul d'avant ne comptait que les deux coups mono-cible de la donnée), une
// ligne d'artéfact appliquée au mauvais coup (224 sur le coup de zone, 400 ou
// les skillups qui l'oublieraient, 411 rouvert pour la cible secondaire), ou
// une cible secondaire calculée par soustraction du premier cran. Chaque
// nombre attendu est écrit à la main depuis les valeurs curées (
// `spec/outils/degats-reels/valeurs-de-jeu-curees.md` : `0.5 × ATQ` ×2 mono-cible puis `3.0 × ATQ` en zone, +30 % de
// skillups sur les trois coups, 224 sur les coups 1 et 2, 400 sur les trois,
// 411 sur le premier coup du tour) ou comparé au chemin ordinaire d'un sort
// synthétique d'un seul groupe — jamais relu dans le code qui calcule.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre } from './outils';
import { StatRow } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { Competence, DetailMonstre } from '../src/lib/monsterSkills';
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
  skillDamageProfile,
} from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

// Totaux écrits à la main, base nulle : ni compétence d'invocateur, ni lead
// ne touchent l'ATQ (ils portent sur la base). ATQ de combat = 2 000.
function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

// Huit identifiants, onze formes ;
// les cinq candidats écartés restent hors famille.
const FAMILLE: Record<number, number[]> = {
  10601: [19801],
  10602: [19802, 19812],
  10603: [19803, 19823],
  10604: [19804, 19814],
  10605: [19805],
  10616: [19811],
  10618: [19813],
  10620: [19815],
};
const HORS_FAMILLE = [11015, 18314, 23507, 23508, 23510];
// Les autres porteurs d'une séquence curée : les quatre séquences dont la phase
// de zone vient de l'API, testées dans
// `degats-valeurs-api.test.ts`. Listés ici pour que le balayage du corpus
// continue de voir tout porteur inattendu.
const SEQUENCES_API: Record<number, number[]> = {
  13311: [22911],
  13314: [22914],
  14113: [24203, 24213],
  14613: [24703, 24713],
};
const LAPIS = 19811;
const BLADE_SURGE_LAPIS = 10616;

const ATQ = 2000;
const SKILLUP = 1.3; // « Damage +5% » ×3 et « +15% » : 30 % sur chacun des trois coups

function bladeSurge(forme: number, skillId: number): SkillDamageProfile {
  const p = monsterDamageSkills(fiche(forme)).find((s) => s.skillCom2usId === skillId);
  if (!p || !estPrisEnCharge(p)) throw new Error(`Blade Surge ${skillId} introuvable ou refusé sur ${forme}`);
  return p;
}

// Sort SYNTHÉTIQUE d'un seul groupe, calculé par le chemin ordinaire d'avant
// ce lot : la référence indépendante de chaque groupe de la séquence.
function sortSimple(formule: string, coups: number, aoe: boolean): SkillDamageProfile {
  const c: Competence = {
    id: 1, com2usId: 1, nom: 'Référence', description: null, slot: 1, passif: false, aoe,
    cooldown: null, coups, niveauMax: 5, formule, scale: ['ATK'],
    ameliorations: ['Damage +5%', 'Damage +5%', 'Damage +5%', 'Damage +15%'],
    icone: null, effets: [],
  };
  const p = skillDamageProfile(c);
  if (!p || !estPrisEnCharge(p)) throw new Error(`référence ${formule} refusée`);
  return p;
}

function artefacts(subs: { code: number; value: number }[]): ArtifactDamageProfile {
  const a: ArtifactDetail = { id: 0, kind: 'archetype', archetype: 'attack', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs };
  return artifactDamageProfile([a]);
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

export default function testDegatsBladeSurge() {
  titre('Blade Surge — la séquence curée couvre les huit identifiants et onze formes du lot 1b');

  // Balayage du corpus ENTIER, pas seulement de la liste : un sort porteur de
  // séquence hors famille, ou un porteur manquant, se verrait ici.
  const porteurs: Record<number, number[]> = {};
  const idsCapables = new Set<number>();
  for (const f of readdirSync(DOSSIER_SORTS).filter((n) => n.endsWith('.json'))) {
    const detail: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    for (const c of detail.competences) {
      if (c.com2usId != null && cibleSecondairePriseEnCharge(c.com2usId)) idsCapables.add(c.com2usId);
      const p = skillDamageProfile(c);
      if (p && estPrisEnCharge(p) && p.sequenceDeCoups) (porteurs[p.skillCom2usId] ??= []).push(detail.com2usId);
    }
  }
  for (const formes of Object.values(porteurs)) formes.sort((a, b) => a - b);
  egal(porteurs, { ...FAMILLE, ...SEQUENCES_API }, 'corpus : exactement les huit identifiants Blade Surge (et leurs onze formes) et les quatre séquences à valeur de l’API portent une séquence');
  egal(Object.keys(FAMILLE).flatMap((id) => porteurs[Number(id)] ?? []).length, 11, 'corpus : onze formes pour Blade Surge');
  egal([...idsCapables].sort((a, b) => a - b), Object.keys({ ...FAMILLE, ...SEQUENCES_API }).map(Number).sort((a, b) => a - b),
    'capacité « autres ennemis » : les huit identifiants Blade Surge et les quatre séquences à valeur de l’API, aucun autre sort du corpus');
  for (const id of HORS_FAMILLE) {
    ok(!cibleSecondairePriseEnCharge(id), `hors famille (lot 1b) : ${id} sans cible secondaire`);
  }

  for (const [id, formes] of Object.entries(FAMILLE)) {
    for (const forme of formes) {
      const p = bladeSurge(forme, Number(id));
      const resume = {
        nom: p.nom, slot: p.slot, formule: p.formule, hits: p.hits, aoe: p.aoe, skillup: p.skillupDamagePct,
        sequence: p.sequenceDeCoups?.map((g) => ({ coups: g.coups, zone: g.zone, formule: g.formule })),
      };
      egal(resume, {
        nom: 'Blade Surge', slot: 1, formule: '0.5*{ATK}', hits: 2, aoe: false, skillup: 30,
        sequence: [
          { coups: 2, zone: false, formule: '0.5*{ATK}' },
          { coups: 1, zone: true, formule: '3.0*{ATK}' },
        ],
      }, `${id} sur ${forme} : 2 × 0,5 ATQ mono-cible puis 3,0 ATQ en zone, skillups +30 %`);
      // Ce que la séquence ne modélise pas — vérifié absent sur chaque porteur.
      ok(!p.hitsRange && !p.effetsEntreCoups, `${id} sur ${forme} : ni coups variables ni effets entre coups`);
      egal(monsterOffensivePassives(fiche(forme)).length, 0, `${forme} : aucun passif offensif lié aux coups du sort actif`);
    }
  }

  titre('Blade Surge — la curation se refuse quand la donnée ne porte plus son empreinte (lot P6, SZ-1)');
  {
    const reelle = fiche(19812).competences.find((c) => c.com2usId === 10602)!;
    for (const [libelle, ecart] of [
      ['formule changée', { formule: '0.6*{ATK}' }],
      ['nombre de coups changé', { coups: 3 }],
      ['nombre de coups absent', { coups: null }],
      ['portée changée', { aoe: true }],
    ] as const) {
      const p = skillDamageProfile({ ...reelle, ...ecart });
      ok(!!p && !estPrisEnCharge(p) && p.raison.includes('ne correspond plus'), `${libelle} : sort refusé avec sa raison, jamais calculé sur une séquence périmée`);
    }
  }

  titre('Blade Surge — cible visée : les trois coups ; autres ennemis : le troisième seul');

  const st = stats({ atk: ATQ, cr: 100, cd: 100 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 100_000_000, enemyHpPct: 100 };
  const df = defenseFactor(1000);
  const visee = (s: DamageSetup) => s;
  const secondaire = (s: DamageSetup): DamageSetup => ({ ...s, cibleDegatsParSort: { [BLADE_SURGE_LAPIS]: 'secondaire' } });
  const bs = bladeSurge(LAPIS, BLADE_SURGE_LAPIS);
  const calcul = (s: DamageSetup, art: ArtifactDamageProfile = ARTIFACT_DAMAGE_NEUTRE, p: SkillDamageProfile = bs) =>
    computeSkillDamageDetail(p, st, s, AUCUNE_AURA_PROPRE, null, undefined, art);

  {
    const normal: DamageSetup = { ...base, critMode: 'normal' };
    const attenduVisee = ATQ * (0.5 * 2 + 3.0) * SKILLUP * df;
    const attenduSecondaire = ATQ * 3.0 * SKILLUP * df;
    ok(proche(calcul(visee(normal)).total, attenduVisee), `cible visée : 2 000 × (0,5 × 2 + 3,0) × 1,30 × FacteurDéf = ${attenduVisee.toFixed(2)}`);
    ok(proche(calcul(secondaire(normal)).total, attenduSecondaire), `autres ennemis : 2 000 × 3,0 × 1,30 × FacteurDéf = ${attenduSecondaire.toFixed(2)}`);
    // Si les skillups oubliaient le coup de zone, ou si le troisième coup
    // manquait (le calcul d'avant ce lot), on lirait ces deux nombres-là.
    ok(!proche(calcul(visee(normal)).total, ATQ * (0.5 * 2 * SKILLUP + 3.0) * df), 'skillups : le troisième coup en profite aussi');
    ok(!proche(calcul(visee(normal)).total, ATQ * 0.5 * 2 * SKILLUP * df), 'le troisième coup n’est plus oublié (constat 151)');
    egal(cibleDegatsRetenue(bs, visee(normal)), 'visee', 'clé absente : cible visée');
    egal(cibleDegatsRetenue(bs, secondaire(normal)), 'secondaire', 'clé « secondaire » : autres ennemis');
    egal(
      calcul({ ...normal, cibleDegatsParSort: { [BLADE_SURGE_LAPIS]: 'visee' } }).total,
      calcul(normal).total,
      'clé « visee » = clé absente'
    );

    // Les onze formes, chacune par son propre identifiant : visée / autres
    // ennemis = (0,5 × 2 + 3,0) / 3,0 sans artéfact.
    for (const [id, formes] of Object.entries(FAMILLE)) {
      for (const forme of formes) {
        const p = bladeSurge(forme, Number(id));
        const s2: DamageSetup = { ...normal, cibleDegatsParSort: { [Number(id)]: 'secondaire' } };
        const v = calcul(normal, ARTIFACT_DAMAGE_NEUTRE, p).total;
        const a = calcul(s2, ARTIFACT_DAMAGE_NEUTRE, p).total;
        ok(proche(v, attenduVisee) && proche(a, attenduSecondaire), `${id} sur ${forme} : trois coups sur la cible visée, le troisième seul sur un autre ennemi`);
      }
    }

    // Un cran secondaire posé sur un sort sans cette capacité est ignoré.
    const autreSort = monsterDamageSkills(fiche(LAPIS)).find((s) => s.slot === 2);
    ok(!!autreSort && estPrisEnCharge(autreSort) && !autreSort.sequenceDeCoups, 'Lapis S2 : un sort ordinaire, sans séquence');
    if (autreSort && estPrisEnCharge(autreSort)) {
      const s2: DamageSetup = { ...normal, cibleDegatsParSort: { [autreSort.skillCom2usId]: 'secondaire' } };
      egal(cibleDegatsRetenue(autreSort, s2), 'visee', 'sort sans coup de zone curé : la clé « secondaire » ne s’applique pas');
      egal(calcul(s2, ARTIFACT_DAMAGE_NEUTRE, autreSort).total, calcul(normal, ARTIFACT_DAMAGE_NEUTRE, autreSort).total, '… et ne change rien au calcul');
    }
  }

  titre('Blade Surge — 224 sur les coups 1 et 2, 400 sur les trois, 411 sur le premier coup du tour');
  {
    const crit: DamageSetup = { ...base, critMode: 'crit' };
    const gain = (art: ArtifactDamageProfile, s: DamageSetup) => calcul(s, art).total - calcul(s).total;
    // Critique forcé : 30 points de Dgts Crit valent `m × ATQ × 0,30 × FacteurDéf`
    // sur un coup de multiplicateur m, quel que soit le reste du terme.
    const sur = (m: number) => ATQ * m * 0.3 * df;
    const a224 = artefacts([{ code: 224, value: 30 }]);
    const a400 = artefacts([{ code: 400, value: 30 }]);
    const a411 = artefacts([{ code: 411, value: 30 }]);
    ok(proche(gain(a224, visee(crit)), sur(0.5 * 2)), '224, cible visée : les deux coups mono-cible seulement, jamais le coup de zone');
    ok(proche(gain(a224, secondaire(crit)), 0), '224, autres ennemis : rien — le seul coup reçu est en zone');
    ok(proche(gain(a400, visee(crit)), sur(0.5 * 2 + 3.0)), '400 ([Comp.1]), cible visée : les trois coups');
    ok(proche(gain(a400, secondaire(crit)), sur(3.0)), '400, autres ennemis : le coup de zone en profite');
    ok(proche(gain(a411, visee(crit)), sur(0.5)), '411, cible visée : le premier coup seulement');
    ok(proche(gain(a411, secondaire(crit)), 0), '411, autres ennemis : jamais — la première attaque du tour a eu lieu sur la cible visée');

    // Le score réel (sort + passifs) ne rouvre pas 411 non plus.
    const total = (s: DamageSetup, art: ArtifactDamageProfile) =>
      computeTotalDamage(bs, monsterOffensivePassives(fiche(LAPIS)), st, s, AUCUNE_AURA_PROPRE, null, art);
    egal(total(secondaire(crit), a411), total(secondaire(crit), ARTIFACT_DAMAGE_NEUTRE), 'computeTotalDamage, autres ennemis : 411 sans effet');
    ok(proche(total(visee(crit), a411), calcul(visee(crit), a411).total), 'computeTotalDamage, cible visée : le sort seul (Lapis n’a aucun passif offensif)');
  }

  titre('Blade Surge — chaque cran a ses propres PV (222/223) et chaque coup sa part additionnelle');
  {
    // Cible petite : les deux premiers coups creusent réellement ses PV.
    const petite: DamageSetup = { ...base, critMode: 'crit', enemyHp: 20_000, enemyHpPct: 100 };
    const a222 = artefacts([{ code: 222, value: 30 }]);
    const a223 = artefacts([{ code: 223, value: 30 }]);
    const deuxCoups = sortSimple('0.5*{ATK}', 2, false);
    const coupDeZone = sortSimple('3.0*{ATK}', 1, true);
    const ref = (p: SkillDamageProfile, pv: number | undefined, art: ArtifactDamageProfile) =>
      computeSkillDamageDetail(p, st, petite, AUCUNE_AURA_PROPRE, null, pv, art);

    const r12 = ref(deuxCoups, undefined, a222);
    const r3SurVisee = ref(coupDeZone, r12.pvRestantsPct, a222);
    const r3Frais = ref(coupDeZone, undefined, a222);
    const v = calcul(visee(petite), a222);
    const a = calcul(secondaire(petite), a222);
    ok(r12.pvRestantsPct < 100, 'la cible visée est entamée par les deux premiers coups');
    ok(proche(v.total, r12.total + r3SurVisee.total), '222, cible visée : le coup de zone lit les PV laissés par les coups 1 et 2');
    ok(proche(v.pvRestantsPct, r3SurVisee.pvRestantsPct), 'cible visée : PV restants après les trois coups');
    ok(proche(a.total, r3Frais.total), '222, autres ennemis : le coup de zone lit les PV saisis, jamais creusés par les coups mono-cible');
    ok(proche(a.pvRestantsPct, r3Frais.pvRestantsPct), 'autres ennemis : PV restants après le seul coup de zone');
    ok(r3Frais.total > r3SurVisee.total, '… et ce n’est pas la part du coup de zone dans le premier cran (pas de soustraction)');
    egal(calcul(secondaire(petite), a223).total, calcul(secondaire(petite)).total, '223, autres ennemis à pleine vie : rien');

    // 219 « Dgts supp. en prop. de l'ATQ » : brut, à CHAQUE coup.
    const a219 = artefacts([{ code: 219, value: 10 }]);
    egal(calcul(visee(petite), a219).additionnel, 600, 'additionnel, cible visée : trois coups × 10 % de 2 000 d’ATQ = 600');
    egal(calcul(secondaire(petite), a219).additionnel, 200, 'additionnel, autres ennemis : un seul coup = 200');
  }

  titre('Blade Surge — le réglage est une donnée pure, propre au sort');
  {
    egal(DAMAGE_SETUP_CLASSIFICATION.cibleDegatsParSort, 'sort', 'cibleDegatsParSort classé « sort »');
    const choisi: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 2345, cibleDegatsParSort: { [BLADE_SURGE_LAPIS]: 'secondaire' } };
    const apres = damageSetupApresChangementMonstre(choisi);
    egal(apres.cibleDegatsParSort, undefined, 'espèce différente : choix de cible vidé…');
    egal(apres.enemyDef, 2345, '… le contexte de la cible conservé');
    egal(DEFAULT_DAMAGE_SETUP.cibleDegatsParSort, undefined, 'import de compte (défaut complet) : aucun choix, donc cible visée');
    const profilClone = structuredClone(bs);
    const setupClone = structuredClone(choisi);
    egal(profilClone, bs, 'le profil et sa séquence traversent un clonage structuré');
    egal(setupClone.cibleDegatsParSort, choisi.cibleDegatsParSort, 'le réglage aussi');
    egal(
      computeSkillDamageDetail(profilClone, st, setupClone, AUCUNE_AURA_PROPRE).total,
      computeSkillDamageDetail(bs, st, choisi, AUCUNE_AURA_PROPRE).total,
      'calcul identique après clonage'
    );
  }
}
