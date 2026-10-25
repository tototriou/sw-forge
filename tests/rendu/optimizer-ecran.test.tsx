// Tests de rendu — l'écran de l'Optimizer ENTIER (`OptimizerSection`), dans
// des états posés à la main : réglages avancés, liste de travail, en-tête et
// cartes des résultats. Ils remplacent les lectures du texte de l'écran qui
// épinglaient ces morceaux à l'endroit où ils étaient écrits : un morceau
// peut changer de composant, ce que l'écran rend dans cet état doit rester.
// Les gestes (clic, guidage, rappel) : optimizer-ecran-navigateur.test.ts.
//
// ⚠️ Rendu serveur : seul l'état posé compte, aucun effet ne tourne — la
// file de vérification des artéfacts n'a rien vérifié (`enAttente` à 0, aucun
// build résolu). Le banc et ses états : optimizer.test.tsx.

import { AVEC_MONSTRE, BOX, CHOISI, rendreOptimizer } from './optimizer.test';
import { auTelephone, bouton, boutons, rendre, texteVisible } from './outils-rendu';
import { egal, ok, titre } from '../outils';
import type { BuildCandidate, BuildRequirement } from '../../src/lib/runeBuildOptim';
import EnteteResultats from '../../src/components/outils/optimizer/EnteteResultats';
import { rechercheClasseeTest } from './optimizer-classement-banc';

const EPUISEMENT = "Rechercher jusqu'à épuisement complet";
const DIAGNOSTIC = 'Diagnostic approfondi sur 0 résultat';
// Retiré de l'écran : ne doit plus apparaître dans aucun format.
const PRIORISER = 'Prioriser les stats les plus difficiles';
const VERIFIER = 'Vérifier toutes les combinaisons trouvées';
const COMPTER = "Compter les effets d'auras Tolerance et Précision dans les conditions";
const RAPPEL = "Pense à vérifier les sets d'aura externes.";
const decoder = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

// Les interrupteurs (`role="switch"`) de la page, dans l'ordre du DOM, à
// partir de `apres` : leur nom et leur état.
function interrupteurs(html: string, apres = ''): { nom: string; coche: boolean }[] {
  const debut = Math.max(0, apres ? html.indexOf(apres) : 0);
  return [...html.slice(debut).matchAll(/<button\b[^>]*role="switch"[^>]*>/g)].map(([balise]) => ({
    nom: decoder(balise.match(/aria-label="([^"]*)"/)?.[1] ?? ''),
    coche: /aria-checked="true"/.test(balise),
  }));
}
// La balise ouvrante du dernier `<div>` qui précède `index`.
function divEnglobant(html: string, index: number): string {
  const i = html.lastIndexOf('<div', index);
  return i < 0 ? '' : html.slice(i, html.indexOf('>', i) + 1);
}
const classes = (balise: string) => (balise.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean);

