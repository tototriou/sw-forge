import { useMemo } from 'react';
import { Plus, Castle, Trash2 } from 'lucide-react';
import { Monster, ElementKey } from '../../types';
import { LoadState } from '../../hooks/useMonsters';
import { SiegeSide, UseSiegeState } from '../../hooks/useSiegeState';
import SiegeTeam from './SiegeTeam';
import CreateMonster from '../CreateMonster';
import { CustomLead } from '../../hooks/useCustomMonsters';

interface Props {
  side: SiegeSide;
  siege: UseSiegeState;
  monsters: Monster[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
}

// L'import se fait globalement depuis la barre de nav (voir AccountImportControl) :
// un seul import alimente RTA + défense + offense. Ce board ne gère que la
// composition/édition des équipes de son côté.
export default function SiegeBoard({
  side,
  siege,
  monsters,
  loadState,
  onCreateMonster,
  customMonsters,
  onDeleteMonster,
}: Props) {
  const noun = side === 'defense' ? 'défense' : 'attaque';

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  return (
    <div>
      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <button
          onClick={siege.addTeam}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px]
                     text-ink hover:border-[#4a52a0] transition"
        >
          <Plus size={15} /> Ajouter une équipe
        </button>

        <CreateMonster
          onCreate={onCreateMonster}
          customMonsters={customMonsters}
          onDelete={onDeleteMonster}
        />

        <span className="font-mono text-[12px] text-ink-dim">
          {siege.state.teams.length} équipe{siege.state.teams.length > 1 ? 's' : ''}
        </span>
        {siege.state.teams.length > 0 && (
          <button
            onClick={() => {
              if (confirm(`Effacer toutes les équipes d'${noun} de siège ?`)) siege.clearAll();
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
            Aucune équipe d'{noun} pour l'instant. Clique sur{' '}
            <b className="text-ink">Ajouter une équipe</b> pour composer, ou importe ton compte
            depuis la barre du haut.
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
              onSlotTick={siege.setSlotTick}
              onDismissAlert={siege.dismissTickAlert}
              onSwap={siege.swapSlots}
            />
          ))}
        </div>
      )}
    </div>
  );
}
