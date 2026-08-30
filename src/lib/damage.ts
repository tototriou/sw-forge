// Dégâts RÉELS d'un sort — la formule de la page Mécaniques (voir
// spec/mecaniques.md) appliquée à un sort précis d'un monstre précis, contre
// un adversaire configuré.
//
// ⚠️ **Tout ce qui peut être DÉDUIT du sort ne se redemande jamais à
// l'utilisateur.** Les données SWARFARM (public/data/skills/<com2usId>.json,
// voir monsterSkills.ts) portent déjà le coefficient (`formule`), le nombre
// de coups (`coups`), la portée (`aoe`), l'ignore défense (un effet nommé
// « Ignore DEF ») et le gain de dégâts des améliorations de compétence
// (« Damage +10% »). L'écran ne demande donc QUE ce qu'aucune donnée ne peut
// savoir : l'adversaire et les effets de combat actifs. Corollaire côté UI —
// `SkillDamageProfile.variables` dit quelles entrées le sort consomme
// RÉELLEMENT, ce qui permet de n'afficher que celles-là (un sort qui ignore
// la défense ne montre ni la DEF ennemie ni la réduction de défense).
//
// ⚠️ **Modèle communautaire PRÉDICTIF**, comme la page Mécaniques — pas le
// code du jeu. Volontairement HORS modèle en v1 (et donc absent du résultat,
// jamais approximé en silence) : variance (±2,8 %), avantage élémentaire et
// glancing, lignes de dégâts d'artéfact, réductions autres que la marque,
// et les mécaniques propres à certains monstres (Deborah, Herteit…).

import type { Competence, DetailMonstre } from './monsterSkills';
import type { ArtifactDetail, ElementKey } from '../types';
import { StatRow } from './stats';
import { StatKey } from './effects';

// ── Facteur de défense ───────────────────────────────────────────────────
// ⚠️ **Source unique** de la mitigation par la défense pour toute l'app —
// `objectiveScore('ehp')` (runeBuildOptim.ts) lit ces mêmes constantes plutôt
// que d'en garder une copie. Aligné wiki fandom ; swcalc.cz affiche
// `1142 + 3,572 × DEF`, écart jugé négligeable (voir spec/mecaniques.md).
export const DEF_FACTOR_CONST = 1140;
export const DEF_FACTOR_COEF = 3.5;

// ⚠️ Ne vaut JAMAIS 1, même à DEF = 0 : le plancher est 1000/1140 ≈ 0,877 —
// une cible sans la moindre défense mitige quand même un peu.
export function defenseFactor(def: number): number {
  return 1000 / (DEF_FACTOR_CONST + DEF_FACTOR_COEF * Math.max(0, def));
}

// ── Effets de combat modélisés ───────────────────────────────────────────
// Potences de base des buffs, tronquées vers le bas selon le bonus d'effet
// (`⌊base × (1 + effet/100)⌋`, voir spec/mecaniques.md). v1 n'expose PAS de
// bonus d'effet : la potence de base s'applique telle quelle.
//
// ⚠️ Chaque effet porte ici son ICÔNE de jeu (même hébergement SWARFARM que
// `EffetCompetence.icone`, voir monsterSkills.ts — pas de fichier local,
// affichée telle quelle en `<img>` comme partout ailleurs dans l'app) : ce
// sont ces icônes qui SERVENT DE CONTRÔLE dans DamageSetupCard.tsx (une
// vignette cliquable, pas une case à cocher séparée) — les garder à côté de
// la constante qu'elles illustrent évite qu'elles divergent silencieusement
// si une constante change un jour.
export const ATK_BUFF_PCT = 50;
export const ATK_BUFF_ICON = 'https://swarfarm.com/static/herders/images/buffs/buff_attack_up.png';
export const DEF_BUFF_PCT = 70;
export const DEF_BUFF_ICON = 'https://swarfarm.com/static/herders/images/buffs/buff_defence_up.png';
export const SPD_BUFF_PCT = 30;
export const SPD_BUFF_ICON = 'https://swarfarm.com/static/herders/images/buffs/buff_speed.png';
// Réduction de défense (« def break ») : la DEF de la cible est multipliée
// par ce facteur.
export const DEF_BREAK_FACTOR = 0.3;
export const DEF_BREAK_ICON = 'https://swarfarm.com/static/herders/images/buffs/debuff_defence_down.png';
// Marque (« Branding ») : +25 % de dégâts subis. Additif dans le terme
// « Réductions » de l'équation finale, pas un multiplicateur du DMG%.
export const BRAND_BONUS_PCT = 25;
export const BRAND_ICON = 'https://swarfarm.com/static/herders/images/buffs/debuff_brand.png';

// ── Effets d'ÉQUIPE (portés par un AUTRE monstre que celui optimisé) ────
// Contrairement à `PASSIFS_OFFENSIFS_CONNUS`/aux modificateurs monstre-wide
// plus haut, ceux-ci ne dépendent PAS du monstre optimisé — n'importe quel
// monstre peut en bénéficier si l'un de ces quatre est dans son équipe.
// Demande explicite de l'utilisateur : sélectionnables dans « Effets actifs »
// comme un buff ATQ, avec le PORTRAIT du monstre en icône plutôt qu'une
// icône de buff générique — d'où des URLs de PORTRAIT (`Monster.image`,
// swarfarm.com/.../monsters/…), pas `buffs/…` comme les icônes ci-dessus.
//
// Euldong — « Triumph Over Evil (Passive) » : « Increases the Critical
// Damage by 100% when an ally attacks the enemy ». Confirmé par
// l'utilisateur : ajoute 100 POINTS à la stat Dgts Crit (130 % → 230 %),
// comme les points plats des compétences d'invocateur (`cdPoints`) — pas un
// facteur ×2. ⚠️ Le texte du jeu précise que cet effet ne cumule pas avec
// un AUTRE effet d'augmentation de Dgts Crit — aucun de modélisé ici pour
// l'instant, donc sans conséquence actuellement.
export const EULDONG_CD_POINTS = 100;
export const EULDONG_ICON = 'https://swarfarm.com/static/herders/images/monsters/unit_icon_0133_1_4.png';

// Mirinae — S3 « Cursed Music » : « increases the damage of all allies and
// enemies by 30% until your next turn starts ». Même famille que la Marque
// (+25 %, additif dans le terme « Réductions ») — confirmé par
// l'utilisateur : « stacks additively with -DMG% artifacts ».
export const MIRINAE_BONUS_PCT = 30;
export const MIRINAE_ICON = 'https://swarfarm.com/static/herders/images/monsters/unit_icon_0057_1_5.png';

// Deborah — S3 « Blacksmith's Discernment (Passive) » : « Increases the
// decreasing effects of Attack Power, Defense, and Attack Speed that
// enemies receive by 30% ». Amplifie la RÉDUCTION de DEF d'une réduction de
// défense déjà active (`setup.defBreak`), jamais une réduction à elle
// seule — confirmé par l'utilisateur : « Effective DEF break is 91% with
// deborah passive and a defense break », soit
// `1 − (1 − DEF_BREAK_FACTOR) × 1,30 = 1 − 0,7×1,30 = 1 − 0,91 = 0,09`.
// ⚠️ Le texte précise « 15% if it's the boss » — aucune notion de boss dans
// cet outil (comme partout ailleurs), seul le cas non-boss (30 %) est
// modélisé.
export const DEBORAH_AMPLIFY = 1.3;
export const DEBORAH_ICON = 'https://swarfarm.com/static/herders/images/monsters/unit_icon_0081_1_5.png';

// Miriam — S3 « Blacksmith's Technique (Passive) » : « Increases the
// increasing effects of Attack Power, Defense and Attack Speed that allies
// receive by 35% » — amplifie la MAGNITUDE des trois buffs (ATQ/DEF/VIT)
// déjà actifs, jamais leur simple présence. Généralise à ATQ/DEF le
// mécanisme déjà en place pour la VIT via un artéfact « Effet aug. VIT »
// (`speedBuffAmpliPct`) — mais Miriam, elle, est un TOGGLE (un monstre dans
// l'équipe ou non), pas une somme de lignes d'artéfact.
export const MIRIAM_AMPLIFY_PCT = 35;
export const MIRIAM_ICON = 'https://swarfarm.com/static/herders/images/monsters/unit_icon_0081_1_2.png';

// Dr. Matteo — S3 « Transmission (Passive) » : « increases the damage that
// allies deal to enemies by 20% while you are under an inability effect ».
// ⚠️ Formulation IDENTIQUE à Mirinae (« increases the damage… by X% »),
// jamais confirmée séparément comme additive avec la Marque — traitée par
// ANALOGIE de formulation, même terme « Réductions ». Condition (« pendant
// que Dr. Matteo est sous incapacité ») non déductible : toggle, désactivé
// par défaut.
export const TRANSMISSION_BONUS_PCT = 20;
export const TRANSMISSION_ICON = 'https://swarfarm.com/static/herders/images/monsters/unit_icon_0214_1_2.png';

// Velaska — S3 « Price of Pain (Passive) » : « When an ally with reduced
// HP attacks the enemy, the damage dealt increases in proportion to the
// amount of HP lost. » Confirmé par l'utilisateur : scaling LINÉAIRE,
// +0,5 % de dégâts par point de % de PV perdu. ⚠️ Contrairement aux quatre
// autres effets d'équipe (un simple toggle), l'app ne peut pas savoir de
// COMBIEN de PV le monstre optimisé a effectivement écopé — un second
// réglage (`velaskaPvPerduPct`, 0 par défaut) porte la valeur, à côté du
// toggle « Velaska dans l'équipe ».
export const VELASKA_PCT_PAR_PV_PERDU = 0.5;
export const VELASKA_ICON = 'https://swarfarm.com/static/herders/images/monsters/unit_icon_0175_1_5.png';

// ── Leader skill d'ÉQUIPE (choisi par l'utilisateur) ─────────────────────
// Généralise l'ancien `leaderSpeedPct` (un seul pourcentage de VIT nu) à
// TOUTE stat de lead — demande explicite : « choisir un leader skill…
// implémenter les leader skill de PV, d'ATQ, de DEF, de VIT, de Taux Crit
// et de dégâts crit ». Un CHOIX de l'utilisateur (comme les quatre effets
// d'équipe plus haut), jamais déduit d'un monstre — le lead vient d'un
// AUTRE monstre de l'équipe, potentiellement pas encore modélisé ici.
//
// ⚠️ **Vocabulaire SWARFARM, pas un vocabulaire maison** (`'Attack Power'`,
// pas `'atk'`) : ce sont EXACTEMENT les clés de `LeaderSkill.stat`
// (types.ts) et de `STAT_LABEL`/`leadIconUrl` (siege/LeadPill.tsx, déjà
// utilisées pour l'icône OFFICIELLE d'un lead ET son libellé court) —
// réutilisées telles quelles plutôt que dupliquées, exactement la mise en
// garde déjà écrite dans LeadPill.tsx (« deux tables de libellés
// auraient divergé »). `leadIconUrl` exige `area`/`element` (portée d'un
// VRAI lead de monstre) que ce choix utilisateur n'a pas : un lead choisi
// ici est toujours traité comme portée `'General'`, sans élément — direct
// dans `STAT_LABEL` mais pas dans `leadIconUrl`, il faut lui fournir un
// objet `LeaderSkill` minimal côté écran (voir DamageSetupCard.tsx).
export type LeaderSkillStat = 'HP' | 'Attack Power' | 'Defense' | 'Attack Speed' | 'Critical Rate' | 'Critical DMG';

// Valeurs de palier RÉELLES du jeu (nat 3 → nat 5+2A), confirmées par
// l'utilisateur — jamais une formule générique, ces paliers ne suivent pas
// une progression régulière d'une stat à l'autre. Dégâts Crit n'a qu'un
// seul palier connu.
export const LEADER_SKILL_PRESETS: Record<LeaderSkillStat, number[]> = {
  HP: [28, 33, 38, 40, 44, 50],
  'Attack Power': [28, 33, 38, 40, 44, 50],
  Defense: [28, 33, 38, 40, 44, 50],
  'Attack Speed': [21, 24, 28, 30, 33],
  'Critical Rate': [21, 24, 28, 33, 38],
  'Critical DMG': [25],
};

// ── Compétences d'invocateur ─────────────────────────────────────────────
// Remplacent les anciens TOTEMS de guilde (onglet « Combat ») et DRAPEAUX de
// Guerre de Guilde (onglet « Guilde ») — le jeu a fusionné les deux systèmes
// dans « Comp. d'invocateur ».
//
// ⚠️ **Toujours supposées MAXÉES**, comme les améliorations de compétence
// (voir `skillupDamagePct`) et le rechargement (`paliersRechargement`) : même
// parti pris dans toute l'app. Ce sont les valeurs Lv.20 des captures du jeu.
//
// ⚠️ **Trois états, pas deux interrupteurs indépendants** : l'onglet Guilde ne
// s'applique qu'en contenu de guilde, où les compétences de Combat comptent
// AUSSI — « Guilde » implique donc toujours « Combat », et deux cases
// séparées auraient laissé cocher une combinaison qui n'existe pas en jeu.
export type SummonerSkills = 'aucune' | 'combat' | 'guilde';

export const SUMMONER_SKILLS_LABELS: { key: SummonerSkills; label: string }[] = [
  { key: 'aucune', label: 'Aucune' },
  { key: 'combat', label: 'Combat' },
  { key: 'guilde', label: 'Combat + Guilde' },
];

// Onglet « Combat » — s'applique partout.
const COMBAT_PCT = { atk: 20, def: 20, hp: 20, spd: 15 } as const;
// ⚠️ Les Dgts Crit sont en POINTS de pourcentage ajoutés à la stat (comme une
// sous-stat de rune), pas un pourcentage de la base : un monstre à 150 % passe
// à 175 %, il ne gagne pas 25 % de 150.
const COMBAT_CD_POINTS = 25;
// « Puis. d'att. de <élément> » — ne bénéficie qu'aux monstres de CET élément.
// ⚠️ Déduit de l'élément du monstre optimisé, jamais demandé à l'utilisateur
// (même principe que le reste de ce module).
const COMBAT_ELEMENT_ATK_PCT = 21;

// Onglet « Guilde » — EN PLUS de Combat, uniquement en contenu de guilde.
const GUILDE_PCT = { atk: 20, def: 20, hp: 20 } as const;
const GUILDE_CD_POINTS = 25;

// Bonus total apporté par les compétences d'invocateur, séparé en un
// pourcentage (appliqué à la stat de BASE, comme le totem de vitesse l'était
// déjà — voir `pctSpeedBonus` dans speed.ts et spec/mecaniques.md) et des
// points plats (Dgts Crit).
export function summonerSkillBonus(
  choix: SummonerSkills,
  element: ElementKey | null
): { pct: Record<'atk' | 'def' | 'hp' | 'spd', number>; cdPoints: number } {
  const pct = { atk: 0, def: 0, hp: 0, spd: 0 };
  let cdPoints = 0;
  if (choix === 'aucune') return { pct, cdPoints };

  pct.atk += COMBAT_PCT.atk;
  pct.def += COMBAT_PCT.def;
  pct.hp += COMBAT_PCT.hp;
  pct.spd += COMBAT_PCT.spd;
  cdPoints += COMBAT_CD_POINTS;
  // ⚠️ `'unknown'` (élément inconnu/monstre perso) ne reçoit RIEN : aucune des
  // cinq compétences élémentaires ne le couvre en jeu.
  if (element && element !== 'unknown') pct.atk += COMBAT_ELEMENT_ATK_PCT;

  if (choix === 'guilde') {
    pct.atk += GUILDE_PCT.atk;
    pct.def += GUILDE_PCT.def;
    pct.hp += GUILDE_PCT.hp;
    cdPoints += GUILDE_CD_POINTS;
  }
  return { pct, cdPoints };
}

// ── Formules de compétence ───────────────────────────────────────────────
// Les variables que ce module sait évaluer. Toute autre variable rencontrée
// (`{Relative SPD}`, `{Attacker's Level}`, `ABSORPTION_TOT_CNT`…) rend le
// sort NON PRIS EN CHARGE — mieux vaut le dire que produire un nombre
// plausible mais faux.
// ⚠️ `Relative SPD` — `(Ta VIT totale − VIT totale de la cible) / VIT totale
// de la cible`, confirmée par l'utilisateur. Dépend de la VIT de
// l'ADVERSAIRE (`DamageSetup.enemySpd`, saisie manuelle comme `enemyDef`),
// pas seulement de la sienne — d'où sa présence ici plutôt qu'un simple
// alias de `SPD`.
export type DamageVariable = 'ATK' | 'DEF' | 'SPD' | 'MAX HP' | 'Target MAX HP' | 'Target Current HP %' | 'Relative SPD';

const SUPPORTED_VARIABLES: DamageVariable[] = [
  'ATK',
  'DEF',
  'SPD',
  'MAX HP',
  'Target MAX HP',
  'Target Current HP %',
  'Relative SPD',
];

// Stat de l'attaquant derrière chaque variable qui en est une — sert à savoir
// quelles stats du build la recherche doit privilégier (voir
// `damageRelevantStats`). Les variables de CIBLE n'y figurent pas : elles ne
// dépendent pas des runes. `Relative SPD` dépend de SA PROPRE vitesse (plus
// elle est haute, plus le ratio monte) — 'spd', comme `SPD`.
const VARIABLE_STAT: Partial<Record<DamageVariable, StatKey>> = {
  ATK: 'atk',
  DEF: 'def',
  SPD: 'spd',
  'MAX HP': 'hp',
  'Relative SPD': 'spd',
};

// Code de substat d'artéfact « Effet aug. VIT +X% » (voir `ARTIFACT_SUB`,
// effects.ts) — amplifie la MAGNITUDE d'un buff de VIT déjà actif
// (`DamageSetup.spdBuff`), jamais la VIT plate elle-même. Additionné sur
// tous les artéfacts ÉQUIPÉS (`SearchParams.artifacts` — fixes pour toute
// une recherche, l'Optimizer n'optimise que les runes) : plusieurs lignes
// identiques sur des artéfacts différents se cumulent, comme en jeu.
const CODE_EFFET_AUG_VIT = 206;

export function speedBuffAmpliPct(artifacts: ArtifactDetail[]): number {
  let total = 0;
  for (const a of artifacts) {
    for (const s of a.subs) {
      if (s.code === CODE_EFFET_AUG_VIT) total += s.value;
    }
  }
  return total;
}

// Passifs qui forcent le coup CRITIQUE quand le monstre est plus rapide que
// sa cible — Ciri (Eau), Rigna/Magic Order Swordsinger (Eau). ⚠️ Ces passifs
// n'ont NI formule NI coups (`Competence.formule` vide) : ce ne sont PAS des
// `PASSIFS_OFFENSIFS_CONNUS` (aucune contribution de dégâts propre), mais un
// MODIFICATEUR sur l'ENSEMBLE des dégâts du monstre — confirmé par
// l'utilisateur : « le passif en lui-même ne fait pas de dégâts... c'est lui
// qui force le Crit ». Table séparée, même discipline de curation par nom
// exact.
const CRIT_SI_PLUS_RAPIDE_CONNUS = new Set(['Lady of Space and Time (Passive)', 'Speed Difference (Passive)']);

export function monsterCritSiPlusRapide(detail: DetailMonstre | null): boolean {
  if (!detail) return false;
  return detail.competences.some((c) => c.passif && CRIT_SI_PLUS_RAPIDE_CONNUS.has(c.nom));
}

// Brita (« Might of the Mercenary ») / Eivor, Eau (« Might of the Clan »)
// — jumeaux de COLLABORATION (`jumeauCollab`, mêmes stats/compétences sous
// deux habillages), même mécanisme confirmé DEUX FOIS indépendamment par
// l'utilisateur : la branche « Attack Power » de ce passif accorde +100 %
// de dégâts une fois un SEUIL d'ATQ atteint (les deux autres branches,
// Defense/Attack Speed, sont défensives ou hors dégâts — hors modèle).
// ⚠️ Une PREMIÈRE réponse (Brita, « +633 d'ATQ, sans lead ») avait été mal
// interprétée comme un écart au-dessus de la seule BASE (736+633=1369).
// La réponse suivante (Eivor, même mécanique) a donné le total ABSOLU
// directement : « 1671, toute source confondue (ATQ de base + rune + lead
// + compétence d'invocateur) » — et 736 (base) + 302 (compétence
// d'invocateur combat, 41 % de la base) + 633 (rune) = 1671 EXACTEMENT :
// confirme que `+633` représentait la part RUNE seule, pas un écart sur la
// base entière. Seuil réel = 1671, un TOTAL ABSOLU (contrairement à tous
// les autres seuils de ce fichier, qui sont des écarts) — INCLUT le lead
// cette fois (`atkCombatComplet`, la même grandeur que `valeurs.ATK` de
// `computeSkillDamageDetail`, non partagée par prudence). Entièrement
// DÉDUIT, aucun bouton — même famille que `critSiPlusRapide`.
const BONUS_SI_ATQ_SEUIL_CONNUS: Record<string, { seuil: number; pct: number }> = {
  'Might of the Mercenary (Passive)': { seuil: 1671, pct: 100 }, // Mercenary Queen, Brita
  'Might of the Clan (Passive)': { seuil: 1671, pct: 100 }, // Eivor (Eau)
};

