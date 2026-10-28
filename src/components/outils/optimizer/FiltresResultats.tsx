import { Fragment } from 'react';
import { RotateCcw } from 'lucide-react';
import { Bouton, NumberField } from '../../../ui';
import { COLONNES_RESULTATS, type ColonneResultat } from '../../../lib/colonnesResultats';
import type { BornesResultats } from '../../../lib/filtresResultats';
import type { OptimMetric } from '../../../lib/runeOptim';
import { colonneContradictoire, decimalesColonne, libelleColonne, suffixeColonne } from '../../../lib/filtresAffichage';

// « Filtrer l'affichage » : une borne minimum et une borne maximum par colonne
// des résultats, la grille de `Conditions` (libellé, Min, Max, `NumberField`).
// ⚠️ **Un seul JSX, deux contenants** (deux-formats.md) : le `Flottant` ancré
// au bouton au bureau, le `MobileSheet` au téléphone.
// ⚠️ Des filtres d'AFFICHAGE, séparés des conditions de recherche auxquelles
// la grille ressemble trait pour trait : la phrase fixe le dit, et la grille
// vit dans l'en-tête des résultats, jamais dans « Critères de recherche ».

export const RAISON_COLONNE_INDISPONIBLE = 'Aucun sort calculable pour ce monstre';

export interface FiltresResultatsProps {
  bornes: BornesResultats;
  poserBorne: (colonne: ColonneResultat, cote: 'min' | 'max', valeur: number | null) => void;
  effacer: () => void;
  metric: OptimMetric;
  disponible: (colonne: ColonneResultat) => boolean;
}

export function BoutonEffacerFiltres({ effacer, actif }: { effacer: () => void; actif: boolean }) {
  return (
    <Bouton
      fond="vide"
      trait="aucun"
      taille="sm"
      onClick={effacer}
      disabled={!actif}
      icone={<RotateCcw size={13} />}
      libelle="Effacer les filtres"
    />
  );
}

export default function FiltresResultats({ bornes, poserBorne, effacer, metric, disponible }: FiltresResultatsProps) {
  const actif = COLONNES_RESULTATS.some((c) => bornes[c]?.min != null || bornes[c]?.max != null);
  return (
    <div>
      <p className="mb-2 text-xs text-ink-dim">Masque des builds déjà trouvés ; ne relance pas la recherche.</p>
      {/* `w-fit` : la grille garde ses colonnes serrées, comme `Conditions`. */}
      <div className="grid w-fit grid-cols-[minmax(76px,auto)_auto_auto] items-center gap-x-2 gap-y-1.5 lg:gap-x-3">
        <span aria-hidden />
        {/* Pas `.label` : le panneau du téléphone (`data-tiroir`) le masque, et la grille se décalerait. */}
        <span className="text-center text-micro font-semibold uppercase tracking-wider text-ink-dim">Min</span>
        <span className="text-center text-micro font-semibold uppercase tracking-wider text-ink-dim">Max</span>
        {COLONNES_RESULTATS.map((c) => {
          const libre = disponible(c);
          const nom = libelleColonne(c, metric);
          const ton = libre && colonneContradictoire(bornes, c) ? 'bad' : 'neutre';
          return (
            <Fragment key={c}>
              <span className={`text-xs ${libre ? 'text-ink' : 'text-ink-dimmer'}`} title={libre ? undefined : RAISON_COLONNE_INDISPONIBLE}>
                {nom}
              </span>
              {(['min', 'max'] as const).map((cote) => (
                <NumberField
                  key={cote}
                  value={bornes[c]?.[cote] ?? null}
                  onChange={(v) => poserBorne(c, cote, v)}
                  allowEmpty
                  // Aucune colonne n'est négative : « − » s'arrête à 0.
                  min={0}
                  // Une décimale pour l'Efficience, comme la carte l'écrit.
                  decimales={decimalesColonne(c, metric)}
                  disabled={!libre}
                  ton={ton}
                  placeholder="—"
                  suffix={suffixeColonne(c, metric) || undefined}
                  // Six chiffres et le suffixe sans rogner (« 150000 »).
                  boxWidth="w-28"
                  ariaLabel={`${nom} ${cote === 'min' ? 'minimum' : 'maximum'} affiché`}
                  title={libre ? (cote === 'min' ? 'Minimum' : 'Maximum') : RAISON_COLONNE_INDISPONIBLE}
                />
              ))}
            </Fragment>
          );
        })}
      </div>
      <div className="mt-2 flex justify-end">
        <BoutonEffacerFiltres effacer={effacer} actif={actif} />
      </div>
    </div>
  );
}
