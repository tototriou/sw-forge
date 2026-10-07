// Une carte n'apparaît qu'une fois vérifiée
// (`compositionDePage`, artifactQueue.ts) : la page montre les builds VÉRIFIÉS
// (résolus et conformes) seuls, dans l'ordre du classement réel, puis des
// places « Vérification… » jusqu'à ce que la page attend ; la file résout
// d'abord les builds qui rempliront ces places, puis les K premiers.
//
// Le classement vient de la vraie `classementResolu` et la file du vrai
// `prochainsATraiter`, comme à l'écran. Le dépôt n'a pas d'infrastructure de
// test React : le branchement de l'écran se contrôle sur la source.

import { readFileSync } from 'node:fs';
import { BuildCandidate, OptionsDeClassement, aurasPropresParRunes, sortCandidates } from '../src/lib/runeBuildOptim';
import {
  CompositionDePage,
  ResultatArtefacts,
  classementResolu,
  cleBuild,
  compositionDePage,
  prochainsATraiter,
  voieDeLaFile,
} from '../src/lib/artifactQueue';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const PAGE = 20;
const OPTIONS: OptionsDeClassement = { aurasPropresDe: aurasPropresParRunes(new Map()) };

function stats(atk: number): StatRow[] {
  return [{ key: 'atk', label: 'ATQ', base: atk, bonus: 0, total: atk, suffix: '' }];
}
function candidat(id: number, atk = 10_000 - id): BuildCandidate {
  return { runeIds: [id], stats: stats(atk), effTotal: 0 };
}
function resultat(conforme: boolean, atk: number): ResultatArtefacts {
  return { paire: null, artefacts: [], stats: stats(atk), meilleurSansVerrous: null, conforme };
}
const cles = (xs: readonly BuildCandidate[]) => xs.map(cleBuild);

// Le chemin de l'écran : ordre de base, cache de la file, classement affiché,
// puis la composition de la page.
function ecran(
  recus: BuildCandidate[],
  cache: Map<string, ResultatArtefacts> | null,
  page: number
): { affichees: BuildCandidate[]; compo: CompositionDePage } {
  const base = sortCandidates(recus, 'atk', OPTIONS);
  const affichees = classementResolu(base, cache ?? new Map(), 'atk', OPTIONS);
  return { affichees, compo: compositionDePage({ classement: affichees, parBuild: cache, page, taillePage: PAGE }) };
}

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

// Les propriétés d'une composition, vérifiées contre le cache — jamais contre
// la formule de la fonction : une carte est vérifiée, un écarté n'est nulle
// part, les places sont bornées, les cartes sont les vérifiés de la page.
function violations(affichees: BuildCandidate[], cache: Map<string, ResultatArtefacts>, page: number, compo: CompositionDePage): string[] {
  const v: string[] = [];
  const debut = (page - 1) * PAGE;
  const etat = (c: BuildCandidate) => cache.get(cleBuild(c));
  if (compo.cartes.some((c) => etat(c)?.conforme !== true)) v.push('carte non vérifiée');
  if ([...compo.cartes, ...compo.aVerifier].some((c) => etat(c)?.conforme === false)) v.push('écarté présent');
  if (compo.aVerifier.some((c) => etat(c) !== undefined)) v.push('à vérifier déjà résolu');
  if (compo.placesEnAttente < 0 || compo.cartes.length + compo.placesEnAttente > PAGE) v.push('places hors bornes');
  if (compo.premierRang !== debut + 1) v.push('premier rang');
  const verifies = affichees.filter((c) => etat(c)?.conforme === true);
  if (cles(compo.cartes).join('|') !== cles(verifies.slice(debut, debut + PAGE)).join('|')) v.push('cartes ≠ vérifiés de la page');
  const attendues = Math.min(PAGE, Math.max(0, affichees.length - debut));
  if (compo.cartes.length + compo.placesEnAttente !== attendues) v.push('cartes + places ≠ places attendues');
  const nonResolus = affichees.filter((c) => etat(c) === undefined);
  if (compo.placesEnAttente > 0 && nonResolus.length > 0) {
    if (compo.aVerifier.length === 0) v.push('places en attente sans build à vérifier');
    if (cles(compo.aVerifier).join('|') !== cles(nonResolus.slice(0, compo.aVerifier.length)).join('|')) v.push('à vérifier ≠ premiers non résolus');
  }
  if (compo.placesEnAttente === 0 && compo.aVerifier.length > 0) v.push('page complète mais builds à vérifier');
  if (compo.aVerifier.length > PAGE) v.push('plus d’une page à vérifier');
  return v;
}

