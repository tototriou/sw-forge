import { useRef, useState } from 'react';
import { Crown, X, GripVertical, Trash2, AlertTriangle, Pencil } from 'lucide-react';

const SPD_ICON = `${import.meta.env.BASE_URL}stats/spd.png`; // icône vitesse du jeu (SWARFARM)
import { Monster, SiegeTeam as SiegeTeamType } from '../../types';
import {
  SIEGE_TICKS,
  combatSpeed,
  speedLeadOf,
  siegeLeadFor,
  tickDanger,
  tickTeamMessage,
  LeadInfo,
} from '../../lib/speed';
import MonsterPicker from '../MonsterPicker';
import ElementIcon from '../ElementIcon';
import RuneIcon from '../RuneIcon';
import MonsterGear from '../MonsterGear';
import NumberField from '../NumberField';
import LeadPill, { LeadBadge } from './LeadPill';
import { ConfirmDialog } from '../Dialogs';

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
  checkTicks: boolean; // mode « Vérifier mes tick ATB » : sans lui, aucune aura de couleur
  expanded: boolean; // vue détaillée (édition) — piloté par le board (pleine largeur)
  onToggleExpand: (teamId: string) => void;
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
  checkTicks,
  expanded,
  onToggleExpand,
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
  const [detailIdx, setDetailIdx] = useState<number | null>(null); // slot dont on montre le détail
  const [suppressionAConfirmer, setSuppressionAConfirmer] = useState(false);

  const usedIds = new Set(
    team.slots.map((s) => s.monsterId).filter((id): id is string => id !== null)
  );

  // Lead déduit automatiquement du leader (slot 0).
  const leaderId = team.slots[0].monsterId;
  const leaderMonster = leaderId ? monsterById.get(leaderId) ?? null : null;
  const leadInfo = speedLeadOf(leaderMonster);

  // Statut de l'équipe vis-à-vis des ticks — calculé seulement en mode
  // « Vérifier mes tick ATB » (sinon `neutral` : équipes affichées telles quelles) :
  //  - vert   : au tick (aucun monstre mal calé) OU recommandation ignorée
  //  - orange : pas au tick mais les monstres hors-tick sont en Swift (on veut du speed)
  //  - rouge  : pas au tick et pas en Swift → à corriger
  const slotInfos = team.slots.map((slot) => {
    const m = slot.monsterId ? monsterById.get(slot.monsterId) ?? null : null;
    // Le Swift entre dans la SOMME des %, il ne s'ajoute pas à côté (voir speed.ts).
    const swift = (slot.sets ?? []).includes('swift');
    const combat = m
      ? combatSpeed(m.stats.speed, slot.runeSpeed, siegeLeadFor(leadInfo, m.element), swift)
      : null;
    return { monster: m, combat };
  });
  const slotDangers = slotInfos.map(({ combat }) => tickDanger(combat));
  const hasMonsters = slotInfos.some((s) => s.monster);
  // Tick à vérifier pour tous les sets — SAUF si l'équipe a au moins un Swift
  // (équipe speed, on vise la vitesse max) ou contient Leo.
  const teamHasSwift = team.slots.some((s) => (s.sets ?? []).includes('swift'));
  const hasLeo = slotInfos.some(({ monster }) => monster?.name === 'Leo');
  const anyOffTick = slotDangers.some(Boolean);

  const validated = team.tickAlertDismissed; // recommandation écartée par l'utilisateur

  // Message d'alerte, construit dans speed.ts : c'est de la logique de tick, pas
  // de l'affichage — et elle mérite d'être vérifiable.
  const messageTick = tickTeamMessage(
    slotInfos.map(({ monster }, i) => ({ nom: monster?.name ?? 'Ce monstre', danger: slotDangers[i] }))
  );

  const status: 'neutral' | 'green' | 'orange' | 'red' =
    !checkTicks || !hasMonsters || hasLeo
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

  // Nommer ce qui va partir : « supprimer l'équipe 3 » ne dit rien, la liste
  // des monstres si.
  const monstresDeLEquipe = slotInfos.map(({ monster }) => monster?.name).filter(Boolean) as string[];

  // ⚠️ Les halos passent par `shadow-<token>` + `shadow-color` plutôt que par un
  // `rgba()` figé : un halo orange vif sur fond clair était criard et ne suivait
  // pas le thème. Le fond monte à /10 en compensation — sur clair, un /5 ne se
  // voit pas.
  const sectionClass =
    status === 'red'
      ? 'border-fire bg-fire/10 ring-2 ring-fire/50'
      : status === 'orange'
        ? 'border-warn bg-warn/10 ring-2 ring-warn/50'
        : status === 'green'
          ? 'border-good/70 bg-good/10 ring-1 ring-good/40'
          : 'border-border bg-panel/50';
  const dotClass =
    status === 'red' ? 'bg-fire' : status === 'orange' ? 'bg-warn' : status === 'green' ? 'bg-good' : '';

  return (
    <section className={`rounded-2xl border p-4 transition-colors ${sectionClass}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <h3 className="font-display text-[17px] tracking-wide">Équipe {index + 1}</h3>
        {dotClass && <span className={`w-2 h-2 rounded-full ${dotClass}`} />}
        {/* Lead à côté du nom de l'équipe : la VALEUR doit être lisible sans
            déplier. Le badge posé sur le portrait du leader reste, lui : il dit
            de quel monstre vient le lead — les deux répondent à deux questions
            différentes, ce n'est pas un doublon. */}
        {leaderMonster?.leaderSkill && <LeadPill ls={leaderMonster.leaderSkill} />}

        <button
          onClick={() => {
            onToggleExpand(team.id);
            setDetailIdx(null);
          }}
          className={`ml-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition ${
            expanded
              ? 'border-accent bg-panel2 text-ink'
              : 'border-border bg-panel text-ink hoverable:border-accent'
          }`}
          aria-expanded={expanded}
          title={expanded ? "Terminer l'édition" : "Éditer l'équipe"}
        >
          <Pencil size={13} /> {expanded ? 'Terminer' : 'Éditer'}
        </button>
        <button
          onClick={() => setSuppressionAConfirmer(true)}
          className="flex items-center gap-1.5 text-[12px] text-ink-dim hoverable:text-fire transition"
          title="Supprimer l'équipe"
        >
          <Trash2 size={13} /> Supprimer
        </button>
      </div>

      {/* ⚠️ Une équipe se supprime en un clic, juste à côté du bouton « Éditer »
          qu'on utilise sans arrêt — et rien ne permet de la retrouver ensuite :
          ni annulation, ni corbeille. Trois monstres et leurs vitesses partent
          avec elle. */}
      {suppressionAConfirmer && (
        <ConfirmDialog
          titre={`Supprimer l'équipe ${index + 1} ?`}
          message={
            monstresDeLEquipe.length > 0
              ? `${monstresDeLEquipe.join(', ')} — ainsi que leurs vitesses saisies. Les autres équipes ne sont pas touchées.`
              : 'Cette équipe est vide. Les autres ne sont pas touchées.'
          }
          libelleAction="Supprimer"
          destructif
          onCancel={() => setSuppressionAConfirmer(false)}
          onConfirm={() => {
            setSuppressionAConfirmer(false);
            onRemoveTeam(team.id);
          }}
        />
      )}

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
                  ? 'border-accent bg-panel2'
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
        /* Vue compacte : cards des 3 monstres, clic = déplier le détail dessous */
        <div className="flex flex-col sm:flex-row gap-1.5">
          {slotInfos.map(({ monster, combat }, idx) => {
            const danger = status === 'red' ? slotDangers[idx] : null;
            const sets = team.slots[idx].sets ?? [];
            const slotGear = team.slots[idx].gear;
            const canDetail = !!slotGear && slotGear.runes.length > 0;
            const active = detailIdx === idx;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (canDetail) setDetailIdx((d) => (d === idx ? null : idx));
                  else onToggleExpand(team.id);
                }}
                title={
                  danger
                    ? danger.kind === 'below'
                      ? `À ${danger.diff} sous le tick ${danger.tick}`
                      : `${danger.diff} au-dessus du tick ${danger.tick} (overshoot)`
                    : canDetail
                      ? 'Voir le détail des runes'
                      : 'Modifier'
                }
                className={`flex-1 min-w-0 flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition hoverable:border-accent ${
                  active
                    ? 'border-accent ring-1 ring-accent/50 bg-panel2'
                    : danger
                      ? 'border-fire/70 ring-1 ring-fire/50 bg-fire/5'
                      : 'border-border bg-panel2/60'
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
                      {/* Lead sur le portrait du leader : la carte compacte n'a
                          pas la place d'une pastille (voir spec), et le badge
                          dit à la fois « c'est lui le leader » et quel lead. */}
                      {idx === 0 && monster.leaderSkill && <LeadBadge ls={monster.leaderSkill} />}
                    </div>
                    {/* Le nom occupe SA ligne : nom, vitesse et sets se
                        disputaient la même, et le gros chiffre (non réductible)
                        finissait sous les icônes de set. Ligne 2 = vitesse à
                        gauche, sets poussés à droite. */}
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold leading-tight truncate">{monster.name}</div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <img src={SPD_ICON} alt="SPD" width={14} height={14} className="flex-none" />
                        <span
                          className={`font-mono text-[16px] font-black leading-none flex-none ${
                            danger ? 'text-fire' : 'text-ink'
                          }`}
                        >
                          {combat ?? '—'}
                        </span>
                        {sets.length > 0 && (
                          <span className="ml-auto flex items-center gap-0.5 flex-none">
                            {sets.slice(0, 3).map((s, i) => (
                              <RuneIcon key={i} setKey={s} size={17} className="flex-none" />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
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

      {/* Panneau de détail du monstre sélectionné (vue compacte) */}
      {!expanded && detailIdx !== null && team.slots[detailIdx]?.gear && (
        <div className="mt-2 rounded-xl border border-border bg-panel/40 p-3">
          <MonsterGear gear={team.slots[detailIdx].gear!} />
        </div>
      )}

      {/* Message sous les monstres : l'équipe n'est pas au tick.
          ⚠️ Le bouton dit « Ignorer la recommandation », et non « Valider
          l'équipe » : l'app n'a aucun moyen de savoir si le tune est bon, elle
          constate seulement qu'il s'écarte des ticks. « Valider » laissait
          croire à une approbation de l'outil, alors que c'est l'utilisateur qui
          écarte un conseil dont il assume la responsabilité. */}
      {(status === 'orange' || status === 'red') && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
            status === 'red' ? 'border-fire/40 bg-fire/10' : 'border-warn/40 bg-warn/10'
          }`}
        >
          <AlertTriangle
            size={15}
            className={`flex-none ${status === 'red' ? 'text-fire' : 'text-warn'}`}
          />
          <span className={`text-[12px] flex-1 ${status === 'red' ? 'text-fire' : 'text-warn'}`}>
            {status === 'red'
              ? messageTick ?? "Ton équipe n'est pas au tick."
              : 'Vérifier le speed tuning'}
          </span>
          <button
            onClick={() => onDismissAlert(team.id, true)}
            className="flex-none rounded-md bg-panel border border-border px-2.5 py-1 text-[11px] font-semibold text-ink hoverable:border-accent transition"
          >
            Ignorer la recommandation
          </button>
        </div>
      )}
      {status === 'green' && validated && (
        <button
          onClick={() => onDismissAlert(team.id, false)}
          className="mt-3 text-[11px] text-good hoverable:text-ink transition"
          title="Réafficher la recommandation"
        >
          ✓ Recommandation ignorée · rétablir
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
            : 'bg-panel border-border text-ink-dim hoverable:text-ink hoverable:border-accent'
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
          <span className="label">
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
  const combat = combatSpeed(base, slot.runeSpeed, lead, (slot.sets ?? []).includes('swift'));
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
          className="cursor-grab active:cursor-grabbing text-ink-dim hoverable:text-ink touch-none"
          title="Glisser pour intervertir"
          aria-label="Déplacer"
        >
          <GripVertical size={15} />
        </button>
        {isLeader && !monster.leaderSkill && <Crown size={13} className="text-star flex-none" />}
        <div className="relative flex-none">
          <div
            className={`hex-frame w-[38px] h-[38px] p-[2px] bg-gradient-to-br ${GRADIENT[monster.element]}`}
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
          {isLeader && monster.leaderSkill && <LeadBadge ls={monster.leaderSkill} />}
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
          {/* Pastille complète (icône + montant) sous le nom du leader : ici il
              y a la place, donc on montre le chiffre, pas seulement le badge. */}
          {isLeader && monster.leaderSkill && (
            <div className="mt-1">
              <LeadPill ls={monster.leaderSkill} />
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-ink-dim hoverable:text-fire transition flex-none self-start"
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
          <span className="label">SPD :</span>
          <NumberField
            value={slot.runeSpeed}
            allowEmpty
            min={0}
            width="w-12"
            ariaLabel="SPD des runes"
            onChange={onRune}
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
        <span className="label">Position</span>
        <select
          value={idx}
          onChange={(e) => onMoveTo(Number(e.target.value))}
          title="Changer la position (intervertir les monstres)"
          className="bg-panel border border-border rounded-md px-1.5 py-0.5 text-[11px] text-ink-dim
                     outline-none focus:border-accent"
        >
          <option value={0}>1 · Leader</option>
          <option value={1}>2</option>
          <option value={2}>3</option>
        </select>
      </div>
    </div>
  );
}