export function monsterBonusSiAtqSeuil(detail: DetailMonstre | null): { seuil: number; pct: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_SI_ATQ_SEUIL_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// Passifs qui majorent TOUS les dégâts du monstre proportionnellement à
// l'écart de VIT avec la cible, plafonné à `pctMax` à `ecartMax` points
// d'écart ou plus — Sonia/Battle Angel (« Evasion (Passive) », sans formule
// ni dégâts propres : encore un MODIFICATEUR, pas un
// `PASSIFS_OFFENSIFS_CONNUS`). Linéaire, confirmé par l'utilisateur : 50
// points d'écart = +50 %, 3 points = +3 %, 42 points = +42 %.
const BONUS_DEGATS_SELON_VIT_CONNUS: Record<string, { ecartMax: number; pctMax: number }> = {
  'Evasion (Passive)': { ecartMax: 50, pctMax: 50 }, // Sonia, Battle Angel
  // Confirmé par l'utilisateur : scaling linéaire, maximum de 200 % atteint
  // à +150 points d'écart de VIT — même mécanisme que Sonia, seuls les
  // paliers changent. Vérifié sur les données réelles : `formule: ""` sur
  // les deux (aucune contribution propre), texte SWARFARM identique mot
  // pour mot (« The damage increases up to 200% as your Attack Speed is
  // faster than the enemy's Attack Speed »). ⚠️ Heavenly Kicks n'existe que
  // sur Chun-Li (Lumière) — ses 4 autres formes élémentaires portent un
  // passif différent (Rankyaku).
  'Heavenly Kicks (Passive)': { ecartMax: 150, pctMax: 200 }, // Chun-Li (Lumière)
  'Turn Out (Passive)': { ecartMax: 150, pctMax: 200 }, // Leah (Lumière)
};

// Passifs qui augmentent le Taux Crit en proportion de la VIT de combat —
// Ciri (Feu, « Wolf School Training ») et Magic Order Swordsinger (Feu) /
// Reyka (« Quick Execution ») : « Your Critical Rate increases in
// proportion to your Attack Speed. Additionally, if your Critical Rate
// exceeds 100%, your Critical Damage increases by the exceeded amount. »
// `formule: ""` sur les trois — encore un MODIFICATEUR, pas un
// `PASSIFS_OFFENSIFS_CONNUS`. Confirmé par l'utilisateur : 1 point de Taux
// Crit tous les 12 points de VIT (arrondi vers le bas), et le SURPLUS
// au-delà de 100 % de Taux Crit se reverse en points de Dgts Crit, 1 pour 1
// (y compris le surplus apporté par ce même passif).
const CRIT_RATE_SELON_VIT_CONNUS: Record<string, { ptsParVit: number }> = {
  'Wolf School Training (Passive)': { ptsParVit: 12 }, // Ciri (Feu)
  'Quick Execution (Passive)': { ptsParVit: 12 }, // Magic Order Swordsinger (Feu), Reyka
};

export function monsterCritRateSelonVit(detail: DetailMonstre | null): { ptsParVit: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && CRIT_RATE_SELON_VIT_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// Passifs qui ajoutent des POINTS FLATS, inconditionnels, au Taux Crit ET
// aux Dgts Crit — Lizardman/Glinodon (« Detect Weakspot ») : « Increases
// your Critical Rate by 20% and the damage of your Critical Hits by 20%. »
// `formule: ""` — encore un MODIFICATEUR pur, `[Automatic Effect]` sans la
// moindre condition (contrairement à tout ce qui suit) : toujours actif,
// aucun bouton.
const BONUS_STAT_FIXE_CONNUS: Record<string, { cr: number; cd: number }> = {
  'Detect Weakspot (Passive)': { cr: 20, cd: 20 }, // Lizardman, Glinodon
};

export function monsterBonusStatFixe(detail: DetailMonstre | null): { cr: number; cd: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_STAT_FIXE_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// Info d'AFFICHAGE seule des deux modificateurs ci-dessus (nom, description,
// icône SWARFARM du passif) — jamais utilisée par le calcul, qui reste sur
// `monsterCritSiPlusRapide`/`monsterBonusDegatsSelonVit`. Sert à les montrer
// dans « Passifs offensifs » exactement comme un `PassifOffensifProfile`
// (Feng Yan, Dominic…), corrigeant un oubli signalé par l'utilisateur : ces
// deux-là étaient calculés mais jamais AFFICHÉS, contrairement aux passifs à
// formule.
export interface ModificateurVitAffichage {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  detail: string;
}

export function monsterModificateursVit(detail: DetailMonstre | null): ModificateurVitAffichage[] {
  if (!detail) return [];
  const out: ModificateurVitAffichage[] = [];
  for (const c of detail.competences) {
    if (!c.passif || c.com2usId == null) continue;
    if (CRIT_SI_PLUS_RAPIDE_CONNUS.has(c.nom)) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: 'toujours actif — critique garanti si plus rapide que la cible',
      });
    }
    const atqSeuil = BONUS_SI_ATQ_SEUIL_CONNUS[c.nom];
    if (atqSeuil) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +${atqSeuil.pct} % de dégâts si ton ATQ totale (avec lead) atteint ${atqSeuil.seuil}`,
      });
    }
    const bonus = BONUS_DEGATS_SELON_VIT_CONNUS[c.nom];
    if (bonus) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — jusqu'à +${bonus.pctMax} % de dégâts à ${bonus.ecartMax} pts d'écart de VIT`,
      });
    }
    const critVit = CRIT_RATE_SELON_VIT_CONNUS[c.nom];
    if (critVit) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +1 pt de Taux Crit tous les ${critVit.ptsParVit} pts de VIT, le surplus au-delà de 100 % se reverse en Dgts Crit`,
      });
    }
    const statFixe = BONUS_STAT_FIXE_CONNUS[c.nom];
    if (statFixe) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +${statFixe.cr} pts de Taux Crit, +${statFixe.cd} pts de Dgts Crit`,
      });
    }
    const selonCr = BONUS_DEGATS_SELON_CR_CONNUS[c.nom];
    if (selonCr) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +${selonCr.ratio} % de dégâts par point de Taux Crit`,
      });
    }
    const selonDef = BONUS_DEGATS_SELON_DEF_CONNUS[c.nom];
    if (selonDef) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — jusqu'à +${selonDef.pctMax} % de dégâts à ${selonDef.defMax} DEF`,
      });
    }
    // ⚠️ Malgré son nom, cette fonction affiche tout modificateur MONSTRE-WIDE
    // TOUJOURS ACTIF (aucun bouton, rien à saisir) — voir `BONUS_STAT_FIXE_CONNUS`
    // juste au-dessus, déjà hors VIT. Les trois ci-dessous (Spear of
    // Tenacity/Martial Arts Specialist/Sickle Blade/Sand Blade) suivent le
    // même principe.
    const ciblePvMax = BONUS_FIXE_CIBLE_PVMAX_CONNUS[c.nom];
    if (ciblePvMax) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +${ciblePvMax.pct} % des PV max de la cible ajoutés au multiplicateur`,
      });
    }
    const ecartDef = BONUS_ECART_DEF_CONNUS[c.nom];
    if (ecartDef) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +${ecartDef.coeff * 100} % de l'écart de DEF (toi − cible) ajoutés au multiplicateur, à chaque coup`,
      });
    }
    const maxHpPropre = BONUS_FIXE_MAXHP_PROPRE_CONNUS[c.nom];
    if (maxHpPropre) {
      out.push({
        skillCom2usId: c.com2usId,
        nom: c.nom,
        description: c.description,
        icone: c.icone,
        detail: `toujours actif — +${maxHpPropre.pct} % de tes PV max, UNE FOIS par sort (pas par coup)`,
      });
    }
  }
  return out;
}

export function monsterBonusDegatsSelonVit(detail: DetailMonstre | null): { ecartMax: number; pctMax: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_DEGATS_SELON_VIT_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// « Additionally, increases the damage dealt according to your Critical
// Rate. » `quantite: 0`/`null` dans les données SWARFARM — confirmé par
// l'utilisateur : « 1% de Taux critique = 0,8% de dégâts supplémentaire »,
// linéaire, sans plafond annoncé. Même famille que `BONUS_DEGATS_SELON_VIT_CONNUS`
// (multiplicatif sur le TOTAL, toujours actif, aucun bouton), mais la
// source est le Taux Crit BRUT (`crBrutEffectif`, AVANT plafond à 100 % —
// cohérent avec Wolf School Training, qui traite déjà ce même nombre comme
// significatif au-delà de 100 %) plutôt que l'écart de VIT.
const BONUS_DEGATS_SELON_CR_CONNUS: Record<string, { ratio: number }> = {
  'Hidden Sense of Justice (Passive)': { ratio: 0.8 }, // Zenitsu Agatsuma (Ténèbres)
  'Lethal Intent (Passive)': { ratio: 0.8 }, // Qilin Slasher (Ténèbres)
};

export function monsterBonusDegatsSelonCr(detail: DetailMonstre | null): { ratio: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_DEGATS_SELON_CR_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// « Increases the damage you deal to enemies by up to 100% in proportion to
// your Defense. » `quantite: 100` confirmé en données — confirmé par
// l'utilisateur : 100 % à 5000 DEF (« y compris lead, buff DEF... »).
// ⚠️ Distinct de `bonusEcartDef` (Martial Arts Specialist) : ici c'est TA
// PROPRE DEF, sans comparaison avec la cible — même famille que
// `BONUS_DEGATS_SELON_VIT_CONNUS`/`BONUS_DEGATS_SELON_CR_CONNUS`
// (multiplicatif sur le TOTAL, linéaire, plafonné, toujours actif).
const BONUS_DEGATS_SELON_DEF_CONNUS: Record<string, { defMax: number; pctMax: number }> = {
  'Aegis Shell (Passive)': { defMax: 5000, pctMax: 100 }, // Beetle Guardian, Gideon
};

export function monsterBonusDegatsSelonDef(detail: DetailMonstre | null): { defMax: number; pctMax: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_DEGATS_SELON_DEF_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// Passifs qui majorent TOUS les dégâts du monstre d'un pourcentage qui
// S'ACCUMULE en combat (Momo/Mage — « Secret Book (Passive) » : « increases
// the damage by 10% each, up to 200%, whenever an ally attacks » — encore un
// MODIFICATEUR sans formule ni dégâts propres, PAS un
// `PASSIFS_OFFENSIFS_CONNUS`). ⚠️ Contrairement à `critSiPlusRapide`/
// `BONUS_DEGATS_SELON_VIT_CONNUS`, RIEN ici ne se déduit d'un état déjà
// connu de l'app (le nombre d'attaques alliées déjà portées dans le combat
// n'est pas simulé) : l'utilisateur choisit lui-même le niveau du
// DÉCLENCHEUR actuel, via `DamageSetup.stackPersonnalise`.
//
// ⚠️ **Le DÉCLENCHEUR et le BONUS DE DÉGÂTS sont DEUX NOMBRES DIFFÉRENTS,
// jamais confondus** — bug trouvé par l'utilisateur : le champ demandait
// jusque-là de saisir directement le bonus (ex. Borgnine : 0 à 30 %, par
// pas de 0,5) alors qu'il aurait dû demander le déclencheur RÉEL (les PV
// cible détruits, 0 à 60 %, par pas de 1) puis calculer le bonus lui-même
// (`ratio`). L'utilisateur devait faire la conversion mentalement, et le
// libellé du champ (« PV cible détruits (%) ») ne correspondait déjà plus
// à la plage affichée. `triggerMax`/`triggerStep` décrivent maintenant la
// plage du DÉCLENCHEUR saisi ; `ratio` (dégâts % par unité de déclencheur)
// et `pctMax` (plafond de dégâts, `= triggerMax × ratio`, gardé explicite
// par sécurité) décrivent le BONUS qui en résulte — jamais mélangés.
// `label`/`aide` décrivent le DÉCLENCHEUR (ce que l'utilisateur saisit),
// PAS le bonus — chaque entrée compte une chose réellement différente
// (attaques alliées, alliés morts, résultat d'un dé, buffs volés, PV
// détruits sur la cible, PV perdus sur SOI…), jamais un texte générique
// partagé (déjà signalé une première fois sur le texte, ici sur les
// PLAGES elles-mêmes).
// ⚠️ `offset` (0 par défaut, ABSENT pour toutes les entrées sauf Ludo) —
// certains déclencheurs ont un minimum RÉEL supérieur à 0 (un dé ne peut
// pas tomber sur 0, seulement 1 à 6) : `pct = max(0, trigger − offset) ×
// ratio`. Signalé par l'utilisateur sur Ludo : le résultat 1 (le minimum
// RÉEL du dé) doit donner 0 % de bonus, pas 20 % — `offset: 1` décale la
// PENTE (pas la plage saisie, qui reste 0-6 : 0 reste le défaut « rien
// saisi », distinct du vrai minimum du dé mais traité pareil, 0 %).
const BONUS_DEGATS_STACKABLE_CONNUS: Record<
  string,
  {
    triggerMax: number;
    triggerStep: number;
    ratio: number;
    pctMax: number;
    label: string;
    aide: string;
    suffix: string;
    offset?: number;
  }
> = {
  'Secret Book (Passive)': {
    triggerMax: 20,
    triggerStep: 1,
    ratio: 10,
    pctMax: 200,
    label: 'Attaques alliées',
    aide: "le nombre d'attaques alliées déjà portées ce combat",
    suffix: '',
  }, // Momo, Mage — « +10 % par attaque, jusqu'à +200 % » = 20 attaques
  // « the damage you inflict increases as more allies die » — `quantite`
  // ABSENT des données SWARFARM (`null` sur les deux effets), confirmé par
  // l'utilisateur : +10 % par allié mort, jusqu'à +30 % (3 morts). Même
  // état non simulé que Momo (le nombre d'alliés morts ce combat) — même
  // champ NUMÉRIQUE plutôt qu'un état déduit.
  'Dominator (Passive)': {
    triggerMax: 3,
    triggerStep: 1,
    ratio: 10,
    pctMax: 30,
    label: 'Alliés morts',
    aide: "le nombre d'alliés morts ce combat",
    suffix: '',
  }, // Archangel, Fermion
  // « The damage you inflict to the enemy increases by up to 100% the
  // larger the number on the dice » — un jet de dé (1 à 6) au début du
  // combat puis à chaque tour, confirmé par l'utilisateur : le dé va de 1 à
  // 6, le bonus de 0 à 100 %. ⚠️ Un dé ne tombe JAMAIS sur 0 — signalé par
  // l'utilisateur : le résultat 1 (le VRAI minimum du dé) doit donner 0 %
  // de bonus, pas 20 %. `offset: 1` décale la pente
  // (`max(0, trigger − 1) × 20`) : 1→0 %, 2→20 %, …, 6→100 % (5 points
  // d'écart réel entre le minimum et le maximum du dé, pas 6). Jamais un
  // état simulé (aucun RNG in-app). ⚠️ Le texte porte AUSSI une réduction
  // des dégâts SUBIS (« the smaller the number ») — hors modèle comme
  // partout ailleurs (jamais les effets défensifs).
  'Roll Again (Passive)': {
    triggerMax: 6,
    triggerStep: 1,
    ratio: 20,
    pctMax: 100,
    offset: 1,
    label: 'Résultat du dé',
    aide: 'le résultat du dé (1 à 6, 0 = rien saisi) — un jet in-app, aucun RNG simulé ici',
    suffix: '',
  }, // Dice Magician, Ludo
  // « Steals 1 of the beneficial effects granted on the enemy with every
  // attack. The damage will be increased by 10% each up to 15 times
  // whenever this effect occurs. » — effet SWARFARM « Steal Buff », PAS un
  // vol de PV (corrigé après un signalement de l'utilisateur : « ce n'est
  // pas un vol de PV mais un vol de buff »). +10 %/vol, jusqu'à +150 %.
  'Absorb Shadow (Passive)': {
    triggerMax: 15,
    triggerStep: 1,
    ratio: 10,
    pctMax: 150,
    label: 'Buffs volés',
    aide: 'le nombre de buffs déjà volés sur la cible ce combat',
    suffix: '',
  }, // Boomerang Warrior (Ténèbres), Martina
  // « Increases damage by 100% while sleeping... increases the damage by
  // 200% on the next turn » (au réveil suite à des dégâts) — DEUX états
  // distincts, confirmé par l'utilisateur : « toggle entre 0 %, 100 % et
  // 200 % ». Ici, contrairement aux autres entrées, le déclencheur EST
  // directement le bonus (`ratio: 1`) — aucun état intermédiaire à
  // convertir, juste un choix parmi 3 paliers (`triggerStep: 100`).
  'Sleep Talk (Passive)': {
    triggerMax: 200,
    triggerStep: 100,
    ratio: 1,
    pctMax: 200,
    label: 'État',
    aide: 'si tu es endormi (100 %) ou viens de te réveiller sous dégâts ce tour (200 %)',
    suffix: '%',
  }, // Hypnomeow, Birman, Manx, Bombay
  // « Destroys the enemy's MAX HP... Allies... deal more damage
  // proportionate to the enemy target's destroyed HP. » `quantite: 0` en
  // données (comme Covenant) — confirmé par l'utilisateur : le déclencheur
  // (PV cible DÉTRUITS, pas perdus par les dégâts normaux) va de 0 à 60 %
  // par pas de 1 %, le bonus de dégâts qui en résulte de 0 à 30 % par pas
  // de 0,5 % (`ratio: 0.5`) — DEUX plages différentes, jamais confondues
  // (bug corrigé, voir la note en tête de table).
  'Destroyer of Battlefield (Passive)': {
    triggerMax: 60,
    triggerStep: 1,
    ratio: 0.5,
    pctMax: 30,
    label: 'PV cible détruits',
    aide: 'le pourcentage de PV max de la cible déjà DÉTRUITS par ce passif (pas perdus par les dégâts normaux)',
    suffix: '%',
  }, // Slayer, Borgnine
  // Même mécanisme texte pour texte (« Destroy HP »/« Increase Damage »,
  // `quantite: 0`), confirmé par l'utilisateur avec un ratio DIFFÉRENT :
  // Moogwang +1 %/point de PV cible détruit (0-60 %), jusqu'à +60 %.
  'Fire Bead (Passive)': {
    triggerMax: 60,
    triggerStep: 1,
    ratio: 1,
    pctMax: 60,
    label: 'PV cible détruits',
    aide: 'le pourcentage de PV max de la cible déjà DÉTRUITS par ce passif (pas perdus par les dégâts normaux)',
    suffix: '%',
  }, // Dokkaebi Lord (Feu), Moogwang
  // « Inflicts additional damage proportionate to your HP as it decreases »
  // (`quantite: null`) — confirmé par l'utilisateur, puis CORRIGÉ : le
  // déclencheur (PV PERSONNELS perdus) est CAPÉ à 100 % (pas 200), le bonus
  // de dégâts qui en résulte va bien jusqu'à 200 % (`ratio: 2` — 100 % de
  // PV perdus × 2 = 200 %). Même mécanisme de saisie manuelle que
  // ci-dessus, source différente (ses propres PV perdus, pas ceux détruits
  // sur la cible).
  "Brawler's Will (Passive)": {
    triggerMax: 100,
    triggerStep: 1,
    ratio: 2,
    pctMax: 200,
    label: 'PV perdus',
    aide: 'le pourcentage de TES PROPRES PV max déjà perdus (pas ceux détruits sur la cible)',
    suffix: '%',
  }, // Neostone Fighter, Trevor
};

export interface BonusDegatsStackableProfile {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  triggerMax: number;
  triggerStep: number;
  ratio: number;
  pctMax: number;
  label: string;
  aide: string;
  suffix: string;
  // Voir `BONUS_DEGATS_STACKABLE_CONNUS` — absent/0 pour toutes les
  // entrées SAUF Ludo (le dé ne tombe jamais sur 0, seulement 1 à 6).
  offset?: number;
}

export function monsterBonusDegatsStackable(detail: DetailMonstre | null): BonusDegatsStackableProfile | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    if (!c.passif || c.com2usId == null) continue;
    const config = BONUS_DEGATS_STACKABLE_CONNUS[c.nom];
    if (config) return { skillCom2usId: c.com2usId, nom: c.nom, description: c.description, icone: c.icone, ...config };
  }
  return null;
}

// La valeur BRUTE du DÉCLENCHEUR actuellement saisie pour `p` (attaques
// alliées, PV cible détruits, résultat du dé…) — 0 par défaut, jamais
// deviné, bornée à `triggerMax` — même discipline défensive que
// `resolvedHits` (une recette écrite avant une régénération des données,
// ou une saisie puis un monstre différent chargé, ne doivent jamais
// produire une valeur hors plage). C'est CE nombre que `DamageSetupCard.tsx`
// affiche/fait saisir, PAS `resolvedStackPct` (le bonus qui en résulte).
export function resolvedStackTrigger(p: BonusDegatsStackableProfile, setup: DamageSetup): number {
  return Math.min(p.triggerMax, Math.max(0, setup.stackPersonnalise?.[p.skillCom2usId] ?? 0));
}

// Le pourcentage de dégâts qui RÉSULTE du déclencheur ci-dessus
// (`resolvedStackTrigger(...) × p.ratio`, borné à `pctMax` par sécurité) —
// c'est CE nombre que `computeTotalDamage` applique au TOTAL, jamais le
// déclencheur brut directement. ⚠️ Les deux ont longtemps été confondus
// (le déclencheur ÉTAIT directement saisi comme un pourcentage de dégâts,
// bug signalé par l'utilisateur sur Borgnine/Trevor) — désormais deux
// fonctions séparées.
export function resolvedStackPct(p: BonusDegatsStackableProfile, setup: DamageSetup): number {
  const ecart = resolvedStackTrigger(p, setup) - (p.offset ?? 0);
  return Math.min(p.pctMax, Math.max(0, ecart) * p.ratio);
}

// Le nombre d'effets sur la cible ACTUELLEMENT saisi pour `profile` — 0 si
// rien de saisi (jamais deviné), même discipline défensive que
// `resolvedStackPct`/`resolvedHits`. Aucun plafond : contrairement au Taux
// Crit ou à un stack de passif, le jeu ne pose pas de maximum universel de
// buffs/debuffs simultanés que cet outil pourrait connaître à l'avance.
export function resolvedEffetsCibleCount(profile: SkillDamageProfile, setup: DamageSetup): number {
  return Math.max(0, setup.effetsCibleCount?.[profile.skillCom2usId] ?? 0);
}

// Le compteur ACTUELLEMENT saisi pour `profile` (Crawler/Frankenstein —
// nombre d'attaques reçues) — 0 si rien de saisi. Borné à 9999, la plage
// confirmée par l'utilisateur, au cas où une saisie hors plage viendrait
// d'une recette écrite pour une autre règle.
export function resolvedCompteurPersonnalise(profile: SkillDamageProfile, setup: DamageSetup): number {
  return Math.min(9999, Math.max(0, setup.compteurPersonnalise?.[profile.skillCom2usId] ?? 0));
}

// Même discipline que `resolvedEffetsCibleCount`, mais sur SOI (Blessing of
// Curse) — stockage séparé (`DamageSetup.effetsPropresCount`), jamais
// confondu avec les effets sur la cible. Prend directement le
// `skillCom2usId` (celui du PASSIF détecteur, `monsterBonusParEffetPropre`)
// plutôt qu'un `SkillDamageProfile` — ce modificateur est MONSTRE-WIDE, pas
// rattaché à un sort actif précis (voir plus bas dans ce fichier).
export function resolvedEffetsPropresCount(skillCom2usId: number, setup: DamageSetup): number {
  return Math.max(0, setup.effetsPropresCount?.[skillCom2usId] ?? 0);
}

// Le bouton de `bonusConditionnelPropre` est-il activé ? Même stockage que
// `passifsOffensifs`/`bonusDegatsConditionnelActif`, mais la clé est celle
// DU SORT lui-même (pas d'un passif à part) — Emergency Drive n'a pas
// d'entrée `PASSIFS_OFFENSIFS_CONNUS`/`BONUS_DEGATS_CONDITIONNEL_CONNUS` à
// elle, le bouton vit directement sur le sort qu'il concerne.
export function bonusConditionnelPropreActif(profile: SkillDamageProfile, setup: DamageSetup): boolean {
  return setup.passifsOffensifs?.[profile.skillCom2usId] ?? false;
}

// Bonus à bouton RESTREINT À CE SORT — voir `SkillDamageProfile.
// bonusConditionnelPropre`. Clé = `Competence.nom` DU SORT ACTIF (pas d'un
// passif séparé), contrairement à `BONUS_DEGATS_CONDITIONNEL_CONNUS`.
const BONUS_CONDITIONNEL_PROPRE_CONNUS: Record<string, { pct: number; condition: string }> = {
  // « While in the mechanical frame state... deal 50% increased damage. »
  // (Emergency Drive, un PASSIF sans formule) — mais l'état ne s'obtient
  // qu'en usant automatiquement de [Rending Claw] (« Uses [Rending Claw] on
  // all enemies when you gain a turn » pendant l'état), qui porte donc CE
  // bonus, pas le TOTAL du monstre (un autre sort choisi dans l'écran
  // n'aurait aucun sens pendant cet état). `quantite: 50` confirmé en
  // données. Nom vérifié exclusif à la famille Arcane Weapon.
  'Rending Claw': { pct: 50, condition: 'tu es en Mechanical Frame State (Emergency Drive)' }, // Cynthia, Arcane Weapon
  // Brandia (« Touch of Mercy ») — SECONDE clause de ce sort, distincte du
  // `bonusParEffetCible` (+40 %/effet) déjà curé : « Targets that have
  // immunity against sleep will be inflicted with 50% more damage. »
  // Aucun `effet` SWARFARM dédié (seuls « Sleep » et « Debuff Bonus Damage »
  // sont listés) — signalé par l'utilisateur, `pct` confirmé directement
  // par lui (50 %). Condition (« la cible est immunisée au sommeil ») que
  // l'app ne peut pas déduire — bouton, comme demandé. Restreint à CE SORT
  // (pas monstre-wide) : le texte ne décrit que l'attaque qui vient de
  // poser Sleep elle-même, pas un bonus général du monstre.
  'Touch of Mercy': { pct: 50, condition: "la cible est immunisée au sommeil" }, // Brandia, Polar Queen
  // Zaiross (« Fiery Breath ») — « if the enemy's Attack Power is half or
  // less than your Attack Power, the attack always lands as a Critical Hit
  // and increases the damage dealt against the enemy by 50%. » Demande
  // explicite : seule la clause de DÉGÂTS (+50 %) est modélisée ici — l'ATQ
  // de l'adversaire n'est pas une donnée que l'app connaît, condition non
  // déductible, bouton comme Touch of Mercy/Rending Claw. ⚠️ La clause
  // « critique garanti » du même texte reste HORS MODÈLE (pas de mécanisme
  // pour un crit garanti conditionnel à ce sort précis, distinct de
  // `critSiPlusRapide` qui dépend de la VIT, pas de l'ATQ adverse) — même
  // limite que les clauses « combat de boss » déjà laissées de côté
  // ailleurs dans ce fichier. Skill partagé tel quel par le Dragon Feu 5★
  // pré-éveillé (même `com2usId` 2912) — le bouton s'applique aux deux.
  'Fiery Breath': { pct: 50, condition: "l'ATQ de la cible est ≤ la moitié de la tienne" }, // Zaiross, Dragon
};

// ── Modificateurs MONSTRE-WIDE additifs (passif sans formule, TOUJOURS
// actif, s'ajoutent au MULTIPLICATEUR du sort actif choisi — quel qu'il
// soit) ────────────────────────────────────────────────────────────────
// Même esprit que `BONUS_DEGATS_SELON_VIT_CONNUS`/`monsterBonusDegatsSelonVit`
// (détecté par scan des passifs, jamais un bouton — inconditionnel), mais
// ADDITIF au multiplicateur (comme `ajoutCompteur`/Crawler) plutôt que
// MULTIPLICATIF sur le total.

const BONUS_FIXE_CIBLE_PVMAX_CONNUS: Record<string, { pct: number }> = {
  // « Increases the damage dealt in proportion to the enemy's MAX HP. »
  // `quantite: null` en données — confirmé par l'utilisateur : 2 %. ⚠️ Une
  // SECONDE clause du texte (« +50% dans les combats de boss ») est hors
  // modèle, aucune notion de « combat de boss » dans cet outil — même limite
  // que Comeuppance (Onmyouji/Giou, `PASSIFS_OFFENSIFS_CONNUS`, plus haut :
  // sa propre SECONDE clause, +50 % en combat de boss, hors modèle pour la
  // même raison).
  'Spear of Tenacity (Passive)': { pct: 2 }, // Centaur Knight, Pholus
};

export function monsterBonusFixeCiblePvMax(detail: DetailMonstre | null): { pct: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_FIXE_CIBLE_PVMAX_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

const BONUS_ECART_DEF_CONNUS: Record<string, { coeff: number }> = {
  // « Inflicts additional damage proportionate to your Defense if your
  // Defense is higher than the opponent. » `quantite: 0` en données —
  // confirmé par l'utilisateur : 50 % de l'écart, à chaque coup.
  'Martial Arts Specialist (Passive)': { coeff: 0.5 }, // Martial Artist, Sin
};

export function monsterBonusEcartDef(detail: DetailMonstre | null): { coeff: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_ECART_DEF_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// Celui-ci s'ajoute UNE SEULE FOIS par sort (pas `×coups`) — voir
// `computeSkillDamageDetail`.
const BONUS_FIXE_MAXHP_PROPRE_CONNUS: Record<string, { pct: number }> = {
  // « Inflicts additional damage that's 7% of your MAX HP when you attack
  // on your turn. » `quantite: 7` confirmé en données, texte identique mot
  // pour mot sur les deux — noms DIFFÉRENTS (pas de partage cross-monstre
  // automatique ici, contrairement à « Destroyer of Battlefield »).
  'Sickle Blade (Passive)': { pct: 7 }, // Bayek (Vent)
  'Sand Blade (Passive)': { pct: 7 }, // Desert Warrior (Vent), Shahat
};

export function monsterBonusFixeMaxHpPropre(detail: DetailMonstre | null): { pct: number } | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    const trouve = c.passif && BONUS_FIXE_MAXHP_PROPRE_CONNUS[c.nom];
    if (trouve) return trouve;
  }
  return null;
}

// Ajout FIXE, UNE FOIS par sort, dérivé d'une saisie manuelle (contrairement
// aux trois précédents, entièrement déduits) — porte son PROPRE
// `skillCom2usId` (celui du PASSIF) pour clé de `DamageSetup.
// pvActuelsAvantSacrificePct`, l'entrée n'étant rattachée à aucun sort actif
// en particulier.
export interface BonusSacrificeProfile {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  pctPerte: number;
  pctSurPerte: number;
}

const BONUS_SACRIFICE_CONNUS: Record<string, { pctPerte: number; pctSurPerte: number }> = {
  // « Decreases your current HP by 20% at the start of each turn and
  // inflicts additional damage by 15% of the lost HP when you attack on
  // your turn. Critical Hits won't occur when attacking the enemy. »
  // `quantite: 20` (Self-Harm) / `15` (Increase Damage, note « Based on
  // Self-Harm ») confirmés en données. ⚠️ « Cannot Critical Hit » n'est PAS
  // appliqué automatiquement ici (aucun mécanisme monstre-wide de blocage du
  // critique dans ce fichier) — documenté, à sélectionner manuellement via
  // `DamageSetup.critMode = 'normal'` (jamais critique) pour ce monstre.
  'Calculated Sacrifice (Passive)': { pctPerte: 20, pctSurPerte: 15 }, // Onimusha, Fuuki
};

export function monsterBonusSacrifice(detail: DetailMonstre | null): BonusSacrificeProfile | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    if (!c.passif || c.com2usId == null) continue;
    const config = BONUS_SACRIFICE_CONNUS[c.nom];
    if (config) return { skillCom2usId: c.com2usId, nom: c.nom, description: c.description, icone: c.icone, ...config };
  }
  return null;
}

