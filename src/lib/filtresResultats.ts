// Les filtres d'affichage des résultats de l'Optimizer : une borne minimum et
// une borne maximum par colonne, appliquées dans le classeur avant la
// pagination (docs/02-app/optimizer/ecran/resultats.md, « Filtres
// d'affichage par colonne »). Ce ne sont pas des conditions de recherche :
// rien ici ne résout, ne renote ni ne relance.

import { COLONNES_RESULTATS, type ColonneResultat } from './colonnesResultats';
import { scoreDuCandidat, statTotal, type BuildCandidate, type OptionsDeClassement } from './runeBuildOptim';
import { chiffresMesureRune, displayedTotal, entierAffiche, moyenneParRune } from './valeursAffichees';

/** Une borne par sens ; `null` = sans borne. */
export interface BorneColonne { min: number | null; max: number | null }
export type BornesResultats = Partial<Record<ColonneResultat, BorneColonne>>;

/**
 * Les colonnes que la résolution de l'équipement ne change pas : une
 * principale d'artéfact ne porte que PV, ATQ ou DEF, une principale de
 * relique que PV %, ATQ % ou DEF %, et la mesure ne lit que les runes. Un
 * build non vérifié peut y échouer de façon démontrée ; sur les autres
 * colonnes, sa valeur est provisoire.
 */
export const COLONNES_IMMUABLES: ReadonlySet<ColonneResultat> = new Set<ColonneResultat>(['spd', 'cr', 'cd', 'res', 'acc', 'efficience']);

/**
 * La catégorie d'une ligne reçue dans la vue. Seules `visible` et
 * `potentielle` sont dans la vue (cartes, places en attente, pages).
 */
export const CATEGORIE_LIGNE = {
  /** Valeurs définitives, toutes les bornes actives tenues. */
  visible: 0,
  /** Valeurs définitives, une borne active manquée. */
  masquee: 1,
  /** Valeurs définitives, aucune borne manquée, mais une valeur `NaN` sous une borne active. */
  indeterminee: 2,
  /** Non vérifiée, aucun échec démontré : peut encore entrer dans la vue. */
  potentielle: 3,
  /** Non vérifiée, une borne manquée sur une colonne immuable sous résolution. */
  masqueeNonVerifiee: 4,
  /** Écartée à la résolution : hors de la vue, quelles que soient les bornes. */
  ecartee: 5,
} as const;
export type CategorieLigne = (typeof CATEGORIE_LIGNE)[keyof typeof CATEGORIE_LIGNE];
export const NOMBRE_CATEGORIES = 6;

export function dansLaVue(categorie: number): boolean {
  return categorie === CATEGORIE_LIGNE.visible || categorie === CATEGORIE_LIGNE.potentielle;
}

/** Les bornes telles que la vue les applique. */
export interface EtatBornes {
  /** Colonnes disponibles avec au moins une borne, dans l'ordre des colonnes. */
  actives: { colonne: ColonneResultat; min: number | null; max: number | null }[];
  /** Colonnes bornées mais indisponibles (Dégâts réels sans sort calculable) : sans effet. */
  inactives: ColonneResultat[];
  /** Colonnes actives dont le minimum dépasse le maximum : la vue est vide. */
  contradictoires: ColonneResultat[];
}
export const AUCUNE_BORNE: EtatBornes = { actives: [], inactives: [], contradictoires: [] };

function lireBorne(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error('Borne de colonne invalide');
  return v;
}

/** Une copie des bornes d'une vue : le classeur ne garde aucun objet de l'appelant. */
export function copierBornes(bornes: BornesResultats): BornesResultats {
  const copie: BornesResultats = {};
  for (const [colonne, b] of Object.entries(bornes) as [ColonneResultat, BorneColonne][]) copie[colonne] = b && typeof b === 'object' ? { min: b.min, max: b.max } : b;
  return copie;
}

/** Une colonne a-t-elle une valeur ? Dégâts réels exige un sort calculable. */
export function colonneDisponible(colonne: ColonneResultat, realDamage: unknown): boolean {
  return colonne !== 'degats_reels' || (realDamage !== null && realDamage !== undefined);
}

