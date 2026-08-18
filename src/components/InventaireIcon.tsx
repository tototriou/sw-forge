import { ReactNode } from 'react';

// Icônes des trois inventaires de « Mon compte » — monstres, runes, artéfacts —
// **dessinées au trait, dans le style de la librairie d'icônes** (lucide) :
// `currentColor`, contour de 2 (sur une grille de 24), extrémités arrondies.
//
// ⚠️ **Avant, c'étaient les PNG du jeu** (`public/icons/*.png`), multicolores. À
// côté des icônes lucide de la nav (bouclier, épées, jauge…), elles juraient —
// un pictogramme peint au milieu de traits monochromes. Redessinées ici, elles
// suivent la couleur du texte (`text-ctx`, `text-ink-dim`…) comme toutes les
// autres, sans que l'appelant ait à s'en soucier.
//
// Les silhouettes restent celles du jeu, pour qu'on reconnaisse ses inventaires :
// une tête de monstre cornue, l'hexagone vertical d'une rune, le médaillon
// hexagonal d'un artéfact.

export type InventaireIconKey = 'monster' | 'rune' | 'artifact';

const LABEL: Record<InventaireIconKey, string> = {
  monster: 'Monstres',
  rune: 'Runes',
  artifact: 'Artéfacts',
};

const PATHS: Record<InventaireIconKey, ReactNode> = {
  // Tête de démon : deux cornes, un crâne arrondi qui se termine en menton
  // pointu, deux yeux.
  monster: (
    <>
      <path d="M5.5 4l2.5 4M18.5 4l-2.5 4" />
      <path d="M4 10a8 8 0 0 1 16 0c0 3.6-2.1 6.2-5 7.7L12 20l-3-2.3C6.1 16.2 4 13.6 4 10Z" />
      <path d="M9 11h.01M15 11h.01" />
    </>
  ),
  // Hexagone VERTICAL (pointe en haut et en bas) — la pierre de rune.
  rune: <path d="M12 2l8.7 5v10L12 22l-8.7-5V7z" />,
  // Médaillon : hexagone HORIZONTAL (pointes sur les côtés) + un losange au
  // centre pour l'emblème — de quoi le distinguer de la rune d'un coup d'œil.
  artifact: (
    <>
      <path d="M2.5 12L7 3.7H17L21.5 12L17 20.3H7Z" />
      <path d="M12 8L15 12L12 16L9 12Z" />
    </>
  ),
};

export default function InventaireIcon({
  name,
  size = 16,
  className = '',
}: {
  name: InventaireIconKey;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={LABEL[name]}
      // `flex-none` : ces icônes vivent dans des rangées en flex (nav, onglets),
      // où elles se feraient écraser à la première contrainte de largeur.
      className={`flex-none ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
