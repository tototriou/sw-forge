// Le classement du CLI (`optimizer-search.ts`, par
// `classerCommeLEcran`) contre celui de l'écran, dans les trois modes de
// relique, sur une vraie recherche (`runSearchToCompletion`, le chemin du
// script) et un vrai monstre (Lushen, pour le sort et l'éligibilité).
//
// L'écran est représenté par ses producteurs, assemblés ici comme
// OptimizerSection.tsx les assemble : `optionsDeClassement` (ordre de base
// et classement affiché), `entreeResolutionDuBuild` +
// `resoudreEquipementDuBuild` (la file), `classementResolu` (`affichees`), et
// les conditions recalculées depuis la recette (`avecAurasConditions`, comme
// `requirementAvecAuras`). Seul `artifactParams` (un mémo React) n'a pas
// d'équivalent hors navigateur : son pendant CLI, `artefactsDuCli`, en tient
// lieu. Les deux passent par le même producteur
// (`parametresArtefactsFiche`) — prouvé à part, `artifact-params-fiche.test.ts`.
//
// Attentes INDÉPENDANTES du chemin testé (la note de référence est
// celle de la production pour l'équipement complet) :
// - chaque score imprimé = `scoreDeReference` de l'équipement complet du
//   build (ses runes, la paire et la relique retenues), qui recalcule tout
//   par `computeStats` et compte l'effet unique de SA relique ;
// - un build rejeté n'a AUCUN couple faisable : énumération exhaustive des
//   paires de l'inventaire (emplacement vide compris) × reliques éligibles,
//   sans `chercherPaires` ni dominance, par le prédicat exact
//   `respecteConditionsAvecRelique`.
//
// Fixture calibrée par un script d'exploration hors dépôt :
// trois runes par emplacement (ATQ, DEF, mixte),
// deux reliques — celle de la fiche, DEF % avec une Conquête sans effet
// (tranche 3 000), et une ATQ % avec Conquête 2 % par 1 000 ATQ —, quatre
// artéfacts à +50, minimums ATQ et DEF simultanés : le moteur relâche chaque
// stat séparément (meilleure relique, meilleur artéfact), une relique n'a
// qu'une principale et une paire deux emplacements, d'où des rejets.

import { isDeepStrictEqual } from 'node:util';
import { corpusAvecRejetes } from './relique-ou.test';
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
import { K_BUILDS_OPTIMISES, K_BUILDS_RECHERCHE_RELIQUE, ResultatArtefacts, cibleDeLaFile, classementResolu, cleBuild, prochainsATraiter } from '../src/lib/artifactQueue';
import { entreeResolutionDuBuild, etatReliqueDuBuild, nouveauxCachesResolution, resoudreEquipementDuBuild } from '../src/lib/relicQueue';
import { regimeArtefacts, regimeEquipementDe } from '../src/lib/artifactEvaluation';
import { artefactsDuCli, recipeToSearchParams, resoudreEquipementCli } from '../scripts/lib/recipeToSearchParams';
import { resoudreEquipementDuBuildExhaustif } from '../src/lib/resolutionExhaustive';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { runSearchToCompletion } from '../scripts/lib/runSearch';
import { LIGNES_IMPRIMEES, classerCommeLEcran } from '../scripts/lib/classementCli';
import { egal, ok, titre } from './outils';
import { CorpsClassement, type PublicationClassement, type VueClassement } from '../src/lib/classementCompact';
import { contexteDeResultatCli } from '../scripts/lib/classementCli';
import { compositionDePage } from '../src/lib/artifactQueue';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../src/lib/candidatsCompacts';
import { ResolutionDistante } from '../src/workers/resolutionDistante';
import { AdaptateurClassement } from '../src/lib/adaptateurClassement';
import { optionsDuContexte } from '../src/lib/contexteResultat';

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

