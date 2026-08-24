// Le MODÈLE de l'écran de speed tuning : une « ligne » (un monstre posé dans un
// camp) et tout ce qu'on en calcule.
//
// ⚠️ **L'écran n'est qu'un RENDU.** Tout ce qui décide — quelle vitesse a un
// monstre, quel sort il lance, ce que l'analyse écrit, qui sert d'adversaire de
// référence — vit ICI, en fonctions pures et testables. Cette logique a vécu
// dans le composant, où elle était invérifiable : c'est exactement là que se
// sont logés les écarts entre le siège et l'outil (un constructeur de
// `TuneMonstre` sur deux qui oubliait l'amplification de Miriam, une sélection
// de sort qui n'existait qu'à l'écran…).

import { Monster } from '../types';
import { combatSpeed } from './speed';
import { Camp, ModParTick, TuneMonstre } from './speedTune';
import { SortVitesse } from './speedTuneKit';
import { PassifVitesse, pointsDeGain } from './speedTunePassif';
import {
  ChoixSorts,
  DonneesKit,
  EntreeAuto,
  cumulsEstimes,
  sortRetenu,
  sortSecondRetenu,
} from './speedTuneAuto';
import { DeckImporte } from './speedTuneDeck';

// Une ligne : un monstre ajouté, sa vitesse de runes, son camp, et ses deux
// grilles de modificateurs indexées par tick. `uid = camp:id` → un même monstre
// peut figurer des DEUX côtés, pas deux fois dans le même camp.
export interface Ligne {
  uid: string;
  monster: Monster;
  runeSpeed: number | null;
  camp: Camp;
  atbMod: ModParTick;
  speedMod: ModParTick;
  // Bonus d'artéfact « augmente l'effet du buff de vitesse » (%). Renseigné pour
  // les alliés seulement (on ne connaît pas les artéfacts d'en face).
  artefactBuff: number | null;
  // Le monstre porte le set RAPIDITÉ (Swift). ⚠️ Ce n'est pas un détail : ses
  // 25 % entrent dans la somme des pourcentages (totem + lead + swift) alors que
  // la « SPD runes » saisie les porte déjà à plat — d'où un écart d'UN point sur
  // la vitesse de combat, et un point suffit à rater un tick.
  swift?: boolean;
  // Les sets du monstre, quand ils viennent d'un deck importé : la Volonté et le
  // Bouclier posent des buffs, que certains passifs comptent (Chilling).
  sets?: string[];
  // Combien de fois le gain de son PASSIF s'est déclenché (buffs portés, tours
  // adverses passés, attaques…). ⚠️ La VALEUR du gain est lue dans son kit ; ce
  // qui dépend du combat, c'est le nombre de fois — c'est donc la seule chose
  // qu'on demande.
  cumulsPassif?: number | null;
  // Le gain du passif est-il pris en compte ? Actif par défaut (`undefined`) :
  // un passif est toujours en vigueur en jeu.
  passifActif?: boolean;
  // Adversaire de RÉFÉRENCE posé par l'analyse automatique (copie du monstre le
  // plus rapide de l'équipe au moment du clic).
  //
  // ⚠️ **L'analyse est un INSTANTANÉ, pas un abonnement.** Changer de deck
  // l'ARRÊTE : la référence est retirée et il faut recliquer sur « Lancer
  // l'analyse » — un adversaire copié d'une équipe qu'on vient de remplacer ne
  // veut plus rien dire, et le verdict aurait l'air juste sans l'être.
  //
  // Le premier réglage à la main retire aussi le drapeau : la ligne devient un
  // adversaire ordinaire, qu'on garde tel quel.
  reference?: boolean;
  // Masqué : gardé dans la liste (avec sa config) mais retiré des calculs et des
  // tableaux — pour tester une composition sans perdre le réglage d'un monstre.
  masque: boolean;
}
// `uid = camp:id` : un même monstre peut figurer des DEUX côtés, jamais deux
// fois dans le même camp.
export const uidDe = (camp: Camp, id: string | number) => `${camp}:${id}`;

export function ligneVierge(monster: Monster, camp: Camp): Ligne {
  return {
    uid: uidDe(camp, String(monster.id)),
    monster,
    runeSpeed: null,
    camp,
    atbMod: {},
    speedMod: {},
    artefactBuff: null,
    masque: false,
  };
}

