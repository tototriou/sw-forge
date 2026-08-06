import { Shield, Swords } from 'lucide-react';
import { Monster, ElementKey } from '../types';
import { LoadState } from '../hooks/useMonsters';
import { SiegeSide, UseSiegeState } from '../hooks/useSiegeState';
import SiegeBoard from '../components/siege/SiegeBoard';
import { CustomLead } from '../hooks/useCustomMonsters';

interface Props {
  side: SiegeSide;
  siege: UseSiegeState;
  monsters: Monster[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
}

const SUB_TABS: { side: SiegeSide; label: string; icon: typeof Shield; hash: string }[] = [
  { side: 'defense', label: 'Défense', icon: Shield, hash: '#/siege/defense' },
  { side: 'offense', label: 'Offense', icon: Swords, hash: '#/siege/offense' },
];

export default function SiegePage({ side, ...boardProps }: Props) {
  return (
    <div>
      {/* Sous-onglets Défense / Offense */}
      <div className="mt-4">
        <nav className="inline-flex items-center gap-1 bg-panel border border-border rounded-xl p-1">
          {SUB_TABS.map((tab) => {
            const active = side === tab.side;
            const Icon = tab.icon;
            return (
              <a
                key={tab.side}
                href={tab.hash}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition
                  ${
                    active
                      ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                      : 'text-ink-dim hover:text-ink'
                  }`}
              >
                <Icon size={14} /> {tab.label}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Board du côté actif — key={side} pour réinitialiser l'état au changement d'onglet */}
      <SiegeBoard key={side} side={side} {...boardProps} />
    </div>
  );
}
