// Calibre `bucketCapFor` (src/lib/runeBuildOptim.ts) — mise à l'échelle de
// `bucketCap` avec `slotFilterCap` — contre DEUX cas réels Sonia mesurés
// cette session, sur le même compte. Historique complet du raisonnement
// dans le commentaire de `bucketCapFor` lui-même ; ce script sert à REJOUER
// la calibration si la constante doit être relevée à nouveau un jour (règle
// algo-verify : mesurer, jamais deviner).
//
// - Dégâts, piste B off : 3 demi-builds trouvés à Moyen (slotFilterCap=80).
// - Vitesse, piste B ON : 5 demi-builds trouvés à Bas (slotFilterCap=40) —
//   le cas le plus exigeant : Moyen n'en retient que 3/5 à `bucketCap=3000`
//   fixe, MÊME valeur qu'à Bas — la dilution touche donc déjà 40→80, pas
//   seulement au-delà de 80 comme le cas Dégâts l'avait d'abord laissé
//   croire. `perf-battery.ts` (ses 7 cas, TOUS à slotFilterCap=80) ne peut
//   PAS détecter ce genre de perte : il vérifie qu'un build CIBLE connu est
//   retrouvé, jamais le NOMBRE de builds valides retenus.
//
// Méthode : ne mesure QUE prepareSearch+buildBuckets (jamais pairBuckets) —
// bien moins cher que la recherche complète, et c'est exactement l'étage où
// la dilution se produit. Pour chaque preset ET chaque formule candidate,
// vérifie si les demi-builds connus (moitiés A et B) survivent la
// rétention. La bonne formule est la plus SIMPLE qui n'en perd aucun à
// AUCUN préréglage, sur AUCUN des deux cas — pas la plus généreuse par
// prudence, le coût mémoire/temps grandit avec bucketCap.
//
// Usage : bucket-cap-scaling-diag.ts <export.json>

import { readFileSync } from 'fs';
import { parseAccountSource, parseAccountBox, parseAccountInventory } from '../src/lib/importAccount';
import { runeEfficiency } from '../src/lib/effects';
import { BuildRequirement, SearchParams, prepareSearch, buildBuckets, SLOT_FILTER_PRESETS } from '../src/lib/runeBuildOptim';
import { ArtifactDetail } from '../src/types';

function drain<T>(gen: Generator<unknown, T, void>): T {
  let step = gen.next();
  while (!step.done) step = gen.next();
  return step.value;
}

const [exportPath] = process.argv.slice(2);
if (!exportPath) {
  console.error('Usage: bucket-cap-scaling-diag.ts <export.json>');
  process.exit(1);
}

const data = parseAccountSource(readFileSync(exportPath, 'utf8'))!;
const monstersRaw = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const monstersList = Array.isArray(monstersRaw) ? monstersRaw : monstersRaw.monsters;
const nameByCom2us = new Map<number, string>(monstersList.map((m: any) => [m.com2usId, m.name]));
const { monsters: box } = parseAccountBox(data);
const candidates = box.filter((b) => nameByCom2us.get(b.com2usId) === 'Sonia' && b.gear);
const scoreOf = (b: (typeof candidates)[number]) => (b.gear!.runes ?? []).reduce((s, r) => s + runeEfficiency(r), 0);
const sonia = candidates.reduce((best, b) => (scoreOf(b) > scoreOf(best) ? b : best));
const { runes: pool } = parseAccountInventory(data);

const artifacts: ArtifactDetail[] = [
  { kind: 'element', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs: [] },
  { kind: 'archetype', level: 1, rarity: 5, main: { code: 101, value: 100 }, subs: [] },
];
const baseAtk = sonia.gear!.base.atk;
const baseSpd = sonia.gear!.base.spd;
const requirement: BuildRequirement = {
  sets: ['swift'],
  minStats: { atk: 2000 + baseAtk, spd: 194 + baseSpd, cr: 100, cd: 122 },
  mainStats: { 2: [8], 4: [9], 6: [4] },
};

