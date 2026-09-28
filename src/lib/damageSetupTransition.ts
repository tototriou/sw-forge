import { DEFAULT_DAMAGE_SETUP, type DamageSetup } from './damage';

// Cette table est volontairement exhaustive : un champ ajouté à DamageSetup
// oblige à choisir son sens métier avant de pouvoir compiler.
export const DAMAGE_SETUP_CLASSIFICATION = {
  skillCom2usId: 'sort',
  enemyDef: 'contexte', enemyHp: 'contexte', enemyHpPct: 'contexte',
  ownHpPct: 'contexte', livingAlliesPct: 'contexte', aliveEnemies: 'contexte',
  sacrificeReservePct: 'sort', enemyAtk: 'contexte',
  enemyHpNotDestroyed: 'contexte', enemyDestroyedHpPct: 'legacy-contexte',
  enemySpd: 'contexte', enemyElement: 'contexte',
  leaderSkill: 'contexte', leaderSpeedPct: 'legacy-contexte', setsAuraExternes: 'contexte',
  atkBuff: 'contexte', defBuff: 'contexte', spdBuff: 'contexte',
  defBreak: 'contexte', defBreakParLeSort: 'sort', brand: 'contexte',
  euldongActif: 'contexte', mirinaeActif: 'contexte', deborahActif: 'contexte',
  miriamActif: 'contexte', transmissionActif: 'contexte', velaskaActif: 'contexte',
  velaskaPvPerduPct: 'contexte', critMode: 'contexte', summonerSkills: 'contexte',
  passifsOffensifs: 'sort', statsCombatActives: 'sort', coupsPersonnalises: 'sort',
  stackPersonnalise: 'sort', effetsCibleCount: 'sort',
  effetsCibleCountAutres: 'legacy-sort', buffsCibleCount: 'sort',
  buffsPropresCount: 'sort', buffsPropresCountAutres: 'legacy-sort',
  buffsAlliesCount: 'sort', atkDebuff: 'contexte', defDebuff: 'contexte',
  spdDebuff: 'contexte', compteurPersonnalise: 'sort',
  effetsPropresCount: 'sort', scenariosEffetsEntreCoups: 'sort',
  pvActuelsAvantSacrificePct: 'sort',
} as const satisfies Record<keyof DamageSetup, 'contexte' | 'sort' | 'legacy-contexte' | 'legacy-sort'>;

export function damageSetupApresChangementMonstre(setup: DamageSetup): DamageSetup {
  const suivant: DamageSetup = { ...DEFAULT_DAMAGE_SETUP };
  for (const champ of Object.keys(DAMAGE_SETUP_CLASSIFICATION) as (keyof DamageSetup)[]) {
    const sens = DAMAGE_SETUP_CLASSIFICATION[champ];
    if (sens === 'contexte' || sens === 'legacy-contexte') {
      // Affectation dynamique : les clés et leurs types sont liés par DamageSetup.
      (suivant as unknown as Record<string, unknown>)[champ] = setup[champ];
    }
  }
  return suivant;
}