// PV ACTUELS (%) juste avant le déclenchement d'un sacrifice — défaut 100
// (premier tour, PLEINE vie) : contrairement aux autres résolveurs de ce
// fichier (0 par défaut, jamais deviné), 0 serait FAUX pour un premier tour
// normal — même logique que `defaut: 6` de Julie (`COUPS_VARIABLES_CONNUS`).
// Prend directement le `skillCom2usId` (celui du PASSIF détecteur,
// `monsterBonusSacrifice`) plutôt qu'un profil complet — ce modificateur est
// MONSTRE-WIDE, jamais rattaché à un sort actif précis.
export function resolvedPvActuelsAvantSacrificePctMonstre(skillCom2usId: number, setup: DamageSetup): number {
  const v = setup.pvActuelsAvantSacrificePct?.[skillCom2usId];
  return Math.min(100, Math.max(0, v ?? 100));
}

// ── Modificateurs MONSTRE-WIDE MULTIPLICATIFS selon un compte d'effets —
// même esprit que `BONUS_PAR_EFFET_CIBLE_CONNUS`/`bonusParEffetCible`, mais
// la source est un PASSIF sans formule (`formule: ""`) qui majore N'IMPORTE
// QUEL sort choisi, pas un sort actif précis. ─────────────────────────────

export interface BonusMonstreParEffetProfile {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  pct: number;
  source: 'buffs' | 'debuffs' | 'buffsEtDebuffs';
}

const BONUS_MONSTRE_PAR_EFFET_CIBLE_CONNUS: Record<string, { pct: number; source: 'buffs' | 'debuffs' | 'buffsEtDebuffs' }> = {
  // « damage increases by 20% for each harmful effect granted on target
  // whenever you attack the enemy. » `quantite: 20` confirmé en données.
  // Passif sans formule (`Backup Code (Passive)`) — majore le sort ACTIF
  // choisi, quel qu'il soit, contrairement à Touch of Mercy/Brandia
  // (`BONUS_PAR_EFFET_CIBLE_CONNUS`, un sort actif précis).
  'Backup Code (Passive)': { pct: 20, source: 'debuffs' }, // Hacker, 570RM
};

export function monsterBonusParEffetCible(detail: DetailMonstre | null): BonusMonstreParEffetProfile | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    if (!c.passif || c.com2usId == null) continue;
    const config = BONUS_MONSTRE_PAR_EFFET_CIBLE_CONNUS[c.nom];
    if (config) return { skillCom2usId: c.com2usId, nom: c.nom, description: c.description, icone: c.icone, ...config };
  }
  return null;
}

const BONUS_MONSTRE_PAR_EFFET_PROPRE_CONNUS: Record<string, { pct: number }> = {
  // « For every harmful effect granted on yourself, the damage dealt is
  // increased by 20%... » `quantite: 20` confirmé en données. Le texte
  // porte AUSSI une réduction des dégâts SUBIS (5 %/débuff) — hors modèle
  // comme partout ailleurs (jamais les effets défensifs). Toujours des
  // DÉBUFFS uniquement (aucun cas connu de « bonus par BUFF sur soi »).
  'Blessing of Curse (Passive)': { pct: 20 }, // Devil Maiden, Jessica
};

export interface BonusMonstreParEffetPropreProfile {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  pct: number;
}

export function monsterBonusParEffetPropre(detail: DetailMonstre | null): BonusMonstreParEffetPropreProfile | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    if (!c.passif || c.com2usId == null) continue;
    const config = BONUS_MONSTRE_PAR_EFFET_PROPRE_CONNUS[c.nom];
    if (config) return { skillCom2usId: c.com2usId, nom: c.nom, description: c.description, icone: c.icone, ...config };
  }
  return null;
}

// Passifs qui majorent TOUS les dégâts du monstre d'un pourcentage FIXE
// sous une condition que l'app ne peut PAS déduire (état de PV propre au
// monstre, comparaison avec la cible, état d'un allié, tour précédent…) —
// encore des MODIFICATEURS sans formule propre (`formule: ""` sur les
// douze), donc PAS des `PASSIFS_OFFENSIFS_CONNUS`. Même famille que
// `BONUS_DEGATS_SELON_VIT_CONNUS`/`BONUS_DEGATS_STACKABLE_CONNUS`
// (multiplicatif sur le TOTAL, après coup), mais la condition est binaire
// et purement DÉCLARATIVE — un bouton, désactivé par défaut, jamais deviné
// (même discipline que `passifsOffensifs`, dont la Record est d'ailleurs
// RÉUTILISÉE comme stockage : ces modificateurs n'ont pas de `formule`
// propre à additionner, mais ils ont bien un `skillCom2usId` de compétence
// à eux, la même clé que `PassifOffensifConnu.categorie: 'bonus'/
// 'conditionnel'` utilise déjà).
//
// ⚠️ Texte du jeu vérifié un par un (pas la paraphrase d'une recherche
// automatisée) avant d'ajouter chaque entrée ci-dessous :
const BONUS_DEGATS_CONDITIONNEL_CONNUS: Record<string, { pct: number; condition: string }> = {
  // « Decreases the damage taken by 50% and increases the damage dealt by
  // 100% when your HP is at 23.5% or below. » — seule la partie DÉGÂTS est
  // modélisée (la réduction de dégâts subis est hors du modèle, comme
  // partout ailleurs dans ce fichier).
  'Indomitable Will (Passive)': { pct: 100, condition: 'tes PV sont à 23,5 % ou moins' }, // Jin Kazama
  "Martial Artist's Will (Passive)": { pct: 100, condition: 'tes PV sont à 23,5 % ou moins' }, // Kai
  // « Increases the damage by up to 100% according to your HP condition if
  // you attack the enemy while having more than 50% HP. » ⚠️ Simplifié en
  // BINAIRE (0 % / 100 %) — le « up to… according to your HP condition »
  // suggère un scaling continu entre 50 % et 100 % de PV, mais aucune pente
  // n'est confirmée ; l'utilisateur a lui-même comparé ce cas à Dominic
  // (binaire), retenu tel quel plutôt que d'inventer une courbe.
  'Self Repair (Passive)': { pct: 100, condition: 'tes PV dépassent 50 %' }, // Cyborg, Eliza
  // « Increases the damage by 100% if your HP condition is worse than the
  // enemy's HP condition. » / « if the enemy has more HP than you » /
  // « if the enemy's HP is higher than your HP » — trois formulations du
  // MÊME sens (tes PV % < ceux de la cible), non déduit : l'app ne connaît
  // pas les PV du monstre optimisé lui-même (seulement ceux de la cible).
  'Small Grudge (Passive)': { pct: 100, condition: 'tes PV (en %) sont inférieurs à ceux de la cible' }, // Brownie Magician, Gemini
  'Vengeful Fire(Passive)': { pct: 100, condition: 'la cible a plus de PV (en %) que toi' }, // Astar
  'Quality of Phantom (Passive)': { pct: 100, condition: 'la cible a plus de PV (en %) que toi' }, // Jean
  // « Increases the damage you deal by 100% if you get a turn without
  // getting attacked for 1 turn. » — état du TOUR PRÉCÉDENT, jamais
  // trackable par un calcul instantané.
  'Strategic Advantage (Passive)': { pct: 100, condition: "tu n'as pas été attaqué depuis ton dernier tour" }, // Kyle
  'Infinity (Passive)': { pct: 100, condition: "tu n'as pas été attaqué depuis ton dernier tour" }, // Satoru Gojo
  'Magic Resistance (Passive)': { pct: 100, condition: "tu n'as pas été attaqué depuis ton dernier tour" }, // Werner
  // « Increases the damage by 50% if there is an ally under an inability
  // effect when you attack on your turn. » — état d'ÉQUIPE, hors de portée
  // d'un optimiseur mono-monstre sans le déclarer manuellement.
  'Protective Power (Passive)': { pct: 50, condition: 'un allié est sous un effet d’incapacité' }, // Zenitsu Agatsuma (Feu)
  'Retributive Power (Passive)': { pct: 50, condition: 'un allié est sous un effet d’incapacité' }, // Qilin Slasher
  // « increases the damage dealt by 50% if the enemy's Attack Power is
  // lower than yours. » — l'app connaît TON ATQ mais ne modélise pas celle
  // de l'adversaire (aucun champ `enemyAtk`).
  'Almighty Strength (Passive)': { pct: 50, condition: 'ton ATQ dépasse celui de l’adversaire' }, // Panda Warrior (Ténèbres), Mi Ying
  // Carcano — « Strikes the [Hidden Aim] pose. Increases the damage dealing
  // to an enemy by 200% while in this pose... The [Hidden Aim] pose
  // disables after you attack on your turn. » ⚠️ Ce n'est PAS un passif
  // (`c.passif: false` dans les données SWARFARM, formule vide « » — c'est
  // le S2, une pose auto-buff, pas une compétence qui inflige elle-même des
  // dégâts) : demandé explicitement par l'utilisateur comme interrupteur
  // malgré ça, cf. `monsterBonusDegatsConditionnel` qui ne filtre plus sur
  // `c.passif`. Nom vérifié exclusif à Carcano (toutes ses formes
  // élémentaires) dans tout le corpus.
  'Hidden Aim': { pct: 200, condition: 'tu es dans la pose Hidden Aim (activée par ce sort, désactivée après ta prochaine attaque)' }, // Carcano
  // « Recovers your HP by 20% each turn and if you have taken less than 20%
  // of your MAX HP as damage during the previous turn, increases the damage
  // dealt this turn by 100%. » — état du TOUR PRÉCÉDENT (dégâts subis),
  // jamais trackable. Nom RÉEL vérifié dans le corpus : « Idunn's Heart »
  // n'est PAS sur la forme Eau d'Eivor (contrairement à ce que le catalogue
  // laissait supposer) mais sur sa forme FEU (`27712`) — confirmé par un
  // grep exhaustif du corpus avant de curer, pas une supposition d'élément.
  "Idunn's Heart (Passive)": { pct: 100, condition: 'tu as pris moins de 20 % de tes PV max en dégâts au tour précédent' }, // Eivor (Feu)
  'Innate Physical (Passive)': { pct: 100, condition: 'tu as pris moins de 20 % de tes PV max en dégâts au tour précédent' }, // Solveig — texte identique mot pour mot
  // « When you receive HP recovery... increases the damage dealt to the
  // enemy, up to 200%, on the next turn. » ⚠️ Simplifié en BINAIRE (0 %/200 %)
  // comme Self Repair/Dominic — le « up to » suggère un scaling selon les PV
  // soignés, non chiffré : demande explicite de l'utilisateur (« activable
  // via toggle comme Dominic »).
  'Path of the Brave Warrior (Passive)': { pct: 200, condition: 'tu as reçu un soin au tour précédent' }, // Drakan Warrior, Deragron
  // « Inflicts 20% more damage on enemies with no beneficial effects. »
  // `quantite: 20` confirmé en données — inverse conceptuel de Julie/Small
  // Grudge (bonus si la cible N'A PAS d'effet bénéfique, pas selon son
  // nombre). ⚠️ La réponse de l'utilisateur (« jusqu'à 200 % ») ne
  // correspond PAS à cette entrée : les données SWARFARM sont formelles
  // (`quantite: 20`, texte fixe, aucun scaling) — retenu tel quel, écart
  // signalé plutôt que suivi à l'aveugle (le 200 % vient très probablement
  // d'une confusion avec Cold Brew/Iced Tea, juste en dessous, répondues
  // dans le même lot).
  'Female Warrior (Passive)': { pct: 20, condition: "la cible n'a aucun effet bénéfique" }, // Boomerang Warrior (Eau), Sabrina
  // « If you attack the frozen enemy on your turn, the damage dealt will be
  // increased by 200%. » `quantite: 200` confirmé en données. Nom RÉEL :
  // « Cold Brew » est sur la forme EAU d'Espresso Cookie (`26511`), pas la
  // forme Feu — même correction de méthode qu'Idunn's Heart ci-dessus.
  'Cold Brew (Passive)': { pct: 200, condition: 'la cible est gelée' }, // Espresso Cookie (Eau)
  'Iced Tea (Passive)': { pct: 200, condition: 'la cible est gelée' }, // Black Tea Bunny (Eau), Rosemary — texte identique mot pour mot
};

export interface BonusDegatsConditionnelProfile {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  pct: number;
  condition: string;
}

export function monsterBonusDegatsConditionnel(detail: DetailMonstre | null): BonusDegatsConditionnelProfile | null {
  if (!detail) return null;
  for (const c of detail.competences) {
    // ⚠️ Pas de filtre sur `c.passif` : la quasi-totalité des entrées de
    // `BONUS_DEGATS_CONDITIONNEL_CONNUS` sont des passifs, mais « Hidden
    // Aim » (Carcano) est un S2 actif à formule vide — le mécanisme
    // lui-même (un bouton qui multiplie le TOTAL) ne dépend en rien de la
    // nature passive/active de la compétence source, seulement de son nom
    // curé et de son `skillCom2usId` pour l'affichage/le stockage.
    if (c.com2usId == null) continue;
    const config = BONUS_DEGATS_CONDITIONNEL_CONNUS[c.nom];
    if (config) return { skillCom2usId: c.com2usId, nom: c.nom, description: c.description, icone: c.icone, ...config };
  }
  return null;
}

// Le bouton de `p` est-il activé ? Même stockage que
// `passifsOffensifs`/`PassifOffensifCategorie` (clé = `skillCom2usId`) —
// ce modificateur N'A PAS de formule propre à additionner, mais il a bien
// un `skillCom2usId` de compétence, la même nature de clé.
export function bonusDegatsConditionnelActif(p: BonusDegatsConditionnelProfile, setup: DamageSetup): boolean {
  return setup.passifsOffensifs?.[p.skillCom2usId] ?? false;
}

type Noeud =
  | { type: 'nombre'; valeur: number }
  | { type: 'variable'; nom: DamageVariable }
  | { type: 'binaire'; op: '+' | '-' | '*' | '/'; gauche: Noeud; droite: Noeud };

