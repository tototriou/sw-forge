// Palette Ctrl K — ce qu'elle propose pour une saisie (refonte graphique,
// lot 13, décision 29 ; docs/02-app/transverse/ § Palette Ctrl K).

import { MAX_EQUIPES, MAX_MONSTRES, resultatsPalette, type EntreePalette } from '../src/components/palette/recherchePalette';
import type { Monster, SiegeTeam } from '../src/types';
import { egal, monstersJson, ok, titre } from './outils';

const MONSTRES = monstersJson() as Monster[];
const parId = new Map(MONSTRES.map((m) => [String(m.id), m]));
const id = (nom: string, el: string) => String(MONSTRES.find((m) => m.name === nom && m.element === el)!.id);
const rien = () => {};
const entree = (libelle: string, contexte?: string): EntreePalette => ({ cle: libelle, libelle, contexte, faire: rien });

const PAGES = [entree('Accueil'), entree('Arène'), entree('Défense', 'Siège'), entree('Recommandations', 'Siège'), entree('Courbes', 'Runes')];
const ACTIONS = [entree('Importer mon compte'), entree('Thème clair'), entree('Créer une recommandation')];
const equipe = (tid: string, noms: [string, string][]): SiegeTeam =>
  ({ id: tid, lead: 0, tickAlertDismissed: false, slots: noms.map(([n, e]) => ({ monsterId: id(n, e), runeSpeed: null, tick: 0 })) }) as unknown as SiegeTeam;
const EQUIPES = [
  { cote: 'defense' as const, rang: 1, team: equipe('d1', [['Lushen', 'wind'], ['Veromos', 'dark'], ['Chasun', 'wind']]) },
  { cote: 'offense' as const, rang: 2, team: equipe('o2', [['Galleon', 'water'], ['Belladeon', 'light']]) },
];

const chercher = (saisie: string) =>
  resultatsPalette({ saisie, pages: PAGES, actions: ACTIONS, monstres: MONSTRES, equipes: EQUIPES, monsterById: parId, ouvrirFiche: rien, ouvrirSpeedTune: rien });
const titres = (saisie: string) => chercher(saisie).map((g) => g.titre);
const libelles = (saisie: string, groupe: string) => chercher(saisie).find((g) => g.titre === groupe)?.entrees.map((e) => e.libelle) ?? [];

export function testPalette() {
  titre('Palette Ctrl K — groupes, ordre, plafonds');

  egal(titres(''), ['Pages', 'Actions'], 'vide : les pages et les actions, pas de monstres');
  egal(libelles('', 'Pages').length, PAGES.length, 'vide : toutes les pages, comme le menu');

  egal(libelles('arene', 'Pages'), ['Arène'], 'insensible aux accents : « arene » trouve « Arène »');
  egal(libelles('siege', 'Pages'), ['Défense', 'Recommandations'], 'la section compte aussi : « siege » trouve ses sous-sections');

  ok(!titres('l').includes('Monstres'), 'une seule lettre : pas encore de monstres (3 000 fiches ne se parcourent pas)');
  ok(libelles('lushen', 'Monstres').includes('Lushen'), 'deux lettres et plus : les monstres, par leur nom');
  ok(libelles('an', 'Monstres').length <= MAX_MONSTRES, `au plus ${MAX_MONSTRES} monstres`);
  egal(new Set(libelles('lushen', 'Monstres')).size, libelles('lushen', 'Monstres').length, 'un nom par élément : pas de doublon de la même forme');

  egal(titres('lushen'), ['Monstres', 'Actions'], 'ordre des groupes : Pages, Monstres, Actions (ici sans page)');
  egal(libelles('lushen', 'Actions'), ['Speed tuning · Lushen, Veromos, Chasun'], 'une équipe dont un monstre correspond : son speed tuning');
  ok(chercher('lushen').find((g) => g.titre === 'Actions')!.entrees[0].contexte === 'Défense · équipe 1', 'le côté et le rang de l\'équipe, en contexte');
  ok(!libelles('', 'Actions').some((l) => l.startsWith('Speed tuning')), 'vide : pas d\'équipe proposée');
  ok(libelles('xyz', 'Actions').length === 0 && chercher('xyz').length === 0, 'rien ne répond : aucun groupe (la palette dit « Aucun résultat »)');
  ok(MAX_EQUIPES === 8, 'au plus 8 équipes');

  egal(libelles('recommandation', 'Actions'), ['Créer une recommandation'], 'les actions se cherchent aussi par leur nom');
}
