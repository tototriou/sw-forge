// Banc du PROTOTYPE de noyau d'appariement (src/lib/appariementRapide.ts,
// chantier perf-moteur, lot 2) : le prototype et `pairBuckets` sur les MÊMES
// compartiments, et leur différentiel (contrat A.2 bis 4 du chantier).
//
// Usage :
//   npx tsx scripts/banc-appariement-rapide.ts --cas=<indice|nom|tous>
//   npx tsx scripts/banc-appariement-rapide.ts --compte=<export.json> --recette=<recette.json>
// Options :
//   --modes=complet,petit,arret   les différentiels à faire (défaut : les trois)
//   --petit=<n>                   le petit plafond de candidats (défaut 1000)
//   --arret=<N>                   arrêt déterministe au point de passage traitees = N
//                                 (défaut : min(moitié de l'espace, 500 M), multiple de 500)
//   --workers=4,8,16              les régimes parallèles du prototype (défaut 4,8,16 ; 0 = aucun)
//   --resoudre                    résolution de l'équipement du CLI (--resoudre-tout) sur
//                                 les candidats du mode `petit`, des deux côtés
//   --cache=<dossier>             garde les résultats de référence (runs longs) entre deux passes
//   --sortie=<dossier>            écrit le rapport texte et le JSON du cas
//   --suffixe=<texte>             ajouté au nom des fichiers de sortie (deux passes d'un même cas)
//
// ⚠️ **Fidélité** (skill `algo-verify`) : préparation par `prepareSearch`,
// moitiés par les Workers de production (`construireMoitiesEnParallele`,
// mêmes arguments que l'écran), référence par `pairBuckets` à trois
// arguments, drainé sans budget de paires. Deux overrides, MARQUÉS en tête de
// sortie : `maxMs` levé (aucune troncature par le temps) et `maxCollected`
// fixé par le mode. Le régime de référence est SÉQUENTIEL : la fusion du
// prototype parallèle redonne l'ordre séquentiel, c'est à lui qu'il se compare.
//
// ⚠️ **Les temps affichés sont INDICATIFS** : une passe, sans protocole
// (aucune répétition entrelacée, contention non contrôlée). Ils ne servent à
// aucune conclusion ; la mesure est celle du pilote (skill
// `optimizer-perf-testing`).

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  Bucket,
  BuildCandidate,
  PairingProgress,
  PreparedSearch,
  SearchParams,
  SearchResult,
  pairBuckets,
  prepareSearch,
  totalPairCount,
} from '../src/lib/runeBuildOptim';
import { apparierRapide, verifierContrat } from '../src/lib/appariementRapide';
import { apparierRapideEnParallele } from '../src/lib/appariementRapideParallele';
import { OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { chargerRecette } from './lib/chargerRecette';
import { resoudreCas, resoudreSelectionCas, verifierComptesDisponibles } from './lib/diagnosticLot';
import { CASES } from './lib/perfShared';
import { construireMoitiesEnParallele, ensureBuildHalfBundle } from './lib/buildHalvesNode';
import { assurerBundleAppariementRapide, lancerTravailleurNode } from './lib/appariementRapideNode';
import { LoadedMonster } from './lib/loadMonster';
import { classerCommeLEcran } from './lib/classementCli';
import { buildRealDamageContext } from './lib/realDamageCli';

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const drapeau = (nom: string): boolean => args.includes(`--${nom}`);

type Mode = 'complet' | 'petit' | 'arret';
const MODES = (valeur('modes') ?? 'complet,petit,arret').split(',').map((m) => m.trim()) as Mode[];
for (const m of MODES) if (!['complet', 'petit', 'arret'].includes(m)) throw new Error(`--modes : « ${m} » inconnu (complet | petit | arret)`);
const PETIT = Number(valeur('petit') ?? 1000);
const WORKERS = (valeur('workers') ?? '4,8,16').split(',').map(Number).filter((n) => n > 0);
// Le corpus du différentiel complet (A.2 bis 4) : au-delà de 2 M candidats, le
// cas en sort ; le plafond est posé juste au-dessus pour le constater.
const PLAFOND_CORPUS = 2_000_000;
const sortie = valeur('sortie');
const cache = valeur('cache');

interface Source {
  slug: string;
  libelle: string;
  params: SearchParams;
  recipe?: OptimizerRecipe;
  loaded?: LoadedMonster;
  avertissements: string[];
}

function sources(): Source[] {
  const cas = valeur('cas');
  if (cas != null) {
    const indices = resoudreSelectionCas(cas);
    verifierComptesDisponibles(indices);
    return indices.map((i) => {
      const { resolue } = resoudreCas(i, {});
      return {
        slug: `cas${i}`, libelle: `cas ${i} — ${CASES[i].label}`, params: resolue.params,
        recipe: resolue.recette, loaded: resolue.monstre, avertissements: resolue.avertissements,
      };
    });
  }
  const compte = valeur('compte');
  const recette = valeur('recette');
  if (!compte || !recette) throw new Error('--cas=… ou --compte=… --recette=… attendu');
  const c = chargerRecette(compte, recette);
  return [{
    slug: c.recipe.monsterName.toLowerCase(), libelle: `recette ${c.recipe.monsterName} (${c.modeLabel}, préréglage ${c.recipe.slotFilterPreset})`,
    params: c.params, recipe: c.recipe, loaded: c.loaded, avertissements: c.avertissements,
  }];
}

/* --------------------------------------------------------------------------
 * État comparé (A.2 bis 4) et empreintes
 * ----------------------------------------------------------------------- */

interface Etat {
  candidates: BuildCandidate[];
  traitees: number;
  nearMissByCondition: SearchResult['nearMissByCondition'];
  globalNearMiss: SearchResult['globalNearMiss'];
  motif: 'aucun' | 'maxCollected' | 'maxMs' | 'arret';
  ms: number;
  extra?: Record<string, unknown>;
}

function motifDe(r: SearchResult, maxCollected: number): Etat['motif'] {
  return r.truncated ? (r.candidates.length >= maxCollected ? 'maxCollected' : 'maxMs') : 'aucun';
}

// Pilote un générateur d'appariement jusqu'au point de passage `explored = N`
// (l'état y couvre les paires < N) ou jusqu'au bout.
function piloter(gen: Generator<PairingProgress, SearchResult, void>, maxCollected: number, N?: number): { etat: Omit<Etat, 'ms'>; fin: SearchResult | null } {
  let step = gen.next();
  while (!step.done) {
    if (N != null && step.value.explored >= N) {
      const v = step.value;
      return { etat: { candidates: [...v.candidates], traitees: v.explored, nearMissByCondition: v.nearMissByCondition, globalNearMiss: v.globalNearMiss, motif: 'arret' }, fin: null };
    }
    step = gen.next();
  }
  const r = step.value;
  return { etat: { candidates: r.candidates, traitees: r.explored, nearMissByCondition: r.nearMissByCondition, globalNearMiss: r.globalNearMiss, motif: motifDe(r, maxCollected) }, fin: r };
}

function empreinte(valeurs: Iterable<string>): string {
  const h = createHash('sha256');
  for (const v of valeurs) h.update(v).update('\n');
  return h.digest('hex').slice(0, 16);
}

function empreinteCompartiments(bucketsA: Bucket[], bucketsB: Bucket[]): string {
  function* lignes() {
    for (const [nom, buckets] of [['A', bucketsA], ['B', bucketsB]] as const) {
      for (const b of buckets) {
        yield `${nom}|${b.counts.join(',')}|${b.jokers}|${b.potential}|${JSON.stringify(b.maxPct)}|${JSON.stringify(b.maxFlat)}`;
        for (const c of b.combos) yield `${c.runes.map((r) => r.id).join(',')}|${JSON.stringify(c.pct)}|${JSON.stringify(c.flat)}`;
      }
    }
  }
  return empreinte(lignes());
}

const empreinteCandidats = (c: BuildCandidate[]) => empreinte(c.map((x) => JSON.stringify(x)));

/** Rend `null` si égal, sinon le premier élément qui diffère. */
function difference(ref: Etat, autre: Etat): string | null {
  if (ref.motif !== autre.motif) return `motif : ${ref.motif} ≠ ${autre.motif}`;
  if (ref.traitees !== autre.traitees) return `traitees : ${ref.traitees} ≠ ${autre.traitees}`;
  if (ref.candidates.length !== autre.candidates.length) return `nombre de candidats : ${ref.candidates.length} ≠ ${autre.candidates.length}`;
  for (let i = 0; i < ref.candidates.length; i++) {
    const a = JSON.stringify(ref.candidates[i]);
    const b = JSON.stringify(autre.candidates[i]);
    if (a !== b) return `candidat #${i} : ${a.slice(0, 200)} ≠ ${b.slice(0, 200)}`;
  }
  if (JSON.stringify(ref.nearMissByCondition) !== JSON.stringify(autre.nearMissByCondition)) return 'nearMissByCondition diffère';
  if (JSON.stringify(ref.globalNearMiss) !== JSON.stringify(autre.globalNearMiss)) return 'globalNearMiss diffère';
  return null;
}

/* --------------------------------------------------------------------------
 * Mémoire : pic de RSS du processus (Workers compris), relevé pendant un run
 * ----------------------------------------------------------------------- */

async function avecPicMemoire<T>(f: () => Promise<T> | T): Promise<{ valeur: T; picMo: number }> {
  let pic = process.memoryUsage().rss;
  const minuterie = setInterval(() => {
    pic = Math.max(pic, process.memoryUsage().rss);
  }, 100);
  try {
    const v = await f();
    pic = Math.max(pic, process.memoryUsage().rss);
    return { valeur: v, picMo: Math.round(pic / 2 ** 20) };
  } finally {
    clearInterval(minuterie);
  }
}

/* --------------------------------------------------------------------------
 * Un cas
 * ----------------------------------------------------------------------- */

async function banc(src: Source, lignes: string[], json: Record<string, unknown>): Promise<boolean> {
  const dire = (l: string) => {
    console.log(l);
    lignes.push(l);
  };
  dire(`\n${'━'.repeat(78)}\n${src.libelle}\n${'━'.repeat(78)}`);
  for (const a of src.avertissements) dire(`⚠️ ${a}`);
  dire('⚠️ DIVERGE DE LA PROD (overrides marqués) : maxMs = ∞ (aucune troncature par le temps), maxCollected fixé par le mode ; référence = pairBuckets SÉQUENTIEL.');

  const params: SearchParams = { ...src.params, maxMs: Infinity };
  const t0 = performance.now();
  const prepared0 = prepareSearch(params);
  const msPrep = performance.now() - t0;
  if (!prepared0) {
    dire('prepareSearch → null (un emplacement vide) : rien à apparier.');
    return true;
  }
  const bundleMoities = await ensureBuildHalfBundle();
  const moities = await construireMoitiesEnParallele(prepared0, params, bundleMoities);
  const { bucketsA, bucketsB } = moities;
  const totalPaires = totalPairCount(prepared0, bucketsA, bucketsB);
  const contrat = verifierContrat(prepared0, bucketsA, bucketsB);
  const digest = empreinteCompartiments(bucketsA, bucketsB);
  dire(
    `Préparation ${msPrep.toFixed(0)} ms · moitiés ${moities.wallMs.toFixed(0)} ms (Workers de production) · ` +
      `compartiments ${bucketsA.length} × ${bucketsB.length}, demi-builds ${bucketsA.reduce((s, b) => s + b.combos.length, 0)} × ` +
      `${bucketsB.reduce((s, b) => s + b.combos.length, 0)} · empreinte ${digest}`
  );
  dire(`totalPairCount = ${totalPaires.toLocaleString('fr-FR')} · contraintes min ${prepared0.minEntries.map((e) => e.k).join('/') || '—'}, max ${prepared0.maxEntries.map((e) => e.k).join('/') || '—'}`);
  dire(`Chemin du prototype : ${contrat ? `ACTUEL (contrat numérique non tenu : ${contrat})` : 'noyau (contrat numérique tenu)'}`);
  json.totalPaires = totalPaires;
  json.empreinteCompartiments = digest;
  json.contrat = contrat;
  const modes: Record<string, unknown> = {};
  json.modes = modes;

  const arretParDefaut = 500 * Math.floor(Math.min(totalPaires / 2, 500_000_000) / 500);
  const N = valeur('arret') != null ? Number(valeur('arret')) : arretParDefaut;
  let toutEgal = true;
  let candidatsPetit: { ref: BuildCandidate[]; proto: BuildCandidate[] } | null = null;
  const lanceur = WORKERS.length > 0 ? lancerTravailleurNode(await assurerBundleAppariementRapide()) : null;

  for (const mode of MODES) {
    const maxCollected = mode === 'petit' ? PETIT : PLAFOND_CORPUS + 1;
    const arret = mode === 'arret' ? N : undefined;
    if (mode === 'arret' && !(N > 0 && N < totalPaires && N % 500 === 0)) {
      dire(`\n[${mode}] sans objet : N = ${N} hors ]0, totalPairs[ ou non multiple de 500.`);
      continue;
    }
    const prepared: PreparedSearch = { ...prepared0, maxCollected };
    const paramsMode: SearchParams = { ...params, maxCollected };
    dire(`\n[${mode}] maxCollected = ${maxCollected.toLocaleString('fr-FR')}${arret != null ? `, arrêt au point de passage traitees = ${arret.toLocaleString('fr-FR')}` : ''}`);

    // Référence, éventuellement en cache (runs de plusieurs dizaines de minutes).
    const fichierCache = cache ? join(cache, `${src.slug}-${mode}-${maxCollected}-${arret ?? 'fin'}-${digest}.json`) : null;
    let ref: Etat;
    if (fichierCache && existsSync(fichierCache)) {
      ref = JSON.parse(readFileSync(fichierCache, 'utf8')) as Etat;
      dire(`  référence relue du cache (${fichierCache}), calculée en ${(ref.ms / 1000).toFixed(1)} s`);
    } else {
      const debut = performance.now();
      const { etat } = piloter(pairBuckets(prepared, bucketsA, bucketsB), maxCollected, arret);
      ref = { ...etat, ms: performance.now() - debut };
      if (fichierCache) {
        mkdirSync(cache!, { recursive: true });
        writeFileSync(fichierCache, JSON.stringify(ref));
      }
    }
    const horsCorpus = mode === 'complet' && ref.motif === 'maxCollected';
    dire(
      `  référence pairBuckets : ${ref.candidates.length.toLocaleString('fr-FR')} candidats, traitees ${ref.traitees.toLocaleString('fr-FR')}` +
        ` (${ref.traitees === totalPaires ? '= totalPairCount' : `${((100 * ref.traitees) / totalPaires).toFixed(2)} % de totalPairCount`}), motif ${ref.motif}, ` +
        `${(ref.ms / 1000).toFixed(1)} s [indicatif]` +
        (horsCorpus ? ` — ⚠️ HORS CORPUS (> ${PLAFOND_CORPUS.toLocaleString('fr-FR')} candidats) : différentiel au plafond, pas non tronqué` : '')
    );
    const m: Record<string, unknown> = {
      maxCollected, arret: arret ?? null, horsCorpus,
      reference: { candidats: ref.candidates.length, traitees: ref.traitees, motif: ref.motif, empreinte: empreinteCandidats(ref.candidates), ms: Math.round(ref.ms) },
    };
    modes[mode] = m;

    // Prototype séquentiel.
    {
      const debut = performance.now();
      const gen = apparierRapide(prepared, bucketsA, bucketsB);
      const { etat, fin } = piloter(gen, maxCollected, arret);
      const ms = performance.now() - debut;
      const proto: Etat = { ...etat, ms };
      const diff = difference(ref, proto);
      if (diff) toutEgal = false;
      const fr = fin as (SearchResult & { visitees?: number; sautees?: number; chemin?: string; compteurs?: unknown }) | null;
      dire(
        `  prototype séquentiel : ${diff ? `DIFFÈRE — ${diff}` : 'ÉGAL'} · ${proto.candidates.length.toLocaleString('fr-FR')} candidats, traitees ${proto.traitees.toLocaleString('fr-FR')}` +
          (fr?.visitees != null ? `, visitees ${fr.visitees.toLocaleString('fr-FR')}, sautees ${fr.sautees!.toLocaleString('fr-FR')}` : '') +
          ` · ${(ms / 1000).toFixed(2)} s, ${(proto.traitees / ms / 1000).toFixed(1)} M paires/s [indicatif]` +
          (fr?.compteurs ? `\n    compteurs ${JSON.stringify(fr.compteurs)}` : '')
      );
      m.sequentiel = { egal: diff == null, difference: diff, candidats: proto.candidates.length, traitees: proto.traitees, empreinte: empreinteCandidats(proto.candidates), ms: Math.round(ms), visitees: fr?.visitees, sautees: fr?.sautees, chemin: fr?.chemin, compteurs: fr?.compteurs };
      if (mode === 'petit') candidatsPetit = { ref: ref.candidates, proto: proto.candidates };
    }

    // Prototype parallèle, à la demande.
    for (const W of WORKERS) {
      const debut = performance.now();
      const { valeur: r, picMo } = await avecPicMemoire(() =>
        apparierRapideEnParallele({
          params: paramsMode, prepared, bucketsA, bucketsB, totalPaires, travailleurs: W, lancer: lanceur!,
          startedAt: Date.now(), arretTraitees: arret,
        })
      );
      const ms = performance.now() - debut;
      const proto: Etat = { candidates: r.candidates, traitees: r.traitees, nearMissByCondition: r.nearMissByCondition, globalNearMiss: r.globalNearMiss, motif: r.motif, ms };
      const diff = difference(ref, proto);
      if (diff) toutEgal = false;
      dire(
        `  prototype ${W} Workers : ${diff ? `DIFFÈRE — ${diff}` : 'ÉGAL'} · ${r.candidates.length.toLocaleString('fr-FR')} candidats, traitees ${r.traitees.toLocaleString('fr-FR')}` +
          ` · ${r.morceaux} morceaux (plus gros ${r.plusGrosMorceau.toLocaleString('fr-FR')} paires, ${r.morceauxTraites} traités : ${r.parTravailleur.join('/')}) · planification ${r.msPlanification} ms` +
          ` · ${(ms / 1000).toFixed(2)} s, ${(r.traitees / ms / 1000).toFixed(1)} M paires/s, pic RSS ${picMo} Mo [indicatif]`
      );
      m[`parallele${W}`] = {
        egal: diff == null, difference: diff, candidats: r.candidates.length, traitees: r.traitees, empreinte: empreinteCandidats(r.candidates),
        ms: Math.round(ms), morceaux: r.morceaux, plusGrosMorceau: r.plusGrosMorceau, parTravailleur: r.parTravailleur, msPlanification: r.msPlanification, picRssMo: picMo,
        chemin: r.chemin, compteurs: r.compteurs,
      };
    }
  }

  // Résolution de l'équipement du CLI sur les candidats du mode `petit`.
  if (drapeau('resoudre')) {
    if (!candidatsPetit || !src.recipe || !src.loaded) {
      dire('\n[résolution] sans objet : il faut le mode `petit` et une recette.');
    } else {
      const realDamage = buildRealDamageContext(src.recipe, src.loaded.com2usId, params.artifacts);
      const classer = (candidates: BuildCandidate[]) =>
        classerCommeLEcran({ recipe: src.recipe!, loaded: src.loaded!, params, candidates, realDamage, toutResoudre: true });
      const debut = performance.now();
      const a = classer(candidatsPetit.ref);
      const msA = performance.now() - debut;
      const b = classer(candidatsPetit.proto);
      const cle = (c: ReturnType<typeof classer>) => c.classes.map((x) => JSON.stringify({ runeIds: x.runeIds, stats: x.stats, effTotal: x.effTotal }));
      const egal = JSON.stringify(cle(a)) === JSON.stringify(cle(b)) && (a.resolu?.rejetes ?? -1) === (b.resolu?.rejetes ?? -1);
      if (!egal) toutEgal = false;
      dire(
        `\n[résolution --resoudre-tout] ${a.resolu ? `${a.resolu.parBuild.size} builds résolus, ${a.resolu.rejetes} rejetés, ${a.classes.length} classés` : 'aucune file (optimisation d’artéfacts coupée)'} · ` +
          `classement résolu ${egal ? 'ÉGAL' : 'DIFFÈRE'} entre référence et prototype · ${(msA / 1000).toFixed(1)} s par passe [indicatif]`
      );
      json.resolution = { egal, resolus: a.resolu?.parBuild.size ?? 0, rejetes: a.resolu?.rejetes ?? 0, classes: a.classes.length, empreinte: empreinte(cle(a)), ms: Math.round(msA) };
    }
  }
  dire(`\nVerdict ${src.libelle} : ${toutEgal ? 'différentiel ÉGAL partout' : '⚠️ DIFFÉRENTIEL EN ÉCHEC'}`);
  json.egal = toutEgal;
  return toutEgal;
}

async function main(): Promise<void> {
  const lignes: string[] = [];
  let toutEgal = true;
  for (const src of sources()) {
    const json: Record<string, unknown> = { source: src.libelle, modes: MODES, petit: PETIT, workers: WORKERS, date: new Date().toISOString() };
    const egal = await banc(src, lignes, json);
    toutEgal &&= egal;
    if (sortie) {
      mkdirSync(sortie, { recursive: true });
      const nom = `banc-${src.slug}${valeur('suffixe') ? `-${valeur('suffixe')}` : ''}`;
      writeFileSync(join(sortie, `${nom}.json`), JSON.stringify(json, null, 2));
      writeFileSync(join(sortie, `${nom}.txt`), lignes.join('\n') + '\n');
      lignes.length = 0;
    }
  }
  process.exit(toutEgal ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(2);
});
