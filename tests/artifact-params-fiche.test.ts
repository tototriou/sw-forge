// degats-et-aura 6bis-b6 — les `ArtifactSearchParams` de la fiche, produits
// par UN producteur pur (`parametresArtefactsFiche`, artifactFiche.ts) que
// l'écran (`artifactParams`, OptimizerSection.tsx), le CLI (`paramsArtefacts`,
// recipeToSearchParams.ts) et le différentiel relique (`entreeResolution`,
// relicDifferentiel.ts) appellent tous trois.
//
// Constats de la revue technique 6bis-b : C5 (§ 4.2, le CLI n'appliquait pas
// la neutralisation des verrous de l'écran) et C6 (§ 4.3, le différentiel
// recopiait l'entrée de résolution sans `codesAmplification` ni canal
// exclusive obligatoire).
//
// La référence de l'écran est une COPIE FIGÉE du corps du mémo
// `artifactParams` au commit 7905df36 (`artifactParamsAvant`) : l'écran ne
// doit pas changer de comportement (contrainte du 2026-10-01), c'est donc son
// ancien corps qui fait foi, jamais le producteur qu'on teste.

import { ArtifactArchetype, ArtifactDetail, ArtifactKind, ARTIFACT_KINDS, ElementKey, GearSet, RelicDetail, RuneDetail } from '../src/types';
import type { ArtifactMainChoice } from '../src/hooks/useOptimizerState';
import { buildOptimizerRecipe, OptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP, codesAmplificationActifs, type DamageSetup } from '../src/lib/damage';
import { StatKey } from '../src/lib/effects';
import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { candidatsParSorte, chercherPaires, paireRepresentative, type ChoixPrincipale, type LigneVerrouillee } from '../src/lib/artifactOptim';
import { parametresArtefactsFiche, sortesFigeesDe } from '../src/lib/artifactFiche';
import { readFileSync } from 'node:fs';
import { artefactsDuCli, recipeToSearchParams, resoudreEquipementCli } from '../scripts/lib/recipeToSearchParams';
import { LoadedMonster } from '../scripts/lib/loadMonster';
import { egal, ok, titre } from './outils';

/* ── La référence de l'écran : le corps du mémo d'avant, recopié TEL QUEL ── */

export interface EntreesMemoArtifactParams {
  selected: { monster: { element: ElementKey; archetype: ArtifactArchetype | null }; gear: GearSet } | null;
  evaluateursFiche: { representatif: (arts: ArtifactDetail[]) => number } | null;
  optimiserArtefacts: boolean;
  artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>;
  artifacts: ArtifactDetail[];
  artefactsReserves: Set<number>;
  lignesVerrouillees: LigneVerrouillee[];
  damageSetup: DamageSetup;
  maxStats: Partial<Record<StatKey, number>>;
}

// `sortesFigees` d'avant (OptimizerSection.tsx, mémo voisin), recopié tel quel.
export function sortesFigeesAvant(artifactMainByKind: Partial<Record<ArtifactKind, ArtifactMainChoice>>): ArtifactKind[] {
  return ARTIFACT_KINDS.map(({ key }) => key).filter((key) => (artifactMainByKind[key] ?? 'libre') === 'equipped');
}

// Le corps du mémo `artifactParams` au commit 7905df36, commentaires retirés,
// expressions inchangées.
export function artifactParamsAvant(e: EntreesMemoArtifactParams) {
  const { selected, evaluateursFiche, optimiserArtefacts, artifactMainByKind, artifacts, artefactsReserves, lignesVerrouillees, damageSetup, maxStats } = e;
  const sortesFigees = sortesFigeesAvant(artifactMainByKind);
  if (!selected || !evaluateursFiche) return null;
  const espece = selected.monster;
  const evaluer = evaluateursFiche.representatif;
  return {
    porteur: { element: espece.element, archetype: espece.archetype },
    inventaire: artefactsReserves.size === 0 ? artifacts : artifacts.filter((a) => !artefactsReserves.has(a.id)),
    equipes: selected.gear.artifacts,
    principaleParSorte: (optimiserArtefacts
      ? artifactMainByKind
      : { element: 'equipped', archetype: 'equipped' }) as Partial<Record<ArtifactKind, ChoixPrincipale>>,
    lignesVerrouillees:
      optimiserArtefacts && sortesFigees.length < ARTIFACT_KINDS.length ? lignesVerrouillees : [],
    codesAmplification: codesAmplificationActifs(damageSetup),
    maxStatsActifs: (Object.keys(maxStats) as StatKey[]).filter((k) => (maxStats[k] ?? 0) > 0),
    evaluer,
  };
}

