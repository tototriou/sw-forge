// Le compte affiché des builds (`compteAffichable`,
// artifactQueue.ts) : trouvés par le moteur, moins ceux que la résolution
// exacte a écartés (`conforme: false`), mesurés comme candidats reçus moins
// affichables — jamais en comptant les rejets du cache de la file, qui
// survivent à une relance aux mêmes réglages.
//
// Les affichables viennent de la vraie `classementResolu`, comme à l'écran.
// Le dépôt n'a pas d'infrastructure de test React : les lecteurs du compte se
// contrôlent sur la source. Il n'en reste que deux, la ligne
// de progression et la ligne de raison ; l'en-tête et les pages lisent les
// confirmées (`compteConfirme`, tests/compte-confirme.test.ts).

import { readFileSync } from 'node:fs';
import { BuildCandidate, OptionsDeClassement, aurasPropresParRunes, sortCandidates } from '../src/lib/runeBuildOptim';
import { ResultatArtefacts, classementResolu, cleBuild, compteAffichable } from '../src/lib/artifactQueue';
import { StatRow } from '../src/lib/stats';
import { egal, ok, titre } from './outils';

const OPTIONS: OptionsDeClassement = { aurasPropresDe: aurasPropresParRunes(new Map()) };

function stats(atk: number): StatRow[] {
  return [{ key: 'atk', label: 'ATQ', base: atk, bonus: 0, total: atk, suffix: '' }];
}
function candidat(id: number, atk = 1000 - id): BuildCandidate {
  return { runeIds: [id], stats: stats(atk), effTotal: 0 };
}
function resultat(conforme: boolean, atk = 1000): ResultatArtefacts {
  return { paire: null, artefacts: [], stats: stats(atk), meilleurSansVerrous: null, conforme };
}

// Le chemin de l'écran : ordre de base, cache de la file, classement affiché,
// puis le compte sur les deux longueurs.
function compter(
  trouves: number,
  recus: BuildCandidate[],
  cache: [BuildCandidate, boolean][],
  modeRecherche: boolean
) {
  const base = sortCandidates(recus, 'atk', OPTIONS);
  const parBuild = new Map<string, ResultatArtefacts>(cache.map(([c, conforme]) => [cleBuild(c), resultat(conforme)]));
  const affichees = classementResolu(base, parBuild, 'atk', OPTIONS);
  return compteAffichable({ trouves, recus: base.length, affichables: affichees.length, modeRecherche });
}

const RAISON_RECHERCHE_1 =
  "1 combinaison trouvée par la recherche a été écartée : aucune paire d'artéfacts ni relique réelles ne tient toutes les conditions.";
const RAISON_FICHE_1 =
  "1 combinaison trouvée par la recherche a été écartée : aucune paire d'artéfacts réelle ne tient toutes les conditions.";

