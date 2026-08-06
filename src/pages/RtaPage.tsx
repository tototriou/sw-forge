import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Monster,
  RUNE_SETS,
  RTA_UNASSIGNED,
  RTA_OTHER,
  sectionLabel,
  sectionAccent,
} from '../types';
import { LoadState } from '../hooks/useMonsters';
import { useRtaState } from '../hooks/useRtaState';
import RtaSearch from '../components/rta/RtaSearch';
import RtaSection from '../components/rta/RtaSection';
import RtaCard from '../components/rta/RtaCard';
import TurnOrder, { TurnItem } from '../components/rta/TurnOrder';

interface Props {
  monsters: Monster[];
  loadState: LoadState;
}

function totalSpeed(it: TurnItem): number | null {
  const b = it.monster.stats.speed;
  const r = it.entry.runeSpeed;
  return b !== null || r !== null ? (b ?? 0) + (r ?? 0) : null;
}

export default function RtaPage({ monsters, loadState }: Props) {
  const rta = useRtaState();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [newSection, setNewSection] = useState('');

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  // Regroupe les entrées par section + construit la liste globale pour l'ordre de tour.
  const { groups, allItems } = useMemo(() => {
    const groups: Record<string, TurnItem[]> = { [RTA_UNASSIGNED]: [] };
    for (const key of rta.state.sections) groups[key] = [];
    const allItems: TurnItem[] = [];
    for (const entry of Object.values(rta.state.entries)) {
      const monster = monsterById.get(entry.monsterId);
      if (!monster) continue; // monstre absent des données chargées
      const item: TurnItem = { monster, entry };
      (groups[entry.section] ??= []).push(item);
      allItems.push(item);
    }
    // Tri interne de chaque section : plus rapide en premier.
    for (const list of Object.values(groups)) {
      list.sort((a, b) => {
        const ta = totalSpeed(a);
        const tb = totalSpeed(b);
        if (ta === null && tb === null) return a.monster.name.localeCompare(b.monster.name);
        if (ta === null) return 1;
        if (tb === null) return -1;
        return tb - ta || a.monster.name.localeCompare(b.monster.name);
      });
    }
    return { groups, allItems };
  }, [rta.state, monsterById]);

  const addedIds = useMemo(() => new Set(Object.keys(rta.state.entries)), [rta.state.entries]);

  const availableSets = useMemo(
    () => RUNE_SETS.filter((s) => !rta.state.sections.includes(s.key)),
    [rta.state.sections]
  );

  function handleDrop(section: string, id: string) {
    const realId = id || draggingId;
    if (realId) rta.moveMonster(realId, section);
    setDraggingId(null);
  }

  function renderCards(items: TurnItem[]) {
    return items.map((it) => (
      <RtaCard
        key={it.monster.id}
        monster={it.monster}
        entry={it.entry}
        onRuneSpeed={rta.setRuneSpeed}
        onRemove={rta.removeMonster}
        onDragStart={setDraggingId}
        onDragEnd={() => setDraggingId(null)}
      />
    ));
  }

  const runeSections = rta.state.sections;

  return (
    <div>
      <header className="mt-4">
        <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] title-gradient mb-1.5">
          RTA — Préparation
        </h1>
        <p className="text-ink-dim text-[14.5px] leading-relaxed max-w-2xl">
          Sélectionne les monstres que tu veux runer, glisse-les dans les sections selon le set de
          runes visé, et renseigne la vitesse apportée par tes runes. L'ordre de tour se recalcule
          automatiquement. Tout est sauvegardé dans ton navigateur.
        </p>
      </header>

      <div className="mt-6">
        <RtaSearch monsters={monsters} addedIds={addedIds} onAdd={rta.addMonster} />
      </div>

      <div className="flex items-center gap-3 mt-4">
        <span className="font-mono text-[12px] text-ink-dim">
          {addedIds.size} monstre{addedIds.size > 1 ? 's' : ''} en prépa
        </span>
        {addedIds.size > 0 && (
          <button
            onClick={() => {
              if (confirm('Effacer toute la prépa RTA ?')) rta.clearAll();
            }}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hover:text-fire transition"
          >
            <Trash2 size={13} /> Tout effacer
          </button>
        )}
      </div>

      {loadState === 'loading' && monsters.length === 0 && (
        <p className="mt-4 text-ink-dim text-[13px]">Chargement des monstres…</p>
      )}

      {/* Zone tampon : les monstres ajoutés y arrivent avant classement */}
      <div className="mt-5">
        <RtaSection
          sectionKey={RTA_UNASSIGNED}
          label="Non classé"
          accent={sectionAccent(RTA_UNASSIGNED)}
          count={groups[RTA_UNASSIGNED]?.length ?? 0}
          onDropMonster={handleDrop}
        >
          {renderCards(groups[RTA_UNASSIGNED] ?? [])}
        </RtaSection>
      </div>

      {/* Sections par set de runes */}
      <div className="mt-6 flex flex-col gap-4">
        {runeSections.map((key) => (
          <RtaSection
            key={key}
            sectionKey={key}
            label={sectionLabel(key)}
            accent={sectionAccent(key)}
            count={groups[key]?.length ?? 0}
            removable={key !== RTA_OTHER}
            onRemoveSection={rta.removeSection}
            onDropMonster={handleDrop}
          >
            {renderCards(groups[key] ?? [])}
          </RtaSection>
        ))}
      </div>

      {/* Ajout d'une nouvelle section par set de runes */}
      <div className="mt-4 flex items-center gap-2.5 flex-wrap">
        <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim">
          Ajouter une section
        </span>
        <select
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          className="bg-panel border border-border text-ink rounded-lg px-2.5 py-1.5 text-[13px] outline-none"
        >
          <option value="">Choisir un set de runes…</option>
          {availableSets.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          disabled={!newSection}
          onClick={() => {
            rta.addSection(newSection);
            setNewSection('');
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3 py-1.5 text-[13px]
                     text-ink-dim hover:text-ink hover:border-[#4a52a0] transition
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={14} /> Créer
        </button>
      </div>

      {/* Ordre de tour global, trié par vitesse totale */}
      <section className="mt-10">
        <div className="flex items-center gap-3 pb-2.5 mb-4 border-b border-border">
          <h2 className="font-display text-[19px] tracking-wide">Ordre de tour</h2>
          <span className="font-mono text-ink-dim text-xs">
            par vitesse totale · le plus rapide à gauche
          </span>
        </div>
        <TurnOrder items={allItems} onRuneSpeed={rta.setRuneSpeed} />
      </section>
    </div>
  );
}
