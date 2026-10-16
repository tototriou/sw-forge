// Les attaques conjointes : quand un sort l'est (la porte
// `contexteAttaqueConjointe` et sa règle `estSortCooperatif`), ce que cela
// change au calcul (lignes d'artéfact 209 et 225 dans le terme DMG%, 224,
// 411, 400), et le choix des artéfacts qui en découle.
//
// Spec : docs/02-app/degats-reels/feat-attaques-conjointes.md.
//
// Valeurs de jeu : formules, portées et effets des fiches SWARFARM
// (`public/data/skills`) ; règle, tables par identifiant et lignes de chaque
// contexte : décisions de l'utilisateur du 2026-10-16 (valeurs-de-jeu-curees.md).
// Un test qui fige une décision le dit dans son libellé. Aucun total attendu
// n'est relu dans le code qui calcule : il est écrit à la main, ou comparé à
// un calcul sans la ligne.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { ok, egal, titre, monstersJson } from './outils';
import { StatRow, statsParPaire } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { Competence, DetailMonstre } from '../src/lib/monsterSkills';
import { ArtifactDetail, ElementKey, ArtifactArchetype, GearSet } from '../src/types';
import { ARTIFACT_SUB_MAX } from '../src/lib/artifacts';
import {
  AUCUNE_AURA_PROPRE,
  ARTIFACT_DAMAGE_NEUTRE,
  DEFAULT_DAMAGE_SETUP,
  type ArtifactDamageProfile,
  type DamageSetup,
  type SkillDamageProfile,
  artefactsSelonContexteConjoint,
  artifactDamageProfile,
  computeTotalDamage,
  contexteAttaqueConjointe,
  estPrisEnCharge,
  estSortCooperatif,
  estSortDesFamillesCooperatives,
  interrupteurAttaqueConjointe,
  mentionAttaqueConjointe,
  monsterDamageSkills,
  monsterOffensivePassives,
  skillDamageProfile,
} from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { analyserPertinence, chercherPaires, plafondLigne, type ArtifactSearchParams, type LigneVerrouillee } from '../src/lib/artifactOptim';
import { parametresArtefactsFiche } from '../src/lib/artifactFiche';
import { evaluerPourRegime, type DegatsContext } from '../src/lib/artifactEvaluation';
import type { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const DOSSIER_SORTS = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(DOSSIER_SORTS, `${com2usId}.json`), 'utf8'));
}

