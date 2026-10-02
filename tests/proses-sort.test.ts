// degats-et-aura 11bis — les proses de sort au CLIC, sur les deux formats.
//
// Deux vérifications, sur la source (le dépôt n'a pas d'infrastructure de test
// React, voir tests/run.mjs) :
// 1. `testProsesSortAuClic` — « Compétence utilisée » : la prose d'un sort
//    s'ouvre par un « ? » juste à droite de son nom (`HelpPopover`), plus par
//    un `title` ; le « ? » vit HORS du bouton de la case, par l'axe
//    `actionTitre` d'`Option` (src/ui/Option.tsx).
// 2. `testEffetsActifsInfobulle` — « Effets actifs » : l'infobulle de la
//    rangée est DÉRIVÉE de la liste qui rend les vignettes (`effetsActifs`) :
//    mêmes descriptions, seulement les effets affichés pour le sort choisi.

import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';

const lire = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

// Le code seul : un commentaire qui CITE l'ancien `title` ne doit ni faire
// échouer ni faire passer un contrôle.
const sansCommentaires = (s: string) =>
  s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

// Le texte entre `debut` (inclus) et la première occurrence de `fin` qui suit ;
// vide si l'un des deux manque, pour que le contrôle qui en dépend échoue.
function entre(source: string, debut: string, fin: string): string {
  const i = source.indexOf(debut);
  if (i < 0) return '';
  const j = source.indexOf(fin, i + debut.length);
  return j < 0 ? '' : source.slice(i, j);
}