// Analyse descendante récursive sur une grammaire minuscule :
//   expr   := terme (('+'|'-') terme)*
//   terme  := facteur (('*'|'/') facteur)*
//   facteur:= nombre | '{' nom '}' | '(' expr ')'
//
// ⚠️ **Aucune tolérance** : le moindre jeton inattendu renvoie `null` plutôt
// que d'ignorer la partie incomprise. Une formule à moitié lue donnerait des
// dégâts silencieusement faux, ce qui est pire que « sort non pris en
// charge » — et le corpus contient réellement des formules hors grammaire
// (`1.5*1.5**(1*TARGET_{DEF})+1`).
function analyser(formule: string): { noeud: Noeud; variables: DamageVariable[] } | null {
  const variables = new Set<DamageVariable>();
  let i = 0;
  const s = formule;

  const passerEspaces = () => {
    while (i < s.length && /\s/.test(s[i])) i++;
  };

  function facteur(): Noeud | null {
    passerEspaces();
    if (i >= s.length) return null;
    if (s[i] === '(') {
      i++;
      const n = expr();
      if (!n) return null;
      passerEspaces();
      if (s[i] !== ')') return null;
      i++;
      return n;
    }
    if (s[i] === '{') {
      const fin = s.indexOf('}', i);
      if (fin === -1) return null;
      const nom = s.slice(i + 1, fin).trim();
      i = fin + 1;
      if (!(SUPPORTED_VARIABLES as string[]).includes(nom)) return null;
      variables.add(nom as DamageVariable);
      return { type: 'variable', nom: nom as DamageVariable };
    }
    const m = /^[0-9]+(\.[0-9]+)?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return { type: 'nombre', valeur: Number(m[0]) };
  }

  function terme(): Noeud | null {
    let gauche = facteur();
    if (!gauche) return null;
    for (;;) {
      passerEspaces();
      const op = s[i];
      if (op !== '*' && op !== '/') return gauche;
      // ⚠️ `**` (rencontré dans le corpus) n'est PAS l'exponentiation ici :
      // on refuse plutôt que de deviner. Le second `*` ne peut pas démarrer
      // un facteur valide, donc `facteur()` renverra `null` — mais le dire
      // explicitement évite d'en dépendre par accident.
      if (s[i + 1] === '*' || s[i + 1] === '/') return null;
      i++;
      const droite = facteur();
      if (!droite) return null;
      gauche = { type: 'binaire', op, gauche, droite };
    }
  }

  function expr(): Noeud | null {
    let gauche = terme();
    if (!gauche) return null;
    for (;;) {
      passerEspaces();
      const op = s[i];
      if (op !== '+' && op !== '-') return gauche;
      i++;
      const droite = terme();
      if (!droite) return null;
      gauche = { type: 'binaire', op, gauche, droite };
    }
  }

  const noeud = expr();
  if (!noeud) return null;
  passerEspaces();
  // Reste du texte non consommé → formule hors grammaire, on refuse.
  if (i !== s.length) return null;
  return { noeud, variables: SUPPORTED_VARIABLES.filter((v) => variables.has(v)) };
}

function evaluer(n: Noeud, valeurs: Record<DamageVariable, number>): number {
  if (n.type === 'nombre') return n.valeur;
  if (n.type === 'variable') return valeurs[n.nom];
  const g = evaluer(n.gauche, valeurs);
  const d = evaluer(n.droite, valeurs);
  if (n.op === '+') return g + d;
  if (n.op === '-') return g - d;
  if (n.op === '*') return g * d;
  // Division : le corpus n'a que des diviseurs constants (`/30`), jamais 0.
  return d === 0 ? 0 : g / d;
}

// ── Profil de dégâts d'un sort ───────────────────────────────────────────

export interface SkillDamageProfile {
  // ⚠️ `com2usId` du SORT (`Competence.com2usId`), pas du monstre — c'est lui
  // qui est stocké dans le réglage et dans la recette exportée : l'index dans
  // la liste changerait si les données SWARFARM étaient régénérées.
  skillCom2usId: number;
  slot: number;
  nom: string;
  icone: string | null;
  formule: string;
  // Nombre de coups RETENU pour le calcul — le minimum de `hitsRange` s'il
  // est présent (jamais une surestimation par défaut), sinon `Competence.coups`.
  hits: number;
  // Présent = ce sort/passif inflige un nombre de coups qui VARIE en jeu
  // (« 2 à 3 fois », voir `COUPS_VARIABLES_CONNUS`) — l'écran propose alors un
  // champ pour choisir la valeur réellement utilisée dans le calcul
  // (`DamageSetup.coupsPersonnalises`, voir `resolvedHits`).
  hitsRange?: { min: number; max: number };
  aoe: boolean;
  ignoreDef: boolean;
  // Ce sort pose LUI-MÊME une réduction de Défense sur la cible (effet
  // `Decrease DEF`) — déduit des données, jamais saisi. Ne change RIEN aux
  // dégâts du sort lui-même (la réduction atterrit après son propre coup),
  // mais décide de l'affichage du réglage `defBreakParLeSort`, qui lui
  // change les passifs déclenchés APRÈS (voir `PassifOffensifCategorie`,
  // variante `defBreak`).
  appliqueDefBreak: boolean;
  // Dégâts FIXES (marqueur `(Fixed)` de SWARFARM) : ne peuvent pas être
  // critiques et ne passent PAS par le facteur de défense (voir
  // spec/mecaniques.md, terme « Additionnel »).
  fixed: boolean;
  // Ignore une FRACTION de la DEF adverse, proportionnelle à l'écart de VIT
  // avec elle — distinct d'`ignoreDef` (tout ou rien). `ecartMax` = l'écart
  // de VIT (points) au-delà duquel l'ignore atteint 100 % ; 0 % si la cible
  // est aussi rapide ou plus. Curé à la main (`IGNORE_DEF_SELON_VIT_CONNUS`),
  // même discipline que les autres tables de ce fichier — confirmé par
  // l'utilisateur sur Rigna (126 points, donnée communautaire SWGT).
  ignoreDefSelonVit?: { ecartMax: number };
  // Somme des « Damage +X% » des améliorations de compétence, en points de
  // pourcentage — la compétence est supposée MAXÉE, comme partout ailleurs
  // dans l'app (voir `paliersRechargement`, même parti pris).
  skillupDamagePct: number;
  // +`pct` % de dégâts par effet présent sur la CIBLE au moment de
  // l'attaque — Julie (« Thousand Shots »)/Melissa (« Massacre Dance »).
  // `source` distingue CE QUI compte : `'buffs'` (Julie/Covenant — le texte
  // ne parle que d'effets bénéfiques), `'buffsEtDebuffs'` (Melissa/Brandia —
  // « beneficial AND/OR harmful », un SEUL compte combiné), `'debuffs'`
  // (aucun sort ACTIF connu à ce jour, mais le modificateur MONSTRE-WIDE
  // équivalent — Backup Code, voir plus bas — en a besoin ; généralisation
  // ajoutée pour ce cas, `inclutDebuffs: boolean` d'origine ne pouvait pas
  // exprimer « débuffs SEULS »). Curé
  // (`BONUS_PAR_EFFET_CIBLE_CONNUS`) : le TEXTE dit « per beneficial/harmful
  // effect », jamais un chiffre déductible d'ailleurs, et l'app ne simule
  // aucun effet réel sur l'adversaire — `DamageSetup.effetsCibleCount` porte
  // le compte saisi par l'utilisateur, même famille que
  // `coupsPersonnalises`/`stackPersonnalise` (0 par défaut, jamais deviné).
  bonusParEffetCible?: { pct: number; source: 'buffs' | 'debuffs' | 'buffsEtDebuffs' };
  // Bonus à bouton comme `BONUS_DEGATS_CONDITIONNEL_CONNUS`, mais restreint
  // à CE SORT plutôt qu'au TOTAL — Emergency Drive (Cynthia/Arcane Weapon) :
  // « deal 50% increased damage » UNIQUEMENT « While in the mechanical frame
  // state », un état qui force l'usage de [Rending Claw] (le sort qui porte
  // ce champ) — appliquer le bonus au TOTAL quel que soit le sort choisi
  // aurait été faux dès qu'un autre sort est sélectionné. Stockage : même
  // Record que `passifsOffensifs` (clé = `skillCom2usId` DE CE SORT, pas
  // d'un passif à part).
  //
  // ⚠️ Blessing of Curse (par effet sur SOI), Backup Code (par effet sur la
  // cible, débuffs seuls) et les quatre autres candidats initialement prévus
  // ici (Spear of Tenacity, Martial Arts Specialist, Sickle Blade/Sand
  // Blade, Calculated Sacrifice) ont TOUS `passif: true` avec `formule: ""`
  // dans les données réelles — CE fichier ne construit un `SkillDamageProfile`
  // QUE pour un sort actif à formule (`skillDamageProfile` retourne `null`
  // dès `c.passif`, voir plus bas) : une entrée keyée sur leur nom ici
  // n'aurait jamais été lue. Déplacés en modificateurs MONSTRE-WIDE (comme
  // `BONUS_DEGATS_CONDITIONNEL_CONNUS`/`BONUS_DEGATS_SELON_VIT_CONNUS`),
  // détectés par un scan des PASSIFS et appliqués via le paramètre
  // `monsterWide` de `computeSkillDamageDetail`/`computeTotalDamage` — voir
  // plus bas dans ce fichier.
  bonusConditionnelPropre?: { pct: number; condition: string };
  // Ajoute `coeffParPoint × {variable} × compteur` au MULTIPLICATEUR déjà
  // évalué de la formule — Crawler/Frankenstein (« Rage Charge (Passive) »
  // sur « Hammer Punch » S1) : « Your damage is increased according to the
  // number of attacks you have received. » Curé (`BONUS_COEFFICIENT_PAR_
  // COMPTEUR_CONNUS`), pas un pourcentage MULTIPLICATIF comme
  // `bonusParEffetCible` : le texte du jeu confirmé donne un terme ADDITIF
  // à la formule elle-même (`2,04×DEF` devient `2,04×DEF + N×0,20×DEF`),
  // jamais une réécriture de `formule` (interdit, voir plus haut) —
  // recalculé à partir de la même variable déjà évaluée dans `valeurs`.
  // `DamageSetup.compteurPersonnalise` porte le compte SAISI (0 par
  // défaut, aucun état de combat simulé).
  bonusCoefficientParCompteur?: { coeffParPoint: number; variable: DamageVariable; label: string };
  variables: DamageVariable[];
  noeud: Noeud;
}

// « Deals increased damage per positive effect on target monster »/
// « per debuff on the target » — un pourcentage de dégâts par effet PRÉSENT
// sur la cible (pas un état simulé, saisi par l'utilisateur). Les chiffres
// Julie/Melissa sont directement dans les données SWARFARM (`quantite` des
// effets `Buff Bonus Damage`/`Debuff Bonus Damage`), pas seulement dans la
// prose libre — vérifiés avant d'être curés ici.
const BONUS_PAR_EFFET_CIBLE_CONNUS: Record<string, { pct: number; source: 'buffs' | 'debuffs' | 'buffsEtDebuffs' }> = {
  'Thousand Shots': { pct: 50, source: 'buffs' }, // Julie, Pierrette — « for each beneficial effect »
  'Massacre Dance': { pct: 10, source: 'buffsEtDebuffs' }, // Melissa, Chakram Dancer — « beneficial AND harmful »
  // « Removes all beneficial effects granted on the enemy target with a
  // 70% chance, and deals damage that increases according [to] the number
  // of beneficial effects removed. » `quantite: 0` dans les données
  // SWARFARM (contrairement à Julie/Melissa) — d'abord laissé de côté pour
  // cette raison. Confirmé ensuite par l'utilisateur : « chaque buff sur
  // l'ennemi rajoute 100% au ratio du sort » — comme Julie, BUFFS
  // uniquement (le texte du jeu ne parle que de « beneficial effects »).
  // ⚠️ Le compteur saisi représente les effets RETIRÉS (70 % de chance
  // chacun), pas nécessairement tous ceux présents — à l'utilisateur de
  // renseigner le nombre RÉELLEMENT retiré, l'app ne simule pas ce tirage.
  'Suppressive Fire': { pct: 100, source: 'buffs' }, // Covenant, Sniper Mk.I
  // Trouvé en cherchant la raison pour laquelle Brandia (signalée par
  // l'utilisateur, « augmente ses dégâts selon le nombre d'effets néfastes
  // sur l'ennemi ») n'apparaissait dans AUCUNE des tables existantes : le
  // catalogue original (65 entrées) ne cherchait QUE les flags « Increase
  // Damage »/« Increase Critical Damage »/« Buff Bonus Damage » — Brandia
  // porte le flag « Debuff Bonus Damage », jamais cherché. « The inflicted
  // damage is increased by 40% for each harmful effect OR beneficial effect
  // of the enemy. » `quantite: 40` confirmé en données — BUFFS ET DEBUFFS
  // comptés ensemble comme Melissa, PAS « débuffs seuls » malgré la
  // description du signalement (le texte réel du jeu compte les deux).
  // ⚠️ Cette découverte révèle ~24 AUTRES sorts/passifs portant ce même
  // flag « Debuff Bonus Damage », jamais examinés — catalogue séparé
  // préparé pour l'utilisateur, PAS implémentés à l'aveugle ici.
  'Touch of Mercy': { pct: 40, source: 'buffsEtDebuffs' }, // Brandia
};

// Formule exacte confirmée par l'utilisateur, avec démonstration algébrique :
// « Si Crawler subit N attaques avant de lancer son S1 (qui frappe
// normalement 2 fois à 2,04×Défense par coup), les dégâts par coup
// s'expriment ainsi : (2,04×Défense) + (N×0,20×Défense). Compteur
// configurable de 0 à 9999. » Vérifié : « Hammer Punch » (S1 de
// Frankenstein/Crawler, EXCLUSIF à cette famille dans tout le corpus,
// 20 fiches) porte `2.04*{DEF}` sur les formes Crawler (`20831-20835`,
// `48201-48205`) et `1.8*{DEF}` sur les formes Frankenstein classiques
// (`20801-20815`) — les DEUX portent « Rage Charge (Passive) » avec le
// MÊME texte, donc le MÊME terme additif `+0,20×DEF` par attaque reçue,
// appliqué aux deux (l'utilisateur n'a chiffré que le cas Crawler, mais le
// mécanisme — comme sa description — est partagé).
const BONUS_COEFFICIENT_PAR_COMPTEUR_CONNUS: Record<
  string,
  { coeffParPoint: number; variable: DamageVariable; label: string }
> = {
  'Hammer Punch': { coeffParPoint: 0.2, variable: 'DEF', label: 'Attaques reçues avant ce sort' }, // Frankenstein, Crawler
};

// Sorts où le pourcentage de DEF ignorée dépend de l'écart de VIT avec la
// cible — jamais déduit du texte libre (« up to 100% according to the
// difference… » ne dit pas le seuil), curé depuis une donnée communautaire
// confirmée par l'utilisateur.
const IGNORE_DEF_SELON_VIT_CONNUS: Record<string, { ecartMax: number }> = {
  'Concentrated Stab': { ecartMax: 126 }, // Rigna, Birgitta, Magic Order Swordsinger
  'Charge Attack': { ecartMax: 126 }, // Ciri
};

// Un sort qu'on sait afficher mais pas calculer — l'écran le montre grisé
// avec sa raison, plutôt que de le faire disparaître sans explication.
export interface SkillDamageUnsupported {
  skillCom2usId: number;
  slot: number;
  nom: string;
  raison: string;
}

const RE_DAMAGE_UP = /^Damage \+(\d+)%$/i;
// ⚠️ `(Fixed)` colle au dernier terme (`1500(Fixed)`, `0.3*{MAX HP}(Fixed)`).
const RE_FIXED = /\(Fixed\)\s*$/i;

// Nom de l'effet com2us qui marque une BOMBE.
//
// ⚠️ Une bombe **ne peut pas être critique** et **ignore la défense adverse**
// — c'est-à-dire exactement `fixed`. Mais les DEUX détections habituelles
// passent à côté : la formule ne porte aucun marqueur `(Fixed)`
// (`"5.0*{ATK}"` pour Seara), et l'ignore-défense n'est écrit que dans la
// PROSE de l'effet (« the bomb explodes to deal damage that ignores
// Defense »), jamais dans son NOM — que `ignoreDef` compare pourtant à
// `'Ignore DEF'`. D'où cette troisième porte.
const EFFET_BOMBE = 'Bomb';

// Ce sort EST la bombe (il la pose sans frapper), plutôt que de frapper ET
// d'en poser une ? Dans ce cas seulement sa formule décrit l'explosion, donc
// des dégâts fixes.
//
// ⚠️ Discriminant `coups === 0`, **vérifié sur le corpus complet** (8 434
// compétences, 48 portant l'effet) et pas sur le seul cas Seara — les deux
// familles s'y séparent nettement :
//   - **pose seule** (`coups: 0`) : `Fate of Destruction` (Seara, Oracle,
//     Giana), `Surprise Bomb` (Joker, Sian, Jojo, Liebli), `Time Bomb`
//     (Kobold Bomber, Malaka, Taurus, Dover) ;
//   - **frappe ET pose** (`coups > 0`) : `Firecracker` (Kobold Bomber…),
//     `Bombardment` (Frigate, Pirate Captain, Carrack), `Cursed Apple`
//     (Puppeteer, Zima, Smicer, Zenisek), `Dancing Star` (Geralt),
//     `Star of Explosion` (Valdemar, Henrik, Magic Order Guardian).
//
// ⚠️ Les marquer TOUS fixes aurait faussé ces cinq familles-là : leur formule
// décrit le COUP DIRECT, qui crite et se fait mitiger normalement. Les dégâts
// de leur explosion différée, eux, ne sont **nulle part dans les données** —
// hors modèle, comme le reste de ce qui ne se calcule pas.
//
// ⚠️ `skillupDamagePct` continue de s'appliquer, et c'est vérifié : c'est ce
// qui fait tomber le relevé Seara sur ~27 000 (`5,0 × 4 150 × 1,30`).
function estBombeSansCoupDirect(c: Competence): boolean {
  return c.effets.some((e) => e.nom === EFFET_BOMBE) && !(c.coups && c.coups > 0);
}

// Sorts/passifs dont le nombre de coups VARIE en jeu (« 2 à 3 fois », « 3 à
// 5 fois »…) — `Competence.coups` ne porte qu'UN SEUL nombre, pas toujours
// cohérent avec le texte (ex. Rain of Fire : `coups=6` en donnée, « 3 à 5
// fois » dans le texte — ni l'un ni l'autre). Curation à la main, exactement
// comme `PASSIFS_OFFENSIFS_CONNUS` : jamais une extraction automatique du
// texte anglais libre. Sert AUSSI bien un sort actif (`skillDamageProfile`)
// qu'un passif (`monsterOffensivePassives`), même table, même clé
// (`Competence.nom` exact).
// ⚠️ `defaut` : la valeur RETENUE par défaut avant tout choix de
// l'utilisateur — `min` si absent (discipline générale, « jamais une
// surestimation »). Julie fait exception sur demande EXPLICITE de
// l'utilisateur : le cas pleine vie (6, le maximum de sa plage) est le
// défaut le plus représentatif d'un début de combat, pas le minimum.
const COUPS_VARIABLES_CONNUS: Record<string, { min: number; max: number; defaut?: number }> = {
  'Great Friends (Passive)': { min: 2, max: 3 }, // Sia — confirmé par l'utilisateur
  'Rain of Stones': { min: 3, max: 5 }, // Okeanos S3
  // Confirmé partagé par l'utilisateur — vérifié sur les données : « Ray
  // Spears » (S2) est EXACTEMENT le même sort sur les quatre fiches
  // com2usId 26101/26104 (Battle Angel) et 26111/26114 (Amber/Veronica),
  // même formule (`1.68*{ATK}`) partout. La curation par NOM couvre déjà
  // les quatre sans code supplémentaire.
  'Ray Spears': { min: 2, max: 3 }, // Amber, Veronica, Battle Angel (S2)
  // « Attacks 6 times when this attack is used with full HP » — confirmé
  // par l'utilisateur : 4 à 6 coups si Julie N'EST PAS à pleine vie, 6
  // pile sinon. `Competence.coups` (6) ne porte QUE le cas pleine vie,
  // exactement le piège que cette table existe pour corriger. `defaut: 6`
  // (le MAXIMUM, pas le minimum) : demande explicite de l'utilisateur.
  'Thousand Shots': { min: 4, max: 6, defaut: 6 }, // Julie, Pierrette
};

/**
 * Profil de dégâts d'une compétence, ou `null` si elle n'inflige pas de
 * dégâts calculables. Ne lève jamais.
 */
export function skillDamageProfile(c: Competence): SkillDamageProfile | SkillDamageUnsupported | null {
  if (c.passif || !c.formule || c.com2usId == null) return null;
  const brut = c.formule.trim();
  const fixed = RE_FIXED.test(brut) || estBombeSansCoupDirect(c);
  const analyse = analyser(brut.replace(RE_FIXED, '').trim());
  const entete = { skillCom2usId: c.com2usId, slot: c.slot ?? 0, nom: c.nom };
  if (!analyse) {
    return { ...entete, raison: 'Formule non prise en charge par le calcul de dégâts.' };
  }
  // Une formule qui ne dépend d'AUCUNE stat de l'attaquant (dégâts purement
  // fixes, ou fonction de la seule cible) reste calculable, mais optimiser
  // les runes dessus n'a aucun sens : toutes les combinaisons donneraient le
  // même nombre. On le dit plutôt que de laisser chercher pour rien.
  if (!analyse.variables.some((v) => VARIABLE_STAT[v])) {
    return { ...entete, raison: 'Ces dégâts ne dépendent d’aucune statistique du monstre.' };
  }

  let skillupDamagePct = 0;
  for (const a of c.ameliorations) {
    // ⚠️ `trim()` : des lignes du corpus traînent un `\r` (même piège que
    // `paliersRechargement`), sans quoi la reconnaissance échoue en silence.
    const m = RE_DAMAGE_UP.exec(a.trim());
    if (m) skillupDamagePct += Number(m[1]);
  }

  const coupsVariables = COUPS_VARIABLES_CONNUS[c.nom];
  const ignoreDefSelonVit = IGNORE_DEF_SELON_VIT_CONNUS[c.nom];
  // La VIT du monstre optimisé pèse sur ce sort MÊME si sa formule ne lit
  // aucune variable de VIT (`4.7*{ATK}` seul) — l'ignore-DEF, lui, en
  // dépend. `Relative SPD` ajoutée à `variables` fait suivre ça partout
  // (champ « VIT adversaire » à l'écran, `damageRelevantStats`) sans
  // dupliquer la logique.
  const variables = ignoreDefSelonVit
    ? Array.from(new Set([...analyse.variables, 'Relative SPD' as const]))
    : analyse.variables;
  return {
    ...entete,
    icone: c.icone,
    formule: brut,
    // `coups` vaut `null` sur quelques fiches : un sort qui inflige des
    // dégâts en frappe au moins une fois. Un sort à coups VARIABLES connu
    // retombe sur son minimum — jamais une surestimation par défaut, comme
    // partout ailleurs dans ce module — SAUF `defaut` explicitement curé
    // (Julie : voir `COUPS_VARIABLES_CONNUS`).
    hits: coupsVariables ? coupsVariables.defaut ?? coupsVariables.min : c.coups && c.coups > 0 ? c.coups : 1,
    hitsRange: coupsVariables,
    aoe: c.aoe,
    // ⚠️ `ignoreDefSelonVit` prévaut : SWARFARM tague Concentrated Stab d'un
    // effet « Ignore DEF » PLEIN (`quantite: 100`), la nuance « selon l'écart
    // de VIT » vivant uniquement dans son champ `note` en texte libre, jamais
    // lu ailleurs. Sans ce garde-fou, ce booléen aurait fait ignorer 100 % de
    // la DEF EN PERMANENCE, y compris face à une cible plus rapide.
    ignoreDef: !ignoreDefSelonVit && c.effets.some((e) => e.nom === 'Ignore DEF'),
    ignoreDefSelonVit,
    appliqueDefBreak: c.effets.some((e) => e.nom === 'Decrease DEF' && !e.surSoi),
    fixed,
    skillupDamagePct,
    bonusParEffetCible: BONUS_PAR_EFFET_CIBLE_CONNUS[c.nom],
    bonusConditionnelPropre: BONUS_CONDITIONNEL_PROPRE_CONNUS[c.nom],
    bonusCoefficientParCompteur: BONUS_COEFFICIENT_PAR_COMPTEUR_CONNUS[c.nom],
    variables,
    noeud: analyse.noeud,
  };
}

