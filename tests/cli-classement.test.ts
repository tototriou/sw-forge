// degats-et-aura 6bis-b5c — le classement du CLI (`optimizer-search.ts`, par
// `classerCommeLEcran`) contre celui de l'écran, dans les trois modes de
// relique, sur une vraie recherche (`runSearchToCompletion`, le chemin du
// script) et un vrai monstre (Lushen, pour le sort et l'éligibilité).
//
// L'écran est représenté par ses producteurs, assemblés ici comme
// OptimizerSection.tsx les assemble : `optionsDeClassement` (ordre de base
// et classement affiché, 6bis-b5a), `entreeResolutionDuBuild` +
// `resoudreEquipementDuBuild` (la file), `classementResolu` (`affichees`), et
// les conditions recalculées depuis la recette (`avecAurasConditions`, comme
// `requirementAvecAuras`). Seul `artifactParams` (un mémo React) n'a pas
// d'équivalent hors navigateur : son pendant CLI, `artefactsDuCli`, en tient
// lieu — c'est le maillon que ce test ne prouve pas.
//
// Attentes INDÉPENDANTES du chemin testé (A.6 bis : la note de référence est
// celle de la production pour l'équipement complet) :
// - chaque score imprimé = `scoreDeReference` de l'équipement complet du
//   build (ses runes, la paire et la relique retenues), qui recalcule tout
//   par `computeStats` et compte l'effet unique de SA relique ;
// - un build rejeté n'a AUCUN couple faisable : énumération exhaustive des
//   paires de l'inventaire (emplacement vide compris) × reliques éligibles,
//   sans `chercherPaires` ni dominance, par le prédicat exact
//   `respecteConditionsAvecRelique`.
//
// Fixture calibrée le 2026-10-01 (script d'exploration de la preuve
// controle-6bis-b5c.md) : trois runes par emplacement (ATQ, DEF, mixte),
// deux reliques — celle de la fiche, DEF % avec une Conquête sans effet
// (tranche 3 000), et une ATQ % avec Conquête 2 % par 1 000 ATQ —, quatre
// artéfacts à +50, minimums ATQ et DEF simultanés : le moteur relâche chaque
// stat séparément (meilleure relique, meilleur artéfact), une relique n'a
// qu'une principale et une paire deux emplacements, d'où des rejets.

import { ArtifactDetail, RelicDetail, RuneDetail } from '../src/types';
import { buildOptimizerRecipe, OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile } from '../src/lib/damage';
import {
  BuildCandidate,
  OptionsDeClassement,
  aurasPropresParRunes,
  avecAurasConditions,
  optionsDeClassement,
  respecteConditionsAvecRelique,
  scoreDeReference,
  scoreDuCandidat,
  sortCandidates,
} from '../src/lib/runeBuildOptim';
import { ResultatArtefacts, classementResolu, cleBuild } from '../src/lib/artifactQueue';
import { entreeResolutionDuBuild, etatReliqueDuBuild, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { regimeArtefacts, regimeEquipementDe } from '../src/lib/artifactEvaluation';
import { artefactsDuCli, recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { runSearchToCompletion } from '../scripts/lib/runSearch';
import { classerCommeLEcran } from '../scripts/lib/classementCli';
import { egal, ok, titre } from './outils';

const LUSHEN = 13413;
const BASE = { hp: 10000, atk: 1000, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function rune(id: number, slot: number, main: [number, number], subs: [number, number][]): RuneDetail {
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })) };
}
function art(id: number, kind: 'element' | 'archetype', code: number, value: number): ArtifactDetail {
  return { id, kind, ...(kind === 'element' ? { element: 'wind' as const } : { archetype: 'attack' as const }), level: 15, rarity: 5, main: { code, value }, subs: [] };
}
function relique(id: number, code: number, value: number, tranche: number, percent: number): RelicDetail {
  return { id, upgrade: 9, main: { code, value }, unique: { type: 1, tranche, percent } };
}

