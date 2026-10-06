// Le dossier SW Exporter — ce qui se décide sans toucher au disque (pur, testé
// par tests/bureau-swex.test.ts). Chantier application-bureau, lot 9,
// décision 15. Le disque et la surveillance : bureau/swex.ts.

// Un export de compte, tel que SW Exporter le nomme à la RACINE de son
// dossier : `<invocateur>-<identifiant>.json` (`tototriou-12889591.json`). Le
// nom peut contenir des tirets, des emojis, un `~` : l'identifiant est le
// DERNIER groupe de chiffres. Tout le reste (`live/`, `plugins/`, `cert/`,
// un `.json` sans identifiant) n'est pas un export de compte.
export interface ExportCompte {
  fichier: string;
  nom: string;
  id: string;
}

export function lireNomExport(fichier: string): ExportCompte | null {
  const m = /^(.+)-(\d+)\.json$/i.exec(fichier);
  if (!m || !m[1].trim()) return null;
  return { fichier, nom: m[1], id: m[2] };
}

// Les exports d'une liste de fichiers (la racine du dossier), triés par nom.
export function exportsDuDossier(fichiers: string[]): ExportCompte[] {
  return fichiers
    .map(lireNomExport)
    .filter((e): e is ExportCompte => e !== null)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.id.localeCompare(b.id));
}

// Le réglage retenu (`swex.json`, dossier des données de l'app), relu avec
// méfiance : un fichier abîmé ne doit ni planter l'app ni inventer un chemin.
export interface ReglageSwex {
  dossier: string | null;
  fichier: string | null;
  // Date de modification (ms) du dernier export APPLIQUÉ par la page.
  dernierLu: number | null;
}

export function lireReglage(brut: unknown): ReglageSwex {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  const fichier = texte(o.fichier);
  return {
    dossier: texte(o.dossier),
    // ⚠️ Un nom de fichier, jamais un chemin : il se joint au dossier.
    fichier: fichier && lireNomExport(fichier) && !/[\\/]/.test(fichier) ? fichier : null,
    dernierLu: typeof o.dernierLu === 'number' && Number.isFinite(o.dernierLu) ? o.dernierLu : null,
  };
}

// Faut-il donner le fichier à la page ? `nouveau` : un export plus récent que
// le dernier appliqué (la page l'annonce). Sinon, au chargement d'une page
// SANS compte (conservation refusée), on le redonne en silence : le compte
// « se relit du dossier au lancement » (décision 15).
export function aDonner(
  modifie: number,
  dernierLu: number | null,
  pageSansCompte: boolean
): { donner: boolean; nouveau: boolean } {
  if (dernierLu === null || modifie > dernierLu) return { donner: true, nouveau: true };
  return { donner: pageSansCompte, nouveau: false };
}