export function estPrisEnCharge(p: SkillDamageProfile | SkillDamageUnsupported): p is SkillDamageProfile {
  return 'noeud' in p;
}

// ── Passifs offensifs (dégâts supplémentaires hors des 3 sorts actifs) ───
// ⚠️ **Beaucoup de monstres infligent des dégâts par un PASSIF** (Feng Yan,
// Sia, Roid…), jamais comptés jusqu'ici : `skillDamageProfile` exclut
// explicitement `c.passif`. Le champ `formule` de SWARFARM porte bien le
// coefficient de certains d'entre eux (`analyser` sait les lire, exactement
// comme un sort actif) — ce qu'il NE PORTE JAMAIS, c'est la CONDITION de
// déclenchement, toujours en prose libre dans `description`
// (« whenever you attack », « if the enemy is under Defense reduction… »).
// Cette section CURE donc, à la main, PAR NOM DE SORT (jamais par monstre —
// plusieurs monstres partagent le même passif), quels passifs à formule ont
// été vérifiés utilisables et COMMENT — voir spec/outils/degats-reels.md
// pour la liste complète, la méthode (script jetable rejouant `analyser`
// sur les ~2984 fiches du corpus) et le répertoire des sorts écartés.
//
// ⚠️ **La formule elle-même n'est JAMAIS recopiée ici** : elle continue de
// venir de `Competence.formule`, relue et validée par le même `analyser`
// que les sorts actifs à chaque appel de `monsterOffensivePassives` — si
// SWARFARM corrige un coefficient demain, la valeur suit sans toucher cette
// liste. Seule la CATÉGORISATION (qui ne peut PAS être déduite du champ
// `formule`) est curée.
//
// ⚠️ **Trois catégories, jamais une case « actif » à deviner** :
// - `toujours` : le texte ne pose AUCUNE condition de combat (« whenever you
//   attack », « when using a skill on your turn ») — compté d'office, pas de
//   bouton, comme le sort actif choisi lui-même.
// - `bonus` : la formule de base est TOUJOURS acquise, mais le texte ajoute
//   un pourcentage de dégâts FIXE sous condition (« +100% si cible
//   Lumière ») — un bouton bascule CE bonus précis, désactivé par défaut.
//   ⚠️ **`dejaInclus`** : sur certains passifs, `Competence.formule` porte
//   directement le cas MAJORÉ (le bonus déjà appliqué), pas le cas de base —
//   Dominic/Weapon Master (« Improvisation ») : `2.0*{ATK} (Fixed)` = 100 %
//   de base × (1 + 100 % si PV > 50 %), aucune formule séparée pour le cas de
//   base. Décoché par défaut (même discipline pessimiste que les autres
//   `bonus`), la contribution est alors DIVISÉE par `1 + pct/100` plutôt que
//   MULTIPLIÉE — l'inverse de l'opération habituelle, jamais une réécriture
//   de `formule` (qui reste, comme toujours, EXACTEMENT ce que SWARFARM
//   donne — voir plus haut).
// - `conditionnel` : le texte pose une condition sur le DÉCLENCHEMENT
//   lui-même, pas seulement sa magnitude — un bouton pour le passif entier,
//   désactivé par défaut, quand la condition ne se modélise PAS (attribut de
//   la cible, PV de l'attaquant…).
// - `defBreak` : cas particulier ENTIÈREMENT modélisable de `conditionnel`.
//   La condition porte sur la présence d'une réduction de Défense, et la
//   difficulté signalée à l'origine (le sort du monstre pose LUI-MÊME cette
//   réduction, donc « avant » ≠ « après » dans le même tour) se résout avec
//   UN seul réglage supplémentaire (`defBreakParLeSort`) plutôt qu'un bouton
//   par passif : `moment` dit à quel instant le texte du jeu évalue la
//   condition, `exige` dit dans quel sens.
//     - Roid / Slash Waves — « if you attack the enemy WITH decreased
//       Defense » → `moment: 'avant'`, `exige: true`.
//     - Roid / Slash Wind — « with NO decreased Defense » → `'avant'`, `false`.
//     - Silver / Ruins — « if the enemy is under Defense reduction effects
//       AFTER you attack » → `moment: 'apres'`, `exige: true`.
//   ⚠️ Les DÉGÂTS du passif, eux, utilisent TOUJOURS l'état « après » : un
//   passif se déclenche après le sort, donc il bénéficie d'une réduction que
//   ce sort vient de poser — c'est exactement le cas « S1 sans réduction puis
//   passif AVEC réduction » décrit par l'utilisateur.
export type PassifOffensifCategorie =
  | { type: 'toujours' }
  | { type: 'bonus'; pct: number; condition: string; dejaInclus?: boolean }
  | { type: 'conditionnel'; condition: string }
  | { type: 'defBreak'; moment: 'avant' | 'apres'; exige: boolean; condition: string };

// Comment CE composant traite le coup critique — ni SWARFARM ni la formule
// ne portent l'information, aucun marqueur automatique possible : confirmé
// au cas par cas par l'utilisateur (joueur), jamais déduit d'un texte.
//  - `'suit'`     : comme un sort normal, suit `DamageSetup.critMode` (défaut).
//  - `'jamais'`   : ne critique JAMAIS (Winds and Clouds, Jet Engine).
//  - `'toujours'` : critique TOUJOURS, même si l'écran est en « Non critique »
//                   (Hidden Gun / Meticulous Attack — « always lands as a
//                   Critical Hit » dans le texte du jeu).
export type PassifCritique = 'suit' | 'jamais' | 'toujours';

interface PassifOffensifConnu {
  // `Competence.nom` EXACT (SWARFARM) — la seule clé fiable : le
  // `com2usId` d'un passif change d'un monstre à l'autre même pour un sort
  // identique (chaque fiche a ses propres identifiants de compétence).
  nom: string;
  // Le texte dit explicitement « ignore la Défense »/« ignores Defense »
  // SANS porter le marqueur `(Fixed)` que `skillDamageProfile` sait détecter
  // seul dans `formule` — à préciser à la main pour ces deux-là.
  ignoreDef?: boolean;
  critique?: PassifCritique; // défaut `'suit'`
  // Nombre d'instances de dégâts, quand le TEXTE l'annonce en prose (« attacks
  // 2 more times ») — défaut 1. ⚠️ Jamais `Competence.coups`, pas fiable pour
  // un passif : Turning Slash porte `coups=1` en donnée pour un texte qui dit
  // « 2 more times », Slash Waves porte `2` sur une fiche et `1` sur l'autre
  // pour le MÊME passif. Exclusif de `COUPS_VARIABLES_CONNUS` (une plage
  // ANNONCÉE comme variable en jeu, qui donne un champ de réglage).
  coups?: number;
  // Le nombre d'instances suit-il les COUPS DU SORT ACTIF (`true`), ou
  // reste-t-il fixe quel que soit le sort choisi (`false`/absent) ? Confirmé
  // au cas par cas — ne PAS généraliser, voir Winds and Clouds.
  coupsDuSortActif?: boolean;
  // Majoration acquise quand les PV de la cible sont TOMBÉS à `seuilPct` % ou
  // moins AU MOMENT où le passif frappe — c'est-à-dire APRÈS le sort actif,
  // dont les coups viennent de creuser la cible (voir
  // `computeSkillDamageDetail`, simulation coup par coup). Entièrement
  // déduite, aucun bouton : contrairement à un attribut de cible, l'app
  // connaît exactement les PV restants qu'elle vient de calculer.
  bonusPvCible?: { seuilPct: number; pct: number };
  categorie: PassifOffensifCategorie;
}

const PASSIFS_OFFENSIFS_CONNUS: PassifOffensifConnu[] = [
  // — Toujours actifs —
  // ⚠️ Confirmé par l'utilisateur (joueur, pas une déduction de texte) : le
  // bonus proportionnel à la DEF s'ajoute à CHAQUE hit du sort utilisé — pas
  // une seule fois par tour — et cette partie ne peut JAMAIS critiquer,
  // quel que soit le mode choisi.
  {
    nom: 'Winds and Clouds (Passive)',
    critique: 'jamais',
    coupsDuSortActif: true,
    categorie: { type: 'toujours' },
  }, // Feng Yan, Panda Warrior
  // Coups VARIABLES (2 à 3), voir `COUPS_VARIABLES_CONNUS` — critique
  // normalement (confirmé).
  { nom: 'Great Friends (Passive)', categorie: { type: 'toujours' } }, // Sia
  // ⚠️ Confirmé : l'attaque supplémentaire ignore la DEF **et** peut
  // critiquer normalement — les deux ne vont pas ensemble d'office.
  // « deals 20 % increased damage if [the enemy's HP] is 30 % or below » :
  // évalué sur les PV RESTANTS après le sort actif, que la simulation coup
  // par coup vient justement de calculer — rien à cocher.
  {
    nom: 'Final Strike (Passive)',
    ignoreDef: true,
    bonusPvCible: { seuilPct: 30, pct: 20 },
    categorie: { type: 'toujours' },
  }, // Weapon Master, Benedict
  { nom: 'Jet Engine (Passive)', ignoreDef: true, critique: 'jamais', categorie: { type: 'toujours' } }, // Sky Surfer, Miles
  // ⚠️ Le texte dit « a random enemy » : confirmé qu'on le compte sur la
  // SEULE cible configurée (l'écran n'a qu'un adversaire), pas une moyenne.
  // Confirmé sur Salah (Eye of the Desert) ET étendu à Bayek (Eagle
  // Deception) — même monstre, même passif : Bayek est la version
  // collaboration, Salah sa version SW native, « exactement la même
  // logique » (utilisateur).
  { nom: 'Eagle Deception (Passive)', categorie: { type: 'toujours' } }, // Bayek
  { nom: 'Eye of the Desert (Passive)', categorie: { type: 'toujours' } }, // Desert Warrior, Salah
  // ⚠️ Ces deux-là ont une magnitude qui CROÎT quand les PV de la cible
  // baissent, jamais chiffrée par SWARFARM (la formule `1.3*{ATK}` ne porte
  // AUCUNE variable de PV, contrairement à Weakness Shot) — la formule reste
  // donc un PLANCHER, jamais le vrai total. Les 2 coups, eux, sont confirmés
  // (annoncés en prose, `Competence.coups` vaut 1 à tort).
  { nom: 'Turning Slash (Passive)', coups: 2, categorie: { type: 'toujours' } }, // Magic Order Swordsinger, Birgitta
  { nom: 'Flash Step (Passive)', coups: 2, categorie: { type: 'toujours' } }, // Ciri (Lumière)
  // ⚠️ D'abord passé de `bonus` à `toujours` (condition de PV de l'attaquant
  // ignorée, comptée d'office) — la formule `2.0*{ATK} (Fixed)` correspond
  // au cas MAJORÉ (« 100 % de l'ATQ », « +100 % si tes PV dépassent 50 % »),
  // un bouton `bonus` naïf par-dessus aurait doublé une seconde fois. Repassé
  // en `bonus` avec `dejaInclus: true` (demande explicite de l'utilisateur :
  // « pouvoir activer ou non l'augmentation… comme le passif de Ezio ») —
  // voir `PassifOffensifCategorie` plus haut : la MÊME formule majorée reste
  // la SOURCE, mais décoché (par défaut, jamais deviné), la contribution est
  // DIVISÉE par 2 plutôt que multipliée, retrouvant le cas de base (100 %
  // de l'ATQ) sans jamais réécrire `formule`. `(Fixed)` : ni critique ni
  // facteur DEF.
  { nom: 'Improvisation (Passive)', categorie: { type: 'bonus', pct: 100, condition: 'tes PV dépassent 50 %', dejaInclus: true } }, // Weapon Master, Dominic
  // — Bonus conditionnel à pourcentage fixe —
  // ⚠️ `critique: 'toujours'` : « The additional attack ALWAYS LANDS AS A
  // CRITICAL HIT » — l'inverse de Winds and Clouds, et indépendant du mode
  // choisi à l'écran pour le sort actif.
  {
    nom: 'Hidden Gun (Passive)',
    critique: 'toujours',
    categorie: { type: 'bonus', pct: 100, condition: "la cible est de l'attribut Lumière" },
  }, // Ezio
  {
    nom: 'Meticulous Attack (Passive)',
    critique: 'toujours',
    categorie: { type: 'bonus', pct: 100, condition: "la cible est de l'attribut Lumière" },
  }, // Steel Commander, Evan
  // — Déclenchement entièrement conditionnel —
  // 3 coups annoncés en prose (`Competence.coups` vaut 3 ici, cohérent) ;
  // critique normalement (confirmé).
  {
    nom: 'Ruins (Passive)',
    coups: 3,
    categorie: {
      type: 'defBreak',
      moment: 'apres',
      exige: true,
      condition: 'la cible a une réduction de Défense APRÈS ce sort (déjà présente, ou posée par le sort lui-même)',
    },
  }, // Silver
  // ⚠️ Roid porte les DEUX — branches mutuellement exclusives d'un même
  // passif, dont EXACTEMENT UNE se déclenche toujours. Plus aucun bouton par
  // passif : le couple (« réduction de DEF » déjà active, « le sort en pose
  // une ») les départage entièrement, voir `passifActif`.
  {
    nom: 'Slash Waves (Passive)',
    coups: 2,
    categorie: {
      type: 'defBreak',
      moment: 'avant',
      exige: true,
      condition: 'la cible avait déjà une réduction de Défense AVANT ce sort',
    },
  }, // Roid
  {
    nom: 'Slash Wind (Passive)',
    categorie: {
      type: 'defBreak',
      moment: 'avant',
      exige: false,
      condition: "la cible N'AVAIT PAS de réduction de Défense avant ce sort",
    },
  }, // Roid
  // — Conditionnel, formule PROPRE (compte à 100 % activé, 0 % éteint) —
  // « Creates a Shield equal to your Defense for 2 turns when you are
  // attacked. Increases the damage dealt by 50% when you have a Shield. »
  // `formule: 2.0*{DEF}` EST le Bouclier lui-même — ce n'est PAS un bonus en
  // % du total (contrairement à ce que le catalogue laissait supposer),
  // c'est une SOURCE DE DÉGÂTS À PART ENTIÈRE (comme Winds and Clouds/Final
  // Strike), juste gatée par un bouton plutôt que « toujours ». Le +50 %
  // décrit dans le texte s'applique aux dégâts que le Bouclier absorbe (hors
  // modèle, défensif) — PAS un second multiplicateur à ajouter ici. Balance
  // ATQ/DEF au début du combat (« the value of the lower stat will equal
  // that of the higher ») laissée hors modèle (état de combat non simulé).
  { nom: 'Internal Force (Passive)', categorie: { type: 'conditionnel', condition: 'tu as un Bouclier actif' } }, // Paladin, Leona
  // « Deals additional damage that's proportional to the enemy's MAX HP...
  // when attacking the suppressed Monster. » `formule: 0.2*{Target MAX HP}`
  // confirmé (capture du panneau de compétence, bestiaire) — ne dépend QUE
  // de la cible, AUCUNE stat de l'attaquant. ⚠️ D'ABORD exclu à tort de
  // cette table par analogie avec `skillDamageProfile` (qui rejette un sort
  // ACTIF stat-indépendant, car inutile comme RÉFÉRENCE DE CLASSEMENT des
  // builds) — mais `monsterOffensivePassives` sert un rôle différent
  // (sommer une contribution RÉELLE au total affiché, pas classer des
  // builds) : le filtre correspondant y a été retiré (voir
  // `monsterOffensivePassives`, plus bas). Jamais critique, condition
  // "Suppressed" non précisée par le texte — bouton, comme demandé.
  { nom: 'Comeuppance (Passive)', critique: 'jamais', categorie: { type: 'conditionnel', condition: 'tu attaques la cible « Suppressed » (texte du jeu, condition non davantage précisée)' } }, // Onmyouji, Giou
];

// Profil de dégâts d'un passif offensif CONNU (voir la liste ci-dessus),
// prêt à passer par `computeSkillDamage` comme n'importe quel sort actif.
export interface PassifOffensifProfile {
  // `Competence.com2usId` du PASSIF (pas du sort actif choisi) — clé de
  // `DamageSetup.passifsOffensifs`, stable pour CE monstre.
  skillCom2usId: number;
  nom: string;
  // Texte SWARFARM brut du passif (`Competence.description`), affiché tel
  // quel à côté de la condition CURÉE ci-dessus — au joueur de confronter
  // les deux, jamais reformulé.
  description: string | null;
  // Voir `PassifOffensifConnu` — résolus depuis la liste curée, jamais
  // déduits de la formule.
  critique: PassifCritique;
  coupsDuSortActif: boolean;
  bonusPvCible?: { seuilPct: number; pct: number };
  categorie: PassifOffensifCategorie;
  profile: SkillDamageProfile;
}

/**
 * Les passifs offensifs de CE monstre reconnus dans `PASSIFS_OFFENSIFS_CONNUS`
 * et dont la formule, relue depuis sa propre fiche, reste analysable et
 * dépend d'une stat de l'attaquant — même double garde que
 * `skillDamageProfile` (une formule qui a changé de forme depuis la
 * catégorisation ci-dessus est silencieusement ignorée, jamais un plantage
 * ni un nombre inventé). Liste vide si la fiche est absente.
 */
export function monsterOffensivePassives(detail: DetailMonstre | null): PassifOffensifProfile[] {
  if (!detail) return [];
  const out: PassifOffensifProfile[] = [];
  for (const c of detail.competences) {
    if (!c.passif || !c.formule || c.com2usId == null) continue;
    const connu = PASSIFS_OFFENSIFS_CONNUS.find((p) => p.nom === c.nom);
    if (!connu) continue;
    const brut = c.formule.trim();
    const fixed = RE_FIXED.test(brut);
    const analyse = analyser(brut.replace(RE_FIXED, '').trim());
    // ⚠️ Contrairement à `skillDamageProfile` (le sort ACTIF choisi comme
    // référence de classement des builds), un passif dont la formule ne
    // dépend QUE de la cible (Comeuppance/Giou, `0.2*{Target MAX HP}`)
    // N'EST PAS exclu ici : il reste une contribution RÉELLE et calculable
    // au total affiché (juste invariable d'un build de runes à l'autre,
    // comme le confirme le bestiaire — signalé par l'utilisateur, capture
    // du panneau de compétence à l'appui). Seule une formule VRAIMENT
    // illisible (`!analyse`) est rejetée.
    if (!analyse) continue;
    // ⚠️ Un passif PEUT porter des améliorations « Damage +X% » — vu sur
    // Winds and Clouds (Feng Yan : 5+5+10+15 = 35 %, confirmé par
    // l'utilisateur), contrairement à une hypothèse antérieure fausse. Même
    // lecture que `skillDamageProfile` pour un sort actif, jamais une valeur
    // à part pour les passifs.
    let skillupDamagePct = 0;
    for (const a of c.ameliorations) {
      const m = RE_DAMAGE_UP.exec(a.trim());
      if (m) skillupDamagePct += Number(m[1]);
    }
    out.push({
      skillCom2usId: c.com2usId,
      nom: c.nom,
      description: c.description,
      critique: connu.critique ?? 'suit',
      coupsDuSortActif: connu.coupsDuSortActif ?? false,
      bonusPvCible: connu.bonusPvCible,
      categorie: connu.categorie,
      profile: {
        skillCom2usId: c.com2usId,
        slot: c.slot ?? 0,
        nom: c.nom,
        icone: c.icone,
        formule: brut,
        // ⚠️ **Jamais `c.coups`**, qui ne représente rien de fiable pour un
        // passif : Great Friends porte `0` ou `1` selon la fiche pour un texte
        // qui dit « 2 à 3 fois de plus », Turning Slash porte `1` pour un
        // texte qui dit « 2 more times », Slash Waves porte `2` sur une fiche
        // et `1` sur l'autre pour le MÊME passif. Trois sources, dans
        // l'ordre : plage VARIABLE connue (donne un champ de réglage), puis
        // nombre FIXE curé depuis la prose, puis 1 par défaut — jamais un
        // nombre deviné.
        hits: COUPS_VARIABLES_CONNUS[c.nom]?.defaut ?? COUPS_VARIABLES_CONNUS[c.nom]?.min ?? connu.coups ?? 1,
        hitsRange: COUPS_VARIABLES_CONNUS[c.nom],
        aoe: c.aoe,
        ignoreDef: connu.ignoreDef ?? c.effets.some((e) => e.nom === 'Ignore DEF'),
        // Un passif n'est jamais le « sort choisi » : ce drapeau ne sert qu'à
        // décider de l'affichage du réglage, qui porte sur le sort ACTIF.
        appliqueDefBreak: false,
        fixed,
        skillupDamagePct,
        variables: analyse.variables,
        noeud: analyse.noeud,
      },
    });
  }
  return out;
}

/**
 * Les sorts offensifs d'un monstre, dans l'ordre des slots — pris en charge
 * ou non. Liste vide si la fiche du monstre est absente (monstre perso,
 * données non générées) : l'objectif « Dégâts réels » est alors indisponible,
 * pas en erreur.
 */
export function monsterDamageSkills(detail: DetailMonstre | null): (SkillDamageProfile | SkillDamageUnsupported)[] {
  if (!detail) return [];
  const out: (SkillDamageProfile | SkillDamageUnsupported)[] = [];
  for (const c of detail.competences) {
    const p = skillDamageProfile(c);
    if (p) out.push(p);
  }
  return out.sort((a, b) => a.slot - b.slot);
}

/**
 * Le sort proposé par défaut : le dernier slot pris en charge (S3 avant S2
 * avant S1). C'est presque toujours le sort de dégâts principal, et c'est
 * celui pour lequel on optimise en pratique.
 */
export function defaultDamageSkill(skills: (SkillDamageProfile | SkillDamageUnsupported)[]): SkillDamageProfile | null {
  const ok = skills.filter(estPrisEnCharge);
  return ok.length > 0 ? ok[ok.length - 1] : null;
}

/**
 * Le sort effectivement retenu pour le calcul : celui demandé s'il existe et
 * qu'il est calculable, sinon le sort par défaut.
 *
 * ⚠️ **Source UNIQUE de cette résolution**, appelée par l'écran ET par la
 * relecture d'une recette en ligne de commande. Un sort introuvable (recette
 * reçue d'un autre joueur, donc écrite pour un autre monstre) retombe
 * silencieusement sur le défaut plutôt que d'échouer — même tolérance que le
 * `monsterCom2usId` d'une recette, qui se re-résout lui aussi contre la box
 * de qui l'importe.
 */
