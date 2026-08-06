import { useRef } from 'react';
import { GripVertical, X } from 'lucide-react';
import { Monster, RtaEntry } from '../../types';
import ElementIcon from '../ElementIcon';

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

interface Props {
  monster: Monster;
  entry: RtaEntry;
  onRuneSpeed: (id: string, value: number | null) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export default function RtaCard({ monster, entry, onRuneSpeed, onRemove, onDragStart, onDragEnd }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const base = monster.stats.speed;
  const rune = entry.runeSpeed;
  const total = base !== null || rune !== null ? (base ?? 0) + (rune ?? 0) : null;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', String(monster.id));
    e.dataTransfer.effectAllowed = 'move';
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
    onDragStart(String(monster.id));
  }

  return (
    <div
      ref={cardRef}
      className="group relative flex items-center gap-2.5 rounded-xl border border-border bg-panel2 p-2 pr-2.5"
    >
      {/* Poignée de drag : seule zone qui déclenche le glisser-déposer */}
      <button
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className="flex-none cursor-grab active:cursor-grabbing text-ink-dim hover:text-ink touch-none"
        title="Glisser vers une section"
        aria-label="Déplacer"
      >
        <GripVertical size={16} />
      </button>

      <div className="relative flex-none">
        <div
          className={`hex-frame w-[42px] h-[42px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
        >
          <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
            {monster.image ? (
              <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
            ) : (
              <span className={`font-display font-bold text-sm ${TEXT[monster.element]}`}>
                {initials(monster.name)}
              </span>
            )}
          </div>
        </div>
        <ElementIcon
          element={monster.element}
          size={16}
          className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight truncate">{monster.name}</div>
        <div className="mt-0.5 text-[11px] text-ink-dim font-mono">SPD base {base ?? '—'}</div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="font-mono text-[10px] uppercase text-ink-dim">+runes</span>
          <input
            type="number"
            inputMode="numeric"
            value={rune ?? ''}
            placeholder="0"
            onChange={(e) => {
              const v = e.target.value;
              onRuneSpeed(String(monster.id), v === '' ? null : Number(v));
            }}
            className="w-14 bg-panel border border-border rounded-md px-1.5 py-0.5 text-[12px] text-ink
                       outline-none focus:border-[#5b63b8]"
          />
          <span className="ml-auto font-mono text-[12px] text-star font-bold">
            {total !== null ? `⚡${total}` : '—'}
          </span>
        </div>
      </div>

      <button
        onClick={() => onRemove(String(monster.id))}
        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center
                   w-5 h-5 rounded-full bg-fire text-white shadow"
        title="Retirer"
        aria-label="Retirer"
      >
        <X size={12} />
      </button>
    </div>
  );
}
