import { useRef, useState } from 'react';
import { Crown, X, GripVertical, Trash2 } from 'lucide-react';
import { Monster, SiegeTeam as SiegeTeamType, ELEMENTS, ElementKey } from '../../types';
import { SIEGE_TICKS, combatSpeed, speedLeadOf, siegeLeadFor, LeadInfo } from '../../lib/speed';
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

function elementLabel(el: ElementKey | null): string {
  return ELEMENTS.find((e) => e.key === el)?.label ?? '—';
}

// Texte court de la pastille de lead, à côté du nom du leader.
function leadPill(info: LeadInfo | null): { text: string; active: boolean } | null {
  if (!info) return null;
  if (info.area === 'General' || info.area === 'Guild') return { text: `Lead +${info.amount}%`, active: true };
  if (info.area === 'Element')
    return { text: `Lead +${info.amount}% ${elementLabel(info.element)}`, active: true };
  return { text: `Lead +${info.amount}% (${info.area}, inactif)`, active: false };
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
  onTick,
  onSwap,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const usedIds = new Set(
    team.slots.map((s) => s.monsterId).filter((id): id is string => id !== null)
  );

  // Lead déduit automatiquement du leader (slot 0).
  const leaderId = team.slots[0].monsterId;
  const leaderMonster = leaderId ? monsterById.get(leaderId) ?? null : null;
  const leadInfo = speedLeadOf(leaderMonster);

  function handleDrop(to: number) {
    if (dragFrom !== null && dragFrom !== to) onSwap(team.id, dragFrom, to);
    setDragFrom(null);
    setOverIdx(null);
  }

  return (
    <section className="rounded-2xl border border-border bg-panel/50 p-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="font-display text-[17px] tracking-wide">Équipe {index + 1}</h3>

        <button
          onClick={() => onRemoveTeam(team.id)}
          className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hover:text-fire transition"
          title="Supprimer l'équipe"
        >
          <Trash2 size={13} /> Supprimer
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {team.slots.map((slot, idx) => {
          const monster = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
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
                isLeader={idx === 0}
                leadInfo={leadInfo}
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

      {/* Boutons de tick, sous les slots */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim mr-0.5">Tick</span>
        <TickBtn active={team.tick === 0} onClick={() => onTick(team.id, 0)} label="Off" />
        {SIEGE_TICKS.map((t) => (
          <TickBtn
            key={t.key}
            active={team.tick === t.value}
            onClick={() => onTick(team.id, t.value)}
            label={`${t.label} ${t.value}`}
          />
        ))}
      </div>
    </section>
  );
}

function TickBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-semibold transition select-none
        ${
          active
            ? 'bg-gradient-to-br from-star to-yellow-200 text-bg border-star'
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
  leadInfo: LeadInfo | null;
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
  leadInfo,
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
      <div className="p-3 min-h-[150px] flex flex-col justify-center">
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
  const lead = siegeLeadFor(leadInfo, monster.element);
  const combat = combatSpeed(base, slot.runeSpeed, lead);
  const pill = isLeader ? leadPill(leadInfo) : null;

  // Écart au tick : négatif = il manque de la vitesse, positif = surplus.
  const diff = tick > 0 && combat !== null ? combat - tick : null;

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', monster!.name);
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 24, 24);
    onDragStart();
  }

  return (
    <div ref={cardRef} className="relative p-3 min-h-[150px] flex flex-col">
      <div className="flex items-center gap-1.5 mb-2">
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
        {isLeader && <Crown size={13} className="text-star flex-none" />}
        <div
          className={`hex-frame w-[38px] h-[38px] flex-none p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
        >
          <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
            {monster.image ? (
              <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
            ) : (
              <span className={`font-display font-bold text-xs ${TEXT[monster.element]}`}>
                {initials(monster.name)}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight truncate">{monster.name}</div>
          {pill && (
            <span
              className={`inline-block mt-0.5 rounded-full px-1.5 py-[1px] text-[10px] font-mono font-semibold
                ${pill.active ? 'bg-star/15 text-star' : 'bg-panel border border-border text-ink-dim'}`}
            >
              {pill.text}
            </span>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-ink-dim hover:text-fire transition flex-none self-start"
          title="Retirer"
          aria-label="Retirer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Vitesse de combat, mise en avant */}
      <div className="flex items-end justify-between mt-1">
        <div>
          <div className="font-mono text-[26px] font-black text-star leading-none">
            {combat ?? '—'}
          </div>
          <div className="font-mono text-[10px] text-ink-dim mt-1">
            vitesse combat · base {base ?? '—'}
          </div>
        </div>
        <label className="flex flex-col items-end gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-dim">+runes</span>
          <input
            type="number"
            inputMode="numeric"
            value={slot.runeSpeed ?? ''}
            placeholder="0"
            onChange={(e) => {
              const v = e.target.value;
              onRune(v === '' ? null : Number(v));
            }}
            className="w-16 bg-panel border border-border rounded-md px-1.5 py-1 text-[13px] text-center text-ink
                       outline-none focus:border-[#5b63b8]"
          />
        </label>
      </div>

      {/* Retour tick : manque / surplus */}
      {diff !== null && (
        <div className="mt-2">
          {diff < 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-fire/15 text-fire px-2 py-0.5 text-[11px] font-mono font-semibold">
              manque {-diff} pour {tick}
            </span>
          ) : diff > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-water/15 text-water px-2 py-0.5 text-[11px] font-mono font-semibold">
              +{diff} au-dessus de {tick}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-wind/15 text-wind px-2 py-0.5 text-[11px] font-mono font-semibold">
              pile au tick {tick} ✓
            </span>
          )}
        </div>
      )}
    </div>
  );
}
