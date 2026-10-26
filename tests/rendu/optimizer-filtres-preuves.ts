// Preuves au navigateur des filtres d'affichage des résultats de l'Optimizer,
// sur le vrai écran (vrais hooks, vrais composants) : mémorisés par membre
// comme le tri (conservés après une recherche, effacés au changement de
// monstre, rétablis au retour), et branchés jusqu'au classeur.
import { cleMemoireMembre } from '../../src/lib/optimizerMemberStorage';
import { attendreDemandeTest, observerRechercheTest } from './optimizer-classement-banc';
import type { DemandeDeRecherche } from '../../src/workers/runeBuildOptim.worker';
import type { BancEcran } from './optimizer-ecran-preuves';

type Preuves = [boolean, string][];
const visible = (e: Element) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
const bouton = (nom: string, racine: ParentNode = document) => [...racine.querySelectorAll<HTMLButtonElement>('button:not([role="switch"])')]
  .find((e) => visible(e) && (e.textContent?.trim() === nom || e.getAttribute('aria-label') === nom));
const json = (v: unknown) => JSON.stringify(v);

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
