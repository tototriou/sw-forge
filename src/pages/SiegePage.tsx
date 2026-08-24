import { Monster, ElementKey, SiegeTeam as SiegeTeamData } from '../types';
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
  // Relayées jusqu'au board : l'outil de speed tuning ouvert depuis une équipe
  // propose les decks des DEUX camps.
  siegeDefenseTeams: SiegeTeamData[];
  siegeOffenseTeams: SiegeTeamData[];
  loadState: LoadState;
  onCreateMonster: (name: string, element: ElementKey, speed: number, lead?: CustomLead | null) => Monster;
  customMonsters: Monster[];
  onDeleteMonster: (id: string) => void;
  // Panneau d'actions mobile — piloté par le bouton « Options » (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
}


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
  menuOuvert,
  onFermerMenu,
  ...boardProps
}: Props) {
  return (
    <div>
      {/* ⚠️ **Plus de sous-onglets ICI.** Défense / Offense / Recommandations
          étaient une rangée posée en haut de la page sous `lg`, invisible tant
          qu'on n'était pas déjà dessus. Elles sont passées dans le panneau
          qu'ouvre l'onglet « Siège » de la barre du bas (voir MobileNavSheet) :
          sous le pouce, et alimentées par les mêmes sections que la barre
          latérale. Le titre de la barre du haut dit la vue courante. */}

      {tab === 'recos' ? (
        <RecoBoard
          recos={recos}
          monsters={boardProps.monsters}
          builds={builds}
          teams={teams}
          copies6={copies6}
          offense={offense}
          menuOuvert={menuOuvert}
          onFermerMenu={onFermerMenu}
        />
      ) : (
        // key={tab} pour réinitialiser l'état du board au changement de côté
        <SiegeBoard
          key={tab}
          side={tab as SiegeSide}
          siege={siege}
          menuOuvert={menuOuvert}
          onFermerMenu={onFermerMenu}
          {...boardProps}
        />
      )}
    </div>
  );
}
