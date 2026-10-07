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
import { artefactsDuCli, recipeToSearchParams } from '../scripts/lib/recipeToSearchParams';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { runSearchToCompletion } from '../scripts/lib/runSearch';
import { LIGNES_IMPRIMEES, classerCommeLEcran } from '../scripts/lib/classementCli';
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

export function testCliClassementParMode() {
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
    const res = runSearchToCompletion(params);
    ok(res.candidates.length > 0 && !res.truncated, `${mode} : ${res.candidates.length} candidat(s) collecté(s), recherche complète (tronqué : ${res.truncated})`);
    const realDamage = buildRealDamageContext(recipe, LUSHEN, params.artifacts);
    ok(realDamage != null, `${mode} : sort calculable`);

    // Le CLI : la fonction même que le script appelle — ici avec
    // `--resoudre-tout` (tous les candidats) ; le mode par défaut, comme la
    // file de l'écran, est vérifié plus bas.
    const cli = classerCommeLEcran({ recipe, loaded: LOADED, params, candidates: res.candidates, realDamage, toutResoudre: true });
    egal(cli.resolu != null, mode !== 'off', `${mode} : résolution par build ${mode === 'off' ? 'absente (optimisation coupée, comme l’écran sans file)' : 'présente'}`);

    // L'écran, par ses producteurs, file résolue sur tous les candidats.
    const ecran = classementEcran(recipe, res.candidates, realDamage, false);
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

    // Mode par DÉFAUT du CLI, comme la file de l'écran (décision utilisateur
    // du 2026-10-01, option 2) : comparé au hook déroulé build par build.
    const cliFile = classerCommeLEcran({ recipe, loaded: LOADED, params, candidates: res.candidates, realDamage, toutResoudre: false });
    const ecranFile = classementEcran(recipe, res.candidates, realDamage, true);
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
      egal([K_BUILDS_OPTIMISES, K_BUILDS_RECHERCHE_RELIQUE], [100, 300], 'les deux tailles de file décidées le 2026-10-01');
      ok(cliFile.base.slice(0, r.K).every((c) => r.parBuild.has(cleBuild(c))), `${mode}, file : les ${r.K} premiers de l’ordre de base sont résolus`);
      // K CONFIRMÉES — attente indépendante de `prochainsATraiter`,
      // relue sur le cache et l'ordre de base : K résolus et conformes, ou tout
      // l'ordre de base résolu, et tout build avant la K-ième confirmée résolu.
      // (« Rien après » ne se vérifie pas ici : la « page » du CLI change d'un
      // lot à l'autre et fait résoudre des builds plus loin — 107 en `equipped`,
      // comme avant ce lot ; prouvé sans page dans `testFileConfirmees`.)
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
      ok(r.parBuild.size < res.candidates.length,
        `${mode}, file : ${r.parBuild.size} résolus sur ${res.candidates.length} en ${r.lots} lot(s) (la file de l’écran, build par build : ${ecranFile.parBuild.size})`);
      const equipementFile = (c: BuildCandidate) => {
        const e = r.parBuild.get(cleBuild(c))!;
        return { base: BASE, runes: c.runeIds.map((id) => runeById.get(id)!), artifacts: e.artefacts, relic: e.relique ?? LOADED.gear.relic };
      };
      egal(cliFile.classes.slice(0, LIGNES_IMPRIMEES)
        .filter((c) => !proche(scoreDuCandidat(c, recipe.objective, cliFile.options), scoreDeReference(recipe.objective, equipementFile(c), ref)))
        .map(cleBuild), [], `${mode}, file : les ${LIGNES_IMPRIMEES} scores imprimés = note de production de l’équipement complet`);
      // ⚠️ La file n'est PAS exhaustive (le prix de l'option 2, comme à
      // l'écran) : en `recherche`, l'ordre de base ignore la relique, et un
      // build au-delà de la K-ième confirmée (300) peut remonter
      // très haut une fois résolu — la file ne le résout pas. Sur cette
      // fixture, faite pour cela, les manquants venaient des rangs de base 305
      // à 399 tant que la file s'arrêtait aux 300 premiers ; désormais,
      // elle continue au-delà des 112 écartés jusqu'à 300 confirmées (rang 412)
      // et n'en manque plus aucun — la limite demeure en principe. Ce qui est garanti : un build des
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
      const cliTout = classerCommeLEcran({ recipe: recetteTout, loaded: LOADED, params, candidates: res.candidates, realDamage, toutResoudre: false });
      const ecranTout = classementEcran(recetteTout, res.candidates, realDamage, true);
      const rt = cliTout.resolu!;
      egal([rt.mode, rt.K], ['file', Number.POSITIVE_INFINITY], `${mode}, interrupteur : mode par défaut, cible infinie`);
      egal([rt.parBuild.size, ecranTout.parBuild.size], [res.candidates.length, res.candidates.length],
        `${mode}, interrupteur : les ${res.candidates.length} candidats vérifiés, au CLI comme à l’écran`);
      const lTout = lignes(cliTout.classes, cliTout.options);
      egal(lTout.map((x) => x.cle), lignes(ecranTout.affichees, ecranTout.options).map((x) => x.cle), `${mode}, interrupteur : mêmes ${LIGNES_IMPRIMEES} lignes que l’écran`);
      egal([cliTout.classes.map(cleBuild).join('|') === cli.classes.map(cleBuild).join('|'), cliTout.classes.length], [true, cli.classes.length],
        `${mode}, interrupteur : le classement entier est celui de --resoudre-tout (${cli.classes.length} builds)`);
    }
  }
}
