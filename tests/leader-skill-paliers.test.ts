import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';
import type { LeaderSkill } from '../src/types';
import { LEADER_SKILL_STATS, LEADER_SKILL_VALEURS } from '../src/lib/damage';

export function testLeaderSkillPaliersCorpus() {
  titre('Leader skill · couverture des paliers du corpus local des monstres');
  const corpus = JSON.parse(readFileSync('public/data/monsters.json', 'utf8')) as { monsters: { leaderSkill: LeaderSkill | null }[] };
  ok(corpus.monsters.length > 0, 'corpus non vide');
  for (const stat of LEADER_SKILL_STATS) {
    const valeurs = [...new Set(corpus.monsters.flatMap(m => m.leaderSkill?.stat === stat ? [m.leaderSkill.amount] : []))].sort((a, b) => a - b);
    ok(valeurs.length > 0, `${stat} : paliers présents dans le corpus`);
    egal(valeurs.filter(v => !LEADER_SKILL_VALEURS[stat].includes(v)), [], `${stat} : aucun palier du corpus absent du menu`);
    egal([...new Set(LEADER_SKILL_VALEURS[stat])].sort((a, b) => a - b), LEADER_SKILL_VALEURS[stat], `${stat} : menu trié sans doublon`);
  }
  ok(corpus.monsters.some(m => m.leaderSkill?.stat === 'Attack Speed' && m.leaderSkill.amount === 17), 'VIT 17 est présent dans le corpus');
  ok(LEADER_SKILL_VALEURS['Attack Speed'].includes(17), 'VIT 17 est proposé dans le menu');
}
