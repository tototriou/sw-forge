// degats-et-aura 6bis-b18 — le compte des combinaisons CONFIRMÉES
// (`compteConfirme`, artifactQueue.ts) : seulement les builds vérifiés (résolus
// et conformes) de CETTE recherche ; un compte qui ne baisse jamais pendant une
// recherche ; les pages des confirmées plus une tant qu'il reste des builds non
// vérifiés ; « Aucune combinaison… » seulement quand tout est vérifié sans
// aucune confirmée.
//
// Le classement vient de la vraie `classementResolu` et les pages de la vraie
// `compositionDePage`, comme à l'écran. Le dépôt n'a pas d'infrastructure de
// test React : l'en-tête, l'infobulle et les contrôles masqués se contrôlent
// sur la source.

import { readFileSync } from 'node:fs';
import { BuildCandidate, OptionsDeClassement, aurasPropresParRunes, sortCandidates } from '../src/lib/runeBuildOptim';
import { ResultatArtefacts, classementResolu, cleBuild, compositionDePage, compteAffichable, compteConfirme } from '../src/lib/artifactQueue';
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
const recus = (n: number) => Array.from({ length: n }, (_, i) => candidat(i + 1));
// `[id, conforme]` → le cache de la file.
const cacheDe = (...e: [number, boolean][]) => new Map(e.map(([id, conforme]) => [String(id), resultat(conforme, 20_000 - id)]));
const compter = (r: BuildCandidate[], cache: Map<string, ResultatArtefacts> | null, termine: boolean, trouves = r.length) =>
  compteConfirme({ recus: r, parBuild: cache, trouves, taillePage: PAGE, termine });

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

