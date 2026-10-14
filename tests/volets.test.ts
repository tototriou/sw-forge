// Écran partagé : les transitions des deux volets (src/lib/volets.ts), et le
// responsive qui suit la largeur du volet (scripts/lib/postcssVolets.ts).
//
// Ce qu'on garde : l'écran partagé s'ouvre sur un volet VIDE, que la prochaine
// page remplit ; la navigation va au volet actif ; une page ne s'ouvre jamais
// deux fois ; un volet verrouillé ne change jamais de page par navigation et
// ne se ferme pas ; un seul verrou à la fois ; dans un volet, une page se met
// en page comme sur une fenêtre plus large de la barre et des marges.

import postcss, { type AcceptedPlugin, type AtRule } from 'postcss';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import {
  activer, basculerPartage, basculerVerrou, coteVide, EtatVolets, ETAT_VOLETS_INITIAL, fermer, inverser,
  largeurMinVolet, LARGEUR_MIN_CONTENU, naviguer, ouvrirACote, PageVolet, pageDuCote, palierContenu,
  requeteDansVolet, SEUIL_CONTENU_BUREAU, seuilContenu, seuilPartage,
} from '../src/lib/volets';
import { conditionConteneur, horsVolet, postcssVolets } from '../scripts/lib/postcssVolets';
import { egal, ok, titre } from './outils';

const meme = (a: string, b: string) => a === b;
const p = (adresse: string): PageVolet => ({ adresse, fil: [adresse] });

const RTA = p('#/rta');
const OPTIM = p('#/outils/optimizer');
const RUNES = p('#/compte/runes/liste');

/** RTA à gauche (actif), Optimizer à droite. */
function partageRtaOptim(e: Partial<EtatVolets> = {}): EtatVolets {
  return { ...ETAT_VOLETS_INITIAL, partage: true, actif: 'gauche', autre: OPTIM, ...e };
}

export function testVoletsOuverture() {
  titre('Volets — ouvrir sur un volet vide, le remplir, fermer');

  const ouvert = basculerPartage(ETAT_VOLETS_INITIAL, RTA);
  ok(ouvert.etat.partage && ouvert.adresse === undefined, '« Écran partagé » ouvre sans changer de page');
  egal(coteVide(ouvert.etat), 'droite', 'le volet vide est à droite, la page courante à gauche');

  const rempli = naviguer(ouvert.etat, RTA, OPTIM.adresse, meme);
  egal(rempli.actif, 'droite', 'la page ouverte ensuite remplit le volet vide, qui devient actif');
  egal(rempli.autre, RTA, 'la page d\'avant reste à gauche');
  egal(coteVide(rempli), null, 'plus de volet vide');
  egal(pageDuCote(rempli, OPTIM, 'gauche'), RTA, 'pageDuCote lit la page mémorisée pour le volet inactif');
  egal(naviguer(ouvert.etat, RTA, RTA.adresse, meme), ouvert.etat, 'la page déjà affichée ne remplit pas le volet vide');

  const aCote = ouvrirACote(ouvert.etat, RTA, RUNES.adresse, meme);
  ok(aCote.adresse === RUNES.adresse && aCote.etat.actif === 'droite' && aCote.etat.autre === RTA,
    '« Ouvrir à côté » remplit aussi le volet vide');

  egal(basculerVerrou(ouvert.etat, 'droite'), ouvert.etat, 'un volet vide ne se verrouille pas');
  const fermeVide = basculerPartage(ouvert.etat, RTA);
  ok(!fermeVide.etat.partage && fermeVide.adresse === undefined, 'le bouton referme le volet vide');
  ok(!fermer(ouvert.etat, RTA, 'gauche').etat.partage && fermer(ouvert.etat, RTA, 'gauche').adresse === undefined,
    'fermer la page à côté d\'un volet vide : c\'est le vide qui part, la page reste');

  const deux = ouvrirACote(ETAT_VOLETS_INITIAL, RTA, OPTIM.adresse, meme);
  ok(deux.adresse === OPTIM.adresse && deux.etat.actif === 'droite' && deux.etat.autre === RTA,
    'hors écran partagé, « Ouvrir à côté » ouvre directement la page à droite');
  egal(ouvrirACote(ETAT_VOLETS_INITIAL, RTA, RTA.adresse, meme).etat, ETAT_VOLETS_INITIAL,
    'ouvrir à côté la page déjà affichée ne fait rien');
  const fermeActif = fermer(deux.etat, OPTIM, 'droite');
  ok(!fermeActif.etat.partage && fermeActif.adresse === RTA.adresse, 'fermer le volet actif rend l\'adresse à l\'autre');
  egal(fermer(deux.etat, OPTIM, 'gauche').adresse, undefined, 'fermer le volet inactif garde la page active');
}

