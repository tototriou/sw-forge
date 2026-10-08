// L'ignore DEF conditionnel des Blade Dancers.
//
// Six sorts n'ignorent la DEF que lorsque la jauge d'attaque de la cible est à
// 0. L'ATB adverse n'est pas modélisée : le premier coup qui ignore suit la
// règle curée (`docs/02-app/degats-reels/`) — le coup 1
// n'ignore jamais, une fois qu'un coup ignore tous les suivants ignorent, le
// 7ᵉ coup de la variante B ignore toujours ; par défaut, seul ce coup
// inconditionnel ignore (aucun en variante A).
//
// ⚠️ Ce qui serait GRAVE ET INVISIBLE : un coup 1 qui ignorerait la DEF, ou
// un calcul où tous les coups ignorent — des dégâts
// plausibles, surestimés, qui classeraient les builds sur une base fausse.
// Les valeurs attendues se recalculent ici depuis `defenseFactor` et les
// coefficients des données, jamais en rejouant la découpe du moteur.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
  ARTIFACT_DAMAGE_NEUTRE,
  AUCUNE_AURA_PROPRE,
  DEFAULT_DAMAGE_SETUP,
  type DamageSetup,
  IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID,
  type SkillDamageProfile,
  champsDuCombat,
  computeSkillDamage,
  computeSkillDamageDetail,
  cranIgnoreDefRetenu,
  cransIgnoreDefAPartirDuCoup,
  defenseFactor,
  estPrisEnCharge,
  monsterDamageSkills,
  resolvedPremierCoupIgnoreDef,
  resumeIgnoreDefRetenu,
  skillDamageProfile,
} from '../src/lib/damage';
import { DAMAGE_SETUP_CLASSIFICATION, damageSetupApresChangementMonstre } from '../src/lib/damageSetupTransition';
import { type DetailMonstre } from '../src/lib/monsterSkills';
import { type StatKey } from '../src/lib/effects';
import { type StatRow } from '../src/lib/stats';
import { buildOptimizerRecipe, parseOptimizerRecipe, type OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { objectiveScore } from '../src/lib/runeBuildOptim';
import { signatureArtefacts } from '../src/lib/artifactQueue';
import { recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { type LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dossierSorts = resolve(racine, 'public/data/skills');

function fiche(com2usId: number): DetailMonstre {
  return JSON.parse(readFileSync(resolve(dossierSorts, `${com2usId}.json`), 'utf8'));
}

function profilDe(forme: number, sortId: number): SkillDamageProfile {
  const trouve = monsterDamageSkills(fiche(forme)).find((p) => p.skillCom2usId === sortId);
  if (!trouve || !estPrisEnCharge(trouve)) throw new Error(`Profil ${forme}/${sortId} introuvable`);
  return trouve;
}

function stats(valeurs: Partial<Record<StatKey, number>>): StatRow[] {
  const cles: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
  return cles.map((key) => ({ key, label: key, base: 0, bonus: valeurs[key] ?? 0, total: valeurs[key] ?? 0, suffix: '' }));
}

// Variante A : 3 coups à 1,8 × ATQ, Damage +5/+10/+15 % ; variante B : 7 coups
// à 0,85 × ATQ, Damage +10 % (relu dans les données ci-dessous).
const VARIANTE_A = { coups: 3, coef: 1.8, skillupPct: 30, rangs: [2, 3], inconditionnel: null as number | null };
const VARIANTE_B = { coups: 7, coef: 0.85, skillupPct: 10, rangs: [2, 3, 4, 5, 6, 7], inconditionnel: 7 as number | null };
// Les douze formes du corpus : forme non éveillée
// puis éveillée, partageant le même identifiant de compétence.
const SORTS: { id: number; nom: string; formes: number[]; variante: typeof VARIANTE_A; note: string }[] = [
  { id: 14308, nom: 'Hyakuretsukyaku', formes: [24403, 24413], variante: VARIANTE_A, note: 'If enemy ATB at 0' },
  { id: 14310, nom: 'Hyakuretsukyaku', formes: [24405, 24415], variante: VARIANTE_A, note: 'If enemy ATB at 0' },
  { id: 14808, nom: 'Blade Dance of Night', formes: [24903, 24913], variante: VARIANTE_A, note: 'If enemy ATB at 0' },
  { id: 14810, nom: 'Blade Dance of Night', formes: [24905, 24915], variante: VARIANTE_A, note: 'If enemy ATB at 0' },
  { id: 14311, nom: 'Hoyokusen', formes: [24401, 24411], variante: VARIANTE_B, note: 'If enemy ATB at 0 or 7th hit' },
  { id: 14811, nom: 'Moonlight Dance', formes: [24901, 24911], variante: VARIANTE_B, note: 'If enemy ATB at 0 or 7th hit' },
];
const SIX = SORTS.map((s) => s.id).sort();

const BUILD = stats({ hp: 20000, atk: 1000, def: 800, spd: 150, cr: 50, cd: 100 });
// Sans base (`stats()`), les compétences d'invocateur n'ajoutent rien : l'ATQ de
// combat vaut 1 000 et, en « Non critique », le terme Crit vaut 1 + améliorations.
const SETUP: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, enemyDef: 1000, enemyHp: 1_000_000, enemyHpPct: 100, critMode: 'normal' };

function attendu(v: typeof VARIANTE_A, rang: number | null): number {
  const parCoup = v.coef * 1000 * (1 + v.skillupPct / 100);
  let total = 0;
  for (let n = 1; n <= v.coups; n++) {
    const ignore = n === v.inconditionnel || (rang !== null && n >= rang);
    total += parCoup * defenseFactor(ignore ? 0 : 1000);
  }
  return total;
}

const proche = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

export default function testBladeDancersIgnoreDef() {
  titre('Blade Dancers — le corpus : six identifiants, douze formes, famille close');

  // Balayage COMPLET du corpus (game-data-curation § 1) : la liste ci-dessus
  // doit s'y retrouver, et aucun autre sort ne porter une note d'ignore DEF
  // liée à la jauge d'attaque — sinon la famille ne serait plus close.
  const formesParId = new Map<number, number[]>();
  const notesAtb = new Set<number>();
  for (const f of readdirSync(dossierSorts)) {
    if (!f.endsWith('.json')) continue;
    const detail: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8'));
    for (const c of detail.competences) {
      if (c.com2usId == null) continue;
      if (SIX.includes(c.com2usId)) formesParId.set(c.com2usId, [...(formesParId.get(c.com2usId) ?? []), detail.com2usId]);
      if (c.effets.some((e) => e.nom === 'Ignore DEF' && /\bATB\b/i.test(e.note ?? ''))) notesAtb.add(c.com2usId);
    }
  }
  for (const s of SORTS) {
    egal((formesParId.get(s.id) ?? []).sort(), s.formes, `${s.id} ${s.nom} : ses deux formes du corpus, et elles seules`);
  }
  egal([...formesParId.values()].reduce((n, l) => n + l.length, 0), 12, 'douze formes au total');
  egal([...notesAtb].sort(), SIX, 'seuls ces six sorts portent un ignore DEF conditionné à l’ATB (famille close)');
  egal(Object.keys(IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID).map(Number).sort(), SIX, 'la table couvre exactement les six identifiants');

  titre('Blade Dancers — la table par identifiant : rangs permis et coup inconditionnel');

  for (const s of SORTS) {
    const regle = IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID[s.id];
    egal(regle.coups, s.variante.coups, `${s.id} : ${s.variante.coups} coups supposés`);
    egal([...regle.rangsPermis], s.variante.rangs, `${s.id} : rangs permis ${s.variante.rangs.join(', ')}`);
    ok(!regle.rangsPermis.includes(1), `${s.id} : le coup 1 n'est jamais un rang permis`);
    ok(regle.rangsPermis.every((r) => r >= 2 && r <= regle.coups), `${s.id} : chaque rang permis est un coup réel du sort`);
    egal(regle.dernierCoupInconditionnel, s.variante.inconditionnel,
      s.variante.inconditionnel ? `${s.id} : le 7ᵉ coup ignore toujours la DEF` : `${s.id} : aucun coup inconditionnel`);
    ok(regle.source.includes('utilisateur'), `${s.id} : la source de la règle est citée`);
  }

  titre('Blade Dancers — les douze profils lus dans les données');

  for (const s of SORTS) {
    for (const forme of s.formes) {
      const competence = fiche(forme).competences.find((c) => c.com2usId === s.id)!;
      egal(competence.effets.filter((e) => e.nom === 'Ignore DEF').map((e) => e.note), [s.note],
        `${forme}/${s.id} : l'effet « Ignore DEF » porte la note « ${s.note} »`);
      const p = profilDe(forme, s.id);
      egal(p.nom, s.nom, `${forme}/${s.id} : ${s.nom}`);
      egal(p.hits, s.variante.coups, `${forme}/${s.id} : ${s.variante.coups} coups, lus dans les données`);
      egal(p.formule, `${s.variante.coef}*{ATK}`, `${forme}/${s.id} : formule ${s.variante.coef} × ATQ`);
      egal(p.skillupDamagePct, s.variante.skillupPct, `${forme}/${s.id} : améliorations +${s.variante.skillupPct} %`);
      egal(p.ignoreDef, false, `${forme}/${s.id} : plus d'ignore DEF sur TOUS les coups (booléen faux)`);
      ok(p.ignoreDefAPartirDuCoup === IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID[s.id], `${forme}/${s.id} : la règle curée est portée par le profil`);
      egal(JSON.parse(JSON.stringify(p.ignoreDefAPartirDuCoup)), IGNORE_DEF_A_PARTIR_DU_COUP_PAR_ID[s.id],
        `${forme}/${s.id} : la règle est une donnée pure (sérialisable telle quelle)`);
    }
  }
  // Des données régénérées avec un autre nombre de coups ne reçoivent pas des
  // rangs devenus faux : le sort est refusé avec sa raison.
  const hoyokusen = fiche(24411).competences.find((c) => c.com2usId === 14311)!;
  const regenere = skillDamageProfile({ ...hoyokusen, coups: 8 });
  ok(regenere !== null && !estPrisEnCharge(regenere), 'un nombre de coups qui ne correspond plus à la curation fait refuser le sort');
  // Les Blade Dancers ne sont PAS dans IGNORE_DEF_CONDITIONNEL_PAR_ID, qui
  // neutralise l'ignore d'un sort à bouton : ce serait une autre mécanique.
  const source = readFileSync(resolve(racine, 'src/lib/damage.ts'), 'utf8');
  const neutralises = /const IGNORE_DEF_CONDITIONNEL_PAR_ID = new Set\(\[([\s\S]*?)\]\)/.exec(source);
  ok(!!neutralises, 'IGNORE_DEF_CONDITIONNEL_PAR_ID trouvée dans damage.ts');
  const idsNeutralises = (neutralises?.[1] ?? '').split(/[^0-9]+/).filter(Boolean).map(Number);
  ok(idsNeutralises.length > 0 && SIX.every((id) => !idsNeutralises.includes(id)),
    'aucun des six n’est dans IGNORE_DEF_CONDITIONNEL_PAR_ID');

  titre('Blade Dancers — le rang retenu : choix permis, défauts, valeurs refusées');

  const a = profilDe(24913, 14808); // Cordelia, variante A
  const b = profilDe(24911, 14811); // Lariel, variante B
  const avec = (id: number, valeur: unknown): DamageSetup =>
    ({ ...SETUP, premierCoupIgnoreDefParSort: { [id]: valeur } as Record<number, number | null> });
  egal(resolvedPremierCoupIgnoreDef(a, SETUP), null, 'variante A, champ absent : aucun ignore DEF par défaut');
  egal(resolvedPremierCoupIgnoreDef(b, SETUP), 7, 'variante B, champ absent : le 7ᵉ coup seul par défaut');
  egal(resolvedPremierCoupIgnoreDef(a, avec(14808, null)), null, 'variante A : « aucun » est un choix permis');
  for (const r of VARIANTE_A.rangs) egal(resolvedPremierCoupIgnoreDef(a, avec(14808, r)), r, `variante A : à partir du ${r}ᵉ coup`);
  for (const r of VARIANTE_B.rangs) egal(resolvedPremierCoupIgnoreDef(b, avec(14811, r)), r, `variante B : à partir du ${r}ᵉ coup`);
  egal(resolvedPremierCoupIgnoreDef(a, avec(14808, 1)), null, 'variante A : un coup 1 demandé retombe sur le défaut, jamais appliqué');
  egal(resolvedPremierCoupIgnoreDef(b, avec(14811, 1)), 7, 'variante B : un coup 1 demandé retombe sur le défaut, jamais appliqué');
  egal(resolvedPremierCoupIgnoreDef(b, avec(14811, null)), 7, 'variante B : « aucun » n’existe pas, le 7ᵉ coup reste inconditionnel');
  egal(resolvedPremierCoupIgnoreDef(a, avec(14808, 4)), null, 'variante A : un rang au-delà du 3ᵉ coup retombe sur le défaut');
  egal(resolvedPremierCoupIgnoreDef(b, avec(14811, 8)), 7, 'variante B : un rang au-delà du 7ᵉ coup retombe sur le défaut');
  egal(resolvedPremierCoupIgnoreDef(b, avec(14811, '3')), 7, 'variante B : une valeur mal typée retombe sur le défaut');
  egal(resolvedPremierCoupIgnoreDef(a, avec(14810, 2)), null, 'une clé d’un autre sort ne règle pas celui-ci');

  titre('Blade Dancers — chaque cran, coup par coup (coup 1 toujours mitigé, 7ᵉ toujours ignoré en B)');

  for (const s of SORTS) {
    const p = profilDe(s.formes[1], s.id);
    const crans: (number | null)[] = s.variante.inconditionnel === null ? [null, ...s.variante.rangs] : s.variante.rangs;
    for (const rang of crans) {
      const recu = computeSkillDamage(p, BUILD, avec(s.id, rang), AUCUNE_AURA_PROPRE);
      const libelle = rang === null ? 'aucun ignore DEF' : rang === s.variante.inconditionnel ? '7ᵉ coup seul' : `dès le ${rang}ᵉ coup`;
      ok(proche(recu, attendu(s.variante, rang)), `${s.id} « ${libelle} » : ${recu.toFixed(2)} = ${attendu(s.variante, rang).toFixed(2)} attendus`);
    }
    const defaut = computeSkillDamage(p, BUILD, SETUP, AUCUNE_AURA_PROPRE);
    ok(proche(defaut, attendu(s.variante, s.variante.inconditionnel)),
      `${s.id} : le défaut vaut ${s.variante.inconditionnel ? '« 7ᵉ coup seul »' : '« aucun ignore DEF »'}`);
    // L'ancien calcul (tous les coups ignorent) ne survit dans aucun cran.
    const ancien = s.variante.coups * s.variante.coef * 1000 * (1 + s.variante.skillupPct / 100) * defenseFactor(0);
    ok(crans.every((rang) => computeSkillDamage(p, BUILD, avec(s.id, rang), AUCUNE_AURA_PROPRE) < ancien - 1),
      `${s.id} : aucun cran n'atteint l'ancien « tous les coups ignorent » (le coup 1 reste mitigé)`);
  }
  // Sans DEF adverse, le rang ne change rien : la découpe ne fabrique ni ne
  // perd aucun coup. Comparaison à tolérance : deux découpes somment les mêmes
  // coups dans un autre regroupement, à un ulp près.
  const sansDef = { ...SETUP, enemyDef: 0 };
  const sansDefRang2 = computeSkillDamage(b, BUILD, { ...sansDef, premierCoupIgnoreDefParSort: { 14811: 2 } }, AUCUNE_AURA_PROPRE);
  const sansDefDefaut = computeSkillDamage(b, BUILD, sansDef, AUCUNE_AURA_PROPRE);
  const septCoupsSansDef = VARIANTE_B.coups * VARIANTE_B.coef * 1000 * (1 + VARIANTE_B.skillupPct / 100) * defenseFactor(0);
  ok(proche(sansDefRang2, sansDefDefaut) && proche(sansDefDefaut, septCoupsSansDef),
    'DEF adverse nulle : même total quel que soit le rang, les sept coups comptés');

  titre('Blade Dancers — 411 sur le premier coup seulement, PV de la cible enchaînés');

  // « Dgts CRIT 1re attaque » (411) : un seul coup en profite, le premier, qui
  // ne peut jamais ignorer la DEF — l'écart vaut ce bonus sur UN coup mitigé.
  const critique = { ...SETUP, critMode: 'crit' as const };
  for (const [p, coef, setupRang] of [
    [b, VARIANTE_B.coef, critique],
    [b, VARIANTE_B.coef, { ...critique, premierCoupIgnoreDefParSort: { 14811: 3 } }],
    [a, VARIANTE_A.coef, { ...critique, premierCoupIgnoreDefParSort: { 14808: 2 } }],
  ] as [SkillDamageProfile, number, DamageSetup][]) {
    const avec411 = computeSkillDamageDetail(p, BUILD, setupRang, AUCUNE_AURA_PROPRE, null, undefined, { ...ARTIFACT_DAMAGE_NEUTRE, cdPointsPremiereAttaque: 20 });
    const sans411 = computeSkillDamageDetail(p, BUILD, setupRang, AUCUNE_AURA_PROPRE, null, undefined, ARTIFACT_DAMAGE_NEUTRE);
    ok(proche(avec411.total - sans411.total, coef * 1000 * 0.2 * defenseFactor(1000)),
      `${p.skillCom2usId} rang ${resolvedPremierCoupIgnoreDef(p, setupRang)} : 411 compte une fois, sur le coup 1 mitigé`);
    ok(proche(avec411.pvRestantsPct, 100 * (1 - avec411.total / 1_000_000)), `${p.skillCom2usId} : les PV restants suivent le total des coups`);
  }

  titre('Blade Dancers — contrôle négatif : les ignore DEF inconditionnels inchangés');

  // IGNORE_DEF_COMPLET_CONNUS (Hero Strike, Strike of Fighter) et un effet
  // « Ignore DEF » sans condition (Lushen S3) : tous leurs coups ignorent, et le
  // nouveau champ, même renseigné pour eux, n'y change rien.
  for (const [forme, sortId, nom] of [[27612, 17407, 'Hero Strike'], [28112, 17907, 'Strike of Fighter'], [13413, 4713, 'Amputation Magic']] as [number, number, string][]) {
    const trouve = profilDe(forme, sortId);
    egal(trouve.nom, nom, `${forme}/${sortId} : ${nom}`);
    egal(trouve.ignoreDef, true, `${nom} : ignore toujours la DEF sur tous ses coups`);
    egal(trouve.ignoreDefAPartirDuCoup, undefined, `${nom} : aucune règle par rang`);
    egal(resolvedPremierCoupIgnoreDef(trouve, avec(sortId, 2)), null, `${nom} : le réglage par rang ne le concerne pas`);
    const normal = computeSkillDamage(trouve, BUILD, SETUP, AUCUNE_AURA_PROPRE);
    egal(computeSkillDamage(trouve, BUILD, { ...SETUP, enemyDef: 0 }, AUCUNE_AURA_PROPRE), normal, `${nom} : la DEF adverse ne compte pas`);
    egal(computeSkillDamage(trouve, BUILD, avec(sortId, 2), AUCUNE_AURA_PROPRE), normal, `${nom} : total inchangé avec le champ renseigné`);
  }

  titre('Blade Dancers — le réglage : champ propre au sort, donnée pure');

  egal(DAMAGE_SETUP_CLASSIFICATION.premierCoupIgnoreDefParSort, 'sort', 'premierCoupIgnoreDefParSort est classé « sort »');
  const regle: DamageSetup = { ...SETUP, premierCoupIgnoreDefParSort: { 14811: 3 } };
  egal(damageSetupApresChangementMonstre(regle).premierCoupIgnoreDefParSort, undefined,
    'changement d’espèce : le rang choisi est vidé, le défaut du nouveau sort s’applique');
  egal(DEFAULT_DAMAGE_SETUP.premierCoupIgnoreDefParSort, undefined, 'import de compte (défaut complet) : aucun rang choisi');
  egal(JSON.parse(JSON.stringify(regle.premierCoupIgnoreDefParSort)), { 14811: 3 }, 'le rang choisi est sérialisable tel quel');
}

// ── la recette et le CLI ────────────────────────────────────────────────────

// Cordelia (vent, éveillée) : son S3, Blade Dance of Night (14808), est de la
// variante A. Monstre minimal : ni runes ni artéfacts, le contexte de calcul
// du CLI ne lit que la fiche du sort et la recette.
const CORDELIA = 24913;
const LOADED_CORDELIA: LoadedMonster = {
  unitId: 1, com2usId: CORDELIA, monsterName: 'Cordelia',
  gear: { base: { hp: 10000, atk: 800, def: 600, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 }, runes: [], artifacts: [] },
  allRunes: [], allArtifacts: [], allRelics: [],
};

function recetteCordelia(premierCoupIgnoreDefParSort?: Record<number, number | null>): OptimizerRecipe {
  const damageSetup: DamageSetup = { ...DEFAULT_DAMAGE_SETUP, skillCom2usId: 14808 };
  if (premierCoupIgnoreDefParSort !== undefined) damageSetup.premierCoupIgnoreDefParSort = premierCoupIgnoreDefParSort;
  return buildOptimizerRecipe({
    monsterCom2usId: CORDELIA, monsterName: 'Cordelia',
    requirement: { sets: [], minStats: {} }, objective: 'degats_reels', damageSetup,
    metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'box', excludedSelectors: [],
    ignoreArtifacts: true, artifactMainByKind: {},
  });
}

export function testBladeDancersRecette() {
  titre('Blade Dancers — recette : `premierCoupIgnoreDefParSort` validé à l’import');

  const lire = (value: unknown) => parseOptimizerRecipe(JSON.stringify(value));
  const base = recetteCordelia({ 14808: 2 });
  const avecChamp = (champ: unknown) => lire({ ...base, damageSetup: { ...base.damageSetup, premierCoupIgnoreDefParSort: champ } });
  // `erreur` écrit « <chemin> <attente> » : l'espace final exige le chemin exact.
  const refuse = (resultat: ReturnType<typeof lire>, chemin: string) => resultat.recipe === null && !!resultat.error?.includes(`${chemin} `);
  const a = profilDe(CORDELIA, 14808);

  // Absent : une recette antérieure garde le défaut du sort, rien n'est ajouté.
  const sansChamp = lire(recetteCordelia());
  ok(sansChamp.recipe !== null, 'champ absent : recette acceptée');
  ok(!!sansChamp.recipe && !('premierCoupIgnoreDefParSort' in sansChamp.recipe.damageSetup), 'champ absent : aucune clé ajoutée à l’import');
  egal(sansChamp.recipe && resolvedPremierCoupIgnoreDef(a, sansChamp.recipe.damageSetup), null,
    'champ absent : défaut du sort au calcul (variante A, aucun ignore DEF)');

  // Présent et permis : chaque cran du sélecteur de l'écran, pour chacun des
  // six sorts, est accepté et transporté tel quel — les valeurs permises de la
  // recette et les crans de l'écran sortent de la MÊME règle curée.
  for (const s of SORTS) {
    for (const { rang, libelle } of cransIgnoreDefAPartirDuCoup(profilDe(s.formes[1], s.id)) ?? []) {
      egal(avecChamp({ [s.id]: rang }).recipe?.damageSetup.premierCoupIgnoreDefParSort, { [s.id]: rang },
        `${s.id} « ${libelle} » (${rang}) : accepté, transporté tel quel`);
    }
  }
  for (const [champ, motif] of [
    [{ 14811: 7, 14808: null }, 'deux sorts'], [{}, 'objet vide'],
  ] as [Record<number, number | null>, string][]) {
    egal(avecChamp(champ).recipe?.damageSetup.premierCoupIgnoreDefParSort, champ, `présent et permis, transporté tel quel : ${motif}`);
  }

  // Hors des crans du sort : REFUSÉ à l'import avec son chemin, jamais
  // ramené en silence au défaut. Le repli du calcul (`resolvedPremierCoupIgnoreDef`)
  // ne garde plus que ce qui n'arrive pas par une recette.
  const CHEMIN = 'damageSetup.premierCoupIgnoreDefParSort';
  for (const [champ, chemin, motif] of [
    [{ 14808: 1 }, `${CHEMIN}.14808`, 'variante A, coup 1 (n’ignore jamais)'],
    [{ 14808: 4 }, `${CHEMIN}.14808`, 'variante A, 4ᵉ coup (le sort en a 3)'],
    [{ 14808: 9 }, `${CHEMIN}.14808`, 'variante A, 9ᵉ coup'],
    [{ 14808: 0 }, `${CHEMIN}.14808`, 'variante A, rang 0'],
    [{ 14808: -2 }, `${CHEMIN}.14808`, 'variante A, rang négatif'],
    [{ 14811: null }, `${CHEMIN}.14811`, 'variante B, « aucun » (le 7ᵉ coup ignore toujours)'],
    [{ 14811: 1 }, `${CHEMIN}.14811`, 'variante B, coup 1'],
    [{ 14811: 8 }, `${CHEMIN}.14811`, 'variante B, 8ᵉ coup (le sort en a 7)'],
    [{ 14808: 2, 14811: null }, `${CHEMIN}.14811`, 'une entrée hors crans à côté d’une entrée permise'],
  ] as [unknown, string, string][]) {
    ok(refuse(avecChamp(champ), chemin), `refusé avec son chemin : ${motif}`);
  }
  ok(!!avecChamp({ 14808: 9 }).error?.includes(`${CHEMIN}.14808 doit valoir null, 2, 3 pour ce sort`),
    'message : les valeurs permises de la variante A');
  ok(!!avecChamp({ 14811: null }).error?.includes(`${CHEMIN}.14811 doit valoir 2, 3, 4, 5, 6, 7 pour ce sort`),
    'message : les valeurs permises de la variante B');

  // Clé d'un sort SANS cette règle : REFUSÉE avec son chemin — Lushen S3
  // (4713) et Hero Strike (17407) ignorent la DEF sur tous leurs coups.
  for (const [champ, chemin, motif] of [
    [{ 4713: 2 }, `${CHEMIN}.4713`, 'Lushen S3, rang 2'],
    [{ 4713: null }, `${CHEMIN}.4713`, 'Lushen S3, « aucun »'],
    [{ 17407: 2 }, `${CHEMIN}.17407`, 'Hero Strike, rang 2'],
    [{ 14808: 2, 4713: 2 }, `${CHEMIN}.4713`, 'clé sans règle à côté d’une clé permise'],
  ] as [unknown, string, string][]) {
    ok(refuse(avecChamp(champ), chemin), `refusé avec son chemin : ${motif}`);
  }
  egal(avecChamp({ 4713: 2 }).error, `Fichier invalide : ${CHEMIN}.4713 désigne un sort sans réglage d'ignore DEF par coup.`,
    'message : le sort n’a pas ce réglage — sans compter ni nommer les sorts de la table');

  // Mal typé ou mal indexé : refusé avec son chemin.
  for (const [champ, chemin, motif] of [
    [{ 14808: 2.5 }, `${CHEMIN}.14808`, 'rang non entier'],
    [{ 14808: '2' }, `${CHEMIN}.14808`, 'rang en texte'],
    [{ 14808: true }, `${CHEMIN}.14808`, 'rang booléen'],
    [{ 14808: [2] }, `${CHEMIN}.14808`, 'rang en liste'],
    [{ 14808: { rang: 2 } }, `${CHEMIN}.14808`, 'rang en objet'],
    [{ abc: 2 }, `${CHEMIN}.abc`, 'clé non numérique'],
    [{ 0: 2 }, `${CHEMIN}.0`, 'clé nulle'],
    [{ '-3': 2 }, `${CHEMIN}.-3`, 'clé négative'],
    [{ '14808.5': 2 }, `${CHEMIN}.14808.5`, 'clé non entière'],
    [{ '014808': 2 }, `${CHEMIN}.014808`, 'clé à zéro de tête (jamais lue par le calcul)'],
    [[2, 3], CHEMIN, 'liste au lieu d’un objet'],
    [2, CHEMIN, 'nombre au lieu d’un objet'],
    [null, CHEMIN, 'null au lieu d’un objet'],
  ] as [unknown, string, string][]) {
    ok(refuse(avecChamp(champ), chemin), `refusé avec son chemin : ${motif}`);
  }

  // Aller-retour export → import → export : aucune clé perdue ni ajoutée.
  const relue = lire(base).recipe;
  egal(relue?.damageSetup, base.damageSetup, 'aller-retour : damageSetup identique, rang compris');
  egal(relue && lire(relue).recipe, relue, 'aller-retour : un second import ne change rien');

  titre('Blade Dancers — recette : le CLI applique le rang, comme l’écran');

  // Le CLI passe `recipe.damageSetup` ENTIER au contexte de calcul
  // (`recipeToSearchParams`, puis `buildRealDamageContext` sur ses artéfacts),
  // comme l'écran (`setup: damageSetup`) : le rang voyage sans être relu
  // champ par champ, ni d'un côté ni de l'autre.
  const candidat = { runeIds: [], stats: BUILD, effTotal: 0 };
  const parLeCli = (texte: OptimizerRecipe) => {
    const recette = lire(texte).recipe;
    if (!recette) throw new Error('recette refusée');
    const ctx = buildRealDamageContext(recette, CORDELIA, recipeToSearchParams(recette, LOADED_CORDELIA).artifacts);
    if (!ctx) throw new Error('contexte de calcul du CLI absent');
    return { ctx, score: objectiveScore(candidat, 'degats_reels', AUCUNE_AURA_PROPRE, ctx) };
  };
  const cliDefaut = parLeCli(recetteCordelia());
  const cliAucun = parLeCli(recetteCordelia({ 14808: null }));
  const cliRang2 = parLeCli(recetteCordelia({ 14808: 2 }));
  const cliRang3 = parLeCli(recetteCordelia({ 14808: 3 }));
  egal(cliRang2.ctx.profile.skillCom2usId, 14808, 'CLI : le sort de la recette est retenu');
  egal(cliRang2.ctx.setup.premierCoupIgnoreDefParSort, { 14808: 2 }, 'CLI : le contexte de calcul porte le rang de la recette');
  egal(resolvedPremierCoupIgnoreDef(cliRang2.ctx.profile, cliRang2.ctx.setup), 2, 'CLI : rang retenu, dès le 2ᵉ coup');
  ok(cliRang2.score > cliRang3.score && cliRang3.score > cliDefaut.score,
    `CLI : dès le 2ᵉ (${cliRang2.score.toFixed(1)}) > dès le 3ᵉ (${cliRang3.score.toFixed(1)}) > défaut (${cliDefaut.score.toFixed(1)})`);
  egal(cliAucun.score, cliDefaut.score, 'CLI : « aucun » explicite note comme le champ absent (défaut de la variante A)');
  // Un rang hors crans n'atteint plus le calcul par une recette : l'écran et
  // le CLI la lisent par le MÊME parseur, qui la refuse avec son chemin.
  ok(refuse(lire(recetteCordelia({ 14808: 9 })), `${CHEMIN}.14808`), 'une recette au rang hors crans est refusée à la lecture');
  const chargeur = readFileSync(resolve(racine, 'scripts/lib/chargerRecette.ts'), 'utf8');
  ok(chargeur.includes("parseOptimizerRecipe(readFileSync(cheminRecette, 'utf8'))"), 'CLI : la recette passe par `parseOptimizerRecipe`');
  // L'écran : l'import pose `damageSetup` entier, sans reset ultérieur ; le
  // contexte de calcul et l'export le reprennent entier.
  const ecran = readFileSync(resolve(racine, 'src/components/outils/OptimizerSection.tsx'), 'utf8').replace(/\r\n/g, '\n');
  // La ligne lit aussi les `avertissements` du parseur.
  ok(ecran.includes('const { recipe, error, avertissements } = parseOptimizerRecipe(text);'), 'écran : la recette passe par le même `parseOptimizerRecipe`');
  ok(ecran.includes('setDamageSetup(recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP);'), 'écran : l’import de recette restaure damageSetup entier, rang compris');
  ok(/profile: resolvedSkill,\n\s*setup: damageSetup,\n/.test(ecran), 'écran : le contexte de calcul reçoit damageSetup entier, comme le CLI');
  ok(/buildOptimizerRecipe\(\{[\s\S]*?\n\s*damageSetup,\n/.test(ecran), 'écran : l’export emporte damageSetup entier');
  // Le cache de la file suit le rang : une autre valeur, d'autres scores.
  const signature = (damageSetup: DamageSetup) => signatureArtefacts({ monstreCom2usId: CORDELIA, damageSetup,
    compterAurasResPre: true, regimeEquipement: 'degats_reels', ignoreArtifacts: false, principaleParSorte: {},
    lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: null,
    requirement: { minStats: {}, maxStats: {} }, artefactsReserves: [], piecesFigees: [], importDuCompte: 0 });
  ok(signature(cliRang2.ctx.setup) !== signature(cliRang3.ctx.setup), 'cache de la file : changer de rang invalide la signature');
  egal(signature(cliRang2.ctx.setup), signature(parLeCli(recetteCordelia({ 14808: 2 })).ctx.setup), 'cache de la file : même rang, même signature');
}

// ── l'écran et la ligne du CLI ──────────────────────────────────────────────

const lireSource = (f: string) => readFileSync(resolve(racine, f), 'utf8').replace(/\r\n/g, '\n');
// Le code seul : un commentaire qui cite un nom ne doit ni faire échouer ni
// faire passer un contrôle (même outil que tests/proses-sort.test.ts).
const sansCommentaires = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

export function testBladeDancersEcranEtCli() {
  titre('Blade Dancers — les crans du sélecteur, dérivés de la règle curée');

  // Libellés retenus par l'utilisateur.
  const CRANS_A = [
    { rang: null, libelle: 'Aucun' }, { rang: 2, libelle: 'Dès le 2ᵉ coup' }, { rang: 3, libelle: 'Dès le 3ᵉ coup' },
  ];
  const CRANS_B = [
    { rang: 2, libelle: 'Dès le 2ᵉ coup' }, { rang: 3, libelle: 'Dès le 3ᵉ coup' }, { rang: 4, libelle: 'Dès le 4ᵉ coup' },
    { rang: 5, libelle: 'Dès le 5ᵉ coup' }, { rang: 6, libelle: 'Dès le 6ᵉ coup' }, { rang: 7, libelle: '7ᵉ coup seul' },
  ];
  const avec = (id: number, valeur: unknown): DamageSetup =>
    ({ ...SETUP, premierCoupIgnoreDefParSort: { [id]: valeur } as Record<number, number | null> });
  for (const s of SORTS) {
    const attendus = s.variante.inconditionnel === null ? CRANS_A : CRANS_B;
    for (const forme of s.formes) {
      const p = profilDe(forme, s.id);
      egal(cransIgnoreDefAPartirDuCoup(p), attendus,
        `${forme}/${s.id} : ${attendus.map((c) => `« ${c.libelle} »`).join(', ')}`);
    }
    const p = profilDe(s.formes[1], s.id);
    const defaut = attendus.find((c) => c.rang === s.variante.inconditionnel)!;
    egal(cranIgnoreDefRetenu(p, SETUP), defaut, `${s.id} : champ absent, le sélecteur montre le défaut « ${defaut.libelle} »`);
    for (const cran of attendus) {
      egal(cranIgnoreDefRetenu(p, avec(s.id, cran.rang)), cran, `${s.id} : « ${cran.libelle} » choisi, montré tel quel`);
      egal(resolvedPremierCoupIgnoreDef(p, avec(s.id, cran.rang)), cran.rang, `${s.id} : « ${cran.libelle} » = le rang du calcul`);
    }
    // Une valeur stockée hors crans : l'écran montre ce que le calcul applique.
    egal(cranIgnoreDefRetenu(p, avec(s.id, 1)), defaut, `${s.id} : coup 1 stocké → le sélecteur montre le défaut, comme le calcul`);
    egal(cranIgnoreDefRetenu(p, avec(s.id, 9)), defaut, `${s.id} : 9ᵉ coup stocké → le sélecteur montre le défaut, comme le calcul`);
  }
  const a = profilDe(24913, 14808);
  const b = profilDe(24911, 14811);
  egal(resumeIgnoreDefRetenu(a, SETUP), 'Ignore la DEF : aucun', 'résumé, variante A par défaut');
  egal(resumeIgnoreDefRetenu(a, avec(14808, 2)), 'Ignore la DEF : dès le 2ᵉ coup', 'résumé, variante A dès le 2ᵉ coup');
  egal(resumeIgnoreDefRetenu(b, SETUP), 'Ignore la DEF : 7ᵉ coup seul', 'résumé, variante B par défaut');
  egal(resumeIgnoreDefRetenu(b, avec(14811, 4)), 'Ignore la DEF : dès le 4ᵉ coup', 'résumé, variante B dès le 4ᵉ coup');

  titre('Blade Dancers — aucun autre sort du corpus n’a de sélecteur ni de ligne de résumé');

  // Balayage COMPLET : le sélecteur n'apparaît que pour ces six sorts. Un
  // réglage renseigné pour un autre sort n'y fait pas apparaître de ligne.
  const avecCrans: string[] = [];
  let autres = 0;
  for (const f of readdirSync(dossierSorts)) {
    if (!f.endsWith('.json')) continue;
    const detail: DetailMonstre = JSON.parse(readFileSync(resolve(dossierSorts, f), 'utf8'));
    for (const p of monsterDamageSkills(detail)) {
      if (!estPrisEnCharge(p)) continue;
      if (cransIgnoreDefAPartirDuCoup(p) !== null) avecCrans.push(`${detail.com2usId}/${p.skillCom2usId}`);
      else if (resumeIgnoreDefRetenu(p, avec(p.skillCom2usId, 2)) === null) autres++;
    }
  }
  egal(avecCrans.sort(), SORTS.flatMap((s) => s.formes.map((forme) => `${forme}/${s.id}`)).sort(),
    'crans proposés pour les douze formes des six sorts, et pour elles seules');
  ok(autres > 1000, `${autres} autres profils calculables : aucun cran, aucune ligne de résumé, même avec le champ renseigné`);
  for (const [forme, sortId, nom] of [[27612, 17407, 'Hero Strike'], [13413, 4713, 'Amputation Magic']] as [number, number, string][]) {
    egal(cransIgnoreDefAPartirDuCoup(profilDe(forme, sortId)), null, `${nom} (ignore DEF inconditionnel) : aucun sélecteur`);
  }

  titre('Blade Dancers — la DEF de la cible reste affichée dans tous les crans');

  // `champsDuCombat` ne lit QUE le profil, jamais le cran : la DEF compte pour
  // ces six sorts quel que soit le réglage, le coup 1 restant mitigé.
  for (const s of SORTS) {
    for (const forme of s.formes) {
      egal(champsDuCombat(profilDe(forme, s.id)).defEnnemie, true, `${forme}/${s.id} : la DEF de la cible est un réglage consommé`);
    }
  }
  const damage = lireSource('src/lib/damage.ts');
  ok(/export function champsDuCombat\(resolved: SkillDamageProfile \| null\): \{/.test(damage),
    '`champsDuCombat` ne reçoit que le sort, jamais le réglage : aucun cran ne peut masquer la DEF');
  const carte = sansCommentaires(lireSource('src/components/outils/DamageSetupCard.tsx'));
  ok(carte.includes('const { defEnnemie: montreDefEnnemie, crit: montreCritProfil } = champsDuCombat(resolved);'),
    'fenêtre : le champ DEF suit `champsDuCombat`');
  const section = sansCommentaires(lireSource('src/components/outils/OptimizerSection.tsx'));
  ok(/const champs = champsDuCombat\(resolvedSkill\);\s*if \(champs\.defEnnemie\) bouts\.push\(`DEF \$\{damageSetup\.enemyDef/.test(section),
    'résumé sous l’objectif : la DEF suit le même prédicat');

  titre('Blade Dancers — le sélecteur de l’écran, sous la liste des sorts (DamageSetupCard.tsx)');

  ok(carte.includes('const cransIgnoreDef = cransIgnoreDefAPartirDuCoup(resolved);'),
    'les crans du sort CHOISI, `null` pour tout autre sort');
  const bloc = carte.slice(carte.indexOf('{cransIgnoreDef && ('), carte.indexOf('</Selecteur>', carte.indexOf('{cransIgnoreDef && (')));
  ok(/^\{cransIgnoreDef && \(\s*<label className="mt-1 flex items-center gap-2">\s*<span className="text-xs text-ink-dim">Ignore la DEF \(jauge de la cible à 0\)<\/span>\s*<Selecteur\b/.test(bloc),
    'rendu sous la seule condition de crans ; libellé « Ignore la DEF (jauge de la cible à 0) »');
  egal((carte.match(/Ignore la DEF \(jauge de la cible à 0\)/g) ?? []).length, 1, 'un seul sélecteur dans la carte');
  ok(/taille="sm"\s*pleineLargeur=\{false\}\s*value=\{cranIgnoreDefRetenu\(resolved, setup\)\?\.rang \?\? ''\}/.test(bloc),
    'patron `Selecteur` des réglages de sort ; valeur = le cran RETENU par le calcul');
  ok(/premierCoupIgnoreDefParSort: \{\s*\.\.\.\(setup\.premierCoupIgnoreDefParSort \?\? \{\}\),\s*\[resolved\.skillCom2usId\]: e\.target\.value === '' \? null : Number\(e\.target\.value\),\s*\}/.test(bloc),
    'écriture : le rang (ou null pour « Aucun ») sous l’identifiant du sort choisi, les autres sorts conservés');
  ok(/\{cransIgnoreDef\.map\(\(c\) => \(\s*<option key=\{c\.rang \?\? 'aucun'\} value=\{c\.rang \?\? ''\}>\s*\{c\.libelle\}\s*<\/option>\s*\)\)\}/.test(bloc),
    'options : les crans et leurs libellés, tels que dérivés de la règle');
  egal((carte.match(/premierCoupIgnoreDefParSort/g) ?? []).length, 2, 'le réglage n’est écrit que par ce sélecteur');
  ok(carte.indexOf('{cransIgnoreDef && (') > carte.indexOf('{champCoupsVariables(resolved, setup, maj)}'),
    'placé SOUS la liste des sorts, dans « Compétence utilisée »');

  titre('Blade Dancers — le résumé du sort dit le cran retenu, sans rien déplacer');

  ok(carte.includes("return { ratio, reste: bouts.join(' · '), ignoreDef: resumeIgnoreDefRetenu(p, setup) };"),
    '`resumeSort` rend le cran retenu À PART du fil du résumé');
  egal((carte.match(/resumeIgnoreDefRetenu\(/g) ?? []).length, 1, 'la phrase n’entre jamais dans `reste` (une seule lecture)');
  const sorts = carte.slice(carte.indexOf('{skills.map((s) => {'), carte.indexOf('{champCoupsVariables('));
  ok(/const \{ ratio, reste, ignoreDef \} = resumeSort\(s, setup\);/.test(sorts), 'liste des sorts : le cran de chaque sort lu par `resumeSort`');
  ok(/\{reste\}\s*\{ignoreDef && <span className="block truncate">\{ignoreDef\}<\/span>\}/.test(sorts),
    'une ligne à elle, jamais plus haute qu’une ligne (`block truncate`) : changer de cran ne fait pas grandir la case');

  titre('Blade Dancers — la ligne du CLI dit le même cran (scripts/optimizer-search.ts)');

  const cli = sansCommentaires(lireSource('scripts/optimizer-search.ts'));
  ok(cli.includes('const ignoreDefRetenu = resumeIgnoreDefRetenu(profile, s);'), 'CLI : la MÊME phrase que le résumé de l’écran');
  ok(cli.includes("`${ignoreDefRetenu ? `, ${ignoreDefRetenu.charAt(0).toLowerCase()}${ignoreDefRetenu.slice(1)}` : ''}`"),
    'CLI : ajoutée à la ligne du sort (« , ignore la DEF : … »), rien pour les autres sorts');
}
