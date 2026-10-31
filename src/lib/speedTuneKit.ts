// Ce que le KIT d'un monstre pose sur son camp quand il joue : remplissage de
// barre d'attaque et buff de vitesse. Lu dans les compétences pré-générées
// (public/data/skills, voir monsterSkills.ts) — l'utilisateur n'a pas à aller
// chercher lui-même ce que fait le monstre.
//
// Calcul PUR : la fonction prend le détail déjà chargé, elle ne va rien chercher.
// Voir docs/02-app/speed-tuning/, « Compétences ».

import { Competence, DetailMonstre, paliersRechargement } from './monsterSkills';
import { EffetSort } from './speedTune';

// Le buff de vitesse du jeu vaut toujours +30 % ; les données SWARFARM ne
// donnent, pour « Increase ATK SPD », que sa DURÉE en tours (`quantite`).
export const BUFF_SPD_JEU = 30;

// Noms d'effets SWARFARM (ils ne sont pas traduits dans les données).
const EFFET_ATB = 'Increase ATB';
const EFFET_SPD = 'Increase ATK SPD';
// « Gains a turn instantly after using this skill » (Owl's Hoot de Kroa…) : le
// monstre REJOUE dans la foulée, sans qu'un tick ne passe.
const EFFET_REJOUE = 'Additional Turn';
const EFFET_ATB_MOINS = 'Decrease ATB';
const EFFET_SPD_MOINS = 'Decrease ATK SPD';

// Le ralenti du jeu vaut −30 % de vitesse, comme le buff en vaut +30 ; les
// données SWARFARM ne donnent là encore que sa DURÉE en tours.
export const RALENTI_SPD_JEU = 30;

// ⚠️ **La valeur donnée par SWARFARM est celle du NIVEAU 1**, comme pour les
// rechargements (voir `paliersCooldown` dans monsterSkills.ts). On compte la
// compétence MAXÉE — c'est maxée qu'on la joue, et c'est sur cette valeur que le
// speed tune se règle.
//
// ⚠️ **Les skill-ups « Attack Bar Recovery +N% » MULTIPLIENT la valeur, ils ne
// s'y ajoutent pas** (règle du jeu donnée par l'utilisateur, comme pour les
// soins) : le Trade de Conrad remplit 20 % au niveau 1 et **23 %** maxé
// (20 × 1,15), pas 35 %. Les additionner surestimait chaque boost monté — le
// Tailwind de Bernard 2A passait pour 45 % au lieu de 34,5 %.
//
// ⚠️ Hypothèse retenue : les améliorations se SOMMENT, puis s'appliquent une
// fois (× (1 + Σ/100)), comme les autres skill-ups du jeu. Composées une à une,
// elles donneraient 23,15 % pour Conrad et 34,65 % pour Bernard — un écart
// qu'un relevé en jeu au dixième départagerait.
const SKILL_UP_ATB = /Attack Bar Recovery \+(\d+)\s*%/i;

function bonusSkillUp(c: Competence): number {
  let total = 0;
  for (const a of c.ameliorations) {
    const m = SKILL_UP_ATB.exec(a);
    if (m) total += Number(m[1]);
  }
  return total;
}

// La valeur MAXÉE d'un remplissage de barre, à partir de celle du niveau 1.
// Écrit `n + n × b / 100` et non `n × (1 + b / 100)` : 1,15 n'a pas d'écriture
// binaire exacte, et 30 × 1,15 donnerait 34,499999… au lieu de 34,5.
const maxee = (niveau1: number, bonus: number) => niveau1 + (niveau1 * bonus) / 100;

// Un pourcentage de barre pour l'écran : au dixième, virgule décimale. La
// valeur maxée n'est plus un entier (34,5 % pour Bernard) ; la simulation garde
// la valeur exacte, seul l'affichage arrondit.
export const pourcentBarre = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export interface KitVitesse {
  // +% de barre d'attaque posé à TOUT son camp (0 = aucun), compétence MAXÉE,
  // et la compétence d'où ça vient.
  atb: number;
  atbCompetence: string | null;
  // La valeur au niveau 1, et les POINTS de barre que les skill-ups y ajoutent
  // (`atb − atbNiveau1`, pas leur pourcentage). `atbSkillUp > 0`
  // veut dire que le chiffre retenu SUPPOSE la compétence montée — l'écran doit
  // le dire, sans quoi on règle sa vitesse sur un gain qu'on n'a pas encore.
  atbNiveau1: number;
  atbSkillUp: number;
  // +% de vitesse posé à tout son camp (0 ou 30).
  buff: number;
  buffCompetence: string | null;
  // Une des compétences retenues rend son tour au lanceur (voir SortVitesse).
  rejoue: boolean;
}

