import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Castle, Trash2, Gauge } from 'lucide-react';
import { Monster, ElementKey } from '../../types';
import { LoadState } from '../../hooks/useMonsters';
import { SiegeSide, UseSiegeState } from '../../hooks/useSiegeState';
import { useStickyState } from '../../hooks/useStickyState';
import SiegeTeam from './SiegeTeam';
import CreateMonster from '../CreateMonster';
import { ConfirmDialog } from '../Dialogs';
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

  // Mode vérification des ticks : désactivé par défaut (équipes neutres), on
  // l'active volontairement pour faire passer les auras de couleur.
  const [checkTicks, setCheckTicks] = useStickyState(`siege.checkTicks.${side}`, false);

  // Équipes en cours d'édition : remontées ici pour que la grille leur donne la
  // pleine largeur (les 3 slots seraient trop à l'étroit sur une demi-colonne).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (teamId: string) =>
    setExpandedIds((s) => {
      const next = new Set(s);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });

  // Scroll automatique vers l'équipe qu'on vient d'ajouter (rendue en dernier).
  const [scrollToLast, setScrollToLast] = useState(false);
  const [effacementAConfirmer, setEffacementAConfirmer] = useState(false);
  const lastTeamRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollToLast) return;
    lastTeamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setScrollToLast(false);
  }, [scrollToLast]);

  const monsterById = useMemo(() => {
    const m = new Map<string, Monster>();
    for (const mon of monsters) m.set(String(mon.id), mon);
    return m;
  }, [monsters]);

  return (
    <div>
      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <button
          onClick={() => {
            siege.addTeam();
            setScrollToLast(true);
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-panel px-3.5 py-2 text-[13px]
                     text-ink hoverable:border-accent transition"
        >
          <Plus size={15} /> Ajouter une équipe
        </button>

        {siege.state.teams.length > 0 && (
          <button
            onClick={() => setCheckTicks((v) => !v)}
            aria-pressed={checkTicks}
            title={
              checkTicks
                ? 'Masquer les auras de vérification'
                : 'Colorer les équipes selon leur calage sur les ticks ATB'
            }
            className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition ${
              checkTicks
                ? 'border-accent bg-panel2 text-ink shadow'
                : 'border-border bg-panel text-ink-dim hoverable:text-ink hoverable:border-accent'
            }`}
          >
            <Gauge size={15} /> Vérifier mes tick ATB
          </button>
        )}

        {/* En dernier des actions : c'est le geste le plus rare. */}
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
            onClick={() => setEffacementAConfirmer(true)}
            className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-dim hoverable:text-fire transition"
          >
            <Trash2 size={13} /> Tout effacer
          </button>
        )}
      </div>

      {effacementAConfirmer && (
        <ConfirmDialog
          titre={`Effacer toutes les équipes d'${noun} ?`}
          message="Toutes les équipes de ce côté seront supprimées, avec leurs monstres et leurs vitesses. L'autre côté n'est pas touché."
          libelleAction="Tout effacer"
          destructif
          onCancel={() => setEffacementAConfirmer(false)}
          onConfirm={() => {
            setEffacementAConfirmer(false);
            siege.clearAll();
          }}
        />
      )}

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
        // 2 équipes par ligne sur grand écran ; une équipe en édition reprend
        // toute la largeur. `items-start` évite d'étirer les cartes basses.
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {siege.state.teams.map((team, i) => (
            <div
              key={team.id}
              ref={i === siege.state.teams.length - 1 ? lastTeamRef : undefined}
              className={expandedIds.has(team.id) ? 'xl:col-span-2' : undefined}
            >
            <SiegeTeam
              team={team}
              index={i}
              monsters={monsters}
              monsterById={monsterById}
              checkTicks={checkTicks}
              expanded={expandedIds.has(team.id)}
              onToggleExpand={toggleExpand}
              onRemoveTeam={siege.removeTeam}
              onPickMonster={siege.setSlotMonster}
              onClearSlot={siege.clearSlot}
              onSlotRune={siege.setSlotRune}
              onSlotTick={siege.setSlotTick}
              onDismissAlert={siege.dismissTickAlert}
              onSwap={siege.swapSlots}
            />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
