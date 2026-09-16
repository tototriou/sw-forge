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

export interface Bloc {
  debut: number;
  fin: number;
  lignes: number;
}

export interface ReferenceSection {
  ligne: number;
  fichier: string;
  section: string;
}

export function titres(texte: string): Titre[];
export function slug(titre: string, compteurs?: Map<string, number>): string;
export function sections(texte: string): Section[];
export function enTete(texte: string): EnTete;
export function blocsTerminaux(texte: string): Bloc[];
/**
 * Repère les références `fichier.md § Section`. La comparaison au titre
 * cible se fait ensuite PAR SLUG (voir `slug()`) : ce que cette fonction
 * capture n'a pas besoin d'être un texte « propre ».
 *
 * Fin de la section capturée — la référence va jusqu'à la fin de la phrase
 * (fin de ligne) ou du séparateur `;` : un `;` termine toujours la capture ;
 * une parenthèse ou un crochet fermant ne la termine QUE s'il n'a pas
 * d'ouvrant correspondant depuis le début de la section (un `(` ou un `[`
 * ouvert À L'INTÉRIEUR du titre, ex. « 3.2 Dgts CRIT … (222-223) — ✅
 * IMPLÉMENTÉ », ne la termine plus). Un fermant sans solde signale soit la
 * parenthèse qui enveloppe toute la référence (`(fichier.md § Titre)`), soit
 * le crochet fermant d'un lien Markdown (`[fichier.md § Titre](url)`).
 */
export function referencesSection(texte: string): ReferenceSection[];
export function fichiersMarkdown(chemin: string): string[];
