// Saisie des auras EXTERNES — les sets d'aura portés par les AUTRES monstres
// de l'équipe (`DamageSetup.setsAuraExternes`), écrits par la carte « État de
// mon monstre » (EtatMonstre.tsx) et relus par la recette (optimizerRecipe.ts).
//
// ⚠️ **Les bornes se garantissent ICI, pas dans le contrôle.** `NumberField`
// ne borne qu'à la sortie du champ et à ses boutons ± : une frappe passe
// telle quelle à `onChange`, et un champ vidé y vaut `null`. Chaque écriture
// de l'écran passe donc par une fonction de ce module, qui rend toujours une
// liste que `erreurAurasExternes` accepte — la MÊME validation que celle
// d'une recette importée, jamais une seconde expression des règles.
//
// ⚠️ **Indépendant du set recherché.** Aucune fonction ne lit
// `requirement.sets` : les activations propres du build se résolvent par
// build (`AurasPropres`, damage.ts), jamais saisies ici. Choisir, changer ou
// retirer un set recherché ne crée, ne relève et ne supprime aucune aura
// externe.
//
// Source des valeurs : cadrage degats-et-aura, A.2 ter (utilisateur,
// 2026-09-23 puis 2026-09-25) — cinq autres monstres à trois sets, donc 15.
//
// Lot 7b : le RAPPEL au changement de monstre (`doitRappeler`, en fin de
// fichier) — une décision de l'écran, prise ici pour être testée sans React ;
// le composant ne fait que brancher son résultat.

import { STAT_DE_L_AURA, type DamageSetup, type SetAura } from './damage';
import { RUNE_SETS } from '../types';

export type AuraExterne = NonNullable<DamageSetup['setsAuraExternes']>[number];

// Les cinq sets d'aura, dans l'ordre de `STAT_DE_L_AURA` (Fight, Determination,
// Enhance, Accuracy, Tolerance) — DÉRIVÉS de cette table, jamais recopiés.
export const SETS_AURA = Object.keys(STAT_DE_L_AURA) as SetAura[];

// Plafond de la part externe : au plus cinq autres monstres à trois sets.
// Les activations propres du build (jusqu'à 3) s'y ajoutent HORS de ce champ.
export const PLAFOND_AURAS_EXTERNES = 15;

const SETS_CONNUS: ReadonlySet<string> = new Set(SETS_AURA);

export function estSetAura(set: unknown): set is SetAura {
  return typeof set === 'string' && SETS_CONNUS.has(set);
}

// Nom du set tel que le jeu l'écrit (`RUNE_SETS`, la table de toute l'app).
export function nomSetAura(set: SetAura): string {
  return RUNE_SETS.find((s) => s.key === set)?.label ?? set;
}

// Le libellé explicite d'une ligne — même patron pour les cinq sets.
export function libelleNombreAura(set: SetAura): string {
  return `Nombre de sets ${nomSetAura(set)} des autres monstres de l'équipe`;
}

export function sommeAurasExternes(entrees: readonly AuraExterne[] | undefined): number {
  return (entrees ?? []).reduce((somme, entree) => somme + entree.nombre, 0);
}

/**
 * Ce qui ne va pas dans une liste d'auras externes, ou `null`.
 *
 * `chemin` est RELATIF au champ (`''` pour la liste, `.0`, `.0.set`,
 * `.0.nombre`) : la recette le préfixe de `damageSetup.setsAuraExternes`.
 * Absente (`undefined`), la liste vaut zéro aura et reste acceptée.
 */
