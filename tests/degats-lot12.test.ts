// Les trois mécanismes rejoués sur des cas
// INDÉPENDANTS de ceux qui les ont fait naître (Blade Surge, Tempest, Blade
// Dancers). Aucun code de production n'est touché : chaque cas est fourni
// DANS CE TEST.
//
// ⚠️ Deux sortes de cas, jamais mélangées :
// - RÉEL : la fiche existe dans `public/data/skills`, ses valeurs sont celles de
//   SWARFARM (formule, coups, améliorations) et ses décisions de produit celles
//   des valeurs curées (`spec/outils/degats-reels/valeurs-de-jeu-curees.md`). C'est le cas de l'attaque déclenchée (sorts S2 qui appellent leur S1 :
//   RYU, Douglas, Kashmir, Vancliffe, Striker…).
// - SYNTHÉTIQUE : aucune fiche ne porte ces coefficients ; la fixture est ANNONCÉE
//   comme telle et ne valide AUCUNE mécanique du jeu — seulement que le
//   mécanisme générique ne dépend pas de la forme du cas qui l'a fait naître.
//   C'est le cas de la séquence de coups et de
//   l'ignore DEF depuis un coup (aucun autre cas réel dans le corpus).
//
// Chaque nombre attendu est écrit à la main depuis ces valeurs, ou comparé au
// chemin ORDINAIRE d'un sort d'un seul groupe — jamais relu dans le code qui
// calcule la séquence, la découpe ou la boucle des passifs.

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
  IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID,
  type ArtifactDamageProfile,
  type DamageSetup,
  type GroupeDeCoups,
  type IgnoreDefAPartirDuCoupProfile,
  type PassifOffensifProfile,
  type SkillDamageProfile,
  artifactDamageProfile,
  cibleDegatsRetenue,
  cibleSecondairePriseEnCharge,
  computeSkillDamage,
  computeSkillDamageDetail,
  computeTotalDamage,
  cranIgnoreDefRetenu,
  cransIgnoreDefAPartirDuCoup,
  defenseFactor,
  estPrisEnCharge,
  monsterCombatStatProfiles,
  monsterDamageSkills,
  monsterOffensivePassives,
  passifCompte,
  passifPeutSuivre,
  resolvedPremierCoupIgnoreDef,
  resumeIgnoreDefRetenu,
  resumeSequenceDeCoups,
  skillDamageProfile,
} from '../src/lib/damage';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { clesProseDejaRendue, renduStatsCombat } from '../src/lib/proseStatsCombat';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