export function testRenduOptimizerReglagesAvancesContenu() {
  titre('rendu · Optimizer — contenu des réglages avancés, au bureau et au téléphone');
  const ANCRE = 'Pré-filtrage par emplacement';
  const noms = (html: string) => interrupteurs(html, ANCRE).map((x) => x.nom);
  // Au bureau, le même contenu vit dans la colonne « Aura, exclusion,
  // avancés », fermée par défaut : un rendu serveur ne l'ouvre pas (son
  // ouverture et son contenu au bureau : `testRendu…OptimizerEcranReglagesAvances`,
  // au navigateur). Le contenu se lit ici dans le panneau « Options ».
  const options = (etat: Record<string, unknown>) => auTelephone(() => rendreOptimizer(etat, true));
  const MONSTRE = { selectedId: CHOISI, comboSets: ['violent'] };
  ok(!rendreOptimizer(AVEC_MONSTRE).includes(ANCRE), 'bureau : colonne « Aura, exclusion, avancés » fermée par défaut, aucun réglage avancé monté');
  const telephone = options(MONSTRE);
  const aidesFixes = [...telephone.matchAll(/<div class="flex-none"><div class="relative"><button\b[^>]*aria-label="([^"]+)"/g)].map((m) => decoder(m[1]));
  ok(aidesFixes.includes(COMPTER), 'panneau « Options » : l’aide des auras garde sa largeur, seul le libellé peut rétrécir');
  egal(noms(telephone), [EPUISEMENT, DIAGNOSTIC, VERIFIER, COMPTER], 'panneau « Options » : les interrupteurs, l’interrupteur des auras en dernier');
  const sansFile = options({ ...MONSTRE, optimiserArtefacts: false });
  egal(noms(sansFile), [EPUISEMENT, DIAGNOSTIC, COMPTER],
    'sans optimisation d’artéfacts : « Vérifier toutes… » masqué, l’interrupteur des auras rendu sans condition, en dernier');

  const etat = (html: string, nom: string) => interrupteurs(html, ANCRE).find((x) => x.nom === nom)?.coche;
  ok(etat(telephone, COMPTER) === true && etat(options({ ...MONSTRE, compterAurasResPre: false }), COMPTER) === false,
    'l’interrupteur des auras affiche `compterAurasResPre`');
  ok(etat(telephone, VERIFIER) === false && etat(options({ ...MONSTRE, verifierToutesLesCombinaisons: true }), VERIFIER) === true,
    '« Vérifier toutes… » affiche `verifierToutesLesCombinaisons`');

  for (const [nom, html] of [['téléphone', telephone]] as const) {
    const t = texteVisible(html);
    ok(!t.includes(PRIORISER) && !boutons(html).some((b) => b.ariaLabel === PRIORISER),
      `${nom} : plus d’interrupteur « ${PRIORISER} », ni libellé ni aide`);
    ok(t.includes(COMPTER) && t.includes(VERIFIER), `${nom} : les deux rangées portent leur libellé exact`);
    const aides = boutons(html).filter((b) => b.ariaLabel === COMPTER || b.ariaLabel === VERIFIER).map((b) => b.ariaLabel);
    ok(aides.includes(COMPTER) && aides.includes(VERIFIER), `${nom} : chacune a son aide`);
    // Le cadre d'attention de l'interrupteur des auras existe toujours,
    // transparent hors guidage : se colorer (navigateur) ne bouge rien.
    // Libellé → son bloc (libellé + aide) → le cadre, qui tient aussi l'interrupteur.
    const libelle = html.indexOf(`${COMPTER.replace("'", '&#x27;')}</span>`);
    const bloc = libelle >= 0 ? html.lastIndexOf('<div', libelle) : -1;
    const cadre = bloc > 0 ? divEnglobant(html, bloc - 1) : '';
    const c = classes(cadre);
    ok(c.includes('border') && c.includes('border-transparent') && !c.some((x) => x.startsWith('border-warn')) && c.filter((x) => /^border(-|$)/.test(x)).length === 2,
      `${nom} : cadre permanent autour de l’interrupteur des auras, bord transparent hors guidage, un seul contour (${c.join(' ')})`);
  }
}

// Liste de travail (zone C) : le bouton d'ajout, et le rappel des auras sous la liste.
const LISTES = 'swblacksmith-optimizer-lists-v1';
const membre = { source: 'box', unitKey: BOX[0].key };
const stockage = (membres: unknown[], valides: unknown[] = []) => ({
  [LISTES]: JSON.stringify({ lists: [{ id: 'a', name: 'Alpha' }], activeListId: 'a', validated: valides, members: membres.map((selector) => ({ listId: 'a', selector })) }),
});

