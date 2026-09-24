// Types de `inventaire-comparer.mjs` — implémentation en JS simple, types à
// part pour que `tsc --noEmit` et les tests `.test.ts` la résolvent (même
// convention que `spec-lint.d.mts`).

export type Inventaire = Record<string, string[]>;

export interface Deplacement {
  de: string;
  vers?: string;
  // Forme sous laquelle on retrouve l'entrée dans `vers`, si elle a changé de
  // nature (ex. une entrée cliquable devenue titre de groupe).
  devient?: string;
  retrait?: string;
  // Pourquoi — lu par les humains, ignoré par la comparaison.
  pourquoi?: string;
}

export interface ResultatComparaison {
  ok: boolean;
  manquants: { fichier: string; entree: string }[];
  deplacementsNonFaits: { fichier: string; entree: string; vers: string }[];
  retraitsNonDecides: { fichier: string; entree: string; retrait: string }[];
  orphelins: string[];
}

export function cle(fichier: string, entree: string): string;
export function decisionsRetrait(texteCadrage: string): Set<number>;
export function comparer(
  reference: Inventaire,
  courant: Inventaire,
  deplacements: Record<string, Deplacement>,
  decisions: Set<number>
): ResultatComparaison;
