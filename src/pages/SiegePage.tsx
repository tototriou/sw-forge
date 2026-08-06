import { useMemo } from 'react';
import { Plus, Castle, Trash2 } from 'lucide-react';
import { Monster } from '../types';
import { LoadState } from '../hooks/useMonsters';
import { useSiegeState } from '../hooks/useSiegeState';
import SiegeTeam from '../components/siege/SiegeTeam';

interface Props {
  monsters: Monster[];
  loadState: LoadState;
}

export default function SiegePage({ monsters, loadState }: Props) {
  const siege = useSiegeState();

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  return (
    <div>
      <header className="mt-4">
        <h1 className="font-display font-black text-[clamp(28px,4vw,42px)] title-gradient mb-1.5">
          Siège
        </h1>
        <p className="text-ink-dim text-[14.5px] leading-relaxed max-w-2xl">
          Compose tes équipes de 3 monstres (défense et offense). Le premier slot est le leader et
          porte le lead de vitesse ; glisse-dépose pour intervertir les monstres. Ajuste la vitesse
          des runes et choisis un tick pour connaître la vitesse de combat visée.
        </p>
      </header>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={siege.addTeam}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px]
                     text-ink hover:border-[#4a52a0] transition"
        >
          <Plus size={15} /> Ajouter une équipe
        </button>
        <span className="font-mono text-[12px] text-ink-dim">
          {siege.state.teams.length} équipe{siege.state.teams.length > 1 ? 's' : ''}
        </span>
        {siege.state.teams.length > 0 && (
          <button
            onClick={() => {
              if (confirm('Effacer toutes les équipes de siège ?')) siege.clearAll();
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

      {siege.state.teams.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-panel/40 py-16 px-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-panel2 border border-border mb-4">
            <Castle size={26} className="text-ink-dim" />
          </div>
          <p className="text-ink-dim text-[14px] max-w-md">
            Aucune équipe pour l'instant. Clique sur <b className="text-ink">Ajouter une équipe</b>{' '}
            pour composer ta première défense ou offense.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {siege.state.teams.map((team, i) => (
            <SiegeTeam
              key={team.id}
              team={team}
              index={i}
              monsters={monsters}
              monsterById={monsterById}
              onRemoveTeam={siege.removeTeam}
              onPickMonster={siege.setSlotMonster}
              onClearSlot={siege.clearSlot}
              onSlotRune={siege.setSlotRune}
              onLead={siege.setLead}
              onTick={siege.setTick}
              onSwap={siege.swapSlots}
            />
          ))}
        </div>
      )}
    </div>
  );
}