/** Options reconstruites comme l'écran de référence, sans le producteur photographié. */
export function optionsOracleCli(recipe: OptimizerRecipe, params: ReturnType<typeof recipeToSearchParams>, realDamage: ReturnType<typeof buildRealDamageContext>, cache: ReadonlyMap<string, ResultatArtefacts> | null) {
  const runeById = new Map(POOL.map((r) => [r.id, r]));
  const setup = recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const auras = aurasPropresParRunes(runeById);
  return optionsDeClassement({ realDamage, damageSetup: setup, runeById, metric: recipe.metric,
    aurasPropresDe: auras, contexteExclusive: { setup, element: 'wind' },
    artefactsDuBuild: (c) => { const r = cache?.get(cleBuild(c)); return r ? artifactDamageProfile(r.artefacts) : null; },
    etatReliqueDe: (c) => etatReliqueDuBuild(cache?.get(cleBuild(c)), params.relicContext, LOADED.gear.relic) });
}

export async function testCliClassementDifferentiel() {
  titre('Classement — trace CLI et ancienne page vérifiée sur la même entrée');
  const recipe = recette('equipped', 1250, 900), params = recipeToSearchParams(recipe, LOADED);
  const candidats = (await runSearchToCompletion(params)).candidates;
  const degats = buildRealDamageContext(recipe, LUSHEN, params.artifacts);
  const photo = contexteDeResultatCli(recipe, LOADED, params, degats);
  const base = sortCandidates(candidats, recipe.objective, optionsOracleCli(recipe, params, degats, null));
  for (const pageImprimee of [false, true]) {
    const vue: VueClassement = { tri: recipe.objective, metric: recipe.metric, page: 1, pageImprimee, adapterArtefactsAuTri: false, toutVerifier: false };
    let publication!: PublicationClassement;
    const adaptateur = new AdaptateurClassement();
    const corps = new CorpsClassement({ publier: (p) => { publication = adaptateur.appliquer(p); }, resoudre: () => {}, incident: () => {} }, false, 'directe');
    // Un seul crédit isole le choix de priorité de la prélecture du transport.
    const observation = corps as unknown as { pilote: ResolutionDistante; cache: Map<string, ResultatArtefacts>; restants(): BuildCandidate[] };
    observation.pilote = new ResolutionDistante(1);
    corps.ouvrir(photo, 1, vue, 1);
    const colonnes = creerColonnesCandidats(); candidats.forEach((c) => ajouterObjetCandidat(colonnes, c));
    const lots = extraireBlocs(colonnes); lots.forEach((b, i) => corps.ajouter(1, i, b));
    corps.sceller(1, candidats.length, lots.length - 1, null);
    let premierEcart: unknown = null, controles = 0;
    const ordreResolution: string[] = [];
    const cacheOracle = new Map<string, ResultatArtefacts>(), resoudreOracle = resoudreEquipementCli(recipe, LOADED, params)!;
    for (let garde = 0; garde < 5000; garde++) {
      corps.publier(garde * 400, true);
      const cache = observation.cache, options = optionsOracleCli(recipe, params, degats, cache);
      if (!isDeepStrictEqual([...cache], [...cacheOracle])) throw new Error(`Écart de cache ou d'ordre de résolution à ${cache.size} résolutions`);
      const anciennes = classementResolu(base, cache, recipe.objective, options);
      if (!isDeepStrictEqual(publication.base, base) || !isDeepStrictEqual(publication.affichees, anciennes)) throw new Error(`Écart de classement à ${cache.size} résolutions`);
      const optionsProduction = optionsDuContexte(photo, publication.parBuild, vue.metric);
      if (anciennes.some((c, i) => !Object.is(scoreDuCandidat(c, recipe.objective, options), scoreDuCandidat(publication.affichees[i], recipe.objective, optionsProduction)))) throw new Error('Écart de note');
      const page = compositionDePage({ classement: anciennes, parBuild: cache, page: 1, taillePage: 20 });
      const suivantsEcran = prochainsATraiter(base, cache, 100, page.aVerifier).map(cleBuild);
      const suivantsCli = prochainsATraiter(base, cache, 100, anciennes.slice(0, 20)).map(cleBuild);
      const suivantsCorps = Array.from(observation.restants().slice(0, 3)).map(cleBuild);
      const suivantsAttendus = pageImprimee ? suivantsCli : suivantsEcran;
      if (!isDeepStrictEqual(suivantsCorps, suivantsAttendus.slice(0, 3))) throw new Error(`Écart du choix ${pageImprimee ? 'CLI' : 'écran'} à ${cache.size} résolutions`);
      if (!premierEcart && suivantsCli[0] !== suivantsEcran[0]) premierEcart = { resolus: cache.size, ordreResolution: [...ordreResolution], cli: suivantsCli.slice(0, 3), ecran: suivantsEcran.slice(0, 3), notes: anciennes.slice(0, 3).map((c) => [cleBuild(c), scoreDuCandidat(c, recipe.objective, options)]), page: page.aVerifier.map(cleBuild) };
      controles++;
      const suivant = prochainsATraiter(base, cacheOracle, 100, pageImprimee ? anciennes.slice(0, 20) : page.aVerifier)[0];
      if (suivant) cacheOracle.set(cleBuild(suivant), resoudreOracle(suivant));
      const avant = new Set(cache.keys()); corps.pomper(garde * 400);
      for (const cle of cache.keys()) if (!avant.has(cle)) ordreResolution.push(cle);
      if (!isDeepStrictEqual([...cache], [...cacheOracle])) throw new Error(`Écart de résolution après ${cache.size} réponses`);
      if (!corps.travailEnRepli) break;
    }
    ok(premierEcart !== null, 'le CLI historique et la page vérifiée demandent des priorités différentes');
    egal(controles, observation.cache.size, `chaque transition du corps contrôlée : notes, ordre complet et choix de la page ${pageImprimee ? 'imprimée' : 'vérifiée'}`);
    egal([...cacheOracle.keys()], ordreResolution, 'même ensemble résolu et même ordre que l’ancienne boucle indépendante');
  }
}

