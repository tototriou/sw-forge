// Buffs STANDARD posés par un passif — le rappel d'« État de mon monstre »
// (rappel à l'écran, réglage manuel conservé).
//
// ⚠️ **Cette table ne change AUCUN calcul.** Elle n'est lue que par l'écran
// (OptimizerSection.tsx → EtatMonstre.tsx), jamais par damage.ts, le moteur
// ni la recette : le buff reste à allumer à la main, par les vignettes
// « Buff ATQ / DEF / VIT » qui existaient déjà. Le rappel dit seulement que
// le monstre choisi peut se le poser, et quand.
//
// ⚠️ **Curée par IDENTIFIANT de compétence, jamais par nom** : la liste est
// celle des passifs « buff standard », chacun relu dans la prose de sa fiche
// (`public/data/skills/<forme>.json`) ; 21 depuis que les trois passifs de boss
// (20021103/1203/1303) ont perdu leur forme jouable. Les buffs viennent de
// la PROSE ; l'effet de la fiche ne sert que de recoupement (Veteran 13213
// n'a aucun effet dans sa fiche : prose seule). Aucune règle n'est dérivée des champs
// (skill game-data-curation § 2-4) : un passif ajouté par le jeu n'a pas de
// rappel tant qu'il n'est pas curé ici.
//
// `condition` est un EXTRAIT LITTÉRAL de la prose du jeu (jamais reformulé,
// CLAUDE.md « les libellés sont ceux du jeu ») : le test vérifie qu'il s'y
// trouve mot pour mot, sur chaque fiche qui porte l'identifiant.
//
// Hors table, par contrat : les buffs qu'un SORT actif se pose lui-même
//, les passifs déjà modélisés (Detect Weakspot, Miriam,
// Euldong, Ciri, Reyka), la RES/PRE (Clear Water, Precision),
// Skogul et les formes transformées écartées.

import type { DetailMonstre } from './monsterSkills';

/** Un buff standard du jeu : ATQ, DEF, VIT (vignettes d'« État de mon monstre ») ou Taux Crit (sans vignette). */
export type BuffDePassif = 'atk' | 'def' | 'spd' | 'cr';

export interface BuffPoseParPassif {
  buffs: readonly BuffDePassif[];
  /** `tous` : le passif pose chacun des buffs ; `unParmi` : un seul, tiré par le jeu (« grants one of the following »). */
  mode: 'tous' | 'unParmi';
  /** Extrait littéral de la prose du jeu qui dit QUAND le buff est posé. */
  condition: string;
}

/**
 * Les 21 passifs, par identifiant de compétence. Une ligne = forme jouable
 * qui le porte (`formesJouables`), puis la prose qui fonde l'entrée.
 */
