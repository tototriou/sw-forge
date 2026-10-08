// Navigation simple — chaque adresse mène à la bonne page. Garde-fou demandé
// par le mainteneur le 2026-10-01 ; règles dans docs/02-app/transverse/ § Adresses.
//
// ⚠️ `ADRESSES` est LA table des adresses de l'app. Le test de rendu
// `testRenduAppLiensMorts` (tests/rendu/app.test.tsx) y confronte chaque lien
// `#/…` affiché : un lien ajouté à l'app sans être inscrit ici fait échouer
// la suite — c'est voulu, on dit alors où il mène.

import { parseHash } from '../src/App';
import { VUES_INVENTAIRE, hashVue, vueParDefaut, vueValide } from '../src/lib/accountViews';
import type { AccountSub } from '../src/App';
import { egal, ok, titre } from './outils';

// La page RÉELLEMENT affichée pour une adresse, en une chaîne lisible :
// `siege/offense`, `compte/runes/courbes`… Côté compte, la vue passe par
// `vueValide`, comme dans l'app au moment du rendu.
export function destination(hash: string): string {
  const n = parseHash(hash);
  switch (n.route) {
    case 'rta':
      return `rta/${n.rtaSub}`;
    case 'siege':
      return `siege/${n.siegeTab}`;
    case 'compte':
      return `compte/${n.accountSub}/${vueValide(n.accountSub, n.accountView)}`;
    case 'outils':
      return `outils/${n.toolSub}`;
    default:
      return n.route;
  }
}

// Toutes les adresses que l'app propose, et la page où chacune mène.
export const ADRESSES: Record<string, string> = {
  '#/': 'home',
  '#/rta': 'rta/prepa',
  '#/rta/ami': 'rta/ami',
  '#/siege/defense': 'siege/defense',
  '#/siege/offense': 'siege/offense',
  '#/siege/recommandations': 'siege/recos',
  '#/compte/monstres/liste': 'compte/monstres/liste',
  '#/compte/runes/resume': 'compte/runes/resume',
  '#/compte/runes/liste': 'compte/runes/liste',
  '#/compte/runes/courbes': 'compte/runes/courbes',
  '#/compte/runes/comparaison': 'compte/runes/comparaison',
  '#/compte/runes/optimisation': 'compte/runes/optimisation',
  '#/compte/runes/meules': 'compte/runes/meules',
  '#/compte/runes/gemmes': 'compte/runes/gemmes',
  '#/compte/artefacts/resume': 'compte/artefacts/resume',
  '#/compte/artefacts/liste': 'compte/artefacts/liste',
  // Adresses tronquées, utilisées par les cartes de l'accueil.
  '#/compte/runes': 'compte/runes/resume',
  '#/compte/artefacts': 'compte/artefacts/resume',
  '#/outils/optimizer': 'outils/optimizer',
  '#/outils/speed-tuning': 'outils/speed-tuning',
  '#/arene': 'arene',
  '#/bestiary': 'bestiary',
  '#/mecaniques': 'mecaniques',
  '#/releases': 'releases',
  // Application de bureau, décision 14 : sur le SITE (ici) ; dans l'app,
  // l'adresse retombe sur l'accueil (testNavigationAdressesBureau).
  '#/telecharger': 'telecharger',
  '#/parametres': 'parametres',
};

export function testNavigationAdresses() {
  titre('Navigation — chaque adresse mène à sa page');
  for (const [hash, attendu] of Object.entries(ADRESSES)) egal(destination(hash), attendu, `${hash} → ${attendu}`);

  // Deux adresses distinctes de la table ne mènent jamais à la même page, sauf
  // les formes tronquées, qui mènent par construction au défaut de leur section.
  const tronquees = new Set(['#/compte/runes', '#/compte/artefacts']);
  const pages = Object.entries(ADRESSES).filter(([h]) => !tronquees.has(h)).map(([, p]) => p);
  egal(pages.length, new Set(pages).size, 'chaque adresse complète mène à une page différente');

  // Dans l'app de bureau, la page « Télécharger » n'existe pas (décision 14).
  const pont = globalThis as { swblacksmithBureau?: unknown };
  pont.swblacksmithBureau = { bureau: true, plateforme: 'win32' };
  try {
    egal(destination('#/telecharger'), 'home', 'dans l\'app de bureau, #/telecharger → accueil');
  } finally {
    delete pont.swblacksmithBureau;
  }
}

