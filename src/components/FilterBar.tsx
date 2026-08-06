import { ELEMENTS, STAR_OPTIONS, ElementKey } from '../types';

const ELEMENT_STYLES: Record<ElementKey, string> = {
  fire: 'border-fire text-fire data-[active=true]:bg-gradient-to-br data-[active=true]:from-fire data-[active=true]:to-fire-glow',
  water: 'border-water text-water data-[active=true]:bg-gradient-to-br data-[active=true]:from-water data-[active=true]:to-water-glow',
  wind: 'border-wind text-wind data-[active=true]:bg-gradient-to-br data-[active=true]:from-wind data-[active=true]:to-wind-glow',
  light: 'border-light text-light data-[active=true]:bg-gradient-to-br data-[active=true]:from-light data-[active=true]:to-light-glow',
  dark: 'border-dark text-dark data-[active=true]:bg-gradient-to-br data-[active=true]:from-dark data-[active=true]:to-dark-glow',
  unknown: 'border-unknown text-unknown data-[active=true]:bg-gradient-to-br data-[active=true]:from-unknown data-[active=true]:to-unknown-glow',
};

const DOT_COLOR: Record<ElementKey, string> = {
  fire: 'bg-fire',
  water: 'bg-water',
  wind: 'bg-wind',
  light: 'bg-light',
  dark: 'bg-dark',
  unknown: 'bg-unknown',
};

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
                transition select-none ${ELEMENT_STYLES[el.key]}
                ${active ? 'text-bg shadow-lg' : 'hover:text-ink'}`}
            >
              <span className={`w-2 h-2 rounded-full ${active ? 'bg-bg' : DOT_COLOR[el.key]}`} />
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
