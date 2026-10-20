import ArtefactsEtReliques, { type ArtefactsEtReliquesProps } from '../ArtefactsEtReliques';

// La place de la colonne « Artéfacts et relique » : son panneau en prend 312
// (`RETRAIT_PANNEAU`), ses sections 294.
export const LARGEUR_ARTEFACTS = 320;

// « Artéfacts et reliques », au bureau : la carte du téléphone (`ArtefactsEtReliques`,
// partagée) dans sa forme `bureau` — section sans cadre du panneau de la
// colonne, Attribut et Type sur une ligne —, SANS l'encart « Meilleurs
// artéfacts offensifs » : il devient une section à part, sous la relique
// (`MeilleursArtefactsBureau`).
export default function ArtefactsEtReliqueBureau(props: Omit<ArtefactsEtReliquesProps, 'blocArtefactsSeuls' | 'bureau'>) {
  return (
    <div>
      <ArtefactsEtReliques {...props} blocArtefactsSeuls={null} bureau />
    </div>
  );
}
