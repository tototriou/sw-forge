// Ce que le KIT d'un monstre pose sur son camp quand il joue : remplissage de
// barre d'attaque et buff de vitesse. Lu dans les compétences pré-générées
// (public/data/skills, voir monsterSkills.ts) — l'utilisateur n'a pas à aller
// chercher lui-même ce que fait le monstre.
//
// Calcul PUR : la fonction prend le détail déjà chargé, elle ne va rien chercher.
// Voir spec/outils/speed-tuning.md, « Compétences ».

import { Competence, DetailMonstre } from './monsterSkills';
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
// rechargements (voir `paliersCooldown` dans monsterSkills.ts). Les skill-ups
// « Attack Bar Recovery +N% » s'y AJOUTENT : le Tailwind de Bernard 2A remplit
// 30 % au niveau 1 et **45 %** maxé (+5 puis +10). On compte la compétence
// MAXÉE — c'est maxée qu'on la joue, et c'est sur cette valeur que le speed tune
// se règle.
const SKILL_UP_ATB = /Attack Bar Recovery \+(\d+)\s*%/i;

function bonusSkillUp(c: Competence): number {
  let total = 0;
  for (const a of c.ameliorations) {
    const m = SKILL_UP_ATB.exec(a);
    if (m) total += Number(m[1]);
  }
  return total;
}

export interface KitVitesse {
  // +% de barre d'attaque posé à TOUT son camp (0 = aucun), compétence MAXÉE,
  // et la compétence d'où ça vient.
  atb: number;
  atbCompetence: string | null;
  // La valeur au niveau 1, et ce que les skill-ups ajoutent. `atbSkillUp > 0`
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

// ⚠️ **Seuls les effets DE ZONE sur les alliés** (`aoe`) sont retenus : le
// modèle de l'outil applique un effet à tout le camp, y poser un « remplit TA
// barre » (`surSoi`) ou un boost sur UN allié gonflerait toute l'équipe.
//
// ⚠️ **Les compétences PASSIVES sont écartées** : elles ne se déclenchent pas au
// tour du monstre mais sur une condition (quand il est attaqué, à la mort d'un
// allié…), que la simulation ne modélise pas.
//
// ⚠️ **Le plus FORT l'emporte** quand plusieurs compétences remplissent la barre :
// c'est celle qu'on joue pour lancer le combo. Les champs restent modifiables à
// la main — la détection propose, elle n'impose pas.
export function kitVitesse(detail: DetailMonstre | null): KitVitesse {
  if (!detail) return KIT_VIDE;
  const out: KitVitesse = { ...KIT_VIDE };
  for (const c of detail.competences) {
    if (c.passif) continue;
    const rejoue = c.effets.some((e) => e.nom === EFFET_REJOUE);
    for (const e of c.effets) {
      if (!e.aoe || e.surSoi) continue;
      if (e.nom === EFFET_ATB) {
        const niveau1 = e.quantite ?? 0;
        const skillUp = bonusSkillUp(c);
        if (niveau1 + skillUp > out.atb) {
          out.atb = niveau1 + skillUp;
          out.atbNiveau1 = niveau1;
          out.atbSkillUp = skillUp;
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

  for (const e of c.effets) {
    const q = e.quantite ?? 0;
    switch (e.nom) {
      case EFFET_ATB: {
        // ⚠️ Trois cibles bien différentes : tout le camp, UN allié (Breeze de
        // Kroa : celui dont la barre est la plus basse), ou soi-même.
        const v = q + skillUp;
        atbNiveau1 = Math.max(atbNiveau1, q);
        if (e.aoe && !e.surSoi) effet.atbEquipe = Math.max(effet.atbEquipe ?? 0, v);
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
        if (e.aoe && !e.surSoi) effet.buffEquipe = BUFF_SPD_JEU;
        else effet.buffSoi = BUFF_SPD_JEU;
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
  return { effet, atbNiveau1, atbSkillUp: atbNiveau1 > 0 ? skillUp : 0, chance };
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
    const neutre = Object.keys(effet).length === 0;
    out.push({
      nom: c.nom,
      slot: c.slot,
      icone: c.icone,
      effet,
      rejoue: c.effets.some((e) => e.nom === EFFET_REJOUE),
      atbNiveau1,
      atbSkillUp,
      chance,
      neutre,
    });
  }
  return out;
}