const REFERENCES: { label: string; objective: 'degats' | 'vitesse'; adaptiveTrancheWeighting: boolean; builds: number[][] }[] = [
  {
    label: 'Dégâts, piste B off',
    objective: 'degats',
    adaptiveTrancheWeighting: false,
    builds: [
      [50634967736, 36200884729, 50706822949, 35448425552, 20215349278, 52233557074],
      [61019921058, 36200884729, 24242342660, 56667443786, 15415339199, 49776626530],
      [61019921058, 36200884729, 50706822949, 35448425552, 15415339199, 49776626530],
    ],
  },
  {
    label: 'Vitesse, piste B ON (cas le plus exigeant)',
    objective: 'vitesse',
    adaptiveTrancheWeighting: true,
    builds: [
      [50634967736, 36200884729, 50706822949, 35448425552, 20215349278, 52233557074],
      [31515553228, 36200884729, 58172565462, 56667443786, 15415339199, 49776626530],
      [31515553228, 36200884729, 50706822949, 56667443786, 15415339199, 49776626530],
      [61019921058, 36200884729, 24242342660, 56667443786, 15415339199, 49776626530],
      [61019921058, 36200884729, 50706822949, 35448425552, 15415339199, 49776626530],
    ],
  },
];

const BASE_CAP = 40; // "Bas" — le seul préréglage où BUCKET_CAP=3000 reste validé par construction (rien de plus petit à comparer contre).
const BASE_BUCKET_CAP = 3000;

type Formula = { label: string; bucketCapFor: (slotFilterCap: number) => number };
const FORMULAS: Formula[] = [
  { label: 'fixe (ancien comportement)', bucketCapFor: () => BASE_BUCKET_CAP },
  { label: 'racine (×√(cap/40)) — insuffisante à Extrême', bucketCapFor: (cap) => Math.round(BASE_BUCKET_CAP * Math.sqrt(cap / BASE_CAP)) },
  { label: 'linéaire (×cap/40) — RETENUE', bucketCapFor: (cap) => Math.round(BASE_BUCKET_CAP * (cap / BASE_CAP)) },
];

function checkRetention(
  slotFilterCap: number,
  bucketCap: number,
  objective: 'degats' | 'vitesse',
  adaptiveTrancheWeighting: boolean,
  builds: number[][]
): { survivedA: number; survivedB: number; buildMs: number } {
  const params: SearchParams = {
    base: sonia.gear!.base, artifacts, relic: sonia.gear!.relic, pool, requirement, metric: 'eff',
    objective, maxMs: 10 * 60 * 1000, slotFilterCap, bucketCap, adaptiveTrancheWeighting,
  };
  const prepared = prepareSearch(params)!;
  const t0 = performance.now();
  const bucketsA = drain(
    buildBuckets('A', [0, 1, 2], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForA, prepared.jokerCredit, prepared.requiredPieces, undefined, adaptiveTrancheWeighting)
  );
  const bucketsB = drain(
    buildBuckets('B', [3, 4, 5], prepared.filtered, prepared.distinctKeys, prepared.constrainedKeys, prepared.retentionKeys, prepared.minEntries, prepared.bucketCap, prepared.maxSetsForB, prepared.jokerCredit, prepared.requiredPieces, undefined, adaptiveTrancheWeighting)
  );
  const buildMs = performance.now() - t0;

  const idsA = new Set<string>();
  for (const b of bucketsA) for (const c of b.combos) idsA.add(c.runes.map((r) => r.id).sort((a, b2) => a - b2).join(','));
  const idsB = new Set<string>();
  for (const b of bucketsB) for (const c of b.combos) idsB.add(c.runes.map((r) => r.id).sort((a, b2) => a - b2).join(','));

  let survivedA = 0;
  let survivedB = 0;
  for (const ids of builds) {
    if (idsA.has(ids.slice(0, 3).sort((a, b) => a - b).join(','))) survivedA++;
    if (idsB.has(ids.slice(3, 6).sort((a, b) => a - b).join(','))) survivedB++;
  }
  return { survivedA, survivedB, buildMs };
}

for (const ref of REFERENCES) {
  console.log(`\n=== ${ref.label} (${ref.builds.length} demi-builds connus) ===`);
  console.log('preset | cap | formule | bucketCap | moitiés A | moitiés B | construction');
  for (const preset of SLOT_FILTER_PRESETS) {
    for (const f of FORMULAS) {
      const bucketCap = f.bucketCapFor(preset.cap);
      const { survivedA, survivedB, buildMs } = checkRetention(preset.cap, bucketCap, ref.objective, ref.adaptiveTrancheWeighting, ref.builds);
      const total = ref.builds.length;
      const flag = survivedA < total || survivedB < total ? '  ⚠️ PERTE' : '';
      console.log(
        `${preset.key.padEnd(7)} | ${String(preset.cap).padEnd(3)} | ${f.label.padEnd(38)} | ${String(bucketCap).padEnd(9)} | ${survivedA}/${total} | ${survivedB}/${total} | ${buildMs.toFixed(0)}ms${flag}`
      );
    }
  }
}
