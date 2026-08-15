// Tous les BUILDS connus du joueur, toutes provenances confondues.
//
// Pourquoi : la box ne contient que l'équipement **actuellement porté**. Or dans
// SW, un monstre a un preset de runes PAR contexte (RTA, défense de siège,
// offense de siège). Confronter une recommandation à la seule box faisait donc
// échouer un deck… que le joueur possède exactement tel quel en siège.
//
// Deuxième effet : un monstre présent dans un deck est **possédé**, même s'il
// n'apparaît pas dans la box 6★ (ex. non monté 6★ au moment de l'export, ou
// unité filtrée). On ne peut pas le déclarer « non possédé ».
//
// Calcul pur — aucune dépendance React.

import { GearSet, Monster, RtaEntry, SiegeTeam } from '../types';
import { BoxItem } from './applyAccount';

export type BuildSource = 'box' | 'rta' | 'defense' | 'offense';

export interface OwnedBuild {
  monster: Monster;
  gear: GearSet;
  source: BuildSource;
  label: string; // « Box », « RTA », « Défense 3 »… pour l'affichage
}

export const SOURCE_LABEL: Record<BuildSource, string> = {
  box: 'Box',
  rta: 'RTA',
  defense: 'Défense',
  offense: 'Offense',
};

// Rassemble les builds depuis toutes les sources chargées.
export function collectOwnedBuilds(args: {
  box: BoxItem[];
  rta: RtaEntry[];
  defense: SiegeTeam[];
  offense: SiegeTeam[];
  monsterById: Map<string, Monster>;
}): OwnedBuild[] {
  const { box, rta, defense, offense, monsterById } = args;
  const out: OwnedBuild[] = [];

  for (const item of box) {
    if (item.gear) out.push({ monster: item.monster, gear: item.gear, source: 'box', label: 'Box' });
  }

  for (const entry of rta) {
    const monster = monsterById.get(entry.monsterId);
    if (monster && entry.gear) out.push({ monster, gear: entry.gear, source: 'rta', label: 'RTA' });
  }

  const fromTeams = (teams: SiegeTeam[], source: 'defense' | 'offense') => {
    teams.forEach((team, i) => {
      for (const slot of team.slots) {
        const monster = slot.monsterId ? monsterById.get(slot.monsterId) : null;
        if (monster && slot.gear) {
          out.push({ monster, gear: slot.gear, source, label: `${SOURCE_LABEL[source]} ${i + 1}` });
        }
      }
    });
  };
  fromTeams(defense, 'defense');
  fromTeams(offense, 'offense');

  return out;
}

/* --------------------------------------------------------------------------
 * Équipes existantes du joueur
 * ----------------------------------------------------------------------- */

// Une équipe de siège réellement composée par le joueur : ses monstres et le
// build de chacun DANS cette équipe. Sert à répondre à « ai-je un deck avec ces
// monstres ? », question distincte de « ai-je ces monstres ? ».
export interface OwnedTeam {
  label: string; // « Défense 2 », « Offense 7 »
  builds: Map<number, OwnedBuild>; // com2usId → build dans CETTE équipe
}

export function collectOwnedTeams(args: {
  defense: SiegeTeam[];
  offense: SiegeTeam[];
  monsterById: Map<string, Monster>;
}): OwnedTeam[] {
  const { defense, offense, monsterById } = args;
  const out: OwnedTeam[] = [];

  const push = (teams: SiegeTeam[], source: 'defense' | 'offense') => {
    teams.forEach((team, i) => {
      const label = `${SOURCE_LABEL[source]} ${i + 1}`;
      const builds = new Map<number, OwnedBuild>();
      for (const slot of team.slots) {
        const monster = slot.monsterId ? monsterById.get(slot.monsterId) : null;
        const id = monster?.com2usId;
        if (monster && id != null && slot.gear) {
          builds.set(id, { monster, gear: slot.gear, source, label });
        }
      }
      if (builds.size > 0) out.push({ label, builds });
    });
  };
  push(defense, 'defense');
  push(offense, 'offense');

  return out;
}

// Combien d'EXEMPLAIRES 6★ le joueur possède, par `com2usId`.
//
// ⚠️ La **box seule**, jamais `collectOwnedBuilds` : celui-ci agrège les presets
// (RTA, défense, offense), si bien qu'un seul monstre y apparaît trois fois. Le
// compter là-dessus multiplierait les exemplaires par le nombre de contextes où
// il est utilisé, et annoncerait des decks montables qui ne le sont pas.
//
// ⚠️ **6★ uniquement**, ce que la box garantit déjà : `parseAccountBox` ne
// retient que `class === 6` (voir importAccount.ts). Un monstre en réserve à 5★
// n'est pas jouable en siège tel quel — l'annoncer comme disponible enverrait
// composer un deck impossible.
//
// Chaque entrée de la box est un `unit_id` distinct, donc une unité réelle.
export function countCopiesByCom2us(box: BoxItem[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const item of box) {
    const id = item.monster.com2usId;
    if (id == null) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

// Index par com2usId : un monstre peut avoir plusieurs builds (exemplaires
// multiples ET presets différents).
export function indexBuildsByCom2us(builds: OwnedBuild[]): Map<number, OwnedBuild[]> {
  const map = new Map<number, OwnedBuild[]>();
  for (const b of builds) {
    const id = b.monster.com2usId;
    if (id == null) continue;
    const list = map.get(id);
    if (list) list.push(b);
    else map.set(id, [b]);
  }
  return map;
}