function competencesDistinctes(): Map<number, Competence> {
  const parId = new Map<number, Competence>();
  for (const n of readdirSync(DOSSIER_SORTS)) {
    if (!n.endsWith('.json')) continue;
    const d = JSON.parse(readFileSync(resolve(DOSSIER_SORTS, n), 'utf8')) as DetailMonstre;
    for (const c of d.competences) if (c.com2usId != null && !parId.has(c.com2usId)) parId.set(c.com2usId, c);
  }
  return parId;
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

// Une pièce de chaque sorte, les lignes rangées selon la sorte qui peut les
// porter (300-309 : attribut ; 400-411 : type ; le reste sur le type).
function artefacts(subs: { code: number; value: number }[]): ArtifactDamageProfile {
  const surAttribut = subs.filter((s) => s.code >= 300 && s.code < 400);
  const surType = subs.filter((s) => !(s.code >= 300 && s.code < 400));
  const pieces: ArtifactDetail[] = [
    { id: 0, kind: 'element', element: 'fire', level: 15, rarity: 5, main: { code: 101, value: 0 }, subs: surAttribut },
    { id: 0, kind: 'archetype', archetype: 'attack', level: 15, rarity: 5, main: { code: 101, value: 0 }, subs: surType },
  ];
  return artifactDamageProfile(pieces);
}

function sortDe(detail: DetailMonstre, id: number): SkillDamageProfile {
  const p = monsterDamageSkills(detail).find((s) => s.skillCom2usId === id);
  if (!p || !estPrisEnCharge(p)) throw new Error(`sort ${id} absent ou non pris en charge`);
  return p;
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// ── Les sorts par identifiant ────────────────────────────────────────────

// Les attaques des familles Chakram Dancer et Boomerang Warrior : conjointes
// si un monstre de l'autre famille est au combat (interrupteur, allumé par
// défaut), hors de la règle `Ally Attack` et de la table d'inclusion. Écrites
// à la main d'après le relevé des 21 fiches des deux familles (22 sorts actifs
// à formule) ; le test les retrouve aussi sur le corpus.
const FAMILLES_COOPERATIVES = [
  12601, 12602, 12603, 12604, 12605, 12607, 12608, 12609, 12611, 12613, 12615,
  12701, 12702, 12703, 12704, 12705, 12706, 12707, 12710, 12712, 12713, 12714,
];
// Les sorts coopératifs à effet `Ally Attack` et formule de donnée, hors des deux familles.
const SORTS_A_EFFET = [
  1511, 1561, 1576, 2006, 2007, 2010, 2056, 2057, 2060, 2071, 2072, 2075, 3113, 3465, 9812,
  23806, 23808, 23810, 24306, 24308, 24310,
];
// Table d'inclusion : sorts coopératifs dont la donnée ne porte pas l'effet.
const INCLUSION = [10910];
// Table d'exclusion : effet `Ally Attack` qui ne désigne pas une attaque du monstre.
const EXCLUSION = [10915, 12711];
// Effet `Ally Attack` sans formule de donnée, ratio curé (`FORMULES_CUREES_PAR_ID`) :
// la règle lit la formule retenue (décision de l'utilisateur, 2026-10-16).
const PAR_FORMULE_CUREE = [21415, 22015];

export function testAttaquesConjointesRegle() {
  titre('Attaques conjointes — la règle et ses tables, sur le corpus');
  const corpus = competencesDistinctes();
  const attendus = [...SORTS_A_EFFET, ...INCLUSION, ...PAR_FORMULE_CUREE].sort((a, b) => a - b);
  const trouves = [...corpus.values()].filter((c) => estSortCooperatif(c)).map((c) => c.com2usId!).sort((a, b) => a - b);
  egal(trouves, attendus, 'fige une décision de l’utilisateur (2026-10-16) : 21 sorts à effet Ally Attack et formule de donnée hors des deux familles, 2 à formule curée, plus celui de la table d’inclusion, et eux seuls');
  for (const id of PAR_FORMULE_CUREE) {
    const c = corpus.get(id)!;
    ok(
      (c.formule ?? '').trim() === '' && c.effets.some((e) => e.nom === 'Ally Attack') && estSortCooperatif(c),
      `fige une décision de l’utilisateur (2026-10-16) : ${id} (${c.nom}), effet Ally Attack sans formule de donnée, conjoint par sa formule curée`
    );
  }

  // Familles coopératives : la table, relevée sur les fiches des deux familles.
  const fichesDesFamilles = monstersJson().filter((m: { skillGroupId: number }) => m.skillGroupId === 21900 || m.skillGroupId === 22000);
  egal(fichesDesFamilles.length, 21, 'familles Chakram Dancer (21900) et Boomerang Warrior (22000) : 21 fiches dans monsters.json');
  const sortsDesFiches = new Set<number>();
  for (const m of fichesDesFamilles as { com2usId: number }[]) {
    for (const c of fiche(m.com2usId).competences) if (!c.passif && (c.formule ?? '').trim() !== '') sortsDesFiches.add(c.com2usId!);
  }
  egal([...sortsDesFiches].sort((a, b) => a - b), FAMILLES_COOPERATIVES, 'familles : les sorts actifs à formule de leurs fiches sont les 22 de la table');
  const famillesTrouvees = [...corpus.values()].filter((c) => estSortDesFamillesCooperatives(c)).map((c) => c.com2usId!).sort((a, b) => a - b);
  egal(famillesTrouvees, FAMILLES_COOPERATIVES, 'fige une décision de l’utilisateur (2026-10-16) : sur le corpus, les attaques des deux familles sont les 22 de la table, et elles seules');
  for (const id of FAMILLES_COOPERATIVES) {
    const c = corpus.get(id)!;
    ok(!estSortCooperatif(c), `fige une décision de l’utilisateur (2026-10-16) : ${id} (${c.nom}, S${c.slot}) n’est pas toujours conjoint, l’interrupteur en décide`);
  }
  ok(FAMILLES_COOPERATIVES.filter((id) => !corpus.get(id)!.effets.some((e) => e.nom === 'Ally Attack')).length === 4,
    'familles : 4 des 22 ne portent pas l’effet Ally Attack (12608, 12615, 12712, 12713) — la table ne se déduit pas de l’effet');
  for (const id of [12606, 12612, 12614, 12711, 12715]) {
    ok(!estSortDesFamillesCooperatives(corpus.get(id)!), `familles : ${id} (${corpus.get(id)!.nom}), sans formule ou passif, n’est pas une attaque`);
  }
  for (const id of INCLUSION) {
    const c = corpus.get(id)!;
    ok(!c.effets.some((e) => e.nom === 'Ally Attack'), `inclusion ${id} (${c.nom}) : la donnée ne porte pas l’effet — l’entrée de table est nécessaire`);
    ok(estSortCooperatif(c), `fige une décision de l’utilisateur (2026-10-16) : ${id} (${c.nom}) est conjoint par la table d’inclusion`);
  }
  for (const id of EXCLUSION) {
    const c = corpus.get(id)!;
    ok(c.effets.some((e) => e.nom === 'Ally Attack') && c.passif, `exclusion ${id} (${c.nom}) : passif portant l’effet Ally Attack`);
    // La table protège contre une donnée régénérée qui prêterait une formule
    // et un statut actif à ce passif : la règle seule le prendrait alors.
    const regeneree: Competence = { ...c, passif: false, formule: '1.0*{ATK}' };
    ok(!estSortCooperatif(regeneree), `exclusion ${id} : même actif et doté d’une formule, il reste hors des attaques conjointes`);
  }
  // Ce que la règle ne prend pas, par la donnée : cas non tranchés ou écartés.
  for (const [id, raison] of [
    [3415, 'fige une décision de l’utilisateur (2026-10-16) : Violent Friends (Harpu, Seren avant le 2e éveil), sans effet, n’est pas conjoint'],
    [3480, 'fige une décision de l’utilisateur (2026-10-16) : Violent Friends (Seren 1★), sans effet, n’est pas conjoint'],
    [10907, 'Cutting Magic de Lisa : même nom que 10910, autre identifiant, non inclus'],
    [10912, 'Attack Command (Lisa) : sans formule, hors de la règle'],
    [17515, 'Assailing Horn (Eivor ténèbres) : exclu, le monstre ne frappe pas'],
    [18015, 'Flag of Ambush (Sigrid) : exclu, le monstre ne frappe pas'],
  ] as const) {
    const c = corpus.get(id);
    ok(c !== undefined && !estSortCooperatif(c), `${id} — ${raison}`);
  }

  // Le marqueur du profil suit la règle, et elle seule.
  let ecarts = 0;
  let marques = 0;
  let marquesFamilles = 0;
  for (const c of corpus.values()) {
    const p = skillDamageProfile(c);
    if (!p || !estPrisEnCharge(p)) continue;
    if (p.sortCooperatif) marques++;
    if (p.sortDesFamillesCooperatives) marquesFamilles++;
    if ((p.sortCooperatif === true) !== estSortCooperatif(c)) ecarts++;
    if ((p.sortDesFamillesCooperatives === true) !== estSortDesFamillesCooperatives(c)) ecarts++;
    if (p.sortCooperatif && p.sortDesFamillesCooperatives) ecarts++;
  }
  egal(ecarts, 0, 'corpus : `sortCooperatif` et `sortDesFamillesCooperatives` du profil valent exactement leur règle, jamais les deux');
  egal(marques, attendus.length, `corpus : les ${attendus.length} sorts conjoints sont tous calculables, et marqués`);
  egal(marquesFamilles, FAMILLES_COOPERATIVES.length, 'corpus : les 22 attaques des familles sont toutes calculables, et marquées');
}

export function testAttaquesConjointesPorte() {
  titre('Attaques conjointes — la porte et ses trois contextes');
  const eteint = { attaqueConjointe: undefined };
  const allume = { attaqueConjointe: true };
  const s1 = { slot: 1 };
  const s2 = { slot: 2 };
  egal(contexteAttaqueConjointe({ ...s2, sortCooperatif: true }, eteint, 'sort-choisi'), 'propre', 'sort coopératif choisi : propre');
  egal(contexteAttaqueConjointe({ ...s2, sortCooperatif: true }, eteint, 'suite-du-sort'), 'propre', 'sort coopératif qui suit le sort : propre aussi, toujours conjoint');
  egal(contexteAttaqueConjointe({ ...s1, sortCooperatif: true }, allume, 'sort-choisi'), 'propre', 'S1 coopératif, interrupteur allumé : reste propre, l’interrupteur est sans effet');
  egal(contexteAttaqueConjointe(s1, allume, 'sort-choisi'), 'appelee-par-allie', 'S1 ordinaire choisi, interrupteur allumé : appelé par un allié');
  egal(contexteAttaqueConjointe(s1, eteint, 'sort-choisi'), null, 'S1 ordinaire, interrupteur absent : non conjoint');
  egal(contexteAttaqueConjointe(s1, { attaqueConjointe: false }, 'sort-choisi'), null, 'S1 ordinaire, interrupteur éteint : non conjoint');
  egal(contexteAttaqueConjointe(s2, allume, 'sort-choisi'), null, 'interrupteur allumé sur un S2 ordinaire : sans effet');
  egal(contexteAttaqueConjointe(s1, allume, 'suite-du-sort'), null, 'interrupteur allumé, S1 qui SUIT le sort choisi : sans effet');
  egal(contexteAttaqueConjointe({ ...s1, appeleParSortCooperatif: true }, eteint, 'sort-choisi'), 'appelee-par-sort', 'S1 appelé par un sort coopératif : appelé par le sort');
  egal(contexteAttaqueConjointe({ slot: 3, passif: true }, allume, 'sort-choisi'), null, 'un passif n’est jamais une attaque conjointe');

  // Familles coopératives : l'interrupteur, lu allumé quand le champ manque.
  const famille = (slot: number) => ({ slot, sortDesFamillesCooperatives: true as const });
  const eteintExplicite = { attaqueConjointe: false };
  for (const slot of [1, 2, 3]) {
    egal(contexteAttaqueConjointe(famille(slot), eteint, 'sort-choisi'), 'propre', `fige une décision de l’utilisateur (2026-10-16) : famille, S${slot}, champ absent : allumé par défaut, conjoint`);
    egal(contexteAttaqueConjointe(famille(slot), eteintExplicite, 'sort-choisi'), null, `fige une décision de l’utilisateur (2026-10-16) : famille, S${slot}, éteint par \`false\` : non conjoint`);
  }
  egal(contexteAttaqueConjointe(famille(2), allume, 'sort-choisi'), 'propre', 'provisoire, à confirmer par l’utilisateur : famille, allumé, contexte propre (pendant le tour du monstre)');
  egal(contexteAttaqueConjointe(famille(1), allume, 'sort-choisi'), 'propre', 'provisoire, à confirmer par l’utilisateur : famille, S1 allumé, contexte propre et non « appelé par un allié »');
  egal(contexteAttaqueConjointe(famille(2), eteint, 'suite-du-sort'), 'propre', 'famille, champ absent, sort qui suit le sort choisi : conjoint aussi (le combat, pas le sort, en décide)');
  egal(contexteAttaqueConjointe({ ...famille(3), passif: true }, eteint, 'sort-choisi'), null, 'famille : un passif n’est jamais une attaque conjointe');

  // L'interrupteur pour l'écran : proposé, état, défaut — dérivés de la porte.
  egal(interrupteurAttaqueConjointe(famille(2), eteint), { cas: 'familles-cooperatives', allume: true, allumeParDefaut: true },
    'fige une décision de l’utilisateur (2026-10-16) : famille, champ absent : interrupteur proposé, allumé, allumé par défaut');
  egal(interrupteurAttaqueConjointe(famille(1), eteintExplicite), { cas: 'familles-cooperatives', allume: false, allumeParDefaut: true },
    'famille, S1 éteint par `false` : interrupteur proposé, éteint, allumé par défaut');
  egal(interrupteurAttaqueConjointe(famille(3), allume), { cas: 'familles-cooperatives', allume: true, allumeParDefaut: true }, 'famille, S3 allumé : proposé, allumé');
  egal(interrupteurAttaqueConjointe(s1, eteint), { cas: 'appele-par-un-allie', allume: false, allumeParDefaut: false }, 'S1 ordinaire, champ absent : proposé, éteint, éteint par défaut');
  egal(interrupteurAttaqueConjointe(s1, allume), { cas: 'appele-par-un-allie', allume: true, allumeParDefaut: false }, 'S1 ordinaire allumé : proposé, allumé');
  egal(interrupteurAttaqueConjointe(s2, allume), null, 'S2 ordinaire : non proposé');
  egal(interrupteurAttaqueConjointe({ ...s1, sortCooperatif: true }, eteint), null, 'S1 coopératif (toujours conjoint) : non proposé');
  egal(interrupteurAttaqueConjointe({ ...s1, appeleParSortCooperatif: true }, eteint), null, 'S1 appelé par un sort coopératif : non proposé');
  egal(interrupteurAttaqueConjointe({ slot: 3, passif: true }, eteint), null, 'passif : non proposé');

  // La mention de la ligne du CLI : par l'interrupteur, défaut compris.
  egal(mentionAttaqueConjointe(famille(2), eteint), 'attaque conjointe (un monstre de l’autre famille au combat)', 'CLI, famille, champ absent : la ligne dit l’attaque conjointe (défaut allumé)');
  egal(mentionAttaqueConjointe(famille(2), eteintExplicite), null, 'CLI, famille éteinte : rien');
  egal(mentionAttaqueConjointe(s1, allume), 'attaque conjointe (appelée par un allié)', 'CLI, S1 ordinaire allumé : appelé par un allié');
  egal(mentionAttaqueConjointe(s1, eteint), null, 'CLI, S1 ordinaire, champ absent : rien');
  egal(mentionAttaqueConjointe({ ...s2, sortCooperatif: true }, eteint), null, 'CLI, sort coopératif : rien (pas d’interrupteur)');

  const a = artefacts([{ code: 209, value: 10 }, { code: 224, value: 20 }]);
  ok(artefactsSelonContexteConjoint(ARTIFACT_DAMAGE_NEUTRE, null) === ARTIFACT_DAMAGE_NEUTRE, 'profil sans ces lignes : rendu tel quel, aucune allocation');
  egal(artefactsSelonContexteConjoint(a, null).degatsAttaqueConjointePct, 0, 'non conjoint : 209/225 à 0');
  egal(artefactsSelonContexteConjoint(a, null).cdPointsMonoCible, 20, 'non conjoint : 224 gardée');
  ok(artefactsSelonContexteConjoint(a, 'propre') === a, 'propre : rien ne change');
  ok(artefactsSelonContexteConjoint(a, 'appelee-par-sort') === a, 'appelé par un sort : rien ne change');
  egal(artefactsSelonContexteConjoint(a, 'appelee-par-allie').cdPointsMonoCible, 0, 'appelé par un allié : 224 à 0');
  egal(artefactsSelonContexteConjoint(a, 'appelee-par-allie').degatsAttaqueConjointePct, 10, 'appelé par un allié : 209 gardée');

  // Le profil des artéfacts : 209 et 225 sommés, 208 jamais.
  egal(artefacts([{ code: 209, value: 10 }, { code: 225, value: 8 }, { code: 208, value: 15 }]).degatsAttaqueConjointePct, 18, 'profil : 209 + 225 sommés, 208 n’y entre pas');
  egal(artefacts([{ code: 208, value: 15 }]), ARTIFACT_DAMAGE_NEUTRE, 'profil : 208 seule ne touche aucun champ');

  // Le réglage : champ de sort (défaut réversible, à confirmer par l'utilisateur).
  egal(DAMAGE_SETUP_CLASSIFICATION.attaqueConjointe, 'sort', 'défaut réversible, provisoire : `attaqueConjointe` est un réglage propre au sort');
  egal(
    damageSetupApresChangementMonstre({ ...DEFAULT_DAMAGE_SETUP, attaqueConjointe: true }).attaqueConjointe,
    undefined,
    'défaut réversible, provisoire : changer de monstre éteint l’interrupteur'
  );
}

// Totaux réels : la porte branchée dans `computeTotalDamage`.
function totalDe(detail: DetailMonstre, profil: SkillDamageProfile, setup: DamageSetup, art: ArtifactDamageProfile, st = stats({ atk: 3000, cr: 100, cd: 150 })) {
  return computeTotalDamage(profil, monsterOffensivePassives(detail), st, setup, AUCUNE_AURA_PROPRE, null, art);
}

export function testAttaquesConjointesCalcul() {
  titre('Attaques conjointes — 209 et 225 dans le terme DMG%, 224, 411 et 400 selon le contexte');
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'normal', critMode: 'crit', enemyElement: null };
  const conjointes = artefacts([{ code: 209, value: 10 }, { code: 225, value: 8 }]);
  const contre = artefacts([{ code: 208, value: 15 }]);
  const ligne = (code: number, value = 20) => artefacts([{ code, value }]);
  const gagne = (detail: DetailMonstre, p: SkillDamageProfile, setup: DamageSetup, code: number) =>
    totalDe(detail, p, setup, ligne(code)) > totalDe(detail, p, setup, ARTIFACT_DAMAGE_NEUTRE);

  // Famille coopérative, champ absent (allumé par défaut) : Triple Strike
  // (Sabrina), effet Ally Attack.
  const sabrina = fiche(22011);
  const tripleStrike = sortDe(sabrina, 12706);
  const refA = totalDe(sabrina, tripleStrike, base, ARTIFACT_DAMAGE_NEUTRE);
  ok(proche(totalDe(sabrina, tripleStrike, base, conjointes) / refA, 1.18), 'fige une décision de l’utilisateur (2026-10-16) : famille (12706), champ absent : 209 + 225 (10 + 8) majorent le total de 18 %');
  egal(totalDe(sabrina, tripleStrike, base, contre), refA, 'famille (12706) : 208 (contre-attaque) ne change rien');

  // Famille coopérative sans l'effet dans la donnée : Vacuum Boomerang (Zenobia).
  const zenobia = fiche(22013);
  const vacuum = sortDe(zenobia, 12713);
  ok(
    proche(totalDe(zenobia, vacuum, base, conjointes) / totalDe(zenobia, vacuum, base, ARTIFACT_DAMAGE_NEUTRE), 1.18),
    'fige une décision de l’utilisateur (2026-10-16) : famille (12713, sans l’effet Ally Attack), champ absent : majoré de 18 % par 209 + 225'
  );

  // Famille coopérative éteinte : un sort ordinaire, au bit près.
  const eteintFamille: DamageSetup = { ...base, attaqueConjointe: false };
  const toutesConjointes = artefacts([{ code: 209, value: 20 }, { code: 225, value: 20 }, { code: 208, value: 20 }]);
  for (const [detail, p] of [[sabrina, tripleStrike], [zenobia, vacuum], [sabrina, sortDe(sabrina, 12701)]] as const) {
    egal(
      totalDe(detail, p, eteintFamille, toutesConjointes),
      totalDe(detail, p, eteintFamille, ARTIFACT_DAMAGE_NEUTRE),
      `fige une décision de l’utilisateur (2026-10-16) : famille (${p.skillCom2usId}) éteinte par \`false\` : non conjoint, 208/209/225 sans effet au bit près`
    );
    egal(totalDe(detail, p, eteintFamille, ARTIFACT_DAMAGE_NEUTRE), totalDe(detail, p, base, ARTIFACT_DAMAGE_NEUTRE), `famille (${p.skillCom2usId}) : sans ces lignes, allumé ou éteint donnent le même total`);
    ok(gagne(detail, p, eteintFamille, 224) === !p.aoe, `famille (${p.skillCom2usId}) éteinte : 224 selon la portée, comme un sort ordinaire`);
    ok(gagne(detail, p, eteintFamille, 411), `famille (${p.skillCom2usId}) éteinte : 411, comme un sort ordinaire`);
  }

  // Sort A− : le passif 10915 n'a pas de profil — rien à calculer.
  const sylvia = fiche(20115);
  ok(monsterDamageSkills(sylvia).every((p) => p.skillCom2usId !== 10915), 'sort A− (10915) : passif, jamais un sort calculé');

  // Sorts non conjoints : total exact, au bit près.
  const seren = fiche(12115);
  const violent = sortDe(seren, 3415);
  const toutes = artefacts([{ code: 209, value: 20 }, { code: 225, value: 20 }, { code: 208, value: 20 }]);
  egal(totalDe(seren, violent, base, toutes), totalDe(seren, violent, base, ARTIFACT_DAMAGE_NEUTRE), 'sort non conjoint (3415) : total inchangé au bit près avec 208, 209 et 225');
  const preemptive = sortDe(sylvia, 10905);
  egal(totalDe(sylvia, preemptive, base, toutes), totalDe(sylvia, preemptive, base, ARTIFACT_DAMAGE_NEUTRE), 'S1 ordinaire (10905), interrupteur absent : total inchangé au bit près');
  // Formule curée : Purification, Cooperation! (Nezuko) et Rite of Ashes
  // (Vermilion), conjoints par la formule retenue.
  for (const [forme, id] of [[31915, 21415], [32615, 22015]] as const) {
    const detail = fiche(forme);
    const p = sortDe(detail, id);
    ok(
      proche(totalDe(detail, p, base, conjointes) / totalDe(detail, p, base, ARTIFACT_DAMAGE_NEUTRE), 1.18),
      `fige une décision de l’utilisateur (2026-10-16) : ${p.nom} (${id}, formule curée 4,5 × ATQ) est conjoint, majoré de 18 % par 209 + 225`
    );
    egal(totalDe(detail, p, base, contre), totalDe(detail, p, base, ARTIFACT_DAMAGE_NEUTRE), `${p.nom} (${id}) : 208 ne change rien`);
    ok(gagne(detail, p, base, 224) === !p.aoe, `${p.nom} (${id}) : contexte propre, 224 suit la portée (${p.aoe ? 'zone' : 'mono-cible'})`);
    ok(gagne(detail, p, base, 411), `${p.nom} (${id}) : contexte propre, 411 sur le premier coup`);
  }

  // Bombe : jamais dans le terme DMG%.
  const bombe: Competence = {
    id: 1, com2usId: 999_301, nom: 'Bombe coopérative synthétique', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: 0, niveauMax: 1, formule: '1.0*{ATK}', scale: ['ATK'], ameliorations: [], icone: null,
    effets: [
      { nom: 'Bomb', type: 'Debuff', bonus: false, description: null, icone: null, chance: null, quantite: null, surSoi: false, aoe: false, surCritique: false, surMort: false, note: null },
      { nom: 'Ally Attack', type: 'Other', bonus: true, description: null, icone: null, chance: null, quantite: null, surSoi: false, aoe: false, surCritique: false, surMort: false, note: null },
    ],
  };
  const pBombe = skillDamageProfile(bombe);
  if (!pBombe || !estPrisEnCharge(pBombe) || !pBombe.bombe || !pBombe.sortCooperatif) {
    ok(false, 'bombe coopérative synthétique : profil de bombe coopératif attendu');
  } else {
    const st = stats({ atk: 3000 });
    egal(
      computeTotalDamage(pBombe, [], st, base, AUCUNE_AURA_PROPRE, null, conjointes),
      computeTotalDamage(pBombe, [], st, base, AUCUNE_AURA_PROPRE, null, ARTIFACT_DAMAGE_NEUTRE),
      'décision de l’utilisateur : une bombe, même conjointe, ne reçoit pas 209/225 (terme DMG%)'
    );
  }

  // Bucket Additionnel : la part brute (219) n'est pas majorée.
  const brut = artefacts([{ code: 219, value: 20 }]);
  const brutEtConjointes = artefacts([{ code: 219, value: 20 }, { code: 209, value: 10 }, { code: 225, value: 8 }]);
  const partBrute = totalDe(sabrina, tripleStrike, base, brut) - refA;
  const partBruteConjointe = totalDe(sabrina, tripleStrike, base, brutEtConjointes) - totalDe(sabrina, tripleStrike, base, conjointes);
  ok(partBrute > 0 && proche(partBruteConjointe, partBrute), `décision de l’utilisateur : le bucket Additionnel ne reçoit pas 209/225 (${partBrute.toFixed(3)} des deux côtés)`);

  // ── Les trois contextes et leurs lignes ──
  // propre : Triple Strike, S2 mono-cible d'une famille, champ absent (le
  // contexte de la famille allumée est provisoire, à confirmer).
  ok(gagne(sabrina, tripleStrike, base, 224), 'provisoire, à confirmer par l’utilisateur : propre (12706, famille allumée, mono-cible) : 224 suit la portée');
  ok(gagne(sabrina, tripleStrike, base, 411), 'propre : 411 sur le premier coup');
  ok(gagne(sabrina, tripleStrike, base, 401), 'propre : la ligne de son slot (401 pour un S2)');
  ok(!gagne(sabrina, tripleStrike, base, 400), 'propre : pas la ligne d’un autre slot (400)');

  // appelé par un allié : S1 ordinaire de Sylvia, interrupteur allumé.
  const allume: DamageSetup = { ...base, attaqueConjointe: true };
  ok(
    proche(totalDe(sylvia, preemptive, allume, conjointes) / totalDe(sylvia, preemptive, allume, ARTIFACT_DAMAGE_NEUTRE), 1.18),
    'fige une décision de l’utilisateur (2026-10-16) : S1 appelé par un allié, 209 + 225 comptent'
  );
  ok(!gagne(sylvia, preemptive, allume, 224), 'fige une décision de l’utilisateur (2026-10-16) : S1 appelé par un allié, 224 ne compte pas (hors du tour du monstre)');
  ok(gagne(sylvia, preemptive, base, 224), '… alors que le même S1, interrupteur éteint, reçoit 224');
  ok(gagne(sylvia, preemptive, allume, 411), 'fige une décision de l’utilisateur (2026-10-16) : S1 appelé par un allié, 411 compte');
  ok(gagne(sylvia, preemptive, allume, 400), 'S1 appelé par un allié : la ligne de son slot (400)');

  // appelé par un sort coopératif : profil injecté, celui du S1 marqué.
  const appele: SkillDamageProfile = { ...preemptive, appeleParSortCooperatif: true };
  ok(
    proche(totalDe(sylvia, appele, base, conjointes) / totalDe(sylvia, appele, base, ARTIFACT_DAMAGE_NEUTRE), 1.18),
    'fige une décision de l’utilisateur (2026-10-16) : S1 appelé par un sort coopératif, 209 + 225 comptent'
  );
  ok(gagne(sylvia, appele, base, 224), 'S1 appelé par un sort coopératif : 224 suit la portée du S1 (mono-cible)');
  ok(gagne(sylvia, appele, base, 411), 'à relire par l’utilisateur : S1 appelé par un sort coopératif, 411 compte (le déclencheur ne frappe pas)');
  ok(gagne(sylvia, appele, base, 400), 'à relire par l’utilisateur : S1 appelé par un sort coopératif, la ligne de SON slot (400)');
  ok(!gagne(sylvia, appele, base, 402) && !gagne(sylvia, appele, base, 410), '… jamais celle du slot 3 d’un déclencheur (402, 410)');

  // Interrupteur sans effet hors d'un S1 ordinaire choisi.
  const teshar = fiche(14513);
  const nova = sortDe(teshar, 3208);
  const mixte = artefacts([{ code: 209, value: 10 }, { code: 225, value: 8 }, { code: 224, value: 20 }]);
  egal(totalDe(teshar, nova, allume, mixte), totalDe(teshar, nova, base, mixte), 'interrupteur allumé sur un S2 (3208) : total identique, sans effet');
  const s1Coop = sortDe(sabrina, 12701);
  egal(totalDe(sabrina, s1Coop, allume, mixte), totalDe(sabrina, s1Coop, base, mixte), 'fige une décision de l’utilisateur (2026-10-16) : S1 de famille (12701), allumé ou champ absent : même total, allumé par défaut');
  ok(gagne(sabrina, s1Coop, allume, 224), 'provisoire, à confirmer par l’utilisateur : S1 de famille (12701) allumé, contexte propre : 224 compte (mono-cible)');
  ok(gagne(sabrina, s1Coop, allume, 411), 'provisoire, à confirmer par l’utilisateur : S1 de famille (12701) allumé : 411 compte');
  ok(
    proche(totalDe(sabrina, s1Coop, allume, conjointes) / totalDe(sabrina, s1Coop, allume, ARTIFACT_DAMAGE_NEUTRE), 1.18),
    'S1 de famille (12701) allumé : 209 + 225 comptent'
  );

  // Une contribution qui suit le sort n'est pas l'attaque conjointe.
  const arcane = sortDe(teshar, 3203);
  const avecTempest: DamageSetup = { ...allume, passifsOffensifs: { 3213: true } };
  const partTempest = (art: ArtifactDamageProfile) =>
    totalDe(teshar, arcane, avecTempest, art) - totalDe(teshar, arcane, { ...avecTempest, passifsOffensifs: {} }, art);
  ok(
    partTempest(ARTIFACT_DAMAGE_NEUTRE) > 0 && proche(partTempest(conjointes), partTempest(ARTIFACT_DAMAGE_NEUTRE)),
    'S1 de Teshar appelé par un allié, Tempest allumé : Tempest (un passif) ne reçoit pas 209/225'
  );
}

// Un sort coopératif lancé par le monstre lui-même a lieu pendant son tour :
// 224 compte selon sa portée. Les trois sorts nommés par l'utilisateur, tous
// mono-cibles dans leur fiche.
export function testAttaquesConjointesSortLanceParLeMonstre() {
  titre('Attaques conjointes — un sort coopératif lancé par le monstre reçoit 224 selon sa portée');
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'normal', critMode: 'crit', enemyElement: null };
  const ligne = (code: number) => artefacts([{ code, value: 20 }]);
  const conjointes = artefacts([{ code: 209, value: 10 }, { code: 225, value: 8 }]);
  for (const [forme, id, qui] of [
    [11012, 2007, 'Team Up de Raoq'],
    [11032, 2057, 'Team Up de Raoq 2e éveil'],
    [12135, 3465, 'Violent Friends de Seren 2e éveil'],
    [12013, 3113, 'Concentrated Attack de Moria (1er éveil)'],
  ] as const) {
    const detail = fiche(forme);
    const p = sortDe(detail, id);
    const neutre = totalDe(detail, p, base, ARTIFACT_DAMAGE_NEUTRE);
    ok(p.sortCooperatif === true && !p.aoe, `${qui} (${id}) : sort coopératif, mono-cible dans sa fiche`);
    egal(contexteAttaqueConjointe(p, base, 'sort-choisi'), 'propre', `${qui} (${id}) : contexte propre, pendant le tour du monstre`);
    ok(totalDe(detail, p, base, ligne(224)) > neutre, `fige une décision de l’utilisateur (2026-10-16) : ${qui} (${id}) reçoit 224 (mono-cible, pendant son tour)`);
    ok(totalDe(detail, p, base, ligne(411)) > neutre, `${qui} (${id}) : 411 sur le premier coup`);
    ok(proche(totalDe(detail, p, base, conjointes) / neutre, 1.18), `${qui} (${id}) : 209 + 225 majorent le total de 18 %`);
    egal(interrupteurAttaqueConjointe(p, base), null, `${qui} (${id}) : toujours conjoint, aucun interrupteur proposé`);
  }
}

