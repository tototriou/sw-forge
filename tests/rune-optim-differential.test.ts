// Test différentiel du moteur de recherche de builds (Outils · Optimizer) :
// compare le moteur meet-in-the-middle à une référence NAIVE et EXHAUSTIVE,
// sur des jeux de données aléatoires mais DÉTERMINISTES (seed fixe).
//
// Discipline imposée par .claude/skills/algo-verify/SKILL.md : une
// divergence ici serait une combinaison annoncée valide mais fausse, ou une
// combinaison valide jamais trouvée — le genre d'erreur « grave et
// invisible » que ce dépôt teste systématiquement (voir tests/README.md).
// Complète tests/rune-optim.test.ts (cas écrits à la main) sans les
// remplacer : l'un couvre des scénarios précis et lisibles, l'autre balaie
// large sans biais de l'auteur du test.
//
// ⚠️ La référence réutilise `computeStats`/`activeSets`/`missingSets` — déjà
// couverts ailleurs (reco.test.ts, vitesse.test.ts). Ce qui est neuf et donc
// à risque ici, c'est le découpage en deux moitiés et le groupage par compte
// de pièces : la référence, elle, énumère VRAIMENT les 6 slots sans
// pré-filtrage ni regroupement, pour ne rien devoir à l'algorithme testé.

import { BaseStats, EffectLine, RuneDetail } from '../src/types';
import { activeSets, runeEfficiency } from '../src/lib/effects';
import { computeStats } from '../src/lib/stats';
import { missingSets } from '../src/lib/recoMatch';
import {
  BuildRequirement,
  buildBuckets,
  prepareSearch,
  searchBuilds,
  totalPairCount,
  estimatePairBound,
  MAX_PER_SLOT_MATCH,
} from '../src/lib/runeBuildOptim';
import { egal, ok, titre } from './outils';

// PRNG déterministe (mulberry32) — pas de dépendance, seed fixe pour des
// scénarios reproductibles d'une exécution à l'autre.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deux sets 4 pièces, deux sets 2 pièces, et Intangible (joker) — assez varié
// pour exercer le groupage par compte, y compris la concurrence de jokers
// avec un set HORS combo demandé (ex. Shield isolé).
const SET_KEYS = ['violent', 'swift', 'will', 'shield', 'fight', 'intangible'];
const STAT_CODES = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

function randomRune(id: number, slot: number, rng: () => number): RuneDetail {
  const set = SET_KEYS[Math.floor(rng() * SET_KEYS.length)];
  const mainCode = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
  const used = new Set([mainCode]);
  const subs: EffectLine[] = [];
  for (let i = 0; i < 4; i++) {
    let code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
    let tries = 0;
    while (used.has(code) && tries < 10) {
      code = STAT_CODES[Math.floor(rng() * STAT_CODES.length)];
      tries++;
    }
    used.add(code);
    subs.push({ code, value: 5 + Math.floor(rng() * 40) });
  }
  return {
    id,
    slot,
    set,
    rank: 6,
    rarity: 5,
    level: 15,
    main: { code: mainCode, value: 10 + Math.floor(rng() * 100) },
    subs,
  };
}

function randomPool(rng: () => number, perSlot: number): RuneDetail[] {
  const out: RuneDetail[] = [];
  let id = 1;
  for (let slot = 1; slot <= 6; slot++) {
    for (let i = 0; i < perSlot; i++) out.push(randomRune(id++, slot, rng));
  }
  return out;
}

