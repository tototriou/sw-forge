// Ce que le KIT d'un monstre pose sur son camp quand il joue : remplissage de
// barre d'attaque et buff de vitesse. Lu dans les compétences pré-générées
// (public/data/skills, voir monsterSkills.ts) — l'utilisateur n'a pas à aller
// chercher lui-même ce que fait le monstre.
//
// Calcul PUR : la fonction prend le détail déjà chargé, elle ne va rien chercher.
// Voir spec/outils/speed-tuning.md, « Compétences ».

import { Competence, DetailMonstre } from './monsterSkills';

// Le buff de vitesse du jeu vaut toujours +30 % ; les données SWARFARM ne
// donnent, pour « Increase ATK SPD », que sa DURÉE en tours (`quantite`).
export const BUFF_SPD_JEU = 30;

// Noms d'effets SWARFARM (ils ne sont pas traduits dans les données).
const EFFET_ATB = 'Increase ATB';
const EFFET_SPD = 'Increase ATK SPD';

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
}

// Une compétence du kit telle qu'on peut la LANCER dans l'analyse poussée : ce
// qu'elle pose sur le camp, et sous quel nom on la choisit.
export interface SortVitesse {
  nom: string;
  atb: number; // +% de barre sur le camp (compétence maxée)
  atbNiveau1: number;
  atbSkillUp: number;
  buff: number; // +% de vitesse sur le camp (0 ou 30)
}

export const KIT_VIDE: KitVitesse = {
  atb: 0,
  atbCompetence: null,
  atbNiveau1: 0,
  atbSkillUp: 0,
  buff: 0,
  buffCompetence: null,
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
        }
      } else if (e.nom === EFFET_SPD && out.buff === 0) {
        out.buff = BUFF_SPD_JEU;
        out.buffCompetence = c.nom;
      }
    }
  }
  return out;
}

// Toutes les compétences qui font quelque chose à la VITESSE du camp, dans
// l'ordre du kit. Sert à l'analyse poussée, où l'on choisit ce que chaque
// monstre lance à son tour au lieu de prendre systématiquement la plus forte.
//
// Mêmes règles de lecture que `kitVitesse` (zone seulement, passives écartées,
// skill-ups comptés) : c'est le même filtre, gardé au même endroit pour qu'il ne
// diverge pas.
export function sortsVitesse(detail: DetailMonstre | null): SortVitesse[] {
  if (!detail) return [];
  const out: SortVitesse[] = [];
  for (const c of detail.competences) {
    if (c.passif) continue;
    let atbNiveau1 = 0;
    let buff = 0;
    for (const e of c.effets) {
      if (!e.aoe || e.surSoi) continue;
      if (e.nom === EFFET_ATB) atbNiveau1 = Math.max(atbNiveau1, e.quantite ?? 0);
      else if (e.nom === EFFET_SPD) buff = BUFF_SPD_JEU;
    }
    if (atbNiveau1 === 0 && buff === 0) continue;
    const skillUp = atbNiveau1 > 0 ? bonusSkillUp(c) : 0;
    out.push({ nom: c.nom, atb: atbNiveau1 + skillUp, atbNiveau1, atbSkillUp: skillUp, buff });
  }
  return out;
}
