// Lot 5b (implementation-relique) — la résolution EXACTE de l'équipement par
// build (paire d'artéfacts ET relique, ensemble), la file, le classement, et
// le différentiel COMPLET de l'option A contre l'oracle.
//
// Référence de contrôle (`algo-verify`) : `oracleSearch` (scripts/lib/
// relicOracle.ts, lot 4) — N recherches du moteur d'avant, relique FIXÉE,
// sans aucune des éliminations que l'option A introduit. Ce fichier compare
// l'option A ENTIÈRE (moteur relâché de 5a + résolution exacte de ce lot,
// sur la partie pure `resoudreEquipementDuBuild`) à cet oracle, sur LE corpus
// de 5a (`CORPUS_5A`, neuf fixtures écrites à la main — pas de graine, le
// moteur n'a aucun aléa, A.6 bis).
//
// Ce qu'une perte VEUT DIRE (B.5b, « Preuve ») : un build faisable de
// l'oracle absent de l'option A se CLASSE par le candidat traceur de 5a —
// rejeté par un prédicat de faisabilité → faux négatif, ÉCHEC ; évincé par
// une structure bornée (`filterSlot`, tranches de `bucketCap`) → dilution,
// consignée pour B.6 ; arrêté par le budget → tronqué, à part. Le
// différentiel ne VAUT que sur un cas où aucune capacité n'est saturée —
// l'instrumentation le prouve pour chaque fixture, jamais « petit volume ».

import { ArtifactDetail, ElementKey, ArtifactArchetype, RelicDetail } from '../src/types';
import { computeStats } from '../src/lib/stats';
import { RelicContext, resoudreContexteRelique } from '../src/lib/relicOptim';
import type { RelicIntent } from '../src/hooks/useOptimizerState';
import {
  BuildCandidate,
  RealDamageContext,
  SearchParams,
  objectiveScore,
  pvEffectifs,
  searchBuilds,
  sortCandidates,
} from '../src/lib/runeBuildOptim';
import { ArtifactSearchParams, chercherPaires, respecteMinimums } from '../src/lib/artifactOptim';
import { RegimeArtefacts, regimeArtefacts } from '../src/lib/artifactEvaluation';
import { ResultatArtefacts, candidatAvecSaPaire, cleBuild, signatureReglages } from '../src/lib/artifactQueue';
import { EntreeResolution, etatReliqueDuBuild, reliqueEquipeeExclue, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { oracleSearch } from '../scripts/lib/relicOracle';
import { ReglagesDifferentiel, Saturation, classerPerte, cle, comparerOptionA, entreeResolution, resoudreTousLesCandidats, runesDe, saturationDe } from '../scripts/lib/relicDifferentiel';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BASE, CORPUS_5A, Fixture5a, LIBRE, params, relique, rune, six, stableStringify } from './relic-search.test';
import { egal, ok, titre } from './outils';

/* --------------------------------------------------------------------------
 * Les mécanismes du différentiel vivent dans `scripts/lib/relicDifferentiel.ts`
 * (lot 6, B.6 amendé) — extraits d'ici TELS QUELS ; ce test les réimporte et
 * garde ses assertions de corpus : ce sont elles qui prouvent que rien n'a
 * bougé. Le porteur des fixtures reste fixe (fire / attack) ; aucune paire
 * figée ici (inventaires vides, la paire vide), comme au lot 5b.
 * ----------------------------------------------------------------------- */

const PORTEUR = { element: 'fire' as ElementKey, archetype: 'attack' as ArtifactArchetype };

type Reglages = Omit<ReglagesDifferentiel, 'porteur'>;

function entree(p: SearchParams, c: BuildCandidate, ctx: RelicContext | undefined, r: Reglages): EntreeResolution {
  return entreeResolution(p, c, ctx, { ...r, porteur: PORTEUR });
}

function resoudre(p: SearchParams, c: BuildCandidate, ctx: RelicContext | undefined, r: Reglages): ResultatArtefacts {
  return resoudreEquipementDuBuild(entree(p, c, ctx, r));
}

/* --------------------------------------------------------------------------
 * Le différentiel complet — option A (moteur relâché + résolution exacte)
 * contre l'oracle, sur une fixture
 * ----------------------------------------------------------------------- */

type ClasseDePerte = 'faux négatif' | 'dilution' | 'tronqué' | 'non observable';
interface Perte { fixture: string; build: string; classe: ClasseDePerte; detail: string }
const pertes: Perte[] = [];

interface Differentiel {
  optimumA: { score: number; rids: number[]; cles: string[] } | null;
  optimumOracle: { score: number; rids: number[]; cles: string[] } | null;
  faisablesA: string[];
  faisablesOracle: string[];
  sature: Saturation;
}

