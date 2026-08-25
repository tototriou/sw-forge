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

// Passifs qui majorent TOUS les dégâts du monstre proportionnellement à
// l'écart de VIT avec la cible, plafonné à `pctMax` à `ecartMax` points
// d'écart ou plus — Sonia/Battle Angel (« Evasion (Passive) », sans formule
// ni dégâts propres : encore un MODIFICATEUR, pas un
// `PASSIFS_OFFENSIFS_CONNUS`). Linéaire, confirmé par l'utilisateur : 50
// points d'écart = +50 %, 3 points = +3 %, 42 points = +42 %.
const BONUS_DEGATS_SELON_VIT_CONNUS: Record<string, { ecartMax: number; pctMax: number }> = {
  'Evasion (Passive)': { ecartMax: 50, pctMax: 50 }, // Sonia, Battle Angel
};

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

// Passifs qui majorent TOUS les dégâts du monstre d'un pourcentage qui
// S'ACCUMULE en combat (Momo/Mage — « Secret Book (Passive) » : « increases
// the damage by 10% each, up to 200%, whenever an ally attacks » — encore un
// MODIFICATEUR sans formule ni dégâts propres, PAS un
// `PASSIFS_OFFENSIFS_CONNUS`). ⚠️ Contrairement à `critSiPlusRapide`/
// `BONUS_DEGATS_SELON_VIT_CONNUS`, RIEN ici ne se déduit d'un état déjà
// connu de l'app (le nombre d'attaques alliées déjà portées dans le combat
// n'est pas simulé) : l'utilisateur choisit lui-même le niveau de stack
// actuel, via `DamageSetup.stackPersonnalise`.
const BONUS_DEGATS_STACKABLE_CONNUS: Record<string, { pctParStack: number; pctMax: number }> = {
  'Secret Book (Passive)': { pctParStack: 10, pctMax: 200 }, // Momo, Mage
};