export function erreurAurasExternes(value: unknown): { chemin: string; attente: string } | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return { chemin: '', attente: 'doit être une liste' };
  const vus = new Set<string>();
  let somme = 0;
  for (const [index, entree] of value.entries()) {
    const chemin = `.${index}`;
    if (typeof entree !== 'object' || entree === null || Array.isArray(entree)) {
      return { chemin, attente: 'doit être un objet' };
    }
    const { set, nombre } = entree as Record<string, unknown>;
    if (!estSetAura(set) || vus.has(set)) return { chemin: `${chemin}.set`, attente: 'set inconnu ou répété' };
    vus.add(set);
    if (typeof nombre !== 'number' || !Number.isInteger(nombre) || nombre < 1 || nombre > PLAFOND_AURAS_EXTERNES) {
      return { chemin: `${chemin}.nombre`, attente: `doit être un entier de 1 à ${PLAFOND_AURAS_EXTERNES}` };
    }
    somme += nombre;
  }
  if (somme > PLAFOND_AURAS_EXTERNES) {
    return { chemin: '', attente: `la somme ne doit pas dépasser ${PLAFOND_AURAS_EXTERNES}` };
  }
  return null;
}

/**
 * Le plus grand nombre qu'une ligne peut porter : `15 − somme des AUTRES
 * lignes`. Jamais sous 1, pour qu'un contrôle ne reçoive jamais `min > max`
 * (une liste valide en laisse toujours au moins 1 à chacune de ses lignes).
 */
export function nombreMaxDeLaLigne(entrees: readonly AuraExterne[], set: SetAura): number {
  const autres = sommeAurasExternes(entrees) - (entrees.find((e) => e.set === set)?.nombre ?? 0);
  return Math.max(1, PLAFOND_AURAS_EXTERNES - autres);
}

// Les sets proposables dans le menu d'une ligne : le sien, plus ceux qu'aucune
// autre ligne ne porte — une seule ligne par set. Sans `set`, ceux d'une
// ligne à créer.
export function setsDisponibles(entrees: readonly AuraExterne[], set?: SetAura): SetAura[] {
  return SETS_AURA.filter((s) => s === set || !entrees.some((e) => e.set === s));
}

// Une ligne de plus est-elle possible ? Non à somme 15, ni quand les cinq sets
// ont déjà leur ligne.
export function peutAjouterAura(entrees: readonly AuraExterne[]): boolean {
  return sommeAurasExternes(entrees) < PLAFOND_AURAS_EXTERNES && setsDisponibles(entrees).length > 0;
}

/**
 * Ajoute une ligne EN DERNIER — sous les précédentes, le bouton restant au
 * même endroit — avec le premier set absent et le nombre 1. Ajout impossible
 * (`peutAjouterAura`) : la liste reçue, inchangée, lignes existantes comprises.
 */
export function ajouterAura(entrees: AuraExterne[]): AuraExterne[] {
  if (!peutAjouterAura(entrees)) return entrees;
  const libre = setsDisponibles(entrees)[0];
  return [...entrees, { set: libre, nombre: 1 }];
}

/**
 * Écrit le nombre d'une ligne, BORNÉ de 1 à `nombreMaxDeLaLigne` : un nombre
 * qui ferait dépasser 15 à la somme est ramené au maximum, jamais accepté.
 * `null` (champ vidé), un nombre non fini ou inférieur à 1 valent 1 — seule
 * la corbeille retire une ligne. Un nombre décimal est tronqué.
 */
export function changerNombreAura(entrees: AuraExterne[], set: SetAura, saisi: number | null): AuraExterne[] {
  const index = entrees.findIndex((e) => e.set === set);
  if (index < 0) return entrees;
  const brut = saisi == null || !Number.isFinite(saisi) ? 1 : Math.trunc(saisi);
  const nombre = Math.min(nombreMaxDeLaLigne(entrees, set), Math.max(1, brut));
  if (nombre === entrees[index].nombre) return entrees;
  return entrees.map((e, i) => (i === index ? { ...e, nombre } : e));
}

// Change le set d'une ligne, à sa place et avec son nombre. Refusé (liste
// inchangée) si une autre ligne porte déjà ce set.
export function changerSetAura(entrees: AuraExterne[], ancien: SetAura, nouveau: SetAura): AuraExterne[] {
  if (ancien === nouveau || !estSetAura(nouveau) || entrees.some((e) => e.set === nouveau)) return entrees;
  return entrees.map((e) => (e.set === ancien ? { ...e, set: nouveau } : e));
}

