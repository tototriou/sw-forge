import MeilleursArtefacts, { type MeilleursArtefactsProps } from '../MeilleursArtefacts';

// « Meilleurs artéfacts offensifs pour ce build », au bureau : une section à
// part du panneau de la colonne repliable « Artéfacts et relique », sous la
// relique. Le contenu est `MeilleursArtefacts`, variante `carte` que le
// téléphone ne prend pas ; jamais replié au bureau (`etroit` faux).
export default function MeilleursArtefactsBureau(props: Omit<MeilleursArtefactsProps, 'carte' | 'etroit'>) {
  return (
    <div>
      <MeilleursArtefacts {...props} etroit={false} carte />
    </div>
  );
}
