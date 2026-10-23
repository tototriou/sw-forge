// La référence reconstruit le classement complet à chaque publication,
// sans mémoire de notes. Le différentiel compare aussi les stats rendues.
import { isDeepStrictEqual } from 'node:util';
import { ArtifactDetail, RelicDetail, RuneDetail } from '../src/types';
import { StatKey } from '../src/lib/effects';
import { computeStats, StatRow } from '../src/lib/stats';
import { ARTIFACT_DAMAGE_NEUTRE, AUCUNE_AURA_PROPRE, DEFAULT_DAMAGE_SETUP, artifactDamageProfile } from '../src/lib/damage';
import { BuildCandidate, Objective, OptionsDeClassement, aurasPropresParRunes, optionsDeClassement, scoreDuCandidat, sortCandidates, trierCandidatsIncrementalement } from '../src/lib/runeBuildOptim';
import { APPORT_NEUTRE } from '../src/lib/relicExclusive';
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

function classerAvecNotes(candidats: BuildCandidate[], opts: OptionsDeClassement) {
  const notes = new Map<string, number>();
  const classes = trierCandidatsIncrementalement(candidats, 'degats_reels', opts, (c, note) => notes.set(cleBuild(c), note));
  return { classes, notes };
}

function comparerNotes(candidats: BuildCandidate[], notes: ReadonlyMap<string, number>, opts: OptionsDeClassement, cas: string) {
  for (const c of candidats) {
    const cle = cleBuild(c);
    const complete = scoreDuCandidat(c, 'degats_reels', opts);
    if (!notes.has(cle) || !Object.is(notes.get(cle), complete)) {
      throw new Error(`ARRÊT note incrémentale : ${cas}, build ${cle}, gardée ${notes.get(cle)}, complète ${complete}`);
    }
  }
  ok(true, `${cas} : chaque note utilisée au tri égale le recalcul complet`);
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
    if (critere === 'degats_reels') comparerNotes(recu, classerAvecNotes(recu, opts).notes, opts, cas);
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
  // Le useMemo du profil supposé produit un nouvel objet, comme celui des
  // paires résolues ; une note publiée ne possède pas de snapshot mutable.
  x.realDamage.artefacts = { ...x.realDamage.artefacts, brutPctAtk: 9 };
  verifier('profil supposé modifié, seuls les non résolus le lisent');
  const cle = cleBuild(x.builds[1]);
  let r = structuredClone(x.cache.get(cle)!);
  r.artefacts[0].subs[0].value += 5;
  x.cache.set(cle, r);
  verifier('sous-propriété de la paire résolue modifiée');
  r = structuredClone(r);
  r.relique!.unique!.percent = (r.relique!.unique!.percent ?? 0) + 4;
  x.cache.set(cle, r);
  verifier('exclusive de même id modifiée');
  // Les réponses du Worker sont clonées puis remplacées dans la Map ; les
  // candidats et résultats déjà publiés ne sont jamais mutés dans l'app.
  r = { ...r, stats: r.stats.map((s) => s.key === 'atk' ? { ...s, total: s.total + 150 } : s) };
  x.cache.set(cle, r);
  verifier('stats résolues remplacées par une nouvelle réponse');
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
      const recu = classementResolu(ordre, y.cache, 'degats_reels', opts);
      identiques(recu, complet(ordre, y.cache, 'degats_reels', opts), `seed ${seed}, publication ${i}`);
      comparerNotes(recu, classerAvecNotes(recu, opts).notes, opts, `seed ${seed}, publication ${i}`);
    }
  }
}