export function testRenduOptimizerListeDeTravail() {
  titre('rendu · Optimizer — liste de travail : bouton d’ajout et rappel des auras');
  const rien = bouton(rendreOptimizer({}), 'Ajouter à la liste');
  ok(rien?.desactive === true && rien.title === 'Ajouter à la liste', 'aucun monstre choisi : « Ajouter à la liste », désactivé, libellé en infobulle');
  const sansListe = bouton(rendreOptimizer(AVEC_MONSTRE), 'Créer une liste et y ajouter Devilmon');
  ok(sansListe?.desactive === false && sansListe.title === 'Créer une liste et y ajouter Devilmon', 'sans liste : créer et ajouter, actif');
  const avecListe = bouton(rendreOptimizer({ ...AVEC_MONSTRE, sourceSelector: membre }, false, stockage([])), 'Ajouter Devilmon à « Alpha »');
  ok(avecListe?.desactive === false && avecListe.title === 'Ajouter Devilmon à « Alpha »', 'liste active : ajouter à « Alpha », actif');
  const deja = bouton(rendreOptimizer({ ...AVEC_MONSTRE, sourceSelector: membre }, false, stockage([membre])), 'Déjà dans « Alpha »');
  ok(deja?.desactive === true, 'exemplaire déjà membre (seul exemplaire Box) : « Déjà dans « Alpha » », désactivé');

  const valide = { listId: 'a', selector: membre, runeIds: [1, 2, 3, 4, 5, 6], artifactIds: [], com2usId: BOX[0].monster.com2usId };
  // La zone C rendue : du bouton « Liste active » qui nomme la liste
  // (« Alpha - … » ; le titre de la carte, lui, ne la nomme plus) à la fin de
  // son bouton de libération.
  const ACTIVE = 'Alpha - ';
  const zonesC = (h: string) => {
    const zones: string[] = [];
    for (let i = h.indexOf(ACTIVE); i >= 0; i = h.indexOf(ACTIVE, i + 1)) zones.push(h.slice(i));
    return zones.map((zone) => {
      const fin = zone.indexOf('Libérer toutes les runes de « Alpha »');
      return fin >= 0 ? zone.slice(0, fin) : '';
    }).filter((corps) => corps.includes(BOX[0].monster.name));
  };
  // Au bureau, le rappel sort du flux : hors rappel, rien n'est monté sous la
  // liste (aucune place réservée) ; il paraît en surimpression au bas de la
  // carte (le geste : optimizer-ecran-navigateur.test.ts).
  const bureau = zonesC(rendreOptimizer(AVEC_MONSTRE, false, stockage([membre], [valide])));
  ok(bureau.length > 0 && bureau.every((corps) => !corps.includes(RAPPEL.replace("'", '&#x27;'))),
    'au bureau, hors rappel : aucun rappel monté sous la liste (il sort du flux, aucune place réservée)');
  // Au téléphone, la zone C est repliée sous « Gérer mes listes » au rendu
  // serveur : sa place réservée, son dessin et son apparition se vérifient au
  // navigateur, dans les deux formats (`preuvesRappelDeuxRendus`).
  const vide = rendreOptimizer(AVEC_MONSTRE, false, stockage([]));
  const zoneVide = vide.slice(vide.indexOf(ACTIVE));
  ok(vide.includes(ACTIVE) && !zoneVide.slice(0, zoneVide.indexOf('Aucun monstre dans cette liste')).includes(RAPPEL.replace("'", '&#x27;'))
    && texteVisible(vide).includes("Aucun monstre dans cette liste pour l'instant."),
  'liste vide : aucun rappel monté sous la liste (aucun clic ne peut le poser)');
}

// Résultats : ligne de progression, en-tête, contrôles et cartes.
const STATS = [{ key: 'atk', label: 'ATQ', suffix: '', base: 700, bonus: 300, total: 1000 }];
const candidat = (i: number): BuildCandidate => ({ runeIds: [i, i + 100, i + 200, i + 300, i + 400, i + 500], stats: STATS, effTotal: 0 } as unknown as BuildCandidate);
const resultat = (n: number) => ({ candidates: Array.from({ length: n }, (_, i) => candidat(i + 1)), explored: 10, truncated: false, nearMissByCondition: [], globalNearMiss: null });
type Reel = Parameters<Extract<Parameters<typeof rendreOptimizer>[0], (...a: never[]) => unknown>>[0];
const recherche = (search: Record<string, unknown>, autres: Record<string, unknown> = {}) =>
  rendreOptimizer((r: Reel) => ({ ...AVEC_MONSTRE, ...autres, search: { ...r.search, ...rechercheClasseeTest(search, {
    fiche: BOX[0].gear!, pool: BOX[0].gear!.runes, optimiser: autres.optimiserArtefacts !== false,
    requirement: { sets: r.comboSets, minStats: (autres.minStats ?? r.minStats) as BuildRequirement['minStats'] },
    vue: { tri: r.sortBy, metric: 'eff', page: Number(autres.resultsPage ?? 1) },
  }) } }));