/** Valide les bornes d'une vue et les range ; une borne mal formée lève, jamais ramenée en silence. */
export function etatDesBornes(bornes: BornesResultats | undefined, disponible: (c: ColonneResultat) => boolean): EtatBornes {
  if (bornes === undefined) return AUCUNE_BORNE;
  if (bornes === null || typeof bornes !== 'object' || Array.isArray(bornes)) throw new Error('Bornes de colonnes invalides');
  for (const cle of Object.keys(bornes)) if (!(COLONNES_RESULTATS as readonly string[]).includes(cle)) throw new Error(`Colonne de borne inconnue : ${cle}`);
  const etat: EtatBornes = { actives: [], inactives: [], contradictoires: [] };
  for (const colonne of COLONNES_RESULTATS) {
    const b = bornes[colonne];
    if (b === undefined) continue;
    if (b === null || typeof b !== 'object') throw new Error('Borne de colonne invalide');
    const min = lireBorne(b.min), max = lireBorne(b.max);
    if (min === null && max === null) continue;
    if (!disponible(colonne)) { etat.inactives.push(colonne); continue; }
    etat.actives.push({ colonne, min, max });
    if (min !== null && max !== null && min > max) etat.contradictoires.push(colonne);
  }
  return etat;
}

/**
 * La valeur qu'une carte écrit pour cette colonne, en nombre : les mêmes
 * fonctions que la carte (valeursAffichees.ts), sur le candidat aux stats de
 * sa vraie paire et les options du classement affiché. `null` : colonne sans
 * valeur pour ce contexte. `afficherDepassement` : le réglage d'application
 * « afficher au-delà du plafond » ; masqué, Taux Crit, RES et Précision
 * valent ce que le panneau de stats écrit, au plus 100 (`displayedTotal`).
 */
export function valeurAffichee(colonne: ColonneResultat, candidat: BuildCandidate, options: OptionsDeClassement, afficherDepassement = true): number | null {
  if (colonne === 'efficience') {
    const total = scoreDuCandidat(candidat, 'efficience', options);
    return total === null || !options.metric ? null : Number(chiffresMesureRune(moyenneParRune(total), options.metric));
  }
  if (colonne === 'ehp' || colonne === 'degats_reels') {
    const note = scoreDuCandidat(candidat, colonne, options);
    return note === null ? null : entierAffiche(note);
  }
  return displayedTotal(colonne, statTotal(candidat.stats, colonne), afficherDepassement);
}

/**
 * La catégorie d'une ligne non écartée. `definitive` : ses valeurs ne
 * changeront plus (vérifiée, ou sans file) ; sinon seules les colonnes
 * immuables se jugent, et elle reste potentielle faute d'échec démontré.
 */
export function categorieDeLaLigne(valeur: (c: ColonneResultat) => number | null, definitive: boolean, bornes: EtatBornes): CategorieLigne {
  const echec = definitive ? CATEGORIE_LIGNE.masquee : CATEGORIE_LIGNE.masqueeNonVerifiee;
  if (bornes.contradictoires.length) return echec;
  let nan = false;
  for (const { colonne, min, max } of bornes.actives) {
    if (!definitive && !COLONNES_IMMUABLES.has(colonne)) continue;
    const v = valeur(colonne);
    if (v === null) continue;
    if (Number.isNaN(v)) { nan = true; continue; }
    if ((min !== null && v < min) || (max !== null && v > max)) return echec;
  }
  if (!definitive) return CATEGORIE_LIGNE.potentielle;
  return nan ? CATEGORIE_LIGNE.indeterminee : CATEGORIE_LIGNE.visible;
}

/** Ce que l'index demande pour classer une ligne : sa catégorie, et la clé qui dit quand tout reclasser. */
export interface FiltreLignes {
  readonly cle: string;
  /** `etat` : 0 non vérifiée, 1 vérifiée conforme. */
  juger(ligne: number, etat: 0 | 1): CategorieLigne;
}

/** Le filtre d'une vue : sans borne active, toute ligne non écartée est dans la vue, sans lire ses valeurs. */
export function filtreDesLignes(e: {
  bornes: EtatBornes;
  avecFile: boolean;
  cle: string;
  candidat: (ligne: number) => BuildCandidate;
  valeur: (colonne: ColonneResultat, candidat: BuildCandidate) => number | null;
}): FiltreLignes {
  const definitive = (etat: 0 | 1) => etat === 1 || !e.avecFile;
  if (!e.bornes.actives.length) {
    return { cle: e.cle, juger: (_ligne, etat) => definitive(etat) ? CATEGORIE_LIGNE.visible : CATEGORIE_LIGNE.potentielle };
  }
  return {
    cle: e.cle,
    juger: (ligne, etat) => {
      let c: BuildCandidate | undefined;
      return categorieDeLaLigne((colonne) => e.valeur(colonne, c ??= e.candidat(ligne)), definitive(etat), e.bornes);
    },
  };
}

/** Sans borne : le filtre par défaut de l'index, une file présumée (non vérifiée = potentielle). */
export const SANS_FILTRE: FiltreLignes = filtreDesLignes({ bornes: AUCUNE_BORNE, avecFile: true, cle: '', candidat: () => { throw new Error('Aucune valeur lue sans borne'); }, valeur: () => null });
