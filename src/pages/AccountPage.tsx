import { memo, useMemo, useState } from 'react';
import { Search, Boxes, Copy, Star } from 'lucide-react';
import { BoxItem } from '../lib/applyAccount';
import { ELEMENTS, ElementKey, Monster, RuneDetail, ArtifactDetail } from '../types';
import { LoadState } from '../hooks/useMonsters';
import ElementIcon from '../components/ElementIcon';
import RunesSection from '../components/account/RunesSection';
import ArtifactsSection from '../components/account/ArtifactsSection';

type Sub = 'monstres' | 'runes' | 'artefacts';

interface Props {
  sub: Sub; // sous-section pilotée par le dropdown de nav (« Mon compte »)
  box: BoxItem[];
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  loadState: LoadState;
}

// Styles de chips d'élément (repris de FilterBar pour rester cohérent).
const ELEMENT_STYLES: Record<ElementKey, string> = {
  fire: 'border-fire text-fire',
  water: 'border-water text-water',
  wind: 'border-wind text-wind',
  light: 'border-light text-light',
  dark: 'border-dark text-dark',
  unknown: 'border-unknown text-unknown',
};

const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};
const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// Un monstre unique de la box + son nombre d'exemplaires possédés.
interface BoxEntry {
  monster: Monster;
  count: number;
}

