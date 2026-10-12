// Sélection des écrans du banc d'après des fichiers modifiés (`--depuis`,
// `--plage` de tests/banc/run.mjs). Pur et déterministe : aucune lecture de
// Git, aucun navigateur — le lanceur lui donne la liste de chemins, la
// vérification `banc-selection` lui en donne d'autres.
//
// ⚠️ Comme ecrans.ts, ce fichier est lu par Node (TypeScript exécuté
// directement : imports en `.ts`, rien qui ne s'efface pas) et par esbuild.
//
// Règle, dans l'ordre :
//   1. un chemin couvert par MOTIFS_TOUS (`src/ui/`, `src/index.css`,
//      `tailwind.config.js`) sélectionne tous les écrans ;
//   2. sinon il sélectionne chaque écran dont un motif le couvre — un motif
//      partagé les sélectionne tous (`motifsPartages`) ;
//   3. sinon il est « hors table » : aucun écran, signalé. Ce n'est pas
//      « rien à vérifier », c'est « la table ne sait pas » : le lanceur le
//      dit sur la sortie standard.

import { ECRANS, MOTIFS_TOUS } from './ecrans.ts';
import type { Ecran } from './ecrans.ts';

export interface DetailFichier {
  fichier: string;
  /** Identifiants des écrans sélectionnés par ce fichier, dans l'ordre de la table. */
  ecrans: string[];
  regle: 'tous' | 'motif' | 'aucun';
}

export interface Selection {
  /** Écrans sélectionnés, dans l'ordre de la table. */
  ecrans: Ecran[];
  details: DetailFichier[];
  /** Fichiers qu'aucun motif ne couvre. */
  horsTable: string[];
}

/** Chemin de dépôt normalisé : `/`, sans `./` de tête. */
export function normaliser(chemin: string): string {
  return chemin.replace(/\x5c/g, '/').replace(/^(\.\/)+/, '');
}

/**
 * Un motif couvre-t-il ce chemin ? `dossier/` : tout ce qui est dessous ;
 * `prefixe*` : les chemins qui commencent ainsi ; sinon le fichier de ce nom,
 * extension quelconque (`src/lib/crafts` couvre `src/lib/crafts.ts`).
 */
export function couvre(motif: string, chemin: string): boolean {
  if (motif.endsWith('/')) return chemin.startsWith(motif);
  if (motif.endsWith('*')) return chemin.startsWith(motif.slice(0, -1));
  return chemin === motif || chemin.startsWith(motif + '.');
}

export function ecransPourFichiers(fichiers: string[], ecrans: Ecran[] = ECRANS): Selection {
  const uniques = [...new Set(fichiers.map(normaliser).filter((f) => f !== ''))].sort();
  const details: DetailFichier[] = uniques.map((fichier) => {
    if (MOTIFS_TOUS.some((m) => couvre(m, fichier))) {
      return { fichier, ecrans: ecrans.map((e) => e.id), regle: 'tous' };
    }
    const ids = ecrans.filter((e) => e.motifs.some((m) => couvre(m, fichier))).map((e) => e.id);
    return { fichier, ecrans: ids, regle: ids.length > 0 ? 'motif' : 'aucun' };
  });
  const choisis = new Set(details.flatMap((d) => d.ecrans));
  return {
    ecrans: ecrans.filter((e) => choisis.has(e.id)),
    details,
    horsTable: details.filter((d) => d.regle === 'aucun').map((d) => d.fichier),
  };
}

/** Les motifs écrits dans plus d'un écran : ce qu'ils couvrent sélectionne ces écrans ensemble. */
export function motifsPartages(ecrans: Ecran[] = ECRANS): { motif: string; ecrans: string[] }[] {
  const parMotif = new Map<string, string[]>();
  for (const e of ecrans) {
    for (const m of new Set(e.motifs)) parMotif.set(m, [...(parMotif.get(m) ?? []), e.id]);
  }
  return [...parMotif.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([motif, ids]) => ({ motif, ecrans: ids }))
    .sort((a, b) => a.motif.localeCompare(b.motif));
}
