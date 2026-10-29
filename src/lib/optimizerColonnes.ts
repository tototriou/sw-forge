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

// La largeur que les résultats demandent pour le tableau : sa largeur
// minimale (`SEUIL_TABLEAU_PX`, TableauResultats.tsx, 661) plus ce que la
// colonne des résultats ou la pile de droite prennent autour de la zone
// (barre réservée 10, écart 4, panneau ou marges 18).
export const RESULTATS_TABLEAU = 661 + 32;

// Du plus large au plus étroit ; `reglages` : les pistes de 320 px prises à
// côté de « Monstre » et des résultats (colonnes visibles, puis le groupe).
const CONFIGURATIONS: { disposition: DispositionBureau; reglages: number; seuil: number }[] = [
  { disposition: { configuration: 'colonnes', colonnes: ['criteres', 'artefacts', 'complements'], groupe: [], deuxPiles: false }, reglages: 3, seuil: SEUILS_BUREAU.colonnes },
  { disposition: { configuration: 'criteres-et-groupe', colonnes: ['criteres'], groupe: ['artefacts', 'complements'], deuxPiles: false }, reglages: 2, seuil: SEUILS_BUREAU.criteresEtGroupe },
  { disposition: { configuration: 'groupe', colonnes: [], groupe: ['criteres', 'artefacts', 'complements'], deuxPiles: false }, reglages: 1, seuil: SEUILS_BUREAU.groupe },
  { disposition: { configuration: 'deux-piles', colonnes: [], groupe: ['criteres', 'artefacts', 'complements'], deuxPiles: true }, reglages: 0, seuil: 0 },
];

// La largeur des résultats (colonne, ou pile de droite en deux piles).
export function largeurResultats(largeur: number, configuration: ConfigurationBureau): number {
  const c = CONFIGURATIONS.find((x) => x.disposition.configuration === configuration)!;
  return largeur - L.monstre - L.gouttiere - c.reglages * (L.reglage + L.gouttiere);
}

// `tableau` (le réglage « Résultats de l'Optimizer », Paramètres) : la page
// range ses réglages cran par cran, deux piles comprises, jusqu'à laisser
// `RESULTATS_TABLEAU` aux résultats. Aucune configuration ne le permet (trop
// étroit) : celle de la largeur seule, et les résultats en cartes.
export function configurationBureau(largeur: number, tableau = false): DispositionBureau {
  const possibles = CONFIGURATIONS.filter((c) => largeur >= c.seuil);
  if (tableau) {
    const pourTableau = possibles.find((c) => largeurResultats(largeur, c.disposition.configuration) >= RESULTATS_TABLEAU);
    if (pourTableau) return pourTableau.disposition;
  }
  return possibles[0].disposition;
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
