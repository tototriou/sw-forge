import MeilleursArtefacts, { type MeilleursArtefactsProps } from '../MeilleursArtefacts';
import { LARGEUR_ARTEFACTS } from './ArtefactsEtReliqueBureau';

// « Meilleurs artéfacts offensifs pour ce build », au bureau : une carte à part,
// sous la carte « Artéfacts et reliques » (donc sous la relique), dans la
// colonne repliable « Artéfacts et relique ». Le contenu est
// `MeilleursArtefacts`, variante `carte` que le téléphone ne prend pas ; jamais replié au bureau (`etroit` faux).
export default function MeilleursArtefactsBureau(props: Omit<MeilleursArtefactsProps, 'carte' | 'etroit'>) {
  return (
    <div style={{ width: LARGEUR_ARTEFACTS }}>
      <MeilleursArtefacts {...props} etroit={false} carte />
    </div>
  );
}
