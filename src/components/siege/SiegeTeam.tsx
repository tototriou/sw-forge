import { useRef, useState } from 'react';
import { Crown, X, GripVertical, Trash2, AlertTriangle, ChevronRight, ChevronDown } from 'lucide-react';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`; // icône vitesse du jeu (SWARFARM)
import { Monster, SiegeTeam as SiegeTeamType, ELEMENTS, ElementKey, LeaderSkill } from '../../types';
import { SIEGE_TICKS, combatSpeed, speedLeadOf, siegeLeadFor, tickDanger, LeadInfo } from '../../lib/speed';
import MonsterPicker from '../MonsterPicker';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';

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

// Libellés courts des stats de leader skill.
const STAT_LABEL: Record<string, string> = {
  'Attack Speed': 'SPD',
  'Attack Power': 'ATQ',
  HP: 'PV',
  Defense: 'DEF',
  'Critical Rate': 'Taux crit',
  'Critical DMG': 'DMG crit',
  Accuracy: 'Précision',
  Resistance: 'Résistance',
};

// Pastille affichant le lead du leader (n'importe quel type de stat).
// `active` = lead de vitesse effectif en siège (mis en avant, alimente le tick).
function leaderSkillPill(ls: LeaderSkill | null): { text: string; active: boolean } | null {
  if (!ls) return null;
  const stat = STAT_LABEL[ls.stat ?? ''] ?? ls.stat ?? '';
  let scope = '';
  if (ls.area === 'Element') scope = ` ${elementLabel(ls.element)}`;
  else if (ls.area === 'Arena') scope = ' (arène)';
  else if (ls.area === 'Dungeon') scope = ' (donjon)';
  const active =
    ls.stat === 'Attack Speed' &&
    (ls.area === 'General' || ls.area === 'Guild' || ls.area === 'Element');
  return { text: `Lead +${ls.amount}% ${stat}${scope}`, active };
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
  onSlotTick: (teamId: string, idx: number, tick: number) => void;
  onDismissAlert: (teamId: string, dismissed: boolean) => void;
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
  onSlotTick,
  onDismissAlert,
  onSwap,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false); // replié par défaut (vue compacte)

  const usedIds = new Set(
    team.slots.map((s) => s.monsterId).filter((id): id is string => id !== null)
  );

  // Lead déduit automatiquement du leader (slot 0).
  const leaderId = team.slots[0].monsterId;
  const leaderMonster = leaderId ? monsterById.get(leaderId) ?? null : null;
  const leadInfo = speedLeadOf(leaderMonster);

  // Statut de l'équipe vis-à-vis des ticks :
  //  - vert   : au tick (aucun monstre mal calé) OU équipe validée par l'utilisateur
  //  - orange : pas au tick mais les monstres hors-tick sont en Swift (on veut du speed)
  //  - rouge  : pas au tick et pas en Swift → à corriger
  const slotInfos = team.slots.map((slot) => {
    const m = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
    const combat = m ? combatSpeed(m.stats.speed, slot.runeSpeed, siegeLeadFor(leadInfo, m.element)) : null;
    return { monster: m, combat };
  });
  const slotDangers = slotInfos.map(({ combat }) => tickDanger(combat));
  const hasMonsters = slotInfos.some((s) => s.monster);
  // Tick à vérifier pour tous les sets — SAUF si l'équipe a au moins un Swift
  // (équipe speed, on vise la vitesse max) ou contient Leo.
  const teamHasSwift = team.slots.some((s) => (s.sets ?? []).includes('swift'));
  const hasLeo = slotInfos.some(({ monster }) => monster?.name === 'Leo');
  const anyOffTick = slotDangers.some(Boolean);
  const validated = team.tickAlertDismissed;
  const status: 'neutral' | 'green' | 'orange' | 'red' =
    !hasMonsters || hasLeo
      ? 'neutral'
      : validated
        ? 'green'
        : teamHasSwift
          ? 'orange' // au moins un Swift → équipe speed, pas de tick à viser
          : anyOffTick
            ? 'red' // un monstre pas au tick
            : 'green'; // tous au tick

  function handleDrop(to: number) {
    if (dragFrom !== null && dragFrom !== to) onSwap(team.id, dragFrom, to);
    setDragFrom(null);
    setOverIdx(null);
  }

  const sectionClass =
    status === 'red'
      ? 'border-fire bg-fire/5 ring-2 ring-fire/60 shadow-[0_0_22px_-6px_rgba(232,93,61,0.7)]'
      : status === 'orange'
        ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/60 shadow-[0_0_20px_-6px_rgba(245,158,11,0.65)]'
        : status === 'green'
          ? 'border-emerald-500/70 bg-emerald-500/[0.05] ring-1 ring-emerald-500/40'
          : 'border-border bg-panel/50';
  const dotClass =
    status === 'red' ? 'bg-fire' : status === 'orange' ? 'bg-amber-500' : status === 'green' ? 'bg-emerald-500' : '';

  return (
    <section className={`rounded-2xl border p-4 transition-colors ${sectionClass}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-ink hover:text-ink-dim transition"
          title={expanded ? 'Réduire' : 'Voir le détail'}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <h3 className="font-display text-[17px] tracking-wide">Équipe {index + 1}</h3>
        </button>
        {dotClass && <span className={`w-2 h-2 rounded-full ${dotClass}`} />}

        <button
          onClick={() => onRemoveTeam(team.id)}
          className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hover:text-fire transition"
          title="Supprimer l'équipe"
        >
          <Trash2 size={13} /> Supprimer
        </button>
      </div>

      {expanded ? (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {team.slots.map((slot, idx) => {
          const monster = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
          const slotDanger = status === 'red' ? slotDangers[idx] : null;
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
                overIdx === idx
                  ? 'border-[#5b63b8] bg-panel2'
                  : slotDanger
                    ? 'border-fire/70 ring-1 ring-fire/50 bg-fire/5'
                    : 'border-border bg-panel2/60'
              }`}
              title={
                slotDanger
                  ? slotDanger.kind === 'below'
                    ? `À ${slotDanger.diff} sous le tick ${slotDanger.tick}`
                    : `${slotDanger.diff} au-dessus du tick ${slotDanger.tick} (overshoot)`
                  : undefined
              }
            >
              <SlotContent
                monster={monster}
                slot={slot}
                idx={idx}
                isLeader={idx === 0}
                leadInfo={leadInfo}
                monsters={monsters}
                usedIds={usedIds}
                onPick={(id) => onPickMonster(team.id, idx, id)}
                onClear={() => onClearSlot(team.id, idx)}
                onRune={(v) => onSlotRune(team.id, idx, v)}
                onTick={(t) => onSlotTick(team.id, idx, t)}
                onMoveTo={(to) => onSwap(team.id, idx, to)}
                onDragStart={() => setDragFrom(idx)}
                onDragEnd={() => setDragFrom(null)}
              />
            </div>
          );
        })}
      </div>
      ) : (
        /* Vue compacte : juste les 3 monstres, clic = déplier le détail */
        <div className="flex flex-col sm:flex-row gap-1.5">
          {slotInfos.map(({ monster, combat }, idx) => {
            const danger = status === 'red' ? slotDangers[idx] : null;
            const sets = team.slots[idx].sets ?? [];
            return (
              <button
                key={idx}
                onClick={() => setExpanded(true)}
                title={
                  danger
                    ? danger.kind === 'below'
                      ? `À ${danger.diff} sous le tick ${danger.tick}`
                      : `${danger.diff} au-dessus du tick ${danger.tick} (overshoot)`
                    : 'Voir le détail'
                }
                className={`flex-1 min-w-0 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition hover:border-[#4a52a0] ${
                  danger ? 'border-fire/70 ring-1 ring-fire/50 bg-fire/5' : 'border-border bg-panel2/60'
                }`}
              >
                {monster ? (
                  <>
                    <div className="relative flex-none">
                      <div
                        className={`hex-frame w-[36px] h-[36px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
                      >
                        <div className="hex-frame w-full h-full bg-panel flex items-center justify-center overflow-hidden">
                          {monster.image ? (
                            <img src={monster.image} alt={monster.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className={`font-display font-bold text-[10px] ${TEXT[monster.element]}`}>
                              {initials(monster.name)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ElementIcon
                        element={monster.element}
                        size={13}
                        className="absolute -top-1 -right-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold leading-tight truncate">{monster.name}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <img src={SPD_ICON} alt="SPD" width={16} height={16} className="flex-none" />
                        <span
                          className={`font-mono text-[17px] font-black leading-none ${danger ? 'text-fire' : 'text-ink'}`}
                        >
                          {combat ?? '—'}
                        </span>
                      </div>
                    </div>
                    {sets.length > 0 && (
                      <div className="flex items-center gap-1 flex-none">
                        {sets.slice(0, 3).map((s, i) => (
                          <RuneIcon key={i} setKey={s} size={24} className="flex-none" />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-ink-dim">
                    <span className="w-[34px] h-[34px] flex-none rounded-lg border border-dashed border-border flex items-center justify-center text-lg">
                      +
                    </span>
                    <span className="text-[11px]">{idx === 0 ? 'Leader' : 'vide'}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Message sous les monstres : équipe pas au tick → à valider */}
      {(status === 'orange' || status === 'red') && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
            status === 'red' ? 'border-fire/40 bg-fire/10' : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          <AlertTriangle
            size={15}
            className={`flex-none ${status === 'red' ? 'text-fire' : 'text-amber-400'}`}
          />
          <span className={`text-[12px] flex-1 ${status === 'red' ? 'text-fire' : 'text-amber-300'}`}>
            {status === 'red' ? "Ton équipe n'est pas au tick." : 'Vérifier le speed tuning'}
          </span>
          <button
            onClick={() => onDismissAlert(team.id, true)}
            className="flex-none rounded-md bg-panel border border-border px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-[#4a52a0] transition"
          >
            Valider l'équipe
          </button>
        </div>
      )}
      {status === 'green' && validated && (
        <button
          onClick={() => onDismissAlert(team.id, false)}
          className="mt-3 text-[11px] text-emerald-400 hover:text-ink transition"
          title="Annuler la validation"
        >
          ✓ Équipe validée · annuler
        </button>
      )}
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
  slot: { monsterId: string | null; runeSpeed: number | null; tick: number; sets?: string[] };
  idx: number;
  isLeader: boolean;
  leadInfo: LeadInfo | null;
  monsters: Monster[];
  usedIds: Set<string>;
  onPick: (id: string) => void;
  onClear: () => void;
  onRune: (v: number | null) => void;
  onTick: (tick: number) => void;
  onMoveTo: (to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function SlotContent({
  monster,
  slot,
  idx,
  isLeader,
  leadInfo,
  monsters,
  usedIds,
  onPick,
  onClear,
  onRune,
  onTick,
  onMoveTo,
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
  const pill = isLeader ? leaderSkillPill(monster.leaderSkill) : null;
  const tick = slot.tick;

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
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold leading-tight truncate">{monster.name}</span>
            {slot.sets && slot.sets.length > 0 && (
              <span className="flex items-center gap-1 flex-none">
                {slot.sets.slice(0, 3).map((s, i) => (
                  <RuneIcon key={i} setKey={s} size={18} />
                ))}
              </span>
            )}
          </div>
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
          <div className="font-mono text-[10px] text-ink-dim mt-1">base {base ?? '—'}</div>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] uppercase text-ink-dim">SPD :</span>
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

      {/* Tick cible, propre à ce monstre */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <TickBtn active={tick === 0} onClick={() => onTick(0)} label="Off" />
        {SIEGE_TICKS.map((t) => (
          <TickBtn
            key={t.key}
            active={tick === t.value}
            onClick={() => onTick(t.value)}
            label={`${t.label} ${t.value}`}
          />
        ))}
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

      {/* Position dans l'équipe (repli tactile du drag & drop) */}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/60">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-dim">Position</span>
        <select
          value={idx}
          onChange={(e) => onMoveTo(Number(e.target.value))}
          title="Changer la position (intervertir les monstres)"
          className="bg-panel border border-border rounded-md px-1.5 py-0.5 text-[11px] text-ink-dim
                     outline-none focus:border-[#5b63b8]"
        >
          <option value={0}>1 · Leader</option>
          <option value={1}>2</option>
          <option value={2}>3</option>
        </select>
      </div>
    </div>
  );
}
