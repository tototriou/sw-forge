// Preuves au navigateur des filtres d'affichage des résultats de l'Optimizer,
// sur le vrai écran (vrais hooks, vrais composants) : mémorisés par membre
// comme le tri (conservés après une recherche, effacés au changement de
// monstre, rétablis au retour), et branchés jusqu'au classeur.
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import { attendreDemandeTest, observerRechercheTest } from './optimizer-classement-banc';
import type { DemandeDeRecherche } from '../../src/workers/runeBuildOptim.worker';
import type { BancEcran } from './optimizer-ecran-preuves';
import type { GearSet } from '../../src/types';
import { computeStats } from '../../src/lib/stats';
import { ajouterObjetCandidat, creerColonnesCandidats, extraireBlocs } from '../../src/lib/candidatsCompacts';

type Preuves = [boolean, string][];
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (nom: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button:not([role="switch"])')]
  .find((e) => visible(e) && (e.textContent?.trim() === nom || e.getAttribute('aria-label') === nom));
const json = (v: unknown) => JSON.stringify(v);

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
const candidatSecond = { runeIds: [101, 102, 103, 104, 105, 106], effTotal: 0,
  stats: [{ key: 'atk', label: 'ATQ', suffix: '', base: 800, bonus: 0, total: 800 }] };
const resultatSecond = { status: 'done', progress: null,
  result: { candidates: [candidatSecond], explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null } };
const moyenneDeLaCarte = () => [...document.querySelectorAll<HTMLElement>('[data-carte-resultat] span')]
  .find((s) => visible(s) && s.children.length === 0 && /^Efficience moyenne :/.test(s.textContent?.trim() ?? ''))?.textContent?.trim() ?? '';

/**
 * La carte lit les runes du contexte de la recherche, celles que la borne
 * juge : l'inventaire vivant peut changer sous elle sans changer ce qu'elle
 * écrit.
 */
export async function preuvesCarteContexte(b: BancEcran & { changerRunes: (runes: never[]) => void }): Promise<Preuves> {
  const preuves: Preuves = [];
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  await b.geste(() => b.forcerRecherche(resultatSecond));
  for (let t = 0; t < 100 && !moyenneDeLaCarte(); t++) await attendre(100);
  const avant = moyenneDeLaCarte();
  preuves.push([/Efficience moyenne : \d/.test(avant) && !/: 0\.0%/.test(avant), `carte affichée avec sa mesure (${avant})`]);
  await b.geste(() => b.changerRunes([]));
  await attendre(200);
  const apres = moyenneDeLaCarte();
  preuves.push([apres === avant, `inventaire vidé sous la carte : elle écrit toujours la mesure de ses runes du contexte (${avant} → ${apres})`]);
  return preuves;
}

export async function preuvesFiltresMemoire(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  const memoire = () => b.listes().memories.get(cleMemoireMembre('a', b.premier))?.criteres;
  const bornes = { spd: { min: 200, max: null }, cr: { min: null, max: 90 } };
  await b.geste(() => b.etat().setBornesResultats(bornes));
  await b.geste(() => b.etat().setSensTri('asc'));
  preuves.push([json(memoire()?.bornesResultats) === json(bornes) && memoire()?.sensTri === 'asc',
    `saisie : bornes et sens écrits dans la mémoire du membre (${json(memoire()?.bornesResultats)}, ${memoire()?.sensTri})`]);

  await b.geste(() => b.etat().choisirMembre('a', b.second));
  preuves.push([json(b.etat().bornesResultats) === '{}' && b.etat().sensTri === 'desc',
    `changement de monstre : filtres effacés (${json(b.etat().bornesResultats)}, ${b.etat().sensTri})`]);
  await b.geste(() => b.etat().choisirMembre('a', b.premier));
  preuves.push([json(b.etat().bornesResultats) === json(bornes) && b.etat().sensTri === 'asc',
    `retour au monstre : filtres rétablis (${json(b.etat().bornesResultats)}, ${b.etat().sensTri})`]);

  // Une nouvelle recherche : le tri repart de l'objectif en décroissant, les bornes restent.
  const envois: DemandeDeRecherche[] = [], restaurer = observerRechercheTest(envois);
  try {
    await b.geste(() => bouton('Rechercher')!.click());
    await attendreDemandeTest(envois, 1);
    preuves.push([envois.length === 1, 'recherche lancée']);
    preuves.push([json(b.etat().bornesResultats) === json(bornes) && b.etat().sensTri === 'desc' && b.etat().sortBy === 'efficience',
      `après la recherche : bornes conservées, tri de l'objectif en décroissant (${json(b.etat().bornesResultats)}, ${b.etat().sortBy} ${b.etat().sensTri})`]);
  } finally {
    await b.geste(() => b.etat().effacerResultats());
    restaurer();
  }

  // Changement de monstre hors de la liste (bestiaire) : `resetSearch`.
  await b.geste(() => b.etat().resetSearch());
  preuves.push([json(b.etat().bornesResultats) === '{}' && b.etat().sensTri === 'desc',
    `changement de monstre au bestiaire : filtres effacés (${json(b.etat().bornesResultats)})`]);
  preuves.push([json(memoire()?.bornesResultats) === json(bornes),
    'la mémoire du membre garde ses filtres pour son retour']);
  return preuves;
}

// ── L'écran des filtres, dans un état posé ─────────────────────────────────
const enAvant = (e: Element | null | undefined) => !!e && !(e as HTMLElement).className.includes('invisible');
const champ = (nom: string) => [...document.querySelectorAll<HTMLInputElement>(`input[aria-label="${nom}"]`)].find(visible);
const encadreBad = (i: HTMLInputElement | undefined) => !!i && i.closest('div')!.className.includes('border-bad');
const texteDe = (selecteur: string) => [...document.querySelectorAll<HTMLElement>(selecteur)].find(visible)?.textContent?.trim() ?? '';
const telephone = () => innerWidth < 1024;

/**
 * La forme CARTES aux deux formats, dans un état posé par une vraie
 * publication du classeur : bornes contradictoires (minimum de VIT au-dessus
 * de son maximum), et « Dégâts réels » sans sort calculable.
 */
export async function preuvesFiltresEcran(b: BancEcran): Promise<Preuves> {
  const preuves: Preuves = [];
  const format = telephone() ? 'téléphone' : 'bureau';
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  await b.geste(() => b.etat().setBornesResultats({ spd: { min: 220, max: 200 }, degats_reels: { min: 1000, max: null } }));
  await b.geste(() => b.forcerRecherche(resultatSecond));
  for (let t = 0; t < 100 && !texteDe('[data-vue-vide]'); t++) await attendre(100);
  preuves.push([texteDe('[data-vue-vide]') === 'Vue vide : le minimum de VIT (220) dépasse son maximum (200).',
    `${format} : minimum > maximum, vue vide dite à la place des cartes (« ${texteDe('[data-vue-vide]')} »)`]);
  // Espaces de milliers (fine insécable) ramenées à l'espace simple.
  const comptes = texteDe('[data-ligne-comptes]').replace(/\s/g, ' ');
  preuves.push([/^Filtres : 0 visible · 1 masquée/.test(comptes) && comptes.includes('Dégâts réels ≥ 1 000 (inactive)'),
    `${format} : ligne de comptes et résumé, borne sans sort dite inactive (« ${comptes} »)`]);
  const filtrer = bouton("Filtrer l'affichage (2)");
  preuves.push([!!filtrer, `${format} : « Filtrer l'affichage (2) », le nombre de colonnes bornées`]);
  if (telephone()) {
    preuves.push([!document.querySelector('[role="group"][aria-label="Trier les résultats"]') && !bouton('Tableau')
      && !!document.querySelector('select[aria-label="Trier les résultats"]') && !!bouton('Trier du plus petit au plus grand'),
      'téléphone : pas de bande ni de choix cartes / tableau ; la liste de tri et son sens']);
  } else {
    const bande = document.querySelector('[role="group"][aria-label="Trier les résultats"]');
    const tetes = [...(bande?.querySelectorAll('button') ?? [])];
    const vit = tetes.find((t) => t.getAttribute('aria-label')?.startsWith('VIT'));
    const degats = tetes.find((t) => t.getAttribute('aria-label')?.startsWith('Dégâts réels'));
    preuves.push([tetes.length === 11 && enAvant(vit?.querySelector('[data-marque-borne]')) && !enAvant(tetes[0].querySelector('[data-marque-borne]')),
      `bureau : bande de onze têtes, le point « borne posée » sur VIT seulement (${tetes.length} têtes)`]);
    preuves.push([!!degats?.disabled && degats.title === 'Aucun sort calculable pour ce monstre', 'bureau : tête « Dégâts réels » grisée sans sort calculable']);
    preuves.push([!!bouton('Cartes') && !!bouton('Tableau'), 'bureau : le choix cartes / tableau au-dessus des résultats']);
  }
  if (!filtrer) return preuves;
  await b.geste(() => filtrer.click());
  await attendre(300);
  const dialogue = [...document.querySelectorAll('[role="dialog"]')].find((d) => visible(d) && d.textContent?.includes('Masque des builds déjà trouvés'));
  preuves.push([!!dialogue, `${format} : « Filtrer l'affichage » ouvre ${telephone() ? 'le panneau' : 'le flottant'} de la grille Min / Max`]);
  preuves.push([encadreBad(champ('VIT minimum affiché')) && encadreBad(champ('VIT maximum affiché')) && !encadreBad(champ('PV minimum affiché')),
    `${format} : les deux champs de VIT en ton « bad », les autres neutres`]);
  preuves.push([!!champ('Dégâts réels minimum affiché')?.disabled && champ('Dégâts réels minimum affiché')?.value === '1000',
    `${format} : borne de Dégâts réels gardée, inactive (champ grisé)`]);
  if (!telephone()) {
    // Le choix de forme : un réglage écrit dans sa clé, relu par la page.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await b.geste(() => bouton('Tableau')!.click());
    const racine = document.querySelector('[data-forme-resultats]');
    preuves.push([racine?.getAttribute('data-forme-resultats') === 'tableau' && localStorage.getItem('swblacksmith-optimizer-resultats-forme-v1') === 'tableau',
      `bureau : « Tableau » choisi et mémorisé (${localStorage.getItem('swblacksmith-optimizer-resultats-forme-v1')})`]);
    await b.geste(() => bouton('Cartes')!.click());
    preuves.push([localStorage.getItem('swblacksmith-optimizer-resultats-forme-v1') === 'cartes', 'bureau : retour aux cartes, mémorisé']);
  }
  await b.geste(() => b.forcerRecherche(null));
  return preuves;
}

// ── Branchement de bout en bout : écran, classeur, et retour ──────────────
function saisirChamp(i: HTMLInputElement, valeur: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(i, valeur);
  i.dispatchEvent(new Event('input', { bubbles: true }));
}
const cartesVisibles = () => [...document.querySelectorAll('[data-carte-resultat]')].filter(visible).length;

/**
 * testFiltresBranchementApp : la vraie recherche est observée, le vrai
 * classeur (Worker) reçoit le build par le port que l'écran lui a ouvert ; une
 * borne posée au clavier dans « Filtrer l'affichage » masque le build, son
 * relâchement le rend, sans relancer la recherche ni rien résoudre.
 */
export async function preuvesFiltresBranchement(b: BancEcran & { fiche: () => GearSet }): Promise<Preuves> {
  const preuves: Preuves = [];
  const format = telephone() ? 'téléphone' : 'bureau';
  await b.geste(() => b.etat().choisirMembre('a', b.second));
  await b.geste(() => b.etat().setComboSets(['energy']));
  await b.geste(() => b.etat().setOptimiserArtefacts(false));
  const envois: DemandeDeRecherche[] = [], restaurer = observerRechercheTest(envois);
  try {
    await b.geste(() => bouton('Rechercher')!.click());
    await attendreDemandeTest(envois, 1);
    const demande = envois[0];
    preuves.push([!!demande?.classement, `${format} : recherche lancée, port du classeur ouvert`]);
    if (!demande?.classement) return preuves;
    const fiche = b.fiche();
    const candidat = { runeIds: fiche.runes.map((r) => r.id), stats: computeStats(fiche), effTotal: 0 };
    const colonnes = creerColonnesCandidats(); ajouterObjetCandidat(colonnes, candidat);
    const [bloc] = extraireBlocs(colonnes);
    const { port, idRecherche } = demande.classement;
    port.postMessage({ type: 'candidats', idRecherche, sequence: 0, bloc });
    port.postMessage({ type: 'sceller', idRecherche, nombre: 1, derniereSequence: 0,
      bilan: { explored: 1, truncated: false, nearMissByCondition: [], globalNearMiss: null } });
    for (let t = 0; t < 100 && cartesVisibles() === 0; t++) await attendre(100);
    const cle = () => [...document.querySelectorAll('[data-carte-resultat]')].find(visible)?.textContent ?? '';
    const avant = cle();
    preuves.push([cartesVisibles() === 1 && texteDe('[data-ligne-comptes]').startsWith('Aucun filtre'),
      `${format} : le build publié par le classeur, « Aucun filtre » (${texteDe('[data-ligne-comptes]')})`]);

    await b.geste(() => bouton("Filtrer l'affichage")!.click());
    await attendre(200);
    await b.geste(() => saisirChamp(champ('VIT minimum affiché')!, '999'));
    for (let t = 0; t < 100 && cartesVisibles() > 0; t++) await attendre(100);
    preuves.push([cartesVisibles() === 0 && texteDe('[data-vue-vide]') === 'Aucune combinaison confirmée ne passe ces filtres.',
      `${format} : VIT ≥ 999 saisie, le classeur masque le build (« ${texteDe('[data-vue-vide]')} »)`]);
    preuves.push([/^Filtres : 0 visible · 1 masquée/.test(texteDe('[data-ligne-comptes]')), `${format} : comptes de la vue publiés (${texteDe('[data-ligne-comptes]')})`]);
    preuves.push([json(b.etat().bornesResultats) === json({ spd: { min: 999, max: null } }), `${format} : la borne est celle du membre (${json(b.etat().bornesResultats)})`]);

    await b.geste(() => saisirChamp(champ('VIT minimum affiché')!, ''));
    for (let t = 0; t < 100 && cartesVisibles() === 0; t++) await attendre(100);
    preuves.push([cartesVisibles() === 1 && cle() === avant, `${format} : borne relâchée, le même build revient, identique`]);
    preuves.push([envois.length === 1, `${format} : aucun filtre n'a relancé de recherche (${envois.length} demande)`]);
  } finally {
    await b.geste(() => b.etat().effacerResultats());
    restaurer();
  }
  return preuves;
}
