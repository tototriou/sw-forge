// La file vise K combinaisons CONFIRMÉES
// (`prochainsATraiter`, artifactQueue.ts) : elle parcourt l'ordre de base et
// continue au-delà des écartés (`conforme: false`), jusqu'à K builds résolus ET
// conformes ou jusqu'au dernier build trouvé — plus seulement les K premiers.
//
// Attentes écrites contre le CACHE et l'ordre de base, jamais contre la
// formule de la fonction : « tout build avant la K-ième confirmée est résolu »,
// « aucun build après elle ne l'est (hors page) ». La boucle simulée est celle
// du hook — un build par tranche, le premier restant —, sans navigateur.

import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { cleBuild, prochainsATraiter } from '../src/lib/artifactQueue';
import { egal, ok, titre } from './outils';

const build = (id: number) => ({ runeIds: [id] }) as unknown as BuildCandidate;
const ids = (xs: readonly BuildCandidate[]) => xs.map(cleBuild);
const ordre = (n: number) => Array.from({ length: n }, (_, i) => build(i + 1));
type Cache = Map<string, { conforme: boolean }>;
// `[id, conforme]` → le cache de la file.
const cacheDe = (...entrees: [number, boolean][]): Cache => new Map(entrees.map(([id, conforme]) => [String(id), { conforme }]));

