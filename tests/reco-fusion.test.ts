// Recommandations — import qui FUSIONNE dans la recommandation existante :
// correspondance (source, puis auteur et nom de base), fusion des decks et
// des défenses visées, bilan, et la `source` dans le fichier partagé.

import {
  apercuFusion,
  appliquerImport,
  cleDefenseSansOrdre,
  correspond,
  fusionnerReco,
  messageFusion,
  nomDeBase,
  trouverCorrespondances,
} from '../src/lib/recoFusion';
import { encodeRecosJson, SOURCE_MAX, validateRecosImport } from '../src/lib/recoShare';
import type { Reco, RecoCounter, RecoDeck, RecoPayload, RecoSlot } from '../src/types';
import { egal, ok, titre } from './outils';

const m = (id: number | null, name = '') => ({ com2usId: id, name });
const def = (ids: (number | null)[], note = ''): RecoCounter => ({ monsters: ids.map((i) => m(i)), note });
const sl = (id: number | null, stats: RecoSlot['stats'] = {}): RecoSlot => ({
  com2usId: id,
  name: id == null ? '' : `M${id}`,
  stats,
  setOptions: [[]],
  artifacts: { element: [], archetype: [] },
});
const deck = (ids: (number | null)[], counters: RecoCounter[] = [], note = '', stats: RecoSlot['stats'] = {}): RecoDeck => ({
  name: '',
  note,
  slots: ids.map((i, k) => sl(i, k === 0 ? stats : {})),
  counters,
});
const reco = (p: Partial<Reco> & { decks: RecoDeck[] }): Reco => ({
  id: 'r1',
  origin: 'imported',
  name: 'Offs — 30/10/2026',
  author: 'Chaîne',
  note: '',
  ...p,
});
const payload = (p: Partial<RecoPayload> & { decks: RecoDeck[] }): RecoPayload => ({
  name: 'Offs — 06/11/2026',
  author: 'Chaîne',
  note: '',
  ...p,
});

export function testRecoFusionCorrespondance() {
  titre('Recommandations — fusion : quelle recommandation un fichier complète');

  egal(nomDeBase('Offs — 30/10/2026'), 'offs', 'date jj/mm/aaaa et tiret cadratin retirés');
  egal(nomDeBase('Offs 2026-10-30'), 'offs', 'date ISO retirée');
  egal(nomDeBase('Siège (30.10)'), 'siege', 'date courte entre parenthèses retirée, accents ignorés');
  egal(nomDeBase('Équipe 3-2'), 'equipe 3-2', '« 3-2 » sans année n\'est pas une date');
  egal(nomDeBase('  Défs   G3 '), 'defs g3', 'casse, accents et espaces resserrés');

  const ex = reco({ decks: [] });
  ok(correspond(ex, payload({ decks: [] })), 'sans source : même auteur et même nom de base, malgré la date');
  ok(!correspond(ex, payload({ author: 'Autre', decks: [] })), 'sans source : un autre auteur ne correspond pas');
  ok(!correspond({ ...ex, author: '' }, payload({ author: '', decks: [] })), 'sans source : un auteur vide ne suffit jamais');
  ok(!correspond(ex, payload({ name: 'Défenses — 06/11/2026', decks: [] })), 'sans source : un autre nom ne correspond pas');

  const avecSource = { ...ex, name: 'Mon nom à moi', source: 'outil:abc' };
  ok(correspond(avecSource, payload({ source: 'outil:abc', decks: [] })), 'même source : correspond malgré un renommage par l\'utilisateur');
  ok(!correspond({ ...ex, source: 'outil:abc' }, payload({ source: 'outil:xyz', decks: [] })), 'deux sources différentes : jamais, même nom et même auteur');
  ok(correspond(ex, payload({ source: 'outil:abc', decks: [] })), 'existante sans source (importée avant) : repli sur auteur et nom');

  const parNom = reco({ id: 'nom', decks: [] });
  const parSource = reco({ id: 'par-source', name: 'Renommée', author: 'Moi', source: 'outil:abc', decks: [] });
  const [cible] = trouverCorrespondances([parNom, parSource], [payload({ source: 'outil:abc', decks: [] })]);
  egal(cible?.id, 'par-source','la correspondance par la source passe avant celle par le nom');
  egal(trouverCorrespondances([parNom], [payload({ name: 'Autre chose', decks: [] })])[0], null, 'rien ne correspond : null');
}