/* ── Fixture : Lushen (vent / attaque), un build porté ─────────────────── */

const LUSHEN = 13413;
const BASE = { hp: 10000, atk: 1000, def: 500, spd: 100, cr: 15, cd: 50, res: 15, acc: 0 };

function rune(id: number, slot: number): RuneDetail {
  return { id, slot, set: 'violent', rank: 6, rarity: 5, level: 15, main: { code: slot % 2 ? 3 : 4, value: slot % 2 ? 100 : 20 }, subs: [] };
}
export function art(id: number, kind: 'element' | 'archetype', main: [number, number], subs: [number, number][]): ArtifactDetail {
  return {
    id, kind, ...(kind === 'element' ? { element: 'wind' as const } : { archetype: 'attack' as const }), level: 15, rarity: 5,
    main: { code: main[0], value: main[1] }, subs: subs.map(([code, value]) => ({ code, value })),
  };
}

const RUNES_PORTEES = [1, 2, 3, 4, 5, 6].map((s) => rune(100 + s, s));
const RELIQUE: RelicDetail = { id: 50, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } };

function recette(r: Partial<OptimizerRecipe>): OptimizerRecipe {
  return buildOptimizerRecipe({
    monsterCom2usId: LUSHEN, monsterName: 'Lushen (test)', requirement: { sets: [], minStats: {} }, objective: 'degats_reels',
    damageSetup: DEFAULT_DAMAGE_SETUP, metric: 'eff', slotFilterPreset: 'bas', adaptiveTrancheWeighting: false, exhaustiveSearch: false,
    excludeUsedRunes: false, excludeUsedScope: 'rta', excludedSelectors: [], ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' }, relicMainChoice: 'equipped',
    ...r,
  });
}

// L'écran de cette recette sur ce monstre, comme `importRecipe` le règle :
// mêmes choix, mêmes verrous, même `damageSetup`, aucun artéfact réservé
// (aucune liste active), la fiche du monstre ; l'évaluateur de la fiche est
// le producteur partagé de 6bis-b5b (celui que `artefactsDuCli` appelle).
function entreesEcran(recipe: OptimizerRecipe, loaded: LoadedMonster, evaluer: (arts: ArtifactDetail[]) => number): EntreesMemoArtifactParams {
  return {
    selected: { monster: { element: 'wind', archetype: 'attack' }, gear: loaded.gear },
    evaluateursFiche: { representatif: evaluer },
    optimiserArtefacts: !recipe.ignoreArtifacts,
    artifactMainByKind: recipe.artifactMainByKind,
    artifacts: loaded.allArtifacts,
    artefactsReserves: new Set(),
    lignesVerrouillees: recipe.lignesVerrouillees ?? [],
    damageSetup: recipe.damageSetup ?? DEFAULT_DAMAGE_SETUP,
    maxStats: recipe.requirement.maxStats ?? {},
  };
}

const ids = (arts: readonly ArtifactDetail[]) => arts.map((a) => a.id);
const sansEvaluer = <T extends { evaluer: unknown }>({ evaluer: _e, ...reste }: T) => reste;

/* ── C5 : la recette verrouillée, CLI = écran ──────────────────────────── */