export function testAttaquesConjointesTotalALaMain() {
  titre('Attaques conjointes — total écrit à la main : 209, 225 et une ligne élémentaire sous Marque');
  // Sort coopératif synthétique : 1,0 × ATQ, un coup, mono-cible, sans amélioration.
  const c: Competence = {
    id: 1, com2usId: 999_302, nom: 'Coopération synthétique', description: null, slot: 3, passif: false, aoe: false,
    cooldown: null, coups: 1, niveauMax: 1, formule: '1.0*{ATK}', scale: ['ATK'], ameliorations: [], icone: null,
    effets: [{ nom: 'Ally Attack', type: 'Other', bonus: true, description: null, icone: null, chance: null, quantite: null, surSoi: false, aoe: false, surCritique: false, surMort: false, note: null }],
  };
  const p = skillDamageProfile(c);
  if (!p || !estPrisEnCharge(p) || !p.sortCooperatif) {
    ok(false, 'sort coopératif synthétique : profil coopératif attendu');
    return;
  }
  const st = stats({ atk: 2000 });
  // DEF 0 : facteur de défense 1000 / 1142 ; « Non critique » : terme critique 1.
  const setup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'normal', critMode: 'normal', enemyDef: 0, enemyElement: 'fire', brand: true };
  const art = artefacts([{ code: 300, value: 12 }, { code: 209, value: 10 }, { code: 225, value: 8 }, { code: 208, value: 15 }]);
  const total = computeTotalDamage(p, [], st, setup, AUCUNE_AURA_PROPRE, null, art);
  // DMG% = 1 + 0,12 (Feu) + 0,10 (209) + 0,08 (225) = 1,30, 208 exclue ; Marque
  // dans Réductions : × 1,25, multiplicatif avec DMG%.
  const attendu = (2000 * 1.3 * 1.25 * 1000) / 1142;
  ok(proche(total, attendu), `2000 × 1,30 × 1,25 × 1000/1142 = ${attendu.toFixed(4)} (reçu ${total.toFixed(4)})`);
  const additif = (2000 * (1 + 0.3 + 0.25) * 1000) / 1142;
  ok(!proche(total, additif), `… et non ${additif.toFixed(4)}, ce que donnerait 209/225 additionnés à la Marque`);
  const sans208 = computeTotalDamage(p, [], st, setup, AUCUNE_AURA_PROPRE, null, artefacts([{ code: 300, value: 12 }, { code: 209, value: 10 }, { code: 225, value: 8 }]));
  egal(total, sans208, '208 ne change rien au total');
}