// Référence NAIVE : énumère VRAIMENT tout le produit 6 slots × N runes/slot,
// sans pré-filtrage ni élagage. Valable uniquement à petite échelle — c'est
// tout son intérêt : elle sert de vérité de référence, pas de moteur de
// production (voir .claude/skills/algo-verify/SKILL.md).
function bruteForce(
  pool: RuneDetail[],
  base: BaseStats,
  requirement: BuildRequirement
): { count: number; best: number } {
  const bySlot: RuneDetail[][] = [[], [], [], [], [], []];
  for (const r of pool) bySlot[r.slot - 1].push(r);

  let count = 0;
  let best = -Infinity;
  for (const r0 of bySlot[0])
    for (const r1 of bySlot[1])
      for (const r2 of bySlot[2])
        for (const r3 of bySlot[3])
          for (const r4 of bySlot[4])
            for (const r5 of bySlot[5]) {
              const runes = [r0, r1, r2, r3, r4, r5];
              // ⚠️ Une seule rune Intangible par monstre (règle du jeu) —
              // sans ce garde-fou, la référence compterait comme valides des
              // combinaisons que le moteur testé rejette désormais à raison
              // (voir searchBuildsSteps dans runeBuildOptim.ts), créant un
              // faux écart différentiel plutôt qu'une vraie divergence.
              if (runes.filter((r) => r.set === 'intangible').length > 1) continue;
              const active = activeSets(runes.map((r) => r.set));
              if (missingSets(requirement.sets, active).length > 0) continue;
              const stats = computeStats({ base, runes, artifacts: [] });
              let valide = true;
              for (const [key, min] of Object.entries(requirement.minStats)) {
                if (min == null) continue;
                const row = stats.find((s) => s.key === key);
                if (!row || row.total < min) {
                  valide = false;
                  break;
                }
              }
              if (!valide) continue;
              count++;
              const eff = runes.reduce((s, r) => s + runeEfficiency(r), 0);
              if (eff > best) best = eff;
            }
  return { count, best };
}

