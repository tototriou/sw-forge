// Ce que l'écran des résultats de l'Optimizer écrit de ses onze colonnes :
// libellés, unités, valeur d'une carte en texte, résumé des bornes, ligne de
// comptes. Calcul pur : la bande de têtes de tri, la grille Min / Max, le
// tableau et le panneau du téléphone le lisent, au lieu d'en écrire chacun une
// copie (docs/02-app/optimizer/ecran/resultats.md, « Filtres d'affichage par
// colonne »).

import { RECO_STATS } from '../types';
import { COLONNES_RESULTATS, type ColonneResultat } from './colonnesResultats';
import type { BornesResultats } from './filtresResultats';
import type { OptimMetric } from './runeOptim';
import { chiffresMesureRune } from './valeursAffichees';
import { STATS_AVEC_BASE } from './stats';
import type { StatKey } from './effects';
import type { ComptesDeLaVue } from './classementCompact';

/** Le libellé du code : stats de `RECO_STATS`, objectifs d'`OBJECTIVE_LABELS` ; la mesure suit le réglage Efficience / Score SW. */
export function libelleColonne(colonne: ColonneResultat, metric: OptimMetric): string {
  if (colonne === 'efficience') return metric === 'eff' ? 'Efficience' : 'Score SW';
  if (colonne === 'degats_reels') return 'Dégâts réels';
  if (colonne === 'ehp') return 'PV effectifs';
  return RECO_STATS.find((s) => s.key === colonne)!.label;
}

/** L'unité que la carte écrit après la valeur : « % » des quatre stats en pourcentage et de l'efficience. */
export function suffixeColonne(colonne: ColonneResultat, metric: OptimMetric): string {
  if (colonne === 'efficience') return metric === 'eff' ? '%' : '';
  if (colonne === 'degats_reels' || colonne === 'ehp') return '';
  return RECO_STATS.find((s) => s.key === colonne)!.suffix;
}

/**
 * Les chiffres d'une valeur au plus large qu'une colonne doit montrer sans
 * rogner — la largeur d'une borne dans le tableau : PV à 5 chiffres, PV
 * effectifs et dégâts à 6 (« 150000 », décision de l'utilisateur), trois
 * pour les pourcentages, la vitesse et la mesure.
 */
export const CHIFFRES_MAX_COLONNE: Readonly<Record<ColonneResultat, number>> = {
  // Efficience : trois chiffres, le point et une décimale (« 118.6 »).
  hp: 5, atk: 4, def: 4, spd: 3, cr: 3, cd: 3, res: 3, acc: 3, efficience: 5, degats_reels: 6, ehp: 6,
};

/** Les décimales qu'une borne admet : celles que la carte écrit (une pour l'Efficience, aucune ailleurs). */
export function decimalesColonne(colonne: ColonneResultat, metric: OptimMetric): number {
  return colonne === 'efficience' && metric === 'eff' ? 1 : 0;
}

// ── Total ou bonus (tableau des résultats) ────────────────────────────────
// Un réglage d'AFFICHAGE du tableau : en bonus, PV, ATQ, DEF et VIT montrent
// total − base du monstre ; les autres colonnes ne changent pas (Taux Crit,
// Dmg Crit, RES, Précision toujours en total, `STATS_AVEC_BASE`). Les bornes
// restent en total dans le classeur : seules leur écriture et leur saisie
// suivent le mode, par ces deux fonctions, l'une l'inverse exacte de l'autre.

/** La part de la base retirée d'une colonne en bonus (0 en total, ou pour une colonne sans base). */
export function decalageBonus(colonne: ColonneResultat, base: Partial<Record<StatKey, number>>, enBonus: boolean): number {
  return enBonus && STATS_AVEC_BASE.has(colonne as StatKey) ? base[colonne as StatKey] ?? 0 : 0;
}

/** Une valeur ou une borne en total, écrite dans le mode affiché. */
export function versAffichage(colonne: ColonneResultat, total: number, base: Partial<Record<StatKey, number>>, enBonus: boolean): number {
  return total - decalageBonus(colonne, base, enBonus);
}

