// Types du parseur `spec-markdown.mjs` — implémentation en JS simple (utilisée
// aussi par des scripts scratch hors TypeScript), types à part pour que
// `tsc --noEmit` et les `.test.ts` la résolvent normalement.

export interface Titre {
  niveau: number;
  texte: string;
  ligne: number;
}

export interface Section {
  niveau: number;
  titre: string;
  slug: string;
  debut: number;
  fin: number;
  premierePhrase: string;
}

export interface EnTete {
  statut: string | null;
  lireSi: string | null;
}

export function titres(texte: string): Titre[];
export function slug(titre: string, compteurs?: Map<string, number>): string;
export function sections(texte: string): Section[];
export function enTete(texte: string): EnTete;
