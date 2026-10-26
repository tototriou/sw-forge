import { type ReactNode } from 'react';
import { Bouton, NumberField, ZoneCliquable } from '../../../ui';
import { COLONNES_RESULTATS, type ColonneResultat } from '../../../lib/colonnesResultats';
import type { BornesResultats } from '../../../lib/filtresResultats';
import type { CarteClassement } from '../../../lib/classementCompact';
import { candidateMetricTotal, statTotal, type BuildCandidate } from '../../../lib/runeBuildOptim';
import type { OptimMetric } from '../../../lib/runeOptim';
import type { StatKey } from '../../../lib/effects';
import type { RuneDetail } from '../../../types';
import { displayedTotal, moyenneParRune } from '../../../lib/valeursAffichees';
import {
  CHIFFRES_MAX_COLONNE, colonneContradictoire, decimalesColonne, depuisAffichage, libelleColonne, suffixeColonne, texteValeurColonne, versAffichage,
} from '../../../lib/filtresAffichage';
import { IconeSens, MarqueBorne, nomTete, triApresClic, type TriResultats } from './TetesDeTri';
import { RAISON_COLONNE_INDISPONIBLE } from './FiltresResultats';

// La forme TABLEAU des résultats, au bureau : une ligne par build, des
// en-têtes qui trient, deux lignes de bornes Min / Max sous eux ; un clic sur
// une ligne (ou sur son rang, au clavier) ouvre la carte telle quelle dans une
// `Modale` (OptimizerSection.tsx).
// ⚠️ **Une colonne, un seul bord** : le bouton de tri, les deux champs de
// borne et les valeurs prennent toute la largeur de leur colonne, avec le même
// rembourrage de cellule, et se centrent : leurs bords coïncident.
// ⚠️ **Les colonnes prennent la largeur de leur contenu** (mise en page
// automatique du `<table>`) : un en-tête de deux mots passe sur deux lignes,
// chaque borne a au moins la largeur de la plus grande valeur de sa colonne
// (`CHIFFRES_MAX_COLONNE`, en `ch` de la police du champ). La largeur minimale
// ainsi obtenue fixe le seuil sous lequel les cartes la remplacent
// (`TABLEAU_VISIBLE`, requête de conteneur, plus bas).
// Pas de composant de librairie : un `<table>` est une mise en page, et
// celui-ci est le premier tableau triable de l'app ; ses contrôles viennent
// de `src/ui/` (`Bouton` pour les en-têtes, `ZoneCliquable` pour le rang,
// `NumberField`).

/**
 * Le seuil du tableau : la largeur minimale mesurée du conteneur des résultats
 * où le tableau tient sans rien rogner, PV effectifs à six chiffres, PV à cinq
 * et bornes « 150000 » posées, mesurée dans l'app construite, polices
 * chargées, chaque valeur remplacée par la plus large de sa colonne (le test
 * tests/rendu/optimizer-tableau-navigateur.test.ts, aux polices de repli,
 * vérifie qu'au seuil rien n'est rogné). En dessous, les cartes.
 * Classes écrites en entier : Tailwind ne voit que celles qui figurent telles
 * quelles dans la source.
 */
export const SEUIL_TABLEAU_PX = 661;
export const TABLEAU_VISIBLE = 'hidden @[661px]/resultats:block';
export const CARTES_SOUS_LE_SEUIL = '@[661px]/resultats:hidden';
// Un contrôle propre au tableau, dans une rangée flexible : visible avec lui seulement.
export const AVEC_LE_TABLEAU = 'hidden @[661px]/resultats:flex';

// La largeur minimale d'un champ de borne : les chiffres de la plus grande
// valeur en `ch` de la police du champ (le cadre la porte : `font-mono
// text-sm`, celle de la saisie), son rembourrage (`px-1`), son contour, et le
// suffixe « % » quand la colonne en a un.
const MIN_CHAMP: Record<string, string> = {
  '3': 'min-w-[calc(3ch_+_0.5rem_+_2px)]', '3%': 'min-w-[calc(3ch_+_1.375rem_+_2px)]',
  '4': 'min-w-[calc(4ch_+_0.5rem_+_2px)]', '5': 'min-w-[calc(5ch_+_0.5rem_+_2px)]',
  '5%': 'min-w-[calc(5ch_+_1.375rem_+_2px)]', '6': 'min-w-[calc(6ch_+_0.5rem_+_2px)]',
};

