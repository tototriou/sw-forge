import { ELEMENTS, STAR_OPTIONS, ElementKey } from '../types';
import ElementIcon from './ElementIcon';
import { ELEMENT_FILTER_STYLES } from './elementStyles';


interface Props {
  activeElements: Set<ElementKey>;
  toggleElement: (k: ElementKey) => void;
  activeStars: Set<number>;
  toggleStar: (n: number) => void;
  sortMode: string;
  setSortMode: (v: string) => void;
}

export default function FilterBar({
  activeElements,
  toggleElement,
  activeStars,
  toggleStar,
  sortMode,
  setSortMode,
}: Props) {
  return (
    <div className="flex flex-col gap-3.5 mt-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1.5">
          Élément
        </span>
        {ELEMENTS.map((el) => {
          const active = activeElements.has(el.key);
          return (
            <button
              key={el.key}
              data-active={active}
              onClick={() => toggleElement(el.key)}
              className={`flex items-center gap-1.5 rounded-full border bg-panel px-3.5 py-1.5 text-[13px] font-semibold
                transition select-none ${ELEMENT_FILTER_STYLES[el.key]}
                ${active ? 'shadow' : 'opacity-70 hover:opacity-100'}`}
            >
              <ElementIcon element={el.key} size={16} />
              {el.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1.5">
          Étoiles
        </span>
        {STAR_OPTIONS.map((s) => {
          const active = activeStars.has(s);
          return (
            <button
              key={s}
              onClick={() => toggleStar(s)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-mono font-semibold transition select-none
                ${
                  active
                    ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star shadow-lg'
                    : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                }`}
            >
              {s}★
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">
          Tri interne
        </span>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
        >
          <option value="stars_desc">Étoiles ↓ puis nom</option>
          <option value="stars_asc">Étoiles ↑ puis nom</option>
          <option value="name_asc">Nom (A→Z)</option>
        </select>
      </div>
    </div>
  );
}
