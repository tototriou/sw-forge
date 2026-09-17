// PARITÉ — le harnais de diagnostic contre les 6 scripts qu'il remplace.
//
// C'est le niveau 1 de la validation à trois niveaux du cadrage
// (spec/outils/optimizer/harnais-diagnostic.md §8) : « mêmes nombres que les
// 6 scripts sur leurs cas, ÉCARTS ATTENDUS DOCUMENTÉS là où l'ancien script
// était faux ».
//
// ⚠️ **Les 6 scripts ne sont PAS un oracle absolu** — ils portent précisément
// le défaut qu'on corrige. Une parité PARFAITE serait donc un ÉCHEC : elle
// signifierait que le harnais a hérité de leur dérive. Ce qu'on vérifie est
// plus fin :
//   - étages `mainstat` et `dominance` : IDENTIQUES (les deux chemins y font
//     rigoureusement la même chose) ;
//   - étage `feasibility` : le harnais doit garder **au moins autant** de
//     runes. La reconstruction historique appelle `eliminateInfeasible` SANS
//     `guaranteedMin` ni `artFlatMin`, et borne l'apport d'artéfact à la
//     paire FIGÉE du monstre au lieu de ce que l'inventaire peut donner.
//     Ses bornes sont donc plus PESSIMISTES : elle élimine des runes qui
//     peuvent en réalité entrer dans un build valide. C'est exactement la
//     dette du §12.15 d'artefacts.md.
//
// ⚠️ **La reconstruction ci-dessous est une COPIE LITTÉRALE de l'ancien
// code** (`monster-search-pipeline-diag.ts`), y compris son `totalOf` maison
// et son appel à 8 arguments. C'est volontaire : un oracle historique
// paraphrasé ne prouve rien. Ne pas la « corriger » — sa fausseté est le
// sujet.
//
// Usage : diagnostic-harness-parite.ts [--cas=<index|nom|tous>]   (défaut : tous ; le nom accepte un fragment sans distinction de casse, d'accents ni de ponctuation)

import { unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StatKey } from '../src/lib/effects';
import {
  BuildRequirement,
  artifactFlatBonus,
  eliminateInfeasible,
  filterSlot,
  guaranteedSetBonus,
  mainStatFilteredBySlot,
  pruneDominated,
  relicPctBonus,
} from '../src/lib/runeBuildOptim';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import { buildOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { BaseStats, RuneDetail } from '../src/types';
import { CASES, loadCase } from './lib/perfShared';
import { loadDeckMonster } from './lib/deckMonster';
import { executerHarnais } from './lib/diagnosticHarness';
import { resoudreSelectionCas, verifierComptesDisponibles } from './lib/diagnosticLot';

/* --------------------------------------------------------------------------
 * L'ORACLE HISTORIQUE — copie littérale de monster-search-pipeline-diag.ts.
 * ⚠️ Faux par endroits, et c'est le sujet. Ne pas corriger.
 * ----------------------------------------------------------------------- */

interface EtatsHistoriques {
  mainstat: RuneDetail[][];
  dominance: RuneDetail[][];
  feasibility: RuneDetail[][];
  filterslot: RuneDetail[][];
}

function pipelineHistorique(
  pool: RuneDetail[],
  base: BaseStats,
  requirement: BuildRequirement,
  statKeys: StatKey[],
  artefacts: Parameters<typeof artifactFlatBonus>[0],
  relique: Parameters<typeof relicPctBonus>[0],
  slotFilterCap: number,
  // ⚠️ L'objectif du CAS, pas 'efficience' en dur : `filterSlot` s'en sert
  // pour orienter son top-K par stat. Le figer faisait apparaître un écart
  // d'une rune sur le cas Ciri (objectif `ehp`) qui ne venait PAS de la
  // correction mesurée — un faux positif produit par l'oracle lui-même.
  objective: Parameters<typeof filterSlot>[5]
): EtatsHistoriques {
  const step1 = mainStatFilteredBySlot(pool, requirement);

  const requiredKeys = new Set(requirement.sets);
  const maxEntries = statKeys
    .map((k) => ({ k, max: requirement.maxStats?.[k] }))
    .filter((e): e is { k: StatKey; max: number } => e.max != null && e.max > 0);
  const maxKeys = new Set(maxEntries.map((e) => e.k));
  const step2 = step1.map((list) => pruneDominated(list, requiredKeys, maxKeys));

  const minEntries = statKeys
    .map((k) => ({ k, min: requirement.minStats[k] }))
    .filter((e): e is { k: StatKey; min: number } => e.min != null && e.min > 0);
  const constrainedKeys = Array.from(new Set([...minEntries.map((e) => e.k), ...maxEntries.map((e) => e.k)]));
  const guaranteed = guaranteedSetBonus(requirement, base);
  const artFlat = artifactFlatBonus(artefacts);
  const relPct = relicPctBonus(relique);
  const baseRec = base as unknown as Record<string, number>;
  function totalOf(k: StatKey, pct: number, flat: number): number {
    const b = baseRec[k] ?? 0;
    return k === 'hp' || k === 'atk' || k === 'def' ? b + Math.ceil((b * pct) / 100) + flat : b + flat;
  }
  // ⚠️ HUIT arguments : ni `guaranteedMin` ni `artFlatMin`. C'est LA dette.
  const step3 = eliminateInfeasible(step2, minEntries, maxEntries, constrainedKeys, guaranteed, artFlat, relPct, totalOf);

  const step4 = step3.map((list) => filterSlot(list, requirement, base, slotFilterCap, slotFilterCap, objective));
  return { mainstat: step1, dominance: step2, feasibility: step3, filterslot: step4 };
}

/* --------------------------------------------------------------------------
 * Comparaison
 * ----------------------------------------------------------------------- */

const tailles = (bySlot: RuneDetail[][]) => bySlot.map((l) => l.length);
const somme = (t: number[]) => t.reduce((s, n) => s + n, 0);

async function comparerCas(index: number): Promise<boolean> {
  const c = CASES[index];
  const { gear, allRunes, requirement } = loadCase(c);
  const statKeys = c.statKeys as StatKey[];
  // ⚠️ Le préréglage « Bas » (40) : les 6 scripts historiques avaient 80 en
  // défaut, mais ce qui compte ici est que les DEUX chemins reçoivent la
  // MÊME valeur — la comparaison porte sur les étages, pas sur le cap.
  const cap = 40;

  console.log(`\n${'═'.repeat(78)}`);
  console.log(`Cas ${index} — ${c.label}`);
  console.log(`  pool ${allRunes.length} runes · sets ${requirement.sets.join('+')} · minStats ${JSON.stringify(requirement.minStats)}`);

  const ancien = pipelineHistorique(allRunes, gear.base, requirement, statKeys, gear.artifacts, gear.relic, cap, c.objective);

  // Le harnais passe par une RECETTE — la source de vérité de l'écran. Elle
  // est fabriquée par `buildOptimizerRecipe`, donc réimportable telle quelle
  // dans l'interface (§4.1 du cadrage).
  // ⚠️ Le vrai `com2usId` du monstre chargé, pas un numéro de remplissage :
  // sinon `chargerRecette` avertit à chaque cas d'un désaccord qui n'existe
  // pas, et le bruit finirait par masquer un vrai désaccord.
  const { com2usId } = loadDeckMonster({ exportPath: c.exportPath, deckId: c.deckId, monsterName: c.monsterName, defense: c.defense, rest: [] });
  const recette = buildOptimizerRecipe({
    monsterCom2usId: com2usId,
    monsterName: c.monsterName,
    wizardName: null,
    requirement,
    objective: c.objective ?? 'efficience',
    damageSetup: DEFAULT_DAMAGE_SETUP,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'box',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: {},
  });
  const chemin = join(tmpdir(), `sw-forge-parite-${process.pid}-${index}.json`);
  writeFileSync(chemin, JSON.stringify(recette), 'utf8');

  let nouveau;
  try {
    nouveau = await executerHarnais({
      source: { type: 'recette', cheminCompte: c.exportPath, cheminRecette: chemin, mode: { type: 'siege', deckId: c.deckId, defense: c.defense } },
      arretApres: 'filterslot',
      suivre: gear.runes.map((r) => r.id),
      overrides: { slotFilterCap: cap },
    });
  } finally {
    unlinkSync(chemin);
  }

  // ⚠️ **La ligne qui empêche de conclure à tort.** Sans elle, « feasibility
  // identique » est indistinguable de « la correction n'est pas active » —
  // deux situations qui produisent exactement le même nombre. On compare donc
  // les BORNES réellement appliquées par chaque chemin : si elles diffèrent,
  // la correction tourne bel et bien, et une égalité de tailles signifie
  // seulement qu'aucune rune de ce cas n'était à la marge.
  const artFlatAncien = artifactFlatBonus(gear.artifacts);
  const bornesDifferentes = nouveau.bornesFaisabilite.filter(
    (b) =>
      b.artFlatMax !== (artFlatAncien[b.stat] ?? 0) ||
      b.artFlatMin !== (artFlatAncien[b.stat] ?? 0) ||
      b.guaranteedMin.pct !== b.guaranteed.pct ||
      b.guaranteedMin.flat !== b.guaranteed.flat
  );
  console.log(
    `  bornes de faisabilité : ${bornesDifferentes.length > 0 ? `DIFFÉRENTES sur ${bornesDifferentes.length}/${nouveau.bornesFaisabilite.length} stat(s) contrainte(s) — la correction est ACTIVE` : '⚠️ IDENTIQUES à l’ancien chemin sur toutes les stats — vérifier que la correction s’applique bien'}`
  );
  for (const b of bornesDifferentes) {
    console.log(
      `     ${b.stat} : artFlat ancien ${artFlatAncien[b.stat] ?? 0} → max ${b.artFlatMax} / min ${b.artFlatMin}` +
        (b.guaranteedMin.pct !== b.guaranteed.pct || b.guaranteedMin.flat !== b.guaranteed.flat
          ? `  ·  guaranteed ${b.guaranteed.pct}%/${b.guaranteed.flat} → guaranteedMin ${b.guaranteedMin.pct}%/${b.guaranteedMin.flat}`
          : '')
    );
  }

  const parEtage = new Map(nouveau.preparation.map((t) => [t.etage, t.parEmplacement]));
  let ok = true;

  for (const etage of ['mainstat', 'dominance', 'feasibility', 'filterslot'] as const) {
    const a = tailles(ancien[etage]);
    const n = parEtage.get(etage)!;
    const identiques = a.every((v, i) => v === n[i]);
    const auMoinsAutant = n.every((v, i) => v >= a[i]);

    if (etage === 'mainstat' || etage === 'dominance') {
      // Attendu : IDENTIQUES — les deux chemins y font la même chose.
      if (!identiques) ok = false;
      console.log(`  ${etage.padEnd(12)} ancien ${somme(a).toString().padStart(6)} · harnais ${somme(n).toString().padStart(6)}   ${identiques ? 'IDENTIQUE ✅' : '❌ DIVERGENCE INATTENDUE'}`);
      if (!identiques) console.log(`     ancien=${a.join(',')}  harnais=${n.join(',')}`);
    } else if (etage === 'feasibility') {
      // Attendu : le harnais garde AU MOINS autant (bornes moins
      // pessimistes — `guaranteedMin`, `artFlatMin`, bornes d'inventaire).
      if (!auMoinsAutant) ok = false;
      const ecart = somme(n) - somme(a);
      console.log(
        `  ${etage.padEnd(12)} ancien ${somme(a).toString().padStart(6)} · harnais ${somme(n).toString().padStart(6)}   ` +
          `${auMoinsAutant ? (ecart === 0 ? 'identique (aucune rune ne dépendait de la correction) ✅' : `+${ecart} rune(s) SAUVÉES par guaranteedMin/artifactBounds ✅ (écart ATTENDU)`) : '❌ le harnais élimine PLUS que l’ancien — inattendu'}`
      );
    } else {
      // `filterslot` est capé : l'écart de l'étage précédent peut se
      // résorber (le cap mord) ou se propager. Aucune attente stricte, mais
      // il est affiché — une divergence énorme mériterait un regard.
      console.log(`  ${etage.padEnd(12)} ancien ${somme(a).toString().padStart(6)} · harnais ${somme(n).toString().padStart(6)}   (capé à ${cap}/emplacement — pas d’attente stricte)`);
    }
  }

  const perdues = nouveau.suivi.filter((s) => s.presenteAuDepart && s.premiereDisparition);
  console.log(`  runes réellement portées : ${nouveau.suivi.length - perdues.length}/${nouveau.suivi.length} survivent à la préparation`);
  for (const p of perdues) {
    console.log(`     #${p.id} disparaît à ${p.premiereDisparition!.etage} [${p.premiereDisparition!.nature}]`);
  }
  return ok;
}

async function main() {
  const cible = process.argv.find((a) => a.startsWith('--cas='))?.slice('--cas='.length);
  let indices: number[];
  try {
    indices = cible != null ? resoudreSelectionCas(cible) : CASES.map((_, i) => i);
    verifierComptesDisponibles(indices);
  } catch (erreur) {
    refuser(erreur instanceof Error ? erreur.message : String(erreur));
  }
  console.log('Parité harnais ↔ pipeline historique (les 6 scripts à reconstruction complète)');
  console.log('⚠️ Une parité PARFAITE serait un échec : l’ancien chemin est faux sur la faisabilité.');

  let echecs = 0;
  for (const i of indices) {
    if (!(await comparerCas(i))) echecs++;
  }
  console.log(`\n${'═'.repeat(78)}`);
  console.log(
    echecs === 0
      ? 'TOUS LES CAS CONFORMES — étages identiques là où ils doivent l’être, écarts dans le SENS attendu ailleurs.'
      : `${echecs} CAS EN ÉCHEC — divergence inattendue, ne pas supprimer les anciens scripts.`
  );
  process.exit(echecs === 0 ? 0 : 1);
}

function refuser(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