export function testCompteAffichable() {
  titre('Compte affiché — un build écarté à la résolution sort du compte (6bis-b10)');

  // Le constat Kinki : 1 trouvé, 1 écarté.
  const kinki = candidat(1);
  egal(compter(1, [kinki], [[kinki, false]], true), { compte: 0, ecartes: 1, raison: RAISON_RECHERCHE_1 },
    '1 trouvé et 1 écarté (mode « recherche ») : 0, et la raison parle de la paire ET de la relique');
  egal(compter(1, [kinki], [[kinki, false]], false), { compte: 0, ecartes: 1, raison: RAISON_FICHE_1 },
    '1 trouvé et 1 écarté hors mode « recherche » : 0, et la raison ne parle que de la paire');

  const [a, b, c] = [candidat(1), candidat(2), candidat(3)];
  egal(compter(3, [a, b, c], [[a, true], [b, false], [c, true]], true), { compte: 2, ecartes: 1, raison: null },
    '3 trouvés et 1 écarté : 2, sans ligne de raison');
  egal(compter(3, [a, b, c], [[a, true]], true), { compte: 3, ecartes: 0, raison: null },
    'deux builds en attente (absents du cache) : comptés');
  egal(compter(3, [a, b, c], [[a, true], [b, false]], true).compte, 2, 'un écarté, un résolu, un en attente : 2');
  egal(compter(2, [a, b], [[a, false], [b, false]], true).raison,
    "2 combinaisons trouvées par la recherche ont été écartées : aucune paire d'artéfacts ni relique réelles ne tient toutes les conditions.",
    'pluriel : 2 écartés sur 2');

  titre('Compte affiché — sans file, rien ne change');

  const quarante = Array.from({ length: 41 }, (_, i) => candidat(i + 1));
  egal(compter(41, quarante, [], true), { compte: 41, ecartes: 0, raison: null },
    'cache vide (pas d’optimisation d’artéfacts) : compte = trouvés');
  egal(compter(0, [], [], true), { compte: 0, ecartes: 0, raison: null },
    'moteur vide : 0, aucune raison (le bloc « suffirait » et le diagnostic gardent la main)');

  titre('Compte affiché — le cache n’est jamais compté');

  // Une recherche relancée aux mêmes réglages garde les rejets de la
  // précédente : un build écarté hier, pas (encore) retrouvé, ne compte pas.
  const ancien = candidat(99);
  egal(compter(2, [a, b], [[ancien, false], [a, true]], true), { compte: 2, ecartes: 0, raison: null },
    'un rejet du cache pour un build absent des candidats reçus : aucun effet');

  titre('Compte affiché — pendant la recherche, en direct');

  // `progress.found` n'est pas plafonné, l'aperçu (`progress.candidates`) l'est :
  // le compte part du moteur.
  const apercu = Array.from({ length: 60 }, (_, i) => candidat(i + 1));
  const rejets = apercu.slice(0, 21).map((x): [BuildCandidate, boolean] => [x, false]);
  egal(compter(3500, apercu, rejets, true), { compte: 3479, ecartes: 21, raison: null },
    '3 500 trouvés, aperçu de 60, 21 écartés : 3 479 trouvées');
  egal(compter(3500, apercu, [], true).compte, 3500, 'rien encore résolu : le compte du moteur');

  titre('Compte affiché — l’écran lit cette fonction');

  const ecran = readFileSync('src/components/outils/OptimizerSection.tsx', 'utf8');
  ok(/const trouvesParLeMoteur = result \? result\.candidates\.length : progress\?\.phase === 'pairing' \? progress\.found : fullSortedCandidates\.length;/.test(ecran),
    'écran : le compte du moteur (résultat, ou `progress.found` pendant l’appariement)');
  ok(/const compteAffiche = useMemo\(\s*\(\) =>\s*compteAffichable\(\{\s*trouves: trouvesParLeMoteur,\s*recus: fullSortedCandidates\.length,\s*affichables: affichees\.length,\s*modeRecherche: relicContextRecherche\?\.mode === 'recherche',\s*\}\)/.test(ecran),
    'écran : `compteAffiche` part du moteur, des reçus et des affichables');
  egal((ecran.match(/compteAffichable\(/g) ?? []).length, 1, 'écran : un seul appel à `compteAffichable`');
  egal((ecran.match(/progress\.found/g) ?? []).length, 1, 'écran : `progress.found` n’est lu qu’une fois, au compte du moteur');
  ok(/combinaisons examinées · \$\{compteAffiche\.compte\.toLocaleString\('fr-FR'\)\} trouvée\(s\)`/.test(ecran),
    'ligne de progression : le compte des trouvées, inchangé (6bis-b18)');
  ok(/\{compteConfirmes\.aucune && compteAffiche\.raison && \(/.test(ecran),
    'la ligne de raison s’affiche quand la fonction en rend une, sous « Aucune combinaison… » (6bis-b18)');
  egal((ecran.match(/compteAffiche\.(compte|raison|ecartes)/g) ?? []).length, 3,
    'écran : deux lecteurs seulement, la ligne de progression (une lecture) et la ligne de raison (condition et texte)');
  egal((ecran.match(/\{result\?\.candidates\.length === 0 &&/g) ?? []).length, 3,
    'le diagnostic (deux blocs) et le bloc « suffirait » gardent leur condition : moteur vide');
}
