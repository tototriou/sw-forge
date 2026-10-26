import { ArrowDownWideNarrow, ArrowUpDown, ArrowUpNarrowWide } from 'lucide-react';
import { Bouton } from '../../../ui';
import { COLONNES_RESULTATS, type ColonneResultat } from '../../../lib/colonnesResultats';
import type { SensTri } from '../../../lib/tri';
import type { OptimMetric } from '../../../lib/runeOptim';
import { libelleColonne } from '../../../lib/filtresAffichage';
import { RAISON_COLONNE_INDISPONIBLE } from './FiltresResultats';

// Les têtes de tri des résultats : la bande de onze têtes au-dessus des cartes
// (bureau) et les en-têtes du tableau. Un clic trie la colonne en décroissant ;
// un second clic sur la même tête passe en croissant, et retour ; une autre
// tête repart en décroissant.
// ⚠️ **Rien ne change de largeur au clic** : chaque tête réserve la place de
// son icône de sens (`ArrowUpDown` estompée tant qu'elle ne trie pas) et du
// point « borne posée » (invisible sans borne). L'icône dit l'état COURANT,
// comme `BoutonSensTri`.
// ⚠️ L'état à trois valeurs (non trié, décroissant, croissant) passe par le
// nom accessible et `actif` (`aria-pressed` sur la tête triée) : `aria-sort`
// n'est valide que sur un en-tête de colonne, que le tableau pose sur son `<th>`.

export interface TriResultats {
  tri: ColonneResultat;
  sens: SensTri;
}

/** Le tri après un clic sur la tête `colonne`. */
export function triApresClic(courant: TriResultats, colonne: ColonneResultat): TriResultats {
  return courant.tri === colonne ? { tri: colonne, sens: courant.sens === 'desc' ? 'asc' : 'desc' } : { tri: colonne, sens: 'desc' };
}

export function nomTete(colonne: ColonneResultat, metric: OptimMetric, courant: TriResultats, bornee: boolean): string {
  const triee = courant.tri === colonne ? `, tri ${courant.sens === 'desc' ? 'décroissant' : 'croissant'}` : '';
  return `${libelleColonne(colonne, metric)}${triee}${bornee ? ', borne posée' : ''}`;
}

export function IconeSens({ colonne, courant }: { colonne: ColonneResultat; courant: TriResultats }) {
  if (courant.tri !== colonne) return <ArrowUpDown size={13} className="flex-none text-ink-dimmer" aria-hidden />;
  return courant.sens === 'desc'
    ? <ArrowDownWideNarrow size={13} className="flex-none" aria-hidden />
    : <ArrowUpNarrowWide size={13} className="flex-none" aria-hidden />;
}

export function MarqueBorne({ bornee }: { bornee: boolean }) {
  return <span aria-hidden data-marque-borne="" className={`h-1.5 w-1.5 flex-none rounded-full bg-accent ${bornee ? '' : 'invisible'}`} />;
}

export interface BandeDeTriProps {
  courant: TriResultats;
  trier: (suivant: TriResultats) => void;
  metric: OptimMetric;
  disponible: (colonne: ColonneResultat) => boolean;
  bornee: (colonne: ColonneResultat) => boolean;
  inactif?: boolean;
}

/** La bande du bureau, au-dessus des cartes : des `Bouton`, pas des `Pastille` — elles trient, elles ne filtrent pas. */
export default function BandeDeTri({ courant, trier, metric, disponible, bornee, inactif = false }: BandeDeTriProps) {
  return (
    <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Trier les résultats">
      {COLONNES_RESULTATS.map((c) => {
        const libre = disponible(c);
        return (
          <Bouton
            key={c}
            taille="sm"
            actif={courant.tri === c}
            disabled={inactif || !libre}
            title={libre ? undefined : RAISON_COLONNE_INDISPONIBLE}
            aria-label={nomTete(c, metric, courant, bornee(c))}
            onClick={() => trier(triApresClic(courant, c))}
            libelle={
              <span className="inline-flex items-center gap-1">
                {libelleColonne(c, metric)}
                <IconeSens colonne={c} courant={courant} />
                <MarqueBorne bornee={bornee(c)} />
              </span>
            }
          />
        );
      })}
    </div>
  );
}