export function testArtefactsFicheParamsCliVerrous() {
  titre('Paramètres d’artéfacts de la fiche — recette verrouillée, deux emplacements figés : CLI = écran (6bis-b6, C5)');

  // Les deux pièces portées ne portent pas la ligne 218 ; une pièce de
  // l'inventaire la porte, mais les deux emplacements sont figés.
  const portees = [art(801, 'element', [101, 100], [[219, 10]]), art(802, 'archetype', [101, 100], [])];
  const loaded: LoadedMonster = {
    unitId: 1, com2usId: LUSHEN, monsterName: 'Lushen (test)',
    gear: { base: BASE, runes: RUNES_PORTEES, artifacts: portees, relic: RELIQUE },
    allRunes: RUNES_PORTEES, allArtifacts: [...portees, art(803, 'element', [101, 100], [[218, 1.5]])], allRelics: [RELIQUE],
  };
  const fige = recette({ artifactMainByKind: { element: 'equipped', archetype: 'equipped' }, lignesVerrouillees: [{ code: 218, min: 1 }] });

  const a = artefactsDuCli(fige, loaded)!;
  const ecran = artifactParamsAvant(entreesEcran(fige, loaded, a.params.evaluer))!;
  egal(ecran.lignesVerrouillees, [], 'précondition : l’écran neutralise les verrous quand les deux emplacements sont figés');
  egal(a.params.lignesVerrouillees, ecran.lignesVerrouillees, 'CLI : verrous neutralisés comme à l’écran');
  egal(sansEvaluer({ ...a.params, inventaire: ids(a.params.inventaire), equipes: ids(a.params.equipes) }),
    sansEvaluer({ ...ecran, inventaire: ids(ecran.inventaire), equipes: ids(ecran.equipes) }),
    'CLI : mêmes champs que l’écran (porteur, inventaire, portés, principales, verrous, amplifications, maximums)');
  egal(ids(paireRepresentative(a.params)), ids(paireRepresentative(ecran)), 'CLI : même paire représentative que l’écran');
  egal(ids(paireRepresentative(ecran)), [801, 802], '… la paire portée');

  const params = recipeToSearchParams(fige, loaded);
  egal(ids(params.artifacts), [801, 802], 'CLI : la recherche part de la paire portée (SearchParams.artifacts)');
  const porte: BuildCandidate = { runeIds: RUNES_PORTEES.map((r) => r.id), stats: [], effTotal: 0 };
  const r = resoudreEquipementCli(fige, loaded, params)!(porte);
  ok(r.conforme, 'CLI : le build porté se résout (conforme)');
  egal(ids(r.artefacts), [801, 802], 'CLI : … avec la paire portée');

  // Un seul emplacement figé : le verrou reste actif, des deux côtés.
  const demi = recette({ artifactMainByKind: { element: 'libre', archetype: 'equipped' }, lignesVerrouillees: [{ code: 218, min: 1 }] });
  const aDemi = artefactsDuCli(demi, loaded)!;
  const ecranDemi = artifactParamsAvant(entreesEcran(demi, loaded, aDemi.params.evaluer))!;
  egal(aDemi.params.lignesVerrouillees, [{ code: 218, min: 1 }], 'un seul emplacement figé : le CLI garde le verrou');
  egal(aDemi.params.lignesVerrouillees, ecranDemi.lignesVerrouillees, '… comme l’écran');
  egal(ids(paireRepresentative(aDemi.params)), [803, 802], '… et la paire tient la ligne 218 (803 + la pièce portée figée)');
}

/* ── Contrainte du 2026-10-01 : l'écran garde exactement le même comportement ── */

// Le corps du mémo `artifactParams` APRÈS 6bis-b6, recopié tel quel — le
// contrôle de source ci-dessous vérifie que l'écran porte exactement ce texte.
function artifactParamsApres(e: EntreesMemoArtifactParams) {
  const { selected, evaluateursFiche, optimiserArtefacts, artifactMainByKind, artifacts, artefactsReserves, lignesVerrouillees, damageSetup, maxStats } = e;
  if (!selected || !evaluateursFiche) return null;
  const espece = selected.monster;
  const evaluer = evaluateursFiche.representatif;
  return {
    ...parametresArtefactsFiche({
      porteur: { element: espece.element, archetype: espece.archetype },
      inventaire: artifacts,
      reserves: artefactsReserves,
      equipes: selected.gear.artifacts,
      optimiserArtefacts,
      principaleParSorte: artifactMainByKind,
      lignesVerrouillees,
      damageSetup,
      maxStats,
    }),
    evaluer,
  };
}