export function retirerAura(entrees: AuraExterne[], set: SetAura): AuraExterne[] {
  return entrees.filter((e) => e.set !== set);
}

/**
 * L'écho des auras dans le sous-titre de la fenêtre « Dégâts réels » : chaque
 * set externe NOMMÉ avec son nombre, puis le rappel que les sets d'aura du
 * build s'ajoutent sur chaque résultat — SANS nombre : la fenêtre ne connaît
 * aucun candidat (carte a4c2), ces activations se résolvent par build. Un
 * rendu de l'état, jamais une source de calcul.
 */
export function echoAurasExternes(entrees: readonly AuraExterne[] | undefined): string {
  const liste = (entrees ?? []).map((e) => `${e.nombre} set${e.nombre > 1 ? 's' : ''} ${nomSetAura(e.set)}`);
  return liste.length > 0
    ? `auras externes : ${liste.join(', ')} ; les sets d'aura du build s'y ajoutent sur chaque résultat`
    : `aucune aura externe ; les sets d'aura du build comptent sur chaque résultat`;
}

// ── Rappel au changement de monstre (degats-et-aura 7b) ──────────────────

/**
 * Durée d'un surlignage d'attention (réponse de l'utilisateur du 2026-10-02 :
 * « effacés après 3 s »).
 */
export const DUREE_ATTENTION_MS = 3000;

/**
 * Par où l'écran change le monstre optimisé :
 * - `liste` — un membre de la liste de travail (zone C) ;
 * - `bestiaire` — la recherche « Monstre à optimiser » (`pickSpecies`) ;
 * - `source` — une puce de source ou la désambiguïsation d'exemplaire (zone D) ;
 * - `recette` — l'import d'une recette ;
 * - `compte` — l'import d'un compte ;
 * - `rendu` — un simple rendu, premier montage compris.
 */
export type VoieChangementMonstre = 'liste' | 'bestiaire' | 'source' | 'recette' | 'compte' | 'rendu';

/** Le monstre optimisé, tel que le rappel le compare avant et après un geste. */
export interface MonstreOptimise {
  /** L'espèce (`selectedId`), `null` sans monstre choisi. */
  espece: string | null;
  /** L'exemplaire (`exclusionSelectorKey` du sélecteur actif), `null` sans exemplaire. */
  exemplaire: string | null;
  /** Les auras externes en vigueur — conservées au changement de monstre (lot 5). */
  aurasExternes: readonly AuraExterne[] | undefined;
}

/**
 * Faut-il rappeler les auras externes ? Vrai SEULEMENT quand on change de
 * monstre depuis la LISTE DE TRAVAIL — autre espèce, ou autre exemplaire de
 * la même espèce (réponse de l'utilisateur, 2026-10-02) — et que des auras
 * externes restent renseignées (celles d'après, conservées) : l'identité du
 * monstre optimisé change ce qui est « externe », mais l'app ne réécrit
 * jamais les nombres à la place de l'utilisateur.
 *
 * ⚠️ **Aucune autre voie** : ni le bestiaire, ni une puce de source ou la
 * zone D (décision de l'utilisateur sur 6bis-b19 : la liste de travail
 * seulement), ni l'import d'une recette ou d'un compte, ni un simple rendu.
 * Recliquer l'exemplaire déjà affiché ne rappelle rien.
 */
export function doitRappeler(voie: VoieChangementMonstre, avant: MonstreOptimise, apres: MonstreOptimise): boolean {
  if (voie !== 'liste') return false;
  if (sommeAurasExternes(apres.aurasExternes) === 0) return false;
  return avant.espece !== apres.espece || avant.exemplaire !== apres.exemplaire;
}