// Les lignes d'un deck importé. ⚠️ Elles REMPLACENT la composition du camp : un
// deck est une équipe, pas une liste de monstres à empiler.
export function lignesDeDeck(deck: DeckImporte, camp: Camp): Ligne[] {
  return deck.monstres.map(({ monster, runeSpeed, artefactBuff, swift, sets }) => ({
    ...ligneVierge(monster, camp),
    runeSpeed,
    artefactBuff,
    swift,
    sets,
  }));
}

// Une ligne, vue par le calcul partagé (speedTuneAuto).
export const entreeDe = (l: Ligne): EntreeAuto => ({
  id: l.uid,
  monster: l.monster,
  runeSpeed: l.runeSpeed,
  swift: l.swift,
  sets: l.sets,
  artefactBuff: l.artefactBuff,
  cumulsPassif: l.cumulsPassif,
  passifActif: l.passifActif,
});

export const visibles = (lignes: Ligne[]) => lignes.filter((l) => !l.masque);
export const duCamp = (lignes: Ligne[], camp: Camp) => visibles(lignes).filter((l) => l.camp === camp);

export function passifDe(l: Ligne, d: DonneesKit): PassifVitesse | null {
  if (l.monster.com2usId == null) return null;
  return (
    (d.passifs.get(l.monster.com2usId) ?? []).find((p) => p.gain || p.inconnu || p.amplifieBuff) ?? null
  );
}

export const passifActifDe = (l: Ligne) => l.passifActif !== false;

export function gainPassifDe(l: Ligne, d: DonneesKit): number {
  const p = passifDe(l, d);
  if (!p?.gain || !passifActifDe(l)) return 0;
  return pointsDeGain(p.gain, l.monster.stats.speed, l.cumulsPassif ?? 0);
}

// ⚠️ L'amplification des buffs d'un CAMP (Miriam) ne s'empile pas : on garde la
// plus forte. Elle s'AJOUTE au bonus d'artéfact de chacun plutôt que d'ouvrir un
// second chemin dans le moteur — deux mécaniques pour un même effet divergent.
export function ampliDe(lignes: Ligne[], camp: Camp, d: DonneesKit): number {
  let max = 0;
  for (const l of duCamp(lignes, camp)) {
    if (!passifActifDe(l)) continue;
    const a = passifDe(l, d)?.amplifieBuff;
    if (a?.equipe && a.valeur > max) max = a.valeur;
  }
  return max;
}

export function combatDe(l: Ligne, lead: number, d: DonneesKit): number | null {
  // ⚠️ `combatSpeed` ne rend `null` que sur un `null` franc : une base absente
  // (monstre sans stats) le traverse et ressort en NaN, que le moteur avalerait
  // comme une vitesse valable. On refuse tout ce qui n'est pas un nombre.
  const base = combatSpeed(l.monster.stats.speed ?? null, l.runeSpeed, lead, l.swift ?? false);
  if (base == null || !Number.isFinite(base)) return null;
  return base + gainPassifDe(l, d);
}

export const sortsDe = (l: Ligne, d: DonneesKit): SortVitesse[] =>
  (l.monster.com2usId != null ? d.sorts.get(l.monster.com2usId) : null) ?? [];

// Le sort effectivement lancé : celui qu'on a désigné, sinon celui du kit.
export function sortActif(l: Ligne, d: DonneesKit, choix: ChoixSorts): SortVitesse | null {
  const nom = choix.sort?.[l.uid];
  if (nom === '') return null;
  if (nom != null) return sortsDe(l, d).find((x) => x.nom === nom) ?? null;
  return sortRetenu(entreeDe(l), d);
}

export function sortSecondDe(l: Ligne, d: DonneesKit, choix: ChoixSorts): SortVitesse | null {
  const nom = choix.sort2?.[l.uid];
  if (nom === '') return null;
  if (nom != null) return sortsDe(l, d).find((x) => x.nom === nom) ?? null;
  return sortSecondRetenu(entreeDe(l), d);
}

export interface Leads {
  allie: number;
  ennemi: number;
}

export const leadDe = (leads: Leads, camp: Camp) => (camp === 'allie' ? leads.allie : leads.ennemi);

