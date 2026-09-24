// Tests de rendu — la coquille de l'app (barre latérale, barre du haut, onglets
// mobiles), affichée EN ENTIER par `App` sur chaque route. Principe dans
// tests/rendu/outils-rendu.tsx. Écrits AVANT le lot 4 de la refonte graphique
// (`spec/chantiers/refonte-graphique.md` § B.4) : ils fixent ce que la
// navigation permet, pas sa forme — le regroupement du menu décidé par Thomas
// (décision 5) doit les laisser verts.

import App from '../../src/App';
import { egal, faussLocalStorage, ok, titre } from '../outils';
import { boutons, rendre, texteVisible, valeurs } from './outils-rendu';

// `window` minimal : ce que l'app lit PENDANT le rendu (la route, les requêtes
// média). Le reste (écouteurs, défilement) ne sert qu'aux effets, qui ne
// tournent pas en rendu serveur.
function fenetre(hash: string) {
  const media = { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
  (globalThis as unknown as { window: unknown }).window = {
    location: { hash },
    matchMedia: () => media,
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    innerWidth: 1440,
    innerHeight: 900,
  };
}

function rendreApp(hash: string): string {
  faussLocalStorage();
  fenetre(hash);
  return rendre(<App />);
}

// La barre latérale bureau : tout ce qui précède son bouton de repli, qui la
// ferme toujours. (Ses <nav> n'ont pas de nom : on ne peut pas les viser.)
function barreLaterale(html: string): string {
  const fin = html.search(/aria-label="(Replier|Déplier) la navigation"/);
  return fin < 0 ? '' : html.slice(0, fin);
}

function ongletsMobiles(html: string): string {
  return html.match(/<nav[^>]*aria-label="Navigation principale"[\s\S]*?<\/nav>/)?.[0] ?? '';
}

// Chaque route et le titre que la barre du haut affiche (relevés sur le code
// d'avant la refonte).
const TITRES: [string, string][] = [
  ['#/', 'Accueil'],
  ['#/rta', 'Ma prépa'],
  ['#/rta/ami', 'Ami'],
  ['#/siege/defense', 'Défense'],
  ['#/siege/offense', 'Offense'],
  ['#/siege/recommandations', 'Recommandations'],
  ['#/compte/monstres/liste', 'Monstres'],
  ['#/compte/runes/resume', 'Runes · Résumé'],
  ['#/compte/runes/liste', 'Runes · Liste'],
  ['#/compte/runes/courbes', 'Runes · Courbes'],
  ['#/compte/runes/comparaison', 'Runes · Comparaison'],
  ['#/compte/runes/optimisation', 'Runes · Optimisation'],
  ['#/compte/runes/meules', 'Runes · Meules'],
  ['#/compte/runes/gemmes', 'Runes · Gemmes'],
  ['#/compte/artefacts/resume', 'Artéfacts · Résumé'],
  ['#/compte/artefacts/liste', 'Artéfacts · Liste'],
  ['#/outils/optimizer', 'Outils'],
  ['#/outils/speed-tuning', 'Outils'],
  ['#/bestiary', 'Bestiaire'],
  ['#/mecaniques', 'Mécaniques'],
  ['#/releases', 'Nouveautés'],
  ['#/parametres', 'Paramètres'],
  ['#/arene', 'Arène'],
];

// Ce que le menu bureau doit permettre d'atteindre par un lien. Hors liste :
// `#/parametres` (le bouton ⚙ y mène) ; Meules et Gemmes, retirées du menu par
// décision de Thomas — [retrait #6], cadrage A.2 bis — mais dont les ROUTES
// restent (vérifié plus bas : elles s'affichent toujours).
const HORS_MENU = new Set(['#/parametres', '#/compte/runes/meules', '#/compte/runes/gemmes']);

export function testRenduAppRoutes() {
  titre('rendu · App — chaque route s\'affiche, avec son titre');
  for (const [hash, attendu] of TITRES) {
    let t = '';
    try {
      t = texteVisible(rendreApp(hash));
    } catch (e) {
      ok(false, `${hash} : erreur de rendu — ${(e as Error).message}`);
      continue;
    }
    ok(t.includes(attendu), `${hash} → « ${attendu} »`);
  }
}

export function testRenduAppNavigation() {
  titre('rendu · App — la navigation bureau permet tout ce qu\'elle permettait');

  // Toutes les destinations sont atteignables par un lien du menu bureau, en
  // cumulant ce qu'il montre sur chaque route (il montre le niveau de la
  // section où l'on est).
  const atteintes = new Set<string>();
  for (const [hash] of TITRES) for (const href of valeurs(barreLaterale(rendreApp(hash)), 'href')) atteintes.add(href);
  for (const [hash] of TITRES) {
    if (HORS_MENU.has(hash)) continue;
    ok(atteintes.has(hash), `menu bureau : lien vers ${hash}`);
  }

  // Au premier niveau, chaque section reste NOMMÉE (bouton ou titre de groupe).
  const accueil = barreLaterale(rendreApp('#/'));
  const t = texteVisible(accueil);
  for (const nom of ['Accueil', 'RTA', 'Siège', 'Mon compte', 'Outils', 'Arène', 'Ressources', 'Bestiaire', 'Mécaniques', 'Nouveautés']) {
    ok(t.includes(nom), `menu bureau, premier niveau : « ${nom} » présent`);
  }

  // La recherche de pages vit au PREMIER niveau de la barre (relevé sur le code
  // d'avant la refonte : elle n'est pas rendue quand on est dans une section).
  ok(/aria-label="Rechercher une page"/.test(accueil), 'recherche de pages dans la barre, au premier niveau');

  // Ce qui vit dans la barre, quelle que soit la route.
  for (const hash of ['#/', '#/siege/defense', '#/compte/runes/liste']) {
    const b = barreLaterale(rendreApp(hash));
    ok(!!boutons(b).find((x) => x.texte.includes('Importer un compte') || x.ariaLabel === 'Importer un compte'), `${hash} : « Importer un compte » dans la barre`);
    ok(!!boutons(b).find((x) => x.texte === 'Paramètres' || x.ariaLabel === 'Paramètres' || x.title === 'Paramètres'), `${hash} : ⚙ Paramètres dans la barre`);
  }
  ok(/aria-label="Replier la navigation"/.test(rendreApp('#/')), 'bouton « Replier la navigation »');

  // Au deuxième niveau, un retour vers le premier.
  ok(texteVisible(barreLaterale(rendreApp('#/siege/defense'))).includes('Siège'), 'dans le Siège : la barre dit où l\'on est');
}

export function testRenduAppMobile() {
  titre('rendu · App — onglets mobiles inchangés (lot 4 = bureau seulement)');
  for (const hash of ['#/', '#/siege/defense', '#/compte/runes/liste']) {
    const html = rendreApp(hash);
    const onglets = texteVisible(ongletsMobiles(html));
    egal(onglets.split(' ').filter((m) => ['Accueil', 'RTA', 'Siège', 'Compte', 'Outils'].includes(m)), ['Accueil', 'RTA', 'Siège', 'Compte', 'Outils'], `${hash} : les cinq onglets, dans l'ordre`);
  }
  ok(/aria-label="Filtres et actions de la page"/.test(rendreApp('#/siege/defense')), 'bouton « Options » du panneau d\'actions mobile');
}
