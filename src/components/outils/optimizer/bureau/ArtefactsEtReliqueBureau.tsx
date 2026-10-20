import ArtefactsEtReliques, { type ArtefactsEtReliquesProps } from '../ArtefactsEtReliques';

export const LARGEUR_ARTEFACTS = 320;

// « Artéfacts et reliques », au bureau : la carte du téléphone (`ArtefactsEtReliques`,
// partagée, inchangée) à la largeur de la colonne repliable
// « Artéfacts et relique », SANS l'encart « Meilleurs artéfacts offensifs » : il
// devient une carte à part, sous la relique (`MeilleursArtefactsBureau`).
export default function ArtefactsEtReliqueBureau(props: Omit<ArtefactsEtReliquesProps, 'blocArtefactsSeuls'>) {
  return (
    <div style={{ width: LARGEUR_ARTEFACTS }}>
      <ArtefactsEtReliques {...props} blocArtefactsSeuls={null} />
    </div>
  );
}
