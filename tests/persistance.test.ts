// L'interrupteur de conservation, qui gouverne TOUTE l'app.
//
// ⚠️ Deux défaillances possibles, toutes deux silencieuses : écrire alors que
// l'utilisateur a refusé (promesse trahie), ou cesser d'écrire pour quelqu'un
// d'installé de longue date (perte de son travail sans qu'il ait rien demandé).

import { faussLocalStorage } from './outils';

// Le module lit `localStorage` à son chargement : le faux stockage doit être en
// place AVANT l'import, d'où l'import dynamique.
export default async function testPersistance() {
  const { egal, ok, titre } = await import('./outils');
  titre('Conservation des données (interrupteur global)');

  const mem = faussLocalStorage({});
  (globalThis as any).indexedDB = null;
  // ⚠️ Pas une affectation directe : Node ≥ 22 expose son propre `navigator`
  // (accesseur en lecture seule, aligné sur l'API navigateur), et
  // `globalThis.navigator = {}` y échoue avec « has only a getter ». Le
  // redéfinir via `defineProperty` fonctionne dans les deux cas (Node avec ou
  // sans `navigator` natif).
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  const P = await import('../src/hooks/usePersistence');

  ok(!P.persistenceEnabled(), 'navigateur vierge → on ne conserve rien');
  ok(!P.dialogueMasque(), 'navigateur vierge → la question sera posée');

  /* --- Refus : plus rien ne doit atteindre le disque -------------------- */

  P.setPersistence(false);
  P.saveLocal('sky-arena-rta-v1', '{"entries":{}}');
  P.saveLocal('sw-forge-siege-defense-v1', '{"teams":[]}');
  egal(mem.get('sky-arena-rta-v1'), undefined, 'refus → la prépa RTA n’est pas écrite');
  egal(mem.get('sw-forge-siege-defense-v1'), undefined, 'refus → le siège n’est pas écrit');
  egal(mem.get('sw-forge-persist-v1'), '0', 'le choix lui-même reste mémorisé');

  /* --- Acceptation ------------------------------------------------------ */

  P.setPersistence(true);
  P.saveLocal('sky-arena-rta-v1', '{"entries":{"a":1}}');
  P.saveLocal('sw-forge-rune-metric-v1', 'score');
  egal(mem.get('sky-arena-rta-v1'), '{"entries":{"a":1}}', 'acceptation → la prépa RTA est écrite');

  /* --- Retour en arrière : purge des DONNÉES, pas des RÉGLAGES ---------- */

  P.setPersistence(false);
  await new Promise((r) => setTimeout(r, 20));
  egal(mem.get('sky-arena-rta-v1'), undefined, 'refus après coup → la prépa RTA est effacée');
  egal(mem.get('sw-forge-rune-metric-v1'), 'score', 'le réglage de score survit à la purge');
  egal(mem.get('sw-forge-persist-v1'), '0', 'le choix survit à la purge');

  /* --- « Ne plus me montrer » : la SESSION, et rien de plus ------------- */

  P.setDialogueMasque(true);
  ok(P.dialogueMasque(), 'case cochée → plus de fenêtre dans cette session');
  ok(
    [...mem.keys()].every((k) => !/hide|masqu/i.test(k)),
    'la case n’est écrite nulle part : elle doit disparaître au rechargement'
  );

  /* --- Reprise d'un navigateur déjà utilisé ---------------------------- */

  // ⚠️ Le cas qui compte : quelqu'un d'installé avant l'existence du réglage.
  // Sans reprise, la mise à jour lui retirerait en silence une conservation
  // dont il dispose depuis toujours.
  const cas: [string, Record<string, string>, boolean][] = [
    ['navigateur vierge → on ne conserve pas', {}, false],
    ['siège déjà sur le disque → consentement repris', { 'sw-forge-siege-defense-v1': '{}' }, true],
    ['ancien réglage compte = oui → repris', { 'sw-forge-keep-account-v1': '1' }, true],
    ['ancien réglage compte = non → repris', { 'sw-forge-keep-account-v1': '0' }, false],
    [
      'choix récent prioritaire sur les deux autres',
      { 'sw-forge-persist-v1': '0', 'sw-forge-keep-account-v1': '1', 'sky-arena-rta-v1': '{}' },
      false,
    ],
    ['un réglage seul ne vaut pas consentement', { 'sw-forge-rune-metric-v1': 'score' }, false],
  ];
  for (const [libelle, stockage, attendu] of cas) {
    egal(P.etatDepuisStockage(stockage).actif, attendu, libelle);
  }
}