export function testRecoFusionDecks() {
  titre('Recommandations — fusion : decks et défenses visées');

  egal(cleDefenseSansOrdre(def([1, 2, 3]).monsters), cleDefenseSansOrdre(def([3, 1, 2]).monsters), 'même défense dans un autre ordre, leader compris');
  egal(cleDefenseSansOrdre(def([null, null, null]).monsters), null, 'défense vide : pas de clé');

  const existante = reco({
    name: 'Mes offs',
    note: 'mes consignes',
    source: undefined,
    decks: [
      deck([1, 2, 3], [def([7, 8, 9], 'ma précision')], 'mes consignes de deck', { spd: 250 }),
      deck([4, 5, 6], [def([10, 11, 12])]),
    ],
  });
  const avant = JSON.stringify(existante);
  const entrante = payload({
    note: 'consignes du fichier',
    source: 'outil:abc',
    decks: [
      // même équipe : une défense connue (autre ordre) et une nouvelle
      deck([1, 2, 3], [def([9, 7, 8], 'autre précision'), def([20, 21, 22], 'nouvelle')], 'consignes du fichier', { spd: 200 }),
      // même équipe, rien de nouveau
      deck([4, 5, 6], [def([12, 10, 11])]),
      // mêmes monstres, autre leader : une autre équipe
      deck([2, 1, 3], [def([30, 31, 32])]),
      // nouvelle, revue plus loin dans le même fichier
      deck([40, 41, 42], [def([50, 51, 52])]),
      deck([40, 41, 42], [def([53, 54, 55])]),
    ],
  });

  const { reco: r, bilan } = fusionnerReco(existante, entrante);
  egal(JSON.stringify(existante), avant, 'la recommandation existante n\'est pas modifiée (fonction pure)');
  egal(r.decks.length, 4, 'deux decks ajoutés, aucun doublon');
  egal(r.decks.map((d) => d.slots.map((s) => s.com2usId).join('-')), ['1-2-3', '4-5-6', '2-1-3', '40-41-42'], 'les nouveaux à la fin, dans l\'ordre du fichier');
  egal(r.decks[0].counters.map((c) => c.note), ['ma précision', 'nouvelle'], 'deck déjà là : seulement la défense absente, la précision existante gardée');
  egal(r.decks[0].note, 'mes consignes de deck', 'les consignes du deck existant sont gardées');
  egal(r.decks[0].slots[0].stats, { spd: 250 }, 'le build du deck existant est gardé');
  egal(r.decks[1].counters.length, 1, 'deck sans rien de nouveau : inchangé');
  egal(r.decks[3].counters.length, 2, 'un deck revu dans le même fichier réunit ses défenses');
  egal([r.name, r.author, r.note], ['Mes offs', 'Chaîne', 'mes consignes'], 'nom, auteur et consignes de la recommandation gardés');
  egal(r.source, 'outil:abc', 'la source du fichier est adoptée : la prochaine fusion ne dépendra plus du nom');
  egal(bilan, { decksAjoutes: 2, decksEnrichis: 1, defensesAjoutees: 1, decksInchanges: 1 }, 'bilan : 2 ajoutés, 1 enrichi d\'1 défense, 1 inchangé');

  egal(fusionnerReco({ ...existante, source: 'outil:ancienne' }, entrante).reco.source, 'outil:ancienne', 'une source existante n\'est jamais remplacée');
  const vide = fusionnerReco(reco({ decks: [deck([null, null, null])] }), payload({ decks: [deck([1, 2, 3])] })).reco;
  egal(vide.decks.map((d) => d.slots[0].com2usId), [1], 'une recommandation réduite à son deck vide : les decks reçus le remplacent');
}

