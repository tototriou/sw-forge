// Mesure de BUILDS : ce que rapporte l'élargissement des heuristiques du
// moteur (pré-filtrage par emplacement `slotFilterCap`, rétention par
// compartiment `bucketCap`), et l'INCLUSION des préréglages entre eux (un cran
// plus large doit contenir les builds valides de chaque cran plus étroit).
// Ce n'est PAS une mesure de temps : les durées imprimées sont indicatives.
//
// Chaîne de PRODUCTION : `prepareSearch` → `construireMoitie` ×2 dans deux
// `worker_threads` (`construireMoitiesEnParallele`, la coquille Node des Web
// Workers de moitié) → appariement parallèle (`apparierRapideEnParallele`,
// lanceur Node), `maxMs` levé et plafond de candidats levé.
//
// Usage (un processus par configuration) :
//   npx tsx scripts/mesure-heuristiques.ts --cas=<indice> --config=<bas|moyen|haut|extreme|x2|x4|x8|infini|bc<N>> --sortie=<dossier> [--ref=<dossier>]
//   npx tsx scripts/mesure-heuristiques.ts --compte=<export.json> --recette=<recette.json> --config=… --sortie=…
//   npx tsx scripts/mesure-heuristiques.ts --tableau=<dossier>       (agrège les JSON en tableaux Markdown)
// Options : --fils=8 (Workers d'appariement)  --plafond=<n> (candidats, défaut 20 000 000)
//           --limite-min=<n> (durée max, défaut 60)
//           --moities-seulement : s'arrête après la construction et compare les DEMI-BUILDS
//                                 retenus (inclusion par moitié), sans appariement
//
// Configurations (⚠️ `slotFilterCap` déplace `bucketCap` : il est dérivé sauf mention) :
//   bas      slotFilterCap 40, bucketCap dérivé
//   moyen    slotFilterCap 80, bucketCap dérivé             (RÉFÉRENCE des critères)
//   haut     slotFilterCap 150, bucketCap dérivé
//   extreme  slotFilterCap 300, bucketCap dérivé
//   x2/x4/x8 slotFilterCap 80, bucketCap = k × bucketCapFor(80)
//   bc<N>    slotFilterCap 80, bucketCap = N × bucketCapFor(80)  (N quelconque)
//   infini   slotFilterCap 80, bucketCap = 1e9 (rétention levée)
//
// Inclusion : chaque configuration se compare à toutes les configurations PLUS ÉTROITES
// présentes dans `--ref` (préréglages de plus petit `slotFilterCap` ; pour x/bc/infini,
// Bas et Moyen) — par builds valides (`.cands.bin`), et par demi-builds retenus
// (`.demiA.bin`/`.demiB.bin`) avec `--moities-seulement`.
//
// ⚠️ **Fidélité** (skill `algo-verify`) : mêmes appels que scripts/banc-appariement-rapide.ts
// (préparation, moitiés par les Workers de production, appariement parallèle de production).
// Overrides MARQUÉS en tête de sortie : maxMs = ∞, maxCollected levé, slotFilterCap/bucketCap
// selon la configuration. Les critères « Trier par » sont notés par `scoreDuCandidat` avec les
// options de l'ordre de base de l'écran (`optionsDeClassement`, sans résolution d'équipement),
// comme classerCommeLEcran.

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { freemem } from 'os';
import { join } from 'path';
import {
  Bucket,
  BuildCandidate,
  Objective,
  SearchParams,
  aurasPropresParRunes,
  bucketCapFor,
  optionsDeClassement,
  prepareSearch,
  scoreDuCandidat,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import { tailleCompartiments } from '../src/lib/constructionRapide';
import { verifierContrat } from '../src/lib/appariementRapide';
import { etatReliqueDuBuild } from '../src/lib/relicQueue';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { StatKey } from '../src/lib/effects';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { chargerRecette } from './lib/chargerRecette';
import { resoudreCas } from './lib/diagnosticLot';
import { CASES } from './lib/perfShared';
import { apparierNode, assurerBundleAppariementRapide } from './lib/appariementRapideNode';
import { construireMoitiesObjetsEnParallele, ensureBuildHalfBundle } from './lib/buildHalvesNode';
import { LoadedMonster } from './lib/loadMonster';
import { loadMonstersList } from './lib/monstersData';
import { buildRealDamageContext } from './lib/realDamageCli';

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const drapeau = (nom: string): boolean => args.includes(`--${nom}`);

const STATS: StatKey[] = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
const TOP = 20;

interface Source {
  slug: string;
  libelle: string;
  params: SearchParams;
  recipe: OptimizerRecipe;
  loaded: LoadedMonster;
  avertissements: string[];
}

function source(): Source {
  const cas = valeur('cas');
  if (cas != null) {
    const i = Number(cas);
    const { resolue } = resoudreCas(i, {});
    return { slug: `cas${i}`, libelle: `cas ${i} — ${CASES[i].label}`, params: resolue.params, recipe: resolue.recette!, loaded: resolue.monstre!, avertissements: resolue.avertissements };
  }
  const compte = valeur('compte');
  const recette = valeur('recette');
  if (!compte || !recette) throw new Error('--cas=… ou --compte=… --recette=… attendu');
  const c = chargerRecette(compte, recette);
  return { slug: c.recipe.monsterName.toLowerCase(), libelle: `recette ${c.recipe.monsterName} (${c.modeLabel})`, params: c.params, recipe: c.recipe, loaded: c.loaded, avertissements: c.avertissements };
}

const MOYEN = 80;
const PRESETS: Record<string, number> = { bas: 40, moyen: 80, haut: 150, extreme: 300 };

function appliquerConfig(params: SearchParams, config: string): { params: SearchParams; description: string } {
  const p: SearchParams = { ...params };
  const cap = (c: number) => {
    p.slotFilterCap = c;
    delete p.bucketCap;
  };
  const multiple = (k: number) => {
    p.slotFilterCap = MOYEN;
    p.bucketCap = Math.round(k * bucketCapFor(MOYEN));
  };
  if (config in PRESETS) cap(PRESETS[config]);
  else if (config === 'infini') {
    p.slotFilterCap = MOYEN;
    p.bucketCap = 1e9;
  } else if (/^(x|bc)\d+$/.test(config)) multiple(Number(config.replace(/^(x|bc)/, '')));
  else throw new Error(`--config : « ${config} » inconnue`);
  return { params: p, description: config };
}

/** Les configurations PLUS ÉTROITES que `config`, dont l'inclusion se vérifie. */
function plusEtroites(config: string): string[] {
  const cap = config in PRESETS ? PRESETS[config] : MOYEN;
  const etroites = Object.keys(PRESETS).filter((k) => PRESETS[k] < cap);
  // Une configuration x/bc/infini part du pool de Moyen avec plus de places : elle contient aussi Moyen.
  return config in PRESETS ? etroites : [...etroites, 'moyen'];
}

function empreinte(valeurs: Iterable<string>): string {
  const h = createHash('sha256');
  for (const v of valeurs) h.update(v).update('\n');
  return h.digest('hex').slice(0, 16);
}

/** Relit un `.bin` (⚠️ le tampon d'un petit fichier peut être mutualisé : copie exacte de ses octets). */
function lireBin(chemin: string): Float64Array {
  const b = readFileSync(chemin);
  return new Float64Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}

/** Les n-uplets d'identifiants d'un `.bin` (n identifiants par élément). */
function clesDuBin(chemin: string, n: number): Set<string> {
  const bin = lireBin(chemin);
  const s = new Set<string>();
  for (let i = 0; i < bin.length; i += n) s.add(Array.from(bin.subarray(i, i + n)).join(','));
  return s;
}

function ecrireBin(chemin: string, nuplets: number[][], n: number): void {
  const bin = new Float64Array(nuplets.length * n);
  nuplets.forEach((x, i) => bin.set(x, i * n));
  writeFileSync(chemin, Buffer.from(bin.buffer));
}

const cle = (c: BuildCandidate)=> c.runeIds.join(',');
const demiBuilds = (buckets: Bucket[]): number[][] => buckets.flatMap((b) => b.combos.map((c) => c.runes.map((r) => r.id)));

interface Haut {
  score: number;
  ids: number[];
}

/** Les TOP premiers dans l'ordre de `sortCandidates` (score décroissant, ex æquo : ordre d'entrée), et le nombre de scores strictement supérieurs à `seuil`. */
function meilleurs(candidates: BuildCandidate[], score: (c: BuildCandidate) => number | null, seuil: number | null): { top: Haut[]; strictementMieux: number | null; nonNote: boolean } {
  const top: Haut[] = [];
  let strict = 0;
  for (const c of candidates) {
    const s = score(c);
    if (s == null) return { top: [], strictementMieux: null, nonNote: true };
    if (seuil != null && s > seuil) strict++;
    if (top.length < TOP || s > top[top.length - 1].score) {
      let i = top.length;
      while (i > 0 && top[i - 1].score < s) i--;
      top.splice(i, 0, { score: s, ids: c.runeIds });
      if (top.length > TOP) top.pop();
    }
  }
  return { top, strictementMieux: seuil == null ? null : strict, nonNote: false };
}

async function run(): Promise<void> {
  const config = valeur('config');
  const sortie = valeur('sortie');
  if (!config || !sortie) throw new Error('--config=… et --sortie=… attendus');
  const refDossier = valeur('ref');
  const fils = Number(valeur('fils') ?? 8);
  const plafond = Number(valeur('plafond') ?? 20_000_000);
  const limiteMs = Number(valeur('limite-min') ?? 60) * 60_000;
  const moitiesSeulement = drapeau('moities-seulement');
  const src = source();
  const nom = `${src.slug}-${config}`;
  mkdirSync(sortie, { recursive: true });
  const lignes: string[] = [];
  const dire = (l: string) => {
    console.log(l);
    lignes.push(l);
  };
  const json: Record<string, unknown> = { source: src.libelle, config, date: new Date().toISOString(), fils, plafond, moitiesSeulement };
  let echec = false;

  dire(`━━ ${src.libelle} · configuration ${config}${moitiesSeulement ? ' · MOITIÉS SEULEMENT' : ''}`);
  for (const a of src.avertissements) dire(`⚠️ ${a}`);
  const { params: p0 } = appliquerConfig(src.params, config);
  const params: SearchParams = { ...p0, maxMs: Infinity, maxCollected: plafond };
  dire(`⚠️ DIVERGE DE LA PROD (overrides marqués) : maxMs = ∞, maxCollected = ${plafond.toLocaleString('fr-FR')}, slotFilterCap = ${params.slotFilterCap}, bucketCap = ${params.bucketCap ?? `dérivé (${bucketCapFor(params.slotFilterCap!)})`}.`);

  // Mémoire et garde-fous (durée, mémoire libre).
  let pic = process.memoryUsage().rss;
  let abandon: string | null = null;
  const debutGlobal = performance.now();
  const minuterie = setInterval(() => {
    pic = Math.max(pic, process.memoryUsage().rss);
    if (freemem() < 1.2 * 2 ** 30) abandon = 'mémoire libre < 1,2 Go';
    else if (performance.now() - debutGlobal > limiteMs) abandon = `durée > ${limiteMs / 60000} min`;
    if (abandon) {
      json.abandon = abandon;
      json.picRssMo = Math.round(pic / 2 ** 20);
      dire(`⛔ ABANDON : ${abandon} (pic RSS ${json.picRssMo} Mo)`);
      writeFileSync(join(sortie, `${nom}.json`), JSON.stringify(json, null, 2));
      writeFileSync(join(sortie, `${nom}.txt`), lignes.join('\n') + '\n');
      process.exit(3);
    }
  }, 100);

  let t = performance.now();
  const prepared = prepareSearch(params);
  json.msPreparation = Math.round(performance.now() - t);
  if (!prepared) {
    dire('prepareSearch → null (un emplacement vide).');
    json.vide = true;
    writeFileSync(join(sortie, `${nom}.json`), JSON.stringify(json, null, 2));
    clearInterval(minuterie);
    return;
  }
  json.slotFilterCap = params.slotFilterCap;
  json.bucketCap = prepared.bucketCap;
  json.pools = prepared.filtered.map((l) => l.length);
  dire(`Préparation ${json.msPreparation} ms · pools ${(json.pools as number[]).join(' ')} · bucketCap ${prepared.bucketCap} · retentionKeys [${prepared.retentionKeys.join(',')}] · objectif ${src.recipe.objective}`);

  // Construction : les Workers de moitié de production.
  t = performance.now();
  const moities = await construireMoitiesObjetsEnParallele(prepared, params, await ensureBuildHalfBundle());
  const { bucketsA, bucketsB } = moities;
  json.msConstruction = Math.round(performance.now() - t);
  const tA = tailleCompartiments(bucketsA);
  const tB = tailleCompartiments(bucketsB);
  const totalPaires = totalPairCount(prepared, bucketsA, bucketsB);
  const contrat = verifierContrat(prepared, bucketsA, bucketsB);
  json.compartiments = [tA.compartiments, tB.compartiments];
  json.demiBuilds = [tA.combos, tB.combos];
  json.totalPaires = totalPaires;
  json.contrat = contrat;
  dire(`Construction ${json.msConstruction} ms (Workers de moitié de production) · compartiments ${tA.compartiments} × ${tB.compartiments}, demi-builds ${tA.combos} × ${tB.combos} · totalPairCount ${totalPaires.toLocaleString('fr-FR')}`);
  const demisA = demiBuilds(bucketsA);
  const demisB = demiBuilds(bucketsB);
  json.empreinteDemiBuilds = empreinte([...demisA.map((x) => `A${x.join(',')}`), ...demisB.map((x) => `B${x.join(',')}`)]);
  ecrireBin(join(sortie, `${nom}.demiA.bin`), demisA, 3);
  ecrireBin(join(sortie, `${nom}.demiB.bin`), demisB, 3);

  const etroites = refDossier ? plusEtroites(config).filter((c) => existsSync(join(refDossier, `${src.slug}-${c}.demiA.bin`))) : [];
  if (refDossier) {
    // Inclusion par moitié : chaque demi-build retenu par un cran plus étroit l'est-il ici ?
    const ici = { A: new Set(demisA.map((x) => x.join(','))), B: new Set(demisB.map((x) => x.join(','))) };
    const inclusionDemi: Record<string, unknown> = {};
    for (const c of etroites) {
      const r: Record<string, { reference: number; manquants: number }> = {};
      for (const h of ['A', 'B'] as const) {
        const ref = clesDuBin(join(refDossier, `${src.slug}-${c}.demi${h}.bin`), 3);
        let manquants = 0;
        for (const k of ref) if (!ici[h].has(k)) manquants++;
        r[h] = { reference: ref.size, manquants };
      }
      inclusionDemi[c] = r;
      if (r.A.manquants + r.B.manquants > 0) echec = true;
      dire(`Inclusion des demi-builds de ${c} : A ${r.A.reference - r.A.manquants}/${r.A.reference}, B ${r.B.reference - r.B.manquants}/${r.B.reference}` +
        (r.A.manquants + r.B.manquants > 0 ? ` — ${r.A.manquants + r.B.manquants} MANQUANTS` : ' — OK'));
    }
    json.inclusionDemiBuilds = inclusionDemi;
  }
  if (moitiesSeulement) {
    json.picRssMo = Math.round(pic / 2 ** 20);
    dire(`Pic RSS ${json.picRssMo} Mo · durée totale ${((performance.now() - debutGlobal) / 1000).toFixed(1)} s [indicatif]`);
    json.msTotal = Math.round(performance.now() - debutGlobal);
    clearInterval(minuterie);
    writeFileSync(join(sortie, `${nom}.json`), JSON.stringify(json, null, 2));
    writeFileSync(join(sortie, `${nom}.txt`), lignes.join('\n') + '\n');
    process.exit(echec ? 4 : 0);
  }
  dire(`Chemin d'appariement : ${contrat ? `ACTUEL (contrat numérique non tenu : ${contrat})` : 'noyau (contrat tenu)'}`);

  // Appariement parallèle de production.
  const cheminBundle = await assurerBundleAppariementRapide();
  t = performance.now();
  const { parallele: r } = await apparierNode({
    params, prepared, bucketsA, bucketsB, totalPaires, travailleurs: fils, cheminBundle, regime: 'parallele', startedAt: prepared.startedAt,
  });
  if (!r) throw new Error('Bilan parallèle manquant');
  json.msAppariement = Math.round(performance.now() - t);
  const candidates = r.candidates;
  json.motif = r.motif;
  json.traitees = r.traitees;
  json.complet = r.motif === 'aucun' && r.traitees === totalPaires;
  json.candidats = candidates.length;
  dire(`Appariement ${json.msAppariement} ms · ${candidates.length.toLocaleString('fr-FR')} builds valides · traitées ${r.traitees.toLocaleString('fr-FR')} / ${totalPaires.toLocaleString('fr-FR')} · motif ${r.motif}`);
  if (!json.complet) {
    echec = true;
    dire('⚠️ RECHERCHE NON COMPLÈTE : les chiffres ne sont pas ceux de la configuration entière.');
  }
  json.empreinteCandidats = empreinte(candidates.map((c) => JSON.stringify(c)));
  json.picRssMo = Math.round(pic / 2 ** 20);

  // Persistance des builds (identifiants Float64, 6 par build) pour l'inclusion.
  ecrireBin(join(sortie, `${nom}.cands.bin`), candidates.map((c) => c.runeIds), 6);

  // Critères de « Trier par », face à Moyen.
  const runeById = new Map(params.pool.map((x) => [x.id, x]));
  const setup = src.recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP;
  const realDamage = buildRealDamageContext(src.recipe, src.loaded.com2usId, params.artifacts);
  const options = optionsDeClassement({
    realDamage, damageSetup: setup, runeById, metric: src.recipe.metric, aurasPropresDe: aurasPropresParRunes(runeById),
    contexteExclusive: { setup, element: loadMonstersList().find((m) => m.com2usId === src.loaded.com2usId)?.element ?? null },
    // Comme classerCommeLEcran sans cache de résolution.
    artefactsDuBuild: () => null, etatReliqueDe: () => etatReliqueDuBuild(undefined, params.relicContext, params.relic),
  });
  const refJson = refDossier && config !== 'moyen' && existsSync(join(refDossier, `${src.slug}-moyen.json`)) ? JSON.parse(readFileSync(join(refDossier, `${src.slug}-moyen.json`), 'utf8')) : null;
  const criteres: (StatKey | Objective)[] = [...STATS, 'efficience'];
  if (src.recipe.objective !== 'efficience') criteres.push(src.recipe.objective);
  const binMoyen = refDossier ? join(refDossier, `${src.slug}-moyen.cands.bin`) : null;
  const refCles = binMoyen && config !== 'moyen' && existsSync(binMoyen) ? clesDuBin(binMoyen, 6) : null;
  const sorties: Record<string, unknown> = {};
  for (const k of criteres) {
    const refMeilleur = refJson?.criteres?.[k]?.top?.[0]?.score ?? null;
    const m = meilleurs(candidates, (c) => scoreDuCandidat(c, k, options), refMeilleur);
    const top = m.top.map((h) => ({ score: h.score, ids: h.ids, nouveau: refCles ? !refCles.has(h.ids.join(',')) : null }));
    sorties[k] = {
      nonNote: m.nonNote, meilleur: top[0]?.score ?? null, top,
      rangDuMeilleurDeLaReference: m.strictementMieux == null ? null : m.strictementMieux + 1,
      topNouveaux: refCles ? top.filter((h) => h.nouveau).length : null,
    };
    const ref = refJson?.criteres?.[k];
    dire(`  ${String(k).padEnd(14)} meilleur ${top[0]?.score ?? '—'}` + (ref ? ` (réf ${ref.meilleur}) · top ${TOP} : ${top.filter((h) => h.nouveau).length} nouveaux · 20ᵉ ${top[top.length - 1]?.score ?? '—'} (réf ${ref.top[ref.top.length - 1]?.score ?? '—'}) · rang du meilleur de la réf : ${m.strictementMieux! + 1}` : ''));
  }
  json.criteres = sorties;

  // Inclusion des builds valides de chaque cran plus étroit.
  const etroitesBuilds = refDossier ? plusEtroites(config).filter((c) => existsSync(join(refDossier, `${src.slug}-${c}.cands.bin`))) : [];
  const inclusion: Record<string, unknown> = {};
  const presents = new Set(candidates.map(cle));
  const demiA = new Set(demisA.map((x) => x.join(',')));
  const demiB = new Set(demisB.map((x) => x.join(',')));
  for (const c of etroitesBuilds) {
    const refC = clesDuBin(join(refDossier!, `${src.slug}-${c}.cands.bin`), 6);
    const manquants = [...refC].filter((k) => !presents.has(k));
    // Où chaque build manquant s'est perdu : pré-filtrage (rune absente de `filtered`), rétention
    // d'une moitié (demi-build absent des compartiments), ou appariement (les deux moitiés présentes).
    const perte = { preFiltrage: 0, retentionA: 0, retentionB: 0, retentionAetB: 0, appariement: 0 };
    for (const k of manquants) {
      const ids = k.split(',').map(Number);
      if (ids.some((id, s) => !prepared.filtered[s].some((x) => x.id === id))) { perte.preFiltrage++; continue; }
      const a = demiA.has(ids.slice(0, 3).join(','));
      const bb = demiB.has(ids.slice(3).join(','));
      if (a && bb) perte.appariement++;
      else if (!a && !bb) perte.retentionAetB++;
      else if (!a) perte.retentionA++;
      else perte.retentionB++;
    }
    if (manquants.length) echec = true;
    inclusion[c] = { reference: refC.size, retrouves: refC.size - manquants.length, manquants: manquants.length, perte, exemples: manquants.slice(0, 5) };
    if (manquants.length) dire(`Où les manquants de ${c} se sont perdus : ${JSON.stringify(perte)}`);
    dire(`Inclusion des builds de ${c} : ${refC.size - manquants.length} / ${refC.size} retrouvés${manquants.length ? ` — ⛔ ${manquants.length} MANQUANTS, ex. ${manquants.slice(0, 3).join(' | ')}` : ' — OK'}`);
  }
  json.inclusion = inclusion;
  dire(`Pic RSS ${json.picRssMo} Mo · durée totale ${((performance.now() - debutGlobal) / 1000).toFixed(1)} s [indicatif]`);
  json.msTotal = Math.round(performance.now() - debutGlobal);
  clearInterval(minuterie);
  writeFileSync(join(sortie, `${nom}.json`), JSON.stringify(json, null, 2));
  writeFileSync(join(sortie, `${nom}.txt`), lignes.join('\n') + '\n');
  process.exit(echec ? 4 : 0);
}

/* --------------------------------------------------------------------------
 * Agrégation en tableaux Markdown
 * ----------------------------------------------------------------------- */

const ORDRE_CONFIG = ['bas', 'moyen', 'haut', 'extreme', 'x2', 'x4', 'x8'];

function tableau(dossier: string): void {
  const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.json') && f.includes('-'));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parCas = new Map<string, Record<string, Record<string, any>>>();
  for (const f of fichiers) {
    const j = JSON.parse(readFileSync(join(dossier, f), 'utf8'));
    if (!j.config) continue;
    const slug = f.slice(0, f.length - 5 - j.config.length - 1);
    if (!parCas.has(slug)) parCas.set(slug, {});
    parCas.get(slug)![j.config] = j;
  }
  const rang = (c: string) => (ORDRE_CONFIG.indexOf(c) >= 0 ? ORDRE_CONFIG.indexOf(c) : 100 + (Number(c.replace(/\D/g, '')) || 999));
  const resumeInclusion = (inc: Record<string, { retrouves?: number; reference: number; manquants: number | Record<string, unknown> }> | undefined) =>
    inc ? Object.entries(inc).map(([c, x]) => `${c} ${typeof x.manquants === 'number' ? `${x.retrouves}/${x.reference}${x.manquants ? ' ⛔' : ''}` : JSON.stringify(x)}`).join(', ') || '—' : '—';
  for (const [slug, configs] of [...parCas].sort()) {
    console.log(`\n### ${slug}\n`);
    console.log('| Config | slot/bucketCap | demi-builds A×B | paires | complet | builds valides | inclusion (builds) | pic RSS Mo | temps s (constr+app) |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const c of Object.keys(configs).sort((a, b) => rang(a) - rang(b))) {
      const j = configs[c];
      if (j.abandon) { console.log(`| ${c} | | | | ABANDON : ${j.abandon} | | | ${j.picRssMo} | |`); continue; }
      console.log(`| ${c} | ${j.slotFilterCap}/${j.bucketCap} | ${j.demiBuilds?.join(' × ')} | ${j.totalPaires?.toExponential(2)} | ${j.moitiesSeulement ? 'moitiés' : j.complet ? 'oui' : 'NON (' + j.motif + ')'} | ${j.candidats ?? '—'} | ${resumeInclusion(j.inclusion)} | ${j.picRssMo} | ${(((j.msConstruction ?? 0) + (j.msAppariement ?? 0)) / 1000).toFixed(1)} |`);
    }
    const ref = configs.moyen;
    if (!ref?.criteres) continue;
    console.log('\nMeilleur (top-20 nouveaux / 20ᵉ valeur), par critère, face à Moyen :\n');
    const crit = Object.keys(ref.criteres);
    console.log(`| Config | ${crit.join(' | ')} |`);
    console.log(`|---|${crit.map(() => '---').join('|')}|`);
    for (const c of Object.keys(configs).sort((a, b) => rang(a) - rang(b))) {
      const j = configs[c];
      if (!j.criteres) continue;
      console.log(`| ${c} | ${crit.map((k) => {
        const x = j.criteres[k];
        const r = ref.criteres[k];
        if (!x || x.nonNote) return '—';
        if (c === 'moyen') return `${x.meilleur} (20ᵉ ${x.top[x.top.length - 1]?.score})`;
        return `${x.meilleur} (${x.meilleur >= r.meilleur ? '+' : ''}${(x.meilleur - r.meilleur).toFixed(2)} ; ${x.topNouveaux} nv ; 20ᵉ ${x.top[x.top.length - 1]?.score} ; rang réf ${x.rangDuMeilleurDeLaReference})`;
      }).join(' | ')} |`);
    }
  }
}

if (valeur('tableau')) tableau(valeur('tableau')!);
else
  run().catch((e) => {
    console.error(e instanceof Error ? e.stack : String(e));
    process.exit(2);
  });
