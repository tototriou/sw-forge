// La sauvegarde de session — le format (chantier sauvegarde-session, lot 1 ;
// src/lib/session.ts).
//
// ⚠️ Ce que le format promet : un aller-retour composer → écrire → relire
// rend EXACTEMENT ce qui a été sauvegardé (le compte, le travail, les
// réglages, l'état des outils — `Set` compris) ; un fichier abîmé, d'un autre
// format ou d'une version plus récente est refusé avec un message, sans
// session à moitié lue. ⚠️ `egal` compare en JSON, qui écrit un `Set` comme
// `{}` : les `Set` se comparent ici en tableaux, et leur type se vérifie à part.

import { ACCOUNT_SCHEMA, StoredAccount } from '../src/lib/accountStore';
import {
  parseAccountBox,
  parseAccountExportDate,
  parseAccountInventory,
  parseAccountSource,
  parseAccountWizardName,
  parseRuneMarkerLabels,
  parseUsedRuneIdsParPerimetre,
} from '../src/lib/importAccount';
import { buildOptimizerRecipe, parseOptimizerRecipe } from '../src/lib/optimizerRecipe';
import { DEFAULT_DAMAGE_SETUP } from '../src/lib/damage';
import {
  CLES_SESSION,
  composerSession,
  decoder,
  ecrireSession,
  encoder,
  FORMAT_SESSION,
  lireSession,
  nomFichierSession,
  SourcesSession,
} from '../src/lib/session';
import { egal, exportReel, exportSynthetique, ignore, ok, titre } from './outils';

// Le compte stocké, construit par les mêmes extracteurs que l'import.
function compteDe(texte: string): StoredAccount {
  const data = parseAccountSource(texte)!;
  const inv = parseAccountInventory(data);
  return {
    schema: ACCOUNT_SCHEMA,
    savedAt: 1_790_000_000_000,
    exportedAt: parseAccountExportDate(data),
    wizardName: parseAccountWizardName(data),
    box: parseAccountBox(data).monsters ?? [],
    runes: inv.runes ?? [],
    artifacts: inv.artifacts ?? [],
    relics: inv.relics ?? [],
    crafts: inv.crafts ?? [],
    usedRuneIds: parseUsedRuneIdsParPerimetre(data),
    relicUsageById: inv.relicUsageById ?? {},
    runeMarkerLabels: parseRuneMarkerLabels(data),
  };
}

const recette = () =>
  buildOptimizerRecipe({
    monsterCom2usId: 14013,
    monsterName: 'Lushen (test)',
    requirement: { sets: ['violent'], minStats: { spd: 180 } },
    objective: 'degats_reels',
    damageSetup: DEFAULT_DAMAGE_SETUP,
    metric: 'eff',
    slotFilterPreset: 'bas',
    adaptiveTrancheWeighting: false,
    exhaustiveSearch: false,
    excludeUsedRunes: false,
    excludeUsedScope: 'rta',
    excludedSelectors: [],
    ignoreArtifacts: false,
    artifactMainByKind: { element: 'libre', archetype: 'libre' },
    relicMainChoice: 'equipped',
  });

function sources(): SourcesSession {
  return {
    maintenant: new Date('2026-10-06T13:42:00Z'),
    versionApp: '2.0.0',
    stockage: {
      'swblacksmith-rta-v1': JSON.stringify({ entries: { a: { monsterId: 1 } } }),
      'swblacksmith-siege-defense-v1': JSON.stringify({ teams: [{ id: 't1', slots: [] }] }),
      'swblacksmith-siege-recos-v1': JSON.stringify({ recos: [] }),
      'swblacksmith-theme-v1': 'dark',
      'swblacksmith-rune-metric-v1': 'score',
      'swblacksmith-overcap-display-v1': '0',
      'swblacksmith-adversaire-reference-v1': '1',
      // Hors session : propre à l'appareil, et une clé étrangère.
      'swblacksmith-persist-v1': '1',
      'autre-chose': 'x',
    },
    compte: compteDe(exportSynthetique()),
    memoire: {
      'speedTune.lignes': [{ id: 1, vitesse: 230 }],
      'speedTune.ordre': ['a', 'b'],
      'runesList.sets': new Set(['Violent', 'Swift']),
      'optim.perimetres': new Set(['rta']),
      'box.query': 'lushen',
      'recos.parId': new Map([['r1', { ouvert: true }]]),
      // Hors session : préférences d'interface de l'appareil.
      'sidebar.retractee': true,
      'mobileNotice.ferme': true,
    },
    optimizer: recette(),
  };
}