// ── Choix des artéfacts : moteur contre énumération exhaustive ───────────

// Générateur déterministe (mulberry32) : mêmes inventaires à chaque passage.
function aleatoire(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIGNES_ATTRIBUT = [300, 301, 209, 225, 208, 219, 222];
const LIGNES_TYPE = [400, 401, 402, 410, 411, 224, 209, 225, 208, 219];

function inventaire(rnd: () => number, element: ElementKey, archetype: ArtifactArchetype, parSorte: number): ArtifactDetail[] {
  const out: ArtifactDetail[] = [];
  let id = 1;
  const piece = (kind: 'element' | 'archetype'): ArtifactDetail => {
    const pool = kind === 'element' ? LIGNES_ATTRIBUT : LIGNES_TYPE;
    const n = 1 + Math.floor(rnd() * 3);
    const codes = [...pool].sort(() => rnd() - 0.5).slice(0, n);
    const subs = codes.map((code) => ({ code, value: Math.round((1 + rnd() * ((ARTIFACT_SUB_MAX[code] ?? 10) - 1)) * 10) / 10 }));
    const main = [100, 101, 102][Math.floor(rnd() * 3)]!;
    const value = main === 100 ? 1000 + Math.floor(rnd() * 1000) : 50 + Math.floor(rnd() * 100);
    return kind === 'element'
      ? { id: id++, kind, element, level: 15, rarity: 5, main: { code: main, value }, subs }
      : { id: id++, kind, archetype, level: 15, rarity: 5, main: { code: main, value }, subs };
  };
  for (let i = 0; i < parSorte; i++) out.push(piece('element'));
  for (let i = 0; i < parSorte; i++) out.push(piece('archetype'));
  return out;
}

// Référence naïve : TOUTES les paires de l'inventaire (emplacement vide
// compris), notées par le même évaluateur, verrous appliqués à la main.
function meilleurExhaustif(inv: ArtifactDetail[], evaluer: (a: ArtifactDetail[]) => number, verrous: LigneVerrouillee[]) {
  const attributs: (ArtifactDetail | null)[] = [null, ...inv.filter((a) => a.kind === 'element')];
  const types: (ArtifactDetail | null)[] = [null, ...inv.filter((a) => a.kind === 'archetype')];
  let meilleur = Number.NEGATIVE_INFINITY;
  let ids: string[] = [];
  for (const e of attributs) {
    for (const t of types) {
      const paire = [e, t].filter((x): x is ArtifactDetail => x != null);
      const tient = verrous.every((v) => paire.reduce((s, a) => s + a.subs.filter((x) => x.code === v.code).reduce((u, x) => u + x.value, 0), 0) >= v.min - 1e-6);
      if (!tient) continue;
      const score = evaluer(paire);
      const cle = `${e?.id ?? '-'}/${t?.id ?? '-'}`;
      if (score > meilleur + 1e-9) {
        meilleur = score;
        ids = [cle];
      } else if (Math.abs(score - meilleur) <= 1e-9) ids.push(cle);
    }
  }
  return { meilleur, ids };
}

const sansLignesConjointes = (inv: ArtifactDetail[]) =>
  inv.map((a) => ({ ...a, subs: a.subs.filter((s) => s.code !== 209 && s.code !== 225 && s.code !== 208) }));

export function testAttaquesConjointesChoixArtefacts() {
  titre('Attaques conjointes — choix des artéfacts : moteur contre énumération exhaustive des paires');
  // Sylvia (Neostone Agent ténèbres) : S2 10910 conjoint (table d'inclusion),
  // S1 10905 ordinaire, interrupteur éteint ou allumé. Lisa (feu) : Attack
  // Command (10912), S1 10902 appelé par un sort coopératif.
  const SYLVIA = { forme: 20115, porteur: { element: 'dark' as ElementKey, archetype: 'attack' as ArtifactArchetype } };
  const LISA = { forme: 20112, porteur: { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype } };
  // Sabrina (Boomerang Warrior eau) : Triple Strike (12706), attaque d'une
  // famille coopérative, champ absent (allumé par défaut) ou éteint.
  const SABRINA = { forme: 22011, porteur: { element: 'water' as ElementKey, archetype: 'attack' as ArtifactArchetype } };
  const gear: GearSet = { base: { hp: 10000, atk: 900, def: 600, spd: 110, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] };
  const statsAvec = statsParPaire(gear);
  const contexte = (forme: number, setup: DamageSetup): DegatsContext => {
    const ctx = buildRealDamageContext({ objective: 'degats_reels', damageSetup: setup } as unknown as OptimizerRecipe, forme, []);
    if (!ctx) throw new Error(`aucun contexte « Dégâts réels » pour ${forme}`);
    const { artefacts: _ignore, ...reste } = ctx;
    return reste;
  };
  const base: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, summonerSkills: 'normal', critMode: 'crit', enemyElement: 'fire' };
  const cas = [
    { nom: 'sort conjoint (10910)', ...SYLVIA, setup: { ...base, skillCom2usId: 10910 }, conjoint: true },
    { nom: 'S1 appelé par un allié (10905, interrupteur)', ...SYLVIA, setup: { ...base, skillCom2usId: 10905, attaqueConjointe: true }, conjoint: true },
    { nom: 'sort non conjoint (10905)', ...SYLVIA, setup: { ...base, skillCom2usId: 10905 }, conjoint: false },
    { nom: 'S1 appelé par un sort coopératif (Lisa, 10912)', ...LISA, setup: { ...base, skillCom2usId: 10912 }, conjoint: true },
    { nom: 'famille, champ absent (Sabrina, 12706)', ...SABRINA, setup: { ...base, skillCom2usId: 12706 }, conjoint: true },
    { nom: 'famille éteinte (Sabrina, 12706)', ...SABRINA, setup: { ...base, skillCom2usId: 12706, attaqueConjointe: false }, conjoint: false },
  ];

  for (const c of cas) {
    const { porteur } = c;
    const degats = contexte(c.forme, c.setup);
    egal(degats.profile.skillCom2usId, c.setup.skillCom2usId, `${c.nom} : le contexte calcule bien le sort voulu`);
    const evaluer = evaluerPourRegime('degats_reels', statsAvec, AUCUNE_AURA_PROPRE, degats);
    let divergences = 0;
    let departages = 0;
    let inchanges = 0;
    const GRAINES = 40;
    for (let g = 1; g <= GRAINES; g++) {
      const rnd = aleatoire(1000 + g);
      const inv = inventaire(rnd, porteur.element, porteur.archetype, 5);
      // Une graine sur quatre pose un verrou sur 209 : la ligne doit être tenue.
      const verrous: LigneVerrouillee[] = g % 4 === 0 ? [{ code: 209, min: 5 }] : [];
      const sansEvaluer = parametresArtefactsFiche({
        porteur, inventaire: inv, reserves: new Set(), equipes: [], optimiserArtefacts: true,
        principaleParSorte: {}, lignesVerrouillees: verrous, damageSetup: c.setup, maxStats: {},
      });
      const params: ArtifactSearchParams = { ...sansEvaluer, evaluer };
      const moteur = chercherPaires(params, 1).paires[0];
      const ref = meilleurExhaustif(inv, evaluer, verrous);
      if (ref.meilleur === Number.NEGATIVE_INFINITY) {
        if (moteur) divergences++;
        continue;
      }
      const cleMoteur = moteur ? `${moteur.element?.id ?? '-'}/${moteur.archetype?.id ?? '-'}` : 'aucune';
      if (!moteur || !proche(moteur.score, ref.meilleur) || !ref.ids.includes(cleMoteur)) divergences++;
      // Les lignes 208/209/225 retirées de l'inventaire : la meilleure paire
      // change-t-elle ? Sur un sort conjoint, elles doivent décider du choix
      // dans une partie des inventaires (sinon le test ne prouve rien) ; sur
      // un sort non conjoint, rien ne bouge — mêmes paires, même score.
      if (verrous.length === 0) {
        const nu = meilleurExhaustif(sansLignesConjointes(inv), evaluer, []);
        if (!ref.ids.some((k) => nu.ids.includes(k))) departages++;
        if (JSON.stringify(nu.ids) === JSON.stringify(ref.ids) && nu.meilleur === ref.meilleur) inchanges++;
      }
    }
    egal(divergences, 0, `${c.nom} : sur ${GRAINES} inventaires, le moteur trouve la meilleure paire de l’énumération exhaustive`);
    const sansVerrou = GRAINES - Math.floor(GRAINES / 4);
    if (c.conjoint) ok(departages >= 3, `${c.nom} : 209/225 changent la paire choisie sur ${departages} des ${sansVerrou} inventaires sans verrou (attendu ≥ 3)`);
    else egal(inchanges, sansVerrou, `${c.nom} : résultat inchangé sans 208/209/225, mêmes paires et même score, sur les ${sansVerrou} inventaires sans verrou`);

    const pertinence = analyserPertinence({ ...parametresArtefactsFiche({
      porteur, inventaire: [], reserves: new Set(), equipes: [], optimiserArtefacts: true,
      principaleParSorte: {}, lignesVerrouillees: [], damageSetup: c.setup, maxStats: {},
    }), evaluer });
    egal(
      [209, 225].map((code) => pertinence.croissants.has(code)),
      [c.conjoint, c.conjoint],
      `${c.nom} : la sonde de pertinence ${c.conjoint ? 'compte' : 'écarte'} 209 et 225`
    );
    ok(!pertinence.croissants.has(208) && !pertinence.ambigus.has(208), `${c.nom} : 208 reste sans effet pour la sonde`);
    if (c.setup.skillCom2usId === 12706) {
      ok(pertinence.croissants.has(224), `${c.nom} : 224 comptée (mono-cible), allumé comme éteint`);
    }
    if (c.setup.skillCom2usId === 10905) {
      egal(pertinence.croissants.has(224), !c.setup.attaqueConjointe, `${c.nom} : 224 ${c.setup.attaqueConjointe ? 'écartée (hors du tour du monstre)' : 'comptée (mono-cible)'} par la sonde`);
    }
    if (c.setup.skillCom2usId === 10912) {
      egal(
        [224, 400, 402, 410].map((code) => pertinence.croissants.has(code)),
        [true, true, false, false],
        `${c.nom}, déduit, à relire par l’utilisateur : la sonde compte 224 (portée du S1) et 400 (slot du S1), jamais 402 ni 410 (slot du déclencheur)`
      );
    }
  }
  egal(plafondLigne(209), 2 * (ARTIFACT_SUB_MAX[209] ?? 0), 'plafond de verrou : 209 se porte sur les deux pièces, plafond doublé');
  egal(plafondLigne(225), 2 * (ARTIFACT_SUB_MAX[225] ?? 0), 'plafond de verrou : 225 aussi');
}