export interface BonusDegatsStackableProfile {
  skillCom2usId: number;
  nom: string;
  description: string | null;
  icone: string | null;
  pctParStack: number;
  pctMax: number;
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

// Le pourcentage de stack ACTUELLEMENT choisi pour `p`, borné à `pctMax` —
// même discipline défensive que `resolvedHits` (une recette écrite avant une
// régénération des données, ou un stack saisi puis un monstre différent
// chargé, ne doivent jamais produire une valeur hors plage).
export function resolvedStackPct(p: BonusDegatsStackableProfile, setup: DamageSetup): number {
  return Math.min(p.pctMax, Math.max(0, setup.stackPersonnalise?.[p.skillCom2usId] ?? 0));
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
  variables: DamageVariable[];
  noeud: Noeud;
}

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

// Sorts/passifs dont le nombre de coups VARIE en jeu (« 2 à 3 fois », « 3 à
// 5 fois »…) — `Competence.coups` ne porte qu'UN SEUL nombre, pas toujours
// cohérent avec le texte (ex. Rain of Fire : `coups=6` en donnée, « 3 à 5
// fois » dans le texte — ni l'un ni l'autre). Curation à la main, exactement
// comme `PASSIFS_OFFENSIFS_CONNUS` : jamais une extraction automatique du
// texte anglais libre. Sert AUSSI bien un sort actif (`skillDamageProfile`)
// qu'un passif (`monsterOffensivePassives`), même table, même clé
// (`Competence.nom` exact).
const COUPS_VARIABLES_CONNUS: Record<string, { min: number; max: number }> = {
  'Great Friends (Passive)': { min: 2, max: 3 }, // Sia — confirmé par l'utilisateur
  'Rain of Stones': { min: 3, max: 5 }, // Okeanos S3
  'Ray Spears': { min: 2, max: 3 }, // Amber S2
};

/**
 * Profil de dégâts d'une compétence, ou `null` si elle n'inflige pas de
 * dégâts calculables. Ne lève jamais.
 */
export function skillDamageProfile(c: Competence): SkillDamageProfile | SkillDamageUnsupported | null {
  if (c.passif || !c.formule || c.com2usId == null) return null;
  const brut = c.formule.trim();
  const fixed = RE_FIXED.test(brut);
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
    // partout ailleurs dans ce module.
    hits: coupsVariables ? coupsVariables.min : c.coups && c.coups > 0 ? c.coups : 1,
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
  | { type: 'bonus'; pct: number; condition: string }
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
  // ⚠️ Passé de `bonus` à `toujours` : confirmé qu'on IGNORE la condition de
  // PV de l'attaquant et qu'on compte le passif d'office. Sa formule
  // `2.0*{ATK} (Fixed)` correspond déjà au cas majoré (« 100 % de l'ATQ »,
  // « +100 % si tes PV dépassent 50 % ») — un bouton `bonus` par-dessus
  // aurait doublé une seconde fois. `(Fixed)` : ni critique ni facteur DEF.
  { nom: 'Improvisation (Passive)', categorie: { type: 'toujours' } }, // Weapon Master, Dominic
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
    if (!analyse || !analyse.variables.some((v) => VARIABLE_STAT[v])) continue;
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
        hits: COUPS_VARIABLES_CONNUS[c.nom]?.min ?? connu.coups ?? 1,
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

export const CRIT_MODE_LABELS: { key: CritMode; label: string }[] = [
  { key: 'moyenne', label: 'Moyenne' },
  { key: 'crit', label: 'Critique' },
  { key: 'normal', label: 'Non critique' },
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
  // Bonus de VIT % d'un leader skill d'ÉQUIPE (pas le sien, qui n'agit jamais
  // sur lui-même) — saisie manuelle, comme les leads de speed.ts
  // (`SPEED_LEADS`), mais un champ libre ici plutôt qu'une rangée de
  // boutons : ne sert QUE pour {Relative SPD}/l'ignore-DEF par écart de VIT.
  // Absent/0 = aucun. Confirmé par l'utilisateur : entre dans « ta VIT
  // totale » au même titre que les runes et le totem.
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
  // `MIRIAM_AMPLIFY_PCT` plus haut. Optionnels : absents/`false` sur une
  // recette exportée avant ces champs, comportement strictement inchangé.
  euldongActif?: boolean;
  mirinaeActif?: boolean;
  deborahActif?: boolean;
  miriamActif?: boolean;
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
  leaderSpeedPct: 0,
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
  critMode: 'moyenne',
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
 * (`setup.leaderSpeedPct` — le sien n'agit jamais sur lui-même). Les deux
 * derniers pourcentages sont SOMMÉS puis appliqués en une seule fois, comme
 * les autres buffs de ce module (`buff()` plus bas) — pas composés en
 * plusieurs étapes multiplicatives.
 */
export function maVitCombat(stats: StatRow[], setup: DamageSetup, element: ElementKey | null = null, ampliVitPct = 0): number {
  const bonus = summonerSkillBonus(setup.summonerSkills, element);
  const row = stats.find((s) => s.key === 'spd');
  const base = row ? row.total + Math.ceil((row.base * bonus.pct.spd) / 100) : 0;
  // Miriam (« Blacksmith's Technique ») amplifie AUSSI le buff de VIT, en
  // plus d'un éventuel artéfact « Effet aug. VIT » (`ampliVitPct`) — les
  // deux sources se SOMMENT avant d'amplifier, comme plusieurs lignes
  // d'artéfact identiques le font déjà (voir `speedBuffAmpliPct`).
  const ampliMiriam = setup.miriamActif ? MIRIAM_AMPLIFY_PCT : 0;
  const pctBuff = setup.spdBuff ? SPD_BUFF_PCT * (1 + (ampliVitPct + ampliMiriam) / 100) : 0;
  const pctLeader = setup.leaderSpeedPct ?? 0;
  return (base * (100 + pctBuff + pctLeader)) / 100;
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
  ampliVitPct = 0
): { total: number; pvRestantsPct: number } {
  const bonus = summonerSkillBonus(setup.summonerSkills, element);
  // Compétences d'invocateur : un POURCENTAGE de la stat de BASE, ajouté au
  // total — même modèle que le totem de vitesse déjà en place (voir
  // `pctSpeedBonus`, speed.ts, et spec/mecaniques.md : le totem entre dans le
  // `Σ%vit` appliqué à la base, pas au total runé).
  // ⚠️ Ajouté APRÈS coup plutôt que fondu dans le `Σ%` de `computeStats` (qui
  // a déjà rendu ses totaux) : l'écart tient au double arrondi supérieur, au
  // plus 1 point sur la stat, sans effet sur un classement de builds.
  const avecInvocateur = (key: 'atk' | 'def' | 'hp' | 'spd') => {
    const row = stats.find((s) => s.key === key);
    if (!row) return 0;
    return row.total + Math.ceil((row.base * bonus.pct[key]) / 100);
  };
  const buff = (valeur: number, actif: boolean, pct: number) => (actif ? (valeur * (100 + pct)) / 100 : valeur);

  const pvMax = Math.max(0, setup.enemyHp);
  const pctDepart = Math.min(100, Math.max(0, pvCiblePctDepart ?? setup.enemyHpPct));

  const maVit = maVitCombat(stats, setup, element, ampliVitPct);
  // ⚠️ Bornée à 1 : une VIT adverse ≤ 0 ferait diverger le ratio (division
  // par zéro ou par un nombre négatif), un réglage vidé ne doit jamais casser
  // le calcul plutôt que produire `Infinity`/`NaN`.
  const vitEnnemie = Math.max(1, setup.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd!);

  // Miriam (« Blacksmith's Technique ») amplifie la MAGNITUDE des trois
  // buffs déjà actifs — jamais leur simple présence (`buff()` reste
  // conditionné à `setup.atkBuff`/`defBuff` ; `maVitCombat` fait de même en
  // interne pour la VIT).
  const ampliMiriam = setup.miriamActif ? MIRIAM_AMPLIFY_PCT : 0;
  const valeurs: Record<DamageVariable, number> = {
    ATK: buff(avecInvocateur('atk'), setup.atkBuff, ATK_BUFF_PCT * (1 + ampliMiriam / 100)),
    DEF: buff(avecInvocateur('def'), setup.defBuff, DEF_BUFF_PCT * (1 + ampliMiriam / 100)),
    SPD: maVit,
    'MAX HP': avecInvocateur('hp'),
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
  const cd = (total(stats, 'cd') + bonus.cdPoints + (setup.euldongActif ? EULDONG_CD_POINTS : 0)) / 100;
  // ⚠️ Taux Crit PLAFONNÉ à 100 % : `computeStats` renvoie volontairement le
  // total BRUT (un dépassement reste une marge légitime contre la résistance
  // adverse), mais au-delà de 100 % il ne rapporte plus aucun dégât en jeu.
  const cr = Math.min(total(stats, 'cr'), 100) / 100;
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
  // avec elle — confirmé par l'utilisateur.
  const reductions =
    1 + (setup.brand ? BRAND_BONUS_PCT / 100 : 0) + (setup.mirinaeActif ? MIRINAE_BONUS_PCT / 100 : 0);

  const horsCoup = critTerm * mitigation * reductions;
  const coups = resolvedHits(profile, setup);
  // Les PV ne peuvent pas descendre sous zéro, et une cible à 0 PV max (cas
  // dégénéré d'un réglage vidé) ne se creuse pas : on renvoie alors le
  // pourcentage de départ inchangé plutôt que de diviser par zéro.
  const creuse = (degats: number, pvCourant: number) => (pvMax > 0 ? Math.max(0, pvCourant - degats) : pvCourant);

  // Chemin COURT — le ratio ne dépend pas des PV de la cible : une seule
  // évaluation, exactement comme avant l'ajout de la simulation.
  if (!profile.variables.includes('Target Current HP %')) {
    const mult = evaluer(profile.noeud, valeurs);
    if (mult <= 0) return { total: 0, pvRestantsPct: pctDepart };
    const totalDegats = mult * horsCoup * coups;
    const pvApres = creuse(totalDegats, (pctDepart / 100) * pvMax);
    return { total: totalDegats, pvRestantsPct: pvMax > 0 ? (pvApres / pvMax) * 100 : pctDepart };
  }

  // Chemin SÉQUENTIEL — chaque coup frappe une cible plus basse que le
  // précédent, donc avec un ratio plus élevé.
  let pvCourant = (pctDepart / 100) * pvMax;
  let totalDegats = 0;
  for (let i = 0; i < coups; i++) {
    valeurs['Target Current HP %'] = pvMax > 0 ? pvCourant / pvMax : pctDepart / 100;
    const mult = evaluer(profile.noeud, valeurs);
    if (mult <= 0) continue;
    const degatsCoup = mult * horsCoup;
    totalDegats += degatsCoup;
    pvCourant = creuse(degatsCoup, pvCourant);
  }
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
 * comptée même bouton éteint (voir `bonusPassifActif`).
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
  bonusDegatsStack: BonusDegatsStackableProfile | null = null
): number {
  const ecartVit = maVitCombat(stats, setup, element, ampliVitPct) - Math.max(1, setup.enemySpd ?? DEFAULT_DAMAGE_SETUP.enemySpd!);
  const forceCrit = critSiPlusRapide && ecartVit > 0;
  const setupSort = forceCrit ? { ...setup, critMode: 'crit' as const } : setup;
  // ⚠️ Les PV de la cible sont ENCHAÎNÉS du sort actif vers les passifs :
  // ceux-ci frappent après lui, sur une cible déjà entamée. C'est ce qui
  // permet à un bonus « si les PV sont tombés sous X % » (Final Strike) de
  // se déduire tout seul, sans rien demander à l'utilisateur.
  const sort = computeSkillDamageDetail(profile, stats, setupSort, element, undefined, ampliVitPct);
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
    const detail = computeSkillDamageDetail(profilPassif, stats, setupPassif, element, pvCiblePct, ampliVitPct);
    pvCiblePct = detail.pvRestantsPct;
    let contribution = detail.total;
    if (seuilAtteint && p.bonusPvCible) contribution *= 1 + p.bonusPvCible.pct / 100;
    if (bonusPassifActif(p, setup) && p.categorie.type === 'bonus') {
      contribution *= 1 + p.categorie.pct / 100;
    }
    total += contribution;
  }
  // ⚠️ Multiplicatif sur le TOTAL (sort actif + tous les passifs), APRÈS
  // coup — « the damage dealt increases », un modificateur sur l'ensemble de
  // ce que le monstre inflige, pas une contribution à part (contrairement à
  // `bonusPvCible`/`bonus`, propres à UN passif précis).
  if (bonusDegatsSelonVit) {
    const pct = Math.min(bonusDegatsSelonVit.pctMax, Math.max(0, ecartVit)) * (bonusDegatsSelonVit.pctMax / bonusDegatsSelonVit.ecartMax);
    total *= 1 + pct / 100;
  }
  // Même famille que `bonusDegatsSelonVit` (multiplicatif sur le TOTAL,
  // après coup) — seule la SOURCE du pourcentage change : saisie par
  // l'utilisateur (`resolvedStackPct`) plutôt que déduite de la VIT.
  if (bonusDegatsStack) total *= 1 + resolvedStackPct(bonusDegatsStack, setup) / 100;
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
  bonusDegatsSelonVit: { ecartMax: number; pctMax: number } | null = null
): StatKey[] {
  // Sans sort résolu (fiche absente, sort non pris en charge), on retombe sur
  // le biais de l'objectif « Dégâts » — le cas de très loin le plus fréquent.
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
  for (const p of passifs) {
    if (!passifActif(p, setup)) continue;
    ajouter(p.profile.variables);
    // `'toujours'` compte AUSSI : ce composant critique à coup sûr, donc les
    // Dgts Crit pèsent sur lui plus encore que sur un sort ordinaire.
    if (!p.profile.fixed && p.critique !== 'jamais') peutCriter = true;
  }
  if (critSiPlusRapide || bonusDegatsSelonVit) {
    if (!keys.includes('spd')) keys.push('spd');
  }
  // Le critique forcé change la donne — mais SEULEMENT lui : le bonus continu
  // de Sonia multiplie le total quel que soit son mode de critique, il ne le
  // FORCE pas.
  if (critSiPlusRapide) peutCriter = true;
  if (peutCriter) keys.push('cd');
  return keys;
}