export function testCompteConfirme() {
  titre('Compte confirmé — seulement les builds vérifiés (6bis-b18)');

  {
    const r = recus(5);
    egal(compter(r, cacheDe(), false), { confirmees: 0, nonVerifies: 5, pages: 1, aucune: false }, 'rien de vérifié : 0 confirmée, 5 non vérifiés, une page');
    egal(compter(r, cacheDe([1, true], [2, false], [3, true]), false), { confirmees: 2, nonVerifies: 2, pages: 1, aucune: false },
      '2 conformes, 1 écarté, 2 en attente : 2 confirmées — ni l’écarté ni les non résolus');
    egal(compter(r, cacheDe([99, true], [98, false], [1, true]), false).confirmees, 1,
      'les entrées du cache hors des reçus (recherche précédente aux mêmes réglages) ne comptent pas');
  }

  titre('Compte confirmé — « Aucune combinaison… » seulement tout vérifié, sans confirmée');

  {
    const kinki = recus(1);
    egal(compter(kinki, cacheDe(), false).aucune, false, 'Kinki, pendant la recherche, non résolu : pas « Aucune »');
    egal(compter(kinki, cacheDe([1, false]), false).aucune, false, 'Kinki écarté, recherche en cours : pas « Aucune » (la recherche peut encore trouver)');
    egal(compter(kinki, cacheDe(), true).aucune, false, 'Kinki, recherche finie, pas encore vérifié : pas « Aucune »');
    egal(compter(kinki, cacheDe([1, false]), true), { confirmees: 0, nonVerifies: 0, pages: 1, aucune: true },
      'Kinki, recherche finie, écarté : tout est vérifié, aucune confirmée → « Aucune »');
    egal(compter(recus(3), cacheDe([1, false], [2, false]), true).aucune, false, '2 écartés sur 3, le 3ᵉ pas vérifié : pas encore « Aucune »');
    egal(compter([], cacheDe(), true).aucune, true, 'moteur vide : « Aucune » (les diagnostics gardent leur condition)');
    egal(compter(recus(3), cacheDe([1, false], [2, true], [3, false]), true).aucune, false, 'une confirmée : jamais « Aucune »');
  }

  titre('Compte confirmé — les pages : les confirmées, plus une tant qu’il reste des non vérifiés');

  {
    // C confirmées, U non vérifiés (et quelques écartés, sans effet).
    const pages = (C: number, U: number, E = 3) => {
      const r = recus(C + U + E);
      const cache = new Map<string, ResultatArtefacts>();
      r.slice(0, C).forEach((c) => cache.set(cleBuild(c), resultat(true, 20_000)));
      r.slice(C, C + E).forEach((c) => cache.set(cleBuild(c), resultat(false, 0)));
      return compter(r, cache, false).pages;
    };
    egal(pages(0, 0), 1, 'C = 0, U = 0 : 1');
    egal(pages(0, 5), 1, 'C = 0, U = 5 : 1 (la page des places « Vérification… »)');
    egal(pages(40, 0), 2, 'C = 40, U = 0 : 2');
    egal(pages(40, 1), 3, 'C = 40, U = 1 : 3 — une page de plus pour le non vérifié');
    egal(pages(45, 10), 3, 'C = 45, U = 10 : 3 — les 10 ont leur place sur la 3ᵉ, pas de page vide');
    egal(pages(45, 16), 4, 'C = 45, U = 16 : 4 — une page de plus, une seule');
    egal(pages(45, 500), 4, 'C = 45, U = 500 : 4 — jamais plus d’une page au-delà des confirmées');
    egal(pages(300, 4800), 16, '« Dégâts réels » : 300 confirmées sur 5 100 trouvées → 16 pages (au lieu de 255)');
  }

  {
    // Propriété, sur la vraie `compositionDePage` : aucune page vide, les
    // confirmées toutes atteignables dans l'ordre, la dernière porte des places
    // tant qu'il reste des non vérifiés.
    const tirer = alea(1818);
    const fautes = new Map<string, number>();
    const faute = (f: string) => fautes.set(f, (fautes.get(f) ?? 0) + 1);
    for (let t = 0; t < 300; t++) {
      const n = Math.floor(tirer() * 140);
      const r = Array.from({ length: n }, (_, i) => candidat(i + 1, 1000 + Math.floor(tirer() * 5000)));
      const cache = new Map<string, ResultatArtefacts>();
      const taux = tirer();
      for (const c of r) {
        if (tirer() < 0.35) continue;
        cache.set(cleBuild(c), resultat(tirer() < taux, c.stats[0]!.total + Math.floor(tirer() * 300)));
      }
      const base = sortCandidates(r, 'atk', OPTIONS);
      const affichees = classementResolu(base, cache, 'atk', OPTIONS);
      const compte = compter(base, cache, false);
      const cartes: string[] = [];
      for (let p = 1; p <= compte.pages; p++) {
        const compo = compositionDePage({ classement: affichees, parBuild: cache, page: p, taillePage: PAGE });
        if (affichees.length > 0 && compo.cartes.length + compo.placesEnAttente === 0) faute('page vide');
        cartes.push(...compo.cartes.map(cleBuild));
        if (p === compte.pages && compte.nonVerifies > 0 && compo.placesEnAttente === 0) faute('non vérifiés sans place sur la dernière page');
      }
      const verifies = affichees.filter((c) => cache.get(cleBuild(c))?.conforme === true).map(cleBuild);
      if (cartes.join('|') !== verifies.join('|')) faute('cartes des pages ≠ confirmées, dans l’ordre');
      if (cartes.length !== compte.confirmees) faute('nombre de cartes ≠ confirmées');
      if (compte.pages > Math.ceil(compte.confirmees / PAGE) + 1) faute('plus d’une page au-delà des confirmées');
    }
    egal([...fautes.entries()], [], '300 tirages (vraie `compositionDePage`) : aucune page vide, toutes les confirmées dans l’ordre, une page de places tant qu’il reste des non vérifiés, une seule au-delà');
  }

  titre('Compte confirmé — il ne baisse jamais pendant une recherche ; les trouvées, si');

  {
    // Les candidats arrivent par paquets (aperçu qui grandit), la file résout
    // pendant ce temps : le compte confirmé ne baisse jamais. Témoin : le
    // compte des trouvées (6bis-b10) baisse à chaque écarté découvert.
    const tirer = alea(2018);
    const tous = recus(600);
    const issue = new Map(tous.map((c) => [cleBuild(c), tirer() < 0.2] as const));
    const cache = new Map<string, ResultatArtefacts>();
    let r: BuildCandidate[] = [];
    let avant = 0;
    let baisses = 0;
    let baissesTrouvees = 0;
    let avantTrouvees = 0;
    let trouves = 0;
    for (let pas = 0; pas < 900; pas++) {
      if (pas % 10 === 0 && r.length < tous.length) {
        r = tous.slice(0, r.length + 40);
        trouves = r.length + 200; // le moteur en a trouvé plus que l'aperçu
      }
      const c = compter(r, cache, false, trouves).confirmees;
      if (c < avant) baisses++;
      avant = c;
      const affichables = classementResolu(r, cache, 'atk', OPTIONS).length;
      const t = compteAffichable({ trouves, recus: r.length, affichables, modeRecherche: true }).compte;
      if (t < avantTrouvees) baissesTrouvees++;
      avantTrouvees = t;
      const suivant = r.find((x) => !cache.has(cleBuild(x)));
      if (suivant) cache.set(cleBuild(suivant), resultat(issue.get(cleBuild(suivant))!, 0));
    }
    egal(baisses, 0, `900 publications : le compte confirmé ne baisse jamais (final ${avant})`);
    ok(baissesTrouvees > 0, `témoin : le compte des trouvées (ligne de progression) baisse ${baissesTrouvees} fois`);
  }

  titre('Compte confirmé — sans file, rien ne change');

  {
    const r = recus(41);
    egal(compter(r, null, false, 3500), { confirmees: 3500, nonVerifies: 0, pages: 3, aucune: false },
      'optimisation d’artéfacts coupée : les trouvés par le moteur, pages = ⌈41 reçus / 20⌉ comme avant');
    egal(compter([], null, true, 0).aucune, true, 'sans file, moteur vide : « Aucune »');
    egal(compter(r, null, true, 41).aucune, false, 'sans file, des trouvés : jamais « Aucune »');
  }

  titre('Compte confirmé — l’écran le lit (en-tête, infobulle, pages, contrôles masqués)');

  const brut = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8').replace(/\r\n/g, '\n');
  const src = brut.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(/const compteConfirmes = useMemo\(\s*\(\) =>\s*compteConfirme\(\{\s*recus: fullSortedCandidates,\s*parBuild: resoudreEquipement != null \? fileArtefacts\.parBuild : null,\s*trouves: trouvesParLeMoteur,\s*taillePage: RESULTS_PAGE_SIZE,\s*termine: result != null,\s*\}\),/.test(src),
    'écran : `compteConfirmes` vient des reçus et du cache PUBLIÉ de la file (null sans file)');
  egal((src.match(/compteConfirme\(/g) ?? []).length, 1, 'écran : un seul appel à `compteConfirme`');
  ok(/const totalResultsPages = compteConfirmes\.pages;/.test(src), 'pagination : le nombre de pages vient des confirmées');
  ok(/setResultsPage\(\(p\) => Math\.min\(Math\.max\(p, 1\), totalResultsPages\)\);\s*\}, \[totalResultsPages, setResultsPage\]\);/.test(src),
    'pagination : la page courante revient sur la dernière quand le nombre de pages diminue (6bis-b10, inchangé)');
  const entete = src.match(/<p className="label">\s*\{result\s*\?[\s\S]*?<\/p>/)?.[0] ?? '';
  ok(/compteConfirmes\.aucune\s*\?\s*'Aucune combinaison ne répond à ces critères'/.test(entete),
    'en-tête : « Aucune combinaison ne répond à ces critères » seulement sous `compteConfirmes.aucune`');
  ok(/`\$\{compteConfirmes\.confirmees\.toLocaleString\('fr-FR'\)\} combinaison\(s\) confirmée\(s\)`/.test(entete),
    'en-tête, recherche finie : « XX combinaison(s) confirmée(s) »');
  ok(/`\$\{compteConfirmes\.confirmees\.toLocaleString\('fr-FR'\)\} combinaison\(s\) confirmée\(s\) pour l'instant — recherche en cours…`/.test(entete),
    'en-tête, recherche en cours : « XX combinaison(s) confirmée(s) pour l’instant — recherche en cours… »');
  ok(!/compteAffiche|trouvée\(s\)|result\.candidates\.length|progress\.found|fullSortedCandidates/.test(entete), 'en-tête : plus jamais les trouvées ni un compte brut');
  const apresEntete = src.slice(src.indexOf(entete) + entete.length, src.indexOf(entete) + entete.length + 2000);
  const bulle = apresEntete.match(/<HelpPopover title="Combinaisons confirmées">([\s\S]*?)<\/HelpPopover>/);
  ok(bulle != null && /\{resoudreEquipement != null && !compteConfirmes\.aucune && \(\s*<HelpPopover title="Combinaisons confirmées">/.test(apresEntete),
    'infobulle « Combinaisons confirmées » à côté de l’en-tête, quand une file vérifie');
  ok(bulle != null && /confirmée/.test(bulle[1]!) && /trouvée\(s\)/.test(bulle[1]!) && /optimiste/.test(bulle[1]!) && /écartée/.test(bulle[1]!),
    'infobulle : dit la différence avec les trouvées (borne optimiste, une partie écartée à la vérification)');
  ok(/\{optimiserArtefacts && !compteConfirmes\.aucune && \(/.test(src), '« Adapter les artéfacts et reliques au tri » masqué seulement sous « Aucune combinaison… »');
  ok(/\{!compteConfirmes\.aucune && \(\s*<Selecteur/.test(src), '« Trier par » masqué seulement sous « Aucune combinaison… »');
}
