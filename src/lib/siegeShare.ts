// Export / import d'ÉQUIPES DE SIÈGE en fichier `.json` — Défense et Offense.
//
// Spec : docs/02-app/siege/ § Exporter et importer des équipes. 100 % local.
//
// ⚠️ **Le `com2usId`, jamais l'id local.** Une équipe se range par `monsterId`
// LOCAL, qui ne veut rien dire d'un joueur à l'autre (même règle que la prépa
// RTA et les recommandations). Le nom accompagne, pour qu'un fichier se lise.
//
// ⚠️ **Les runes partent SI L'AUTEUR LE CHOISIT** (`avecRunes`), comme pour la
// prépa RTA : partager ses runes, c'est montrer ce qu'on possède. Sans elles,
// celui qui reçoit ne voit qu'une composition et ses vitesses.
//
// ⚠️ **À la lecture, l'équipement reçu va dans `gearPartage`, JAMAIS dans
// `gear`.** `gear` est l'équipement du JOUEUR : les builds possédés
// (ownedBuilds.ts), les exclusions de l'Optimizer et l'alerte d'équipement
// incomplet le lisent comme tel. Les runes d'un ami y feraient croire qu'on
// possède ses monstres. `gearPartage` ne sert qu'à l'affichage.

import type { GearSet, Monster, SiegeTeam } from '../types';
import { NOM_APP, PREFIXE_FICHIER } from '../marque';
import { formatExport, formatReconnu } from './formatsExport';
import { jourLocal } from './telechargement';
import { cleanGear } from './equipementPartage';

// ⚠️ Un IDENTIFIANT de format, pas le nom de l'app. Il s'écrivait
// `sw-forge/siege-equipes` : cet ancien identifiant reste relu, sans quoi les
// fichiers déjà exportés seraient refusés (formatsExport.ts).
export const FORMAT_SIEGE = formatExport('siege-equipes');
export const VERSION_SIEGE = 1;

export type CoteSiege = 'defense' | 'offense';

interface MonstreExporte {
  com2usId: number | null;
  nom: string;
  vitesseRunes: number | null;
  tick: number;
  sets: string[];
  // Runes, artéfacts, relique et stats de base — seulement si l'auteur a choisi
  // de les joindre. Même clé que la prépa RTA.
  equipement?: GearSet;
}

// L'équipement qu'un slot peut transmettre : le sien, ou celui qu'il a lui-même
// reçu d'un fichier — réexporter une équipe reçue garde ses runes.
const equipementDuSlot = (sl: SiegeTeam['slots'][number] | undefined): GearSet | undefined =>
  sl?.gear ?? sl?.gearPartage;

// Combien de monstres partageables portent un équipement connu : le choix
// « avec les runes » ne s'offre que s'il y en a au moins un.
export function compterAvecRunes(teams: SiegeTeam[], monsterById: Map<string, Monster>): number {
  let n = 0;
  for (const t of teams)
    for (const sl of t.slots) {
      const m = sl.monsterId ? monsterById.get(sl.monsterId) : undefined;
      if (m && m.com2usId != null && equipementDuSlot(sl)) n++;
    }
  return n;
}

export interface FichierSiege {
  format: string;
  version: number;
  cote: CoteSiege;
  equipes: { monstres: MonstreExporte[] }[];
}

// Exporte des équipes. `perso` compte les monstres PERSO (sans `com2usId`) :
// leur emplacement part vide, et l'appelant le dit. `avecRunes` joint
// l'équipement de chaque monstre qui en a un.
export function exporterEquipes(
  teams: SiegeTeam[],
  cote: CoteSiege,
  monsterById: Map<string, Monster>,
  avecRunes = false
): { texte: string; equipes: number; perso: number } {
  let perso = 0;
  const fichier: FichierSiege = {
    format: FORMAT_SIEGE,
    version: VERSION_SIEGE,
    cote,
    equipes: teams.map((t) => ({
      monstres: [0, 1, 2].map((i) => {
        const sl = t.slots[i];
        const m = sl?.monsterId ? monsterById.get(sl.monsterId) : undefined;
        if (m && m.com2usId == null) perso++;
        const partage = m && m.com2usId != null;
        const equipement = partage && avecRunes ? equipementDuSlot(sl) : undefined;
        return {
          com2usId: partage ? m!.com2usId! : null,
          nom: partage ? m!.name : '',
          vitesseRunes: partage ? (sl?.runeSpeed ?? null) : null,
          tick: partage ? (sl?.tick ?? 0) : 0,
          sets: partage ? (sl?.sets ?? []) : [],
          ...(equipement ? { equipement } : {}),
        };
      }),
    })),
  };
  return { texte: JSON.stringify(fichier, null, 2), equipes: teams.length, perso };
}