// Une compétence du kit telle qu'on peut la LANCER dans l'analyse poussée : son
// nom, ce qu'elle fait à la barre et à la vitesse (cible par cible), et le taux
// de réussite quand elle en a un.
//
// ⚠️ **TOUTES les compétences non passives sont listées**, y compris celles qui
// ne touchent ni la barre ni la vitesse : on doit pouvoir dire « à ce tour-là il
// lance son S1 » — c'est le sens même d'un ordre de sorts.
export interface SortVitesse {
  nom: string;
  slot: number | null;
  // Icône de la compétence, servie par SWARFARM (même source que la fiche
  // monstre). `null` quand les données ne l'ont pas.
  icone: string | null;
  effet: EffetSort;
  // Ce que la compétence rend au lanceur : un tour de plus, aussitôt.
  rejoue: boolean;
  // Rechargement de la compétence MAXÉE, en tours du lanceur (0 = aucun, elle
  // repart à chaque tour). ⚠️ Le `cooldown` de SWARFARM est celui du niveau 1 ;
  // les « Cooltime Turn -1 » le réduisent (voir `paliersRechargement`), et c'est
  // maxée qu'on la joue.
  cooldown: number;
  // Détail du remplissage de barre pour l'écran : valeur au niveau 1 et apport
  // des skill-ups (« Attack Bar Recovery +N% »).
  atbNiveau1: number;
  atbSkillUp: number;
  // Taux de réussite de l'effet de barre/vitesse, `null` s'il est garanti.
  // ⚠️ La simulation applique l'effet COMME S'IL PASSAIT : un speed tune se
  // règle sur le cas où le sort fait ce qu'on attend.
  chance: number | null;
  // Vrai si la compétence ne touche ni la barre ni la vitesse (elle reste
  // proposable : c'est un tour où l'on ne fait rien pour le tune).
  neutre: boolean;
  // Remplissage d'équipe dont la valeur DÉPEND DU COMBAT, à désigner : `n`
  // paliers de `pas` %, `n` de 0 à `max`. `retrait` : n buffs retirés à
  // l'adverse (Blade Fan : 15 % chacun, trois au plus) ; `pourcent` : n % de
  // barre (Start of Attacking : 0 à 50). ⚠️ Absent de `effet` : il ne compte
  // que pour le nombre désigné (`effetAuChoix`), zéro par défaut.
  atbAuChoix?: { pas: number; max: number; unite: 'retrait' | 'pourcent' };
  // ⚠️ Combien de BUFFS elle pose sur son camp (bouclier, immunité, ATQ/DEF,
  // buff de vitesse…). Ça n'a rien à voir avec la vitesse — mais certains
  // passifs COMPTENT les buffs portés (Chilling : +20 de vitesse par buff), et
  // c'est la seule façon d'estimer ce compte sans le demander.
  buffsEquipe: number;
}

export const KIT_VIDE: KitVitesse = {
  atb: 0,
  atbCompetence: null,
  atbNiveau1: 0,
  atbSkillUp: 0,
  buff: 0,
  buffCompetence: null,
  rejoue: false,
};

// ⚠️ **Seuls les effets DE ZONE** (`aoe`) sont retenus : le modèle de l'outil
// applique un effet à tout le camp, y poser un « remplit TA barre » ou un boost
// sur UN allié gonflerait toute l'équipe.
//
// ⚠️⚠️ **`aoe` et `surSoi` ne s'excluent PAS.** `aoe + surSoi` veut dire « tout le
// camp, LUI COMPRIS » — c'est le cas normal d'un boost d'équipe. Écarter tout ce
// qui portait `surSoi` faisait manquer le S3 de Jeogun, qui remplit la barre de
// tous les alliés.
//
// ⚠️ **Les compétences PASSIVES sont écartées** : elles ne se déclenchent pas au
// tour du monstre mais sur une condition (quand il est attaqué, à la mort d'un
// allié…), que la simulation ne modélise pas.
//
// ⚠️ **Le plus FORT l'emporte** quand plusieurs compétences remplissent la barre :
/* --------------------------------------------------------------------------
 * Boosts de barre CONDITIONNELS
 *
 * ⚠️ **Un boost sous condition ne se compte pas dans un speed tune.** Le S2 de
 * Sylvia dit : « … removes all beneficial effects on the target. **If** there
 * are 2 or more beneficial effects removed, the Attack Bar of all allies will be
 * increased by 20% each. » L'action a lieu, mais le boost ne suit que si la
 * condition tombe — et un speed tune est ce qui tient SANS rien attendre de
 * l'adverse. L'annoncer, c'est promettre un tick qu'on n'aura pas toujours.
 *
 * ⚠️ **Ni la `chance` ni un « if » quelque part dans le texte ne suffisent.**
 * Mesuré sur les 498 effets « Increase ATB » du corpus : 269 portent
 * `chance: 0` alors que 220 d'entre eux n'ont aucune condition — le champ ne
 * veut rien dire ici. Et 145 compétences contiennent un « if » qui gouverne le
 * plus souvent une AUTRE phrase que celle du boost. Seule la phrase qui porte
 * l'augmentation fait foi.
 *
 * ⚠️ **On n'écarte que si TOUTES les phrases d'augmentation sont conditionnelles.**
 * Deux compétences du corpus (Mega Impulse Gun) mêlent une phrase conditionnelle
 * et une autre qui ne l'est pas : leur boost reste annoncé. Écarter au premier
 * « if » les aurait fait disparaître à tort.
 * ----------------------------------------------------------------------- */

