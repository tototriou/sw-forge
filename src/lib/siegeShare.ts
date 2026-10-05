// Export / import d'ÉQUIPES DE SIÈGE en fichier `.json` — Défense et Offense.
//
// Ajout décidé par Thomas le 2026-09-26 (refonte graphique, décision 14) ; spec :
// spec/siege/README.md § Exporter et importer des équipes. 100 % local.
//
// ⚠️ **Le `com2usId`, jamais l'id local.** Une équipe se range par `monsterId`
// LOCAL, qui ne veut rien dire d'un joueur à l'autre (même règle que la prépa
// RTA et les recommandations). Le nom accompagne, pour qu'un fichier se lise.
//
// ⚠️ **Pas le détail des runes** (`gear`) : on partage une composition et ses
// vitesses, pas son inventaire.

import type { Monster, SiegeTeam } from '../types';
import { NOM_APP, PREFIXE_FICHIER } from '../marque';
import { formatExport, formatReconnu } from './formatsExport';

// ⚠️ Un IDENTIFIANT de format, pas le nom de l'app. Il s'écrivait
// `sw-forge/siege-equipes` : cet ancien identifiant reste relu, sans quoi les
// fichiers déjà exportés seraient refusés (décision 66, formatsExport.ts).
export const FORMAT_SIEGE = formatExport('siege-equipes');
export const VERSION_SIEGE = 1;

export type CoteSiege = 'defense' | 'offense';

interface MonstreExporte {
  com2usId: number | null;
  nom: string;
  vitesseRunes: number | null;
  tick: number;
  sets: string[];
}

export interface FichierSiege {
  format: string;
  version: number;
  cote: CoteSiege;
  equipes: { monstres: MonstreExporte[] }[];
}

// Exporte des équipes. `perso` compte les monstres PERSO (sans `com2usId`) :
// leur emplacement part vide, et l'appelant le dit.
export function exporterEquipes(
  teams: SiegeTeam[],
  cote: CoteSiege,
  monsterById: Map<string, Monster>
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
        return {
          com2usId: partage ? m!.com2usId! : null,
          nom: partage ? m!.name : '',
          vitesseRunes: partage ? (sl?.runeSpeed ?? null) : null,
          tick: partage ? (sl?.tick ?? 0) : 0,
          sets: partage ? (sl?.sets ?? []) : [],
        };
      }),
    })),
  };
  return { texte: JSON.stringify(fichier, null, 2), equipes: teams.length, perso };
}

// `swblacksmith-siege-defense-2026-09-26.json` — le nom dit ce qu'il contient.
export function nomFichierSiege(cote: CoteSiege, date = new Date()): string {
  return `${PREFIXE_FICHIER}-siege-${cote}-${date.toISOString().slice(0, 10)}.json`;
}

export type LectureSiege =
  | { ok: false; erreur: string }
  | {
      ok: true;
      cote: CoteSiege;
      equipes: { slots: { monsterId: string | null; runeSpeed: number | null; tick: number; sets: string[] }[] }[];
      // Monstres du fichier absents des données chargées : leur emplacement
      // reste vide.
      inconnus: string[];
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
  if (typeof o.version !== 'number' || o.version > VERSION_SIEGE) {
    return { ok: false, erreur: `Ce fichier vient d’une version plus récente de ${NOM_APP}.` };
  }
  if (!Array.isArray(o.equipes)) {
    return { ok: false, erreur: 'Le fichier ne contient aucune liste d’équipes.' };
  }
  const parCom2us = new Map<number, Monster>();
  for (const m of monsters) if (m.com2usId != null && !parCom2us.has(m.com2usId)) parCom2us.set(m.com2usId, m);

  const inconnus: string[] = [];
  const equipes = o.equipes.map((e) => {
    const monstres = Array.isArray(e?.monstres) ? e.monstres : [];
    return {
      slots: [0, 1, 2].map((i) => {
        const mx = monstres[i];
        const id = typeof mx?.com2usId === 'number' ? mx.com2usId : null;
        const m = id != null ? parCom2us.get(id) : undefined;
        if (id != null && !m) inconnus.push(typeof mx?.nom === 'string' && mx.nom ? mx.nom : `#${id}`);
        return {
          monsterId: m ? String(m.id) : null,
          runeSpeed: m && typeof mx?.vitesseRunes === 'number' ? mx.vitesseRunes : null,
          tick: m && typeof mx?.tick === 'number' ? mx.tick : 0,
          sets: m && Array.isArray(mx?.sets) ? mx.sets.filter((s): s is string => typeof s === 'string') : [],
        };
      }),
    };
  });
  return { ok: true, cote: o.cote === 'offense' ? 'offense' : 'defense', equipes, inconnus };
}
