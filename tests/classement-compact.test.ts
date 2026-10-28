import { isDeepStrictEqual } from 'node:util';
import { CandidatNonCompactable, CandidatsCompacts, hacherIds } from '../src/lib/candidatsCompacts';
import { ClassementCompact } from '../src/lib/classementCompact';
import { CacheResolutionJournalise, ResultatArtefacts, candidatAvecSaPaire, classementResolu, cleBuild, compteAffichable, compteConfirme, journalResolution, ordonnerParDepartage, travailDuClassementCompact } from '../src/lib/artifactQueue';
import { BuildCandidate, Objective, OptionsDeClassement, aurasPropresParRunes, optionsDeClassement, preparerNotationCompacte, scoreDuCandidat, sortCandidates } from '../src/lib/runeBuildOptim';
import { DEFAULT_DAMAGE_SETUP, artifactDamageProfile } from '../src/lib/damage';
import { computeStats } from '../src/lib/stats';
import { StatKey } from '../src/lib/effects';
import { RelicDetail, RuneDetail } from '../src/types';
import { etatReliqueDuBuild } from '../src/lib/relicQueue';
import { buildRealDamageContext } from '../scripts/lib/realDamageCli';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { ok, titre } from './outils';

type Critere = StatKey | Objective;
const BASE = { hp: 10000, atk: 1000, def: 600, spd: 100, cr: 30, cd: 75, res: 15, acc: 0 };
function corpus(n = 80, seed = 1818) {
  const tirer = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const runes: RuneDetail[] = [];
  const base: BuildCandidate[] = [];
  for (let i = 0; i < n; i++) {
    const pieces: RuneDetail[] = Array.from({ length: 6 }, (_, j) => ({
      id: 6 * i + j + 1, slot: j + 1, set: ['fight', 'enhance', 'determination', 'rage'][i % 4],
      rank: 6, rarity: 5, level: 15, main: { code: 3, value: tirer() % 150 },
      subs: [{ code: 8, value: tirer() % 30 }, { code: 10, value: tirer() % 20 }],
    }));
    runes.push(...pieces);
    base.push({ runeIds: pieces.map((r) => r.id), stats: computeStats({ base: BASE, runes: pieces, artifacts: [] }), effTotal: tirer() % 100 });
  }
  return { base, runeById: new Map(runes.map((r) => [r.id, r])) };
}
function resultat(c: BuildCandidate, gain = 200, conforme = true, rid?: number): ResultatArtefacts {
  const relique: RelicDetail | undefined = rid === undefined ? undefined : { id: rid, upgrade: 9, main: { code: 101, value: 0 } };
  return { paire: null, artefacts: [], stats: c.stats.map((s) => {
    const total = s.key === 'atk' ? s.total + gain : s.total;
    return { ...s, total, bonus: total - s.base };
  }), meilleurSansVerrous: null, conforme, ...(relique ? { relique } : {}) };
}
function options(runeById: Map<number, RuneDetail>, cache: ReadonlyMap<string, ResultatArtefacts>, degats = false) {
  const setup = structuredClone(DEFAULT_DAMAGE_SETUP);
  const recette = buildOptimizerRecipe({ monsterCom2usId: 13413, monsterName: 'Test', requirement: { sets: [], minStats: {} }, objective: 'degats_reels', damageSetup: setup,
    metric: 'eff', slotFilterPreset: 'bas', exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false, artifactMainByKind: {} });
  const realDamage = degats ? buildRealDamageContext(recette, 13413, []) : null;
  if (degats && !realDamage) throw new Error('Contexte de dégâts absent');
  return optionsDeClassement({ realDamage, damageSetup: setup, runeById, metric: 'eff',
    aurasPropresDe: aurasPropresParRunes(runeById),
    artefactsDuBuild: (c) => { const r = cache.get(cleBuild(c)); return r ? artifactDamageProfile(r.artefacts) : null; },
    etatReliqueDe: (c) => etatReliqueDuBuild(cache.get(cleBuild(c)), undefined, undefined),
    contexteExclusive: { setup, element: 'wind' },
  });
}
function reference(base: BuildCandidate[], cache: ReadonlyMap<string, ResultatArtefacts>, critere: Critere, opts: OptionsDeClassement) {
  if (!cache.size) return base;
  return sortCandidates(ordonnerParDepartage(base.filter((c) => cache.get(cleBuild(c))?.conforme !== false), (c) => cache.get(cleBuild(c))?.relique?.id)
    .map((c) => candidatAvecSaPaire(c, cache)), critere, opts);
}
function comparer(recu: BuildCandidate[], attendu: BuildCandidate[], cas: string): void {
  if (recu.length !== attendu.length) throw new Error(`ARRÊT oracle compact : ${cas}, nombre reçu ${recu.length}, attendu ${attendu.length}`);
  for (let rang = 0; rang < recu.length; rang++) if (!isDeepStrictEqual(recu[rang], attendu[rang])) {
    throw new Error(`ARRÊT oracle compact : ${cas}, rang ${rang + 1}, reçu ${cleBuild(recu[rang])}, attendu ${cleBuild(attendu[rang])}`);
  }
  ok(true, `${cas} : ordre, identifiants et chaque champ des lignes identiques`);
}
function publication(index: ClassementCompact, base: BuildCandidate[], cache: ReadonlyMap<string, ResultatArtefacts>, critere: Critere, opts: OptionsDeClassement, cas: string) {
  const notation = preparerNotationCompacte(critere, opts);
  if (!notation) throw new Error('Précondition : notation compacte absente');
  index.actualiser(cache, journalResolution(cache), notation.contexte, notation.noter);
  const ordinaux = index.page(0, base.length);
  const attendus = Array.from({ length: base.length }, (_, i) => i);
  if (cache.size) {
    for (let i = attendus.length - 1; i >= 0; i--) if (cache.get(cleBuild(base[attendus[i]]))?.conforme === false) attendus.splice(i, 1);
    attendus.sort((a, b) => {
      const ra = cache.get(cleBuild(base[a]))?.relique?.id ?? Infinity, rb = cache.get(cleBuild(base[b]))?.relique?.id ?? Infinity;
      if (ra !== rb) return ra - rb;
      const ka = cleBuild(base[a]), kb = cleBuild(base[b]);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const notes = base.map((c) => scoreDuCandidat(candidatAvecSaPaire(c, cache), critere, opts));
    if (attendus.some((i) => notes[i] !== null)) attendus.sort((a, b) => notes[b]! - notes[a]!);
  }
  for (let rang = 0; rang < attendus.length; rang++) if (ordinaux[rang] !== attendus[rang]) {
    throw new Error(`ARRÊT oracle ordinal : ${cas}, rang ${rang + 1}, reçu ${ordinaux[rang]}, attendu ${attendus[rang]}`);
  }
  const recus = ordinaux.map((i) => index.magasin.candidat(i));
  const attendu = reference(base, cache, critere, opts);
  comparer(recus, attendu, cas);
  for (const i of ordinaux) {
    const note = scoreDuCandidat(candidatAvecSaPaire(base[i], cache), critere, opts);
    if (!Object.is(index.note(i), note)) throw new Error(`ARRÊT oracle note : ${cas}, ordinal ${i}, reçue ${index.note(i)}, attendue ${note}`);
  }
  const comptes = compteConfirme({ recus: base, parBuild: cache, trouves: base.length, taillePage: 20, termine: true });
  const indexComptes = index.comptes();
  if (indexComptes.confirmes !== comptes.confirmees || indexComptes.total !== attendu.length) throw new Error(`ARRÊT oracle comptes : ${cas}`);
  ok(true, `${cas} : notes et comptes identiques`);
  const affichable = compteAffichable({ trouves: base.length, recus: base.length, affichables: attendu.length, modeRecherche: false });
  ok(affichable.compte === indexComptes.total, `${cas} : compte affichable`);
  for (const debut of [0, 3, Math.max(0, attendu.length - 7), attendu.length]) {
    comparer(index.page(debut, 7).map((i) => index.magasin.candidat(i)), attendu.slice(debut, debut + 7), `${cas}, page ${debut}`);
  }
  comparer(classementResolu(base, cache, critere, opts), attendu, `${cas}, adaptation écran`);
}

export function testCandidatsCompactsAllerRetour() {
  titre('Candidats compacts — reconstruction exacte');
  const { base } = corpus();
  base[0].runeIds = [2 ** 40, 2 ** 40 + 3, -0, 7, 8, Number.MAX_SAFE_INTEGER];
  base[0].effTotal = -0;
  const specials = [-0, NaN, Infinity, -Infinity];
  specials.forEach((total, j) => { base[j].stats[0] = { ...base[j].stats[0], total, bonus: total - BASE.hp }; });
  const magasin = new CandidatsCompacts(base);
  comparer(base.map((_, i) => magasin.candidat(i)), base, 'aller-retour Float64, non-finis et identifiants larges');
  const faux = structuredClone(base); faux[3].stats[0].bonus = 123;
  let refuse = false;
  try { new CandidatsCompacts(faux); } catch (e) { refuse = e instanceof CandidatNonCompactable; }
  ok(refuse, 'bonus incohérent refusé, jamais corrigé en silence');
  const autreBase = structuredClone(base); autreBase[1].stats[1].base++;
  refuse = false;
  try { new CandidatsCompacts(autreBase); } catch (e) { refuse = e instanceof CandidatNonCompactable; }
  ok(refuse, 'base non commune refusée');
  // Petits identifiants (pool synthétique : 8 runes par emplacement) : sans
  // brassage final, leurs empreintes tombaient sur quelques cases et la table
  // devenait quadratique (193 452 candidats : plus de dix minutes au scellé).
  const cases = new Set<number>();
  let combinaisons = 0;
  for (let a = 1; a <= 8; a++) for (let b = 9; b <= 16; b++) for (let c = 17; c <= 24; c++) for (let d = 25; d <= 32; d++) {
    cases.add(hacherIds([a, b, c, d, 33, 41]) & 4095); combinaisons++;
  }
  // Au hasard, 4 096 tirages dans 4 096 cases en occupent ~63 %.
  ok(cases.size > 0.5 * 4096, `empreintes de petits identifiants réparties : ${cases.size} cases sur 4 096 pour ${combinaisons} combinaisons`);
}

export function testClassementCompactPublications() {
  titre('Classement compact — différentiel à chaque publication');
  for (const seed of [18, 1818, 77125]) {
    const { base, runeById } = corpus(80, seed);
    const cache = new CacheResolutionJournalise();
    const index = new ClassementCompact(base);
    let numero = 0;
    const publier = (critere: Critere = 'atk', degats = false) => {
      const p = cache.publier();
      publication(index, base, p, critere, options(runeById, p, degats), `graine ${seed}, publication ${++numero}, ${critere}`);
    };
    publier();
    cache.set('999,1000,1001,1002,1003,1004', resultat(base[0])); publier();
    for (const i of [79, 3, 41, 1, 70, 12, 15, 68]) { cache.set(cleBuild(base[i]), resultat(base[i], i * 10, i !== 12, i % 4)); publier(); }
    cache.set(cleBuild(base[3]), resultat(base[3], -1000, true, 99)); publier();
    cache.delete(cleBuild(base[1])); publier();
    for (const critere of ['hp', 'def', 'spd', 'cr', 'cd', 'res', 'acc', 'vitesse', 'efficience', 'ehp', 'degats_reels'] as const) publier(critere, true);
    publier('degats_reels', true);
    // Même critère, vraies lignes d'artéfacts et exclusive changées.
    const r = resultat(base[41], 120, true, 113);
    r.artefacts = [{ id: 981, kind: 'element', element: 'wind', level: 15, rarity: 5, main: { code: 101, value: 0 }, subs: [{ code: 219, value: 7 }] }];
    r.relique = { id: 113, upgrade: 9, main: { code: 101, value: 0 }, unique: { type: 1, tranche: 1000, percent: 3 } };
    cache.set(cleBuild(base[41]), r); publier('degats_reels', true);
    let tirage = seed;
    for (let lot = 0; lot < 12; lot++) {
      for (let j = 0; j < 4; j++) {
        tirage = (Math.imul(tirage, 1664525) + 1013904223) >>> 0;
        const i = tirage % base.length, cle = cleBuild(base[i]);
        if (tirage % 7 === 0) cache.delete(cle);
        else cache.set(cle, resultat(base[i], tirage % 1000 - 500, tirage % 11 !== 0, tirage % 5));
      }
      publier();
    }
  }
}

export function testClassementCompactDoublons() {
  titre('Classement compact — égalités, clés lexicales et doublons');
  const { base, runeById } = corpus(16);
  base[0].runeIds = [10, 11, 12, 13, 14, 15];
  base[1].runeIds = [2, 3, 4, 5, 6, 7];
  base[1].stats = structuredClone(base[0].stats);
  base[2].stats = structuredClone(base[0].stats);
  base.push({ ...structuredClone(base[0]), stats: resultat(base[0], 1000).stats });
  base.push({ ...structuredClone(base[0]), runeIds: [...base[0].runeIds].reverse() });
  base.push(base[0]);
  const cache = new CacheResolutionJournalise(), index = new ClassementCompact(base);
  const publier = (cas: string) => { const p = cache.publier(); publication(index, base, p, 'atk', options(runeById, p), cas); };
  cache.set('999,1000,1001,1002,1003,1004', resultat(base[0])); publier('cache chaud hors recherche');
  cache.set(cleBuild(base[0]), resultat(base[0], 0, true, 9)); publier('résolution du groupe de quatre doublons');
  ok(index.travail.controlees === 4, 'quatre lignes du groupe, aucun autre contrôle');
  cache.set(cleBuild(base[1]), resultat(base[1], 0, true, 5));
  cache.set(cleBuild(base[2]), resultat(base[2], 0, true, 5));
  publier('deux groupes à note égale et rid égal');
  ok(index.travail.controlees === 2, 'deux groupes modifiés : deux lignes contrôlées');
  cache.set(cleBuild(base[0]), resultat(base[0], 0, true, 1)); publier('relique changée à note égale');
  cache.set(cleBuild(base[0]), resultat(base[0], 0, false)); publier('rejet du groupe');
  cache.delete(cleBuild(base[0])); publier('retour aux stats collectées distinctes');
}

export function testClassementCompactNonFinis() {
  titre('Classement compact — deux tris natifs sur les non-finis');
  for (const position of [0, 7, 15]) {
    const { base, runeById } = corpus(16);
    const cache = new CacheResolutionJournalise(), index = new ClassementCompact(base);
    let numero = 0;
    const publier = (critere: Critere = 'atk') => { const p = cache.publier(); publication(index, base, p, critere, options(runeById, p), `non-fini position ${position}, publication ${++numero}`); };
    cache.set('999,1000,1001,1002,1003,1004', resultat(base[0])); publier();
    for (const total of [NaN, Infinity, -Infinity, -0]) {
      const r = resultat(base[position], 0);
      r.stats[1] = { ...r.stats[1], total, bonus: total - BASE.atk };
      cache.set(cleBuild(base[position]), r); publier();
      if (!Number.isFinite(total)) ok(index.travail.repliNonFini, 'note non finie : voie native');
    }
    for (const rid of [NaN, Infinity, -Infinity]) { cache.set(cleBuild(base[position]), resultat(base[position], 0, true, rid)); publier(); }
    cache.delete(cleBuild(base[position])); publier();
    publier('degats_reels'); // contexte absent : le départage seul subsiste.
  }
}

export function testClassementCompactControleVersions() {
  titre('Classement compact — travail proportionnel aux différences');
  const { base, runeById } = corpus(20000);
  const cache = new CacheResolutionJournalise(), index = new ClassementCompact(base);
  cache.set(cleBuild(base[0]), resultat(base[0]));
  const initial = cache.publier();
  const opts = options(runeById, initial);
  const contexte = preparerNotationCompacte('atk', opts)!;
  index.actualiser(initial, journalResolution(initial), contexte.contexte, contexte.noter);
  classementResolu(base, initial, 'atk', opts);
  for (const i of [19000, 18000, 99, 7, 10000]) {
    cache.set(cleBuild(base[i]), resultat(base[i], 0, true, 9));
    const p = cache.publier(), optionsCourantes = options(runeById, p);
    const notation = preparerNotationCompacte('atk', optionsCourantes)!;
    index.actualiser(p, journalResolution(p), notation.contexte, notation.noter);
    comparer(index.page(0, base.length).map((j) => index.magasin.candidat(j)), reference(base, p, 'atk', optionsCourantes), `Δ=1 à ${i}`);
    ok(index.travail.controlees === 1 && index.travail.notes === 1 && !index.travail.complet, 'une ligne contrôlée et notée');
    ok(index.travail.comparaisons < 100, 'moins de 100 comparaisons pour retirer et insérer parmi 20 000 lignes');
    comparer(classementResolu(base, p, 'atk', optionsCourantes), reference(base, p, 'atk', optionsCourantes), `adaptation Δ=1 à ${i}`);
    ok(travailDuClassementCompact(base)?.controlees === 1, 'l’adaptation utilise aussi la différence');
    const vide = cache.publier();
    index.actualiser(vide, journalResolution(vide), notation.contexte, notation.noter);
    ok(index.travail.controlees === 0 && index.travail.notes === 0 && index.travail.comparaisons === 0, 'Δ=0 : aucun contrôle, note ou comparaison');
    classementResolu(base, vide, 'atk', optionsCourantes);
  }
}

export function testClassementCompactJournalManquant() {
  titre('Classement compact — journal absent, manqué ou incohérent');
  const { base, runeById } = corpus(30);
  const cache = new CacheResolutionJournalise(), index = new ClassementCompact(base);
  cache.set(cleBuild(base[5]), resultat(base[5]));
  let p = cache.publier();
  publication(index, base, p, 'atk', options(runeById, p), 'initialisation complète');
  // Même génération, version consécutive, tailles et contexte inchangés :
  // seule la valeur « après » du journal contredit l'instantané publié.
  const notationInitiale = preparerNotationCompacte('atk', options(runeById, p))!;
  index.actualiser(p, journalResolution(p), notationInitiale.contexte, notationInitiale.noter);
  ok(!index.travail.complet && index.travail.controlees === 0, 'précondition : contexte identique et index réutilisable');
  cache.set(cleBuild(base[9]), resultat(base[9], 5000));
  p = cache.publier();
  const journalContradictoire = journalResolution(p)!;
  index.actualiser(p, {
    ...journalContradictoire,
    changements: journalContradictoire.changements.map((c) => ({ ...c, apres: resultat(base[9], -5000) })),
  }, notationInitiale.contexte, notationInitiale.noter);
  comparer(index.page(0, base.length).map((i) => index.magasin.candidat(i)), reference(base, p, 'atk', options(runeById, p)), 'entrée du journal contraire au cache');
  ok(index.travail.complet && index.travail.controlees === base.length, 'entrée contradictoire : classement complet, toutes les lignes recontrôlées');
  cache.set(cleBuild(base[9]), resultat(base[9], 1000));
  cache.publier(); // Publication non consommée.
  cache.set(cleBuild(base[8]), resultat(base[8], -1000, false));
  p = cache.publier();
  publication(index, base, p, 'atk', options(runeById, p), 'version manquée');
  ok(index.travail.complet && index.travail.controlees === base.length, 'version manquée : tout recontrôlé');
  const sansJournal = new Map(p);
  publication(index, base, sansJournal, 'atk', options(runeById, sansJournal), 'journal absent');
  ok(index.travail.complet, 'journal absent : reconstruction complète');
  const notation = preparerNotationCompacte('atk', options(runeById, p))!;
  const journal = journalResolution(p)!;
  index.actualiser(p, { ...journal, tailleApres: p.size + 1 }, notation.contexte, notation.noter);
  comparer(index.page(0, base.length).map((i) => index.magasin.candidat(i)), reference(base, p, 'atk', options(runeById, p)), 'journal incohérent');
  ok(index.travail.complet, 'taille incohérente : reconstruction complète');
  const memeVersion = new Map(p);
  memeVersion.set(cleBuild(base[1]), resultat(base[1], 5000));
  const notationMemeVersion = preparerNotationCompacte('atk', options(runeById, memeVersion))!;
  index.actualiser(memeVersion, { ...journal, tailleApres: memeVersion.size }, notationMemeVersion.contexte, notationMemeVersion.noter);
  comparer(index.page(0, base.length).map((i) => index.magasin.candidat(i)), reference(base, memeVersion, 'atk', options(runeById, memeVersion)), 'version répétée sur un autre instantané');
  ok(index.travail.complet, 'version répétée sur un autre instantané : reconstruction complète');
  cache.clear(); cache.set(cleBuild(base[3]), resultat(base[3], 70));
  p = cache.publier(); publication(index, base, p, 'atk', options(runeById, p), 'vidage puis ajout');
  const relance = new CacheResolutionJournalise(); relance.set(cleBuild(base[0]), resultat(base[0], 4000));
  p = relance.publier(); publication(index, base, p, 'atk', options(runeById, p), 'signature et génération nouvelles');
  ok(index.travail.complet, 'nouvelle génération : classement complet');
  const j = journalResolution(p)!;
  ok(j.version === 1 && j.changements.length === 1, 'journal neuf, coût d’une clé');
  const identique = relance.get(cleBuild(base[0]))!;
  relance.set(cleBuild(base[0]), identique);
  const sansChangement = relance.publier();
  ok(journalResolution(sansChangement)!.version === 2 && journalResolution(sansChangement)!.changements.length === 0, 'publication sans écriture : version croissante, delta vide');
  // Ces appels créent leur classementResolu sans index compact amorcé :
  // ils vérifient le repli initial, pas l'invalidation d'un index réutilisé.
  const fonctions = options(runeById, sansChangement);
  (fonctions.damageSetup as unknown as Record<string, unknown>).donneeFonction = () => 1;
  comparer(classementResolu(base, sansChangement, 'degats_reels', fonctions), reference(base, sansChangement, 'degats_reels', fonctions), 'fonction dans les données');
  ok(travailDuClassementCompact(base) === undefined, 'fonction : aucune mémoire compacte réutilisée');
  const ordinaires = options(runeById, sansChangement, true);
  const avecFonctionPropre = optionsDeClassement({
    realDamage: ordinaires.realDamage ?? null, damageSetup: ordinaires.damageSetup!, runeById, metric: 'eff',
    aurasPropresDe: ordinaires.aurasPropresDe,
    artefactsDuBuild: (c) => c.runeIds[0] === base[base.length - 1].runeIds[0]
      ? { ...artifactDamageProfile([]), fonctionImprevue: () => 1 } : ordinaires.artefactsDuBuild!(c),
    etatReliqueDe: (c) => etatReliqueDuBuild(sansChangement.get(cleBuild(c)), undefined, undefined),
    contexteExclusive: { setup: ordinaires.damageSetup!, element: 'wind' },
  });
  comparer(classementResolu(base, sansChangement, 'degats_reels', avecFonctionPropre), reference(base, sansChangement, 'degats_reels', avecFonctionPropre), 'fonction propre au dernier candidat');
  ok(travailDuClassementCompact(base) === undefined, 'fonction propre : aucun index compact créé, garde objet conservée');

  class CacheCompte extends CacheResolutionJournalise {
    lectures = 0;
    override get(cle: string) { this.lectures++; return super.get(cle); }
  }
  const mesureDuTravail = new CacheCompte();
  for (let i = 0; i < 20000; i++) mesureDuTravail.set(String(i), identique);
  mesureDuTravail.publier();
  mesureDuTravail.set('1234', resultat(base[0]));
  mesureDuTravail.lectures = 0;
  const delta = mesureDuTravail.publier();
  ok(mesureDuTravail.lectures === 1 && journalResolution(delta)!.changements.length === 1, 'journal sur 20 000 entrées : une seule clé relue pour Δ=1');
  mesureDuTravail.set('temporaire', identique); mesureDuTravail.delete('temporaire');
  mesureDuTravail.lectures = 0;
  const annule = mesureDuTravail.publier();
  ok(journalResolution(annule)!.changements.length === 0 && mesureDuTravail.lectures === 1, 'ajout puis retrait : changement net vide, seule la clé touchée est relue');
}