/** Une saisie dans le mode affiché, ramenée au total que garde le classeur. */
export function depuisAffichage(colonne: ColonneResultat, affiche: number, base: Partial<Record<StatKey, number>>, enBonus: boolean): number {
  return affiche + decalageBonus(colonne, base, enBonus);
}

/** Une valeur de colonne écrite comme la carte : séparateur de milliers, une décimale pour l'efficience. */
export function texteValeurColonne(colonne: ColonneResultat, valeur: number | null, metric: OptimMetric): string {
  if (valeur === null || Number.isNaN(valeur)) return '—';
  const nombre = colonne === 'efficience' ? chiffresMesureRune(valeur, metric) : Math.round(valeur).toLocaleString('fr-FR');
  return `${nombre}${suffixeColonne(colonne, metric)}`;
}

/** Une borne écrite pour le résumé comme la carte écrit la valeur : « 220 », « 85% », « 150 000 ». */
function texteBorne(colonne: ColonneResultat, v: number, metric: OptimMetric): string {
  return `${v.toLocaleString('fr-FR')}${suffixeColonne(colonne, metric)}`;
}

/** Les colonnes bornées (au moins un côté posé), dans l'ordre des colonnes. */
export function colonnesBornees(bornes: BornesResultats): ColonneResultat[] {
  return COLONNES_RESULTATS.filter((c) => bornes[c] && (bornes[c]!.min !== null || bornes[c]!.max !== null));
}

/** Une colonne dont le minimum dépasse le maximum : la vue est vide, rien n'est corrigé. */
export function colonneContradictoire(bornes: BornesResultats, colonne: ColonneResultat): boolean {
  const b = bornes[colonne];
  return !!b && b.min !== null && b.max !== null && b.min > b.max;
}

/**
 * Le résumé des bornes posées, en une ligne : « VIT ≥ 220 · 30% ≤ Taux Crit
 * ≤ 100% ». Une borne sur une colonne indisponible (Dégâts réels sans sort
 * calculable) est dite inactive : elle ne masque rien.
 */
export function resumeDesBornes(bornes: BornesResultats, metric: OptimMetric, disponible: (c: ColonneResultat) => boolean): string {
  return colonnesBornees(bornes).map((c) => {
    const { min, max } = bornes[c]!;
    const nom = libelleColonne(c, metric), f = (v: number) => texteBorne(c, v, metric);
    const texte = min !== null && max !== null ? `${f(min)} ≤ ${nom} ≤ ${f(max)}` : min !== null ? `${nom} ≥ ${f(min)}` : `${nom} ≤ ${f(max!)}`;
    return disponible(c) ? texte : `${texte} (inactive)`;
  }).join(' · ');
}

const pluriel = (n: number, mot: string) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

/**
 * La ligne de comptes sous les bornes de la vue : visibles, masquées (vérifiées
 * ou en échec démontré), non vérifiées encore possibles, indéterminées (une
 * valeur incalculable sous une borne). Sans borne active : « Aucun filtre ».
 * `court` : le téléphone, où « indéterminées » s'abrège.
 */
export function ligneDesComptes(comptes: ComptesDeLaVue | null, actives: number, court = false): string {
  if (!actives || !comptes) return 'Aucun filtre';
  const parts = [pluriel(comptes.visiblesConfirmes, 'visible'), pluriel(comptes.masquesConfirmes + comptes.masquesNonVerifies, 'masquée')];
  if (comptes.potentielsNonVerifies) parts.push(`${comptes.potentielsNonVerifies.toLocaleString('fr-FR')} à vérifier`);
  if (comptes.indeterminesNumeriques) parts.push(court ? `${comptes.indeterminesNumeriques.toLocaleString('fr-FR')} ind.` : pluriel(comptes.indeterminesNumeriques, 'indéterminée'));
  return `Filtres : ${parts.join(' · ')}`;
}
