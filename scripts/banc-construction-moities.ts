// Banc de la construction des moitiés sur tableaux typés
// (src/lib/constructionRapide.ts) : sur des cas RÉELS, `prepareSearch` de
// production, puis `buildBuckets` (la référence) et les deux versions du noyau
// — séquentielle (`construireMoitieRapide`, le chemin de production), et
// découpée en tranches dans de vrais `worker_threads` + fusion (`construireTranche`,
// `fusionnerTranches`, non branchées en production) —,
// avec l'égalité PROFONDE des compartiments (`premiereDivergence`) et le temps
// par moitié.
//
// ⚠️ Les temps imprimés sont INDICATIFS : un seul passage, dans un processus
// qui enchaîne les trois constructions. Une mesure qui conclut se fait
// processus frais, répétitions entrelacées, sans contention (skill
// optimizer-perf-testing) — c'est le rôle du pilote, pas de ce banc.
//
// Fidélité : les `SearchParams` viennent du chemin du harnais (`resoudreCas`
// pour les cas de scripts/lib/perfShared.ts, `resoudreConfig` + `chargerRecette`
// pour une recette), donc des mêmes réglages que le harnais ; `buildBuckets` reçoit
// les arguments du Worker de moitié (`combosOrderMode` des `SearchParams`,
// aucun `skylineKeys`). Un override (`--ordre`, `--slotFilterCap`) est
// imprimé « DIVERGE DE LA PROD ».
//
// Usage :
//   npx tsx scripts/banc-construction-moities.ts --cas=tous     (--cas répétable : --cas=3 --cas=ciri)
//   npx tsx scripts/banc-construction-moities.ts --compte=<export.json> --recette=<recette.json> [--recette=…]
//   options : --fils=<n> (8)  --moities=A,B  --ordre=<potential|relevance|combined|objective>
//             --slotFilterCap=<n>  --json=<fichier>

