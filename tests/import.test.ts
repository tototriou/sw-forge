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
} from '../src/lib/importAccount';
import { egal, exportReel, exportSynthetique, ignore, ok, titre } from './outils';

export default function testImport() {
  titre('Import de compte');

  const texte = exportSynthetique();
  const objet = parseAccountSource(texte)!;

  /* --- Contenu attendu du fichier d'exemple --------------------------- */

  const box = parseAccountBox(objet);
  egal(box.monsters.length, 2, 'box : seules les unités montées 6★ sont retenues');
  egal(box.monsters[0].com2usId, 15105, 'box : com2usId lu depuis unit_master_id');

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
}
