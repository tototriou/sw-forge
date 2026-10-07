// La voie de la file de résolution (`voieDeLaFile`,
// artifactQueue.ts) : tant que la page affichée contient un build non résolu,
// la tranche suivante part par une tâche IMMÉDIATE ; sinon, l'avance de fond
// (les K premiers) attend l'inactivité, comme avant ; rien à traiter, rien
// n'est planifié.
//
// Les restants viennent du vrai `prochainsATraiter`, jamais d'une liste écrite
// à la main : la voie testée est celle que le hook calcule. Le dépôt n'a pas
// d'infrastructure de test React : le hook (`useArtifactOptimQueue`) se
// contrôle sur la source ; le délai réel au navigateur ne se mesure pas ici.

import { readFileSync } from 'node:fs';
import { BuildCandidate } from '../src/lib/runeBuildOptim';
import { VoieDeLaFile, cleBuild, prochainsATraiter, voieDeLaFile } from '../src/lib/artifactQueue';
import { egal, ok, titre } from './outils';

const build = (...runeIds: number[]) => ({ runeIds }) as unknown as BuildCandidate;
// Le cache du hook est une `Map` (clé → résultat) : des résultats conformes ici,
// la conformité ne changeant la fenêtre que pour un écarté.
type Cache = Map<string, { conforme: boolean }>;
const cache = (...cles: string[]): Cache => new Map(cles.map((c) => [c, { conforme: true }]));

// Un bloc de code du hook, de sa déclaration à sa fermeture au même retrait.
function bloc(src: string, debut: string, fin: string): string {
  const i = src.indexOf(debut);
  if (i < 0) return '';
  const j = src.indexOf(fin, i + debut.length);
  return j < 0 ? '' : src.slice(i, j + fin.length);
}

