// Compare plusieurs stratégies de recherche pour retrouver le runage RÉEL
// d'un monstre déjà runé sur un vrai compte (deck d'offense de siège), avec
// ses stats réelles comme critères — répond à « quel algorithme est le bon
// choix ? » avec des mesures, pas une intuition. Voir
// .claude/skills/algo-verify/SKILL.md. Générique : monstre/deck viennent des
// arguments, la contrainte de statistique principale (slots 2/4/6) est
// dérivée automatiquement du runage réel du monstre choisi.
//
// Usage : monster-search-benchmark.ts <export.json> <deckId> <nomMonstre>

import { computeStats } from '../src/lib/stats';
import { activeSets, runeEfficiency } from '../src/lib/effects';
import { missingSets } from '../src/lib/recoMatch';
import { searchBuilds, BuildRequirement, SearchParams } from '../src/lib/runeBuildOptim';
import { ArtifactDetail, BaseStats, GearSet, RelicDetail, RuneDetail } from '../src/types';
import { loadDeckMonster, parseDeckMonsterArgs } from './lib/deckMonster';

const USAGE = 'Usage: monster-search-benchmark.ts <export.json> <deckId> <nomMonstre>';
const args = parseDeckMonsterArgs(process.argv.slice(2), USAGE);
const { gear, allRunes } = loadDeckMonster(args);

const targetRuneIds = new Set(gear.runes.map((r) => r.id));
const targetSets = activeSets(gear.runes.map((r) => r.set));
console.log(`${args.monsterName} — sets actifs réels : ${targetSets.join(' + ')}`);
console.log(`${args.monsterName} — ids de runes réels : [${[...targetRuneIds].sort((a, b) => a - b).join(', ')}]`);

console.log(`\nInventaire complet : ${allRunes.length} runes.`);
for (let s = 1; s <= 6; s++) console.log(`  slot ${s} : ${allRunes.filter((r) => r.slot === s).length} runes`);
const manquantes = [...targetRuneIds].filter((id) => !allRunes.some((r) => r.id === id));
console.log(`Runes du build cible absentes de l'inventaire : ${manquantes.length === 0 ? 'aucune ✓' : manquantes}`);

// Contrainte de statistique principale (slots 2/4/6) dérivée du VRAI runage,
// pas devinée : c'est exactement ce qu'un joueur qui reconstruit ce monstre
// coderait dans l'écran Optimizer.
const mainStats: NonNullable<BuildRequirement['mainStats']> = {};
for (const r of gear.runes) if (r.slot === 2 || r.slot === 4 || r.slot === 6) mainStats[r.slot] = [r.main.code];

const base: BaseStats = gear.base;
const artifacts: ArtifactDetail[] = gear.artifacts;
const relic: RelicDetail | undefined = gear.relic;
const targetStats = computeStats(gear);
const minStats: BuildRequirement['minStats'] = {};
for (const row of targetStats) minStats[row.key] = row.total;
const requirement: BuildRequirement = { sets: targetSets, minStats, mainStats };

console.log('\nCritères de recherche (= stats réelles du build cible, en TOTAL) :');
console.log(minStats);
console.log('Statistique principale imposée (dérivée du runage réel) :', mainStats);

/* ===========================================================================
 * Algorithme A — Meet-in-the-middle (moteur de production actuel)
 * ======================================================================= */