const PHRASES = (t: string) => t.split(/(?<=\.)\s+/).filter(Boolean);
const PARLE_DE_BARRE = /attack bar/i;
const AUGMENTE = /increas|recover|fill|restor/i;
const CONDITION = /\bif\b/i;
// ⚠️ Une action déclarée IRRÉSISTIBLE se produit toujours : la condition qu'elle
// porte est donc toujours remplie, et le boost qui en dépend est acquis.
// Aucun cas dans le corpus actuel — 64 compétences emploient le mot, aucune
// n'est parmi les 112 boosts conditionnels. La règle est là pour le jour où.
const IRRESISTIBLE = /irresistible|can(not|'t) be resisted/i;

function boostAtbConditionnel(c: Competence): boolean {
  const texte = (c.description ?? '').replace(/\s+/g, ' ');
  if (!texte || IRRESISTIBLE.test(texte)) return false;
  const ph = PHRASES(texte).filter((p) => PARLE_DE_BARRE.test(p) && AUGMENTE.test(p));
  return ph.length > 0 && ph.every((p) => CONDITION.test(p));
}

// Remplissages de barre DE ZONE que SWARFARM marque `aoe: false`, par
// identifiant de compétence. ⚠️ **Une exception aux données, pas une liste
// blanche** : la règle reste le drapeau `aoe` ; cette table ne rattrape que les
// fiches infidèles, relevées en balayant les 380 compétences « Increase ATB » du
// corpus contre leur prose. Sans elle, le boost d'équipe partait sur UN allié,
// celui à la barre la plus basse, et l'analyse simple ne le voyait pas du tout.
const ATB_DE_ZONE_CONNUS = new Map<number, string>([
  // Conrad, Death Knight : « … increases the Attack Bar of all allies by 20%. »
  [7414, 'Trade'],
  // Mephisto, Demon : « Recovers the Attack Bar of all allies by 20% afterwards. »
  [13408, "Devil's Bargain"],
]);

// Remplissages de barre d'équipe dont la valeur DÉPEND DU COMBAT, par
// identifiant de compétence. ⚠️ **Curé par identifiant, pas lu dans la
// prose** : « per beneficial effect removed », « up to … in proportion to the
// HP lost » ne se reconnaissent pas sans se tromper, et les bornes ne sont pas
// toutes en donnée.
//
// ⚠️ **Le défaut est ZÉRO** : ce que le sort donne dépend de l'adverse (ses
// buffs, ses PV) et de jets — un speed tune est ce qui tient sans rien en
// attendre. Le joueur désigne la valeur dans l'ordre des sorts ; l'analyse
// simple, qui n'a pas ce choix, n'en compte aucune.
//
// `retrait` : la donnée donne le gain PAR retrait, la table le nombre maximal.
// `pourcent` : la donnée donne le gain MAXIMAL, choisi au pour cent près.
type AuChoix = { nom: string; unite: 'retrait'; max: number } | { nom: string; unite: 'pourcent' };
const ATB_AU_CHOIX_CONNUS = new Map<number, AuChoix>([
  // Mihyang : « Increases the Attack Bar of all allies by 15% each per
  // beneficial effect removed. » Trois coups, 50 % de retrait chacun.
  [9118, { nom: 'Blade Fan', unite: 'retrait', max: 3 }],
  // Barbara : « … increases the Attack Bar of other allies by up to 50% in
  // proportion to the HP the enemy lost from this attack. » ⚠️ Compté pour
  // TOUT le camp, lanceur compris, malgré « other allies » : règle donnée par
  // l'utilisateur, pas un relevé.
  [13611, { nom: 'Start of Attacking', unite: 'pourcent' }],
]);

const auChoixDe = (c: Competence) =>
  c.com2usId != null ? ATB_AU_CHOIX_CONNUS.get(c.com2usId) ?? null : null;

// L'effet d'un sort pour `n` paliers désignés : rien de plus qu'un sort
// ordinaire, sauf s'il remplit la barre au choix. Borné à [0, max].
export function effetAuChoix(x: SortVitesse, n: number): EffetSort {
  const p = x.atbAuChoix;
  const k = p ? Math.max(0, Math.min(p.max, Math.round(n))) : 0;
  if (!p || k === 0) return x.effet;
  return { ...x.effet, atbEquipe: Math.max(x.effet.atbEquipe ?? 0, k * p.pas) };
}

// L'effet de barre va-t-il à tout le camp ? Le drapeau de la fiche, ou la table.
const atbDeZone = (c: Competence, e: Competence['effets'][number]) =>
  e.aoe || (e.nom === EFFET_ATB && c.com2usId != null && ATB_DE_ZONE_CONNUS.has(c.com2usId));

// c'est celle qu'on joue pour lancer le combo. Les champs restent modifiables à
// la main — la détection propose, elle n'impose pas.
export function kitVitesse(detail: DetailMonstre | null): KitVitesse {
  if (!detail) return KIT_VIDE;
  const out: KitVitesse = { ...KIT_VIDE };
  for (const c of detail.competences) {
    if (c.passif) continue;
    const rejoue = c.effets.some((e) => e.nom === EFFET_REJOUE);
    // Un boost sous condition ne se propose pas (voir `boostAtbConditionnel`).
    const atbSousCondition = boostAtbConditionnel(c);
    for (const e of c.effets) {
      if (!atbDeZone(c, e)) continue;
      if (e.nom === EFFET_ATB) {
        // Au choix : zéro par défaut, et l'analyse simple n'a pas le choix.
        if (atbSousCondition || auChoixDe(c)) continue;
        const niveau1 = e.quantite ?? 0;
        const valeur = maxee(niveau1, bonusSkillUp(c));
        if (valeur > out.atb) {
          out.atb = valeur;
          out.atbNiveau1 = niveau1;
          out.atbSkillUp = valeur - niveau1;
          out.atbCompetence = c.nom;
          if (rejoue) out.rejoue = true;
        }
      } else if (e.nom === EFFET_SPD && out.buff === 0) {
        out.buff = BUFF_SPD_JEU;
        out.buffCompetence = c.nom;
        if (rejoue) out.rejoue = true;
      }
    }
  }
  return out;
}

// Ce qu'une compétence fait à la barre et à la vitesse, cible par cible.
function lireEffet(c: Competence): { effet: EffetSort; atbNiveau1: number; atbSkillUp: number; chance: number | null } {
  const effet: EffetSort = {};
  let atbNiveau1 = 0;
  let chance: number | null = null;
  const skillUp = bonusSkillUp(c);
  // Un boost sous condition n'entre pas dans la simulation : un speed tune est
  // ce qui tient sans rien attendre (voir `boostAtbConditionnel`).
  const atbSousCondition = boostAtbConditionnel(c);

  for (const e of c.effets) {
    const q = e.quantite ?? 0;
    switch (e.nom) {
      case EFFET_ATB: {
        // Au choix : porté à part (`atbAuChoix`), il ne compte que pour la
        // valeur désignée.
        if (atbSousCondition || auChoixDe(c)) break;
        // ⚠️ Trois cibles bien différentes : tout le camp, UN allié (Breeze de
        // Kroa : celui dont la barre est la plus basse), ou soi-même.
        //
        // ⚠️⚠️ **`aoe` SE LIT EN PREMIER, `surSoi` seulement ensuite.** Les deux
        // ne s'excluent pas : `aoe + surSoi` veut dire « tout le camp, LUI
        // COMPRIS » — c'est le cas normal d'un boost d'équipe, pas un boost sur
        // soi. Tester `surSoi` d'abord rangeait le S3 de Jeogun (« increases …
        // their Attack Bar by 10% » pour tous les alliés) dans « lui seul » : le
        // reste de l'équipe ne recevait rien.
        //
        // ⚠️ **`quantite = 0` = remplit à 100 %** : convention SWARFARM pour les
        // sorts qui remplissent la barre entièrement (ex. Rabbit's Agility de
        // Dova). Stocker 0 rendrait le champ falsy et la simulation ignorerait
        // complètement le remplissage.
        const qEff = q === 0 ? 100 : q;
        const v = maxee(qEff, skillUp);
        atbNiveau1 = Math.max(atbNiveau1, qEff);
        if (atbDeZone(c, e)) effet.atbEquipe = Math.max(effet.atbEquipe ?? 0, v);
        else if (e.surSoi) effet.atbSoi = Math.max(effet.atbSoi ?? 0, v);
        else effet.atbAllie = Math.max(effet.atbAllie ?? 0, v);
        chance = e.chance && e.chance > 0 && e.chance < 100 ? e.chance : chance;
        break;
      }
      case EFFET_ATB_MOINS:
        effet.atbEnnemi = Math.max(effet.atbEnnemi ?? 0, q);
        if (e.aoe) effet.atbEnnemiTous = true;
        chance = e.chance && e.chance > 0 && e.chance < 100 ? e.chance : chance;
        break;
      case EFFET_SPD:
        // Même règle que pour la barre : de zone = tout le camp, lui compris.
        //
        // ⚠️ `aoe=false, surSoi=false` = buff sur UN allié CIBLÉ (Rabbit's
        // Agility de Racuni / Harg / Dova). Il allait d'abord dans `buffSoi`,
        // à tort — le lanceur héritait d'un buff qu'il donnait — puis a été
        // purement ignoré. Les deux étaient faux : le sort remplit la barre de
        // sa cible ET la buffe, et `buffAllie` part sur la MÊME cible que
        // `atbAllie`. L'ignorer plaçait bien le tour suivant de la cible, et
        // tous les autres trop tard.
        if (e.aoe) effet.buffEquipe = BUFF_SPD_JEU;
        else if (e.surSoi) effet.buffSoi = BUFF_SPD_JEU;
        else effet.buffAllie = BUFF_SPD_JEU;
        break;
      case EFFET_SPD_MOINS:
        effet.ralenti = RALENTI_SPD_JEU;
        if (e.aoe) effet.ralentiTous = true;
        chance = e.chance && e.chance > 0 && e.chance < 100 ? e.chance : chance;
        break;
      default:
        break;
    }
  }
  return { effet, atbNiveau1, atbSkillUp: atbNiveau1 > 0 ? maxee(atbNiveau1, skillUp) - atbNiveau1 : 0, chance };
}

// TOUTES les compétences lançables du monstre (les passives exclues : elles ne
// partent pas à son tour), avec ce qu'elles posent. C'est la liste de l'analyse
// poussée — on doit pouvoir désigner n'importe quel sort, même sans effet de
// vitesse.
export function sortsVitesse(detail: DetailMonstre | null): SortVitesse[] {
  if (!detail) return [];
  const out: SortVitesse[] = [];
  for (const c of detail.competences) {
    if (c.passif) continue;
    const { effet, atbNiveau1, atbSkillUp, chance } = lireEffet(c);
    const auChoix = auChoixDe(c);
    const effetAtb = c.effets.find((e) => e.nom === EFFET_ATB);
    const valeur = effetAtb ? maxee(effetAtb.quantite ?? 0, bonusSkillUp(c)) : 0;
    const atbAuChoix: SortVitesse['atbAuChoix'] =
      !auChoix || !effetAtb
        ? undefined
        : auChoix.unite === 'retrait'
          ? { pas: valeur, max: auChoix.max, unite: 'retrait' }
          : { pas: 1, max: Math.floor(valeur), unite: 'pourcent' };
    const neutre = Object.keys(effet).length === 0 && !atbAuChoix;
    out.push({
      nom: c.nom,
      slot: c.slot,
      icone: c.icone,
      cooldown: (() => {
        const paliers = paliersRechargement(c);
        return paliers.length > 0 ? paliers[paliers.length - 1] : 0;
      })(),
      effet,
      rejoue: c.effets.some((e) => e.nom === EFFET_REJOUE),
      atbNiveau1,
      atbSkillUp,
      chance,
      neutre,
      // ⚠️ `bonus && aoe` suffit : un effet BÉNÉFIQUE de zone va sur les alliés,
      // que le lanceur en profite (`surSoi`) ou non. Exclure `surSoi` faisait
      // manquer les buffs d'équipe les plus courants au comptage du passif.
      buffsEquipe: c.effets.filter((e) => e.bonus && e.aoe).length,
      ...(atbAuChoix ? { atbAuChoix } : {}),
    });
  }
  return out;
}
