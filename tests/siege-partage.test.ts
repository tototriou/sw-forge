// Export / import d'équipes de siège :
// l'aller-retour garde la composition, un fichier hors format est refusé en
// entier, un monstre inconnu ou perso laisse son emplacement vide.

import { compterAvecRunes, exporterEquipes, lireEquipes, nomFichierSiege, FORMAT_SIEGE } from '../src/lib/siegeShare';
import { collectOwnedBuilds, collectOwnedTeams } from '../src/lib/ownedBuilds';
import { equipeContient, normaliser } from '../src/components/siege/rechercheEquipe';
import type { GearSet, Monster, SiegeSlot, SiegeTeam } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const MONSTRES = monstersJson() as Monster[];
const trouve = (nom: string, el: string) =>
  MONSTRES.filter((m) => m.name === nom && m.element === el && m.com2usId != null).sort((a, b) => (a.stats.speed ?? 0) - (b.stats.speed ?? 0))[0];

export default function testSiegePartage() {
  titre('Siège — export et import d\'équipes');

  const lushen = trouve('Lushen', 'wind');
  const veromos = trouve('Veromos', 'dark');
  const perso: Monster = { ...veromos, id: 'perso-1', com2usId: null, name: 'Mon perso' } as Monster;
  const parId = new Map<string, Monster>([lushen, veromos, perso].map((m) => [String(m.id), m]));

  const teams: SiegeTeam[] = [
    {
      id: 't1',
      lead: 0,
      tickAlertDismissed: false,
      slots: [
        { monsterId: String(lushen.id), runeSpeed: 120, tick: 286, sets: ['swift'] },
        { monsterId: String(veromos.id), runeSpeed: 90, tick: 0, sets: [] },
        { monsterId: String(perso.id), runeSpeed: 50, tick: 239, sets: [] },
      ],
    },
  ];

  const { texte, equipes, perso: nbPerso } = exporterEquipes(teams, 'offense', parId);
  egal(equipes, 1, 'une équipe exportée');
  egal(nbPerso, 1, 'le monstre perso est compté (son emplacement part vide)');
  const fichier = JSON.parse(texte);
  egal(fichier.format, FORMAT_SIEGE, 'format swblacksmith/siege-equipes');
  egal(fichier.equipes[0].monstres[0], { com2usId: lushen.com2usId, nom: 'Lushen', vitesseRunes: 120, tick: 286, sets: ['swift'] }, 'le leader part avec son com2usId, sa vitesse, son tick et ses sets');
  egal(fichier.equipes[0].monstres[2].com2usId, null, 'le monstre perso part vide');
  ok(!texte.includes('gear'), 'le détail des runes ne part pas');

  // Aller-retour : la composition revient, sur les ids LOCAUX du lecteur.
  const lu = lireEquipes(texte, MONSTRES);
  ok(lu.ok, 'le fichier exporté se relit');
  if (lu.ok) {
    egal(lu.cote, 'offense', 'le côté est relu');
    egal(lu.equipes[0].slots[0], { monsterId: String(lushen.id), runeSpeed: 120, tick: 286, sets: ['swift'] }, 'le leader revient tel quel');
    egal(lu.equipes[0].slots[2].monsterId, null, 'l\'emplacement du perso revient vide');
    egal(lu.inconnus, [], 'aucun monstre inconnu');
  }

  // Monstre absent des données du lecteur : emplacement vide, nommé.
  const sansLushen = MONSTRES.filter((m) => m.com2usId !== lushen.com2usId);
  const lu2 = lireEquipes(texte, sansLushen);
  ok(lu2.ok && lu2.equipes[0].slots[0].monsterId === null && lu2.inconnus.includes('Lushen'), 'un monstre inconnu laisse son emplacement vide, et il est nommé');

  // Refus en entier, avec la raison.
  const refus = (t: string, attendu: string, quoi: string) => {
    const r = lireEquipes(t, MONSTRES);
    ok(!r.ok && r.erreur.includes(attendu), `refusé : ${quoi}`);
  };
  refus('pas du json', 'pas du JSON', 'pas du JSON');
  refus(JSON.stringify({ format: 'autre' }), "n'est pas un export d'équipes", 'un autre format');
  refus(JSON.stringify({ format: FORMAT_SIEGE, version: 99, equipes: [] }), 'plus récente', 'une version future');
  // Une version absente ou illisible est un fichier abîmé, pas une version
  // future : aucune mise à jour ne le rendrait lisible.
  refus(JSON.stringify({ format: FORMAT_SIEGE, equipes: [] }), 'version illisible', 'une version absente');
  refus(JSON.stringify({ format: FORMAT_SIEGE, version: '2', equipes: [] }), 'version illisible', 'une version qui n’est pas un nombre');
  refus(JSON.stringify({ format: FORMAT_SIEGE, version: 1 }), 'aucune liste', 'pas de liste d\'équipes');

  // ---- Les runes : jointes seulement si l'auteur le choisit ----------------
  titre('Siège — export et import d\'équipes, avec les runes');
  const gear: GearSet = {
    base: { hp: 9000, atk: 800, def: 500, spd: 103, cr: 15, cd: 50, res: 15, acc: 0 },
    runes: [
      { id: 501, slot: 2, set: 'swift', rank: 6, rarity: 5, level: 15, main: { code: 8, value: 42 }, subs: [{ code: 4, value: 12, grind: 3 }] },
    ],
    artifacts: [],
  };
  const avecGear: SiegeTeam[] = [{ ...teams[0], slots: [{ ...teams[0].slots[0], gear }, teams[0].slots[1], teams[0].slots[2]] }];
  egal(compterAvecRunes(avecGear, parId), 1, 'un monstre partageable porte des runes connues');

  const sansRunes = JSON.parse(exporterEquipes(avecGear, 'offense', parId).texte);
  ok(!('equipement' in sansRunes.equipes[0].monstres[0]), 'par défaut, les runes ne partent pas');
  const fichierRunes = exporterEquipes(avecGear, 'offense', parId, true).texte;
  egal(JSON.parse(fichierRunes).equipes[0].monstres[0].equipement, gear, 'avec les runes : l’équipement du monstre part sous « equipement »');
  ok(!('equipement' in JSON.parse(fichierRunes).equipes[0].monstres[1]), 'un monstre sans équipement connu n’en emporte pas');

  const luRunes = lireEquipes(fichierRunes, MONSTRES);
  ok(luRunes.ok, 'le fichier avec runes se relit');
  if (luRunes.ok) {
    const slot = luRunes.equipes[0].slots[0] as SiegeSlot;
    egal(slot.gearPartage, gear, 'l’équipement revient dans gearPartage, tel qu’il est parti');
    ok(slot.gear === undefined, '⚠️ jamais dans gear : ce ne sont pas mes runes');
    egal(luRunes.avecRunes, 1, 'le rapport compte les monstres reçus avec leurs runes');

    // Les runes reçues ne font pas croire qu'on possède le monstre ni son build.
    const recu: SiegeTeam = { id: 'recu', lead: 0, tickAlertDismissed: false, slots: luRunes.equipes[0].slots };
    const parIdLecteur = new Map(MONSTRES.map((m) => [String(m.id), m]));
    egal(collectOwnedBuilds({ box: [], rta: [], defense: [], offense: [recu], monsterById: parIdLecteur }).length, 0, 'les runes reçues ne comptent pas dans les builds possédés');
    egal(collectOwnedTeams({ defense: [], offense: [recu], monsterById: parIdLecteur }).length, 0, 'ni l’équipe reçue dans les équipes possédées');

    // Réexporter une équipe reçue garde ses runes.
    const reexport = JSON.parse(exporterEquipes([recu], 'offense', parIdLecteur, true).texte);
    egal(reexport.equipes[0].monstres[0].equipement, gear, 'une équipe reçue se réexporte avec ses runes');
  }

  // Un équipement abîmé est ignoré, pas le fichier.
  const abime = JSON.parse(fichierRunes);
  abime.equipes[0].monstres[0].equipement = { runes: 'pas une liste', artifacts: [{}] };
  const luAbime = lireEquipes(JSON.stringify(abime), MONSTRES);
  ok(luAbime.ok && luAbime.equipes[0].slots[0].gearPartage === undefined && luAbime.equipes[0].slots[0].monsterId !== null, 'un équipement illisible est ignoré, le monstre reste');
  // Une relique sans identifiant : ignorée, et le rapport le dit.
  const reliqueSansId = JSON.parse(fichierRunes);
  reliqueSansId.equipes[0].monstres[0].equipement.relic = { main: { code: 101, value: 10 } };
  const luRelique = lireEquipes(JSON.stringify(reliqueSansId), MONSTRES);
  ok(luRelique.ok && luRelique.avertissements.some((a) => a.includes('relique')) && !luRelique.equipes[0].slots[0].gearPartage?.relic, 'une relique sans identifiant est ignorée, avec un avertissement');

  // Préfixe `swblacksmith-` ; le
  // FORMAT est `swblacksmith/siege-equipes`, l'ancien `sw-forge/siege-equipes`
  // restant relu (figé par marque.test.ts).
  egal(nomFichierSiege('defense', new Date(2026, 8, 26, 12, 0)), 'swblacksmith-siege-defense-2026-09-26.json', 'le nom du fichier dit le côté et la date');
  // Le jour LOCAL : à 0 h 30, c'est déjà le lendemain, quel que soit le fuseau
  // de la machine (le jour UTC serait la veille à l'est de Greenwich).
  egal(nomFichierSiege('offense', new Date(2026, 9, 7, 0, 30)), 'swblacksmith-siege-offense-2026-10-07.json', 'le nom du fichier porte le jour local, pas le jour UTC');

  // Recherche d'équipe par monstre.
  titre('Siège — recherche d\'équipe par monstre');
  const equipe = teams[0];
  ok(equipeContient(equipe, '', parId), 'une saisie vide garde toutes les équipes');
  ok(equipeContient(equipe, '  ', parId), 'des espaces seuls aussi');
  ok(equipeContient(equipe, 'lush', parId), '« lush » trouve Lushen (début du nom)');
  ok(equipeContient(equipe, 'ERO', parId), '« ERO » trouve Veromos (casse ignorée, milieu du nom)');
  ok(!equipeContient(equipe, 'chasun', parId), '« chasun » ne trouve pas une équipe sans Chasun');
  egal(normaliser('Éléonore'), 'eleonore', 'accents ignorés : « Éléonore » se cherche « eleonore »');
}
