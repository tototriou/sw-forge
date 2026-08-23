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
export const ATK_BUFF_PCT = 50;
export const DEF_BUFF_PCT = 70;
export const SPD_BUFF_PCT = 30;
// Réduction de défense (« def break ») : la DEF de la cible est multipliée
// par ce facteur.
export const DEF_BREAK_FACTOR = 0.3;
// Marque (« Branding ») : +25 % de dégâts subis. Additif dans le terme
// « Réductions » de l'équation finale, pas un multiplicateur du DMG%.
export const BRAND_BONUS_PCT = 25;

// ── Formules de compétence ───────────────────────────────────────────────
// Les variables que ce module sait évaluer. Toute autre variable rencontrée
// (`{Relative SPD}`, `{Attacker's Level}`, `ABSORPTION_TOT_CNT`…) rend le
// sort NON PRIS EN CHARGE — mieux vaut le dire que produire un nombre
// plausible mais faux.
export type DamageVariable = 'ATK' | 'DEF' | 'SPD' | 'MAX HP' | 'Target MAX HP' | 'Target Current HP %';

const SUPPORTED_VARIABLES: DamageVariable[] = ['ATK', 'DEF', 'SPD', 'MAX HP', 'Target MAX HP', 'Target Current HP %'];

// Stat de l'attaquant derrière chaque variable qui en est une — sert à savoir
// quelles stats du build la recherche doit privilégier (voir
// `damageRelevantStats`). Les variables de CIBLE n'y figurent pas : elles ne
// dépendent pas des runes.
const VARIABLE_STAT: Partial<Record<DamageVariable, StatKey>> = {
  ATK: 'atk',
  DEF: 'def',
  SPD: 'spd',
  'MAX HP': 'hp',
};

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
  hits: number;
  aoe: boolean;
  ignoreDef: boolean;
  // Dégâts FIXES (marqueur `(Fixed)` de SWARFARM) : ne peuvent pas être
  // critiques et ne passent PAS par le facteur de défense (voir
  // spec/mecaniques.md, terme « Additionnel »).
  fixed: boolean;
  // Somme des « Damage +X% » des améliorations de compétence, en points de
  // pourcentage — la compétence est supposée MAXÉE, comme partout ailleurs
  // dans l'app (voir `paliersRechargement`, même parti pris).
  skillupDamagePct: number;
  variables: DamageVariable[];
  noeud: Noeud;
}

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

  return {
    ...entete,
    icone: c.icone,
    formule: brut,
    // `coups` vaut `null` sur quelques fiches : un sort qui inflige des
    // dégâts en frappe au moins une fois.
    hits: c.coups && c.coups > 0 ? c.coups : 1,
    aoe: c.aoe,
    ignoreDef: c.effets.some((e) => e.nom === 'Ignore DEF'),
    fixed,
    skillupDamagePct,
    variables: analyse.variables,
    noeud: analyse.noeud,
  };
}

export function estPrisEnCharge(p: SkillDamageProfile | SkillDamageUnsupported): p is SkillDamageProfile {
  return 'noeud' in p;
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
  atkBuff: boolean;
  defBuff: boolean;
  spdBuff: boolean;
  defBreak: boolean;
  brand: boolean;
  critMode: CritMode;
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
  atkBuff: false,
  defBuff: false,
  spdBuff: false,
  defBreak: false,
  brand: false,
  critMode: 'moyenne',
};

// ── Le calcul ────────────────────────────────────────────────────────────

function total(stats: StatRow[], key: StatKey): number {
  return stats.find((s) => s.key === key)?.total ?? 0;
}

/**
 * Dégâts totaux du sort (tous coups confondus) pour un build donné.
 *
 * Suit l'équation de spec/mecaniques.md :
 *   `(Mult × Crit × FacteurDéf + Additionnel) × Réductions`
 * — `DMG%` et `Variance` valent 1 en v1 (voir l'en-tête du fichier), et un
 * sort à dégâts FIXES passe par la branche « Additionnel » : ni critique, ni
 * facteur de défense.
 */
export function computeSkillDamage(profile: SkillDamageProfile, stats: StatRow[], setup: DamageSetup): number {
  const buff = (valeur: number, actif: boolean, pct: number) => (actif ? (valeur * (100 + pct)) / 100 : valeur);

  const valeurs: Record<DamageVariable, number> = {
    ATK: buff(total(stats, 'atk'), setup.atkBuff, ATK_BUFF_PCT),
    DEF: buff(total(stats, 'def'), setup.defBuff, DEF_BUFF_PCT),
    SPD: buff(total(stats, 'spd'), setup.spdBuff, SPD_BUFF_PCT),
    'MAX HP': total(stats, 'hp'),
    'Target MAX HP': Math.max(0, setup.enemyHp),
    // Exprimé en FRACTION (0-1) : le corpus l'écrit toujours multiplié par un
    // coefficient (`{ATK}*(2-1*{Target Current HP %})`), jamais en points.
    'Target Current HP %': Math.min(100, Math.max(0, setup.enemyHpPct)) / 100,
  };

  const mult = evaluer(profile.noeud, valeurs);
  if (mult <= 0) return 0;

  // Terme de dégâts critiques. Les améliorations de compétence s'y ajoutent
  // (elles s'appliquent que le coup soit critique ou non) — voir
  // spec/mecaniques.md, terme « Crit ».
  const cd = total(stats, 'cd') / 100;
  // ⚠️ Taux Crit PLAFONNÉ à 100 % : `computeStats` renvoie volontairement le
  // total BRUT (un dépassement reste une marge légitime contre la résistance
  // adverse), mais au-delà de 100 % il ne rapporte plus aucun dégât en jeu.
  const cr = Math.min(total(stats, 'cr'), 100) / 100;
  const partCrit = profile.fixed ? 0 : setup.critMode === 'crit' ? 1 : setup.critMode === 'normal' ? 0 : cr;
  const critTerm = 1 + profile.skillupDamagePct / 100 + partCrit * cd;

  const defEff = profile.ignoreDef ? 0 : Math.max(0, setup.enemyDef) * (setup.defBreak ? DEF_BREAK_FACTOR : 1);
  const mitigation = profile.fixed ? 1 : defenseFactor(defEff);

  const reductions = 1 + (setup.brand ? BRAND_BONUS_PCT / 100 : 0);

  return mult * critTerm * mitigation * reductions * profile.hits;
}

/**
 * Les stats du build que ce sort fait RÉELLEMENT travailler — ce que la
 * recherche doit privilégier dès le pré-filtrage (voir
 * `OBJECTIVE_RELEVANT_STATS` dans runeBuildOptim.ts).
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
 */
export function damageRelevantStats(profile: SkillDamageProfile | null): StatKey[] {
  // Sans sort résolu (fiche absente, sort non pris en charge), on retombe sur
  // le biais de l'objectif « Dégâts » — le cas de très loin le plus fréquent.
  if (!profile) return ['atk', 'cd'];
  const keys: StatKey[] = [];
  for (const v of profile.variables) {
    const k = VARIABLE_STAT[v];
    if (k && !keys.includes(k)) keys.push(k);
  }
  // Les dégâts fixes ne critent pas : les Dgts Crit n'y changent rien.
  if (!profile.fixed) keys.push('cd');
  return keys;
}
