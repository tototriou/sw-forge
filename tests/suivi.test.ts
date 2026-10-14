// Suivi en direct des vérifications (tests/suivi.mjs) : la lecture de la
// sortie du lanceur et le tableau du terminal (tests/suivi/rendu.ts).
//
// Ce qu'on garde : un échec n'est compté qu'une fois (le récapitulatif final
// le répète) ; chaque ligne du tableau tient dans la largeur, et le tableau
// dans la hauteur (sinon il ne se redessine plus sur place) ; la mosaïque a
// un caractère par entrée.

import {
  avancement, classeEntree, EntreeManifeste, EtatSuivi, LecteurSortie, largeurVisible, SANS_COULEURS, tableau,
  COULEURS_ANSI,
} from './suivi/rendu';
import { egal, ok, titre } from './outils';

function entree(id: string, p: Partial<EntreeManifeste> = {}): EntreeManifeste {
  return { id, etat: 'rendue', controles: 3, echecs: 0, ignores: 0, dureeMs: 120, exception: null, ...p };
}

function etat(entrees: EntreeManifeste[], p: Partial<EtatSuivi> = {}): EtatSuivi {
  return {
    manifeste: {
      etat: 'en cours',
      complet: false,
      bilan: { attendues: entrees.length, controles: 42, echecs: 0, ignores: 1 },
      echecs: [],
      entrees,
    },
    echecs: [],
    titre: 'rendu · App — le fil',
    fin: null,
    debut: 0,
    maintenant: 65_000,
    ...p,
  };
}

export function testSuiviLecture() {
  titre('suivi · lecture de la sortie du lanceur');
  const l = new LecteurSortie();
  l.lire('\x1b[1mVolets — verrou\x1b[0m\n  \x1b[32mok\x1b[0m   le volet se verrouille\n');
  l.lire('  \x1b[31mKO\x1b[0m   écart constaté :\n         la valeur attendue était 3\n  \x1b[32mok\x1b[0m   suite\n');
  l.lire('\x1b[31mÉchecs :\x1b[0m\n  \x1b[31mKO\x1b[0m   testVerrou — écart constaté :\n');
  egal(l.titre, 'Volets — verrou', 'le titre courant : la dernière ligne en gras');
  egal(l.echecs.length, 1, 'un échec, compté une fois : le récapitulatif final ne le redouble pas');
  egal(l.echecs[0].titre, 'Volets — verrou', 'rattaché au titre sous lequel il est apparu');
  egal(l.echecs[0].texte, 'écart constaté :\nla valeur attendue était 3', 'avec ses lignes de détail en retrait');
  ok(l.queue.every((x) => !x.includes('\x1b')), 'la queue de sortie est sans couleurs');

  const coupe = new LecteurSortie();
  coupe.lire('  KO   début');
  egal(coupe.echecs.length, 0, 'une ligne pas encore terminée attend la suite');
  coupe.lire(' de ligne\n');
  egal(coupe.echecs[0]?.texte, 'début de ligne', 'et se lit entière');
}

export function testSuiviTableau() {
  titre('suivi · le tableau du terminal');
  egal(classeEntree(entree('a', { etat: 'invoquée' })), 'cours', 'une entrée invoquée est en cours');
  egal(classeEntree(entree('a', { echecs: 1 })), 'ko', 'une entrée avec un échec est en échec');
  egal(classeEntree(entree('a', { controles: 0, ignores: 2 })), 'ignoree', 'rien que des ignorés : entièrement ignorée');

  const entrees = [
    ...Array.from({ length: 150 }, (_, i) => entree(`testFaite${i}`)),
    entree('testEnCours', { etat: 'invoquée', dureeMs: null }),
    ...Array.from({ length: 49 }, (_, i) => entree(`testAttendue${i}`, { etat: 'attendue', dureeMs: null })),
  ];
  const s = etat(entrees);
  const a = avancement(s);
  ok(a.faites === 150 && a.attendues === 200 && a.pct === 75, `75 % : 150 entrées faites sur 200 (${a.pct} %)`);
  ok(a.resteMs !== null && Math.round(a.resteMs) === 50 * 120, 'le temps restant : la durée moyenne × les entrées restantes');

  const enCours = etat(entrees);
  enCours.manifeste!.echecs = null;
  ok(!avancement(enCours).ko && tableau(enCours, 80, 40, SANS_COULEURS).length > 0,
    'pendant le lancement, le manifeste n\'a pas encore de constats finaux (`echecs: null`)');

  const lignes = tableau(s, 80, 40, SANS_COULEURS);
  ok(lignes.every((l) => largeurVisible(l) <= 80), 'chaque ligne tient dans 80 colonnes');
  ok(lignes[1].includes('75 %') && lignes[1].includes('150/200'), 'la barre dit le pourcentage et le compte');
  ok(lignes.some((l) => l.includes('▶ EnCours · rendu · App — le fil')), 'l\'entrée en cours, et le titre lu sur la sortie');
  const cases = lignes.join('').match(/[■●·]/g)?.length ?? 0;
  ok(cases >= 200, `un caractère par entrée dans la mosaïque (${cases})`);

  const court = tableau(s, 80, 8, SANS_COULEURS);
  ok(court.length <= 8 && !court.some((l) => l.includes('■ réussie')), 'terminal trop bas : la mosaïque cède sa place, le tableau tient');
  ok(tableau(s, 40, 40, COULEURS_ANSI).every((l) => largeurVisible(l) <= 40), 'en couleurs aussi, la largeur se mesure sans les codes');

  const ko = etat([entree('testA', { echecs: 1 })], {
    echecs: [{ titre: 'Volets — verrou', texte: 'renvoi mort' }],
    fin: { code: 1, signal: null, a: 90_000 },
  });
  const fini = tableau(ko, 80, 40, SANS_COULEURS);
  ok(fini[0].includes('✖ échec (code 1)') && fini[0].includes('1:30'), 'fin en échec : le statut et la durée totale');
  ok(fini.some((l) => l.includes('✖ Volets — verrou — renvoi mort')), 'l\'échec, avec son titre');
  ok(tableau(etat([entree('testA')], { fin: { code: 0, signal: null, a: 1000 } }), 80, 40, SANS_COULEURS)[0].includes('✔ toutes réussies'),
    'fin sans échec : toutes réussies');
}
