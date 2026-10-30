// Filtres `--etats` et `--tailles` du banc d'affichage : rejouer un état ou
// une taille sans payer toute la grille d'un écran (l'Optimizer en a plus de
// deux cents cases). Sans navigateur : le lanceur (run.mjs) les applique,
// banc-selection.test.ts les vérifie.
//
// ⚠️ Un identifiant inconnu des écrans retenus est refusé, jamais ignoré : un
// filtre mal orthographié ne doit pas finir en « rien ne déborde » sur zéro
// mesure. Ce qui n'est pas retenu est consigné, avec son motif, dans les non
// exercés du manifeste.

import { preparationPour, taillesPour } from './ecrans.ts';
import type { Ecran, Format } from './ecrans.ts';

export class RefusFiltre extends Error {}

export interface Filtres {
  etats: string[] | null;
  tailles: string[] | null;
}

const ids = (brut: string | null | undefined) => (brut ? brut.split(',').map((s) => s.trim()).filter(Boolean) : null);

/** Lit et valide les deux filtres contre les écrans retenus. */
export function lireFiltres(selection: Ecran[], brut: { etats?: string | null; tailles?: string | null }): Filtres {
  const etats = ids(brut.etats);
  const tailles = ids(brut.tailles);
  const connusEtats = [...new Set(selection.flatMap((e) => e.etats.map((s) => s.id)))];
  const connusTailles = [...new Set(selection.flatMap((e) => taillesPour(e).map((t) => t.id)))];
  const verifier = (option: string, demandes: string[] | null, connus: string[]) => {
    if (demandes === null) return;
    if (demandes.length === 0) throw new RefusFiltre(`${option} attend au moins un identifiant`);
    const inconnus = demandes.filter((id) => !connus.includes(id));
    if (inconnus.length) {
      throw new RefusFiltre(`${option} : inconnu des écrans retenus : ${inconnus.join(', ')}\nconnus : ${connus.join(', ')}`);
    }
  };
  verifier('--etats', etats, connusEtats);
  verifier('--tailles', tailles, connusTailles);
  return { etats, tailles };
}

/** Le motif de non-exercice d'une case écartée par un filtre, ou null si elle est retenue. */
export function motifFiltre(f: Filtres, etat: string, taille: string): string | null {
  if (f.tailles && !f.tailles.includes(taille)) return 'taille non retenue (--tailles)';
  if (f.etats && !f.etats.includes(etat)) return 'état non retenu (--etats)';
  return null;
}

/**
 * Les cases que le banc exercera : retenues par les filtres, permises par la
 * restriction de tailles de l'état, préparées pour ce format. Même décision
 * que la boucle de mesure de run.mjs, prise avant la construction.
 */
export function casesExercees(selection: Ecran[], f: Filtres): { ecran: string; etat: string; taille: string }[] {
  return selection.flatMap((e) => taillesPour(e).flatMap((t) => e.etats
    .filter((s) => motifFiltre(f, s.id, t.id) === null && (!s.tailles || s.tailles.includes(t.id)) && Array.isArray(preparationPour(s, t.format)))
    .map((s) => ({ ecran: e.id, etat: s.id, taille: t.id }))));
}

/** Les formats qu'au moins une taille retenue utilise : on n'importe le compte que pour eux. */
export function formatsRetenus(selection: Ecran[], f: Filtres, ordre: Format[]): Format[] {
  const utilises = new Set(selection.flatMap((e) => taillesPour(e).filter((t) => !f.tailles || f.tailles.includes(t.id)).map((t) => t.format)));
  return ordre.filter((format) => utilises.has(format));
}