export function testClassementIncrementalEgalites() {
  titre('Classement incrémental — égalités, contexte absent et valeurs non finies');
  const x = corpus();
  const base = x.builds.slice(0, 8);
  const commun = structuredClone(base[0].stats);
  const optsEgaux = { ...x.options(), aurasPropresDe: () => AUCUNE_AURA_PROPRE, exclusiveDuBuild: () => null };
  for (const c of base) c.stats = structuredClone(commun);
  for (const i of [6, 4, 0, 7, 2, 1, 5, 3]) {
    x.resoudre(i, true, 8 - i);
    const r = x.cache.get(cleBuild(base[i]))!;
    r.stats = structuredClone(commun);
    r.artefacts = [];
    const recu = classementResolu(base, x.cache, 'degats_reels', optsEgaux);
    identiques(recu, complet(base, x.cache, 'degats_reels', optsEgaux), `égalité de note, publication ${i}`);
    comparerNotes(recu, classerAvecNotes(recu, optsEgaux).notes, optsEgaux, `égalité ${i}`);
  }
  const attendu = [...base].reverse().map(cleBuild);
  ok(isDeepStrictEqual(classementResolu(base, x.cache, 'degats_reels', optsEgaux).map(cleBuild), attendu), 'à égalité : rid croissant, indépendamment des publications');
  for (const [cle, r] of x.cache) x.cache.set(cle, { ...r, relique: { ...r.relique!, id: 1 } });
  identiques(classementResolu(base, x.cache, 'degats_reels', optsEgaux), complet(base, x.cache, 'degats_reels', optsEgaux), 'rid égaux : départage par clé');
  for (const critere of ['degats_reels', 'efficience'] as const) {
    const opts: OptionsDeClassement = { aurasPropresDe: aurasPropresParRunes(new Map()) };
    identiques(classementResolu(base, x.cache, critere, opts), complet(base, x.cache, critere, opts), `${critere} : contexte absent après contexte présent`);
  }
  const opts = x.options();
  for (const n of [NaN, Infinity, -Infinity, -0, 0, 1]) {
    const cle = cleBuild(base[3]), r = x.cache.get(cle)!;
    x.cache.set(cle, { ...r, stats: r.stats.map((s) => s.key === 'atk' ? { ...s, total: n } : s) });
    identiques(classementResolu(base, x.cache, 'atk', opts), complet(base, x.cache, 'atk', opts), `note ${String(n)} : même comparateur stable`);
    const degats = classementResolu(base, x.cache, 'degats_reels', optsEgaux);
    identiques(degats, complet(base, x.cache, 'degats_reels', optsEgaux), `dégâts, ATQ ${String(n)} : même classement`);
    comparerNotes(degats, classerAvecNotes(degats, optsEgaux).notes, optsEgaux, `dégâts, ATQ ${String(n)}`);
  }
}