export function testNavigationAdressesDefauts() {
  titre('Navigation — adresse vide, tronquée ou inconnue : jamais d\'écran vide');

  // Pas de hash du tout : premier chargement de l'app.
  for (const vide of ['', '#', '#/']) egal(destination(vide), 'home', `« ${vide} » → accueil`);

  // Tronquée : le défaut de la section.
  egal(destination('#/rta/'), 'rta/prepa', '#/rta/ → Ma prépa');
  egal(destination('#/siege'), 'siege/defense', '#/siege → Défense');
  egal(destination('#/compte'), 'compte/monstres/liste', '#/compte → Monstres');
  egal(destination('#/outils'), 'outils/optimizer', '#/outils → Optimizer');

  // Sous-page inconnue : le défaut de SA section, pas l'accueil.
  egal(destination('#/rta/inconnu'), 'rta/prepa', 'RTA inconnue → Ma prépa');
  egal(destination('#/siege/inconnu'), 'siege/defense', 'Siège inconnu → Défense');
  egal(destination('#/outils/inconnu'), 'outils/optimizer', 'outil inconnu → Optimizer');
  egal(destination('#/compte/inconnu/liste'), 'compte/monstres/liste', 'inventaire inconnu → Monstres');
  egal(destination('#/compte/runes/inconnue'), 'compte/runes/resume', 'vue de runes inconnue → Résumé');
  egal(
    destination('#/compte/artefacts/courbes'),
    'compte/artefacts/resume',
    'vue qui n’existe pas pour cet inventaire (les artéfacts n’ont pas de courbes) → Résumé'
  );

  // Section inconnue : l'accueil.
  egal(destination('#/nimportequoi'), 'home', 'section inconnue → accueil');

  // Aucune adresse, même mal formée, ne fait planter la lecture.
  for (const bizarre of ['#//', '#/compte//', '#/%20', '#/compte/runes/courbes/en-trop', '#/siege/offense?x=1', 'n’importe quoi']) {
    let page = '';
    try {
      page = destination(bizarre);
    } catch (e) {
      ok(false, `« ${bizarre} » : exception — ${(e as Error).message}`);
      continue;
    }
    ok(page !== '', `« ${bizarre} » → une page (${page}), sans exception`);
  }
}

export function testNavigationVuesCompte() {
  titre('Navigation — les vues de « Mon compte » ont chacune leur adresse');

  // Le défaut d'un inventaire : la première de ses vues.
  egal(vueParDefaut('monstres'), 'liste', 'Monstres : la box');
  egal(vueParDefaut('runes'), 'resume', 'Runes : le Résumé');
  egal(vueParDefaut('artefacts'), 'resume', 'Artéfacts : le Résumé');

  // `vueValide` garde une vue qui existe, remplace celle qui n'existe pas.
  egal(vueValide('runes', 'courbes'), 'courbes', 'Runes · Courbes existe : gardée');
  egal(vueValide('artefacts', 'courbes'), 'resume', 'Artéfacts · Courbes n’existe pas : Résumé');
  egal(vueValide('monstres', 'resume'), 'liste', 'Monstres · Résumé n’existe pas : la box');

  // Aller-retour : l'adresse écrite par `hashVue` (barre, onglets, liens
  // directs) se relit en la même vue, pour CHAQUE vue de chaque inventaire.
  for (const sub of Object.keys(VUES_INVENTAIRE) as AccountSub[]) {
    for (const v of VUES_INVENTAIRE[sub]) {
      const hash = hashVue(sub, v.key);
      egal(destination(hash), `compte/${sub}/${v.key}`, `${hash} se relit en ${sub} · ${v.label}`);
      ok(hash in ADRESSES, `${hash} figure dans la table des adresses`);
    }
  }
}