const POOL: RuneDetail[] = [];
// Valeurs décalées par emplacement : aucun ex æquo de stats entre deux builds
// qui ne diffèrent que par l'emplacement de leurs runes.
for (let s = 1; s <= 6; s++) {
  POOL.push(rune(1000 + 10 * s, s, [3, 100 + 3 * s], [[5, 10 + s]])); // dominante ATQ
  POOL.push(rune(1001 + 10 * s, s, [5, 100 + 2 * s], [[3, 10 + 2 * s]])); // dominante DEF
  POOL.push(rune(1002 + 10 * s, s, [3, 55 + s], [[5, 55 + 4 * s]])); // mixte
}
const RELIQUE_FICHE = relique(50, 102, 12, 3000, 1); // DEF +12 %, Conquête sans effet sous 3 000 ATQ
const RELIQUE_ATQ = relique(60, 101, 12, 1000, 2); // ATQ +12 %, Conquête +2 % par 1 000 ATQ
const ARTEFACTS = [art(901, 'element', 101, 50), art(902, 'element', 102, 50), art(903, 'archetype', 101, 50), art(904, 'archetype', 102, 50)];

const proche = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

function recette(mode: 'off' | 'equipped' | 'recherche', atk: number, def: number): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: LUSHEN, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: { atk, def } }, objective: 'degats_reels',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: mode === 'off',
    artifactMainByKind: { element: 'libre', archetype: 'libre' }, relicMainChoice: mode === 'recherche' ? 'libre' : 'equipped',
  });
}

const LOADED: LoadedMonster = {
  unitId: 1, com2usId: LUSHEN, monsterName: 'Lushen (test)',
  gear: { base: BASE, runes: [], artifacts: [], relic: RELIQUE_FICHE },
  allRunes: POOL, allArtifacts: ARTEFACTS, allRelics: [RELIQUE_FICHE, RELIQUE_ATQ],
};

/**
 * Le classement de l'écran, assemblé avec ses producteurs : l'ordre de base
 * (`fullSortedCandidates`), puis — optimisation d'artéfacts active — la file
 * résolue sur TOUS les candidats (son point fixe sur la page affichée) et
 * `affichees`.
 */
function classementEcran(recipe: OptimizerRecipe, candidats: BuildCandidate[], realDamage: ReturnType<typeof buildRealDamageContext>) {
  const params = recipeToSearchParams(recipe, LOADED);
  const fiche = LOADED.gear; // `selected.gear`
  const relicContextRecherche = params.relicContext; // `run(params)` à l'écran
  const damageSetup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const runeById = new Map(POOL.map((r) => [r.id, r]));
  const aurasPropresDe = aurasPropresParRunes(runeById);
  const contexteExclusive = { setup: damageSetup, element: 'wind' as const };
  const commun = { realDamage, damageSetup, runeById, metric: recipe.metric, aurasPropresDe, contexteExclusive };
  const fullSortedCandidates = sortCandidates(candidats, recipe.objective, optionsDeClassement({
    ...commun, artefactsDuBuild: () => null, etatReliqueDe: () => etatReliqueDuBuild(undefined, relicContextRecherche, fiche.relic),
  }));
  const optimiserArtefacts = !recipe.ignoreArtifacts;
  if (!optimiserArtefacts) {
    const options = optionsDeClassement({ ...commun, artefactsDuBuild: () => null, etatReliqueDe: () => etatReliqueDuBuild(undefined, relicContextRecherche, fiche.relic) });
    return { affichees: fullSortedCandidates, options, parBuild: new Map<string, ResultatArtefacts>() };
  }
  const a = artefactsDuCli(recipe, LOADED)!; // pendant d'`artifactParams` (voir en-tête)
  const regimeEquipement = regimeEquipementDe(regimeArtefacts(recipe.objective), a.degats != null);
  const requirementAvecAuras = avecAurasConditions(recipe.requirement, damageSetup, recipe.compterAurasResPre ?? true);
  const parBuild = new Map<string, ResultatArtefacts>();
  for (const c of fullSortedCandidates) {
    parBuild.set(cleBuild(c), resoudreEquipementDuBuild(entreeResolutionDuBuild({
      fiche, runes: c.runeIds.map((id) => runeById.get(id)!).filter(Boolean), artifactParams: a.params, regime: regimeEquipement,
      degats: a.degats, exclusive: contexteExclusive, requirement: requirementAvecAuras, relicContext: relicContextRecherche,
    })));
  }
  const profils = new Map([...parBuild].map(([k, r]) => [k, artifactDamageProfile(r.artefacts)]));
  const options = optionsDeClassement({
    ...commun,
    artefactsDuBuild: (c) => profils.get(cleBuild(c)) ?? null,
    etatReliqueDe: (c) => etatReliqueDuBuild(parBuild.get(cleBuild(c)), relicContextRecherche, fiche.relic),
  });
  return { affichees: classementResolu(fullSortedCandidates, parBuild, recipe.objective, options), options, parBuild };
}

