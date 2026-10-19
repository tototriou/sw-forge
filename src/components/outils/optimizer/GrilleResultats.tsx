import { type ComponentProps, type RefObject } from 'react';
import BuildCandidateCard, { PlaceEnVerification } from '../BuildCandidateCard';
import { type BuildCandidate } from '../../../lib/runeBuildOptim';
import { type CompositionDePage } from '../../../lib/artifactQueue';

type PropsCarte = ComponentProps<typeof BuildCandidateCard>;

export interface GrilleResultatsProps {
  grilleResultatsRef: RefObject<HTMLDivElement>;
  composition: CompositionDePage;
  runeById: PropsCarte['runeById'];
  relicUsageById: PropsCarte['relicUsageById'];
  metric: PropsCarte['metric'];
  openDetailKey: PropsCarte['openDetailKey'];
  onToggleDetail: PropsCarte['onToggleDetail'];
  // Ce que l'écran calcule pour chaque carte : paire, relique, chiffres de
  // classement, gestes (`proprietesCarte` d'OptimizerSection).
  proprietesCarte: (c: BuildCandidate) => Omit<PropsCarte, 'rank' | 'candidate' | 'runeById' | 'relicUsageById' | 'metric' | 'openDetailKey' | 'onToggleDetail'>;
  hauteurCarte: number | null;
}

export default function GrilleResultats({ grilleResultatsRef, composition, runeById, relicUsageById, metric, openDetailKey, onToggleDetail, proprietesCarte, hauteurCarte }: GrilleResultatsProps) {
  return (
    <div ref={grilleResultatsRef} className="grid grid-cols-[repeat(auto-fill,minmax(min(360px,100%),1fr))] gap-3">
      {composition.cartes.map((c, i) => (
        <BuildCandidateCard
          key={c.runeIds.join('-')}
          rank={composition.premierRang + i}
          candidate={c}
          runeById={runeById}
          relicUsageById={relicUsageById}
          // Plus de mention « artéfacts pas encore optimisés » : avec
          // file, une carte n'apparaît qu'une fois résolue ; sans file,
          // rien n'est à attendre.
          metric={metric}
          openDetailKey={openDetailKey}
          onToggleDetail={onToggleDetail}
          {...proprietesCarte(c)}
        />
      ))}
      {Array.from({ length: composition.placesEnAttente }, (_, j) => (
        <PlaceEnVerification
          key={`verification-${composition.premierRang + composition.cartes.length + j}`}
          rank={composition.premierRang + composition.cartes.length + j}
          hauteur={hauteurCarte}
        />
      ))}
    </div>
  );
}
