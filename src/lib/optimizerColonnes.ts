// Les deux colonnes repliables de l'Optimizer au bureau, « Artéfacts et
// relique » et « Aura, exclusion, avancés », et le contrôle à onglets qui les
// ouvre (docs/02-app/optimizer/ecran/README.md, « Mise en page d'ensemble »).
//
// ⚠️ **Un état d'ouverture, pas un critère de recherche** : il vit dans
// l'écran, jamais dans `useOptimizerState` — rien à exporter dans une recette,
// rien à remettre à zéro au changement de monstre (même règle que le
// dépliement des réglages avancés).
//
// Les agencements du bureau (A1, A2, A3) se posent en CSS, par requêtes de
// conteneur (`@container` à la racine de l'écran) : les seuils ci-dessous en
// sont la source et la raison, et l'écran lit la même largeur de conteneur
// pour ce que le CSS ne sait pas dire (l'état de départ, « les deux tiennent »).

export type ColonneRepliable = 'artefacts' | 'complements';

export interface ColonnesOuvertes {
  artefacts: boolean;
  complements: boolean;
  // La dernière ouverte : celle qui reste seule quand la largeur n'en tient
  // plus qu'une.
  derniere: ColonneRepliable | null;
}

export const AUCUNE_COLONNE: ColonnesOuvertes = { artefacts: false, complements: false, derniere: null };

const AUTRE: Record<ColonneRepliable, ColonneRepliable> = { artefacts: 'complements', complements: 'artefacts' };

// Les colonnes réellement affichées : là où une seule tient (`deuxTiennent`
// faux), la dernière ouverte seule — l'état garde les deux, pour les rendre
// ensemble si la largeur revient.
export function colonnesAffichees(etat: ColonnesOuvertes, deuxTiennent: boolean): Record<ColonneRepliable, boolean> {
  if (deuxTiennent || !(etat.artefacts && etat.complements)) return { artefacts: etat.artefacts, complements: etat.complements };
  const seule = etat.derniere ?? 'artefacts';
  return { artefacts: seule === 'artefacts', complements: seule === 'complements' };
}

// Ouvrir une colonne sans jamais la refermer (le guidage vers l'interrupteur
// des auras RES/PRE, qui vit dans « Aura, exclusion, avancés »). L'autre reste
// dans l'état : `colonnesAffichees` n'en montre qu'une là où une seule tient.
export function ouvrirColonne(etat: ColonnesOuvertes, colonne: ColonneRepliable): ColonnesOuvertes {
  return { ...etat, [colonne]: true, derniere: colonne };
}

// ── Agencements du bureau (docs/02-app/optimizer/ecran/README.md, « Ordre
// d'usage et grille » et « Colonnes repliables selon la largeur ») ──────────
// Les largeurs déclarées des boîtes, d'où se calcule chaque seuil : un seuil se
// pose là où l'agencement suivant tient, jamais réglé au pixel. Les composants
// de bureau déclarent les mêmes largeurs (`LARGEUR_*` de
// src/components/outils/optimizer/bureau/), un test les compare.
// ⚠️ **La colonne de droite a deux largeurs repères, toutes deux tirées de
// la fiche d'« Exemplaire »** (statistiques, artéfacts, roue de runes,
// relique), plus le contour et le rembourrage du panneau (2 × 9) et, la
// colonne de droite étant la dernière, les 4 px entre son panneau et sa barre
// de défilement réservée et la barre (10), soit 32 :
// - `exemplaireMin`, sa largeur MINIMALE : la fiche repliée (artéfacts, roue
//   et relique sous les statistiques), 356 px mesurés avec une relique ATQ ou
//   DEF à deux chiffres : 388. C'est d'elle que part A3 ;
// - `exemplaire`, la place où la fiche reste DÉPLIÉE : 564 px mesurés avec la
//   même relique, 596. Une colonne repliable ne s'insère que si la colonne de
//   droite garde cette place (décision de l'utilisateur) : en dessous, elle se
//   superpose. Le bloc étroit se pose à côté d'elle à partir d'elle aussi.
// Tout le reste de la colonne (puces, objectif, « Rechercher », résultats)
// s'adapte au-dessus du minimum.
// « Aura, exclusion, avancés » a la place d'« Artéfacts et relique »
// (décision de l'utilisateur), ses sources de siège sur deux lignes.
export const LARGEURS_BUREAU = {
  essentiels: 548, gouttiere: 16, artefacts: 320, complements: 320, exemplaireMin: 388, exemplaire: 596, objectifEtroit: 340,
} as const;