function differentiel(fx: Fixture5a, reglages: Reglages, realDamage?: RealDamageContext | null): Differentiel {
  const nom = fx.nom;
  const p = { ...fx.p0, relicContext: fx.ctx };
  const oracle = oracleSearch(p, fx.ctx, { realDamage });
  const relaxed = searchBuilds(p);

  // L'option A : chaque candidat relâché résolu par la partie pure de la
  // file — TOUS (K = ∞), pas seulement le top-K de l'écran.
  const resolus = resoudreTousLesCandidats(p, relaxed, fx.ctx, { ...reglages, porteur: PORTEUR }, realDamage);
  // Aucun couple retenu ne viole ses conditions avec sa relique (assertion
  // finale redondante, côté test).
  ok(resolus.every((x) => x.conditionsRespectees), `${nom} : tout build retenu par A respecte minimums ET maximums avec sa relique`);

  // La saturation, mesurée sur la trace de l'optimum de l'oracle.
  const traceOpt = searchBuilds({ ...p, traceur: { runeIds: oracle.optimum!.runeIds } });
  const sature = saturationDe(p, traceOpt.traceur!, relaxed.truncated, relaxed.candidates.length);
  const cmp = comparerOptionA({ p, ctx: fx.ctx, oracle, relaxed, resolus, realDamage, traceOptimum: traceOpt.traceur, sature });
  const { faisablesA, faisablesOracle, optimumA, optimumOracle } = cmp;

  // Pertes : faisable pour l'oracle, absent de A → classées par le traceur.
  for (const k of cmp.perdus) {
    if (cmp.rejetesParResolution.includes(k)) {
      // Candidat relâché mais rejeté par la résolution exacte alors que
      // l'oracle le trouve faisable : un faux négatif de la résolution.
      pertes.push({ fixture: nom, build: k, classe: 'faux négatif', detail: 'candidat relâché, rejeté par la résolution exacte' });
    } else {
      const c = oracle.candidats.find((x) => cle(x.runeIds) === k)!;
      const { classe, detail } = classerPerte(p, c.runeIds);
      pertes.push({ fixture: nom, build: k, classe, detail });
    }
  }
  // Surplus : faisable pour A, absent de l'oracle. A ne juge un build
  // faisable qu'avec une relique RÉELLE (vérifié ci-dessus) : un surplus ne
  // serait pas une erreur d'exactitude mais une perte de l'ORACLE par ses
  // propres structures bornées (chaque run a le même `bucketCap`).
  egal(cmp.surplus, [], `${nom} : aucun build faisable pour A n'est absent de l'oracle`);
  egal(cmp.oracleNonConformes, [], `${nom} : tout candidat de l'oracle respecte les conditions avec la paire de référence`);

  console.log(`  · ${nom} — saturation : ${sature.detail}`);
  const aucuneSaturee = !sature.filterSlot && !sature.compartiments && !sature.maxCollected && !sature.maxMs;

  if (cmp.perdus.length === 0) {
    ok(aucuneSaturee, `${nom} : aucune capacité saturée — le différentiel vaut (${sature.detail})`);
    egal(faisablesA, faisablesOracle, `${nom} : même ensemble de builds faisables que l'oracle (${faisablesA.length})`);
    egal(optimumA?.score, optimumOracle?.score, `${nom} : même score d'optimum que l'oracle (${optimumOracle?.score})`);
    ok(cmp.fidele === true && cmp.statut === 'fidele', `${nom} : le point est fidèle (statut ${cmp.statut})`);
    if (optimumOracle && optimumOracle.rids.length === 1 && optimumA && optimumA.rids.length === 1) {
      egal(optimumA.rids[0], optimumOracle.rids[0], `${nom} : même rid d'optimum que l'oracle (${optimumOracle.rids[0]}, unique)`);
    } else {
      ok(true, `${nom} : rid non comparé — optimum ex æquo sur plusieurs rid (A ${JSON.stringify(optimumA?.rids)}, oracle ${JSON.stringify(optimumOracle?.rids)})`);
    }
  } else {
    const classes = pertes.filter((x) => x.fixture === nom).map((x) => `${x.build} → ${x.classe} (${x.detail})`);
    ok(pertes.filter((x) => x.fixture === nom).every((x) => x.classe !== 'faux négatif'), `${nom} : ${cmp.perdus.length} perte(s), aucune n'est un faux négatif — ${classes.join(' | ')}`);
    ok(!aucuneSaturee, `${nom} : une capacité est saturée, la perte est une dilution attendue (${sature.detail})`);
    egal(cmp.perteOptimum?.classe, pertes.find((x) => x.fixture === nom && x.build === optimumOracle?.cles[0])?.classe, `${nom} : la perte de l'optimum classée par comparerOptionA = celle du traceur rejoué`);
    console.log(`  · ${nom} — optimum A ${JSON.stringify(optimumA)} contre oracle ${JSON.stringify(optimumOracle)}`);
  }
  return { optimumA, optimumOracle, faisablesA, faisablesOracle, sature };
}

/* --------------------------------------------------------------------------
 * Constructeurs locaux
 * ----------------------------------------------------------------------- */