function runMITM() {
  const t0 = performance.now();
  const params: SearchParams = { base, artifacts, relic, pool: allRunes, requirement, metric: 'eff', maxMs: 120_000, maxNodes: 5_000_000, maxCollected: 5000 };
  const res = searchBuilds(params);
  const ms = performance.now() - t0;
  const foundExact = res.candidates.some((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
  return { label: 'Meet-in-the-middle (production)', ms, explored: res.explored, found: res.candidates.length, foundExact, truncated: res.truncated };
}

// Variante de contrôle : MÊME moteur de production, mais nourri d'un pool
// déjà réduit où les 6 vraies runes du build cible sont GARANTIES présentes
// (même construction que la brute-force restreinte). Isole la question :
// la STRATÉGIE de recherche de MITM est-elle correcte quand le pré-filtrage
// ne lui a pas déjà retiré la réponse des mains ?
function runMITMPoolGaranti(capParSlot = 12) {
  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of allRunes) if (r.slot >= 1 && r.slot <= 6) bySlot[r.slot - 1].push(r);
  const restrained = bySlot.flatMap((list, i) => {
    const slotNo = i + 1;
    const targetId = [...gear.runes].find((r) => r.slot === slotNo)?.id;
    const top = filterSlotSimple(list, requirement, capParSlot);
    if (targetId != null && !top.some((r) => r.id === targetId)) {
      top[top.length - 1] = list.find((r) => r.id === targetId)!;
    }
    return top;
  });
  const t0 = performance.now();
  const params: SearchParams = { base, artifacts, relic, pool: restrained, requirement, metric: 'eff', maxMs: 120_000 };
  const res = searchBuilds(params);
  const ms = performance.now() - t0;
  const foundExact = res.candidates.some((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
  return { label: 'Meet-in-the-middle (pool réduit, runes cibles garanties présentes)', ms, explored: res.explored, found: res.candidates.length, foundExact, truncated: res.truncated };
}

/* ===========================================================================
 * Algorithme B — Backtracking séquentiel SANS meet-in-the-middle : un slot
 * après l'autre, seule une borne de faisabilité sur les stats élague ; le
 * combo de sets n'est vérifié qu'au bout des 6 choix (comme la toute première
 * version du moteur, avant sa réécriture). Même pré-filtrage par slot que
 * MITM pour comparer la STRATÉGIE de recherche, pas la taille du pool.
 * ======================================================================= */
function filterSlotSimple(candidates: RuneDetail[], req: BuildRequirement, cap = 128): RuneDetail[] {
  const required = new Set(req.sets);
  const scored = candidates.map((r) => {
    let score = r.set === 'intangible' || required.has(r.set) ? 1000 : 0;
    score += runeEfficiency(r) / 100;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((s) => s.r);
}

function runSequentialBnB(maxNodes = 5_000_000, maxMs = 120_000) {
  const t0 = performance.now();
  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of allRunes) if (r.slot >= 1 && r.slot <= 6) bySlot[r.slot - 1].push(r);
  const filtered = bySlot.map((l) => filterSlotSimple(l, requirement));

  const statKeys = Object.keys(minStats) as (keyof typeof minStats)[];
  let explored = 0;
  let truncated = false;
  const found: { runeIds: number[] }[] = [];
  const chosen: RuneDetail[] = [];

  function leaf(): void {
    const active = activeSets(chosen.map((r) => r.set));
    if (missingSets(requirement.sets, active).length > 0) return;
    const g: GearSet = { base, runes: chosen.slice(), artifacts, relic };
    const stats = computeStats(g);
    for (const k of statKeys) {
      const min = minStats[k]!;
      const row = stats.find((s) => s.key === k);
      if (!row || row.total < min) return;
    }
    found.push({ runeIds: chosen.map((r) => r.id) });
  }

  function backtrack(slot: number): boolean {
    if (slot === 6) {
      leaf();
      return true;
    }
    for (const rune of filtered[slot]) {
      explored++;
      if (explored > maxNodes || performance.now() - t0 > maxMs) {
        truncated = true;
        return false;
      }
      chosen.push(rune);
      if (!backtrack(slot + 1)) {
        chosen.pop();
        return false;
      }
      chosen.pop();
      if (found.length >= 5000) {
        truncated = true;
        return false;
      }
    }
    return true;
  }

  backtrack(0);
  const ms = performance.now() - t0;
  const foundExact = found.some((c) => c.runeIds.length === 6 && c.runeIds.every((id) => targetRuneIds.has(id)));
  return { label: 'Backtracking séquentiel (sets vérifiés au dernier slot)', ms, explored, found: found.length, foundExact, truncated };
}

/* ===========================================================================
 * Algorithme C — Brute-force VRAIE, mais sur un pool volontairement restreint
 * (les candidats déjà pré-filtrés), pour ancrer la comparaison sur une
 * référence exhaustive à petite échelle — la pleine échelle (souvent
 * plusieurs centaines de runes/slot) est mathématiquement hors de portée,
 * chiffrée ci-dessous plutôt que lancée pour de vrai.
 * ======================================================================= */
function runBruteForceRestreinte(capParSlot = 12) {
  const t0 = performance.now();
  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of allRunes) if (r.slot >= 1 && r.slot <= 6) bySlot[r.slot - 1].push(r);
  // Le pré-filtrage inclut TOUJOURS les runes réelles du build cible (sans
  // ça, la comparaison serait truquée : on saurait déjà que la réponse est
  // absente).
  const restrained = bySlot.map((list, i) => {
    const slotNo = i + 1;
    const targetId = [...gear.runes].find((r) => r.slot === slotNo)?.id;
    const top = filterSlotSimple(list, requirement, capParSlot);
    if (targetId != null && !top.some((r) => r.id === targetId)) {
      const forced = list.find((r) => r.id === targetId)!;
      top[top.length - 1] = forced;
    }
    return top;
  });
  let explored = 0;
  const found: { runeIds: number[] }[] = [];
  for (const r0 of restrained[0])
    for (const r1 of restrained[1])
      for (const r2 of restrained[2])
        for (const r3 of restrained[3])
          for (const r4 of restrained[4])
            for (const r5 of restrained[5]) {
              explored++;
              const runes = [r0, r1, r2, r3, r4, r5];
              const active = activeSets(runes.map((r) => r.set));
              if (missingSets(requirement.sets, active).length > 0) continue;
              const g: GearSet = { base, runes, artifacts, relic };
              const stats = computeStats(g);
              let ok = true;
              for (const k of Object.keys(minStats) as (keyof typeof minStats)[]) {
                const min = minStats[k]!;
                const row = stats.find((s) => s.key === k);
                if (!row || row.total < min) {
                  ok = false;
                  break;
                }
              }
              if (ok) found.push({ runeIds: runes.map((r) => r.id) });
            }
  const ms = performance.now() - t0;
  const foundExact = found.some((c) => c.runeIds.every((id) => targetRuneIds.has(id)));
  return {
    label: `Brute-force restreinte (top ${capParSlot}/slot, ${capParSlot}^6=${(capParSlot ** 6).toLocaleString('fr-FR')} combos)`,
    ms,
    explored,
    found: found.length,
    foundExact,
    truncated: false,
  };
}

// --- Exécution --------------------------------------------------------------
console.log('\n=== Résultats ===\n');
const rows = [runBruteForceRestreinte(12), runMITMPoolGaranti(12), runSequentialBnB(), runMITM()];
for (const r of rows) {
  console.log(
    `${r.label}\n  temps=${r.ms.toFixed(1)}ms  explorés=${r.explored.toLocaleString('fr-FR')}  trouvés=${r.found}  ` +
      `runage EXACT retrouvé=${r.foundExact ? 'OUI' : 'non'}  tronqué=${r.truncated ? 'oui' : 'non'}\n`
  );
}

// Pool complet : estimation de coût d'une vraie brute-force, pour mémoire.
const perSlotCounts = [1, 2, 3, 4, 5, 6].map((s) => allRunes.filter((r) => r.slot === s).length);
const total = perSlotCounts.reduce((a, b) => a * b, 1);
console.log(
  `Brute-force sur le pool COMPLET (${perSlotCounts.join(' × ')} = ${total.toExponential(3)} combinaisons) : ` +
    `hors de portée — pour mémoire seulement.`
);