// Générateur déterministe (mulberry32) : les tirages se rejouent à l'identique.
function alea(graine: number) {
  let s = graine >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * La boucle du hook, rejouée : à chaque tranche, le premier restant est résolu
 * (verdict tiré d'avance), jusqu'à ce que la file soit vide. Rend le cache et
 * l'ordre de résolution.
 */
function derouler(base: BuildCandidate[], verdict: Map<string, boolean>, K: number, page: BuildCandidate[] = []) {
  const cache: Cache = new Map();
  const resolus: string[] = [];
  for (let pas = 0; pas <= base.length + page.length; pas++) {
    const suivant = prochainsATraiter(base, cache, K, page)[0];
    if (!suivant) break;
    const cle = cleBuild(suivant);
    cache.set(cle, { conforme: verdict.get(cle)! });
    resolus.push(cle);
  }
  return { cache, resolus };
}

export function testFileConfirmees() {
  titre('File de résolution — elle vise K confirmées, plus les K premiers (6bis-b18)');

  {
    const triees = ordre(10);
    egal(ids(prochainsATraiter(triees, cacheDe(), 3)), ['1', '2', '3'], 'rien de résolu : les 3 premiers, comme avant');
    egal(ids(prochainsATraiter(triees, cacheDe([1, true], [2, true], [3, true]), 3)), [], '3 confirmées sur les 3 premiers : la file s’arrête à K');
    // Le cœur du lot : deux écartés ne comptent pas, la file continue.
    egal(ids(prochainsATraiter(triees, cacheDe([1, true], [2, false], [3, false]), 3)), ['4', '5'],
      'la file continue au-delà des écartés : 1 confirmée, 2 écartées → les 4ᵉ et 5ᵉ, pour viser 3 confirmées');
    egal(ids(prochainsATraiter(triees, cacheDe([1, true], [2, false], [3, false], [4, true], [5, false]), 3)), ['6'],
      '2 confirmées sur 5 : il en manque une, le 6ᵉ suit');
    egal(ids(prochainsATraiter(triees, cacheDe([1, true], [2, false], [3, false], [4, true], [5, false], [6, true]), 3)), [],
      '3ᵉ confirmée au 6ᵉ rang : la file s’arrête, le 7ᵉ n’est pas repêché');
    egal(ids(prochainsATraiter(triees, cacheDe([1, false], [2, false]), 3)), ['3', '4', '5'],
      'les deux premiers écartés : la fenêtre glisse de deux rangs, trois non résolus à vérifier');
  }

  titre('File de résolution — épuisement : jusqu’au dernier build trouvé');

  {
    const triees = ordre(5);
    egal(ids(prochainsATraiter(triees, cacheDe([1, false], [2, false], [3, false]), 3)), ['4', '5'],
      'tout est écarté jusqu’ici : la file va jusqu’au dernier build trouvé');
    const toutEcarte = cacheDe([1, false], [2, false], [3, false], [4, false], [5, false]);
    egal(prochainsATraiter(triees, toutEcarte, 3), [], 'tout vérifié, aucune confirmée : plus rien à faire (pas de boucle sans fin)');
    egal(prochainsATraiter([], cacheDe(), 3), [], 'aucun build trouvé : rien');
  }

  titre('File de résolution — la page passe d’abord, les écartés d’une autre recherche ne comptent pas');

  {
    const triees = ordre(6);
    egal(ids(prochainsATraiter(triees, cacheDe([1, false]), 2, [build(40), build(3)])), ['40', '3', '2'],
      'page d’abord (40, 3), puis la fenêtre : 1 écarté, 2 et 3 non résolus — 3 déjà pris par la page, pas deux fois');
    // Un rejet resté en cache d'une recherche précédente, pour un build absent
    // de celle-ci, ne change pas la fenêtre.
    egal(ids(prochainsATraiter(triees, cacheDe([99, false], [98, true]), 2)), ['1', '2'],
      'les entrées du cache hors de l’ordre de base ne comptent pas, ni écartées ni confirmées');
  }

  titre('File de résolution — la boucle du hook, sur 300 tirages (graine fixe)');

  {
    const tirer = alea(18);
    const fautes = new Map<string, number>();
    const faute = (f: string) => fautes.set(f, (fautes.get(f) ?? 0) + 1);
    let auDela = 0;
    for (let t = 0; t < 300; t++) {
      const n = Math.floor(tirer() * 120);
      const K = 1 + Math.floor(tirer() * 40);
      const taux = tirer();
      const base = ordre(n);
      const verdict = new Map(base.map((c) => [cleBuild(c), tirer() < taux] as const));
      const { cache, resolus } = derouler(base, verdict, K);
      const conformes = base.filter((c) => verdict.get(cleBuild(c))).length;
      const confirmees = base.filter((c) => cache.get(cleBuild(c))?.conforme === true).length;
      if (confirmees !== Math.min(K, conformes)) faute('confirmées ≠ min(K, conformes de la recherche)');
      // La K-ième confirmée dans l'ordre de base (ou la fin) : tout avant est
      // résolu, rien après.
      let vues = 0;
      let fin = n;
      for (let i = 0; i < n; i++) {
        if (verdict.get(cleBuild(base[i]!))) vues++;
        if (vues === K) {
          fin = i + 1;
          break;
        }
      }
      if (base.slice(0, fin).some((c) => !cache.has(cleBuild(c)))) faute('un build avant la K-ième confirmée n’est pas résolu');
      if (base.slice(fin).some((c) => cache.has(cleBuild(c)))) faute('un build après la K-ième confirmée est résolu (sans page)');
      if (resolus.join('|') !== ids(base.slice(0, fin)).join('|')) faute('ordre de résolution ≠ ordre de base');
      if (fin > K) auDela++;
    }
    egal([...fautes.entries()], [], '300 tirages (taux de conformité, K et taille au hasard) : K confirmées ou tout l’ordre de base, tout avant résolu, rien après, dans l’ordre');
    ok(auDela > 100, `la file est allée au-delà des K premiers dans ${auDela} tirages sur 300 (écartés présents)`);
  }

  {
    // Le cas Kinki (b16 : 84 conformes sur 505 vérifiés, ~17 %) : 1 100 builds,
    // K = 300 — jamais atteint, la file vérifie tout.
    const tirer = alea(505);
    const base = ordre(1100);
    const verdict = new Map(base.map((c) => [cleBuild(c), tirer() < 0.17] as const));
    const { cache } = derouler(base, verdict, 300);
    const conformes = [...verdict.values()].filter(Boolean).length;
    egal([cache.size, [...cache.values()].filter((r) => r.conforme).length], [1100, conformes],
      `~17 % de conformes (${conformes} sur 1 100), K = 300 jamais atteint : les 1 100 vérifiés, ${conformes} confirmées`);
    // Témoin de l'ancienne règle (K premiers) : seulement 300 vérifiés.
    egal(base.slice(0, 300).filter((c) => verdict.get(cleBuild(c))).length < 300, true,
      'témoin : les 300 premiers seuls n’auraient pas donné 300 confirmées');
  }
}