export function testProsesSortAuClic() {
  titre('Prose de sort au clic — l’axe `actionTitre` d’Option, hors du bouton principal (degats-et-aura 11bis)');

  const option = sansCommentaires(lire('src/ui/Option.tsx'));
  ok(/\n\s*actionTitre\?: ReactNode;\n/.test(option), 'Option : axe `actionTitre?: ReactNode`');
  const brancheAction = entre(option, 'if (actionTitre != null && actionTitre !== false) {', '\n  return (\n    <button');
  ok(brancheAction.length > 0, 'Option : une branche propre à la case qui porte une action');
  const boutons = brancheAction.match(/<button\b[\s\S]*?>/g) ?? [];
  egal(boutons.length, 1, 'case avec action : un seul <button>, le principal');
  ok(/\/>$/.test(boutons[0] ?? ''), 'case avec action : le bouton principal est VIDE (auto-fermant) — le « ? » ne peut pas être dedans');
  ok(!/<\/button>/.test(brancheAction), 'case avec action : aucun </button>, donc aucun contenu dans un bouton');
  const posBouton = brancheAction.indexOf('<button');
  const posAction = brancheAction.indexOf('{actionTitre}');
  ok(posBouton >= 0 && posAction > posBouton, 'case avec action : l’action est rendue APRÈS le bouton principal, dans le cadre');
  ok(/<div className="relative flex-none">\{actionTitre\}<\/div>/.test(brancheAction),
    'action : positionnée (`relative`) pour passer devant le bouton, sans `z-index`, jamais estompée');
  ok(/aria-labelledby=\{description \? `\$\{idTitre\} \$\{idDescription\}` : idTitre\}/.test(brancheAction),
    'bouton principal : nommé par le titre et la description (lus une fois, `aria-hidden` sur le texte)');
  ok(/className="absolute -inset-px rounded-xl disabled:cursor-not-allowed"/.test(brancheAction),
    'bouton principal : couvre toute la case, bordure comprise — cliquer ailleurs que sur l’action choisit l’option');
  ok(/data-cible-fine/.test(brancheAction), 'bouton principal : exempté de la règle tactile (la case est la cible)');
  ok(/has-\[>button:active\]:scale-\[0\.97\]/.test(option) && /\$\{PRESSION_CADRE\}/.test(brancheAction),
    'cadre : s’enfonce à l’appui du seul bouton principal, pas de l’action');
  egal((brancheAction.match(/\$\{estompe\}/g) ?? []).length, 3, 'désactivée : icône, titre et description estompés (trois), l’action non');
  ok(!/opacity-40/.test(brancheAction.replace("const estompe = desactive ? 'opacity-40' : '';", '')),
    'désactivée : aucune opacité sur le cadre (elle estomperait l’action)');
  const brancheSans = entre(option, '\n  return (\n    <button', '\n});');
  ok(/<button[\s\S]*\{titre\}[\s\S]*\{description\}[\s\S]*<\/button>/.test(brancheSans) && !/actionTitre/.test(brancheSans),
    'sans action : la case reste le <button> d’avant, titre et description dedans');

  titre('Prose de sort au clic — « Compétence utilisée » (DamageSetupCard.tsx)');

  const carte = sansCommentaires(lire('src/components/outils/DamageSetupCard.tsx'));
  ok(!/title=\{s\.description/.test(carte), 'plus aucun `title={s.description…}` dans la carte');
  const sorts = entre(carte, '{skills.map((s) => {', '{champCoupsVariables(');
  ok(sorts.length > 0, 'précondition : la liste des cases de sort');
  egal((sorts.match(/\btitle=/g) ?? []).length, 1, 'cases de sort : un seul `title=`, celui du HelpPopover (titre de la bulle, pas un survol)');
  ok(/<HelpPopover title=\{s\.nom\} ariaLabel=\{`Description de \$\{s\.nom\}`\}>\s*\{s\.description\}\s*<\/HelpPopover>/.test(sorts),
    '« ? » : HelpPopover (bulle à la souris, panneau montant au doigt) au nom du sort, prose du jeu telle quelle');
  ok(/actionTitre=\{\s*s\.description \? \(\s*<HelpPopover/.test(sorts) && /<\/HelpPopover>\s*\) : undefined\s*\}/.test(sorts),
    '« ? » : posé par l’axe `actionTitre`, sous la seule condition d’une prose — un sort refusé garde le sien');
  const titreDeLaCase = entre(sorts, 'titre={', 'actionTitre={');
  ok(titreDeLaCase.length > 0 && !/HelpPopover/.test(titreDeLaCase), '« ? » : jamais dans `titre`, qui est dans le bouton de la case');
  ok(/aria-description=\{s\.description \?\? undefined\}/.test(sorts), 'prose toujours annoncée aux lecteurs d’écran (`aria-description` du bouton de la case)');
  ok(/^\s*<Option\n\s*key=\{s\.skillCom2usId\}/m.test(sorts), 'plus d’enveloppe <div title> : la case est l’`Option`, qui porte la clé');
}

export function testEffetsActifsInfobulle() {
  titre('« Effets actifs » — l’infobulle dérivée des descriptions des vignettes (degats-et-aura 11bis)');

  const carte = sansCommentaires(lire('src/components/outils/DamageSetupCard.tsx'));
  const bulle = carte.match(/<HelpPopover title="Effets actifs">([\s\S]*?)<\/HelpPopover>/)?.[1] ?? '';
  ok(bulle.length > 0, 'précondition : l’infobulle « Effets actifs »');
  ok(/\{effetsActifs\.map\(\(e\) => \(\s*<li key=\{e\.cle\}>\s*<b className="text-ink">\{e\.libelle\}<\/b> — \{e\.description\}\s*<\/li>\s*\)\)\}/.test(bulle),
    'infobulle : une ligne par effet de `effetsActifs`, le libellé et la description de sa vignette');
  egal(['Euldong', 'Mirinae', 'Deborah', 'Miriam', 'Matteo', 'Velaska', 'Marque', 'def break', 'ATQ +50'].filter((m) => bulle.includes(m)), [],
    'infobulle : aucun effet nommé ni décrit à la main');

  egal((carte.match(/<EffetVignette\b/g) ?? []).length, 1, 'carte : un seul <EffetVignette>, celui que rend la liste');
  ok(/\{effetsActifs\.map\(\(e\) => \(\s*<EffetVignette\s+key=\{e\.cle\}\s+icone=\{e\.icone\}\s+libelle=\{e\.libelle\}\s+description=\{e\.description\}\s+onClick=\{e\.basculer\}\s+actif=\{e\.actif\}\s+etroit=\{etroit\}\s*\/>\s*\)\)\}/.test(carte),
    'vignettes : rendues par `effetsActifs.map`, avec la même description (survol)');

  const construction = entre(carte, 'const effetsActifs: EffetActif[] = [];', '\n  return (');
  ok(construction.length > 0, 'précondition : la liste est construite avant le rendu');
  egal([...construction.matchAll(/cle: '([a-zA-Z]+)'/g)].map((m) => m[1]),
    ['defBreak', 'defBreakParLeSort', 'brand', 'euldong', 'mirinae', 'deborah', 'miriam', 'transmission', 'velaska'],
    'liste : les neuf effets, dans l’ordre d’affichage d’avant');
  egal([...construction.matchAll(/description: '[^']+'/g)].length, 9, 'liste : une description écrite par effet, une seule fois');

  // « Seulement les effets présents » : les conditions d'affichage d'avant.
  ok(/if \(montreDefEnnemie\) \{\s*effetsActifs\.push\(\{\s*cle: 'defBreak',/.test(construction), 'Def break : seulement si la DEF ennemie compte pour ce sort');
  ok(/if \(montreDefBreakParLeSort\) \{\s*effetsActifs\.push\(\{\s*cle: 'defBreakParLeSort',/.test(construction),
    '« Ce sort pose le def break » : seulement si le sort pose une réduction et que le monstre a un passif');
  ok(/if \(montreCrit\) \{\s*effetsActifs\.push\(\{\s*cle: 'euldong',/.test(construction), 'Euldong : seulement si le critique compte');
  ok(/if \(montreDefEnnemie\) \{\s*effetsActifs\.push\(\{\s*cle: 'deborah',/.test(construction), 'Deborah : seulement si la DEF ennemie compte');
  ok(/if \(\s*utilise\('ATK'\) \|\|\s*utilise\('DEF'\) \|\|\s*utilise\('SPD'\) \|\|\s*utilise\('Relative SPD'\) \|\|\s*critSiPlusRapide \|\|\s*bonusDegatsSelonVit\s*\) \{\s*effetsActifs\.push\(\{\s*cle: 'miriam',/.test(construction),
    'Miriam : seulement si une stat qu’elle amplifie compte');

  const vignette = sansCommentaires(lire('src/components/outils/EffetVignette.tsx'));
  ok(/title=\{description \?\? libelle\}/.test(vignette), 'EffetVignette : le survol de chaque vignette reste, en complément');
}