const selecteurTri = (html: string) => /<select\b[\s\S]*?Trier par /.test(html);

export function testRenduOptimizerResultatsEntete() {
  titre('rendu · Optimizer — ligne de progression, en-tête des résultats, tri et diagnostics');
  const enCours = texteVisible(recherche({ status: 'running', result: null,
    progress: { phase: 'pairing', explored: 1234, found: 7, pct: 0.5, totalPairs: 5000, candidates: [] } }));
  ok(enCours.includes('1 234 / 5 000 combinaisons examinées · 7 trouvée(s)'), 'appariement : examinées sur l’espace à épuiser, et le compte des trouvées');

  const vide = recherche({ status: 'done', result: resultat(0) });
  const tVide = texteVisible(vide);
  ok(tVide.includes('Aucune combinaison ne répond à ces critères'), '0 résultat : « Aucune combinaison ne répond à ces critères »');
  ok(!bouton(vide, 'Combinaisons confirmées') && !interrupteurs(vide).some((x) => x.nom === 'Adapter les artéfacts et reliques au tri') && !selecteurTri(vide),
    '0 résultat : ni infobulle des confirmées, ni « Adapter… », ni « Trier par »');
  ok(tVide.includes('Astuce : active le diagnostic approfondi'), '0 résultat : le diagnostic (palier 2, désactivé) propose son réglage');
  const impossible = texteVisible(recherche({ status: 'done', result: resultat(0) }, { minStats: { cr: 100 } }));
  ok(/Taux Crit minimum demandé 100\s?%/.test(impossible), '0 résultat et condition hors de portée : le diagnostic de faisabilité la nomme');

  const proche = { runeIds: candidat(1).runeIds, stats: STATS, effTotal: 0, shortfalls: [{ key: 'spd', kind: 'min', requested: 200, actual: 190, shortfall: 10 }] };
  ok(texteVisible(recherche({ status: 'done', result: { ...resultat(0), globalNearMiss: proche } })).includes('Quoi ajuster pour trouver des builds'),
    '0 résultat et un quasi-succès : « Quoi ajuster pour trouver des builds »');
  const avecResultats = texteVisible(recherche({ status: 'done', result: { ...resultat(1), globalNearMiss: proche } }, { minStats: { cr: 100 } }));
  ok(!avecResultats.includes('Quoi ajuster pour trouver des builds') && !avecResultats.includes('Astuce : active le diagnostic approfondi')
    && !/Taux Crit minimum demandé 100\s?%/.test(avecResultats),
  'des résultats : aucun des trois blocs de 0 résultat (faisabilité, diagnostic approfondi, quasi-succès), même avec leurs données');

  const un = recherche({ status: 'done', result: resultat(1) });
  const tUn = texteVisible(un);
  ok(tUn.includes('0 combinaison(s) confirmée(s)') && !tUn.includes("pour l'instant") && !tUn.includes('Aucune combinaison'),
    'recherche finie, file active, rien de vérifié : « 0 combinaison(s) confirmée(s) », jamais « Aucune »');
  ok(!!bouton(un, 'Combinaisons confirmées'), 'file active : l’infobulle « Combinaisons confirmées » à côté de l’en-tête');
  ok(!interrupteurs(un).some((x) => x.nom === 'Adapter les artéfacts et reliques au tri') && !tUn.includes('Adapter les artéfacts'),
    'réglage retiré : aucun « Adapter les artéfacts et reliques au tri », le tri ne résout aucun équipement');
  ok(selecteurTri(un) && tUn.includes('Trier par ATQ'), '« Trier par » proposé');
  ok(!tUn.includes('Astuce : active le diagnostic approfondi'), 'des résultats : aucun diagnostic de 0 résultat');

  const live = texteVisible(recherche({ status: 'running', result: null,
    progress: { phase: 'pairing', explored: 10, found: 1, pct: 0.1, totalPairs: 100, candidates: [candidat(1)] } }));
  ok(live.includes("0 combinaison(s) confirmée(s) pour l'instant — recherche en cours…"), 'pendant la recherche : « … pour l’instant — recherche en cours… »');

  const sansFile = recherche({ status: 'done', result: resultat(1) }, { optimiserArtefacts: false });
  const tSans = texteVisible(sansFile);
  ok(tSans.includes('1 combinaison(s) confirmée(s)') && !bouton(sansFile, 'Combinaisons confirmées')
    && !interrupteurs(sansFile).some((x) => x.nom === 'Adapter les artéfacts et reliques au tri') && selecteurTri(sansFile),
  'sans file : les trouvées sont les confirmées, sans infobulle ni « Adapter… », « Trier par » gardé');
}

