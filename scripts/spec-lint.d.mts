// Types de `spec-lint.mjs` — implémentation en JS simple, types à part pour
// que `tsc --noEmit` et les tests `.test.ts` résolvent `verifier()`
// normalement (même convention que `spec-markdown.d.mts`).

export interface ErreurLint {
  fichier: string;
  ligne?: number;
  regle: string;
  message: string;
}

export interface ResultatLint {
  erreurs: ErreurLint[];
  exceptionsUtilisees: Set<string>;
}

export interface ExceptionSpecLint {
  fichier: string;
  raison: string;
  condition_de_suppression: string;
  chantier_responsable: string;
}

export interface ConfigSpecLint {
  perimetre: string[];
  exceptions: ExceptionSpecLint[];
}

export function verifier(
  racine: string,
  config: ConfigSpecLint,
  options?: { inclureLongueurs?: boolean }
): ResultatLint;