/** Une valeur de colonne pour un build, celle que la carte écrit (et que la borne juge), en total. */
export function valeurDeColonne(colonne: ColonneResultat, carte: Pick<CarteClassement, 'candidat' | 'pvEffectifs' | 'degatsReels'>,
  runeById: Map<number, RuneDetail>, metric: OptimMetric, afficherDepassement: boolean): number | null {
  const c: BuildCandidate = carte.candidat;
  if (colonne === 'efficience') return moyenneParRune(candidateMetricTotal(c, runeById, metric));
  if (colonne === 'ehp') return carte.pvEffectifs;
  if (colonne === 'degats_reels') return carte.degatsReels;
  return displayedTotal(colonne, statTotal(c.stats, colonne), afficherDepassement);
}

export interface TableauResultatsProps {
  cartes: CarteClassement[];
  premierRang: number;
  placesEnAttente: number;
  runeById: Map<number, RuneDetail>;
  metric: OptimMetric;
  afficherDepassement: boolean;
  tri: TriResultats;
  trier: (suivant: TriResultats) => void;
  // Les bornes, toujours en TOTAL : le tableau les écrit et les saisit dans le mode affiché.
  bornes: BornesResultats;
  poserBorne: (colonne: ColonneResultat, cote: 'min' | 'max', valeur: number | null) => void;
  disponible: (colonne: ColonneResultat) => boolean;
  ouvrirDetail: (index: number) => void;
  // La vue vide (bornes contradictoires, plus rien sous les filtres) : la phrase, à la place des lignes.
  vide: ReactNode;
  inactif?: boolean;
  // « Bonus » : PV, ATQ, DEF et VIT en total − base du monstre (`base`), valeurs comme bornes.
  enBonus?: boolean;
  base?: Partial<Record<StatKey, number>>;
}