export function resolveDamageSkill(
  skills: (SkillDamageProfile | SkillDamageUnsupported)[],
  skillCom2usId: number | null
): SkillDamageProfile | null {
  if (skillCom2usId != null) {
    const voulu = skills.find((s) => s.skillCom2usId === skillCom2usId);
    if (voulu && estPrisEnCharge(voulu)) return voulu;
  }
  return defaultDamageSkill(skills);
}

// ── Réglage de combat (saisi par l'utilisateur) ──────────────────────────

// Comment traiter le coup critique dans le score.
//  - `'moyenne'` : espérance sur le taux de critique réellement atteint —
//    ce que le joueur observe sur beaucoup de coups, et le seul mode qui
//    fasse participer le Taux Crit au classement.
//  - `'crit'` / `'normal'` : le plafond haut / le plancher d'un coup unique.
export type CritMode = 'moyenne' | 'crit' | 'normal';

// ⚠️ Ordre d'AFFICHAGE (demande explicite) : Moyenne tout à droite — les deux
// bornes littérales (Critique/Non critique) d'abord, l'espérance théorique en
// dernier. N'affecte QUE `Segmented`, pas le type `CritMode` ni sa valeur par
// défaut (voir `DEFAULT_DAMAGE_SETUP.critMode`, ci-dessous : `'crit'`).
export const CRIT_MODE_LABELS: { key: CritMode; label: string }[] = [
  { key: 'crit', label: 'Critique' },
  { key: 'normal', label: 'Non critique' },
  { key: 'moyenne', label: 'Moyenne' },
];

// ⚠️ Sérialisable et STABLE : ce réglage part dans `OptimizerRecipe` (fichier
// partagé entre joueurs) et traverse le Web Worker. Aucune valeur dérivée
// d'un monstre chargé ici — seulement ce que l'utilisateur a saisi.
export interface DamageSetup {
  // `null` = « le sort par défaut » (voir `defaultDamageSkill`) : une recette
  // partagée reste valable même si son auteur et son lecteur n'optimisent pas
  // le même monstre.
  skillCom2usId: number | null;
  enemyDef: number;
  enemyHp: number;
  enemyHpPct: number;
  // VIT totale de l'adversaire (buffs compris) — saisie manuelle, comme
  // `enemyDef`. Ne sert QUE si le sort/passif lit `{Relative SPD}`. Optionnel
  // : une recette exportée avant ce champ n'en a aucun, `resolvedEnemySpd`
  // retombe alors sur `DEFAULT_DAMAGE_SETUP.enemySpd`.
  enemySpd?: number;
  // Leader skill d'ÉQUIPE (pas le sien, qui n'agit jamais sur lui-même) —
  // choisi dans « Effets actifs », voir `LeaderSkillStat`/
  // `LEADER_SKILL_PRESETS` plus haut. Absent = aucun. ⚠️ Généralise
  // l'ancien `leaderSpeedPct` (un pourcentage de VIT nu, sans type) — une
  // recette exportée avant cette généralisation n'a QUE ce champ legacy,
  // jamais `leaderSkill` ; `resolvedLeaderSkill` traduit explicitement
  // l'un vers l'autre (lead VIT), jamais un défaut générique qui perdrait
  // l'information déjà saisie.
  leaderSkill?: { stat: LeaderSkillStat; pct: number };
  /** @deprecated Remplacé par `leaderSkill` (lead VIT). Conservé UNIQUEMENT
   * pour la lecture d'une recette exportée avant la généralisation — voir
   * `resolvedLeaderSkill`. Ne jamais écrire ce champ depuis l'écran. */
  leaderSpeedPct?: number;
  atkBuff: boolean;
  defBuff: boolean;
  spdBuff: boolean;
  // ⚠️ Réduction de Défense **déjà active AVANT** le sort — c'est le sens
  // qu'a toujours eu ce réglage, rendu explicite depuis l'ajout de
  // `defBreakParLeSort`.
  defBreak: boolean;
  // Le sort choisi pose LUI-MÊME une réduction de Défense (Roid S1, Silver
  // S2…). Sans effet sur les dégâts du sort lui-même — la réduction atterrit
  // après son propre coup — mais décide du passif déclenché et de la
  // mitigation appliquée à CE passif (voir `PassifOffensifCategorie`,
  // variante `defBreak`). N'a de sens que si `profile.appliqueDefBreak` :
  // l'écran ne l'affiche que dans ce cas. Optionnel (compatibilité arrière).
  defBreakParLeSort?: boolean;
  brand: boolean;
  // Effets d'ÉQUIPE (un autre monstre que celui optimisé) — voir les
  // constantes `EULDONG_CD_POINTS`/`MIRINAE_BONUS_PCT`/`DEBORAH_AMPLIFY`/
  // `MIRIAM_AMPLIFY_PCT`/`TRANSMISSION_BONUS_PCT`/`VELASKA_PCT_PAR_PV_PERDU`
  // plus haut. Optionnels : absents/`false` sur une recette exportée avant
  // ces champs, comportement strictement inchangé.
  euldongActif?: boolean;
  mirinaeActif?: boolean;
  deborahActif?: boolean;
  miriamActif?: boolean;
  transmissionActif?: boolean;
  velaskaActif?: boolean;
  // % de PV PERDUS du monstre optimisé, saisi par l'utilisateur — l'app ne
  // simule pas les PV du monstre en combat (voir `bonusDegatsConditionnel`,
  // même limite pour Indomitable Will/Self Repair). Sans effet si
  // `velaskaActif` est faux. 0 par défaut = aucun bonus, jamais deviné.
  velaskaPvPerduPct?: number;
  critMode: CritMode;
  // Compétences d'invocateur prises en compte (ex-totems/drapeaux) — voir
  // `SummonerSkills`. ⚠️ Ne porte QUE le choix : l'élément du monstre, dont
  // dépend la compétence « Puis. d'att. de <élément> », se redéduit du monstre
  // optimisé chez qui relit la recette, jamais stocké ici.
  summonerSkills: SummonerSkills;
  // Passifs offensifs « bonus »/« conditionnel » activés par l'utilisateur —
  // voir `PassifOffensifCategorie`. Clé = `Competence.com2usId` DU PASSIF
  // (pas du sort actif choisi), valeur = la condition est remplie. Absent de
  // la map = désactivé, le comportement par défaut (jamais un bonus deviné
  // actif). Ne porte QUE les passifs « bonus »/« conditionnel » : un passif
  // `toujours` n'a pas de bouton, il n'y figure jamais.
  // Optionnel : une recette exportée AVANT ce champ a un `damageSetup`
  // complet par ailleurs mais sans cette clé — jamais supposé présent en
  // lecture (`?.`), voir `passifActif`.
  passifsOffensifs?: Record<number, boolean>;
  // Nombre de coups choisi par l'utilisateur pour un sort/passif à coups
  // VARIABLES (`SkillDamageProfile.hitsRange`) — clé = `skillCom2usId` DU
  // SORT/PASSIF concerné (sort actif ou passif, même espace de clés que
  // `passifsOffensifs`). Absent = repli sur `hitsRange.min`, voir
  // `resolvedHits`. Sans effet sur un sort dont `hitsRange` est absent.
  coupsPersonnalises?: Record<number, number>;
  // Pourcentage de stack CHOISI par l'utilisateur pour un passif à bonus
  // ACCUMULABLE en combat (Momo/Mage — « Secret Book »), clé =
  // `skillCom2usId` du passif, même espace de clés que `passifsOffensifs`.
  // Absent = 0 % (rien à supposer, comme partout ailleurs — voir
  // `resolvedStackPct`).
  stackPersonnalise?: Record<number, number>;
  // Nombre d'effets (bénéfiques, et néfastes selon le sort — voir
  // `BONUS_PAR_EFFET_CIBLE_CONNUS`) actuellement présents sur la CIBLE, clé
  // = `skillCom2usId` DU SORT concerné (même espace de clés que
  // `coupsPersonnalises`/`stackPersonnalise`). L'app ne simule aucun effet
  // réel sur l'adversaire (contrairement à ses PV) : absent = 0, jamais
  // deviné.
  effetsCibleCount?: Record<number, number>;
  // Compteur saisi par l'utilisateur pour un sort à `bonusCoefficientParCompteur`
  // (Crawler/Frankenstein — nombre d'attaques reçues avant de lancer ce
  // sort), clé = `skillCom2usId` DU SORT, même espace de clés que
  // `coupsPersonnalises`/`effetsCibleCount`. Aucun état de combat simulé :
  // absent = 0, jamais deviné.
  compteurPersonnalise?: Record<number, number>;
  // Nombre de débuffs actuellement présents sur SOI (Blessing of Curse —
  // `bonusParEffetPropre`), clé = `skillCom2usId` DU SORT, même espace de
  // clés que les autres compteurs. Absent = 0, jamais deviné.
  effetsPropresCount?: Record<number, number>;
  // PV ACTUELS (%) juste avant le déclenchement d'un sacrifice (Calculated
  // Sacrifice — `bonusSacrifice`), clé = `skillCom2usId` DU SORT. Absent =
  // 100 (premier tour) — voir `resolvedPvActuelsAvantSacrificePct`, SEUL
  // compteur de ce fichier dont le défaut n'est pas 0 (même exception que
  // `defaut: 6` de Julie, un point de départ représentatif).
  pvActuelsAvantSacrificePct?: Record<number, number>;
}

// Adversaire de référence : ni un boss ni une cible nue. 1000 DEF et 30 000
// PV correspondent à une cible d'arène/siège ordinaire — le point de
// comparaison le plus courant, et les mêmes ordres de grandeur que les
// outils de référence de la communauté.
export const DEFAULT_DAMAGE_SETUP: DamageSetup = {
  skillCom2usId: null,
  enemyDef: 1000,
  enemyHp: 30000,
  enemyHpPct: 100,
  // ⚠️ Contrairement à `enemyDef`/`enemyHp`, PAS recoupé avec un outil de
  // référence de la communauté — une VIT de base plate, à ajuster au cas par
  // cas (les 20 sorts qui en dépendent ciblent presque tous une AUTRE cible
  // que « arène/siège ordinaire »).
  enemySpd: 100,
  atkBuff: false,
  defBuff: false,
  spdBuff: false,
  defBreak: false,
  defBreakParLeSort: false,
  brand: false,
  euldongActif: false,
  mirinaeActif: false,
  deborahActif: false,
  miriamActif: false,
  transmissionActif: false,
  velaskaActif: false,
  // ⚠️ Demande explicite de l'utilisateur : « critique » comme valeur par
  // défaut — le plafond d'un coup isolé, pas l'espérance « Moyenne »
  // (repositionnée tout à droite dans `CRIT_MODE_LABELS`, jugée trop
  // théorique comme défaut — voir l'avertissement affiché sous ce mode
  // dans DamageSetupCard.tsx).
  critMode: 'crit',
  // ⚠️ « Combat » par défaut, pas « Aucune » : ces compétences sont
  // PERMANENTES en jeu dès qu'elles sont montées, et le sont chez à peu près
  // tout joueur qui utilise un optimiseur. Partir d'« Aucune » afficherait
  // des dégâts que personne n'observe réellement.
  summonerSkills: 'combat',
  passifsOffensifs: {},
  coupsPersonnalises: {},
};

// ── Le calcul ────────────────────────────────────────────────────────────

function total(stats: StatRow[], key: StatKey): number {
  return stats.find((s) => s.key === key)?.total ?? 0;
}

/**
 * Le leader skill RÉELLEMENT retenu — `setup.leaderSkill` si présent,
 * sinon traduit l'ancien `leaderSpeedPct` (nu, sans type) en lead VIT
 * plutôt qu'un défaut générique qui perdrait la valeur déjà saisie par
 * l'utilisateur avant la généralisation. `null` = aucun lead choisi.
 */
export function resolvedLeaderSkill(setup: DamageSetup): { stat: LeaderSkillStat; pct: number } | null {
  if (setup.leaderSkill) return setup.leaderSkill;
  const legacy = setup.leaderSpeedPct;
  return legacy ? { stat: 'Attack Speed', pct: legacy } : null;
}

/**
 * Le nombre de coups RÉELLEMENT retenu pour `profile` : la valeur choisie
 * par l'utilisateur (`setup.coupsPersonnalises`) si `profile.hitsRange`
 * l'autorise, sinon `profile.hits` (déjà le minimum de la plage quand elle
 * existe — jamais une surestimation par défaut). Bornée à `hitsRange` par
 * sécurité, au cas où la clé viendrait d'une recette écrite pour une autre
 * plage (régénération des données SWARFARM, par exemple).
 */
export function resolvedHits(profile: SkillDamageProfile, setup: DamageSetup): number {
  if (!profile.hitsRange) return profile.hits;
  const choisi = setup.coupsPersonnalises?.[profile.skillCom2usId];
  if (choisi == null) return profile.hits;
  return Math.min(profile.hitsRange.max, Math.max(profile.hitsRange.min, choisi));
}

/**
 * Dégâts totaux du sort (tous coups confondus) pour un build donné, ET les PV
 * restants de la cible une fois le sort encaissé.
 *
 * Suit l'équation de spec/mecaniques.md :
 *   `(Mult × Crit × FacteurDéf + Additionnel) × Réductions`
 * — `DMG%` et `Variance` valent 1 en v1 (voir l'en-tête du fichier), et un
 * sort à dégâts FIXES passe par la branche « Additionnel » : ni critique, ni
 * facteur de défense.
 *
 * ⚠️ **Les coups sont simulés UN PAR UN quand la formule lit les PV courants
 * de la cible** (`{Target Current HP %}`, ex. Benedict/Dominic — Weakness
 * Shot, `{ATK}*(3.1 - 1.2*{Target Current HP %})`, 4 coups) : chaque coup
 * creuse les PV, donc le coup suivant frappe une cible plus basse et son
 * ratio monte. Multiplier un seul coup par `hits` sous-estimait sévèrement
 * ces sorts — le 4ᵉ coup de Weakness Shot vaut bien plus que le 1ᵉʳ.
 * Les sorts qui n'en dépendent pas gardent le chemin court (une seule
 * évaluation × `hits`), au coût identique à avant.
 */
/**
 * VIT de combat effectivement utilisée pour `{Relative SPD}`, l'ignore-DEF
 * par écart de VIT et le crit garanti si plus rapide (`monsterCritSiPlusRapide`)
 * — confirmé par l'utilisateur : runes + totem (compris dans le pourcentage
 * de compétence d'invocateur, comme les autres stats), buff de VIT
 * (éventuellement AMPLIFIÉ par un artéfact « Effet aug. VIT », voir
 * `speedBuffAmpliPct`), et un bonus de leader skill d'ÉQUIPE saisi à la main
 * (`setup.leaderSkill` — le sien n'agit jamais sur lui-même). Les deux
 * derniers pourcentages sont SOMMÉS puis appliqués en une seule fois, comme
 * les autres buffs de ce module (`buff()` plus bas) — pas composés en
 * plusieurs étapes multiplicatives.
 */
export function maVitCombat(stats: StatRow[], setup: DamageSetup, element: ElementKey | null = null, ampliVitPct = 0): number {
  const bonus = summonerSkillBonus(setup.summonerSkills, element);
  const row = stats.find((s) => s.key === 'spd');
  // ⚠️ Un leader skill de VIT porte sur la VIT de BASE, pas sur le total
  // runé — EXACTEMENT `pctSpeedBonus`/`combatSpeed` (speed.ts, page RTA) :
  // `base + rune + ceil(base × (totem+lead+swift)/100)`, jamais un
  // pourcentage appliqué au total. Sommé avec la compétence d'invocateur
  // (même nature : un pourcentage de la BASE) AVANT le seul `ceil`, comme
  // `pctSpeedBonus` le fait pour totem+lead+swift — « ne jamais arrondir
  // bonus par bonus », l'écart d'un point déjà documenté et corrigé une
  // fois dans speed.ts ne doit pas resurgir ici.
  const leader = resolvedLeaderSkill(setup);
  const pctLeaderBase = leader?.stat === 'Attack Speed' ? leader.pct : 0;
  const base = row ? row.total + Math.ceil((row.base * (bonus.pct.spd + pctLeaderBase)) / 100) : 0;
  // Miriam (« Blacksmith's Technique ») amplifie AUSSI le buff de VIT, en
  // plus d'un éventuel artéfact « Effet aug. VIT » (`ampliVitPct`) — les
  // deux sources se SOMMENT avant d'amplifier, comme plusieurs lignes
  // d'artéfact identiques le font déjà (voir `speedBuffAmpliPct`). Un buff
  // de combat, LUI, porte sur le TOTAL (base+rune+lead déjà posés), pas sur
  // la seule base — mécanique différente du lead, jamais la même formule.
  const ampliMiriam = setup.miriamActif ? MIRIAM_AMPLIFY_PCT : 0;
  const pctBuff = setup.spdBuff ? SPD_BUFF_PCT * (1 + (ampliVitPct + ampliMiriam) / 100) : 0;
  return (base * (100 + pctBuff)) / 100;
}

// DEF de combat (base + rune + lead, PUIS le buff de combat sur le total) —
// même structure que `maVitCombat`, pour DEF plutôt que VIT. ⚠️ Réplique
// SANS LA PARTAGER la portion DEF du calcul déjà fait dans
// `computeSkillDamageDetail` (`avecInvocateur('def', …)`/`valeurs.DEF`) —
// non factorisée avec elle par prudence (ce chemin est fortement couplé à
// celui d'ATK dans la même fonction, déjà éprouvé par les tests existants) ;
// gardée IDENTIQUE à dessein pour `monsterBonusDegatsSelonDef` (Gideon —
// « selon TA Défense », pas un écart avec la cible comme `bonusEcartDef`).
function defCombat(stats: StatRow[], setup: DamageSetup, element: ElementKey | null = null): number {
  const bonus = summonerSkillBonus(setup.summonerSkills, element);
  const row = stats.find((s) => s.key === 'def');
  const leader = resolvedLeaderSkill(setup);
  const pctLeaderDefBase = leader?.stat === 'Defense' ? leader.pct : 0;
  const defAvecLead = row ? row.total + Math.ceil((row.base * (bonus.pct.def + pctLeaderDefBase)) / 100) : 0;
  const ampliMiriam = setup.miriamActif ? MIRIAM_AMPLIFY_PCT : 0;
  const pctDefBuff = setup.defBuff ? DEF_BUFF_PCT * (1 + ampliMiriam / 100) : 0;
  return (defAvecLead * (100 + pctDefBuff)) / 100;
}

// ATQ de combat COMPLÈTE (base + rune + lead + compétence d'invocateur) —
// Brita/Eivor (Eau), voir `monsterBonusSiAtqSeuil` : confirmé par
// l'utilisateur, « toute source confondue (ATQ de base + rune + lead +
// compétence d'invocateur) ». Pas de buff ATQ (`atkBuff`) ni de Miriam : la
// stat AFFICHÉE hors combat, pas un instantané de tour. Même prudence que
// `defCombat` (non partagée avec `avecInvocateur('atk', …)` de
// `computeSkillDamageDetail`).
function atkCombatComplet(stats: StatRow[], setup: DamageSetup, element: ElementKey | null = null): number {
  const bonus = summonerSkillBonus(setup.summonerSkills, element);
  const row = stats.find((s) => s.key === 'atk');
  const leader = resolvedLeaderSkill(setup);
  const pctLeaderAtkBase = leader?.stat === 'Attack Power' ? leader.pct : 0;
  return row ? row.total + Math.ceil((row.base * (bonus.pct.atk + pctLeaderAtkBase)) / 100) : 0;
}

// Taux Crit BRUT (avant plafond à 100 %) — leader Taux Crit + les deux
// modificateurs `monsterWide` qui le touchent directement (`bonusStatFixe`/
// `critRateSelonVit`, voir Lizardman/Glinodon et Ciri Feu/MOS Feu/Reyka) +
// la stat elle-même. Factorisé pour que `monsterBonusDegatsSelonCr`
// (Zenitsu Ténèbres/Qilin Slasher Ténèbres — « selon ton Taux Critique »,
// voir plus bas) et `computeSkillDamageDetail` lisent EXACTEMENT le même
// nombre, jamais deux formules qui pourraient diverger silencieusement.
function crBrutEffectif(
  stats: StatRow[],
  setup: DamageSetup,
  maVit: number,
  monsterWide: { critRateSelonVit?: { ptsParVit: number }; bonusStatFixe?: { cr: number; cd: number } }
): number {
  const leader = resolvedLeaderSkill(setup);
  const pctLeaderCr = leader?.stat === 'Critical Rate' ? leader.pct : 0;
  const crDepuisVit = monsterWide.critRateSelonVit ? Math.floor(maVit / monsterWide.critRateSelonVit.ptsParVit) : 0;
  return total(stats, 'cr') + (monsterWide.bonusStatFixe?.cr ?? 0) + pctLeaderCr + crDepuisVit;
}

