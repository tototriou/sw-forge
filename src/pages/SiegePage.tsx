import { Shield, Swords, Lightbulb } from 'lucide-react';
import { Monster, ElementKey } from '../types';
import { LoadState } from '../hooks/useMonsters';
import { SiegeSide, UseSiegeState } from '../hooks/useSiegeState';
import { UseRecoState } from '../hooks/useSiegeRecos';
import { OwnedBuild, OwnedTeam } from '../lib/ownedBuilds';
import SiegeBoard from '../components/siege/SiegeBoard';
import RecoBoard from '../components/siege/RecoBoard';
import { CustomLead } from '../hooks/useCustomMonsters';

// Onglet de siège : les deux côtés jouables + les recommandations partagées.
export type SiegeTab = 'defense' | 'offense' | 'recos';

interface Props {
  tab: SiegeTab;
  siege: UseSiegeState;
  offense: UseSiegeState; // toujours l'offense, quel que soit l'onglet actif
  recos: UseRecoState;
  builds: OwnedBuild[];
  teams: OwnedTeam[];
  monsters: Monster[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
}

const SUB_TABS: { tab: SiegeTab; label: string; icon: typeof Shield; hash: string }[] = [
  { tab: 'defense', label: 'Défense', icon: Shield, hash: '#/siege/defense' },
  { tab: 'offense', label: 'Offense', icon: Swords, hash: '#/siege/offense' },
  { tab: 'recos', label: 'Recommandations', icon: Lightbulb, hash: '#/siege/recommandations' },
];

export default function SiegePage({ tab, siege, offense, recos, builds, teams, ...boardProps }: Props) {
  return (
    <div>
      {/* Sous-onglets Défense / Offense / Recommandations */}
      <div className="mt-4">
        <nav className="inline-flex items-center gap-1 bg-panel border border-border rounded-xl p-1">
          {SUB_TABS.map((t) => {
            const active = tab === t.tab;
            const Icon = t.icon;
            return (
              <a
                key={t.tab}
                href={t.hash}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition
                  ${
                    active
                      ? 'bg-gradient-to-br from-[#3a4270] to-[#272e52] text-ink shadow'
                      : 'text-ink-dim hover:text-ink'
                  }`}
              >
                <Icon size={14} /> {t.label}
              </a>
            );
          })}
        </nav>
      </div>

      {tab === 'recos' ? (
        <RecoBoard
          recos={recos}
          monsters={boardProps.monsters}
          builds={builds}
          teams={teams}
          offense={offense}
        />
      ) : (
        // key={tab} pour réinitialiser l'état du board au changement de côté
        <SiegeBoard key={tab} side={tab as SiegeSide} siege={siege} {...boardProps} />
      )}
    </div>
  );
}
