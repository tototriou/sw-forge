import { RARITY_FILTER } from '../lib/effects';
import RuneIcon from './RuneIcon';

const RUNE_FRAME = `${import.meta.env.BASE_URL}rune-blank.png`;
const FRAME_RATIO = 50 / 63; // largeur / hauteur du cadre rune-blank.png

interface Props {
  slot: number; // 1..6 → oriente le cadre ((slot-1)*60°)
  setKey: string;
  rarity: number; // 1..5 → colorise l'icône de set
  ancient?: boolean; // halo blanc pour les runes antiques
  height?: number; // hauteur du cadre en px (défaut 46)
  className?: string;
}

// Cadre de rune (image du jeu) orienté selon le slot, avec l'icône de set
// centrée dedans et colorisée par rareté. Même rendu que la roue de MonsterGear.
export default function RuneSlotIcon({
  slot,
  setKey,
  rarity,
  ancient = false,
  height = 46,
  className = '',
}: Props) {
  const width = Math.round(height * FRAME_RATIO);
  const rot = ((slot - 1) % 6) * 60;
  const iconSize = Math.round(width * 0.62);

  return (
    <span
      className={`relative inline-block flex-none ${className}`}
      style={{ width, height }}
    >
      <img
        src={RUNE_FRAME}
        draggable={false}
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `rotate(${rot}deg)`,
          filter: ancient
            ? 'drop-shadow(0 0 1px rgba(255,255,255,1)) drop-shadow(0 0 2px rgba(255,255,255,0.9))'
            : undefined,
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <RuneIcon setKey={setKey} size={iconSize} filter={RARITY_FILTER[rarity] ?? RARITY_FILTER[1]} />
      </span>
    </span>
  );
}