const BASE: BaseStats = { hp: 8000, atk: 500, def: 400, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

export default function testRuneOptimDifferential() {
  titre('Optimizer · test différentiel (meet-in-the-middle vs brute-force)');

  const SCENARIOS = 15;
  for (let s = 0; s < SCENARIOS; s++) {
    const rng = mulberry32(1000 + s);
    // 3 runes/slot → 3^6 = 729 combinaisons en brute-force : rapide, et
    // largement sous les plafonds de pré-filtrage (40+40+48) — le moteur
    // testé voit donc ici la totalité du pool, sans perte due au
    // pré-filtrage heuristique (une limite séparée, déjà documentée). Assez
    // petit pour que la plupart des scénarios restent sous le plafond de 500
    // candidats collectés, et permettent une vérification d'optimalité EXACTE
    // (voir le garde-fou `!res.truncated` plus bas).
    const pool = randomPool(rng, 3);

    const wantSets = rng() < 0.7;
    const sets = wantSets
      ? [SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))], SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))]]
      : [];
    const minStats: BuildRequirement['minStats'] = {};
    if (rng() < 0.5) minStats.spd = 100 + Math.floor(rng() * 60);
    if (rng() < 0.3) minStats.hp = 8000 + Math.floor(rng() * 2000);
    if (rng() < 0.2) minStats.cr = 15 + Math.floor(rng() * 40);

    const requirement: BuildRequirement = { sets, minStats };
    const ref = bruteForce(pool, BASE, requirement);
    const res = searchBuilds({ base: BASE, artifacts: [], pool, requirement, metric: 'eff' });

    egal(
      res.candidates.length > 0,
      ref.count > 0,
      `scénario ${s} (sets=${JSON.stringify(sets)}, minStats=${JSON.stringify(minStats)}) : ` +
        `faisabilité identique (référence ${ref.count} combo(s), moteur ${res.candidates.length})`
    );

    // ⚠️ L'optimum EXACT n'est comparable que si le moteur n'a pas été
    // tronqué (`truncated`) : au-delà de son plafond de collecte, il renvoie
    // « le meilleur trouvé », pas une garantie d'optimalité globale — c'est
    // documenté (spec/outils/optimizer/), pas un bug. Le comparer quand
    // même ferait échouer le test sur un comportement voulu.
    if (res.candidates.length > 0 && ref.count > 0 && !res.truncated) {
      const bestFound = Math.max(...res.candidates.map((c) => c.effTotal));
      ok(
        Math.abs(bestFound - ref.best) < 1e-6,
        `scénario ${s} : meilleure valeur trouvée par le moteur (${bestFound.toFixed(2)}) = référence (${ref.best.toFixed(2)})`
      );
    }

    // Aucun faux positif : chaque candidat renvoyé est recalculé et revérifié
    // indépendamment, sans rien supposer de l'état interne du moteur.
    if (res.candidates.length > 0) {
      const byId = new Map(pool.map((r) => [r.id, r]));
      let toutesValides = true;
      for (const c of res.candidates) {
        const runes = c.runeIds.map((id) => byId.get(id)!);
        const active = activeSets(runes.map((r) => r.set));
        if (missingSets(requirement.sets, active).length > 0) {
          toutesValides = false;
          break;
        }
        const stats = computeStats({ base: BASE, runes, artifacts: [] });
        for (const [key, min] of Object.entries(requirement.minStats)) {
          if (min == null) continue;
          const row = stats.find((r) => r.key === key);
          if (!row || row.total < min) {
            toutesValides = false;
            break;
          }
        }
        if (!toutesValides) break;
      }
      ok(toutesValides, `scénario ${s} : tous les candidats renvoyés sont réellement valides (aucun faux positif)`);
    }

    // ⚠️ `totalPairCount` (affiché à l'écran comme « espace de recherche à
    // épuiser ») doit rester une borne SÛRE : jamais en dessous du nombre de
    // paires RÉELLEMENT visitées par une recherche exhaustive (`!truncated`)
    // sur ce même scénario, sous peine d'annoncer moins de travail qu'il n'y
    // en a en réalité — voir spec/outils/optimizer/, « Suite — espace de
    // recherche affiné (pairFeasibleMin) ». Balayé sur les 15 scénarios
    // aléatoires (sets et minStats variés, contrairement au pool synthétique
    // à un seul compartiment de tests/rune-optim.test.ts) plutôt que sur un
    // seul cas choisi à la main.
    if (!res.truncated) {
      const prepared = prepareSearch({ base: BASE, artifacts: [], pool, requirement, metric: 'eff' });
      if (prepared) {
        function drain<T>(gen: Generator<unknown, T, void>): T {
          let step = gen.next();
          while (!step.done) step = gen.next();
          return step.value;
        }
        const bucketsA = drain(
          buildBuckets('A', [0, 1, 2], prepared, prepared.maxSetsForA)
        );
        const bucketsB = drain(
          buildBuckets('B', [3, 4, 5], prepared, prepared.maxSetsForB)
        );
        const total = totalPairCount(prepared, bucketsA, bucketsB);
        ok(total >= res.explored, `scénario ${s} : totalPairCount (${total}) reste une borne sûre — jamais en dessous des paires réellement explorées par une recherche exhaustive (${res.explored})`);

        // ⚠️ `estimatePairBound` (affiché à l'écran AVANT `buildBuckets`, donc
        // sans connaître les vrais compartiments) doit rester un MAJORANT de
        // `totalPairCount` lui-même (calculé, lui, APRÈS construction) —
        // sinon il annoncerait un « au pire » plus petit que la réalité déjà
        // mesurée. Ne peut PAS être vérifié sur un pool trop petit pour
        // `bucketCap` (le cas normal ici, `bucketCap=600` largement au-dessus
        // du nombre de runes du test) : l'invariant qui compte est structurel
        // (majorant théorique), pas une comparaison de magnitude sur ce pool
        // synthétique minuscule.
        const bound = estimatePairBound(requirement, MAX_PER_SLOT_MATCH);
        ok(
          bound >= total,
          `scénario ${s} : estimatePairBound (${bound}) reste un majorant de totalPairCount (${total})`
        );
      }
    }
  }

  // ⚠️ **Runes IMPOSÉES (`requirement.lockedRunes`), balayage aléatoire** —
  // revue de code externe : ce chantier a ajouté `lockedRunes` (verrou de
  // rune, `mainStatFilteredBySlot`) et `objectiveStats` (pool de
  // pré-filtrage IMPOSÉ) à `runeBuildOptim.ts` (~270 lignes de diff sur
  // toute la branche) sans qu'aucun différentiel dédié ne les exerce sur
  // des données ALÉATOIRES — seulement des cas écrits à la main
  // (`tests/rune-optim.test.ts`). Un verrou est SÛR PAR CONSTRUCTION selon
  // sa propre documentation (réduit le pool tout en amont, avant
  // dominance/faisabilité/pré-filtrage — rien en aval ne connaît la notion
  // de verrou), mais « sûr par construction d'après la doc » n'est pas
  // « vérifié » : ce balayage referme ce trou en appliquant EXACTEMENT le
  // même filtre par avance sur la référence brute-force (`applyLockToPool`,
  // ci-dessous) plutôt que de faire confiance à l'argument. ──
  function applyLockToPool(p: RuneDetail[], lockedRunes: Record<number, number>): RuneDetail[] {
    return p.filter((r) => {
      const locked = lockedRunes[r.slot];
      return locked == null || r.id === locked;
    });
  }

  const LOCK_SCENARIOS = 10;
  for (let s = 0; s < LOCK_SCENARIOS; s++) {
    const rng = mulberry32(5000 + s);
    const pool = randomPool(rng, 3);

    const wantSets = rng() < 0.7;
    const sets = wantSets
      ? [SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))], SET_KEYS[Math.floor(rng() * (SET_KEYS.length - 1))]]
      : [];
    const minStats: BuildRequirement['minStats'] = {};
    if (rng() < 0.5) minStats.spd = 100 + Math.floor(rng() * 60);

    // Verrouille une rune RÉELLEMENT présente dans le pool, sur son propre
    // emplacement — même geste que l'écran (le choix se limite aux runes
    // déjà portées par l'exemplaire, jamais une rune arbitraire).
    const lockTarget = pool[Math.floor(rng() * pool.length)];
    const lockedRunes = { [lockTarget.slot]: lockTarget.id };
    const requirement: BuildRequirement = { sets, minStats, lockedRunes };

    const poolFiltre = applyLockToPool(pool, lockedRunes);
    const ref = bruteForce(poolFiltre, BASE, requirement);
    const res = searchBuilds({ base: BASE, artifacts: [], pool, requirement, metric: 'eff' });

    egal(
      res.candidates.length > 0,
      ref.count > 0,
      `verrou ${s} (slot ${lockTarget.slot}→rune ${lockTarget.id}) : faisabilité identique (référence ${ref.count}, moteur ${res.candidates.length})`
    );

    if (res.candidates.length > 0 && ref.count > 0 && !res.truncated) {
      const bestFound = Math.max(...res.candidates.map((c) => c.effTotal));
      ok(
        Math.abs(bestFound - ref.best) < 1e-6,
        `verrou ${s} : meilleure valeur trouvée par le moteur (${bestFound.toFixed(2)}) = référence (${ref.best.toFixed(2)})`
      );
    }

    // Chaque candidat renvoyé doit RÉELLEMENT porter la rune imposée sur le
    // bon emplacement — pas seulement « un build valide quelconque ».
    if (res.candidates.length > 0) {
      const byId = new Map(pool.map((r) => [r.id, r]));
      const tousVerrouilles = res.candidates.every((c) => {
        const runeSurCeSlot = c.runeIds.map((id) => byId.get(id)!).find((r) => r.slot === lockTarget.slot);
        return runeSurCeSlot?.id === lockTarget.id;
      });
      ok(tousVerrouilles, `verrou ${s} : chaque candidat porte bien la rune imposée sur l'emplacement ${lockTarget.slot}`);
    }
  }

  // ⚠️ Scénario DÉDIÉ (pas aléatoire) — vérifie le correctif du cas limite
  // documenté dans spec/outils/optimizer/, « Suite — bonus de set NON
  // demandé anticipé dès le pré-filtrage » : `guaranteedSetBonus` ne compte
  // QUE les sets de `requirement.sets` — un set qui s'activerait par ACCIDENT
  // via les emplacements « libres » (non requis par le combo demandé) était
  // invisible de TOUS les élagages (`eliminateInfeasible`, `comboAOk`,
  // `pairFeasible*`, `quickOk`), pas seulement du repli le plus récent —
  // corrigé par `additionalSetActivationHeadroom`/`guaranteedMin` (renommée
  // depuis, voir « Suite — activation supplémentaire d'un set DÉJÀ demandé »
  // plus bas dans la spec). Pool à un seul
  // candidat par emplacement (aucune ambiguïté : une seule combinaison
  // possible) — Will (2 pièces, SANS bonus de stat, voir SET_STAT_BONUS) est
  // le set DEMANDÉ ; Blade (2 pièces, +12 Taux Crit PLAT) occupe deux
  // emplacements « libres » SANS être demandé. Aucune rune ne porte de
  // sub/mainstat Taux Crit (code 9) — le SEUL moyen d'atteindre
  // `minStats.cr` est donc le bonus Blade accidentel.
  {
    const will = (id: number, slot: number, mainCode: number): RuneDetail => ({
      id,
      slot,
      set: 'will',
      rank: 6,
      rarity: 5,
      level: 15,
      main: { code: mainCode, value: 20 },
      subs: [{ code: 1, value: 30 }, { code: 5, value: 15 }, { code: 8, value: 5 }, { code: 11, value: 5 }],
    });
    const blade = (id: number, slot: number, mainCode: number): RuneDetail => ({
      id,
      slot,
      set: 'blade',
      rank: 6,
      rarity: 5,
      level: 15,
      main: { code: mainCode, value: 20 },
      subs: [{ code: 1, value: 30 }, { code: 6, value: 15 }, { code: 8, value: 5 }, { code: 12, value: 5 }],
    });
    const shield = (id: number, slot: number, mainCode: number): RuneDetail => ({
      id,
      slot,
      set: 'shield',
      rank: 6,
      rarity: 5,
      level: 15,
      main: { code: mainCode, value: 20 },
      subs: [{ code: 3, value: 30 }, { code: 4, value: 15 }, { code: 8, value: 5 }, { code: 11, value: 5 }],
    });
    const pool: RuneDetail[] = [
      will(1, 1, 4),
      will(2, 2, 6),
      blade(3, 3, 3),
      blade(4, 4, 5),
      shield(5, 5, 1),
      shield(6, 6, 2),
    ];
    const requirement: BuildRequirement = { sets: ['will'], minStats: { cr: 20 } };

    const ref = bruteForce(pool, BASE, requirement);
    egal(ref.count, 1, 'scénario dédié (set Blade accidentel) : la référence, qui évalue les VRAIES stats des 6 runes, trouve bien la combinaison (base cr=15 + bonus Blade +12 = 27 ≥ 20)');

    const res = searchBuilds({ base: BASE, artifacts: [], pool, requirement, metric: 'eff' });
    egal(res.candidates.length, 1, 'scénario dédié (set Blade accidentel) : CORRECTIF confirmé — le moteur trouve désormais la combinaison, `guaranteedMin` anticipe le bonus Blade accidentel dès `eliminateInfeasible`');
    if (res.candidates.length > 0) {
      const byId = new Map(pool.map((r) => [r.id, r]));
      const runes = res.candidates[0].runeIds.map((id) => byId.get(id)!);
      const stats = computeStats({ base: BASE, runes, artifacts: [] });
      const cr = stats.find((r) => r.key === 'cr');
      egal(cr?.total, 27, 'scénario dédié (set Blade accidentel) : le candidat trouvé a bien Taux Crit = base(15) + bonus Blade(12) = 27, le bonus accidentel est réellement actif, pas juste supposé');
    }
  }

  // ⚠️ Scénario DÉDIÉ — vérifie le correctif « activation supplémentaire d'un
  // set DÉJÀ demandé » (voir spec/outils/optimizer/, cas réel Ciri :
  // Energy demandé UNE fois — 1 activation garantie, +15 % PV — mais le
  // build réel en active DEUX, `energy+shield+energy`, +30 % PV réels).
  // `guaranteedSetBonus` ne comptait que l'activation MINIMALE demandée ;
  // `additionalSetActivationHeadroom` doit désormais anticiper qu'un set
  // DÉJÀ demandé peut s'activer PLUS de fois si le pool le permet — pas
  // seulement un set totalement absent de la demande (cas déjà couvert
  // ci-dessus). Energy (2 pièces, +15 % PV PAR activation) est le set
  // DEMANDÉ une seule fois ; le pool en fournit 4 (2 activations réelles) ;
  // Shield (2 pièces, sans bonus de stat) comble les 2 emplacements restants.
  // Aucune rune ne porte de sub/mainstat PV (codes 1/2) — le SEUL moyen
  // d'atteindre `minStats.hp` est la SECONDE activation d'Energy.
  {
    const energy = (id: number, slot: number, mainCode: number): RuneDetail => ({
      id,
      slot,
      set: 'energy',
      rank: 6,
      rarity: 5,
      level: 15,
      main: { code: mainCode, value: 20 },
      subs: [{ code: 3, value: 30 }, { code: 5, value: 15 }, { code: 8, value: 5 }, { code: 11, value: 5 }],
    });
    const shield2 = (id: number, slot: number, mainCode: number): RuneDetail => ({
      id,
      slot,
      set: 'shield',
      rank: 6,
      rarity: 5,
      level: 15,
      main: { code: mainCode, value: 20 },
      subs: [{ code: 3, value: 30 }, { code: 6, value: 15 }, { code: 8, value: 5 }, { code: 12, value: 5 }],
    });
    const pool: RuneDetail[] = [
      energy(1, 1, 4),
      energy(2, 2, 6),
      energy(3, 3, 3),
      energy(4, 4, 5),
      shield2(5, 5, 3),
      shield2(6, 6, 4),
    ];
    const requirement: BuildRequirement = { sets: ['energy'], minStats: { hp: 10000 } };

    const ref = bruteForce(pool, BASE, requirement);
    egal(ref.count, 1, 'scénario dédié (activation Energy supplémentaire) : la référence trouve bien la combinaison (base PV=8000 + 2 activations Energy à +15 % chacune = 10400 ≥ 10000)');

    const res = searchBuilds({ base: BASE, artifacts: [], pool, requirement, metric: 'eff' });
    egal(res.candidates.length, 1, "scénario dédié (activation Energy supplémentaire) : CORRECTIF confirmé — le moteur trouve désormais la combinaison, `guaranteedMin` anticipe la SECONDE activation d'Energy dès `eliminateInfeasible`");
    if (res.candidates.length > 0) {
      const byId = new Map(pool.map((r) => [r.id, r]));
      const runes = res.candidates[0].runeIds.map((id) => byId.get(id)!);
      const active = activeSets(runes.map((r) => r.set));
      egal(active.filter((s) => s === 'energy').length, 2, 'scénario dédié (activation Energy supplémentaire) : le candidat trouvé active bien Energy DEUX fois, pas une seule');
      const stats = computeStats({ base: BASE, runes, artifacts: [] });
      const hp = stats.find((r) => r.key === 'hp');
      egal(hp?.total, 10400, 'scénario dédié (activation Energy supplémentaire) : PV = base(8000) + 2×15 %(2400) = 10400, la seconde activation est réellement active, pas juste supposée');
    }
  }
}