const proche = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

function recette(mode: 'off' | 'equipped' | 'recherche', atk: number, def: number): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: LUSHEN, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: { atk, def } }, objective: 'degats_reels',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', exhaustiveSearch: false,
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
 * et `affichees`. `file` vrai : la file comme le hook `useArtifactOptimQueue`
 * la déroule, sans navigateur — UN build par tranche, le premier de
 * `prochainsATraiter(ordre de base, cache, cibleDeLaFile(contexte lancé,
 * interrupteur), page)` — 300 confirmées en mode « recherche », 100 sinon
 * tout avec l'interrupteur —, la page
 * (20 lignes, `RESULTS_PAGE_SIZE`) recalculée à chaque tranche, jusqu'à ce
 * qu'il ne reste rien. `file` faux : tous les candidats résolus.
 */
function classementEcran(recipe: OptimizerRecipe, candidats: BuildCandidate[], realDamage: ReturnType<typeof buildRealDamageContext>, file: boolean) {
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
    return { affichees: fullSortedCandidates, options, parBuild: new Map<string, ResultatArtefacts>(), fullSortedCandidates };
  }
  const a = artefactsDuCli(recipe, LOADED)!; // pendant d'`artifactParams` (voir en-tête)
  const regimeEquipement = regimeEquipementDe(regimeArtefacts(recipe.objective), a.degats != null);
  const requirementAvecAuras = avecAurasConditions(recipe.requirement, damageSetup, recipe.compterAurasResPre ?? true);
  const parBuild = new Map<string, ResultatArtefacts>();
  // `cachesResolution` de l'écran : un jeu pour toute la file.
  const caches = nouveauxCachesResolution();
  const resoudre = (c: BuildCandidate) => resoudreEquipementDuBuild(entreeResolutionDuBuild({
    fiche, runes: c.runeIds.map((id) => runeById.get(id)!).filter(Boolean), artifactParams: a.params, regime: regimeEquipement,
    degats: a.degats, exclusive: contexteExclusive, requirement: requirementAvecAuras, relicContext: relicContextRecherche, caches,
  }));
  // `profilsParBuild` de l'écran, recalculé depuis le cache courant.
  const options = optionsDeClassement({
    ...commun,
    artefactsDuBuild: (c) => {
      const r = parBuild.get(cleBuild(c));
      return r ? artifactDamageProfile(r.artefacts) : null;
    },
    etatReliqueDe: (c) => etatReliqueDuBuild(parBuild.get(cleBuild(c)), relicContextRecherche, fiche.relic),
  });
  if (file) {
    for (;;) {
      const page = classementResolu(fullSortedCandidates, parBuild, recipe.objective, options).slice(0, 20);
      // L'interrupteur de l'écran (`verifierToutesLesCombinaisons`), posé par
      // l'import de la recette avec le même repli (`?? false`).
      const K = cibleDeLaFile({ relicContext: relicContextRecherche, toutVerifier: recipe.verifierToutesLesCombinaisons ?? false });
      const suivant = prochainsATraiter(fullSortedCandidates, parBuild, K, page)[0];
      if (!suivant) break;
      parBuild.set(cleBuild(suivant), resoudre(suivant));
    }
  } else {
    for (const c of fullSortedCandidates) parBuild.set(cleBuild(c), resoudre(c));
  }
  return { affichees: classementResolu(fullSortedCandidates, parBuild, recipe.objective, options), options, parBuild, fullSortedCandidates };
}