// La ligne de la file, sous l'en-tête : le reste de la file en vérification,
// place gardée quand elle se vide. L'écran entier ne la montre pas non vide en
// rendu serveur (la file n'y tourne pas) : l'en-tête est rendu seul, avec un
// compte de file posé.
export function testRenduOptimizerLigneFile() {
  titre('rendu · Optimizer — ligne « N combinaison(s) en vérification… » de l’en-tête des résultats');
  const entete = (avecFile: boolean, enAttente: number) => rendre(
    <EnteteResultats
      result={{ nombre: 3, explored: 10, truncated: false, nearMissByCondition: [], globalNearMiss: null }}
      compteConfirmes={{ confirmees: 1, nonVerifies: 2, pages: 1, aucune: false }}
      avecFile={avecFile}
      sortBy="atk"
      setSortBy={() => {}}
      setResultsPage={() => {}}
      realDamage={null}
      enAttente={enAttente}
      compteAffiche={{ compte: 3, ecartes: 0, raison: null }}
    />,
  );
  ok(texteVisible(entete(true, 1234)).includes('1 234 combinaison(s) en vérification…'), 'file active, 1 234 en attente : la ligne le dit');
  const vide = entete(true, 0);
  ok(!texteVisible(vide).includes('en vérification') && /<p\b[^>]*>( |&nbsp;| )<\/p>/.test(vide),
    'file vide : la ligne reste, réduite à un espace insécable (sa hauteur est gardée)');
  ok(!texteVisible(entete(false, 5)).includes('en vérification') && !/<p\b[^>]*>( |&nbsp;| )<\/p>/.test(entete(false, 0)),
    'sans file : aucune ligne');
}

export function testRenduOptimizerResultatsCartes() {
  titre('rendu · Optimizer — grille des résultats : cartes de la page et places en vérification');
  const rangs = (html: string) => [...texteVisible(html).matchAll(/#(\d+)\b/g)].map((m) => Number(m[1]));
  const page1 = recherche({ status: 'done', result: resultat(3) }, { optimiserArtefacts: false });
  egal(rangs(page1), [1, 2, 3], 'sans file : une carte par build, rangs 1 à 3');
  ok(!texteVisible(page1).includes('Vérification…'), 'sans file : aucune place « Vérification… »');
  const page2 = recherche({ status: 'done', result: resultat(25) }, { optimiserArtefacts: false, resultsPage: 2 });
  egal(rangs(page2), [21, 22, 23, 24, 25], 'page 2 : le rang compte depuis le premier de la page');
  const file = recherche({ status: 'done', result: resultat(3) });
  egal(texteVisible(file).match(/Vérification…/g)?.length ?? 0, 3, 'file active, rien de vérifié : une place « Vérification… » par build de la page');
  egal(rangs(file), [1, 2, 3], '… numérotées comme les cartes qu’elles attendent');
}