export function testVoletsNavigation() {
  titre('Volets — la navigation va au volet actif');

  const e = partageRtaOptim();
  egal(naviguer(e, RTA, RUNES.adresse, meme), e, 'une nouvelle page remplace celle du volet actif, l\'autre ne bouge pas');

  const dejaOuverte = naviguer(e, RTA, OPTIM.adresse, meme);
  egal(dejaOuverte.actif, 'droite', 'une page déjà ouverte dans l\'autre volet active ce volet');
  egal(dejaOuverte.autre, RTA, 'sans l\'ouvrir une seconde fois');

  const act = activer(e, RTA, 'droite');
  egal(act.adresse, OPTIM.adresse, 'activer un volet donne son adresse à la barre d\'adresse');
  egal(act.etat.autre, RTA, 'et mémorise la page qu\'on quitte, avec son fil');
  egal(activer(e, RTA, 'gauche').etat, e, 'activer le volet déjà actif ne change rien');

  egal(naviguer(ETAT_VOLETS_INITIAL, RTA, RUNES.adresse, meme), ETAT_VOLETS_INITIAL,
    'hors écran partagé, la navigation ne touche pas l\'état des volets');
}

export function testVoletsVerrou() {
  titre('Volets — un volet verrouillé ne change pas de page');

  const verrouille = basculerVerrou(partageRtaOptim(), 'gauche');
  egal(verrouille.verrou, 'gauche', 'le volet se verrouille');
  egal(basculerVerrou(verrouille, 'droite'), verrouille, 'un seul volet verrouillé à la fois');
  egal(basculerVerrou(verrouille, 'gauche').verrou, null, 'le même geste déverrouille');

  const nav = naviguer(verrouille, RTA, RUNES.adresse, meme);
  egal(nav.actif, 'droite', 'naviguer depuis le volet verrouillé ouvre la page dans l\'autre volet');
  egal(nav.autre, RTA, 'la page verrouillée reste en place');
  egal(nav.verrou, 'gauche', 'et reste verrouillée');

  egal(fermer(verrouille, RTA, 'gauche').etat, verrouille, 'un volet verrouillé ne se ferme pas');
  const bascule = basculerPartage(partageRtaOptim({ verrou: 'droite' }), RTA);
  ok(!bascule.etat.partage && bascule.adresse === OPTIM.adresse,
    'le bouton « Écran partagé » ferme le volet non verrouillé, même actif');

  const verrouDroite = basculerVerrou(partageRtaOptim(), 'droite');
  const aCote = ouvrirACote(verrouDroite, RTA, RUNES.adresse, meme);
  ok(aCote.adresse === RUNES.adresse && aCote.etat.autre === OPTIM && aCote.etat.actif === 'gauche',
    'ouvrir à côté d\'un volet verrouillé navigue dans le volet actif');

  const inverse = inverser(verrouille);
  ok(inverse.verrou === 'droite' && inverse.actif === 'droite', 'inverser : le verrou et l\'activité suivent leur page');
  egal(inverser({ ...verrouille, taille: 62 }).taille, 38, 'inverser : la largeur suit aussi sa page');
}

export function testVoletsLargeurs() {
  titre('Volets — un plancher commun, pas de minimum par page');

  egal(largeurMinVolet(), LARGEUR_MIN_CONTENU + 2 * 24 + 2, 'le plancher : la largeur utile d\'un téléphone, marges du volet comprises');
  egal(seuilPartage(248), 248 + 2 * 12 + 2 * largeurMinVolet() + 12, 'barre dépliée : deux planchers, les marges et le séparateur');
  ok(seuilPartage(248) <= 1440, `l'écran partagé tient sur un portable de 1 440 px (seuil ${seuilPartage(248)})`);
  egal(seuilPartage(56), 1024, 'jamais sous le seuil de bureau : pas d\'écran partagé au téléphone ni à la tablette');
}