export function testRecoFusionImport() {
  titre('Recommandations — fusion : l\'import complet et son bilan');
  let n = 0;
  const id = () => `n${++n}`;
  const mienne = reco({ id: 'a', origin: 'mine', decks: [deck([1, 2, 3], [def([7, 8, 9])])] });
  const autre = reco({ id: 'b', name: 'Autre', author: 'Ami', decks: [deck([4, 5, 6])] });
  const fichier = [
    payload({ decks: [deck([1, 2, 3], [def([20, 21, 22])]), deck([60, 61, 62])] }),
    payload({ name: 'Inconnue', author: 'Personne', decks: [deck([70, 71, 72])] }),
  ];

  const aPart = appliquerImport([mienne, autre], fichier, false, id);
  egal(aPart.recos.map((r) => r.id), ['a', 'b', 'n1', 'n2'], 'sans fusion : tout est ajouté à la suite, comme avant');
  ok(aPart.recos.slice(2).every((r) => r.origin === 'imported'), 'sans fusion : marquées « importée »');
  egal(aPart.recos[0], mienne, 'sans fusion : l\'existante n\'est pas touchée');

  const fus = appliquerImport([mienne, autre], fichier, true, id);
  egal(fus.recos.map((r) => r.id), ['a', 'b', 'n3'], 'avec fusion : la correspondante complétée à sa place, l\'autre ajoutée');
  egal(fus.recos[0].origin, 'mine', 'une recommandation fusionnée garde son origine');
  egal(fus.recos[0].decks.length, 2, 'le deck nouveau est ajouté');
  egal(fus.bilan, { decksAjoutes: 1, decksEnrichis: 1, defensesAjoutees: 1, decksInchanges: 0, recosAjoutees: 1, recosFusionnees: 1 }, 'bilan de l\'import');
  egal(messageFusion(fus.bilan), 'Fusion : 1 deck ajouté, 1 deck enrichi de 1 défense · 1 recommandation ajoutée à part. Rien n\'a été retiré ni modifié.', 'message après la fusion');
  egal(
    messageFusion({ decksAjoutes: 0, decksEnrichis: 0, defensesAjoutees: 0, decksInchanges: 3, recosAjoutees: 0, recosFusionnees: 1 }),
    'Fusion : rien de nouveau, tous ses decks et leurs défenses étaient déjà là. Rien n\'a été retiré ni modifié.',
    'message quand le fichier n\'apporte rien',
  );
  egal(apercuFusion({ decksAjoutes: 3, decksEnrichis: 2, defensesAjoutees: 5, decksInchanges: 0 }), '3 decks nouveaux, à la fin ; 2 decks que tu as déjà gagnent 5 défenses visées.', 'aperçu avant de choisir');
  egal(apercuFusion({ decksAjoutes: 0, decksEnrichis: 0, defensesAjoutees: 0, decksInchanges: 1 }), 'Rien de nouveau : tous ses decks et leurs défenses y sont déjà.', 'aperçu quand rien n\'est nouveau');
}

export function testRecoFusionSource() {
  titre('Recommandations — la `source` dans le fichier partagé');
  const r = reco({ source: '  outil:abc  ', decks: [deck([1, 2, 3])] });
  const json = encodeRecosJson([r]);
  ok(json.includes('"source": "outil:abc"'), 'écrite à l\'export, trimée');
  const lu = validateRecosImport(json);
  egal(lu.recos?.[0].source, 'outil:abc', 'relue à l\'import');
  egal(lu.warnings, [], 'aucun avertissement : un champ en plus, pas une version de plus');
  ok(!encodeRecosJson([{ ...r, source: undefined }]).includes('"source"'), 'absente : la clé n\'est pas écrite');

  const brut = (source: unknown) =>
    validateRecosImport(JSON.stringify({ format: 'swblacksmith/recommandations', version: 5, recommandations: [{ nom: 'R', source, decks: [{ monstres: [{ com2usId: 1 }] }] }] }));
  const pasTexte = brut(42);
  egal(pasTexte.recos?.[0].source, undefined, 'source qui n\'est pas un texte : ignorée');
  ok(pasTexte.warnings.some((w) => w.includes('« source » n\'est pas un texte')), '… et signalée');
  const longue = brut('x'.repeat(SOURCE_MAX + 1));
  egal(longue.recos?.[0].source, undefined, 'source trop longue : ignorée, pas tronquée');
  ok(longue.warnings.some((w) => w.includes(`plus de ${SOURCE_MAX} caractères`)), '… et signalée');
  ok(!('source' in (brut(undefined).recos?.[0] ?? {})), 'fichier sans source : aucune clé posée');
}