export function testCompositionDePage() {
  titre('Composition de la page — une carte n’apparaît qu’une fois vérifiée (6bis-b16)');

  {
    // Page 1 au début d'une recherche : rien n'est résolu.
    const recus = Array.from({ length: 30 }, (_, i) => candidat(i + 1));
    const { affichees, compo } = ecran(recus, new Map(), 1);
    egal(compo.cartes.length, 0, 'rien de résolu : aucune carte');
    egal(compo.placesEnAttente, 20, 'rien de résolu : 20 places « Vérification… » (la page entière, réservée)');
    egal(cles(compo.aVerifier), cles(affichees.slice(0, 20)), 'les 20 premiers du classement sont à vérifier en priorité');
  }
  {
    // 12 vérifiés, 3 écartés, 5 non résolus dans les 20 premiers ; 10 de plus en attente.
    const recus = Array.from({ length: 30 }, (_, i) => candidat(i + 1));
    const cache = new Map<string, ResultatArtefacts>();
    recus.slice(0, 12).forEach((c) => cache.set(cleBuild(c), resultat(true, 20_000 - c.runeIds[0]!)));
    recus.slice(12, 15).forEach((c) => cache.set(cleBuild(c), resultat(false, 0)));
    const { compo } = ecran(recus, cache, 1);
    egal(compo.cartes.length, 12, '12 vérifiés : 12 cartes');
    ok(compo.cartes.every((c) => cache.get(cleBuild(c))?.conforme === true), 'chaque carte est résolue ET conforme');
    egal(compo.placesEnAttente, 8, '27 affichables : 8 places en attente après les 12 cartes');
    egal(cles(compo.aVerifier), cles(recus.slice(15, 23)), 'à vérifier : les 8 premiers non résolus, dans l’ordre du classement');
    ok(!compo.cartes.concat(compo.aVerifier).some((c) => cache.get(cleBuild(c))?.conforme === false), 'aucun des 3 écartés n’est ni carte ni à vérifier');
  }
  {
    // Le constat Kinki : 1 trouvé, d'abord non résolu, puis écarté.
    const kinki = candidat(1);
    const pendant = ecran([kinki], new Map(), 1).compo;
    egal([pendant.cartes.length, pendant.placesEnAttente, cles(pendant.aVerifier)], [0, 1, ['1']],
      'Kinki, non résolu : aucune carte, une place « Vérification… », le build à vérifier');
    const apres = ecran([kinki], new Map([[cleBuild(kinki), resultat(false, 0)]]), 1).compo;
    egal([apres.cartes.length, apres.placesEnAttente, apres.aVerifier.length], [0, 0, 0],
      'Kinki, écarté : ni carte, ni place, rien à vérifier — le build écarté n’a JAMAIS été montré');
  }
  {
    // Une page au-delà des vérifiés, après la recherche : 300 affichables, 95 vérifiés.
    const recus = Array.from({ length: 300 }, (_, i) => candidat(i + 1));
    const cache = new Map<string, ResultatArtefacts>();
    recus.slice(0, 95).forEach((c) => cache.set(cleBuild(c), resultat(true, 20_000 - c.runeIds[0]!)));
    const p10 = ecran(recus, cache, 10).compo;
    egal([p10.cartes.length, p10.placesEnAttente, p10.premierRang], [0, 20, 181], 'page 10 au-delà des 95 vérifiés : 20 places en attente, rangs 181 à 200');
    egal(cles(p10.aVerifier), cles(recus.slice(95, 115)), 'page 10 : la file vérifie les 20 premiers non résolus (au plus une page à la fois)');
    const p5 = ecran(recus, cache, 5).compo;
    egal([p5.cartes.length, p5.placesEnAttente, p5.aVerifier.length], [15, 5, 5], 'page 5 : les vérifiés 81 à 95, puis 5 places');
  }
  {
    // Dernière page incomplète, tout vérifié.
    const recus = Array.from({ length: 45 }, (_, i) => candidat(i + 1));
    const cache = new Map(recus.map((c) => [cleBuild(c), resultat(true, 20_000 - c.runeIds[0]!)] as const));
    const p3 = ecran(recus, cache, 3).compo;
    egal([p3.cartes.length, p3.placesEnAttente, p3.aVerifier.length], [5, 0, 0], 'dernière page, tout vérifié : 5 cartes, aucune place');
    const p4 = ecran(recus, cache, 4).compo;
    egal([p4.cartes.length, p4.placesEnAttente, p4.aVerifier.length], [0, 0, 0], 'page au-delà de la dernière (transitoire) : vide, rien à vérifier');
  }
  {
    // Un écarté glissé dans le classement (hors `classementResolu`) reste ignoré.
    const [a, b, c] = [candidat(1), candidat(2), candidat(3)];
    const cache = new Map([[cleBuild(a), resultat(false, 0)], [cleBuild(c), resultat(true, 5)]]);
    const compo = compositionDePage({ classement: [a, b, c], parBuild: cache, page: 1, taillePage: PAGE });
    egal([cles(compo.cartes), compo.placesEnAttente, cles(compo.aVerifier)], [['3'], 1, ['2']],
      'un écarté passé directement : ni carte, ni place, ni à vérifier');
  }

  titre('Composition de la page — sans file, rien ne change');

  {
    const recus = Array.from({ length: 45 }, (_, i) => candidat(i + 1));
    for (const page of [1, 2, 3]) {
      const { affichees, compo } = ecran(recus, null, page);
      egal([cles(compo.cartes), compo.placesEnAttente, compo.aVerifier.length], [cles(affichees.slice((page - 1) * PAGE, page * PAGE)), 0, 0],
        `optimisation d’artéfacts coupée, page ${page} : la tranche du classement, comme avant, aucune place`);
    }
  }

  titre('Composition de la page — propriétés sur 400 tirages (graine fixe)');

  {
    const tirer = alea(16);
    let tirages = 0;
    const fautes = new Map<string, number>();
    for (let t = 0; t < 400; t++) {
      const n = Math.floor(tirer() * 90);
      const recus = Array.from({ length: n }, (_, i) => candidat(i + 1, 1000 + Math.floor(tirer() * 5000)));
      const cache = new Map<string, ResultatArtefacts>();
      for (const c of recus) {
        const x = tirer();
        if (x < 0.4) continue;
        cache.set(cleBuild(c), resultat(x < 0.75, c.stats[0]!.total + Math.floor(tirer() * 400)));
      }
      const page = 1 + Math.floor(tirer() * (Math.ceil(n / PAGE) + 1));
      const { affichees, compo } = ecran(recus, cache, page);
      tirages++;
      for (const f of violations(affichees, cache, page, compo)) fautes.set(f, (fautes.get(f) ?? 0) + 1);
    }
    egal([...fautes.entries()], [], `${tirages} tirages (builds non résolus, vérifiés, écartés ; page au hasard) : aucune carte non vérifiée, aucun écarté, places bornées, cartes = vérifiés de la page, à vérifier = premiers non résolus`);
  }

  titre('Composition de la page — la file remplit d’abord les places en attente, puis les K premiers');

  {
    // Une recherche finie, résultats durs (3 builds sur 10 conformes), K = 100.
    const tirer = alea(7);
    // 1 000 builds : environ 300 conformes, assez pour remplir la page 8 (rangs 141 à 160).
    const recus = Array.from({ length: 1000 }, (_, i) => candidat(i + 1));
    const issue = new Map(recus.map((c) => [cleBuild(c), tirer() < 0.3] as const));
    const base = sortCandidates(recus, 'atk', OPTIONS);
    const K = 100;
    const cache = new Map<string, ResultatArtefacts>();
    const resoudre = (c: BuildCandidate) => cache.set(cleBuild(c), resultat(issue.get(cleBuild(c))!, c.stats[0]!.total + 50));
    const composer = (page: number) => compositionDePage({ classement: classementResolu(base, cache, 'atk', OPTIONS), parBuild: cache, page, taillePage: PAGE });

    // Page 1 : tant que des places attendent, le prochain build est l'un d'eux, par la voie de la page.
    let priorite = true;
    let voiePage = true;
    let pas = 0;
    for (; pas < 1000; pas++) {
      const compo = composer(1);
      const restants = prochainsATraiter(base, cache, K, compo.aVerifier);
      if (restants.length === 0) break;
      if (compo.placesEnAttente > 0) {
        if (cleBuild(restants[0]!) !== cleBuild(compo.aVerifier[0]!)) priorite = false;
        if (voieDeLaFile(restants, compo.aVerifier, cache) !== 'page') voiePage = false;
      }
      resoudre(restants[0]!);
    }
    ok(priorite, 'page 1 : tant que des places attendent, la file résout d’abord les builds qui les rempliront');
    ok(voiePage, 'page 1 : ces builds passent par la voie de la page (`voieDeLaFile`)');
    const p1 = composer(1);
    egal([p1.cartes.length, p1.placesEnAttente], [20, 0], 'page 1 complète, 20 cartes vérifiées');
    ok(base.slice(0, K).every((c) => cache.has(cleBuild(c))), 'puis les K premiers de l’ordre de base sont tous résolus, comme avant');
    const conformesK = base.slice(0, K).filter((c) => issue.get(cleBuild(c))).length;
    ok(conformesK < 7 * PAGE, `après les K premiers, ${conformesK} vérifiés : la page 8 est au-delà`);

    // La page 8, au-delà des vérifiés : elle montre ses places, et se résout quand on l'ouvre.
    const avant = composer(8);
    egal([avant.cartes.length, avant.placesEnAttente], [0, 20], 'page 8 à l’ouverture : 20 places « Vérification… »');
    let ouvertures = 0;
    let horsPage = 0;
    for (let i = 0; i < 2000; i++) {
      const compo = composer(8);
      const restants = prochainsATraiter(base, cache, K, compo.aVerifier);
      if (restants.length === 0) break;
      if (!compo.aVerifier.some((c) => cleBuild(c) === cleBuild(restants[0]!))) horsPage++;
      resoudre(restants[0]!);
      ouvertures++;
    }
    const apres = composer(8);
    egal([apres.cartes.length, apres.placesEnAttente], [20, 0], `page 8 complète après ${ouvertures} résolutions`);
    egal(horsPage, 0, 'page 8 : chacune de ces résolutions venait des builds à vérifier de la page (les K premiers étant faits)');
    ok(apres.cartes.every((c) => issue.get(cleBuild(c)) === true), 'page 8 : chaque carte est conforme');
  }

  titre('Composition de la page — aucun va-et-vient pendant une recherche simulée');

  {
    // Les candidats arrivent par paquets (aperçu qui grandit), la file résout
    // pendant ce temps, chaque pas est une publication. Une carte qui quitte la
    // page 1 n'a le droit de le faire que DÉPLACÉE par de meilleurs vérifiés —
    // jamais retirée faute de conformité. L'ancienne page (la tranche du
    // classement) sert de témoin : elle, retire.
    const tirer = alea(2026);
    const tous = Array.from({ length: 600 }, (_, i) => candidat(i + 1, 1000 + Math.floor(tirer() * 9000)));
    const issue = new Map(tous.map((c) => [cleBuild(c), tirer() < 0.25] as const));
    const gain = new Map(tous.map((c) => [cleBuild(c), Math.floor(tirer() * 600)] as const));
    const cache = new Map<string, ResultatArtefacts>();
    const K = 100;
    let recus: BuildCandidate[] = [];
    let avantNouveau: string[] = [];
    let avantAncien: string[] = [];
    let retireesNouveau = 0;
    let retireesNouveauHorsDeplacement = 0;
    let retireesAncien = 0;
    let retireesAncienEcartees = 0;
    let ecarteMontre = 0;
    for (let pas = 0; pas < 900; pas++) {
      if (pas % 10 === 0 && recus.length < tous.length) recus = tous.slice(0, recus.length + 40);
      const base = sortCandidates(recus, 'atk', OPTIONS);
      const affichees = classementResolu(base, cache, 'atk', OPTIONS);
      const compo = compositionDePage({ classement: affichees, parBuild: cache, page: 1, taillePage: PAGE });
      const nouveau = cles(compo.cartes);
      const ancien = cles(affichees.slice(0, PAGE));
      const verifies = cles(affichees.filter((c) => cache.get(cleBuild(c))?.conforme === true));
      for (const k of avantNouveau) {
        if (nouveau.includes(k)) continue;
        retireesNouveau++;
        if (cache.get(k)?.conforme !== true || verifies.indexOf(k) < PAGE) retireesNouveauHorsDeplacement++;
      }
      for (const k of avantAncien) {
        if (ancien.includes(k)) continue;
        retireesAncien++;
        if (cache.get(k)?.conforme === false) retireesAncienEcartees++;
      }
      ecarteMontre += nouveau.filter((k) => issue.get(k) === false).length;
      avantNouveau = nouveau;
      avantAncien = ancien;
      const restants = prochainsATraiter(base, cache, K, compo.aVerifier);
      const suivant = restants[0];
      if (!suivant) continue;
      const k = cleBuild(suivant);
      cache.set(k, resultat(issue.get(k)!, suivant.stats[0]!.total + gain.get(k)!));
    }
    egal(retireesNouveauHorsDeplacement, 0, `nouvelle page : ${retireesNouveau} carte(s) sorties de la page 1, toutes déplacées par de meilleurs vérifiés (aucune retirée faute de conformité)`);
    egal(ecarteMontre, 0, 'nouvelle page : un build finalement écarté n’est jamais apparu');
    ok(retireesAncienEcartees > 0, `témoin, ancienne page : ${retireesAncienEcartees} carte(s) apparues puis retirées à la résolution (${retireesAncien} sorties en tout) — le défaut corrigé`);
  }

  titre('Composition de la page — l’écran la lit, et la file reçoit ses builds à vérifier');

  const brut = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8').replace(/\r\n/g, '\n');
  const src = brut.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(/const composition = useMemo\(\s*\(\) =>\s*compositionDePage\(\{\s*classement: affichees,\s*parBuild: resoudreEquipement != null \? fileArtefacts\.parBuild : null,\s*page: resultsPage,\s*taillePage: RESULTS_PAGE_SIZE,\s*\}\),\s*\[affichees, resoudreEquipement, fileArtefacts\.parBuild, resultsPage\]\s*\);/.test(src),
    'écran : `composition` vient du classement affiché et du cache publié (null sans file), page courante');
  egal((src.match(/compositionDePage\(/g) ?? []).length, 1, 'écran : un seul appel à `compositionDePage`');
  ok(/pageAfficheeRef\.current = composition\.aVerifier;/.test(src), 'file : la « page affichée » qu’elle sert en priorité est `composition.aVerifier`');
  egal((src.match(/pageAfficheeRef\.current = /g) ?? []).length, 1, 'file : une seule écriture de la page qu’elle sert');
  ok(/\{composition\.cartes\.map\(\(c, i\) => \(\s*<BuildCandidateCard\s+key=\{c\.runeIds\.join\('-'\)\}\s+rank=\{composition\.premierRang \+ i\}/.test(src),
    'grille : les cartes sont `composition.cartes`, rang compté depuis `premierRang`');
  ok(/Array\.from\(\{ length: composition\.placesEnAttente \}, \(_, j\) => \(\s*<PlaceEnVerification/.test(src),
    'grille : autant de places « Vérification… » que `composition.placesEnAttente`');
  ok(!/pageCandidates|affichees\.slice\(/.test(src), 'écran : plus aucune page découpée à la main dans le classement');
  ok(!/paireProvisoire/.test(src), 'écran : plus de carte « artéfacts pas encore optimisés » — une carte affichée est vérifiée');
  ok(/fileArtefacts\.enAttente > 0\s*\?\s*`\$\{fileArtefacts\.enAttente\.toLocaleString\('fr-FR'\)\} combinaison\(s\) en vérification…`\s*:\s*'( |\\u00a0)'/.test(src),
    'compte : une ligne dit combien sont en vérification (le reste de la file), sa place réservée');

  const carte = readFileSync('src/components/outils/BuildCandidateCard.tsx', 'utf8').replace(/\r\n/g, '\n');
  const place = carte.slice(carte.indexOf('export function PlaceEnVerification'), carte.indexOf('export function useHauteurDesCartes'));
  ok(place.length > 0 && />Vérification…</.test(place), 'place en attente : « Vérification… »');
  ok(!/\b(red|green|blue|amber|emerald|sky|slate|gray|zinc|neutral|stone|orange|yellow|lime|teal|cyan|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/.test(place),
    'place en attente : aucune couleur Tailwind native, des tokens seulement');
  ok(/data-carte-resultat/.test(carte), 'carte : marquée pour la mesure de sa hauteur (place réservée à la même hauteur)');
}
