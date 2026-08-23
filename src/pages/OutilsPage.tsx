import { Wrench } from 'lucide-react';
import { RuneDetail, Monster, RtaEntry, SiegeTeam } from '../types';
import { BoxItem } from '../lib/applyAccount';
import { LoadState } from '../hooks/useMonsters';
import { OptimizerState } from '../hooks/useOptimizerState';
import { ToolSub } from '../App';
import OptimizerSection from '../components/outils/OptimizerSection';
import SpeedTuningSection from '../components/outils/SpeedTuningSection';

interface Props {
  sub: ToolSub;
  box: BoxItem[];
  runes: RuneDetail[];
  loadState: LoadState;
  hydrating?: boolean;
  optimizer: OptimizerState;
  allMonsters: Monster[];
  rtaEntries: Record<string, RtaEntry>;
  siegeDefenseTeams: SiegeTeam[];
  siegeOffenseTeams: SiegeTeam[];
  // Panneau « Options » mobile — voir App.tsx (pageAPanneau) et
  // OptimizerSection.tsx. Simple relais : ce shell ne connaît pas son
  // contenu, seul l'outil actif (Optimizer aujourd'hui) le remplit.
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

// Shell fin, miroir d'AccountPage.tsx : un seul outil aujourd'hui
// (Optimizer), structuré pour en accueillir d'autres sans retoucher la nav
// ni ce fichier (ajouter une branche = ajouter un outil).
export default function OutilsPage({ sub, box, runes, loadState, hydrating, optimizer, allMonsters, rtaEntries, siegeDefenseTeams, siegeOffenseTeams, menuOuvert, onFermerMenu }: Props) {
  // Speed tuning ne dépend PAS d'un compte importé : on ajoute n'importe quel
  // monstre du bestiaire et on saisit sa vitesse de runes à la main. Il passe
  // donc AVANT la garde « aucune donnée de compte » (propre à l'Optimizer).
  if (sub === 'speed-tuning') {
    return (
      <SpeedTuningSection
        allMonsters={allMonsters}
        siegeDefenseTeams={siegeDefenseTeams}
        siegeOffenseTeams={siegeOffenseTeams}
      />
    );
  }

  const empty = box.length === 0;

  if (empty && hydrating) {
    return (
      <div className="mt-10 flex flex-col items-center text-center text-ink-dim">
        <Wrench size={34} className="mb-3 opacity-40" />
        <p className="text-sm">Chargement de ton compte…</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="mt-10 flex flex-col items-center text-center text-ink-dim">
        <Wrench size={34} className="mb-3 opacity-70" />
        <p className="text-base font-semibold text-ink">Aucune donnée de compte chargée</p>
        <p className="mt-1 text-sm max-w-sm">
          Importe ton compte (bouton « Importer un JSON ») pour rechercher des combinaisons de runes
          parmi celles que tu possèdes déjà.
        </p>
        {loadState === 'loading' && <p className="mt-3 text-xs">Chargement des monstres…</p>}
      </div>
    );
  }

  return (
    <div>
      {sub === 'optimizer' && (
        <OptimizerSection
          box={box}
          runes={runes}
          optimizer={optimizer}
          allMonsters={allMonsters}
          rtaEntries={rtaEntries}
          siegeDefenseTeams={siegeDefenseTeams}
          siegeOffenseTeams={siegeOffenseTeams}
          menuOuvert={menuOuvert}
          onFermerMenu={onFermerMenu}
        />
      )}
    </div>
  );
}
