// Le fichier de « Mes équipes » : toutes les équipes, tous onglets confondus.
//
// Spec : docs/02-app/compte/feat-equipes.md, « Fichier ». L'import AJOUTE,
// jamais ne remplace : c'est la sauvegarde qui survit au navigateur vidé, elle
// ne doit pas pouvoir écraser le travail présent.

import { formatExport, formatReconnu } from './formatsExport';
import { PREFIXE_FICHIER } from '../marque';
import { jourLocal } from './telechargement';
import { lireEquipeEnregistree, type EquipeEnregistree, type SignalementEquipe, type TirerId } from './equipesEnregistrees';

export const NOM_FORMAT_EQUIPES = 'equipes';
export const VERSION_FICHIER_EQUIPES = 1;

// `swblacksmith-equipes-2026-11-05.json`.
export function nomFichierEquipes(date: Date): string {
  return `${PREFIXE_FICHIER}-equipes-${jourLocal(date)}.json`;
}

export function ecrireFichierEquipes(equipes: readonly EquipeEnregistree[], maintenant: Date): string {
  return JSON.stringify({
    format: formatExport(NOM_FORMAT_EQUIPES),
    version: VERSION_FICHIER_EQUIPES,
    exporteLe: maintenant.toISOString(),
    equipes,
  }, null, 2);
}

export type LectureFichierEquipes =
  | { ok: true; equipes: EquipeEnregistree[]; nouveauxId: number; ignorees: number;
      // Sous les identifiants définitifs, après résolution des collisions.
      signalements: { id: string; signalements: SignalementEquipe[] }[] }
  | { ok: false; raison: 'illisible' | 'format' | 'version' };

// `existants` : les identifiants déjà présents ; une équipe qui en reprend un
// reçoit un nouvel `id`. Les liens vers l'Optimizer désignent les listes d'un
// autre navigateur : ils sont retirés.
export function lireFichierEquipes(texte: string, existants: ReadonlySet<string>, tirerId: TirerId): LectureFichierEquipes {
  let v: unknown;
  try { v = JSON.parse(texte); } catch { return { ok: false, raison: 'illisible' }; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, raison: 'format' };
  const f = v as Record<string, unknown>;
  if (!formatReconnu(f.format, NOM_FORMAT_EQUIPES) || !Array.isArray(f.equipes)) return { ok: false, raison: 'format' };
  if (f.version !== VERSION_FICHIER_EQUIPES) return { ok: false, raison: 'version' };
  const pris = new Set(existants);
  const equipes: EquipeEnregistree[] = [];
  let nouveauxId = 0;
  let ignorees = 0;
  const signalements: { id: string; signalements: SignalementEquipe[] }[] = [];
  for (const brut of f.equipes) {
    const lu = lireEquipeEnregistree(brut);
    if (!lu) { ignorees++; continue; }
    const { lienOptimizer: _lien, ...equipe } = lu.equipe;
    if (pris.has(equipe.id)) {
      let id = tirerId();
      while (pris.has(id)) id = tirerId();
      equipe.id = id;
      nouveauxId++;
    }
    pris.add(equipe.id);
    equipes.push(equipe);
    const s = lu.signalements.filter((x) => x !== 'lienOptimizerRetire');
    if (s.length) signalements.push({ id: equipe.id, signalements: s });
  }
  return { ok: true, equipes, nouveauxId, ignorees, signalements };
}