export function testClassementIncrementalNotes() {
  titre('Classement incrémental — les notes de dégâts inchangées ne sont plus calculées');
  const x = corpus();
  let lecturesCalcul = 0;
  const suivre = (stats: StatRow[]) => new Proxy(stats, { get(cible, cle, receveur) {
    // Le calcul de dégâts lit les stats par find ; la clé ne les parcourt pas.
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
  x.builds[8] = { ...x.builds[8], stats: suivre(x.builds[8].stats.map((s) => s.key === 'atk' ? { ...s, total: s.total + 50 } : s)) };
  lecturesCalcul = 0;
  trierCandidatsIncrementalement(x.builds, 'degats_reels', opts);
  const un = lecturesCalcul;
  ok(un > 0, 'un build modifié est renoté');
  lecturesCalcul = 0;
  sortCandidates([x.builds[8]], 'degats_reels', opts);
  ok(un === lecturesCalcul, 'seul le build modifié est renoté, coût de lecture d’un seul build');

  const cible = x.builds[1], cle = cleBuild(cible);
  ok(candidatAvecSaPaire(cible, x.cache) === cible, 'non résolu : même objet candidat');
  x.resoudre(1);
  const projection = candidatAvecSaPaire(cible, x.cache);
  ok(candidatAvecSaPaire(cible, new Map(x.cache)) === projection, 'publication par copie de Map : même projection résolue');
  x.cache.set(cle, { ...x.cache.get(cle)! });
  ok(candidatAvecSaPaire(cible, x.cache) !== projection, 'nouvelle réponse, même tableau de stats : nouvelle projection');
  x.cache.delete(cle);
  ok(candidatAvecSaPaire(cible, x.cache) === cible, 'suppression du résultat : retour au candidat de base');

  let lignesParcourues = 0;
  const stats = x.builds[0].stats.map((s) => ({ ...s, get label() { lignesParcourues++; return s.label; } }));
  const gros = Array.from({ length: 20_000 }, (_, i) => ({ runeIds: [i], stats, effTotal: i }));
  const reglages: OptionsDeClassement = { realDamage: x.realDamage, aurasPropresDe: () => ({ ...AUCUNE_AURA_PROPRE }) };
  const compter = (candidats: BuildCandidate[]) => {
    const stringify = JSON.stringify;
    let appels = 0;
    try {
      JSON.stringify = ((...args: Parameters<typeof stringify>) => { appels++; return stringify.apply(JSON, args); }) as typeof stringify;
      trierCandidatsIncrementalement(candidats, 'degats_reels', reglages);
    } finally { JSON.stringify = stringify; }
    return appels;
  };
  const commun = compter(gros.slice(0, 1));
  lignesParcourues = 0;
  const amorcage = compter(gros);
  const publications = Array.from({ length: 4 }, () => compter(gros));
  ok(commun > 0 && amorcage === commun && publications.every((n) => n === commun),
    `20 000 candidats, 5 publications : ${commun} appels de sérialisation par publication, comme pour un seul candidat`);
  ok(lignesParcourues === 0, 'aucune ligne de stats parcourue pour construire une clé, amorçage compris');
}

// Les réponses et données propres sont remplacées, comme les messages clonés
// du Worker et les objets dérivés de React ; aucune mutation d'un objet publié.
// Les accesseurs d'apport et d'aura de ce témoin ne lisent pas les stats :
// les lectures find mesurent le calcul de dégâts seul, pas la clé de cache.
function corpusDesInvalidations() {
  const x = corpus();
  const cible = x.builds[8];
  const cle = cleBuild(cible);
  x.resoudre(8);
  const resultat = x.cache.get(cle)!;
  resultat.stats.find((s) => s.key === 'atk')!.total = 1;
  const donnees = { propres: { ...AUCUNE_AURA_PROPRE }, apport: { ...APPORT_NEUTRE } };
  const opts: OptionsDeClassement = {
    ...x.options(),
    aurasPropresDe: (c) => cleBuild(c) === cle ? donnees.propres : AUCUNE_AURA_PROPRE,
    exclusiveDuBuild: (c) => cleBuild(c) === cle ? donnees.apport : APPORT_NEUTRE,
  };
  const lectures = new Map<string, number>();
  const suivre = (stats: StatRow[], cle: string) => new Proxy(stats, { get(cible, propriete, receveur) {
    if (propriete === 'find') lectures.set(cle, (lectures.get(cle) ?? 0) + 1);
    return Reflect.get(cible, propriete, receveur);
  } });
  for (const c of x.builds) c.stats = suivre(c.stats, cleBuild(c));
  resultat.stats = suivre(resultat.stats, cle);
  const publier = (cas: string) => {
    const candidats = x.builds.map((c) => candidatAvecSaPaire(c, x.cache));
    lectures.clear();
    const tri = classerAvecNotes(candidats, opts);
    const recalcules = new Map(lectures);
    // Capturer les lectures AVANT de calculer les références indépendantes.
    comparerNotes(candidats, tri.notes, opts, cas);
    identiques(tri.classes, sortCandidates(candidats, 'degats_reels', opts), cas);
    return { ...tri, recalcules };
  };
  const remplacer = (modification: Partial<ResultatArtefacts>) => x.cache.set(cle, { ...x.cache.get(cle)!, ...modification });
  return { ...x, cle, donnees, remplacer, suivre, opts, publier };
}

export function testClassementIncrementalInvalidations() {
  titre('Dégâts réels — chaque dépendance invalide sa note sans changer de critère');
  const cas: { nom: string; modifier: (x: ReturnType<typeof corpusDesInvalidations>) => void; commun?: boolean }[] = [
    { nom: 'stats du build', modifier: (x) => {
      const stats = x.cache.get(x.cle)!.stats.map((s) => s.key === 'atk' ? { ...s, total: s.total + 100000 } : s);
      x.remplacer({ stats: x.suivre(stats, x.cle) });
    } },
    { nom: 'auras propres', modifier: (x) => { x.donnees.propres = { ...x.donnees.propres, fight: 1 }; } },
    { nom: 'profil de la paire résolue', modifier: (x) => {
      const artefacts = structuredClone(x.cache.get(x.cle)!.artefacts);
      artefacts[0].subs[0].value += 10;
      x.remplacer({ artefacts });
    } },
    { nom: 'apport exclusif de relique', modifier: (x) => { x.donnees.apport = { ...x.donnees.apport, dmgPct: 30 }; } },
    { nom: 'contexte de dégâts', modifier: (x) => { x.realDamage.profile.skillupDamagePct += 20; }, commun: true },
  ];
  for (const c of cas) {
    const x = corpusDesInvalidations();
    const avant = x.publier(`${c.nom} : amorçage`);
    const identique = x.publier(`${c.nom} : même publication`);
    ok(identique.recalcules.size === 0, `${c.nom} : témoin, notes déjà en mémoire`);
    c.modifier(x);
    const apres = x.publier(`${c.nom} : une entrée modifiée, toujours Dégâts réels`);
    ok(apres.recalcules.has(x.cle), `${c.nom} : note de ce build effectivement recalculée`);
    ok(apres.recalcules.size === (c.commun ? x.builds.length : 1), `${c.nom} : seuls les builds dépendants sont renotés`);
    ok(!Object.is(avant.notes.get(x.cle), apres.notes.get(x.cle)), `${c.nom} : la valeur de la note a changé`);
    if (c.nom === 'stats du build') {
      ok(cleBuild(avant.classes[0]) !== x.cle && cleBuild(apres.classes[0]) === x.cle, 'une modification de stats impose une inversion du classement');
    }
  }
}

export function testClassementIncrementalFonctions() {
  titre('Dégâts réels — une fonction dans les données désactive la mémoire du tri entier');
  const x = corpusDesInvalidations();
  x.publier('fonction : amorçage sans fonction');
  ok(x.publier('fonction : hit témoin').recalcules.size === 0, 'témoin : les 24 notes sont mémorisées');
  let fermeture = 1;
  const fonction = () => fermeture;
  Object.assign(x.realDamage, { extension: { fonctions: [fonction] } });
  for (const i of [1, 2]) {
    fermeture = i;
    ok(x.publier(`fonction dans le contexte, fermeture ${i}`).recalcules.size === x.builds.length,
      'fonction dans le contexte : tous les candidats sont recalculés, classement et notes égaux au complet');
  }
  Reflect.deleteProperty(x.realDamage, 'extension');
  const profilDe = x.opts.artefactsDuBuild!;
  const dernier = cleBuild(x.builds[x.builds.length - 1]);
  x.opts.artefactsDuBuild = (c) => cleBuild(c) === dernier
    ? Object.assign({ ...ARTIFACT_DAMAGE_NEUTRE }, { extension: { fonction } }) : profilDe(c);
  for (const i of [3, 4]) {
    fermeture = i;
    ok(x.publier(`fonction sur le dernier profil, fermeture ${i}`).recalcules.size === x.builds.length,
      'fonction sur le dernier build : aucun candidat précédent ne réutilise sa note');
  }
}

export function testClassementIncrementalAutresCriteres() {
  titre('Classement incrémental — tous les autres critères passent directement par sortCandidates');
  const x = corpus();
  let labelsLus = 0;
  let annexesRunesLues = 0;
  for (const c of x.builds) for (const s of c.stats) {
    const label = s.label;
    Object.defineProperty(s, 'label', { enumerable: true, get: () => { labelsLus++; return label; } });
  }
  for (const r of x.runeById.values()) Object.defineProperty(r, 'annexeDuTest', {
    enumerable: true, get: () => { annexesRunesLues++; return 0; },
  });
  const opts = { ...x.options(), exclusiveDuBuild: () => null };
  for (const critere of ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'vitesse', 'ehp', 'efficience'] as const) {
    const attendu = sortCandidates(x.builds, critere, opts);
    labelsLus = 0;
    annexesRunesLues = 0;
    const recu = trierCandidatsIncrementalement(x.builds, critere, opts);
    ok(recu.length === attendu.length && recu.every((c, i) => c === attendu[i]), `${critere} : mêmes objets, exactement dans l'ordre du calcul direct`);
    ok(labelsLus === 0, `${critere} : aucune empreinte des lignes de stats`);
    ok(annexesRunesLues === 0, `${critere} : aucune empreinte des runes`);
  }
}
