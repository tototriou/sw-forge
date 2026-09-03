import { ReactNode } from 'react';
import { Ban } from 'lucide-react';

// Une icône de JEU (roue de runes, artéfact, monstre) barrée du symbole
// « interdit » — le pictogramme des actions qui RETIRENT ce que l'icône
// désigne : exclure des runes du pool, libérer les artéfacts réservés à un
// monstre.
//
// ⚠️ **Factorisé au QUATRIÈME usage, pas au premier.** Le montage était déjà
// recopié deux fois dans OptimizerSection (roue + `Ban`, monstre + `Ban`), avec
// un commentaire qui disait « même traitement que l'icône Exclusion de runes »
// — c'est-à-dire qu'il décrivait une règle qu'aucun code ne portait. Deux
// usages de plus arrivaient : le cadre, la taille du `Ban`, son épaisseur de
// trait et sa teinte auraient divergé au premier ajustement.
//
// ⚠️ **Ici et pas dans `src/ui/`.** Cette librairie ne connaît AUCUNE icône du
// jeu — voir le commentaire de `Bouton` sur le code couleur du jeu : ces
// éléments-là ne sont pas des composants d'interface, et les y faire entrer
// invite à leur appliquer des règles qui ne les concernent pas. Le composant
// vit donc à côté de `GameIcon`, dont il dépend.
//
// ⚠️ **Le `Ban` est positionné en ABSOLU, l'icône ne l'est pas.** L'artwork du
// jeu n'est pas toujours centré dans son canevas : superposer deux éléments en
// flux ferait dériver le cercle. D'où `relative` sur le cadre et l'`absolute`
// sur le seul `Ban`, qui reste ainsi parfaitement centré quoi qu'on lui passe.
export default function IconeInterdite({
  children,
  cadre = true,
  taille = 20,
  className = '',
}: {
  // L'icône barrée — `<GameIcon name="artifact" />`, une image de roue…
  children: ReactNode;
  // Le carré bordé qui porte l'icône, gabarit d'en-tête de carte. `false` pour
  // les usages qui posent déjà leur propre cadre (un `BoutonIcone cadre`).
  cadre?: boolean;
  // Diamètre du cercle « interdit ». À accorder au contenant, pas à l'icône :
  // le symbole doit DÉBORDER un peu de ce qu'il barre pour se lire.
  taille?: number;
  className?: string;
}) {
  return (
    <span
      className={`relative flex flex-none items-center justify-center ${
        cadre ? 'h-6 w-6 rounded-md border border-border-soft bg-panel2' : ''
      } ${className}`}
    >
      {children}
      <Ban size={taille} strokeWidth={1.75} className="pointer-events-none absolute text-bad/85" />
    </span>
  );
}
