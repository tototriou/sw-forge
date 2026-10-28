// Le compte des combinaisons CONFIRMÉES
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
import { ResultatArtefacts, classementResolu, cleBuild, compositionDePage, compteAffichable, compteConfirme, compteConfirmeDesComptes,
  pagesDesResultats } from '../src/lib/artifactQueue';
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
  titre('Compte confirmé — seulement les builds vérifiés');

  {
    const r = recus(5);
    egal(compter(r, cacheDe(), false), { confirmees: 0, nonVerifies: 5, pages: 1, pagesPeuventMonter: false, aRecevoir: false, aucune: false }, 'rien de vérifié : 0 confirmée, 5 non vérifiés, une page');
    egal(compter(r, cacheDe([1, true], [2, false], [3, true]), false), { confirmees: 2, nonVerifies: 2, pages: 1, pagesPeuventMonter: false, aRecevoir: false, aucune: false },
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
    egal(compter(kinki, cacheDe([1, false]), true), { confirmees: 0, nonVerifies: 0, pages: 1, pagesPeuventMonter: false, aRecevoir: false, aucune: true },
      'Kinki, recherche finie, écarté : tout est vérifié, aucune confirmée → « Aucune »');
    egal(compter(recus(3), cacheDe([1, false], [2, false]), true).aucune, false, '2 écartés sur 3, le 3ᵉ pas vérifié : pas encore « Aucune »');
    egal(compter([], cacheDe(), true).aucune, true, 'moteur vide : « Aucune » (les diagnostics gardent leur condition)');
    egal(compter(recus(3), cacheDe([1, false], [2, true], [3, false]), true).aucune, false, 'une confirmée : jamais « Aucune »');
    // Arrêt sur la mémoire : la recherche finie a trouvé plus que le classeur n'a gardé.
    egal(compter([], cacheDe(), true, 10_000).aucune, false, 'arrêt sur la mémoire, rien gardé : pas « Aucune » (l’avis de l’arrêt le dit)');
    egal(compter(kinki, cacheDe([1, false]), true, 10_000).aucune, false, 'arrêt sur la mémoire, le gardé écarté : pas « Aucune », le reste trouvé n’est pas jugé');
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

  titre('Compte confirmé — « / N+ » seulement si d’autres pages peuvent encore apparaître');

  {
    // C confirmées, U non vérifiés, T trouvées par le moteur (au moins C + U reçues).
    const compte = (C: number, U: number, T = C + U, avecFile = true, termine = false) => compteConfirmeDesComptes({
      recus: C + U, resolus: C, confirmees: C, avecFile, trouves: T, taillePage: PAGE, termine });
    const monte = (C: number, U: number, T?: number, avecFile?: boolean, termine?: boolean) => {
      const c = compte(C, U, T, avecFile, termine);
      return `${c.pages}${c.pagesPeuventMonter ? '+' : ''}`;
    };
    egal(monte(300, 0, 5100, true, true), '15', 'arrêt sur la mémoire (recherche finie, 5 100 trouvées, 300 gardées) : le reste ne sera jamais reçu, pas de « + »');
    egal(monte(45, 10), '3', '45 confirmées, 10 non vérifiées : « / 3 », 3 est déjà le maximum');
    egal(monte(300, 1000), '16+', '300 confirmées, 1 000 non vérifiées : « / 16+ », le plafond coupe 49 pages possibles');
    egal(monte(300, 4800), '16+', '« Dégâts réels » (vérification arrêtée à K) : « / 16+ »');
    egal(monte(40, 1), '3', '40 confirmées, 1 non vérifiée : « / 3 », la 3ᵉ ne peut que disparaître');
    egal(monte(45, 16), '4', '45 + 16 : « / 4 », tous confirmés ne feraient pas plus');
    egal(monte(0, 25), '1+', 'rien de confirmé, 25 non vérifiés : « / 1+ »');
    egal(monte(300, 0, 5100), '15+', 'tout reçu vérifié, le moteur en a trouvé plus que l’aperçu : « / 15+ »');
    egal(monte(300, 0), '15', 'tout trouvé, reçu et vérifié : nombre exact');
    egal(monte(41, 0, 3500, false), '3', 'sans file : jamais de « + »');
    // Propriété, sur une grille : « + » ⟺ les pages, une fois tout vérifié
    // conforme, dépasseraient celles écrites (tout reçu).
    const fautes: string[] = [];
    for (let C = 0; C <= 90; C++) for (let U = 0; U <= 90; U++) {
      const c = compte(C, U);
      const auPlus = Math.max(1, Math.ceil((C + U) / PAGE));
      if (c.pagesPeuventMonter !== auPlus > c.pages) fautes.push(`${C}+${U}`);
      if (Math.max(1, Math.ceil(C / PAGE)) > c.pages) fautes.push(`${C}+${U} : les confirmées dépassent les pages`);
    }
    egal(fautes.slice(0, 5), [], '91 × 91 comptes : « + » exactement quand le maximum atteignable dépasse les pages écrites');

    // Sous une borne active : la même règle sur la vue (membres = visibles
    // confirmés + potentiels non vérifiés), `filtre.pages` formé comme au
    // classeur, et les trouvées qui arriveront encore (règle de la recherche, `aRecevoir`).
    const filtre = (visiblesConfirmes: number, potentielsNonVerifies: number) => ({
      pages: compteConfirmeDesComptes({ recus: visiblesConfirmes + potentielsNonVerifies, resolus: visiblesConfirmes, confirmees: visiblesConfirmes,
        avecFile: true, trouves: visiblesConfirmes + potentielsNonVerifies, taillePage: PAGE, termine: false }).pages,
      comptes: { visiblesConfirmes, potentielsNonVerifies } });
    // La recherche : 100 reçues, `trouves` trouvées par le moteur.
    const sous = (f: ReturnType<typeof filtre>, avecFile = true, trouves = 100, termine = false) => {
      const { aRecevoir } = compteConfirmeDesComptes({ recus: 100, resolus: 100, confirmees: 100, avecFile, trouves, taillePage: PAGE, termine });
      const p = pagesDesResultats({ pages: 99, pagesPeuventMonter: true, aRecevoir }, f, avecFile, PAGE);
      return `${p.pages}${p.pagesPeuventMonter ? '+' : ''}`;
    };
    egal(pagesDesResultats({ pages: 16, pagesPeuventMonter: true, aRecevoir: false }, null, true, PAGE), { pages: 16, pagesPeuventMonter: true },
      'sans borne : les pages et le « + » de la recherche');
    egal(sous(filtre(45, 10)), '3', 'sous filtre, 45 visibles et 10 potentiels : « / 3 »');
    egal(sous(filtre(300, 1000)), '16+', 'sous filtre, 300 visibles et 1 000 potentiels : « / 16+ »');
    egal(sous(filtre(30, 0)), '2', 'sous filtre, aucun potentiel, tout reçu : nombre exact, même s’il reste des non vérifiés masqués');
    egal(sous(filtre(30, 0), true, 150), '2+', 'sous filtre, des trouvées pas encore reçues pendant la recherche : « + »');
    egal(sous(filtre(30, 0), true, 150, true), '2', 'sous filtre, arrêt sur la mémoire (recherche finie, trouvé non gardé) : pas de « + »');
    egal(sous(filtre(300, 1000), false), '16', 'sous filtre, sans file : jamais');
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
    // compte des trouvées baisse à chaque écarté découvert.
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
    egal(compter(r, null, false, 3500), { confirmees: 3500, nonVerifies: 0, pages: 3, pagesPeuventMonter: false, aRecevoir: false, aucune: false },
      'optimisation d’artéfacts coupée : les trouvés par le moteur, pages = ⌈41 reçus / 20⌉ comme avant');
    egal(compter([], null, true, 0).aucune, true, 'sans file, moteur vide : « Aucune »');
    egal(compter(r, null, true, 41).aucune, false, 'sans file, des trouvés : jamais « Aucune »');
    egal(compter([], null, true, 10_000).aucune, false, 'sans file, arrêt sur la mémoire sans rien gardé : pas « Aucune » (l’avis de l’arrêt le dit)');
  }

  titre('Compte confirmé — l’écran le lit (en-tête, infobulle, pages, contrôles masqués)');

  const brut = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8').replace(/\r\n/g, '\n');
  const src = brut.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(/const compteConfirmes = compteConfirmeDesComptes\(\{\s*recus,\s*resolus: instantane\?\.comptes\.resolus \?\? 0,\s*confirmees: instantane\?\.comptes\.confirmees \?\? 0,\s*avecFile,\s*trouves: trouvesParLeMoteur,\s*taillePage: RESULTS_PAGE_SIZE,\s*termine: result != null,\s*\}\);/.test(src),
    'écran : `compteConfirmes` vient des comptes de l’instantané (reçus, résolus, confirmées)');
  egal([(src.match(/compteConfirmeDesComptes\(/g) ?? []).length, (src.match(/compteConfirme\(/g) ?? []).length], [1, 0],
    'écran : un seul appel, sur les comptes, jamais sur la liste des reçus');
  ok(/const pagesResultats = pagesDesResultats\(compteConfirmes, filtreActif \? instantane!\.filtre : null, avecFile, RESULTS_PAGE_SIZE\);\s*const totalResultsPages = pagesResultats\.pages;/.test(src)
    && /pagesPeuventMonter=\{pagesResultats\.pagesPeuventMonter\}/.test(src),
  'pagination : le nombre de pages vient des confirmées (de la vue filtrée sous une borne), et « / N+ » de `pagesDesResultats`');
  ok(/setResultsPage\(\(p\) => Math\.min\(Math\.max\(p, 1\), totalResultsPages\)\);\s*\}, \[totalResultsPages, setResultsPage\]\);/.test(src),
    'pagination : la page courante revient sur la dernière quand le nombre de pages diminue');
  // L'en-tête à l'écran — « Aucune combinaison… » seulement sous
  // `compteConfirmes.aucune`, « N confirmée(s) » (finie) ou « … pour
  // l'instant — recherche en cours… », jamais les trouvées ; l'infobulle
  // « Combinaisons confirmées » quand une file vérifie ; « Adapter… » et
  // « Trier par » masqués seulement sous « Aucune… » :
  // `testRenduOptimizerResultatsEntete` (états posés) et
  // `testRenduOptimizerEcranResultats` (file réelle : une confirmée, puis
  // écartée ; le texte de l'infobulle).
}