export const BUFFS_POSES_PAR_PASSIF_CONNUS: Readonly<Record<number, BuffPoseParPassif>> = {
  // Icaru 11031 — « Increases your Attack Power and counterattacks for 1 turn when you attack on your turn. »
  2061: { buffs: ['atk'], mode: 'tous', condition: 'when you attack on your turn' },
  // Perna 14512 — « Rises from the ashes at the moment of death with 100% HP, and then increases your Attack Power for 2 turns. »
  3212: { buffs: ['atk'], mode: 'tous', condition: 'Rises from the ashes at the moment of death' },
  // Juno 15712 — « Increases your Attack Speed for 2 turns if you get a harmful effect. »
  7112: { buffs: ['spd'], mode: 'tous', condition: 'if you get a harmful effect' },
  // Antares 16312 — « Gains a turn with a 15% chance whenever an enemy's turn ends. […] If this effect is
  // activated, […] your Attack Power and Critical Rate will be increased for 1 turn. »
  7512: { buffs: ['atk', 'cr'], mode: 'tous', condition: "Gains a turn with a 15% chance whenever an enemy's turn ends" },
  // Theomars 19211 — « When you take fatal damage, increases your Attack Power for 2 turns […] »
  10012: { buffs: ['atk'], mode: 'tous', condition: 'When you take fatal damage' },
  // Erwin 20913 — « When being attacked, […] your Attack Power and Attack Speed will be increased for 1 turn. »
  11713: { buffs: ['atk', 'spd'], mode: 'tous', condition: 'When being attacked' },
  // Amelia 21511 — « […] increases your Defense for 2 turns when you are attacked. »
  12311: { buffs: ['def'], mode: 'tous', condition: 'when you are attacked' },
  // Vidurr 22412 — « Returns to the hall of the fighters at the moment of death to be revived with 30% HP and
  // increases the Attack Power and Defense for 3 turns. »
  13012: { buffs: ['atk', 'def'], mode: 'tous', condition: 'at the moment of death to be revived with 30% HP' },
  // Magnum 22714 — « Increases the Attack Bar by 25% whenever an enemy gains a beneficial effect from a skill and
  // increases your Attack Power for 1 turn. »
  13214: { buffs: ['atk'], mode: 'tous', condition: 'whenever an enemy gains a beneficial effect from a skill' },
  // RYU 24011 — « If you receive damage during the turn of the enemy, […] increases your Attack Power for 1 turn. »
  13911: { buffs: ['atk'], mode: 'tous', condition: 'If you receive damage during the turn of the enemy' },
  // Moore 24511 — même prose que RYU.
  14411: { buffs: ['atk'], mode: 'tous', condition: 'If you receive damage during the turn of the enemy' },
  // Espresso Cookie 26513 — « grants one of the following effects to all allies for 2 turns whenever you gain a
  // turn: Increase Attack Power, Increase Defense, or Increase Attack Speed. »
  // Le porteur compté parmi « all allies », même réserve que Frodo (les effets portent `surSoi: false`, `aoe: true`).
  16313: { buffs: ['atk', 'def', 'spd'], mode: 'unParmi', condition: 'whenever you gain a turn' },
  // Chamomile 27013 — même prose qu'Espresso Cookie, même réserve.
  16813: { buffs: ['atk', 'def', 'spd'], mode: 'unParmi', condition: 'whenever you gain a turn' },
  // Satoru Gojo 30311 — « Increases your Defense for 1 turn and Attack Bar by 30% whenever your turn ends. »
  20011: { buffs: ['def'], mode: 'tous', condition: 'whenever your turn ends' },
  // Fridrion 30714 — « Increases your Defense for 2 turns whenever you are granted with a harmful effect […] »
  20414: { buffs: ['def'], mode: 'tous', condition: 'whenever you are granted with a harmful effect' },
  // Werner 30911 — même prose que Satoru Gojo.
  20611: { buffs: ['def'], mode: 'tous', condition: 'whenever your turn ends' },
  // Zenitsu Agatsuma 32213 — « When you take fatal damage from the enemy's attack, […] increases your Attack Power for 2 turns. »
  21613: { buffs: ['atk'], mode: 'tous', condition: "When you take fatal damage from the enemy's attack" },
  // Qilin Slasher 32913 — même prose que Zenitsu.
  22213: { buffs: ['atk'], mode: 'tous', condition: "When you take fatal damage from the enemy's attack" },
  // Frodo 34311 — « If no harmful effects were removed, increases the Attack Power of all allies for 2 turns. »
  // Le porteur compté parmi « all allies » : lecture de la prose, l'effet porte `surSoi: false` (non prouvé).
  23611: { buffs: ['atk'], mode: 'tous', condition: 'If no harmful effects were removed' },
  // Silver Tail 34911 — même prose que Frodo, même réserve.
  24111: { buffs: ['atk'], mode: 'tous', condition: 'If no harmful effects were removed' },
  // Carbine 22713 — « increases the Attack Power for 1 turn whenever the enemy's attack lands as a Glancing Hit »
  // (prose seule : la fiche n'a que `Increase ATB`).
  13213: { buffs: ['atk'], mode: 'tous', condition: "whenever the enemy's attack lands as a Glancing Hit" },
  // (Azazel, Kazuya Mishima et True Devil Kazuya, formes de boss, n'y sont plus : `formesJouables` les écarte.)
};

/** Les libellés des vignettes d'« État de mon monstre » ; le Taux Crit n'en a pas. */
export const LIBELLE_BUFF_DE_PASSIF: Readonly<Record<BuffDePassif, string>> = {
  atk: 'Buff ATQ',
  def: 'Buff DEF',
  spd: 'Buff VIT',
  cr: 'Buff Taux Crit',
};

/** Ce que la carte rend pour un passif de la table porté par le monstre choisi. */
export interface RappelBuffDePassif {
  skillCom2usId: number;
  /** Nom du jeu, sans le suffixe « (Passive) » (même règle que « Stats acquises en combat »). */
  nom: string;
  icone: string | null;
  /** « Buff ATQ et Buff Taux Crit », « Buff ATQ, Buff DEF ou Buff VIT ». */
  buffs: string;
  condition: string;
}

function joindre(libelles: string[], dernier: string): string {
  if (libelles.length <= 1) return libelles.join('');
  return `${libelles.slice(0, -1).join(', ')} ${dernier} ${libelles[libelles.length - 1]}`;
}

/**
 * Les rappels du monstre dont `detail` est la fiche, dans l'ordre de ses
 * compétences ; `[]` sans fiche ou sans passif de la table. Fonction pure.
 */
export function rappelsBuffsDePassif(detail: DetailMonstre | null): RappelBuffDePassif[] {
  if (!detail) return [];
  const rappels: RappelBuffDePassif[] = [];
  for (const c of detail.competences) {
    if (c.com2usId == null) continue;
    const entree = BUFFS_POSES_PAR_PASSIF_CONNUS[c.com2usId];
    if (!entree) continue;
    rappels.push({
      skillCom2usId: c.com2usId,
      nom: c.nom.replace(/\s*\(Passive\)\s*$/i, ''),
      icone: c.icone,
      buffs: joindre(entree.buffs.map((b) => LIBELLE_BUFF_DE_PASSIF[b]), entree.mode === 'unParmi' ? 'ou' : 'et'),
      condition: entree.condition,
    });
  }
  return rappels;
}