export default function TableauResultats({ cartes, premierRang, placesEnAttente, runeById, metric, afficherDepassement, tri, trier,
  bornes, poserBorne, disponible, ouvrirDetail, vide, inactif = false, enBonus = false, base = {} }: TableauResultatsProps) {
  const bornee = (c: ColonneResultat) => bornes[c]?.min != null || bornes[c]?.max != null;
  const largeurTotale = COLONNES_RESULTATS.length + 1;
  // La colonne triée, légèrement teintée sur toute sa hauteur.
  const teinte = (c: ColonneResultat) => (tri.tri === c ? 'bg-accent-soft' : '');
  return (
    <div className="mb-3 overflow-x-auto rounded-xl border border-border bg-panel" data-tableau-resultats="">
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr className="border-b border-border-soft">
            <th scope="col" className="px-1 py-1 text-center align-bottom text-micro font-semibold text-ink-dim">#</th>
            {COLONNES_RESULTATS.map((c) => {
              const libre = disponible(c);
              const triee = tri.tri === c;
              return (
                <th key={c} scope="col" className={`px-1 py-1 align-bottom ${teinte(c)}`} data-colonne={c}
                  aria-sort={triee ? (tri.sens === 'desc' ? 'descending' : 'ascending') : 'none'}>
                  {/* Le bouton de la bande des cartes, sur toute la largeur de
                      sa colonne ; la colonne triée en accent plein. */}
                  <Bouton
                    taille="sm"
                    pleineLargeur
                    ton={triee ? 'accent' : 'neutre'}
                    fond={triee ? 'plein' : 'vide'}
                    disabled={inactif || !libre}
                    title={libre ? undefined : RAISON_COLONNE_INDISPONIBLE}
                    aria-label={nomTete(c, metric, tri, bornee(c))}
                    onClick={() => trier(triApresClic(tri, c))}
                    // ⚠️ Rembourrage latéral réduit à 4 px dans la cellule (`!` :
                    // une classe de taille l'emporterait selon l'ordre de la
                    // feuille), et le sens SOUS le libellé : onze têtes côte à
                    // côte, la largeur du tableau se joue là (seuil plus bas).
                    className="!px-1 text-center leading-tight"
                    libelle={
                      <span className="flex flex-col items-center gap-0.5 py-0.5">
                        <span>{libelleColonne(c, metric)}</span>
                        <span className="inline-flex items-center gap-1">
                          <IconeSens colonne={c} courant={tri} />
                          <MarqueBorne bornee={bornee(c)} />
                        </span>
                      </span>
                    }
                  />
                </th>
              );
            })}
          </tr>
          {(['min', 'max'] as const).map((cote) => (
            <tr key={cote} className={cote === 'max' ? 'border-b border-border' : ''}>
              <th scope="row" className="px-1 py-0.5 text-center text-micro font-semibold text-ink-dim">{cote === 'min' ? 'Min' : 'Max'}</th>
              {COLONNES_RESULTATS.map((c) => {
                const libre = disponible(c), nom = libelleColonne(c, metric), suffixe = suffixeColonne(c, metric);
                const total = bornes[c]?.[cote] ?? null;
                return (
                  <td key={c} className={`px-1 py-0.5 text-center ${teinte(c)}`} data-colonne={c}>
                    <NumberField
                      // Écrite et saisie dans le mode affiché ; le classeur la garde en total.
                      value={total === null ? null : versAffichage(c, total, base, enBonus)}
                      onChange={(v) => poserBorne(c, cote, v === null ? null : depuisAffichage(c, v, base, enBonus))}
                      allowEmpty
                      min={0}
                      sansBoutons
                      decimales={decimalesColonne(c, metric)}
                      disabled={!libre}
                      ton={libre && colonneContradictoire(bornes, c) ? 'bad' : 'neutre'}
                      placeholder="—"
                      suffix={suffixe || undefined}
                      boxWidth={`w-full font-mono text-sm ${MIN_CHAMP[`${CHIFFRES_MAX_COLONNE[c]}${suffixe ? '%' : ''}`]}`}
                      ariaLabel={`${nom} ${cote === 'min' ? 'minimum' : 'maximum'} affiché`}
                      title={libre ? (cote === 'min' ? 'Minimum' : 'Maximum') : RAISON_COLONNE_INDISPONIBLE}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {vide ? (
            <tr>
              <td colSpan={largeurTotale} className="px-3 py-6 text-center text-xs text-ink-dim">{vide}</td>
            </tr>
          ) : (
            <>
              {cartes.map((carte, i) => {
                const rang = premierRang + i;
                return (
                  <tr key={carte.candidat.runeIds.join('-')} onClick={() => ouvrirDetail(i)}
                    className="cursor-pointer border-b border-border-soft last:border-0 hoverable:bg-panel2">
                    <td className="px-1 py-1 text-center">
                      <ZoneCliquable
                        onClick={(e) => { e.stopPropagation(); ouvrirDetail(i); }}
                        aria-label={`Détail du build n° ${rang}`}
                        // La ligne entière ouvre le détail : au doigt, la règle
                        // des 40 px n'a pas à grandir la rangée pour ce rang.
                        data-cible-fine=""
                        className="font-mono font-bold text-star"
                      >
                        {rang}
                      </ZoneCliquable>
                    </td>
                    {COLONNES_RESULTATS.map((c) => {
                      const v = disponible(c) ? valeurDeColonne(c, carte, runeById, metric, afficherDepassement) : null;
                      return (
                        <td key={c} data-colonne={c} className={`whitespace-nowrap px-1 py-1 text-center font-mono ${teinte(c)} ${
                          !disponible(c) ? 'text-ink-dimmer' : tri.tri === c ? 'font-semibold text-ink' : 'text-ink'}`}>
                          {texteValeurColonne(c, v === null ? null : versAffichage(c, v, base, enBonus), metric)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {Array.from({ length: placesEnAttente }, (_, j) => (
                <tr key={`verification-${premierRang + cartes.length + j}`} className="border-b border-border-soft last:border-0">
                  <td className="px-1 py-1 text-center font-mono font-bold text-ink-dimmer">{premierRang + cartes.length + j}</td>
                  <td colSpan={COLONNES_RESULTATS.length} className="px-1 py-1 text-ink-dim">Vérification…</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