import { Worker } from 'worker_threads';
import { mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { build } from 'esbuild';
import { Bucket, SearchParams, buildBuckets, prepareSearch } from '../src/lib/runeBuildOptim';
import {
  OrdreCombos,
  ResultatTranche,
  construireMoitieRapide,
  contexteDe,
  fusionnerTranches,
  premiereDivergence,
  repartirIdx0,
  tailleCompartiments,
} from '../src/lib/constructionRapide';
import { resoudreConfig } from './lib/diagnosticConfig';
import { resoudreCas, resoudreSelectionCas } from './lib/diagnosticLot';
import { CASES } from './lib/perfShared';
import { drain } from './lib/drain';
import type { MessageTranche } from './lib/construction-tranche-worker';

const args = process.argv.slice(2);
const valeurs = (nom: string) => args.filter((a) => a.startsWith(`--${nom}=`)).map((a) => a.slice(nom.length + 3));
const valeur = (nom: string) => valeurs(nom)[0];

const FILS = Number(valeur('fils') ?? 8);
const MOITIES = (valeur('moities') ?? 'A,B').split(',') as ('A' | 'B')[];
const ORDRE = valeur('ordre') as OrdreCombos | undefined;
const CAP = valeur('slotFilterCap') != null ? Number(valeur('slotFilterCap')) : undefined;

interface CasBanc {
  libelle: string;
  params: SearchParams;
}

function lesCas(): CasBanc[] {
  const out: CasBanc[] = [];
  for (const sel of valeurs('cas')) {
    for (const i of resoudreSelectionCas(sel)) out.push({ libelle: `cas ${i} — ${CASES[i].label}`, params: resoudreCas(i, {}).resolue.params });
  }
  const compte = valeur('compte');
  for (const recette of valeurs('recette')) {
    if (!compte) throw new Error('--recette demande --compte');
    const r = resoudreConfig({ source: { type: 'recette', cheminCompte: compte, cheminRecette: recette, mode: { type: 'box' } } });
    out.push({ libelle: `recette ${r.recette?.monsterName} (${recette})`, params: r.params });
  }
  if (out.length === 0) throw new Error('Rien à faire : --cas=<sel> et/ou --compte=… --recette=…');
  return out;
}

async function bundle(): Promise<string> {
  const dossier = join(tmpdir(), `swblacksmith-construction-tranche-${Date.now()}-${process.pid}`);
  mkdirSync(dossier, { recursive: true });
  const chemin = join(dossier, 'construction-tranche-worker.cjs');
  await build({ entryPoints: ['scripts/lib/construction-tranche-worker.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: chemin, logLevel: 'error' });
  return chemin;
}

function lancer(chemin: string, data: unknown): Promise<MessageTranche> {
  return new Promise((resolve, reject) => {
    const w = new Worker(chemin, { workerData: data });
    w.once('message', (m: MessageTranche) => {
      void w.terminate();
      resolve(m);
    });
    w.once('error', reject);
  });
}

interface LigneBanc {
  cas: string;
  moitie: 'A' | 'B';
  pools: number[];
  compartiments: number;
  combos: number;
  egalSequentiel: boolean;
  divergenceSequentiel: string | null;
  egalTranches: boolean;
  divergenceTranches: string | null;
  fils: number;
  codesEmis: number;
  /** Indicatifs. */
  msProduction: number;
  msSequentiel: number;
  msTranchesMur: number;
  msFilsMax: number;
  msFusion: number;
}

async function main(): Promise<void> {
  const chemin = await bundle();
  const lignes: LigneBanc[] = [];
  for (const c of lesCas()) {
    const params: SearchParams = { ...c.params };
    const overrides: string[] = [];
    if (ORDRE) { params.combosOrderMode = ORDRE; overrides.push(`combosOrderMode=${ORDRE}`); }
    if (CAP != null) { params.slotFilterCap = CAP; delete params.bucketCap; overrides.push(`slotFilterCap=${CAP} (bucketCap dérivé)`); }
    const prepared = prepareSearch(params);
    console.log(`\n━━ ${c.libelle}`);
    if (!prepared) {
      console.log('   préparation vide : aucun compartiment à comparer');
      continue;
    }
    const ordre: OrdreCombos = params.combosOrderMode ?? 'objective';
    console.log(
      `   pools ${prepared.filtered.map((l) => l.length).join(' ')} · slotFilterCap ${params.slotFilterCap} · bucketCap ${prepared.bucketCap} · ` +
        `combosOrderMode ${ordre} · retentionKeys [${prepared.retentionKeys.join(',')}] · objectiveKeys [${prepared.objectiveKeys.join(',')}]` +
        (overrides.length ? ` · ⚠️ DIVERGE DE LA PROD : ${overrides.join(', ')}` : ' · réglages de production')
    );
    const ctx = contexteDe(prepared);
    for (const half of MOITIES) {
      const slots = half === 'A' ? ([0, 1, 2] as const) : ([3, 4, 5] as const);
      const autre = half === 'A' ? prepared.maxSetsForA : prepared.maxSetsForB;

      let t = performance.now();
      const ref: Bucket[] = drain(buildBuckets(half, slots, prepared, autre, undefined, params.combosOrderMode));
      const msProduction = performance.now() - t;

      // Dans une fonction : la sortie séquentielle n'est plus référencée quand les fils démarrent.
      const { msSequentiel, divergenceSequentiel } = (() => {
        const t0 = performance.now();
        const seq = drain(construireMoitieRapide(half, slots, prepared, autre, ordre));
        return { msSequentiel: performance.now() - t0, divergenceSequentiel: premiereDivergence(ref, seq) };
      })();

      t = performance.now();
      const partition = repartirIdx0(prepared.filtered[slots[0]].length, FILS);
      const messages = await Promise.all(partition.map((idx0s) => lancer(chemin, { ctx, slotIdxs: slots, otherHalfMaxSets: autre, idx0s })));
      const tf = performance.now();
      const tranches: ResultatTranche[] = messages.map((m) => m.resultat);
      const par = fusionnerTranches(ctx, slots, autre, ordre, tranches);
      const fin = performance.now();
      const divergenceTranches = premiereDivergence(ref, par);

      const taille = tailleCompartiments(ref);
      const ligne: LigneBanc = {
        cas: c.libelle, moitie: half, pools: slots.map((i) => prepared.filtered[i].length),
        compartiments: taille.compartiments, combos: taille.combos,
        egalSequentiel: divergenceSequentiel === null, divergenceSequentiel,
        egalTranches: divergenceTranches === null, divergenceTranches,
        fils: partition.length, codesEmis: tranches.reduce((s, x) => s + x.codes.length, 0),
        msProduction, msSequentiel, msTranchesMur: fin - t, msFilsMax: Math.max(...messages.map((m) => m.ms)), msFusion: fin - tf,
      };
      lignes.push(ligne);
      console.log(
        `   moitié ${half} : ${taille.compartiments} compartiments, ${taille.combos} combos · ` +
          `séquentiel ${divergenceSequentiel === null ? 'IDENTIQUE' : `DIVERGE — ${divergenceSequentiel}`} · ` +
          `${partition.length} fils ${divergenceTranches === null ? 'IDENTIQUE' : `DIVERGE — ${divergenceTranches}`} (${ligne.codesEmis} triplets émis)`
      );
      console.log(
        `     temps INDICATIFS (1 passage, même processus) : production ${msProduction.toFixed(0)} ms · séquentiel ${msSequentiel.toFixed(0)} ms · ` +
          `${partition.length} fils ${ligne.msTranchesMur.toFixed(0)} ms au mur (fil le plus long ${ligne.msFilsMax.toFixed(0)} ms, fusion ${ligne.msFusion.toFixed(0)} ms)`
      );
    }
  }
  const divergences = lignes.filter((l) => !l.egalSequentiel || !l.egalTranches).length;
  console.log(`\n${lignes.length} moitié(s) comparée(s) : ${divergences === 0 ? 'égalité profonde PARTOUT' : `${divergences} DIVERGENCE(S)`}`);
  const json = valeur('json');
  if (json) writeFileSync(json, JSON.stringify(lignes, null, 2), 'utf8');
  if (divergences > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
