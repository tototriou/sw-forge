import { useRef } from 'react';
import { GripVertical, X, ChevronDown } from 'lucide-react';
import { Monster, RtaEntry, sectionLabel } from '../../types';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`;

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
  sectionKeys: string[]; // destinations possibles (Non classé + sections runes)
  open: boolean; // le détail de CETTE carte est ouvert (panneau rendu par la grille)
  onToggleDetail: (id: string) => void;
  onMove: (id: string, section: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export default function RtaCard({
  monster,
  entry,
  sectionKeys,
  open,
  onToggleDetail,
  onMove,
  onRemove,
  onDragStart,
  onDragEnd,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const base = monster.stats.speed;
  const rune = entry.runeSpeed;
  const total = base !== null || rune !== null ? (base ?? 0) + (rune ?? 0) : null;
  const hasGear = !!entry.gear && entry.gear.runes.length > 0;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', String(monster.id));
    e.dataTransfer.effectAllowed = 'move';
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
    onDragStart(String(monster.id));
  }

  const toggle = hasGear ? () => onToggleDetail(String(monster.id)) : undefined;

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-lg border bg-panel2 transition-colors ${
        open ? 'border-[#5b63b8] ring-1 ring-[#5b63b8]/50' : 'border-border'
      }`}
    >
      <div className="flex items-center gap-2 p-1.5">
      {/* Poignée de drag : seule zone qui déclenche le glisser-déposer */}
      <button
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className="flex-none cursor-grab active:cursor-grabbing text-ink-dim hover:text-ink touch-none"
        title="Glisser vers une section"
        aria-label="Déplacer"
      >
        <GripVertical size={14} />
      </button>

      <div className={`relative flex-none ${hasGear ? 'cursor-pointer' : ''}`} onClick={toggle}>
        <div
          className={`hex-frame w-[50px] h-[50px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
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
        <div
          className={`flex items-center gap-1 ${hasGear ? 'cursor-pointer' : ''}`}
          onClick={toggle}
          title={hasGear ? 'Voir le détail des runes' : undefined}
        >
          <span className="text-[12px] font-semibold leading-tight truncate flex-1">
            {monster.name}
          </span>
          <img src={SPD_ICON} alt="SPD" width={15} height={15} className="flex-none" />
          <span className="font-mono text-[14px] font-black text-ink leading-none">
            {total !== null ? total : '—'}
          </span>
          {(entry.sets ?? []).slice(0, 3).map((s, i) => (
            <RuneIcon key={i} setKey={s} size={18} className="flex-none" />
          ))}
          {hasGear && (
            <ChevronDown
              size={14}
              className={`flex-none text-ink-dim transition-transform ${open ? 'rotate-180' : ''}`}
            />
          )}
        </div>
        <select
          value={entry.section}
          onChange={(e) => onMove(String(monster.id), e.target.value)}
          title="Déplacer vers une section"
          className="mt-1 w-full bg-panel border border-border rounded px-1.5 py-0.5 text-[10px]
                     text-ink-dim outline-none focus:border-[#5b63b8]"
        >
          {sectionKeys.map((k) => (
            <option key={k} value={k}>
              {sectionLabel(k)}
            </option>
          ))}
        </select>
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
    </div>
  );
}