export function testVoieDeLaFile() {
  titre('File de résolution — la voie de la prochaine tranche (6bis-b11)');

  const triees = [build(1), build(2), build(3), build(4), build(5)];
  const K = 3;
  const voie = (page: BuildCandidate[], deja: Cache) =>
    voieDeLaFile(prochainsATraiter(triees, deja, K, page), page, deja);

  egal(voie([build(1), build(2)], cache()), 'page', 'page avec des builds non résolus : voie prioritaire');
  egal(voie([build(1), build(2)], cache('1')), 'page', 'un seul build non résolu sur la page suffit');
  egal(voie([build(40), build(41)], cache('1', '2', '3')), 'page', 'page profonde, hors des K premiers, non résolue : voie prioritaire, même les K finis');
  egal(voie([build(1), build(2)], cache('1', '2')), 'fond', 'page entièrement résolue, K premiers à finir : voie de fond');
  egal(voie([], cache()), 'fond', 'page vide, K premiers à traiter : voie de fond');
  egal(voie([build(1)], cache('1', '2', '3')), 'aucune', 'page et K premiers résolus : aucune tâche');
  egal(voie([], cache('1', '2', '3')), 'aucune', 'page vide et K premiers résolus : aucune tâche');
  egal(voieDeLaFile([], [], new Map()), 'aucune', 'aucun candidat : aucune tâche');
  egal(voieDeLaFile([build(9)], [build(9)], new Set<string>()), 'page', 'le cache se lit par `has` : un `Set` vaut une `Map`');

  titre('File de résolution — la voie prioritaire bornée à la page, le travail total inchangé');

  {
    // La boucle des tranches, rejouée sans navigateur : une tranche résout le
    // premier restant, puis la voie suivante se calcule sur `restants.slice(1)`
    // (le cache n'a grandi que de ce build — vérifié à chaque pas).
    const page = [build(40), build(41), build(2), build(42)];
    const deja = cache();
    const voies: VoieDeLaFile[] = [];
    const ordre: string[] = [];
    const forcees: string[] = [];
    let sliceFidele = true;
    for (let pas = 0; pas < 50; pas++) {
      const restants = prochainsATraiter(triees, deja, K, page);
      const v = voieDeLaFile(restants, page, deja);
      const suivant = restants[0];
      if (v === 'aucune' || !suivant) break;
      voies.push(v);
      deja.set(cleBuild(suivant), { conforme: true });
      ordre.push(cleBuild(suivant));
      const reste = restants.slice(1);
      const recalcule = prochainsATraiter(triees, deja, K, page);
      if (reste.map(cleBuild).join('|') !== recalcule.map(cleBuild).join('|')) sliceFidele = false;
      const apres = voieDeLaFile(reste, page, deja);
      if (apres === 'aucune' || (v === 'page' && apres !== 'page')) forcees.push(cleBuild(suivant));
    }
    egal(voies, ['page', 'page', 'page', 'page', 'fond', 'fond'], 'une tâche immédiate par build non résolu de la page (4), puis le fond');
    egal(ordre, prochainsATraiter(triees, cache(), K, page).map(cleBuild), 'même travail, même ordre : exactement `prochainsATraiter`, chacun une fois');
    ok(sliceFidele, 'après une tranche conforme, `restants.slice(1)` est la file recalculée');
    egal(forcees, ['42', '3'], 'publication forcée au dernier build de la page, puis au dernier de la file');
  }

  {
    // Le piège : la page acquiert des builds non résolus pendant qu'une
    // tranche de fond attend (changement de page, nouveaux candidats).
    const deja = cache('1', '2');
    egal(voie([build(1), build(2)], deja), 'fond', 'piège — avant : page résolue, une tranche de fond est programmée');
    egal(voie([build(60), build(61)], deja), 'page', 'piège — l’utilisateur change de page : la voie demandée devient la page');
    egal(voie([build(1), build(2), build(7)], deja), 'page', 'piège — un nouveau candidat entre dans la page : idem');
  }

  titre('File de résolution — le hook, contrôlé sur la source');

  // Fins de ligne ramenées à `\n` (le hook est en CRLF), puis sans les
  // commentaires : seul le code compte.
  const brut = readFileSync('src/hooks/useArtifactOptimQueue.ts', 'utf8').replace(/\r\n/g, '\n');
  const hook = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  const immediat = bloc(hook, 'function planifierImmediat(', '\n}\n');
  const inactif = bloc(hook, 'function planifierInactif(', '\n}\n');
  ok(immediat.length > 0 && inactif.length > 0, 'les deux planificateurs existent');
  ok(!/requestIdleCallback/.test(immediat) && /MessageChannel/.test(immediat),
    'voie prioritaire : `MessageChannel` (repli `setTimeout`), jamais `requestIdleCallback`');
  ok(/requestIdleCallback\(faire, \{ timeout: 1000 \}\)/.test(inactif), 'voie de fond : `requestIdleCallback`, comme avant');
  egal((hook.match(/requestIdleCallback\(/g) ?? []).length, 1, '`requestIdleCallback` n’est appelé qu’à un endroit, la voie de fond');

  egal((hook.match(/\blet planifie\b/g) ?? []).length, 1, 'une seule tâche en attente, toutes voies confondues');
  const reveiller = bloc(hook, 'const reveiller = () => {', '\n    };');
  ok(/voieDeLaFile\(aTraiter\(\), pageRef\.current\(\), cacheRef\.current\)/.test(reveiller), 'réveil : la voie vient de `voieDeLaFile`');
  ok(/if \(voie === 'aucune'\) \{[^}]*return setEnAttente\(0\);\s*\}/.test(reveiller), 'réveil : rien à traiter, rien de planifié');
  // Revue externe de la v1.14.0 : une relance de l'effet (K qui
  // change) trouvait la file vide sans publier les écritures retenues.
  ok(/if \(voie === 'aucune'\) \{\s*if \(nonPublieeRef\.current\) publier\(true\);/.test(reveiller),
    'réveil : file vide sur une écriture retenue → publication forcée, comme le chemin Worker');
  ok(/const nonPublieeRef = useRef\(false\);/.test(hook), 'le drapeau d’écriture retenue survit à une relance de l’effet (ref)');
  const publier = bloc(hook, 'const publier = (forcer: boolean) => {', '\n    };');
  ok(/nonPublieeRef\.current = true;\s*return;/.test(publier) && /nonPublieeRef\.current = false;\s*setParBuild/.test(publier),
    'publier : la cadence pose le drapeau, la publication le lève');
  ok(/if \(planifie && \(planifie\.voie === voie \|\| planifie\.voie === 'page'\)\) return;/.test(reveiller),
    'réveil idempotent : une tâche de même voie, ou de la page, déjà programmée suffit');
  ok(/planifie\?\.annuler\(\);[\s\S]*voie === 'page' \? planifierImmediat : planifierInactif/.test(reveiller),
    'piège : une tranche de fond en attente est ANNULÉE avant de replanifier en voie prioritaire');

  const tranche = bloc(hook, 'const tranche = () => {', '\n    };');
  egal((tranche.match(/faire\(suivant\)/g) ?? []).length, 1, 'tranche : un seul build résolu');
  ok(!/\bwhile\b|\bfor\s*\(/.test(tranche), 'tranche : aucune boucle qui garde le fil');
  ok(/const voieApres = voieDeLaFile\(restants\.slice\(1\), page, cacheRef\.current\);/.test(tranche)
    && /publier\(voieApres === 'aucune' \|\| \(voie === 'page' && voieApres !== 'page'\)\);/.test(tranche),
    'tranche : publication forcée au dernier build non résolu de la page (et au dernier de la file)');
  ok(/const PUBLICATION_MS = 400;/.test(hook), 'cadence de publication : 400 ms, inchangée');

  const nettoyage = bloc(hook, 'return () => {', '\n    };');
  ok(/vivant = false;[\s\S]*planifie\?\.annuler\(\);/.test(nettoyage), 'nettoyage : la tâche en attente est annulée, quelle que soit sa voie');
  ok(/\}, \[resoudre, signature, K\]\);/.test(hook) && !/triees\.length\]/.test(hook),
    'dépendances de l’effet inchangées : `triees.length` n’y revient pas');
}