// ⚠️ **Ces largeurs sont des PLACES.** Chaque colonne se dessine en panneau
// (src/components/outils/optimizer/bureau/panneau.ts), 8 px plus étroit que
// sa place quand une autre colonne la suit : l'écart visible entre deux
// panneaux est la gouttière plus ce retrait, 24 px (décision de
// l'utilisateur : écarts larges entre les colonnes), et aucun
// seuil ne bouge. Le panneau rend la place que les cadres de ses cartes
// prenaient : une section y garde la largeur de contenu de la carte d'avant.
export const RETRAIT_PANNEAU = 8;

const L = LARGEURS_BUREAU;
// À droite des essentiels : leur largeur et la gouttière.
const DROITE_DES_ESSENTIELS = L.essentiels + L.gouttiere;

export const SEUILS_BUREAU = {
  // A2 : une colonne repliable et le bloc étroit tiennent à droite des
  // essentiels, l'un sous l'autre : le plus large des trois.
  a2: DROITE_DES_ESSENTIELS + Math.max(L.artefacts, L.complements, L.objectifEtroit),
  // A3 : « Exemplaire », fiche repliée, tient à droite des essentiels.
  a3: DROITE_DES_ESSENTIELS + L.exemplaireMin,
  // Une colonne insérée entre les essentiels et « Exemplaire », fiche dépliée.
  artefactsInseree: DROITE_DES_ESSENTIELS + L.artefacts + L.gouttiere + L.exemplaire,
  complementsInseree: DROITE_DES_ESSENTIELS + L.complements + L.gouttiere + L.exemplaire,
  // Les deux, côte à côte.
  deuxInserees: DROITE_DES_ESSENTIELS + L.artefacts + L.gouttiere + L.complements + L.gouttiere + L.exemplaire,
} as const;

export type AgencementBureau = 'A1' | 'A2' | 'A3';

// L'agencement d'une largeur de conteneur (format bureau seulement : sous 728,
// c'est le format téléphone qui s'applique, choisi par l'app).
export function agencementBureau(largeur: number): AgencementBureau {
  return largeur >= SEUILS_BUREAU.a3 ? 'A3' : largeur >= SEUILS_BUREAU.a2 ? 'A2' : 'A1';
}

// Les deux colonnes ne s'affichent ensemble qu'insérées côte à côte ; partout
// ailleurs, une seule à la fois.
export function deuxColonnesTiennent(largeur: number | null): boolean {
  return largeur != null && largeur >= SEUILS_BUREAU.deuxInserees;
}

// ── Le bloc « Objectif et Rechercher » (docs/02-app/optimizer/ecran/README.md,
// « Bloc « Objectif et Rechercher » ») ─────────────────────────────────────
export type FormeObjectifBureau = 'etroite' | 'large';

// En A3, la forme étroite se pose à côté d'« Exemplaire » quand la colonne de
// droite les tient tous deux, la fiche dépliée, gouttière comprise :
// 596 + 16 + 340. Entre le minimum de la colonne et ce seuil, le bloc est large,
// sous « Exemplaire ».
export const COLONNE_DROITE_OBJECTIF_A_COTE = L.exemplaire + L.gouttiere + L.objectifEtroit;

