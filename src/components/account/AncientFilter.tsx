import Segmented from '../../ui/Segmented';
import { RuneDetail } from '../../types';
import { isAncient } from '../../lib/effects';

// Filtre antique COMMUN à toutes les pages qui affichent des runes (Liste,
// Comparaison, Courbes, Optimisation).
//
// ⚠️ **Trois états, pas une bascule.** « Antiques » on/off ne disait que
// « garder » ou « masquer » ; il manquait « n'afficher QU'ELLES ». Les antiques
// ont leurs propres tables de max, donc un potentiel et une efficience qui ne se
// comparent pas à ceux d'une rune normale : pouvoir les ISOLER autant que les
// écarter évite de mélanger deux échelles dans un même classement. Né sur
// l'Optimisation, remonté ici pour que le même filtre serve partout.
export type AncientFilter = 'all' | 'without' | 'only';

export const ANCIENTS: { key: AncientFilter; label: string; hint: string }[] = [
  { key: 'all', label: 'Toutes', hint: 'Runes normales et antiques' },
  { key: 'only', label: 'Antiques uniquement', hint: 'Uniquement les runes antiques' },
  { key: 'without', label: 'Aucune antique', hint: 'Masquer les runes antiques' },
];

export function keepAncient(rune: RuneDetail, filter: AncientFilter): boolean {
  if (filter === 'all') return true;
  return isAncient(rune) === (filter === 'only');
}

// ⚠️ Garde de valeur « collante ». `useStickyState` retombe sur son cache
// mémoire ; une valeur d'une version antérieure — l'ancien booléen de la bascule
// « Antiques » — n'est plus du bon type. On la ramène : `true` (on ne gardait que
// les antiques) → `only`, tout le reste → `all`. Même principe que `estTriConnu`.
export function estFiltreAntique(v: unknown): v is AncientFilter {
  return v === 'all' || v === 'without' || v === 'only';
}
export function normFiltreAntique(v: unknown): AncientFilter {
  if (estFiltreAntique(v)) return v;
  return v === true ? 'only' : 'all';
}

// Le contrôle : le `Segmented` à trois crans. `size` reste ouvert — `lg` pour
// qu'il prenne toute la largeur dans le panneau « Options » du téléphone, défaut
// serré dans une rangée de filtres au bureau.
export default function AncientFilter({
  value,
  onChange,
  size,
}: {
  value: AncientFilter;
  onChange: (v: AncientFilter) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  return <Segmented value={value} onChange={onChange} options={ANCIENTS} size={size} />;
}
