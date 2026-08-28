// Extraction d'un export SWEX. Deux propriétés à ne pas perdre :
//  - un fichier passé en TEXTE et le même passé en OBJET donnent exactement le
//    même résultat (c'est ce qui autorise le parse unique) ;
//  - la date affichée est celle de l'EXPORT, pas celle de l'import.

import {
  parseAccountBox,
  parseAccountExportDate,
  parseAccountInventory,
  parseAccountJson,
  parseAccountSource,
  parseSiegeDefense,
  parseSiegeOffense,
  parseUsedRuneIds,
  parseWizardId,
} from '../src/lib/importAccount';
import { formatRelicUnique } from '../src/lib/effects';
import { egal, exportReel, exportSynthetique, ignore, ok, titre } from './outils';

export default function testImport() {
  titre('Import de compte');

  const texte = exportSynthetique();
  const objet = parseAccountSource(texte)!;

  /* --- Contenu attendu du fichier d'exemple --------------------------- */

  const box = parseAccountBox(objet);
  egal(box.monsters.length, 2, 'box : seules les unités montées 6★ sont retenues');
  egal(box.monsters[0].com2usId, 15105, 'box : com2usId lu depuis unit_master_id');

  // ⚠️ **La propriété unique d'une relique n'est pas une substat.** Elle
  // déclenche un effet proportionnel à une stat (« +2 % par tranche de
  // 27 000 »), et `sec_effect` porte donc TYPE, TRANCHE et POURCENTAGE. Lue
  // comme un `{ code, value }`, elle affichait « Effet secondaire · 27000 » : le
  // pourcentage était perdu, et le nombre montré n'était pas une valeur mais un
  // diviseur.
  const relique = box.monsters[0].gear?.relic;
  egal(relique?.main, { code: 100, value: 11 }, 'relique : la stat principale reste un PV%');
  egal(
    relique?.unique,
    { type: 12, tranche: 27000, percent: 2 },
    'relique : type, tranche et pourcentage sont tous les trois lus'
  );

  // La tranche s'affiche AVEC son unité quand le type est connu (27 000 ne peut
  // être que des PV), et sans unité sinon — jamais avec une unité devinée.
  // ⚠️ Le séparateur de milliers est celui du FRANÇAIS (`toLocaleString`), une
  // espace insécable étroite — pas l'espace ordinaire du clavier. L'écrire en
  // dur dans l'attendu faisait échouer un test dont les deux chaînes
  // s'affichaient pourtant identiques.
  egal(
    formatRelicUnique(relique!.unique!),
    `+2% par tranche de ${(27000).toLocaleString('fr-FR')} PV`,
    'relique : la formule affichée porte le pourcentage et l’unité de la tranche'
  );
  egal(
    formatRelicUnique({ type: 999, tranche: 1000, percent: 1 }),
    `+1% par tranche de ${(1000).toLocaleString('fr-FR')}`,
    'relique : un type dont la stat est inconnue s’affiche sans unité, jamais avec une unité devinée'
  );
  // ⚠️ Quand la phrase du JEU est connue pour ce type, c'est elle qui s'affiche
  // — pas la formule générique. Relevée sur une pièce réelle : « +9 Relique de
  // Conquête Aiguisé », PV +12%, sec [1, 1000, 1].
  egal(
    formatRelicUnique({ type: 1, tranche: 1000, percent: 1 }),
    `DGTS infligés +1% tous les ${(1000).toLocaleString('fr-FR')} pts d'ATQ au début du combat`,
    'relique : la phrase du jeu prime sur la formule générique'
  );
  // Sans pourcentage (fichier partagé par une version antérieure), la phrase du
  // jeu serait incomplète : on retombe sur la formule.
  egal(
    formatRelicUnique({ type: 1, tranche: 1000 }),
    `par tranche de ${(1000).toLocaleString('fr-FR')} ATQ`,
    'relique : sans pourcentage connu, on retombe sur la formule plutôt que d’écrire une phrase trouée'
  );

  const inv = parseAccountInventory(objet);
  egal(inv.runes.length, 8, 'inventaire : runes équipées ET en réserve, dédupliquées');
  egal(inv.artifacts.length, 3, 'inventaire : artéfacts équipés ET en réserve');

  const rta = parseAccountJson(objet);
  egal(rta.units!.length, 2, 'RTA : les favoris, et eux seuls');

  const def = parseSiegeDefense(objet);
  egal(def.decks!.length, 2, 'siège défense : les decks configurés');
  egal(def.decks![0].slots.filter(Boolean).length, 2, 'siège défense : un slot vide reste vide');

  const off = parseSiegeOffense(objet);
  egal(off.decks!.length, 1, 'siège attaque : seuls les decks de type 22');
  egal(off.decks![0].slots[0]!.com2usId, 14314, 'siège attaque : le leader est en tête');

  /* --- Runes utilisées (decks tous contenus + RTA) --------------------- */

  // Le fichier d'exemple couvre les quatre chemins d'un coup :
  //  - preset RTA (1001-1003 + 9002, dont une rune qui dort en INVENTAIRE) ;
  //  - preset de défense de siège (1001-1003, 2001-2002) ;
  //  - deck de type 22 avec `equip` (1001, 1004, 2001) ;
  //  - deck ordinaire SANS preset (unité 101) → ses runes actuellement portées.
  // Reste dehors : 9001, en réserve et posée nulle part.
  const utilisees = parseUsedRuneIds(objet);
  egal(
    utilisees,
    [1001, 1002, 1003, 1004, 2001, 2002, 9002],
    'runes utilisées : decks (tous types) + presets RTA et siège'
  );
  ok(
    !utilisees.includes(9001),
    "runes utilisées : une rune de réserve posée nulle part n'y est pas"
  );
  // ⚠️ Une rune de l'INVENTAIRE peut jouer : les presets RTA/siège ne
  // déplacent rien en jeu. S'en tenir à `occupied_id` aurait raté ce cas.
  ok(utilisees.includes(9002), 'runes utilisées : une rune de réserve montée en RTA compte');
  egal(parseUsedRuneIds('{oops'), [], 'fichier illisible → aucune rune utilisée');

  /* --- Texte et objet : strictement équivalents ------------------------ */

  // ⚠️ C'est cette égalité qui autorise `App` à ne parser qu'une fois. Si elle
  // casse, l'app entière lit des données différentes de ce que testent les
  // lignes ci-dessus.
  for (const [nom, fn] of [
    ['RTA', parseAccountJson],
    ['box', parseAccountBox],
    ['inventaire', parseAccountInventory],
    ['siège défense', parseSiegeDefense],
    ['siège attaque', parseSiegeOffense],
    ['runes utilisées', parseUsedRuneIds],
  ] as const) {
    ok(
      JSON.stringify(fn(texte)) === JSON.stringify(fn(objet)),
      `${nom} : appel par texte identique à l'appel par objet`
    );
  }

  /* --- Fichiers illisibles --------------------------------------------- */

  egal(parseAccountJson('{oops').error, 'Fichier JSON illisible.', 'JSON cassé → message clair');
  ok(
    /unit_list/.test(parseAccountJson('[]').error ?? ''),
    "racine inattendue → on parle de 'unit_list', plus utile qu'« illisible »"
  );

  /* --- Date de l'export ------------------------------------------------ */

  const date = parseAccountExportDate(objet);
  egal(date, 1786261890 * 1000, 'date lue depuis tvalue (et non tvaluelocal)');
  // ⚠️ Garde-fous : sans eux, un champ absent ou dans une autre unité afficherait
  // une date absurde à l'utilisateur, qui la croirait.
  egal(parseAccountExportDate('{"unit_list":[]}'), null, 'pas de tvalue → aucune date');
  egal(parseAccountExportDate('{"tvalue":1786261890000}'), null, 'tvalue en millisecondes → rejetée');
  egal(parseAccountExportDate('{"tvalue":1}'), null, 'tvalue antérieure au jeu → rejetée');

  /* --- Identité du compte (wizard_id) ----------------------------------- */

  // ⚠️ C'est CETTE valeur (pas `tvalue`) qui distingue un réexport du même
  // compte (même wizard_id, autre date) d'un compte réellement différent —
  // voir App.tsx, `appliquerImport` (réinitialisation de l'exclusion
  // manuelle de runes de l'Optimizer).
  egal(parseWizardId('{"wizard_id":6399149}'), 6399149, 'wizard_id lu depuis la racine');
  egal(parseWizardId('{"unit_list":[]}'), null, 'pas de wizard_id → aucune identité');
  egal(parseWizardId('{"wizard_id":0}'), null, 'wizard_id à zéro → rejeté (jamais un vrai compte)');
  egal(parseWizardId('{"wizard_id":"abc"}'), null, 'wizard_id non numérique → rejeté');

  /* --- Sur l'export réel, quand il est là ------------------------------ */

  const reel = exportReel();
  if (!reel) {
    ignore("cohérence sur l'export réel", 'export du développeur absent, gitignoré');
    return;
  }
  const reelObjet = parseAccountSource(reel)!;
  ok(parseAccountBox(reelObjet).monsters.length > 100, 'export réel : la box 6★ est extraite');
  ok(parseAccountInventory(reelObjet).runes.length > 1000, 'export réel : l’inventaire de runes est extrait');
  const d = parseAccountExportDate(reelObjet);
  ok(d !== null && d < Date.now(), 'export réel : date d’export plausible');
  const w = parseWizardId(reelObjet);
  ok(w !== null && w > 0, 'export réel : wizard_id plausible');
  // Un compte réel fait jouer une PART de son stock : ni zéro (les decks
  // seraient mal lus), ni tout (le filtre ne servirait à rien).
  const utiliseesReelles = parseUsedRuneIds(reelObjet);
  const totalRunes = parseAccountInventory(reelObjet).runes.length;
  ok(
    utiliseesReelles.length > 0 && utiliseesReelles.length < totalRunes,
    `export réel : ${utiliseesReelles.length} runes utilisées sur ${totalRunes}`
  );
}