// La largeur de la colonne de droite en A3 : le conteneur, moins les
// essentiels et leur gouttière, moins chaque colonne repliable INSÉRÉE (sa
// largeur et sa gouttière). Une colonne superposée ne prend aucune place.
export function largeurColonneDroite(largeur: number, affichees: Record<ColonneRepliable, boolean>): number {
  const artefacts = affichees.artefacts && largeur >= SEUILS_BUREAU.artefactsInseree ? L.artefacts + L.gouttiere : 0;
  const complements = affichees.complements && largeur >= SEUILS_BUREAU.complementsInseree ? L.complements + L.gouttiere : 0;
  return largeur - DROITE_DES_ESSENTIELS - artefacts - complements;
}

// La forme du bloc : étroite en A2 (à droite des essentiels) et en A3 à côté
// d'« Exemplaire » ; large en A1 et en A3 sous « Exemplaire ». ⚠️ Elle ne
// dépend que de la largeur et des colonnes affichées : seul le clic d'un
// onglet (qui insère ou retire une colonne) la change, jamais le lancement
// d'une recherche. Largeur inconnue (rendu serveur) : large, la forme de A1.
export function formeObjectifBureau(largeur: number | null, affichees: Record<ColonneRepliable, boolean>): FormeObjectifBureau {
  if (largeur == null) return 'large';
  const agencement = agencementBureau(largeur);
  if (agencement === 'A1') return 'large';
  if (agencement === 'A2') return 'etroite';
  return largeurColonneDroite(largeur, affichees) >= COLONNE_DROITE_OBJECTIF_A_COTE ? 'etroite' : 'large';
}

// ── La zone des résultats (même document, « Zone des résultats et place en
// plus ») ─────────────────────────────────────────────────────────────────
// Ce que tient la place d'attente tant qu'aucune carte n'est là : aucun
// monstre ; un monstre, aucune recherche ; une recherche lancée (ou arrêtée
// sur une erreur, un refus) sans rien à montrer encore — le cadre seul, sans
// la phrase « Aucune recherche lancée… », qui y serait fausse. `null` : les
// résultats eux-mêmes.
export type AttenteResultats = 'sans-monstre' | 'sans-recherche' | 'sans-carte';

export function attenteResultats(
  monstre: boolean,
  resultatsPresents: boolean,
  statut: 'idle' | 'running' | 'done' | 'error' | 'refused',
): AttenteResultats | null {
  if (!monstre) return 'sans-monstre';
  if (resultatsPresents) return null;
  return statut === 'idle' ? 'sans-recherche' : 'sans-carte';
}

// L'état de départ, tant que l'utilisateur n'a touché à aucun onglet :
// « Artéfacts et relique » ouverte en A1, en A2 et là où elle s'insère ; fermée
// en A3 en dessous, où elle s'ouvrirait en panneau superposé aux résultats
// (aucun panneau superposé ouvert d'office). « Aura, exclusion, avancés »
// fermée. Largeur inconnue (rendu serveur, avant la première mesure) : comme
// une largeur où elle s'insère.
export function colonnesParDefaut(largeur: number | null): ColonnesOuvertes {
  const superposee = largeur != null && largeur >= SEUILS_BUREAU.a3 && largeur < SEUILS_BUREAU.artefactsInseree;
  return superposee ? AUCUNE_COLONNE : { artefacts: true, complements: false, derniere: 'artefacts' };
}

// Le clic sur un onglet. Recliquer l'onglet affiché referme sa colonne ;
// cliquer l'autre l'ouvre, et ferme la première là où une seule tient. Là où
// les deux tiennent, la seconde s'ajoute à la première.
export function basculerColonne(etat: ColonnesOuvertes, colonne: ColonneRepliable, deuxTiennent: boolean): ColonnesOuvertes {
  const affichees = colonnesAffichees(etat, deuxTiennent);
  const autre = AUTRE[colonne];
  if (affichees[colonne]) {
    const restante = deuxTiennent ? etat[autre] : false;
    return { ...etat, [colonne]: false, [autre]: restante, derniere: restante ? autre : null };
  }
  return { ...etat, [colonne]: true, [autre]: deuxTiennent ? affichees[autre] : false, derniere: colonne };
}
