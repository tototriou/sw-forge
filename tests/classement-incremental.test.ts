// La référence reconstruit le classement complet à chaque publication,
// sans mémoire de notes. Le différentiel compare aussi les stats rendues.
import { isDeepStrictEqual } from 'node:util';
import { ArtifactDetail, RelicDetail, RuneDetail } from '../src/types';
import { StatKey } from '../src/lib/effects';
import { computeStats, StatRow } from '../src/lib/stats';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile } from '../src/lib/damage';
import { BuildCandidate, Objective, OptionsDeClassement, aurasPropresParRunes, optionsDeClassement, sortCandidates, trierCandidatsIncrementalement } from '../src/lib/runeBuildOptim';
import { ResultatArtefacts, candidatAvecSaPaire, classementResolu, cleBuild, compositionDePage, ordonnerParDepartage, prochainsATraiter } from '../src/lib/artifactQueue';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { etatReliqueDuBuild } from '../src/lib/relicQueue';
import { ok, titre } from './outils';

function complet(base: BuildCandidate[], cache: ReadonlyMap<string, ResultatArtefacts>, critere: StatKey | Objective, opts: OptionsDeClassement) {
  if (!cache.size) return base;
  const conformes = ordonnerParDepartage(base.filter((c) => cache.get(cleBuild(c))?.conforme !== false), (c) => cache.get(cleBuild(c))?.relique?.id);
  return sortCandidates(conformes.map((c) => candidatAvecSaPaire(c, cache)), critere, opts);
}

function identiques(recu: BuildCandidate[], attendu: BuildCandidate[], cas: string) {
  if (!isDeepStrictEqual(recu, attendu)) throw new Error(`ARRÊT classement incrémental : ${cas} ; reçu ${recu.map(cleBuild)}, attendu ${attendu.map(cleBuild)}`);
  ok(true, cas);
}

function corpus(seed = 1414, monstre = 13413) {
  const baseStats = { hp: 10000, atk: 1000, def: 600, spd: 100, cr: 30, cd: 75, res: 15, acc: 0 };
  const tirer = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const pool: RuneDetail[] = [];
  const builds: BuildCandidate[] = [];
  for (let i = 0; i < 24; i++) {
    const runes: RuneDetail[] = Array.from({ length: 6 }, (_, j) => ({
      id: 100 + 6 * i + j, slot: j + 1, set: ['fight', 'enhance', 'determination', 'rage'][i % 4],
      rank: 6, rarity: 5, level: 15, main: { code: 3, value: 30 + tirer() % 100 },
      subs: [{ code: 8, value: 4 + tirer() % 20 }, { code: 5, value: 10 + tirer() % 80 }],
    }));
    pool.push(...runes);
    builds.push({ runeIds: runes.map((r) => r.id), stats: computeStats({ base: baseStats, runes, artifacts: [] }), effTotal: i });
  }
  const runeById = new Map(pool.map((r) => [r.id, r]));
  const setup = structuredClone(DEFAULT_DAMAGE_SETUP);
  const recipe = buildOptimizerRecipe({
    monsterCom2usId: monstre, monsterName: 'Monstre du test', requirement: { sets: [], minStats: {} }, objective: 'degats_reels', damageSetup: setup,
    metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {},
  });
  const realDamage = buildRealDamageContext(recipe, monstre, []);
  if (!realDamage) throw new Error(`Précondition : contexte de dégâts de ${monstre} absent`);
  const cache = new Map<string, ResultatArtefacts>();
  const options = () => optionsDeClassement({
    realDamage, damageSetup: setup, runeById, metric: 'eff', aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: (c) => { const r = cache.get(cleBuild(c)); return r ? artifactDamageProfile(r.artefacts) : null; },
    etatReliqueDe: (c) => { const r = cache.get(cleBuild(c)); return r ? etatReliqueDuBuild(r, undefined, r.relique) : { etat: 'en attente' }; },
    contexteExclusive: { setup, element: 'wind' },
  });
  const resoudre = (i: number, conforme = true, rid = i % 3 + 1) => {
    const c = builds[i];
    const relique: RelicDetail = { id: rid, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } };
    const art: ArtifactDetail = { id: 1000 + i, kind: 'element', element: 'wind', level: 15, rarity: 5,
      main: { code: 101, value: 100 }, subs: [{ code: 219, value: 3 + i % 4 }] };
    cache.set(cleBuild(c), { paire: null, artefacts: [art], relique, conforme, meilleurSansVerrous: null,
      stats: c.stats.map((s) => s.key === 'atk' ? { ...s, total: s.total + 200, bonus: s.bonus + 200 } : { ...s }) });
  };
  return { builds, cache, setup, realDamage, runeById, options, resoudre };
}