// ⚠️ **L'ENTRÉE DU MOTEUR, en un seul endroit.** Elle a été écrite deux fois dans
// l'écran (une pour les tableaux, une pour l'analyse) et les deux ont divergé :
// l'amplification de Miriam n'entrait que dans l'une — l'outil en tenait compte
// pour remplir les grilles, mais pas pour dire si le combo passe.
//
// ⚠️ **Aucun effet chiffré de sort ici** : ce que les sorts posent a été ÉCRIT
// dans les grilles par l'analyse ; le rappliquer le compterait deux fois. Seul le
// tour rendu reste — c'est une structure (qui joue, combien de fois), pas une
// valeur.
export function tuneDe(lignes: Ligne[], leads: Leads, d: DonneesKit, choix: ChoixSorts): TuneMonstre[] {
  const out: TuneMonstre[] = [];
  for (const l of visibles(lignes)) {
    const c = combatDe(l, leadDe(leads, l.camp), d);
    if (c == null || c <= 0) continue;
    out.push({
      id: l.uid,
      combat: c,
      camp: l.camp,
      atbMod: l.atbMod,
      speedMod: l.speedMod,
      artefactBuff: (l.artefactBuff ?? 0) + ampliDe(lignes, l.camp, d),
      rejoue: sortActif(l, d, choix)?.rejoue ?? false,
    });
  }
  return out;
}

// Le monstre le plus rapide de l'équipe : le modèle de l'adversaire de référence.
export function plusRapideAllie(lignes: Ligne[], leads: Leads, d: DonneesKit): Ligne | null {
  let meilleur: Ligne | null = null;
  let vitesse = 0;
  for (const l of duCamp(lignes, 'allie')) {
    const c = combatDe(l, leadDe(leads, 'allie'), d);
    if (c != null && c > vitesse) {
      vitesse = c;
      meilleur = l;
    }
  }
  return meilleur;
}

// L'adversaire de référence : une COPIE du plus rapide, posée en face.
//
// ⚠️ Elle recopie tout ce qui fait sa vitesse — runes, Swift, artéfact, sets et
// **compte de buffs effectif**. Dans l'autre camp, l'estimation des buffs ne
// verrait que lui : il serait plus lent que le monstre qu'il copie, et l'équipe
// passerait devant à tort.
export function ligneReference(modele: Ligne, lignes: Ligne[], d: DonneesKit): Ligne {
  return {
    ...ligneVierge(modele.monster, 'ennemi'),
    runeSpeed: modele.runeSpeed,
    artefactBuff: modele.artefactBuff,
    swift: modele.swift,
    sets: modele.sets,
    cumulsPassif:
      modele.cumulsPassif ??
      cumulsEstimes(entreeDe(modele), duCamp(lignes, modele.camp).map(entreeDe), d),
    passifActif: modele.passifActif,
    reference: true,
  };
}

// ⚠️ Toute saisie sur une ligne lui retire le drapeau « référence » : dès qu'on
// la règle, ce n'est plus une copie qui suit l'équipe mais un adversaire à part
// entière, et l'écraser serait une perte de travail.
export const aLaMain = (l: Ligne): Ligne => (l.reference ? { ...l, reference: false } : l);

// ⚠️ **0 est une VALEUR, pas un effacement** : une case à 0 annule ce que la
// compétence pose à ce tick. Seule une case VIDE (`null`) rend la main.
export function majMod(m: ModParTick, tick: number, v: number | null): ModParTick {
  const next = { ...m };
  if (v == null) delete next[tick];
  else next[tick] = v;
  return next;
}

// Ce que l'analyse a écrit, reporté sur les lignes.
export function appliquerMods(
  lignes: Ligne[],
  mods: Map<string, { atbMod: ModParTick; speedMod: ModParTick }>
): Ligne[] {
  return lignes.map((l) => {
    const m = mods.get(l.uid);
    return m ? { ...l, atbMod: m.atbMod, speedMod: m.speedMod } : l;
  });
}

// ⚠️ Le compte de buffs se pose tout seul (Chilling : +20 par buff porté), mais
// SEULEMENT sur une case jamais touchée. Une case vidée à la main (`null`) est
// un choix, et l'estimation ne repasse pas dessus.
export function estimerCumuls(lignes: Ligne[], d: DonneesKit): Ligne[] {
  let change = false;
  const next = lignes.map((l) => {
    if (l.cumulsPassif !== undefined || l.masque) return l;
    const p = passifDe(l, d);
    if (!p?.gain?.parCumul) return l;
    const n = cumulsEstimes(entreeDe(l), duCamp(lignes, l.camp).map(entreeDe), d);
    if (n <= 0) return l;
    change = true;
    return { ...l, cumulsPassif: n };
  });
  return change ? next : lignes;
}

// Les sorts choisis d'un camp s'en vont avec sa composition : rangés par
// monstre, ils survivraient sinon à un import et rejoueraient le choix fait pour
// l'équipe précédente.
export const oublierCamp = (m: Record<string, string>, camp: Camp) =>
  Object.fromEntries(Object.entries(m).filter(([uid]) => !uid.startsWith(`${camp}:`)));