export function computeSkillDamageDetail(
  profile: SkillDamageProfile,
  stats: StatRow[],
  setup: DamageSetup,
  // Élément du monstre optimisé — décide de la compétence « Puis. d'att. de
  // <élément> ». `null`/omis = aucune compétence élémentaire comptée (monstre
  // perso, élément inconnu).
  element: ElementKey | null = null,
  // PV de la cible AU DÉBUT de ce sort, en % de son maximum. Omis = ceux du
  // réglage. Sert à enchaîner un passif APRÈS le sort actif, sur une cible
  // déjà entamée (voir `computeTotalDamage`).
  pvCiblePctDepart?: number,
  // Somme des lignes d'artéfact « Effet aug. VIT » équipées (voir
  // `speedBuffAmpliPct`) — fixe pour toute une recherche (l'Optimizer
  // n'optimise que les runes), calculée UNE fois par l'appelant.
  ampliVitPct = 0,
  // Modificateurs monstre-wide qui touchent directement le Taux Crit/Dgts
  // Crit — DÉDUITS de la fiche (`monsterCritRateSelonVit`/
  // `monsterBonusStatFixe`, plus haut), jamais saisis. Regroupés en UN seul
  // paramètre plutôt que deux de plus : cette fonction n'est appelée que
  // depuis `damage.ts` (jamais directement par l'écran/les scripts), le
  // risque d'oubli à un site d'appel externe est nul.
  monsterWide: {
    critRateSelonVit?: { ptsParVit: number };
    bonusStatFixe?: { cr: number; cd: number };
    // Voir « Modificateurs MONSTRE-WIDE additifs » plus haut — `skillCom2usId`
    // porté par `bonusSacrifice`/`bonusParEffetCible`/`bonusParEffetPropre`
    // (pas par `bonusFixeCiblePvMax`/`bonusEcartDef`, entièrement déduits,
    // aucune saisie à retrouver) sert de clé pour lire la saisie manuelle
    // correspondante dans `setup`.
    bonusFixeCiblePvMax?: { pct: number };
    bonusEcartDef?: { coeff: number };
    bonusFixeMaxHpPropre?: { pct: number };
    bonusSacrifice?: { skillCom2usId: number; pctPerte: number; pctSurPerte: number };
    bonusParEffetCible?: { skillCom2usId: number; pct: number; source: 'buffs' | 'debuffs' | 'buffsEtDebuffs' };
    bonusParEffetPropre?: { skillCom2usId: number; pct: number };
  } = {}
): { total: number; pvRestantsPct: number } {
  const bonus = summonerSkillBonus(setup.summonerSkills, element);
  // Compétences d'invocateur : un POURCENTAGE de la stat de BASE, ajouté au
  // total — même modèle que le totem de vitesse déjà en place (voir
  // `pctSpeedBonus`, speed.ts, et spec/mecaniques.md : le totem entre dans le
  // `Σ%vit` appliqué à la base, pas au total runé).
  // ⚠️ Ajouté APRÈS coup plutôt que fondu dans le `Σ%` de `computeStats` (qui
  // a déjà rendu ses totaux) : l'écart tient au double arrondi supérieur, au
  // plus 1 point sur la stat, sans effet sur un classement de builds.
  // `extraBasePct` : un AUTRE pourcentage de la BASE à sommer AVANT le seul
  // `ceil` (leader skill — voir plus bas) — jamais un second `ceil` séparé,
  // qui reproduirait l'écart d'un point déjà documenté et corrigé une fois
  // dans `pctSpeedBonus` (speed.ts, « ne jamais arrondir bonus par bonus »).
  const avecInvocateur = (key: 'atk' | 'def' | 'hp' | 'spd', extraBasePct = 0) => {
    const row = stats.find((s) => s.key === key);
    if (!row) return 0;
    return row.total + Math.ceil((row.base * (bonus.pct[key] + extraBasePct)) / 100);
  };

  const pvMax = Math.max(0, setup.enemyHp);
  const pctDepart = Math.min(100, Math.max(0, pvCiblePctDepart ?? setup.enemyHpPct));

  const maVit = maVitCombat(stats, setup, element, ampliVitPct);
  // ⚠️ Bornée à 1 : une VIT adverse ≤ 0 ferait diverger le ratio (division
  // par zéro ou par un nombre négatif), un réglage vidé ne doit jamais casser
  // le calcul plutôt que produire `Infinity`/`NaN`.
  const vitEnnemie = Math.max(1, setup.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd!);

  // Miriam (« Blacksmith's Technique ») amplifie la MAGNITUDE des trois
  // buffs déjà actifs — jamais leur simple présence (conditionné à
  // `setup.atkBuff`/`defBuff` ci-dessous ; `maVitCombat` fait de même en
  // interne pour la VIT).
  const ampliMiriam = setup.miriamActif ? MIRIAM_AMPLIFY_PCT : 0;
  // ⚠️ Leader skill d'ÉQUIPE choisi par l'utilisateur (voir `LeaderSkillStat`
  // plus haut) — PV/ATQ/DEF portent sur la stat de BASE, exactement comme
  // VIT (`maVitCombat`) : sommé à la compétence d'invocateur (même nature)
  // AVANT le `ceil` unique d'`avecInvocateur`, PUIS le buff de combat
  // (`atkBuff`/`defBuff`, %TOTAL cette fois — base+rune+lead déjà posés)
  // s'applique par-dessus. Les deux mécaniques ne se somment PAS entre
  // elles : le lead est acquis même buff éteint, contrairement au surplus
  // du buff — jamais une seule formule additive comme avant correction.
  const leader = resolvedLeaderSkill(setup);
  const pctLeaderAtkBase = leader?.stat === 'Attack Power' ? leader.pct : 0;
  const pctLeaderDefBase = leader?.stat === 'Defense' ? leader.pct : 0;
  const pctLeaderHpBase = leader?.stat === 'HP' ? leader.pct : 0;
  const atkAvecLead = avecInvocateur('atk', pctLeaderAtkBase);
  const defAvecLead = avecInvocateur('def', pctLeaderDefBase);
  const pctAtkBuff = setup.atkBuff ? ATK_BUFF_PCT * (1 + ampliMiriam / 100) : 0;
  const pctDefBuff = setup.defBuff ? DEF_BUFF_PCT * (1 + ampliMiriam / 100) : 0;
  const valeurs: Record<DamageVariable, number> = {
    ATK: (atkAvecLead * (100 + pctAtkBuff)) / 100,
    DEF: (defAvecLead * (100 + pctDefBuff)) / 100,
    SPD: maVit,
    'MAX HP': avecInvocateur('hp', pctLeaderHpBase),
    'Target MAX HP': pvMax,
    // `(Ta VIT − VIT cible) / VIT cible` — confirmé par l'utilisateur.
    'Relative SPD': (maVit - vitEnnemie) / vitEnnemie,
    // Exprimé en FRACTION (0-1) : le corpus l'écrit toujours multiplié par un
    // coefficient (`{ATK}*(2-1*{Target Current HP %})`), jamais en points.
    // Réécrit à CHAQUE coup dans la boucle ci-dessous quand le sort en dépend.
    'Target Current HP %': pctDepart / 100,
  };

  // Terme de dégâts critiques. Les améliorations de compétence s'y ajoutent
  // (elles s'appliquent que le coup soit critique ou non) — voir
  // spec/mecaniques.md, terme « Crit ». Les Dgts Crit d'invocateur sont des
  // POINTS ajoutés à la stat, pas un pourcentage de celle-ci.
  // Euldong (« Triumph Over Evil ») ajoute 100 POINTS à la stat, comme les
  // points plats des compétences d'invocateur.
  // Un lead Dégâts Crit ajoute lui aussi des POINTS, exactement comme les
  // compétences d'invocateur et Euldong — c'est ainsi que le jeu affiche un
  // lead Taux Crit/Dégâts Crit dans la fiche stats (contrairement à un lead
  // PV/ATQ/DEF/VIT, un pourcentage MULTIPLICATIF de la stat de base).
  const pctLeaderCd = leader?.stat === 'Critical DMG' ? leader.pct : 0;
  // ⚠️ Taux Crit PLAFONNÉ à 100 % : `computeStats` renvoie volontairement le
  // total BRUT (un dépassement reste une marge légitime contre la résistance
  // adverse), mais au-delà de 100 % il ne rapporte plus aucun dégât en jeu.
  // Detect Weakspot (Lizardman/Glinodon) ajoute des points FLATS aux DEUX
  // stats, inconditionnellement — voir `monsterBonusStatFixe`. Wolf School
  // Training/Quick Execution (Ciri Feu, MOS Feu, Reyka) : 1 point de Taux
  // Crit tous les `ptsParVit` points de VIT de combat (arrondi vers le bas),
  // calculé sur LE TAUX CRIT BRUT (avant plafond à 100 %) — c'est le SURPLUS
  // au-delà de 100 % qui se reverse en Dgts Crit, 1 pour 1, y compris le
  // surplus apporté par ce même passif. Voir `monsterCritRateSelonVit`.
  // ⚠️ Le renversement du surplus en Dgts Crit est un mécanisme PROPRE à ce
  // passif — jamais universel. Un monstre SANS lui qui dépasse 100 % de
  // Taux Crit (runes très généreuses) est plafonné, un point c'est tout,
  // exactement comme avant cette fonctionnalité. Voir `crBrutEffectif`
  // (factorisée, réutilisée aussi par `monsterBonusDegatsSelonCr`).
  const crBrut = crBrutEffectif(stats, setup, maVit, monsterWide);
  const overflowVersCd = monsterWide.critRateSelonVit ? Math.max(0, crBrut - 100) : 0;
  const cr = Math.min(crBrut, 100) / 100;
  const cd =
    (total(stats, 'cd') +
      bonus.cdPoints +
      (setup.euldongActif ? EULDONG_CD_POINTS : 0) +
      pctLeaderCd +
      (monsterWide.bonusStatFixe?.cd ?? 0) +
      overflowVersCd) /
    100;
  const partCrit = profile.fixed ? 0 : setup.critMode === 'crit' ? 1 : setup.critMode === 'normal' ? 0 : cr;
  const critTerm = 1 + profile.skillupDamagePct / 100 + partCrit * cd;

  // Ignore une fraction de la DEF, proportionnelle à l'écart de VIT — 0 % si
  // la cible est aussi rapide ou plus, 100 % à `ecartMax` points d'écart ou
  // plus. Multiplicative avec la réduction de Défense (`defBreak`), jamais
  // substituée à elle : les deux réduisent la même DEF effective.
  const fractionIgnoree = profile.ignoreDefSelonVit
    ? Math.min(1, Math.max(0, (maVit - vitEnnemie) / profile.ignoreDefSelonVit.ecartMax))
    : 0;
  // Deborah (« Blacksmith's Discernment ») amplifie la RÉDUCTION d'une
  // réduction de DEF déjà active — jamais une réduction à elle seule (sans
  // `defBreak`, rien à amplifier). `1 − (1 − DEF_BREAK_FACTOR) × 1,30`,
  // confirmé par l'utilisateur : 91 % de DEF effective en moins avec les
  // deux actifs (0,7 × 1,30 = 0,91), contre 70 % (`DEF_BREAK_FACTOR` seul).
  const facteurDefBreak = setup.defBreak
    ? 1 - (1 - DEF_BREAK_FACTOR) * (setup.deborahActif ? DEBORAH_AMPLIFY : 1)
    : 1;
  const defEff = profile.ignoreDef ? 0 : Math.max(0, setup.enemyDef) * facteurDefBreak * (1 - fractionIgnoree);
  const mitigation = profile.fixed ? 1 : defenseFactor(defEff);

  // Mirinae (S3 « Cursed Music ») : même famille que la Marque, additive
  // avec elle — confirmé par l'utilisateur. Dr. Matteo (« Transmission »)
  // : formulation identique, traité PAR ANALOGIE dans le même terme (non
  // confirmé séparément comme additif, voir la constante plus haut).
  const reductions =
    1 +
    (setup.brand ? BRAND_BONUS_PCT / 100 : 0) +
    (setup.mirinaeActif ? MIRINAE_BONUS_PCT / 100 : 0) +
    (setup.transmissionActif ? TRANSMISSION_BONUS_PCT / 100 : 0);

  // Julie (« Thousand Shots »)/Melissa (« Massacre Dance ») : +pct % par
  // effet SAISI sur la cible — propre à CE sort (`profile.
  // bonusParEffetCible`), pas un modificateur monstre-wide comme les
  // termes ci-dessus.
  const facteurEffetCible = profile.bonusParEffetCible
    ? 1 + (profile.bonusParEffetCible.pct * resolvedEffetsCibleCount(profile, setup)) / 100
    : 1;
  // Backup Code (« Increase Damage », débuffs sur la CIBLE) — MONSTRE-WIDE,
  // majore le sort ACTIF choisi quel qu'il soit (voir `monsterBonusParEffetCible`,
  // distinct de `bonusParEffetCible`, propre à un sort précis type Julie).
  const facteurEffetCibleMonstre = monsterWide.bonusParEffetCible
    ? 1 +
      (monsterWide.bonusParEffetCible.pct *
        Math.max(0, setup.effetsCibleCount?.[monsterWide.bonusParEffetCible.skillCom2usId] ?? 0)) /
        100
    : 1;
  // Blessing of Curse (« Increase Damage », débuffs sur SOI) — même famille,
  // stockage séparé (`effetsPropresCount`).
  const facteurEffetPropre = monsterWide.bonusParEffetPropre
    ? 1 + (monsterWide.bonusParEffetPropre.pct * resolvedEffetsPropresCount(monsterWide.bonusParEffetPropre.skillCom2usId, setup)) / 100
    : 1;
  // Emergency Drive (Cynthia/Arcane Weapon) : bouton restreint à CE SORT
  // (« Rending Claw »), voir `SkillDamageProfile.bonusConditionnelPropre` —
  // même stockage/logique que `bonusPassifActif` mais propre au sort choisi,
  // pas à un passif séparé.
  const facteurConditionnelPropre = profile.bonusConditionnelPropre && bonusConditionnelPropreActif(profile, setup)
    ? 1 + profile.bonusConditionnelPropre.pct / 100
    : 1;

  const horsCoup =
    critTerm * mitigation * reductions * facteurEffetCible * facteurEffetCibleMonstre * facteurEffetPropre * facteurConditionnelPropre;
  // ⚠️ Variante pour les termes BRUTS (voir `ajoutBrutParCoup` plus bas) : ni
  // `critTerm`, ni `mitigation`. Le reste est CONSERVÉ — ce sont des
  // amplificateurs côté CIBLE (marque, Mirinae, « Increase Damage »…), qui
  // majorent les dégâts subis quelle qu'en soit la nature. C'est exactement
  // le traitement que ce fichier réserve déjà à un sort `profile.fixed`
  // (`partCrit = 0`, `mitigation = 1`, le reste intact) : un bonus plat de
  // passif suit donc la même règle qu'un sort fixe, plutôt qu'une seconde
  // convention parallèle.
  //
  // ⚠️ `critTerm` porte AUSSI `skillupDamagePct` — l'exclure est délibéré :
  // les améliorations du sort ACTIF n'ont aucune raison de majorer le bonus
  // plat d'un PASSIF, qui n'appartient pas à sa formule.
  const horsCoupBrut =
    reductions * facteurEffetCible * facteurEffetCibleMonstre * facteurEffetPropre * facteurConditionnelPropre;
  const coups = resolvedHits(profile, setup);
  // Crawler/Frankenstein (« Rage Charge ») : `+coeffParPoint × {variable} ×
  // compteur` s'ajoute au MULTIPLICATEUR de la formule (jamais une
  // réécriture de `formule` elle-même) — recalculé à partir de la MÊME
  // variable déjà évaluée dans `valeurs`, jamais une seconde lecture des
  // stats. Constant sur toute la durée du sort (la variable concernée,
  // DEF, ne varie jamais coup par coup, contrairement aux PV de la cible).
  const bonusCompteur = profile.bonusCoefficientParCompteur;
  const ajoutCompteur = bonusCompteur
    ? bonusCompteur.coeffParPoint * resolvedCompteurPersonnalise(profile, setup) * (valeurs[bonusCompteur.variable] ?? 0)
    : 0;
  // Spear of Tenacity — `pct/100 × {Target MAX HP}`, toujours actif, ajouté
  // au même titre qu'`ajoutCompteur` (MONSTRE-WIDE plutôt que propre à un
  // sort, mais même traitement : soumis au critique/à la défense).
  const ajoutCiblePvMax = monsterWide.bonusFixeCiblePvMax ? (monsterWide.bonusFixeCiblePvMax.pct / 100) * pvMax : 0;
  // Martial Arts Specialist — `coeff × max(0, DEF_propre − DEF_cible)`,
  // toujours actif, à CHAQUE coup (confirmé par l'utilisateur), donc dans ce
  // même terme PAR-COUP plutôt que hors du `×coups` plus bas.
  const ajoutEcartDef = monsterWide.bonusEcartDef
    ? monsterWide.bonusEcartDef.coeff * Math.max(0, valeurs.DEF - Math.max(0, setup.enemyDef))
    : 0;
  const ajoutParCoup = ajoutCompteur + ajoutCiblePvMax + ajoutEcartDef;
  // Sickle Blade/Sand Blade — `pct/100 × {MAX HP}` propre.
  const ajoutMaxHpPropre = monsterWide.bonusFixeMaxHpPropre ? (monsterWide.bonusFixeMaxHpPropre.pct / 100) * valeurs['MAX HP'] : 0;
  // Calculated Sacrifice — dérivé d'une saisie manuelle (`pvActuelsAvantSacrificePct`,
  // défaut 100 = premier tour), même famille que Sickle Blade.
  const ajoutSacrifice = monsterWide.bonusSacrifice
    ? (monsterWide.bonusSacrifice.pctSurPerte / 100) *
      (monsterWide.bonusSacrifice.pctPerte / 100) *
      (resolvedPvActuelsAvantSacrificePctMonstre(monsterWide.bonusSacrifice.skillCom2usId, setup) / 100) *
      valeurs['MAX HP']
    : 0;
  // ⚠️ **Dégâts BRUTS, À CHAQUE COUP** — Sickle Blade (Bayek Vent), Sand
  // Blade (Desert Warrior Vent, Shahat), Calculated Sacrifice (Onimusha,
  // Fuuki). Ni critiques, ni mitigés par la défense adverse : ils passent
  // donc par `horsCoupBrut`, jamais par `horsCoup`.
  //
  // ⚠️ **Ce terme s'appelait `ajoutUneFois` et était faux sur DEUX axes** :
  // multiplié par `horsCoup` (donc critique et mitigé) ET compté une seule
  // fois par sort. L'ancien commentaire invoquait un « confirmé par
  // l'utilisateur » pour le « une fois par sort » — c'était une ERREUR, levée
  // par un relevé EN JEU : Shahat ~50 000 PV, S2 sur une cible à ~3 000 DEF,
  // ~4 500 dégâts par coup relevés contre 770 à 1 760 prédits par l'ancien
  // calcul. Voir spec/outils/degats-reels.md, « Corrections identifiées ».
  //
  // ⚠️ Les deux familles vont EXACTEMENT au même endroit — ne pas rescinder
  // l'accumulateur « au cas où » : c'est ce partage qui avait été pris à tort
  // pour un obstacle.
  const ajoutBrutParCoup = ajoutMaxHpPropre + ajoutSacrifice;
  // Ce que ce terme vaut par coup, amplificateurs de cible compris.
  const degatsBrutParCoup = ajoutBrutParCoup * horsCoupBrut;
  // Les PV ne peuvent pas descendre sous zéro, et une cible à 0 PV max (cas
  // dégénéré d'un réglage vidé) ne se creuse pas : on renvoie alors le
  // pourcentage de départ inchangé plutôt que de diviser par zéro.
  const creuse = (degats: number, pvCourant: number) => (pvMax > 0 ? Math.max(0, pvCourant - degats) : pvCourant);

  // Chemin COURT — le ratio ne dépend pas des PV de la cible : une seule
  // évaluation, exactement comme avant l'ajout de la simulation.
  if (!profile.variables.includes('Target Current HP %')) {
    const mult = evaluer(profile.noeud, valeurs) + ajoutParCoup;
    if (mult <= 0 && degatsBrutParCoup <= 0) return { total: 0, pvRestantsPct: pctDepart };
    // ⚠️ Le terme brut est DANS le `×coups`, plus ajouté à côté : les deux
    // parts frappent le même nombre de fois, seule leur mitigation diffère.
    const totalDegats = (Math.max(0, mult) * horsCoup + degatsBrutParCoup) * coups;
    const pvApres = creuse(totalDegats, (pctDepart / 100) * pvMax);
    return { total: totalDegats, pvRestantsPct: pvMax > 0 ? (pvApres / pvMax) * 100 : pctDepart };
  }

  // Chemin SÉQUENTIEL — chaque coup frappe une cible plus basse que le
  // précédent, donc avec un ratio plus élevé.
  let pvCourant = (pctDepart / 100) * pvMax;
  let totalDegats = 0;
  for (let i = 0; i < coups; i++) {
    valeurs['Target Current HP %'] = pvMax > 0 ? pvCourant / pvMax : pctDepart / 100;
    const mult = evaluer(profile.noeud, valeurs) + ajoutParCoup;
    // ⚠️ `Math.max(0, mult)` et non un `continue` sur `mult <= 0` : un
    // multiplicateur nul n'annule PAS le terme brut, qui ne dépend pas de la
    // formule du sort. Le coup n'est sauté que s'il ne porte réellement rien.
    const degatsCoup = Math.max(0, mult) * horsCoup + degatsBrutParCoup;
    if (degatsCoup <= 0) continue;
    totalDegats += degatsCoup;
    // ⚠️ Le terme brut est creusé DANS la boucle, avec le coup qui le porte —
    // c'est ce qui garde `pvRestantsPct` exact pour les passifs à seuil qui
    // s'évaluent ensuite (le bug corrigé jadis sur l'ancien `ajoutUneFois`,
    // creusé en bloc après la boucle, ne peut plus se reformer ici).
    pvCourant = creuse(degatsCoup, pvCourant);
  }
  // ⚠️ Plus RIEN à ajouter après la boucle. L'ancien `ajoutUneFois` était
  // appliqué ici en bloc, ce qui avait déjà valu un bug (`pvRestantsPct`
  // surestimé, corrigé lors d'une revue de code externe : un seuil de passif
  // « bonus si PV restants ≤ X % », Final Strike/Benedict, pouvait manquer sa
  // cible). Le terme étant désormais PAR COUP, il est creusé dans la boucle
  // avec le coup qui le porte — cette classe de bug ne peut plus se reformer.
  return { total: totalDegats, pvRestantsPct: pvMax > 0 ? (pvCourant / pvMax) * 100 : pctDepart };
}

/** Dégâts seuls — voir `computeSkillDamageDetail` pour les PV restants. */
export function computeSkillDamage(
  profile: SkillDamageProfile,
  stats: StatRow[],
  setup: DamageSetup,
  element: ElementKey | null = null
): number {
  return computeSkillDamageDetail(profile, stats, setup, element).total;
}

// Un passif de `passifs` doit-il compter dans le total, selon l'état des
// boutons de `setup` ? `toujours` ne dépend d'aucun bouton (il n'en a pas) ;
// les deux autres catégories suivent `setup.passifsOffensifs`, absent =
// désactivé. Factorisé — `computeTotalDamage` et `damageRelevantStats`
// doivent s'accorder EXACTEMENT sur ce qui compte, sinon le pré-filtrage
// privilégierait des stats qu'un score différent ignore (ou l'inverse).
export function passifActif(p: PassifOffensifProfile, setup: DamageSetup): boolean {
  const c = p.categorie;
  if (c.type === 'toujours' || c.type === 'bonus') return true;
  // Entièrement DÉDUIT, aucun bouton : le texte du jeu dit à quel instant la
  // condition s'évalue (`moment`), et les deux réglages de réduction de
  // Défense suffisent à trancher. Pour Roid, dont les deux branches sont
  // mutuellement exclusives, exactement UNE des deux ressort toujours vraie.
  if (c.type === 'defBreak') {
    const avant = setup.defBreak;
    const etat = c.moment === 'avant' ? avant : defBreakApres(setup);
    return etat === c.exige;
  }
  // `?.` : une recette exportée AVANT ce champ a un `damageSetup` complet
  // par ailleurs mais sans `passifsOffensifs` du tout, pas seulement la clé.
  return setup.passifsOffensifs?.[p.skillCom2usId] ?? false;
}

// Réduction de Défense active APRÈS le sort choisi — celle qui était déjà là,
// ou celle que le sort vient de poser. C'est l'état que subissent TOUS les
// passifs, qui se déclenchent après lui.
function defBreakApres(setup: DamageSetup): boolean {
  return setup.defBreak || (setup.defBreakParLeSort ?? false);
}

