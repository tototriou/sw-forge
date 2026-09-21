// Les trois options relique de `perf-battery.ts` (implementation-relique,
// lot 6, B.6 « outillage relevé au brief ») — harnais d'abord (A.0) : ce
// qui s'exprime en test nommé ne reste pas une commande recopiée dans une
// preuve.
//
// Trois contrôles : (1) l'analyse d'options est PURE et REFUSE toute valeur
// hors domaine (c'est ce qui rend les jetons sûrs à recopier au processus
// `--case=`) ; (2) un cas porteur de l'option pose bien son `relicContext`
// par `buildCaseSearchParams` — l'expression de production de perf-battery
// et de l'oracle `--case` — avec l'objectif du cas INCHANGÉ, et le libellé
// du run porte l'intention ; (3) la BASELINE de B.6, `--relic-main=equipped`,
// donne la même projection canonique que le chemin sans contexte — sur la
// fixture miniature, pour chacun des sept cas de `CASES`, l'objectif du cas
// compris.

import { activeSets } from '../src/lib/effects';
import { parseAccountBox, parseAccountInventory, parseAccountSource } from '../src/lib/importAccount';
import { SearchParams } from '../src/lib/runeBuildOptim';
import { buildCaseSearchParams, CASES } from '../scripts/lib/perfShared';
import { caseAvecRelique, jetonsRelique, libelleAvecRelique, parseOptionsRelique } from '../scripts/lib/perfRelicOptions';
import { projectionCanonique } from './relic-search.test';
import { egal, exportSynthetique, ok, titre } from './outils';