export function testVoletsResponsive() {
  titre('Volets — le responsive suit la largeur du volet');

  // Un seuil de fenêtre devient la largeur de contenu la plus étroite à
  // laquelle il s'applique hors écran partagé.
  egal(seuilContenu(640), 592, 'sm : la fenêtre moins les marges de la page');
  egal(seuilContenu(1024), 728, 'lg : moins aussi la barre latérale dépliée');
  egal(seuilContenu(1280), 984, 'xl : idem');
  egal(requeteDansVolet('(max-width: 1023px)', 728), false, '728 px de contenu : mise en page de bureau (SOUS_LG faux)');
  egal(requeteDansVolet('(max-width: 1023px)', 727), true, 'un pixel de moins : format téléphone');
  egal(requeteDansVolet('(max-width: 639px)', 591), true, 'SOUS_SM sous 592 px de contenu');
  egal(requeteDansVolet('(max-width: 639px)', 592), false, 'et plus à 592');
  egal(requeteDansVolet('(min-width: 1280px)', 984), true, 'xl : atteint à 984 px de contenu');
  egal(requeteDansVolet('(pointer: coarse)', 800), null, 'une requête de pointeur reste celle de la fenêtre');
  egal(palierContenu(900), SEUIL_CONTENU_BUREAU, 'un volet ne prévient sa page qu\'au franchissement d\'un seuil');
  egal(palierContenu(500), 0, 'sous le premier seuil : format téléphone étroit');

  egal(conditionConteneur('(min-width: 1280px)'), '(min-width: 984px)', '@media xl → @container sur le contenu');
  egal(conditionConteneur('(min-width: 640px)'), '(min-width: 592px)', '@media sm → @container sur le contenu');
  egal(conditionConteneur('not all and (min-width: 1024px)'), 'not (min-width: 728px)', 'max-lg → sa négation');
  egal(conditionConteneur('(hover: hover) and (pointer: fine)'), null, 'le survol n\'est pas touché');

  egal(horsVolet('.lg\\:flex'), '.lg\\:flex:where(:not([data-volet] *))', 'l\'exclusion se pose sur le sujet');
  egal(horsVolet('.lg\\:placeholder\\:x::placeholder'), '.lg\\:placeholder\\:x:where(:not([data-volet] *))::placeholder',
    'avant le pseudo-élément, jamais après ; les « : » échappés ne comptent pas');

  const sortie = postcss([postcssVolets()]).process(
    '.a{color:red}@media (min-width: 1024px){.lg\\:flex{display:flex}}@media (pointer: coarse){.b{color:blue}}',
    { from: undefined }
  ).css;
  ok(sortie.includes('@media (min-width: 1024px){.lg\\:flex:where(:not([data-volet] *)){display:flex}}'),
    'hors volet : la règle reste liée à la fenêtre, sans gagner de spécificité');
  ok(sortie.includes('@container volet (min-width: 728px){.lg\\:flex{display:flex}}'), 'dans un volet : la même règle, liée au volet');
  ok(sortie.includes('@media (pointer: coarse){.b{color:blue}}') && sortie.includes('.a{color:red}'),
    'le reste de la feuille est intact');
}

const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// Toutes les formes de classes responsives que l'app emploie : les seuils,
// leur négation (`max-lg:`), les variantes maison de pointeur et de survol
// (tailwind.config.js), une variante imbriquée, un pseudo-élément.
const CLASSES_ESSAI = [
  'flex', 'sm:grid', 'md:flex', 'lg:flex', 'xl:grid-cols-3', '2xl:grid-cols-4', 'max-lg:hidden',
  'hoverable:bg-panel2', 'compact:gap-1', 'group-hoverable:opacity-100', 'lg:hoverable:bg-panel2',
  'placeholder:text-ink-dimmer', 'lg:placeholder:text-ink',
];

export async function testVoletsFeuilleTailwind() {
  titre('Volets — le plugin sur la feuille de Tailwind, configuration du dépôt');
  // La configuration et le Tailwind du dépôt, ceux qu'emploie vite.config.ts.
  const exiger = createRequire(join(racine, 'package.json'));
  const tailwindcss = exiger('tailwindcss') as (config: unknown) => AcceptedPlugin;
  const chargerConfig = exiger('tailwindcss/loadConfig') as (chemin: string) => Record<string, unknown>;
  const config = chargerConfig(join(racine, 'tailwind.config.js'));
  const contenu = [{ raw: `<div class="${CLASSES_ESSAI.join(' ')}"></div>`, extension: 'html' }];
  const css = (await postcss([tailwindcss({ ...config, content: contenu }), postcssVolets()])
    .process('@tailwind utilities;', { from: undefined })).css;

  const premiers = postcss.parse(css).nodes.filter((n): n is AtRule => n.type === 'atrule');
  const deLargeur = premiers.filter((n) => n.name === 'media' && conditionConteneur(n.params) !== null);
  const autres = premiers.filter((n) => n.name === 'media' && conditionConteneur(n.params) === null);
  const conteneurs = premiers.filter((n) => n.name === 'container');
  const selecteurs = (n: AtRule) => {
    const s: string[] = [];
    n.walkRules((r) => { s.push(...r.selectors); });
    return s;
  };

  ok(deLargeur.length >= 6, `les six formes de seuil sont émises (${deLargeur.length} blocs @media de largeur)`);
  egal(conteneurs.length, deLargeur.length, 'chaque @media de largeur a sa copie @container volet');
  ok(deLargeur.every((m) => selecteurs(m).every((s) => s.includes(':where(:not([data-volet] *))'))),
    'hors volet : chaque règle d\'un @media de largeur exclut ce qui est dans un volet');
  ok(autres.length > 0 && autres.every((m) => selecteurs(m).every((s) => !s.includes('data-volet'))),
    'survol et pointeur (`hoverable:`, `compact:`) : intacts, ils restent ceux de la fenêtre');
  const params = conteneurs.map((c) => c.params);
  for (const attendu of ['volet (min-width: 592px)', 'volet (min-width: 728px)', 'volet (min-width: 984px)', 'volet not (min-width: 728px)']) {
    ok(params.includes(attendu), `@container ${attendu}`);
  }
  ok(conteneurs.some((c) => { let imbrique = false; c.walkAtRules('media', () => { imbrique = true; }); return imbrique; }),
    'une variante imbriquée (`lg:hoverable:`) voyage avec sa règle dans le @container');
  ok(css.includes(':where(:not([data-volet] *))::placeholder'), 'un pseudo-élément garde l\'exclusion avant lui');
}