// Le texte d'un mémo de l'écran, commentaires retirés, blancs normalisés.
function corpsDuMemo(source: string, debut: string, fin: string): string | null {
  const i = source.indexOf(debut);
  const j = i < 0 ? -1 : source.indexOf(fin, i);
  if (i < 0 || j < 0) return null;
  return source.slice(i, j + fin.length).split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join(' ').replace(/\s+/g, ' ');
}

export function testArtefactsFicheParamsEcran() {
  titre('Paramètres d’artéfacts de la fiche — l’écran rend les mêmes ArtifactSearchParams qu’avant 6bis-b6 (copie figée du mémo)');

  const portees = [art(801, 'element', [101, 100], [[219, 10]]), art(802, 'archetype', [101, 100], [[204, 20]])];
  const inventaire = [...portees, art(803, 'element', [100, 1500], [[218, 1.5], [205, 30]]), art(804, 'archetype', [102, 100], [[220, 20]]), art(805, 'element', [101, 100], [[300, 10]])];
  const loaded: LoadedMonster = {
    unitId: 1, com2usId: LUSHEN, monsterName: 'Lushen (test)',
    gear: { base: BASE, runes: RUNES_PORTEES, artifacts: portees, relic: RELIQUE },
    allRunes: RUNES_PORTEES, allArtifacts: inventaire, allRelics: [RELIQUE],
  };
  // Un évaluateur réel de la fiche (« Dégâts réels », Lushen), le producteur
  // partagé de 6bis-b5b : la paire et ses notes dépendent des lignes.
  const evaluer = artefactsDuCli(recette({}), loaded)!.params.evaluer;
  const selected = { monster: { element: 'wind' as const, archetype: 'attack' as const }, gear: loaded.gear };

  const choix: Partial<Record<ArtifactKind, ArtifactMainChoice>>[] = [
    {}, { element: 'equipped' }, { archetype: 'equipped' }, { element: 'equipped', archetype: 'equipped' },
    { element: 101, archetype: 'libre' }, { element: 'libre', archetype: 102 },
  ];
  const verrous: LigneVerrouillee[][] = [[], [{ code: 218, min: 1 }], [{ code: 219, min: 5 }, { code: 220, min: 10 }]];
  const reserves = [new Set<number>(), new Set([803]), new Set([999])];
  const setups: DamageSetup[] = [DEFAULT_DAMAGE_SETUP, { ...DEFAULT_DAMAGE_SETUP, atkBuff: true }, { ...DEFAULT_DAMAGE_SETUP, defBuff: true, spdBuff: true }];
  const maximums: Partial<Record<StatKey, number>>[] = [{}, { atk: 0 }, { atk: 3000, hp: 20000, res: 0 }];

  let combinaisons = 0, paires = 0;
  const ecarts: string[] = [];
  for (const optimiserArtefacts of [true, false]) for (const artifactMainByKind of choix) for (const lignesVerrouillees of verrous)
    for (const artefactsReserves of reserves) for (const damageSetup of setups) for (const maxStats of maximums) {
      const e: EntreesMemoArtifactParams = { selected, evaluateursFiche: { representatif: evaluer }, optimiserArtefacts, artifactMainByKind, artifacts: inventaire, artefactsReserves, lignesVerrouillees, damageSetup, maxStats };
      const avant = artifactParamsAvant(e)!, apres = artifactParamsApres(e)!;
      const nom = JSON.stringify({ optimiserArtefacts, artifactMainByKind, lignesVerrouillees, reserves: [...artefactsReserves], damageSetup: damageSetup === DEFAULT_DAMAGE_SETUP ? 'défaut' : damageSetup, maxStats });
      combinaisons++;
      // Les champs : mêmes clés, même ordre, mêmes valeurs ; mêmes références
      // là où l'ancien corps rendait l'entrée elle-même.
      if (Object.keys(apres).join() !== Object.keys(avant).join()) ecarts.push(`${nom} : clés ${Object.keys(apres)}`);
      if (JSON.stringify(sansEvaluer(apres)) !== JSON.stringify(sansEvaluer(avant))) ecarts.push(`${nom} : champs`);
      if (apres.evaluer !== avant.evaluer) ecarts.push(`${nom} : evaluer`);
      if ((avant.inventaire === inventaire) !== (apres.inventaire === inventaire)) ecarts.push(`${nom} : référence de l’inventaire`);
      if ((avant.principaleParSorte === artifactMainByKind) !== (apres.principaleParSorte === artifactMainByKind)) ecarts.push(`${nom} : référence des principales`);
      if ((avant.lignesVerrouillees === lignesVerrouillees) !== (apres.lignesVerrouillees === lignesVerrouillees)) ecarts.push(`${nom} : référence des verrous`);
      // Les valeurs d'`evaluer` sur chaque paire candidate (emplacement vide
      // compris), puis le choix de la paire.
      for (const el of candidatsParSorte(avant, 'element')) for (const ar of candidatsParSorte(avant, 'archetype')) {
        const paire = [el, ar].filter((a): a is ArtifactDetail => a != null);
        if (apres.evaluer(paire) !== avant.evaluer(paire)) ecarts.push(`${nom} : evaluer(${ids(paire)})`);
        paires++;
      }
      if (JSON.stringify(chercherPaires(apres, 3)) !== JSON.stringify(chercherPaires(avant, 3))) ecarts.push(`${nom} : chercherPaires`);
      if (ids(paireRepresentative(apres)).join() !== ids(paireRepresentative(avant)).join()) ecarts.push(`${nom} : paire représentative`);
    }
  egal(ecarts, [], `${combinaisons} combinaisons d’entrées du mémo : mêmes champs, mêmes références, mêmes paires (${paires} paires notées par evaluer)`);
  egal([artifactParamsApres({ ...entreesEcran(recette({}), loaded, evaluer), selected: null }), artifactParamsApres({ ...entreesEcran(recette({}), loaded, evaluer), evaluateursFiche: null })], [null, null],
    'sans monstre ou sans évaluateur : null, comme avant');

  // Contrôle de source : l'écran appelle le producteur DANS le même mémo, avec
  // les mêmes dépendances, et nulle part ailleurs.
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  const memo = corpsDuMemo(ecran, 'const artifactParams = useMemo(() => {', ']);');
  egal(memo,
    'const artifactParams = useMemo(() => { if (!selected || !evaluateursFiche) return null; const espece = selected.monster; const evaluer = evaluateursFiche.representatif; '
    + 'return { ...parametresArtefactsFiche({ porteur: { element: espece.element, archetype: espece.archetype }, inventaire: artifacts, reserves: artefactsReserves, equipes: selected.gear.artifacts, '
    + 'optimiserArtefacts, principaleParSorte: artifactMainByKind, lignesVerrouillees, damageSetup, maxStats, }), evaluer, }; '
    + '}, [selected, evaluateursFiche, optimiserArtefacts, artifactMainByKind, sortesFigees, artifacts, artefactsReserves, lignesVerrouillees, damageSetup, maxStats]);',
    'écran : le mémo artifactParams appelle le producteur, avec les dépendances d’avant (sortesFigees compris)');
  egal((ecran.match(/parametresArtefactsFiche\(/g) ?? []).length, 1, 'écran : un seul appel au producteur — dans ce mémo');
  ok(ecran.includes('const sortesFigees = useMemo<ArtifactKind[]>(() => sortesFigeesDe(artifactMainByKind), [artifactMainByKind]);'),
    'écran : sortesFigees vient de la même définition que la neutralisation (sortesFigeesDe), mêmes dépendances');
  ok(/const searchArtifacts = useMemo<ArtifactDetail\[\]>\(\s*\(\) => \(artifactParams \? paireRepresentative\(artifactParams\) : \[\]\),\s*\[artifactParams\]\s*\);/.test(ecran),
    'écran : la paire représentative ne dépend toujours que d’artifactParams');
  for (const s of choix) egal(sortesFigeesDe(s), sortesFigeesAvant(s), `sortesFigeesDe = l’ancienne expression (${JSON.stringify(s)})`);

  // Raccordement du CLI.
  const cli = readFileSync('scripts/lib/recipeToSearchParams.ts', 'utf8');
  ok(/function paramsArtefacts\([\s\S]{0,400}?\.\.\.parametresArtefactsFiche\(\{/.test(cli), 'CLI : paramsArtefacts passe par le producteur');
}