function artefacts(subs: { code: number; value: number }[]): ArtifactDamageProfile {
  const a: ArtifactDetail = { id: 0, kind: 'archetype', archetype: 'attack', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs };
  return artifactDamageProfile([a]);
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// Sort SYNTHÉTIQUE d'un seul groupe (slot 1, +30 % de skillups) : le chemin
// ordinaire, référence indépendante de chaque groupe d'une séquence.
function sortSimple(formule: string, coups: number, aoe: boolean, id = 999_012): SkillDamageProfile {
  const c: Competence = {
    id: 1, com2usId: id, nom: 'Fixture lot 12', description: null, slot: 1, passif: false, aoe,
    cooldown: null, coups, niveauMax: 5, formule, scale: ['ATK'],
    ameliorations: ['Damage +5%', 'Damage +5%', 'Damage +5%', 'Damage +15%'],
    icone: null, effets: [],
  };
  const p = skillDamageProfile(c);
  if (!p || !estPrisEnCharge(p)) throw new Error(`référence ${formule} refusée`);
  return p;
}

// ── Mécanisme 8 — séquence de coups : fixture SYNTHÉTIQUE ───────────────────

type GroupeFixture = { coef: number; coups: number; zone: boolean };

const ATQ = 2000;
const SKILLUP = 1.3;

// FIXTURE SYNTHÉTIQUE X : le PREMIER coup est en zone (Blade Surge : jamais).
//   1,2 × ATQ ×1 zone · 0,4 × ATQ ×2 cible unique · 2,5 × ATQ ×1 zone.
const X: GroupeFixture[] = [
  { coef: 1.2, coups: 1, zone: true },
  { coef: 0.4, coups: 2, zone: false },
  { coef: 2.5, coups: 1, zone: true },
];
// FIXTURE SYNTHÉTIQUE Y : quatre groupes, portées ENTRELACÉES, premier groupe à
// deux coups (411 ne vaut que pour le premier des deux).
//   0,9 ×2 cible unique · 1,7 ×1 zone · 0,5 ×1 cible unique · 3,3 ×2 zone.
const Y: GroupeFixture[] = [
  { coef: 0.9, coups: 2, zone: false },
  { coef: 1.7, coups: 1, zone: true },
  { coef: 0.5, coups: 1, zone: false },
  { coef: 3.3, coups: 2, zone: true },
];
// FIXTURE SYNTHÉTIQUE Z : aucun coup de zone — la cible secondaire ne s'y applique pas.
const Z: GroupeFixture[] = [
  { coef: 0.7, coups: 2, zone: false },
  { coef: 1.4, coups: 1, zone: false },
];

const formuleDe = (g: GroupeFixture) => `${g.coef}*{ATK}`;
const somme = (gs: GroupeFixture[], garde: (g: GroupeFixture) => boolean = () => true) =>
  gs.filter(garde).reduce((s, g) => s + g.coef * g.coups, 0);

// Le profil d'un sort à séquence curée, construit comme `skillDamageProfile` le
// fait pour Blade Surge : le premier groupe donne formule/coups/portée du profil
// (la donnée), la séquence porte tous les groupes (`formule`, `noeud` et
// `variables` lus par l'analyse d'un sort ordinaire).
function sortASequence(groupes: GroupeFixture[], id: number): SkillDamageProfile {
  const premier = sortSimple(formuleDe(groupes[0]), groupes[0].coups, groupes[0].zone, id);
  const sequenceDeCoups: GroupeDeCoups[] = groupes.map((g) => {
    const p = sortSimple(formuleDe(g), g.coups, g.zone, id);
    return { coups: g.coups, zone: g.zone, formule: formuleDe(g), variables: p.variables, noeud: p.noeud };
  });
  return { ...premier, sequenceDeCoups };
}

export function testLot12SequenceDeCoups() {
  titre('Lot 12, mécanisme 8 — séquence de coups : fixtures SYNTHÉTIQUES X, Y, Z (aucune valeur de jeu)');

  const st = stats({ atk: ATQ, cr: 100, cd: 100 });
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 100_000_000, enemyHpPct: 100 };
  const df = defenseFactor(1000);
  const normal: DamageSetup = { ...base, critMode: 'normal' };
  const crit: DamageSetup = { ...base, critMode: 'crit' };
  const sur = (m: number) => ATQ * m * 0.3 * df; // 30 points de Dgts CRIT sur un coup de multiplicateur m, critique forcé
  const secondaire = (s: DamageSetup, id: number): DamageSetup => ({ ...s, cibleDegatsParSort: { [id]: 'secondaire' } });
  const calcul = (p: SkillDamageProfile, s: DamageSetup, art: ArtifactDamageProfile = ARTIFACT_DAMAGE_NEUTRE) =>
    computeSkillDamageDetail(p, st, s, AUCUNE_AURA_PROPRE, null, undefined, art);

  const cas: { nom: string; groupes: GroupeFixture[]; id: number }[] = [
    { nom: 'X (premier coup en zone)', groupes: X, id: 999_012 },
    { nom: 'Y (portées entrelacées)', groupes: Y, id: 999_013 },
  ];
  for (const { nom, groupes, id } of cas) {
    const p = sortASequence(groupes, id);
    const tout = somme(groupes);
    const zone = somme(groupes, (g) => g.zone);
    const mono = somme(groupes, (g) => !g.zone);
    const coupsZone = groupes.filter((g) => g.zone).reduce((n, g) => n + g.coups, 0);
    const coupsTotal = groupes.reduce((n, g) => n + g.coups, 0);

    titre(`Lot 12, mécanisme 8 — fixture ${nom} : cible visée et autres ennemis`);
    ok(!cibleSecondairePriseEnCharge(id), `${nom} : hors de la table curée (la capacité lue par l’écran et la recette est dans la table, pas dans ce profil)`);
    egal(cibleDegatsRetenue(p, normal), 'visee', `${nom} : clé absente, cible visée`);
    egal(cibleDegatsRetenue(p, secondaire(normal, id)), 'secondaire', `${nom} : clé « secondaire », la capacité vient du profil (un groupe de zone)`);
    ok(proche(calcul(p, normal).total, ATQ * tout * SKILLUP * df), `${nom}, cible visée : ${(ATQ * tout * SKILLUP * df).toFixed(2)} = 2 000 × ${tout.toFixed(1)} × 1,30 × FacteurDéf`);
    ok(proche(calcul(p, secondaire(normal, id)).total, ATQ * zone * SKILLUP * df), `${nom}, autres ennemis : ${(ATQ * zone * SKILLUP * df).toFixed(2)} = 2 000 × ${zone.toFixed(1)} × 1,30 × FacteurDéf (les seuls groupes de zone)`);
    egal(resumeSequenceDeCoups(p.sequenceDeCoups!), groupes.map((g) => `${g.coups} coup${g.coups > 1 ? 's' : ''} · ${g.zone ? 'Zone' : 'Cible unique'}`).join(', puis '),
      `${nom} : le résumé dit la séquence entière, dans l’ordre`);

    titre(`Lot 12, mécanisme 8 — fixture ${nom} : 224 selon la portée, 400 sur tous les coups, 411 selon le rang du tour`);
    const gain = (art: ArtifactDamageProfile, s: DamageSetup) => calcul(p, s, art).total - calcul(p, s).total;
    const a224 = artefacts([{ code: 224, value: 30 }]);
    const a400 = artefacts([{ code: 400, value: 30 }]);
    const a411 = artefacts([{ code: 411, value: 30 }]);
    ok(proche(gain(a224, crit), sur(mono)), `${nom}, 224, cible visée : les coups de cible unique seulement (${mono.toFixed(1)} × ATQ), jamais un coup de zone`);
    ok(proche(gain(a224, secondaire(crit, id)), 0), `${nom}, 224, autres ennemis : rien — tous les coups reçus sont en zone`);
    ok(proche(gain(a400, crit), sur(tout)), `${nom}, 400 ([Comp.1], slot 1), cible visée : tous les coups (${tout.toFixed(1)} × ATQ)`);
    ok(proche(gain(a400, secondaire(crit, id)), sur(zone)), `${nom}, 400, autres ennemis : les coups de zone`);
    // 411 : le PREMIER coup du tour — un seul coup, même si le premier groupe en compte deux.
    const premier = groupes[0].coef;
    ok(proche(gain(a411, crit), sur(premier)), `${nom}, 411, cible visée : un seul coup, le premier du tour (${premier} × ATQ)`);
    ok(!proche(gain(a411, crit), sur(premier * groupes[0].coups)) || groupes[0].coups === 1, `${nom}, 411 : jamais sur chaque coup du premier groupe`);
    const attendu411Secondaire = groupes[0].zone ? sur(premier) : 0;
    ok(proche(gain(a411, secondaire(crit, id)), attendu411Secondaire),
      groupes[0].zone
        ? `${nom}, 411, autres ennemis : le premier coup du tour est en zone, chaque ennemi qui le reçoit en profite (A.2 ter) — ${premier} × ATQ`
        : `${nom}, 411, autres ennemis : jamais — le premier coup du tour, de cible unique, n’est pas reçu par un autre ennemi`);
    // Le score réel (sort + passifs, aucun ici) lit la même règle.
    const total = (s: DamageSetup, art: ArtifactDamageProfile) => computeTotalDamage(p, [], st, s, AUCUNE_AURA_PROPRE, null, art);
    ok(proche(total(secondaire(crit, id), a411) - total(secondaire(crit, id), ARTIFACT_DAMAGE_NEUTRE), attendu411Secondaire), `${nom}, computeTotalDamage, autres ennemis : même 411`);
    ok(proche(total(crit, a411) - total(crit, ARTIFACT_DAMAGE_NEUTRE), sur(premier)), `${nom}, computeTotalDamage, cible visée : même 411`);

    titre(`Lot 12, mécanisme 8 — fixture ${nom} : PV de la cible secondaire non creusés par les coups de cible unique`);
    // Cible petite : chaque groupe creuse réellement ses PV, 222 le lit.
    const petite: DamageSetup = { ...crit, enemyHp: 20_000, enemyHpPct: 100 };
    const a222 = artefacts([{ code: 222, value: 30 }]);
    const ref = (g: GroupeFixture, pv: number | undefined) =>
      computeSkillDamageDetail(sortSimple(formuleDe(g), g.coups, g.zone, id), st, petite, AUCUNE_AURA_PROPRE, null, pv, a222);
    let pv: number | undefined;
    let totalVisee = 0;
    for (const g of groupes) { const r = ref(g, pv); totalVisee += r.total; pv = r.pvRestantsPct; }
    const pvVisee = pv!;
    let pvSec: number | undefined;
    let totalSec = 0;
    for (const g of groupes.filter((g) => g.zone)) { const r = ref(g, pvSec); totalSec += r.total; pvSec = r.pvRestantsPct; }
    const v = calcul(p, petite, a222);
    const a = calcul(p, secondaire(petite, id), a222);
    ok(pvVisee < 100 && pvVisee > 5, `${nom} : la cible visée est bien entamée sans être tuée (${pvVisee.toFixed(1)} % restants)`);
    ok(proche(v.total, totalVisee) && proche(v.pvRestantsPct, pvVisee), `${nom}, 222, cible visée : chaque groupe lit les PV laissés par les précédents, mono-cible compris`);
    ok(proche(a.total, totalSec) && proche(a.pvRestantsPct, pvSec!), `${nom}, 222, autres ennemis : les groupes de zone s’enchaînent sur les PV SAISIS, sans jamais compter les coups de cible unique`);
    // Le résultat n'est pas la soustraction du premier cran : on retire à la cible visée les groupes de cible unique.
    let sansCreuser = 0;
    let pvMono: number | undefined;
    for (const g of groupes) {
      const r = ref(g, pvMono); pvMono = r.pvRestantsPct;
      if (!g.zone) sansCreuser += r.total;
    }
    ok(!proche(a.total, totalVisee - sansCreuser), `${nom} : « autres ennemis » n’est pas « cible visée moins les coups de cible unique » (leurs PV ne sont pas creusés par eux)`);
    // 219 : brut, à CHAQUE coup reçu.
    const a219 = artefacts([{ code: 219, value: 10 }]);
    ok(proche(calcul(p, petite, a219).additionnel, coupsTotal * 0.1 * ATQ), `${nom}, additionnel, cible visée : ${coupsTotal} coups × 10 % de l’ATQ`);
    ok(proche(calcul(p, secondaire(petite, id), a219).additionnel, coupsZone * 0.1 * ATQ), `${nom}, additionnel, autres ennemis : ${coupsZone} coups de zone seulement`);
  }

  titre('Lot 12, mécanisme 8 — fixture Z (aucun coup de zone) : le cran « autres ennemis » ne s’applique pas');
  const pz = sortASequence(Z, 999_014);
  egal(cibleDegatsRetenue(pz, secondaire(normal, 999_014)), 'visee', 'Z : clé « secondaire » sur une séquence sans zone, cible visée retenue');
  ok(proche(calcul(pz, secondaire(normal, 999_014)).total, calcul(pz, normal).total), 'Z : le total ne change pas');
  ok(proche(calcul(pz, normal).total, ATQ * somme(Z) * SKILLUP * df), 'Z : tous les coups comptés');
}

