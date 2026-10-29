// Les quatre configurations du bureau et leur groupe d'onglets, calculés
// sur la largeur du conteneur (docs/02-app/optimizer/ecran/README.md).
// Monstre et résultats restent visibles ; les réglages se rangent de droite
// à gauche. L'onglet est local à l'écran, hors recette et hors recherche.
export type ColonneReglage = 'criteres' | 'artefacts' | 'complements';
export type ConfigurationBureau = 'colonnes' | 'criteres-et-groupe' | 'groupe' | 'deux-piles';

// Des places : le panneau retire 8 px, la gouttière en ajoute 16, soit
// 24 px entre panneaux. Les résultats comprennent leur barre réservée.
export const LARGEURS_BUREAU = { monstre: 384, reglage: 320, resultats: 360, gouttiere: 16 } as const;
export const RETRAIT_PANNEAU = 8;
const L = LARGEURS_BUREAU;
const BASE = L.monstre + L.gouttiere + L.resultats;
export const SEUILS_BUREAU = {
  groupe: BASE + L.gouttiere + L.reglage,
  criteresEtGroupe: BASE + 2 * (L.gouttiere + L.reglage),
  colonnes: BASE + 3 * (L.gouttiere + L.reglage),
} as const;

export interface DispositionBureau {
  configuration: ConfigurationBureau;
  colonnes: ColonneReglage[];
  groupe: ColonneReglage[];
  deuxPiles: boolean;
}

export function configurationBureau(largeur: number): DispositionBureau {
  if (largeur >= SEUILS_BUREAU.colonnes) return { configuration: 'colonnes', colonnes: ['criteres', 'artefacts', 'complements'], groupe: [], deuxPiles: false };
  if (largeur >= SEUILS_BUREAU.criteresEtGroupe) return { configuration: 'criteres-et-groupe', colonnes: ['criteres'], groupe: ['artefacts', 'complements'], deuxPiles: false };
  return { configuration: largeur >= SEUILS_BUREAU.groupe ? 'groupe' : 'deux-piles', colonnes: [], groupe: ['criteres', 'artefacts', 'complements'], deuxPiles: largeur < SEUILS_BUREAU.groupe };
}

// Un guidage vers une colonne déjà visible ne change pas le groupe.
// Sans groupe, aucun onglet ; au retour d'un groupe, son premier onglet.
export function ongletOuvert(groupe: readonly ColonneReglage[], precedent: ColonneReglage | null, guidage: ColonneReglage | null = null): ColonneReglage | null {
  if (guidage && groupe.includes(guidage)) return guidage;
  return precedent && groupe.includes(precedent) ? precedent : groupe[0] ?? null;
}

export type AttenteResultats = 'sans-monstre' | 'sans-recherche' | 'sans-carte';
export function attenteResultats(monstre: boolean, resultatsPresents: boolean, statut: 'idle' | 'running' | 'done' | 'error' | 'refused'): AttenteResultats | null {
  if (!monstre) return 'sans-monstre';
  if (resultatsPresents) return null;
  return statut === 'idle' ? 'sans-recherche' : 'sans-carte';
}