// `swblacksmith-siege-defense-2026-09-26.json` — le nom dit ce qu'il contient.
export function nomFichierSiege(cote: CoteSiege, date = new Date()): string {
  return `${PREFIXE_FICHIER}-siege-${cote}-${jourLocal(date)}.json`;
}

export type LectureSiege =
  | { ok: false; erreur: string }
  | {
      ok: true;
      cote: CoteSiege;
      equipes: {
        slots: { monsterId: string | null; runeSpeed: number | null; tick: number; sets: string[]; gearPartage?: GearSet }[];
      }[];
      // Monstres du fichier absents des données chargées : leur emplacement
      // reste vide.
      inconnus: string[];
      // Monstres reçus AVEC leurs runes.
      avecRunes: number;
      // Corrections appliquées à un équipement (une relique ignorée) : le
      // fichier est lu quand même.
      avertissements: string[];
    };

// Lit un fichier d'équipes. ⚠️ Le contenu vient d'un tiers : rien n'est cru sur
// parole, et un fichier hors format est REFUSÉ en entier, avec la raison —
// jamais appliqué à moitié.
export function lireEquipes(texte: string, monsters: Monster[]): LectureSiege {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: "Ce fichier n'est pas du JSON." };
  }
  const o = brut as Partial<FichierSiege> | null;
  if (!o || typeof o !== 'object' || !formatReconnu(o.format, 'siege-equipes')) {
    return { ok: false, erreur: `Ce fichier n'est pas un export d'équipes de siège ${NOM_APP}.` };
  }
  // Deux refus distincts : une version absente ou illisible est un fichier
  // abîmé — le dire « plus récent » enverrait chercher une mise à jour qui
  // n'existe pas.
  if (typeof o.version !== 'number' || !Number.isFinite(o.version)) {
    return { ok: false, erreur: 'Export d’équipes abîmé : version illisible.' };
  }
  if (o.version > VERSION_SIEGE) {
    return { ok: false, erreur: `Ce fichier vient d’une version plus récente de ${NOM_APP}.` };
  }
  if (!Array.isArray(o.equipes)) {
    return { ok: false, erreur: 'Le fichier ne contient aucune liste d’équipes.' };
  }
  const parCom2us = new Map<number, Monster>();
  for (const m of monsters) if (m.com2usId != null && !parCom2us.has(m.com2usId)) parCom2us.set(m.com2usId, m);

  const inconnus: string[] = [];
  const avertissements: string[] = [];
  const avertir = (message: string) => {
    if (!avertissements.includes(message)) avertissements.push(message);
  };
  let avecRunes = 0;
  const equipes = o.equipes.map((e, ie) => {
    const monstres = Array.isArray(e?.monstres) ? e.monstres : [];
    return {
      slots: [0, 1, 2].map((i) => {
        const mx = monstres[i];
        const id = typeof mx?.com2usId === 'number' ? mx.com2usId : null;
        const m = id != null ? parCom2us.get(id) : undefined;
        if (id != null && !m) inconnus.push(typeof mx?.nom === 'string' && mx.nom ? mx.nom : `#${id}`);
        // Un équipement abîmé est ignoré, pas le fichier : la composition reste
        // lisible sans lui.
        const gearPartage = m ? cleanGear(mx?.equipement, avertir, `Équipe ${ie + 1}, ${m.name}`) : undefined;
        if (gearPartage) avecRunes++;
        return {
          monsterId: m ? String(m.id) : null,
          runeSpeed: m && typeof mx?.vitesseRunes === 'number' ? mx.vitesseRunes : null,
          tick: m && typeof mx?.tick === 'number' ? mx.tick : 0,
          sets: m && Array.isArray(mx?.sets) ? mx.sets.filter((s): s is string => typeof s === 'string') : [],
          ...(gearPartage ? { gearPartage } : {}),
        };
      }),
    };
  });
  return {
    ok: true,
    cote: o.cote === 'offense' ? 'offense' : 'defense',
    equipes,
    inconnus,
    avecRunes,
    avertissements,
  };
}
