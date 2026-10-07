// Conservation du compte dans IndexedDB.
//
// ⚠️ C'est le code dont les défaillances sont les MOINS visibles de toute
// l'app : si la file d'attente cesse de garantir l'ordre, le symptôme est
// « une fois sur cinquante, quelqu'un qui a tout supprimé retrouve ses données
// au rechargement ». Personne ne le signalera, et ce ne sera pas reproductible.

import 'fake-indexeddb/auto';
import { ACCOUNT_SCHEMA, clearAccount, loadAccount, oublierConnexion, saveAccount } from '../src/lib/accountStore';
import {
  parseAccountBox,
  parseAccountInventory,
  parseAccountSource,
  parseRuneMarkerLabels,
  parseUsedRuneIdsParPerimetre,
} from '../src/lib/importAccount';
import { egal, exportSynthetique, ok, titre } from './outils';

export default async function testStockage() {
  titre('Conservation du compte (IndexedDB)');

  const data = parseAccountSource(exportSynthetique())!;
  const box = parseAccountBox(data).monsters;
  const inv = parseAccountInventory(data);
  const compte = {
    box,
    runes: inv.runes,
    artifacts: inv.artifacts,
    relics: inv.relics,
    crafts: inv.crafts,
    usedRuneIds: parseUsedRuneIdsParPerimetre(data),
    relicUsageById: inv.relicUsageById,
    runeMarkerLabels: parseRuneMarkerLabels(data),
    exportedAt: 1786261890000,
  };

  egal(await loadAccount(), null, 'base vide → rien à charger');

  /* --- Aller-retour ----------------------------------------------------- */

  ok(await saveAccount(compte), 'enregistrement accepté');
  const relu = (await loadAccount())!;
  ok(relu !== null, 'relecture non nulle');
  egal(relu.box, box, 'box identique après aller-retour');
  egal(relu.runes.length, inv.runes.length, 'runes identiques');
  egal(relu.relics, inv.relics, 'reliques identiques après aller-retour');
  egal(relu.relicUsageById, inv.relicUsageById, "occupation par rid conservée");
  // ⚠️ Le point précis : une pièce sans
  // `sec_effect[2]` (percent illisible) doit rester SANS `percent` après le
  // structured clone d'IndexedDB — jamais un 0 apparu au passage.
  const relique7002 = relu.relics.find((r) => r.id === 7002);
  ok(!!relique7002?.unique && !('percent' in relique7002.unique), 'relique sans percent : toujours absent après relecture');
  egal(relu.exportedAt, 1786261890000, "date d'export conservée");
  egal(relu.schema, ACCOUNT_SCHEMA, 'schéma estampillé');
  // ⚠️ Les decks ne vivent QUE dans l'export brut, jamais conservé : sans cette
  // liste au stockage, le filtre « Runes utilisées » s'éteindrait à chaque
  // rechargement d'un compte conservé.
  egal(relu.usedRuneIds, compte.usedRuneIds, 'runes utilisées conservées, par périmètre');
  // Même raison pour les marqueurs : `rune_lock_list` et `markers` ne vivent
  // que dans l'export brut.
  egal(relu.runeMarkerLabels, compte.runeMarkerLabels, 'libellés des marqueurs conservés');
  egal(
    relu.runes.filter((r) => r.marker !== undefined).map((r) => [r.id, r.marker]),
    inv.runes.filter((r) => r.marker !== undefined).map((r) => [r.id, r.marker]),
    'marqueurs des runes conservés'
  );
  ok(inv.runes.some((r) => r.marker !== undefined), 'le fichier d’exemple porte bien des runes marquées');

  // ⚠️ Le structured clone doit rendre des objets INDÉPENDANTS : muter ce qu'on
  // relit ne doit pas contaminer ce qui est en mémoire ailleurs dans l'app.
  relu.runes[0].level = 999;
  ok(inv.runes[0].level !== 999, 'objets relus indépendants de la source');

  /* --- Remplacement, pas accumulation ----------------------------------- */

  await saveAccount({ ...compte, box: box.slice(0, 1) });
  egal((await loadAccount())!.box.length, 1, 'un nouvel import remplace le précédent');

  await clearAccount();
  egal(await loadAccount(), null, 'effacement effectif');

  /* --- Concurrence ------------------------------------------------------ */

  // Deux imports coup sur coup : le dernier gagne, quel que soit l'ordre
  // d'achèvement des transactions.
  await Promise.all([
    saveAccount({ ...compte, box: box.slice(0, 1) }),
    saveAccount({ ...compte, box: box.slice(0, 2) }),
  ]);
  egal((await loadAccount())!.box.length, 2, 'deux imports enchaînés → le dernier gagne');

  // ⚠️ Le pire cas : une écriture en retard qui ressusciterait ce que
  // l'utilisateur vient d'effacer. Une action explicite annulée par un effet de
  // bord invisible.
  await Promise.all([saveAccount(compte), clearAccount()]);
  egal(await loadAccount(), null, 'purge après import → le compte reste effacé');

  // Et l'inverse : un import postérieur à une purge doit tenir.
  await Promise.all([clearAccount(), saveAccount({ ...compte, box: box.slice(0, 2) })]);
  egal((await loadAccount())!.box.length, 2, 'import après purge → conservé');

  /* --- Enregistrements inexploitables ----------------------------------- */

  const ecrireBrut = (valeur: unknown) =>
    new Promise<void>((res) => {
      const req = indexedDB.open('swblacksmith', 1);
      req.onsuccess = () => {
        const t = req.result.transaction('account', 'readwrite');
        t.objectStore('account').put(valeur, 'current');
        t.oncomplete = () => res();
      };
    });

  // ⚠️ Sans ce rejet, un compte enregistré sous un ancien schéma donnerait des
  // chiffres incomplets EN SILENCE — le pire mode de défaillance pour un outil
  // de calcul.
  await ecrireBrut({ schema: 99, savedAt: 1, exportedAt: null, box: [], runes: [], artifacts: [], crafts: [] });
  egal(await loadAccount(), null, 'schéma périmé → ignoré');

  // ⚠️ Le schéma précédent (6, sans reliques) doit être rejeté comme tout
  // autre schéma périmé — jamais l'apparence d'un inventaire complet quand
  // `relics`/`relicUsageById` manquent.
  await ecrireBrut({
    schema: 6,
    savedAt: 1,
    exportedAt: null,
    box: [],
    runes: [],
    artifacts: [],
    crafts: [],
    usedRuneIds: [],
  });
  egal(await loadAccount(), null, 'ancien schéma 6 (sans reliques) → rejeté, réimport demandé');

  await ecrireBrut({ schema: ACCOUNT_SCHEMA, savedAt: 1, box: 'pas un tableau' });
  egal(await loadAccount(), null, 'enregistrement corrompu → ignoré, sans exception');

  // ⚠️ Schéma 6 : runes sans `marker` et `usedRuneIds` en liste plate. Relu,
  // chaque rune passerait pour « sans marqueur » — il doit être ignoré.
  await ecrireBrut({ ...compte, schema: 6, savedAt: 1, usedRuneIds: [1001], runeMarkerLabels: undefined });
  egal(await loadAccount(), null, 'schéma 6 (runes utilisées en liste plate) → ignoré');

  // Même au BON schéma, une liste plate n'est pas une liste par périmètre.
  await ecrireBrut({ ...compte, schema: ACCOUNT_SCHEMA, savedAt: 1, usedRuneIds: [1001] });
  egal(await loadAccount(), null, 'runes utilisées en liste plate → ignorées, sans exception');

  // ⚠️ Le schéma 7 réunit deux chantiers (reliques ; marqueurs et runes
  // utilisées par périmètre) qui avaient chacun pris le 7 pour leur seule
  // moitié. Un navigateur qui a fait tourner l'une des deux branches garde un
  // « 7 » incomplet : la validation, et non le numéro, doit le rejeter.
  const { relics: _relics, relicUsageById: _usage, ...sansReliques } = compte;
  await ecrireBrut({ ...sansReliques, schema: ACCOUNT_SCHEMA, savedAt: 1 });
  egal(await loadAccount(), null, '7 de la branche runes (sans reliques) → ignoré');
  await ecrireBrut({ ...compte, schema: ACCOUNT_SCHEMA, savedAt: 1, relicUsageById: undefined });
  egal(await loadAccount(), null, '7 sans relicUsageById seul → ignoré');
  const { runeMarkerLabels: _labels, ...sansMarqueurs } = compte;
  await ecrireBrut({ ...sansMarqueurs, schema: ACCOUNT_SCHEMA, savedAt: 1, usedRuneIds: [1001] });
  egal(await loadAccount(), null, '7 de la branche reliques (liste plate, sans libellés) → ignoré');
  await ecrireBrut({ ...sansMarqueurs, schema: ACCOUNT_SCHEMA, savedAt: 1 });
  egal(await loadAccount(), null, '7 sans runeMarkerLabels seul → ignoré');

  await clearAccount();

  /* --- Reprise de l'ancienne base `sw-forge` (décision 66) --------------- */

  // ⚠️ La base s'appelait `sw-forge` avant le rebranding. Un utilisateur qui
  // avait conservé son compte doit le retrouver après la mise à jour, sans
  // réimport — et l'ancienne base ne doit pas rester sur son disque.
  titre('Conservation du compte · reprise de l’ancienne base');
  const creerAncienne = (valeur: unknown) =>
    new Promise<void>((res) => {
      const req = indexedDB.open('sw-forge', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('account');
      req.onsuccess = () => {
        const db = req.result;
        const t = db.transaction('account', 'readwrite');
        t.objectStore('account').put(valeur, 'current');
        t.oncomplete = () => {
          db.close();
          res();
        };
      };
    });
  const bases = async () => (await indexedDB.databases()).map((d) => d.name);
  const enregistrement = (b: typeof box) => ({ ...compte, box: b, schema: ACCOUNT_SCHEMA, savedAt: 1, wizardName: null });

  await oublierConnexion();
  await creerAncienne(enregistrement(box.slice(0, 2)));
  const repris = await loadAccount();
  egal(repris?.box.length, 2, 'le compte de l’ancienne base est retrouvé tel quel');
  egal(repris?.runes.length, inv.runes.length, '… runes comprises');
  ok(!(await bases()).includes('sw-forge'), 'l’ancienne base est supprimée une fois recopiée');

  // Un compte enregistré depuis la mise à jour fait foi.
  await saveAccount({ ...compte, box: box.slice(0, 1) });
  await oublierConnexion();
  await creerAncienne(enregistrement(box.slice(0, 2)));
  egal((await loadAccount())?.box.length, 1, 'nouvelle base déjà remplie → elle fait foi');
  ok(!(await bases()).includes('sw-forge'), '… et l’ancienne, périmée, est supprimée');

  // ⚠️ `indexedDB.open` crée une base absente : la reprise ne doit pas laisser
  // une base `sw-forge` vide derrière elle à chaque lancement.
  await oublierConnexion();
  await loadAccount();
  ok(!(await bases()).includes('sw-forge'), 'sans ancienne base, aucune n’est créée');

  await clearAccount();
}
