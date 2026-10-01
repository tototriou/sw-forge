// degats-et-aura 6bis-b8 — la taille de la file de résolution (`kDeLaFile`,
// artifactQueue.ts) : 300 builds en mode relique « recherche », 100 sinon,
// dès le lancement, lue sur le contexte de la recherche LANCÉE.
//
// Les contextes viennent des producteurs mêmes de l'écran
// (`relicIntentDepuisEtat`, puis `resoudreContexteRelique`), jamais d'un
// objet écrit à la main : le mode testé est celui que la recherche porte.
// Le dépôt n'a pas d'infrastructure de test React : les deux appels (l'écran,
// le CLI) se contrôlent sur la source.

import { readFileSync } from 'node:fs';
import { K_BUILDS_OPTIMISES, K_BUILDS_RECHERCHE_RELIQUE, kDeLaFile } from '../src/lib/artifactQueue';
import { resoudreContexteRelique } from '../src/lib/relicOptim';
import { relicIntentDepuisEtat } from '../src/hooks/useOptimizerState';
import { RelicDetail } from '../src/types';
import { egal, ok, titre } from './outils';

const PORTEE: RelicDetail = { id: 1, upgrade: 9, main: { code: 101, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } };
const AUTRE: RelicDetail = { id: 2, upgrade: 9, main: { code: 100, value: 12 }, unique: { type: 1, tranche: 1000, percent: 2 } };

export function testKDeLaFile() {
  titre('File de résolution — sa taille selon le mode relique (6bis-b8)');

  egal([K_BUILDS_OPTIMISES, K_BUILDS_RECHERCHE_RELIQUE], [100, 300], 'les deux tailles décidées le 2026-10-01');
  egal(kDeLaFile(undefined), 100, 'aucune recherche lancée : 100');

  const ctx = (optimiser: boolean, principale: 'equipped' | 'libre', portee: RelicDetail | undefined) =>
    resoudreContexteRelique(relicIntentDepuisEtat(optimiser, principale, 'libre', 0), portee, [PORTEE, AUTRE]);
  const off = ctx(false, 'libre', PORTEE);
  const equipee = ctx(true, 'equipped', PORTEE);
  const equipeeSansRelique = ctx(true, 'equipped', undefined);
  const recherche = ctx(true, 'libre', PORTEE);
  const rechercheSansRelique = ctx(true, 'libre', undefined);
  egal([off.mode, equipee.mode, equipeeSansRelique.mode, recherche.mode, rechercheSansRelique.mode],
    ['off', 'equipped', 'equipped', 'recherche', 'recherche'], 'précondition : les modes du vrai producteur');
  egal(kDeLaFile(off), 100, '« Off » : 100 (et pas de file : l’optimisation d’artéfacts est coupée)');
  egal(kDeLaFile(equipee), 100, '« Équipée » : 100, inchangé');
  egal(kDeLaFile(equipeeSansRelique), 100, '« Équipée » sans relique portée : 100');
  egal(kDeLaFile(recherche), 300, '« recherche » : 300');
  egal(kDeLaFile(rechercheSansRelique), 300, '« recherche », monstre sans relique (le défaut) : 300');

  titre('File de résolution — K suit la recherche LANCÉE, l’écran et le CLI par la même fonction');

  // L'écran : K vient du contexte posé par `run(params)` (`search.relicContext`),
  // jamais des réglages courants.
  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/relicContext: relicContextRecherche, run, stop \} = search;/.test(ecran),
    'écran : `relicContextRecherche` est le contexte de la recherche lancée (`useBuildOptimSearch`)');
  const appelFile = ecran.match(/useArtifactOptimQueue\(\{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
  ok(/\n\s*K: kDeLaFile\(relicContextRecherche\),/.test(appelFile), 'écran : la file reçoit `K: kDeLaFile(relicContextRecherche)`');
  egal((ecran.match(/kDeLaFile\(/g) ?? []).length, 1, 'écran : un seul appel à `kDeLaFile`');

  // Le hook : K obligatoire, sans défaut (un appel qui l'oublierait ne compile pas).
  const hook = readFileSync('src/hooks/useArtifactOptimQueue.ts', 'utf8');
  ok(/\n\s*K: number;/.test(hook) && !/K = /.test(hook) && !/K\?:/.test(hook), 'hook : `K` obligatoire, sans valeur par défaut');
  ok(/prochainsATraiter\(trieesRef\.current, new Set\(cacheRef\.current\.keys\(\)\), K, pageRef\.current\(\)\)/.test(hook),
    'hook : la file sert `prochainsATraiter` avec ce K');

  // Le CLI : le contexte de la recherche lancée (`params.relicContext`).
  const cli = readFileSync('scripts/lib/classementCli.ts', 'utf8');
  ok(/const K = kDeLaFile\(e\.params\.relicContext\);/.test(cli), 'CLI : `K = kDeLaFile(e.params.relicContext)`');
  ok(/prochainsATraiter\(e\.base, new Set\(parBuild\.keys\(\)\), K, page\)/.test(cli), 'CLI : la file du CLI sert `prochainsATraiter` avec ce K');

  // Aucun autre appel de production ne choisit sa taille de file à la main.
  const appels = [ecran, hook, cli, readFileSync('scripts/optimizer-search.ts', 'utf8')]
    .flatMap((s) => s.match(/prochainsATraiter\([^)]*\)[^;]*;/g) ?? []);
  ok(appels.every((a) => !/K_BUILDS_OPTIMISES|\b100\b|\b300\b/.test(a)), `aucun appel de \`prochainsATraiter\` à taille écrite en dur (${appels.length} appel(s))`);
}