// ── Mécanisme 9 — S2 déclenche S1 (RYU, Striker) ────────────────────────────

// Les six compétences S2 qui appellent leur S1,
// leur forme éveillée jouable et la S1 que la prose de la S2 nomme entre
// crochets. Liste écrite À LA MAIN depuis les fiches : la prose ne sert jamais de
// discriminant automatique (game-data-curation § 4).
const CAS_178: { forme: number; monstre: string; s2: [number, string]; s1: [number, string] }[] = [
  { forme: 24012, monstre: 'RYU feu', s2: [13907, 'Shoryuken'], s1: [13902, 'Hadoken'] },
  { forme: 24013, monstre: 'RYU vent', s2: [13908, 'Shoryuken'], s1: [13903, 'Hadoken'] },
  { forme: 24015, monstre: 'RYU ténèbres', s2: [13910, 'Shoryuken'], s1: [13905, 'Hadoken'] },
  { forme: 24512, monstre: 'Douglas feu', s2: [14407, 'Iron Uppercut'], s1: [14402, 'Mach Punch'] },
  { forme: 24513, monstre: 'Kashmir vent', s2: [14408, 'Iron Uppercut'], s1: [14403, 'Mach Punch'] },
  { forme: 24515, monstre: 'Vancliffe ténèbres', s2: [14410, 'Iron Uppercut'], s1: [14405, 'Mach Punch'] },
];
const S2_COEF = 6.1;
const S1_COEF = 3.7;
const SKILLUP_178 = 1.25; // Damage +5 %, +5 %, +15 % sur S2 comme sur S1 (les « Effect Rate » ne sont pas des dégâts)

