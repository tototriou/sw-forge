import { ArtifactDetail } from '../types';
import ArtifactIcon from './ArtifactIcon';

// Cadre d'artéfact (image du jeu) avec son icône centrée dedans — le pendant de
// [RuneSlotIcon](src/components/RuneSlotIcon.tsx) pour les artéfacts.
//
// ⚠️ Extrait de [MonsterGear](src/components/MonsterGear.tsx), qui posait déjà
// exactement cette composition, plutôt que recopié : la liste d'artéfacts en
// avait besoin à son tour, et une seconde copie aurait divergé au premier
// ajustement de gabarit (même raison que Segmented, remonté à son deuxième
// usage).
const ARTIFACT_FRAME = `${import.meta.env.BASE_URL}artifact-blank.png`;

// Part du cadre occupée par l'icône. Vient du rendu de MonsterGear (26 px dans
// un cadre de 58), conservée pour que les deux écrans se ressemblent.
const ICON_RATIO = 26 / 58;

interface Props {
  artifact: ArtifactDetail;
  size?: number; // côté du cadre en px — l'image est CARRÉE (86×86)
  className?: string;
  // Mise en avant (sélection dans la roue d'équipement).
  glow?: boolean;
}

export default function ArtifactFrameIcon({
  artifact,
  size = 46,
  className = '',
  glow = false,
}: Props) {
  return (
    <span
      className={`relative inline-flex items-center justify-center flex-none ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={ARTIFACT_FRAME}
        draggable={false}
        className={`absolute inset-0 w-full h-full transition ${
          glow ? 'brightness-150 drop-shadow-[0_0_6px_rgba(232,196,74,0.9)]' : ''
        }`}
      />
      {/* L'ombre portée détache l'icône du cadre, qui est clair au centre. */}
      <ArtifactIcon
        artifact={artifact}
        size={Math.round(size * ICON_RATIO)}
        className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
      />
    </span>
  );
}
