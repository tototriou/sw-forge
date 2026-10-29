import type { UseOptimizerLists } from '../../src/hooks/useOptimizerLists';
import type { ExclusionSelector } from '../../src/lib/optimizerExclusion';

interface Banc {
  listes: () => UseOptimizerLists;
  geste: (faire: () => void) => Promise<void>;
  premier: ExclusionSelector;
  second: ExclusionSelector;
  troisieme: ExclusionSelector;
}
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';

export async function preuvesBandesEquipes(b: Banc): Promise<[boolean, string][]> {
  const preuves: [boolean, string][] = [], verifier = (oui: boolean, texte: string) => preuves.push([oui, texte]);
  const pli = [...document.querySelectorAll<HTMLButtonElement>('button')].find(e => visible(e) && e.textContent?.trim() === 'Gérer mes listes');
  if (pli) await b.geste(() => pli.click());
  await b.geste(() => {
    b.listes().setListContent('a', 'guilde');
    b.listes().setTeams([
      { id: 'ea', listId: 'a', members: [b.premier, b.second], leader: b.premier,
        lead: { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } },
      { id: 'eb', listId: 'a', members: [b.troisieme, { source: 'rta', monsterId: '1' }],
        lead: { stat: 'HP', amount: 33, area: 'General', element: null } },
    ]);
  });
  const groupe = (nom: string) => [...document.querySelectorAll<HTMLElement>(`section[aria-label="${nom}"]`)].find(visible)!;
  const a = groupe('Équipe 1'), autre = groupe('Équipe 2'), libres = groupe('Sans équipe');
  const cartes = (g: Element) => [...g.querySelectorAll<HTMLButtonElement>('button[aria-label="Retirer de la liste"]')].map(e => e.parentElement!);
  const lignes = [...cartes(a), ...cartes(autre), ...cartes(libres)];
  const hauteur = cartes(libres)[0].getBoundingClientRect().height;
  verifier(lignes.length === 5 && lignes.every(e => e.getBoundingClientRect().height === hauteur), 'toutes les cartes liées ont la hauteur d’une carte libre');
  // La carte du monstre affiché (`aria-current`) a son propre aspect.
  const ordinaire = (e: Element) => !e.hasAttribute('aria-current');
  const reference = cartes(a).find(ordinaire)!;
  verifier(cartes(libres).filter(ordinaire).every(e => e.className === reference.className), 'cartes liées et libres : même aspect');
  verifier(a.contains(a.querySelector('img[src*="leader_skill_"]')) && a.textContent!.includes('Leader : Premier')
    && cartes(a).length === 2 && [...a.querySelectorAll('button')].some(e => e.textContent === 'Modifier l’équipe'), 'bande : numéro, leader, LeadPill, modifier et deux cartes');
  const centre = (e: Element) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; };
  const titre = [...a.querySelectorAll('span')].find(e => e.textContent?.startsWith('Équipe 1'))!;
  const modifier = [...a.querySelectorAll('button')].find(e => e.textContent === 'Modifier l’équipe')!;
  verifier([a.querySelector('img[src*="leader_skill_"]')!, modifier].every(e => Math.abs(centre(e) - centre(titre)) < 2),
    `en-tête : LeadPill, numéro, leader et modifier sur une seule ligne — ${[titre, modifier].map(centre).join(' / ')}`);
  verifier(libres.firstElementChild?.textContent === 'Sans équipe' && !!(a.compareDocumentPosition(libres) & Node.DOCUMENT_POSITION_FOLLOWING), 'les libres suivent sous Sans équipe');
  const styleA = getComputedStyle(a), styleB = getComputedStyle(autre);
  const jeton = (nom: string) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(nom).trim().split(/\s+/).join(', ')})`;
  verifier(styleA.backgroundColor === jeton('--equipe-a') && styleB.backgroundColor === jeton('--equipe-b')
    && styleA.backgroundColor !== styleB.backgroundColor, 'bandes alternées : deux teintes émises par Tailwind');
  const rgb = (couleur: string) => couleur.match(/[\d.]+/g)!.map(Number);
  const luminance = (couleur: number[]) => couleur.slice(0, 3).reduce((s, v, i) => {
    const c = v / 255;
    return s + (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
  }, 0);
  const ratio = (texte: number[], fond: number[]) => {
    const t = luminance(texte), f = luminance(fond);
    return (Math.max(t, f) + 0.05) / (Math.min(t, f) + 0.05);
  };
  const composite = (g: Element, carte: Element) => {
    const fond = rgb(getComputedStyle(g).backgroundColor), surface = rgb(getComputedStyle(carte).backgroundColor);
    return fond.map((v, i) => surface[i] * (surface[3] ?? 1) + v * (1 - (surface[3] ?? 1)));
  };
  const contrastes = [a, autre].flatMap(g => {
    const fond = rgb(getComputedStyle(g).backgroundColor), carte = composite(g, cartes(g).find(ordinaire)!);
    return ['--ink', '--ink-dim', '--ink-dimmer', '--warn'].flatMap(nom => {
      const texte = rgb(jeton(nom));
      return [ratio(texte, fond), ratio(texte, carte)];
    });
  });
  verifier(contrastes.every(r => r >= 4.5), `encres des bandes et des cartes : contraste minimal ${Math.min(...contrastes).toFixed(2)}:1`);
  // Sur le voile du monstre affiché, les encres de texte qu'il garde, relevées
  // sur ses textes posés à même le voile (pas ceux de l'avatar, sur son fond).
  const choisie = cartes(a).find(e => !ordinaire(e));
  const surLeVoile = (e: Element) => {
    for (let p: Element | null = e; p && p !== choisie; p = p.parentElement) if (rgb(getComputedStyle(p).backgroundColor)[3] !== 0) return false;
    return true;
  };
  const encresChoisie = choisie ? [...new Set([...choisie.querySelectorAll<HTMLElement>('span')]
    .filter(e => visible(e) && surLeVoile(e) && [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()))
    .map(e => getComputedStyle(e).color))].map(c => ratio(rgb(c), composite(a, choisie))) : [];
  // La mise en évidence elle-même : contour du trait de sa bande, fond distinct
  // d'une carte ordinaire comme de la bande.
  const styleChoisie = choisie ? getComputedStyle(choisie) : null;
  verifier(!!styleChoisie && styleChoisie.borderTopColor === jeton('--equipe-a-trait')
    && styleChoisie.backgroundColor !== getComputedStyle(reference).backgroundColor
    && composite(a, choisie!).join() !== rgb(styleA.backgroundColor).slice(0, 3).join(),
  `monstre affiché : contour et fond aux couleurs de sa bande (${styleChoisie?.borderTopColor} · ${styleChoisie?.backgroundColor})`);
  verifier(!!choisie && encresChoisie.length > 0 && encresChoisie.every(r => r >= 4.5),
    `monstre affiché : carte mise en évidence, ses textes lisibles (${encresChoisie.map(r => r.toFixed(2)).join(' / ')})`);
  verifier([a, autre].every(e => ['Top', 'Right', 'Bottom', 'Left'].every(cote => getComputedStyle(e).getPropertyValue(`border-${cote.toLowerCase()}-width`) === '0px')), 'bandes sans contour');
  verifier(!a.querySelector('[aria-label^="Lead inactif"]') && !autre.querySelector('[aria-label^="Lead inactif"]'), 'lead actif : aucune icône ni cible accessible');
  const geometrie = () => JSON.stringify(lignes.map(e => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height, ...[...e.querySelectorAll('button')].filter(b => !b.getAttribute('aria-label')?.startsWith('Lead inactif')).flatMap(b => {
      const p = b.getBoundingClientRect(); return [p.x, p.y, p.width, p.height];
    })];
  }));
  const avant = geometrie();
  await b.geste(() => b.listes().setListContent('a', 'donjon'));
  verifier(geometrie() === avant, 'contenu incompatible : cartes et contrôles aux mêmes positions');
  verifier(a.querySelectorAll('[aria-label^="Lead inactif"]').length === 2
    && [...a.querySelectorAll('span')].some(e => visible(e) && e.textContent === '⚠ 2 leads inactifs'), 'contenu incompatible : deux icônes et compte dérivé dans l’en-tête');
  await b.geste(() => b.listes().setTeams(b.listes().teams.map(e => e.id === 'ea' ? { ...e,
    lead: { stat: 'Attack Speed', amount: 24, area: 'Element', element: 'fire' } } : e)));
  verifier(geometrie() === avant, 'changement du lead : cartes et contrôles aux mêmes positions');
  verifier(a.querySelectorAll('[aria-label^="Lead inactif"]').length === 1
    && [...a.querySelectorAll('span')].some(e => visible(e) && e.textContent === '⚠ 1 lead inactif'), 'lead d’élément : seule la carte incompatible porte une icône et le compte vaut un');
  await b.geste(() => b.listes().setTeams(b.listes().teams.map(e => e.id === 'ea' ? { ...e, lead: null } : e)));
  verifier(!a.querySelector('[aria-label^="Lead inactif"]') && geometrie() === avant, 'équipe sans lead : aucune alerte et positions conservées');
  await b.geste(() => b.listes().setTeams(b.listes().teams.map(e => e.id === 'ea' ? { ...e,
    lead: { stat: 'Attack Speed', amount: 24, area: 'Element', element: 'fire' } } : e)));
  verifier(document.documentElement.scrollWidth <= window.innerWidth, 'bandes et cartes sans débordement horizontal');
  return preuves;
}
