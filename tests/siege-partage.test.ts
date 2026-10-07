// Export / import d'équipes de siège (refonte graphique, décision 14) :
// l'aller-retour garde la composition, un fichier hors format est refusé en
// entier, un monstre inconnu ou perso laisse son emplacement vide.

import { exporterEquipes, lireEquipes, nomFichierSiege, FORMAT_SIEGE } from '../src/lib/siegeShare';
import { equipeContient, normaliser } from '../src/components/siege/rechercheEquipe';
import type { Monster, SiegeTeam } from '../src/types';
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
  refus(JSON.stringify({ format: FORMAT_SIEGE, version: 1 }), 'aucune liste', 'pas de liste d\'équipes');

  // Préfixe `swblacksmith-` depuis le rebranding (R2, décision 14) ; le
  // FORMAT est `swblacksmith/siege-equipes`, l'ancien `sw-forge/siege-equipes`
  // restant relu (décision 66, figé par marque.test.ts).
  egal(nomFichierSiege('defense', new Date(2026, 8, 26, 12, 0)), 'swblacksmith-siege-defense-2026-09-26.json', 'le nom du fichier dit le côté et la date');
  // Le jour LOCAL : à 0 h 30, c'est déjà le lendemain, quel que soit le fuseau
  // de la machine (le jour UTC serait la veille à l'est de Greenwich).
  egal(nomFichierSiege('offense', new Date(2026, 9, 7, 0, 30)), 'swblacksmith-siege-offense-2026-10-07.json', 'le nom du fichier porte le jour local, pas le jour UTC');

  // Recherche d'équipe par monstre (même décision 14).
  titre('Siège — recherche d\'équipe par monstre');
  const equipe = teams[0];
  ok(equipeContient(equipe, '', parId), 'une saisie vide garde toutes les équipes');
  ok(equipeContient(equipe, '  ', parId), 'des espaces seuls aussi');
  ok(equipeContient(equipe, 'lush', parId), '« lush » trouve Lushen (début du nom)');
  ok(equipeContient(equipe, 'ERO', parId), '« ERO » trouve Veromos (casse ignorée, milieu du nom)');
  ok(!equipeContient(equipe, 'chasun', parId), '« chasun » ne trouve pas une équipe sans Chasun');
  egal(normaliser('Éléonore'), 'eleonore', 'accents ignorés : « Éléonore » se cherche « eleonore »');
}