function art(id: number, kind: 'element' | 'archetype', main: [number, number], subs: { code: number; value: number }[] = []): ArtifactDetail {
  return kind === 'element'
    ? { id, kind, element: 'fire', level: 15, rarity: 5, main: { code: main[0], value: main[1] }, subs }
    : { id, kind, archetype: 'attack', level: 15, rarity: 5, main: { code: main[0], value: main[1] }, subs };
}

function contexte(intention: RelicIntent, equipee: RelicDetail | undefined, inventaire: RelicDetail[]): RelicContext {
  return resoudreContexteRelique(intention, equipee, inventaire);
}

function candidat(p: SearchParams, runeIds: number[]): BuildCandidate {
  const runes = runesDe(p, { runeIds } as BuildCandidate);
  return { runeIds, stats: computeStats({ base: p.base, runes, artifacts: p.artifacts, relic: p.relic }), effTotal: 0 };
}

function total(stats: { key: string; total: number }[], k: string): number {
  return stats.find((s) => s.key === k)!.total;
}

/* --------------------------------------------------------------------------
 * La référence de l'identité « écran sans contexte = base » : le corps de
 * `useArtifactOptimQueue.tranche()` au commit 26db0cc, recopié TEL QUEL
 * (algo-verify : une référence de contrôle, pas une réimplémentation
 * améliorée). `faire`, `calculerStats`, `respecteConditions` sont les trois
 * rappels que l'écran construisait (`faireParamsArtefacts`, `calculerStats`,
 * `respecteConditions`, OptimizerSection.tsx l. 2003–2100 au 2026-09-21).
 * ----------------------------------------------------------------------- */

function referenceBase26db0cc(
  suivant: BuildCandidate,
  faire: (c: BuildCandidate) => ArtifactSearchParams,
  calculerStats: (c: BuildCandidate, artefacts: ArtifactDetail[]) => ReturnType<typeof computeStats>,
  respecteConditions: ((c: BuildCandidate, artefacts: ArtifactDetail[]) => boolean) | null
): ResultatArtefacts {
  const r = chercherPaires(faire(suivant), Number.MAX_SAFE_INTEGER);
  let meilleure: (typeof r.paires)[number] | null = null;
  let artefactsRetenus: ArtifactDetail[] = [];
  let conforme = false;
  for (const p of r.paires) {
    const arts = [p.element, p.archetype].filter((a): a is ArtifactDetail => a != null);
    if (!meilleure) {
      meilleure = p;
      artefactsRetenus = arts;
    }
    if (!respecteConditions || respecteConditions(suivant, arts)) {
      meilleure = p;
      artefactsRetenus = arts;
      conforme = true;
      break;
    }
  }
  return {
    paire: meilleure,
    artefacts: artefactsRetenus,
    stats: calculerStats(suivant, artefactsRetenus),
    meilleurSansVerrous: r.meilleurSansVerrous,
    conforme,
  };
}

/* --------------------------------------------------------------------------
 * Les tests
 * ----------------------------------------------------------------------- */

