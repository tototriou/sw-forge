import { ArtifactDetail } from '../../types';
import type { AccountView } from '../../App';
import ArtifactsSummary from './ArtifactsSummary';
import ArtifactsList from './ArtifactsList';

interface Props {
  artifacts: ArtifactDetail[];
  // Vue courante. ⚠️ Elle vient de l'URL et de la barre latérale — la rangée
  // d'onglets qui vivait ici a disparu. Les vues disponibles sont déclarées
  // dans `lib/accountViews.ts`, source unique partagée avec la navigation.
  //
  // ⚠️ Pas de vue « Optimisation » côté artéfacts, et il n'y en aura pas : il
  // n'existe ni meule ni gemme pour eux. Une ligne tombée est définitive, le
  // seul levier est de monter la pièce au +15.
  // Voir spec/compte/calcul-artefacts.md.
  vue: AccountView;
  // Panneau d'actions mobile — piloté par le bouton « Options » (voir App.tsx).
  menuOuvert: boolean;
  onFermerMenu: () => void;
}

export default function ArtifactsSection({
  artifacts,
  vue: view,
  menuOuvert,
  onFermerMenu,
}: Props) {
  return (
    <div>
      {view === 'resume' && <ArtifactsSummary artifacts={artifacts} />}
      {view === 'liste' && (
        <ArtifactsList
          artifacts={artifacts}
          menuOuvert={menuOuvert}
          onFermerMenu={onFermerMenu}
        />
      )}
    </div>
  );
}
