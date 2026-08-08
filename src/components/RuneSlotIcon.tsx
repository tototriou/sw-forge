import { RARITY_FILTER } from '../lib/effects';
import RuneIcon from './RuneIcon';

const RUNE_FRAME = `${import.meta.env.BASE_URL}rune-blank.png`;
const FRAME_RATIO = 50 / 63; // largeur / hauteur du cadre rune-blank.png

// Décalage de l'icône de set par slot (px à hauteur 46, mis à l'échelle ensuite).
// Slots 1 & 4 : calés à la main. Slots 2/3/5/6 : le long de l'AXE D'ORIENTATION
// de la rune (rotation du vecteur « vers le bas » par (slot-1)×60°).
function setNudge(slot: number, amp: number): { x: number; y: number } {
  if (slot === 1) return { x: 0, y: 4 };
  if (slot === 4) return { x: 0, y: -4 };
  const a = (((slot - 1) % 6) * 60 * Math.PI) / 180;
  // rotation de (0, -amp) (vers le haut), coords écran (y vers le bas)
  return { x: amp * Math.sin(a), y: -amp * Math.cos(a) };
}

interface Props {
  slot: number; // 1..6 → oriente le cadre ((slot-1)*60°)
  setKey: string;
  rarity: number; // 1..5 → colorise l'icône de set
  ancient?: boolean; // halo blanc pour les runes antiques
  height?: number; // hauteur du cadre en px (défaut 46)
  className?: string;
}

const AMP = -4.5; // amplitude du décalage de l'icône le long de l'axe (slots 2/3/5/6)

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
  const nudge = setNudge(slot, AMP);
  const k = height / 46; // mise à l'échelle du décalage selon la taille

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
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: `translate(${nudge.x * k}px, ${nudge.y * k}px)` }}
      >
        <RuneIcon setKey={setKey} size={iconSize} filter={RARITY_FILTER[rarity] ?? RARITY_FILTER[1]} />
      </span>
    </span>
  );
}