export default function testRelicQueue() {
  titre('Optimizer · file relique (lot 5b — résolution exacte, classement, différentiel)');

  // Un pool à deux familles : ATQ % (slots 1–6, id 101–106) et PV % (201–206).
  const o = (slot: number, id: number) => rune(id, slot, [4, 63], [[10, 35]]);
  const p6 = (slot: number, id: number) => rune(id, slot, [2, 63], [], 'will');
  const pool = [...six(100, o), ...six(200, p6)];
  const PV14 = relique(1, 100, 14, 13);
  const ATQ14 = relique(2, 101, 14, 1);
  const DEF14 = relique(3, 102, 14, 4);

  /* ── Identité G — candidate = équipée → stats identiques au moteur actuel. */
  {
    const equipee = relique(900, 102, 14);
    const p = params(pool, { sets: [], minStats: {} }, { objective: 'ehp', relic: equipee });
    const ctx = contexte(LIBRE, equipee, [equipee]);
    const c = candidat(p, [101, 102, 103, 104, 105, 106]);
    const r = resoudre(p, c, ctx, { critere: 'ehp' });
    // Le moteur d'avant, relique fixée : les stats du candidat qu'il collecte.
    const moteur = searchBuilds({ ...p, relicContext: undefined }).candidates.find((x) => cle(x.runeIds) === cle(c.runeIds))!;
    egal(r.stats, moteur.stats, 'G identité : candidate = équipée → stats identiques à celles du moteur avec la relique fixe');
    egal(r.relique?.id, 900, 'G identité : la relique retenue est l’équipée');
    egal(total(r.stats, 'def'), 600 + Math.ceil((600 * 14) / 100), 'G identité : la principale DEF % +14 est appliquée exactement UNE fois');
  }

  /* ── Identité G — candidate différente → ancienne principale absente,
   * nouvelle présente une fois (remplacement, jamais cumul). */
  {
    const equipee = relique(900, 102, 14);
    const p = params(pool, { sets: [], minStats: {} }, { objective: 'ehp', relic: equipee });
    // Inventaire : l'équipée (type 1) et une ATQ % (type 1) ; filtre de
    // principale ATQ % → seule ATQ14 est éligible.
    const ctx = contexte({ ...LIBRE, principale: 101 }, equipee, [equipee, ATQ14]);
    egal(ctx.eligibles.map((r) => r.id), [2], 'G remplacement : seule la candidate ATQ % est éligible');
    const c = candidat(p, [201, 202, 203, 204, 205, 206]);
    const r = resoudre(p, c, ctx, { critere: 'ehp' });
    egal(r.relique?.id, 2, 'G remplacement : la candidate ATQ % remplace l’équipée DEF %');
    egal(total(r.stats, 'def'), 600, 'G remplacement : l’ancienne principale (DEF % +14) est ABSENTE des stats');
    egal(total(r.stats, 'atk'), 700 + Math.ceil((700 * 14) / 100), 'G remplacement : la nouvelle principale (ATQ % +14) est présente exactement UNE fois');
    egal(r.stats, computeStats({ base: BASE, runes: runesDe(p, c), artifacts: [], relic: ATQ14 }), 'G remplacement : stats = computeStats avec la candidate à la place de l’équipée');
  }

  /* ── Identité — `mode: 'off'` et `equipped` → byte-identiques au chemin
   * sans contexte ; chemin écran sans contexte = corps du commit de base. */
  {
    const equipee = relique(900, 102, 14);
    const arts = [art(11, 'element', [101, 100]), art(12, 'element', [100, 300]), art(13, 'archetype', [102, 100]), art(14, 'archetype', [101, 100])];
    const p = params(pool, { sets: [], minStats: { def: 600 + Math.ceil((600 * 14) / 100) + 100 } }, { objective: 'ehp', relic: equipee });
    const reglages: Reglages = { critere: 'atk', inventaireArtefacts: arts };
    for (const c of [candidat(p, [101, 102, 103, 104, 105, 106]), candidat(p, [201, 202, 203, 104, 105, 106]), candidat(p, [201, 202, 203, 204, 205, 206])]) {
      const sans = resoudre(p, c, undefined, reglages);
      const off = resoudre(p, c, contexte({ mode: 'off', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, [equipee]), reglages);
      const equipped = resoudre(p, c, contexte({ mode: 'equipped', principale: 'equipped', type: 'libre', seuil: 6 }, equipee, [equipee]), reglages);
      ok(stableStringify(sans) === stableStringify(off), `identité : mode off = byte-identique au chemin sans contexte (${cle(c.runeIds)})`);
      ok(stableStringify(sans) === stableStringify(equipped), `identité : mode equipped = byte-identique au chemin sans contexte (${cle(c.runeIds)})`);
      // La référence du commit de base, avec les trois rappels de l'écran.
      const e = entree(p, c, undefined, reglages);
      const ref = referenceBase26db0cc(
        c,
        () => e.faireParams(equipee),
        (_c, a) => computeStats({ ...e.gear, artifacts: a }),
        (_c, a) => respecteMinimums(computeStats({ ...e.gear, artifacts: a }), p.requirement.minStats)
      );
      ok(stableStringify(sans) === stableStringify(ref), `identité : chemin écran sans contexte = corps de tranche() du commit 26db0cc (${cle(c.runeIds)})`);
      // Un cas où la conformité compte : le minimum DEF impose l'artéfact DEF.
      ok(sans.conforme && sans.artefacts.some((a) => a.id === 13), `identité : la paire retenue tient le minimum DEF (artéfact 13 présent, ${cle(c.runeIds)})`);
    }
    // Sans contexte, aucune relique n'est « retenue » : la portée est fixe.
    egal(resoudre(p, candidat(p, [101, 102, 103, 104, 105, 106]), undefined, reglages).relique, undefined, 'identité : sans contexte, ResultatArtefacts.relique reste absent (relique portée fixe)');
    egal(etatReliqueDuBuild(undefined, undefined, equipee), { etat: 'fixe', relique: equipee }, 'état : sans contexte → fixe, la portée');
  }

  /* ── L'ordre du contrat : filtre AVANT le max — la meilleure paire au score
   * viole un maximum, la suivante non ; jamais « meilleur puis filtre ». */
  {
    const equipee = relique(900, 100, 14);
    const c0 = [101, 102, 103, 104, 105, 106];
    // Runes : ATQ 700 + ceil(700 × 378 / 100) = 3346 ; avec ATQ % +14 : 3444.
    const atkRunes = 700 + Math.ceil((700 * 378) / 100);
    const atkAvecAtq14 = 700 + Math.ceil((700 * (378 + 14)) / 100);
    const max = atkAvecAtq14 + 50; // 3494
    const p = params(pool, { sets: [], minStats: {}, maxStats: { atk: max } }, { objective: 'ehp', relic: equipee });
    const ctx = contexte(LIBRE, equipee, [equipee, ATQ14]);
    const c = candidat(p, c0);
    // (a) Artéfact ATQ +200 : tout couple qui le porte dépasse le maximum
    // (3546, 3644) ; le meilleur FAISABLE est (ATQ % +14, paire vide) = 3444.
    // Un « meilleur puis filtre » aurait retenu (PV % +14, +200) puis rejeté.
    {
      const arts = [art(11, 'element', [101, 200])];
      const r = resoudre(p, c, ctx, { critere: 'atk', inventaireArtefacts: arts });
      ok(r.conforme, 'ordre (a) : un couple faisable existe');
      egal(r.relique?.id, 2, 'ordre (a) : la relique ATQ % +14 est retenue (régime ATQ)');
      egal(r.artefacts, [], 'ordre (a) : la paire VIDE est retenue — l’artéfact ATQ +200, meilleur au score, dépasse le maximum');
      egal(total(r.stats, 'atk'), atkAvecAtq14, `ordre (a) : ATQ ${atkAvecAtq14} ≤ ${max} avec la relique, sans l’artéfact`);
      // Le score du couple retenu est l'UNIQUE note : celle d'`evaluer` sur
      // ses paires, égale au régime appliqué aux stats exactes.
      egal(r.paire?.score, total(r.stats, 'atk'), 'ordre (a) : une seule note — le score de la paire = le régime (ATQ) sur les stats exactes');
      // Sans contexte (chemin d'avant), le maximum n'est PAS vérifié par la
      // file (T11, hors chantier) : l'artéfact ATQ est retenu.
      const avant = resoudre(p, c, undefined, { critere: 'atk', inventaireArtefacts: arts });
      egal(avant.artefacts.map((a) => a.id), [11], 'ordre (T11, documenté) : sans contexte, la file d’avant ne lit que les minimums et garde l’artéfact ATQ');
    }
    // (b) Artéfact ATQ +100 : (PV % +14, +100) = 3446 tient le maximum et
    // bat (ATQ % +14, vide) = 3444 — la paire et la relique se résolvent
    // ENSEMBLE : choisir la relique d'abord (ATQ %) puis la paire aurait
    // rendu 3444.
    {
      const arts = [art(11, 'element', [101, 100])];
      const r = resoudre(p, c, ctx, { critere: 'atk', inventaireArtefacts: arts });
      egal([r.relique?.id, r.artefacts.map((a) => a.id)], [900, [11]], 'ordre (b) : (PV % +14, ATQ +100) = 3446 bat (ATQ % +14, vide) = 3444 — paire et relique résolues ENSEMBLE');
      egal(total(r.stats, 'atk'), atkRunes + 100, 'ordre (b) : ATQ 3446 ≤ 3494');
    }
  }

  /* ── BLOQUANT 1 de la revue adversariale du lot 5b (2026-09-21,
   * `revue-diff-lot5b-2026-09-21.md`) : le préfiltre de dominance de
   * `chercherPaires` éliminait le meilleur couple FAISABLE avant tout
   * contrôle du maximum — deux artéfacts ATQ de même sorte, seul le plus
   * PETIT apport tient le maximum. Sans `maxStatsActifs`, il disparaissait
   * de `chercherPaires` avant même que `respecteConditionsAvecRelique` ne
   * voie le maximum (cas exécuté par la revue, reproduit ici via le chemin
   * complet `resoudreEquipementDuBuild` — la version isolée sur
   * `preFiltrerCandidats` est dans tests/artefact-optim.test.ts). */
  {
    const equipee = relique(900, 100, 14); // PV % : n'affecte pas l'ATQ, isole le cas
    const c0 = [101, 102, 103, 104, 105, 106];
    const atkRunes = 700 + Math.ceil((700 * 378) / 100); // 3346, comme ci-dessus
    const grand = art(21, 'element', [101, 100]); // ATQ +100
    const petit = art(22, 'element', [101, 90]); // ATQ +90
    const max = atkRunes + 95; // sous +100 (3446), au-dessus de +90 (3436)
    const p = params(pool, { sets: [], minStats: {}, maxStats: { atk: max } }, { objective: 'ehp', relic: equipee });
    const ctx = contexte(LIBRE, equipee, [equipee]);
    const arts = [grand, petit];
    const r = resoudre(p, candidat(p, c0), ctx, { critere: 'atk', inventaireArtefacts: arts });
    ok(r.conforme, 'BLOQUANT 1 : un couple faisable existe — le plus petit apport');
    egal(r.artefacts.map((a) => a.id), [22], 'BLOQUANT 1 : la paire retenue porte l’artéfact ATQ +90, jamais le +100 (dépasse le maximum)');
    egal(total(r.stats, 'atk'), atkRunes + 90, 'BLOQUANT 1 : ATQ = runes + 90, sous le maximum');
    // « faisable rejeté » (deuxième cas de la revue) : un minimum QUE SEUL
    // le couple (+90) satisfait encore — le build FAISABLE doit rester
    // CONSERVÉ, jamais rejeté.
    const pMin = { ...p, requirement: { sets: [], minStats: { atk: atkRunes + 50 }, maxStats: { atk: max } } };
    const rMin = resoudre(pMin, candidat(pMin, c0), ctx, { critere: 'atk', inventaireArtefacts: arts });
    egal(rMin.conforme, true, 'BLOQUANT 1 : avec un minimum entre les deux apports, le build faisable (+90) reste CONSERVÉ');
    egal(rMin.artefacts.map((a) => a.id), [22], 'BLOQUANT 1 : … toujours avec l’artéfact +90');
    // Sans maximum actif : identité — la dominance élimine encore le plus
    // petit apport, comportement d'avant, byte-identique.
    const pSansMax = { ...p, requirement: { sets: [], minStats: {} } };
    const rSansMax = resoudre(pSansMax, candidat(pSansMax, c0), ctx, { critere: 'atk', inventaireArtefacts: arts });
    egal(rSansMax.artefacts.map((a) => a.id), [21], 'BLOQUANT 1 : sans maximum actif, le plus grand apport (+100) l’emporte — identité');
  }

  /* ── Contre-exemple B1 côté file : maximum PV actif, deux reliques PV %,
   * seule la plus basse faisable ; un build que TOUTE relique fait dépasser
   * est rejeté. */
  {
    const haute = relique(51, 100, 14);
    const basse = relique(52, 100, 12);
    const c0 = [101, 102, 103, 104, 105, 106]; // runes ATQ % : PV = 10000 + ceil(10000 × L / 100)
    const p = params(pool, { sets: [], minStats: {}, maxStats: { hp: 11300 } }, { objective: 'ehp' });
    const ctx = contexte(LIBRE, undefined, [haute, basse]);
    const c = candidat(p, c0);
    const r = resoudre(p, c, ctx, { critere: 'ehp' });
    ok(r.conforme, 'B1 file : un couple faisable existe');
    egal(r.relique?.id, 52, 'B1 file : seule la PV % +12 est faisable (11200 ≤ 11300 ; +14 → 11400 rejetée)');
    egal(total(r.stats, 'hp'), 11200, 'B1 file : PV = 11200 avec la +12');
    // Le moteur relâché (Lmin = 0 en libre) garde ce build ; la file décide.
    const relaxed = searchBuilds({ ...p, relicContext: ctx });
    ok(relaxed.candidates.some((x) => cle(x.runeIds) === cle(c0)), 'B1 file : le moteur relâché garde le build (borne max = 0 en libre)');
    // Maximum sous la plus basse : aucun couple faisable → rejeté.
    const pRejet = { ...p, requirement: { sets: [], minStats: {}, maxStats: { hp: 11100 } } };
    const rejet = resoudre(pRejet, candidat(pRejet, c0), ctx, { critere: 'ehp' });
    egal(rejet.conforme, false, 'B1 file : maximum 11100 → aucune relique éligible ne tient, build REJETÉ');
    egal(etatReliqueDuBuild(rejet, ctx, undefined).etat, 'rejete', 'B1 file : état « rejeté » — jamais affiché');
    ok(searchBuilds({ ...pRejet, relicContext: ctx }).candidates.some((x) => cle(x.runeIds) === cle(c0)), 'B1 file : … alors que le moteur relâché l’avait gardé (faux positif de la borne, filtré ici)');
  }

  /* ── Régime `aucun` (Efficience, Vitesse) : équipée si candidate et
   * faisable, sinon première par id ; `sansEffetSurLeTri` transporté. */
  {
    const p = params(pool, { sets: [], minStats: {} }, { objective: 'efficience', relic: ATQ14 });
    const c = candidat(p, [101, 102, 103, 104, 105, 106]);
    const avecEquipee = resoudre(p, c, contexte(LIBRE, ATQ14, [PV14, ATQ14, DEF14]), { critere: 'efficience' });
    egal(avecEquipee.relique?.id, 2, 'régime aucun : l’équipée (id 2) est retenue quand elle est candidate');
    egal(avecEquipee.sansEffetSurLeTri, true, 'régime aucun : sansEffetSurLeTri transporté');
    const sansEquipee = resoudre({ ...p, relic: undefined }, c, contexte(LIBRE, undefined, [DEF14, PV14]), { critere: 'efficience' });
    egal(sansEquipee.relique?.id, 1, 'régime aucun : sans équipée candidate, la première par id (1)');
    egal(etatReliqueDuBuild(avecEquipee, contexte(LIBRE, ATQ14, [PV14, ATQ14, DEF14]), ATQ14), { etat: 'resolue', relique: ATQ14, sansEffetSurLeTri: true, equipeeExclue: false }, 'régime aucun : état résolu avec la marque');
    // Vitesse (tri VIT) : même régime `aucun`.
    const vit = resoudre({ ...p, objective: 'vitesse' }, c, contexte(LIBRE, undefined, [DEF14, PV14]), { critere: 'spd' });
    egal(vit.sansEffetSurLeTri, true, 'régime aucun : le tri VIT est aussi sans effet sur le tri');
  }

  /* ── Les quatre exemples du plan § 2.4 — le bouton choisit le régime
   * (`adapterAuTri ? sortBy : objective`) ; objectif de recherche PV
   * effectifs, tri ATQ. */
  {
    const p = params(pool, { sets: [], minStats: {} }, { objective: 'ehp' });
    const inv = [PV14, ATQ14];
    const ctx = contexte(LIBRE, undefined, inv);
    const c = candidat(p, [101, 102, 103, 104, 105, 106]);
    const signature = (regime: RegimeArtefacts) =>
      signatureReglages({ monstreCom2usId: 1, damageSetup: {}, objective: regime, ignoreArtifacts: false, principaleParSorte: {}, lignesVerrouillees: [], relique: null, nbArtefacts: 0, empreinteRelique: ctx.empreinte, requirement: { minStats: {} } });

    // 1. tri ATQ + bouton actif : la relique maximise le tri (ATQ).
    const ex1 = resoudre(p, c, ctx, { critere: 'atk' });
    egal(ex1.relique?.id, 2, 'plan § 2.4 ex. 1 : tri ATQ + bouton actif → la relique maximise le tri (ATQ % +14)');
    // 2. tri ATQ + bouton inactif : la relique suit l'objectif (PV effectifs).
    const ex2 = resoudre(p, c, ctx, { critere: 'ehp' });
    egal(ex2.relique?.id, 1, 'plan § 2.4 ex. 2 : tri ATQ + bouton inactif → la relique suit l’objectif (PV % +14)');
    egal(ex2.paire?.score, pvEffectifs(ex2.stats), 'plan § 2.4 ex. 2 : une seule note — score de la paire = PV effectifs des stats exactes');
    // 3. changement de tri PV effectifs → ATQ, bouton actif : le régime
    // effectif change, la signature aussi, la file ré-optimise.
    ok(signature(regimeArtefacts('ehp')) !== signature(regimeArtefacts('atk')), 'plan § 2.4 ex. 3 : bouton actif, changer le tri change le régime → la signature invalide le cache');
    egal([resoudre(p, c, ctx, { critere: 'ehp' }).relique?.id, resoudre(p, c, ctx, { critere: 'atk' }).relique?.id], [1, 2], 'plan § 2.4 ex. 3 : … et la relique est ré-optimisée selon le nouveau régime');
    // 4. même changement, bouton inactif : le régime reste l'objectif, la
    // signature ne bouge pas, la relique non plus ; seul le classement change.
    egal(signature(regimeArtefacts('ehp')), signature(regimeArtefacts('ehp')), 'plan § 2.4 ex. 4 : bouton inactif, le régime effectif reste l’objectif → signature identique, cache conservé');
    const c2 = candidat(p, [201, 202, 203, 204, 205, 206]);
    const cache = new Map([[cleBuild(c), resoudre(p, c, ctx, { critere: 'ehp' })], [cleBuild(c2), resoudre(p, c2, ctx, { critere: 'ehp' })]]);
    egal([...cache.values()].map((r) => r.relique?.id), [1, 1], 'plan § 2.4 ex. 4 : les reliques ne bougent pas (PV % pour les deux)');
    const enrichis = [c, c2].map((x) => candidatAvecSaPaire(x, cache));
    const parEhp = sortCandidates(enrichis, 'ehp').map((x) => cle(x.runeIds));
    const parAtk = sortCandidates(enrichis, 'atk').map((x) => cle(x.runeIds));
    egal(parEhp[0], cle(c2.runeIds), 'plan § 2.4 ex. 4 : classé par PV effectifs, le build PV % passe devant');
    egal(parAtk[0], cle(c.runeIds), 'plan § 2.4 ex. 4 : classé par ATQ, le build ATQ % passe devant — seul le classement a changé');
  }

  /* ── L'exemple du plan § 2.3 en Dégâts réels (Sonia, sort scalant sur
   * l'ATQ) : ATQ % + exclusive NON offensive (Régénération, 16) l'emporte sur
   * DEF % + exclusive offensive (Conquête, 1) — l'exclusive n'entre pas dans
   * le score (D9), la principale décide par son effet RÉEL. */
  {
    const recette = { objective: 'degats_reels', damageSetup: { skillCom2usId: 15908, enemyDef: 2000, enemyHp: 60000, critMode: 'crit' } } as OptimizerRecipe;
    const realDamage = buildRealDamageContext(recette, 26113, []);
    ok(realDamage != null, 'plan § 2.3 : contexte de dégâts réels construit (Sonia, fonction CLI partagée)');
    const p = params(pool, { sets: [], minStats: {} }, { objective: 'degats_reels' });
    const atqNonOff = relique(61, 101, 12, 16);
    const defOff = relique(62, 102, 12, 1);
    const ctx = contexte(LIBRE, undefined, [defOff, atqNonOff]);
    const c = candidat(p, [201, 202, 203, 204, 205, 206]);
    const r = resoudre(p, c, ctx, { critere: 'degats_reels', degats: realDamage });
    egal(r.relique?.id, 61, 'plan § 2.3 : l’ATQ % à exclusive non offensive bat la DEF % à exclusive offensive (le sort scale sur l’ATQ)');
    egal(r.paire?.score, objectiveScore({ ...c, stats: r.stats }, 'degats_reels', realDamage!), 'plan § 2.3 : la note est celle de computeTotalDamage sur les stats exactes, une seule fois');
    // Le régime « Dégâts réels » sans contexte de dégâts est rabattu sur
    // `aucun` par l'appelant, jamais absorbé : ici, la relique n'a pas d'effet.
    const sansSort = resoudre(p, c, ctx, { critere: 'degats_reels', degats: null });
    egal(sansSort.sansEffetSurLeTri, true, 'plan § 2.3 : sort non calculable → régime aucun, dit par sansEffetSurLeTri');
  }

  /* ── « Équipée meilleure mais exclue » : non-régression CONDITIONNELLE. */
  {
    const equipee = relique(900, 100, 14, 1);
    const admissible = relique(901, 100, 10, 13);
    const p = params(pool, { sets: [], minStats: {} }, { objective: 'ehp', relic: equipee });
    // Filtre de type Origine (13) : l'équipée (type 1) sort du pool.
    const ctx = contexte({ ...LIBRE, type: 13 }, equipee, [equipee, admissible]);
    egal(ctx.eligibles.map((r) => r.id), [901], 'équipée exclue : le pool ne contient que l’admissible');
    ok(reliqueEquipeeExclue(ctx), 'équipée exclue : le contexte le dit');
    const c = candidat(p, [201, 202, 203, 204, 205, 206]);
    const r = resoudre(p, c, ctx, { critere: 'ehp' });
    egal(r.relique?.id, 901, 'équipée exclue : la meilleure ADMISSIBLE est retenue');
    const scoreRetenu = pvEffectifs(r.stats);
    const scoreEquipee = pvEffectifs(computeStats({ base: BASE, runes: runesDe(p, c), artifacts: [], relic: equipee }));
    const scoreSansRelique = pvEffectifs(computeStats({ base: BASE, runes: runesDe(p, c), artifacts: [] }));
    ok(scoreRetenu < scoreEquipee, `équipée exclue : elle note MOINS que l’équipée (${scoreRetenu} < ${scoreEquipee}) — légitime`);
    ok(scoreRetenu >= scoreSansRelique, `équipée exclue : … mais jamais moins que l’état de référence du même ensemble admissible (sans relique, ${scoreSansRelique})`);
    egal(etatReliqueDuBuild(r, ctx, equipee), { etat: 'resolue', relique: admissible, sansEffetSurLeTri: false, equipeeExclue: true }, 'équipée exclue : le candidat porte « relique équipée exclue par le filtre »');
    // Et « en attente » : pas encore dans le cache.
    egal(etatReliqueDuBuild(undefined, ctx, equipee), { etat: 'en attente' }, 'en attente : un build absent du cache le dit, en mode recherche');
  }

  /* ── Le différentiel complet sur le corpus de 5a (A–H + F bis). Le régime
   * suit l'objectif de chaque fixture (bouton inactif — l'oracle note par
   * `params.objective`). */
  titre('Optimizer · file relique — différentiel complet contre l’oracle (corpus 5a)');
  const fixtures: Fixture5a[] = [CORPUS_5A.A, CORPUS_5A.B, CORPUS_5A.C, CORPUS_5A.D, CORPUS_5A.E, CORPUS_5A.F, CORPUS_5A.Fbis, CORPUS_5A.G, CORPUS_5A.H];
  const resultats: Record<string, Differentiel> = {};
  for (const fx of fixtures) {
    resultats[fx.nom] = differentiel(fx, { critere: fx.p0.objective ?? 'efficience' });
  }
  // Fixture A : l'optimum de l'oracle (DEF % +14, rid 901) — la relaxation le
  // rend candidat, la résolution exacte le retient avec la bonne relique.
  egal(resultats.A!.optimumA?.rids, [901], 'A : la résolution exacte retient la DEF % +14 (rid 901) sur l’optimum');
  // Fixture B : O (faux positif de la borne) est rejeté par la résolution.
  ok(!resultats.B!.faisablesA.includes(cle([101, 102, 103, 104, 105, 106])), 'B : le faux positif O est rejeté par la résolution exacte (aucune relique seule ne tient PV ET DEF)');
  // Fixture F bis : la branche maximum, principale forcée (N = 1).
  egal(resultats['F bis']!.optimumA?.rids, [951], 'F bis : 104 ≤ 104 avec la +1 — retenue');

  console.log(`  · pertes classées : ${pertes.length === 0 ? 'aucune' : pertes.map((x) => `${x.fixture} ${x.build} → ${x.classe} (${x.detail})`).join(' | ')}`);
  ok(pertes.every((x) => x.classe !== 'faux négatif'), 'différentiel : aucune perte n’est un faux négatif (dilution et tronqué seuls admis)');
  egal(pertes.filter((x) => x.classe === 'tronqué').length, 0, 'différentiel : aucune perte par troncature (maxMs infini, MAX_COLLECTED non atteint)');
}

export { pertes as pertesRelicQueue };