function leve(f: () => unknown): string | null {
  try {
    f();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export default function testPerfRelicOptions() {
  titre('Optimizer · perf-battery — options relique (lot 6)');

  /* (1) Analyse pure des options. */
  egal(parseOptionsRelique([]), undefined, 'aucune option → undefined (comportement d’avant, pas de relicContext)');
  egal(parseOptionsRelique(['--repeats=3', '--save']), undefined, 'les autres options de perf-battery n’activent rien');
  egal(parseOptionsRelique(['--relic-main=equipped']), { principale: 'equipped', type: 'libre', seuil: 6 }, '--relic-main=equipped seul : type libre, seuil 6 (DEFAULT_RELIC_MIN_UPGRADE)');
  egal(parseOptionsRelique(['--relic-min-upgrade=9']), { principale: 'libre', type: 'libre', seuil: 9 }, '--relic-min-upgrade seul : principale et type libres');
  egal(parseOptionsRelique(['--relic-type=16']), { principale: 'libre', type: 16, seuil: 6 }, '--relic-type seul : principale libre, seuil 6');
  egal(
    parseOptionsRelique(['--case=3', '--relic-main=101', '--relic-type=1', '--relic-min-upgrade=0', '--bundle-dir=x']),
    { principale: 101, type: 1, seuil: 0 },
    'les trois options ensemble, mêlées aux autres jetons'
  );
  egal(parseOptionsRelique(['--relic-main=100', '--relic-type=libre']), { principale: 100, type: 'libre', seuil: 6 }, '--relic-type=libre est accepté');
  ok(leve(() => parseOptionsRelique(['--relic-main=103'])) != null, '--relic-main=103 est refusé (hors equipped|libre|100|101|102)');
  ok(leve(() => parseOptionsRelique(['--relic-main=atk'])) != null, '--relic-main=atk est refusé');
  ok(leve(() => parseOptionsRelique(['--relic-type=0'])) != null, '--relic-type=0 est refusé (1..16)');
  ok(leve(() => parseOptionsRelique(['--relic-type=17'])) != null, '--relic-type=17 est refusé');
  ok(leve(() => parseOptionsRelique(['--relic-min-upgrade=16'])) != null, '--relic-min-upgrade=16 est refusé (0..15)');
  ok(leve(() => parseOptionsRelique(['--relic-min-upgrade=-1'])) != null, '--relic-min-upgrade=-1 est refusé');
  ok(leve(() => parseOptionsRelique(['--relic-min-upgrade=6.5'])) != null, '--relic-min-upgrade=6.5 est refusé (entier)');
  ok(leve(() => parseOptionsRelique(['--relic-seuil=6'])) != null, 'une option --relic-* inconnue est refusée, jamais ignorée');
  egal(
    jetonsRelique(['--case=2', '--relic-min-upgrade=6', '--bundle-dir=1', '--relic-main=libre']),
    ['--relic-min-upgrade=6', '--relic-main=libre'],
    'jetonsRelique ne recopie que les jetons --relic-* (propagation au processus --case=)'
  );

  /* (2) Le cas porteur : libellé et relicContext par l'expression de prod. */
  const data = parseAccountSource(exportSynthetique())!;
  const box = parseAccountBox(data).monsters;
  const inventaire = parseAccountInventory(data);
  const gear = box.find((m) => m.gear?.relic)?.gear!;
  ok(gear != null && gear.relic != null, 'fixture : un exemplaire porte une relique (7001, lot 1)');
  const charge = { gear, allRunes: inventaire.runes, allRelics: inventaire.relics, requirement: { sets: activeSets(gear.runes.map((r) => r.set)), minStats: {} } };

  const sansOption = caseAvecRelique(CASES[3]!, undefined);
  ok(sansOption === CASES[3], 'sans option, le cas est rendu tel quel (même objet, même libellé)');
  const libre = caseAvecRelique(CASES[3]!, { principale: 'libre', type: 1, seuil: 9 });
  egal(libre.label, 'Lushen d11 (tototriou) [relique libre/1/+9]', 'le libellé du run porte l’intention relique');
  egal(libelleAvecRelique('x', { principale: 101, type: 'libre', seuil: 0 }), 'x [relique 101/libre/+0]', 'libellé : principale forcée et type libre');
  const paramsLibre = buildCaseSearchParams(libre, charge, 10 * 60 * 1000);
  egal(paramsLibre.relicContext?.mode, 'recherche', 'libre → relicContext en mode recherche');
  egal(paramsLibre.relicContext?.seuil, 9, 'le seuil de l’option est celui du contexte');
  egal(paramsLibre.relicContext?.type, 1, 'le type de l’option est celui du contexte');
  egal(paramsLibre.objective, CASES[3]!.objective, 'l’objectif du cas est INCHANGÉ (jamais un override)');
  egal(paramsLibre.objectiveStats, CASES[3]!.objectiveStats, 'objectiveStats du cas inchangés');
  egal(paramsLibre.relic, gear.relic, 'SearchParams.relic reste la relique PORTÉE (garantie G)');

  /* (3) La baseline de B.6 : equipped ≡ sans contexte, projection canonique. */
  for (const cas of CASES) {
    const base = buildCaseSearchParams(cas, charge, Number.POSITIVE_INFINITY);
    const equipped = buildCaseSearchParams(caseAvecRelique(cas, { principale: 'equipped', type: 'libre', seuil: 6 }), charge, Number.POSITIVE_INFINITY);
    egal(base.relicContext, undefined, `${cas.label} : sans option, aucun relicContext`);
    egal(equipped.relicContext?.mode, 'equipped', `${cas.label} : --relic-main=equipped pose un contexte en mode equipped`);
    egal(equipped.relicContext?.equipee?.id, gear.relic!.id, `${cas.label} : la relique portée est celle du contexte`);
    const { relicContext: _a, ...resteBase } = base;
    const { relicContext: _b, ...resteEquipped } = equipped;
    egal(resteEquipped, resteBase, `${cas.label} : tous les SearchParams hors relicContext sont identiques`);
    egal(projectionCanonique(equipped), projectionCanonique(base), `${cas.label} : projection canonique byte-identique (baseline equipped ≡ sans contexte)`);
  }
  const deuxPasses: SearchParams = buildCaseSearchParams(caseAvecRelique(CASES[6]!, { principale: 'equipped', type: 'libre', seuil: 6 }), charge, Number.POSITIVE_INFINITY);
  egal(projectionCanonique(deuxPasses), projectionCanonique(deuxPasses), 'deux passes identiques → même projection canonique (contrôle de reproductibilité)');
}