export function testClassementIncremental() {
  titre('Classement incrémental — publications et référence complète');
  const x = corpus();
  let base = sortCandidates(x.builds.slice(0, 9), 'degats_reels', x.options());
  const optionsStables = x.options();
  const verifier = (cas: string, critere: StatKey | Objective = 'degats_reels') => {
    const opts = optionsStables;
    const attendu = complet(base, x.cache, critere, opts);
    const recu = classementResolu(base, new Map(x.cache), critere, opts);
    identiques(recu, attendu, cas);
    const page = (classement: BuildCandidate[]) => compositionDePage({ classement, parBuild: x.cache, page: 1, taillePage: 4 });
    ok(isDeepStrictEqual(page(recu), page(attendu)), `${cas} : mêmes cartes et priorités de page`);
    ok(isDeepStrictEqual(prochainsATraiter(base, x.cache, 12, page(recu).aVerifier), prochainsATraiter(base, x.cache, 12, page(attendu).aVerifier)), `${cas} : même prochain travail de résolution`);
  };
  ok(classementResolu(base, x.cache, 'degats_reels', x.options()) === base, 'cache vide : tableau de base identique');
  for (const i of [7, 1, 8, 0]) { x.resoudre(i); verifier(`aperçu : publication de ${i}`); }
  verifier('publication inchangée, nouvelles closures et nouveaux profils');
  identiques(classementResolu(base, x.cache, 'degats_reels', x.options()), complet(base, x.cache, 'degats_reels', x.options()), 'même contenu avec de nouveaux accesseurs');
  // Le Worker final transporte de nouveaux objets, sans identité avec l'aperçu.
  base = sortCandidates(structuredClone(x.builds), 'degats_reels', x.options());
  verifier('aperçu puis résultat complet cloné');
  for (const i of [20, 10, 3, 23, 5, 15]) { x.resoudre(i); verifier(`résolution hors ordre : ${i}`); }
  x.resoudre(8, false); verifier('résolu devenu rejeté');
  x.cache.delete(cleBuild(x.builds[7])); verifier('entrée retirée : retour aux stats et au profil supposés');
  for (const critere of ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'vitesse', 'ehp', 'efficience', 'degats_reels'] as const) verifier(`changement de critère : ${critere}`, critere);
  x.realDamage.setup.enemyDef += 800;
  verifier('réglage modifié en cours, objet conservé');
  x.realDamage.profile.skillupDamagePct += 20;
  verifier('profil de sort modifié en place');
  x.realDamage.artefacts.brutPctAtk = 9;
  verifier('profil supposé modifié, seuls les non résolus le lisent');
  const r = x.cache.get(cleBuild(x.builds[1]))!;
  r.artefacts[0].subs[0].value += 5;
  verifier('sous-propriété de la paire résolue modifiée');
  r.relique!.unique!.percent = (r.relique!.unique!.percent ?? 0) + 4;
  verifier('exclusive de même id modifiée');
  r.stats.find((s) => s.key === 'atk')!.total += 150;
  verifier('stats résolues modifiées en place');
  x.runeById.get(x.builds[0].runeIds[0])!.set = 'enhance';
  verifier('aura propre changée à ids constants');
  x.runeById.get(x.builds[0].runeIds[0])!.subs[0].value += 10;
  verifier('rune modifiée dans le même pool', 'efficience');
  const score = { ...x.options(), metric: 'score' as const };
  identiques(classementResolu(base, x.cache, 'efficience', score), complet(base, x.cache, 'efficience', score), 'changement de métrique');
  x.cache.clear();
  verifier('vidage de la file');
  x.resoudre(5); verifier('nouvelle file aux mêmes réglages');
  for (let seed = 1; seed <= 9; seed++) {
    const y = corpus(seed, [13413, 25114, 27712][seed % 3]);
    const ordre = sortCandidates(y.builds, 'degats_reels', y.options());
    for (const i of [15, 2, 21, 0, 6, 11]) {
      y.resoudre(i, i !== 6);
      const opts = y.options();
      identiques(classementResolu(ordre, y.cache, 'degats_reels', opts), complet(ordre, y.cache, 'degats_reels', opts), `seed ${seed}, publication ${i}`);
    }
  }
}

