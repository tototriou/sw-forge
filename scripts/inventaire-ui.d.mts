// Types de `inventaire-ui.mjs` (même convention que `spec-lint.d.mts`).

export function extraireSource(source: string, nomFichier?: string): string[];
export function inventaire(racine?: string): Record<string, string[]>;