function sortDe(detail: DetailMonstre, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(detail).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou non pris en charge`);
  return p;
}

// Ce que la table d'une future « attaque appelée » fournirait : le profil de la
// S1 lu par `skillDamageProfile` (SA fiche), les slots déclencheurs, un
// interrupteur. Construit ICI à la main, au format de `PassifOffensifProfile`
// (donnée pure) : le chemin d'approvisionnement de production
// (`monsterOffensivePassives`) ne sait pas l'établir.
function attaqueAppelee(s1: SkillDamageProfile, slotsDeclencheurs: readonly number[]): PassifOffensifProfile {
  return {
    skillCom2usId: s1.skillCom2usId,
    nom: s1.nom,
    description: s1.description,
    critique: 'suit',
    coupsDuSortActif: false,
    slotsDeclencheurs,
    categorie: { type: 'conditionnel', condition: 'la compétence appelée se déclenche à la suite du sort (probabilité non tirée : interrupteur, A.2 ter)' },
    profile: s1,
  };
}

export function testLot12AttaqueDeclenchee() {
  titre('Lot 12, mécanisme 9 — constat 178 : les six S2 déclenchent leur S1 (valeurs de SWARFARM, interrupteur du cadrage A.2 ter)');

  const st = stats({ atk: ATQ, cr: 100, cd: 100 });
  const df = defenseFactor(1000);
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 100_000_000, enemyHpPct: 100, critMode: 'normal' };

  for (const c of CAS_178) {
    const detail = fiche(c.forme);
    const brutS1 = detail.competences.find((k) => k.com2usId === c.s1[0]);
    const brutS2 = detail.competences.find((k) => k.com2usId === c.s2[0]);
    ok(!!brutS1 && !!brutS2 && brutS1.slot === 1 && brutS2.slot === 2 && !brutS1.passif && !brutS2.passif && brutS1.nom === c.s1[1] && brutS2.nom === c.s2[1],
      `${c.monstre} (${c.forme}) : S1 « ${c.s1[1]} » (${c.s1[0]}) et S2 « ${c.s2[1]} » (${c.s2[0]}), deux compétences ACTIVES`);
    ok(!!brutS2 && (brutS2.description ?? '').includes(`[${c.s1[1]}] will be activated in succession`),
      `${c.monstre} : la prose de la S2 nomme la S1 entre crochets, « activated in succession »`);

    const s1 = sortDe(detail, c.s1[0]);
    const s2 = sortDe(detail, c.s2[0]);
    egal([s2.formule, s2.hits, s2.aoe, s2.skillupDamagePct], [`${S2_COEF}*{ATK}`, 1, false, 25], `${c.monstre} : S2 = ${S2_COEF} × ATQ, un coup, cible unique, +25 %`);
    egal([s1.formule, s1.hits, s1.aoe, s1.skillupDamagePct], [`${S1_COEF}*{ATK}`, 1, false, 25], `${c.monstre} : S1 = ${S1_COEF} × ATQ, un coup, cible unique, +25 % (ses propres améliorations)`);

    const appelee = attaqueAppelee(s1, [2]);
    const reglage = (s: SkillDamageProfile, actif: boolean): DamageSetup => ({ ...base, skillCom2usId: s.skillCom2usId, passifsOffensifs: actif ? { [s1.skillCom2usId]: true } : {} });
    const total = (s: SkillDamageProfile, actif: boolean, art = ARTIFACT_DAMAGE_NEUTRE, setup = reglage(s, actif)) =>
      computeTotalDamage(s, [appelee], st, setup, AUCUNE_AURA_PROPRE, null, art);

    ok(passifPeutSuivre(appelee, s2), `${c.monstre} : la S1 appelée peut suivre la S2`);
    ok(!passifPeutSuivre(appelee, s1), `${c.monstre} : jamais ajoutée à elle-même quand la S1 est le sort choisi (même identifiant)`);
    ok(passifCompte(appelee, s2, reglage(s2, true)) && !passifCompte(appelee, s2, reglage(s2, false)), `${c.monstre} : compte seulement interrupteur allumé`);
    ok(!passifCompte(appelee, s1, reglage(s1, true)), `${c.monstre} : S1 choisie, interrupteur resté allumé : une seule contribution`);
    const s3Fictif: SkillDamageProfile = { ...s2, slot: 3, skillCom2usId: 999_003 };
    ok(!passifPeutSuivre(appelee, s3Fictif), `${c.monstre} : sort fictif de slot 3 : la S1 appelée ne suit pas (slots déclencheurs [2])`);

    const seule = ATQ * S2_COEF * SKILLUP_178 * df;
    const appeleeSeule = ATQ * S1_COEF * SKILLUP_178 * df;
    ok(proche(total(s2, false), seule), `${c.monstre} : interrupteur éteint, la S2 seule (${seule.toFixed(2)})`);
    ok(proche(total(s2, true), seule + appeleeSeule), `${c.monstre} : interrupteur allumé, S2 + S1 appelée = 2 000 × (${S2_COEF} + ${S1_COEF}) × 1,25 × FacteurDéf = ${(seule + appeleeSeule).toFixed(2)}`);
    ok(proche(total(s1, true), appeleeSeule), `${c.monstre} : S1 choisie seule = ${appeleeSeule.toFixed(2)}`);
    // Les améliorations de chaque compétence sont les SIENNES : celles de la S2 ne passent pas à la S1.
    const s2Autre: SkillDamageProfile = { ...s2, skillupDamagePct: 50 };
    ok(proche(total(s2Autre, true) - total(s2Autre, false), appeleeSeule), `${c.monstre} : la contribution de la S1 ne dépend pas des améliorations de la S2`);

    // Lignes d'artéfact, critique forcé : 30 points de Dgts CRIT sur un coup de multiplicateur m.
    const crit: DamageSetup = { ...reglage(s2, true), critMode: 'crit' };
    const sur = (m: number) => ATQ * m * 0.3 * df;
    const gain = (code: number) => {
      const art = artefacts([{ code, value: 30 }]);
      return total(s2, true, art, crit) - total(s2, true, ARTIFACT_DAMAGE_NEUTRE, crit);
    };
    ok(proche(gain(224), sur(S2_COEF + S1_COEF)), `${c.monstre} : 224 (cible unique) vaut pour la S2 ET la S1 appelée, toutes deux en cible unique`);
    ok(proche(gain(400), sur(S1_COEF)), `${c.monstre} : 400 ([Comp.1]) : la S1 appelée seule — la ligne de SON slot`);
    ok(proche(gain(401), sur(S2_COEF)), `${c.monstre} : 401 ([Comp.2]) : la S2 seule — la S1 appelée n’hérite pas de la ligne de son déclencheur`);
    ok(proche(gain(411), sur(S2_COEF)), `${c.monstre} : 411 : la S2 seule, première attaque du tour — jamais la S1 appelée`);
    ok(proche(gain(402), 0) && proche(gain(410), 0), `${c.monstre} : 402 et 410 (slot 3) : rien, aucune des deux n’est de slot 3`);

    // 222 : la S1 appelée lit les PV que la S2 laisse.
    const petite: DamageSetup = { ...reglage(s2, true), critMode: 'crit', enemyHp: 40_000, enemyHpPct: 100 };
    const a222 = artefacts([{ code: 222, value: 30 }]);
    const refS2 = computeSkillDamageDetail(s2, st, petite, AUCUNE_AURA_PROPRE, null, undefined, a222);
    const refS1 = computeSkillDamageDetail(s1, st, petite, AUCUNE_AURA_PROPRE, null, refS2.pvRestantsPct, a222);
    const refS1Frais = computeSkillDamageDetail(s1, st, petite, AUCUNE_AURA_PROPRE, null, undefined, a222);
    ok(refS2.pvRestantsPct > 5 && refS2.pvRestantsPct < 95 && refS1.total !== refS1Frais.total, `${c.monstre} : la S2 entame la cible, la S1 appelée en voit l’effet sur 222`);
    ok(proche(total(s2, true, a222, petite), refS2.total + refS1.total), `${c.monstre} : 222 : la S1 appelée lit les PV laissés par la S2, pas ceux du réglage`);
  }

  titre('Lot 12, mécanisme 9 — voisinage : la prose « activated in succession » dans le corpus (inventaire, jamais une règle de calcul)');
  // Balayage COMPLET du corpus (game-data-curation § 1), pour que toute nouvelle
  // compétence qui en appelle une autre soit CLASSÉE avant d'être ignorée. Ce
  // n'est PAS un discriminant : le calcul ne lit jamais cette prose.
  const porteurs = new Map<number, string>();
  for (const f of readdirSync(DOSSIER_SORTS).filter((n) => n.endsWith('.json'))) {
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    for (const k of d.competences) {
      if (k.com2usId != null && /activated in succession/i.test(k.description ?? '')) porteurs.set(k.com2usId, `${k.nom} S${k.slot}${k.passif ? ' (passif)' : ''}`);
    }
  }
  const ids = [...porteurs.keys()].sort((a, b) => a - b);
  egal(ids, [8201, 8202, 8203, 8204, 8205, 13907, 13908, 13910, 14407, 14408, 14410, 22512, 23012],
    'corpus : treize identifiants appellent une autre compétence « in succession » — Energy Ball ×5 (Kung Fu Girls), Shoryuken ×3 et Iron Uppercut ×3 (constat 178), Blood Talon et Heaven’s Might (passifs, condition sur les buffs de la cible)');
  egal(CAS_178.map((c) => c.s2[0]).sort((a, b) => a - b), ids.filter((i) => i >= 13907 && i <= 14410), 'les six S2 du constat 178 sont exactement les six porteurs Shoryuken / Iron Uppercut');
}

// ── Mécanisme 10 — ignore DEF depuis un coup choisi : fixture SYNTHÉTIQUE ────

// Aucun autre sort du corpus n'ignore la DEF « à partir d'un coup » :
// deux règles SYNTHÉTIQUES, de forme
// différente des variantes A et B (3 et 7 coups) des Blade Dancers.
//   C : 5 coups à 1,1 × ATQ, rangs 2 à 5, 5ᵉ coup toujours ignoré (défaut : lui seul)
//   E : 4 coups à 0,7 × ATQ, rangs 3 et 4 SEULEMENT, aucun coup inconditionnel
const ID_C = 99_012_001;
const ID_E = 99_012_002;
const REGLE_C: IgnoreDefAPartirDuCoupProfile = { coups: 5, rangsPermis: [2, 3, 4, 5], dernierCoupInconditionnel: 5, source: 'FIXTURE SYNTHÉTIQUE du lot 12 — aucune valeur de jeu' };
const REGLE_E: IgnoreDefAPartirDuCoupProfile = { coups: 4, rangsPermis: [3, 4], dernierCoupInconditionnel: null, source: 'FIXTURE SYNTHÉTIQUE du lot 12 — aucune valeur de jeu' };
const FIXTURES_IGNORE: { id: number; regle: IgnoreDefAPartirDuCoupProfile; coef: number; skillup: number; crans: (number | null)[]; defaut: number | null }[] = [
  { id: ID_C, regle: REGLE_C, coef: 1.1, skillup: 20, crans: [2, 3, 4, 5], defaut: 5 },
  { id: ID_E, regle: REGLE_E, coef: 0.7, skillup: 10, crans: [null, 3, 4], defaut: null },
];

function competenceIgnore(f: (typeof FIXTURES_IGNORE)[number]): Competence {
  return {
    id: 1, com2usId: f.id, nom: 'Fixture ignore DEF lot 12', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: f.regle.coups, niveauMax: 5, formule: `${f.coef}*{ATK}`, scale: ['ATK'],
    ameliorations: Array.from({ length: f.skillup / 10 }, () => 'Damage +10%'),
    icone: null,
    // Comme les six sorts réels : l'effet porte la note de la condition, que le calcul ne lit pas.
    effets: [{ nom: 'Ignore DEF', type: 'Buff', bonus: false, description: 'Attack will ignore the target\'s defense.', icone: '', chance: 0, quantite: 0, surSoi: false, aoe: false, surCritique: false, surMort: false, note: 'FIXTURE : si la jauge de la cible est à 0' }],
  } as Competence;
}

export function testLot12IgnoreDefDepuisUnCoup() {
  titre('Lot 12, mécanisme 10 — ignore DEF depuis un coup : règles SYNTHÉTIQUES C et E, une ligne de table chacune');

  const table = IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID as Record<number, IgnoreDefAPartirDuCoupProfile>;
  const clesAvant = Object.keys(table).sort();
  const BUILD = stats({ hp: 20000, atk: 1000, def: 800, spd: 150, cr: 50, cd: 100 });
  const SETUP: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 1_000_000, enemyHpPct: 100, critMode: 'normal' };
  const CHEMIN = 'damageSetup.premierCoupIgnoreDefParSort';

  try {
    // « Ce qu'il faut fournir » : UNE entrée de la table par identifiant, rien d'autre.
    for (const f of FIXTURES_IGNORE) table[f.id] = f.regle;

    for (const f of FIXTURES_IGNORE) {
      const p0 = skillDamageProfile(competenceIgnore(f));
      if (!p0 || !estPrisEnCharge(p0)) { ok(false, `${f.id} : profil refusé`); continue; }
      const p: SkillDamageProfile = p0;
      const parCoup = f.coef * 1000 * (1 + f.skillup / 100);
      const attendu = (rang: number | null) => {
        let t = 0;
        for (let n = 1; n <= f.regle.coups; n++) {
          const ignore = n === f.regle.dernierCoupInconditionnel || (rang !== null && n >= rang);
          t += parCoup * defenseFactor(ignore ? 0 : 1000);
        }
        return t;
      };
      const avec = (valeur: unknown): DamageSetup => ({ ...SETUP, premierCoupIgnoreDefParSort: { [f.id]: valeur } as Record<number, number | null> });

      egal([p.hits, p.ignoreDef, p.ignoreDefAPartirDuCoup === f.regle], [f.regle.coups, false, true], `${f.id} : ${f.regle.coups} coups, plus d’ignore DEF sur TOUS les coups malgré l’effet « Ignore DEF », règle portée par le profil`);
      egal(resolvedPremierCoupIgnoreDef(p, SETUP), f.defaut, `${f.id} : défaut sans choix = ${f.defaut === null ? 'aucun ignore DEF' : `${f.defaut}ᵉ coup seul`}`);
      egal((cransIgnoreDefAPartirDuCoup(p) ?? []).map((c) => c.rang), f.crans, `${f.id} : crans de l’écran dérivés de la règle`);
      egal((cransIgnoreDefAPartirDuCoup(p) ?? []).map((c) => c.libelle),
        f.id === ID_C ? ['Dès le 2ᵉ coup', 'Dès le 3ᵉ coup', 'Dès le 4ᵉ coup', '5ᵉ coup seul'] : ['Aucun', 'Dès le 3ᵉ coup', 'Dès le 4ᵉ coup'],
        `${f.id} : libellés dérivés de la règle`);
      for (const rang of f.crans) {
        const recu = computeSkillDamage(p, BUILD, avec(rang), AUCUNE_AURA_PROPRE);
        ok(proche(recu, attendu(rang)), `${f.id} rang ${rang ?? 'aucun'} : ${recu.toFixed(2)} = ${attendu(rang).toFixed(2)} attendus coup par coup`);
        egal(cranIgnoreDefRetenu(p, avec(rang))?.rang, rang, `${f.id} rang ${rang ?? 'aucun'} : le cran montré est celui du calcul`);
      }
      ok(proche(computeSkillDamage(p, BUILD, SETUP, AUCUNE_AURA_PROPRE), attendu(f.defaut)), `${f.id} : le défaut vaut son cran (${attendu(f.defaut).toFixed(2)})`);
      // Valeurs non permises : retombée sur le défaut, jamais un coup 1 qui ignore.
      for (const mauvais of [1, 0, f.regle.coups + 1, '3'] as unknown[]) {
        egal(resolvedPremierCoupIgnoreDef(p, avec(mauvais)), f.defaut, `${f.id} : ${JSON.stringify(mauvais)} hors crans, retombe sur le défaut`);
      }
      if (f.id === ID_E) {
        egal(resolvedPremierCoupIgnoreDef(p, avec(2)), null, `${f.id} : le rang 2 n’est pas permis (rangs 3 et 4 seulement), retombe sur « aucun »`);
        egal(resumeIgnoreDefRetenu(p, avec(null)), 'Ignore la DEF : aucun', `${f.id} : phrase « aucun »`);
      } else {
        egal(resumeIgnoreDefRetenu(p, avec(3)), 'Ignore la DEF : dès le 3ᵉ coup', `${f.id} : phrase « dès le 3ᵉ coup »`);
        egal(resumeIgnoreDefRetenu(p, SETUP), 'Ignore la DEF : 5ᵉ coup seul', `${f.id} : phrase du défaut`);
      }
      // 411 : le coup 1 seulement, qui n'ignore jamais ; les PV s'enchaînent d'un tronçon à l'autre.
      const critique: DamageSetup = { ...avec(f.crans.find((r) => r !== null) ?? null), critMode: 'crit' };
      const avec411 = computeSkillDamageDetail(p, BUILD, critique, AUCUNE_AURA_PROPRE, null, undefined, { ...ARTIFACT_DAMAGE_NEUTRE, cdPointsPremiereAttaque: 20 });
      const sans411 = computeSkillDamageDetail(p, BUILD, critique, AUCUNE_AURA_PROPRE, null, undefined, ARTIFACT_DAMAGE_NEUTRE);
      ok(proche(avec411.total - sans411.total, f.coef * 1000 * 0.2 * defenseFactor(1000)), `${f.id} : 411 compte une fois, sur le coup 1 mitigé`);
      ok(proche(avec411.pvRestantsPct, 100 * (1 - avec411.total / 1_000_000)), `${f.id} : les PV restants suivent le total des coups`);
      // Garde-fou : un nombre de coups qui ne correspond plus à la curation fait refuser le sort.
      const regenere = skillDamageProfile({ ...competenceIgnore(f), coups: f.regle.coups + 1 });
      ok(regenere !== null && !estPrisEnCharge(regenere), `${f.id} : un autre nombre de coups dans les données fait refuser le sort`);
    }

    titre('Lot 12, mécanisme 10 — la recette valide selon la règle de la ligne ajoutée (aucun code de plus)');
    const base = buildOptimizerRecipe({
      monsterCom2usId: 24913, monsterName: 'Cordelia',
      requirement: { sets: [], minStats: {} }, objective: 'degats_reels', damageSetup: { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: ID_C },
      metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
      excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
      ignoreArtifacts: true, artifactMainByKind: {},
    });
    const lire = (champ: unknown) => parseOptimizerRecipe(JSON.stringify({ ...base, damageSetup: { ...base.damageSetup, premierCoupIgnoreDefParSort: champ } }));
    for (const f of FIXTURES_IGNORE) {
      for (const rang of f.crans) {
        egal(lire({ [f.id]: rang }).recipe?.damageSetup.premierCoupIgnoreDefParSort, { [f.id]: rang }, `recette : ${f.id} cran ${rang ?? 'aucun'} accepté, transporté tel quel`);
      }
    }
    for (const [champ, chemin, motif] of [
      [{ [ID_C]: null }, `${CHEMIN}.${ID_C}`, 'C : « aucun » n’existe pas (5ᵉ coup toujours ignoré)'],
      [{ [ID_C]: 1 }, `${CHEMIN}.${ID_C}`, 'C : coup 1'],
      [{ [ID_C]: 6 }, `${CHEMIN}.${ID_C}`, 'C : 6ᵉ coup (le sort en a 5)'],
      [{ [ID_E]: 2 }, `${CHEMIN}.${ID_E}`, 'E : rang 2 non permis'],
      [{ [ID_E]: 5 }, `${CHEMIN}.${ID_E}`, 'E : 5ᵉ coup (le sort en a 4)'],
    ] as [unknown, string, string][]) {
      const r = lire(champ);
      ok(r.recipe === null && !!r.error?.includes(`${chemin} `), `recette refusée avec son chemin : ${motif}`);
    }
    ok(!!lire({ [ID_E]: 2 }).error?.includes(`${CHEMIN}.${ID_E} doit valoir null, 3, 4 pour ce sort`), 'recette : message avec les valeurs permises de E (dérivées de la règle)');
    // Avec huit entrées, le refus d'une clé sans règle ne
    // compte ni ne nomme les sorts de la table (il disait « seuls les six sorts
    // des Blade Dancers en ont un »).
    egal(Object.keys(table).length, 8, 'précondition : la table compte huit entrées, fixtures C et E comprises');
    egal(lire({ 4713: 2 }).error, `Fichier invalide : ${CHEMIN}.4713 désigne un sort sans réglage d'ignore DEF par coup.`,
      'recette : clé sans règle refusée par un message qui ne dépend pas du contenu de la table');
  } finally {
    for (const f of FIXTURES_IGNORE) delete table[f.id];
  }
  egal(Object.keys(table).sort(), clesAvant, 'la table de production est restaurée : aucune ligne de fixture ne reste');
}