export async function testCliClassementParMode() {
  titre('CLI — résolution par build et classement de l’écran, trois modes de relique');

  const cas: { mode: 'off' | 'equipped' | 'recherche'; atk: number; def: number }[] = [
    { mode: 'off', atk: 1250, def: 900 },
    { mode: 'equipped', atk: 1250, def: 900 },
    { mode: 'recherche', atk: 1400, def: 1000 },
  ];
  for (const { mode, atk, def } of cas) {
    const recipe = recette(mode, atk, def);
    const params = recipeToSearchParams(recipe, LOADED);
    egal(params.relicContext?.mode, mode, `${mode} : précondition, mode de relique du vrai producteur`);
    const res = await runSearchToCompletion(params);
    ok(res.candidates.length > 0 && !res.truncated, `${mode} : ${res.candidates.length} candidat(s) collecté(s), recherche complète (tronqué : ${res.truncated})`);
    // En relique `recherche`, la recherche n'émet plus les faux positifs de
    // la borne par stat (relique en « OU ») : le corpus les ajoute après ses
    // candidats, pour garder l'issue « rejeté » exercée.
    const candidats = mode === 'recherche' ? corpusAvecRejetes(params) : res.candidates;
    if (mode === 'recherche') {
      egal(candidats.slice(0, res.candidates.length).map(cleBuild), res.candidates.map(cleBuild), 'recherche : le corpus commence par les candidats de la recherche');
      ok(candidats.length > res.candidates.length, `recherche : ${candidats.length - res.candidates.length} faux positif(s) de la borne ajoutés au corpus`);
    }
    const realDamage = buildRealDamageContext(recipe, LUSHEN, params.artifacts);
    ok(realDamage != null, `${mode} : sort calculable`);

    // Le CLI : la fonction même que le script appelle — ici avec
    // `--resoudre-tout` (tous les candidats) ; le mode par défaut, comme la
    // file de l'écran, est vérifié plus bas.
    const cli = classerCommeLEcran({ recipe, loaded: LOADED, params, candidates: candidats, realDamage, toutResoudre: true });
    egal(cli.resolu != null, mode !== 'off', `${mode} : résolution par build ${mode === 'off' ? 'absente (optimisation coupée, comme l’écran sans file)' : 'présente'}`);

    // L'écran, par ses producteurs, file résolue sur tous les candidats.
    const ecran = classementEcran(recipe, candidats, realDamage, false);
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
      const parCle = new Map(candidats.map((c) => [cleBuild(c), c]));
      egal(rejetes.filter((k) => faisable(parCle.get(k)!)), [], `recherche : les ${rejetes.length} rejetés n’ont aucun couple faisable (énumération exhaustive)`);
      // L'option `diagnostic` du CLI, contre le calcul exhaustif sur l'entrée
      // assemblée comme le CLI l'assemble : avec elle, le résultat entier du
      // calcul exhaustif ; sans elle (le chemin de l'app), un conforme
      // identique, un rejeté sans paire ni artéfact.
      const sansDiagnostic = resoudreEquipementCli(recipe, LOADED, params)!;
      const avecDiagnostic = resoudreEquipementCli(recipe, LOADED, params, { diagnostic: true })!;
      const a = artefactsDuCli(recipe, LOADED)!;
      const exhaustif = (c: BuildCandidate) => resoudreEquipementDuBuildExhaustif(entreeResolutionDuBuild({
        fiche: LOADED.gear, runes: c.runeIds.map((id) => runeById.get(id)!), artifactParams: a.params,
        regime: regimeEquipementDe(regimeArtefacts(recipe.objective), a.degats != null), degats: a.degats,
        exclusive: { setup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP, element: a.element },
        requirement: params.requirement, relicContext: params.relicContext, caches: null,
      }));
      let diagnostics = 0;
      const ecartsDiagnostic = candidats.filter((c) => {
        const app = sansDiagnostic(c);
        const diag = avecDiagnostic(c);
        const ref = exhaustif(c);
        if (!diag.conforme && diag.paire) diagnostics++;
        return !isDeepStrictEqual(diag, ref) || (ref.conforme ? !isDeepStrictEqual(app, ref) : app.conforme || app.paire !== null || app.artefacts.length > 0);
      }).map(cleBuild);
      egal(ecartsDiagnostic, [], `recherche : option diagnostic du CLI = calcul exhaustif sur les ${candidats.length} candidats ; sans elle, conformes identiques et rejetés sans paire`);
      ok(diagnostics > 0, `… ${diagnostics} rejeté(s) portent le diagnostic (un couple au score) avec l’option`);
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

    // Mode par DÉFAUT du CLI, comme la file de l'écran (file non exhaustive,
    // voir plus bas) : comparé au hook déroulé build par build.
    const cliFile = classerCommeLEcran({ recipe, loaded: LOADED, params, candidates: candidats, realDamage, toutResoudre: false });
    const ecranFile = classementEcran(recipe, candidats, realDamage, true);
    const lignes = (classes: BuildCandidate[], options: OptionsDeClassement) =>
      classes.slice(0, LIGNES_IMPRIMEES).map((c) => ({ cle: cleBuild(c), score: scoreDuCandidat(c, recipe.objective, options) }));
    const lCli = lignes(cliFile.classes, cliFile.options);
    const lEcran = lignes(ecranFile.affichees, ecranFile.options);
    egal(lCli.map((x) => x.cle), lEcran.map((x) => x.cle), `${mode}, file : mêmes ${LIGNES_IMPRIMEES} lignes que la file de l’écran`);
    ok(lCli.every((x, i) => proche(x.score, lEcran[i].score)), `${mode}, file : mêmes scores que la file de l’écran`);
    if (mode !== 'off') {
      const r = cliFile.resolu!;
      egal(r.mode, 'file', `${mode}, file : mode par défaut`);
      ok(cliFile.classes.slice(0, LIGNES_IMPRIMEES).every((c) => r.parBuild.has(cleBuild(c))), `${mode}, file : les ${LIGNES_IMPRIMEES} lignes imprimées sont toutes résolues`);
      // La file en mode `recherche` résout 300 builds, 100 en
      // `equipped` — valeur attendue écrite en dur, indépendante de `kDeLaFile`.
      egal(r.K, mode === 'recherche' ? K_BUILDS_RECHERCHE_RELIQUE : K_BUILDS_OPTIMISES, `${mode}, file : K = ${r.K}`);
      egal([K_BUILDS_OPTIMISES, K_BUILDS_RECHERCHE_RELIQUE], [100, 300], 'les deux tailles de file : 100 et 300');
      ok(cliFile.base.slice(0, r.K).every((c) => r.parBuild.has(cleBuild(c))), `${mode}, file : les ${r.K} premiers de l’ordre de base sont résolus`);
      // K CONFIRMÉES — attente indépendante de `prochainsATraiter`,
      // relue sur le cache et l'ordre de base : K résolus et conformes, ou tout
      // l'ordre de base résolu, et tout build avant la K-ième confirmée résolu.
      // (« Rien après » ne se vérifie pas ici : la « page » du CLI change d'un
      // lot à l'autre et fait résoudre des builds plus loin — 107 en `equipped` ;
      // prouvé sans page dans `testFileConfirmees`.)
      {
        let vues = 0;
        let fin = cliFile.base.length;
        for (let i = 0; i < cliFile.base.length; i++) {
          if (r.parBuild.get(cleBuild(cliFile.base[i]!))?.conforme === true) vues++;
          if (vues === r.K) {
            fin = i + 1;
            break;
          }
        }
        ok(vues === r.K || fin === cliFile.base.length, `${mode}, file : ${vues} confirmées sur la fenêtre de fond (cible ${r.K}, ou tout l’ordre de base)`);
        ok(cliFile.base.slice(0, fin).every((c) => r.parBuild.has(cleBuild(c))), `${mode}, file : tout build avant la ${r.K}ᵉ confirmée (rang ${fin}) est résolu`);
      }
      ok(r.parBuild.size < candidats.length,
        `${mode}, file : ${r.parBuild.size} résolus sur ${candidats.length} en ${r.lots} lot(s) (la file de l’écran, build par build : ${ecranFile.parBuild.size})`);
      const equipementFile = (c: BuildCandidate) => {
        const e = r.parBuild.get(cleBuild(c))!;
        return { base: BASE, runes: c.runeIds.map((id) => runeById.get(id)!), artifacts: e.artefacts, relic: e.relique ?? LOADED.gear.relic };
      };
      egal(cliFile.classes.slice(0, LIGNES_IMPRIMEES)
        .filter((c) => !proche(scoreDuCandidat(c, recipe.objective, cliFile.options), scoreDeReference(recipe.objective, equipementFile(c), ref)))
        .map(cleBuild), [], `${mode}, file : les ${LIGNES_IMPRIMEES} scores imprimés = note de production de l’équipement complet`);
      // ⚠️ La file n'est PAS exhaustive (comme à l'écran) : en `recherche`,
      // l'ordre de base ignore la relique, et un build au-delà de la K-ième
      // confirmée (300) peut remonter très haut une fois résolu — la file ne
      // le résout pas. Sur cette fixture, faite pour cela, la file continue
      // au-delà des 112 écartés jusqu'à 300 confirmées (rang 412) et n'en
      // manque aucun — la limite demeure en principe. Ce qui est garanti : un build des
      // vingt premiers de `--resoudre-tout` absent des lignes de la file n'a
      // JAMAIS été résolu par elle (un build résolu y aurait sa note exacte,
      // et vingt lignes résolues au-dessus de lui contrediraient son rang
      // exhaustif). Le manque vient de la non-résolution, jamais d'une note
      // fausse ; il est affiché pour rester visible.
      const tout = lignes(cli.classes, cli.options).map((x) => x.cle);
      const dansFile = new Set(lCli.map((x) => x.cle));
      const manquants = tout.filter((k) => !dansFile.has(k));
      const rangsBase = manquants.map((k) => cliFile.base.findIndex((c) => cleBuild(c) === k));
      egal(manquants.filter((k) => r.parBuild.has(k)), [],
        `${mode}, file : ${manquants.length} des ${LIGNES_IMPRIMEES} premiers de --resoudre-tout absents de la file, aucun résolu par elle` +
          (manquants.length ? ` (rangs exhaustifs ${JSON.stringify(manquants.map((k) => tout.indexOf(k) + 1))}, rangs dans l'ordre de base ${JSON.stringify(rangsBase.map((i) => i + 1))})` : ''));

      // « Vérifier toutes les combinaisons trouvées » dans la
      // recette — le CLI, en mode par défaut, résout TOUT, comme la file de
      // l'écran avec l'interrupteur ; et son classement est celui de
      // `--resoudre-tout`.
      const recetteTout = { ...recipe, verifierToutesLesCombinaisons: true };
      const cliTout = classerCommeLEcran({ recipe: recetteTout, loaded: LOADED, params, candidates: candidats, realDamage, toutResoudre: false });
      const ecranTout = classementEcran(recetteTout, candidats, realDamage, true);
      const rt = cliTout.resolu!;
      egal([rt.mode, rt.K], ['file', Number.POSITIVE_INFINITY], `${mode}, interrupteur : mode par défaut, cible infinie`);
      egal([rt.parBuild.size, ecranTout.parBuild.size], [candidats.length, candidats.length],
        `${mode}, interrupteur : les ${candidats.length} candidats vérifiés, au CLI comme à l’écran`);
      const lTout = lignes(cliTout.classes, cliTout.options);
      egal(lTout.map((x) => x.cle), lignes(ecranTout.affichees, ecranTout.options).map((x) => x.cle), `${mode}, interrupteur : mêmes ${LIGNES_IMPRIMEES} lignes que l’écran`);
      egal([cliTout.classes.map(cleBuild).join('|') === cli.classes.map(cleBuild).join('|'), cliTout.classes.length], [true, cli.classes.length],
        `${mode}, interrupteur : le classement entier est celui de --resoudre-tout (${cli.classes.length} builds)`);
    }
  }
}
