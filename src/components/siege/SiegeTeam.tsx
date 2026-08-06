import { useRef, useState } from 'react';
import { Crown, X, GripVertical, Trash2 } from 'lucide-react';
import { Monster, SiegeTeam as SiegeTeamType } from '../../types';
import { SPEED_LEADS, SIEGE_TICKS, combatSpeed, runeSpeedForTarget } from '../../lib/speed';
import MonsterPicker from '../MonsterPicker';
import ElementIcon from '../ElementIcon';

const GRADIENT: Record<string, string> = {
  fire: 'from-fire to-panel2',
  water: 'from-water to-panel2',
  wind: 'from-wind to-panel2',
  light: 'from-light to-panel2',
  dark: 'from-dark to-panel2',
  unknown: 'from-unknown to-panel2',
};
const TEXT: Record<string, string> = {
  fire: 'text-fire',
  water: 'text-water',
  wind: 'text-wind',
  light: 'text-light',
  dark: 'text-dark',
  unknown: 'text-unknown',
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

interface Props {
  team: SiegeTeamType;
  index: number;
  monsters: Monster[];
  monsterById: Map<string, Monster>;
  onRemoveTeam: (id: string) => void;
  onPickMonster: (teamId: string, idx: number, monsterId: string) => void;
  onClearSlot: (teamId: string, idx: number) => void;
  onSlotRune: (teamId: string, idx: number, value: number | null) => void;
  onLead: (teamId: string, lead: number) => void;
  onTick: (teamId: string, tick: number) => void;
  onSwap: (teamId: string, from: number, to: number) => void;
}

export default function SiegeTeam({
  team,
  index,
  monsters,
  monsterById,
  onRemoveTeam,
  onPickMonster,
  onClearSlot,
  onSlotRune,
  onLead,
  onTick,
  onSwap,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const usedIds = new Set(
    team.slots.map((s) => s.monsterId).filter((id): id is string => id !== null)
  );

  function handleDrop(to: number) {
    if (dragFrom !== null && dragFrom !== to) onSwap(team.id, dragFrom, to);
    setDragFrom(null);
    setOverIdx(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-panel/50 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <h3 className="font-display text-[17px] tracking-wide">Équipe {index + 1}</h3>
        <button
          onClick={() => onRemoveTeam(team.id)}
          className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hover:text-fire transition"
          title="Supprimer l'équipe"
        >
          <Trash2 size={13} /> Supprimer
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Les 3 slots */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 flex-1">
          {team.slots.map((slot, idx) => {
            const monster = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
            const isLeader = idx === 0;
            return (
              <div
                key={idx}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIdx(idx);
                }}
                onDragLeave={() => setOverIdx((o) => (o === idx ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                className={`rounded-xl border transition-colors ${
                  overIdx === idx ? 'border-[#5b63b8] bg-panel2' : 'border-border bg-panel2/60'
                }`}
              >
                <SlotContent
                  monster={monster}
                  slot={slot}
                  isLeader={isLeader}
                  lead={team.lead}
                  tick={team.tick}
                  monsters={monsters}
                  usedIds={usedIds}
                  onPick={(id) => onPickMonster(team.id, idx, id)}
                  onClear={() => onClearSlot(team.id, idx)}
                  onRune={(v) => onSlotRune(team.id, idx, v)}
                  onDragStart={() => setDragFrom(idx)}
                  onDragEnd={() => setDragFrom(null)}
                />
              </div>
            );
          })}
        </div>

        {/* Options latérales : lead + tick */}
        <aside className="lg:w-56 flex-none rounded-xl border border-border bg-panel2/60 p-3">
          <div className="mb-3">
            <label className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-dim flex items-center gap-1.5 mb-1.5">
              <Crown size={12} className="text-star" /> Lead SPD (leader)
            </label>
            <select
              value={team.lead}
              onChange={(e) => onLead(team.id, Number(e.target.value))}
              className="w-full bg-panel border border-border text-ink rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
            >
              <option value={0}>Aucun</option>
              {SPEED_LEADS.map((pct) => (
                <option key={pct} value={pct}>
                  +{pct}%
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-dim block mb-1.5">
              Tick de vitesse
            </span>
            <div className="flex flex-col gap-1.5">
              <TickBtn active={team.tick === 0} onClick={() => onTick(team.id, 0)} label="Aucun" />
              {SIEGE_TICKS.map((t) => (
                <TickBtn
                  key={t.key}
                  active={team.tick === t.value}
                  onClick={() => onTick(team.id, t.value)}
                  label={`${t.label} · ${t.value}`}
                />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TickBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold text-left transition select-none
        ${
          active
            ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star shadow'
            : 'bg-panel border-border text-ink-dim hover:text-ink hover:border-[#4a52a0]'
        }`}
    >
      {label}
    </button>
  );
}

interface SlotProps {
  monster: Monster | null;
  slot: { monsterId: string | null; runeSpeed: number | null };
  isLeader: boolean;
  lead: number;
  tick: number;
  monsters: Monster[];
  usedIds: Set<string>;
  onPick: (id: string) => void;
  onClear: () => void;
  onRune: (v: number | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function SlotContent({
  monster,
  slot,
  isLeader,
  lead,
  tick,
  monsters,
  usedIds,
  onPick,
  onClear,
  onRune,
  onDragStart,
  onDragEnd,
}: SlotProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!monster) {
    return (
      <div className="p-2.5 min-h-[128px] flex flex-col justify-center">
        <div className="flex items-center gap-1.5 mb-2">
          {isLeader && <Crown size={13} className="text-star" />}
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
            {isLeader ? 'Leader' : 'Slot'}
          </span>
        </div>
        <MonsterPicker
          monsters={monsters}
          onPick={onPick}
          excludeIds={usedIds}
          placeholder="Choisir un monstre…"
        />
      </div>
    );
  }

  const base = monster.stats.speed;
  const combat = combatSpeed(base, slot.runeSpeed, lead);
  const needed = tick > 0 ? runeSpeedForTarget(base, lead, tick) : null;
  const reached = tick > 0 && combat !== null && combat >= tick;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', monster!.name);
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
    onDragStart();
  }

  return (
    <div ref={cardRef} className="relative p-2.5 min-h-[128px]">
      <div className="flex items-center gap-1.5 mb-1.5">
        <button
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing text-ink-dim hover:text-ink touch-none"
          title="Glisser pour intervertir"
          aria-label="Déplacer"
        >
          <GripVertical size={15} />
        </button>
        {isLeader && <Crown size={13} className="text-star" />}
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
          {isLeader ? 'Leader' : 'Slot'}
        </span>
        <button
          onClick={onClear}
          className="ml-auto text-ink-dim hover:text-fire transition"
          title="Retirer"
          aria-label="Retirer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="relative flex-none">
          <div className={`hex-frame w-[44px] h-[44px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}>
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
          <div className="font-mono text-[11px] text-ink-dim mt-0.5">SPD base {base ?? '—'}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <span className="font-mono text-[10px] uppercase text-ink-dim">+runes</span>
        <input
          type="number"
          inputMode="numeric"
          value={slot.runeSpeed ?? ''}
          placeholder="0"
          onChange={(e) => {
            const v = e.target.value;
            onRune(v === '' ? null : Number(v));
          }}
          className="w-16 bg-panel border border-border rounded-md px-1.5 py-0.5 text-[12px] text-ink
                     outline-none focus:border-[#5b63b8]"
        />
        <span className="ml-auto font-mono text-[12px] font-bold text-star" title="Vitesse de combat">
          ⚡{combat ?? '—'}
        </span>
      </div>

      {tick > 0 && (
        <div
          className={`mt-1.5 font-mono text-[10.5px] ${reached ? 'text-wind' : 'text-ink-dim'}`}
          title="Vitesse de runes nécessaire pour atteindre le tick"
        >
          tick {tick} : {needed !== null ? `${needed} runes` : '—'}
          {reached && ' ✓'}
        </div>
      )}
    </div>
  );
}