export function testCliClassementParMode() {
  titre('CLI — résolution par build et classement de l’écran, trois modes de relique (6bis-b5c)');

  const cas: { mode: 'off' | 'equipped' | 'recherche'; atk: number; def: number }[] = [
    { mode: 'off', atk: 1250, def: 900 },
    { mode: 'equipped', atk: 1250, def: 900 },
    { mode: 'recherche', atk: 1400, def: 1000 },
  ];
  for (const { mode, atk, def } of cas) {
    const recipe = recette(mode, atk, def);
    const params = recipeToSearchParams(recipe, LOADED);
    egal(params.relicContext?.mode, mode, `${mode} : précondition, mode de relique du vrai producteur`);
    const res = runSearchToCompletion(params);
    ok(res.candidates.length > 0 && !res.truncated, `${mode} : ${res.candidates.length} candidat(s) collecté(s), recherche complète (tronqué : ${res.truncated})`);
    const realDamage = buildRealDamageContext(recipe, LUSHEN, params.artifacts);
    ok(realDamage != null, `${mode} : sort calculable`);

    // Le CLI : la fonction même que le script appelle.
    const cli = classerCommeLEcran({ recipe, loaded: LOADED, params, candidates: res.candidates, realDamage });
    egal(cli.resolu != null, mode !== 'off', `${mode} : résolution par build ${mode === 'off' ? 'absente (optimisation coupée, comme l’écran sans file)' : 'présente'}`);

    // L'écran, par ses producteurs.
    const ecran = classementEcran(recipe, res.candidates, realDamage);
    const top = (classes: BuildCandidate[], options: OptionsDeClassement) =>
      classes.slice(0, 5).map((c) => ({ cle: cleBuild(c), score: scoreDuCandidat(c, recipe.objective, options) }));
    const topCli = top(cli.classes, cli.options);
    const topEcran = top(ecran.affichees, ecran.options);
    egal(topCli.map((x) => x.cle), topEcran.map((x) => x.cle), `${mode} : mêmes cinq premiers que l’écran`);
    ok(topCli.every((x, i) => proche(x.score, topEcran[i].score)), `${mode} : mêmes scores que l’écran (${topCli.map((x) => x.score?.toFixed(2)).join(' ; ')})`);
    egal(cli.classes.length, ecran.affichees.length, `${mode} : même nombre de builds classés (${cli.classes.length})`);

    // La note de référence, indépendante du chemin : l'équipement complet de
    // chaque build classé, noté par `scoreDeReference`.
    const { artefacts: _profil, ...degats } = realDamage!;
    const ref = { degats, damageSetup: DEFAULT_DAMAGE_SETUP, exclusive: { setup: DEFAULT_DAMAGE_SETUP, element: 'wind' as const } };
    const runeById = new Map(POOL.map((r) => [r.id, r]));
    const equipement = (c: BuildCandidate) => {
      const r = cli.resolu?.parBuild.get(cleBuild(c));
      return {
        base: BASE,
        runes: c.runeIds.map((id) => runeById.get(id)!),
        artifacts: r ? r.artefacts : params.artifacts,
        relic: r?.relique ?? LOADED.gear.relic,
      };
    };
    const ecarts = cli.classes.filter((c) => !proche(scoreDuCandidat(c, recipe.objective, cli.options), scoreDeReference(recipe.objective, equipement(c), ref)));
    egal(ecarts.map(cleBuild), [], `${mode} : les ${cli.classes.length} scores du CLI = note de production de l’équipement complet (scoreDeReference)`);

    if (mode === 'recherche') {
      const resolu = cli.resolu!;
      ok(resolu.rejetes > 0, `recherche : ${resolu.rejetes} build(s) rejeté(s) faute de couple faisable`);
      const classesCles = new Set(cli.classes.map(cleBuild));
      const rejetes = [...resolu.parBuild].filter(([, r]) => !r.conforme).map(([k]) => k);
      ok(rejetes.every((k) => !classesCles.has(k)), 'recherche : aucun build rejeté n’est classé');
      // Énumération exhaustive, indépendante de `chercherPaires`.
      const elements: (ArtifactDetail | null)[] = [null, ...ARTEFACTS.filter((x) => x.kind === 'element')];
      const archetypes: (ArtifactDetail | null)[] = [null, ...ARTEFACTS.filter((x) => x.kind === 'archetype')];
      const faisable = (c: BuildCandidate) => params.relicContext!.eligibles.some((rel) =>
        elements.some((e) => archetypes.some((a) => respecteConditionsAvecRelique(
          { base: BASE, runes: c.runeIds.map((id) => runeById.get(id)!), artifacts: [e, a].filter((x): x is ArtifactDetail => x != null) },
          rel, params.requirement).respecte)));
      const parCle = new Map(res.candidates.map((c) => [cleBuild(c), c]));
      egal(rejetes.filter((k) => faisable(parCle.get(k)!)), [], `recherche : les ${rejetes.length} rejetés n’ont aucun couple faisable (énumération exhaustive)`);
      egal(cli.classes.filter((c) => !respecteConditionsAvecRelique(
        { base: BASE, runes: c.runeIds.map((id) => runeById.get(id)!), artifacts: resolu.parBuild.get(cleBuild(c))!.artefacts },
        resolu.parBuild.get(cleBuild(c))!.relique!, params.requirement).respecte).map(cleBuild), [],
      'recherche : chaque build classé respecte ses conditions avec son couple retenu');
      const rids = cli.classes.slice(0, 5).map((c) => resolu.parBuild.get(cleBuild(c))!.relique?.id);
      ok(rids.every((rid) => rid === RELIQUE_ATQ.id), `recherche : relique retenue ${RELIQUE_ATQ.id}, différente de celle de la fiche (${RELIQUE_FICHE.id}) — ${JSON.stringify(rids)}`);
      // Témoin de l'ancien CLI : il imprimait l'ordre de base, stats sans
      // relique et apport neutre. Pour le premier build classé, ce score-là
      // n'est pas la note de production de son équipement.
      const premier = cli.classes[0];
      const commeAvant = cli.base.find((c) => cleBuild(c) === cleBuild(premier))!;
      const avant = scoreDuCandidat(commeAvant, recipe.objective, cli.optionsBase)!;
      const production = scoreDeReference(recipe.objective, equipement(premier), ref)!;
      ok(avant < production, `témoin : l’ancien CLI notait ce build ${avant.toFixed(2)}, sous sa note de production ${production.toFixed(2)}`);
    }
    if (mode === 'equipped') {
      const etats = cli.classes.slice(0, 5).map((c) => cli.resolu!.parBuild.get(cleBuild(c))!.relique);
      ok(etats.every((r) => r === undefined), 'equipped : aucune relique résolue, celle de la fiche compte (état « fixe »)');
    }
  }
}