export default function testSession() {
  titre('session · aller-retour composer → écrire → relire');
  const src = sources();
  const texte = ecrireSession(composerSession(src));
  const lu = lireSession(texte);
  ok(lu.ok, 'la session écrite se relit');
  if (!lu.ok) return;
  const s = lu.session;
  egal(s.format, FORMAT_SESSION, 'format swblacksmith/session');
  egal(s.version, 1, 'version 1');
  egal(s.enregistreeLe, '2026-10-06T13:42:00.000Z', 'date de sauvegarde');
  egal(s.versionApp, '2.0.0', 'version de l’app');
  egal(lu.avertissements, [], 'aucun avertissement');
  for (const cle of Object.keys(src.stockage).filter((c) => (CLES_SESSION as readonly string[]).includes(c)))
    egal(s.stockage[cle as (typeof CLES_SESSION)[number]], src.stockage[cle], `stockage : ${cle} rendu tel quel`);
  ok(!('swblacksmith-persist-v1' in s.stockage) && !('autre-chose' in s.stockage), 'hors session : « Garder mes données » et les clés étrangères');
  egal(s.compte, src.compte, 'le compte : box, inventaire, reliques, runes utilisées, marqueurs — identique');
  ok((s.compte?.box.length ?? 0) > 0 && (s.compte?.runes.length ?? 0) > 0, 'le compte n’est pas vide (le test compare quelque chose)');
  egal(s.outils.memoire['speedTune.lignes'], src.memoire['speedTune.lignes'], 'outils : l’équipe du speed tuning');
  egal(s.outils.memoire['box.query'], 'lushen', 'outils : la recherche de la box');
  const sets = s.outils.memoire['runesList.sets'];
  ok(sets instanceof Set && [...sets].join() === 'Violent,Swift', 'outils : un Set revient en Set, mêmes éléments, même ordre');
  const map = s.outils.memoire['recos.parId'];
  ok(map instanceof Map && JSON.stringify([...map]) === JSON.stringify([['r1', { ouvert: true }]]), 'outils : une Map revient en Map');
  ok(!('sidebar.retractee' in s.outils.memoire) && !('mobileNotice.ferme' in s.outils.memoire), 'hors session : les préférences d’interface');
  egal(s.outils.optimizer, parseOptimizerRecipe(JSON.stringify(recette())).recipe, 'outils : la recette de l’Optimizer');

  titre('session · Set et Map dans du JSON');
  const imbrique = { a: new Set([1, 2]), b: [new Set(['x'])], c: new Map([[1, new Set([3])]]) };
  const rendu = decoder(JSON.parse(JSON.stringify(encoder(imbrique)))) as typeof imbrique;
  ok(rendu.a instanceof Set && rendu.b[0] instanceof Set && rendu.c instanceof Map && rendu.c.get(1) instanceof Set, 'imbriqués : Set dans un tableau, Set dans une Map');
  egal(decoder({ $set: 'pas un tableau' }), { $set: 'pas un tableau' }, 'une marque mal formée reste un objet ordinaire');

  titre('session · refusée, sans rien de lu');
  const base = JSON.parse(texte);
  const refus = (brut: unknown, attendu: string, libelle: string) => {
    const r = lireSession(typeof brut === 'string' ? brut : JSON.stringify(brut));
    ok(!r.ok && r.erreur.includes(attendu), `${libelle} → « ${r.ok ? 'acceptée' : r.erreur} »`);
  };
  refus('pas du json', 'illisible', 'texte illisible');
  refus([1, 2], 'illisible', 'un tableau');
  refus({ ...base, format: 'swblacksmith/prepa-rta' }, 'pas une sauvegarde de session', 'un autre export de l’app');
  refus({ ...base, version: 2 }, 'version plus récente', 'une version plus récente');
  refus({ ...base, version: '1' }, 'version illisible', 'une version qui n’est pas un nombre');
  refus({ ...base, stockage: [] }, 'travail est illisible', 'le stockage n’est pas un objet');
  refus({ ...base, stockage: { ...base.stockage, 'swblacksmith-theme-v1': 'violet' } }, 'swblacksmith-theme-v1', 'un thème inconnu');
  refus({ ...base, stockage: { ...base.stockage, 'swblacksmith-rta-v1': '{abîmé' } }, 'swblacksmith-rta-v1', 'une prépa RTA qui n’est pas du JSON');
  refus({ ...base, stockage: { ...base.stockage, 'swblacksmith-siege-recos-v1': 42 } }, 'swblacksmith-siege-recos-v1', 'une valeur qui n’est pas un texte');

  titre('session · lue malgré une partie périmée, et dit');
  const perime = lireSession(JSON.stringify({ ...base, compte: { ...base.compte, schema: 6 } }));
  ok(perime.ok && perime.session.compte === null && perime.avertissements.some((a) => a.includes('réimporte')), 'compte d’un schéma périmé : laissé, et dit');
  const recetteAbimee = lireSession(JSON.stringify({ ...base, outils: { ...base.outils, optimizer: { version: 99 } } }));
  ok(recetteAbimee.ok && recetteAbimee.session.outils.optimizer === null && recetteAbimee.avertissements.some((a) => a.includes('Optimizer')), 'recette de l’Optimizer illisible : ignorée, et dit');
  const inconnu = lireSession(JSON.stringify({ ...base, futurChamp: { x: 1 }, stockage: { ...base.stockage, 'swblacksmith-futur-v1': '1' } }));
  ok(inconnu.ok && !('swblacksmith-futur-v1' in inconnu.session.stockage), 'un champ ou une clé inconnus : ignorés');
  const sansCompte = lireSession(JSON.stringify({ ...base, compte: null }));
  ok(sansCompte.ok && sansCompte.session.compte === null && sansCompte.avertissements.length === 0, 'une session sans compte : lue, sans avertissement');

  titre('session · le nom du fichier');
  egal(nomFichierSession(new Date(2026, 9, 6, 15, 42)), 'swblacksmith-session-2026-10-06-15h42.json', 'daté à l’heure locale');
  egal(nomFichierSession(new Date(2026, 0, 5, 9, 7)), 'swblacksmith-session-2026-01-05-09h07.json', 'chiffres sur deux positions');

  titre('session · la taille, avec un vrai compte');
  const reel = exportReel();
  if (!reel) {
    ignore('taille avec l’export réel du développeur', 'export réel absent');
    return;
  }
  const avecReel = ecrireSession(composerSession({ ...src, compte: compteDe(reel) }));
  const mo = Buffer.byteLength(avecReel, 'utf8') / 1e6;
  const relu = lireSession(avecReel);
  ok(relu.ok && JSON.stringify(relu.session.compte) === JSON.stringify(compteDe(reel)), `compte réel : aller-retour identique (${mo.toFixed(2)} Mo)`);
}
