import { baseCompleteCriteres, CLASSEMENT_CHAMPS_OPTIMIZER, criteresApresChangementEspece, photoCriteres } from '../src/lib/criteresOptimizer';
import { CHAMPS_OPTIMIZER_SESSION } from '../src/lib/sessionOptimizer';
import { CLES_SESSION, composerSession, ecrireSession, lireSession, valeurStockageValide } from '../src/lib/session';
import { CLE_FORME_RESULTATS, lireFormeResultats } from '../src/hooks/useFormeResultats';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer } from '../src/lib/optimizerMemberStorage';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import { egal, ok, titre } from './outils';

// Les filtres d'affichage des résultats (sens du tri, bornes par colonne)
// suivent le membre comme le tri : critères personnels, mémoire, session.
// Une mémoire écrite avant eux se relit avec leurs défauts.

const box: ExclusionSelector = { source: 'box', unitKey: '11' };
function stockage(criteres: Record<string, unknown>) {
  return JSON.stringify({ memories: [[cleMemoireMembre('l1', box), { listId: 'l1', selector: box, com2usId: 10001, criteres }]], teams: [], listContents: [] });
}
const lire = (criteres: Record<string, unknown>) => lireMembresOptimizer(stockage(criteres));

export function testFiltresResultatsMemoire() {
  titre('Filtres d’affichage des résultats — critères personnels, mémoire de membre, session');
  const base = baseCompleteCriteres(undefined);
  egal([base.sensTri, base.bornesResultats], ['desc', {}], 'base : décroissant, aucune borne');
  ok(CLASSEMENT_CHAMPS_OPTIMIZER.sensTri === 'personnel' && CLASSEMENT_CHAMPS_OPTIMIZER.bornesResultats === 'personnel',
    'sens et bornes sont des critères personnels (suivent le membre)');
  ok((['sensTri', 'bornesResultats'] as const).every((c) => (CHAMPS_OPTIMIZER_SESSION as readonly string[]).includes(c)),
    'sens et bornes entrent dans la session, comme le tri');
  const apres = criteresApresChangementEspece({ ...base, sensTri: 'asc', bornesResultats: { spd: { min: 200, max: null } } } as typeof base, 'membre', undefined);
  egal([apres.sensTri, apres.bornesResultats], ['desc', {}], 'changement de monstre : les filtres tombent');

  // Une mémoire écrite avant les filtres.
  const { sensTri: _s, bornesResultats: _b, ...ancienne } = { ...base, minStats: { spd: 210 }, sortBy: 'hp' };
  const lue = lire(ancienne);
  const m = lue.memories.get(cleMemoireMembre('l1', box));
  ok(!!m && lue.rejets.memories.length === 0, 'mémoire sans filtres : acceptée, jamais rejetée');
  egal([m?.criteres.sensTri, m?.criteres.bornesResultats, m?.criteres.minStats, m?.criteres.sortBy], ['desc', {}, { spd: 210 }, 'hp'],
    'mémoire sans filtres : défauts posés, le reste conservé');
  egal(lue.rapport, [], 'mémoire sans filtres : aucun avertissement');

  const bornes = { spd: { min: 200, max: null }, ehp: { min: 150000, max: 250000 } };
  const pose = lire({ ...base, sensTri: 'asc', bornesResultats: bornes });
  const p = pose.memories.get(cleMemoireMembre('l1', box));
  egal([p?.criteres.sensTri, p?.criteres.bornesResultats], ['asc', bornes], 'mémoire avec filtres : relue telle quelle');
  ok(JSON.parse(ecrireMembresOptimizer({ ...pose })).memories[0][1].criteres.bornesResultats.ehp.min === 150000, 'mémoire avec filtres : réécrite telle quelle');

  for (const [nom, champs] of [
    ['sens inconnu', { sensTri: 'haut' }],
    ['colonne inconnue', { bornesResultats: { vitesse: { min: 1, max: null } } }],
    ['borne non numérique', { bornesResultats: { spd: { min: '200', max: null } } }],
    ['bornes en liste', { bornesResultats: [] }],
  ] as const) {
    const r = lire({ ...base, ...champs });
    ok(r.memories.size === 0 && r.rejets.memories.length === 1, `${nom} : mémoire rejetée et conservée brute, jamais ramenée`);
  }

  const photo = photoCriteres({ ...base, bornesResultats: bornes }, { type: 'personnel' });
  ok(photo.bornesResultats !== bornes && photo.bornesResultats.spd !== bornes.spd && photo.bornesResultats.spd?.min === 200,
    'photo des critères : bornes copiées, aucune référence partagée');

  egal(['tableau', 'cartes', null, 'autre'].map((v) => lireFormeResultats(v)), ['tableau', 'cartes', 'cartes', 'cartes'],
    'forme des résultats : « tableau » relu, tout le reste retombe sur les cartes');
  ok(CLES_SESSION.includes(CLE_FORME_RESULTATS) && valeurStockageValide(CLE_FORME_RESULTATS, 'tableau') && !valeurStockageValide(CLE_FORME_RESULTATS, 'liste'),
    'forme des résultats : un réglage de la session, aux seules valeurs « cartes » et « tableau »');

  const session = composerSession({ maintenant: new Date('2026-10-26T10:00:00Z'), versionApp: 'test', stockage: {}, compte: null, memoire: {},
    optimizer: { sortBy: 'spd', sensTri: 'asc', bornesResultats: bornes } });
  const relue = lireSession(ecrireSession(session));
  ok(relue.ok && relue.session.outils.optimizer?.sensTri === 'asc'
    && JSON.stringify(relue.session.outils.optimizer?.bornesResultats) === JSON.stringify(bornes), 'session : sens et bornes écrits et relus');
}
