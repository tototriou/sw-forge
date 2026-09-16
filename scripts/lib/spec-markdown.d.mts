// Types du parseur `spec-markdown.mjs` — implémentation en JS simple (utilisée
// aussi par des scripts scratch hors TypeScript), types à part pour que
// `tsc --noEmit` et les `.test.ts` la résolvent normalement.

export interface Titre {
  niveau: number;
  texte: string;
  ligne: number;
}

export function titres(texte: string): Titre[];
export function slug(titre: string, compteurs?: Map<string, number>): string;