// Une carte de la box : portrait + nom, avec une bulle ×N si doublons.
const BoxCard = memo(function BoxCard({ entry }: { entry: BoxEntry }) {
  const m = entry.monster;
  return (
    <div className="relative rounded-xl border border-border bg-panel px-2 pt-3 pb-2.5 text-center">
      <div className="relative w-[64px] mx-auto mb-1.5">
        <div className={`hex-frame w-[64px] h-[64px] p-[2px] bg-gradient-to-br ${GRADIENT[m.element]}`}>
          <div className="hex-frame w-full h-full bg-panel2 flex items-center justify-center overflow-hidden">
            {m.image ? (
              <img src={m.image} alt={m.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <span className={`font-display font-bold text-lg ${TEXT[m.element]}`}>
                {initials(m.name)}
              </span>
            )}
          </div>
        </div>
        <ElementIcon
          element={m.element}
          size={18}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
        {entry.count > 1 && (
          <span
            className="absolute -bottom-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center
                       rounded-full bg-[#2b3170] border border-[#4a52a0] text-ink font-mono text-[11px] font-bold
                       shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
            title={`${entry.count} exemplaires`}
          >
            ×{entry.count}
          </span>
        )}
      </div>
      <div className="text-[12px] font-semibold leading-tight line-clamp-2">{m.name}</div>
    </div>
  );
});

// Sous-section « Box de monstres » (tous les 6★, dédupliqués, filtrables).
function MonsterBoxSection({ box }: { box: BoxItem[] }) {
  const [query, setQuery] = useState('');
  const [activeElements, setActiveElements] = useState<Set<ElementKey>>(new Set());
  const [activeStars, setActiveStars] = useState<Set<number>>(new Set());
  const [dupesOnly, setDupesOnly] = useState(false);
  const [secondOnly, setSecondOnly] = useState(false);

  function toggleElement(k: ElementKey) {
    setActiveElements((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }
  function toggleStar(n: number) {
    setActiveStars((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }

  // Dédup par monstre (com2usId identique = même monstre) + comptage des exemplaires,
  // puis tri par élément (Eau → Feu → Vent → Lumière → Ténèbres → Autre) et par nom.
  const entries = useMemo(() => {
    const rank: Record<ElementKey, number> = {
      water: 0,
      fire: 1,
      wind: 2,
      light: 3,
      dark: 4,
      unknown: 5,
    };
    const byMonster = new Map<string, BoxEntry>();
    for (const it of box) {
      const id = String(it.monster.id);
      const e = byMonster.get(id);
      if (e) e.count += 1;
      else byMonster.set(id, { monster: it.monster, count: 1 });
    }
    return Array.from(byMonster.values()).sort(
      (a, b) =>
        rank[a.monster.element] - rank[b.monster.element] ||
        a.monster.name.localeCompare(b.monster.name, 'fr')
    );
  }, [box]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (q && !e.monster.name.toLowerCase().includes(q)) return false;
      if (activeElements.size && !activeElements.has(e.monster.element)) return false;
      if (activeStars.size && !(e.monster.naturalStars != null && activeStars.has(e.monster.naturalStars)))
        return false;
      if (dupesOnly && e.count < 2) return false;
      if (secondOnly && !e.monster.secondAwaken) return false;
      return true;
    });
  }, [entries, query, activeElements, activeStars, dupesOnly, secondOnly]);

  return (
    <div>
      <p className="font-mono text-ink-dim text-xs mb-4">
        {entries.length} monstre{entries.length > 1 ? 's' : ''} différent{entries.length > 1 ? 's' : ''}
        {box.length !== entries.length && ` · ${box.length} au total`} · 6★
      </p>

      <div className="flex flex-col gap-3 mb-4">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-dim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un monstre…"
            className="w-full bg-panel border border-border rounded-lg pl-8 pr-3 py-1.5 text-[13px]
                       text-ink outline-none focus:border-[#5b63b8]"
          />
        </div>

        {/* Filtre élément */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Élément</span>
          {ELEMENTS.filter((el) => el.key !== 'unknown').map((el) => {
            const active = activeElements.has(el.key);
            return (
              <button
                key={el.key}
                onClick={() => toggleElement(el.key)}
                className={`flex items-center gap-1.5 rounded-full border bg-panel px-3 py-1 text-[12.5px] font-semibold
                  transition select-none ${ELEMENT_STYLES[el.key]}
                  ${active ? 'bg-panel2 shadow' : 'opacity-70 hover:opacity-100'}`}
              >
                <ElementIcon element={el.key} size={15} />
                {el.label}
              </button>
            );
          })}
        </div>

        {/* Filtre rareté naturelle + doublons + 2A */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim mr-1">Nat</span>
          {[5, 4, 3, 2].map((s) => {
            const active = activeStars.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStar(s)}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-mono font-semibold transition select-none
                  ${
                    active
                      ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star shadow'
                      : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
                  }`}
              >
                {s}★
              </button>
            );
          })}
          <button
            onClick={() => setDupesOnly((v) => !v)}
            className={`ml-1 flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                dupesOnly
                  ? 'bg-[#2b3170] border-[#4a52a0] text-ink shadow'
                  : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
              }`}
          >
            <Copy size={13} /> Doublons
          </button>
          <button
            onClick={() => setSecondOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition select-none
              ${
                secondOnly
                  ? 'bg-[#5a3a12] border-star text-star shadow'
                  : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
              }`}
            title="Monstres à second éveil (double éveil)"
          >
            <Star size={13} /> 2A
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-ink-dim text-[13px]">Aucun monstre ne correspond aux filtres.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 items-start">
          {filtered.map((e) => (
            <BoxCard key={e.monster.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AccountPage({ sub, box, runes, artifacts, loadState }: Props) {
  const empty = box.length === 0 && runes.length === 0 && artifacts.length === 0;

  if (empty) {
    return (
      <div className="mt-10 flex flex-col items-center text-center text-ink-dim">
        <Boxes size={40} className="mb-3 opacity-60" />
        <p className="text-[15px] font-semibold text-ink">Aucune donnée de compte chargée</p>
        <p className="mt-1 text-[13px] max-w-sm">
          Importe ton compte (bouton en haut à droite) pour afficher tes monstres 6★, tes runes et
          tes artéfacts. Les données restent en mémoire et sont à ré-importer à chaque session.
        </p>
        {loadState === 'loading' && <p className="mt-3 text-[12px]">Chargement des monstres…</p>}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {sub === 'monstres' && <MonsterBoxSection box={box} />}
      {sub === 'runes' && <RunesSection runes={runes} />}
      {sub === 'artefacts' && <ArtifactsSection artifacts={artifacts} />}
    </div>
  );
}
