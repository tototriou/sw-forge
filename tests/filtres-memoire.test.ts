import { baseCompleteCriteres, CLASSEMENT_CHAMPS_OPTIMIZER, criteresApresChangementEspece, photoCriteres } from '../src/lib/criteresOptimizer';
import { CHAMPS_OPTIMIZER_SESSION } from '../src/lib/sessionOptimizer';
import { CLES_SESSION, composerSession, ecrireSession, lireSession, valeurStockageValide } from '../src/lib/session';
import { CLE_FORME_RESULTATS, lireFormeResultats } from '../src/hooks/useFormeResultats';
import { cleMemoireMembre, ecrireMembresOptimizer, lireMembresOptimizer, memoiresAvecMesureDesBornes } from '../src/lib/optimizerMemberStorage';
import type { ExclusionSelector } from '../src/lib/optimizerExclusion';
import { avecBorne, etatDesBornes, type BornesResultats } from '../src/lib/filtresResultats';
import { COLONNES_SELON_MESURE, bornesAvecMesure, bornesBienFormees, bornesMisesDeCote, bornesSousMesure } from '../src/lib/colonnesResultats';
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

// Le branchement dans l'écran (deux membres, la mesure changée et rendue) :
// tests/rendu/optimizer-filtres-preuves.ts, `preuvesFiltresMesure`.
export function testFiltresResultatsChangementDeMesure() {
  titre('Filtres d’affichage des résultats — la borne d’Efficience garde sa mesure : mise de côté sous l’autre, rendue au retour');
  egal(COLONNES_SELON_MESURE, ['efficience'], 'seule « Efficience » suit la mesure des runes');
  // Poser : la borne d'Efficience retient la mesure ; les autres colonnes n'en portent pas.
  const posees = avecBorne(avecBorne({}, 'efficience', 'min', 78.8, 'eff'), 'spd', 'min', 200, 'eff');
  egal(posees, { efficience: { min: 78.8, max: null, mesure: 'eff' }, spd: { min: 200, max: null } }, 'poser : l’Efficience retient « eff », VIT rien');
  // Sous l'autre mesure : mise de côté (ni vue, ni écran), jamais convertie.
  egal(bornesSousMesure(posees, 'score'), { spd: { min: 200, max: null } }, 'sous Score SW : la borne d’Efficience n’entre pas dans la vue');
  ok(bornesSousMesure(posees, 'eff') === posees, 'au retour sous Efficience : les mêmes bornes, intactes (même objet)');
  egal(etatDesBornes(bornesSousMesure(posees, 'score'), () => true).actives.map((a) => a.colonne), ['spd'], 'le classeur ne borne que VIT sous Score SW');
  // Saisir sous l'autre mesure : une saisie vide garde la borne mise de côté, un nombre la remplace.
  ok(avecBorne(posees, 'efficience', 'max', null, 'score') === posees, 'saisie vide sous Score SW : la borne mise de côté reste');
  egal(avecBorne(posees, 'efficience', 'max', 150, 'score').efficience, { min: null, max: 150, mesure: 'score' },
    'un nombre saisi sous Score SW : une borne neuve, à « score », sans reprendre le minimum mis de côté');
  // Effacer : seules les bornes montrées partent.
  egal(bornesMisesDeCote(posees, 'score'), { efficience: posees.efficience }, 'effacer sous Score SW garde la borne d’Efficience, telle quelle, pour son retour');
  egal(bornesMisesDeCote(posees, 'eff'), {}, 'effacer sous Efficience retire tout');

  // Compatibilité : une borne enregistrée sans mesure vaut sous la mesure
  // courante, puis prend celle qui s'achève au premier changement.
  const ancienne = { spd: { min: 200, max: null }, efficience: { min: 120, max: null } } as BornesResultats;
  ok(bornesSousMesure(ancienne, 'score') === ancienne && bornesSousMesure(ancienne, 'eff') === ancienne, 'sans mesure : la borne vaut sous la mesure courante');
  const fixees = bornesAvecMesure(ancienne, 'score');
  egal(fixees, { spd: { min: 200, max: null }, efficience: { min: 120, max: null, mesure: 'score' } }, 'au changement : elle prend la mesure qui s’achève');
  ok(bornesAvecMesure(fixees, 'eff') === fixees && bornesAvecMesure(posees, 'score') === posees, 'une mesure déjà fixée ne change plus (même objet)');
  egal(ancienne.efficience, { min: 120, max: null }, 'les bornes reçues ne sont pas modifiées');

  // Mémoires de deux membres, l'une écrite avant (sans mesure), l'autre
  // après (avec) ; une forme fausse est refusée.
  const autre: ExclusionSelector = { source: 'box', unitKey: '22' };
  const base = baseCompleteCriteres(undefined);
  const lu = lireMembresOptimizer(JSON.stringify({ memories: [
    [cleMemoireMembre('l1', box), { listId: 'l1', selector: box, com2usId: 10001, criteres: { ...base, bornesResultats: ancienne } }],
    [cleMemoireMembre('l1', autre), { listId: 'l1', selector: autre, com2usId: 10002, criteres: { ...base, bornesResultats: posees } }],
  ], teams: [], listContents: [] }));
  egal([lu.rapport, lu.memories.size], [[], 2], 'mémoires avec et sans mesure : relues');
  const memoires = memoiresAvecMesureDesBornes(lu.memories, 'eff');
  egal(memoires.get(cleMemoireMembre('l1', box))?.criteres.bornesResultats.efficience, { min: 120, max: null, mesure: 'eff' },
    'changement de mesure : la mémoire d’avant prend la mesure qui s’achève');
  ok(memoires.get(cleMemoireMembre('l1', autre)) === lu.memories.get(cleMemoireMembre('l1', autre)), '… la mémoire déjà fixée reste la même');
  ok(memoiresAvecMesureDesBornes(memoires, 'score') === memoires, 'tout fixé : les mêmes mémoires (même objet)');
  const relues = lireMembresOptimizer(ecrireMembresOptimizer({ ...lu, memories: memoires }));
  egal(relues.memories.get(cleMemoireMembre('l1', box))?.criteres.bornesResultats.efficience?.mesure, 'eff', 'la mesure s’écrit et se relit');
  for (const [cas, bornes] of [['mesure inconnue', { efficience: { min: 1, max: null, mesure: 'pct' } }], ['mesure sur VIT', { spd: { min: 1, max: null, mesure: 'eff' } }]] as const) {
    ok(!bornesBienFormees(bornes) && lire({ ...base, bornesResultats: bornes }).memories.size === 0, `mémoire refusée : ${cas}`);
  }
  // La session photographie la mesure avec la borne.
  const session = composerSession({ maintenant: new Date('2026-10-28T10:00:00Z'), versionApp: 'test', stockage: {}, compte: null, memoire: {},
    optimizer: { bornesResultats: posees } });
  const relue = lireSession(ecrireSession(session));
  ok(relue.ok && JSON.stringify(relue.session.outils.optimizer?.bornesResultats) === JSON.stringify(posees), 'session : la borne et sa mesure écrites et relues');
}
