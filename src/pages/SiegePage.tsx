import { Shield, Swords, Lightbulb, Castle } from 'lucide-react';
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
  copies6: Map<number, number>;
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

// ⚠️ `copies6` est extrait explicitement : laissé dans `...boardProps`, il
// partait dans `SiegeBoard`, qui ne le connaît pas.
export default function SiegePage({
  tab,
  siege,
  offense,
  recos,
  builds,
  teams,
  copies6,
  ...boardProps
}: Props) {
  return (
    <div>
      {/* ⚠️ Sous-onglets MOBILES seulement (`lg:hidden`) : au-dessus de `lg`,
          la barre latérale les porte déjà, et les répéter ici donnerait deux
          jeux de contrôles pour la même navigation. */}
      <div className="mb-4 lg:hidden">
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
                    // Fond seul, sans fausse élévation — voir design.md.
                    active
                      ? 'bg-ctx-soft text-ink'
                      : 'text-ink-dim hoverable:text-ink'
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
          copies6={copies6}
          offense={offense}
        />
      ) : (
        // key={tab} pour réinitialiser l'état du board au changement de côté
        <SiegeBoard key={tab} side={tab as SiegeSide} siege={siege} {...boardProps} />
      )}
    </div>
  );
}