export function testClassementIncrementalEgalites() {
  titre('Classement incrémental — égalités, contexte absent et valeurs non finies');
  const x = corpus();
  const base = x.builds.slice(0, 8);
  const commun = structuredClone(base[0].stats);
  for (const c of base) c.stats = structuredClone(commun);
  for (const i of [6, 4, 0, 7, 2, 1, 5, 3]) {
    x.resoudre(i, true, 8 - i);
    const r = x.cache.get(cleBuild(base[i]))!;
    r.stats = structuredClone(commun);
    r.artefacts = [];
    identiques(classementResolu(base, x.cache, 'atk', x.options()), complet(base, x.cache, 'atk', x.options()), `égalité de note, publication ${i}`);
  }
  const attendu = [...base].reverse().map(cleBuild);
  ok(isDeepStrictEqual(classementResolu(base, x.cache, 'atk', x.options()).map(cleBuild), attendu), 'à égalité : rid croissant, indépendamment des publications');
  for (const r of x.cache.values()) r.relique!.id = 1;
  identiques(classementResolu(base, x.cache, 'atk', x.options()), complet(base, x.cache, 'atk', x.options()), 'rid égaux : départage par clé');
  for (const critere of ['degats_reels', 'efficience'] as const) {
    const opts: OptionsDeClassement = { aurasPropresDe: aurasPropresParRunes(new Map()) };
    identiques(classementResolu(base, x.cache, critere, opts), complet(base, x.cache, critere, opts), `${critere} : contexte absent après contexte présent`);
  }
  const opts = x.options();
  for (const n of [NaN, Infinity, -Infinity, -0, 0, 1]) {
    x.cache.get(cleBuild(base[3]))!.stats.find((s) => s.key === 'atk')!.total = n;
    identiques(classementResolu(base, x.cache, 'atk', opts), complet(base, x.cache, 'atk', opts), `note ${String(n)} : même comparateur stable`);
  }
}

export function testClassementIncrementalNotes() {
  titre('Classement incrémental — les notes de dégâts inchangées ne sont plus calculées');
  const x = corpus();
  let lecturesCalcul = 0;
  const suivre = (stats: StatRow[]) => new Proxy(stats, { get(cible, cle, receveur) {
    // Le calcul de dégâts lit les stats par find ; l'empreinte ne l'appelle pas.
    if (cle === 'find') lecturesCalcul++;
    return Reflect.get(cible, cle, receveur);
  } });
  for (const c of x.builds) c.stats = suivre(c.stats);
  const opts = { ...x.options(), exclusiveDuBuild: () => null };
  trierCandidatsIncrementalement(x.builds, 'degats_reels', opts);
  ok(lecturesCalcul > 0, 'témoin : le vrai calcul de dégâts a lu les stats');
  lecturesCalcul = 0;
  trierCandidatsIncrementalement(x.builds, 'degats_reels', { ...opts });
  ok(lecturesCalcul === 0, 'seconde publication inchangée : aucun calcul de dégâts');
  x.builds[8].stats.find((s) => s.key === 'atk')!.total += 50;
  lecturesCalcul = 0;
  trierCandidatsIncrementalement(x.builds, 'degats_reels', opts);
  const un = lecturesCalcul;
  ok(un > 0, 'un build modifié est renoté');
  lecturesCalcul = 0;
  sortCandidates([x.builds[8]], 'degats_reels', opts);
  ok(un === lecturesCalcul, 'seul le build modifié est renoté, coût de lecture d’un seul build');
}
