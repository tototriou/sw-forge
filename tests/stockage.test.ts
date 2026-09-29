// Conservation du compte dans IndexedDB.
//
// ⚠️ C'est le code dont les défaillances sont les MOINS visibles de toute
// l'app : si la file d'attente cesse de garantir l'ordre, le symptôme est
// « une fois sur cinquante, quelqu'un qui a tout supprimé retrouve ses données
// au rechargement ». Personne ne le signalera, et ce ne sera pas reproductible.

import 'fake-indexeddb/auto';
import { ACCOUNT_SCHEMA, clearAccount, loadAccount, saveAccount } from '../src/lib/accountStore';
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
    crafts: inv.crafts,
    usedRuneIds: parseUsedRuneIdsParPerimetre(data),
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
      const req = indexedDB.open('sw-forge', 1);
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

  await ecrireBrut({ schema: ACCOUNT_SCHEMA, savedAt: 1, box: 'pas un tableau' });
  egal(await loadAccount(), null, 'enregistrement corrompu → ignoré, sans exception');

  // ⚠️ Schéma 6 : runes sans `marker` et `usedRuneIds` en liste plate. Relu,
  // chaque rune passerait pour « sans marqueur » — il doit être ignoré.
  await ecrireBrut({ ...compte, schema: 6, savedAt: 1, usedRuneIds: [1001], runeMarkerLabels: undefined });
  egal(await loadAccount(), null, 'schéma 6 (runes utilisées en liste plate) → ignoré');

  // Même au BON schéma, une liste plate n'est pas une liste par périmètre.
  await ecrireBrut({ ...compte, schema: ACCOUNT_SCHEMA, savedAt: 1, usedRuneIds: [1001] });
  egal(await loadAccount(), null, 'runes utilisées en liste plate → ignorées, sans exception');

  await clearAccount();
}
