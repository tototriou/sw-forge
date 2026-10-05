import { ELEMENTS, STAR_OPTIONS, ElementKey } from '../types';
import ElementIcon from './ElementIcon';
import Pastille from '../ui/Pastille';
import Selecteur from '../ui/Selecteur';
import { ELEMENT_FILTER_STYLES } from './elementStyles';

interface Props {
  activeElements: Set<ElementKey>;
  toggleElement: (k: ElementKey) => void;
  activeStars: Set<number>;
  toggleStar: (n: number) => void;
  sortMode: string;
  setSortMode: (v: string) => void;
  // Le tri dans la barre (défaut) ou ailleurs : à la SOURIS, la page le pose
  // sur la ligne de la pagination (`TriInterne`), comme « Ma box ».
  avecTri?: boolean;
  className?: string;
}

// ⚠️ **Les contrôles de la LIBRAIRIE** (refonte graphique, lot 10) — `Pastille`
// et `Selecteur`, comme les filtres de « Ma box ». Ils étaient dessinés à la
// main ici (boutons, `<select>` natif) : le même filtre d'élément se
// présentait autrement d'un écran à l'autre. La teinte de l'élément reste
// portée par l'appelant (`ELEMENT_FILTER_STYLES`), comme dans la box.
export default function FilterBar({
  activeElements,
  toggleElement,
  activeStars,
  toggleStar,
  sortMode,
  setSortMode,
  avecTri = true,
  className = 'mt-5 flex flex-col gap-3.5',
}: Props) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1.5">Élément</span>
        {ELEMENTS.map((el) => (
          <Pastille
            key={el.key}
            actif={activeElements.has(el.key)}
            couleurs={ELEMENT_FILTER_STYLES[el.key]}
            onClick={() => toggleElement(el.key)}
            icone={<ElementIcon element={el.key} size={15} />}
            libelle={el.label}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1.5">Étoiles</span>
        {STAR_OPTIONS.map((s) => (
          <Pastille
            key={s}
            actif={activeStars.has(s)}
            onClick={() => toggleStar(s)}
            className="font-mono"
            libelle={`${s}★`}
          />
        ))}
      </div>

      {avecTri && <TriInterne sortMode={sortMode} setSortMode={setSortMode} />}
    </div>
  );
}

// Le tri, avec son intitulé. Posé dans la barre au doigt, sur la ligne de la
// pagination à la souris.
export function TriInterne({ sortMode, setSortMode }: Pick<Props, 'sortMode' | 'setSortMode'>) {
  return (
    <label className="flex items-center gap-2.5">
      <span className="label">Tri interne</span>
      <Selecteur
        taille="md"
        pleineLargeur={false}
        value={sortMode}
        onChange={(e) => setSortMode(e.target.value)}
        // 32 px à la souris, comme le tri de la Liste des runes.
        className="lg:h-8 lg:py-0 lg:text-xs"
      >
        <option value="stars_desc">Étoiles ↓ puis nom</option>
        <option value="stars_asc">Étoiles ↑ puis nom</option>
        <option value="name_asc">Nom (A→Z)</option>
      </Selecteur>
    </label>
  );
}
