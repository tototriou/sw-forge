import { forwardRef, ReactNode } from 'react';
import { PRESSION } from './Bouton';

// PASTILLE de filtre : une pilule à DEUX ÉTATS, posée en rangée, qu'on
// enclenche pour restreindre une liste. La box de « Mon compte » en aligne trois
// familles — élément, rareté naturelle, doublons/2A — et le Bestiaire les mêmes.
//
// ⚠️ **Ce n'est pas un `Bouton actif`.** Un bouton à état signale un MODE ou une
// option (voir `Bouton.actif`) ; une pastille POSE UN FILTRE, se lit en rangée,
// et plusieurs peuvent être enclenchées à la fois. La forme (pilule serrée,
// `text-xs`) et l'usage (grille de critères) en font une brique à part — c'est
// celle que `Bouton` annonçait déjà en tête : « toute pression qui n'est pas une
// pastille de filtre passe par ici ».
//
// ⚠️ **UN SEUL marqueur d'état, et il vient du bon endroit.** Deux schémas de
// couleur, jamais mêlés dans une même rangée :
//   - défaut (`couleurs` absent) : l'ACCENT de l'app. Actif = fond + bordure
//     accent ; au repos = neutre. C'est le cas de Nat / Doublons / 2A — ces
//     filtres n'ont pas de couleur propre, un seul style actif les rassemble.
//   - `couleurs` fourni : l'appelant PORTE la teinte (l'élément a la sienne, un
//     token). Actif = teinte légère en fond, bordure et texte colorés ; au repos
//     = même bordure colorée, atténuée. Voir `elementStyles.ts`, partagé avec le
//     Bestiaire. La couleur reste une DONNÉE de l'appelant, comme la `teinte`
//     d'une `Vignette` — jamais une valeur en dur ici.
//
// ⚠️ `data-active` est posé pour que les variantes `data-[active=true]:` des
// classes d'élément s'accrochent ; `aria-pressed` pour qu'un lecteur d'écran
// annonce l'état, pas un simple bouton.

export interface PastilleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  actif: boolean;
  icone?: ReactNode;
  libelle?: ReactNode;
  // Traitement couleur alternatif au schéma accent : l'appelant fournit bordure,
  // texte et fond actif via des tokens (typiquement `ELEMENT_FILTER_STYLES[key]`,
  // qui portent leurs variantes `data-[active=true]:`). Le fond neutre `bg-panel`
  // et l'atténuation au repos restent gérés ici.
  couleurs?: string;
}

const Pastille = forwardRef<HTMLButtonElement, PastilleProps>(function Pastille(
  { actif, icone, libelle, couleurs, className = '', type = 'button', ...reste },
  ref,
) {
  const schema = couleurs
    ? `bg-panel ${couleurs} ${actif ? '' : 'opacity-70 hoverable:opacity-100'}`
    : actif
      ? 'border-accent bg-accent-soft text-ink'
      : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent';

  return (
    <button
      ref={ref}
      type={type}
      data-active={actif}
      aria-pressed={actif}
      className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-3 py-1
        text-xs font-semibold select-none transition ${PRESSION} ${schema} ${className}`}
      {...reste}
    >
      {icone}
      {libelle != null && <span>{libelle}</span>}
    </button>
  );
});

export default Pastille;