// ── Point à constater — prose de « Stats acquises en combat » × passifsSuivants ─

export function testLot12PassifMasqueEtStatsDeCombat() {
  titre('Lot 12, point à constater — un passif masqué porte-t-il aussi des stats de combat ? (sentinelle du corpus)');

  // Le bloc des passifs ne rend que `passifsSuivants`. Auparavant,
  // « Stats acquises en combat » écartait la prose de TOUS les passifs
  // (`clesProseDejaRendue([...passifs])`) : un passif masqué qui porterait aussi
  // un réglage de stats de combat aurait perdu sa prose ET son en-tête. Désormais,
  // l'exclusion lit `passifsSuivants` (testProseStatsCombatCarte,
  // testProseStatsCombatPassifMasque). Deux causes de masquage existent : être
  // soi-même le sort choisi (`selectionnableCommeSort`) et ne pas suivre le slot
  // du sort (`slotsDeclencheurs`). On balaie chaque forme du corpus, avec chacun
  // des sorts qu'elle propose.
  const masquables = new Set<number>();
  const masques = new Set<string>();
  const partagesAvecStats: string[] = [];
  const prosesPerdues: string[] = [];
  for (const f of readdirSync(DOSSIER_SORTS).filter((n) => n.endsWith('.json'))) {
    const d: DetailMonstre = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, f), 'utf8'));
    const passifs = monsterOffensivePassives(d);
    if (passifs.length === 0) continue;
    const profilsStats = monsterCombatStatProfiles(d);
    const idsStats = new Set(profilsStats.map((p) => p.skillCom2usId));
    for (const p of passifs) {
      if (p.selectionnableCommeSort || p.slotsDeclencheurs) masquables.add(p.skillCom2usId);
      if (idsStats.has(p.skillCom2usId)) partagesAvecStats.push(`${d.com2usId}:${p.skillCom2usId}`);
    }
    for (const sort of monsterDamageSkills(d)) {
      if (!estPrisEnCharge(sort)) continue;
      const suivants = passifs.filter((p) => passifPeutSuivre(p, sort));
      for (const p of passifs) {
        if (!suivants.includes(p)) masques.add(`${p.skillCom2usId}`);
      }
      // Ce que la carte rend : un passif à prose qui partage son identifiant
      // avec des stats de combat la voit rendue par son bloc s'il suit le sort,
      // sinon par « Stats acquises en combat » — jamais nulle part.
      const rendu = renduStatsCombat(profilsStats, clesProseDejaRendue([...suivants]));
      for (const p of passifs) {
        const i = profilsStats.findIndex((s) => s.skillCom2usId === p.skillCom2usId);
        if (i < 0 || !p.description) continue;
        const parSonBloc = suivants.includes(p);
        const parLesStats = rendu[i].prose != null;
        if (parSonBloc === parLesStats) prosesPerdues.push(`${d.com2usId}:${p.skillCom2usId} après ${sort.skillCom2usId}`);
      }
    }
  }
  egal([...masquables].sort((a, b) => a - b), [3213], 'corpus : seul Tempest (3213) peut être masqué par construction (slots déclencheurs, choix comme sort)');
  egal([...masques].sort(), ['3213'], 'corpus : sur tous les sorts proposés par toutes les formes, seul Tempest est effectivement masqué');
  // Flash Step (19014) et Turning Slash (19414) partagent
  // leur identifiant avec un compteur de VIT (quatre formes, mesure dans le
  // libellé) ; ce n'est plus un défaut : la règle le vérifie sur chaque
  // sort.
  egal(prosesPerdues, [],
    `corpus, chaque sort proposé : la prose d’un passif qui porte aussi des stats de combat est rendue une fois — par son bloc s’il suit le sort, sinon par « Stats acquises en combat » (${partagesAvecStats.length} cas aujourd’hui${partagesAvecStats.length ? ` : ${partagesAvecStats.join(', ')}` : ''})`);
}