// Le SURPLUS d'un passif `bonus` est-il acquis ? ⚠️ Distinct de
// `passifActif` : la formule de base d'un passif `bonus` est TOUJOURS
// comptée (« Attacks additionally … when you attack the enemy on your
// turn » — inconditionnel), seul le pourcentage supplémentaire dépend du
// bouton. Les confondre mettait toute la contribution à zéro quand le
// bouton était éteint, alors que l'attaque a bien lieu en jeu.
export function bonusPassifActif(p: PassifOffensifProfile, setup: DamageSetup): boolean {
  return p.categorie.type === 'bonus' && (setup.passifsOffensifs?.[p.skillCom2usId] ?? false);
}

/**
 * Dégâts totaux réellement infligés : le sort actif choisi PLUS les passifs
 * offensifs de ce monstre actuellement retenus (voir `passifActif`).
 *
 * ⚠️ **Chaque passif recalculé par `computeSkillDamage`, jamais une formule
 * séparée** — même équation de spec/mecaniques.md, même adversaire : un
 * passif reste « une attaque de plus », pas un mécanisme à part. TROIS
 * ajustements, résolus au cas par cas dans `PASSIFS_OFFENSIFS_CONNUS`
 * (jamais un défaut générique) :
 * - `critique` — `'jamais'` force « Non critique » pour CE composant,
 *   `'toujours'` force le critique même si l'écran est en « Non critique »
 *   (Hidden Gun), quel que soit le mode choisi pour le sort actif. Aucune
 *   de ces deux informations n'existe dans SWARFARM ni dans la formule.
 * - `coupsDuSortActif: true` — le nombre d'instances suit celui RÉELLEMENT
 *   retenu pour le sort ACTIF (`resolvedHits(profile, setup)`, qui respecte
 *   lui-même un éventuel réglage manuel de coups variables), pas le nombre
 *   fixe du passif.
 * - `defBreak` (catégorie) — la réduction de Défense que le SORT vient de
 *   poser s'applique au passif, qui frappe après lui : d'où
 *   `defBreak: defBreakApres(setup)` sur le réglage transmis, jamais le
 *   `setup.defBreak` brut (qui, lui, décrit l'état AVANT le sort).
 *
 * ⚠️ **Le bonus `bonus` s'applique SEULEMENT à la contribution du passif
 * concerné**, jamais au total : « +100 % si cible Lumière » double les
 * dégâts DE CE PASSIF précis, pas ceux du sort actif à côté. Et il ne
 * conditionne QUE le surplus — la formule de base d'un passif `bonus` est
 * comptée même bouton éteint (voir `bonusPassifActif`). ⚠️ **Sauf
 * `dejaInclus`** (Dominic — « Improvisation ») : `formule` porte déjà le cas
 * majoré, donc c'est l'INVERSE — bouton éteint, la contribution est DIVISÉE
 * par `1 + pct/100` pour retomber au cas de base, jamais multipliée.
 *
 * ⚠️ **`critSiPlusRapide`** (Ciri Eau, Rigna, Magic Order Swordsinger — voir
 * `monsterCritSiPlusRapide`) : contrairement aux `PASSIFS_OFFENSIFS_CONNUS`,
 * ce n'est PAS un passif qui inflige des dégâts propres — confirmé par
 * l'utilisateur (« le passif en lui-même ne fait pas de dégâts... c'est lui
 * qui force le Crit »). Un MODIFICATEUR sur l'ensemble des dégâts du
 * monstre : quand `maVitCombat(...) > VIT adverse`, force le critique sur le
 * sort actif ET sur chaque passif dont `critique === 'suit'` — un passif
 * avec son propre `'jamais'`/`'toujours'` (fait plus précis sur CETTE
 * contribution précise) garde la priorité.
 *
 * ⚠️ **`bonusDegatsSelonVit`** (Sonia, Battle Angel — « Evasion (Passive) »,
 * voir `monsterBonusDegatsSelonVit`) : même famille de modificateur que
 * `critSiPlusRapide` (pas un `PASSIFS_OFFENSIFS_CONNUS`, aucune contribution
 * propre), mais un bonus CONTINU au lieu d'un binaire — `pctMax` % à
 * `ecartMax` points d'écart de VIT ou plus, linéaire en-dessous (confirmé
 * par l'utilisateur : 50 pts = +50 %, 3 pts = +3 %). Multiplicatif sur le
 * TOTAL (sort + tous les passifs), après coup — pas une contribution isolée
 * comme `bonusPvCible`.
 *
 * ⚠️ **`bonusDegatsStack`** (Momo, Mage — « Secret Book (Passive) », voir
 * `monsterBonusDegatsStackable`) : même famille encore (multiplicatif sur le
 * TOTAL, après coup), mais la source du pourcentage n'est NI une formule NI
 * la VIT — un état de combat (nombre d'attaques alliées déjà portées) que
 * l'app ne simule pas. L'utilisateur choisit lui-même le stack actuel
 * (`setup.stackPersonnalise`, voir `resolvedStackPct`) ; défaut 0 % —
 * jamais un stack deviné actif.
 */
export function computeTotalDamage(
  profile: SkillDamageProfile,
  passifs: PassifOffensifProfile[],
  stats: StatRow[],
  setup: DamageSetup,
  element: ElementKey | null = null,
  // Somme des lignes d'artéfact « Effet aug. VIT » équipées — voir
  // `speedBuffAmpliPct`, fixe pour toute une recherche.
  ampliVitPct = 0,
  critSiPlusRapide = false,
  // Sonia/Battle Angel (« Evasion (Passive) ») — voir
  // `monsterBonusDegatsSelonVit`. `null` = comportement inchangé.
  bonusDegatsSelonVit: { ecartMax: number; pctMax: number } | null = null,
  // Momo/Mage (« Secret Book (Passive) ») — voir `monsterBonusDegatsStackable`.
  // Le pourcentage EFFECTIF est lu directement dans `setup.stackPersonnalise`
  // (`resolvedStackPct`), pas passé ici : `null` = comportement inchangé.
  bonusDegatsStack: BonusDegatsStackableProfile | null = null,
  // Ciri (Feu)/MOS (Feu)/Reyka (« Wolf School Training »/« Quick Execution »)
  // et Lizardman/Glinodon (« Detect Weakspot ») — voir
  // `monsterCritRateSelonVit`/`monsterBonusStatFixe`. Touchent directement
  // le Taux Crit/Dgts Crit à CHAQUE instance (sort ET passifs), donc
  // transmis tels quels à `computeSkillDamageDetail`. `{}` = comportement
  // inchangé.
  monsterWide: {
    critRateSelonVit?: { ptsParVit: number };
    bonusStatFixe?: { cr: number; cd: number };
    bonusFixeCiblePvMax?: { pct: number };
    bonusEcartDef?: { coeff: number };
    bonusFixeMaxHpPropre?: { pct: number };
    bonusSacrifice?: { skillCom2usId: number; pctPerte: number; pctSurPerte: number };
    bonusParEffetCible?: { skillCom2usId: number; pct: number; source: 'buffs' | 'debuffs' | 'buffsEtDebuffs' };
    bonusParEffetPropre?: { skillCom2usId: number; pct: number };
  } = {},
  // Bonus conditionnel à bouton (Jin Kazama, Cyborg, Brownie Magician,
  // Astar, Jean, Kyle, Satoru Gojo, Werner, Zenitsu, Qilin Slasher, Panda
  // Warrior, Mi Ying…) — voir `monsterBonusDegatsConditionnel`. `null` =
  // comportement inchangé.
  bonusDegatsConditionnel: BonusDegatsConditionnelProfile | null = null,
  // Zenitsu Agatsuma (Ténèbres)/Qilin Slasher (Ténèbres) — voir
  // `monsterBonusDegatsSelonCr`. Même famille que `bonusDegatsSelonVit`
  // (multiplicatif sur le TOTAL), mais selon le Taux Crit BRUT plutôt que
  // l'écart de VIT. `null` = comportement inchangé.
  bonusDegatsSelonCr: { ratio: number } | null = null,
  // Gideon (« Aegis Shell ») — voir `monsterBonusDegatsSelonDef`. Même
  // famille ENCORE, mais selon TA PROPRE DEF (pas un écart avec la cible).
  // `null` = comportement inchangé.
  bonusDegatsSelonDef: { defMax: number; pctMax: number } | null = null,
  // Brita/Eivor (Eau) — voir `monsterBonusSiAtqSeuil`. Entièrement DÉDUIT
  // (comme `critSiPlusRapide`), aucun bouton. `null` = comportement
  // inchangé.
  bonusSiAtqSeuil: { seuil: number; pct: number } | null = null
): number {
  const maVit = maVitCombat(stats, setup, element, ampliVitPct);
  const ecartVit = maVit - Math.max(1, setup.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd!);
  const forceCrit = critSiPlusRapide && ecartVit > 0;
  const setupSort = forceCrit ? { ...setup, critMode: 'crit' as const } : setup;
  // ⚠️ Les PV de la cible sont ENCHAÎNÉS du sort actif vers les passifs :
  // ceux-ci frappent après lui, sur une cible déjà entamée. C'est ce qui
  // permet à un bonus « si les PV sont tombés sous X % » (Final Strike) de
  // se déduire tout seul, sans rien demander à l'utilisateur.
  const sort = computeSkillDamageDetail(profile, stats, setupSort, element, undefined, ampliVitPct, monsterWide);
  let total = sort.total;
  let pvCiblePct = sort.pvRestantsPct;
  for (const p of passifs) {
    if (!passifActif(p, setup)) continue;
    // `hitsRange: undefined` : `hits` est déjà la valeur RÉSOLUE du sort
    // actif, `resolvedHits` ne doit pas la re-résoudre une seconde fois via
    // un éventuel `coupsPersonnalises[p.skillCom2usId]` sans rapport.
    const profilPassif = p.coupsDuSortActif
      ? { ...p.profile, hits: resolvedHits(profile, setup), hitsRange: undefined }
      : p.profile;
    const setupPassif: DamageSetup = {
      ...setup,
      defBreak: defBreakApres(setup),
      ...(forceCrit && p.critique === 'suit' ? { critMode: 'crit' as const } : {}),
      ...(p.critique === 'jamais' ? { critMode: 'normal' as const } : {}),
      ...(p.critique === 'toujours' ? { critMode: 'crit' as const } : {}),
    };
    // Le seuil se juge sur les PV AVANT que ce passif ne frappe — c'est bien
    // l'état de la cible au moment où le jeu évalue la condition.
    const seuilAtteint = p.bonusPvCible != null && pvCiblePct <= p.bonusPvCible.seuilPct;
    const detail = computeSkillDamageDetail(profilPassif, stats, setupPassif, element, pvCiblePct, ampliVitPct, monsterWide);
    pvCiblePct = detail.pvRestantsPct;
    let contribution = detail.total;
    if (seuilAtteint && p.bonusPvCible) contribution *= 1 + p.bonusPvCible.pct / 100;
    if (p.categorie.type === 'bonus') {
      const actif = bonusPassifActif(p, setup);
      // ⚠️ `dejaInclus` (Dominic — voir `PassifOffensifCategorie`) : `formule`
      // porte déjà le cas MAJORÉ, donc l'opération s'inverse — décoché, on
      // DIVISE pour retrouver le cas de base, jamais l'inverse.
      if (p.categorie.dejaInclus) {
        if (!actif) contribution /= 1 + p.categorie.pct / 100;
      } else if (actif) {
        contribution *= 1 + p.categorie.pct / 100;
      }
    }
    total += contribution;
  }
  // ⚠️ Multiplicatif sur le TOTAL (sort actif + tous les passifs), APRÈS
  // coup — « the damage dealt increases », un modificateur sur l'ensemble de
  // ce que le monstre inflige, pas une contribution à part (contrairement à
  // `bonusPvCible`/`bonus`, propres à UN passif précis).
  if (bonusDegatsSelonVit) {
    // ⚠️ RÉGRESSION CORRIGÉE (trouvée en implémentant Gideon, pas signalée
    // par l'utilisateur) : le plafond doit porter sur L'ÉCART (`ecartMax`,
    // en points de VIT), PAS sur `pctMax` (en points de %) — les deux
    // n'étaient identiques QUE pour Sonia (50/50), jamais vérifié au-delà
    // pour Chun-Li/Leah (150 pts d'écart, 200 % de plafond) : un écart de
    // 200+ points y donnait ~267 % au lieu de rester plafonné à 200 %.
    const pct = Math.min(bonusDegatsSelonVit.ecartMax, Math.max(0, ecartVit)) * (bonusDegatsSelonVit.pctMax / bonusDegatsSelonVit.ecartMax);
    total *= 1 + pct / 100;
  }
  // Même famille, source différente ENCORE : le Taux Crit BRUT plutôt que
  // l'écart de VIT — même helper `crBrutEffectif` que `computeSkillDamageDetail`,
  // aucune divergence possible entre les deux.
  if (bonusDegatsSelonCr) {
    const crBrut = crBrutEffectif(stats, setup, maVit, monsterWide);
    total *= 1 + (crBrut * bonusDegatsSelonCr.ratio) / 100;
  }
  // Gideon (« Aegis Shell ») — linéaire, plafonné, même forme que
  // `bonusDegatsSelonVit`/`bonusDegatsSelonCr`, source = TA PROPRE DEF.
  if (bonusDegatsSelonDef) {
    const def = defCombat(stats, setup, element);
    const pct = Math.min(bonusDegatsSelonDef.defMax, Math.max(0, def)) * (bonusDegatsSelonDef.pctMax / bonusDegatsSelonDef.defMax);
    total *= 1 + pct / 100;
  }
  // Brita/Eivor (Eau) — SEUIL absolu (pas linéaire) : +pct % dès que l'ATQ
  // totale (avec lead, compétence d'invocateur) atteint `seuil`, rien
  // avant. Entièrement déduit.
  if (bonusSiAtqSeuil && atkCombatComplet(stats, setup, element) >= bonusSiAtqSeuil.seuil) {
    total *= 1 + bonusSiAtqSeuil.pct / 100;
  }
  // Même famille que `bonusDegatsSelonVit` (multiplicatif sur le TOTAL,
  // après coup) — seule la SOURCE du pourcentage change : saisie par
  // l'utilisateur (`resolvedStackPct`) plutôt que déduite de la VIT.
  if (bonusDegatsStack) total *= 1 + resolvedStackPct(bonusDegatsStack, setup) / 100;
  // Encore la même famille — seule la source change ENCORE : un bouton
  // (`bonusDegatsConditionnelActif`) plutôt qu'une valeur saisie ou déduite
  // de la VIT, pour une condition que l'app ne peut pas connaître (PV
  // propres, état d'un allié, tour précédent…).
  if (bonusDegatsConditionnel && bonusDegatsConditionnelActif(bonusDegatsConditionnel, setup)) {
    total *= 1 + bonusDegatsConditionnel.pct / 100;
  }
  // Velaska (« Price of Pain ») — effet d'ÉQUIPE, encore la même famille :
  // +0,5 % de dégâts par point de % de PV perdu SAISI (l'app ne simule pas
  // les PV du monstre optimisé en combat). Sans effet si `velaskaActif` est
  // faux, ou si `velaskaPvPerduPct` est absent/nul.
  if (setup.velaskaActif) {
    total *= 1 + (VELASKA_PCT_PAR_PV_PERDU * (setup.velaskaPvPerduPct ?? 0)) / 100;
  }
  return total;
}

/**
 * Les stats du build que ce sort — ET les passifs offensifs actuellement
 * retenus — font RÉELLEMENT travailler — ce que la recherche doit privilégier
 * dès le pré-filtrage (voir `OBJECTIVE_RELEVANT_STATS` dans runeBuildOptim.ts).
 *
 * ⚠️ **Source UNIQUE**, appelée à la fois par l'écran et par la relecture
 * d'une recette en ligne de commande (`recipeToSearchParams.ts`) : deux
 * calculs séparés divergeraient en silence, sans que `tsc` puisse le voir.
 *
 * ⚠️ **Le Taux Crit n'y figure jamais**, même en mode « Moyenne » — même
 * raison que l'objectif « Dégâts » : il est plafonné à 100 % en jeu, donc
 * c'est une CONDITION à atteindre (via un minimum posé), pas une cible à
 * maximiser indéfiniment. L'y mettre pousserait la rétention à garder des
 * demi-builds pour un potentiel de crit qui ne sert plus à rien.
 *
 * ⚠️ **`passifs`/`setup` optionnels** : `damageRelevantStats(profile)` seul
 * reste valide (comportement strictement inchangé) pour tout appelant qui
 * n'a pas encore ces deux valeurs sous la main.
 */
export function damageRelevantStats(
  profile: SkillDamageProfile | null,
  passifs: PassifOffensifProfile[] = [],
  setup: DamageSetup = DEFAULT_DAMAGE_SETUP,
  // Modificateurs monstre-wide qui font travailler la VIT même quand AUCUN
  // sort/passif compté n'en lit une variable — Sonia (`Evasion`) n'a par
  // exemple aucun sort dont la formule dépend de la VIT, mais son bonus de
  // dégâts continu en dépend quand même. Voir `computeTotalDamage`.
  critSiPlusRapide = false,
  bonusDegatsSelonVit: { ecartMax: number; pctMax: number } | null = null,
  // Ciri (Feu)/MOS (Feu)/Reyka — voir `monsterCritRateSelonVit`. Même
  // raison que les deux précédents : le Taux Crit dépend de la VIT même si
  // aucun sort/passif compté n'en lit une variable.
  critRateSelonVit: { ptsParVit: number } | null = null,
  // Martial Arts Specialist (Sin) — voir `monsterBonusEcartDef`. Fait
  // travailler la DEF même pour un sort dont la formule ne la lit pas
  // (Roundhouse Kick, `3.9*{ATK}` seul) : le bonus, lui, en dépend.
  bonusEcartDef: { coeff: number } | null = null,
  // Sickle Blade/Sand Blade/Calculated Sacrifice — voir
  // `monsterBonusFixeMaxHpPropre`/`monsterBonusSacrifice`. Même raison,
  // pour les PV MAX propres.
  bonusHpPropre = false,
  // Zenitsu Agatsuma (Ténèbres)/Qilin Slasher (Ténèbres) — voir
  // `monsterBonusDegatsSelonCr`. ⚠️ SEUL cas de ce fichier où le Taux Crit
  // devient une stat à privilégier : partout ailleurs il est plafonné à
  // 100 % en jeu (une CONDITION, pas une cible à maximiser), mais ce
  // passif-ci en fait directement une source de dégâts.
  bonusDegatsSelonCr: { ratio: number } | null = null,
  // Gideon (« Aegis Shell ») — voir `monsterBonusDegatsSelonDef`. Fait
  // travailler la DEF même pour un sort qui ne la lit pas.
  bonusDegatsSelonDef: { defMax: number; pctMax: number } | null = null,
  // Brita/Eivor (Eau) — voir `monsterBonusSiAtqSeuil`. Fait travailler
  // l'ATQ même pour un sort qui ne la lit pas directement (rare : la
  // plupart des sorts en dépendent déjà, mais un sort à `{DEF}` seul ne la
  // privilégierait pas sinon).
  bonusSiAtqSeuil: { seuil: number; pct: number } | null = null
): StatKey[] {
  // Sans sort résolu (fiche absente, sort non pris en charge), on retombe sur
  // ATQ + Dgts Crit (même repli que l'ancien objectif « Dégâts », retiré —
  // reste la meilleure approximation générique quand aucun sort n'est
  // calculable) — le cas de très loin le plus fréquent.
  if (!profile) return ['atk', 'cd'];
  const keys: StatKey[] = [];
  const ajouter = (variables: DamageVariable[]) => {
    for (const v of variables) {
      const k = VARIABLE_STAT[v];
      if (k && !keys.includes(k)) keys.push(k);
    }
  };
  ajouter(profile.variables);
  // Les dégâts fixes ne critent pas : les Dgts Crit n'y changent rien —
  // mais si UN SEUL des composants comptés (sort ou passif actif) peut
  // criter, les Dgts Crit restent pertinents pour le TOTAL.
  let peutCriter = !profile.fixed;
  // ⚠️ Un passif `'toujours'` critique QUOI QU'IL ARRIVE : `computeTotalDamage`
  // lui impose `critMode: 'crit'` pour sa propre contribution, sans regarder le
  // mode choisi. Il faut le savoir plus bas, pour ne pas lui retirer les Dgts
  // Crit en mode « Non critique ».
  let critGarantiParPassif = false;
  for (const p of passifs) {
    if (!passifActif(p, setup)) continue;
    ajouter(p.profile.variables);
    // `'toujours'` compte AUSSI : ce composant critique à coup sûr, donc les
    // Dgts Crit pèsent sur lui plus encore que sur un sort ordinaire.
    if (!p.profile.fixed && p.critique !== 'jamais') peutCriter = true;
    if (!p.profile.fixed && p.critique === 'toujours') critGarantiParPassif = true;
  }
  if (critSiPlusRapide || bonusDegatsSelonVit || critRateSelonVit) {
    if (!keys.includes('spd')) keys.push('spd');
  }
  if (bonusEcartDef && !keys.includes('def')) keys.push('def');
  if (bonusHpPropre && !keys.includes('hp')) keys.push('hp');
  if (bonusDegatsSelonCr && !keys.includes('cr')) keys.push('cr');
  if (bonusDegatsSelonDef && !keys.includes('def')) keys.push('def');
  if (bonusSiAtqSeuil && !keys.includes('atk')) keys.push('atk');
  // Le critique forcé change la donne — mais SEULEMENT lui : le bonus continu
  // de Sonia multiplie le total quel que soit son mode de critique, il ne le
  // FORCE pas.
  if (critSiPlusRapide) peutCriter = true;
  // ⚠️ **BUG CORRIGÉ** (revue de code externe, perf) : le mode « Non
  // critique » (`setup.critMode === 'normal'`) annule TOUJOURS la part
  // critique dans `computeSkillDamageDetail` (`partCrit` vaut 0, quel que
  // soit `profile.fixed` — voir sa définition) — SAUF `critSiPlusRapide`,
  // qui force un critique garanti et passe outre ce mode (voir
  // `computeTotalDamage`, `forceCrit`). Sans cette garde, Dégâts Crit
  // restait retenu au pré-filtrage même en « Non critique », où il ne pèse
  // pourtant sur AUCUN dégât — gaspillant du budget de rétention sur des
  // runes bonnes en Dgts Crit au détriment de stats qui comptent réellement
  // pour ce mode.
  //
  // ⚠️⚠️ **DEUX exceptions, pas une.** `critSiPlusRapide` force un critique
  // garanti — mais un passif `critique: 'toujours'` aussi (Hidden Gun,
  // Meticulous Attack) : `computeTotalDamage` lui impose `critMode: 'crit'`
  // pour sa propre contribution, quel que soit le mode choisi. N'excepter que
  // le premier retirait les Dgts Crit à un monstre dont un composant crit
  // pourtant à coup sûr — le remède devenait pire que le mal qu'il corrige.
  if (setup.critMode === 'normal' && !critSiPlusRapide && !critGarantiParPassif) peutCriter = false;
  if (peutCriter) keys.push('cd');
  return keys;
}
